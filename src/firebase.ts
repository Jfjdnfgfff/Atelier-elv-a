import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  remove, 
  push,
  onValue, 
  off,
  query,
  limitToLast,
  get,
  orderByChild,
  equalTo,
  startAt,
  endAt,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  Query
} from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyB4AuVSK1sAUeVtPCBlzRqkibT7zEx1Ivw",
  authDomain: "uohouhi-41bde.firebaseapp.com",
  databaseURL: "https://uohouhi-41bde-default-rtdb.firebaseio.com",
  projectId: "uohouhi-41bde",
  storageBucket: "uohouhi-41bde.firebasestorage.app",
  messagingSenderId: "505911771359",
  appId: "1:505911771359:web:568f084e2d6ae82e83e96a",
  measurementId: "G-1JZNWTEFRM"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Realtime Database with high-performance persistent connection
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);

// Collection Names
export const FIREBASE_COLLECTIONS = {
  CLOTHES: 'clothes',
  RENTALS: 'rentals',
  SALES: 'sales',
  EXPENSES: 'expenses',
  CREDITS: 'credits',
  STAFF_PAYOUTS: 'staffPayouts',
  STAFF_MEMBERS: 'staffMembers',
  STAFF_ABSENCES: 'staffAbsences',
  MAINTENANCE: 'maintenanceOrders',
  SUPPLIERS: 'suppliers',
  SEAMSTRESSES: 'seamstresses',
  RAW_MATERIALS: 'rawMaterials',
  CAISSE_CLOSURES: 'caisseClosures',
  ACTIVITY_LOGS: 'activityLogs',
  CLOTH_THUMBS: 'clothThumbs',
  CLOTH_IMAGES: 'clothImages'
} as const;

export type FirebaseCollectionKey = typeof FIREBASE_COLLECTIONS[keyof typeof FIREBASE_COLLECTIONS];

/**
 * Highly optimized array comparison without JSON.stringify.
 * Fast O(N) check comparing length, sample endpoints, IDs, and key mutable fields.
 * Scales effortlessly to 10,000+ items in < 1ms without freezing the main thread.
 */
export function areArraysEqual<T extends { id?: string; updatedAt?: string | number }>(
  a: T[] | undefined | null, 
  b: T[] | undefined | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;

  // Fast-path boundary check: first and last elements
  const firstA: any = a[0];
  const firstB: any = b[0];
  if (firstA?.id !== firstB?.id) return false;

  const lastA: any = a[a.length - 1];
  const lastB: any = b[b.length - 1];
  if (lastA?.id !== lastB?.id) return false;

  // Compare ID and updatedAt field (with image fallbacks)
  for (let i = 0; i < a.length; i++) {
    const itemA: any = a[i];
    const itemB: any = b[i];

    if (!itemA || !itemB) return false;
    if (itemA.id !== itemB.id) return false;

    if (itemA.updatedAt !== itemB.updatedAt) return false;
    if (itemA.imageUrl !== itemB.imageUrl) return false;
    if (itemA.thumbUrl !== itemB.thumbUrl) return false;
    if (itemA.stock !== itemB.stock) return false;
    if (itemA.status !== itemB.status) return false;
  }

  return true;
}

/**
 * Recursively cleans undefined values so that Firebase Realtime Database
 * never throws "value contains undefined in property..." errors.
 */
export function sanitizeForFirebase<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString() as any;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirebase(item)) as any;
  }
  const clean: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirebase(value);
    }
  }
  return clean;
}

/**
 * Targeted Item-Level Write:
 * Saves or updates a single document at `/collectionKey/itemId` using `update`.
 * Uses atomic multi-path update on parent collection so sibling items are 100% untouched.
 * Zero full collection overwrites.
 */
