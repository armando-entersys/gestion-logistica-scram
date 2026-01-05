'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Paper,
  Grid,
  CircularProgress,
  Avatar,
  LinearProgress,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import StarIcon from '@mui/icons-material/Star';

import { ordersApi } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await ordersApi.getStats();
      return response.data;
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Mock data for demo - replace with real API data
  const kpis = {
    totalOrders: stats?.total || 0,
    delivered: stats?.delivered || 0,
    inTransit: stats?.inTransit || 0,
    pending: stats?.pending || 0,
    deliveryRate: stats?.total > 0 ? Math.round((stats?.delivered / stats?.total) * 100) : 0,
    avgDeliveryTime: '45 min',
    totalRevenue: stats?.totalRevenue || 0,
    avgCsat: stats?.avgCsat || 4.2,
    activeDrivers: stats?.activeDrivers || 0,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600}>
              Dashboard Ejecutivo
            </Typography>
            <Typography variant="caption" color="text.secondary">
              KPIs y metricas de operacion
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Salir
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ p: 3, flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Main KPIs Row */}
            <Grid item xs={12} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Total Pedidos
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {kpis.totalOrders}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <LocalShippingIcon color="primary" />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Entregados
                      </Typography>
                      <Typography variant="h3" fontWeight={700} color="success.main">
                        {kpis.delivered}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.light' }}>
                      <CheckCircleIcon color="success" />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        En Ruta
                      </Typography>
                      <Typography variant="h3" fontWeight={700} color="primary.main">
                        {kpis.inTransit}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <ScheduleIcon color="primary" />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Tasa de Entrega
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {kpis.deliveryRate}%
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'secondary.light' }}>
                      <TrendingUpIcon color="secondary" />
                    </Avatar>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={kpis.deliveryRate}
                    sx={{ mt: 2, height: 8, borderRadius: 4 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Secondary KPIs Row */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Ingresos del Dia
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        ${kpis.totalRevenue.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        MXN
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.light', width: 56, height: 56 }}>
                      <AttachMoneyIcon color="success" sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Satisfaccion (CSAT)
                      </Typography>
                      <Stack direction="row" alignItems="baseline" spacing={1}>
                        <Typography variant="h4" fontWeight={700}>
                          {kpis.avgCsat.toFixed(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          / 5
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarIcon
                            key={star}
                            sx={{
                              fontSize: 20,
                              color: star <= Math.round(kpis.avgCsat) ? 'warning.main' : 'grey.300',
                            }}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <Avatar sx={{ bgcolor: 'warning.light', width: 56, height: 56 }}>
                      <StarIcon color="warning" sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Choferes Activos
                      </Typography>
                      <Typography variant="h4" fontWeight={700}>
                        {kpis.activeDrivers}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        En operacion hoy
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'info.light', width: 56, height: 56 }}>
                      <PeopleIcon color="info" sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Pending Orders */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Resumen de Operaciones
                </Typography>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {kpis.pending}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pendientes de Despacho
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {kpis.inTransit}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        En Transito
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {kpis.delivered}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Entregados Hoy
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700}>
                        {kpis.avgDeliveryTime}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tiempo Promedio
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}>
        <Typography variant="caption" color="text.secondary">
          SCRAM 2026 - Dashboard de Direccion
        </Typography>
      </Box>
    </Box>
  );
}
