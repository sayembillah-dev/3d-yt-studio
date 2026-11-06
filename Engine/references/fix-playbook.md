# Fix playbook — look up the EXACT id a gate printed, apply the fix, re-run the verify command

How to use:
1. A gate failed. Copy its id exactly as printed (`G5`, `saturation`, `flicker`, `C2`, `L3`, …). Find it below (Ctrl-F the id).
2. Apply the **first** fix that matches the symptom. Change one thing at a time.
3. Run the **Verify** command. Paste its output. If it still fails, try the next fix in the list.
4. Max **4 loops per issue**. Still failing → stop and tell the user: the id, the numbers, what you tried, and why it fails.
5. Never edit gate ranges (`reference_numbers.json`, the `FIX`/threshold constants inside scripts) to make a render pass.

Shorthands: `$P` = project dir, `$S` = Engine/scripts, `E` = Engine/studio/src/engine. Frames are 30 fps (`m:ss × 30`).
Re-render only the affected range: `bash "$S/render.sh" "$P" range <Comp> <from>-<to>`; then QA that file.

---
## 0. Global "it doesn't even run" problems
| Symptom | Fix |
|---|---|
| `BUNDLE FAILED — type errors` from render.sh | Read the first tsc error. Usual: wrong import path (`@engine/...` only), a prop name that does not exist (check the component's type in `E/`), a missing export (`compositions`, `END`, `camera`). |
| `MISSING .../scenes/camera.ts` from cam_dump | The project must keep the camera in `scenes/camera.ts` exporting `END`, `camera`, `TRANSITIONS` (copy from `Engine/templates/project/scenes/camera.ts`). |
| Render hangs at 0 % / `delayRender` timeout | A font or texture never resolved. Fonts load in `E/fonts.ts`; a new font must be added there. Re-run `bash Engine/scripts/doctor.sh`. |
| Script trips on `._*` files | macOS metadata on exFAT: `find "$P" -name '._*' -delete`. |
| `npx` / `.bin` not found | Never use npx. Call `node Engine/studio/node_modules/<pkg>/...` (render.sh already does). |

---
## 1. Camera gates — `cam_qa.py` (G1–G19)
Verify for all of them: `node "$S/cam_dump.mjs" "$P" && python3 "$S/cam_qa.py" "$P"` → must print `CAM_QA: N/N gates pass` (19 with a shotlist + blocking; G18 needs shotlist.json, G16–G19 need blocking.ts).
All camera data lives in `$P/scenes/camera.ts` (`camera.keys`, `camera.drift`, `camera.shakes`, `TRANSITIONS`).

### G1 never_parks — a run > 12 f with apparent motion < 0.04 °/f
1. Two neighbouring keys are (almost) the same pose. Move the later key further: +0.4–1.0 units of position or ≥ 4° of look change.
2. Insert a waypoint inside the flagged range (a small push-in: pos 0.3 closer to the subject, fov −2).
3. `drift` must be ≥ 0.04 (default 0.06). Never 0.

### G2 no_brake_at_keys — the camera slows to a stop at a waypoint
1. Delete the `ease` field of the flagged key (default = `'flow'`). `inOut`/`out`/`in` arrive at zero speed = a stop.
2. If the path doubles back (key B is between A and C in the wrong direction), the spline must reverse → it stops. Re-order the waypoints so the flight goes one way.

### G3 smooth — frame-to-frame speed jump > 3×
1. Uneven spacing: segment A→B moves 3 units in 20 f, B→C moves 0.3 units in 40 f. Make distance/duration roughly proportional across neighbours (within 2×).
2. If the fast move is deliberate (sentence boundary), mark the arriving key `ease: 'whip'` (6–10 f segment).

### G4 cadence_median — median waypoint gap outside 36–66 f
Too long → add waypoints so a new framing lands every ~51 f (1.7 s); put them on the words that bring new information (from `public/words.json`).
Too short → merge keys closer than 30 f unless one is a whip.

### G5 cadence_max — a gap > 90 f (3 s)
Insert a waypoint in the long gap: push-in, orbit 15–25°, crane up/down 0.5, or a reveal pan to the next sync object.

### G6 first_move — second waypoint after f 45
Put key #2 on the 3rd–5th spoken word (≤ 45 f). Reference first change is at 1.1–1.5 s.

### G7 hook_moves — fewer than 2 waypoints in f 1–90
Add a key around f 70–85 (2 framing changes in the first 3 s: the hook).

### G8 eased_segments — more than one non-flow, non-whip ease
Convert every `inOut`/`out`/`in`/`linear` to flow (delete `ease`). Only ONE deliberate eased landing is allowed: the reveal.

### G9 fov_range — fov outside 22–60
Close-ups 28–34, mids 34–40, wides 38–48. To get "wider" without fov > 60, move the camera back instead.

### G10 roll — |roll| > 0.2 rad
Reduce `roll` on the flagged key to ≤ 0.15. Dutch angles are a flavour, not a shot.

### G11 above_ground — camera y < 0.25
Raise the key's `pos[1]`. Low-angle look-ups: camera y 0.35–0.6, look target at chest/head height.

### G12 no_spin — near-vertical view or yaw > 6 °/f
1. The look target is straight above/below the camera. Keep tilt ≤ 78°: move `look` ahead horizontally (≥ 0.3 × the height difference).
2. Yaw too fast: spread the turn over more frames, or add an intermediate key at half the angle. Orbits: ≤ 90° per 45 f.

### G13 covers_end — last waypoint before END − 20
Add a final key within 20 f of `END` (the flight is designed to the last frame; the loop rhymes with frame 0).

### G14 transitions — dissolve length outside 6–12 f or too many cuts
1. `TRANSITIONS` dissolves: `{f, kind: 'dissolve', len: 8}` (references 7.5–9 f).
2. Cuts: ≤ 1 per 60 s. Replace extra cuts with a flight (camera flies set → set through a door/porthole/window) or an 8-f dissolve with waypoints on BOTH sides of it (the camera keeps moving through the dissolve).

### G15 peak_speed — apparent speed > 8 °/f outside whips
Spread the move over more frames, or declare it a whip (`ease: 'whip'` on the arriving key) if it is a sentence-boundary swoop. Then check `K5` (motion blur) on the strip.

### G16 actors_apart — two characters closer than r1 + r2
1. Walk path goes through another actor/prop: add a detour key to the actor's `path` in `scenes/blocking.ts` (go around, ≥ r1 + r2 + 0.1 clearance).
2. Stagger timing: the walker starts 15–30 f later / earlier so they never share a spot.
3. Standing two-shot: keep characters ~1.5 apart (9:16 frame is only ~1.7 units wide at 4.6 units distance).
4. A prop that is listed in OBSTACLES with the wrong radius → measure the prop and correct `radius`.

### G17 camera_clearance — camera within 0.35 of a character or inside an obstacle
Move the camera key away from the actor/prop, or move the prop off the flight line. If the camera must pass a prop as a foreground wipe, keep it ≥ 0.35 outside the prop's radius and < 6 f (see `occluded`).

### G18 cast_in_frame — a character the shotlist names for a beat is never on screen in that beat
Checked by projecting each actor (feet → head, cast.ts height) through the camera in the middle half of the beat; the body
centre must be inside the frame at ≥ 6 % of frame height. Fix the CAMERA (look target toward the actor, pull back, wider
fov) or the BLOCKING (move the actor into the shot). If the beat is really object-only, delete that character from the
beat's `cast` in shotlist.json — the plan must describe the picture. Name actors `<castId><n>` (watts12) so they match.
Projection only: a character behind a wall still counts as visible — the stills sheet catches that.

### G19 head_in_frame — head cut by the top edge for ≥ 6 f at medium/close size (≥ 30 % of frame height)
Raise the look target to head height (feet + 0.85 × height), pull the camera back, or widen fov at the listed frames.

---
## 2. Reference-number gates — `compare.py` (metric names exactly as printed)
Verify: `python3 "$S/compare.py" "$P/work/<Comp>.mp4" --skip audio` (picture), or on `output/final.mp4` (everything).
Gate-shot only: add `--skip voice,audio,duration,dissolves_per_min,median_beat_gap_s`.

### wps — words per second outside 3.2–4.1
Catch it in Phase 5: `transcribe.py … --gate` (exact, same measure as here; WARN within 2 % of either edge, because the
final mix re-transcribed over music drifts: −1.5 % on #02). Too slow: `tighten_vo.py --keep 0.10`, denser wording (adding
words at the same pace does NOT raise wps), then `--atempo` ≤ 1.05 (the user found 1.10 rushed). Too fast (> 4.1):
`--keep 0.16` or `--atempo 0.97`. Never pad with silence.

### longest_pause_s — a pause > 0.33 s
`python3 "$S/tighten_vo.py" "$P/public/vo_raw.mp3" "$P/public/vo.mp3"` (gaps > 0.30 → 0.12 s), then re-run `transcribe.py`.

### median_beat_gap_s — outside 1.2–2.2 s
Same as `G4`: re-space camera waypoints to ~1.7 s, keyed to words. Also check `$P/shotlist.json` beat lengths (`plan_lint.py`).

### max_beat_gap_s — a framing held > 4 s (soft)
Same as `G5`.

### first_beat_s — first framing change after 2 s
Same as `G6`. Also: a strange action must be visible by 1.0 s (rubric `T2`).

### beats_in_first_3s — fewer than 2
Same as `G7`.

### hard_cuts — more than 3 detected cuts
1. Unplanned cuts usually come from a dissolve shorter than 3 f, a set mount/unmount on one frame, or a camera key jump (two keys on adjacent frames). Look at `qa_frames` `cut` strips for the frames.
2. Replace with a flight or an 8-f dissolve (see `G14`).

### dissolve_len_f — median dissolve outside 5–12 f
Set every `TRANSITIONS` dissolve `len: 8`. The dissolve must be rendered by the engine (`E/edit.tsx`), not by stacking two compositions with a 1-frame overlap.

### dissolves_per_min — outside 6–26 (soft; references 11–21)
Too few: set changes are being done as flights only → convert some era/location jumps to 8-f dissolves. Too many: connect neighbouring sets along one flight path (style-bible §4).

### longest_hold_s — the image holds > 2.6 s
The camera is parked AND nobody moves. Fix `G1` first; then make sure a character key lands in the range (A1: a pose change every ≤ 45 f).

### saturation — outside 0.36–0.56 (soft; references 0.40–0.51, target 0.41–0.47)
TOO HIGH: `<Stage grade={{sat: 0.85}}>` (GradeEffect uSat; 1 = neutral) and desaturate the biggest flat areas (sky top, water, deck colour). TOO LOW: saturate costumes and props (not the sky); `grade.sat` 1.1.

### value — outside 0.42–0.70 (soft; references 0.46–0.62, target ~0.58)
TOO HIGH (washed out, white sky fills the frame) — in this order:
1. Less sky in frame: lower the camera tilt (look target lower) or put a tall background element (sea-stack, mast, building) behind the subject. Rubric `S7`/`K7`: sky ≤ 40 % of the frame.
2. `<Stage grade={{tint: '#E6E2DE'}}>` — the tint MULTIPLIES the frame (≈ 0.9). There is no exposure control; tint is it.
3. Lower the mood's `sunIntensity` / `fillIntensity` ~15 % (pass a custom mood object `{...MOODS.day, sunIntensity: 2.2}` to `<Stage mood>`; do not edit `E/moods.ts` for one project).
4. Darker foreground props (wood `#8A5A32` instead of `#C98A4E`), darker deck/ground colour.
TOO LOW: raise `sunIntensity`/`fillIntensity`, brighten the ground colour, add a practical light (lantern) near the subject.
Verify on stills first (fast): render 4 stills and run `compare.py` on the video only after the stills look right.

### lufs_i — outside −15…−13 LUFS
Run `python3 "$S/mix.py" "$P"` (loudnorm two-pass to −14). If you mixed by hand, re-mix with mix.py.

### true_peak_dbtp — above −1.0 dBTP
`mix.py` applies a true-peak limiter at −2 dBTP. A raw SFX peak (boom) above −3 dBFS before the limiter → lower that cue's gain in `scenes/sfx.ts` / `work/sfx_cues.json`.

### caption_cap_px — outside 34–52 (soft; references 41–44 on the estimator)
`<Captions words={words} size={…}/>`: cap height ≈ 0.72 × font size for Archivo Black; the estimator includes the stroke. Too small → +6 px size; too big → −6 px. Re-measure.

### duration_s — outside 39–66 s (soft)
Trim or extend the script (`script_lint.py --duration`). Shorts median 59 s.

---
## 3. Frame findings — `qa_frames.py` (kind names exactly as printed)
Verify: `python3 "$S/qa_frames.py" "$P" "$P/work/<Comp>.mp4"` → exit 0 (no P0/P1). Always open the `flag_*` strip first.

### blank (P0) — frame almost uniform
1. Canvas rendered empty: run `render.sh … stills <Comp> <f>` on that frame and read the error. Common: an exception in a component mounted at that frame, a NaN position (division by zero in a path), a texture that failed.
2. Never use `@react-three/postprocessing` `EffectComposer` — it renders empty frames headless. Use the engine's `post/Post.tsx` (Stage does).

### flicker (P1) — a region changes for exactly 1 frame and reverts
An off-by-one: something is mounted/visible on frame f only. Search `scenes/index.tsx` and `scenes/cast.ts` for keys / `<Sequence from>` / `visible` ranges that start or end at f. Make the ranges contiguous (`to` of one = `from` of the next). Also: a texture created inside render (move it into `useMemo`).

### pop (P2) — a local persistent snap
Look at the strip. If it is a caption chunk change or a planned pose key: OK, tick it in review.md. If an object appears/vanishes/teleports: give it an enter/exit (walk in through a door, scale-in over 4 f, or put the change behind a dissolve). Pose snaps faster than 3 f → rubric `A2`.

### cut (P2) — whole-frame change in 1 frame not in TRANSITIONS
If intended: add `{f, kind: 'cut'}` to `TRANSITIONS` (budget ≤ 1 per 60 s, `G14`). Otherwise: two camera keys too close (< 3 f) or a set swap on one frame → make it an 8-f dissolve with the camera moving through it.

### frozen (P1) — ≥ 8 identical frames
Camera parked AND nobody moving: fix `G1`; add a pose key in the range; make sure ≥ 2 ambient motions are in frame (`S5`: `Motes`, `Gulls`, `Flag`, `Water`, `SmokePuffs`, `Lantern` swing). Also check the render did not stall (re-render the range).

### occluded (P1) — one flat region > 38 % of the frame for 6+ frames
Camera inside or touching geometry (`G17`), or a foreground prop too close. Move the waypoint back / move the prop. A deliberate foreground wipe must last < 6 f.

### exposure (P2) — mean value < 0.18 or > 0.92
Same as compare `value` (too high / too low) for that set.

### caption_gap (P2) — a spoken word with no caption
`<Captions words={words}/>` is missing from that composition, its `hide` ranges cover the word, or `public/words.json` does not contain the word (re-run `transcribe.py`).

---
## 4. Review rubric checks — `qa-rubric.md` (C1–C7, A1–A6, K1–K7, S1–S7, T1–T6)
Verify: re-render the range, re-read the strip/sheet cell, tick the box with the frame numbers.

### Lens 1 — Character
- **C1 not a ToonCharacter / black outline / 2D sprite** → replace with `<ToonCharacter {...CAST.id} pos={at('id').pos}/>` from `@engine/character/ToonCharacter`. Ink comes from `E/ink.tsx` (`INK_COLOR #2A1B26`); never set an outline colour by hand. `StickCharacter` is the old 2D look — do not use it.
- **C2 clipped by the frame edge** → in priority order: (a) move the camera back or widen fov +4 on the key that frames them; (b) move the character inward in `blocking.ts` (two-shots ~1.5 apart, both within ±0.7 of the look target at 4.6 units distance); (c) shift the `look` target toward the clipped character. Check every frame of the flagged range on stills, not just one.
- **C3 floating / sinking feet, no contact shadow** → feet are at local y 0: the character `pos[1]` must equal the floor height under it (deck top, stair step). `shadow` prop must not be false. On a moving floor, parent the character to the same group as the floor.
- **C4 face unreadable / wrong expression** → (a) face toward the camera: set `yaw` so the face is within ±60° of the camera direction on that beat; (b) close-up fov 28–34 when the face carries the beat; (c) put a `face:` key on the sync word's frame (`Math.round(word.s × 30)`) in `cast.ts`. Shock word → `shock` + `fx: ['sweat','shockLines']`; boast → `smug`; laugh → `laugh`.
- **C5 roles not readable / shared silhouette** → each character gets a distinct `look.hat.kind` (13 kinds) AND a distinct outfit colour family. Two characters never share hat kind in one set.
- **C6 unlit pure-white figure** → ToonCharacter uses toon materials that take scene lights; a white figure means the set has no light near it (dark interior) → add a practical (`Lantern`) or raise the mood fill. Do not set `tint` to white.
- **C7 held prop floats / clips** → use `holdL`/`holdR` on a key (the engine places it in the hand). For a big prop, pose the arm `carry`/`hold` and move the prop with the character's position, not separately.

### Lens 2 — Animation
- **A1 a character holds > 45 f / idle sway** → add a key every 12–45 f per visible character in `cast.ts` (arms, face, look, lean or a `beat`). Keep `motion` at the default `'pose'` (no sway). Never set `motion: 'bouncy'` (old 2D look).
- **A2 slow tweens / 1-frame snaps** → `'pose'` motion gives 4-f attacks automatically. Slow tween = something else is interpolating the pose (a `path` with a long `inOut` used for a pose, or an animated prop). 1-f snap = two keys 1 frame apart → merge them.
- **A3 action verb not acted on its word** → find the word's frame in `public/words.json` (`s × 30`), put the key there (anticipation: the key may sit 2–3 f before). "point" → `armR: 'point'`; "throws" → `armR: 'up'` then `'reach'` 6 f later; "drinks" → `'drink'`; "laughing" → `face: 'laugh'` + `beat: 'shake'`.
- **A4 walks through things / appear from nowhere** → route the `path` around (see `G16`) and start/end it off-frame or at a door (`enter`/`exit` frames on the Actor). Legs auto-walk while the path moves.
- **A5 no secondary motion** → `fx` on the key (`sweat`, `shockLines`, `steam`, `exclaim`, `question`, `sparkle`), `beat: 'recoil'|'hop'|'shake'|'stomp'|'nod'`, and swinging props (`Lantern swing`, `Flag`).
- **A6 mouth flaps when not speaking** → `talk` ranges on the character = the frames of THAT character's quoted line only (narrator lines → no `talk`).

### Lens 3 — Camera & post
- **K1** → section 1 (cam_qa) above.
- **K2 framing held too long** → `G4`/`G5`.
- **K3 subject out of focus** → `<Stage dof={{focus: (f) => …}}>`: return the position of THIS beat's subject (from `at(id).pos` + head height ~1.2). Switch focus on the beat frame. `range` default is fine; `bokeh` 3–5.
- **K4 camera inside geometry** → `G17` / `occluded`.
- **K5 blur on held subjects / no blur on whips** → `<Stage shutter={0.5}>` (180°). Held subject blurred = the camera is still moving fast on a "held" beat → slow that segment (`G15`). Whips need ≥ 6 °/f to streak.
- **K6 transition defect** → `G14`; camera keys must exist within 8 f on BOTH sides of a dissolve.
- **K7 weak framing / > 40 % sky** → subject on a third (offset `look` 0.3–0.5 sideways), horizon off-centre (look target lower → horizon higher), fill the sky with a background element; check `value`.

### Lens 4 — Sets, colour & captions
- **S1 missing depth layer** → foreground: a prop 0.6–1.5 units in front of the camera on the flight line, out of focus (rope coil, barrel edge, lantern, railing post); background: vista (`SeaStack`, `Water`, skyline, mountains). Every beat needs all three.
- **S2 a prop without ink** → use a prop from `@engine/props/basic` (inked) or wrap custom meshes in `<Inked geometry material ink={0.02}/>` from `@engine/ink`. A raw `<mesh>` with `meshToonMaterial` and no hull is a fail (e.g. a mast cylinder in index.tsx).
- **S3 colour off** → compare `saturation` / `value` above. One dominant hue per 10–15 s act: pick the act's mood (`day`, `sunset`, `night`, `interiorWarm`, `goldenMorning`, `neon`); the reveal shifts to saturated blue.
- **S4 caption defect** → `<Captions words={words}/>` with defaults (Archivo Black, 1–2 words, y 0.7). Over a face → pass `hide` for that range and/or `y={0.3}` for that section. Missing words → `caption_gap`.
- **S5 < 2 ambient motions** → add from `@engine/fx/particles`: `Motes`, `Gulls`, `Embers`, `SmokePuffs`, `Flag`; `Water` ticks; `Lantern` swing.
- **S6 no story signage / misspelt** → `<Sign text="…"/>`, `<Barrel label="RUM"/>`, `<Crate label="GOLD"/>`. Spell-check against script.md. One labelled story object per set.
- **S7 flat cardboard clouds / too much sky** → use puffy 3D clouds (`Clouds` from `@engine/world/Sky`) far away and low; reduce sky area (`K7`).

### Lens 5 — Story alignment
- **T1 sync object not on screen at its word** → the beat's camera key must frame the `sync` object by the word's frame (key ≤ word frame, object inside the centre 70 %). If the object is a prop that appears, mount it ≥ 3 f before the word. Re-check the sheet cell.
- **T2 hook too slow** → the strange action must be visible in frame 0–30 (no establishing shot first); `G6`, `G7`.
- **T3 visual contradicts VO** → fix the count/object/character/era in index.tsx to match script.md and research.md (research wins).
- **T4 mechanism only told, not shown** → add a macro insert, cut-away or in-world diagram beat during the reveal sentence (last ~30 %); give it its own camera key and a glow-burst/sparkle accent.
- **T5 hold after the last word / no loop** → `END` = last word end + ≤ 15 f; the last camera key frames something that rhymes with frame 0 (same object or composition).
- **T6 no easter-egg life** → add a cat / gull / frog / spider per 15 s (small, in the midground, doing one thing).

---
## 5. Script / plan / audio linters (ids are printed by the scripts)
These scripts print their own check ids and a FIX line; the ids are listed here so this file stays the one index.

### script_lint.py
- **L1 word_count** — outside duration × 3.66 ± 8 %: cut adjectives and repeated clauses / add one escalation beat.
- **L2 hook_length** — sentence 1 > 11 words (≈ 3 s): cut to the strange action itself ("He sawed gaps into a railroad every 39 feet.").
- **L3 hook_form** — sentence 1 is a question or starts "Did you know"/"Have you ever"/"Imagine": rewrite as a statement of the odd action or paradox.
- **L4 doubter** — no mocking/doubting sentence in the first 35 %: add one ("The whole court burst out laughing.").
- **L5 pivot** — no "You see," (or "Here's the thing", "But") pivot between 25 % and 75 %: add it before the context.
- **L6 reveal_position** — the mechanism sentence (marked `[REVEAL]`) starts before 55 % or after 85 % of the words: move it into the last ~30 %.
- **L7 quote** — no quoted punch-line: add a short quote voiced by the narrator ("You're wrecking my railroad!").
- **L8 numbers** — fewer than 2 specific numbers/names/dates: add from research.md.
- **L9 drawable_noun** — a sentence with no concrete noun: rewrite with an object you can draw.
- **L10 title** — not 4–8 words / not Title Case / no curiosity object: use "The [Object] That …", "Why [Group] [Odd Thing]", "Levels of …".
- **L11 ending** — ends on a moral / "subscribe" / "and that's why": end abruptly on the payoff image; last line must lead back into line 1.
- **L12 unverified** — a fact marked UNVERIFIED in research.md appears in the script: remove it.

### tighten_vo.py
- **V1 wps** → see `wps`. **V2 pause** → see `longest_pause_s` (if the tool reports cuts inside words, raise `--min-silence-db` by 3).

### plan_lint.py
- **PL1 beat_median** (36–66 f) → split long beats at the next noun / merge short ones.
- **PL2 beat_max** (> 90 f) → split at a word that introduces something new.
- **PL3 first_change** (> 45 f) → shorten beat 1 to the 3rd–5th word.
- **PL4 hook_beats** (< 2 in 0–3 s) → split beat 1 or 2.
- **PL5 sync_word** — `sync` word not in words.json inside [from, to] → fix the spelling / pick a word that is spoken in that beat.
- **PL6 cuts** (> 1) → flights or dissolves.
- **PL7 dissolve_len** (≠ 8 ± 1) → `len: 8`.
- **PL8 sentence_starts** — a sentence starts mid-beat (> 6 f after the beat's `from`) → move the boundary onto the sentence's first word.
- **PL9 sets** — sets per 60 s outside 7–10 → split a long set into two / merge tiny ones.
- **PL10 fields** — a beat misses `id, from, to, words, sync, set, visual, camera, cast, sfx, transition_in`, or beats
  are not contiguous (to of one = from of the next, first from 0, last to ≥ last word end), or `camera` is not one of
  push/pull/whip/orbit/crane/pan/tilt/fly-through/track/dolly → fix it.

### sfx_cues.mjs / sfx_synth.py / mix.py
- **SX1 no_cues** — 0 cues → `scenes/cast.ts` must export `CAST` with `keys`, and `scenes/camera.ts` must export `camera`.
- **SX2 density** — < 1 cue per 2 s or the last 15 % is not the densest → add `SFX_EXTRA` hits in `scenes/sfx.ts` on impact words.
- **SX3 repeats** — the same kind + variant back to back → sfx_cues numbers variants per kind; do not hand-place two
  identical cues (same f, same kind) in SFX_EXTRA.
- Cue `gain` semantics (sfx.ts / sfx_cues.json): peak = −6 dBFS + gain (0 = −6, booms up to +3 → −3 dBFS).
- **MX1 voice_rms** — full master on speech frames not −13.8 ± 1.5 dBFS RMS (MEASURED on the 4 reference masters:
  −13.6…−14.4; the guide's −17.5 does not match the files). Too hot = ambience/SFX too quiet vs the refs → AMBIENCE
  `gain` +3…+6 in scenes/sfx.ts / more SFX_EXTRA hits; too quiet = they are too loud. Re-run sfx_cues → sfx_synth → mix.
- **MX2 bed_gap** — music bed not 18–22 dB under the voice → `mix.py --bed-db -20`; NO ducking (static bed, measured).
- **MX3 silence** — a gap below −45 dB > 0.25 s → the bed/ambience must run the full length.
- **MX4 mono** — L/R correlation < 0.9 → mix.py outputs mono-compatible; do not add hard-panned SFX.

### thumbnail.py
- **TH1 text** — > 3 words → shorten. **TH2 small_read** — hero object/face unreadable at 10 % → pick a closer frame (`--frame`), or crop (`--zoom 1.3`).

## S8 richness (frame looks flat / bland / "crayon")
Engine defaults already give shadows, SSAO, god rays, split-tone grade (style-bible §L). If a set still looks flat:
1. Mood: switch to `golden`/`sunset` (warm key, violet fill, sunDisc in or near frame for rays + sunburst).
2. Ground: add `GrassField` + `Flowers` (or `Reeds` at water, `Rocks` on paths) from `@engine/props/nature`, clear the actor spots.
3. Mid/back: ≥ 3 `LeafyTree`/`Bush`, a `TreeLine`, 2 × `Hills` at -200/-320 for haze layers; ≥ 4 clouds at several depths.
4. Props: painted textures (woodPlanks/bricks/stone) + ink; nothing untextured.
5. Costumes: use the uniform/coat detail fields (trim, strap, epaulettes, collar). Re-check saturation stays 0.40–0.51.
