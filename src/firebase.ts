import { initializeApp } from 'firebase/app';
import {
  clearQueuedWrite,
  getQueuedWrites,
  queueFailedWrite
} from './utils/writeOutbox';
import {
  clearJournalEntry,
  getJournalEntries,
  hasJournalEntries,
  isCloudNewerThanJournal,
  journalDelete,
  journalSave,
  journalUpdate,
  markJournalAttempt
} from './utils/durableJournal';
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
  limitToFirst,
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
import {
  dataPath,
  legacyPath,
  cacheMetaPath,
  searchIndexPath,
  systemPath,
  MIRROR_WRITES_TO_LEGACY_PATH
} from './data/paths';
import { setKnownRevision } from './utils/cachePolicy';
import { storageKeyForCollection } from './data/collectionStorageKeys';
import {
  buildSearchIndexRecord,
  type SearchIndexRecord
} from './utils/searchIndexCore';

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

// ---------------------------------------------------------------------------
// حالة تنظيم المسارات: بعد اكتمال الترحيل نقرأ/نكتب على المسارات المنظّمة فقط
// ---------------------------------------------------------------------------
let namespacedLayoutReady = false;
const resolvedReadPaths = new Map<string, string>();

export function markNamespacedLayoutReady(ready: boolean = true): void {
  namespacedLayoutReady = ready;
  resolvedReadPaths.clear();
}
export function isNamespacedLayoutReady(): boolean {
  return namespacedLayoutReady;
}

// ---------------------------------------------------------------------------
// بصمات التعديل (Cache invalidation): كل كتابة ناجحة ترفع بصمة المجموعة
// في /system/cacheMeta/{collection} بعد تجميعها (debounce) لتقليل الكتابات.
// ---------------------------------------------------------------------------
const pendingRevisionBumps = new Map<string, number>();
const revisionBumpTimers = new Map<string, ReturnType<typeof setTimeout>>();

function bumpCacheRevision(collectionKey: string): void {
  const revision = Date.now();
  pendingRevisionBumps.set(collectionKey, revision);

  const storageKey = storageKeyForCollection(collectionKey);
  if (storageKey) setKnownRevision(storageKey, revision);

  const existing = revisionBumpTimers.get(collectionKey);
  if (existing) clearTimeout(existing);

  revisionBumpTimers.set(collectionKey, setTimeout(() => {
    revisionBumpTimers.delete(collectionKey);
    const latest = pendingRevisionBumps.get(collectionKey);
    if (!latest) return;
    pendingRevisionBumps.delete(collectionKey);
    set(ref(rtdb, cacheMetaPath(collectionKey)), {
      revision: latest,
      updatedAt: new Date().toISOString()
    }).catch((error) => {
      console.warn(`[Cache] Failed to bump revision for ${collectionKey}:`, error);
    });
  }, 1200));
}

/**
 * كتابة صورة/مصغّرة على المسار المنظّم + نسخة على المسار القديم أثناء الانتقال.
 * الصور لا تُبطل كاش المجموعات (لها مخزنها الخاص LRU + IndexedDB).
 */
export async function writeBinaryWithMirror(
  entity: 'clothThumbs' | 'clothImages',
  id: string,
  payload: Record<string, any>
): Promise<void> {
  const clean = sanitizeForFirebase(payload);
  await set(ref(rtdb, `${dataPath(entity)}/${id}`), clean);
  if (MIRROR_WRITES_TO_LEGACY_PATH) {
    set(ref(rtdb, `${legacyPath(entity)}/${id}`), clean).catch(() => {});
  }
}

/** قراءة صورة/مصغّرة مع الرجوع تلقائياً للمسار القديم */
export async function readBinaryWithFallback(
  entity: 'clothThumbs' | 'clothImages',
  id: string
): Promise<any | null> {
  try {
    const snapshot = await get(ref(rtdb, `${dataPath(entity)}/${id}`));
    if (snapshot.exists()) return snapshot.val();
  } catch (error) {
    console.warn(`[Binaries] Canonical read failed for ${entity}/${id}:`, error);
  }
  try {
    const snapshot = await get(ref(rtdb, `${legacyPath(entity)}/${id}`));
    if (snapshot.exists()) return snapshot.val();
  } catch {
    // لا شيء
  }
  return null;
}

export async function removeBinaryWithMirror(
  entity: 'clothThumbs' | 'clothImages',
  id: string
): Promise<void> {
  await remove(ref(rtdb, `${dataPath(entity)}/${id}`));
  if (MIRROR_WRITES_TO_LEGACY_PATH) {
    remove(ref(rtdb, `${legacyPath(entity)}/${id}`)).catch(() => {});
  }
}

