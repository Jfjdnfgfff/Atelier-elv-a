import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer
} from '@zxing/library';
import { CustomerProfile } from '../types';
import { STORAGE_KEYS, loadFromStorage } from '../storage';
import { playPosScannerBeep } from '../utils/scannerSoundAndValidation';

export interface ExtractedCustomerData {
  name: string;
  phone: string;
  idNumber: string;
  birthDate?: string;
  address?: string;
  documentType?: string;
  notes?: string;
}

interface CustomerIdScannerModalProps {
  onExtract: (data: ExtractedCustomerData) => void;
  onClose: () => void;
  title?: string;
}

const playBeep = () => {
  playPosScannerBeep('modern');
};

// Parse Machine-Readable Zone (MRZ) on Biometric IDs & Passports locally in 1 millisecond
const parseMRZText = (rawText: string): Partial<ExtractedCustomerData> | null => {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ''))
    .filter((l) => l.length >= 12);
  if (lines.length === 0) return null;

  // 3-line TD1 format (e.g. Algerian & Global Biometric ID Cards)
  if (lines.length >= 3) {
    const l1 = lines[0];
    const l2 = lines[1];
    const l3 = lines[2];

    let idNumber = '';
    // Look for 9 to 18 characters doc number or NIN
    const matchId = l1.match(/^[ACI][A-Z0-9<]{2}([A-Z0-9]{8,18})/);
    if (matchId) {
      idNumber = matchId[1].replace(/</g, '');
    } else if (l1.length > 5) {
      idNumber = l1.substring(5, 19).replace(/</g, '');
    }

    let name = '';
    if (l3.includes('<<')) {
      const parts = l3.split('<<');
      const surname = parts[0].replace(/</g, ' ').trim();
      const given = (parts[1] || '').replace(/</g, ' ').trim();
      name = `${surname} ${given}`.trim();
    } else if (l3.length > 3) {
      name = l3.replace(/</g, ' ').trim();
    }

    let birthDate = '';
    if (l2.length >= 6) {
      const yy = l2.substring(0, 2);
      const mm = l2.substring(2, 4);
      const dd = l2.substring(4, 6);
      const year = parseInt(yy, 10) > 40 ? `19${yy}` : `20${yy}`;
      birthDate = `${year}-${mm}-${dd}`;
    }

    if (idNumber || name) {
      return {
        idNumber,
        name,
        birthDate,
        documentType: 'بطاقة هوية بيومترية (MRZ)'
      };
    }
  }

  // 2-line TD3 format (Passports)
  if (lines.length >= 2) {
    const l1 = lines[0];
    const l2 = lines[1];
    if (l1.startsWith('P<') || l1.startsWith('P')) {
      const namePart = l1.substring(5).split('<<');
      const surname = namePart[0].replace(/</g, ' ').trim();
      const given = (namePart[1] || '').replace(/</g, ' ').trim();
      const name = `${surname} ${given}`.trim();

      const idNumber = l2.substring(0, 9).replace(/</g, '').trim();
      return {
        idNumber,
        name,
        documentType: 'جواز سفر بيومتري'
      };
    }
  }

  return null;
};

