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

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  validateResetToken: (token: string) =>
    api.get('/auth/validate-reset-token', { params: { token } }),
};

// Orders API
export const ordersApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/orders', { params }),

  getById: (id: string) =>
    api.get(`/orders/${id}`),

  getStats: (startDate?: string, endDate?: string) =>
    api.get('/orders/stats/dashboard', { params: { startDate, endDate } }),

  exportReport: (startDate: string, endDate: string) =>
    api.get('/orders/report/export', { params: { startDate, endDate } }),

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

  assignCarrier: (
    orderIds: string[],
    carrierType: string,
    carrierName?: string,
    trackingNumber?: string,
    deliveryDate?: string,
    deliveryTime?: string
  ) =>
    api.post('/orders/assign-carrier', { orderIds, carrierType, carrierName, trackingNumber, deliveryDate, deliveryTime }),

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

  // Address change requests (for IN_TRANSIT orders)
  requestAddressChange: (orderId: string, newAddress: {
    street?: string;
    number?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    reference?: string;
  }) =>
    api.post('/orders/address-change-request', { orderId, newAddress }),

  getAddressChangeRequests: () =>
    api.get('/orders/address-change-requests'),

  respondToAddressChange: (requestId: string, approved: boolean, rejectionReason?: string) =>
    api.patch(`/orders/address-change-request/${requestId}/respond`, { approved, rejectionReason }),

  // Return order (driver)
  returnOrder: (orderId: string, reason: string, notes?: string) =>
    api.post('/orders/return', { orderId, reason, notes }),

  // Update promised date (F. Pedido)
  updatePromisedDate: (orderId: string, promisedDate: string) =>
    api.patch('/orders/promised-date', { orderId, promisedDate }),

  // Return orders to purchasing for review/cancellation
  returnToPurchasing: (orderIds: string[], reason?: string) =>
    api.post('/orders/return-to-purchasing', { orderIds, reason }),

  // Cancel orders (DRAFT or RETURNED_TO_PURCHASING only)
  cancelOrders: (orderIds: string[], reason?: string) =>
    api.post('/orders/cancel', { orderIds, reason }),
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
  // Inicia sync asíncrono de PEDIDOS, retorna jobId
  // date: fecha de facturas a sincronizar (YYYY-MM-DD), si no se especifica usa hoy
  syncBind: (date?: string) =>
    api.post<{ success: boolean; jobId: string; date: string; message: string }>('/sync/bind', { date }),

  // Inicia sync asíncrono de CLIENTES, retorna jobId
  syncClients: () =>
    api.post<{ success: boolean; jobId: string; message: string }>('/sync/clients'),

  // Consulta estado del job
  getSyncStatus: (jobId: string) =>
    api.get<{
      jobId: string;
      status: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found';
      progress: number;
      result?: {
        success: boolean;
        synced?: number; // Para sync de clientes
        clients?: { synced: number }; // Para sync de pedidos
        orders?: { created: number; updated: number; errors: string[] };
        message: string;
      };
      failedReason?: string;
    }>(`/sync/status/${jobId}`),

  // Polling helper: espera a que el job termine
  waitForSync: async (jobId: string, onProgress?: (progress: number) => void): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> => {
    const maxAttempts = 120; // 4 minutos máximo (120 * 2s)
    let attempts = 0;

    while (attempts < maxAttempts) {
      const { data } = await syncApi.getSyncStatus(jobId);

      if (onProgress && typeof data.progress === 'number') {
        onProgress(data.progress);
      }

      if (data.status === 'completed') {
        return { success: true, result: data.result };
      }

      if (data.status === 'failed') {
        return { success: false, error: data.failedReason || 'Sync failed' };
      }

      if (data.status === 'not_found') {
        return { success: false, error: 'Job not found' };
      }

      // Wait 2 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    return { success: false, error: 'Timeout: sync took too long' };
  },

  syncExcel: (orders: any[]) =>
    api.post('/sync/excel', { orders }),

  syncClientAddresses: (clientBindId: string, clientNumber: string) =>
    api.post('/sync/client-addresses', { clientBindId, clientNumber }),
};

// Routes API
export const routesApi = {
  getPlanning: () =>
    api.get('/routes/planning'),

  getActive: () =>
    api.get('/routes/active'),

  getNearby: (lat: number, lng: number, radius?: number) =>
    api.get('/routes/nearby', { params: { lat, lng, radius } }),

  // Route optimization with Google Routes API
  optimize: (orderIds: string[], options?: { startTime?: string; respectPriority?: boolean }) =>
    api.post<{
      success: boolean;
      optimization: {
        originalSequence: string[];
        optimizedSequence: string[];
        totalDistanceKm: number;
        originalDistanceKm: number;
        totalDurationMinutes: number;
        savingsPercent: number;
        savingsKm: number;
        legs: Array<{
          orderId: string;
          position: number;
          distanceKm: number;
          durationMinutes: number;
          etaStart: string;
          etaEnd: string;
          clientName: string;
          address: string;
          priority: number;
        }>;
      };
      warnings: string[];
    }>('/routes/optimize', {
      orderIds,
      startTime: options?.startTime || '09:00',
      respectPriority: options?.respectPriority ?? true,
    }),

  applyOptimization: (optimizedOrderIds: string[], startTime?: string) =>
    api.post<{ success: boolean; applied: number }>('/routes/optimize/apply', {
      optimizedOrderIds,
      startTime: startTime || '09:00',
    }),
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

  getDetails: (id: string) =>
    api.get(`/clients/${id}/details`),

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
