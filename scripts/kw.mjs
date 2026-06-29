// Kimi WebBridge client helper (avoids curl/wget shell interception).
// Usage: node scripts/kw.mjs '<json request body>'
//   body = {"action":"navigate","args":{...},"session":"uipath-creds"}
const body = process.argv[2];
if (!body) {
  console.error("usage: node scripts/kw.mjs '<json body>'");
  process.exit(2);
}
try {
  const res = await fetch("http://127.0.0.1:10086/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await res.text();
  console.log(text);
} catch (e) {
  console.error("KW_ERROR", e.message);
  process.exit(1);
}
