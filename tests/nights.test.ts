import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/sim/simulation';
import { NIGHTS } from '../src/data/nights';
import { PERSON_BY_ID } from '../src/data/persons';
import { allSpokenLines } from '../src/data/voiceLines';
import { lineKey } from '../src/data/voiceStyle';

function present(sim: Simulation, max = 4000): void {
  for (let i = 0; i < max * 10; i++) {
    sim.tick(0.1);
    if (!sim.state.powerOn) {
      sim.setZone('breaker');
      sim.restorePower();
      sim.setZone('booth');
    }
    if (sim.state.current && sim.state.phase === 'present') return;
  }
  throw new Error('nobody came');
}

describe('six nights', () => {
  it('every night has a roster, people with records, and no dashes in what anyone says', () => {
    expect(NIGHTS.length).toBe(6);
    for (const n of NIGHTS) {
      expect(n.visitors.length).toBeGreaterThanOrEqual(9);
      expect(n.visitors.some((v) => v.fake)).toBe(true);
      expect(n.visitors.some((v) => !v.fake)).toBe(true);
      for (const v of n.visitors) expect(PERSON_BY_ID[v.person], v.id).toBeTruthy();
    }
    for (const s of allSpokenLines()) {
      const t = typeof s.line === 'string' ? s.line : s.line[0];
      expect(t, t).not.toMatch(/[–—]/);
    }
  });

  it('each night brings someone new', () => {
    const seen = new Set<string>();
    for (const n of NIGHTS) {
      const fresh = n.visitors.filter((v) => !seen.has(v.person));
      expect(fresh.length, `night ${n.n}`).toBeGreaterThanOrEqual(1);
      for (const v of n.visitors) seen.add(v.person);
    }
  });

  it('fakes get harder to spot: fewer tells as the nights go on', () => {
    const avg = (n: number): number => {
      const f = NIGHTS[n - 1].visitors.filter((v) => v.fake);
      return f.reduce((a, v) => a + (v.tells?.length ?? 0), 0) / f.length;
    };
    expect(avg(1)).toBeGreaterThan(avg(4));
    expect(avg(4)).toBeLessThanOrEqual(avg(2));
  });

  it('every spoken line has a stable recording key', () => {
    const keys = allSpokenLines().map((s) => lineKey(s.person, s.line));
    expect(new Set(keys).size).toBe(keys.length);
    expect(lineKey('walter', ['Hello.', 'calm'])).toBe(lineKey('walter', ['Hello.', 'calm']));
    expect(lineKey('walter', ['Hello.', 'calm'])).not.toBe(lineKey('walter', ['Hello.', 'warm']));
  });

  it('every night can be played from start to six', () => {
    for (const n of NIGHTS) {
      const sim = new Simulation(n.n * 7, { night: n.n });
      let ended = false;
      sim.bus.on('shiftEnded', () => (ended = true));
      for (let i = 0; i < 30000 && !ended; i++) {
        sim.tick(0.1);
        if (!sim.state.powerOn) {
          sim.setZone('breaker');
          sim.restorePower();
          sim.setZone('booth');
        }
        const c = sim.state.current;
        if (c && sim.state.phase === 'present') sim.verdict(c.truth === 'human' ? 'admit' : 'contain');
        if (sim.todoItem('count_dawn')?.shown) sim.completeTask('count_dawn');
      }
      expect(ended, `night ${n.n}`).toBe(true);
      expect(sim.state.score.ending, `night ${n.n}`).toBe('clean');
      expect(sim.state.slotIndex).toBe(n.visitors.length);
    }
  });
});

describe('no timer', () => {
  it('the clock cannot pass the next visitor while someone is still at the glass', () => {
    const sim = new Simulation(3);
    present(sim);
    expect(sim.state.current!.tutorial).toBe(true);
    for (let i = 0; i < 6000; i++) sim.tick(0.1); // ten minutes of real time, doing nothing
    expect(sim.state.minute).toBeLessThan(12);
    expect(sim.state.ended).toBe(false);
  });

  it('the night only ends once the roster is done', () => {
    const sim = new Simulation(3, { skipTutorial: true });
    for (let i = 0; i < 3000; i++) sim.tick(0.1);
    expect(sim.state.ended).toBe(false);
  });
});

