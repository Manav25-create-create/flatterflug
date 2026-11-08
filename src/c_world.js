// ============================================================
// Laufzeitobjekte. Weltkoordinaten: x wächst nach rechts, der linke
// Bildrand liegt bei game.scroll. Alles Bewegte wird mit dem
// Zeitfaktor dt fortgeschrieben (1 normal, 0.6 in Zeitlupe; die Zeitlupe
// bremst nur die Welt, der Vogel fliegt in normalem Tempo).
// ============================================================
let bird = null, pipes = [], hazards = [], pickups = [], shots = [], attacks = [], particles = [], boss = null;
const PHYS = LEVELS.map(L => Object.assign(
  { GRAVITY: CONFIG.GRAVITY, FLAP_IMPULSE: CONFIG.FLAP_IMPULSE, MAX_FALL_SPEED: CONFIG.MAX_FALL_SPEED },
  L.physicsOverride
));
// Autotest: ohne Partikel, Ton und Speichern, mit festem Zufall
const SIM = { on: false };
const PW_ = CONFIG.PIPE_WIDTH;

// ============================================================
// Partikel: Lebensdauer mit Alpha-Fade, generisch über kind
// ============================================================
function addParticle(o) {
  if (SIM.on) return null;
  if (particles.length >= CONFIG.PARTICLE_MAX) particles.shift();
  const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 30, size: 2, color: CREAM, kind: 'dot', grav: 0, drag: 1,
    rot: 0, vr: 0, alpha: 1, front: false, scroll: false, grow: 0 }, o);
  p.max = p.life;
  p.px = p.x; p.py = p.y;
  particles.push(p);
  return p;
}

function burst(x, y, n, colors, speed, life, extra) {
  if (SIM.on) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
    addParticle(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life + Math.floor(Math.random() * 15) - 6,
      size: 1.5 + Math.random() * 1.9, color: colors[Math.floor(Math.random() * colors.length)], drag: 0.94, grav: 0.05 }, extra || {}));
  }
}

function updateParticles(dt) {
  if (!particles.length) return;
  const sc = CONFIG.SCROLL_SPEED * dt;
  for (const p of particles) {
    const dr = p.drag === 1 ? 1 : Math.pow(p.drag, dt);
    p.vx *= dr;
    p.vy = p.vy * dr + p.grav * dt;
    p.x += p.vx * dt - (p.scroll ? sc : 0);
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.grow) p.size = Math.max(0.1, p.size + p.grow * dt);
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0 && p.x > -80 && p.x < W + 80 && p.y > -80 && p.y < H + 40);
}

function drawParticles(front, a) {
  for (const p of particles) {
    if (p.front !== front) continue;
    const t = p.life / p.max, al = p.alpha * (p.fadeIn ? Math.min(1, (1 - t) * p.fadeIn) : 1) * ease.outCubic(t);
    if (al <= 0.01) continue;
    const x = lerp(p.px, p.x, a), y = lerp(p.py, p.y, a);
    ctx.globalAlpha = al;
    drawParticle(p, x, y);
  }
  ctx.globalAlpha = 1;
}

