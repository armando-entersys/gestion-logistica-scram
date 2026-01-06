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

import { useRouter } from 'next/navigation';
import { ordersApi, usersApi } from '@/lib/api';

const OrdersMap = dynamic(() => import('@/components/OrdersMap'), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#f1f5f9' }}>
      <CircularProgress size={32} />
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

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

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
      const response = await ordersApi.getAll({ status: 'READY,IN_TRANSIT,DELIVERED', limit: 100 });
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

  const stats = useMemo(() => {
    const ready = orders.filter((o) => o.status === 'READY').length;
    const inTransit = orders.filter((o) => o.status === 'IN_TRANSIT').length;
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
    const urgent = orders.filter((o) => o.priorityLevel === 3 && o.status !== 'DELIVERED').length;
    return { ready, inTransit, delivered, urgent, active: ready + inTransit };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter by tab
    if (statusFilter === 0) {
      result = result.filter((o) => o.status === 'READY' || o.status === 'IN_TRANSIT');
    } else if (statusFilter === 1) {
      result = result.filter((o) => o.status === 'READY');
    } else if (statusFilter === 2) {
      result = result.filter((o) => o.status === 'IN_TRANSIT');
    } else if (statusFilter === 3) {
      result = result.filter((o) => o.status === 'DELIVERED');
    }

    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.clientName?.toLowerCase().includes(s) ||
          o.bindId?.toLowerCase().includes(s) ||
          o.clientRfc?.toLowerCase().includes(s) ||
          o.assignedDriver?.firstName?.toLowerCase().includes(s) ||
          o.assignedDriver?.lastName?.toLowerCase().includes(s)
      );
    }

    // Sort: urgent first, then by status
    result.sort((a, b) => {
      if (a.priorityLevel !== b.priorityLevel) return b.priorityLevel - a.priorityLevel;
      if (a.status === 'READY' && b.status !== 'READY') return -1;
      if (b.status === 'READY' && a.status !== 'READY') return 1;
      return 0;
    });

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
      if (!selectedDriverId || selectedOrderIds.length === 0) throw new Error('Selecciona chofer y pedidos');
      return ordersApi.dispatch(selectedDriverId, selectedOrderIds, startTime);
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `Ruta despachada: ${response.data.dispatched} pedidos`,
        severity: 'success',
      });
      setSelectedOrderIds([]);
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
        trackingNumber || undefined
      );
    },
    onSuccess: (response) => {
      setSnackbar({ open: true, message: `${response.data.assigned} pedidos asignados a paquetería`, severity: 'success' });
      setSelectedOrderIds([]);
      setSelectedCarrierType('');
      setCarrierName('');
      setTrackingNumber('');
      setCarrierDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Error', severity: 'error' });
    },
  });

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    const selectableIds = filteredOrders.filter((o) => o.status === 'READY').map((o) => o.id);
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
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'white',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box component="img" src="/scram-logo.png" alt="SCRAM" sx={{ height: 32 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600} color="text.primary" lineHeight={1.2}>
                Panel de Tráfico
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Planificación y despacho
              </Typography>
            </Box>
          </Stack>

          {/* Inline Stats */}
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            <StatBadge icon={<InventoryIcon />} value={stats.ready} label="Listos" color="#0284c7" />
            <StatBadge icon={<LocalShippingIcon />} value={stats.inTransit} label="En Ruta" color="#0d9488" />
            <StatBadge icon={<CheckCircleIcon />} value={stats.delivered} label="Entregados" color="#16a34a" />
            {stats.urgent > 0 && (
              <StatBadge icon={<WarningAmberIcon />} value={stats.urgent} label="Urgentes" color="#dc2626" />
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Actualizar">
              <IconButton onClick={() => refetch()} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Usuarios">
              <IconButton onClick={() => router.push('/usuarios')} size="small">
                <PeopleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cerrar sesión">
              <IconButton onClick={handleLogout} size="small" color="error">
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
            onChange={(_, v) => setStatusFilter(v)}
            variant="fullWidth"
            sx={{
              minHeight: 40,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': { minHeight: 40, py: 0, fontSize: '0.8125rem' },
            }}
          >
            <Tab label={`Activos (${stats.active})`} />
            <Tab label={`Listos (${stats.ready})`} />
            <Tab label={`En Ruta (${stats.inTransit})`} />
            <Tab label={`Entregados (${stats.delivered})`} />
          </Tabs>

          {/* Orders List - Maximum vertical space */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredOrders.length === 0 ? (
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
                  />
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
            <OrdersMap orders={filteredOrders} selectedIds={selectedOrderIds} onOrderClick={toggleOrderSelection} />
            {selectedOrderIds.length > 0 && (
              <Chip
                label={`${selectedOrderIds.length} seleccionados`}
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  bgcolor: 'rgba(255,255,255,0.95)',
                  boxShadow: 1,
                }}
              />
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
                <Chip key={order.id} size="small" label={`${i + 1}. ${order.clientName}`} sx={{ mr: 0.5, mb: 0.5 }} />
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
        <DialogTitle>Asignar Paquetería</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedOrderIds.length} pedido(s) seleccionado(s)
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Paquetería</InputLabel>
              <Select value={selectedCarrierType} label="Paquetería" onChange={(e) => setSelectedCarrierType(e.target.value)}>
                {carrierTypes?.filter((ct) => ct.value !== 'INTERNAL').map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedCarrierType === 'OTHER' && (
              <TextField size="small" fullWidth label="Nombre de paquetería" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
            )}
            <TextField size="small" fullWidth label="Número de guía (opcional)" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCarrierDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="secondary" onClick={() => carrierMutation.mutate()} disabled={!selectedCarrierType || (selectedCarrierType === 'OTHER' && !carrierName) || carrierMutation.isPending}>
            {carrierMutation.isPending ? <CircularProgress size={20} /> : 'Asignar'}
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
function OrderCard({ order, isSelected, onToggle }: { order: Order; isSelected: boolean; onToggle: () => void }) {
  const priority = priorityConfig[order.priorityLevel] || priorityConfig[1];
  const status = statusConfig[order.status] || statusConfig.DRAFT;
  const isDelivered = order.status === 'DELIVERED';
  const isUrgent = order.priorityLevel === 3;

  const address = order.addressRaw
    ? `${order.addressRaw.neighborhood || ''}, ${order.addressRaw.city || ''}`
    : 'Sin dirección';

  return (
    <Card
      variant="outlined"
      sx={{
        transition: 'all 0.15s',
        borderColor: isSelected ? 'primary.main' : isUrgent ? 'error.light' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        bgcolor: isSelected ? alpha('#0d9488', 0.04) : isDelivered ? '#f8fafc' : 'white',
        opacity: isDelivered ? 0.7 : 1,
        '&:hover': { borderColor: isSelected ? 'primary.main' : 'primary.light' },
      }}
    >
      <CardActionArea onClick={onToggle} disabled={isDelivered}>
        <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Checkbox
              checked={isSelected}
              size="small"
              disabled={isDelivered}
              onClick={(e) => e.stopPropagation()}
              onChange={onToggle}
              sx={{ p: 0, mt: 0.25 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{order.clientName}</Typography>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">{order.bindId}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexShrink={0}>
                  {isUrgent && <Chip size="small" label="Urgente" color="error" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }} />}
                  <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }} />
                </Stack>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <LocationOnIcon sx={{ fontSize: 14 }} /> {address}
                </Typography>
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
      </CardActionArea>
    </Card>
  );
}
