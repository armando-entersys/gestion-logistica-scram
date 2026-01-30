'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  Snackbar,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { ordersApi } from '@/lib/api';

// SCRAM Brand Colors
const SCRAM_DARK_BLUE = '#0e314c';
const SCRAM_ORANGE = '#ff9900';
const SCRAM_GREEN = '#44ce6f';

// Emoji icons for each rating
const ratingEmojis: { [key: number]: { emoji: string; label: string; color: string } } = {
  1: { emoji: '😡', label: 'Muy malo', color: '#e53e3e' },
  2: { emoji: '😞', label: 'Malo', color: '#ed8936' },
  3: { emoji: '😐', label: 'Regular', color: '#a0aec0' },
  4: { emoji: '😊', label: 'Bueno', color: SCRAM_GREEN },
  5: { emoji: '😍', label: 'Excelente', color: SCRAM_GREEN },
};

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hash = params.hash as string;

  // Check if coming from email with pre-selected score
  const scoreFromEmail = searchParams.get('score');
  const fromEmail = searchParams.get('fromEmail') === 'true';

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // If coming from email, the rating is already saved, just show comment form
  const [ratingAlreadySaved, setRatingAlreadySaved] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await ordersApi.track(hash);
        if (response.data.error) {
          setError(response.data.error);
        } else {
          setOrder(response.data);

          // Check if already rated
          if (response.data.csatScore) {
            setRating(response.data.csatScore);
            setRatingAlreadySaved(true);
            if (response.data.csatFeedback) {
              setSubmitted(true);
            }
          } else if (fromEmail && scoreFromEmail) {
            // Coming from email - rating was just saved by the backend
            const score = parseInt(scoreFromEmail, 10);
            if (score >= 1 && score <= 5) {
              setRating(score);
              setRatingAlreadySaved(true);
            }
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
  }, [hash, fromEmail, scoreFromEmail]);

  const handleSubmit = async () => {
    if (!rating) {
      setSnackbar({ open: true, message: 'Por favor selecciona una calificacion', severity: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.submitCsat(hash, rating, feedback || undefined);
      setSubmitted(true);
      setSnackbar({ open: true, message: 'Gracias por tu comentario', severity: 'success' });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Error al enviar',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRatingClick = (value: number) => {
    if (!ratingAlreadySaved) {
      setRating(value);
    }
  };

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
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Cargando...</Typography>
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
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box component="img" src="/scram-logo.png" alt="SCRAM" sx={{ height: 50 }} />
          </Box>
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: '#ffebee', mx: 'auto', mb: 2 }}>
              <ErrorOutlineIcon sx={{ fontSize: 48, color: '#f44336' }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: SCRAM_DARK_BLUE }}>
              Encuesta no disponible
            </Typography>
            <Typography color="text.secondary">{error}</Typography>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (order?.status !== 'DELIVERED') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(180deg, ${SCRAM_DARK_BLUE} 0%, ${SCRAM_DARK_BLUE} 30%, #f5f5f5 30%)`,
          pt: 4,
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box component="img" src="/scram-logo.png" alt="SCRAM" sx={{ height: 50 }} />
          </Box>
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: `${SCRAM_ORANGE}20`, mx: 'auto', mb: 2 }}>
              <LocalShippingIcon sx={{ fontSize: 48, color: SCRAM_ORANGE }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: SCRAM_DARK_BLUE }}>
              Pedido aun no entregado
            </Typography>
            <Typography color="text.secondary" mb={3}>
              La encuesta estara disponible una vez que tu pedido sea entregado.
            </Typography>
            <Button
              variant="contained"
              href={`/track/${hash}`}
              sx={{ bgcolor: SCRAM_ORANGE, '&:hover': { bgcolor: '#e68a00' } }}
            >
              Ver Estado del Pedido
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${SCRAM_DARK_BLUE} 0%, ${SCRAM_DARK_BLUE} 200px, #f5f5f5 200px)`,
      }}
    >
      {/* Header with Logo */}
      <Container maxWidth="sm" sx={{ pt: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box component="img" src="/scram-logo.png" alt="SCRAM" sx={{ height: 45, mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Encuesta de Satisfaccion
          </Typography>
        </Box>

        {submitted ? (
          /* Thank you message */
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: `${SCRAM_GREEN}20`, mx: 'auto', mb: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: SCRAM_GREEN }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: SCRAM_DARK_BLUE }}>
              Gracias por tu opinion!
            </Typography>
            <Typography color="text.secondary" mb={3}>
              Tu calificacion nos ayuda a mejorar nuestro servicio.
            </Typography>

            {rating && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 64, lineHeight: 1 }}>{ratingEmojis[rating].emoji}</Typography>
                <Typography variant="h6" fontWeight={600} sx={{ color: ratingEmojis[rating].color, mt: 1 }}>
                  {ratingEmojis[rating].label}
                </Typography>
              </Box>
            )}

            <Button
              variant="contained"
              href={`/track/${hash}`}
              sx={{ bgcolor: SCRAM_DARK_BLUE, '&:hover': { bgcolor: '#1a4a6e' } }}
            >
              Ver Detalles del Pedido
            </Button>
          </Paper>
        ) : (
          /* Survey Form */
          <>
            {/* Order Info */}
            <Paper
              elevation={0}
              sx={{ p: 3, mb: 2, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            >
              <Typography variant="overline" sx={{ color: SCRAM_ORANGE, fontWeight: 600 }}>
                PEDIDO {order?.invoiceNumber || order?.bindId}
              </Typography>
              <Typography variant="h6" fontWeight={600} sx={{ color: SCRAM_DARK_BLUE }}>
                {order?.clientName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Entregado el {order?.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('es-MX', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }) : 'N/A'}
              </Typography>
            </Paper>

            {/* Rating Selection */}
            <Paper
              elevation={0}
              sx={{ p: 3, mb: 2, borderRadius: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            >
              {ratingAlreadySaved && rating ? (
                /* Rating already saved - show selected emoji and comment field */
                <>
                  <Typography variant="h6" fontWeight={600} textAlign="center" sx={{ color: SCRAM_DARK_BLUE, mb: 2 }}>
                    Tu calificacion
                  </Typography>

                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 2,
                        bgcolor: `${ratingEmojis[rating].color}15`,
                        borderRadius: 3,
                      }}
                    >
                      <Typography sx={{ fontSize: 64, lineHeight: 1 }}>{ratingEmojis[rating].emoji}</Typography>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ color: ratingEmojis[rating].color, mt: 1 }}>
                        {ratingEmojis[rating].label}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="subtitle1" fontWeight={600} textAlign="center" sx={{ color: SCRAM_DARK_BLUE, mb: 2 }}>
                    Quieres agregar un comentario?
                  </Typography>

                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Cuentanos mas sobre tu experiencia... (opcional)"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />

                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleSubmit}
                    disabled={submitting}
                    sx={{
                      py: 1.5,
                      bgcolor: SCRAM_ORANGE,
                      '&:hover': { bgcolor: '#e68a00' },
                      borderRadius: 2,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: '1rem',
                    }}
                  >
                    {submitting ? <CircularProgress size={24} color="inherit" /> : 'Enviar'}
                  </Button>

                  <Button
                    variant="text"
                    fullWidth
                    onClick={() => setSubmitted(true)}
                    sx={{ mt: 1, color: 'text.secondary' }}
                  >
                    Omitir comentario
                  </Button>
                </>
              ) : (
                /* Rating not saved yet - show emoji selection */
                <>
                  <Typography variant="h6" fontWeight={600} textAlign="center" sx={{ color: SCRAM_DARK_BLUE, mb: 1 }}>
                    Como fue tu experiencia?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
                    Selecciona una opcion
                  </Typography>

                  {/* Emoji Rating Selection */}
                  <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 3 }}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Box
                        key={value}
                        onClick={() => handleRatingClick(value)}
                        sx={{
                          cursor: 'pointer',
                          textAlign: 'center',
                          p: 1,
                          borderRadius: 2,
                          bgcolor: rating === value ? `${ratingEmojis[value].color}20` : 'transparent',
                          border: rating === value ? `2px solid ${ratingEmojis[value].color}` : '2px solid transparent',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            bgcolor: `${ratingEmojis[value].color}10`,
                          },
                        }}
                      >
                        <Typography sx={{ fontSize: 40, lineHeight: 1 }}>{ratingEmojis[value].emoji}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            color: rating === value ? ratingEmojis[value].color : 'text.secondary',
                            fontWeight: rating === value ? 600 : 400,
                          }}
                        >
                          {ratingEmojis[value].label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>

                  {rating && (
                    <>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Comentarios (opcional)"
                        placeholder="Cuentanos mas sobre tu experiencia..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        sx={{
                          mb: 3,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          },
                        }}
                      />

                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={handleSubmit}
                        disabled={submitting}
                        sx={{
                          py: 1.5,
                          bgcolor: SCRAM_ORANGE,
                          '&:hover': { bgcolor: '#e68a00' },
                          borderRadius: 2,
                          fontWeight: 600,
                          textTransform: 'none',
                          fontSize: '1rem',
                        }}
                      >
                        {submitting ? <CircularProgress size={24} color="inherit" /> : 'Enviar Calificacion'}
                      </Button>
                    </>
                  )}
                </>
              )}
            </Paper>

            <Box sx={{ textAlign: 'center' }}>
              <Button variant="text" href={`/track/${hash}`} sx={{ color: 'text.secondary' }}>
                Volver al rastreo
              </Button>
            </Box>
          </>
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
            SCRAM 2026 - Soluciones en Logistica y Distribucion
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
