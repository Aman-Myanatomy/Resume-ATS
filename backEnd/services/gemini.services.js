import { GoogleGenerativeAI } from '@google/generative-ai';
import { httpError } from '../utils/http.utils.js';

/**
 * Shared Gemini call with retries and model fallback.
 *
 * "High demand" 503s usually clear within seconds, so the primary model is tried three times
 * (1.5s, 3s backoff) before falling back to GEMINI_FALLBACK_MODELS in order. Only overload,
 * quota and not-found errors move on to the next attempt; anything else is thrown at once.
 */
const RETRYABLE = ['429', '503', 'quota', '404', 'high demand', 'overloaded', 'UNAVAILABLE'];

function modelAttempts() {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-3.6-flash')
    .split(',').map(m => m.trim()).filter(Boolean);
  return [primary, primary, primary, ...new Set(fallbacks.filter(m => m !== primary))];
}

/**
 * Calls Gemini in JSON mode and returns the parsed object, after `validate(result)` (which
 * may normalise it and should throw on bad output).
 */
export async function generateJson({ systemInstruction, prompt, responseSchema, temperature = 0.2, timeoutMs = 45_000, label = 'Gemini request', validate = r => r }) {
  if (!process.env.GEMINI_API_KEY) throw httpError(503, 'GEMINI_API_KEY is not configured.');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const attempts = modelAttempts();
  const primary = attempts[0];
  let lastError;

  for (const [index, modelName] of attempts.entries()) {
    if (index > 0 && modelName === primary) await new Promise(resolve => setTimeout(resolve, 1500 * index));
    let timer;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature }
      });
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(httpError(504, `${label} timed out (${modelName}).`)), timeoutMs);
      });
      const response = await Promise.race([model.generateContent(prompt), timeout]);
      const cleaned = response.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
      return validate(JSON.parse(cleaned));
    } catch (err) {
      lastError = err;
      if (RETRYABLE.some(code => err.message?.includes(code))) {
        console.warn(`Model ${modelName} attempt ${index + 1} failed (${err.message.replace(/^.*?\] /, '').slice(0, 120)}), retrying...`);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || httpError(502, `${label} failed.`);
}
