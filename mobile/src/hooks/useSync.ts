import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  db,
  getPendingItems,
  markAsSyncing,
  markAsFailed,
  clearSyncedItems,
  getSession,
  PendingSync,
} from '@/lib/db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  error: string | null;
}

/**
 * MD070 - 3.2: React Hook for Background Synchronization
 * Implements Offline-First sync strategy
 */
export function useSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  });

  const syncInProgressRef = useRef(false);

  /**
   * Update pending count
   */
  const updatePendingCount = useCallback(async () => {
    const items = await getPendingItems();
    setState((prev) => ({ ...prev, pendingCount: items.length }));
  }, []);

  /**
   * Sync a single pending item to the server
   */
  const syncItem = async (item: PendingSync): Promise<boolean> => {
    const session = await getSession();
    if (!session?.token) {
      console.warn('No session token, skipping sync');
      return false;
    }

    const headers = {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    };

    try {
      await markAsSyncing(item.id!);

      switch (item.type) {
        case 'delivery': {
          // Get local evidence for this order
          const evidence = await db.evidence
            .where('orderId')
            .equals(item.payload.orderId)
            .and((e) => !e.uploaded)
            .first();

          const payload: any = {};

          if (evidence && evidence.dataUrl) {
            // Send base64 data directly to server
            payload.type = evidence.type;
            payload.base64Data = evidence.dataUrl;
            payload.isOffline = true;
            payload.capturedLatitude = evidence.latitude;
            payload.capturedLongitude = evidence.longitude;
          }

          await axios.patch(
            `${API_URL}/orders/${item.payload.orderId}/deliver`,
            payload,
            { headers }
          );

          // Mark evidence as uploaded
          if (evidence) {
            await db.evidence.update(evidence.id!, {
              uploaded: true,
            });
          }
          break;
        }

        case 'evidence': {
          const evidence = await db.evidence.get(item.payload.evidenceId);
          if (!evidence) {
            console.warn(`Evidence ${item.payload.evidenceId} not found`);
            return true; // Remove from queue
          }

          // Upload evidence separately if not already uploaded as part of delivery
          if (!evidence.uploaded && evidence.dataUrl) {
            // For standalone evidence upload, we could create a dedicated endpoint
            // For now, just mark as uploaded since delivery will handle it
            await db.evidence.update(evidence.id!, {
              uploaded: true,
            });
          }
          break;
        }

        case 'location': {
          await axios.patch(
            `${API_URL}/orders/location`,
            {
              orderId: item.payload.orderId,
              latitude: item.payload.latitude,
              longitude: item.payload.longitude,
            },
            { headers }
          );
          break;
        }

        case 'pickup-confirmation': {
          await axios.post(
            `${API_URL}/orders/${item.payload.orderId}/confirm-pickup`,
            {
              hasIssue: item.payload.hasIssue,
              issueNotes: item.payload.issueNotes,
            },
            { headers }
          );
          break;
        }

        case 'en-route': {
          await axios.post(
            `${API_URL}/orders/${item.payload.orderId}/en-route`,
            {},
            { headers }
          );
          break;
        }
      }

      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';

      // Handle 4xx errors as conflicts
      if (error.response?.status >= 400 && error.response?.status < 500) {
        await markAsFailed(item.id!, `Conflict: ${errorMessage}`);
      } else {
        await markAsFailed(item.id!, errorMessage);
      }

      return false;
    }
  };

  /**
   * Main sync function - iterate over pending_sync table
   */
  const sync = useCallback(async () => {
    if (syncInProgressRef.current || !navigator.onLine) {
      return;
    }

    syncInProgressRef.current = true;
    setState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      const pendingItems = await getPendingItems();

      if (pendingItems.length === 0) {
        setState((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncAt: new Date().toISOString(),
        }));
        syncInProgressRef.current = false;
        return;
      }

      const syncedIds: number[] = [];

      for (const item of pendingItems) {
        const success = await syncItem(item);
        if (success) {
          syncedIds.push(item.id!);
        }
      }

      // Clear successfully synced items
      if (syncedIds.length > 0) {
        await clearSyncedItems(syncedIds);
      }

      await updatePendingCount();

      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        error: error.message || 'Sync failed',
      }));
    } finally {
      syncInProgressRef.current = false;
    }
  }, [updatePendingCount]);

  /**
   * Listen to online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('Device is online, triggering sync...');
      setState((prev) => ({ ...prev, isOnline: true }));
      sync();
    };

    const handleOffline = () => {
      console.log('Device is offline');
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync on mount
    updatePendingCount();
    if (navigator.onLine) {
      sync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sync, updatePendingCount]);

  /**
   * Listen to IndexedDB changes
   */
  useEffect(() => {
    db.pendingSync.hook('creating', () => {
      updatePendingCount();
    });

    return () => {
      // Dexie hooks don't have unsubscribe, but the component unmount handles cleanup
    };
  }, [updatePendingCount]);

  /**
   * Manual sync trigger
   */
  const triggerSync = useCallback(() => {
    if (navigator.onLine) {
      sync();
    }
  }, [sync]);

  return {
    ...state,
    triggerSync,
    updatePendingCount,
  };
}

export default useSync;
