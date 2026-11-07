/**
 * سجل كتابات دائم (Write-Ahead Journal) — حماية من انقطاع الكهرباء
 * -----------------------------------------------------------------
 * المشكلة: الكتابة إلى Firebase غير متزامنة. إذا انقطع التيار (أو أُغلق الجهاز)
 * بعد تنفيذ العملية في الواجهة وقبل وصول التأكيد من الشبكة، تضيع العملية:
 * الجهاز المحلي قد يحفظ الحالة، لكن السحابة تبقى ناقصة، وبعد أول مزامنة تُستبدل
 * الحالة المحلية بالنسخة السحابية القديمة.
 *
 * الحل: تُسجَّل كل عملية (إضافة/تعديل/حذف) **فوراً وبشكل متزامن** في localStorage
 * قبل إرسالها للشبكة. عند الإقلاع تُعاد كل العمليات غير المؤكدة تلقائياً، مع قاعدة
 * تعارض واضحة: إذا كانت نسخة السحابة أحدث من لحظة تسجيل العملية، تُهمل العملية
 * القديمة ولا نطمس تعديلاً أحدث من جهاز آخر.
 *
 * خصائص التصميم:
 *  - متزامن: localStorage.setItem يعود بعد أن يعهد المتصفح بالبيانات للقرص.
 *  - مدمج: عملية جديدة على نفس السجل تستبدل السابقة (آخر نية للمستخدم هي الأصح).
 *  - محدود: 300 عملية كحد أقصى، ونبذ ما تجاوز 7 أيام.
 *  - آمن للحجم: السجلات الضخمة (صور base64) تُقلَّم قبل التسجيل حتى لا يمتلئ التخزين.
 */

export type JournalOp = 'save' | 'update' | 'delete';

export interface JournalEntry {
  op: JournalOp;
  collection: string;
  id: string;
  /** للعملية save: السجل الكامل */
  item?: Record<string, any>;
  /** للعملية update: الحقول المتغيّرة فقط */
  updates?: Record<string, any>;
  /** لحظة تسجيل النية (ms) — تُستخدم لمقارنة التعارض */
  at: number;
  /** هل قُلّمت حقول كبيرة (صور)؟ */
  trimmed?: boolean;
  attempts: number;
}

const JOURNAL_KEY = 'bm_durable_journal_v1';
const MAX_ENTRIES = 300;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ITEM_CHARS = 120_000;

type JournalMap = Record<string, JournalEntry>;

// بديل في الذاكرة عندما لا يوجد localStorage (اختبارات/بيئات خاصة)
const memoryFallback = new Map<string, string>();
let useMemoryFallback = false;

function storageGet(key: string): string | null {
  if (useMemoryFallback) return memoryFallback.get(key) ?? null;
  try {
    if (typeof localStorage === 'undefined') {
      useMemoryFallback = true;
      return memoryFallback.get(key) ?? null;
    }
    return localStorage.getItem(key);
  } catch {
    useMemoryFallback = true;
    return memoryFallback.get(key) ?? null;
  }
}

function storageSet(key: string, value: string): void {
  if (useMemoryFallback) {
    memoryFallback.set(key, value);
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // الحصة ممتلئة: نحاول تفريغ الأقدم ثم إعادة المحاولة، وإلا نبقى في الذاكرة
    try {
      const map = readAll();
      const entries = Object.entries(map).sort((a, b) => a[1].at - b[1].at);
      const keep = entries.slice(Math.ceil(entries.length / 2));
      const reduced: JournalMap = {};
      for (const [entryKey, entry] of keep) reduced[entryKey] = entry;
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(reduced));
    } catch {
      useMemoryFallback = true;
      memoryFallback.set(key, value);
    }
  }
}

const entryKey = (collection: string, id: string): string => `${collection}::${id}`;

function readAll(): JournalMap {
  try {
    const raw = storageGet(JOURNAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: JournalMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const entry = value as JournalEntry;
      if (!entry || typeof entry !== 'object') continue;
      if (!entry.collection || !entry.id || !entry.op) continue;
      clean[key] = entry;
    }
    return clean;
  } catch {
    return {};
  }
}

function writeAll(map: JournalMap): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  const kept = Object.entries(map)
    .filter(([, entry]) => entry.at >= cutoff)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-MAX_ENTRIES);

  const trimmed: JournalMap = {};
  for (const [key, entry] of kept) trimmed[key] = entry;
  storageSet(JOURNAL_KEY, JSON.stringify(trimmed));
}

