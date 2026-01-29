'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';

import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await authApi.login(email, password);
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      const role = data.user.roleCode;
      if (role === 'ADMIN') {
        router.push('/planning');
      } else if (role === 'PURCHASING') {
        router.push('/compras');
      } else if (role === 'DRIVER') {
        router.push('/driver');
      } else if (role === 'SALES') {
        router.push('/ventas');
      } else {
        router.push('/dashboard');
      }
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Credenciales inválidas');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // SCRAM gradient: Dark Blue to lighter blue with orange accent
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
            Sistema de Gestión Logística
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
            sx={{ fontWeight: 600, mb: 3, textAlign: 'center' }}
          >
            Iniciar Sesión
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              required
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              inputProps={{ minLength: 6 }}
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
              disabled={loginMutation.isPending}
              startIcon={
                loginMutation.isPending ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <LoginIcon />
                )
              }
              sx={{ py: 1.5 }}
            >
              {loginMutation.isPending ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </Box>
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
            SCRAM - Soluciones en Logística y Distribución
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
