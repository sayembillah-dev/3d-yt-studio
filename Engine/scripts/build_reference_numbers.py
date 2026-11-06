#!/usr/bin/env python3
"""
build_reference_numbers.py — aggregate measure_short.py outputs of the REFERENCE shorts into the gate file.

Usage:
  python3 build_reference_numbers.py <measure_root_dir> <out references/reference_numbers.json>

<measure_root_dir> contains one sub-folder per reference short, each with metrics.json.
The GATES section is hand-set from (a) these measurements and (b) the guide's 22-short measurements
("guide" values). compare.py reads only the GATES section. Re-run this whenever references are added;
gates keep their hand-set values but `observed` is refreshed so you can see whether a gate needs widening.
"""
import json, os, sys, glob
import numpy as np

# metric path in metrics.json -> how to extract
EXTRACT = {
    'wps': lambda m: m.get('voice', {}).get('wps'),
    'wps_first3s': lambda m: m.get('voice', {}).get('wps_first3s'),
    'longest_pause_s': lambda m: m.get('voice', {}).get('longest_pause_s'),
    'pauses_over_0.33s': lambda m: m.get('voice', {}).get('pauses_over_0.33s'),
    'beats_per_s': lambda m: m['beats']['per_s'],
    'median_beat_gap_s': lambda m: m['beats']['median_gap_s'],
    'max_beat_gap_s': lambda m: m['beats']['max_gap_s'],
    'first_beat_s': lambda m: m['beats']['first_s'],
    'beats_in_first_3s': lambda m: m['beats']['in_first_3s'],
    'hard_cuts': lambda m: m['cuts']['count'],
    'dissolves_per_min': lambda m: round(60 * m['dissolves']['count'] / m['duration_s'], 2),
    'dissolve_len_f': lambda m: m['dissolves']['median_len_f'],
    'longest_hold_s': lambda m: m['motion']['longest_hold_s'],
    'pct_frames_moving': lambda m: m['motion']['pct_frames_moving'],
    'saturation': lambda m: m['colour']['sat_mean'],
    'value': lambda m: m['colour']['val_mean'],
    'lufs_i': lambda m: m['audio']['lufs_i'],
    'true_peak_dbtp': lambda m: m['audio']['true_peak_dbtp'],
    'caption_cap_px': lambda m: m['captions']['cap_height_px_est'],
    'duration_s': lambda m: m['duration_s'],
}

# Hand-set gates. kind: 'hard' fails the build, 'soft' warns. [lo, hi] inclusive; None = open.
GATES = {
    'wps':                {'range': [3.2, 4.1],  'kind': 'hard', 'guide': 3.66, 'why': 'narrator is fast; refs 3.28-3.63, guide 3.66 (4.0 in first 3 s)'},
    'longest_pause_s':    {'range': [None, 0.33], 'kind': 'hard', 'guide': 0.33, 'why': 'no pause longer than a third of a second'},
    'median_beat_gap_s':  {'range': [1.2, 2.2],  'kind': 'hard', 'guide': 1.7,  'why': 'new framing about every 1.7 s'},
    'max_beat_gap_s':     {'range': [None, 4.0], 'kind': 'soft', 'guide': 3.0,  'why': 'never sit on one framing'},
    'first_beat_s':       {'range': [None, 2.0], 'kind': 'hard', 'guide': 1.3,  'why': 'first framing change by ~1.1-1.5 s'},
    'beats_in_first_3s':  {'range': [2, None],   'kind': 'hard', 'guide': 2,    'why': '2 framings in the first 3 s'},
    'hard_cuts':          {'range': [None, 3],   'kind': 'hard', 'guide': 1,    'why': 'camera flies; ~1 real cut per video'},
    'dissolves_per_min':  {'range': [6, 26],     'kind': 'soft', 'guide': None, 'why': 'refs 11-21 per minute'},
    'dissolve_len_f':     {'range': [5, 12],     'kind': 'hard', 'guide': 7,    'why': 'median dissolve 7-9 frames, camera moving through it'},
    'longest_hold_s':     {'range': [None, 2.6], 'kind': 'hard', 'guide': None, 'why': 'camera never parks; refs 0.47-2.5 s'},
    'saturation':         {'range': [0.36, 0.56], 'kind': 'soft', 'guide': 0.41, 'why': 'warm bright toon; refs 0.40-0.51'},
    'value':              {'range': [0.42, 0.70], 'kind': 'soft', 'guide': 0.61, 'why': 'refs 0.46-0.62'},
    'lufs_i':             {'range': [-15.0, -13.0], 'kind': 'hard', 'guide': -14, 'why': 'refs -14.0..-14.3'},
    'true_peak_dbtp':     {'range': [None, -1.0], 'kind': 'hard', 'guide': -2,  'why': 'refs -1.3..-2.2'},
    'caption_cap_px':     {'range': [34, 52],    'kind': 'soft', 'guide': 52.5, 'why': 'refs measure 41-44 with this estimator (glyph run incl. stroke)'},
    'duration_s':         {'range': [39, 66],    'kind': 'soft', 'guide': 59,   'why': 'Shorts 39-65 s, median 59'},
}


def main():
    root, out = sys.argv[1], sys.argv[2]
    rows = {}
    files = sorted(glob.glob(os.path.join(root, '*', 'metrics.json')))
    for f in files:
        m = json.load(open(f))
        for k, fn in EXTRACT.items():
            try:
                v = fn(m)
            except Exception:
                v = None
            if v is not None:
                rows.setdefault(k, []).append(v)
    observed = {k: {'n': len(v), 'min': float(np.min(v)), 'p50': float(np.median(v)), 'max': float(np.max(v)), 'values': v} for k, v in rows.items()}
    doc = {
        'source': [os.path.basename(os.path.dirname(f)) for f in files],
        'note': 'GATES are what compare.py enforces. observed = these reference shorts measured by measure_short.py.',
        'GATES': GATES,
        'observed': observed,
    }
    json.dump(doc, open(out, 'w'), indent=1)
    for k, g in GATES.items():
        o = observed.get(k)
        print(f"{k:20s} gate {g['range']!s:16s} observed {('%.3g..%.3g (p50 %.3g)' % (o['min'], o['max'], o['p50'])) if o else '-'}")


if __name__ == '__main__':
    main()
