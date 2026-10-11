import { readFileSync } from 'node:fs';
import { Type } from '@google/genai';
import { getClient, defaultModel, readSample } from './lib/client.js';

// AFTER (step 3): replace "score fairly" with an explicit weighted rubric,
// and ask for a per-category breakdown ("sections") instead of one opaque number.
const resume = readFileSync(readSample('resume-clean.txt'), 'utf8');

const systemInstruction = `You are an ATS resume expert.
Score ONLY evidence present in the supplied resume. Never invent experience, skills, metrics, keywords, or sections.

Weigh the 0-100 score using this rubric:
- Contact & header completeness (10%)
- Experience evidence - quantified, specific, relevant (35%)
- Skills & keyword evidence - demonstrated, not just listed (30%)
- ATS formatting - parseable structure (15%)
- Job description alignment (10%) - if no job description is supplied, score this neutrally.`;

const userPrompt = `Resume:\n${resume}\n\nJob description:\n(none supplied)`;

const schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    verdict: { type: Type.STRING },
    summary: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          note: { type: Type.STRING }
        },
        required: ['name', 'score', 'note']
      }
    }
  },
  required: ['score', 'verdict', 'summary', 'sections']
};

const { ai } = getClient();
const response = await ai.models.generateContent({
  model: defaultModel(),
  contents: userPrompt,
  config: { systemInstruction, responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 }
});
console.log(JSON.stringify(JSON.parse(response.text), null, 2));
