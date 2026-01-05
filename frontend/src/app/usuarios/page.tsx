'use client';

import { useState, useEffect } from 'react';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';

import { usersApi, api } from '@/lib/api';

const roleConfig: Record<string, { label: string; color: 'primary' | 'secondary' | 'success' | 'warning' | 'info' }> = {
  ADMIN: { label: 'Administrador', color: 'primary' },
  PURCHASING: { label: 'Compras', color: 'info' },
  DRIVER: { label: 'Chofer', color: 'success' },
  SALES: { label: 'Ventas', color: 'warning' },
};

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCode: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsuariosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleCode: 'DRIVER',
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
    // Check if user is admin
    try {
      const userData = JSON.parse(user || '{}');
      if (userData.roleCode !== 'ADMIN') {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }, [router]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersApi.getAll();
      return response.data as User[];
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return api.post('/auth/register', data);
    },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Usuario creado exitosamente',
        severity: 'success',
      });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al crear usuario',
        severity: 'error',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return api.patch(`/users/${id}`, data);
    },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Usuario actualizado exitosamente',
        severity: 'success',
      });
      setDialogOpen(false);
      setEditingUser(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al actualizar usuario',
        severity: 'error',
      });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.patch(`/users/${id}`, { isActive });
    },
    onSuccess: (_, variables) => {
      setSnackbar({
        open: true,
        message: variables.isActive ? 'Usuario activado' : 'Usuario desactivado',
        severity: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error al cambiar estado',
        severity: 'error',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      roleCode: 'DRIVER',
    });
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.roleCode,
      });
    } else {
      setEditingUser(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingUser) {
      const updateData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        roleCode: formData.roleCode,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => router.push('/planning')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <PeopleIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={600}>
              Gestion de Usuarios
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Administrar usuarios del sistema
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Nuevo Usuario
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

      {/* Main Content */}
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 2 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Rol</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Fecha Registro</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users?.map((user) => {
                    const role = roleConfig[user.roleCode] || { label: user.roleCode, color: 'primary' as const };
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{ bgcolor: role.color + '.main' }}>
                              {user.firstName?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {user.firstName} {user.lastName}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Chip size="small" label={role.label} color={role.color} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={user.isActive ? 'Activo' : 'Inactivo'}
                            color={user.isActive ? 'success' : 'default'}
                            variant="outlined"
                            icon={user.isActive ? <CheckCircleIcon /> : <BlockIcon />}
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('es-MX')}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => handleOpenDialog(user)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={user.isActive ? 'Desactivar' : 'Activar'}>
                              <IconButton
                                size="small"
                                color={user.isActive ? 'error' : 'success'}
                                onClick={() => toggleUserMutation.mutate({ id: user.id, isActive: !user.isActive })}
                              >
                                {user.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Nombre"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label="Apellido"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </Stack>
            <TextField
              fullWidth
              label="Correo electronico"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={!!editingUser}
            />
            <TextField
              fullWidth
              label={editingUser ? 'Nueva contrasena (dejar vacio para mantener)' : 'Contrasena'}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
            />
            <FormControl fullWidth>
              <InputLabel>Rol</InputLabel>
              <Select
                value={formData.roleCode}
                label="Rol"
                onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
              >
                <MenuItem value="ADMIN">Administrador</MenuItem>
                <MenuItem value="PURCHASING">Compras</MenuItem>
                <MenuItem value="DRIVER">Chofer</MenuItem>
                <MenuItem value="SALES">Ventas</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createUserMutation.isPending || updateUserMutation.isPending}
          >
            {createUserMutation.isPending || updateUserMutation.isPending ? (
              <CircularProgress size={24} />
            ) : editingUser ? (
              'Actualizar'
            ) : (
              'Crear'
            )}
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
