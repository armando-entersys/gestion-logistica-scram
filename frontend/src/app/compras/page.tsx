'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
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
  Checkbox,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Pagination,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SendIcon from '@mui/icons-material/Send';
import UndoIcon from '@mui/icons-material/Undo';
import InventoryIcon from '@mui/icons-material/Inventory';
import SearchIcon from '@mui/icons-material/Search';

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

const ITEMS_PER_PAGE = 5;

export default function ComprasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [selectedReadyIds, setSelectedReadyIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [draftPage, setDraftPage] = useState(1);
  const [readyPage, setReadyPage] = useState(1);
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

  const { data: orders, isLoading } = useQuery({
    queryKey: ['compras-orders'],
    queryFn: async () => {
      const response = await ordersApi.getAll({ status: 'DRAFT,READY', limit: 100 });
      return response.data.data || response.data;
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
      return ordersApi.release(selectedDraftIds);
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `${response.data.released || selectedDraftIds.length} pedidos liberados a Trafico`,
        severity: 'success',
      });
      setSelectedDraftIds([]);
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

  const revertMutation = useMutation({
    mutationFn: async () => {
      return ordersApi.revert(selectedReadyIds);
    },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `${response.data.reverted || selectedReadyIds.length} pedidos revertidos a Borrador`,
        severity: 'success',
      });
      setSelectedReadyIds([]);
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al revertir pedidos',
        severity: 'error',
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const toggleDraftSelection = (id: string) => {
    setSelectedDraftIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleReadySelection = (id: string) => {
    setSelectedReadyIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!search) return orders;
    const searchLower = search.toLowerCase();
    return orders.filter(
      (o: any) =>
        o.clientName?.toLowerCase().includes(searchLower) ||
        o.bindId?.toLowerCase().includes(searchLower) ||
        o.clientRfc?.toLowerCase().includes(searchLower)
    );
  }, [orders, search]);

  const draftOrders = filteredOrders.filter((o: any) => o.status === 'DRAFT') || [];
  const readyOrders = filteredOrders.filter((o: any) => o.status === 'READY') || [];

  // Pagination
  const draftTotalPages = Math.ceil(draftOrders.length / ITEMS_PER_PAGE);
  const readyTotalPages = Math.ceil(readyOrders.length / ITEMS_PER_PAGE);

  const paginatedDraftOrders = draftOrders.slice(
    (draftPage - 1) * ITEMS_PER_PAGE,
    draftPage * ITEMS_PER_PAGE
  );
  const paginatedReadyOrders = readyOrders.slice(
    (readyPage - 1) * ITEMS_PER_PAGE,
    readyPage * ITEMS_PER_PAGE
  );

  // Reset page when search changes
  useEffect(() => {
    setDraftPage(1);
    setReadyPage(1);
  }, [search]);

  const renderOrdersTable = (orderList: any[], selectedIds: string[], onToggle: (id: string) => void) => (
    <TableContainer>
      <Table size="small">
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
          {orderList.map((order: any) => {
            const priority = priorityConfig[order.priorityLevel] || priorityConfig[1];
            const status = statusConfig[order.status] || statusConfig.DRAFT;
            return (
              <TableRow
                key={order.id}
                hover
                selected={selectedIds.includes(order.id)}
                onClick={() => onToggle(order.id)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedIds.includes(order.id)} size="small" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {order.bindId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                    {order.clientName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{order.clientRfc || '-'}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">${order.totalAmount?.toLocaleString() || 0}</Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={priority.label} color={priority.color} sx={{ height: 20, fontSize: 11 }} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

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
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Salir
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Stats Cards */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Stack direction="row" spacing={2}>
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              border: activeTab === 0 ? 2 : 0,
              borderColor: 'warning.main',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab(0)}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'warning.light', width: 40, height: 40 }}>
                  <WarningIcon color="warning" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {draftOrders.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pendientes de Validar
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              border: activeTab === 1 ? 2 : 0,
              borderColor: 'info.main',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab(1)}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'info.light', width: 40, height: 40 }}>
                  <CheckCircleIcon color="info" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {readyOrders.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Listos para Trafico
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Search and Tabs */}
      <Box sx={{ px: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por cliente, ID Bind o RFC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        <Paper sx={{ mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label={`Pendientes (${draftOrders.length})`} />
            <Tab label={`Liberados (${readyOrders.length})`} />
          </Tabs>
        </Paper>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, px: 2, pb: 2 }}>
        {activeTab === 0 && (
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Pedidos Pendientes de Validar
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={releaseMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                disabled={selectedDraftIds.length === 0 || releaseMutation.isPending}
                onClick={() => releaseMutation.mutate()}
              >
                Liberar ({selectedDraftIds.length})
              </Button>
            </Stack>

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : paginatedDraftOrders.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <LocalShippingIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  {search ? 'No se encontraron pedidos' : 'No hay pedidos pendientes. Sincroniza con Bind.'}
                </Typography>
              </Box>
            ) : (
              <>
                {renderOrdersTable(paginatedDraftOrders, selectedDraftIds, toggleDraftSelection)}
                {draftTotalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={draftTotalPages}
                      page={draftPage}
                      onChange={(_, p) => setDraftPage(p)}
                      size="small"
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </Paper>
        )}

        {activeTab === 1 && (
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Pedidos Liberados a Trafico
              </Typography>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={revertMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <UndoIcon />}
                disabled={selectedReadyIds.length === 0 || revertMutation.isPending}
                onClick={() => revertMutation.mutate()}
              >
                Revertir ({selectedReadyIds.length})
              </Button>
            </Stack>

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : paginatedReadyOrders.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  {search ? 'No se encontraron pedidos' : 'No hay pedidos liberados a trafico.'}
                </Typography>
              </Box>
            ) : (
              <>
                {renderOrdersTable(paginatedReadyOrders, selectedReadyIds, toggleReadySelection)}
                {readyTotalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={readyTotalPages}
                      page={readyPage}
                      onChange={(_, p) => setReadyPage(p)}
                      size="small"
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </Paper>
        )}
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
