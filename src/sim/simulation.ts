import { Bus } from '../core/events';
import { Rng } from '../core/rng';
import { COMMON, PELL_STANDIN } from '../data/common';
import { MOTHER_ID, WARD_B_START } from '../data/motive';
import { nightDef } from '../data/nights';
import type { BeatDef, L, NightDef, VisitorDef } from '../data/nightTypes';
import { PACING } from '../data/pacing';
import { PERSON_BY_ID, recordOf } from '../data/persons';
import { QUESTION_TEXT } from '../data/questions';
import { VEND_BY_ID, type VendId } from '../data/vending';
import { lineText } from '../data/voiceStyle';
import { Director } from './director';
import { FearDirector } from './fear';
import { makePatient, makeRegistry } from './patients';
import { distortionFor } from './perception';
import { Stalker, type StalkerInput } from './stalker';
import type { Consequence, DeathCause, Patient, QuestionId, RegistryEntry, ShiftScore, SimEvents, TaskId, TodoItem, Verdict, WardCount } from './types';

/** Kept for older callers: about the old fixed pace. The night now waits for its roster. */
export const MINUTES_PER_SECOND = 1 / 4.5;

export type PatientPhase = 'none' | 'approaching' | 'present' | 'leaving';
export type Zone = 'booth' | 'corridor' | 'breaker';

export interface Buffs {
  coffee: boolean; // next visitor waits twice as long
  barley: number; // seconds your steps are silent
  tonic: boolean; // next verdict makes itself
  tea: boolean; // one death turns into a blackout
  mint: boolean; // a hint about the next visitor
  toffee: number; // seconds of free running
}

export interface SimState {
  night: number;
  minute: number;
  ended: boolean;
  powerOn: boolean;
  breakerTripped: boolean;
  breakersDone: number;
  zone: Zone;
  flashlight: boolean;
  registry: RegistryEntry[];
  current: Patient | null;
  phase: PatientPhase;
  phaseTime: number;
  patience: number;
  asked: QuestionId[];
  lastLine: string; // last thing the officer said, for echoes
  lookedUp: boolean;
  faceChecked: boolean;
  history: Patient[];
  queue: Patient[]; // patients coming back
  slotIndex: number;
  gap: number; // real seconds left before the next visitor knocks
  finaleDone: boolean;
  consequences: Consequence[];
  stage: number; // how much the fakes have learned, 0..7
  sanity: number;
  fear: number;
  stare: boolean; // the patient is holding your eye
  score: ShiftScore;
  seq: number;
  todo: TodoItem[];
  admittedHumans: number;
  motherTaken: boolean;
  selfTaken: boolean;
  dead: DeathCause | null;
  breach: { phase: 'crack' | 'inside'; t: number } | null;
  dawn: { t: number; figure: boolean } | null;
  hollisIn: boolean; // the porter you let in walks the corridor with you at six
  wardLocked: boolean; // you reported the count; Pell locked himself in with them
  pellGone: boolean;
  tokens: number;
  buffs: Buffs;
  quietT: number; // seconds since anything happened
}

export interface AskResult {
  text: string;
  line: L;
  delay: number; // seconds before the patient speaks
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const ORDER: QuestionId[] = ['name', 'dob', 'sender', 'kin', 'memory'];

export interface SimOptions {
  night?: number;
  tokens?: number;
  /** Tests: start the roster after the tutorial visitor. */
  skipTutorial?: boolean;
}

export class Simulation {
  readonly bus = new Bus<SimEvents>();
  readonly rng: Rng;
  /** Separate stream for presentation-only randomness so truth stays deterministic. */
  readonly presRng: Rng;
  readonly director: Director;
  readonly def: NightDef;
  state: SimState;
  private hallT = 5;
  private storyDone = new Set<string>();
  private readonly gazeRng: Rng;
  private stareT = 10;
  private stareLeft = 0;
  private stareHit = false;
  private ducked = false;
  private gazing = false;
  private roster: VisitorDef[];

