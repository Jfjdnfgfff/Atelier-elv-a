export type PurposeType = 'sell' | 'rent' | 'both';
export type RentalStatus = 'reserved' | 'active' | 'overdue' | 'returned' | 'cleaning' | 'cancelled';
export type CautionStatus = 'held' | 'refunded' | 'deducted';

export interface ClothVariant {
  id: string;
  code?: string; // المرجع أو الباركود الخاص بالمقاس e.g. #3921
  size: string; // المقاس e.g. 44, 42, 40, 38
  color: string; // اللون e.g. أسود, وردي
  stock1: number; // متوفر في المحل
  stock2: number; // متوفر في المستودع
  stock: number; // إجمالي المتوفر
  price?: number; // سعر البيع الخاص بهذا المقاس
  rentPrice?: number; // سعر الكراء الخاص بهذا المقاس
  imageUrl?: string; // صورة خاصة بهذا اللون/المقاس
}

export interface ClothItem {
  id: string;
  name: string;
  barcode: string;
  category: string;
  purpose: PurposeType;
  buyCost: number;
  sellPrice: number;
  rentPrice: number;
  cautionAmount: number;
  size: string; // المقاس الأساسي أو سلسلة المقاسات
  sizes?: string[]; // قائمة المقاسات المتوفرة (لطاي المتوفرين)
  color: string; // اللون الأساسي أو سلسلة الألوان
  colors?: string[]; // قائمة الألوان المتوفرة
  stock: number; // Total stock (stock1 + stock2)
  stock1?: number; // Stock 1 (e.g. المحل / صالة العرض)
  stock2?: number; // Stock 2 (e.g. المستودع / التخزين)
  rentedCount: number;
  inCleaningCount: number;
  imageUrl?: string;
  thumbUrl?: string;
  hasFullImage?: boolean;
  updatedAt?: string;
  description?: string;
  variants?: ClothVariant[]; // تفاصيل كل مقاس ولون (لطاي والألوان)
}

export interface Rental {
  id: string;
  customerName: string;
  customerPhone: string;
  customerIdNumber?: string;
  itemId: string;
  itemName: string;
  itemSize: string;
  itemColor: string;
  qty: number;
  stockSource?: 'stock1' | 'stock2'; // Source stock: Stock 1 or Stock 2
  startDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  // Pricing breakdown: Dress + Accessories
  dressRentPrice?: number; // سعر كراء الفستان الأساسي
  hasAccessories?: boolean; // هل تم إضافة إكسسوارات مع الفستان
  accessoryName?: string; // بيان الإكسسوار (تاج، حزام، حقيبة، شال، مجوهرات...)
  accessoryPrice?: number; // سعر كراء الإكسسوارات الإضافية
  discountAmount?: number; // تخفيض السعر
  rentPrice: number; // السعر الكلي الإجمالي (الفستان + الإكسسوار)
  paidAmount: number;
  remainingAmount: number;
  cautionAmount: number;
  cautionStatus: CautionStatus;
  status: RentalStatus;
  handoverDate?: string; // Date when deal is finalized and dress is physically handed over
  bookingDate?: string; // Date of reservation
  conditionOnReturn?: 'perfect' | 'needs_cleaning' | 'damaged';
  penaltyAmount?: number;
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  itemId: string;
  name: string;
  size: string;
  color: string;
  qty: number;
  stockSource?: 'stock1' | 'stock2'; // Source stock: Stock 1 or Stock 2
  price: number;
  cost: number;
  total: number;
  imageUrl?: string;
}

export interface Sale {
  id: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  profit: number;
  date: string;
  notes?: string;
  discountAmount?: number; // تخفيض
  subtotalAmount?: number; // المبلغ قبل التخفيض
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  addressOrCity?: string;
  category?: string;
  notes?: string;
}

