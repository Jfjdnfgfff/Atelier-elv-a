import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

function geminiOcrApiPlugin(): Plugin {
  return {
    name: 'gemini-ocr-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = req.url ? req.url.split('?')[0] : '';

        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (parsedUrl === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY }));
          return;
        }

        if (parsedUrl === '/api/ocr-id' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', chunk => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const { imageBase64, mimeType = 'image/jpeg' } = JSON.parse(bodyStr || '{}');

              if (!imageBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'صورة البطاقة مطلوبة', success: false }));
                return;
              }

              const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
              if (!apiKey) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  error: 'مفتاح Gemini API غير مهيأ في بيئة العمل', 
                  success: false,
                  fallback: true
                }));
                return;
              }

              let cleanBase64 = imageBase64 || '';
              if (cleanBase64.includes(';base64,')) {
                cleanBase64 = cleanBase64.split(';base64,')[1];
              }

              const ai = new GoogleGenAI({
                apiKey: apiKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  }
                }
              });

              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: cleanBase64,
                      },
                    },
                    {
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
                    },
                  ],
                },
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

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                data: parsedData,
              }));
            } catch (err: any) {
              console.error('Vite dev OCR Error:', err);
              res.statusCode = 200; // Return 200 with error property so client fetch does not throw TypeError
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: err?.message || 'تعذر استخراج البيانات من بطاقة الهوية حالياً',
                success: false,
              }));
            }
          });

          req.on('error', (err) => {
            console.error('Vite request error:', err);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'خطأ في استقبال البيانات', success: false }));
          });

          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiOcrApiPlugin(), viteSingleFile()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
