import { get, set } from 'idb-keyval';
import { 
  ClothItem, 
  Rental, 
  Sale, 
  Expense, 
  Credit, 
  StaffPayout,
  StaffMember,
  StaffAbsence,
  CustomerProfile,
  MaintenanceOrder,
  Supplier,
  DailyCaisseClosure,
  RawMaterial,
  Seamstress,
  ActivityLog
} from './types';
import { perfMonitor } from './utils/performanceMonitor';

export const STORAGE_KEYS = {
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
  SECURITY_PIN: 'bm_security_pin',
  STORE_CONFIG: 'boutique_store_config'
};

export const DEFAULT_ACTIVITY_LOGS: ActivityLog[] = [];
export const DEFAULT_RAW_MATERIALS: RawMaterial[] = [];
export const DEFAULT_SEAMSTRESSES: Seamstress[] = [];
export const DEFAULT_SUPPLIERS: Supplier[] = [];
export const DEFAULT_MAINTENANCE: MaintenanceOrder[] = [];
export const DEFAULT_STAFF: StaffMember[] = [];
export const DEFAULT_STAFF_PAYOUTS: StaffPayout[] = [];
export const DEFAULT_STAFF_ABSENCES: StaffAbsence[] = [];
export const DEFAULT_CLOTHES: ClothItem[] = [];
export const DEFAULT_RENTALS: Rental[] = [];
export const DEFAULT_SALES: Sale[] = [];
export const DEFAULT_EXPENSES: Expense[] = [];
export const DEFAULT_CREDITS: Credit[] = [];
export const DEFAULT_CAISSE_CLOSURES: DailyCaisseClosure[] = [];

// In-memory cache for fast, synchronous lookups without reading localStorage repeatedly
const memoryStore = new Map<string, any>();
const lastWrittenRef = new Map<string, any>();
const dirtyKeys = new Set<string>();
let idleFlushScheduled = false;

// Until IndexedDB hydration has finished, an empty in-memory collection may simply mean "not loaded yet":
// it must never overwrite the (possibly large) copy persisted in IndexedDB.
let indexedDbHydrated = false;

// Collections bigger than this live in IndexedDB only (localStorage is small, synchronous and blocks the UI).
const LOCAL_STORAGE_MAX_CHARS = 1024 * 1024;
const INDEXEDDB_ONLY_PLACEHOLDER = JSON.stringify({ data: [], timestamp: 0, version: 1, storedIn: 'indexeddb' });

/**
 * Replaces an outdated localStorage snapshot by a tiny placeholder when a collection can no longer be stored
 * there. Previously the old snapshot stayed in place and was loaded at the next start instead of the newer
 * IndexedDB copy (hydration only fills empty collections), showing stale stock/sales until Firebase answered.
 */
