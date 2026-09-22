import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  remove, 
  onValue, 
  get 
} from 'firebase/database';
import appletConfig from '../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: appletConfig.apiKey || "AIzaSyCeJmAfN_adH0yVbFC5pdawBjwHKvsQ2lo",
  authDomain: appletConfig.authDomain || "apt-service-kr5vm.firebaseapp.com",
  projectId: appletConfig.projectId || "apt-service-kr5vm",
  storageBucket: appletConfig.storageBucket || "apt-service-kr5vm.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || "931004998179",
  appId: appletConfig.appId || "1:931004998179:web:ddd0106b947ce0c5bc0796",
  measurementId: appletConfig.measurementId || ""
};

// Initialize Firebase App singleton
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Realtime Database with robust fallbacks
// Since development serves from europe-west1, the default RTDB region is europe-west1
const defaultRtdbUrl = `https://${firebaseConfig.projectId}-default-rtdb.europe-west1.firebasedatabase.app`;
const backupRtdbUrl = `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;

const chosenRtdbUrl = (appletConfig as any).databaseURL || defaultRtdbUrl;

export const rtdb = getDatabase(firebaseApp, chosenRtdbUrl);

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
const canonicalStoreCache = new Map<string, Map<string, any>>();
const queryMemoryCache = new Map<string, any[]>();
const queryCacheTimestamps = new Map<string, number>();
const memoryCache = new Map<string, any[]>();
const cacheTimestamps = new Map<string, number>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
const MAX_QUERY_CACHE_ENTRIES = 40;
const MAX_CANONICAL_ITEMS_PER_COLLECTION = 800;

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

const pendingItemWrites = new Map<string, number>();

function evictStaleQueryCaches(): void {
  const now = Date.now();
  for (const [qKey, ts] of queryCacheTimestamps.entries()) {
    if (now - ts > CACHE_TTL_MS) {
      deleteQueryCacheEntry(qKey);
    }
  }

  if (queryMemoryCache.size > MAX_QUERY_CACHE_ENTRIES) {
    const sorted = Array.from(queryCacheTimestamps.entries())
      .sort((a, b) => a[1] - b[1]);

    const toRemoveCount = queryMemoryCache.size - MAX_QUERY_CACHE_ENTRIES;
    for (let i = 0; i < Math.min(toRemoveCount, sorted.length); i++) {
      deleteQueryCacheEntry(sorted[i][0]);
    }
  }
}

function pruneCanonicalStoreIfNeeded(colKey: string, store: Map<string, any>): void {
  if (store.size > MAX_CANONICAL_ITEMS_PER_COLLECTION) {
    const excess = store.size - MAX_CANONICAL_ITEMS_PER_COLLECTION;
    let deleted = 0;
    for (const key of store.keys()) {
      if (deleted >= excess) break;
      store.delete(key);
      deleted++;
    }
  }
}

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

const HEAVY_COLLECTIONS = new Set([
  FIREBASE_COLLECTIONS.SALES,
  FIREBASE_COLLECTIONS.RENTALS,
  FIREBASE_COLLECTIONS.EXPENSES,
  FIREBASE_COLLECTIONS.CREDITS,
  FIREBASE_COLLECTIONS.ACTIVITY_LOGS,
  FIREBASE_COLLECTIONS.STAFF_PAYOUTS,
  FIREBASE_COLLECTIONS.MAINTENANCE
]);

export function isArrayIdentical<T>(arr1: T[] | undefined | null, arr2: T[] | undefined | null): boolean {
  if (arr1 === arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

export const areArraysEqual = isArrayIdentical;

function isShallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a.id !== undefined && b.id !== undefined && a.id !== b.id) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function setMemoryCacheEntry(key: string, val: any[]): void {
  memoryCache.set(key, val);
  cacheTimestamps.set(key, Date.now());
  try {
    localStorage.setItem(key, JSON.stringify({ data: val, ts: Date.now() }));
  } catch (e) {
    // Ignore quota errors
  }
}

function sanitizeForFirebase(data: any): any {
  if (data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

export function normalizeSnapshotData<T extends { id?: string }>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [];
}

export function getLocalCachedData<T>(key: string): T[] {
  return (memoryCache.get(key) || []) as T[];
}

export async function saveItemToFirebase<T extends { id: string }>(
  collectionKey: string,
  item: T
): Promise<boolean> {
  if (!item || !item.id) return false;
  
  const writeKey = `${collectionKey}/${item.id}`;
  pendingItemWrites.set(writeKey, Date.now());
  pendingItemWrites.set(collectionKey, Date.now());

  let colStore = canonicalStoreCache.get(collectionKey);
  if (!colStore) {
    colStore = new Map<string, any>();
    canonicalStoreCache.set(collectionKey, colStore);
  }
  const prevItem = colStore.get(item.id);
  const hadItem = colStore.has(item.id);
  const itemToStore = (hadItem && prevItem && isShallowEqual(prevItem, item)) ? prevItem : item;

  colStore.set(item.id, itemToStore);
  pruneCanonicalStoreIfNeeded(collectionKey, colStore);
  
  let currentArr = memoryCache.get(collectionKey) || [];
  if (!hadItem) {
    setMemoryCacheEntry(collectionKey, [itemToStore, ...currentArr]);
  } else {
    const idx = currentArr.findIndex((x: any) => x && x.id === item.id);
    if (idx >= 0) {
      const nextArr = [...currentArr];
      nextArr[idx] = itemToStore;
      setMemoryCacheEntry(collectionKey, nextArr);
    } else {
      setMemoryCacheEntry(collectionKey, [itemToStore, ...currentArr]);
    }
  }

  updateStatus('syncing');

  try {
    const cleanItem = sanitizeForFirebase(item);
    const dbRef = ref(rtdb, `${collectionKey}/${item.id}`);
    await set(dbRef, cleanItem);
    
    cacheTimestamps.set(collectionKey, Date.now());
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[RTDB save error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حفظ العنصر في السحابة');
    return false;
  }
}

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
    colStore.set(itemId, itemToStore);
    
    let currentArr = memoryCache.get(collectionKey) || [];
    const idx = currentArr.findIndex((x: any) => x && x.id === itemId);
    if (idx >= 0) {
      const nextArr = [...currentArr];
      nextArr[idx] = itemToStore;
      setMemoryCacheEntry(collectionKey, nextArr);
    }
  }

  updateStatus('syncing');

  try {
    const cleanUpdates = sanitizeForFirebase(updates);
    const dbRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await update(dbRef, cleanUpdates);
    
    cacheTimestamps.set(collectionKey, Date.now());
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[RTDB update error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر تحديث العنصر في السحابة');
    return false;
  }
}

export async function deleteItemFromFirebase(
  collectionKey: string,
  itemId: string
): Promise<boolean> {
  if (!itemId) return false;

  const writeKey = `${collectionKey}/${itemId}`;
  pendingItemWrites.set(writeKey, Date.now());
  pendingItemWrites.set(collectionKey, Date.now());

  let colStore = canonicalStoreCache.get(collectionKey);
  if (colStore) colStore.delete(itemId);

  let currentArr = memoryCache.get(collectionKey) || [];
  const nextArr = currentArr.filter((x: any) => x && x.id !== itemId);
  setMemoryCacheEntry(collectionKey, nextArr);

  updateStatus('syncing');

  try {
    const dbRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await remove(dbRef);
    
    cacheTimestamps.set(collectionKey, Date.now());
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[RTDB delete error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حذف العنصر من السحابة');
    return false;
  }
}

export async function saveCollectionToFirebase<T extends { id?: string }>(
  key: string,
  data: T[]
): Promise<boolean> {
  if (!Array.isArray(data)) return false;
  
  updateStatus('syncing');
  pendingItemWrites.set(key, Date.now());

  try {
    const rtdbObject: Record<string, any> = {};
    data.forEach((item, index) => {
      const id = item.id || `rec_${index}`;
      rtdbObject[id] = item;
    });

    const cleanData = sanitizeForFirebase(rtdbObject);
    const dbRef = ref(rtdb, key);
    await set(dbRef, cleanData);

    setMemoryCacheEntry(key, data);
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[RTDB save collection error on ${key}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حفظ البيانات في السحابة');
    return false;
  }
}

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

export function buildQueryRegistryKey(key: string, options?: SubscribeQueryOptions): string {
  if (!options) return key;
  const parts: string[] = [key];
  if (options.orderBy) parts.push(`ob:${options.orderBy}`);
  if (options.startAt !== undefined) parts.push(`sa:${options.startAt}`);
  if (options.endAt !== undefined) parts.push(`ea:${options.endAt}`);
  if (options.limit !== undefined) parts.push(`lim:${options.limit}`);
  return parts.join('|');
}

export function subscribeToFirebaseKey<T extends { id?: string }>(
  key: string,
  onDataReceived: (data: T[]) => void,
  options?: SubscribeQueryOptions
): () => void {
  const registryKey = buildQueryRegistryKey(key, options);

  if (queryMemoryCache.has(registryKey)) {
    const cachedQueryData = queryMemoryCache.get(registryKey) as T[];
    if (cachedQueryData) {
      onDataReceived(cachedQueryData);
    }
  } else if (!options && memoryCache.has(key)) {
    const cachedMemData = memoryCache.get(key) as T[];
    if (cachedMemData) {
      onDataReceived(cachedMemData);
    }
  } else if (!options) {
    try {
      const localItem = localStorage.getItem(key);
      if (localItem) {
        const parsed = JSON.parse(localItem);
        const dataArr = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.data))
          ? parsed.data
          : (Array.isArray(parsed) ? parsed : null);
        if (dataArr && dataArr.length > 0) {
          setMemoryCacheEntry(key, dataArr);
          onDataReceived(dataArr as T[]);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  const registryEntry = activeListenersRegistry.get(registryKey);
  if (registryEntry) {
    if (registryEntry.cleanupTimer) {
      clearTimeout(registryEntry.cleanupTimer);
      registryEntry.cleanupTimer = undefined;
    }
    registryEntry.callbacks.add(onDataReceived);
    return () => {
      const entry = activeListenersRegistry.get(registryKey);
      if (entry) {
        entry.callbacks.delete(onDataReceived);
        if (entry.callbacks.size === 0) {
          if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
          entry.cleanupTimer = setTimeout(() => {
            const current = activeListenersRegistry.get(registryKey);
            if (current && current.callbacks.size === 0) {
              current.unsub();
              activeListenersRegistry.delete(registryKey);
            }
          }, 30000);
        }
      }
    };
  }

  const callbacks = new Set<(data: any[]) => void>();
  callbacks.add(onDataReceived);

  let unsubRTDB: (() => void) = () => {};

  try {
    const isHeavy = HEAVY_COLLECTIONS.has(key);
    const limitCount = options?.limit || (isHeavy && !options?.startAt ? 120 : undefined);
    
    const dbRef = ref(rtdb, key);

    unsubRTDB = onValue(dbRef, (snapshot) => {
      const lastWrite = pendingItemWrites.get(key) || 0;
      if (Date.now() - lastWrite > 800) {
        const val = snapshot.val();
        let rawList: T[] = [];
        if (val) {
          if (Array.isArray(val)) {
            rawList = val.filter(Boolean) as T[];
          } else if (typeof val === 'object') {
            rawList = Object.entries(val).map(([id, itemData]: [string, any]) => {
              return { id, ...itemData } as T;
            });
          }
        }

        const orderField = options?.orderBy || COLLECTION_DATE_FIELDS[key];
        if (orderField) {
          rawList.sort((a: any, b: any) => {
            const valA = a[orderField];
            const valB = b[orderField];
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;
            return valA > valB ? -1 : valA < valB ? 1 : 0;
          });
        }

        if (options?.limit) {
          rawList = rawList.slice(0, options.limit);
        } else if (limitCount) {
          rawList = rawList.slice(0, limitCount);
        }
        
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
        pruneCanonicalStoreIfNeeded(key, colStore);

        const existingCache = queryMemoryCache.get(registryKey);
        if (existingCache && isArrayIdentical(existingCache, normalized)) {
          updateStatus('connected');
          return;
        }

        setQueryCacheEntry(registryKey, normalized);

        if (!options) {
          setMemoryCacheEntry(key, normalized);
        } else {
          let currentArr = memoryCache.get(key);
          if (!currentArr) {
            setMemoryCacheEntry(key, normalized);
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
              setMemoryCacheEntry(key, nextArr);
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
      }
    },
    (err: any) => {
      console.warn(`[RTDB listener error for ${key}]:`, err.message);
    });
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
        if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
        entry.cleanupTimer = setTimeout(() => {
          const current = activeListenersRegistry.get(registryKey);
          if (current && current.callbacks.size === 0) {
            current.unsub();
            activeListenersRegistry.delete(registryKey);
          }
        }, 30000);
      }
    }
  };
}

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
    const dbRef = ref(rtdb, key);
    const snap = await get(dbRef);
    const val = snap.val();
    let rawList: T[] = [];
    if (val) {
      if (Array.isArray(val)) {
        rawList = val.filter(Boolean) as T[];
      } else if (typeof val === 'object') {
        rawList = Object.entries(val).map(([id, itemData]: [string, any]) => {
          return { id, ...itemData } as T;
        });
      }
    }

    const dateField = COLLECTION_DATE_FIELDS[key];
    if (dateField) {
      rawList.sort((a: any, b: any) => {
        const valA = a[dateField];
        const valB = b[dateField];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        return valA > valB ? -1 : valA < valB ? 1 : 0;
      });
    }

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
    setMemoryCacheEntry(key, normalized);
    return normalized;
  } catch (e) {
    console.warn(`[RTDB fetch failed for ${key}]:`, e);
  }
  return (memoryCache.get(key) || []) as T[];
}

export async function fetchHistoricalCollection<T extends { id?: string }>(
  key: string,
  limitCount: number = 500
): Promise<T[]> {
  try {
    const dbRef = ref(rtdb, key);
    const snap = await get(dbRef);
    const val = snap.val();
    let rawList: T[] = [];
    if (val) {
      if (Array.isArray(val)) {
        rawList = val.filter(Boolean) as T[];
      } else if (typeof val === 'object') {
        rawList = Object.entries(val).map(([id, itemData]: [string, any]) => {
          return { id, ...itemData } as T;
        });
      }
    }

    const dateField = COLLECTION_DATE_FIELDS[key];
    if (dateField) {
      rawList.sort((a: any, b: any) => {
        const valA = a[dateField];
        const valB = b[dateField];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        return valA > valB ? -1 : valA < valB ? 1 : 0;
      });
    }

    rawList = rawList.slice(0, limitCount);

    const queryKey = buildQueryRegistryKey(key, { orderBy: dateField, limit: limitCount });

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
    setMemoryCacheEntry(key, normalized);
    return normalized;
  } catch (e) {
    console.warn(`[RTDB historical fetch failed for ${key}]:`, e);
  }
  return (memoryCache.get(key) || []) as T[];
}

export const saveToFirebase = saveCollectionToFirebase;
export const syncCollectionToCloud = saveCollectionToFirebase;
export const subscribeToCloudCollection = subscribeToFirebaseKey;

interface ListenerRegistryEntry {
  unsub: () => void;
  callbacks: Set<(data: any[]) => void>;
  cleanupTimer?: any;
}
const activeListenersRegistry = new Map<string, ListenerRegistryEntry>();

export class SubscriptionManager {
  static subscribe<T extends { id?: string }>(
    key: string,
    callback: (data: T[]) => void,
    options?: SubscribeQueryOptions
  ): () => void {
    return subscribeToFirebaseKey<T>(key, callback, options);
  }

  static unsubscribe(
    key: string,
    callback?: (data: any[]) => void,
    options?: SubscribeQueryOptions
  ): void {
    const registryKey = buildQueryRegistryKey(key, options);
    const entry = activeListenersRegistry.get(registryKey);
    if (!entry) return;

    if (callback) {
      entry.callbacks.delete(callback);
      if (entry.callbacks.size === 0) {
        entry.unsub();
        activeListenersRegistry.delete(registryKey);
      }
    } else {
      entry.unsub();
      activeListenersRegistry.delete(registryKey);
    }
  }

  static isSubscribed(key: string, options?: SubscribeQueryOptions): boolean {
    const registryKey = buildQueryRegistryKey(key, options);
    return activeListenersRegistry.has(registryKey);
  }

  static getActiveListenerCount(): number {
    return activeListenersRegistry.size;
  }

  static async subscribeOnce<T extends { id?: string }>(
    key: string,
    options?: SubscribeQueryOptions
  ): Promise<T[]> {
    const registryKey = buildQueryRegistryKey(key, options);
    if (queryMemoryCache.has(registryKey)) {
      return queryMemoryCache.get(registryKey) as T[];
    }
    if (!options && memoryCache.has(key)) {
      return memoryCache.get(key) as T[];
    }
    return getCachedOrFetchData<T>(key);
  }
}

export async function clearAllFirebaseData(): Promise<void> {
  try {
    const keys = Object.values(FIREBASE_COLLECTIONS);
    
    for (const k of keys) {
      const dbRef = ref(rtdb, k);
      await remove(dbRef);
    }
    localStorage.clear();
    invalidateMemoryCache();
    console.log('[RTDB & Storage] All Realtime Database paths & local data wiped successfully.');
  } catch (e) {
    console.error('Error clearing RTDB data:', e);
  }
}
