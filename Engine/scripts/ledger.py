#!/usr/bin/env python3
"""
ledger.py — cost ledger for every video: ONE ROW PER VIDEO in <studio>/ledger.md, with every production metric.

Where the numbers come from (nothing is typed in by hand except paid extras):
  - tokens / model / API calls / tool calls / web searches / sessions: Claude Code's own session transcripts
    (~/.claude/projects/<studio-path-encoded>/**/*.jsonl, subagents included), summed inside each phase's time window,
    de-duplicated per API request (one request is logged once per streamed content block). An `advisor()` call is a
    full extra API call to its own model, nested in the calling message's `usage.iterations` — priced separately
    under that model, same as any other call.
  - cost: tokens × Engine/references/pricing.json (API-equivalent USD; on a Pro/Max subscription nothing is billed
    per token, but the number is what the work would cost on the API — the right number for estimating)
  - wall time / Claude-active time (gaps between transcript events ≤ 5 min) / sessions
  - renders: <project>/work/render_log.jsonl (render.sh appends one line per render: mode, frames, seconds)
  - paid extras (ElevenLabs, stock music, …): `ledger.py extra`
Per-phase detail lives in <project>/work/ledger.json; ledger.md shows the totals (one row per project).

Usage (from the studio root; new_project.py calls `phase` for you on create and on every --set-phase):
  python3 Engine/scripts/ledger.py begin                         # at the very start of a new video request (Phase 1),
                                                                 # before any question — the clock starts here
  python3 Engine/scripts/ledger.py phase <project_dir> <phase>   # close the open phase, open <phase> ('done' closes all)
  python3 Engine/scripts/ledger.py extra <project_dir> <usd> "<what>"   # a paid credit the user approved
  python3 Engine/scripts/ledger.py refresh                       # recompute open phases up to now + rewrite ledger.md
  python3 Engine/scripts/ledger.py show <project_dir>            # per-phase breakdown table
Options: --root <studio dir> (tests) · --transcripts <dir> (default: Claude Code's folder for this studio)
Closed phases are re-measured on every update (late-flushed log lines get picked up); the stored snapshot is kept as a
floor, so the ledger survives Claude Code pruning old transcripts (default after 30 days).
Caveat: every Claude Code event in this studio folder inside a phase's window is counted (other work done in the same
window, e.g. engine fixes, is attributed to that video — usually right: it was needed to make it).
"""
import datetime as dt, glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
CFG = {'root': os.path.dirname(ENGINE), 'transcripts': None}
PRICING = os.path.join(ENGINE, 'references', 'pricing.json')
ACTIVE_GAP = 300  # s: gaps between transcript events longer than this are idle (user away / waiting)


def root(*p):
    return os.path.join(CFG['root'], *p)


def now():
    return dt.datetime.now(dt.timezone.utc)


def iso(t):
    return t.astimezone(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def parse_t(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))


def transcript_dir():
    if CFG['transcripts']:
        return CFG['transcripts']
    base = os.environ.get('CLAUDE_CONFIG_DIR') or os.path.expanduser('~/.claude')
    studio = os.path.dirname(ENGINE)   # transcripts are keyed by the folder Claude Code was opened in (the studio)
    return os.path.join(base, 'projects', re.sub(r'[^A-Za-z0-9]', '-', studio))


_EVENTS = None


def load_events():
    """every transcript line with a timestamp, sorted (parsed once per run)."""
    global _EVENTS
    if _EVENTS is not None:
        return _EVENTS
    ev = []
    for f in glob.glob(os.path.join(transcript_dir(), '**', '*.jsonl'), recursive=True):
        if os.path.basename(f).startswith('._'):
            continue
        try:
            fh = open(f, encoding='utf-8', errors='ignore')
        except OSError:
            continue
        with fh:
            for line in fh:
                try:
                    d = json.loads(line)
                    ts = d.get('timestamp')
                    if ts:
                        ev.append((parse_t(ts), d))
                except Exception:
                    continue
    ev.sort(key=lambda x: x[0])
    _EVENTS = ev
    return ev


