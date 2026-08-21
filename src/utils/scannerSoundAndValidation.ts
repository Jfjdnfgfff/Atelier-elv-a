// 🔊 Professional POS Laser Barcode Scanner Audio Engine & Validation Suite

let globalAudioCtx: AudioContext | null = null;

// Initialize or resume zero-latency AudioContext
export const getScannerAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
};

// Warm up audio context on user interaction (touch/click/key)
if (typeof window !== 'undefined') {
  const warmUp = () => {
    try {
      const ctx = getScannerAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  window.addEventListener('click', warmUp, { passive: true, once: true });
  window.addEventListener('touchstart', warmUp, { passive: true, once: true });
  window.addEventListener('keydown', warmUp, { passive: true, once: true });
}

/**
 * 🔊 Authentic Handheld POS Laser Scanner Beep (Honeywell / Zebra Symbol signature beep)
 * Crisp, high-frequency, crystal clear 60ms pulse with no latency.
 */
export const playPosScannerBeep = (style: 'classic' | 'modern' | 'soft' = 'classic') => {
  try {
    const ctx = getScannerAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (style === 'classic') {
      // 🏷️ Authentic POS Laser Scanner Beep (2650Hz sharp sine)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2650, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.003);
      gain.gain.setValueAtTime(0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } else if (style === 'modern') {
      // ⚡ High-speed Cash Register Chirp (1900Hz -> 2800Hz instant chirp)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1900, now);
      osc.frequency.exponentialRampToValueAtTime(2800, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.45, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } else {
      // ✨ Soft POS chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    }

    // 📳 Haptic vibration feedback for mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
  } catch {
    // Ignore audio failures safely
  }
};

/**
 * ❌ Error Buzz tone (when barcode is invalid or item not found in stock)
 */
export const playPosErrorBeep = () => {
  try {
    const ctx = getScannerAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(180, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch {}
    }
  } catch {}
};

/**
 * Mathematical Checksum verification for EAN-13, EAN-8, UPC-A
 */
export const verifyBarcodeChecksum = (code: string): boolean => {
  const digits = code.replace(/\D/g, '');
  
  // EAN-13 (13 digits)
  if (digits.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const num = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? num : num * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(digits[12], 10);
  }

  // EAN-8 (8 digits)
  if (digits.length === 8) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const num = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? num * 3 : num;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(digits[7], 10);
  }

  // UPC-A (12 digits)
  if (digits.length === 12) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const num = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? num * 3 : num;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(digits[11], 10);
  }

  return true; // Non-numeric or non-EAN codes (e.g. Code 128 / Code 39)
};

/**
 * Barcode Sanitize & Validation:
 * - Strips unprintable control characters and extra spaces
 * - Rejects partial or corrupt characters
 */
export const validateAndSanitizeBarcode = (raw: string): { isValid: boolean; code: string; reason?: string } => {
  if (!raw) return { isValid: false, code: '', reason: 'كود فارغ' };

  // Remove non-printable control characters, trim whitespace
  const clean = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();

  // Reject tiny fragments (less than 2 characters unless intentional)
  if (clean.length < 2) {
    return { isValid: false, code: '', reason: 'الباركود قصير جداً' };
  }

  // If numeric with standard length (8, 12, 13), verify checksum
  if (/^\d{8}$|^\d{12}$|^\d{13}$/.test(clean)) {
    if (!verifyBarcodeChecksum(clean)) {
      return { isValid: false, code: clean, reason: 'رقم التحقق للباركود غير صحيح' };
    }
  }

  return { isValid: true, code: clean };
};
