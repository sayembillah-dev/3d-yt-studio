#!/usr/bin/env python3
"""VO mp3/wav -> words.json [{w, s, e}] (seconds) using whisper.cpp per-token timings.
Also reports pacing vs the style bible (3.66 w/s target, no pause > 0.33 s).
usage: transcribe.py <audio> <out_words.json> [--model PATH] [--gate]

Phase 5 gate (V1 wps, V2 pause) is printed on every run, measured exactly like compare.py measures the final mix
(whisper words / first-to-last-word span, 3 decimals, never rounded into a pass).
  V1 wps    FAIL outside 3.2-4.1; WARN within 2 % of either end (< 3.264 or > 4.018): the final mix is re-transcribed
            over music/SFX and drifts (+0.4 % on #01, -1.5 % on #02, which then failed the final compare at 3.15)
  V2 pause  longest pause <= 0.33 s
--gate: exit 1 when V1 or V2 is not PASS (WARN included). Without it the exit code is 0 on any transcription (measure_short.py relies on that)."""
import json, subprocess, sys, os, tempfile, re
WPS_LO, WPS_HI, MARGIN = 3.2, 4.1, 0.02
MODEL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models', 'ggml-small.en.bin')
def main():
    a = sys.argv[1:]; audio, out = a[0], a[1]
    model = a[a.index('--model') + 1] if '--model' in a else MODEL
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, 'a.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', audio, '-ar', '16000', '-ac', '1', wav], check=True)
    base = os.path.join(tmp, 'tx')
    subprocess.run(['whisper-cli', '-m', model, '-f', wav, '-ojf', '-of', base, '-ml', '0', '-np'], check=True, stdout=subprocess.DEVNULL)
    data = json.load(open(base + '.json'))
    words = []
    for seg in data.get('transcription', []):
        for tk in seg.get('tokens', []):
            t = tk.get('text', '')
            if t.startswith('[_') or t.startswith('<|') or not t.strip(): continue
            s, e = tk['offsets']['from'] / 1000, tk['offsets']['to'] / 1000
            if t.startswith(' ') or not words: words.append({'w': t.strip(), 's': s, 'e': e})
            else: words[-1]['w'] += t; words[-1]['e'] = e
    # punctuation-only tokens glue to previous word
    clean = []
    for w in words:
        if re.fullmatch(r"[^\w']+", w['w']) and clean: clean[-1]['w'] += w['w']; clean[-1]['e'] = max(clean[-1]['e'], w['e'])
        else: clean.append(w)
    for i in range(len(clean) - 1):  # no overlaps
        clean[i]['e'] = min(clean[i]['e'], clean[i + 1]['s']) if clean[i + 1]['s'] > clean[i]['s'] else clean[i]['e']
    json.dump(clean, open(out, 'w'), indent=1)
    dur = clean[-1]['e'] - clean[0]['s'] if clean else 0
    gaps = [(clean[i]['w'], round(clean[i + 1]['s'] - clean[i]['e'], 2)) for i in range(len(clean) - 1) if clean[i + 1]['s'] - clean[i]['e'] > 0.33]
    wps = len(clean) / dur if dur else 0.0
    print(json.dumps({'words': len(clean), 'duration_s': round(dur, 3), 'wps': round(wps, 3),
                      'target_wps': 3.66, 'pauses_over_0.33s': gaps}, indent=1))
    longest = max([clean[i + 1]['s'] - clean[i]['e'] for i in range(len(clean) - 1)] or [0])
    lo_w, hi_w = WPS_LO * (1 + MARGIN), WPS_HI * (1 - MARGIN)
    v1 = 'FAIL' if not (WPS_LO <= wps <= WPS_HI) else ('WARN' if not (lo_w <= wps <= hi_w) else 'PASS')
    v2 = 'PASS' if longest <= 0.33 else 'FAIL'
    print(f'V1  wps    {v1}  {len(clean)} words / {dur:.3f} s = {wps:.3f} w/s (gate {WPS_LO}-{WPS_HI}, safe {lo_w:.3f}-{hi_w:.3f}, guide 3.66)')
    print(f'V2  pause  {v2}  longest pause {longest:.3f} s (<= 0.33)')
    if v1 != 'PASS' and wps < lo_w:
        need = lo_w / wps
        print(f'FIX V1 (slow): need x{need:.3f} pace. Options, in order: tighten gaps (tighten_vo --keep 0.10), denser wording '
              f'(same syllables, more words: adding words at the same pace does NOT raise wps), or a small --atempo '
              f'{min(1.05, need + 0.005):.2f} (user: 1.10 sounds rushed; stay <= 1.05).')
    elif v1 != 'PASS':
        print('FIX V1 (fast): looser gaps (tighten_vo --keep 0.16) or --atempo 0.97.')
    print(f'TRANSCRIBE GATE: {"FAIL" if "FAIL" in (v1, v2) else v1}')
    if '--gate' in sys.argv and (v1, v2) != ('PASS', 'PASS'):
        sys.exit(1)
main()
