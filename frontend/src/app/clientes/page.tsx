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
  TablePagination,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Tooltip,
  InputAdornment,
  Grid,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HomeIcon from '@mui/icons-material/Home';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

import { clientsApi, clientAddressesApi } from '@/lib/api';

interface Client {
  id: string;
  clientNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  category: string | null;
  notes: string | null;
  isVip: boolean;
  totalOrders: number;
  totalAmount: string | number;
  lastOrderAt: string | null;
  createdAt: string;
}

interface ClientAddress {
  id: string;
  clientNumber: string;
  label: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
  isDefault: boolean;
  useCount: number;
}

interface ClientOrder {
  id: string;
  orderNumber: string | null;
  status: string;
  totalAmount: number;
  clientName: string;
  promisedDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
  addressRaw: {
    street: string;
    city: string;
    state: string;
  } | null;
}

interface ClientStats {
  totalClients: number;
  vipClients: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default function ClientesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState(0);
  const [clientAddresses, setClientAddresses] = useState<ClientAddress[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [formData, setFormData] = useState({
    clientNumber: '',
    name: '',
    email: '',
    phone: '',
    rfc: '',
    category: '',
    notes: '',
    isVip: false,
  });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token) {
      router.push('/login');
      return;
    }
    // Check if user is admin or purchasing
    try {
      const userData = JSON.parse(user || '{}');
      if (!['ADMIN', 'PURCHASING'].includes(userData.roleCode)) {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }, [router]);

