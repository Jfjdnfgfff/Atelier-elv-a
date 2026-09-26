import React, { useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { downloadImagesAsPng } from '../utils/pngDownload';
import { openPrintInterface } from '../utils/printInterface';

interface ImagePreviewModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ url, title, onClose }) => {
  const [busy, setBusy] = useState<'download' | null>(null);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const handleDownload = async () => {
    if (!url || busy) return;
    setBusy('download');
    setMessage('');
    setMessageIsError(false);
    try {
      await downloadImagesAsPng([{ src: url, filename: title || 'صورة' }]);
      setMessage('تم تنزيل الصورة بصيغة PNG');
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'تعذر تنزيل الصورة بصيغة PNG');
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = () => {
    if (!url) return;
    openPrintInterface({
      title: title || 'صورة المنتج',
      fileName: title || 'صورة',
      images: [{ src: url, filename: title || 'صورة', caption: title || 'صورة المنتج' }],
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl"
        dir="rtl"
      >
        <div className="p-3 bg-slate-900 flex items-center justify-between gap-2 text-white border-b border-slate-800">
          <span className="font-bold text-xs truncate">{title}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy === 'download'}
              className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-[11px] font-bold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{busy === 'download' ? 'جاري التنزيل...' : 'تنزيل صور'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-2.5 rounded-lg bg-white text-slate-900 text-[11px] font-bold flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {message && (
          <p className={`px-3 py-1.5 text-[11px] font-bold ${messageIsError ? 'text-rose-200 bg-rose-950/70' : 'text-emerald-200 bg-emerald-950/60'}`}>{message}</p>
        )}
        <div className="max-h-[75vh] overflow-hidden flex items-center justify-center bg-black">
          <img src={url} alt={title} className="max-h-[75vh] w-auto object-contain" />
        </div>
      </div>
    </div>
  );
};
