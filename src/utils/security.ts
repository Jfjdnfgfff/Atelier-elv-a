/**
 * Centralized Security and Authorization Configuration
 * 
 * NOTE: Client-side PIN codes (e.g. DEFAULT_ADMIN_PIN) provide UI gating and convenience for shop staff,
 * but real backend authorization & data protection MUST be enforced via Firebase Security Rules
 * and Firebase Authentication.
 */

export const DEFAULT_ADMIN_PIN = '9296';
export const SECURITY_PIN_STORAGE_KEY = 'bm_security_pin';

export function getAdminPin(): string {
  try {
    return localStorage.getItem(SECURITY_PIN_STORAGE_KEY) || DEFAULT_ADMIN_PIN;
  } catch {
    return DEFAULT_ADMIN_PIN;
  }
}

export function setAdminPin(newPin: string): boolean {
  try {
    if (!newPin || newPin.trim().length < 4) return false;
    localStorage.setItem(SECURITY_PIN_STORAGE_KEY, newPin.trim());
    return true;
  } catch {
    return false;
  }
}

export function verifyAdminPin(enteredPin: string): boolean {
  if (!enteredPin) return false;
  return enteredPin.trim() === getAdminPin().trim();
}

/**
 * Input sanitization helpers
 */
export function sanitizeName(name: string): string {
  if (!name) return '';
  return name.trim().slice(0, 100);
}

export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '').slice(0, 20);
}

export function sanitizeDigitsOnly(val: string, maxLength?: number): string {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

export function sanitizeText(text: string, maxLength = 500): string {
  if (!text) return '';
  return text.trim().slice(0, maxLength);
}

export function sanitizeNumericAmount(val: number | string, defaultValue = 0): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) || num < 0 ? defaultValue : num;
}

export function isValidImageFileType(fileTypeOrFile: string | File, fileName?: string): boolean {
  let type = '';
  let name = '';
  if (typeof fileTypeOrFile === 'string') {
    type = fileTypeOrFile;
    name = fileName || '';
  } else if (fileTypeOrFile && typeof fileTypeOrFile === 'object') {
    type = fileTypeOrFile.type || '';
    name = fileTypeOrFile.name || '';
  }

  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (type && validMimes.includes(type.toLowerCase())) return true;

  const ext = name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext || '');
}

export function generateSecureImageFilename(originalName: string, prefixOrType = 'img'): { secureName: string } {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const secureName = `${prefixOrType}_${timestamp}_${random}.${cleanExt}`;
  return { secureName };
}
