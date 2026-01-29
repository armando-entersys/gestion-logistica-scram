'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import LockIcon from '@mui/icons-material/Lock';
import LockResetIcon from '@mui/icons-material/LockReset';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { authApi } from '@/lib/api';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Validate token on mount
  const { data: tokenData, isLoading: validatingToken, isError: tokenError } = useQuery({
    queryKey: ['validateResetToken', token],
    queryFn: async () => {
      if (!token) throw new Error('No token provided');
      const response = await authApi.validateResetToken(token);
      return response.data;
    },
    enabled: !!token,
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const response = await authApi.resetPassword(token, password);
      return response.data;
    },
    onSuccess: () => {
      setSuccess(true);
      setError('');
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Error al restablecer la contrasena');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    resetMutation.mutate();
  };

  // Show loading while validating token
  if (validatingToken) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error if no token or invalid token
  if (!token || tokenError || (tokenData && !tokenData.valid)) {
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
          <Paper elevation={3} sx={{ p: 4, borderRadius: 4, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: 'error.main' }}>
              Enlace invalido o expirado
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              El enlace para restablecer tu contrasena no es valido o ha expirado.
              Por favor, solicita uno nuevo.
            </Typography>
            <Button
              component={Link}
              href="/forgot-password"
              variant="contained"
              fullWidth
              startIcon={<LockResetIcon />}
            >
              Solicitar nuevo enlace
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
          {success ? (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography
                variant="h5"
                component="h2"
                sx={{ fontWeight: 600, mb: 2 }}
              >
                Contrasena actualizada
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Tu contrasena ha sido actualizada exitosamente. Ya puedes iniciar sesion con tu nueva contrasena.
              </Typography>
              <Button
                component={Link}
                href="/login"
                variant="contained"
                fullWidth
                size="large"
                sx={{ py: 1.5 }}
              >
                Iniciar sesion
              </Button>
            </Box>
          ) : (
            <>
              <Typography
                variant="h5"
                component="h2"
                sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}
              >
                Nueva contrasena
              </Typography>

              {tokenData?.email && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3, textAlign: 'center' }}
                >
                  Ingresa tu nueva contrasena para: <strong>{tokenData.email}</strong>
                </Typography>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Nueva contrasena"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                  required
                  inputProps={{ minLength: 6 }}
                  sx={{ mb: 2.5 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Confirmar contrasena"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contrasena"
                  required
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={resetMutation.isPending}
                  startIcon={
                    resetMutation.isPending ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <LockResetIcon />
                    )
                  }
                  sx={{ py: 1.5, mb: 2 }}
                >
                  {resetMutation.isPending ? 'Actualizando...' : 'Actualizar contrasena'}
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
            </>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