describe('tokens and the vending machine', () => {
  it('a right call earns a token and the machine takes it', () => {
    const sim = new Simulation(3, { skipTutorial: true });
    present(sim);
    sim.verdict('admit'); // Walter is real
    expect(sim.state.tokens).toBe(1);
    expect(sim.vendStock()).toEqual(['cola', 'toffee']);
    expect(sim.buy('mint')).toBe(false); // not until night 2
    sim.state.sanity = 40;
    expect(sim.buy('cola')).toBe(true);
    expect(sim.state.sanity).toBe(70);
    expect(sim.state.tokens).toBe(0);
    expect(sim.buy('cola')).toBe(false);
  });

  it("Sister's Tonic makes the next decision for you, correctly", () => {
    const sim = new Simulation(3, { night: 5, tokens: 10 });
    expect(sim.buy('tonic')).toBe(true);
    let fake = null as null | boolean;
    for (let i = 0; i < 40000 && fake === null; i++) {
      sim.tick(0.1);
      const c = sim.state.current;
      if (c && sim.state.phase === 'present') {
        if (c.truth === 'understudy') fake = true;
        else sim.verdict('admit');
      }
    }
    // the tonic was used on the first visitor (a person), so buy another for the fake
    expect(sim.buy('tonic')).toBe(true);
    const before = sim.state.score.admittedUnderstudies;
    sim.verdict('admit');
    expect(sim.state.score.admittedUnderstudies).toBe(before);
  });

  it('sweet tea turns one death into a blackout', () => {
    const sim = new Simulation(3, { night: 6, tokens: 4 });
    expect(sim.buy('tea')).toBe(true);
    let saved = false;
    sim.bus.on('saved', () => (saved = true));
    sim.die('stalker');
    expect(saved).toBe(true);
    expect(sim.state.ended).toBe(false);
    sim.die('stalker');
    expect(sim.state.ended).toBe(true);
  });

  it('hollow mints name a real tell', () => {
    const sim = new Simulation(3, { night: 2, tokens: 5, skipTutorial: true });
    const hints: string[] = [];
    sim.bus.on('hint', ({ text }) => hints.push(text));
    expect(sim.buy('mint')).toBe(true);
    present(sim);
    expect(hints.length).toBe(1);
  });
});

describe('new tells', () => {
  it('a fake that answers ahead gives the answer to the next question', () => {
    const sim = new Simulation(3, { night: 3 });
    let crane = null as null | import('../src/sim/types').Patient;
    for (let i = 0; i < 40000 && !crane; i++) {
      sim.tick(0.1);
      if (!sim.state.powerOn) {
        sim.setZone('breaker');
        sim.restorePower();
        sim.setZone('booth');
      }
      const c = sim.state.current;
      if (c && sim.state.phase === 'present') {
        if (c.castId === 'crane') crane = c;
        else sim.verdict(c.truth === 'human' ? 'admit' : 'contain');
      }
    }
    expect(crane).not.toBeNull();
    const r = sim.ask('name')!;
    expect(r.text).toBe(crane!.answers.dob);
    expect(r.delay).toBeLessThan(0.2);
  });

  it('fakes stop showing no breath on night 5', () => {
    const s1 = new Simulation(3, { night: 1 });
    const s5 = new Simulation(3, { night: 5 });
    const firstFake = (sim: Simulation) => {
      for (let i = 0; i < 40000; i++) {
        sim.tick(0.1);
        if (!sim.state.powerOn) {
          sim.setZone('breaker');
          sim.restorePower();
          sim.setZone('booth');
        }
        const c = sim.state.current;
        if (c && sim.state.phase === 'present') {
          if (c.truth === 'understudy') return c;
          sim.verdict('admit');
        }
      }
      throw new Error('no fake');
    };
    const f1 = firstFake(s1);
    const f5 = firstFake(s5);
    expect(f1.tells).toContain('no_breath');
    expect(f1.breathes).toBe(false);
    expect(f5.breathes).toBe(true);
  });
});
