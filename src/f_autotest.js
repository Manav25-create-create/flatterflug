// ============================================================
// Automatischer Spielbarkeitstest: ?autotest=1 (bzw. #autotest im Artefakt).
// Ein einfacher Bot spielt jedes Level 50-mal (Rohrphase) und jeden Boss
// 50-mal, ohne Rendering, mit festem Zeitschritt und festem Zufall.
// Rohrphase: Er flappt, wenn die Vogelmitte unter der Mitte der nächsten
// Lücke liegt und er fällt, und reagiert dabei auf das, was er vor 6 Frames
// gesehen hat.
// Bosskampf: Er strebt zur freien Höhe mit dem größten Abstand zu allen
// kommenden Angriffen. Der Test schreibt nichts in den Speicher, spielt
// keinen Ton und verändert den Fortschritt nicht.
// ============================================================
const AT = { runs: 50, delay: 6, flapVy: 0, predict: 0, lead: 30, results: null, li: 0, phase: 'pipe', run: 0, done: false, active: false, started: 0, ms: 0, rows: null, savedRNG: null };
// Ziel: Die Level werden Schritt für Schritt schwerer. Rohrphase: 92 % in Level 1, pro Level 1,8 Punkte
// weniger (Level 20: 58 %), erlaubt sind 10 Punkte Abweichung (50 Läufe streuen um etwa 6 Punkte).
// Bosskampf: mindestens 60 % (der Bot plant seine Flugbahn und ist beim Ausweichen sehr stark).
const AT_TARGET = li => 92 - 1.8 * li, AT_BAND = 10, AT_BOSS_MIN = 60;

function isAutotest() {
  try {
    const s = String(window.location && window.location.search || ''), h = String(window.location && window.location.hash || '');
    return /[?&]autotest=1\b/.test(s) || /autotest/i.test(h);
  } catch (e) { return false; }
}

// ---------- Ein Lauf ----------
function simStartLevel(li) {
  game.level = li;
  game.checkpoint = null;
  pipes = []; hazards = []; pickups = []; shots = []; attacks = []; boss = null; bossOut = null; particles = [];
  ghostInfo.clear();
  game.pipesStart = 0; game.pipesSpawned = game.pipesPassed = 0;
  game.lastSlot = null; game.lastCenter = null; game.lastAmp = 0; game.lastHamp = 0;
  game.rush = null; game.introShort = false; game.free = { pipe: false, boss: false };
  game.wt = 0; game.updraft = 0; game.scroll = game.prevScroll = 0; game.paused = false; game.waitTap = false;
  game.dodges = 0; game.score = 0; game.flash = 0;
  wind.t = 0; wind.state = 'calm'; wind.speed = 1;
  game.introHold = false; game.keepLayout = false;
  bird = makeBird();
  resetAbilities(false);
  game.state = 'PLAYING';
  game.t = 0;
}
function simStartBoss(li) {
  simStartLevel(li);
  game.pipesPassed = game.pipesSpawned = pipesFor(li);
  // wie ein Mensch, der den Kampf an unterschiedlicher Stelle beginnt
  bird.y = bird.py = rand(170, 310);
  bird.vy = rand(-4, 3);
  beginBossIntro(false);
  game.waitTap = false;
}

// Zielhöhe in der Rohrphase: Mitte der nächsten sichtbaren Lücke
function pipeTarget(last) {
  const p = nextPipe();
  if (!p) return last;
  const sight = sightRadius();
  if (sight) {
    const dist = pipeX(p) - (birdWorldX() + CONFIG.BIRD_W / 2);
    const lit = hazards.some(h => h.type === 'light' && h.pipe === p);
    if (dist > sight * 0.85 && !lit) return last;
  }
  // Bewegte Lücken: dorthin zielen, wo die Lücke beim Durchflug sein wird, aber höchstens
  // AT.lead Frames vorausgedacht (wie ein Mensch, der die Pendelbewegung sieht)
  // Gekippte Paare drehen um die Lückenmitte: Beim Durchflug liegt die Mitte des schrägen Kanals im Mittel
  // genau dort, deshalb zielt der Bot auch hier auf die Lückenmitte.
  if (p.amp) {
    const tArr = (pipeX(p) - (birdWorldX() + CONFIG.BIRD_W)) / (CONFIG.SCROLL_SPEED * wind.speed);
    return pipeGapAt(p, game.wt + clamp(tArr, 10, AT.lead)) + p.gap0 / 2;
  }
  return pipeCenter(p);
}

