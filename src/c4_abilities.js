// ============================================================
// Fähigkeiten ab Level 3: leuchtende Kugeln in einzelnen Rohrlücken.
// Zeitlupe, Phantom und Schrumpfen wirken beim Einsammeln sofort für
// 5 Sekunden (eine Wirkung zur Zeit, eine neue ersetzt die laufende).
// Die Zeitlupe bremst die Welt (Rohre, Bewegung, Wind), nicht den Vogel.
// Zweite Chance bleibt als Extraleben, bis sie gebraucht wird, auch über
// das Level hinaus und im Bosskampf.
// Schlechte Kugeln ab Level 5: dunkel mit Zacken, zwischen zwei Rohren
// mitten auf der natürlichen Flugbahn. Man weicht ihnen aus, indem man
// drüber oder drunter fliegt. Tempo (ab 5), Riesenvogel (ab 10) und
// Bleiflügel (ab 14) wirken je 5 Sekunden.
// ============================================================
const ABILITIES = {
  SLOW_MO:       { name: 'Zeitlupe', color: '#8fd0ff', desc: '5 Sekunden lang bewegt sich die Welt langsamer' },
  ZWEITE_CHANCE: { name: 'Zweite Chance', color: '#ff9fb2', desc: 'Rettet dich einmal automatisch' },
  PHANTOM:       { name: 'Phantom', color: '#c8b6ff', desc: '5 Sekunden lang durch Säulen fliegen' },
  SCHRUMPFEN:    { name: 'Schrumpfen', color: '#9cefb2', desc: '5 Sekunden lang kleiner' },
  TEMPO:         { name: 'Tempo', color: '#ff7a59', desc: '5 Sekunden lang schneller', bad: true },
  RIESE:         { name: 'Riesenvogel', color: '#e2a03f', desc: '5 Sekunden lang größer', bad: true },
  BLEI:          { name: 'Bleiflügel', color: '#9aa3b8', desc: '5 Sekunden lang schwerer', bad: true }
};
const ABILITY_KEYS = ['SLOW_MO', 'ZWEITE_CHANCE', 'PHANTOM', 'SCHRUMPFEN'];
const DEBUFF_KEYS = ['TEMPO', 'RIESE', 'BLEI'];
const TIMED = { SLOW_MO: 'slow', PHANTOM: 'phantom', SCHRUMPFEN: 'shrink', TEMPO: 'tempo', RIESE: 'grow', BLEI: 'lead' };
const abil = { slow: 0, phantom: 0, shrink: 0, tempo: 0, grow: 0, lead: 0, active: null, bad: null, extra: false, tf: 1, sf: 1, pop: 0, plan: [], badPlan: [] };

function abilitiesActive() { return game.level >= CONFIG.ABILITY_FROM && !SIM.noAbilities; }
// Schlechte Kugeln, die es in Level li schon gibt (in der Reihenfolge ihres Auftretens)
const debuffsFor = li => CONFIG.DEBUFF_FROM.filter(([, from]) => li >= from).map(([k]) => k);
const newDebuffIn = li => { const d = CONFIG.DEBUFF_FROM.find(([, from]) => from === li); return d ? d[0] : null; };

// Wie viele Kugeln ein Level bekommt: 2, in langen Leveln 3, gleichmäßig über das Level verteilt
function pickupPlan(li) {
  const n = pipesFor(li), count = n >= 30 ? 3 : 2, out = [];
  for (let k = 1; k <= count; k++) out.push(Math.round(n * k / (count + 1)));
  return out;
}
// Schlechte Kugeln: ab Level 5 eine, ab Level 10 zwei, ab Level 15 drei; zwischen Rohr idx-1 und idx,
// nie direkt neben einer guten Kugel, nie am Anfang
function debuffPlan(li) {
  if (!debuffsFor(li).length) return [];
  const n = pipesFor(li), count = li < 9 ? 1 : li < 14 ? 2 : 3, good = pickupPlan(li), out = [];
  for (let k = 1; k <= count; k++) {
    let idx = Math.round(n * (k - 0.5) / count + 1);
    while (good.some(g => Math.abs(g - idx) <= 1) || out.includes(idx)) idx++;
    out.push(clamp(idx, 3, n - 1));
  }
  return out;
}

function resetAbilities(keepExtra) {
  abil.slow = abil.phantom = abil.shrink = abil.tempo = abil.grow = abil.lead = 0;
  abil.active = abil.bad = null;
  abil.tf = abil.sf = 1;
  abil.pop = 0;
  if (!keepExtra) abil.extra = false;
  abil.plan = abilitiesActive() ? pickupPlan(game.level).filter(i => i > game.pipesStart) : [];
  abil.badPlan = abilitiesActive() ? debuffPlan(game.level).filter(i => i > game.pipesStart) : [];
  abil.badCount = 0;
}

