#!/usr/bin/env python3
"""
dashboard.py — a plain-English, read-only window into what Claude is doing on a video, for someone who doesn't
want to read a terminal. Lives entirely on this machine (127.0.0.1), writes nothing to the SSD. See
Improvements/faster-and-cheaper.md and the user's request for a "lightweight dashboard... visually monitor what
claude is doing."

Shows: which video is in progress and what step it's on, what Claude is doing right now, the renders it has done,
what's been decided / still open (work/handoff.md), and the running cost estimate — all in everyday words, not
tool/token/API jargon.

usage: python3 dashboard.py [--port 8731]
Then open the printed http://127.0.0.1:<port> link (or double-click dashboard.command, which does that for you).
"""
import glob, json, os, re, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ledger  # noqa: E402 — same folder; reuses its session-log reading instead of re-implementing it

# This dashboard only ever reads. ledger.totals() normally rewrites a small per-project cache file when a
# late-arriving transcript line changes a *closed* phase's numbers — harmless on its own, but this dashboard
# polls on a timer, independent of the skill's own `--set-phase` calls, and could race one and lose it. Turning
# the write into a no-op makes every ledger.* call here read-only, full stop.
ledger.save_state = lambda *a, **k: None

ROOT = os.path.dirname(os.path.dirname(HERE))  # the studio root (two up from Engine/scripts)

PHASE_LABEL = {
    'topic': 'Picking what the video is about', 'research': 'Researching the story',
    'format': 'Deciding Short vs. long-form', 'script': 'Writing the script',
    'voice': 'Recording/cleaning up the narration', 'shotplan': 'Planning the camera shots',
    'gate': 'Testing the look on one practice shot', 'build': 'Building the 3D scene',
    'qa': 'Checking the video for mistakes', 'audio': 'Adding music and sound effects',
    'thumbnail': 'Making the thumbnail image', 'deliver': 'Finishing up and handing over the files',
    'done': 'Finished',
}

# matched against the Bash tool's *command*, in order — first match wins. Falls back to the command's own
# plain-English `description` (every Bash call must write one; the skill now asks for non-technical wording).
FRIENDLY_CMD = [
    (r'qa_all\.(sh|py)', 'Checking the video for mistakes'),
    (r'cam_qa\.py', 'Checking the camera path'),
    (r'render\.sh\s+\S+\s+stills', 'Taking preview pictures'),
    (r'render\.sh\s+\S+\s+range', 'Re-rendering one section of the video'),
    (r'render\.sh\s+\S+\s+splice', 'Re-rendering only the changed parts of the video'),
    (r'render\.sh\s+\S+\s+preview', 'Rendering a quick small preview of the video'),
    (r'render\.sh\s+\S+\s+pace', 'Doing a quick timing check of the video'),
    (r'render\.sh\s+\S+\s+video', 'Rendering the video'),
    (r'qa_frames\.py', 'Checking each frame for mistakes'),
    (r'compare\.py', 'Comparing against the reference videos'),
    (r'mix\.py', 'Mixing the music and sound'),
    (r'sfx_cues\.mjs|sfx_synth\.py', 'Adding sound effects'),
    (r'thumbnail\.py', 'Making the thumbnail image'),
    (r'tighten_vo\.py', 'Cleaning up the narration audio'),
    (r'transcribe\.py', 'Writing down the narration word by word'),
    (r'script_lint\.py', 'Checking the script'),
    (r'plan_lint\.py', 'Checking the shot plan'),
    (r'ledger\.py', 'Updating the cost tracker'),
    (r'new_project\.py', 'Setting up the project'),
    (r'cam_dump\.mjs', 'Reading the camera path'),
]
RENDER_MODE_LABEL = {'stills': 'Took preview pictures', 'video': 'Rendered the full video',
                      'range': 'Re-rendered part of the video', 'splice': 'Re-rendered only the changed parts',
                      'preview': 'Rendered a quick small preview', 'pace': 'Did a quick timing check'}


