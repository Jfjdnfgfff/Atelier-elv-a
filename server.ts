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

  // Increase payload limit for base64 image captures
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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

  // OCR ID and Customer Document Extraction Route
  app.post('/api/ocr-id', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', textInput } = req.body;

      if (!imageBase64 && !textInput) {
        return res.status(400).json({ error: 'صورة البطاقة أو النص مطلوب' });
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

      const parts: any[] = [];
      if (cleanBase64) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        });
      }

      parts.push({
        text: `You are an expert AI document scanner specializing in Algerian Biometric National ID Cards (بطاقة التعريف الوطنية البيومترية), Passports, Driver Licenses, and Photocopied Identity Documents (نسخ فوطوكوبي أبيض وأسود أو ملونة).
Analyze the provided image carefully. Note: The document may be an original colored card OR a black & white / grayscale paper photocopy (فوطوكوبي أبيض وأسود).

Extract the following fields accurately regardless of color, monochrome, or photocopy paper format:
1. name: Full Name (الاسم واللقب معاً) in Arabic (e.g. "بن علي فاطمة الزهراء" or "بوجمعة محمد أمين"). If Arabic text is faint or not present, extract French/Latin name (e.g. "BENALI FATIMA ZOHRA"). DO NOT include labels like "الاسم", "اللقب", "Nom", "Prénom".
2. idNumber: National Identification Number (NIN / رقم التعريف الوطني). On Algerian biometric ID cards & photocopies, this is an 18-digit number (e.g. 109823456789012345). On passports or licenses, extract the official document/NIN number. Capture all 18 digits accurately.
3. phone: Phone number if visible or handwritten on the copy.
4. birthDate: Date of Birth (YYYY-MM-DD or DD/MM/YYYY as written).
5. address: Address/City if visible.
6. documentType: Document type in Arabic (e.g. "بطاقة تعريف وطنية بيومترية", "نسخة فوطوكوبي أبيض وأسود", "جواز سفر").

Output pure JSON adhering to the schema.`
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
      let parsedData = {};
      try {
        parsedData = JSON.parse(resultText);
      } catch {
        parsedData = { raw: resultText };
      }

      return res.json({
        success: true,
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