  constructor(readonly seed: number, opts: SimOptions = {}) {
    this.def = nightDef(opts.night ?? 1);
    this.rng = new Rng(seed);
    this.presRng = new Rng(seed ^ 0x9e3779b9);
    this.director = new Director(new Rng(seed ^ 0x51ed270b));
    this.gazeRng = new Rng(seed ^ 0x2545f491);
    this.fearDir = new FearDirector(new Rng(seed ^ 0x6f1d33));
    this.roster = [...this.def.visitors].sort((a, b) => a.at - b.at);
    if (opts.skipTutorial) this.roster = this.roster.filter((v) => !v.tutorial);
    const night = this.def.n;
    this.state = {
      night,
      minute: 0,
      ended: false,
      powerOn: true,
      breakerTripped: false,
      breakersDone: 0,
      zone: 'booth',
      flashlight: false,
      registry: makeRegistry(this.rng, 14),
      current: null,
      phase: 'none',
      phaseTime: 0,
      patience: 1,
      asked: [],
      lastLine: '',
      lookedUp: false,
      faceChecked: false,
      history: [],
      queue: [],
      slotIndex: 0,
      gap: 4,
      finaleDone: false,
      consequences: [],
      stage: this.def.stageStart,
      sanity: 100,
      fear: 0,
      stare: false,
      score: { correct: 0, wrong: 0, admittedUnderstudies: 0, refusedHumans: 0, sanity: 100, ending: 'absent', tasksDone: 0, tasksMissed: 0, night, tokens: opts.tokens ?? 0 },
      seq: 0,
      todo: this.def.todo.map((t) => ({ ...t, shown: false, done: false, missed: false })),
      admittedHumans: 0,
      motherTaken: false,
      selfTaken: false,
      dead: null,
      breach: null,
      dawn: null,
      hollisIn: false,
      wardLocked: false,
      pellGone: night >= 5,
      tokens: opts.tokens ?? 0,
      buffs: { coffee: false, barley: 0, tonic: false, tea: false, mint: false, toffee: 0 },
      quietT: 0,
    };
    // the hospital's records for everyone who can come to the window
    const seen = new Set<string>();
    for (const n of [1, 2, 3, 4, 5, 6])
      for (const v of nightDef(n).visitors) {
        if (seen.has(v.person)) continue;
        seen.add(v.person);
        const r = recordOf(v.person);
        if (v.person === 'ada') r.id = MOTHER_ID;
        this.state.registry.push(r);
      }
    // the voice at the gate pulls up Imogen's staff card
    this.state.registry.push({ ...recordOf('imogen'), id: 'R900' });
  }

  readonly stalker = new Stalker();
  readonly fearDir: FearDirector;
  private pendingSummon: { t: number; x: number } | null = null;
  private stalkerIn: StalkerInput = { x: 0, z: 0.5, noise: 0, noiseRange: 0, torchOnIt: false, inBooth: true, doorClosed: false };

  /** Where the player is and how loud they are. Presentation calls this every frame. */
  setPlayer(i: StalkerInput): void {
    // barley sugar: for a minute your steps make no sound
    this.stalkerIn = this.state.buffs.barley > 0 ? { ...i, noise: 0, noiseRange: 0 } : i;
  }

  /** Brings the tall one into the corridor. */
  summonStalker(x: number, life = Infinity): void {
    for (const e of this.stalker.summon(x, life)) this.bus.emit('stalker', { event: e });
  }

  die(cause: DeathCause): void {
    const s = this.state;
    if (s.ended) return;
    if (s.buffs.tea) {
      // sweet tea: you black out instead, and wake at the desk
      s.buffs.tea = false;
      s.breach = null;
      s.sanity = 40;
      s.fear = 0.3;
      this.stalker.dismiss();
      this.bus.emit('saved', { cause });
      return;
    }
    s.dead = cause;
    s.ended = true;
    this.bus.emit('death', { cause });
  }

  private runStalker(dt: number): void {
    const s = this.state;
    if (!s.dawn) this.stalker.rage = s.score.admittedUnderstudies;
    for (const e of this.stalker.tick(dt, this.stalkerIn)) {
      this.bus.emit('stalker', { event: e });
      if (e === 'kill') this.die('stalker');
      if (e === 'shriek') this.spike(0.6, 3);
      if (e === 'growl') this.spike(0.3, 0);
    }
    if (this.stalker.active) {
      const d = Math.hypot(this.stalkerIn.x - this.stalker.x, this.stalkerIn.z - this.stalker.z);
      if (d < 6) s.fear = Math.min(1, s.fear + dt * (6 - d) * 0.05);
    }
  }

  private runFear(dt: number): void {
    const s = this.state;
    const i = this.stalkerIn;
    if (this.pendingSummon) {
      this.pendingSummon.t -= dt;
      if (this.pendingSummon.t <= 0) {
        this.summonStalker(this.pendingSummon.x, 45);
        this.pendingSummon = null;
      }
    }
    const e = this.fearDir.tick(dt, {
      minute: s.minute,
      zone: s.zone,
      moving: i.noise > 0,
      stalkerActive: this.stalker.active,
      stage: s.stage,
      patientPresent: s.phase === 'present',
      powerOn: s.powerOn,
    });
    if (!e) return;
    const real = e === 'echo_steps' && this.fearDir.realEcho;
    this.bus.emit('fear', { event: e, real });
    this.touch();
    if (real) {
      // when the steps stop, it is standing where they were
      const x = i.x - 6 > 2.6 ? i.x - 6 : i.x + 6;
      this.pendingSummon = { t: 7, x };
    }
    if (e === 'dead_line_call') this.spike(0.4, 3);
  }

