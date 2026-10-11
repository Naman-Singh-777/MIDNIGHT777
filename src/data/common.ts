import type { L } from './nightTypes';

/** Lines the night uses when something you did comes due. Same words every night; who says them changes once Pell is gone. */
export const COMMON: Record<string, L> = {
  pell_lock: ["Right. I'll lock it from this side, then. Someone has to. Don't come to that door tonight, whatever you hear. Not for anyone.", 'scared'],
  inc: ["Pell! The one you sent up asked me my name, then said it back before I'd answered. In my voice. It's gone out into the corridor. Shut your door.", 'panic'],
  inc_imogen: ["Pet! The one you sent up just stood at the foot of a bed and started breathing in time with her. It's gone out into the corridor. Shut your door.", 'panic'],
  obs: ['Kessler. The observation room is open. Nobody forced the door. Close yours.', 'stern'],
  ret_fake: ["Someone's at your window again. The one you sent off. Soaking. No. Wait. Bone dry.", 'scared'],
  ret_human: ["The one you turned away is back at your window. Soaked through. Says there's nowhere else to go.", 'grief'],
  miss_count: ["Pell. Nobody did the head count. So nobody knows how many are in there. And I'm not going to be the one who finds out.", 'scared'],
  miss_task: ["Matron's office. Your list was on the desk, Officer. It is still on the desk.", 'cold'],
  count_same: ["Same as my sheet. Good. I'll stop counting now. I'll try.", 'nervous'],
  count_more: ["You got more than my sheet? Don't count again. Get back to your desk and shut the door.", 'panic'],
  false_alarm: ["It's me! Pell. Sorry. Checking the fuse box. Sorry. Going back now.", 'nervous'],
  dead_you: ['Night intake.', 'flat'],
  dead_pell: ["Pell. Did your phone just ring? I'm sat at the switchboard. Nothing went through it. Not one light. Who were you talking to?", 'scared'],
  breach_warn: ['It is coming through the glass.', 'flat'],
};

/** Who says the Pell lines once Pell is gone (nights 5 and 6). */
export const PELL_STANDIN = 'imogen';
