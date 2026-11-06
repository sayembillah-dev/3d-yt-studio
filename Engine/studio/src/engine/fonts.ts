import {loadFont as rye} from '@remotion/google-fonts/Rye';
import {loadFont as blackOps} from '@remotion/google-fonts/BlackOpsOne';
import {loadFont as nunito} from '@remotion/google-fonts/Nunito';
import {loadFont as playfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as alfa} from '@remotion/google-fonts/AlfaSlabOne';
import {loadFont as baloo} from '@remotion/google-fonts/Baloo2';
import {loadFont as archivoBlack} from '@remotion/google-fonts/ArchivoBlack';
import {continueRender, delayRender} from 'remotion';

// Load every font used by canvas textures + captions BEFORE any texture is drawn.
const loads = [
  rye('normal', {weights: ['400'], subsets: ['latin']}),
  blackOps('normal', {weights: ['400'], subsets: ['latin']}),
  nunito('normal', {weights: ['700', '800', '900'], subsets: ['latin']}),
  playfair('normal', {weights: ['700', '900'], subsets: ['latin']}),
  alfa('normal', {weights: ['400'], subsets: ['latin']}),
  baloo('normal', {weights: ['700', '800'], subsets: ['latin']}),
  archivoBlack('normal', {weights: ['400'], subsets: ['latin']}),
];
let ready = false;
const handle = delayRender('fonts');
export const fontsReady: Promise<void> = Promise.all(loads.map((l) => l.waitUntilDone()))
  .then(() => document.fonts.ready).then(() => { ready = true; setTimeout(() => continueRender(handle), 0); });
export const areFontsReady = () => ready;
// Captions: Archivo Black (measured on the references: heavy grotesque, one line of 1–2 words, thin dark stroke)
export const CAPTION_FONT = '"Archivo Black", sans-serif';
