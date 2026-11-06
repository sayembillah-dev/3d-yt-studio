#!/usr/bin/env python3
"""
thumbnail.py — Phase 11: the thumbnail (style-bible §9.3: hero object + main character with strong emotion, the most
saturated moment, ≤ 3 words of text).

Usage:
  python3 thumbnail.py <project_dir> --suggest [--video <mp4>]
        → scores every 5th frame (saturation, sharpness, not mid-transition) → top 6 candidates with the spoken word,
          contact sheet work/thumb_candidates.jpg (LOOK at it, pick F)
  python3 thumbnail.py <project_dir> --frame F --text "≤3 WORDS" [--comp Main] [--zoom 1.0] [--focus 0.5,0.45]
                       [--text-y top|bottom] [--font <ttf>] [--from-video <mp4>]
        → output/thumbnail.png (Short 1080×1920 · long-form 1280×720, from project.json type)
          + work/thumbnail_preview.jpg (full size next to the 10 % phone-feed size, upscaled) — READ it.
  The frame is re-rendered as a clean still WITHOUT captions (render.sh with SW_PROPS={"noCaptions":true});
  --from-video grabs it from a video instead (captions included — only for quick tests).
Text: uppercase, white, heavy plum stroke (#2A1B26), last word yellow (#FFD23F); Arial Black (closest local
  match to Archivo Black) unless --font. --zoom crops around --focus (x,y as 0–1 fractions) to push in on the face/object.

Checks: TH1 text  ≤ 3 words (HARD)
        TH2 small_read  at 10 % size: mean saturation ≥ 0.40 and luminance contrast (std) ≥ 0.17 (WARN — numbers are a
                        proxy; the gate is YOU reading thumbnail_preview.jpg: hero object + face readable at 10 %).
Exit 1 if TH1 fails or the frame cannot be produced.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
INK = (42, 27, 38)
FONTS = ['/System/Library/Fonts/Supplemental/Arial Black.ttf', '/Library/Fonts/Arial Black.ttf',
         '/System/Library/Fonts/Supplemental/Impact.ttf', '/usr/share/fonts/truetype/msttcorefonts/Arial_Black.ttf']


def arg(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


def proj_info(proj):
    pj = os.path.join(proj, 'project.json')
    d = json.load(open(pj)) if os.path.exists(pj) else {}
    comps = d.get('compositions') or []
    if not comps:   # no project.json (e.g. examples/00_gate): read the composition ids from scenes/index.tsx
        import re
        ix = os.path.join(proj, 'scenes', 'index.tsx')
        if os.path.exists(ix):
            comps = re.findall(r"id:\s*['\"]([A-Za-z0-9_-]+)['\"]\s*,\s*component", open(ix).read())
    return d.get('type', 'short'), comps


def find_video(proj, comps):
    for p in [os.path.join(proj, 'output', 'final.mp4')] + [os.path.join(proj, 'work', f'{c}.mp4') for c in comps + ['Main', 'Gate']]:
        if os.path.exists(p):
            return p
    return None


def read_frames(video, step=5):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video], capture_output=True, text=True)
    w, h = map(int, r.stdout.strip().split(','))
    sw, sh = 180, int(180 * h / w)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'scale={sw}:{sh}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, sh, sw, 3)
    return fr, step


def sat_val(img):
    import cv2
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    return hsv[..., 1].mean() / 255, hsv[..., 2].mean() / 255


def suggest(proj, video):
    import cv2
    fr, step = read_frames(video)
    wp = os.path.join(proj, 'public', 'words.json')
    words = json.load(open(wp)) if os.path.exists(wp) else []
    words = words['words'] if isinstance(words, dict) else words
    word_at = lambda f: next((w['w'] for w in words if w['s'] <= f / 30 < max(w['e'], w['s'] + 0.15)), '')
    scores = []
    for f in range(0, len(fr), step):
        im = fr[f]; s, v = sat_val(im)
        sharp = cv2.Laplacian(cv2.cvtColor(im, cv2.COLOR_RGB2GRAY), cv2.CV_64F).var()
        motion = np.abs(fr[f].astype(int) - fr[max(0, f - 1)].astype(int)).mean() if f else 0
        scores.append((f, s, v, sharp, motion))
    sh = np.array([x[3] for x in scores]); sh = (sh - sh.min()) / (np.ptp(sh) + 1e-9)
    ranked = sorted(((0.55 * x[1] / 0.6 + 0.35 * sh[i] + 0.1 * min(x[2], 0.7) - 0.02 * x[4], x) for i, x in enumerate(scores)), reverse=True)
    pick, used = [], []
    for sc, x in ranked:
        if all(abs(x[0] - u) >= 45 for u in used):
            pick.append((sc, x)); used.append(x[0])
        if len(pick) == 6: break
    print('TOP THUMBNAIL CANDIDATES (frame, time, word, saturation, value, sharpness):')
    tiles = []
    for sc, (f, s, v, shp, m) in pick:
        print(f'  F={f:5d}  {f / 30:6.2f}s  "{word_at(f)}"  sat {s:.2f}  val {v:.2f}  sharp {shp:.0f}  score {sc:.2f}')
        t = Image.fromarray(fr[f]).resize((270, int(270 * fr.shape[1] / fr.shape[2])))
        ImageDraw.Draw(t).text((6, 6), f'F{f}', fill=(255, 230, 0)); tiles.append(t)
    sheet = Image.new('RGB', (270 * len(tiles), tiles[0].height), (20, 20, 20))
    for i, t in enumerate(tiles): sheet.paste(t, (270 * i, 0))
    out = os.path.join(proj, 'work', 'thumb_candidates.jpg'); sheet.save(out, quality=88)
    print(f'contact sheet: {out}\nPick the frame with the hero object + main character + strongest emotion, then run --frame F --text "…".')


def fit_font(draw, text, font_path, max_w, max_h):
    size = 220
    while size > 30:
        f = ImageFont.truetype(font_path, size)
        bb = draw.multiline_textbbox((0, 0), text, font=f, stroke_width=max(4, size // 9), align='center', spacing=size // 8)
        if bb[2] - bb[0] <= max_w and bb[3] - bb[1] <= max_h:
            return f, size
        size -= 6
    return ImageFont.truetype(font_path, size), size


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2)
    proj = os.path.abspath(a[0]); typ, comps = proj_info(proj)
    if '--suggest' in a:
        v = arg(a, '--video') or find_video(proj, comps)
        if not v: print('ERROR: no video to scan (render first)'); sys.exit(2)
        suggest(proj, v); return
    if '--frame' not in a or '--text' not in a:
        print('ERROR: need --frame F and --text "WORDS" (or --suggest)'); sys.exit(2)
    F = int(arg(a, '--frame')); text = arg(a, '--text').strip().upper()
    comp = arg(a, '--comp') or (comps[0] if comps else 'Main')
    os.makedirs(os.path.join(proj, 'work'), exist_ok=True); os.makedirs(os.path.join(proj, 'output'), exist_ok=True)
    still = os.path.join(proj, 'work', f'still_{F}.png')
    if '--from-video' in a:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', arg(a, '--from-video'), '-vf', f'select=eq(n\\,{F})', '-vframes', '1', still], check=True)
        print('NOTE: frame grabbed from video — burned-in captions are included')
    else:
        env = dict(os.environ, SW_PROPS='{"noCaptions":true}')
        r = subprocess.run(['bash', os.path.join(HERE, 'render.sh'), proj, 'stills', comp, str(F)], env=env, capture_output=True, text=True)
        if r.returncode != 0 or 'FAILED' in r.stdout:
            print(r.stdout[-800:], r.stderr[-800:]); print('ERROR: still render failed'); sys.exit(1)
    im = Image.open(still).convert('RGB')
    W, H = (1080, 1920) if typ != 'long' else (1280, 720)
    zoom = float(arg(a, '--zoom', '1.0')); fx, fy = map(float, (arg(a, '--focus', '0.5,0.45')).split(','))
    if zoom > 1:
        cw, ch = im.width / zoom, im.height / zoom
        x0 = min(max(0, fx * im.width - cw / 2), im.width - cw); y0 = min(max(0, fy * im.height - ch / 2), im.height - ch)
        im = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch)))
    # cover-fit to the target size
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0, y0 = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x0, y0, x0 + W, y0 + H))
    im = ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(1.12)).enhance(1.05)
    words = text.split()
    res = [('TH1', 'text', len(words) <= 3, f'{len(words)} words: "{text}" (≤ 3)')]
    font_path = arg(a, '--font') or next((p for p in FONTS if os.path.exists(p)), None)
    if text and font_path:
        d = ImageDraw.Draw(im)
        lines = [text] if len(words) <= 1 or len(text) <= 12 else [' '.join(words[:-1]), words[-1]]
        f, size = fit_font(d, '\n'.join(lines), font_path, int(W * 0.88), int(H * (0.2 if typ != 'long' else 0.32)))
        sw = max(4, size // 9); gap = size // 8
        asc, desc = f.getmetrics(); lh = asc + desc
        y = int(H * 0.07) if arg(a, '--text-y', 'top') == 'top' else int(H * 0.72) - len(lines) * (lh + gap)
        for li, line in enumerate(lines):
            ws = line.split(' '); space = d.textlength(' ', font=f)
            x = (W - d.textlength(line, font=f)) / 2
            for wi, wd in enumerate(ws):
                last = li == len(lines) - 1 and wi == len(ws) - 1 and len(words) > 1
                d.text((x + 6, y + 10), wd, font=f, fill=(0, 0, 0), stroke_width=sw, stroke_fill=(0, 0, 0))          # drop shadow
                d.text((x, y), wd, font=f, fill=(255, 210, 63) if last else (255, 255, 255), stroke_width=sw, stroke_fill=INK)
                x += d.textlength(wd, font=f) + space
            y += lh + gap
    elif text:
        print('WARN: no heavy font found — pass --font <ttf>')
    out = os.path.join(proj, 'output', 'thumbnail.png'); im.save(out)
    small = im.resize((W // 10, H // 10), Image.LANCZOS)
    arr = np.asarray(small); s_, v_ = sat_val(arr); contrast = (arr.mean(2) / 255).std()
    res.append(('TH2', 'small_read', s_ >= 0.40 and contrast >= 0.17, f'10 % size: saturation {s_:.2f} (≥ 0.40), contrast {contrast:.2f} (≥ 0.17)'))
    prev_h = 960
    big = im.resize((round(W * prev_h / H), prev_h))
    tiny = small.resize((small.width * 3, small.height * 3), Image.NEAREST)
    pv = Image.new('RGB', (big.width + tiny.width + 30, prev_h), (25, 25, 25)); pv.paste(big, (0, 0)); pv.paste(tiny, (big.width + 15, (prev_h - tiny.height) // 2))
    ImageDraw.Draw(pv).text((big.width + 15, (prev_h - tiny.height) // 2 - 16), '10 % (phone feed), x3', fill=(255, 230, 0))
    pvp = os.path.join(proj, 'work', 'thumbnail_preview.jpg'); pv.save(pvp, quality=90)
    print(f'{out}  ({W}×{H}, frame {F}, zoom {zoom:g})\npreview: {pvp}  ← READ it: hero object + face readable at 10 %?')
    for cid, name, ok, det in res:
        print(f'{cid}  {name:10s} {"PASS" if ok else ("FAIL" if cid == "TH1" else "WARN")}  {det}')
    if not res[0][2]: print('  TH1: shorten the text to ≤ 3 words.')
    if not res[1][2]: print('  TH2: pick a closer / more saturated frame (--suggest), or --zoom 1.3 --focus x,y on the face + hero object.')
    print(f'THUMBNAIL: {"FAIL" if not res[0][2] else "PASS"} (TH2 is checked by eye on the preview)')
    sys.exit(0 if res[0][2] else 1)


if __name__ == '__main__':
    main()
