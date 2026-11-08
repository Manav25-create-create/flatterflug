// ============================================================
// Biom-Hazards: generische Objekte mit type-Feld, je ein
// update/hits/draw per switch. Fair platziert: Jeder Hazard liegt
// außerhalb des natürlichen Flugbands zwischen zwei Lücken oder ist
// so getaktet, dass er vor dem Vogel durchfällt. Im Bosskampf aus.
// ============================================================
// inset: so weit dürfen Hindernisse in den Höhenbereich der Lücken hineinragen
const HZ = { inset: 12 };
const wind = { t: 0, dir: 1, state: 'calm', speed: 1, n: 0 };

// Flugband im Korridor zwischen zwei Rohren: von der höchsten Lückenoberkante bis zur
// tiefsten Lückenunterkante beider Rohre (bewegte Rohre mit Ausschlag), leicht eingerückt
function corridorOf(A, B) {
  const cA = A.gy0 + A.gap / 2, cB = B.gy0 + B.gap / 2;
  return {
    x0: pipeX(A) + PW_, x1: pipeX(B), xm: (pipeX(A) + PW_ + pipeX(B)) / 2,
    top: Math.min(A.gy0 - A.amp, B.gy0 - B.amp) + HZ.inset,
    bot: Math.max(A.gy0 + A.gap + A.amp, B.gy0 + B.gap + B.amp) - HZ.inset,
    cA, cB
  };
}
// Sichtweite nach vorn ab der rechten Vogelkante
const lookAhead = () => W - birdHomeX() - CONFIG.BIRD_W;
const birdRightWorld = () => birdWorldX() + CONFIG.BIRD_W;

function hazardType() { return LEVELS[game.level].hazard.type; }
function hazardParams() { return LEVELS[game.level].hazard.params || {}; }
const sightRadius = () => (LEVELS[game.level].dark ? LEVELS[game.level].dark.sight : 0);

// ============================================================
// Erzeugen: wird beim Spawnen jedes Rohrs aufgerufen
// ============================================================
function spawnHazardsBetween(A, B) {
  const type = hazardType(), P = hazardParams();
  if (type === 'darkness') { maybeCrystal(B); return; }
  if (type === 'none' || type === 'wind') return;
  if (B.idx <= game.pipesStart) return;                      // erster Korridor bleibt frei
  if (RNG() >= (P.chance === undefined ? 0.5 : P.chance)) return;
  const c = corridorOf(A, B);
  switch (type) {
    case 'icicles': spawnFalling('icicle', c, P); break;
    case 'embers': spawnFalling('ember', c, P); break;
    case 'geysers': spawnGeyser(c, P); break;
    case 'lianas': spawnLiana(c, P); break;
    case 'lightning': spawnBolt(c, P); break;
    case 'drones': spawnDrone(c, P); break;
    case 'shards': spawnShard(c, P); break;
    case 'updrafts': spawnUpdraft(c, P); break;
    case 'gears': spawnGear(c, P); break;
    case 'asteroids': spawnAsteroid(c, P); break;
  }
}

// Fallende Objekte (Eiszapfen, Glut): Zeitpunkt so gewählt, dass sie beim Durchflug
// entweder schon unter dem Flugband sind oder es erst nach dem Vogel erreichen.
function spawnFalling(type, c, P) {
  const ice = type === 'icicle';
  const w = ice ? 16 + Math.round(RNG() * 6) : 16, len = ice ? 44 + Math.round(RNG() * 16) : 16;
  const warn = ice ? (P.shake || 40) : 30, speed = ice ? (P.speed || 4) : (P.speed || 3.2);
  const x = Math.round(c.xm + (RNG() - 0.5) * 30);
  const pass = (CONFIG.BIRD_W + w) / CONFIG.SCROLL_SPEED;          // Frames, in denen der Vogel die Spalte kreuzt
  const sweep = speed * pass + 10;
  const fMax = (lookAhead() + 70) / CONFIG.SCROLL_SPEED - warn;      // Vorwarnung soll großteils sichtbar sein
  const opts = [];
  // A: Vogel fliegt unten durch, bevor das Objekt ankommt
  const fa = (c.top - sweep - len) / speed;
  if (fa >= 0) opts.push(Math.min(fa, fMax) * (0.55 + RNG() * 0.45));
  // B: Objekt ist schon unter dem Flugband
  const fb = (c.bot + 6) / speed;
  const fbMax = (GROUND_Y - 10 - len) / speed;
  if (fb <= Math.min(fMax, fbMax)) opts.push(fb + RNG() * (Math.min(fMax, fbMax) - fb));
  if (!opts.length) return;
  const f = opts[Math.floor(RNG() * opts.length)];
  const trigX = x - w / 2 - CONFIG.SCROLL_SPEED * (warn + f);
  hazards.push({ type, x, w, len, y: 0, py: 0, state: 'hang', t: 0, trigX, warn, speed, v: Math.floor(RNG() * 2), drift: ice ? 0 : -0.25 });
}

function spawnGeyser(c, P) {
  const top = Math.round(clamp(c.bot + HZ.inset + 14, 300, GROUND_Y - 70));    // knapp unter der tiefsten Lücke
  const w = 30, x = Math.round(c.xm);
  const trigX = x - w / 2 - CONFIG.SCROLL_SPEED * ((P.warn || 45) + 6);
  hazards.push({ type: 'geyser', x, w, top, state: 'idle', t: 0, trigX, warn: P.warn || 45, active: P.active || 70, jet: 0, pjet: 0 });
}

function spawnLiana(c, P) {
  const lowest = c.top - 6;                                    // tiefster Punkt der Spitze (senkrecht hängend)
  const len = Math.round(lowest + 8);
  if (len < 70) return;
  const amp = P.amp || 50;
  hazards.push({ type: 'liana', x: Math.round(c.xm), len, amp, period: P.period || 120, phase: RNG() * TAU, ang: 0, pang: 0, seed: Math.floor(RNG() * 9999) });
}

function spawnBolt(c, P) {
  const yEnd = Math.round(c.top - 6);
  if (yEnd < 80) return;
  const x = Math.round(c.xm + (RNG() - 0.5) * 24);
  const trigX = x - 12 - CONFIG.SCROLL_SPEED * (P.warn || 60) + 6;
  hazards.push({ type: 'bolt', x, yEnd, state: 'idle', t: 0, trigX, warn: P.warn || 60, active: P.active || 15, seed: Math.floor(RNG() * 9999) });
}

// Frei verfügbarer Raum über bzw. unter dem Flugband
function freeSpace(c, pad) {
  const above = [pad, c.top], below = [c.bot, GROUND_Y - pad];
  return { above, below, aboveH: above[1] - above[0], belowH: below[1] - below[0] };
}

