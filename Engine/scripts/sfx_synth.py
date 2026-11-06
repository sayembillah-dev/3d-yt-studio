#!/usr/bin/env python3
"""
sfx_synth.py — Phase 10 step 2–3: render the SFX + ambience stems (and a procedural music bed) from work/sfx_cues.json.
No samples, no paid APIs, no copyrighted music: everything is synthesised (numpy only), deterministic per seed.

Usage:
  python3 sfx_synth.py <project_dir> [--music] [--bpm 100] [--mood bright|mystery] [--drop <frame>] [--seed 1]
  python3 sfx_synth.py --demo <out_dir>      # one file per sound kind + 6 s of each ambience + 12 s of music (to audition)

Writes (mono, 48 kHz, 16-bit):
  work/sfx.wav       every cue at its frame. Peak level = −6 dBFS + cue.gain (gain 0 = −6 dBFS, refs: SFX peaks −10…−6;
                     booms may go to −3). Each cue has a variant index v → a different seed (never the same sound twice in a row).
  work/ambience.wav  AMBIENCE ranges (sea, wind, crowd, fire, crickets, rain, room, city), 0.5 s crossfades, RMS −30 dBFS
  work/music.wav     (--music) plucky marimba-style bed: ~100 BPM major (bright) or 75 BPM minor (mystery), I–V–vi–IV,
                     bass + soft kick + light hats; the last 15 % adds an octave layer and 16th-note arps (the climax swell);
                     --drop F mutes the bed for one beat at frame F (the twist line). RMS −20 dBFS (mix.py sets the level).
Kinds: whoosh whip pop boing impact thud boom rattle sting ding bell sparkle gulp steam coin cash step splash click clack
       crash whistle sizzle clank rustle creak. Unknown kinds fall back to 'click' with a warning.
Checks: SX3 repeats — no two consecutive cues of the same kind share a variant seed (exit 1 if violated).
"""
import json, math, os, sys, wave
import numpy as np

SR = 48000


def db(x):
    return 10 ** (x / 20)


def write_wav(path, x):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


