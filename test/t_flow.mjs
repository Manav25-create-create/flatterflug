// Ablauf-Test im Browser: Level spielen (Bot, unverwundbar), Boss besiegen, Übergang, Checkpoint-Neustart mit Rohren dahinter,
// Bot-Spule, Bildformat, Fähigkeiten. Bricht bei Seitenfehlern ab.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
import path from 'path';
const [vw, vh] = (process.argv[2] || '800x600').split('x').map(Number);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + path.resolve('out/test.html')); await page.waitForFunction(() => window.__ff); await page.waitForTimeout(200);
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FEHLER:', n, JSON.stringify(info)); } };
const run = code => page.evaluate(c => window.__ff.run(c), code);
// Bot-Schritt mit Rendering alle 4 Frames (findet Zeichenfehler)
await run(`window.__bot = (() => { const hist = []; let lastFlap = -100, target = 270, n = 0;
  return (frames, mode) => { for (let i = 0; i < frames; i++) { const y = birdCY();
    target = BOSS_STATES.has(game.state) ? bossTarget(y) : pipeTarget(target); botMem.f = n; botMem.lastFlap = lastFlap;
    hist.push({ f: n, y, vy: bird.vy, target }); if (hist.length > 12) hist.shift();
    const o = hist.length > 6 ? hist[hist.length - 7] : null; if (o && o.f > lastFlap && o.vy >= 0 && o.y > o.target) { onPress({ x: W / 2, y: 300 }, 'touch'); lastFlap = n; }
    update(); if (n % 4 === 0) render(1); n++; } }; })(); 'ok'`);

// 1. Level 1 komplett: Rohre, Boss, Übergang in Level 2
await run(`window.__go = () => { for (let i = 0; i < 20; i++) update(); onPress({ x: W / 2, y: 300 }, 'touch'); }; progress.open[0] = true; startFromMenu(0); SIM.god = true; __go(); 'ok'`);
let st = null;
for (let k = 0; k < 200; k++) { await page.evaluate(() => window.__bot(100)); st = await run(`game.state + '|' + game.level + '|' + game.score`); if (st.startsWith('BOSS_DEFEATED')) break; }
check('Level 1 bis Bosssieg', st.startsWith('BOSS_DEFEATED|0|10'), st);
await page.evaluate(() => window.__ff.run("game.t = 60; continueAfterBoss(); 'ok'"));
for (let k = 0; k < 4; k++) await page.evaluate(() => window.__bot(60));
st = await run(`game.state + '|' + game.level + '|' + game.score + '|' + progress.beaten[0] + '|' + progress.open[1]`);
check('Übergang in Level 2, Punkte bei 0', /^(LEVEL_INTRO|PLAYING)\|1\|0\|true\|true$/.test(st), st);

// 2. Checkpoint: Level 10 bis nach dem Checkpoint, Tod, Neustart am Checkpoint mit Rohr dahinter
await run(`SIM.god = false; progress.open[9] = true; settings.difficulty = 'mittel'; startFromMenu(9); __go(); SIM.god = true; 'ok'`);
for (let k = 0; k < 100; k++) { await page.evaluate(() => window.__bot(50)); const p = await run('game.pipesPassed'); if (p >= 16) break; }
const cp = await run(`JSON.stringify(game.checkpoint)`);
await run(`SIM.god = false; bird.inv = 0; abil.extra = false; killBird('Test'); game.t = 999; 'ok'`);
await run(`startLevel(game.level, 'checkpoint'); 'ok'`);
st = await run(`JSON.stringify({ s: game.state, start: game.pipesStart, behind: pipes.filter(p => p.passed && pipeX(p) + PW_ < birdWorldX()).length, hold: game.introHold, ahead: pipes.some(p => !p.passed) ? Math.round(pipeX(pipes.find(p => !p.passed)) - birdWorldX()) : -1 })`);
const S = JSON.parse(st);
check('Checkpoint gesetzt', cp && JSON.parse(cp).pipes === 14, cp);
check('Neustart am Checkpoint mit Rohr dahinter', S.s === 'LEVEL_INTRO' && S.start === 14 && S.behind >= 1 && S.hold && S.ahead > 200, S);
await page.waitForTimeout(50);
await run(`render(1); 'ok'`);

// 3. Bot-Spule in Level 13, Start beim Boss
// Passwort schaltet alles frei; die Spule kommt erst über die Pause
st = await run(`progress.open.fill(false); progress.open[0] = true; progress.bot.fill(false); const r = tryCode(12, 'Bot'); r.ok + '|' + progress.open.every(Boolean) + '|' + progress.bot.every(Boolean)`);
check('Passwort Bot: alle Level frei', st === 'true|true|true', st);
await run(`startFromMenu(12); 'ok'`);
st = await run(`game.state`);
check('Kein automatisches Spulen', st === 'LEVEL_INTRO', st);
st = await run(`setPaused(true); const b = pauseButtons().map(b => b.id).join(','); const sb = pauseButtons().find(b => b.id === 'scrub'); onPress({ x: sb.x + 10, y: sb.y + 10 }, 'mouse'); b + '|' + game.state`);
check('Pause: Spulen zwischen Weiter und Musik', st === 'resume,scrub,music,menu|SCRUB', st);
await run(`scrub.target = scrub.n - 1; 'ok'`);
for (let k = 0; k < 8; k++) await run(`update(); render(1); 'ok'`);
await run(`scrub.cur = scrub.target; startFromScrub(); 'ok'`);
st = await run(`game.state + '|' + game.waitTap + '|' + (boss ? boss.need : -1)`);
check('Spule: Start beim Boss', st === 'BOSS_INTRO|true|10', st);

