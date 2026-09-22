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
  orderByChild,
  startAt,
  endAt
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

const statusListeners: Set<SyncListener> = new Set();
let currentStatus: SyncStatus = 'connected';
let lastSyncedTime: Date | undefined = undefined;
let lastErrorMessage: string | undefined = undefined;

export function onSyncStatusChange(callback: SyncListener) {
  statusListeners.add(callback);
  callback(currentStatus, lastSyncedTime, lastErrorMessage);
  return () => {
    statusListeners.delete(callback);
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
    statusListeners.forEach((l) => l(currentStatus, lastSyncedTime, lastErrorMessage));
  }, 100);
}

// In-memory cache for all collections for zero-latency UI and deduplication
// 1. Canonical store tracks all known items by ID across queries
const canonicalStoreCache = new Map<string, Map<string, any>>();
// 2. Query cache strictly isolates results by unique query signature
const queryMemoryCache = new Map<string, any[]>();
const queryCacheTimestamps = new Map<string, number>();

/**
 * Helper to match an item against a structured query registry key without expensive RegExp parsing
 */
function itemMatchesQueryKey(qKey: string, collectionKey: string, item: any): boolean {
  if (qKey === collectionKey) return true;
  if (!qKey.startsWith(`${collectionKey}|`)) return false;

  const itemDate = (item as any)?.date || (item as any)?.startDate || (item as any)?.receivedDate || (item as any)?.createdAt || '';
  
  const saIdx = qKey.indexOf('|sa:');
  if (saIdx !== -1) {
    const end = qKey.indexOf('|', saIdx + 4);
    const saVal = end === -1 ? qKey.slice(saIdx + 4) : qKey.slice(saIdx + 4, end);
    if (itemDate && itemDate < saVal) return false;
  }

  const eaIdx = qKey.indexOf('|ea:');
  if (eaIdx !== -1) {
    const end = qKey.indexOf('|', eaIdx + 4);
    const eaVal = end === -1 ? qKey.slice(eaIdx + 4) : qKey.slice(eaIdx + 4, end);
    if (itemDate && itemDate > eaVal) return false;
  }

  return true;
}

function getQueryLimitFromKey(qKey: string): number | null {
  const limIdx = qKey.indexOf('|lim:');
  if (limIdx === -1) return null;
  const end = qKey.indexOf('|', limIdx + 5);
  const valStr = end === -1 ? qKey.slice(limIdx + 5) : qKey.slice(limIdx + 5, end);
  const num = parseInt(valStr, 10);
  return isNaN(num) ? null : num;
}
function isShallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

  // Fast timestamp/updatedAt check if present
  if (a.updatedAt && b.updatedAt && a.updatedAt === b.updatedAt) return true;
  if (a.updated_at && b.updated_at && a.updated_at === b.updated_at) return true;
  if (a.timestamp && b.timestamp && a.timestamp === b.timestamp) return true;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    const valA = a[k];
    const valB = b[k];
    if (valA === valB) continue;

    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      for (let j = 0; j < valA.length; j++) {
        if (valA[j] !== valB[j] && !isShallowEqual(valA[j], valB[j])) return false;
      }
    } else if (valA && valB && typeof valA === 'object' && typeof valB === 'object') {
      if (!isShallowEqual(valA, valB)) return false;
    } else {
      return false;
    }
  }
  return true;
}

