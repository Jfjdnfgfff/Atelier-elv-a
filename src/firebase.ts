import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  remove, 
  onValue, 
  off
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

// Initialize Firebase Realtime Database
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
 * Compares two arrays shallowly or by JSON content to prevent unnecessary re-renders.
 */
export function areArraysEqual<T>(a: T[] | undefined | null, b: T[] | undefined | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Saves a single document to Firebase Realtime Database
 */
export async function saveItemToFirebase<T extends { id: string }>(collectionKey: string, item: T): Promise<void> {
  try {
    const itemRef = ref(rtdb, `${collectionKey}/${item.id}`);
    await set(itemRef, item);
  } catch (error) {
    console.warn(`[Firebase Realtime Database] Failed to save item in ${collectionKey}/${item.id}:`, error);
  }
}

/**
 * Updates a single document in Firebase Realtime Database
 */
export async function updateItemInFirebase(collectionKey: string, itemId: string, updates: Record<string, any>): Promise<void> {
  try {
    const itemRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await update(itemRef, updates);
  } catch (error) {
    console.warn(`[Firebase Realtime Database] Failed to update item in ${collectionKey}/${itemId}:`, error);
  }
}

/**
 * Deletes a single document from Firebase Realtime Database
 */
export async function deleteItemFromFirebase(collectionKey: string, itemId: string): Promise<void> {
  try {
    const itemRef = ref(rtdb, `${collectionKey}/${itemId}`);
    await remove(itemRef);
  } catch (error) {
    console.warn(`[Firebase Realtime Database] Failed to delete item in ${collectionKey}/${itemId}:`, error);
  }
}

/**
 * Synchronizes an entire collection array to Firebase Realtime Database
 */
export async function syncCollectionToCloud<T extends { id?: string }>(collectionKey: string, items: T[]): Promise<void> {
  try {
    const colRef = ref(rtdb, collectionKey);
    const mapObj: Record<string, T> = {};
    items.forEach((item, idx) => {
      const key = item.id || `idx_${idx}`;
      mapObj[key] = item;
    });
    await set(colRef, mapObj);
  } catch (error) {
    console.warn(`[Firebase Realtime Database] Failed to sync collection ${collectionKey}:`, error);
  }
}

/**
 * Subscription Manager for real-time synchronization
 */
export class SubscriptionManager {
  static subscribe<T extends { id?: string }>(
    collectionKey: string,
    callback: (items: T[]) => void
  ): () => void {
    const colRef = ref(rtdb, collectionKey);
    const listener = (snapshot: any) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        let items: T[] = [];
        if (Array.isArray(val)) {
          items = val.filter(Boolean);
        } else if (typeof val === 'object' && val !== null) {
          items = Object.values(val);
        }
        callback(items);
      } else {
        callback([]);
      }
    };

    onValue(colRef, listener, (error) => {
      console.warn(`[Firebase Realtime Database] Listener error on ${collectionKey}:`, error);
    });

    return () => {
      off(colRef, 'value', listener);
    };
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
