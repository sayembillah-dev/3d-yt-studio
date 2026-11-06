# StickWorld Style Bible
Derived from frame-by-frame analysis of 4 reference Shorts (Levels of Pirate Cannonballs, The Ancient Jar That Warned an Empire, The Window That Breaks Japan's Gambling Law, Why Perfect Railroads Don't Work). Every rule here is checkable. QA scores against this file.

> **Measured numbers win.** Updated 2026-11-05 with the frame/audio measurements of the 4 references
> (`reference_numbers.json`, `measure_short.py`) and the guide's 15 measured rules. Where an older sentence below
> disagrees with §M, §M is right. Gate ranges live in `reference_numbers.json`; fixes in `fix-playbook.md`.

## M. The 15 measured rules (summary — each is enforced by a gate)
| # | Rule | Number | Checked by |
|---|---|---|---|
| 1 | **Real 3D toon render**, not flat 2D billboards, not AI video | `ToonCharacter` + toon materials | rubric C1 |
| 2 | Story = real, slightly obscure mechanism told as a fable, anonymous role-noun hero; **reveal at 59–81 %** ("You see," ≈ 69 %) | reveal in the last ~30 % | script_lint L6, rubric T4 |
| 3 | One fast, bright, dry young TTS-style narrator | **3.66 w/s** (4.0 in 0–3 s), refs 3.28–3.63; no pause > 0.33 s | compare `wps`, `longest_pause_s` |
| 4 | Character: white squashed-sphere head (h/w 0.92), bean torso, ink-tube arms, ink ball hands, no fingers, ~3.1 heads tall | — | rubric C1 |
| 5 | **Ink `#2A1B26`** (plum), never `#000`; lit-side line thin, shadow side ~2× | `E/ink.tsx` INK_COLOR | rubric C1, S2 |
| 6 | Faces are swapped decals; expressions swap in 0–1 frames on the word | — | rubric C4, A3 |
| 7 | **Pose-to-pose, then freeze**: attacks 3–5 f `bezier(.2,0,.1,1)`, holds 12–45 f, **NO idle sway / breathing bob** | `motion: 'pose'` | rubric A1, A2 |
| 8 | New framing every **~1.7 s** (median gap 1.3–2.15 s); 2 changes in 0–3 s, first at 1.1–1.5 s | cam waypoints | cam_qa G4–G7, compare |
| 9 | Inside a set: eased camera *flights* (push 26 %, pull 16 %, whip 13 %, pan 8 %, tilt 4 %) | ease `flow` | cam_qa G2, G8 |
| 10 | Strong DOF, focus follows the subject | `Stage dof.focus(f)` | rubric K3 |
| 11 | **7–10 bespoke sets per 60 s**, mostly warm/bright; chunky bevelled inked props; dense detail | — | plan_lint PL9, rubric S1, S2 |
| 12 | Colour by act: **saturation ≈ 0.41–0.47, value ≈ 0.58** (refs sat 0.40–0.51, val 0.46–0.62); one dominant hue per 10–15 s act; reveal shifts to saturated blue | — | compare `saturation`, `value` |
| 13 | Captions: one line of **1–2 words**, white **Archivo Black**, thin dark stroke (5–6 px), cap ≈ 41–44 px on our estimator | `<Captions>` defaults | compare `caption_cap_px`, rubric S4 |
| 14 | Mix: **−14 LUFS** (refs −14.0…−14.3), LRA ≤ 3, **TP −2 dBTP**, **mono**; voice in the master **−13.8 dBFS RMS** on speech frames (our measurement of the 4 refs: −13.6…−14.4; the guide's −17.5 does not match the files); **static** music bed ≈ 20 dB under the voice (guide; not separable in the refs), **NO ducking** | `mix.py` | compare `lufs_i`, `true_peak_dbtp`, mix MX1–MX4 |
| 15 | Packaging: **39–65 s** (median 59 s); title 4–8 words, Title Case | — | compare `duration_s`, script_lint L10 |

Transitions (measured): dissolves **8 f (7.5–9)**, **11–21 per minute**, camera moving through them; hard cuts 0–3 per Short (target ≤ 1).


## L. Look-dev standard (user rule 2026-11-06 — ENGINE DEFAULTS, applies to every video)
The user rejected a render that passed every numeric gate but looked "drawn with a crayon". Richness is now built in:
| Layer | Default (engine) | Where |
|---|---|---|
| Light | sun **cast shadows** (PCF soft, frustum follows the camera); characters cast but never receive (clean white faces) | `Stage.tsx`, `LOOK_DEFAULTS.shadows` |
| Post | **SSAO** (ao 0.6) → motion blur → DOF → **god rays** (any mood with a sun/moon disc) → bloom → **split-tone grade** (cool violet shadows / warm highs) + vibrance + lifted blacks + vignette + grain | `post/Post.tsx`, `post/MotionBlur.ts` GradeEffect |
| Sky | gradient dome, sun disc + glow + stylised **sunburst** beams, ≥ 4 puffy clouds at several depths | `world/Sky.tsx` |
| Water | wave ticks + **sun glitter** + current streaks; cut-aways get depth gradient, caustics, light shafts | `world/Water.tsx`, `props/dutch.tsx WaterSlab` |
| Ground cover | instanced swaying **GrassField / Flowers / Reeds**, **Rocks**, **LilyPads** | `props/nature.tsx` |
| Foliage | **LeafyTree** (painted leaf clusters, round/poplar/willow), **Bush** | `props/nature.tsx` |
| Depth | **Hills** (2 layers, hazed) + **TreeLine** on every exterior horizon | `props/nature.tsx` |
| Costume | every outfit gets seams + stitching, folds, hem, painted form shading; uniforms: collar, placket piping, pocket flaps, double buttons, optional strap / epaulettes | `character/ToonCharacter.tsx outfitTexture` |
| Life | one easter-egg animal per ~15 s (duck, worm, gull, cat …) | scenes |
Moods: prefer `golden` / `sunset` / `goldenMorning` (warm key, violet fill) over flat noon `day`. Saturation stays in the
reference range (0.40–0.51 ideal): vibrance comes from warm/cool contrast + detail, not from oversaturating sky/water.
Gate rule: every exterior frame has ground cover + ≥ 3 trees/bushes + a backdrop layer; no bare ground, no empty horizon.

### L.2 Multi-set builds (engine 2026-11-06, first used by 01_dutch-water-line)
- One **camera track per set** (`CameraTrack[]` exported as `CAMERAS` from scenes/camera.ts). Each track is a continuous
  flight that keeps moving through its dissolve window; the edit swaps track at the dissolve midpoint. Forcing ONE path
  across dissolves made every new set inherit a view it was not designed for (empty/blurred beats) — don't.
- Each set lives in its own world region (`origin = [i·500, 0, 0]`), rendered in its own `<Stage>` layer; layers overlap
  8 f and the incoming one fades in on top. Pattern: `Projects/01_dutch-water-line/scenes/{plan.ts,camera.ts,index.tsx}`.
- Sky dome + god-ray sun follow the camera (any world size). Motion blur switches off across camera jumps (cuts/swaps).
- QA: cam_dump/cam_qa/sfx_cues read tracks via `projectCameraAt`; swaps are excluded from continuity gates like cuts but
  are not counted as cuts.

---
## 0. The one-sentence look
**3D toon stick characters with plum ink outlines (#2A1B26) living inside a richly illustrated, toon-lit 3D world, filmed by a camera that never stops moving, where every spoken noun appears on screen the instant it is said.**

---
## 1. Format & technical
| Item | Shorts (reference) | Long-form (derived) |
|---|---|---|
| Resolution | 1080×1920, 9:16 | 1920×1080, 16:9 |
| FPS | 30 | 30 |
| Duration | 45–65 s | 6–15 min |
| VO speed | **~3.66 words/sec (≈220 wpm)**, speech starts at 0.00 s, no lead-in; **no pause longer than 0.33 s** anywhere (tighten the VO if needed) | 165–185 wpm, 0.3 s lead-in allowed |
| Loudness | **−14 LUFS integrated**, true peak ≤ −1 dBTP | same |
| Silence | **none** — no gap below −45 dB longer than 0.25 s (continuous music + ambience + SFX bed) | same |
| Intro/outro | **none** — no title card, no "subscribe", no logo | 0–3 s cold-open, end screen 20 s allowed |
| Loop | last line flows grammatically into first line; last frame visually rhymes with first frame | n/a |

---
## 2. Characters (the most important asset — must be 100% consistent)
### 2.1 Construction (3D — built by `ToonCharacter`, never hand-drawn sprites)
- **Head**: white squashed sphere (h/w ≈ 0.92–0.93), fill off-white `#F4EFEA`, toon-shaded by the scene lights. Face = a swapped decal pressed onto the front of the sphere.
- **Outline**: inverted-hull ink, colour **`#2A1B26`** (warm plum, never pure `#000`, never darker than `#101010`). Lit side thin, shadow side ~2× thicker (brush weight). The same ink goes on every prop and set piece (§3.1).
- **Body**: bean torso (≈ 1.5 head diameters tall × 0.7 wide), no neck. Carries the costume as a painted texture: stripes (pirate), coat with lapels (captain), vest + watch chain (boss), robe with sash (emperor), uniform with buttons + badge.
- **Limbs**: ink tubes (thin, slightly curved), **ink ball hands, no fingers**, tiny ink feet. ~3.1 heads tall overall.
- **Head-wear defines the role** (most important identifier at thumbnail size): 13 hat kinds in the engine (tricorn, bandana, bowler, top hat, engineer cap, police cap, chef hat, helmet …). Hair = simple dark shape.
- **Back view exists** (`facing: 'back'`) for walking away or facing a window.
- Characters are **toon-lit by the scene**: they take the mood's light (pink/purple at sunset, blue at night, warm interiors). Unlit pure-white figures are a defect.
- Contact shadow under the feet on every ground surface.

### 2.2 Face library (expressions swap instantly, on the word)
| Code | Eyes | Brows | Mouth | Extras |
|---|---|---|---|---|
| neutral | two black ovals | none | short line | — |
| smug | half-lidded (top flat) | one raised | sideways smirk | — |
| happy | closed arcs ^^ | — | wide grin w/ teeth row | — |
| laugh-cry | closed arcs | — | open laugh | tear streams, body shake |
| shock | big white circles w/ dot pupils | raised | small "o" | sweat drop |
| panic | white circles | raised | gritted teeth grid | sweat drops, shake |
| squint/pain | `>` `<` | — | wavy/gritted | motion lines |
| angry | slanted ovals | heavy V | gritted teeth | **face fills purple/red from top**, steam puffs from head |
| skeptical | one squint, one normal | one down | flat/frown | — |
| sleepy | lines | — | small o | "Z z" letters float up |
| cool | sunglasses (black rounded) | — | smirk | — |
| nervous | normal + side glance | worried | wobbly line | sweat drop |
| mustache variants | any | — | mustache over mouth | (older/authority characters) |

### 2.3 Animation rules — pose-to-pose, then freeze (measured)
- **Every visible character changes pose at least every 12–45 frames** (arms, face, look, lean, or a one-shot beat: hop / nod / recoil / shake / stomp). Somebody is always *doing* something: shoveling, sipping, pointing, handing over a prop, walking.
- **Attacks are fast: 3–5 frames, `cubic-bezier(.2,0,.1,1)`** — then the pose **HOLDS still**. **No idle sway, no breathing bob, no floaty drift between keys** (the old 2D "always-on idle layer" is wrong for this look). Blinks are allowed.
- Gestures land on word timestamps (point on "this", shrug on "but", lean-in on "you see", flinch on impact words); anticipation may start 2–3 f before the word.
- Expression swaps are **instant (0–1 frame)** exactly on the trigger word.
- Secondary motion is carried by fx and props: sweat drops, shock lines, steam, hats/flags/lanterns.
- Walks: travel along blocking paths that avoid people and props; enter/exit through doors or frame edges, never by appearing.
- Characters interact with props physically (prop sits in the ball hand and follows it).

---
## 3. World / environment
### 3.1 Rendering look
- 3D geometry, **toon/cel lighting** (2–3 band ramp with soft transitions), strong key light + colored fill + **rim light**.
- **Ink lines on the world too**: object silhouette outlines (dark brown, thinner than characters) + hand-drawn line-art inside textures (plank seams, brick mortar, stone joints, nail holes, wood grain strokes, rivets).
- Textures look **hand-illustrated**, not photo: flat base colour + painted gradient + ink detail lines + subtle grain/wear marks. Never a raw photo texture, never untextured flat grey.
- Stylised realism in proportions (cannons, ships, castles, trains are believable shapes), cartoon in surface.

### 3.2 Detail density (non-negotiable)
Every frame must have:
- **3 depth layers**: foreground element (often blurred via DOF — a plant, crate, lantern, cat, railing), midground action, background vista.
- **Story-specific signage**: labelled props that act as visual captions — barrels "LANGRAGE", "GARBAGE"; crate "CARCASS – KEEP FROM FLAME"; sign "HOT SHOT"; "PRIZE HALL", "PRIZE COUNTER", "THANK YOU"; newspaper "THE CLICKETY CLACK LINE!"; clipboard "PATROL LOG – GAMBLING: NONE ✓"; calendar "MAY 1880". Text must be correctly spelled, period-appropriate font.
- **Clutter & wear**: rope coils, buckets, crates, bottles, chests, potted plants, vending machines, posters, lanterns, flags, bunting, windows with sky, chipped paint, stains, scattered cobbles/ballast.
- **Easter-egg life**: a calico cat, maneki-neko, a spider on a pendulum, seagulls/birds, a frog — small extras that reward re-watching.
- Background vistas are elaborate: fantasy sea-stacks with waterfalls and arches, castle city with crowds of thousands, neon city blocks with lit windows, canyon walls with layered strata, mountains, rolling farmland.

### 3.3 Ambient motion (every shot needs ≥ 2)
Drifting dust motes / light specks, embers & sparks, smoke puffs, steam, splinters, water waves with white crescent marks + foam, flags/banners waving, birds crossing, clouds drifting, lanterns swaying, neon flicker, flame flicker, falling leaves, cat tail swish, bubbles, heat shimmer.

### 3.4 Sky
- Gradient sky dome per time-of-day; **cartoon cumulus clouds** (puffy, soft-shaded, flat bottoms), sun disc with bloom/god-rays, moon with halo at night, stars.
- Time-of-day **arc across the story** is a storytelling tool: day → sunset (purple-magenta-orange) → night (deep blue + warm practicals) → next morning (golden haze). Lighting change marks time passing.

### 3.5 Water
Stylised turquoise→deep blue gradient, white crescent "wave tick" marks scrolling, foam rings around floating objects, splash particles, soft reflections of bright things (sunset ship glow, neon on wet streets).

### 3.6 Signature palettes
| Mood | Palette |
|---|---|
| Sunny day | sky `#6EC3F5→#E8F6FF`, warm wood `#C98A4E`, sea `#2BB5C8→#0E5C9A` |
| Sunset | `#3B2A6B` top → `#C2508A` → `#FFB46B` horizon, everything rim-lit orange |
| Night | `#0D1B4A → #2A3C8F`, moon `#F4F2D8`, warm practicals `#FFB347` |
| Neon night | indigo `#1B1446`, magenta `#FF3EA5`, cyan `#28E0FF`, yellow arrow `#FFD23F`, wet reflections |
| Interior warm | amber `#F2B45A`, deep red carpet `#8E1F2A`, gold trims `#D9A441` |
| Desert/canyon | orange `#E8742C`, red strata `#B8322A`, purple shadow `#4B3A8C`, sky `#4A8BE0` |

---
## 4. Camera
- **ONE single camera for the entire video, always flowing, it never stops.** The whole Short is one continuous flight; there is no "shot list" of separate cameras. Keyframes are waypoints the camera passes THROUGH at speed (never eases to a halt at a waypoint), framing changes ~every 1.7 s along the way.
- **The camera never stops.** Every shot has continuous motion: slow push-in, drift, orbit, crane, dolly-follow, tilt-reveal. Static frames = defect.
- Lenses: wide (18–24 mm equiv) for vistas & interiors with strong perspective; tighter (50–85 mm) for character close-ups with shallow DOF.
- **Low angles** looking up at characters/props are common; dramatic perspective (cannon barrel in foreground pointing into frame, rails converging to vanishing point).
- **Push-through**: camera flies through a window/porthole/doorway/hole into the next space.
- **Macro inserts**: extreme close-up of the mechanism (inside the jar, rail gap with caliper, wet plug in the barrel).
- **Cutaway/cross-section** shots for explanations (geological strata under the city, inside the cannon barrel).
- Impact shake on explosions/hits (6–10 frames, decaying).
- Composition rate: **new framing about every 1.7 s (median; refs 1.3–2.15 s)**. Never longer than 3 s on the same framing.
- **Sets: 7–10 bespoke sets per 60 s**, laid out along one flight path.
- **The camera flies between scenes.** Sets for consecutive beats live in ONE continuous world space (or are laid out along a flight path), and the camera travels from beat A to beat B in a single move: rise, bank, swoop, dive into the next framing. Scene change = camera flight, not a cut.

## 5. Transitions (in order of frequency)
**Rule: (almost) no hard cuts.** One camera, one unbroken flight through the story. Everything below except the dissolve happens *inside* that single camera move.
1. **Camera flight / continuous move** into the next framing (most changes). Sets are placed along the flight path so the move itself reveals the next beat.
2. **Dissolve** where geography can't connect (location or era jump): **8 frames** (measured 7.5–9; gate 6–12), **11–21 dissolves per minute** in the references, with the camera still moving on BOTH sides of the dissolve (the outgoing shot keeps drifting, the incoming shot is already moving).
3. **Whip / fast swoop** with heavy directional motion blur on sentence boundaries (6–10 frames), as a flavour of the camera flight.
4. **Push-through** (fly into a window/porthole/opening into the next space).
5. **Match move** on shape/position (ball → sun, jar → jar).
6. Hard cut: only on a big impact/punchline, target ≤ 1 per Short (refs 0–3). QA flags more.

## 6. Captions (measured)
- Font: **Archivo Black** (heavy grotesque), as spoken, punctuation kept ("a cannonball," "ones.").
- White fill `#FFFFFF`, **thin dark stroke 5–6 px** at 1080w (paint-order stroke) + a soft drop shadow.
- **One line of 1–2 words per chunk**, tied to word timestamps, swaps on each chunk. Numbers formatted ("1000 lbs", "every 39").
- Size: cap height ≈ 41–44 px on `compare.py`'s estimator (the guide's 52.5 px includes the stroke); `<Captions>` default size.
- Position: horizontally centred, vertical centre at **~70 % of frame height** (y ≈ 1350 of 1920) — above the Shorts UI zone (bottom 20 %) and away from right-edge buttons.
- Instant swap; a subtle 2-frame scale 0.92 → 1 is acceptable.
- Must never cover a face or key prop — move to 30 % height for that range if there is a conflict.

## 7. Post-processing
Bloom on emissives/sun/fire (moderate), **depth of field** for close-ups (foreground blur is a signature), vignette (subtle), warm/cool grade per mood, light film grain (barely), **motion blur** on whips & fast moves, light rays/glow-bursts on hero props when named ("hollow" → radial god-rays behind the carcass ball).

## 8. VFX vocabulary
Cartoon explosion (orange stacked spheres + debris + black smoke column), cannon muzzle flash + smoke puff, wood splinter storm, water splash & foam rings, sparks/star-bursts on metal impact, fire on sails, glowing red-hot objects with heat haze, embers rising, steam puffs from angry heads, sweat drops, "Z z", motion lines, impact stars, coin/cash slide, light god-rays, glow bursts.

---
## 9. Story & script formula
### 9.1 Structure (Shorts, 45–65 s, 160–235 words)
1. **Hook (sentence 1, ≤ 3 s)** — a counter-intuitive claim, paradox or in-medias-res action. Never a question to the viewer, never "Did you know".
   - "If your ship got hit by a cannonball, you'd actually be one of the lucky ones."
   - "Gambling is illegal in Japan, yet there's a gambling hall on almost every street."
   - "He sawed gaps into a railroad every 39 feet."
   - "He put a bronze ball in a dragon's mouth and told the Emperor, 'If this ever falls out, run!'"
2. **Doubt / stakes** — the world mocks it or it seems absurd ("The whole court burst out laughing.").
3. **"You see,"** — the context pivot (appears in 3 of 4 references).
4. **Escalation** — each beat raises stakes (levels ladder: round shot → langrage → hot shot → carcass → Rodman gun) or second-person immersion ("So, you win a bucket yourself…").
5. **Dialogue punch-lines** voiced by narrator as quotes ("You're wrecking my railroad!", "Hey, it's the toy guy!").
6. **Twist / mechanism reveal** — explain how it actually works with a concrete visual (pendulum, rail expansion, separate token shop). **Measured position: 59–81 % of the runtime (the last ~30 %)**; "You see," lands ≈ 69 %.
7. **Payoff** — vindication or consequence, ends abruptly on the image ("right as a train rolls onto it." → explosion). No moral, no outro.
8. **Loop** — the last sentence leads naturally back into the first.

### 9.2 Language rules
Concrete nouns over abstractions (every noun must be drawable). Specific numbers (39 feet, 1000 lbs, eight dragons). Short sentences, conversational, light humour, past tense for history / present tense for systems. Every sentence must yield ≥ 1 visual beat.

### 9.3 Title & thumbnail
Title = curiosity gap object + consequence ("The Window That Breaks Japan's Gambling Law", "Why Perfect Railroads Don't Work", "Levels of …"). Thumbnail = the hero object + main character with strong emotion, the most saturated moment of the video, ≤ 3 words of text if any.

---
## 10. Script ↔ visual sync (the "right visual at the right time" rule)
- Every **concrete noun, number, action verb and emotion word** in the VO is a sync point; its visual must be on screen within **±3 frames** of the word start.
- Examples from references: "1000 lbs" → huge ball swings on a tripod hoist; "bounced" → sparks on iron hull; "purple" → face fills purple; "shampoo" → shampoo bottle handed over; "glowed" → camera inside furnace with red-hot balls; "lantern" → ship glows from inside at sunset; "hollow" → glow-burst behind the carcass ball.
- Sentence boundaries = camera/composition change opportunities (whip or move).
- Emotional words = expression pop on the relevant character.

---
## 11. Sound design (measured from the references)
Measured with spectrograms + band-energy analysis on all 4 references (we cannot "listen", so these are measurements; instrument guesses are inferred from spectra).

| Measurement | Value | Meaning |
|---|---|---|
| Speech RMS | ≈ −18 dBFS | VO sits on top, always intelligible |
| Bed level in word gaps | −35 … −17 dBFS (median ≈ −23) | music+ambience bed 4–17 dB under VO; louder in "noisy" locations (pachinko hall ≈ VO level) |
| Pauses > 120 ms | 1–10 per minute | **VO is tightly edited**: breaths and silences removed, words butt against each other |
| Integrated loudness | −14 LUFS | YouTube target |
| Music tempo | ~95–107 BPM (75 BPM for mystery/tension stories) | light, plucky, melodic (marimba/pizzicato/ukulele-style tonal steps in 600–1400 Hz); bass + soft kick underneath |
| Hi-freq bursts (whooshes) | every 3–5 s, on sentence boundaries | **a whoosh on every transition / whip-pan** |
| Sub-bass hits | every 1–2 s; denser at climax | impacts/booms land **on the impact word** ("smash", "tore", "1000 pounds", "punch", "sink", "kicks sideways") |

### 11.1 Layers (all must be present)
1. **VO** — tightly edited (gaps > 0.30 s cut to 0.12 s; longest pause ≤ 0.33 s), de-essed, compressed.
2. **Music bed** — continuous, topic-appropriate, ~100 BPM (75 for mystery), plucky. **Static level ≈ 20 dB under the voice, NO sidechain ducking** (measured: the bed does not move when the voice starts/stops). It may drop out for one beat on the twist line and resume.
3. **Location ambience** — sea + gulls + creaking wood (ship), crowd murmur (hall), wind (canyon), fire crackle, crickets. Never silent.
4. **Transition SFX** — whoosh on every whip / big camera move and every dissolve (pitch & length vary; never the identical sample twice in a row).
5. **Hard SFX on sync words** — every action verb / impact noun gets a sound on its word (boom, smash, clank, sizzle, splash, coin clink, paper rustle, whistle).
6. **Cartoon accents** — pops on expression swaps, boings, sparkle/ding on reveal, comedic stings on punch lines.
7. **Literal onomatopoeia** — if the script says a sound word ("clickety-clack"), that sound plays.
8. **Climax density** — the final 15 % has the highest SFX density, ending on the biggest hit, then a short tail that loops into the opening.

### 11.2 Mix rules (measured — `mix.py` implements exactly this)
Voice staged at −17.5 dBFS RMS pre-master → **−13.8 dBFS RMS on speech frames in the −14 LUFS master** (measured on the 4 refs); music bed **static, ≈ 20 dB under the voice (no ducking)**; ambience ≈ −32 … −28 dBFS; SFX peaks −10 … −6 dBFS (booms may reach −3 before the limiter). **Mono** (or mono-compatible: L/R correlation ≥ 0.9). Master: loudnorm to **−14 LUFS integrated** (refs −14.0…−14.3), **TP −2 dBTP** (gate ≤ −1.0), **LRA ≤ 3**. No gap below −45 dB longer than 0.25 s.