function maybeSpawnPickup(p) {
  if (!abilitiesActive()) return;
  if (abil.plan.includes(p.idx)) {
    // Zweite Chance seltener und nur, wenn sie gerade fehlt
    const w = { SLOW_MO: 1, PHANTOM: 1, SCHRUMPFEN: 1, ZWEITE_CHANCE: abil.extra || pickups.some(u => u.kind === 'ZWEITE_CHANCE') ? 0 : 0.7 };
    let r = RNG() * (w.SLOW_MO + w.PHANTOM + w.SCHRUMPFEN + w.ZWEITE_CHANCE), kind = 'SLOW_MO';
    for (const k of ABILITY_KEYS) { if (r < w[k]) { kind = k; break; } r -= w[k]; }
    pickups.push({ type: 'pickup', kind, pipe: p, x: pipeX(p) + PW_ / 2, px: pipeX(p) + PW_ / 2, y: pipeCenter(p), py: pipeCenter(p), t: 0, taken: false });
  }
  const prev = pipes.length > 1 ? pipes[pipes.length - 2] : null;
  if (prev && abil.badPlan.includes(p.idx)) spawnDebuff(prev, p);
}

// Schlechte Kugel mittig zwischen zwei Rohren auf der Linie zwischen den Lückenmitten (Ruhelage).
// Daneben bleibt nach oben und unten der ganze Luftraum frei.
function spawnDebuff(A, B) {
  const li = game.level, avail = debuffsFor(li), fresh = newDebuffIn(li);
  const kind = fresh && abil.badCount === 0 ? fresh : avail[Math.floor(RNG() * avail.length)];
  abil.badCount++;
  const x = (A.slot + PW_ + B.slot) / 2, y = clamp((A.gy0 + A.gap / 2 + B.gy0 + B.gap / 2) / 2, 70, GROUND_Y - 70);
  pickups.push({ type: 'pickup', kind, bad: true, pipe: null, x, px: x, y0: y, y, py: y, t: RNG() * 100, taken: false });
}

function updatePickups(dt) {
  if (!pickups.length) return;
  const box = birdBox(0);
  for (const u of pickups) {
    u.t += dt;
    u.px = u.x; u.py = u.y;
    if (u.bad) u.y = u.y0 + Math.sin(u.t * 0.06) * 5;
    else {
      u.x = pipeX(u.pipe) + PW_ / 2;
      u.y = u.pipe.gapY + u.pipe.gap / 2 + Math.sin(u.t * 0.08) * 4;
    }
    if (u.taken) continue;
    const sx = u.x - game.scroll;
    if (circleBox(sx, u.y, u.bad ? 14 : 16, box)) {
      u.taken = true;
      applyPickup(u.kind);
      burst(sx, u.y, 12, [ABILITIES[u.kind].color, u.bad ? INK : CREAM], 3, 22, { kind: 'spark', grav: 0 });
    }
  }
  pickups = pickups.filter(u => !u.taken && u.x + 30 > game.scroll);
}

// Einsammeln: sofort wirksam
function applyPickup(kind) {
  abil.pop = 1;
  if (kind === 'ZWEITE_CHANCE') {
    sfx('activate');
    abil.extra = true;
    showToast('Zweite Chance: rettet dich einmal', 110);
    return;
  }
  const A = ABILITIES[kind];
  if (A.bad) {
    sfx('hazard');
    abil[TIMED[kind]] = CONFIG.ABILITY_FRAMES;
    if (kind === 'RIESE') abil.shrink = 0;            // groß und klein heben sich auf
    abil.bad = kind;
    showToast(`${A.name}: 5 Sekunden`, 100);
    flash(0.18, A.color);
    return;
  }
  sfx('activate');
  abil.slow = abil.phantom = abil.shrink = 0;
  if (kind === 'SCHRUMPFEN') abil.grow = 0;
  abil[TIMED[kind]] = CONFIG.ABILITY_FRAMES;
  abil.active = kind;
  showToast(`${A.name}: 5 Sekunden`, 100);
  burst(bird.x + 17, bird.y + 12, 14, [A.color, CREAM], 3.2, 24, { kind: 'spark', grav: 0 });
}

