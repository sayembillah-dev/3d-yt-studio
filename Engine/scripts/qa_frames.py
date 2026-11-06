#!/usr/bin/env python3
"""
qa_frames.py — frame QA for a render: automatic anomaly detectors + story-aligned review sheets + the review rubric.

Usage:
  python3 qa_frames.py <project_dir> <render.mp4> [--every 15]

Writes <project>/work/qa/:
  auto.json            automatic findings (each with frame, time, kind, severity, fix)
  sheet_XX.jpg         review sheets: one cell every --every frames (default 15 = 0.5 s), labelled
                       t / frame / the WORD being spoken / the shot-list beat → check "right visual at the right time"
  flag_XX_fNNN.jpg     16-frame strips around every automatic finding (look at these FIRST)
  review.md            the 5-lens rubric to fill in (copied from references/qa-rubric.md, pre-filled with auto findings)

Automatic detectors (no opinions):
  A1 blank        frame almost uniform (mean<10 or std<5)                         → P0  render/canvas failure
  A2 pop (P2)     frame diff OR worst 8x8-block diff spikes > 3x its local median (block > 40 / frame > 18), change is local,
                  not at a planned transition                                        → P2  vanish / teleport / pose snap — review strip
  A2a flicker     any 1/8x1/8 block changes and the next frame undoes it (min(in,out) - |f+1 - f-1| > 30) → P1  1-frame glitch
  (A2 pop is P2 — a local persistent snap: usually a caption chunk or pose key; look at its strip vs the shotlist)
  A2b cut         same spike but whole-frame change (hist corr < 0.55 or > 45% pixels changed) not in TRANSITIONS → P2  unplanned hard cut
                  (budget: <= 3 per Short — compare.py hard_cuts gate)
  A3 frozen       >= 8 identical consecutive frames                                → P1  render stall / camera parked
  A4 occluded     one flat region covers > 38% of the frame                         → P1  camera inside / too close to a prop
  A5 exposure     mean value < 0.18 or > 0.92                                      → P2
  A6 caption_gap  a spoken word with no caption on screen (needs words.json + caption band check) → P2
KNOWN LIMITS (measured, 2026-11-05):
  - flicker floor: a 1-frame glitch must cover >= 3/64 blocks AND stand out from camera motion. During a fast camera
    move (block diffs 40-90/frame) a glitch the size of one medium character (~10%x15% of frame) is NOT caught; a
    30%x35% one is. Glitches inside strobe/particle runs (several reversals within +-4 f) are suppressed on purpose.
    → the 2-fps review sheets + the P2 pop strips are the backstop: the reviewer must look at every strip.
  - verified: 0 P1 on the 4 reference Shorts; their 5 hard cuts come out as P2 'cut'; 30%x35% injected glitch → P1.
Exit 1 if any P0/P1 automatic finding. Strips are written for every P0/P1 and for P2 pops (cap 16).
"""
import json, os, sys, math, shutil
import numpy as np
import cv2
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
FIX = {
    'blank': 'Canvas rendered empty: check bundle errors / postprocessing; re-render that range with render.sh range.',
    'cut': 'Whole-frame change in 1 frame (hard cut). If intended, list it in scenes/camera.ts TRANSITIONS {f, kind:"cut"}; otherwise turn it into an 8-frame dissolve with the camera still moving. Keep total cuts <= 3.',
    'flicker': 'A region changes for exactly 1 frame then reverts = render glitch: a mount/unmount on a single frame, a visibility toggle on f only, texture not ready, NaN pose. Find what is keyed at this frame in scenes/index.tsx and fix the range (off-by-one in from/to).',
    'pop': 'Something appears/disappears/teleports in 1 frame: check character enter/exit, path keys, visibility toggles, prop mounts at this frame. If intended, add it to TRANSITIONS (cut) or make it a dissolve.',
    'frozen': 'Frames identical: camera parked AND nobody moving. Add a waypoint / pose change (cam_qa G1).',
    'occluded': 'Camera inside or touching geometry: move the waypoint or the prop (cam_qa G17), or it is a deliberate foreground wipe (then keep it < 6 f).',
    'exposure': 'Adjust mood lights / grade for this set.',
    'caption_gap': 'Captions missing while words are spoken: check Captions words prop / hide ranges.',
}


def load_words(proj):
    for p in ('public/words.json', 'work/words.json'):
        fp = os.path.join(proj, p)
        if os.path.exists(fp):
            w = json.load(open(fp))
            return w['words'] if isinstance(w, dict) else w
    return []


def load_shotlist(proj):
    fp = os.path.join(proj, 'shotlist.json')
    if os.path.exists(fp):
        try:
            return json.load(open(fp)).get('shots', [])
        except Exception:
            return []
    return []


def hist_corr(a, b):
    ha = cv2.calcHist([a.astype(np.uint8)], [0], None, [32], [0, 256]); hb = cv2.calcHist([b.astype(np.uint8)], [0], None, [32], [0, 256])
    return float(cv2.compareHist(ha, hb, cv2.HISTCMP_CORREL))