def pricing():
    return json.load(open(PRICING))


TOK_KEYS = ('input', 'cache_write_5m', 'cache_write_1h', 'cache_read', 'output')


def measure(t0, t1, proj):
    """Sum every metric inside [t0, t1)."""
    P = pricing()
    reqs, tools, sessions, times = {}, 0, set(), []
    for t, d in load_events():
        if t < t0:
            continue
        if t >= t1:
            break
        times.append(t)
        if d.get('sessionId'):
            sessions.add(d['sessionId'])
        m = d.get('message')
        if d.get('type') == 'assistant' and isinstance(m, dict):
            for c in m.get('content') or []:
                if isinstance(c, dict) and c.get('type') == 'tool_use':
                    tools += 1
            u = m.get('usage')
            if u:
                key = d.get('requestId') or m.get('id') or iso(t)
                reqs[key] = (m.get('model') or '?', u)      # identical usage on every chunk of one request → keep one
                # the advisor tool is a full extra API call to a different (usually stronger) model, nested inside
                # the calling message's own usage.iterations — NOT a separate transcript line — so it would
                # otherwise vanish from every cost number. Price each one under its own model.
                for i, it in enumerate(u.get('iterations') or []):
                    if isinstance(it, dict) and it.get('type') == 'advisor_message' and it.get('model'):
                        reqs[f'{key}:advisor{i}'] = (it['model'], it)
    tok = {k: 0 for k in TOK_KEYS}
    per_model, cost, ws, wf = {}, 0.0, 0, 0
    for model, u in reqs.values():
        if model.startswith('<') or model == '?':
            continue  # synthetic/local messages, not API calls
        cc = u.get('cache_creation') or {}
        w1h = cc.get('ephemeral_1h_input_tokens') or 0
        w5m = cc.get('ephemeral_5m_input_tokens')
        if w5m is None:
            w5m = max(0, (u.get('cache_creation_input_tokens') or 0) - w1h)
        row = {'input': u.get('input_tokens') or 0, 'cache_write_5m': w5m, 'cache_write_1h': w1h,
               'cache_read': u.get('cache_read_input_tokens') or 0, 'output': u.get('output_tokens') or 0}
        stu = u.get('server_tool_use') or {}
        ws += stu.get('web_search_requests') or 0
        wf += stu.get('web_fetch_requests') or 0
        rate = P['models'].get(model) or P['models'][P['unknown_model_fallback']]
        mult = P.get('fast_mode_multiplier', {}).get(model, 1.0) if u.get('speed') == 'fast' else 1.0
        c = sum(row[k] * rate[k] for k in TOK_KEYS) / 1e6 * mult
        cost += c
        pm = per_model.setdefault(model, {'calls': 0, 'usd': 0.0, **{k: 0 for k in TOK_KEYS}})
        pm['calls'] += 1
        pm['usd'] += c
        for k in TOK_KEYS:
            tok[k] += row[k]
            pm[k] += row[k]
    cost += ws / 1000 * P['web_search_per_1000']['usd']
    active = sum(g for g in ((b - a).total_seconds() for a, b in zip(times, times[1:])) if g <= ACTIVE_GAP)
    renders, render_s = 0, 0.0
    rl = os.path.join(proj, 'work', 'render_log.jsonl')
    if os.path.exists(rl):
        for line in open(rl):
            try:
                r = json.loads(line)
                rt = parse_t(r['at'])
            except Exception:
                continue
            if t0 <= rt < t1:
                renders += 1
                render_s += float(r.get('seconds', 0))
    return {'wall_s': round((t1 - t0).total_seconds()), 'active_s': round(active), 'api_calls': sum(p['calls'] for p in per_model.values()),
            'tool_calls': tools, 'web_searches': ws, 'web_fetches': wf, 'sessions': sorted(sessions), 'tokens': tok,
            'per_model': per_model, 'est_usd': round(cost, 4), 'renders': renders, 'render_s': round(render_s, 1)}