  /** Six o'clock. The corridor dies a light at a time, then it walks out of the far end and paces past the ward door. */
  private runDawn(dt: number): void {
    const s = this.state;
    const d = s.dawn;
    if (!d) return;
    d.t += dt;
    if (!d.figure && d.t > 9) {
      d.figure = true;
      this.summonStalker(13.8);
      this.stalker.patrol(6.0, 11.2);
      this.stalker.rage = Math.max(0, s.score.admittedUnderstudies - (s.hollisIn ? 1 : 0));
      this.bus.emit('dawn', { phase: 'figure' });
    }
  }

  /** After the 2 a.m. count: report it and Pell locks Ward B from the inside. Fewer things get out. Pell does not come back. */
  reportCount(report: boolean): void {
    const s = this.state;
    if (!report) return;
    s.wardLocked = true;
    if (!s.pellGone) this.common('pell_lock', 'pell', true);
    s.pellGone = true;
  }

  /** A fake left waiting too long at the glass does not leave. It comes through. Duck under the desk and stay down. */
  private runBreach(dt: number): void {
    const s = this.state;
    const b = s.breach;
    if (!b) return;
    b.t += dt;
    if (b.phase === 'crack' && b.t > 8) {
      b.phase = 'inside';
      b.t = 0;
      this.bus.emit('breach', { phase: 'inside' });
      this.spike(0.9, 10);
    } else if (b.phase === 'inside') {
      if (!this.ducked && s.zone === 'booth' && b.t > 0.9) {
        this.die('breach');
        return;
      }
      if (b.t > 6) {
        s.breach = null;
        this.bus.emit('breach', { phase: 'over' });
        this.leave('timeout');
        this.summonStalker(3, 70);
      }
    }
  }

  get distortion() {
    return distortionFor(this.state.sanity, this.state.fear);
  }

  registryOf(p: Patient): RegistryEntry {
    return this.state.registry.find((r) => r.id === p.registryId)!;
  }

  /** Something happened the player can see or hear. Resets the dead air clock. */
  private touch(): void {
    this.state.quietT = 0;
  }

  // ---------------------------------------------------------------- time
  /**
   * There is no timer. The clock on the wall follows the roster: it creeps while someone is at the glass,
   * runs on between visitors, and only reaches six once everybody on tonight's list has been dealt with.
   */
  private advanceClock(dt: number): void {
    const s = this.state;
    const was = s.minute;
    const next = this.roster[s.slotIndex];
    const waiting = s.phase !== 'none' || s.queue.length > 0;
    if (s.dawn) s.minute += dt * PACING.dawnRate;
    else if (next) {
      if (waiting || !s.powerOn) s.minute = Math.min(next.at - 0.5, s.minute + dt * PACING.visitRate);
      else {
        // between visitors: get to the next one's time within the gap
        s.gap -= dt;
        const left = Math.max(0.2, s.gap);
        s.minute = Math.min(next.at, s.minute + Math.max(dt * PACING.visitRate, ((next.at - s.minute) * dt) / left));
      }
    } else if (s.phase === 'none' && s.queue.length === 0) s.minute = Math.min(this.def.end, s.minute + dt * PACING.tailRate);
    else s.minute = Math.min(this.def.end - 15, s.minute + dt * PACING.visitRate);
    s.minute = Math.max(was, s.minute); // the clock never runs backwards
  }

  tick(dt: number): void {
    const s = this.state;
    if (s.ended) return;
    const prevMinute = s.minute;
    this.advanceClock(dt);
    if (Math.floor(s.minute) !== Math.floor(prevMinute)) this.bus.emit('clock', { minute: s.minute });
    s.buffs.barley = Math.max(0, s.buffs.barley - dt);
    s.buffs.toffee = Math.max(0, s.buffs.toffee - dt);
    s.quietT += dt;

    s.fear = Math.max(0, s.fear - dt * 0.15);
    this.updateSanity(dt);
    this.runStory();
    this.runTodo();
    this.runStare(dt);
    this.runStalker(dt);
    this.runBreach(dt);
    this.runFear(dt);
    this.runDawn(dt);
    if (s.sanity <= 0) this.die('nerves');
    if (s.ended) return;
    this.runBreaker();
    this.runPatients(dt);
    this.runConsequences();
    this.runDirector(dt);
    this.runHallucinations(dt);

    if (s.minute >= this.def.end && !s.ended) this.finish();
  }

  /** Ends the night. The ending depends on what got through the gate and whether you went to see her. */
  finish(): void {
    const s = this.state;
    if (s.ended) return;
    s.ended = true;
    const dawn = s.todo.find((t) => t.id === 'count_dawn')!;
    s.score.sanity = Math.round(s.sanity);
    s.score.tokens = s.tokens;
    s.score.ending = !dawn.done ? 'absent' : s.motherTaken || s.selfTaken ? 'taken' : s.score.admittedUnderstudies > 0 ? 'crowded' : 'clean';
    this.bus.emit('shiftEnded', { score: s.score });
  }

