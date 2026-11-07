/**
 * منطق ترحيل بنية البيانات — نسخة نقية (بلا Firebase) قابلة للاختبار.
 */

export interface LayoutMetaCore {
  layout: string;
  collections: string[];
  migratedAt?: string;
  updatedAt?: number;
}

/** تحويل قيمة Firebase (كائن مفاتيح أو مصفوفة) إلى خريطة سجلات بمفتاح id */
export function toRecordMap(value: any): Record<string, any> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, any> = {};

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const id = typeof item.id === 'string' && item.id ? item.id : String(index);
      result[id] = { ...item, id };
    });
    return result;
  }

  for (const [key, item] of Object.entries(value)) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, any>;
    result[record.id || key] = { ...record, id: record.id || key };
  }
  return result;
}

/**
 * السجلات الموجودة في المسار القديم وغير الموجودة في المسار الجديد.
 * يضمن إكمال أي نسخ انقطع في المنتصف، ويعيد كائن فارغاً إذا كان كل شيء منسوخاً.
 */
export function missingRecords(legacyValue: any, canonicalValue: any): Record<string, any> {
  const legacy = toRecordMap(legacyValue);
  const canonicalIds = new Set(Object.keys(toRecordMap(canonicalValue)));
  const missing: Record<string, any> = {};
  for (const [id, record] of Object.entries(legacy)) {
    if (!canonicalIds.has(id)) missing[id] = record;
  }
  return missing;
}

/** هل اكتمل ترحيل كل المجموعات المطلوبة؟ */
export function isLayoutComplete(
  meta: LayoutMetaCore | null | undefined,
  layoutVersion: string,
  collections: readonly string[]
): boolean {
  if (!meta || meta.layout !== layoutVersion) return false;
  const completed = new Set(Array.isArray(meta.collections) ? meta.collections : []);
  return collections.every(collection => completed.has(collection));
}
