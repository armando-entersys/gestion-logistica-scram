'use client';

import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Stack,
  useTheme
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import DashboardIcon from '@mui/icons-material/Dashboard';

export default function Home() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Box
              component="img"
              src="/scram-logo.png"
              alt="SCRAM"
              sx={{
                height: 80,
                filter: 'brightness(0) saturate(100%)',
                mb: 2,
              }}
            />
            <Box
              sx={{
                width: 80,
                height: 4,
                background: 'linear-gradient(90deg, #ff9900 0%, #44ce6f 100%)',
                borderRadius: 2,
                mx: 'auto',
              }}
            />
          </Box>

          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ mb: 1 }}
          >
            Sistema de Gestión Logística
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, opacity: 0.8 }}
          >
            Soluciones en Logística y Distribución
          </Typography>

          <Stack spacing={2}>
            <Button
              component={Link}
              href="/login"
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Iniciar Sesión
            </Button>

            <Button
              component={Link}
              href="/planning"
              variant="outlined"
              size="large"
              startIcon={<DashboardIcon />}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Panel de Tráfico
            </Button>
          </Stack>
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
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            SCRAM 2026 - Todos los derechos reservados
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
