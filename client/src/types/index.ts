export type VehicleType = 
  | 'Car' 
  | 'Taxi'
  | 'Bus' 
  | 'School Bus'
  | 'Tourist Bus'
  | 'Van' 
  | 'Truck' 
  | 'Heavy Truck'
  | 'Lorry' 
  | 'Tanker'
  | 'Trailer'
  | 'LCV'
  | 'Mini Truck'
  | 'Ambulance'
  | 'Heavy Commercial' 
  | 'Light Commercial' 
  | 'Goods Vehicle' 
  | 'Passenger Vehicle' 
  | 'Construction Vehicle' 
  | 'Special Vehicle'
  | 'Other';

export type FuelType =
  | 'Petrol'
  | 'Diesel'
  | 'CNG'
  | 'LPG'
  | 'Electric'
  | 'Hybrid'
  | 'Hydrogen'
  | 'Other';

export type VehicleStatus = 
  | 'Available' 
  | 'Booked' 
  | 'On Trip' 
  | 'Under Maintenance' 
  | 'Inactive' 
  | 'Sold' 
  | 'Retired' 
  | 'Expired Documents' 
  | 'Blocked';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  actualRole?: string;
  phone?: string;
  mobile?: string;
  avatar_url?: string;
  profileImage?: string;
  status?: string;
  isActive?: boolean;
  last_login?: string;
  lastLoginAt?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  vehicle_category: string;
  make: string;
  model: string;
  variant?: string;
  manufacturing_year: number;
  registration_date: string;
  chassis_number: string;
  engine_number: string;
  fuel_type: FuelType | string;
  colour?: string;
  color?: string;
  seating_capacity: number;
  load_capacity_kg: number;
  gross_vehicle_weight_kg: number;
  unladen_weight_kg: number;
  axles_count: number;
  wheel_base_mm?: number;
  owner_name: string;
  owner_phone: string;
  owner_address?: string;
  rto_office: string;
  rto_code: string;
  state: string;
  district?: string;
  usage_type: string;
  status: VehicleStatus;
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  odometer_reading: number;
  fuel_tank_capacity?: number;
  current_fuel_level?: number;
  fuel_efficiency?: number;
  battery_capacity?: number;
  charging_type?: string;
  electric_range_km?: number;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_license?: string;
  driver_rating?: number;
  fleet_id?: string;
  fleet_name?: string;
  fleet_color?: string;
  insurance_provider?: string;
  policy_number?: string;
  fastag_id?: string;
  route_name?: string;
  goods_type?: string;
  photo_url?: string;
  profile_image_url?: string;
  profileImageUrl?: string;
  image_url?: string;
  imageUrl?: string;
  back_photo_url?: string;
  side_photo_url?: string;
  document_photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Computed summary fields for lists
  insurance_expiry?: string;
  insurance_status?: string;
  puc_expiry?: string;
  puc_status?: string;
  fitness_expiry?: string;
  fitness_status?: string;
  permit_expiry?: string;
  permit_status?: string;
  fastag_balance?: number;
  fastag_status?: string;
  pending_challans_count?: number;
  current_location_name?: string;
  current_latitude?: number;
  current_longitude?: number;
  location_updated_at?: string;
}

export interface RTORecord {
  id: string;
  vehicle_id: string;
  rc_number: string;
  registration_date: string;
  registration_validity: string;
  rto_office: string;
  rto_code: string;
  owner_name: string;
  owner_phone?: string;
  owner_address?: string;
  vehicle_class: string;
  fuel_type: string;
  chassis_number: string;
  engine_number: string;
  tax_valid_upto?: string;
  permit_valid_upto?: string;
  fitness_valid_upto?: string;
  hypothecation_bank?: string;
  hypothecation_status?: string;
  rto_contact_info?: string;
  document_url?: string;
  status: string;
}

export interface InsuranceRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  insurance_company: string;
  policy_number: string;
  insurance_type: string;
  policy_start_date: string;
  policy_expiry_date: string;
  premium_amount: number;
  insured_declared_value: number;
  agent_name?: string;
  agent_contact?: string;
  claim_details?: string;
  claim_count?: number;
  policy_document_url?: string;
  status: string;
  days_remaining?: number;
  calculated_status?: string;
}

export interface PUCRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  certificate_number: string;
  issue_date: string;
  expiry_date: string;
  testing_center: string;
  emission_reading?: string;
  fuel_type: string;
  certificate_document_url?: string;
  status: string;
  days_remaining?: number;
  calculated_status?: string;
}

export interface FitnessRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  certificate_number: string;
  issue_date: string;
  expiry_date: string;
  inspection_date: string;
  testing_center: string;
  vehicle_class: string;
  certificate_document_url?: string;
  status: string;
  notes?: string;
  days_remaining?: number;
  calculated_status?: string;
}

export interface PermitRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  permit_number: string;
  permit_type: string;
  issue_date: string;
  expiry_date: string;
  issuing_authority: string;
  permit_area: string;
  permit_document_url?: string;
  fee_paid?: number;
  status: string;
  days_remaining?: number;
  calculated_status?: string;
}

