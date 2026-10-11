// Round 6 review renders: title, shift card, the opening turn, Pell's tutorial, the close-up, under the desk, the passage
// and its dolly zoom, the vending machine, staff in person, the fakes coming apart, the end of the demo, the notes panel.
// node tools/look-round6.mjs <outdir> [only,these]   Headless software GL (SwiftShader): a layout and content check, not a frame rate check.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const only = process.argv[3]?.split(',');
const want = (n) => !only || only.includes(n);
const port = 4193;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const open = async (q, w = 1280, h = 720) => {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://localhost:${port}/${q}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__game, null, { timeout: 90000 });
  await p.waitForFunction(() => window.__game.view.humanReady, null, { timeout: 90000 }).catch(() => console.log('bodies did not load'));
  return p;
};
const shot = async (p, name) => {
  await p.screenshot({ path: `${out}/r6-${name}.png` });
  console.log('shot', name);
};
// run the sim forward quickly, deciding anyone who is not who we want
const advance = (p, cond, decide = true) =>
  p.evaluate(([c, d]) => {
    const g = window.__game;
    const f = new Function('s', 'g', `return ${c}`);
    for (let i = 0; i < 8000; i++) {
      if (f(g.sim.state, g)) return i;
      g.sim.tick(0.25);
      const s = g.sim.state;
      if (d && s.current && s.phase === 'present' && !f(s, g) && s.phaseTime > 0.5) g.sim.verdict(s.current.truth === 'human' ? 'admit' : 'contain');
      if (!s.powerOn) { g.sim.setZone('breaker'); g.sim.restorePower(); g.sim.setZone('booth'); }
    }
    return -1;
  }, [cond, decide]);

