import * as THREE from 'three';
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree, useFrame} from '@react-three/fiber';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender, getInputProps} from 'remotion';
import {Post, PostHandles} from './post/Post';
import {MOODS, Mood, LOOK_DEFAULTS} from './moods';
import {SkyDome} from './world/Sky';
import {GradeEffect, GradeOpts} from './post/MotionBlur';
import {areFontsReady, fontsReady} from './fonts';
import {fbm1} from './random';
import {clamp01} from './timing';

// ---------------------------------------------------------------- camera rig (pure maths lives in ./camera.ts)
import {cameraAt, CameraSpec} from './camera';
export {cameraAt} from './camera';
export type {V3, CamKey, Shake, CameraSpec} from './camera';
import type {V3} from './camera';

function applyCam(cam: THREE.PerspectiveCamera, st: ReturnType<typeof cameraAt>) {
  cam.position.set(...st.pos); cam.fov = st.fov; cam.up.set(Math.sin(st.roll), Math.cos(st.roll), 0);
  cam.lookAt(...st.look); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
}

// ---------------------------------------------------------------- context
type StageCtx = {mood: Mood; frame: number};
const Ctx = createContext<StageCtx | null>(null);
export const useStage = () => { const c = useContext(Ctx); if (!c) throw new Error('useStage outside <Stage>'); return c; };


export type DofSpec = {focus: V3 | ((f: number) => V3); range?: number; bokeh?: number};
export type StageProps = {
  mood?: keyof typeof MOODS | Mood;
  camera: CameraSpec;
  dof?: DofSpec | null;
  shutter?: number;          // motion blur strength (0.5 = 180° shutter)
  bloom?: number;
  grade?: GradeOpts;
  fog?: boolean;
  /** look-dev overrides (default from the mood): god-ray strength, SSAO strength (default 0.6), sun shadows */
  rays?: number; ao?: number; shadows?: boolean;
  post?: boolean;            // debug: disable the effect composer
  children: React.ReactNode;
};

/** Applies the camera for this frame (during React render AND before every R3F/composer render). */
const Rig: React.FC<{spec: CameraSpec; frame: number; applyRef: React.MutableRefObject<(h?: PostHandles) => void>; shutter: number; dof?: DofSpec | null; gradeSet: Parameters<GradeEffect['set']>[0]; sunLight: React.RefObject<THREE.DirectionalLight | null>; sunDir: V3; shadows: boolean}> = ({spec, frame, applyRef, shutter, dof, gradeSet, sunLight, sunDir, shadows}) => {
  const {camera, size, scene} = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const prevCam = useMemo(() => new THREE.PerspectiveCamera(), []);
  const apply = (h?: PostHandles) => {
    cam.aspect = size.width / size.height;
    const st = cameraAt(spec, frame);
    applyCam(cam, st);
    // sun shadow frustum follows what the camera looks at (crisp shadows wherever the flight goes)
    const L = sunLight.current;
    if (L) {
      const n = new THREE.Vector3(...sunDir).normalize();
      L.position.set(st.look[0] + n.x * 60, st.look[1] + n.y * 60, st.look[2] + n.z * 60);
      L.target.position.set(...st.look); L.target.updateMatrixWorld(); L.updateMatrixWorld();
    }
    if (shadows) scene.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || m.userData.noShadow) return;
      const mat = m.material as THREE.Material & {side?: number}; const lit = mat && ((mat as any).isMeshToonMaterial || (mat as any).isMeshStandardMaterial || (mat as any).isMeshLambertMaterial);
      // toon characters CAST shadows but never receive them (no hat-shadow blotches on the white faces — reference look)
      let rec = !!lit; for (let a = m.parent; a && rec; a = a.parent) if (a.userData.noReceive) rec = false;
      m.castShadow = !!lit && !mat.transparent; m.receiveShadow = rec;
    });
    if (!h) return;
    prevCam.aspect = cam.aspect; prevCam.near = cam.near; prevCam.far = cam.far; prevCam.fov = cam.fov;
    applyCam(prevCam, cameraAt(spec, frame - 1));
    const prevVP = new THREE.Matrix4().multiplyMatrices(prevCam.projectionMatrix, prevCam.matrixWorldInverse);
    const curVP = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    // no motion blur across a camera jump (hard cut / track swap): it would smear the whole frame
    const jump = prevCam.position.distanceTo(cam.position) > 0.8;
    h.mb.setMatrices(curVP.invert(), prevVP, jump ? 0 : shutter);
    if (dof && h.dof) {
      const fp = typeof dof.focus === 'function' ? dof.focus(frame) : dof.focus;
      const dist = cam.position.distanceTo(new THREE.Vector3(...fp));
      h.dof.cocMaterial.worldFocusDistance = dist;
      h.dof.cocMaterial.worldFocusRange = dof.range ?? Math.max(1.2, dist * 0.3);
      h.dof.bokehScale = dof.bokeh ?? 4;
    }
    h.grade.set({...gradeSet, seed: frame * 0.137});
  };
  applyRef.current = apply;
  apply();
  useFrame(() => apply(), -1);
  return null;
};