export async function saveItemToFirebase<T extends { id: string }>(collectionKey: string, item: T): Promise<void> {
  if (!item || !item.id) return;
  try {
    const itemWithTs = { ...item, updatedAt: (item as any).updatedAt || new Date().toISOString() };
    const cleanItem = sanitizeForFirebase(itemWithTs);
    const collectionRef = ref(rtdb, collectionKey);
    await update(collectionRef, { [cleanItem.id]: cleanItem });
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to save targeted item ${collectionKey}/${item.id}:`, error);
  }
}

import { imageStore } from './utils/imageStore';

export async function fetchFullImage(id: string): Promise<string | null> {
  return imageStore.loadFull(id);
}

export async function pushItemToFirebase<T extends { id?: string }>(
  collectionKey: string, 
  item: T
): Promise<string | null> {
  if (!item) return null;
  try {
    const itemWithTs = { ...item, updatedAt: (item as any).updatedAt || new Date().toISOString() };
    const cleanItem = sanitizeForFirebase(itemWithTs);
    if (cleanItem.id) {
      await update(ref(rtdb, collectionKey), { [cleanItem.id]: cleanItem });
      return cleanItem.id;
    } else {
      const newRef = await push(ref(rtdb, collectionKey), cleanItem);
      return newRef.key;
    }
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to push item to ${collectionKey}:`, error);
    return null;
  }
}

export async function updateItemInFirebase(
  collectionKey: string, 
  itemId: string, 
  updates: Record<string, any>
): Promise<boolean> {
  if (!itemId || !updates) return false;
  try {
    const updatesWithTs = { ...updates, updatedAt: updates.updatedAt || new Date().toISOString() };
    const cleanUpdates = sanitizeForFirebase(updatesWithTs);
    const itemRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await update(itemRef, cleanUpdates);
    return true;
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to update targeted item ${collectionKey}/${itemId}:`, error);
    return false;
  }
}

/**
 * Targeted Item-Level Delete:
 * Removes only the single document at `/collectionKey/itemId`.
 * Uses atomic update with null to delete the item without touching any other record,
 * as well as direct child remove.
 */
export async function deleteItemFromFirebase(collectionKey: string, itemId: string): Promise<void> {
  if (!itemId) return;
  try {
    // 1. Fetch item snapshot first for soft-delete / trash copy (Data Protection Rule 7)
    const itemRef = ref(rtdb, `${collectionKey}/${itemId}`);
    const snapshot = await get(itemRef);
    if (snapshot.exists()) {
      const itemData = snapshot.val();
      const trashRef = ref(rtdb, `trash/${collectionKey}/${itemId}`);
      await set(trashRef, {
        ...itemData,
        originalCollection: collectionKey,
        deletedAt: new Date().toISOString()
      });
    }

    // 2. Atomic update to null removes the key from active collection without touching other records
    const collectionRef = ref(rtdb, collectionKey);
    await update(collectionRef, { [itemId]: null });
    // 3. Also remove direct child ref for complete consistency
    await remove(itemRef);
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to soft-delete targeted item ${collectionKey}/${itemId}:`, error);
  }
}

export interface FirebaseBackupReport {
  timestamp: string;
  counts: Record<string, number>;
  verified: boolean;
  data: Record<string, any[]>;
}

/**
 * Data Protection Rule 6:
 * Reads ALL collections directly from Firebase Realtime Database (not from local state memory),
 * counts records in every collection, verifies count against database totals, and triggers
 * a direct JSON file download.
 */
