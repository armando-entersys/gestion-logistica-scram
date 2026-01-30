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
  Chip,
  LinearProgress,
  Button,
  StepConnector,
  stepConnectorClasses,
  styled,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ReceiptIcon from '@mui/icons-material/Receipt';
import StarIcon from '@mui/icons-material/Star';
import InventoryIcon from '@mui/icons-material/Inventory';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PhoneIcon from '@mui/icons-material/Phone';

import { ordersApi } from '@/lib/api';

// SCRAM Brand Colors
const SCRAM_DARK_BLUE = '#0e314c';
const SCRAM_ORANGE = '#ff9900';
const SCRAM_GREEN = '#44ce6f';

const statusSteps = ['Recibido', 'Preparando', 'En Camino', 'Entregado'];
const statusToStep: Record<string, number> = {
  DRAFT: 0,
  READY: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Pedido Recibido', color: SCRAM_DARK_BLUE, bgColor: '#e3f2fd' },
  READY: { label: 'En Preparación', color: SCRAM_ORANGE, bgColor: '#fff3e0' },
  IN_TRANSIT: { label: 'En Camino', color: SCRAM_ORANGE, bgColor: '#fff3e0' },
  DELIVERED: { label: 'Entregado', color: SCRAM_GREEN, bgColor: '#e8f5e9' },
};

// Custom connector for stepper
const ColorlibConnector = styled(StepConnector)(() => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      background: `linear-gradient(90deg, ${SCRAM_ORANGE} 0%, ${SCRAM_GREEN} 100%)`,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      background: SCRAM_GREEN,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 4,
    border: 0,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
}));

// Custom step icon
const ColorlibStepIconRoot = styled('div')<{ ownerState: { completed?: boolean; active?: boolean } }>(
  ({ ownerState }) => ({
    backgroundColor: '#e0e0e0',
    zIndex: 1,
    color: '#fff',
    width: 44,
    height: 44,
    display: 'flex',
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    ...(ownerState.active && {
      background: `linear-gradient(135deg, ${SCRAM_ORANGE} 0%, ${SCRAM_GREEN} 100%)`,
      boxShadow: `0 4px 12px rgba(255, 153, 0, 0.4)`,
    }),
    ...(ownerState.completed && {
      background: SCRAM_GREEN,
    }),
  }),
);

