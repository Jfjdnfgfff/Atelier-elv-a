import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { playPosScannerBeep, playPosErrorBeep } from '../utils/scannerSoundAndValidation';
import { Camera, RefreshCw, Check, Zap } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
  continuous?: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClose,
  title,
  continuous = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const barcodeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const isClosingRef = useRef<boolean>(false);

  // States
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentScanned, setRecentScanned] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  
  // Camera & Device Controls
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Anti-bounce refs
  const lastScannedBarcodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingBarcodeRef = useRef<boolean>(false);
  const scannerCallbackProcessingRef = useRef<boolean>(false);

  // 1. Close Camera & Cleanup
  const closeBarcodeCamera = useCallback(async () => {
    isClosingRef.current = true;

    try {
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
      }
    } catch {}
    zxingControlsRef.current = null;

    try {
      if (zxingReaderRef.current) {
        // Safe reset
      }
    } catch {}
    zxingReaderRef.current = null;

    if (barcodeVideoTrackRef.current) {
      try {
        barcodeVideoTrackRef.current.stop();
      } catch {}
      barcodeVideoTrackRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      } catch {}
      videoRef.current.srcObject = null;
    }

    setZoomCaps(null);
    setCurrentZoom(1);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  // 2. Process Detected Barcode
  const processBarcode = useCallback(
    async (rawCode: string) => {
      const barcode = String(rawCode ?? '').trim();
      if (!barcode || isProcessingBarcodeRef.current) return;

      const now = Date.now();
      // Prevent duplicate processing within 1500ms
      if (barcode === lastScannedBarcodeRef.current && now - lastScannedTimeRef.current < 1500) {
        return;
      }

      lastScannedBarcodeRef.current = barcode;
      lastScannedTimeRef.current = now;
      isProcessingBarcodeRef.current = true;

      try {
        playPosScannerBeep('classic');
        setRecentScanned(barcode);

        onScan(barcode);

        if (!continuous) {
          await closeBarcodeCamera();
          setTimeout(() => {
            onClose();
          }, 150);
        }
      } catch (err) {
        console.error('Barcode processing error:', err);
      } finally {
        isProcessingBarcodeRef.current = false;
      }
    },
    [closeBarcodeCamera, continuous, onClose, onScan]
  );

  // 3. Zoom Controls
  const setBarcodeZoom = useCallback(async (zoom: number) => {
    const track = barcodeVideoTrackRef.current;
    if (!track) return;

    try {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.zoom && caps.zoom.max > (caps.zoom.min || 1)) {
        const minZ = caps.zoom.min || 1;
        const maxZ = caps.zoom.max;
        const clamped = Math.min(maxZ, Math.max(minZ, zoom));
        await (track.applyConstraints as any)({
          advanced: [{ zoom: clamped }]
        });
        setCurrentZoom(clamped);
      }
    } catch (e) {
      // Ignored if zoom constraint not supported
    }
  }, []);

  const adjustBarcodeZoom = (delta: number) => {
    setBarcodeZoom(currentZoom + delta);
  };

  // 4. Torch Toggle
  const toggleBarcodeTorch = async () => {
    const track = barcodeVideoTrackRef.current;
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track.applyConstraints as any)({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      setTorchOn(torchOn);
    }
  };

  // 5. Start ZXing Barcode Scanner
  const startBarcodeScanner = useCallback(async () => {
    isClosingRef.current = false;
    setIsInitializing(true);
    setErrorMsg(null);

    await closeBarcodeCamera();
    isClosingRef.current = false;

    const video = videoRef.current;
    if (!video) return;

    try {
      // Decode hints with restricted barcode types + TRY_HARDER
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE
      ]);

      // Check every 150ms for instant detection
      const zxingReader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 500
      });
      zxingReaderRef.current = zxingReader;

      // Identify device ID
      let targetDeviceId = selectedDeviceId;
      if (!targetDeviceId) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false
          });
          tempStream.getTracks().forEach((track) => track.stop());

          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((d) => d.kind === 'videoinput');
          if (facingMode === 'environment') {
            const rear = cameras.find((d) =>
              /back|rear|environment|world|خلف|خلفية/i.test(d.label || '')
            );
            targetDeviceId = rear ? rear.deviceId : cameras[0]?.deviceId;
          } else {
            const front = cameras.find((d) =>
              /front|user|facing|أمام|أمامية/i.test(d.label || '')
            );
            targetDeviceId = front ? front.deviceId : cameras[0]?.deviceId;
          }
        } catch (e) {}
      }

      // High-resolution flexible constraints
      const videoConstraints: MediaTrackConstraints = {
        deviceId: targetDeviceId ? { ideal: targetDeviceId } : undefined,
        facingMode: targetDeviceId ? undefined : { ideal: facingMode },
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 }
      };

      const controls = await zxingReader.decodeFromConstraints(
        { video: videoConstraints, audio: false },
        video,
        async (result, error) => {
          if (!result || isClosingRef.current) return;

          const barcode = String(result.getText ? result.getText() : (result as any).text || '').trim();
          if (!barcode || isProcessingBarcodeRef.current || scannerCallbackProcessingRef.current) return;

          const now = Date.now();
          if (barcode === lastScannedBarcodeRef.current && now - lastScannedTimeRef.current < 1500) {
            return;
          }

          scannerCallbackProcessingRef.current = true;
          try {
            await processBarcode(barcode);
          } catch (e) {
            console.error('Barcode processing error:', e);
          } finally {
            scannerCallbackProcessingRef.current = false;
          }
        }
      );

      zxingControlsRef.current = controls;

      // Enhance camera track properties
      try {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          const track = stream.getVideoTracks()[0];
          if (track) {
            barcodeVideoTrackRef.current = track;
            const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;

            const advanced: any = {};
            if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              advanced.focusMode = 'continuous';
            }
            if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
              advanced.exposureMode = 'continuous';
            }

            if (caps.zoom && caps.zoom.max > (caps.zoom.min || 1)) {
              const minZ = caps.zoom.min || 1;
              const maxZ = caps.zoom.max;
              const stepZ = caps.zoom.step || 0.1;
              setZoomCaps({ min: minZ, max: maxZ, step: stepZ });
              const startZoom = Math.min(maxZ, Math.max(minZ, minZ + (maxZ - minZ) * 0.25));
              setCurrentZoom(startZoom);
              advanced.zoom = startZoom;
            } else {
              setZoomCaps(null);
            }

            if (Object.keys(advanced).length > 0) {
              await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
            }

            setTorchAvailable(Boolean(caps.torch));
            setTorchOn(false);
          }
        }
      } catch (e) {}

      setIsInitializing(false);
    } catch (err: any) {
      console.error('ZXing camera scanner error:', err);
      await closeBarcodeCamera();
      setIsInitializing(false);
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('denied')) {
        setErrorMsg('تم رفض إذن الكاميرا. يرجى تفعيل إذن الكاميرا في إعدادات المتصفح.');
      } else {
        setErrorMsg('تعذر تشغيل قارئ الباركود. تأكد من السماح بالكاميرا أو أدخل الرقم يدوياً.');
      }
    }
  }, [closeBarcodeCamera, facingMode, processBarcode, selectedDeviceId]);

  // 6. Switch Camera (Rear / Front)
  const switchBarcodeCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      if (cameras.length > 1) {
        let currentIndex = -1;
        if (selectedDeviceId) {
          currentIndex = cameras.findIndex((c) => c.deviceId === selectedDeviceId);
        }
        if (currentIndex === -1 && barcodeVideoTrackRef.current && barcodeVideoTrackRef.current.getSettings) {
          const settings = barcodeVideoTrackRef.current.getSettings();
          if (settings.deviceId) {
            currentIndex = cameras.findIndex((c) => c.deviceId === settings.deviceId);
          }
        }
        const nextIndex = (currentIndex + 1) % cameras.length;
        setSelectedDeviceId(cameras[nextIndex].deviceId);
      } else {
        setSelectedDeviceId(null);
      }
    } catch (e) {
      setSelectedDeviceId(null);
    }
  };

  // 7. Restart Scanner
  const restartBarcodeScanner = async () => {
    await startBarcodeScanner();
  };

  // 8. Manual Barcode Form Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processBarcode(manualInput.trim());
    setManualInput('');
  };

  // 9. External USB / Bluetooth Barcode Gun Support
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const now = Date.now();
      if (now - lastKeyTime > 60) buffer = '';
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 1) {
          e.preventDefault();
          processBarcode(buffer.trim());
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processBarcode]);

  // Lifecycle initialization
  useEffect(() => {
    startBarcodeScanner();
    return () => {
      closeBarcodeCamera();
    };
  }, [startBarcodeScanner, closeBarcodeCamera]);

  return (
    <div
      id="barcodeModal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Top Button */}
        <button
          onClick={async () => {
            await closeBarcodeCamera();
            onClose();
          }}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors active:scale-95 z-30"
          title="إغلاق"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="text-center mb-3">
          <h2 id="barcodeModalTitle" className="text-base font-bold text-slate-800 leading-tight">
            {title || 'وجّه الخطوط داخل الإطار — جاري البحث تلقائيًا'}
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            محرك مسح فائق الدقة مدعوم بـ ZXing 150ms
          </p>
        </div>

        {/* Camera Container */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-slate-200 mb-3 shadow-inner flex items-center justify-center min-h-[260px] max-h-[350px]">
          
          {errorMsg ? (
            <div className="p-4 text-center space-y-2.5 z-20">
              <Camera className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-amber-200 font-bold leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={restartBarcodeScanner}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              {/* Real Video Element */}
              <video
                ref={videoRef}
                id="barcodeVideo"
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ minHeight: '260px', background: '#000' }}
              />

              {/* Exact Green Focus Bounding Box Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  style={{
                    width: '92%',
                    height: '34%',
                    maxWidth: '620px',
                    border: '3px solid #22c55e',
                    borderRadius: '14px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.22)'
                  }}
                  className="relative overflow-hidden"
                >
                  <div
                    className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#22c55e]"
                    style={{ animation: 'laserScan 1.2s ease-in-out infinite alternate' }}
                  />
                </div>
              </div>

              {/* Loading Indicator */}
              {isInitializing && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-xs font-bold gap-2 z-20">
                  <svg className="w-5 h-5 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>جاري تشغيل الكاميرا...</span>
                </div>
              )}

              {/* Scanned Badge */}
              {recentScanned && (
                <div className="absolute top-3 inset-x-4 bg-slate-900 text-white text-xs font-bold p-2 rounded-xl text-center shadow-xl flex items-center justify-center gap-1.5 z-30 border border-slate-700">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>تم التقاط الباركود:</span>
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded">{recentScanned}</span>
                </div>
              )}

              {/* Top Camera Switch button */}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-auto">
                <button
                  type="button"
                  onClick={switchBarcodeCamera}
                  className="bg-black/75 hover:bg-black text-white px-2.5 py-1.5 rounded-xl text-xs font-bold backdrop-blur-xs transition-all active:scale-95 flex items-center gap-1.5 border border-white/15"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
                  <span>تبديل الكاميرا</span>
                </button>
              </div>

              {/* Bottom Controls: Zoom & Torch */}
              <div
                id="barcodeControls"
                className="absolute bottom-2 right-2 left-2 flex items-center justify-between gap-2 pointer-events-none z-20"
              >
                {/* Zoom Buttons */}
                <div className="flex items-center gap-1.5 pointer-events-auto bg-black/70 backdrop-blur-xs px-2 py-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => adjustBarcodeZoom(-0.5)}
                    className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg font-black text-sm active:scale-90 transition-all"
                  >
                    −
                  </button>
                  <div id="barcodeZoomLabel" className="text-white text-xs font-bold font-mono px-1">
                    {currentZoom.toFixed(1)}×
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustBarcodeZoom(0.5)}
                    className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg font-black text-sm active:scale-90 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Torch Button */}
                {torchAvailable && (
                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <button
                      type="button"
                      id="barcodeTorchBtn"
                      onClick={toggleBarcodeTorch}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-xs transition-all active:scale-95 flex items-center gap-1.5 border ${
                        torchOn ? 'bg-amber-400 text-black border-amber-300' : 'bg-black/70 text-white border-white/10'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{torchOn ? 'فلاش شغال' : 'فلاش'}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Manual Barcode Input Form */}
        <form onSubmit={handleManualSubmit} className="flex gap-2 mb-3">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="أو أدخل رقم الباركود يدوياً..."
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95"
          >
            تأكيد ↵
          </button>
        </form>

        {/* 3 Action Buttons Grid */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={switchBarcodeCamera}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all text-center active:scale-95"
          >
            تبديل الكاميرا
          </button>
          <button
            type="button"
            onClick={restartBarcodeScanner}
            className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all text-center active:scale-95 border border-emerald-200"
          >
            إعادة المسح
          </button>
          <button
            type="button"
            onClick={async () => {
              await closeBarcodeCamera();
              onClose();
            }}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all text-center active:scale-95"
          >
            إغلاق الكاميرا
          </button>
        </div>
      </div>
    </div>
  );
};
