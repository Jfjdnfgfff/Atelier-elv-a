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
  ACTIVITY_LOGS: 'activityLogs'
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

  // Compare ID and mutable fields sequentially
  for (let i = 0; i < a.length; i++) {
    const itemA: any = a[i];
    const itemB: any = b[i];

    if (!itemA || !itemB) return false;
    if (itemA.id !== itemB.id) return false;

    // Fast check on core business fields that might change on updates
    if (itemA.updatedAt !== itemB.updatedAt) return false;
    if (itemA.status !== itemB.status) return false;
    if (itemA.name !== itemB.name) return false;
    if (itemA.stock !== itemB.stock) return false;
    if (itemA.stock1 !== itemB.stock1) return false;
    if (itemA.stock2 !== itemB.stock2) return false;
    if (itemA.rentedCount !== itemB.rentedCount) return false;
    if (itemA.inCleaningCount !== itemB.inCleaningCount) return false;
    if (itemA.paidAmount !== itemB.paidAmount) return false;
    if (itemA.remainingAmount !== itemB.remainingAmount) return false;
    if (itemA.amount !== itemB.amount) return false;
    if (itemA.totalAmount !== itemB.totalAmount) return false;
    if (itemA.isDeducted !== itemB.isDeducted) return false;
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
    const cleanItem = sanitizeForFirebase(item);
    const collectionRef = ref(rtdb, collectionKey);
    // update({ [id]: item }) preserves all existing items in collectionKey without wiping
    await update(collectionRef, { [cleanItem.id]: cleanItem });
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to save targeted item ${collectionKey}/${item.id}:`, error);
  }
}

/**
 * Push or Update Item in Firebase Realtime Database:
 * Guarantees that data is never wiped or overwritten.
 */
export async function pushItemToFirebase<T extends { id?: string }>(
  collectionKey: string, 
  item: T
): Promise<string | null> {
  if (!item) return null;
  try {
    const cleanItem = sanitizeForFirebase(item);
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

/**
 * Targeted Item-Level Update:
 * Updates specific fields for a single document at `/collectionKey/itemId`.
 * 1 item = 1 targeted update using `update()`. Existing unmentioned fields remain intact.
 */
export async function updateItemInFirebase(
  collectionKey: string, 
  itemId: string, 
  updates: Record<string, any>
): Promise<void> {
  if (!itemId || !updates) return;
  try {
    const cleanUpdates = sanitizeForFirebase(updates);
    const itemRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await update(itemRef, cleanUpdates);
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to update targeted item ${collectionKey}/${itemId}:`, error);
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
    // 1. Atomic update to null removes the key without touching other records
    const collectionRef = ref(rtdb, collectionKey);
    await update(collectionRef, { [itemId]: null });
    // 2. Also remove direct child ref for complete consistency
    const itemRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await remove(itemRef);
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to delete targeted item ${collectionKey}/${itemId}:`, error);
  }
}

/**
 * STRICTLY FOR MANUAL BACKUP / RESTORE / FULL SYNC:
 * Synchronizes an entire collection map to Firebase Realtime Database.
 * WARNING: NEVER call this in automated CRUD handlers or useEffects!
 */
export async function syncCollectionToCloud<T extends { id?: string }>(
  collectionKey: string, 
  items: T[]
): Promise<void> {
  try {
    const colRef = ref(rtdb, collectionKey);
    const mapObj: Record<string, T> = {};
    items.forEach((item, idx) => {
      const key = item.id || `idx_${idx}`;
      mapObj[key] = item;
    });
    await set(colRef, mapObj);
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to sync collection ${collectionKey}:`, error);
  }
}

interface ActiveSubscriptionEntry<T> {
  refCount: number;
  callbacks: Set<(items: T[]) => void>;
  lastData: T[] | null;
  unsubscribeFirebase: () => void;
}

/**
 * Unified Subscription Manager with Reference Counting and Deduplication:
 * - Guarantees maximum of 1 active listener per collection.
 * - Prevents listener duplication when views open/close repeatedly.
 * - Supports bounded queries (limitToLast) for large append-only collections (e.g., activityLogs).
 * - Shares cached snapshot immediately to newly attached callbacks.
 */
export class SubscriptionManager {
  private static activeSubscriptions = new Map<string, ActiveSubscriptionEntry<any>>();

  /**
   * Subscribe to a collection with deduplication and reference counting.
   */
  static subscribe<T extends { id?: string }>(
    collectionKey: string,
    callback: (items: T[]) => void,
    options?: { limit?: number }
  ): () => void {
    const subKey = options?.limit ? `${collectionKey}_limit_${options.limit}` : collectionKey;

    let entry = this.activeSubscriptions.get(subKey);

    if (entry) {
      // Reuse existing Firebase listener
      entry.refCount++;
      entry.callbacks.add(callback);

      // Provide latest data immediately if already fetched
      if (entry.lastData !== null) {
        callback(entry.lastData);
      }
    } else {
      // Create a brand new subscription
      const callbacks = new Set<(items: T[]) => void>();
      callbacks.add(callback);

      let targetRef: Query = ref(rtdb, collectionKey);
      if (options?.limit && options.limit > 0) {
        targetRef = query(ref(rtdb, collectionKey), limitToLast(options.limit));
      }

      const listener = (snapshot: any) => {
        let items: T[] = [];
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (Array.isArray(val)) {
            items = val.filter(Boolean);
          } else if (typeof val === 'object' && val !== null) {
            items = Object.keys(val).map(k => {
              const item = val[k];
              if (item && typeof item === 'object' && !item.id) {
                item.id = k;
              }
              return item;
            });
          }

          // Sort items consistently (newest first if timestamps/dates are available)
          items.sort((a: any, b: any) => {
            const timeA = a.createdAt || a.timestamp || a.date || '';
            const timeB = b.createdAt || b.timestamp || b.date || '';
            if (timeA && timeB) {
              return timeB.localeCompare(timeA);
            }
            return 0;
          });
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

      onValue(targetRef, listener, (error) => {
        console.warn(`[Firebase RTDB] Listener error on ${subKey}:`, error);
      });

      const unsubscribeFirebase = () => {
        off(targetRef, 'value', listener);
      };

      entry = {
        refCount: 1,
        callbacks,
        lastData: null,
        unsubscribeFirebase
      };

      this.activeSubscriptions.set(subKey, entry);
    }

    // Return reference-counted unsubscribe function
    return () => {
      const activeEntry = SubscriptionManager.activeSubscriptions.get(subKey);
      if (!activeEntry) return;

      activeEntry.callbacks.delete(callback);
      activeEntry.refCount--;

      if (activeEntry.refCount <= 0) {
        activeEntry.unsubscribeFirebase();
        SubscriptionManager.activeSubscriptions.delete(subKey);
      }
    };
  }

  /**
   * Check if a collection is actively subscribed
   */
  static isSubscribed(collectionKey: string): boolean {
    return this.activeSubscriptions.has(collectionKey);
  }

  /**
   * Listen to Firebase connection state
   */
  static onConnectionStatus(callback: (connected: boolean) => void): () => void {
    const connectedRef = ref(rtdb, '.info/connected');
    const listener = (snapshot: any) => {
      callback(snapshot.val() === true);
    };
    onValue(connectedRef, listener);
    return () => {
      off(connectedRef, 'value', listener);
    };
  }
}
