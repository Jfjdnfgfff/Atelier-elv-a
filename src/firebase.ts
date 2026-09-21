import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  remove,
  get, 
  onValue,
  query,
  limitToLast,
  orderByChild
} from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCbvyOhZK42hTsKjOWPPDc60LRyyrpoo34",
  authDomain: "ateliu-14e23.firebaseapp.com",
  databaseURL: "https://ateliu-14e23-default-rtdb.firebaseio.com",
  projectId: "ateliu-14e23",
  storageBucket: "ateliu-14e23.firebasestorage.app",
  messagingSenderId: "137350226746",
  appId: "1:137350226746:web:d4f824a6580b7c152be603",
  measurementId: "G-WYDHE63XZS"
};

// Initialize Firebase App singleton
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Realtime Database
export const rtdb = getDatabase(firebaseApp);

// Initialize Firestore for security rules compliance
export const db = getFirestore(firebaseApp);

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

interface SyncListener {
  (status: SyncStatus, lastSynced?: Date, errorMsg?: string): void;
}

const listeners: Set<SyncListener> = new Set();
let currentStatus: SyncStatus = 'connected';
let lastSyncedTime: Date | undefined = undefined;
let lastErrorMessage: string | undefined = undefined;

export function onSyncStatusChange(callback: SyncListener) {
  listeners.add(callback);
  callback(currentStatus, lastSyncedTime, lastErrorMessage);
  return () => {
    listeners.delete(callback);
  };
}

let statusDebounceTimer: any = null;
function updateStatus(status: SyncStatus, error?: string) {
  currentStatus = status;
  if (status === 'connected') {
    lastSyncedTime = new Date();
    lastErrorMessage = undefined;
  }
  if (error) {
    lastErrorMessage = error;
  }
  
  if (statusDebounceTimer) clearTimeout(statusDebounceTimer);
  statusDebounceTimer = setTimeout(() => {
    listeners.forEach((l) => l(currentStatus, lastSyncedTime, lastErrorMessage));
  }, 100);
}

// In-memory cache for all collections to prevent redundant network fetches
const memoryCache = new Map<string, any[]>();

// Track locally initiated writes with item-level precision to avoid echo loops
const pendingItemWrites = new Map<string, number>();

export const FIREBASE_COLLECTIONS = {
  CLOTHES: 'boutique_clothes',
  RENTALS: 'boutique_rentals',
  SALES: 'boutique_sales',
  EXPENSES: 'boutique_expenses',
  CREDITS: 'boutique_credits',
  STAFF_PAYOUTS: 'boutique_staff_payouts',
  STAFF_MEMBERS: 'boutique_staff_members',
  STAFF_ABSENCES: 'boutique_staff_absences',
  CUSTOMERS: 'boutique_customers',
  MAINTENANCE: 'boutique_maintenance',
  SUPPLIERS: 'boutique_suppliers',
  SEAMSTRESSES: 'boutique_seamstresses',
  RAW_MATERIALS: 'boutique_raw_materials',
  CAISSE_CLOSURES: 'boutique_caisse_closures',
  ACTIVITY_LOGS: 'boutique_activity_logs',
  STORE_CONFIG: 'boutique_store_config'
};

/**
 * Sanitize object for Firebase (remove undefined, convert Dates, deep clone)
 */