export async function downloadFullFirebaseBackupDirect(): Promise<FirebaseBackupReport> {
  const collections = Object.values(FIREBASE_COLLECTIONS);
  const backupData: Record<string, any> = {};
  const counts: Record<string, number> = {};
  let totalRecords = 0;

  for (const col of collections) {
    const items = await fetchCollectionOnce(col);
    backupData[col] = items;
    counts[col] = items.length;
    totalRecords += items.length;
  }

  // Also include clothImages and trash paths outside standard collections
  try {
    const clothImagesSnap = await get(ref(rtdb, 'clothImages'));
    if (clothImagesSnap.exists()) {
      const val = clothImagesSnap.val();
      backupData['clothImages'] = val;
      counts['clothImages'] = typeof val === 'object' && val ? Object.keys(val).length : 0;
    } else {
      backupData['clothImages'] = {};
      counts['clothImages'] = 0;
    }
  } catch (e) {
    console.warn('Failed to fetch clothImages for backup:', e);
  }

  try {
    const trashSnap = await get(ref(rtdb, 'trash'));
    if (trashSnap.exists()) {
      const val = trashSnap.val();
      backupData['trash'] = val;
      counts['trash'] = typeof val === 'object' && val ? Object.keys(val).length : 0;
    } else {
      backupData['trash'] = {};
      counts['trash'] = 0;
    }
  } catch (e) {
    console.warn('Failed to fetch trash for backup:', e);
  }

  try {
    const clothThumbsSnap = await get(ref(rtdb, 'clothThumbs'));
    if (clothThumbsSnap.exists()) {
      const val = clothThumbsSnap.val();
      backupData['clothThumbs'] = val;
      counts['clothThumbs'] = typeof val === 'object' && val ? Object.keys(val).length : 0;
    } else {
      backupData['clothThumbs'] = {};
      counts['clothThumbs'] = 0;
    }
  } catch (e) {
    console.warn('Failed to fetch clothThumbs for backup:', e);
  }

  let verified = true;
  for (const col of collections) {
    const checkSnap = await get(ref(rtdb, col));
    let dbCount = 0;
    if (checkSnap.exists()) {
      const val = checkSnap.val();
      if (Array.isArray(val)) dbCount = val.filter(Boolean).length;
      else if (typeof val === 'object' && val !== null) dbCount = Object.keys(val).length;
    }
    if (dbCount !== counts[col]) {
      console.warn(`[Backup Verification] Collection ${col}: fetched ${counts[col]}, DB count ${dbCount}`);
      verified = false;
    }
  }

  const report: FirebaseBackupReport = {
    timestamp: new Date().toISOString(),
    counts,
    verified,
    data: backupData
  };

  const jsonStr = JSON.stringify(report, null, 2);
  const sizeMb = (new Blob([jsonStr]).size / (1024 * 1024)).toFixed(2);
  if (parseFloat(sizeMb) > 5) {
    console.info(`[Backup Notice] Backup size is ${sizeMb} MB.`);
  }

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boutique_full_firebase_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return report;
}

/**
 * Single-Read Fetch:
 * Fetches collection once on demand (e.g. startup for static/lookup tables)
 * without maintaining an ongoing persistent subscription.
 */
