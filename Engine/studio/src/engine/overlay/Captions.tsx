import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Sequence, getInputProps} from 'remotion';
import {Word} from '../timing';
import {CAPTION_FONT} from '../fonts';

export type Chunk = {text: string; s: number; e: number; words: Word[]};

/** Group words into 1–2 word caption chunks (measured); break on punctuation and on gaps. (style-bible §6) */
export function chunkWords(words: Word[], maxWords = 2, maxChars = 14): Chunk[] {
  const out: Chunk[] = []; let cur: Word[] = [];
  const flush = () => { if (cur.length) { out.push({text: cur.map((w) => w.w).join(' '), s: cur[0].s, e: cur[cur.length - 1].e, words: cur}); cur = []; } };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]; const next = words[i + 1];
    cur.push(w);
    const chars = cur.map((x) => x.w).join(' ').length;
    const punct = /[.,!?;:—]$/.test(w.w);
    const gap = next ? next.s - w.e > 0.18 : true;
    const nextTooLong = next ? chars + 1 + next.w.length > maxChars : true;
    if (cur.length >= maxWords || punct || gap || nextTooLong) flush();
  }
  flush();
  // each chunk holds until the next starts (no blank flashes between chunks)
  for (let i = 0; i < out.length - 1; i++) out[i].e = Math.max(out[i].e, out[i + 1].s);
  return out;
}

export type CaptionProps = {words: Word[]; y?: number; size?: number; maxWords?: number; color?: string; highlight?: Record<string, string>; hide?: [number, number][]};

/** One line of 1–2 words, white Archivo Black, thin dark stroke (5–6 px visible) + soft shadow; swaps per chunk.
 *  size 64 → cap height ≈ 42 px on compare.py's estimator (refs 41–44). y = vertical centre as a fraction of height. */
export const Captions: React.FC<CaptionProps> = ({words, y = 0.7, size = 64, maxWords = 2, color = '#FFFFFF', highlight = {}, hide = []}) => {
  const {fps, height} = useVideoConfig();
  if ((getInputProps() as {noCaptions?: boolean}).noCaptions) return null;   // clean stills for thumbnail.py (render.sh SW_PROPS)
  const chunks = chunkWords(words, maxWords);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {chunks.map((c, i) => {
        const from = Math.round(c.s * fps), to = Math.max(from + 2, Math.round(c.e * fps));
        if (hide.some(([a, b]) => from >= a && from < b)) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="none">
            <CaptionChunk c={c} y={y * height} size={size} color={color} highlight={highlight} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const CaptionChunk: React.FC<{c: Chunk; y: number; size: number; color: string; highlight: Record<string, string>}> = ({c, y, size, color, highlight}) => {
  const f = useCurrentFrame();
  const pop = interpolate(f, [0, 2], [0.92, 1], {extrapolateRight: 'clamp'});   // subtle 2-frame settle (style-bible §6)
  const stroke = Math.round(size * 0.17);   // paint-order stroke: ~half is visible outside the glyph → 5–6 px
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, transform: `translateY(-50%) scale(${pop})`, display: 'flex', justifyContent: 'center', padding: '0 70px'}}>
      <span style={{
        fontFamily: CAPTION_FONT, fontWeight: 400, fontSize: size, lineHeight: 1.05, color, textAlign: 'center', letterSpacing: 0, whiteSpace: 'nowrap',
        WebkitTextStroke: `${stroke}px #1A1216`, paintOrder: 'stroke fill', textShadow: `0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.1)}px rgba(0,0,0,0.45)`,
      }}>
        {c.words.map((w, i) => {
          const key = w.w.toLowerCase().replace(/[^a-z0-9']/g, '');
          return <span key={i} style={{color: highlight[key] ?? color}}>{(i ? ' ' : '') + w.w}</span>;
        })}
      </span>
    </div>
  );
};
