import React from 'react';
import {Composition} from 'remotion';
import {Smoke} from './Smoke';
import {Debug} from './Debug';
// The active project's scenes (selected by SW_PROJECT, aliased in remotion.config.ts)
import {compositions} from '@project';

type Comp = {id: string; component: React.FC<any>; durationInFrames: number; fps: number; width: number; height: number; defaultProps?: Record<string, unknown>};

export const Root: React.FC = () => (
  <>
    <Composition id="Debug" component={Debug} durationInFrames={30} fps={30} width={540} height={960} defaultProps={{post: true, sky: true}} />
    <Composition id="Smoke" component={Smoke} durationInFrames={30} fps={30} width={1080} height={1920} />
    {(compositions as Comp[]).map((c) => (
      <Composition key={c.id} id={c.id} component={c.component} durationInFrames={c.durationInFrames} fps={c.fps} width={c.width} height={c.height} defaultProps={c.defaultProps ?? {}} />
    ))}
  </>
);
