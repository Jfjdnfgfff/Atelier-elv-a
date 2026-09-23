import {
  ClothItem,
  Rental,
  Sale,
  Expense,
  Credit,
  StaffMember,
  StaffAbsence,
  StaffPayout,
  MaintenanceOrder,
  Supplier,
  Seamstress,
  RawMaterial,
  DailyCaisseClosure,
  ActivityLog
} from '../types';

// Helper to format ISO dates
const getPastDate = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const getFutureDate = (daysAhead: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

// 1. GENERATE 50 CLOTHES / INVENTORY ITEMS
export const generate50Clothes = (): ClothItem[] => {
  const categories = [
    'فساتين سهرة',
    'قفاطين تقليدية',
    'فساتين زفاف',
    'كاراكو عاصمي',
    'جبة قسنطينية',
    'برنوس وملحقات',
    'بدلات سهرة نسائية',
    'بلوزة وهرانية'
  ];

  const dressNames = [
    'قفطان ملكي فاخر مطرز بالحرير والمجبود',
    'فستان سهرة حورية البحر كريب ساتان',
    'كاراكو عاصمي حرير أصيل مع مجدول ذهبي',
    'جبة قسنطينية قطيفة مطرزة بالمجبود والفتلة',
    'فستان عروس برنسيس مطرز بكريستال سواروفسكي',
    'قفطان مغربي عصري مع حزام مطلي بالذهب',
    'فستان سهرة تركي أنيق ساتان ناعم',
    'برنوس جزائري أصيل صوف ناعم وتطريز حريري',
    'بلوزة وهرانية ملكية مرصعة بالأحجار الكريمة',
    'فستان خطوبة كلاسيكي وردي بودري مع كاب تول',
    'بدلة سهرة نسائية راقية باللون الأسود الملكي',
    'قفطان قطيفة شتوية مطرز بالخيوط الصم الذهبية',
    'فستان سهرة إيطالي شيفون مطوي بليسيه',
    'كاراكو مخمل عنابي بتطريز تقليدي يدوي',
    'فستان زفاف موديل A-Line مع ذيل طويل دانتيل',
    'فستان سهرة زمردي فاخر بقصة أوف شولدر',
    'قفطان حرير ديوشيس بلون أزرق لؤلؤي',
    'جبة فرقاني قسنطينية تراثية أصيلة',
    'فستان سهرة لامع بقماش كافيار فاخر',
    'فستان زفاف دانتيل فرنسي مع أكمام شفافة',
    'قفطان مغربي قطعتين مطرز بالتلي روز',
    'كاراكو عاصمي أسود وذهبي مع سروال مدور',
    'فستان سهرة بوردو مفتوح الظهر أنيق',
    'فستان خطوبة لافندر مطرز بالورود ثلاثية الأبعاد',
    'بلوزة وهرانية عصرية مطرزة بالسمسم والخرز',
    'فستان سهرة ساتان أحمر ياقوتي بقصة ملكية',
    'قفطان شيفون مطرز بالخيوط الفضية والأحجار',
    'برنوس عروس أبيض دانتيل ملكي فاخر',
    'فستان زفاف تركي مطرز باللؤلؤ الطبيعي',
    'فستان سهرة مخمل كحلي مع حزام كريستال',
    'كاراكو عاصمي أخضر ملكي بطرز الفتلة التلمساني',
    'قفطان حرير ميكادو أنيق مع كاب شيفون',
    'فستان سهرة روز غولد برّاق للخطوبة والمناسبات',
    'جبة قسنطينية قطيفة جنزارية طرز إتقان',
    'فستان عروس ستان ميكادو بقصة سمبل راقية',
    'فستان سهرة زمردي بكتف واحد مطرز يدويًا',
    'قفطان مغربي مطرز بالسفيفة والعقد اليدوية',
    'بدلة سهرة نسائية بيضاء مطرزة على الأكتاف',
    'فستان سهرة موف غامق كريب استرتش مميز',
    'كاراكو شتوي قطيفة كحلي طرز فتلة مذهب',
    'فستان زفاف موديل حورية البحر مع ذيل قابل للفصل',
    'فستان سهرة نيود بيج مطرز بالخرز والكريستال',
    'قفطان عروس قطعتين مع حزام مذهب عريض',
    'بلوزة وهرانية بيضاء مذهبة للمناسبات والأعراس',
    'فستان سهرة تركي كلوش أسود مع تطريز ناعم',
    'برنوس حرير جزائري للعروس مع تطريز راقي',
    'فستان خطوبة أزرق سماوي تول ملكي متعدد الطبقات',
    'جبة قسنطينية قطيفة سوداء طرز مجبود ذهبي',
    'قفطان بروكار هندي فاخر مع تطريز عصري',
    'فستان سهرة ميتاليك فضي راقي للعرائس'
  ];

  const colors = ['أزرق ملكي', 'أحمر زمردي', 'ذهبي', 'أسود ملكي', 'عنابي', 'وردي بودري', 'أبيض لؤلؤي', 'أخضر ملكي', 'موف', 'فضيل لوريكس'];
  const sizes = ['38', '40', '42', '44', '46'];

  return dressNames.map((name, i) => {
    const id = `item_${i + 1}`;
    const cat = categories[i % categories.length];
    const isTraditional = cat.includes('قفطان') || cat.includes('كاراكو') || cat.includes('جبة');
    const purpose = i % 3 === 0 ? 'both' : i % 3 === 1 ? 'rent' : 'sell';
    const buyCost = 15000 + (i * 1150) % 50000;
    const sellPrice = Math.round(buyCost * 1.8 / 500) * 500;
    const rentPrice = Math.round(buyCost * 0.35 / 500) * 500;
    const cautionAmount = Math.round(rentPrice * 1.2 / 500) * 500;

    const availableSizes = [sizes[i % sizes.length], sizes[(i + 1) % sizes.length], sizes[(i + 2) % sizes.length]];
    const availableColors = [colors[i % colors.length], colors[(i + 3) % colors.length]];

    const variants = availableSizes.flatMap((s, sIdx) => 
      availableColors.map((c, cIdx) => ({
        id: `var_${i + 1}_${sIdx}_${cIdx}`,
        code: `#${3000 + (i * 10) + sIdx + cIdx}`,
        size: s,
        color: c,
        stock1: 1 + ((i + sIdx) % 3),
        stock2: (i + cIdx) % 2,
        stock: (1 + ((i + sIdx) % 3)) + ((i + cIdx) % 2),
        price: sellPrice,
        rentPrice: rentPrice
      }))
    );

    const totalStock1 = variants.reduce((acc, v) => acc + v.stock1, 0);
    const totalStock2 = variants.reduce((acc, v) => acc + v.stock2, 0);

    return {
      id,
      name,
      barcode: `DZ-${String(1001 + i).padStart(4, '0')}`,
      category: cat,
      purpose,
      buyCost,
      sellPrice,
      rentPrice,
      cautionAmount,
      size: availableSizes.join(', '),
      sizes: availableSizes,
      color: availableColors.join(' - '),
      colors: availableColors,
      stock: totalStock1 + totalStock2,
      stock1: totalStock1,
      stock2: totalStock2,
      rentedCount: (i % 4 === 0) ? 2 : (i % 4 === 1) ? 1 : 0,
      inCleaningCount: i % 7 === 0 ? 1 : 0,
      description: isTraditional ? 'قطعة تراثية أصيلة متقنة الصنع ومطرزة باليد' : 'فستان سهرة عالي الجودة بتصميم عالمي عصري',
      variants
    };
  });
};

// 2. GENERATE 50 RENTALS
export const generate50Rentals = (clothes: ClothItem[]): Rental[] => {
  const customerNames = [
    'سارة بن علي', 'أمينة بلقاسم', 'مريم حداد', 'ياسمين شريف', 'نادية بوجمعة',
    'إيناس رحماني', 'وفاء زروقي', 'خديجة عماري', 'صبرينة بوزيد', 'ليلى مزيان',
    'فاطمة بوعلام', 'أسماء منصوري', 'جهيدة سعدي', 'سلمى براهيمي', 'رانيا حماني',
    'حنان غربي', 'سميرة بن عيسى', 'منال قدور', 'نهال طالبي', 'نسرين دراجي',
    'شيماء طاهري', 'ابتسام علام', 'كوثر بختي', 'سعاد مزيان', 'إكرام عثماني',
    'هدى بن يوسف', 'سيرين ملاح', 'وصال مجاهد', 'فايزة قادري', 'نوال دحمان',
    'أحلام بن ناصر', 'زكية مرابط', 'لينا قاسم', 'نجاة تواتي', 'عائشة بلحاج',
    'سليمة بن سالم', 'نورة شابي', 'أميرة زغدود', 'إلهام فرحات', 'فتيحة لعريبي',
    'بشرى بوخاري', 'إيمان مداح', 'نادية سعيدي', 'رجاء بلعربي', 'مايا شيبان',
    'سندس خليفي', 'يسرى بلخير', 'ريم مسعودي', 'تسنيم خضراوي', 'أروى العوفي'
  ];

  const statuses: Rental['status'][] = ['active', 'reserved', 'returned', 'overdue', 'cleaning'];
  const accessories = ['تاج ملكي كريستال', 'حزام مطلي بالذهب', 'شال حرير كريب', 'طقم مجوهرات تقليدي', 'حقيبة سهرة فخمة'];

  return customerNames.map((name, i) => {
    const cloth = clothes[i % clothes.length] || clothes[0];
    const status = statuses[i % statuses.length];
    const daysOffset = (i * 3) % 45;
    const startDate = getPastDate(45 - daysOffset);
    const expectedReturnDate = getFutureDate((daysOffset % 10) - 2);
    const hasAccessories = i % 2 === 0;
    const accessoryPrice = hasAccessories ? 2000 : 0;
    const dressRentPrice = cloth.rentPrice || 6000;
    const totalRent = dressRentPrice + accessoryPrice;
    const paidAmount = status === 'reserved' ? Math.round(totalRent * 0.4 / 500) * 500 : totalRent;
    const remainingAmount = totalRent - paidAmount;
    const cautionAmount = cloth.cautionAmount || 8000;

    return {
      id: `rental_${i + 1}`,
      customerName: name,
      customerPhone: `055${String(1000000 + i * 18471).slice(0, 7)}`,
      customerIdNumber: `1098${String(7654321 + i * 991).slice(0, 8)}`,
      itemId: cloth.id,
      itemName: cloth.name,
      itemSize: cloth.sizes?.[0] || '40',
      itemColor: cloth.colors?.[0] || 'ذهبي',
      qty: 1,
      stockSource: 'stock1',
      startDate,
      expectedReturnDate,
      actualReturnDate: status === 'returned' ? getPastDate(1) : undefined,
      dressRentPrice,
      hasAccessories,
      accessoryName: hasAccessories ? accessories[i % accessories.length] : undefined,
      accessoryPrice,
      rentPrice: totalRent,
      paidAmount,
      remainingAmount,
      cautionAmount,
      cautionStatus: status === 'returned' ? 'refunded' : 'held',
      status,
      bookingDate: getPastDate(50 - daysOffset),
      handoverDate: status !== 'reserved' ? startDate : undefined,
      notes: i % 4 === 0 ? 'الزبونة طلبت ضبط طول الفستان قبل الاستلام' : undefined,
      createdAt: new Date(Date.now() - (45 - daysOffset) * 86400000).toISOString()
    };
  });
};

// 3. GENERATE 50 SALES
export const generate50Sales = (clothes: ClothItem[]): Sale[] => {
  const customerNames = [
    'سيدة مريم العاصمي', 'أمينة رحال', 'ياسمين قاسم', 'سميرة بن صالح', 'هدى مرزوق',
    'فاطمة الزهراء شريف', 'منال بولعراس', 'ابتسام بن عثمان', 'نادية قادري', 'حنان عمور',
    'صبرينة درويش', 'رانيا مسعودي', 'إيناس عمارة', 'سلمى علوي', 'أميرة دراجي',
    'وفاء قيطوني', 'سعاد بكوش', 'خديجة بورقعة', 'زهرة بن يحيى', 'نجوى زروقي',
    'إكرام بوزيان', 'كوثر براهيمي', 'فتيحة ميموني', 'أسماء بوشارب', 'نوال حركات',
    'سيرين طاهر', 'نورة معوش', 'فايزة بن عيسى', 'جهيدة صايفي', 'أحلام عيساوي',
    'وصال بوعلام', 'زكية بلحاج', 'ليلى دريدي', 'عائشة سعدي', 'رجاء قندوز',
    'مايا تواتي', 'إيمان بوعزيز', 'تسنيم علام', 'سندس شنتوف', 'أروى مداحي',
    'يسرى بن ناصر', 'ريم شرشالي', 'نادية بن بوزيد', 'خيرة تلمساني', 'شفيقة زغدود',
    'مليكة غربي', 'حورية شريفي', 'سليمة مرابط', 'راضية طاهري', 'زهيرة بن عامر'
  ];

  return customerNames.map((name, i) => {
    const cloth = clothes[(i + 5) % clothes.length] || clothes[0];
    const qty = 1;
    const price = cloth.sellPrice || 35000;
    const cost = cloth.buyCost || 20000;
    const totalAmount = price * qty;
    const isDebt = i % 5 === 0;
    const paidAmount = isDebt ? Math.round(totalAmount * 0.6 / 500) * 500 : totalAmount;
    const debtAmount = totalAmount - paidAmount;
    const profit = totalAmount - (cost * qty);

    return {
      id: `sale_${i + 1}`,
      customerName: name,
      customerPhone: `066${String(2000000 + i * 14321).slice(0, 7)}`,
      items: [
        {
          itemId: cloth.id,
          name: cloth.name,
          size: cloth.sizes?.[0] || '42',
          color: cloth.colors?.[0] || 'أسود',
          qty,
          stockSource: 'stock1',
          price,
          cost,
          total: totalAmount
        }
      ],
      totalAmount,
      paidAmount,
      debtAmount,
      profit,
      date: getPastDate((i * 2) % 60),
      notes: isDebt ? 'تم الاتفاق على دفع المتبقي بداية الشهر القادم' : 'تم تسليم القطعة مع غلاف الحماية والفاتورة'
    };
  });
};

// 4. GENERATE 50 EXPENSES
export const generate50Expenses = (): Expense[] => {
  const categories = [
    'أقمشة ومواد أولية',
    'صيانة وتصليح',
    'تنظيف جاف وبخار',
    'كراء المحل وفواتير',
    'مستلزمات خياطة',
    'دعاية وتسويق',
    'نقل وتوصيل',
    'مستلزمات تغليف',
    'وجبات وضيافة',
    'أدوات مكتبية وصيانة عامة'
  ];

  const expenseDescriptions = [
    'شراء رولويات قماش ساتان ملكي ودانتيل مطرز',
    'فاتورة كراء المحل وصالة العرض الشهرية',
    'خدمات الغسيل الجاف والتنظيف بالبخار لـ 20 فستان',
    'حملة إعلانية ممولة على إنستغرام وتيك توك',
    'شراء مستلزمات خياطة (خيوط حرير، سحابات، إبر خاصة)',
    'فاتورة استهلاك الكهرباء والغاز لصالة العرض',
    'شراء أكياس تغليف فاخرة وشماعات خشبية',
    'صيانة وتزييت ماكينات الخياطة والتطريز',
    'شراء أزرار قفطان تقليدية ومجدول ذهبي أصيل',
    'شراء مواد تغليف فقاعية وصناديق كرتونية',
    'شراء قماش كريب حريري وقطيفة كورية',
    'خدمات صيانة مكيفات الهواء في المحل',
    'وجبات غداء لفريق العمل في أيام المعارض والضغط',
    'شراء أقمشة تول سويسري متعدد الطبقات',
    'شراء بطاقات أسعار ومطبوعات باركود للمحل',
    'تكلفة نقل بضائع وأقمشة من وهران إلى العاصمة',
    'شراء مجوهرات وإكسسوارات كراء مرافقة للفساتين',
    'اشتراك الإنترنت السريع للمحل ونظام الباركود',
    'صيانة نظام الإضاءة الديكورية والسبوت لايت',
    'شراء قماش لامي برّاق لتصميم تشكيلة السهرة',
    'تنظيف واجهات المحل واللافتة الإعلانية',
    'شراء علب تغليف هدايا للعرائس مخصصة',
    'شراء خيوط سمسم وعقيق كريستال للتطريز اليدوي',
    'شراء أقمشة بطانة قطنية وحريرية',
    'دفع مستحقات صيانة ماكينة السرفلة (Overlock)',
    'حملة تسويق خاصة بموسم الأعراس الصيفي',
    'شراء مستلزمات تنظيف ومطهرات للمحل',
    'شراء ستاندات عرض إضافية للفساتين الطويلة',
    'فاتورة المياه وصيانة دورة المياه بالمحل',
    'شراء أشرطة قياس ومقصات خياطة احترافية',
    'شراء عطور ومعطرات خاصة لفساتين السهرة',
    'شراء أكياس قماشية لحفظ البرنوس والقفطان',
    'شراء ورق باترون ورولات رسم التصاميم',
    'شراء خرز وسواروفسكي لتطريز فستان زفاف ملكي',
    'مصاريف بنكية ورسوم دفع إلكتروني',
    'شراء مكواة بخار عمودية احترافية ثانية',
    'شراء رفوف تخزين إضافية لمستودع الأقمشة',
    'دفع مصاريف تصوير احترافي لتشكيلة العيد',
    'شراء قماش قطيفة فرنسية فاخرة للجبب',
    'صيانة كراسي صالة الاستقبال والتعديل',
    'شراء طابور فواتير حراري وأحبار طباعة',
    'شراء دبابيس خياطة ألمانية ومستلزمات فصالة',
    'شراء حبال تزيين وشرائط ساتان للهدايا',
    'شراء أقمشة شيفون تركي ناعم بالرولو',
    'شراء قواعد مانيكان لعرض تشكيلة الأعراس',
    'مصاريف شحن سريعة لطلبية أزرار مذهبة خاصة',
    'شراء مواد تلميع المرايا والواجهات الزجاجية',
    'شراء حوامل بطاقات زبائن ومجلدات أرشيف',
    'صيانة كاميرات المراقبة وجهاز الأمان',
    'شراء قهوة وشاي ومستلزمات ضيافة الزبونات'
  ];

  return expenseDescriptions.map((desc, i) => {
    const category = categories[i % categories.length];
    const amount = 2000 + (i * 1350) % 65000;
    const isSupplier = category === 'أقمشة ومواد أولية' || category === 'مستلزمات خياطة';

    return {
      id: `exp_${i + 1}`,
      category,
      desc,
      amount,
      date: getPastDate((i * 1.5) % 60),
      expenseScope: (i % 4 === 0 ? 'rental' : i % 4 === 1 ? 'sale' : i % 4 === 2 ? 'tailoring' : 'general') as Expense['expenseScope'],
      isSupplierPurchase: isSupplier,
      supplierName: isSupplier ? `مؤسسة النسيج الراقي ${1 + (i % 5)}` : undefined,
      goodsDescription: isSupplier ? desc : undefined,
      totalInvoiceAmount: isSupplier ? amount + 5000 : undefined,
      paidAmount: amount,
      creditAmount: isSupplier ? 5000 : 0,
      notes: i % 6 === 0 ? 'تم الدفع نقدًا من الصندوق الرئيسي' : undefined
    };
  });
};

// 5. GENERATE 50 CREDITS (DEBTS)
export const generate50Credits = (): Credit[] => {
  const people = [
    { name: 'فاطمة بن عمر', phone: '0551122334', type: 'زبون', desc: 'متبقي حساب فستان سهرة كريب' },
    { name: 'مؤسسة الأقمشة الفاخرة - القبة', phone: '021445566', type: 'مورد', desc: 'متبقي فاتورة رولويات ساتان ملكي' },
    { name: 'ياسمين بلحاج', phone: '0662233445', type: 'زبون', desc: 'متبقي كراء قفطان عاصمي' },
    { name: 'شركة حرير الشرق - وهران', phone: '041332211', type: 'مورد', desc: 'دفعة ثانية من أقمشة قطيفة فرنسية' },
    { name: 'أمينة زروقي', phone: '0773344556', type: 'زبون', desc: 'متبقي تعديل وخياطة فستان عروس' },
    { name: 'دار الخيوط والمجدول - قسنطينة', phone: '031889900', type: 'مورد', desc: 'فاتورة خيوط صم ومجبود أصيل' },
    { name: 'سارة قرين', phone: '0554455667', type: 'زبون', desc: 'متبقي شراء بدلة سهرة كلاسيكية' },
    { name: 'مستودع الأقمشة التركية - بليدة', phone: '025667788', type: 'مورد', desc: 'شحنة أقمشة كافيار وشيفون' },
    { name: 'نادية بن عيسى', phone: '0665566778', type: 'زبون', desc: 'متبقي عربون فستان خطوبة روز غولد' },
    { name: 'محلات كريستال باريس - سطيف', phone: '036554433', type: 'مورد', desc: 'شراء أحجار شواروفسكي وأزرار مذهبة' }
  ];

  return Array.from({ length: 50 }, (_, i) => {
    const base = people[i % people.length];
    const isSupplier = base.type === 'مورد';
    const amount = 3000 + (i * 850) % 45000;
    const totalInv = amount + 10000;

    return {
      id: `cred_${i + 1}`,
      name: `${base.name} #${i + 1}`,
      phone: base.phone,
      type: base.type,
      desc: `${base.desc} (دفعة ${i + 1})`,
      amount,
      date: getPastDate((i * 1.8) % 60),
      supplierDebt: isSupplier,
      supplierName: isSupplier ? base.name : undefined,
      goodsDescription: isSupplier ? base.desc : undefined,
      totalInvoiceAmount: isSupplier ? totalInv : undefined,
      paidAmount: isSupplier ? 10000 : undefined
    };
  });
};

// 6. GENERATE 50 RAW MATERIALS (FABRICS)
export const generate50RawMaterials = (): RawMaterial[] => {
  const fabrics = [
    { name: 'ساتان ملكي كريب (Satin Duchesse)', type: 'ساتان', color: 'أبيض لؤلؤي' },
    { name: 'حرير كريب إيطالي طبيعي', type: 'حرير', color: 'أسود ملكي' },
    { name: 'قطيفة فرنسية شتوية فاخرة', type: 'قطيفة', color: 'عنابي بوردو' },
    { name: 'تول سويسري ناعم متعدد الطبقات', type: 'تول', color: 'وردي بودري' },
    { name: 'دانتيل فرنسي مطرز بخرز الكريستال', type: 'دانتيل', color: 'أوف وايت' },
    { name: 'شيفون تركي فائق النعومة', type: 'شيفون', color: 'أزرق سماوي' },
    { name: 'قماش كافيار برّاق للسهرة', type: 'كافيار', color: 'فضي ميتاليك' },
    { name: 'قماش لامي ذهبي مشع', type: 'لامي', color: 'ذهبي مذهب' },
    { name: 'بروكار هندي فاخر للقفاطين', type: 'بروكار', color: 'أخضر زمردي' },
    { name: 'حرير ميكادو ثقيل لفساتين العروس', type: 'ميكادو', color: 'عاجي' }
  ];

  return Array.from({ length: 50 }, (_, i) => {
    const base = fabrics[i % fabrics.length];
    const rollCount = 2 + (i % 8);
    const metersPerRoll = 25;
    const looseMeters = (i * 3) % 15;
    const totalMeters = (rollCount * metersPerRoll) + looseMeters;
    const costPerMeter = 900 + (i * 120) % 4500;
    const totalCostValue = totalMeters * costPerMeter;

    return {
      id: `raw_${i + 1}`,
      name: `${base.name} - صنف #${i + 1}`,
      code: `MAT-${200 + i}`,
      fabricType: base.type,
      color: base.color,
      rollCount,
      metersPerRoll,
      looseMeters,
      totalMeters,
      costPerMeter,
      costPerRoll: costPerMeter * metersPerRoll,
      totalCostValue,
      supplierName: `مؤسسة النسيج المعتمدة ${1 + (i % 6)}`,
      storageLocation: i % 2 === 0 ? 'مستودع الأقمشة المركزي - رف A' : 'ورشة الخياطة - قسم البكرات B',
      minAlertMeters: 20,
      notes: 'قماش ممتاز معالج ضد الانكماش والانكماش الحراري',
      createdAt: getPastDate((i * 2) % 60)
    };
  });
};

// 7. GENERATE 50 TAILORING & MAINTENANCE ORDERS
export const generate50MaintenanceOrders = (clothes: ClothItem[]): MaintenanceOrder[] => {
  const serviceTypes: MaintenanceOrder['serviceType'][] = ['alteration', 'repair', 'custom_sewing', 'ironing_prep', 'other'];
  const statuses: MaintenanceOrder['status'][] = ['pending', 'in_progress', 'ready', 'delivered'];
  const tailors = ['المعلمة نصيرة', 'الخياطة فاطمة الزهراء', 'الخياطة خيرة التلمسانية', 'الأستاذة سعاد', 'المعلمة حنان'];

  const customerNames = [
    'سلمى بوزيدي', 'ريم عثماني', 'حنان حيمود', 'نادية قادري', 'أسماء زروق',
    'وفاء بن منصور', 'صبرينة بوعلام', 'مريم فرحاتي', 'سميرة مرابط', 'إيناس حدادي'
  ];

  return Array.from({ length: 50 }, (_, i) => {
    const isInternal = i % 3 === 0;
    const cloth = clothes[i % clothes.length] || clothes[0];
    const customer = customerNames[i % customerNames.length];
    const cost = 1500 + (i * 250) % 6000;
    const price = Math.round(cost * 1.8 / 100) * 100;
    const paidAmount = i % 4 === 0 ? price : Math.round(price * 0.5 / 100) * 100;
    const receivedDate = getPastDate((i * 2) % 30);
    const expectedDeliveryDate = getFutureDate(3 + (i % 10));

    return {
      id: `maint_${i + 1}`,
      orderNumber: `ORD-${1000 + i + 1}`,
      targetType: isInternal ? 'internal_stock' : 'customer_order',
      itemId: isInternal ? cloth.id : undefined,
      itemName: isInternal ? cloth.name : `فستان سهرة خاص بالزبونة ${customer}`,
      customerName: isInternal ? 'مخزون البوتيك الداخلي' : customer,
      customerPhone: isInternal ? undefined : `055${String(3000000 + i * 2311).slice(0, 7)}`,
      serviceType: serviceTypes[i % serviceTypes.length],
      description: isInternal ? 'تضييق الخصر وتثبيت أحجار الكريستال المتساقطة' : 'تقصير الطول بـ 5 سم وإضافة بطانة حريرية إضافية للأكمام',
      measurements: isInternal ? undefined : 'الصدر: 92cm | الخصر: 74cm | الأرداف: 100cm | الطول الكلي: 145cm',
      tailorName: tailors[i % tailors.length],
      cost,
      price: isInternal ? cost : price,
      paidAmount: isInternal ? cost : paidAmount,
      remainingAmount: isInternal ? 0 : (price - paidAmount),
      receivedDate,
      expectedDeliveryDate,
      actualDeliveryDate: i % 4 === 0 ? getPastDate(1) : undefined,
      status: statuses[i % statuses.length],
      notes: 'التسليم مستعجل قبل نهاية عطلة الأسبوع',
      createdAt: new Date(Date.now() - (i * 2) * 86400000).toISOString()
    };
  });
};

// 8. GENERATE 50 SUPPLIERS
export const generate50Suppliers = (): Supplier[] => {
  const cities = ['الجزائر العاصمة', 'وهران', 'قسنطينة', 'سطيف', 'تلمسان', 'البليدة', 'عنابة', 'برج بوعريريج', 'دبي', 'إسطنبول'];
  const categories = ['أقمشة وحرير', 'مستلزمات خياطة وإبر', 'أزرار ومجدول تقليدي', 'أحجار وكريستال سواروفسكي', 'شماعات وأكياس تغليف'];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `supp_${i + 1}`,
    name: `مؤسسة ${['الشرق', 'النور', 'الأصالة', 'التاج', 'الوسام', 'البركة', 'الأمراء', 'الفخامة', 'المستقبل', 'النسيج'][i % 10]} لتجارة ${categories[i % categories.length]} #${i + 1}`,
    phone: `0${[21, 41, 31, 36, 43, 25, 38, 35, 55, 66][i % 10]}${String(100000 + i * 874).slice(0, 6)}`,
    addressOrCity: `${cities[i % cities.length]} - المنطقة التجارية`,
    category: categories[i % categories.length],
    notes: 'مورد موثوق مع إمكانية الدفع الآجل بتسهيلات'
  }));
};

