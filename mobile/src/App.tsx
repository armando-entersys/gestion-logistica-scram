import { Routes, Route, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Box, Alert, LinearProgress, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';

import { db } from '@/lib/db';
import useSync from '@/hooks/useSync';

import LoginPage from '@/pages/Login';
import RoutePage from '@/pages/Route';
import DeliveryPage from '@/pages/Delivery';
import CompleteStopPage from '@/pages/CompleteStop';

function App() {
  const session = useLiveQuery(() => db.session.toCollection().first());
  const { isOnline, isSyncing, pendingCount } = useSync();

  const isAuthenticated = !!session?.token;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Offline/Sync Banner */}
      {(!isOnline || pendingCount > 0) && (
        <Alert
          severity={!isOnline ? 'warning' : 'info'}
          icon={!isOnline ? <WifiOffIcon fontSize="small" /> : <SyncIcon fontSize="small" />}
          sx={{
            borderRadius: 0,
            py: 0.5,
            '& .MuiAlert-message': {
              width: '100%',
              textAlign: 'center',
            },
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            {!isOnline
              ? 'Sin conexion - Trabajando offline'
              : isSyncing
                ? 'Sincronizando...'
                : `${pendingCount} cambios pendientes de sincronizar`}
          </Typography>
          {isSyncing && <LinearProgress sx={{ mt: 0.5, mx: -2 }} />}
        </Alert>
      )}

      {/* Routes */}
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/route" /> : <LoginPage />}
        />
        <Route
          path="/route"
          element={isAuthenticated ? <RoutePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/delivery/:orderId"
          element={isAuthenticated ? <DeliveryPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/complete-stop/:stopId"
          element={isAuthenticated ? <CompleteStopPage /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/route' : '/login'} />} />
      </Routes>
    </Box>
  );
}

export default App;
