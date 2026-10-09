import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  remove, 
  onValue, 
  off,
  query,
  limitToLast,
  get,
  orderByChild,
  orderByKey,
  equalTo,
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

// Firebase Realtime Database
const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);

// أسماء المجموعات: كل سجل مستند مستقل بمفتاح /مجموعة/{المعرف}
export const FIREBASE_COLLECTIONS = {
  CLOTHES: 'clothes',
  RENTALS: 'rentals',
  SALES: 'sales',
  EXPENSES: 'expenses',
  CREDITS: 'credits',
  CREDIT_PAYMENTS: 'creditPayments',
  STAFF_PAYOUTS: 'staffPayouts',
  STAFF_MEMBERS: 'staffMembers',
  STAFF_ABSENCES: 'staffAbsences',
  MAINTENANCE: 'maintenanceOrders',
  SUPPLIERS: 'suppliers',
  SEAMSTRESSES: 'seamstresses',
  SEAMSTRESS_WORKS: 'seamstressWorks',
  RAW_MATERIALS: 'rawMaterials',
  CAISSE_CLOSURES: 'caisseClosures',
  ACTIVITY_LOGS: 'activityLogs',
  CLOTH_THUMBS: 'clothThumbs',
  CLOTH_IMAGES: 'clothImages',
  SETTINGS: 'appSettings'
} as const;

export type FirebaseCollectionKey = typeof FIREBASE_COLLECTIONS[keyof typeof FIREBASE_COLLECTIONS];