export interface RoadTaxRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  tax_type: string;
  tax_amount: number;
  payment_date: string;
  next_due_date: string;
  receipt_number: string;
  payment_mode: string;
  tax_document_url?: string;
  status: string;
  days_remaining?: number;
  calculated_status?: string;
}

export interface FASTagRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  fastag_id: string;
  issuer_bank: string;
  wallet_balance: number;
  minimum_balance: number;
  linked_mobile_number: string;
  status: string;
  last_recharge_date?: string;
  last_recharge_amount?: number;
  last_transaction_date?: string;
  total_transactions?: number;
  total_toll_spent?: number;
}

export interface FASTagTransaction {
  id: string;
  fastag_id: string;
  vehicle_id: string;
  vehicle_number?: string;
  toll_plaza_name: string;
  location?: string;
  transaction_date: string;
  amount: number;
  balance_after: number;
  lane_number?: string;
  status: string;
}

export interface Challan {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  challan_number: string;
  date: string;
  time: string;
  location: string;
  offence: string;
  amount: number;
  due_date: string;
  payment_status: 'Pending' | 'Paid' | 'Overdue' | 'Disputed';
  payment_date?: string;
  receipt_number?: string;
  challan_document_url?: string;
  notes?: string;
}

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  service_date: string;
  service_type: string;
  current_odometer: number;
  next_service_odometer: number;
  next_service_date: string;
  mechanic_name?: string;
  workshop_name: string;
  parts_changed?: string;
  labour_cost: number;
  parts_cost: number;
  total_cost: number;
  service_notes?: string;
  invoice_document_url?: string;
  service_status: string;
}

export interface FuelRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type?: string;
  driver_id?: string;
  driver_name?: string;
  fuel_type: string;
  date: string;
  fuel_station: string;
  quantity_litres: number;
  price_per_litre: number;
  total_amount: number;
  odometer_reading: number;
  km_per_litre?: number;
  cost_per_km?: number;
  payment_method: string;
  receipt_url?: string;
  notes?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  booking_date?: string;
  customer_id?: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string;
  customer_address?: string;
  vehicle_id: string;
  vehicle_number?: string;
  vehicle_type: string;
  vehicle_category?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_colour?: string;
  vehicle_fuel_type?: string;
  vehicle_owner_name?: string;
  vehicle_owner_phone?: string;
  vehicle_photo_url?: string;
  vehicle_image_url?: string;
  profile_image_url?: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_availability?: string;
  driver_license?: string;
  driver_license_type?: string;
  pickup_location: string;
  drop_location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  trip_type: string;
  passenger_or_goods_details?: string;
  distance_km: number;
  estimated_fuel_litres: number;
  booking_amount: number;
  advance_amount: number;
  remaining_amount: number;
  payment_status: string;
  booking_status: 'Pending' | 'Confirmed' | 'Assigned' | 'Started' | 'Completed' | 'Cancelled';
  actual_start_date?: string;
  actual_start_time?: string;
  actual_end_date?: string;
  actual_end_time?: string;
  trip_duration?: string;
  special_instructions?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface BookingsSummary {
  totalRevenue: number;
  totalAdvance: number;
  totalRemaining: number;
  totalTrips: number;
  confirmedTrips: number;
  startedTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  todayTrips: number;
  upcomingTrips: number;
  activeTrips: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  license_number: string;
  license_type: string;
  license_issue_date: string;
  license_expiry_date: string;
  badge_number?: string;
  experience_years: number;
  assigned_vehicle_id?: string;
  assigned_vehicle_number?: string;
  assigned_vehicle_type?: string;
  assigned_vehicle_make?: string;
  assigned_vehicle_model?: string;
  assigned_vehicle_photo_url?: string;
  assigned_vehicle_image_url?: string;
  emergency_contact?: string;
  blood_group?: string;
  rating: number;
  status: string;
  availability?: string;
  driver_name?: string;
  driver_type?: string;
  expiry_date?: string;
  license_days_remaining?: number;
  license_status?: string;
  license_document_url?: string;
  photo_url?: string;
  profile_image_url?: string;
  profileImageUrl?: string;
  image_url?: string;
  imageUrl?: string;
  current_location_name?: string;
  current_latitude?: number;
  current_longitude?: number;
  latitude?: number | null;
  longitude?: number | null;
  tracking_status?: string;
  gps_status?: string;
  is_tracking?: number;
  location_source?: string;
  location_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TripLocation {
  id: string;
  booking_id?: string;
  driver_id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  location_name?: string;
  source?: 'GPS' | 'MANUAL';
  notes?: string;
  recorded_at: string;
  created_at: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
}

export interface DriverLocationStatus {
  driver_id: string;
  driver_name?: string;
  driver_name_full?: string;
  driver_phone?: string;
  driver_photo_url?: string;
  driver_license?: string;
  driver_status?: string;
  vehicle_id?: string;
  vehicle_number?: string;
  vehicle_type?: string;
  fuel_type?: string;
  make?: string;
  model?: string;
  vehicle_photo_url?: string;
  vehicle_status?: string;
  booking_id?: string;
  booking_number?: string;
  customer_name?: string;
  customer_mobile?: string;
  pickup_location?: string;
  drop_location?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  booking_amount?: number;
  advance_amount?: number;
  remaining_amount?: number;
  distance_km?: number;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  location_name?: string;
  source?: 'GPS' | 'MANUAL';
  location_source?: string;
  notes?: string;
  is_tracking: number;
  tracking_status?: string;
  gps_status?: string;
  is_live_gps?: boolean;
  is_delayed?: boolean;
  trip_status?: string;
  last_updated: string;
  location_updated_at?: string;
  minutes_since_update?: number;
  is_signal_delayed?: boolean;
  status_label?: string;
}

export interface TyreRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  tyre_position: string;
  brand: string;
  model?: string;
  size: string;
  purchase_date: string;
  purchase_cost: number;
  installation_date: string;
  current_km: number;
  expected_km: number;
  replacement_date?: string;
  condition: string;
}

