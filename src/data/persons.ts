import type { RegistryEntry } from '../sim/types';

/**
 * Everyone who comes to the window across the six nights, as the hospital records have them.
 * A fake wears one of these people, so it pulls up the same record.
 * voice: Kokoro voice blend used to record their lines (tools/voice/render.py). pitch nudges playback for variety.
 */
export interface Person {
  id: string;
  name: string;
  female: boolean;
  age: number;
  record: Omit<RegistryEntry, 'id' | 'name'>;
  voice: string;
  pitch?: number;
  staff?: boolean;
}

const R = (dob: string, sender: string, kin: string, wristband: string, photoMark: string, note = '', alive = true): Omit<RegistryEntry, 'id' | 'name'> => ({ dob, sender, kin, wristband, photoMark, note, alive });

export const PERSONS: Person[] = [
  // ---------------------------------------------------------------- staff and family
  { id: 'pell', name: 'Orderly Pell', female: false, age: 27, staff: true, voice: 'bm_daniel*0.7+am_puck*0.3', record: R('09/09/1936', "Matron's Office", 'Doris Pell (mother)', 'STAFF-07', 'a notched right ear', 'Night orderly, Ward B.') },
  { id: 'imogen', name: 'Sister Imogen', female: true, age: 52, staff: true, voice: 'bf_isabella*0.6+af_heart*0.4', record: R('03/02/1911', "Matron's Office", 'None on file', 'STAFF-01', 'a freckle under the left eye', 'Night staff. On the premises.') },
  { id: 'kessler', name: 'Night Nurse Kessler', female: true, age: 49, staff: true, voice: 'bf_alice*0.7+af_kore*0.3', pitch: 0.97, record: R('11/11/1914', "Matron's Office", 'None living', 'STAFF-03', 'a scar over the left brow', 'Night staff, Ward A.') },
  { id: 'matron', name: 'Matron Agatha Thorne', female: true, age: 61, staff: true, voice: 'bf_emma*0.5+af_river*0.5', pitch: 0.94, record: R('30/06/1902', 'Board of Governors', 'None on file', 'STAFF-00', 'a mole on the right cheek', 'Matron. Vesper Hollow.') },
  { id: 'ada', name: 'Ada Wren', female: true, age: 62, voice: 'bf_lily*0.55+af_sarah*0.45', pitch: 0.95, record: R('19/03/1901', 'Dr. Ines Abara', 'Her child. On staff, night intake', 'VH-0909', 'a freckle under the left eye', 'WARD B, BED 9. NOT ALLOWED OFF THE WARD. ASLEEP AT 22:00.') },
  { id: 'radio', name: 'The wireless', female: false, age: 40, staff: true, voice: 'bm_lewis*0.6+am_adam*0.4', record: R('01/01/1900', 'BBC Home Service', 'None', 'NONE', 'none') },
  { id: 'officer', name: 'Night Officer', female: false, age: 26, voice: 'am_echo*0.5+bf_emma*0.5', record: R('02/04/1937', 'Dr. Ines Abara', 'Ada Wren (mother)', 'VH-1010', 'a scar over the left brow', 'WARD B, BED 10. TREATMENT: MEMORY.') },

  // ---------------------------------------------------------------- night 1
  { id: 'walter', name: 'Walter Quill', female: false, age: 71, voice: 'bm_george', pitch: 0.96, record: R('14/02/1892', 'Dr. Orrin Vale', 'June Quill (wife)', 'VH-2107', 'a scar over the left brow') },
  { id: 'dolly', name: 'Dolores Rusk', female: true, age: 54, voice: 'af_bella*0.5+bf_alice*0.5', pitch: 0.93, record: R('03/09/1909', 'Dr. Colm Rafferty', 'Vera Rusk (sister)', 'VH-4412', 'a gap between the front teeth') },
  { id: 'tobias', name: 'Tobias Hale', female: false, age: 24, voice: 'bm_fable*0.6+am_liam*0.4', record: R('27/06/1939', 'Dr. Hanne Sorley', 'Marian Hale (mother)', 'VH-3086', 'a notched right ear') },
  { id: 'hollis', name: 'Abel Hollis', female: false, age: 55, voice: 'am_onyx*0.6+bm_lewis*0.4', pitch: 0.95, record: R('05/11/1908', 'Dr. M. Teague', 'Ruth Hollis (sister)', 'VH-1190', 'a burn on the chin', 'Porter, Ward A. Signed off sick 14 Oct.') },
  { id: 'mae', name: 'Mae Calder', female: true, age: 41, voice: 'bf_emma*0.7+af_sky*0.3', record: R('30/01/1922', 'Dr. Hanne Sorley', 'Daniel Calder (son)', 'VH-5531', 'a freckle under the left eye', 'Next of kin deceased, 1958, aged 6.') },
  { id: 'penhale', name: 'Father Aldous Penhale', female: false, age: 58, voice: 'bm_lewis*0.6+am_michael*0.4', record: R('12/12/1905', 'Dr. Orrin Vale', "St. Aldhelm's Parish", 'VH-0716', 'a burn on the chin') },
  { id: 'june', name: 'June Quill', female: true, age: 68, voice: 'bf_alice*0.5+af_aoede*0.5', record: R('08/05/1895', 'Dr. Orrin Vale', 'Walter Quill (husband)', 'VH-2108', 'a mole on the right cheek', 'DIED 1961. Walter Quill, husband, informed.', false) },
  { id: 'marsh', name: 'Dr. Lionel Marsh', female: false, age: 50, voice: 'am_michael*0.5+bm_george*0.5', record: R('21/04/1913', 'Dr. R. Lindqvist', 'Edith Marsh (wife)', 'VH-3349', 'a chipped front tooth', 'Consultant. Not on duty tonight.') },
  { id: 'gus', name: 'Augustus Brennan', female: false, age: 36, voice: 'am_fenrir*0.6+bm_daniel*0.4', record: R('18/07/1927', 'Dr. Colm Rafferty', 'Frank Brennan (brother)', 'VH-6620', 'a crooked nose, healed badly') },
  { id: 'edie', name: 'Edith Marsh', female: true, age: 48, voice: 'bf_isabella*0.5+af_sarah*0.5', record: R('02/10/1915', 'Dr. R. Lindqvist', 'Lionel Marsh (husband)', 'VH-3350', 'a scar over the left brow') },

  // ---------------------------------------------------------------- night 2
  { id: 'bernard', name: 'Bernard Fitch', female: false, age: 48, voice: 'am_puck*0.5+bm_fable*0.5', record: R('29/02/1916', 'Dr. M. Teague', 'Marjorie Fitch (sister)', 'VH-7781', 'a mole on the right cheek', 'Sister Marjorie Fitch: deceased, 1959.') },
  { id: 'nell', name: 'Nell Ashby', female: true, age: 19, voice: 'af_sky*0.6+bf_lily*0.4', record: R('06/08/1944', 'Dr. Colm Rafferty', 'Thomas Ashby (father)', 'VH-8102', 'a freckle under the left eye') },
  { id: 'ivor', name: 'Ivor Pugh', female: false, age: 52, voice: 'am_santa*0.5+bm_lewis*0.5', record: R('16/03/1911', 'Dr. M. Teague', 'Glenys Pugh (wife)', 'VH-2290', 'a crooked nose, healed badly') },
  { id: 'hester', name: 'Hester Bloom', female: true, age: 81, voice: 'bf_alice*0.6+af_river*0.4', pitch: 0.94, record: R('24/12/1882', 'Dr. Hanne Sorley', 'Arthur Bloom (nephew)', 'VH-0440', 'a freckle under the left eye', 'Blind since 1931.') },
  { id: 'danny', name: 'Daniel Calder', female: false, age: 6, voice: 'af_sky*0.8+bf_lily*0.2', pitch: 1.16, record: R('11/05/1952', 'Dr. Hanne Sorley', 'Mae Calder (mother)', 'VH-5532', 'a gap between the front teeth', 'DIED 1958, AGED 6. Mother informed.', false) },
  { id: 'rosa', name: 'Rosa Ferreira', female: true, age: 34, voice: 'af_jessica*0.6+bf_lily*0.4', record: R('17/01/1929', 'Dr. R. Lindqvist', 'Paulo Ferreira (husband)', 'VH-9014', 'a mole on the right cheek', "Agency nurse, St. Bride's.") },
  { id: 'abara', name: 'Dr. Ines Abara', female: true, age: 46, voice: 'af_kore*0.6+bf_emma*0.4', record: R('01/03/1917', 'Board of Governors', 'None on file', 'STAFF-12', 'a scar over the left brow', 'Consultant, Ward B. Memory programme.') },
  { id: 'voss', name: 'Cyril Voss', female: false, age: 44, voice: 'am_eric*0.6+bm_daniel*0.4', record: R('07/07/1919', "Matron's Office", 'Agnes Voss (wife)', 'STAFF-19', 'a chipped front tooth', 'Night porter, Ward A.') },

  // ---------------------------------------------------------------- night 3
  { id: 'thorne', name: 'Albert Thorne', female: false, age: 39, voice: 'am_adam*0.6+bm_george*0.4', record: R('22/09/1924', 'County Ambulance', 'Lily Thorne (wife)', 'AMB-31', 'a burn on the chin', 'Ambulance driver.') },
  { id: 'winifred', name: 'Winifred Gaunt', female: true, age: 77, voice: 'bf_alice*0.5+af_heart*0.5', pitch: 0.93, record: R('13/04/1886', 'Dr. Orrin Vale', 'Harold Gaunt (son)', 'VH-1301', 'a mole on the right cheek', 'Confused about the date. Believes it is 1940.') },
  { id: 'crane', name: 'Oswin Crane', female: false, age: 45, voice: 'bm_fable*0.5+am_echo*0.5', record: R('19/10/1918', 'Dr. R. Lindqvist', 'Mabel Crane (wife)', 'VH-4471', 'a scar over the left brow', 'Schoolmaster.') },
  { id: 'dray', name: 'PC Ambrose Dray', female: false, age: 33, voice: 'am_liam*0.5+bm_lewis*0.5', record: R('04/12/1929', 'County Constabulary', 'Ellen Dray (wife)', 'PC-212', 'a crooked nose, healed badly', 'Police constable.') },
  { id: 'vale', name: 'Dr. Orrin Vale', female: false, age: 63, voice: 'bm_george*0.5+am_onyx*0.5', record: R('28/08/1900', 'Board of Governors', 'None on file', 'STAFF-15', 'a chipped front tooth', 'General practitioner. REPORTED MISSING 16 OCT.', true) },
  { id: 'lisle', name: 'Philippa Lisle', female: true, age: 23, voice: 'af_aoede*0.6+bf_lily*0.4', record: R('15/06/1940', 'Dr. Colm Rafferty', 'Percival Lisle (fiance)', 'VH-6650', 'a gap between the front teeth') },
  { id: 'odette', name: 'Odette Sable', female: true, age: 37, voice: 'af_river*0.6+bf_isabella*0.4', record: R('31/03/1926', 'Dr. Hanne Sorley', 'Jean Sable (brother)', 'VH-3377', 'a scar over the left brow') },
  { id: 'fenwick', name: 'Gideon Fenwick', female: false, age: 66, voice: 'am_echo*0.6+bm_george*0.4', pitch: 0.95, record: R('02/02/1897', 'Dr. M. Teague', 'Mabel Fenwick (daughter)', 'VH-5120', 'a notched right ear') },

  // ---------------------------------------------------------------- night 4
  { id: 'hargrave', name: 'Rupert Hargrave', female: false, age: 41, voice: 'am_michael*0.6+bm_fable*0.4', record: R('10/10/1922', 'Dr. Ines Abara', 'Cecily Hargrave (wife)', 'VH-2211', 'a mole on the right cheek') },
  { id: 'corbin', name: 'Barnaby Corbin', female: false, age: 58, voice: 'bm_daniel*0.5+am_adam*0.5', pitch: 0.95, record: R('25/05/1905', 'Dr. M. Teague', 'Nora Corbin (wife)', 'VH-0612', 'a gap between the front teeth', 'Milkman. Delivers to the kitchens.') },
  { id: 'liesl', name: 'Liesl Kessler', female: true, age: 17, voice: 'af_nova*0.6+bf_lily*0.4', pitch: 1.03, record: R('09/06/1934', 'Dr. Ines Abara', 'Greta Kessler (mother, on staff)', 'VH-0151', 'a freckle under the left eye', 'DIED 1951, WARD B. Mother informed.', false) },
  { id: 'imelda', name: 'Imelda Sable', female: true, age: 55, voice: 'af_heart*0.5+bf_emma*0.5', record: R('20/11/1908', "Matron's Office", 'Jean Sable (son)', 'STAFF-22', 'a burn on the chin', 'Night cleaner.') },
  { id: 'mabel', name: 'Mabel Fenwick', female: true, age: 32, voice: 'bf_lily*0.6+af_jessica*0.4', record: R('08/08/1931', 'Dr. M. Teague', 'Gideon Fenwick (father)', 'VH-5121', 'a mole on the right cheek') },
  { id: 'percy', name: 'Percival Lisle', female: false, age: 27, voice: 'am_liam*0.6+bm_daniel*0.4', record: R('01/01/1936', 'Dr. Colm Rafferty', 'Philippa Lisle (fiancee)', 'VH-6651', 'a chipped front tooth', 'Admitted 12 Oct. Memory programme.') },

  // ---------------------------------------------------------------- night 5
  { id: 'maddox', name: 'Gideon Maddox', female: false, age: 60, voice: 'am_onyx*0.5+am_santa*0.5', pitch: 0.92, record: R('14/01/1903', 'Dr. Orrin Vale', 'None living', 'VH-0099', 'a crooked nose, healed badly', 'Groundsman and gravedigger, St. Aldhelm\'s.') },
  { id: 'halloway', name: 'Agnes Halloway', female: true, age: 50, voice: 'bf_emma*0.5+af_nicole*0.5', record: R('23/07/1913', 'Dr. Hanne Sorley', 'None on file', 'VH-7340', 'a scar over the left brow', 'Midwife.') },
  { id: 'lionel', name: 'Lionel Marsh', female: false, age: 50, voice: 'am_michael*0.5+bm_george*0.5', pitch: 0.97, record: R('21/04/1913', 'Dr. R. Lindqvist', 'Edith Marsh (wife)', 'VH-3349', 'a chipped front tooth', 'MISSING SINCE 15 OCT. Wife reports him.') },
  { id: 'clem', name: 'Clement Ashby', female: false, age: 49, voice: 'am_adam*0.5+bm_lewis*0.5', record: R('03/03/1914', 'Dr. Colm Rafferty', 'Nell Ashby (daughter)', 'VH-8103', 'a burn on the chin', 'Signalman.') },
];

export const PERSON_BY_ID: Record<string, Person> = Object.fromEntries(PERSONS.map((p) => [p.id, p]));

export function recordOf(id: string): RegistryEntry {
  const p = PERSON_BY_ID[id];
  return { id: `C_${p.id}`, name: p.name, ...p.record };
}
