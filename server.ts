import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for base64 image captures
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
      text: `You are an ultra-fast high accuracy ID, Passport, and Driver License OCR reader for retail stores.
Analyze the provided image of the identity document (e.g. Algerian Biometric ID card, Passport, Driver License, or Arab/International ID).

Extract:
1. name: Full Name (الاسم واللقب) in Arabic (e.g. "فاطمة الزهراء بن علي" or "محمد أمين") if visible, or in French/Latin if no Arabic.
2. idNumber: National Identification Number (NIN / رقم التعريف الوطني - 18 digits on Algerian biometric cards) or Document/Passport number.
3. phone: Phone number if visible.
4. birthDate: Birth date (YYYY-MM-DD or as written).
5. address: Address/City if visible.
6. documentType: Document type in Arabic (e.g. "بطاقة تعريف وطنية بيومترية", "جواز سفر بيومتري", "رخصة سياقة").

Return pure JSON only. If a field is not found, return empty string "".`
    });

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

// For all other routes, serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

