// Red Batch narration TTS via the configured provider (Xiaomi MiMo, OpenAI-style).
// Usage:
//   node scripts/tts.mjs --discover
//   node scripts/tts.mjs --in "text" --out file.wav
//   node scripts/tts.mjs --manifest pitch/video/vo-manifest.json   (batch)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function loadKeys() {
  const txt = fs.readFileSync(path.join(os.homedir(), "use_key.txt"), "utf8");
  const env = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const K = loadKeys();
const BASE = (K.TTS_BASE_URL || "").replace(/\/+$/, "");
const KEY = K.TTS_API_KEY;
const MODEL = K.TTS_MODEL || "mimo-v2.5-tts";
const VOICE = K.TTS_VOICE || "Chloe";
const INSTR = K.TTS_INSTRUCTION || "";
const SPEED = parseFloat(K.TTS_SPEED || "1.0");

// MiMo TTS is exposed through the OpenAI-style chat endpoint: the style direction
// goes in the user message, the spoken text in the assistant message, and the audio
// comes back base64-encoded in choices[0].message.audio.data.
async function callChatTTS(text, { retries = 3 } = {}) {
  const url = BASE + "/chat/completions";
  const body = {
    model: MODEL,
    messages: [
      { role: "user", content: INSTR || "Clear, confident product demo narration." },
      { role: "assistant", content: text },
    ],
    audio: { format: "wav", voice: VOICE },
  };
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`); }
      else {
        const json = JSON.parse(txt);
        const data = json?.choices?.[0]?.message?.audio?.data;
        if (data) return Buffer.from(data, "base64");
        lastErr = new Error("no audio.data in response: " + txt.slice(0, 200));
      }
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastErr;
}

async function discover() {
  const buf = await callChatTTS("Red Batch turns one safety signal into an approved stop ship.");
  fs.writeFileSync("/tmp/tts_ok.wav", buf);
  const head = buf.slice(0, 4).toString("latin1");
  console.log(`WORKING /chat/completions -> ${buf.length} bytes, magic=${head} saved /tmp/tts_ok.wav`);
}

async function synth(text, out) {
  const buf = await callChatTTS(text);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  return { out, bytes: buf.length, path: "/chat/completions" };
}

const args = process.argv.slice(2);
function arg(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }

if (args.includes("--discover")) {
  await discover();
} else if (arg("--manifest")) {
  const man = JSON.parse(fs.readFileSync(arg("--manifest"), "utf8"));
  const outDir = arg("--outdir") || path.dirname(arg("--manifest"));
  const results = [];
  for (const seg of man.segments) {
    const out = path.join(outDir, seg.file);
    const r = await synth(seg.text, out);
    console.log(`${seg.id} -> ${seg.file} (${r.bytes} bytes via ${r.path})`);
    results.push({ id: seg.id, ...r });
  }
  console.log("DONE", results.length, "segments");
} else if (arg("--in")) {
  const r = await synth(arg("--in"), arg("--out") || "/tmp/out.wav");
  console.log("wrote", r.out, r.bytes, "bytes via", r.path);
} else {
  console.log("usage: --discover | --in <text> --out <file> | --manifest <json> [--outdir <dir>]");
}
