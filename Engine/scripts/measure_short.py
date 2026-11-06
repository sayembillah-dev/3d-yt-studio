#!/usr/bin/env python3
"""
measure_short.py — turn a Short into NUMBERS (the guide's #1 tip: "ask Claude for numbers, not opinions").

Usage:
  python3 measure_short.py <video.mp4> <out_dir> [--no-voice]

Writes into <out_dir>:
  metrics.json      every number below (consumed by compare.py / build_reference_numbers.py)
  motion.csv        per-frame motion (mean abs diff, 90x160 gray) + beat flags
  sheet_XX.jpg      contact sheets at 2 fps (timestamped) — LOOK at these
  strip_XX.jpg      16-frame strips around the fastest camera moves
  words.json        word timings (whisper) unless --no-voice

Metrics (all deterministic, no opinions):
  duration_s, fps
  motion: p50/p90 per-frame diff, % frames "moving" (diff > MOVE_THR), longest hold (s) with diff < HOLD_THR
  beats: hard cuts (diff spike + low correlation) + camera-move onsets (motion peaks separated >= 0.4 s)
         -> beats_per_s, median beat gap (s), first beat (s), beats in 0-3 s, max gap (s)
  dissolves: windows where the frame is a blend of before/after (cross-fade detector) -> count, median length (frames)
  colour: per-second mean saturation / value (HSV, 0-1), act hue (dominant hue per 10 s)
  captions: estimated caption cap height (px at long side 1920, any render size) from the bright-white text band
  audio: integrated LUFS, LRA, true peak (ffmpeg ebur128)
  voice: wps, wps in first 3 s, pauses > 0.33 s, position of "you see" (% of runtime)
"""
import json, os, subprocess, sys, math, shutil
import numpy as np
import cv2