// ---------- Bosskampf: Vorhersage der Angriffe an der Vogelspalte ----------
// fut[k]: gesperrte Höhenbereiche der Vogelmitte im k-ten kommenden Update. fut.dyn: Geschosse, die erst
// später starten und dabei auf die dann aktuelle Höhe des Vogels zielen (Zahnräder im Takt, gezielte
// Muster während der Vorwarnung); die rechnet simulateTarget für jede geplante Flugbahn einzeln durch.
const BOT_COL = () => [birdHomeX() - 3, birdHomeX() + CONFIG.BIRD_W + 3];
const BOT_MARGIN = 15;
// Wird das Geschoss in diesem Frame zum Rückpraller (wie in updateShots)?
function orbGone(p) {
  return p.y + p.r * 0.5 > GROUND_Y || p.x < -p.r - 6 || p.x > W + 90 || p.y < (p.grav > 0 || p.path ? -240 : -p.r - 20);
}
// Boss-x nach k Updates (updateBossIdle nähert ihn mit 10 % pro Frame der Heimposition)
const bossXAt = k => bossHomeX() + (boss.x - bossHomeX()) * Math.pow(0.9, k);
function predictThreats(steps) {
  const fut = [], [bx0, bx1] = BOT_COL(), m = BOT_MARGIN;
  fut.dyn = [];
  const add = (k, lo, hi) => { (fut[k] || (fut[k] = [])).push([lo, hi]); };
  const inCol = p => p.x + p.r > bx0 && p.x - p.r < bx1;
  for (const s of shots) {
    if (s.ghost) continue;                       // Rückpraller treffen den Vogel nicht
    if (s.type === 'orb' || s.type === 'gear') {
      if (s.orbit) {
        const c = s.orbit;
        let x = c.x, y = c.y, age = c.age, ang = s.ang;
        for (let k = 1; k <= steps; k++) {
          x += c.vx; y += c.vy; age++; ang += SPIRAL.spin;
          const rad = spiralRadius(age), ox = x + Math.cos(ang) * rad, oy = y + Math.sin(ang) * rad;
          if (ox + s.r > bx0 && ox - s.r < bx1) add(k, oy - s.r - m, oy + s.r + m);
        }
        continue;
      }
      // dieselbe Bewegung wie im Spiel (orbMove/orbBreak), samt Zerfall in Teile
      let pcs = [orbClone(s)];
      for (let k = 1; k <= steps && pcs.length; k++) {
        const next = [];
        for (const p of pcs) {
          p.t++;
          orbMove(p);
          const br = orbBreak(p);
          if (br) {
            for (const dv of br.dvs) {
              const q = { x: p.x, y: p.y, vx: p.vx, vy: p.vy + dv, r: br.r, grav: 0, t: 0 };
              if (inCol(q)) add(k, q.y - q.r - m, q.y + q.r + m);
              next.push(q);
            }
            continue;
          }
          if (orbGone(p)) continue;
          if (inCol(p)) add(k, p.y - p.r - m, p.y + p.r + m);
          next.push(p);
        }
        pcs = next;
      }
    } else if (s.type === 'wave' || s.type === 'rain') {
      let x = s.x, gy = s.gapY;
      for (let k = 1; k <= steps; k++) {
        x += s.vx;
        if (s.type === 'rain') gy += s.drift;
        if (x < bx1 && x + s.w > bx0) { add(k, -100, gy - s.gapH / 2 + m); add(k, gy + s.gapH / 2 - m, H + 100); }
      }
    } else if (s.type === 'column') {
      for (let k = 1; k <= steps; k++) { const tt = s.t + k; if (tt >= s.warn - 1 && tt < s.warn + s.active + 1) add(k, s.y0 - m, s.y1 + m); }
    } else if (s.type === 'laser') {
      const l = laserLine(s), ya = l.oy + (bx0 - l.ox) * l.slope, yb = l.oy + (bx1 - l.ox) * l.slope;
      for (let k = 1; k <= steps; k++) { const tt = s.t + k; if (tt >= s.warn - 1 && tt < s.warn + s.active + 1) add(k, Math.min(ya, yb) - s.thick / 2 - m, Math.max(ya, yb) + s.thick / 2 + m); }
    }
  }
  if (boss && game.state === 'BOSS_FIGHT') {
    if (boss.queue.length) queueThreats(fut, steps, bx0, bx1, m);
    if (boss.plan) telegraphThreats(fut, steps, bx0, bx1, m);
  }
  return fut;
}

