import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const distPath = path.join(process.cwd(), 'dist');

  // Standard lightweight payload limit for regular API requests
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Dedicated large payload parser for OCR document extraction
  const ocrJsonParser = express.json({ limit: '25mb' });
  const ocrUrlParser = express.urlencoded({ extended: true, limit: '25mb' });

  // Lazy Gemini Client initialization
  let aiClient: GoogleGenAI | null = null;
  function getAiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
  });

  // OCR ID and Customer Document Extraction Route (isolated 25mb parser)
  app.post('/api/ocr-id', ocrJsonParser, ocrUrlParser, async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', textInput } = req.body;

      if (!imageBase64 && !textInput) {
        return res.status(400).json({ error: 'صورة البطاقة أو النص مطلوب' });
      }

      // Security check: Validate MIME Type
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      const cleanMime = (mimeType || 'image/jpeg').toLowerCase().trim();
      if (imageBase64 && !allowedMimes.includes(cleanMime)) {
        return res.status(400).json({ error: 'نوع الملف غير مسموح به. يرجى إرفاق صورة فقط (JPEG, PNG, WEBP).' });
      }

      if (!process.env.GEMINI_API_KEY) {
        // Return a graceful response if API key is not configured
        return res.status(500).json({ 
          error: 'مفتاح Gemini API غير مهيأ على الخادم',
          fallback: true
        });
      }

      // Clean base64 string if data URL header is included
      let cleanBase64 = imageBase64 || '';
      if (cleanBase64.includes(';base64,')) {
        cleanBase64 = cleanBase64.split(';base64,')[1];
      }

      // Generate a secure server-side random filename for the session asset
      const ext = cleanMime.split('/')[1] || 'jpg';
      const secureAssetFilename = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

      const parts: any[] = [];
      if (cleanBase64) {
        parts.push({
          inlineData: {
            mimeType: cleanMime,
            data: cleanBase64,
          },
        });
      }

      parts.push({
        text: `You are an elite Forensic OCR & AI Document Intelligence System specialized in reading damaged, blurry, folded, creased, low-contrast, or faint Algerian Biometric ID Cards, Passports, Driver Licenses, and Paper Photocopies (فوطوكوبي أبيض وأسود / ملون / أوراق مطوية / نصوص مضببة).

Perform deep visual reconstruction & intelligent document recovery:
1. Carefully inspect folded paper creases, shadows, angled documents, faint photocopy toner, and blurred handwriting or printed text.
2. Read BOTH Arabic text and French/Latin text across the entire document.
3. If Arabic text is blurry, faint, or cut off by a paper fold line, cross-reference and reconstruct the Full Name using the French/Latin name (e.g. if Latin reads "BENALI FATIMA ZOHRA", output clean Arabic "بن علي فاطمة الزهراء" or clean Latin "BENALI FATIMA ZOHRA").
4. Scan the entire image to locate the 18-digit National Identification Number (NIN / رقم التعريف الوطني). On Algerian cards & photocopies, it is 18 digits (e.g., 109823456789012345). Reconstruct all 18 digits accurately even if faint or partially interrupted by a fold line.
5. Extract phone numbers, birth dates, addresses, and document descriptions if present.

JSON Schema Requirements:
- name: Full Name (الاسم واللقب معاً) in clean Arabic or Latin. NO field labels like "الاسم:" or "Nom:".
- idNumber: 18-digit NIN or Passport/License number (digits only).
- phone: Phone number if visible or handwritten.
- birthDate: Date of Birth (YYYY-MM-DD or DD/MM/YYYY as written).
- address: Address if visible.
- documentType: Type description in Arabic (e.g. "بطاقة تعريف بيومترية", "نسخة مطوية / فوطوكوبي", "جواز سفر").`
      });

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              idNumber: { type: Type.STRING },
              phone: { type: Type.STRING },
              birthDate: { type: Type.STRING },
              address: { type: Type.STRING },
              documentType: { type: Type.STRING },
            },
          },
        },
      });

      const resultText = response.text || '{}';
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(resultText);
      } catch {
        parsedData = {};
      }

      // Security sanitization pass on OCR output
      const sanitizeStr = (s: any) => {
        if (!s || typeof s !== 'string') return '';
        return s.replace(/<[^>]*>?/gm, '').replace(/['"--]/g, '').trim();
      };

      if (parsedData && typeof parsedData === 'object') {
        parsedData.name = sanitizeStr(parsedData.name);
        parsedData.idNumber = sanitizeStr(parsedData.idNumber).replace(/[^\d]/g, '').slice(0, 30);
        parsedData.phone = sanitizeStr(parsedData.phone);
        parsedData.address = sanitizeStr(parsedData.address);
        parsedData.documentType = sanitizeStr(parsedData.documentType);
      }

      return res.json({
        success: true,
        secureFilename: secureAssetFilename,
        data: parsedData,
      });
    } catch (error: any) {
      console.error('OCR ID Processing Error:', error);
      return res.status(500).json({
        error: error?.message || 'فشل معالجة بطاقة الهوية',
        success: false,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