/**
 * المسار المعتمد للقراءة من مجموعة. إذا لم يكتمل الترحيل بعد وكانت البيانات
 * القديمة فقط موجودة، يقع الرجوع تلقائياً إلى الجذر المسطّح.
 */
async function resolveReadPath(collectionKey: string): Promise<string> {
  const canonical = dataPath(collectionKey);
  if (namespacedLayoutReady) return canonical;

  const cached = resolvedReadPaths.get(collectionKey);
  if (cached) return cached;

  try {
    const canonicalSnap = await get(ref(rtdb, canonical));
    if (canonicalSnap.exists()) {
      resolvedReadPaths.set(collectionKey, canonical);
      return canonical;
    }
    const legacySnap = await get(ref(rtdb, legacyPath(collectionKey)));
    if (legacySnap.exists()) {
      resolvedReadPaths.set(collectionKey, legacyPath(collectionKey));
      return legacyPath(collectionKey);
    }
  } catch (error) {
    console.warn(`[Layout] Path resolution failed for ${collectionKey}:`, error);
  }
  return canonical;
}

// ---------------------------------------------------------------------------
// فهرس البحث السحابي (مخفّف: بلا صور) — يُكتب مع كل تعديل لقطعة
// ---------------------------------------------------------------------------
export async function pushInventorySearchIndex(item: any): Promise<void> {
  if (!item || !item.id) return;
  try {
    const record = buildSearchIndexRecord(item);
    await set(ref(rtdb, `${searchIndexPath('clothes')}/${item.id}`), record);
  } catch (error) {
    console.warn(`[SearchIndex] Failed to index cloth ${item.id}:`, error);
  }
}

export async function removeInventorySearchIndex(itemId: string): Promise<void> {
  if (!itemId) return;
  try {
    await remove(ref(rtdb, `${searchIndexPath('clothes')}/${itemId}`));
  } catch (error) {
    console.warn(`[SearchIndex] Failed to remove index for ${itemId}:`, error);
  }
}

/** تحميل فهرس المخزون المخفّف كاملاً (بحث فوري في كل المخزون دون تحميل السجلات) */
export async function fetchInventorySearchIndex(): Promise<SearchIndexRecord[]> {
  try {
    const snapshot = await get(ref(rtdb, searchIndexPath('clothes')));
    if (!snapshot.exists()) return [];
    const value = snapshot.val();
    if (!value || typeof value !== 'object') return [];
    const records: SearchIndexRecord[] = [];
    for (const [key, entry] of Object.entries(value)) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as any;
      records.push({
        id: record.id || key,
        n: typeof record.n === 'string' ? record.n : '',
        b: typeof record.b === 'string' ? record.b : '',
        c: typeof record.c === 'string' ? record.c : '',
        t: typeof record.t === 'string' ? record.t : '',
        u: typeof record.u === 'number' ? record.u : 0
      });
    }
    return records;
  } catch (error) {
    console.warn('[SearchIndex] Failed to load inventory index:', error);
    return [];
  }
}

