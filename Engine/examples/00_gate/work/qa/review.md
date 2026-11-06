# QA review — 5 lenses (fill this in; it is copied into work/qa/review.md)

How to review (do it in this order, do not skip):
1. Read every `flag_*.jpg` strip first (automatic findings), then every `sheet_*.jpg` (one cell per 0.5 s; yellow =
   time, frame, spoken word; blue = shot beat from shotlist.json).
2. For each check write `[x]` (pass) or `[ ]` (fail) **and the frame numbers** of every failure. A check you did not
   actually look at is a fail.
3. Score each lens: **start at 10, −3 per failed MAJOR (M) check, −1 per failed minor (m) check, floor 0.**
4. Gate: every lens ≥ 7 AND no open P0/P1 automatic finding. Fix order: P0 → P1 → M checks → m checks.
5. For every failed check, the fix is in `fix-playbook.md` under the check id (e.g. `C3`).

## Lens 1 — Character (score /10)
- [ ] C1 (M) Every character is a ToonCharacter: white sphere head, plum ink outline (never black), bean torso, ink-tube limbs, ball hands, tiny feet. No 2D billboard / flat sprite characters.
- [ ] C2 (M) No character is clipped by the frame edge (head or > 30 % of the body cut off) unless it is entering/exiting or deliberately a foreground over-the-shoulder element.
- [ ] C3 (M) Feet are on the ground (no float, no sinking) in every cell; contact shadow under every standing character.
- [ ] C4 (M) Faces read at phone size: eyes + mouth visible in every cell where the face is toward camera; the expression matches the spoken word in that cell (shock on the shocking word, smug on the boast).
- [ ] C5 (m) Role is readable from head-wear/outfit alone (tricorn = captain, bandana = deckhand, …); two characters never share a silhouette.
- [ ] C6 (m) Characters take the scene light (warm at sunset, blue at night); no unlit pure-white figure in a dark set.
- [ ] C7 (m) Held props sit in the hand (no gap, no prop through the body).

## Lens 2 — Animation (score /10)
- [ ] A1 (M) Pose-to-pose: every visible character changes pose at least every 1.5 s (45 f); between keys it HOLDS (no idle sway / no floaty drift).
- [ ] A2 (M) Every pose change is a fast attack (3–5 f) — check the flag/pop strips: no slow 15-frame tweens, no 1-frame snaps.
- [ ] A3 (M) Every action verb in the VO is acted on that word (±3 f): "point" points, "throws" throws, "laughing" laughs.
- [ ] A4 (m) Walks travel along paths that avoid people and props (cam_qa G16 passed) and enter/exit through doors/edges, not by appearing.
- [ ] A5 (m) Secondary motion exists where it should: hats/flags/lanterns, sweat drops, shock lines on the shock beat.
- [ ] A6 (m) Talking character's mouth flaps only while that character's line is spoken.

## Lens 3 — Camera & post (score /10)
- [ ] K1 (M) cam_qa.py all gates PASS (paste the `CAM_QA: N/N` line; 19 with shotlist + blocking). The camera never parks; no braking at waypoints; no spin.
- [ ] K2 (M) A new framing at least every ~1.7 s on the sheets (median beat gap 1.2–2.2 s in compare.py).
- [ ] K3 (M) The subject of each beat is in focus (DOF focus follows the subject); foreground blur only on foreground elements.
- [ ] K4 (M) No camera inside/through geometry (no flat-colour fill frames; qa_frames 'occluded' = 0).
- [ ] K5 (m) Motion blur appears on fast moves only and outlines stay crisp on held subjects.
- [ ] K6 (m) Transitions: set changes are flights or 8-f dissolves with the camera moving on both sides; ≤ 1 cut.
- [ ] K7 (m) Framing is designed: horizon not centred-flat unless intended, subject on a third, no big empty sky area > 40 % of frame.