  // ---------------------------------------------------------------- the to-do list
  private runTodo(): void {
    const s = this.state;
    let changed = false;
    for (const t of s.todo) {
      if (!t.shown && s.minute >= t.at) {
        t.shown = true;
        changed = true;
        if (t.id === 'count_dawn') {
          s.dawn = { t: 0, figure: false };
          this.stalker.dismiss();
          this.bus.emit('dawn', { phase: 'start' });
          const d = s.pellGone ? this.def.dawn.wrong : this.def.dawn.pell;
          this.beat(d);
        }
      }
      if (t.shown && !t.done && !t.missed && s.minute >= t.due && t.id !== 'count_dawn') {
        t.missed = true;
        changed = true;
        s.score.tasksMissed++;
        this.spike(0.15, 4);
        if (t.id === 'count1') this.common('miss_count', this.pellWho());
        else this.common('miss_task', 'matron');
      }
    }
    if (changed) this.bus.emit('todo', { items: s.todo });
  }

  /** Bodies on Ward B against the paperwork. Every fake you admitted is lying in a bed. */
  wardCount(): WardCount {
    const s = this.state;
    const register = WARD_B_START + s.admittedHumans;
    const extras = s.score.admittedUnderstudies;
    return { register, actual: register + extras, extras, motherTaken: s.motherTaken, stage: s.stage };
  }

  /** The presentation finished a task's mini game. Returns false if it is not on the list yet. */
  completeTask(id: TaskId): boolean {
    const s = this.state;
    const t = s.todo.find((x) => x.id === id);
    if (!t || !t.shown || t.done || s.ended) return false;
    t.done = true;
    if (!t.missed) {
      s.score.tasksDone++;
      if (id !== 'count_dawn') this.earn(1, 'job done');
    }
    s.sanity = clamp(s.sanity + 3, 0, 100);
    this.bus.emit('todo', { items: s.todo });
    this.touch();
    if (id === 'count1' || id === 'count_dawn') {
      const count = this.wardCount();
      this.bus.emit('wardCounted', { id, count });
      if (id === 'count1') {
        this.bus.emit('choice', { id: 'report_count' });
        if (count.extras > 0) {
          this.spike(0.6, 8);
          this.common('count_more', this.pellWho(), true);
        } else this.common('count_same', this.pellWho(), true);
      }
    }
    return true;
  }

  todoItem(id: TaskId): TodoItem | undefined {
    return this.state.todo.find((t) => t.id === id);
  }

  private updateSanity(dt: number): void {
    const s = this.state;
    let d = 0;
    if (s.zone === 'booth') {
      if (s.powerOn) d += s.current && s.phase === 'present' ? 0.05 : 0.01;
      else d -= 0.15;
    } else {
      d -= s.flashlight ? 0.06 : 0.14;
    }
    d -= s.fear * 0.12;
    s.sanity = clamp(s.sanity + d * dt, 0, 100);
  }

  private bumpStage(): void {
    const s = this.state;
    s.stage = Math.min(7, s.stage + 1);
    this.bus.emit('cue', { cue: 'stage_up', intensity: 0.4 + s.stage * 0.08 });
  }

  private spike(fear: number, sanityHit = 0): void {
    const s = this.state;
    s.fear = clamp(s.fear + fear, 0, 1);
    s.sanity = clamp(s.sanity - sanityHit, 0, 100);
  }

  // ---------------------------------------------------------------- tokens and the vending machine
  private earn(n: number, why: string): void {
    const s = this.state;
    s.tokens += n;
    s.score.tokens = s.tokens;
    this.bus.emit('tokens', { tokens: s.tokens, gained: n, why });
  }

  /** Items the machine sells tonight. */
  vendStock(): VendId[] {
    return (Object.keys(VEND_BY_ID) as VendId[]).filter((id) => VEND_BY_ID[id].night <= this.state.night);
  }

  /** Buy something. Returns false if it is not in stock or you cannot pay. */
  buy(id: VendId): boolean {
    const s = this.state;
    const item = VEND_BY_ID[id];
    if (!item || item.night > s.night || s.tokens < item.cost || s.ended) return false;
    s.tokens -= item.cost;
    s.score.tokens = s.tokens;
    const b = s.buffs;
    switch (id) {
      case 'cola':
        s.sanity = clamp(s.sanity + 30, 0, 100);
        s.fear = Math.max(0, s.fear - 0.3);
        break;
      case 'toffee':
        b.toffee = 60;
        break;
      case 'mint':
        b.mint = true;
        if (s.current && s.phase === 'present') this.giveHint(s.current);
        break;
      case 'coffee':
        b.coffee = true;
        break;
      case 'barley':
        b.barley = 60;
        break;
      case 'tonic':
        b.tonic = true;
        break;
      case 'tea':
        b.tea = true;
        break;
    }
    this.bus.emit('tokens', { tokens: s.tokens, gained: -item.cost, why: item.name });
    this.bus.emit('buff', { id, on: true });
    return true;
  }

