'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Button,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ReceiptIcon from '@mui/icons-material/Receipt';
import StarIcon from '@mui/icons-material/Star';
import InventoryIcon from '@mui/icons-material/Inventory';

import { ordersApi } from '@/lib/api';

const statusSteps = ['Recibido', 'En Preparacion', 'En Camino', 'Entregado'];
const statusToStep: Record<string, number> = {
  DRAFT: 0,
  READY: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
};

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'info' }> = {
  DRAFT: { label: 'Recibido', color: 'default' },
  READY: { label: 'En Preparacion', color: 'info' },
  IN_TRANSIT: { label: 'En Camino', color: 'primary' },
  DELIVERED: { label: 'Entregado', color: 'success' },
};

export default function TrackingPage() {
  const params = useParams();
  const hash = params.hash as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await ordersApi.track(hash);
        if (response.data.error) {
          setError(response.data.error);
        } else {
          setOrder(response.data);
        }
      } catch (err: any) {
        setError('No se pudo cargar la informacion del pedido');
      } finally {
        setLoading(false);
      }
    };

    if (hash) {
      fetchOrder();
    }
  }, [hash]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
          <ReceiptIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            Pedido no encontrado
          </Typography>
          <Typography color="text.secondary">
            {error}
          </Typography>
        </Paper>
      </Box>
    );
  }

  const status = statusConfig[order?.status] || statusConfig.DRAFT;
  const currentStep = statusToStep[order?.status] || 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 3 }}>
        <Container maxWidth="sm">
          <Stack direction="row" spacing={2} alignItems="center">
            <LocalShippingIcon sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Rastreo de Pedido
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                SCRAM Logistica
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        {/* Status Card */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Estado actual
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {status.label}
              </Typography>
            </Box>
            <Avatar sx={{ width: 56, height: 56, bgcolor: `${status.color}.light` }}>
              {order?.status === 'DELIVERED' ? (
                <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
              ) : order?.status === 'IN_TRANSIT' ? (
                <LocalShippingIcon color="primary" sx={{ fontSize: 32 }} />
              ) : (
                <InventoryIcon color="action" sx={{ fontSize: 32 }} />
              )}
            </Avatar>
          </Stack>

          {/* Progress Stepper */}
          <Stepper activeStep={currentStep} alternativeLabel sx={{ mb: 3 }}>
            {statusSteps.map((label, index) => (
              <Step key={label} completed={index < currentStep}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {order?.status === 'IN_TRANSIT' && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress color="primary" sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Tu pedido esta en camino
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Order Info */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            INFORMACION DEL PEDIDO
          </Typography>

          <Stack spacing={2.5} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar sx={{ bgcolor: 'grey.200', width: 40, height: 40 }}>
                <ReceiptIcon color="action" />
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Numero de Pedido
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {order?.bindId || 'N/A'}
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar sx={{ bgcolor: 'grey.200', width: 40, height: 40 }}>
                <LocationOnIcon color="action" />
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Direccion de Entrega
                </Typography>
                <Typography variant="body1">
                  {order?.addressRaw?.street} {order?.addressRaw?.number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {order?.addressRaw?.neighborhood}, {order?.addressRaw?.city}
                </Typography>
              </Box>
            </Stack>

            {order?.assignedDriver && (
              <>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Avatar sx={{ bgcolor: 'primary.light', width: 40, height: 40 }}>
                    <PersonIcon color="primary" />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Chofer Asignado
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {order.assignedDriver.firstName} {order.assignedDriver.lastName}
                    </Typography>
                  </Box>
                </Stack>
              </>
            )}

            {order?.estimatedArrivalStart && order?.status !== 'DELIVERED' && (
              <>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Avatar sx={{ bgcolor: 'warning.light', width: 40, height: 40 }}>
                    <ScheduleIcon color="warning" />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Hora Estimada de Llegada
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="primary.main">
                      {new Date(order.estimatedArrivalStart).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(order.estimatedArrivalEnd).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                </Stack>
              </>
            )}

            {order?.status === 'DELIVERED' && (
              <>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                    <CheckCircleIcon sx={{ color: 'white' }} />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Entregado
                    </Typography>
                    <Typography variant="body1" fontWeight={500} color="success.main">
                      {order.deliveredAt
                        ? new Date(order.deliveredAt).toLocaleString('es-MX')
                        : 'Confirmado'}
                    </Typography>
                  </Box>
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        {/* CSAT Survey Link (only if delivered and not rated) */}
        {order?.status === 'DELIVERED' && !order?.csatScore && (
          <Paper sx={{ p: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'warning.light' }}>
                <StarIcon color="warning" />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Califica tu experiencia
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tu opinion nos ayuda a mejorar
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              href={`/survey/${hash}`}
            >
              Dejar Calificacion
            </Button>
          </Paper>
        )}

        {/* Already rated message */}
        {order?.csatScore && (
          <Paper sx={{ p: 3, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'success.light' }}>
                <CheckCircleIcon color="success" />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="success.main">
                  Gracias por tu calificacion
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      sx={{
                        fontSize: 20,
                        color: star <= order.csatScore ? 'warning.main' : 'grey.300',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 4, pb: 3 }}>
          <Typography variant="caption" color="text.disabled">
            SCRAM 2026 - Sistema de Gestion Logistica
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
