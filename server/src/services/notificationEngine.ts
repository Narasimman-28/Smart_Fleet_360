import { db } from '../db/database';

export interface NotificationRuleResult {
  vehicle_id?: string;
  vehicle_number?: string;
  entity_id?: string;
  fingerprint: string;
  title: string;
  message: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'URGENT' | 'EXPIRED';
  action_url?: string;
}

export class NotificationEngine {
  public static async runEvaluation(): Promise<{ evaluated: number; generated: number; activeTotal: number }> {
    try {
      // 1. Fetch Global Settings
      const settings = await db.get(`SELECT * FROM notification_settings LIMIT 1`) || {
        insurance_reminder_days: 30,
        puc_reminder_days: 15,
        fitness_reminder_days: 30,
        permit_reminder_days: 20,
        road_tax_reminder_days: 10,
        driver_license_reminder_days: 30,
        fastag_min_balance_threshold: 500,
        service_km_threshold: 1000,
        maintenance_days_threshold: 15,
        booking_reminder_hours: 24,
        challan_reminder_days: 7,
        fuel_anomaly_threshold: 20.0,
        urgent_days_threshold: 7,
        warning_days_threshold: 30,
        info_days_threshold: 90
      };

      // 2. Fetch Vehicle-Specific Overrides
      const vehicleOverridesList = await db.all(`SELECT * FROM vehicle_threshold_settings`);
      const vehicleOverrides = new Map<string, any>();
      for (const vo of vehicleOverridesList) {
        vehicleOverrides.set(vo.vehicle_id, vo);
      }

      const getEffectiveThreshold = (
        vehicleId: string | undefined,
        key: string,
        globalDefault: number
      ): number => {
        if (vehicleId && vehicleOverrides.has(vehicleId)) {
          const custom = vehicleOverrides.get(vehicleId)[key];
          if (custom !== null && custom !== undefined && !isNaN(Number(custom))) {
            return Number(custom);
          }
        }
        return globalDefault;
      };

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const generatedAlerts: NotificationRuleResult[] = [];
      const validEntityKeys = new Set<string>();

      // ----------------------------------------------------
      // A0. RTO Registration Certificate (RC) Validity Monitoring
      // ----------------------------------------------------
      const rtoRecords = await db.all(`
        SELECT r.*, v.vehicle_number 
        FROM rto_records r
        JOIN vehicles v ON r.vehicle_id = v.id
      `);

      for (const rto of rtoRecords) {
        if (!rto.registration_validity) continue;
        const expDate = new Date(rto.registration_validity);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = getEffectiveThreshold(rto.vehicle_id, 'insurance_reminder_days', settings.insurance_reminder_days || 30);
        const urgentThreshold = settings.urgent_days_threshold || 7;

        if (diffDays < 0) {
          generatedAlerts.push({
            vehicle_id: rto.vehicle_id,
            vehicle_number: rto.vehicle_number,
            entity_id: rto.id,
            fingerprint: `RC:${rto.vehicle_id}:${rto.id}:EXPIRED:${rto.registration_validity}`,
            title: `RC Validity Expired: ${rto.vehicle_number}`,
            message: `Registration certificate (RC ${rto.rc_number}) expired on ${rto.registration_validity}. Re-registration required.`,
            type: 'RC',
            severity: 'EXPIRED',
            action_url: `/vehicles/${rto.vehicle_id}?tab=rto`
          });
          validEntityKeys.add(`RC:${rto.vehicle_id}`);
        } else if (diffDays <= urgentThreshold) {
          generatedAlerts.push({
            vehicle_id: rto.vehicle_id,
            vehicle_number: rto.vehicle_number,
            entity_id: rto.id,
            fingerprint: `RC:${rto.vehicle_id}:${rto.id}:URGENT:${rto.registration_validity}`,
            title: `URGENT: RC Validity Expiry (${rto.vehicle_number})`,
            message: `Registration certificate (RC ${rto.rc_number}) expires in ${diffDays} day(s) on ${rto.registration_validity}.`,
            type: 'RC',
            severity: 'URGENT',
            action_url: `/vehicles/${rto.vehicle_id}?tab=rto`
          });
          validEntityKeys.add(`RC:${rto.vehicle_id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: rto.vehicle_id,
            vehicle_number: rto.vehicle_number,
            entity_id: rto.id,
            fingerprint: `RC:${rto.vehicle_id}:${rto.id}:WARNING:${rto.registration_validity}`,
            title: `RC Validity Due Soon: ${rto.vehicle_number}`,
            message: `Registration certificate (RC ${rto.rc_number}) expires in ${diffDays} day(s) on ${rto.registration_validity}.`,
            type: 'RC',
            severity: 'WARNING',
            action_url: `/vehicles/${rto.vehicle_id}?tab=rto`
          });
          validEntityKeys.add(`RC:${rto.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // A. Insurance Expiry Monitoring
      // ----------------------------------------------------
      const insurances = await db.all(`
        SELECT ir.*, v.vehicle_number 
        FROM insurance_records ir
        JOIN vehicles v ON ir.vehicle_id = v.id
      `);

      for (const ins of insurances) {
        if (!ins.policy_expiry_date) continue;
        const expDate = new Date(ins.policy_expiry_date);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = getEffectiveThreshold(ins.vehicle_id, 'insurance_reminder_days', settings.insurance_reminder_days || 30);
        const urgentThreshold = settings.urgent_days_threshold || 7;

        if (diffDays < 0) {
          generatedAlerts.push({
            vehicle_id: ins.vehicle_id,
            vehicle_number: ins.vehicle_number,
            entity_id: ins.id,
            fingerprint: `INSURANCE:${ins.vehicle_id}:${ins.id}:EXPIRED:${ins.policy_expiry_date}`,
            title: `Insurance Expired: ${ins.vehicle_number}`,
            message: `Insurance policy ${ins.policy_number} (${ins.insurance_company}) expired ${Math.abs(diffDays)} day(s) ago on ${ins.policy_expiry_date}. Vehicle is not legally roadworthy.`,
            type: 'INSURANCE',
            severity: 'EXPIRED',
            action_url: `/vehicles/${ins.vehicle_id}?tab=insurance`
          });
          validEntityKeys.add(`INSURANCE:${ins.vehicle_id}`);
        } else if (diffDays <= urgentThreshold) {
          generatedAlerts.push({
            vehicle_id: ins.vehicle_id,
            vehicle_number: ins.vehicle_number,
            entity_id: ins.id,
            fingerprint: `INSURANCE:${ins.vehicle_id}:${ins.id}:URGENT:${ins.policy_expiry_date}`,
            title: `URGENT: Insurance Expiry (${ins.vehicle_number})`,
            message: `Insurance policy ${ins.policy_number} expires in ${diffDays} day(s) on ${ins.policy_expiry_date}. Renew immediately.`,
            type: 'INSURANCE',
            severity: 'URGENT',
            action_url: `/vehicles/${ins.vehicle_id}?tab=insurance`
          });
          validEntityKeys.add(`INSURANCE:${ins.vehicle_id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: ins.vehicle_id,
            vehicle_number: ins.vehicle_number,
            entity_id: ins.id,
            fingerprint: `INSURANCE:${ins.vehicle_id}:${ins.id}:WARNING:${ins.policy_expiry_date}`,
            title: `Insurance Renewal Window: ${ins.vehicle_number}`,
            message: `Insurance policy ${ins.policy_number} has reached the configured ${threshold}-day renewal window (${diffDays} days remaining, expires ${ins.policy_expiry_date}).`,
            type: 'INSURANCE',
            severity: 'WARNING',
            action_url: `/vehicles/${ins.vehicle_id}?tab=insurance`
          });
          validEntityKeys.add(`INSURANCE:${ins.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // B. PUC Pollution Certificate Monitoring
      // ----------------------------------------------------
      const pucRecords = await db.all(`
        SELECT p.*, v.vehicle_number 
        FROM puc_records p
        JOIN vehicles v ON p.vehicle_id = v.id
      `);

      for (const puc of pucRecords) {
        if (!puc.expiry_date) continue;
        const expDate = new Date(puc.expiry_date);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = getEffectiveThreshold(puc.vehicle_id, 'puc_reminder_days', settings.puc_reminder_days || 15);
        const urgentThreshold = Math.min(7, threshold);

        if (diffDays < 0) {
          generatedAlerts.push({
            vehicle_id: puc.vehicle_id,
            vehicle_number: puc.vehicle_number,
            entity_id: puc.id,
            fingerprint: `PUC:${puc.vehicle_id}:${puc.id}:EXPIRED:${puc.expiry_date}`,
            title: `PUC Certificate Expired: ${puc.vehicle_number}`,
            message: `Pollution Certificate ${puc.certificate_number} expired on ${puc.expiry_date}. High risk of heavy RTO challans.`,
            type: 'PUC',
            severity: 'EXPIRED',
            action_url: `/vehicles/${puc.vehicle_id}?tab=puc`
          });
          validEntityKeys.add(`PUC:${puc.vehicle_id}`);
        } else if (diffDays <= urgentThreshold) {
          generatedAlerts.push({
            vehicle_id: puc.vehicle_id,
            vehicle_number: puc.vehicle_number,
            entity_id: puc.id,
            fingerprint: `PUC:${puc.vehicle_id}:${puc.id}:URGENT:${puc.expiry_date}`,
            title: `URGENT: PUC Expiry (${puc.vehicle_number})`,
            message: `PUC certificate expires in ${diffDays} day(s) on ${puc.expiry_date}. Schedule emission test.`,
            type: 'PUC',
            severity: 'URGENT',
            action_url: `/vehicles/${puc.vehicle_id}?tab=puc`
          });
          validEntityKeys.add(`PUC:${puc.vehicle_id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: puc.vehicle_id,
            vehicle_number: puc.vehicle_number,
            entity_id: puc.id,
            fingerprint: `PUC:${puc.vehicle_id}:${puc.id}:WARNING:${puc.expiry_date}`,
            title: `PUC Due Soon: ${puc.vehicle_number}`,
            message: `Pollution Certificate ${puc.certificate_number} has reached the configured ${threshold}-day reminder window (${diffDays} days remaining, expires ${puc.expiry_date}).`,
            type: 'PUC',
            severity: 'WARNING',
            action_url: `/vehicles/${puc.vehicle_id}?tab=puc`
          });
          validEntityKeys.add(`PUC:${puc.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // C. Fitness Certificate Monitoring
      // ----------------------------------------------------
      const fitnessRecords = await db.all(`
        SELECT f.*, v.vehicle_number 
        FROM fitness_records f
        JOIN vehicles v ON f.vehicle_id = v.id
      `);

      for (const fit of fitnessRecords) {
        if (!fit.expiry_date) continue;
        const expDate = new Date(fit.expiry_date);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = getEffectiveThreshold(fit.vehicle_id, 'fitness_reminder_days', settings.fitness_reminder_days || 30);
        const urgentThreshold = settings.urgent_days_threshold || 7;

        if (diffDays < 0) {
          generatedAlerts.push({
            vehicle_id: fit.vehicle_id,
            vehicle_number: fit.vehicle_number,
            entity_id: fit.id,
            fingerprint: `FITNESS:${fit.vehicle_id}:${fit.id}:EXPIRED:${fit.expiry_date}`,
            title: `Fitness Certificate EXPIRED: ${fit.vehicle_number}`,
            message: `Fitness Certificate ${fit.certificate_number} expired on ${fit.expiry_date}. Commercial vehicle operation is prohibited.`,
            type: 'FITNESS',
            severity: 'EXPIRED',
            action_url: `/vehicles/${fit.vehicle_id}?tab=fitness`
          });
          validEntityKeys.add(`FITNESS:${fit.vehicle_id}`);
        } else if (diffDays <= urgentThreshold) {
          generatedAlerts.push({
            vehicle_id: fit.vehicle_id,
            vehicle_number: fit.vehicle_number,
            entity_id: fit.id,
            fingerprint: `FITNESS:${fit.vehicle_id}:${fit.id}:URGENT:${fit.expiry_date}`,
            title: `URGENT: Fitness Expiry (${fit.vehicle_number})`,
            message: `Fitness certificate expires in ${diffDays} day(s) on ${fit.expiry_date}. Schedule RTO fitness inspection.`,
            type: 'FITNESS',
            severity: 'URGENT',
            action_url: `/vehicles/${fit.vehicle_id}?tab=fitness`
          });
          validEntityKeys.add(`FITNESS:${fit.vehicle_id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: fit.vehicle_id,
            vehicle_number: fit.vehicle_number,
            entity_id: fit.id,
            fingerprint: `FITNESS:${fit.vehicle_id}:${fit.id}:WARNING:${fit.expiry_date}`,
            title: `Fitness Renewal Due: ${fit.vehicle_number}`,
            message: `Fitness certificate ${fit.certificate_number} is within the ${threshold}-day threshold window (${diffDays} days remaining).`,
            type: 'FITNESS',
            severity: 'WARNING',
            action_url: `/vehicles/${fit.vehicle_id}?tab=fitness`
          });
          validEntityKeys.add(`FITNESS:${fit.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // D. Permits Monitoring
      // ----------------------------------------------------
      const permits = await db.all(`
        SELECT p.*, v.vehicle_number 
        FROM permits p
        JOIN vehicles v ON p.vehicle_id = v.id
      `);

      for (const p of permits) {
        if (!p.expiry_date) continue;
        const expDate = new Date(p.expiry_date);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = getEffectiveThreshold(p.vehicle_id, 'permit_reminder_days', settings.permit_reminder_days || 20);

        if (diffDays < 0) {
          generatedAlerts.push({
            vehicle_id: p.vehicle_id,
            vehicle_number: p.vehicle_number,
            entity_id: p.id,
            fingerprint: `PERMIT:${p.vehicle_id}:${p.id}:EXPIRED:${p.expiry_date}`,
            title: `Permit EXPIRED: ${p.vehicle_number}`,
            message: `${p.permit_type} (${p.permit_number}) expired on ${p.expiry_date}.`,
            type: 'PERMIT',
            severity: 'EXPIRED',
            action_url: `/vehicles/${p.vehicle_id}?tab=permits`
          });
          validEntityKeys.add(`PERMIT:${p.vehicle_id}`);
        } else if (diffDays <= (settings.urgent_days_threshold || 7)) {
          generatedAlerts.push({
            vehicle_id: p.vehicle_id,
            vehicle_number: p.vehicle_number,
            entity_id: p.id,
            fingerprint: `PERMIT:${p.vehicle_id}:${p.id}:URGENT:${p.expiry_date}`,
            title: `URGENT: Permit Expiry (${p.vehicle_number})`,
            message: `${p.permit_type} expires in ${diffDays} day(s) on ${p.expiry_date}.`,
            type: 'PERMIT',
            severity: 'URGENT',
            action_url: `/vehicles/${p.vehicle_id}?tab=permits`
          });
          validEntityKeys.add(`PERMIT:${p.vehicle_id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: p.vehicle_id,
            vehicle_number: p.vehicle_number,
            entity_id: p.id,
            fingerprint: `PERMIT:${p.vehicle_id}:${p.id}:WARNING:${p.expiry_date}`,
            title: `Permit Renewal Due: ${p.vehicle_number}`,
            message: `${p.permit_type} (${p.permit_number}) reached the ${threshold}-day reminder threshold (${diffDays} days left).`,
            type: 'PERMIT',
            severity: 'WARNING',
            action_url: `/vehicles/${p.vehicle_id}?tab=permits`
          });
          validEntityKeys.add(`PERMIT:${p.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // E. Road Tax Due Monitoring
      // ----------------------------------------------------
      const roadTaxes = await db.all(`
        SELECT rt.*, v.vehicle_number 
        FROM road_tax_records rt
        JOIN vehicles v ON rt.vehicle_id = v.id
      `);

      for (const tax of roadTaxes) {
        if (!tax.next_due_date) continue;
        const dueDate = new Date(tax.next_due_date);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = getEffectiveThreshold(tax.vehicle_id, 'road_tax_reminder_days', settings.road_tax_reminder_days || 10);

        if (diffDays < 0) {
          generatedAlerts.push({
            vehicle_id: tax.vehicle_id,
            vehicle_number: tax.vehicle_number,
            entity_id: tax.id,
            fingerprint: `TAX:${tax.vehicle_id}:${tax.id}:EXPIRED:${tax.next_due_date}`,
            title: `Road Tax OVERDUE: ${tax.vehicle_number}`,
            message: `Road tax of ₹${tax.tax_amount.toLocaleString()} was due on ${tax.next_due_date}. Penalty is accruing.`,
            type: 'TAX',
            severity: 'EXPIRED',
            action_url: `/vehicles/${tax.vehicle_id}?tab=roadtax`
          });
          validEntityKeys.add(`TAX:${tax.vehicle_id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: tax.vehicle_id,
            vehicle_number: tax.vehicle_number,
            entity_id: tax.id,
            fingerprint: `TAX:${tax.vehicle_id}:${tax.id}:WARNING:${tax.next_due_date}`,
            title: `Road Tax Payment Due: ${tax.vehicle_number}`,
            message: `Road tax of ₹${tax.tax_amount.toLocaleString()} is due in ${diffDays} day(s) on ${tax.next_due_date}.`,
            type: 'TAX',
            severity: 'WARNING',
            action_url: `/vehicles/${tax.vehicle_id}?tab=roadtax`
          });
          validEntityKeys.add(`TAX:${tax.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // F. FASTag Balances & Account Status
      // ----------------------------------------------------
      const fastags = await db.all(`
        SELECT f.*, v.vehicle_number 
        FROM fastag_records f
        JOIN vehicles v ON f.vehicle_id = v.id
      `);

      for (const ft of fastags) {
        const minBal = getEffectiveThreshold(ft.vehicle_id, 'fastag_min_balance_threshold', settings.fastag_min_balance_threshold || 500);

        if (ft.status === 'Blocked') {
          generatedAlerts.push({
            vehicle_id: ft.vehicle_id,
            vehicle_number: ft.vehicle_number,
            entity_id: ft.id,
            fingerprint: `FASTAG:${ft.vehicle_id}:${ft.id}:BLOCKED`,
            title: `FASTag BLOCKED: ${ft.vehicle_number}`,
            message: `FASTag ${ft.fastag_id} (${ft.issuer_bank}) is currently BLOCKED. Toll transit will fail.`,
            type: 'FASTAG',
            severity: 'URGENT',
            action_url: `/vehicles/${ft.vehicle_id}?tab=fastag`
          });
          validEntityKeys.add(`FASTAG:${ft.vehicle_id}`);
        } else if (ft.wallet_balance < minBal) {
          generatedAlerts.push({
            vehicle_id: ft.vehicle_id,
            vehicle_number: ft.vehicle_number,
            entity_id: ft.id,
            fingerprint: `FASTAG:${ft.vehicle_id}:${ft.id}:LOW_BALANCE:${Math.floor(ft.wallet_balance / 100)}`,
            title: `FASTag Low Balance: ${ft.vehicle_number}`,
            message: `FASTag balance ₹${ft.wallet_balance.toFixed(2)} is below configured minimum threshold ₹${minBal.toFixed(2)}. Recharge required before highway transit.`,
            type: 'FASTAG',
            severity: 'WARNING',
            action_url: `/vehicles/${ft.vehicle_id}?tab=fastag`
          });
          validEntityKeys.add(`FASTAG:${ft.vehicle_id}`);
        }
      }

      // ----------------------------------------------------
      // G. Traffic Challans (Pending & Overdue)
      // ----------------------------------------------------
      const challans = await db.all(`
        SELECT c.*, v.vehicle_number 
        FROM challans c
        JOIN vehicles v ON c.vehicle_id = v.id
        WHERE c.payment_status != 'Paid'
      `);

      for (const ch of challans) {
        const dueDate = new Date(ch.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = settings.challan_reminder_days || 7;

        if (diffDays < 0 || ch.payment_status === 'Overdue') {
          generatedAlerts.push({
            vehicle_id: ch.vehicle_id,
            vehicle_number: ch.vehicle_number,
            entity_id: ch.id,
            fingerprint: `CHALLAN:${ch.vehicle_id}:${ch.id}:OVERDUE`,
            title: `OVERDUE Traffic Challan: ${ch.vehicle_number}`,
            message: `Traffic Challan ${ch.challan_number} for ₹${ch.amount.toLocaleString()} (${ch.offence}) is OVERDUE since ${ch.due_date}. Clear court penalty.`,
            type: 'CHALLAN',
            severity: 'URGENT',
            action_url: `/vehicles/${ch.vehicle_id}?tab=challans`
          });
          validEntityKeys.add(`CHALLAN:${ch.id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            vehicle_id: ch.vehicle_id,
            vehicle_number: ch.vehicle_number,
            entity_id: ch.id,
            fingerprint: `CHALLAN:${ch.vehicle_id}:${ch.id}:DUE_SOON`,
            title: `Pending Traffic Challan: ${ch.vehicle_number}`,
            message: `Challan ${ch.challan_number} (₹${ch.amount.toLocaleString()}) has ${diffDays} day(s) remaining before due date (${ch.due_date}).`,
            type: 'CHALLAN',
            severity: 'WARNING',
            action_url: `/vehicles/${ch.vehicle_id}?tab=challans`
          });
          validEntityKeys.add(`CHALLAN:${ch.id}`);
        }
      }

      // ----------------------------------------------------
      // H. Service & Periodic Maintenance Monitoring
      // ----------------------------------------------------
      const vehicles = await db.all(`SELECT * FROM vehicles`);
      for (const veh of vehicles) {
        const lastService = await db.get(`
          SELECT * FROM service_records 
          WHERE vehicle_id = ? 
          ORDER BY service_date DESC LIMIT 1
        `, [veh.id]);

        if (lastService) {
          // 1. Odometer-based service reminder
          if (lastService.next_service_odometer) {
            const kmThreshold = getEffectiveThreshold(veh.id, 'service_km_threshold', settings.service_km_threshold || 1000);
            const kmDiff = lastService.next_service_odometer - veh.odometer_reading;

            if (kmDiff <= 0) {
              generatedAlerts.push({
                vehicle_id: veh.id,
                vehicle_number: veh.vehicle_number,
                entity_id: lastService.id,
                fingerprint: `SERVICE:${veh.id}:${lastService.id}:OVERDUE`,
                title: `Service OVERDUE: ${veh.vehicle_number}`,
                message: `Vehicle has crossed scheduled service odometer ${lastService.next_service_odometer.toLocaleString()} km (Current: ${veh.odometer_reading.toLocaleString()} km). Schedule workshop service immediately.`,
                type: 'SERVICE',
                severity: 'URGENT',
                action_url: `/vehicles/${veh.id}?tab=maintenance`
              });
              validEntityKeys.add(`SERVICE:${veh.id}`);
            } else if (kmDiff <= kmThreshold) {
              generatedAlerts.push({
                vehicle_id: veh.id,
                vehicle_number: veh.vehicle_number,
                entity_id: lastService.id,
                fingerprint: `SERVICE:${veh.id}:${lastService.id}:PROXIMITY`,
                title: `Service Due Proximity: ${veh.vehicle_number}`,
                message: `Vehicle is within configured ${kmThreshold.toLocaleString()} km threshold of next service (${kmDiff.toLocaleString()} km remaining, target: ${lastService.next_service_odometer.toLocaleString()} km).`,
                type: 'SERVICE',
                severity: 'WARNING',
                action_url: `/vehicles/${veh.id}?tab=maintenance`
              });
              validEntityKeys.add(`SERVICE:${veh.id}`);
            }
          }

          // 2. Date-based maintenance reminder
          if (lastService.next_service_date) {
            const srvDate = new Date(lastService.next_service_date);
            srvDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((srvDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const maintThreshold = getEffectiveThreshold(veh.id, 'maintenance_days_threshold', settings.maintenance_days_threshold || 15);

            if (diffDays < 0) {
              generatedAlerts.push({
                vehicle_id: veh.id,
                vehicle_number: veh.vehicle_number,
                entity_id: lastService.id,
                fingerprint: `MAINTENANCE:${veh.id}:${lastService.id}:EXPIRED:${lastService.next_service_date}`,
                title: `Maintenance OVERDUE: ${veh.vehicle_number}`,
                message: `Scheduled maintenance was due on ${lastService.next_service_date} (${Math.abs(diffDays)} days ago). Workshop booking required.`,
                type: 'MAINTENANCE',
                severity: 'URGENT',
                action_url: `/vehicles/${veh.id}?tab=maintenance`
              });
              validEntityKeys.add(`MAINTENANCE:${veh.id}`);
            } else if (diffDays <= maintThreshold) {
              generatedAlerts.push({
                vehicle_id: veh.id,
                vehicle_number: veh.vehicle_number,
                entity_id: lastService.id,
                fingerprint: `MAINTENANCE:${veh.id}:${lastService.id}:WARNING:${lastService.next_service_date}`,
                title: `Maintenance Due Soon: ${veh.vehicle_number}`,
                message: `Scheduled maintenance is due in ${diffDays} day(s) on ${lastService.next_service_date} (configured ${maintThreshold}-day threshold).`,
                type: 'MAINTENANCE',
                severity: 'WARNING',
                action_url: `/vehicles/${veh.id}?tab=maintenance`
              });
              validEntityKeys.add(`MAINTENANCE:${veh.id}`);
            }
          }
        }
      }

      // ----------------------------------------------------
      // H2. Tyre Usage & Wear Monitoring
      // ----------------------------------------------------
      const tyres = await db.all(`
        SELECT t.*, v.vehicle_number 
        FROM tyre_records t
        JOIN vehicles v ON t.vehicle_id = v.id
      `);

      for (const tyre of tyres) {
        if (tyre.condition === 'Critical' || tyre.condition === 'Worn') {
          generatedAlerts.push({
            vehicle_id: tyre.vehicle_id,
            vehicle_number: tyre.vehicle_number,
            entity_id: tyre.id,
            fingerprint: `TYRE:${tyre.vehicle_id}:${tyre.id}:${tyre.condition}`,
            title: `Tyre Replacement Needed: ${tyre.vehicle_number}`,
            message: `Tyre at ${tyre.tyre_position} (${tyre.brand} ${tyre.size || ''}) is in ${tyre.condition.toUpperCase()} condition. Replace before dispatch.`,
            type: 'TYRE',
            severity: tyre.condition === 'Critical' ? 'URGENT' : 'WARNING',
            action_url: `/vehicles/${tyre.vehicle_id}?tab=tyres`
          });
          validEntityKeys.add(`TYRE:${tyre.id}`);
        } else if (tyre.expected_km && tyre.current_km >= tyre.expected_km) {
          generatedAlerts.push({
            vehicle_id: tyre.vehicle_id,
            vehicle_number: tyre.vehicle_number,
            entity_id: tyre.id,
            fingerprint: `TYRE:${tyre.vehicle_id}:${tyre.id}:KM_EXCEEDED`,
            title: `Tyre Lifespan Limit Crossed: ${tyre.vehicle_number}`,
            message: `Tyre at ${tyre.tyre_position} has run ${tyre.current_km.toLocaleString()} km, crossing expected lifespan of ${tyre.expected_km.toLocaleString()} km.`,
            type: 'TYRE',
            severity: 'WARNING',
            action_url: `/vehicles/${tyre.vehicle_id}?tab=tyres`
          });
          validEntityKeys.add(`TYRE:${tyre.id}`);
        }
      }

      // ----------------------------------------------------
      // H3. Battery Health & Warranty Expiry Monitoring
      // ----------------------------------------------------
      const batteries = await db.all(`
        SELECT b.*, v.vehicle_number 
        FROM battery_records b
        JOIN vehicles v ON b.vehicle_id = v.id
      `);

      for (const bat of batteries) {
        if (bat.current_condition === 'Dead' || bat.current_condition === 'Replace Soon' || bat.current_condition === 'Weak') {
          generatedAlerts.push({
            vehicle_id: bat.vehicle_id,
            vehicle_number: bat.vehicle_number,
            entity_id: bat.id,
            fingerprint: `BATTERY:${bat.vehicle_id}:${bat.id}:${bat.current_condition}`,
            title: `Battery Health Alert: ${bat.vehicle_number}`,
            message: `Battery ${bat.battery_number} (${bat.brand}) condition is ${bat.current_condition.toUpperCase()}. Risk of vehicle electrical failure.`,
            type: 'BATTERY',
            severity: (bat.current_condition === 'Dead' || bat.current_condition === 'Replace Soon') ? 'URGENT' : 'WARNING',
            action_url: `/vehicles/${bat.vehicle_id}?tab=battery`
          });
          validEntityKeys.add(`BATTERY:${bat.id}`);
        } else if (bat.warranty_expiry) {
          const wExpDate = new Date(bat.warranty_expiry);
          wExpDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((wExpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            generatedAlerts.push({
              vehicle_id: bat.vehicle_id,
              vehicle_number: bat.vehicle_number,
              entity_id: bat.id,
              fingerprint: `BATTERY:${bat.vehicle_id}:${bat.id}:WARRANTY_EXPIRED`,
              title: `Battery Warranty Expired: ${bat.vehicle_number}`,
              message: `Battery ${bat.battery_number} warranty expired on ${bat.warranty_expiry}.`,
              type: 'BATTERY',
              severity: 'INFO',
              action_url: `/vehicles/${bat.vehicle_id}?tab=battery`
            });
            validEntityKeys.add(`BATTERY:${bat.id}`);
          }
        }
      }

      // ----------------------------------------------------
      // K. Fuel Efficiency & Abnormality Monitoring
      // ----------------------------------------------------
      const fuelStats = await db.all(`
        SELECT vehicle_id, AVG(km_per_litre) as avg_kml, COUNT(*) as log_count
        FROM fuel_records
        WHERE km_per_litre > 0
        GROUP BY vehicle_id
        HAVING COUNT(*) >= 2
      `);

      for (const stat of fuelStats) {
        if (!stat.avg_kml || stat.avg_kml <= 0) continue;
        const latestFuel = await db.get(`
          SELECT f.*, v.vehicle_number 
          FROM fuel_records f
          JOIN vehicles v ON f.vehicle_id = v.id
          WHERE f.vehicle_id = ? AND f.km_per_litre > 0
          ORDER BY f.date DESC, f.created_at DESC
          LIMIT 1
        `, [stat.vehicle_id]);

        if (latestFuel && latestFuel.km_per_litre) {
          const anomalyThresholdPercent = getEffectiveThreshold(stat.vehicle_id, 'fuel_anomaly_threshold', settings.fuel_anomaly_threshold || 20.0);
          const dropPercent = ((stat.avg_kml - latestFuel.km_per_litre) / stat.avg_kml) * 100;

          if (dropPercent >= anomalyThresholdPercent) {
            generatedAlerts.push({
              vehicle_id: latestFuel.vehicle_id,
              vehicle_number: latestFuel.vehicle_number,
              entity_id: latestFuel.id,
              fingerprint: `FUEL_ANOMALY:${latestFuel.vehicle_id}:${latestFuel.id}`,
              title: `Fuel Abnormality: ${latestFuel.vehicle_number}`,
              message: `Latest mileage of ${latestFuel.km_per_litre.toFixed(1)} KM/L on ${latestFuel.date} is ${dropPercent.toFixed(1)}% below vehicle average (${stat.avg_kml.toFixed(1)} KM/L), exceeding configured ${anomalyThresholdPercent}% threshold. Check fuel leakage, tyre pressure, or fuel pilferage.`,
              type: 'FUEL_ANOMALY',
              severity: 'WARNING',
              action_url: `/vehicles/${latestFuel.vehicle_id}?tab=fuel`
            });
            validEntityKeys.add(`FUEL_ANOMALY:${latestFuel.id}`);
          }
        }
      }

      // ----------------------------------------------------
      // I. Driver License Expiries
      // ----------------------------------------------------
      const drivers = await db.all(`SELECT * FROM drivers WHERE status = 'Active'`);
      for (const d of drivers) {
        if (!d.license_expiry_date) continue;
        const expDate = new Date(d.license_expiry_date);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = settings.driver_license_reminder_days || 30;

        if (diffDays < 0) {
          generatedAlerts.push({
            entity_id: d.id,
            fingerprint: `LICENCE:${d.id}:EXPIRED:${d.license_expiry_date}`,
            title: `Driver License EXPIRED: ${d.name}`,
            message: `Driving License ${d.license_number} for driver ${d.name} expired on ${d.license_expiry_date}. Driver cannot be assigned to trips.`,
            type: 'LICENCE',
            severity: 'EXPIRED',
            action_url: `/drivers`
          });
          validEntityKeys.add(`LICENCE:${d.id}`);
        } else if (diffDays <= threshold) {
          generatedAlerts.push({
            entity_id: d.id,
            fingerprint: `LICENCE:${d.id}:WARNING:${d.license_expiry_date}`,
            title: `Driver License Renewal: ${d.name}`,
            message: `Driving License ${d.license_number} (${d.name}) reaches the configured ${threshold}-day reminder window (${diffDays} days left, expires ${d.license_expiry_date}).`,
            type: 'LICENCE',
            severity: 'WARNING',
            action_url: `/drivers`
          });
          validEntityKeys.add(`LICENCE:${d.id}`);
        }
      }

      // ----------------------------------------------------
      // J. Trip Bookings: Upcoming, Overdue, and Pending Balance Monitoring
      // ----------------------------------------------------
      const reminderHours = settings.booking_reminder_hours || 24;
      const allActiveBookings = await db.all(`
        SELECT b.*, COALESCE(b.vehicle_number, v.vehicle_number) as vehicle_number
        FROM bookings b
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        WHERE b.booking_status != 'Cancelled'
      `);

      for (const b of allActiveBookings) {
        // 1. Upcoming Trip alert
        if (b.booking_status === 'Confirmed' || b.booking_status === 'Assigned') {
          const bookingTimeStr = `${b.start_date}T${b.start_time ? b.start_time.split(' ')[0] : '08:00'}:00`;
          const bookingDateTime = new Date(bookingTimeStr);
          const diffHours = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (diffHours >= 0 && diffHours <= reminderHours) {
            generatedAlerts.push({
              vehicle_id: b.vehicle_id,
              vehicle_number: b.vehicle_number,
              entity_id: b.id,
              fingerprint: `BOOKING:${b.id}:UPCOMING:${b.start_date}`,
              title: `Upcoming Trip Dispatch: ${b.booking_number}`,
              message: `Trip for ${b.customer_name} (${b.vehicle_number || 'Vehicle'}) starts in ${Math.max(1, Math.round(diffHours))} hours from ${b.pickup_location} to ${b.drop_location}.`,
              type: 'BOOKING',
              severity: 'INFO',
              action_url: `/bookings`
            });
            validEntityKeys.add(`BOOKING:${b.id}`);
          }
        }

        // 2. Overdue Trip alert
        if ((b.booking_status === 'Started' || b.booking_status === 'Confirmed') && b.end_date < today.toISOString().split('T')[0]) {
          generatedAlerts.push({
            vehicle_id: b.vehicle_id,
            vehicle_number: b.vehicle_number,
            entity_id: b.id,
            fingerprint: `BOOKING:${b.id}:OVERDUE:${b.end_date}`,
            title: `Trip Overdue: ${b.booking_number}`,
            message: `Trip ${b.booking_number} for ${b.customer_name} was scheduled to conclude on ${b.end_date} but remains in '${b.booking_status}' status.`,
            type: 'BOOKING',
            severity: 'WARNING',
            action_url: `/bookings`
          });
          validEntityKeys.add(`BOOKING:${b.id}`);
        }

        // 3. Pending Payment Balance on Completed Trips
        if (b.booking_status === 'Completed' && (b.remaining_amount || 0) > 0) {
          generatedAlerts.push({
            vehicle_id: b.vehicle_id,
            vehicle_number: b.vehicle_number,
            entity_id: b.id,
            fingerprint: `BOOKING:${b.id}:PENDING_BALANCE:${b.remaining_amount}`,
            title: `Pending Trip Balance: ₹${(b.remaining_amount || 0).toLocaleString()} (${b.booking_number})`,
            message: `Completed trip ${b.booking_number} (${b.customer_name}) has an outstanding balance of ₹${(b.remaining_amount || 0).toLocaleString()} pending collection.`,
            type: 'BOOKING',
            severity: 'INFO',
            action_url: `/bookings`
          });
          validEntityKeys.add(`BOOKING:${b.id}`);
        }
      }

      // ----------------------------------------------------
      // L. GPS Tracking Delay & Missing Location Alerting
      // ----------------------------------------------------
      const delayThresholdMin = settings.gps_signal_delayed_min || 5;
      const activeTrips = await db.all(`
        SELECT 
          b.id as booking_id,
          b.booking_number,
          b.pickup_location,
          b.drop_location,
          v.id as vehicle_id,
          v.vehicle_number,
          d.id as driver_id,
          d.name as driver_name,
          d.phone as driver_phone,
          dls.latitude,
          dls.longitude,
          dls.location_name,
          dls.is_tracking,
          dls.last_updated,
          ((julianday('now') - julianday(dls.last_updated)) * 24 * 60) as minutes_since_update
        FROM bookings b
        JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN driver_location_status dls ON dls.driver_id = d.id OR dls.booking_id = b.id
        WHERE b.booking_status = 'Started'
      `);

      for (const trip of activeTrips) {
        const mins = trip.minutes_since_update != null ? Math.round(trip.minutes_since_update) : 999;
        if (!trip.last_updated || mins > delayThresholdMin) {
          const isSeverelyDelayed = mins > (delayThresholdMin * 3);
          generatedAlerts.push({
            vehicle_id: trip.vehicle_id,
            vehicle_number: trip.vehicle_number,
            entity_id: trip.booking_id,
            fingerprint: `GPS_DELAY:${trip.booking_id}:${trip.driver_id || 'nodrv'}:${Math.floor(mins / 15)}`,
            title: `GPS Tracking Delayed: ${trip.vehicle_number}`,
            message: `Vehicle ${trip.vehicle_number} (Driver: ${trip.driver_name || 'Assigned Driver'}, Phone: ${trip.driver_phone || 'N/A'}) is on active trip (${trip.booking_number}) but location has not updated for ${mins > 500 ? 'extended period' : `${mins} minutes`} (threshold: ${delayThresholdMin} min). Last known location: ${trip.location_name || `${trip.latitude || ''}, ${trip.longitude || ''}` || 'Unknown'}.`,
            type: 'TRACKING',
            severity: isSeverelyDelayed ? 'URGENT' : 'WARNING',
            action_url: `/dashboard`
          });
          validEntityKeys.add(`GPS_DELAY:${trip.booking_id}`);
        }
      }

      // ----------------------------------------------------
      // DEDUPLICATION & PERSISTENCE
      // ----------------------------------------------------
      let insertCount = 0;

      for (const alert of generatedAlerts) {
        // Check if an unread notification with the EXACT fingerprint already exists
        const existing = await db.get(`
          SELECT id, severity FROM notifications 
          WHERE fingerprint = ? AND is_read = 0
        `, [alert.fingerprint]);

        if (!existing) {
          const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          await db.run(`
            INSERT INTO notifications (
              id, vehicle_id, vehicle_number, entity_id, fingerprint,
              title, message, type, severity, action_url, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          `, [
            id,
            alert.vehicle_id || null,
            alert.vehicle_number || null,
            alert.entity_id || null,
            alert.fingerprint,
            alert.title,
            alert.message,
            alert.type,
            alert.severity,
            alert.action_url || null
          ]);
          insertCount++;
        }
      }

      // ----------------------------------------------------
      // AUTO-RESOLUTION: Resolve stale alerts when condition is fixed/renewed
      // ----------------------------------------------------
      const activeUnread = await db.all(`SELECT id, type, vehicle_id, entity_id, fingerprint FROM notifications WHERE is_read = 0`);
      const activeFingerprints = new Set(generatedAlerts.map(a => a.fingerprint));

      for (const notif of activeUnread) {
        let entityKey = '';
        if (notif.type === 'CHALLAN' || notif.type === 'BATTERY' || notif.type === 'TYRE' || notif.type === 'LICENCE' || notif.type === 'BOOKING') {
          entityKey = `${notif.type}:${notif.entity_id}`;
        } else if (notif.type === 'TRACKING' || notif.type === 'GPS_DELAY') {
          entityKey = `GPS_DELAY:${notif.entity_id}`;
        } else if (notif.vehicle_id) {
          entityKey = `${notif.type}:${notif.vehicle_id}`;
        }

        // If the underlying entity is no longer violating any threshold, mark as resolved
        if (entityKey && !validEntityKeys.has(entityKey)) {
          await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notif.id]);
        } else if (!activeFingerprints.has(notif.fingerprint) && entityKey && validEntityKeys.has(entityKey)) {
          // Severity changed (e.g. from WARNING to URGENT/EXPIRED) - retire the older severity record
          await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notif.id]);
        }
      }

      const totalActive = await db.get(`SELECT COUNT(*) as count FROM notifications WHERE is_read = 0`);

      return {
        evaluated: generatedAlerts.length,
        generated: insertCount,
        activeTotal: totalActive?.count || 0
      };
    } catch (err) {
      console.error('Notification Engine evaluation error:', err);
      return { evaluated: 0, generated: 0, activeTotal: 0 };
    }
  }
}