## Lens 4 — Sets, colour & captions (score /10)
- [ ] S1 (M) Three depth layers in every cell: foreground element, midground action, background vista.
- [ ] S2 (M) Ink on every prop (barrels, crates, rope, rails, cannons, buildings) — nothing reads as untextured flat plastic.
- [ ] S3 (M) Colour within reference: compare.py saturation 0.36–0.56 and value 0.42–0.70 (paste); one dominant hue per 10–15 s act.
- [ ] S4 (M) Captions: present on every spoken word, 1–2 words, white with dark stroke, never over a face, inside the safe band (y ≈ 60–72 %).
- [ ] S5 (m) ≥ 2 ambient motions per cell (motes, water ticks, gulls, flags, smoke, lantern swing).
- [ ] S6 (m) Story signage: at least one labelled prop per set that names the story object (RUM, GOLD, "PATROL LOG"), spelled correctly.
- [ ] S7 (m) Clouds/sky are dimensional (puffy, shaded), not cardboard cut-outs; sky never > 40 % of the frame for > 1 s.
- [ ] S8 (M) RICHNESS (style-bible §L): put one still next to a reference frame (Engine/references/videos). Cast shadows
  visible, warm/cool light contrast, ground cover (grass/flowers/reeds/stones), painted detail on every prop and costume,
  a hazed backdrop layer, sun rays/glints where the sun is in frame. Any bare ground / flat-colour area > 15 % = fail.

## Lens 5 — Story alignment (score /10)
- [ ] T1 (M) Right visual at the right time: in each sheet cell, the blue beat label's `sync` object is visible while its yellow word is spoken (±3 f). List every miss with frame.
- [ ] T2 (M) Hook: a strange action is visible by 1.0 s; first framing change by 1.5 s; 2 changes in 0–3 s.
- [ ] T3 (M) Nothing on screen contradicts the VO (wrong count, wrong object, wrong character speaking, wrong era).
- [ ] T4 (M) The mechanism reveal (last ~30 %) is shown concretely (cut-away, macro insert, diagram-in-world), not just told.
- [ ] T5 (m) The payoff ends on the image (no hold after the last word > 0.5 s) and the last frame rhymes with the first (loop).
- [ ] T6 (m) Easter-egg life: at least one small extra (cat, gull, frog) per 15 s.

## Scores
| Lens | Failed M | Failed m | Score |
|---|---|---|---|
| 1 Character | | | |
| 2 Animation | | | |
| 3 Camera & post | | | |
| 4 Sets, colour, captions | | | |
| 5 Story alignment | | | |
| **Overall (mean)** | | | |


## Automatic findings (fix every P0/P1)
- [ ] P2 pop @ 1.87s (f56): block diff 145 vs local 47, 19% of pixels changed (local, persists) — check strip: intended pose/caption/prop change? → Something appears/disappears/teleports in 1 frame: check character enter/exit, path keys, visibility toggles, prop mounts at this frame. If intended, add it to TRANSITIONS (cut) or make it a dissolve.
- [ ] P2 pop @ 2.23s (f67): block diff 118 vs local 42, 16% of pixels changed (local, persists) — check strip: intended pose/caption/prop change? → Something appears/disappears/teleports in 1 frame: check character enter/exit, path keys, visibility toggles, prop mounts at this frame. If intended, add it to TRANSITIONS (cut) or make it a dissolve.
- [ ] P2 pop @ 2.4s (f72): block diff 90 vs local 32, 19% of pixels changed (local, persists) — check strip: intended pose/caption/prop change? → Something appears/disappears/teleports in 1 frame: check character enter/exit, path keys, visibility toggles, prop mounts at this frame. If intended, add it to TRANSITIONS (cut) or make it a dissolve.
- [ ] P2 pop @ 2.97s (f89): block diff 120 vs local 35, 11% of pixels changed (local, persists) — check strip: intended pose/caption/prop change? → Something appears/disappears/teleports in 1 frame: check character enter/exit, path keys, visibility toggles, prop mounts at this frame. If intended, add it to TRANSITIONS (cut) or make it a dissolve.
