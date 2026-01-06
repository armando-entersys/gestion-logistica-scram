'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Divider,
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
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';
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

import { useRouter } from 'next/navigation';
import { ordersApi, usersApi } from '@/lib/api';

// Dynamic import for Map to avoid SSR issues
const OrdersMap = dynamic(() => import('@/components/OrdersMap'), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <CircularProgress />
    </Box>
  ),
});

interface Order {
  id: string;
  bindId: string;
  clientName: string;
  clientRfc?: string;
  addressRaw: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    postalCode?: string;
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

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'info' }> = {
  DRAFT: { label: 'Borrador', color: 'default' },
  READY: { label: 'Listo', color: 'info' },
  IN_TRANSIT: { label: 'En Ruta', color: 'primary' },
  DELIVERED: { label: 'Entregado', color: 'success' },
};

const ITEMS_PER_PAGE = 10;

export default function PlanningPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null); // null = all, 'READY', 'IN_TRANSIT', 'DELIVERED'
  const [page, setPage] = useState(1);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
  const [selectedCarrierType, setSelectedCarrierType] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Check auth
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

  // Fetch all orders (READY and IN_TRANSIT for planning)
  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ['planning-orders'],
    queryFn: async () => {
      const response = await ordersApi.getAll({ status: 'READY,IN_TRANSIT,DELIVERED', limit: 100 });
      return response.data.data || response.data;
    },
  });

  const orders: Order[] = ordersResponse || [];

  // Fetch drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await usersApi.getDrivers();
      return response.data as Driver[];
    },
  });

  // Fetch carrier types
  const { data: carrierTypes } = useQuery({
    queryKey: ['carrier-types'],
    queryFn: async () => {
      const response = await ordersApi.getCarrierTypes();
      return response.data as CarrierType[];
    },
  });

  // Stats
  const stats = useMemo(() => {
    const ready = orders.filter((o) => o.status === 'READY').length;
    const inTransit = orders.filter((o) => o.status === 'IN_TRANSIT').length;
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
    return { ready, inTransit, delivered };
  }, [orders]);

  // Filtered and paginated orders
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter by status
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    } else {
      // Default: show READY and IN_TRANSIT
      result = result.filter((o) => o.status === 'READY' || o.status === 'IN_TRANSIT');
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.clientName?.toLowerCase().includes(searchLower) ||
          o.bindId?.toLowerCase().includes(searchLower) ||
          o.clientRfc?.toLowerCase().includes(searchLower) ||
          o.assignedDriver?.firstName?.toLowerCase().includes(searchLower) ||
          o.assignedDriver?.lastName?.toLowerCase().includes(searchLower)
      );
    }
    return result;
  }, [orders, search, statusFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Assign driver mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriverId || selectedOrderIds.length === 0) {
        throw new Error('Selecciona chofer y pedidos');
      }
      return ordersApi.assign(selectedDriverId, selectedOrderIds);
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `${response.data.assigned} pedidos asignados al chofer`,
        severity: 'success',
      });
      setSelectedOrderIds([]);
      setAssignDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al asignar chofer',
        severity: 'error',
      });
    },
  });

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriverId || selectedOrderIds.length === 0) {
        throw new Error('Selecciona chofer y pedidos');
      }
      console.log('Dispatching:', { driverId: selectedDriverId, orderIds: selectedOrderIds, startTime });
      const response = await ordersApi.dispatch(selectedDriverId, selectedOrderIds, startTime);
      console.log('Dispatch response:', response.data);
      return response;
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `Ruta despachada: ${response.data.dispatched} pedidos, ${response.data.emailsQueued} emails enviados`,
        severity: 'success',
      });
      setSelectedOrderIds([]);
      setSelectedDriverId('');
      setDispatchDialogOpen(false);
      // Force refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
        refetch();
      }, 500);
    },
    onError: (error: any) => {
      console.error('Dispatch error:', error.response?.data || error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Error al despachar ruta',
        severity: 'error',
      });
    },
  });

  // Carrier assignment mutation
  const carrierMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCarrierType || selectedOrderIds.length === 0) {
        throw new Error('Selecciona paquetería y pedidos');
      }
      return ordersApi.assignCarrier(
        selectedOrderIds,
        selectedCarrierType,
        selectedCarrierType === 'OTHER' ? carrierName : undefined,
        trackingNumber || undefined
      );
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `${response.data.assigned} pedidos asignados a paquetería`,
        severity: 'success',
      });
      setSelectedOrderIds([]);
      setSelectedCarrierType('');
      setCarrierName('');
      setTrackingNumber('');
      setCarrierDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al asignar paquetería',
        severity: 'error',
      });
    },
  });

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = paginatedOrders.filter((o) => o.status === 'READY').map((o) => o.id);
    setSelectedOrderIds((prev) => {
      const newIds = visibleIds.filter((id) => !prev.includes(id));
      return [...prev, ...newIds];
    });
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box
            component="img"
            src="/scram-logo.png"
            alt="SCRAM"
            sx={{ height: 36, mr: 2 }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600} color="text.primary">
              Panel de Tráfico
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Planificación y despacho de rutas
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
            >
              Actualizar
            </Button>
            <Button
              variant="outlined"
              startIcon={<PeopleIcon />}
              onClick={() => router.push('/usuarios')}
            >
              Usuarios
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Salir
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Stats Cards - Clickable to filter */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Stack direction="row" spacing={2}>
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              border: statusFilter === 'READY' ? 2 : 0,
              borderColor: 'info.main',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
            }}
            onClick={() => setStatusFilter(statusFilter === 'READY' ? null : 'READY')}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'info.light', width: 40, height: 40 }}>
                  <InventoryIcon color="info" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{stats.ready}</Typography>
                  <Typography variant="caption" color="text.secondary">Listos</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              border: statusFilter === 'IN_TRANSIT' ? 2 : 0,
              borderColor: 'primary.main',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
            }}
            onClick={() => setStatusFilter(statusFilter === 'IN_TRANSIT' ? null : 'IN_TRANSIT')}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'primary.light', width: 40, height: 40 }}>
                  <LocalShippingIcon color="primary" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{stats.inTransit}</Typography>
                  <Typography variant="caption" color="text.secondary">En Ruta</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              border: statusFilter === 'DELIVERED' ? 2 : 0,
              borderColor: 'success.main',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
            }}
            onClick={() => setStatusFilter(statusFilter === 'DELIVERED' ? null : 'DELIVERED')}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'success.light', width: 40, height: 40 }}>
                  <CheckCircleIcon color="success" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{stats.delivered}</Typography>
                  <Typography variant="caption" color="text.secondary">Entregados</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
        {statusFilter && (
          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <Chip
              label={`Filtrando: ${statusConfig[statusFilter]?.label || statusFilter}`}
              onDelete={() => setStatusFilter(null)}
              size="small"
              color={statusFilter === 'READY' ? 'info' : statusFilter === 'IN_TRANSIT' ? 'primary' : 'success'}
            />
          </Box>
        )}
      </Box>

      {/* Main Content - Responsive layout */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Order List (60% width) */}
        <Box sx={{ flex: '0 0 55%', minWidth: 500, maxWidth: 800, display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
          {/* Search and Selection Controls */}
          <Paper sx={{ p: 2.5, borderRadius: 0, bgcolor: 'grey.50' }} elevation={0}>
            <TextField
              fullWidth
              placeholder="Buscar por cliente, ID, RFC o chofer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2, bgcolor: 'white' }}
            />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  {filteredOrders.length} pedidos
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedOrderIds.length} seleccionados
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                {selectedOrderIds.length > 0 && (
                  <Button size="small" variant="outlined" onClick={clearSelection}>
                    Limpiar
                  </Button>
                )}
                <Button size="small" variant="contained" onClick={selectAllVisible}>
                  Sel. página
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Divider />

          {/* Orders List */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, bgcolor: 'background.paper' }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : paginatedOrders.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <LocalShippingIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No hay pedidos
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  {statusFilter ? `No hay pedidos con estado "${statusConfig[statusFilter]?.label}"` : 'No hay pedidos para planificar'}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {paginatedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrderIds.includes(order.id)}
                    onToggle={() => toggleOrderSelection(order.id)}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="medium"
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}

          {/* Action Buttons */}
          <Paper sx={{ p: 2.5, borderRadius: 0, bgcolor: 'grey.100' }} elevation={3}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  disabled={selectedOrderIds.length === 0}
                  onClick={() => setAssignDialogOpen(true)}
                  startIcon={<AssignmentIndIcon />}
                  sx={{ py: 1.5 }}
                >
                  Chofer ({selectedOrderIds.length})
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  color="secondary"
                  disabled={selectedOrderIds.length === 0}
                  onClick={() => setCarrierDialogOpen(true)}
                  startIcon={<BusinessIcon />}
                  sx={{ py: 1.5 }}
                >
                  Paquetería ({selectedOrderIds.length})
                </Button>
              </Stack>
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={selectedOrderIds.length === 0}
                onClick={() => setDispatchDialogOpen(true)}
                startIcon={<PlayArrowIcon />}
                sx={{ py: 1.5 }}
              >
                Despachar Ruta ({selectedOrderIds.length})
              </Button>
            </Stack>
          </Paper>
        </Box>

        {/* Right Panel - Map */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Paper sx={{ p: 1.5, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} elevation={0}>
            <Typography variant="subtitle1" fontWeight={600}>
              Mapa de Pedidos
            </Typography>
            <Stack direction="row" spacing={2} sx={{ fontSize: 11 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1976d2' }} />
                <Typography variant="caption">Seleccionado</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#0288d1' }} />
                <Typography variant="caption">Listo</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#7b1fa2' }} />
                <Typography variant="caption">En Ruta</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#d32f2f' }} />
                <Typography variant="caption">Urgente</Typography>
              </Box>
            </Stack>
          </Paper>
          <Divider />
          <Box sx={{ flex: 1, position: 'relative' }}>
            <OrdersMap
              orders={filteredOrders}
              selectedIds={selectedOrderIds}
              onOrderClick={toggleOrderSelection}
            />
            {selectedOrderIds.length > 0 && (
              <Paper
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  p: 1.5,
                  zIndex: 1000,
                  bgcolor: 'rgba(255,255,255,0.95)',
                }}
                elevation={3}
              >
                <Typography variant="caption" color="text.secondary">
                  Ruta: {selectedOrderIds.length} paradas
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar Chofer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Selecciona un chofer para asignar {selectedOrderIds.length} pedido(s)
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Chofer</InputLabel>
            <Select
              value={selectedDriverId}
              label="Chofer"
              onChange={(e) => setSelectedDriverId(e.target.value)}
            >
              {drivers?.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {driver.firstName} {driver.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedOrders.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Pedidos seleccionados:</Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {selectedOrders.map((order) => (
                  <ListItem key={order.id} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={order.clientName}
                      secondary={order.bindId}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => assignMutation.mutate()}
            disabled={!selectedDriverId || assignMutation.isPending}
          >
            {assignMutation.isPending ? <CircularProgress size={20} /> : 'Asignar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={dispatchDialogOpen} onClose={() => setDispatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Despachar Ruta</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configura y despacha la ruta para {selectedOrderIds.length} pedido(s)
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Chofer</InputLabel>
              <Select
                value={selectedDriverId}
                label="Chofer"
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                {drivers?.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.firstName} {driver.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="time"
              label="Hora de inicio"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          {selectedOrders.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Ruta ({selectedOrders.length} paradas):</Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {selectedOrders.map((order, index) => (
                  <ListItem key={order.id} sx={{ py: 0.5 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 12 }}>
                        {index + 1}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={order.clientName}
                      secondary={`${order.addressRaw?.neighborhood || ''}, ${order.addressRaw?.city || ''}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDispatchDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => dispatchMutation.mutate()}
            disabled={!selectedDriverId || dispatchMutation.isPending}
            startIcon={dispatchMutation.isPending ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Despachar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Carrier Assignment Dialog */}
      <Dialog open={carrierDialogOpen} onClose={() => setCarrierDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar Paquetería Externa</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Asigna una paquetería externa para {selectedOrderIds.length} pedido(s)
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Paquetería</InputLabel>
              <Select
                value={selectedCarrierType}
                label="Paquetería"
                onChange={(e) => setSelectedCarrierType(e.target.value)}
              >
                {carrierTypes?.filter(ct => ct.value !== 'INTERNAL').map((carrier) => (
                  <MenuItem key={carrier.value} value={carrier.value}>
                    {carrier.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedCarrierType === 'OTHER' && (
              <TextField
                fullWidth
                label="Nombre de la paquetería"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="Ej: Mensajería Local XYZ"
              />
            )}
            <TextField
              fullWidth
              label="Número de guía (opcional)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Ej: 794644790301"
            />
          </Stack>
          {selectedOrders.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Pedidos a enviar:</Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {selectedOrders.map((order) => (
                  <ListItem key={order.id} sx={{ py: 0.5 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.main', fontSize: 10 }}>
                        <BusinessIcon sx={{ fontSize: 14 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={order.clientName}
                      secondary={order.bindId}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCarrierDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => carrierMutation.mutate()}
            disabled={!selectedCarrierType || (selectedCarrierType === 'OTHER' && !carrierName) || carrierMutation.isPending}
          >
            {carrierMutation.isPending ? <CircularProgress size={20} /> : 'Asignar Paquetería'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Order Card Component - Enhanced for better UX
function OrderCard({
  order,
  isSelected,
  onToggle,
}: {
  order: Order;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const priority = priorityConfig[order.priorityLevel] || priorityConfig[1];
  const status = statusConfig[order.status] || statusConfig.DRAFT;
  const fullAddress = order.addressRaw
    ? `${order.addressRaw.street || ''} ${order.addressRaw.number || ''}, ${order.addressRaw.neighborhood || ''}, ${order.addressRaw.city || ''}`
    : 'Sin dirección';

  return (
    <Card
      variant={isSelected ? 'elevation' : 'outlined'}
      sx={{
        transition: 'all 0.2s',
        ...(isSelected && {
          borderColor: 'primary.main',
          borderWidth: 2,
          bgcolor: 'action.selected',
          boxShadow: 2,
        }),
        ...(order.status === 'IN_TRANSIT' && !isSelected && {
          bgcolor: 'grey.50',
        }),
        '&:hover': {
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea onClick={onToggle} disabled={order.status === 'DELIVERED'}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          {/* Header row: Checkbox + Name + Chips */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
              <Checkbox
                checked={isSelected}
                size="medium"
                disabled={order.status === 'DELIVERED'}
                onClick={(e) => e.stopPropagation()}
                onChange={onToggle}
                sx={{ p: 0.5 }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body1" fontWeight={600} noWrap>
                  {order.clientName}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                  {order.bindId}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5} flexShrink={0}>
              <Chip size="small" label={priority.label} color={priority.color} sx={{ height: 24, fontWeight: 500 }} />
              <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 24, fontWeight: 500 }} />
            </Stack>
          </Stack>

          {/* Address row */}
          <Box sx={{ pl: 5, mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <LocationOnIcon sx={{ fontSize: 18, mt: 0.2, color: 'primary.main' }} />
              <span style={{ lineHeight: 1.4 }}>{fullAddress}</span>
            </Typography>
          </Box>

          {/* Bottom row: Amount + Driver/Carrier */}
          <Stack direction="row" spacing={2} sx={{ pl: 5 }} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" fontWeight={600} color="success.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AttachMoneyIcon sx={{ fontSize: 18 }} />
              {order.totalAmount?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
            </Typography>
            {order.assignedDriver && (
              <Chip
                size="small"
                icon={<PersonIcon sx={{ fontSize: '16px !important' }} />}
                label={`${order.assignedDriver.firstName} ${order.assignedDriver.lastName}`}
                color="primary"
                variant="outlined"
                sx={{ height: 24 }}
              />
            )}
            {order.carrierType && order.carrierType !== 'INTERNAL' && (
              <Chip
                size="small"
                icon={<BusinessIcon sx={{ fontSize: '16px !important' }} />}
                label={order.carrierName || order.carrierType}
                color="secondary"
                variant="filled"
                sx={{ height: 24 }}
              />
            )}
            {order.carrierTrackingNumber && (
              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                # {order.carrierTrackingNumber}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
