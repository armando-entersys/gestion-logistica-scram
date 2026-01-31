'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SwapVertIcon from '@mui/icons-material/SwapVert';

import { routesApi } from '@/lib/api';

interface Order {
  id: string;
  orderNumber?: string;
  bindId: string;
  clientName: string;
  priorityLevel: number;
  latitude?: number;
  longitude?: number;
  addressRaw?: {
    street?: string;
    number?: string;
    neighborhood?: string;
  };
}

interface OptimizationLeg {
  orderId: string;
  position: number;
  distanceKm: number;
  durationMinutes: number;
  etaStart: string;
  etaEnd: string;
  clientName: string;
  address: string;
  priority: number;
}

interface OptimizationResult {
  originalSequence: string[];
  optimizedSequence: string[];
  totalDistanceKm: number;
  originalDistanceKm: number;
  totalDurationMinutes: number;
  savingsPercent: number;
  savingsKm: number;
  legs: OptimizationLeg[];
}

interface RouteOptimizationDialogProps {
  open: boolean;
  onClose: () => void;
  selectedOrders: Order[];
  onOptimizationApplied: () => void;
}

const priorityLabels: Record<number, { label: string; color: 'error' | 'warning' | 'default' }> = {
  3: { label: 'Urgente', color: 'error' },
  2: { label: 'Alta', color: 'warning' },
  1: { label: 'Normal', color: 'default' },
};

