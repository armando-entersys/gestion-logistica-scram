import Dexie, { Table } from 'dexie';

/**
 * MD070 - 3.2: Almacenamiento Local con Dexie.js (IndexedDB Wrapper)
 * Arquitectura Offline-First para la PWA de choferes
 */

/**
 * APP VERSION CONTROL
 * Incrementar este número fuerza limpieza de IndexedDB en todos los dispositivos
 * Útil cuando hay cambios de esquema o para forzar resincronización
 */
const APP_DATA_VERSION = 3; // Incrementar para forzar limpieza de datos locales
const VERSION_KEY = 'scram_app_data_version';

/**
 * Verifica la versión de datos y limpia si es necesario
 * Llamar al inicio de la app
 */
export async function checkAndClearStaleData(): Promise<boolean> {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  const currentVersion = storedVersion ? parseInt(storedVersion, 10) : 0;

  if (currentVersion < APP_DATA_VERSION) {
    console.log(`[DB] Versión de datos desactualizada (${currentVersion} -> ${APP_DATA_VERSION}). Limpiando datos locales...`);

    try {
      // Limpiar todas las tablas de IndexedDB
      await db.orders.clear();
      await db.pendingSync.clear();
      await db.evidence.clear();
      // NO limpiar session para que el usuario no tenga que re-loguearse

      // Actualizar versión
      localStorage.setItem(VERSION_KEY, APP_DATA_VERSION.toString());

      console.log('[DB] Datos locales limpiados exitosamente');
      return true; // Indica que se limpiaron datos
    } catch (error) {
      console.error('[DB] Error limpiando datos:', error);
      // Aún así actualizar versión para no quedar en loop
      localStorage.setItem(VERSION_KEY, APP_DATA_VERSION.toString());
    }
  }

  return false; // No se limpiaron datos
}

// Types for local storage
export interface LocalOrder {
  id: string;
  bindId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  addressRaw: {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    reference?: string;
  };
  latitude?: number;
  longitude?: number;
  status: 'DRAFT' | 'READY' | 'IN_TRANSIT' | 'DELIVERED';
  priorityLevel: 1 | 2 | 3;
  routePosition?: number;
  estimatedArrivalStart?: string;
  estimatedArrivalEnd?: string;
  // Pickup confirmation fields
  pickupConfirmedAt?: string;
  pickupHasIssue?: boolean;
  // En-route tracking
  enRouteAt?: string;
  // Local tracking
  lastSyncedAt?: string;
  isLocalOnly?: boolean;
}

export interface PendingSync {
  id?: number;
  type: 'delivery' | 'evidence' | 'location' | 'pickup-confirmation' | 'en-route';
  payload: {
    orderId: string;
    [key: string]: any;
  };
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
}

export interface LocalEvidence {
  id?: number;
  orderId: string;
  type: 'PHOTO' | 'SIGNATURE';
  dataUrl: string; // Base64 for offline storage
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  uploaded: boolean;
  storageKey?: string;
}

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  expiresAt: string;
}

/**
 * SCRAM Mobile Database
 * Stores: manifests (routes), pending_sync, evidence, session
 */
class SCRAMDatabase extends Dexie {
  // Tables
  orders!: Table<LocalOrder, string>;
  pendingSync!: Table<PendingSync, number>;
  evidence!: Table<LocalEvidence, number>;
  session!: Table<UserSession, string>;

  constructor() {
    super('scram_mobile_db');

    this.version(1).stores({
      // Primary key: id, indexes on status and routePosition
      orders: 'id, bindId, status, routePosition, lastSyncedAt',
      // Auto-increment id, index on status and type
      pendingSync: '++id, status, type, [orderId+type]',
      // Auto-increment id, index on orderId and uploaded status
      evidence: '++id, orderId, uploaded',
      // Single session record
      session: 'id',
    });
  }
}

// Export singleton instance
export const db = new SCRAMDatabase();

// Helper functions

/**
 * Save orders from server to local database
 * IMPORTANT: Clears existing orders first to prevent mixing data from different drivers
 * when they share a device without proper logout
 */
export async function saveOrdersLocally(orders: LocalOrder[]): Promise<void> {
  const now = new Date().toISOString();
  const ordersWithSync = orders.map((order) => ({
    ...order,
    lastSyncedAt: now,
    isLocalOnly: false,
  }));

  // Clear old orders first to prevent mixing orders from different drivers
  // This is crucial when multiple drivers use the same device
  await db.orders.clear();
  await db.orders.bulkPut(ordersWithSync);
}

/**
 * Get driver's active route orders
 */
export async function getActiveRoute(): Promise<LocalOrder[]> {
  return db.orders
    .where('status')
    .anyOf(['READY', 'IN_TRANSIT'])
    .sortBy('routePosition');
}