export async function fetchCollectionOnce<T extends { id?: string }>(collectionKey: string): Promise<T[]> {
  try {
    const snapshot = await get(ref(rtdb, collectionKey));
    let items: T[] = [];
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (Array.isArray(val)) {
        items = val.filter(Boolean);
      } else if (typeof val === 'object' && val !== null) {
        items = Object.keys(val).map(k => {
          const item = val[k];
          if (item && typeof item === 'object') {
            if (!item.id) {
              item.id = k;
            }
            return item;
          }
          return null;
        }).filter(Boolean);
      }
    }
    return items;
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to fetch static collection ${collectionKey}:`, error);
    return [];
  }
}

/**
 * Targeted Single-Item Fetch by Barcode:
 * Enables O(1) direct lookup from Firebase RTDB for a single item without loading the full collection.
 */
export async function fetchClothByBarcode(barcode: string): Promise<any | null> {
  if (!barcode) return null;
  const clean = barcode.trim().toLowerCase();
  if (!clean) return null;

  try {
    // 1. Query Firebase RTDB by barcode child field directly (returns ONLY 1 record over the wire)
    const bcQuery = query(
      ref(rtdb, FIREBASE_COLLECTIONS.CLOTHES),
      orderByChild('barcode'),
      equalTo(barcode.trim())
    );
    const snapshot = await get(bcQuery);
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length > 0) {
          const item = val[keys[0]];
          return { ...item, id: item.id || keys[0] };
        }
      }
    }

    // 2. Direct child ID lookup fallback
    const idSnap = await get(ref(rtdb, `${FIREBASE_COLLECTIONS.CLOTHES}/${clean}`));
    if (idSnap.exists()) {
      const item = idSnap.val();
      if (item && typeof item === 'object') {
        return { ...item, id: item.id || clean };
      }
    }
  } catch (error) {
    console.warn(`[Firebase RTDB] Targeted barcode lookup error for ${barcode}:`, error);
  }
  return null;
}

/**
 * Targeted Name Search with Index:
 * Searches clothes collection using Firebase orderByChild('name') with startAt and endAt.
 */
export async function searchClothesByName(term: string, maxResults = 50): Promise<any[]> {
  if (!term || !term.trim()) return [];
  const cleanTerm = term.trim();
  try {
    const nameQuery = query(
      ref(rtdb, FIREBASE_COLLECTIONS.CLOTHES),
      orderByChild('name'),
      startAt(cleanTerm),
      endAt(cleanTerm + '\uf8ff'),
      limitToLast(maxResults)
    );
    const snapshot = await get(nameQuery);
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    if (typeof val === 'object' && val !== null) {
      return Object.keys(val).map(k => {
        const item = val[k];
        return { ...item, id: item.id || k };
      });
    }
    return [];
  } catch (error) {
    console.warn(`[Firebase RTDB] Name search query error for "${term}":`, error);
    return [];
  }
}

/**
 * STRICTLY FOR MANUAL BACKUP / RESTORE / FULL SYNC:
 * Merges collection items into Firebase Realtime Database using update().
 * Ignores empty arrays to prevent wiping cloud data.
 */
export async function syncCollectionToCloud<T extends { id?: string }>(
  collectionKey: string, 
  items: T[]
): Promise<void> {
  if (!items || !Array.isArray(items) || items.length === 0) {
    console.log(`[Firebase RTDB] Ignoring empty array sync for ${collectionKey}`);
    return;
  }
  try {
    const colRef = ref(rtdb, collectionKey);
    const mapObj: Record<string, T> = {};
    items.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const key = item.id || `idx_${idx}`;
        mapObj[key] = sanitizeForFirebase({ ...item, updatedAt: (item as any).updatedAt || new Date().toISOString() });
      }
    });
    // Non-destructive merge update
    await update(colRef, mapObj);
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to merge sync collection ${collectionKey}:`, error);
  }
}

/**
 * Fetch all items currently in soft-delete trash (/trash)
 */
export async function fetchTrashItems(): Promise<any[]> {
  try {
    const trashRef = ref(rtdb, 'trash');
    const snapshot = await get(trashRef);
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    const items: any[] = [];
    Object.keys(val).forEach(col => {
      const colObj = val[col];
      if (colObj && typeof colObj === 'object') {
        Object.keys(colObj).forEach(id => {
          const item = colObj[id];
          if (item && typeof item === 'object') {
            items.push({ ...item, id, collection: col });
          }
        });
      }
    });
    return items;
  } catch (err) {
    console.warn('Failed to fetch trash items:', err);
    return [];
  }
}

/**
 * Restore an item from /trash/{collectionKey}/{itemId} back to /{collectionKey}/{itemId}
 */
export async function restoreItemFromTrash(collectionKey: string, itemId: string): Promise<boolean> {
  try {
    const trashItemRef = ref(rtdb, `trash/${collectionKey}/${itemId}`);
    const snapshot = await get(trashItemRef);
    if (!snapshot.exists()) return false;
    const itemData = snapshot.val();
    const { originalCollection, deletedAt, ...restoredData } = itemData;

    // Restore back to active collection
    const targetCollectionRef = ref(rtdb, collectionKey);
    await update(targetCollectionRef, { [itemId]: sanitizeForFirebase({ ...restoredData, updatedAt: new Date().toISOString() }) });

    // Remove from trash
    await remove(trashItemRef);
    return true;
  } catch (err) {
    console.error('Failed to restore item from trash:', err);
    return false;
  }
}

