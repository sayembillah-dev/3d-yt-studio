# Card — Phases 4–5 (script, voice)
Compact extract of style-bible §9, §10, §M. Open the full style-bible only for a section a lint check names.

## Structure (Short 45–65 s, words = duration × 3.66)
1. **Hook**, sentence 1, ≤ 3 s: a strange action or paradox, in medias res. Never a question, never "Did you know".
   Example: "He sawed gaps into a railroad every 39 feet."
2. **Doubter / stakes**: someone mocks it ("The whole court burst out laughing.").
3. **"You see,"**: the context pivot.
4. **Escalation**: each beat raises stakes (a levels ladder, or second-person "So, you…").
5. **Quoted punch-line** spoken by the narrator ("You're wrecking my railroad!").
6. **Mechanism reveal [REVEAL]** at 59–81 % of runtime: a concrete, drawable how-it-works (cut-away, pendulum, gap).
7. **Payoff**: abrupt, ends on the image. No moral, no outro, no "subscribe".
8. **Loop**: the last line flows grammatically into line 1.

## Language
- Every noun must be drawable; every sentence gives ≥ 1 visual beat. Specific numbers and names (39 feet, 1672).
- Short conversational sentences, light humour; past tense for history, present tense for systems.
- Anonymous role-noun hero ("a plumber", "the captain"); real, slightly obscure mechanism told as a fable.
- Only facts from research.md that aren't marked UNVERIFIED.

## Title (L10)
4–8 words, Title Case: "The [Object] That …" / "Why [Group] [Odd Thing]" / "Levels of …".

## Voice (Phase 5): user rules
- The VO is the user's own voice (recorded, or the local clone `tts_clone.py`). Never clone anyone else.
- Pace: 3.66 w/s guide, gate 3.2–4.1, **aim 3.27–4.0** (`transcribe.py --gate`; WARN = not passed).
  Longest pause ≤ 0.33 s.
- Too long: **cut script words**. Don't speed the clone: 1.10× sounded rushed to the user. Fixes in this order:
  `--keep 0.10`, denser wording, `--atempo` ≤ 1.05.
- Speech starts at 0.00 s; no lead-in.
