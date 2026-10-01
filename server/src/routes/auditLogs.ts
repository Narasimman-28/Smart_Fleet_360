import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// GET Audit Logs (Protected)
router.get('/', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { entity, action } = req.query;
    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: any[] = [];

    if (entity && entity !== 'All') {
      query += ` AND entity = ?`;
      params.push(entity);
    }
    if (action && action !== 'All') {
      query += ` AND action = ?`;
      params.push(action);
    }

    query += ` ORDER BY created_at DESC LIMIT 150`;

    const logs = await db.all(query, params);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