def state_path(proj):
    return os.path.join(proj, 'work', 'ledger.json')


def load_state(proj):
    p = state_path(proj)
    return json.load(open(p)) if os.path.exists(p) else {'segments': [], 'extras': []}


def save_state(proj, s):
    os.makedirs(os.path.join(proj, 'work'), exist_ok=True)
    tmp = state_path(proj) + '.tmp'
    json.dump(s, open(tmp, 'w'), indent=1)
    os.replace(tmp, state_path(proj))


def pending_start():
    """start time left by `ledger.py begin` (consumed once), or None."""
    p = root('Projects', '.ledger_pending.json')
    if not os.path.exists(p):
        return None
    try:
        t = parse_t(json.load(open(p))['start'])
    except Exception:
        t = None
    os.remove(p)
    return t


def cmd_begin():
    os.makedirs(root('Projects'), exist_ok=True)
    json.dump({'start': iso(now())}, open(root('Projects', '.ledger_pending.json'), 'w'))
    print(f'LEDGER: clock started {iso(now())} — new_project.py will book it as the start of phase "topic"')


def cmd_phase(proj, phase, at=None):
    """close the open segment (measure it) and open `phase`. A brand-new ledger first books 'topic' from `begin`."""
    proj = os.path.abspath(proj)
    s = load_state(proj)
    t = at or now()
    if not s['segments']:
        t_begin = pending_start()
        if t_begin and t_begin < t and phase != 'topic':
            s['segments'].append({'phase': 'topic', 'start': iso(t_begin), 'end': None})
    for seg in s['segments']:
        if seg.get('end') is None:
            seg['end'] = iso(t)
            seg['metrics'] = measure(parse_t(seg['start']), t, proj)
    if phase != 'done':
        s['segments'].append({'phase': phase, 'start': iso(t), 'end': None})
    save_state(proj, s)
    write_md()


def cmd_extra(proj, usd, what):
    proj = os.path.abspath(proj)
    s = load_state(proj)
    s['extras'].append({'at': iso(now()), 'usd': float(usd), 'what': what})
    save_state(proj, s)
    write_md()
    print(f'LEDGER: extra ${float(usd):.2f} — {what}')


def totals(proj):
    """sum of closed segments + the open one measured up to now."""
    s = load_state(proj)
    agg = {k: 0 for k in ('wall_s', 'active_s', 'api_calls', 'tool_calls', 'web_searches', 'web_fetches', 'renders')}
    agg.update({'est_usd': 0.0, 'render_s': 0.0, 'tokens': {k: 0 for k in TOK_KEYS}, 'models': {}, 'sessions': set()})
    segs, changed = [], False
    for seg in s['segments']:
        if seg.get('end'):
            # recompute closed windows every time: transcript lines are flushed a moment late (the call that ran
            # --set-phase lands after the window closed). The stored snapshot is the floor: Claude Code deletes old
            # transcripts (cleanupPeriodDays, default 30), and then the snapshot keeps the numbers.
            m = measure(parse_t(seg['start']), parse_t(seg['end']), proj)
            old = seg.get('metrics') or {}
            if m['api_calls'] + m['renders'] >= old.get('api_calls', 0) + old.get('renders', 0):
                if m != old:
                    seg['metrics'] = m; changed = True
            else:
                m = old
        else:
            m = measure(parse_t(seg['start']), now(), proj)
        segs.append((seg, m))
        for k in ('wall_s', 'active_s', 'api_calls', 'tool_calls', 'web_searches', 'web_fetches', 'renders', 'est_usd', 'render_s'):
            agg[k] += m.get(k, 0)
        for k in TOK_KEYS:
            agg['tokens'][k] += m['tokens'][k]
        for mod, pm in m.get('per_model', {}).items():
            agg['models'][mod] = agg['models'].get(mod, 0) + pm['calls']
        agg['sessions'].update(m.get('sessions', []))
    if changed:
        save_state(proj, s)
    agg['extras'] = s['extras']
    agg['extras_usd'] = sum(e['usd'] for e in s['extras'])
    agg['start'] = s['segments'][0]['start'] if s['segments'] else None
    agg['end'] = s['segments'][-1]['end'] if s['segments'] and s['segments'][-1].get('end') else None
    agg['fix_loops'] = max(0, sum(1 for sg in s['segments'] if sg['phase'] == 'qa') - 1)
    return agg, segs