// Wand, die im Update k0 bei x0 startet und dort schon den ersten Schritt fliegt (wie fireAttack + updateShots)
function wallThreat(fut, steps, bx0, bx1, m, k0, x0, vx, gy, drift, w) {
  const half = CONFIG.WAVE_GAP / 2;
  let x = x0, g = gy;
  for (let k = k0; k <= steps; k++) {
    x += vx; g += drift;
    if (k >= 1 && x < bx1 && x + w > bx0) { (fut[k] || (fut[k] = [])).push([-100, g - half + m], [g + half - m, H + 100]); }
  }
}

// Wartende Teile des laufenden Angriffs: q.wait ist das Update, in dem sie starten
function queueThreats(fut, steps, bx0, bx1, m) {
  for (const q of boss.queue) {
    if (q.kind === 'wall') wallThreat(fut, steps, bx0, bx1, m, q.wait, bossXAt(q.wait) - 20, -waveSpeedNow(), q.gapY, 0, 30);
    else if (q.kind === 'tick') fut.dyn.push({ k: q.wait, make: (mm, ty) => [tickGear(mm, ty, 0)] });
  }
}

// Was die Vorwarnung schon verrät (Bahnen, Lücken, Takt), plant der Bot wie ein Mensch mit ein.
// Der Angriff startet im Update delay.
function telegraphThreats(fut, steps, bx0, bx1, m) {
  const add = (k, lo, hi) => { if (k >= 1 && k <= steps) (fut[k] || (fut[k] = [])).push([lo, hi]); };
  const pat = currentPattern(), plan = boss.plan, delay = Math.max(1, attackCooldown() - boss.timer);
  const bxd = bossXAt(delay), mx = bxd + CONFIG.BOSS_MOUTH_DX, S = shotSpeed(), ws = waveSpeedNow();
  const wallAt = (k0, x0, vx, gy, drift, w) => wallThreat(fut, steps, bx0, bx1, m, k0, x0, vx, gy, drift, w);
  if (pat === 'salvo3' && plan.lanes) {
    let x = mx;
    for (let k = delay; k <= steps; k++) {
      x -= S;
      if (x + 13 > bx0 && x - 13 < bx1) for (const ly of plan.lanes) add(k, ly - 13 - m, ly + 13 + m);
    }
  } else if (pat === 'wave' && plan.gapY !== undefined) wallAt(delay, bxd - 20, -ws, plan.gapY, 0, 30);
  else if (pat === 'twinwave' && plan.g1 !== undefined) {
    wallAt(delay, bxd - 20, -ws, plan.g1, 0, 30);
    wallAt(delay + twinDelay(), bossXAt(delay + twinDelay()) - 20, -ws, plan.g2, 0, 30);
  } else if (pat === 'emberrain' && plan.gapY !== undefined) wallAt(delay, bxd - 16, -rainSpeed(), plan.gapY, plan.drift || 0.6, 46);
  else if (pat === 'petal') fut.dyn.push({ k: delay, make: (mm, ty) => [petalOrb(mm, ty, plan.dir, 0)] });
  else if (pat === 'zigzag') fut.dyn.push({ k: delay, make: (mm, ty) => [zigOrb(mm, ty, plan.dir, 0)] });
  else if (pat === 'bounce') fut.dyn.push({ k: delay, make: (mm, ty) => [bounceOrb(mm, ty, 0)] });
  else if (pat === 'converge') fut.dyn.push({ k: delay, make: (mm, ty) => convergeOrbs(mm, ty, 0) });
  else if (pat === 'ticktock') for (let i = 0; i < 3; i++) fut.dyn.push({ k: delay + i * TICK.gap, make: (mm, ty) => [tickGear(mm, ty, 0)] });
}

