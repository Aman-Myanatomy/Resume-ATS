import { getClient, defaultModel } from './lib/client.js';

// Same pattern as backEnd/services/analysis.js: try a list of candidate
// models in order, race each call against a timeout, and fall through to
// the next model ONLY on quota/availability errors (429/quota/404) - any
// other error throws immediately (see 08b-orchestration-fatal-error.js for
// that contrasting path). The first model name here is intentionally fake
// so the 404-style "model not available" fallback visibly kicks in.
const { ai } = getClient();
const candidateModels = ['gemini-not-a-real-model', defaultModel()];

let lastError;
for (const modelName of candidateModels) {
  try {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`timed out on ${modelName}`)), 15_000);
    });
    const response = await Promise.race([
      ai.models.generateContent({ model: modelName, contents: 'Say hello in exactly one word.' }),
      timeout
    ]);
    console.log(`SUCCESS with "${modelName}":`, response.text.trim());
    lastError = null;
    break;
  } catch (err) {
    lastError = err;
    if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('404')) {
      console.warn(`RETRYABLE failure on "${modelName}": ${err.message} -> trying next model...`);
      continue;
    }
    console.error(`FATAL (non-retryable) failure on "${modelName}": ${err.message} -> stopping immediately, no fallback.`);
    throw err;
  }
}
if (lastError) throw lastError;
