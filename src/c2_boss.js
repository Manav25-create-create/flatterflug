// ============================================================
// Boss: gemeinsame Mechanik für alle, nur das Muster ist verschieden.
// Ablauf: BOSS_INTRO (Einflug) -> BOSS_GRACE (Schonfrist) -> BOSS_FIGHT.
// Ein Angriff nach dem anderen. Jedes ausgewichene Geschoss prallt am
// Rand ab und fliegt blass zum Boss zurück; der erste Rückpraller eines
// ausgewichenen Angriffs trifft ihn. Treffer pro Level stehen in BOSS_LIVES
// (Level 1: 1, jedes Level ohne neues Hindernis +1). Im letzten Level kommen
// die 19 Bosse der Level davor nacheinander mit je 2 Treffern.
// Abstand und Tempo hängen von der Bildbreite ab, damit die Zeit bis zum
// Vogel überall gleich bleibt (sonst wären breite Bildschirme viel leichter).
// ============================================================
const TWIN_DELAY = 74;
// Rotierendes Viermuster: Der Ring öffnet sich so weit, dass in seiner Mitte Platz für den Vogel bleibt
const SPIRAL = { spin: 0.07, r0: 6, r1: 54, grow: 48, speed: 2.6 };
const spiralRadius = age => lerp(SPIRAL.r0, SPIRAL.r1, ease.outCubic(Math.min(1, age / SPIRAL.grow)));
const SALVO_GAP = 70;                 // Abstand der drei Bahnen einer Salve (Vogel passt knapp dazwischen)
const GHOST = { speed: 7.5, alpha: 0.42 };
let attackSeq = 0;
let bossOut = null;                   // abstürzender Boss beim Wechsel im Boss-Ansturm
const ghostInfo = new Map();          // Angriff -> { dodged, arrived, counted }

// Tempo über die Flugzeit: Vom Maul bis zum Vogel braucht ein Schuss in Level 1 etwa 48 Frames, pro Level
// 0,4 Frames weniger. Steht der Boss weiter weg (breite Bildschirme), fliegt alles entsprechend schneller,
// damit die Reaktionszeit auf jedem Gerät gleich ist.
const bossTTC = () => 48 - 0.4 * game.level;
const bossSpeedScale = () => Math.max(1, bossDist() / 220);
const shotSpeed = () => Math.max(2.6, (bossDist() - 39) / bossTTC());
const waveSpeedNow = () => Math.max(1.8, (bossDist() - 20) / (bossTTC() * 1.6));
const spiralSpeed = () => Math.max(2, (bossDist() - 39) / (bossTTC() * 1.35));
const rainSpeed = () => Math.max(2.2, (bossDist() - 16) / (bossTTC() * 1.3));
// Pause zwischen zwei Angriffen (enthält die Vorwarnung): von 90 Frames in Level 1 auf 64 in Level 14
const attackCooldown = () => Math.max(64, CONFIG.ATTACK_COOLDOWN - 2 * game.level);
const isRushLevel = li => li === LEVELS.length - 1;
const RUSH_COUNT = LEVELS.length - 1;          // Bosse im Ansturm: die der Level 1 bis 19
// Trefferzahl: laut BOSS_LIVES, im Boss-Ansturm jeder Boss 2
const bossNeedFor = li => (isRushLevel(li) ? CONFIG.RUSH_HITS : BOSS_LIVES[li]);

function makeBoss(li) {
  const b = { li, x: W + 40, enterX: W + 40, y: Math.round(rand(CONFIG.BOSS_Y_MIN + 60, CONFIG.BOSS_Y_MAX - 60)), dir: RNG() < 0.5 ? -1 : 1, timer: 0, plan: null,
    flash: 0, vy: 0, rot: 0, t: 0, n: 0, defeated: false, seed: randInt(1, 9999), hits: 0, need: bossNeedFor(game.level) };
  b.px = b.x; b.py = b.y;
  return b;
}
const bossMouth = () => ({ x: boss.x + CONFIG.BOSS_MOUTH_DX, y: boss.y + CONFIG.BOSS_MOUTH_DY });
const bossPatternOf = li => LEVELS[li].boss.pattern;
const bossCenter = b => ({ x: b.x + CONFIG.BOSS_W / 2, y: b.y + CONFIG.BOSS_H / 2 });

// Zielen: einmalig beim Abschuss auf die Höhe des Vogels, mit der echten Flugzeit bis zu ihm
function flightFrames(mx, speed) { return Math.max(12, (mx - birdHomeCX()) / (speed || shotSpeed())); }
function aimVy(mx, my, speed) {
  return clamp((birdCY() - my) / flightFrames(mx, speed), -CONFIG.AIM_VY_MAX, CONFIG.AIM_VY_MAX);
}

// Der Boss sucht träge die Höhe des Vogels und schwebt dabei leicht auf und ab
function moveBoss() {
  const target = clamp(birdCY() - CONFIG.BOSS_MOUTH_DY + Math.sin(boss.t * 0.025 + boss.seed) * 46, CONFIG.BOSS_Y_MIN, CONFIG.BOSS_Y_MAX);
  boss.y += clamp((target - boss.y) * 0.035, -CONFIG.BOSS_Y_SPEED, CONFIG.BOSS_Y_SPEED);
}

// Muster 15 wechselt zwischen gezieltem Schuss und langsamer Welle
function currentPattern() {
  const p = bossPatternOf(boss.li);
  if (p === 'alternate') return boss.n % 2 === 0 ? 'aimed' : 'wave';
  return p;
}

function newAttack(pending) {
  const a = { id: ++attackSeq, pending, hit: false, done: false };
  attacks.push(a);
  ghostInfo.set(a.id, { dodged: false, arrived: false, counted: false });
  return a.id;
}
const openAttacks = () => attacks.reduce((n, a) => n + (a.done ? 0 : 1), 0);

function warnProgress() {
  if (!boss || game.state !== 'BOSS_FIGHT' || !boss.plan) return 0;
  const warn = PATTERNS[currentPattern()].warn, start = attackCooldown() - warn;
  return clamp((boss.timer - start) / warn, 0, 1);
}

const introFrames = () => (game.introShort ? CONFIG.RUSH_INTRO_FRAMES : CONFIG.BOSS_INTRO_FRAMES);
function updateBossIntro() {
  boss.t++;
  moveBoss();
  boss.x = lerp(boss.enterX, bossHomeX(), ease.outCubic(game.t / introFrames()));
}

function updateBossIdle() {
  boss.t++;
  moveBoss();
  boss.x += (bossHomeX() - boss.x) * 0.1;
  if (boss.flash > 0) boss.flash--;
}

function updateBossFight() {
  updateBossIdle();
  // Nächster Angriff erst, wenn der vorige vorbei ist; reichen die Ausweichzüge, kommt keiner mehr.
  // Hat die Vorwarnung begonnen (Plan steht), läuft sie bis zum Abschuss durch, auch wenn Säule
  // oder Laser schon als eigener Angriff unterwegs sind.
  if (!boss.plan && (openAttacks() > 0 || game.dodges >= boss.need)) return;
  const pat = currentPattern(), cd = attackCooldown(), warnStart = cd - PATTERNS[pat].warn;
  boss.timer++;
  if (boss.timer === warnStart) boss.plan = planAttack(pat);
  if (boss.timer >= cd) {
    fireAttack(pat, boss.plan || {});
    boss.plan = null;
    boss.timer = 0;
    boss.n++;
  }
}

// Lücke (Mitte) so wählen, dass der Vogel ausweichen muss: minD bis maxD von seiner Höhe entfernt
function gapAway(minD, maxD) {
  const by = birdCY(), lo = CONFIG.PIPE_EDGE_MARGIN + CONFIG.WAVE_GAP / 2, hi = GROUND_Y - CONFIG.PIPE_EDGE_MARGIN - CONFIG.WAVE_GAP / 2;
  const sides = [-1, 1].filter(d => { const c = by + d * minD; return c >= lo && c <= hi; });
  if (!sides.length) return clamp(by + (by < (lo + hi) / 2 ? maxD : -maxD), lo, hi);
  const d = sides.length === 2 ? (RNG() < 0.5 ? -1 : 1) : sides[0];
  return clamp(by + d * rand(minD, maxD), lo, hi);
}

// Beginn der Vorwarnung. Säule und Laser legen hier ihr Ziel fest und laufen selbstständig.
function planAttack(pattern) {
  const m = bossMouth(), by = birdCY(), mg = CONFIG.PIPE_EDGE_MARGIN, half = CONFIG.WAVE_GAP / 2;
  switch (pattern) {
    case 'salvo3': {
      // drei Bahnen um die Höhe des Vogels: knapp dazwischen oder weit außen vorbei
      const c = clamp(by, 40 + SALVO_GAP, GROUND_Y - 40 - SALVO_GAP);
      return { lanes: [c - SALVO_GAP, c, c + SALVO_GAP] };
    }
    case 'wave': return { gapY: gapAway(70, 150) };
    case 'column': {
      shots.push({ type: 'column', li: boss.li, x: birdHomeCX(), y0: by - 90, y1: by + 90, w: 46, warn: PATTERNS.column.warn, active: PATTERNS.column.active,
        t: 0, group: newAttack(1), seed: randInt(1, 9999) });
      return {};
    }
    case 'laser': {
      shots.push({ type: 'laser', li: boss.li, tx: birdHomeCX(), ty: by, warn: PATTERNS.laser.warn, active: PATTERNS.laser.active, thick: 16, t: 0, group: newAttack(1) });
      return {};
    }
    case 'twinwave': {
      const gapR = gapAway(40, 130);
      const lo = mg + half, hi = GROUND_Y - mg - half, opts = [];
      for (const d of [-1, 1]) { const g = gapR + d * (90 + RNG() * 40); if (g >= lo && g <= hi) opts.push(g); }
      return { gapR, gapL: opts.length ? pick(opts) : clamp(gapR + 120, lo, hi) };
    }
    case 'gearroll': {
      // Unten rollt es am Boden, oben an der Decke; die Kante reicht 46 px über den Vogel hinaus
      if (by > GROUND_Y / 2) return { r: Math.round(clamp((GROUND_Y - by + 46) / 2, 38, 150)), ceil: false };
      return { r: Math.round(clamp((by + 46) / 2, 38, 150)), ceil: true };
    }
    case 'emberrain': {
      const vx = rainSpeed(), drift = 0.6, T = (boss.x - birdHomeX()) / vx;
      const g0 = clamp(gapAway(60, 130) - drift * T * 0.5, mg + half, GROUND_Y - mg - half - drift * T);
      return { gapY: g0, drift };
    }
  }
  return {};
}

