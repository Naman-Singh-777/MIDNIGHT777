// Writes tools/voice/lines.json: every spoken line with its key, voice and speed. Run with: npx tsx tools/voice/collect.ts
import { writeFileSync } from 'node:fs';
import { PERSON_BY_ID } from '../../src/data/persons';
import { allSpokenLines } from '../../src/data/voiceLines';
import { EMO_SPEED, lineEmo, lineKey, lineText } from '../../src/data/voiceStyle';

const rows = allSpokenLines().map((s) => {
  const p = PERSON_BY_ID[s.person];
  if (!p) throw new Error(`no person ${s.person}`);
  return { key: lineKey(s.person, s.line), person: s.person, voice: p.voice, speed: EMO_SPEED[lineEmo(s.line)], emo: lineEmo(s.line), text: lineText(s.line) };
});
const keys = new Set(rows.map((r) => r.key));
if (keys.size !== rows.length) throw new Error('key clash');
writeFileSync('tools/voice/lines.json', JSON.stringify(rows, null, 1));
console.log(rows.length, 'lines', rows.reduce((a, r) => a + r.text.split(' ').length, 0), 'words');
