# Making a new video faster and cheaper: deep analysis

This analysis is built from video #01, *Why the Dutch Drowned Their Own Farms* (58 s Short).
- **Cost:** 3h59m wall time, 1h56m Claude-active, 233 API calls, **$29.06** API-equivalent.
- **Data:** I re-read every API call in the Claude Code session logs (context size, cache reads/writes and output per
  call), every tool result, and `work/render_log.jsonl`. My model of the calls adds up to $29.46, within 1.5 % of the
  ledger.

Nothing on this page has been implemented yet. Section 5 is the to-do list.

## TODO (user, 2026-11-06): build `beat_predict.mjs` after all
It was skipped because on #01 the camera path explained only ~half the measured motion (correlation 0.5): beats also
come from characters and caption pops. Next attempt should model those too: camera speed peaks + dissolves (cam_dump)
+ cast.ts pose keys / face swaps + caption chunk swaps (words.json), calibrated against the measured beats of #01, #02
and 00_gate (`work/*_measure/motion.csv`), and validated against `render.sh pace` before it may gate anything.

## Status (2026-11-06): #9 built: look only at changed pictures
`qa_frames.py` keeps each sheet cell's 90×160 signature (`work/qa/cells_sig.npz`) and the last round's flags, and writes
`work/qa/to_review.json`: only sheets with a changed cell (worst 8×8 block diff > 6/255, or a changed word/beat
label) and only new flag strips. Tested on #01's scene: a second, independent render gives 0/5 sheets (block diffs
< 2); a red box on f600–700 lists only sheet_01 (f600–690); `--all` gives 5/5. QA fix rounds re-read only what moved;
round 1 still reads everything (G18 showed the eye check matters).

## Status (2026-11-06, Tier 4): #10, #11, #13 built; #12 measured, default now 3

- **#12 Render concurrency, measured** on the Mac mini (M-series, 10 cores, 16 GB), full render of #01's scene
  (1746 f, 1080×1920, bundling included), one run each in this order:

  | Concurrency | 4 | 2 | **3** | 6 | 8 | 4 (repeat) |
  |---|---|---|---|---|---|---|
  | Seconds | 114 | 104 | **95** | 113 | 120 | 115 |

  The repeat of 4 landed within 1 s, so the noise is small, and **3 is ~17 % faster** than the old default: the GPU,
  not the CPU, is the limit, and more parallel tabs just contend for it. Default is now 3 (`render.sh`,
  `remotion.config.ts`). Not yet measured on the 8 GB MacBook; there, 2–3 also uses less memory. Re-test with
  `SW_CONCURRENCY=2|3` the first time you render there.

- **#10 Model per phase group.** SKILL.md's handoff table now sets the Agent `model`/`effort` per group: shot plan →
  gate and build run on `opus` at full effort; QA (Phase 9) inherits the session model; the new **finish** group
  (Phases 10–12, split out of the old QA→deliver group) runs on `sonnet` at `low` effort, as do gate re-runs with no
  code change. These are aliases, never version names. Untested on a real video; #03's ledger will show the split.
- **#11 Phase cards.** `Engine/references/cards/{script,shotplan,build,finish}.md`, each 1.5–2.6 KB (~400–650 tokens);
  `qa-rubric.md` already serves as the QA card. SKILL.md and the subagent template now say to read the card and to open
  style-bible or fix-playbook only at the section a failed check names. The 24 KB style bible is no longer read up front.
- **#13 Prop library.** The library by theme already existed (basic, dutch, nature, world, town, tower: 96 exports).
  What was missing was a way to find props without reading ~1,700 lines of code. `Engine/scripts/props_catalog.mjs`
  writes `Engine/references/props-catalog.md` (one line per prop with its parameters and comment, ~3k tokens).
  `--check` fails when a prop was added without re-running it. Phase 8 reads the catalog first, and its gate includes
  `--check`.

## Status (2026-11-06, later): Step 5 built + two new fixes from video #02's data; Step 6 phase cards not started

**Video #02 measured (stopped at audio, so not a full comparison):** $14.78 vs #01's $29.06, active time 1h22m vs
1h56m, renders 11.2 min vs 94.5 min (full renders 40–96 s each). Most calls ran on Sonnet (195 Sonnet, 4 Opus). The
handoff-note design held up on a real video.

