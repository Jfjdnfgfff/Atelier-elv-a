import { ClothItem, RawMaterial } from '../types';
import { fetchCollectionPage, FIREBASE_COLLECTIONS } from '../firebase';

/**
 * ملخص قيم المخزون (رأس المال، ثمن البيع، عدد القطع...) محسوب من **كامل** المخزون
 * حتى لا يعتمد على تحميل كل القطع في الواجهة (المخزون يُحمَّل على صفحات لتسريع التطبيق).
 */
export interface InventoryAggregate {
  models: number; // عدد الموديلات/القطع المسجلة
  stock1: number; // قطع المخزن 1 (صالة العرض)
  stock2: number; // قطع المخزن 2 (المستودع)
  pieces: number; // إجمالي القطع
  rentedCount: number; // القطع المؤجرة حالياً
  purchaseValue: number; // رأس مال شراء الملابس = مجموع (سعر الشراء × الكمية)
  saleValue: number; // مجموع السلعة بثمن البيع
  rawMaterialsCount: number;
  rawRolls: number;
  rawMeters: number;
  rawMaterialsValue: number;
  totalCapital: number; // ملابس + أقمشة وسلع أولية
  updatedAt: string; // ISO
  stale?: boolean; // صار قديماً بعد تعديل على المخزون (يُعرض الرقم ثم يُحدَّث)
}

const CACHE_KEY = 'bm_inventory_aggregate_v1';
// مدة صلاحية الملخص المحفوظ محلياً قبل إعادة الحساب من السحابة
export const INVENTORY_AGGREGATE_TTL_MS = 60 * 1000;

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function emptyInventoryAggregate(): InventoryAggregate {
  return {
    models: 0,
    stock1: 0,
    stock2: 0,
    pieces: 0,
    rentedCount: 0,
    purchaseValue: 0,
    saleValue: 0,
    rawMaterialsCount: 0,
    rawRolls: 0,
    rawMeters: 0,
    rawMaterialsValue: 0,
    totalCapital: 0,
    updatedAt: new Date().toISOString()
  };
}

/** حساب الملخص من قائمة قطع كاملة + الأقمشة (حساب محلي فوري) */
export function computeInventoryAggregate(
  clothes: ClothItem[],
  rawMaterials: RawMaterial[] = []
): InventoryAggregate {
  let stock1 = 0;
  let stock2 = 0;
  let purchaseValue = 0;
  let saleValue = 0;
  let rentedCount = 0;

  for (let i = 0; i < clothes.length; i++) {
    const c = clothes[i];
    const s1 = c.stock1 !== undefined ? toNumber(c.stock1) : toNumber(c.stock);
    const s2 = toNumber(c.stock2);
    const qty = s1 + s2;

    stock1 += s1;
    stock2 += s2;
    rentedCount += toNumber(c.rentedCount);
    purchaseValue += toNumber(c.buyCost) * qty;
    saleValue += toNumber(c.sellPrice) * qty;
  }

  let rawRolls = 0;
  let rawMeters = 0;
  let rawValue = 0;
  for (let i = 0; i < rawMaterials.length; i++) {
    const m = rawMaterials[i];
    rawRolls += toNumber(m.rollCount);
    rawMeters += toNumber(m.totalMeters);
    rawValue += toNumber(m.totalCostValue) || (toNumber(m.totalMeters) * toNumber(m.costPerMeter));
  }

  return {
    models: clothes.length,
    stock1,
    stock2,
    pieces: stock1 + stock2,
    rentedCount,
    purchaseValue: Math.round(purchaseValue * 100) / 100,
    saleValue: Math.round(saleValue * 100) / 100,
    rawMaterialsCount: rawMaterials.length,
    rawRolls,
    rawMeters: Math.round(rawMeters * 100) / 100,
    rawMaterialsValue: Math.round(rawValue * 100) / 100,
    totalCapital: Math.round((purchaseValue + rawValue) * 100) / 100,
    updatedAt: new Date().toISOString(),
    stale: false
  };
}

export function loadCachedInventoryAggregate(): InventoryAggregate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InventoryAggregate;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.purchaseValue !== 'number') return null;
    return { ...emptyInventoryAggregate(), ...parsed };
  } catch {
    return null;
  }
}