// Bosskampf: Der Bot rechnet für eine Handvoll Zielhöhen voraus, wie sein eigener verzögerter
// Flug dorthin verlaufen würde (inklusive der Flaps, die er schon beschlossen hat), und wählt die
// Höhe, auf der er den kommenden Angriffen am weitesten ausweicht. Alle 4 Frames neu geplant.
const botMem = { target: 270, next: 0, hist: [], f: 0, lastFlap: -100, sig: '' };
const BOT_TARGETS = [];
for (let y = 50; y <= GROUND_Y - 110; y += 26) BOT_TARGETS.push(y);
function simulateTarget(ystar, fut, steps) {
  const P = PHYS[game.level], D = AT.delay, half = CONFIG.BIRD_H / 2, hist = botMem.hist, f0 = botMem.f;
  let y = birdCY(), vy = bird.vy, lf = botMem.lastFlap, minClear = Infinity;
  const sim = [];
  // Später startende, gezielte Geschosse: Boss wie in updateBossIdle mitrechnen (Maul beim Abschuss),
  // Ziel ist die simulierte Höhe des Vogels im Abschuss-Update
  const dyn = fut.dyn && fut.dyn.length ? fut.dyn : null, live = [], [bx0, bx1] = BOT_COL(), m = BOT_MARGIN;
  let bt = boss ? boss.t : 0, byy = boss ? boss.y : 0, bxx = boss ? boss.x : 0;
  const home = bossHomeX();
  for (let k = 0; k < steps; k++) {
    const fk = f0 + k;
    sim.push({ f: fk, y, vy, target: ystar });
    let o = null;
    if (k - D >= 0) o = sim[k - D];
    else for (let i = hist.length - 1; i >= 0; i--) if (hist[i].f === fk - D) { o = hist[i]; break; }
    if (o && o.f > lf && o.vy >= 0 && o.y > o.target) { vy = P.FLAP_IMPULSE; lf = fk; }
    vy = Math.min(vy + P.GRAVITY, P.MAX_FALL_SPEED);
    y += vy;
    if (y - half < 0) { y = half; vy = CONFIG.CEILING_BOUNCE_VY; }
    if (y + half - 3 >= GROUND_Y) return { hit: k + 1, clear: -1 };
    const iv = fut[k + 1];
    if (iv) for (const [a, b] of iv) {
      if (y > a && y < b) return { hit: k + 1, clear: -1 };
      minClear = Math.min(minClear, y <= a ? a - y : y - b);
    }
    if (dyn) {
      bt++;
      const tg = clamp(y - CONFIG.BOSS_MOUTH_DY + Math.sin(bt * 0.025 + boss.seed) * 46, CONFIG.BOSS_Y_MIN, CONFIG.BOSS_Y_MAX);
      byy += clamp((tg - byy) * 0.035, -CONFIG.BOSS_Y_SPEED, CONFIG.BOSS_Y_SPEED);
      bxx += (home - bxx) * 0.1;
      for (const d of dyn) if (d.k === k + 1) for (const s of d.make({ x: bxx + CONFIG.BOSS_MOUTH_DX, y: byy + CONFIG.BOSS_MOUTH_DY }, y)) live.push(orbClone(s));
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.t++;
        orbMove(p);
        if (orbGone(p)) { live.splice(i, 1); continue; }
        if (p.x + p.r > bx0 && p.x - p.r < bx1) {
          const a = p.y - p.r - m, b = p.y + p.r + m;
          if (y > a && y < b) return { hit: k + 1, clear: -1 };
          minClear = Math.min(minClear, y <= a ? a - y : y - b);
        }
      }
    }
  }
  return { hit: -1, clear: minClear };
}
// Zusätzliche Zielhöhen: Mitten der freien Bereiche zwischen vorhergesagten Sperren (Lücken in Wänden
// und Vorhängen), wie ein Mensch, der auf die Mitte einer Lücke zielt
function gapTargets(fut, steps) {
  const out = [], lo = 40, hi = GROUND_Y - 60;
  for (let k = 2; k <= steps; k += 6) {
    const iv = fut[k];
    if (!iv || iv.length < 2) continue;
    const s = iv.map(a => [Math.max(lo, a[0]), Math.min(hi, a[1])]).filter(a => a[1] > a[0]).sort((a, b) => a[0] - b[0]);
    let top = lo;
    for (const [a, b] of s) {
      if (a - top > 30) { const c = Math.round((a + top) / 2 / 4) * 4; if (!out.some(v => Math.abs(v - c) < 10)) out.push(c); }
      top = Math.max(top, b);
    }
    if (out.length >= 8) break;
  }
  return out;
}
function bossTarget(cur) {
  // sofort neu planen, sobald ein Angriff hinzukommt oder sich aufteilt
  const sig = shots.length + ':' + attacks.map(a => a.id).join(',') + ':' + (boss && boss.plan ? boss.n : '-');
  if (sig !== botMem.sig) { botMem.sig = sig; botMem.next = 0; }
  if (--botMem.next > 0) return botMem.target;
  botMem.next = 4;
  const steps = 130, fut = predictThreats(steps);
  if (!fut.some(Boolean) && !fut.dyn.length) { botMem.target = clamp(lerp(cur, 270, 0.3), 110, 400); return botMem.target; }
  let best = botMem.target, bestScore = -Infinity;
  for (const y of BOT_TARGETS.concat([botMem.target], gapTargets(fut, steps))) {
    const r = simulateTarget(y, fut, steps);
    const sc = r.hit < 0 ? 100000 + Math.min(r.clear, 70) * 10 - Math.abs(y - botMem.target) * 0.5 : r.hit * 10;
    if (sc > bestScore) { bestScore = sc; best = y; }
  }
  botMem.target = best;
  return best;
}

