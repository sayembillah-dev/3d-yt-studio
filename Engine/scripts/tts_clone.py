#!/usr/bin/env python3
"""tts_clone.py — Phase 5 (free, local): script lines -> vo_raw.wav in the user's cloned voice (Chatterbox, MIT).

usage (run with the Chatterbox venv, NOT system python):
  ~/.local/share/stickworld-tts/chatterbox/bin/python Engine/scripts/tts_clone.py <lines.txt> <out.wav>
        [--ref Engine/references/voice/user_voice_ref.wav] [--ex 0.7] [--cfg 0.3] [--temp 0.8]
        [--seed 7] [--tries 4] [--min-match 0.97] [--gap 0.12] [--device auto|mps|cpu] [--redo 7,12]

lines.txt = one sentence per line (e.g. public/vo_script.txt). Each line is generated on its own (keeps peak memory
~4.7 GB on Apple GPU; a whole-paragraph pass got OOM-killed on 16 GB), then checked with whisper.cpp against the
script text (numbers normalised both sides). Lines below --min-match are regenerated with a new seed (up to --tries);
the best take is kept and any line still below is listed as FAIL. Exit 0 = every line matched, 1 = some line failed.
Defaults = the settings the user picked on 2026-11-06 (01_dutch-water-line test, take 00d). Higher --ex/--temp gets
livelier but mispronounces numbers and invents words — keep ex ≤ 0.8, temp ≤ 0.85.
Only ever clone the user's own voice (they consented); never anyone else's.
"""
import argparse, difflib, json, os, re, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
WHISPER_MODEL = os.path.join(ENGINE, 'models', 'ggml-small.en.bin')


def ram_gb():
    try:
        total = int(subprocess.run(['sysctl', '-n', 'hw.memsize'], capture_output=True, text=True).stdout) / 2**30
        vm = subprocess.run(['vm_stat'], capture_output=True, text=True).stdout
        page = int(re.search(r'page size of (\d+)', vm).group(1))
        pages = sum(int(re.search(rf'{k}:\s+(\d+)', vm).group(1)) for k in ('Pages free', 'Pages inactive', 'Pages speculative'))
        return total, pages * page / 2**30
    except Exception:
        return None, None


def norm(text):
    from num2words import num2words
    def num(m):
        s = m.group(0).replace(',', '')
        n = int(s)
        return num2words(n, to='year') if len(s) == 4 and 1000 <= n <= 2099 else num2words(n)
    t = re.sub(r'\d[\d,]*', num, text.lower())
    t = t.replace('-', ' ').replace('dykes', 'dikes')
    return re.findall(r"[a-z']+", t)


def hear(wav, tmp):
    w16 = os.path.join(tmp, 'h.wav'); base = os.path.join(tmp, 'h')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ar', '16000', '-ac', '1', w16], check=True)
    subprocess.run(['whisper-cli', '-m', WHISPER_MODEL, '-f', w16, '-otxt', '-of', base, '-np'], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return ' '.join(open(base + '.txt').read().split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lines'); ap.add_argument('out')
    ap.add_argument('--ref', default=os.path.join(ENGINE, 'references', 'voice', 'user_voice_ref.wav'))
    ap.add_argument('--ex', type=float, default=0.7); ap.add_argument('--cfg', type=float, default=0.3)
    ap.add_argument('--temp', type=float, default=0.8); ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--tries', type=int, default=4); ap.add_argument('--min-match', type=float, default=0.97)
    ap.add_argument('--gap', type=float, default=0.12); ap.add_argument('--device', default='auto')
    ap.add_argument('--redo', default='', help='comma list of line numbers to regenerate; others reuse <out>_lines/NN.wav')
    a = ap.parse_args()

    import numpy as np, soundfile as sf, torch
    total, avail = ram_gb()
    dev = a.device
    if dev == 'auto':  # MPS peaks lower than CPU here (4.7 vs 5.4 GB) and is faster
        dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print(f'RAM {total:.0f} GB total, ~{avail:.1f} GB free; device {dev}' if total else f'device {dev}', flush=True)
    if avail is not None and avail < 5.5:
        print(f'WARNING: only ~{avail:.1f} GB free; Chatterbox peaks ~4.7 GB. Close browsers/other apps first '
              f'(8 GB machines: run nothing else), or the OS may kill this run.', flush=True)

    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    from chatterbox.tts import ChatterboxTTS
    m = ChatterboxTTS.from_pretrained(device=dev)
    lines = [l.strip() for l in open(a.lines) if l.strip()]
    stem = os.path.splitext(a.out)[0]
    ldir = stem + '_lines'; os.makedirs(ldir, exist_ok=True)   # best take of every line, for --redo
    rep_path = stem + '.lines.json'
    old = {r['line']: r for r in json.load(open(rep_path))} if a.redo and os.path.exists(rep_path) else {}
    redo = {int(x) for x in a.redo.split(',')} if a.redo else None
    tmp = tempfile.mkdtemp()
    torch.manual_seed(a.seed)
    parts, report, t0 = [], [], time.time()
    for i, line in enumerate(lines):
        lp = os.path.join(ldir, f'{i + 1:02d}.wav')
        if redo is not None and (i + 1) not in redo and os.path.exists(lp) and (i + 1) in old:
            w, _ = sf.read(lp, dtype='float32'); parts += [w, np.zeros(int(a.gap * m.sr), dtype=w.dtype)]
            report.append(old[i + 1]); continue
        best = None
        for k in range(a.tries):
            if redo is not None: torch.manual_seed(a.seed * 7919 + i * 31 + k)   # fresh seeds, not the first run's
            elif k: torch.manual_seed(a.seed * 1000 + i * 10 + k)
            w = m.generate(line, audio_prompt_path=a.ref, exaggeration=a.ex, cfg_weight=a.cfg,
                           temperature=a.temp).squeeze().cpu().numpy()
            if dev == 'mps': torch.mps.empty_cache()
            p = os.path.join(tmp, f'l{i}.wav'); sf.write(p, w, m.sr)
            heard = hear(p, tmp)
            score = difflib.SequenceMatcher(None, norm(line), norm(heard)).ratio()
            if best is None or score > best[0]: best = (score, w, heard, k + 1)
            if score >= a.min_match: break
        score, w, heard, n = best
        sf.write(lp, w, m.sr)
        ok = score >= a.min_match
        print(f'{"ok  " if ok else "FAIL"} {i + 1:2d}/{len(lines)} match {score:.2f} take {n}/{a.tries}  {len(w) / m.sr:4.1f}s  | {heard}', flush=True)
        report.append({'line': i + 1, 'text': line, 'heard': heard, 'match': round(score, 3), 'tries': n, 'ok': ok})
        parts += [w, np.zeros(int(a.gap * m.sr), dtype=w.dtype)]
    audio = np.concatenate(parts)
    sf.write(a.out, audio, m.sr)
    json.dump(report, open(rep_path, 'w'), indent=1)
    bad = [r['line'] for r in report if not r['ok']]
    print(f'\n{a.out}: {len(audio) / m.sr:.1f}s, {len(lines)} lines, {time.time() - t0:.0f}s; '
          + (f'FAIL lines {bad} (listen; redo with --redo {",".join(map(str, bad))} --tries 8)' if bad else 'all lines PASS'), flush=True)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