def ago(t):
    s = time.time() - t
    if s < 60:
        return 'just now'
    if s < 3600:
        return f'{int(s // 60)} minute{"s" if s >= 120 else ""} ago'
    if s < 86400:
        return f'{int(s // 3600)} hour{"s" if s >= 7200 else ""} ago'
    return f'{int(s // 86400)} day{"s" if s >= 172800 else ""} ago'


def friendly_bash(cmd, desc):
    for pat, label in FRIENDLY_CMD:
        if re.search(pat, cmd or ''):
            return label
    return desc or '(working)'


def tail_lines(path, max_bytes=65536):
    """last `max_bytes` of a file, as whole JSON lines — drops a possibly-truncated first line, tolerates a
    half-written last one (exFAT/AppleDouble files are filtered out by the caller, not here)."""
    try:
        size = os.path.getsize(path)
        with open(path, 'rb') as fh:
            if size > max_bytes:
                fh.seek(size - max_bytes)
            data = fh.read()
    except OSError:
        return []
    lines = data.decode('utf-8', 'ignore').split('\n')
    if len(lines) > 1:
        lines = lines[1:]  # first line may be a partial read from mid-file
    out = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except Exception:
            continue  # half-written last line, or a non-JSON stray — skip, don't crash
    return out


def recent_transcripts(n=4):
    files = [f for f in glob.glob(os.path.join(ledger.transcript_dir(), '**', '*.jsonl'), recursive=True)
             if not os.path.basename(f).startswith('._')]
    files.sort(key=lambda f: os.path.getmtime(f), reverse=True)
    return files[:n]


def live_activity(limit=12):
    events = []
    for f in recent_transcripts():
        for d in tail_lines(f):
            if d.get('type') != 'assistant' or not isinstance(d.get('message'), dict):
                continue
            ts = d.get('timestamp')
            if not ts:
                continue
            try:
                t = ledger.parse_t(ts).timestamp()
            except Exception:
                continue
            for c in d['message'].get('content') or []:
                if not (isinstance(c, dict) and c.get('type') == 'tool_use'):
                    continue
                name, inp = c.get('name'), c.get('input') or {}
                if name == 'Bash':
                    events.append((t, friendly_bash(inp.get('command'), inp.get('description'))))
                elif name == 'Agent':
                    events.append((t, f"Handed off a task: {inp.get('description') or '(working)'}"))
    events.sort(key=lambda x: -x[0])
    seen, out = set(), []
    for t, text in events:
        if text in seen:  # collapse immediate repeats (e.g. a retried command)
            continue
        seen.add(text)
        out.append({'when': ago(t), 'text': text})
        if len(out) >= limit:
            break
    return out


def all_projects():
    out = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'Projects', '[0-9][0-9]_*'))):
        pj = os.path.join(p, 'project.json')
        if not os.path.exists(pj):
            continue
        try:
            d = json.load(open(pj))
        except Exception:
            continue
        out.append({'slug': os.path.basename(p), 'title': d.get('title', ''), 'phase': d.get('phase', '?'),
                     'mtime': os.path.getmtime(pj)})
    return out


def pick_project(slug=None):
    projs = all_projects()
    if not projs:
        return None
    if slug:
        return next((p for p in projs if p['slug'] == slug), projs[0])
    active = [p for p in projs if p['phase'] != 'done']
    pool = active or projs
    return max(pool, key=lambda p: p['mtime'])


def render_history(proj_dir, limit=8):
    p = os.path.join(proj_dir, 'work', 'render_log.jsonl')
    if not os.path.exists(p):
        return []
    rows = []
    for line in open(p, encoding='utf-8', errors='ignore'):
        try:
            r = json.loads(line)
            t = ledger.parse_t(r['at']).timestamp()
        except Exception:
            continue
        label = RENDER_MODE_LABEL.get(r.get('mode'), 'Rendered')
        secs = float(r.get('seconds', 0))
        dur = f'{secs:.0f}s' if secs < 60 else f'{secs / 60:.1f}m'
        ok = 'finished fine' if r.get('ok') else 'FAILED'
        rows.append({'when': ago(t), '_t': t, 'text': f'{label} — took {dur} — {ok}'})
    rows.sort(key=lambda r: -r['_t'])
    for r in rows:
        del r['_t']
    return rows[:limit]