function sanitizeForFirebase<T>(data: T): any {
  if (data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

/**
 * Normalizes Firebase snapshot data whether stored as legacy array or records map
 */
export function normalizeSnapshotData<T extends { id?: string }>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (val.items && Array.isArray(val.items)) return val.items.filter(Boolean);
  
  // If stored in record map: records: { [id]: item } or direct { [id]: item }
  const records = val.records || val;
  if (typeof records === 'object') {
    const items: T[] = [];
    Object.keys(records).forEach((k) => {
      if (k === 'updatedAt' || k === 'meta') return;
      const item = records[k];
      if (item && typeof item === 'object') {
        if (!item.id && k) item.id = k;
        items.push(item);
      }
    });
    return items;
  }
  return [];
}

/**
 * Saves or overwrites a single item in Firebase by ID without rewriting the whole collection
 */
export async function saveItemToFirebase<T extends { id: string }>(
  collectionKey: string,
  item: T
): Promise<boolean> {
  if (!item || !item.id) return false;
  
  const writeKey = `${collectionKey}/${item.id}`;
  pendingItemWrites.set(writeKey, Date.now());
  updateStatus('syncing');

  try {
    const itemRef = ref(rtdb, `boutique_store/${collectionKey}/records/${item.id}`);
    const cleanItem = sanitizeForFirebase(item);
    
    await set(itemRef, cleanItem);
    
    // Update collection timestamp lightweight
    const metaRef = ref(rtdb, `boutique_store/${collectionKey}/updatedAt`);
    set(metaRef, new Date().toISOString()).catch(() => {});

    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB item save error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حفظ العنصر في السحابة');
    return false;
  }
}

/**
 * Updates specific fields on an existing record by ID in Firebase
 */
export async function updateItemInFirebase<T extends { id?: string }>(
  collectionKey: string,
  itemId: string,
  updates: Partial<T>
): Promise<boolean> {
  if (!itemId) return false;

  const writeKey = `${collectionKey}/${itemId}`;
  pendingItemWrites.set(writeKey, Date.now());
  updateStatus('syncing');

  try {
    const itemRef = ref(rtdb, `boutique_store/${collectionKey}/records/${itemId}`);
    const cleanUpdates = sanitizeForFirebase(updates);
    
    await update(itemRef, cleanUpdates);

    // Update collection timestamp
    const metaRef = ref(rtdb, `boutique_store/${collectionKey}/updatedAt`);
    set(metaRef, new Date().toISOString()).catch(() => {});

    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB item update error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر تحديث العنصر في السحابة');
    return false;
  }
}

/**
 * Deletes a single item by ID from Firebase
 */
export async function deleteItemFromFirebase(
  collectionKey: string,
  itemId: string
): Promise<boolean> {
  if (!itemId) return false;

  const writeKey = `${collectionKey}/${itemId}`;
  pendingItemWrites.set(writeKey, Date.now());
  updateStatus('syncing');

  try {
    const itemRef = ref(rtdb, `boutique_store/${collectionKey}/records/${itemId}`);
    await remove(itemRef);

    // Also remove from legacy items array if exists
    const metaRef = ref(rtdb, `boutique_store/${collectionKey}/updatedAt`);
    set(metaRef, new Date().toISOString()).catch(() => {});

    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB item delete error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حذف العنصر من السحابة');
    return false;
  }
}

/**
 * Batch saves or migrates a full collection to Firebase in the optimized records structure
 */
export async function saveCollectionToFirebase<T extends { id?: string }>(
  key: string,
  data: T[]
): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  
  updateStatus('syncing');
  pendingItemWrites.set(key, Date.now());

  try {
    const storeRef = ref(rtdb, `boutique_store/${key}`);
    const cleanData = sanitizeForFirebase(data);
    
    // Store records as indexed map for fast O(1) single-item reads and updates
    const recordsMap: Record<string, any> = {};
    cleanData.forEach((item: any, idx: number) => {
      const id = item.id || `rec_${idx}`;
      recordsMap[id] = item;
    });

    await set(storeRef, {
      records: recordsMap,
      // also keep items field for backwards compatibility
      items: cleanData,
      updatedAt: new Date().toISOString()
    });

    // Update memory cache
    memoryCache.set(key, data);

    updateStatus('connected');
    return true;
  } catch (rtdbError: any) {
    console.warn(`[Firebase RTDB save collection error on ${key}]:`, rtdbError?.message || rtdbError);
    updateStatus('error', rtdbError?.message || 'تعذر حفظ البيانات في السحابة');
    return false;
  }
}

/**
 * Subscribes to real-time changes on a collection with intelligent caching and local mutation protection
 */
export function subscribeToFirebaseKey<T extends { id?: string }>(
  key: string,
  onDataReceived: (data: T[]) => void,
  options?: { limit?: number; orderBy?: string }
): () => void {
  let unsubRTDB: (() => void) | null = null;

  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    let dbQuery: any = rtdbRef;

    if (options?.limit) {
      if (options.orderBy) {
        dbQuery = query(rtdbRef, orderByChild(options.orderBy), limitToLast(options.limit));
      } else {
        dbQuery = query(rtdbRef, limitToLast(options.limit));
      }
    }

    unsubRTDB = onValue(
      dbQuery,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const lastWrite = pendingItemWrites.get(key) || 0;
          
          // Prevent echo loops for recent local batch writes
          if (Date.now() - lastWrite > 1000) {
            const normalized = normalizeSnapshotData<T>(val);
            memoryCache.set(key, normalized);
            onDataReceived(normalized);
            updateStatus('connected');
          }
        } else {
          const lastWrite = pendingItemWrites.get(key) || 0;
          if (Date.now() - lastWrite > 1000) {
            memoryCache.set(key, []);
            onDataReceived([]);
          }
        }
      },
      (err: any) => {
        console.warn(`[RTDB listener error for ${key}]:`, err.message);
      }
    );
  } catch (e) {
    console.warn(`[RTDB subscribe failed for ${key}]:`, e);
  }

  return () => {
    if (unsubRTDB) unsubRTDB();
  };
}

/**
 * Returns in-memory cached data if available, else fetches once from Firebase
 */
export async function getCachedOrFetchData<T extends { id?: string }>(key: string): Promise<T[]> {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T[];
  }

  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    const snap = await get(rtdbRef);
    if (snap.exists()) {
      const normalized = normalizeSnapshotData<T>(snap.val());
      memoryCache.set(key, normalized);
      return normalized;
    }
  } catch (e) {
    console.warn(`[RTDB fetch failed for ${key}]:`, e);
  }
  return [];
}

// Backward-compatible aliases
export const saveToFirebase = saveCollectionToFirebase;
export const syncCollectionToCloud = saveCollectionToFirebase;
export const subscribeToCloudCollection = subscribeToFirebaseKey;
