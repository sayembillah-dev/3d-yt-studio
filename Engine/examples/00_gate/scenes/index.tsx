import React from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {Stage} from '@engine/Stage';
import {MOODS} from '@engine/moods';
import {Inked, toonMat} from '@engine/ink';
import {ToonCharacter} from '@engine/character/ToonCharacter';
import {Barrel, Crate, Deck, Railing, Cannon, Lantern, RopeCoil, SeaStack} from '@engine/props/basic';
import {Water} from '@engine/world/Water';
import {Clouds} from '@engine/world/Sky';
import {Motes, Gulls, Flag} from '@engine/fx/particles';
import {Captions} from '@engine/overlay/Captions';
import type {Word} from '@engine/timing';
import wordsJson from '../public/words.json';
import {camera, END} from './camera';
import {at, place} from './blocking';
import {CAST} from './cast';

// GATE SHOT (guide step 4): one 3.6 s shot, two characters, judged by numbers + a 5-lens review before a full video.
const words = wordsJson as Word[];
const head = (id: string, y = 1.2): [number, number, number] => { const p = at(id).pos!; return [p[0], y, p[2]]; };
const mastGeo = new THREE.CylinderGeometry(0.16, 0.22, 12, 12);
// value gate (refs 0.46–0.62): calmer sun/fill than the stock day mood
const mood = {...MOODS.day, sunIntensity: 2.2, fillIntensity: 0.85};

const Gate: React.FC = () => (
  <AbsoluteFill>
    <Stage mood={mood} camera={camera} shutter={0.5} grade={{tint: '#E4DFD8', sat: 0.88}}
      dof={{focus: (f) => (f < 64 ? head('captain') : head('deckhand', 1.1)), bokeh: 4}}>
      <Water y={-1.2} near="#2C7FB8" far="#9ED8F0" reflect="#FFFFFF" tickScale={22} />
      <Clouds tint="#FFFFFF" shadow="#9FB4D6" clouds={[{pos: [-90, 45, -300], scale: 34, seed: 1, drift: 0.04}, {pos: [70, 60, -340], scale: 42, seed: 2, drift: 0.03}, {pos: [-10, 38, -380], scale: 26, seed: 5, drift: 0.05}]} />
      <SeaStack pos={[-38, -1.2, -120]} height={34} radius={9} seed={11} />
      <SeaStack pos={[44, -1.2, -150]} height={26} radius={7} seed={12} />
      <Gulls center={[10, 20, -60]} />
      <Deck size={[11, 18]} pos={[0, 0, 0]} wood="#9A6638" />
      <Railing pos={[0, 0, -4.2]} length={11} />
      <group position={[-2.6, 0, -3.4]}>
        <Inked geometry={mastGeo} material={toonMat('#6B3E1E')} position={[0, 6, 0]} ink={0.02} />
        <Lantern pos={[0.25, 2.6, 0]} seed={2} />
        <Flag pos={[0, 11.2, 0]} w={2} h={1.2} color="#2A1B26" />
      </group>
      <Cannon pos={[1.9, 0, -3.4]} rot={[0, Math.PI, 0]} />
      <Barrel pos={[-1.15, 0, -2.95]} label="RUM" seed={1} rot={[0, 0.3, 0]} />
      <Barrel pos={[-1.65, 0, -2.2]} label="RUM" seed={2} rot={[0, 0.6, 0]} />
      <Crate pos={[1.15, 0, -3.1]} label="GOLD" seed={3} size={[0.6, 0.55, 0.6]} />
      <RopeCoil pos={[0.2, 0, -3.3]} />
      <Motes center={[0, 1.6, -1.5]} size={[6, 2.5, 5]} count={40} color="#FFF4D0" />
      <ToonCharacter {...CAST.captain} {...place('captain')} />
      <ToonCharacter {...CAST.deckhand} {...place('deckhand')} />
    </Stage>
    <Captions words={words} />
  </AbsoluteFill>
);
export const compositions = [{id: 'Gate', component: Gate, durationInFrames: END, fps: 30, width: 1080, height: 1920}];
