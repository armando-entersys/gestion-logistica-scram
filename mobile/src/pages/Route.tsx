import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import axios from 'axios';
import {
  MapPin,
  Phone,
  Navigation,
  Clock,
  Package,
  RefreshCw,
  LogOut,
  CheckCircle,
} from 'lucide-react';

import {
  db,
  saveOrdersLocally,
  getActiveRoute,
  clearSession,
  getSession,
  LocalOrder,
} from '@/lib/db';
import useSync from '@/hooks/useSync';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function RoutePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { isOnline, triggerSync } = useSync();

  // Live query for orders
  const orders = useLiveQuery(() => getActiveRoute(), []);
  const session = useLiveQuery(() => db.session.toCollection().first());

  // Fetch route from server
  const fetchRoute = async () => {
    if (!isOnline) return;

    setIsLoading(true);
    try {
      const sessionData = await getSession();
      if (!sessionData?.token) return;

      const response = await axios.get(`${API_URL}/orders/my-route`, {
        headers: { Authorization: `Bearer ${sessionData.token}` },
      });

      await saveOrdersLocally(response.data);
    } catch (error) {
      console.error('Error fetching route:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRoute();
  }, []);

  const handleLogout = async () => {
    await clearSession();
    navigate('/login');
  };

  const handleRefresh = () => {
    fetchRoute();
    triggerSync();
  };

  const openNavigation = (order: LocalOrder) => {
    const address = `${order.addressRaw.street} ${order.addressRaw.number}, ${order.addressRaw.neighborhood}, ${order.addressRaw.city}`;
    const encodedAddress = encodeURIComponent(address);

    // Try Google Maps first, fallback to Apple Maps
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    window.open(googleMapsUrl, '_blank');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-3 shadow-sm safe-area-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mi Ruta</h1>
            <p className="text-sm text-gray-500">
              Hola, {session?.firstName || 'Chofer'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-gray-100 active:bg-gray-200"
            >
              <RefreshCw
                className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-gray-100 active:bg-gray-200"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-primary-500 px-4 py-3 flex items-center justify-around text-white">
        <div className="text-center">
          <p className="text-2xl font-bold">{orders?.length || 0}</p>
          <p className="text-xs opacity-80">Paradas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {orders?.filter((o) => o.status === 'DELIVERED').length || 0}
          </p>
          <p className="text-xs opacity-80">Entregados</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {orders?.filter((o) => o.status !== 'DELIVERED').length || 0}
          </p>
          <p className="text-xs opacity-80">Pendientes</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 safe-area-bottom">
        {!orders || orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No tienes entregas asignadas</p>
            <p className="text-gray-400 text-sm mt-1">
              Espera a que te asignen una ruta
            </p>
          </div>
        ) : (
          orders.map((order, index) => (
            <OrderCard
              key={order.id}
              order={order}
              position={index + 1}
              onNavigate={() => openNavigation(order)}
              onCall={() => order.clientPhone && handleCall(order.clientPhone)}
              onDeliver={() => navigate(`/delivery/${order.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: LocalOrder;
  position: number;
  onNavigate: () => void;
  onCall: () => void;
  onDeliver: () => void;
}

function OrderCard({ order, position, onNavigate, onCall, onDeliver }: OrderCardProps) {
  const isDelivered = order.status === 'DELIVERED';
  const etaStart = order.estimatedArrivalStart
    ? new Date(order.estimatedArrivalStart).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={`card p-4 ${isDelivered ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm ${
              isDelivered ? 'bg-green-500' : 'bg-primary-500'
            }`}
          >
            {isDelivered ? <CheckCircle className="w-5 h-5" /> : position}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">{order.clientName}</h3>
            <p className="text-sm text-gray-500">{order.bindId}</p>
          </div>
        </div>
        {etaStart && !isDelivered && (
          <div className="flex items-center gap-1 text-sm text-primary-600">
            <Clock className="w-4 h-4" />
            <span>{etaStart}</span>
          </div>
        )}
      </div>

      {/* Address */}
      <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p>
            {order.addressRaw.street} {order.addressRaw.number}
          </p>
          <p>
            {order.addressRaw.neighborhood}, {order.addressRaw.city}
          </p>
          {order.addressRaw.reference && (
            <p className="text-gray-400 italic">{order.addressRaw.reference}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isDelivered && (
        <div className="flex gap-2">
          <button
            onClick={onNavigate}
            className="flex-1 btn bg-gray-100 text-gray-700 flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Navegar
          </button>
          {order.clientPhone && (
            <button
              onClick={onCall}
              className="btn bg-gray-100 text-gray-700 px-4"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDeliver}
            className="flex-1 btn btn-success flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Entregar
          </button>
        </div>
      )}
    </div>
  );
}
