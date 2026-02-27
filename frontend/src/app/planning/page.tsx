'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Avatar,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InventoryIcon from '@mui/icons-material/Inventory';
import BusinessIcon from '@mui/icons-material/Business';
import ClearIcon from '@mui/icons-material/Clear';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import MapIcon from '@mui/icons-material/Map';
import ListAltIcon from '@mui/icons-material/ListAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import GestureIcon from '@mui/icons-material/Gesture';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import UndoIcon from '@mui/icons-material/Undo';
import RouteIcon from '@mui/icons-material/Route';

import { useRouter } from 'next/navigation';
import { ordersApi, usersApi, clientAddressesApi, syncApi, routeStopsApi } from '@/lib/api';

const OrdersMap = dynamic(() => import('@/components/OrdersMap'), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#f1f5f9' }}>
      <CircularProgress size={32} />
    </Box>
  ),
});

const RouteOptimizationDialog = dynamic(() => import('@/components/RouteOptimizationDialog'), {
  ssr: false,
});

interface ShipmentEvidence {
  id: string;
  type: 'PHOTO' | 'SIGNATURE';
  storageKey: string;
  capturedAt?: string;
  createdAt: string;
}

interface Order {
  id: string;
  bindId: string;
  orderNumber?: string;
  clientName: string;
  clientNumber?: string;
  bindClientId?: string; // UUID del cliente en Bind ERP (para sincronizar direcciones)
  clientRfc?: string;
  clientPhone?: string;
  promisedDate?: string;
  deliveredAt?: string;
  addressRaw: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    reference?: string;
    original?: string; // Dirección original de Bind sin parsear
  };
  latitude?: number;
  longitude?: number;
  totalAmount: number;
  status: string;
  priorityLevel: number;
  assignedDriverId?: string;
  assignedDriver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  carrierType?: string;
  carrierName?: string;
  carrierTrackingNumber?: string;
  evidences?: ShipmentEvidence[];
}

interface RouteStopItem {
  id: string;
  stopType: 'PICKUP' | 'DOCUMENTATION';
  status: string;
  clientName: string;
  contactName?: string;
  contactPhone?: string;
  addressRaw?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    reference?: string;
  };
  latitude?: number;
  longitude?: number;
  description?: string;
  itemsDescription?: string;
  routePosition?: number;
  estimatedArrivalStart?: string;
  estimatedArrivalEnd?: string;
  pickupPointId?: string;
  completedAt?: string;
  completedBy?: string;
  completionNotes?: string;
  assignedDriverId?: string;
  createdAt?: string;
}

interface PickupPoint {
  id: string;
  clientId?: string;
  clientName: string;
  contactName?: string;
  contactPhone?: string;
  label?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
  useCount: number;
}

interface ClientAddress {
  id: string;
  clientNumber: string;
  label?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  source: 'SYNC' | 'MANUAL';
  useCount: number;
}

interface CarrierType {
  value: string;
  label: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
}

const priorityConfig: Record<number, { label: string; color: 'default' | 'warning' | 'error' }> = {
  1: { label: 'Normal', color: 'default' },
  2: { label: 'Alta', color: 'warning' },
  3: { label: 'Urgente', color: 'error' },
};

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' }> = {
  DRAFT: { label: 'Borrador', color: 'default' },
  READY: { label: 'Listo', color: 'info' },
  IN_TRANSIT: { label: 'En Ruta', color: 'primary' },
  DELIVERED: { label: 'Entregado', color: 'success' },
  RETURNED_TO_PURCHASING: { label: 'En Revisión', color: 'warning' },
  CANCELLED: { label: 'Cancelado', color: 'error' },
};

