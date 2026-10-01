import type {
  Vehicle, Vehicle360Profile, RTORecord, InsuranceRecord, PUCRecord,
  FitnessRecord, PermitRecord, RoadTaxRecord, FASTagRecord, FASTagTransaction,
  Challan, ServiceRecord, FuelRecord, Booking, BookingsSummary, Driver, TyreRecord,
  BatteryRecord, Expense, Payment, VehicleDocument, NotificationItem,
  NotificationSettings, VehicleThresholdSettings, Fleet, Customer, AuditLog, User,
  TripLocation, DriverLocationStatus
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('smartfleet_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>)
    }
  });

  if (!response.ok) {
    if (response.status === 401 && url !== '/auth/login' && url !== '/auth/me' && url !== '/auth/logout') {
      localStorage.removeItem('smartfleet_token');
      sessionStorage.removeItem('smartfleet_token');
      window.dispatchEvent(new CustomEvent('smartfleet:unauthorized'));
    }
    const errorData = await response.json().catch(() => ({ error: 'Network request failed' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) => fetchJson<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => fetchJson<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' }),
  getMe: () => fetchJson<{ user: any }>('/auth/me'),
  updateProfile: (data: { name?: string; phone?: string; mobile?: string; avatar_url?: string; profileImage?: string; currentPassword?: string; newPassword?: string; role?: string }) => fetchJson<{ message: string; user: any }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  switchRole: (role: string) => fetchJson<{ token: string; user: any }>('/auth/switch-role', { method: 'POST', body: JSON.stringify({ role }) }),

  // User Management (Super Admin)
  getUsers: (params?: { search?: string; role?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<User[]>(`/users${query ? `?${query}` : ''}`);
  },
  createUser: (data: Partial<User> & { password: string }) => fetchJson<{ message: string; id: string }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<User>) => fetchJson<{ message: string }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateUserStatus: (id: string, status: string) => fetchJson<{ message: string }>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  resetUserPassword: (id: string, new_password: string) => fetchJson<{ message: string }>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password }) }),
  deleteUser: (id: string) => fetchJson<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardStats: () => fetchJson<any>('/dashboard/stats'),

  // Uploads & Storage
  uploadImage: async (file: File, vehicleId?: string): Promise<{ url: string; imageUrl: string; profileImageUrl: string; filename: string }> => {
    const token = localStorage.getItem('smartfleet_token');
    const formData = new FormData();
    formData.append('image', file);
    if (vehicleId) {
      formData.append('vehicleId', vehicleId);
    }
    const headers: Record<string, string> = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const response = await fetch(`${API_BASE}/uploads/image`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  deleteUploadedFile: async (url: string): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>('/uploads/file', {
      method: 'DELETE',
      body: JSON.stringify({ url })
    });
  },

  // Vehicles
  getVehicles: (params?: { status?: string; type?: string; fuel?: string; fleet_id?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<Vehicle[]>(`/vehicles${query ? `?${query}` : ''}`);
  },
  getVehicle360: (id: string) => fetchJson<Vehicle360Profile>(`/vehicles/${id}`),
  registerVehicle: async (data: Partial<Vehicle> | FormData): Promise<{ message: string; id: string; profile_image_url?: string }> => {
    const token = localStorage.getItem('smartfleet_token');
    const isFormData = data instanceof FormData;
    const headers: Record<string, string> = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  updateVehicle: async (id: string, data: Partial<Vehicle> | FormData): Promise<{ message: string; profile_image_url?: string }> => {
    const token = localStorage.getItem('smartfleet_token');
    const isFormData = data instanceof FormData;
    const headers: Record<string, string> = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers,
      body: isFormData ? data : JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  updateVehicleStatus: (id: string, status: string) => fetchJson<{ message: string }>(`/vehicles/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateVehicleImage: async (id: string, image: string | File | null): Promise<{ message: string; profile_image_url: string | null }> => {
    const token = localStorage.getItem('smartfleet_token');
    const headers: Record<string, string> = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    let body: any;
    if (image instanceof File) {
      const fd = new FormData();
      fd.append('image', image);
      body = fd;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ profile_image_url: image });
    }

    const response = await fetch(`${API_BASE}/vehicles/${id}/image`, {
      method: 'PATCH',
      headers,
      body
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Image update failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  deleteVehicle: (id: string) => fetchJson<{ message: string }>(`/vehicles/${id}`, { method: 'DELETE' }),

  // Compliance Hubs
  getRTO: () => fetchJson<RTORecord[]>('/rto'),
  updateRTO: (data: Partial<RTORecord>) => fetchJson<{ message: string }>('/rto', { method: 'POST', body: JSON.stringify(data) }),
  deleteRTO: (id: string) => fetchJson<{ message: string }>(`/rto/${id}`, { method: 'DELETE' }),
  deleteRto: (id: string) => fetchJson<{ message: string }>(`/rto/${id}`, { method: 'DELETE' }),

  getInsurance: () => fetchJson<InsuranceRecord[]>('/insurance'),
  addInsurance: (data: Partial<InsuranceRecord>) => fetchJson<{ message: string; id: string }>('/insurance', { method: 'POST', body: JSON.stringify(data) }),
  deleteInsurance: (id: string) => fetchJson<{ message: string }>(`/insurance/${id}`, { method: 'DELETE' }),

  getPUC: () => fetchJson<PUCRecord[]>('/puc'),
  addPUC: (data: Partial<PUCRecord>) => fetchJson<{ message: string; id: string }>('/puc', { method: 'POST', body: JSON.stringify(data) }),
  deletePUC: (id: string) => fetchJson<{ message: string }>(`/puc/${id}`, { method: 'DELETE' }),
  deletePuc: (id: string) => fetchJson<{ message: string }>(`/puc/${id}`, { method: 'DELETE' }),

  getFitness: () => fetchJson<FitnessRecord[]>('/fitness'),
  addFitness: (data: Partial<FitnessRecord>) => fetchJson<{ message: string; id: string }>('/fitness', { method: 'POST', body: JSON.stringify(data) }),
  deleteFitness: (id: string) => fetchJson<{ message: string }>(`/fitness/${id}`, { method: 'DELETE' }),

  getPermits: () => fetchJson<PermitRecord[]>('/permits'),
  addPermit: (data: Partial<PermitRecord>) => fetchJson<{ message: string; id: string }>('/permits', { method: 'POST', body: JSON.stringify(data) }),
  deletePermit: (id: string) => fetchJson<{ message: string }>(`/permits/${id}`, { method: 'DELETE' }),

  getRoadTax: () => fetchJson<RoadTaxRecord[]>('/road-tax'),
  payRoadTax: (data: Partial<RoadTaxRecord>) => fetchJson<{ message: string; id: string }>('/road-tax', { method: 'POST', body: JSON.stringify(data) }),
  deleteRoadTax: (id: string) => fetchJson<{ message: string }>(`/road-tax/${id}`, { method: 'DELETE' }),

  // FASTag
  getFASTags: () => fetchJson<FASTagRecord[]>('/fastag'),
  addFASTag: (data: Partial<FASTagRecord>) => fetchJson<{ message: string; id: string }>('/fastag', { method: 'POST', body: JSON.stringify(data) }),
  deleteFASTag: (id: string) => fetchJson<{ message: string }>(`/fastag/${id}`, { method: 'DELETE' }),
  deleteFastag: (id: string) => fetchJson<{ message: string }>(`/fastag/${id}`, { method: 'DELETE' }),
  getFASTagTransactions: (vehicle_id?: string) => fetchJson<FASTagTransaction[]>(`/fastag/transactions${vehicle_id ? `?vehicle_id=${vehicle_id}` : ''}`),
  rechargeFASTag: (data: { vehicle_id: string; amount: number; payment_mode?: string }) => fetchJson<{ message: string; newBalance: number }>('/fastag/recharge', { method: 'POST', body: JSON.stringify(data) }),
  deleteFASTagTransaction: (txnId: string) => fetchJson<{ message: string }>(`/fastag/transactions/${txnId}`, { method: 'DELETE' }),
  deleteFastagTransaction: (txnId: string) => fetchJson<{ message: string }>(`/fastag/transactions/${txnId}`, { method: 'DELETE' }),

  // Challans
  getChallans: (params?: { status?: string; vehicle_id?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<Challan[]>(`/challans${query ? `?${query}` : ''}`);
  },
  addChallan: (data: Partial<Challan>) => fetchJson<{ message: string; id: string }>('/challans', { method: 'POST', body: JSON.stringify(data) }),
  payChallan: (id: string, data: { payment_mode?: string; receipt_number?: string }) => fetchJson<{ message: string }>(`/challans/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
  deleteChallan: (id: string) => fetchJson<{ message: string }>(`/challans/${id}`, { method: 'DELETE' }),

  // Service & Mechanical
  getServices: (vehicle_id?: string) => fetchJson<ServiceRecord[]>(`/service${vehicle_id ? `?vehicle_id=${vehicle_id}` : ''}`),
  addService: (data: Partial<ServiceRecord>) => fetchJson<{ message: string; id: string }>('/service', { method: 'POST', body: JSON.stringify(data) }),
  deleteService: (id: string) => fetchJson<{ message: string }>(`/service/${id}`, { method: 'DELETE' }),

  // Fuel Management
  getFuelLogs: (params?: { vehicle_id?: string; driver_id?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<FuelRecord[]>(`/fuel${query ? `?${query}` : ''}`);
  },
  getFuelAnalytics: () => fetchJson<any>('/fuel/analytics'),
  addFuelLog: (data: Partial<FuelRecord>) => fetchJson<{ message: string; id: string; km_per_litre?: number }>('/fuel', { method: 'POST', body: JSON.stringify(data) }),
  deleteFuelLog: (id: string) => fetchJson<{ message: string }>(`/fuel/${id}`, { method: 'DELETE' }),

  // Bookings & Trips
  getBookings: (params?: { status?: string; search?: string; vehicle_id?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<Booking[]>(`/bookings${query ? `?${query}` : ''}`);
  },
  getBooking: (id: string) => fetchJson<Booking>(`/bookings/${id}`),
  getBookingsSummary: () => fetchJson<BookingsSummary>('/bookings/summary'),
  createBooking: (data: Partial<Booking>) => fetchJson<{ message: string; bookingNumber: string; id: string }>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: Partial<Booking>) => fetchJson<{ message: string; id: string }>(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateBookingStatus: (id: string, status: string) => fetchJson<{ message: string }>(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  startTrip: (id: string, data?: { actual_start_date?: string; actual_start_time?: string }) => fetchJson<{ message: string; booking: Booking }>(`/bookings/${id}/start`, { method: 'POST', body: JSON.stringify(data || {}) }),
  endTrip: (id: string, data?: { actual_end_date?: string; actual_end_time?: string }) => fetchJson<{ message: string; booking: Booking }>(`/bookings/${id}/end`, { method: 'POST', body: JSON.stringify(data || {}) }),
  deleteBooking: (id: string) => fetchJson<{ message: string }>(`/bookings/${id}`, { method: 'DELETE' }),

  // Drivers
  getDrivers: () => fetchJson<Driver[]>('/drivers'),
  getDriver: (id: string) => fetchJson<{ driver: Driver; activeTrip: any; recentLocations: TripLocation[] }>(`/drivers/${id}`),
  addDriver: (data: Partial<Driver>) => fetchJson<{ message: string; id: string }>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  createDriver: (data: Partial<Driver>) => fetchJson<{ message: string; id: string }>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: string, data: Partial<Driver>) => fetchJson<{ message: string }>(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assignDriverVehicle: (driver_id: string, vehicle_id?: string) => fetchJson<{ message: string }>(`/drivers/${driver_id}/assign-vehicle`, { method: 'PATCH', body: JSON.stringify({ vehicle_id: vehicle_id || '' }) }),
  deleteDriver: (id: string) => fetchJson<{ message: string }>(`/drivers/${id}`, { method: 'DELETE' }),

  // Tyres & Batteries
  getTyres: (vehicle_id?: string) => fetchJson<TyreRecord[]>(`/tyres${vehicle_id ? `?vehicle_id=${vehicle_id}` : ''}`),
  addTyre: (data: Partial<TyreRecord>) => fetchJson<{ message: string; id: string }>('/tyres', { method: 'POST', body: JSON.stringify(data) }),
  deleteTyre: (id: string) => fetchJson<{ message: string }>(`/tyres/${id}`, { method: 'DELETE' }),
  getBatteries: (vehicle_id?: string) => fetchJson<BatteryRecord[]>(`/batteries${vehicle_id ? `?vehicle_id=${vehicle_id}` : ''}`),
  addBattery: (data: Partial<BatteryRecord>) => fetchJson<{ message: string; id: string }>('/batteries', { method: 'POST', body: JSON.stringify(data) }),
  deleteBattery: (id: string) => fetchJson<{ message: string }>(`/batteries/${id}`, { method: 'DELETE' }),

  // Expenses & Ledger
  getExpenses: (params?: { category?: string; vehicle_id?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<Expense[]>(`/expenses${query ? `?${query}` : ''}`);
  },
  getExpensesSummary: () => fetchJson<any>('/expenses/summary'),
  addExpense: (data: Partial<Expense>) => fetchJson<{ message: string; id: string }>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => fetchJson<{ message: string }>(`/expenses/${id}`, { method: 'DELETE' }),

  getPayments: (params?: { status?: string; reference_type?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<Payment[]>(`/payments${query ? `?${query}` : ''}`);
  },
  recordPayment: (data: Partial<Payment>) => fetchJson<{ message: string; id: string }>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  deletePayment: (id: string) => fetchJson<{ message: string }>(`/payments/${id}`, { method: 'DELETE' }),

  // Document Vault
  getDocuments: (params?: { vehicle_id?: string; document_type?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<VehicleDocument[]>(`/documents${query ? `?${query}` : ''}`);
  },
  uploadDocument: (data: Partial<VehicleDocument>) => fetchJson<{ message: string; id: string }>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  deleteDocument: (id: string) => fetchJson<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),

  // Notification Engine & Center
  getNotifications: (params?: { unread_only?: string; severity?: string; type?: string; vehicle_id?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<{ notifications: NotificationItem[]; unreadCount: number }>(`/notifications${query ? `?${query}` : ''}`);
  },
  markNotificationRead: (id: string) => fetchJson<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => fetchJson<{ message: string }>('/notifications/mark-all-read', { method: 'POST' }),
  deleteNotification: (id: string) => fetchJson<{ message: string }>(`/notifications/${id}`, { method: 'DELETE' }),
  evaluateCompliance: () => fetchJson<{ message: string; evaluated: number; generated: number }>('/notifications/evaluate', { method: 'POST' }),
  getNotificationSettings: () => fetchJson<NotificationSettings>('/notifications/settings'),
  updateNotificationSettings: (data: Partial<NotificationSettings>) => fetchJson<{ message: string }>('/notifications/settings', { method: 'PUT', body: JSON.stringify(data) }),
  resetNotificationSettings: () => fetchJson<{ message: string }>('/notifications/settings/reset', { method: 'POST' }),
  getVehicleSettings: (vehicleId: string) => fetchJson<VehicleThresholdSettings>(`/notifications/settings/vehicle/${vehicleId}`),
  updateVehicleSettings: (vehicleId: string, data: Partial<VehicleThresholdSettings>) => fetchJson<{ message: string }>(`/notifications/settings/vehicle/${vehicleId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Reports
  generateReport: (params?: { report_type?: string; vehicle_type?: string; status?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<{ title: string; generatedAt: string; reportType: string; summary: any; data: any[] }>(`/reports/generate${query ? `?${query}` : ''}`);
  },

  // Global Search
  omnisearch: (q: string) => fetchJson<{ results: any[] }>(`/search?q=${encodeURIComponent(q)}`),

  // Fleets & Customers & Audits
  getFleets: () => fetchJson<Fleet[]>('/fleets'),
  createFleet: (data: Partial<Fleet>) => fetchJson<{ message: string; id: string }>('/fleets', { method: 'POST', body: JSON.stringify(data) }),
  deleteFleet: (id: string) => fetchJson<{ message: string }>(`/fleets/${id}`, { method: 'DELETE' }),
  getCustomers: () => fetchJson<Customer[]>('/customers'),
  createCustomer: (data: Partial<Customer>) => fetchJson<{ message: string; id: string }>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => fetchJson<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),
  getAuditLogs: (params?: { entity?: string; action?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<AuditLog[]>(`/audit-logs${query ? `?${query}` : ''}`);
  },

  // Live Driver & Vehicle GPS Tracking
  getLiveTracking: () => fetchJson<DriverLocationStatus[]>('/tracking/live'),
  getTrackingHistory: (bookingId: string) => fetchJson<{ booking: Booking; locations: TripLocation[] }>(`/tracking/history/${bookingId}`),
  getDriverLocationHistory: (driverId: string) => fetchJson<{ driver: Driver; locations: TripLocation[] }>(`/tracking/history/driver/${driverId}`),
  getDriverActiveTrip: () => fetchJson<{ driver: Driver | null; assignedVehicle: Vehicle | null; activeTrip: Booking | null }>('/tracking/driver/active-trip'),
  sendDriverLocation: (data: {
    driverId?: string;
    driver_id?: string;
    vehicleId?: string;
    vehicle_id?: string;
    tripId?: string;
    booking_id?: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    timestamp?: string;
    locationName?: string;
    location_name?: string;
  }) => fetchJson<{ success: boolean; message: string; locationId: string; timestamp: string }>('/driver-location', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendLocationUpdate: (data: {
    booking_id?: string;
    driver_id?: string;
    vehicle_id?: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    location_name?: string;
  }) => fetchJson<{ success: boolean; message: string; locationId: string }>('/tracking/locations', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTrackingStatus: (data: {
    driverId?: string;
    driver_id?: string;
    vehicleId?: string;
    vehicle_id?: string;
    status: 'ACTIVE' | 'STOPPED';
  }) => fetchJson<{ success: boolean; message: string; trackingStatus: string; isTracking: number }>('/tracking/status', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendManualLocation: (data: {
    driver_id?: string;
    vehicle_id?: string;
    phone?: string;
    location_name?: string;
    latitude?: number | null;
    longitude?: number | null;
    status?: string;
    notes?: string;
    date?: string;
    time?: string;
  }) => fetchJson<{ message: string; locationId: string; driver_name?: string; location_name?: string }>('/tracking/manual-location', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  completeTrip: (id: string) => fetchJson<{ message: string; status: string; bookingId: string }>(`/tracking/trips/${id}/complete`, { method: 'POST' }),
  getTrackingSettings: () => fetchJson<{ gps_update_interval_sec: number; gps_signal_delayed_min: number }>('/tracking/settings'),

  // Base URL helper
  getBaseUrl: () => '',

  // Namespace helper aliases for maximum interoperability
  vehicles: {
    getAll: (params?: { status?: string; type?: string; fleet_id?: string; search?: string }) => api.getVehicles(params),
    getById: (id: string) => api.getVehicle360(id),
    create: (data: Partial<Vehicle>) => api.registerVehicle(data),
    update: (id: string, data: Partial<Vehicle>) => api.updateVehicle(id, data),
    delete: (id: string) => api.deleteVehicle(id)
  },
  expenses: {
    getAll: (params?: { category?: string; vehicle_id?: string; start_date?: string; end_date?: string }) => api.getExpenses(params),
    create: (data: Partial<Expense>) => api.addExpense(data)
  }
};

export default api;
