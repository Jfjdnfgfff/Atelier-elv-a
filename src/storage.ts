import { 
  ClothItem, 
  Rental, 
  Sale, 
  Expense, 
  Credit, 
  StaffPayout,
  StaffMember,
  StaffAbsence,
  CustomerProfile,
  MaintenanceOrder,
  Supplier,
  DailyCaisseClosure,
  RawMaterial,
  Seamstress,
  ActivityLog
} from './types';
import { saveToFirebase } from './firebase';

export const STORAGE_KEYS = {
  CLOTHES: 'boutique_clothes',
  RENTALS: 'boutique_rentals',
  SALES: 'boutique_sales',
  EXPENSES: 'boutique_expenses',
  CREDITS: 'boutique_credits',
  STAFF_PAYOUTS: 'boutique_staff_payouts',
  STAFF_MEMBERS: 'boutique_staff_members',
  STAFF_ABSENCES: 'boutique_staff_absences',
  CUSTOMERS: 'boutique_customers',
  MAINTENANCE: 'boutique_maintenance',
  SUPPLIERS: 'boutique_suppliers',
  SEAMSTRESSES: 'boutique_seamstresses',
  RAW_MATERIALS: 'boutique_raw_materials',
  CAISSE_CLOSURES: 'boutique_caisse_closures',
  ACTIVITY_LOGS: 'boutique_activity_logs',
  SECURITY_PIN: 'bm_security_pin',
  STORE_CONFIG: 'boutique_store_config'
};

export const DEFAULT_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'log_init_1',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    actionType: 'create',
    category: 'inventory',
    title: 'تهيئة المخزون وإضافة فساتين وأقمشة',
    details: 'إضافة موديلات فساتين سهرة، قفاطين وأقمشة ساتان للمخزن',
    performedBy: 'إدارة البوتيك'
  },
  {
    id: 'log_init_2',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    actionType: 'deal',
    category: 'rentals',
    title: 'تسجيل كراء فستان سهرة',
    details: 'كراء فستان سهرة كلاسيكي مطرز ذهبي للزبونة فاطمة الزهراء بوعلام بمبلغ 6,000 دج وضمان 4,000 دج',
    amount: 6000,
    performedBy: 'المسؤول'
  },
  {
    id: 'log_init_3',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    actionType: 'create',
    category: 'expenses',
    title: 'تسجيل مصاريف تنظيف جاف',
    details: 'تنظيف جاف لـ 4 فساتين سهرة بعد الكراء (Pressing) بمبلغ 3,200 دج',
    amount: 3200,
    performedBy: 'المسؤول'
  }
];

