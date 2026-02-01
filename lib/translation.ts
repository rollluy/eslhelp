
import { TranslationServiceClient } from '@google-cloud/translate';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { getLanguageCode } from './languages';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const translationClient = new TranslationServiceClient();

// Gemini uses an API key, not a service-account credential.
// Generate one at: https://aistudio.google.com/app/apikey
// (Free tier: 15 req/min, 1M tokens/min — more than enough for this use case)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
const GCP_LOCATION = 'global';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ActionItem {
  step: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  professionalType?: string; // hint for the "find a professional" feature
}

export interface ProcessingResult {
  success: true;
  translatedSummary: string;
  actionPlan: ActionItem[];
  targetLanguage: string;
  summaryLength: number;
  originalLength: number;
  timestamp: string;
}

export interface ProcessingError {
  success: false;
  error: string;
  timestamp: string;
}

type ProcessingOutput = ProcessingResult | ProcessingError;

// ---------------------------------------------------------------------------
// 1. PDF text extraction
// ---------------------------------------------------------------------------
export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const dataBuffer = readFileSync(pdfPath);
  
  // Dynamically import pdf-parse to avoid Turbopack ESM issues
  const pdfParse = await import('pdf-parse');
  const pdf = pdfParse.default || pdfParse;
  
  const data = await pdf(dataBuffer);

  if (!data.text || data.text.trim().length === 0) {
    throw new Error('No text could be extracted from this PDF. It may be scanned image-only.');
  }

  return data.text;
}

// ---------------------------------------------------------------------------
// 2. Google Cloud Translation (with chunking for large texts)
// ---------------------------------------------------------------------------
const MAX_TRANSLATE_CHUNK = 25_000; // Google's per-request character limit

/**
 * Splits text on sentence boundaries so chunks stay under the limit.
 */
function chunkText(text: string, maxSize: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxSize) {
      if (current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        // single sentence longer than maxSize — hard-split it
        chunks.push(sentence.substring(0, maxSize));
        current = sentence.substring(maxSize);
      }
    } else {
      current += sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function translateText(
  text: string,
  targetLangCode: string,
  sourceLangCode = 'en'
): Promise<string> {
  const translate = async (content: string) => {
    const [response] = await translationClient.translateText({
      parent: `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}`,
      contents: [content],
      mimeType: 'text/plain',
      sourceLanguageCode: sourceLangCode,
      targetLanguageCode: targetLangCode,
    });
    const translatedText = response.translations![0].translatedText;
    if (!translatedText) {
      throw new Error('Translation API returned empty result');
    }
    return translatedText;
  };

  if (text.length <= MAX_TRANSLATE_CHUNK) {
    return translate(text);
  }

  // Large text — chunk and translate in parallel
  const chunks = chunkText(text, MAX_TRANSLATE_CHUNK);
  const translated = await Promise.all(chunks.map(chunk => translate(chunk)));
  return translated.join(' ');
}

// ---------------------------------------------------------------------------
// 3. LLM-powered summarisation & action plan (via Gemini)
// ---------------------------------------------------------------------------

interface LLMOutput {
  summary: string;
  actionPlan: ActionItem[];
}

/**
 * Single Gemini call that returns both a contextual summary AND an action plan
 * with professional-type hints — all in one round-trip.
 *
 * We set responseMimeType to 'application/json' so Gemini is constrained to
 * output valid JSON directly — no markdown fences or stray text to strip.
 */
async function generateSummaryAndActions(fullText: string): Promise<LLMOutput> {
  const prompt = `You are helping immigrants and English-as-a-second-language users understand important legal and medical documents.

Analyze the following document text and respond with a valid JSON object in this exact shape:

{
  "summary": "<a clear, plain-English summary of the document highlighting the most important facts, dates, deadlines, amounts, and obligations — written so someone unfamiliar with legal/medical jargon can understand it>",
  "actionPlan": [
    {
      "step": "<short title for this action>",
      "description": "<specific, actionable description referencing concrete details from the document>",
      "priority": "<high | medium | low>",
      "professionalType": "<the type of professional who could help with this step, or null if none needed>"
    }
  ]
}

Rules:
- The summary must be 150–400 words.
- The action plan must have 3–5 items, ordered by priority (high first).
- Reference specific details from the document (dates, dollar amounts, names, deadlines).
- Use simple, clear language. Avoid jargon.
- professionalType should be one of: immigration_lawyer, tax_advisor, medical_interpreter, housing_advisor, family_law_attorney, benefits_counselor, or null.

Document text:
---
${fullText}
---`;

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const raw = result.response.text();
  if (!raw) {
    throw new Error('Gemini returned an empty response');
  }

  const parsed = JSON.parse(raw) as LLMOutput;

  if (!parsed.summary || !Array.isArray(parsed.actionPlan)) {
    throw new Error('Gemini returned an unexpected shape');
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// 4. Translate action plan items in parallel
// ---------------------------------------------------------------------------
async function translateActionPlan(
  actionPlan: ActionItem[],
  targetLangCode: string
): Promise<ActionItem[]> {
  return Promise.all(
    actionPlan.map(async (item) => {
      const [translatedStep, translatedDesc] = await Promise.all([
        translateText(item.step, targetLangCode),
        translateText(item.description, targetLangCode),
      ]);
      return { ...item, step: translatedStep, description: translatedDesc };
    })
  );
}

// ---------------------------------------------------------------------------
// 5. Main orchestrator
// ---------------------------------------------------------------------------
export async function processPDFDocument(
  pdfPath: string,
  targetLanguage: string
): Promise<ProcessingOutput> {
  try {
    const langCode = getLanguageCode(targetLanguage);
    if (!langCode) {
      throw new Error(`Unsupported language: ${targetLanguage}`);
    }

    // Step 1 — extract
    console.log('[translation] Step 1: Extracting text from PDF…');
    const fullText = await extractTextFromPDF(pdfPath);

    // Step 2 — LLM generates summary + action plan simultaneously
    console.log('[translation] Step 2: Generating summary and action plan…');
    const { summary, actionPlan } = await generateSummaryAndActions(fullText);

    // Step 3 — translate summary and action plan in parallel
    console.log('[translation] Step 3: Translating to', targetLanguage, '…');
    const [translatedSummary, translatedActions] = await Promise.all([
      translateText(summary, langCode),
      translateActionPlan(actionPlan, langCode),
    ]);

    return {
      success: true,
      translatedSummary,
      actionPlan: translatedActions,
      targetLanguage,
      summaryLength: translatedSummary.length,
      originalLength: fullText.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[translation] Error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during processing',
      timestamp: new Date().toISOString(),
    };
  }
}