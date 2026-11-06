#!/usr/bin/env python3
"""
splice.py — replace frame ranges of a render with freshly rendered segments (render.sh splice calls this).

usage: python3 splice.py <base.mp4> <out.mp4> <seg.mp4>:<from>-<to> [<seg.mp4>:<from>-<to> ...]
  base.mp4   the last good full render
  seg.mp4    a render of exactly frames <from>..<to> (inclusive), same size + fps as base
Re-encodes once (libx264 crf 16, same as remotion.config.ts). Checks frame count and size; exit 1 on mismatch.
"""
import json, subprocess, sys


def probe(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries',
                        'stream=width,height,r_frame_rate,nb_read_packets', '-of', 'json', p], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)['streams'][0]
    return int(s['width']), int(s['height']), s['r_frame_rate'], int(s['nb_read_packets'])


def main():
    a = sys.argv[1:]
    if len(a) < 3:
        print(__doc__); sys.exit(2)
    base, out, segs = a[0], a[1], []
    for x in a[2:]:
        path, rng = x.rsplit(':', 1)
        f0, f1 = (int(v) for v in rng.split('-'))
        segs.append((f0, f1, path))
    segs.sort()
    bw, bh, bfps, bn = probe(base)
    prev_end = -1
    for f0, f1, p in segs:
        w, h, fps, n = probe(p)
        if (w, h, fps) != (bw, bh, bfps) or n != f1 - f0 + 1 or f0 <= prev_end or f1 >= bn:
            print(f'SPLICE FAILED: {p} is {w}x{h}@{fps} {n} f, needs {bw}x{bh}@{bfps} {f1 - f0 + 1} f inside 0-{bn - 1}, no overlap')
            sys.exit(1)
        prev_end = f1
    inputs, parts, k, cur = ['-i', base], [], 0, 0
    for i, (f0, f1, p) in enumerate(segs):
        inputs += ['-i', p]
        if f0 > cur:
            parts.append(f'[0:v]trim=start_frame={cur}:end_frame={f0},setpts=PTS-STARTPTS[p{k}]'); k += 1
        parts.append(f'[{i + 1}:v]setpts=PTS-STARTPTS[p{k}]'); k += 1
        cur = f1 + 1
    if cur < bn:
        parts.append(f'[0:v]trim=start_frame={cur},setpts=PTS-STARTPTS[p{k}]'); k += 1
    graph = ';'.join(parts) + ';' + ''.join(f'[p{j}]' for j in range(k)) + f'concat=n={k}:v=1:a=0[v]'
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264',
                        '-crf', '16', '-pix_fmt', 'yuv420p', '-r', bfps, out], capture_output=True, text=True)
    if r.returncode != 0:
        print('SPLICE FAILED:', r.stderr[-600:]); sys.exit(1)
    n = probe(out)[3]
    if n != bn:
        print(f'SPLICE FAILED: output has {n} frames, base has {bn}'); sys.exit(1)
    print(f'SPLICE: {len(segs)} segment(s), {sum(f1 - f0 + 1 for f0, f1, _ in segs)} of {bn} frames re-rendered -> {out}')


if __name__ == '__main__':
    main()
