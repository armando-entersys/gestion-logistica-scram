import Dexie, { Table } from 'dexie';

/**
 * MD070 - 3.2: Almacenamiento Local con Dexie.js (IndexedDB Wrapper)
 * Arquitectura Offline-First para la PWA de choferes
 */

// Types for local storage
export interface LocalOrder {
  id: string;
  bindId: string;
  clientName: string;
  clientEmail: string;
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
  // Local tracking
  lastSyncedAt?: string;
  isLocalOnly?: boolean;
}

export interface PendingSync {
  id?: number;
  type: 'delivery' | 'evidence' | 'location';
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
 */
export async function saveOrdersLocally(orders: LocalOrder[]): Promise<void> {
  const now = new Date().toISOString();
  const ordersWithSync = orders.map((order) => ({
    ...order,
    lastSyncedAt: now,
    isLocalOnly: false,
  }));

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
 */
export async function markOrderDeliveredLocally(orderId: string): Promise<void> {
  await db.orders.update(orderId, {
    status: 'DELIVERED',
    isLocalOnly: true,
  });

  // Queue for sync
  await db.pendingSync.add({
    type: 'delivery',
    payload: { orderId },
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  });
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
