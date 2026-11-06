#!/usr/bin/env python3
"""
script_lint.py — Phase 4 gate: check a StickWorld script against the measured story formula (style-bible §9, §M).

Usage:
  python3 script_lint.py <project_dir | script.md> [--duration 59] [--research research.md]

script.md format (templates/project/script.md):
  line 1           "# Title: <title>"
  "## VO" section  ONE sentence per line; only these lines are counted. Tags (removed before counting):
                   [REVEAL]  the mechanism sentence (exactly one)      [DOUBTER] optional: marks the doubter line
                   [PIVOT]   optional: marks the pivot line if it is not a "You see," line
Duration: --duration, else project.json duration_s, else 59.

Checks (ids = fix-playbook.md §5; HARD fails exit 1, WARN does not):
  L1  word_count       VO words within duration × 3.66 ± 8 %                                  HARD
  L2  hook_length      sentence 1 ≤ 11 words (≈ 3 s)                                         HARD
  L3  hook_form        sentence 1 is a statement: no "?", no "Did you know / Have you ever / Imagine / What if / Ever wondered"  HARD
  L4  doubter          a doubter/mockery line in the first 35 % of the words ([DOUBTER] or keyword)  HARD
  L5  pivot            a "You see," pivot (or [PIVOT]) starting between 25 % and 75 % of the words      HARD
  L6  reveal_position  exactly one [REVEAL] line, starting at 55–85 % of the words (refs 59–81 %)       HARD
  L7  quote            ≥ 1 quoted punch-line ("…" or “…”)                                    HARD
  L8  numbers          ≥ 2 specific numbers (digits or number words: 39, 1000, eight, 1880)  HARD
  L9  drawable_noun    every sentence has a word that is not a stop/abstract word — heuristic, LOOK at flagged lines   WARN
  L10 title            4–8 words, Title Case (HARD); "The X That…/Why…/Levels of…/How…" pattern (WARN)
  L11 ending           last sentence has no moral / outro ("subscribe", "the lesson", "and that's why", …)  HARD
  L12 unverified       no number/name from research.md's UNVERIFIED section appears in the VO   HARD
Exit 0 = PASS, 1 = a HARD check failed, 2 = usage error.
"""
import json, os, re, sys

WPS = 3.66
FIX = {
    'L1': 'Cut adjectives and repeated clauses / add one escalation beat until the count is inside the range.',
    'L2': 'Cut sentence 1 down to the strange action itself ("He sawed gaps into a railroad every 39 feet.").',
    'L3': 'Rewrite sentence 1 as a statement of the odd action or paradox (no question, no "Did you know").',
    'L4': 'Add a mocking/doubting line in the first third ("The whole court burst out laughing."), or tag it [DOUBTER].',
    'L5': 'Add a "You see," pivot before the context (between 25 % and 75 %), or tag the pivot line [PIVOT].',
    'L6': 'Tag exactly one mechanism sentence [REVEAL] and move it into the last ~30 % (start at 55–85 % of the words).',
    'L7': 'Add a short quoted punch-line voiced by the narrator ("You\'re wrecking my railroad!").',
    'L8': 'Add specific numbers/names/dates from research.md (39 feet, 1000 lbs, 132 AD).',
    'L9': 'Rewrite the flagged sentence around an object you can draw (or confirm it already has one).',
    'L10': 'Title: 4–8 words, Title Case, curiosity object: "The [Object] That …", "Why [Group] [Odd Thing]", "Levels of …".',
    'L11': 'End abruptly on the payoff image; no moral, no "subscribe"; the last line must lead back into line 1.',
    'L12': 'Remove the UNVERIFIED fact from the script (or verify it in 2 sources and move it out of UNVERIFIED).',
}
HOOK_BAD = re.compile(r"^\s*(did you know|have you ever|imagine|what if|ever wonder|ever wondered|do you know|have you heard)\b", re.I)
DOUBT = re.compile(r"\b(laugh\w*|mock\w*|jok\w*|crazy|insane|ridicul\w*|idiot\w*|fool\w*|scoff\w*|sneer\w*|doubt\w*|nobody believed|no one believed|called (him|her|it|them)|thought (he|she|they|it) was|madman|mad|nuts|absurd|rejected|fired|banned|ignored|shrugged|rolled (his|her|their) eyes)\b", re.I)
PIVOT = re.compile(r"^\s*(you see|here'?s the thing|but here'?s the thing|the thing is|turns out|it turns out)\b", re.I)
OUTRO = re.compile(r"\b(subscribe|follow for|like and|the lesson|the moral|and that'?s why|and that is why|the end\b|remember to|so next time|in conclusion|comment below)\b", re.I)
NUMWORDS = {'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fifteen',
            'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'hundreds', 'thousand',
            'thousands', 'million', 'millions', 'billion', 'dozen', 'dozens', 'half', 'twice', 'triple', 'double'}
