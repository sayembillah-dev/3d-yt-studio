import type {CameraSpec} from '@engine/camera';
// ONE camera for the whole video. Waypoints are passed THROUGH (default ease 'flow') — the camera never stops.
// Put a waypoint on each beat's first frame from shotlist.json (~every 51 f = 1.7 s). Checked by cam_qa.py G1–G17.
// Rules: no `ease` except ONE deliberate landing (the reveal) and `ease: 'whip'` swoops; fov 22–60; y >= 0.25.

/** Last frame of the composition = last VO word end + <= 15 f (style-bible: end on the image). */
export const END = 108;

export const camera: CameraSpec = {
  drift: 0.04,               // always-on handheld breathing (>= 0.04, never 0)
  keys: [
    {f: 0, pos: [-1.2, 1.5, 2.6], look: [0, 1.15, -2.3], fov: 38},   // hook framing: the strange action is visible at f 0
    {f: 40, pos: [-0.2, 1.3, 1.2], look: [-0.3, 1.25, -2.4], fov: 34}, // beat 2 (<= 45 f, cam_qa G6)
    {f: 80, pos: [1.3, 1.2, 0.6], look: [0.45, 1.1, -2.0], fov: 32},   // beat 3 (2 changes in 0–3 s, G7)
    {f: 108, pos: [1.0, 1.35, 1.6], look: [0.1, 1.1, -2.2], fov: 36},  // within 20 f of END (G13)
  ],
  shakes: [],                // {f, amp: 0.05, dur: 8} on impact words
};

/** Set changes that are not camera flights: dissolves are 8 f (refs 7.5–9); cuts <= 1 per 60 s. */
export const TRANSITIONS: {f: number; kind: 'dissolve' | 'cut'; len?: number}[] = [];