function drawParticle(p, x, y) {
  const s = p.size;
  switch (p.kind) {
    case 'dot': circle(x, y, s, p.color); break;
    case 'puff':
      ctx.drawImage(glowSprite(p.color), x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2);
      break;
    case 'spark': case 'ember': {
      const g = glowSprite(p.color);
      ctx.drawImage(g, x - s * 3, y - s * 3, s * 6, s * 6);
      circle(x, y, s * 0.55, p.kind === 'ember' ? mix(p.color, CREAM, 0.5) : CREAM);
      break;
    }
    case 'streak': {
      const len = p.len || 10, sp = Math.hypot(p.vx, p.vy) || 1;
      line(x, y, x - p.vx / sp * len, y - p.vy / sp * len, p.color, s);
      break;
    }
    case 'snow': circle(x, y, s, p.color); circle(x - s * 0.3, y - s * 0.3, s * 0.45, rgba('#ffffff', 0.7)); break;
    case 'bubble':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.8, s * 0.28);
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.stroke();
      circle(x - s * 0.35, y - s * 0.35, s * 0.25, rgba(CREAM, 0.8));
      break;
    case 'pixel':
      ctx.fillStyle = p.color;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      break;
    case 'star':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const r = k % 2 ? s * 0.35 : s * 1.4, an = p.rot + k * Math.PI / 4;
        if (k) ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); else ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'ring':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.stroke();
      break;
    case 'feather': case 'confetti': case 'shard': case 'leaf': case 'frost': case 'prism': case 'cog':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      if (p.kind === 'feather') {
        ellipse(0, 0, s * 2, s * 0.8, 0, p.color);
        line(-s * 2, 0, s * 2, 0, rgba(INK, 0.25), 0.6);
      } else if (p.kind === 'leaf') {
        ellipse(0, 0, s * 1.6, s * 0.7, 0, p.color);
        line(-s * 1.4, 0, s * 1.4, 0, rgba(INK, 0.2), 0.5);
      } else if (p.kind === 'shard' || p.kind === 'prism') {
        poly([[-s, 0], [0, -s * 1.8], [s, 0]], p.color);
        if (p.kind === 'prism') poly([[0, -s * 1.8], [s, 0], [0, 0]], rgba('#ffffff', 0.35));
      } else if (p.kind === 'frost') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const an = k * Math.PI / 3; ctx.moveTo(Math.cos(an) * s, Math.sin(an) * s); ctx.lineTo(-Math.cos(an) * s, -Math.sin(an) * s); }
        ctx.stroke();
      } else if (p.kind === 'cog') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let k = 0; k < 12; k++) { const r = k % 2 ? s * 0.75 : s, an = k * TAU / 12; if (k) ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); else ctx.moveTo(r, 0); }
        ctx.closePath();
        ctx.fill();
        circle(0, 0, s * 0.3, rgba(INK, 0.5));
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9 * Math.abs(Math.cos(p.rot * 2)) + 0.4);
      }
      ctx.restore();
      break;
  }
}

// ============================================================
// Bildschirmwackeln: Amplitude und Abklingzeit in Frames
// ============================================================
const shakeFx = { amp: 0, t: 0, dur: 1, x: 0, y: 0 };
function shake(amp, dur) {
  if (SIM.on || REDUCED_MOTION) return;
  if (shakeFx.t > 0 && shakeFx.amp * (shakeFx.t / shakeFx.dur) >= amp) return;
  shakeFx.amp = amp;
  shakeFx.t = dur;
  shakeFx.dur = dur;
}
function updateShake() {
  if (shakeFx.t <= 0) { shakeFx.x = shakeFx.y = 0; return; }
  const k = shakeFx.amp * (shakeFx.t / shakeFx.dur);
  shakeFx.x = (Math.random() * 2 - 1) * k;
  shakeFx.y = (Math.random() * 2 - 1) * k;
  shakeFx.t--;
}
// Transformationen mit Wackelversatz: logische Einheiten bzw. Gerätepixel
function logT() { ctx.setTransform(view.k, 0, 0, view.k, Math.round(shakeFx.x * view.k), Math.round(shakeFx.y * view.k)); }
function devT() { ctx.setTransform(1, 0, 0, 1, Math.round(shakeFx.x * view.k), Math.round(shakeFx.y * view.k)); }

// ============================================================
// Vogel
// ============================================================
function makeBird() {
  const b = { x: birdHomeX(), dx: 0, y: CONFIG.BIRD_START_Y, vy: 0, rot: 0, flapT: 99, hoverY: CONFIG.BIRD_START_Y,
    dead: false, idle: true, grounded: false, inv: 0, lastFlap: -1, ceilT: 0, trailT: 0 };
  b.px = b.x; b.py = b.y; b.prot = 0;
  return b;
}

// Nie zwei Flaps im selben Schritt, egal wie viele Eingaben eintreffen
function flapBird() {
  if (!bird || bird.dead || bird.lastFlap === frame) return false;
  bird.lastFlap = frame;
  bird.vy = PHYS[game.level].FLAP_IMPULSE;
  bird.flapT = 0;
  bird.idle = false;
  sfx('flap');
  return true;
}

