import { STORAGE_KEYS } from '../storage';

/**
 * ربط اسم مجموعة Firebase بمفتاح التخزين المحلي (localStorage / IndexedDB).
 * موضوع في وحدة مستقلة لتفادي أي حلقة استيراد بين firebase.ts و storage.ts.
 */
export const COLLECTION_STORAGE_KEYS: Record<string, string> = {
  clothes: STORAGE_KEYS.CLOTHES,
  rentals: STORAGE_KEYS.RENTALS,
  sales: STORAGE_KEYS.SALES,
  expenses: STORAGE_KEYS.EXPENSES,
  credits: STORAGE_KEYS.CREDITS,
  creditPayments: STORAGE_KEYS.CREDIT_PAYMENTS,
  staffPayouts: STORAGE_KEYS.STAFF_PAYOUTS,
  staffMembers: STORAGE_KEYS.STAFF_MEMBERS,
  staffAbsences: STORAGE_KEYS.STAFF_ABSENCES,
  maintenanceOrders: STORAGE_KEYS.MAINTENANCE,
  suppliers: STORAGE_KEYS.SUPPLIERS,
  seamstresses: STORAGE_KEYS.SEAMSTRESSES,
  seamstressPayments: STORAGE_KEYS.SEAMSTRESS_PAYMENTS,
  rawMaterials: STORAGE_KEYS.RAW_MATERIALS,
  caisseClosures: STORAGE_KEYS.CAISSE_CLOSURES,
  activityLogs: STORAGE_KEYS.ACTIVITY_LOGS
};

export const storageKeyForCollection = (collection: string): string | undefined =>
  COLLECTION_STORAGE_KEYS[collection];
