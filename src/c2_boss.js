// ============================================================
// Boss: gemeinsame Grundmechanik, eigenes Verhalten pro Boss.
// Ablauf: BOSS_INTRO (Einflug) -> BOSS_GRACE (Schonfrist) -> BOSS_FIGHT.
// Ein Angriff nach dem anderen. Jedes ausgewichene Geschoss oder Teil prallt am Rand ab und fliegt
// blass zum Boss zurück; ein ausgewichener Angriff ist ein Treffer (pending zählt alle Teile, auch
// solche, die erst später entstehen oder starten). Angriffe ohne fliegendes Teil (Wand, Netz, Strahl,
// Zunge, Pendel, Ring, Blitz, Fontäne) schicken am Ende einen blassen Funken zum Boss.
// Treffer pro Level stehen in BOSS_LIVES; im letzten Level kommen die 19 Bosse der Level davor
// nacheinander mit je 2 Treffern.
// Tempo über die Flugzeit (bossTTC): Abstand und Tempo hängen von der Bildbreite ab, die Zeit bis zum
// Vogel bleibt auf jedem Gerät gleich. Effekte direkt an der Vogelspalte haben feste Zeiten.
// Muster mit seq (PATTERNS) wechseln sich ab: A, B, A, B.
// Alle Bahnen sind ohne Zufall aus den Startwerten berechnet. Spiel und Bot (f_autotest.js) nutzen
// dieselben Funktionen: orbMove/orbBreak/orbGone für Geschosse, FX[typ].shape für Effekte.
// ============================================================
// Uhrwerkeule: drei kleine Zahnräder im Takt, jedes zielt bei seinem eigenen Abschuss
const TICK = { gap: 18, r: 9, speed: 0.85 };
// Pilzkönig: Zickzack ±amp um die Ziellinie, halbe Periode etwa half Frames
const ZIG = { amp: 30, half: 20, r: 11 };
// Steinwächter: Neigung der Bahnen beim Kreuzen (relativ zur Waagerechten)
const CONV = { slope: 0.6, r: 11 };
// Lagunenkrabbe: Anteil der Flugzeit nach dem Aufprall, Höchsttempo nach oben
const BOUNCE = { post: 0.6, upMax: 18, r: 12, slow: 1.1 };
// Blütenmotte: Blüte fällt von oben, wird zum Vogel hin langsamer und kommt waagerecht auf seiner Höhe an.
// Flugzeit slow·TTC plus fall Frames pro px Fallhöhe; schaukelt seitlich (höchstens sway px, nie rückwärts)
const BLOSSOM = { r: 12, slow: 1.4, fall: 0.1, sway: 9, half: 22, g2: 0.03 };
// Hummelkönigin: Fadenkreuz folgt dem Vogel, rastet lock Frames vor dem Stich ein
const STING = { lock: 18, r: 11, speed: 1.05 };
// Wolkenwal: Blase gleitet bis stop px vor die Vogelmitte, schwebt hover Frames, platzt in drei Tropfen
// (geradeaus und ±spread rad); an der Vogelspalte liegen die Tropfen 74 px auseinander
const BUBBLE = { r: 17, stop: 118, travel: 1.35, hover: 24, drop: 4.2, dropR: 7, spread: 0.56 };
// Lagunenkrabbe: zweite Muschel rollt am Boden, late Frames nach der springenden an der Vogelspalte
const ROLLER = { r: 20, late: 14 };
// Tiefseeangler: Köder fliegt schneller als ein normaler Schuss, das Ziel steht ab der Vorwarnung fest
const LURE = { r: 11, speed: 1.2 };
// Frostgolem: Eissplitter landet land px vor der Vogelmitte, drei kleine Splitter springen bogenförmig
// hoch und überqueren die Vogelspalte im Scheitel auf Zielhöhe und ±gap
const ICE = { r: 13, land: 104, time: 0.85, grav: 0.22, gap: 78, sr: 7, sg: 0.4 };
// Schlingchamäleon: Zunge schnellt in ext Frames vor, hält, zieht sich zurück; reicht over px hinter den Vogel
const TONGUE = { ext: 12, hold: 8, back: 14, hw: 6, over: 46 };
// Gewitterkoloss: Donnerwelle ist schneller als eine normale Welle
const THUNDER = { speed: 1.1 };
// Sandskarabäus: Sandsturm-Wand, deren Lücke mit drift px pro Frame wandert
const SAND = { drift: 0.5, w: 34 };
// Pilzkönig: Sporenwolke, fünf Sporen um die Ziellinie, langsam, mit leichtem Wippen
const SPORE = { r: 9, speed: 0.62, spread: 24, bob: 5, offs: [[0, 0], [24, -38], [-20, 36], [44, 12], [-40, -14]] };
// Irrlichtkröte: Brocken platzt nach at der Flugzeit in drei Irrlichter, die steer Frames lang mit
// höchstens acc px/Frame² der Vogelhöhe folgen (höchstens vmax), danach geradeaus
const WISP = { r: 15, at: 0.35, slow: 0.55, dvs: [-0.6, 0, 0.6], wr: 9, steer: 18, acc: 0.09, k: 0.025, vmax: 1.4 };
// Magmageist: Kugel teilt sich nach at der Flugzeit in drei Teile (±dv)
const SPLIT = { r: 17, speed: 0.85, at: 0.4, dv: 1.5, pr: 10 };
// Prismenwächter: Kristall dx px vor dem Maul auf Höhe des Vogels (Mittelstrahl waagerecht), drei
// Strahlen, an der Vogelspalte fan px auseinander
const PRISM = { dx: 32, fan: 150, active: 12, hw: 6, move: 14 };
// Steinwächter: Felsblöcke rollen time·TTC bis zur Vogelspalte, der Sprung endet dort im Scheitel
const BOULDER = { r: 15, time: 1.25, grav: 0.45, next: 34 };
// Grottenspinne: Netz sperrt ±half um die Vogelhöhe, active Frames lang
const WEB = { half: 42, left: 64, right: 84, active: 22 };
// Uhrwerkeule: Pendel (Länge len, Ausschlag th rad) schwingt einmal in swing Frames (drei Takte) durch
const PEND = { len: 150, th: 1.0, swing: 54, r: 15 };
// Sektorwächter: Ring breitet sich vom Maul aus (erreicht die Vogelspalte nach time·TTC), geschlossen bis
// auf eine Öffnung von 2·gap px, die sich langsam dreht (spin rad/Frame) und die Vogelspalte genau auf der
// vorher markierten Höhe kreuzt. Drehung spin rad pro px Wachstum (auf jeder Bildbreite gleich).
// Mindesttempo vmin px/Frame, damit der Ring auf schmalen Bildschirmen nicht zu lange über dem Vogel steht.
// Gefährlich ist nur der Ring selbst (Dicke 2·h).
const RING = { h: 7, gap: 95, time: 1.3, spin: 0.0015, ds: 5, vmin: 4 };
// Nebelqualle: zwei Knoten links und rechts der Vogelspalte, der Blitz springt zwischen ihnen
const ZAP = { left: 74, right: 140, active: 14, hw: 6, move: 24 };
// Aschephönix: Feuerschwinge stürzt entlang einer schrägen Linie durch die Vogelhöhe
const DIVE = { slope: 0.5, r: 18, time: 0.75, extra: 70 };
// Magmageist: langsame Feuerwelle (Tempo relativ zur normalen Welle, Breite, Lückenhöhe)
const FIREWAVE = { speed: 0.8, w: 40, gap: 165 };
// Magmageist: drei Fontänen nacheinander auf den Vogel zu, die letzte an der Vogelspalte
const FOUNT = { hw: 14, rise: 7, hold: 14, fall: 10, step: 10, offs: [150, 75, 0], above: 48, minTop: 80 };
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
const rainSpeed = () => Math.max(2.2, (bossDist() - 16) / (bossTTC() * 1.3));
// Pause zwischen zwei Angriffen (enthält die Vorwarnung): von 90 Frames in Level 1 auf 64 in Level 14,
// pro Muster verschiebbar (cd), nie kürzer als die Vorwarnung
function attackCooldown(pat) {
  const P = PATTERNS[pat || currentPattern()];
  return Math.max(Math.max(64, CONFIG.ATTACK_COOLDOWN - 2 * game.level) + (P.cd || 0), P.warn + 4);
}
const isRushLevel = li => li === LEVELS.length - 1;
const RUSH_COUNT = LEVELS.length - 1;          // Bosse im Ansturm: die der Level 1 bis 19
// Trefferzahl: laut BOSS_LIVES, im Boss-Ansturm jeder Boss 2
const bossNeedFor = li => (isRushLevel(li) ? CONFIG.RUSH_HITS : BOSS_LIVES[li]);

function makeBoss(li) {
  const b = { li, x: W + 40, enterX: W + 40, y: Math.round(rand(CONFIG.BOSS_Y_MIN + 60, CONFIG.BOSS_Y_MAX - 60)), dir: RNG() < 0.5 ? -1 : 1, timer: 0, plan: null,
    flash: 0, vy: 0, rot: 0, t: 0, n: 0, defeated: false, seed: randInt(1, 9999), hits: 0, need: bossNeedFor(game.level), queue: [] };
  b.px = b.x; b.py = b.y;
  return b;
}
const bossMouth = () => ({ x: boss.x + CONFIG.BOSS_MOUTH_DX, y: boss.y + CONFIG.BOSS_MOUTH_DY });
const bossPatternOf = li => LEVELS[li].boss.pattern;
const bossCenter = b => ({ x: b.x + CONFIG.BOSS_W / 2, y: b.y + CONFIG.BOSS_H / 2 });

// Zielen: einmalig beim Abschuss auf die Höhe des Vogels, mit der echten Flugzeit bis zu ihm
function flightFrames(mx, speed) { return Math.max(12, (mx - birdHomeCX()) / (speed || shotSpeed())); }
function aimVy(mx, my, speed, ty) {
  return clamp(((ty === undefined ? birdCY() : ty) - my) / flightFrames(mx, speed), -CONFIG.AIM_VY_MAX, CONFIG.AIM_VY_MAX);
}

// ---------- Geschlossene Flugbahnen ----------
// Position als Funktion der Flugzeit t (Frames seit dem Start). Spiel und Bot rechnen mit derselben Formel.
function pathAt(P, t, out) {
  let x = P.x0 + P.vx * t, y = P.y0;
  switch (P.kind) {
    case 'zig': {
      const u = t / P.half, k = Math.floor(u), f = u - k;
      y = P.y0 + P.vy * t + P.amp * P.dir * (k % 2 ? -1 : 1) * (1 - Math.abs(2 * f - 1));
      break;
    }
    case 'arc': y = P.y0 + P.v * t + P.g * t * t / 2; break;
    case 'bounce': {
      if (t <= P.tb) y = P.y0 + P.v1 * t + P.g * t * t / 2;
      else { const u = t - P.tb; y = P.yb - P.u * u + P.g * u * u / 2; }
      break;
    }
    // Blüte: fällt, wird langsamer und kommt bei T waagerecht auf Höhe ty an, danach sinkt sie sanft
    case 'glide': {
      const u = t / P.T;
      y = u <= 1 ? P.y0 + (P.ty - P.y0) * (2 * u - u * u) : P.ty + P.g2 * (t - P.T) * (t - P.T) / 2;
      x += P.ax * Math.sin(P.wx * t);
      break;
    }
    case 'roll': break;
    // Felsblock: rollt bis tj, springt dann im Bogen (Scheitel an der Vogelspalte)
    case 'hop': { const u = t - P.tj; if (u > 0) y = P.y0 - P.v * u + P.g * u * u / 2; break; }
    // Spore: Wolke breitet sich in spread Frames um die Ziellinie aus und wippt leicht
    case 'spore': {
      const e = ease.outCubic(t / SPORE.spread);
      x += P.dx * e;
      y = P.y0 + P.vy * t + P.dy * e + SPORE.bob * Math.sin(0.1 * t + P.ph);
      break;
    }
    // Wolkenblase: gleitet in T Frames zum Haltepunkt und bleibt dort
    case 'drift': {
      const e = ease.outCubic(t / P.T);
      x = P.x0 + (P.x1 - P.x0) * e;
      y = P.y0 + (P.y1 - P.y0) * e;
      break;
    }
  }
  out.x = x;
  out.y = y;
}