/** تقليم الحقول الضخمة (صور data URL) قبل التسجيل حتى لا يستهلك التخزين */
function compactRecord<T extends Record<string, any>>(record: T): { value: T; trimmed: boolean } {
  let trimmed = false;
  const clone: Record<string, any> = { ...record };
  for (const field of ['imageUrl', 'thumbUrl', 'image', 'full', 'thumb']) {
    const value = clone[field];
    if (typeof value === 'string' && value.length > 20_000) {
      delete clone[field];
      trimmed = true;
    }
  }
  try {
    if (JSON.stringify(clone).length > MAX_ITEM_CHARS) {
      for (const field of Object.keys(clone)) {
        if (typeof clone[field] === 'string' && (clone[field] as string).length > 20_000) {
          delete clone[field];
          trimmed = true;
        }
      }
    }
  } catch {
    // تجاهل
  }
  return { value: clone as T, trimmed };
}

function upsert(entry: JournalEntry): void {
  const map = readAll();
  const key = entryKey(entry.collection, entry.id);
  const existing = map[key];
  map[key] = { ...entry, attempts: existing?.attempts || 0 };
  writeAll(map);
}

/** تسجيل نية حفظ سجل كامل قبل إرساله */
export function journalSave(collection: string, item: Record<string, any> & { id: string }): void {
  if (!collection || !item?.id) return;
  const { value, trimmed } = compactRecord(item);
  upsert({ op: 'save', collection, id: item.id, item: value, at: Date.now(), trimmed, attempts: 0 });
}

/** تسجيل نية تعديل حقول سجل */
export function journalUpdate(collection: string, id: string, updates: Record<string, any>): void {
  if (!collection || !id || !updates) return;
  const { value, trimmed } = compactRecord(updates);
  const map = readAll();
  const existing = map[entryKey(collection, id)];

  // إن كان السجل لم يُنشأ في السحابة بعد (عملية save معلّقة)، ندمج التعديل داخله
  // حتى لا تُنشئ إعادة المحاولة سجلاً ناقص الحقول.
  if (existing?.op === 'save' && existing.item) {
    map[entryKey(collection, id)] = {
      ...existing,
      item: { ...existing.item, ...value },
      at: Date.now(),
      trimmed: existing.trimmed || trimmed
    };
    writeAll(map);
    return;
  }

  if (existing?.op === 'update') {
    map[entryKey(collection, id)] = {
      ...existing,
      updates: { ...(existing.updates || {}), ...value },
      at: Date.now(),
      trimmed: existing.trimmed || trimmed
    };
    writeAll(map);
    return;
  }

  upsert({ op: 'update', collection, id, updates: value, at: Date.now(), trimmed, attempts: 0 });
}

/** تسجيل نية حذف سجل */
export function journalDelete(collection: string, id: string): void {
  if (!collection || !id) return;
  upsert({ op: 'delete', collection, id, at: Date.now(), attempts: 0 });
}

/** إزالة عملية بعد تأكيد وصولها للسحابة */
export function clearJournalEntry(collection: string, id: string): void {
  if (!collection || !id) return;
  const map = readAll();
  const key = entryKey(collection, id);
  if (!map[key]) return;
  delete map[key];
  writeAll(map);
}

export function getJournalEntries(): JournalEntry[] {
  return Object.values(readAll()).sort((a, b) => a.at - b.at);
}

export function hasJournalEntries(): boolean {
  return getJournalEntries().length > 0;
}

export function journalSize(): number {
  return getJournalEntries().length;
}

/** زيادة عدد المحاولات لعملية فشلت (للتشخيص) */
export function markJournalAttempt(collection: string, id: string): void {
  const map = readAll();
  const key = entryKey(collection, id);
  const entry = map[key];
  if (!entry) return;
  entry.attempts = (entry.attempts || 0) + 1;
  writeAll(map);
}

export function clearJournal(): void {
  storageSet(JOURNAL_KEY, JSON.stringify({}));
}

/**
 * قاعدة التعارض: هل نسخة السحابة أحدث من نيّة المستخدم المسجّلة؟
 * إذا كانت أحدث نهمل العملية المعلّقة (تعديل جهاز آخر أولى بالحفظ).
 */
export function isCloudNewerThanJournal(
  cloudUpdatedAt: unknown,
  journalAt: number
): boolean {
  if (typeof cloudUpdatedAt !== 'string' && typeof cloudUpdatedAt !== 'number') return false;
  const cloudTime = typeof cloudUpdatedAt === 'number'
    ? cloudUpdatedAt
    : Date.parse(cloudUpdatedAt);
  if (!Number.isFinite(cloudTime)) return false;
  /* هامش صغير (ثانية) لتفادي اعتبار تعديلنا نفسه تعديلاً خارجياً */
  return cloudTime > journalAt + 1000;
}
