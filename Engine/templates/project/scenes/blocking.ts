import type {Actor, Obstacle} from '@engine/blocking';
import {placeOf} from '@engine/cast';
// WHERE everything stands. Single source of truth: index.tsx reads character positions FROM here.
// cam_qa G16 (actors never overlap) and G17 (camera never inside a person/prop) read ACTORS + OBSTACLES.
// NAMING (cam_qa G18): actor id = <shotlist cast id><beat or n>, e.g. cast "watts" in beat b12 → 'watts12'. G18 fails a
// beat whose cast has no such actor, or whose actor is never framed in the middle half of the beat.
// Two-shots: keep characters ~1.5 apart (the 9:16 frame is only ~1.7 units wide at 4.6 units distance).

export const ACTORS: Actor[] = [
  {id: 'hero', pos: [-0.45, 0, -2.4]},
  {id: 'doubter', pos: [0.5, 0, -2.0]},
  // walker example: {id: 'runner', path: [{f: 0, pos: [3, 0, -3]}, {f: 40, pos: [1.2, 0, -2.6]}], enter: 0, exit: 120},
];

/** Every solid prop the camera could hit or a character could walk through (radius = footprint, height = top). */
export const OBSTACLES: Obstacle[] = [
  {id: 'barrel1', pos: [-1.7, 0, -2.6], radius: 0.45, height: 1.2},
  {id: 'crate1', pos: [1.4, 0, -2.7], radius: 0.45, height: 0.6},
];

export const at = (id: string) => {
  const a = ACTORS.find((x) => x.id === id);
  if (!a) throw new Error(`no actor ${id}`);
  return a;
};
/** pos/path props for <ToonCharacter {...CAST.id} {...place('id')} /> */
export const place = (id: string) => placeOf(ACTORS, id);
