// Writes the six nights as JSON for the script PDF. npx tsx tools/script/dump.ts <out.json>
import { writeFileSync } from 'node:fs';
import { COMMON } from '../../src/data/common';
import { NIGHTS } from '../../src/data/nights';
import { PERSON_BY_ID } from '../../src/data/persons';
import { TUTORIAL, TUTORIAL_AFTER, TUTORIAL_NUDGE, TUTORIAL_WRONG } from '../../src/data/tutorial';
import { VENDING } from '../../src/data/vending';
writeFileSync(process.argv[2], JSON.stringify({ nights: NIGHTS, persons: PERSON_BY_ID, common: COMMON, tutorial: { steps: TUTORIAL, after: TUTORIAL_AFTER, nudge: TUTORIAL_NUDGE, wrong: TUTORIAL_WRONG }, vending: VENDING }));