def hms(s):
    s = int(s)
    return f'{s // 3600}h{s % 3600 // 60:02d}m' if s >= 3600 else f'{s // 60}m{s % 60:02d}s'


def ktok(n):
    return f'{n / 1e6:.2f}M' if n >= 1e6 else f'{n / 1e3:.1f}k'


def video_len(proj):
    p = os.path.join(proj, 'output', 'final.mp4')
    if os.path.exists(p):
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True)
        try:
            return float(r.stdout)
        except ValueError:
            pass
    return None


COLS = ['#', 'Project', 'Title', 'Type', 'Phase', 'Started (UTC)', 'Finished (UTC)', 'Wall time', 'Claude active', 'Sessions',
        'Models (API calls)', 'API calls', 'Tool calls', 'Input tok', 'Cache-write tok', 'Cache-read tok', 'Output tok', 'Total tok',
        'Web searches', 'Renders (n / min)', 'Fix loops', 'Video length', 'Est. API cost', 'Paid extras', 'Total cost', 'Cost / video-min']


def write_md():
    projs = sorted(p for p in glob.glob(root('Projects', '[0-9][0-9]_*')) if os.path.exists(state_path(p)))
    P = pricing()
    rows, done = [], []
    for i, p in enumerate(projs, 1):
        pjp = os.path.join(p, 'project.json')
        pj = json.load(open(pjp)) if os.path.exists(pjp) else {}
        a, _ = totals(p)
        t = a['tokens']
        vl = video_len(p)
        cost = a['est_usd'] + a['extras_usd']
        models = ', '.join(f'{m.replace("claude-", "")} ({n})' for m, n in sorted(a['models'].items(), key=lambda x: -x[1])) or '—'
        rows.append([str(i), os.path.basename(p), pj.get('title', ''), pj.get('type', ''), pj.get('phase', '?'),
                     (a['start'] or '')[:16].replace('T', ' '), (a['end'] or 'in progress')[:16].replace('T', ' '),
                     hms(a['wall_s']), hms(a['active_s']), str(len(a['sessions'])), models, str(a['api_calls']), str(a['tool_calls']),
                     ktok(t['input']), ktok(t['cache_write_5m'] + t['cache_write_1h']), ktok(t['cache_read']), ktok(t['output']), ktok(sum(t.values())),
                     str(a['web_searches']), f"{a['renders']} / {a['render_s'] / 60:.1f}", str(a['fix_loops']),
                     f'{vl:.1f} s' if vl else '—', f"${a['est_usd']:.2f}", f"${a['extras_usd']:.2f}", f'${cost:.2f}',
                     f'${cost / (vl / 60):.2f}' if vl else '—'])
        if pj.get('phase') == 'done':
            done.append((cost, a['active_s'], a['wall_s'], vl))
    out = ['# Production ledger — one row per video', '',
           'Generated by `python3 Engine/scripts/ledger.py` — do not edit by hand (rewritten on every phase change).',
           f'Costs are **API-equivalent USD** at `Engine/references/pricing.json` (prices as of {P["as_of"]}). On a Pro/Max',
           'subscription tokens are not billed one by one, but this is what the same work costs on the API — use it to estimate.',
           'Tokens come from Claude Code\'s session logs inside each video\'s phase windows. Per-phase detail:',
           '`python3 Engine/scripts/ledger.py show Projects/<slug>`.', '',
           '| ' + ' | '.join(COLS) + ' |', '|' + '---|' * len(COLS)]
    out += ['| ' + ' | '.join(r) + ' |' for r in rows] or []
    if not rows:
        out.append('| ' + ' | '.join(['—'] * len(COLS)) + ' |')
    if done:
        n = len(done)
        lens = [d[3] for d in done if d[3]]
        line = (f'**Finished videos: {n}** · average total cost ${sum(d[0] for d in done) / n:.2f} · average Claude-active '
                f'{hms(sum(d[1] for d in done) / n)} · average wall time {hms(sum(d[2] for d in done) / n)}')
        if lens:
            line += f' · average cost per video-minute ${sum(d[0] for d in done if d[3]) / (sum(lens) / 60):.2f}'
        out += ['', line]
    out += ['', 'Column notes: **Claude active** = time with session events < 5 min apart (excludes waiting for you).',
            '**Cache-write / cache-read tok** = prompt caching (reads are billed at 5 % of input on Opus 5.5). **Fix loops** = QA',
            'rounds after the first. **Paid extras** = paid credits you approved (`ledger.py extra`). All Claude Code activity in',
            'this studio folder during a video\'s phases is counted for that video.', '']
    open(root('ledger.md'), 'w').write('\n'.join(out))