// 3b. Spule am Handy: gezeichneter Startknopf muss die Tippfläche sein, Altstand mit Bot nur für ein Level zeigt die Option trotzdem
st = await run(`progress.bot.fill(false); progress.bot[2] = true; startFromMenu(5); for (let i = 0; i < 30; i++) update(); beginPlay(); setPaused(true); const ok = pauseButtons().some(b => b.id === 'scrub'); progress.bot.fill(true); ok`);
check('Spule im Pausemenü auch bei altem Bot-Stand', st === true, st);
st = await run(`const sb = pauseButtons().find(b => b.id === 'scrub'); onPress({ x: sb.x + 10, y: sb.y + 10 }, 'mouse'); scrub.target = scrub.cur = scrub.pass[3] + 1; update();
  let drawn = null; const orig = button; button = (r, t, ...a) => { if (t === 'Hier starten') drawn = { ...r }; return orig(r, t, ...a); };
  try { render(1); } finally { button = orig; }
  onPress({ x: drawn.x + drawn.w / 2, y: drawn.y + drawn.h / 2 }, 'touch'); game.state + '|' + game.pipesPassed`);
check('Spule: Tipp auf gezeichneten Knopf startet', /^LEVEL_INTRO\|4$/.test(String(st)), st);

// 3c. Spule auch in Level 20 (50 Rohre, danach Bossfinale)
st = await run(`progress.open.fill(true); progress.bot.fill(true); startFromMenu(19); for (let i = 0; i < 30; i++) update(); beginPlay(); setPaused(true); const sb = pauseButtons().find(b => b.id === 'scrub'); onPress({ x: sb.x + 10, y: sb.y + 10 }, 'mouse');
  const a = game.state + '|' + scrub.pass.length; scrub.target = scrub.cur = scrub.n - 1; update(); startFromScrub(); a + '|' + game.state + '|' + (game.rush && game.rush.i)`);
check('Spule in Level 20 bis zum Bossfinale', st === 'SCRUB|50|BOSS_INTRO|0', st);

// 4. Fähigkeiten: Zeitlupe bremst Welt, nicht Vogel; schlechte Kugeln wirken
await run(`progress.open[14] = true; startFromMenu(14); beginPlay(); 'ok'`);
st = await run(`applyPickup('SLOW_MO'); for (let i = 0; i < 30; i++) update(); const sx0 = game.scroll; bird.vy = 0; const vy0 = bird.vy; update(); JSON.stringify({ ds: +(game.scroll - sx0).toFixed(2), dvy: +(bird.vy - vy0).toFixed(3), tf: abil.tf })`);
let J = JSON.parse(st);
check('Zeitlupe: Welt langsamer', J.ds < 2.5 * 0.7, J);
check('Zeitlupe: Vogel normale Schwerkraft', Math.abs(J.dvy - PHYS_G()) < 0.01, J);
function PHYS_G() { return 0.45; }
st = await run(`SIM.god = true; resetAbilities(); applyPickup('RIESE'); applyPickup('BLEI'); applyPickup('TEMPO'); for (let i = 0; i < 40; i++) { bird.y = 250; bird.vy = 0; update(); } JSON.stringify({ s: birdScale(), g: gravityFactor(), sf: +abil.sf.toFixed(2), bad: abil.bad })`);
J = JSON.parse(st);
check('Schlechte Kugeln wirken', J.s > 1.3 && J.g > 1.2 && J.sf > 1.2, J);
st = await run(`for (let i = 0; i < 300; i++) { bird.y = 250; bird.vy = 0; update(); } SIM.god = false; JSON.stringify({ state: game.state, s: birdScale(), g: gravityFactor(), sf: +abil.sf.toFixed(2) })`);
J = JSON.parse(st);
check('Nach 5 s vorbei', J.state !== 'GAME_OVER' && J.s === 1 && J.g === 1 && J.sf === 1, J);

// 5. Bildformat wechseln
st = await run(`settings.format = 'hoch'; applyFormat(); const a = W; settings.format = 'auto'; applyFormat(); a + '|' + W`);
check('Hochformat schmal', +st.split('|')[0] <= 450, st);

// 6. Alle Level einmal anspielen (je 400 Frames mit Bild), Boss jedes Levels kurz rendern
for (let li = 0; li < 20; li++) {
  await run(`SIM.god = true; progress.open[${li}] = true; progress.bot[${li}] = false; startFromMenu(${li}); __go(); 'ok'`);
  await page.evaluate(() => window.__bot(400));
  await run(`simStartBoss(${li}); SIM.on = false; for (let i = 0; i < 300; i++) { update(); if (i % 5 === 0) render(1); } 'ok'`);
}
await run(`SIM.god = false; goMenu(); render(1); openLevelSelect(); for (let i = 0; i < 60; i++) { update(); render(1); } 'ok'`);
check('Keine Seitenfehler', errs.length === 0, errs.slice(0, 5));
console.log(`${vw}x${vh}: ${pass} bestanden, ${fail} fehlgeschlagen`);
await browser.close();