function spawnDrone(c, P) {
  const fs = freeSpace(c, 8), h = 20;
  const opts = [];
  if (fs.aboveH >= h + 50) opts.push(fs.above);
  if (fs.belowH >= h + 50) opts.push(fs.below);
  if (!opts.length) return;
  const r = opts[Math.floor(RNG() * opts.length)];
  const y1 = r[0], y2 = r[1] - h;
  hazards.push({ type: 'drone', x: Math.round(c.xm), y: y1 + RNG() * (y2 - y1), py: 0, vy: (RNG() < 0.5 ? -1 : 1) * (P.speed || 1.5), y1, y2, w: 32, h, t: RNG() * 100 });
}

function spawnShard(c, P) {
  const len = 54 + Math.round(RNG() * 12), rad = len / 2, fs = freeSpace(c, -rad * 0.5);
  const opts = [];
  if (fs.aboveH >= rad * 2 + 4) opts.push(c.top - rad - 2);
  if (fs.belowH >= rad * 2 + 4) opts.push(c.bot + rad + 2);
  if (!opts.length) return;
  const y = opts[Math.floor(RNG() * opts.length)];
  hazards.push({ type: 'shard', x: Math.round(c.xm), y, len, wid: 15, ang: RNG() * TAU, pang: 0, spin: (RNG() < 0.5 ? -1 : 1) * (P.spin || 0.02), v: Math.floor(RNG() * 2) });
}

function spawnUpdraft(c, P) {
  const w = Math.min(110, c.x1 - c.x0 - 30);
  const x0 = Math.round(c.x0 + 8), x1 = x0 + w;
  hazards.push({ type: 'updraft', x: (x0 + x1) / 2, x0, x1, force: P.force || -0.25, t: 0 });
}

function spawnGear(c, P) {
  const r = 30 + Math.round(RNG() * 12), opts = [];
  const yTop = c.top - r - 3, yBot = c.bot + r + 3;
  if (yTop >= -r * 0.45) opts.push(['top', yTop]);
  if (yBot <= GROUND_Y + r * 0.45) opts.push(['bot', yBot]);
  if (!opts.length) return;
  const [mount, y] = opts[Math.floor(RNG() * opts.length)];
  hazards.push({ type: 'gear', x: Math.round(c.xm), y: Math.round(y), r, mount, ang: RNG() * TAU, pang: 0, spin: (RNG() < 0.5 ? -1 : 1) * 0.025, v: r > 36 ? 1 : 0 });
}

function spawnAsteroid(c, P) {
  const r = 13 + Math.round(RNG() * 9), opts = [];
  // Zeit, bis der Vogel die Korridormitte erreicht (ungefähr)
  const T = (c.xm - birdRightWorld()) / CONFIG.SCROLL_SPEED;
  if (c.top - r - 6 > 8 + r) opts.push(-1);
  if (c.bot + r + 6 < GROUND_Y - 8 - r) opts.push(1);
  if (!opts.length) return;
  const side = opts[Math.floor(RNG() * opts.length)];
  // Konstante Richtung: vom Flugband weg oder parallel dazu
  const vy = side * (0.04 + RNG() * 0.22), vx = -0.15 - RNG() * 0.5;
  const yPass = side < 0 ? c.top - r - 6 - RNG() * Math.max(0, c.top - 2 * r - 20) * 0.5 : c.bot + r + 6 + RNG() * Math.max(0, GROUND_Y - c.bot - 2 * r - 20) * 0.5;
  const y0 = yPass - vy * T, x0 = c.xm - vx * T;
  hazards.push({ type: 'asteroid', x: x0, y: y0, px: x0, py: y0, vx, vy, r, ang: RNG() * TAU, pang: 0, spin: (RNG() - 0.5) * 0.03, v: Math.floor(RNG() * 3) });
}

function maybeCrystal(p) {
  if (RNG() > 0.65) return;
  hazards.push({ type: 'light', x: p.slot + PW_ / 2, pipe: p, side: RNG() < 0.5 ? 'top' : 'bot', v: Math.floor(RNG() * 2) });
}

// ============================================================
// Fortschreiben
// ============================================================
function updateHazards(dt) {
  game.updraft = 0;
  const bx = birdRightWorld(), bcx = birdWorldX() + CONFIG.BIRD_W / 2;
  for (const h of hazards) {
    switch (h.type) {
      case 'icicle': case 'ember':
        if (h.state === 'hang' && bx >= h.trigX) { h.state = 'shake'; h.t = 0; }
        else if (h.state === 'shake') {
          h.t += dt;
          if (h.type === 'icicle' && Math.random() < 0.25 * dt) addParticle({ x: h.x - game.scroll + (Math.random() - 0.5) * h.w, y: 6, vy: 0.8, vx: 0, life: 26, size: 1.2, color: CREAM, kind: 'dot', grav: 0.08, scroll: true, alpha: 0.8 });
          if (h.t >= h.warn) { h.state = 'fall'; h.t = 0; sfx('hazard'); }
        } else if (h.state === 'fall') {
          h.y += h.speed * dt;
          h.x += h.drift * dt;
          if (h.y + h.len >= GROUND_Y - 2) {
            h.state = 'gone';
            const C = COLORS[game.level];
            burst(h.x - game.scroll, GROUND_Y - 4, h.type === 'icicle' ? 9 : 7, h.type === 'icicle' ? [CREAM, C.pipe, C.near] : [C.accent, CREAM], 2.6, 20,
              { kind: h.type === 'icicle' ? 'shard' : 'spark', vr: 0.2, grav: 0.12, scroll: true });
          }
        }
        break;
      case 'geyser':
        if (h.state === 'idle' && bx >= h.trigX) { h.state = 'warn'; h.t = 0; }
        else if (h.state === 'warn') {
          h.t += dt;
          if (Math.random() < 0.5 * dt) addParticle({ x: h.x - game.scroll + (Math.random() - 0.5) * h.w * 0.8, y: GROUND_Y - 2, vy: -0.6 - Math.random() * 0.6, life: 18, size: 1.5 + Math.random() * 2, kind: 'bubble', color: COLORS[game.level].accent, scroll: true });
          if (h.t >= h.warn) { h.state = 'active'; h.t = 0; sfx('hazard'); }
        } else if (h.state === 'active') {
          h.t += dt;
          h.jet = Math.min(1, h.jet + 0.14 * dt);
          if (h.t >= h.active) { h.state = 'done'; h.t = 0; }
        } else if (h.state === 'done') h.jet = Math.max(0, h.jet - 0.08 * dt);
        break;
      case 'liana':
        h.ang = Math.asin(Math.min(0.95, h.amp / h.len)) * Math.sin(h.phase + TAU * game.wt / h.period);
        break;
      case 'bolt':
        if (h.state === 'idle' && bx >= h.trigX) { h.state = 'warn'; h.t = 0; }
        else if (h.state === 'warn') { h.t += dt; if (h.t >= h.warn) { h.state = 'active'; h.t = 0; sfx('thunder'); flash(0.18, mix(CREAM, COLORS[game.level].accent, 0.4)); } }
        else if (h.state === 'active') { h.t += dt; if (h.t >= h.active) { h.state = 'done'; h.t = 0; } }
        else if (h.state === 'done') h.t += dt;
        break;
      case 'drone':
        h.t += dt;
        h.y += h.vy * dt;
        if (h.y <= h.y1) { h.y = h.y1; h.vy = Math.abs(h.vy); }
        else if (h.y >= h.y2) { h.y = h.y2; h.vy = -Math.abs(h.vy); }
        break;
      case 'shard': case 'gear':
        h.ang += h.spin * dt;
        break;
      case 'asteroid':
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.ang += h.spin * dt;
        break;
      case 'updraft':
        h.t += dt;
        if (bcx >= h.x0 && bcx <= h.x1) game.updraft += h.force;
        if (!SIM.on && h.x1 - game.scroll > -20 && h.x0 - game.scroll < W + 20 && Math.random() < 0.45 * dt) {
          addParticle({ x: h.x0 - game.scroll + 6 + Math.random() * (h.x1 - h.x0 - 12), y: GROUND_Y - Math.random() * 60, vx: 0, vy: -3 - Math.random() * 2,
            life: 70 + Math.random() * 40, size: 1.2, kind: 'streak', len: 16 + Math.random() * 14, color: rgba(CREAM, 0.55), scroll: true, fadeIn: 4 });
        }
        break;
    }
  }
  if (hazards.length && Math.random() < 0.2) hazards = hazards.filter(h => hazardRight(h) > game.scroll - 40 && h.state !== 'gone');
}

