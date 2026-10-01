import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';
import { deleteUploadedFile, logUploadDebugInfo } from '../utils/storage';
import { handleOptionalVehicleUpload } from './uploads';

const router = Router();

router.use(authenticateToken);

// GET all vehicles with rich filtering
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, type, vehicle_type, fuel, fuel_type, fleet_id, search } = req.query;
    const resolvedType = type || vehicle_type;
    const resolvedFuel = fuel || fuel_type;

    let query = `
      SELECT 
        v.*,
        v.colour as color,
        d.name as driver_name,
        d.phone as driver_phone,
        f.name as fleet_name,
        f.color_code as fleet_color,
        rto.registration_validity as rc_expiry,
        rto.status as rc_status,
        ir.policy_expiry_date as insurance_expiry,
        COALESCE(ir.status, 'Valid') as insurance_status,
        pr.expiry_date as puc_expiry,
        COALESCE(pr.status, 'Valid') as puc_status,
        fr.expiry_date as fitness_expiry,
        COALESCE(fr.status, 'Valid') as fitness_status,
        pm.expiry_date as permit_expiry,
        COALESCE(pm.status, 'Active') as permit_status,
        ft.wallet_balance as fastag_balance,
        COALESCE(ft.status, 'Active') as fastag_status,
        (SELECT COUNT(*) FROM challans WHERE vehicle_id = v.id AND payment_status != 'Paid') as pending_challans_count
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      LEFT JOIN fleets f ON v.fleet_id = f.id
      LEFT JOIN rto_records rto ON rto.vehicle_id = v.id
      LEFT JOIN insurance_records ir ON ir.vehicle_id = v.id
      LEFT JOIN puc_records pr ON pr.vehicle_id = v.id
      LEFT JOIN fitness_records fr ON fr.vehicle_id = v.id
      LEFT JOIN permits pm ON pm.vehicle_id = v.id
      LEFT JOIN fastag_records ft ON ft.vehicle_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'All') {
      query += ` AND v.status = ?`;
      params.push(status);
    }

    if (resolvedType && resolvedType !== 'All') {
      query += ` AND v.vehicle_type = ?`;
      params.push(resolvedType);
    }

    if (resolvedFuel && resolvedFuel !== 'All') {
      query += ` AND v.fuel_type = ?`;
      params.push(resolvedFuel);
    }

    if (fleet_id && fleet_id !== 'All') {
      query += ` AND v.fleet_id = ?`;
      params.push(fleet_id);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      query += ` AND (
        v.vehicle_number LIKE ? OR 
        v.make LIKE ? OR 
        v.model LIKE ? OR 
        v.variant LIKE ? OR
        v.vehicle_type LIKE ? OR
        v.vehicle_category LIKE ? OR
        v.fuel_type LIKE ? OR
        v.status LIKE ? OR
        v.chassis_number LIKE ? OR 
        v.engine_number LIKE ? OR 
        v.owner_name LIKE ? OR
        v.owner_phone LIKE ? OR
        d.name LIKE ? OR
        d.phone LIKE ?
      )`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s, s, s, s);
    }

    query += ` ORDER BY v.created_at DESC`;

    const vehicles = await db.all(query, params);
    res.json(vehicles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET 360° Vehicle Profile by ID (All 15 sub-entities + unified chronological history)
router.get(['/:id', '/:id/360'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const vehicle = await db.get(`
      SELECT 
        v.*,
        v.colour as color,
        d.name as driver_name,
        d.phone as driver_phone,
        d.license_number as driver_license,
        d.rating as driver_rating,
        f.name as fleet_name,
        f.color_code as fleet_color
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      LEFT JOIN fleets f ON v.fleet_id = f.id
      WHERE v.id = ?
    `, [id]);

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // Sub-records
    const rto = await db.get(`SELECT * FROM rto_records WHERE vehicle_id = ?`, [id]);
    const insurance = await db.get(`SELECT * FROM insurance_records WHERE vehicle_id = ? ORDER BY policy_expiry_date DESC LIMIT 1`, [id]);
    const puc = await db.get(`SELECT * FROM puc_records WHERE vehicle_id = ? ORDER BY expiry_date DESC LIMIT 1`, [id]);
    const fitness = await db.get(`SELECT * FROM fitness_records WHERE vehicle_id = ? ORDER BY expiry_date DESC LIMIT 1`, [id]);
    const permit = await db.get(`SELECT * FROM permits WHERE vehicle_id = ? ORDER BY expiry_date DESC LIMIT 1`, [id]);
    const roadTax = await db.get(`SELECT * FROM road_tax_records WHERE vehicle_id = ? ORDER BY next_due_date DESC LIMIT 1`, [id]);
    const fastag = await db.get(`SELECT * FROM fastag_records WHERE vehicle_id = ?`, [id]);
    const fastagTxns = await db.all(`SELECT * FROM fastag_transactions WHERE vehicle_id = ? ORDER BY transaction_date DESC LIMIT 20`, [id]);
    const challans = await db.all(`SELECT * FROM challans WHERE vehicle_id = ? ORDER BY date DESC`, [id]);
    const serviceHistory = await db.all(`SELECT * FROM service_records WHERE vehicle_id = ? ORDER BY service_date DESC`, [id]);
    const fuelLogs = await db.all(`SELECT * FROM fuel_records WHERE vehicle_id = ? ORDER BY date DESC LIMIT 25`, [id]);
    const bookings = await db.all(`SELECT * FROM bookings WHERE vehicle_id = ? ORDER BY start_date DESC`, [id]);
    const tyres = await db.all(`SELECT * FROM tyre_records WHERE vehicle_id = ?`, [id]);
    const batteries = await db.all(`SELECT * FROM battery_records WHERE vehicle_id = ?`, [id]);
    const expenses = await db.all(`SELECT * FROM expenses WHERE vehicle_id = ? ORDER BY expense_date DESC`, [id]);
    const documents = await db.all(`SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY created_at DESC`, [id]);
    const notifications = await db.all(`SELECT * FROM notifications WHERE vehicle_id = ? ORDER BY created_at DESC`, [id]);

    // Build Unified Chronological History Timeline
    const timeline: any[] = [];

    if (vehicle.registration_date) {
      timeline.push({
        type: 'REGISTRATION',
        title: 'Vehicle Registered at RTO',
        date: vehicle.registration_date,
        description: `Registered at ${vehicle.rto_office} (${vehicle.rto_code}) by ${vehicle.owner_name}`,
        badge: 'RC Issue'
      });
    }

    if (serviceHistory) {
      for (const s of serviceHistory) {
        timeline.push({
          type: 'SERVICE',
          title: `${s.service_type} at ${s.workshop_name}`,
          date: s.service_date,
          description: `Odometer: ${s.current_odometer.toLocaleString()} km. Cost: ₹${s.total_cost.toLocaleString()}. Parts: ${s.parts_changed || 'Standard checks'}`,
          badge: 'Maintenance'
        });
      }
    }

    if (fuelLogs) {
      for (const f of fuelLogs.slice(0, 5)) {
        timeline.push({
          type: 'FUEL',
          title: `Refueled ${f.quantity_litres}L ${f.fuel_type}`,
          date: f.date,
          description: `${f.fuel_station}. Total: ₹${f.total_amount.toLocaleString()} (Efficiency: ${f.km_per_litre ? f.km_per_litre + ' km/l' : 'N/A'})`,
          badge: 'Fuel'
        });
      }
    }

    if (bookings) {
      for (const b of bookings) {
        timeline.push({
          type: 'BOOKING',
          title: `Trip: ${b.pickup_location} → ${b.drop_location}`,
          date: b.start_date,
          description: `Customer: ${b.customer_name}. Distance: ${b.distance_km} km. Fare: ₹${b.booking_amount.toLocaleString()} (${b.booking_status})`,
          badge: b.booking_status
        });
      }
    }

    if (challans) {
      for (const c of challans) {
        timeline.push({
          type: 'CHALLAN',
          title: `Traffic Offence: ${c.offence}`,
          date: c.date,
          description: `Location: ${c.location}. Fine: ₹${c.amount.toLocaleString()} (${c.payment_status})`,
          badge: c.payment_status
        });
      }
    }

    // Sort timeline descending by date
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      vehicle,
      rto,
      insurance,
      puc,
      fitness,
      permit,
      roadTax,
      fastag,
      fastagTxns,
      challans,
      serviceHistory,
      fuelLogs,
      bookings,
      tyres,
      batteries,
      expenses,
      documents,
      notifications,
      timeline
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Register a New Vehicle (all fields manually entered, zero fake data)
router.post('/', requireRole(['Super Admin', 'Fleet Manager']), handleOptionalVehicleUpload, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const vehicleId = `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_number || !data.vehicle_type || !data.make || !data.model) {
      res.status(400).json({ error: 'Vehicle number, type, make, and model are required' });
      return;
    }

    const regNum = data.vehicle_number.toUpperCase().trim();

    // Check duplicate vehicle number
    const existing = await db.get('SELECT id FROM vehicles WHERE vehicle_number = ?', [regNum]);
    if (existing) {
      res.status(409).json({ error: `Vehicle number ${regNum} is already registered.` });
      return;
    }

    let vehicleImageUrl = (data.profile_image_url || data.photo_url || data.imageUrl || data.profileImageUrl || '').trim() || null;

    if (req.file) {
      vehicleImageUrl = `/uploads/vehicles/${req.file.filename}`;
      logUploadDebugInfo({
        vehicleId,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        sizeBytes: req.file.size,
        storedFilename: req.file.filename,
        storedPath: req.file.path,
        publicUrl: vehicleImageUrl
      });
    }

    let driverId = data.driver_id || null;
    if (!driverId && data.driver_name && data.driver_name.trim()) {
      const dName = data.driver_name.trim();
      const existingDriver = (data.driver_phone ? await db.get('SELECT id FROM drivers WHERE phone = ?', [data.driver_phone.trim()]) : null)
        || (data.driver_license ? await db.get('SELECT id FROM drivers WHERE license_number = ?', [data.driver_license.trim()]) : null)
        || await db.get('SELECT id FROM drivers WHERE name = ? COLLATE NOCASE', [dName]);
      if (existingDriver) {
        driverId = existingDriver.id;
        await db.run('UPDATE drivers SET name = ?, phone = COALESCE(?, phone), license_number = COALESCE(?, license_number), assigned_vehicle_id = ? WHERE id = ?', [
          dName,
          data.driver_phone?.trim() || null,
          data.driver_license?.trim() || null,
          vehicleId,
          driverId
        ]);
      } else {
        driverId = `drv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await db.run(`
          INSERT INTO drivers (
            id, name, phone, license_number, license_type, license_issue_date, license_expiry_date,
            assigned_vehicle_id, status
          ) VALUES (?, ?, ?, ?, ?, date('now'), date('now', '+5 years'), ?, 'Active')
        `, [
          driverId,
          dName,
          data.driver_phone?.trim() || '+91 90000 00000',
          data.driver_license?.trim() || `DL-${Date.now()}`,
          data.vehicle_type === 'Truck' || data.vehicle_type === 'Bus' ? 'Heavy Commercial' : 'LMV',
          vehicleId
        ]);
      }
    } else if (driverId) {
      await db.run('UPDATE drivers SET assigned_vehicle_id = ? WHERE id = ?', [vehicleId, driverId]);
    }

    await db.run(`
      INSERT INTO vehicles (
        id, vehicle_number, vehicle_type, vehicle_category, make, model, variant,
        manufacturing_year, registration_date, chassis_number, engine_number, fuel_type,
        colour, seating_capacity, load_capacity_kg, gross_vehicle_weight_kg, unladen_weight_kg,
        axles_count, wheel_base_mm, owner_name, owner_phone, owner_address,
        rto_office, rto_code, state, district, usage_type, status,
        purchase_date, purchase_price, current_value, odometer_reading,
        fuel_tank_capacity, current_fuel_level, fuel_efficiency,
        battery_capacity, charging_type, electric_range_km,
        driver_id, fleet_id, insurance_provider, policy_number, fastag_id,
        route_name, goods_type, photo_url, profile_image_url, back_photo_url, side_photo_url, document_photo_url, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      vehicleId,
      regNum,
      data.vehicle_type,
      data.vehicle_category || 'Commercial',
      data.make.trim(),
      data.model.trim(),
      data.variant?.trim() || null,
      data.manufacturing_year ? parseInt(String(data.manufacturing_year), 10) : null,
      data.registration_date || null,
      data.chassis_number?.trim() || null,
      data.engine_number?.trim() || null,
      data.fuel_type || 'Diesel',
      data.colour?.trim() || data.color?.trim() || null,
      data.seating_capacity ? parseInt(String(data.seating_capacity), 10) : null,
      data.load_capacity_kg ? parseFloat(String(data.load_capacity_kg)) : 0,
      data.gross_vehicle_weight_kg ? parseFloat(String(data.gross_vehicle_weight_kg)) : 0,
      data.unladen_weight_kg ? parseFloat(String(data.unladen_weight_kg)) : 0,
      data.axles_count ? parseInt(String(data.axles_count), 10) : 2,
      data.wheel_base_mm ? parseInt(String(data.wheel_base_mm), 10) : null,
      data.owner_name?.trim() || null,
      data.owner_phone?.trim() || null,
      data.owner_address?.trim() || null,
      data.rto_office?.trim() || null,
      data.rto_code?.trim() || null,
      data.state?.trim() || null,
      data.district?.trim() || null,
      data.usage_type || 'Commercial',
      data.status || 'Available',
      data.purchase_date || null,
      data.purchase_price ? parseFloat(String(data.purchase_price)) : 0,
      data.current_value ? parseFloat(String(data.current_value)) : 0,
      data.odometer_reading ? parseFloat(String(data.odometer_reading)) : 0,
      data.fuel_tank_capacity ? parseFloat(String(data.fuel_tank_capacity)) : null,
      data.current_fuel_level ? parseFloat(String(data.current_fuel_level)) : null,
      data.fuel_efficiency ? parseFloat(String(data.fuel_efficiency)) : null,
      data.battery_capacity ? parseFloat(String(data.battery_capacity)) : null,
      data.charging_type?.trim() || null,
      data.electric_range_km ? parseFloat(String(data.electric_range_km)) : null,
      driverId,
      data.fleet_id || null,
      data.insurance_provider?.trim() || null,
      data.policy_number?.trim() || null,
      data.fastag_id?.trim() || null,
      data.route_name?.trim() || null,
      data.goods_type?.trim() || null,
      vehicleImageUrl,
      vehicleImageUrl,
      data.back_photo_url || null,
      data.side_photo_url || null,
      data.document_photo_url || null,
      data.notes?.trim() || null
    ]);

    // Calculate RC validity if registration date is provided
    let rcValidityStr = data.rc_expiry_date || data.registration_validity || null;
    if (!rcValidityStr && data.registration_date) {
      const rd = new Date(data.registration_date);
      if (!isNaN(rd.getTime())) {
        rd.setFullYear(rd.getFullYear() + 15);
        rcValidityStr = rd.toISOString().split('T')[0];
      }
    }

    // Create linked RTO record
    await db.run(`
      INSERT INTO rto_records (
        id, vehicle_id, rc_number, registration_date, registration_validity,
        rto_office, rto_code, owner_name, owner_phone, owner_address,
        vehicle_class, fuel_type, chassis_number, engine_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `, [
      `rto-${vehicleId}`,
      vehicleId,
      regNum,
      data.registration_date || null,
      rcValidityStr,
      data.rto_office?.trim() || null,
      data.rto_code?.trim() || null,
      data.owner_name?.trim() || null,
      data.owner_phone?.trim() || null,
      data.owner_address?.trim() || null,
      data.vehicle_type,
      data.fuel_type || 'Diesel',
      data.chassis_number?.trim() || null,
      data.engine_number?.trim() || null
    ]);

    // Create Insurance if entered by user
    if (data.insurance_provider?.trim() || data.policy_number?.trim() || data.insurance_expiry || data.insurance_expiry_date) {
      const insExpiry = data.insurance_expiry || data.insurance_expiry_date || null;
      const isExpired = insExpiry && new Date(insExpiry) < new Date();
      await db.run(`
        INSERT INTO insurance_records (
          id, vehicle_id, insurance_company, policy_number, insurance_type,
          policy_start_date, policy_expiry_date, premium_amount, insured_declared_value, status
        ) VALUES (?, ?, ?, ?, 'Comprehensive', ?, ?, 0, 0, ?)
      `, [
        `ins-${vehicleId}`,
        vehicleId,
        data.insurance_provider?.trim() || 'Insurance Provider',
        data.policy_number?.trim() || `POL-${regNum}`,
        data.insurance_start_date || new Date().toISOString().split('T')[0],
        insExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isExpired ? 'Expired' : 'Active'
      ]);
    }

    // Create PUC if entered by user
    if (data.puc_number?.trim() || data.puc_expiry || data.puc_expiry_date) {
      const pucExp = data.puc_expiry || data.puc_expiry_date || null;
      const isExpired = pucExp && new Date(pucExp) < new Date();
      await db.run(`
        INSERT INTO puc_records (
          id, vehicle_id, certificate_number, issue_date, expiry_date,
          testing_center, fuel_type, status
        ) VALUES (?, ?, ?, ?, ?, 'Authorized Testing Center', ?, ?)
      `, [
        `puc-${vehicleId}`,
        vehicleId,
        data.puc_number?.trim() || `PUC-${regNum}`,
        data.puc_issue_date || new Date().toISOString().split('T')[0],
        pucExp || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data.fuel_type || 'Diesel',
        isExpired ? 'Expired' : 'Valid'
      ]);
    }

    // Create Fitness Certificate if entered by user
    if (data.fc_number?.trim() || data.fitness_expiry || data.fitness_expiry_date) {
      const fitExp = data.fitness_expiry || data.fitness_expiry_date || null;
      const isExpired = fitExp && new Date(fitExp) < new Date();
      await db.run(`
        INSERT INTO fitness_records (
          id, vehicle_id, certificate_number, issue_date, expiry_date,
          inspection_date, testing_center, vehicle_class, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'RTO Inspection Center', ?, ?)
      `, [
        `fc-${vehicleId}`,
        vehicleId,
        data.fc_number?.trim() || `FC-${regNum}`,
        data.fc_issue_date || new Date().toISOString().split('T')[0],
        fitExp || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data.fc_issue_date || new Date().toISOString().split('T')[0],
        data.vehicle_type || 'Commercial',
        isExpired ? 'Expired' : 'Valid'
      ]);
    }

    // Create Permit if entered by user
    if (data.permit_number?.trim() || data.permit_expiry || data.permit_expiry_date) {
      const pmtExp = data.permit_expiry || data.permit_expiry_date || null;
      const isExpired = pmtExp && new Date(pmtExp) < new Date();
      await db.run(`
        INSERT INTO permits (
          id, vehicle_id, permit_number, permit_type, issue_date, expiry_date,
          issuing_authority, permit_area, status
        ) VALUES (?, ?, ?, 'National / State Permit', ?, ?, 'Transport Authority', 'All India', ?)
      `, [
        `pmt-${vehicleId}`,
        vehicleId,
        data.permit_number?.trim() || `PMT-${regNum}`,
        data.permit_issue_date || new Date().toISOString().split('T')[0],
        pmtExp || new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isExpired ? 'Expired' : 'Active'
      ]);
    }

    // Create FASTag record if entered by user
    if (data.fastag_id?.trim()) {
      await db.run(`
        INSERT INTO fastag_records (
          id, vehicle_id, fastag_id, issuer_bank, wallet_balance, minimum_balance,
          linked_mobile_number, status, last_recharge_date, last_recharge_amount
        ) VALUES (?, ?, ?, 'FASTag Bank', ?, 500, ?, 'Active', null, 0)
      `, [
        `ft-${vehicleId}`,
        vehicleId,
        data.fastag_id.trim(),
        data.fastag_balance !== undefined && data.fastag_balance !== '' ? parseFloat(String(data.fastag_balance)) : 0,
        data.owner_phone?.trim() || ''
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'CREATE',
      entity: 'Vehicle',
      entityId: vehicleId,
      newValues: { vehicle_number: regNum, type: data.vehicle_type, make: data.make, model: data.model },
      ipAddress: req.ip
    });

    // Run notification evaluator
    await NotificationEngine.runEvaluation();

    res.status(201).json({ message: 'Vehicle registered successfully', id: vehicleId, profile_image_url: vehicleImageUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Vehicle (supports JSON & multipart/form-data)
router.put('/:id', requireRole(['Super Admin', 'Fleet Manager']), handleOptionalVehicleUpload, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    const oldVehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!oldVehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    let updatedImage = data.profile_image_url !== undefined 
      ? (data.profile_image_url || null)
      : data.photo_url !== undefined
      ? (data.photo_url || null)
      : data.imageUrl !== undefined
      ? (data.imageUrl || null)
      : data.profileImageUrl !== undefined
      ? (data.profileImageUrl || null)
      : oldVehicle.profile_image_url || oldVehicle.photo_url;

    if (req.file) {
      updatedImage = `/uploads/vehicles/${req.file.filename}`;
      logUploadDebugInfo({
        vehicleId: String(id),
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        sizeBytes: req.file.size,
        storedFilename: req.file.filename,
        storedPath: req.file.path,
        publicUrl: updatedImage
      });
    }

    // Clean up old file if replaced
    const oldImg = oldVehicle.profile_image_url || oldVehicle.photo_url;
    if (oldImg && updatedImage && oldImg !== updatedImage) {
      deleteUploadedFile(oldImg);
    }

    let updatedDriverId = data.driver_id !== undefined ? data.driver_id : oldVehicle.driver_id;
    if (data.driver_name && data.driver_name.trim()) {
      const dName = data.driver_name.trim();
      const existingDriver = (oldVehicle.driver_id ? await db.get('SELECT id FROM drivers WHERE id = ?', [oldVehicle.driver_id]) : null)
        || (data.driver_phone ? await db.get('SELECT id FROM drivers WHERE phone = ?', [data.driver_phone.trim()]) : null)
        || (data.driver_license ? await db.get('SELECT id FROM drivers WHERE license_number = ?', [data.driver_license.trim()]) : null)
        || await db.get('SELECT id FROM drivers WHERE name = ? COLLATE NOCASE', [dName]);
      if (existingDriver) {
        updatedDriverId = existingDriver.id;
        await db.run('UPDATE drivers SET name = ?, phone = COALESCE(?, phone), license_number = COALESCE(?, license_number), assigned_vehicle_id = ? WHERE id = ?', [
          dName,
          data.driver_phone?.trim() || null,
          data.driver_license?.trim() || null,
          id,
          updatedDriverId
        ]);
      } else {
        updatedDriverId = `drv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await db.run(`
          INSERT INTO drivers (
            id, name, phone, license_number, license_type, license_issue_date, license_expiry_date,
            assigned_vehicle_id, status
          ) VALUES (?, ?, ?, ?, ?, date('now'), date('now', '+5 years'), ?, 'Active')
        `, [
          updatedDriverId,
          dName,
          data.driver_phone?.trim() || '+91 90000 00000',
          data.driver_license?.trim() || `DL-${Date.now()}`,
          (data.vehicle_type || oldVehicle.vehicle_type) === 'Truck' || (data.vehicle_type || oldVehicle.vehicle_type) === 'Bus' ? 'Heavy Commercial' : 'LMV',
          id
        ]);
      }
    }

    await db.run(`
      UPDATE vehicles SET
        vehicle_type = ?, vehicle_category = ?, make = ?, model = ?, variant = ?,
        manufacturing_year = ?, fuel_type = ?, colour = ?, seating_capacity = ?,
        load_capacity_kg = ?, gross_vehicle_weight_kg = ?, unladen_weight_kg = ?,
        axles_count = ?, wheel_base_mm = ?, owner_name = ?, owner_phone = ?,
        owner_address = ?, rto_office = ?, rto_code = ?, state = ?, district = ?,
        usage_type = ?, status = ?, purchase_price = ?, current_value = ?,
        odometer_reading = ?, fuel_tank_capacity = ?, current_fuel_level = ?, fuel_efficiency = ?,
        battery_capacity = ?, charging_type = ?, electric_range_km = ?,
        driver_id = ?, fleet_id = ?, insurance_provider = ?,
        policy_number = ?, fastag_id = ?, route_name = ?, goods_type = ?,
        photo_url = ?, profile_image_url = ?, back_photo_url = ?, side_photo_url = ?, document_photo_url = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.vehicle_type || oldVehicle.vehicle_type,
      data.vehicle_category || oldVehicle.vehicle_category,
      data.make || oldVehicle.make,
      data.model || oldVehicle.model,
      data.variant || oldVehicle.variant,
      data.manufacturing_year || oldVehicle.manufacturing_year,
      data.fuel_type || oldVehicle.fuel_type,
      data.color || data.colour || oldVehicle.colour,
      data.seating_capacity || oldVehicle.seating_capacity,
      data.load_capacity_kg || oldVehicle.load_capacity_kg,
      data.gross_vehicle_weight_kg || oldVehicle.gross_vehicle_weight_kg,
      data.unladen_weight_kg || oldVehicle.unladen_weight_kg,
      data.axles_count || oldVehicle.axles_count,
      data.wheel_base_mm || oldVehicle.wheel_base_mm,
      data.owner_name || oldVehicle.owner_name,
      data.owner_phone || oldVehicle.owner_phone,
      data.owner_address || oldVehicle.owner_address,
      data.rto_office || oldVehicle.rto_office,
      data.rto_code || oldVehicle.rto_code,
      data.state || oldVehicle.state,
      data.district || oldVehicle.district,
      data.usage_type || oldVehicle.usage_type,
      data.status || oldVehicle.status,
      data.purchase_price || oldVehicle.purchase_price,
      data.current_value || oldVehicle.current_value,
      data.odometer_reading || oldVehicle.odometer_reading,
      data.fuel_tank_capacity !== undefined ? data.fuel_tank_capacity : oldVehicle.fuel_tank_capacity,
      data.current_fuel_level !== undefined ? data.current_fuel_level : oldVehicle.current_fuel_level,
      data.fuel_efficiency !== undefined ? data.fuel_efficiency : oldVehicle.fuel_efficiency,
      data.battery_capacity !== undefined ? data.battery_capacity : oldVehicle.battery_capacity,
      data.charging_type !== undefined ? data.charging_type : oldVehicle.charging_type,
      data.electric_range_km !== undefined ? data.electric_range_km : oldVehicle.electric_range_km,
      updatedDriverId,
      data.fleet_id || oldVehicle.fleet_id,
      data.insurance_provider || oldVehicle.insurance_provider,
      data.policy_number || oldVehicle.policy_number,
      data.fastag_id || oldVehicle.fastag_id,
      data.route_name || oldVehicle.route_name,
      data.goods_type || oldVehicle.goods_type,
      updatedImage,
      updatedImage,
      data.back_photo_url !== undefined ? data.back_photo_url : oldVehicle.back_photo_url,
      data.side_photo_url !== undefined ? data.side_photo_url : oldVehicle.side_photo_url,
      data.document_photo_url !== undefined ? data.document_photo_url : oldVehicle.document_photo_url,
      data.notes !== undefined ? data.notes : oldVehicle.notes,
      id
    ]);

    const updatedVehicle = await db.get(`
      SELECT 
        v.*,
        v.colour as color,
        d.name as driver_name,
        d.phone as driver_phone
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      WHERE v.id = ?
    `, [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'UPDATE',
      entity: 'Vehicle',
      entityId: String(id),
      oldValues: oldVehicle,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Vehicle updated successfully', vehicle: updatedVehicle, profile_image_url: updatedImage, photo_url: updatedImage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/vehicles/:id/image - Dedicated endpoint to update/remove vehicle profile image
router.patch('/:id/image', requireRole(['Super Admin', 'Fleet Manager']), handleOptionalVehicleUpload, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { profile_image_url, photo_url, imageUrl, profileImageUrl } = req.body;
    let newImg = req.file
      ? `/uploads/vehicles/${req.file.filename}`
      : (profile_image_url !== undefined 
      ? profile_image_url 
      : photo_url !== undefined 
      ? photo_url 
      : imageUrl !== undefined 
      ? imageUrl 
      : profileImageUrl !== undefined 
      ? profileImageUrl 
      : null) || null;

    if (req.file) {
      logUploadDebugInfo({
        vehicleId: String(id),
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        sizeBytes: req.file.size,
        storedFilename: req.file.filename,
        storedPath: req.file.path,
        publicUrl: newImg
      });
    }

    const oldVehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!oldVehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // Clean up old file if changing or deleting
    const oldImg = oldVehicle.profile_image_url || oldVehicle.photo_url;
    if (oldImg && oldImg !== newImg) {
      deleteUploadedFile(oldImg);
    }

    await db.run('UPDATE vehicles SET profile_image_url = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newImg, newImg, id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'IMAGE_UPDATE',
      entity: 'Vehicle',
      entityId: String(id),
      oldValues: { profile_image_url: oldImg },
      newValues: { profile_image_url: newImg },
      ipAddress: req.ip
    });

    res.json({
      message: newImg ? 'Vehicle profile image updated successfully' : 'Vehicle profile image removed',
      profile_image_url: newImg,
      photo_url: newImg,
      imageUrl: newImg,
      profileImageUrl: newImg
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Vehicle Status
router.patch('/:id/status', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const old = await db.get('SELECT status, vehicle_number FROM vehicles WHERE id = ?', [id]);
    if (!old) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    await db.run('UPDATE vehicles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'STATUS_CHANGE',
      entity: 'Vehicle',
      entityId: String(id),
      oldValues: { status: old.status },
      newValues: { status },
      ipAddress: req.ip
    });

    res.json({ message: `Vehicle ${old.vehicle_number} status updated to ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Vehicle
router.delete('/:id', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // Clean up all stored vehicle photos
    const photosToDelete = [
      vehicle.profile_image_url,
      vehicle.photo_url,
      vehicle.back_photo_url,
      vehicle.side_photo_url,
      vehicle.document_photo_url
    ];
    for (const p of photosToDelete) {
      if (p) deleteUploadedFile(p);
    }

    // Clean up all related records in a transaction to guarantee FK safety and zero orphaned rows
    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('UPDATE drivers SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = ?', [id]);
      await db.run('UPDATE driver_location_status SET vehicle_id = NULL, vehicle_number = NULL WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM rto_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM insurance_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM puc_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM fitness_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM permits WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM road_tax_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM fastag_transactions WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM fastag_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM challans WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM service_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM fuel_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM bookings WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM tyre_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM battery_records WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM expenses WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM payments WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM vehicle_documents WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM notifications WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM vehicle_threshold_settings WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM trip_locations WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM driver_locations WHERE vehicle_id = ?', [id]);
      await db.run('DELETE FROM vehicles WHERE id = ?', [id]);
      await db.run('COMMIT');
    } catch (txErr) {
      await db.run('ROLLBACK');
      throw txErr;
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_VEHICLE',
      entity: 'Vehicle',
      entityId: String(id),
      oldValues: vehicle,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: `Vehicle ${vehicle.vehicle_number} removed from fleet.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
