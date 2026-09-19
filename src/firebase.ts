import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  push, 
  get, 
  onValue 
} from 'firebase/database';

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

// Initialize Realtime Database only
export const rtdb = getDatabase(firebaseApp);

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

function updateStatus(status: SyncStatus, error?: string) {
  currentStatus = status;
  if (status === 'connected') {
    lastSyncedTime = new Date();
    lastErrorMessage = undefined;
  }
  if (error) {
    lastErrorMessage = error;
  }
  listeners.forEach((l) => l(currentStatus, lastSyncedTime, lastErrorMessage));
}

// Keep track of locally initiated writes to avoid echo re-renders
const pendingLocalWrites = new Map<string, number>();

/**
 * Save collection data to Firebase (saves to both Firestore & Realtime Database for maximum compatibility)
 */
export async function saveToFirebase<T>(key: string, data: T): Promise<boolean> {
  updateStatus('syncing');
  const now = Date.now();
  pendingLocalWrites.set(key, now);

  let success = false;

  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    const cleanData = JSON.parse(JSON.stringify(data));
    
    await set(rtdbRef, {
      items: cleanData,
      updatedAt: new Date().toISOString()
    });
    success = true;
  } catch (rtdbError: any) {
    console.warn(`[Firebase RTDB save error on ${key}]:`, rtdbError?.message || rtdbError);
    if (rtdbError?.message?.includes('Permission denied')) {
      alert('خطأ في الصلاحيات (Realtime Database): الرجاء تعديل قواعد الأمان في Firebase.');
    }
  }

  if (success) {
    updateStatus('connected');
  } else {
    updateStatus('error', 'تعذر حفظ البيانات في السحابة - يرجى التحقق من الاتصال');
  }

  return success;
}

/**
 * Incrementally update specific fields in Firebase database using native update()
 */
export async function updateInFirebase<T extends object>(key: string, updates: Partial<T>): Promise<boolean> {
  updateStatus('syncing');
  const now = Date.now();
  pendingLocalWrites.set(key, now);

  try {
    const storeRef = ref(rtdb, `boutique_store/${key}`);
    const cleanUpdates: Record<string, any> = {};
    Object.keys(updates).forEach(field => {
      cleanUpdates[field] = (updates as any)[field];
    });
    cleanUpdates.updatedAt = new Date().toISOString();

    await update(storeRef, cleanUpdates);
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB update error on ${key}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر تحديث البيانات في السحابة');
    return false;
  }
}

/**
 * Push a new record into a collection using native push()
 */
export async function pushToFirebase<T>(key: string, newItem: T): Promise<boolean> {
  updateStatus('syncing');
  const now = Date.now();
  pendingLocalWrites.set(key, now);

  try {
    const itemsRef = ref(rtdb, `boutique_store/${key}/items`);
    const newRef = push(itemsRef);
    await set(newRef, JSON.parse(JSON.stringify(newItem)));
    await update(ref(rtdb, `boutique_store/${key}`), {
      updatedAt: new Date().toISOString()
    });
    updateStatus('connected');
    return true;
  } catch (err: any) {
    console.warn(`[Firebase RTDB push error on ${key}]:`, err?.message || err);
    updateStatus('error', err?.message || 'تعذر إضافة العنصر السحابي');
    return false;
  }
}

/**
 * Subscribe to real-time changes on a specific key from Firebase
 */
export function subscribeToFirebaseKey<T>(
  key: string, 
  onDataReceived: (data: T) => void
): () => void {
  let unsubRTDB: (() => void) | null = null;

  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    unsubRTDB = onValue(rtdbRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const lastWrite = pendingLocalWrites.get(key) || 0;
        if (Date.now() - lastWrite > 1200) {
          if (val && val.items !== undefined) {
            onDataReceived(val.items as T);
          } else {
            onDataReceived([] as unknown as T);
          }
          updateStatus('connected');
        }
      } else {
        const lastWrite = pendingLocalWrites.get(key) || 0;
        if (Date.now() - lastWrite > 1200) {
          onDataReceived([] as unknown as T);
        }
      }
    }, (err: any) => {
      console.warn(`[RTDB listener error for ${key}]:`, err.message);
    });
  } catch (e) {
    console.warn(`[RTDB subscribe failed for ${key}]:`, e);
  }

  return () => {
    if (unsubRTDB) unsubRTDB();
  };
}

/**
 * Fetch initial cloud state for all keys once
 */
export async function fetchInitialFirebaseData<T>(key: string): Promise<T | null> {
  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    const snap = await get(rtdbRef);
    if (snap.exists() && snap.val()?.items !== undefined) {
      return snap.val().items as T;
    }
  } catch (e) {
    console.warn(`[RTDB initial fetch failed for ${key}]:`, e);
  }
  return null;
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
  STORE_CONFIG: 'boutique_store_config'
};

// Aliases for compatibility
export const syncCollectionToCloud = saveToFirebase;
export const subscribeToCloudCollection = subscribeToFirebaseKey;
