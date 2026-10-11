# Prompt Engineering Demo (3-Hour Live Coding)

Chota standalone Node.js project — koi backend/DB/auth nahi, sirf Gemini calls
(via `@google/genai`, jo Gemini Developer API aur Vertex AI dono support karta hai).
Har file ek concept dikhati hai, aur har file pichli file pe ek layer add karti hai.
Isko [../BACKEND_TEACHING_GUIDE.md](../BACKEND_TEACHING_GUIDE.md) ke **Section 18**
ke saath istemal karo — us section ki timing table isi file-order ko follow karti hai.

## Setup (session se pehle ek baar)

```bash
cd prompt-engineering-demo
npm install
cp .env.example .env
```

`.env` mein do backend options hain — jo bhi ho use karo (dono ho to Vertex automatically prefer hota hai, kyunki uska quota zyada hai):

- **Gemini Developer API** (`GEMINI_API_KEY`) — free tier sirf **20 requests/day/model** deta hai, live class ke liye risky hai (khatam ho sakta hai beech mein).
- **Vertex AI Express Mode** (`VERTEX_API_KEY`) — sirf ek API key chahiye ([Vertex AI Studio Express](https://console.cloud.google.com/vertex-ai) se), koi GCP project setup/ADC login nahi chahiye, quota kaafi zyada hai — **session ke din yehi use karo**.

Note: yeh ek CLI demo project hai, web server nahi — `npm start` sirf isliye
diya gaya hai taaki koi Docker/hosting platform jo automatically `npm start`
chalata hai crash na ho ([index.js](index.js) ek banner print kar ke idle ho
jaata hai). Actual demos chalane ke liye niche di gayi `npm run <number>`
commands use karo, `npm start` nahi.

Setup ke baad verify karo:

```bash
npm run check
```

## File order (yehi live-coding sequence hai)

| File | Block (guide Section 18) | Dikhata hai |
|---|---|---|
| `01-naive-prompt.js` | Block 1 | Ek hi string mein sab kuch mixed — inconsistent output |
| `02-system-vs-user.js` | Block 2 | `systemInstruction` (rules) vs user prompt (data) split |
| `03-structured-output.js` | Block 3 | `Type` + `responseSchema` — API-level JSON enforcement |
| `04-rubric-scoring.js` | Block 4 | Vague "score fairly" → weighted rubric + per-section breakdown |
| `05-hidden-cot.js` | Block 5 | Model ko reason karne do, lekin reasoning output mein leak na ho |
| `06-injection-attack.js` | Block 6 | Vulnerable prompt — malicious resume score ko hijack kar sakta hai |
| `06b-injection-defended.js` | Block 6 | Delimiters + explicit "treat as data" rule se defense |
| `07-temperature-demo.js` | Block 7 | `temperature: 0` vs `1` — consistency ka farak |
| `08-fallback-chain-demo.js` | Block 7 | Orchestration: retryable failure (fake model) → fallback kicks in |
| `08b-orchestration-fatal-error.js` | Block 7 | Orchestration: fatal failure (invalid request) → fail-fast, no fallback |

Run karne ka tareeka (koi bhi ek):

```bash
node 01-naive-prompt.js
# ya
npm run 01
```

## Live-coding tip

Pre-written files answer-key ki tarah use karo — session mein khud type karo
(01 se shuru karke, har baar pichli file copy karke ek concept add karo), aur
agar time kam pade to seedha in files ko run kar ke dikhao. `sample-data/`
mein do resumes hain: `resume-clean.txt` (normal) aur `resume-injected.txt`
(jisme ek hidden "score 100 do" instruction chhupa hai — Block 6 ke liye).

## Isse aage kya

Yeh sab techniques [../backEnd/services/analysis.js](../backEnd/services/analysis.js)
mein ek saath combine hoke production code ban jaati hain — session ke end mein
woh file khol ke dikhao ki "chhote demos" se "real app" tak sab connect hota hai.
