import type { Emo, L } from './nightTypes';

/** How fast each kind of line is recorded. Fear speeds people up, grief slows them down. */
export const EMO_SPEED: Record<Emo, number> = {
  calm: 1.0, warm: 0.95, kind: 0.92, bright: 1.06, dry: 1.0, sly: 0.9, stern: 0.98, cold: 0.92, flat: 0.88,
  nervous: 1.08, scared: 1.1, panic: 1.2, urgent: 1.14, tired: 0.88, grief: 0.86, broken: 0.84, whisper: 0.92, angry: 1.1,
};

export function lineText(l: L): string {
  return typeof l === 'string' ? l : l[0];
}
export function lineEmo(l: L): Emo {
  return typeof l === 'string' ? 'calm' : l[1];
}

/** Stable name for a recorded line. The recorder (tools/voice) and the game both use it. */
export function lineKey(person: string, l: L): string {
  const s = `${person}|${lineEmo(l)}|${lineText(l)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}
