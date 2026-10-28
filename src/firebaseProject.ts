// إعدادات مشروع Firebase + أسماء المجموعات المنطقية.
// ملف مستقل بلا أي تبعية على SDK حتى تستطيع وحدات أخرى (مخطط المسارات،
// التشخيص، الجلب) استخدامه دون إنشاء استيراد دائري مع firebase.ts.

export const firebaseConfig = {
  apiKey: "AIzaSyCbvyOhZK42hTsKjOWPPDc60LRyyrpoo34",
  authDomain: "ateliu-14e23.firebaseapp.com",
  databaseURL: "https://ateliu-14e23-default-rtdb.firebaseio.com",
  projectId: "ateliu-14e23",
  storageBucket: "ateliu-14e23.firebasestorage.app",
  messagingSenderId: "137350226746",
  appId: "1:137350226746:web:d4f824a6580b7c152be603",
  measurementId: "G-WYDHE63XZS"
};

// أسماء المجموعات المنطقية: كل سجل مستند مستقل بمفتاح /مجموعة/{المعرف}
export const FIREBASE_COLLECTIONS = {
  CLOTHES: 'clothes',
  RENTALS: 'rentals',
  SALES: 'sales',
  EXPENSES: 'expenses',
  CREDITS: 'credits',
  CREDIT_PAYMENTS: 'creditPayments',
  STAFF_PAYOUTS: 'staffPayouts',
  STAFF_MEMBERS: 'staffMembers',
  STAFF_ABSENCES: 'staffAbsences',
  MAINTENANCE: 'maintenanceOrders',
  SUPPLIERS: 'suppliers',
  SEAMSTRESSES: 'seamstresses',
  RAW_MATERIALS: 'rawMaterials',
  CAISSE_CLOSURES: 'caisseClosures',
  ACTIVITY_LOGS: 'activityLogs',
  CLOTH_THUMBS: 'clothThumbs',
  CLOTH_IMAGES: 'clothImages',
  SETTINGS: 'appSettings'
} as const;

export type FirebaseCollectionKey = typeof FIREBASE_COLLECTIONS[keyof typeof FIREBASE_COLLECTIONS];