const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [ok, setOk] = useState(areFontsReady());
  const [handle] = useState(() => (areFontsReady() ? null : delayRender('font-gate')));
  useEffect(() => { if (!ok) fontsReady.then(() => setOk(true)); }, [ok]);
  useEffect(() => { if (ok && handle !== null) { const id = requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle))); return () => cancelAnimationFrame(id); } }, [ok, handle]);
  return ok ? <>{children}</> : null;
};

export const Stage: React.FC<StageProps> = ({mood = 'day', camera, dof = null, shutter = 0.5, bloom, grade, fog = true, post = true, rays, ao, shadows, children}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const m: Mood = typeof mood === 'string' ? MOODS[mood] : mood;
  const applyRef = React.useRef<(h?: PostHandles) => void>(() => {});
  const sunLight = React.useRef<THREE.DirectionalLight | null>(null);
  const [sunMesh, setSunMesh] = useState<THREE.Mesh | null>(null);
  const useShadows = shadows ?? m.shadows ?? LOOK_DEFAULTS.shadows;
  // measure mode (render.sh measure): same motion, cheap look — only motion/pacing numbers are read from it
  const measure = !!(getInputProps() as {measure?: boolean}).measure;
  const rayAmt = measure ? 0 : rays ?? m.rays ?? (m.sunDisc ? LOOK_DEFAULTS.rays : 0);
  const aoAmt = measure ? 0 : ao ?? 0.6;
  const shadowRes = measure ? 1024 : 4096;
  const camNow = cameraAt(camera, frame).pos;
  // the sun (god-ray source) sits in the sky relative to the CAMERA, like the sky dome
  const sunDiscPos = m.sunDisc ? new THREE.Vector3(...m.sunDisc.dir).normalize().multiplyScalar(820).add(new THREE.Vector3(...camNow)) : null;
  return (
    <AbsoluteFill style={{background: m.skyMid}}>
      <FontGate>
        <ThreeCanvas shadows={useShadows} width={width} height={height} gl={{antialias: !post, powerPreference: 'high-performance', preserveDrawingBuffer: true}} camera={{fov: 40, near: 0.1, far: 2000, position: [0, 2, 10]}}
          onCreated={({gl}) => { gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
          <Ctx.Provider value={{mood: m, frame}}>
            {fog && <fog attach="fog" args={[m.fog, m.fogNear, m.fogFar]} />}
            <hemisphereLight args={[m.fill, m.ground, m.fillIntensity]} />
            <directionalLight ref={sunLight} position={[m.sunDir[0] * 50, m.sunDir[1] * 50, m.sunDir[2] * 50]} color={m.sun} intensity={m.sunIntensity}
              castShadow={useShadows} shadow-mapSize-width={shadowRes} shadow-mapSize-height={shadowRes} shadow-bias={-0.0018} shadow-normalBias={0.07} shadow-radius={3}
              shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={1} shadow-camera-far={160} />
            {rayAmt > 0 && sunDiscPos && (
              <mesh ref={(r) => { if (r && r !== sunMesh) setSunMesh(r); }} position={sunDiscPos} userData={{noShadow: true}}>
                <sphereGeometry args={[(m.sunDisc!.size) * 0.62, 24, 12]} />
                <meshBasicMaterial color={m.sunDisc!.color} transparent depthWrite={false} fog={false} toneMapped={false} />
              </mesh>
            )}
            <directionalLight position={[-m.sunDir[0] * 40, 20, -m.sunDir[2] * 40 - 30]} color={m.rim} intensity={m.rimIntensity} />
            <ambientLight intensity={0.25} color={m.fill} />
            {/* sky follows the camera: sets may live anywhere in world space (multi-set projects) */}
            <group position={camNow}><SkyDome mood={m} /></group>
            {children}
            <Rig spec={camera} frame={frame} applyRef={applyRef} shutter={shutter} dof={dof} gradeSet={{vignette: m.vignette, ...LOOK_DEFAULTS.grade, ...(m.grade ?? {}), ...grade}} sunLight={sunLight} sunDir={m.sunDir} shadows={useShadows} />
            {post && (rayAmt === 0 || sunMesh) && <Post frame={frame} msaa={measure ? 0 : 4} bloom={bloom ?? m.bloom} dof={!!dof} bokeh={dof?.bokeh ?? 4} sun={sunMesh} rays={rayAmt} ao={aoAmt} onBeforeRender={(h) => applyRef.current(h)} />}
          </Ctx.Provider>
        </ThreeCanvas>
      </FontGate>
    </AbsoluteFill>
  );
};
