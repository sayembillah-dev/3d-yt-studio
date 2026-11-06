import {ThreeCanvas} from '@remotion/three';
import {useCurrentFrame, useVideoConfig, AbsoluteFill} from 'remotion';
export const Smoke: React.FC = () => {
  const f = useCurrentFrame(); const {width, height} = useVideoConfig();
  return (<AbsoluteFill style={{background:'#87ceeb'}}>
    <ThreeCanvas width={width} height={height} camera={{position:[0,1,5], fov:50}}>
      <ambientLight intensity={0.6}/><directionalLight position={[3,5,2]} intensity={2}/>
      <mesh rotation={[0, f*0.05, 0]}><boxGeometry args={[1.5,1.5,1.5]}/><meshToonMaterial color="#e8742c"/></mesh>
    </ThreeCanvas></AbsoluteFill>);
};
