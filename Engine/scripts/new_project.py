#!/usr/bin/env python3
"""
new_project.py — create a video project from the template, and move it through the phases (resume state).

Usage (run from the studio root, the folder holding CLAUDE.md):
  python3 Engine/scripts/new_project.py <slug> --title "Working Title" [--type short|long] [--duration 59]
        → Projects/NN_<slug>/ (NN = next free number), project.json phase = "research"
  python3 Engine/scripts/new_project.py --set-phase <project_dir> <phase>
        → validates the phase name, records it in project.json (+ history with timestamp)
  python3 Engine/scripts/new_project.py --set <project_dir> key=value [key=value ...]
        → sets project.json fields (value parsed as JSON when possible: 8.0, true, [..], {..}; else a string)
  python3 Engine/scripts/new_project.py --status [<project_dir>]
        → prints phase + key fields of one project, or a table of every project in Projects/

Options: --root <dir> (default: the studio root = two levels above this script) — for tests.
Exit 0 on success, 2 on usage errors.
"""
import datetime, json, os, re, shutil, sys
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
TEMPLATE = os.path.join(ENGINE, 'templates', 'project')
PHASES = ['topic', 'research', 'format', 'script', 'voice', 'shotplan', 'gate', 'build', 'qa', 'audio', 'thumbnail', 'deliver', 'done']
WPS = 3.66


def ledger_phase(pdir, phase, root=None):
    """cost ledger (ledger.py): close the open phase, open the next. Never blocks a phase change."""
    try:
        sp = importlib.util.spec_from_file_location('ledger', os.path.join(HERE, 'ledger.py'))
        L = importlib.util.module_from_spec(sp); sp.loader.exec_module(L)
        if root: L.CFG['root'] = root
        L.cmd_phase(pdir, phase)
        print(f'LEDGER  {os.path.basename(os.path.abspath(pdir))} → {phase}  (ledger.md updated)')
    except Exception as e:
        print(f'WARN ledger not updated ({e}) — run: python3 Engine/scripts/ledger.py phase "{pdir}" {phase}')


def die(msg, code=2):
    print('ERROR:', msg); sys.exit(code)


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def load(pdir):
    fp = os.path.join(pdir, 'project.json')
    if not os.path.exists(fp):
        die(f'no project.json in {pdir}')
    return json.load(open(fp)), fp


def save(d, fp):
    tmp = fp + '.tmp'
    with open(tmp, 'w') as fh:
        json.dump(d, fh, indent=2, ensure_ascii=False); fh.write('\n')
    os.replace(tmp, fp)


def kebab(s):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s[:40].strip('-')


def ignore_junk(_dir, names):
    return [n for n in names if n.startswith('._') or n == '.DS_Store']


def cmd_new(a, root):
    if not a or a[0].startswith('--'):
        die('usage: new_project.py <slug> --title "Working Title"')
    raw = a[0]
    title = a[a.index('--title') + 1] if '--title' in a else raw.replace('-', ' ').title()
    typ = a[a.index('--type') + 1] if '--type' in a else 'short'
    if typ not in ('short', 'long'):
        die('--type must be short or long')
    dur = float(a[a.index('--duration') + 1]) if '--duration' in a else (59.0 if typ == 'short' else 480.0)
    projects = os.path.join(root, 'Projects')
    os.makedirs(projects, exist_ok=True)
    m = re.match(r'^(\d{2})_(.+)$', raw)
    used = {int(n[:2]) for n in os.listdir(projects) if re.match(r'^\d{2}_', n)}
    if m:
        nn, slug = int(m.group(1)), kebab(m.group(2))
        if nn in used:
            die(f'number {nn:02d} is already used in Projects/')
    else:
        nn, slug = (max(used) + 1 if used else 1), kebab(raw)
    if not slug:
        die('slug is empty after cleaning')
    name = f'{nn:02d}_{slug}'
    dest = os.path.join(projects, name)
    if os.path.exists(dest):
        die(f'{dest} already exists')
    shutil.copytree(TEMPLATE, dest, ignore=ignore_junk)
    d, fp = load(dest)
    d.update({'slug': name, 'title': title, 'type': typ, 'duration_s': dur, 'words_target': round(dur * WPS),
              'phase': 'research', 'created': now(), 'history': [{'phase': 'topic', 'at': now()}, {'phase': 'research', 'at': now()}]})
    if typ == 'long':
        d['compositions'] = ['Ch01']
    save(d, fp)
    sm = os.path.join(dest, 'script.md')
    lines = open(sm).read().split('\n')
    lines[0] = f'# Title: {title}'      # template line 0 holds the title rules; they are repeated in the lint comment
    open(sm, 'w').write('\n'.join(lines))
    ledger_phase(dest, 'research', root)
    print(f'CREATED {dest}')
    print(f'  phase=research  type={typ}  duration_s={dur:g}  words_target={d["words_target"]}')
    print(f'  next: record the topic score →  python3 Engine/scripts/new_project.py --set "Projects/{name}" topic_score=<x>')


