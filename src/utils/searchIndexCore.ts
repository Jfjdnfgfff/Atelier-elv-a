/**
 * فهرس البحث في المخزون (Inventory search index)
 * ------------------------------------------------
 * المشكلة: البحث الحالي كان يمرّ على كل قطعة ويقارن نصوصاً فرعية (includes) في كل ضغطة مفتاح
 * → O(عدد القطع × عدد الحقول) لكل حرف، ويصبح بطيئاً مع آلاف القطع.
 *
 * الحل: فهرس معكوس (Inverted index) في الذاكرة:
 *   token → مجموعة معرّفات القطع
 * مع تطبيع عربي موحّد (همزات/تاء مربوطة/تشكيل/أرقام عربية) ودعم بادئات الكلمات.
 * البحث يصبح تقاطع مجموعات صغيرة بدل مسح كامل المخزون.
 *
 * نفس التطبيع يُستخدم لبناء نسخة مخفّفة من السجل في السحابة (`inventory/searchIndex/clothes/{id}`)
 * حتى يمكن البحث في كل المخزون دون تحميل السجلات الكاملة (صور، تفاصيل…).
 */

export interface SearchableItem {
  id: string;
  name?: string;
  barcode?: string;
  category?: string;
  color?: string;
  colors?: string[];
  size?: string;
  sizes?: string[];
  purpose?: string;
  variants?: Array<{ code?: string; color?: string; size?: string } | null | undefined>;
}

/** نسخة مخفّفة تُخزَّن في /inventory/searchIndex/clothes/{id} */
export interface SearchIndexRecord {
  id: string;
  /** الاسم المطبَّع */
  n: string;
  /** الباركود (كما هو) */
  b: string;
  /** التصنيف */
  c: string;
  /** كل الكلمات المطبَّعة مفصولة بمسافة */
  t: string;
  /** وقت التحديث (ms) */
  u: number;
}

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/**
 * تطبيع نص عربي/فرنسي للبحث:
 * - إزالة التشكيل والتطويل
 * - توحيد الألف (أ إ آ ٱ) والياء (ى) والتاء المربوطة (ة) والهمزة (ؤ ئ ء)
 * - تحويل الأرقام العربية/الفارسية إلى لاتينية
 * - حروف صغيرة وإزالة الرموز
 */
export function normalizeSearchText(input: string): string {
  if (!input) return '';
  let text = String(input).toLowerCase();
  // إزالة الحركات اللاتينية (é → e) قبل أي معالجة
  text = text.normalize('NFD').replace(/\p{M}+/gu, '');
  text = text.replace(ARABIC_DIACRITICS, '');
  text = text
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/ء/g, '')
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

export function tokenizeSearchText(input: string): string[] {
  const normalized = normalizeSearchText(input);
  if (!normalized) return [];
  return normalized.split(' ').filter(token => token.length > 0);
}

/** كل كلمات قطعة واحدة: الاسم، الباركود، التصنيف، الألوان، المقاسات، أكواد المتغيّرات */
export function buildItemTokens(item: SearchableItem): string[] {
  const parts: string[] = [];
  parts.push(item.name || '');
  parts.push(item.barcode || '');
  parts.push(item.category || '');
  parts.push(item.color || '');
  if (Array.isArray(item.colors)) parts.push(item.colors.join(' '));
  parts.push(item.size || '');
  if (Array.isArray(item.sizes)) parts.push(item.sizes.join(' '));
  if (item.purpose === 'rent') parts.push('كراء');
  if (item.purpose === 'sell') parts.push('بيع');
  if (Array.isArray(item.variants)) {
    for (const variant of item.variants) {
      if (!variant) continue;
      if (variant.code) parts.push(variant.code);
      if (variant.color) parts.push(variant.color);
      if (variant.size) parts.push(variant.size);
    }
  }
  const unique = new Set<string>();
  for (const part of parts) {
    for (const token of tokenizeSearchText(part)) unique.add(token);
  }
  return Array.from(unique);
}

export function buildSearchIndexRecord(item: SearchableItem, now: number = Date.now()): SearchIndexRecord {
  const tokens = buildItemTokens(item);
  return {
    id: item.id,
    n: normalizeSearchText(item.name || ''),
    b: (item.barcode || '').trim(),
    c: normalizeSearchText(item.category || ''),
    t: tokens.join(' '),
    u: now
  };
}

export interface LocalSearchIndex {
  /** token → معرّفات القطع التي تحتوي عليه */
  tokenMap: Map<string, Set<string>>;
  /** id → كلمات القطعة (للترتيب/التقييم) */
  itemTokens: Map<string, string[]>;
  /** id → نصوص إضافية مطبَّعة (الاسم + الباركود) للمطابقة المباشرة */
  itemText: Map<string, string>;
  size: number;
}