  /** Hollow mints: name one thing that is off about this visitor. */
  private giveHint(p: Patient): void {
    const s = this.state;
    s.buffs.mint = false;
    const r = this.registryOf(p);
    const said: Partial<Record<string, string>> = {
      dob_swap: 'The date of birth they give does not match the records.',
      kin_wrong: 'Ask who to call. It will not match the records.',
      sender_wrong: 'Ask who sent them. It will not match the records.',
      echo: 'It will say your own words back to you.',
      deceased: 'Check the records. Look at the status line.',
      wristband: 'Compare the wristband number with the records.',
      photo: `The photo shows ${r.photoMark}. Look at the face.`,
      no_breath: 'Watch the glass in front of its mouth.',
      too_fast: 'It answers before a person would.',
      borrowed_memory: 'Its memory of tonight belongs to somebody else.',
      no_blink: 'Watch the eyes. Count to ten.',
      ahead: 'It answers the question you have not asked yet.',
      mirror: 'The mark is on the wrong side of the face.',
      no_pulse: 'Get close. Look at the throat.',
      still_breath: 'Watch its breath on the glass. Does it fade?',
    };
    const real = p.tells.filter((t) => said[t]);
    const text = p.truth === 'human' || !real.length ? 'You chew the mint and look hard. Nothing about this one is wrong.' : said[real[0]]!;
    this.bus.emit('hint', { text });
  }

  // ---------------------------------------------------------------- story
  private pellWho(): string {
    return this.state.pellGone && this.state.night >= 5 ? PELL_STANDIN : 'pell';
  }

  private emitLine(id: string, person: string, line: L, call = false, wrong = false, where?: BeatDef['where'], talk?: L[]): void {
    if (this.storyDone.has(id)) return;
    this.storyDone.add(id);
    const speaker = PERSON_BY_ID[person]?.name ?? person;
    this.touch();
    this.bus.emit('story', { id, text: lineText(line), speaker, call, wrong, person, line, where: where ?? (call ? 'phone' : 'intercom'), talk });
  }

  private common(key: keyof typeof COMMON, person: string, once = false, idSuffix = ''): void {
    const id = once ? key : `${key}${idSuffix || `_${this.state.seq}_${Math.floor(this.state.minute)}`}`;
    this.emitLine(id, person, COMMON[key]);
  }

  private beat(b: BeatDef): void {
    this.emitLine(b.id, b.who, b.text, b.where === 'phone', b.wrong ?? false, b.where, b.talk);
  }

  private runStory(): void {
    const s = this.state;
    for (const b of this.def.beats) {
      if (this.storyDone.has(b.id) || s.minute < b.at) continue;
      if (/breaker/.test(b.id) && s.breakerTripped && !s.powerOn) {
        this.storyDone.add(b.id);
        continue;
      }
      if (b.minStage !== undefined && s.stage < b.minStage) {
        if (s.minute > b.at + 40) this.storyDone.add(b.id);
        continue;
      }
      // Pell's lines go to someone else once he has locked himself in
      if (b.who === 'pell' && s.pellGone && s.night < 5 && b.id !== 'pell2') {
        this.storyDone.add(b.id);
        continue;
      }
      // never talk over the officer's own interview; wait for a gap
      if (s.phase === 'present' && s.asked.length > 0 && s.minute < b.at + 8) continue;
      // nobody walks into the booth while something is hunting in the corridor
      if ((b.where === 'back' || b.where === 'corridor') && this.stalker.active) continue;
      this.beat(b);
      return;
    }
  }

  // ---------------------------------------------------------------- the stare rule
  /** Seated player ducked below the desk. */
  setDuck(on: boolean): void {
    this.ducked = on;
  }

  /** Seated player is leaning in on the patient's face. */
  setGaze(on: boolean): void {
    this.gazing = on;
  }

  private runStare(dt: number): void {
    const s = this.state;
    const p = s.current;
    const eligible =
      !!p && !p.tutorial && s.phase === 'present' && s.powerOn && ((p.truth === 'understudy' && (s.stage >= 1 || p.archetype !== 'slipping_mimic')) || p.archetype === 'strange_innocent');
    if (!eligible) {
      if (s.stare) this.endStare();
      this.stareT = Math.max(this.stareT, 7);
      return;
    }
    if (this.ducked) s.patience -= dt / 150;
    if (s.stare) {
      this.stareLeft -= dt;
      if (this.ducked) this.stareLeft = Math.min(this.stareLeft, 1.2);
      else if (this.gazing) this.contact();
      if (this.stareLeft <= 0) this.endStare();
    } else {
      this.stareT -= dt;
      if (this.stareT <= 0) {
        s.stare = true;
        this.stareLeft = this.gazeRng.range(4, 6.5);
        this.stareHit = false;
        this.touch();
        this.bus.emit('stare', { on: true, hit: false });
      }
    }
  }

  private endStare(): void {
    const s = this.state;
    s.stare = false;
    this.stareT = this.gazeRng.range(15, 28);
    this.bus.emit('stare', { on: false, hit: this.stareHit });
  }

