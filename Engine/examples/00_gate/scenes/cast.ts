import {defineCast} from '@engine/cast';
// Looks + acting keys (pure data → sfx_cues.mjs). Word frames from public/words.json:
// The 0 · captain 4 · kept 15 · his 21 · rum 26 · right 30 · beside 38 · the 46 · gold. 57 · and 59 · the 62 · deckhand 65 · panicked. 74
export const CAST = defineCast({
  captain: {
    seed: 1, yaw: 0.35,
    look: {hat: {kind: 'tricorn', color: '#2A1B26', trim: '#D9A441'}, outfit: {kind: 'coat', color: '#8E2B2B', lapel: '#5E1C1C'}, accessories: ['eyepatch', 'mustache']},
    talk: [],
    keys: [
      {f: 0, face: 'smug', armL: 'hip', armR: 'relaxed'},
      {f: 24, armL: 'point', armR: 'hip', look: [-0.8, 0]},                            // "rum": points (screen-left) at the barrels
      {f: 55, face: 'happy', armL: 'relaxed', armR: 'present', holdR: {kind: 'coin'}, look: [0.6, 0], beat: 'hop'}, // "gold."
      {f: 88, face: 'smug', armR: 'hip', look: [0.8, 0], beat: 'nod'},
    ],
  },
  deckhand: {
    seed: 2, height: 1.6, yaw: -0.45,
    look: {hat: {kind: 'bandana', color: '#C0392B', dots: '#FFFFFF'}, outfit: {kind: 'stripes', a: '#F4EFEA', b: '#C0392B', count: 7}},
    keys: [
      {f: 0, face: 'nervous', armL: 'hold', armR: 'hold', look: [-0.6, 0]},
      {f: 36, face: 'skeptical', armL: 'cross', armR: 'cross'},
      {f: 72, face: 'panic', armL: 'up', armR: 'up', fx: ['sweat', 'shockLines'], beat: 'recoil'}, // "panicked."
      {f: 98, face: 'sad', armL: 'relaxed', armR: 'reach', fx: ['sweat']},
    ],
  },
});
