#!/usr/bin/env python3
"""
mix.py — Phase 10 step 4: the final mix + master, muxed onto the picture → <project>/output/final.mp4.
Implements the MEASURED reference mix (style-bible §11.2 / §M rule 14):
  voice  staged at −17.5 dBFS RMS (speech frames)   music  STATIC bed at voice − 20 dB (NO ducking, no sidechain)
  ambience as rendered by sfx_synth (≈ −30 dBFS RMS)  sfx    as rendered (peaks −10…−6, booms ≤ −3)
  master: mono · gain to −14 LUFS integrated · 4×-oversampled limiter → true peak ≤ −2 dBTP · AAC 192 kb/s 48 kHz

Usage:
  python3 mix.py <project_dir> [--video <file.mp4>] [--bed-db -20] [--out output/final.mp4] [--no-music]
Inputs (relative to the project):
  public/vo.mp3 (tightened VO, required) · work/sfx.wav · work/ambience.wav (sfx_synth.py) ·
  music = public/music.mp3 (user-supplied and LICENSED) else work/music.wav (sfx_synth.py --music) ·
  video = --video, else work/<first composition in project.json>.mp4, else work/Main.mp4 / work/Gate.mp4.
  Without a video only work/final_mix.wav is written.

Checks (fix-playbook §5; exit 1 on any FAIL):
  MX1 voice_rms  voice in the MASTER −13.8 ± 1.5 dBFS RMS on speech frames — MEASURED on the 4 reference masters:
                 −13.6…−14.4 (2026-11-05). The guide's "−17.5" does not match the reference files (pre-master staging only).
                 Too hot = the non-voice layers are too quiet vs the refs (voice alone carries the loudness).
  MX2 bed_gap    voice RMS − music RMS = 18–22 dB (static)
  MX3 silence    no stretch below −45 dBFS longer than 0.25 s (50 ms windows; first/last 0.1 s ignored)
  MX4 mono       output has 1 channel (read back from the file)
  loudness       master −15…−13 LUFS and true peak ≤ −1.0 dBTP (target −14 / −2), measured on the muxed file
Then run:  python3 Engine/scripts/compare.py <project>/output/final.mp4
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np

SR = 48000
dbv = lambda x: 10 ** (x / 20)
to_db = lambda x: 20 * np.log10(max(float(x), 1e-12))


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def write_f32(path, x):
    """float WAV (no clipping above 0 dBFS — the limiter comes later)."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'pcm_f32le', path],
                   input=x.astype(np.float32).tobytes(), check=True)


def rms_frames(x, hop):
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)


def speech_mask(v, hop=480):
    lv = 20 * np.log10(rms_frames(v, hop))
    return lv > np.percentile(lv, 95) - 30


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'loudnorm=I=-14:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    d = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S).group(0))
    return float(d['input_i']), float(d['input_tp']), float(d['input_lra'])


def limit(src, dst, ceiling_db):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af',
                    f'aresample={SR * 4},alimiter=limit={dbv(ceiling_db):.5f}:attack=2:release=60:level=disabled:asc=1,aresample={SR}',
                    '-ac', '1', '-c:a', 'pcm_f32le', dst], check=True)