export default function RouteOptimizationDialog({
  open,
  onClose,
  selectedOrders,
  onOptimizationApplied,
}: RouteOptimizationDialogProps) {
  const [startTime, setStartTime] = useState('09:00');
  const [respectPriority, setRespectPriority] = useState(true);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const ordersWithCoords = selectedOrders.filter((o) => o.latitude && o.longitude);
  const ordersWithoutCoords = selectedOrders.filter((o) => !o.latitude || !o.longitude);

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const orderIds = selectedOrders.map((o) => o.id);
      const response = await routesApi.optimize(orderIds, { startTime, respectPriority });
      return response.data;
    },
    onSuccess: (data) => {
      setOptimization(data.optimization);
      setWarnings(data.warnings);
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!optimization) return;
      const response = await routesApi.applyOptimization(optimization.optimizedSequence, startTime);
      return response.data;
    },
    onSuccess: () => {
      onOptimizationApplied();
      handleClose();
    },
  });

  const handleClose = () => {
    setOptimization(null);
    setWarnings([]);
    onClose();
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <RouteIcon color="primary" />
          <Typography variant="h6">Optimizar Ruta</Typography>
          <Chip
            size="small"
            label={`${selectedOrders.length} pedidos`}
            color="primary"
            variant="outlined"
          />
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Configuracion */}
        {!optimization && (
          <Stack spacing={3}>
            {/* Advertencia de pedidos sin coordenadas */}
            {ordersWithoutCoords.length > 0 && (
              <Alert severity="warning" icon={<WarningAmberIcon />}>
                <Typography variant="body2" fontWeight={600}>
                  {ordersWithoutCoords.length} pedido(s) sin geocodificar
                </Typography>
                <Typography variant="caption">
                  {ordersWithoutCoords.map((o) => o.orderNumber || o.bindId?.substring(0, 8)).join(', ')}
                </Typography>
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuracion de Optimizacion
              </Typography>
              <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                <TextField
                  size="small"
                  type="time"
                  label="Hora de inicio"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 140 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={respectPriority}
                      onChange={(e) => setRespectPriority(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Respetar prioridades (Urgentes primero)
                    </Typography>
                  }
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Pedidos a optimizar ({ordersWithCoords.length} con ubicacion)
              </Typography>
              <List dense sx={{ maxHeight: 250, overflow: 'auto' }}>
                {selectedOrders.map((order, index) => {
                  const priority = priorityLabels[order.priorityLevel] || priorityLabels[1];
                  const hasCoords = order.latitude && order.longitude;
                  return (
                    <ListItem key={order.id} divider={index < selectedOrders.length - 1}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Typography variant="body2" color="text.secondary">
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={600}>
                              {order.orderNumber || order.bindId?.substring(0, 8)}
                            </Typography>
                            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                              {order.clientName}
                            </Typography>
                            {order.priorityLevel > 1 && (
                              <Chip
                                size="small"
                                label={priority.label}
                                color={priority.color}
                                sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }}
                              />
                            )}
                            {!hasCoords && (
                              <Chip
                                size="small"
                                icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                                label="Sin ubicacion"
                                color="warning"
                                variant="outlined"
                                sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.625rem' } }}
                              />
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Stack>
        )}

        {/* Resultado de optimizacion */}
        {optimization && (
          <Stack spacing={3}>
            {/* Resumen de ahorros */}
            <Paper
              sx={{
                p: 2,
                bgcolor: optimization.savingsPercent > 0 ? 'success.50' : 'grey.100',
                borderColor: optimization.savingsPercent > 0 ? 'success.main' : 'grey.300',
              }}
              variant="outlined"
            >
              <Stack direction="row" spacing={4} justifyContent="center" flexWrap="wrap">
                <Box textAlign="center">
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                    {optimization.savingsPercent > 0 && (
                      <TrendingDownIcon color="success" />
                    )}
                    <Typography
                      variant="h4"
                      color={optimization.savingsPercent > 0 ? 'success.main' : 'text.primary'}
                      fontWeight={700}
                    >
                      {optimization.savingsPercent > 0 ? '-' : ''}
                      {Math.abs(optimization.savingsPercent)}%
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Ahorro en distancia
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight={700}>
                    {optimization.totalDistanceKm} km
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Distancia optimizada
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight={700}>
                    {Math.floor(optimization.totalDurationMinutes / 60)}h{' '}
                    {optimization.totalDurationMinutes % 60}m
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tiempo estimado
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Warnings */}
            {warnings.length > 0 && (
              <Stack spacing={1}>
                {warnings.map((warning, i) => (
                  <Alert key={i} severity="warning" icon={<WarningAmberIcon />}>
                    {warning}
                  </Alert>
                ))}
              </Stack>
            )}

            {/* Comparacion lado a lado */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {/* Original */}
              <Paper variant="outlined" sx={{ flex: 1, p: 2, opacity: 0.7 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Orden Original
                  </Typography>
                  <Chip
                    size="small"
                    label={`${optimization.originalDistanceKm} km`}
                    variant="outlined"
                    sx={{ height: 20 }}
                  />
                </Stack>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {optimization.originalSequence.map((orderId, index) => {
                    const order = selectedOrders.find((o) => o.id === orderId);
                    return (
                      <ListItem key={orderId} sx={{ py: 0.5, px: 1 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" color="text.secondary">
                              {index + 1}. {order?.clientName || orderId.substring(0, 8)}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>

              {/* Icono de cambio */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
                <SwapVertIcon color="action" />
              </Box>

              {/* Optimizado */}
              <Paper
                variant="outlined"
                sx={{ flex: 1, p: 2, borderColor: 'success.main', borderWidth: 2 }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" color="success.main">
                    Orden Optimizado
                  </Typography>
                  <Chip
                    size="small"
                    label={`${optimization.totalDistanceKm} km`}
                    color="success"
                    sx={{ height: 20 }}
                  />
                </Stack>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {optimization.legs.map((leg) => {
                    const priority = priorityLabels[leg.priority] || priorityLabels[1];
                    return (
                      <ListItem key={leg.orderId} sx={{ py: 0.5, px: 1 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckCircleIcon fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" fontWeight={600}>
                                {leg.position}. {leg.clientName}
                              </Typography>
                              {leg.priority > 1 && (
                                <PriorityHighIcon
                                  fontSize="small"
                                  color={priority.color as any}
                                  sx={{ fontSize: 16 }}
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={2}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <AccessTimeIcon sx={{ fontSize: 12 }} />
                                {formatTime(leg.etaStart)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <LocationOnIcon sx={{ fontSize: 12 }} />
                                {leg.distanceKm} km
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} variant="outlined">
          Cancelar
        </Button>

        {!optimization ? (
          <Button
            variant="contained"
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending || ordersWithCoords.length < 2}
            startIcon={
              optimizeMutation.isPending ? <CircularProgress size={16} /> : <RouteIcon />
            }
          >
            {optimizeMutation.isPending ? 'Optimizando...' : 'Calcular Ruta Optima'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            startIcon={
              applyMutation.isPending ? <CircularProgress size={16} /> : <CheckCircleIcon />
            }
          >
            {applyMutation.isPending ? 'Aplicando...' : 'Aplicar Optimizacion'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
