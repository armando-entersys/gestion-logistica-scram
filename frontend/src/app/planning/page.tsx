'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
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
  Fab,
  Badge,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MapIcon from '@mui/icons-material/Map';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';

import { useRouter } from 'next/navigation';
import { useOrdersStore, Order, Driver } from '@/store/orders.store';
import { ordersApi, usersApi, routesApi, syncApi } from '@/lib/api';

const priorityConfig: Record<number, { label: string; color: 'default' | 'warning' | 'error'; icon?: React.ReactNode }> = {
  1: { label: 'Normal', color: 'default' },
  2: { label: 'Alta', color: 'warning', icon: <AttachMoneyIcon fontSize="small" /> },
  3: { label: 'Crítica', color: 'error', icon: <WarningIcon fontSize="small" /> },
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
  const [startTime, setStartTime] = useState('09:00');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const {
    orders,
    selectedOrderIds,
    selectedDriverId,
    setOrders,
    toggleOrderSelection,
    selectAllOrders,
    clearSelection,
    setSelectedDriver,
  } = useOrdersStore();

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['planning-orders'],
    queryFn: async () => {
      const response = await routesApi.getPlanning();
      return response.data;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await usersApi.getDrivers();
      return response.data as Driver[];
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriverId || selectedOrderIds.length === 0) {
        throw new Error('Selecciona chofer y pedidos');
      }
      return ordersApi.dispatch(selectedDriverId, selectedOrderIds, startTime);
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `Ruta despachada: ${response.data.dispatched} pedidos, ${response.data.emailsQueued} emails enviados`,
        severity: 'success',
      });
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al despachar ruta',
        severity: 'error',
      });
    },
  });

  const syncBindMutation = useMutation({
    mutationFn: async () => {
      return syncApi.syncBind();
    },
    onSuccess: (response) => {
      const data = response.data;
      setSnackbar({
        open: true,
        message: `Sincronización completada: ${data.created || 0} nuevos, ${data.updated || 0} actualizados`,
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al sincronizar con Bind ERP',
        severity: 'error',
      });
    },
  });

  useEffect(() => {
    if (ordersData) {
      setOrders(ordersData);
    }
  }, [ordersData, setOrders]);

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const canDispatch = selectedDriverId && selectedOrderIds.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <LocalShippingIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600}>
              Panel de Tráfico
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Planificación y despacho de rutas
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={syncBindMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
              onClick={() => syncBindMutation.mutate()}
              disabled={syncBindMutation.isPending}
            >
              Sincronizar Bind
            </Button>
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

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Order List */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
          {/* Filters */}
          <Paper sx={{ p: 2, borderRadius: 0 }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedOrderIds.length} de {orders.length} seleccionados
              </Typography>
              <Stack direction="row" spacing={1}>
                {selectedOrderIds.length > 0 && (
                  <Button size="small" onClick={clearSelection}>
                    Limpiar
                  </Button>
                )}
                <Button size="small" onClick={() => selectAllOrders(orders.map((o) => o.id))}>
                  Seleccionar todos
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
                <InputLabel>Chofer</InputLabel>
                <Select
                  value={selectedDriverId || ''}
                  label="Chofer"
                  onChange={(e) => setSelectedDriver(e.target.value || null)}
                >
                  <MenuItem value="">
                    <em>Seleccionar chofer...</em>
                  </MenuItem>
                  {drivers?.map((driver) => (
                    <MenuItem key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="time"
                label="Hora inicio"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                sx={{ width: 140 }}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Paper>

          <Divider />

          {/* Orders List */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : orders.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <LocalShippingIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  No hay pedidos pendientes de planificación
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {orders.map((order) => (
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

          {/* Dispatch Button */}
          <Paper sx={{ p: 2, borderRadius: 0 }} elevation={2}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={!canDispatch || dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate()}
              startIcon={dispatchMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              sx={{ py: 1.5 }}
            >
              Confirmar Despacho ({selectedOrderIds.length} pedidos)
            </Button>
          </Paper>
        </Box>

        {/* Right Panel - Map */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.100' }}>
          <Paper sx={{ p: 2, borderRadius: 0 }} elevation={0}>
            <Typography variant="h6" fontWeight={600}>
              Mapa de Rutas
            </Typography>
          </Paper>

          <Divider />

          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'grey.300', mx: 'auto', mb: 2 }}>
                <MapIcon sx={{ fontSize: 48, color: 'grey.500' }} />
              </Avatar>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Mapa Interactivo
              </Typography>
              <Typography variant="body2" color="text.disabled" mb={4}>
                Integrar con Google Maps API
              </Typography>

              {/* Selected Orders Preview */}
              {selectedOrders.length > 0 && (
                <Paper sx={{ p: 2, textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Ruta planificada ({selectedOrders.length} paradas):
                  </Typography>
                  <List dense>
                    {selectedOrders.map((order, index) => (
                      <ListItem key={order.id} sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 14 }}>
                            {index + 1}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={order.clientName}
                          secondary={`${order.addressRaw.neighborhood}, ${order.addressRaw.city}`}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

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

// Order Card Component
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

  return (
    <Card
      variant={isSelected ? 'elevation' : 'outlined'}
      sx={{
        transition: 'all 0.2s',
        ...(isSelected && {
          borderColor: 'primary.main',
          borderWidth: 2,
          bgcolor: 'primary.50',
        }),
      }}
    >
      <CardActionArea onClick={onToggle} sx={{ p: 0 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Checkbox
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={onToggle}
                color="primary"
              />
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {order.clientName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {order.bindId}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                label={priority.label}
                color={priority.color}
                icon={priority.icon as React.ReactElement}
              />
              <Chip
                size="small"
                label={status.label}
                color={status.color}
                variant="outlined"
              />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={3}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {order.addressRaw.neighborhood}, {order.addressRaw.city}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AttachMoneyIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                ${order.totalAmount.toLocaleString()}
              </Typography>
            </Stack>
          </Stack>

          {order.assignedDriver && (
            <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
              <PersonIcon fontSize="small" color="primary" />
              <Typography variant="body2" color="primary">
                {order.assignedDriver.firstName} {order.assignedDriver.lastName}
              </Typography>
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
