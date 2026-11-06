export type SfxCue = {f: number; kind: string; gain?: number; note?: string};
export const SFX_EXTRA: SfxCue[] = [
  {f: 57, kind: 'coin', note: 'coin glints on "gold."'},
];
export const AMBIENCE: {from: number; to: number; kind: string; gain?: number}[] = [{from: 0, to: 108, kind: 'sea'}];
