import { Routes, Route, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import useSync from '@/hooks/useSync';

import LoginPage from '@/pages/Login';
import RoutePage from '@/pages/Route';
import DeliveryPage from '@/pages/Delivery';

function App() {
  const session = useLiveQuery(() => db.session.toCollection().first());
  const { isOnline, isSyncing, pendingCount } = useSync();

  const isAuthenticated = !!session?.token;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Offline/Sync Banner */}
      {(!isOnline || pendingCount > 0) && (
        <div
          className={`px-4 py-2 text-center text-sm font-medium ${
            !isOnline
              ? 'bg-orange-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          {!isOnline ? (
            'Sin conexion - Trabajando offline'
          ) : isSyncing ? (
            'Sincronizando...'
          ) : (
            `${pendingCount} cambios pendientes de sincronizar`
          )}
        </div>
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
        <Route path="*" element={<Navigate to={isAuthenticated ? '/route' : '/login'} />} />
      </Routes>
    </div>
  );
}

export default App;
