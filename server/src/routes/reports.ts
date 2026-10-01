import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant']));

// GET Dynamic Reports
router.get('/generate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { report_type, vehicle_type, status, start_date, end_date } = req.query;

    let title = 'Fleet Operational Report';
    let data: any[] = [];
    let summary: Record<string, any> = {};

    const rType = String(report_type || 'vehicles').toLowerCase();

    switch (rType) {
      case 'compliance':
      case 'compliance_expiry':
      case 'document_expiry':
        title = 'RTO & Compliance Expiry Audit Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            v.owner_name,
            ir.insurance_company,
            ir.policy_expiry_date as insurance_expiry,
            ir.status as insurance_status,
            pr.expiry_date as puc_expiry,
            pr.status as puc_status,
            fr.expiry_date as fitness_expiry,
            fr.status as fitness_status,
            pm.permit_type,
            pm.expiry_date as permit_expiry,
            pm.status as permit_status,
            rt.next_due_date as road_tax_due,
            rt.status as road_tax_status
          FROM vehicles v
          LEFT JOIN insurance_records ir ON ir.vehicle_id = v.id
          LEFT JOIN puc_records pr ON pr.vehicle_id = v.id
          LEFT JOIN fitness_records fr ON fr.vehicle_id = v.id
          LEFT JOIN permits pm ON pm.vehicle_id = v.id
          LEFT JOIN road_tax_records rt ON rt.vehicle_id = v.id
          ORDER BY v.vehicle_number ASC
        `);
        break;

      case 'insurance':
      case 'insurance_audit':
        title = 'Insurance Policies & Coverage Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            ir.insurance_company,
            ir.policy_number,
            ir.insurance_type,
            ir.policy_start_date,
            ir.policy_expiry_date,
            ir.premium_amount,
            ir.insured_declared_value,
            ir.agent_name,
            ir.status
          FROM insurance_records ir
          JOIN vehicles v ON ir.vehicle_id = v.id
          ORDER BY ir.policy_expiry_date ASC
        `);
        const totalPremium = data.reduce((acc, curr) => acc + (curr.premium_amount || 0), 0);
        summary = { totalPremium, recordCount: data.length };
        break;

      case 'puc':
      case 'puc_audit':
        title = 'PUC Emission Certificates Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            pr.certificate_number,
            pr.issue_date,
            pr.expiry_date,
            pr.testing_center,
            pr.emission_reading,
            pr.fuel_type,
            pr.status
          FROM puc_records pr
          JOIN vehicles v ON pr.vehicle_id = v.id
          ORDER BY pr.expiry_date ASC
        `);
        summary = { recordCount: data.length };
        break;

      case 'fitness':
      case 'fitness_audit':
        title = 'Fitness Certificates & Inspection Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            fr.certificate_number,
            fr.inspection_date,
            fr.expiry_date,
            fr.testing_center,
            fr.vehicle_class,
            fr.status
          FROM fitness_records fr
          JOIN vehicles v ON fr.vehicle_id = v.id
          ORDER BY fr.expiry_date ASC
        `);
        summary = { recordCount: data.length };
        break;

      case 'permits':
      case 'permits_audit':
        title = 'Commercial Vehicle Permits Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            pm.permit_number,
            pm.permit_type,
            pm.permit_area,
            pm.issue_date,
            pm.expiry_date,
            pm.issuing_authority,
            pm.fee_paid,
            pm.status
          FROM permits pm
          JOIN vehicles v ON pm.vehicle_id = v.id
          ORDER BY pm.expiry_date ASC
        `);
        summary = { recordCount: data.length };
        break;

      case 'fuel':
      case 'fuel_consumption':
        title = 'Fuel Consumption & Mileage Efficiency Report';
        data = await db.all(`
          SELECT 
            f.date,
            v.vehicle_number,
            v.vehicle_type,
            f.fuel_type,
            f.fuel_station,
            f.quantity_litres,
            f.price_per_litre,
            f.total_amount,
            f.odometer_reading,
            f.km_per_litre,
            f.cost_per_km,
            d.name as driver_name
          FROM fuel_records f
          JOIN vehicles v ON f.vehicle_id = v.id
          LEFT JOIN drivers d ON f.driver_id = d.id
          ORDER BY f.date DESC
        `);
        const totalFuelCost = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalLitres = data.reduce((acc, curr) => acc + (curr.quantity_litres || 0), 0);
        summary = { totalFuelCost, totalLitres, recordCount: data.length };
        break;

      case 'maintenance':
      case 'maintenance_logs':
      case 'service':
        title = 'Vehicle Maintenance & Workshop Invoices Report';
        data = await db.all(`
          SELECT 
            s.service_date,
            v.vehicle_number,
            v.vehicle_type,
            s.service_type,
            s.workshop_name,
            s.current_odometer,
            s.next_service_odometer,
            s.parts_changed,
            s.parts_cost,
            s.labour_cost,
            s.total_cost,
            s.service_status
          FROM service_records s
          JOIN vehicles v ON s.vehicle_id = v.id
          ORDER BY s.service_date DESC
        `);
        const totalServiceCost = data.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
        summary = { totalServiceCost, recordCount: data.length };
        break;

      case 'bookings':
      case 'bookings_dispatch':
      case 'trips':
        title = 'Trip Bookings & Revenue Report';
        data = await db.all(`
          SELECT 
            b.booking_number,
            b.customer_name,
            b.customer_mobile,
            v.vehicle_number,
            v.vehicle_type,
            d.name as driver_name,
            b.pickup_location,
            b.drop_location,
            b.start_date,
            b.end_date,
            b.distance_km,
            b.booking_amount,
            b.advance_amount,
            b.remaining_amount,
            b.payment_status,
            b.booking_status
          FROM bookings b
          JOIN vehicles v ON b.vehicle_id = v.id
          LEFT JOIN drivers d ON b.driver_id = d.id
          ORDER BY b.start_date DESC
        `);
        const totalRevenue = data.reduce((acc, curr) => acc + (curr.booking_amount || 0), 0);
        summary = { totalRevenue, recordCount: data.length };
        break;

      case 'challans':
      case 'traffic_challans':
        title = 'Traffic Challans & Penalties Audit Report';
        data = await db.all(`
          SELECT 
            c.challan_number,
            v.vehicle_number,
            v.vehicle_type,
            c.date,
            c.location,
            c.offence,
            c.amount,
            c.due_date,
            c.payment_status,
            c.payment_date,
            c.receipt_number
          FROM challans c
          JOIN vehicles v ON c.vehicle_id = v.id
          ORDER BY c.date DESC
        `);
        const totalFines = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const pendingFines = data.filter(c => c.payment_status !== 'Paid').reduce((acc, curr) => acc + (curr.amount || 0), 0);
        summary = { totalFines, pendingFines, recordCount: data.length };
        break;

      case 'fastag':
      case 'fastag_audit':
        title = 'FASTag Toll Expenses & Balance Audit Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            f.fastag_id,
            f.issuer_bank,
            f.wallet_balance,
            f.minimum_balance,
            f.status as fastag_status,
            f.last_recharge_date,
            f.last_recharge_amount
          FROM fastag_records f
          JOIN vehicles v ON f.vehicle_id = v.id
          ORDER BY f.wallet_balance ASC
        `);
        break;

      case 'expenses':
      case 'financial_expenses':
        title = 'Comprehensive Transport Expenses Report';
        data = await db.all(`
          SELECT 
            e.expense_date,
            v.vehicle_number,
            e.category,
            e.amount,
            e.description,
            e.payment_method,
            e.approved_by
          FROM expenses e
          LEFT JOIN vehicles v ON e.vehicle_id = v.id
          ORDER BY e.expense_date DESC
        `);
        const totalExpenses = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        summary = { totalExpenses, recordCount: data.length };
        break;

      case 'notifications':
      case 'notifications_log':
        title = 'Compliance Notifications & Alert Log';
        data = await db.all(`
          SELECT 
            n.created_at,
            n.vehicle_number,
            n.title,
            n.message,
            n.type,
            n.severity,
            n.is_read
          FROM notifications n
          ORDER BY n.created_at DESC
        `);
        summary = { recordCount: data.length };
        break;

      case 'vehicles':
      case 'vehicle_inventory':
      default:
        title = 'Complete Vehicle Fleet Registry Report';
        data = await db.all(`
          SELECT 
            v.vehicle_number,
            v.vehicle_type,
            v.make,
            v.model,
            v.variant,
            v.manufacturing_year,
            v.registration_date,
            v.fuel_type,
            v.seating_capacity,
            v.load_capacity_kg,
            v.rto_office,
            v.rto_code,
            v.state,
            v.status,
            v.odometer_reading,
            v.owner_name,
            d.name as driver_name,
            f.name as fleet_name
          FROM vehicles v
          LEFT JOIN drivers d ON v.driver_id = d.id
          LEFT JOIN fleets f ON v.fleet_id = f.id
          ORDER BY v.created_at DESC
        `);
        break;
    }

    res.json({
      title,
      generatedAt: new Date().toISOString(),
      reportType: report_type || 'vehicles',
      summary,
      data
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
