import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Fleet Manager', 'Compliance Manager']));

// GET all documents in vault
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id, document_type } = req.query;
    let query = `
      SELECT 
        d.*,
        v.vehicle_number,
        v.vehicle_type,
        (julianday(d.expiry_date) - julianday('now')) as raw_days_remaining
      FROM vehicle_documents d
      JOIN vehicles v ON d.vehicle_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (vehicle_id) {
      query += ` AND d.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    if (document_type && document_type !== 'All') {
      query += ` AND d.document_type = ?`;
      params.push(document_type);
    }

    query += ` ORDER BY d.created_at DESC`;

    const docs = await db.all(query, params);
    const formatted = docs.map(d => {
      const days = d.expiry_date ? Math.ceil(d.raw_days_remaining) : null;
      let status = d.status;
      if (days !== null) {
        if (days < 0) status = 'Expired';
        else if (days <= 30) status = 'Expiring Soon';
        else status = 'Active';
      }
      return {
        ...d,
        days_remaining: days,
        status
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Upload / Add Document Metadata
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.document_type || !data.document_name) {
      res.status(400).json({ error: 'Vehicle, document type, and document name are required' });
      return;
    }

    await db.run(`
      INSERT INTO vehicle_documents (
        id, vehicle_id, document_type, document_name, document_number,
        issue_date, expiry_date, file_url, file_size_kb, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.document_type, data.document_name,
      data.document_number || null,
      data.issue_date || null,
      data.expiry_date || null,
      data.file_url || 'https://smartfleet360.internal/docs/document.pdf',
      data.file_size_kb || 250,
      data.status || 'Active',
      data.notes || ''
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'UPLOAD_DOCUMENT',
      entity: 'Document',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Document uploaded and indexed successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Document
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const doc = await db.get('SELECT * FROM vehicle_documents WHERE id = ?', [id]);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (doc.file_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(doc.file_url);
    }

    await db.run('DELETE FROM vehicle_documents WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_DOCUMENT',
      entity: 'Document',
      entityId: String(id),
      oldValues: doc,
      ipAddress: req.ip
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