  /** Eye contact during a stare. Only a fake punishes it. */
  private contact(): void {
    const s = this.state;
    if (!s.stare || this.stareHit || this.ducked || !s.current) return;
    if (s.current.truth !== 'understudy') return;
    this.stareHit = true;
    this.spike(0.45, 9);
    this.bus.emit('stare', { on: true, hit: true });
  }

  /** A fake you let in has stopped at the window behind your chair, and you turned round and looked at it. */
  passageStare(): void {
    this.spike(0.5, 7);
    this.touch();
  }

  // ---------------------------------------------------------------- breaker
  private runBreaker(): void {
    const s = this.state;
    const at = this.def.breakerAt[s.breakersDone];
    if (at !== undefined && s.minute >= at && s.powerOn && !s.dawn) {
      s.breakersDone++;
      s.breakerTripped = true;
      s.powerOn = false;
      this.touch();
      this.bus.emit('powerChanged', { on: false });
      this.bus.emit('taskChanged', { id: 'breaker', text: 'Power is out. Get to the fuse box at the far end of the corridor. Something is out there. Crouch.', done: false });
      this.spike(0.5, 4);
      this.summonStalker(11.6);
    }
  }

  restorePower(): boolean {
    const s = this.state;
    if (s.powerOn || s.zone !== 'breaker') return false;
    s.powerOn = true;
    this.touch();
    this.bus.emit('powerChanged', { on: true });
    this.bus.emit('taskChanged', { id: 'breaker', text: 'Power restored.', done: true });
    this.bus.emit('cue', { cue: 'power_back', intensity: 0.5 });
    s.sanity = clamp(s.sanity + 4, 0, 100);
    this.stalker.summon(this.stalker.x, 25);
    return true;
  }

  setZone(z: Zone): void {
    this.state.zone = z;
  }

  setFlashlight(on: boolean): void {
    this.state.flashlight = on;
  }

  // ---------------------------------------------------------------- patients
  private runPatients(dt: number): void {
    const s = this.state;
    s.phaseTime += dt;

    if (s.phase === 'none') {
      if (!s.powerOn || s.dawn) return;
      if (s.queue.length && s.minute > 20) {
        this.spawn(s.queue.shift()!);
        return;
      }
      const next = this.roster[s.slotIndex];
      if (next && s.minute >= next.at) {
        s.slotIndex++;
        if (next.gate) s.finaleDone = true;
        this.spawn(this.makeVisitor(next));
      }
    } else if (s.phase === 'approaching' && s.phaseTime > 3.5) {
      s.phase = 'present';
      s.phaseTime = 0;
      if (s.buffs.mint && s.current) this.giveHint(s.current);
    } else if (s.phase === 'present') {
      const p = s.current;
      if (!p) {
        s.phase = 'none';
        return;
      }
      if (p.tutorial) return; // Pell waits as long as it takes
      const angry = p.truth === 'understudy' && s.stage >= 2;
      const slow = s.buffs.coffee ? 2 : 1;
      if (s.powerOn && !s.breach) s.patience -= dt / ((angry ? 110 : s.asked.length ? 330 : 170) * slow);
      if (s.patience <= 0 && !s.breach) {
        if (angry) {
          s.breach = { phase: 'crack', t: 0 };
          this.touch();
          this.bus.emit('breach', { phase: 'crack' });
          this.spike(0.5, 3);
        } else this.leave('timeout');
      }
    } else if (s.phase === 'leaving' && s.phaseTime > 2.6) {
      s.phase = 'none';
      s.phaseTime = 0;
      s.current = null;
      s.gap = this.rng.range(PACING.gapMin, PACING.gapMax);
    }
  }

  /** Someone on tonight's roster, real or wearing a real person. */
  private makeVisitor(v: VisitorDef): Patient {
    const s = this.state;
    const entry = this.state.registry.find((r) => r.id === (v.person === 'ada' ? MOTHER_ID : v.gate ? 'R900' : `C_${v.person}`))!;
    const archetype = v.archetype ?? (v.fake ? 'slipping_mimic' : 'plain');
    const p = makePatient({ rng: this.rng, entry, archetype, stage: s.stage, previous: s.history, quirk: v.quirk, seq: ++s.seq, tells: v.fake ? [...(v.tells ?? [])] : [] });
    p.castId = v.person;
    p.vid = v.id;
    p.truth = v.fake ? 'understudy' : 'human';
    // a fake does not breathe until night 5; after that it breathes, but not quite right
    if (v.fake && s.night <= 4 && !p.tells.includes('no_breath')) p.tells.push('no_breath');
    p.breathes = !v.fake || s.night >= 5;
    if (v.form) Object.assign(p.docs, v.form);
    if (v.form?.slipDob && !v.fake) p.tells.push('clerk_typo');
    if (v.face) p.faceMark = v.face;
    p.lines = { greet: v.greet, say: v.say, bye: v.bye };
    p.greet = lineText(v.greet);
    for (const q of ORDER) p.answers[q] = lineText(v.say[q]);
    p.reveal = v.reveal;
    p.tutorial = v.tutorial;
    p.mother = v.mother;
    p.gate = v.gate;
    if (v.mother && v.fake) p.height = 0.95;
    return p;
  }

