import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { generateToken, authenticateToken, optionalAuthenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

// Helper to format safe user payload (Never expose password_hash)
function formatSafeUser(user: any, activeRole?: string, actualRole?: string) {
  const role = activeRole || user.role;
  const realRole = actualRole || user.role;
  const status = user.status || 'Active';
  const isActive = status === 'Active';

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    actualRole: realRole,
    phone: user.phone || null,
    mobile: user.phone || null,
    avatar_url: user.avatar_url || null,
    profileImage: user.avatar_url || null,
    status,
    isActive,
    last_login: user.last_login || null,
    lastLoginAt: user.last_login || null,
    created_at: user.created_at,
    createdAt: user.created_at,
    updated_at: user.updated_at,
    updatedAt: user.updated_at
  };
}

// 1. User Login (POST /api/auth/login)
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, identifier: bodyIdentifier, password } = req.body;
    const identifier = email || username || bodyIdentifier;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Email / Username and password are required.' });
      return;
    }

    const cleanIdentifier = String(identifier).trim();
    const user = await db.get(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)',
      [cleanIdentifier, cleanIdentifier]
    );

    if (!user) {
      // Safe error message - do not reveal whether user exists
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // Check account active status
    if (user.status === 'Inactive' || user.status === 'Suspended') {
      res.status(403).json({ error: 'Your account is currently inactive. Contact the administrator.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit({
        userId: user.id,
        userName: user.name,
        action: 'FAILED_LOGIN',
        entity: 'User',
        entityId: user.id,
        newValues: { email: user.email, reason: 'Invalid password attempt' },
        ipAddress: req.ip
      });
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // Update last_login timestamp in database
    const nowIso = new Date().toISOString();
    await db.run('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?', [nowIso, nowIso, user.id]);

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      newValues: { role: user.role, email: user.email },
      ipAddress: req.ip
    });

    const safeUser = formatSafeUser({ ...user, last_login: nowIso, updated_at: nowIso });

    res.json({
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server authentication error' });
  }
});

// 2. User Logout (POST /api/auth/logout)
router.post('/logout', optionalAuthenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await logAudit({
        userId: req.user.id,
        userName: req.user.name,
        action: 'LOGOUT',
        entity: 'User',
        entityId: req.user.id,
        newValues: { email: req.user.email },
        ipAddress: req.ip
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Current Authenticated User (GET /api/auth/me)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated session. Please login.' });
      return;
    }

    const user = await db.get(
      'SELECT id, name, email, role, phone, avatar_url, status, last_login, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      res.status(401).json({ error: 'User account not found or removed.' });
      return;
    }

    if (user.status === 'Inactive' || user.status === 'Suspended') {
      res.status(403).json({ error: 'Your account is currently inactive. Contact the administrator.' });
      return;
    }

    const safeUser = formatSafeUser(user, req.user.role, req.user.actualRole);

    res.json({
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update Current User Profile (PUT /api/auth/profile)
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { name, phone, mobile, avatar_url, profileImage, currentPassword, newPassword, role } = req.body;

    const existing = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!existing) {
      res.status(404).json({ error: 'User record not found' });
      return;
    }

    // Role cannot be updated by normal user unless Super Admin
    if (role && role !== existing.role) {
      const isSuperAdmin = req.user.role === 'Super Admin' || req.user.actualRole === 'Super Admin';
      if (!isSuperAdmin) {
        res.status(403).json({ error: 'Normal users cannot modify their own system role. Contact administrator.' });
        return;
      }
    }

    const updatedName = name && name.trim() ? name.trim() : existing.name;
    const updatedPhone = (phone !== undefined ? phone : (mobile !== undefined ? mobile : existing.phone)) || null;
    const updatedAvatar = (avatar_url !== undefined ? avatar_url : (profileImage !== undefined ? profileImage : existing.avatar_url)) || null;
    const updatedRole = (role && (req.user.role === 'Super Admin' || req.user.actualRole === 'Super Admin')) ? role : existing.role;

    let updatedPasswordHash = existing.password_hash;

    // Handle password change if requested
    if (newPassword) {
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters long' });
        return;
      }

      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required to change your password' });
        return;
      }

      const isCurrentMatch = await bcrypt.compare(currentPassword, existing.password_hash);
      if (!isCurrentMatch) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      updatedPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    const nowIso = new Date().toISOString();

    await db.run(`
      UPDATE users SET
        name = ?,
        phone = ?,
        avatar_url = ?,
        role = ?,
        password_hash = ?,
        updated_at = ?
      WHERE id = ?
    `, [updatedName, updatedPhone, updatedAvatar, updatedRole, updatedPasswordHash, nowIso, req.user.id]);

    await logAudit({
      userId: existing.id,
      userName: updatedName,
      action: 'PROFILE_UPDATE',
      entity: 'User',
      entityId: existing.id,
      oldValues: { name: existing.name, phone: existing.phone, avatar_url: existing.avatar_url },
      newValues: { name: updatedName, phone: updatedPhone, avatar_url: updatedAvatar },
      ipAddress: req.ip
    });

    const safeUser = formatSafeUser({
      ...existing,
      name: updatedName,
      phone: updatedPhone,
      avatar_url: updatedAvatar,
      role: updatedRole,
      updated_at: nowIso
    }, updatedRole, req.user.actualRole);

    res.json({
      message: 'Profile updated successfully',
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Super Admin Controlled Role Switching / Impersonation (POST /api/auth/switch-role)
router.post('/switch-role', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const isSuperAdmin = req.user.role === 'Super Admin' || req.user.actualRole === 'Super Admin';
    if (!isSuperAdmin) {
      res.status(403).json({ error: 'Access denied: Only Super Admin can switch active roles.' });
      return;
    }

    const { role } = req.body;
    const allowedRoles = [
      'Super Admin',
      'Fleet Manager',
      'Compliance Manager',
      'Accountant',
      'Mechanic',
      'Driver'
    ];

    if (!allowedRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role specified. Allowed: ${allowedRoles.join(', ')}` });
      return;
    }

    const dbUser = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!dbUser) {
      res.status(404).json({ error: 'User record not found' });
      return;
    }

    const targetRole = role === 'Super Admin' ? 'Super Admin' : role;
    const token = generateToken({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: targetRole,
      actualRole: 'Super Admin'
    });

    await logAudit({
      userId: dbUser.id,
      userName: dbUser.name,
      action: 'ROLE_SWITCH',
      entity: 'UserSession',
      entityId: dbUser.id,
      oldValues: { activeRole: req.user.role, actualRole: 'Super Admin' },
      newValues: { activeRole: targetRole, actualRole: 'Super Admin' },
      ipAddress: req.ip
    });

    const safeUser = formatSafeUser(dbUser, targetRole, 'Super Admin');

    res.json({
      token,
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
