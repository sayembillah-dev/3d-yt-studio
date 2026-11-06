import {defineCast} from '@engine/cast';
// WHO the characters are (look) and WHAT they do when (keys). Pure data: sfx_cues.mjs reads it to put a pop on
// every face swap and an impact on every `beat`. Positions are NOT here (blocking.ts).
//
// Acting rules (rubric A1–A6, style-bible §2.3):
//  - a key every 12–45 f per visible character; between keys the pose HOLDS (no idle sway)
//  - faces swap ON the sync word: f = Math.round(word.s * 30) from public/words.json (use wordAt(words, 'word'))
//  - action verbs acted on their word ("point" → armR 'point'); shock words → face 'shock' + fx ['sweat','shockLines']
//  - every character gets a distinct hat kind + outfit colour (role readable from the silhouette, rubric C5)
// Faces: neutral smug happy grin laugh shock panic squint angry furious skeptical sleepy sad nervous cool determined
//        evil crying dead wow talk content
// Arms:  down relaxed hip point pointUp wave up hold chin shrug carry behind cross reach fist present drink
// Legs:  stand walk run sit crouch wide tiptoe      Beats: hop nod recoil shake stomp
// Fx:    sweat tears steam zzz shockLines sparkle question exclaim vein hearts dizzy

export const CAST = defineCast({
  hero: {
    seed: 1, yaw: 0.35,
    look: {hat: {kind: 'tricorn', color: '#2A1B26', trim: '#D9A441'}, outfit: {kind: 'coat', color: '#8E2B2B', lapel: '#5E1C1C'}, accessories: ['mustache']},
    talk: [],
    keys: [
      {f: 0, face: 'smug', armL: 'hip', armR: 'relaxed'},
      {f: 30, armR: 'point', look: [0.8, 0]},
      {f: 70, face: 'grin', armR: 'present', holdR: {kind: 'coin'}, beat: 'hop'},
    ],
  },
  doubter: {
    seed: 2, height: 1.6, yaw: -0.4,
    look: {hat: {kind: 'bandana', color: '#C0392B', dots: '#FFFFFF'}, outfit: {kind: 'stripes', a: '#F4EFEA', b: '#C0392B', count: 7}},
    keys: [
      {f: 0, face: 'skeptical', armL: 'cross', armR: 'cross', look: [-0.6, 0]},
      {f: 45, face: 'shock', armL: 'up', armR: 'up', fx: ['sweat', 'shockLines'], beat: 'recoil'},
      {f: 85, face: 'laugh', armL: 'relaxed', armR: 'reach', beat: 'shake'},
    ],
  },
});
