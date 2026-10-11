import type { L } from '../data/nightTypes';
import { TUTORIAL, TUTORIAL_AFTER, TUTORIAL_NUDGE, TUTORIAL_WRONG, type TutorialStep } from '../data/tutorial';
import type { QuestionId, Verdict } from '../sim/types';

export interface TutorialHooks {
  /** Pell speaks through the glass, or from the passage once he is through. Returns seconds. */
  say(line: L, from: 'window' | 'back'): number;
  /** The coaching card on screen, with the key it is about. null hides it. */
  coach(text: string | null, key?: string): void;
}

type Ev = { kind: 'lean' } | { kind: 'ask'; q: QuestionId } | { kind: 'lookup' } | { kind: 'face' } | { kind: 'verdict'; v: Verdict };

/**
 * Night 1 starts with Pell locked out on the wrong side of the glass. He walks you through the window one step at a time:
 * each step waits for you to actually do it. Once he is through, he tells you what else the job holds, from the passage,
 * and leaves the rest for you to find.
 */
export class Tutorial {
  private step = -1;
  private wait = 0; // seconds before the next step starts (while Pell finishes talking)
  private idle = 0;
  private nudged = 0;
  private after: L[] | null = null;
  private afterT = 0;
  done = false;
  active = false;

  constructor(private readonly h: TutorialHooks) {}

  get current(): TutorialStep | null {
    return this.step >= 0 && this.step < TUTORIAL.length ? TUTORIAL[this.step].id : null;
  }

  /** Pell is at the glass and has said his first line. */
  start(greetSeconds: number): void {
    this.active = true;
    this.step = -1;
    this.wait = greetSeconds + 0.4;
  }

  private next(): void {
    this.step++;
    this.idle = 0;
    this.nudged = 0;
    const s = TUTORIAL[this.step];
    if (!s) return;
    const d = this.h.say(s.line, 'window');
    this.h.coach(s.hint, keyFor(s.id));
    this.idle = -d;
  }

  /** Something the player did. Moves the tutorial on if it was what Pell asked for. */
  on(e: Ev): void {
    if (!this.active) return;
    if (e.kind === 'verdict') {
      this.finish(e.v);
      return;
    }
    const cur = this.current;
    if (this.wait > 0 || !cur) return;
    const hit =
      (cur === 'lean' && e.kind === 'lean') ||
      (cur === 'ask_name' && e.kind === 'ask' && e.q === 'name') ||
      (cur === 'records' && e.kind === 'lookup') ||
      (cur === 'face' && e.kind === 'face') ||
      (cur === 'more' && e.kind === 'ask');
    if (!hit) return;
    const s = TUTORIAL[this.step];
    this.h.coach(null);
    // after an answer, give Pell's reply room before he moves on
    const answerGap = e.kind === 'ask' ? 3.4 : 0;
    const d = s.after ? this.h.say(s.after, 'window') : 0;
    this.wait = Math.max(d + 0.5, answerGap);
  }

  private finish(v: Verdict): void {
    this.active = false;
    this.h.coach(null);
    if (v === 'admit') this.after = [...TUTORIAL_AFTER];
    else {
      this.h.say(TUTORIAL_WRONG[0], 'window');
      this.done = true;
    }
  }

  /** Pell has reached the window behind your chair. He finishes the lesson from there. */
  atBack(): void {
    if (this.after) this.afterT = 4.6;
  }

  update(dt: number): void {
    if (this.after && this.afterT > 0) {
      this.afterT -= dt;
      if (this.afterT <= 0) {
        const l = this.after.shift();
        if (!l) {
          this.after = null;
          this.done = true;
          this.h.coach(null);
          return;
        }
        const d = this.h.say(l, 'back');
        const i = TUTORIAL_AFTER.length - this.after.length - 1;
        this.h.coach(['Q stands you up. E uses things. The vending machine is behind you.', 'C gets you under the desk. C again to come up.', 'Jobs come on your list as the night goes on.', ''][i] || null);
        this.afterT = d + 0.6;
      }
      return;
    }
    if (!this.active) return;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.next();
      return;
    }
    const s = TUTORIAL[this.step];
    if (!s) return;
    this.idle += dt;
    if (s.skipAfter && this.idle > s.skipAfter) {
      this.wait = 0.01;
      this.h.coach(null);
      return;
    }
    if (this.idle > 16 && this.nudged < TUTORIAL_NUDGE.length && this.idle > 16 + this.nudged * 18) {
      const d = this.h.say(TUTORIAL_NUDGE[this.nudged], 'window');
      this.nudged++;
      this.idle -= d;
    }
  }
}

function keyFor(s: TutorialStep): string {
  return { lean: 'RMB', ask_name: '1', records: 'Z', face: 'X', more: '2', decide: 'A' }[s];
}