function orb(m, vx, vy, r, g) {
  return { type: 'orb', li: boss ? boss.li : game.level, x: m.x, y: m.y, px: m.x, py: m.y, vx, vy, r, grav: 0, t: 0, group: g };
}
// Geschoss auf geschlossener Bahn P
function pOrb(x, y, r, g, P, look) {
  const o = orb({ x, y }, P.vx || 0, 0, r, g);
  o.path = P;
  if (look) o.look = look;
  return o;
}
function aimedOrb(m, ty, sp, r, g) { return orb(m, -sp, aimVy(m.x, m.y, sp, ty), r, g); }
function wall(x, vx, gapY, g, type, look) {
  return { type: type || 'wave', wall: true, li: boss ? boss.li : game.level, x, px: x, gapY, gapH: CONFIG.WAVE_GAP, w: 30, vx, drift: 0, t: 0, group: g, look, seed: (g * 7919) % 9973 + 1 };
}

// ---------- Bausteine der Angriffe (ohne Zufall; Bot und Spiel bauen sie gleich) ----------
// Blütenmotte
function blossomOrb(m, ty, dir, g) {
  const bx = birdHomeCX(), xs = m.x - 14, ys = -22, D = Math.max(0, ty - ys);
  const T = Math.round(bossTTC() * BLOSSOM.slow + D * BLOSSOM.fall), vx = (bx - xs) / T;
  const n = Math.max(1, Math.round(T / BLOSSOM.half)), wx = Math.PI * n / T;
  const ax = (dir || 1) * Math.min(BLOSSOM.sway, 0.7 * Math.abs(vx) / wx);
  return pOrb(xs, ys, BLOSSOM.r, g, { kind: 'glide', x0: xs, vx, y0: ys, ty, T, g2: BLOSSOM.g2, ax, wx });
}
// Hummelkönigin: Stich auf die eingerastete Höhe
function stingOrb(m, ty, g) {
  const o = aimedOrb(m, ty, shotSpeed() * STING.speed, STING.r, g);
  o.markY = ty;
  o.mark = 'cross';
  return o;
}
// Wolkenwal
function bubbleOrb(m, ty, g) {
  const T = Math.round(bossTTC() * BUBBLE.travel);
  const o = pOrb(m.x, m.y, BUBBLE.r, g, { kind: 'drift', x0: m.x, vx: 0, y0: m.y, x1: birdHomeCX() + BUBBLE.stop, y1: clamp(ty, 40, GROUND_Y - 40), T }, 'cloud');
  o.popAt = T + BUBBLE.hover;
  return o;
}
function bubbleDrops(p) {
  return [-BUBBLE.spread, 0, BUBBLE.spread].map(a => {
    const o = orb(p, -BUBBLE.drop * Math.cos(a), BUBBLE.drop * Math.sin(a), BUBBLE.dropR, p.group);
    o.look = 'drop';
    return o;
  });
}
// Lagunenkrabbe: springende Muschel (Wurf nach unten, Aufprall an der Wasserlinie, dann steigt sie gebremst
// und erreicht genau an der Vogelmitte ihren höchsten Punkt). Ist der Vogel sehr hoch, fliegt sie etwas
// langsamer, damit sie nicht schneller als upMax aus dem Wasser schießt.
function bounceOrb(m, ty, g) {
  const r = BOUNCE.r, yb = GROUND_Y - r, h = Math.max(1, yb - ty), D = Math.max(12, m.x - birdHomeCX());
  const T = Math.max(bossTTC() * BOUNCE.slow, 2 * h / (BOUNCE.post * BOUNCE.upMax));
  const t2 = T * BOUNCE.post, tb = T - t2, gr = 2 * h / (t2 * t2), u = gr * t2;
  const v1 = (yb - m.y) / tb - gr * tb / 2;
  const o = pOrb(m.x, m.y, r, g, { kind: 'bounce', x0: m.x, vx: -D / T, y0: m.y, v1, g: gr, tb, yb, u, T });
  o.bounceX = m.x - D / T * tb;
  return o;
}
// ... und die rollende Muschel, die T Frames bis zur Vogelmitte braucht
function rollerOrb(m, T, g) {
  const r = ROLLER.r, x0 = m.x + 30, y0 = GROUND_Y - r;
  const o = pOrb(x0, y0, r, g, { kind: 'roll', x0, vx: -(x0 - birdHomeCX()) / T, y0 }, 'shell');
  o.roll = true;
  return o;
}
function shellPair(m, ty, g) {
  const b = bounceOrb(m, ty, g);
  return [b, rollerOrb(m, b.path.T + ROLLER.late, g)];
}
// Tiefseeangler
function baitOrb(m, ty, g) {
  const o = aimedOrb(m, ty, shotSpeed() * LURE.speed, LURE.r, g);
  o.markY = ty;
  o.mark = 'lure';
  o.look = 'bait';
  return o;
}
// Frostgolem
function iceShard(m, ty, g) {
  const bx = birdHomeCX(), xL = bx + ICE.land, yL = GROUND_Y - ICE.r, T = Math.round(bossTTC() * ICE.time);
  const v = (yL - m.y) / T - ICE.grav * T / 2, tc = clamp(ty, 40, GROUND_Y - 34);
  const o = pOrb(m.x, m.y, ICE.r, g, { kind: 'arc', x0: m.x, vx: (xL - m.x) / T, y0: m.y, v, g: ICE.grav }, 'shard');
  o.landAt = T;
  o.cross = [tc - ICE.gap, tc, tc + ICE.gap].filter(y => y >= 40 && y <= GROUND_Y - 34);
  return o;
}
function iceSplinters(p) {
  const D = p.x - birdHomeCX();
  return p.cross.map(yc => {
    const h = Math.max(8, p.y - yc), Tc = Math.round(clamp(Math.sqrt(2 * h / ICE.sg), 14, 46)), g = 2 * h / (Tc * Tc);
    return pOrb(p.x, p.y, ICE.sr, p.group, { kind: 'arc', x0: p.x, vx: -D / Tc, y0: p.y, v: -g * Tc, g }, 'shard');
  });
}
// Schlingchamäleon: zweite Kugel schert zur vorher gewählten Seite aus
function divergeOrbs(m, ty, side, g) {
  const S = shotSpeed(), aim = aimVy(m.x, m.y, S, ty);
  return [orb(m, -S, aim, 11, g), orb(m, -S, aim + (side || 1) * 1.3, 11, g)];
}
// Pilzkönig: Zickzackblatt, Dreieckschwingung ±amp um die Ziellinie, bei T genau auf der Linie
function zigOrb(m, ty, dir, g) {
  const sp = shotSpeed(), T = flightFrames(m.x, sp), n = Math.max(1, Math.round(T / ZIG.half));
  return pOrb(m.x, m.y, ZIG.r, g, { kind: 'zig', x0: m.x, vx: -sp, y0: m.y, vy: (ty - m.y) / T, amp: ZIG.amp, dir: dir || 1, half: T / n, T });
}
function sporeOrbs(m, ty, g) {
  const sp = shotSpeed() * SPORE.speed, T = flightFrames(m.x, sp), vy = (ty - m.y) / T;
  return SPORE.offs.map(([dx, dy], i) => pOrb(m.x, m.y, SPORE.r, g, { kind: 'spore', x0: m.x, vx: -sp, y0: m.y, vy, dx, dy, ph: i * 1.7 }, 'spore'));
}
// Irrlichtkröte
function wispRock(m, ty, g) {
  const S = shotSpeed(), o = aimedOrb(m, ty, S, WISP.r, g);
  o.splitAt = Math.round(flightFrames(m.x, S) * WISP.at);
  o.wisp = true;
  return o;
}
// Steinwächter: zwei Steine, einer kommt von oben (sinkt beim Kreuzen), einer von unten (steigt), beide
// treffen sich bei (Vogelmitte, ty). Neigung beim Kreuzen ±CONV.slope.
function convergeOrbs(m, ty, g) {
  const sp = shotSpeed(), T = flightFrames(m.x, sp), D = T * sp, d = ty - m.y, s = CONV.slope * D;
  const out = [];
  for (const side of [-1, 1]) {
    const gg = 2 * (-side * s - d) / (T * T), v = -side * CONV.slope * sp - gg * T;
    const o = pOrb(m.x, m.y, CONV.r, g, { kind: 'arc', x0: m.x, vx: -sp, y0: m.y, v, g: gg, T });
    o.crossY = ty;
    o.side = side;
    out.push(o);
  }
  return out;
}
// ... und die springenden Felsblöcke: rollen vom Boss los, Scheitel genau an der Vogelspalte auf Höhe ty
function boulderOrb(m, ty, g) {
  const r = BOULDER.r, x0 = m.x + 28, y0 = GROUND_Y - r, bx = birdHomeCX(), T = Math.round(bossTTC() * BOULDER.time), vx = -(x0 - bx) / T;
  const h = Math.max(10, y0 - clamp(ty, 40, GROUND_Y - 30)), J = Math.round(clamp(Math.sqrt(2 * h / BOULDER.grav), 16, 40)), gg = 2 * h / (J * J);
  const o = pOrb(x0, y0, r, g, { kind: 'hop', x0, vx, y0, tj: T - J, v: gg * J, g: gg }, 'rock');
  o.roll = true;
  o.jumpX = x0 + vx * (T - J);
  o.apexY = y0 - h;
  return o;
}
// Uhrwerkeule: kleines Zahnrad, gezielt wie ein normaler Schuss, etwas kleiner und langsamer
function tickGear(m, ty, g) {
  const sp = shotSpeed() * TICK.speed, o = orb(m, -sp, aimVy(m.x, m.y, sp, ty), TICK.r, g);
  o.type = 'gear';
  o.ang = 0;
  return o;
}
// Magmageist: Kugel, die sich auf halbem Weg in drei Teile teilt
function splitOrb(m, ty, g) {
  const S = shotSpeed() * SPLIT.speed, o = aimedOrb(m, ty, S, SPLIT.r, g);
  o.splitAt = Math.round(flightFrames(m.x, S) * SPLIT.at);
  o.splitDv = SPLIT.dv;
  return o;
}
// Sektorwächter: Ring um das Maul (cx, cy). Die Öffnung kreuzt die Vogelspalte auf Höhe yo: Dort ist
// der Ring zur Zeit to angekommen, die Öffnung zeigt dann genau dorthin. Sie dreht sich zur Mitte hin,
// also gegen die Richtung, in der der Ring an der Vogelspalte auseinanderläuft (sonst liefe sie mit
// und die ganze Seite wäre sicher).
const ringDir = (yo, my) => (yo < my ? -1 : 1);
function ringFx(m, yo, g) {
  const bx = birdHomeCX(), dx = m.x - bx, v = Math.max(RING.vmin, dx / (bossTTC() * RING.time)), Ro = Math.hypot(dx, yo - m.y), to = Ro / v;
  const w = ringDir(yo, m.y) * RING.spin * v, half = Math.asin(Math.min(0.9, RING.gap / Ro));
  const Rend = Math.hypot(m.x - birdHomeX() + 60, Math.max(m.y, GROUND_Y - m.y) + 10);
  return { type: 'ring', fx: true, li: boss ? boss.li : game.level, cx: m.x, cy: m.y, v, yo, w, half, a0: Math.atan2(yo - m.y, -dx) - w * to, end: Math.ceil(Rend / v), t: 0, group: g };
}

// ---------- Ein Frame Bewegung, ohne Nebenwirkungen (Spiel und Bot) ----------
// p.t ist für diesen Frame schon erhöht. by: Höhe der Vogelmitte (nur Irrlichter folgen ihr).
function orbMove(p, by) {
  if (p.path) {
    const px = p.x, py = p.y;
    pathAt(p.path, p.t, p);
    p.vx = p.x - px;
    p.vy = p.y - py;
    return;
  }
  if (p.home && p.t <= WISP.steer) p.vy = clamp(p.vy + clamp((by - p.y) * WISP.k, -WISP.acc, WISP.acc), -WISP.vmax, WISP.vmax);
  p.vy += p.grav || 0;
  p.x += p.vx;
  p.y += p.vy;
}
// Zerfällt das Geschoss in diesem Frame? Dann Art und neue Teile (t = 0, an seiner Stelle)
function orbBreak(p) {
  if (p.splitAt && p.t === p.splitAt) {
    if (p.wisp) {
      return { kind: 'wisp', pieces: WISP.dvs.map(dv => {
        const o = orb(p, p.vx * WISP.slow, p.vy * WISP.slow + dv, WISP.wr, p.group);
        o.home = true;
        o.look = 'wisp';
        return o;
      }) };
    }
    const dv = p.splitDv || 1.4;
    return { kind: 'split', pieces: [-dv, 0, dv].map(d => orb(p, p.vx, p.vy + d, SPLIT.pr, p.group)) };
  }
  if (p.popAt && p.t === p.popAt) return { kind: 'pop', pieces: bubbleDrops(p) };
  if (p.landAt && p.t === p.landAt) return { kind: 'ice', pieces: iceSplinters(p) };
  return null;
}
// Wird das Geschoss in diesem Frame zum Rückpraller? Boden oder Rand
const orbGround = p => p.y + p.r * 0.5 > GROUND_Y;
const orbOut = p => p.x < -p.r - 6 || p.x > W + 90 || p.y < (p.grav > 0 || p.path ? -240 : -p.r - 20);
const orbGone = p => orbGround(p) || orbOut(p);

