import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const VALID_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Other',
] as const;

const VALID_METHODS = ['CASH', 'UPI', 'CARD'] as const;

interface ParsedPaymentLeg {
  method: (typeof VALID_METHODS)[number];
  amount: number;
  details?: string;
}

interface ParsedVoiceExpense {
  transcript: string;
  title: string;
  total_amount: number;
  category: (typeof VALID_CATEGORIES)[number];
  is_split: boolean;
  payments: ParsedPaymentLeg[];
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeMimeType(rawMimeType: string | undefined): string {
  if (!rawMimeType) return 'audio/webm';
  const base = rawMimeType.split(';')[0]?.trim().toLowerCase();
  if (!base || !base.startsWith('audio/')) {
    return 'audio/webm';
  }
  return base;
}

function normalizeExtraction(raw: Partial<ParsedVoiceExpense>): ParsedVoiceExpense {
  const transcript = typeof raw.transcript === 'string' ? raw.transcript.trim() : '';
  const title =
    typeof raw.title === 'string' && raw.title.trim().length > 0
      ? raw.title.trim()
      : 'Voice Expense';

  const category = VALID_CATEGORIES.includes(
    raw.category as (typeof VALID_CATEGORIES)[number]
  )
    ? (raw.category as (typeof VALID_CATEGORIES)[number])
    : 'Other';

  let totalAmount =
    typeof raw.total_amount === 'number' && Number.isFinite(raw.total_amount) && raw.total_amount > 0
      ? Math.round(raw.total_amount * 100) / 100
      : 0;

  let payments: ParsedPaymentLeg[] = Array.isArray(raw.payments)
    ? raw.payments
        .filter((p) => p && typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0)
        .map((p) => {
          const upper = String(p.method || 'CASH').toUpperCase();
          const method = VALID_METHODS.includes(upper as (typeof VALID_METHODS)[number])
            ? (upper as (typeof VALID_METHODS)[number])
            : 'CASH';
          const details =
            typeof p.details === 'string' && p.details.trim().length > 0
              ? p.details.trim()
              : undefined;
          return {
            method,
            amount: Math.round(p.amount * 100) / 100,
            ...(details ? { details } : {}),
          };
        })
    : [];

  if (payments.length === 0 && totalAmount > 0) {
    payments = [{ method: 'CASH', amount: totalAmount }];
  } else if (payments.length > 0 && totalAmount <= 0) {
    totalAmount =
      Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  }

  // If single payment leg differs slightly from totalAmount, sync it
  if (payments.length === 1 && totalAmount > 0) {
    payments[0].amount = totalAmount;
  }

  const isSplit = payments.length > 1 || Boolean(raw.is_split && payments.length > 1);

  return {
    transcript,
    title,
    total_amount: totalAmount,
    category,
    is_split: isSplit,
    payments,
  };
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.post('/api/expenses/parse-voice', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets, or continue with manual entry.',
      });
      return;
    }

    const { audioBase64, mimeType, currency } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      currency?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Missing recorded audio payload.' });
      return;
    }

    const cleanMimeType = normalizeMimeType(mimeType);
    const activeCurrency = currency || 'INR';

    const systemInstruction = `You are a precision financial expense parser for a personal expense tracker (default currency: ${activeCurrency}, primarily supporting Indian payment habits including Cash, UPI apps like GPay/PhonePe/Paytm/Cred, and Debit/Credit Cards).

Listen carefully to the user's voice recording and extract structured expense data:
1. "transcript": Exact verbatim transcription of what the user said.
2. "title": Concise merchant name or expense description in clean Title Case (e.g., "Auto Rickshaw", "Blue Tokai Coffee", "DMart Groceries").
3. "total_amount": Numeric total amount spent. If multiple split amounts are mentioned without an explicit total, sum them.
4. "category": Strictly one of: "Food & Dining", "Groceries", "Transport", "Utilities", "Shopping", "Entertainment", "Other".
5. "is_split": true if the user mentions paying across 2 or more payment methods or split legs; false otherwise.
6. "payments": Array of payment legs, each with:
   - "method": Strictly "CASH", "UPI", or "CARD".
   - "amount": Numeric amount for that payment leg. Ensure the sum of payment leg amounts equals total_amount.
   - "details": Optional string for specific app/bank/card details mentioned (e.g., "GPay", "PhonePe", "Paytm", "HDFC Credit", "ICICI Debit").
   - Default to "CASH" if the user says cash or does not specify a digital payment method (e.g. UPI, GPay, PhonePe, Paytm, card, credit, debit).
   - If the user mentions a UPI app (GPay, Google Pay, PhonePe, Paytm, BHIM, Cred, UPI), set method to "UPI" and put the app name in "details".
   - If the user mentions credit/debit card or a bank card, set method to "CARD" and put any bank/card detail in "details".`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this voice expense note and extract the structured expense JSON.',
            },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: {
                type: Type.STRING,
                description: 'Exact verbatim transcription of what the user said.',
              },
              title: {
                type: Type.STRING,
                description: 'Merchant name or brief expense description.',
              },
              total_amount: {
                type: Type.NUMBER,
                description: 'Total numeric expense amount.',
              },
              category: {
                type: Type.STRING,
                enum: [...VALID_CATEGORIES],
                description: 'Expense category.',
              },
              is_split: {
                type: Type.BOOLEAN,
                description: 'True if multiple payment methods were mentioned, false otherwise.',
              },
              payments: {
                type: Type.ARRAY,
                description: 'List of payment legs summing to total_amount.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    method: {
                      type: Type.STRING,
                      enum: [...VALID_METHODS],
                      description: 'Payment method: CASH, UPI, or CARD.',
                    },
                    amount: {
                      type: Type.NUMBER,
                      description: 'Amount paid via this method.',
                    },
                    details: {
                      type: Type.STRING,
                      description: 'Optional details such as GPay, PhonePe, Paytm, or bank/card name.',
                    },
                  },
                  required: ['method', 'amount'],
                },
              },
            },
            required: ['transcript', 'title', 'total_amount', 'category', 'is_split', 'payments'],
          },
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Gemini returned an empty response. Please try speaking clearly or enter manually.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as Partial<ParsedVoiceExpense>;
      const normalized = normalizeExtraction(parsed);
      res.json(normalized);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to process voice audio with Gemini API.';
      console.error('[Gemini Voice Parse Error]', err);
      res.status(500).json({ error: message });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SplitLedger server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
