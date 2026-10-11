import type { NightDef } from '../nightTypes';
import { N1 } from './n1';
import { N2 } from './n2';
import { N3 } from './n3';
import { N4 } from './n4';
import { N5 } from './n5';
import { N6 } from './n6';

/** The six nights, in order. Night 1 is the demo. */
export const NIGHTS: NightDef[] = [N1, N2, N3, N4, N5, N6];

export function nightDef(n: number): NightDef {
  return NIGHTS[Math.max(0, Math.min(NIGHTS.length - 1, n - 1))];
}
