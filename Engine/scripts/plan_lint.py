#!/usr/bin/env python3
"""
plan_lint.py — Phase 6 gate: check $P/shotlist.json against the VO timings (public/words.json) and the measured cadence.

Usage:  python3 plan_lint.py <project_dir> [--fps 30]

shotlist.json = {"fps": 30, "sets": [...], "shots": [{id, from, to, words, sync, set, visual, camera, cast, sfx,
                 transition_in, [dissolve_len]}]}   (frames; `to` exclusive = next beat's `from`)

Checks (ids = fix-playbook.md §5; all HARD except where noted):
  PL1  beat_median     median beat length 36–66 f (1.2–2.2 s, target ~51 f = 1.7 s)
  PL2  beat_max        no beat > 90 f (3 s)
  PL3  first_change    beat 1 ends by f 45
  PL4  hook_beats      ≥ 2 framing changes (beat starts) in f 1–89
  PL5  sync_word       each beat's `sync` word is spoken inside [from − 3, to) (words.json)
  PL6  cuts            transition_in "cut" ≤ 1 per 60 s
  PL7  dissolve_len    every dissolve 7–9 f (field dissolve_len, default 8)
  PL8  sentence_starts every sentence's first word starts within ±6 f of a beat start
  PL9  sets            distinct sets per 60 s in 7–10 (videos ≥ 30 s; shorter = N/A)
  PL10 fields          every beat has id/from/to/words/sync/set/visual/camera/cast/sfx/transition_in;
                       beats contiguous from f 0 and cover the last spoken word
Exit 0 PASS, 1 FAIL, 2 usage error.
"""
import json, os, re, statistics, sys

REQ = ['id', 'from', 'to', 'words', 'sync', 'set', 'visual', 'camera', 'cast', 'sfx', 'transition_in']
CAMS = {'push', 'pull', 'whip', 'orbit', 'crane', 'pan', 'tilt', 'fly-through', 'track', 'dolly'}
FIX = {
    'PL1': 'Split long beats at the next noun / merge beats shorter than ~30 f, so the median lands near 51 f.',
    'PL2': 'Split the beat at a word that introduces something new (new object, new character, new number).',
    'PL3': 'Shorten beat 1 so the first framing change lands on the 3rd–5th word (≤ 45 f).',
    'PL4': 'Split beat 1 or 2: the hook needs 2 framing changes before 3 s.',
    'PL5': 'Fix the sync spelling, or pick a word that is actually spoken inside the beat (check public/words.json).',
    'PL6': 'Turn extra cuts into camera flights (portal: door/window/porthole) or 8-f dissolves.',
    'PL7': 'Set dissolve_len to 8.',
    'PL8': 'Move the beat boundary onto the sentence\'s first word (sentence boundaries are framing-change opportunities).',
    'PL9': 'Split a long set into two / merge tiny ones: 7–10 bespoke sets per 60 s.',
    'PL10': 'Fill the missing fields / close the gaps between beats (to of one = from of the next; first from = 0; last to ≥ last word end).',
}