/** جلب قطع محدّدة بالمعرّف (لنتائج البحث من الفهرس دون تحميل كل الصفحات) */
export async function fetchClothesByIds(ids: string[]): Promise<any[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const path = await resolveReadPath(FIREBASE_COLLECTIONS.CLOTHES);
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 60);

  const results = await Promise.all(unique.map(async (id) => {
    try {
      const snapshot = await get(ref(rtdb, `${path}/${id}`));
      if (!snapshot.exists()) return null;
      const item = snapshot.val();
      if (!item || typeof item !== 'object') return null;
      return { ...item, id: item.id || id };
    } catch {
      return null;
    }
  }));

  return results.filter(Boolean);
}

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
  SEAMSTRESS_PAYMENTS: 'seamstressPayments',
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
// تُعيد true عند نجاح الوصول للسحابة، وfalse عند الفشل (مع حفظها في الصندوق الصادر لإعادة المحاولة)
export async function saveItemToFirebase<T extends { id: string }>(collectionKey: string, item: T): Promise<boolean> {
  if (!item || !item.id) return false;
  const itemWithTs = { ...item, updatedAt: (item as any).updatedAt || new Date().toISOString() };

  // سجل دائم قبل الشبكة: لو انقطع التيار الآن، تُعاد العملية عند الإقلاع
  journalSave(collectionKey, itemWithTs as Record<string, any> & { id: string });

  try {
    const cleanItem = sanitizeForFirebase(itemWithTs);
    const targetPath = await resolveReadPath(collectionKey);
    await update(ref(rtdb, targetPath), { [cleanItem.id]: cleanItem });

    // نسخة مطابقة في المسار القديم أثناء فترة الانتقال (حتى تبقى الأجهزة غير المحدّثة تعمل)
    if (MIRROR_WRITES_TO_LEGACY_PATH && targetPath === dataPath(collectionKey)) {
      update(ref(rtdb, legacyPath(collectionKey)), { [cleanItem.id]: cleanItem }).catch(() => {
        // النسخة المطابقة اختيارية — لا تُفشل العملية الأصلية
      });
    }

    clearQueuedWrite(collectionKey, item.id);
    clearJournalEntry(collectionKey, item.id);
    bumpCacheRevision(collectionKey);

    if (collectionKey === FIREBASE_COLLECTIONS.CLOTHES) {
      void pushInventorySearchIndex(cleanItem);
    }
    return true;
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to save targeted item ${collectionKey}/${item.id}:`, error);
    queueFailedWrite(collectionKey, itemWithTs as Record<string, any> & { id: string });
    return false;
  }
}

/**
 * إعادة إرسال كل الكتابات التي فشلت سابقاً (عند عودة الاتصال أو بدء التطبيق).
 * يبدأ بالسجل الدائم (ما قبل الشبكة) ثم الصندوق الصادر (ما فشل بعد المحاولة).
 * يعيد عدد الكتابات التي نجحت هذه المرة.
 */
export async function flushFailedWrites(): Promise<number> {
  let flushed = 0;

  // 1) السجل الدائم: عمليات لم تتأكد قبل إغلاق/انقطاع التطبيق
  const journalEntries = getJournalEntries();
  for (const entry of journalEntries) {
    try {
      const targetPath = await resolveReadPath(entry.collection);
      const itemPath = `${targetPath}/${entry.id}`;
      const snapshot = await get(ref(rtdb, itemPath));
      const cloudValue = snapshot.exists() ? snapshot.val() : null;

      if (isCloudNewerThanJournal(cloudValue?.updatedAt, entry.at)) {
        // جهاز آخر عدّل السجل بعد نيّتنا ⇒ نتبنّى الأحدث ونتخلّى عن العملية القديمة
        clearJournalEntry(entry.collection, entry.id);
        continue;
      }

      if (entry.op === 'delete') {
        await remove(ref(rtdb, itemPath));
      } else if (entry.op === 'update' && entry.updates) {
        await update(ref(rtdb, itemPath), sanitizeForFirebase(entry.updates));
      } else if (entry.op === 'save' && entry.item) {
        const cleanItem = sanitizeForFirebase(entry.item);
        await update(ref(rtdb, targetPath), { [entry.id]: cleanItem });
        if (MIRROR_WRITES_TO_LEGACY_PATH && targetPath === dataPath(entry.collection)) {
          update(ref(rtdb, legacyPath(entry.collection)), { [entry.id]: cleanItem }).catch(() => {});
        }
        if (entry.collection === FIREBASE_COLLECTIONS.CLOTHES) {
          void pushInventorySearchIndex(cleanItem);
        }
      }

      if (entry.op === 'delete' && MIRROR_WRITES_TO_LEGACY_PATH && targetPath === dataPath(entry.collection)) {
        update(ref(rtdb, legacyPath(entry.collection)), { [entry.id]: null }).catch(() => {});
      }

      clearJournalEntry(entry.collection, entry.id);
      clearQueuedWrite(entry.collection, entry.id);
      bumpCacheRevision(entry.collection);
      flushed++;
    } catch (error) {
      markJournalAttempt(entry.collection, entry.id);
      console.warn(`[Journal] Retry failed for ${entry.collection}/${entry.id}:`, error);
    }
  }

  // 2) الصندوق الصادر: كتابات فشلت بعد محاولة الشبكة
  const pending = getQueuedWrites();
  for (const entry of pending) {
    try {
      const targetPath = await resolveReadPath(entry.collection);
      const itemPath = `${targetPath}/${entry.item.id}`;
      const snapshot = await get(ref(rtdb, itemPath));
      const cloudValue = snapshot.exists() ? snapshot.val() : null;
      const pendingAt = Math.max(
        entry.queuedAt,
        Date.parse(String((entry.item as any).updatedAt || '')) || 0
      );

      if (isCloudNewerThanJournal(cloudValue?.updatedAt, pendingAt)) {
        clearQueuedWrite(entry.collection, entry.item.id);
        clearJournalEntry(entry.collection, entry.item.id);
        continue;
      }

      const cleanItem = sanitizeForFirebase(entry.item);
      await update(ref(rtdb, targetPath), { [cleanItem.id]: cleanItem });
      if (MIRROR_WRITES_TO_LEGACY_PATH && targetPath === dataPath(entry.collection)) {
        update(ref(rtdb, legacyPath(entry.collection)), { [cleanItem.id]: cleanItem }).catch(() => {});
      }
      if (entry.collection === FIREBASE_COLLECTIONS.CLOTHES) {
        void pushInventorySearchIndex(cleanItem);
      }
      clearQueuedWrite(entry.collection, entry.item.id);
      clearJournalEntry(entry.collection, entry.item.id);
      bumpCacheRevision(entry.collection);
      flushed += 1;
    } catch (error) {
      console.warn(`[Firebase RTDB] Retry failed for ${entry.collection}/${entry.item.id}:`, error);
    }
  }

  return flushed;
}

/** هل توجد عمليات معلّقة (من سجل الانقطاع أو من الصندوق الصادر)؟ */
export function hasPendingWrites(): boolean {
  return hasJournalEntries() || getQueuedWrites().length > 0;
}

export async function updateItemInFirebase(
  collectionKey: string, 
  itemId: string, 
  updates: Record<string, any>
): Promise<boolean> {
  if (!itemId || !updates) return false;
  const updatesWithTs = { ...updates, updatedAt: updates.updatedAt || new Date().toISOString() };

  journalUpdate(collectionKey, itemId, updatesWithTs);

  try {
    const cleanUpdates = sanitizeForFirebase(updatesWithTs);
    const targetPath = await resolveReadPath(collectionKey);
    const itemRef = ref(rtdb, `${targetPath}/${itemId}`);
    await update(itemRef, cleanUpdates);
    if (MIRROR_WRITES_TO_LEGACY_PATH && targetPath === dataPath(collectionKey)) {
      update(ref(rtdb, `${legacyPath(collectionKey)}/${itemId}`), cleanUpdates).catch(() => {});
    }
    clearJournalEntry(collectionKey, itemId);
    bumpCacheRevision(collectionKey);

    if (collectionKey === FIREBASE_COLLECTIONS.CLOTHES) {
      const snapshot = await get(itemRef);
      if (snapshot.exists()) void pushInventorySearchIndex({ ...snapshot.val(), id: itemId });
    }
    return true;
  } catch (error) {
    console.warn(`[Firebase RTDB] Failed to update targeted item ${collectionKey}/${itemId}:`, error);
    return false;
  }
}

// حذف مستند واحد مع نسخة احتياطية في /system/trash قبل الحذف
export async function deleteItemFromFirebase(collectionKey: string, itemId: string): Promise<void> {
  if (!itemId) return;
  // الحذف أيضاً يُسجَّل قبل التنفيذ: انقطاع التيار لا يجب أن يُرجع سجلاً محذوفاً
  journalDelete(collectionKey, itemId);
  try {
    const targetPath = await resolveReadPath(collectionKey);
    const itemRef = ref(rtdb, `${targetPath}/${itemId}`);
    const snapshot = await get(itemRef);
    if (snapshot.exists()) {
      const itemData = snapshot.val();
      const trashRef = ref(rtdb, `${systemPath('trash')}/${collectionKey}/${itemId}`);
      await set(trashRef, {
        ...itemData,
        originalCollection: collectionKey,
        deletedAt: new Date().toISOString()
      });
    }

    const collectionRef = ref(rtdb, targetPath);
    await update(collectionRef, { [itemId]: null });
    await remove(itemRef);

    if (MIRROR_WRITES_TO_LEGACY_PATH && targetPath === dataPath(collectionKey)) {
      update(ref(rtdb, legacyPath(collectionKey)), { [itemId]: null }).catch(() => {});
    }
    if (collectionKey === FIREBASE_COLLECTIONS.CLOTHES) {
      void removeInventorySearchIndex(itemId);
    }
    clearJournalEntry(collectionKey, itemId);
    bumpCacheRevision(collectionKey);
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
    const [moduleName, collectionName] = dataPath(col).split('/');
    const namespacedValue = rootVal?.[moduleName]?.[collectionName];
    const legacyValue = rootVal?.[col];
    const items = toItems(namespacedValue ?? legacyValue);
    backupData[col] = items;
    counts[col] = items.length;
  }

  for (const extra of ['clothImages', 'clothThumbs']) {
    const [moduleName, collectionName] = dataPath(extra).split('/');
    const val = rootVal?.[moduleName]?.[collectionName] ?? rootVal?.[extra];
    backupData[extra] = val || {};
    counts[extra] = val && typeof val === 'object' ? Object.keys(val).length : 0;
  }

  // السلة موجودة الآن في /system/trash مع بقاء /trash للبيانات القديمة
  const trashValue = {
    ...(rootVal?.trash && typeof rootVal.trash === 'object' ? rootVal.trash : {}),
    ...(rootVal?.system?.trash && typeof rootVal.system.trash === 'object' ? rootVal.system.trash : {})
  };
  backupData['trash'] = trashValue;
  counts['trash'] = Object.keys(trashValue).length;

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
  const targetPath = await resolveReadPath(collectionKey);

  try {
    const constraints: any[] = [orderByKey()];
    if (cursor) constraints.push(endAt(cursor));
    constraints.push(limitToLast(pageSize + 1 + (cursor ? 1 : 0)));

    const snapshot = await get(query(ref(rtdb, targetPath), ...constraints));
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

// بحث مباشر عن قطعة واحدة بالباركود: فهرس البحث أولاً (سجل مخفّف) ثم مسح الباركود
export async function fetchClothByBarcode(barcode: string): Promise<any | null> {
  if (!barcode) return null;
  const clean = barcode.trim().toLowerCase();
  if (!clean) return null;

  try {
    const clothesPath = await resolveReadPath(FIREBASE_COLLECTIONS.CLOTHES);

    // 1) فهرس البحث المخفّف: سجل واحد فقط يُقرأ
    try {
      const indexQuery = query(
        ref(rtdb, searchIndexPath('clothes')),
        orderByChild('b'),
        equalTo(barcode.trim()),
        limitToFirst(1)
      );
      const indexSnapshot = await get(indexQuery);
      if (indexSnapshot.exists()) {
        const val = indexSnapshot.val();
        const keys = val && typeof val === 'object' ? Object.keys(val) : [];
        if (keys.length > 0) {
          const indexedId = (val as any)[keys[0]]?.id || keys[0];
          const itemSnap = await get(ref(rtdb, `${clothesPath}/${indexedId}`));
          if (itemSnap.exists()) {
            const item = itemSnap.val();
            if (item && typeof item === 'object') return { ...item, id: item.id || indexedId };
          }
        }
      }
    } catch {
      // الفهرس لم يُبنَ بعد — نكمل بالطرق التقليدية
    }

    // 2) استعلام مفهرس على الباركود
    const bcQuery = query(
      ref(rtdb, clothesPath),
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

    // 3) المفتاح نفسه هو الباركود
    const idSnap = await get(ref(rtdb, `${clothesPath}/${clean}`));
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
    const targetPath = await resolveReadPath(collectionKey);
    const colRef = ref(rtdb, targetPath);
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
      await update(ref(rtdb, dataPath(FIREBASE_COLLECTIONS.CREDIT_PAYMENTS)), paymentsUpdate);
    }
    if (Object.keys(creditsUpdate).length > 0) {
      await update(ref(rtdb, dataPath(FIREBASE_COLLECTIONS.CREDITS)), creditsUpdate);
    }
  } catch (error) {
    console.warn('[Firebase RTDB] Failed to migrate embedded credit payments:', error);
  }
}

// جلب كل المحذوفات مؤقتاً من /trash
export async function fetchTrashItems(): Promise<any[]> {
  try {
    // نقرأ المسار الجديد /system/trash والمسار القديم /trash معاً (دون تكرار)
    const [namespaced, legacy] = await Promise.all([
      get(ref(rtdb, systemPath('trash'))),
      get(ref(rtdb, 'trash'))
    ]);
    const items: any[] = [];
    const seen = new Set<string>();
    const collect = (val: any) => {
      if (!val || typeof val !== 'object') return;
      Object.keys(val).forEach(col => {
        const colObj = val[col];
        if (!colObj || typeof colObj !== 'object') return;
        Object.keys(colObj).forEach(id => {
          const item = colObj[id];
          if (!item || typeof item !== 'object') return;
          const key = `${col}:${id}`;
          if (seen.has(key)) return;
          seen.add(key);
          items.push({ ...item, id, collection: col });
        });
      });
    };
    if (namespaced.exists()) collect(namespaced.val());
    if (legacy.exists()) collect(legacy.val());
    return items;
  } catch (err) {
    console.warn('Failed to fetch trash items:', err);
    return [];
  }
}

// استرجاع مستند من السلة إلى مجموعته الأصلية
export async function restoreItemFromTrash(collectionKey: string, itemId: string): Promise<boolean> {
  try {
    let trashItemRef = ref(rtdb, `${systemPath('trash')}/${collectionKey}/${itemId}`);
    let snapshot = await get(trashItemRef);
    if (!snapshot.exists()) {
      trashItemRef = ref(rtdb, `trash/${collectionKey}/${itemId}`);
      snapshot = await get(trashItemRef);
      if (!snapshot.exists()) return false;
    }
    const itemData = snapshot.val();
    const { originalCollection, deletedAt, ...restoredData } = itemData;

    const targetCollectionRef = ref(rtdb, dataPath(collectionKey));
    await update(targetCollectionRef, { [itemId]: sanitizeForFirebase({ ...restoredData, updatedAt: new Date().toISOString() }) });
    if (MIRROR_WRITES_TO_LEGACY_PATH) {
      update(ref(rtdb, legacyPath(collectionKey)), { [itemId]: sanitizeForFirebase({ ...restoredData, updatedAt: new Date().toISOString() }) }).catch(() => {});
    }
    bumpCacheRevision(collectionKey);
    if (collectionKey === FIREBASE_COLLECTIONS.CLOTHES) {
      void pushInventorySearchIndex({ ...restoredData, id: itemId });
    }

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
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    let purgedCount = 0;

    for (const rootPath of [systemPath('trash'), 'trash']) {
      const snapshot = await get(ref(rtdb, rootPath));
      if (!snapshot.exists()) continue;
      const val = snapshot.val();
      if (!val || typeof val !== 'object') continue;

      for (const col of Object.keys(val)) {
        const colObj = val[col];
        if (!colObj || typeof colObj !== 'object') continue;
        for (const id of Object.keys(colObj)) {
          const item = colObj[id];
          if (item && item.deletedAt) {
            const deletedTime = new Date(item.deletedAt).getTime();
            if (!isNaN(deletedTime) && deletedTime < cutoffMs) {
              await remove(ref(rtdb, `${rootPath}/${col}/${id}`));
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
  targetRef: Query | null;
  /** إغلاق المستمع فقط (الاحتفاظ بالاشتراك والبيانات الأخيرة للعرض الفوري لاحقاً) */
  close: () => void;
  /** إعادة فتح المستمع وطلب لقطة حديثة */
  open: () => void;
  callbacks: Set<(items: T[]) => void>;
  lastData: T[] | null;
  isOpen: boolean;
  /** آخر لحظة استُخدم فيها الاشتراك */
  lastUsedAt: number;
  /**
   * بعد مغادرة القسم يُغلق المستمع فوراً، لكن نُبقي بيانات القسم في الذاكرة
   * مدة قصيرة (45 ثانية) ليظهر فوراً عند الرجوع السريع دون إعادة تنزيل.
   * إن انقضت المدة تُحذف من الذاكرة نهائياً.
   */
  dormantUntil?: number;
}

/**
 * مدير اشتراكات موحّد: مستمع واحد فقط لكل مجموعة/نطاق، مع عدّاد مستهلكين،
 * وإلغاء تلقائي عند مغادرة القسم، وإيقاف مؤقت للمستمعين عندما لا نحتاج إليهم
 * (تبويب مخفي/تطبيق في الخلفية) دون فقدان البيانات الأخيرة للعرض الفوري.
 */
export class SubscriptionManager {
  private static activeSubscriptions = new Map<string, ActiveSubscriptionEntry>();
  private static suspended = false;
  private static readonly DORMANT_TTL_MS = 45_000;
  private static sweepTimer: ReturnType<typeof setInterval> | null = null;

  /** حذف الاشتراكات الخاملة (غادر القسم صاحبه وانقضت مدة الاحتفاظ) */
  private static sweepDormant(): void {
    const now = Date.now();
    for (const [subKey, entry] of SubscriptionManager.activeSubscriptions.entries()) {
      if (entry.callbacks.size > 0) continue;
      if (!entry.dormantUntil) continue;
      if (now < entry.dormantUntil) continue;
      try {
        entry.close();
      } catch {}
      SubscriptionManager.activeSubscriptions.delete(subKey);
    }
  }

  private static ensureSweeper(): void {
    if (SubscriptionManager.sweepTimer !== null || typeof window === 'undefined') return;
    SubscriptionManager.sweepTimer = setInterval(() => {
      SubscriptionManager.sweepDormant();
      if (SubscriptionManager.activeSubscriptions.size === 0 && SubscriptionManager.sweepTimer !== null) {
        clearInterval(SubscriptionManager.sweepTimer);
        SubscriptionManager.sweepTimer = null;
      }
    }, 15_000);
  }

  private static emit<T>(subKey: string, items: T[]): void {
    const entry = SubscriptionManager.activeSubscriptions.get(subKey);
    if (!entry) return;
    entry.lastData = items;
    entry.lastUsedAt = Date.now();
    entry.callbacks.forEach(cb => {
      try {
        cb(items);
      } catch (err) {
        console.error(`[SubscriptionManager] Callback error on ${subKey}:`, err);
      }
    });
  }

  static subscribe<T extends { id?: string }>(
    collectionKey: string,
    callback: (items: T[]) => void,
    options?: { limit?: number; sort?: boolean }
  ): () => void {
    const subKey = options?.limit && options.limit > 0 ? `${collectionKey}_limit_${options.limit}` : collectionKey;
    let entry = this.activeSubscriptions.get(subKey);

    if (entry) {
      entry.callbacks.add(callback);
      entry.lastUsedAt = Date.now();
      entry.dormantUntil = undefined;
      // مستمع أُغلق (تبويب مخفي/مغادرة قسم) وعاد قسم يحتاجه ⇒ نعيد فتحه
      if (!entry.isOpen && !SubscriptionManager.suspended) {
        entry.open();
      }
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

      const buildRef = (path: string): Query =>
        options?.limit && options.limit > 0
          ? query(ref(rtdb, path), limitToLast(options.limit))
          : ref(rtdb, path);

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

        SubscriptionManager.emit(subKey, items);
      };

      let activeRef: Query | null = null;
      let detach: (() => void) | null = null;
      let resolvedPath: string | null = null;
      let disposed = false;

      const close = () => {
        if (detach) {
          try { detach(); } catch {}
          detach = null;
        }
        if (activeRef) {
          try { off(activeRef, 'value', listener); } catch {}
        }
        activeRef = null;
        const current = SubscriptionManager.activeSubscriptions.get(subKey);
        if (current) current.isOpen = false;
      };

      const attach = (path: string) => {
        if (disposed || SubscriptionManager.suspended) return;
        const target = buildRef(path);
        activeRef = target;
        detach = onValue(target, listener, (error) => {
          console.warn(`[Firebase RTDB] Listener error on ${subKey}:`, error);
        });
        const current = SubscriptionManager.activeSubscriptions.get(subKey);
        if (current) {
          current.targetRef = target;
          current.isOpen = true;
        }
      };

      const open = () => {
        if (resolvedPath) {
          attach(resolvedPath);
          return;
        }
        void (async () => {
          let path = dataPath(collectionKey);
          // توافق خلفي: قبل اكتمال الترحيل قد تكون البيانات في الجذر المسطّح فقط
          if (!namespacedLayoutReady) {
            try {
              const canonicalSnap = await get(ref(rtdb, path));
              if (!canonicalSnap.exists()) {
                const legacySnap = await get(ref(rtdb, legacyPath(collectionKey)));
                if (legacySnap.exists()) path = legacyPath(collectionKey);
              }
            } catch (error) {
              console.warn(`[Firebase RTDB] Path resolution failed for ${subKey}:`, error);
            }
          }
          resolvedPath = path;
          attach(path);
        })();
      };

      entry = {
        collectionKey,
        subKey,
        targetRef: null,
        close,
        open,
        callbacks,
        lastData: null,
        isOpen: false,
        lastUsedAt: Date.now()
      };

      this.activeSubscriptions.set(subKey, entry);
      open();
    }

    let isUnsubscribed = false;
    return () => {
      if (isUnsubscribed) return;
      isUnsubscribed = true;

      const activeEntry = SubscriptionManager.activeSubscriptions.get(subKey);
      if (!activeEntry) return;

      activeEntry.callbacks.delete(callback);

      if (activeEntry.callbacks.size === 0) {
        // مغادرة القسم: إيقاف الاستماع فوراً (لا مزيد من التغييرات الواردة).
        // تبقى آخر لقطة في الذاكرة 45 ثانية فقط لعرض فوري عند الرجوع السريع.
        try {
          activeEntry.close();
        } catch (e) {}
        activeEntry.dormantUntil = Date.now() + SubscriptionManager.DORMANT_TTL_MS;
        SubscriptionManager.ensureSweeper();
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
      entry.lastUsedAt = Date.now();
      entry.dormantUntil = undefined;
      if (!entry.isOpen && !SubscriptionManager.suspended) {
        entry.open();
      }
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
        SubscriptionManager.emit(subKey, items);
      };

      const scheduleEmit = () => {
        if (!emitTimer) {
          emitTimer = setTimeout(emitBatch, 35);
        }
      };

      let detachChildren: (() => void) | null = null;
      let resolvedPath: string | null = null;
      let disposed = false;

      const attachChildren = (path: string) => {
        if (disposed || SubscriptionManager.suspended) return;
        const childRef = ref(rtdb, path);

        const unsubAdd = onChildAdded(childRef, (snapshot) => {
          const item = snapshot.val();
          if (item && typeof item === 'object') {
            const id = item.id || snapshot.key;
            itemsMap.set(id, { ...item, id });
            scheduleEmit();
          }
        });

        const unsubChange = onChildChanged(childRef, (snapshot) => {
          const item = snapshot.val();
          if (item && typeof item === 'object') {
            const id = item.id || snapshot.key;
            itemsMap.set(id, { ...item, id });
            scheduleEmit();
          }
        });

        const unsubRemove = onChildRemoved(childRef, (snapshot) => {
          const key = snapshot.key;
          if (key) {
            itemsMap.delete(key);
            scheduleEmit();
          }
        });

        detachChildren = () => {
          try { unsubAdd(); } catch (e) {}
          try { unsubChange(); } catch (e) {}
          try { unsubRemove(); } catch (e) {}
        };
      };

      const close = () => {
        if (emitTimer) {
          clearTimeout(emitTimer);
          emitTimer = null;
        }
        if (detachChildren) {
          try { detachChildren(); } catch {}
          detachChildren = null;
        }
        const current = SubscriptionManager.activeSubscriptions.get(subKey);
        if (current) current.isOpen = false;
      };

      const open = () => {
        if (resolvedPath) {
          // بعد إغلاق مؤقت قد تكون هناك حذوفات لم نرها ⇒ نبدأ من حالة نظيفة
          itemsMap.clear();
          attachChildren(resolvedPath);
          return;
        }
        void (async () => {
          let path = dataPath(collectionKey);
          if (!namespacedLayoutReady) {
            try {
              const canonicalSnap = await get(ref(rtdb, path));
              if (!canonicalSnap.exists()) {
                const legacySnap = await get(ref(rtdb, legacyPath(collectionKey)));
                if (legacySnap.exists()) path = legacyPath(collectionKey);
              }
            } catch (error) {
              console.warn(`[Firebase RTDB] Granular path resolution failed for ${subKey}:`, error);
            }
          }
          resolvedPath = path;
          attachChildren(path);
        })();
      };

      entry = {
        collectionKey,
        subKey,
        targetRef: null,
        close,
        open,
        callbacks,
        lastData: null,
        isOpen: false,
        lastUsedAt: Date.now()
      };

      this.activeSubscriptions.set(subKey, entry);
      open();
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
          activeEntry.close();
        } catch (e) {}
        activeEntry.dormantUntil = Date.now() + SubscriptionManager.DORMANT_TTL_MS;
        SubscriptionManager.ensureSweeper();
      }
    };
  }

  /**
   * إيقاف كل المستمعين مؤقتاً (تبويب مخفي / تطبيق في الخلفية).
   * لا يحذف الاشتراكات ولا بياناتها: العودة إلى القسم تعيد الاتصال وتطلب لقطة حديثة.
   */
  static suspendAll(): number {
    if (SubscriptionManager.suspended) return 0;
    SubscriptionManager.suspended = true;
    let count = 0;
    for (const entry of SubscriptionManager.activeSubscriptions.values()) {
      if (!entry.isOpen) continue;
      try {
        entry.close();
        count++;
      } catch (e) {}
    }
    return count;
  }

  /** استئناف المستمعين بعد إيقافهم المؤقت */
  static resumeAll(): number {
    if (!SubscriptionManager.suspended) return 0;
    SubscriptionManager.suspended = false;
    let count = 0;
    for (const entry of SubscriptionManager.activeSubscriptions.values()) {
      // الأقسام التي غادرها المستخدم لا تُفتح من جديد (لا مستهلك لها)
      if (entry.callbacks.size === 0) continue;
      try {
        entry.open();
        count++;
      } catch (e) {}
    }
    return count;
  }

  static isSuspended(): boolean {
    return SubscriptionManager.suspended;
  }

  /** عدد المستمعين المفتوحين حالياً (للتشخيص) */
  static getOpenListenersCount(): number {
    let count = 0;
    for (const entry of SubscriptionManager.activeSubscriptions.values()) {
      if (entry.isOpen) count++;
    }
    return count;
  }

  /** إغلاق كل الاشتراكات وحذفها (عند تفريغ التطبيق/الخروج الكامل) */
  static releaseAll(): void {
    for (const entry of SubscriptionManager.activeSubscriptions.values()) {
      try {
        entry.close();
      } catch (e) {}
    }
    SubscriptionManager.activeSubscriptions.clear();
    SubscriptionManager.suspended = false;
    if (SubscriptionManager.sweepTimer !== null) {
      clearInterval(SubscriptionManager.sweepTimer);
      SubscriptionManager.sweepTimer = null;
    }
  }

  /** عدد الاشتراكات التي ما يزال لها مستهلك (قسم معروض أو نافذة مفتوحة) */
  static getActiveSubscriptionsCount(): number {
    let count = 0;
    for (const entry of SubscriptionManager.activeSubscriptions.values()) {
      if (entry.callbacks.size > 0) count++;
    }
    return count;
  }

  /** الاشتراكات الخاملة (مغادرَ قسمها، محفوظة للعرض السريع فقط) */
  static getDormantSubscriptionsCount(): number {
    let count = 0;
    for (const entry of SubscriptionManager.activeSubscriptions.values()) {
      if (entry.callbacks.size === 0) count++;
    }
    return count;
  }

  static getActiveCollections(): string[] {
    return Array.from(SubscriptionManager.activeSubscriptions.entries())
      .filter(([, entry]) => entry.callbacks.size > 0)
      .map(([subKey]) => subKey);
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