function markStoredInIndexedDbOnly(key: string) {
  try {
    localStorage.setItem(key, INDEXEDDB_ONLY_PLACEHOLDER);
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

export interface CacheMeta {
  timestamp: number;
  version: number;
  updatedAt?: string;
}

export interface CollectionCacheResult<T> {
  data: T[];
  isFresh: boolean;
  timestamp: number;
}

export interface StorageEnvelope<T> {
  data: T;
  timestamp: number;
  version: number;
  updatedAt?: string;
}

/**
 * Parses and unpacks cache envelope uniformly.
 * Backward compatible: automatically handles legacy raw arrays and converts them without losing records.
 */
export function parseStorageEnvelope<T>(raw: string | null, defaultValue: T): StorageEnvelope<T> {
  if (!raw) {
    return { data: defaultValue, timestamp: Date.now(), version: 1 };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed) {
      return {
        data: parsed.data as T,
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        updatedAt: parsed.updatedAt
      };
    }
    // Legacy format: raw array or object saved directly in localStorage
    return {
      data: parsed as T,
      timestamp: Date.now(),
      version: 1
    };
  } catch (e) {
    console.error(`Failed to parse storage content:`, e);
    return { data: defaultValue, timestamp: Date.now(), version: 1 };
  }
}

const cacheMetaStore = new Map<string, CacheMeta>();
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export const isCacheFresh = (key: string, ttlMs: number = DEFAULT_CACHE_TTL_MS): boolean => {
  const meta = cacheMetaStore.get(key);
  if (!meta) return false;
  return (Date.now() - meta.timestamp) < ttlMs;
};

export const getCollectionCacheMeta = (key: string): CacheMeta => {
  return cacheMetaStore.get(key) || { timestamp: Date.now(), version: 1 };
};

/**
 * Flushes all pending dirty collections immediately to localStorage synchronously.
 * Called automatically on beforeunload, pagehide, and visibilitychange to prevent data loss.
 */
export function flushPendingStorageSynchronously(): void {
  if (dirtyKeys.size === 0) return;

  const keysToFlush = Array.from(dirtyKeys);
  dirtyKeys.clear();

  for (let i = 0; i < keysToFlush.length; i++) {
    const key = keysToFlush[i];
    const dataToPersist = memoryStore.get(key);
    if (dataToPersist === undefined) continue;

    if (!indexedDbHydrated && Array.isArray(dataToPersist) && dataToPersist.length === 0) {
      // Keep it pending: it is re-evaluated right after hydration (see hydrateFromIndexedDB)
      dirtyKeys.add(key);
      continue;
    }

    const meta = cacheMetaStore.get(key) || { timestamp: Date.now(), version: 1 };
    const cacheEnvelope = {
      data: dataToPersist,
      timestamp: meta.timestamp,
      version: meta.version
    };

    // 1. IndexedDB write (completely independent of localStorage and outside its try/catch)
    set(key, cacheEnvelope)
      .catch(idbErr => console.warn(`[IndexedDB] Error setting ${key}:`, idbErr));

    // 2. localStorage write with 1MB size safety check for clothes
    try {
      let storageData = dataToPersist;
      if (key === STORAGE_KEYS.CLOTHES && Array.isArray(dataToPersist)) {
        storageData = dataToPersist.map((item: any) => {
          if (item && typeof item === 'object' && item.imageUrl && typeof item.imageUrl === 'string' && (item.thumbUrl || item.imageUrl.length > 20000)) {
            const copy = { ...item };
            delete copy.imageUrl;
            return copy;
          }
          return item;
        });
      }

      const payloadStr = JSON.stringify({
        data: storageData,
        timestamp: meta.timestamp,
        version: meta.version
      });

      // Large collections (> 1MB) are kept in IndexedDB only
      if (payloadStr.length > LOCAL_STORAGE_MAX_CHARS) {
        if ((import.meta as any).env?.DEV) {
          console.warn(`[localStorage] ${key} is ${(payloadStr.length / (1024 * 1024)).toFixed(2)} MB (> 1MB): stored in IndexedDB only.`);
        }
        markStoredInIndexedDbOnly(key);
      } else {
        localStorage.setItem(key, payloadStr);
      }
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        console.warn(`[localStorage quota exceeded for ${key}]. Skipping localStorage write (data is saved in IndexedDB).`);
        markStoredInIndexedDbOnly(key);
      } else {
        console.error(`Error flushing key ${key} to localStorage:`, e);
      }
    }
  }
}

// Non-blocking idle flush for localStorage disk I/O
function scheduleIdleStorageFlush() {
  if (idleFlushScheduled) return;
  idleFlushScheduled = true;

  const performFlush = () => {
    idleFlushScheduled = false;
    flushPendingStorageSynchronously();
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(performFlush, { timeout: 400 });
  } else {
    setTimeout(performFlush, 200);
  }
}

// Ensure pending writes are always committed before page refresh/exit
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingStorageSynchronously);
  window.addEventListener('pagehide', flushPendingStorageSynchronously);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingStorageSynchronously();
    }
  });
}

export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  perfMonitor.recordStorageRead(key);
  if (memoryStore.has(key)) {
    const memVal = memoryStore.get(key);
    if (Array.isArray(memVal) && memVal.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
      memoryStore.set(key, defaultValue);
      return defaultValue as T;
    }
    return memVal as T;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      memoryStore.set(key, defaultValue);
      cacheMetaStore.set(key, { timestamp: Date.now(), version: 1 });
      return defaultValue;
    }
    const env = parseStorageEnvelope<T>(raw, defaultValue);
    if (Array.isArray(env.data) && env.data.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
      memoryStore.set(key, defaultValue);
      cacheMetaStore.set(key, { 
        timestamp: Date.now(), 
        version: 1, 
        updatedAt: new Date().toISOString() 
      });
      lastWrittenRef.set(key, defaultValue);
      return defaultValue;
    }
    memoryStore.set(key, env.data);
    cacheMetaStore.set(key, { 
      timestamp: env.timestamp, 
      version: env.version, 
      updatedAt: env.updatedAt 
    });
    lastWrittenRef.set(key, env.data);
    return env.data;
  } catch (e) {
    console.error(`Error loading key ${key} from storage:`, e);
    memoryStore.set(key, defaultValue);
    cacheMetaStore.set(key, { timestamp: Date.now(), version: 1 });
    return defaultValue;
  }
};