const birdScale = () => (abil.shrink > 0 ? CONFIG.SHRINK_SCALE : abil.grow > 0 ? CONFIG.GROW_SCALE : 1);

// mode: 'physics' (Spieler), 'hover' (Levelstart), 'auto' (nach dem Boss), 'dead'
function updateBird(mode, dt) {
  const P = PHYS[game.level];
  bird.flapT += dt;
  bird.x = birdHomeX() + bird.dx;
  if (bird.inv > 0) bird.inv--;
  if (bird.ceilT > 0) bird.ceilT--;
  if (mode === 'hover') {
    bird.idle = true;
    bird.hoverY += ((bird.hoverTarget || CONFIG.BIRD_START_Y) - bird.hoverY) * 0.04;
    bird.y = bird.hoverY + Math.sin(frame * 0.06) * 5;
    bird.vy = 0;
    bird.rot += (Math.sin(frame * 0.06 + 1) * 0.06 - bird.rot) * 0.2;
  } else if (mode === 'auto') {
    bird.idle = true;
    const target = CONFIG.BIRD_START_Y + Math.sin(frame * 0.04) * 8;
    bird.vy += (target - bird.y) * 0.012 - bird.vy * 0.09;
    bird.y += bird.vy;
    bird.dx *= 0.95;
    bird.rot += (clamp(bird.vy * 0.06, -0.3, 0.3) - bird.rot) * 0.1;
  } else if (mode === 'dead') {
    if (!bird.grounded) {
      bird.vy = Math.min(bird.vy + P.GRAVITY, P.MAX_FALL_SPEED);
      bird.y += bird.vy;
      if (bird.y + CONFIG.BIRD_H >= GROUND_Y) { bird.y = GROUND_Y - CONFIG.BIRD_H; bird.grounded = true; bird.vy = 0; }
    }
    bird.rot += (1.45 - bird.rot) * 0.12;
  } else {
    bird.vy = Math.min(bird.vy + P.GRAVITY * gravityFactor() * dt, P.MAX_FALL_SPEED);
    // Aufwind: zieht den Vogel mit konstanten -0.25 px pro Frame nach oben
    bird.y += (bird.vy + game.updraft) * dt;
    // Decke: sanft abprallen statt sterben
    const top = bird.y + CONFIG.BIRD_H / 2 * (1 - birdScale());
    if (top < 0) ceilingBounce(-top);
    const target = bird.vy < 0 ? -0.38 : clamp(bird.vy / P.MAX_FALL_SPEED, 0, 1) * 0.95;
    bird.rot += (target - bird.rot) * (bird.vy < 0 ? 0.3 : 0.1) * dt;
    emitTrail(dt);
  }
}

function ceilingBounce(push) {
  bird.y += push;
  bird.vy = CONFIG.CEILING_BOUNCE_VY;
  if (bird.ceilT > 0) return;
  bird.ceilT = 10;
  shake(CONFIG.SHAKE_CEILING[0], CONFIG.SHAKE_CEILING[1]);
  sfx('ceiling');
  const C = COLORS[game.level];
  for (let i = 0; i < 6; i++) {
    addParticle({ x: bird.x + 8 + Math.random() * 20, y: 2, vx: (Math.random() - 0.5) * 1.6, vy: 0.3 + Math.random() * 0.8, life: 22,
      size: 3 + Math.random() * 3, grow: 0.25, kind: 'puff', color: mix(C.skyBottom, CREAM, 0.5), alpha: 0.7, drag: 0.92, scroll: true });
  }
}

// Hitbox als AABB, beim Schrumpfen auf 60 % um die Mitte
function birdBox(inset) {
  const s = birdScale(), w = CONFIG.BIRD_W * s, h = CONFIG.BIRD_H * s;
  const cx = bird.x + CONFIG.BIRD_W / 2, cy = bird.y + CONFIG.BIRD_H / 2, d = inset * s;
  return { x: cx - w / 2 + d, y: cy - h / 2 + d, w: w - 2 * d, h: h - 2 * d };
}
const birdCY = () => bird.y + CONFIG.BIRD_H / 2;
const birdWorldX = () => bird.x + game.scroll;

