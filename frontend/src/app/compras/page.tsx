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
import ReceiptIcon from '@mui/icons-material/Receipt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SelectAllIcon from '@mui/icons-material/SelectAll';

import { ordersApi, syncApi, clientAddressesApi } from '@/lib/api';
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

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

interface OrphanInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientId: string;
  clientName: string;
  employeeName: string;
  total: number;
  hasOrder: boolean;
}

interface ClientAddress {
  id: string;
  clientNumber: string;
  label?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  reference?: string;
  isDefault?: boolean;
  useCount?: number;
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
  const [orphanPage, setOrphanPage] = useState(1);
  const [dismissDialog, setDismissDialog] = useState<{ open: boolean; invoice: OrphanInvoice | null; reason: string }>({
    open: false,
    invoice: null,
    reason: '',
  });
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [bulkDismissOpen, setBulkDismissOpen] = useState(false);
  const [bulkDismissReason, setBulkDismissReason] = useState('');

  // Client addresses state
  const [clientAddresses, setClientAddresses] = useState<ClientAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [newAddressDialogOpen, setNewAddressDialogOpen] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    label: '',
    street: '',
    number: '',
    neighborhood: '',
    postalCode: '',
    city: '',
    state: '',
    reference: '',
  });

  // Sorting state
  type SortField = 'orderNumber' | 'promisedDate' | 'createdAt' | 'clientName' | 'totalAmount';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('promisedDate');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'failed'>('idle');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const { data: orphanInvoices, isLoading: isLoadingOrphans } = useQuery({
    queryKey: ['orphan-invoices'],
    queryFn: async () => {
      const response = await syncApi.getOrphanInvoices();
      return response.data as OrphanInvoice[];
    },
  });


  // Fetch client addresses when detail order is opened
  useEffect(() => {
    const fetchAddresses = async () => {
      if (detailOrder?.clientNumber) {
        setLoadingAddresses(true);
        try {
          const response = await clientAddressesApi.getByClient(detailOrder.clientNumber);
          setClientAddresses(response.data || []);
        } catch (error) {
          console.error('Error fetching addresses:', error);
          setClientAddresses([]);
        } finally {
          setLoadingAddresses(false);
        }
      } else {
        setClientAddresses([]);
      }
      setSelectedAddressId('');
      setEditingAddress(false);
    };
    fetchAddresses();
  }, [detailOrder?.clientNumber, detailOrder?.id]);

  const syncBindMutation = useMutation({
    mutationFn: async () => {
      // 1. Iniciar sync asíncrono
      setSyncStatus('syncing');
      setSyncProgress(0);

      const response = await syncApi.syncBind();
      const { jobId } = response.data;

      // 2. Polling hasta que termine
      const result = await syncApi.waitForSync(jobId, (progress) => {
        setSyncProgress(progress);
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: (result) => {
      setSyncStatus('completed');
      const data = result.result;
      setSnackbar({
        open: true,
        message: `Sincronizacion completada: ${data?.orders?.created || 0} nuevos, ${data?.clients?.synced || 0} clientes`,
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });

      // Reset after 3 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress(0);
      }, 3000);
    },
    onError: (error: any) => {
      setSyncStatus('failed');
      setSnackbar({
        open: true,
        message: error.message || 'Error al sincronizar con Bind ERP',
        severity: 'error',
      });

      // Reset after 3 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress(0);
      }, 3000);
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

  const dismissInvoiceMutation = useMutation({
    mutationFn: async ({ invoice, reason }: { invoice: OrphanInvoice; reason: string }) => {
      return syncApi.dismissInvoice(
        invoice.id,
        invoice.invoiceNumber,
        invoice.clientName,
        invoice.total,
        reason || undefined
      );
    },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Factura descartada correctamente',
        severity: 'success',
      });
      setDismissDialog({ open: false, invoice: null, reason: '' });
      queryClient.invalidateQueries({ queryKey: ['orphan-invoices'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al descartar factura',
        severity: 'error',
      });
    },
  });

  const bulkDismissMutation = useMutation({
    mutationFn: async ({ invoiceIds, reason }: { invoiceIds: string[]; reason: string }) => {
      // Dismiss each invoice in sequence
      const results = [];
      for (const id of invoiceIds) {
        const invoice = orphanInvoices?.find((inv: OrphanInvoice) => inv.id === id);
        if (invoice) {
          const result = await syncApi.dismissInvoice(
            invoice.id,
            invoice.invoiceNumber,
            invoice.clientName,
            invoice.total,
            reason || undefined
          );
          results.push(result);
        }
      }
      return { dismissed: results.length };
    },
    onSuccess: (data) => {
      setSnackbar({
        open: true,
        message: `${data.dismissed} facturas descartadas correctamente`,
        severity: 'success',
      });
      setBulkDismissOpen(false);
      setBulkDismissReason('');
      setSelectedInvoiceIds([]);
      queryClient.invalidateQueries({ queryKey: ['orphan-invoices'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al descartar facturas',
        severity: 'error',
      });
    },
  });

  const geocodeMutation = useMutation({
    mutationFn: async () => {
      return ordersApi.geocodePending();
    },
    onSuccess: (response) => {
      const data = response.data;
      setSnackbar({
        open: true,
        message: `Geocodificacion completada: ${data.geocoded || 0} pedidos actualizados, ${data.failed || 0} fallidos`,
        severity: data.geocoded > 0 ? 'success' : 'info',
      });
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al geocodificar pedidos',
        severity: 'error',
      });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: async ({ orderId, address }: { orderId: string; address: ClientAddress }) => {
      return ordersApi.updateAddress(orderId, {
        street: address.street || '',
        number: address.number || '',
        neighborhood: address.neighborhood || '',
        postalCode: address.postalCode || '',
        city: address.city || '',
        state: address.state || '',
        reference: address.reference,
      }, true);
    },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Dirección actualizada correctamente',
        severity: 'success',
      });
      setEditingAddress(false);
      setSelectedAddressId('');
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
      // Update local detailOrder
      if (detailOrder && selectedAddressId) {
        const selectedAddr = clientAddresses.find(a => a.id === selectedAddressId);
        if (selectedAddr) {
          setDetailOrder({
            ...detailOrder,
            addressRaw: {
              street: selectedAddr.street,
              number: selectedAddr.number,
              neighborhood: selectedAddr.neighborhood,
              postalCode: selectedAddr.postalCode,
              city: selectedAddr.city,
              state: selectedAddr.state,
              reference: selectedAddr.reference,
            },
          });
        }
      }
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al actualizar dirección',
        severity: 'error',
      });
    },
  });

  const createAddressMutation = useMutation({
    mutationFn: async (data: { clientNumber: string; address: typeof newAddressForm; applyToOrder?: boolean; orderId?: string }) => {
      // Create the address
      const response = await clientAddressesApi.create({
        clientNumber: data.clientNumber,
        ...data.address,
      });
      // If applyToOrder is true, also update the order with the new address
      if (data.applyToOrder && data.orderId) {
        await ordersApi.updateAddress(data.orderId, {
          street: data.address.street,
          number: data.address.number,
          neighborhood: data.address.neighborhood,
          postalCode: data.address.postalCode,
          city: data.address.city,
          state: data.address.state,
          reference: data.address.reference,
        }, true);
      }
      return response;
    },
    onSuccess: (_, variables) => {
      setSnackbar({
        open: true,
        message: variables.applyToOrder ? 'Dirección creada y aplicada al pedido' : 'Dirección creada correctamente',
        severity: 'success',
      });
      setNewAddressDialogOpen(false);
      setNewAddressForm({ label: '', street: '', number: '', neighborhood: '', postalCode: '', city: '', state: '', reference: '' });
      // Refresh addresses
      if (detailOrder?.clientNumber) {
        clientAddressesApi.getByClient(detailOrder.clientNumber).then(res => {
          setClientAddresses(res.data || []);
        });
      }
      if (variables.applyToOrder) {
        queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
        // Update local detailOrder
        if (detailOrder) {
          setDetailOrder({
            ...detailOrder,
            addressRaw: {
              street: variables.address.street,
              number: variables.address.number,
              neighborhood: variables.address.neighborhood,
              postalCode: variables.address.postalCode,
              city: variables.address.city,
              state: variables.address.state,
              reference: variables.address.reference,
            },
          });
        }
      }
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al crear dirección',
        severity: 'error',
      });
    },
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const deleteDraftMutation = useMutation({
    mutationFn: async () => {
      return ordersApi.deleteDraft(selectedDraftIds);
    },
    onSuccess: (response) => {
      const data = response.data;
      setSnackbar({
        open: true,
        message: `${data.deleted || 0} pedidos eliminados`,
        severity: 'success',
      });
      setDeleteConfirmOpen(false);
      setSelectedDraftIds([]);
      queryClient.invalidateQueries({ queryKey: ['compras-orders'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al eliminar pedidos',
        severity: 'error',
      });
    },
  });

  const handleSelectAllDrafts = () => {
    if (selectedDraftIds.length === draftOrders.length) {
      setSelectedDraftIds([]);
    } else {
      setSelectedDraftIds(draftOrders.map((o: Order) => o.id));
    }
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllInvoices = () => {
    if (!orphanInvoices) return;
    if (selectedInvoiceIds.length === orphanInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(orphanInvoices.map((inv: OrphanInvoice) => inv.id));
    }
  };

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

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort orders by search and selected column
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let result = orders;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (o: any) =>
          o.clientName?.toLowerCase().includes(searchLower) ||
          o.bindId?.toLowerCase().includes(searchLower) ||
          o.orderNumber?.toLowerCase().includes(searchLower) ||
          o.clientRfc?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by selected field
    return [...result].sort((a: any, b: any) => {
      let valueA: any;
      let valueB: any;

      switch (sortField) {
        case 'orderNumber':
          valueA = a.orderNumber || a.bindId || '';
          valueB = b.orderNumber || b.bindId || '';
          break;
        case 'promisedDate':
          valueA = new Date(a.promisedDate || 0).getTime();
          valueB = new Date(b.promisedDate || 0).getTime();
          break;
        case 'createdAt':
          valueA = new Date(a.createdAt || 0).getTime();
          valueB = new Date(b.createdAt || 0).getTime();
          break;
        case 'clientName':
          valueA = (a.clientName || '').toLowerCase();
          valueB = (b.clientName || '').toLowerCase();
          break;
        case 'totalAmount':
          valueA = a.totalAmount || 0;
          valueB = b.totalAmount || 0;
          break;
        default:
          valueA = new Date(a.promisedDate || 0).getTime();
          valueB = new Date(b.promisedDate || 0).getTime();
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, search, sortField, sortDirection]);

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
    setOrphanPage(1);
  }, [search]);

  // Pagination for orphan invoices
  const orphanTotalPages = Math.ceil((orphanInvoices?.length || 0) / ITEMS_PER_PAGE);
  const paginatedOrphanInvoices = (orphanInvoices || []).slice(
    (orphanPage - 1) * ITEMS_PER_PAGE,
    orphanPage * ITEMS_PER_PAGE
  );

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

  const formatDateShort = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
    });
  };

  // Render sortable header
  const SortableHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
    <TableCell
      align={align}
      sx={{
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      onClick={() => handleSort(field)}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} justifyContent={align === 'right' ? 'flex-end' : 'flex-start'}>
        <span>{label}</span>
        {sortField === field && (
          sortDirection === 'asc'
            ? <ArrowUpwardIcon sx={{ fontSize: 16 }} />
            : <ArrowDownwardIcon sx={{ fontSize: 16 }} />
        )}
      </Stack>
    </TableCell>
  );

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
            <SortableHeader field="orderNumber" label="Número" />
            <SortableHeader field="promisedDate" label="F. Pedido" />
            <SortableHeader field="createdAt" label="F. Sync" />
            <SortableHeader field="clientName" label="Cliente" />
            <TableCell sx={{ fontWeight: 600 }}>Destino</TableCell>
            <SortableHeader field="totalAmount" label="Total" align="right" />
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
                  <Tooltip title={order.promisedDate ? `Fecha de entrega prometida: ${formatDate(order.promisedDate)}` : 'Sin fecha prometida'}>
                    <Typography variant="caption" color={order.promisedDate ? 'primary.main' : 'text.disabled'} fontWeight={500}>
                      {formatDateShort(order.promisedDate || '')}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Tooltip title={`Sincronizado: ${formatDate(order.createdAt)}`}>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateShort(order.createdAt)}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell onClick={() => onToggle(order.id)}>
                  <Tooltip title={order.clientRfc || ''}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
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
            <Tooltip title="Geocodificar direcciones para mostrar en mapa">
              <Button
                variant="outlined"
                color="primary"
                startIcon={geocodeMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <MyLocationIcon />}
                onClick={() => geocodeMutation.mutate()}
                disabled={geocodeMutation.isPending}
              >
                Geocodificar
              </Button>
            </Tooltip>
            <Tooltip title={selectedDraftIds.length === draftOrders.length ? "Deseleccionar todos" : "Seleccionar todos los borradores"}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSelectAllDrafts}
                disabled={draftOrders.length === 0}
              >
                {selectedDraftIds.length === draftOrders.length && draftOrders.length > 0
                  ? `Deseleccionar (${selectedDraftIds.length})`
                  : `Seleccionar Todos (${draftOrders.length})`}
              </Button>
            </Tooltip>
            <Tooltip title="Eliminar los pedidos seleccionados">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={deleteDraftMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <DeleteOutlineIcon />}
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleteDraftMutation.isPending || selectedDraftIds.length === 0}
                >
                  Eliminar ({selectedDraftIds.length})
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              color={syncStatus === 'completed' ? 'success' : syncStatus === 'failed' ? 'error' : 'secondary'}
              startIcon={syncStatus === 'syncing' ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
              onClick={() => syncBindMutation.mutate()}
              disabled={syncStatus === 'syncing'}
              sx={{ minWidth: 180 }}
            >
              {syncStatus === 'syncing'
                ? `Sincronizando... ${syncProgress}%`
                : syncStatus === 'completed'
                ? 'Completado!'
                : 'Sincronizar Bind'}
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
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              border: activeTab === 2 ? 2 : 0,
              borderColor: 'error.main',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveTab(2)}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'error.light', width: 40, height: 40 }}>
                  <ReceiptIcon color="error" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {orphanInvoices?.length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Facturas sin Pedido
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card
            sx={{
              flex: 1,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'secondary.50' }
            }}
            onClick={() => router.push('/clientes')}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'secondary.light', width: 40, height: 40 }}>
                  <PeopleIcon color="secondary" fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="body1" fontWeight={600} color="secondary.main">
                    Ver Clientes
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ir al catalogo
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
            <Tab label={`Facturas sin Pedido (${orphanInvoices?.length || 0})`} />
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

        {activeTab === 2 && (
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  Facturas sin Pedido Asociado
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Reportar con asesores para que creen el pedido, o descartar si no requiere envio
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SelectAllIcon />}
                  onClick={handleSelectAllInvoices}
                  disabled={!orphanInvoices?.length}
                >
                  {selectedInvoiceIds.length === (orphanInvoices?.length || 0) && orphanInvoices?.length
                    ? `Deseleccionar (${selectedInvoiceIds.length})`
                    : `Seleccionar Todas (${orphanInvoices?.length || 0})`}
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={bulkDismissMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
                  onClick={() => setBulkDismissOpen(true)}
                  disabled={selectedInvoiceIds.length === 0 || bulkDismissMutation.isPending}
                >
                  Descartar ({selectedInvoiceIds.length})
                </Button>
              </Stack>
            </Stack>

            {isLoadingOrphans ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : paginatedOrphanInvoices.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography color="text.secondary">
                  No hay facturas sin pedido asociado
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell padding="checkbox" sx={{ width: 40 }}></TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Factura</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Asesor/Vendedor</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedOrphanInvoices.map((invoice: OrphanInvoice) => (
                        <TableRow
                          key={invoice.id}
                          hover
                          selected={selectedInvoiceIds.includes(invoice.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox" onClick={() => toggleInvoiceSelection(invoice.id)}>
                            <Checkbox checked={selectedInvoiceIds.includes(invoice.id)} size="small" />
                          </TableCell>
                          <TableCell onClick={() => toggleInvoiceSelection(invoice.id)}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <ErrorOutlineIcon color="error" fontSize="small" />
                              <Typography variant="body2" fontWeight={600} color="error.main">
                                {invoice.invoiceNumber}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell onClick={() => toggleInvoiceSelection(invoice.id)}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDateShort(invoice.invoiceDate)}
                            </Typography>
                          </TableCell>
                          <TableCell onClick={() => toggleInvoiceSelection(invoice.id)}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                              {invoice.clientName}
                            </Typography>
                          </TableCell>
                          <TableCell onClick={() => toggleInvoiceSelection(invoice.id)}>
                            <Chip
                              size="small"
                              icon={<PersonIcon />}
                              label={invoice.employeeName}
                              variant="outlined"
                              color="primary"
                              sx={{ height: 24 }}
                            />
                          </TableCell>
                          <TableCell align="right" onClick={() => toggleInvoiceSelection(invoice.id)}>
                            <Typography variant="body2" fontWeight={500}>
                              ${invoice.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Descartar (No requiere pedido)">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDismissDialog({ open: true, invoice, reason: '' })}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {orphanTotalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={orphanTotalPages}
                      page={orphanPage}
                      onChange={(_, p) => setOrphanPage(p)}
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
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LocationOnIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle2" fontWeight={600}>
                          Dirección de Entrega
                        </Typography>
                      </Stack>
                      {(detailOrder.status === 'READY' || detailOrder.status === 'DRAFT') && clientAddresses.length > 0 && !editingAddress && (
                        <Tooltip title="Cambiar dirección">
                          <IconButton size="small" color="primary" onClick={() => setEditingAddress(true)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>

                    {/* Address selector for DRAFT and READY orders */}
                    {editingAddress && (detailOrder.status === 'READY' || detailOrder.status === 'DRAFT') ? (
                      <Box>
                        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                          <InputLabel>Seleccionar dirección guardada</InputLabel>
                          <Select
                            value={selectedAddressId}
                            label="Seleccionar dirección guardada"
                            onChange={(e) => setSelectedAddressId(e.target.value)}
                          >
                            {clientAddresses.map((addr) => (
                              <MenuItem key={addr.id} value={addr.id}>
                                <Stack>
                                  <Typography variant="body2" fontWeight={500}>
                                    {addr.label || `${addr.street} ${addr.number}`}
                                    {addr.isDefault && ' (Principal)'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {addr.street} {addr.number}, {addr.neighborhood}, {addr.city}
                                  </Typography>
                                </Stack>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={!selectedAddressId || updateAddressMutation.isPending}
                            onClick={() => {
                              const selectedAddr = clientAddresses.find(a => a.id === selectedAddressId);
                              if (selectedAddr && detailOrder) {
                                updateAddressMutation.mutate({ orderId: detailOrder.id, address: selectedAddr });
                              }
                            }}
                            startIcon={updateAddressMutation.isPending ? <CircularProgress size={14} /> : null}
                          >
                            Aplicar
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => { setEditingAddress(false); setSelectedAddressId(''); }}>
                            Cancelar
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            color="primary"
                            onClick={() => setNewAddressDialogOpen(true)}
                          >
                            + Nueva Dirección
                          </Button>
                        </Stack>
                      </Box>
                    ) : (
                      <>
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

                        {/* Show available addresses count */}
                        {(detailOrder.status === 'READY' || detailOrder.status === 'DRAFT') && (
                          <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                            {loadingAddresses ? (
                              <Typography variant="caption" color="text.secondary">
                                Cargando direcciones...
                              </Typography>
                            ) : clientAddresses.length > 0 ? (
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <HomeIcon fontSize="small" color="action" />
                                <Typography variant="caption" color="text.secondary">
                                  {clientAddresses.length} dirección(es) guardada(s) del cliente
                                </Typography>
                              </Stack>
                            ) : (
                              <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="caption" color="text.disabled">
                                  No hay direcciones guardadas
                                </Typography>
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => setNewAddressDialogOpen(true)}
                                  sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
                                >
                                  + Agregar
                                </Button>
                              </Stack>
                            )}
                          </Box>
                        )}
                      </>
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

      {/* Dismiss Invoice Dialog */}
      <Dialog
        open={dismissDialog.open}
        onClose={() => setDismissDialog({ open: false, invoice: null, reason: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DeleteOutlineIcon color="error" />
            <Typography variant="h6">Descartar Factura</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {dismissDialog.invoice && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Esta factura se marcara como descartada y no aparecera en la lista de facturas sin pedido.
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {dismissDialog.invoice.invoiceNumber}
                </Typography>
                <Typography variant="body2">
                  {dismissDialog.invoice.clientName}
                </Typography>
                <Typography variant="body2" color="primary.main" fontWeight={500}>
                  ${dismissDialog.invoice.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </Typography>
              </Paper>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Motivo del descarte (opcional)"
                placeholder="Ej: Servicio sin materiales, ya se creo el pedido, etc."
                value={dismissDialog.reason}
                onChange={(e) => setDismissDialog({ ...dismissDialog, reason: e.target.value })}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDismissDialog({ open: false, invoice: null, reason: '' })}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (dismissDialog.invoice) {
                dismissInvoiceMutation.mutate({
                  invoice: dismissDialog.invoice,
                  reason: dismissDialog.reason,
                });
              }
            }}
            disabled={dismissInvoiceMutation.isPending}
            startIcon={dismissInvoiceMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          >
            Descartar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <ErrorOutlineIcon />
          Confirmar Eliminacion
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Esta accion eliminara <strong>{selectedDraftIds.length}</strong> pedido{selectedDraftIds.length !== 1 ? 's' : ''} seleccionado{selectedDraftIds.length !== 1 ? 's' : ''}.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Solo se eliminaran pedidos en estado Borrador. Los pedidos ya liberados a Trafico no pueden eliminarse.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Despues de eliminar, puede volver a sincronizar con Bind para obtener los pedidos actualizados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteDraftMutation.mutate()}
            disabled={deleteDraftMutation.isPending}
            startIcon={deleteDraftMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          >
            Eliminar {selectedDraftIds.length} Pedido{selectedDraftIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Dismiss Invoices Dialog */}
      <Dialog
        open={bulkDismissOpen}
        onClose={() => setBulkDismissOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <DeleteOutlineIcon />
          Descartar Facturas en Bloque
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Esta accion descartara <strong>{selectedInvoiceIds.length}</strong> factura{selectedInvoiceIds.length !== 1 ? 's' : ''} seleccionada{selectedInvoiceIds.length !== 1 ? 's' : ''}.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Las facturas descartadas no apareceran en la lista de facturas sin pedido.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Motivo del descarte (opcional)"
            placeholder="Ej: Servicios sin materiales, pedidos ya creados, etc."
            value={bulkDismissReason}
            onChange={(e) => setBulkDismissReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDismissOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => bulkDismissMutation.mutate({ invoiceIds: selectedInvoiceIds, reason: bulkDismissReason })}
            disabled={bulkDismissMutation.isPending}
            startIcon={bulkDismissMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          >
            Descartar {selectedInvoiceIds.length} Factura{selectedInvoiceIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Address Dialog */}
      <Dialog
        open={newAddressDialogOpen}
        onClose={() => setNewAddressDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocationOnIcon color="primary" />
            <Typography variant="h6">Nueva Dirección</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Cliente: {detailOrder?.clientName}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Etiqueta (opcional)"
                placeholder="Ej: Sucursal Norte, Bodega Principal"
                value={newAddressForm.label}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, label: e.target.value })}
              />
            </Grid>
            <Grid item xs={8}>
              <TextField
                fullWidth
                size="small"
                label="Calle"
                required
                value={newAddressForm.street}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, street: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="Número"
                value={newAddressForm.number}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, number: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Colonia"
                value={newAddressForm.neighborhood}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, neighborhood: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Código Postal"
                value={newAddressForm.postalCode}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, postalCode: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Ciudad"
                value={newAddressForm.city}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Estado"
                value={newAddressForm.state}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, state: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Referencia / Instrucciones"
                multiline
                rows={2}
                value={newAddressForm.reference}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, reference: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setNewAddressDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="outlined"
            disabled={!newAddressForm.street || createAddressMutation.isPending}
            onClick={() => {
              if (detailOrder?.clientNumber) {
                createAddressMutation.mutate({
                  clientNumber: detailOrder.clientNumber,
                  address: newAddressForm,
                  applyToOrder: false,
                });
              }
            }}
          >
            Solo Guardar
          </Button>
          <Button
            variant="contained"
            disabled={!newAddressForm.street || createAddressMutation.isPending}
            onClick={() => {
              if (detailOrder?.clientNumber) {
                createAddressMutation.mutate({
                  clientNumber: detailOrder.clientNumber,
                  address: newAddressForm,
                  applyToOrder: true,
                  orderId: detailOrder.id,
                });
              }
            }}
            startIcon={createAddressMutation.isPending ? <CircularProgress size={16} /> : null}
          >
            Guardar y Aplicar
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
