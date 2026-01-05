'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Avatar,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Rating,
  Snackbar,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';

import { ordersApi } from '@/lib/api';

const customIcons: { [index: number]: { icon: React.ReactElement; label: string } } = {
  1: { icon: <SentimentVeryDissatisfiedIcon color="error" sx={{ fontSize: 48 }} />, label: 'Muy malo' },
  2: { icon: <SentimentDissatisfiedIcon color="warning" sx={{ fontSize: 48 }} />, label: 'Malo' },
  3: { icon: <SentimentNeutralIcon color="action" sx={{ fontSize: 48 }} />, label: 'Regular' },
  4: { icon: <SentimentSatisfiedIcon color="success" sx={{ fontSize: 48 }} />, label: 'Bueno' },
  5: { icon: <SentimentSatisfiedAltIcon color="success" sx={{ fontSize: 48 }} />, label: 'Excelente' },
};

function IconContainer(props: any) {
  const { value, ...other } = props;
  return <span {...other}>{customIcons[value].icon}</span>;
}

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const hash = params.hash as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await ordersApi.track(hash);
        if (response.data.error) {
          setError(response.data.error);
        } else {
          setOrder(response.data);
          if (response.data.csatScore) {
            setSubmitted(true);
            setRating(response.data.csatScore);
          }
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

  const handleSubmit = async () => {
    if (!rating) {
      setSnackbar({ open: true, message: 'Por favor selecciona una calificacion', severity: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.submitCsat(hash, rating, feedback || undefined);
      setSubmitted(true);
      setSnackbar({ open: true, message: 'Gracias por tu calificacion', severity: 'success' });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Error al enviar la calificacion',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

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
          <StarIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            Encuesta no disponible
          </Typography>
          <Typography color="text.secondary">
            {error}
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (order?.status !== 'DELIVERED') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
          <LocalShippingIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Pedido aun no entregado
          </Typography>
          <Typography color="text.secondary" mb={3}>
            La encuesta estara disponible una vez que tu pedido sea entregado.
          </Typography>
          <Button variant="contained" href={`/track/${hash}`}>
            Ver Estado del Pedido
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', py: 3 }}>
        <Container maxWidth="sm">
          <Stack direction="row" spacing={2} alignItems="center">
            <StarIcon sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Califica tu Experiencia
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                SCRAM Logistica
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        {submitted ? (
          /* Thank you message */
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'success.light', mx: 'auto', mb: 3 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Gracias por tu opinion
            </Typography>
            <Typography color="text.secondary" mb={3}>
              Tu calificacion nos ayuda a mejorar nuestro servicio de entrega.
            </Typography>

            <Stack direction="row" justifyContent="center" spacing={0.5} mb={3}>
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon
                  key={star}
                  sx={{
                    fontSize: 32,
                    color: star <= (rating || 0) ? 'warning.main' : 'grey.300',
                  }}
                />
              ))}
            </Stack>

            {rating && (
              <Typography variant="body1" fontWeight={500} color="primary.main">
                {customIcons[rating].label}
              </Typography>
            )}

            <Button
              variant="outlined"
              sx={{ mt: 3 }}
              href={`/track/${hash}`}
            >
              Ver Detalles del Pedido
            </Button>
          </Paper>
        ) : (
          /* Survey Form */
          <>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                PEDIDO #{order?.bindId}
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {order?.clientName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Entregado el {order?.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('es-MX') : 'N/A'}
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight={600} textAlign="center" gutterBottom>
                Como fue tu experiencia de entrega?
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <Rating
                  name="csat-rating"
                  value={rating}
                  onChange={(event, newValue) => setRating(newValue)}
                  IconContainerComponent={IconContainer}
                  getLabelText={(value: number) => customIcons[value].label}
                  highlightSelectedOnly
                  size="large"
                  sx={{
                    '& .MuiRating-icon': { mx: 1 },
                    '& .MuiRating-iconEmpty': { opacity: 0.3 },
                  }}
                />
              </Box>

              {rating && (
                <Typography
                  variant="subtitle1"
                  textAlign="center"
                  fontWeight={500}
                  color={rating >= 4 ? 'success.main' : rating >= 3 ? 'text.primary' : 'error.main'}
                  mb={3}
                >
                  {customIcons[rating].label}
                </Typography>
              )}

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Comentarios adicionales (opcional)"
                placeholder="Cuentanos mas sobre tu experiencia..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                sx={{ mb: 3 }}
              />

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleSubmit}
                disabled={!rating || submitting}
                sx={{ py: 1.5 }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Enviar Calificacion'}
              </Button>
            </Paper>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="text"
                color="inherit"
                href={`/track/${hash}`}
              >
                Volver al rastreo
              </Button>
            </Box>
          </>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 4, pb: 3 }}>
          <Typography variant="caption" color="text.disabled">
            SCRAM 2026 - Sistema de Gestion Logistica
          </Typography>
        </Box>
      </Container>

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
