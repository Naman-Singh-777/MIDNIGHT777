import type { L } from './nightTypes';

/**
 * Pell, locked out, teaches the window from the other side of the glass. Each step waits for the player to do it.
 * After that he only mentions the rest of the job, so there is still something left to find.
 */
export type TutorialStep = 'lean' | 'ask_name' | 'records' | 'face' | 'more' | 'decide';

export interface TutorialStepDef {
  id: TutorialStep;
  hint: string; // on screen while the step waits
  line: L; // Pell says this when the step starts
  after?: L; // and this once it is done
  skipAfter?: number; // seconds before the step lets itself go
}

export const TUTORIAL: TutorialStepDef[] = [
  { id: 'lean', hint: 'Hold the right mouse button to lean in to the glass.', line: ["Look at me properly. Lean in. Hold the right mouse button. Go on, I won't bite.", 'nervous'], after: ["See that, on the glass? That's my breath. Cold night, warm mouth. Remember it.", 'warm'] },
  { id: 'ask_name', hint: 'The form they handed you is on the left. Press 1 to ask their name.', line: ["Right. The form's on your left, the one I pushed through the slot. Ask me my name. Number one.", 'calm'] },
  { id: 'records', hint: 'Press Z to look them up in the hospital records.', line: ["Now check me against the records. Z. The green screen. If the form and the records don't match, you've got a problem.", 'calm'], after: ["Same date, same wristband, same everything. That's what you want. Every line.", 'calm'] },
  { id: 'face', hint: 'Press X to look at their face up close.', line: ["Last thing. The photo on the form shows a mark. Find it on my face. X. Get close. Closer than you'd like.", 'nervous'], after: ["Notched ear. Right side. A dog, when I was nine. If the photo says one thing and the face says another, that's not the person in the photo.", 'calm'] },
  { id: 'more', hint: 'Ask more with 2 to 5, or decide.', line: ["You can ask me the rest if you like. Date of birth, who sent me, who to call, what I remember. Some of them slip on the easy ones.", 'calm'], skipAfter: 14 },
  { id: 'decide', hint: 'A lets him in. O holds him. R turns him away. T drops him through the floor.', line: ["Then you decide. A lets me in. O holds me for observation. R sends me back out in that. T drops me through the floor, so let's not. A. Please.", 'urgent'] },
];

/** If the player waits too long on a step. */
export const TUTORIAL_NUDGE: L[] = [
  ["Any time now. It's raining on me.", 'dry'],
  ["I can hear something out on the road. Can we hurry this up?", 'scared'],
  ["Still here. Still wet.", 'dry'],
];

/** After you let him in, from the passage behind you, one at a time. */
export const TUTORIAL_AFTER: L[] = [
  ["Couple more things and then I'm off. Your list's on the desk. Q gets you out of that chair. E uses things. There's a vending machine in the corner. It takes the tokens they give you for getting it right.", 'calm'],
  ["C puts you under the desk. If something ever comes through that glass, that is where you want to be. Down there and quiet.", 'scared'],
  ["Later there's jobs. Mopping, filing, a head count at two. The power goes most nights. The fuse box is at the end of the corridor. And if you're ever out in that corridor in the dark, walk. Don't run. It listens.", 'whisper'],
  ["Right. Ward B. Night, then. Phone rings, you answer it.", 'nervous'],
];

/** If you turn Pell away or drop him. He is real. */
export const TUTORIAL_WRONG: L[] = [
  ["Oh, very funny. Very funny. Fine. I'll go round by the kitchens. Remember what that felt like, because that's what you just did to a real person.", 'angry'],
];
