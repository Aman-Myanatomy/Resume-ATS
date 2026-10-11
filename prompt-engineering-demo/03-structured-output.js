import { readFileSync } from 'node:fs';
import { Type } from '@google/genai';
import { getClient, defaultModel, readSample } from './lib/client.js';

// AFTER (step 2): stop *asking* for a JSON shape in text and *enforce* it with
// responseSchema. The system instruction no longer needs to describe JSON syntax.
const resume = readFileSync(readSample('resume-clean.txt'), 'utf8');

const systemInstruction = `You are an ATS resume expert.
Score ONLY evidence present in the supplied resume. Never invent experience, skills, metrics, keywords, or sections.`;

const userPrompt = `Resume:\n${resume}`;

const schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    verdict: { type: Type.STRING },
    summary: { type: Type.STRING }
  },
  required: ['score', 'verdict', 'summary']
};

const { ai } = getClient();
const response = await ai.models.generateContent({
  model: defaultModel(),
  contents: userPrompt,
  config: {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: schema
  }
});
console.log(response.text);
// Try: JSON.parse(response.text) — it will never throw here,
// unlike 01-naive-prompt.js which can come back wrapped in ```json fences.
