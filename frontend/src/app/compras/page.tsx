'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Snackbar,
  Alert,
  Avatar,
  Tooltip,
  Checkbox,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SendIcon from '@mui/icons-material/Send';
import InventoryIcon from '@mui/icons-material/Inventory';

import { ordersApi, syncApi } from '@/lib/api';

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Borrador', color: 'default' },
  READY: { label: 'Listo', color: 'info' },
  IN_TRANSIT: { label: 'En Ruta', color: 'primary' },
  DELIVERED: { label: 'Entregado', color: 'success' },
};

const priorityConfig: Record<number, { label: string; color: 'default' | 'warning' | 'error' }> = {
  1: { label: 'Normal', color: 'default' },
  2: { label: 'Alta', color: 'warning' },
  3: { label: 'Urgente', color: 'error' },
};

export default function ComprasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['compras-orders'],
    queryFn: async () => {
      const response = await ordersApi.getAll({ status: 'DRAFT,READY' });
      return response.data;
    },
  });

  const syncBindMutation = useMutation({
    mutationFn: async () => {
      return syncApi.syncBind();
    },
    onSuccess: (response) => {
      const data = response.data;
      setSnackbar({
        open: true,
        message: `Sincronizacion completada: ${data.created || 0} nuevos, ${data.updated || 0} actualizados`,
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al sincronizar con Bind ERP',
        severity: 'error',
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      return ordersApi.release ? ordersApi.release(selectedIds) : Promise.reject('Not implemented');
    },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: `${selectedIds.length} pedidos liberados a Trafico`,
        severity: 'success',
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al liberar pedidos',
        severity: 'error',
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const draftOrders = orders?.filter((o: any) => o.status === 'DRAFT') || [];
  const readyOrders = orders?.filter((o: any) => o.status === 'READY') || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <InventoryIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600}>
              Panel de Compras
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sincronizacion y liberacion de pedidos
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={syncBindMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
              onClick={() => syncBindMutation.mutate()}
              disabled={syncBindMutation.isPending}
            >
              Sincronizar Bind
            </Button>
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Salir
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Stats Cards */}
      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'warning.light' }}>
                  <WarningIcon color="warning" />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {draftOrders.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pendientes de Validar
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'success.light' }}>
                  <CheckCircleIcon color="success" />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {readyOrders.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Listos para Trafico
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        {/* Orders Table */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              Pedidos Pendientes ({orders?.length || 0})
            </Typography>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={selectedIds.length === 0}
              onClick={() => releaseMutation.mutate()}
            >
              Liberar a Trafico ({selectedIds.length})
            </Button>
          </Stack>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : orders?.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <LocalShippingIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">
                No hay pedidos pendientes. Sincroniza con Bind para obtener nuevos pedidos.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox"></TableCell>
                    <TableCell>ID Bind</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>RFC</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Prioridad</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders?.map((order: any) => {
                    const priority = priorityConfig[order.priorityLevel] || priorityConfig[1];
                    const status = statusConfig[order.status] || statusConfig.DRAFT;
                    return (
                      <TableRow
                        key={order.id}
                        hover
                        selected={selectedIds.includes(order.id)}
                        onClick={() => toggleSelection(order.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedIds.includes(order.id)} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {order.bindId}
                          </Typography>
                        </TableCell>
                        <TableCell>{order.clientName}</TableCell>
                        <TableCell>{order.clientRfc || '-'}</TableCell>
                        <TableCell align="right">
                          ${order.totalAmount?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={priority.label} color={priority.color} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={status.label} color={status.color} variant="outlined" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

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
