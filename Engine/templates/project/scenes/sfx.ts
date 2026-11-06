// Hand-placed SFX cues for things the cast keys and camera do not imply (sfx_cues.mjs adds these to the automatic
// whooshes / pops / impacts). One cue per sync event: door slam, splash, coin clink, cannon boom, paper rustle.
// f = the frame of the word or the visible event (±1 f). kind = a sfx_synth.py sound name:
//   whoosh whip pop boing impact thud boom rattle sting ding bell sparkle gulp steam coin cash step splash click clack
//   crash whistle sizzle clank rustle creak
// gain in dB: cue peak = −6 dBFS + gain (0 = −6; booms +3 → −3). AMBIENCE kinds: sea wind crowd fire crickets rain room city;
// AMBIENCE gain raises/lowers that bed (use it when mix.py MX1 says the voice is too hot).
export type SfxCue = {f: number; kind: string; gain?: number; note?: string};

export const SFX_EXTRA: SfxCue[] = [
  // {f: 72, kind: 'coin', note: 'captain flips the coin on "gold"'},
];

/** Location ambience per frame range (sea/gulls, crowd, wind, fire, crickets, rain). */
export const AMBIENCE: {from: number; to: number; kind: string; gain?: number}[] = [
  {from: 0, to: 108, kind: 'sea'},
];