export const DEFAULT_RAW_MATERIALS: RawMaterial[] = [
  {
    id: 'mat_1',
    name: 'ساتان حريري ملكي (Satin Duchesse)',
    code: 'FAB-SAT-01',
    fabricType: 'ساتان ملكي فاخر',
    color: 'أوف وايت (أبيض عاجي)',
    rollCount: 4,
    metersPerRoll: 30,
    looseMeters: 5,
    totalMeters: 125,
    costPerMeter: 850,
    costPerRoll: 25500,
    totalCostValue: 106250,
    supplierName: 'شركة النسيج الملكي للأقمشة والحرير',
    storageLocation: 'ورشة الخياطة',
    minAlertMeters: 20,
    notes: 'قماش أساسي لفساتين الأعراس وبطانات القفاطين.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat_2',
    name: 'كريب جورجيت فرنسي ناعم',
    code: 'FAB-CRP-02',
    fabricType: 'كريب جورجيت',
    color: 'أخضر زمردي',
    rollCount: 3,
    metersPerRoll: 25,
    looseMeters: 8,
    totalMeters: 83,
    costPerMeter: 1200,
    costPerRoll: 30000,
    totalCostValue: 99600,
    supplierName: 'شركة النسيج الملكي للأقمشة والحرير',
    storageLocation: 'مستودع الأقمشة',
    minAlertMeters: 15,
    notes: 'مخصص للعبايات وفساتين السهرة الإنسيابية.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat_3',
    name: 'مخمل ملكي قطيفة راقية (Velours Royal)',
    code: 'FAB-VEL-03',
    fabricType: 'مخمل قطيفة',
    color: 'بوردو عنابي',
    rollCount: 2,
    metersPerRoll: 20,
    looseMeters: 4,
    totalMeters: 44,
    costPerMeter: 1800,
    costPerRoll: 36000,
    totalCostValue: 79200,
    supplierName: 'دار القفطان والتطريز التقليدي',
    storageLocation: 'ورشة الخياطة',
    minAlertMeters: 10,
    notes: 'مخصص لخياطة الكراكو والقفطان العاصمي.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat_4',
    name: 'تول مطرز بالخرز والكريستال اللامع',
    code: 'FAB-TUL-04',
    fabricType: 'تول ودانتيل مطرز',
    color: 'وردي بودري (Rose Poudré)',
    rollCount: 3,
    metersPerRoll: 15,
    looseMeters: 2,
    totalMeters: 47,
    costPerMeter: 2500,
    costPerRoll: 37500,
    totalCostValue: 117500,
    supplierName: 'مؤسسة الأناقة للأزياء والفساتين',
    storageLocation: 'صالة العرض / المحل',
    minAlertMeters: 10,
    notes: 'تول تركي مطرز يدوي عالي الجودة للعرائس.',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SEAMSTRESSES: Seamstress[] = [
  {
    id: 'seam_1',
    name: 'حليمة بوزيد',
    phone: '0661223344',
    specialty: 'تعديل مقاسات وفساتين سهرة',
    addressOrCity: 'الجزائر العاصمة',
    ratePerPieceOrSalary: 'بالقطعة (800 - 3000 دج)',
    notes: 'خبرة 10 سنوات في خياطة وتضييق فساتين السهرة والأعراس.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seam_2',
    name: 'فاطمة ناصري',
    phone: '0555889900',
    specialty: 'قفاطين وكراكو وتطريز تقليدي',
    addressOrCity: 'البليدة',
    ratePerPieceOrSalary: 'بالقطعة (3000 - 15000 دج)',
    notes: 'متخصصة في الصناعة التقليدية والفتلة والمجبود.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seam_3',
    name: 'ياسمين عيساوي',
    phone: '0770334455',
    specialty: 'صيانة، سحابات وكي وتجهيز',
    addressOrCity: 'بومرداس',
    ratePerPieceOrSalary: 'راتب شهري / بالقطعة',
    notes: 'سريعة في تصليح السحابات وتجهيز الفساتين للكراء.',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_1',
    name: 'مؤسسة الأناقة للأزياء والفساتين',
    phone: '0550123456',
    addressOrCity: 'الجزائر العاصمة',
    category: 'فساتين سهرة وأعراس جاهزة',
    notes: 'مورد فساتين تركية ولبنانية فاخرة.'
  },
  {
    id: 'sup_2',
    name: 'شركة النسيج الملكي للأقمشة والحرير',
    phone: '0770987654',
    addressOrCity: 'وهران',
    category: 'أقمشة، حرير وتطريزات',
    notes: 'أقمشة كريب، ساتان ملكي، وتول دانتيل.'
  },
  {
    id: 'sup_3',
    name: 'دار القفطان والتطريز التقليدي',
    phone: '0661234567',
    addressOrCity: 'تلمسان',
    category: 'قفاطين، كراكو وبرنوس',
    notes: 'مورد متخصص في الصناعة التقليدية الفاخرة بالفتلة والمجبود.'
  }
];

export const DEFAULT_MAINTENANCE: MaintenanceOrder[] = [
  {
    id: 'maint_1',
    orderNumber: 'TAIL-101',
    targetType: 'customer_order',
    itemName: 'فستان سهرة تول أسود',
    customerName: 'سميرة بلحاج',
    customerPhone: '0661223344',
    serviceType: 'alteration',
    description: 'تضييق الخصر 2 سم وتقصير الطول 3 سم مع الحفاظ على التطريز السفلي',
    measurements: 'الصدر: 92 سم | الخصر: 74 سم | الطول الكلي: 145 سم',
    tailorName: 'حليمة بوزيد',
    cost: 800,
    price: 2500,
    paidAmount: 1500,
    remainingAmount: 1000,
    receivedDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    status: 'in_progress',
    notes: 'مستعجل قبل عطلة نهاية الأسبوع.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'maint_2',
    orderNumber: 'TAIL-102',
    targetType: 'internal_stock',
    itemId: 'item_1',
    itemName: 'فستان سهرة كلاسيكي مطرز ذهبي',
    serviceType: 'repair',
    description: 'إصلاح السحاب الخلفي وتثبيت بعض حبات الخرز المتساقطة بعد الإرجاع',
    tailorName: 'حليمة بوزيد',
    cost: 500,
    price: 0,
    paidAmount: 0,
    remainingAmount: 0,
    receivedDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
    status: 'pending',
    notes: 'صيانة وقائية وإعادة للمخزون.',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'staff_1',
    name: 'أمينة منصوري',
    role: 'مساعدة بيع وكراء',
    phone: '0550112233',
    baseSalary: 35000,
    salaryType: 'monthly',
    workDaysPerMonth: 26,
    dailyRate: Math.round(35000 / 26),
    joinDate: '2024-01-10'
  },
  {
    id: 'staff_2',
    name: 'حليمة بوزيد',
    role: 'خياطة وتعديل مقاسات',
    phone: '0660445566',
    baseSalary: 40000,
    salaryType: 'monthly',
    workDaysPerMonth: 26,
    dailyRate: Math.round(40000 / 26),
    joinDate: '2024-02-01'
  }
];

export const DEFAULT_CLOTHES: ClothItem[] = [
  {
    id: 'item_1',
    name: 'فستان سهرة أسود كلاسيكي فاخر',
    barcode: '3918',
    category: 'فساتين سهرة',
    purpose: 'both',
    buyCost: 3500,
    sellPrice: 7200,
    rentPrice: 4000,
    cautionAmount: 3000,
    size: '44، 42، 40، 38',
    sizes: ['44', '42', '40', '38'],
    color: 'أسود',
    colors: ['أسود'],
    stock1: 8,
    stock2: 8,
    stock: 16,
    rentedCount: 1,
    inCleaningCount: 0,
    imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
    description: 'فستان سهرة راقي بقماش التول والمخمل مع تطريز يدوي فاخر.',
    variants: [
      { id: 'var_3921', code: '3921', size: '44', color: 'أسود', stock1: 2, stock2: 2, stock: 4, price: 7200, imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80' },
      { id: 'var_3920', code: '3920', size: '42', color: 'أسود', stock1: 2, stock2: 2, stock: 4, price: 7200, imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80' },
      { id: 'var_3919', code: '3919', size: '40', color: 'أسود', stock1: 2, stock2: 2, stock: 4, price: 7200, imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80' },
      { id: 'var_3918', code: '3918', size: '38', color: 'أسود', stock1: 2, stock2: 2, stock: 4, price: 7200, imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80' }
    ]
  },
  {
    id: 'item_2',
    name: 'قفطان ملكي أصيل مع الحزام',
    barcode: '6130002',
    category: 'أزياء تقليدية وقفاطين',
    purpose: 'rent',
    buyCost: 22000,
    sellPrice: 45000,
    rentPrice: 8500,
    cautionAmount: 5000,
    size: 'Standard',
    color: 'أخضر زمردي',
    stock1: 1,
    stock2: 2,
    stock: 3,
    rentedCount: 1,
    inCleaningCount: 0,
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
    description: 'قفطان تقليدي للمناسبات والأعراس مع سفيفة وحزام مميز.'
  },
  {
    id: 'item_3',
    name: 'بدلة رجالية رسمية 3 قطع (Smokings)',
    barcode: '6130003',
    category: 'بدلات وأطقم رجالية',
    purpose: 'both',
    buyCost: 12000,
    sellPrice: 24000,
    rentPrice: 5000,
    cautionAmount: 3000,
    size: '50 (L)',
    color: 'كحلي داكن',
    stock1: 2,
    stock2: 3,
    stock: 5,
    rentedCount: 0,
    inCleaningCount: 1,
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop&q=80',
    description: 'بدلة كاملة (سترة + بنطلون + صدرية) مناسبة للعرسان وحفلات التخرج.'
  },
  {
    id: 'item_4',
    name: 'فستان خطوبة برنسيس ناعم',
    barcode: '6130004',
    category: 'فساتين سهرة',
    purpose: 'rent',
    buyCost: 18000,
    sellPrice: 38000,
    rentPrice: 7000,
    cautionAmount: 4500,
    size: '36',
    color: 'وردي بودري (Rose Poudré)',
    stock1: 1,
    stock2: 1,
    stock: 2,
    rentedCount: 0,
    inCleaningCount: 0,
    imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&auto=format&fit=crop&q=80',
    description: 'فستان راقي جداً بقصة برنسيس مع جوبون منفوش خفيف.'
  },
  {
    id: 'item_5',
    name: 'عباية تركية فاخرة كاجوال',
    barcode: '6130005',
    category: 'عبايات وملابس كاجوال',
    purpose: 'sell',
    buyCost: 4500,
    sellPrice: 8500,
    rentPrice: 0,
    cautionAmount: 0,
    size: '42',
    color: 'بيج رمادي',
    stock1: 4,
    stock2: 6,
    stock: 10,
    rentedCount: 0,
    inCleaningCount: 0,
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop&q=80',
    description: 'عباية حرير كريب ممتازة للإطلالات اليومية والزيارات.'
  },
  {
    id: 'item_6',
    name: 'طقم إكسسوارات وتاج مرصع',
    barcode: '6130006',
    category: 'إكسسوارات وحقائب',
    purpose: 'both',
    buyCost: 2000,
    sellPrice: 4500,
    rentPrice: 1500,
    cautionAmount: 1000,
    size: 'One Size',
    color: 'فضي لامع',
    stock1: 3,
    stock2: 3,
    stock: 6,
    rentedCount: 0,
    inCleaningCount: 0,
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80',
    description: 'تاج للعرائس مع عقد وأقراط متناسقة.'
  }
];

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
};

export const DEFAULT_RENTALS: Rental[] = [
  {
    id: 'rent_1',
    customerName: 'فاطمة الزهراء بوعلام',
    customerPhone: '0555123456',
    customerIdNumber: '1192837465',
    itemId: 'item_1',
    itemName: 'فستان سهرة كلاسيكي مطرز ذهبي',
    itemSize: '38',
    itemColor: 'أسود وذهبي',
    qty: 1,
    startDate: getYesterday(),
    expectedReturnDate: getTomorrow(),
    rentPrice: 6000,
    paidAmount: 6000,
    remainingAmount: 0,
    cautionAmount: 4000,
    cautionStatus: 'held',
    status: 'active',
    notes: 'مناسبة زفاف عائلي يوم الجمعة.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'rent_2',
    customerName: 'سارة مرابطي',
    customerPhone: '0770987654',
    customerIdNumber: '1083746251',
    itemId: 'item_2',
    itemName: 'قفطان ملكي أصيل مع الحزام',
    itemSize: 'Standard',
    itemColor: 'أخضر زمردي',
    qty: 1,
    startDate: getYesterday(),
    expectedReturnDate: getTomorrow(),
    rentPrice: 8500,
    paidAmount: 5000,
    remainingAmount: 3500,
    cautionAmount: 5000,
    cautionStatus: 'held',
    status: 'active',
    notes: 'عربون متبقي 3500 دج عند الإرجاع.',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_EXPENSES: Expense[] = [
  { id: 'exp_1', category: 'غسيل وتنظيف جاف (Pressing)', desc: 'تنظيف جاف لـ 4 فساتين سهرة بعد الكراء', amount: 3200, date: new Date().toISOString() },
  { id: 'exp_2', category: 'كراء المحل وفواتير', desc: 'فاتورة الكهرباء لشهر الكراء', amount: 4500, date: new Date().toISOString() },
  { id: 'exp_3', category: 'تغليف وأكياس ملابس', desc: 'شراء أكياس فساتين فاخرة ومقابض خشبية', amount: 2800, date: new Date().toISOString() }
];

export const DEFAULT_CAISSE_CLOSURES: DailyCaisseClosure[] = [
  {
    id: 'caisse_prev_1',
    date: getYesterday(),
    openingBalance: 15000,
    salesIncome: 17000,
    rentalsIncome: 11000,
    tailoringIncome: 2500,
    cautionsReceived: 9000,
    expensesPaid: 3200,
    staffPayoutsPaid: 0,
    cautionsRefunded: 4000,
    totalInflow: 39500,
    totalOutflow: 7200,
    theoreticalAmount: 47300,
    actualAmount: 47000,
    difference: -300,
    status: 'shortage',
    notes: 'عجز طفيف في الصرف مع نهاية اليوم',
    closedAt: new Date(Date.now() - 86400000).toISOString()
  }
];

// In-memory cache for fast, synchronous lookups without reading localStorage repeatedly
const memoryStore = new Map<string, any>();
const storageFlushDebouncers = new Map<string, any>();
const lastWrittenRef = new Map<string, any>();

export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T;
  }
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      memoryStore.set(key, defaultValue);
      return defaultValue;
    }
    const parsed = JSON.parse(item);
    memoryStore.set(key, parsed);
    lastWrittenRef.set(key, parsed);
    return parsed;
  } catch (e) {
    console.error(`Error loading key ${key} from storage:`, e);
    memoryStore.set(key, defaultValue);
    return defaultValue;
  }
};

export const saveToStorage = <T>(key: string, data: T, syncFirebase: boolean = false): void => {
  // If the exact same object/array reference is passed and not forcing cloud sync, avoid redundant serialization
  if (lastWrittenRef.get(key) === data && !syncFirebase) {
    return;
  }
  lastWrittenRef.set(key, data);

  // If saving an array of items with IDs (e.g. sales, rentals, expenses), merge with existing stored items to preserve local offline history
  let dataToPersist: any = data;
  if (Array.isArray(data) && data.length > 0 && (data[0] as any)?.id) {
    const existing = memoryStore.get(key);
    if (Array.isArray(existing) && existing.length > 0) {
      const map = new Map<string, any>();
      for (const item of existing) {
        if (item && item.id) map.set(item.id, item);
      }
      for (const item of data) {
        if (item && item.id) map.set(item.id, item);
      }
      dataToPersist = Array.from(map.values());
    }
  }

  // Update in-memory cache instantly
  memoryStore.set(key, dataToPersist);

  // Debounce disk/localStorage I/O to avoid freezing UI thread on frequent updates
  if (storageFlushDebouncers.has(key)) {
    clearTimeout(storageFlushDebouncers.get(key));
  }

  const timer = setTimeout(() => {
    try {
      // Keep localStorage within safe limits (latest 300 items for array collections)
      const storagePayload = Array.isArray(dataToPersist) && dataToPersist.length > 300
        ? dataToPersist.slice(0, 300)
        : dataToPersist;
      localStorage.setItem(key, JSON.stringify(storagePayload));
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        console.warn(`[localStorage quota exceeded for ${key}], trimming offline snapshot`);
        try {
          if (Array.isArray(dataToPersist)) {
            localStorage.setItem(key, JSON.stringify(dataToPersist.slice(0, 50)));
          }
        } catch (_) {}
      } else {
        console.error(`Error saving key ${key} to storage:`, e);
      }
    }
    storageFlushDebouncers.delete(key);
  }, 150);

  storageFlushDebouncers.set(key, timer);

  if (syncFirebase && Array.isArray(data)) {
    saveToFirebase(key, data).catch((err) => {
      console.warn(`[Firebase sync warning for ${key}]:`, err);
    });
  }
};

export const generateId = (): string => {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
};

export const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.CLOTHES)) {
    saveToStorage(STORAGE_KEYS.CLOTHES, DEFAULT_CLOTHES);
  } else {
    // Backfill images and normalize stock1/stock2 for items
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLOTHES) || '[]');
      let updated = false;
      const patched = stored.map((item: ClothItem) => {
        let currentItem = { ...item };
        if (!currentItem.imageUrl) {
          const match = DEFAULT_CLOTHES.find(d => d.id === currentItem.id || d.name === currentItem.name);
          if (match && match.imageUrl) {
            updated = true;
            currentItem.imageUrl = match.imageUrl;
          }
        }
        // Ensure stock1 and stock2 are populated
        if (currentItem.stock1 === undefined || currentItem.stock2 === undefined) {
          updated = true;
          const s1 = currentItem.stock1 !== undefined ? currentItem.stock1 : Math.max(0, currentItem.stock || 1);
          const s2 = currentItem.stock2 !== undefined ? currentItem.stock2 : 0;
          currentItem.stock1 = s1;
          currentItem.stock2 = s2;
          currentItem.stock = s1 + s2;
        }
        return currentItem;
      });
      if (updated) {
        saveToStorage(STORAGE_KEYS.CLOTHES, patched);
      }
    } catch (e) {
      console.error(e);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.RENTALS)) {
    saveToStorage(STORAGE_KEYS.RENTALS, DEFAULT_RENTALS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SALES)) {
    saveToStorage(STORAGE_KEYS.SALES, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
    saveToStorage(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CREDITS)) {
    saveToStorage(STORAGE_KEYS.CREDITS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STAFF_PAYOUTS)) {
    saveToStorage(STORAGE_KEYS.STAFF_PAYOUTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STAFF_MEMBERS)) {
    saveToStorage(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STAFF_ABSENCES)) {
    saveToStorage(STORAGE_KEYS.STAFF_ABSENCES, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    saveToStorage(STORAGE_KEYS.CUSTOMERS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUPPLIERS)) {
    saveToStorage(STORAGE_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SEAMSTRESSES)) {
    saveToStorage(STORAGE_KEYS.SEAMSTRESSES, DEFAULT_SEAMSTRESSES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.RAW_MATERIALS)) {
    saveToStorage(STORAGE_KEYS.RAW_MATERIALS, DEFAULT_RAW_MATERIALS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MAINTENANCE)) {
    saveToStorage(STORAGE_KEYS.MAINTENANCE, DEFAULT_MAINTENANCE);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CAISSE_CLOSURES)) {
    saveToStorage(STORAGE_KEYS.CAISSE_CLOSURES, DEFAULT_CAISSE_CLOSURES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS)) {
    saveToStorage(STORAGE_KEYS.ACTIVITY_LOGS, DEFAULT_ACTIVITY_LOGS);
  }
};
