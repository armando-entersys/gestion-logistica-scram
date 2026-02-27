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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InventoryIcon from '@mui/icons-material/Inventory';

import {
  db,
  saveOrdersLocally,
  saveRouteStopsLocally,
  getActiveRoute,
  getActiveRouteItems,
  clearAllData,
  getSession,
  LocalOrder,
  LocalRouteStop,
  confirmPickupLocally,
  markEnRouteLocally,
  getPendingPickupOrders,
} from '@/lib/db';
import useSync from '@/hooks/useSync';
import { subscribeToPush, isSubscribedToPush } from '@/lib/push';

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
  const [returnError, setReturnError] = useState<string | null>(null);

  // Pickup confirmation state
  const [pickupIssueDialogOpen, setPickupIssueDialogOpen] = useState(false);
  const [pickupIssueOrder, setPickupIssueOrder] = useState<LocalOrder | null>(null);
  const [pickupIssueNotes, setPickupIssueNotes] = useState('');
  const [isConfirmingPickup, setIsConfirmingPickup] = useState<string | null>(null);
  const [isMarkingEnRoute, setIsMarkingEnRoute] = useState<string | null>(null);

  // Live query for orders and route items
  const orders = useLiveQuery(() => getActiveRoute(), []);
  const routeItems = useLiveQuery(() => getActiveRouteItems(), []);
  const session = useLiveQuery(() => db.session.toCollection().first());
  const pendingPickupOrders = useLiveQuery(() => getPendingPickupOrders(), []);

  // Check if all orders have been confirmed for pickup
  const allOrdersConfirmed = !pendingPickupOrders || pendingPickupOrders.length === 0;
  const confirmedOrders = orders?.filter((o) => o.pickupConfirmedAt) || [];

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

      // Handle both old format (array) and new format ({ orders, routeStops })
      const data = response.data;
      if (Array.isArray(data)) {
        // Legacy format: array of orders
        await saveOrdersLocally(data);
      } else if (data.orders) {
        // New format: { orders, routeStops }
        await saveOrdersLocally(data.orders);
        if (data.routeStops) {
          await saveRouteStopsLocally(data.routeStops);
        }
      }
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

  // Subscribe to push notifications
  useEffect(() => {
    const initPush = async () => {
      try {
        const sessionData = await getSession();
        if (!sessionData?.token) return;

        const alreadySubscribed = await isSubscribedToPush();
        if (!alreadySubscribed) {
          const success = await subscribeToPush(sessionData.token);
          if (success) {
            console.log('Push notifications enabled');
          }
        }
      } catch (error) {
        console.error('Error initializing push:', error);
      }
    };

    initPush();
  }, []);

  const handleLogout = async () => {
    // Clear all local data (orders, pending sync, evidence, session)
    await clearAllData();
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
    setReturnError(null);
    try {
      const sessionData = await getSession();
      if (!sessionData?.token) {
        setReturnError('Sesión expirada. Por favor inicia sesión de nuevo.');
        return;
      }

      console.log('Returning order:', returningOrder.id, 'Reason:', returnReason.trim());

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
      setReturnError(null);
    } catch (error: any) {
      console.error('Error returning order:', error);
      const message = error.response?.data?.message || error.message || 'Error al devolver el pedido';
      setReturnError(message);
    } finally {
      setIsReturning(false);
    }
  };

  const openReturnDialog = (order: LocalOrder) => {
    setReturningOrder(order);
    setReturnDialogOpen(true);
    setReturnError(null);
  };

  // Confirm pickup of an order
  const handleConfirmPickup = async (order: LocalOrder, hasIssue: boolean = false, issueNotes?: string) => {
    setIsConfirmingPickup(order.id);
    try {
      await confirmPickupLocally(order.id, hasIssue, issueNotes);
      triggerSync();
    } catch (error) {
      console.error('Error confirming pickup:', error);
    } finally {
      setIsConfirmingPickup(null);
      if (hasIssue) {
        setPickupIssueDialogOpen(false);
        setPickupIssueOrder(null);
        setPickupIssueNotes('');
      }
    }
  };

  // Open pickup issue dialog
  const openPickupIssueDialog = (order: LocalOrder) => {
    setPickupIssueOrder(order);
    setPickupIssueDialogOpen(true);
    setPickupIssueNotes('');
  };

  // Mark order as en-route
  const handleMarkEnRoute = async (order: LocalOrder) => {
    setIsMarkingEnRoute(order.id);
    try {
      let etaDurationMinutes: number | undefined;

      // Try to get real-time ETA from Google Maps
      try {
        // Get driver's current location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 60000,
          });
        });

        const origin = `${position.coords.latitude},${position.coords.longitude}`;
        const destination = order.latitude && order.longitude
          ? `${order.latitude},${order.longitude}`
          : `${order.addressRaw.street} ${order.addressRaw.number}, ${order.addressRaw.neighborhood}, ${order.addressRaw.city}`;

        // Call Google Maps Distance Matrix API
        const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (GOOGLE_MAPS_API_KEY) {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/distancematrix/json`,
            {
              params: {
                origins: origin,
                destinations: destination,
                key: GOOGLE_MAPS_API_KEY,
                departure_time: 'now',
                traffic_model: 'best_guess',
              },
            }
          );

          if (response.data.status === 'OK' && response.data.rows[0]?.elements[0]?.status === 'OK') {
            const durationInSeconds = response.data.rows[0].elements[0].duration_in_traffic?.value
              || response.data.rows[0].elements[0].duration?.value;

            if (durationInSeconds) {
              etaDurationMinutes = Math.ceil(durationInSeconds / 60);
              console.log(`[En-Route] Real-time ETA: ${etaDurationMinutes} minutes`);
            }
          }
        }
      } catch (geoError) {
        console.warn('[En-Route] Could not get real-time ETA:', geoError);
        // Continue without ETA - backend will use database estimates
      }

      await markEnRouteLocally(order.id, etaDurationMinutes);
      triggerSync();
    } catch (error) {
      console.error('Error marking en-route:', error);
    } finally {
      setIsMarkingEnRoute(null);
    }
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
      <AppBar position="static" sx={{ bgcolor: '#0e314c' }} elevation={1}>
        <Toolbar>
          <Box
            component="img"
            src="/scram-logo.png"
            alt="SCRAM"
            sx={{ height: 32, mr: 1.5 }}
          />
          <Box
            sx={{
              width: 3,
              height: 28,
              background: 'linear-gradient(180deg, #ff9900 0%, #44ce6f 100%)',
              borderRadius: 2,
              mr: 1.5,
            }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700} color="white">
              Mi Ruta
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Hola, {session?.firstName || 'Chofer'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={() => setAddressDialogOpen(true)} sx={{ color: 'rgba(255,255,255,0.8)' }}>
              <Badge badgeContent={addressChangeRequests.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton onClick={handleRefresh} disabled={isLoading} sx={{ color: 'rgba(255,255,255,0.8)' }}>
              <RefreshIcon sx={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
            <IconButton onClick={handleLogout} sx={{ color: '#ff6b6b' }}>
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

      {/* Pickup Confirmation Section */}
      {pendingPickupOrders && pendingPickupOrders.length > 0 && (
        <Paper
          sx={{
            mx: 2,
            mt: 2,
            p: 2,
            bgcolor: 'warning.light',
            borderRadius: 2,
          }}
          elevation={2}
        >
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <InventoryIcon color="warning" />
            <Typography variant="subtitle1" fontWeight={700} color="warning.dark">
              Confirmar Recepcion de Pedidos
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Confirma que recibiste correctamente cada pedido antes de salir a ruta.
          </Typography>
          <Stack spacing={1.5}>
            {pendingPickupOrders.map((order) => (
              <Paper key={order.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {order.orderNumber || order.bindId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {order.clientName}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<WarningAmberIcon />}
                      onClick={() => openPickupIssueDialog(order)}
                      disabled={isConfirmingPickup !== null}
                    >
                      Problema
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={
                        isConfirmingPickup === order.id ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <CheckIcon />
                        )
                      }
                      onClick={() => handleConfirmPickup(order)}
                      disabled={isConfirmingPickup !== null}
                    >
                      Confirmar
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
          {confirmedOrders.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              {confirmedOrders.length} pedido(s) confirmado(s)
            </Typography>
          )}
        </Paper>
      )}

      {/* Orders List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          pb: 'calc(16px + var(--safe-area-inset-bottom, 0px))',
        }}
      >
        {(!routeItems || routeItems.length === 0) && (!orders || orders.length === 0) ? (
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
            {(routeItems || []).map((item, index) => {
              if (item._type === 'order') {
                const order = item as LocalOrder & { _type: 'order' };
                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    position={order.routePosition || index + 1}
                    onNavigate={() => openNavigation(order)}
                    onCall={() => order.clientPhone && handleCall(order.clientPhone)}
                    onDeliver={() => navigate(`/delivery/${order.id}`)}
                    onReturn={() => openReturnDialog(order)}
                    onEnRoute={() => handleMarkEnRoute(order)}
                    isMarkingEnRoute={isMarkingEnRoute === order.id}
                    allOrdersConfirmed={allOrdersConfirmed}
                  />
                );
              } else {
                const stop = item as LocalRouteStop & { _type: 'stop' };
                return (
                  <RouteStopCard
                    key={`stop-${stop.id}`}
                    stop={stop}
                    position={stop.routePosition || index + 1}
                    onNavigate={() => {
                      if (stop.addressRaw) {
                        const address = `${stop.addressRaw.street || ''} ${stop.addressRaw.number || ''}, ${stop.addressRaw.neighborhood || ''}, ${stop.addressRaw.city || ''}`;
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                      }
                    }}
                    onCall={() => stop.contactPhone && handleCall(stop.contactPhone)}
                    onComplete={() => navigate(`/complete-stop/${stop.id}`)}
                  />
                );
              }
            })}
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

              {returnError && (
                <Alert severity="error">{returnError}</Alert>
              )}
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
              setReturnError(null);
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

      {/* Pickup Issue Dialog */}
      <Dialog open={pickupIssueDialogOpen} onClose={() => setPickupIssueDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon color="warning" />
            <Typography variant="h6">Reportar Problema</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {pickupIssueOrder && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                Puedes confirmar la recepcion del pedido aunque tenga un problema. Se notificara al equipo de trafico.
              </Alert>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {pickupIssueOrder.bindId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pickupIssueOrder.clientName}
                </Typography>
              </Paper>

              <TextField
                label="Describe el problema *"
                value={pickupIssueNotes}
                onChange={(e) => setPickupIssueNotes(e.target.value)}
                fullWidth
                required
                multiline
                rows={3}
                placeholder="Ej: Falta 1 caja del producto X, empaque danado..."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setPickupIssueDialogOpen(false);
              setPickupIssueOrder(null);
              setPickupIssueNotes('');
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => pickupIssueOrder && handleConfirmPickup(pickupIssueOrder, true, pickupIssueNotes)}
            disabled={!pickupIssueNotes.trim() || isConfirmingPickup !== null}
            startIcon={isConfirmingPickup ? <CircularProgress size={16} /> : <WarningAmberIcon />}
          >
            Confirmar con Problema
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
  onEnRoute: () => void;
  isMarkingEnRoute: boolean;
  allOrdersConfirmed: boolean;
}

function OrderCard({ order, position, onNavigate, onCall, onDeliver, onReturn, onEnRoute, isMarkingEnRoute, allOrdersConfirmed }: OrderCardProps) {
  const isDelivered = order.status === 'DELIVERED';
  const isConfirmed = !!order.pickupConfirmedAt;
  const isEnRoute = !!order.enRouteAt;
  const canStartRoute = allOrdersConfirmed && isConfirmed;

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
                {order.orderNumber || order.bindId}
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

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <Box sx={{ mb: 2, bgcolor: 'grey.50', p: 1, borderRadius: 1, border: '1px dashed', borderColor: 'grey.300' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
              Conceptos ({order.items.length})
            </Typography>
            <Stack spacing={0.5}>
              {order.items.map((item, idx) => (
                <Typography key={idx} variant="caption" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ flex: 1 }}>• {item.name}</span>
                  <span style={{ fontWeight: 700, marginLeft: 8, whiteSpace: 'nowrap' }}>x{item.quantity}</span>
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {/* Status Indicators */}
        {!isDelivered && (isConfirmed || isEnRoute) && (
          <Stack direction="row" spacing={1} mb={1}>
            {isConfirmed && (
              <Chip
                size="small"
                icon={<CheckCircleIcon />}
                label={order.pickupHasIssue ? 'Recibido (con problema)' : 'Recibido'}
                color={order.pickupHasIssue ? 'warning' : 'success'}
                variant="outlined"
              />
            )}
            {isEnRoute && (
              <Chip
                size="small"
                icon={<DirectionsCarIcon />}
                label="En camino"
                color="info"
                variant="filled"
              />
            )}
          </Stack>
        )}

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
              {!isEnRoute ? (
                <Button
                  variant="contained"
                  color="info"
                  startIcon={isMarkingEnRoute ? <CircularProgress size={16} color="inherit" /> : <DirectionsCarIcon />}
                  onClick={onEnRoute}
                  disabled={!canStartRoute || isMarkingEnRoute}
                  sx={{ flex: 1 }}
                >
                  Voy en camino
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={onDeliver}
                  sx={{ flex: 1 }}
                >
                  Entregar
                </Button>
              )}
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

// ── Route Stop Card ──────────────────────────────────────

interface RouteStopCardProps {
  stop: LocalRouteStop;
  position: number;
  onNavigate: () => void;
  onCall: () => void;
  onComplete: () => void;
}

function RouteStopCard({ stop, position, onNavigate, onCall, onComplete }: RouteStopCardProps) {
  const isPickup = stop.stopType === 'PICKUP';
  const icon = isPickup ? '📥' : '📄';
  const typeLabel = isPickup ? 'Recolección' : 'Documentación';
  const bgColor = isPickup ? '#e3f2fd' : '#f3e5f5';
  const borderColor = isPickup ? '#1976d2' : '#9c27b0';

  const etaStart = stop.estimatedArrivalStart
    ? new Date(stop.estimatedArrivalStart).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;

  return (
    <Card sx={{ borderLeft: `4px solid ${borderColor}`, bgcolor: bgColor }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: borderColor,
                fontSize: 16,
              }}
            >
              {position}
            </Avatar>
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="body2">{icon}</Typography>
                <Typography variant="caption" fontWeight={700} color={borderColor}>
                  {typeLabel}
                </Typography>
              </Stack>
              <Typography variant="subtitle1" fontWeight={600}>
                {stop.clientName}
              </Typography>
            </Box>
          </Stack>
          {etaStart && (
            <Chip
              size="small"
              icon={<AccessTimeIcon />}
              label={etaStart}
              color={isPickup ? 'primary' : 'secondary'}
              variant="outlined"
            />
          )}
        </Stack>

        {/* Address */}
        {stop.addressRaw && (
          <Stack direction="row" spacing={1} alignItems="flex-start" mb={1}>
            <LocationOnIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
            <Box>
              <Typography variant="body2" color="text.secondary">
                {stop.addressRaw.street} {stop.addressRaw.number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stop.addressRaw.neighborhood}, {stop.addressRaw.city}
              </Typography>
            </Box>
          </Stack>
        )}

        {/* Description */}
        {stop.description && (
          <Typography variant="body2" color="text.secondary" mb={1} fontStyle="italic">
            {stop.description}
          </Typography>
        )}

        {/* Items */}
        {stop.itemsDescription && (
          <Box sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.7)', p: 1, borderRadius: 1, border: '1px dashed', borderColor: 'grey.400' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              {isPickup ? 'A recoger:' : 'Documentos:'}
            </Typography>
            <Typography variant="body2" color="text.secondary">{stop.itemsDescription}</Typography>
          </Box>
        )}

        {/* Actions */}
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
          {stop.contactPhone && (
            <IconButton onClick={onCall} sx={{ border: 1, borderColor: 'divider' }}>
              <PhoneIcon />
            </IconButton>
          )}
          <Button
            variant="contained"
            color={isPickup ? 'primary' : 'secondary'}
            startIcon={<CheckCircleIcon />}
            onClick={onComplete}
            sx={{ flex: 1 }}
          >
            Completar
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
