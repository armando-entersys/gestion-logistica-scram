'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';

import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const response = await authApi.forgotPassword(email);
      return response.data;
    },
    onSuccess: () => {
      setSuccess(true);
      setError('');
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Error al enviar el correo');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    forgotMutation.mutate();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0e314c 0%, #1a4a6e 100%)',
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/scram-logo.png"
            alt="SCRAM"
            sx={{ height: 80, mb: 2, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
          />
          <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>
            Sistema de Gestion Logistica
          </Typography>
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 4,
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}
          >
            Restablecer Contrasena
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 3, textAlign: 'center' }}
          >
            Ingresa tu correo electronico y te enviaremos instrucciones para restablecer tu contrasena.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success ? (
            <Box sx={{ textAlign: 'center' }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                Si el correo existe en nuestro sistema, recibiras instrucciones para restablecer tu contrasena.
              </Alert>
              <Button
                component={Link}
                href="/login"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                fullWidth
              >
                Volver al inicio de sesion
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Correo electronico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={forgotMutation.isPending}
                startIcon={
                  forgotMutation.isPending ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <SendIcon />
                  )
                }
                sx={{ py: 1.5, mb: 2 }}
              >
                {forgotMutation.isPending ? 'Enviando...' : 'Enviar instrucciones'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link
                  href="/login"
                  style={{
                    color: '#0e314c',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                  }}
                >
                  Volver al inicio de sesion
                </Link>
              </Box>
            </Box>
          )}
        </Paper>

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Box
            sx={{
              width: 60,
              height: 3,
              background: 'linear-gradient(90deg, #ff9900 0%, #44ce6f 100%)',
              borderRadius: 2,
              mx: 'auto',
              mb: 1.5,
            }}
          />
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            SCRAM - Soluciones en Logistica y Distribucion
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
