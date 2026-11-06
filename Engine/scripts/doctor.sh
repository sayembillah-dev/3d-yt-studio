#!/bin/bash
# doctor.sh — check every dependency the studio needs. Prints OK/MISSING with the fix for each.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; E="$(cd "$HERE/.." && pwd)"
bad=0
ok()   { echo "OK       $1"; }
miss() { echo "MISSING  $1  → $2"; bad=1; }
command -v node >/dev/null && ok "node $(node -v)" || miss node "brew install node"
command -v python3 >/dev/null && ok "python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || miss python3 "brew install python"
for m in numpy cv2 PIL; do python3 -c "import $m" 2>/dev/null && ok "python module $m" || miss "python module $m" "pip3 install numpy opencv-python pillow"; done
command -v ffmpeg >/dev/null && ok "ffmpeg" || miss ffmpeg "brew install ffmpeg"
ffmpeg -hide_banner -filters 2>/dev/null | grep -q loudnorm && ok "ffmpeg loudnorm/ebur128" || miss "ffmpeg loudnorm" "brew reinstall ffmpeg"
command -v whisper-cli >/dev/null && ok "whisper-cli" || miss whisper-cli "brew install whisper-cpp"
[ -f "$E/models/ggml-small.en.bin" ] && ok "whisper model" || miss "Engine/models/ggml-small.en.bin" "download ggml-small.en.bin from huggingface.co/ggerganov/whisper.cpp"
[ -f "$E/studio/node_modules/@remotion/cli/remotion-cli.js" ] && ok "engine node_modules" || miss "engine node_modules" "cd Engine/studio && npm install --no-bin-links"
[ -d "$E/studio/node_modules/.remotion/chrome-headless-shell" ] && ok "headless chrome" || echo "INFO     headless chrome downloads on the first render (~1-3 min, once)"
exit $bad