def parse_val(v):
    try:
        return json.loads(v)
    except Exception:
        return v


def cmd_set_phase(a):
    if len(a) < 2:
        die('usage: --set-phase <project_dir> <phase>')
    pdir, ph = a[0], a[1]
    if ph not in PHASES:
        die(f'unknown phase "{ph}". phases: {", ".join(PHASES)}')
    d, fp = load(pdir)
    old = d.get('phase')
    d['phase'] = ph
    d.setdefault('history', []).append({'phase': ph, 'at': now(), 'from': old})
    save(d, fp)
    print(f'PHASE {old} → {ph}  ({fp})')
    ledger_phase(pdir, ph, os.path.dirname(os.path.dirname(os.path.abspath(pdir))))


def cmd_set(a):
    if len(a) < 2:
        die('usage: --set <project_dir> key=value [...]')
    d, fp = load(a[0])
    for kv in a[1:]:
        if '=' not in kv:
            die(f'bad pair {kv} (need key=value)')
        k, v = kv.split('=', 1)
        if k == 'phase':
            die('use --set-phase for the phase (it validates + logs history)')
        d[k] = parse_val(v)
        if k == 'duration_s':
            d['words_target'] = round(float(d[k]) * WPS)
        print(f'SET {k} = {json.dumps(d[k], ensure_ascii=False)}')
    save(d, fp)


def cmd_status(a, root):
    if a:
        d, fp = load(a[0])
        keys = ['slug', 'title', 'phase', 'type', 'duration_s', 'words_target', 'topic_score', 'gate_scores', 'rubric_scores']
        for k in keys:
            print(f'{k:14s} {json.dumps(d.get(k), ensure_ascii=False)}')
        nxt = PHASES[PHASES.index(d['phase']) + 1] if d.get('phase') in PHASES[:-1] else '-'
        print(f'{"next phase":14s} {nxt}')
        return
    projects = os.path.join(root, 'Projects')
    rows = sorted(n for n in os.listdir(projects) if re.match(r'^\d{2}_', n)) if os.path.isdir(projects) else []
    if not rows:
        print('no projects yet (Projects/ is empty)'); return
    for n in rows:
        try:
            d, _ = load(os.path.join(projects, n))
            print(f'{n:40s} {d.get("phase", "?"):10s} {d.get("title", "")}')
        except SystemExit:
            print(f'{n:40s} (no project.json)')


def main():
    a = sys.argv[1:]
    root = os.path.dirname(ENGINE)
    if '--root' in a:
        i = a.index('--root'); root = os.path.abspath(a[i + 1]); del a[i:i + 2]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2 if not a else 0)
    if a[0] == '--set-phase':
        cmd_set_phase(a[1:])
    elif a[0] == '--set':
        cmd_set(a[1:])
    elif a[0] == '--status':
        cmd_status(a[1:], root)
    else:
        cmd_new(a, root)


if __name__ == '__main__':
    main()
