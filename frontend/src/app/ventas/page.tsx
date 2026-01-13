'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Paper,
  TextField,
  InputAdornment,
  CircularProgress,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ReceiptIcon from '@mui/icons-material/Receipt';
import StorefrontIcon from '@mui/icons-material/Storefront';

import { ordersApi } from '@/lib/api';

const statusSteps = ['Recibido', 'Preparacion', 'En Ruta', 'Entregado'];
const statusToStep: Record<string, number> = {
  DRAFT: 0,
  READY: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
};

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Recibido', color: 'default' },
  READY: { label: 'Preparacion', color: 'info' },
  IN_TRANSIT: { label: 'En Ruta', color: 'primary' },
  DELIVERED: { label: 'Entregado', color: 'success' },
};

export default function VentasPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['ventas-orders', search],
    queryFn: async () => {
      const response = await ordersApi.getAll({ search });
      return response.data.data || response.data;
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const stats = {
    inTransit: orders?.filter((o: any) => o.status === 'IN_TRANSIT').length || 0,
    delivered: orders?.filter((o: any) => o.status === 'DELIVERED').length || 0,
    pending: orders?.filter((o: any) => ['DRAFT', 'READY'].includes(o.status)).length || 0,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <StorefrontIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600}>
              Portal de Ventas
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Consulta de estatus de pedidos (Solo lectura)
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Salir
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Order List */}
        <Box sx={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
          {/* Stats */}
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={2}>
              <Card sx={{ flex: 1, bgcolor: 'primary.50' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {stats.inTransit}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    En Ruta
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, bgcolor: 'success.50' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {stats.delivered}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Entregados
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, bgcolor: 'grey.100' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700}>
                    {stats.pending}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pendientes
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Search */}
          <Box sx={{ px: 2, pb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por cliente, RFC o numero de orden..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Divider />

          {/* Orders List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : orders?.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <ReceiptIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  No se encontraron pedidos
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {orders?.map((order: any) => {
                  const status = statusConfig[order.status] || statusConfig.DRAFT;
                  return (
                    <ListItem
                      key={order.id}
                      button
                      selected={selectedOrder?.id === order.id}
                      onClick={() => setSelectedOrder(order)}
                      divider
                      sx={{ py: 2 }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={600}>
                              {order.clientName}
                            </Typography>
                            <Chip size="small" label={status.label} color={status.color} />
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {order.bindId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ${order.totalAmount?.toLocaleString() || 0}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        </Box>

        {/* Right Panel - Order Detail */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: 'grey.50' }}>
          {selectedOrder ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                {selectedOrder.clientName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Pedido: {selectedOrder.bindId}
              </Typography>

              {/* Status Stepper */}
              <Box sx={{ my: 4 }}>
                <Stepper activeStep={statusToStep[selectedOrder.status] || 0} alternativeLabel>
                  {statusSteps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Order Details */}
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.light' }}>
                    <PersonIcon color="primary" />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Cliente
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {selectedOrder.clientName}
                    </Typography>
                    {selectedOrder.clientRfc && (
                      <Typography variant="caption" color="text.secondary">
                        RFC: {selectedOrder.clientRfc}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'secondary.light' }}>
                    <LocationOnIcon color="secondary" />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Direccion de Entrega
                    </Typography>
                    <Typography variant="body1">
                      {selectedOrder.addressRaw?.street} {selectedOrder.addressRaw?.number}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedOrder.addressRaw?.neighborhood}, {selectedOrder.addressRaw?.city}
                    </Typography>
                  </Box>
                </Stack>

                {selectedOrder.assignedDriver && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'success.light' }}>
                      <LocalShippingIcon color="success" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Chofer Asignado
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedOrder.assignedDriver.firstName} {selectedOrder.assignedDriver.lastName}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {selectedOrder.estimatedArrivalStart && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'warning.light' }}>
                      <ScheduleIcon color="warning" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Hora Estimada de Llegada
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {new Date(selectedOrder.estimatedArrivalStart).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(selectedOrder.estimatedArrivalEnd).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {selectedOrder.status === 'DELIVERED' && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <CheckCircleIcon sx={{ color: 'white' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Entregado
                      </Typography>
                      <Typography variant="body1" fontWeight={500} color="success.main">
                        {selectedOrder.deliveredAt
                          ? new Date(selectedOrder.deliveredAt).toLocaleString('es-MX')
                          : 'Confirmado'}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>

              <Divider sx={{ my: 3 }} />

              {/* Amount */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body1" color="text.secondary">
                  Monto Total
                </Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  ${selectedOrder.totalAmount?.toLocaleString() || 0}
                </Typography>
              </Stack>

              {/* Internal Notes */}
              {selectedOrder.internalNotes && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Notas Internas
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.50' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedOrder.internalNotes}
                      </Typography>
                    </Paper>
                  </Box>
                </>
              )}

              {/* Address Reference/Comments */}
              {selectedOrder.addressRaw?.reference && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Comentarios del Pedido
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.100' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedOrder.addressRaw.reference}
                      </Typography>
                    </Paper>
                  </Box>
                </>
              )}
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Box sx={{ textAlign: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Selecciona un pedido para ver detalles
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