// Wirkdauern laufen in echten Frames; Zeitfaktor (Welt) und Tempo gleiten weich
function updateAbilityTimers() {
  for (const k of ['slow', 'phantom', 'shrink', 'tempo', 'grow', 'lead']) if (abil[k] > 0) abil[k]--;
  if (abil.active && abil[TIMED[abil.active]] <= 0) abil.active = null;
  if (abil.bad && abil[TIMED[abil.bad]] <= 0) abil.bad = DEBUFF_KEYS.find(k => abil[TIMED[k]] > 0) || null;
  abil.pop = Math.max(0, abil.pop - 0.05);
  const target = abil.slow > 0 ? CONFIG.SLOW_FACTOR : 1;
  abil.tf += (target - abil.tf) * 0.25;
  if (Math.abs(abil.tf - target) < 0.01) abil.tf = target;
  const st = abil.tempo > 0 ? CONFIG.TEMPO_FACTOR : 1;
  abil.sf += (st - abil.sf) * 0.12;
  if (Math.abs(abil.sf - st) < 0.005) abil.sf = st;
}
// Schwerkraft-Faktor des Vogels (Bleiflügel)
const gravityFactor = () => (abil.lead > 0 ? CONFIG.LEAD_GRAVITY : 1);

function hasSecondChance() { return abil.extra; }

// Wiederbelebung an Ort und Stelle: in der Rohrphase an der nächsten Lückenmitte, im Bosskampf
// auf mittlerer Höhe; kurz unverwundbar. Genutzt von Zweite Chance und vom Gratis-Respawn (Leicht).
function reviveBird(color) {
  const p = BOSS_STATES.has(game.state) ? null : nextPipe();
  const cy = p ? pipeCenter(p) : clamp(GROUND_Y / 2, 120, GROUND_Y - 160);
  burst(bird.x + 17, bird.y + 12, 16, [color, CREAM], 3.5, 26, { kind: 'spark', grav: 0 });
  bird.y = bird.py = cy - CONFIG.BIRD_H / 2;
  bird.vy = -2;
  bird.inv = CONFIG.REVIVE_INVULN;
  abil.tempo = abil.grow = abil.lead = 0;
  abil.bad = null;
  shake(CONFIG.SHAKE_HIT[0], CONFIG.SHAKE_HIT[1]);
  flash(0.3, color);
  sfx('activate');
  burst(bird.x + 17, bird.y + 12, 14, [color, CREAM], 2.6, 24, { kind: 'ring', grav: 0, grow: 0.8 });
}
function useSecondChance() {
  if (!abil.extra) return false;
  abil.extra = false;
  reviveBird(ABILITIES.ZWEITE_CHANCE.color);
  return true;
}

// Beim Betreten des Bosskampfs: laufende Wirkungen enden, Kugeln verschwinden. Das Extraleben bleibt.
function clearAbilitiesForBoss() {
  abil.slow = abil.phantom = abil.shrink = abil.tempo = abil.grow = abil.lead = 0;
  abil.active = abil.bad = null;
  abil.tf = abil.sf = 1;
  pickups = [];
}