def put(y, s, p):
    """mix p into y at sample s, clipped to y's bounds (sounds that start near the end are cut, never crash)."""
    if s >= len(y) or s + len(p) <= 0: return
    a = max(0, s); b = min(len(y), s + len(p))
    y[a:b] += p[a - s:b - s]


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def env(n, a=0.005, r=0.2, curve=4.0):
    """attack (s) + exponential release over the rest."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.exp(-curve * np.maximum(0, t - a) / max(r, 1e-4))
    return e


def shaped_noise(n, rng, lo, hi, tilt=0.0):
    """noise band-limited to [lo, hi] Hz (FFT domain); tilt = dB/octave slope (−3 pink, −6 brown)."""
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    if tilt:
        m *= np.power(np.maximum(f, 20) / 1000, tilt / 6.02)
    y = np.fft.irfft(X * m, n)
    return y / (np.abs(y).max() + 1e-9)


def stft_sweep(x, lo_fn, hi_fn, win=1024, hop=256):
    """time-varying band-pass: per STFT frame keep [lo_fn(t), hi_fn(t)] Hz (t = 0..1 through the sound)."""
    n = len(x); pad = np.concatenate([np.zeros(win), x, np.zeros(win)])
    w = np.hanning(win); out = np.zeros_like(pad); norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(win, 1 / SR)
    for s in range(0, len(pad) - win, hop):
        t = min(1, max(0, (s - win) / max(n, 1)))
        lo, hi = lo_fn(t), hi_fn(t)
        m = 1 / (1 + ((f - (lo + hi) / 2) / max((hi - lo) / 2, 1)) ** 4)   # soft band
        out[s:s + win] += np.fft.irfft(np.fft.rfft(pad[s:s + win] * w) * m, win) * w
        norm[s:s + win] += w * w
    y = out / np.maximum(norm, 1e-6)
    return y[win:win + n]


def sine_sweep(f0, f1, dur, curve='exp'):
    t = t_(dur)
    if curve == 'exp':
        fr = f0 * (f1 / f0) ** (t / dur)
    else:
        fr = f0 + (f1 - f0) * t / dur
    return np.sin(2 * np.pi * np.cumsum(fr) / SR)


# ------------------------------------------------------------------ sound library (each returns peak-normalised audio)
def k_whoosh(rng, short=False):
    dur = rng.uniform(0.22, 0.32) if short else rng.uniform(0.38, 0.62)
    n = int(dur * SR); x = rng.standard_normal(n)
    peak = rng.uniform(0.45, 0.6)
    lo = lambda t: 250 + 1400 * math.exp(-((t - peak) / 0.22) ** 2) * (1.6 if short else 1)
    hi = lambda t: 900 + 4200 * math.exp(-((t - peak) / 0.25) ** 2) * (1.4 if short else 1)
    y = stft_sweep(x, lo, hi)
    tt = np.linspace(0, 1, n)
    y *= np.exp(-((tt - peak) / (0.2 if short else 0.28)) ** 2)
    return y


def k_pop(rng):
    d = 0.09; y = sine_sweep(rng.uniform(650, 900), rng.uniform(220, 300), d) * env(int(d * SR), 0.001, 0.03)
    return y + 0.3 * shaped_noise(len(y), rng, 2000, 6000) * env(len(y), 0.0005, 0.004)


def k_boing(rng):
    d = 0.55; t = t_(d); base = rng.uniform(150, 200)
    fr = base * (1 + 1.3 * t / d) * (1 + 0.18 * np.sin(2 * np.pi * 14 * t) * np.exp(-5 * t))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.003, 0.25, 3)


def k_impact(rng):
    d = 0.35; n = int(d * SR)
    body = sine_sweep(rng.uniform(85, 110), 45, d) * env(n, 0.001, 0.09, 3)
    crack = shaped_noise(n, rng, 120, 4000, -3) * env(n, 0.0005, 0.03, 3)
    return body + 0.7 * crack


def k_thud(rng):
    d = 0.22; n = int(d * SR)
    return sine_sweep(rng.uniform(70, 85), 40, d) * env(n, 0.001, 0.06, 3) + 0.25 * shaped_noise(n, rng, 60, 900, -6) * env(n, 0.001, 0.03)


def k_boom(rng):
    d = 1.6; n = int(d * SR)
    low = sine_sweep(rng.uniform(55, 70), 28, d) * env(n, 0.002, 0.35, 2.5)
    rum = shaped_noise(n, rng, 25, 1800, -6) * env(n, 0.004, 0.5, 2.2)
    return low + 0.9 * rum


def k_rattle(rng):
    d = 0.5; n = int(d * SR); y = np.zeros(n)
    for i in range(int(rng.integers(7, 11))):
        s = int((i * 0.045 + rng.uniform(-0.008, 0.008)) * SR)
        if 0 <= s < n - 2400:
            y[s:s + 2400] += shaped_noise(2400, rng, 1200, 5000) * env(2400, 0.0005, 0.012) * rng.uniform(0.5, 1)
    return y * np.linspace(1, 0.4, n)


def k_sting(rng):
    d = 0.6; t = t_(d); root = rng.choice([196, 220, 233.1])
    y = np.zeros(len(t))
    for r in (1, 1.26, 1.587):          # augmented triad = comedic "uh-oh"
        for h in range(1, 7):
            y += np.sin(2 * np.pi * root * r * h * t) / h ** 1.2
    return y * env(len(t), 0.01, 0.22, 3)


def bell(rng, f0, d):
    t = t_(d)
    y = sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t * dk) for r, a, dk in ((1, 1, 4), (2.76, 0.45, 7), (5.4, 0.25, 12), (8.9, 0.1, 18)))
    return y * env(len(t), 0.001, d, 0.01)


def k_ding(rng):
    return bell(rng, rng.uniform(1250, 1400), 0.9)


def k_bell(rng):
    return bell(rng, rng.uniform(620, 700), 1.4)


def k_sparkle(rng):
    d = 0.7; n = int(d * SR); y = np.zeros(n)
    notes = sorted(rng.uniform(2200, 5200, 6))
    for i, f in enumerate(notes):
        s = int(i * 0.07 * SR); m = min(n - s, int(0.35 * SR))
        y[s:s + m] += bell(rng, f, 0.35)[:m] * (0.9 - i * 0.08)
    return y


def k_gulp(rng):
    d = 0.18; t = t_(d)
    fr = 260 - 140 * t / d + 40 * np.sin(2 * np.pi * 22 * t)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * t / d) ** 2


def k_steam(rng):
    d = 0.8; n = int(d * SR)
    y = shaped_noise(n, rng, 2500, 11000) * env(n, 0.03, 0.4, 2)
    return y + 0.15 * np.sin(2 * np.pi * rng.uniform(2300, 2700) * t_(d)) * env(n, 0.05, 0.4, 2)


def k_coin(rng):
    d = 0.6; t = t_(d); y = np.zeros(len(t))
    base = rng.uniform(2000, 2400)
    for hit, at in ((1, 0.0), (0.55, rng.uniform(0.07, 0.11))):
        s = int(at * SR); tt = t[: len(t) - s]
        y[s:] += hit * sum(a * np.sin(2 * np.pi * base * r * tt) * np.exp(-tt * dk) for r, a, dk in ((1, 1, 9), (1.48, 0.7, 12), (2.33, 0.5, 15), (3.1, 0.3, 20)))
    return y


def k_cash(rng):
    y = np.concatenate([k_coin(rng), np.zeros(int(0.1 * SR))])
    z = k_coin(rng); s = int(0.12 * SR); y[s:s + len(z)] += 0.7 * z[: len(y) - s]
    r = k_rustle(rng); y[: len(r)] += 0.5 * r[: len(y)]
    return y


def k_step(rng):
    d = 0.09; n = int(d * SR)
    return shaped_noise(n, rng, 150, 2500, -3) * env(n, 0.001, 0.02, 3) + 0.6 * np.sin(2 * np.pi * 110 * t_(d)) * env(n, 0.001, 0.025)


def k_splash(rng):
    d = 0.9; n = int(d * SR)
    y = shaped_noise(n, rng, 300, 9000, -2) * env(n, 0.005, 0.35, 2.5)
    for _ in range(8):
        s = int(rng.uniform(0.05, 0.6) * SR); m = int(0.05 * SR)
        if s + m < n: y[s:s + m] += 0.4 * sine_sweep(rng.uniform(500, 900), rng.uniform(1200, 2200), 0.05) * env(m, 0.002, 0.02)
    return y


def k_click(rng):
    n = int(0.03 * SR)
    return shaped_noise(n, rng, 1800, 6000) * env(n, 0.0003, 0.006)


def k_clack(rng):
    d = 0.75; n = int(d * SR); y = np.zeros(n)
    for at, a in ((0, 1), (0.12, 0.8), (0.36, 1), (0.48, 0.8)):   # clickety-clack
        s = int(at * SR); m = int(0.06 * SR)
        y[s:s + m] += a * (shaped_noise(m, rng, 600, 3000) * env(m, 0.0005, 0.015) + 0.5 * np.sin(2 * np.pi * 180 * t_(0.06)) * env(m, 0.0005, 0.02))
    return y


def k_crash(rng):
    d = 1.0; n = int(d * SR)
    y = shaped_noise(n, rng, 200, 12000, -1.5) * env(n, 0.002, 0.3, 2.5)
    for _ in range(6):
        s = int(rng.uniform(0.02, 0.5) * SR); c = k_clank(rng)[: n - s] * 0.3; put(y, s, c)
    return y


def k_whistle(rng):
    d = 1.1; t = t_(d); base = rng.uniform(560, 640)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t)
    y = sum(np.sin(2 * np.pi * base * r * np.cumsum(vib) / SR) for r in (1, 1.25, 1.5))
    y += 0.3 * shaped_noise(len(t), rng, 1500, 6000)
    return y * np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.25)


def k_sizzle(rng):
    d = 1.0; n = int(d * SR)
    y = shaped_noise(n, rng, 3000, 12000)
    crack = (rng.random(n) < 0.0015).astype(float); crack = np.convolve(crack, np.exp(-np.arange(200) / 30), 'same')
    return (y * (0.5 + 0.5 * crack)) * env(n, 0.02, 0.5, 2)


def k_clank(rng):
    d = 0.45; t = t_(d); b = rng.uniform(380, 460)
    return sum(a * np.sin(2 * np.pi * b * r * t) * np.exp(-t * dk) for r, a, dk in ((1, 1, 10), (2.83, 0.6, 14), (4.7, 0.4, 18), (7.1, 0.2, 25)))


def k_rustle(rng):
    d = 0.45; n = int(d * SR)
    am = np.repeat(rng.uniform(0.2, 1, int(d * 60) + 1), SR // 60)[:n]
    return shaped_noise(n, rng, 1500, 8000) * am * env(n, 0.02, 0.2, 2)


def k_creak(rng):
    d = 0.7; t = t_(d)
    fr = 95 + 40 * np.sin(2 * np.pi * 1.3 * t) + rng.uniform(-10, 10)
    ph = np.cumsum(fr) / SR
    saw = 2 * (ph % 1) - 1
    y = stft_sweep(saw, lambda _: 400, lambda _: 1800)
    return y * np.sin(np.pi * t / d)


KINDS = {'whoosh': k_whoosh, 'whip': lambda r: k_whoosh(r, short=True), 'pop': k_pop, 'boing': k_boing, 'impact': k_impact,
         'thud': k_thud, 'boom': k_boom, 'rattle': k_rattle, 'sting': k_sting, 'ding': k_ding, 'bell': k_bell, 'sparkle': k_sparkle,
         'gulp': k_gulp, 'steam': k_steam, 'coin': k_coin, 'cash': k_cash, 'step': k_step, 'splash': k_splash, 'click': k_click,
         'clack': k_clack, 'crash': k_crash, 'whistle': k_whistle, 'sizzle': k_sizzle, 'clank': k_clank, 'rustle': k_rustle, 'creak': k_creak}


def make(kind, seed):
    rng = np.random.default_rng(seed)
    y = KINDS[kind](rng)
    y = y - y.mean()
    fade = min(len(y) // 4, int(0.01 * SR))
    if fade: y[-fade:] *= np.linspace(1, 0, fade)
    return y / (np.abs(y).max() + 1e-9)


# ------------------------------------------------------------------ ambience
def ambience(kind, n, seed):
    rng = np.random.default_rng(seed); t = np.arange(n) / SR
    slow = lambda hz, ph=0: 0.5 + 0.5 * np.sin(2 * np.pi * hz * t + ph)
    if kind == 'sea':
        y = shaped_noise(n, rng, 40, 2500, -6) * (0.55 + 0.45 * slow(0.11)) + 0.35 * shaped_noise(n, rng, 800, 6000) * slow(0.11, 1.2) ** 3
        for s in np.arange(rng.uniform(1, 3), n / SR - 1, rng.uniform(4, 7)):     # gulls
            m = int(0.35 * SR); i = int(s * SR)
            if i + m < n:
                c = sine_sweep(rng.uniform(1700, 2100), rng.uniform(1200, 1500), 0.35) * np.sin(np.pi * np.linspace(0, 1, m)) * 0.25
                y[i:i + m] += c
        return y
    if kind == 'wind':
        return shaped_noise(n, rng, 150, 3000, -4) * (0.4 + 0.6 * slow(0.07) * slow(0.19, 2))
    if kind == 'crowd':
        y = np.zeros(n)
        for _ in range(6):
            am = np.repeat(rng.uniform(0, 1, int(n / SR * 6) + 2), SR // 6)[:n]
            am = np.convolve(am, np.ones(2400) / 2400, 'same')
            y += shaped_noise(n, rng, 250, 3200, -3) * am
        return y
    if kind == 'fire':
        y = 0.6 * shaped_noise(n, rng, 30, 600, -6)
        cr = (rng.random(n) < 0.0008).astype(float) * rng.uniform(0.3, 1, n)
        return y + np.convolve(cr, np.exp(-np.arange(300) / 40) * np.sin(np.arange(300) * 0.9), 'same')
    if kind == 'crickets':
        y = np.zeros(n); car = np.sin(2 * np.pi * 4600 * t)
        for s in np.arange(0, n / SR, 0.9):
            for k in range(3):
                i = int((s + k * 0.06 + rng.uniform(0, 0.05)) * SR); m = int(0.035 * SR)
                if i + m < n: y[i:i + m] += car[i:i + m] * np.hanning(m)
        return y + 0.1 * shaped_noise(n, rng, 60, 400, -6)
    if kind == 'rain':
        y = shaped_noise(n, rng, 800, 12000, -1)
        dr = (rng.random(n) < 0.002).astype(float); return y + 2 * np.convolve(dr, np.exp(-np.arange(120) / 15), 'same')
    if kind == 'city':
        return shaped_noise(n, rng, 30, 1200, -6) * (0.7 + 0.3 * slow(0.05))
    return shaped_noise(n, rng, 30, 4000, -4) * 0.5     # room tone


def norm_rms(y, target_db):
    r = np.sqrt(np.mean(y ** 2) + 1e-12)
    return y * db(target_db) / r


# ------------------------------------------------------------------ music bed
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)


def pluck(f, dur, bright=1.0):
    t = t_(dur)
    y = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 18) + 0.15 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 8)
    return y * env(len(t), 0.002, dur * 0.5, 3.2)


def music(n, bpm, mood, seed, drop_s=None):
    rng = np.random.default_rng(seed)
    y = np.zeros(n + SR * 2); beat = 60 / bpm; total = n / SR
    if mood == 'mystery':
        prog = [(57, 'm'), (53, ''), (48, ''), (55, '')]     # Am F C G
    else:
        prog = [(60, ''), (55, ''), (57, 'm'), (53, '')]     # C G Am F
    tri = lambda root, q: [root, root + (3 if q == 'm' else 4), root + 7]
    motif = rng.integers(0, 3, 8); motif2 = rng.integers(0, 3, 8)
    bar, t0 = 0, 0.0
    while t0 < total:
        root, q = prog[bar % 4]; ch = tri(root, q)
        climax = t0 >= total * 0.85
        # bass: root on 1 and 3
        for b in (0, 2):
            s = int((t0 + b * beat) * SR); p = pluck(NOTE(root - 24), beat * 1.6, 0.3) * 0.55
            put(y, s, p)
        # kick (soft) on 1, 3
        for b in (0, 2):
            s = int((t0 + b * beat) * SR); k = sine_sweep(110, 45, 0.18) * env(int(0.18 * SR), 0.001, 0.05) * 0.5
            put(y, s, k)
        # hats on the off-beats
        for b in range(4):
            s = int((t0 + (b + 0.5) * beat) * SR); m = int(0.04 * SR)
            put(y, s, shaped_noise(m, rng, 6000, 14000) * env(m, 0.0005, 0.01) * 0.12)
        # marimba arp: 8ths (16ths in the climax)
        steps = 16 if climax else 8; mo = motif if bar % 4 < 2 else motif2
        for i in range(steps):
            if not climax and (i % 8 in (3, 7)) and rng.random() < 0.35: continue
            note = ch[int(mo[i % 8])] + (12 if (i // 4) % 2 and not climax else 0)
            s = int((t0 + i * beat * 4 / steps) * SR); p = pluck(NOTE(note), beat * 0.9) * (0.5 if climax else 0.45)
            put(y, s, p)
            if climax:
                p2 = pluck(NOTE(note + 12), beat * 0.6, 1.3) * 0.25; put(y, s, p2)
        bar += 1; t0 += 4 * beat
    y = y[:n]
    if drop_s is not None:
        a, b = int(drop_s * SR), int((drop_s + beat) * SR)
        g = np.ones(n); g[a:b] = 0
        g = np.convolve(g, np.ones(480) / 480, 'same'); y *= g
    fade = int(0.3 * SR); y[-fade:] *= np.linspace(1, 0, fade)
    return y


# ------------------------------------------------------------------ main
def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2)
    seed = int(a[a.index('--seed') + 1]) if '--seed' in a else 1
    mood = a[a.index('--mood') + 1] if '--mood' in a else 'bright'
    bpm = float(a[a.index('--bpm') + 1]) if '--bpm' in a else (75 if mood == 'mystery' else 100)
    if a[0] == '--demo':
        out = a[1]; os.makedirs(out, exist_ok=True)
        for k in KINDS:
            write_wav(os.path.join(out, f'sfx_{k}.wav'), make(k, 7) * db(-6))
        for k in ('sea', 'wind', 'crowd', 'fire', 'crickets', 'rain', 'room', 'city'):
            write_wav(os.path.join(out, f'amb_{k}.wav'), norm_rms(ambience(k, 6 * SR, 3), -24))
        write_wav(os.path.join(out, 'music.wav'), norm_rms(music(12 * SR, bpm, mood, seed), -20))
        print(f'demo written to {out}: {len(KINDS)} sfx, 8 ambiences, 12 s music'); return
    proj = a[0]
    cp = os.path.join(proj, 'work', 'sfx_cues.json')
    if not os.path.exists(cp):
        print(f'ERROR: {cp} missing — run node Engine/scripts/sfx_cues.mjs {proj} first'); sys.exit(2)
    C = json.load(open(cp)); fps = C.get('fps', 30)
    n = int((C['end'] / fps + 0.5) * SR)
    sfx = np.zeros(n + 3 * SR); warn = []
    prev = {}
    rep = []
    for i, c in enumerate(C['cues']):
        kind = c['kind'] if c['kind'] in KINDS else 'click'
        if kind != c['kind']: warn.append(c['kind'])
        s_seed = seed * 1000 + sum(ord(ch) * 31 ** k for k, ch in enumerate(kind)) % 997 + c.get('v', i) * 7919  # stable (no hash())
        last = C['cues'][i - 1] if i else None
        if last and last['kind'] == c['kind'] and last.get('v') == c.get('v'):
            rep.append(c['f'])
        y = make(kind, abs(s_seed) % (2 ** 31)) * db(min(-3.0, -6 + c.get('gain', 0)))
        s = int(c['f'] / fps * SR)
        put(sfx, s, y)
    sfx = sfx[:n]
    write_wav(os.path.join(proj, 'work', 'sfx.wav'), sfx)
    amb = np.zeros(n)
    for j, r in enumerate(C.get('ambience', [])):
        a0, a1 = int(r['from'] / fps * SR), min(n, int((r['to'] / fps + 0.5) * SR))
        if a1 <= a0: continue
        seg = norm_rms(ambience(r['kind'], a1 - a0, seed + j), -30 + r.get('gain', 0))
        x = int(0.5 * SR)
        if len(seg) > 2 * x:
            seg[:x] *= np.linspace(0, 1, x) if a0 > 0 else 1; seg[-x:] *= np.linspace(1, 0, x) if a1 < n else 1
        amb[a0:a1] += seg
    write_wav(os.path.join(proj, 'work', 'ambience.wav'), amb)
    print(f'{os.path.join(proj, "work", "sfx.wav")}  {len(C["cues"])} cues, peak {20 * math.log10(np.abs(sfx).max() + 1e-9):.1f} dBFS')
    print(f'{os.path.join(proj, "work", "ambience.wav")}  {[r["kind"] for r in C.get("ambience", [])]}, RMS −30 dBFS')
    if '--music' in a:
        drop = int(a[a.index('--drop') + 1]) / fps if '--drop' in a else None
        m = norm_rms(music(n, bpm, mood, seed, drop), -20)
        write_wav(os.path.join(proj, 'work', 'music.wav'), m)
        print(f'{os.path.join(proj, "work", "music.wav")}  procedural bed {bpm:g} BPM {mood}' + (f', drop at f{int(drop * fps)}' if drop else ''))
    if warn:
        print(f'WARN unknown kinds rendered as click: {sorted(set(warn))}')
    print(f'SX3  repeats  {"FAIL" if rep else "PASS"}  ' + (f'same kind+variant back to back at frames {rep}' if rep else 'every cue has its own variant seed'))
    sys.exit(1 if rep else 0)


if __name__ == '__main__':
    main()