try {
  // ---- title, shift card, opening turn
  if (want('title')) {
    const p = await open('?seed=3');
    await p.waitForTimeout(1500);
    await shot(p, 'title');
    await p.click('button[data-begin]');
    await p.waitForTimeout(800);
    await shot(p, 'shiftcard');
    await p.click('button[data-begin]');
    await p.waitForTimeout(3500);
    await shot(p, 'orbit');
    await p.close();
  }

  // ---- Pell's tutorial at the glass, the close-up, under the desk, then the passage
  if (want('tutorial')) {
    const p = await open('?seed=3&autostart&night=1');
    await advance(p, "s.phase==='present' && s.current && s.current.tutorial", false);
    // let the tutorial reach its first step
    await p.evaluate(() => { const g = window.__game; g.tutorial.wait = 0.01; g.talkUntil = 0; });
    await p.waitForTimeout(5000);
    await shot(p, 'tutorial');
    await p.evaluate(() => { for (let i = 0; i < 30; i++) window.__game.hud.logLine(i % 2 ? 'a' : 'q', i % 2 ? '"A long answer from the visitor, to fill the notes card and test that it scrolls."' : 'Name for the ledger?'); window.__game.hud.subtitle('Orderly Pell', 'Subtitles must stay clear of the notes and the buttons, whatever is on the left.', 20000); });
    await p.waitForTimeout(1500);
    await shot(p, 'notes');
    await p.keyboard.press('KeyX');
    await p.waitForTimeout(4000);
    await shot(p, 'closeup');
    await p.keyboard.press('KeyX');
    await p.waitForTimeout(1500);
    await p.keyboard.press('KeyC');
    await p.waitForTimeout(3500);
    await shot(p, 'underdesk');
    await p.keyboard.press('KeyC');
    await p.waitForTimeout(1500);
    // let him in, and jump him along the passage to just before the window behind the chair
    await p.evaluate(() => { const g = window.__game; g.tutorial.active = false; g.sim.verdict('admit'); });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { const v = window.__game.view; v.pathSeg = 3; v.pathT = 0.92; });
    await p.waitForFunction(() => window.__game.view.atBack, null, { timeout: 60000 }).catch(() => console.log('never reached the back window'));
    await p.waitForTimeout(1600);
    await shot(p, 'vertigo');
    await p.waitForTimeout(2600);
    await shot(p, 'vertigo2');
    await p.close();
  }

  // ---- the vending machine and the hall, standing up
  if (want('vend')) {
    const p = await open('?seed=3&autostart&night=5');
    await p.evaluate(() => { const g = window.__game; g.sim.state.tokens = 6; g.drawVendFront(); g.player.stand(); g.hud.setMode(false); g.player.rig.body.setTranslation({ x: 0.1, y: 0.86, z: 0.5 }, true); g.player.yaw = Math.PI * 0.82; g.player.pitch = -0.1; });
    await p.waitForTimeout(3000);
    await shot(p, 'vendfront');
    await p.evaluate(() => window.__game.openVend());
    await p.waitForTimeout(800);
    await shot(p, 'vendmenu');
    await p.evaluate(() => window.__game.closeVend());
    await p.evaluate(() => { const g = window.__game; g.player.rig.body.setTranslation({ x: 0.0, y: 0.86, z: -0.6 }, true); g.player.yaw = 0.0; g.player.pitch = -0.02; });
    await p.waitForTimeout(3000);
    await shot(p, 'hall');
    await p.close();
  }

  // ---- staff in person at the back window
  if (want('staff')) {
    const p = await open('?seed=3&autostart&night=3');
    await p.evaluate(() => { const g = window.__game; g.showStaff('imogen', g.env.annex.backSpot, 'back', []); g.staffPhase = 'present'; g.staffView.t = 9; g.staffView.group.position.copy(g.env.annex.backSpot); g.staffView.group.rotation.y = Math.PI; });
    await p.waitForTimeout(6000);
    await p.evaluate(() => { const g = window.__game; g.camfx.vertigo(new (g.view.group.position.constructor)(0.25, 1.55, 2.45), 30, 0); });
    await p.waitForTimeout(3000);
    await shot(p, 'staff');
    await p.close();
  }

  // ---- the fakes coming apart: one of each kind, close up at the glass
  if (want('reveals')) {
    for (const [night, ids] of [[1, ['n1_walter2', 'n1_penhale', 'n1_june', 'n1_marsh', 'n1_mother']], [2, ['n2_danny', 'n2_hester2', 'n2_voss', 'n2_hollis']], [3, ['n3_crane', 'n3_odette']]]) {
      const p = await open(`?seed=3&autostart&night=${night}`, 800, 600);
      await p.evaluate(() => { const g = window.__game; g.running = false; g.camfx.update = () => {}; for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden'; });
      for (const id of ids) {
        await p.evaluate((id) => {
          const g = window.__game;
          const def = g.sim.def.visitors.find((v) => v.id === id);
          const pt = g.sim.makeVisitor(def);
          g.view.setPatient(pt, 4);
          g.view.group.position.copy(g.view.stand);
          g.view.revealing = 0;
        }, id);
        await p.waitForTimeout(2500);
        // frame the head wherever it is, so short and tall visitors are both in shot
        await p.evaluate(() => {
          const g = window.__game;
          const V = g.view.stand.constructor;
          const h = new V();
          g.view.head.getWorldPosition(h);
          g.player.override = { pos: new V(0.15, h.y + 0.05, -1.05), look: new V(h.x, h.y - 0.25, h.z), fov: 46, roll: 0, blend: 1 };
          g.player.applyOverride(0);
        });
        await p.waitForTimeout(1500);
        await p.screenshot({ path: `${out}/r6-fake-${id}-calm.png` });
        // headless runs at about a frame a second, so start the reveal already grown rather than waiting for it
        await p.evaluate(() => { const v = window.__game.view; v.revealing = 6; v.revealT = 6; v.revealAge = 1.4; v.stutterT = 0.2; });
        await p.waitForTimeout(3500);
        await p.evaluate(() => { const g = window.__game; g.player.applyOverride(0); });
        await p.screenshot({ path: `${out}/r6-fake-${id}-reveal.png` });
        console.log('shot', id);
      }
      await p.close();
    }
  }

  // ---- the end of the demo
  if (want('scare')) {
    const p = await open('?seed=3&autostart&night=1');
    // headless renders about a frame a second, so slow the page's timers down eight times to let frames keep up
    await p.evaluate(() => { const st = window.setTimeout.bind(window); window.setTimeout = (f, d, ...a) => st(f, (d ?? 0) * 8, ...a); const g = window.__game; g.running = false; g.ended = true; g.demoScare(() => {}); });
    await p.waitForTimeout(12000);
    await shot(p, 'scare1');
    await p.waitForTimeout(9000);
    await shot(p, 'scare2');
    await p.close();
  }
} finally {
  await browser.close();
  process.kill(-srv.pid);
}
console.log(errs.length ? 'ERRORS\n' + [...new Set(errs)].join('\n') : 'no page errors');