  private spawn(p: Patient): void {
    const s = this.state;
    s.current = p;
    s.phase = 'approaching';
    s.phaseTime = 0;
    s.patience = 1;
    s.asked = [];
    s.lastLine = '';
    s.lookedUp = false;
    s.faceChecked = false;
    s.stare = false;
    this.stareT = this.gazeRng.range(9, 16);
    this.touch();
    this.bus.emit('patientArrived', { patient: p });
  }

  /** Query the registry on the green screen. Needs power. */
  lookup(): RegistryEntry | null {
    const s = this.state;
    if (!s.current || s.phase !== 'present' || !s.powerOn) return null;
    s.lookedUp = true;
    this.touch();
    return this.registryOf(s.current);
  }

  inspectFace(): string | null {
    const s = this.state;
    if (!s.current || s.phase !== 'present') return null;
    s.faceChecked = true;
    this.contact();
    this.touch();
    return s.current.faceMark;
  }

  ask(q: QuestionId): AskResult | null {
    const s = this.state;
    const p = s.current;
    if (!p || s.phase !== 'present' || s.asked.includes(q)) return null;
    let line: L = p.lines?.say[q] ?? p.answers[q];
    if (p.tells.includes('echo') && s.lastLine) line = [s.lastLine, 'flat'];
    else if (p.tells.includes('ahead')) {
      // it answers the question you were going to ask next
      const nextQ = ORDER.find((x, i) => i > ORDER.indexOf(q) && !s.asked.includes(x)) ?? ORDER.find((x) => x !== q && !s.asked.includes(x));
      if (nextQ && p.lines) line = p.lines.say[nextQ];
    }
    s.asked.push(q);
    s.lastLine = QUESTION_TEXT[q];
    const fast = p.tells.includes('too_fast') || p.tells.includes('ahead') || p.tells.includes('echo');
    const delay = fast ? 0.05 : 0.9 + this.presRng.next() * 0.9;
    const text = lineText(line);
    this.touch();
    this.bus.emit('questionAnswered', { patientId: p.id, q, text });
    return { text, line, delay };
  }

  /** Visible without any action: does breath show in the cold air? */
  showsBreath(p: Patient): boolean {
    return !p.tells.includes('no_breath');
  }

  // ---------------------------------------------------------------- verdicts
  verdict(v: Verdict): void {
    const s = this.state;
    const p = s.current;
    if (!p || s.phase !== 'present') return;
    if (v === 'contain' && !s.powerOn) return; // the trapdoor is electric
    const mimic = p.truth === 'understudy';
    if (s.buffs.tonic) {
      // the tonic decides for you, and it is never wrong
      s.buffs.tonic = false;
      v = mimic ? (s.powerOn ? 'contain' : 'refuse') : 'admit';
      this.bus.emit('buff', { id: 'tonic', on: false });
    }
    s.buffs.coffee = false;
    let wrong = false;

    if (v === 'admit' && !mimic) {
      s.admittedHumans++;
      const e = this.registryOf(p);
      e.note = `${e.note ? e.note + ' ' : ''}LET IN TONIGHT. ON THE WARD NOW.`;
    }
    if (s.breach) s.breach = null;
    if (v === 'admit' && mimic && p.mother) s.motherTaken = true;
    if (v === 'admit' && mimic && p.castId === 'officer') s.selfTaken = true;
    if (v === 'admit' && p.castId === 'hollis' && !mimic) s.hollisIn = true;
    if (!mimic) {
      if (v === 'refuse') {
        wrong = true;
        s.score.refusedHumans++;
        this.schedule('window_return', p, 22);
        this.spike(0.2, 6);
      } else if (v === 'contain') {
        wrong = true;
        s.score.refusedHumans++;
        this.schedule('guilt', p, 3);
        this.spike(0.5, 14);
      } else if (v === 'observe') {
        this.spike(0, 1);
      }
    } else {
      if (v === 'admit') {
        wrong = true;
        s.score.admittedUnderstudies++;
        this.bumpStage();
        this.schedule('passage_stare', p, 0.1);
        this.schedule('ward_incident', p, 18);
        this.spike(0.1, 5);
      } else if (v === 'observe') {
        this.schedule('observation_breach', p, 16);
        this.spike(0.15, 2);
      } else if (v === 'refuse') {
        this.bumpStage();
        this.schedule('window_return', p, 26);
        this.spike(0.1, 1);
      } else if (v === 'contain') {
        this.schedule('clean_catch', p, 2);
        this.spike(0.6, 0);
      }
    }
    if (wrong) s.score.wrong++;
    else if (!(v === 'observe' || (mimic && v === 'refuse'))) {
      s.score.correct++;
      if (!p.tutorial) this.earn(1, 'right call');
    }
    this.bus.emit('verdictResult', { patient: p, verdict: v, correct: !wrong });
    s.history.push(p);
    this.leave(v);
  }