// مقارنة مصفوفات سريعة O(N) بدون JSON.stringify (المعرف + الحقول القابلة للتغيير)
export function areArraysEqual<T extends { id?: string; updatedAt?: string | number }>(
  a: T[] | undefined | null, 
  b: T[] | undefined | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;

  if (a[0]?.id !== b[0]?.id) return false;
  if (a[a.length - 1]?.id !== b[b.length - 1]?.id) return false;

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

// إزالة القيم غير المعرّفة قبل الكتابة حتى لا يرفضها Firebase
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

// كتابة مستند واحد فقط في /مجموعة/{المعرف} دون لمس بقية المستندات
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

// حذف مستند واحد مع نسخة احتياطية في /trash قبل الحذف
export async function deleteItemFromFirebase(collectionKey: string, itemId: string): Promise<void> {
  if (!itemId) return;
  try {
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

    const collectionRef = ref(rtdb, collectionKey);
    await update(collectionRef, { [itemId]: null });
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

// نسخة احتياطية كاملة: لقطة واحدة متزامنة من جذر القاعدة (قراءة واحدة بدل عشرات) ثم تنزيل JSON
export async function downloadFullFirebaseBackupDirect(): Promise<FirebaseBackupReport> {
  const snapshot = await get(ref(rtdb));
  const rootVal: any = snapshot.exists() ? snapshot.val() : {};
  const backupData: Record<string, any> = {};
  const counts: Record<string, number> = {};

  const toItems = (val: any): any[] => {
    if (!val || typeof val !== 'object') return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return Object.keys(val)
      .map(k => {
        const item = val[k];
        return item && typeof item === 'object' ? { ...item, id: item.id || k } : null;
      })
      .filter(Boolean);
  };

  for (const col of Object.values(FIREBASE_COLLECTIONS)) {
    const items = toItems(rootVal?.[col]);
    backupData[col] = items;
    counts[col] = items.length;
  }

  for (const extra of ['clothImages', 'clothThumbs', 'trash']) {
    const val = rootVal?.[extra];
    backupData[extra] = val || {};
    counts[extra] = val && typeof val === 'object' ? Object.keys(val).length : 0;
  }

  const report: FirebaseBackupReport = {
    timestamp: new Date().toISOString(),
    counts,
    verified: true,
    data: backupData
  };

  const jsonStr = JSON.stringify(report, null, 2);
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

export interface CollectionPageOptions {
  limit?: number;
  cursor?: string | null;
}

export interface CollectionPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// قراءة صفحة واحدة فقط من مجموعة كبيرة (مؤشر حسب المفتاح) دون تنزيل المجموعة كاملة
export async function fetchCollectionPage<T extends { id?: string }>(
  collectionKey: string,
  options: CollectionPageOptions = {}
): Promise<CollectionPage<T>> {
  const pageSize = Math.max(1, Math.min(options.limit || 5, 100));
  const cursor = options.cursor || null;

  try {
    const constraints: any[] = [orderByKey()];
    if (cursor) constraints.push(endAt(cursor));
    constraints.push(limitToLast(pageSize + 1 + (cursor ? 1 : 0)));

    const snapshot = await get(query(ref(rtdb, collectionKey), ...constraints));
    if (!snapshot.exists()) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const value = snapshot.val();
    const entries: Array<{ key: string; item: T }> = [];
    if (Array.isArray(value)) {
      value.forEach((item: T, index: number) => {
        if (item && typeof item === 'object') {
          entries.push({ key: String(item.id || index), item: { ...item, id: item.id || String(index) } });
        }
      });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(key => {
        const item = value[key];
        if (item && typeof item === 'object') {
          entries.push({ key, item: { ...item, id: item.id || key } });
        }
      });
    }

    // endAt() is inclusive so the cursor must not be returned twice.
    const withoutCursor = cursor ? entries.filter(entry => entry.key !== cursor) : entries;
    withoutCursor.sort((a, b) => a.key.localeCompare(b.key));
    const hasMore = withoutCursor.length > pageSize;
    const pageEntries = withoutCursor.slice(-pageSize).reverse();

    return {
      items: pageEntries.map(entry => entry.item),
      nextCursor: pageEntries.length > 0 ? pageEntries[pageEntries.length - 1].key : null,
      hasMore
    };
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to fetch page for ${collectionKey}:`, error);
    return { items: [], nextCursor: null, hasMore: false };
  }
}

// بحث مباشر عن قطعة واحدة بالباركود عبر فهرس القاعدة (سجل واحد فقط عبر الشبكة)
export async function fetchClothByBarcode(barcode: string): Promise<any | null> {
  if (!barcode) return null;
  const clean = barcode.trim().toLowerCase();
  if (!clean) return null;

  try {
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

// دمج مستندات مجموعة كاملة في السحابة (للنسخ الاحتياطي والاستعادة فقط) — تجاهل المصفوفات الفارغة حمايةً للبيانات
export async function syncCollectionToCloud<T extends { id?: string }>(
  collectionKey: string, 
  items: T[]
): Promise<void> {
  if (!items || !Array.isArray(items) || items.length === 0) return;
  try {
    const colRef = ref(rtdb, collectionKey);
    const mapObj: Record<string, T> = {};
    items.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const key = item.id || `idx_${idx}`;
        mapObj[key] = sanitizeForFirebase({ ...item, updatedAt: (item as any).updatedAt || new Date().toISOString() });
      }
    });
    const entries = Object.entries(mapObj);
    const CHUNK_SIZE = 50;
    const MAX_PARALLEL_WRITES = 3;
    for (let start = 0; start < entries.length; start += CHUNK_SIZE * MAX_PARALLEL_WRITES) {
      const chunkPromises: Promise<void>[] = [];
      for (let offset = 0; offset < MAX_PARALLEL_WRITES; offset++) {
        const chunkStart = start + offset * CHUNK_SIZE;
        if (chunkStart >= entries.length) break;
        const chunk = Object.fromEntries(entries.slice(chunkStart, chunkStart + CHUNK_SIZE));
        chunkPromises.push(update(colRef, chunk));
      }
      await Promise.all(chunkPromises);
    }
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to merge sync collection ${collectionKey}:`, error);
  }
}

// ترحيل الدفعات المضمّنة داخل مستندات الديون القديمة إلى مجموعة مستندات مستقلة /creditPayments
// العملية آمنة ومتكررة بدون تكرار بيانات لأن مفتاح كل دفعة هو معرفها الأصلي
export async function migrateEmbeddedCreditPayments(creditsWithEmbedded: Array<{ id: string; payments?: any[] }>): Promise<void> {
  if (!creditsWithEmbedded || creditsWithEmbedded.length === 0) return;
  try {
    const paymentsUpdate: Record<string, any> = {};
    const creditsUpdate: Record<string, any> = {};
    const now = new Date().toISOString();

    for (const credit of creditsWithEmbedded) {
      if (!credit?.id || !Array.isArray(credit.payments) || credit.payments.length === 0) continue;
      for (const payment of credit.payments) {
        if (!payment || typeof payment !== 'object' || !payment.id) continue;
        paymentsUpdate[payment.id] = sanitizeForFirebase({
          ...payment,
          creditId: credit.id,
          createdAt: payment.createdAt || now
        });
      }
      creditsUpdate[`${credit.id}/payments`] = null;
    }

    if (Object.keys(paymentsUpdate).length > 0) {
      await update(ref(rtdb, FIREBASE_COLLECTIONS.CREDIT_PAYMENTS), paymentsUpdate);
    }
    if (Object.keys(creditsUpdate).length > 0) {
      await update(ref(rtdb, FIREBASE_COLLECTIONS.CREDITS), creditsUpdate);
    }
  } catch (error) {
    console.warn('[Firebase RTDB] Failed to migrate embedded credit payments:', error);
  }
}

// جلب كل المحذوفات مؤقتاً من /trash
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

// استرجاع مستند من السلة إلى مجموعته الأصلية
export async function restoreItemFromTrash(collectionKey: string, itemId: string): Promise<boolean> {
  try {
    const trashItemRef = ref(rtdb, `trash/${collectionKey}/${itemId}`);
    const snapshot = await get(trashItemRef);
    if (!snapshot.exists()) return false;
    const itemData = snapshot.val();
    const { originalCollection, deletedAt, ...restoredData } = itemData;

    const targetCollectionRef = ref(rtdb, collectionKey);
    await update(targetCollectionRef, { [itemId]: sanitizeForFirebase({ ...restoredData, updatedAt: new Date().toISOString() }) });

    await remove(trashItemRef);
    return true;
  } catch (err) {
    console.error('Failed to restore item from trash:', err);
    return false;
  }
}

// حذف نهائي للمحذوفات الأقدم من عدد أيام محدد (افتراضياً 30 يوماً)
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

// مدير اشتراكات موحّد: مستمع واحد فقط لكل مجموعة، مع عدّاد مستهلكين وإلغاء تلقائي
export class SubscriptionManager {
  private static activeSubscriptions = new Map<string, ActiveSubscriptionEntry>();

  static subscribe<T extends { id?: string }>(
    collectionKey: string,
    callback: (items: T[]) => void,
    options?: { limit?: number; sort?: boolean }
  ): () => void {
    const subKey = options?.limit && options.limit > 0 ? `${collectionKey}_limit_${options.limit}` : collectionKey;
    let entry = this.activeSubscriptions.get(subKey);

    if (entry) {
      entry.callbacks.add(callback);
      if (entry.lastData !== null) {
        try {
          callback(entry.lastData);
        } catch (err) {
          console.error(`[SubscriptionManager] Callback error on ${subKey}:`, err);
        }
      }
    } else {
      const callbacks = new Set<(items: any[]) => void>();
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
              if (item && typeof item === 'object') {
                if (!item.id) item.id = k;
                return item;
              }
              return null;
            }).filter(Boolean);
          }

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

    let isUnsubscribed = false;
    return () => {
      if (isUnsubscribed) return;
      isUnsubscribed = true;

      const activeEntry = SubscriptionManager.activeSubscriptions.get(subKey);
      if (!activeEntry) return;

      activeEntry.callbacks.delete(callback);

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

  // اشتراك بأحداث الأبناء (إضافة/تعديل/حذف) لتفادي إعادة تنزيل المجموعة كاملة عند كل تغيير
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

  static getActiveSubscriptionsCount(): number {
    return this.activeSubscriptions.size;
  }

  static getActiveCollections(): string[] {
    return Array.from(this.activeSubscriptions.keys());
  }

  // مراقبة حالة الاتصال بالقاعدة عبر .info/connected
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
