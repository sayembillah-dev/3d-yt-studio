import React from 'react';
import * as THREE from 'three';
import {ThreeCanvas} from '@remotion/three';
import {useVideoConfig} from 'remotion';
import {EffectComposer, Bloom, wrapEffect} from '@react-three/postprocessing';
import {CameraMotionBlurEffect, GradeEffect} from './engine/post/MotionBlur';
import {Stage} from './engine/Stage';
import {useFrame, useThree} from '@react-three/fiber';
const Probe: React.FC = () => { const st = useThree(); useFrame((s) => { console.log('DBG useFrame', s.internal.priority, s.gl.getContextAttributes()?.alpha, s.gl.getContextAttributes()?.preserveDrawingBuffer, s.size.width, s.size.height); }, 2); React.useEffect(() => { console.log('DBG mounted', st.frameloop); }, []); return null; };
const MB = wrapEffect(CameraMotionBlurEffect); const GR = wrapEffect(GradeEffect);
export const Debug: React.FC<{post: boolean; sky: boolean; fx?: string}> = ({post, fx}) => {
  const {width, height} = useVideoConfig();
  if (fx === undefined) return (
    <Stage mood="sunset" post={post} camera={{keys: [{f: 0, pos: [0, 2, 6], look: [0, 1, 0]}, {f: 30, pos: [2, 2, 6], look: [0, 1, 0]}]}}>
      <mesh position={[0, 1, 0]}><boxGeometry args={[1.5, 1.5, 1.5]} /><meshToonMaterial color="#E0A040" /></mesh>
    </Stage>);
  return (
    <ThreeCanvas width={width} height={height} camera={{position: [0, 2, 6]}}>
      <ambientLight intensity={1} /><Probe />
      <mesh position={[0, 0, 0]}><boxGeometry args={[1.5, 1.5, 1.5]} /><meshToonMaterial color="#E0A040" /></mesh>
      <EffectComposer multisampling={fx.includes("ms") ? 4 : 0} frameBufferType={fx.includes("ub") ? THREE.UnsignedByteType : THREE.HalfFloatType} autoClear={!fx.includes("noclear")}>
        {fx.includes('bloom') ? <Bloom intensity={0.5} mipmapBlur /> : <></>}
        {fx.includes('mb') ? <MB /> : <></>}
        {fx.includes('grade') ? <GR /> : <></>}
      </EffectComposer>
    </ThreeCanvas>);
};