export default function PlanningPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<number>(0); // 0=active, 1=ready, 2=transit, 3=delivered
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
  const [selectedCarrierType, setSelectedCarrierType] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierDeliveryDate, setCarrierDeliveryDate] = useState('');
  const [carrierDeliveryTime, setCarrierDeliveryTime] = useState('');

  // Route stops state
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [newStopType, setNewStopType] = useState<'PICKUP' | 'DOCUMENTATION'>('PICKUP');
  const [newStopClientName, setNewStopClientName] = useState('');
  const [newStopContactName, setNewStopContactName] = useState('');
  const [newStopContactPhone, setNewStopContactPhone] = useState('');
  const [newStopDescription, setNewStopDescription] = useState('');
  const [newStopItemsDescription, setNewStopItemsDescription] = useState('');
  const [newStopAddress, setNewStopAddress] = useState({ street: '', number: '', neighborhood: '', city: '', state: '', postalCode: '', reference: '' });
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string>('');
  const [pickupPointSearch, setPickupPointSearch] = useState('');
  const [newStopDriverId, setNewStopDriverId] = useState<string>('');

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [missingCoordsCount, setMissingCoordsCount] = useState(0);

  // POD viewer dialog state
  const [podDialogOpen, setPodDialogOpen] = useState(false);
  const [podOrder, setPodOrder] = useState<Order | null>(null);

  // Route optimization dialog state
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);

  // Confirm delivery dialog state (for carrier orders)
  const [confirmDeliveryDialogOpen, setConfirmDeliveryDialogOpen] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
  const [deliveryEvidenceFile, setDeliveryEvidenceFile] = useState<File | null>(null);

  // Admin mark delivered dialog state
  const [adminDeliverDialogOpen, setAdminDeliverDialogOpen] = useState(false);
  const [adminDeliverComment, setAdminDeliverComment] = useState('');
  const [adminDeliverSendEmail, setAdminDeliverSendEmail] = useState(false);

  // Admin review action dialog state (for RETURNED_TO_PURCHASING orders)
  const [reviewActionDialogOpen, setReviewActionDialogOpen] = useState(false);
  const [reviewActionTarget, setReviewActionTarget] = useState<'READY' | 'IN_TRANSIT' | 'RETURNED_TO_PURCHASING'>('READY');
  const [reviewActionComment, setReviewActionComment] = useState('');

  // Parse dates without timezone shift for date-only strings (YYYY-MM-DD)
  const parseDate = (dateStr: string): Date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    return new Date(dateStr);
  };

  // Format date helper
  const formatDateShort = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = parseDate(dateStr);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = parseDate(dateStr);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Open POD viewer
  const openPodViewer = (order: Order) => {
    setPodOrder(order);
    setPodDialogOpen(true);
  };

  // Get evidence URL
  const getEvidenceUrl = (storageKey: string) => {
    // If storageKey is already a full URL (R2), return as-is
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return storageKey;
    }
    // Legacy: relative path, serve through backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${apiUrl.replace('/api/v1', '')}/storage/${storageKey}`;
  };

  // Address edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editAddress, setEditAddress] = useState({
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: '',
    reference: '',
  });
  const [saveAddressForClient, setSaveAddressForClient] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ['planning-orders'],
    queryFn: async () => {
      const response = await ordersApi.getAll({ status: 'READY,IN_TRANSIT,DELIVERED,RETURNED_TO_PURCHASING,CANCELLED', limit: 100 });
      return response.data.data || response.data;
    },
  });

  const orders: Order[] = ordersResponse || [];

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await usersApi.getDrivers();
      return response.data as Driver[];
    },
  });

  const { data: carrierTypes } = useQuery({
    queryKey: ['carrier-types'],
    queryFn: async () => {
      const response = await ordersApi.getCarrierTypes();
      return response.data as CarrierType[];
    },
  });

  // Route stops queries
  const { data: pendingStopsData, refetch: refetchPendingStops } = useQuery({
    queryKey: ['pending-route-stops'],
    queryFn: async () => {
      const response = await routeStopsApi.getPending();
      return response.data as RouteStopItem[];
    },
  });
  const pendingStops: RouteStopItem[] = pendingStopsData || [];

  const { data: completedStopsData, refetch: refetchCompletedStops } = useQuery({
    queryKey: ['completed-route-stops'],
    queryFn: async () => {
      const response = await routeStopsApi.getCompleted();
      return response.data as RouteStopItem[];
    },
  });
  const completedStops: RouteStopItem[] = completedStopsData || [];

  const { data: inTransitStopsData, refetch: refetchInTransitStops } = useQuery({
    queryKey: ['in-transit-route-stops'],
    queryFn: async () => {
      const response = await routeStopsApi.getInTransit();
      return response.data as RouteStopItem[];
    },
  });
  const inTransitStops: RouteStopItem[] = inTransitStopsData || [];

  const refetchStops = () => { refetchPendingStops(); refetchCompletedStops(); refetchInTransitStops(); };

  const { data: pickupPointsData } = useQuery({
    queryKey: ['pickup-points', pickupPointSearch],
    queryFn: async () => {
      if (pickupPointSearch) {
        const response = await routeStopsApi.searchPickupPoints(pickupPointSearch);
        return response.data as PickupPoint[];
      }
      const response = await routeStopsApi.getPickupPoints();
      return response.data as PickupPoint[];
    },
  });
  const pickupPoints: PickupPoint[] = pickupPointsData || [];

  const stats = useMemo(() => {
    const ready = orders.filter((o) => o.status === 'READY').length;
    const inTransitOrders = orders.filter((o) => o.status === 'IN_TRANSIT').length;
    const inTransit = inTransitOrders + inTransitStops.length;
    const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;
    const completedStopsCount = completedStops.filter((s) => s.status === 'COMPLETED').length;
    const delivered = deliveredOrders + completedStopsCount;
    const returnedToPurchasing = orders.filter((o) => o.status === 'RETURNED_TO_PURCHASING').length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
    const urgent = orders.filter((o) => o.priorityLevel === 3 && o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
    return { ready, inTransit, delivered, returnedToPurchasing, cancelled, urgent, active: ready + inTransitOrders };
  }, [orders, completedStops, inTransitStops]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter by tab: 0=Activos(READY), 1=En Ruta(IN_TRANSIT), 2=Entregados(DELIVERED), 3=En Revisión, 4=Cancelados
    if (statusFilter === 0) {
      result = result.filter((o) => o.status === 'READY');
    } else if (statusFilter === 1) {
      result = result.filter((o) => o.status === 'IN_TRANSIT');
    } else if (statusFilter === 2) {
      result = result.filter((o) => o.status === 'DELIVERED');
    } else if (statusFilter === 3) {
      result = result.filter((o) => o.status === 'RETURNED_TO_PURCHASING');
    } else if (statusFilter === 4) {
      result = result.filter((o) => o.status === 'CANCELLED');
    }

    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.clientName?.toLowerCase().includes(s) ||
          o.orderNumber?.toLowerCase().includes(s) ||
          o.bindId?.toLowerCase().includes(s) ||
          o.clientRfc?.toLowerCase().includes(s) ||
          o.assignedDriver?.firstName?.toLowerCase().includes(s) ||
          o.assignedDriver?.lastName?.toLowerCase().includes(s)
      );
    }

    // Sort based on status filter
    if (statusFilter === 2 || statusFilter === 4) {
      // For delivered/cancelled orders: sort by date descending (most recent first)
      result.sort((a, b) => {
        const dateA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const dateB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      // For active/in-transit/returned: urgent first, then by status
      result.sort((a, b) => {
        if (a.priorityLevel !== b.priorityLevel) return b.priorityLevel - a.priorityLevel;
        if (a.status === 'READY' && b.status !== 'READY') return -1;
        if (b.status === 'READY' && a.status !== 'READY') return 1;
        return 0;
      });
    }

    return result;
  }, [orders, search, statusFilter]);

  // Mutations
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriverId || selectedOrderIds.length === 0) throw new Error('Selecciona chofer y pedidos');
      return ordersApi.assign(selectedDriverId, selectedOrderIds);
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: `${response.data.assigned} pedidos asignados`, severity: 'success' });
      setSelectedOrderIds([]);
      setAssignDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al asignar', severity: 'error' });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriverId || (selectedOrderIds.length === 0 && selectedStopIds.length === 0)) throw new Error('Selecciona chofer y pedidos/paradas');
      return ordersApi.dispatch(selectedDriverId, selectedOrderIds, startTime, selectedStopIds.length > 0 ? selectedStopIds : undefined);
    },
    onSuccess: (response) => {
      const stopsMsg = response.data.stopsDispatched ? ` + ${response.data.stopsDispatched} paradas` : '';
      setSnackbar({
        open: true,
        message: `Ruta despachada: ${response.data.dispatched} pedidos${stopsMsg}`,
        severity: 'success',
      });
      setSelectedOrderIds([]);
      setSelectedStopIds([]);
      setSelectedDriverId('');
      setDispatchDialogOpen(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
        refetch();
      }, 500);
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al despachar', severity: 'error' });
    },
  });

  const carrierMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCarrierType || selectedOrderIds.length === 0) throw new Error('Selecciona paquetería');
      return ordersApi.assignCarrier(
        selectedOrderIds,
        selectedCarrierType,
        selectedCarrierType === 'OTHER' ? carrierName : undefined,
        trackingNumber || undefined,
        carrierDeliveryDate || undefined,
        carrierDeliveryTime || undefined
      );
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: `${response.data.assigned} pedidos asignados a paquetería`, severity: 'success' });
      setSelectedOrderIds([]);
      setSelectedCarrierType('');
      setCarrierName('');
      setTrackingNumber('');
      setCarrierDeliveryDate('');
      setCarrierDeliveryTime('');
      setCarrierDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error', severity: 'error' });
    },
  });

  // Return to Purchasing mutation
  const returnToPurchasingMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrderIds.length === 0) throw new Error('Selecciona pedidos');
      return ordersApi.returnToPurchasing(selectedOrderIds);
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: response.data.message || 'Pedidos regresados a Compras', severity: 'success' });
      setSelectedOrderIds([]);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al regresar pedidos', severity: 'error' });
    },
  });

  // Cancel orders mutation
  const cancelOrdersMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrderIds.length === 0) throw new Error('Selecciona pedidos');
      return ordersApi.cancelOrders(selectedOrderIds);
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: response.data.message || 'Pedidos cancelados', severity: 'success' });
      setSelectedOrderIds([]);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al cancelar pedidos', severity: 'error' });
    },
  });

  // Admin mark as delivered mutation
  const adminDeliverMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrderIds.length === 0) throw new Error('Selecciona pedidos');
      if (!adminDeliverComment.trim()) throw new Error('Ingresa un comentario');
      return ordersApi.adminMarkDelivered(selectedOrderIds, adminDeliverComment.trim(), adminDeliverSendEmail);
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: response.data.message || 'Pedidos marcados como entregados', severity: 'success' });
      setSelectedOrderIds([]);
      setAdminDeliverDialogOpen(false);
      setAdminDeliverComment('');
      setAdminDeliverSendEmail(false);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al marcar entrega', severity: 'error' });
    },
  });

  // Admin review action mutation (for RETURNED_TO_PURCHASING orders)
  const reviewActionMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrderIds.length === 0) throw new Error('Selecciona pedidos');
      if (!reviewActionComment.trim()) throw new Error('Ingresa un comentario');
      return ordersApi.adminReviewAction(selectedOrderIds, reviewActionTarget, reviewActionComment.trim());
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: response.data.message || 'Pedidos actualizados', severity: 'success' });
      setSelectedOrderIds([]);
      setReviewActionDialogOpen(false);
      setReviewActionComment('');
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al cambiar estado', severity: 'error' });
    },
  });

  // Create route stop mutation
  const createStopMutation = useMutation({
    mutationFn: async () => {
      if (!newStopClientName.trim()) throw new Error('Nombre de cliente requerido');
      if (!newStopDriverId) throw new Error('Selecciona un chofer');
      const response = await routeStopsApi.create({
        stopType: newStopType,
        pickupPointId: selectedPickupPointId || undefined,
        clientName: newStopClientName.trim(),
        contactName: newStopContactName.trim() || undefined,
        contactPhone: newStopContactPhone.trim() || undefined,
        addressRaw: selectedPickupPointId ? undefined : newStopAddress,
        description: newStopDescription.trim() || undefined,
        itemsDescription: newStopItemsDescription.trim() || undefined,
      });
      // Auto-dispatch: assign driver and set IN_TRANSIT immediately
      const stopId = response.data.id;
      await routeStopsApi.dispatch([stopId], newStopDriverId);
      return response;
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: `${newStopType === 'PICKUP' ? 'Recolección' : 'Visita'} creada y asignada`, severity: 'success' });
      setStopDialogOpen(false);
      setNewStopClientName('');
      setNewStopContactName('');
      setNewStopContactPhone('');
      setNewStopDescription('');
      setNewStopItemsDescription('');
      setNewStopAddress({ street: '', number: '', neighborhood: '', city: '', state: '', postalCode: '', reference: '' });
      setSelectedPickupPointId('');
      setNewStopDriverId('');
      refetchStops();
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al crear parada', severity: 'error' });
    },
  });

  // Cancel route stop mutation
  const cancelStopMutation = useMutation({
    mutationFn: async (stopId: string) => routeStopsApi.cancel(stopId),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Parada cancelada', severity: 'success' });
      refetchStops();
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error', severity: 'error' });
    },
  });

  // Confirm delivery mutation (for carrier orders)
  const confirmDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!confirmingOrder) throw new Error('No hay pedido seleccionado');

      let storageKey = '';

      // If we have evidence file, upload it first
      if (deliveryEvidenceFile) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data:image/...;base64, prefix
            resolve(base64String.split(',')[1] || base64String);
          };
          reader.readAsDataURL(deliveryEvidenceFile);
        });

        // Send to markDelivered with base64Data
        return ordersApi.markDelivered(confirmingOrder.id, {
          type: 'PHOTO',
          base64Data: base64,
        } as any);
      }

      // No evidence, just mark as delivered
      return ordersApi.markDelivered(confirmingOrder.id, {} as any);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Entrega confirmada correctamente', severity: 'success' });
      setConfirmDeliveryDialogOpen(false);
      setConfirmingOrder(null);
      setDeliveryEvidenceFile(null);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al confirmar entrega', severity: 'error' });
    },
  });

  const addressMutation = useMutation({
    mutationFn: async () => {
      if (!editingOrder) throw new Error('No hay pedido seleccionado');

      // For IN_TRANSIT orders, create a change request instead of direct update
      if (editingOrder.status === 'IN_TRANSIT') {
        const result = await ordersApi.requestAddressChange(editingOrder.id, editAddress);
        // Also save address for client if checkbox is checked
        if (saveAddressForClient && editingOrder.clientNumber) {
          await clientAddressesApi.create({
            clientNumber: editingOrder.clientNumber,
            label: newAddressLabel || undefined,
            ...editAddress,
          });
        }
        return result;
      }

      // For other statuses, update directly
      const result = await ordersApi.updateAddress(editingOrder.id, editAddress, true);

      // Also save address for client if checkbox is checked
      if (saveAddressForClient && editingOrder.clientNumber) {
        await clientAddressesApi.create({
          clientNumber: editingOrder.clientNumber,
          label: newAddressLabel || undefined,
          ...editAddress,
        });
      }

      return result;
    },
    onSuccess: (response, variables, context) => {
      if (editingOrder?.status === 'IN_TRANSIT') {
        setSnackbar({
          open: true,
          message: saveAddressForClient
            ? 'Solicitud de cambio enviada y dirección guardada para el cliente'
            : 'Solicitud de cambio enviada al chofer para aprobación',
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: saveAddressForClient
            ? 'Dirección actualizada, geocodificada y guardada para el cliente'
            : 'Dirección actualizada y geocodificada',
          severity: 'success'
        });
      }
      setEditDialogOpen(false);
      setEditingOrder(null);
      setSaveAddressForClient(false);
      setNewAddressLabel('');
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error al actualizar dirección', severity: 'error' });
    },
  });

  // Geocodificar solo (sin cerrar el modal)
  const geocodeSingleMutation = useMutation({
    mutationFn: async () => {
      if (!editingOrder) throw new Error('No hay pedido seleccionado');
      // Actualizar dirección con geocodificación
      const response = await ordersApi.updateAddress(editingOrder.id, editAddress, true);
      return response;
    },
    onSuccess: (response) => {
      const data = response.data;
      const lat = data?.latitude ? parseFloat(data.latitude) : null;
      const lng = data?.longitude ? parseFloat(data.longitude) : null;

      if (lat && lng) {
        setSnackbar({
          open: true,
          message: `Geocodificado: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          severity: 'success'
        });
        // Actualizar el pedido en edición con las nuevas coordenadas
        if (editingOrder) {
          setEditingOrder({
            ...editingOrder,
            latitude: lat,
            longitude: lng,
            addressRaw: {
              ...editingOrder.addressRaw,
              ...editAddress,
            }
          });
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Dirección guardada pero no se encontraron coordenadas',
          severity: 'warning'
        });
      }
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      console.error('Error geocodificando:', error);
      const msg = error.response?.data?.message || error.message || 'Error al geocodificar';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // Type for address option
  interface AddressOption {
    label: string;
    address: typeof editAddress;
  }

  // Parse a single address block from text
  const parseAddressBlock = (text: string): Omit<typeof editAddress, 'reference'> | null => {
    if (!text || text.length < 10) return null;

    const result = {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      postalCode: '',
    };

    // Extract postal code
    const cpMatch = text.match(/C\.?P\.?\s*(\d{5})/i);
    if (cpMatch) result.postalCode = cpMatch[1];

    // Extract neighborhood (Col. or Colonia)
    const colMatch = text.match(/Col(?:onia)?\.?\s+([^,\d]+)/i);
    if (colMatch) result.neighborhood = colMatch[1].trim();

    // Extract number
    const numMatch = text.match(/(?:No\.?|#|Num\.?)\s*(\d+[A-Z]?)/i);
    if (numMatch) result.number = numMatch[1];

    // Extract street (before number or Col)
    const streetMatch = text.match(/^([^,]+?)(?:\s+(?:No\.?|#|Num\.?)\s*\d|,|\s+Col)/i);
    if (streetMatch) result.street = streetMatch[1].trim();

    // Look for city names
    const cities = ['Ciudad de México', 'CDMX', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro', 'León', 'Mérida', 'Tijuana', 'Cancún'];
    for (const city of cities) {
      if (text.toLowerCase().includes(city.toLowerCase())) {
        result.city = city;
        break;
      }
    }

    // If we found at least street or neighborhood or postal code, return the result
    if (result.street || result.neighborhood || result.postalCode) {
      return result;
    }
    return null;
  };

  // Extract ALL possible addresses from order
  const extractAddressOptions = (order: Order): AddressOption[] => {
    const options: AddressOption[] = [];
    const reference = order.addressRaw?.reference || '';
    const originalAddress = order.addressRaw?.original || '';

    // 0. Original Bind address (if exists and different from parsed)
    if (originalAddress && originalAddress.length > 5) {
      const parsedOriginal = parseAddressBlock(originalAddress);
      if (parsedOriginal) {
        options.push({
          label: 'Dirección de Bind (original)',
          address: {
            ...parsedOriginal,
            reference: reference,
          },
        });
      } else {
        // If we couldn't parse it well, still show the original as street
        options.push({
          label: 'Dirección de Bind (original)',
          address: {
            street: originalAddress.split(',')[0]?.trim() || originalAddress,
            number: '',
            neighborhood: '',
            city: '',
            state: '',
            postalCode: '',
            reference: reference,
          },
        });
      }
    }

    // 1. Current address (if exists and different from original)
    if (order.addressRaw?.street || order.addressRaw?.neighborhood) {
      const currentAddr = {
        street: order.addressRaw?.street || '',
        number: order.addressRaw?.number || '',
        neighborhood: order.addressRaw?.neighborhood || '',
        city: order.addressRaw?.city || '',
        state: order.addressRaw?.state || '',
        postalCode: order.addressRaw?.postalCode || '',
        reference: reference,
      };

      // Check if it's different from the original option
      const isDuplicate = options.some(
        (opt) =>
          opt.address.street === currentAddr.street &&
          opt.address.neighborhood === currentAddr.neighborhood &&
          opt.address.postalCode === currentAddr.postalCode
      );

      if (!isDuplicate) {
        options.push({
          label: 'Dirección actual del pedido',
          address: currentAddr,
        });
      }
    }

    // 2. Look for "Entregar en:" pattern
    const deliveryPatterns = [
      /(?:entregar en|enviar a|direcci[oó]n de entrega)[:\s]+([^.]+)/gi,
      /(?:domicilio)[:\s]+([^.]+)/gi,
    ];

    for (const pattern of deliveryPatterns) {
      let match;
      while ((match = pattern.exec(reference)) !== null) {
        const parsed = parseAddressBlock(match[1]);
        if (parsed) {
          const isDuplicate = options.some(
            (opt) => opt.address.street === parsed.street && opt.address.neighborhood === parsed.neighborhood
          );
          if (!isDuplicate) {
            options.push({
              label: 'Dirección de entrega (comentarios)',
              address: { ...parsed, reference },
            });
          }
        }
      }
    }

    // 3. Look for addresses with postal codes in comments
    const cpMatches = Array.from(reference.matchAll(/([^.;]+C\.?P\.?\s*\d{5}[^.;]*)/gi));
    for (const match of cpMatches) {
      const parsed = parseAddressBlock(match[1]);
      if (parsed) {
        const isDuplicate = options.some(
          (opt) =>
            (opt.address.postalCode === parsed.postalCode && opt.address.neighborhood === parsed.neighborhood) ||
            (opt.address.street === parsed.street && opt.address.number === parsed.number)
        );
        if (!isDuplicate) {
          options.push({
            label: `Dirección con C.P. ${parsed.postalCode}`,
            address: { ...parsed, reference },
          });
        }
      }
    }

    // 4. Look for addresses with Colonia mentions
    const colMatches = Array.from(reference.matchAll(/([^.;]*Col(?:onia)?\.?\s+[A-Za-záéíóúñÁÉÍÓÚÑ\s]+[^.;]*)/gi));
    for (const match of colMatches) {
      const parsed = parseAddressBlock(match[1]);
      if (parsed && parsed.neighborhood) {
        const isDuplicate = options.some(
          (opt) => opt.address.neighborhood?.toLowerCase() === parsed.neighborhood?.toLowerCase()
        );
        if (!isDuplicate) {
          options.push({
            label: `Colonia ${parsed.neighborhood}`,
            address: { ...parsed, reference },
          });
        }
      }
    }

    // 5. Try parsing the entire reference as an address
    if (options.length <= 1 && reference) {
      const fullParsed = parseAddressBlock(reference);
      if (fullParsed) {
        const isDuplicate = options.some(
          (opt) => opt.address.street === fullParsed.street && opt.address.neighborhood === fullParsed.neighborhood
        );
        if (!isDuplicate) {
          options.push({
            label: 'Dirección extraída de comentarios',
            address: { ...fullParsed, reference },
          });
        }
      }
    }

    return options;
  };

  const [addressOptions, setAddressOptions] = useState<AddressOption[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<ClientAddress[]>([]);
  const [loadingSavedAddresses, setLoadingSavedAddresses] = useState(false);

  const openEditDialog = async (order: Order) => {
    setEditingOrder(order);
    const currentAddress = {
      street: order.addressRaw?.street || '',
      number: order.addressRaw?.number || '',
      neighborhood: order.addressRaw?.neighborhood || '',
      city: order.addressRaw?.city || '',
      state: order.addressRaw?.state || '',
      postalCode: order.addressRaw?.postalCode || '',
      reference: order.addressRaw?.reference || '',
    };
    setEditAddress(currentAddress);

    // Extract all possible addresses from the order
    const options = extractAddressOptions(order);
    setAddressOptions(options);

    // Reset saved addresses and save options
    setSavedAddresses([]);
    setSaveAddressForClient(false);
    setNewAddressLabel('');

    setEditDialogOpen(true);

    // Fetch saved addresses for this client if clientNumber exists
    if (order.clientNumber) {
      setLoadingSavedAddresses(true);
      try {
        // First, sync addresses from Bind if we have bindClientId (Bind UUID)
        if (order.bindClientId) {
          try {
            await syncApi.syncClientAddresses(order.bindClientId, order.clientNumber);
            console.log('Synced addresses from Bind for client', order.clientNumber);
          } catch (syncErr) {
            console.warn('Could not sync addresses from Bind:', syncErr);
            // Continue to load saved addresses even if sync fails
          }
        }

        // Then fetch saved addresses (including any newly synced from Bind)
        const response = await clientAddressesApi.getByClient(order.clientNumber);
        setSavedAddresses(response.data || []);
      } catch (err) {
        console.warn('Could not fetch saved addresses:', err);
        setSavedAddresses([]);
      } finally {
        setLoadingSavedAddresses(false);
      }
    }
  };

  const selectSavedAddress = (addr: ClientAddress) => {
    setEditAddress({
      street: addr.street || '',
      number: addr.number || '',
      neighborhood: addr.neighborhood || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postalCode || '',
      reference: editAddress.reference, // Keep original reference
    });
  };

  const deleteSavedAddress = async (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the address
    if (!confirm('¿Eliminar esta dirección?')) return;

    try {
      await clientAddressesApi.delete(addressId);
      setSavedAddresses((prev) => prev.filter((a) => a.id !== addressId));
      setSnackbar({ open: true, message: 'Dirección eliminada', severity: 'success' });
    } catch (err) {
      console.error('Error deleting address:', err);
      setSnackbar({ open: true, message: 'Error al eliminar dirección', severity: 'error' });
    }
  };

  const selectAddressOption = (option: AddressOption) => {
    setEditAddress({
      ...option.address,
      reference: editAddress.reference, // Keep original reference
    });
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    // Allow selection based on current tab
    const selectableStatuses = statusFilter === 0 ? ['READY']
      : statusFilter === 1 ? ['IN_TRANSIT']
      : statusFilter === 3 ? ['RETURNED_TO_PURCHASING']
      : [];
    const selectableIds = filteredOrders.filter((o) => selectableStatuses.includes(o.status)).map((o) => o.id);
    setSelectedOrderIds((prev) => {
      const newIds = selectableIds.filter((id) => !prev.includes(id));
      return [...prev, ...newIds];
    });
  };

  const clearSelection = () => setSelectedOrderIds([]);

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  // Calculate panel widths based on view mode
  const listWidth = viewMode === 'split' ? '50%' : viewMode === 'list' ? '100%' : '0%';
  const mapWidth = viewMode === 'split' ? '50%' : viewMode === 'map' ? '100%' : '0%';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f8fafc' }}>
      {/* Compact Header */}
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '3px solid',
          borderImage: 'linear-gradient(90deg, #ff9900 0%, #44ce6f 100%) 1',
          bgcolor: '#0e314c',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box component="img" src="/scram-logo.png" alt="SCRAM" sx={{ height: 36 }} />
            <Box
              sx={{
                width: 3,
                height: 32,
                background: 'linear-gradient(180deg, #ff9900 0%, #44ce6f 100%)',
                borderRadius: 2,
              }}
            />
            <Box>
              <Typography variant="subtitle1" fontWeight={600} color="white" lineHeight={1.2}>
                Panel de Tráfico
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Planificación y despacho
              </Typography>
            </Box>
          </Stack>

          {/* Inline Stats */}
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            <StatBadge icon={<InventoryIcon />} value={stats.ready} label="Listos" color="#6084a4" />
            <StatBadge icon={<LocalShippingIcon />} value={stats.inTransit} label="En Ruta" color="#ff9900" />
            <StatBadge icon={<CheckCircleIcon />} value={stats.delivered} label="Entregados" color="#44ce6f" />
            {stats.urgent > 0 && (
              <StatBadge icon={<WarningAmberIcon />} value={stats.urgent} label="Urgentes" color="#dc2626" />
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Actualizar">
              <IconButton onClick={() => refetch()} size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white' } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clientes">
              <IconButton onClick={() => router.push('/clientes')} size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white' } }}>
                <BusinessIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Usuarios">
              <IconButton onClick={() => router.push('/usuarios')} size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white' } }}>
                <PeopleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cerrar sesión">
              <IconButton onClick={handleLogout} size="small" sx={{ color: '#ff6b6b', '&:hover': { color: '#ff4444' } }}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Orders */}
        <Box
          sx={{
            width: listWidth,
            display: viewMode === 'map' ? 'none' : 'flex',
            flexDirection: 'column',
            borderRight: viewMode === 'split' ? '1px solid' : 'none',
            borderColor: 'divider',
            transition: 'width 0.3s',
            bgcolor: 'white',
          }}
        >
          {/* Toolbar */}
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Buscar cliente, ID, RFC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch('')}><ClearIcon fontSize="small" /></IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Tooltip title="Seleccionar todos listos">
                <IconButton size="small" onClick={selectAllVisible} color="primary">
                  <SelectAllIcon />
                </IconButton>
              </Tooltip>
              {selectedOrderIds.length > 0 && (
                <Tooltip title="Limpiar selección">
                  <IconButton size="small" onClick={clearSelection}>
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>

          {/* Tabs */}
          <Tabs
            value={statusFilter}
            onChange={(_, v) => { setStatusFilter(v); setSelectedOrderIds([]); }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': { minHeight: 40, py: 0, fontSize: '0.75rem', minWidth: 'auto', px: 1.5 },
            }}
          >
            <Tab label={`Activos (${stats.ready})`} />
            <Tab label={`En Ruta (${stats.inTransit})`} />
            <Tab label={`Entregados (${stats.delivered})`} />
            {stats.returnedToPurchasing > 0 && <Tab label={`En Revisión (${stats.returnedToPurchasing})`} />}
            {stats.cancelled > 0 && <Tab label={`Cancelados (${stats.cancelled})`} />}
          </Tabs>

          {/* Orders List - Maximum vertical space */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredOrders.length === 0 && !(statusFilter === 0 && pendingStops.length > 0) && !(statusFilter === 1 && inTransitStops.length > 0) && !(statusFilter === 2 && completedStops.filter(s => s.status === 'COMPLETED').length > 0) ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                <LocalShippingIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">No hay pedidos</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrderIds.includes(order.id)}
                    onToggle={() => toggleOrderSelection(order.id)}
                    onEdit={() => openEditDialog(order)}
                    onViewPod={() => openPodViewer(order)}
                  />
                ))}
                {/* Route Stops (shown in READY tab) */}
                {statusFilter === 0 && pendingStops.map((stop) => (
                  <Card
                    key={`stop-${stop.id}`}
                    variant="outlined"
                    sx={{
                      borderColor: selectedStopIds.includes(stop.id) ? (stop.stopType === 'PICKUP' ? 'info.main' : 'secondary.main') : 'divider',
                      borderWidth: selectedStopIds.includes(stop.id) ? 2 : 1,
                      bgcolor: selectedStopIds.includes(stop.id) ? (stop.stopType === 'PICKUP' ? 'info.50' : 'secondary.50') : 'background.paper',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedStopIds(prev =>
                        prev.includes(stop.id) ? prev.filter(id => id !== stop.id) : [...prev, stop.id]
                      );
                    }}
                  >
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Checkbox
                          size="small"
                          checked={selectedStopIds.includes(stop.id)}
                          sx={{ p: 0.5 }}
                        />
                        <Chip
                          size="small"
                          label={stop.stopType === 'PICKUP' ? 'Recolección' : 'Documentación'}
                          color={stop.stopType === 'PICKUP' ? 'info' : 'secondary'}
                          variant="filled"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{stop.clientName}</Typography>
                          {stop.addressRaw && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {[stop.addressRaw.street, stop.addressRaw.number, stop.addressRaw.neighborhood].filter(Boolean).join(' ')}
                            </Typography>
                          )}
                          {stop.description && (
                            <Typography variant="caption" color="text.disabled" noWrap display="block">{stop.description}</Typography>
                          )}
                          {stop.itemsDescription && (
                            <Typography variant="caption" color="text.secondary" noWrap display="block" fontWeight={600}>
                              {stop.stopType === 'PICKUP' ? '📥 ' : '📄 '}{stop.itemsDescription}
                            </Typography>
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => { e.stopPropagation(); cancelStopMutation.mutate(stop.id); }}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {/* Completed Route Stops (shown in Entregados tab) */}
                {statusFilter === 2 && completedStops.filter(s => s.status === 'COMPLETED').map((stop) => (
                  <Card
                    key={`stop-${stop.id}`}
                    variant="outlined"
                    sx={{ borderColor: stop.stopType === 'PICKUP' ? 'info.main' : 'secondary.main', borderWidth: 1, opacity: 0.9 }}
                  >
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <CheckCircleIcon fontSize="small" color="success" />
                        <Chip
                          size="small"
                          label={stop.stopType === 'PICKUP' ? 'Recolección' : 'Documentación'}
                          color={stop.stopType === 'PICKUP' ? 'info' : 'secondary'}
                          variant="filled"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{stop.clientName}</Typography>
                          {stop.itemsDescription && (
                            <Typography variant="caption" color="text.secondary" noWrap display="block" fontWeight={600}>
                              {stop.stopType === 'PICKUP' ? '📥 ' : '📄 '}{stop.itemsDescription}
                            </Typography>
                          )}
                          {stop.completionNotes && (
                            <Typography variant="caption" color="text.disabled" noWrap display="block">
                              Notas: {stop.completionNotes}
                            </Typography>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(stop.completedAt)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {/* In-Transit Route Stops (shown in En Ruta tab) */}
                {statusFilter === 1 && inTransitStops.map((stop) => (
                  <Card
                    key={`stop-${stop.id}`}
                    variant="outlined"
                    sx={{ borderColor: stop.stopType === 'PICKUP' ? 'info.main' : 'secondary.main', borderWidth: 1 }}
                  >
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LocalShippingIcon fontSize="small" color="warning" />
                        <Chip
                          size="small"
                          label={stop.stopType === 'PICKUP' ? 'Recolección' : 'Documentación'}
                          color={stop.stopType === 'PICKUP' ? 'info' : 'secondary'}
                          variant="filled"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{stop.clientName}</Typography>
                          {stop.itemsDescription && (
                            <Typography variant="caption" color="text.secondary" noWrap display="block" fontWeight={600}>
                              {stop.stopType === 'PICKUP' ? '📥 ' : '📄 '}{stop.itemsDescription}
                            </Typography>
                          )}
                          {stop.addressRaw && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {[stop.addressRaw.street, stop.addressRaw.number, stop.addressRaw.neighborhood].filter(Boolean).join(' ')}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>

          {/* Action Bar - Fixed at bottom */}
          <Paper
            elevation={3}
            sx={{
              p: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: '#f8fafc',
            }}
          >
            {/* Main actions for READY orders */}
            {statusFilter === 0 && (
              <Stack spacing={1}>
                {/* Route Stops buttons */}
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="info"
                    onClick={() => { setNewStopType('PICKUP'); setStopDialogOpen(true); }}
                    sx={{ flex: 1, fontSize: '0.7rem' }}
                  >
                    + Recolección
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="secondary"
                    onClick={() => { setNewStopType('DOCUMENTATION'); setStopDialogOpen(true); }}
                    sx={{ flex: 1, fontSize: '0.7rem' }}
                  >
                    + Documentación
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => setAssignDialogOpen(true)}
                    startIcon={<AssignmentIndIcon />}
                    sx={{ flex: 1 }}
                  >
                    Chofer ({selectedOrderIds.length})
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="secondary"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => setCarrierDialogOpen(true)}
                    startIcon={<BusinessIcon />}
                    sx={{ flex: 1 }}
                  >
                    Paquetería
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="info"
                    disabled={selectedOrderIds.length < 2}
                    onClick={() => setOptimizeDialogOpen(true)}
                    startIcon={<RouteIcon />}
                    sx={{ flex: 1 }}
                  >
                    Optimizar
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => setDispatchDialogOpen(true)}
                    startIcon={<PlayArrowIcon />}
                    sx={{ flex: 1.5 }}
                  >
                    Despachar ({selectedOrderIds.length})
                  </Button>
                </Stack>
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  disabled={selectedOrderIds.length === 0 || returnToPurchasingMutation.isPending}
                  onClick={() => {
                    if (confirm('¿Regresar los pedidos seleccionados a Compras para revisión?')) {
                      returnToPurchasingMutation.mutate();
                    }
                  }}
                  startIcon={<UndoIcon />}
                  fullWidth
                >
                  Regresar a Compras ({selectedOrderIds.length})
                </Button>
              </Stack>
            )}
            {/* Actions for IN_TRANSIT orders */}
            {statusFilter === 1 && (
              <Stack spacing={1}>
                {/* Confirm delivery for carrier orders */}
                {selectedOrders.some(o => o.carrierType && o.carrierType !== 'INTERNAL') && (
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    disabled={selectedOrderIds.length !== 1 || confirmDeliveryMutation.isPending}
                    onClick={() => {
                      const carrierOrder = selectedOrders.find(o => o.carrierType && o.carrierType !== 'INTERNAL');
                      if (carrierOrder) {
                        setConfirmingOrder(carrierOrder);
                        setConfirmDeliveryDialogOpen(true);
                      }
                    }}
                    startIcon={<CheckCircleIcon />}
                    fullWidth
                  >
                    Confirmar Entrega (Paquetería)
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  disabled={selectedOrderIds.length === 0 || returnToPurchasingMutation.isPending}
                  onClick={() => {
                    if (confirm('¿Regresar los pedidos seleccionados a Compras para revisión?')) {
                      returnToPurchasingMutation.mutate();
                    }
                  }}
                  startIcon={<UndoIcon />}
                  fullWidth
                >
                  Regresar a Compras ({selectedOrderIds.length})
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  disabled={selectedOrderIds.length === 0}
                  onClick={() => setAdminDeliverDialogOpen(true)}
                  startIcon={<CheckCircleIcon />}
                  fullWidth
                >
                  Marcar Entregado ({selectedOrderIds.length})
                </Button>
              </Stack>
            )}
            {/* Actions for RETURNED_TO_PURCHASING orders */}
            {statusFilter === 3 && (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => {
                      setReviewActionTarget('READY');
                      setReviewActionComment('');
                      setReviewActionDialogOpen(true);
                    }}
                    startIcon={<PlayArrowIcon />}
                    sx={{ flex: 1 }}
                  >
                    Activar ({selectedOrderIds.length})
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="info"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => {
                      setReviewActionTarget('IN_TRANSIT');
                      setReviewActionComment('');
                      setReviewActionDialogOpen(true);
                    }}
                    startIcon={<LocalShippingIcon />}
                    sx={{ flex: 1 }}
                  >
                    En Ruta ({selectedOrderIds.length})
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => {
                      setReviewActionTarget('RETURNED_TO_PURCHASING');
                      setReviewActionComment('');
                      setReviewActionDialogOpen(true);
                    }}
                    startIcon={<UndoIcon />}
                    sx={{ flex: 1 }}
                  >
                    A Compras ({selectedOrderIds.length})
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    disabled={selectedOrderIds.length === 0 || cancelOrdersMutation.isPending}
                    onClick={() => {
                      if (confirm('¿Cancelar los pedidos seleccionados? Esta acción no se puede deshacer.')) {
                        cancelOrdersMutation.mutate();
                      }
                    }}
                    startIcon={<CancelIcon />}
                    sx={{ flex: 1 }}
                  >
                    Cancelar ({selectedOrderIds.length})
                  </Button>
                </Stack>
              </Stack>
            )}
            {/* No actions for DELIVERED or CANCELLED */}
            {(statusFilter === 2 || statusFilter === 4) && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {statusFilter === 2 ? 'Historial de entregas' : 'Pedidos cancelados'}
              </Typography>
            )}
          </Paper>
        </Box>

        {/* Right Panel - Map */}
        <Box
          sx={{
            width: mapWidth,
            display: viewMode === 'list' ? 'none' : 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s',
            bgcolor: '#f1f5f9',
          }}
        >
          {/* Map Header */}
          <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'white' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight={500} color="text.secondary">
                Mapa de pedidos
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ fontSize: 11 }}>
                <LegendItem color="#0284c7" label="Listo" />
                <LegendItem color="#0d9488" label="En Ruta" />
                <LegendItem color="#dc2626" label="Urgente" />
                <LegendItem color="#1e40af" label="Seleccionado" />
              </Stack>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <OrdersMap
              orders={filteredOrders}
              selectedIds={selectedOrderIds}
              onOrderClick={toggleOrderSelection}
              onMissingCoordsCount={setMissingCoordsCount}
            />
            {selectedOrderIds.length > 0 && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                }}
              >
                <Chip
                  label={`${selectedOrderIds.length} seleccionados`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.95)',
                    boxShadow: 1,
                  }}
                />
                {missingCoordsCount > 0 && (
                  <Chip
                    icon={<WarningAmberIcon sx={{ fontSize: '16px !important' }} />}
                    label={`${missingCoordsCount} sin ubicación`}
                    size="small"
                    color="warning"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.95)',
                      boxShadow: 1,
                    }}
                  />
                )}
              </Stack>
            )}
          </Box>
        </Box>

        {/* View Toggle - Floating */}
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1000,
            borderRadius: 2,
            overflow: 'hidden',
          }}
          elevation={3}
        >
          <Stack direction="row">
            <IconButton
              size="small"
              onClick={() => setViewMode('list')}
              sx={{ borderRadius: 0, bgcolor: viewMode === 'list' ? 'primary.light' : 'transparent', color: viewMode === 'list' ? 'white' : 'text.secondary' }}
            >
              <ListAltIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setViewMode('split')}
              sx={{ borderRadius: 0, bgcolor: viewMode === 'split' ? 'primary.light' : 'transparent', color: viewMode === 'split' ? 'white' : 'text.secondary' }}
            >
              <Box sx={{ display: 'flex' }}><ListAltIcon fontSize="small" /><MapIcon fontSize="small" /></Box>
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setViewMode('map')}
              sx={{ borderRadius: 0, bgcolor: viewMode === 'map' ? 'primary.light' : 'transparent', color: viewMode === 'map' ? 'white' : 'text.secondary' }}
            >
              <MapIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Paper>
      </Box>

      {/* Dialogs */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Asignar Chofer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedOrderIds.length} pedido(s) seleccionado(s)
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Chofer</InputLabel>
            <Select value={selectedDriverId} label="Chofer" onChange={(e) => setSelectedDriverId(e.target.value)}>
              {drivers?.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => assignMutation.mutate()} disabled={!selectedDriverId || assignMutation.isPending}>
            {assignMutation.isPending ? <CircularProgress size={20} /> : 'Asignar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dispatchDialogOpen} onClose={() => setDispatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Despachar Ruta</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedOrderIds.length} pedido(s) seleccionado(s)
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Chofer</InputLabel>
              <Select value={selectedDriverId} label="Chofer" onChange={(e) => setSelectedDriverId(e.target.value)}>
                {drivers?.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" type="time" label="Hora de inicio" value={startTime} onChange={(e) => setStartTime(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
          {selectedOrders.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Ruta ({selectedOrders.length} paradas):
              </Typography>
              {selectedOrders.map((order, i) => (
                <Chip key={order.id} size="small" label={`${i + 1}. ${order.orderNumber || order.bindId?.substring(0, 6)} - ${order.clientName}`} sx={{ mr: 0.5, mb: 0.5 }} />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDispatchDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => dispatchMutation.mutate()} disabled={!selectedDriverId || dispatchMutation.isPending} startIcon={dispatchMutation.isPending ? <CircularProgress size={16} /> : <SendIcon />}>
            Despachar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={carrierDialogOpen} onClose={() => setCarrierDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Asignar Paquetería / Proveedor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedOrderIds.length} pedido(s) seleccionado(s)
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de envío</InputLabel>
              <Select value={selectedCarrierType} label="Tipo de envío" onChange={(e) => setSelectedCarrierType(e.target.value)}>
                {carrierTypes?.filter((ct) => ct.value !== 'INTERNAL').map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedCarrierType === 'OTHER' && (
              <TextField size="small" fullWidth label="Nombre de paquetería" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
            )}
            <TextField size="small" fullWidth label="Número de guía (opcional)" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
            <TextField
              size="small"
              fullWidth
              label="Fecha de entrega"
              type="date"
              value={carrierDeliveryDate}
              onChange={(e) => setCarrierDeliveryDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Fecha real o estimada de entrega"
            />
            <TextField
              size="small"
              fullWidth
              label="Hora de entrega (opcional)"
              type="time"
              value={carrierDeliveryTime}
              onChange={(e) => setCarrierDeliveryTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Hora aproximada de entrega"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCarrierDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="secondary" onClick={() => carrierMutation.mutate()} disabled={!selectedCarrierType || (selectedCarrierType === 'OTHER' && !carrierName) || carrierMutation.isPending}>
            {carrierMutation.isPending ? <CircularProgress size={20} /> : 'Asignar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Address Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <EditIcon color="primary" />
              <Typography variant="h6">Editar Dirección</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setEditDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {editingOrder && (
            <Stack spacing={2}>
              {/* Warning for IN_TRANSIT orders */}
              {editingOrder.status === 'IN_TRANSIT' && (
                <Alert severity="warning" icon={<WarningAmberIcon />}>
                  <Typography variant="body2" fontWeight={600}>
                    Pedido en ruta - Requiere aprobación del chofer
                  </Typography>
                  <Typography variant="caption">
                    Este pedido ya fue despachado. El cambio de dirección será enviado al chofer para su aprobación.
                  </Typography>
                </Alert>
              )}

              {/* Order info header */}
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                    {editingOrder.orderNumber || editingOrder.bindId?.substring(0, 8)}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={600}>{editingOrder.clientName}</Typography>
                </Stack>
                {editingOrder.clientPhone && (
                  <Typography variant="caption" color="text.secondary" display="block">Tel: {editingOrder.clientPhone}</Typography>
                )}
                {editingOrder.clientNumber && (
                  <Typography variant="caption" color="text.secondary" display="block">Cliente: {editingOrder.clientNumber}</Typography>
                )}
                {editingOrder.latitude && editingOrder.longitude ? (
                  <Chip size="small" icon={<LocationOnIcon />} label="Con coordenadas" color="success" sx={{ mt: 0.5, height: 20 }} />
                ) : (
                  <Chip size="small" icon={<WarningAmberIcon />} label="Sin coordenadas" color="warning" sx={{ mt: 0.5, height: 20 }} />
                )}
              </Paper>

              {/* Saved addresses section */}
              {editingOrder.clientNumber && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'success.50', borderColor: 'success.light' }}>
                  <Typography variant="caption" fontWeight={600} color="success.dark" gutterBottom display="block">
                    Direcciones guardadas del cliente:
                  </Typography>
                  {loadingSavedAddresses ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={20} />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Cargando...</Typography>
                    </Box>
                  ) : savedAddresses.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {savedAddresses.map((addr) => {
                        const displayAddr = [
                          [addr.street, addr.number].filter(Boolean).join(' '),
                          addr.neighborhood && `Col. ${addr.neighborhood}`,
                          addr.city,
                          addr.postalCode && `C.P. ${addr.postalCode}`,
                        ].filter(Boolean).join(', ');

                        const isSelected =
                          editAddress.street === (addr.street || '') &&
                          editAddress.neighborhood === (addr.neighborhood || '') &&
                          editAddress.postalCode === (addr.postalCode || '');

                        return (
                          <Paper
                            key={addr.id}
                            variant="outlined"
                            onClick={() => selectSavedAddress(addr)}
                            sx={{
                              p: 1,
                              cursor: 'pointer',
                              bgcolor: isSelected ? 'success.100' : 'white',
                              borderColor: isSelected ? 'success.main' : 'divider',
                              borderWidth: isSelected ? 2 : 1,
                              '&:hover': { bgcolor: isSelected ? 'success.100' : 'grey.100' },
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexWrap: 'nowrap' }}>
                                  <Typography variant="body2" fontWeight={500} noWrap sx={{ flexShrink: 1, minWidth: 0 }}>
                                    {addr.label || displayAddr.substring(0, 30) || 'Sin nombre'}
                                  </Typography>
                                  {addr.isDefault && (
                                    <Chip size="small" label="Principal" color="success" sx={{ height: 16, flexShrink: 0, '& .MuiChip-label': { px: 0.5, fontSize: '0.6rem' } }} />
                                  )}
                                  {addr.latitude && addr.longitude && (
                                    <Tooltip title="Con coordenadas">
                                      <LocationOnIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                                    </Tooltip>
                                  )}
                                </Stack>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {displayAddr || 'Sin dirección completa'}
                                </Typography>
                              </Box>
                              <Tooltip title="Eliminar dirección">
                                <IconButton
                                  size="small"
                                  onClick={(e) => deleteSavedAddress(addr.id, e)}
                                  sx={{ ml: 1, flexShrink: 0, color: 'error.main', '&:hover': { bgcolor: 'error.50' } }}
                                >
                                  <DeleteIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No hay direcciones guardadas para este cliente
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Address options list */}
              {addressOptions.length > 1 && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                    Seleccionar dirección de entrega:
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {addressOptions.map((option, index) => {
                      const addr = option.address;
                      const displayAddr = [
                        [addr.street, addr.number].filter(Boolean).join(' '),
                        addr.neighborhood && `Col. ${addr.neighborhood}`,
                        addr.city,
                        addr.postalCode && `C.P. ${addr.postalCode}`,
                      ].filter(Boolean).join(', ');

                      const isSelected =
                        editAddress.street === addr.street &&
                        editAddress.neighborhood === addr.neighborhood &&
                        editAddress.postalCode === addr.postalCode;

                      return (
                        <Paper
                          key={index}
                          variant="outlined"
                          onClick={() => selectAddressOption(option)}
                          sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'primary.50' : 'white',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            borderWidth: isSelected ? 2 : 1,
                            '&:hover': {
                              bgcolor: isSelected ? 'primary.50' : 'grey.100',
                              borderColor: 'primary.light',
                            },
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '2px solid',
                                borderColor: isSelected ? 'primary.main' : 'grey.400',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isSelected && (
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.main',
                                  }}
                                />
                              )}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" fontWeight={600} color={isSelected ? 'primary.main' : 'text.secondary'}>
                                {option.label}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.25 }}>
                                {displayAddr || 'Sin dirección completa'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Paper>
              )}

              {/* Show original Bind address */}
              {editingOrder.addressRaw?.original && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'info.50', borderColor: 'info.light' }}>
                  <Typography variant="caption" fontWeight={600} color="info.dark" gutterBottom display="block">
                    Dirección original de Bind:
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8125rem' }}>
                    {editingOrder.addressRaw.original}
                  </Typography>
                </Paper>
              )}

              {/* Show reference/comments if available */}
              {editAddress.reference && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'warning.50', borderColor: 'warning.light' }}>
                  <Typography variant="caption" fontWeight={600} color="warning.dark" gutterBottom display="block">
                    Comentarios del pedido:
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8125rem' }}>
                    {editAddress.reference}
                  </Typography>
                </Paper>
              )}

              {/* Address fields */}
              <Stack direction="row" spacing={2}>
                <TextField
                  size="small"
                  label="Calle"
                  value={editAddress.street}
                  onChange={(e) => setEditAddress({ ...editAddress, street: e.target.value })}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Número"
                  value={editAddress.number}
                  onChange={(e) => setEditAddress({ ...editAddress, number: e.target.value })}
                  sx={{ width: 120 }}
                />
              </Stack>
              <TextField
                size="small"
                label="Colonia"
                value={editAddress.neighborhood}
                onChange={(e) => setEditAddress({ ...editAddress, neighborhood: e.target.value })}
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  size="small"
                  label="Ciudad"
                  value={editAddress.city}
                  onChange={(e) => setEditAddress({ ...editAddress, city: e.target.value })}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Estado"
                  value={editAddress.state}
                  onChange={(e) => setEditAddress({ ...editAddress, state: e.target.value })}
                  fullWidth
                />
              </Stack>
              <TextField
                size="small"
                label="Código Postal"
                value={editAddress.postalCode}
                onChange={(e) => setEditAddress({ ...editAddress, postalCode: e.target.value })}
                sx={{ width: 150 }}
              />
              <TextField
                size="small"
                label="Referencia / Notas"
                value={editAddress.reference}
                onChange={(e) => setEditAddress({ ...editAddress, reference: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />

              {/* Option to save address for future client use */}
              {editingOrder?.clientNumber && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'primary.50', borderColor: 'primary.light' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={saveAddressForClient}
                        onChange={(e) => setSaveAddressForClient(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={500}>
                        Guardar para uso futuro del cliente
                      </Typography>
                    }
                  />
                  {saveAddressForClient && (
                    <TextField
                      size="small"
                      fullWidth
                      label="Etiqueta (opcional)"
                      placeholder="Ej: Sucursal Norte, Bodega Principal"
                      value={newAddressLabel}
                      onChange={(e) => setNewAddressLabel(e.target.value)}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setEditDialogOpen(false)} variant="outlined">
            Cancelar
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="info"
              onClick={() => geocodeSingleMutation.mutate()}
              disabled={geocodeSingleMutation.isPending || !editAddress.street || !editingOrder}
              startIcon={geocodeSingleMutation.isPending ? <CircularProgress size={16} /> : <MyLocationIcon />}
            >
              Geocodificar
            </Button>
            <Button
              variant="contained"
              color={editingOrder?.status === 'IN_TRANSIT' ? 'warning' : 'primary'}
              onClick={() => addressMutation.mutate()}
              disabled={addressMutation.isPending || !editAddress.street}
              startIcon={addressMutation.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {editingOrder?.status === 'IN_TRANSIT' ? 'Solicitar Cambio' : 'Guardar'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* POD Viewer Dialog */}
      <Dialog open={podDialogOpen} onClose={() => setPodDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <ImageIcon color="primary" />
              <Typography variant="h6">Prueba de Entrega (POD)</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setPodDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {podOrder && (
            <Stack spacing={3}>
              {/* Order info */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                      {podOrder.orderNumber || podOrder.bindId?.substring(0, 8)}
                    </Typography>
                    <Typography variant="body2">{podOrder.clientName}</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="caption" color="text.secondary">Entregado</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {formatDateTime(podOrder.deliveredAt)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Evidences */}
              {podOrder.evidences && podOrder.evidences.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom color="text.secondary">
                    Evidencias capturadas:
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    {podOrder.evidences.map((evidence) => {
                      // Determine if it's a photo - check type (case-insensitive) or fallback to storageKey
                      const isPhoto = evidence.type?.toUpperCase() === 'PHOTO' ||
                        evidence.storageKey?.toLowerCase().includes('photo');
                      return (
                      <Paper key={evidence.id} variant="outlined" sx={{ p: 2, flex: 1 }}>
                        <Stack spacing={1} alignItems="center">
                          {isPhoto ? (
                            <PhotoCameraIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                          ) : (
                            <GestureIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                          )}
                          <Typography variant="body2" fontWeight={500}>
                            {isPhoto ? 'Fotografía' : 'Firma'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(evidence.capturedAt || evidence.createdAt)}
                          </Typography>
                          <Box
                            component="img"
                            src={getEvidenceUrl(evidence.storageKey)}
                            alt={evidence.type}
                            sx={{
                              width: '100%',
                              maxHeight: 300,
                              objectFit: 'contain',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'white',
                            }}
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <Box
                            sx={{
                              display: 'none',
                              width: '100%',
                              height: 150,
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'grey.100',
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              Imagen no disponible
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    );
                    })}
                  </Stack>
                </Box>
              ) : (
                <Alert severity="info">
                  No hay evidencias registradas para este pedido.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPodDialogOpen(false)} variant="outlined">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Route Optimization Dialog */}
      <RouteOptimizationDialog
        open={optimizeDialogOpen}
        onClose={() => setOptimizeDialogOpen(false)}
        selectedOrders={selectedOrders}
        onOptimizationApplied={() => {
          setSnackbar({
            open: true,
            message: 'Ruta optimizada aplicada correctamente',
            severity: 'success',
          });
          // Mantener pedidos seleccionados para asignar y despachar
          queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
        }}
      />

      {/* Confirm Delivery Dialog (for carrier orders) */}
      <Dialog open={confirmDeliveryDialogOpen} onClose={() => { setConfirmDeliveryDialogOpen(false); setDeliveryEvidenceFile(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">Confirmar Entrega</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {confirmingOrder && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                  {confirmingOrder.orderNumber || confirmingOrder.bindId?.substring(0, 8)}
                </Typography>
                <Typography variant="body2" fontWeight={600}>{confirmingOrder.clientName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Paquetería: {confirmingOrder.carrierName || confirmingOrder.carrierType}
                  {confirmingOrder.carrierTrackingNumber && ` - Guía: ${confirmingOrder.carrierTrackingNumber}`}
                </Typography>
              </Paper>

              <Alert severity="info">
                Adjunta evidencia de que la paquetería entregó correctamente al cliente (foto de guía firmada, acuse, etc.)
              </Alert>

              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<PhotoCameraIcon />}
              >
                {deliveryEvidenceFile ? deliveryEvidenceFile.name : 'Seleccionar Evidencia (Foto)'}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDeliveryEvidenceFile(e.target.files[0]);
                    }
                  }}
                />
              </Button>

              {deliveryEvidenceFile && (
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={URL.createObjectURL(deliveryEvidenceFile)}
                    alt="Evidencia"
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                  />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setConfirmDeliveryDialogOpen(false); setDeliveryEvidenceFile(null); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => confirmDeliveryMutation.mutate()}
            disabled={confirmDeliveryMutation.isPending}
            startIcon={confirmDeliveryMutation.isPending ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {confirmDeliveryMutation.isPending ? 'Confirmando...' : 'Confirmar Entrega'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Mark Delivered Dialog */}
      <Dialog open={adminDeliverDialogOpen} onClose={() => setAdminDeliverDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Marcar como Entregado</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se marcarán {selectedOrderIds.length} pedido(s) como entregados. Ingresa un comentario explicando por qué se marcan como entregados desde el panel.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Comentario *"
            placeholder="Ej: Cliente confirmó recepción por teléfono..."
            value={adminDeliverComment}
            onChange={(e) => setAdminDeliverComment(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={adminDeliverSendEmail}
                onChange={(e) => setAdminDeliverSendEmail(e.target.checked)}
              />
            }
            label="Enviar email de confirmación de entrega al cliente"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminDeliverDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => adminDeliverMutation.mutate()}
            disabled={!adminDeliverComment.trim() || adminDeliverMutation.isPending}
            startIcon={adminDeliverMutation.isPending ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {adminDeliverMutation.isPending ? 'Procesando...' : 'Confirmar Entrega'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Review Action Dialog (for RETURNED_TO_PURCHASING) */}
      <Dialog open={reviewActionDialogOpen} onClose={() => setReviewActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewActionTarget === 'READY' ? 'Mover a Activos' : reviewActionTarget === 'IN_TRANSIT' ? 'Mover a En Ruta' : 'Regresar a Compras'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se cambiarán {selectedOrderIds.length} pedido(s) de &quot;En Revisión&quot; a &quot;{reviewActionTarget === 'READY' ? 'Activo' : reviewActionTarget === 'IN_TRANSIT' ? 'En Ruta' : 'Regresado a Compras'}&quot;. Ingresa un comentario.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Comentario *"
            placeholder="Ej: Se verificó con el cliente y confirma recepción..."
            value={reviewActionComment}
            onChange={(e) => setReviewActionComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewActionDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color={reviewActionTarget === 'READY' ? 'primary' : reviewActionTarget === 'IN_TRANSIT' ? 'info' : 'warning'}
            onClick={() => reviewActionMutation.mutate()}
            disabled={!reviewActionComment.trim() || reviewActionMutation.isPending}
            startIcon={reviewActionMutation.isPending ? <CircularProgress size={16} /> : null}
          >
            {reviewActionMutation.isPending ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Route Stop Dialog */}
      <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {newStopType === 'PICKUP' ? 'Nueva Recolección' : 'Nueva Visita de Documentación'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* Pickup Point selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Punto guardado (opcional)</InputLabel>
              <Select
                value={selectedPickupPointId}
                label="Punto guardado (opcional)"
                onChange={(e) => {
                  const pointId = e.target.value as string;
                  setSelectedPickupPointId(pointId);
                  if (pointId) {
                    const point = pickupPoints.find(p => p.id === pointId);
                    if (point) {
                      setNewStopClientName(point.clientName);
                      setNewStopContactName(point.contactName || '');
                      setNewStopContactPhone(point.contactPhone || '');
                      setNewStopAddress({
                        street: point.street || '',
                        number: point.number || '',
                        neighborhood: point.neighborhood || '',
                        city: point.city || '',
                        state: point.state || '',
                        postalCode: point.postalCode || '',
                        reference: point.reference || '',
                      });
                    }
                  }
                }}
              >
                <MenuItem value="">-- Dirección manual --</MenuItem>
                {pickupPoints.map((point) => (
                  <MenuItem key={point.id} value={point.id}>
                    {point.clientName}{point.label ? ` — ${point.label}` : ''} ({point.useCount} usos)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField size="small" label="Cliente *" value={newStopClientName} onChange={(e) => setNewStopClientName(e.target.value)} fullWidth />
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="Contacto" value={newStopContactName} onChange={(e) => setNewStopContactName(e.target.value)} fullWidth />
              <TextField size="small" label="Teléfono" value={newStopContactPhone} onChange={(e) => setNewStopContactPhone(e.target.value)} fullWidth />
            </Stack>

            {!selectedPickupPointId && (
              <>
                <Typography variant="caption" fontWeight={600} color="text.secondary">Dirección</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Calle" value={newStopAddress.street} onChange={(e) => setNewStopAddress(p => ({ ...p, street: e.target.value }))} sx={{ flex: 2 }} />
                  <TextField size="small" label="Número" value={newStopAddress.number} onChange={(e) => setNewStopAddress(p => ({ ...p, number: e.target.value }))} sx={{ flex: 1 }} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Colonia" value={newStopAddress.neighborhood} onChange={(e) => setNewStopAddress(p => ({ ...p, neighborhood: e.target.value }))} fullWidth />
                  <TextField size="small" label="Ciudad" value={newStopAddress.city} onChange={(e) => setNewStopAddress(p => ({ ...p, city: e.target.value }))} fullWidth />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="CP" value={newStopAddress.postalCode} onChange={(e) => setNewStopAddress(p => ({ ...p, postalCode: e.target.value }))} sx={{ flex: 1 }} />
                  <TextField size="small" label="Estado" value={newStopAddress.state} onChange={(e) => setNewStopAddress(p => ({ ...p, state: e.target.value }))} sx={{ flex: 2 }} />
                </Stack>
                <TextField size="small" label="Referencia" value={newStopAddress.reference} onChange={(e) => setNewStopAddress(p => ({ ...p, reference: e.target.value }))} fullWidth />
              </>
            )}

            <TextField size="small" label="Descripción (motivo de la visita)" value={newStopDescription} onChange={(e) => setNewStopDescription(e.target.value)} fullWidth multiline rows={2} />
            <TextField size="small" label="Artículos/documentos a recoger *" value={newStopItemsDescription} onChange={(e) => setNewStopItemsDescription(e.target.value)} fullWidth />

            <FormControl size="small" fullWidth required>
              <InputLabel>Chofer asignado *</InputLabel>
              <Select
                value={newStopDriverId}
                label="Chofer asignado *"
                onChange={(e) => setNewStopDriverId(e.target.value)}
              >
                {(drivers || []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStopDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => createStopMutation.mutate()}
            disabled={!newStopClientName.trim() || !newStopDriverId || createStopMutation.isPending}
            startIcon={createStopMutation.isPending ? <CircularProgress size={16} /> : undefined}
          >
            Crear y Asignar {newStopType === 'PICKUP' ? 'Recolección' : 'Visita'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// Compact stat badge for header
function StatBadge({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ color, display: 'flex', alignItems: 'center', '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} lineHeight={1} color={color}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" lineHeight={1}>{label}</Typography>
      </Box>
    </Stack>
  );
}

// Map legend item
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

// Compact Order Card
function OrderCard({ order, isSelected, onToggle, onEdit, onViewPod }: { order: Order; isSelected: boolean; onToggle: () => void; onEdit: () => void; onViewPod?: () => void }) {
  const priority = priorityConfig[order.priorityLevel] || priorityConfig[1];
  const status = statusConfig[order.status] || statusConfig.DRAFT;
  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';
  const canSelect = !isDelivered && !isCancelled; // Can select READY, IN_TRANSIT, RETURNED_TO_PURCHASING
  const isUrgent = order.priorityLevel === 3;
  const hasCoords = order.latitude && order.longitude;
  const hasEvidence = order.evidences && order.evidences.length > 0;

  // Format promised date
  const formatPromisedDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const parseD = (s: string): Date => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0);
      }
      return new Date(s);
    };
    const date = parseD(dateStr);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  const promisedDateStr = formatPromisedDate(order.promisedDate);

  const address = order.addressRaw
    ? `${order.addressRaw.street || ''} ${order.addressRaw.number || ''}, ${order.addressRaw.neighborhood || ''}, ${order.addressRaw.city || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*,/g, ',')
    : 'Sin dirección';

  return (
    <Card
      variant="outlined"
      onClick={() => { if (canSelect) onToggle(); }}
      sx={{
        transition: 'all 0.15s',
        cursor: canSelect ? 'pointer' : 'default',
        borderColor: isSelected ? 'primary.main' : isUrgent ? 'error.light' : isCancelled ? 'error.light' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        bgcolor: isSelected ? alpha('#0d9488', 0.04) : isDelivered ? '#f8fafc' : isCancelled ? '#fef2f2' : 'white',
        opacity: isDelivered || isCancelled ? 0.7 : 1,
        '&:hover': { borderColor: isSelected ? 'primary.main' : 'primary.light' },
      }}
    >
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Checkbox
            checked={isSelected}
            size="small"
            disabled={!canSelect}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggle}
            sx={{ p: 0, mt: 0.25 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {order.orderNumber || order.bindId?.substring(0, 8)}
                  </Typography>
                  {promisedDateStr && (
                    <Chip
                      size="small"
                      icon={<CalendarTodayIcon sx={{ fontSize: '14px !important' }} />}
                      label={promisedDateStr}
                      sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem', fontWeight: 600 }, '& .MuiChip-icon': { ml: 0.5 } }}
                      color="warning"
                    />
                  )}
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>{order.clientName}</Typography>
                </Stack>
              </Box>
              <Stack direction="row" spacing={0.5} flexShrink={0} alignItems="center">
                {isUrgent && <Chip size="small" label="Urgente" color="error" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }} />}
                <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }} />
                {isDelivered && hasEvidence && onViewPod && (
                  <Tooltip title="Ver prueba de entrega">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onViewPod(); }} sx={{ p: 0.25 }} color="success">
                      <PhotoCameraIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Editar dirección">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(); }} sx={{ p: 0.25 }}>
                    <EditIcon sx={{ fontSize: 16 }} color={hasCoords ? 'action' : 'warning'} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
              <Tooltip title={address}>
                <Typography
                  variant="caption"
                  color={hasCoords ? 'text.secondary' : 'warning.main'}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                  <LocationOnIcon sx={{ fontSize: 14 }} /> {address || 'Sin dirección'}
                </Typography>
              </Tooltip>
                <Typography variant="caption" fontWeight={600} color="success.dark">
                  ${order.totalAmount?.toLocaleString('es-MX', { minimumFractionDigits: 0 }) || '0'}
                </Typography>
                {order.assignedDriver && (
                  <Chip
                    size="small"
                    icon={<PersonIcon sx={{ fontSize: '12px !important' }} />}
                    label={`${order.assignedDriver.firstName}`}
                    sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.625rem' } }}
                  />
                )}
                {order.carrierType && order.carrierType !== 'INTERNAL' && (
                  <Chip
                    size="small"
                    icon={<BusinessIcon sx={{ fontSize: '12px !important' }} />}
                    label={order.carrierName || order.carrierType}
                    color="secondary"
                    sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.625rem' } }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
    </Card>
  );
}