def read_handoff(proj_dir):
    p = os.path.join(proj_dir, 'work', 'handoff.md')
    if not os.path.exists(p):
        return ''
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except OSError:
        return ''


_COST_CACHE = {}
_COST_LOCK = threading.Lock()


def cost_for(slug, proj_dir):
    with _COST_LOCK:
        c = _COST_CACHE.get(slug)
    if c and time.time() - c['_at'] < 60:
        return c
    ledger._EVENTS = None  # the cache is per-process-lifetime in ledger.py; drop it so new work since the last
    # recompute (new transcript lines) actually gets counted instead of freezing cost at the first poll.
    try:
        agg, _ = ledger.totals(proj_dir)
        vl = ledger.video_len(proj_dir)
        cost = agg['est_usd'] + agg['extras_usd']
        out = {'usd': round(cost, 2), 'wall': ledger.hms(agg['wall_s']), 'active': ledger.hms(agg['active_s']),
               'renders': agg['renders'], 'render_minutes': round(agg['render_s'] / 60, 1),
               'video_length_s': round(vl, 1) if vl else None, '_at': time.time()}
    except Exception as e:
        out = {'usd': None, 'wall': None, 'active': None, 'renders': 0, 'render_minutes': 0,
               'video_length_s': None, 'error': str(e), '_at': time.time()}
    with _COST_LOCK:
        _COST_CACHE[slug] = out
    return out


def build_status(slug=None):
    proj = pick_project(slug)
    if not proj:
        return {'project': None, 'activity': live_activity(), 'renders': [], 'handoff': '',
                'cost': None, 'projects': []}
    proj_dir = os.path.join(ROOT, 'Projects', proj['slug'])
    cost = dict(cost_for(proj['slug'], proj_dir))
    cost.pop('_at', None)
    return {
        'project': {'slug': proj['slug'], 'title': proj['title'], 'phase': proj['phase'],
                    'phase_label': PHASE_LABEL.get(proj['phase'], proj['phase'])},
        'activity': live_activity(),
        'renders': render_history(proj_dir),
        'handoff': read_handoff(proj_dir),
        'cost': cost,
        'projects': [{'slug': p['slug'], 'title': p['title'], 'phase': p['phase']} for p in all_projects()],
    }


PAGE_PATH = os.path.join(HERE, 'dashboard_page.html')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass  # quiet — this is a viewer, not a server to debug

    def do_GET(self):
        if self.path.startswith('/api/status'):
            slug = None
            if '?' in self.path:
                qs = self.path.split('?', 1)[1]
                for kv in qs.split('&'):
                    if kv.startswith('project='):
                        slug = kv.split('=', 1)[1]
            try:
                body = json.dumps(build_status(slug)).encode()
                self.send_response(200)
            except Exception as e:
                body = json.dumps({'error': str(e)}).encode()
                self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        else:
            try:
                body = open(PAGE_PATH, 'rb').read()
            except OSError:
                self.send_response(404); self.end_headers(); return
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(body)


def main():
    a = sys.argv[1:]
    port = int(a[a.index('--port') + 1]) if '--port' in a else 8731
    srv = None
    for p in range(port, port + 20):
        try:
            srv = ThreadingHTTPServer(('127.0.0.1', p), Handler)
            port = p
            break
        except OSError:
            continue
    if not srv:
        print('could not find a free port'); sys.exit(1)
    print(f'Dashboard: http://127.0.0.1:{port}  (Ctrl-C to stop)')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
