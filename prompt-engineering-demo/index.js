// This project is a collection of standalone CLI demo scripts, not a web
// server - there's nothing to "start". This file exists only so that a
// container/platform which auto-runs `npm start` doesn't crash-loop; it
// prints usage instructions and then idles, keeping the process alive so
// you can exec into the container and run the demos with `npm run <name>`.
console.log(`
prompt-engineering-demo is a set of standalone scripts, not a server.
Run any of these from a shell in this container:

  npm run check   - verify GEMINI_API_KEY / VERTEX_API_KEY works
  npm run 01      - naive prompt (before)
  npm run 02      - system vs user prompt split
  npm run 03      - structured output (responseSchema)
  npm run 04      - rubric-based scoring
  npm run 05      - hidden chain-of-thought
  npm run 06      - prompt injection attack (vulnerable)
  npm run 06b     - prompt injection defended
  npm run 07      - temperature consistency demo
  npm run 08      - orchestration: retryable fallback
  npm run 08b     - orchestration: fatal fail-fast

Idling now so the container stays up.
`);

setInterval(() => {}, 1 << 30);
