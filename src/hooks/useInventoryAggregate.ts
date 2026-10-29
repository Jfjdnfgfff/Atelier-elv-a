import { useCallback, useEffect, useRef, useState } from 'react';
import { ClothItem, RawMaterial } from '../types';
import {
  INVENTORY_AGGREGATE_INVALIDATED_EVENT,
  InventoryAggregate,
  computeInventoryAggregate,
  fetchInventoryAggregateFromCloud,
  isInventoryAggregateStale,
  loadCachedInventoryAggregate,
  saveCachedInventoryAggregate
} from '../utils/inventoryAggregate';

interface UseInventoryAggregateParams {
  clothes: ClothItem[];
  rawMaterials: RawMaterial[];
  /** true عندما تكون كل قطع المخزون محمّلة في الواجهة (لا توجد صفحات متبقية) */
  clothesComplete: boolean;
}

interface UseInventoryAggregateResult {
  /** ملخص كامل المخزون — يظهر فوراً من الذاكرة المحلية ثم يُحدَّث من السحابة */
  aggregate: InventoryAggregate | null;
  /** true عندما تكون القيم من الصفحات المحمّلة فقط (تعذّر الحساب الكامل مؤقتاً) */
  isPartial: boolean;
  isRefreshing: boolean;
  lastError: boolean;
  refresh: (force?: boolean) => Promise<void>;
}

/**
 * يوفر قيم المخزون (قيمة الشراء، ثمن البيع، عدد القطع...) محسوبة من **كل** المخزون
 * دون الحاجة إلى تحميل كل القطع في الواجهة:
 * - إذا كانت كل القطع محمّلة محلياً → حساب فوري دقيق.
 * - وإلا → ملخص محفوظ محلياً + تحديث خلفي على صفحات من السحابة.
 */
export function useInventoryAggregate({
  clothes,
  rawMaterials,
  clothesComplete
}: UseInventoryAggregateParams): UseInventoryAggregateResult {
  const [cloudAggregate, setCloudAggregate] = useState<InventoryAggregate | null>(() => loadCachedInventoryAggregate());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState(false);
  const inFlightRef = useRef(false);

  const localAggregate = clothesComplete
    ? computeInventoryAggregate(clothes, rawMaterials)
    : null;

  const refresh = useCallback(async (force: boolean = true) => {
    if (inFlightRef.current) return;
    const cached = loadCachedInventoryAggregate();
    if (!force && !isInventoryAggregateStale(cached)) return;

    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      const fresh = await fetchInventoryAggregateFromCloud();
      const previous = cached || cloudAggregate;
      const looksEmpty = fresh.models === 0 && fresh.rawMaterialsCount === 0;
      const hadData = !!previous && (previous.models > 0 || previous.rawMaterialsCount > 0);

      // فشل الشبكة/القراءة يعيد أصفاراً — لا نمحو الملخص المحفوظ في هذه الحالة
      if (looksEmpty && hadData) {
        setLastError(true);
        return;
      }

      setCloudAggregate(fresh);
      saveCachedInventoryAggregate(fresh);
      setLastError(false);
    } catch (error) {
      console.warn('[InventoryAggregate] تعذر تحديث ملخص المخزون:', error);
      setLastError(true);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [cloudAggregate]);

  // تحديث خلفي مؤجل عند تغيّر المخزون (إضافة/تعديل/حذف أو تحميل صفحة جديدة)
  useEffect(() => {
    if (clothesComplete) return; // الحساب المحلي يكفي ودقيق
    const timer = setTimeout(() => {
      void refresh(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [clothes, rawMaterials, clothesComplete, refresh]);

  // إعادة الحساب فوراً بعد أي إضافة/تعديل/حذف في المخزون
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (clothesComplete) return;
      void refresh(true);
    };
    window.addEventListener(INVENTORY_AGGREGATE_INVALIDATED_EVENT, handler);
    return () => window.removeEventListener(INVENTORY_AGGREGATE_INVALIDATED_EVENT, handler);
  }, [clothesComplete, refresh]);

  // حفظ الملخص المحلي الدقيق عندما تصبح كل القطع محمّلة (ليظهر فوراً في الجلسات القادمة)
  useEffect(() => {
    if (localAggregate) saveCachedInventoryAggregate(localAggregate);
  }, [localAggregate]);

  const fallbackAggregate = cloudAggregate || (clothes.length > 0 || rawMaterials.length > 0
    ? computeInventoryAggregate(clothes, rawMaterials)
    : null);

  return {
    aggregate: localAggregate || fallbackAggregate,
    isPartial: !localAggregate && !cloudAggregate && !!fallbackAggregate,
    isRefreshing,
    lastError,
    refresh
  };
}
