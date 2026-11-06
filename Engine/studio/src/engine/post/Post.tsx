import * as THREE from 'three';
import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {useThree, useFrame} from '@react-three/fiber';
import {delayRender, continueRender, getRemotionEnvironment} from 'remotion';
import {EffectComposer, RenderPass, EffectPass, BloomEffect, DepthOfFieldEffect, KernelSize, GodRaysEffect, SSAOEffect, NormalPass, BlendFunction} from 'postprocessing';
import {CameraMotionBlurEffect, GradeEffect} from './MotionBlur';

export type PostHandles = {mb: CameraMotionBlurEffect; dof: DepthOfFieldEffect | null; grade: GradeEffect; bloom: BloomEffect; rays: GodRaysEffect | null; ao: SSAOEffect | null};
export type PostProps = {bloom: number; dof: boolean; bokeh: number; frame: number; onBeforeRender: (h: PostHandles) => void;
  /** god rays: the sun mesh (light source) + strength 0..1 (0 = off) */ sun?: THREE.Mesh | null; rays?: number;
  /** screen-space ambient occlusion strength (0 = off): contact darkening in creases — kills the flat look */ ao?: number;
  /** MSAA samples on the composer (0 in measure mode) */ msaa?: number};

/**
 * Hand-driven postprocessing chain: render scene → motion blur → DOF → bloom → grade.
 * We own the composer and call render() explicitly for each Remotion frame (after the camera rig has been
 * applied), so headless rendering is deterministic and never captures an un-post-processed / empty canvas.
 */
export const Post: React.FC<PostProps> = ({bloom, dof, bokeh, frame, onBeforeRender, sun = null, rays = 0, ao = 0, msaa = 4}) => {
  const {gl, scene, camera, size} = useThree();
  const handles = useMemo<PostHandles>(() => ({
    mb: new CameraMotionBlurEffect(),
    dof: dof ? new DepthOfFieldEffect(camera, {worldFocusDistance: 10, worldFocusRange: 4, bokehScale: bokeh}) : null,
    bloom: new BloomEffect({intensity: bloom, luminanceThreshold: 0.82, luminanceSmoothing: 0.2, mipmapBlur: true, kernelSize: KernelSize.MEDIUM}),
    grade: new GradeEffect(),
    rays: sun && rays > 0 ? new GodRaysEffect(camera, sun, {samples: 80, density: 0.97, decay: 0.94, weight: 0.5 * rays, exposure: 0.55, clampMax: 1, blur: true, kernelSize: KernelSize.SMALL, resolutionScale: 0.5}) : null,
    ao: null,
  }), [camera, dof, sun, rays > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  handles.bloom.intensity = bloom;
  const normalPass = useMemo(() => (ao > 0 ? new NormalPass(scene, camera) : null), [scene, camera, ao > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (normalPass && !handles.ao) {
    handles.ao = new SSAOEffect(camera, normalPass.texture, {blendFunction: BlendFunction.MULTIPLY, samples: 16, rings: 7, worldDistanceThreshold: 60, worldDistanceFalloff: 10,
      worldProximityThreshold: 0.6, worldProximityFalloff: 0.3, luminanceInfluence: 0.55, radius: 0.03, intensity: 1.6 * ao, bias: 0.02, fade: 0.02, color: new THREE.Color('#3A2450'), resolutionScale: 0.75});
  }
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, {frameBufferType: THREE.HalfFloatType, multisampling: msaa});
    c.addPass(new RenderPass(scene, camera));
    // AO first (contact shadows in the creases), then motion blur (needs depth), DOF, god rays, bloom + grade
    if (normalPass && handles.ao) { c.addPass(normalPass); c.addPass(new EffectPass(camera, handles.ao)); }
    c.addPass(new EffectPass(camera, handles.mb));
    if (handles.dof) c.addPass(new EffectPass(camera, handles.dof));
    if (handles.rays) c.addPass(new EffectPass(camera, handles.rays));
    c.addPass(new EffectPass(camera, handles.bloom, handles.grade));
    return c;
  }, [gl, scene, camera, handles, normalPass, msaa]);
  useEffect(() => () => composer.dispose(), [composer]);
  useLayoutEffect(() => { composer.setSize(size.width, size.height); }, [composer, size.width, size.height]);

  const render = () => { onBeforeRender(handles); composer.render(1 / 30); };
  // studio preview: take over R3F's render loop (priority > 0 disables R3F's own gl.render)
  useFrame(() => render(), 1);
  // headless: render explicitly for this frame after every child has mounted, hold the screenshot until done
  const hold = useRef<number | null>(null);
  const rendering = getRemotionEnvironment().isRendering;
  useLayoutEffect(() => {
    if (!rendering) return;
    hold.current = delayRender(`post ${frame}`);
    return () => { if (hold.current !== null) { continueRender(hold.current); hold.current = null; } };
  }, [frame, rendering]);
  useEffect(() => {
    if (!rendering) return;
    render();
    const id = requestAnimationFrame(() => { if (hold.current !== null) { continueRender(hold.current); hold.current = null; } });
    return () => cancelAnimationFrame(id);
  }); // every commit
  return null;
};