// 9. GENERATE 50 SEAMSTRESSES
export const generate50Seamstresses = (): Seamstress[] => {
  const specialties = [
    'خياطة قفاطين تقليدية وتطريز المجبود',
    'فصالة وتصميم فساتين سهرة عصرية',
    'تطريز الفتلة والسمسم والعقد اليدوية',
    'تعديل المقاسات والرتوش السريعة',
    'خياطة الكاراكو العاصمي الأصيل',
    'تصميم فساتين الأعراس والزفاف الملكية',
    'خياطة الجبة القسنطينية والفرقاني'
  ];

  const firstNames = ['فاطمة', 'خيرة', 'نصيرة', 'سعاد', 'حنان', 'مبروكة', 'يمينة', 'زهور', 'جميلة', 'لطيفة'];
  const lastNames = ['التلمساني', 'العاصمي', 'القسنطيني', 'الوهراني', 'السطايفي', 'البليدي', 'الشاوي', 'القبائلي', 'المزيان', 'العلوي'];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `seam_${i + 1}`,
    name: `المعلمة ${firstNames[i % firstNames.length]} ${lastNames[(i + 3) % lastNames.length]} #${i + 1}`,
    phone: `055${String(4000000 + i * 3721).slice(0, 7)}`,
    specialty: specialties[i % specialties.length],
    addressOrCity: `الورشة رقم ${1 + (i % 12)} - الطابق الثاني`,
    ratePerPieceOrSalary: i % 2 === 0 ? 'بالقطعة: 3500 دج للقفطان' : 'راتب شهري: 45000 دج',
    notes: 'خبرة أكثر من 12 سنة في الحرفة اليدوية',
    createdAt: getPastDate((i * 3) % 90)
  }));
};

