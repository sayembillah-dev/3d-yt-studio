# Card — Phase 8 (build)
Compact extract of style-bible §L, §2, §3, §6. Open the full style-bible only for a section a check names.
**Before writing set code, read `Engine/references/props-catalog.md`.** Reuse props first. New reusable props go in
the theme file (`props/<era-or-theme>.tsx`), never as one-off project code. Re-run `props_catalog.mjs` after adding.

## Look (engine defaults; don't fight them)
- Sun cast shadows, SSAO, god rays, split-tone grade: all automatic in `<Stage>`. Characters cast shadows but never
  receive them.
- Moods: prefer `golden` / `sunset` / `goldenMorning` over flat `day`. Saturation 0.40–0.51 comes from warm/cool
  contrast plus detail, not oversaturated sky or water. `lerpMood` blends moods inside a layer.
- Every exterior: ground cover (GrassField / Flowers / Reeds / Rocks), ≥ 3 LeafyTree / Bush, and a Hills / TreeLine /
  Backdrop layer. No bare ground, no empty horizon; any flat area > 15 % of frame fails S8.
- Ink `#2A1B26` on every prop (`Inked`, or any catalog prop). Painted, hand-illustrated surfaces, never flat grey.
- Every frame: foreground (often DOF-blurred), midground action, background vista; ≥ 2 ambient motions (motes, smoke,
  flags, water ticks, birds, lantern swing); story signage spelled right; one easter-egg animal per ~15 s.

## Characters (`ToonCharacter` only)
- Pose-to-pose: a key every 12–45 f per visible character, 4 f attacks (automatic), then HOLD. No idle sway or bob.
- Faces swap on the sync word (0–1 f). Gestures land on their word (anticipation may start 2–3 f early).
- Head-wear defines the role; no two characters share a silhouette. Props sit in the ball hand.
- Feet on the ground (ROOF_Y / DECK_Y in multi-level sets). Walks follow blocking paths (G16), entering through doors
  or frame edges.
- Framing (G18/G19): look targets at head height (feet + 0.85 × height) for close shots, so heads aren't cut; every
  shotlist cast member is in frame in their beat.

## Code rules (checked before render)
- **All hooks above any early `return`** and never inside if / loops: `preflight.mjs` PF2 (React #310 crash on #02).
- Types must check: PF1. Run `node Engine/scripts/preflight.mjs <project>` (render.sh also runs it).
- One file per concern: camera.ts / blocking.ts / cast.ts / sfx.ts / index.tsx (table in SKILL.md Phase 8).
- Captions: `<Captions words={words} />` defaults (1–2 words, Archivo Black, ~70 % height, never over a face).
- Camera: waypoints on beat frames, ease `flow`, never brake; `cam_qa` all PASS before rendering stills.