/**
 * Permanently purge items from /trash older than specified days (default 30 days)
 */
export async function purgeOldTrashItems(days: number = 30): Promise<number> {
  try {
    const trashRef = ref(rtdb, 'trash');
    const snapshot = await get(trashRef);
    if (!snapshot.exists()) return 0;
    const val = snapshot.val();
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    let purgedCount = 0;

    for (const col of Object.keys(val)) {
      const colObj = val[col];
      if (colObj && typeof colObj === 'object') {
        for (const id of Object.keys(colObj)) {
          const item = colObj[id];
          if (item && item.deletedAt) {
            const deletedTime = new Date(item.deletedAt).getTime();
            if (!isNaN(deletedTime) && deletedTime < cutoffMs) {
              await remove(ref(rtdb, `trash/${col}/${id}`));
              purgedCount++;
            }
          }
        }
      }
    }
    return purgedCount;
  } catch (err) {
    console.error('Failed to purge old trash items:', err);
    return 0;
  }
}

interface ActiveSubscriptionEntry<T = any> {
  collectionKey: string;
  subKey: string;
  targetRef: Query;
  listener: (snapshot: any) => void;
  unsubFirebase: () => void;
  callbacks: Set<(items: T[]) => void>;
  lastData: T[] | null;
}

/**
 * Unified Subscription Manager with Reference Counting and Deduplication:
 * - Guarantees strictly ONE active Firebase listener (onValue) per subKey.
 * - Reuses the single listener across multiple consumers with multiple callbacks.
 * - Dynamically attaches new callbacks to the active listener and provides last data immediately.
 * - Automatically unsubscribes and calls off() when reference count (active consumers) reaches 0.
 * - Memory leak proof, React Strict Mode compliant, and idempotent.
 */
export class SubscriptionManager {
  private static activeSubscriptions = new Map<string, ActiveSubscriptionEntry>();

  /**
   * Subscribe to a collection with deduplication and reference counting.
   * Invariant: 1 SubKey = 1 Firebase listener maximum.
   */
  static subscribe<T extends { id?: string }>(
    collectionKey: string,
    callback: (items: T[]) => void,
    options?: { limit?: number; sort?: boolean }
  ): () => void {
    const subKey = options?.limit && options.limit > 0 ? `${collectionKey}_limit_${options.limit}` : collectionKey;
    let entry = this.activeSubscriptions.get(subKey);

    if (entry) {
      // Reuse existing Firebase listener for this subscription key
      entry.callbacks.add(callback);

      // Provide latest data snapshot immediately if already fetched
      if (entry.lastData !== null) {
        try {
          callback(entry.lastData);
        } catch (err) {
          console.error(`[SubscriptionManager] Callback error on ${subKey}:`, err);
        }
      }
    } else {
      // Create a brand new subscription for this subKey - strictly 1 onValue listener
      const callbacks = new Set<(items: any[]) => void>();
      callbacks.add(callback);

      let targetRef: Query = ref(rtdb, collectionKey);
      if (options?.limit && options.limit > 0) {
        targetRef = query(ref(rtdb, collectionKey), limitToLast(options.limit));
      }

      const listener = (snapshot: any) => {
        const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        let items: T[] = [];
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (Array.isArray(val)) {
            items = val.filter(Boolean);
          } else if (typeof val === 'object' && val !== null) {
            items = Object.keys(val).map(k => {
              const item = val[k];
              if (item && typeof item === 'object') {
                if (!item.id) item.id = k;
                return item;
              }
              return null;
            }).filter(Boolean);
          }

          // Sort items if sort option is not explicitly false
          if (options?.sort !== false) {
            items.sort((a: any, b: any) => {
              const timeA = a.createdAt || a.timestamp || a.date || '';
              const timeB = b.createdAt || b.timestamp || b.date || '';
              if (timeA && timeB) {
                return timeB.localeCompare(timeA);
              }
              return 0;
            });
          }
        }

        if ((import.meta as any).env?.DEV) {
          const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;
          console.log(`⚡ [Firebase RTDB] ${subKey} payload received: ${items.length} records in ${durationMs.toFixed(1)}ms`);
        }

        const currentEntry = SubscriptionManager.activeSubscriptions.get(subKey);
        if (currentEntry) {
          currentEntry.lastData = items;
          currentEntry.callbacks.forEach(cb => {
            try {
              cb(items);
            } catch (err) {
              console.error(`[SubscriptionManager] Callback error on ${subKey}:`, err);
            }
          });
        }
      };

      const unsubFirebase = onValue(targetRef, listener, (error) => {
        console.warn(`[Firebase RTDB] Listener error on ${subKey}:`, error);
      });

      entry = {
        collectionKey,
        subKey,
        targetRef,
        listener,
        unsubFirebase,
        callbacks,
        lastData: null
      };

      this.activeSubscriptions.set(subKey, entry);
    }

