import { getClient, defaultModel } from './lib/client.js';

// Quick sanity check before the session: confirms the configured backend
// (Gemini API key or Vertex AI Express key) actually works.
const { ai, backend } = getClient();
const response = await ai.models.generateContent({
  model: defaultModel(),
  contents: 'Reply with exactly one word: OK'
});
console.log(`Backend: ${backend}, model: ${defaultModel()}`);
console.log('Response:', response.text.trim());
console.log('Setup looks good.');
