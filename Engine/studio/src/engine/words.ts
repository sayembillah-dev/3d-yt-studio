// PURE (no remotion/three): safe to import from Node QA tools (cam_dump).
export type Word = {w: string; s: number; e: number}; // seconds
export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);

/** Find frame where the n-th (0-based) occurrence of `text` starts (case/punct-insensitive). */
export function wordAt(words: Word[], text: string, occurrence = 0, fps = FPS): number {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9']/g, '');
  const target = text.split(/\s+/).map(norm);
  let seen = 0;
  for (let i = 0; i < words.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) if (norm(words[i + j]?.w ?? '') !== target[j]) { ok = false; break; }
    if (ok) { if (seen === occurrence) return Math.round(words[i].s * fps); seen++; }
  }
  throw new Error(`wordAt: "${text}" #${occurrence} not found in transcript`);
}
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