def norm(t):
    return re.sub(r"[^a-z0-9']", '', t.lower().replace('’', "'"))


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2)
    proj = a[0]
    sp = os.path.join(proj, 'shotlist.json')
    if not os.path.exists(sp):
        print(f'ERROR: no {sp}'); sys.exit(2)
    sl = json.load(open(sp))
    fps = int(a[a.index('--fps') + 1]) if '--fps' in a else int(sl.get('fps', 30))
    shots = sl.get('shots', [])
    wp = os.path.join(proj, 'public', 'words.json')
    words = json.load(open(wp)) if os.path.exists(wp) else []
    words = words['words'] if isinstance(words, dict) else words
    if not shots:
        print('ERROR: shotlist.json has no shots'); sys.exit(2)
    res = []

    def chk(cid, name, ok, detail):
        res.append((cid, name, 'N/A ' if ok is None else ('PASS' if ok else 'FAIL'), detail))

    shots = sorted(shots, key=lambda s: s.get('from', 0))
    lens = [s.get('to', 0) - s.get('from', 0) for s in shots]
    med = statistics.median(lens)
    chk('PL1', 'beat_median', 36 <= med <= 66, f'median {med:g} f ({med / fps:.2f} s) over {len(shots)} beats')
    longb = [(s.get('id'), l) for s, l in zip(shots, lens) if l > 90]
    chk('PL2', 'beat_max', not longb, f'over 90 f: {longb}' if longb else f'max {max(lens)} f')
    chk('PL3', 'first_change', shots[0].get('to', 0) <= 45, f'beat 1 ends f {shots[0].get("to")}')
    hook = [s['from'] for s in shots if 0 < s.get('from', 0) < 90]
    chk('PL4', 'hook_beats', len(hook) >= 2, f'{len(hook)} changes in f 1–89 {hook}')
    if words:
        miss = []
        for s in shots:
            sy = [norm(t) for t in str(s.get('sync', '')).split()]
            if not sy or not sy[0]:
                miss.append((s.get('id'), 'empty sync')); continue
            lo, hi = s.get('from', 0) - 3, s.get('to', 0)
            ok = False
            for i, w in enumerate(words):
                f = w['s'] * fps
                if lo <= f < hi and all(i + j < len(words) and norm(words[i + j]['w']) == sy[j] for j in range(len(sy))):
                    ok = True; break
            if not ok:
                miss.append((s.get('id'), s.get('sync')))
        chk('PL5', 'sync_word', not miss, f'not spoken inside its beat: {miss[:8]}' if miss else f'{len(shots)} sync words found on time')
    else:
        chk('PL5', 'sync_word', False, 'no public/words.json (run transcribe.py first)')
    end_f = max(s.get('to', 0) for s in shots)
    cuts = [s.get('id') for s in shots if s.get('transition_in') == 'cut']
    allow = max(1, round(end_f / (60 * fps)))
    chk('PL6', 'cuts', len(cuts) <= allow, f'{len(cuts)} cuts (≤ {allow}) {cuts}')
    bad_d = [(s.get('id'), s.get('dissolve_len', 8)) for s in shots if s.get('transition_in') == 'dissolve' and not 7 <= s.get('dissolve_len', 8) <= 9]
    nd = sum(1 for s in shots if s.get('transition_in') == 'dissolve')
    chk('PL7', 'dissolve_len', not bad_d, f'bad: {bad_d}' if bad_d else f'{nd} dissolves, all 7–9 f ({nd / max(end_f / fps / 60, 1e-9):.1f}/min; refs 11–21)')
    if words:
        starts = [0] + [i + 1 for i, w in enumerate(words[:-1]) if re.search(r'[.!?]["”]?$', w['w'])]
        bstarts = [s.get('from', 0) for s in shots]
        off = []
        for i in starts:
            f = round(words[i]['s'] * fps)
            if min(abs(f - b) for b in bstarts) > 6:
                off.append((words[i]['w'], f))
        chk('PL8', 'sentence_starts', not off, f'sentences not starting a beat (word, f): {off[:8]}' if off else f'{len(starts)} sentences all start a beat')
    else:
        chk('PL8', 'sentence_starts', False, 'no public/words.json')
    dur_s = end_f / fps
    nsets = len({s.get('set') for s in shots})
    per60 = nsets / dur_s * 60 if dur_s else 0
    chk('PL9', 'sets', (7 <= per60 <= 10) if dur_s >= 30 else None, f'{nsets} sets in {dur_s:.1f} s = {per60:.1f} per 60 s (7–10)')
    probs = []
    for s in shots:
        miss_f = [k for k in REQ if k not in s or s[k] in (None, '')]
        if miss_f: probs.append(f'{s.get("id")}: missing {miss_f}')
        if s.get('camera') and str(s['camera']).split()[0] not in CAMS: probs.append(f'{s.get("id")}: camera "{s["camera"]}" not in {sorted(CAMS)}')
        if s.get('transition_in') not in ('flight', 'dissolve', 'cut'): probs.append(f'{s.get("id")}: transition_in must be flight|dissolve|cut')
    if shots[0].get('from', 0) != 0: probs.append(f'first beat starts at f {shots[0].get("from")} (must be 0)')
    for p_, n_ in zip(shots, shots[1:]):
        if p_.get('to') != n_.get('from'): probs.append(f'gap/overlap {p_.get("id")}→{n_.get("id")}: to {p_.get("to")} vs from {n_.get("from")}')
    if words and end_f < round(words[-1]['e'] * fps):
        probs.append(f'last beat ends f {end_f} before the last word ends f {round(words[-1]["e"] * fps)}')
    chk('PL10', 'fields', not probs, '; '.join(probs[:6]) if probs else 'all fields present, beats contiguous, VO covered')

    for cid, name, st, det in res:
        print(f'{cid:5s} {name:16s} {st}  {det}')
    fails = [r for r in res if r[2] == 'FAIL']
    if fails:
        print('\nFIX PLAYBOOK:')
        for cid, name, _, _ in fails:
            print(f'  {cid} {name}: {FIX[cid]}')
    print(f'\nPLAN_LINT: {"FAIL" if fails else "PASS"} ({len(fails)} failures) — {len(shots)} beats, {dur_s:.1f} s, {nsets} sets')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
