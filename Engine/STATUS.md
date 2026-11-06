# Build status — read this first when continuing the studio build (last update 2026-11-05, home session 3)

## How to continue
Open the `3D Youtube Studio` folder in Claude Code and say: **"Continue building the studio — read Engine/STATUS.md."**
First run `bash Engine/scripts/doctor.sh` (on a new machine it lists anything to install).
Platform note: `Engine/studio/node_modules` was installed on an Apple-Silicon Mac. On a different OS/CPU run
`cd Engine/studio && rm -rf node_modules && npm install --no-bin-links`.

## The user's goal (their words, condensed)
Self-contained `3D Youtube Studio/` on the SSD: `Engine/` holds everything, `Projects/` holds one folder per video
(final video, thumbnail, production texts). They open the folder in Claude, say "create a video", and the workflow runs
(questions → research → … → output in the project folder). Videos: 3D toon stick characters in a detailed toon world,
like the 4 reference Shorts in `Engine/references/videos/`, made by following the method in `guide.mp4` (measure the
references numerically → style bible → gate test shot scored by 5 lenses → fix → full Short → timestamped fix loops →
camera rig with gates → SFX from animation cues → compare to reference numbers). The workflow must be so explicit
(scripts with PASS/FAIL gates, playbooks, templates, examples) that a smaller model can produce Opus-level results.
The user said the questioning/research phases will be discussed with them later.

## Done (tested)
- Reference measurement: `measure_short.py`, `build_reference_numbers.py` → `references/reference_numbers.json`;
  `compare.py` (PASS/FAIL vs references). All 4 references pass the hard gates.