// 10. GENERATE 15 STAFF MEMBERS & 50 STAFF PAYOUTS + 50 ABSENCES
export const generateStaffData = () => {
  const staffMembers: StaffMember[] = [
    { id: 'staff_1', name: 'أمينة منصوري', role: 'مسؤولة صالة العرض والمبيعات', phone: '0550112233', baseSalary: 55000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2023-01-15' },
    { id: 'staff_2', name: 'سارة بوزيان', role: 'كاشيرة ومسؤولة عقود الكراء', phone: '0550223344', baseSalary: 48000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2023-03-01' },
    { id: 'staff_3', name: 'المعلمة نصيرة', role: 'رئيسة ورشة الخياطة والتعديل', phone: '0550334455', baseSalary: 65000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2022-06-10' },
    { id: 'staff_4', name: 'خديجة عماري', role: 'مساعدة خياطة ومسؤولة القياسات', phone: '0550445566', baseSalary: 42000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2023-09-01' },
    { id: 'staff_5', name: 'ياسمين شريف', role: 'مسؤولة الكي والبخار والتغليف', phone: '0550556677', baseSalary: 38000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2024-01-10' },
    { id: 'staff_6', name: 'كريم بوعلام', role: 'أمين المستودع وحركة المخزون', phone: '0550667788', baseSalary: 45000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2023-05-15' },
    { id: 'staff_7', name: 'ليلى مزيان', role: 'مستشارة مظهر ومرافقة العرائس', phone: '0550778899', baseSalary: 50000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2023-11-01' },
    { id: 'staff_8', name: 'نادية بلقاسم', role: 'مسؤولة التصوير والتسويق الرقمي', phone: '0550889900', baseSalary: 52000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2024-02-01' },
    { id: 'staff_9', name: 'إيناس رحماني', role: 'مساعدة صالة العرض واستقبال', phone: '0550990011', baseSalary: 36000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2024-03-15' },
    { id: 'staff_10', name: 'مراد ساعد', role: 'سائق ومسؤول التوصيل والشحن', phone: '0550001122', baseSalary: 40000, salaryType: 'monthly', workDaysPerMonth: 26, joinDate: '2023-08-01' }
  ];

  const staffPayouts: StaffPayout[] = Array.from({ length: 50 }, (_, i) => {
    const staff = staffMembers[i % staffMembers.length];
    const base = staff.baseSalary;
    const bonus = (i % 4 === 0) ? 5000 : 0;
    const absenceDeduction = (i % 5 === 0) ? 2000 : 0;
    const netAmount = base + bonus - absenceDeduction;

    return {
      id: `payout_${i + 1}`,
      staffId: staff.id,
      name: staff.name,
      amount: netAmount,
      baseAmount: base,
      bonus,
      absenceDeduction,
      type: i % 6 === 0 ? 'تسبيق على الراتب (Avance)' : 'راتب شهري مسدد بالكامل',
      date: getPastDate((i * 1.5) % 60),
      notes: bonus > 0 ? 'يشمل مكافأة تميز في مبيعات موسم الأعراس' : undefined
    };
  });

  const staffAbsences: StaffAbsence[] = Array.from({ length: 50 }, (_, i) => {
    const staff = staffMembers[i % staffMembers.length];
    const daysCount = i % 3 === 0 ? 0.5 : 1;
    const dailyRate = Math.round(staff.baseSalary / 26);
    const deduction = Math.round(dailyRate * daysCount);

    return {
      id: `abs_${i + 1}`,
      staffId: staff.id,
      staffName: staff.name,
      date: getPastDate((i * 1.8) % 60),
      daysCount,
      reason: i % 2 === 0 ? 'ظرف عائلي طارئ' : 'وعكة صحية وإجازة مرضية مبررة',
      deductionAmount: deduction,
      isDeducted: true
    };
  });

  return { staffMembers, staffPayouts, staffAbsences };
};

// 11. GENERATE 50 DAILY CAISSE CLOSURES
export const generate50CaisseClosures = (): DailyCaisseClosure[] => {
  return Array.from({ length: 50 }, (_, i) => {
    const date = getPastDate(50 - i);
    const openingBalance = 20000;
    const salesIncome = 35000 + (i * 3210) % 90000;
    const rentalsIncome = 25000 + (i * 2150) % 70000;
    const tailoringIncome = 6000 + (i * 850) % 18000;
    const cautionsReceived = 15000 + (i * 1200) % 40000;

    const expensesPaid = 8000 + (i * 1100) % 30000;
    const staffPayoutsPaid = (i % 7 === 0) ? 25000 : 0;
    const cautionsRefunded = 10000 + (i * 950) % 30000;

    const totalInflow = salesIncome + rentalsIncome + tailoringIncome + cautionsReceived;
    const totalOutflow = expensesPaid + staffPayoutsPaid + cautionsRefunded;
    const theoreticalAmount = openingBalance + totalInflow - totalOutflow;
    const difference = (i % 8 === 0) ? -500 : (i % 12 === 0) ? 500 : 0;
    const actualAmount = theoreticalAmount + difference;

    const status: DailyCaisseClosure['status'] = difference === 0 ? 'balanced' : difference < 0 ? 'shortage' : 'surplus';

    return {
      id: `caisse_${i + 1}`,
      date,
      openingBalance,
      salesIncome,
      rentalsIncome,
      tailoringIncome,
      cautionsReceived,
      expensesPaid,
      staffPayoutsPaid,
      cautionsRefunded,
      totalInflow,
      totalOutflow,
      theoreticalAmount,
      actualAmount,
      difference,
      status,
      notes: difference === 0 ? 'تم غلق الصندوق بمطابقة تامة 100%' : difference < 0 ? 'فارق عجز بسيط جاري التحقق منه' : 'فائض نقدي مسجل في الصندوق',
      closedAt: `${date}T20:30:00.000Z`
    };
  });
};

// 12. GENERATE 50 ACTIVITY LOGS
export const generate50ActivityLogs = (): ActivityLog[] => {
  const actions: { type: ActivityLog['actionType']; cat: ActivityLog['category']; title: string; details: string }[] = [
    { type: 'create', cat: 'rentals', title: 'تسجيل عقد كراء فستان سهرة', details: 'تم تسجيل كراء قفطان ملكي للزبونة سارة بن علي واستلام الضمان' },
    { type: 'create', cat: 'sales', title: 'تسجيل عملية بيع نقدية', details: 'بيع فستان سهرة حورية البحر كريب للزبونة أمينة بلقاسم بمبلغ 48,000 دج' },
    { type: 'return', cat: 'rentals', title: 'إرجاع فستان كراء وإرجاع الضمان', details: 'تم استلام الفستان بحالة ممتازة وإعادة مبلغ الضمان 10,000 دج للزبونة' },
    { type: 'payment', cat: 'caisse', title: 'إغلاق ومطابقة الصندوق اليومي', details: 'تم غلق الصندوق اليومي بمجموع مداخيل 145,000 دج ومطابقة تامة' },
    { type: 'update', cat: 'inventory', title: 'تعديل كمية وتحديث مخزون فستان', details: 'تمت إضافة 3 قطع جديدة من مقاس 42 إلى صالة العرض' },
    { type: 'create', cat: 'tailoring', title: 'تسجيل طلب خياطة وتعديل مقاس', details: 'طلب تقصير وتضييق فستان سهرة خاص بالزبونة نادية بوجمعة' },
    { type: 'create', cat: 'expenses', title: 'تسجيل مصاريف شراء أقمشة', details: 'تسجيل فاتورة شراء رولويات ساتان ملكي من مؤسسة النسيج الراقي' },
    { type: 'payment', cat: 'staff', title: 'تسديد دفعة راتب لمسؤولة الصالة', details: 'تم تسليم راتب شهر كامل للموظفة أمينة منصوري نقدًا' },
    { type: 'create', cat: 'credits', title: 'تسجيل دين مؤجل لمورد أقمشة', details: 'تسجيل دفعة مؤجلة بقيمة 25,000 دج لصالح شركة حرير الشرق' },
    { type: 'status_change', cat: 'tailoring', title: 'تغيير حالة طلب خياطة إلى جاهز للتسليم', details: 'أنهت المعلمة نصيرة عملية التعديل والفستان جاهز للتسليم للزبونة' }
  ];

  return Array.from({ length: 50 }, (_, i) => {
    const act = actions[i % actions.length];
    const daysAgo = (i * 1.2);
    const dateObj = new Date(Date.now() - daysAgo * 86400000);

    return {
      id: `log_${i + 1}`,
      timestamp: dateObj.toISOString(),
      actionType: act.type,
      category: act.cat,
      title: `${act.title} #${i + 1}`,
      details: act.details,
      itemCodeOrId: `REF-${1000 + i}`,
      performedBy: i % 2 === 0 ? 'إدارة البوتيك' : 'مسؤولة الصندوق',
      amount: 5000 + (i * 1250) % 50000
    };
  });
};

/**
 * Returns a complete dataset containing 50 realistic records for every section in the application.
 */
export const generateFullDataset = () => {
  const clothes = generate50Clothes();
  const rentals = generate50Rentals(clothes);
  const sales = generate50Sales(clothes);
  const expenses = generate50Expenses();
  const credits = generate50Credits();
  const rawMaterials = generate50RawMaterials();
  const maintenanceOrders = generate50MaintenanceOrders(clothes);
  const suppliers = generate50Suppliers();
  const seamstresses = generate50Seamstresses();
  const { staffMembers, staffPayouts, staffAbsences } = generateStaffData();
  const caisseClosures = generate50CaisseClosures();
  const activityLogs = generate50ActivityLogs();

  return {
    clothes,
    rentals,
    sales,
    expenses,
    credits,
    rawMaterials,
    maintenanceOrders,
    suppliers,
    seamstresses,
    staffMembers,
    staffPayouts,
    staffAbsences,
    caisseClosures,
    activityLogs
  };
};
