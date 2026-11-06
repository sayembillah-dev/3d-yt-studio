/* PURE cast data types (no React/three at runtime: type-only imports) — imported by projects' scenes/cast.ts AND by
 * Node QA (scripts/sfx_cues.mjs reads CAST keys to place pops/impacts on face swaps and beats).
 *
 * Convention (Phase 8): scenes/cast.ts exports `CAST` = one entry per character: its LOOK (hat/outfit/accessories)
 * and its acting KEYS (face/arms/fx/beat per frame). Where it stands/walks lives in scenes/blocking.ts (ACTORS).
 * index.tsx joins them:  <ToonCharacter {...CAST.captain} {...place('captain')} />
 */
import type {CharKey} from './character/StickCharacter';
import type {Look} from './character/draw';
import type {Actor, PathKey, V3} from './blocking';

export type CastMember = {
  look: Look;
  keys: CharKey[];
  /** frame ranges where THIS character's quoted line is spoken (mouth flaps). Narrator lines → none. */
  talk?: [number, number][];
  height?: number;   // world units, feet → head top (default 1.7)
  seed?: number;
  yaw?: number;      // base facing (radians, 0 = +z toward the default camera)
  follow?: number;   // how much the body turns toward the camera (default 0.8)
};
export type Cast = Record<string, CastMember>;

/** Identity helper that keeps the literal keys of the cast (CAST.captain autocompletes). */
export const defineCast = <T extends Cast>(c: T): T => c;

/** pos/path props for a character from the blocking ACTORS list (throws on a missing id = typo guard). */
export function placeOf(actors: Actor[], id: string): {pos?: V3; path?: PathKey[]} {
  const a = actors.find((x) => x.id === id);
  if (!a) throw new Error(`blocking.ts has no actor "${id}" (ids: ${actors.map((x) => x.id).join(', ')})`);
  return a.path ? {path: a.path} : {pos: a.pos};
}
