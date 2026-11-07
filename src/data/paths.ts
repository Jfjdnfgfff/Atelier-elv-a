/**
 * تنظيم مسارات قاعدة البيانات (Firebase Realtime Database)
 * ------------------------------------------------------
 * تُجمَّع المجموعات في وحدات (Modules) منطقية بدل جذر مسطّح واحد:
 *
 *   inventory/   المخزون: القطع، الأقمشة، الموردون، الصور المصغّرة والكاملة، فهرس البحث
 *   finance/     المالية: المبيعات، المصاريف، الديون، دفعات الديون، تقفيلات الصندوق
 *   operations/  العمليات: الكراء، الخياطة والتعديل
 *   people/      الأشخاص: العمال، دفعاتهم، غياباتهم، الخياطات، دفعاتهن
 *   system/      النظام: سجلات العمليات، الإعدادات، السلة، بيانات الترحيل، بصمات الكاش
 *
 * كل مجموعة تبقى مفاتيح مستندات مستقلة: `inventory/clothes/{id}`.
 * هذا يسمح لكل قسم بتحميل مساره فقط، ويجعل قواعد الفهرسة أدق.
 *
 * التوافق الخلفي: البيانات القديمة كانت مسطّحة في الجذر (`clothes`, `sales`, ...)
 * لذلك يبقى المسار القديم مقروءاً، والترحيل نسخٌ فقط (لا حذف) عبر layoutMigration.ts.
 */

export const DATA_LAYOUT_VERSION = 'namespaced-v1' as const;

export type DataModule = 'inventory' | 'finance' | 'operations' | 'people' | 'system';

/** خريطة المجموعة → الوحدة المنطقية */
export const COLLECTION_MODULES: Record<string, DataModule> = {
  // المخزون
  clothes: 'inventory',
  rawMaterials: 'inventory',
  suppliers: 'inventory',
  clothThumbs: 'inventory',
  clothImages: 'inventory',
  searchIndex: 'inventory',

  // المالية
  sales: 'finance',
  expenses: 'finance',
  credits: 'finance',
  creditPayments: 'finance',
  caisseClosures: 'finance',

  // العمليات
  rentals: 'operations',
  maintenanceOrders: 'operations',

  // الأشخاص
  staffMembers: 'people',
  staffPayouts: 'people',
  staffAbsences: 'people',
  seamstresses: 'people',
  seamstressPayments: 'people',

  // النظام
  activityLogs: 'system',
  appSettings: 'system',
  trash: 'system',
  cacheMeta: 'system',
  meta: 'system'
};

/**
 * المجموعات التي تُرحَّل من الجذر المسطّح إلى المسارات المنظّمة.
 * ملاحظة: الصور والمصغّرات (clothThumbs/clothImages) مستثناة عمداً لأنها بيانات ثنائية ضخمة؛
 * تقرأها الوحدة من المسار الجديد أو القديم (fallback) وتُكتب الجديدة في المسار المنظّم فقط.
 */
export const MIGRATABLE_COLLECTIONS: readonly string[] = [
  'clothes',
  'rawMaterials',
  'suppliers',
  'sales',
  'expenses',
  'credits',
  'creditPayments',
  'caisseClosures',
  'rentals',
  'maintenanceOrders',
  'staffMembers',
  'staffPayouts',
  'staffAbsences',
  'seamstresses',
  'seamstressPayments',
  'activityLogs',
  'appSettings'
];

export const moduleForCollection = (collection: string): DataModule =>
  COLLECTION_MODULES[collection] || 'system';

/** المسار المعتمد (المنظّم) لأي مجموعة، مثال: inventory/clothes */
export const dataPath = (collection: string): string =>
  `${moduleForCollection(collection)}/${collection}`;

/** المسار القديم (جذر مسطّح) — يُقرأ للتوافق ويُكتب فيه أثناء فترة الانتقال */
export const legacyPath = (collection: string): string => collection;

/** مسار مفتاح داخل وحدة النظام، مثال: system/meta */
export const systemPath = (key: string): string => `system/${key}`;

/** فهرس البحث السحابي المخفّف: inventory/searchIndex/{entity}/{id} */
export const searchIndexPath = (entity: string = 'clothes'): string =>
  `${dataPath('searchIndex')}/${entity}`;

/** بصمة تعديل مجموعة (تُستخدم لإبطال الكاش): system/cacheMeta/{collection} */
export const cacheMetaPath = (collection: string): string =>
  `${systemPath('cacheMeta')}/${collection}`;

/** هل المجموعة معروفة وتحتاج ترحيلاً؟ */
export const isMigratableCollection = (collection: string): boolean =>
  MIGRATABLE_COLLECTIONS.includes(collection);

/**
 * أثناء فترة الانتقال تُكرَّر الكتابة إلى المسار القديم أيضاً حتى تبقى
 * الأجهزة التي لم تُحدَّث تعمل على بيانات حديثة. يمكن إيقافها بمتغيّر واحد.
 */
export const MIRROR_WRITES_TO_LEGACY_PATH =
  (import.meta as any)?.env?.VITE_MIRROR_LEGACY !== 'false';
