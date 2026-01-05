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
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <LocalShippingIcon
              sx={{
                fontSize: 56,
                color: 'primary.main',
                mr: 2
              }}
            />
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
              }}
            >
              SCRAM
            </Typography>
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
            Despacho y Última Milla
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

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 3,
            color: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          SCRAM 2026 - Todos los derechos reservados
        </Typography>
      </Container>
    </Box>
  );
}
