import React from 'react';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import {Stage, CameraSpec} from '@engine/Stage';
import {StickCharacter} from '@engine/character/StickCharacter';
import {Barrel, Crate, Deck, Railing, Cannon, Sign, Lantern, RopeCoil, SeaStack} from '@engine/props/basic';
import {Water} from '@engine/world/Water';
import {Clouds} from '@engine/world/Sky';
import {Motes, Gulls, Flag, SmokePuffs} from '@engine/fx/particles';
import {Captions} from '@engine/overlay/Captions';
import {track, wordAt, Word} from '@engine/timing';
import wordsJson from '../public/words.json';

const words = wordsJson as Word[];
const W = (t: string, n = 0) => wordAt(words, t, n);
const END = Math.ceil(words[words.length - 1].e * 30) + 8;

// ---- beats keyed to the VO (style-bible §10: visual lands on its word)
const F = {pirates: W('Pirates'), never: W('never'), sank: W('sank'), attacked: W('attacked,'), see: W('see,'), sunken: W('sunken'), pay: W('pay'), you2: W('you.')};

const CAPTAIN = [0, 0, -2.6] as [number, number, number];
const MERCHANT = [1.55, 0, -2.0] as [number, number, number];

// ONE camera for the whole piece: waypoints of a single continuous flight (~1.7 s apart)
const camera: CameraSpec = {
  drift: 0.05,
  keys: [
    {f: 0, pos: [-5, 5.2, 9.5], look: [0, 1.5, -2.8], fov: 38},              // swoop down from above the sea onto the deck
    {f: F.sank, pos: [-2.6, 1.15, 4.6], look: [0.2, 1.45, -2.6], fov: 34}, // low angle on the captain
    {f: F.see, pos: [1.9, 0.95, 1.6], look: [1.55, 1.05, -2.0], fov: 32},   // flowed right past the barrel → merchant
    {f: F.sunken + 10, pos: [-0.9, 1.45, 0.4], look: [0.05, 1.35, -2.6], fov: 30}, // close on captain explaining
    {f: F.pay + 6, pos: [0.9, 1.3, 3.4], look: [0.78, 1.0, -2.2], fov: 36},       // two-shot over the gold crate
    {f: END, pos: [1.0, 1.5, 4.2], look: [0.78, 1.05, -2.2], fov: 37},
  ],
  shakes: [],
};

