'use client';

import { useEffect, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Chip,
  Divider,
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
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import UndoIcon from '@mui/icons-material/Undo';
import AssignmentIcon from '@mui/icons-material/Assignment';

import { ordersApi } from '@/lib/api';

interface DashboardStats {
  total: number;
  delivered: number;
  inTransit: number;
  pending: number;
  returned: number;
  deliveryRate: number;
  totalRevenue: number;
  avgCsat: number | null;
  csatCount: number;
  activeDrivers: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byDriver: Array<{
    driverId: string;
    driverName: string;
    total: number;
    delivered: number;
    pending: number;
  }>;
  dailyDeliveries: Array<{ date: string; count: number }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', startDate, endDate],
    queryFn: async () => {
      const response = await ordersApi.getStats(startDate, endDate);
      return response.data;
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleExportCSV = async () => {
    try {
      const response = await ordersApi.exportReport(startDate, endDate);
      const orders = response.data;

      // Convert to CSV
      const headers = [
        'ID Bind',
        'Numero Pedido',
        'Cliente',
        'Email',
        'Telefono',
        'Direccion',
        'Estado',
        'Prioridad',
        'Monto',
        'Chofer',
        'Fecha Creacion',
        'Fecha Entrega',
        'CSAT',
        'Comentario CSAT',
      ];

      const statusMap: Record<string, string> = {
        DRAFT: 'Borrador',
        READY: 'Listo',
        IN_TRANSIT: 'En Transito',
        DELIVERED: 'Entregado',
        RETURNED: 'Devuelto',
      };

      const rows = orders.map((order: any) => [
        order.bindId || '',
        order.orderNumber || '',
        order.clientName || '',
        order.clientEmail || '',
        order.clientPhone || '',
        `"${(order.address || '').replace(/"/g, '""')}"`,
        statusMap[order.status] || order.status,
        order.priorityLevel || '',
        order.totalAmount || 0,
        order.driverName || '',
        order.createdAt ? new Date(order.createdAt).toLocaleString('es-MX') : '',
        order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('es-MX') : '',
        order.csatScore || '',
        `"${(order.csatFeedback || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: string[]) => row.join(',')),
      ].join('\n');

      // Download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reporte-pedidos-${startDate}-a-${endDate}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Error al exportar el reporte');
    }
  };

  const setDateRange = (range: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        // Already set to today
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setDate(today.getDate() - 30);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const maxDailyDeliveries = Math.max(...(stats?.dailyDeliveries?.map(d => d.count) || [1]));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: 'primary.main' }} elevation={1}>
        <Toolbar>
          <Box
            component="img"
            src="/scram-logo.png"
            alt="SCRAM"
            sx={{ height: 36, mr: 2 }}
          />
          <Box
            sx={{
              width: 3,
              height: 32,
              background: 'linear-gradient(180deg, #ff9900 0%, #44ce6f 100%)',
              borderRadius: 2,
              mr: 2,
            }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600} color="white">
              Dashboard Ejecutivo
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              KPIs y metricas de operacion
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<AssignmentIcon />}
              onClick={() => router.push('/planning')}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              Planeacion
            </Button>
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              Salir
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Date Range Selector */}
      <Paper sx={{ p: 2, mx: 3, mt: 3, mb: 0 }} elevation={1}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarTodayIcon color="action" />
            <Typography variant="subtitle2" color="text.secondary">
              Periodo:
            </Typography>
            <TextField
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              sx={{ width: 150 }}
            />
            <Typography color="text.secondary">a</Typography>
            <TextField
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              sx={{ width: 150 }}
            />
            <IconButton onClick={() => refetch()} size="small" color="primary">
              <RefreshIcon />
            </IconButton>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label="Hoy" onClick={() => setDateRange('today')} variant={startDate === endDate ? 'filled' : 'outlined'} />
            <Chip label="Ayer" onClick={() => setDateRange('yesterday')} variant="outlined" />
            <Chip label="7 dias" onClick={() => setDateRange('week')} variant="outlined" />
            <Chip label="30 dias" onClick={() => setDateRange('month')} variant="outlined" />
            <Divider orientation="vertical" flexItem />
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportCSV}
              size="small"
            >
              Exportar CSV
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Box sx={{ p: 3, flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Main KPIs Row */}
            <Grid item xs={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Total Pedidos
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {stats?.total || 0}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <LocalShippingIcon color="primary" />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Entregados
                      </Typography>
                      <Typography variant="h3" fontWeight={700} color="success.main">
                        {stats?.delivered || 0}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.light' }}>
                      <CheckCircleIcon color="success" />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        En Ruta
                      </Typography>
                      <Typography variant="h3" fontWeight={700} color="info.main">
                        {stats?.inTransit || 0}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'info.light' }}>
                      <ScheduleIcon color="info" />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Tasa de Entrega
                      </Typography>
                      <Typography variant="h3" fontWeight={700}>
                        {stats?.deliveryRate || 0}%
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'secondary.light' }}>
                      <TrendingUpIcon color="secondary" />
                    </Avatar>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={stats?.deliveryRate || 0}
                    sx={{ mt: 2, height: 8, borderRadius: 4 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Secondary KPIs Row */}
            <Grid item xs={12} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Ingresos
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        ${(stats?.totalRevenue || 0).toLocaleString()}
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

            <Grid item xs={12} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Satisfaccion (CSAT)
                      </Typography>
                      <Stack direction="row" alignItems="baseline" spacing={1}>
                        <Typography variant="h4" fontWeight={700}>
                          {stats?.avgCsat?.toFixed(1) || '-'}
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
                              color: star <= Math.round(stats?.avgCsat || 0) ? 'warning.main' : 'grey.300',
                            }}
                          />
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {stats?.csatCount || 0} respuestas
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'warning.light', width: 56, height: 56 }}>
                      <StarIcon color="warning" sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Choferes Activos
                      </Typography>
                      <Typography variant="h4" fontWeight={700}>
                        {stats?.activeDrivers || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Con pedidos asignados
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'info.light', width: 56, height: 56 }}>
                      <PeopleIcon color="info" sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Devoluciones
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {stats?.returned || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Pedidos devueltos
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'warning.light', width: 56, height: 56 }}>
                      <UndoIcon color="warning" sx={{ fontSize: 32 }} />
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Daily Deliveries Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Entregas Ultimos 7 Dias
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 200, gap: 1, mt: 2 }}>
                  {stats?.dailyDeliveries?.map((day) => (
                    <Box key={day.date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5 }}>
                        {day.count}
                      </Typography>
                      <Box
                        sx={{
                          width: '100%',
                          height: maxDailyDeliveries > 0 ? `${(day.count / maxDailyDeliveries) * 150}px` : '4px',
                          minHeight: 4,
                          bgcolor: 'primary.main',
                          borderRadius: 1,
                          transition: 'height 0.3s',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontSize: 10 }}>
                        {formatDate(day.date)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>

            {/* Driver Stats Table */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Rendimiento por Chofer
                </Typography>
                <TableContainer sx={{ maxHeight: 250 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Chofer</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Entregados</TableCell>
                        <TableCell align="right">Pendientes</TableCell>
                        <TableCell align="right">%</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats?.byDriver?.length ? (
                        stats.byDriver.map((driver) => (
                          <TableRow key={driver.driverId}>
                            <TableCell>{driver.driverName}</TableCell>
                            <TableCell align="right">{driver.total}</TableCell>
                            <TableCell align="right">
                              <Typography color="success.main" fontWeight={500}>
                                {driver.delivered}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography color="warning.main" fontWeight={500}>
                                {driver.pending}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {driver.total > 0 ? Math.round((driver.delivered / driver.total) * 100) : 0}%
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="text.secondary" variant="body2">
                              Sin datos para este periodo
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* Status Summary */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Resumen por Estado
                </Typography>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={6} md={2.4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {stats?.pending || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Listos (Pendientes)
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2.4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="info.main">
                        {stats?.inTransit || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        En Transito
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2.4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {stats?.delivered || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Entregados
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2.4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">
                        {stats?.returned || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Devueltos
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2.4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                      <Typography variant="h4" fontWeight={700}>
                        {stats?.deliveryRate || 0}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tasa de Entrega
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
