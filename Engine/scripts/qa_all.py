#!/usr/bin/env python3
"""
qa_all.py — one quiet QA round: runs the right numeric checks for the phase, prints one PASS/FAIL table
(failures show their fix text), writes full logs to work/logs/. See Improvements/faster-and-cheaper.md #4.
Replaces 4-6 separate script calls + their raw output per QA round.

usage: python3 qa_all.py <project_dir> <gate|qa|final> [Comp]
  gate   Phase 7: cam_qa (17 gates) + compare --skip voice,audio,duration,dissolves_per_min,median_beat_gap_s
         on work/<Comp>.mp4 (needs Comp; render it first with render.sh)
  qa     Phase 9: qa_frames + compare --skip audio on work/<Comp>.mp4 (needs Comp; render it first)
  final  Phase 10: mix.py (writes output/final.mp4) + compare, no skip (Comp not needed, mix.py finds the video)
exit 0 only if every check in the mode passes.
"""
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))


def run(name, logdir, stamp, cmd):
    log = os.path.join(logdir, f'{stamp}_{name}.log')
    r = subprocess.run(cmd, capture_output=True, text=True)
    text = (r.stdout or '') + (r.stderr or '')
    open(log, 'w').write(text)
    return {'name': name, 'rc': r.returncode, 'text': text, 'log': log}


def summary_cam_qa(c):
    for line in reversed(c['text'].splitlines()):
        if line.startswith('CAM_QA:'):
            return line.strip()
    return f"(exit {c['rc']})"


def summary_compare(c):
    for line in reversed(c['text'].splitlines()):
        if line.startswith('RESULT:'):
            return line.strip()
    return f"(exit {c['rc']})"


def summary_mix(c):
    for line in reversed(c['text'].splitlines()):
        if line.startswith('MIX:'):
            return line.strip()
    return f"(exit {c['rc']})"


def summary_qa_frames(c):
    try:
        obj, _ = json.JSONDecoder().raw_decode(c['text'])
        by = obj.get('findings_by_severity', {})
        bad = sum(v for k, v in by.items() if k in ('P0', 'P1'))
        detail = ', '.join(f'{k}:{v}' for k, v in by.items()) or 'none'
        return f"{bad} P0/P1 findings ({detail})"
    except Exception:
        return f"(exit {c['rc']})"


SUMMARY = {'cam_qa': summary_cam_qa, 'compare': summary_compare, 'mix': summary_mix, 'qa_frames': summary_qa_frames}


def fix_text(c):
    lines = c['text'].splitlines()
    if 'FIX PLAYBOOK:' in c['text']:
        i = next(j for j, l in enumerate(lines) if l.strip() == 'FIX PLAYBOOK:')
        return lines[i:]
    if c['name'] == 'qa_frames':
        try:
            _, end = json.JSONDecoder().raw_decode(c['text'])
            rest = [l for l in c['text'][end:].splitlines() if l.strip()]
            return rest[:20]
        except Exception:
            pass
    return [f"  see {c['log']}"]


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__); sys.exit(2)
    proj, mode = os.path.abspath(a[0]), a[1]
    comp = a[2] if len(a) > 2 else None
    logdir = os.path.join(proj, 'work', 'logs'); os.makedirs(logdir, exist_ok=True)
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())

    checks = []
    if mode == 'gate':
        if not comp:
            print('gate mode needs <Comp>'); sys.exit(2)
        video = os.path.join(proj, 'work', f'{comp}.mp4')
        # Phase 7 gate = Phase 9 steps 1-5 on the test shot: cam_qa + qa_frames (its sheets/flags feed the
        # 5-lens score) + compare with the gate's extra skips (a 3.6 s clip has only one beat gap).
        checks.append(('cam_qa', [sys.executable, os.path.join(HERE, 'cam_qa.py'), proj]))
        checks.append(('qa_frames', [sys.executable, os.path.join(HERE, 'qa_frames.py'), proj, video]))
        checks.append(('compare', [sys.executable, os.path.join(HERE, 'compare.py'), video,
                                    '--skip', 'voice,audio,duration,dissolves_per_min,median_beat_gap_s']))
    elif mode == 'qa':
        if not comp:
            print('qa mode needs <Comp>'); sys.exit(2)
        video = os.path.join(proj, 'work', f'{comp}.mp4')
        # cam_qa too: fix loops in this phase routinely edit camera.ts/blocking.ts, and it's seconds to run.
        checks.append(('cam_qa', [sys.executable, os.path.join(HERE, 'cam_qa.py'), proj]))
        checks.append(('qa_frames', [sys.executable, os.path.join(HERE, 'qa_frames.py'), proj, video]))
        checks.append(('compare', [sys.executable, os.path.join(HERE, 'compare.py'), video, '--skip', 'audio']))
    elif mode == 'final':
        checks.append(('mix', [sys.executable, os.path.join(HERE, 'mix.py'), proj]))
        checks.append(('compare', [sys.executable, os.path.join(HERE, 'compare.py'),
                                    os.path.join(proj, 'output', 'final.mp4')]))
    else:
        print('mode must be gate|qa|final'); sys.exit(2)

    results = [run(name, logdir, stamp, cmd) for name, cmd in checks]
    overall = 0
    print(f'QA_ALL ({mode}):')
    for c in results:
        status = 'PASS' if c['rc'] == 0 else 'FAIL'
        if c['rc'] != 0:
            overall = 1
        detail = SUMMARY[c['name']](c) if c['name'] in SUMMARY else f"(exit {c['rc']})"
        print(f"  {c['name']:10s} {status:4s}  {detail}")
    fails = [c for c in results if c['rc'] != 0]
    if fails:
        print('\nFAILURES — fix playbook:')
        for c in fails:
            print(f"-- {c['name']} --")
            for line in fix_text(c):
                print(' ', line)
    print(f'\nlogs: {logdir}')
    sys.exit(overall)


if __name__ == '__main__':
    main()