// ---------- Effekte mit geschlossener Form ----------
// FX[typ]: dur(s) = Ende (dann Funke bei spark(s)), shape(s, t) = gefährliche Formen im Alter t:
//   { c: [x, y, r] } Kreis, { seg: [x0, y0, x1, y1, hw] } dicke Linie, { rect: [x, y, w, h] }
// W ist die Vorwarnung: davor ist nichts gefährlich.
const phase = (u, rise, hold, fall) => (u <= 0 ? 0 : u < rise ? u / rise : u < rise + hold ? 1 : u < rise + hold + fall ? 1 - (u - rise - hold) / fall : 0);
const FX = {
  tongue: {
    len: (s, t) => phase(t - s.W, TONGUE.ext, TONGUE.hold, TONGUE.back),
    dur: s => s.W + TONGUE.ext + TONGUE.hold + TONGUE.back + 1,
    shape(s, t) {
      const f = this.len(s, t);
      return f > 0 ? [{ seg: [s.ox, s.oy, s.ox + (s.ex - s.ox) * f, s.oy + (s.ey - s.oy) * f, TONGUE.hw] }] : [];
    },
    spark: s => ({ x: birdHomeCX() + 24, y: s.ty })
  },
  prism: {
    dur: s => s.W + PRISM.active + 10,
    shape: (s, t) => (t >= s.W && t < s.W + PRISM.active ? s.beams.map(([ex, ey]) => ({ seg: [s.cx, s.cy, ex, ey, PRISM.hw] })) : []),
    spark: s => ({ x: 6, y: clamp(s.cy + (s.beams[1][1] - s.cy) * (6 - s.cx) / (s.beams[1][0] - s.cx), 20, GROUND_Y - 20) })
  },
  web: {
    dur: s => s.W + WEB.active + 12,
    shape: (s, t) => (t >= s.W && t < s.W + WEB.active ? [{ rect: [s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0] }] : []),
    spark: s => ({ x: s.x1, y: clamp(s.ty, 20, GROUND_Y - 20) })
  },
  pendulum: {
    pos(s, t) {
      const u = clamp((t - s.W) / PEND.swing, 0, 1), th = PEND.th * Math.cos(Math.PI * u);
      return { x: s.ax + PEND.len * Math.sin(th), y: s.ay + PEND.len * Math.cos(th), th };
    },
    dur: s => s.W + PEND.swing + 10,
    shape(s, t) {
      if (t < s.W || t > s.W + PEND.swing) return [];
      const b = this.pos(s, t);
      return [{ c: [b.x, b.y, PEND.r] }];
    },
    spark(s) { const b = this.pos(s, s.W + PEND.swing); return { x: b.x, y: clamp(b.y, 20, GROUND_Y - 20) }; }
  },
  ring: {
    // Nur der Teil des Rings in der Nähe der Vogelspalte ist für Treffer und Vorhersage nötig
    shape(s, t) {
      const R = s.v * t, x0 = birdHomeX() - 30, x1 = birdHomeX() + CONFIG.BIRD_W + 30, out = [];
      const c0 = (x0 - s.cx) / R, c1 = (x1 - s.cx) / R;
      if (R < 1 || c1 < -1 || c0 > 1) return out;
      const lo = Math.acos(clamp(c1, -1, 1)), hi = Math.acos(clamp(c0, -1, 1)), da = RING.ds / R, op = s.a0 + s.w * t;
      for (const sg of [1, -1]) {
        for (let a = lo; a <= hi + 1e-9; a += da) {
          const an = sg * a;
          let d = (an - op) % TAU;
          if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
          if (Math.abs(d) < s.half) continue;
          out.push({ c: [s.cx + Math.cos(an) * R, s.cy + Math.sin(an) * R, RING.h] });
        }
      }
      return out;
    },
    dur: s => s.end,
    spark: s => ({ x: 6, y: clamp(s.yo, 20, GROUND_Y - 20) })
  },
  zap: {
    nodes(s, t) {
      const e = ease.outCubic(t / ZAP.move);
      return [lerp(s.ox, s.ax, e), lerp(s.oy, s.ay, e), lerp(s.ox, s.bx, e), lerp(s.oy, s.by, e)];
    },
    dur: s => s.W + ZAP.active + 10,
    shape: (s, t) => (t >= s.W && t < s.W + ZAP.active ? [{ seg: [s.ax, s.ay, s.bx, s.by, ZAP.hw] }] : []),
    spark: s => ({ x: s.ax, y: clamp(s.ay, 20, GROUND_Y - 20) })
  },
  dive: {
    pos: (s, t) => { const x = s.sx + s.vx * Math.max(0, t - s.W); return { x, y: s.sy + DIVE.slope * (s.sx - x) }; },
    dur: s => s.W + Math.ceil((s.sx + 40) / -s.vx),
    shape(s, t) { if (t < s.W) return []; const p = this.pos(s, t); return [{ c: [p.x, p.y, DIVE.r] }]; },
    spark: s => ({ x: 6, y: clamp(s.sy + DIVE.slope * (s.sx - 6), 20, GROUND_Y - 20) })
  },
  fountain: {
    frac: (s, t, i) => phase(t - s.W - i * FOUNT.step, FOUNT.rise, FOUNT.hold, FOUNT.fall),
    dur: s => s.W + (FOUNT.offs.length - 1) * FOUNT.step + FOUNT.rise + FOUNT.hold + FOUNT.fall + 6,
    shape(s, t) {
      const out = [];
      s.xs.forEach((x, i) => {
        const f = this.frac(s, t, i);
        if (f > 0) { const top = GROUND_Y - f * (GROUND_Y - s.top); out.push({ rect: [x - FOUNT.hw, top, FOUNT.hw * 2, GROUND_Y + 6 - top] }); }
      });
      return out;
    },
    spark: s => ({ x: birdHomeCX() + 20, y: clamp(s.top, 20, GROUND_Y - 20) })
  }
};
// Effekte, die bei der Vorwarnung entstehen (Ziel steht ab dann fest)
function tongueFx(m, ty, W, g) {
  const ex = birdHomeX() - TONGUE.over, k = (ex - m.x) / (birdHomeCX() - m.x);
  return { type: 'tongue', fx: true, hold: true, li: boss.li, ox: m.x, oy: m.y, ex, ey: m.y + (ty - m.y) * k, ty, W, t: 0, group: g };
}
function prismFx(m, ty, W, g) {
  const bx = birdHomeCX(), cx = m.x - PRISM.dx, cy = ty, beams = [];
  for (const d of [-PRISM.fan, 0, PRISM.fan]) { const sl = (ty + d - cy) / (bx - cx); beams.push([-20, cy + sl * (-20 - cx)]); }
  return { type: 'prism', fx: true, hold: true, li: boss.li, ox: m.x, oy: m.y, cx, cy, beams, ty, W, t: 0, group: g };
}
function webFx(ty, W, g) {
  const bx = birdHomeCX();
  return { type: 'web', fx: true, li: boss.li, x0: bx - WEB.left, x1: bx + WEB.right, y0: ty - WEB.half, y1: ty + WEB.half, ty, W, t: 0, group: g };
}
// Aufhängung (ax, ay); px/py sind im Spiel für die Zwischenbilder belegt und dürfen hier nicht stehen
function pendFx(ty, W, g) { return { type: 'pendulum', fx: true, li: boss.li, ax: birdHomeCX(), ay: ty - PEND.len, ty, W, t: 0, group: g }; }
function zapFx(m, ty, sl, W, g) {
  const bx = birdHomeCX();
  return { type: 'zap', fx: true, li: boss.li, ox: m.x, oy: m.y, ax: bx - ZAP.left, ay: ty - sl * ZAP.left, bx: bx + ZAP.right, by: ty + sl * ZAP.right, ty, W, t: 0, group: g };
}
function diveFx(ty, W, g) {
  const bx = birdHomeCX(), sx = bx + bossDist() + DIVE.extra;
  return { type: 'dive', fx: true, li: boss.li, sx, sy: ty - DIVE.slope * (sx - bx), vx: -(sx - bx) / (bossTTC() * DIVE.time), ty, W, t: 0, group: g };
}
function fountFx(ty, W, g) {
  const bx = birdHomeCX();
  return { type: 'fountain', fx: true, li: boss.li, xs: FOUNT.offs.map(d => bx + d), top: Math.max(ty - FOUNT.above, FOUNT.minTop), ty, W, t: 0, group: g };
}
// Dicke Linie gegen Rechteck: Punkte entlang der Linie als Kreise
function segHitsBox(x0, y0, x1, y1, hw, b) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / Math.max(2, hw * 0.8)));
  for (let i = 0; i <= n; i++) if (circleBox(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, hw, b)) return true;
  return false;
}
function primHits(pr, b) {
  if (pr.c) return circleBox(pr.c[0], pr.c[1], pr.c[2], b);
  if (pr.rect) return overlap(b, { x: pr.rect[0], y: pr.rect[1], w: pr.rect[2], h: pr.rect[3] });
  return segHitsBox(pr.seg[0], pr.seg[1], pr.seg[2], pr.seg[3], pr.seg[4], b);
}
// Ein Frame für die Vorhersage: liefert die Objekte danach (sich selbst, Teile oder nichts)
function simAdvance(p, by) {
  p.t++;
  if (p.fx) return p.t >= FX[p.type].dur(p) ? [] : [p];
  orbMove(p, by);
  const br = orbBreak(p);
  if (br) return br.pieces;
  return orbGone(p) ? [] : [p];
}

// Der Boss sucht träge die Höhe des Vogels und schwebt dabei leicht auf und ab. Solange Zunge oder
// Prisma am Maul hängen, hält er still.
function moveBoss() {
  if (shots.some(s => s.hold && !s.ghost)) return;
  const target = clamp(birdCY() - CONFIG.BOSS_MOUTH_DY + Math.sin(boss.t * 0.025 + boss.seed) * 46, CONFIG.BOSS_Y_MIN, CONFIG.BOSS_Y_MAX);
  boss.y += clamp((target - boss.y) * 0.035, -CONFIG.BOSS_Y_SPEED, CONFIG.BOSS_Y_SPEED);
}