export function isArrayIdentical<T>(arr1: T[] | undefined | null, arr2: T[] | undefined | null): boolean {
  if (arr1 === arr2) return true;
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

// Backward compatibility alias for fast pointer-based array equality
export const areArraysEqual = isArrayIdentical;

const memoryCache = new Map<string, any[]>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
const MAX_QUERY_CACHE_ENTRIES = 40;
const MAX_CANONICAL_ITEMS_PER_COLLECTION = 800;

// Index mapping collectionKey -> Set of registryKeys in queryMemoryCache for O(1) query lookups
const collectionQueryIndex = new Map<string, Set<string>>();

function registerQueryCacheKey(colKey: string, regKey: string): void {
  let set = collectionQueryIndex.get(colKey);
  if (!set) {
    set = new Set<string>();
    collectionQueryIndex.set(colKey, set);
  }
  set.add(regKey);
}

function unregisterQueryCacheKey(colKey: string, regKey: string): void {
  const set = collectionQueryIndex.get(colKey);
  if (set) {
    set.delete(regKey);
    if (set.size === 0) collectionQueryIndex.delete(colKey);
  }
}

function deleteQueryCacheEntry(qKey: string): void {
  queryMemoryCache.delete(qKey);
  queryCacheTimestamps.delete(qKey);
  const colKey = qKey.split('|')[0];
  unregisterQueryCacheKey(colKey, qKey);
}

function setQueryCacheEntry(qKey: string, val: any[]): void {
  queryMemoryCache.set(qKey, val);
  queryCacheTimestamps.set(qKey, Date.now());
  const colKey = qKey.split('|')[0];
  registerQueryCacheKey(colKey, qKey);
}

// Track locally initiated writes with item-level precision to avoid echo loops
const pendingItemWrites = new Map<string, number>();

/**
 * Performs active eviction of expired or oversized in-memory caches to keep RAM footprint low
 */
function evictStaleQueryCaches(): void {
  const now = Date.now();
  // Evict expired queries not actively listened to
  for (const [qKey, ts] of queryCacheTimestamps.entries()) {
    if (now - ts > CACHE_TTL_MS && !activeListenersRegistry.has(qKey)) {
      deleteQueryCacheEntry(qKey);
    }
  }

  // If query cache is still above max entries, trim oldest entries
  if (queryMemoryCache.size > MAX_QUERY_CACHE_ENTRIES) {
    const sorted = Array.from(queryCacheTimestamps.entries())
      .filter(([k]) => !activeListenersRegistry.has(k))
      .sort((a, b) => a[1] - b[1]);

    const toRemoveCount = queryMemoryCache.size - MAX_QUERY_CACHE_ENTRIES;
    for (let i = 0; i < Math.min(toRemoveCount, sorted.length); i++) {
      const keyToRemove = sorted[i][0];
      deleteQueryCacheEntry(keyToRemove);
    }
  }
}

/**
 * Prunes RAM canonical store if it exceeds max items limit without affecting Firebase
 */
function pruneCanonicalStoreIfNeeded(colKey: string, store: Map<string, any>): void {
  if (store.size > MAX_CANONICAL_ITEMS_PER_COLLECTION && HEAVY_COLLECTIONS.has(colKey)) {
    const excess = store.size - MAX_CANONICAL_ITEMS_PER_COLLECTION;
    let deleted = 0;
    for (const key of store.keys()) {
      if (deleted >= excess) break;
      store.delete(key);
      deleted++;
    }
  }
}

/**
 * Manually invalidate cached collection in memory (both query and canonical caches)
 */
export function invalidateMemoryCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
    cacheTimestamps.delete(key);
    canonicalStoreCache.delete(key);
    const targetQueryKeys = collectionQueryIndex.get(key);
    if (targetQueryKeys) {
      const keysToDelete = Array.from(targetQueryKeys);
      for (let i = 0; i < keysToDelete.length; i++) {
        deleteQueryCacheEntry(keysToDelete[i]);
      }
    }
  } else {
    memoryCache.clear();
    cacheTimestamps.clear();
    canonicalStoreCache.clear();
    queryMemoryCache.clear();
    queryCacheTimestamps.clear();
    collectionQueryIndex.clear();
  }
}

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

// Collections that grow continuously and should be loaded with initial limit to prevent memory bloat
const HEAVY_COLLECTIONS = new Set([
  FIREBASE_COLLECTIONS.SALES,
  FIREBASE_COLLECTIONS.RENTALS,
  FIREBASE_COLLECTIONS.EXPENSES,
  FIREBASE_COLLECTIONS.CREDITS,
  FIREBASE_COLLECTIONS.ACTIVITY_LOGS,
  FIREBASE_COLLECTIONS.STAFF_PAYOUTS,
  FIREBASE_COLLECTIONS.MAINTENANCE
]);

/**
 * Sanitize object for Firebase (remove undefined, convert Dates, deep clone)
 */
