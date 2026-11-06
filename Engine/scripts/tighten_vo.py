#!/usr/bin/env python3
"""
tighten_vo.py — Phase 5: make a voiceover as tight as the references (no pause > 0.33 s; refs: longest 0.12–0.25 s).

Usage:
  python3 tighten_vo.py <vo_raw.(mp3|wav|aiff)> <vo.mp3> [--gap 0.30] [--keep 0.12] [--min-silence-db -40]
                        [--atempo 1.0] [--script script.md | --words N]

What it does (cuts ONLY inside silence, never inside a word):
  1. decode to mono 48 kHz; RMS in 10 ms frames; "silent" = frame below the threshold
     threshold = max(--min-silence-db, speech_level − 30 dB)  (speech_level = 95th percentile frame level)
  2. every silent run longer than --gap (0.30 s) is shortened to --keep (0.12 s): keep half on each side,
     5 ms crossfade at the join; leading/trailing silence trimmed to 0.05 s
  3. optional --atempo (1.00–1.10, pitch-preserving ffmpeg atempo) for a slow take
  4. encode mp3 (mono, 192 kb/s)
Report: duration before/after, gaps shortened, longest remaining pause, and wps if --script/--words is given.

Checks (fix-playbook §5):
  V1 wps    3.2–4.1 words/s (needs --script or --words; otherwise N/A — transcribe.py reports it next)
  V2 pause  longest remaining pause ≤ 0.33 s
Exit 0 = PASS, 1 = a check failed, 2 = usage error.
If the report shows a cut inside a word (a clipped consonant when you listen / transcribe.py drops a word), re-run with
--min-silence-db raised by 3 (e.g. -37).
"""
import os, re, subprocess, sys, tempfile
import numpy as np

SR = 48000
HOP = 480  # 10 ms


