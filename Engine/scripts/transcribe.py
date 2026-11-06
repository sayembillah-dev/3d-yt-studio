#!/usr/bin/env python3
"""VO mp3/wav -> words.json [{w, s, e}] (seconds) using whisper.cpp per-token timings.
Also reports pacing vs the style bible (3.66 w/s target, no pause > 0.33 s).
usage: transcribe.py <audio> <out_words.json> [--model PATH]"""
import json, subprocess, sys, os, tempfile, re
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
    print(json.dumps({'words': len(clean), 'duration_s': round(dur, 2), 'wps': round(len(clean) / dur, 2) if dur else 0,
                      'target_wps': 3.66, 'pauses_over_0.33s': gaps}, indent=1))
main()
