#!/bin/bash
# render.sh — ONE command for every render. Bundles the engine against a project, then renders.
#   render.sh <project_dir> stills <Comp> <f1,f2,...>     → <project>/work/still_<f>.png + sheet_stills.jpg
#   render.sh <project_dir> video  <Comp> [out.mp4]       → <project>/work/<Comp>.mp4 (silent picture track)
#   render.sh <project_dir> range  <Comp> <from-to> [out] → partial render for fast QA of one section
# Env: STUDIO (default <Engine>/studio), SW_CONCURRENCY (default 4),
#      SW_PROPS (JSON input props, e.g. '{"noCaptions":true}' for clean thumbnail stills), SW_SCALE (e.g. 0.25 preview). Paths may contain spaces.
set -euo pipefail
PROJ="$(cd "$1" && pwd)"; MODE="$2"; COMP="$3"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO="${STUDIO:-$HERE/../studio}"
REMOTION=(node "$STUDIO/node_modules/@remotion/cli/remotion-cli.js")   # exFAT: no node_modules/.bin links, never use npx
PROPS=(); [ -n "${SW_PROPS:-}" ] && PROPS=(--props="$SW_PROPS")
# SW_SCALE=0.25 → quarter-res preview render (motion/beat metrics are measured at 90x160 anyway: ~10x faster iteration)
[ -n "${SW_SCALE:-}" ] && PROPS+=(--scale="$SW_SCALE")
export SW_PROJECT="$PROJ"
# Bundle + webpack cache live on the INTERNAL disk (SW_BUILD / SW_CACHE): the bundle is a burst of ~70 small writes,
# which twice unmounted the exFAT SSD (2026-11-06). Project files and renders stay on the SSD.
CACHE_ROOT="$HOME/Library/Caches/stickworld"
BUILD="${SW_BUILD:-$CACHE_ROOT/build}"
export SW_CACHE="${SW_CACHE:-$CACHE_ROOT/webpack}"
mkdir -p "$(dirname "$BUILD")" "$SW_CACHE"; rm -rf "$BUILD"
cd "$STUDIO"
mkdir -p "$PROJ/work"
# cost ledger: one line per render (incl. bundle time) → work/render_log.jsonl, read by ledger.py
T0=$(date +%s); AT=$(date -u +%Y-%m-%dT%H:%M:%SZ); RARG="${4:-}"
log_render() { local rc=$?; printf '{"at":"%s","mode":"%s","comp":"%s","arg":"%s","seconds":%s,"ok":%s}\n' "$AT" "$MODE" "$COMP" "$RARG" "$(( $(date +%s) - T0 ))" "$([ $rc -eq 0 ] && echo true || echo false)" >> "$PROJ/work/render_log.jsonl" 2>/dev/null || true; }
trap log_render EXIT
BLOG="$CACHE_ROOT/bundle.log"
"${REMOTION[@]}" bundle src/index.ts --out-dir="$BUILD" --log=error >"$BLOG" 2>&1 || { echo "BUNDLE FAILED:"; grep -v '^\s*at ' "$BLOG" | grep -iv 'zod\|version mismatch\|remotion.dev\|^-*$' | head -30; exit 1; }
case "$MODE" in
  stills)
    # one browser + one local server for the whole batch (was: a new Remotion/Chrome process per frame — see
    # Improvements/faster-and-cheaper.md #3). SW_PROPS/SW_SCALE are read directly from the inherited environment.
    node "$HERE/stills.mjs" "$STUDIO" "$BUILD" "$PROJ" "$COMP" "$4" || echo "stills FAILED"
    python3 - "$PROJ/work" "$4" <<'PY'
import sys
from PIL import Image, ImageDraw
d, fr = sys.argv[1], sys.argv[2].split(',')
ims = []
for f in fr:
    try:
        im = Image.open(f'{d}/still_{f}.png').convert('RGB').resize((540, 960)); ImageDraw.Draw(im).text((8, 8), f'f{f}', fill=(255, 230, 0)); ims.append(im)
    except Exception as e: print('missing', f, e)
if ims:
    cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
    s = Image.new('RGB', (540 * cols, 960 * rows), (20, 20, 20))
    for i, im in enumerate(ims): s.paste(im, ((i % cols) * 540, (i // cols) * 960))
    s.save(f'{d}/sheet_stills.jpg', quality=88); print(f'{d}/sheet_stills.jpg')
PY
    ;;
  video)
    OUT="${4:-$PROJ/work/$COMP.mp4}"
    "${REMOTION[@]}" render "$BUILD" "$COMP" "$OUT" --gl=angle ${PROPS[@]+"${PROPS[@]}"} --concurrency="${SW_CONCURRENCY:-4}" --log=error --muted >/dev/null 2>&1 && echo "$OUT" || { echo "RENDER FAILED"; exit 1; }
    ;;
  range)
    OUT="${5:-$PROJ/work/${COMP}_$4.mp4}"
    "${REMOTION[@]}" render "$BUILD" "$COMP" "$OUT" --frames="$4" --gl=angle ${PROPS[@]+"${PROPS[@]}"} --concurrency="${SW_CONCURRENCY:-4}" --log=error --muted >/dev/null 2>&1 && echo "$OUT" || { echo "RENDER FAILED"; exit 1; }
    ;;
  *) echo "mode must be stills|video|range"; exit 2;;
esac
