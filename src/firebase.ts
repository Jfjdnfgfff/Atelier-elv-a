import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  remove, 
  onValue, 
  get, 
  child,
  connectDatabaseEmulator
} from 'firebase/database';
import appletConfig from '../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  databaseURL: appletConfig.databaseURL || "https://ateliu-14e23-default-rtdb.firebaseio.com",
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
  measurementId: appletConfig.measurementId || ""
};

// Initialize Firebase App singleton
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Realtime Database instance
export const db = getDatabase(firebaseApp);

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
    statusListeners.forEach((l) => {
      try {
        l(currentStatus, lastSyncedTime, lastErrorMessage);
      } catch (e) {
        // Ignore
      }
    });
  }, 100);
}

// Track connection state natively using Firebase Realtime Database info path
try {
  onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) {
      updateStatus('connected');
    } else {
      updateStatus('offline');
    }
  }, (err) => {
    console.warn('[RTDB Connection status error]:', err);
  });
} catch (e) {
  // Ignore in ssr/restricted environments
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

// Memory caching for offline first and zero latency performance
const canonicalStoreCache = new Map<string, Map<string, any>>();
const memoryCache = new Map<string, any[]>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000;

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
  return JSON.parse(JSON.stringify(data, (_, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

// Parse RTDB snapshot to a clean array
export function parseSnapshotToArray<T extends { id?: string }>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.filter(Boolean).map((item, index) => ({
      id: item.id || `rec_${index}`,
      ...item
    })) as T[];
  }
  if (typeof val === 'object') {
    const arr: T[] = [];
    Object.keys(val).forEach((id) => {
      if (val[id]) {
        arr.push({ id, ...val[id] });
      }
    });
    return arr;
  }
  return [];
}

const pendingItemWrites = new Map<string, number>();

// ----------------- RTDB CRUD OPERATIONS -----------------

// Save a single item at path: key/itemId
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
  colStore.set(item.id, item);

  let currentArr = memoryCache.get(collectionKey) || [];
  const idx = currentArr.findIndex((x: any) => x && x.id === item.id);
  if (idx < 0) {
    setMemoryCacheEntry(collectionKey, [item, ...currentArr]);
  } else {
    const nextArr = [...currentArr];
    nextArr[idx] = item;
    setMemoryCacheEntry(collectionKey, nextArr);
  }

  updateStatus('syncing');

  try {
    const cleanItem = sanitizeForFirebase(item);
    await set(ref(db, `${collectionKey}/${item.id}`), cleanItem);
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.error(`[RTDB save error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حفظ البيانات');
    throw err;
  }
}

// Update single item at path: key/itemId
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
  const prev = colStore.get(itemId);
  if (prev) {
    const merged = { ...prev, ...updates };
    colStore.set(itemId, merged);
    
    let currentArr = memoryCache.get(collectionKey) || [];
    const idx = currentArr.findIndex((x: any) => x && x.id === itemId);
    if (idx >= 0) {
      const nextArr = [...currentArr];
      nextArr[idx] = merged;
      setMemoryCacheEntry(collectionKey, nextArr);
    }
  }

  updateStatus('syncing');

  try {
    const cleanUpdates = sanitizeForFirebase(updates);
    await update(ref(db, `${collectionKey}/${itemId}`), cleanUpdates);
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.error(`[RTDB update error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر تحديث البيانات');
    throw err;
  }
}

// Remove single item at path: key/itemId
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
  setMemoryCacheEntry(collectionKey, currentArr.filter((x: any) => x && x.id !== itemId));

  updateStatus('syncing');

  try {
    await remove(ref(db, `${collectionKey}/${itemId}`));
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.error(`[RTDB delete error on ${writeKey}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حذف البيانات');
    throw err;
  }
}

// Sync bulk collection (e.g. migration or backup)
export async function saveCollectionToFirebase<T extends { id?: string }>(
  key: string,
  data: T[]
): Promise<boolean> {
  if (!Array.isArray(data)) return false;

  updateStatus('syncing');
  pendingItemWrites.set(key, Date.now());

  try {
    const mapObj: Record<string, any> = {};
    data.forEach((item, index) => {
      const id = item.id || `rec_${index}`;
      mapObj[id] = sanitizeForFirebase(item);
    });

    await set(ref(db, key), mapObj);
    setMemoryCacheEntry(key, data);
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.error(`[RTDB save collection error on ${key}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر حفظ المجموعة');
    return false;
  }
}

export const syncCollectionToCloud = saveCollectionToFirebase;

// ----------------- SUBSCRIPTION LISTENERS -----------------

export function subscribeToFirebaseKey<T extends { id?: string }>(
  key: string,
  onDataReceived: (data: T[]) => void
): () => void {
  // Try immediate cache load
  if (memoryCache.has(key)) {
    onDataReceived(memoryCache.get(key) as T[]);
  } else {
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

  // Set up real-time listener
  const unsub = onValue(ref(db, key), (snapshot) => {
    const lastWrite = pendingItemWrites.get(key) || 0;
    if (Date.now() - lastWrite > 800) {
      const parsedArray = parseSnapshotToArray<T>(snapshot.val());
      
      let colStore = canonicalStoreCache.get(key);
      if (!colStore) {
        colStore = new Map<string, any>();
        canonicalStoreCache.set(key, colStore);
      }

      const normalized: T[] = [];
      parsedArray.forEach(item => {
        if (item && item.id) {
          const prev = colStore!.get(item.id);
          if (prev && isShallowEqual(prev, item)) {
            normalized.push(prev);
          } else {
            colStore!.set(item.id, item);
            normalized.push(item);
          }
        } else {
          normalized.push(item);
        }
      });

      const current = memoryCache.get(key) || [];
      if (!isArrayIdentical(current, normalized)) {
        setMemoryCacheEntry(key, normalized);
        onDataReceived(normalized);
      }
    }
  }, (err) => {
    console.error(`[RTDB subscribe error for ${key}]:`, err);
    updateStatus('error', err.message);
  });

  return unsub;
}

export async function getCachedOrFetchData<T extends { id?: string }>(
  key: string,
  maxAgeMs: number = CACHE_TTL_MS
): Promise<T[]> {
  const cached = memoryCache.get(key);
  const ts = cacheTimestamps.get(key) || 0;
  if (cached && cached.length > 0 && Date.now() - ts < maxAgeMs) {
    return cached as T[];
  }

  try {
    const snap = await get(ref(db, key));
    const normalized = parseSnapshotToArray<T>(snap.val());
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
  return getCachedOrFetchData<T>(key);
}

export const subscribeToCloudCollection = subscribeToFirebaseKey;
export const saveToFirebase = saveCollectionToFirebase;

export class SubscriptionManager {
  private static activeSubs = new Map<string, () => void>();

  static subscribe<T extends { id?: string }>(
    key: string,
    callback: (data: T[]) => void
  ): () => void {
    const unsub = subscribeToFirebaseKey<T>(key, callback);
    this.activeSubs.set(key, unsub);
    return unsub;
  }

  static unsubscribe(key: string): void {
    const unsub = this.activeSubs.get(key);
    if (unsub) {
      unsub();
      this.activeSubs.delete(key);
    }
  }

  static isSubscribed(key: string): boolean {
    return this.activeSubs.has(key);
  }

  static getActiveListenerCount(): number {
    return this.activeSubs.size;
  }
}

export async function clearAllFirebaseData(): Promise<void> {
  // Implemented only for user manual clearing (respecting the "mmnوع" rule for automatic runs)
  try {
    const keys = Object.values(FIREBASE_COLLECTIONS);
    for (const k of keys) {
      await remove(ref(db, k));
    }
    localStorage.clear();
    memoryCache.clear();
    cacheTimestamps.clear();
    canonicalStoreCache.clear();
  } catch (e) {
    console.error('Error clearing RTDB data:', e);
  }
}

// ----------------- STARTUP CONNECTION CHECK -----------------

export async function testConnectionOnStartup(): Promise<boolean> {
  console.log("=== Testing Realtime Database Connection ===");
  try {
    const testRef = ref(db, 'boutique_store/connection_test');
    await set(testRef, {
      lastTestTimestamp: new Date().toISOString(),
      status: "connected_successfully",
      agent: "ai-studio-agent"
    });
    console.log("  [SUCCESS] RTDB connection check: Write OK!");
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.error("  [FAILED] RTDB connection check:", err.message || err);
    updateStatus('error', err.message);
    return false;
  }
}

// Run connection check instantly
testConnectionOnStartup().catch(console.error);