function hazardRight(h) {
  if (h.pipe) return pipeX(h.pipe) + PW_ + 40;
  switch (h.type) {
    case 'updraft': return h.x1;
    case 'liana': return h.x + h.amp + 20;
    case 'gear': return h.x + h.r;
    case 'asteroid': return h.x + h.r + 40;
  }
  return h.x + 40;
}

// Wind (ab Level 8): Böen alle every Frames für dur Frames, lead Frames vorher kündigt Flugsand sie an.
// Rückenwind (dir +1) macht den Flug schneller, Gegenwind (dir -1) langsamer: Das Tempo gleitet weich auf
// tail bzw. head und zurück. Dazu ein kleiner sichtbarer Versatz des Vogels in Windrichtung.
// Die Richtung jeder Böe hängt am Layout-Seed: Ein Neustart am Checkpoint und die Bot-Spule sehen denselben Wind.
const windOf = () => LEVELS[game.level].wind;
function updateWind(dt) {
  const P = windOf();
  if (!P) { wind.speed = 1; wind.state = 'calm'; return; }
  const every = P.every || 240, dur = P.dur || 90, lead = P.lead || 45;
  wind.t += dt;
  const cyc = wind.t % every, gustStart = every - dur, leadStart = gustStart - lead;
  const prev = wind.state;
  wind.state = cyc >= gustStart ? 'gust' : cyc >= leadStart ? 'lead' : 'calm';
  if (wind.state === 'lead' && prev === 'calm') {
    wind.n = Math.floor(wind.t / every);
    wind.dir = mulberry32(((game.layout ? game.layout.seed : 1) + wind.n * 7919) >>> 0)() < 0.5 ? -1 : 1;
  }
  const target = wind.state === 'gust' ? (wind.dir > 0 ? P.tail || 1.3 : P.head || 0.75) : 1;
  wind.speed += (target - wind.speed) * Math.min(1, 0.05 * dt);
  if (Math.abs(wind.speed - target) < 0.002) wind.speed = target;
  // Versatz unabhängig von der Bildbreite begrenzen, sonst wären breite Bildschirme schwerer
  const maxF = Math.min(W * 0.08, 30), maxB = Math.min(birdHomeX() - 26, 30);
  if (wind.state === 'gust') bird.dx = clamp(bird.dx + wind.dir * 0.4 * dt, -maxB, maxF);
  else bird.dx = Math.abs(bird.dx) < 0.5 * dt ? 0 : bird.dx - Math.sign(bird.dx) * 0.5 * dt;
  // Flugsand (spielrelevant, deshalb immer sichtbar)
  if (!SIM.on && wind.state !== 'calm') {
    const n = wind.state === 'gust' ? 2.4 : 0.9, C = COLORS[game.level];
    for (let k = 0; k < n * dt; k++) {
      const fromLeft = wind.dir > 0;
      addParticle({ x: fromLeft ? -20 : W + 20, y: 20 + Math.random() * (GROUND_Y - 30), vx: wind.dir * (6 + Math.random() * 4), vy: (Math.random() - 0.5) * 0.4,
        life: (W + 60) / 7, size: 1.1 + Math.random() * 0.7, kind: 'streak', len: 12 + Math.random() * 16, color: rgba(mix(C.pipe, CREAM, 0.35), 0.6), front: true });
    }
  }
}

// ============================================================
// Kollision (box in Bildschirmkoordinaten)
// ============================================================
function segBoxDist(x1, y1, x2, y2, b) {
  // Abstand Strecke zu Rechteck, über Abtastung (für dünne Seile ausreichend genau)
  let best = Infinity;
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const x = lerp(x1, x2, i / n), y = lerp(y1, y2, i / n);
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}
function rotPts(pts, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}
const SHARD_PTS = (len, wid) => [[-len / 2, 0], [-len / 2 + wid * 0.7, -wid / 2], [len / 2 - wid * 0.7, -wid / 2], [len / 2, 0], [len / 2 - wid * 0.7, wid / 2], [-len / 2 + wid * 0.7, wid / 2]];