function orb(m, vx, vy, r, g) {
  return { type: 'orb', li: boss ? boss.li : game.level, x: m.x, y: m.y, px: m.x, py: m.y, vx, vy, r, grav: 0, t: 0, group: g };
}
function wall(x, vx, gapY, g) {
  return { type: 'wave', li: boss ? boss.li : game.level, x, px: x, gapY, gapH: CONFIG.WAVE_GAP, w: 30, vx, t: 0, group: g };
}

function fireAttack(pattern, plan) {
  const m = bossMouth(), S = shotSpeed(), aim = aimVy(m.x, m.y, S), T = flightFrames(m.x, S), dy = birdCY() - m.y;
  switch (pattern) {
    case 'aimed':
      shots.push(orb(m, -S, aim, 12, newAttack(1)));
      break;
    case 'salvo3': {
      const g = newAttack(3), lanes = plan.lanes || [birdCY() - SALVO_GAP, birdCY(), birdCY() + SALVO_GAP];
      for (const ly of lanes) {
        const o = orb(m, -S, 0, 13, g);
        o.laneFrom = m.y;
        o.laneY = ly;
        shots.push(o);
      }
      break;
    }
    case 'arc': {
      // Bogenwurf, der genau dort ankommt, wo der Vogel beim Abwurf ist
      const grav = 0.1, o = orb(m, -S, clamp((dy - 0.5 * grav * T * T) / T, -9, 6), 12, newAttack(1));
      o.grav = grav;
      shots.push(o);
      break;
    }
    case 'diverge': {
      const g = newAttack(2);
      shots.push(orb(m, -S, aim, 11, g));
      shots.push(orb(m, -S, aim + (RNG() < 0.5 ? -1 : 1) * 1.3, 11, g));
      break;
    }
    case 'wave':
      shots.push(wall(boss.x - 20, -waveSpeedNow(), plan.gapY !== undefined ? plan.gapY : 272, newAttack(1)));
      break;
    case 'riser': {
      // startet zu tief und steigt dann auf; trifft die Höhe des Vogels genau an seiner Position
      const riseAt = Math.round(T * 0.4), acc = 0.2, tr = Math.max(0, T - riseAt);
      const o = orb(m, -S, clamp((dy + 0.5 * acc * tr * tr) / T, -6, 9), 12, newAttack(1));
      o.riseAt = riseAt;
      o.riseAcc = acc;
      shots.push(o);
      break;
    }
    case 'split': {
      const o = orb(m, -S, aim, 17, newAttack(1));
      o.splitAt = Math.round(T / 2);
      shots.push(o);
      break;
    }
    case 'spiral': {
      // Der Ring zielt mit seiner Mitte genau auf die Höhe des Vogels beim Abschuss und zieht
      // langsamer als ein Einzelschuss: Wer ruhig bleibt, fliegt durch die Mitte, wer weit genug
      // ausweicht, fliegt außen vorbei.
      const sp = spiralSpeed(), tt = (m.x - birdHomeCX()) / sp, endY = clamp(birdCY(), 70, GROUND_Y - 80);
      const vy = clamp((endY - m.y) / tt, -CONFIG.AIM_VY_MAX, CONFIG.AIM_VY_MAX);
      const g = newAttack(4), c = { x: m.x, y: m.y, vx: -sp, vy, age: 0, f: -1 };
      for (let k = 0; k < 4; k++) {
        const o = orb(m, -sp, vy, 9, g);
        o.orbit = c;
        o.ang = k * Math.PI / 2;
        o.rad = 6;
        shots.push(o);
      }
      break;
    }
    case 'shatter': {
      const o = orb(m, -S, aim, 14, newAttack(1));
      o.shatterX = Math.round((m.x + birdHomeCX()) / 2);
      shots.push(o);
      break;
    }
    case 'twinwave': {
      const g = newAttack(2), x0 = boss.x - 20, ws = waveSpeedNow();
      const tR = (x0 - (birdHomeX() + CONFIG.BIRD_W)) / ws;
      // Die linke Welle trifft TWIN_DELAY Frames nach der rechten ein: knapp eine Sekunde zum Umsteigen
      const xL = birdHomeX() - ws * (tR + TWIN_DELAY) - 30;
      shots.push(wall(x0, -ws, plan.gapR, g));
      const wl = wall(xL, ws, plan.gapL, g);
      wl.fromLeft = true;
      shots.push(wl);
      break;
    }
    case 'gearroll': {
      // rollt vom Boss aus am Boden oder an der Decke auf den Vogel zu
      const r = plan.r || 50, x = boss.x + 30, y = plan.ceil ? r : GROUND_Y - r;
      shots.push({ type: 'gear', li: boss.li, x, px: x, y, py: y, r, vx: -S * 0.9, vy: 0, ang: 0, t: 0, group: newAttack(1), ceil: !!plan.ceil });
      break;
    }
    case 'emberrain': {
      const x = boss.x - 16;
      shots.push({ type: 'rain', li: boss.li, x, px: x, w: 46, vx: -rainSpeed(), gapY: plan.gapY !== undefined ? plan.gapY : 260, gapH: CONFIG.WAVE_GAP, drift: plan.drift || 0.6,
        t: 0, group: newAttack(1), seed: randInt(1, 9999) });
      break;
    }
  }
  const C = COLORS[boss.li];
  burst(m.x, m.y, 5, [C.accent, CREAM], 2, 14, { grav: 0 });
  sfx('shoot');
}

// ---------- Rückpraller ----------
// Ein ausgewichenes Teil wird zum blassen Rückpraller: kein Treffer mehr für den Vogel, fliegt zum Boss
function makeGhost(s) {
  s.ghost = true;
  s.orbit = null;
  s.laneY = undefined;
  s.grav = 0; s.riseAt = 0; s.splitAt = 0; s.shatterX = 0;
  // Abprall: Richtung umkehren, etwas Höhe behalten
  s.vx = Math.max(2.5, Math.abs(s.vx || 3)) * (s.x < W / 2 ? 1 : -1);
  s.vy = -(s.vy || 0) * 0.6;
  s.t = 0;
  resolveShot(s);
  return s;
}
function ghostSpark(x, y, group, li, r) {
  const o = { type: 'orb', li, x, y, px: x, py: y, vx: x < W / 2 ? 4 : -4, vy: 0, r: r || 10, grav: 0, t: 0, group, ghost: true };
  return o;
}
function updateGhost(s) {
  if (!boss || boss.defeated) return false;
  const c = bossCenter(boss), dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy) || 1;
  const sp = GHOST.speed * bossSpeedScale(), k = Math.min(0.5, 0.05 + s.t * 0.006);   // erst freier Abprall, dann zielstrebig
  s.vx += (dx / d * sp - s.vx) * k;
  s.vy += (dy / d * sp - s.vy) * k;
  s.x += s.vx;
  s.y += s.vy;
  if (s.type === 'gear') s.ang += s.vx / s.r;
  if (d < 34 || s.t > 260) { ghostArrive(s); return false; }
  return true;
}
function ghostArrive(s) {
  const st = ghostInfo.get(s.group);
  if (st) st.arrived = true;
  if (st && st.dodged && !st.counted) countBossHit(s.group, s.x, s.y);
  else if (!SIM.on) burst(s.x, s.y, 4, [CREAM, COLORS[boss.li].accent], 1.6, 12, { grav: 0 });
}
// Ein Treffer pro ausgewichenem Angriff
function countBossHit(group, x, y) {
  const st = ghostInfo.get(group);
  if (!st || st.counted || !boss || boss.defeated) return;
  st.counted = true;
  boss.hits++;
  game.dodgePop = 1;
  boss.flash = CONFIG.BOSS_HIT_FLASH;
  const C = COLORS[boss.li];
  burst(x, y, 10, [CREAM, C.accent], 2.8, 20);
  shake(2, 8);
  sfx('bosshit');
  if (boss.hits >= boss.need) bossBeaten();
}

