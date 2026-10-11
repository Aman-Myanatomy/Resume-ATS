import { readFileSync } from 'node:fs';
import { Type } from '@google/genai';
import { getClient, defaultModel, readSample } from './lib/client.js';

// Shows why judgment/scoring tasks use a LOW temperature: run the same
// resume 3 times at temperature 0 and 3 times at temperature 1, print the
// scores side by side, and watch the 1.0 column jump around more.
const resume = readFileSync(readSample('resume-clean.txt'), 'utf8');

const systemInstruction = `You are an ATS resume expert.
Score ONLY evidence present in the supplied resume. Never invent experience, skills, metrics, keywords, or sections.`;

const userPrompt = `Resume:\n${resume}`;

const schema = {
  type: Type.OBJECT,
  properties: { score: { type: Type.NUMBER } },
  required: ['score']
};

const { ai } = getClient();

async function scoreAt(temperature) {
  const response = await ai.models.generateContent({
    model: defaultModel(),
    contents: userPrompt,
    config: { systemInstruction, responseMimeType: 'application/json', responseSchema: schema, temperature }
  });
  return JSON.parse(response.text).score;
}

// Sequential on purpose (not Promise.all): firing all 6 calls at once tends to
// trip the API's concurrent-request limit (503 "high demand") on the free tier.
// One at a time is slower but reliable enough to run live in a session.
const lowScores = [];
for (let i = 0; i < 3; i++) lowScores.push(await scoreAt(0));

const highScores = [];
for (let i = 0; i < 3; i++) highScores.push(await scoreAt(1));

console.log('temperature 0.0, 3 runs:', lowScores);
console.log('temperature 1.0, 3 runs:', highScores);