// Drei Flügelphasen: 0 oben, 1 Mitte, 2 unten. Nach jedem Flap ein Schlag, sonst je nach Fallen.
const FLAP_SEQ = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1];
function wingPhase() {
  if (bird.dead) return 0;
  if (bird.idle) return [1, 2, 1, 0][Math.floor(frame / 8) % 4];
  const ft = Math.floor(bird.flapT);
  if (ft < FLAP_SEQ.length) return FLAP_SEQ[ft];
  return bird.vy > 2.5 ? 0 : 1;
}

// ============================================================
// Rohre: generische Objekte mit type 'pipe'. Bewegte Paare fahren
// gemeinsam auf und ab (movingPipes), oberes und unteres Rohr schieben sich
// seitlich gegeneinander (sidePipes: oben nach rechts, unten nach links und
// zurück), kippen um die Lückenmitte (tiltPipes) oder die Lücke zieht sich
// langsam zusammen und geht wieder auf (shrinkPipes, nie unter 140 px).
// Bewegungsarten: 'sine' (gleichmäßig) und 'step' (Uhrwerk: halten, dann zügig umsetzen).
// Alle Rohre eines Versuchs stehen vorab im Layout (aus einem Seed). Dadurch
// sieht ein Neustart am Checkpoint genauso aus wie der Lauf davor, inklusive
// der Rohre hinter dem Vogel, und die Bot-Spule kann jede Stelle zeigen.
// ============================================================
const smoothStep = t => t * t * (3 - 2 * t);
// -1..1: hält bei +1, wechselt weich nach -1, hält, wechselt zurück
function stepWave(u) {
  const f = ((u / TAU) % 1 + 1) % 1;
  if (f < 0.3) return 1;
  if (f < 0.5) return 1 - 2 * smoothStep((f - 0.3) / 0.2);
  if (f < 0.8) return -1;
  return -1 + 2 * smoothStep((f - 0.8) / 0.2);
}
function pipeGapAt(p, wt) {
  if (!p.amp) return p.gy0;
  const u = p.phase + TAU * wt / p.period;
  return p.gy0 + p.amp * (p.motion === 'step' ? stepWave(u) : Math.sin(u));
}
// Seitlicher Versatz zum Zeitpunkt wt: oberes Rohr +ox, unteres -ox (Weltkoordinaten)
function pipeOffsetAt(p, wt) {
  return p.hamp ? p.hamp * Math.sin(p.hphase + TAU * wt / p.hperiod) : 0;
}
// Neigung (rad) zum Zeitpunkt wt; Drehpunkt ist die Mitte der Lücke
function pipeAngleAt(p, wt) {
  return p.tamp ? p.tamp * Math.sin(p.tphase + TAU * wt / p.tperiod) : 0;
}
// Lückengröße zum Zeitpunkt wt (Zusammenziehen: weich auf gap0 - gamp und zurück)
function pipeGapSizeAt(p, wt) {
  return p.gamp ? p.gap0 - p.gamp * (0.5 - 0.5 * Math.cos(p.gphase + TAU * wt / p.gperiod)) : p.gap0;
}
const pipeCenter = p => p.gapY + p.gap / 2;
const pipeX = p => p.slot;                              // Bezugskante (Mitte des Paars minus halbe Breite), Weltkoordinaten
const pipeXa = (p, a) => p.slot;
const pipeReach = p => p.slot + Math.abs(p.ox) + PW_;  // rechteste Kante beider Rohre
const pipeOxa = (p, a) => lerp(p.pox, p.ox, a);
// Lückenmitte an der Weltkoordinate wx (bei gekippten Paaren liegt die Lücke schräg)
const pipeCenterAtX = (p, wx) => pipeCenter(p) + (p.ang ? (wx - (pipeX(p) + PW_ / 2)) * Math.tan(p.ang) : 0);

