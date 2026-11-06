# Topic rubric — 6 criteria, score /10, only topics ≥ 7.0 proceed

What the 4 reference Shorts have in common (style-bible §9, measured): a **real, slightly obscure mechanism told as a
fable** with an anonymous role-noun hero ("a railroad engineer", "a court astronomer"), a **strange action** someone
mocked, and a **reveal** at 59–81 % that makes the strange action obviously smart. Score every candidate against that.

## How to score
1. For each criterion give 0, 1, 2 (use the anchors; no half points except where stated).
2. Weighted total = Σ (score × weight). Max raw = 2 × (sum of weights 5) = 10.
3. **Gate: total ≥ 7.0 AND no criterion at 0.** Below that: propose a sharper angle of the same topic and re-score
   (most weak topics fail on S1 or S3 — find the one person who did the odd thing).
4. Write the table into the chat and the number into `project.json` → `topic_score`, the row into `topic_scores`.

| id | criterion | weight | 0 | 1 | 2 |
|---|---|---|---|---|---|
| **S1** | **Strange action** — one visible, odd thing a person/group did (the hook) | 1.25 | no action, just a fact ("Rome had concrete") | an odd situation, but nobody *does* anything | a specific person does a specific weird thing ("He sawed gaps into a railroad every 39 feet") |
| **S2** | **Mechanism** — there is a real, concrete *why* that can be drawn | 1.0 | no mechanism / it's a mystery / "nobody knows" | mechanism exists but is abstract (economics, law text) | physical or system mechanism you can draw in one in-world diagram (rail expansion, pendulum, token shop) |
| **S3** | **Doubter & payoff** — someone mocked it, and it paid off (or backfired) | 0.75 | no conflict | conflict OR payoff, not both | both: mocked → vindicated (or a sharp ironic backfire) |
| **S4** | **Obscurity** — the audience has *not* heard this exact story | 0.75 | top-10 trivia (Great Wall, Titanic iceberg) | known topic, unknown angle | genuinely unfamiliar to most viewers; first search page has ≤ 1 viral video on it |
| **S5** | **Drawability** — sets & props StickWorld can build (7–10 sets / 60 s, signage, characters with role hats) | 0.75 | mostly abstract / screens / text / modern UI | 3–6 sets, some abstract beats | ≥ 7 distinct physical sets with a hero object; roles readable by hat/outfit |
| **S6** | **Verifiability & safety** — ≥ 5 facts with sources; no real-person defamation, tragedy-as-comedy, medical/financial advice, or current politics | 0.5 | can't source it / sensitive (recent deaths, politics, health claims) | sources thin (1–2), or needs careful framing | ≥ 5 independent sources; historical or system story; safe to joke about |

Weights sum to 5.0 → total = Σ score × weight (max 10).

## Example (calibration — scores the four references get)
| Topic | S1 | S2 | S3 | S4 | S5 | S6 | Total |
|---|---|---|---|---|---|---|---|
| Why Perfect Railroads Don't Work (expansion gaps) | 2 | 2 | 2 | 2 | 2 | 2 | **10.0** |
| The Ancient Jar That Warned an Empire (Zhang Heng seismoscope) | 2 | 2 | 2 | 1 | 2 | 2 | **9.25** |
| The Window That Breaks Japan's Gambling Law (pachinko exchange) | 1 | 2 | 1 | 1 | 2 | 2 | **7.25** |
| Levels of Pirate Cannonballs (ladder format) | 1 | 2 | 1 | 1 | 2 | 2 | **7.25** |
| "Rome had concrete" (counter-example) | 0 | 1 | 0 | 0 | 1 | 2 | **2.75 → reject** |

"Levels of …" ladders score lower on S1/S3 by design; they pass on mechanism + drawability. Use them sparingly.

## Suggesting topics (when the user says "suggest")
Propose 5 candidates across different domains (engineering, history, law/systems, nature, everyday objects). For each:
one-line hook in the script's hook form (statement, ≤ 11 words, no question), the mechanism in ≤ 12 words, and the score row.
Prefer: unusual rules that make sense once explained, inventions that were mocked, objects with a hidden purpose,
systems that work around a law, historical tricks. Avoid: anything whose only mechanism is "it was a scam", tragedies,
living private people, and topics you cannot source (S6 = 0 → reject).
