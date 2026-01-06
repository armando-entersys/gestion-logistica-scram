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

// Custom marker icons
const createIcon = (color: string, isSelected: boolean) => {
  const size = isSelected ? 40 : 30;
  const html = `
    <div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid ${isSelected ? '#1976d2' : 'white'};
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        transform: rotate(45deg);
        color: white;
        font-weight: bold;
        font-size: ${isSelected ? '14px' : '12px'};
      "></span>
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

const getMarkerColor = (status: string, priorityLevel: number) => {
  if (priorityLevel === 3) return '#d32f2f'; // Urgente - Red
  if (status === 'IN_TRANSIT') return '#1976d2'; // En Ruta - Blue
  if (status === 'DELIVERED') return '#2e7d32'; // Entregado - Green
  if (priorityLevel === 2) return '#ed6c02'; // Alta - Orange
  return '#0288d1'; // Normal/Ready - Light Blue
};

export default function OrdersMap({ orders, selectedIds, onOrderClick }: OrdersMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

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

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Filter orders with coordinates
    const ordersWithCoords = orders.filter(
      (order) => order.latitude && order.longitude
    );

    if (ordersWithCoords.length === 0) return;

    // Add markers
    const bounds: [number, number][] = [];

    ordersWithCoords.forEach((order) => {
      const lat = order.latitude!;
      const lng = order.longitude!;
      const isSelected = selectedIds.includes(order.id);
      const color = getMarkerColor(order.status, order.priorityLevel);

      const marker = L.marker([lat, lng], {
        icon: createIcon(color, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      const popupContent = `
        <div style="min-width: 200px;">
          <strong>${order.clientName}</strong><br/>
          <small style="color: #666;">${order.bindId}</small><br/>
          <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;"/>
          <small>
            ${order.addressRaw?.street || ''} ${order.addressRaw?.number || ''}<br/>
            ${order.addressRaw?.neighborhood || ''}, ${order.addressRaw?.city || ''}
          </small>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (order.status !== 'IN_TRANSIT') {
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
