# Card — Phases 6–7 (shot plan, gate shot)
Compact extract of style-bible §4, §5, §10, §L.2, §3.2. Open the full style-bible only for a section a check names.

## Beats (plan_lint PL1–PL10)
- A new framing about every 1.7 s: median beat 36–66 f, max 90 f. First change ≤ 45 f, 2 changes in 0–3 s.
- Every sentence starts a beat. Every beat has a `sync` word that exists in words.json at that time; its visual is
  on screen within ±3 f of the word (concrete nouns, numbers, action verbs, emotion words).
- `cast` = **only characters who will be ON SCREEN in that beat** (cam_qa G18 checks it). An object-only beat gets
  `cast: []`. Actor ids in blocking.ts are `<castId><n>` (cast "watts" → `watts12`).
- Emotion words get a face swap on the word; action verbs get the action on the word.

## Sets and flight
- 7–10 bespoke sets per 60 s, mostly warm and bright, along one flight path.
- Multi-set (§L.2): each set in its own world region (`origin = [i·500, 0, 0]`), one camera track per set (`CAMERAS`).
  The swap happens at the dissolve midpoint. Pattern: `Projects/01_dutch-water-line/scenes/{plan,camera,index}.ts(x)`.
- Set change = camera flight (rise, bank, swoop, push through a window or hole), or an **8 f dissolve** (6–12) with the
  camera moving on both sides. Hard cuts: ≤ 1 per Short, only on a big impact.
- Mix of moves: push 26 %, pull 16 %, whip 13 %, pan 8 %, tilt 4 %, plus orbit and crane. Low angles, macro inserts of
  the mechanism, cut-away cross-sections for the reveal.
- Every framing plans 3 depth layers (foreground blur element, midground action, background vista), ≥ 2 ambient
  motions, and one easter-egg animal per ~15 s.
- Loop: the last frame visually rhymes with the first.

## Gate shot (Phase 7, only for a new set or look)
One 108 f shot of the hardest set + 2 characters, built like Phase 8. Gate: every rubric lens ≥ 7, compare 0 hard fails
(`qa_all.sh gate`), cam_qa all PASS. Log iterations in `work/gate_log.md`.
