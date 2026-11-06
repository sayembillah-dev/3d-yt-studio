#!/usr/bin/env python3
"""
cam_qa.py — numeric gates (G1-G19) for the ONE continuous camera. Runs on the camera SPEC (no render needed).

Usage:
  python3 cam_qa.py <project_dir> [--out report.json]

It calls cam_dump.mjs (evaluates scenes/camera.ts at every frame) and checks:
  G1  never_parks        no run > 12 frames where apparent motion < 0.04 deg/frame          ("camera never stops")
  G2  no_brake_at_keys   speed AT each waypoint >= 35% of the neighbouring segment speeds   (guide bug: easing to 0 at every key)
  G3  smooth             no frame-to-frame speed jump > 3x (outside whips / cuts)
  G4  cadence_median     median waypoint gap 36-66 f (1.2-2.2 s; target ~1.7 s)
  G5  cadence_max        no waypoint gap > 90 f (3 s)
  G6  first_move         second waypoint by frame 45 (1.5 s)
  G7  hook_moves         >= 2 waypoints inside frames 1-90 (2 framing changes in the first 3 s)
  G8  eased_segments     <= 1 non-flow, non-whip ease (an eased arrival is a STOP)
  G9  fov_range          fov within 22-60
  G10 roll               |roll| <= 0.2 rad
  G11 above_ground       camera y >= 0.25 (never under the floor)
  G12 no_spin            view never within 12 deg of straight up/down; yaw rate <= 6 deg/f outside whips  (guide bug: spin on the chimney climb)
  G13 covers_end         last waypoint >= END-20 (the flight is designed to the end, not coasting)
  G14 transitions        dissolves 6-12 f; hard cuts <= 1 per 60 s
  G15 peak_speed         apparent speed <= 8 deg/f outside whips (beyond that it is a smear, not a shot)
  G16 actors_apart       no two characters closer than r1+r2 at any frame (guide v1: "two guys walk right through each other")
                         + no character inside an obstacle (walk AROUND props / exit through doors)
  G17 camera_clearance   camera never within 0.35 of a character or inside an obstacle (our v1: camera flew into a barrel)
  G18 cast_in_frame      every character shotlist.json names for a beat is on screen (body inside the frame, big enough
                         to read) at some point in the middle half of that beat  (#02: "complained" beat with no neighbour)
  G19 head_in_frame      no character shown at medium/close size (>= 30 % of frame height) has the top of the head
                         above the frame edge for >= 6 f  (#02: Watts's head cut at f765/f1125/f1140)
  (G16-G19 need scenes/blocking.ts exporting ACTORS and OBSTACLES — see references/project-template; G18 also needs
   shotlist.json. Actor ids match shotlist cast ids by prefix: cast "watts" = actors watts1, watts12, …
   Projection only: a character hidden BEHIND a wall still counts as on screen.)
Exit 1 if any gate fails. Each failure prints the frame(s) and the fix.
"""
import json, math, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))