def probe(path, entry, stream='a:0'):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', stream, '-show_entries', entry, '-of', 'csv=p=0', path], capture_output=True, text=True)
    return r.stdout.strip()


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2)
    proj = os.path.abspath(a[0]); P = lambda *p: os.path.join(proj, *p)
    bed_db = float(a[a.index('--bed-db') + 1]) if '--bed-db' in a else -20.0
    out = os.path.abspath(a[a.index('--out') + 1]) if '--out' in a else P('output', 'final.mp4')
    video = os.path.abspath(a[a.index('--video') + 1]) if '--video' in a else None
    if not video:
        comps = json.load(open(P('project.json'))).get('compositions', []) if os.path.exists(P('project.json')) else []
        video = next((P('work', f'{c}.mp4') for c in comps + ['Main', 'Gate'] if os.path.exists(P('work', f'{c}.mp4'))), None)
    if not os.path.exists(P('public', 'vo.mp3')):
        print('ERROR: public/vo.mp3 missing (Phase 5)'); sys.exit(2)

    vo = decode(P('public', 'vo.mp3'))
    vdur = float(probe(video, 'format=duration', 'v:0') or 0) if video else 0
    if video and not vdur:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], capture_output=True, text=True); vdur = float(r.stdout)
    n = int(vdur * SR) if video else len(vo) + int(0.5 * SR)
    fit = lambda x: np.pad(x, (0, max(0, n - len(x))))[:n]
    vo = fit(vo)
    if len(vo) and np.abs(vo).max() == 0:
        print('ERROR: VO is silent'); sys.exit(2)
    mask = speech_mask(vo)
    vo *= dbv(-17.5) / np.sqrt((rms_frames(vo, 480)[mask] ** 2).mean())
    stems = {'voice': vo}
    music_src = next((p for p in (P('public', 'music.mp3'), P('work', 'music.wav')) if os.path.exists(p)), None)
    if '--no-music' in a: music_src = None
    if music_src:
        mu = fit(decode(music_src))
        mu *= dbv(-17.5 + bed_db) / np.sqrt((mu ** 2).mean() + 1e-12)
        stems['music'] = mu
    for k in ('ambience', 'sfx'):
        if os.path.exists(P('work', f'{k}.wav')):
            stems[k] = fit(decode(P('work', f'{k}.wav')))
    mix = sum(stems.values())

    tmp = tempfile.mkdtemp(); raw, lim = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'lim.wav')
    write_f32(raw, mix)
    I0, _, _ = loudness(raw)
    g = dbv(-14 - I0)
    for _ in range(3):                         # gain → limit → re-measure; the limiter shaves a little, correct for it
        write_f32(raw, mix * g); limit(raw, lim, -2.4)
        I, TP, LRA = loudness(lim)
        if abs(I + 14) <= 0.25: break
        g *= dbv(-14 - I)
    master = decode(lim); master = np.pad(master, (0, max(0, n - len(master))))[:n]
    final_wav = P('work', 'final_mix.wav')
    os.makedirs(P('work'), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', lim, '-t', f'{n / SR:.4f}', '-c:a', 'pcm_s24le', final_wav], check=True)

    if video:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', final_wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
                        '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), '-ac', '1', '-shortest', '-movflags', '+faststart', out], check=True)
        target = out
    else:
        target = final_wav
    If, TPf, LRAf = loudness(target)
    chans = int(probe(target, 'stream=channels') or 1)

    # measured exactly like the references: the FULL master on speech frames (the refs have no separate stems)
    mr = rms_frames(master, 480); k = min(len(mr), len(mask))
    voice_m = to_db(np.sqrt((mr[:k][mask[:k]] ** 2).mean()))
    w = 20 * np.log10(rms_frames(master, 2400))[2:-2]
    run = best = 0
    for v in w:
        run = run + 1 if v < -45 else 0; best = max(best, run)
    res = [('MX1', 'voice_rms', abs(voice_m + 13.8) <= 1.5, f'voice in master {voice_m:.1f} dBFS RMS (refs −13.6…−14.4; gate −13.8 ± 1.5)'),
           ('MX2', 'bed_gap', (18 <= -bed_db <= 22) if music_src else None, f'music static {-bed_db:.0f} dB under the voice' if music_src else 'no music (N/A)'),
           ('MX3', 'silence', best * 0.05 <= 0.25, f'longest stretch below −45 dBFS {best * 0.05:.2f} s (≤ 0.25)'),
           ('MX4', 'mono', chans == 1, f'{chans} channel(s)')]
    loud_ok = -15 <= If <= -13 and TPf <= -1.0
    print(f'{target}' + (f'\n  picture: {os.path.relpath(video, proj)} ({vdur:.2f} s)' if video else '  (no video found — render first; wrote the mix only)'))
    print('  stems in master: ' + ', '.join(f'{k} {to_db(np.sqrt((v ** 2).mean() + 1e-12) * g):.1f} dBFS RMS' for k, v in stems.items()))
    print(f'  music source: {os.path.relpath(music_src, proj) if music_src else "none"}')
    for cid, name, ok, det in res:
        print(f'{cid}  {name:9s} {"N/A " if ok is None else ("PASS" if bool(ok) else "FAIL")}  {det}')
    print(f'     loudness  {"PASS" if loud_ok else "FAIL"}  {If:.1f} LUFS (−14; gate −15…−13) · true peak {TPf:.1f} dBTP (≤ −1.0, target −2) · LRA {LRAf:.1f} LU (refs ≤ 3)')
    fails = [r[0] for r in res if r[2] is not None and not r[2]] + ([] if loud_ok else ['LUFS'])
    FIX = {'MX1': 'MX1: TOO HOT (> −12.3) = ambience/SFX too quiet vs the refs → AMBIENCE gain +3…+6 in scenes/sfx.ts, more SFX_EXTRA hits; TOO QUIET (< −15.3) = SFX/ambience too loud → lower them. Re-run sfx_cues + sfx_synth + mix.',
           'MX2': 'MX2: --bed-db -20 (static bed, no ducking).',
           'MX3': 'MX3: AMBIENCE in scenes/sfx.ts must cover 0..END, then re-run sfx_cues.mjs + sfx_synth.py.',
           'MX4': 'MX4: output must be mono (mix.py writes -ac 1; check the input video has no extra audio stream mapped).',
           'LUFS': 'loudness: re-run mix.py; if the true peak stays high, lower boom/impact cue gains in scenes/sfx.ts.'}
    if fails:
        print('\nFIX PLAYBOOK:'); [print('  ' + FIX[f]) for f in fails]
    print(f'\nMIX: {"FAIL" if fails else "PASS"}' + (f'   next: python3 Engine/scripts/compare.py "{out}"' if video else ''))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