function sanitizeForFirebase<T>(data: T): any {
  if (data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

/**
 * Normalizes Firebase snapshot data whether stored in records map, legacy items array, or flat object
 * Completely backward-compatible with any existing structure
 */
export function normalizeSnapshotData<T extends { id?: string }>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (val.items && Array.isArray(val.items)) return val.items.filter(Boolean);
  
  // If stored in record map: records: { [id]: item } or direct { [id]: item }
  const records = val.records !== undefined ? val.records : val;
  if (records && typeof records === 'object') {
    const items: T[] = [];
    Object.keys(records).forEach((k) => {
      if (k === 'updatedAt' || k === 'meta' || k === 'items') return;
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
 * Get current in-memory cached items for a collection
 */
export function getLocalCachedData<T>(key: string): T[] {
  return (memoryCache.get(key) || []) as T[];
}

/**
 * Saves or overwrites a single item in Firebase by ID without rewriting the whole collection.
 * Immediately updates in-memory cache for 0ms UI latency with automatic rollback on network failure.
 */
export async function saveItemToFirebase<T extends { id: string }>(
  collectionKey: string,
  item: T
): Promise<boolean> {
  if (!item || !item.id) return false;
  
  const writeKey = `${collectionKey}/${item.id}`;
  pendingItemWrites.set(writeKey, Date.now());
  pendingItemWrites.set(collectionKey, Date.now());

  // Snapshot previous canonical state for rollback
  let colStore = canonicalStoreCache.get(collectionKey);
  if (!colStore) {
    colStore = new Map<string, any>();
    canonicalStoreCache.set(collectionKey, colStore);
  }
  const prevItem = colStore.get(item.id);
  const hadItem = colStore.has(item.id);

  const itemToStore = (hadItem && prevItem && isShallowEqual(prevItem, item)) ? prevItem : item;

  // Optimistically update canonical & query caches
  colStore.set(item.id, itemToStore);
  pruneCanonicalStoreIfNeeded(collectionKey, colStore);
  
  let currentArr = memoryCache.get(collectionKey);
  if (!currentArr) {
    currentArr = [itemToStore];
    memoryCache.set(collectionKey, currentArr);
  } else if (!hadItem) {
    // Brand new item: prepend in O(1) without array search
    memoryCache.set(collectionKey, [itemToStore, ...currentArr]);
  } else {
    // Existing item: find index via reference pointer first
    let idx = prevItem ? currentArr.indexOf(prevItem) : -1;
    if (idx === -1) idx = currentArr.findIndex(x => x.id === item.id);
    if (idx >= 0) {
      if (currentArr[idx] !== itemToStore) {
        const nextArr = [...currentArr];
        nextArr[idx] = itemToStore;
        memoryCache.set(collectionKey, nextArr);
      }
    } else {
      memoryCache.set(collectionKey, [itemToStore, ...currentArr]);
    }
  }
  cacheTimestamps.set(collectionKey, Date.now());
  evictStaleQueryCaches();
  
  const targetQueryKeys = collectionQueryIndex.get(collectionKey);
  if (targetQueryKeys) {
    for (const qKey of targetQueryKeys) {
      const qList = queryMemoryCache.get(qKey);
      if (!qList) continue;
      let matches = itemMatchesQueryKey(qKey, collectionKey, itemToStore);
      if (matches) {
        if (!hadItem) {
          // Brand new item: unshift in O(1) without array search
          qList.unshift(itemToStore);
          const lim = getQueryLimitFromKey(qKey);
          if (lim !== null && qList.length > lim) {
            qList.splice(lim);
          }
        } else {
          let idx = prevItem ? qList.indexOf(prevItem) : -1;
          if (idx === -1) idx = qList.findIndex(x => x.id === item.id);
          if (idx >= 0) {
            if (qList[idx] !== itemToStore) {
              qList[idx] = itemToStore;
            }
          } else {
            qList.unshift(itemToStore);
            const lim = getQueryLimitFromKey(qKey);
            if (lim !== null && qList.length > lim) {
              qList.splice(lim);
            }
          }
        }
      }
    }
  }

  updateStatus('syncing');

  try {
    const cleanItem = sanitizeForFirebase(item);
    const multiUpdates: Record<string, any> = {
      [`boutique_store/${collectionKey}/records/${item.id}`]: cleanItem,
      [`boutique_store/${collectionKey}/updatedAt`]: new Date().toISOString()
    };
    
    // Single atomic network request instead of multiple sets
    await update(ref(rtdb), multiUpdates);
    cacheTimestamps.set(collectionKey, Date.now());

    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB item save error on ${writeKey}]:`, err?.message || err);
    // Rollback optimistic update
    if (hadItem) {
      colStore.set(item.id, prevItem);
      let currentArr = memoryCache.get(collectionKey);
      if (currentArr) {
        let idx = itemToStore ? currentArr.indexOf(itemToStore) : -1;
        if (idx === -1) idx = currentArr.findIndex(x => x.id === item.id);
        if (idx >= 0) currentArr[idx] = prevItem;
      }
    } else {
      colStore.delete(item.id);
      let currentArr = memoryCache.get(collectionKey);
      if (currentArr) {
        let idx = itemToStore ? currentArr.indexOf(itemToStore) : -1;
        if (idx === -1) idx = currentArr.findIndex(x => x.id === item.id);
        if (idx >= 0) currentArr.splice(idx, 1);
      }
    }
    const rollbackQueryKeys = collectionQueryIndex.get(collectionKey);
    if (rollbackQueryKeys) {
      for (const qKey of rollbackQueryKeys) {
        const qList = queryMemoryCache.get(qKey);
        if (!qList) continue;
        let idx = itemToStore ? qList.indexOf(itemToStore) : -1;
        if (idx === -1) idx = qList.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          if (hadItem) {
            qList[idx] = prevItem;
          } else {
            qList.splice(idx, 1);
          }
        }
      }
    }
    updateStatus('error', err?.message || 'تعذر حفظ العنصر في السحابة');
    return false;
  }
}

/**
 * Updates specific fields on an existing record by ID in Firebase.
 * Immediately merges updates into memory cache with automatic rollback on network failure.
 */
export async function updateItemInFirebase<T extends { id?: string } = any>(
  collectionKey: string,
  itemId: string,
  updates: Partial<T> | Record<string, any>
): Promise<boolean> {
  if (!itemId) return false;

  const writeKey = `${collectionKey}/${itemId}`;
  pendingItemWrites.set(writeKey, Date.now());
  pendingItemWrites.set(collectionKey, Date.now());

  let colStore = canonicalStoreCache.get(collectionKey);
  if (!colStore) {
    colStore = new Map<string, any>();
    canonicalStoreCache.set(collectionKey, colStore);
  }
  const prevItem = colStore.get(itemId);
  const hadItem = colStore.has(itemId);

  if (hadItem && prevItem) {
    const merged = { ...prevItem, ...updates };
    const itemToStore = isShallowEqual(prevItem, merged) ? prevItem : merged;
    if (itemToStore !== prevItem) {
      colStore.set(itemId, itemToStore);
      
      let currentArr = memoryCache.get(collectionKey);
      if (currentArr) {
        let idx = currentArr.indexOf(prevItem);
        if (idx === -1) idx = currentArr.findIndex(x => x.id === itemId);
        if (idx >= 0) {
          const nextArr = [...currentArr];
          nextArr[idx] = itemToStore;
          memoryCache.set(collectionKey, nextArr);
        }
      }
      cacheTimestamps.set(collectionKey, Date.now());

      const targetQueryKeys = collectionQueryIndex.get(collectionKey);
      if (targetQueryKeys) {
        for (const qKey of targetQueryKeys) {
          const qList = queryMemoryCache.get(qKey);
          if (!qList) continue;
          let idx = qList.indexOf(prevItem);
          if (idx === -1) idx = qList.findIndex(x => x.id === itemId);
          if (idx >= 0) {
            qList[idx] = itemToStore;
          }
        }
      }
    }
  }

  updateStatus('syncing');

  try {
    const cleanUpdates = sanitizeForFirebase(updates);
    const multiUpdates: Record<string, any> = {};
    Object.keys(cleanUpdates).forEach(k => {
      multiUpdates[`boutique_store/${collectionKey}/records/${itemId}/${k}`] = cleanUpdates[k];
    });
    multiUpdates[`boutique_store/${collectionKey}/updatedAt`] = new Date().toISOString();
    
    // Single atomic multi-location update
    await update(ref(rtdb), multiUpdates);
    cacheTimestamps.set(collectionKey, Date.now());

    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB item update error on ${writeKey}]:`, err?.message || err);
    // Rollback
    if (hadItem && prevItem) {
      colStore.set(itemId, prevItem);
      let currentArr = memoryCache.get(collectionKey);
      if (currentArr) {
        let idx = currentArr.indexOf(prevItem);
        if (idx === -1) idx = currentArr.findIndex(x => x.id === itemId);
        if (idx >= 0) currentArr[idx] = prevItem;
      }
      const rollbackQueryKeys = collectionQueryIndex.get(collectionKey);
      if (rollbackQueryKeys) {
        for (const qKey of rollbackQueryKeys) {
          const qList = queryMemoryCache.get(qKey);
          if (!qList) continue;
          let idx = qList.indexOf(prevItem);
          if (idx === -1) idx = qList.findIndex(x => x.id === itemId);
          if (idx >= 0) {
            qList[idx] = prevItem;
          }
        }
      }
    }
    updateStatus('error', err?.message || 'تعذر تحديث العنصر في السحابة');
    return false;
  }
}

/**
 * Deletes a single item by ID from Firebase.
 * Immediately removes from memory cache with automatic rollback on network failure.
 */
export async function deleteItemFromFirebase(
  collectionKey: string,
  itemId: string
): Promise<boolean> {
  if (!itemId) return false;

  const writeKey = `${collectionKey}/${itemId}`;
  pendingItemWrites.set(writeKey, Date.now());
  pendingItemWrites.set(collectionKey, Date.now());

  let colStore = canonicalStoreCache.get(collectionKey);
  if (!colStore) {
    colStore = new Map<string, any>();
    canonicalStoreCache.set(collectionKey, colStore);
  }
  const prevItem = colStore.get(itemId);
  const hadItem = colStore.has(itemId);

  if (!hadItem) return true;

  // Optimistically remove from canonical and query caches
  colStore.delete(itemId);
  let currentArr = memoryCache.get(collectionKey);
  if (currentArr) {
    let idx = prevItem ? currentArr.indexOf(prevItem) : -1;
    if (idx === -1) idx = currentArr.findIndex(x => x.id === itemId);
    if (idx >= 0) {
      const nextArr = currentArr.filter((_, i) => i !== idx);
      memoryCache.set(collectionKey, nextArr);
    }
  }
  cacheTimestamps.set(collectionKey, Date.now());

  const targetQueryKeys = collectionQueryIndex.get(collectionKey);
  if (targetQueryKeys) {
    for (const qKey of targetQueryKeys) {
      const qList = queryMemoryCache.get(qKey);
      if (!qList) continue;
      let idx = prevItem ? qList.indexOf(prevItem) : -1;
      if (idx === -1) idx = qList.findIndex(x => x.id === itemId);
      if (idx >= 0) {
        qList.splice(idx, 1);
      }
    }
  }

  updateStatus('syncing');

  try {
    const multiUpdates: Record<string, any> = {
      [`boutique_store/${collectionKey}/records/${itemId}`]: null,
      [`boutique_store/${collectionKey}/updatedAt`]: new Date().toISOString()
    };
    
    // Single atomic multi-location delete
    await update(ref(rtdb), multiUpdates);
    cacheTimestamps.set(collectionKey, Date.now());

    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB item delete error on ${writeKey}]:`, err?.message || err);
    // Rollback
    if (hadItem && prevItem) {
      colStore.set(itemId, prevItem);
      let currentArr = memoryCache.get(collectionKey);
      if (currentArr) {
        if (!currentArr.some(x => x.id === itemId)) currentArr.unshift(prevItem);
      }
      const rollbackQueryKeys = collectionQueryIndex.get(collectionKey);
      if (rollbackQueryKeys) {
        for (const qKey of rollbackQueryKeys) {
          const qList = queryMemoryCache.get(qKey);
          if (qList && !qList.some(x => x.id === itemId)) {
            qList.unshift(prevItem);
          }
        }
      }
    }
    updateStatus('error', err?.message || 'تعذر حذف العنصر من السحابة');
    return false;
  }
}

/**
 * Batch saves a full collection to Firebase in the optimized records structure
 * Used exclusively for full backup restore and data migration
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

// Active singleton listeners registry to prevent duplicate network listeners on the same path & query
interface ListenerRegistryEntry {
  unsub: () => void;
  callbacks: Set<(data: any[]) => void>;
}
const activeListenersRegistry = new Map<string, ListenerRegistryEntry>();

// Track collections that have already been checked for legacy root fallback
const checkedLegacyCollections = new Set<string>();

export const COLLECTION_DATE_FIELDS: Record<string, string> = {
  [FIREBASE_COLLECTIONS.SALES]: 'date',
  [FIREBASE_COLLECTIONS.RENTALS]: 'createdAt',
  [FIREBASE_COLLECTIONS.EXPENSES]: 'date',
  [FIREBASE_COLLECTIONS.CREDITS]: 'date',
  [FIREBASE_COLLECTIONS.STAFF_PAYOUTS]: 'date',
  [FIREBASE_COLLECTIONS.MAINTENANCE]: 'receivedDate',
  [FIREBASE_COLLECTIONS.CAISSE_CLOSURES]: 'date',
  [FIREBASE_COLLECTIONS.ACTIVITY_LOGS]: 'timestamp',
};

export interface SubscribeQueryOptions {
  limit?: number;
  orderBy?: string;
  startAt?: string | number;
  endAt?: string | number;
}

/**
 * Builds a deterministic registry key based on collection key and active query options
 * Ensures identical queries share a singleton listener, while different queries get isolated listeners
 */
export function buildQueryRegistryKey(key: string, options?: SubscribeQueryOptions): string {
  if (!options) return key;
  const parts: string[] = [key];
  if (options.orderBy) parts.push(`ob:${options.orderBy}`);
  if (options.startAt !== undefined) parts.push(`sa:${options.startAt}`);
  if (options.endAt !== undefined) parts.push(`ea:${options.endAt}`);
  if (options.limit !== undefined) parts.push(`lim:${options.limit}`);
  return parts.join('|');
}

/**
 * Subscribes to real-time changes on a collection with singleton listener multiplexing,
 * strict query-level cache isolation, and echo loop prevention.
 */
export function subscribeToFirebaseKey<T extends { id?: string }>(
  key: string,
  onDataReceived: (data: T[]) => void,
  options?: SubscribeQueryOptions
): () => void {
  const registryKey = buildQueryRegistryKey(key, options);

  // If we already have query-isolated cache data, immediately deliver it to caller
  if (queryMemoryCache.has(registryKey)) {
    const cachedQueryData = queryMemoryCache.get(registryKey) as T[];
    if (cachedQueryData && cachedQueryData.length > 0) {
      onDataReceived(cachedQueryData);
    }
  } else if (!options && memoryCache.has(key)) {
    // For full unconstrained subscriptions only, use canonical cache
    onDataReceived(memoryCache.get(key) as T[]);
  }

  // Check if a shared listener already exists for this exact collection + query combination
  const registryEntry = activeListenersRegistry.get(registryKey);
  
  if (registryEntry) {
    registryEntry.callbacks.add(onDataReceived);
    return () => {
      const entry = activeListenersRegistry.get(registryKey);
      if (entry) {
        entry.callbacks.delete(onDataReceived);
        if (entry.callbacks.size === 0) {
          entry.unsub();
          activeListenersRegistry.delete(registryKey);
        }
      }
    };
  }

  // Setup new singleton listener
  const callbacks = new Set<(data: any[]) => void>();
  callbacks.add(onDataReceived);

  let unsubRTDB: (() => void) = () => {};

  try {
    const isHeavy = HEAVY_COLLECTIONS.has(key);
    const limitCount = options?.limit || (isHeavy && !options?.startAt ? 120 : undefined);
    
    // Connect directly to the records subnode for true indexed item limits
    const recordsRef = ref(rtdb, `boutique_store/${key}/records`);
    let dbQuery: any = recordsRef;

    const queryConstraints: any[] = [];
    const orderField = options?.orderBy || COLLECTION_DATE_FIELDS[key];
    if (orderField) {
      queryConstraints.push(orderByChild(orderField));
    }
    if (options?.startAt !== undefined) {
      queryConstraints.push(startAt(options.startAt));
    }
    if (options?.endAt !== undefined) {
      queryConstraints.push(endAt(options.endAt));
    }
    if (limitCount) {
      queryConstraints.push(limitToLast(limitCount));
    }

    if (queryConstraints.length > 0) {
      dbQuery = query(recordsRef, ...queryConstraints);
    }

    unsubRTDB = onValue(
      dbQuery,
      (snapshot) => {
        const lastWrite = pendingItemWrites.get(key) || 0;
        
        // Prevent echo loops for recent local writes within 800ms
        if (Date.now() - lastWrite > 800) {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const rawList = normalizeSnapshotData<T>(val);
            
            let colStore = canonicalStoreCache.get(key);
            if (!colStore) {
              colStore = new Map<string, any>();
              canonicalStoreCache.set(key, colStore);
            }

            // 1. Map raw items to canonical colStore items with reference preservation
            const normalized: T[] = new Array(rawList.length);
            for (let i = 0; i < rawList.length; i++) {
              const item = rawList[i];
              if (item && item.id) {
                const existing = colStore.get(item.id);
                if (existing && isShallowEqual(existing, item)) {
                  normalized[i] = existing;
                } else {
                  colStore.set(item.id, item);
                  normalized[i] = item;
                }
              } else {
                normalized[i] = item;
              }
            }
            pruneCanonicalStoreIfNeeded(key, colStore);

            // 2. Fast pointer equality check: If query cache already contains identical content, skip work
            const existingCache = queryMemoryCache.get(registryKey);
            if (existingCache && isArrayIdentical(existingCache, normalized)) {
              updateStatus('connected');
              return;
            }

            // 3. Store in query cache with index registration
            setQueryCacheEntry(registryKey, normalized);

            if (!options) {
              memoryCache.set(key, normalized);
            } else {
              let currentArr = memoryCache.get(key);
              if (!currentArr) {
                memoryCache.set(key, normalized);
              } else {
                const idIndexMap = new Map<string, number>();
                for (let j = 0; j < currentArr.length; j++) {
                  if (currentArr[j]?.id) {
                    idIndexMap.set(currentArr[j].id, j);
                  }
                }

                let updated = false;
                let nextArr: any[] | null = null;
                const itemsToAdd: any[] = [];

                for (let i = 0; i < normalized.length; i++) {
                  const item = normalized[i];
                  if (item && item.id) {
                    const idx = idIndexMap.get(item.id);
                    if (idx !== undefined) {
                      const arr = nextArr || currentArr;
                      if (arr[idx] !== item) {
                        if (!nextArr) nextArr = [...currentArr];
                        nextArr[idx] = item;
                        updated = true;
                      }
                    } else {
                      itemsToAdd.push(item);
                      updated = true;
                    }
                  }
                }

                if (itemsToAdd.length > 0) {
                  if (!nextArr) nextArr = [...currentArr];
                  nextArr.unshift(...itemsToAdd);
                }

                if (updated && nextArr) {
                  memoryCache.set(key, nextArr);
                }
              }
            }
            cacheTimestamps.set(key, Date.now());
            evictStaleQueryCaches();
            
            const currentEntry = activeListenersRegistry.get(registryKey);
            if (currentEntry) {
              currentEntry.callbacks.forEach(cb => {
                try {
                  cb(normalized);
                } catch (e) {
                  console.error('Error in listener callback:', e);
                }
              });
            }
            updateStatus('connected');
          } else if (!checkedLegacyCollections.has(key)) {
            // Check legacy root node boutique_store/${key} ONCE for backward compatibility
            checkedLegacyCollections.add(key);
            const parentRef = ref(rtdb, `boutique_store/${key}`);
            get(parentRef).then((parentSnap) => {
              if (parentSnap.exists()) {
                const parentVal = parentSnap.val();
                const rawList = normalizeSnapshotData<T>(parentVal);
                if (rawList.length > 0) {
                  let colStore = canonicalStoreCache.get(key);
                  if (!colStore) {
                    colStore = new Map<string, any>();
                    canonicalStoreCache.set(key, colStore);
                  }
                  const normalized: T[] = new Array(rawList.length);
                  for (let i = 0; i < rawList.length; i++) {
                    const item = rawList[i];
                    if (item && item.id) {
                      const existing = colStore.get(item.id);
                      if (existing && isShallowEqual(existing, item)) {
                        normalized[i] = existing;
                      } else {
                        colStore.set(item.id, item);
                        normalized[i] = item;
                      }
                    } else {
                      normalized[i] = item;
                    }
                  }
                  setQueryCacheEntry(registryKey, normalized);
                  memoryCache.set(key, normalized);
                  cacheTimestamps.set(key, Date.now());
                  const currentEntry = activeListenersRegistry.get(registryKey);
                  if (currentEntry) {
                    currentEntry.callbacks.forEach(cb => cb(normalized));
                  }
                  updateStatus('connected');
                  return;
                }
              }
              const existingCache = queryMemoryCache.get(registryKey) || [];
              if (existingCache.length === 0) {
                setQueryCacheEntry(registryKey, []);
                const currentEntry = activeListenersRegistry.get(registryKey);
                if (currentEntry) {
                  currentEntry.callbacks.forEach(cb => cb([]));
                }
              }
            }).catch(() => {});
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

  const newEntry: ListenerRegistryEntry = {
    unsub: unsubRTDB,
    callbacks
  };
  activeListenersRegistry.set(registryKey, newEntry);

  return () => {
    const entry = activeListenersRegistry.get(registryKey);
    if (entry) {
      entry.callbacks.delete(onDataReceived);
      if (entry.callbacks.size === 0) {
        entry.unsub();
        activeListenersRegistry.delete(registryKey);
      }
    }
  };
}

/**
 * Returns in-memory cached data if fresh, else fetches once from Firebase
 */
export async function getCachedOrFetchData<T extends { id?: string }>(
  key: string,
  maxAgeMs: number = CACHE_TTL_MS
): Promise<T[]> {
  const cached = memoryCache.get(key);
  const timestamp = cacheTimestamps.get(key) || 0;
  if (cached && cached.length > 0 && Date.now() - timestamp < maxAgeMs) {
    return cached as T[];
  }

  try {
    const recordsRef = ref(rtdb, `boutique_store/${key}/records`);
    const dateField = COLLECTION_DATE_FIELDS[key];
    const q = dateField
      ? query(recordsRef, orderByChild(dateField), limitToLast(300))
      : query(recordsRef, limitToLast(300));
    const snap = await get(q);
    if (snap.exists()) {
      const rawList = normalizeSnapshotData<T>(snap.val());
      let colStore = canonicalStoreCache.get(key);
      if (!colStore) {
        colStore = new Map<string, any>();
        canonicalStoreCache.set(key, colStore);
      }
      const normalized: T[] = new Array(rawList.length);
      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (item && item.id) {
          const existing = colStore.get(item.id);
          if (existing && isShallowEqual(existing, item)) {
            normalized[i] = existing;
          } else {
            colStore.set(item.id, item);
            normalized[i] = item;
          }
        } else {
          normalized[i] = item;
        }
      }
      memoryCache.set(key, normalized);
      cacheTimestamps.set(key, Date.now());
      return normalized;
    }
    if (!checkedLegacyCollections.has(key)) {
      checkedLegacyCollections.add(key);
      const legacyRef = ref(rtdb, `boutique_store/${key}`);
      const legacySnap = await get(legacyRef);
      if (legacySnap.exists()) {
        const normalized = normalizeSnapshotData<T>(legacySnap.val());
        memoryCache.set(key, normalized);
        cacheTimestamps.set(key, Date.now());
        return normalized;
      }
    }
  } catch (e) {
    console.warn(`[RTDB fetch failed for ${key}]:`, e);
  }
  return (memoryCache.get(key) || []) as T[];
}

/**
 * Fetches full historical data on demand without keeping permanent high-memory listener.
 * Respects chronological order and preserves canonical cache.
 */
export async function fetchHistoricalCollection<T extends { id?: string }>(
  key: string,
  limit: number = 500
): Promise<T[]> {
  try {
    const recordsRef = ref(rtdb, `boutique_store/${key}/records`);
    const dateField = COLLECTION_DATE_FIELDS[key];
    const q = dateField
      ? query(recordsRef, orderByChild(dateField), limitToLast(limit))
      : query(recordsRef, limitToLast(limit));
    const snap = await get(q);
    if (snap.exists()) {
      const rawList = normalizeSnapshotData<T>(snap.val());
      const queryKey = buildQueryRegistryKey(key, { orderBy: dateField, limit });

      let colStore = canonicalStoreCache.get(key);
      if (!colStore) {
        colStore = new Map<string, any>();
        canonicalStoreCache.set(key, colStore);
      }
      const normalized: T[] = new Array(rawList.length);
      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (item && item.id) {
          const existing = colStore.get(item.id);
          if (existing && isShallowEqual(existing, item)) {
            normalized[i] = existing;
          } else {
            colStore.set(item.id, item);
            normalized[i] = item;
          }
        } else {
          normalized[i] = item;
        }
      }
      setQueryCacheEntry(queryKey, normalized);
      memoryCache.set(key, normalized);
      cacheTimestamps.set(key, Date.now());
      return normalized;
    }
    if (!checkedLegacyCollections.has(key)) {
      checkedLegacyCollections.add(key);
      const legacyRef = ref(rtdb, `boutique_store/${key}`);
      const legacyQ = dateField
        ? query(legacyRef, orderByChild(dateField), limitToLast(limit))
        : query(legacyRef, limitToLast(limit));
      const legacySnap = await get(legacyQ);
      if (legacySnap.exists()) {
        const normalized = normalizeSnapshotData<T>(legacySnap.val());
        memoryCache.set(key, normalized);
        cacheTimestamps.set(key, Date.now());
        return normalized;
      }
    }
  } catch (e) {
    console.warn(`[RTDB historical fetch failed for ${key}]:`, e);
  }
  return (memoryCache.get(key) || []) as T[];
}

// Backward-compatible aliases
export const saveToFirebase = saveCollectionToFirebase;
export const syncCollectionToCloud = saveCollectionToFirebase;
export const subscribeToCloudCollection = subscribeToFirebaseKey;
