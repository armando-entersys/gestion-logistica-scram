import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  useTheme,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';

import { saveSession, getSession, clearAllData } from '@/lib/db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function LoginPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { accessToken, user } = response.data;

      // Verify user is a driver
      if (user.roleCode !== 'DRIVER') {
        setError('Esta aplicacion es solo para choferes');
        setIsLoading(false);
        return;
      }

      // Check if a different user was logged in before
      // If so, clear all local data to prevent mixing orders/evidence
      const previousSession = await getSession();
      if (previousSession && previousSession.id !== user.id) {
        console.log('Different user login detected, clearing previous data');
        await clearAllData();
      }

      // Save session to IndexedDB
      await saveSession({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        token: accessToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      navigate('/route');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciales invalidas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 4,
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      <Container maxWidth="xs" disableGutters>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/scram-logo.png"
            alt="SCRAM"
            sx={{
              height: 70,
              mb: 2,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            }}
          />
          <Box
            sx={{
              width: 50,
              height: 3,
              background: 'linear-gradient(90deg, #ff9900 0%, #44ce6f 100%)',
              borderRadius: 2,
              mx: 'auto',
              mb: 1.5,
            }}
          />
          <Typography sx={{ color: 'rgba(255,255,255,0.9)' }}>
            App de Chofer
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
            Iniciar Sesion
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Correo"
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
              label="Contrasena"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
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
              disabled={isLoading}
              startIcon={
                isLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <LoginIcon />
                )
              }
              sx={{ py: 1.5 }}
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