FIX = {
    'G1': 'Camera parks: add a waypoint inside the flagged range, or move the next waypoint further (bigger move), keep ease "flow", drift >= 0.04.',
    'G2': 'Remove `ease` from the flagged key (default flow). Never use inOut/out for a waypoint the camera should pass through.',
    'G3': 'Speed jump: waypoint spacing is uneven — make neighbouring segment distances/durations proportional, or mark it as a whip (ease:"whip").',
    'G4': 'Re-space waypoints to ~51 f (1.7 s) apart; key them to the words that carry new information.',
    'G5': 'Insert a waypoint (push-in / orbit / reveal) in the long gap.',
    'G6': 'Put waypoint #2 on the 3rd-5th spoken word (<= 45 f).',
    'G7': 'Hook needs 2 framing changes before 3 s: add a waypoint around f 70-85.',
    'G8': 'Convert eased keys to flow; only ONE deliberate eased landing (the reveal) is allowed.',
    'G9': 'Keep fov 22-60 (close-ups 28-34, wides 38-48).',
    'G10': 'Reduce roll to <= 0.2 rad.',
    'G11': 'Raise the waypoint above the floor (y >= 0.25).',
    'G12': 'Do not look straight up/down; tilt <= 78 deg. For climbs keep the look target ahead+above, not vertical. Slow the yaw.',
    'G13': 'Add a final waypoint within 20 f of END.',
    'G14': 'Dissolves 8 f (6-12). Replace hard cuts with flights or dissolves.',
    'G15': 'Too fast: spread the move over more frames or declare a whip (ease:"whip") on purpose.',
    'G16': 'Re-route the walk path AROUND the other actor/prop (add a path key that detours), or stagger timing so they are never in the same spot.',
    'G17': 'Move the camera waypoint away from the actor/prop, or move the prop off the flight line (check frames listed).',
    'G18': 'The beat names this character but the camera never frames them: aim the waypoint look at them / pull back, or move the actor into the shot (blocking.ts). If the beat is really object-only, remove the character from the cast of that beat in shotlist.json (the plan must match the picture). Actors MUST be named <castId><n> (cast "neighbour" -> actor neighbour11); an unmatched cast id fails.',
    'G19': 'Head cut by the top edge: raise the look target to head height (feet + 0.85 x height), pull the camera back, or widen fov at the listed frames.',
}


def sub(a, b): return [a[i] - b[i] for i in range(3)]
def norm(a): return math.sqrt(sum(x * x for x in a))
def unit(a):
    n = norm(a) or 1e-9
    return [x / n for x in a]
