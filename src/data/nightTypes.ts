import type { Archetype, Documents, Ending, QuestionId, TaskId, TellId } from '../sim/types';

/** How a line is said. Drives recording speed and runtime treatment (src/data/voiceStyle.ts). */
export type Emo =
  | 'calm' | 'warm' | 'kind' | 'bright' | 'dry' | 'sly' | 'stern' | 'cold' | 'flat'
  | 'nervous' | 'scared' | 'panic' | 'urgent' | 'tired' | 'grief' | 'broken' | 'whisper' | 'angry';

/** A spoken line: plain text, or text with how it is said. */
export type L = string | [string, Emo];

/** How a fake shows what it is when the face slips. Each is drawn differently in patientView.ts. */
export type RevealKind = 'unhinge' | 'grin' | 'rolled' | 'hollow' | 'neck' | 'owl' | 'split' | 'melt' | 'eyes' | 'backbend' | 'reach' | 'stutter';

export interface VisitorDef {
  id: string;
  person: string; // src/data/persons.ts
  at: number; // shift minute the visitor is due (the clock waits for the roster, not the other way round)
  fake?: boolean;
  archetype?: Archetype;
  tells?: TellId[];
  quirk: string; // what the officer sees, shown on arrival
  greet: L;
  say: Record<QuestionId, L>;
  bye?: L; // said at the back window as they walk the passage
  form?: Partial<Documents>; // what the admission form says, where it differs from the records
  face?: string; // what the face shows, where it differs from the photo
  reveal?: RevealKind;
  tutorial?: boolean;
  mother?: boolean;
  gate?: boolean;
  /** Officer says nothing; the fake reads your question back to you. Recorded per fake. */
  wrongVoice?: number; // 0..1 how much of the mimic drone rides under its voice
}

export type Where = 'phone' | 'intercom' | 'back' | 'corridor' | 'window';

export interface BeatDef {
  id: string;
  at: number;
  who: string; // person id
  text: L;
  where?: Where; // default intercom; phone rings first
  minStage?: number;
  wrong?: boolean; // the voice is not quite theirs
  talk?: L[]; // in person: what they say if you press E while they are there
}

export interface TaskDef {
  id: TaskId;
  text: string;
  where: string;
  at: number;
  due: number;
}

export interface NightDef {
  n: number;
  name: string;
  date: string;
  card: string[]; // the shift card before the night
  vending: string[]; // items new in the machine tonight
  stageStart: number; // how much the fakes know before you start
  visitors: VisitorDef[];
  beats: BeatDef[];
  todo: TaskDef[];
  breakerAt: number[];
  end: number;
  dawn: { pell: BeatDef; wrong: BeatDef };
  endings: Partial<Record<Ending, [string, string]>>;
  demoEnd?: boolean;
}