let shotsNext = null;                 // neue Liste, solange updateShots läuft
function updateShots() {
  const keep = shotsNext = [];
  for (const s of shots) {
    s.t++;
    s.px = s.x; s.py = s.y;
    if (s.ghost) { if (updateGhost(s)) keep.push(s); continue; }
    const C = COLORS[s.li !== undefined ? s.li : game.level];
    let gone = false, bounce = false;
    if (s.type === 'orb') {
      if (s.orbit) {
        const c = s.orbit;
        if (c.f !== frame) { c.f = frame; c.x += c.vx; c.y += c.vy; c.age++; }
        s.ang += SPIRAL.spin;
        s.rad = spiralRadius(c.age);
        s.x = c.x + Math.cos(s.ang) * s.rad;
        s.y = c.y + Math.sin(s.ang) * s.rad;
        s.vx = c.vx; s.vy = c.vy;
      } else if (s.laneY !== undefined) {
        s.x += s.vx;
        s.y = lerp(s.laneFrom, s.laneY, ease.outCubic(Math.min(1, s.t / 24)));
      } else {
        if (s.riseAt && s.t > s.riseAt) s.vy = Math.max(s.vy - s.riseAcc, -7);
        s.vy += s.grav;
        s.x += s.vx;
        s.y += s.vy;
        if (s.splitAt && s.t === s.splitAt) {
          const a = attacks.find(q => q.id === s.group);
          if (a) a.pending += 3;
          for (const dv of [-1.4, 0, 1.4]) {
            const piece = orb(s, s.vx, s.vy + dv, 10, s.group);
            piece.li = s.li;
            piece.piece = true;
            keep.push(piece);
          }
          burst(s.x, s.y, 8, [C.pipe, C.accent, CREAM], 2.2, 18, { kind: 'shard', vr: 0.2 });
          gone = true;
        }
        if (s.shatterX && s.x <= s.shatterX) {
          const a = attacks.find(q => q.id === s.group);
          if (a) a.pending += 3;
          for (const dv of [-1.5, 0, 1.5]) {
            const piece = orb(s, s.vx, s.vy + dv, 7, s.group);
            piece.li = s.li;
            piece.piece = true;
            piece.shard = true;
            keep.push(piece);
          }
          burst(s.x, s.y, 10, [C.pipe, C.accent, CREAM], 2.6, 18, { kind: 'prism', vr: 0.25 });
          sfx('shatter');
          gone = true;
        }
      }
      if (!gone) {
        if (s.y + s.r * 0.5 > GROUND_Y) { burst(s.x, GROUND_Y - 2, 5, [C.accent, CREAM], 2, 14, { grav: 0.15 }); s.y = GROUND_Y - s.r; bounce = true; }
        else if (s.x < -s.r - 6 || s.x > W + 90 || s.y < (s.grav > 0 ? -240 : -s.r - 20)) { s.x = clamp(s.x, -s.r, W + 40); s.y = clamp(s.y, -s.r, GROUND_Y - s.r); bounce = true; }
      }
    } else if (s.type === 'wave' || s.type === 'rain') {
      s.x += s.vx;
      if (s.type === 'rain') s.gapY += s.drift;
      if (s.vx < 0 ? s.x + s.w < -6 : s.x > W + 6) {
        // Die Wand zerfällt am Rand in zwei Rückpraller
        const ex = s.vx < 0 ? 6 : W - 6;
        for (const gy of [s.gapY - s.gapH / 2 - 26, s.gapY + s.gapH / 2 + 26]) keep.push(ghostSpark(ex, clamp(gy, 20, GROUND_Y - 20), s.group, s.li, 10));
        gone = true;
      }
    } else if (s.type === 'gear') {
      s.x += s.vx;
      s.ang += s.vx / s.r;
      if (s.x + s.r < -6) { s.x = -s.r; bounce = true; }
    } else if (s.type === 'column') {
      if (s.t === s.warn) { flash(0.25, mix(CREAM, C.accent, 0.4)); sfx('thunder'); }
      if (s.t >= s.warn + s.active + 12) { keep.push(ghostSpark(s.x, clamp((s.y0 + s.y1) / 2, 20, GROUND_Y - 20), s.group, s.li, 10)); gone = true; }
    } else if (s.type === 'laser') {
      if (s.t === s.warn) sfx('laser');
      if (s.t >= s.warn + s.active + 10) {
        const l = laserLine(s);
        keep.push(ghostSpark(6, clamp(l.oy + (6 - l.ox) * l.slope, 20, GROUND_Y - 20), s.group, s.li, 9));
        gone = true;
      }
    }
    if (bounce) { keep.push(makeGhost(s)); continue; }
    if (gone) resolveShot(s); else keep.push(s);
  }
  shotsNext = null;
  // Nach dem letzten Treffer hat defeatBoss() die Angriffe bereits geleert
  if (game.state === 'BOSS_FIGHT') shots = keep;
  attacks = attacks.filter(a => !a.done);
}

// Ein Angriff ist ausgewichen, wenn alle seine Teile am Vogel vorbei sind, ohne zu treffen.
// Eine Salve zählt dadurch als ein einziges Ausweichen.
function resolveShot(s) {
  const a = attacks.find(q => q.id === s.group);
  if (!a || a.done) return;
  a.pending--;
  if (a.pending <= 0) {
    a.done = true;
    if (!a.hit) onDodge(a);
  }
}

function onDodge(a) {
  if (game.state !== 'BOSS_FIGHT') return;
  game.dodges++;
  const st = ghostInfo.get(a.id);
  if (!st) return;
  st.dodged = true;
  if (st.arrived) countBossHit(a.id, bossCenter(boss).x - 30, bossCenter(boss).y);
  // ohne Rückpraller unterwegs kommt einer vom linken Rand
  else {
    const list = shotsNext || shots, has = q => q.ghost && q.group === a.id;
    if (!shots.some(has) && !(shotsNext && shotsNext.some(has))) list.push(ghostSpark(6, birdCY(), a.id, boss.li, 10));
  }
}

function laserLine(s) {
  const m = bossMouth();
  const dx = s.tx - m.x, dy = s.ty - m.y, len = Math.hypot(dx, dy) || 1;
  return { ox: m.x, oy: m.y, ux: dx / len, uy: dy / len, slope: dy / dx };
}

function shotHits(s, box) {
  if (s.ghost) return false;
  switch (s.type) {
    case 'orb': return circleBox(s.x, s.y, s.r, box);
    case 'wave': case 'rain': {
      if (!(box.x < s.x + s.w && box.x + box.w > s.x)) return false;
      return box.y < s.gapY - s.gapH / 2 || box.y + box.h > s.gapY + s.gapH / 2;
    }
    case 'gear': return circleBox(s.x, s.y, s.r - 4, box);
    case 'column':
      return s.t >= s.warn && s.t < s.warn + s.active && overlap(box, { x: s.x - s.w / 2, y: s.y0, w: s.w, h: s.y1 - s.y0 });
    case 'laser': {
      if (s.t < s.warn || s.t >= s.warn + s.active) return false;
      const l = laserLine(s);
      for (let x = box.x - 10; x <= box.x + box.w + 10; x += 3) {
        if (circleBox(x, l.oy + (x - l.ox) * l.slope, s.thick / 2, box)) return true;
      }
      return false;
    }
  }
  return false;
}
const SHOT_CAUSE = { orb: 'Geschoss', wave: 'Welle', rain: 'Glutregen', gear: 'Zahnrad', column: 'Blitzsäule', laser: 'Laser' };

// ---------- Zeichnen: Angriffe ----------
function drawShots(li, a) {
  // Rückpraller zuerst und blass, damit echte Geschosse immer obenauf und gut lesbar bleiben
  for (const pass of [true, false]) {
    for (const s of shots) {
      if (!!s.ghost !== pass) continue;
      const sl = s.li !== undefined ? s.li : li, C = COLORS[sl], L = LEVELS[sl], st = L.style.projectile, look = L.style.wave || 'sand';
      if (pass) ctx.globalAlpha = GHOST.alpha;
      if (s.type === 'orb') drawOrb(s, C, s.shard ? 'shard' : st, lerp(s.px, s.x, a), lerp(s.py, s.y, a));
      else if (s.type === 'wave') drawWave(s, C, lerp(s.px, s.x, a), look);
      else if (s.type === 'rain') drawRain(s, C, lerp(s.px, s.x, a));
      else if (s.type === 'gear') drawGearShot(s, C, lerp(s.px, s.x, a), lerp(s.py, s.y, a));
      else if (s.type === 'column') drawColumn(s, C);
      else if (s.type === 'laser') drawLaser(s, C);
      ctx.globalAlpha = 1;
    }
  }
}

