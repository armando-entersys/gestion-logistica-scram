'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Truck,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Send,
  User,
  Package,
} from 'lucide-react';

import { useOrdersStore, Order, Driver } from '@/store/orders.store';
import { ordersApi, usersApi, routesApi } from '@/lib/api';

const priorityConfig = {
  1: { label: 'Normal', color: 'badge-normal', icon: null },
  2: { label: 'Alta', color: 'badge-high', icon: DollarSign },
  3: { label: 'Critica', color: 'badge-critical', icon: AlertTriangle },
};

const statusConfig = {
  DRAFT: { label: 'Borrador', color: 'badge-draft' },
  READY: { label: 'Listo', color: 'badge-ready' },
  IN_TRANSIT: { label: 'En Ruta', color: 'badge-transit' },
  DELIVERED: { label: 'Entregado', color: 'badge-delivered' },
};

export default function PlanningPage() {
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState('09:00');

  const {
    orders,
    selectedOrderIds,
    selectedDriverId,
    setOrders,
    toggleOrderSelection,
    selectAllOrders,
    clearSelection,
    setSelectedDriver,
  } = useOrdersStore();

  // Fetch orders for planning
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['planning-orders'],
    queryFn: async () => {
      const response = await routesApi.getPlanning();
      return response.data;
    },
  });

  // Fetch drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const response = await usersApi.getDrivers();
      return response.data as Driver[];
    },
  });

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriverId || selectedOrderIds.length === 0) {
        throw new Error('Selecciona chofer y pedidos');
      }
      return ordersApi.dispatch(selectedDriverId, selectedOrderIds, startTime);
    },
    onSuccess: (response) => {
      toast.success(
        `Ruta despachada: ${response.data.dispatched} pedidos, ${response.data.emailsQueued} emails enviados`
      );
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['planning-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al despachar ruta');
    },
  });

  // Update store when data changes
  useEffect(() => {
    if (ordersData) {
      setOrders(ordersData);
    }
  }, [ordersData, setOrders]);

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const canDispatch = selectedDriverId && selectedOrderIds.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Panel de Trafico
            </h1>
            <p className="text-sm text-gray-500">
              Planificacion y despacho de rutas
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </header>

      {/* Main Content - 2 Column Layout */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Column - Order List */}
        <div className="w-1/2 border-r border-gray-200 overflow-hidden flex flex-col">
          {/* Filters & Actions */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {selectedOrderIds.length} de {orders.length} seleccionados
                </span>
                {selectedOrderIds.length > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <button
                onClick={() => selectAllOrders(orders.map((o) => o.id))}
                className="text-sm text-primary-600 hover:underline"
              >
                Seleccionar todos
              </button>
            </div>

            {/* Driver Selection */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                Chofer:
              </label>
              <select
                value={selectedDriverId || ''}
                onChange={(e) => setSelectedDriver(e.target.value || null)}
                className="input flex-1"
              >
                <option value="">Seleccionar chofer...</option>
                {drivers?.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.firstName} {driver.lastName}
                  </option>
                ))}
              </select>

              <label className="text-sm font-medium text-gray-700">
                Hora inicio:
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input w-32"
              />
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                Cargando pedidos...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay pedidos pendientes de planificacion
              </div>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrderIds.includes(order.id)}
                  onToggle={() => toggleOrderSelection(order.id)}
                />
              ))
            )}
          </div>

          {/* Dispatch Button */}
          <div className="p-4 bg-white border-t border-gray-200">
            <button
              onClick={() => dispatchMutation.mutate()}
              disabled={!canDispatch || dispatchMutation.isPending}
              className="w-full btn btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dispatchMutation.isPending ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Confirmar Despacho ({selectedOrderIds.length} pedidos)
            </button>
          </div>
        </div>

        {/* Right Column - Map */}
        <div className="w-1/2 bg-gray-100 flex flex-col">
          <div className="p-4 bg-white border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Mapa de Rutas</h2>
          </div>

          {/* Map Placeholder */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg font-medium">
                Interactive Map
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Integrar con Google Maps API
              </p>

              {/* Selected Orders Preview */}
              {selectedOrders.length > 0 && (
                <div className="mt-8 max-w-md mx-auto">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Ruta planificada ({selectedOrders.length} paradas):
                  </h3>
                  <div className="space-y-2">
                    {selectedOrders.map((order, index) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm"
                      >
                        <span className="flex items-center justify-center w-6 h-6 bg-primary-500 text-white rounded-full text-xs font-bold">
                          {index + 1}
                        </span>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">
                            {order.clientName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {order.addressRaw.neighborhood},{' '}
                            {order.addressRaw.city}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Order Card Component
function OrderCard({
  order,
  isSelected,
  onToggle,
}: {
  order: Order;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const priority = priorityConfig[order.priorityLevel];
  const status = statusConfig[order.status];
  const PriorityIcon = priority.icon;

  return (
    <div
      onClick={onToggle}
      className={`card p-4 cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-primary-500 bg-primary-50'
          : 'hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <h3 className="font-semibold text-gray-900">{order.clientName}</h3>
            <p className="text-sm text-gray-500">{order.bindId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${priority.color}`}>
            {PriorityIcon && <PriorityIcon className="w-3 h-3 mr-1" />}
            {priority.label}
          </span>
          <span className={`badge ${status.color}`}>{status.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          <span>
            {order.addressRaw.neighborhood}, {order.addressRaw.city}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4" />
          <span>${order.totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {order.assignedDriver && (
        <div className="mt-2 flex items-center gap-1 text-sm text-primary-600">
          <User className="w-4 h-4" />
          <span>
            {order.assignedDriver.firstName} {order.assignedDriver.lastName}
          </span>
        </div>
      )}
    </div>
  );
}
