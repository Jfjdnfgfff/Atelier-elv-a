import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Package,
  ShoppingBag,
  Scissors,
  Receipt,
  CreditCard,
  Scale,
  Users,
  X,
} from 'lucide-react';

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none" dir="rtl">
    <div 
      className={`bg-white rounded-t-3xl sm:rounded-3xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-w-full p-4 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] sm:max-h-[92vh] flex flex-col my-0 sm:my-auto overflow-x-hidden animate-in fade-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 safe-bottom`}
    >
      {/* Mobile handle indicator */}
      <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

      <div className="flex justify-between items-center pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100 shrink-0">
        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
          {title}
        </h3>
        <button 
          onClick={onClose} 
          aria-label="إغلاق"
          className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 hover:border hover:border-blue-200 flex items-center justify-center transition-all active:scale-95 text-sm font-bold"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto overflow-x-hidden flex-1 pr-1 pl-1 custom-scrollbar pb-2 touch-pan-y overscroll-x-none">
        {children}
      </div>
    </div>
  </div>
);

export const NavButton: React.FC<{
  icon: 'dashboard' | 'rentals' | 'inventory' | 'sales' | 'expenses' | 'credits' | 'customers' | 'staff' | 'packages' | 'absence' | 'tailoring' | 'caisse';
  label: string;
  onClick: () => void;
  active?: boolean;
  color?: string;
  badge?: number;
}> = ({ icon, label, onClick, active, color = 'slate', badge }) => {
  const getIcon = () => {
    switch (icon) {
      case 'dashboard':
        return <LayoutDashboard className="w-4 h-4" />;
      case 'rentals':
        return <Calendar className="w-4 h-4" />;
      case 'inventory':
        return <Package className="w-4 h-4" />;
      case 'sales':
        return <ShoppingBag className="w-4 h-4" />;
      case 'tailoring':
        return <Scissors className="w-4 h-4" />;
      case 'expenses':
        return <Receipt className="w-4 h-4" />;
      case 'credits':
        return <CreditCard className="w-4 h-4" />;
      case 'partners':
      case 'customers':
      case 'staff':
      case 'absence':
        return <Users className="w-4 h-4" />;
      case 'caisse':
        return <Scale className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-full py-1.5 px-0.5 sm:px-1.5 rounded-xl text-[9.5px] sm:text-xs font-bold transition-all min-h-[38px] sm:min-h-[42px] group ${
        active
          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
          : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/90 hover:border-blue-200 border border-transparent active:scale-95'
      }`}
    >
      <div className={`shrink-0 scale-90 sm:scale-100 transition-transform group-hover:scale-110 ${active ? 'text-white' : 'group-hover:text-blue-600'}`}>{getIcon()}</div>
      <span className="truncate leading-none text-[8.5px] sm:text-xs tracking-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -left-1 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 bg-red-600 text-white text-[8px] sm:text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
          {badge}
        </span>
      )}
    </button>
  );
};

export const StatCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  iconBg?: string;
  icon: React.ReactNode;
  subtitle?: string;
  hideValue?: boolean;
  onClick?: () => void;
}> = ({ title, value, unit = 'دج', iconBg, icon, subtitle, hideValue, onClick }) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`group bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs transition-all duration-200 flex flex-col justify-between text-right w-full hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/10 hover:-translate-y-0.5 ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2.5 w-full">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 flex items-center justify-center shrink-0 text-base sm:text-lg border border-slate-200/60 transition-all">
          {icon}
        </div>
        {subtitle && (
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 bg-slate-50 group-hover:bg-blue-50/60 group-hover:text-blue-700 px-2 py-0.5 rounded-lg border border-slate-100 group-hover:border-blue-100 truncate max-w-[130px] transition-colors">
            {subtitle}
          </span>
        )}
      </div>
      <div className="w-full">
        <div className="text-[11px] sm:text-xs font-medium text-slate-500 group-hover:text-blue-900 mb-0.5 sm:mb-1 transition-colors">{title}</div>
        <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
          {hideValue ? (
            <span className="tracking-widest text-slate-300 font-sans">••••••</span>
          ) : (
            <>
              {typeof value === 'number' ? value.toLocaleString('fr-DZ') : value}
              {unit && <span className="text-[10px] sm:text-xs font-medium text-slate-400 mr-1 font-sans">{unit}</span>}
            </>
          )}
        </div>
      </div>
    </Component>
  );
};

/**
 * Strict Letters-Only Input (Blocks numbers on keyboard, beforeinput, paste, drop, and change)
 */
export interface LettersInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
}

