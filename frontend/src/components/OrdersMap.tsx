'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Order {
  id: string;
  bindId: string;
  clientName: string;
  addressRaw?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
  };
  latitude?: number;
  longitude?: number;
  status: string;
  priorityLevel: number;
}

interface OrdersMapProps {
  orders: Order[];
  selectedIds: string[];
  onOrderClick: (id: string) => void;
}

// Default center (Monterrey, Mexico)
const DEFAULT_CENTER: [number, number] = [25.6866, -100.3161];
const DEFAULT_ZOOM = 12;

// Custom marker icons with optional number
const createIcon = (color: string, isSelected: boolean, number?: number) => {
  const size = isSelected ? 38 : 28;
  const html = `
    <div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid ${isSelected ? '#1e40af' : 'white'};
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        transform: rotate(45deg);
        color: white;
        font-weight: 600;
        font-size: ${isSelected ? '13px' : '11px'};
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
      ">${number !== undefined ? number : ''}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const getMarkerColor = (status: string, priorityLevel: number, isSelected: boolean) => {
  if (isSelected) return '#1e40af'; // Seleccionado - Dark Blue
  if (priorityLevel === 3) return '#dc2626'; // Urgente - Red
  if (status === 'IN_TRANSIT') return '#0d9488'; // En Ruta - Teal
  if (status === 'DELIVERED') return '#16a34a'; // Entregado - Green
  if (priorityLevel === 2) return '#ea580c'; // Alta - Orange
  return '#0284c7'; // Listo/Ready - Info Blue
};

export default function OrdersMap({ orders, selectedIds, onOrderClick }: OrdersMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers and route line
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Filter orders with coordinates
    const ordersWithCoords = orders.filter(
      (order) => order.latitude && order.longitude
    );

    if (ordersWithCoords.length === 0) return;

    // Create a map for quick lookup of selected order positions
    const selectedOrderPositions: { [id: string]: number } = {};
    selectedIds.forEach((id, index) => {
      selectedOrderPositions[id] = index + 1;
    });

    // Collect route coordinates for polyline (selected orders in order)
    const routeCoords: [number, number][] = [];
    selectedIds.forEach((id) => {
      const order = ordersWithCoords.find((o) => o.id === id);
      if (order && order.latitude && order.longitude) {
        routeCoords.push([order.latitude, order.longitude]);
      }
    });

    // Draw route polyline if there are 2+ selected orders
    if (routeCoords.length >= 2) {
      polylineRef.current = L.polyline(routeCoords, {
        color: '#1e40af',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
      }).addTo(mapRef.current);
    }

    // Add markers
    const bounds: [number, number][] = [];

    ordersWithCoords.forEach((order) => {
      const lat = order.latitude!;
      const lng = order.longitude!;
      const isSelected = selectedIds.includes(order.id);
      const routeNumber = selectedOrderPositions[order.id];
      const color = getMarkerColor(order.status, order.priorityLevel, isSelected);

      const marker = L.marker([lat, lng], {
        icon: createIcon(color, isSelected, routeNumber),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      const statusLabels: Record<string, string> = {
        DRAFT: 'Borrador',
        READY: 'Listo',
        IN_TRANSIT: 'En Ruta',
        DELIVERED: 'Entregado',
      };

      const statusColors: Record<string, string> = {
        DRAFT: '#64748b',
        READY: '#0284c7',
        IN_TRANSIT: '#0d9488',
        DELIVERED: '#16a34a',
      };

      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui, sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #0f172a; font-size: 14px;">${order.clientName}</strong>
            ${isSelected ? `<span style="background: #1e40af; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">#${routeNumber}</span>` : ''}
          </div>
          <div style="color: #64748b; font-size: 12px; font-family: monospace; margin-bottom: 8px;">${order.bindId}</div>
          <span style="
            display: inline-block;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            background: ${statusColors[order.status] || '#64748b'};
            color: white;
          ">${statusLabels[order.status] || order.status}</span>
          <hr style="margin: 10px 0; border: none; border-top: 1px solid #e2e8f0;"/>
          <div style="color: #64748b; font-size: 12px; line-height: 1.4;">
            ${order.addressRaw?.street || ''} ${order.addressRaw?.number || ''}<br/>
            ${order.addressRaw?.neighborhood || ''}, ${order.addressRaw?.city || ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED') {
          onOrderClick(order.id);
        }
      });

      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
      bounds.push([lat, lng]);
    });

    // Fit bounds if there are markers
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [orders, selectedIds, onOrderClick]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 400,
        background: '#e5e3df'
      }}
    />
  );
}