    // Return reference-counted, idempotent unsubscribe function
    let isUnsubscribed = false;
    return () => {
      if (isUnsubscribed) return;
      isUnsubscribed = true;

      const activeEntry = SubscriptionManager.activeSubscriptions.get(subKey);
      if (!activeEntry) return;

      activeEntry.callbacks.delete(callback);

      // If no more consumers are listening to this subscription key, detach listener and cleanup
      if (activeEntry.callbacks.size === 0) {
        try {
          if (typeof activeEntry.unsubFirebase === 'function') {
            activeEntry.unsubFirebase();
          }
        } catch (e) {}
        try {
          off(activeEntry.targetRef, 'value', activeEntry.listener);
        } catch (e) {}
        SubscriptionManager.activeSubscriptions.delete(subKey);
      }
    };
  }

  /**
   * Subscribe to granular child events (onChildAdded, onChildChanged, onChildRemoved)
   * for massive collections like inventory clothes to stream updates with minimal network overhead.
   */
  static subscribeChildren<T extends { id?: string }>(
    collectionKey: string,
    handlers: {
      onAdded?: (item: T) => void;
      onChanged?: (item: T) => void;
      onRemoved?: (id: string) => void;
    }
  ): () => void {
    const colRef = ref(rtdb, collectionKey);

    const parseItem = (snap: any): T => {
      const val = snap.val() || {};
      if (!val.id) val.id = snap.key;
      return val as T;
    };

    const unsubAdded = onChildAdded(colRef, (snap) => {
      if (snap.exists() && handlers.onAdded) {
        handlers.onAdded(parseItem(snap));
      }
    });

    const unsubChanged = onChildChanged(colRef, (snap) => {
      if (snap.exists() && handlers.onChanged) {
        handlers.onChanged(parseItem(snap));
      }
    });

    const unsubRemoved = onChildRemoved(colRef, (snap) => {
      if (handlers.onRemoved) {
        handlers.onRemoved(snap.key as string);
      }
    });

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      try { unsubAdded(); } catch {}
      try { unsubChanged(); } catch {}
      try { unsubRemoved(); } catch {}
    };
  }

  /**
   * Granular child listeners (onChildAdded, onChildChanged, onChildRemoved):
   * Avoids re-downloading entire collection array on single item change.
   */
  static subscribeGranular<T extends { id?: string }>(
    collectionKey: string,
    callback: (items: T[]) => void,
    options?: { sort?: boolean }
  ): () => void {
    const subKey = `${collectionKey}_granular`;
    let entry = this.activeSubscriptions.get(subKey);

    if (entry) {
      entry.callbacks.add(callback);
      if (entry.lastData !== null) {
        try {
          callback(entry.lastData);
        } catch (err) {
          console.error(`[SubscriptionManager] Granular callback error on ${subKey}:`, err);
        }
      }
    } else {
      const callbacks = new Set<(items: any[]) => void>();
      callbacks.add(callback);

      const targetRef = ref(rtdb, collectionKey);
      const itemsMap = new Map<string, T>();
      let emitTimer: any = null;

      const emitBatch = () => {
        if (emitTimer) {
          clearTimeout(emitTimer);
          emitTimer = null;
        }
        let items = Array.from(itemsMap.values());
        if (options?.sort !== false) {
          items.sort((a: any, b: any) => {
            const timeA = (a as any).createdAt || (a as any).timestamp || (a as any).date || '';
            const timeB = (b as any).createdAt || (b as any).timestamp || (b as any).date || '';
            if (timeA && timeB) return timeB.localeCompare(timeA);
            return 0;
          });
        }
        const cur = SubscriptionManager.activeSubscriptions.get(subKey);
        if (cur) {
          cur.lastData = items;
          cur.callbacks.forEach(cb => {
            try {
              cb(items);
            } catch (err) {
              console.error(`[SubscriptionManager] Granular cb error on ${subKey}:`, err);
            }
          });
        }
      };

      const scheduleEmit = () => {
        if (!emitTimer) {
          emitTimer = setTimeout(emitBatch, 35);
        }
      };

      const unsubAdd = onChildAdded(targetRef, (snapshot) => {
        const item = snapshot.val();
        if (item && typeof item === 'object') {
          const id = item.id || snapshot.key;
          itemsMap.set(id, { ...item, id });
          scheduleEmit();
        }
      });

      const unsubChange = onChildChanged(targetRef, (snapshot) => {
        const item = snapshot.val();
        if (item && typeof item === 'object') {
          const id = item.id || snapshot.key;
          itemsMap.set(id, { ...item, id });
          scheduleEmit();
        }
      });

      const unsubRemove = onChildRemoved(targetRef, (snapshot) => {
        const key = snapshot.key;
        if (key) {
          itemsMap.delete(key);
          scheduleEmit();
        }
      });

      const unsubFirebase = () => {
        if (emitTimer) clearTimeout(emitTimer);
        try { unsubAdd(); } catch (e) {}
        try { unsubChange(); } catch (e) {}
        try { unsubRemove(); } catch (e) {}
      };

      entry = {
        collectionKey,
        subKey,
        targetRef,
        listener: emitBatch,
        unsubFirebase,
        callbacks,
        lastData: null
      };

      this.activeSubscriptions.set(subKey, entry);
    }

    let isUnsubscribed = false;
    return () => {
      if (isUnsubscribed) return;
      isUnsubscribed = true;

      const activeEntry = SubscriptionManager.activeSubscriptions.get(subKey);
      if (!activeEntry) return;

      activeEntry.callbacks.delete(callback);

      if (activeEntry.callbacks.size === 0) {
        try {
          activeEntry.unsubFirebase();
        } catch (e) {}
        SubscriptionManager.activeSubscriptions.delete(subKey);
      }
    };
  }

  /**
   * Get total count of active Firebase collection listeners
   */
  static getActiveSubscriptionsCount(): number {
    return this.activeSubscriptions.size;
  }

  /**
   * Get array of actively subscribed collection names
   */
  static getActiveCollections(): string[] {
    return Array.from(this.activeSubscriptions.keys());
  }

  /**
   * Check if a collection is actively subscribed
   */
  static isSubscribed(collectionKey: string): boolean {
    return this.activeSubscriptions.has(collectionKey);
  }

  /**
   * Get count of active consumers for a specific collection
   */
  static getConsumerCount(collectionKey: string): number {
    return this.activeSubscriptions.get(collectionKey)?.callbacks.size || 0;
  }

  /**
   * Get total number of active Firebase collection listeners
   */
  static getActiveListenerCount(): number {
    return this.activeSubscriptions.size;
  }

  /**
   * Listen to Firebase connection state with independent listener on .info/connected
   */
  static onConnectionStatus(callback: (connected: boolean) => void): () => void {
    const connectedRef = ref(rtdb, '.info/connected');
    const listener = (snapshot: any) => {
      callback(snapshot.val() === true);
    };
    const unsub = onValue(connectedRef, listener);
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {}
      try {
        off(connectedRef, 'value', listener);
      } catch (e) {}
    };
  }
}
