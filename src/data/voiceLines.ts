import { COMMON, PELL_STANDIN } from './common';
import { NIGHTS } from './nights';
import type { L } from './nightTypes';
import { QUESTION_TEXT } from './questions';
import { TUTORIAL, TUTORIAL_AFTER, TUTORIAL_NUDGE, TUTORIAL_WRONG } from './tutorial';

export interface SpokenLine {
  person: string;
  line: L;
}

/** Every line anybody speaks across the six nights. Used to record them all ahead of time. */
export function allSpokenLines(): SpokenLine[] {
  const out: SpokenLine[] = [];
  const add = (person: string, line: L | undefined): void => {
    if (line) out.push({ person, line });
  };
  for (const n of NIGHTS) {
    for (const v of n.visitors) {
      add(v.person, v.greet);
      for (const q of Object.values(v.say)) add(v.person, q);
      add(v.person, v.bye);
      // a fake that echoes says your own questions back to you, in its voice
      if (v.tells?.includes('echo')) for (const q of Object.values(QUESTION_TEXT)) add(v.person, [q, 'flat']);
    }
    for (const b of n.beats) {
      add(b.who, b.text);
      for (const t of b.talk ?? []) add(b.who, t);
    }
    add(n.dawn.pell.who, n.dawn.pell.text);
    add(n.dawn.wrong.who, n.dawn.wrong.text);
  }
  for (const s of TUTORIAL) {
    add('pell', s.line);
    add('pell', s.after);
  }
  for (const l of [...TUTORIAL_NUDGE, ...TUTORIAL_AFTER, ...TUTORIAL_WRONG]) add('pell', l);
  const who: Record<string, string[]> = {
    pell_lock: ['pell'], inc: ['pell'], inc_imogen: [PELL_STANDIN], obs: ['kessler'], ret_fake: ['pell', PELL_STANDIN], ret_human: ['pell', PELL_STANDIN],
    miss_count: ['pell', PELL_STANDIN], miss_task: ['matron'], count_same: ['pell', PELL_STANDIN], count_more: ['pell', PELL_STANDIN],
    false_alarm: ['pell'], dead_you: ['officer'], dead_pell: ['pell', PELL_STANDIN], breach_warn: ['officer'],
  };
  for (const [k, l] of Object.entries(COMMON)) for (const p of who[k] ?? ['pell']) add(p, l);
  // the same line said twice by the same person is recorded once
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.person}|${JSON.stringify(s.line)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
