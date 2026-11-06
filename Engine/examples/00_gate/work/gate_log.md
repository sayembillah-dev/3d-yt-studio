# Gate log — examples/00_gate (pirate deck, captain + deckhand, 3.6 s / 108 f)

Gate (SKILL Phase 7): every lens ≥ 7 · compare 0 hard fails (`--skip voice,audio,duration,dissolves_per_min,median_beat_gap_s`) · cam_qa 17/17.

## v1 (office session, 2026-11-05) — before this log
value 0.77 (washed out), props on drei Outlines, flat cloud cards, deckhand clipped f15–45, Nunito 3-word captions.

## v2 (2026-11-05, home session) — engine + scene fixes
Engine: props/basic.tsx `Ink` → engine plum brush-weight hull (crease-smoothed normals) + ink on rails/balusters/hoops/
lantern cap · world/Sky.tsx `Clouds` → puffy 3D toon clusters with flat base · Captions → Archivo Black, 1–2 words,
thin stroke · new `engine/cast.ts` (CAST convention).
Scene: ported to camera/blocking/cast/sfx split; test VO line (macOS `say`, transcribed) for captions + sync; mast via
`Inked`; mood sun 2.2 / fill 0.85 + grade tint #E4DFD8 + sat 0.88; darker deck; barrels/crate moved into frame;
two characters 0.7 apart; camera keys 0/36/82/108 (bold hook swoop, never reverses).

Loops (fix-playbook ids): T1 rum off-screen → barrels moved + armL point · C2 captain clipped f57 → two-shot pushes ·
G2 brake at f78 (path reversed) → end key continues the arc · beats_in_first_3s 1 → bolder hook swoop (fixed) ·
median_beat_gap_s 0.87–1.10 → 4 loops, STOPPED (see open issue) · C2 deckhand clipped f30–60 → key f36 recentred fov 40 ·
C4 `grin` decal reads as gritted teeth on "gold." → `happy`.

### Numbers (final v2 render work/Gate.mp4)
```
CAM_QA: 17/17 gates pass
qa_frames exit 0 — 0 P0/P1; P2 pops at f56/f67/f89 = planned pose keys (captain f55, deckhand f72, captain f88)
median_beat_gap_s 1.08 [1.2,2.2] hard FAIL   first_beat_s 0.867 PASS   beats_in_first_3s 2 PASS   hard_cuts 0 PASS
longest_hold_s 0 PASS   saturation 0.47 PASS (refs 0.40–0.51)   value 0.586 PASS (refs 0.46–0.62; was 0.77)
caption_cap_px 39.5 PASS (refs 41–44)
RESULT: FAIL (1 hard failure)
```

### 5-lens review (sheet_00.jpg, cells every 15 f)
| Lens | Failed M | Failed m | Score | Notes |
|---|---|---|---|---|
| 1 Character | — | — | 10 | ToonCharacter, plum ink; f60 deckhand ~15 % at edge (< 30 %, passes C2); "gold." happy, "panicked." panic |
| 2 Animation | — | — | 10 | keys ≤ 36 f apart, holds, point on "rum" f24, recoil + sweat/shock lines on "panicked" |
| 3 Camera & post | K2 (median gap 1.08 s) | — | 7 | cam_qa 17/17; DOF follows captain → deckhand at f64 |
| 4 Sets, colour, captions | S1 (no foreground element f75–105) | — | 7 | ink on every prop, RUM/GOLD signage, puffy clouds, captions never over a face |
| 5 Story alignment | — | T6 (no easter-egg animal) | 9 | rum f30 ✓, coin on "gold." ✓, panic on "panicked." ✓; T4/T5 n/a for a gate shot |
| **Overall** | | | **8.6** | every lens ≥ 7 |

### Open issue — why the gate is still FAIL
`median_beat_gap_s` on a 3.6 s clip is the median of ONE gap between the 2 measured motion peaks. The detector puts a
peak mid-move; with cam_qa G6 (key #2 ≤ 45 f) and G4 (key gaps ≥ 36 f) the two peaks land 31–33 f apart (1.03–1.10 s).
Stopped after 4 loops (playbook rule). Options for the user: (a) skip `median_beat_gap_s` for gate shots (it is a
whole-video statistic, like duration), or (b) lengthen gate shots to ~5 s (150 f) so 3 moves give 2 gaps.
Next fixes if continuing: S1 foreground (a rope coil / railing post close to the lens on the f82 push), T6 a gull or
cat on the rail.

## Decision (2026-11-05): gate shots skip `median_beat_gap_s`
User asked for a recommendation; chose: skip it for gate shots only (whole-video statistic, one gap on 3.6 s; pacing still
gated by cam_qa G4–G7, first_beat_s, beats_in_first_3s). compare.py `--skip` now also accepts single metric names
(before, `duration`/`dissolves_per_min` in the skip list were silently ignored — harmless, both are soft).
```
compare.py --skip voice,audio,duration,dissolves_per_min,median_beat_gap_s → RESULT: PASS (0 hard failures)
CAM_QA: 17/17 · qa_frames exit 0 · lenses 10/10/7/7/9
```
**GATE v2: PASS.** Still worth doing (score polish, not blocking): S1 foreground element on the f82 push, T6 gull/cat.
