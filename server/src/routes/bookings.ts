import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);

// Helper for phone validation
const isValidPhone = (phone?: string): boolean => {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
};

// Helper for converting date + 12hr/24hr time to comparable Date object
export const parseBookingDateTime = (dateStr: string, timeStr?: string): Date => {
  let hours = 0;
  let minutes = 0;
  if (timeStr) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const period = (match[3] || '').toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }
  }
  const [y, m, d] = (dateStr || '').split('-').map(n => parseInt(n, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return new Date();
  }
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
};

// Helper to get current 12-hour formatted time (e.g. "09:30 AM")
export const getCurrent12HourTime = (): string => {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hStr = hours < 10 ? `0${hours}` : `${hours}`;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hStr}:${mStr} ${period}`;
};

// Helper to calculate human readable trip duration
export const calculateTripDuration = (startDate?: string, startTime?: string, endDate?: string, endTime?: string): string => {
  if (!startDate || !endDate) return '';
  const start = parseBookingDateTime(startDate, startTime);
  const end = parseBookingDateTime(endDate, endTime);
  const diffMs = end.getTime() - start.getTime();
  if (isNaN(diffMs) || diffMs <= 0) return '0 mins';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);

  return parts.join(' ');
};

// GET /api/bookings/summary - Real DB calculated metrics (Zero fake data)
router.get('/summary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    let driverFilter = '';
    const params: any[] = [];

    if (userRole === 'Driver') {
      driverFilter = ` AND (b.driver_id = ? OR d.email = ? OR d.id = ? OR (d.phone IS NOT NULL AND d.phone = ?))`;
      params.push(req.user?.id || '', req.user?.email || '', req.user?.id || '', req.user?.phone || '');
    }

    const revenueResult = await db.get(`
      SELECT 
        COALESCE(SUM(b.booking_amount), 0) as totalRevenue,
        COALESCE(SUM(b.advance_amount), 0) as totalAdvance,
        COALESCE(SUM(b.remaining_amount), 0) as totalRemaining
      FROM bookings b
      LEFT JOIN drivers d ON b.driver_id = d.id
      WHERE LOWER(b.booking_status) != 'cancelled' ${driverFilter}
    `, params);

    const countsResult = await db.get(`
      SELECT 
        COUNT(*) as totalTrips,
        SUM(CASE WHEN LOWER(b.booking_status) = 'confirmed' THEN 1 ELSE 0 END) as confirmedTrips,
        SUM(CASE WHEN LOWER(b.booking_status) = 'started' THEN 1 ELSE 0 END) as startedTrips,
        SUM(CASE WHEN LOWER(b.booking_status) = 'completed' THEN 1 ELSE 0 END) as completedTrips,
        SUM(CASE WHEN LOWER(b.booking_status) = 'cancelled' THEN 1 ELSE 0 END) as cancelledTrips,
        SUM(CASE WHEN b.start_date <= date('now') AND b.end_date >= date('now') AND LOWER(b.booking_status) != 'cancelled' THEN 1 ELSE 0 END) as todayTrips,
        SUM(CASE WHEN b.start_date > date('now') AND LOWER(b.booking_status) != 'cancelled' THEN 1 ELSE 0 END) as upcomingTrips,
        SUM(CASE WHEN LOWER(b.booking_status) = 'started' THEN 1 ELSE 0 END) as activeTrips
      FROM bookings b
      LEFT JOIN drivers d ON b.driver_id = d.id
      WHERE 1=1 ${driverFilter}
    `, params);

    res.json({
      totalRevenue: Number(revenueResult?.totalRevenue || 0),
      totalAdvance: Number(revenueResult?.totalAdvance || 0),
      totalRemaining: Number(revenueResult?.totalRemaining || 0),
      totalTrips: Number(countsResult?.totalTrips || 0),
      confirmedTrips: Number(countsResult?.confirmedTrips || 0),
      startedTrips: Number(countsResult?.startedTrips || 0),
      completedTrips: Number(countsResult?.completedTrips || 0),
      cancelledTrips: Number(countsResult?.cancelledTrips || 0),
      todayTrips: Number(countsResult?.todayTrips || 0),
      upcomingTrips: Number(countsResult?.upcomingTrips || 0),
      activeTrips: Number(countsResult?.activeTrips || 0)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET all bookings with filters & search
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, search, vehicle_id, start_date, end_date } = req.query;
    const userRole = req.user?.role;

    let query = `
      SELECT 
        b.*,
        COALESCE(b.vehicle_number, v.vehicle_number) as vehicle_number,
        COALESCE(b.vehicle_type, v.vehicle_type) as vehicle_type,
        COALESCE(b.vehicle_category, v.vehicle_category, 'Commercial') as vehicle_category,
        v.make as vehicle_make,
        v.model as vehicle_model,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_image_url,
        COALESCE(b.driver_name, d.name) as driver_name,
        COALESCE(b.driver_phone, d.phone) as driver_phone,
        COALESCE(b.driver_availability, d.status, 'Available') as driver_availability,
        d.license_number as driver_license,
        c.company_name
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // If Driver role, only show assigned trips
    if (userRole === 'Driver') {
      query += ` AND (b.driver_id = ? OR d.email = ? OR d.id = ? OR (d.phone IS NOT NULL AND d.phone = ?))`;
      params.push(req.user?.id || '', req.user?.email || '', req.user?.id || '', req.user?.phone || '');
    }

    if (status && status !== 'All') {
      query += ` AND LOWER(b.booking_status) = LOWER(?)`;
      params.push(status);
    }
    if (vehicle_id) {
      query += ` AND b.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    if (start_date) {
      query += ` AND b.end_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND b.start_date <= ?`;
      params.push(end_date);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (
        b.booking_number LIKE ? OR
        b.id LIKE ? OR
        COALESCE(b.vehicle_number, v.vehicle_number) LIKE ? OR
        COALESCE(b.driver_name, d.name) LIKE ? OR
        COALESCE(b.driver_phone, d.phone) LIKE ? OR
        b.customer_name LIKE ? OR
        b.customer_mobile LIKE ? OR
        COALESCE(b.customer_address, '') LIKE ? OR
        b.pickup_location LIKE ? OR
        b.drop_location LIKE ? OR
        b.trip_type LIKE ? OR
        COALESCE(b.special_instructions, '') LIKE ? OR
        COALESCE(b.notes, '') LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term, term, term, term, term, term, term);
    }

    query += ` ORDER BY b.created_at DESC, b.start_date DESC`;

    const bookings = await db.all(query, params);
    res.json(bookings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single booking details
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        b.*,
        COALESCE(b.vehicle_number, v.vehicle_number) as vehicle_number,
        COALESCE(b.vehicle_type, v.vehicle_type) as vehicle_type,
        COALESCE(b.vehicle_category, v.vehicle_category, 'Commercial') as vehicle_category,
        v.make as vehicle_make,
        v.model as vehicle_model,
        v.colour as vehicle_colour,
        v.fuel_type as vehicle_fuel_type,
        v.owner_name as vehicle_owner_name,
        v.owner_phone as vehicle_owner_phone,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_image_url,
        COALESCE(b.driver_name, d.name) as driver_name,
        COALESCE(b.driver_phone, d.phone) as driver_phone,
        COALESCE(b.driver_availability, d.status, 'Available') as driver_availability,
        d.license_number as driver_license,
        d.license_type as driver_license_type,
        c.company_name,
        c.email as customer_email,
        COALESCE(b.customer_address, c.address) as customer_address
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ? OR b.booking_number = ?
    `;

    const booking = await db.get(query, [id, id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    res.json(booking);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Booking with DOUBLE-BOOKING CONFLICT PREVENTION & VALIDATIONS
router.post('/', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    // User can supply a custom booking ID or generate automatically
    let bookingNumber = data.booking_number?.trim();
    if (!bookingNumber) {
      bookingNumber = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Check if booking_number is unique
    const existingWithNum = await db.get('SELECT id FROM bookings WHERE booking_number = ?', [bookingNumber]);
    if (existingWithNum) {
      res.status(400).json({ error: `Booking ID "${bookingNumber}" already exists. Please choose a unique Booking ID.` });
      return;
    }

    // Required fields check
    if (!data.vehicle_id || !data.customer_name || !data.customer_mobile || !data.pickup_location || !data.drop_location || !data.start_date || !data.end_date) {
      res.status(400).json({ error: 'Vehicle, customer name, customer mobile, pickup & drop locations, and start & end dates are required.' });
      return;
    }

    // Phone format validation
    if (!isValidPhone(data.customer_mobile)) {
      res.status(400).json({ error: 'Invalid Customer Mobile Number. Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (data.driver_phone && !isValidPhone(data.driver_phone)) {
      res.status(400).json({ error: 'Invalid Driver Mobile Number. Please enter a valid 10-digit mobile number.' });
      return;
    }

    // Date & Time validation
    const startDateTime = parseBookingDateTime(data.start_date, data.start_time);
    const endDateTime = parseBookingDateTime(data.end_date, data.end_time);

    if (endDateTime.getTime() < startDateTime.getTime()) {
      res.status(400).json({ error: 'End date and time cannot be earlier than Start date and time.' });
      return;
    }

    // Financial calculations and validations
    const bookingAmt = parseFloat(data.booking_amount) || 0;
    const advAmt = parseFloat(data.advance_amount) || 0;
    const distanceKm = parseFloat(data.distance_km) || 0;

    if (bookingAmt < 0) {
      res.status(400).json({ error: 'Total Fare cannot be a negative amount.' });
      return;
    }
    if (advAmt < 0) {
      res.status(400).json({ error: 'Advance Amount cannot be a negative amount.' });
      return;
    }
    if (advAmt > bookingAmt && bookingAmt > 0) {
      res.status(400).json({ error: `Advance Amount (₹${advAmt.toLocaleString()}) cannot be greater than Total Fare (₹${bookingAmt.toLocaleString()}).` });
      return;
    }
    if (distanceKm < 0) {
      res.status(400).json({ error: 'Estimated Distance cannot be negative.' });
      return;
    }

    const remAmt = Math.max(0, bookingAmt - advAmt);
    let payStat = 'Pending';
    if (advAmt >= bookingAmt && bookingAmt > 0) payStat = 'Paid';
    else if (advAmt > 0) payStat = 'Partial';

    // 1. Double-booking conflict validation for Vehicle
    const existingVehicleBookings = await db.all(`
      SELECT b.id, b.booking_number, b.start_date, b.start_time, b.end_date, b.end_time, v.vehicle_number 
      FROM bookings b
      JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.vehicle_id = ? 
        AND b.booking_status IN ('Confirmed', 'Started')
        AND (b.start_date <= ? AND b.end_date >= ?)
    `, [data.vehicle_id, data.end_date, data.start_date]);

    for (const vb of existingVehicleBookings) {
      const existingStart = parseBookingDateTime(vb.start_date, vb.start_time);
      const existingEnd = parseBookingDateTime(vb.end_date, vb.end_time);

      if (startDateTime.getTime() <= existingEnd.getTime() && endDateTime.getTime() >= existingStart.getTime()) {
        res.status(409).json({
          error: `Schedule Conflict: Vehicle ${vb.vehicle_number} is already booked on ${vb.booking_number} from ${vb.start_date} ${vb.start_time || ''} to ${vb.end_date} ${vb.end_time || ''}. Please select another vehicle or schedule.`
        });
        return;
      }
    }

    // 2. Driver conflict check if driver is specified
    if (data.driver_id) {
      const existingDriverBookings = await db.all(`
        SELECT b.id, b.booking_number, b.start_date, b.start_time, b.end_date, b.end_time, d.name as driver_name 
        FROM bookings b
        JOIN drivers d ON b.driver_id = d.id
        WHERE b.driver_id = ? 
          AND b.booking_status IN ('Confirmed', 'Started')
          AND (b.start_date <= ? AND b.end_date >= ?)
      `, [data.driver_id, data.end_date, data.start_date]);

      for (const dbk of existingDriverBookings) {
        const existingStart = parseBookingDateTime(dbk.start_date, dbk.start_time);
        const existingEnd = parseBookingDateTime(dbk.end_date, dbk.end_time);

        if (startDateTime.getTime() <= existingEnd.getTime() && endDateTime.getTime() >= existingStart.getTime()) {
          res.status(409).json({
            error: `Driver Conflict: Driver ${dbk.driver_name} is already assigned on ${dbk.booking_number} (${dbk.start_date} ${dbk.start_time || ''} to ${dbk.end_date} ${dbk.end_time || ''}).`
          });
          return;
        }
      }
    }

    // Fetch vehicle and driver information
    const vehicle = await db.get('SELECT vehicle_number, vehicle_type, vehicle_category, driver_id FROM vehicles WHERE id = ?', [data.vehicle_id]);
    let driver = null;
    if (data.driver_id) {
      driver = await db.get('SELECT name, phone, status FROM drivers WHERE id = ?', [data.driver_id]);
    }

    const driverName = data.driver_name || driver?.name || '';
    const driverPhone = data.driver_phone || driver?.phone || '';
    const driverAvailability = data.driver_availability || driver?.status || 'Available';
    const vehicleNumber = vehicle?.vehicle_number || data.vehicle_number || '';
    const vehicleType = vehicle?.vehicle_type || data.vehicle_type || 'Vehicle';
    const vehicleCategory = vehicle?.vehicle_category || data.vehicle_category || 'Commercial';
    const bookingDate = data.booking_date || new Date().toISOString().split('T')[0];
    const initialStatus = data.booking_status || 'Confirmed';

    await db.run(`
      INSERT INTO bookings (
        id, booking_number, booking_date, customer_id, customer_name, customer_mobile, customer_address,
        vehicle_id, vehicle_number, vehicle_type, vehicle_category,
        driver_id, driver_name, driver_phone, driver_availability,
        pickup_location, drop_location,
        start_date, start_time, end_date, end_time, trip_type, passenger_or_goods_details,
        distance_km, estimated_fuel_litres,
        booking_amount, advance_amount, remaining_amount, payment_status,
        booking_status, special_instructions, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bookingId,
      bookingNumber,
      bookingDate,
      data.customer_id || null,
      data.customer_name.trim(),
      data.customer_mobile.trim(),
      data.customer_address?.trim() || null,
      data.vehicle_id,
      vehicleNumber,
      vehicleType,
      vehicleCategory,
      data.driver_id || null,
      driverName,
      driverPhone,
      driverAvailability,
      data.pickup_location.trim(),
      data.drop_location.trim(),
      data.start_date,
      data.start_time || '08:00 AM',
      data.end_date,
      data.end_time || '06:00 PM',
      data.trip_type || 'One Way',
      data.passenger_or_goods_details || '',
      distanceKm,
      parseFloat(data.estimated_fuel_litres) || 0,
      bookingAmt,
      advAmt,
      remAmt,
      payStat,
      initialStatus,
      data.special_instructions || '',
      data.notes || ''
    ]);

    // Update vehicle status to On Trip if started
    if (initialStatus === 'Started') {
      await db.run("UPDATE vehicles SET status = 'On Trip' WHERE id = ?", [data.vehicle_id]);
      if (data.driver_id) {
        await db.run("UPDATE drivers SET status = 'On Trip' WHERE id = ?", [data.driver_id]);
      }
    }

    // Record advance payment in payments ledger if present
    if (advAmt > 0) {
      await db.run(`
        INSERT INTO payments (id, reference_type, reference_id, vehicle_id, amount, payment_date, payment_mode, status, notes)
        VALUES (?, 'Booking Advance', ?, ?, ?, ?, 'UPI', 'Paid', ?)
      `, [
        `pay-bk-${bookingId}`,
        bookingId,
        data.vehicle_id,
        advAmt,
        data.start_date,
        `Advance collection for booking ${bookingNumber}`
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'CREATE_BOOKING',
      entity: 'Booking',
      entityId: bookingId,
      newValues: { booking_number: bookingNumber, vehicle: vehicleNumber, customer: data.customer_name, amount: bookingAmt, advance: advAmt },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: `Booking ${bookingNumber} created successfully and saved to database.`,
      bookingNumber,
      id: bookingId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update / Edit Booking
router.put('/:id', requireRole(['Super Admin', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existingBooking = await db.get('SELECT * FROM bookings WHERE id = ? OR booking_number = ?', [id, id]);
    if (!existingBooking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Required fields check
    if (!data.vehicle_id || !data.customer_name || !data.customer_mobile || !data.pickup_location || !data.drop_location || !data.start_date || !data.end_date) {
      res.status(400).json({ error: 'Vehicle, customer name, customer mobile, pickup & drop locations, and start & end dates are required.' });
      return;
    }

    // Phone validation
    if (!isValidPhone(data.customer_mobile)) {
      res.status(400).json({ error: 'Invalid Customer Mobile Number. Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (data.driver_phone && !isValidPhone(data.driver_phone)) {
      res.status(400).json({ error: 'Invalid Driver Mobile Number. Please enter a valid 10-digit mobile number.' });
      return;
    }

    // Date/Time validation
    const startDateTime = parseBookingDateTime(data.start_date, data.start_time);
    const endDateTime = parseBookingDateTime(data.end_date, data.end_time);

    if (endDateTime.getTime() < startDateTime.getTime()) {
      res.status(400).json({ error: 'End date and time cannot be earlier than Start date and time.' });
      return;
    }

    const bookingAmt = parseFloat(data.booking_amount) || 0;
    const advAmt = parseFloat(data.advance_amount) || 0;
    const distanceKm = parseFloat(data.distance_km) || 0;

    if (bookingAmt < 0) {
      res.status(400).json({ error: 'Total Fare cannot be negative.' });
      return;
    }
    if (advAmt < 0) {
      res.status(400).json({ error: 'Advance Amount cannot be negative.' });
      return;
    }
    if (advAmt > bookingAmt && bookingAmt > 0) {
      res.status(400).json({ error: `Advance Amount (₹${advAmt.toLocaleString()}) cannot be greater than Total Fare (₹${bookingAmt.toLocaleString()}).` });
      return;
    }
    if (distanceKm < 0) {
      res.status(400).json({ error: 'Estimated Distance cannot be negative.' });
      return;
    }

    const remAmt = Math.max(0, bookingAmt - advAmt);
    let payStat = 'Pending';
    if (advAmt >= bookingAmt && bookingAmt > 0) payStat = 'Paid';
    else if (advAmt > 0) payStat = 'Partial';

    // Conflict Check for Vehicle (excluding self)
    const vehicleConflicts = await db.all(`
      SELECT b.id, b.booking_number, b.start_date, b.start_time, b.end_date, b.end_time, v.vehicle_number 
      FROM bookings b
      JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.vehicle_id = ? 
        AND b.id != ?
        AND b.booking_status IN ('Confirmed', 'Started')
        AND (b.start_date <= ? AND b.end_date >= ?)
    `, [data.vehicle_id, existingBooking.id, data.end_date, data.start_date]);

    for (const vb of vehicleConflicts) {
      const existingStart = parseBookingDateTime(vb.start_date, vb.start_time);
      const existingEnd = parseBookingDateTime(vb.end_date, vb.end_time);

      if (startDateTime.getTime() <= existingEnd.getTime() && endDateTime.getTime() >= existingStart.getTime()) {
        res.status(409).json({
          error: `Schedule Conflict: Vehicle ${vb.vehicle_number} is already booked on ${vb.booking_number} (${vb.start_date} to ${vb.end_date}).`
        });
        return;
      }
    }

    // Conflict Check for Driver (excluding self)
    if (data.driver_id) {
      const driverConflicts = await db.all(`
        SELECT b.id, b.booking_number, b.start_date, b.start_time, b.end_date, b.end_time, d.name as driver_name 
        FROM bookings b
        JOIN drivers d ON b.driver_id = d.id
        WHERE b.driver_id = ? 
          AND b.id != ?
          AND b.booking_status IN ('Confirmed', 'Started')
          AND (b.start_date <= ? AND b.end_date >= ?)
      `, [data.driver_id, existingBooking.id, data.end_date, data.start_date]);

      for (const dbk of driverConflicts) {
        const existingStart = parseBookingDateTime(dbk.start_date, dbk.start_time);
        const existingEnd = parseBookingDateTime(dbk.end_date, dbk.end_time);

        if (startDateTime.getTime() <= existingEnd.getTime() && endDateTime.getTime() >= existingStart.getTime()) {
          res.status(409).json({
            error: `Driver Conflict: Driver ${dbk.driver_name} is already assigned on ${dbk.booking_number} (${dbk.start_date} to ${dbk.end_date}).`
          });
          return;
        }
      }
    }

    // Vehicle info
    const vehicle = await db.get('SELECT vehicle_number, vehicle_type, vehicle_category FROM vehicles WHERE id = ?', [data.vehicle_id]);
    let driver = null;
    if (data.driver_id) {
      driver = await db.get('SELECT name, phone, status FROM drivers WHERE id = ?', [data.driver_id]);
    }

    const driverName = data.driver_name || driver?.name || existingBooking.driver_name || '';
    const driverPhone = data.driver_phone || driver?.phone || existingBooking.driver_phone || '';
    const driverAvailability = data.driver_availability || driver?.status || existingBooking.driver_availability || 'Available';
    const vehicleNumber = vehicle?.vehicle_number || data.vehicle_number || existingBooking.vehicle_number || '';
    const vehicleType = vehicle?.vehicle_type || data.vehicle_type || existingBooking.vehicle_type || 'Vehicle';
    const vehicleCategory = vehicle?.vehicle_category || data.vehicle_category || existingBooking.vehicle_category || 'Commercial';
    const bookingDate = data.booking_date || existingBooking.booking_date || new Date().toISOString().split('T')[0];
    const bookingNumber = data.booking_number?.trim() || existingBooking.booking_number;

    await db.run(`
      UPDATE bookings SET
        booking_number = ?,
        booking_date = ?,
        customer_id = ?,
        customer_name = ?,
        customer_mobile = ?,
        customer_address = ?,
        vehicle_id = ?,
        vehicle_number = ?,
        vehicle_type = ?,
        vehicle_category = ?,
        driver_id = ?,
        driver_name = ?,
        driver_phone = ?,
        driver_availability = ?,
        pickup_location = ?,
        drop_location = ?,
        start_date = ?,
        start_time = ?,
        end_date = ?,
        end_time = ?,
        trip_type = ?,
        passenger_or_goods_details = ?,
        distance_km = ?,
        estimated_fuel_litres = ?,
        booking_amount = ?,
        advance_amount = ?,
        remaining_amount = ?,
        payment_status = ?,
        booking_status = ?,
        special_instructions = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      bookingNumber,
      bookingDate,
      data.customer_id || null,
      data.customer_name.trim(),
      data.customer_mobile.trim(),
      data.customer_address?.trim() || null,
      data.vehicle_id,
      vehicleNumber,
      vehicleType,
      vehicleCategory,
      data.driver_id || null,
      driverName,
      driverPhone,
      driverAvailability,
      data.pickup_location.trim(),
      data.drop_location.trim(),
      data.start_date,
      data.start_time || '08:00 AM',
      data.end_date,
      data.end_time || '06:00 PM',
      data.trip_type || 'One Way',
      data.passenger_or_goods_details || '',
      distanceKm,
      parseFloat(data.estimated_fuel_litres) || 0,
      bookingAmt,
      advAmt,
      remAmt,
      payStat,
      data.booking_status || existingBooking.booking_status,
      data.special_instructions || '',
      data.notes || '',
      existingBooking.id
    ]);

    // Update payment record if advance modified
    await db.run('DELETE FROM payments WHERE reference_id = ?', [existingBooking.id]);
    if (advAmt > 0) {
      await db.run(`
        INSERT INTO payments (id, reference_type, reference_id, vehicle_id, amount, payment_date, payment_mode, status, notes)
        VALUES (?, 'Booking Advance', ?, ?, ?, ?, 'UPI', 'Paid', ?)
      `, [
        `pay-bk-${existingBooking.id}`,
        existingBooking.id,
        data.vehicle_id,
        advAmt,
        data.start_date,
        `Advance payment for booking ${existingBooking.booking_number}`
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'UPDATE_BOOKING',
      entity: 'Booking',
      entityId: String(existingBooking.id),
      oldValues: existingBooking,
      newValues: data,
      ipAddress: req.ip
    });

    res.json({
      message: `Booking ${bookingNumber} updated successfully.`,
      id: existingBooking.id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/start - Exact START TRIP Action Flow
router.post('/:id/start', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { actual_start_date, actual_start_time } = req.body || {};

    const booking = await db.get('SELECT * FROM bookings WHERE id = ? OR booking_number = ?', [id, id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const startDate = actual_start_date || new Date().toISOString().split('T')[0];
    const startTime = actual_start_time || getCurrent12HourTime();

    await db.run(`
      UPDATE bookings SET
        booking_status = 'Started',
        actual_start_date = ?,
        actual_start_time = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [startDate, startTime, booking.id]);

    // Update vehicle to 'On Trip'
    await db.run("UPDATE vehicles SET status = 'On Trip' WHERE id = ?", [booking.vehicle_id]);

    // If driver assigned, update driver status and driver_location_status
    if (booking.driver_id) {
      await db.run("UPDATE drivers SET status = 'On Trip' WHERE id = ?", [booking.driver_id]);
      
      await db.run(`
        INSERT INTO driver_location_status (
          driver_id, driver_name, vehicle_id, vehicle_number, booking_id, booking_number, is_tracking, trip_status, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'Started', CURRENT_TIMESTAMP)
        ON CONFLICT(driver_id) DO UPDATE SET
          vehicle_id = excluded.vehicle_id,
          vehicle_number = excluded.vehicle_number,
          booking_id = excluded.booking_id,
          booking_number = excluded.booking_number,
          is_tracking = 1,
          trip_status = 'Started',
          last_updated = CURRENT_TIMESTAMP
      `, [booking.driver_id, booking.driver_name || 'Driver', booking.vehicle_id, booking.vehicle_number || '', booking.id, booking.booking_number]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'START_TRIP',
      entity: 'Booking',
      entityId: String(booking.id),
      oldValues: { status: booking.booking_status },
      newValues: { status: 'Started', actual_start_date: startDate, actual_start_time: startTime },
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    res.json({
      message: `Trip for booking ${booking.booking_number} has started at ${startTime}.`,
      booking: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/end - Exact END TRIP Action Flow
router.post('/:id/end', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { actual_end_date, actual_end_time } = req.body || {};

    const booking = await db.get('SELECT * FROM bookings WHERE id = ? OR booking_number = ?', [id, id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const endDate = actual_end_date || new Date().toISOString().split('T')[0];
    const endTime = actual_end_time || getCurrent12HourTime();

    // Calculate actual trip duration
    const startDate = booking.actual_start_date || booking.start_date;
    const startTime = booking.actual_start_time || booking.start_time;
    const duration = calculateTripDuration(startDate, startTime, endDate, endTime);

    await db.run(`
      UPDATE bookings SET
        booking_status = 'Completed',
        actual_end_date = ?,
        actual_end_time = ?,
        trip_duration = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [endDate, endTime, duration, booking.id]);

    // Release vehicle back to Available if no other active started trip
    const activeTripForVehicle = await db.get("SELECT id FROM bookings WHERE vehicle_id = ? AND booking_status = 'Started' AND id != ?", [booking.vehicle_id, booking.id]);
    if (!activeTripForVehicle) {
      await db.run("UPDATE vehicles SET status = 'Available' WHERE id = ?", [booking.vehicle_id]);
    }

    // Release driver if assigned
    if (booking.driver_id) {
      const activeTripForDriver = await db.get("SELECT id FROM bookings WHERE driver_id = ? AND booking_status = 'Started' AND id != ?", [booking.driver_id, booking.id]);
      if (!activeTripForDriver) {
        await db.run("UPDATE drivers SET status = 'Active' WHERE id = ?", [booking.driver_id]);
        await db.run("UPDATE driver_location_status SET is_tracking = 0, trip_status = 'Completed', last_updated = CURRENT_TIMESTAMP WHERE driver_id = ?", [booking.driver_id]);
      }
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'END_TRIP',
      entity: 'Booking',
      entityId: String(booking.id),
      oldValues: { status: booking.booking_status },
      newValues: { status: 'Completed', actual_end_date: endDate, actual_end_time: endTime, trip_duration: duration },
      ipAddress: req.ip
    });

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    res.json({
      message: `Trip for booking ${booking.booking_number} completed at ${endTime}. Trip duration: ${duration || 'N/A'}.`,
      booking: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Update Booking Status
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await db.get('SELECT * FROM bookings WHERE id = ? OR booking_number = ?', [id, id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Driver can only update status of their own assigned booking
    if (req.user?.role === 'Driver') {
      const driver = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ? OR phone = ?', [req.user.email, req.user.id, req.user.phone || '']);
      if (booking.driver_id !== driver?.id) {
        res.status(403).json({ error: 'Access denied: You can only update the status of trips assigned to you.' });
        return;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = getCurrent12HourTime();

    if (status === 'Started') {
      const startDate = booking.actual_start_date || todayStr;
      const startTime = booking.actual_start_time || nowTimeStr;
      await db.run(`
        UPDATE bookings SET 
          booking_status = 'Started',
          actual_start_date = ?,
          actual_start_time = ?,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [startDate, startTime, booking.id]);
      await db.run("UPDATE vehicles SET status = 'On Trip' WHERE id = ?", [booking.vehicle_id]);
      if (booking.driver_id) {
        await db.run("UPDATE drivers SET status = 'On Trip' WHERE id = ?", [booking.driver_id]);
        await db.run(`
          INSERT INTO driver_location_status (
            driver_id, driver_name, vehicle_id, vehicle_number, booking_id, booking_number, is_tracking, trip_status, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, 1, 'Started', CURRENT_TIMESTAMP)
          ON CONFLICT(driver_id) DO UPDATE SET
            vehicle_id = excluded.vehicle_id,
            vehicle_number = excluded.vehicle_number,
            booking_id = excluded.booking_id,
            booking_number = excluded.booking_number,
            is_tracking = 1,
            trip_status = 'Started',
            last_updated = CURRENT_TIMESTAMP
        `, [booking.driver_id, booking.driver_name || 'Driver', booking.vehicle_id, booking.vehicle_number || '', booking.id, booking.booking_number]);
      }
    } else if (status === 'Completed') {
      const endDate = booking.actual_end_date || todayStr;
      const endTime = booking.actual_end_time || nowTimeStr;
      const startDate = booking.actual_start_date || booking.start_date;
      const startTime = booking.actual_start_time || booking.start_time;
      const duration = calculateTripDuration(startDate, startTime, endDate, endTime);

      await db.run(`
        UPDATE bookings SET 
          booking_status = 'Completed',
          actual_end_date = ?,
          actual_end_time = ?,
          trip_duration = ?,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [endDate, endTime, duration, booking.id]);

      const activeTrip = await db.get("SELECT id FROM bookings WHERE vehicle_id = ? AND booking_status = 'Started' AND id != ?", [booking.vehicle_id, booking.id]);
      if (!activeTrip) {
        await db.run("UPDATE vehicles SET status = 'Available' WHERE id = ?", [booking.vehicle_id]);
      }
      if (booking.driver_id) {
        await db.run("UPDATE drivers SET status = 'Active' WHERE id = ?", [booking.driver_id]);
        await db.run("UPDATE driver_location_status SET is_tracking = 0, trip_status = 'Completed', last_updated = CURRENT_TIMESTAMP WHERE driver_id = ?", [booking.driver_id]);
      }
    } else if (status === 'Cancelled') {
      await db.run("UPDATE bookings SET booking_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [booking.id]);
      const activeTrip = await db.get("SELECT id FROM bookings WHERE vehicle_id = ? AND booking_status = 'Started' AND id != ?", [booking.vehicle_id, booking.id]);
      if (!activeTrip) {
        await db.run("UPDATE vehicles SET status = 'Available' WHERE id = ?", [booking.vehicle_id]);
      }
      if (booking.driver_id) {
        await db.run("UPDATE drivers SET status = 'Active' WHERE id = ?", [booking.driver_id]);
        await db.run("UPDATE driver_location_status SET is_tracking = 0, trip_status = 'Cancelled', last_updated = CURRENT_TIMESTAMP WHERE driver_id = ?", [booking.driver_id]);
      }
    } else {
      await db.run('UPDATE bookings SET booking_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, booking.id]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'UPDATE_BOOKING_STATUS',
      entity: 'Booking',
      entityId: String(booking.id),
      oldValues: { status: booking.booking_status },
      newValues: { status },
      ipAddress: req.ip
    });

    res.json({ message: `Booking ${booking.booking_number} updated to ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Booking
router.delete('/:id', requireRole(['Super Admin', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const booking = await db.get('SELECT * FROM bookings WHERE id = ? OR booking_number = ?', [id, id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Release vehicle status back to Available if no other active booking
    const activeTrip = await db.get("SELECT id FROM bookings WHERE vehicle_id = ? AND booking_status IN ('Started', 'Confirmed') AND id != ?", [booking.vehicle_id, booking.id]);
    if (!activeTrip) {
      await db.run("UPDATE vehicles SET status = 'Available' WHERE id = ? AND status IN ('On Trip', 'Booked')", [booking.vehicle_id]);
    }
    if (booking.driver_id) {
      const activeDriverTrip = await db.get("SELECT id FROM bookings WHERE driver_id = ? AND booking_status IN ('Started', 'Confirmed') AND id != ?", [booking.driver_id, booking.id]);
      if (!activeDriverTrip) {
        await db.run("UPDATE drivers SET status = 'Active' WHERE id = ?", [booking.driver_id]);
        await db.run("UPDATE driver_location_status SET is_tracking = 0, trip_status = 'Available', last_updated = CURRENT_TIMESTAMP WHERE driver_id = ?", [booking.driver_id]);
      }
    }

    // Delete associated advance payments and locations
    await db.run('DELETE FROM payments WHERE reference_id = ?', [booking.id]);
    await db.run('DELETE FROM trip_locations WHERE booking_id = ?', [booking.id]);
    await db.run('DELETE FROM bookings WHERE id = ?', [booking.id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_BOOKING',
      entity: 'Booking',
      entityId: String(booking.id),
      oldValues: booking,
      ipAddress: req.ip
    });

    res.json({ message: `Booking ${booking.booking_number} deleted successfully from database.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
