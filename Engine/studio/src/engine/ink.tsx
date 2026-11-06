import * as THREE from 'three';
import React from 'react';
import {toonRamp} from './materials';

/**
 * INK — the reference look's outline (style-bible §ink): every character part AND every prop gets a dark-plum
 * inverted-hull outline. Lit side thin, shadow side ~2x thicker (brush weight), colour #2A1B26, never black.
 * Width is in the mesh's LOCAL units, so inside a scaled group it scales with the object.
 */
export const INK_COLOR = '#2A1B26';
export const inkLight = {value: new THREE.Vector3(-0.5, 1, 0.6).normalize()};

const inkCache = new Map<string, THREE.MeshBasicMaterial>();
export function inkHullMaterial(width: number, shadowMul = 2.0, color = INK_COLOR): THREE.MeshBasicMaterial {
  const key = `${width.toFixed(5)}|${shadowMul}|${color}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({color, side: THREE.BackSide, fog: true});
  const u = {uInk: {value: width}, uShadowMul: {value: shadowMul}, uLight: inkLight};
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uInk; uniform float uShadowMul; uniform vec3 uLight;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 wn_ = normalize(mat3(modelMatrix) * normal);
       float sh_ = clamp(0.5 - 0.5 * dot(wn_, uLight), 0.0, 1.0);
       vec3 transformed = position + normal * uInk * mix(1.0, uShadowMul, sh_);`,
    );
  };
  m.customProgramCacheKey = () => 'inkhull';
  inkCache.set(key, m);
  return m;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
/** Cached toon material. Soft 3-step ramp (reference: bright, gently stepped cel shading). */
export function toonMat(color: string, map?: THREE.Texture | null, ramp: number[] = [0.6, 0.84, 1.0]): THREE.MeshToonMaterial {
  if (map) return new THREE.MeshToonMaterial({color, map, gradientMap: toonRamp(ramp)});
  const key = color + '|' + ramp.join(',');
  const hit = toonCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshToonMaterial({color, gradientMap: toonRamp(ramp)});
  toonCache.set(key, m);
  return m;
}

const inkBasic = new Map<string, THREE.MeshBasicMaterial>();
/** Flat ink material (limbs, hands, line props). */
export function inkMat(color = INK_COLOR) {
  const hit = inkBasic.get(color);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({color, fog: true});
  inkBasic.set(color, m);
  return m;
}

type InkedProps = {
  geometry: THREE.BufferGeometry; material: THREE.Material; ink?: number; shadowMul?: number;
  position?: [number, number, number]; rotation?: [number, number, number]; scale?: number | [number, number, number];
  renderOrder?: number; visible?: boolean;
};
/** A mesh + its ink hull. ink = outline width in local units (0 = none). */
export const Inked: React.FC<InkedProps> = ({geometry, material, ink = 0.02, shadowMul, position, rotation, scale, renderOrder, visible = true}) => (
  <group position={position} rotation={rotation} scale={scale} visible={visible}>
    <mesh geometry={geometry} material={material} renderOrder={renderOrder} />
    {ink > 0 && <mesh geometry={geometry} material={inkHullMaterial(ink, shadowMul)} renderOrder={renderOrder} />}
  </group>
);
