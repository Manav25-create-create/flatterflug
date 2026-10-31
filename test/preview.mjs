// Vorschau eines Bioms ohne Spiel: node test/preview.mjs <Biomname> <Breite> [x1,x2,...] [pipes] [boss] [dpr=1]
// Schreibt test/out/prev_<Biom>_<Breite>_<x>.png und gibt die Malzeiten der Kulissen-Motive aus.
// Vorher immer: python3 build.py (baut out/test.html aus src/).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
import path from 'path';
const args = process.argv.slice(2);
const name = args[0], width = +(args[1] || 1000);
const xs = (args.find(a => /^[\d,]+$/.test(a) && a !== args[1]) || '0,3000,8000').split(',').map(Number);
const withPipes = args.includes('pipes'), withBoss = args.includes('boss');
const dprArg = args.find(a => a.startsWith('dpr=')), dpr = dprArg ? +dprArg.slice(4) : 1;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: width + 32, height: 600 }, deviceScaleFactor: dpr });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + path.resolve('out/test.html'));
await page.waitForFunction(() => window.__ff, null, { timeout: 20000 });
await page.waitForTimeout(300);
for (const X of xs) {
  const info = await page.evaluate(([name, X, withPipes, withBoss]) => {
    const f = window.__ff, LEVELS = f.get('LEVELS'), li = LEVELS.findIndex(L => L.name === name);
    if (li < 0) return { err: 'Unbekanntes Biom: ' + name + '. Vorhanden: ' + LEVELS.map(L => L.name).join(', ') };
    const times = [];
    if (!f.get('window.__ppWrapped')) {
      const orig = f.get('paintSceneSprite');
      f.set('paintSceneSprite', function (sc, st, it) { const t0 = performance.now(); const s = orig(sc, st, it); window.__pp.push([it.kind, performance.now() - t0]); return s; });
      window.__ppWrapped = true;
    }
    window.__pp = [];
    f.run(`
      game.level = ${li}; game.state = ${withBoss ? "'BOSS_FIGHT'" : "'PLAYING'"}; game.paused = false; game.t = 200;
      pipes = []; hazards = []; pickups = []; shots = []; boss = null; bossOut = null; particles = [];
      bird = makeBird(); bird.y = bird.py = 250;
      game.scroll = game.prevScroll = ${X}; game.wt = 0;
      if (${withPipes}) for (let k = 0; k < 8; k++) {
        const gy = 120 + ((k * 97) % 200);
        pipes.push({ type: 'pipe', idx: k, slot: ${X} + birdHomeX() + 140 + k * CONFIG.PIPE_SPACING, gap: LEVELS[${li}].pipeGap, gy0: gy, gapY: gy, pgapY: gy, amp: 0, period: 1, phase: 0, motion: 'sine',
          hamp: 0, hperiod: 1, hphase: 0, ox: 0, pox: 0, tamp: 0, tperiod: 1, tphase: 0, ang: 0, pang: 0, v: k % 2, passed: false });
      }
      if (${withBoss}) { boss = makeBoss(${li}); boss.x = boss.px = bossHomeX(); boss.y = boss.py = 200; boss.t = 120; }
      getLevelCache(${li});
      render(1);
    `);
    const pp = window.__pp, byKind = {};
    for (const [k, ms] of pp) { (byKind[k] = byKind[k] || []).push(ms); }
    const t0 = performance.now(); f.get('render')(1); const t1 = performance.now() - t0;
    return { li, W: f.get('W'), motifs: Object.fromEntries(Object.entries(byKind).map(([k, a]) => [k, { n: a.length, avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), max: +Math.max(...a).toFixed(1) }])), cachedFrameMs: +t1.toFixed(1) };
  }, [name, X, withPipes, withBoss]);
  if (info.err) { console.log(info.err); break; }
  const file = `test/out/prev_${name}_${width}_${X}${withPipes ? '_p' : ''}${withBoss ? '_b' : ''}.png`;
  await page.locator('#game').screenshot({ path: file });
  console.log(file, 'W=' + info.W, 'Bild (aus Cache) ' + info.cachedFrameMs + ' ms', JSON.stringify(info.motifs));
}
if (errs.length) console.log('FEHLER:\n' + errs.join('\n'));
await browser.close();
