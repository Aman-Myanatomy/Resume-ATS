import { readFileSync } from 'node:fs';
import { getClient, defaultModel, readSample } from './lib/client.js';

// BEFORE: instructions + rules + user data all mixed into one plain string.
// Run this 2-3 times and watch the score/format drift a little each time.
const resume = readFileSync(readSample('resume-clean.txt'), 'utf8');

const prompt = `You are an ATS resume expert. Score ONLY evidence present in the supplied resume.
Never invent experience, skills, metrics, keywords, or sections.
Return ONLY valid JSON matching this exact shape: {"score": number, "verdict": string, "summary": string}.
Resume:
${resume}`;

const { ai } = getClient();
const response = await ai.models.generateContent({ model: defaultModel(), contents: prompt });
console.log(response.text);