// Layout eines Versuchs: Höhe, Bewegung und Variante jedes Rohrs, aus dem Seed
const TILT_SHIFT = (PW_ / 2 + CONFIG.BIRD_W) * 0.17;   // so weit wandert die Lückenmitte am Vogel bei voller Neigung
function makeLayout(li, seed) {
  const L = LEVELS[li], n = pipesFor(li), gap = L.pipeGap, mp = L.movingPipes, sp = L.sidePipes, tp = L.tiltPipes || { share: 0 }, gs = L.shrinkPipes || { share: 0 };
  const r = mulberry32(seed >>> 0 || 1), list = [];
  let lastC = null, lastAmp = 0, lastH = 0, lastT = 0;
  for (let idx = 0; idx < n; idx++) {
    // Das erste Rohr steht still, damit der Einstieg ruhig bleibt
    const moving = idx > 0 && mp.share > 0 && r() < mp.share;
    const side = idx > 0 && sp.share > 0 && r() < sp.share;
    const tilt = idx > 0 && tp.share > 0 && r() < tp.share;
    const shrink = idx > 0 && gs.share > 0 && r() < gs.share;
    const amp = moving ? mp.amplitude : 0, hamp = side ? sp.amplitude : 0, tsh = tilt ? TILT_SHIFT * tp.angle / 0.17 : 0;
    const edge = (moving ? CONFIG.MOVING_EDGE_MARGIN + amp : CONFIG.PIPE_EDGE_MARGIN) + (tilt ? CONFIG.TILT_MARGIN : 0);
    const minTop = edge, maxTop = GROUND_Y - edge - gap;
    let top = minTop + r() * (maxTop - minTop);
    if (lastC !== null) {
      // Aufeinanderfolgende Lücken höchstens 170 auseinander, auch im ungünstigsten Moment der Bewegung
      // (deshalb alle Ausschläge abziehen). Seitlich schwankende Paare kommen sich näher, gekippte verschieben
      // die Lücke am Vogel: dafür wird der erlaubte Höhenunterschied weiter verkleinert. Gleichverteilt im Fenster.
      const step = Math.max(50, CONFIG.PIPE_MAX_STEP - (amp + lastAmp) - 0.6 * (hamp + lastH) - (tsh + lastT));
      const lo = Math.max(minTop, lastC - step - gap / 2), hi = Math.min(maxTop, lastC + step - gap / 2);
      top = lo <= hi ? lo + r() * (hi - lo) : clamp(top, minTop, maxTop);
    }
    top = Math.round(top);
    list.push({ top, amp, period: moving ? mp.period : 1, phase: moving ? r() * TAU : 0, motion: moving ? (mp.motion || 'sine') : 'sine',
      hamp, hperiod: side ? sp.period : 1, hphase: side ? r() * TAU : 0,
      tamp: tilt ? tp.angle : 0, tperiod: tilt ? tp.period : 1, tphase: tilt ? r() * TAU : 0,
      gamp: shrink ? Math.min(gs.amount, gap - 140) : 0, gperiod: shrink ? gs.period : 1, gphase: shrink ? r() * TAU : 0, v: Math.floor(r() * 2) });
    lastC = top + gap / 2; lastAmp = amp; lastH = hamp; lastT = tsh;
  }
  return { li, seed: seed >>> 0, list, base: 0, shiftFrom: Infinity };
}
// Neuer Seed aus dem Spielzufall (im Autotest fest, im Spiel echt zufällig)
const newSeed = () => (Math.floor(RNG() * 2147483646) + 1) >>> 0;
// Weltposition (linke Kante) des Rohrs idx, ohne seitliches Schwanken. Beim Fortsetzen am Checkpoint
// bekommt das Rohr, vor dem es weitergeht, zusätzlichen Anlauf (CP_EXTRA), die Rohre dahinter stehen wie zuvor.
const slotOf = idx => game.layout.base + idx * CONFIG.PIPE_SPACING + (idx >= game.layout.shiftFrom ? CONFIG.CP_EXTRA : 0);