// Bot spielt einen Lauf. kind: 'pipe' oder 'boss'. Ergebnis: ok, Frames, Ursache
function botRun(kind) {
  const hist = botMem.hist = [], D = AT.delay;
  let lastFlap = -100, f = 0, cause = '', ok = false, target = 270;
  SIM.onDeath = c => { cause = c; };
  const limit = kind === 'pipe' ? 30000 : 24000;
  while (f < limit) {
    const y = birdCY();
    botMem.f = f;
    botMem.lastFlap = lastFlap;
    target = kind === 'pipe' ? pipeTarget(target) : bossTarget(y);
    hist.push({ f, y, vy: bird.vy, target });
    if (hist.length > D + 6) hist.shift();
    // Reaktion auf den Stand von vor D Frames: unter der Zielhöhe und im Fallen
    const o = hist.length > D ? hist[hist.length - 1 - D] : null;
    if (o && o.f > lastFlap && o.vy >= AT.flapVy && o.y + o.vy * AT.predict > o.target) { flapBird(); lastFlap = f; }
    update();
    f++;
    if (game.state === 'GAME_OVER') break;
    if (kind === 'pipe' && BOSS_STATES.has(game.state)) { ok = true; break; }
    if (kind === 'boss' && game.state === 'BOSS_DEFEATED') { ok = true; break; }
  }
  if (!ok && !cause) cause = 'Zeitlimit';
  SIM.onDeath = null;
  return { ok, frames: f, cause };
}

function runOne(li, phase, run) {
  botMem.target = 270; botMem.next = 0; botMem.hist = []; botMem.f = 0; botMem.lastFlap = -100; botMem.sig = '';
  RNG = mulberry32((li + 1) * 7919 + run * 131 + (phase === 'boss' ? 50021 : 0));
  if (phase === 'pipe') simStartLevel(li); else simStartBoss(li);
  return botRun(phase);
}