def ang(a, b):
    d = max(-1.0, min(1.0, sum(x * y for x, y in zip(unit(a), unit(b)))))
    return math.degrees(math.acos(d))


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(2)
    proj = os.path.abspath(a[0])
    outp = a[a.index('--out') + 1] if '--out' in a else os.path.join(proj, 'work', 'cam_qa.json')
    dump = os.path.join(proj, 'work', 'camera_dump.json')
    r = subprocess.run(['node', os.path.join(HERE, 'cam_dump.mjs'), proj, dump], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr or r.stdout); sys.exit(2)
    d = json.load(open(dump))
    END, keys, trans = d['END'], d['keys'], d['transitions']
    fr = {int(x[0]): x[1:] for x in d['frames']}
    whip = set()
    for i in range(len(keys) - 1):
        if keys[i + 1].get('ease') == 'whip':
            whip.update(range(keys[i]['f'], keys[i + 1]['f'] + 1))
    cuts_real = {t['f'] for t in trans if t['kind'] == 'cut'}
    # track swaps (multi-set projects: one camera track per set, swapped at the dissolve midpoint) are excluded from the
    # continuity gates exactly like a cut (the dissolve hides them) but are NOT counted as cuts in G14.
    swaps = set(d.get('swaps', []))
    cuts = cuts_real | swaps

    # apparent motion per frame (deg/frame): view-direction rotation + translation seen at the look distance
    spd, yaw_rate, tilt = {}, {}, {}
    for f in range(0, END + 1):
        p0, l0 = fr[f - 1][0:3], fr[f - 1][3:6]
        p1, l1 = fr[f][0:3], fr[f][3:6]
        v0, v1 = sub(l0, p0), sub(l1, p1)
        rot = ang(v0, v1)
        dist = max(0.5, norm(v1))
        trans_deg = math.degrees(norm(sub(p1, p0)) / dist)
        fov_d = abs(fr[f][6] - fr[f - 1][6]) * 0.5
        spd[f] = rot + trans_deg + fov_d
        yaw_rate[f] = abs(math.degrees(math.atan2(v1[0], v1[2]) - math.atan2(v0[0], v0[2])))
        if yaw_rate[f] > 180: yaw_rate[f] = 360 - yaw_rate[f]
        tilt[f] = math.degrees(math.asin(max(-1, min(1, unit(v1)[1]))))

    res = []
    def gate(g, name, ok, detail):
        res.append({'gate': g, 'name': name, 'pass': bool(ok), 'detail': detail, 'fix': None if ok else FIX[g]})

    # G1
    run, worst, worst_at, cur_start = 0, 0, None, None
    for f in range(0, END + 1):
        if spd[f] < 0.04 and f not in cuts:
            run += 1
            if run == 1: cur_start = f
            if run > worst: worst, worst_at = run, (cur_start, f)
        else:
            run = 0
    gate('G1', 'never_parks', worst <= 12, f'longest slow run {worst} f at {worst_at}')
    # G2
    bad = []
    for i in range(1, len(keys) - 1):
        k = keys[i]['f']
        if k <= 0 or k >= END: continue
        segA = [spd[f] for f in range(keys[i - 1]['f'] + 1, k) if f in spd] or [0]
        segB = [spd[f] for f in range(k + 1, min(END, keys[i + 1]['f'])) if f in spd] or [0]
        ref = 0.5 * (sum(segA) / len(segA) + sum(segB) / len(segB))
        if ref > 0.05 and spd[k] < 0.35 * ref and k not in cuts:
            bad.append({'key_f': k, 'speed': round(spd[k], 3), 'neighbour_mean': round(ref, 3)})
    gate('G2', 'no_brake_at_keys', not bad, bad or 'ok')
    # G3
    jumps = [f for f in range(2, END + 1) if f not in whip and f not in cuts and f - 1 not in cuts and max(spd[f], spd[f - 1]) > 0.3 and max(spd[f], spd[f - 1]) / max(1e-3, min(spd[f], spd[f - 1])) > 3]
    gate('G3', 'smooth', not jumps, jumps[:10] or 'ok')
    # G4-G7 cadence
    kf = sorted({k['f'] for k in keys if 0 <= k['f'] <= END})
    gaps = [b - a_ for a_, b in zip(kf, kf[1:])]
    med = sorted(gaps)[len(gaps) // 2] if gaps else 999
    gate('G4', 'cadence_median', 36 <= med <= 66, f'median gap {med} f ({med / 30:.2f} s) over {len(gaps)} gaps')
    big = [(a_, b) for a_, b in zip(kf, kf[1:]) if b - a_ > 90]
    gate('G5', 'cadence_max', not big, big or f'max {max(gaps) if gaps else 0} f')
    second = kf[1] if len(kf) > 1 else 999
    gate('G6', 'first_move', second <= 45, f'second waypoint at f {second}')
    hook = [k for k in kf if 0 < k <= 90]
    gate('G7', 'hook_moves', len(hook) >= 2 or END < 90, f'{len(hook)} waypoints in f 1-90')
    eased = [k['f'] for k in keys if k.get('ease') not in (None, 'flow', 'whip')]
    gate('G8', 'eased_segments', len(eased) <= 1, eased or 'ok')
    fovs = [fr[f][6] for f in range(0, END + 1)]
    gate('G9', 'fov_range', 22 <= min(fovs) and max(fovs) <= 60, f'fov {min(fovs):.1f}-{max(fovs):.1f}')
    rolls = [abs(fr[f][7]) for f in range(0, END + 1)]
    gate('G10', 'roll', max(rolls) <= 0.2, f'max |roll| {max(rolls):.3f}')
    low = [f for f in range(0, END + 1) if fr[f][1] < 0.25]
    gate('G11', 'above_ground', not low, low[:10] or 'ok')
    spin = [f for f in range(0, END + 1) if abs(tilt[f]) > 78 or (yaw_rate[f] > 6 and f not in whip and f not in cuts)]
    gate('G12', 'no_spin', not spin, spin[:10] or 'ok')
    gate('G13', 'covers_end', (kf[-1] if kf else 0) >= END - 20, f'last waypoint f {kf[-1] if kf else None}, END {END}')
    dis_bad = [t for t in trans if t['kind'] == 'dissolve' and not 6 <= t.get('len', 8) <= 12]
    ncut = len(cuts_real)
    gate('G14', 'transitions', not dis_bad and ncut <= max(1, round(END / 1800)), {'bad_dissolves': dis_bad, 'cuts': ncut})
    fast = [f for f in range(0, END + 1) if spd[f] > 8 and f not in whip and f not in cuts]
    gate('G15', 'peak_speed', not fast, fast[:10] or f'max {max(spd.values()):.2f} deg/f')

    actors, obstacles = d.get('actors', []), d.get('obstacles', [])
    if actors or obstacles:
        hits = []
        for f in range(0, END + 1):
            live = [a_ for a_ in actors if a_['enter'] <= f <= a_['exit']]
            for i in range(len(live)):
                pi = live[i]['pos'][f]
                for j in range(i + 1, len(live)):
                    pj = live[j]['pos'][f]
                    dd = math.hypot(pi[0] - pj[0], pi[2] - pj[2])
                    if dd < live[i]['radius'] + live[j]['radius']:
                        hits.append((f, live[i]['id'], live[j]['id'], round(dd, 2)))
                for o in obstacles:
                    dd = math.hypot(pi[0] - o['pos'][0], pi[2] - o['pos'][2])
                    if dd < o['radius'] + live[i]['radius'] * 0.6:
                        hits.append((f, live[i]['id'], o['id'], round(dd, 2)))
        first = {}
        for h in hits: first.setdefault((h[1], h[2]), h)
        gate('G16', 'actors_apart', not hits, list(first.values())[:10] or f'{len(actors)} actors, {len(obstacles)} obstacles ok')
        cl = []
        for f in range(0, END + 1):
            c = fr[f][0:3]
            for a_ in actors:
                if a_['enter'] <= f <= a_['exit']:
                    p_ = a_['pos'][f]
                    dx, dz = c[0] - p_[0], c[2] - p_[2]
                    if c[1] < 2.2 and math.hypot(dx, dz) < 0.35 + a_['radius']:
                        cl.append((f, a_['id'], round(math.hypot(dx, dz), 2)))
            for o in obstacles:
                if math.hypot(c[0] - o['pos'][0], c[2] - o['pos'][2]) < o['radius'] + 0.25 and c[1] < o['pos'][1] + o.get('height', 1.0) + 0.2:
                    cl.append((f, o['id'], 'inside'))
        firstc = {}
        for h in cl: firstc.setdefault(h[1], h)
        gate('G17', 'camera_clearance', not cl, list(firstc.values())[:10] or 'ok')
    else:
        print('NOTE: no scenes/blocking.ts → G16/G17 skipped (create it: they catch walk-throughs and camera-in-prop)')
    # G18/G19 — project characters through the camera (three.js: vertical fov, look-at, up = +y; roll ignored, <= 0.2)
    if actors:
        try:
            ptype = json.load(open(os.path.join(proj, 'project.json'))).get('type', 'short')
        except Exception:
            ptype = 'short'
        aspect = 9 / 16 if ptype == 'short' else 16 / 9
        def cross(a_, b_): return [a_[1] * b_[2] - a_[2] * b_[1], a_[2] * b_[0] - a_[0] * b_[2], a_[0] * b_[1] - a_[1] * b_[0]]
        def dot(a_, b_): return sum(x * y for x, y in zip(a_, b_))
        def project(f, pt):
            c, l, fov = fr[f][0:3], fr[f][3:6], fr[f][6]
            fw = unit(sub(l, c)); rt = unit(cross(fw, [0, 1, 0])); up = cross(rt, fw)
            dv = sub(pt, c); z = dot(dv, fw)
            if z <= 0.2: return None
            tv = math.tan(math.radians(fov) / 2)
            return dot(dv, rt) / (z * tv * aspect), dot(dv, up) / (z * tv)
        def view(f, a_):   # (body on screen, projected height as a fraction of frame height, head-top screen y)
            p_ = a_['pos'][f]; h = a_.get('height', 1.7)
            feet, head, mid = project(f, p_), project(f, [p_[0], p_[1] + h, p_[2]]), project(f, [p_[0], p_[1] + 0.55 * h, p_[2]])
            if not (feet and head and mid): return False, 0.0, None
            size = (head[1] - feet[1]) / 2
            return abs(mid[0]) <= 0.95 and abs(mid[1]) <= 0.95, size, head[1]
        live_at = lambda f: [a_ for a_ in actors if a_['enter'] <= f <= a_['exit'] and 0 <= f < len(a_['pos'])]
        # G18
        shots = []
        try:
            sl = json.load(open(os.path.join(proj, 'shotlist.json')))
            shots = (sl.get('shots') or sl.get('beats') or []) if isinstance(sl, dict) else sl
        except Exception:
            pass
        missing, unmatched = [], set()
        for sh in shots:
            a0, a1 = int(sh.get('from', 0)), int(sh.get('to', 0))
            if a0 > END: continue   # gate folders may carry the full project shotlist
            q0, q1 = a0 + (a1 - a0) // 4, a1 - (a1 - a0) // 4
            for c_ in sh.get('cast') or []:
                cid = c_.get('id') if isinstance(c_, dict) else c_
                if not cid: continue
                cands = [a_ for a_ in actors if a_['id'] == cid or (a_['id'].startswith(cid) and a_['id'][len(cid):][:1].isdigit())]
                if not cands:
                    unmatched.add(cid); missing.append((sh.get('id'), cid, 'no actor named ' + cid + '<n> in blocking.ts')); continue
                seen = any(view(f, a_)[0] and view(f, a_)[1] >= 0.06 for f in range(q0, q1 + 1) for a_ in cands if a_ in live_at(f))
                if not seen:
                    missing.append((sh.get('id'), cid, f'f{q0}-{q1}'))
        if shots:
            note = f' + cast ids with no actor: {sorted(unmatched)}' if unmatched else ''
            gate('G18', 'cast_in_frame', not missing, f'{len(missing)} miss(es): {missing[:10]}{note}' if missing else f'{len(shots)} beats ok')
        # G19
        runs, cur = [], {}
        for f in range(0, END + 1):
            now = set()
            for a_ in live_at(f):
                on, size, hy = view(f, a_)
                if on and 0.30 <= size <= 1.5 and hy is not None and hy > 1.0:
                    now.add(a_['id']); cur.setdefault(a_['id'], f)
            for k_ in [k_ for k_ in cur if k_ not in now]:
                if f - cur[k_] >= 6: runs.append((k_, f'f{cur[k_]}-{f - 1}'))
                del cur[k_]
        runs += [(k_, f'f{v_}-{END}') for k_, v_ in cur.items() if END + 1 - v_ >= 6]
        gate('G19', 'head_in_frame', not runs, runs[:10] or 'ok')
    npass = sum(r_['pass'] for r_ in res)
    for r_ in res:
        print(f"{r_['gate']:4s} {r_['name']:18s} {'PASS' if r_['pass'] else 'FAIL'}  {r_['detail']}")
    fails = [r_ for r_ in res if not r_['pass']]
    if fails:
        print('\nFIX PLAYBOOK:')
        for r_ in fails:
            print(f"  {r_['gate']} {r_['name']}: {r_['fix']}")
    print(f'\nCAM_QA: {npass}/{len(res)} gates pass')
    speed_curve = [round(spd[f], 3) for f in range(0, END + 1)]
    json.dump({'pass': npass, 'total': len(res), 'gates': res, 'speed_deg_per_f': speed_curve}, open(outp, 'w'), indent=1, default=str)
    sys.exit(0 if not fails else 1)


if __name__ == '__main__':
    main()