/**
 * Mark order as delivered (Optimistic UI)
 * Removes order from local DB since delivered orders don't appear in active route
 */
export async function markOrderDeliveredLocally(orderId: string): Promise<void> {
  // Verify order exists before updating
  const order = await db.orders.get(orderId);
  if (!order) {
    console.error(`[markOrderDeliveredLocally] Order ${orderId} not found in local DB`);
    throw new Error(`Pedido ${orderId} no encontrado`);
  }

  console.log(`[markOrderDeliveredLocally] Marking order ${orderId} as delivered. Current status: ${order.status}`);

  // Queue for sync FIRST (to ensure evidence is synced)
  await db.pendingSync.add({
    type: 'delivery',
    payload: { orderId },
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  });

  // Delete from local DB - delivered orders don't need to be shown
  await db.orders.delete(orderId);
  console.log(`[markOrderDeliveredLocally] Order ${orderId} removed from local DB`);
}

/**
 * Save evidence locally
 */
export async function saveEvidenceLocally(evidence: Omit<LocalEvidence, 'id'>): Promise<number> {
  const id = await db.evidence.add({
    ...evidence,
    uploaded: false,
  });

  // Queue for sync
  await db.pendingSync.add({
    type: 'evidence',
    payload: {
      orderId: evidence.orderId,
      evidenceId: id,
      type: evidence.type,
    },
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  });

  return id;
}

/**
 * Get pending sync items
 */
export async function getPendingItems(): Promise<PendingSync[]> {
  return db.pendingSync.where('status').equals('pending').toArray();
}

/**
 * Get failed sync items (for manual review)
 */
export async function getConflictItems(): Promise<PendingSync[]> {
  return db.pendingSync.where('status').equals('conflict').toArray();
}

/**
 * Clear synced items
 */
export async function clearSyncedItems(ids: number[]): Promise<void> {
  await db.pendingSync.bulkDelete(ids);
}

/**
 * Mark item as syncing
 */
export async function markAsSyncing(id: number): Promise<void> {
  await db.pendingSync.update(id, { status: 'syncing' });
}

/**
 * Mark item as failed
 */
export async function markAsFailed(id: number, error: string): Promise<void> {
  const item = await db.pendingSync.get(id);
  if (item) {
    await db.pendingSync.update(id, {
      status: item.attempts >= 3 ? 'conflict' : 'pending',
      attempts: item.attempts + 1,
      lastError: error,
    });
  }
}

/**
 * Save user session
 */
export async function saveSession(session: UserSession): Promise<void> {
  await db.session.put(session);
}

/**
 * Get current session
 */
export async function getSession(): Promise<UserSession | undefined> {
  return db.session.toCollection().first();
}

/**
 * Clear session (logout)
 */
export async function clearSession(): Promise<void> {
  await db.session.clear();
}

/**
 * Clear all local data (for logout/reset)
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.orders.clear(),
    db.pendingSync.clear(),
    db.evidence.clear(),
    db.session.clear(),
  ]);
}

/**
 * Confirm pickup of an order (Optimistic UI)
 * Driver confirms receipt of order before leaving
 */
export async function confirmPickupLocally(
  orderId: string,
  hasIssue?: boolean,
  issueNotes?: string
): Promise<void> {
  const now = new Date().toISOString();

  await db.orders.update(orderId, {
    pickupConfirmedAt: now,
    pickupHasIssue: hasIssue || false,
    isLocalOnly: true,
  });

  // Queue for sync
  await db.pendingSync.add({
    type: 'pickup-confirmation',
    payload: {
      orderId,
      hasIssue: hasIssue || false,
      issueNotes: issueNotes || null,
    },
    createdAt: now,
    attempts: 0,
    status: 'pending',
  });
}

/**
 * Mark order as en-route (Optimistic UI)
 * Driver is heading to deliver this order
 */
export async function markEnRouteLocally(orderId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.orders.update(orderId, {
    enRouteAt: now,
    isLocalOnly: true,
  });

  // Queue for sync
  await db.pendingSync.add({
    type: 'en-route',
    payload: { orderId },
    createdAt: now,
    attempts: 0,
    status: 'pending',
  });
}

/**
 * Get orders pending pickup confirmation
 */
export async function getPendingPickupOrders(): Promise<LocalOrder[]> {
  return db.orders
    .where('status')
    .equals('IN_TRANSIT')
    .filter((order) => !order.pickupConfirmedAt)
    .sortBy('routePosition');
}

/**
 * Check if all orders have been confirmed for pickup
 */
export async function allOrdersConfirmed(): Promise<boolean> {
  const pendingCount = await db.orders
    .where('status')
    .equals('IN_TRANSIT')
    .filter((order) => !order.pickupConfirmedAt)
    .count();

  return pendingCount === 0;
}
