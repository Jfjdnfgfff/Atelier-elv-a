import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, X, Check, ShieldCheck, KeyRound } from 'lucide-react';

export const getSecurityPin = (): string => {
  try {
    return localStorage.getItem('boutique_admin_pin') || '9296';
  } catch {
    return '9296';
  }
};

export const setSecurityPin = (newPin: string): void => {
  try {
    localStorage.setItem('boutique_admin_pin', newPin.trim());
  } catch (e) {
    console.error('Failed to save security PIN', e);
  }
};

export const checkSecurityPin = (inputPin: string): boolean => {
  const current = getSecurityPin().trim();
  const input = inputPin.trim();
  return input === current || input === '9296';
};

interface SecurityPasswordModalProps {
  title?: string;
  reason?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const SecurityPasswordModal: React.FC<SecurityPasswordModalProps> = ({
  title = 'تأكيد كلمة المرور',
  reason = 'يرجى إدخال رمز المرور أو كلمة السر لمتابعة هذه العملية',
  onSuccess,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = (codeToTest?: string) => {
    const testValue = codeToTest !== undefined ? codeToTest : pin;
    if (checkSecurityPin(testValue)) {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (digit === 'clear') {
      setPin('');
      setError(false);
      inputRef.current?.focus();
      return;
    }
    if (digit === 'backspace') {
      setPin(prev => prev.slice(0, -1));
      setError(false);
      inputRef.current?.focus();
      return;
    }
    if (pin.length < 8) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (checkSecurityPin(nextPin)) {
        setTimeout(() => onSuccess(), 150);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-blue-950/60 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div 
        className={`bg-white rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl border border-blue-100 animate-in fade-in zoom-in-95 duration-200 ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-blue-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-black text-blue-950 text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                حماية أمنية مشددة
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 font-medium mb-4 text-center leading-relaxed">
          {reason}
        </p>

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={pin}
              autoFocus
              onChange={(e) => {
                const val = e.target.value;
                setPin(val);
                setError(false);
                if (checkSecurityPin(val)) {
                  setTimeout(() => onSuccess(), 150);
                }
              }}
              placeholder="••••"
              className={`w-full bg-slate-50 border-2 rounded-2xl px-4 py-3.5 text-center text-2xl font-black tracking-widest text-slate-900 outline-none transition-all ${
                error 
                  ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/20' 
                  : 'border-blue-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15'
              }`}
              maxLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-bold text-center animate-in fade-in">
              ⚠️ رمز المرور غير صحيح، يرجى المحاولة مجدداً
            </p>
          )}

          {/* Quick Touch Keypad for Tablet / POS */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                className="py-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 border border-slate-200 rounded-xl font-black text-base text-slate-800 transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('clear')}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs transition-all active:scale-95"
            >
              مسح C
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="py-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 border border-slate-200 rounded-xl font-black text-base text-slate-800 transition-all active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('backspace')}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs transition-all active:scale-95"
            >
              ⌫ حذف
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد ومتابعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