export interface BatteryRecord {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  battery_number: string;
  brand: string;
  model?: string;
  purchase_date: string;
  warranty_expiry: string;
  installation_date: string;
  current_condition: string;
  replacement_date?: string;
  cost: number;
}

export interface Expense {
  id: string;
  vehicle_id?: string;
  vehicle_number?: string;
  registration_number?: string;
  driver_id?: string;
  driver_name?: string;
  category: string;
  amount: number;
  date?: string;
  expense_date?: string;
  payment_mode?: string;
  payment_method?: string;
  invoice_ref?: string;
  vendor_name?: string;
  description?: string;
  notes?: string;
  receipt_url?: string;
  approved_by?: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  reference_type: string;
  reference_id?: string;
  vehicle_id?: string;
  vehicle_number?: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  transaction_id?: string;
  status: string;
  notes?: string;
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  vehicle_number?: string;
  document_type: string;
  document_name: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  file_url: string;
  file_size_kb: number;
  status: string;
  days_remaining?: number;
  notes?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  vehicle_id?: string;
  vehicle_number?: string;
  title: string;
  message: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'URGENT' | 'EXPIRED';
  is_read: number;
  action_url?: string;
  created_at: string;
}

export interface NotificationSettings {
  id: string;
  insurance_reminder_days: number;
  puc_reminder_days: number;
  fitness_reminder_days: number;
  permit_reminder_days: number;
  road_tax_reminder_days: number;
  driver_license_reminder_days: number;
  fastag_min_balance_threshold: number;
  service_km_threshold: number;
  maintenance_days_threshold: number;
  booking_reminder_hours: number;
  challan_reminder_days: number;
  fuel_anomaly_threshold: number;
  urgent_days_threshold: number;
  warning_days_threshold: number;
  info_days_threshold: number;
  email_alerts_enabled: number;
  sms_alerts_enabled: number;
  push_alerts_enabled: number;
  updated_at?: string;
}

export interface VehicleThresholdSettings {
  vehicle_id: string;
  insurance_reminder_days?: number | null;
  puc_reminder_days?: number | null;
  fitness_reminder_days?: number | null;
  permit_reminder_days?: number | null;
  road_tax_reminder_days?: number | null;
  fastag_min_balance_threshold?: number | null;
  service_km_threshold?: number | null;
  maintenance_days_threshold?: number | null;
  fuel_anomaly_threshold?: number | null;
  updated_at?: string;
}

export interface Fleet {
  id: string;
  name: string;
  description?: string;
  fleet_type: string;
  manager_name?: string;
  color_code?: string;
  vehicle_count?: number;
  on_trip_count?: number;
  available_count?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company_name?: string;
  gst_number?: string;
  address?: string;
  city?: string;
  state?: string;
  total_bookings?: number;
  total_spent?: number;
  notes?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name: string;
  action: string;
  entity: string;
  entityId?: string;
  entity_id?: string;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  created_at: string;
}

export interface TimelineEvent {
  type: string;
  title: string;
  date: string;
  description: string;
  badge?: string;
}

export interface Vehicle360Profile {
  vehicle: Vehicle;
  rto?: RTORecord;
  insurance?: InsuranceRecord;
  puc?: PUCRecord;
  fitness?: FitnessRecord;
  permit?: PermitRecord;
  roadTax?: RoadTaxRecord;
  fastag?: FASTagRecord;
  fastagTxns: FASTagTransaction[];
  challans: Challan[];
  serviceHistory: ServiceRecord[];
  fuelLogs: FuelRecord[];
  bookings: Booking[];
  tyres: TyreRecord[];
  batteries: BatteryRecord[];
  expenses: Expense[];
  documents: VehicleDocument[];
  notifications: NotificationItem[];
  timeline: TimelineEvent[];
}
