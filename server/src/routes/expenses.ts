import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Accountant', 'Fleet Manager']));

// GET all Expenses
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, vehicle_id, start_date, end_date } = req.query;

    let query = `
      SELECT 
        e.*,
        v.vehicle_number,
        v.vehicle_type,
        d.name as driver_name
      FROM expenses e
      LEFT JOIN vehicles v ON e.vehicle_id = v.id
      LEFT JOIN drivers d ON e.driver_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category && category !== 'All') {
      query += ` AND e.category = ?`;
      params.push(category);
    }
    if (vehicle_id) {
      query += ` AND e.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    if (start_date) {
      query += ` AND e.expense_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND e.expense_date <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY e.expense_date DESC LIMIT 200`;

    const expenses = await db.all(query, params);
    res.json(expenses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Expense Summary & Multi-Dimensional Breakdowns
router.get('/summary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 1. Time-based Aggregations
    const todayStats = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = date('now')
    `);

    const thisWeekStats = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
      WHERE expense_date >= date('now', '-7 days')
    `);

    const thisMonthStats = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
    `);

    const thisYearStats = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
      WHERE strftime('%Y', expense_date) = strftime('%Y', 'now')
    `);

    // 2. Category-wise Breakdown
    const categoryBreakdown = await db.all(`
      SELECT 
        category,
        COUNT(id) as count,
        SUM(amount) as total_amount
      FROM expenses
      GROUP BY category
      ORDER BY total_amount DESC
    `);

    // 3. Vehicle-wise Breakdown
    const vehicleBreakdown = await db.all(`
      SELECT 
        v.vehicle_number,
        v.vehicle_type,
        SUM(e.amount) as total_amount
      FROM expenses e
      JOIN vehicles v ON e.vehicle_id = v.id
      GROUP BY v.id
      ORDER BY total_amount DESC
    `);

    // 4. Driver-wise Breakdown
    const driverBreakdown = await db.all(`
      SELECT 
        d.name as driver_name,
        SUM(e.amount) as total_amount
      FROM expenses e
      JOIN drivers d ON e.driver_id = d.id
      GROUP BY d.id
      ORDER BY total_amount DESC
    `);

    res.json({
      dailyExpenses: todayStats?.total || 0,
      weeklyExpenses: thisWeekStats?.total || 0,
      monthlyExpenses: thisMonthStats?.total || 0,
      yearlyExpenses: thisYearStats?.total || 0,
      categoryBreakdown,
      vehicleBreakdown,
      driverBreakdown
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add Expense
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const amt = parseFloat(data.amount);

    if (!data.category || isNaN(amt) || amt <= 0) {
      res.status(400).json({ error: 'Valid expense category and positive amount are required' });
      return;
    }

    const description = data.description || data.notes || (data.vendor_name ? `Vendor: ${data.vendor_name}${data.invoice_ref ? ` (Inv: ${data.invoice_ref})` : ''}` : `${data.category} expense`);
    const expenseDate = data.expense_date || data.date || new Date().toISOString().split('T')[0];
    const paymentMethod = data.payment_method || data.payment_mode || 'UPI';

    await db.run(`
      INSERT INTO expenses (
        id, vehicle_id, driver_id, category, amount, expense_date,
        description, payment_method, approved_by, receipt_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.vehicle_id || null,
      data.driver_id || null,
      data.category,
      amt,
      expenseDate,
      description,
      paymentMethod,
      req.user?.name || 'Administrator',
      data.receipt_url || null
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ADD_EXPENSE',
      entity: 'Expense',
      entityId: id,
      newValues: { category: data.category, amount: amt, date: expenseDate, description },
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Expense recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Expense
router.delete('/:id', requireRole(['Super Admin', 'Accountant', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const expense = await db.get('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!expense) {
      res.status(404).json({ error: 'Expense record not found' });
      return;
    }

    if (expense.receipt_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(expense.receipt_url);
    }

    await db.run('DELETE FROM expenses WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_EXPENSE',
      entity: 'Expense',
      entityId: String(id),
      oldValues: expense,
      ipAddress: req.ip
    });

    res.json({ message: 'Expense record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

