import { db } from '../db/database';

export async function logAudit(params: {
  userId?: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
}) {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await db.run(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId || 'usr-system',
        params.userName || 'System Auto-Engine',
        params.action,
        params.entity,
        params.entityId || null,
        params.oldValues ? JSON.stringify(params.oldValues) : null,
        params.newValues ? JSON.stringify(params.newValues) : null,
        params.ipAddress || '127.0.0.1'
      ]
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
