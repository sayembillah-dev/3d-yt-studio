#!/usr/bin/env python3
"""
compare.py — score a render against the reference numbers. PASS/FAIL table, exit 1 on any HARD failure.

Usage:
  python3 compare.py <render.mp4 | metrics.json> [--ref <reference_numbers.json>] [--skip audio,voice] [--out report.json]

If given an mp4 it runs measure_short.py first (into <render>_measure/).
--skip audio   ignore loudness gates (silent preview renders)
--skip voice   ignore voice gates (no VO yet)
--skip <metric>[,<metric>]  ignore single metrics by name (gate shots: see GATE_SKIP below)
GATE_SKIP (Phase 7 gate shots, 3.6 s): voice,audio,duration,dissolves_per_min,median_beat_gap_s — whole-video
  statistics; on a 3.6 s clip the median beat gap is ONE gap. Full videos never skip median_beat_gap_s.
Gates that depend on full-length videos (duration, dissolves_per_min) are SOFT and only warn.
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_reference_numbers import EXTRACT  # noqa: E402

DEFAULT_REF = os.path.join(HERE, '..', 'references', 'reference_numbers.json')
VOICE = {'wps', 'longest_pause_s'}
AUDIO = {'lufs_i', 'true_peak_dbtp'}

# what to do when a gate fails — the fix playbook (also in references/fix-playbook.md)
FIX = {
    'wps': 'VO too slow/fast: should have been caught by transcribe.py --gate in Phase 5 (WARN band 3.264-4.018). Slow: tighten_vo --keep 0.10, denser wording, or atempo <= 1.05 (user found 1.10 rushed); fast: --keep 0.16 / atempo 0.97. Never pad with silence.',
    'longest_pause_s': 'Run scripts/tighten_vo.py to shorten gaps > 0.30 s to 0.12 s, then re-transcribe.',
    'median_beat_gap_s': 'Shot plan: add/remove camera waypoints so a new framing lands every ~1.7 s (scripts/plan_lint.py).',
    'max_beat_gap_s': 'A framing is held too long: insert a waypoint (push-in / orbit / pan) in the long gap.',
    'first_beat_s': 'First camera move must land by ~1.3 s: put waypoint #2 on the 3rd-5th word.',
    'beats_in_first_3s': 'Add a second framing change before 3 s (hook needs 2 moves).',
    'hard_cuts': 'Replace cuts with flights (camera flies set->set) or 7-9 f dissolves with the camera moving on both sides.',
    'dissolve_len_f': 'Set dissolve length to 8 frames in the shot plan.',
    'longest_hold_s': 'Camera parked: ensure every segment uses ease "flow" and drift > 0; check cam_qa.py speed gate.',
    'saturation': 'Target 0.40-0.51. TOO HIGH: <Stage grade={{sat: 0.85}}> (GradeEffect uSat, 1 = neutral) and desaturate the biggest flat areas (sky top, water, deck). TOO LOW: saturate costumes/props, not the sky.',
    'value': 'Target 0.46-0.62. TOO HIGH (washed out, white sky fills the frame): <Stage grade={{tint: "#E6E2DE"}}> (multiplies the frame ~0.9), lower the mood sunIntensity/fillIntensity ~15% (moods.ts), darken sky top colour, lower camera tilt so less sky is in frame, add darker foreground props. TOO LOW: raise key light / hemisphere fill, brighten the ground colour.',
    'lufs_i': 'Run scripts/mix.py (targets -14 LUFS, TP -2).',
    'true_peak_dbtp': 'Run scripts/mix.py (true-peak limiter at -2 dBTP).',
    'caption_cap_px': 'Captions: size so cap height ~42 px at 1080x1920 (Captions size prop).',
    'duration_s': 'Shorts: 39-65 s. Trim or extend the script.',
}


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(2)
    src = a[0]
    ref = a[a.index('--ref') + 1] if '--ref' in a else DEFAULT_REF
    skip = set(a[a.index('--skip') + 1].split(',')) if '--skip' in a else set()
    outp = a[a.index('--out') + 1] if '--out' in a else None
    if src.endswith('.json'):
        mpath = src
    else:
        mdir = os.path.splitext(src)[0] + '_measure'
        args = [sys.executable, os.path.join(HERE, 'measure_short.py'), src, mdir]
        if 'voice' in skip:
            args.append('--no-voice')
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL)
        mpath = os.path.join(mdir, 'metrics.json')
    m = json.load(open(mpath))
    gates = json.load(open(ref))['GATES']
    rows, hard_fail = [], 0
    for k, g in gates.items():
        if k in skip or ('voice' in skip and k in VOICE) or ('audio' in skip and k in AUDIO):
            continue
        try:
            v = EXTRACT[k](m)
        except Exception:
            v = None
        lo, hi = g['range']
        if v is None:
            status = 'N/A'
        else:
            ok = (lo is None or v >= lo) and (hi is None or v <= hi)
            status = 'PASS' if ok else ('FAIL' if g['kind'] == 'hard' else 'WARN')
            if status == 'FAIL':
                hard_fail += 1
        rows.append({'metric': k, 'value': v, 'range': g['range'], 'kind': g['kind'], 'status': status, 'fix': FIX.get(k) if status in ('FAIL', 'WARN') else None})
    print(f"{'metric':20s} {'value':>9s}  {'gate':16s} kind  status")
    for r in rows:
        v = '-' if r['value'] is None else (f"{r['value']:.3g}" if isinstance(r['value'], float) else str(r['value']))
        print(f"{r['metric']:20s} {v:>9s}  {str(r['range']):16s} {r['kind']:4s}  {r['status']}")
    fixes = [r for r in rows if r['fix']]
    if fixes:
        print('\nFIX PLAYBOOK:')
        for r in fixes:
            print(f"  [{r['status']}] {r['metric']}: {r['fix']}")
    print(f"\nRESULT: {'FAIL' if hard_fail else 'PASS'} ({hard_fail} hard failures)")
    if outp:
        json.dump({'metrics': mpath, 'rows': rows, 'hard_failures': hard_fail}, open(outp, 'w'), indent=1)
    sys.exit(1 if hard_fail else 0)


if __name__ == '__main__':
    main()
