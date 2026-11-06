// Lighting + grade presets per time-of-day / mood (from style-bible §3.6)
export type Mood = {
  skyTop: string; skyMid: string; skyHorizon: string; fog: string; fogNear: number; fogFar: number;
  sun: string; sunIntensity: number; sunDir: [number, number, number];
  fill: string; fillIntensity: number; ground: string;
  rim: string; rimIntensity: number;
  charTint: string;   // multiplies onto 2D characters so they sit in the light
  sunDisc?: {dir: [number, number, number]; color: string; size: number};
  moon?: boolean; stars?: boolean;
  bloom: number; vignette: number;
  /** look-dev (2026-11-06 upgrade): split-tone grade, god-ray strength (0 = off), stylised sunburst behind the disc */
  grade?: {shadowTint?: string; hiTint?: string; split?: number; vibrance?: number; lift?: string; sat?: number; contrast?: number};
  rays?: number; sunburst?: number; shadows?: boolean;
};
/** LOOK-DEV DEFAULTS (2026-11-06, user rule: never flat — applied to EVERY mood, incl. custom ones built by spreading a
 *  mood): sun shadows on, SSAO on (Stage ao default), god rays whenever the mood has a sun/moon disc, split-tone grade. */
export const LOOK_DEFAULTS = {
  shadows: true,
  rays: 0.5,           // used when the mood has a sunDisc and sets no rays of its own
  grade: {shadowTint: '#8C86F0', hiTint: '#FFE6C2', split: 0.24, vibrance: 0.3, lift: '#140C26', sat: 1.02, contrast: 1.07},
};
export const MOODS: Record<string, Mood> = {
  day: {skyTop: '#3F9BE8', skyMid: '#86C9F5', skyHorizon: '#E6F5FF', fog: '#CFE9F8', fogNear: 60, fogFar: 420,
    sun: '#FFF2DC', sunIntensity: 2.6, sunDir: [-0.5, 1, 0.6], fill: '#9CC8FF', fillIntensity: 1.05, ground: '#C9A27A',
    rim: '#FFFFFF', rimIntensity: 0.6, charTint: '#FFFFFF', sunDisc: {dir: [-0.6, 0.55, -1], color: '#FFF8E0', size: 18}, bloom: 0.35, vignette: 0.25,
    grade: {shadowTint: '#8C90FF', hiTint: '#FFF0D2', split: 0.24, vibrance: 0.5, lift: '#101030', sat: 1.12, contrast: 1.07}, rays: 0.45, sunburst: 0.3,
  },
  /** warm late-afternoon: the reference workhorse (long shadows, gold key, violet fill, rays) */
  golden: {skyTop: '#4E80C8', skyMid: '#9CBFE4', skyHorizon: '#FBE3C0', fog: '#F2D9B8', fogNear: 40, fogFar: 340,
    sun: '#FFEBD2', sunIntensity: 2.6, sunDir: [-0.75, 0.42, -0.55], fill: '#8F86E8', fillIntensity: 0.85, ground: '#8A6A4A',
    rim: '#FFC27A', rimIntensity: 1.5, charTint: '#FFFFFF', sunDisc: {dir: [-0.75, 0.3, -1], color: '#FFF0C0', size: 24}, bloom: 0.75, vignette: 0.32,
    grade: {shadowTint: '#8A7CFF', hiTint: '#FFF4E6', split: 0.2, vibrance: 0.3, lift: '#1A1030', sat: 1.02, contrast: 1.07}, rays: 0.75, sunburst: 0.45, shadows: true},
  /** crisp winter day: low sun, blue-violet shadows, snow-white ground (reusable for any cold set) */
  winter: {skyTop: '#5C7FB8', skyMid: '#A9C4E2', skyHorizon: '#F2E6DA', fog: '#D6E2EE', fogNear: 30, fogFar: 300,
    sun: '#FFF2E2', sunIntensity: 2.3, sunDir: [-0.6, 0.38, -0.7], fill: '#9AA8E8', fillIntensity: 0.95, ground: '#C8D4E6',
    rim: '#FFE0C0', rimIntensity: 1.0, charTint: '#FFFFFF', sunDisc: {dir: [-0.7, 0.22, -1], color: '#FFF4DC', size: 18}, bloom: 0.6, vignette: 0.3,
    grade: {shadowTint: '#7A8AE8', hiTint: '#FFF2E2', split: 0.24, vibrance: 0.25, lift: '#10142A', sat: 1.0, contrast: 1.06}, rays: 0.45, sunburst: 0.3},
  sunset: {skyTop: '#2E2466', skyMid: '#B4508C', skyHorizon: '#FFB66B', fog: '#C9789A', fogNear: 40, fogFar: 320,
    sun: '#FFB070', sunIntensity: 2.4, sunDir: [-0.8, 0.35, -0.6], fill: '#7A5BC9', fillIntensity: 0.9, ground: '#6B3C5E',
    rim: '#FF8C5A', rimIntensity: 1.4, charTint: '#FFD9CF', sunDisc: {dir: [-0.7, 0.12, -1], color: '#FFD27A', size: 26}, bloom: 0.7, vignette: 0.35,
    grade: {shadowTint: '#6A4AC8', hiTint: '#FFB880', split: 0.36, vibrance: 0.5, lift: '#1C0C30', sat: 1.12, contrast: 1.08}, rays: 0.8, sunburst: 0.55,
  },
  night: {skyTop: '#0A1440', skyMid: '#1E2F7A', skyHorizon: '#3B4FA0', fog: '#22306E', fogNear: 30, fogFar: 260,
    sun: '#AFC4FF', sunIntensity: 1.1, sunDir: [0.4, 1, 0.3], fill: '#3A4FA8', fillIntensity: 0.9, ground: '#1B2350',
    rim: '#8FB0FF', rimIntensity: 0.9, charTint: '#B9C6FF', sunDisc: {dir: [0.5, 0.5, -1], color: '#F4F2D8', size: 9}, moon: true, stars: true, bloom: 0.8, vignette: 0.45,
    grade: {shadowTint: '#3A4AB8', hiTint: '#FFD9A0', split: 0.3, vibrance: 0.4, lift: '#080A28', sat: 1.08, contrast: 1.08}, rays: 0.3,
  },
  neon: {skyTop: '#0B0826', skyMid: '#1B1446', skyHorizon: '#3A2178', fog: '#241A55', fogNear: 20, fogFar: 200,
    sun: '#8F7BFF', sunIntensity: 0.6, sunDir: [0.2, 1, 0.4], fill: '#3B2D8F', fillIntensity: 1.1, ground: '#151036',
    rim: '#FF3EA5', rimIntensity: 1.2, charTint: '#C9C0FF', stars: false, bloom: 1.1, vignette: 0.5,
    grade: {shadowTint: '#4A2A9A', hiTint: '#FF9AD8', split: 0.3, vibrance: 0.5, lift: '#100828', sat: 1.12, contrast: 1.08}, rays: 0,
  },
  interiorWarm: {skyTop: '#3A2412', skyMid: '#6E4422', skyHorizon: '#B07A44', fog: '#5A3A22', fogNear: 15, fogFar: 120,
    sun: '#FFD08A', sunIntensity: 2.0, sunDir: [-0.3, 1, 0.5], fill: '#D9925A', fillIntensity: 1.1, ground: '#5A3A22',
    rim: '#FFE2B0', rimIntensity: 0.8, charTint: '#FFE8D0', bloom: 0.6, vignette: 0.4,
    grade: {shadowTint: '#7A4A9A', hiTint: '#FFD08A', split: 0.32, vibrance: 0.45, lift: '#1A0C18', sat: 1.1, contrast: 1.08}, rays: 0,
  },
  goldenMorning: {skyTop: '#F2B45A', skyMid: '#F7D08A', skyHorizon: '#FFF0C8', fog: '#F2D2A0', fogNear: 30, fogFar: 300,
    sun: '#FFE0A0', sunIntensity: 2.4, sunDir: [-0.9, 0.4, 0.2], fill: '#E8B080', fillIntensity: 0.9, ground: '#C49A5A',
    rim: '#FFF0C0', rimIntensity: 1.0, charTint: '#FFF0DA', sunDisc: {dir: [-1, 0.3, -0.6], color: '#FFF4C8', size: 22}, bloom: 0.8, vignette: 0.3,
    grade: {shadowTint: '#8A7CE0', hiTint: '#FFE0A0', split: 0.32, vibrance: 0.5, lift: '#1A1028', sat: 1.12, contrast: 1.07}, rays: 0.7, sunburst: 0.5,
  },
};