// Muster mit seq wechseln der Reihe nach
function currentPattern() {
  const p = bossPatternOf(boss.li), P = PATTERNS[p];
  return P.seq ? P.seq[boss.n % P.seq.length] : p;
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
  const pat = currentPattern(), warn = PATTERNS[pat].warn, start = attackCooldown(pat) - warn;
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

// Wartende Teile eines laufenden Angriffs starten (weitere Zahnräder, zweiter Felsblock)
function runBossQueue() {
  if (!boss.queue.length) return;
  const due = [];
  boss.queue = boss.queue.filter(q => (--q.wait > 0 ? true : (due.push(q), false)));
  for (const q of due) launchQueued(q);
}
function launchQueued(q) {
  const m = bossMouth(), C = COLORS[boss.li];
  if (q.kind === 'tick') {
    const o = tickGear(m, birdCY(), q.group);
    o.tick = q.tick;
    shots.push(o);
  } else if (q.kind === 'boulder') shots.push(boulderOrb(m, birdCY(), q.group));
  if (!SIM.on) burst(m.x, m.y, 4, [C.accent, CREAM], 1.8, 12, { grav: 0 });
  sfx('shoot');
}

function updateBossFight() {
  updateBossIdle();
  runBossQueue();
  // Nächster Angriff erst, wenn der vorige vorbei ist; reichen die Ausweichzüge, kommt keiner mehr.
  // Hat die Vorwarnung begonnen (Plan steht), läuft sie bis zum Abschuss durch, auch wenn ein Effekt
  // schon als eigener Angriff unterwegs ist.
  if (!boss.plan && (openAttacks() > 0 || game.dodges >= boss.need)) return;
  const pat = currentPattern(), cd = attackCooldown(pat), warnStart = cd - PATTERNS[pat].warn;
  boss.timer++;
  if (boss.timer === warnStart) boss.plan = planAttack(pat);
  // Hummelkönigin: das Fadenkreuz rastet ein
  if (pat === 'sting' && boss.plan && boss.timer === cd - STING.lock) boss.plan.lockY = birdCY();
  if (boss.timer >= cd) {
    fireAttack(pat, boss.plan || {});
    boss.plan = null;
    boss.timer = 0;
    boss.n++;
  }
}

// Lücke (Mitte) so wählen, dass der Vogel ausweichen muss: minD bis maxD von seiner Höhe entfernt
function gapAway(minD, maxD, lo, hi) {
  const by = birdCY();
  if (lo === undefined) { lo = CONFIG.PIPE_EDGE_MARGIN + CONFIG.WAVE_GAP / 2; hi = GROUND_Y - CONFIG.PIPE_EDGE_MARGIN - CONFIG.WAVE_GAP / 2; }
  const sides = [-1, 1].filter(d => { const c = by + d * minD; return c >= lo && c <= hi; });
  if (!sides.length) return clamp(by + (by < (lo + hi) / 2 ? maxD : -maxD), lo, hi);
  const d = sides.length === 2 ? (RNG() < 0.5 ? -1 : 1) : sides[0];
  return clamp(by + d * rand(minD, maxD), lo, hi);
}

// Beginn der Vorwarnung. Effekte mit festem Ziel (Zunge, Prisma, Netz, Pendel, Blitze, Sturzflug,
// Fontänen) entstehen hier als eigener Angriff und laufen selbstständig.
function planAttack(pattern) {
  const m = bossMouth(), by = birdCY(), mg = CONFIG.PIPE_EDGE_MARGIN, half = CONFIG.WAVE_GAP / 2, W = PATTERNS[pattern].warn;
  switch (pattern) {
    case 'blossom': case 'zigzag': return { dir: RNG() < 0.5 ? -1 : 1 };
    case 'diverge': return { side: RNG() < 0.5 ? -1 : 1 };
    case 'lure': return { lureY: by, fx: boss.x + 12, fy: boss.y + 10 };
    case 'tongue': shots.push(tongueFx(m, by, W, newAttack(1))); return {};
    case 'prism': shots.push(prismFx(m, by, W, newAttack(1))); return {};
    case 'web': shots.push(webFx(by, W, newAttack(1))); return {};
    case 'pendulum': shots.push(pendFx(by, W, newAttack(1))); return {};
    case 'dive': shots.push(diveFx(by, W, newAttack(1))); return {};
    case 'fountain': shots.push(fountFx(by, W, newAttack(1))); return {};
    case 'zap': {
      // Neigung so, dass beide Knoten im Bild bleiben
      let sl = (RNG() < 0.5 ? -1 : 1) * rand(0.15, 0.5);
      const ok = s => by - s * ZAP.left > 14 && by + s * ZAP.right < GROUND_Y - 14 && by - s * ZAP.left < GROUND_Y - 14 && by + s * ZAP.right > 14;
      if (!ok(sl) && ok(-sl)) sl = -sl;
      shots.push(zapFx(m, by, sl, W, newAttack(1)));
      return {};
    }
    case 'laser': {
      // Ursprung fest am Maul (der Boss hält still), damit die Linie genau so bleibt, wie sie angezeigt wurde
      shots.push({ type: 'laser', li: boss.li, ox: m.x, oy: m.y, hold: true, tx: birdHomeCX(), ty: by, warn: PATTERNS.laser.warn, active: PATTERNS.laser.active, thick: 16, t: 0, group: newAttack(1) });
      return {};
    }
    case 'thunder': return { gapY: gapAway(70, 150) };
    case 'firewave': return { gapY: gapAway(60, 140) };
    case 'sandstorm': {
      // Lücke an der Vogelspalte (gA) 60 bis 130 px von der jetzigen Höhe; sie wandert, also startet sie
      // um drift·Flugzeit versetzt. Richtung so, dass die Lücke unterwegs im Bild bleibt.
      const lo = mg + half, hi = GROUND_Y - mg - half, gA = gapAway(60, 130);
      const T = (boss.x - 20 + SAND.w / 2 - birdHomeCX()) / waveSpeedNow() + 20;
      const opts = [-1, 1].filter(d => { const g0 = gA - d * SAND.drift * T; return g0 >= lo && g0 <= hi; });
      const d = opts.length === 2 ? (RNG() < 0.5 ? -1 : 1) : opts.length ? opts[0] : 0;
      return { g0: gA - d * SAND.drift * (T - 20), gA, drift: d * SAND.drift };
    }
    case 'ring': {
      // Öffnung an der Vogelspalte 40 bis 110 px von der jetzigen Höhe, Drehsinn zufällig
      return { yo: gapAway(40, 110, 80, GROUND_Y - 80) };
    }
    case 'emberrain': {
      const vx = rainSpeed(), drift = 0.6, T = (boss.x - birdHomeX()) / vx;
      const g0 = clamp(gapAway(60, 130) - drift * T * 0.5, mg + half, GROUND_Y - mg - half - drift * T);
      return { gapY: g0, drift };
    }
  }
  return {};
}

function fireAttack(pattern, plan) {
  const m = bossMouth(), ty = birdCY(), push = list => { for (const o of list) shots.push(o); };
  switch (pattern) {
    case 'aimed': shots.push(aimedOrb(m, ty, shotSpeed(), 12, newAttack(1))); break;
    case 'blossom': shots.push(blossomOrb(m, ty, plan.dir, newAttack(1))); break;
    case 'sting': shots.push(stingOrb(m, plan.lockY !== undefined ? plan.lockY : ty, newAttack(1))); break;
    case 'cloudpop': shots.push(bubbleOrb(m, ty, newAttack(1))); break;
    case 'shells': push(shellPair(m, ty, newAttack(2))); break;
    case 'lure': shots.push(baitOrb(m, plan.lureY !== undefined ? plan.lureY : ty, newAttack(1))); break;
    case 'icefall': shots.push(iceShard(m, ty, newAttack(1))); break;
    case 'diverge': push(divergeOrbs(m, ty, plan.side, newAttack(2))); break;
    case 'spores': push(sporeOrbs(m, ty, newAttack(SPORE.offs.length))); break;
    case 'zigzag': shots.push(zigOrb(m, ty, plan.dir, newAttack(1))); break;
    case 'wisps': shots.push(wispRock(m, ty, newAttack(1))); break;
    case 'converge': push(convergeOrbs(m, ty, newAttack(2))); break;
    case 'boulders': {
      const g = newAttack(2);
      shots.push(boulderOrb(m, ty, g));
      boss.queue.push({ kind: 'boulder', wait: BOULDER.next, group: g });
      break;
    }
    case 'ticktock': {
      // tick (jetzt), tack, tick: jedes Zahnrad zielt bei seinem eigenen Abschuss
      const g = newAttack(3), o = tickGear(m, ty, g);
      o.tick = 1;
      shots.push(o);
      boss.queue.push({ kind: 'tick', wait: TICK.gap, group: g, tick: 2 }, { kind: 'tick', wait: TICK.gap * 2, group: g, tick: 3 });
      break;
    }
    case 'ring': shots.push(ringFx(m, plan.yo !== undefined ? plan.yo : ty, newAttack(1))); break;
    case 'split': shots.push(splitOrb(m, ty, newAttack(1))); break;
    case 'sandstorm': {
      const w = wall(boss.x - 20, -waveSpeedNow(), plan.g0 !== undefined ? plan.g0 : 272, newAttack(1), 'sandstorm', 'sand');
      w.w = SAND.w;
      w.drift = plan.drift || 0;
      w.arrive = plan.gA;
      shots.push(w);
      break;
    }
    case 'thunder': shots.push(wall(boss.x - 20, -waveSpeedNow() * THUNDER.speed, plan.gapY !== undefined ? plan.gapY : 272, newAttack(1), 'thunder', 'energy')); break;
    case 'firewave': {
      const w = wall(boss.x - 20, -waveSpeedNow() * FIREWAVE.speed, plan.gapY !== undefined ? plan.gapY : 272, newAttack(1), 'firewave', 'fire');
      w.w = FIREWAVE.w;
      w.gapH = FIREWAVE.gap;
      shots.push(w);
      break;
    }
    case 'emberrain': {
      const w = wall(boss.x - 16, -rainSpeed(), plan.gapY !== undefined ? plan.gapY : 260, newAttack(1), 'rain', 'fire');
      w.w = 46;
      w.drift = plan.drift || 0.6;
      shots.push(w);
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
  s.grav = 0; s.splitAt = 0; s.popAt = 0; s.landAt = 0; s.home = false; s.wisp = false;
  s.path = null; s.crossY = undefined; s.bounceX = undefined; s.jumpX = undefined; s.markY = undefined; s.roll = false;
  // Abprall: Richtung umkehren, etwas Höhe behalten
  s.vx = Math.max(2.5, Math.abs(s.vx || 3)) * (s.x < W / 2 ? 1 : -1);
  s.vy = -(s.vy || 0) * 0.6;
  s.t = 0;
  resolveShot(s);
  return s;
}
function ghostSpark(x, y, group, li, r) {
  const o = { type: 'orb', li, x, y, px: x, py: y, vx: x < W / 2 ? 4 : -4, vy: 0, r: r || 10, grav: 0, t: 0, group, ghost: true, spark: true };
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

// Sichtbare Begleiterscheinungen beim Zerfall eines Geschosses
function breakFx(kind, s, C) {
  if (kind === 'ice') { burst(s.x, GROUND_Y - 4, 12, [C.pipe, CREAM, C.accent], 2.8, 18, { kind: 'prism', vr: 0.25, grav: 0.12 }); sfx('shatter'); }
  else if (kind === 'pop') { burst(s.x, s.y, 12, [CREAM, mix(CREAM, C.accent, 0.3)], 2.4, 16, { grav: 0 }); sfx('thud'); }
  else if (kind === 'wisp') { burst(s.x, s.y, 10, [C.accent, CREAM], 2.2, 18, { grav: 0 }); sfx('shatter'); }
  else burst(s.x, s.y, 8, [C.pipe, C.accent, CREAM], 2.2, 18, { kind: 'shard', vr: 0.2 });
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
    if (s.type === 'orb' || s.type === 'gear') {
      const P = s.path, before = P && P.kind === 'bounce' && s.t - 1 <= P.tb, rolled = P && P.kind === 'hop' && s.t - 1 <= P.tj;
      orbMove(s, birdCY());
      if (s.type === 'gear') s.ang += s.vx / s.r;
      if (before && s.t > P.tb) { burst(s.bounceX, GROUND_Y - 4, 7, [CREAM, C.accent], 2.2, 16, { grav: 0.12 }); sfx('thud'); }
      if (rolled && s.t > P.tj) { burst(s.x, GROUND_Y - 4, 6, [C.near, CREAM], 2, 14, { grav: 0.15 }); sfx('thud'); }
      const br = orbBreak(s);
      if (br) {
        const a = attacks.find(q => q.id === s.group);
        if (a) a.pending += br.pieces.length;
        for (const piece of br.pieces) { piece.li = s.li; piece.piece = true; keep.push(piece); }
        breakFx(br.kind, s, C);
        gone = true;
      } else if (orbGround(s)) { burst(s.x, GROUND_Y - 2, 5, [C.accent, CREAM], 2, 14, { grav: 0.15 }); s.y = GROUND_Y - s.r; bounce = true; }
      else if (orbOut(s)) { s.x = clamp(s.x, -s.r, W + 40); s.y = clamp(s.y, -s.r, GROUND_Y - s.r); bounce = true; }
    } else if (s.wall) {
      s.x += s.vx;
      s.gapY += s.drift;
      if (s.vx < 0 ? s.x + s.w < -6 : s.x > W + 6) {
        // Die Wand zerfällt am Rand in zwei Rückpraller
        const ex = s.vx < 0 ? 6 : W - 6;
        for (const gy of [s.gapY - s.gapH / 2 - 26, s.gapY + s.gapH / 2 + 26]) keep.push(ghostSpark(ex, clamp(gy, 20, GROUND_Y - 20), s.group, s.li, 10));
        gone = true;
      }
    } else if (s.fx) {
      const F = FX[s.type];
      if (s.t === s.W) fxStartSound(s, C);
      if (s.t >= F.dur(s)) { const sp = F.spark(s); keep.push(ghostSpark(sp.x, sp.y, s.group, s.li, 9)); gone = true; }
    } else if (s.type === 'laser') {
      if (s.t === s.warn) { sfx('laser'); flash(0.18, mix(CREAM, C.accent, 0.4)); }
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
function fxStartSound(s, C) {
  switch (s.type) {
    case 'zap': sfx('thunder'); break;
    case 'prism': sfx('laser'); break;
    case 'web': sfx('hazard'); break;
    case 'fountain': sfx('thud'); break;
    default: sfx('shoot');
  }
}

// Ein Angriff ist ausgewichen, wenn alle seine Teile am Vogel vorbei sind, ohne zu treffen.
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
  const m = s.ox !== undefined ? { x: s.ox, y: s.oy } : bossMouth();
  const dx = s.tx - m.x, dy = s.ty - m.y, len = Math.hypot(dx, dy) || 1;
  return { ox: m.x, oy: m.y, ux: dx / len, uy: dy / len, slope: dy / dx };
}

function shotHits(s, box) {
  if (s.ghost) return false;
  if (s.fx) { for (const pr of FX[s.type].shape(s, s.t)) if (primHits(pr, box)) return true; return false; }
  if (s.wall) {
    if (!(box.x < s.x + s.w && box.x + box.w > s.x)) return false;
    return box.y < s.gapY - s.gapH / 2 || box.y + box.h > s.gapY + s.gapH / 2;
  }
  switch (s.type) {
    case 'orb': case 'gear': return circleBox(s.x, s.y, s.r, box);
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
const SHOT_CAUSE = { orb: 'Geschoss', gear: 'Zahnrad', wave: 'Welle', rain: 'Glutregen', sandstorm: 'Sandsturm', thunder: 'Donnerwelle', firewave: 'Feuerwelle',
  laser: 'Blitz', tongue: 'Zunge', prism: 'Lichtstrahl', web: 'Netz', pendulum: 'Pendel', ring: 'Ring', zap: 'Quallenblitz', dive: 'Sturzflug', fountain: 'Lavafontäne' };

// ---------- Zeichnen: Angriffe ----------
function drawShots(li, a) {
  drawShotMarks(li, a);
  // Rückpraller zuerst und blass, damit echte Geschosse immer obenauf und gut lesbar bleiben
  for (const pass of [true, false]) {
    for (const s of shots) {
      if (!!s.ghost !== pass) continue;
      const sl = s.li !== undefined ? s.li : li, C = COLORS[sl], L = LEVELS[sl], st = L.style.projectile;
      if (pass) ctx.globalAlpha = GHOST.alpha;
      if (s.type === 'orb') drawOrb(s, C, s.shard ? 'shard' : s.look || st, lerp(s.px, s.x, a), lerp(s.py, s.y, a));
      else if (s.wall) drawWall(s, C, lerp(s.px, s.x, a), s.look || L.style.wave || 'sand');
      else if (s.type === 'gear') drawGearShot(s, C, lerp(s.px, s.x, a), lerp(s.py, s.y, a));
      else if (s.fx) FX_DRAW[s.type](s, C);
      else if (s.type === 'laser') drawLaser(s, C);
      ctx.globalAlpha = 1;
    }
  }
}

// Markierung einer Lücke an der Vogelspalte: Klammern oben und unten
function gapMark(x, gy, num, al, C, half) {
  half = half || CONFIG.WAVE_GAP / 2;
  ctx.fillStyle = rgba(C.accent, 0.28 * al);
  ctx.fillRect(x - 4, gy - half, 5, half * 2);
  ctx.strokeStyle = rgba(CREAM, 0.9 * al);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 9, gy - half); ctx.lineTo(x, gy - half); ctx.lineTo(x, gy - half + 14);
  ctx.moveTo(x + 9, gy + half); ctx.lineTo(x, gy + half); ctx.lineTo(x, gy + half - 14);
  ctx.stroke();
  if (num) {
    circle(x - 11, gy, 9, rgba(INK, 0.55 * al));
    text(String(num), x - 11, gy + 0.5, FS.xs, rgba(CREAM, al));
  }
}
// Pfeil nach oben oder unten (wandernde Lücke)
function driftArrow(x, y, dir, al) {
  ctx.strokeStyle = rgba(CREAM, al);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - dir * 8); ctx.lineTo(x, y + dir * 6);
  ctx.moveTo(x - 5, y + dir * 1); ctx.lineTo(x, y + dir * 7); ctx.lineTo(x + 5, y + dir * 1);
  ctx.stroke();
}
// Kreuzungspunkt der Steine: hohles X, dessen Arme über den Vogel hinausragen
function crossMark(cx, cy, al) {
  ctx.save();
  ctx.strokeStyle = rgba(CREAM, al);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(cx + dx * 13, cy + dy * 10); ctx.lineTo(cx + dx * 25, cy + dy * 19); }
  ctx.stroke();
  ctx.restore();
}
// Fadenkreuz der Hummelkönigin: offen, solange es folgt, geschlossen und farbig, wenn es eingerastet ist
function crosshair(cx, cy, C, al, locked) {
  const col = locked ? mix(C.accent, '#ff6a4a', 0.35) : CREAM, r = locked ? 15 : 19;
  ctx.save();
  ctx.strokeStyle = rgba(col, al);
  ctx.lineWidth = locked ? 2.5 : 1.8;
  ctx.setLineDash(locked ? [] : [5, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(cx + dx * (r - 5), cy + dy * (r - 5)); ctx.lineTo(cx + dx * (r + 7), cy + dy * (r + 7)); }
  ctx.stroke();
  ctx.restore();
}
// Angellicht an der Vogelspalte
function lureLight(x, y, C, al, t) {
  const g = glowSprite(mix(C.accent, CREAM, 0.3)), r = 7 + Math.sin(t * 0.25) * 1.5;
  ctx.globalAlpha *= al;
  ctx.drawImage(g, x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.globalAlpha /= al;
  circle(x, y, r * 0.55, rgba(mix(C.accent, CREAM, 0.6), al));
  ctx.strokeStyle = rgba(CREAM, 0.8 * al);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 7, 0, TAU);
  ctx.stroke();
}
// Öffnung des Rings an der Vogelspalte: kurze Klammern und ein kleiner Ring
function ringMark(x, cy, C, al) {
  const half = RING.gap - RING.h - 4;
  gapMark(x - 12, cy, 0, al, C, half);
  ctx.strokeStyle = rgba(CREAM, 0.8 * al);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 27, cy, 6, Math.PI + 0.9, Math.PI - 0.9 + TAU);
  ctx.stroke();
}
// Punktierte Bahn eines Geschosses (Vorschau), bis es an der Vogelspalte vorbei ist
function previewPath(o, C, al, step, t0) {
  const q = Object.assign({}, o), pts = [], bx = birdHomeX() - 6;
  for (let t = (t0 || 0) + 1; t <= (t0 || 0) + 200; t++) {
    q.t = t;
    orbMove(q, birdCY());
    if (q.x < bx || q.y > GROUND_Y) break;
    if (t % (step || 3) === 0) pts.push([q.x, q.y, 1.8 + al]);
  }
  dots(pts, rgba(CREAM, 0.25 + 0.5 * al));
}
// Frostgolem: Aufprallstelle und die drei Splitterbögen
function icePreview(shard, C, al) {
  const P = {}, T = shard.landAt;
  pathAt(shard.path, T, P);
  ellipse(P.x, GROUND_Y - 3, 12 + 6 * al, 3 + 2 * al, 0, rgba(C.accent, 0.35 + 0.4 * al));
  ctx.strokeStyle = rgba(CREAM, 0.4 + 0.5 * al);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(P.x, GROUND_Y - 3, 12 + 6 * al, 3 + 2 * al, 0, 0, TAU);
  ctx.stroke();
  for (const sp of iceSplinters({ x: P.x, y: P.y, cross: shard.cross, group: 0 })) previewPath(sp, C, al * 0.8, 3);
}
// Hinweise zu fliegenden Angriffen
function drawShotMarks(li, a) {
  const bx = birdHomeCX();
  for (const s of shots) {
    if (s.ghost) continue;
    const C = COLORS[s.li !== undefined ? s.li : li];
    if (s.crossY !== undefined && s.side === -1 && s.x > bx) crossMark(bx, s.crossY, 0.8);
    if (s.bounceX !== undefined && s.path && s.t <= s.path.tb) {
      ctx.strokeStyle = rgba(CREAM, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.bounceX, GROUND_Y - 3, 16, 5, 0, 0, TAU);
      ctx.stroke();
    }
    if (s.markY !== undefined && s.x - s.r > bx - 6) {
      if (s.mark === 'lure') lureLight(bx, s.markY, C, 0.9, s.t);
      else crosshair(bx, s.markY, C, 0.9, true);
    }
    if (s.landAt && s.t < s.landAt) icePreview(s, C, 0.8);
    if (s.jumpX !== undefined && s.path && s.t <= s.path.tj) {
      ctx.strokeStyle = rgba(CREAM, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.jumpX, GROUND_Y - 3, 14, 4, 0, 0, TAU);
      ctx.stroke();
      circle(bx, s.apexY, 4, rgba(C.accent, 0.9));
      ctx.setLineDash([3, 5]);
      line(bx - 16, s.apexY, bx + 16, s.apexY, rgba(CREAM, 0.6), 1.5);
      ctx.setLineDash([]);
    }
    if (s.type === 'sandstorm' && s.arrive !== undefined && s.x > birdHomeX() + 8) {
      gapMark(birdHomeX() - 10, s.arrive, 0, 0.75, C);
      if (s.drift) driftArrow(birdHomeX() - 22, s.arrive, Math.sign(s.drift), 0.75);
    }
    if (s.type === 'ring' && s.v * s.t < Math.hypot(s.cx - bx, s.yo - s.cy) + 10) ringMark(birdHomeX() - 2, s.yo, C, 0.9);
  }
}

function drawOrb(s, C, st, x, y) {
  const r = s.r, g = glowSprite(C.accent);
  circle(x + SHADOW.x * 0.6, y + SHADOW.y * 0.6, r, rgba(INK, CONFIG.SHADOW_ALPHA));
  ctx.drawImage(g, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  // ruhiger Schweif hinter dem Geschoss
  const vx = s.x - s.px, vy = s.y - s.py, sp = Math.hypot(vx, vy);
  if (sp > 0.5 && !s.roll) {
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
      // Stachel in Flugrichtung
      if (sp > 0.5) poly([[x + vx / sp * r * 1.7, y + vy / sp * r * 1.7], [x - vy / sp * 4, y + vx / sp * 4], [x + vy / sp * 4, y - vx / sp * 4]], rgba(INK, 0.8));
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
    case 'cloud': {
      // Wolkenblase: helle Haut mit Wölkchen; kurz vor dem Platzen zählt ein Ring herunter und
      // drei Striche zeigen die Richtungen der Tropfen
      const w = s.popAt ? Math.sin(s.t * 0.5) * clamp((s.t - s.popAt + 20) / 20, 0, 1) * 1.5 : 0;
      circle(x, y, r + w, rgba(mix(CREAM, C.accent, 0.25), 0.4));
      dots([[x - 5, y + 3, 6], [x + 4, y + 4, 5], [x, y - 1, 6]], rgba(CREAM, 0.75));
      ctx.strokeStyle = rgba(CREAM, 0.95);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + w, 0, TAU);
      ctx.stroke();
      circle(x - r * 0.4, y - r * 0.45, r * 0.22, rgba('#ffffff', 0.85));
      if (s.popAt && s.t > s.popAt - BUBBLE.hover - 8) {
        const left = clamp((s.popAt - s.t) / BUBBLE.hover, 0, 1), k = 1 - left;
        ctx.strokeStyle = rgba(mix(C.accent, CREAM, 0.2), 0.95);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * left);
        ctx.stroke();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(CREAM, 0.35 + 0.55 * k);
        ctx.beginPath();
        for (const an of [-BUBBLE.spread, 0, BUBBLE.spread]) {
          const ux = -Math.cos(an), uy = Math.sin(an), L0 = r + 10, L1 = r + 18 + 30 * k;
          ctx.moveTo(x + ux * L0, y + uy * L0); ctx.lineTo(x + ux * L1, y + uy * L1);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'drop': {
      const an = Math.atan2(s.vy || 0, s.vx || -1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(an);
      const c = mix(C.accent, CREAM, 0.45);
      ctx.beginPath();
      ctx.moveTo(r * 1.4, 0);
      ctx.quadraticCurveTo(0, -r * 1.1, -r, 0);
      ctx.quadraticCurveTo(0, r * 1.1, r * 1.4, 0);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = rgba(INK, 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      circle(r * 0.3, -r * 0.3, r * 0.3, rgba('#ffffff', 0.8));
      ctx.restore();
      break;
    }
    case 'spore': {
      // Spore: weiche Kugel mit Härchen, pulsiert leicht
      const pr = r * (1 + 0.08 * Math.sin(s.t * 0.2 + s.x * 0.05)), c = mix(C.accent, CREAM, 0.25);
      ctx.strokeStyle = rgba(c, 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const an = k * TAU / 10 + s.t * 0.03; ctx.moveTo(x + Math.cos(an) * pr * 0.8, y + Math.sin(an) * pr * 0.8); ctx.lineTo(x + Math.cos(an) * pr * 1.35, y + Math.sin(an) * pr * 1.35); }
      ctx.stroke();
      circle(x, y, pr, shade(c, -0.25));
      circle(x - 1, y - 1, pr * 0.82, c);
      dots([[x + 2, y + 1, 1.4], [x - 3, y + 3, 1.2], [x + 1, y - 3, 1.1]], rgba(INK, 0.45));
      circle(x - pr * 0.35, y - pr * 0.4, pr * 0.22, rgba(CREAM, 0.8));
      break;
    }
    case 'wisp': {
      // Irrlicht: hell, solange es folgt; danach ruhiger, mit Linie in Flugrichtung
      const steer = s.home && s.t <= WISP.steer, c = mix(C.accent, CREAM, 0.35);
      if (!steer && !s.ghost) {
        const L = Math.hypot(s.vx, s.vy) || 1;
        ctx.setLineDash([3, 5]);
        line(x, y, x + s.vx / L * 70, y + s.vy / L * 70, rgba(CREAM, 0.45), 1.5);
        ctx.setLineDash([]);
      }
      ctx.drawImage(glowSprite(c), x - r * 3, y - r * 3, r * 6, r * 6);
      circle(x, y, r * (steer ? 1 + 0.15 * Math.sin(s.t * 0.6) : 0.9), rgba(c, 0.85));
      circle(x - 1, y - 1, r * 0.5, rgba('#ffffff', 0.9));
      if (steer) {
        ctx.strokeStyle = rgba(CREAM, 0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'bait': {
      // Köder: leuchtende Kugel mit Haken
      const c = mix(C.accent, CREAM, 0.4);
      ctx.drawImage(glowSprite(c), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
      circle(x, y, r, shade(c, -0.2));
      circle(x - 1, y - 1, r * 0.8, c);
      circle(x - r * 0.35, y - r * 0.35, r * 0.3, rgba('#ffffff', 0.9));
      ctx.strokeStyle = rgba(INK, 0.7);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y + r * 1.1, r * 0.45, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'rock': {
      const rng = mulberry32(s.group * 31 + (s.piece ? 7 : 0));
      const pts = [], spin = s.roll && s.path ? (s.x - s.path.x0) / r : s.t * 0.03;
      for (let k = 0; k < 7; k++) { const an = k * TAU / 7 + spin; const rr = r * (0.8 + rng() * 0.3); pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]); }
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

// Wände: Sand, Wolke, Energie (Donner) oder Feuer
function drawWall(s, C, x, look) {
  if (look === 'fire') drawRain(s, C, x);
  else drawWave(s, C, x, look);
  if (s.drift && look !== 'fire') driftArrow(x + s.w / 2, s.gapY, Math.sign(s.drift), 0.8);
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
    const edge = y => (dir > 0 ? x : x + s.w) + Math.sin(y * 0.09 + s.seed) * 4 * dir;
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
      // wirbelnde Sandkörner
      if (s.type === 'sandstorm') {
        const r = mulberry32(s.seed), list = [];
        for (let i = 0; i < 14; i++) { const ey = y0 + ((r() * (y1 - y0) + s.t * (2 + r() * 2)) % Math.max(1, y1 - y0)); list.push([x - 6 + r() * (s.w + 12), ey, 1 + r() * 1.4]); }
        dots(list, rgba(mix(sand, CREAM, 0.5), 0.8));
      }
    }
  }
  ctx.fillStyle = CREAM;
  ctx.fillRect(x - 4, top - 3, s.w + 8, 3);
  ctx.fillRect(x - 4, bot, s.w + 8, 3);
}

// Glutregen und Feuerwelle: Vorhang aus Glut mit sicherer Spalte
function drawRain(s, C, x) {
  const top = s.gapY - s.gapH / 2, bot = s.gapY + s.gapH / 2, hot = mix(C.accent, '#ffd27a', 0.35);
  if (s.type === 'firewave') {
    // Feuerwelle: deckender Flammenkörper mit züngelnder Vorderkante
    for (const [y0, y1] of [[-12, top], [bot, GROUND_Y]]) {
      ctx.fillStyle = hgrad(x, x + s.w, [[0, rgba(hot, 0.95)], [0.45, rgba(C.accent, 0.9)], [1, rgba(shade(C.accent, -0.3), 0.75)]]);
      ctx.beginPath();
      ctx.moveTo(x + s.w, y0);
      for (let y = y0; y <= y1; y += 8) ctx.lineTo(x - 5 - 5 * Math.abs(Math.sin(y * 0.12 + s.t * 0.35)), y);
      ctx.lineTo(x, y1);
      ctx.lineTo(x + s.w, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = hgrad(x - 10, x + s.w + 10, [[0, rgba(C.accent, 0)], [0.5, rgba(C.accent, s.type === 'firewave' ? 0.4 : 0.22)], [1, rgba(C.accent, 0)]]);
  ctx.fillRect(x - 10, -12, s.w + 20, top + 12);
  ctx.fillRect(x - 10, bot, s.w + 20, GROUND_Y - bot);
  const r = mulberry32(s.seed), g = glowSprite(C.accent), list = [];
  for (let i = 0; i < 34; i++) {
    const ex = x + r() * s.w, sp = 3 + r() * 2.5, ey = (r() * (GROUND_Y + 40) + s.t * sp * (s.type === 'firewave' ? -0.6 : 1)) % (GROUND_Y + 40);
    const yy = (ey + GROUND_Y + 40) % (GROUND_Y + 40) - 20;
    if (yy > top - 6 && yy < bot + 6) continue;
    list.push([ex, yy, 1.8 + r() * 2.2]);
  }
  for (const [ex, ey, rr] of list) ctx.drawImage(g, ex - rr * 3, ey - rr * 3, rr * 6, rr * 6);
  dots(list, hot);
  dots(list.map(([ex, ey, rr]) => [ex - rr * 0.3, ey - rr * 0.3, rr * 0.4]), rgba(CREAM, 0.8));
  ctx.fillStyle = rgba(CREAM, 0.9);
  ctx.fillRect(x - 6, top - 3, s.w + 12, 3);
  ctx.fillRect(x - 6, bot, s.w + 12, 3);
  // Pfeile zeigen, wohin die Spalte wandert
  if (s.drift) driftArrow(x + s.w / 2, s.gapY, Math.sign(s.drift), 0.6);
}

// Kleines Zahnrad der Uhrwerkeule (Muster ticktock)
function gearPath(x, y, r, ang, teeth) {
  const rin = r - Math.max(2.6, r * 0.24);
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
  // Zähne ragen etwas über den Trefferradius hinaus, der Körper entspricht ihm
  // Kupferfarben aus dem Akzent statt Messing: hebt sich vor den Messingsäulen und -kulissen ab
  const r = s.r + 1.5, teeth = 8, brass = mix(C.accent, CREAM, 0.12);
  if (!s.ghost) ctx.drawImage(glowSprite(C.accent), x - r * 2, y - r * 2, r * 4, r * 4);
  gearPath(x + SHADOW.x * 0.5, y + SHADOW.y * 0.5, r, s.ang, teeth);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fill();
  const rin = gearPath(x, y, r, s.ang, teeth);
  ctx.fillStyle = rgrad(x, y, 2, r, [[0, mix(brass, CREAM, 0.35)], [0.6, brass], [1, shade(brass, -0.32)]], x - r * 0.35, y - r * 0.4);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.75);
  ctx.lineWidth = 1.6;
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

// Strahl in drei Schichten (Schein, Körper, heller Kern)
function beam(x0, y0, x1, y1, thick, C, a) {
  ctx.lineCap = 'round';
  for (const [lw, col] of [[thick * 2, rgba(C.pipe, 0.22 * a)], [thick, rgba(mix(C.pipe, C.accent, 0.3), 0.75 * a)], [thick * 0.35, rgba(CREAM, a)]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
function dashLine(x0, y0, x1, y1, col, lw, dash) {
  ctx.setLineDash(dash || [8, 6]);
  line(x0, y0, x1, y1, col, lw);
  ctx.setLineDash([]);
}
// Gezackter Blitz zwischen zwei Punkten (Gewitter, Qualle)
function bolt(x0, y0, x1, y1, seed, spread, C, a) {
  const r = mulberry32(seed), n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 16)), L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  const pts = [];
  for (let i = 0; i <= n; i++) { const f = i / n, j = i === 0 || i === n ? 0 : (r() - 0.5) * spread; pts.push([x0 + (x1 - x0) * f + nx * j, y0 + (y1 - y0) * f + ny * j]); }
  for (const [lw, col] of [[8, rgba(C.accent, 0.3 * a)], [3, rgba(mix(CREAM, C.accent, 0.35), 0.9 * a)], [1.2, rgba(CREAM, a)]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
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
  // Blitz: gezackter Kern über dem geraden Strahl
  beam(l.ox, l.oy, ex, ey, s.thick * 0.8, C, a * 0.7);
  bolt(l.ox, l.oy, ex, ey, s.group * 13 + Math.floor(s.t / 3), 14, C, a);
  circle(l.ox, l.oy, 10 * a, rgba(CREAM, 0.7 * a));
}

// ---------- Zeichnen: Effekte ----------
const fade = (s, on, len, out) => (s.t < on ? 0 : s.t < on + len ? 1 : Math.max(0, 1 - (s.t - on - len) / out));
const FX_DRAW = {
  tongue(s, C) {
    const p = clamp(s.t / s.W, 0, 1), bx = birdHomeCX();
    if (s.t < s.W) {
      dashLine(s.ox, s.oy, s.ex, s.ey, rgba(CREAM, 0.3 + 0.6 * p), 1.4 + p, [6, 5]);
      ctx.strokeStyle = rgba(C.accent, 0.5 + 0.5 * p);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, s.ty, 13 - 4 * p, 0, TAU);
      ctx.stroke();
      return;
    }
    const f = FX.tongue.len(s, s.t);
    if (f <= 0) return;
    const tx = s.ox + (s.ex - s.ox) * f, ty = s.oy + (s.ey - s.oy) * f, col = mix(C.accent, '#e0607a', 0.55);
    ctx.lineCap = 'round';
    line(s.ox, s.oy, tx, ty, shade(col, -0.4), TONGUE.hw * 2 + 2);
    line(s.ox, s.oy, tx, ty, col, TONGUE.hw * 2 - 2);
    line(s.ox, s.oy - 2, tx, ty - 2, rgba(CREAM, 0.45), 1.5);
    ctx.lineCap = 'butt';
    circle(tx, ty, 9, shade(col, -0.35));
    circle(tx - 0.5, ty - 0.5, 7.5, col);
    circle(tx - 2.5, ty - 2.5, 2.5, rgba(CREAM, 0.75));
  },
  prism(s, C) {
    const p = clamp(s.t / s.W, 0, 1), a = fade(s, s.W, PRISM.active, 10), m = bossMouth();
    // Kristall gleitet vor dem Boss auf die Höhe des Vogels
    const e = ease.outCubic(s.t / PRISM.move), kx = lerp(s.ox, s.cx, e), ky = lerp(s.oy, s.cy, e);
    const k = 11 + 2 * Math.sin(s.t * 0.2), cf = mix(C.pipe, CREAM, 0.45);
    ctx.drawImage(glowSprite(C.accent), kx - k * 2.4, ky - k * 2.4, k * 4.8, k * 4.8);
    poly([[kx, ky - k * 1.3], [kx + k * 0.7, ky], [kx, ky + k * 1.3], [kx - k * 0.7, ky]], cf, rgba(INK, 0.6), 1.5);
    poly([[kx, ky - k * 1.3], [kx + k * 0.7, ky], [kx, ky]], rgba(CREAM, 0.55));
    if (s.t < s.W) {
      if (e < 1) return;
      dashLine(m.x, m.y, s.cx, s.cy, rgba(CREAM, 0.3 + 0.5 * p), 1.2);
      s.beams.forEach(([ex, ey], i) => dashLine(s.cx, s.cy, ex, ey, rgba(i === 1 ? mix(C.accent, CREAM, 0.4) : CREAM, (i === 1 ? 0.45 : 0.3) + 0.5 * p), 1.2 + p, [8, 6]));
      return;
    }
    if (a <= 0) return;
    beam(m.x, m.y, s.cx, s.cy, 10, C, a);
    for (const [ex, ey] of s.beams) beam(s.cx, s.cy, ex, ey, PRISM.hw * 2, C, a);
    circle(s.cx, s.cy, 8 * a, rgba(CREAM, 0.8 * a));
  },
  web(s, C) {
    const p = clamp(s.t / s.W, 0, 1), a = fade(s, s.W, WEB.active, 12), silk = mix(CREAM, C.accent, 0.12);
    const { x0, x1, y0, y1 } = s;
    // Vorwarnung: zwei Ankerfäden senken sich, dann spannen sich die Randfäden
    const ya = lerp(-10, y0, ease.outCubic(p * 1.6));
    const al = s.t < s.W ? 0.45 + 0.45 * p : a;
    line(x0 + 10, -10, x0 + 10, ya, rgba(silk, al), 1.3);
    line(x1 - 10, -10, x1 - 10, ya, rgba(silk, al), 1.3);
    if (s.t < s.W) {
      if (p > 0.35) {
        const q = (p - 0.35) / 0.65;
        ctx.fillStyle = rgba(C.accent, 0.05 + 0.1 * q);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = rgba(silk, 0.4 + 0.5 * q);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * q, y0);
        ctx.moveTo(x1, y1); ctx.lineTo(x1 - (x1 - x0) * q, y1);
        ctx.moveTo(x0, y1); ctx.lineTo(x0, y1 - (y1 - y0) * q);
        ctx.moveTo(x1, y0); ctx.lineTo(x1, y0 + (y1 - y0) * q);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }
    if (a <= 0) return;
    // Netz: Rahmen, Längs- und Querfäden, Diagonalen
    ctx.fillStyle = rgba(silk, 0.13 * a);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = rgba(silk, 0.85 * a);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 9) { ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 3, (y0 + y1) / 2, x, y1); }
    for (let y = y0; y <= y1 + 0.1; y += (y1 - y0) / 5) { ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 4, x1, y); }
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.moveTo(x0, y1); ctx.lineTo(x1, y0);
    ctx.stroke();
    ctx.strokeStyle = rgba(CREAM, a);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  },
  pendulum(s, C) {
    const p = clamp(s.t / s.W, 0, 1), on = s.t >= s.W, a = s.t <= s.W + PEND.swing ? 1 : Math.max(0, 1 - (s.t - s.W - PEND.swing) / 10);
    const b = FX.pendulum.pos(s, s.t), brass = mix(C.accent, CREAM, 0.15), L = PEND.len;
    // Bahn gestrichelt, Aufhängung oben
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = rgba(CREAM, (on ? 0.35 : 0.3 + 0.5 * p) * a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ax, s.ay, L, Math.PI / 2 - PEND.th, Math.PI / 2 + PEND.th);
    ctx.stroke();
    ctx.setLineDash([]);
    circle(s.ax, s.ay, 4, rgba(CREAM, 0.8 * a));
    const al = on ? a : 0.3 + 0.5 * p;
    // Kette ist harmlos: dünn und gepunktet, nur das Gewicht trifft
    ctx.setLineDash([2, 4]);
    line(s.ax, s.ay, b.x, b.y, rgba(mix(C.near, CREAM, 0.4), 0.55 * al), 1.3);
    ctx.setLineDash([]);
    if (!on) { ctx.globalAlpha = al * 0.6; }
    ctx.drawImage(glowSprite(C.accent), b.x - PEND.r * 2.2, b.y - PEND.r * 2.2, PEND.r * 4.4, PEND.r * 4.4);
    circle(b.x + SHADOW.x * 0.5, b.y + SHADOW.y * 0.5, PEND.r, rgba(INK, CONFIG.SHADOW_ALPHA));
    circle(b.x, b.y, PEND.r, rgrad(b.x, b.y, 2, PEND.r, [[0, mix(brass, CREAM, 0.4)], [0.6, brass], [1, shade(brass, -0.35)]], b.x - 4, b.y - 5));
    ctx.strokeStyle = rgba(INK, 0.7);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, PEND.r, 0, TAU);
    ctx.stroke();
    circle(b.x, b.y, 3, rgba(INK, 0.5));
    ctx.globalAlpha = 1;
  },
  ring(s, C) {
    const R = s.v * s.t, op = s.a0 + s.w * s.t, a0 = op + s.half, a1 = op + TAU - s.half, al = clamp((s.end - s.t) / 12, 0, 1);
    if (R < 2) return;
    ctx.lineCap = 'round';
    for (const [lw, col] of [[RING.h * 2 + 8, rgba(C.accent, 0.22 * al)], [RING.h * 2, rgba(mix(C.accent, CREAM, 0.2), 0.9 * al)], [2, rgba(CREAM, 0.95 * al)]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, R, a0, a1);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    // Sektorteilung und helle Enden an der Öffnung
    ctx.strokeStyle = rgba(INK, 0.45 * al);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 1; k < 8; k++) { const an = a0 + (a1 - a0) * k / 8; ctx.moveTo(s.cx + Math.cos(an) * (R - RING.h), s.cy + Math.sin(an) * (R - RING.h)); ctx.lineTo(s.cx + Math.cos(an) * (R + RING.h), s.cy + Math.sin(an) * (R + RING.h)); }
    ctx.stroke();
    for (const an of [a0, a1]) circle(s.cx + Math.cos(an) * R, s.cy + Math.sin(an) * R, RING.h + 1.5, rgba(CREAM, al));
  },
  zap(s, C) {
    const p = clamp(s.t / s.W, 0, 1), a = fade(s, s.W, ZAP.active, 10), [ax, ay, bx2, by2] = FX.zap.nodes(s, s.t);
    if (s.t < s.W && s.t > ZAP.move * 0.6) {
      dashLine(ax, ay, bx2, by2, rgba(CREAM, 0.25 + 0.55 * p), 1.3 + p, [4, 5]);
      if (Math.floor(s.t / 4) % 2 && p > 0.5) bolt(ax, ay, bx2, by2, s.t, 6, C, 0.25);
    }
    if (s.t >= s.W && a > 0) bolt(ax, ay, bx2, by2, s.group * 7 + Math.floor(s.t / 2), 18, C, a);
    // Knoten: kleine Quallen
    for (const [x, y] of [[ax, ay], [bx2, by2]]) {
      const r = 7 + Math.sin(s.t * 0.3) * 1.2;
      ctx.drawImage(glowSprite(C.accent), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI, TAU);
      ctx.lineTo(x + r, y + 2);
      ctx.lineTo(x - r, y + 2);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(C.accent, CREAM, 0.35), 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(mix(C.accent, CREAM, 0.5), 0.8);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) { ctx.moveTo(x + k * 4, y + 2); ctx.lineTo(x + k * 4 + Math.sin(s.t * 0.2 + k) * 2, y + 9); }
      ctx.stroke();
      circle(x - 2, y - 3, 2, rgba(CREAM, 0.9));
    }
  },
  dive(s, C) {
    const p = clamp(s.t / s.W, 0, 1), ex = -40, ey = s.sy + DIVE.slope * (s.sx - ex);
    if (s.t < s.W) {
      dashLine(s.sx, s.sy, ex, ey, rgba(mix(C.accent, CREAM, 0.4), 0.3 + 0.6 * p), 1.5 + p * 1.5, [10, 7]);
      ctx.strokeStyle = rgba(C.accent, 0.5 + 0.5 * p);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(birdHomeCX(), s.ty, 15 - 5 * p, 0, TAU);
      ctx.stroke();
      return;
    }
    const q = FX.dive.pos(s, s.t), an = Math.atan2(DIVE.slope, -1), hot = mix(C.accent, '#ffd27a', 0.45);
    dashLine(q.x, q.y, ex, ey, rgba(CREAM, 0.3), 1.2, [6, 8]);
    // Glutspur
    const tx = q.x - Math.cos(an) * 70, ty = q.y - Math.sin(an) * 70, gr = ctx.createLinearGradient(q.x, q.y, tx, ty);
    gr.addColorStop(0, rgba(hot, 0.6));
    gr.addColorStop(1, rgba(C.accent, 0));
    ctx.strokeStyle = gr;
    ctx.lineWidth = DIVE.r * 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.drawImage(glowSprite(C.accent), q.x - DIVE.r * 2.4, q.y - DIVE.r * 2.4, DIVE.r * 4.8, DIVE.r * 4.8);
    // Feuerschwinge: Flammenkörper mit angelegten Flügeln, Kopf voran
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(an);
    const fl = Math.sin(s.t * 0.6) * 3;
    poly([[DIVE.r, 0], [-DIVE.r * 0.2, -DIVE.r * 1.1 - fl], [-DIVE.r * 1.3, -DIVE.r * 0.5], [-DIVE.r * 0.6, 0], [-DIVE.r * 1.3, DIVE.r * 0.5], [-DIVE.r * 0.2, DIVE.r * 1.1 + fl]], rgba(C.accent, 0.95));
    ellipse(0, 0, DIVE.r * 0.9, DIVE.r * 0.55, 0, hot);
    ellipse(DIVE.r * 0.25, -1, DIVE.r * 0.45, DIVE.r * 0.28, 0, rgba(CREAM, 0.85));
    circle(DIVE.r * 0.55, -3, 2, INK);
    ctx.restore();
  },
  fountain(s, C) {
    const p = clamp(s.t / s.W, 0, 1), hot = mix(C.accent, '#ffd27a', 0.45);
    s.xs.forEach((x, i) => {
      const u = s.t - s.W - i * FOUNT.step, f = FX.fountain.frac(s, s.t, i);
      if (u <= 0) {
        // Vorwarnung: glühender Spalt im Boden, Höhe der Fontäne gestrichelt
        const q = clamp(s.t / (s.W + i * FOUNT.step), 0, 1);
        ellipse(x, GROUND_Y - 2, FOUNT.hw, 3 + 2 * q, 0, rgba(hot, 0.35 + 0.55 * q));
        if (Math.floor(s.t / 5 + i) % 3 === 0) circle(x + Math.sin(s.t + i) * 6, GROUND_Y - 6 - 4 * q, 2.5, rgba(hot, 0.8));
        dashLine(x, GROUND_Y - 6, x, s.top, rgba(CREAM, 0.2 + 0.45 * q), 1.5, [4, 6]);
        line(x - FOUNT.hw, s.top, x + FOUNT.hw, s.top, rgba(CREAM, 0.3 + 0.6 * q), 2);
        return;
      }
      if (f <= 0) return;
      const top = GROUND_Y - f * (GROUND_Y - s.top);
      ctx.drawImage(glowSprite(C.accent), x - 40, top - 30, 80, GROUND_Y - top + 40);
      ctx.fillStyle = hgrad(x - FOUNT.hw, x + FOUNT.hw, [[0, shade(C.accent, -0.25)], [0.5, hot], [1, shade(C.accent, -0.25)]]);
      ctx.fillRect(x - FOUNT.hw, top + 6, FOUNT.hw * 2, GROUND_Y - top);
      const r = mulberry32(s.group * 5 + i), drops = [];
      for (let k = 0; k < 7; k++) drops.push([x + (r() - 0.5) * FOUNT.hw * 2, top + 4 - r() * 10 - Math.abs(Math.sin(s.t * 0.4 + k)) * 6, 3 + r() * 3]);
      dots(drops, hot);
      dots(drops.map(([dx, dy, rr]) => [dx - 1, dy - 1, rr * 0.4]), rgba(CREAM, 0.8));
    });
  }
};

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
  else if (active && !b.defeated && b.queue && b.queue.length) drawQueueHint(b, bx, by);
}

// Uhr am Maul der Uhrwerkeule: drei Marken für die drei Zahnräder (hohl = schon unterwegs), der Zeiger
// tickt in Vierteln auf die Marke des nächsten Zahnrads zu und steht beim Abschuss genau darauf.
// s: Stellung in Marken (-1 bis 0 während der Vorwarnung, danach bis 2). Dazu eine Ziellinie auf den Vogel.
function drawTickClock(C, m, al, fired, s) {
  const cx = m.x - 21, cy = m.y, R = 11;
  if (bird) {
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = rgba(CREAM, 0.28 * al);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - R - 2, cy);
    ctx.lineTo(birdHomeCX() + 24, birdCY());
    ctx.stroke();
    ctx.setLineDash([]);
  }
  circle(cx, cy, R + 4, rgba(C.accent, 0.25 * al));
  circle(cx, cy, R, rgba(INK, 0.6 * al));
  ctx.strokeStyle = rgba(CREAM, 0.85 * al);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const an = -Math.PI / 2 + k * TAU / 3, px = cx + Math.cos(an) * (R + 7), py = cy + Math.sin(an) * (R + 7);
    if (k >= fired) circle(px, py, 3.2, rgba(mix(C.accent, CREAM, 0.3), al));
    else { ctx.strokeStyle = rgba(CREAM, 0.5 * al); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.stroke(); }
  }
  const an = -Math.PI / 2 + Math.floor(s * 4 + 1e-6) / 4 * TAU / 3;
  line(cx, cy, cx + Math.cos(an) * R * 0.85, cy + Math.sin(an) * R * 0.85, rgba(CREAM, al), 2.2);
  circle(cx, cy, 2, rgba(CREAM, al));
}
// Nach dem ersten Zahnrad tickt die Uhr weiter, bis alle drei unterwegs sind
function drawQueueHint(b, bx, by) {
  const ticks = b.queue.filter(q => q.kind === 'tick');
  if (!ticks.length) return;
  const w = Math.min(...ticks.map(q => q.wait)), fired = 3 - ticks.length;
  drawTickClock(COLORS[b.li], { x: bx + CONFIG.BOSS_MOUTH_DX, y: by + CONFIG.BOSS_MOUTH_DY }, 1, fired, fired - w / TICK.gap);
}

// Sichtbare Vorwarnung am Maul, dazu musterspezifische Hinweise. Effekte mit festem Ziel (Zunge, Prisma,
// Netz, Pendel, Blitz, Qualle, Sturzflug, Fontänen) zeichnen ihre Vorwarnung selbst.
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
  const plan = boss.plan || {}, cx = birdHomeCX(), ty = bird ? birdCY() : 270;
  const wallMark = (gy, x, half) => {
    half = half || CONFIG.WAVE_GAP / 2;
    const top = gy - half, bot = gy + half;
    ctx.strokeStyle = rgba(CREAM, 0.85 * p);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, top); ctx.lineTo(x, top); ctx.lineTo(x, top + 12);
    ctx.moveTo(x + 8, bot); ctx.lineTo(x, bot); ctx.lineTo(x, bot - 12);
    ctx.stroke();
    ctx.fillStyle = rgba(C.accent, 0.35 * p);
    ctx.fillRect(x - 10, top, 8, bot - top);
  };
  switch (pat) {
    case 'blossom': {
      const o = blossomOrb(m, ty, plan.dir, 0);
      previewPath(o, C, p, 4);
      // Knospe oben, die gleich aufgeht
      const k = 4 + 6 * p;
      for (let i = 0; i < 5; i++) { const an = i * TAU / 5 + p * 2; ellipse(o.x + Math.cos(an) * k * 0.7, 20 + Math.sin(an) * k * 0.7, k * 0.6, k * 0.35, an, rgba(mix(C.pipe, '#e8709e', 0.4), 0.5 + 0.5 * p)); }
      circle(o.x, 20, 3, rgba(C.accent, 0.9));
      circle(cx, ty, 3 + p, rgba(C.accent, 0.5 + 0.5 * p));
      break;
    }
    case 'sting': {
      const locked = plan.lockY !== undefined, y = locked ? plan.lockY : ty;
      crosshair(cx, y, C, 0.45 + 0.5 * p, locked);
      if (locked) dashLine(m.x, m.y, cx + 22, y, rgba(mix(C.accent, CREAM, 0.3), 0.7), 1.5, [5, 5]);
      break;
    }
    case 'cloudpop': {
      const x1 = cx + BUBBLE.stop, y1 = clamp(ty, 40, GROUND_Y - 40);
      dashLine(m.x, m.y, x1, y1, rgba(CREAM, 0.25 + 0.4 * p), 1.3, [4, 6]);
      ctx.strokeStyle = rgba(CREAM, 0.3 + 0.5 * p);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x1, y1, BUBBLE.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'shells': {
      const o = bounceOrb(m, ty, 0);
      previewPath(o, C, p, 3);
      ctx.strokeStyle = rgba(CREAM, 0.4 + 0.5 * p);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(o.bounceX, GROUND_Y - 3, 10 + 8 * p, 3 + 2.5 * p, 0, 0, TAU);
      ctx.stroke();
      // rollende Muschel: Pfeile am Boden
      const gy = GROUND_Y - ROLLER.r;
      dashLine(m.x + 30, gy, cx, gy, rgba(CREAM, 0.25 + 0.45 * p), 2, [6, 7]);
      for (let k = 0; k < 3; k++) { const x = lerp(m.x + 10, cx + 30, (k + p) / 3); poly([[x - 8, gy], [x, gy - 6], [x, gy + 6]], rgba(CREAM, 0.3 + 0.5 * p)); }
      circle(cx, ty, 3 + p, rgba(C.accent, 0.5 + 0.5 * p));
      break;
    }
    case 'lure': {
      if (plan.lureY === undefined) break;
      // Das Angellicht wandert von der Angel zur markierten Höhe und bleibt dort
      const e = ease.outCubic(p / 0.45), lx = lerp(bx + 12, cx, e), ly = lerp(by + 10, plan.lureY, e);
      ctx.strokeStyle = rgba(CREAM, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 12, by + 10);
      ctx.quadraticCurveTo((bx + lx) / 2, Math.min(by, ly) - 30, lx, ly);
      ctx.stroke();
      lureLight(lx, ly, C, 0.6 + 0.4 * p, boss.t);
      if (e >= 1) dashLine(m.x, m.y, cx, plan.lureY, rgba(CREAM, 0.2 + 0.4 * p), 1.2, [4, 6]);
      break;
    }
    case 'icefall': icePreview(iceShard(m, ty, 0), C, p); break;
    case 'diverge': {
      const aim = aimVy(m.x, m.y), side = plan.side || 1;
      ctx.lineWidth = 1.5;
      for (const vy of [aim, aim + side * 1.3]) {
        const len = Math.hypot(4, vy);
        dashLine(m.x, m.y, m.x - 4 / len * 80 * p, m.y + vy / len * 80 * p, rgba(CREAM, (vy === aim ? 0.7 : 0.45) * p), 1.5, [4, 4]);
      }
      break;
    }
    case 'sandstorm': {
      if (plan.g0 === undefined) break;
      wallMark(plan.g0, bx - 22);
      if (plan.drift) driftArrow(bx - 32, plan.g0, Math.sign(plan.drift), 0.85 * p);
      gapMark(birdHomeX() - 10, plan.gA, 0, 0.3 + 0.5 * p, C);
      if (plan.drift) driftArrow(birdHomeX() - 22, plan.gA, Math.sign(plan.drift), 0.3 + 0.5 * p);
      break;
    }
    case 'spores': {
      const pts = SPORE.offs.map(([dx, dy], i) => [m.x + dx * 0.3 * p + Math.sin(boss.t * 0.2 + i) * 2, m.y + dy * 0.3 * p, 3 + 3 * p]);
      dots(pts, rgba(mix(C.accent, CREAM, 0.25), 0.5 + 0.5 * p));
      dashLine(m.x, m.y, cx, ty, rgba(CREAM, 0.2 + 0.4 * p), 1.2, [3, 6]);
      ctx.strokeStyle = rgba(CREAM, 0.3 + 0.4 * p);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, ty, 34, 52, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'zigzag': case 'converge': {
      const list = pat === 'zigzag' ? [zigOrb(m, ty, plan.dir, 0)] : convergeOrbs(m, ty, 0);
      for (const o of list) previewPath(o, C, p, pat === 'zigzag' ? 2 : 3);
      if (pat === 'converge') crossMark(cx, ty, 0.45 + 0.5 * p);
      else circle(cx, ty, 3 + p, rgba(C.accent, 0.5 + 0.5 * p));
      break;
    }
    case 'wisps': {
      const o = wispRock(m, ty, 0), sx = m.x + o.vx * o.splitAt, sy = m.y + o.vy * o.splitAt;
      dashLine(m.x, m.y, sx, sy, rgba(CREAM, 0.3 + 0.5 * p), 1.4, [4, 5]);
      ctx.strokeStyle = rgba(C.accent, 0.4 + 0.5 * p);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 + 6 * p, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'boulders': {
      const o = boulderOrb(m, ty, 0);
      dashLine(m.x + 28, GROUND_Y - BOULDER.r, o.jumpX, GROUND_Y - BOULDER.r, rgba(CREAM, 0.25 + 0.45 * p), 2, [6, 7]);
      previewPath(o, C, p, 3, o.path.tj);
      ctx.strokeStyle = rgba(CREAM, 0.4 + 0.5 * p);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(o.jumpX, GROUND_Y - 3, 10 + 6 * p, 3 + 2 * p, 0, 0, TAU);
      ctx.stroke();
      circle(cx, o.apexY, 3 + p, rgba(C.accent, 0.5 + 0.5 * p));
      break;
    }
    case 'thunder': case 'firewave': {
      const half = pat === 'firewave' ? FIREWAVE.gap / 2 : CONFIG.WAVE_GAP / 2;
      if (plan.gapY !== undefined) { wallMark(plan.gapY, bx - 22, half); gapMark(birdHomeX() - 10, plan.gapY, 0, 0.3 + 0.5 * p, C, half); }
      break;
    }
    case 'ticktock': drawTickClock(C, m, 0.4 + 0.6 * p, 0, p - 1); break;
    case 'ring': {
      // Ring bildet sich am Maul, die Öffnung ist an der Vogelspalte markiert
      const rr = 6 + 12 * p, an = Math.atan2((plan.yo || m.y) - m.y, cx - m.x) + boss.t * 0.08 * ringDir(plan.yo || m.y, m.y);
      ctx.strokeStyle = rgba(mix(C.accent, CREAM, 0.3), 0.5 + 0.5 * p);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, rr, an + 0.6, an + TAU - 0.6);
      ctx.stroke();
      if (plan.yo !== undefined) {
        ringMark(birdHomeX() - 2, plan.yo, C, 0.35 + 0.6 * p);
        dashLine(m.x, m.y, cx, plan.yo, rgba(CREAM, 0.15 + 0.3 * p), 1.2, [3, 7]);
      }
      break;
    }
    case 'emberrain':
      if (plan.gapY !== undefined) {
        const x = bx - 22;
        wallMark(plan.gapY, x);
        driftArrow(x - 10, plan.gapY, 1, 0.85 * p);
      }
      break;
    case 'split': case 'aimed': {
      const o = pat === 'split' ? splitOrb(m, ty, 0) : aimedOrb(m, ty, shotSpeed(), 12, 0);
      dashLine(m.x, m.y, cx + 20, ty, rgba(CREAM, 0.2 + 0.4 * p), 1.2, [3, 6]);
      if (pat === 'split') {
        const sx = m.x + o.vx * o.splitAt;
        dashLine(sx, 20, sx, GROUND_Y - 10, rgba(CREAM, 0.2 + 0.35 * p), 1.5, [3, 7]);
      }
      break;
    }
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