**5. Geometry preflight. Built as cam_qa G18/G19 (projection) + `preflight.mjs` (code):**
- `cam_qa` **G18 cast_in_frame**: every character shotlist.json names for a beat must be on screen in the middle half
  of that beat. It projects feet and head through the camera, with heights from cast.ts (cam_dump now exports them).
  Spot-checked against stills: #02 b05/b12/b13/b14 (f180/f522/f570/f617) and #01 b17 (f895) really don't show the named
  character. QA had passed all of them. A second check against #01's delivered `final.mp4` (f100/f160/f560/f1700) also
  matched, with no false positives. A cast id with no actor named `<castId><n>` now fails too (#02's "neighbour" was
  actor `nbr11a`). On the old files: #01 has 21 misses, #02 has 19. Naming rule added to SKILL.md Phase 6/8 and the template
  blocking.ts.
- `cam_qa` **G19 head_in_frame**: a medium/close character's head is above the frame top for ≥ 6 f. On #02 it finds
  f755–766 and f1124–1130, two of the three head cuts QA found by eye (it misses f1140).
- `Engine/scripts/preflight.mjs` (~2 s, run by `render.sh` before every bundle): **PF1** TypeScript check of the engine
  plus project scenes (TypeScript was installed all along; exFAT just has no `.bin` links), and **PF2** React rules of
  hooks. #02 crashed mid-render on a hook after an early return; PF2 catches that and PF1 catches type errors (both
  tested with injected bugs). `PREFLIGHT_SKIP=1` bypasses it.
- Not covered: occlusion (a character behind a wall counts as visible), floating props, feet vs ground height.