  private leave(v: Verdict | 'timeout'): void {
    const s = this.state;
    const p = s.current;
    if (!p) return;
    if (v === 'timeout') {
      s.history.push(p);
      if (p.truth === 'human') this.schedule('window_return', p, 18);
      this.spike(0.1, 2);
    }
    s.phase = 'leaving';
    s.phaseTime = 0;
    this.touch();
    this.bus.emit('patientLeft', { patient: p, verdict: v });
  }

  // ---------------------------------------------------------------- consequences
  private schedule(kind: Consequence['kind'], p: Patient, delayMin: number): void {
    this.state.consequences.push({ kind, patientId: p.id, due: this.state.minute + delayMin, fired: false });
  }

  private runConsequences(): void {
    const s = this.state;
    for (const c of s.consequences) {
      if (c.fired || s.minute < c.due) continue;
      c.fired = true;
      const p = s.history.find((h) => h.id === c.patientId);
      if (!p) continue;
      switch (c.kind) {
        case 'ward_incident':
          this.common(s.night >= 5 ? 'inc_imogen' : 'inc', s.night >= 5 ? PELL_STANDIN : 'pell', false, `_${p.id}`);
          this.spike(0.7, 8);
          this.bus.emit('cue', { cue: 'overhead_steps', intensity: 0.8 });
          this.bus.emit('cue', { cue: 'whisper', intensity: 0.8 });
          if (!s.wardLocked) this.summonStalker(13.5, 90);
          break;
        case 'observation_breach':
          this.bumpStage();
          this.common('obs', 'kessler', false, `_${p.id}`);
          this.spike(0.8, 8);
          this.bus.emit('cue', { cue: 'door_creak', intensity: 0.9 });
          break;
        case 'window_return':
          this.common(p.truth === 'understudy' ? 'ret_fake' : 'ret_human', this.pellWho(), false, `_${p.id}`);
          this.spike(0.3, 3);
          this.bus.emit('cue', { cue: p.truth === 'understudy' ? 'window_tap' : 'knock', intensity: 0.7 });
          if (p.truth === 'understudy') {
            const entry = this.registryOf(p);
            const back = makePatient({ rng: this.rng, entry, archetype: 'slipping_mimic', stage: s.stage, previous: s.history, quirk: 'Back at the window. Knows what you asked last time.', seq: ++s.seq });
            back.castId = p.castId;
            back.reveal = p.reveal;
            back.breathes = s.night >= 5;
            if (s.night <= 4 && !back.tells.includes('no_breath')) back.tells.push('no_breath');
            back.greet = 'Good evening. Good evening, Officer. Good evening.';
            back.lines = p.lines ? { greet: ['Good evening. Good evening, Officer. Good evening.', 'flat'], say: p.lines.say } : undefined;
            this.state.queue.push(back);
          } else {
            this.state.queue.push({ ...p, id: `P${String(++s.seq).padStart(2, '0')}`, quirk: 'Soaked. Quiet now. Looks at the floor.' });
          }
          break;
        case 'guilt':
          s.sanity = clamp(s.sanity - 6, 0, 100);
          this.bus.emit('cue', { cue: 'whisper', intensity: 0.6 });
          break;
        case 'clean_catch':
          s.sanity = clamp(s.sanity + 6, 0, 100);
          break;
        case 'passage_stare':
          break;
      }
      this.bus.emit('consequence', { c, patient: p });
    }
  }

  // ---------------------------------------------------------------- director + hallucinations
  private runDirector(dt: number): void {
    const s = this.state;
    const cues = this.director.tick(dt, {
      minute: s.minute,
      shiftLength: this.def.end,
      fear: s.fear,
      sanity: s.sanity,
      stage: s.stage,
      patientPresent: s.phase === 'present',
      powerOn: s.powerOn,
      zone: s.zone,
    });
    for (const c of cues) {
      this.spike(c.intensity * 0.35);
      this.touch();
      this.bus.emit('cue', c);
    }
    // nothing has happened for too long: the building makes itself heard
    if (s.quietT > PACING.maxQuiet && s.phase !== 'present' && !this.stalker.active) {
      const pool = ['distant_step', 'pipe_knock', 'scratch', 'knock', 'chair_creak', 'overhead_steps'] as const;
      this.touch();
      this.bus.emit('cue', { cue: this.presRng.pick(pool), intensity: 0.35 });
    }
  }

  private runHallucinations(dt: number): void {
    this.hallT -= dt;
    if (this.hallT > 0) return;
    const rate = this.distortion.hallucinationRate; // per minute
    this.hallT = rate > 0 ? (60 / rate) * this.presRng.range(0.6, 1.4) : 10;
    if (rate <= 0) return;
    const kinds = ['phantom_step', 'phantom_knock', 'whisper_name', 'shadow_figure'] as const;
    this.bus.emit('hallucination', { kind: this.presRng.pick(kinds) });
  }
}