export function saveCachedInventoryAggregate(aggregate: InventoryAggregate): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(aggregate));
  } catch {
    // التخزين ممتلئ أو غير متاح — لا نعطّل الواجهة
  }
}

/** تعليم الملخص بأنه قديم بعد أي تعديل على المخزون (يبقى الرقم معروضاً ثم يُعاد الحساب خلفياً) */
export const INVENTORY_AGGREGATE_INVALIDATED_EVENT = 'bm:inventory-aggregate-invalidated';

export function invalidateInventoryAggregate(): void {
  const cached = loadCachedInventoryAggregate();
  if (cached) saveCachedInventoryAggregate({ ...cached, stale: true });
  try {
    window.dispatchEvent(new Event(INVENTORY_AGGREGATE_INVALIDATED_EVENT));
  } catch {
    // بيئة بدون window (اختبارات/SSR)
  }
}

export function isInventoryAggregateStale(
  aggregate: InventoryAggregate | null,
  ttlMs: number = INVENTORY_AGGREGATE_TTL_MS
): boolean {
  if (!aggregate?.updatedAt) return true;
  if (aggregate.stale) return true;
  const age = Date.now() - new Date(aggregate.updatedAt).getTime();
  return !Number.isFinite(age) || age > ttlMs;
}

const MAX_PAGES = 400; // حماية من الحلقة اللانهائية (400 صفحة × 100 سجل)

/**
 * جلب الملخص من كل السجلات السحابية على صفحات (100 سجل بالصفحة)
 * دون الاحتفاظ بالقطع في حالة الواجهة — تُجمع الأرقام فقط ثم تُهمل السجلات.
 */
export async function fetchInventoryAggregateFromCloud(): Promise<InventoryAggregate> {
  let stock1 = 0;
  let stock2 = 0;
  let purchaseValue = 0;
  let saleValue = 0;
  let rentedCount = 0;
  let models = 0;

  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchCollectionPage<ClothItem>(FIREBASE_COLLECTIONS.CLOTHES, {
      limit: 100,
      cursor
    });

    for (let i = 0; i < result.items.length; i++) {
      const c = result.items[i];
      const s1 = c.stock1 !== undefined ? toNumber(c.stock1) : toNumber(c.stock);
      const s2 = toNumber(c.stock2);
      const qty = s1 + s2;
      stock1 += s1;
      stock2 += s2;
      rentedCount += toNumber(c.rentedCount);
      purchaseValue += toNumber(c.buyCost) * qty;
      saleValue += toNumber(c.sellPrice) * qty;
      models += 1;
    }

    if (!result.hasMore || !result.nextCursor || result.items.length === 0) break;
    cursor = result.nextCursor;
  }

  let rawRolls = 0;
  let rawMeters = 0;
  let rawValue = 0;
  let rawMaterialsCount = 0;

  let rawCursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchCollectionPage<RawMaterial>(FIREBASE_COLLECTIONS.RAW_MATERIALS, {
      limit: 100,
      cursor: rawCursor
    });

    for (let i = 0; i < result.items.length; i++) {
      const m = result.items[i];
      rawRolls += toNumber(m.rollCount);
      rawMeters += toNumber(m.totalMeters);
      rawValue += toNumber(m.totalCostValue) || (toNumber(m.totalMeters) * toNumber(m.costPerMeter));
      rawMaterialsCount += 1;
    }

    if (!result.hasMore || !result.nextCursor || result.items.length === 0) break;
    rawCursor = result.nextCursor;
  }

  return {
    models,
    stock1,
    stock2,
    pieces: stock1 + stock2,
    rentedCount,
    purchaseValue: Math.round(purchaseValue * 100) / 100,
    saleValue: Math.round(saleValue * 100) / 100,
    rawMaterialsCount,
    rawRolls,
    rawMeters: Math.round(rawMeters * 100) / 100,
    rawMaterialsValue: Math.round(rawValue * 100) / 100,
    totalCapital: Math.round((purchaseValue + rawValue) * 100) / 100,
    updatedAt: new Date().toISOString(),
    stale: false
  };
}
