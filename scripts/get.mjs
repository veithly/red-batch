// Simple HTTP GET/POST helper (script file avoids inline-HTTP shell interception).
// Usage: node scripts/get.mjs <url> [method] [jsonBody]
const [, , url, method = "GET", jsonBody] = process.argv;
const opts = { method };
if (jsonBody) {
  opts.headers = { "Content-Type": "application/json" };
  opts.body = jsonBody;
}
try {
  const res = await fetch(url, opts);
  const txt = await res.text();
  console.log("HTTP", res.status);
  console.log(txt);
} catch (e) {
  console.log("ERR", e.message);
  process.exit(1);
}