export const LettersInput: React.FC<LettersInputProps> = ({
  value,
  onChange,
  maxLength = 120,
  className = '',
  onKeyDown,
  onBeforeInput,
  onPaste,
  onDrop,
  ...props
}) => {
  // Helper to strip any number/digit and code injection
  const filterLetters = (input: string): string => {
    return input
      .replace(/[0-9\u0660-\u0669\u06F0-\u06F9]/g, '')
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\s.\-']/g, '')
      .slice(0, maxLength);
  };

  return (
    <input
      {...props}
      type="text"
      value={value}
      maxLength={maxLength}
      onKeyDown={(e) => {
        // Allow navigation and modification shortcut keys
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'].includes(e.key) &&
          /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(e.key)
        ) {
          e.preventDefault();
        }
        onKeyDown?.(e);
      }}
      onBeforeInput={(e: React.FormEvent<HTMLInputElement>) => {
        const nativeEvt = e.nativeEvent as InputEvent;
        if (nativeEvt.data && /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(nativeEvt.data)) {
          e.preventDefault();
        }
        onBeforeInput?.(e);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const filtered = filterLetters(text);
        if (filtered) {
          onChange(filterLetters(value + filtered));
        }
        onPaste?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text/plain');
        const filtered = filterLetters(text);
        if (filtered) {
          onChange(filterLetters(value + filtered));
        }
        onDrop?.(e);
      }}
      onChange={(e) => {
        onChange(filterLetters(e.target.value));
      }}
      className={className}
    />
  );
};

/**
 * Strict Numbers-Only Input (Blocks letters & symbols on keyboard, beforeinput, paste, drop, digits only)
 */
export interface NumbersInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
  allowPlus?: boolean;
}

export const NumbersInput: React.FC<NumbersInputProps> = ({
  value,
  onChange,
  maxLength = 30,
  allowPlus = false,
  className = '',
  onKeyDown,
  onBeforeInput,
  onPaste,
  onDrop,
  ...props
}) => {
  const filterDigits = (input: string): string => {
    let raw = input
      .replace(/[\u0660-\u0669]/g, d => (d.charCodeAt(0) - 0x0660).toString())
      .replace(/[\u06F0-\u06F9]/g, d => (d.charCodeAt(0) - 0x06F0).toString());
    const hasPlus = allowPlus && raw.startsWith('+');
    const digits = raw.replace(/[^\d]/g, '').slice(0, maxLength);
    return hasPlus ? `+${digits}` : digits;
  };

  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      maxLength={maxLength}
      onKeyDown={(e) => {
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'].includes(e.key)
        ) {
          if (allowPlus && e.key === '+') return;
          if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
          }
        }
        onKeyDown?.(e);
      }}
      onBeforeInput={(e: React.FormEvent<HTMLInputElement>) => {
        const nativeEvt = e.nativeEvent as InputEvent;
        if (nativeEvt.data) {
          if (allowPlus && nativeEvt.data === '+') return;
          if (!/^[0-9]+$/.test(nativeEvt.data)) {
            e.preventDefault();
          }
        }
        onBeforeInput?.(e);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const filtered = filterDigits(text);
        if (filtered) {
          onChange(filterDigits(value + filtered));
        }
        onPaste?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text/plain');
        const filtered = filterDigits(text);
        if (filtered) {
          onChange(filterDigits(value + filtered));
        }
        onDrop?.(e);
      }}
      onChange={(e) => {
        onChange(filterDigits(e.target.value));
      }}
      className={className}
    />
  );
};

/**
 * Strict Money / Decimal Input (Allows only digits and a single decimal point)
 */
export interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (val: string) => void;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  className = '',
  onKeyDown,
  onBeforeInput,
  onPaste,
  ...props
}) => {
  const filterMoney = (input: string): string => {
    let raw = input
      .replace(/[\u0660-\u0669]/g, d => (d.charCodeAt(0) - 0x0660).toString())
      .replace(/[\u06F0-\u06F9]/g, d => (d.charCodeAt(0) - 0x06F0).toString())
      .replace(/,/g, '.');
    let clean = raw.replace(/[^\d.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    return clean;
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onKeyDown={(e) => {
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End'].includes(e.key)
        ) {
          if (e.key === '.' || e.key === ',') return;
          if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
          }
        }
        onKeyDown?.(e);
      }}
      onBeforeInput={(e: React.FormEvent<HTMLInputElement>) => {
        const nativeEvt = e.nativeEvent as InputEvent;
        if (nativeEvt.data) {
          if (nativeEvt.data === '.' || nativeEvt.data === ',') return;
          if (!/^[0-9]+$/.test(nativeEvt.data)) {
            e.preventDefault();
          }
        }
        onBeforeInput?.(e);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        onChange(filterMoney(String(value ?? '') + text));
        onPaste?.(e);
      }}
      onChange={(e) => {
        onChange(filterMoney(e.target.value));
      }}
      className={className}
    />
  );
};

