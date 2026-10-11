import { readFileSync } from 'node:fs';
import { Type } from '@google/genai';
import { getClient, defaultModel, readSample } from './lib/client.js';

// AFTER (step 4): tell the model to reason through the rubric internally
// (chain-of-thought), but the schema has no field for that reasoning, so it
// physically cannot leak into the output - only the final judgment comes back.
const resume = readFileSync(readSample('resume-clean.txt'), 'utf8');

const systemInstruction = `You are an ATS resume expert.
Score ONLY evidence present in the supplied resume. Never invent experience, skills, metrics, keywords, or sections.

Weigh the 0-100 score using this rubric:
- Contact & header completeness (10%)
- Experience evidence (35%)
- Skills & keyword evidence (30%)
- ATS formatting (15%)
- Job description alignment (10%) - if no job description is supplied, score this neutrally.

Reasoning process: internally work through each rubric category one at a time before
settling on a final score. Your response must contain ONLY the final structured result -
never include your step-by-step reasoning or scratch notes in the output.`;

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