function drawOrb(s, C, st, x, y) {
  const r = s.r, g = glowSprite(C.accent);
  circle(x + SHADOW.x * 0.6, y + SHADOW.y * 0.6, r, rgba(INK, CONFIG.SHADOW_ALPHA));
  ctx.drawImage(g, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  // ruhiger Schweif hinter dem Geschoss
  const vx = s.x - s.px, vy = s.y - s.py, sp = Math.hypot(vx, vy);
  if (sp > 0.5) {
    const tx = x - vx / sp * r * 2.6, ty = y - vy / sp * r * 2.6;
    const gr = ctx.createLinearGradient(x, y, tx, ty);
    gr.addColorStop(0, rgba(C.accent, 0.35));
    gr.addColorStop(1, rgba(C.accent, 0));
    ctx.strokeStyle = gr;
    ctx.lineWidth = r * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  switch (st) {
    case 'pollen':
      circle(x, y, r, shade(C.accent, -CONFIG.SIDE_DARKEN));
      circle(x - 1.2, y - 1.2, r * 0.88, C.accent);
      ctx.fillStyle = rgba(INK, 0.45);
      for (let k = 0; k < 6; k++) { const an = k * 1.05; ctx.fillRect(x + Math.cos(an) * r * 0.55 - 1, y + Math.sin(an) * r * 0.55 - 1, 2, 2); }
      circle(x - r * 0.35, y - r * 0.35, r * 0.25, rgba(CREAM, 0.6));
      break;
    case 'shard': {
      const ang = Math.atan2(s.vy || 0, s.vx || -1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      const f = mix(C.pipe, CREAM, 0.45);
      poly([[r * 1.5, 0], [0, -r * 0.62], [-r * 1.2, 0]], f);
      poly([[r * 1.5, 0], [-r * 1.2, 0], [0, r * 0.62]], shade(f, -CONFIG.SIDE_DARKEN));
      line(-r * 0.8, -1, r * 1.1, -1, rgba(CREAM, 0.8), 1);
      ctx.restore();
      break;
    }
    case 'blob':
      circle(x, y, r, shade(C.accent, -CONFIG.SIDE_DARKEN));
      circle(x - 1.5, y - 1.5, r * 0.85, C.accent);
      circle(x - 2, y - 2, r * 0.45, C.accentLight);
      break;
    case 'seed':
      ellipse(x, y, r * 1.1, r * 0.8, 0.3, shade(C.accent, -CONFIG.SIDE_DARKEN));
      ellipse(x - 1, y - 1, r * 0.95, r * 0.65, 0.3, C.accent);
      ellipse(x + r * 0.8, y - r * 0.6, r * 0.5, r * 0.2, -0.6, mix(C.accent, C.near, 0.5));
      circle(x - r * 0.35, y - r * 0.3, r * 0.2, rgba(CREAM, 0.6));
      break;
    case 'bubble':
      circle(x, y, r, rgba(C.accent, 0.35));
      ctx.strokeStyle = mix(C.accent, CREAM, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      circle(x - r * 0.35, y - r * 0.35, r * 0.28, rgba(CREAM, 0.8));
      break;
    case 'rock': {
      const rng = mulberry32(s.group * 31 + (s.piece ? 7 : 0));
      const pts = [];
      for (let k = 0; k < 7; k++) { const an = k * TAU / 7 + s.t * 0.03; const rr = r * (0.8 + rng() * 0.3); pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]); }
      poly(pts, shade(C.pipe, -CONFIG.SIDE_DARKEN));
      poly(pts.map(([px, py]) => [x + (px - x) * 0.8 - 1.5, y + (py - y) * 0.8 - 1.5]), C.pipe);
      poly([[x - r * 0.3, y - r * 0.1], [x, y - r * 0.55], [x + r * 0.25, y - r * 0.05]], C.accent);
      break;
    }
    default:
      // Eigene Geschossformen neuer Biome: ART2.projectile[stil](s, C, x, y), Radius s.r, Flugrichtung aus s.vx/s.vy
      if (ART2.projectile[st]) { ART2.projectile[st](s, C, x, y); break; }
      circle(x, y, r, shade(C.accent, -CONFIG.SIDE_DARKEN));
      circle(x - 1, y - 1, r * 0.8, C.accent);
      circle(x - 1.5, y - 1.5, r * 0.42, CREAM);
  }
}

function drawWave(s, C, x, look) {
  const top = s.gapY - s.gapH / 2, bot = s.gapY + s.gapH / 2, dir = s.vx < 0 ? 1 : -1;
  const trailX = dir > 0 ? x + s.w - 2 : x - 80;
  // weiche Spur hinter der Welle
  const g = ctx.createLinearGradient(dir > 0 ? x + s.w : x, 0, dir > 0 ? x + s.w + 80 : x - 80, 0);
  const tc = look === 'energy' ? C.accent : look === 'cloud' ? CREAM : mix(C.far, C.near, 0.5);
  g.addColorStop(0, rgba(tc, look === 'cloud' ? 0.35 : 0.5));
  g.addColorStop(1, rgba(tc, 0));
  ctx.fillStyle = g;
  ctx.fillRect(trailX, -12, 82, top + 12);
  ctx.fillRect(trailX, bot, 82, GROUND_Y - bot);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fillRect(x + SHADOW.x * 0.6, -12, s.w, top + 12 + SHADOW.y * 0.6);
  ctx.fillRect(x + SHADOW.x * 0.6, bot + SHADOW.y * 0.6, s.w, GROUND_Y - bot - SHADOW.y * 0.6);
  if (look === 'cloud') {
    for (const [y0, y1] of [[-12, top], [bot, GROUND_Y]]) {
      ctx.fillStyle = hgrad(x, x + s.w, [[0, mix(CREAM, C.pipe, 0.15)], [1, mix(CREAM, C.pipe, 0.45)]]);
      ctx.fillRect(x + 4, y0, s.w - 8, y1 - y0);
      const puffs = [];
      for (let y = y0; y <= y1; y += 13) puffs.push([x + s.w / 2 + Math.sin(y * 0.11 + s.gapY) * 4, y, 11 + Math.sin(y * 0.3) * 2]);
      blobPath(puffs);
      ctx.fillStyle = mix(CREAM, '#ffffff', 0.3);
      ctx.fill();
      dots(puffs.map(([px, py, r]) => [px - r * 0.3, py - r * 0.3, r * 0.45]), rgba('#ffffff', 0.5));
    }
  } else if (look === 'energy') {
    for (const [y0, y1] of [[-12, top], [bot, GROUND_Y]]) {
      ctx.fillStyle = hgrad(x, x + s.w, [[0, rgba(C.accent, 0.2)], [0.5, rgba(mix(C.accent, CREAM, 0.4), 0.85)], [1, rgba(C.accent, 0.2)]]);
      ctx.fillRect(x, y0, s.w, y1 - y0);
      ctx.strokeStyle = rgba(CREAM, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let y = y0; y <= y1; y += 8) { const xx = x + s.w / 2 + Math.sin(y * 0.15 + s.t * 0.3) * (s.w * 0.3); if (y === y0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y); }
      ctx.stroke();
    }
  } else {
    const sand = C.near, side = shade(sand, -CONFIG.SIDE_DARKEN), crest = mix(C.accent, CREAM, 0.2);
    const edge = y => (dir > 0 ? x : x + s.w) + Math.sin(y * 0.09 + s.gapY) * 4 * dir;
    const back = dir > 0 ? x + s.w : x;
    for (const [y0, y1] of [[-12, top], [bot, GROUND_Y]]) {
      ctx.beginPath();
      ctx.moveTo(back, y0);
      for (let y = y0; y <= y1; y += 6) ctx.lineTo(edge(y), y);
      ctx.lineTo(edge(y1), y1);
      ctx.lineTo(back, y1);
      ctx.closePath();
      ctx.fillStyle = sand;
      ctx.fill();
      ctx.fillStyle = side;
      ctx.fillRect(dir > 0 ? x + s.w - 10 : x, y0, 10, y1 - y0);
      ctx.strokeStyle = crest;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = y0; y <= y1; y += 6) { if (y === y0) ctx.moveTo(edge(y), y); else ctx.lineTo(edge(y), y); }
      ctx.stroke();
    }
  }
  ctx.fillStyle = CREAM;
  ctx.fillRect(x - 4, top - 3, s.w + 8, 3);
  ctx.fillRect(x - 4, bot, s.w + 8, 3);
}

// Glutregen: Vorhang aus fallender Glut mit sicherer, langsam sinkender Spalte
function drawRain(s, C, x) {
  const top = s.gapY - s.gapH / 2, bot = s.gapY + s.gapH / 2, hot = mix(C.accent, '#ffd27a', 0.35);
  ctx.fillStyle = hgrad(x - 10, x + s.w + 10, [[0, rgba(C.accent, 0)], [0.5, rgba(C.accent, 0.22)], [1, rgba(C.accent, 0)]]);
  ctx.fillRect(x - 10, -12, s.w + 20, top + 12);
  ctx.fillRect(x - 10, bot, s.w + 20, GROUND_Y - bot);
  const r = mulberry32(s.seed), g = glowSprite(C.accent), list = [];
  for (let i = 0; i < 34; i++) {
    const ex = x + r() * s.w, sp = 3 + r() * 2.5, ey = (r() * (GROUND_Y + 40) + s.t * sp) % (GROUND_Y + 40) - 20;
    if (ey > top - 6 && ey < bot + 6) continue;
    list.push([ex, ey, 1.8 + r() * 2.2]);
  }
  for (const [ex, ey, rr] of list) ctx.drawImage(g, ex - rr * 3, ey - rr * 3, rr * 6, rr * 6);
  dots(list, hot);
  dots(list.map(([ex, ey, rr]) => [ex - rr * 0.3, ey - rr * 0.3, rr * 0.4]), rgba(CREAM, 0.8));
  ctx.fillStyle = rgba(CREAM, 0.9);
  ctx.fillRect(x - 6, top - 3, s.w + 12, 3);
  ctx.fillRect(x - 6, bot, s.w + 12, 3);
  // Pfeile zeigen, dass die Spalte sinkt
  ctx.strokeStyle = rgba(CREAM, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  const cx = x + s.w / 2;
  ctx.moveTo(cx - 6, s.gapY - 4); ctx.lineTo(cx, s.gapY + 3); ctx.lineTo(cx + 6, s.gapY - 4);
  ctx.stroke();
}

// Rollendes Zahnrad am Boden (Muster 13)
function gearPath(x, y, r, ang, teeth) {
  const rin = r - Math.max(6, r * 0.16);
  ctx.beginPath();
  for (let k = 0; k < teeth; k++) {
    const a0 = ang + k * TAU / teeth, a1 = a0 + TAU / teeth * 0.16, a2 = a0 + TAU / teeth * 0.34, a3 = a0 + TAU / teeth * 0.5;
    const P = (a, rr) => [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
    const p0 = P(a0, rin), p1 = P(a1, r), p2 = P(a2, r), p3 = P(a3, rin);
    if (k === 0) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
    ctx.arc(x, y, rin, a3, a0 + TAU / teeth);
  }
  ctx.closePath();
  return rin;
}
function drawGearShot(s, C, x, y) {
  const r = s.r, teeth = Math.max(10, Math.round(r / 4.5)), brass = C.pipe;
  if (!s.ghost && !s.ceil) ellipse(x + 6, GROUND_Y + 2, r * 0.9, 6, 0, rgba(INK, CONFIG.SHADOW_ALPHA));
  gearPath(x + SHADOW.x * 0.5, y + SHADOW.y * 0.5, r, s.ang, teeth);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fill();
  const rin = gearPath(x, y, r, s.ang, teeth);
  ctx.fillStyle = rgrad(x, y, 2, r, [[0, mix(brass, CREAM, 0.35)], [0.6, brass], [1, shade(brass, -0.32)]], x - r * 0.35, y - r * 0.4);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.35);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  circle(x, y, rin * 0.72, rgba(INK, 0.28));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(s.ang);
  ctx.fillStyle = shade(brass, -0.08);
  for (let k = 0; k < 6; k++) { ctx.rotate(TAU / 6); ctx.fillRect(-r * 0.07, 0, r * 0.14, rin * 0.72); }
  ctx.restore();
  circle(x, y, r * 0.2, rgrad(x, y, 1, r * 0.2, [[0, mix(brass, CREAM, 0.4)], [1, shade(brass, -0.3)]], x - 3, y - 3));
  circle(x, y, r * 0.07, mix(INK, C.near, 0.3));
  ctx.strokeStyle = rgba(CREAM, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, rin - 2, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
}

function drawColumn(s, C) {
  const bc = mix(CREAM, C.accent, 0.35), y0 = Math.max(s.y0, -10), y1 = Math.min(s.y1, GROUND_Y);
  if (s.t < s.warn) {
    const p = s.t / s.warn;
    ctx.fillStyle = rgba(C.accent, 0.06 + 0.14 * p);
    ctx.fillRect(s.x - s.w / 2, y0, s.w, y1 - y0);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = rgba(bc, 0.35 + 0.55 * p);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(s.x - s.w / 2, y0, s.w, y1 - y0);
    ctx.setLineDash([]);
    return;
  }
  const a = s.t < s.warn + s.active ? 1 : Math.max(0, 1 - (s.t - s.warn - s.active) / 12);
  ctx.fillStyle = rgba(C.accent, 0.3 * a);
  ctx.fillRect(s.x - s.w / 2, y0, s.w, y1 - y0);
  const r = mulberry32(s.seed + Math.floor(s.t / 6));
  for (let b = 0; b < 3; b++) {
    const pts = [];
    for (let y = y0; y < y1; y += 14) pts.push([s.x + (r() - 0.5) * s.w * 0.8, y]);
    pts.push([s.x + (r() - 0.5) * s.w * 0.4, y1]);
    for (const [lw, col] of [[7, rgba(C.accent, 0.3 * a)], [2.2, rgba(bc, 0.9 * a)], [1, rgba(CREAM, a)]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
  }
}

function drawLaser(s, C) {
  const l = laserLine(s);
  const tEnd = (l.ox + 30) / Math.max(0.05, -l.ux);
  const ex = l.ox + l.ux * tEnd, ey = l.oy + l.uy * tEnd;
  if (s.t < s.warn) {
    const p = s.t / s.warn;
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = rgba(mix(C.pipe, CREAM, 0.3), 0.35 + 0.6 * p);
    ctx.lineWidth = 1.2 + p * 1.2;
    ctx.beginPath();
    ctx.moveTo(l.ox, l.oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(C.accent, 0.5 + 0.5 * p);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.tx, s.ty, 10 - p * 4, 0, TAU);
    ctx.moveTo(s.tx - 14, s.ty); ctx.lineTo(s.tx - 6, s.ty);
    ctx.moveTo(s.tx + 6, s.ty); ctx.lineTo(s.tx + 14, s.ty);
    ctx.stroke();
    return;
  }
  const a = s.t < s.warn + s.active ? 1 : Math.max(0, 1 - (s.t - s.warn - s.active) / 10);
  ctx.lineCap = 'round';
  for (const [lw, col] of [[s.thick * 2, rgba(C.pipe, 0.22 * a)], [s.thick, rgba(C.pipe, 0.75 * a)], [s.thick * 0.35, rgba(CREAM, a)]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(l.ox, l.oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  circle(l.ox, l.oy, 10 * a, rgba(CREAM, 0.7 * a));
}

// ---------- Zeichnen: Boss ----------
function bossPal(C, f) {
  const t = c => (f > 0 ? mix(c, CREAM, f) : c);
  return {
    main: t(C.pipe), mainSide: t(shade(C.pipe, -CONFIG.SIDE_DARKEN)), mainLight: t(shade(C.pipe, 0.22)), mainDark: t(shade(C.pipe, -0.45)),
    acc: t(C.accent), accSide: t(shade(C.accent, -CONFIG.SIDE_DARKEN)), accLight: t(mix(C.accent, CREAM, 0.5)), accDark: t(shade(C.accent, -0.45)),
    near: t(C.near), far: t(C.far), sky: t(C.skyBottom), ink: t(INK), cream: CREAM
  };
}

// Der Boss wird pro Frame in eine eigene Ebene gemalt und dort mit Korn texturiert
const BOSS_PAD = 34;
const bossFx = { k: 0, c: null, g: null, tex: null };
function bossSurface() {
  const k = view.k;
  if (bossFx.k !== k || !bossFx.c) {
    freeCanvas(bossFx.c);
    freeCanvas(bossFx.tex);
    bossFx.c = newCanvas((CONFIG.BOSS_W + BOSS_PAD * 2) * k, (CONFIG.BOSS_H + BOSS_PAD * 2) * k);
    bossFx.g = bossFx.c.getContext('2d');
    // Flecken und Korn einmal zu einer Textur in Gerätepixeln vereinen: pro Bild nur eine 1:1-Kopie
    const tex = newCanvas(bossFx.c.width, bossFx.c.height), tg = tex.getContext('2d');
    const mottle = mottleCanvas(CONFIG.BOSS_W + BOSS_PAD * 2, CONFIG.BOSS_H + BOSS_PAD * 2, 3, 41, 1.3);
    if (!TEX.fine) TEX.fine = buildFineTile();
    tg.globalAlpha = 0.16;
    tg.drawImage(mottle, 0, 0, tex.width, tex.height);
    tg.globalAlpha = 0.07;
    tg.fillStyle = tg.createPattern(TEX.fine, 'repeat');
    tg.fillRect(0, 0, tex.width, tex.height);
    bossFx.tex = warmUp(tex);
    bossFx.k = k;
  }
  return bossFx;
}

function drawBoss(li, a) {
  if (bossOut) drawBossObj(bossOut, a);
  if (boss) drawBossObj(boss, a);
}
function drawBossObj(b, a) {
  const li = b.li, C = COLORS[li];
  let f = 0;
  if (b.defeated) f = b.flash > 0 && Math.floor(b.flash / 4) % 2 === 0 ? 0.85 : 0;
  else if (b.flash > 0) f = 0.75 * b.flash / CONFIG.BOSS_HIT_FLASH;
  // Immer mit der Grundpalette malen (die neuen Bosse halten ruhende Teile im Zwischenspeicher),
  // das Aufblitzen kommt danach als helle Überlagerung nur auf die Bosspixel
  const active = b === boss, P = bossPal(C, 0), wp = active ? warnProgress() : 0, t = b.t, k = view.k;
  const bx = lerp(b.px, b.x, a), by = lerp(b.py, b.y, a);
  if (LEVELS[li].style.boss === 'spider' && !b.defeated) line(bx + 46, by + 26, bx + 46, -10, rgba(CREAM, 0.45), 1);
  const fx = bossSurface(), g = fx.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, fx.c.width, fx.c.height);
  g.setTransform(k, 0, 0, k, BOSS_PAD * k, BOSS_PAD * k);
  setupG(g);
  withCtx(g, () => {
    ellipse(46 + SHADOW.x * 0.7, 60 + SHADOW.y * 0.7, 38, 46, 0, rgba(INK, CONFIG.SHADOW_ALPHA));
    switch (LEVELS[li].style.boss) {
      case 'bee': drawBee(P, t, wp); break;
      case 'golem': drawGolem(P, t, wp); break;
      case 'magma': drawMagma(P, t, wp); break;
      case 'chameleon': drawChameleon(P, t, wp); break;
      case 'scarab': drawScarab(P, t, wp); break;
      case 'angler': drawAngler(P, t, wp); break;
      case 'stormcloud': drawStormBoss(P, t, wp); break;
      case 'spider': drawSpider(P, t, wp); break;
      case 'mech': drawMech(P, t, wp); break;
      case 'jelly': drawJelly(P, t, wp); break;
      default: if (ART2.boss[LEVELS[li].style.boss]) ART2.boss[LEVELS[li].style.boss](P, t, wp);
    }
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.imageSmoothingEnabled = false;
  g.drawImage(fx.tex, 0, 0);
  g.imageSmoothingEnabled = true;
  if (f > 0) {
    g.globalAlpha = f;
    g.fillStyle = CREAM;
    g.fillRect(0, 0, fx.c.width, fx.c.height);
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  ctx.save();
  if (!b.rot) {
    // ohne Drehung pixelgenau als 1:1-Kopie (schnell und scharf)
    const m = ctx.getTransform ? ctx.getTransform() : null, ox = m ? m.e : 0, oy = m ? m.f : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fx.c, Math.round(ox + (bx - BOSS_PAD) * k), Math.round(oy + (by - BOSS_PAD) * k));
  } else {
    ctx.translate(bx + CONFIG.BOSS_W / 2, by + CONFIG.BOSS_H / 2);
    ctx.rotate(b.rot);
    ctx.drawImage(fx.c, -CONFIG.BOSS_W / 2 - BOSS_PAD, -CONFIG.BOSS_H / 2 - BOSS_PAD, CONFIG.BOSS_W + BOSS_PAD * 2, CONFIG.BOSS_H + BOSS_PAD * 2);
  }
  ctx.restore();
  if (active && wp > 0 && !b.defeated) drawTelegraph(li, wp, bx, by);
}

// Sichtbare Vorwarnung am Maul, dazu musterspezifische Hinweise
function drawTelegraph(li, p, bx, by) {
  const C = COLORS[li], m = { x: bx + CONFIG.BOSS_MOUTH_DX, y: by + CONFIG.BOSS_MOUTH_DY }, pat = currentPattern();
  const r = 4 + p * 12;
  circle(m.x, m.y, r * 2.2, rgba(C.accent, 0.12 + 0.2 * p));
  circle(m.x, m.y, r, rgba(mix(C.accent, CREAM, 0.4), 0.55 + 0.45 * p));
  ctx.strokeStyle = rgba(CREAM, 0.6 * p);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, r + 5 + (1 - p) * 12, 0, TAU);
  ctx.stroke();
  const plan = boss.plan || {};
  if (pat === 'salvo3' && plan.lanes) {
    const x = bx - 20;
    for (const ly of plan.lanes) poly([[x - 6, ly], [x, ly - 6], [x + 6, ly], [x, ly + 6]], rgba(C.accent, 0.4 + 0.6 * p));
    ctx.strokeStyle = rgba(CREAM, 0.35 * p);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    for (const ly of plan.lanes) { ctx.moveTo(x - 10, ly); ctx.lineTo(x - 10 - 60 * p, ly); }
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (pat === 'wave' && plan.gapY !== undefined) {
    const x = bx - 22, top = plan.gapY - CONFIG.WAVE_GAP / 2, bot = plan.gapY + CONFIG.WAVE_GAP / 2;
    ctx.strokeStyle = rgba(CREAM, 0.85 * p);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, top); ctx.lineTo(x, top); ctx.lineTo(x, top + 12);
    ctx.moveTo(x + 8, bot); ctx.lineTo(x, bot); ctx.lineTo(x, bot - 12);
    ctx.stroke();
    ctx.fillStyle = rgba(C.accent, 0.35 * p);
    ctx.fillRect(x - 10, top, 8, bot - top);
  } else if (pat === 'diverge') {
    const aim = aimVy(m.x, m.y);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    for (const vy of [aim - 1.3, aim, aim + 1.3]) {
      const len = Math.hypot(4, vy);
      ctx.strokeStyle = rgba(CREAM, (vy === aim ? 0.7 : 0.35) * p);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - 4 / len * 70 * p, m.y + vy / len * 70 * p);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else if (pat === 'spiral') {
    for (let k = 0; k < 4; k++) {
      const an = k * Math.PI / 2 + p * 3, rr = 6 + p * 10;
      circle(m.x + Math.cos(an) * rr, m.y + Math.sin(an) * rr, 3 + p * 2, rgba(C.accent, 0.5 + 0.5 * p));
    }
  } else if (pat === 'arc') {
    ctx.fillStyle = rgba(CREAM, 0.6 * p);
    for (let k = 1; k <= 5; k++) circle(m.x - k * 9, m.y - Math.sin(k / 5 * 1.4) * 22 * p, 1.6, ctx.fillStyle);
  } else if (pat === 'twinwave' && plan.gapR !== undefined) {
    const half = CONFIG.WAVE_GAP / 2;
    const mark = (x, gy, d) => {
      ctx.strokeStyle = rgba(CREAM, 0.85 * p);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 8 * d, gy - half); ctx.lineTo(x, gy - half); ctx.lineTo(x, gy - half + 12);
      ctx.moveTo(x + 8 * d, gy + half); ctx.lineTo(x, gy + half); ctx.lineTo(x, gy + half - 12);
      ctx.stroke();
      ctx.fillStyle = rgba(C.accent, 0.35 * p);
      ctx.fillRect(d > 0 ? x - 10 : x + 2, gy - half, 8, half * 2);
    };
    mark(bx - 22, plan.gapR, 1);
    mark(6, plan.gapL, -1);
    // Pfeil am linken Rand: von dort kommt die zweite Welle
    ctx.fillStyle = rgba(C.accent, 0.5 + 0.5 * p);
    poly([[20, plan.gapL - 9], [32, plan.gapL], [20, plan.gapL + 9]], ctx.fillStyle);
  } else if (pat === 'gearroll' && plan.r) {
    const r = plan.r, cy = plan.ceil ? r : GROUND_Y - r, edge = plan.ceil ? 2 * r : GROUND_Y - 2 * r;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = rgba(CREAM, 0.35 + 0.5 * p);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + 30, cy, r, 0, TAU);
    ctx.moveTo(0, edge);
    ctx.lineTo(W, edge);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(C.accent, 0.12 + 0.2 * p);
    if (plan.ceil) ctx.fillRect(0, 0, W, 2 * r); else ctx.fillRect(0, GROUND_Y - 2 * r, W, 2 * r);
  } else if (pat === 'emberrain' && plan.gapY !== undefined) {
    const x = bx - 22, top = plan.gapY - CONFIG.WAVE_GAP / 2, bot = plan.gapY + CONFIG.WAVE_GAP / 2;
    ctx.strokeStyle = rgba(CREAM, 0.85 * p);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, top); ctx.lineTo(x, top); ctx.lineTo(x, top + 12);
    ctx.moveTo(x + 8, bot); ctx.lineTo(x, bot); ctx.lineTo(x, bot - 12);
    ctx.moveTo(x - 6, plan.gapY - 6); ctx.lineTo(x, plan.gapY + 2); ctx.lineTo(x + 6, plan.gapY - 6);
    ctx.stroke();
  } else if (pat === 'shatter') {
    const sx = Math.round((m.x + birdHomeCX()) / 2);
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = rgba(CREAM, 0.25 + 0.35 * p);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, 20);
    ctx.lineTo(sx, GROUND_Y - 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Hilfsform: Block mit Seitenfläche und Lichtkante
function block(x, y, w, h, r, front, side, light) {
  roundRectPath(x, y, w, h, r);
  ctx.fillStyle = side;
  ctx.fill();
  roundRectPath(x, y, w - 6, h - 4, r);
  ctx.fillStyle = front;
  ctx.fill();
  if (light) { ctx.fillStyle = light; ctx.fillRect(x + 5, y + 3, w * 0.4, 3); }
}

// 1 Hummelkönigin
function drawBee(P, t, w) {
  const fl = Math.sin(t * 0.32) * 0.28;
  ctx.save(); ctx.translate(56, 30); ctx.rotate(-0.6 + fl);
  ellipse(16, -6, 22, 9, -0.2, rgba(P.cream, 0.35));
  ctx.restore();
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (const [x0, x1] of [[30, 22], [42, 38], [54, 56]]) { ctx.moveTo(x0, 68); ctx.lineTo(x1, 86); ctx.lineTo(x1 - 5, 93); }
  ctx.stroke();
  ellipse(62, 64, 29, 31, 0.2, P.accSide);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(60, 61, 27, 29, 0.2, 0, TAU);
  ctx.clip();
  ctx.fillStyle = P.acc;
  ctx.fillRect(30, 28, 64, 68);
  ctx.fillStyle = P.ink;
  for (const sx of [49, 63, 77]) ctx.fillRect(sx, 28, 7, 68);
  ellipse(50, 45, 12, 7, -0.4, rgba(P.cream, 0.3));
  ctx.restore();
  poly([[86, 70], [98, 77], [85, 80]], P.ink);
  circle(28, 50, 22, P.accSide);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; circle(26 + Math.cos(a) * 19, 48 + Math.sin(a) * 19, 3.2, P.acc); }
  circle(26, 48, 19.5, P.acc);
  ellipse(18, 42, 7, 9, 0.25, P.ink);
  circle(15.5, 39, 2.4, P.cream);
  poly([[16, 31], [17, 19], [22, 26], [27, 15], [32, 26], [37, 19], [37, 31]], P.accLight, P.accDark, 1.2);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 30); ctx.quadraticCurveTo(10, 24, 5, 11);
  ctx.moveTo(26, 28); ctx.quadraticCurveTo(22, 15, 16, 6);
  ctx.stroke();
  circle(5, 11, 3, P.ink);
  circle(16, 6, 3, P.ink);
  const open = 2 + w * 6;
  poly([[13, 45], [2, 47 - open * 0.5], [10, 49]], P.ink);
  poly([[13, 52], [2, 50 + open * 0.5], [10, 54]], P.ink);
  ctx.save(); ctx.translate(48, 34); ctx.rotate(-0.9 + fl * 1.3);
  ellipse(18, -6, 25, 10, -0.2, rgba(P.cream, 0.55));
  ctx.strokeStyle = rgba(P.ink, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  line(2, -2, 34, -8, rgba(P.ink, 0.25), 0.8);
  ctx.restore();
}

// 2 Frostgolem
function drawGolem(P, t, w) {
  const bob = Math.sin(t * 0.06) * 1.5;
  block(58, 46, 26, 42, 6, P.main, P.mainSide, P.mainLight);
  block(24, 34, 56, 58, 8, P.main, P.mainSide, P.mainLight);
  poly([[60, 36], [66, 16], [72, 36]], P.cream);
  poly([[70, 38], [79, 22], [84, 40]], P.mainLight);
  block(30, 88, 18, 20, 4, P.mainSide, P.mainDark);
  block(56, 88, 18, 20, 4, P.mainSide, P.mainDark);
  ctx.strokeStyle = rgba(P.mainDark, 0.5);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(40, 50); ctx.lineTo(48, 62); ctx.lineTo(44, 74);
  ctx.moveTo(62, 60); ctx.lineTo(70, 70);
  ctx.stroke();
  block(8, 18 + bob, 42, 36, 8, P.main, P.mainSide, P.mainLight);
  const eg = 0.35 + 0.25 * Math.sin(t * 0.1) + w * 0.4;
  for (const ex of [19, 34]) {
    circle(ex, 31 + bob, 5.5, rgba(P.acc, eg));
    circle(ex, 31 + bob, 2.7, P.accLight);
  }
  roundRectPath(3, 43 + bob - w * 2, 24, 6 + w * 5, 3);
  ctx.fillStyle = P.ink;
  ctx.fill();
  if (w > 0) { ctx.fillStyle = rgba(P.accLight, w); ctx.fillRect(6, 45 + bob - w * 1.5, 18, 2 + w * 3); }
  block(6, 62, 24, 26, 6, P.main, P.mainSide, P.mainLight);
  ctx.fillStyle = rgba(P.mainDark, 0.5);
  ctx.fillRect(10, 76, 16, 2);
}

// 3 Magmageist
function drawMagma(P, t, w) {
  const fk = k => Math.sin(t * 0.08 + k * 1.7) * 3;
  ctx.beginPath();
  ctx.moveTo(46, 106);
  ctx.bezierCurveTo(14, 104, 2, 78, 8, 56);
  ctx.bezierCurveTo(12, 38, 18, 30, 22, 16 + fk(0));
  ctx.quadraticCurveTo(30, 26, 34, 8 + fk(1));
  ctx.quadraticCurveTo(44, 24, 52, 2 + fk(2));
  ctx.quadraticCurveTo(58, 22, 68, 10 + fk(3));
  ctx.quadraticCurveTo(72, 30, 80, 26 + fk(4));
  ctx.bezierCurveTo(92, 50, 90, 92, 46, 106);
  ctx.closePath();
  const g = ctx.createRadialGradient(36, 62, 4, 44, 60, 62);
  g.addColorStop(0, P.accLight);
  g.addColorStop(0.45, P.acc);
  g.addColorStop(1, P.accSide);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(P.ink, 0.15);
  ctx.fillRect(60, 0, 40, 110);
  ctx.restore();
  for (const [x, y, rx, ry, rot] of [[64, 72, 12, 8, 0.4], [30, 88, 10, 6, -0.3], [70, 44, 8, 5, 0.2]]) {
    ellipse(x, y, rx, ry, rot, P.main);
    ellipse(x - 2, y - 2, rx * 0.5, ry * 0.4, rot, P.mainLight);
  }
  ellipse(24, 42, 6, 8, -0.1, P.ink);
  ellipse(40, 40, 6, 8, 0.1, P.ink);
  circle(23, 39.5, 2.4, P.cream);
  circle(39, 37.5, 2.4, P.cream);
  ellipse(10, 50, 6 + w * 4, 3 + w * 6, 0, P.ink);
  if (w > 0) ellipse(10, 50, (3 + w * 3), (1.5 + w * 4), 0, rgba(P.accLight, w));
  for (let k = 0; k < 3; k++) circle(30 + k * 14, 104 + k * 3, 2.5, P.acc);
}

// 4 Schlingchamäleon
function drawChameleon(P, t, w) {
  ctx.fillStyle = P.mainSide;
  ctx.fillRect(-8, 96, 106, 9);
  ctx.fillStyle = P.main;
  ctx.fillRect(-8, 96, 106, 5);
  ctx.strokeStyle = P.accSide;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(74, 70);
  ctx.bezierCurveTo(95, 76, 93, 101, 80, 99);
  ctx.bezierCurveTo(70, 97, 72, 85, 80, 87);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (const [x0, y0, x1] of [[34, 76, 30], [46, 80, 48], [62, 78, 66]]) { ctx.moveTo(x0, y0); ctx.lineTo(x1 - 4, 90); ctx.lineTo(x1, 97); }
  ctx.stroke();
  ellipse(52, 64, 32, 25, -0.1, P.accSide);
  ellipse(50, 61, 30, 22, -0.1, P.acc);
  ctx.strokeStyle = rgba(P.near, 0.45);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const sx of [40, 54, 68]) { ctx.moveTo(sx, 44); ctx.quadraticCurveTo(sx + 5, 60, sx - 2, 80); }
  ctx.stroke();
  for (let k = 0; k < 6; k++) poly([[30 + k * 8, 44 - k * 0.5], [34 + k * 8, 36 - k * 0.5], [38 + k * 8, 44 - k * 0.5]], P.accSide);
  poly([[8, 58], [14, 34], [30, 20], [42, 36], [40, 62]], P.accSide);
  poly([[10, 56], [16, 34], [30, 22], [40, 36], [38, 58]], P.acc);
  poly([[22, 28], [32, 12], [38, 30]], P.accLight);
  const m = bossMouth(), aim = bird ? aimVy(m.x, m.y) : 0, side = boss.plan && boss.plan.side ? boss.plan.side : 1;
  const wander = w > 0 ? 0 : Math.sin(t * 0.05) * 0.8;
  const eye = (x, y, r, vy) => {
    circle(x, y, r, P.accSide);
    circle(x - 0.5, y - 0.5, r * 0.86, P.acc);
    ctx.strokeStyle = rgba(P.near, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.stroke();
    const len = Math.hypot(4, vy);
    circle(x - 4 / len * r * 0.45, y + vy / len * r * 0.45, r * 0.32, P.ink);
  };
  eye(33, 33, 6, aim + side * 1.4 + wander);
  eye(25, 40, 8, aim - wander);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(4, 49); ctx.lineTo(22, 52);
  ctx.stroke();
  if (w > 0) {
    ctx.strokeStyle = P.accDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 49);
    ctx.quadraticCurveTo(-4 - w * 6, 49, -2 - w * 4, 56);
    ctx.stroke();
  }
}

// 5 Sandskarabäus
function drawScarab(P, t, w) {
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const lx = 32 + k * 18, ph = Math.sin(t * 0.08 + k * 2) * 2;
    ctx.moveTo(lx, 78); ctx.lineTo(lx - 8 + ph, 92); ctx.lineTo(lx - 14 + ph, 106);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, 82);
  ctx.bezierCurveTo(18, 28, 88, 22, 90, 80);
  ctx.closePath();
  ctx.fillStyle = P.mainSide;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, 79);
  ctx.bezierCurveTo(22, 30, 83, 26, 85, 77);
  ctx.closePath();
  ctx.fillStyle = P.main;
  ctx.fill();
  ctx.strokeStyle = P.mainDark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(52, 38);
  ctx.quadraticCurveTo(57, 58, 54, 80);
  ctx.stroke();
  ellipse(38, 46, 13, 6, -0.5, rgba(P.cream, 0.35));
  circle(66, 52, 4, P.acc);
  circle(40, 64, 3, P.acc);
  circle(70, 68, 3, P.acc);
  ellipse(23, 56, 15, 13, 0, P.mainSide);
  ellipse(21.5, 54.5, 13.5, 11.5, 0, P.main);
  ctx.fillStyle = P.mainDark;
  ctx.beginPath();
  ctx.moveTo(16, 46);
  ctx.quadraticCurveTo(4, 36, 8, 18);
  ctx.quadraticCurveTo(14, 32, 26, 44);
  ctx.closePath();
  ctx.fill();
  circle(17, 52, 2.6, P.accLight);
  const open = 2 + w * 6;
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(10, 46); ctx.quadraticCurveTo(4, 45, 2, 46 - open);
  ctx.moveTo(10, 51); ctx.quadraticCurveTo(4, 52, 2, 51 + open);
  ctx.stroke();
}

// 6 Tiefseeangler
function drawAngler(P, t, w) {
  const body = mix(P.near, P.far, 0.35), bodySide = shade(body, -CONFIG.SIDE_DARKEN);
  const tail = Math.sin(t * 0.12) * 5;
  poly([[80, 58], [99, 40 + tail], [94, 58], [99, 76 + tail]], P.mainSide);
  for (let k = 0; k < 4; k++) poly([[40 + k * 9, 26], [46 + k * 9, 12 + (k % 2) * 4], [50 + k * 9, 26]], P.main);
  ellipse(50, 60, 38, 36, 0, bodySide);
  ellipse(48, 57, 35.5, 33, 0, body);
  ellipse(46, 78, 26, 11, 0, rgba(P.far, 0.6));
  ellipse(40, 40, 14, 6, -0.4, rgba(P.cream, 0.12));
  const open = 6 + w * 10;
  ctx.fillStyle = P.ink;
  ctx.beginPath();
  ctx.moveTo(28, 44);
  ctx.quadraticCurveTo(12, 40 - open * 0.3, 2, 44 - open * 0.5);
  ctx.lineTo(2, 52 + open * 0.5);
  ctx.quadraticCurveTo(12, 58 + open * 0.3, 28, 54);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 4; k++) {
    const tx = 5 + k * 5.5;
    poly([[tx, 44 - open * 0.45 + k * 1.2], [tx + 2.5, 49 - open * 0.2 + k], [tx + 5, 44 - open * 0.4 + k * 1.3]], P.cream);
    poly([[tx, 53 + open * 0.45 - k * 1.2], [tx + 2.5, 49 + open * 0.2 - k], [tx + 5, 53 + open * 0.4 - k * 1.3]], P.cream);
  }
  circle(35, 37, 5.5, P.cream);
  circle(34, 37, 3, P.ink);
  circle(33.2, 36, 1, P.cream);
  ctx.strokeStyle = bodySide;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(42, 26);
  ctx.quadraticCurveTo(32, -2, 12, 9);
  ctx.stroke();
  const glow = 0.35 + 0.2 * Math.sin(t * 0.15) + w * 0.45;
  circle(12, 10, 14, rgba(P.accLight, glow * 0.35));
  circle(12, 10, 5 + w * 2, P.accLight);
  circle(10.5, 8.5, 1.8, P.cream);
  ellipse(58, 70, 10, 5, 0.5 + Math.sin(t * 0.1) * 0.25, P.main);
}

// 7 Gewitterkoloss
function drawStormBoss(P, t, w) {
  const top = mix(P.far, P.sky, 0.4), side = shade(top, -CONFIG.SIDE_DARKEN), hi = mix(P.sky, P.cream, 0.3);
  ctx.strokeStyle = rgba(P.cream, 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const x = 20 + k * 11 + (k * 7) % 6; ctx.moveTo(x, 86); ctx.lineTo(x - 3, 104); }
  ctx.stroke();
  const puffs = [[20, 54, 22], [40, 32, 26], [64, 34, 24], [80, 58, 19], [54, 66, 28], [26, 76, 20], [8, 62, 13]];
  for (const [x, y, r] of puffs) circle(x + 2, y + 3, r, side);
  for (const [x, y, r] of puffs) circle(x, y, r * 0.93, top);
  for (const [x, y, r] of puffs.slice(0, 3)) circle(x - r * 0.3, y - r * 0.35, r * 0.42, rgba(hi, 0.55));
  if (w > 0.3) {
    const r = mulberry32(boss.seed || 7);
    ctx.strokeStyle = rgba(P.accLight, 0.85);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let x = 40 + r() * 20, y = 30;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 16; y += 10; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  poly([[14, 38], [28, 42], [26, 47], [14, 44]], P.accLight);
  poly([[34, 40], [46, 36], [46, 42], [35, 45]], P.accLight);
  ellipse(10, 52, 4 + w * 4, 2 + w * 5, 0, P.ink);
  if (w > 0) ellipse(10, 52, 2 + w * 3, 1 + w * 3.5, 0, rgba(P.accLight, w));
  ctx.strokeStyle = P.accLight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 70); ctx.lineTo(4, 78); ctx.lineTo(0, 82); ctx.lineTo(6, 90);
  ctx.stroke();
}

// 8 Kristallspinne
function drawSpider(P, t, w) {
  const legs = (col, back) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = back ? 2.5 : 3.2;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const ph = Math.sin(t * 0.12 + k * 1.3 + (back ? 1 : 0)) * 3;
      const bx = 28 + k * 5, by = 58;
      const up = k < 2;
      const kx = bx - 18 + k * 12 + (back ? 6 : 0), ky = up ? 26 - k * 4 + ph : 92 + (k - 2) * 4 + ph;
      const fx = kx - 10 + k * 4, fy = up ? ky + 36 : ky + 16;
      ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
    }
    ctx.stroke();
  };
  legs(shade(P.main, -0.2), true);
  const g = ctx.createRadialGradient(66, 56, 4, 66, 56, 46);
  g.addColorStop(0, rgba(P.acc, 0.45));
  g.addColorStop(1, rgba(P.acc, 0));
  ctx.fillStyle = g;
  ctx.fillRect(20, 10, 92, 92);
  poly([[46, 42], [62, 22], [84, 30], [93, 56], [80, 86], [58, 90], [44, 66]], P.accSide);
  poly([[48, 42], [62, 24], [70, 44], [60, 62], [46, 62]], P.acc);
  poly([[62, 24], [82, 32], [88, 54], [70, 44]], P.accLight);
  poly([[60, 62], [70, 44], [88, 54], [78, 84], [58, 88]], P.acc);
  line(64, 30, 70, 44, rgba(P.cream, 0.6), 1);
  const body = mix(P.main, P.cream, 0.12);
  circle(30, 56, 17, shade(body, -CONFIG.SIDE_DARKEN));
  circle(29, 54, 15.5, body);
  circle(25, 49, 5, rgba(P.cream, 0.2));
  ctx.strokeStyle = rgba(P.acc, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(30, 56, 16.5, Math.PI * 0.9, Math.PI * 1.6);
  ctx.stroke();
  for (const [ex, ey, er] of [[16, 46, 2.4], [21, 42, 2.2], [26, 44, 1.8], [18, 51, 1.8]]) circle(ex, ey, er, P.accLight);
  legs(mix(P.main, P.cream, 0.2), false);
  const open = 2 + w * 5;
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(14, 52); ctx.quadraticCurveTo(6, 50 - open, 4, 44 - open);
  ctx.moveTo(14, 56); ctx.quadraticCurveTo(6, 56 + open, 4, 52 + open);
  ctx.stroke();
}

// 9 Sektorwächter
function drawMech(P, t, w) {
  const body = mix(P.near, P.far, 0.55), side = shade(body, -CONFIG.SIDE_DARKEN);
  for (const tx of [34, 62]) {
    ctx.fillStyle = side;
    ctx.fillRect(tx - 6, 86, 12, 8);
    const fl = 9 + Math.sin(t * 0.18 + tx) * 2.5;
    poly([[tx - 5, 94], [tx, 94 + fl], [tx + 5, 94]], rgba(P.acc, 0.8));
    poly([[tx - 2.5, 94], [tx, 94 + fl * 0.6], [tx + 2.5, 94]], P.accLight);
  }
  roundRectPath(24, 20, 58, 68, 12);
  ctx.fillStyle = side;
  ctx.fill();
  roundRectPath(24, 20, 52, 64, 12);
  ctx.fillStyle = body;
  ctx.fill();
  roundRectPath(24, 20, 58, 68, 12);
  ctx.strokeStyle = rgba(P.main, 0.3);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = mix(P.main, P.cream, 0.25);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRectPath(30, 30, 36, 11, 5);
  ctx.fillStyle = rgba(P.main, 0.85);
  ctx.fill();
  circle(34 + (Math.sin(t * 0.04) * 0.5 + 0.5) * 28, 35.5, 2.6, P.cream);
  ctx.fillStyle = rgba(P.acc, 0.8);
  for (let k = 0; k < 3; k++) ctx.fillRect(56, 54 + k * 7, 14, 2.5);
  line(64, 20, 70, 6, side, 2);
  circle(70, 5, 2.5, P.acc);
  roundRectPath(6, 42, 38, 12, 4);
  ctx.fillStyle = side;
  ctx.fill();
  roundRectPath(6, 42, 36, 10, 4);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = mix(P.main, P.cream, 0.25);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = P.acc;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(7, 48, 6, 0, TAU);
  ctx.stroke();
  if (w > 0) circle(6, 48, 3 + w * 6, rgba(P.main, 0.5 + 0.5 * w));
}

// 10 Nebelqualle
function drawJelly(P, t, w) {
  ctx.lineWidth = 2.4;
  for (let k = 0; k < 6; k++) {
    const x0 = 18 + k * 11;
    ctx.strokeStyle = rgba(k % 2 ? P.acc : P.accLight, 0.6);
    ctx.beginPath();
    ctx.moveTo(x0, 56);
    for (let y = 60; y <= 110; y += 6) ctx.lineTo(x0 + Math.sin(y * 0.12 + t * 0.09 + k) * 4, y);
    ctx.stroke();
  }
  const bell = () => {
    ctx.beginPath();
    ctx.moveTo(6, 60);
    ctx.bezierCurveTo(2, 6, 88, 6, 84, 60);
    for (let k = 0; k < 6; k++) {
      const x1 = 84 - k * 13, x2 = x1 - 13;
      ctx.quadraticCurveTo((x1 + x2) / 2, 68 + Math.sin(t * 0.1 + k) * 2, x2, 60);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(2, 3);
  bell();
  ctx.fillStyle = rgba(shade(mix(P.far, P.acc, 0.35), -CONFIG.SIDE_DARKEN), 0.9);
  ctx.fill();
  ctx.restore();
  bell();
  const g = ctx.createRadialGradient(34, 26, 4, 44, 40, 50);
  g.addColorStop(0, rgba(P.accLight, 0.9));
  g.addColorStop(0.55, rgba(mix(P.far, P.acc, 0.45), 0.85));
  g.addColorStop(1, rgba(mix(P.far, P.acc, 0.25), 0.8));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = P.cream;
  for (let k = 0; k < 14; k++) {
    ctx.globalAlpha = 0.45 + 0.4 * hash(k * 5.3);
    ctx.fillRect(12 + hash(k * 3.1) * 66, 16 + hash(k * 7.7) * 42, 1.8, 1.8);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  circle(42, 38, 9 + Math.sin(t * 0.1) * 1.5, rgba(P.acc, 0.55));
  circle(42, 38, 4, P.cream);
  circle(8, 48, 5 + w * 4, rgba(P.accLight, 0.4 + 0.6 * w));
}

