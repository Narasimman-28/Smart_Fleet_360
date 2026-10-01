import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant']));

// GET all FASTag records with live stats
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const records = await db.all(`
      SELECT 
        f.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        (SELECT COUNT(*) FROM fastag_transactions WHERE fastag_id = f.fastag_id) as total_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM fastag_transactions WHERE fastag_id = f.fastag_id) as total_toll_spent
      FROM fastag_records f
      JOIN vehicles v ON f.vehicle_id = v.id
      ORDER BY f.wallet_balance ASC
    `);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single vehicle FASTag record
router.get('/vehicle/:vehicle_id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id } = req.params;
    const record = await db.get(`
      SELECT 
        f.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model
      FROM fastag_records f
      JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.vehicle_id = ?
    `, [vehicle_id]);
    
    if (!record) {
      res.status(404).json({ error: 'FASTag record not found for this vehicle' });
      return;
    }
    res.json({ record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET FASTag transactions
router.get('/transactions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id } = req.query;
    let query = `
      SELECT 
        t.*,
        v.vehicle_number,
        v.vehicle_type,
        f.bank_name
      FROM fastag_transactions t
      JOIN fastag_records f ON t.fastag_id = f.fastag_id
      JOIN vehicles v ON f.vehicle_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (vehicle_id) {
      query += ` AND f.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    query += ` ORDER BY t.transaction_date DESC, t.transaction_time DESC LIMIT 100`;

    const txns = await db.all(query, params);
    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Recharge FASTag Wallet
router.post('/recharge', requireRole(['Super Admin', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id, amount, payment_mode } = req.body;
    const rechargeAmt = parseFloat(amount);

    if (!vehicle_id || isNaN(rechargeAmt) || rechargeAmt <= 0) {
      res.status(400).json({ error: 'Valid vehicle and positive recharge amount are required' });
      return;
    }

    const fastag = await db.get('SELECT * FROM fastag_records WHERE vehicle_id = ?', [vehicle_id]);
    if (!fastag) {
      res.status(404).json({ error: 'FASTag not configured for this vehicle' });
      return;
    }

    const newBalance = fastag.wallet_balance + rechargeAmt;
    const today = new Date().toISOString().split('T')[0];

    await db.run(`
      UPDATE fastag_records SET
        wallet_balance = ?,
        last_recharge_date = ?,
        last_recharge_amount = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newBalance, today, rechargeAmt, fastag.id]);

    // Record into Payments ledger
    await db.run(`
      INSERT INTO payments (id, reference_type, reference_id, vehicle_id, amount, payment_date, payment_mode, status, notes)
      VALUES (?, 'FASTag Recharge', ?, ?, ?, ?, ?, 'Paid', ?)
    `, [
      `pay-ft-${Date.now()}`,
      fastag.id,
      vehicle_id,
      rechargeAmt,
      today,
      payment_mode || 'UPI',
      `FASTag Recharge for ${fastag.tag_number}`
    ]);

    // Record into Expenses
    await db.run(`
      INSERT INTO expenses (id, vehicle_id, category, amount, expense_date, description, payment_method, approved_by)
      VALUES (?, ?, 'FASTag Toll', ?, ?, ?, ?, ?)
    `, [
      `exp-ft-${Date.now()}`,
      vehicle_id,
      rechargeAmt,
      today,
      `FASTag Wallet Recharge (${fastag.bank_name})`,
      payment_mode || 'UPI',
      req.user?.name || 'Administrator'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'FASTAG_RECHARGE',
      entity: 'FASTag',
      entityId: fastag.id,
      newValues: { amount: rechargeAmt, newBalance },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: `FASTag recharged with ₹${rechargeAmt}. New Balance: ₹${newBalance}`, newBalance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add / Configure FASTag
router.post('/', requireRole(['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = data.id || `ft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const issuerBank = data.issuer_bank || data.bank_name || 'ICICI';
    const tagId = data.fastag_id || data.tag_number || data.tagId;
    const minBalance = parseFloat(data.minimum_balance || data.min_balance_threshold) || 500;
    const walletBalance = parseFloat(data.wallet_balance || data.balance) || 500;
    const mobile = data.linked_mobile_number || data.mobile || '+91 98100 00001';

    if (!data.vehicle_id || !tagId) {
      res.status(400).json({ error: 'Vehicle and FASTag ID are required' });
      return;
    }

    await db.run(`
      INSERT INTO fastag_records (
        id, vehicle_id, fastag_id, issuer_bank,
        wallet_balance, minimum_balance, linked_mobile_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(vehicle_id) DO UPDATE SET
        fastag_id = excluded.fastag_id,
        issuer_bank = excluded.issuer_bank,
        wallet_balance = excluded.wallet_balance,
        minimum_balance = excluded.minimum_balance,
        linked_mobile_number = excluded.linked_mobile_number,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `, [
      id, data.vehicle_id, tagId,
      issuerBank,
      walletBalance,
      minBalance,
      mobile,
      data.status || 'Active'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'CONFIGURE_FASTAG',
      entity: 'FASTag',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'FASTag account configured successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE FASTag Record
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const fastag = await db.get('SELECT * FROM fastag_records WHERE id = ?', [id]);
    if (!fastag) {
      res.status(404).json({ error: 'FASTag record not found' });
      return;
    }

    await db.run('DELETE FROM fastag_transactions WHERE fastag_id = ?', [fastag.fastag_id]);
    await db.run('DELETE FROM fastag_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_FASTAG',
      entity: 'FASTag',
      entityId: String(id),
      oldValues: fastag,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'FASTag record and transactions deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Single FASTag Transaction
router.delete('/transactions/:txnId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { txnId } = req.params;
    const txn = await db.get('SELECT * FROM fastag_transactions WHERE id = ?', [txnId]);
    if (!txn) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    await db.run('DELETE FROM fastag_transactions WHERE id = ?', [txnId]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_FASTAG_TRANSACTION',
      entity: 'FASTagTransaction',
      entityId: String(txnId),
      oldValues: txn,
      ipAddress: req.ip
    });

    res.json({ message: 'FASTag transaction deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
