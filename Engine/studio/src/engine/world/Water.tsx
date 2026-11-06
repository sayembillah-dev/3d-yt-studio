import * as THREE from 'three';
import {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {canvasTexture} from '../textures/canvas';
import {rng} from '../random';

/** Tileable texture of hand-drawn white crescent "wave ticks" (signature of the reference water). */
function waveTicks(seed = 9) {
  return canvasTexture(`waveticks:${seed}`, 1024, 1024, (g, W, H) => {
    const r = rng(seed); g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r.range(0, W), y = r.range(0, H), len = r.range(18, 46), lw = r.range(3, 6);
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = lw;
        g.beginPath(); g.ellipse(x + ox, y + oy, len, len * 0.42, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      }
    }
  }, [1, 1]);
}

export const Water: React.FC<{size?: number; y?: number; near?: string; far?: string; tickScale?: number; speed?: number; reflect?: string}> = ({size = 2000, y = 0, near = '#0E5C9A', far = '#3FC6D6', tickScale = 26, speed = 1, reflect}) => {
  const f = useCurrentFrame();
  const tex = useMemo(() => { const t = waveTicks(); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    fog: true,
    uniforms: {...THREE.UniformsLib.fog, uTicks: {value: tex}, uT: {value: 0}, uNear: {value: new THREE.Color(near)}, uFar: {value: new THREE.Color(far)}, uScale: {value: tickScale}, uReflect: {value: new THREE.Color(reflect ?? far)}, uRefl: {value: reflect ? 1 : 0}},
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vW; varying float vDist;
      void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; vDist = -mvPosition.z; gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform sampler2D uTicks; uniform float uT; uniform vec3 uNear; uniform vec3 uFar; uniform float uScale; uniform vec3 uReflect; uniform float uRefl;
      varying vec3 vW; varying float vDist;
      void main(){
        float k = smoothstep(4., 160., vDist);
        vec3 col = mix(uNear, uFar, k);
        // painted light band toward horizon
        col = mix(col, uReflect, uRefl * smoothstep(60., 300., vDist) * 0.5);
        vec2 uv1 = vW.xz / uScale + vec2(uT*0.010, uT*0.004);
        vec2 uv2 = vW.xz / (uScale*1.7) + vec2(-uT*0.006, uT*0.007) + 0.37;
        // deep-to-shallow band variation (painted current streaks)
        float band = sin(vW.x * 0.08 + vW.z * 0.05 + uT * 0.01) * 0.5 + 0.5;
        col = mix(col, col * 0.86, band * 0.35 * (1. - k));
        float t1 = texture2D(uTicks, uv1).a; float t2 = texture2D(uTicks, uv2).a;
        float ticks = max(t1, t2*0.8) * (1. - smoothstep(60., 220., vDist));
        col = mix(col, vec3(1.), ticks*0.85);
        // sun glitter: sparse twinkling glints, denser toward the horizon (look-dev: water is never a flat colour)
        vec2 gp = floor(vW.xz * 3.0); float gr = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453);
        float tw = 0.5 + 0.5 * sin(uT * 0.35 + gr * 40.0);
        float glit = step(0.985 - 0.02 * k, gr) * tw * smoothstep(3., 40., vDist);
        col += vec3(1.0, 0.95, 0.8) * glit * 0.9;
        gl_FragColor = vec4(col, 1.);
        #include <fog_fragment>
      }`,
  }), [tex, near, far, tickScale, reflect]);
  mat.uniforms.uT.value = f * speed;
  return <mesh rotation-x={-Math.PI / 2} position-y={y} material={mat}><planeGeometry args={[size, size, 1, 1]} /></mesh>;
};

/** Animated foam ring around a floating object. */
export const FoamRing: React.FC<{pos: [number, number, number]; radius?: number}> = ({pos, radius = 1}) => {
  const f = useCurrentFrame();
  const rings = [0, 1, 2].map((i) => ((f / 40 + i / 3) % 1));
  return (<group position={pos}>{rings.map((t, i) => (
    <mesh key={i} rotation-x={-Math.PI / 2} position-y={0.02}>
      <ringGeometry args={[radius * (1 + t * 0.8), radius * (1 + t * 0.8) + 0.06, 48]} />
      <meshBasicMaterial color="#FFFFFF" transparent opacity={(1 - t) * 0.85} depthWrite={false} />
    </mesh>))}</group>);
};
