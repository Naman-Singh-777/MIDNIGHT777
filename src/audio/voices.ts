import type { L } from '../data/nightTypes';
import { PERSON_BY_ID } from '../data/persons';
import { lineEmo, lineKey, lineText } from '../data/voiceStyle';

type V3 = { x: number; y: number; z: number };

export interface SpeakOpts {
  /** phone or intercom: thin, crackly. */
  radio?: boolean;
  /** 0 to 1: how much of the wrongness rides under the voice. Fakes, and staff whose voice is not theirs. */
  mimic?: number;
  /** Placed in the room (in person, behind the glass, in the passage). Omit for a voice in your ear. */
  pos?: V3;
  /** Behind glass: duller and quieter. */
  glass?: boolean;
}

/**
 * Recorded voices. Every line was recorded ahead of time with a neural voice per character (tools/voice/render.py)
 * and lives in public/voice as <key>.mp3. This plays them through Web Audio, so a phone call can sound like a phone,
 * a fake can sound slightly wrong, and someone in the passage sounds like they are behind you.
 * If a recording is missing, it returns null and the caller falls back to the system voice.
 */
export class VoiceBank {
  private manifest: Record<string, number> | null = null;
  private cache = new Map<string, Promise<AudioBuffer | null>>();
  private current: { src: AudioBufferSourceNode; stop: () => void; person: string } | null = null;
  private base: string;

  constructor(private ctxOf: () => AudioContext | null, private out: () => AudioNode | null, private sendRev: () => AudioNode | null) {
    this.base = `${import.meta.env.BASE_URL ?? './'}voice/`;
    void fetch(`${this.base}manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (this.manifest = m))
      .catch(() => (this.manifest = null));
  }

  get ready(): boolean {
    return !!this.manifest && !!this.ctxOf();
  }

  has(person: string, line: L): boolean {
    return !!this.manifest && lineKey(person, line) in this.manifest;
  }

  /** Seconds the line lasts, from the manifest, or an estimate. */
  duration(person: string, line: L): number {
    const k = lineKey(person, line);
    const d = this.manifest?.[k];
    const rate = PERSON_BY_ID[person]?.pitch ?? 1;
    return d ? d / rate : lineText(line).split(/\s+/).length * 0.38 + 0.4;
  }

  /** Fetch ahead so the line is ready when it is needed. */
  preload(person: string, line: L): void {
    if (!this.has(person, line)) return;
    void this.load(lineKey(person, line));
  }

  private load(key: string): Promise<AudioBuffer | null> {
    let p = this.cache.get(key);
    if (!p) {
      p = fetch(`${this.base}${key}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => (b && this.ctxOf() ? this.ctxOf()!.decodeAudioData(b) : null))
        .catch(() => null);
      this.cache.set(key, p);
    }
    return p;
  }

  stop(): void {
    this.current?.stop();
    this.current = null;
  }

  /**
   * Plays a recorded line. Returns its length in seconds, or null if there is no recording (use the fallback).
   * The sound starts as soon as the file is decoded, usually within a frame or two of being asked for.
   */
  play(person: string, line: L, o: SpeakOpts = {}): number | null {
    const ctx = this.ctxOf();
    const out = this.out();
    if (!ctx || !out || !this.has(person, line)) return null;
    const key = lineKey(person, line);
    const rate = (PERSON_BY_ID[person]?.pitch ?? 1) * ((o.mimic ?? 0) > 0.5 ? 0.97 : 1);
    const dur = (this.manifest![key] ?? 2) / rate;
    const emo = lineEmo(line);
    if (this.current?.person === person) this.stop();
    let cancelled = false;
    const nodes: AudioNode[] = [];
    const handle = {
      person,
      src: null as unknown as AudioBufferSourceNode,
      stop: () => {
        cancelled = true;
        try {
          handle.src?.stop();
        } catch {
          /* already stopped */
        }
        for (const n of nodes) n.disconnect();
      },
    };
    this.current = handle;
    void this.load(key).then((buf) => {
      if (!buf || cancelled) return;
      const t = ctx.currentTime + 0.02;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      handle.src = src;
      let node: AudioNode = src;
      const chain = (n: AudioNode): void => {
        node.connect(n);
        nodes.push(n);
        node = n;
      };
      const gain = ctx.createGain();
      gain.gain.value = emo === 'whisper' ? 0.75 : 1;
      chain(gain);
      if (o.radio) {
        // the phone: a narrow band, a little drive, and line hiss under it
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 380;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * 2 - 1;
          curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2);
        }
        shaper.curve = curve;
        chain(hp);
        chain(lp);
        chain(shaper);
      }
      if (emo === 'whisper') {
        // breathier: take the body out of it
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 520;
        chain(hp);
      }
      if (o.glass) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 5200;
        chain(lp);
      }
      const mimic = o.mimic ?? 0;
      if (mimic > 0) {
        // a second copy of the voice a few milliseconds behind, a fraction lower: the voice is doubled, not quite in step
        const d = ctx.createDelay(0.2);
        d.delayTime.value = 0.018 + mimic * 0.03;
        const dg = ctx.createGain();
        dg.gain.value = 0.25 + mimic * 0.35;
        const twin = ctx.createBufferSource();
        twin.buffer = buf;
        twin.playbackRate.value = rate * (1 - 0.035 * mimic);
        twin.connect(d).connect(dg);
        nodes.push(d, dg);
        twin.start(t);
        twin.stop(t + dur + 0.3);
        dg.connect(this.routeOut(ctx, out, o));
      }
      node.connect(this.routeOut(ctx, out, o));
      src.start(t);
    });
    return dur;
  }

  private routeOut(ctx: AudioContext, out: AudioNode, o: SpeakOpts): AudioNode {
    if (!o.pos) return out;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.2;
    p.rolloffFactor = 1.1;
    p.positionX.value = o.pos.x;
    p.positionY.value = o.pos.y;
    p.positionZ.value = o.pos.z;
    p.connect(out);
    const rev = this.sendRev();
    if (rev) {
      const g = ctx.createGain();
      g.gain.value = 0.18;
      p.connect(g).connect(rev);
    }
    return p;
  }
}