function hazardHits(h, box) {
  const sx = h.x - game.scroll;
  switch (h.type) {
    case 'icicle':
      if (h.state === 'gone') return false;
      return polyHitsBox([[-h.w / 2 + 2, 0], [h.w / 2 - 2, 0], [0, h.len - 2]], sx, h.y - 2, box);
    case 'ember':
      return h.state === 'fall' && circleBox(sx, h.y + h.len / 2, 7, box);
    case 'geyser': {
      if (h.jet <= 0.05 || h.state === 'done') return false;
      const top = GROUND_Y - (GROUND_Y - h.top) * h.jet;
      return overlap(box, { x: sx - h.w / 2 + 4, y: top + 4, w: h.w - 8, h: GROUND_Y - top });
    }
    case 'liana': {
      const tx = sx + Math.sin(h.ang) * h.len, ty = -8 + Math.cos(h.ang) * h.len;
      return circleBox(tx, ty, 10, box) || segBoxDist(sx, -8, tx, ty, box) < 2.5;
    }
    case 'bolt':
      return h.state === 'active' && overlap(box, { x: sx - 10, y: -20, w: 20, h: h.yEnd + 20 });
    case 'drone':
      return overlap(box, { x: sx - h.w / 2 + 3, y: h.y + 3, w: h.w - 6, h: h.h - 6 });
    case 'shard':
      return polyHitsBox(rotPts(SHARD_PTS(h.len - 4, h.wid - 3), h.ang), sx, h.y, box);
    case 'gear':
      return circleBox(sx, h.y, h.r - 3, box);
    case 'asteroid':
      return circleBox(sx, h.y, h.r * 0.86, box);
  }
  return false;
}

const HAZARD_CAUSE = { icicle: 'Eiszapfen', ember: 'Glutbrocken', geyser: 'Geysir', liana: 'Liane', bolt: 'Blitz', drone: 'Drohne', shard: 'Kristall', gear: 'Zahnrad', asteroid: 'Asteroid' };

// ============================================================
// Sprites (einmal pro Level und Auflösung)
// ============================================================
function buildHazardSprites(li, ks) {
  const type = LEVELS[li].hazard.type, C = COLORS[li], out = { sprites: [] };
  const add = (key, s) => { out[key] = s; out.sprites.push(s); return s; };
  const tex = (seed, m) => ({ mottle: m || 0.18, grain: 0.07, seed: li * 31 + seed, contrast: 1.2, cells: 2 });
  switch (type) {
    case 'icicles':
      for (let v = 0; v < 2; v++) add('icicle' + v, makeSprite(-20, -10, 40, 76, ks, () => paintIcicle(C, v), tex(v, 0.12)));
      break;
    case 'embers':
      add('ember', makeSprite(-14, -14, 28, 28, ks, () => paintEmber(C), tex(3)));
      break;
    case 'lightning':
      add('cloud', makeSprite(-70, -40, 140, 76, ks, () => paintStormCloud(C), { grain: 0.05 }));
      break;
    case 'drones':
      add('drone', makeSprite(-24, -8, 48, 40, ks, () => paintDrone(C), tex(4, 0.1)));
      break;
    case 'shards':
      for (let v = 0; v < 2; v++) add('shard' + v, makeSprite(-40, -14, 80, 28, ks, () => paintShard(C, v), { grain: 0.05 }));
      break;
    case 'gears':
      for (let v = 0; v < 2; v++) { const r = v ? 42 : 34; add('gear' + v, makeSprite(-r - 4, -r - 4, r * 2 + 8, r * 2 + 8, ks, () => paintGear(C, r, v), tex(5 + v, 0.2))); }
      break;
    case 'asteroids':
      for (let v = 0; v < 3; v++) add('asteroid' + v, makeSprite(-26, -26, 52, 52, ks, () => paintAsteroid(C, v), tex(7 + v, 0.22)));
      break;
    case 'darkness':
      for (let v = 0; v < 2; v++) add('crystal' + v, makeSprite(-14, -22, 28, 44, ks, () => paintCrystal(C, v), { grain: 0.04 }));
      break;
  }
  return out;
}

function paintIcicle(C, v) {
  const ice = mix(C.pipe, CREAM, 0.55), lit = mix(ice, '#ffffff', 0.5), dark = shade(mix(C.pipe, C.accent, 0.3), -0.1);
  const len = 56, w = 18;
  // Eiskante an der Decke
  ctx.fillStyle = vgrad(-10, 0, [[0, shade(ice, -0.1)], [1, ice]]);
  roundRectPath(-17, -10, 34, 10, 4);
  ctx.fill();
  const pts = [[-w / 2, 0], [w / 2, 0], [v ? 2 : -1, len]];
  poly(pts, hgrad(-w / 2, w / 2, [[0, lit], [0.45, ice], [1, dark]]));
  poly([[0, 0], [w / 2, 0], [v ? 2 : -1, len]], rgba(dark, 0.45));
  line(-w / 2 + 3, 2, (v ? 2 : -1) - 1, len - 8, rgba('#ffffff', 0.7), 1.2);
  // kleine Nebenzapfen
  poly([[-15, 0], [-9, 0], [-12, 12 + v * 4]], ice);
  poly([[10, 0], [16, 0], [13, 9 + (1 - v) * 5]], shade(ice, -0.08));
  ctx.strokeStyle = rgba(INK, 0.25);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(v ? 2 : -1, len); ctx.lineTo(w / 2, 0);
  ctx.stroke();
}

function paintEmber(C) {
  ctx.fillStyle = rgrad(0, 0, 0, 14, [[0, rgba(C.accent, 0.55)], [1, rgba(C.accent, 0)]]);
  ctx.fillRect(-14, -14, 28, 28);
  const pts = [[-7, -3], [-3, -8], [4, -7], [8, -1], [5, 6], [-2, 8], [-7, 4]];
  poly(pts, mix(C.near, INK, 0.3));
  poly(pts.map(([x, y]) => [x * 0.7 - 0.5, y * 0.7 - 0.5]), mix(C.accent, '#ffd27a', 0.3));
  segs([[-4, -2, 2, 1], [1, -5, 3, 3], [-3, 4, 4, 2]], rgba(INK, 0.5), 1.1);
  circle(-2, -3, 1.8, rgba(CREAM, 0.8));
}

function paintStormCloud(C) {
  const dark = mix(C.skyTop, C.far, 0.5), lit = mix(C.far, C.accent, 0.25);
  const puffs = [[-44, 0, 22], [-20, -10, 28], [10, -14, 30], [38, -4, 24], [56, 6, 16], [-58, 10, 14], [0, 8, 26]];
  blobPath(puffs.map(([x, y, r]) => [x + 3, y + 5, r]));
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fill();
  blobPath(puffs);
  ctx.fillStyle = vgrad(-44, 34, [[0, lit], [0.55, dark], [1, shade(dark, -0.25)]]);
  ctx.fill();
  dots(puffs.filter(p => p[1] < 0).map(([x, y, r]) => [x - r * 0.25, y - r * 0.35, r * 0.45]), rgba(CREAM, 0.12));
}