export function buildLocalSearchIndex(items: SearchableItem[]): LocalSearchIndex {
  const tokenMap = new Map<string, Set<string>>();
  const itemTokens = new Map<string, string[]>();
  const itemText = new Map<string, string>();

  for (const item of items) {
    if (!item || !item.id) continue;
    const tokens = buildItemTokens(item);
    itemTokens.set(item.id, tokens);
    itemText.set(item.id, `${normalizeSearchText(item.name || '')} ${(item.barcode || '').toLowerCase()}`.trim());
    for (const token of tokens) {
      let bucket = tokenMap.get(token);
      if (!bucket) {
        bucket = new Set<string>();
        tokenMap.set(token, bucket);
      }
      bucket.add(item.id);
    }
  }

  return { tokenMap, itemTokens, itemText, size: itemTokens.size };
}

/**
 * بحث في الفهرس المحلي: كل كلمة في الاستعلام يجب أن تطابق بادئة كلمة في القطعة.
 * يُعيد المعرّفات مرتّبة: مطابقة تامة للاسم/الباركود أولاً ثم عدد المطابقات.
 */
export function searchLocalIndex(
  index: LocalSearchIndex,
  query: string,
  limit: number = 200
): string[] {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0 || index.size === 0) return [];

  let candidates: Set<string> | null = null;

  for (const queryToken of tokens) {
    const matched = new Set<string>();

    // مطابقة تامة (أسرع مسار)
    const exact = index.tokenMap.get(queryToken);
    if (exact) {
      for (const id of exact) matched.add(id);
    }

    // بادئات الكلمات
    for (const [token, ids] of index.tokenMap) {
      if (token === queryToken) continue;
      if (token.startsWith(queryToken)) {
        for (const id of ids) matched.add(id);
      }
    }

    candidates = candidates === null
      ? matched
      : new Set(Array.from(candidates).filter(id => matched.has(id)));

    if (candidates.size === 0) break;
  }

  if (!candidates || candidates.size === 0) return [];

  const normalizedQuery = normalizeSearchText(query);
  const scored: Array<{ id: string; score: number }> = [];

  for (const id of candidates) {
    const text = index.itemText.get(id) || '';
    const itemTokens = index.itemTokens.get(id) || [];
    let score = 0;
    if (text === normalizedQuery) score += 100;
    else if (text.startsWith(normalizedQuery)) {
      // الاسم الأقصر المقابل للبادئة أولاً (بحث «فس» يُظهر «فستان» قبل «فستان سهرة أحمر»)
      score += 40 + Math.max(0, 30 - (text.length - normalizedQuery.length));
    } else if (text.includes(normalizedQuery)) score += 20;

    for (const queryToken of tokens) {
      if (itemTokens.includes(queryToken)) score += 6;
      else if (itemTokens.some(token => token.startsWith(queryToken))) score += 3;
    }
    scored.push({ id, score });
  }

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.slice(0, limit).map(entry => entry.id);
}

/** بحث داخل سجلات الفهرس المخفّفة (المحمّلة من السحابة) دون الحاجة لسجلات المخزون الكاملة */
export function searchIndexRecords(
  records: SearchIndexRecord[],
  query: string,
  limit: number = 200
): SearchIndexRecord[] {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0 || !Array.isArray(records)) return [];
  const normalizedQuery = normalizeSearchText(query);

  const scored: Array<{ record: SearchIndexRecord; score: number }> = [];

  for (const record of records) {
    if (!record) continue;
    const haystack = `${record.t || ''}`;
    const recordTokens = haystack ? haystack.split(' ') : [];

    let matchesAll = true;
    let score = 0;

    for (const queryToken of tokens) {
      const exact = recordTokens.includes(queryToken);
      const prefix = !exact && recordTokens.some(token => token.startsWith(queryToken));
      if (!exact && !prefix) {
        matchesAll = false;
        break;
      }
      score += exact ? 6 : 3;
    }

    if (!matchesAll) continue;

    if (record.b && record.b.toLowerCase() === normalizedQuery) score += 100;
    if (record.n === normalizedQuery) score += 60;
    else if (record.n.startsWith(normalizedQuery)) score += 25;
    else if (record.n.includes(normalizedQuery)) score += 10;

    scored.push({ record, score });
  }

  scored.sort((a, b) => b.score - a.score || (b.record.u || 0) - (a.record.u || 0));
  return scored.slice(0, limit).map(entry => entry.record);
}
