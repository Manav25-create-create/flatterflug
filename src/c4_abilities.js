// ============================================================
// Fähigkeiten ab Level 3: leuchtende Kugeln in einzelnen Rohrlücken.
// Zeitlupe, Phantom und Schrumpfen wirken beim Einsammeln sofort für
// 5 Sekunden (eine Wirkung zur Zeit, eine neue ersetzt die laufende).
// Zweite Chance bleibt als Extraleben, bis sie gebraucht wird, auch über
// das Level hinaus und im Bosskampf.
// ============================================================
const ABILITIES = {
  SLOW_MO:       { name: 'Zeitlupe', color: '#8fd0ff', desc: '5 Sekunden lang läuft alles langsamer' },
  ZWEITE_CHANCE: { name: 'Zweite Chance', color: '#ff9fb2', desc: 'Rettet dich einmal automatisch' },
  PHANTOM:       { name: 'Phantom', color: '#c8b6ff', desc: '5 Sekunden lang durch Säulen fliegen' },
  SCHRUMPFEN:    { name: 'Schrumpfen', color: '#9cefb2', desc: '5 Sekunden lang kleiner' }
};
const ABILITY_KEYS = Object.keys(ABILITIES);
const TIMED = { SLOW_MO: 'slow', PHANTOM: 'phantom', SCHRUMPFEN: 'shrink' };
const abil = { slow: 0, phantom: 0, shrink: 0, active: null, extra: false, tf: 1, pop: 0, plan: [] };

function abilitiesActive() { return game.level >= CONFIG.ABILITY_FROM && !SIM.noAbilities; }

// Wie viele Kugeln ein Level bekommt: 2, in langen Leveln 3, gleichmäßig über das Level verteilt
function pickupPlan(li) {
  const n = pipesFor(li), count = n >= 30 ? 3 : 2, out = [];
  for (let k = 1; k <= count; k++) out.push(Math.round(n * k / (count + 1)));
  return out;
}

function resetAbilities(keepExtra) {
  abil.slow = abil.phantom = abil.shrink = 0;
  abil.active = null;
  abil.tf = 1;
  abil.pop = 0;
  if (!keepExtra) abil.extra = false;
  abil.plan = abilitiesActive() ? pickupPlan(game.level).filter(i => i > game.pipesStart) : [];
}

function maybeSpawnPickup(p) {
  if (!abilitiesActive() || !abil.plan.includes(p.idx)) return;
  // Zweite Chance seltener und nur, wenn sie gerade fehlt
  const w = { SLOW_MO: 1, PHANTOM: 1, SCHRUMPFEN: 1, ZWEITE_CHANCE: abil.extra || pickups.some(u => u.kind === 'ZWEITE_CHANCE') ? 0 : 0.7 };
  let r = RNG() * (w.SLOW_MO + w.PHANTOM + w.SCHRUMPFEN + w.ZWEITE_CHANCE), kind = 'SLOW_MO';
  for (const k of ABILITY_KEYS) { if (r < w[k]) { kind = k; break; } r -= w[k]; }
  pickups.push({ type: 'pickup', kind, pipe: p, x: pipeX(p) + PW_ / 2, px: pipeX(p) + PW_ / 2, y: pipeCenter(p), py: pipeCenter(p), t: 0, taken: false });
}

function updatePickups(dt) {
  if (!pickups.length) return;
  const box = birdBox(0);
  for (const u of pickups) {
    u.t += dt;
    u.px = u.x; u.py = u.y;
    u.x = pipeX(u.pipe) + PW_ / 2;
    u.y = u.pipe.gapY + u.pipe.gap / 2 + Math.sin(u.t * 0.08) * 4;
    if (u.taken) continue;
    const sx = u.x - game.scroll;
    if (circleBox(sx, u.y, 16, box)) {
      u.taken = true;
      applyPickup(u.kind);
      burst(sx, u.y, 12, [ABILITIES[u.kind].color, CREAM], 3, 22, { kind: 'spark', grav: 0 });
    }
  }
  pickups = pickups.filter(u => !u.taken && u.x + 30 > game.scroll);
}

// Einsammeln: sofort wirksam
function applyPickup(kind) {
  abil.pop = 1;
  sfx('activate');
  if (kind === 'ZWEITE_CHANCE') {
    abil.extra = true;
    showToast('Zweite Chance: rettet dich einmal', 110);
    return;
  }
  abil.slow = abil.phantom = abil.shrink = 0;
  abil[TIMED[kind]] = CONFIG.ABILITY_FRAMES;
  abil.active = kind;
  showToast(`${ABILITIES[kind].name}: 5 Sekunden`, 100);
  const C = ABILITIES[kind].color;
  burst(bird.x + 17, bird.y + 12, 14, [C, CREAM], 3.2, 24, { kind: 'spark', grav: 0 });
}

// Wirkdauern laufen in echten Frames; Zeitfaktor gleitet weich auf 0,6 und zurück
function updateAbilityTimers() {
  if (abil.slow > 0) abil.slow--;
  if (abil.phantom > 0) abil.phantom--;
  if (abil.shrink > 0) abil.shrink--;
  if (abil.active && abil[TIMED[abil.active]] <= 0) abil.active = null;
  abil.pop = Math.max(0, abil.pop - 0.05);
  const target = abil.slow > 0 ? CONFIG.SLOW_FACTOR : 1;
  abil.tf += (target - abil.tf) * 0.25;
  if (Math.abs(abil.tf - target) < 0.01) abil.tf = target;
}

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

// Beim Betreten des Bosskampfs: laufende Wirkung endet, Kugeln verschwinden. Das Extraleben bleibt.
function clearAbilitiesForBoss() {
  abil.slow = abil.phantom = abil.shrink = 0;
  abil.active = null;
  pickups = [];
}

function drawPickups(a) {
  const camX = lerp(game.prevScroll, game.scroll, a);
  for (const u of pickups) {
    const sx = lerp(u.px, u.x, a) - camX, y = lerp(u.py, u.y, a);
    if (sx < -30 || sx > W + 30) continue;
    const A = ABILITIES[u.kind];
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

// Symbole: Uhr, Herz, Geist, Pfeile nach innen
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
  }
}

