import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireSuperAdmin } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

// All user management routes require valid authentication and Super Admin role
router.use(authenticateToken);
router.use(requireSuperAdmin);

// 1. List Users with optional search, role, status filters
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, role, status } = req.query;
    let query = 'SELECT id, name, email, role, phone, avatar_url, status, last_login, created_at, updated_at FROM users WHERE 1=1';
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(s, s, s);
    }

    if (role && typeof role === 'string' && role !== 'All') {
      query += ' AND role = ?';
      params.push(role);
    }

    if (status && typeof status === 'string' && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at ASC';
    const users = await db.all(query, params);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create User
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone, status } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Name, email, password, and role are required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      res.status(409).json({ error: 'A user with this email address already exists' });
      return;
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const userStatus = status || 'Active';

    await db.run(`
      INSERT INTO users (id, name, email, password_hash, role, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, name.trim(), cleanEmail, passwordHash, role, phone || null, userStatus]);

    await logAudit({
      userId: req.user?.id || 'usr-admin-1',
      userName: req.user?.name || 'Administrator',
      action: 'USER_CREATE',
      entity: 'User',
      entityId: userId,
      newValues: { name, email: cleanEmail, role, status: userStatus },
      ipAddress: req.ip
    });

    res.status(201).json({
      id: userId,
      name,
      email: cleanEmail,
      role,
      phone,
      status: userStatus,
      message: 'User created successfully'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update User
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, status } = req.body;

    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const cleanEmail = email ? email.trim().toLowerCase() : existing.email;
    if (cleanEmail !== existing.email.toLowerCase()) {
      const emailConflict = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [cleanEmail, id]);
      if (emailConflict) {
        res.status(409).json({ error: 'Email already in use by another account' });
        return;
      }
    }

    const updatedName = name ? name.trim() : existing.name;
    const updatedRole = role || existing.role;
    const updatedPhone = phone !== undefined ? phone : existing.phone;
    const updatedStatus = status || existing.status;
    const nowIso = new Date().toISOString();

    await db.run(`
      UPDATE users
      SET name = ?, email = ?, role = ?, phone = ?, status = ?, updated_at = ?
      WHERE id = ?
    `, [updatedName, cleanEmail, updatedRole, updatedPhone, updatedStatus, nowIso, id]);

    await logAudit({
      userId: req.user?.id || 'usr-admin-1',
      userName: req.user?.name || 'Administrator',
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: String(id),
      oldValues: { name: existing.name, email: existing.email, role: existing.role, status: existing.status },
      newValues: { name: updatedName, email: cleanEmail, role: updatedRole, status: updatedStatus },
      ipAddress: req.ip
    });

    res.json({ message: 'User updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Change Status (Active / Inactive / Suspended)
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be Active, Inactive, or Suspended' });
      return;
    }

    // Protect self-deactivation
    if (req.user?.id === id && status !== 'Active') {
      res.status(400).json({ error: 'Cannot deactivate your own logged-in administrator account' });
      return;
    }

    const existing = await db.get('SELECT id, name, status FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await db.run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);

    await logAudit({
      userId: req.user?.id || 'usr-admin-1',
      userName: req.user?.name || 'Administrator',
      action: 'USER_STATUS_CHANGE',
      entity: 'User',
      entityId: String(id),
      oldValues: { status: existing.status },
      newValues: { status },
      ipAddress: req.ip
    });

    res.json({ message: `User status changed to ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Reset Password
router.post('/:id/reset-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const existing = await db.get('SELECT id, name, email FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, new Date().toISOString(), id]);

    await logAudit({
      userId: req.user?.id || 'usr-admin-1',
      userName: req.user?.name || 'Administrator',
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: String(id),
      newValues: { email: existing.email, resetBy: req.user?.email },
      ipAddress: req.ip
    });

    res.json({ message: `Password reset successfully for ${existing.name}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete User
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (req.user?.id === id) {
      res.status(400).json({ error: 'Cannot delete your own active administrator account' });
      return;
    }

    const existing = await db.get('SELECT id, name, email FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id || 'usr-admin-1',
      userName: req.user?.name || 'Administrator',
      action: 'USER_DELETE',
      entity: 'User',
      entityId: String(id),
      oldValues: { name: existing.name, email: existing.email },
      ipAddress: req.ip
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
