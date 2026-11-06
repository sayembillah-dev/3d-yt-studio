import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, interpolate} from 'remotion';

/**
 * A shot on the edit timeline. Shots overlap by `dissolveIn` frames with the previous one: the
 * incoming shot fades in over the outgoing one (median dissolve ≈ 10f, style-bible §5).
 * Inside a shot, useCurrentFrame() is LOCAL (0 at `from`), but the outgoing shot keeps rendering
 * (and its camera keeps moving) during the overlap, so motion never stops across a dissolve.
 */
export const Shot: React.FC<{from: number; dur: number; dissolveIn?: number; children: React.ReactNode; name?: string}> = ({from, dur, dissolveIn = 0, children, name}) => (
  <Sequence from={from} durationInFrames={dur} name={name}>
    <Fade inF={dissolveIn}>{children}</Fade>
  </Sequence>
);

const Fade: React.FC<{inF: number; children: React.ReactNode}> = ({inF, children}) => {
  const f = useCurrentFrame();
  const o = inF > 0 ? interpolate(f, [0, inF], [0, 1], {extrapolateRight: 'clamp', easing: (t) => t * t * (3 - 2 * t)}) : 1;
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

/** Plan helper: given beats [{start, end}] in frames, return shots with overlaps for dissolves. */
export function planShots(beats: {start: number; end: number; transition?: 'flight' | 'dissolve' | 'cut'}[], dissolve = 10) {
  return beats.map((b, i) => {
    const t = b.transition ?? 'flight';
    const din = i > 0 && t === 'dissolve' ? dissolve : 0;
    return {from: b.start - Math.floor(din / 2), dur: b.end - b.start + Math.floor(din / 2) + (beats[i + 1]?.transition === 'dissolve' ? Math.ceil(dissolve / 2) : 0), dissolveIn: din};
  });
}
