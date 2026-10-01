import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// GET Global Omnisearch
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      res.json({ results: [] });
      return;
    }

    const searchTerm = `%${q.trim()}%`;
    const results: any[] = [];

    // 1. Search Vehicles
    const vehicles = await db.all(`
      SELECT id, vehicle_number, vehicle_type, make, model, chassis_number, engine_number, owner_name, status
      FROM vehicles
      WHERE vehicle_number LIKE ? 
         OR chassis_number LIKE ? 
         OR engine_number LIKE ? 
         OR owner_name LIKE ?
         OR make LIKE ?
         OR model LIKE ?
      LIMIT 10
    `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

    vehicles.forEach(v => {
      results.push({
        category: 'Vehicle',
        title: `${v.vehicle_number} (${v.make} ${v.model})`,
        subtitle: `Type: ${v.vehicle_type} | Status: ${v.status} | Owner: ${v.owner_name}`,
        url: `/vehicles/${v.id}`,
        id: v.id,
        badge: v.status
      });
    });

    // 2. Search Drivers
    const drivers = await db.all(`
      SELECT id, name, phone, license_number, license_type
      FROM drivers
      WHERE name LIKE ? OR license_number LIKE ? OR phone LIKE ?
      LIMIT 5
    `, [searchTerm, searchTerm, searchTerm]);

    drivers.forEach(d => {
      results.push({
        category: 'Driver',
        title: `${d.name} (${d.phone})`,
        subtitle: `License: ${d.license_number} (${d.license_type})`,
        url: `/drivers`,
        id: d.id,
        badge: 'Driver'
      });
    });

    // 3. Search Insurance Policies
    const insurances = await db.all(`
      SELECT ir.id, ir.policy_number, ir.insurance_company, ir.vehicle_id, v.vehicle_number
      FROM insurance_records ir
      JOIN vehicles v ON ir.vehicle_id = v.id
      WHERE ir.policy_number LIKE ? OR ir.insurance_company LIKE ?
      LIMIT 5
    `, [searchTerm, searchTerm]);

    insurances.forEach(i => {
      results.push({
        category: 'Insurance Policy',
        title: `Policy: ${i.policy_number}`,
        subtitle: `Company: ${i.insurance_company} | Vehicle: ${i.vehicle_number}`,
        url: `/vehicles/${i.vehicle_id}?tab=insurance`,
        id: i.id,
        badge: 'Insurance'
      });
    });

    // 4. Search PUC Certificates
    const pucs = await db.all(`
      SELECT p.id, p.certificate_number, p.vehicle_id, v.vehicle_number
      FROM puc_records p
      JOIN vehicles v ON p.vehicle_id = v.id
      WHERE p.certificate_number LIKE ?
      LIMIT 5
    `, [searchTerm]);

    pucs.forEach(p => {
      results.push({
        category: 'PUC Certificate',
        title: `PUC: ${p.certificate_number}`,
        subtitle: `Vehicle: ${p.vehicle_number}`,
        url: `/vehicles/${p.vehicle_id}?tab=puc`,
        id: p.id,
        badge: 'PUC'
      });
    });

    // 5. Search Fitness Certificates
    const fitness = await db.all(`
      SELECT f.id, f.certificate_number, f.vehicle_id, v.vehicle_number
      FROM fitness_records f
      JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.certificate_number LIKE ?
      LIMIT 5
    `, [searchTerm]);

    fitness.forEach(f => {
      results.push({
        category: 'Fitness Certificate',
        title: `Fitness: ${f.certificate_number}`,
        subtitle: `Vehicle: ${f.vehicle_number}`,
        url: `/vehicles/${f.vehicle_id}?tab=fitness`,
        id: f.id,
        badge: 'Fitness'
      });
    });

    // 6. Search Permits
    const permits = await db.all(`
      SELECT pm.id, pm.permit_number, pm.permit_type, pm.vehicle_id, v.vehicle_number
      FROM permits pm
      JOIN vehicles v ON pm.vehicle_id = v.id
      WHERE pm.permit_number LIKE ?
      LIMIT 5
    `, [searchTerm]);

    permits.forEach(p => {
      results.push({
        category: 'Permit',
        title: `${p.permit_type}: ${p.permit_number}`,
        subtitle: `Vehicle: ${p.vehicle_number}`,
        url: `/vehicles/${p.vehicle_id}?tab=permits`,
        id: p.id,
        badge: 'Permit'
      });
    });

    // 7. Search FASTag
    const fastags = await db.all(`
      SELECT ft.id, ft.fastag_id, ft.issuer_bank, ft.vehicle_id, v.vehicle_number
      FROM fastag_records ft
      JOIN vehicles v ON ft.vehicle_id = v.id
      WHERE ft.fastag_id LIKE ?
      LIMIT 5
    `, [searchTerm]);

    fastags.forEach(f => {
      results.push({
        category: 'FASTag',
        title: `FASTag: ${f.fastag_id}`,
        subtitle: `Bank: ${f.issuer_bank} | Vehicle: ${f.vehicle_number}`,
        url: `/vehicles/${f.vehicle_id}?tab=fastag`,
        id: f.id,
        badge: 'FASTag'
      });
    });

    // 8. Search Bookings
    const bookings = await db.all(`
      SELECT b.id, b.booking_number, b.customer_name, b.vehicle_id, v.vehicle_number
      FROM bookings b
      JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.booking_number LIKE ? OR b.customer_name LIKE ?
      LIMIT 5
    `, [searchTerm, searchTerm]);

    bookings.forEach(b => {
      results.push({
        category: 'Booking',
        title: `Booking: ${b.booking_number}`,
        subtitle: `Customer: ${b.customer_name} | Vehicle: ${b.vehicle_number}`,
        url: `/bookings`,
        id: b.id,
        badge: 'Trip'
      });
    });

    // 9. Search Challans
    const challans = await db.all(`
      SELECT c.id, c.challan_number, c.offence, c.vehicle_id, v.vehicle_number
      FROM challans c
      JOIN vehicles v ON c.vehicle_id = v.id
      WHERE c.challan_number LIKE ? OR c.offence LIKE ?
      LIMIT 5
    `, [searchTerm, searchTerm]);

    challans.forEach(c => {
      results.push({
        category: 'Traffic Challan',
        title: `Challan: ${c.challan_number}`,
        subtitle: `Offence: ${c.offence} | Vehicle: ${c.vehicle_number}`,
        url: `/vehicles/${c.vehicle_id}?tab=challans`,
        id: c.id,
        badge: 'Challan'
      });
    });

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