function ensureLayout() {
  const lay = game.layout;
  if (!lay || lay.li !== game.level || (game.pipesSpawned === 0 && game.pipesStart === 0 && !game.keepLayout)) {
    game.layout = makeLayout(game.level, newSeed());
    game.layout.base = game.scroll + W + CONFIG.PIPE_SPAWN_AHEAD;
  } else if (game.pipesSpawned === 0 && game.keepLayout) game.layout.base = game.scroll + W + CONFIG.PIPE_SPAWN_AHEAD;
  game.keepLayout = false;
}

function spawnPipe(behind) {
  if (!behind) ensureLayout();
  const li = game.level, L = LEVELS[li], idx = game.pipesSpawned, e = game.layout.list[idx];
  // Das erste Rohr nach Start oder Checkpoint steht still und gerade
  const calm = idx === game.pipesStart && idx > 0;
  const p = { type: 'pipe', idx, slot: slotOf(idx), gap: L.pipeGap, gap0: L.pipeGap, gy0: e.top, amp: calm ? 0 : e.amp, period: e.period, phase: e.phase, motion: e.motion,
    hamp: calm ? 0 : e.hamp, hperiod: e.hperiod, hphase: e.hphase, tamp: calm ? 0 : e.tamp, tperiod: e.tperiod, tphase: e.tphase,
    gamp: calm ? 0 : (e.gamp || 0), gperiod: e.gperiod || 1, gphase: e.gphase || 0, v: e.v, passed: !!behind };
  p.gap = pipeGapSizeAt(p, game.wt);
  p.gapY = p.pgapY = pipeGapAt(p, game.wt) + (p.gap0 - p.gap) / 2;
  p.ox = p.pox = pipeOffsetAt(p, game.wt);
  p.ang = p.pang = pipeAngleAt(p, game.wt);
  const prev = pipes.length ? pipes[pipes.length - 1] : null;
  pipes.push(p);
  game.pipesSpawned++;
  game.lastSlot = p.slot;
  game.lastCenter = e.top + p.gap / 2;
  game.lastAmp = p.amp;
  game.lastHamp = p.hamp;
  if (prev && !behind) spawnHazardsBetween(prev, p);
  if (!behind) maybeSpawnPickup(p);
  return p;
}
const spawnDue = () => game.pipesSpawned < pipesFor(game.level) && (!game.layout || game.layout.li !== game.level || game.pipesSpawned === 0 && game.pipesStart === 0 && !game.keepLayout
  || slotOf(game.pipesSpawned) - game.scroll <= W + CONFIG.PIPE_SPAWN_AHEAD);

// Fortsetzen ab Rohr j (Checkpoint oder Startpunkt der Bot-Spule): Das Layout bleibt, die schon passierten Rohre
// stehen wie gewohnt hinter dem Vogel, vor Rohr j liegt zusätzlicher Anlauf. Der Vogel schwebt auf Höhe der
// Lücke von Rohr j, bis getippt wird.
function resumeWorldAt(j) {
  const lay = game.layout;
  lay.shiftFrom = j;
  // Rechte Kante von Rohr j-1 liegt 40 px hinter dem Vogel
  lay.base = birdWorldX() - 40 - PW_ - (j - 1) * CONFIG.PIPE_SPACING;
  let first = j;
  while (first > 0 && slotOf(first - 1) + PW_ > game.scroll - 30) first--;
  game.pipesSpawned = first;
  while (game.pipesSpawned < j) spawnPipe(true);
  // Rohre voraus schon zeigen
  while (game.pipesSpawned < pipesFor(game.level) && slotOf(game.pipesSpawned) - game.scroll <= W + CONFIG.PIPE_SPAWN_AHEAD) spawnPipe(false);
  const e = lay.list[Math.min(j, lay.list.length - 1)];
  return e.top + LEVELS[game.level].pipeGap / 2;
}

