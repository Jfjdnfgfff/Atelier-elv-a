/**
 * ترحيل البيانات من الجذر المسطّح إلى المسارات المنظّمة
 * -----------------------------------------------------
 * قبل:  /clothes/{id} · /sales/{id} · /rentals/{id} …
 * بعد:  /inventory/clothes/{id} · /finance/sales/{id} · /operations/rentals/{id} …
 *
 * قواعد الأمان:
 *  - الترحيل **نسخ فقط** ولا يحذف أي شيء من المسار القديم إطلاقاً.
 *  - العملية متكرّرة بأمان (Idempotent): لا تُكرَّر المجموعة إذا كانت منسوخة.
 *  - الإكمال يُسجَّل في /system/meta مجموعةً بمجموعة، فإذا انقطع الاتصال يكمل في المرة القادمة.
 *  - حتى ينتهي الترحيل يعمل التطبيق على المسار القديم كبديل (fallback) فلا تظهر شاشة فارغة.
 */

import { get, ref, set, update } from 'firebase/database';
import { rtdb, sanitizeForFirebase } from '../firebase';
import {
  DATA_LAYOUT_VERSION,
  MIGRATABLE_COLLECTIONS,
  dataPath,
  legacyPath,
  systemPath
} from './paths';
import {
  missingRecords,
  isLayoutComplete,
  type LayoutMetaCore
} from './layoutCore';

const CHUNK_SIZE = 40;
const PARALLEL_CHUNKS = 3;

export interface LayoutMeta {
  layout: string;
  migratedAt: string;
  /** المجموعات التي اكتمل نسخها */
  collections: string[];
  /** آخر تحديث للبيانات في المسارات الجديدة (ms) */
  updatedAt?: number;
}

let inFlight: Promise<LayoutMeta> | null = null;

async function readLayoutMeta(): Promise<LayoutMeta | null> {
  try {
    const snapshot = await get(ref(rtdb, systemPath('meta')));
    if (!snapshot.exists()) return null;
    const value = snapshot.val();
    if (!value || typeof value !== 'object') return null;
    return {
      layout: typeof value.layout === 'string' ? value.layout : '',
      migratedAt: typeof value.migratedAt === 'string' ? value.migratedAt : '',
      collections: Array.isArray(value.collections) ? value.collections.filter((c: any) => typeof c === 'string') : [],
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : undefined
    };
  } catch (error) {
    console.warn('[Layout] Unable to read /system/meta:', error);
    return null;
  }
}

async function copyLegacyCollection(collection: string): Promise<boolean> {
  try {
    const legacySnapshot = await get(ref(rtdb, legacyPath(collection)));
    if (!legacySnapshot.exists()) return true; // لا شيء لنسخه

    const canonicalRef = ref(rtdb, dataPath(collection));
    const existing = await get(canonicalRef);

    // نسخ السجلات الناقصة فقط (يدعم استكمال نسخ انقطع في المنتصف)
    const records = missingRecords(
      legacySnapshot.val(),
      existing.exists() ? existing.val() : null
    );
    const entries = Object.entries(records);
    if (entries.length === 0) return true;
    for (let start = 0; start < entries.length; start += CHUNK_SIZE * PARALLEL_CHUNKS) {
      const writes: Array<Promise<void>> = [];
      for (let offset = 0; offset < PARALLEL_CHUNKS; offset++) {
        const chunkStart = start + offset * CHUNK_SIZE;
        if (chunkStart >= entries.length) break;
        const chunk = Object.fromEntries(entries.slice(chunkStart, chunkStart + CHUNK_SIZE));
        writes.push(update(canonicalRef, chunk));
      }
      await Promise.all(writes);
    }
    return true;
  } catch (error) {
    console.warn(`[Layout] Migration failed for ${collection}:`, error);
    return false;
  }
}

/**
 * يضمن وجود كل البيانات في المسارات المنظّمة. يُستدعى مرة عند الإقلاع.
 * يعيد بيانات الترحيل الحالية.
 */
export function ensureNamespacedLayout(
  collections: readonly string[] = MIGRATABLE_COLLECTIONS
): Promise<LayoutMeta> {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<LayoutMeta> => {
    const existing = await readLayoutMeta();
    const completed = new Set<string>(existing?.layout === DATA_LAYOUT_VERSION ? existing.collections : []);
    const nowIso = new Date().toISOString();

    if (isLayoutComplete(existing as LayoutMetaCore | null, DATA_LAYOUT_VERSION, collections)) {
      return existing as LayoutMeta;
    }

    for (const collection of collections) {
      if (completed.has(collection)) continue;
      const ok = await copyLegacyCollection(collection);
      if (ok) completed.add(collection);
    }

    const meta: LayoutMeta = {
      layout: DATA_LAYOUT_VERSION,
      migratedAt: existing?.migratedAt || nowIso,
      collections: Array.from(completed),
      updatedAt: Date.now()
    };

    try {
      await set(ref(rtdb, systemPath('meta')), meta);
    } catch (error) {
      console.warn('[Layout] Unable to persist /system/meta:', error);
    }

    return meta;
  })().finally(() => {
    // نسمح بمحاولة أخرى في جلسة لاحقة إن لم تكتمل كل المجموعات
    inFlight = null;
  });

  return inFlight;
}

/** حالة الترحيل للعرض في التشخيص (بدون تنفيذ أي كتابة) */
export async function getLayoutStatus(): Promise<{ layout: string; migratedCollections: number; totalCollections: number }> {
  const meta = await readLayoutMeta();
  return {
    layout: meta?.layout || 'legacy-flat',
    migratedCollections: meta?.collections?.length || 0,
    totalCollections: MIGRATABLE_COLLECTIONS.length
  };
}