MOVE_THR = 10.0      # mean abs diff (0-255) at 90x160 → "the frame is moving"   (guide value)
HOLD_THR = 1.2       # below this a frame is "held" (no camera / no character motion)
CUT_THR = 38.0       # diff spike for a hard cut candidate
CUT_CORR = 0.55      # histogram correlation below this confirms a hard cut
HERE = os.path.dirname(os.path.abspath(__file__))
WHISPER_MODEL = os.environ.get('WHISPER_MODEL', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models', 'ggml-small.en.bin'))


def pct(a, p):
    return float(np.percentile(a, p)) if len(a) else None


def read_frames(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    small, hsv_s, hsv_v, hue, full_keep = [], [], [], [], {}
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(fr, (90, 160), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
        small.append(g)
        hs = cv2.cvtColor(cv2.resize(fr, (108, 192), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2HSV)
        hsv_s.append(hs[..., 1].mean() / 255.0)
        hsv_v.append(hs[..., 2].mean() / 255.0)
        # dominant hue of saturated pixels
        m = hs[..., 1] > 80
        hue.append(float(np.median(hs[..., 0][m]) * 2) if m.sum() > 50 else -1.0)
        full_keep[i] = None
        i += 1
    cap.release()
    return fps, np.stack(small), np.array(hsv_s), np.array(hsv_v), np.array(hue)


def motion_series(small):
    d = np.zeros(len(small))
    d[1:] = np.abs(small[1:] - small[:-1]).mean(axis=(1, 2))
    return d


def hist_corr(a, b):
    ha = cv2.calcHist([a.astype(np.uint8)], [0], None, [32], [0, 256])
    hb = cv2.calcHist([b.astype(np.uint8)], [0], None, [32], [0, 256])
    return float(cv2.compareHist(ha, hb, cv2.HISTCMP_CORREL))


def detect_cuts(small, d):
    cuts = []
    for i in range(1, len(small)):
        if d[i] > CUT_THR and d[i] > 2.5 * max(np.median(d[max(0, i - 5):i]) if i > 1 else 0, 1) and hist_corr(small[i - 1], small[i]) < CUT_CORR:
            cuts.append(i)
    return cuts


def detect_dissolves(small, d, fps, cuts):
    """A dissolve: over L frames (4..16) frame k ≈ (1-a)·A + a·B with A=frame[s], B=frame[s+L], A and B very different.
    Residual of the best linear blend must be much lower than the A-B difference."""
    out = []
    n = len(small)
    i = 0
    while i < n - 18:
        found = None
        for L in (6, 7, 8, 10, 12, 14, 16):
            j = i + L
            if j >= n:
                break
            A, B = small[i], small[j]
            ab = np.abs(A - B).mean()
            if ab < 18:
                continue
            mid = small[i + L // 2]
            denom = ((B - A) ** 2).sum()
            a = float(((mid - A) * (B - A)).sum() / denom) if denom > 0 else 0
            if not (0.25 < a < 0.75):
                continue
            res = np.abs(mid - (A + a * (B - A))).mean()
            # monotone ramp across the window and no single-frame spike (that would be a cut)
            seg = d[i + 1:j + 1]
            if res < 0.35 * ab and seg.max() < 0.6 * seg.sum() and not any(i < c <= j for c in cuts):
                # refine: blend coefficient per frame; the dissolve is where it ramps 0.08 -> 0.92
                al = [float(((small[k] - A) * (B - A)).sum() / denom) for k in range(i, j + 1)]
                ks = [k for k, x in enumerate(al) if 0.08 < x < 0.92]
                if len(ks) >= 2:
                    s0, s1 = ks[0], ks[-1]
                    found = (i + s0, s1 - s0 + 2, round(res / ab, 3))
                    break
        if found:
            out.append({'start_f': int(found[0]), 'len_f': int(found[1]), 'resid': float(found[2])})
            i += found[1] + 4
        else:
            i += 1
    return out


def detect_beats(d, fps, cuts):
    """Beats = hard cuts + onsets of camera moves (local motion peaks above MOVE_THR, >= 0.4 s apart)."""
    sm = np.convolve(d, np.ones(5) / 5, mode='same')
    peaks = []
    min_gap = int(0.4 * fps)
    for i in range(2, len(sm) - 2):
        if sm[i] >= MOVE_THR and sm[i] == sm[max(0, i - min_gap):i + min_gap + 1].max():
            if not peaks or i - peaks[-1] >= min_gap:
                peaks.append(i)
    beats = sorted(set(peaks) | set(cuts))
    merged = []
    for b in beats:
        if not merged or b - merged[-1] >= min_gap:
            merged.append(b)
    return merged, sm


def longest_run(mask):
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0
        best = max(best, cur)
    return best


def caption_cap_height(path, fps, n_samples=24):
    """Estimate caption glyph height: bright (V>235, S<40) pixels with dark neighbours in the lower 55% band."""
    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    hs = []
    for k in range(n_samples):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((k + 0.5) * total / n_samples))
        ok, fr = cap.read()
        if not ok:
            continue
        H, W = fr.shape[:2]
        band = fr[int(H * 0.45):int(H * 0.92)]
        hsv = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
        white = ((hsv[..., 2] > 235) & (hsv[..., 1] < 40)).astype(np.uint8)
        dark = (hsv[..., 2] < 60).astype(np.uint8)
        dark_near = cv2.dilate(dark, np.ones((9, 9), np.uint8))
        txt = white & dark_near
        rows = txt.sum(axis=1)
        on = rows > W * 0.02
        if on.sum() < 10:
            continue
        # largest contiguous run of text rows
        best, cur, = 0, 0
        for r in on:
            cur = cur + 1 if r else 0
            best = max(best, cur)
        hs.append(best * 1920.0 / max(H, W))   # px at full size (long side 1920, refs' size): previews read the same
    cap.release()
    return round(pct(hs, 50), 1) if hs else None


def ebur128(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    t = r.stderr
    def grab(key):
        import re
        m = re.findall(key + r'\s*:\s*(-?[\d.]+)', t)
        return float(m[-1]) if m else None
    return {'lufs_i': grab('I'), 'lra': grab('LRA'), 'true_peak_dbtp': grab('Peak')}


def _label(img, text):
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 8 * len(text) + 6, 16], fill=(0, 0, 0))
    d.text((3, 2), text, fill=(255, 230, 0))
    return img


def _grab(path, frames, w):
    """Return PIL images for the requested frame indices (sequential read; cheap)."""
    from PIL import Image
    want = sorted(set(frames)); out = {}
    cap = cv2.VideoCapture(path); i = 0; k = 0
    while k < len(want):
        ok, fr = cap.read()
        if not ok:
            break
        if i == want[k]:
            h = int(fr.shape[0] * w / fr.shape[1])
            out[i] = Image.fromarray(cv2.cvtColor(cv2.resize(fr, (w, h), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB))
            k += 1
        i += 1
    cap.release()
    return out


def _tile(imgs, cols):
    from PIL import Image
    w, h = imgs[0].size
    rows = math.ceil(len(imgs) / cols)
    sheet = Image.new('RGB', (cols * w, rows * h), (20, 20, 20))
    for j, im in enumerate(imgs):
        sheet.paste(im, ((j % cols) * w, (j // cols) * h))
    return sheet


def contact_sheets(path, out_dir, fps, n, per_sheet=40, cols=10, rate=2.0):
    """2 fps contact sheets, each cell labelled with t(s) and frame number."""
    frames = [int(round(k * fps / rate)) for k in range(int(n / fps * rate)) if int(round(k * fps / rate)) < n]
    imgs = _grab(path, frames, 180)
    cells = [_label(imgs[f], f'{f / fps:.1f}s f{f}') for f in frames if f in imgs]
    for s in range(0, len(cells), per_sheet):
        _tile(cells[s:s + per_sheet], cols).save(os.path.join(out_dir, f'sheet_{s // per_sheet:02d}.jpg'), quality=85)


def strips(path, out_dir, centers, fps, n, length=16, prefix='strip'):
    """16 consecutive frames around each centre frame: shows how a move/dissolve/pose change is actually built."""
    want = [f for c in centers for f in range(max(0, c - length // 2), min(n, c - length // 2 + length))]
    imgs = _grab(path, want, 135)
    for k, c in enumerate(centers):
        fs = [f for f in range(max(0, c - length // 2), min(n, c - length // 2 + length)) if f in imgs]
        if fs:
            _tile([_label(imgs[f], f'f{f}') for f in fs], length).save(os.path.join(out_dir, f'{prefix}_{k:02d}_f{c}.jpg'), quality=85)


def voice(path, out_dir, dur):
    words_path = os.path.join(out_dir, 'words.json')
    r = subprocess.run([sys.executable, os.path.join(HERE, 'transcribe.py'), path, words_path, '--model', WHISPER_MODEL], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(words_path):
        return {'error': r.stderr[-400:]}
    words = json.load(open(words_path))
    if isinstance(words, dict):
        words = words.get('words', [])
    if not words:
        return {}
    first3 = [w for w in words if w['s'] < 3.0]
    span = words[-1]['e'] - words[0]['s']
    gaps = [words[i + 1]['s'] - words[i]['e'] for i in range(len(words) - 1)]
    low = [w['w'].lower().strip('.,!?"\'') for w in words]
    sees = [round(100 * words[i]['s'] / dur, 1) for i in range(len(low) - 1) if low[i] == 'you' and low[i + 1].startswith('see')]
    see = sees[-1] if sees else None   # the LAST "you see" is the reveal pivot
    return {
        'words': len(words), 'wps': round(len(words) / span, 3) if span > 0 else None,
        'wps_first3s': round(len(first3) / max(0.5, min(3.0, first3[-1]['e']) - words[0]['s']), 3) if first3 else None,
        'first_word_s': round(words[0]['s'], 3),
        'pauses_over_0.33s': sum(1 for g in gaps if g > 0.33),
        'longest_pause_s': round(max(gaps), 3) if gaps else 0,
        'you_see_pct': see, 'you_see_all_pct': sees,
        'text': ' '.join(w['w'] for w in words),
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    fps, small, sat, val, hue = read_frames(path)
    n = len(small)
    dur = n / fps
    d = motion_series(small)
    cuts = detect_cuts(small, d)
    dis = detect_dissolves(small, d, fps, cuts)
    beats, sm = detect_beats(d, fps, cuts)
    # a dissolve IS a framing change: add its midpoint as a beat (merge with nearby move peaks)
    for x in dis:
        mid = x['start_f'] + x['len_f'] // 2
        if all(abs(mid - b) >= int(0.4 * fps) for b in beats):
            beats.append(mid)
    beats.sort()
    gaps = np.diff([0] + beats) / fps if beats else np.array([])
    beat_gaps = np.diff(beats) / fps if len(beats) > 1 else np.array([])
    held = longest_run(sm < HOLD_THR) / fps
    # per-second colour
    per_s = [(float(sat[int(i * fps):int((i + 1) * fps)].mean()), float(val[int(i * fps):int((i + 1) * fps)].mean())) for i in range(int(dur))]
    acts = []
    for a in range(0, int(dur), 10):
        h = hue[int(a * fps):int((a + 10) * fps)]
        h = h[h >= 0]
        acts.append(round(float(np.median(h)), 1) if len(h) else None)
    top = sorted(range(n), key=lambda i: -sm[i])
    fastest = []
    for i in top:
        if all(abs(i - j) > fps for j in fastest):
            fastest.append(i)
        if len(fastest) >= 6:
            break

    m = {
        'file': os.path.basename(path), 'fps': fps, 'frames': n, 'duration_s': round(dur, 3),
        'motion': {
            'diff_p50': round(pct(d, 50), 3), 'diff_p90': round(pct(d, 90), 3), 'diff_max': round(float(d.max()), 3),
            'pct_frames_moving': round(100 * float((sm >= MOVE_THR).mean()), 2),
            'pct_frames_held': round(100 * float((sm < HOLD_THR).mean()), 2),
            'longest_hold_s': round(held, 3),
        },
        'cuts': {'count': len(cuts), 'frames': [int(c) for c in cuts]},
        'dissolves': {'count': len(dis), 'median_len_f': pct([x['len_f'] for x in dis], 50), 'items': dis},
        'beats': {
            'count': len(beats), 'per_s': round(len(beats) / dur, 3),
            'median_gap_s': round(pct(beat_gaps, 50), 3) if len(beat_gaps) else None,
            'p90_gap_s': round(pct(beat_gaps, 90), 3) if len(beat_gaps) else None,
            'max_gap_s': round(float(np.max(gaps)), 3) if len(gaps) else None,
            'first_s': round(beats[0] / fps, 3) if beats else None,
            'in_first_3s': sum(1 for b in beats if b < 3 * fps),
            'frames': [int(b) for b in beats],
        },
        'colour': {
            'sat_mean': round(float(sat.mean()), 3), 'val_mean': round(float(val.mean()), 3),
            'sat_p10': round(pct(sat, 10), 3), 'sat_p90': round(pct(sat, 90), 3),
            'act_hue_deg_per_10s': acts,
        },
        'captions': {'cap_height_px_est': caption_cap_height(path, fps)},
        'audio': ebur128(path),
    }
    if '--no-voice' not in sys.argv:
        m['voice'] = voice(path, out_dir, dur)

    with open(os.path.join(out_dir, 'motion.csv'), 'w') as f:
        f.write('frame,t,diff,smooth,beat,cut\n')
        bs, cs = set(beats), set(cuts)
        for i in range(n):
            f.write(f'{i},{i / fps:.3f},{d[i]:.3f},{sm[i]:.3f},{int(i in bs)},{int(i in cs)}\n')
    json.dump(m, open(os.path.join(out_dir, 'metrics.json'), 'w'), indent=1, default=float)
    contact_sheets(path, out_dir, fps, n)
    strips(path, out_dir, sorted(fastest), fps, n)
    if dis:
        strips(path, out_dir, [x['start_f'] + x['len_f'] // 2 for x in dis[:6]], fps, n, prefix='dissolve')
    summary = {k: m[k] for k in ('duration_s',)}
    summary.update({'beats_per_s': m['beats']['per_s'], 'median_beat_gap_s': m['beats']['median_gap_s'], 'first_beat_s': m['beats']['first_s'],
                    'beats_0_3s': m['beats']['in_first_3s'], 'cuts': len(cuts), 'dissolves': len(dis), 'dissolve_len_f': m['dissolves']['median_len_f'],
                    'longest_hold_s': m['motion']['longest_hold_s'], 'pct_moving': m['motion']['pct_frames_moving'],
                    'sat': m['colour']['sat_mean'], 'val': m['colour']['val_mean'], 'lufs': m['audio']['lufs_i'], 'tp': m['audio']['true_peak_dbtp'],
                    'cap_px': m['captions']['cap_height_px_est']})
    if 'voice' in m:
        summary.update({k: m['voice'].get(k) for k in ('wps', 'wps_first3s', 'pauses_over_0.33s', 'longest_pause_s', 'you_see_pct')})
    print(json.dumps(summary, indent=1, default=float))


if __name__ == '__main__':
    main()
