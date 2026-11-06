import type {CameraSpec} from '@engine/camera';
// ONE camera. Waypoints are passed THROUGH (ease 'flow' default) — never a stop.
// Beats keyed to public/words.json: "rum" f26 · "gold." f57 · "panicked." f74. Motion peaks (= measured framing
// changes) fall mid-segment: keys 0/36/82 → peaks ≈ f20/f60 → 2 changes in 0–3 s, ~1.5 s apart.
export const END = 108;
export const camera: CameraSpec = {
  drift: 0.04,
  keys: [
    {f: 0, pos: [-2.9, 3.1, 5.4], look: [0.4, 0.9, -2.5], fov: 42},     // hook: swoop down onto the deck (rum + captain + gold)
    {f: 36, pos: [-0.55, 1.3, 1.6], look: [-0.2, 1.2, -2.5], fov: 40},  // land low on the two-shot, captain pointing at the rum (deckhand stays in: C2)
    {f: 82, pos: [0.15, 1.25, 0.95], look: [0.05, 1.15, -2.55], fov: 36}, // low push into a tight two-shot (arriving through "panicked" f74)
    {f: 108, pos: [0.45, 1.32, 0.75], look: [0.05, 1.15, -2.55], fov: 38}, // gentle drift on, same direction (never reverse: cam_qa G2)
  ],
};
export const TRANSITIONS: {f: number; kind: 'dissolve' | 'cut'; len?: number}[] = [];