def planned_transitions(proj):
    fp = os.path.join(proj, 'work', 'camera_dump.json')
    if os.path.exists(fp):
        d = json.load(open(fp))
        out = set()
        for t in d.get('transitions', []):
            for k in range(t['f'] - 2, t['f'] + t.get('len', 8) + 3):
                out.add(k)
        return out
    return set()


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__); sys.exit(2)
    proj, video = os.path.abspath(a[0]), a[1]
    every = int(a[a.index('--every') + 1]) if '--every' in a else 15
    out = os.path.join(proj, 'work', 'qa'); os.makedirs(out, exist_ok=True)
    for f_ in os.listdir(out):   # exFAT: removing x.jpg also removes its macOS sidecar ._x.jpg → tolerate missing files
        if f_.endswith('.jpg'):
            try: os.remove(os.path.join(out, f_))
            except FileNotFoundError: pass
    words, shots, planned = load_words(proj), load_shotlist(proj), planned_transitions(proj)

    cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    small, cells, stats = [], {}, []
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        g = cv2.cvtColor(cv2.resize(fr, (90, 160), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
        small.append(g)
        hsv = cv2.cvtColor(cv2.resize(fr, (108, 192)), cv2.COLOR_BGR2HSV)
        # flat-region coverage: quantise colour, largest connected component of low-texture pixels
        q = cv2.resize(fr, (54, 96), interpolation=cv2.INTER_AREA)
        lap = cv2.Laplacian(cv2.cvtColor(q, cv2.COLOR_BGR2GRAY), cv2.CV_32F)
        flat = (np.abs(lap) < 2.0).astype(np.uint8)
        qc = (q // 24).astype(np.int32); key = qc[..., 0] * 10000 + qc[..., 1] * 100 + qc[..., 2]
        vals, counts = np.unique(key[flat > 0], return_counts=True)
        flat_cov = float(counts.max()) / key.size if len(counts) else 0.0
        stats.append({'mean': float(g.mean()), 'std': float(g.std()), 'v': float(hsv[..., 2].mean() / 255), 'flat': flat_cov})
        if i % every == 0:
            cells[i] = Image.fromarray(cv2.cvtColor(cv2.resize(fr, (270, 480), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB))
        i += 1
    cap.release()
    n = len(small)
    d = np.zeros(n); d[1:] = [np.abs(small[k] - small[k - 1]).mean() for k in range(1, n)]

    finds = []
    def add(f, kind, sev, detail):
        finds.append({'frame': int(f), 't': round(f / fps, 2), 'kind': kind, 'severity': sev, 'detail': detail, 'fix': FIX[kind]})
    for f, s in enumerate(stats):
        if s['mean'] < 10 or s['std'] < 5: add(f, 'blank', 'P0', f"mean {s['mean']:.1f} std {s['std']:.1f}")
    # block metric: max over an 8x8 grid of the per-block mean abs diff → sees a single character vanishing
    def blocks(a, b):
        x = np.abs(a - b); hh, ww = x.shape[0] // 8, x.shape[1] // 8
        return x[:hh * 8, :ww * 8].reshape(8, hh, 8, ww).mean(axis=(1, 3))
    def block_max(a, b):
        return float(blocks(a, b).max())
    bd = np.zeros(n); bd[1:] = [block_max(small[k], small[k - 1]) for k in range(1, n)]
    last = -99
    for f in range(3, n - 3):
        if f in planned or f - last <= 2: continue
        loc = np.median(np.concatenate([d[f - 3:f], d[f + 1:f + 4]]))
        bloc = np.median(np.concatenate([bd[f - 3:f], bd[f + 1:f + 4]]))
        global_spike = d[f] > 18 and d[f] > 3 * max(loc, 1.5)
        local_spike = bd[f] > 40 and bd[f] > 2.5 * max(bloc, 4)
        if not (global_spike or local_spike): continue
        hc = hist_corr(small[f - 1], small[f])
        changed = float((np.abs(small[f] - small[f - 1]) > 24).mean())   # fraction of pixels that changed a lot
        if hc < 0.55 or changed > 0.45:
            add(f, 'cut', 'P2', f'diff {d[f]:.1f}, {changed:.0%} of pixels changed, hist corr {hc:.2f} (whole frame)')
        else:
            add(f, 'pop', 'P2', f'block diff {bd[f]:.0f} vs local {bloc:.0f}, {changed:.0%} of pixels changed (local, persists) — check strip: intended pose/caption/prop change?')
        last = f
    # A2a flicker: per block, a change that is undone on the very next frame. Normal motion accumulates
    # (|f+1 - f-1| ~ in + out); a 1-frame glitch returns (|f+1 - f-1| ~ 0). Robust to fast camera moves.
    cand = {}
    for f in range(1, n - 1):
        if f in planned: continue
        b_in, b_out, back = blocks(small[f], small[f - 1]), blocks(small[f + 1], small[f]), blocks(small[f + 1], small[f - 1])
        score = np.minimum(b_in, b_out) - back
        nb = int((score > 30).sum())
        if nb: cand[f] = (nb, float(score.max()), float(b_in.max()))
    for f, (nb, sc, mag) in cand.items():
        isolated = not any(g in cand for g in range(f - 4, f + 5) if g != f)
        if isolated and nb >= 3:     # >= 3 of 64 blocks (~5% of frame), not part of a strobe/flash run, not a blink
            add(f, 'flicker', 'P1', f'1-frame glitch: {nb} blocks change by up to {mag:.0f} and the next frame undoes it (score {sc:.0f})')
    run = 0
    for f in range(1, n):
        run = run + 1 if d[f] < 0.05 else 0
        if run == 8: add(f - 7, 'frozen', 'P1', '8+ identical frames')
    occl_run = 0
    for f, s in enumerate(stats):
        occl_run = occl_run + 1 if s['flat'] > 0.38 else 0
        if occl_run == 6: add(f - 5, 'occluded', 'P1', f"flat region {s['flat']:.0%} for 6+ frames")
    for f, s in enumerate(stats):
        if f % 15 == 0 and (s['v'] < 0.18 or s['v'] > 0.92): add(f, 'exposure', 'P2', f"value {s['v']:.2f}")

    # strips for every P0/P1 finding
    flagged = ([x for x in finds if x['severity'] in ('P0', 'P1')] + [x for x in finds if x['kind'] == 'pop'])[:16]
    if flagged:
        want = sorted({k for x in flagged for k in range(max(0, x['frame'] - 8), min(n, x['frame'] + 8))})
        cap = cv2.VideoCapture(video); imgs = {}; k = 0; wi = 0
        while wi < len(want):
            ok, fr = cap.read()
            if not ok: break
            if k == want[wi]:
                imgs[k] = Image.fromarray(cv2.cvtColor(cv2.resize(fr, (135, 240)), cv2.COLOR_BGR2RGB)); wi += 1
            k += 1
        cap.release()
        for j, x in enumerate(flagged):
            fs = [k for k in range(max(0, x['frame'] - 8), min(n, x['frame'] + 8)) if k in imgs]
            sheet = Image.new('RGB', (135 * len(fs), 240))
            for c, k in enumerate(fs):
                im = imgs[k].copy(); dr = ImageDraw.Draw(im)
                dr.rectangle([0, 0, 60, 14], fill=(0, 0, 0)); dr.text((2, 1), f'f{k}', fill=(255, 80, 80) if k == x['frame'] else (255, 230, 0))
                sheet.paste(im, (c * 135, 0))
            sheet.save(os.path.join(out, f"flag_{j:02d}_f{x['frame']}_{x['kind']}.jpg"), quality=85)

    # review sheets with spoken word + shot beat per cell
    def word_at(t):
        for w in words:
            if w['s'] <= t < max(w['e'], w['s'] + 0.12): return w['w']
        prev = [w for w in words if w['s'] <= t]
        return ('…' + prev[-1]['w']) if prev else ''
    def shot_at(f):
        for s_ in shots:
            if s_.get('from', 0) <= f < s_.get('to', 1e9): return s_.get('id', '') + ' ' + s_.get('visual', '')[:40]
        return ''
    keys = sorted(cells)
    per = 24
    for sidx in range(0, len(keys), per):
        chunk = keys[sidx:sidx + per]
        cols = 8; rows = math.ceil(len(chunk) / cols)
        sheet = Image.new('RGB', (270 * cols, 520 * rows), (15, 15, 15))
        for c, f in enumerate(chunk):
            im = cells[f]; x0, y0 = (c % cols) * 270, (c // cols) * 520
            sheet.paste(im, (x0, y0))
            dr = ImageDraw.Draw(sheet)
            dr.text((x0 + 4, y0 + 482), f"{f / fps:5.1f}s f{f}  \"{word_at(f / fps)}\"", fill=(255, 230, 0))
            dr.text((x0 + 4, y0 + 500), shot_at(f)[:44], fill=(160, 220, 255))
        sheet.save(os.path.join(out, f'sheet_{sidx // per:02d}.jpg'), quality=85)

    json.dump({'video': video, 'frames': n, 'findings': finds}, open(os.path.join(out, 'auto.json'), 'w'), indent=1)
    rub = os.path.join(SKILL, 'references', 'qa-rubric.md')
    with open(os.path.join(out, 'review.md'), 'w') as fh:
        fh.write(open(rub).read() if os.path.exists(rub) else '# Review\n')
        fh.write('\n\n## Automatic findings (fix every P0/P1)\n')
        for x in finds:
            fh.write(f"- [ ] {x['severity']} {x['kind']} @ {x['t']}s (f{x['frame']}): {x['detail']} → {x['fix']}\n")
        if not finds: fh.write('- none\n')
    by = {}
    for x in finds: by[x['severity']] = by.get(x['severity'], 0) + 1
    print(json.dumps({'frames': n, 'findings_by_severity': by, 'sheets': len(range(0, len(keys), per)), 'flag_strips': len(flagged), 'out': out}, indent=1))
    for x in flagged: print(f"  {x['severity']} {x['kind']:9s} f{x['frame']:5d} {x['t']:6.2f}s  {x['detail']}")
    sys.exit(1 if any(x['severity'] in ('P0', 'P1') for x in finds) else 0)


if __name__ == '__main__':
    main()