def cmd_show(proj):
    proj = os.path.abspath(proj)
    a, segs = totals(proj)
    print(f'{"phase":10s} {"start (UTC)":17s} {"wall":>8s} {"active":>8s} {"calls":>6s} {"tools":>6s} {"input":>8s} {"c-write":>8s} '
          f'{"c-read":>8s} {"output":>8s} {"renders":>9s} {"USD":>8s}')
    for seg, m in segs:
        t = m['tokens']
        print(f'{seg["phase"]:10s} {seg["start"][:16].replace("T", " "):17s} {hms(m["wall_s"]):>8s} {hms(m["active_s"]):>8s} '
              f'{m["api_calls"]:6d} {m["tool_calls"]:6d} {ktok(t["input"]):>8s} {ktok(t["cache_write_5m"] + t["cache_write_1h"]):>8s} '
              f'{ktok(t["cache_read"]):>8s} {ktok(t["output"]):>8s} {m["renders"]:3d}/{m["render_s"] / 60:4.1f}m ${m["est_usd"]:7.2f}'
              + ('' if seg.get('end') else '  (open)'))
    for e in a['extras']:
        print(f'extra      {e["at"][:16].replace("T", " "):17s} ${e["usd"]:.2f}  {e["what"]}')
    print(f'TOTAL      wall {hms(a["wall_s"])} · active {hms(a["active_s"])} · API ${a["est_usd"]:.2f} + extras ${a["extras_usd"]:.2f}'
          f' = ${a["est_usd"] + a["extras_usd"]:.2f}')


def main():
    a = sys.argv[1:]
    for opt in ('--root', '--transcripts'):
        if opt in a:
            i = a.index(opt)
            CFG[opt[2:]] = os.path.abspath(a[i + 1])
            del a[i:i + 2]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__)
        sys.exit(2)
    c = a[0]
    if c == 'begin':
        cmd_begin()
    elif c == 'phase' and len(a) >= 3:
        cmd_phase(a[1], a[2])
        print(f'LEDGER: {os.path.basename(os.path.abspath(a[1]))} → {a[2]} (ledger.md updated)')
    elif c == 'extra' and len(a) >= 4:
        cmd_extra(a[1], a[2], a[3])
    elif c == 'refresh':
        write_md()
        print(f'LEDGER: {root("ledger.md")} rewritten')
    elif c == 'show' and len(a) >= 2:
        cmd_show(a[1])
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == '__main__':
    main()
