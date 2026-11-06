# Card — Phases 10–12 (audio, thumbnail, deliver)
Compact extract of style-bible §11, §9.3. Everything here is scripted: run the commands, check the numbers.

## Audio (Phase 10): `sfx_cues.mjs` → `sfx_synth.py` → `qa_all.sh <P> final`
- Layers, all present: VO; continuous music bed (~100 BPM plucky, 75 for mystery) static ≈ 20 dB under the voice with
  **no ducking**; location ambience; a whoosh on every whip and dissolve; a hard SFX on every action verb or impact
  word; pops on face swaps; literal onomatopoeia; densest SFX in the final 15 %.
- Music: `public/music.mp3` only if the user supplied a licensed track; otherwise the procedural bed. Paid SFX
  (ElevenLabs) only with the user's explicit yes, then book it with `ledger.py extra`.
- Gate: `qa_all.sh final` exit 0 → MX1–MX4 PASS, −14 LUFS (−15…−13), TP ≤ −1.0 (target −2), voice −13.8 ± 1.5 dBFS
  RMS, mono, compare 0 hard fails, full size (never a preview).

## Thumbnail (Phase 11)
`thumbnail.py <P> --suggest` → pick the most saturated, most emotional frame showing the **hero object + main
character's face** → `--frame F --text "≤ 3 WORDS"`. Gate: TH1 PASS and Read `work/thumbnail_preview.jpg`; object and
face readable at 10 % size.

## Deliver (Phase 12)
`output/metadata.md`: title (4–8 words, Title Case), 2-line description + sources from research.md, 3–5 hashtags.
Set phase `done` (closes the ledger), then paste the ledger row and `ledger.py show <P>`.
