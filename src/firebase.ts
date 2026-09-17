import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection,
  enableIndexedDbPersistence 
} from 'firebase/firestore';
import { 
  getDatabase, 
  ref, 
  set, 
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

// Initialize Firestore & Realtime Database
export const db = getFirestore(firebaseApp);
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

  // 1. Try Firestore
  try {
    const docRef = doc(db, 'boutique_data', key);
    await setDoc(docRef, { 
      items: data,
      updatedAt: new Date().toISOString(),
      updatedByDevice: navigator.userAgent
    }, { merge: true });
    success = true;
  } catch (firestoreError: any) {
    console.warn(`[Firebase Firestore save error on ${key}]:`, firestoreError?.message || firestoreError);
  }

  // 2. Also try Realtime Database (RTDB) as reliable parallel cloud sync
  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    await set(rtdbRef, {
      items: data,
      updatedAt: new Date().toISOString()
    });
    success = true;
  } catch (rtdbError: any) {
    console.warn(`[Firebase RTDB save error on ${key}]:`, rtdbError?.message || rtdbError);
  }

  if (success) {
    updateStatus('connected');
  } else {
    updateStatus('error', 'تعذر حفظ البيانات في السحابة - يرجى التحقق من الاتصال');
  }

  return success;
}

/**
 * Subscribe to real-time changes on a specific key from Firebase
 */
export function subscribeToFirebaseKey<T>(
  key: string, 
  onDataReceived: (data: T) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;
  let unsubRTDB: (() => void) | null = null;

  // Try Firestore Listener
  try {
    const docRef = doc(db, 'boutique_data', key);
    unsubFirestore = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.data();
        if (val && val.items !== undefined) {
          // Check if this was a recent local write echo (within 2 seconds)
          const lastWrite = pendingLocalWrites.get(key) || 0;
          if (Date.now() - lastWrite > 1200) {
            onDataReceived(val.items as T);
            updateStatus('connected');
          }
        }
      }
    }, (err) => {
      console.warn(`[Firestore listener error for ${key}]:`, err.message);
    });
  } catch (e) {
    console.warn(`[Firestore subscribe failed for ${key}]:`, e);
  }

  // Try Realtime Database Listener as backup/parallel sync
  try {
    const rtdbRef = ref(rtdb, `boutique_store/${key}`);
    unsubRTDB = onValue(rtdbRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val && val.items !== undefined) {
          const lastWrite = pendingLocalWrites.get(key) || 0;
          if (Date.now() - lastWrite > 1200) {
            onDataReceived(val.items as T);
            updateStatus('connected');
          }
        }
      }
    }, (err) => {
      console.warn(`[RTDB listener error for ${key}]:`, err.message);
    });
  } catch (e) {
    console.warn(`[RTDB subscribe failed for ${key}]:`, e);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (unsubRTDB) unsubRTDB();
  };
}

/**
 * Fetch initial cloud state for all keys once
 */
export async function fetchInitialFirebaseData<T>(key: string): Promise<T | null> {
  // 1. Try Firestore first
  try {
    const docRef = doc(db, 'boutique_data', key);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.items !== undefined) {
      return snap.data().items as T;
    }
  } catch (e) {
    console.warn(`[Firestore initial fetch failed for ${key}]:`, e);
  }

  // 2. Try RTDB
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
  CAISSE_CLOSURES: 'boutique_caisse_closures',
  STORE_CONFIG: 'boutique_store_config'
};

// Aliases for compatibility
export const syncCollectionToCloud = saveToFirebase;
export const subscribeToCloudCollection = subscribeToFirebaseKey;
