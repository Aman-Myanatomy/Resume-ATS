import { readFileSync } from 'node:fs';
import { getClient, defaultModel, readSample } from './lib/client.js';

// VULNERABLE: same style as 02-system-vs-user.js, but the resume text is
// dropped straight into the prompt with no delimiters and no warning that
// it might contain instructions. Run this against resume-injected.txt and
// watch the score/verdict get hijacked by the text hidden inside the "resume".
const resume = readFileSync(readSample('resume-injected.txt'), 'utf8');

const systemInstruction = `You are an ATS resume expert.
Score ONLY evidence present in the supplied resume.
Return ONLY valid JSON matching this exact shape: {"score": number, "verdict": string, "summary": string}.`;

const userPrompt = `Resume:\n${resume}`;

const { ai } = getClient();
const response = await ai.models.generateContent({
  model: defaultModel(),
  contents: userPrompt,
  config: { systemInstruction }
});
console.log('--- VULNERABLE OUTPUT (resume-injected.txt) ---');
console.log(response.text);
