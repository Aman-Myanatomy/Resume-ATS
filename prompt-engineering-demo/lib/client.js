import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

// Two backends, same Gemini models: the Gemini Developer API (a plain
// GEMINI_API_KEY, free tier = 20 requests/day/model) or Vertex AI Express
// Mode (a VERTEX_API_KEY, much higher quota, no GCP project/ADC setup
// needed). LLM_BACKEND lets you force one; otherwise Vertex is preferred
// whenever a VERTEX_API_KEY is present, since it's less likely to run out
// mid-session.
export function getClient() {
  const backend = process.env.LLM_BACKEND || (process.env.VERTEX_API_KEY ? 'vertex' : 'gemini');

  if (backend === 'vertex') {
    if (!process.env.VERTEX_API_KEY) {
      throw new Error('VERTEX_API_KEY is missing. Add it to .env, or set LLM_BACKEND=gemini to use GEMINI_API_KEY instead.');
    }
    return { ai: new GoogleGenAI({ vertexai: true, apiKey: process.env.VERTEX_API_KEY }), backend };
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and add your key.');
  }
  return { ai: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), backend };
}

export function defaultModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export function readSample(filename) {
  return new URL(`../sample-data/${filename}`, import.meta.url);
}