export const CustomerIdScannerModal: React.FC<CustomerIdScannerModalProps> = ({
  onExtract,
  onClose,
  title = 'مسح بطاقة الهوية أو باركود الزبون'
}) => {
  const [activeTab, setActiveTab] = useState<'id_card' | 'barcode' | 'manual'>('id_card');

  // Camera & Stream Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const isStoppedRef = useRef<boolean>(false);
  const animFrameIdRef = useRef<number | null>(null);
  const isScanningFrameRef = useRef<boolean>(false);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // States
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(1.2);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);

  // Extracted Result Draft for Review
  const [extractedData, setExtractedData] = useState<ExtractedCustomerData | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string | null>(null);

  // Auto focus phone input when data is extracted so user can directly type phone
  useEffect(() => {
    if (extractedData) {
      const timer = setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [extractedData]);

  // Manual input state
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualId, setManualId] = useState('');

  // Auto-scan timer ref
  const autoScanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoScanningRef = useRef<boolean>(false);

  // Initialize ZXing for High-Speed Barcode & 2D Code Decoding
  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.PDF_417,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A
    ]);
    const reader = new MultiFormatReader();
    reader.setHints(hints);
    zxingReaderRef.current = reader;

    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 280;
    offscreenCanvasRef.current = canvas;
  }, []);

  // Stop camera resources cleanly
  const stopCamera = useCallback(() => {
    isStoppedRef.current = true;
    isScanningFrameRef.current = false;

    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = null;
    }

    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    try {
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
    } catch {}

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch {}

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchOn(false);
  }, []);

  // Start Camera Engine
  const startCamera = useCallback(async () => {
    isStoppedRef.current = false;
    setIsInitializing(true);
    setCameraError(null);
    stopCamera();
    isStoppedRef.current = false;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('الكاميرا غير مدعومة في هذا المتصفح');
      }

      let deviceId = selectedDeviceId;
      if (!deviceId) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((d) => d.kind === 'videoinput');
          if (facingMode === 'environment') {
            const rear = cameras.find((d) =>
              /back|rear|environment|world|خلف/i.test(d.label || '')
            );
            deviceId = rear ? rear.deviceId : cameras[0]?.deviceId;
          } else {
            const front = cameras.find((d) =>
              /front|user|facing|أمام/i.test(d.label || '')
            );
            deviceId = front ? front.deviceId : cameras[0]?.deviceId;
          }
        } catch {}
      }

      const videoConstraints: MediaTrackConstraints = {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: deviceId ? undefined : { ideal: facingMode },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 20 }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false
        });
      }

      if (isStoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.muted = true;
        await videoEl.play();
      }

      setIsInitializing(false);

      const track = stream.getVideoTracks()[0];
      if (track) {
        videoTrackRef.current = track;
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;

        const advancedConstraints: any = {};
        if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          advancedConstraints.focusMode = 'continuous';
        }
        if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
          advancedConstraints.exposureMode = 'continuous';
        }
        if (caps.zoom && caps.zoom.max > (caps.zoom.min || 1)) {
          const minZ = caps.zoom.min || 1;
          const maxZ = caps.zoom.max;
          setZoomCaps({ min: minZ, max: maxZ, step: caps.zoom.step || 0.1 });
          const initialZ = Math.min(maxZ, Math.max(minZ, 1.2));
          setCurrentZoom(initialZ);
          advancedConstraints.zoom = initialZ;
        }

        if (Object.keys(advancedConstraints).length > 0) {
          track.applyConstraints({ advanced: [advancedConstraints] }).catch(() => {});
        }

        setTorchAvailable(!!caps.torch);
        setTorchOn(false);
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsInitializing(false);
      setCameraError(err?.message || 'تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الصلاحيات.');
    }
  }, [facingMode, selectedDeviceId, stopCamera]);

  // Decode Barcode from Live Video Frame (Ultra fast in < 10ms)
  const decodeBarcodeFrame = useCallback((video: HTMLVideoElement): string | null => {
    if (!zxingReaderRef.current || !offscreenCanvasRef.current) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = vw * 0.9;
    const cropH = vh * 0.6;
    const cropX = (vw - cropW) / 2;
    const cropY = (vh - cropH) / 2;

    const targetW = 440;
    const targetH = 280;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    const luminances = new Uint8ClampedArray(targetW * targetH);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      luminances[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    const lumSource = new RGBLuminanceSource(luminances, targetW, targetH);
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
      const result = zxingReaderRef.current.decodeWithState(bitmap);
      if (result && result.getText()) return result.getText();
    } catch {
      try {
        const bitmap2 = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource));
        const result2 = zxingReaderRef.current.decodeWithState(bitmap2);
        if (result2 && result2.getText()) return result2.getText();
      } catch {}
    }
    return null;
  }, []);

  // Parse Barcode or MRZ string instantly
  const handleBarcodeDecoded = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    playBeep();
    if (navigator.vibrate) {
      try { navigator.vibrate([50, 30, 50]); } catch {}
    }

    // 1. Check if MRZ on ID Card / Passport
    const mrzData = parseMRZText(code);
    if (mrzData && (mrzData.name || mrzData.idNumber)) {
      setExtractedData({
        name: mrzData.name || '',
        idNumber: mrzData.idNumber || '',
        phone: '',
        birthDate: mrzData.birthDate || '',
        documentType: mrzData.documentType || 'بطاقة بيومترية (MRZ)',
        notes: 'تمت قراءة الكود البيومتري فورياً'
      });
      setOcrStatusMessage('⚡ تم التعرف الفوري (0.01 ثانية)!');
      return;
    }

    // 2. Check if JSON format
    try {
      const parsed = JSON.parse(code);
      if (parsed.name || parsed.idNumber || parsed.phone) {
        setExtractedData({
          name: parsed.name || '',
          phone: parsed.phone || '',
          idNumber: parsed.idNumber || parsed.nin || '',
          address: parsed.address || '',
          documentType: 'بطاقة زبون إلكترونية (QR)',
          notes: parsed.notes || ''
        });
        setOcrStatusMessage('⚡ تم التعرف الفوري على بيانات الزبون!');
        return;
      }
    } catch {}

    // 3. Check Key-Value format (e.g. NAME:...;PHONE:...)
    if (code.includes(':') || code.includes(';')) {
      const parts = code.split(/[;\n]/);
      let name = '';
      let phone = '';
      let idNumber = '';
      parts.forEach((p) => {
        const [k, v] = p.split(':').map((s) => s.trim());
        if (k && v) {
          const lk = k.toLowerCase();
          if (lk.includes('name') || lk.includes('nom') || lk.includes('اسم')) name = v;
          else if (lk.includes('phone') || lk.includes('tel') || lk.includes('هاتف')) phone = v;
          else if (lk.includes('id') || lk.includes('nin') || lk.includes('بطاقة') || lk.includes('رقم')) idNumber = v;
        }
      });
      if (name || idNumber || phone) {
        setExtractedData({
          name,
          phone,
          idNumber,
          documentType: 'باركود زبون مركب'
        });
        setOcrStatusMessage('⚡ تم استخراج بيانات الزبون فوراً!');
        return;
      }
    }

    // 4. Check if matching existing customer in local database
    const storedCustomers: CustomerProfile[] = loadFromStorage(STORAGE_KEYS.CUSTOMERS, []);
    const match = storedCustomers.find(
      (c) =>
        (c.idNumber && c.idNumber === code) ||
        (c.phone && c.phone === code) ||
        c.id === code ||
        c.name.toLowerCase() === code.toLowerCase()
    );

    if (match) {
      setExtractedData({
        name: match.name,
        phone: match.phone,
        idNumber: match.idNumber || code,
        notes: match.notes || 'تم استرجاع الزبون من قاعدة بيانات المحل'
      });
      setOcrStatusMessage('⚡ تم العثور على ملف الزبون في قاعدة البيانات!');
      return;
    }

    // 5. Default purely digits => ID Number or Phone
    if (/^\d{8,20}$/.test(code)) {
      setExtractedData({
        name: '',
        phone: code.startsWith('05') || code.startsWith('06') || code.startsWith('07') ? code : '',
        idNumber: code,
        documentType: 'رقم التعريف الوطني / الباركود'
      });
      setOcrStatusMessage('⚡ تم قراءة رقم بطاقة الهوية فوراً!');
    } else {
      setExtractedData({
        name: code,
        phone: '',
        idNumber: '',
        documentType: 'كود / باركود'
      });
    }
  }, []);

  // Continuous background loop for Real-time Barcode scanning (60 FPS)
  useEffect(() => {
    if (activeTab === 'manual' || extractedData) return;

    let stopped = false;
    const loop = async () => {
      if (stopped || isScanningFrameRef.current || !videoRef.current) return;
      const video = videoRef.current;
      if (video.readyState >= 2) {
        isScanningFrameRef.current = true;
        try {
          const code = decodeBarcodeFrame(video);
          if (code) {
            handleBarcodeDecoded(code);
            return;
          }
        } catch {}
        isScanningFrameRef.current = false;
      }
      if (!stopped) {
        animFrameIdRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [activeTab, extractedData, decodeBarcodeFrame, handleBarcodeDecoded]);

  // Refs for tracking state inside continuous intervals
  const isProcessingAIRef = useRef<boolean>(false);
  const extractedDataRef = useRef<ExtractedCustomerData | null>(null);

  useEffect(() => {
    isProcessingAIRef.current = isProcessingAI;
  }, [isProcessingAI]);

  useEffect(() => {
    extractedDataRef.current = extractedData;
  }, [extractedData]);

  // High-Resolution ID Card capture for crystal-clear OCR
  const cropAndCompressIDCard = (video: HTMLVideoElement): string | null => {
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;

      // Full frame high-resolution target (up to 1280px wide) to capture all names & NIN without cropping
      const targetW = Math.min(1280, vw);
      const targetH = Math.round((targetW * vh) / vw);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = 'contrast(1.08) brightness(1.02)';
      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, targetW, targetH);
      ctx.filter = 'none';
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return null;
    }
  };

  // Capture Photo and run Ultra-Fast Gemini Flash OCR (<0.2s)
  const captureAndExtractWithAI = async (customBase64?: string, isAuto = false) => {
    if (isProcessingAIRef.current) return;

    let base64ToUse = customBase64;

    if (!base64ToUse) {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        if (!isAuto) alert('الكاميرا غير جاهزة بعد، يرجى الانتظار ثانية...');
        return;
      }

      // Check instant barcode first in this frame
      try {
        const instantCode = decodeBarcodeFrame(video);
        if (instantCode) {
          handleBarcodeDecoded(instantCode);
          return;
        }
      } catch {}

      // Capture full frame
      base64ToUse = cropAndCompressIDCard(video) || '';
      if (!base64ToUse) return;
    }

    if (!isAuto) setPreviewPhoto(base64ToUse);
    setIsProcessingAI(true);
    setOcrStatusMessage(isAuto ? '⚡ جاري المسح والتلقائي لبطاقة الهوية...' : '⚡ جاري القراءة الفورية...');

    try {
      const response = await fetch('/api/ocr-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64ToUse,
          mimeType: 'image/jpeg'
        })
      });

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const info = resJson.data;
        const cleanName = (info.name || '').replace(/^(الاسم واللقب|الاسم|اللقب|Nom|Prénom)[\s:]*/i, '').trim();
        const cleanId = (info.idNumber || '').replace(/^(NIN|رقم التعريف|بطاقة|ID)[\s:]*/i, '').trim();

        if (cleanName || cleanId || info.phone) {
          playBeep();
          if (navigator.vibrate) {
            try { navigator.vibrate([60, 40, 60]); } catch {}
          }

          setExtractedData({
            name: cleanName,
            idNumber: cleanId,
            phone: info.phone || '',
            birthDate: info.birthDate || '',
            address: info.address || '',
            documentType: info.documentType || 'بطاقة هوية / وثيقة رسمية',
            notes: info.notes || ''
          });
          setOcrStatusMessage('✓ تم قراءة الاسم واللقب ورقم التعريف بنجاح!');
          return;
        }
      }
      
      if (!isAuto) {
        setExtractedData({
          name: '',
          idNumber: '',
          phone: '',
          notes: resJson.error || 'يرجى مراجعة وتأكيد بيانات الزبون'
        });
        setOcrStatusMessage(resJson.error || 'يرجى التأكد من وضوح الصورة');
      }
    } catch (err: any) {
      console.warn('OCR Fetch Note:', err);
      if (!isAuto) {
        setExtractedData({
          name: '',
          idNumber: '',
          phone: '',
          notes: 'تم التقاط الصورة، يرجى كتابة الاسم ورقم الهوية لتأكيد العملية'
        });
        setOcrStatusMessage('يمكنك كتابة بيانات الزبونة وتأكيدها مباشرة');
      }
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Continuous Auto-Scan Interval for ID Cards (runs every 2.5 seconds until extracted)
  useEffect(() => {
    if (activeTab !== 'id_card' || isInitializing || extractedData) return;

    const interval = setInterval(() => {
      if (
        !isProcessingAIRef.current &&
        !extractedDataRef.current &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        captureAndExtractWithAI(undefined, true);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTab, isInitializing, extractedData]);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      if (result) {
        captureAndExtractWithAI(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Switch Camera
  const switchCamera = async () => {
    try {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      if (cameras.length > 1) {
        const nextIndex = selectedDeviceId
          ? (cameras.findIndex((c) => c.deviceId === selectedDeviceId) + 1) % cameras.length
          : 1;
        setSelectedDeviceId(cameras[nextIndex].deviceId);
      }
    } catch {}
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!videoTrackRef.current || !torchAvailable) return;
    try {
      const next = !torchOn;
      await videoTrackRef.current.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {}
  };

  // Adjust Zoom
  const adjustZoom = async (delta: number) => {
    if (!videoTrackRef.current || !zoomCaps) return;
    const target = Math.min(zoomCaps.max, Math.max(zoomCaps.min, currentZoom + delta));
    try {
      await videoTrackRef.current.applyConstraints({ advanced: [{ zoom: target } as any] });
      setCurrentZoom(target);
    } catch {}
  };

  // Final confirmation
  const handleConfirmExtract = () => {
    if (!extractedData) return;
    if (!extractedData.name.trim() && !extractedData.idNumber.trim() && !extractedData.phone.trim()) {
      alert('الرجاء التأكد من وجود الاسم أو رقم الهوية أو الهاتف على الأقل');
      return;
    }

    stopCamera();
    onExtract(extractedData);
    onClose();
  };

  // Fast manual confirm
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() && !manualId.trim() && !manualPhone.trim()) {
      alert('يرجى إدخال اسم أو هاتف أو رقم هوية الزبون');
      return;
    }
    stopCamera();
    onExtract({
      name: manualName.trim(),
      phone: manualPhone.trim(),
      idNumber: manualId.trim()
    });
    onClose();
  };

  // Lifecycle
  useEffect(() => {
    if (activeTab !== 'manual') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, startCamera, stopCamera]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl w-full max-w-lg p-4 sm:p-5 shadow-2xl border border-slate-100 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-xs">
              ⚡
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                {title}
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  قراءة فورية ⚡
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                استخراج الاسم ورقم الهوية في جزء من الثانية (NIN + الاسم)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors active:scale-95"
            title="إغلاق"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selection */}
        {!extractedData && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl mb-3 text-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab('id_card');
                setExtractedData(null);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                activeTab === 'id_card'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>💳</span>
              <span>بطاقة هوية (AI)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('barcode');
                setExtractedData(null);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                activeTab === 'barcode'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚡</span>
              <span>باركود فوري</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('manual');
                setExtractedData(null);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                activeTab === 'manual'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>✍️</span>
              <span>كتابة يدوية</span>
            </button>
          </div>
        )}

        {/* Fast Manual Tab */}
        {activeTab === 'manual' && !extractedData && (
          <form onSubmit={handleManualSubmit} className="space-y-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">اسم ولقب الزبونة / الزبون *</label>
              <input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="الاسم واللقب..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="05 / 06 / 07..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">رقم بطاقة الهوية (NIN)</label>
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="رقم البطاقة..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md shadow-rose-200"
            >
              ✓ اعتماد وتعبئة النموذج
            </button>
          </form>
        )}

        {/* Camera Error message */}
        {cameraError && !extractedData && activeTab !== 'manual' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center space-y-2 mb-3">
            <p className="text-xs font-bold text-red-800">{cameraError}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={startCamera}
                className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                إعادة تشغيل الكاميرا
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold"
              >
                رفع صورة من الهاتف 📁
              </button>
            </div>
          </div>
        )}

        {/* Extracted Data Review Form */}
        {extractedData ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmExtract();
            }}
            className="space-y-3.5 animate-in fade-in"
          >
            {ocrStatusMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-600 text-sm">⚡</span>
                  <span>{ocrStatusMessage}</span>
                </span>
                {extractedData.documentType && (
                  <span className="bg-emerald-200 text-emerald-900 text-[10px] px-2 py-0.5 rounded-md font-mono">
                    {extractedData.documentType}
                  </span>
                )}
              </div>
            )}

            {/* Photo Thumbnail if taken */}
            {previewPhoto && (
              <div className="relative w-full h-24 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                <img src={previewPhoto} alt="بطاقة الهوية" className="w-full h-full object-contain" />
                <span className="absolute bottom-1 right-2 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded backdrop-blur-xs font-bold">
                  الصورة الملتقطة
                </span>
              </div>
            )}

            {/* Quick Summary Cards */}
            <div className="space-y-3 bg-gradient-to-br from-slate-50 to-rose-50/20 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    👤 اسم ولقب الزبونة / الزبون *
                  </label>
                  <input
                    type="text"
                    required
                    value={extractedData.name}
                    onChange={(e) => setExtractedData({ ...extractedData, name: e.target.value })}
                    placeholder="الاسم واللقب..."
                    className="w-full bg-white border border-slate-300 focus:border-rose-500 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    🆔 رقم بطاقة التعريف / NIN
                  </label>
                  <input
                    type="text"
                    value={extractedData.idNumber}
                    onChange={(e) => setExtractedData({ ...extractedData, idNumber: e.target.value })}
                    placeholder="رقم البطاقة (NIN)..."
                    className="w-full bg-white border border-slate-300 focus:border-rose-500 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* Dedicated Phone Input with High-Visibility Highlight */}
              <div className="p-3 bg-emerald-50/80 border-2 border-emerald-400 rounded-2xl shadow-xs">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <span>📞 رقم الهاتف (أدخل رقم الزبون يدوياً):</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">كتابة يدوية</span>
                  </label>
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  autoFocus
                  value={extractedData.phone}
                  onChange={(e) => setExtractedData({ ...extractedData, phone: e.target.value })}
                  placeholder="05 / 06 / 07..."
                  className="w-full bg-white border-2 border-emerald-500 focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-sm font-black font-mono text-slate-900 focus:outline-none shadow-inner"
                />
              </div>

              {(extractedData.birthDate || extractedData.address) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/60">
                  {extractedData.birthDate && (
                    <div>
                      <span className="block text-[10px] text-slate-500 font-bold">🎂 تاريخ الميلاد:</span>
                      <span className="font-bold text-slate-800 text-[11px]">{extractedData.birthDate}</span>
                    </div>
                  )}
                  {extractedData.address && (
                    <div>
                      <span className="block text-[10px] text-slate-500 font-bold">📍 العنوان:</span>
                      <span className="font-bold text-slate-800 text-[11px]">{extractedData.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="submit"
                className="py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 active:scale-95 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-1.5"
              >
                <span>✓</span>
                <span>تعبئة النموذج فوراً</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExtractedData(null);
                  setPreviewPhoto(null);
                  setOcrStatusMessage(null);
                  if (activeTab !== 'manual') startCamera();
                }}
                className="py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1"
              >
                <span>🔄</span>
                <span>إعادة التصوير</span>
              </button>
            </div>
          </form>
        ) : activeTab !== 'manual' ? (
          /* Live Camera Viewport */
          <div className="space-y-3">
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-black border-2 border-slate-900 shadow-inner"
              style={{ minHeight: '260px', maxHeight: '320px' }}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  minHeight: '260px',
                  objectFit: 'cover',
                  background: '#000'
                }}
              />

              {/* Viewfinder Target Box with Live Scanning Laser */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {activeTab === 'id_card' ? (
                  /* ID Card Framing Rectangle */
                  <div
                    style={{
                      width: '88%',
                      height: '65%',
                      maxWidth: '420px',
                      border: '3px solid #f43f5e',
                      borderRadius: '16px',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)'
                    }}
                    className="relative overflow-hidden flex flex-col justify-between p-2"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-rose-200 bg-black/80 px-2 py-0.5 rounded-md border border-rose-500/30">
                        وجّه الكاميرا نحو بطاقة الهوية 💳
                      </span>
                    </div>

                    <div
                      className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-lg shadow-rose-500/80"
                      style={{ animation: 'laserScan 0.9s ease-in-out infinite alternate' }}
                    />

                    <span className="text-[9px] font-bold text-emerald-300 bg-black/75 px-2 py-0.5 rounded self-center">
                      ⚡ مسح فوري للباركود الخلفي أو اضغط الزر
                    </span>
                  </div>
                ) : (
                  /* Barcode Viewfinder */
                  <div
                    style={{
                      width: '90%',
                      height: '45%',
                      maxWidth: '420px',
                      border: '3px solid #10b981',
                      borderRadius: '14px',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)'
                    }}
                    className="relative overflow-hidden flex items-center justify-center"
                  >
                    <div
                      className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400/80"
                      style={{ animation: 'laserScan 0.8s ease-in-out infinite alternate' }}
                    />
                    <span className="absolute top-1.5 right-2 text-[9px] font-mono font-black text-emerald-300 bg-black/80 px-2 py-0.5 rounded-md">
                      ⚡ مسح فوري (0.01s)
                    </span>
                  </div>
                )}
              </div>

              {/* Ultra-Fast Processing Indicator Overlay */}
              {(isInitializing || isProcessingAI) && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white text-xs font-bold gap-2.5 z-30 p-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-10 h-10 animate-spin text-rose-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span className="absolute text-sm">⚡</span>
                  </div>
                  <span className="text-rose-200 font-black">
                    {isProcessingAI
                      ? '⚡ جاري استخراج الاسم ورقم التعريف فوراً...'
                      : 'تشغيل الكاميرا المباشرة...'}
                  </span>
                </div>
              )}

              {/* Switch Camera Top Button */}
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-auto">
                <button
                  type="button"
                  onClick={switchCamera}
                  className="bg-black/75 hover:bg-black/90 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold backdrop-blur-md transition-all active:scale-95 flex items-center gap-1 border border-white/10"
                >
                  <span>🔄</span>
                  <span className="text-[10px]">{facingMode === 'environment' ? 'خلفية' : 'أمامية'}</span>
                </button>
              </div>

              {/* Bottom Controls (Zoom & Torch) */}
              <div className="absolute bottom-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2 z-20">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustZoom(-0.3)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/75 text-white text-base font-bold backdrop-blur-md active:scale-95 border border-white/10"
                    title="تصغير"
                  >
                    −
                  </button>
                  <div className="px-2 py-1 rounded-xl bg-black/75 text-white text-[11px] font-bold font-mono border border-white/10">
                    {currentZoom.toFixed(1)}×
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustZoom(0.3)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/75 text-white text-base font-bold backdrop-blur-md active:scale-95 border border-white/10"
                    title="تكبير"
                  >
                    +
                  </button>
                </div>

                {torchAvailable && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl bg-black/75 ${
                      torchOn ? 'text-yellow-300 ring-2 ring-yellow-400 bg-yellow-950/70' : 'text-white'
                    } backdrop-blur-md active:scale-95 border border-white/10`}
                    title="تشغيل الفلاش (🔦)"
                  >
                    🔦
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isProcessingAI}
                onClick={() => captureAndExtractWithAI()}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <span className="text-xl">⚡</span>
                <span>فحص واستخراج بيانات البطاقة فوراً</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Native HD Camera Input */}
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  disabled={isProcessingAI}
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="py-2.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>📷</span>
                  <span>تصوير فائق الدقة HD</span>
                </button>

                {/* File Upload from Gallery */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  disabled={isProcessingAI}
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>📁</span>
                  <span>صورة من المعرض</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
