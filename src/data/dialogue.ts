import type { DeathCause, Patient } from '../sim/types';

/** First words out of each visitor. Named visitors bring their own line. */
export function greeting(p: Patient, nth: number): string {
  if (p.greet) return p.greet;
  if (p.registryId === 'R209') return "There you are. I could see your little window from the road. Let me in, love. My feet are bare.";
  switch (p.archetype) {
    case 'plain':
      return "Evening. I've got my form. The road was empty, so I walked. Sorry about the puddle.";
    case 'chatty':
      return nth < 4 ? 'Evening! Lovely night for it. Is the kettle on?' : 'Evening. Does the ward do soup? Asking for me, mostly.';
    case 'strange_innocent':
      return 'Mm mm mm mm. Oh. Evening.';
    case 'tragic':
      return "Is the children's ward on this floor?";
    case 'slipping_mimic':
      return 'Good evening. Good evening, Officer. Good evening.';
    case 'fluent_mimic':
      return 'Evening. Long night? You look like you have been awake since the war.';
    case 'voice_mimic':
      return "It's Imogen, pet. Open the gate for me.";
  }
}

export const SPEAKER_VOICE: Record<string, { pitch: number; radio: boolean }> = {
  'Sister Imogen': { pitch: 205, radio: true },
  'Orderly Pell': { pitch: 118, radio: true },
  'Night Nurse Kessler': { pitch: 168, radio: true },
  "Matron's Office": { pitch: 142, radio: true },
  'Ada Wren': { pitch: 188, radio: true },
  'Matron Agatha Thorne': { pitch: 140, radio: true },
  'Dr. Ines Abara': { pitch: 175, radio: false },
  'Abel Hollis': { pitch: 92, radio: true },
  'The wireless': { pitch: 125, radio: true },
  'Night Officer': { pitch: 150, radio: true },
};

export function titleHtml(reached: number, demoOnly: boolean): string {
  const nights = Array.from({ length: 6 }, (_, i) => i + 1)
    .map((n) => `<button class="btn" data-night="${n}" ${n > reached ? 'disabled' : ''}>Night ${n}</button>`)
    .join('');
  return `
  <h1>Midnight</h1>
  <h2>Asylum Intake &middot; six nights</h2>
  <p>Vesper Hollow Hospital, October 1963. Your mother has been on Ward B since spring. Most days she doesn't know your name. Staff can sit with family at six in the morning, so you took the night job on the front window.</p>
  <p>People knock on the glass all night. Most of them are patients being admitted, or their families. Some of them are not people. Every one you let in walks the passage right behind your chair, and sleeps on her ward.</p>
  <p class="note">Get to six. Then go and see her. If you die, the night starts again.</p>
  <button class="btn big" data-begin>${reached > 1 ? `Continue: Night ${reached}` : 'Start Night 1'}</button>
  ${reached > 1 ? `<div class="nights">${nights}</div>` : ''}
  ${demoOnly ? '<p class="demo">DEMO: NIGHT 1 ONLY</p>' : ''}
  <div class="keys">Mouse to look. 1 to 5 to ask. A, O, R, T to decide. Press H in the game for every control. Headphones help.</div>`;
}

/** The card before each night: the date, what has changed, what is new in the machine. */
export function shiftCardHtml(def: { n: number; name: string; date: string; card: string[] }, newItems: { name: string; effect: string }[], tokens: number): string {
  return `
  <h1>Night ${def.n}</h1>
  <h2>${def.name} &middot; ${def.date}</h2>
  ${def.card.map((c) => `<p>${c}</p>`).join('')}
  ${newItems.length ? `<div class="shiftnew">NEW IN THE VENDING MACHINE TONIGHT<br>${newItems.map((i) => `${i.name}: ${i.effect}`).join('<br>')}</div>` : ''}
  <p class="note">Tokens: ${tokens}. Get to six.</p>
  <button class="btn big" data-begin>Start the shift</button>`;
}

export const PAUSE_HTML = `
  <h1>Paused</h1>
  <h2>The rain does not stop</h2>
  <button class="btn big" data-begin>Back to work</button>`;

const DEATHS: Record<DeathCause, [string, string]> = {
  stalker: ['It heard you', 'It found the sound you made and then it found you. Nobody comes to the window after that. In the morning bed 9 is empty and nobody can say when she left.'],
  breach: ['It came through the glass', 'You kept it waiting. It got tired of waiting. The day staff find the window in pieces and the desk chair still turning.'],
  nerves: ['You stopped answering', "The phone rings until it gives up. When the day staff get to you, you're sitting very straight, smiling at the glass, and you can't tell them your name."],
};

export function deathHtml(cause: DeathCause, clock: string): string {
  const [title, text] = DEATHS[cause];
  return `
  <h1>${clock}</h1>
  <h2>${title}</h2>
  <p>${text}</p>
  <p class="note">The night is gone. Everything you did tonight is gone with it.</p>
  <button class="btn big" data-restart>Start the night again</button>`;
}

const ENDINGS: Record<string, [string, string]> = {
  clean: [
    'Bed 9',
    "Eleven beds, eleven people, and a chair for you. She wakes when you sit down. For a long moment she doesn't know you. Then she says your name, the old way, the way she did when you were small, and holds your hand until the day staff come.",
  ],
  crowded: [
    'Bed 9 and the others',
    'She is asleep in bed 9. You count the room and get more than the sheet. The extra ones sit up around her bed, very still and very polite. One of them has started breathing the way she breathes.',
  ],
  taken: [
    'There you are',
    'Bed 9 is made, the blanket folded into a square. Behind you in the corridor someone says your name in her voice. It is made of everything they took out of her, and the part of her that knew you was the biggest part. It says your name again, a little better.',
  ],
  absent: [
    'You never went',
    'Six came and went and you stayed at the desk. By the time anyone looks, bed 9 has been stripped and the records have a new line in your handwriting.',
  ],
};

export function endHtml(
  score: { correct: number; wrong: number; admittedUnderstudies: number; refusedHumans: number; sanity: number; ending?: string; tasksDone?: number; tasksMissed?: number; night?: number; tokens?: number },
  name: string,
  override?: [string, string],
  last = false,
): string {
  const [title, text] = override ?? ENDINGS[score.ending ?? 'absent'] ?? ENDINGS.absent;
  const n = score.night ?? 1;
  return `
  <h1>06:00</h1>
  <h2>Night ${n} &middot; ${title}</h2>
  <p>${text}</p>
  <p>Right calls: ${score.correct}. Wrong calls: ${score.wrong}. Fakes let in: ${score.admittedUnderstudies}. Real people turned away or dropped: ${score.refusedHumans}. Jobs done: ${score.tasksDone ?? 0}, missed: ${score.tasksMissed ?? 0}. Nerves left: ${score.sanity}%.</p>
  <p class="note">On your way out you open the admissions book at page one. The first line is in your handwriting, dated tonight, 22:00.<br>${name}: let in.</p>
  ${last ? '<p>That was the last night. Thank you for working the window.</p><button class="btn big" data-restart>Back to the start</button>' : `<button class="btn big" data-next>Go home. Come back for Night ${n + 1}</button> <button class="btn" data-restart>Work this night again</button>`}`;
}

/** The demo night ends here. */
export function demoEndHtml(): string {
  return `
  <h1>End of Night 1</h1>
  <h2>The demo ends here</h2>
  <p>Five more nights. A new face at the window every night, and fakes that get better at it.</p>
  <button class="btn big" data-next>Go on to Night 2</button>`;
}