def arg(a, k, d, t=float):
    return t(a[a.index(k) + 1]) if k in a else d


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def frame_db(x):
    n = len(x) // HOP
    fr = x[:n * HOP].reshape(n, HOP)
    rms = np.sqrt((fr.astype(np.float64) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(rms + 1e-12)


def silent_runs(db, thr):
    runs, start = [], None
    for i, v in enumerate(db):
        if v < thr:
            if start is None: start = i
        elif start is not None:
            runs.append((start, i)); start = None
    if start is not None:
        runs.append((start, len(db)))
    return runs  # frame index ranges [s, e)


def longest_inner_pause(x, thr):
    db = frame_db(x)
    runs = silent_runs(db, thr)
    inner = [(s, e) for s, e in runs if s > 0 and e < len(db)]
    return max([(e - s) * HOP / SR for s, e in inner], default=0.0)


def count_script_words(path):
    from importlib.util import spec_from_file_location, module_from_spec
    sp = spec_from_file_location('sl', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'script_lint.py'))
    m = module_from_spec(sp); sp.loader.exec_module(m)
    _, vo = m.parse(path)
    return sum(len(m.words_of(re.sub(r'\[(REVEAL|DOUBTER|PIVOT)\]', '', s))) for s in vo)


def main():
    a = sys.argv[1:]
    if len(a) < 2 or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2)
    src, dst = a[0], a[1]
    gap, keep = arg(a, '--gap', 0.30), arg(a, '--keep', 0.12)
    floor_db, tempo = arg(a, '--min-silence-db', -40.0), arg(a, '--atempo', 1.0)
    if not 0.9 <= tempo <= 1.10:
        print('ERROR: --atempo must be 0.90–1.10 (never faster than 1.10: it starts to sound chipmunked)'); sys.exit(2)
    nwords = arg(a, '--words', None, int)
    if '--script' in a:
        nwords = count_script_words(a[a.index('--script') + 1])

    x = decode(src)
    dur0 = len(x) / SR
    db = frame_db(x)
    speech = np.percentile(db, 95)
    thr = max(floor_db, speech - 30)
    runs = silent_runs(db, thr)
    keep_f, gap_f = int(round(keep * SR / HOP)), int(round(gap * SR / HOP))
    xf = int(0.005 * SR)
    segs, cur, shortened = [], 0, 0
    for s, e in runs:
        if s == 0:                                    # leading silence → 0.05 s
            cur = max(0, e * HOP - int(0.05 * SR)); continue
        if e >= len(db):                              # trailing silence → 0.05 s
            segs.append(x[cur:min(len(x), s * HOP + int(0.05 * SR))]); cur = None; break
        if e - s > gap_f:
            half = keep_f // 2
            segs.append(x[cur:(s + half) * HOP]); cur = (e - (keep_f - half)) * HOP; shortened += 1
    if cur is not None:
        segs.append(x[cur:])
    out = segs[0].copy() if segs else x.copy()
    ramp = np.linspace(0, 1, xf, dtype=np.float32)
    for sg in segs[1:]:
        if len(out) > xf and len(sg) > xf:
            out[-xf:] = out[-xf:] * (1 - ramp) + sg[:xf] * ramp
            out = np.concatenate([out, sg[xf:]])
        else:
            out = np.concatenate([out, sg])

    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, 't.wav')
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
    af = ['-af', f'atempo={tempo}'] if abs(tempo - 1) > 1e-6 else []
    os.makedirs(os.path.dirname(os.path.abspath(dst)) or '.', exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, *af, '-ac', '1', '-ar', str(SR), '-b:a', '192k', dst], check=True)

    y = decode(dst)
    dur1 = len(y) / SR
    longest = longest_inner_pause(y, thr)
    before = longest_inner_pause(x, thr)
    print(f'input   {src}\n  duration {dur0:.2f} s, longest pause {before:.2f} s, silence threshold {thr:.1f} dBFS')
    print(f'output  {dst}\n  duration {dur1:.2f} s ({dur1 - dur0:+.2f} s), {shortened} gaps > {gap:.2f} s shortened to {keep:.2f} s, atempo {tempo:g}')
    res = []
    if nwords:
        wps = nwords / dur1
        res.append(('V1', 'wps', 3.2 <= wps <= 4.1, f'{nwords} words / {dur1:.3f} s = {wps:.3f} w/s (3.2–4.1, guide 3.66; before {nwords / dur0:.3f}) '
                    f'— ESTIMATE from script words; the gate is transcribe.py --gate (whisper, same as the final compare)'))
        if 3.2 <= wps < 3.264 or 4.018 < wps <= 4.1:
            print(f'WARN  V1 wps {wps:.3f} is within 2 % of the gate edge: the final mix can drift 1.5 % and fail. Aim 3.27–4.0.')
    else:
        res.append(('V1', 'wps', None, 'N/A (pass --script or --words; transcribe.py reports wps next)'))
    res.append(('V2', 'pause', longest <= 0.33, f'longest remaining pause {longest:.2f} s (≤ 0.33; refs 0.12–0.25)'))
    for cid, name, ok, det in res:
        print(f'{cid}  {name:6s} {"N/A " if ok is None else ("PASS" if ok else "FAIL")}  {det}')
    fails = [r for r in res if r[2] is False]
    if fails:
        print('\nFIX PLAYBOOK:')
        for cid, name, _, _ in fails:
            print('  ' + {'V1': 'V1 wps: too slow → --keep 0.10, denser wording, or --atempo ≤ 1.05 (user found 1.10 rushed; adding words at the same pace does not raise wps); too fast → --keep 0.16 or --atempo 0.97. Never pad silence.',
                          'V2': 'V2 pause: lower --gap to 0.25, or the "pause" is a held breath/noise above the threshold → --min-silence-db -35.'}[cid])
    print(f'\nSuggested project.json duration_s = {dur1 + 0.5:.1f}  (VO length + 0.5 s)')
    print(f'TIGHTEN_VO: {"FAIL" if fails else "PASS"}')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