STOP = set('''a an the and or but so if then than that this these those there here it its it's is are was were be been being am
i you he she we they me him her us them my your his our their what which who whom whose when where why how all any some
no not nor only own same too very can will just don't should now of at by for with about against between into through
during before after above below to from up down in out on off over under again further once also even still yet ever never
always every each both few more most other such do does did doing done have has had having would could might must shall
may one ones as like really actually because while until got get gets getting go goes went going gone make makes made
say says said tell told see saw seen look looked know knew known think thought want wanted need needed come came take took
give gave put let lets keep kept call called use used find found feel felt seem seemed become became turn turned try tried
way ways thing things something nothing anything everything someone anyone everyone nobody people person time times
idea ideas reason reasons problem problems fact facts lot lots kind sort part parts point side case cases matter result
world life day days year years man men woman women guy guys yes yeah oh well right okay ok just sure'''.split())
TITLE_SMALL = {'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'of', 'to', 'in', 'on', 'at', 'by', 'up', 'as', 'vs', 'via'}


def words_of(s):
    return re.findall(r"[A-Za-z0-9][A-Za-z0-9'’\-]*", s)


def parse(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    title = ''
    for ln in lines:
        m = re.match(r'^#\s*Title:\s*(.*)$', ln.strip())
        if m:
            title = m.group(1).strip(); break
    vo, in_vo, in_comment = [], False, False
    for ln in lines:
        st = ln.strip()
        if '<!--' in st and '-->' not in st:
            in_comment = True; continue
        if in_comment:
            if '-->' in st: in_comment = False
            continue
        if st.startswith('## '):
            in_vo = st[3:].strip().lower().startswith('vo'); continue
        if in_vo and st and not st.startswith('<!--'):
            vo.append(st)
    return title, vo


def unverified_tokens(research):
    if not research or not os.path.exists(research):
        return []
    txt = open(research, encoding='utf-8').read()
    m = re.search(r'^##\s*UNVERIFIED.*?$(.*?)(^##\s|\Z)', txt, re.M | re.S | re.I)
    if not m:
        return []
    toks = set()
    for b in re.findall(r'^\s*-\s*(.+)$', m.group(1), re.M):
        b = re.sub(r'https?://\S+', '', b)
        for t in words_of(b):
            if re.search(r'\d', t) or (t[0].isupper() and len(t) > 3 and t.lower() not in STOP):
                toks.add(t.strip("'’"))
    return sorted(toks)


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__); sys.exit(2)
    src = a[0]
    proj = src if os.path.isdir(src) else os.path.dirname(os.path.abspath(src))
    path = os.path.join(src, 'script.md') if os.path.isdir(src) else src
    if not os.path.exists(path):
        print(f'ERROR: no script at {path}'); sys.exit(2)
    dur = None
    if '--duration' in a:
        dur = float(a[a.index('--duration') + 1])
    else:
        pj = os.path.join(proj, 'project.json')
        if os.path.exists(pj):
            dur = json.load(open(pj)).get('duration_s')
    dur = float(dur or 59)
    research = a[a.index('--research') + 1] if '--research' in a else os.path.join(proj, 'research.md')

    title, vo = parse(path)
    tags = [set(re.findall(r'\[(REVEAL|DOUBTER|PIVOT)\]', s)) for s in vo]
    sents = [re.sub(r'\[(REVEAL|DOUBTER|PIVOT)\]\s*', '', s).strip() for s in vo]
    counts = [len(words_of(s)) for s in sents]
    total = sum(counts)
    starts = [sum(counts[:i]) / total if total else 0 for i in range(len(sents))]
    text = ' '.join(sents)
    res = []

    def chk(cid, name, ok, detail, hard=True):
        res.append((cid, name, 'PASS' if ok else ('FAIL' if hard else 'WARN'), detail))

    if not sents:
        print(f'ERROR: no VO lines under "## VO" in {path}'); sys.exit(2)
    target = dur * WPS; lo, hi = round(target * 0.92), round(target * 1.08)
    chk('L1', 'word_count', lo <= total <= hi, f'{total} words; target {round(target)} ({lo}–{hi}) for {dur:g} s')
    chk('L2', 'hook_length', counts[0] <= 11, f'sentence 1 = {counts[0]} words: "{sents[0][:70]}"')
    hook_bad = sents[0].rstrip().endswith('?') or bool(HOOK_BAD.search(sents[0]))
    chk('L3', 'hook_form', not hook_bad, 'statement' if not hook_bad else f'question/"did you know" form: "{sents[0][:70]}"')
    dl = [i for i, s in enumerate(sents) if ('DOUBTER' in tags[i] or DOUBT.search(s)) and starts[i] <= 0.35]
    chk('L4', 'doubter', bool(dl), f'line {dl[0] + 1} at {starts[dl[0]]:.0%}: "{sents[dl[0]][:60]}"' if dl else 'no doubter/mockery line in the first 35 %')
    pv = [i for i, s in enumerate(sents) if ('PIVOT' in tags[i] or PIVOT.search(s)) and 0.25 <= starts[i] <= 0.75]
    pv_any = [i for i, s in enumerate(sents) if 'PIVOT' in tags[i] or PIVOT.search(s)]
    chk('L5', 'pivot', bool(pv), f'line {pv[0] + 1} at {starts[pv[0]]:.0%}' if pv else (f'pivot at {starts[pv_any[0]]:.0%} (needs 25–75 %)' if pv_any else 'no "You see," pivot'))
    rv = [i for i in range(len(sents)) if 'REVEAL' in tags[i]]
    if len(rv) != 1:
        chk('L6', 'reveal_position', False, f'{len(rv)} [REVEAL] lines (need exactly 1)')
    else:
        p = starts[rv[0]]
        chk('L6', 'reveal_position', 0.55 <= p <= 0.85, f'[REVEAL] starts at {p:.0%} of the words (55–85 %, refs 59–81 %)')
    q = re.findall(r'"[^"]{2,}"|“[^”]{2,}”', text)
    chk('L7', 'quote', bool(q), q[0] if q else 'no quoted punch-line')
    nums = [t for t in words_of(text) if re.search(r'\d', t) or t.lower() in NUMWORDS]
    chk('L8', 'numbers', len(nums) >= 2, f'{len(nums)} found: {", ".join(nums[:8])}')
    abstract = [i + 1 for i, s in enumerate(sents) if not [w for w in words_of(s) if w.lower().strip("'’") not in STOP and len(w) > 2]]
    chk('L9', 'drawable_noun', not abstract, 'ok' if not abstract else f'lines {abstract} have no concrete word', hard=False)
    tw = words_of(title)
    bad_case = [w for i, w in enumerate(tw) if w[0].isalpha() and w[0].islower() and (i == 0 or i == len(tw) - 1 or w.lower() not in TITLE_SMALL)]
    chk('L10', 'title', bool(title) and 4 <= len(tw) <= 8 and not bad_case,
        f'"{title}" ({len(tw)} words)' + (f'; not capitalised: {bad_case}' if bad_case else '') if title else 'no "# Title:" line')
    pat = re.match(r'^(The\s+\S+.*\s+That\b|Why\b|Levels of\b|How\b|The\b)', title or '')
    chk('L10', 'title_pattern', bool(pat), 'curiosity pattern ok' if pat else 'not "The X That…/Why…/Levels of…/How…"', hard=False)
    out = OUTRO.search(sents[-1])
    chk('L11', 'ending', not out, f'last line: "{sents[-1][:70]}"' + (f' — outro word "{out.group(0)}"' if out else ''))
    toks = unverified_tokens(research)
    hit = [t for t in toks if re.search(r'(?<![A-Za-z0-9])' + re.escape(t) + r'(?![A-Za-z0-9])', text, re.I)]
    chk('L12', 'unverified', not hit, (f'UNVERIFIED tokens in script: {hit}' if hit else f'{len(toks)} UNVERIFIED tokens checked') if os.path.exists(research) else 'no research.md (skipped)')

    for cid, name, st, det in res:
        print(f'{cid:4s} {name:16s} {st:4s}  {det}')
    bad = [r for r in res if r[2] != 'PASS']
    if bad:
        print('\nFIX PLAYBOOK:')
        for cid, name, st, _ in bad:
            print(f'  [{st}] {cid} {name}: {FIX[cid]}')
    nfail = sum(1 for r in res if r[2] == 'FAIL')
    print(f'\nREMINDER (not machine-checkable): the last line must flow back into line 1 (loop); every noun drawable.')
    print(f'SCRIPT_LINT: {"FAIL" if nfail else "PASS"} ({nfail} hard failures, {sum(1 for r in res if r[2] == "WARN")} warnings) — {total} words, ~{total / WPS:.1f} s at 3.66 w/s')
    sys.exit(1 if nfail else 0)


if __name__ == '__main__':
    main()