function drawPickups(a) {
  const camX = lerp(game.prevScroll, game.scroll, a);
  for (const u of pickups) {
    const sx = lerp(u.px, u.x, a) - camX, y = lerp(u.py, u.y, a);
    if (sx < -30 || sx > W + 30) continue;
    const A = ABILITIES[u.kind];
    if (u.bad) { drawBadOrb(u, A, sx, y); continue; }
    ctx.drawImage(glowSprite(A.color), sx - 26, y - 26, 52, 52);
    circle(sx + SHADOW.x * 0.4, y + SHADOW.y * 0.4, 13, rgba(INK, CONFIG.SHADOW_ALPHA));
    circle(sx, y, 13, rgrad(sx, y, 1, 13, [[0, mix(A.color, CREAM, 0.6)], [0.7, A.color], [1, shade(A.color, -0.3)]], sx - 4, y - 4));
    ctx.strokeStyle = rgba(CREAM, 0.85);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, y, 13, 0, TAU);
    ctx.stroke();
    abilityIcon(u.kind, sx, y, 8, INK);
  }
}
// Schlechte Kugel: dunkler Kern, Zackenkranz in der Warnfarbe, helles Symbol. Unverwechselbar mit den guten.
function drawBadOrb(u, A, sx, y) {
  const r = 12, spin = u.t * 0.03;
  // Warnschein in Rot, damit die dunkle Kugel auch vor dunklem Hintergrund auffällt
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(u.t * 0.12);
  ctx.drawImage(glowSprite('#ff4a3d'), sx - 30, y - 30, 60, 60);
  ctx.globalAlpha = 1;
  circle(sx + SHADOW.x * 0.4, y + SHADOW.y * 0.4, r + 2, rgba(INK, CONFIG.SHADOW_ALPHA));
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const an = spin + k * TAU / 16, rr = k % 2 ? r + 1 : r + 6;
    if (k) ctx.lineTo(sx + Math.cos(an) * rr, y + Math.sin(an) * rr); else ctx.moveTo(sx + Math.cos(an) * rr, y + Math.sin(an) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = shade(A.color, -0.15);
  ctx.fill();
  circle(sx, y, r, rgrad(sx, y, 1, r, [[0, mix(INK, A.color, 0.35)], [1, INK]], sx - 3, y - 3));
  ctx.strokeStyle = rgba(A.color, 0.95);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(sx, y, r, 0, TAU);
  ctx.stroke();
  abilityIcon(u.kind, sx, y, 7, mix(A.color, CREAM, 0.45));
}

// Symbole: Uhr, Herz, Geist, Pfeile nach innen; schlecht: Doppelpfeil, Pfeile nach außen, Gewicht
function abilityIcon(kind, x, y, s, col) {
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = Math.max(1.2, s * 0.2);
  ctx.beginPath();
  switch (kind) {
    case 'SLOW_MO':
      ctx.arc(x, y, s * 0.85, 0, TAU);
      ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.55);
      ctx.moveTo(x, y); ctx.lineTo(x + s * 0.42, y + s * 0.2);
      ctx.stroke();
      break;
    case 'ZWEITE_CHANCE':
      ctx.moveTo(x, y + s * 0.8);
      ctx.bezierCurveTo(x - s * 1.2, y - s * 0.1, x - s * 0.6, y - s * 1.05, x, y - s * 0.38);
      ctx.bezierCurveTo(x + s * 0.6, y - s * 1.05, x + s * 1.2, y - s * 0.1, x, y + s * 0.8);
      ctx.fill();
      break;
    case 'PHANTOM':
      ctx.moveTo(x - s * 0.7, y + s * 0.8);
      ctx.lineTo(x - s * 0.7, y - s * 0.1);
      ctx.arc(x, y - s * 0.1, s * 0.7, Math.PI, 0);
      ctx.lineTo(x + s * 0.7, y + s * 0.8);
      ctx.lineTo(x + s * 0.35, y + s * 0.5);
      ctx.lineTo(x, y + s * 0.8);
      ctx.lineTo(x - s * 0.35, y + s * 0.5);
      ctx.closePath();
      ctx.fill();
      circle(x - s * 0.25, y - s * 0.15, s * 0.14, CREAM);
      circle(x + s * 0.25, y - s * 0.15, s * 0.14, CREAM);
      break;
    case 'SCHRUMPFEN':
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.moveTo(x + dx * s * 0.9, y + dy * s * 0.9);
        ctx.lineTo(x + dx * s * 0.25, y + dy * s * 0.25);
        ctx.moveTo(x + dx * s * 0.25, y + dy * s * 0.6);
        ctx.lineTo(x + dx * s * 0.25, y + dy * s * 0.25);
        ctx.lineTo(x + dx * s * 0.6, y + dy * s * 0.25);
      }
      ctx.stroke();
      break;
    case 'TEMPO':
      for (const ox of [-0.45, 0.25]) {
        ctx.moveTo(x + (ox - 0.3) * s, y - s * 0.7);
        ctx.lineTo(x + (ox + 0.35) * s, y);
        ctx.lineTo(x + (ox - 0.3) * s, y + s * 0.7);
      }
      ctx.stroke();
      break;
    case 'RIESE':
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.moveTo(x + dx * s * 0.2, y + dy * s * 0.2);
        ctx.lineTo(x + dx * s * 0.85, y + dy * s * 0.85);
        ctx.moveTo(x + dx * s * 0.85, y + dy * s * 0.45);
        ctx.lineTo(x + dx * s * 0.85, y + dy * s * 0.85);
        ctx.lineTo(x + dx * s * 0.45, y + dy * s * 0.85);
      }
      ctx.stroke();
      break;
    case 'BLEI':
      ctx.moveTo(x - s * 0.75, y + s * 0.75);
      ctx.lineTo(x - s * 0.5, y - s * 0.2);
      ctx.lineTo(x + s * 0.5, y - s * 0.2);
      ctx.lineTo(x + s * 0.75, y + s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - s * 0.45, s * 0.3, 0, TAU);
      ctx.stroke();
      break;
  }
}