function updatePipes(dt) {
  if (game.state === 'PLAYING' || game.state === 'CHECKPOINT') {
    while (spawnDue()) spawnPipe(false);
  }
  for (const p of pipes) {
    if (p.gamp) p.gap = pipeGapSizeAt(p, game.wt);
    if (p.amp || p.gamp) p.gapY = pipeGapAt(p, game.wt) + (p.gap0 - p.gap) / 2;
    if (p.hamp) p.ox = pipeOffsetAt(p, game.wt);
    if (p.tamp) p.ang = pipeAngleAt(p, game.wt);
  }
  const bwx = birdWorldX();
  for (const p of pipes) {
    if (!p.passed && p.slot + p.hamp + PW_ < bwx) {
      p.passed = true;
      game.pipesPassed++;
      game.obsPop = 1;
      addScore(1);
      sfx('pipe');
      onPipePassed();
    }
  }
  if (pipes.length && pipeReach(pipes[0]) + 60 < game.scroll) pipes = pipes.filter(p => pipeReach(p) + 60 > game.scroll);
}

// Gedrehtes Rechteck (lokal x in [x0, x1], y in [y0, y1] um den Drehpunkt cx, cy) gegen eine achsparallele Box (SAT)
function obbHitsBox(cx, cy, ang, x0, x1, y0, y1, box) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([lx, ly]) => [cx + lx * c - ly * s, cy + lx * s + ly * c]);
  const bp = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]];
  for (const [ax, ay] of [[1, 0], [0, 1], [c, s], [-s, c]]) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of pts) { const d = x * ax + y * ay; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const [x, y] of bp) { const d = x * ax + y * ay; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}

function pipeHits(p, box) {
  const x = pipeX(p) - game.scroll, bot = p.gapY + p.gap, o = p.ox || 0;
  if (p.ang) {
    if (box.x > x + PW_ + Math.abs(o) + 40 || box.x + box.w < x - Math.abs(o) - 40) return false;
    const cx = x + PW_ / 2, cy = p.gapY + p.gap / 2, hg = p.gap / 2, hw = PW_ / 2;
    return obbHitsBox(cx, cy, p.ang, o - hw, o + hw, -900, -hg, box) || obbHitsBox(cx, cy, p.ang, -o - hw, -o + hw, hg, 900, box);
  }
  return overlap(box, { x: x + o, y: -400, w: PW_, h: p.gapY + 400 }) || overlap(box, { x: x - o, y: bot, w: PW_, h: GROUND_Y - bot + 60 });
}

// Nächstes Rohr, dessen Lücke der Vogel noch durchfliegen muss
function nextPipe() {
  const bwx = birdWorldX();
  for (const p of pipes) if (pipeReach(p) > bwx) return p;
  return null;
}

// ---------- Zeichnen in Gerätepixeln, ganzzahlig, damit nichts flimmert ----------
let camXd = 0;
const wxToDev = wx => Math.round(wx * view.k) - camXd;

function drawSpriteDev(s, dx, dy) {
  const f = view.k / s.ks;
  ctx.imageSmoothingEnabled = f !== 1;
  ctx.drawImage(s.c, dx + Math.round(s.x0 * view.k), dy + Math.round(s.y0 * view.k), Math.round(s.c.width * f), Math.round(s.c.height * f));
}

