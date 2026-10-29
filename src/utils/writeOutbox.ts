/**
 * صندوق صادر (Outbox) للكتابات التي فشلت في الوصول إلى Firebase.
 *
 * المشكلة التي يحلها: إذا فشلت الكتابة (انقطاع شبكة، رفض صلاحيات، إغلاق التطبيق فوراً)
 * فإن الدفعة تبقى محلياً فقط، وعند أول لقطة قادمة من السحابة تُستبدل القائمة المحلية
 * بالبيانات السحابية القديمة فتُفقد الدفعة. لذلك نحفظ كل كتابة فاشلة هنا، ونعيد
 * دمجها مع بيانات السحابة، ونعيد إرسالها تلقائياً عند عودة الاتصال.
 */

const OUTBOX_KEY = 'bm_write_outbox_v1';
const MAX_ENTRIES = 500;

export interface OutboxEntry {
  collection: string;
  item: Record<string, any> & { id: string };
  queuedAt: number;
  attempts: number;
}

type OutboxMap = Record<string, OutboxEntry>;

const entryKey = (collection: string, id: string): string => `${collection}::${id}`;

function readAll(): OutboxMap {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OutboxMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: OutboxMap): void {
  try {
    const entries = Object.values(map)
      .sort((a, b) => a.queuedAt - b.queuedAt)
      .slice(-MAX_ENTRIES);
    const trimmed: OutboxMap = {};
    for (const entry of entries) trimmed[entryKey(entry.collection, entry.item.id)] = entry;
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(trimmed));
  } catch {
    // التخزين ممتلئ أو غير متاح — لا نعطّل الواجهة
  }
}

/** إضافة كتابة فاشلة (أو زيادة عدد المحاولات لكتابة موجودة) */
export function queueFailedWrite(collection: string, item: Record<string, any> & { id: string }): void {
  if (!collection || !item?.id) return;
  const map = readAll();
  const key = entryKey(collection, item.id);
  const existing = map[key];
  map[key] = {
    collection,
    item,
    queuedAt: existing?.queuedAt || Date.now(),
    attempts: (existing?.attempts || 0) + 1
  };
  writeAll(map);
}

/** إزالة كتابة من الصندوق بعد نجاحها في السحابة */
export function clearQueuedWrite(collection: string, id: string): void {
  const map = readAll();
  const key = entryKey(collection, id);
  if (!map[key]) return;
  delete map[key];
  writeAll(map);
}

export function getQueuedWrites(collection?: string): OutboxEntry[] {
  const entries = Object.values(readAll());
  return (collection ? entries.filter(e => e.collection === collection) : entries)
    .sort((a, b) => a.queuedAt - b.queuedAt);
}

export function hasQueuedWrites(collection?: string): boolean {
  return getQueuedWrites(collection).length > 0;
}

/**
 * دمج سجلات الصندوق الصادر مع سجلات السحابة حتى لا تختفي الكتابات غير المؤكدة.
 * السجلات السحابية لها الأولوية عند نفس المعرف (أي أن الكتابة وصلت فعلاً).
 */
export function mergeQueuedWrites<T extends { id?: string }>(collection: string, serverItems: T[]): T[] {
  const pending = getQueuedWrites(collection);
  if (pending.length === 0) return serverItems;

  const present = new Set(serverItems.map(item => item?.id).filter(Boolean) as string[]);
  const missing = pending
    .filter(entry => !present.has(entry.item.id))
    .map(entry => entry.item as unknown as T);

  return missing.length === 0 ? serverItems : [...missing, ...serverItems];
}

/** حذف كل مدخلات صندوق الصادر لمجموعة معينة (عند الحذف أو التفريغ) */
export function clearQueuedWritesForCollection(collection: string): void {
  const map = readAll();
  let changed = false;
  for (const key of Object.keys(map)) {
    if (map[key].collection === collection) {
      delete map[key];
      changed = true;
    }
  }
  if (changed) writeAll(map);
}
