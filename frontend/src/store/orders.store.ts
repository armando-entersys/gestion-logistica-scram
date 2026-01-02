import { create } from 'zustand';

export interface Order {
  id: string;
  bindId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  addressRaw: {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    reference?: string;
  };
  latitude?: number;
  longitude?: number;
  status: 'DRAFT' | 'READY' | 'IN_TRANSIT' | 'DELIVERED';
  priorityLevel: 1 | 2 | 3;
  totalAmount: number;
  routePosition?: number;
  estimatedArrivalStart?: string;
  estimatedArrivalEnd?: string;
  assignedDriverId?: string;
  assignedDriver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface OrdersState {
  orders: Order[];
  selectedOrderIds: string[];
  selectedDriverId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setOrders: (orders: Order[]) => void;
  toggleOrderSelection: (orderId: string) => void;
  selectAllOrders: (orderIds: string[]) => void;
  clearSelection: () => void;
  setSelectedDriver: (driverId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  selectedOrderIds: [],
  selectedDriverId: null,
  isLoading: false,
  error: null,

  setOrders: (orders) => set({ orders }),

  toggleOrderSelection: (orderId) =>
    set((state) => ({
      selectedOrderIds: state.selectedOrderIds.includes(orderId)
        ? state.selectedOrderIds.filter((id) => id !== orderId)
        : [...state.selectedOrderIds, orderId],
    })),

  selectAllOrders: (orderIds) => set({ selectedOrderIds: orderIds }),

  clearSelection: () => set({ selectedOrderIds: [], selectedDriverId: null }),

  setSelectedDriver: (driverId) => set({ selectedDriverId: driverId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      ),
    })),
}));