export const getCachedCollection = <T>(key: string, defaultValue: T[] = []): CollectionCacheResult<T> => {
  const loaded = loadFromStorage<T[]>(key, defaultValue);
  const meta = cacheMetaStore.get(key);
  const timestamp = meta?.timestamp || Date.now();
  const isFresh = meta ? (Date.now() - meta.timestamp < DEFAULT_CACHE_TTL_MS) : false;
  return { data: loaded, isFresh, timestamp };
};

export const saveToStorage = <T>(key: string, data: T): void => {
  perfMonitor.recordStorageWrite(key);
  // If the exact same object/array reference is passed, avoid redundant work
  if (lastWrittenRef.get(key) === data) {
    return;
  }
  if ((import.meta as any).env?.DEV) {
    console.log(`[Storage Write] Saving collection / key: "${key}"`, { 
      itemCount: Array.isArray(data) ? data.length : 'non-array',
      timestamp: new Date().toISOString(),
      sampleIds: Array.isArray(data) ? data.slice(0, 3).map((item: any) => item?.id || 'no-id') : []
    });
  }
  lastWrittenRef.set(key, data);
  cacheMetaStore.set(key, { timestamp: Date.now(), version: 1, updatedAt: new Date().toISOString() });

  // Update in-memory cache instantly with 0ms latency
  memoryStore.set(key, data);
  dirtyKeys.add(key);

  // Schedule disk flush in background without blocking the UI thread
  scheduleIdleStorageFlush();
};

export const generateId = (): string => {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
};

/**
 * Wipes all stored collections cleanly to empty arrays.
 */
export const clearAllStorage = () => {
  const collections = [
    STORAGE_KEYS.CLOTHES,
    STORAGE_KEYS.RENTALS,
    STORAGE_KEYS.SALES,
    STORAGE_KEYS.EXPENSES,
    STORAGE_KEYS.CREDITS,
    STORAGE_KEYS.RAW_MATERIALS,
    STORAGE_KEYS.MAINTENANCE,
    STORAGE_KEYS.SUPPLIERS,
    STORAGE_KEYS.SEAMSTRESSES,
    STORAGE_KEYS.STAFF_MEMBERS,
    STORAGE_KEYS.STAFF_PAYOUTS,
    STORAGE_KEYS.STAFF_ABSENCES,
    STORAGE_KEYS.CAISSE_CLOSURES,
    STORAGE_KEYS.ACTIVITY_LOGS
  ];

  collections.forEach(key => {
    localStorage.setItem(key, JSON.stringify({ data: [], timestamp: Date.now(), version: 1 }));
    memoryStore.set(key, []);
    lastWrittenRef.set(key, []);
  });
};

/**
 * Initializes Core Data collections cleanly as empty sets.
 */
export const initializeStorage = () => {
  const RESET_VERSION = 'boutique_wipe_empty_v1';
  if (localStorage.getItem('boutique_empty_data_flag') !== RESET_VERSION) {
    clearAllStorage();
    localStorage.setItem('boutique_empty_data_flag', RESET_VERSION);
  }
};

/**
 * Asynchronously reads all collections from IndexedDB into memoryStore before initial cloud subscription (stale-while-revalidate pattern).
 */
export async function hydrateFromIndexedDB(): Promise<void> {
  try {
    await hydrateAllKeysFromIndexedDB();
  } finally {
    indexedDbHydrated = true;
    // Flush writes that were held back while hydration was running
    if (dirtyKeys.size > 0) scheduleIdleStorageFlush();
  }
}

async function hydrateAllKeysFromIndexedDB(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS);
  for (const key of keys) {
    try {
      const idbVal = await get(key);
      if (idbVal && idbVal.data) {
        const memVal = memoryStore.get(key);
        if (!memVal || (Array.isArray(memVal) && memVal.length === 0 && Array.isArray(idbVal.data) && idbVal.data.length > 0)) {
          memoryStore.set(key, idbVal.data);
          cacheMetaStore.set(key, {
            timestamp: idbVal.timestamp || Date.now(),
            version: idbVal.version || 1
          });
        }
      }
    } catch (err) {
      console.warn(`[IndexedDB Hydrate] Error reading ${key}:`, err);
    }
  }
}
