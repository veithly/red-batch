#!/usr/bin/env bash
# Headless screenshot helper for Red Batch QA evidence.
# Drives Microsoft Edge (Chromium) in classic headless with a hard kill-guard
# so a single hung capture can never stall the whole run.
set -u

EDGE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
B="${BASE_URL:-http://localhost:4387}"

shot() {
  local url="$1" size="$2" out="$3"
  rm -f "$out"
  "$EDGE" --headless --disable-gpu --no-sandbox --disable-extensions \
    --disable-background-networking --disable-sync --hide-scrollbars \
    --virtual-time-budget=4500 --window-size="$size" \
    --screenshot="$out" "$url" >/dev/null 2>&1 &
  local p=$!
  ( sleep 25; kill -9 "$p" 2>/dev/null ) & local w=$!
  wait "$p" 2>/dev/null
  kill "$w" 2>/dev/null
  if [ -s "$out" ]; then echo "ok   $out ($size)"; else echo "FAIL $out"; fi
}

post() { curl -s -X POST "$B$1" -H 'Content-Type: application/json' ${2:+-d "$2"} >/dev/null; }

mkdir -p pitch/qa/desktop pitch/qa/mobile

# --- Reset to a clean baseline: RB-2049 ready, RB-7712 ready ---
post /api/demo/reset
shot "$B/"                 "1440,1000" pitch/qa/desktop/01-entry.png
shot "$B/cases"            "1440,1100" pitch/qa/desktop/02-queue.png
shot "$B/cases/RB-2049"    "1440,1550" pitch/qa/desktop/03-ready-first-screen.png

# --- Agent run -> Awaiting QA Approval (review stage with scope diff) ---
post /api/cases/RB-2049/run
shot "$B/cases/RB-2049"    "1440,1750" pitch/qa/desktop/04-review-approval.png

# --- QA approves -> packet saved, 37 orders quarantined (success stage) ---
post /api/cases/RB-2049/approve '{"decision":"approve_full","role":"QA Manager","name":"Priya Shah"}'
shot "$B/cases/RB-2049"    "1440,1750" pitch/qa/desktop/05-success-diff-packet.png
shot "$B/packets/RB-PKT-2049" "1440,1850" pitch/qa/desktop/06-stop-ship-packet.png

# --- Ambiguity branch: RB-7712 -> Human Review Required ---
post /api/cases/RB-7712/run
shot "$B/cases/RB-7712"    "1440,1600" pitch/qa/desktop/07-human-review-required.png

# --- Reopen / search the frozen order ---
shot "$B/reopen?order=O-1042" "1440,1000" pitch/qa/desktop/08-reopen-search.png

# --- Mobile layouts (success + entry + human review) ---
shot "$B/cases/RB-2049"    "414,1900"  pitch/qa/mobile/01-success.png
shot "$B/"                 "414,1100"  pitch/qa/mobile/02-entry.png
shot "$B/cases/RB-7712"    "414,1700"  pitch/qa/mobile/03-human-review.png

echo "=== desktop ==="; ls -1 pitch/qa/desktop/
echo "=== mobile ==="; ls -1 pitch/qa/mobile/