export interface RawMaterial {
  id: string;
  name: string; // اسم السلعة الأولية أو القماش (مثال: ساتان ملكي، حرير كريب، تول مطرز...)
  code?: string; // كود/مرجع القماش
  fabricType: string; // نوع القماش
  color: string; // اللون
  rollCount: number; // عدد الرولويات المتوفرة (Rouleaux)
  metersPerRoll: number; // طول الرولو الواحد بالمتر
  totalMeters: number; // إجمالي الأمتار = (rollCount * metersPerRoll) + looseMeters
  looseMeters?: number; // أمتار إضافية أو متبقية من رولو مفتوح
  costPerMeter: number; // سعر المتر الواحد (شراء / تكلفة)
  costPerRoll?: number; // سعر الرولو الواحد
  totalCostValue: number; // القيمة الإجمالية للسلعة بسعر التكلفة (totalMeters * costPerMeter)
  supplierId?: string;
  supplierName?: string;
  storageLocation?: string; // مكان التخزين (المستودع، الورشة، المحل)
  minAlertMeters?: number; // تنبيه نقص الأمتار
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ExpenseScope = 'rental' | 'sale' | 'tailoring' | 'general';

export interface Expense {
  id: string;
  category: string;
  desc: string;
  amount: number;
  date: string;
  expenseScope?: ExpenseScope; // فساتين كراء، فساتين بيع، خياطة، أو مصاريف عامة
  // Supplier purchase specific fields
  isSupplierPurchase?: boolean;
  supplierName?: string;
  supplierPhone?: string;
  goodsDescription?: string; // ماذا شريت عليه (تفاصيل السلعة المشتراة)
  totalInvoiceAmount?: number; // إجمالي مبلغ الفاتورة / السلعة
  paidAmount?: number; // شحال خلصته
  creditAmount?: number; // شحال كريدي / دين متبقي للمورد
  invoiceNumber?: string; // رقم الفاتورة أو الوصل
  notes?: string;
}

export interface Seamstress {
  id: string;
  name: string; // اسم الخياطة
  phone?: string;
  specialty?: string; // الاختصاص (قفاطين، تعديل، فساتين سهرة، تطريز...)
  addressOrCity?: string;
  ratePerPieceOrSalary?: string; // تسعيرة بالقطعة أو شهرية
  notes?: string;
  createdAt?: string;
}

export interface Credit {
  id: string;
  name: string;
  phone: string;
  type: string;
  desc: string;
  amount: number;
  date: string;
  relatedRentalId?: string;
  relatedExpenseId?: string;
  supplierDebt?: boolean; // هل هو دين للمورد (علينا للمورد)
  supplierName?: string;
  goodsDescription?: string;
  totalInvoiceAmount?: number;
  paidAmount?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone?: string;
  baseSalary: number;
  salaryType: 'monthly' | 'daily';
  workDaysPerMonth: number;
  dailyRate?: number;
  joinDate?: string;
  notes?: string;
}

export interface StaffAbsence {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  daysCount: number; // 1 for full day, 0.5 for half day
  reason?: string;
  deductionAmount: number;
  isDeducted: boolean;
  payoutId?: string;
}

export interface StaffPayout {
  id: string;
  staffId?: string;
  name: string;
  amount: number;
  baseAmount?: number;
  absenceDeduction?: number;
  advancesDeduction?: number;
  bonus?: number;
  absencesCount?: number;
  type: string;
  date: string;
  notes?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  idNumber?: string;
  measurements?: string;
  notes?: string;
  createdAt: string;
}

export type MaintenanceStatus = 'pending' | 'in_progress' | 'ready' | 'delivered';
export type MaintenanceServiceType = 'alteration' | 'repair' | 'custom_sewing' | 'ironing_prep' | 'other';
export type MaintenanceTargetType = 'internal_stock' | 'customer_order';

export interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  targetType: MaintenanceTargetType;
  itemId?: string;
  itemName: string;
  customerName?: string;
  customerPhone?: string;
  serviceType: MaintenanceServiceType;
  description: string;
  measurements?: string;
  tailorName?: string;
  cost: number; // قيمة التكليف الإجمالية
  laborCost?: number; // أتعاب الخياطة
  fabricCost?: number; // القماش والمواد
  extraCost?: number; // مصاريف أخرى
  price: number;
  paidAmount: number;
  remainingAmount: number;
  receivedDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  status: MaintenanceStatus;
  notes?: string;
  createdAt: string;
}

export interface DailyCaisseClosure {
  id: string;
  date: string; // YYYY-MM-DD
  openingBalance: number; // رصيد بداية اليوم (فوند دو كيس - Fond de caisse)
  salesIncome: number; // مدخول مبيعات اليوم
  rentalsIncome: number; // مدخول كراء اليوم
  tailoringIncome: number; // مدخول خياطة وتعديل اليوم
  cautionsReceived: number; // مبالغ الضمان المستلمة كاش
  expensesPaid: number; // مصاريف المحل المسددة كاش اليوم
  staffPayoutsPaid: number; // دفعات العمال المسددة كاش اليوم
  cautionsRefunded: number; // ضمانات تم إرجاعها للزبائن كاش
  totalInflow: number; // إجمالي المدخول
  totalOutflow: number; // إجمالي المصاريف
  theoreticalAmount: number; // المبلغ النظري المتوقع في الصندوق
  actualAmount: number; // المبلغ الفعلي الموجود في الصندوق (compté)
  difference: number; // الفارق: actualAmount - theoreticalAmount (سالب = عجز / manque، موجب = فائض / excédent)
  status: 'balanced' | 'shortage' | 'surplus'; // مطابق | عجز | فائض
  notes?: string;
  closedAt: string;
}

export type ActivityActionType = 'create' | 'update' | 'delete' | 'return' | 'deal' | 'status_change' | 'payment' | 'closure';
export type ActivityCategory = 'all' | 'inventory' | 'rentals' | 'sales' | 'tailoring' | 'expenses' | 'credits' | 'caisse' | 'staff' | 'partners';

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  actionType: ActivityActionType;
  category: ActivityCategory;
  title: string; // e.g. "تعديل كمية مقاس", "تسجيل كراء جديد", "حذف فستان"
  details: string; // تفاصيل العملية الدقيقة
  itemCodeOrId?: string;
  performedBy?: string;
  amount?: number;
  notes?: string;
}

export type ViewType = 'dashboard' | 'rentals' | 'inventory' | 'sales' | 'expenses' | 'credits' | 'tailoring' | 'customers' | 'caisse' | 'partners' | 'logs';
