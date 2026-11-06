import React from 'react';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import {Stage} from '@engine/Stage';
import {ToonCharacter} from '@engine/character/ToonCharacter';
import {Barrel, Crate, Deck, Railing, Lantern, RopeCoil} from '@engine/props/basic';
import {Water} from '@engine/world/Water';
import {Clouds} from '@engine/world/Sky';
import {Motes, Gulls} from '@engine/fx/particles';
import {Captions} from '@engine/overlay/Captions';
import type {Word} from '@engine/timing';
import wordsJson from '../public/words.json';
import {camera, END} from './camera';
import {at, place} from './blocking';
import {CAST} from './cast';

// index.tsx = sets + props + characters + captions. NO camera maths, NO positions, NO acting keys here:
//   camera → camera.ts · positions → blocking.ts · looks + acting → cast.ts · hand SFX → sfx.ts
// Every frame needs: foreground + midground + background, >= 2 ambient motions, ink on every prop (rubric S1/S2/S5).
const words = wordsJson as Word[];
const HAS_VO = words.length > 0;   // set true once public/vo.mp3 + words.json exist (Phase 5)

const head = (id: string, y = 1.2): [number, number, number] => {
  const p = at(id).pos ?? [0, 0, 0];
  return [p[0], y, p[2]];
};

const Main: React.FC = () => (
  <AbsoluteFill>
    <Stage mood="day" camera={camera} shutter={0.5}
      dof={{focus: (f) => (f < 60 ? head('hero') : head('doubter', 1.1)), bokeh: 4}}>
      {/* background vista */}
      <Water y={-1.2} near="#2C7FB8" far="#9ED8F0" reflect="#FFFFFF" tickScale={22} />
      <Clouds tint="#FFFFFF" shadow="#B8CCE8" clouds={[{pos: [-80, 70, -300], scale: 60, seed: 1, drift: 0.04}, {pos: [60, 90, -320], scale: 80, seed: 2, drift: 0.03}]} />
      <Gulls center={[10, 20, -60]} />
      {/* midground set */}
      <Deck size={[11, 18]} pos={[0, 0, 0]} />
      <Railing pos={[0, 0, -4.2]} length={11} />
      <Barrel pos={[-1.7, 0, -2.6]} label="RUM" seed={1} />
      <Crate pos={[1.4, 0, -2.7]} label="GOLD" seed={3} size={[0.6, 0.55, 0.6]} />
      <RopeCoil pos={[0.2, 0, -3.3]} />
      <Lantern pos={[-2.2, 2.4, -3.6]} seed={2} />
      {/* ambient motion */}
      <Motes center={[0, 1.6, -1.5]} size={[6, 2.5, 5]} count={40} color="#FFF4D0" />
      {/* characters: look + acting from cast.ts, position from blocking.ts */}
      <ToonCharacter {...CAST.hero} {...place('hero')} />
      <ToonCharacter {...CAST.doubter} {...place('doubter')} />
    </Stage>
    {HAS_VO && <Captions words={words} />}
    {HAS_VO && <Audio src={staticFile('vo.mp3')} />}
  </AbsoluteFill>
);

// Composition ids are what render.sh takes as <Comp>. Long-form: one composition per chapter.
export const compositions = [{id: 'Main', component: Main, durationInFrames: END, fps: 30, width: 1080, height: 1920}];