function paintDrone(C) {
  const body = mix(C.near, C.far, 0.35), edge = mix(C.pipe, CREAM, 0.15), dark = rgba(INK, 0.7);
  ellipse(SHADOW.x * 0.5, 14 + SHADOW.y * 0.5, 18, 9, 0, rgba(INK, CONFIG.SHADOW_ALPHA));
  // Rotorarme mit Rotorscheiben
  ctx.fillStyle = shade(body, -0.25);
  ctx.fillRect(-23, 2, 46, 3.5);
  for (const sx of [-21, 21]) {
    ellipse(sx, 1, 8, 2.2, 0, rgba(edge, 0.55));
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(sx, 1, 8, 2.2, 0, 0, TAU);
    ctx.stroke();
  }
  roundRectPath(-16, 4, 32, 20, 7);
  ctx.fillStyle = vgrad(4, 24, [[0, shade(body, 0.22)], [1, shade(body, -0.28)]]);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  roundRectPath(-16, 4, 32, 20, 7);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  roundRectPath(-10, 9, 20, 8, 3);
  ctx.fillStyle = mix(INK, C.near, 0.2);
  ctx.fill();
  circle(0, 13, 3.2, C.accent);
  circle(-1, 12, 1.1, CREAM);
  line(-13, 24, -17, 30, shade(body, -0.35), 1.8);
  line(13, 24, 17, 30, shade(body, -0.35), 1.8);
}

function paintShard(C, v) {
  const base = v ? mix(C.accent, C.pipe, 0.35) : mix(C.accent, CREAM, 0.15), len = 66, wid = 15, pts = SHARD_PTS(len, wid);
  poly(pts.map(([x, y]) => [x + 2, y + 3]), rgba(INK, CONFIG.SHADOW_ALPHA));
  poly(pts, hgrad(-len / 2, len / 2, [[0, mix(base, CREAM, 0.45)], [0.5, base], [1, shade(base, -0.3)]]));
  poly([[-len / 2, 0], [-len / 2 + wid * 0.7, -wid / 2], [len / 2 - wid * 0.7, -wid / 2], [len / 2, 0]], rgba('#ffffff', 0.25));
  line(-len / 2 + 6, -1, len / 2 - 6, -1, rgba(CREAM, 0.85), 1.1);
  line(-8, -wid / 2 + 2, -2, wid / 2 - 2, rgba('#ffffff', 0.5), 2);
  line(10, -wid / 2 + 2, 15, wid / 2 - 2, rgba('#9fe8ff', 0.55), 1.5);
  const outline = (col, lw) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  };
  outline(rgba(INK, 0.6), 2.2);
  outline(rgba(CREAM, 0.7), 0.9);
}

function paintGear(C, r, v) {
  const brass = v ? mix(C.accent, C.pipe, 0.35) : mix(C.accent, C.pipe, 0.15), teeth = v ? 14 : 11, rin = r - 7;
  const path = (ox, oy) => {
    ctx.beginPath();
    for (let k = 0; k < teeth; k++) {
      const a0 = k * TAU / teeth, a1 = a0 + TAU / teeth * 0.18, a2 = a0 + TAU / teeth * 0.32, a3 = a0 + TAU / teeth * 0.5;
      const P = (a, rr) => [ox + Math.cos(a) * rr, oy + Math.sin(a) * rr];
      const p0 = P(a0, rin), p1 = P(a1, r), p2 = P(a2, r), p3 = P(a3, rin);
      if (k === 0) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
      ctx.arc(ox, oy, rin, a3, a0 + TAU / teeth);
    }
    ctx.closePath();
  };
  path(2.5, 3.5);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fill();
  path(0, 0);
  ctx.fillStyle = rgrad(0, 0, 2, r, [[0, mix(brass, CREAM, 0.35)], [0.6, brass], [1, shade(brass, -0.3)]], -r * 0.35, -r * 0.4);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.65);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Speichen und Nabe
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, rin - 6, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgba(INK, 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, rin - 6, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    ctx.save();
    ctx.rotate(k * TAU / 5);
    ctx.fillStyle = hgrad(-4, 4, [[0, shade(brass, 0.15)], [1, shade(brass, -0.2)]]);
    ctx.fillRect(-3.5, 0, 7, rin);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = shade(brass, -0.25);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, rin - 6, 0, TAU);
  ctx.stroke();
  circle(0, 0, 8, rgrad(0, 0, 1, 8, [[0, mix(brass, CREAM, 0.4)], [1, shade(brass, -0.3)]], -2, -2));
  circle(0, 0, 3, mix(INK, C.near, 0.3));
  const riv = [];
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + 0.6; riv.push([Math.cos(a) * (rin - 2.5), Math.sin(a) * (rin - 2.5), 1.3]); }
  dots(riv, rgba(CREAM, 0.45));
}

function paintAsteroid(C, v) {
  const rock = mix(C.pipe, INK, 0.45), r = 22, rng = mulberry32(31 + v * 7), pts = [];
  for (let k = 0; k < 11; k++) { const a = k * TAU / 11, rr = r * (0.8 + rng() * 0.22); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  poly(pts.map(([x, y]) => [x + 2, y + 3]), rgba(INK, CONFIG.SHADOW_ALPHA));
  smoothPath(pts);
  ctx.fillStyle = rgrad(-r * 0.2, -r * 0.25, 2, r * 1.2, [[0, shade(rock, 0.25)], [0.55, rock], [1, shade(rock, -0.5)]], -r * 0.4, -r * 0.45);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.6);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let k = 0; k < 5; k++) {
    const x = (rng() - 0.5) * r * 1.3, y = (rng() - 0.5) * r * 1.3, cr = 2.5 + rng() * 4.5;
    circle(x + cr * 0.15, y + cr * 0.15, cr, rgba(INK, 0.35));
    circle(x - cr * 0.1, y - cr * 0.1, cr * 0.8, rgba(shade(rock, -0.12), 0.95));
  }
  ctx.restore();
  ctx.strokeStyle = rgba(mix(C.accent, CREAM, 0.3), 0.45);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
}

function paintCrystal(C, v) {
  const col = v ? mix(C.accent, '#b6a8ff', 0.4) : C.accent;
  ctx.fillStyle = rgrad(0, 0, 0, 20, [[0, rgba(col, 0.45)], [1, rgba(col, 0)]]);
  ctx.fillRect(-14, -20, 28, 40);
  const shapes = [[[-3, 10], [-6, -6], [-1, -16], [3, -5], [2, 10]], [[1, 10], [5, -2], [9, -9], [10, 3], [7, 10]], [[-8, 10], [-11, 2], [-9, -3], [-5, 4], [-4, 10]]];
  shapes.forEach((pts, i) => {
    poly(pts, hgrad(-11, 10, [[0, mix(col, CREAM, 0.55)], [0.5, col], [1, shade(col, -0.3)]]));
    line(pts[1][0] + 1, pts[1][1] + 2, pts[2][0], pts[2][1] + 3, rgba('#ffffff', 0.6), 0.8);
  });
}