- Engine: ToonCharacter (3D toon, plum ink #2A1B26, 13 hats, pose-to-pose), ink hulls (`ink.tsx`), pure camera
  (`camera.ts`), blocking (`blocking.ts`), hand-driven post (motion blur, DOF, bloom, grade).
- `cam_dump.mjs` + `cam_qa.py`: 17 camera/blocking gates (verified on good and deliberately bad specs).
- `qa_frames.py`: blank / flicker (P1) / pop & cut (P2) / frozen / occluded / exposure + review sheets labelled with
  spoken word + shot beat. 0 false P1 on the 4 references; known limits in its docstring.
- Gate shot `examples/00_gate` (3.6 s pirate deck): cam_qa 17/17, compare 0 hard fails.
- SKILL.md state machine (`.claude/skills/stickworld-video/SKILL.md`), `references/qa-rubric.md`, `CLAUDE.md`,
  `scripts/doctor.sh`. All scripts run from the SSD (paths relative to Engine, spaces-safe, no npx).
- Session 2 (home): `references/fix-playbook.md` (every gate/check id: cam_qa G1–G17, compare metrics, qa_frames kinds,
  rubric C/A/K/S/T, and the ids the unbuilt linters MUST print: script_lint L1–L12, plan_lint PL1–PL10,
  sfx SX1–SX3, mix MX1–MX4, thumbnail TH1–TH2), `references/topic-rubric.md` (S1–S6 weighted /10, calibrated on the
  4 refs), `style-bible.md` §M (the 15 measured rules) + rewritten §2.1/2.3/5/6/9.1/11 (3D toon, ink #2A1B26,
  pose-to-pose no sway, dissolves 8 f at 11–21/min, Archivo Black 1–2 words, static bed −20 dB no ducking, mono).
- Templates: `templates/project/` (project.json, script.md, research.md, shotlist.json, scenes/{camera,blocking,cast,
  sfx}.ts + index.tsx, public/words.json) + `references/examples/shotlist_example.json`. Template renders and passes
  cam_qa 17/17 (tested in a scratch root).
- `scripts/new_project.py`: `<slug> --title`, `--set-phase <dir> <phase>` (validated + history), `--set <dir> k=v`,
  `--status [dir]`, `--root` for tests. Skips `._*` files.
- Engine: `engine/cast.ts` (CastMember, defineCast, placeOf); props `Ink` = engine plum brush-weight hull with
  crease-smoothed normals (drei Outlines removed from props) + ink on rails/balusters/hoops/lantern cap; `Clouds` =
  puffy 3D toon clusters; Captions = Archivo Black, 1–2 words, thin stroke (cap 39.5 px on the estimator).
- qa_frames.py: fixed crash on re-run (exFAT `._` sidecar vanishes when its jpg is deleted).
- Gate shot v2 (`examples/00_gate`, ported to the cast.ts split, test VO via macOS `say`): cam_qa 17/17, qa_frames 0 P0/P1,
  value 0.77 → 0.586, sat 0.47, lenses 10/10/7/7/9. compare PASS — gate shots now skip `median_beat_gap_s`
  (user decision 2026-11-05; compare `--skip` accepts single metric names). **Gate v2 PASSES.** Log: `examples/00_gate/work/gate_log.md`.
- Session 3 (home): ALL pipeline scripts built and tested —
  `script_lint.py` (L1–L12; good script PASS, bad script 11 hard fails), `tighten_vo.py` (V1–V2; slow paused take:
  14 gaps cut, 3.04 → 3.48 w/s, whisper confirms 0 pauses > 0.33 s), `plan_lint.py` (PL1–PL10), `sfx_cues.mjs`
  (cues from camera peaks/dissolves/shakes, cast face swaps/beats/fx/held coins, footsteps, onomatopoeia, SFX_EXTRA;
  SX1–SX2), `sfx_synth.py` (26 procedural SFX kinds, 8 ambiences, ~100 BPM marimba bed with climax swell + --drop;
  numpy only, deterministic; `--demo` to audition), `mix.py` (static bed −20 dB, no ducking, mono, −14 LUFS, 4×
  oversampled limiter → TP −2.3; MX1–MX4), `thumbnail.py` (--suggest + clean caption-free still via
  render.sh SW_PROPS='{"noCaptions":true}'; TH1–TH2). 64 s end-to-end audio test: MIX PASS, compare wps 3.47, pause 0.16,
  −14.2 LUFS, −2.3 dBTP. Gate audio: MIX PASS.
- MEASURED: voice in the 4 reference masters = −13.6…−14.4 dBFS RMS on speech frames (not the guide's −17.5) → MX1
  uses −13.8 ± 1.5; style-bible §M + §11.2 and fix-playbook updated.
- render.sh: SW_PROPS env → Remotion `--props`; Captions return null when input prop noCaptions is true.

- Cost ledger (user rule 2026-11-06): `scripts/ledger.py` + `<studio>/ledger.md` (one row per video, 26 metric
  columns: tokens by kind, models, API/tool calls, web searches, wall/active time, sessions, renders, fix loops, video
  length, API-equivalent cost, paid extras, total, cost per video-minute). Data: Claude Code transcripts
  (~/.claude/projects/-Volumes-ssd-3D-Youtube-Studio/**/*.jsonl, de-duplicated per requestId) + work/render_log.jsonl
  (render.sh) + `ledger.py extra`. Booked automatically by new_project.py (create + every --set-phase); `ledger.py begin`
  starts the clock. Prices: references/pricing.json (as of 2026-10-06; web-search price unconfirmed). Rules in CLAUDE.md
  + SKILL.md. Tested end to end (scratch root); closed phases are re-measured each update (log lines flush late).
  Measured: building the studio on this machine so far ≈ $16.73 API-equivalent (162 Opus 5.5 calls, 1h03m active).

## Left, in this order
1. Build one full Short end to end through the skill (v1 → timestamped fixes → v2). Every phase now has its script.
   Needs from the user: a topic (Phase 1) and the VO recording (Phase 5); music is procedural unless they supply a
   licensed track.
2. Engine: the `grin` face decal reads as gritted teeth (use `happy` for joy until fixed in character/draw.ts);
   `demo-pirate-slice` still uses StickCharacter (2D) — convert to ToonCharacter + camera/blocking/cast.ts.
3. Gate polish (optional, gate already PASSES): S1 foreground element on the f82 push + T6 gull/cat on the rail.
4. Open measurement question: refs' word gaps sit only ~1–5 dB under the voice (SFX-dense); the "bed 20 dB under"
   rule is the guide's, not separable in the refs. Re-check by ear/measurement on the first full Short (mix.py MX1
   is calibrated on our own reference measurement, −13.8 dBFS RMS speech frames in the master).

## Gotchas
- SSD is exFAT: no symlinks → `npm install --no-bin-links`; call `node node_modules/@remotion/cli/remotion-cli.js`, never npx.
  macOS writes `._*` files; delete with `find . -name '._*' -delete` if a tool trips on them.
- `@react-three/postprocessing` EffectComposer renders empty frames headless → engine uses its own `post/Post.tsx`.
- Zod version-mismatch warning from Remotion is harmless.
- 9:16 frame is only ~1.7 world units wide at 4.6 units distance — keep two-shot characters ~1.5 apart.
- Workflow (multi-agent) tool: only if the user explicitly says "use a workflow".
- Captions/props changes are engine-wide: after engine edits re-run the 00_gate gate (CLAUDE.md rule).
- Measured "beats" are motion peaks mid-move (measure_short MOVE_THR 10): gentle camera drifts are invisible to compare.
- The SSD can unmount mid-session (it did twice on 2026-11-05/06): re-check files exist before continuing; scripts are idempotent.
- Project-level `.claude/settings.json` (auto-allow Engine/scripts commands) was NOT written — the user must approve
  that; until then Claude will ask permission for commands.

## Full history
The complete office build conversation (every decision, measurement and code snippet) is saved at
`Engine/notes/office_session_2026-11-05.jsonl` (JSON lines). When a detail is missing here, grep it, e.g.
`grep -o '.\{200\}tricorn.\{200\}' Engine/notes/office_session_2026-11-05.jsonl | head`.
