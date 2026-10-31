// ============================================================
// Laufzeitobjekte. Weltkoordinaten: x wächst nach rechts, der linke
// Bildrand liegt bei game.scroll. Alles Bewegte wird mit dem
// Zeitfaktor dt fortgeschrieben (1 normal, 0.6 in Zeitlupe).
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

const birdScale = () => (abil.shrink > 0 ? CONFIG.SHRINK_SCALE : 1);

// mode: 'physics' (Spieler), 'hover' (Levelstart), 'auto' (nach dem Boss), 'dead'
function updateBird(mode, dt) {
  const P = PHYS[game.level];
  bird.flapT += dt;
  bird.x = birdHomeX() + bird.dx;
  if (bird.inv > 0) bird.inv--;
  if (bird.ceilT > 0) bird.ceilT--;
  if (mode === 'hover') {
    bird.idle = true;
    bird.hoverY += (CONFIG.BIRD_START_Y - bird.hoverY) * 0.04;
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
    bird.vy = Math.min(bird.vy + P.GRAVITY * dt, P.MAX_FALL_SPEED);
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
// gemeinsam auf und ab (movingPipes) und/oder schwanken nach links und
// rechts (sidePipes); die Lücke bleibt immer gleich groß.
// Bewegungsarten: 'sine' (gleichmäßig) und 'step' (Uhrwerk: halten, dann zügig umsetzen).
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
// Seitlicher Versatz (Weltkoordinaten) zum Zeitpunkt wt
function pipeOffsetAt(p, wt) {
  return p.hamp ? p.hamp * Math.sin(p.hphase + TAU * wt / p.hperiod) : 0;
}
const pipeCenter = p => p.gapY + p.gap / 2;
const pipeX = p => p.slot + p.ox;                       // linke Kante in Weltkoordinaten, aktuell
const pipeXa = (p, a) => p.slot + lerp(p.pox, p.ox, a);  // interpoliert zum Zeichnen

function spawnPipe() {
  const li = game.level, L = LEVELS[li], idx = game.pipesSpawned, gap = L.pipeGap, mp = L.movingPipes, sp = L.sidePipes || { share: 0 };
  const slot = game.lastSlot === null ? game.scroll + W + CONFIG.PIPE_SPAWN_AHEAD : game.lastSlot + CONFIG.PIPE_SPACING;
  // Das erste Rohr nach Start oder Checkpoint steht still, damit der Einstieg ruhig bleibt
  const calm = idx <= game.pipesStart;
  const moving = !calm && mp.share > 0 && RNG() < mp.share;
  const side = !calm && sp.share > 0 && RNG() < sp.share;
  const amp = moving ? mp.amplitude : 0, hamp = side ? sp.amplitude : 0;
  const edge = moving ? CONFIG.MOVING_EDGE_MARGIN + amp : CONFIG.PIPE_EDGE_MARGIN;
  const minTop = edge, maxTop = GROUND_Y - edge - gap;
  let top = rand(minTop, maxTop);
  if (game.lastCenter !== null) {
    // Aufeinanderfolgende Lücken höchstens 170 auseinander, auch im ungünstigsten Moment der
    // Bewegung (deshalb beide Ausschläge abziehen). Seitlich schwankende Paare kommen sich näher,
    // dafür wird der erlaubte Höhenunterschied weiter verkleinert. Gleichverteilt im erlaubten Fenster.
    const step = Math.max(50, CONFIG.PIPE_MAX_STEP - (amp + game.lastAmp) - 0.6 * (hamp + game.lastHamp));
    const lo = Math.max(minTop, game.lastCenter - step - gap / 2), hi = Math.min(maxTop, game.lastCenter + step - gap / 2);
    top = lo <= hi ? rand(lo, hi) : clamp(top, minTop, maxTop);
  }
  top = Math.round(top);
  const p = { type: 'pipe', idx, slot, gap, gy0: top, amp, period: moving ? mp.period : 1, phase: moving ? RNG() * TAU : 0, motion: moving ? (mp.motion || 'sine') : 'sine',
    hamp, hperiod: side ? sp.period : 1, hphase: side ? RNG() * TAU : 0, v: Math.floor(RNG() * 2), passed: false };
  p.gapY = p.pgapY = pipeGapAt(p, game.wt);
  p.ox = p.pox = pipeOffsetAt(p, game.wt);
  const prev = pipes.length ? pipes[pipes.length - 1] : null;
  pipes.push(p);
  game.pipesSpawned++;
  game.lastSlot = slot;
  game.lastCenter = top + gap / 2;
  game.lastAmp = amp;
  game.lastHamp = hamp;
  if (prev) spawnHazardsBetween(prev, p);
  maybeSpawnPickup(p);
  return p;
}

function updatePipes(dt) {
  const total = pipesFor(game.level);
  if (game.state === 'PLAYING' || game.state === 'CHECKPOINT') {
    while (game.pipesSpawned < total && (game.lastSlot === null || game.lastSlot - game.scroll <= W + CONFIG.PIPE_SPAWN_AHEAD - CONFIG.PIPE_SPACING)) spawnPipe();
  }
  for (const p of pipes) {
    if (p.amp) p.gapY = pipeGapAt(p, game.wt);
    if (p.hamp) p.ox = pipeOffsetAt(p, game.wt);
  }
  const bwx = birdWorldX();
  for (const p of pipes) {
    if (!p.passed && pipeX(p) + PW_ < bwx) {
      p.passed = true;
      game.pipesPassed++;
      game.obsPop = 1;
      addScore(1);
      sfx('pipe');
      onPipePassed();
    }
  }
  if (pipes.length && pipeX(pipes[0]) + PW_ + 60 < game.scroll) pipes = pipes.filter(p => pipeX(p) + PW_ + 60 > game.scroll);
}

function pipeHits(p, box) {
  const x = pipeX(p) - game.scroll, bot = p.gapY + p.gap;
  return overlap(box, { x, y: -400, w: PW_, h: p.gapY + 400 }) || overlap(box, { x, y: bot, w: PW_, h: GROUND_Y - bot + 60 });
}

// Nächstes Rohr, dessen Lücke der Vogel noch durchfliegen muss
function nextPipe() {
  const bwx = birdWorldX();
  for (const p of pipes) if (pipeX(p) + PW_ > bwx) return p;
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
    const gy = lerp(p.pgapY, p.gapY, a), x = wxToDev(pipeXa(p, a)) + sxo;
    if (x > canvas.width || x + w < -20) continue;
    ctx.fillRect(x, -40, w, Math.round(gy * k) + syo + 40);
    ctx.fillRect(x, Math.round((gy + p.gap) * k) + syo, w, Math.round((GROUND_Y - gy - p.gap) * k));
  }
  for (const p of pipes) {
    const dx = wxToDev(pipeXa(p, a));
    if (dx > canvas.width + 40 * k || dx < -120 * k) continue;
    drawPipeDev(cache.pipe, p, dx, lerp(p.pgapY, p.gapY, a));
  }
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

function drawPipeDev(ps, p, dx, gy) {
  const k = view.k, body = ps.bodies[p.v], f = k / body.ks, PCH_ = CONFIG.PIPE_CAP_H;
  ctx.imageSmoothingEnabled = f !== 1;
  const bx = dx + Math.round(body.x0 * k), bw = Math.round(body.c.width * f);
  const topEnd = Math.round((gy - PCH_) * k), topStart = -Math.round(20 * k);
  if (topEnd > topStart) {
    const sh = Math.min(body.c.height, Math.ceil((topEnd - topStart) / f));
    ctx.drawImage(body.c, 0, body.c.height - sh, body.c.width, sh, bx, topEnd - Math.round(sh * f), bw, Math.round(sh * f));
  }
  const botStart = Math.round((gy + p.gap + PCH_) * k), botEnd = Math.round((GROUND_Y + 10) * k);
  if (botEnd > botStart) {
    const sh = Math.min(body.c.height, Math.ceil((botEnd - botStart) / f));
    ctx.drawImage(body.c, 0, 0, body.c.width, sh, bx, botStart, bw, Math.round(sh * f));
  }
  drawSpriteDev(ps.capTop, dx, Math.round((gy - PCH_) * k));
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

