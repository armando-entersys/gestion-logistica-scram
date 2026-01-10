import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import axios from 'axios';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Paper,
  Stack,
  Card,
  CardContent,
  Avatar,
  Button,
  Chip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import NavigationIcon from '@mui/icons-material/Navigation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EditLocationIcon from '@mui/icons-material/EditLocation';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';

import {
  db,
  saveOrdersLocally,
  getActiveRoute,
  clearSession,
  getSession,
  LocalOrder,
} from '@/lib/db';
import useSync from '@/hooks/useSync';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface AddressChangeRequest {
  id: string;
  orderId: string;
  order: {
    id: string;
    orderNumber?: string;
    bindId: string;
    clientName: string;
  };
  oldAddress: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    postalCode?: string;
  };
  newAddress: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    postalCode?: string;
  };
  requestedBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export default function RoutePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { isOnline, triggerSync } = useSync();

  // Address change requests state
  const [addressChangeRequests, setAddressChangeRequests] = useState<AddressChangeRequest[]>([]);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState<string | null>(null);

  // Return order state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returningOrder, setReturningOrder] = useState<LocalOrder | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Live query for orders
  const orders = useLiveQuery(() => getActiveRoute(), []);
  const session = useLiveQuery(() => db.session.toCollection().first());

  // Fetch route from server
  const fetchRoute = async () => {
    if (!isOnline) return;

    setIsLoading(true);
    try {
      const sessionData = await getSession();
      if (!sessionData?.token) return;

      const response = await axios.get(`${API_URL}/orders/my-route`, {
        headers: { Authorization: `Bearer ${sessionData.token}` },
      });

      await saveOrdersLocally(response.data);
    } catch (error) {
      console.error('Error fetching route:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRoute();
    fetchAddressChangeRequests();
  }, []);

  const handleLogout = async () => {
    await clearSession();
    navigate('/login');
  };

  // Fetch address change requests
  const fetchAddressChangeRequests = async () => {
    if (!isOnline) return;

    try {
      const sessionData = await getSession();
      if (!sessionData?.token) return;

      const response = await axios.get(`${API_URL}/orders/address-change-requests`, {
        headers: { Authorization: `Bearer ${sessionData.token}` },
      });

      setAddressChangeRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching address change requests:', error);
    }
  };

  // Respond to address change request
  const respondToAddressChange = async (requestId: string, approved: boolean, reason?: string) => {
    if (!isOnline) return;

    setProcessingRequestId(requestId);
    try {
      const sessionData = await getSession();
      if (!sessionData?.token) return;

      await axios.patch(
        `${API_URL}/orders/address-change-request/${requestId}/respond`,
        { approved, rejectionReason: reason },
        { headers: { Authorization: `Bearer ${sessionData.token}` } }
      );

      // Remove from local list
      setAddressChangeRequests((prev) => prev.filter((r) => r.id !== requestId));
      setShowRejectionInput(null);
      setRejectionReason('');

      // Refresh route if approved
      if (approved) {
        fetchRoute();
      }
    } catch (error) {
      console.error('Error responding to address change:', error);
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Return order
  const handleReturnOrder = async () => {
    if (!returningOrder || !returnReason.trim()) return;

    setIsReturning(true);
    try {
      const sessionData = await getSession();
      if (!sessionData?.token) return;

      await axios.post(
        `${API_URL}/orders/return`,
        {
          orderId: returningOrder.id,
          reason: returnReason.trim(),
          notes: returnNotes.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${sessionData.token}` } }
      );

      // Remove order from local DB
      await db.orders.delete(returningOrder.id);

      // Close dialog and reset
      setReturnDialogOpen(false);
      setReturningOrder(null);
      setReturnReason('');
      setReturnNotes('');
    } catch (error) {
      console.error('Error returning order:', error);
    } finally {
      setIsReturning(false);
    }
  };

  const openReturnDialog = (order: LocalOrder) => {
    setReturningOrder(order);
    setReturnDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchRoute();
    fetchAddressChangeRequests();
    triggerSync();
  };

  const openNavigation = (order: LocalOrder) => {
    const address = `${order.addressRaw.street} ${order.addressRaw.number}, ${order.addressRaw.neighborhood}, ${order.addressRaw.city}`;
    const encodedAddress = encodeURIComponent(address);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    window.open(googleMapsUrl, '_blank');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const deliveredCount = orders?.filter((o) => o.status === 'DELIVERED').length || 0;
  const pendingCount = orders?.filter((o) => o.status !== 'DELIVERED').length || 0;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Mi Ruta
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Hola, {session?.firstName || 'Chofer'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={() => setAddressDialogOpen(true)}>
              <Badge badgeContent={addressChangeRequests.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <RefreshIcon sx={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
            <IconButton onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Stats Bar */}
      <Paper
        sx={{
          py: 2,
          px: 3,
          bgcolor: 'primary.main',
          borderRadius: 0,
          display: 'flex',
          justifyContent: 'space-around',
        }}
        elevation={0}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} color="white">
            {orders?.length || 0}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Paradas
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} color="white">
            {deliveredCount}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Entregados
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} color="white">
            {pendingCount}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Pendientes
          </Typography>
        </Box>
      </Paper>

      {/* Orders List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          pb: 'calc(16px + var(--safe-area-inset-bottom, 0px))',
        }}
      >
        {!orders || orders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocalShippingIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tienes entregas asignadas
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Espera a que te asignen una ruta
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {orders.map((order, index) => (
              <OrderCard
                key={order.id}
                order={order}
                position={index + 1}
                onNavigate={() => openNavigation(order)}
                onCall={() => order.clientPhone && handleCall(order.clientPhone)}
                onDeliver={() => navigate(`/delivery/${order.id}`)}
                onReturn={() => openReturnDialog(order)}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Address Change Requests Dialog */}
      <Dialog open={addressDialogOpen} onClose={() => setAddressDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <EditLocationIcon color="warning" />
              <Typography variant="h6">Cambios de Dirección</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setAddressDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {addressChangeRequests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                No hay solicitudes pendientes
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {addressChangeRequests.map((request) => (
                <Card key={request.id} variant="outlined">
                  <CardContent sx={{ pb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      {request.order?.orderNumber || request.order?.bindId?.substring(0, 8)}
                      {' - '}
                      {request.order?.clientName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Solicitado por: {request.requestedBy?.firstName} {request.requestedBy?.lastName}
                    </Typography>

                    <Divider sx={{ my: 1 }} />

                    <Typography variant="caption" color="error.main" fontWeight={600}>
                      Dirección anterior:
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {[
                        request.oldAddress?.street,
                        request.oldAddress?.number,
                        request.oldAddress?.neighborhood,
                        request.oldAddress?.city,
                      ].filter(Boolean).join(', ')}
                    </Typography>

                    <Typography variant="caption" color="success.main" fontWeight={600}>
                      Nueva dirección:
                    </Typography>
                    <Typography variant="body2" color="text.primary" fontWeight={500} gutterBottom>
                      {[
                        request.newAddress?.street,
                        request.newAddress?.number,
                        request.newAddress?.neighborhood,
                        request.newAddress?.city,
                      ].filter(Boolean).join(', ')}
                    </Typography>

                    {showRejectionInput === request.id ? (
                      <Stack spacing={1} sx={{ mt: 2 }}>
                        <TextField
                          size="small"
                          label="Motivo del rechazo"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          fullWidth
                          multiline
                          rows={2}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setShowRejectionInput(null);
                              setRejectionReason('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => respondToAddressChange(request.id, false, rejectionReason)}
                            disabled={!rejectionReason.trim() || processingRequestId === request.id}
                          >
                            {processingRequestId === request.id ? <CircularProgress size={16} /> : 'Confirmar Rechazo'}
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<CloseIcon />}
                          onClick={() => setShowRejectionInput(request.id)}
                          disabled={processingRequestId !== null}
                        >
                          Rechazar
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={processingRequestId === request.id ? <CircularProgress size={16} /> : <CheckIcon />}
                          onClick={() => respondToAddressChange(request.id, true)}
                          disabled={processingRequestId !== null}
                        >
                          Aprobar
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Order Dialog */}
      <Dialog open={returnDialogOpen} onClose={() => setReturnDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <UndoIcon color="warning" />
            <Typography variant="h6">Devolver Pedido</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {returningOrder && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="warning">
                El pedido será devuelto y deberá ser reasignado desde el panel de administración.
              </Alert>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {returningOrder.clientName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {returningOrder.addressRaw.street} {returningOrder.addressRaw.number}
                </Typography>
              </Paper>

              <TextField
                label="Motivo de devolución *"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                fullWidth
                required
                placeholder="Ej: Cliente no se encontraba, dirección incorrecta..."
              />

              <TextField
                label="Notas adicionales"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Información adicional..."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setReturnDialogOpen(false);
              setReturningOrder(null);
              setReturnReason('');
              setReturnNotes('');
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleReturnOrder}
            disabled={!returnReason.trim() || isReturning}
            startIcon={isReturning ? <CircularProgress size={16} /> : <UndoIcon />}
          >
            Devolver Pedido
          </Button>
        </DialogActions>
      </Dialog>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}

interface OrderCardProps {
  order: LocalOrder;
  position: number;
  onNavigate: () => void;
  onCall: () => void;
  onDeliver: () => void;
  onReturn: () => void;
}

function OrderCard({ order, position, onNavigate, onCall, onDeliver, onReturn }: OrderCardProps) {
  const isDelivered = order.status === 'DELIVERED';
  const etaStart = order.estimatedArrivalStart
    ? new Date(order.estimatedArrivalStart).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card sx={{ opacity: isDelivered ? 0.6 : 1 }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: isDelivered ? 'success.main' : 'primary.main',
                fontSize: 14,
              }}
            >
              {isDelivered ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : position}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {order.clientName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {order.bindId}
              </Typography>
            </Box>
          </Stack>
          {etaStart && !isDelivered && (
            <Chip
              size="small"
              icon={<AccessTimeIcon />}
              label={etaStart}
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>

        {/* Address */}
        <Stack direction="row" spacing={1} alignItems="flex-start" mb={2}>
          <LocationOnIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
          <Box>
            <Typography variant="body2" color="text.secondary">
              {order.addressRaw.street} {order.addressRaw.number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {order.addressRaw.neighborhood}, {order.addressRaw.city}
            </Typography>
            {order.addressRaw.reference && (
              <Typography variant="caption" color="text.disabled" fontStyle="italic">
                {order.addressRaw.reference}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Actions */}
        {!isDelivered && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<NavigationIcon />}
                onClick={onNavigate}
                sx={{ flex: 1 }}
              >
                Navegar
              </Button>
              {order.clientPhone && (
                <IconButton onClick={onCall} sx={{ border: 1, borderColor: 'divider' }}>
                  <PhoneIcon />
                </IconButton>
              )}
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={onDeliver}
                sx={{ flex: 1 }}
              >
                Entregar
              </Button>
            </Stack>
            <Button
              variant="text"
              color="warning"
              size="small"
              startIcon={<UndoIcon />}
              onClick={onReturn}
              fullWidth
            >
              No puedo entregar
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