// ---------- Steuerung, synchron (Tests) und in Häppchen (Seite) ----------
function newResults() {
  return LEVELS.map(() => ({ pipeOk: 0, pipeN: 0, bossOk: 0, bossN: 0, pipeFrames: 0, bossFrames: 0, causes: {} }));
}
function record(R, phase, r) {
  if (phase === 'pipe') { R.pipeN++; R.pipeFrames += r.frames; if (r.ok) R.pipeOk++; }
  else { R.bossN++; R.bossFrames += r.frames; if (r.ok) R.bossOk++; }
  if (!r.ok) { const k = r.cause + (phase === 'boss' ? ' (Boss)' : ''); R.causes[k] = (R.causes[k] || 0) + 1; }
}
function enterSim() {
  AT.savedRNG = RNG;
  AT.saved = { level: game.level, state: game.state };
  SIM.on = true;
  SIM.noAbilities = true;
}
function leaveSim() {
  SIM.on = false;
  SIM.noAbilities = false;
  SIM.onDeath = null;
  RNG = AT.savedRNG || Math.random;
}
// Für Tests ohne Seite: alle oder ausgewählte Level synchron durchrechnen
function runAutotestSync(opts) {
  opts = opts || {};
  const runs = opts.runs || AT.runs, levels = opts.levels || LEVELS.map((_, i) => i), res = newResults();
  enterSim();
  try {
    for (const li of levels) {
      if (opts.phases !== 'boss') for (let r = 0; r < runs; r++) record(res[li], 'pipe', runOne(li, 'pipe', r));
      if (opts.phases !== 'pipe') for (let r = 0; r < runs; r++) record(res[li], 'boss', runOne(li, 'boss', r));
    }
  } finally { leaveSim(); }
  return { res, rows: autotestRows(res, levels) };
}

function startAutotest() {
  enterSim();
  SIM.autotest = true;
  AT.results = newResults();
  AT.li = 0; AT.phase = 'pipe'; AT.run = 0; AT.done = false; AT.rows = null;
  AT.started = performance.now();
  game.state = 'AUTOTEST';
  setTimeout(autotestChunk, 60);
}
function autotestChunk() {
  if (!SIM.autotest) return;
  const t0 = performance.now();
  while (!AT.done && performance.now() - t0 < 30) {
    record(AT.results[AT.li], AT.phase, runOne(AT.li, AT.phase, AT.run));
    AT.run++;
    if (AT.run >= AT.runs) {
      AT.run = 0;
      if (AT.phase === 'pipe') AT.phase = 'boss';
      else { AT.phase = 'pipe'; AT.li++; if (AT.li >= LEVELS.length) AT.done = true; }
    }
  }
  if (AT.done) finishAutotest(); else setTimeout(autotestChunk, 0);
}
function finishAutotest() {
  AT.ms = performance.now() - AT.started;
  AT.rows = autotestRows(AT.results, LEVELS.map((_, i) => i));
  game.state = 'AUTOTEST';
  game.t = 0;
  try {
    console.log(`Flatterflug Autotest: ${AT.runs} Läufe pro Level und Boss, Breite ${W}. Ziel Rohrphase 92 % in Level 1, pro Level 1,8 Punkte weniger (±${AT_BAND}), Bosskampf ab ${AT_BOSS_MIN} %`);
    if (console.table) console.table(AT.rows.map(r => ({ Level: r.name, 'Rohre %': r.pipe, 'Boss %': r.boss, 'Gesamt %': r.total, 'Häufigste Ursache': r.cause, 'Dauer Rohre s': r.pipeSec, 'Dauer Boss s': r.bossSec, Bewertung: r.verdict })));
  } catch (e) { /* ohne Konsole */ }
}
// -1 zu schwer, 0 im Ziel, 1 zu leicht
function pipeVerdict(li, v) { return v === null ? 0 : v < AT_TARGET(li) - AT_BAND ? -1 : v > AT_TARGET(li) + AT_BAND ? 1 : 0; }
function bossVerdict(v) { return v === null ? 0 : v < AT_BOSS_MIN ? -1 : 0; }
function autotestRows(res, levels) {
  return levels.map(li => {
    const R = res[li];
    const pipe = R.pipeN ? Math.round(100 * R.pipeOk / R.pipeN) : null, bossP = R.bossN ? Math.round(100 * R.bossOk / R.bossN) : null;
    const total = pipe !== null && bossP !== null ? Math.round(pipe * bossP / 100) : null;
    let cause = '', cn = 0;
    for (const k in R.causes) if (R.causes[k] > cn) { cn = R.causes[k]; cause = k; }
    const pv = pipeVerdict(li, pipe), bv = bossVerdict(bossP);
    const verdict = pv < 0 || bv < 0 ? 'zu schwer' : pv > 0 ? 'zu leicht' : 'im Ziel';
    return { li, name: LEVELS[li].name, pipe, boss: bossP, total, cause: cause ? `${cn}× ${cause}` : 'keine', pipeSec: R.pipeN ? +(R.pipeFrames / R.pipeN / 60).toFixed(1) : null, bossSec: R.bossN ? +(R.bossFrames / R.bossN / 60).toFixed(1) : null, verdict };
  });
}