function drawPipes(cache, a) {
  const k = view.k;
  ctx.save();
  devT();
  // Schlagschatten der Säulen auf dem Hintergrund
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  const sxo = Math.round(SHADOW.x * 0.6 * k), syo = Math.round(SHADOW.y * 0.6 * k), w = Math.round(PW_ * k);
  for (const p of pipes) {
    const gy = lerp(p.pgapY, p.gapY, a), x = wxToDev(pipeXa(p, a)) + sxo, o = Math.round(pipeOxa(p, a) * k);
    if (x > canvas.width + Math.abs(o) || x + w < -20 - Math.abs(o)) continue;
    const ang = p.tamp ? lerp(p.pang, p.ang, a) : 0;
    if (ang) { ctx.save(); tiltDev(x + w / 2, Math.round((gy + p.gap / 2) * k) + syo, ang); }
    ctx.fillRect(x + o, -Math.round(80 * k), w, Math.round((gy + 80) * k) + syo);
    ctx.fillRect(x - o, Math.round((gy + p.gap) * k) + syo, w, Math.round((GROUND_Y + 60 - gy - p.gap) * k));
    if (ang) ctx.restore();
  }
  drawPipeDev.a = a;
  for (const p of pipes) {
    const dx = wxToDev(pipeXa(p, a));
    if (dx > canvas.width + 80 * k || dx < -160 * k) continue;
    const gy = lerp(p.pgapY, p.gapY, a), ang = p.tamp ? lerp(p.pang, p.ang, a) : 0;
    if (ang) {
      ctx.save();
      tiltDev(dx + Math.round(PW_ / 2 * k), Math.round((gy + p.gap / 2) * k), ang);
      drawPipeDev(cache.pipe, p, dx, gy, true);
      ctx.restore();
    } else drawPipeDev(cache.pipe, p, dx, gy, false);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}
// Drehung um einen Punkt in Gerätepixeln
function tiltDev(px, py, ang) {
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.translate(-px, -py);
}

function drawPipeDev(ps, p, dx0, gy, tilted) {
  const k = view.k, body = ps.bodies[p.v], f = k / body.ks, PCH_ = CONFIG.PIPE_CAP_H;
  ctx.imageSmoothingEnabled = tilted || f !== 1;
  // Oberes Rohr um +o, unteres um -o versetzt (gegeneinander schiebende Paare)
  const o = Math.round(pipeOxa(p, drawPipeDev.a) * k);
  let dx = dx0 + o, bx = dx + Math.round(body.x0 * k);
  const bw = Math.round(body.c.width * f);
  // Gekippt reichen die Körper weiter über Bildrand und Boden hinaus, damit keine Enden sichtbar werden
  const topEnd = Math.round((gy - PCH_) * k), topStart = -Math.round((tilted ? 90 : 20) * k);
  if (topEnd > topStart) {
    let y = topEnd;
    while (y > topStart) {
      const sh = Math.min(body.c.height, Math.ceil((y - topStart) / f));
      ctx.drawImage(body.c, 0, body.c.height - sh, body.c.width, sh, bx, y - Math.round(sh * f), bw, Math.round(sh * f));
      y -= Math.round(sh * f);
      if (!tilted) break;
    }
  }
  drawSpriteDev(ps.capTop, dx, Math.round((gy - PCH_) * k));
  dx = dx0 - o; bx = dx + Math.round(body.x0 * k);
  const botStart = Math.round((gy + p.gap + PCH_) * k), botEnd = Math.round((GROUND_Y + (tilted ? 70 : 10)) * k);
  if (botEnd > botStart) {
    let y = botStart;
    while (y < botEnd) {
      const sh = Math.min(body.c.height, Math.ceil((botEnd - y) / f));
      ctx.drawImage(body.c, 0, 0, body.c.width, sh, bx, y, bw, Math.round(sh * f));
      y += Math.round(sh * f);
      if (!tilted) break;
    }
  }
  drawSpriteDev(ps.capBot, dx, Math.round((gy + p.gap) * k));
}

// Periodischen Streifen mit Versatz off (logisch) zeichnen, ganzzahlig in Gerätepixeln.
// Etwas über die Ränder hinaus, damit beim Wackeln keine Kante sichtbar wird.
function drawStrip(s, off) {
  if (!s) return;
  const f = view.k / s.ks, pad = Math.ceil(8 * view.k), Wd = canvas.width + pad, dy = Math.round(s.y0 * view.k), dh = Math.round(s.hd * f);
  ctx.imageSmoothingEnabled = f !== 1;
  let sx = Math.round((off - 8) * s.kx) % s.wd;
  if (sx < 0) sx += s.wd;
  let dx = -pad;
  while (dx < Wd) {
    const sw = Math.min(s.wd - sx, Math.ceil((Wd - dx) / f));
    const dw = f === 1 ? sw : Math.round(sw * f);
    ctx.drawImage(s.c, sx, 0, sw, s.hd, dx, dy, dw, dh);
    dx += dw;
    sx = 0;
  }
  ctx.imageSmoothingEnabled = true;
}

