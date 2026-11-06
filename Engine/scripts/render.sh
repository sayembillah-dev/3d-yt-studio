#!/bin/bash
# render.sh — ONE command for every render. Bundles the engine against a project, then renders.
#   render.sh <project_dir> stills <Comp> <f1,f2,...>     → <project>/work/still_<f>.png + sheet_stills.jpg
#   render.sh <project_dir> video  <Comp> [out.mp4]       → <project>/work/<Comp>.mp4 (silent picture track)
#   render.sh <project_dir> range  <Comp> <from-to> [out] → partial render for fast QA of one section
#   render.sh <project_dir> preview <Comp>               → work/<Comp>.mp4 at quarter size (270x480), full look: every QA
#     number reads the same as full size (measured on #01: all 42 beats on the same frames), ~7x faster
#   render.sh <project_dir> pace   <Comp>                → work/<Comp>_pace.mp4, quarter size + measure look (no AO / god
#     rays / MSAA, small shadow map): motion + pacing numbers only (qa_all.sh pace), ~15x faster. Never review its look.
#   render.sh <project_dir> splice <Comp> <a-b>[,c-d...] [base.mp4] → re-render only those frames into the last render
#     (base default work/<Comp>.mp4, kept as work/<Comp>.prev.mp4; size follows the base; use the base's SW_PROPS)
# Env: STUDIO (default <Engine>/studio), SW_CONCURRENCY (default 3: fastest measured, 2026-11-06),
#      SW_PROPS (JSON input props, e.g. '{"noCaptions":true}' for clean thumbnail stills), SW_SCALE (e.g. 0.25 preview). Paths may contain spaces.
set -euo pipefail
PROJ="$(cd "$1" && pwd)"; MODE="$2"; COMP="$3"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO="${STUDIO:-$HERE/../studio}"
REMOTION=(node "$STUDIO/node_modules/@remotion/cli/remotion-cli.js")   # exFAT: no node_modules/.bin links, never use npx
# preview/pace default to SW_SCALE=0.25 (motion/beat metrics are measured at 90x160 anyway); splice follows its base
case "$MODE" in preview|pace) SW_SCALE="${SW_SCALE:-0.25}";; esac
[ "$MODE" = pace ] && SW_PROPS="$(python3 -c 'import json,sys; d=json.loads(sys.argv[1] or "{}"); d["measure"]=True; print(json.dumps(d,separators=(",",":")))' "${SW_PROPS:-}")"
PROPS=(); [ -n "${SW_PROPS:-}" ] && PROPS=(--props="$SW_PROPS")
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
# preflight (~2 s): types + React rules of hooks for engine + project scenes; catches mid-render crashes (#02: React #310
# at f571) before bundling. Quiet on PASS. PREFLIGHT_SKIP=1 skips it (emergencies only).
if [ -z "${PREFLIGHT_SKIP:-}" ]; then
  PF_OUT="$(node "$HERE/preflight.mjs" "$PROJ" 2>&1)" || { echo "$PF_OUT"; echo "RENDER NOT STARTED: preflight failed (fix above)"; exit 1; }
  echo "preflight PASS"
fi
# cost ledger: one line per render (incl. bundle time) → work/render_log.jsonl, read by ledger.py
T0=$(date +%s); AT=$(date -u +%Y-%m-%dT%H:%M:%SZ); RARG="${4:-}"
LOOK="full"; [[ "${SW_PROPS:-}" == *'"measure":true'* ]] && LOOK="measure"
log_render() { local rc=$?; printf '{"at":"%s","mode":"%s","comp":"%s","arg":"%s","scale":"%s","look":"%s","seconds":%s,"ok":%s}\n' "$AT" "$MODE" "$COMP" "$RARG" "${SW_SCALE:-1}" "$LOOK" "$(( $(date +%s) - T0 ))" "$([ $rc -eq 0 ] && echo true || echo false)" >> "$PROJ/work/render_log.jsonl" 2>/dev/null || true; }
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
  video|preview|pace)
    if [ "$MODE" = pace ]; then OUT="${4:-$PROJ/work/${COMP}_pace.mp4}"; else OUT="${4:-$PROJ/work/$COMP.mp4}"; fi
    "${REMOTION[@]}" render "$BUILD" "$COMP" "$OUT" --gl=angle ${PROPS[@]+"${PROPS[@]}"} --concurrency="${SW_CONCURRENCY:-3}" --log=error --muted >/dev/null 2>&1 && echo "$OUT" || { echo "RENDER FAILED"; exit 1; }
    ;;
  range)
    OUT="${5:-$PROJ/work/${COMP}_$4.mp4}"
    "${REMOTION[@]}" render "$BUILD" "$COMP" "$OUT" --frames="$4" --gl=angle ${PROPS[@]+"${PROPS[@]}"} --concurrency="${SW_CONCURRENCY:-3}" --log=error --muted >/dev/null 2>&1 && echo "$OUT" || { echo "RENDER FAILED"; exit 1; }
    ;;
  splice)
    BASE="${5:-$PROJ/work/$COMP.mp4}"; [ -f "$BASE" ] || { echo "SPLICE FAILED: no base render $BASE"; exit 1; }
    if [ -z "${SW_SCALE:-}" ]; then   # segments must match the base's size: scale = base width / composition width
      CW="$("${REMOTION[@]}" compositions "$BUILD" 2>/dev/null | awk -v c="$COMP" '$1==c {split($3,d,"x"); print d[1]}')"
      BW="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$BASE")"
      [ -n "$CW" ] && [ -n "$BW" ] || { echo "SPLICE FAILED: cannot read size of $COMP / $BASE"; exit 1; }
      SW_SCALE="$(awk -v b="$BW" -v c="$CW" 'BEGIN{printf "%g", b/c}')"; PROPS+=(--scale="$SW_SCALE")
    fi
    TMP="$PROJ/work/splice_tmp"; rm -rf "$TMP"; mkdir -p "$TMP"; SEGS=()
    IFS=',' read -ra RANGES <<< "$4"
    for R in "${RANGES[@]}"; do
      "${REMOTION[@]}" render "$BUILD" "$COMP" "$TMP/$R.mp4" --frames="$R" --gl=angle ${PROPS[@]+"${PROPS[@]}"} --concurrency="${SW_CONCURRENCY:-3}" --log=error --muted >/dev/null 2>&1 || { echo "RENDER FAILED ($R)"; exit 1; }
      SEGS+=("$TMP/$R.mp4:$R")
    done
    python3 "$HERE/splice.py" "$BASE" "$TMP/spliced.mp4" "${SEGS[@]}" || exit 1
    mv -f "$BASE" "${BASE%.mp4}.prev.mp4"; mv -f "$TMP/spliced.mp4" "$BASE"; rm -rf "$TMP"; echo "$BASE"
    ;;
  *) echo "mode must be stills|video|preview|pace|range|splice"; exit 2;;
esac
