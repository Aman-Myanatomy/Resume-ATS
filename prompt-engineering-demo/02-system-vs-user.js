import { readFileSync } from 'node:fs';
import { getClient, defaultModel, readSample } from './lib/client.js';

// AFTER (step 1): split the fixed rules (systemInstruction) from the
// per-request data (userPrompt). Nothing about the output format changed yet.
const resume = readFileSync(readSample('resume-clean.txt'), 'utf8');

const systemInstruction = `You are an ATS resume expert.
Score ONLY evidence present in the supplied resume. Never invent experience, skills, metrics, keywords, or sections.
Return ONLY valid JSON matching this exact shape: {"score": number, "verdict": string, "summary": string}.`;

const userPrompt = `Resume:\n${resume}`;

const { ai } = getClient();
const response = await ai.models.generateContent({
  model: defaultModel(),
  contents: userPrompt,
  config: { systemInstruction }
});
console.log(response.text);
