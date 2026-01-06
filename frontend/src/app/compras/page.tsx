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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Grid,
  Tooltip,
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
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NotesIcon from '@mui/icons-material/Notes';

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

const ITEMS_PER_PAGE = 15;

interface Order {
  id: string;
  bindId: string;
  orderNumber?: string;
  warehouseName?: string;
  employeeName?: string;
  clientNumber?: string;
  purchaseOrder?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientRfc?: string;
  addressRaw?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    reference?: string;
  };
  status: string;
  priorityLevel: number;
  totalAmount: number;
  isVip?: boolean;
  promisedDate?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function ComprasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [selectedReadyIds, setSelectedReadyIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [draftPage, setDraftPage] = useState(1);
  const [readyPage, setReadyPage] = useState(1);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
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

  // Filter and sort orders by search and date
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let result = orders;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (o: any) =>
          o.clientName?.toLowerCase().includes(searchLower) ||
          o.bindId?.toLowerCase().includes(searchLower) ||
          o.clientRfc?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by createdAt descending (newest first)
    return result.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAddress = (addressRaw: Order['addressRaw']) => {
    if (!addressRaw) return '-';
    const parts = [
      addressRaw.street,
      addressRaw.number,
      addressRaw.neighborhood,
      addressRaw.city,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  const renderOrdersTable = (orderList: Order[], selectedIds: string[], onToggle: (id: string) => void) => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell padding="checkbox" sx={{ width: 40 }}></TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Número</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Destino</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>Ver</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orderList.map((order: Order) => {
            const priority = priorityConfig[order.priorityLevel] || priorityConfig[1];
            const status = statusConfig[order.status] || statusConfig.DRAFT;
            return (
              <TableRow
                key={order.id}
                hover
                selected={selectedIds.includes(order.id)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <TableCell padding="checkbox" onClick={() => onToggle(order.id)}>
                  <Checkbox checked={selectedIds.includes(order.id)} size="small" />
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {order.orderNumber || order.bindId?.substring(0, 8)}
                    </Typography>
                    {order.isVip && (
                      <Chip label="VIP" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Stack>
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(order.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Tooltip title={order.clientRfc || ''}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                      {order.clientName}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 180, display: 'block' }}>
                    {formatAddress(order.addressRaw)}
                  </Typography>
                </TableCell>
                <TableCell align="right" onClick={() => onToggle(order.id)}>
                  <Typography variant="body2" fontWeight={500}>
                    ${order.totalAmount?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                  </Typography>
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Stack direction="row" spacing={0.5}>
                    <Chip
                      size="small"
                      label={status.label}
                      color={status.color}
                      sx={{ height: 22, fontSize: 11 }}
                    />
                    {priority.color !== 'default' && (
                      <Chip
                        size="small"
                        label={priority.label}
                        color={priority.color}
                        variant="outlined"
                        sx={{ height: 22, fontSize: 11 }}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Ver detalles">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailOrder(order);
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
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

      {/* Order Detail Modal */}
      <Dialog
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        {detailOrder && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h6" fontWeight={600}>
                    Pedido {detailOrder.orderNumber || detailOrder.bindId?.substring(0, 8)}
                  </Typography>
                  {detailOrder.isVip && (
                    <Chip label="VIP" size="small" color="warning" />
                  )}
                </Stack>
                <IconButton onClick={() => setDetailOrder(null)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                {/* Información del Pedido */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">No. Pedido</Typography>
                        <Typography variant="body2" fontWeight={600}>{detailOrder.orderNumber || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">Almacén</Typography>
                        <Typography variant="body2" fontWeight={500}>{detailOrder.warehouseName || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">Vendedor</Typography>
                        <Typography variant="body2" fontWeight={500}>{detailOrder.employeeName || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">O.C. Cliente</Typography>
                        <Typography variant="body2" fontWeight={500}>{detailOrder.purchaseOrder || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Información del Cliente */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <PersonIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Cliente {detailOrder.clientNumber ? `#${detailOrder.clientNumber}` : ''}
                      </Typography>
                    </Stack>
                    <Typography variant="body1" fontWeight={500}>
                      {detailOrder.clientName}
                    </Typography>
                    {detailOrder.clientRfc && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        RFC: {detailOrder.clientRfc}
                      </Typography>
                    )}
                    {detailOrder.clientEmail && (
                      <Typography variant="body2" color="text.secondary">
                        {detailOrder.clientEmail}
                      </Typography>
                    )}
                    {detailOrder.clientPhone && (
                      <Typography variant="body2" color="text.secondary">
                        Tel: {detailOrder.clientPhone}
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Destino */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <LocationOnIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Dirección de Entrega
                      </Typography>
                    </Stack>
                    {detailOrder.addressRaw ? (
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {detailOrder.addressRaw.street} {detailOrder.addressRaw.number}
                        </Typography>
                        {detailOrder.addressRaw.neighborhood && (
                          <Typography variant="body2">
                            Col. {detailOrder.addressRaw.neighborhood}
                            {detailOrder.addressRaw.postalCode && `, CP ${detailOrder.addressRaw.postalCode}`}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {detailOrder.addressRaw.city}
                          {detailOrder.addressRaw.state && `, ${detailOrder.addressRaw.state}`}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No especificado
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Comentarios/Notas del Pedido - Pueden contener dirección alternativa */}
                {detailOrder.addressRaw?.reference && (
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <NotesIcon color="warning" fontSize="small" />
                        <Typography variant="subtitle2" fontWeight={600} color="warning.dark">
                          Comentarios del Pedido (Revisar dirección)
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {detailOrder.addressRaw.reference}
                      </Typography>
                      <Typography variant="caption" color="warning.dark" sx={{ mt: 1, display: 'block' }}>
                        ⚠️ Verificar si hay una dirección de entrega diferente en estos comentarios
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {/* Datos del Pedido */}
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <AttachMoneyIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Total
                      </Typography>
                    </Stack>
                    <Typography variant="h5" fontWeight={700} color="primary.main">
                      ${detailOrder.totalAmount?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <CalendarTodayIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Fechas
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Creado: {formatDate(detailOrder.createdAt)}
                    </Typography>
                    {detailOrder.promisedDate && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Prometido: {new Date(detailOrder.promisedDate).toLocaleDateString('es-MX')}
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Estado */}
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">
                      Estado:
                    </Typography>
                    <Chip
                      label={statusConfig[detailOrder.status]?.label || detailOrder.status}
                      color={statusConfig[detailOrder.status]?.color || 'default'}
                    />
                    {detailOrder.priorityLevel > 1 && (
                      <Chip
                        label={priorityConfig[detailOrder.priorityLevel]?.label || 'Normal'}
                        color={priorityConfig[detailOrder.priorityLevel]?.color || 'default'}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Grid>

                {/* Notas */}
                {detailOrder.internalNotes && (
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'warning.50' }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <NotesIcon color="warning" fontSize="small" />
                        <Typography variant="subtitle2" fontWeight={600}>
                          Comentarios
                        </Typography>
                      </Stack>
                      <Typography variant="body2">
                        {detailOrder.internalNotes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDetailOrder(null)} variant="outlined">
                Cerrar
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (detailOrder.status === 'DRAFT') {
                    setSelectedDraftIds((prev) =>
                      prev.includes(detailOrder.id)
                        ? prev.filter((id) => id !== detailOrder.id)
                        : [...prev, detailOrder.id]
                    );
                  } else if (detailOrder.status === 'READY') {
                    setSelectedReadyIds((prev) =>
                      prev.includes(detailOrder.id)
                        ? prev.filter((id) => id !== detailOrder.id)
                        : [...prev, detailOrder.id]
                    );
                  }
                  setDetailOrder(null);
                }}
              >
                {(detailOrder.status === 'DRAFT' && selectedDraftIds.includes(detailOrder.id)) ||
                 (detailOrder.status === 'READY' && selectedReadyIds.includes(detailOrder.id))
                  ? 'Deseleccionar'
                  : 'Seleccionar'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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