function ColorlibStepIcon(props: { active?: boolean; completed?: boolean; icon: React.ReactNode; className?: string }) {
  const { active, completed, className } = props;

  const icons: { [index: string]: React.ReactElement } = {
    1: <ReceiptIcon sx={{ fontSize: 22 }} />,
    2: <InventoryIcon sx={{ fontSize: 22 }} />,
    3: <LocalShippingIcon sx={{ fontSize: 22 }} />,
    4: <CheckCircleIcon sx={{ fontSize: 22 }} />,
  };

  return (
    <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
      {icons[String(props.icon)]}
    </ColorlibStepIconRoot>
  );
}

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
        setError('No se pudo cargar la información del pedido');
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
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(180deg, ${SCRAM_DARK_BLUE} 0%, ${SCRAM_DARK_BLUE} 30%, #f5f5f5 30%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <CircularProgress sx={{ color: SCRAM_ORANGE }} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Cargando información...</Typography>
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(180deg, ${SCRAM_DARK_BLUE} 0%, ${SCRAM_DARK_BLUE} 30%, #f5f5f5 30%)`,
          pt: 4,
        }}
      >
        <Container maxWidth="sm">
          {/* Logo Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              component="img"
              src="/scram-logo.png"
              alt="SCRAM"
              sx={{ height: 50, mb: 1 }}
            />
          </Box>

          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: '#ffebee', mx: 'auto', mb: 2 }}>
              <ErrorOutlineIcon sx={{ fontSize: 48, color: '#f44336' }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: SCRAM_DARK_BLUE }}>
              Pedido no encontrado
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {error}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              El enlace puede haber expirado o el número de seguimiento es incorrecto.
            </Typography>
          </Paper>
        </Container>
      </Box>
    );
  }

  const status = statusConfig[order?.status] || statusConfig.DRAFT;
  const currentStep = statusToStep[order?.status] || 0;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${SCRAM_DARK_BLUE} 0%, ${SCRAM_DARK_BLUE} 220px, #f5f5f5 220px)`,
      }}
    >
      {/* Header with Logo */}
      <Container maxWidth="sm" sx={{ pt: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/scram-logo.png"
            alt="SCRAM"
            sx={{ height: 45, mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Seguimiento de Pedido
          </Typography>
        </Box>

        {/* Main Status Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            mb: 2,
          }}
        >
          {/* Status Badge */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Chip
              label={status.label}
              sx={{
                bgcolor: status.bgColor,
                color: status.color,
                fontWeight: 700,
                fontSize: '1rem',
                py: 2.5,
                px: 1,
                borderRadius: 2,
              }}
            />
          </Box>

          {/* Progress Stepper */}
          <Stepper
            activeStep={currentStep}
            alternativeLabel
            connector={<ColorlibConnector />}
            sx={{ mb: 3 }}
          >
            {statusSteps.map((label) => (
              <Step key={label}>
                <StepLabel StepIconComponent={ColorlibStepIcon}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 500,
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                    }}
                  >
                    {label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* In Transit Animation */}
          {order?.status === 'IN_TRANSIT' && (
            <Box sx={{ mb: 2, px: 2 }}>
              <LinearProgress
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${SCRAM_ORANGE} 0%, ${SCRAM_GREEN} 100%)`,
                    borderRadius: 3,
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{ mt: 1, display: 'block', textAlign: 'center', color: 'text.secondary' }}
              >
                Tu pedido está en camino hacia ti
              </Typography>
            </Box>
          )}

          {/* Delivered Success Message */}
          {order?.status === 'DELIVERED' && (
            <Box
              sx={{
                bgcolor: '#e8f5e9',
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
                mb: 2,
              }}
            >
              <CheckCircleIcon sx={{ color: SCRAM_GREEN, fontSize: 40, mb: 1 }} />
              <Typography variant="body1" fontWeight={600} sx={{ color: SCRAM_GREEN }}>
                ¡Pedido entregado exitosamente!
              </Typography>
              {order.deliveredAt && (
                <Typography variant="caption" color="text.secondary">
                  {new Date(order.deliveredAt).toLocaleString('es-MX', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Order Details Card */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            mb: 2,
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: SCRAM_DARK_BLUE, fontWeight: 700, letterSpacing: 1 }}
          >
            Detalles del Pedido
          </Typography>

          <Stack spacing={2.5} sx={{ mt: 2 }}>
            {/* Order Number */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: `${SCRAM_ORANGE}15`, width: 44, height: 44 }}>
                <ReceiptIcon sx={{ color: SCRAM_ORANGE }} />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Número de Pedido
                </Typography>
                <Typography variant="body1" fontWeight={600} sx={{ color: SCRAM_DARK_BLUE }}>
                  {order?.invoiceNumber || order?.orderNumber || order?.bindId || 'N/A'}
                </Typography>
              </Box>
            </Stack>

            <Divider />

            {/* Delivery Address */}
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar sx={{ bgcolor: `${SCRAM_GREEN}15`, width: 44, height: 44 }}>
                <LocationOnIcon sx={{ color: SCRAM_GREEN }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Dirección de Entrega
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {order?.addressRaw?.street} {order?.addressRaw?.number}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order?.addressRaw?.neighborhood}, {order?.addressRaw?.city}
                </Typography>
                {order?.addressRaw?.postalCode && (
                  <Typography variant="body2" color="text.secondary">
                    CP {order?.addressRaw?.postalCode}
                  </Typography>
                )}
              </Box>
            </Stack>

            {/* Driver Info */}
            {order?.assignedDriver && (
              <>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: `${SCRAM_DARK_BLUE}15`, width: 44, height: 44 }}>
                    <PersonIcon sx={{ color: SCRAM_DARK_BLUE }} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Chofer Asignado
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {order.assignedDriver.firstName} {order.assignedDriver.lastName}
                    </Typography>
                  </Box>
                  {order.assignedDriver.phone && (
                    <Avatar
                      sx={{
                        bgcolor: SCRAM_GREEN,
                        width: 40,
                        height: 40,
                        cursor: 'pointer',
                      }}
                      component="a"
                      href={`tel:${order.assignedDriver.phone}`}
                    >
                      <PhoneIcon sx={{ color: 'white', fontSize: 20 }} />
                    </Avatar>
                  )}
                </Stack>
              </>
            )}

            {/* Estimated Arrival */}
            {order?.estimatedArrivalStart && order?.status !== 'DELIVERED' && (
              <>
                <Divider />
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: `${SCRAM_ORANGE}15`, width: 44, height: 44 }}>
                    <ScheduleIcon sx={{ color: SCRAM_ORANGE }} />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Hora Estimada de Llegada
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: SCRAM_ORANGE }}>
                      {new Date(order.estimatedArrivalStart).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(order.estimatedArrivalEnd).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        {/* CSAT Survey CTA */}
        {order?.status === 'DELIVERED' && !order?.csatScore && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${SCRAM_ORANGE}15 0%, ${SCRAM_GREEN}15 100%)`,
              border: `1px solid ${SCRAM_ORANGE}30`,
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              <Avatar sx={{ bgcolor: SCRAM_ORANGE, width: 48, height: 48 }}>
                <StarIcon sx={{ color: 'white' }} />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: SCRAM_DARK_BLUE }}>
                  ¿Cómo fue tu experiencia?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tu opinión nos ayuda a mejorar
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              fullWidth
              size="large"
              href={`/survey/${hash}`}
              sx={{
                bgcolor: SCRAM_ORANGE,
                '&:hover': { bgcolor: '#e68a00' },
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
              }}
            >
              Calificar Entrega
            </Button>
          </Paper>
        )}

        {/* Already Rated */}
        {order?.csatScore && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: `${SCRAM_GREEN}10`,
              border: `1px solid ${SCRAM_GREEN}30`,
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: SCRAM_GREEN }}>
                <CheckCircleIcon sx={{ color: 'white' }} />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: SCRAM_GREEN }}>
                  ¡Gracias por tu calificación!
                </Typography>
                <Stack direction="row" spacing={0.5} mt={0.5}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      sx={{
                        fontSize: 22,
                        color: star <= order.csatScore ? SCRAM_ORANGE : '#e0e0e0',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Box
            sx={{
              width: 60,
              height: 3,
              background: `linear-gradient(90deg, ${SCRAM_ORANGE} 0%, ${SCRAM_GREEN} 100%)`,
              borderRadius: 2,
              mx: 'auto',
              mb: 2,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            SCRAM 2026 - Soluciones en Logística y Distribución
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
