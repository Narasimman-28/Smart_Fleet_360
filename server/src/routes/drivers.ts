import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';
import { deleteUploadedFile } from '../utils/storage';

const router = Router();

router.use(authenticateToken);

// GET all Drivers with assigned vehicle, license expiry countdown & GPS location
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    let query = `
      SELECT 
        d.*,
        COALESCE(d.profile_image_url, d.photo_url) as profile_image_url,
        COALESCE(d.profile_image_url, d.photo_url) as photo_url,
        v.id as assigned_vehicle_id,
        v.vehicle_number as assigned_vehicle_number,
        v.vehicle_type as assigned_vehicle_type,
        v.make as assigned_vehicle_make,
        v.model as assigned_vehicle_model,
        COALESCE(v.profile_image_url, v.photo_url) as assigned_vehicle_photo_url,
        COALESCE(v.profile_image_url, v.photo_url) as assigned_vehicle_image_url,
        dls.latitude,
        dls.longitude,
        dls.location_name,
        dls.source as location_source,
        dls.is_tracking,
        dls.trip_status,
        dls.last_updated as location_last_updated,
        (julianday(d.license_expiry_date) - julianday('now')) as raw_days_remaining
      FROM drivers d
      LEFT JOIN vehicles v ON (v.driver_id = d.id OR v.id = d.assigned_vehicle_id)
      LEFT JOIN driver_location_status dls ON dls.driver_id = d.id
    `;
    const params: any[] = [];

    if (userRole === 'Driver') {
      query += ` WHERE d.email = ? OR d.id = ? OR (d.phone IS NOT NULL AND d.phone = ?)`;
      params.push(req.user?.email || '', req.user?.id || '', req.user?.phone || '');
    }

    query += ` ORDER BY d.license_expiry_date ASC, d.created_at DESC`;

    const drivers = await db.all(query, params);

    const formatted = drivers.map(d => {
      const days = d.raw_days_remaining != null ? Math.ceil(d.raw_days_remaining) : 0;
      let licStatus = 'Valid';
      if (days < 0) licStatus = 'Expired';
      else if (days <= 30) licStatus = 'Expiring Soon';

      return {
        ...d,
        profile_image_url: d.profile_image_url || d.photo_url || null,
        photo_url: d.profile_image_url || d.photo_url || null,
        license_days_remaining: days,
        license_status: licStatus
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add Driver with Profile Image
router.post('/', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `drv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const name = data.name || data.driver_name;
    const phone = data.phone;
    const licenseNumber = data.license_number;
    const licenseExpiry = data.license_expiry_date || data.expiry_date;
    const licenseType = data.license_type || data.driver_type || 'Heavy Commercial (HMV)';
    const status = data.status || data.availability || 'Active';
    const profileImageUrl = data.profile_image_url || data.photo_url || data.profileImageUrl || data.imageUrl || null;
    const assignedVehicleId = data.assigned_vehicle_id || data.assigned_vehicle || null;

    if (!name || !phone || !licenseNumber || !licenseExpiry) {
      res.status(400).json({ error: 'Driver name, phone, license number, and license expiry date are required.' });
      return;
    }

    await db.run(`
      INSERT INTO drivers (
        id, name, phone, email, address, license_number, license_type,
        license_issue_date, license_expiry_date, badge_number, experience_years,
        assigned_vehicle_id, emergency_contact, blood_group, rating, status,
        license_document_url, photo_url, profile_image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      name.trim(),
      phone.trim(),
      data.email ? data.email.trim() : null,
      data.address ? data.address.trim() : 'Operations Depot Staff Quarter',
      licenseNumber.trim(),
      licenseType,
      data.license_issue_date || new Date().toISOString().split('T')[0],
      licenseExpiry,
      data.badge_number || null,
      parseInt(data.experience_years) || 2,
      assignedVehicleId,
      data.emergency_contact || null,
      data.blood_group || 'B+',
      parseFloat(data.rating) || 5.0,
      status,
      data.license_document_url || null,
      profileImageUrl,
      profileImageUrl
    ]);

    // If vehicle assigned, sync linkage on vehicle record
    if (assignedVehicleId) {
      await db.run('UPDATE vehicles SET driver_id = ? WHERE id = ?', [id, assignedVehicleId]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ADD_DRIVER',
      entity: 'Driver',
      entityId: id,
      newValues: { name, license: licenseNumber, profile_image_url: profileImageUrl, vehicle: assignedVehicleId },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Driver created successfully', id, profile_image_url: profileImageUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Driver by ID with full profile, active booking, and location history
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const driver = await db.get(`
      SELECT 
        d.*,
        COALESCE(d.profile_image_url, d.photo_url) as profile_image_url,
        COALESCE(d.profile_image_url, d.photo_url) as photo_url,
        v.id as assigned_vehicle_id,
        v.vehicle_number as assigned_vehicle_number,
        v.vehicle_type as assigned_vehicle_type,
        v.make as assigned_vehicle_make,
        v.model as assigned_vehicle_model,
        v.status as assigned_vehicle_status,
        COALESCE(v.profile_image_url, v.photo_url) as assigned_vehicle_photo_url,
        COALESCE(v.profile_image_url, v.photo_url) as assigned_vehicle_image_url,
        dls.latitude,
        dls.longitude,
        dls.location_name,
        dls.source as location_source,
        dls.is_tracking,
        dls.trip_status,
        dls.last_updated as location_last_updated
      FROM drivers d
      LEFT JOIN vehicles v ON (v.driver_id = d.id OR v.id = d.assigned_vehicle_id)
      LEFT JOIN driver_location_status dls ON dls.driver_id = d.id
      WHERE d.id = ?
    `, [id]);

    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Role security check: Driver can only view their own profile
    if (req.user?.role === 'Driver') {
      const isOwner = (req.user.email && driver.email?.toLowerCase() === req.user.email.toLowerCase()) ||
                      driver.id === req.user.id ||
                      (req.user.phone && driver.phone === req.user.phone);
      if (!isOwner) {
        res.status(403).json({ error: 'Access denied: Drivers cannot view other drivers\' private profiles.' });
        return;
      }
    }

    const activeTrip = await db.get(`
      SELECT b.*, v.vehicle_number, v.make, v.model,
             COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.driver_id = ? AND b.booking_status IN ('Confirmed', 'Started')
      ORDER BY b.start_date ASC LIMIT 1
    `, [id]);

    const recentLocations = await db.all(`
      SELECT * FROM trip_locations
      WHERE driver_id = ?
      ORDER BY recorded_at DESC
      LIMIT 25
    `, [id]);

    res.json({
      driver: {
        ...driver,
        profile_image_url: driver.profile_image_url || driver.photo_url || null,
        photo_url: driver.profile_image_url || driver.photo_url || null
      },
      activeTrip: activeTrip || null,
      recentLocations: recentLocations.reverse()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Driver with Profile Image
router.put('/:id', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = req.body;

    const existing = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const name = data.name || data.driver_name || existing.name;
    const phone = data.phone || existing.phone;
    const email = data.email !== undefined ? data.email : existing.email;
    const address = data.address !== undefined ? data.address : existing.address;
    const licenseNumber = data.license_number || existing.license_number;
    const licenseType = data.license_type || data.driver_type || existing.license_type;
    const licenseIssueDate = data.license_issue_date || existing.license_issue_date;
    const licenseExpiry = data.license_expiry_date || data.expiry_date || existing.license_expiry_date;
    const badgeNumber = data.badge_number !== undefined ? data.badge_number : existing.badge_number;
    const experienceYears = data.experience_years !== undefined ? parseInt(data.experience_years) : existing.experience_years;
    const emergencyContact = data.emergency_contact !== undefined ? data.emergency_contact : existing.emergency_contact;
    const bloodGroup = data.blood_group !== undefined ? data.blood_group : existing.blood_group;
    const status = data.status || data.availability || existing.status;
    const assignedVehicleId = data.assigned_vehicle_id !== undefined ? (data.assigned_vehicle_id || null) : existing.assigned_vehicle_id;
    const licenseDocumentUrl = data.license_document_url !== undefined ? data.license_document_url : existing.license_document_url;
    const currentLocationName = data.current_location_name !== undefined ? data.current_location_name : existing.current_location_name;

    // Profile Image URL (support explicit empty string to remove image, or new URL)
    let profileImageUrl = existing.profile_image_url || existing.photo_url || null;
    if (data.profile_image_url !== undefined) {
      profileImageUrl = data.profile_image_url || null;
    } else if (data.photo_url !== undefined) {
      profileImageUrl = data.photo_url || null;
    } else if (data.profileImageUrl !== undefined) {
      profileImageUrl = data.profileImageUrl || null;
    }

    // Clean up old image if removed or replaced
    const oldImg = existing.profile_image_url || existing.photo_url;
    if (oldImg && profileImageUrl !== oldImg && oldImg.startsWith('/uploads/')) {
      deleteUploadedFile(oldImg);
    }

    await db.run(`
      UPDATE drivers SET
        name = ?,
        phone = ?,
        email = ?,
        address = ?,
        license_number = ?,
        license_type = ?,
        license_issue_date = ?,
        license_expiry_date = ?,
        badge_number = ?,
        experience_years = ?,
        assigned_vehicle_id = ?,
        emergency_contact = ?,
        blood_group = ?,
        status = ?,
        photo_url = ?,
        profile_image_url = ?,
        license_document_url = ?,
        current_location_name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name,
      phone,
      email,
      address,
      licenseNumber,
      licenseType,
      licenseIssueDate,
      licenseExpiry,
      badgeNumber,
      experienceYears,
      assignedVehicleId,
      emergencyContact,
      bloodGroup,
      status,
      profileImageUrl,
      profileImageUrl,
      licenseDocumentUrl,
      currentLocationName,
      id
    ]);

    // Sync vehicle driver assignment
    if (assignedVehicleId !== existing.assigned_vehicle_id) {
      // Unassign from old vehicle
      if (existing.assigned_vehicle_id) {
        await db.run('UPDATE vehicles SET driver_id = NULL WHERE driver_id = ?', [id]);
      }
      // Assign to new vehicle
      if (assignedVehicleId) {
        await db.run('UPDATE vehicles SET driver_id = ? WHERE id = ?', [id, assignedVehicleId]);
      }
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'UPDATE_DRIVER',
      entity: 'Driver',
      entityId: String(id),
      oldValues: existing,
      newValues: { name, phone, license_number: licenseNumber, profile_image_url: profileImageUrl, status, assigned_vehicle_id: assignedVehicleId },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Driver details updated successfully', profile_image_url: profileImageUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Assign Vehicle to Driver
router.patch('/:id/assign-vehicle', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { vehicle_id } = req.body;

    // Reset current vehicle's driver
    await db.run('UPDATE vehicles SET driver_id = NULL WHERE driver_id = ?', [id]);

    if (vehicle_id) {
      await db.run('UPDATE vehicles SET driver_id = ? WHERE id = ?', [id, vehicle_id]);
      await db.run('UPDATE drivers SET assigned_vehicle_id = ? WHERE id = ?', [vehicle_id, id]);
    } else {
      await db.run('UPDATE drivers SET assigned_vehicle_id = NULL WHERE id = ?', [id]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ASSIGN_VEHICLE_TO_DRIVER',
      entity: 'Driver',
      entityId: String(id),
      newValues: { vehicle_id },
      ipAddress: req.ip
    });

    res.json({ message: 'Driver vehicle assignment updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Driver
router.delete('/:id', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Clean up associated driver files
    const filesToDelete = [
      driver.profile_image_url,
      driver.photo_url,
      driver.license_document_url,
      driver.id_proof_url,
      driver.medical_cert_url
    ];
    for (const f of filesToDelete) {
      if (f && f.startsWith('/uploads/')) {
        deleteUploadedFile(f);
      }
    }

    // Unassign vehicles assigned to this driver
    await db.run('UPDATE vehicles SET driver_id = NULL WHERE driver_id = ?', [id]);

    // Delete driver records
    await db.run('DELETE FROM drivers WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_DRIVER',
      entity: 'Driver',
      entityId: String(id),
      oldValues: driver,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: `Driver ${driver.name} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