// ============================================================
// Zeichnen. Hazards hinter den Säulen (Wolken, Aufwind, Geysir-Düse)
// und davor (alles, was trifft).
// ============================================================
function drawHazards(cache, a, front, camX) {
  const hs = cache.hazard || {}, C = COLORS[game.level];
  for (const h of hazards) {
    // Kristalle hängen an ihrer Säule und schwanken mit ihr
    const sx = (h.pipe ? pipeXa(h.pipe, a) + PW_ / 2 : h.x) - camX;
    if (sx < -140 || sx > W + 140) continue;
    switch (h.type) {
      case 'updraft':
        if (front) break;
        drawUpdraft(h, h.x0 - camX, C);
        break;
      case 'geyser':
        if (front) drawGeyserJet(h, sx, C, a); else drawGeyserVent(h, sx, C);
        break;
      case 'bolt':
        if (!front) {
          if (hs.cloud) drawSpriteAt(hs.cloud, sx, 26);
          if (h.state === 'warn' || h.state === 'active') {
            const p = h.state === 'warn' ? h.t / h.warn : 1, fl = (Math.floor(h.t / 3) % 2) ? 1 : 0.55;
            ctx.drawImage(glowSprite(C.accent), sx - 50, -10, 100, 70 + 20 * p);
            ctx.globalAlpha = (0.3 + 0.5 * p) * fl;
            ctx.drawImage(glowSprite(CREAM), sx - 30, 10, 60, 40);
            ctx.globalAlpha = 1;
          }
        }
        else drawBolt(h, sx, C);
        break;
      case 'icicle': {
        if (!front || h.state === 'gone') break;
        const y = lerp(h.py, h.y, a), jit = h.state === 'shake' ? Math.sin(h.t * 2.1) * 1.6 : 0;
        const s = hs['icicle' + h.v];
        const scl = h.len / 56;
        // Schatten
        poly([[sx - h.w / 2 + SHADOW.x * 0.5, y + SHADOW.y * 0.5], [sx + h.w / 2 + SHADOW.x * 0.5, y + SHADOW.y * 0.5], [sx + SHADOW.x * 0.5, y + h.len + SHADOW.y * 0.5]], rgba(INK, CONFIG.SHADOW_ALPHA));
        if (s) drawSpriteScaled(s, sx + jit, y - 2, h.w / 18, scl);
        if (h.state === 'shake') {
          ctx.strokeStyle = rgba(CREAM, 0.5 + 0.4 * Math.sin(h.t * 0.6));
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx + jit, y + 4, 12, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
        break;
      }
      case 'ember': {
        if (!front || h.state === 'gone') break;
        if (h.state === 'shake') {
          const p = h.t / h.warn;
          ctx.drawImage(glowSprite(C.accent), sx - 22, -18, 44, 36 + 16 * p);
          circle(sx, 3, 3 + 3 * p, rgba(mix(C.accent, CREAM, 0.4), 0.5 + 0.5 * p));
        } else if (h.state === 'fall' && hs.ember) {
          const y = lerp(h.py, h.y, a) + h.len / 2;
          ctx.drawImage(glowSprite(C.accent), sx - 26, y - 26, 52, 52);
          drawSpriteAt(hs.ember, sx, y);
        }
        break;
      }
      case 'liana': if (front) drawLiana(h, sx, C, lerp(h.pang, h.ang, a)); break;
      case 'drone': {
        if (!front) break;
        const y = lerp(h.py, h.y, a);
        // dunkler Hof trennt die Drohne von der bunten Stadt dahinter
        ctx.drawImage(glowSprite(INK), sx - 34, y - 26, 68, 60);
        if (hs.drone) drawSpriteAt(hs.drone, sx, y - 4);
        const on = Math.floor(h.t / 16) % 2 === 0, warn = '#ff6b6b';
        circle(sx, y - 1, 2.6, on ? warn : rgba(warn, 0.35));
        if (on) ctx.drawImage(glowSprite(warn), sx - 12, y - 13, 24, 24);
        // Spur der Patrouille: zeigt, wie weit die Drohne fliegt
        ctx.strokeStyle = rgba(C.accent, 0.22);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, h.y1 + 10);
        ctx.lineTo(sx, h.y2 + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'shard':
        if (!front) { ctx.drawImage(glowSprite(C.accent), sx - h.len * 0.75, h.y - h.len * 0.75, h.len * 1.5, h.len * 1.5); break; }
        if (hs['shard' + h.v]) drawSpriteRot(hs['shard' + h.v], sx, h.y, lerp(h.pang, h.ang, a), (h.len) / 66);
        break;
      case 'gear': {
        if (!front) { drawGearMount(h, sx, C); break; }
        const s = hs['gear' + h.v];
        if (s) drawSpriteRot(s, sx, h.y, lerp(h.pang, h.ang, a), h.r / (h.v ? 42 : 34));
        break;
      }
      case 'asteroid': {
        if (!front) break;
        const s = hs['asteroid' + h.v];
        if (s) drawSpriteRot(s, lerp(h.px, h.x, a) - camX, lerp(h.py, h.y, a), lerp(h.pang, h.ang, a), h.r / 22);
        break;
      }
      case 'light': {
        if (!front) break;
        const p = h.pipe, gy = lerp(p.pgapY, p.gapY, a), y = h.side === 'top' ? gy - 4 : gy + p.gap + 4;
        const s = hs['crystal' + h.v];
        if (s) {
          ctx.save();
          ctx.translate(sx, y);
          if (h.side === 'top') ctx.scale(1, -1);
          drawSpriteAt(s, 0, -10);
          ctx.restore();
        }
        break;
      }
    }
  }
}

function drawSpriteAt(s, x, y) {
  ctx.drawImage(s.c, x + s.x0, y + s.y0, s.w, s.h);
}
function drawSpriteScaled(s, x, y, sxScale, syScale) {
  ctx.drawImage(s.c, x + s.x0 * sxScale, y + s.y0 * syScale, s.w * sxScale, s.h * syScale);
}
function drawSpriteRot(s, x, y, ang, scl) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (scl !== 1) ctx.scale(scl, scl);
  ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h);
  ctx.restore();
}