  // Fetch clients
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients', search, vipFilter, page, rowsPerPage],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: page + 1,
        limit: rowsPerPage,
      };
      if (search) params.search = search;
      if (vipFilter !== null) params.isVip = vipFilter;
      const response = await clientsApi.getAll(params);
      return response.data as { data: Client[]; total: number; page: number; limit: number };
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['clients-stats'],
    queryFn: async () => {
      const response = await clientsApi.getStats();
      return response.data as ClientStats;
    },
  });

  const clients = clientsData?.data || [];
  const totalClients = clientsData?.total || 0;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return clientsApi.create(data);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Cliente creado exitosamente', severity: 'success' });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al crear cliente',
        severity: 'error',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return clientsApi.update(id, data);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Cliente actualizado exitosamente', severity: 'success' });
      setDialogOpen(false);
      setSelectedClient(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al actualizar cliente',
        severity: 'error',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return clientsApi.delete(id);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Cliente eliminado exitosamente', severity: 'success' });
      setDeleteDialogOpen(false);
      setSelectedClient(null);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al eliminar cliente',
        severity: 'error',
      });
    },
  });

  // Toggle VIP mutation
  const toggleVipMutation = useMutation({
    mutationFn: async ({ id, isVip }: { id: string; isVip: boolean }) => {
      return clientsApi.update(id, { isVip });
    },
    onSuccess: (_, variables) => {
      setSnackbar({
        open: true,
        message: variables.isVip ? 'Cliente marcado como VIP' : 'Cliente desmarcado como VIP',
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al cambiar estado VIP',
        severity: 'error',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      clientNumber: '',
      name: '',
      email: '',
      phone: '',
      rfc: '',
      category: '',
      notes: '',
      isVip: false,
    });
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        clientNumber: client.clientNumber,
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        rfc: client.rfc || '',
        category: client.category || '',
        notes: client.notes || '',
        isVip: client.isVip,
      });
    } else {
      setSelectedClient(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleOpenDetailDialog = async (client: Client) => {
    setSelectedClient(client);
    setDetailTab(0);
    setDetailDialogOpen(true);
    setLoadingDetails(true);
    setClientAddresses([]);
    setClientOrders([]);
    try {
      // Fetch client details with addresses and orders
      const response = await clientsApi.getDetails(client.id);
      const data = response.data as Client & { addresses: ClientAddress[]; orders: ClientOrder[] };
      setClientAddresses(data.addresses || []);
      setClientOrders(data.orders || []);
    } catch (error) {
      // Fallback: try to get addresses separately
      try {
        const addrResponse = await clientAddressesApi.getByClient(client.clientNumber);
        setClientAddresses(addrResponse.data as ClientAddress[]);
      } catch {
        setClientAddresses([]);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = () => {
    if (selectedClient) {
      const updateData: any = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        rfc: formData.rfc || null,
        category: formData.category || null,
        notes: formData.notes || null,
        isVip: formData.isVip,
      };
      updateMutation.mutate({ id: selectedClient.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0);
  };

  const formatAddress = (addr: ClientAddress) => {
    const parts = [
      addr.street,
      addr.number ? `#${addr.number}` : null,
      addr.neighborhood,
      addr.postalCode ? `CP ${addr.postalCode}` : null,
      addr.city,
      addr.state,
    ].filter(Boolean);
    return parts.join(', ') || 'Direccion incompleta';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => router.back()} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <BusinessIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600}>
              Gestion de Clientes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Administrar clientes y direcciones
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Nuevo Cliente
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
      <Box sx={{ p: 3, pb: 0 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <BusinessIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {stats?.totalClients || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Clientes
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <StarIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {stats?.vipClients || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Clientes VIP
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <AttachMoneyIcon color="success" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {formatCurrency(stats?.totalRevenue || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ingresos Totales
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <ShoppingCartIcon color="info" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" fontWeight={600}>
                      {formatCurrency(stats?.averageOrderValue || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ticket Promedio
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ p: 3, pb: 0 }}>
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Buscar por nombre, numero de cliente, email o telefono..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 500 }}
            />
            <Stack direction="row" spacing={1}>
              <Chip
                label="Todos"
                variant={vipFilter === null ? 'filled' : 'outlined'}
                onClick={() => { setVipFilter(null); setPage(0); }}
                color={vipFilter === null ? 'primary' : 'default'}
              />
              <Chip
                icon={<StarIcon />}
                label="VIP"
                variant={vipFilter === true ? 'filled' : 'outlined'}
                onClick={() => { setVipFilter(true); setPage(0); }}
                color={vipFilter === true ? 'warning' : 'default'}
              />
              <Chip
                label="No VIP"
                variant={vipFilter === false ? 'filled' : 'outlined'}
                onClick={() => { setVipFilter(false); setPage(0); }}
                color={vipFilter === false ? 'default' : 'default'}
              />
            </Stack>
          </Stack>
        </Paper>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 2 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Cliente</TableCell>
                      <TableCell>Contacto</TableCell>
                      <TableCell align="right">Pedidos</TableCell>
                      <TableCell align="right">Total Compras</TableCell>
                      <TableCell>Ultimo Pedido</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow
                        key={client.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleOpenDetailDialog(client)}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" fontWeight={500}>
                                  {client.name}
                                </Typography>
                                {client.isVip && (
                                  <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                #{client.clientNumber}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0}>
                            {client.email && (
                              <Typography variant="body2" color="text.secondary">
                                {client.email}
                              </Typography>
                            )}
                            {client.phone && (
                              <Typography variant="body2" color="text.secondary">
                                {client.phone}
                              </Typography>
                            )}
                            {!client.email && !client.phone && (
                              <Typography variant="body2" color="text.disabled">
                                Sin contacto
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={client.totalOrders}
                            color={client.totalOrders > 10 ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={500}>
                            {formatCurrency(client.totalAmount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {client.lastOrderAt ? (
                            new Date(client.lastOrderAt).toLocaleDateString('es-MX')
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              Sin pedidos
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title={client.isVip ? 'Quitar VIP' : 'Marcar VIP'}>
                              <IconButton
                                size="small"
                                onClick={() => toggleVipMutation.mutate({ id: client.id, isVip: !client.isVip })}
                              >
                                {client.isVip ? (
                                  <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                                ) : (
                                  <StarBorderIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => handleOpenDialog(client)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setSelectedClient(client);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {clients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                          <Typography color="text.secondary">
                            No se encontraron clientes
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalClients}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                labelRowsPerPage="Filas por pagina:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
              />
            </>
          )}
        </Paper>
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedClient ? 'Editar Cliente' : 'Nuevo Cliente'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Numero de Cliente"
              value={formData.clientNumber}
              onChange={(e) => setFormData({ ...formData, clientNumber: e.target.value })}
              required
              disabled={!!selectedClient}
              helperText={selectedClient ? 'No se puede cambiar el numero de cliente' : ''}
            />
            <TextField
              fullWidth
              label="Nombre / Razon Social"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <TextField
                fullWidth
                label="Telefono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="RFC"
                value={formData.rfc}
                onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
              />
              <TextField
                fullWidth
                label="Categoria"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ej: Mayorista, Minorista"
              />
            </Stack>
            <TextField
              fullWidth
              label="Notas"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isVip}
                  onChange={(e) => setFormData({ ...formData, isVip: e.target.checked })}
                  color="warning"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <StarIcon sx={{ color: formData.isVip ? 'warning.main' : 'text.disabled' }} />
                  <Typography>Cliente VIP</Typography>
                </Stack>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending || !formData.clientNumber || !formData.name}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <CircularProgress size={24} />
            ) : selectedClient ? (
              'Actualizar'
            ) : (
              'Crear'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <BusinessIcon color="primary" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">
                {selectedClient?.name}
                {selectedClient?.isVip && (
                  <StarIcon sx={{ ml: 1, fontSize: 20, color: 'warning.main', verticalAlign: 'middle' }} />
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                #{selectedClient?.clientNumber}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
            <Tab label="Informacion" />
            <Tab label={`Direcciones (${clientAddresses.length})`} />
            <Tab label={`Pedidos (${clientOrders.length})`} />
          </Tabs>

          {detailTab === 0 && selectedClient && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Datos de Contacto
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><EmailIcon /></ListItemIcon>
                    <ListItemText
                      primary={selectedClient.email || 'No registrado'}
                      secondary="Email"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><PhoneIcon /></ListItemIcon>
                    <ListItemText
                      primary={selectedClient.phone || 'No registrado'}
                      secondary="Telefono"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><ReceiptIcon /></ListItemIcon>
                    <ListItemText
                      primary={selectedClient.rfc || 'No registrado'}
                      secondary="RFC"
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Estadisticas
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><ShoppingCartIcon /></ListItemIcon>
                    <ListItemText
                      primary={selectedClient.totalOrders}
                      secondary="Total de Pedidos"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><AttachMoneyIcon /></ListItemIcon>
                    <ListItemText
                      primary={formatCurrency(selectedClient.totalAmount)}
                      secondary="Total Compras"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><BusinessIcon /></ListItemIcon>
                    <ListItemText
                      primary={selectedClient.category || 'Sin categoria'}
                      secondary="Categoria"
                    />
                  </ListItem>
                </List>
              </Grid>
              {selectedClient.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Notas
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2">{selectedClient.notes}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}

          {detailTab === 1 && (
            <>
              {loadingDetails ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : clientAddresses.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocationOnIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No hay direcciones guardadas para este cliente
                  </Typography>
                </Box>
              ) : (
                <List>
                  {clientAddresses.map((addr) => (
                    <ListItem
                      key={addr.id}
                      secondaryAction={
                        addr.isDefault && (
                          <Chip size="small" label="Principal" color="primary" />
                        )
                      }
                      sx={{
                        border: '1px solid',
                        borderColor: addr.isDefault ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemIcon>
                        <HomeIcon color={addr.isDefault ? 'primary' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={500}>
                              {addr.label || 'Sin etiqueta'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ({addr.useCount} usos)
                            </Typography>
                          </Stack>
                        }
                        secondary={formatAddress(addr)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </>
          )}

          {detailTab === 2 && (
            <>
              {loadingDetails ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : clientOrders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocalShippingIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No hay pedidos registrados para este cliente
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Pedido</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Monto</TableCell>
                        <TableCell>Direccion</TableCell>
                        <TableCell>Fecha</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {order.orderNumber || order.id.substring(0, 8)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={order.status}
                              color={
                                order.status === 'DELIVERED' ? 'success' :
                                order.status === 'IN_TRANSIT' ? 'info' :
                                order.status === 'READY' ? 'warning' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                              {order.addressRaw?.street || 'Sin direccion'}
                              {order.addressRaw?.city && `, ${order.addressRaw.city}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {order.deliveredAt
                              ? new Date(order.deliveredAt).toLocaleDateString('es-MX')
                              : order.promisedDate
                              ? new Date(order.promisedDate).toLocaleDateString('es-MX')
                              : new Date(order.createdAt).toLocaleDateString('es-MX')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Cerrar</Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              setDetailDialogOpen(false);
              handleOpenDialog(selectedClient!);
            }}
          >
            Editar Cliente
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Eliminacion</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estas seguro de que deseas eliminar al cliente <strong>{selectedClient?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            Esta accion no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => selectedClient && deleteMutation.mutate(selectedClient.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <CircularProgress size={24} /> : 'Eliminar'}
          </Button>
        </DialogActions>
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
