// Free camera views of the map with the fog thinned. node tools/look-map.mjs <outdir> '{"name":[[cam],[target],fov]}'. Headless software GL.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? '.work';
const shots = JSON.parse(process.argv[3]);
const port = 4187;
const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true, cwd: process.cwd() });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${port}/?seed=3&autostart`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => {
  const g = window.__game; g.running = false; g.player.update = () => {};
  g.env.scene.fog.density = 0.0001;
  for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
});
for (const [name, [cam, tgt, fov]] of Object.entries(shots)) {
  await page.evaluate(([cam, tgt, fov]) => { const c = window.__game.player.camera; c.position.set(...cam); c.fov = fov; c.updateProjectionMatrix(); c.lookAt(...tgt); }, [cam, tgt, fov]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/map-${name}.png` });
}
await browser.close(); process.kill(-srv.pid);
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
