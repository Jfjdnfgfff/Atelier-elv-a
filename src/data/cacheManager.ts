/**
 * إدارة الكاش السحابي: قراءة بصمات التعديل وإبطال النسخ القديمة
 * ---------------------------------------------------------------
 * كل كتابة ناجحة في السحابة تُحدّث بصمة صغيرة في /system/cacheMeta/{collection}.
 * عند الإقلاع (أو عند عودة التبويب للواجهة/الاتصال) نقرأ كل البصمات بقراءة واحدة صغيرة:
 *
 *   - بصمة السحابة أحدث من بصمة الكاش المحلي  → الكاش قديم ⇒ يُحذف ويعاد البناء من السحابة.
 *   - بصمة مطابقة                            → الكاش سليم ⇒ يُعرض فوراً (بدون انتظار الشبكة).
 *   - تغيّر مخطّط التخزين (CACHE_SCHEMA_VERSION) → كل الكاش يُبطَل.
 *
 * بذلك لا تُعرض أبداً أرقام مخزون/صندوق قديمة، مع بقاء سرعة العرض من الكاش.
 */

import { get, ref } from 'firebase/database';
import { rtdb } from '../firebase';
import { systemPath } from './paths';
import { invalidateStoredKey } from '../storage';
import { COLLECTION_STORAGE_KEYS } from './collectionStorageKeys';
import {
  CACHE_SCHEMA_VERSION,
  evaluateCacheFreshness,
  getKnownRevision,
  setKnownRevision,
  type CacheEvaluation
} from '../utils/cachePolicy';

let remoteRevisions: Record<string, number> = {};
let lastRevalidationAt = 0;

/** قراءة بصمات كل المجموعات من السحابة بقراءة واحدة (لا تُعدّل السجل المحلي) */
export async function fetchRemoteRevisions(): Promise<Record<string, number>> {
  try {
    const snapshot = await get(ref(rtdb, systemPath('cacheMeta')));
    if (!snapshot.exists()) {
      remoteRevisions = {};
      return remoteRevisions;
    }
    const value = snapshot.val() || {};
    const next: Record<string, number> = {};
    for (const [collection, entry] of Object.entries(value)) {
      if (entry && typeof entry === 'object' && typeof (entry as any).revision === 'number') {
        next[collection] = (entry as any).revision;
      }
    }
    remoteRevisions = next;
    return next;
  } catch (error) {
    console.warn('[Cache] Unable to read remote revisions:', error);
    return remoteRevisions;
  }
}

export function getRemoteRevision(collection: string): number | null {
  const value = remoteRevisions[collection];
  return typeof value === 'number' ? value : null;
}

/**
 * يقارن بصمة السحابة ببصمة الكاش لكل مجموعة ويُبطل ما هو قديم.
 * يعيد قائمة المجموعات التي أُبطل كاشها.
 */
export async function invalidateStaleCaches(
  collections: readonly string[],
  onInvalidated?: (collection: string, evaluation: CacheEvaluation) => void
): Promise<string[]> {
  const remote = await fetchRemoteRevisions();
  const invalidated: string[] = [];

  for (const collection of collections) {
    const storageKey = COLLECTION_STORAGE_KEYS[collection];
    if (!storageKey) continue;

    const remoteRevision = typeof remote[collection] === 'number' ? remote[collection] : null;
    const knownRevision = getKnownRevision(storageKey);

    // بصمة السحابة تسبق ما يعرفه هذا الجهاز ⇒ بيانات محلية قديمة
    const evaluation = evaluateCacheFreshness(
      { revision: knownRevision, cachedAt: Date.now(), schemaVersion: CACHE_SCHEMA_VERSION },
      remoteRevision
    );

    if (remoteRevision !== null) {
      const isNewer = remoteRevision > knownRevision;
      if (isNewer) {
        invalidateStoredKey(storageKey);
        setKnownRevision(storageKey, remoteRevision);
        invalidated.push(collection);
        onInvalidated?.(collection, { ...evaluation, fresh: false, reason: 'revision' });
      } else if (remoteRevision !== knownRevision) {
        // بصمة أقدم (استرجاع نسخة احتياطية مثلاً) — نتبنّاها دون إبطال
        setKnownRevision(storageKey, remoteRevision);
      }
    }
  }

  lastRevalidationAt = Date.now();
  return invalidated;
}

/**
 * إعادة التحقق التلقائية: عند عودة التبويب للواجهة أو عودة الاتصال.
 * تحمي من حالة شاشة مفتوحة لساعات بينما جهاز آخر يعدّل البيانات.
 */
export function startCacheRevalidation(options: {
  collections: readonly string[];
  onInvalidated?: (collections: string[]) => void;
  minIntervalMs?: number;
}): () => void {
  const { collections, onInvalidated, minIntervalMs = 30_000 } = options;
  if (typeof window === 'undefined') return () => {};

  let disposed = false;
  let running = false;

  const run = async () => {
    if (disposed || running) return;
    if (Date.now() - lastRevalidationAt < minIntervalMs) return;
    running = true;
    try {
      const invalidated = await invalidateStaleCaches(collections);
      if (!disposed && invalidated.length > 0) onInvalidated?.(invalidated);
    } finally {
      running = false;
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') void run();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', run);
  window.addEventListener('focus', run);

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
  };
}
