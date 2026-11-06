import type {Actor, Obstacle} from '@engine/blocking';
import {placeOf} from '@engine/cast';
// Every character's spot/path + every solid prop. index.tsx reads positions FROM here (single source of truth).
export const ACTORS: Actor[] = [
  {id: 'captain', pos: [-0.3, 0, -2.4]},
  {id: 'deckhand', pos: [0.4, 0, -2.6]},
];
export const OBSTACLES: Obstacle[] = [
  {id: 'rum1', pos: [-1.15, 0, -2.95], radius: 0.5, height: 1.2},
  {id: 'rum2', pos: [-1.65, 0, -2.2], radius: 0.5, height: 1.2},
  {id: 'gold', pos: [1.15, 0, -3.1], radius: 0.45, height: 0.6},
  {id: 'cannon', pos: [1.9, 0, -3.4], radius: 0.7, height: 0.8},
  {id: 'mast', pos: [-2.6, 0, -3.4], radius: 0.3, height: 12},
];
export const at = (id: string) => ACTORS.find((a) => a.id === id)!;
export const place = (id: string) => placeOf(ACTORS, id);
