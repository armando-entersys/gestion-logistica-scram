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
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import NavigationIcon from '@mui/icons-material/Navigation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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

export default function RoutePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { isOnline, triggerSync } = useSync();

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
  }, []);

  const handleLogout = async () => {
    await clearSession();
    navigate('/login');
  };

  const handleRefresh = () => {
    fetchRoute();
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
              />
            ))}
          </Stack>
        )}
      </Box>

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
}

function OrderCard({ order, position, onNavigate, onCall, onDeliver }: OrderCardProps) {
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
        )}
      </CardContent>
    </Card>
  );
}