function drawUpdraft(h, x0, C) {
  const w = h.x1 - h.x0, tint = mix(C.skyTop, C.pipe, 0.5), edge = shade(C.pipe, -0.25);
  ctx.fillStyle = hgrad(x0, x0 + w, [[0, rgba(tint, 0.05)], [0.5, rgba(tint, 0.2)], [1, rgba(tint, 0.05)]]);
  ctx.fillRect(x0, 0, w, GROUND_Y);
  ctx.strokeStyle = rgba(edge, 0.3);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(x0, 0); ctx.lineTo(x0, GROUND_Y);
  ctx.moveTo(x0 + w, 0); ctx.lineTo(x0 + w, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  // aufsteigende Winkel als Richtungsanzeige
  const off = (h.t * 1.1) % 70;
  for (let i = 0; i < 2; i++) {
    const xx = x0 + w * (0.33 + i * 0.34);
    for (let y = GROUND_Y - 20 - off - i * 35; y > 20; y -= 70) {
      for (const [col, lw, dy] of [[rgba(edge, 0.35), 3.2, 1.2], [rgba(CREAM, 0.85), 1.6, 0]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(xx - 7, y + 6 + dy); ctx.lineTo(xx, y + dy); ctx.lineTo(xx + 7, y + 6 + dy);
        ctx.stroke();
      }
    }
  }
}

function drawGeyserVent(h, sx, C) {
  const glow = h.state === 'warn' ? 0.35 + 0.35 * Math.sin(h.t * 0.5) : h.state === 'active' ? 0.8 : 0.18;
  ctx.drawImage(glowSprite(C.accent), sx - 26, GROUND_Y - 16, 52, 30);
  ellipse(sx, GROUND_Y + 2, h.w * 0.55, 5, 0, mix(INK, C.near, 0.3));
  ellipse(sx, GROUND_Y + 1.5, h.w * 0.4, 3, 0, rgba(mix(C.accent, '#ffd27a', 0.3), glow));
}

function drawGeyserJet(h, sx, C, a) {
  if (h.jet <= 0.02) return;
  const top = GROUND_Y - (GROUND_Y - h.top) * h.jet, w = h.w, hot = mix(C.accent, '#ffd27a', 0.35), core = mix(hot, CREAM, 0.5);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fillRect(sx - w / 2 + SHADOW.x * 0.5, top + SHADOW.y * 0.5, w, GROUND_Y - top);
  ctx.drawImage(glowSprite(C.accent), sx - w * 1.4, top - 20, w * 2.8, GROUND_Y - top + 30);
  const wob = Math.sin(frame * 0.35) * 2;
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, GROUND_Y);
  ctx.quadraticCurveTo(sx - w / 2 - 3 + wob, (top + GROUND_Y) / 2, sx - w * 0.38, top + 8);
  ctx.quadraticCurveTo(sx, top - 10, sx + w * 0.38, top + 8);
  ctx.quadraticCurveTo(sx + w / 2 + 3 - wob, (top + GROUND_Y) / 2, sx + w / 2, GROUND_Y);
  ctx.closePath();
  ctx.fillStyle = hgrad(sx - w / 2, sx + w / 2, [[0, shade(C.accent, -0.2)], [0.35, hot], [0.7, C.accent], [1, shade(C.accent, -0.35)]]);
  ctx.fill();
  ctx.fillStyle = vgrad(top, GROUND_Y, [[0, rgba(core, 0.9)], [1, rgba(core, 0.25)]]);
  ctx.fillRect(sx - w * 0.12, top + 6, w * 0.24, GROUND_Y - top - 6);
  // Spritzer an der Spitze
  const r = mulberry32(Math.floor(frame / 4) + h.x);
  const drops = [];
  for (let k = 0; k < 7; k++) drops.push([sx + (r() - 0.5) * w * 1.5, top - r() * 16, 1.5 + r() * 2.5]);
  dots(drops, hot);
}

function drawBolt(h, sx, C) {
  if (h.state === 'idle') return;
  const bc = mix(CREAM, C.accent, 0.35);
  const r = mulberry32(h.seed + Math.floor(frame / 5));
  const pts = [];
  for (let y = 18; y < h.yEnd; y += 16) pts.push([sx + (r() - 0.5) * 16, y]);
  pts.push([sx + (r() - 0.5) * 6, h.yEnd]);
  if (h.state === 'warn') {
    // flackernde Vorschau des Blitzwegs, immer deutlicher, am Ende ein Lichtpunkt
    const p = h.t / h.warn, flick = (Math.floor(h.t / 4) % 2) ? 1 : 0.4;
    ctx.fillStyle = rgba(C.accent, (0.04 + 0.1 * p) * flick);
    ctx.fillRect(sx - 12, 0, 24, h.yEnd);
    ctx.strokeStyle = rgba(bc, (0.15 + 0.45 * p) * flick);
    ctx.lineWidth = 1.2 + p;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.drawImage(glowSprite(C.accent), sx - 16, h.yEnd - 16, 32, 32);
    circle(sx, h.yEnd, 2 + 2 * p, rgba(bc, 0.5 + 0.4 * p));
    return;
  }
  const al = h.state === 'active' ? 1 : Math.max(0, 1 - h.t / 12);
  if (al <= 0) return;
  ctx.fillStyle = rgba(C.accent, 0.22 * al);
  ctx.fillRect(sx - 12, 0, 24, h.yEnd);
  for (const [lw, col] of [[8, rgba(C.accent, 0.3 * al)], [3, rgba(bc, 0.9 * al)], [1.2, rgba(CREAM, al)]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.drawImage(glowSprite(CREAM), sx - 20, h.yEnd - 20, 40, 40);
}

function drawLiana(h, sx, C, ang) {
  const tx = sx + Math.sin(ang) * h.len, ty = -8 + Math.cos(ang) * h.len;
  const mx = (sx + tx) / 2 - Math.sin(ang) * 10, my = (-8 + ty) / 2 + 6;
  const vine = mix(C.near, C.pipe, 0.45);
  // Schatten
  ctx.strokeStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx + SHADOW.x * 0.5, -8 + SHADOW.y * 0.5);
  ctx.quadraticCurveTo(mx + SHADOW.x * 0.5, my + SHADOW.y * 0.5, tx + SHADOW.x * 0.5, ty + SHADOW.y * 0.5);
  ctx.stroke();
  ctx.strokeStyle = shade(vine, -0.25);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx, -8);
  ctx.quadraticCurveTo(mx, my, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = shade(vine, 0.12);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - 1, -8);
  ctx.quadraticCurveTo(mx - 1, my, tx - 1, ty);
  ctx.stroke();
  // Blätter entlang der Ranke
  const r = mulberry32(h.seed);
  for (let i = 1; i < 6; i++) {
    const t = i / 6, x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * tx, y = (1 - t) * (1 - t) * -8 + 2 * (1 - t) * t * my + t * t * ty;
    const side = i % 2 ? 1 : -1;
    ellipse(x + side * 6, y + 2, 7, 3, side * 0.6 + ang, shade(C.accent, -0.35 + r() * 0.2));
  }
  // Blattbüschel am Ende
  const bl = [[tx, ty + 2, 10], [tx - 7, ty - 3, 7], [tx + 7, ty - 2, 7], [tx, ty + 9, 6]];
  blobPath(bl.map(([x, y, rr]) => [x + 2, y + 3, rr]));
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fill();
  blobPath(bl);
  ctx.fillStyle = rgrad(tx - 3, ty - 3, 1, 14, [[0, shade(C.accent, 0.1)], [0.6, shade(C.accent, -0.3)], [1, shade(C.near, 0.1)]]);
  ctx.fill();
}

function drawGearMount(h, sx, C) {
  const col = shade(mix(C.pipe, INK, 0.3), -0.1);
  if (h.mount === 'top') {
    ctx.fillStyle = hgrad(sx - 4, sx + 4, [[0, shade(col, 0.2)], [1, shade(col, -0.2)]]);
    ctx.fillRect(sx - 3.5, -10, 7, h.y + 10);
  } else {
    poly([[sx - 9, GROUND_Y + 4], [sx - 4, h.y], [sx + 4, h.y], [sx + 9, GROUND_Y + 4]], hgrad(sx - 9, sx + 9, [[0, shade(col, 0.2)], [1, shade(col, -0.25)]]));
  }
}

// ============================================================
// Dunkelheit mit Sichtradius: ein radialer Verlauf um den Vogel, außen
// nicht ganz schwarz; Leuchtkristalle und Glut hellen ihre Umgebung auf.
// Ein einziger Füllvorgang pro Bild, damit es auch ohne Grafikbeschleunigung flüssig bleibt.
// ============================================================
// Vorberechnetes Lichtloch (radialer Verlauf, aussen deckend) in Gerätepixeln: pro Bild nur eine
// 1:1-Kopie plus vier einfarbige Rechtecke drumherum, ohne Skalierung und ohne Verlauf pro Pixel
const darkFx = { c: null, key: '' };
function darkSprite(sight, col, maxA) {
  const k = view.k, key = [sight, col, maxA.toFixed(3), k].join('|');
  if (darkFx.key !== key) {
    const n = Math.ceil(sight * 2 * k) + 2;
    if (!darkFx.c) darkFx.c = newCanvas(n, n);
    if (darkFx.c.width !== n) { darkFx.c.width = n; darkFx.c.height = n; }
    const g = darkFx.c.getContext('2d'), r = n / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, n, n);
    const gr = g.createRadialGradient(r, r, sight * 0.4 * k, r, r, sight * k);
    gr.addColorStop(0, rgba(col, 0));
    gr.addColorStop(0.45, rgba(col, maxA * 0.5));
    gr.addColorStop(1, rgba(col, maxA));
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
    darkFx.key = key;
    warmUp(darkFx.c);
  }
  return darkFx.c;
}