const Slice: React.FC = () => (
  <AbsoluteFill>
    <Stage mood="sunset" camera={camera} shutter={0.55}
      dof={{focus: (f) => track(f, [[0, CAPTAIN], [F.sank, CAPTAIN], [F.attacked, MERCHANT], [F.see + 6, MERCHANT], [F.sunken, CAPTAIN], [F.pay, CAPTAIN], [F.pay + 8, [0.78, 0.6, -2.0]]]).map((v, i) => v + (i === 1 ? 1.4 : 0)) as [number, number, number], bokeh: 5}}>
      {/* --- sea, sky, far layer */}
      <Water y={-1.2} near="#3A2C6E" far="#E58A6A" reflect="#FFC27A" tickScale={22} />
      <SeaStack pos={[-75, -1.2, -170]} height={30} radius={10} seed={3} />
      <SeaStack pos={[-38, -1.2, -170]} height={22} radius={6} seed={8} />
      <SeaStack pos={[95, -1.2, -210]} height={38} radius={12} seed={5} />
      <Clouds tint="#FFC9B0" shadow="#B4609A" clouds={[{pos: [-80, 70, -300], scale: 60, seed: 1, drift: 0.04}, {pos: [60, 90, -320], scale: 80, seed: 2, drift: 0.03}, {pos: [10, 55, -260], scale: 40, seed: 3, drift: 0.05}]} />
      <Gulls center={[10, 20, -60]} />

      {/* --- the ship deck (mid layer) */}
      <Deck size={[11, 18]} pos={[0, 0, 0]} />
      <Railing pos={[0, 0, -4.2]} length={11} />
      <Railing pos={[-5.4, 0, 0]} rot={[0, Math.PI / 2, 0]} length={8.4} />
      <group position={[-3.4, 0, -2.4]}>
        <mesh position-y={6}><cylinderGeometry args={[0.16, 0.22, 12, 10]} /><meshToonMaterial color="#6B3E1E" /></mesh>
        <Lantern pos={[0.25, 3.2, 0]} seed={2} />
        <Flag pos={[0, 11.2, 0]} w={2} h={1.2} color="#1E1612" />
      </group>
      <Cannon pos={[-2.4, 0, -3.3]} rot={[0, Math.PI, 0]} />
      <SmokePuffs pos={[-2.4, 0.9, -4.6]} count={6} rate={12} color="#E8D8E8" rise={2.2} size={0.7} />
      <Barrel pos={[-4.0, 0, 0.2]} label="RUM" seed={1} />
      <Barrel pos={[-4.4, 0, 1.3]} label="RUM" seed={2} rot={[0, 0.6, 0]} />
      <Barrel pos={[-2.9, 0, 2.2]} label="POWDER" labelStyle="stencil" seed={4} wood="#8E5A30" /> {/* foreground DOF blur when camera flows past */}
      <Crate pos={[0.8, 0, -1.4]} label="GOLD" seed={3} size={[0.7, 0.62, 0.7]} />
      <Crate pos={[4.4, 0, -2.6]} seed={6} size={[0.8, 0.7, 0.8]} />
      <RopeCoil pos={[-1.2, 0, -3.6]} />
      <Sign pos={[-3.2, 2.2, -4.15]} text="THE SALTY DOG" sub="no refunds" style="painted" w={2.2} h={0.7} />
      <Motes center={[0, 1.8, -1]} size={[9, 3, 7]} count={50} color="#FFD9A8" />

      {/* --- characters: nobody stands still */}
      <StickCharacter seed={1} pos={CAPTAIN}
        look={{hat: {kind: 'tricorn', color: '#1E1612', trim: '#D9A441'}, outfit: {kind: 'stripes', a: '#F4EFEA', b: '#C0392B', count: 7}, accessories: ['eyepatch', 'mustache']}}
        talk={[[F.see, F.you2 + 10]]}
        keys={[
          {f: 0, face: 'smug', armL: 'hip', armR: 'relaxed', look: [0.3, 0]},
          {f: F.never, armR: 'point', look: [0.9, 0]},
          {f: F.attacked, face: 'evil', armR: 'fist', beat: 'stomp'},
          {f: F.see, face: 'neutral', armR: 'pointUp', armL: 'hip', look: [0.2, 0], beat: 'nod'},
          {f: F.sunken, face: 'skeptical', armR: 'shrug', armL: 'shrug'},
          {f: F.pay, face: 'grin', armR: 'present', armL: 'hip', holdR: {kind: 'cash'}, fx: ['sparkle'], beat: 'hop'},
        ]} />
      <StickCharacter seed={2} pos={MERCHANT} height={1.62}
        look={{hat: {kind: 'bowler', color: '#3A2A20'}, outfit: {kind: 'vest', shirt: '#F4EFEA', vest: '#5B6E8C', chain: true}, accessories: ['glasses']}}
        keys={[
          {f: 0, face: 'nervous', armL: 'hold', armR: 'hold', holdR: {kind: 'coin'}, look: [-0.6, 0]},
          {f: F.attacked, face: 'shock', armL: 'up', armR: 'up', fx: ['sweat', 'shockLines'], beat: 'recoil'},
          {f: F.see + 8, face: 'nervous', armL: 'cross', armR: 'hold', fx: ['sweat'], look: [-0.8, 0]},
          {f: F.pay, face: 'sad', armR: 'reach', armL: 'relaxed', fx: [], holdR: {kind: 'cash'}},
          {f: F.pay + 6, holdR: null},
        ]} />
    </Stage>
    <Captions words={words} y={0.72} highlight={{never: '#FFD23F', pay: '#7CFC9A'}} />
    <Audio src={staticFile('vo.mp3')} />
  </AbsoluteFill>
);

export const compositions = [
  {id: 'DemoPirateSlice', component: Slice, durationInFrames: END, fps: 30, width: 1080, height: 1920},
];