**New: wps gate fixed at Phase 5.** #02's VO was **3.198** w/s at the voice step. `transcribe.py` printed it rounded
to "3.2", so it was read as a pass, and it then failed the final compare at 3.15 (the mix re-transcribed over music
drifts: +0.4 % on #01, −1.5 % on #02). `transcribe.py` now prints V1/V2 with 3 decimals and a 2 % WARN band
(3.264–4.018), and `--gate` sets the exit code (the default exit is unchanged, because measure_short relies on it). The fix text no
longer says "add words", which doesn't raise wps at the same pace, and caps atempo at 1.05.

00_gate after all of this: preflight PASS, cam_qa 18/18 (no shotlist, so no G18), qa_frames 0 P0/P1, compare PASS.

## Status (2026-11-06): Steps 1–4 built and tested; Steps 5–6 not started

**4. Tier 2 (render time). Measured 2026-11-06 on #01's real scene (58 s, 1746 frames), idle M1, incl. bundling:**

| Render | Time | Numbers vs. full size |
|---|---|---|
| full size `video` (1080×1920) | **97–106 s** (two runs) | — |
| `preview` (270×480, full look) | 98–119 s | identical: all 42 beats on the same frames, every gate value equal |
| `pace` (270×480, cheap look) | 39–56 s | 41/42 beats within 3 f; same median gap, beats in 3 s, holds, dissolves; first beat +1 f |
| `splice` 60 frames into a render | 49–56 s full size, 14 s preview size | spliced frames match a fresh render (two same-day renders agree ≥ 41 dB on every frame) |

- **The big finding: #01's render time was the machine, not the picture size.** The same full render took 857–913 s
  during #01 and 97–106 s today, ~8× faster with no engine speed change. The slowdown grew with scene size (gate shot
  only 2–3× slower then), which points to memory pressure on 8 GB (Claude + VS Code + Chrome renders) — or the webpack
  cache on the exFAT SSD, moved to the internal disk the same day (not re-tested: it unmounted the SSD twice).
  `render_log.jsonl` now records size + look per render, so #02 will show which. On an idle machine a full render
  is ~2 min, so the Phase 9 loop stays full size; `preview`/`pace`/`splice` are for slow days and long-form
  (a 10-min 16:9 video is ~18k frames, ~15+ min even at today's speed).
- **`beat_predict.mjs` was NOT built, on purpose.** On #01 the camera path explains only about half the measured
  motion (correlation 0.5): many beats come from characters and caption pops, not the camera — which is why the gap
  sat at 1.05–1.2 s. A camera-only prediction would be wrong in exactly the direction that cost the renders, and a
  formula fitted to #01 could wrongly fail future videos with a different style. `pace` measures the real number
  for any video in under a minute instead.
- Built: `render.sh preview|pace|splice`, `splice.py`, an engine `measure` prop (Stage/Post: no AO / god rays /
  MSAA, 1024 shadow map — only when asked for), `qa_all.sh pace`, a size check in `qa_all.sh final` (final.mp4 must
  match the composition's size: a preview can never be delivered), caption height normalised to long side 1920 in
  `measure_short.py` (portrait and landscape), splice reads the composition size (works for 16:9 too), render
  size + look in the render log, dashboard labels. SKILL.md Phase 9: speed table + which render for which fix.
- Normal renders unchanged: A/B of old vs. new engine differs no more than two runs of the new engine (00_gate
  43.85 vs 43.86 dB; #01 water/crowd frames 940–980: 43.5 dB). 00_gate gate: cam_qa 17/17, qa_frames 0 P0/P1,
  compare PASS.
- Open, not caused by this work: #01's delivered video can't be reproduced bit-exactly from the committed files —
  frames 554–580 and 928–1026 (water sparkles, crowd) differ at ~29–33 dB with the committed engine too.
- Also fixed: `dashboard.command` never opened the browser (Python buffered its "Dashboard:" line; now `python3 -u`).

**1. Phase-group sessions + handoff note.** Built into `.claude/skills/stickworld-video/SKILL.md` — "Working
across sessions" section + a subagent prompt template. From Phase 6 (shotplan) on, the skill hands each
mechanical phase group to a fresh subagent instead of growing one session's context across the whole video; each
group reads/writes `work/handoff.md` (template now in `Engine/templates/project/work/handoff.md`, so every new
project gets one). Caveat: only smoke-tested with a toy task (run one command, report back) — the template
itself is unproven on a real phase group. **The real test is video #02's first hand-off.**

**2. Unused plugins off for this folder.** Done via `.claude/settings.json` → `skillOverrides`, turning off the
~118 social-media/SEO skills (`social-media-skills:*`, `openseo:*`) that were loaded every session without ever
being used here. Takes effect from the next new session in this folder.

**3. Batched stills + `qa_all.sh`.**
- `Engine/scripts/stills.mjs` (called by `render.sh stills`): one Remotion browser+server for the whole batch of
  preview pictures instead of one per frame. Measured ~0.6 s/frame vs. the ~6.8 s/frame this page measured —
  about 10× faster; pixel-identical output, `SW_PROPS`/`SW_SCALE` both still work.
- `Engine/scripts/qa_all.py` + `qa_all.sh` (`qa_all.sh <project> gate|qa|final [Comp]`): bundles cam_qa + qa_frames
  + compare (or mix + compare, for `final`) into one call, one PASS/FAIL table, fix text only for what failed,
  full logs in `work/logs/`. Wired into Phases 7, 9 and 10 of SKILL.md, replacing the separate script calls.
- Both validated against `Engine/examples/00_gate` (cam_qa 17/17, qa_frames 0 P0/P1, compare PASS) and against
  real failures (a deliberately-wrong mode correctly reported and explained the fix).

**Bonus, not in the original plan — added at the user's request:**
- **Advisor checkpoints** (4): after the script draft, after the shot plan, after a gate test shot, and before
  declaring the QA round done — each calls `advisor()` (a stronger reviewer) for a second opinion before the
  video commits further work on top of that decision.
- **Dashboard**: `Engine/scripts/dashboard.command` (double-click launcher) → a local, read-only, plain-English
  page (`dashboard.py` + `dashboard_page.html`) showing the current phase, what Claude is doing right now, recent
  renders, `handoff.md`'s decisions/open issues, and the running cost — no technical terms. Tested against video
  #01's real data (reproduced its exact $29.06 / 3h59m / 1h56m) and confirmed it never writes back to the ledger.

---

## 1. The one law behind the cost

Every API call re-sends the **whole conversation so far** (cached, $0.20 per 1M tokens on Opus 5.5). So:

> **cost of reads ≈ number of calls × average context size**

In #01 the context **never reset**. It started at **74k tokens** and grew steadily to **679k** over 4 hours. There was
no compaction and no new session; the second session was a continuation that carried everything forward.

| Phase | Calls | Avg context per call | Cost | Spent re-reading context | Spent on output |
|---|---|---|---|---|---|
| topic → script (4 phases) | 21 | 84k–120k | $1.06 | $0.41 | $0.31 |
| voice + shot plan | 20 | 127k–140k | $1.12 | $0.51 | $0.37 |
| gate (incl. one-time look upgrade) | 49 | 232k | $4.46 | $2.25 | $1.15 |
| **build** | **81** | **413k** | **$12.60** | $6.64 | $3.86 |
| **QA** | **49** | **614k** | **$7.93** | **$5.99** | $0.99 |
| audio | 3 | 669k | $0.46 | $0.40 | $0.02 |
| thumbnail | 8 | 674k | $1.20 | $1.08 | $0.07 |

**Key finding:** QA and thumbnail did little thinking but cost $9.13, because each call re-read 600k+ tokens of build
history they didn't need. The thumbnail cost $1.20 for about 8 small commands. In a fresh session it would cost about
$0.15.

## 2. What fills the context (where the 679k came from)

| Source | Tokens | Notes |
|---|---|---|
| Starting context, before any work | **74k** | System prompt, CLAUDE.md, tool definitions, and **the list of every installed skill**. This includes about 120 social-media and SEO skills that this studio never uses. Re-read on all 233 calls: about **$3.45**. |
| My own output (thinking, prose, code) | 340k | Only about **92k** of this is actual code and commands (tool inputs). The other **about 250k is reasoning and prose**. |
| Tool results | about 170k | Biggest items: 36 images viewed (contact sheets, flagged frames, about 58k), 77 `cat`/`sed`/`grep` file reads (about 50k), renders and QA prints (about 16k). |
| Your messages, reminders, wrap-ups | the rest | — |

A result read early is paid again on every later call. For example:
- reading `qa-rubric.md` in full (3k tokens) was re-read **149 times**;
- each 1.6k-token contact sheet was re-read about **150 times**.

Viewed one at a time these are cheap ($0.05–0.11 each); the cost comes from carrying hundreds of them.

## 3. Where the time went

| Time sink | Measured | Notes |
|---|---|---|
| Full-video renders | **8 × avg 10.6 min = 85 min** | 4 of the 8 existed only to move `median_beat_gap_s` between 1.05 and 1.28. |
| Still renders | **86 stills in 9.8 min (6.8 s each)** | `render.sh stills` starts a new Remotion/Chrome process **for every frame**, so most of the time is start-up. |
| Gate renders | 8 videos 5.5 min + 20 stills 3.2 min | Fine. |
| Claude generating output | Large share of the 1h56m active time | 340k output tokens, at typical generation speeds, is roughly an hour by itself. About 250k of it is reasoning. |
| Waiting on you | Topic 18m (3m active), voice 15m | The normal question and answer stops. |
| Hardware | M1, 8 cores, 8 GB RAM, render concurrency 4 | CPU ran at 143–237 % during renders. With 8 GB, memory rather than cores is probably the limit, so this needs testing, not just a higher number. |

**Key finding:** the QA phase was 1h50m of wall time but only 15 minutes of Claude-active time. **Rendering is the
time bottleneck, and the main cause is pacing fix loops.**

## 4. What a new video can cost

Simulated on #01's exact call log (same work, same calls, only the context changed):

| Scenario | Cost |
|---|---|
| As it happened | $29.46 |
| New session at 4 boundaries (topic→script · voice→gate · build · QA→deliver) | $22.58 |
| … plus starting context cut from 74k to 40k (unused plugins off for this folder) | $19.65 |
| … plus 30 % less context growth (quiet tool output, partial file reads) | **$18.36** |

That's **−38 % on the same work**. The work itself also shrinks on video #02:

| Phase group | #01 | #02 estimate | Why it shrinks |
|---|---|---|---|
| topic → script | 21 calls, $1.06 | about 20 calls, $1.20 | Same work. A fresh session costs a little more to start. |
| voice → shot plan → gate | 69 calls, $5.58 | about 35 calls, $2.60 | The look upgrade is done; the gate is one check, not a redesign. |
| build | 81 calls, $12.60 | about 50 calls, $4.90 | Engine props, sets, characters and look defaults are reused. New-era props are the main new code. |
| QA → deliver | 63 calls, $9.59 | about 20 calls, $1.20 | Pacing is predicted before render; one `qa_all` call per round. |
| **Total** | **$29.06** | **about $10 (range $9–14)** | |

**Time for #02:**

| | #01 | #02 estimate |
|---|---|---|
| Full renders | 85 min | about 25 min: one preview at quarter resolution plus one final, maybe one fix render |
| Stills | 10 min | about 2 min |
| Claude-active time | 1h56m | about 60–70 min, from fewer calls and less reasoning per call |
| **Wall time** | **3h59m** | **about 1h45m**, plus however long you take to answer questions |

These estimates assume a Short of similar complexity, about 8 sets and 30 characters. A topic needing many new props
(a new era or new vehicles) adds about $2–4 to the build.

## 5. The changes, ranked by payoff ÷ effort

### Tier 1: biggest wins, little work

**1. Start a new session at each phase group: topic→script · voice→gate · build · QA→deliver.**
- Saves about **$7 per video** (measured on #01 above). It also makes each response faster, because a smaller context
  responds faster.
- The skill would end each group by writing a short `work/handoff.md` (decisions, open issues, file pointers).
  `project.json` `phase` already makes resuming exact.
- Your side: when I say "phase group done", open a new session and type "continue the video".

**2. Turn off the unused social-media and SEO plugins for this folder only.**
- Cuts the starting context from 74k to about 40k. That's about **$2–3 per video**, and saves the same on every
  non-video session here.
- This is a settings change you make. I can walk you through it.

**3. Batch the still renders: one Remotion process per batch, not per frame.**
- 86 stills would take about 1.5 min instead of 9.8 min.
- `render.sh` change; the engine gate must still pass.

**4. One `qa_all.sh` with quiet output.**
- Runs cam_qa, qa_frames, compare and mix in a single call, prints one PASS/FAIL table plus failures only, and writes
  full logs to `work/logs/`.
- Replaces 4–6 calls per QA round and stops log text from piling up in context.

### Tier 2: the biggest time win

**5. `beat_predict.mjs`: predict the pacing numbers from the camera path, with no render.**
- `median_beat_gap_s`, `first_beat_s` and `beats_in_first_3s` come mostly from camera speed peaks and dissolves,
  which `cam_dump` already computes in seconds.
- Calibrate it against #01's renders: 1.05, 1.07, 1.20 and 1.28 measured, so 4 data points from the same scene.
- Make it a gate before any full render. Expected: **4 full renders (about 45 min) saved per video**.

**6. Quarter-resolution for every measurement render.**
- Use `SW_SCALE=0.25` for previews, and render full resolution only once, for the final.
- First check that every compare metric reads the same at quarter resolution as at full (one test render pair).

**7. Re-render only changed segments.**
- Render just the affected frame range and splice it into the last good render at a dissolve boundary.
- Needs a splice step in `render.sh` and a check that the seams are clean.

### Tier 3: catch bugs without a render

**8. Geometry preflight in cam_qa.**
- Checks the camera path against prop bounding boxes, and actor feet against ground height.
- In #01, a flower through the lens, a fence fly-through, characters inside the dike slope and a hidden placard each
  cost a render cycle to find (7–15 min each).

**9. Look at fewer pictures.**
- Show me the contact sheet only when a numeric check flags something, or once per phase, not every round.
- In #01, 36 images were about 58k tokens of carried context.

### Tier 4: tuning

**10. Lighter reasoning for the routine phases** (audio, thumbnail, metadata, re-running gates).
- Use Sonnet 5.5, or a lower effort setting. Output is 23 % of cost, and about 73 % of output was reasoning.
- Keep Opus at full effort for script, shot plan, look and build.

**11. Phase cards instead of whole docs.**
- Give each phase one compact checklist (under 1k tokens) and read the full style bible or rubric only when a check
  fails.
- In #01, whole docs were read up front and re-read about 150 times each.

**12. Test render concurrency on this M1 (8 GB).**
- Time `SW_CONCURRENCY=3/4/6` on the 00_gate shot and keep the fastest.

**13. Grow a prop library by era** (`props/<era>.tsx`), so each topic adds reusable pieces and build cost falls video
by video.

### On your side, free

- Put the topic, format and voice choice in the first message. That avoids about 15 min of waiting at the topic step.
- Keep one saved ElevenLabs preset, so the voice step is just dropping in the mp3.

## 6. Order to implement

| Step | What | Saves (est.) | Work |
|---|---|---|---|
| 1 | Phase-group sessions + handoff note (skill edit) | about $7 per video | about 20 min |
| 2 | Unused plugins off for this folder (you) | about $2–3 per video | 5 min |
| 3 | Batched stills + `qa_all.sh` + quiet output | about $1, about 10 min | about 40 min |
| 4 | `beat_predict.mjs` + quarter-res measurement renders | about 45 min per video | about 1–1.5 h |
| 5 | Geometry preflight | about 15–30 min per video | about 1 h |
| 6 | Model/effort per phase, phase cards | about $1–2 per video | about 30 min |

Steps 1–3 alone should bring #02 to roughly **$12–15**. With all six, the estimate is **about $10 and under 2 hours**.
The ledger already measures every one of these, so video #02 will show what actually worked.