function drawDarkness(a, strength) {
  const sight = sightRadius();
  if (!sight || strength <= 0.01) return;
  const C = COLORS[game.level], col = mix(INK, C.near, 0.35), maxA = (hazardType() === 'embers' ? 0.8 : 0.88);
  const bx = lerp(bird.px, bird.x, a) + CONFIG.BIRD_W / 2, by = lerp(bird.py, bird.y, a) + CONFIG.BIRD_H / 2;
  const spr = darkSprite(sight, col, maxA), n = spr.width, cw = canvas.width, ch = canvas.height;
  const ox = Math.round(bx * view.k - n / 2), oy = Math.round(by * view.k - n / 2);
  ctx.save();
  devT();
  ctx.globalAlpha = strength;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, ox, oy);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = rgba(col, maxA);
  const pad = 24;
  if (oy > -pad) ctx.fillRect(-pad, -pad, cw + pad * 2, oy + pad);
  if (oy + n < ch + pad) ctx.fillRect(-pad, oy + n, cw + pad * 2, ch + pad - oy - n);
  if (ox > -pad) ctx.fillRect(-pad, Math.max(-pad, oy), ox + pad, Math.min(n, ch + pad - oy));
  if (ox + n < cw + pad) ctx.fillRect(ox + n, Math.max(-pad, oy), cw + pad - ox - n, Math.min(n, ch + pad - oy));
  ctx.restore();
  // Lichtquellen: Kristalle an den Säulen, fallende Glut
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const camX = lerp(game.prevScroll, game.scroll, a);
  for (const hz of hazards) {
    const sx = (hz.pipe ? pipeXa(hz.pipe, a) + PW_ / 2 : hz.x) - camX;
    if (sx < -100 || sx > W + 100) continue;
    if (hz.type === 'light') {
      const p = hz.pipe, gy = lerp(p.pgapY, p.gapY, a), y = hz.side === 'top' ? gy - 10 : gy + p.gap + 10;
      ctx.globalAlpha = 0.42 * strength;
      ctx.drawImage(glowSprite(C.accent), sx - 70, y - 70, 140, 140);
    } else if (hz.type === 'ember' && hz.state !== 'hang' && hz.state !== 'gone') {
      const y = hz.state === 'fall' ? lerp(hz.py, hz.y, a) + 8 : 6;
      ctx.globalAlpha = 0.35 * strength;
      ctx.drawImage(glowSprite(C.accent), sx - 56, y - 56, 112, 112);
    }
  }
  ctx.restore();
  // Säulenkanten bleiben schwach sichtbar
  logT();
  ctx.strokeStyle = rgba(mix(CREAM, C.accent, 0.35), 0.24 * strength);
  ctx.lineWidth = 1.2;
  for (const p of pipes) {
    const x = pipeXa(p, a) - (lerp(game.prevScroll, game.scroll, a)), gy = lerp(p.pgapY, p.gapY, a);
    if (x > W + 10 || x + PW_ < -10) continue;
    // Gekippte Paare: Umriss mitdrehen (um die Lückenmitte), sonst stimmt er nicht mit der Säule überein
    const ang = p.tamp ? lerp(p.pang, p.ang, a) : 0;
    ctx.save();
    if (ang) { const px = x + PW_ / 2, py = gy + p.gap / 2; ctx.translate(px, py); ctx.rotate(ang); ctx.translate(-px, -py); }
    const ext = ang ? 60 : 0;
    const o = pipeOxa(p, a);
    ctx.beginPath();
    ctx.moveTo(x + o, -ext); ctx.lineTo(x + o, gy); ctx.lineTo(x + o + PW_, gy); ctx.lineTo(x + o + PW_, -ext);
    ctx.moveTo(x - o, GROUND_Y + ext); ctx.lineTo(x - o, gy + p.gap); ctx.lineTo(x - o + PW_, gy + p.gap); ctx.lineTo(x - o + PW_, GROUND_Y + ext);
    ctx.stroke();
    ctx.restore();
  }
}