function exitAutotest() {
  SIM.autotest = false;
  leaveSim();
  try { if (window.location && /autotest/i.test(window.location.hash || '')) window.location.hash = ''; } catch (e) { /* egal */ }
  goMenu();
}
function autotestKey(code) {
  if (code === 'Escape' || code === 'Enter' || code === 'Space') { if (AT.done) exitAutotest(); }
  else if (code === 'KeyR' && AT.done) { leaveSim(); startAutotest(); }
}
function autotestButtons() {
  const w = Math.min(150, (W - 48) / 2);
  return [{ id: 'again', x: W / 2 - w - 6, y: GROUND_Y - 4, w, h: 40 }, { id: 'play', x: W / 2 + 6, y: GROUND_Y - 4, w, h: 40 }];
}
function autotestPress(p) {
  if (!AT.done) return;
  const b = hitList(autotestButtons(), p);
  if (b && b.id === 'play') exitAutotest();
  else if (b && b.id === 'again') { leaveSim(); startAutotest(); }
}

// ---------- Darstellung: Fortschritt und Tabelle ----------
function renderAutotest() {
  applyContextState(ctx);
  const C = COLORS[0];
  ctx.fillStyle = vgradMain(0, H, [[0, '#1d1a2b'], [1, '#2a2340']]);
  ctx.fillRect(0, 0, W, H);
  text('Autotest', W / 2, 30, FS.lg - 2, CREAM);
  const sub = `${AT.runs} Läufe pro Level und Boss, Bot mit ${AT.delay} Frames Reaktionszeit, Breite ${W}`;
  ctx.font = `normal ${FS.xxs}px ${FONT}`;
  if (ctx.measureText(sub).width <= W - 24) text(sub, W / 2, 56, FS.xxs, rgba(CREAM, 0.7), { weight: 'normal' });
  else {
    text(`${AT.runs} Läufe pro Level und Boss, Breite ${W}`, W / 2, 50, FS.xxs, rgba(CREAM, 0.7), { weight: 'normal' });
    text(`Bot mit ${AT.delay} Frames Reaktionszeit`, W / 2, 64, FS.xxs, rgba(CREAM, 0.7), { weight: 'normal' });
  }
  if (!AT.done) {
    const total = LEVELS.length * 2 * AT.runs, doneN = AT.li * 2 * AT.runs + (AT.phase === 'boss' ? AT.runs : 0) + AT.run;
    const f = doneN / total, bw = Math.min(300, W - 60);
    roundRectPath(W / 2 - bw / 2, 280, bw, 12, 6);
    ctx.fillStyle = rgba(CREAM, 0.12);
    ctx.fill();
    roundRectPath(W / 2 - bw / 2, 280, Math.max(12, bw * f), 12, 6);
    ctx.fillStyle = C.accent;
    ctx.fill();
    const L = LEVELS[Math.min(AT.li, LEVELS.length - 1)];
    text(`Level ${Math.min(AT.li + 1, LEVELS.length)}: ${L.name}, ${AT.phase === 'pipe' ? 'Rohrphase' : 'Bosskampf'}`, W / 2, 256, FS.sm, CREAM);
    text(`${Math.round(f * 100)} %`, W / 2, 312, FS.xs, rgba(CREAM, 0.7), { weight: 'normal' });
    return;
  }
  // Zeilenhöhe passt sich der Zahl der Level an, damit Tabelle, Legende und Knöpfe übereinander Platz haben
  const rows = AT.rows, narrow = W < 600, top = 86, rowH = Math.min(narrow ? 27 : 28, Math.floor((GROUND_Y - 34 - (top + 22)) / Math.max(1, rows.length) + 1));
  const fs = Math.min(narrow ? 10.5 : FS.xs, Math.max(9.5, rowH * 0.55));
  // Schmal: Dauer statt Gesamtquote (Rohre, Boss, Ursache und Dauer verlangt die Vorgabe)
  const cols = narrow
    ? [['Level', 8, 'left'], ['Rohre', 0.345, 'right'], ['Boss', 0.47, 'right'], ['Dauer s', 0.655, 'right'], ['Ursache', 0.685, 'left']]
    : [['Level', 14, 'left'], ['Rohre', 0.31, 'right'], ['Boss', 0.42, 'right'], ['Gesamt', 0.54, 'right'], ['Häufigste Ursache', 0.58, 'left'], ['Dauer in s', W - 14, 'right']];
  const sec = v => (v === null ? '-' : narrow ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));
  const colX = c => (c[1] < 1 ? W * c[1] : c[1]);
  for (const c of cols) text(c[0], colX(c), top, fs, rgba(CREAM, 0.7), { align: c[2] });
  const shade3 = v => (v === null ? rgba(CREAM, 0.5) : v < 0 ? '#ff9b8a' : v > 0 ? '#ffd27a' : '#9ff0b0');
  rows.forEach((r, i) => {
    const y = top + 22 + i * rowH;
    if (i % 2 === 0) { ctx.fillStyle = rgba(CREAM, 0.05); ctx.fillRect(6, y - rowH / 2 + 1, W - 12, rowH - 2); }
    text(`${r.li + 1} ${r.name}`, colX(cols[0]), y, fs, CREAM, { align: 'left' });
    text(r.pipe === null ? '-' : r.pipe + ' %', colX(cols[1]), y, fs, r.pipe === null ? shade3(null) : shade3(pipeVerdict(r.li, r.pipe)), { align: 'right' });
    text(r.boss === null ? '-' : r.boss + ' %', colX(cols[2]), y, fs, r.boss === null ? shade3(null) : shade3(bossVerdict(r.boss)), { align: 'right' });
    if (narrow) text(`${sec(r.pipeSec)} + ${sec(r.bossSec)}`, colX(cols[3]), y, fs, rgba(CREAM, 0.75), { align: 'right', weight: 'normal' });
    else text(r.total === null ? '-' : r.total + ' %', colX(cols[3]), y, fs, rgba(CREAM, 0.85), { align: 'right', weight: 'normal' });
    let cause = r.cause;
    ctx.font = `normal ${fs}px ${FONT}`;
    const maxW = (narrow ? W - 10 : colX(cols[5]) - 96) - colX(cols[4]);
    while (ctx.measureText(cause).width > maxW && cause.length > 4) cause = cause.slice(0, -2) + '…';
    text(cause, colX(cols[4]), y, fs, rgba(CREAM, 0.85), { align: 'left', weight: 'normal' });
    if (!narrow) text(`${sec(r.pipeSec)} + ${sec(r.bossSec)} s`, colX(cols[5]), y, fs, rgba(CREAM, 0.7), { align: 'right', weight: 'normal' });
  });
  const ly = top + 22 + rows.length * rowH + 4;
  const legend = [['#9ff0b0', 'im Ziel'], ['#ff9b8a', 'zu schwer'], ['#ffd27a', 'zu leicht']];
  let lx = W / 2 - 150;
  for (const [c, l] of legend) { circle(lx, ly, 4, c); text(l, lx + 8, ly, FS.xxs, rgba(CREAM, 0.75), { align: 'left', weight: 'normal' }); lx += 110; }
  for (const b of autotestButtons()) button(b, b.id === 'again' ? 'Erneut testen' : 'Zum Spiel', b.id === 'play', C);
}

