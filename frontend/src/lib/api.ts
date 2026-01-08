import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getProfile: () => api.get('/auth/me'),

  refresh: () => api.post('/auth/refresh'),
};

// Orders API
export const ordersApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/orders', { params }),

  getById: (id: string) =>
    api.get(`/orders/${id}`),

  getStats: () =>
    api.get('/orders/stats/dashboard'),

  assign: (driverId: string, orderIds: string[]) =>
    api.post('/orders/assign', { driverId, orderIds }),

  dispatch: (driverId: string, orderIds: string[], startTime?: string) =>
    api.post('/orders/dispatch', { driverId, orderIds, startTime }),

  updateLocation: (orderId: string, latitude: number, longitude: number) =>
    api.patch('/orders/location', { orderId, latitude, longitude }),

  markDelivered: (orderId: string, evidence: { type: string; storageKey: string }) =>
    api.patch(`/orders/${orderId}/deliver`, evidence),

  track: (hash: string) =>
    api.get(`/orders/track/${hash}`),

  submitCsat: (hash: string, score: number, feedback?: string) =>
    api.post(`/orders/track/${hash}/csat`, { score, feedback }),

  release: (orderIds: string[]) =>
    api.post('/orders/release', { orderIds }),

  revert: (orderIds: string[]) =>
    api.post('/orders/revert', { orderIds }),

  deleteDraft: (orderIds: string[]) =>
    api.post('/orders/delete-draft', { orderIds }),

  getCarrierTypes: () =>
    api.get('/orders/carrier-types'),

  assignCarrier: (orderIds: string[], carrierType: string, carrierName?: string, trackingNumber?: string) =>
    api.post('/orders/assign-carrier', { orderIds, carrierType, carrierName, trackingNumber }),

  geocodePending: () =>
    api.post('/orders/geocode-pending'),

  updateAddress: (orderId: string, addressRaw: {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    reference?: string;
  }, geocode: boolean = true) =>
    api.patch('/orders/address', { orderId, addressRaw, geocode }),
};

// Users API
export const usersApi = {
  getDrivers: () =>
    api.get('/users/drivers'),

  getAll: () =>
    api.get('/users'),
};

// Sync API
export const syncApi = {
  syncBind: () =>
    api.post('/sync/bind'),

  syncExcel: (orders: any[]) =>
    api.post('/sync/excel', { orders }),

  getOrphanInvoices: () =>
    api.get('/sync/orphan-invoices'),

  dismissInvoice: (bindInvoiceId: string, invoiceNumber: string, clientName: string, total: number, reason?: string) =>
    api.post('/sync/dismiss-invoice', { bindInvoiceId, invoiceNumber, clientName, total, reason }),

  getDismissedInvoices: () =>
    api.get('/sync/dismissed-invoices'),

  restoreInvoice: (bindInvoiceId: string) =>
    api.delete(`/sync/dismissed-invoice/${bindInvoiceId}`),
};

// Routes API
export const routesApi = {
  getPlanning: () =>
    api.get('/routes/planning'),

  getActive: () =>
    api.get('/routes/active'),

  getNearby: (lat: number, lng: number, radius?: number) =>
    api.get('/routes/nearby', { params: { lat, lng, radius } }),
};

// Clients API
export const clientsApi = {
  getAll: (params?: { search?: string; isVip?: boolean; page?: number; limit?: number }) =>
    api.get('/clients', { params }),

  getStats: () =>
    api.get('/clients/stats'),

  getById: (id: string) =>
    api.get(`/clients/${id}`),

  getByClientNumber: (clientNumber: string) =>
    api.get(`/clients/number/${encodeURIComponent(clientNumber)}`),

  create: (data: {
    clientNumber: string;
    name: string;
    email?: string;
    phone?: string;
    rfc?: string;
    category?: string;
    notes?: string;
    isVip?: boolean;
  }) => api.post('/clients', data),

  update: (id: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    rfc?: string;
    category?: string;
    notes?: string;
    isVip?: boolean;
  }) => api.patch(`/clients/${id}`, data),

  delete: (id: string) =>
    api.delete(`/clients/${id}`),
};

// Client Addresses API
export const clientAddressesApi = {
  getByClient: (clientNumber: string) =>
    api.get(`/client-addresses/${encodeURIComponent(clientNumber)}`),

  create: (data: {
    clientNumber: string;
    label?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    reference?: string;
    isDefault?: boolean;
  }) => api.post('/client-addresses', data),

  setDefault: (id: string, clientNumber: string) =>
    api.patch(`/client-addresses/${id}/default`, { clientNumber }),

  updateLabel: (id: string, label: string) =>
    api.patch(`/client-addresses/${id}/label`, { label }),

  delete: (id: string) =>
    api.delete(`/client-addresses/${id}`),
};
