import { getClient, defaultModel } from './lib/client.js';

// Contrast with 08-fallback-chain-demo.js: there, the FIRST model name was
// fake, which is a "model not available" (404) failure -> retryable -> the
// loop falls through to the next model.
//
// Here, both model names are valid, but the REQUEST itself is broken
// (temperature: 5 is outside Gemini's 0-2 range), so every model will hit
// the exact same error. Retrying the next model wastes a call and still
// fails - the orchestration logic should recognize "this isn't a model
// availability problem" and throw immediately instead of working through
// the whole candidate list.
const { ai } = getClient();
const candidateModels = [defaultModel(), 'gemini-2.5-pro'];

let lastError;
for (const modelName of candidateModels) {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Say hello in exactly one word.',
      config: { temperature: 5 } // invalid on purpose - triggers a real 400, not 429/404
    });
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
