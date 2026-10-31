// ============================================================
// Kunst für fünf weitere Biome: Sumpf (8), Kristall (10), Wolken (11),
// Uhrwerk (12), Asche (13). Registriert Maler in ART2 und lenkt die
// Darstellungsfelder dieser Level am Dateiende auf sie um.
// Alle Namen tragen das Präfix a2, damit nichts mit anderen Dateien kollidiert.
// ============================================================

// ---------- gemeinsame Werkzeuge ----------
// Weicher runder Fleck einer Farbe als kleines Bild, einmal gemalt und danach nur
// annähernd gleichmäßig skaliert gezeichnet (Wolkenschattierung). Das ist billiger als
// viele Radialverläufe; stark gestreckte Flecken (Nebel) bleiben dagegen Verläufe.
const a2Blobs = new Map();
function a2BlobSprite(col) {
  let b = a2Blobs.get(col);
  if (!b) {
    b = newCanvas(64, 64);
    const g = b.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1));
    gr.addColorStop(0.5, rgba(col, 0.5));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    if (a2Blobs.size > 48) a2Blobs.clear();
    a2Blobs.set(col, b);
  }
  return b;
}

// Weicher, gestreckter und optional gedrehter Fleck
function a2Soft(x, y, rx, ry, col, a, rot) {
  if (a <= 0.002 || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(1, Math.max(0.01, ry / rx));
  ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(col, a)], [0.5, rgba(col, a * 0.5)], [1, rgba(col, 0)]]);
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

// Nebelschwaden aus flachen weichen Flecken. P > 0: periodisch im Streifen, sonst über die Himmelsbreite
function a2Mist(P, y, h, col, a, rng, n, rx0, rx1, flat) {
  for (let k = 0; k < n; k++) {
    const x = P ? rng() * P : -80 + rng() * (W + 160), yy = y + (rng() - 0.5) * h;
    const rx = rx0 + rng() * (rx1 - rx0), ry = rx * (flat || 0.12) * (0.7 + rng() * 0.6), al = a * (0.45 + rng() * 0.55);
    if (P) wrapEach(x, P, rx, xx => a2Soft(xx, yy, rx, ry, col, al)); else a2Soft(x, yy, rx, ry, col, al);
  }
}

// Lichtstrahlen als spitze Keile aus einem Punkt
function a2Rays(x, y, n, a0, a1, len, w0, col, alpha, rng) {
  for (let k = 0; k < n; k++) {
    const a = lerp(a0, a1, (k + 0.5) / n) + (rng() - 0.5) * 0.06, wd = w0 * (0.5 + rng());
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, nx = -Math.sin(a), ny = Math.cos(a);
    ctx.beginPath();
    ctx.moveTo(x + nx * 3, y + ny * 3);
    ctx.lineTo(ex + nx * wd, ey + ny * wd);
    ctx.lineTo(ex - nx * wd, ey - ny * wd);
    ctx.lineTo(x - nx * 3, y - ny * 3);
    ctx.closePath();
    const g = ctx.createLinearGradient(x, y, ex, ey);
    g.addColorStop(0, rgba(col, alpha * (0.5 + rng() * 0.5)));
    g.addColorStop(0.6, rgba(col, alpha * 0.25));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fill();
  }
}

// Schmales gebogenes Blatt als gefüllte Form
function a2Blade(x, base, hh, lean, wd, col) {
  ctx.beginPath();
  ctx.moveTo(x - wd, base);
  ctx.quadraticCurveTo(x - wd * 0.5 + lean * 0.35, base - hh * 0.55, x + lean, base - hh);
  ctx.quadraticCurveTo(x + wd * 0.5 + lean * 0.35, base - hh * 0.55, x + wd, base);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
}

// Polylinie als Pfad
function a2Path(pts, close) {
  ctx.beginPath();
  pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  if (close) ctx.closePath();
}

// Glühender Riss in drei Lagen: Schein, Kern, heiße Mitte
function a2GlowLine(pts, C, k) {
  const s = k || 1;
  for (const [lw, c] of [[6 * s, rgba(C.accent, 0.16)], [2.2 * s, rgba(C.accent, 0.75)], [0.9 * s, rgba(C.accentLight, 0.9)]]) {
    a2Path(pts);
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}


// ============================================================
// SUMPF (8): Nebelschwaden, Blasen, Moosgrün
// ============================================================
ART2.sky.swamp = (C, S, rng) => {
  const fog = mix(C.skyBottom, CREAM, 0.35), heavy = shade(C.skyTop, -0.22);
  // schwere, feuchte Wolkendecke am oberen Rand
  for (let i = 0, n = Math.round(W / 34); i < n; i++) {
    const x = rng() * (W + 160) - 80, y = rng() * 95, rx = 70 + rng() * 110;
    a2Soft(x, y, rx, rx * (0.28 + rng() * 0.12), heavy, 0.2 + rng() * 0.2);
  }
  ctx.fillStyle = vgrad(0, 120, [[0, rgba(heavy, 0.35)], [1, rgba(heavy, 0)]]);
  ctx.fillRect(0, 0, W, 120);
  // blasse Sonne hinter Dunst, Schleier quer davor, schwache Strahlen nach unten
  const sx = S.sunX * W, sy = S.sunY, sun = mix(CREAM, C.skyBottom, 0.3);
  ctx.fillStyle = rgrad(sx, sy, 0, 200, [[0, rgba(sun, 0.38)], [0.25, rgba(sun, 0.14)], [1, rgba(sun, 0)]]);
  ctx.fillRect(sx - 200, sy - 200, 400, 400);
  circle(sx, sy, 25, rgrad(sx, sy, 0, 25, [[0, rgba(mix(CREAM, '#ffffff', 0.4), 0.8)], [1, rgba(sun, 0.62)]], sx - 7, sy - 7));
  a2Rays(sx, sy, 7, Math.PI * 0.3, Math.PI * 0.78, 520, 34, mix(CREAM, C.accent, 0.25), 0.06, rng);
  const veil = mix(C.skyTop, C.skyBottom, 0.38);
  a2Soft(sx - 20, sy + 12, 120, 14, veil, 0.5);
  a2Soft(sx + 36, sy - 10, 100, 8, veil, 0.32);
  a2Soft(sx, sy + 30, 160, 16, fog, 0.18);
  // Nebelschwaden in drei Tiefen, zum Horizont dichter
  a2Mist(0, 230, 40, fog, 0.09, rng, Math.round(W / 45), 70, 160, 0.09);
  a2Mist(0, 320, 46, fog, 0.14, rng, Math.round(W / 36), 80, 180, 0.1);
  a2Mist(0, 410, 56, fog, 0.2, rng, Math.round(W / 30), 90, 200, 0.11);
  ctx.fillStyle = vgrad(380, GROUND_Y, [[0, rgba(fog, 0)], [1, rgba(fog, 0.4)]]);
  ctx.fillRect(0, 380, W, GROUND_Y - 380);
};

// Louisianamoos: Vorhänge aus mehreren dünnen, unterschiedlich langen Fäden
function a2MossBeards(list, col) {
  ctx.beginPath();
  for (const [x, y, len, wd, sw] of list) {
    const n = 3, h0 = hash(x * 7.3 + y);
    for (let k = 0; k < n; k++) {
      const fx = x + (k - 1) * wd * 0.9, fl = len * (0.55 + hash(h0 * 31 + k) * 0.45), fw = wd * 0.55;
      ctx.moveTo(fx - fw, y);
      ctx.quadraticCurveTo(fx - fw * 0.5 + sw, y + fl * 0.5, fx + sw * 1.3, y + fl);
      ctx.quadraticCurveTo(fx + fw * 0.5 + sw, y + fl * 0.5, fx + fw, y);
      ctx.closePath();
    }
  }
  ctx.fillStyle = col;
  ctx.fill();
}

// Sumpfzypresse: Brettwurzeln, schlanker Stamm, flache Kronenpolster mit Moosbärten
function a2Cypress(x, base, hgt, w, col, C, seed, moss) {
  const r = mulberry32(seed), top = base - hgt, lean = (r() - 0.5) * hgt * 0.08;
  const lit = shade(col, 0.1), dark = shade(col, -0.2);
  const tx = t => x + lean * t;   // Stammachse
  ctx.beginPath();
  ctx.moveTo(x - w * 1.9, base + 4);
  ctx.bezierCurveTo(x - w * 0.9, base - 2, x - w * 0.55, base - hgt * 0.1, tx(0.3) - w * 0.32, base - hgt * 0.3);
  ctx.lineTo(tx(1) - w * 0.1, top + 6);
  ctx.lineTo(tx(1) + w * 0.1, top + 6);
  ctx.lineTo(tx(0.3) + w * 0.32, base - hgt * 0.3);
  ctx.bezierCurveTo(x + w * 0.6, base - hgt * 0.1, x + w * 1.0, base - 2, x + w * 2.0, base + 4);
  ctx.closePath();
  ctx.fillStyle = hgrad(x - w * 0.8, x + w * 0.8, [[0, lit], [0.45, col], [1, dark]]);
  ctx.fill();
  // Rippen der Brettwurzeln
  const ribs = [];
  for (let k = -2; k <= 2; k++) ribs.push([x + k * w * 0.32, base - hgt * 0.16, x + k * w * 0.8, base + 2]);
  segs(ribs, rgba(INK, 0.12), 1);
  // Äste, Kronenballen sitzen im oberen Drittel
  const pads = [];
  const nb = 3 + Math.floor(r() * 3);
  for (let k = 0; k < nb; k++) {
    const t = 0.6 + 0.32 * (k / Math.max(1, nb - 1)) + (r() - 0.5) * 0.05, side = k % 2 ? 1 : -1;
    const bx = tx(t), by = base - hgt * t, len = hgt * (0.07 + r() * 0.09);
    const ex = bx + side * len, ey = by - len * (0.25 + r() * 0.3);
    ctx.strokeStyle = shade(col, -0.08);
    ctx.lineWidth = Math.max(1.2, w * 0.14);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + side * len * 0.55, by - len * 0.05, ex, ey);
    ctx.stroke();
    pads.push([ex, ey, 8 + r() * 6 + hgt * 0.03]);
  }
  pads.push([tx(1), top + 6, 9 + hgt * 0.035]);
  // Kronenpolster aus vielen kleinen Nadelbüscheln in flacher Kuppelform: fransiger Rand
  const tufts = [], hi = [];
  for (const [px, py, pr] of pads) {
    for (let j = 0; j < 14; j++) {
      const u = r() * 2 - 1, dx = u * pr * 1.15, dome = Math.sqrt(Math.max(0, 1 - u * u)), dy = -dome * pr * 0.55 * r() + (r() - 0.3) * pr * 0.22;
      const tr = pr * (0.21 + r() * 0.17);
      tufts.push([px + dx, py + dy, tr, tr * 0.7, (r() - 0.5) * 0.8]);
      if (dy < -pr * 0.18) hi.push([px + dx - tr * 0.3, py + dy - tr * 0.35, tr * 0.6, tr * 0.4, 0]);
    }
  }
  const fol = mix(col, C.accent, 0.06);
  if (w > 9) ellipses(tufts.map(([a, b, c2, d, e]) => [a + 0.6, b + 1.2, c2, d, e]), shade(fol, -0.14));
  ellipses(tufts, shade(fol, -0.04));
  ellipses(hi, rgba(shade(fol, 0.12), 0.6));
  // Moosvorhänge unter Polstern und an Ästen, nur wenig heller als das Laub
  const beards = [];
  for (const [px, py, pr] of pads) {
    for (let j = 0; j < 4; j++) beards.push([px + (r() - 0.5) * pr * 1.8, py + pr * 0.12, 8 + r() * 26, 1.1 + r() * 1.2, (r() - 0.5) * 3]);
  }
  a2MossBeards(beards, moss);
}

ART2.layerExtent.swampTrees = () => [120, GROUND_Y + 14];
ART2.layerTex.swampTrees = () => ({ grain: 0.04, mottle: 0.1, contrast: 1.1 });
ART2.layer.swampTrees = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, fog = mix(C.skyBottom, CREAM, 0.3);
  // zwei Reihen: hinten blasser und kleiner, vorn etwas dunkler
  for (const [row, n, tone, hMin, hMax] of [[0, 9, 0.5, 150, 230], [1, 7, 0.18, 200, 330]]) {
    const c = mix(col, C.haze, tone), moss = rgba(mix(c, C.haze, 0.35), 0.8);
    for (let k = 0; k < n; k++) {
      const x = (k + 0.5) * P / n + (rng() - 0.5) * P / n * 0.6, hgt = hMin + rng() * (hMax - hMin), w = 6 + rng() * 5 + row * 3;
      const base = 500 + rng() * 12, seed = (rng() * 1e6) | 0;
      wrapEach(x, P, hgt * 0.4, xx => a2Cypress(xx, base, hgt, w, c, C, seed, moss));
    }
    if (row === 0) a2Mist(P, 430, 60, fog, 0.32, rng, 26, 70, 160, 0.14);
  }
  // Nebel liegt auf dem Wasser und lässt die Stämme unten verschwinden
  ctx.fillStyle = vgrad(330, yb, [[0, rgba(C.haze, 0)], [0.7, rgba(C.haze, 0.45)], [1, rgba(fog, 0.8)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 330, P + 16, yb - 330);
  ctx.globalCompositeOperation = 'source-over';
  a2Mist(P, 470, 50, fog, 0.38, rng, 30, 80, 180, 0.12);
};

// Mittlere Ebene: Bulten mit Schilf und toten Stämmen im stillen Wasser, Seerosen und Blasen
ART2.layerExtent.swampBank = () => [300, GROUND_Y + 14];
ART2.layerTex.swampBank = () => ({ grain: 0.05, mottle: 0.14, contrast: 1.1 });
ART2.layer.swampBank = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, wl = 494, fog = mix(C.skyBottom, CREAM, 0.3);
  const water = mix(C.skyBottom, col, 0.42);
  // Wasser: oben im Dunst weich, nach vorn dunkler
  ctx.fillStyle = vgrad(wl - 14, yb, [[0, rgba(water, 0)], [0.25, rgba(water, 0.9)], [0.5, water], [1, shade(water, -0.25)]]);
  ctx.fillRect(-8, wl - 14, P + 16, yb - wl + 14);
  const rip = [];
  for (let k = 0; k < P / 6; k++) { const x = rng() * P, yy = wl + 6 + Math.pow(rng(), 0.8) * 54, len = 4 + rng() * 14 * (yy - wl) / 50; rip.push([x, yy, x + len, yy]); }
  segs(rip, rgba(mix(C.skyBottom, CREAM, 0.4), 0.22), 0.8);
  // Bulten: Inseln aus Gras und Gebüsch, mit Spiegelbild
  const n = 6;
  for (let k = 0; k < n; k++) {
    const cx = (k + 0.5) * P / n + (rng() - 0.5) * 60, hw = 60 + rng() * 70, hh = 12 + rng() * 16, seed = (rng() * 1e6) | 0;
    const snag = rng() < 0.55, snagH = 70 + rng() * 90;
    wrapEach(cx, P, hw + 40, x => a2Hummock(x, wl, hw, hh, col, C, seed, snag, snagH));
  }
  // Seerosenblätter und Blasenringe
  const pads = [], pads2 = [];
  for (let k = 0; k < P / 26; k++) {
    const x = rng() * P, yy = wl + 10 + rng() * 40, rx = 3 + rng() * 5 * (yy - wl) / 40 + 1.5;
    (rng() < 0.5 ? pads : pads2).push([x, yy, rx, rx * 0.32, 0]);
  }
  ellipses(pads.map(([a, b, c, d]) => [a + 0.8, b + 0.8, c, d, 0]), rgba(INK, 0.2));
  ellipses(pads, mix(col, C.accent, 0.35));
  ellipses(pads2, mix(col, C.accent, 0.2));
  const fl = pads.filter(() => rng() < 0.25).map(([a, b]) => [a + 1, b - 1, 1.1]);
  dots(fl, mix(CREAM, C.accent, 0.15));
  ctx.strokeStyle = rgba(mix(C.skyBottom, CREAM, 0.5), 0.4);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let k = 0; k < P / 60; k++) {
    const x = rng() * P, yy = wl + 12 + rng() * 40, rr = 1 + rng() * 2;
    ctx.moveTo(x + rr * 2.4, yy);
    ctx.ellipse(x, yy, rr * 2.4, rr * 0.7, 0, 0, TAU);
    ctx.moveTo(x + 2.2 + rr * 0.5, yy - 1.4);
    ctx.arc(x + 2.2, yy - 1.4, rr * 0.5, 0, TAU);
  }
  ctx.stroke();
  // Dunst über der Wasserlinie
  a2Mist(P, wl - 8, 20, fog, 0.3, rng, 34, 60, 150, 0.13);
};

function a2Hummock(x, wl, hw, hh, col, C, seed, snag, snagH) {
  const r = mulberry32(seed), lit = shade(col, 0.1), dark = shade(col, -0.2);
  // Spiegelbild im Wasser
  ctx.save();
  ctx.translate(0, wl * 2 + 2);
  ctx.scale(1, -0.6);
  ctx.globalAlpha = 0.28;
  a2HummockShape(x, wl, hw, hh, dark, dark, mulberry32(seed));
  ctx.restore();
  // toter Stamm, schräg, mit kahlen Ästen
  if (snag) {
    const lean = (r() - 0.5) * 0.5, tx = x + Math.sin(lean) * snagH, ty = wl - Math.cos(lean) * snagH, bx = x - hw * 0.2;
    const sc = shade(col, -0.12);
    ctx.beginPath();
    ctx.moveTo(bx - 6, wl);
    ctx.lineTo(tx - 1.5, ty);
    ctx.lineTo(tx + 1.2, ty + 4);
    ctx.lineTo(bx + 6, wl);
    ctx.closePath();
    ctx.fillStyle = hgrad(bx - 6, bx + 6, [[0, shade(sc, 0.14)], [1, shade(sc, -0.15)]]);
    ctx.fill();
    const br = [];
    for (let k = 0; k < 3; k++) {
      const t = 0.35 + r() * 0.5, px = lerp(bx, tx, t), py = lerp(wl, ty, t), side = r() < 0.5 ? -1 : 1, len = 12 + r() * 20;
      br.push([px, py, px + side * len, py - len * (0.4 + r() * 0.5)]);
    }
    segs(br, sc, 1.6);
    const beards = br.map(([a, b, c2, d]) => [(a + c2) / 2, (b + d) / 2, 8 + r() * 12, 1.2, 0.5]);
    a2MossBeards(beards, rgba(mix(col, CREAM, 0.25), 0.6));
  }
  a2HummockShape(x, wl, hw, hh, lit, dark, r);
  // Schilfhalme auf der Bulte
  const bl = [];
  for (let k = 0; k < hw / 3; k++) {
    const bx = x - hw * 0.8 + r() * hw * 1.6, by = wl - hh * 0.5 * (1 - Math.abs(bx - x) / hw) - 2, hb = 8 + r() * 18;
    bl.push([bx, by, bx + (r() - 0.4) * 5, by - hb]);
  }
  segs(bl.slice(0, bl.length >> 1), rgba(shade(col, 0.22), 0.8), 1);
  segs(bl.slice(bl.length >> 1), rgba(shade(col, -0.15), 0.8), 1);
  const heads = bl.filter(() => r() < 0.12).map(([a, b, c2, d]) => [c2, d + 3, 1.3, 3.6, 0]);
  ellipses(heads, mix(C.pipe, INK, 0.25));
}

function a2HummockShape(x, wl, hw, hh, lit, dark, r) {
  // flache Grasbulte mit unregelmäßigem Kamm, ein, zwei Büsche obenauf
  const pts = [[x - hw, wl + 1]];
  for (let k = 1; k < 12; k++) {
    const t = k / 12, e = Math.sin(t * Math.PI);
    pts.push([x - hw + t * hw * 2, wl - hh * Math.pow(e, 0.7) * (0.85 + r() * 0.3)]);
  }
  pts.push([x + hw, wl + 1]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.closePath();
  ctx.fillStyle = vgrad(wl - hh, wl, [[0, lit], [1, dark]]);
  ctx.fill();
  const bushes = [];
  for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) {
    const bx = x + (r() - 0.5) * hw, by = wl - hh * 0.8, br = 6 + r() * 6;
    bushes.push([bx, by - br * 0.4, br], [bx - br * 0.7, by, br * 0.7], [bx + br * 0.8, by + 1, br * 0.65]);
  }
  blobPath(bushes);
  ctx.fillStyle = vgrad(wl - hh - 16, wl, [[0, lit], [1, dark]]);
  ctx.fill();
}

// Vordergrund-Requisiten: Rohrkolben, Seggen, Zypressenknie, Baumstumpf mit Pilzen, Farn
ART2.prop.bog = { h: 114, paint: (x, base, s, r, v, C, col) => a2BogProp(x, base, s, r, v, C, col) };
function a2BogProp(x, base, s, r, v, C, col) {
  const brown = mix(C.pipe, INK, 0.3);
  if (v < 0.32) {
    ellipse(x + 7, base - 1, 18 * s, 3 * s, 0, rgba(INK, 0.18));
    const n = 6 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const bx = x + (r() - 0.5) * 16 * s, hh = (32 + r() * 44) * s, lean = (r() - 0.5) * 26 * s;
      a2Blade(bx, base, hh, lean, 2 * s, k % 3 === 0 ? shade(col, 0.22) : k % 3 === 1 ? shade(col, 0.05) : shade(col, -0.12));
    }
    for (let k = 0, m = 1 + Math.floor(r() * 3); k < m; k++) {
      const hx = x + (r() - 0.5) * 12 * s, hh = (52 + r() * 34) * s, lean = (r() - 0.5) * 10 * s;
      line(hx, base, hx + lean, base - hh, shade(col, -0.05), 1.3);
      const cx = hx + lean * 0.88, cy = base - hh * 0.86;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(lean / hh);
      roundRectPath(-2.6 * s, -9 * s, 5.2 * s, 18 * s, 2.6 * s);
      ctx.fillStyle = hgrad(-2.6 * s, 2.6 * s, [[0, shade(brown, 0.25)], [0.6, brown], [1, shade(brown, -0.3)]]);
      ctx.fill();
      line(0, -9 * s, 0, -15 * s, shade(col, -0.05), 1);
      ctx.restore();
    }
  } else if (v < 0.5) {
    const bl = [];
    for (let k = -6; k <= 6; k++) {
      const hgt = (14 + r() * 22) * s * (1 - Math.abs(k) / 9);
      bl.push([x + k * 1.6, base, x + k * 3.6 + (r() - 0.5) * 4, base - hgt]);
    }
    ctx.lineWidth = 1.4;
    for (const [a, b, c2, d] of bl) {
      ctx.strokeStyle = hash(a * 3.3) > 0.5 ? shade(col, 0.2) : shade(col, -0.1);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.quadraticCurveTo(a + (c2 - a) * 0.2, d + (b - d) * 0.3, c2, d);
      ctx.stroke();
    }
  } else if (v < 0.66) {
    // Zypressenknie: knubbelige Kegel, Licht von links oben
    ellipse(x + 8, base - 1, 20 * s, 3.5 * s, 0, rgba(INK, 0.2));
    const wood = mix(C.pipe, col, 0.45);
    for (const [dx, hh, ww] of [[-8, 14, 5], [3, 22, 6.5], [12, 10, 4.5]]) {
      const kx = x + dx * s, kh = hh * s * (0.8 + r() * 0.4), kw = ww * s;
      ctx.beginPath();
      ctx.moveTo(kx - kw * 1.5, base + 2);
      ctx.quadraticCurveTo(kx - kw, base - kh * 0.7, kx - kw * 0.35, base - kh);
      ctx.quadraticCurveTo(kx, base - kh - kw * 0.5, kx + kw * 0.4, base - kh);
      ctx.quadraticCurveTo(kx + kw, base - kh * 0.6, kx + kw * 1.5, base + 2);
      ctx.closePath();
      ctx.fillStyle = hgrad(kx - kw, kx + kw, [[0, shade(wood, 0.2)], [0.55, wood], [1, shade(wood, -0.3)]]);
      ctx.fill();
      ellipse(kx - kw * 0.2, base - kh + 1, kw * 0.7, kw * 0.35, 0, rgba(mix(C.accent, col, 0.4), 0.85));
    }
  } else if (v < 0.8) {
    // Stumpf mit Moospolster und Pilzen
    const sw = (11 + r() * 5) * s, sh = (20 + r() * 16) * s, wood = mix(C.pipe, col, 0.3);
    ellipse(x + 10, base - 1, sw * 1.6, 3.5 * s, 0, rgba(INK, 0.2));
    const top = [];
    for (let k = 0; k <= 6; k++) top.push([x - sw + k * sw / 3, base - sh + (k % 2 ? -4 : 2) * s * (0.6 + r() * 0.6)]);
    a2Path([[x - sw * 1.25, base + 2], ...top, [x + sw * 1.25, base + 2]], true);
    ctx.fillStyle = hgrad(x - sw, x + sw, [[0, shade(wood, 0.18)], [0.5, wood], [1, shade(wood, -0.32)]]);
    ctx.fill();
    const gr = [];
    for (let k = 0; k < 5; k++) { const gx = x - sw * 0.7 + k * sw * 0.35; gr.push([gx, base - sh * 0.8, gx + (r() - 0.5) * 2, base]); }
    segs(gr, rgba(INK, 0.22), 1);
    blobPath([[x - sw * 0.5, base - sh + 1, 5 * s], [x - sw * 0.1, base - sh - 1, 4 * s], [x - sw * 0.9, base - sh * 0.7, 4 * s]]);
    ctx.fillStyle = mix(C.accent, col, 0.45);
    ctx.fill();
    for (const [mx, my, mr] of [[x + sw * 0.9, base - sh * 0.45, 4], [x + sw * 1.1, base - sh * 0.25, 3]]) {
      ctx.beginPath();
      ctx.ellipse(mx, my, mr * s, mr * 0.55 * s, 0.2, Math.PI, TAU);
      ctx.fillStyle = mix(C.accent, CREAM, 0.35);
      ctx.fill();
      line(mx - mr * 0.5 * s, my - 0.6, mx + mr * 0.2 * s, my - mr * 0.4 * s, rgba(CREAM, 0.6), 0.8);
    }
  } else if (v < 0.93) {
    prop('fern', x, base, s * 0.9, r, 0.3, C, col);
  } else {
    // Irrlicht-Pilze: kleine Gruppe mit schwachem Schein
    ctx.fillStyle = rgrad(x, base - 8, 0, 22, [[0, rgba(C.accent, 0.3)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - 22, base - 30, 44, 34);
    for (const [dx, hh, rr] of [[-5, 9, 3.2], [1, 13, 4.2], [7, 7, 2.6]]) {
      line(x + dx * s, base, x + dx * s, base - hh * s, mix(CREAM, col, 0.3), 1.4);
      ctx.beginPath();
      ctx.ellipse(x + dx * s, base - hh * s, rr * s, rr * 0.7 * s, 0, Math.PI, TAU);
      ctx.fillStyle = mix(C.accent, CREAM, 0.45);
      ctx.fill();
    }
  }
}

// Boden: Moorschlamm mit Pfützen, Wurzeln, Moos- und Schilfrand
function a2Puddle(x, y, rx, ry, C, r) {
  const wet = mix(C.skyBottom, C.near, 0.55);
  ellipse(x + 0.8, y + 1, rx + 2.5, ry + 1.5, 0, rgba(INK, 0.3));
  ellipse(x, y, rx, ry, 0, hgrad(x - rx, x + rx, [[0, shade(wet, -0.1)], [0.4, mix(wet, C.skyBottom, 0.35)], [1, shade(wet, -0.2)]]));
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.clip();
  ellipse(x - rx * 0.1, y - ry * 0.95, rx * 0.95, ry * 0.6, 0, rgba(INK, 0.25));
  line(x - rx * 0.55, y + ry * 0.1, x + rx * 0.05, y + ry * 0.1, rgba(CREAM, 0.3), 0.9);
  ctx.restore();
  ctx.strokeStyle = rgba(CREAM, 0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    if (r() < 0.4) continue;
    const bx = x + (r() - 0.5) * rx * 1.2, by = y + (r() - 0.3) * ry * 0.6, br = 0.8 + r() * 1.3;
    ctx.moveTo(bx + br, by);
    ctx.arc(bx, by, br, 0, TAU);
  }
  ctx.stroke();
}

ART2.ground.bog = (P, y, C, rng, band) => {
  const mud = mix(mix(C.pipe, C.near, 0.55), INK, 0.18);
  band(vgrad(y, H, [[0, shade(mud, 0.1)], [1, shade(mud, -0.4)]]), y + 3, H - y + 4);
  for (let k = 0; k < 4; k++) {
    const yy = y + 17 + k * 10;
    ctx.beginPath();
    for (let x = -8; x <= P + 8; x += 12) {
      const w2 = yy + Math.sin(x * TAU / P * 9 + k * 2) * 2.2 + Math.sin(x * TAU / P * 23 + k) * 1.2;
      if (x === -8) ctx.moveTo(x, w2); else ctx.lineTo(x, w2);
    }
    ctx.strokeStyle = rgba(k % 2 ? shade(mud, -0.3) : shade(mud, 0.14), 0.4);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  const pb = [];
  for (let k = 0; k < P / 22; k++) pb.push([rng() * P, y + 14 + rng() * 40, 1.2 + rng() * 2.6, 1 + rng() * 1.6]);
  pebbles(pb, mix(mud, C.far, 0.45));
  for (let k = 0; k < P / 120; k++) {
    const x = (k + 0.15 + rng() * 0.7) * 120, yy = y + 18 + rng() * 24, rx = 14 + rng() * 22, ry = 3.2 + rng() * 2.2, seed = (rng() * 1e6) | 0;
    wrapEach(x, P, rx + 4, xx => a2Puddle(xx, yy, rx, ry, C, mulberry32(seed)));
  }
  const roots = [];
  for (let k = 0; k < P / 26; k++) { const x = rng() * P, yy = y + 9 + rng() * 14; roots.push([x, yy, x + (rng() - 0.5) * 18, yy + 5 + rng() * 9]); }
  segs(roots, rgba(shade(mud, -0.45), 0.65), 1.1);
  // nasser Moosrand
  const moss = [];
  for (let x = -8; x < P + 8; x += 4 + rng() * 5) moss.push([x, y + 3.5 + rng() * 2, 3.5 + rng() * 4]);
  blobPath(moss.map(([a, b, c2]) => [a + 1, b + 2, c2]));
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.fill();
  blobPath(moss);
  ctx.fillStyle = vgrad(y - 5, y + 9, [[0, mix(C.near, C.accent, 0.42)], [0.6, mix(C.near, C.accent, 0.12)], [1, shade(C.near, -0.15)]]);
  ctx.fill();
  dots(moss.filter(() => rng() < 0.6).map(([a, b, c2]) => [a - c2 * 0.3, b - c2 * 0.45, c2 * 0.35]), rgba(C.accentLight, 0.3));
  // Halme und einzelne Rohrkolben ragen über die Kante (vor die Pfahlfüße)
  const tones = [shade(C.near, 0.25), mix(C.near, C.accent, 0.2), shade(C.near, -0.1)];
  for (let t = 0; t < 3; t++) {
    ctx.beginPath();
    for (let x = rng() * 8; x < P; x += 7 + rng() * 16) {
      const hgt = 5 + rng() * 11, lean = (rng() - 0.4) * 5;
      ctx.moveTo(x - 1.3, y + 3);
      ctx.quadraticCurveTo(x + lean * 0.3, y - hgt * 0.5, x + lean, y + 2 - hgt);
      ctx.lineTo(x + 1.3, y + 3);
    }
    ctx.fillStyle = tones[t];
    ctx.fill();
  }
  for (let k = 0; k < P / 150; k++) {
    const x = rng() * P, lean = (rng() - 0.5) * 3;
    line(x, y + 2, x + lean, y - 13, shade(C.near, 0.1), 1.1);
    roundRectPath(x + lean - 1.5, y - 15, 3, 7, 1.5);
    ctx.fillStyle = mix(C.pipe, INK, 0.3);
    ctx.fill();
  }
};

// Säule: alter, bemooster Moorpfahl mit Seilwicklungen
ART2.pipeBody.bogpost = (C, h, v, r) => {
  const wood = C.pipe, dark = C.pipeDark;
  columnBase(h, wood, C.pipeSide, mix(wood, C.pipeLight, 0.75));
  // Längsmaserung
  ctx.beginPath();
  for (let k = 0; k < 12; k++) {
    const gx = 2.5 + k * 4.9 + (r() - 0.5) * 2;
    ctx.moveTo(gx, 0);
    for (let y = 0; y <= h; y += 18) ctx.lineTo(gx + Math.sin(y * 0.023 + k * 1.9) * 1.5 + (r() - 0.5) * 0.7, y);
  }
  ctx.strokeStyle = rgba(dark, 0.32);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.translate(1.1, 0);
  ctx.strokeStyle = rgba(C.pipeLight, 0.14);
  ctx.stroke();
  ctx.translate(-1.1, 0);
  // morsche Stellen entlang der Fasern
  const rot = [];
  for (let k = 0; k < h / 70; k++) rot.push([10 + r() * 40, r() * h, 2.5 + r() * 5, 14 + r() * 30, 0]);
  ellipses(rot, rgba(mix(dark, INK, 0.3), 0.28));
  // tiefe Risse mit heller Kante links
  for (let k = 0; k < h / 85; k++) {
    let cx = 8 + r() * 44, cy = r() * h;
    const pts = [[cx, cy]];
    for (let j = 0; j < 5; j++) { cx += (r() - 0.5) * 2.5; cy += 9 + r() * 14; pts.push([cx, cy]); }
    a2Path(pts);
    ctx.strokeStyle = rgba(mix(dark, INK, 0.4), 0.75);
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.translate(-1.2, 0);
    ctx.strokeStyle = rgba(C.pipeLight, 0.25);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.translate(1.2, 0);
  }
  // Astlöcher
  for (let k = 0; k < h / 190; k++) {
    const kx = 16 + r() * 26, ky = 30 + r() * (h - 60);
    ellipse(kx + 1, ky + 1.5, 5, 7.5, 0, rgba(INK, 0.3));
    ellipse(kx, ky, 5, 7.5, 0, mix(dark, wood, 0.25));
    ellipse(kx - 0.6, ky + 0.8, 2.6, 4.6, 0, mix(dark, INK, 0.45));
    ctx.strokeStyle = rgba(C.pipeLight, 0.3);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(kx, ky, 7.5, 10.5, 0, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
  }
  // Seilwicklungen in festen Abständen
  for (let y0 = 46 + v * 70; y0 < h - 10; y0 += 150) a2RopeWrap(y0, C);
  // Moospolster auf der Lichtseite und hängende Fäden
  const mossCol = mix(C.accent, C.near, 0.5);
  for (let k = 0; k < h / 34; k++) {
    const mx = 1 + Math.pow(r(), 1.7) * 30, my = r() * h, n = 14 + Math.floor(r() * 10), bl = [], sz = 0.7 + r() * 0.6;
    for (let j = 0; j < n; j++) {
      const a = r() * TAU, d = Math.sqrt(r());
      bl.push([mx + Math.cos(a) * d * 9 * sz, my + Math.sin(a) * d * 7 * sz, (1 + r() * 1.8) * (1.2 - d * 0.4)]);
    }
    blobPath(bl.map(([a, b, c2]) => [a + 0.7, b + 1.2, c2]));
    ctx.fillStyle = rgba(INK, 0.25);
    ctx.fill();
    blobPath(bl);
    ctx.fillStyle = mossCol;
    ctx.fill();
    dots(bl.filter((_, j) => j % 3 === 0).map(([a, b, c2]) => [a - c2 * 0.3, b - c2 * 0.35, c2 * 0.5]), rgba(C.accent, 0.6));
    dots(bl.filter((_, j) => j % 3 === 1).map(([a, b, c2]) => [a + c2 * 0.2, b + c2 * 0.3, c2 * 0.45]), rgba(shade(mossCol, -0.3), 0.5));
    if (r() < 0.55) {
      const beards = [];
      for (let j = 0; j < 3; j++) beards.push([mx + (r() - 0.5) * 8, my + 3, 6 + r() * 14, 1 + r() * 0.8, (r() - 0.5) * 2]);
      a2MossBeards(beards, rgba(mix(mossCol, CREAM, 0.15), 0.75));
    }
  }
  // Flechten
  const li = [];
  for (let k = 0; k < h / 40; k++) { const lx = 6 + r() * 44, ly = r() * h; for (let j = 0; j < 4; j++) li.push([lx + (r() - 0.5) * 5, ly + (r() - 0.5) * 5, 0.6 + r() * 0.9]); }
  dots(li, rgba(C.accentLight, 0.5));
};

function a2RopeWrap(y0, C) {
  const rope = mix(C.pipeLight, C.accent, 0.12), dk = shade(rope, -0.35);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fillRect(0, y0 + 14, PW, 4);
  for (let k = 0; k < 3; k++) {
    const yy = y0 + k * 5;
    ctx.beginPath();
    ctx.moveTo(-1.5, yy);
    ctx.quadraticCurveTo(PW / 2, yy + 4.5, PW + 1.5, yy + 2);
    ctx.lineTo(PW + 1.5, yy + 6.5);
    ctx.quadraticCurveTo(PW / 2, yy + 9, -1.5, yy + 4.5);
    ctx.closePath();
    ctx.fillStyle = hgrad(-1.5, PW + 1.5, [[0, mix(rope, CREAM, 0.3)], [0.18, rope], [0.62, shade(rope, -0.08)], [0.8, shade(rope, -0.25)], [1, dk]]);
    ctx.fill();
    const tw = [];
    for (let x = 1; x < PW; x += 4) { const t = x / PW, yc = yy + 2.2 + 4.5 * 2 * t * (1 - t) * 0.9 + t * 1.5; tw.push([x, yc - 1.6, x + 2.4, yc + 2]); }
    segs(tw, rgba(dk, 0.55), 0.8);
  }
}

ART2.pipeCap.bogpost = (C, up) => {
  const r = mulberry32(up ? 811 : 812), bark = shade(C.pipe, -0.1);
  capBase(bark, shade(bark, -CONFIG.SIDE_DARKEN), mix(bark, C.pipeLight, 0.6), 5);
  // Rindenfurchen
  const fur = [];
  for (let x = -PCO + 3; x < PW + PCO - 2; x += 3.5 + r() * 3.5) fur.push([x, up ? 9 : 3, x + (r() - 0.5) * 1.5, up ? PCH - 3 : PCH - 9]);
  segs(fur, rgba(C.pipeDark, 0.5), 1);
  segs(fur.map(([a, b, c2, d]) => [a + 1, b, c2 + 1, d]), rgba(C.pipeLight, 0.16), 0.7);
  const mossCol = mix(C.accent, C.near, 0.5);
  if (up) {
    // Schnittfläche mit Jahresringen und morscher Mitte
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(PW / 2, 5.5, PW / 2 + PCO - 1, 5.5, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = hgrad(-PCO, PW + PCO, [[0, mix(C.pipe, CREAM, 0.42)], [0.7, mix(C.pipe, CREAM, 0.25)], [1, C.pipe]]);
    ctx.fillRect(-PCO, -1, PW + PCO * 2, 13);
    ctx.strokeStyle = rgba(C.pipeDark, 0.45);
    ctx.lineWidth = 0.8;
    for (let k = 1; k <= 5; k++) { ctx.beginPath(); ctx.ellipse(PW / 2 + 2, 6, k * 5.6, k * 0.95, 0, 0, TAU); ctx.stroke(); }
    ellipse(PW / 2 + 3, 6.2, 9, 2.2, 0, rgba(C.pipeDark, 0.55));
    segs([[PW / 2 + 3, 6, PW / 2 - 9, 4.2], [PW / 2 + 3, 6, PW / 2 + 16, 8.5], [PW / 2 + 3, 6, PW / 2 + 8, 2.4]], rgba(mix(C.pipeDark, INK, 0.3), 0.6), 0.8);
    ctx.restore();
    // Mooskissen auf dem Rand links, zwei kleine Pilze rechts
    const bl = [[-PCO + 4, 4, 4], [3, 2.5, 4.5], [10, 3.5, 3.5], [-PCO + 2, 9, 3.2], [16, 4.5, 2.6]];
    blobPath(bl.map(([a, b, c2]) => [a + 1, b + 1.5, c2]));
    ctx.fillStyle = rgba(INK, 0.25);
    ctx.fill();
    blobPath(bl);
    ctx.fillStyle = vgrad(-2, 10, [[0, mix(C.accent, C.near, 0.25)], [1, mossCol]]);
    ctx.fill();
    dots(bl.map(([a, b, c2]) => [a - c2 * 0.3, b - c2 * 0.4, c2 * 0.4]), rgba(C.accentLight, 0.45));
    for (const [mx, mr] of [[PW - 6, 3.4], [PW - 1, 2.4]]) {
      line(mx, 4, mx, 1 - mr * 0.3, mix(CREAM, C.pipe, 0.3), 1.2);
      ctx.beginPath();
      ctx.ellipse(mx, 1 - mr * 0.3, mr, mr * 0.62, 0, Math.PI, TAU);
      ctx.fillStyle = mix(C.accent, CREAM, 0.35);
      ctx.fill();
    }
  } else {
    // Moospolster an der Unterkante, wenige weiche Fäden darunter
    const bl = [];
    for (let k = 0; k < 6; k++) bl.push([-PCO + 4 + k * 12 + (r() - 0.5) * 4, PCH - 3 - r() * 2, 2.6 + r() * 2.2]);
    const beards = bl.filter((_, k) => k % 2 === 0).map(([a, b, c2]) => [a + 1, b + c2 * 0.4, 3 + r() * 3, c2 * 0.55, (r() - 0.5) * 1.2]);
    a2MossBeards(beards, rgba(mix(mossCol, CREAM, 0.12), 0.7));
    blobPath(bl.map(([a, b, c2]) => [a + 0.8, b + 1.2, c2]));
    ctx.fillStyle = rgba(INK, 0.25);
    ctx.fill();
    blobPath(bl);
    ctx.fillStyle = mossCol;
    ctx.fill();
    dots(bl.map(([a, b, c2]) => [a - c2 * 0.3, b - c2 * 0.4, c2 * 0.4]), rgba(C.accentLight, 0.4));
  }
  // Übergang zum Pfahl im Schatten
  ctx.fillStyle = rgba(C.pipeDark, 0.35);
  ctx.fillRect(-PCO, up ? PCH - 4 : 0, PW + PCO * 2, 4);
};

// ============================================================
// KRISTALL (10): tiefes Indigo und Lavendel, Cyan-Kristalle, rosa Akzente,
// prismatische Reflexe
// ============================================================
// Gedämpftes Spektrum für Lichtbrechung, nie reine Sättigung
const a2Spectrum = C => [mix(C.accent, CREAM, 0.15), mix('#f2b27a', CREAM, 0.3), mix('#e6df8c', CREAM, 0.38), mix('#93e0bf', CREAM, 0.28), mix(C.pipe, CREAM, 0.12), mix('#a99cf0', CREAM, 0.18)];

// Vierstrahliger Glanzpunkt
function a2Glint(x, y, s, col, a) {
  ctx.fillStyle = rgrad(x, y, 0, s * 3, [[0, rgba(col, a * 0.5)], [1, rgba(col, 0)]]);
  ctx.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  ctx.beginPath();
  ctx.moveTo(x - s * 2.6, y); ctx.quadraticCurveTo(x, y, x, y - s * 2.6); ctx.quadraticCurveTo(x, y, x + s * 2.6, y);
  ctx.quadraticCurveTo(x, y, x, y + s * 2.6); ctx.quadraticCurveTo(x, y, x - s * 2.6, y);
  ctx.fillStyle = rgba(col, a);
  ctx.fill();
}

// Kristallprisma mit Spitze: linke Fläche im Licht, Front, rechte Fläche im Schatten
function a2Crystal(x, base, h, w, tilt, lit, mid, dark, edgeA) {
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(tilt);
  const sh = Math.min(h * 0.45, w * 1.25), ys = -h + sh, tx = w * 0.06;
  const xl = -w, x1 = -w * 0.32, x2 = w * 0.42, xr = w;
  const yl = ys + w * 0.16, y2 = ys + w * 0.06, yr = ys + w * 0.26;
  poly([[xl, 3], [xl, yl], [x1, ys], [x1, 3]], vgrad(-h, 0, [[0, mix(lit, CREAM, 0.25)], [1, lit]]));
  poly([[x1, 3], [x1, ys], [x2, y2], [x2, 3]], vgrad(-h, 0, [[0, mix(mid, CREAM, 0.12)], [1, mid]]));
  poly([[x2, 3], [x2, y2], [xr, yr], [xr, 3]], dark);
  poly([[xl, yl], [tx, -h], [x1, ys]], mix(lit, CREAM, 0.35));
  poly([[x1, ys], [tx, -h], [x2, y2]], mix(mid, CREAM, 0.2));
  poly([[x2, y2], [tx, -h], [xr, yr]], shade(dark, 0.06));
  if (edgeA) {
    // durchscheinendes Inneres: Lichtbahn in der Front, feiner innerer Riss, heller Fuß
    const fw = x2 - x1, sx = x1 + fw * 0.28;
    ctx.fillStyle = hgrad(sx - fw * 0.12, sx + fw * 0.12, [[0, rgba(CREAM, 0)], [0.5, rgba(CREAM, edgeA * 0.45)], [1, rgba(CREAM, 0)]]);
    ctx.fillRect(sx - fw * 0.12, ys + 2, fw * 0.24, -ys);
    if (h > 30) line(x1 + fw * 0.6, -h * 0.25, x1 + fw * 0.2, -h * 0.55, rgba(CREAM, edgeA * 0.5), 0.8);
    ctx.fillStyle = vgrad(-h * 0.3, 2, [[0, rgba(mid, 0)], [1, rgba(mix(mid, CREAM, 0.5), edgeA * 0.6)]]);
    ctx.fillRect(x1, -h * 0.3, fw, h * 0.3 + 2);
    segs([[x1, 2, x1, ys], [x1, ys, tx, -h]], rgba(CREAM, edgeA), 1);
    segs([[x2, 2, x2, y2]], rgba(CREAM, edgeA * 0.35), 0.8);
  }
  ctx.restore();
}

ART2.sky.crystal = (C, S, rng) => {
  // Sterne, nach unten ausblendend
  const st = [[], [], []];
  for (let i = 0, n = Math.round(W * 0.42); i < n; i++) {
    const y = Math.pow(rng(), 1.5) * 360, a = 1 - y / 380;
    st[Math.min(2, Math.floor(a * 3))].push([rng() * W, y, 0.4 + rng() * 0.7]);
  }
  st.forEach((L, j) => dots(L, rgba(mix(CREAM, C.pipe, 0.25), 0.18 + j * 0.2)));
  for (let i = 0, n = Math.round(W / 110); i < n; i++) a2Glint(rng() * W, 20 + rng() * 220, 1 + rng() * 0.8, mix(CREAM, C.pipe, 0.2), 0.55);
  // Lichtfächer: ein Strahl von links oben fächert sich in ein blasses Spektrum auf
  const sp = a2Spectrum(C), fx = -0.05 * W, fy = -30;
  for (let j = 0; j < sp.length; j++) {
    const a = 0.62 + j * 0.034, len = Math.max(W, 700) * 1.25;
    a2Rays(fx, fy, 1, a, a, len, 60, sp[j], 0.075, () => 0.5);
  }
  // Mond mit Lichthof (22-Grad-Halo, innen rötlich, außen bläulich)
  const mx = S.sunX * W, my = S.sunY, mc = mix(CREAM, C.skyBottom, 0.22);
  ctx.fillStyle = rgrad(mx, my, 0, 150, [[0, rgba(mc, 0.24)], [1, rgba(mc, 0)]]);
  ctx.fillRect(mx - 150, my - 150, 300, 300);
  for (let j = 0; j < sp.length; j++) {
    ctx.strokeStyle = rgba(sp[j], 0.1);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, my, 70 + j * 2.6, 0, TAU);
    ctx.stroke();
  }
  circle(mx, my, 19, rgrad(mx, my, 0, 19, [[0, mix(mc, '#ffffff', 0.5)], [1, mc]], mx - 6, my - 6));
  dots([[mx - 5, my + 4, 3.4], [mx + 6, my - 5, 2.4], [mx + 3, my + 8, 1.8]], rgba(C.far, 0.18));
  // Leuchten am Horizont aus der Kristallebene
  ctx.fillStyle = vgrad(300, GROUND_Y, [[0, rgba(mix(C.skyBottom, C.accent, 0.2), 0)], [1, rgba(mix(C.skyBottom, C.accent, 0.2), 0.35)]]);
  ctx.fillRect(0, 300, W, GROUND_Y - 300);
};

// Ferne Kristallberge: Gruppen riesiger Prismen auf einem Felssockel, im Dunst
ART2.layerExtent.crystalPeaks = () => [160, GROUND_Y + 14];
ART2.layerTex.crystalPeaks = () => ({ grain: 0.04, mottle: 0.1, contrast: 1.1 });
ART2.layer.crystalPeaks = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, base = 500;
  const f = ridgeFn(P, base, 46, 0.004, l.seed);
  ridgePath(f, -8, P + 8, 6, yb);
  ctx.fillStyle = vgrad(base - 46, yb, [[0, shade(col, -0.05)], [1, shade(col, -0.2)]]);
  ctx.fill();
  const groups = [];
  for (let k = 0, n = 5; k < n; k++) groups.push({ x: (k + 0.5) * P / n + (rng() - 0.5) * 90, h: 150 + rng() * 150, s: (rng() * 1e6) | 0 });
  groups.sort((a, b) => b.h - a.h);
  for (const g of groups) {
    wrapEach(g.x, P, g.h * 0.7, x => {
      const r = mulberry32(g.s), gy = f(x) + 16, list = [];
      for (let j = 0; j < 6; j++) {
        const dx = (r() - 0.5) * g.h * 0.75, hh = g.h * (0.35 + r() * 0.6) * (1 - Math.abs(dx) / (g.h * 0.75) * 0.5);
        list.push([x + dx, hh, 10 + hh * 0.11, dx / g.h * 0.9 + (r() - 0.5) * 0.15]);
      }
      list.push([x, g.h, 14 + g.h * 0.1, (r() - 0.5) * 0.12]);
      list.sort((a, b) => a[1] - b[1]);
      for (const [cx, hh, w, tilt] of list) {
        const tint = r() < 0.3 ? mix(col, C.accent, 0.12) : r() < 0.5 ? mix(col, C.pipe, 0.1) : col;
        a2Crystal(cx, gy, hh, w, tilt, mix(tint, C.skyBottom, 0.32), tint, shade(tint, -0.2), 0.14);
      }
    });
  }
  // Dunst nach unten
  ctx.fillStyle = vgrad(260, yb, [[0, rgba(C.haze, 0)], [0.6, rgba(C.haze, 0.3)], [1, rgba(C.haze, 0.55)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 190, P + 16, yb - 190);
  ctx.globalCompositeOperation = 'source-over';
};

// Mittlere Ebene: Kristalldome aus Cyan und Rosa auf dunklem Felskamm
ART2.layerExtent.crystalSpires = () => [270, GROUND_Y + 14];
ART2.layerTex.crystalSpires = () => ({ grain: 0.05, mottle: 0.12, contrast: 1.1 });
ART2.layer.crystalSpires = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, f = ridgeFn(P, 512, 34, 0.007, l.seed), sp = a2Spectrum(C);
  const clusters = [];
  for (let k = 0, n = 9; k < n; k++) clusters.push({ x: (k + 0.5) * P / n + (rng() - 0.5) * 70, h: 60 + rng() * 130, s: (rng() * 1e6) | 0, pink: rng() < 0.3 });
  clusters.sort((a, b) => b.h - a.h);
  for (const c of clusters) {
    wrapEach(c.x, P, c.h * 0.6, x => {
      const r = mulberry32(c.s), gy = f(x) + 10, tone = c.pink ? mix(col, C.accent, 0.3) : mix(col, C.pipe, 0.28);
      const lit = mix(tone, CREAM, 0.22), dark = shade(mix(col, tone, 0.4), -0.22);
      ctx.fillStyle = rgrad(x, gy - c.h * 0.4, 0, c.h * 0.8, [[0, rgba(c.pink ? C.accent : C.pipe, 0.14)], [1, rgba(C.pipe, 0)]]);
      ctx.fillRect(x - c.h * 0.8, gy - c.h * 1.2, c.h * 1.6, c.h * 1.2);
      const list = [];
      for (let j = 0; j < 5; j++) {
        const dx = (r() - 0.5) * c.h * 0.6, hh = c.h * (0.3 + r() * 0.55);
        list.push([x + dx, hh, 5 + hh * 0.1, dx / c.h * 1.1 + (r() - 0.5) * 0.2]);
      }
      list.push([x, c.h, 8 + c.h * 0.09, (r() - 0.5) * 0.1]);
      list.sort((a, b) => a[1] - b[1]);
      for (const [cx, hh, w, tilt] of list) a2Crystal(cx, gy, hh, w, tilt, lit, tone, dark, 0.3);
      // Spektralstreifen an der Lichtkante des höchsten Prismas
      const t = list[list.length - 1];
      ctx.save();
      ctx.translate(t[0], gy);
      ctx.rotate(t[3]);
      for (let j = 0; j < 3; j++) line(-t[2] * 0.32 + 1.2 + j * 1.1, -t[1] * 0.25, -t[2] * 0.32 + 1.2 + j * 1.1, -t[1] * 0.6, rgba(sp[(j * 2 + (c.s % 2)) % sp.length], 0.4), 1);
      ctx.restore();
      if (r() < 0.6) a2Glint(t[0] + Math.sin(t[3]) * t[1] * 0.9, gy - t[1] * 0.92, 1.4, CREAM, 0.7);
    });
  }
  // dunkler Felskamm davor
  ridgePath(f, -8, P + 8, 4, yb);
  ctx.fillStyle = vgrad(512 - 34, yb, [[0, shade(col, -0.12)], [1, shade(col, -0.35)]]);
  ctx.fill();
  ridgeLine(f, -8, P + 8, 4, 1, rgba(mix(C.pipe, CREAM, 0.3), 0.18), 1.5);
  const pb = [];
  for (let k = 0; k < P / 14; k++) { const x = rng() * P; pb.push([x, f(x) + 6 + rng() * 30, 1 + rng() * 2.4]); }
  dots(pb, rgba(shade(col, -0.4), 0.5));
};

// Vordergrund: kleine Drusen und Kristallgruppen
ART2.prop.geode = { h: 84, paint: (x, base, s, r, v, C, col) => a2GeodeProp(x, base, s, r, v, C, col) };
function a2GeodeProp(x, base, s, r, v, C, col) {
  const rock = mix(col, C.far, 0.3);
  if (v < 0.55) {
    const pink = v < 0.18, tone = pink ? mix(C.accent, col, 0.25) : mix(C.pipe, col, 0.25);
    const lit = mix(tone, CREAM, 0.35), dark = mix(tone, col, 0.55);
    ctx.fillStyle = rgrad(x, base - 20 * s, 0, 40 * s, [[0, rgba(pink ? C.accent : C.pipe, 0.2)], [1, rgba(C.pipe, 0)]]);
    ctx.fillRect(x - 40 * s, base - 60 * s, 80 * s, 64 * s);
    ellipse(x + 8, base - 1, 20 * s, 4 * s, 0, rgba(INK, 0.25));
    const list = [];
    for (let k = 0; k < 4; k++) list.push([x + (k - 1.5) * 7 * s + (r() - 0.5) * 4, (18 + r() * 44) * s, (3.5 + r() * 2.5) * s, (k - 1.5) * 0.22 + (r() - 0.5) * 0.2]);
    list.sort((a, b) => a[1] - b[1]);
    for (const [cx, hh, w, tilt] of list) a2Crystal(cx, base + 2, hh, w, tilt, lit, tone, dark, 0.5);
    const t = list[list.length - 1];
    a2Glint(t[0] + Math.sin(t[3]) * t[1], base - t[1] * 0.95, 1.5, CREAM, 0.85);
  } else if (v < 0.8) {
    // Felsbrocken mit eingewachsenen Spitzen
    const rr = (10 + r() * 8) * s;
    ellipse(x + 6, base - 1, rr * 1.7, 4 * s, 0, rgba(INK, 0.25));
    const pts = [[x - rr * 1.5, base + 2], [x - rr * 1.1, base - rr * 0.8], [x - rr * 0.2, base - rr * 1.15], [x + rr * 0.9, base - rr * 0.75], [x + rr * 1.5, base + 2]];
    poly(pts, hgrad(x - rr * 1.5, x + rr * 1.5, [[0, shade(rock, 0.18)], [0.5, rock], [1, shade(rock, -0.3)]]));
    line(x - rr * 1.1, base - rr * 0.8, x - rr * 0.2, base - rr * 1.15, rgba(CREAM, 0.2), 1);
    const tone = r() < 0.5 ? C.pipe : C.accent;
    for (const [dx, hh, tl] of [[-0.3, 1.3, -0.4], [0.2, 0.9, 0.3]]) a2Crystal(x + dx * rr, base - rr * 0.7, hh * rr * 0.8, rr * 0.18, tl, mix(tone, CREAM, 0.35), tone, mix(tone, col, 0.5), 0.4);
  } else {
    // flacher Kiesel mit Glanz
    const pts = [];
    for (let k = 0; k < 5; k++) pts.push([x + (k - 2) * 5 * s + (r() - 0.5) * 3, base - 1 - r() * 3, (1.5 + r() * 2.2) * s, (1 + r() * 1.3) * s]);
    pebbles(pts, mix(rock, C.pipe, 0.2));
    if (r() < 0.6) a2Glint(x + (r() - 0.5) * 10, base - 4, 1, mix(CREAM, C.pipe, 0.3), 0.7);
  }
}

// Boden: Fels mit eingewachsenen Kristallen, Spitzen ragen über die Kante
ART2.ground.crystalrock = (P, y, C, rng, band) => {
  const rock = mix(C.near, INK, 0.12);
  band(vgrad(y, H, [[0, shade(rock, 0.12)], [1, shade(rock, -0.4)]]), y, H - y + 4);
  // Gesteinsplatten mit Lichtkante
  const rows = [y + 4, y + 22, y + 40, H + 4];
  for (let ri = 0; ri < rows.length - 1; ri++) {
    let x = rng() * 30;
    while (x < P) {
      const w2 = 40 + rng() * 60, x0 = x, x1 = x + w2, y0 = rows[ri], y1 = rows[ri + 1], j = () => (rng() - 0.5) * 5;
      const pl = [[x0 + 2 + j(), y0 + 1.5], [x1 - 2 + j(), y0 + 1.5 + j() * 0.3], [x1 - 1 + j(), y1 - 1.5], [x0 + 1 + j(), y1 - 1.5]];
      for (const shift of [0, -P]) {
        const q = pl.map(([a, b]) => [a + shift, b]);
        poly(q, vgrad(y0, y1, [[0, shade(rock, 0.1 - ri * 0.05)], [1, shade(rock, -0.08 - ri * 0.06)]]));
        line(q[0][0], q[0][1] + 0.5, q[1][0], q[1][1] + 0.5, rgba(mix(C.pipe, CREAM, 0.4), 0.14), 1);
      }
      x = x1;
    }
  }
  // eingewachsene Kristalle in der Wand
  for (let k = 0; k < P / 70; k++) {
    const x = rng() * P, yy = y + 16 + rng() * 34, pink = rng() < 0.3, tone = pink ? C.accent : C.pipe, s2 = 3 + rng() * 4, a = (rng() - 0.5) * 1.2;
    wrapEach(x, P, 12, xx => {
      ctx.fillStyle = rgrad(xx, yy, 0, s2 * 3, [[0, rgba(tone, 0.22)], [1, rgba(tone, 0)]]);
      ctx.fillRect(xx - s2 * 3, yy - s2 * 3, s2 * 6, s2 * 6);
      ctx.save();
      ctx.translate(xx, yy);
      ctx.rotate(a);
      poly([[-s2, 0], [-s2 * 0.4, -s2 * 0.9], [s2 * 0.6, -s2 * 0.7], [s2, 0], [s2 * 0.4, s2 * 0.8], [-s2 * 0.5, s2 * 0.7]], mix(tone, rock, 0.35));
      poly([[-s2, 0], [-s2 * 0.4, -s2 * 0.9], [s2 * 0.6, -s2 * 0.7], [0, 0]], mix(tone, CREAM, 0.3));
      poly([[0, 0], [s2 * 0.6, -s2 * 0.7], [s2, 0]], tone);
      ctx.restore();
    });
  }
  const sp = [];
  for (let k = 0; k < P / 5; k++) sp.push([rng() * P, y + 6 + rng() * 50, 0.4 + rng() * 0.6]);
  dots(sp, rgba(mix(C.pipe, CREAM, 0.3), 0.3));
  // Kante mit Licht
  band(rgba(mix(C.pipe, CREAM, 0.3), 0.18), y, 1.5);
  // Kristallspitzen über der Kante
  for (let k = 0; k < P / 64; k++) {
    const x = (k + 0.2 + rng() * 0.6) * 64, pink = rng() < 0.28, tone = pink ? mix(C.accent, CREAM, 0.1) : mix(C.pipe, CREAM, 0.05), seed = (rng() * 1e6) | 0;
    wrapEach(x, P, 16, xx => {
      const r = mulberry32(seed);
      ctx.fillStyle = rgrad(xx, y, 0, 18, [[0, rgba(tone, 0.25)], [1, rgba(tone, 0)]]);
      ctx.fillRect(xx - 18, y - 18, 36, 26);
      for (let j = 0, n = 2 + Math.floor(r() * 3); j < n; j++) {
        const hh = 5 + r() * 11, w = 1.6 + r() * 1.6;
        a2Crystal(xx + (j - n / 2) * 4 + r() * 2, y + 3, hh, w, (j - n / 2) * 0.3 + (r() - 0.5) * 0.3, mix(tone, CREAM, 0.4), tone, mix(tone, C.near, 0.5), 0.4);
      }
    });
  }
};

// Säule: sechseckiges Kristallprisma mit Facetten, Querstreifung, Bruchflächen und Spektralkanten
ART2.pipeBody.prism = (C, h, v, r) => {
  const c = C.pipe, L = 13, R = 45, sp = a2Spectrum(C);
  ctx.fillStyle = hgrad(0, L, [[0, mix(c, '#ffffff', 0.55)], [1, mix(c, '#ffffff', 0.3)]]);
  ctx.fillRect(0, 0, L, h);
  ctx.fillStyle = hgrad(L, R, [[0, mix(c, CREAM, 0.14)], [0.55, c], [1, shade(c, -0.08)]]);
  ctx.fillRect(L, 0, R - L, h);
  ctx.fillStyle = hgrad(R, PW, [[0, shade(c, -CONFIG.SIDE_DARKEN - 0.06)], [1, mix(shade(c, -0.3), C.far, 0.35)]]);
  ctx.fillRect(R, 0, PW - R, h);
  // durchscheinender Kern
  ctx.fillStyle = hgrad(L + 6, R - 2, [[0, rgba(C.far, 0)], [0.5, rgba(C.far, 0.2)], [1, rgba(C.far, 0)]]);
  ctx.fillRect(L + 6, 0, R - L - 8, h);
  // innere Lichtbahnen
  for (let k = 0; k < 4; k++) {
    const x = L + 4 + r() * (R - L - 8), w2 = 1.5 + r() * 3;
    ctx.fillStyle = hgrad(x - w2, x + w2, [[0, rgba('#ffffff', 0)], [0.5, rgba('#ffffff', 0.14 + r() * 0.1)], [1, rgba('#ffffff', 0)]]);
    ctx.fillRect(x - w2, 0, w2 * 2, h);
  }
  // Querstreifung (typisch für Quarz)
  const stri = [];
  for (let y = r() * 4; y < h; y += 2.5 + r() * 4.5) stri.push([0, y, PW, y]);
  segs(stri.filter((_, k) => k % 2), rgba('#ffffff', 0.07), 0.7);
  segs(stri.filter((_, k) => !(k % 2)), rgba(C.far, 0.08), 0.7);
  // polierte Spiegelungen: schräge helle Bänder auf der Front
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, 0, R - L, h);
  ctx.clip();
  for (let y0 = r() * 50; y0 < h + 40; y0 += 60 + r() * 50) {
    const bw = 5 + r() * 12;
    ctx.beginPath();
    ctx.moveTo(L, y0); ctx.lineTo(R, y0 - 22); ctx.lineTo(R, y0 - 22 + bw); ctx.lineTo(L, y0 + bw); ctx.closePath();
    ctx.fillStyle = rgba('#ffffff', 0.06 + r() * 0.07);
    ctx.fill();
  }
  // Phantome: eingeschlossene Wachstumsspitzen als feine Winkel
  for (let y0 = 50 + v * 40 + r() * 30; y0 < h; y0 += 110 + r() * 50) {
    const mxp = L + (R - L) * (0.45 + r() * 0.15), dy = 9 + r() * 5;
    for (let j = 0; j < 2; j++) {
      const o = j * 6;
      a2Path([[L + 2, y0 + dy + o], [mxp, y0 + o], [R - 2, y0 + dy * 0.9 + o]]);
      ctx.strokeStyle = rgba(j ? C.accent : '#ffffff', j ? 0.2 : 0.32);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }
  ctx.restore();
  // schräge Bruchflächen mit Farbschimmer
  for (let y0 = 30 + v * 50 + r() * 20; y0 < h; y0 += 95 + r() * 60) {
    const d = 8 + r() * 10;
    for (let j = 0; j < 3; j++) {
      const col = sp[(Math.floor(y0) + j * 2) % sp.length], o = 2 + j * 4;
      ctx.fillStyle = vgrad(y0 + o, y0 + d + o + 6, [[0, rgba(col, 0.2)], [1, rgba(col, 0)]]);
      ctx.beginPath();
      ctx.moveTo(L, y0 + o); ctx.lineTo(R, y0 + d + o); ctx.lineTo(R, y0 + d + o + 6); ctx.lineTo(L, y0 + o + 6); ctx.closePath();
      ctx.fill();
    }
    line(L, y0, R, y0 + d, rgba('#ffffff', 0.6), 1);
    line(L, y0 + 1.2, R, y0 + d + 1.2, rgba(C.far, 0.3), 0.8);
    line(0, y0 - 3, L, y0, rgba('#ffffff', 0.4), 0.9);
    line(R, y0 + d, PW, y0 + d + 2, rgba('#ffffff', 0.2), 0.8);
  }
  // Einschlüsse
  const inc = [];
  for (let k = 0; k < h / 10; k++) inc.push([L + 3 + r() * (R - L - 6), r() * h, 0.5 + r() * 0.9]);
  dots(inc, rgba('#ffffff', 0.35));
  // Spektralkanten an den Facettenkanten, abschnittsweise
  for (let y = r() * 40; y < h; y += 60 + r() * 50) {
    const len = 30 + r() * 50;
    for (let j = 0; j < 3; j++) line(L + 1 + j * 1.2, y, L + 1 + j * 1.2, y + len, rgba(sp[(j + Math.floor(y)) % sp.length], 0.3), 1);
  }
  // Facettenkanten und Außenkanten
  segs([[L, 0, L, h]], rgba('#ffffff', 0.6), 1);
  segs([[R, 0, R, h]], rgba('#ffffff', 0.22), 1);
  ctx.fillStyle = rgba('#ffffff', 0.4);
  ctx.fillRect(0, 0, 1.2, h);
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.fillRect(PW - 1.2, 0, 1.2, h);
};

ART2.pipeCap.prism = (C, up) => {
  const c = mix(C.pipe, CREAM, 0.08), L = 9, R = 49, x0 = -PCO, x1 = PW + PCO, sp = a2Spectrum(C);
  const by0 = up ? 0 : PCH - 8, by1 = up ? 8 : PCH;   // Fase zur Lücke
  const b0 = up ? 8 : 0, b1 = up ? PCH : PCH - 8;     // senkrechter Teil
  // senkrechte Flächen, die Front als Rondiste mit Facettenzickzack
  poly([[x0, b0], [L, b0], [L, b1], [x0, b1]], mix(c, '#ffffff', 0.45));
  poly([[L, b0], [R, b0], [R, b1], [L, b1]], hgrad(L, R, [[0, mix(c, CREAM, 0.1)], [1, shade(c, -0.06)]]));
  poly([[R, b0], [x1, b0], [x1, b1], [R, b1]], shade(c, -0.25));
  const n = 5, fw = (R - L) / n;
  for (let k = 0; k < n; k++) {
    const xa = L + k * fw, xb = xa + fw, t = k / (n - 1);
    poly([[xa, b0], [xb, b0], [(xa + xb) / 2, b1]], rgba('#ffffff', 0.2 - t * 0.12));
    poly([[xa, b1], [(xa + xb) / 2, b1], [xa, b0]], rgba(C.far, 0.08 + t * 0.1));
  }
  // Fase: schräge Flächen, nach oben hell, nach unten mit Farbschimmer
  const inset = 4, ey = up ? by0 : by1, iy = up ? by1 : by0;
  if (up) {
    poly([[x0, iy], [x0 + inset, ey], [L + 1, ey], [L, iy]], mix(c, '#ffffff', 0.7));
    poly([[L, iy], [L + 1, ey], [R - 1, ey], [R, iy]], mix(c, '#ffffff', 0.55));
    poly([[R, iy], [R - 1, ey], [x1 - inset, ey], [x1, iy]], mix(c, C.far, 0.25));
  } else {
    poly([[x0, iy], [x0 + inset, ey], [L + 1, ey], [L, iy]], mix(c, C.accent, 0.35));
    poly([[L, iy], [L + 1, ey], [R - 1, ey], [R, iy]], hgrad(L, R, [[0, mix(c, C.accent, 0.3)], [0.5, mix(c, sp[3], 0.3)], [1, shade(mix(c, C.far, 0.3), -0.1)]]));
    poly([[R, iy], [R - 1, ey], [x1 - inset, ey], [x1, iy]], shade(mix(c, C.far, 0.4), -0.15));
  }
  // rosa Leuchtfuge zwischen Fase und Körper
  line(x0 + 1, iy, x1 - 1, iy, rgba(C.accent, 0.35), 3);
  line(x0 + 1, iy, x1 - 1, iy, mix(C.accent, CREAM, 0.45), 1);
  // Facettenkanten
  segs([[L, b0, L, b1], [R, b0, R, b1]], rgba('#ffffff', 0.45), 0.9);
  segs([[L, iy, L + 1, ey], [R, iy, R - 1, ey]], rgba('#ffffff', 0.35), 0.8);
  // kleiner Glanz auf der Lichtkante
  a2Glint(L + 2, up ? 3 : PCH - 3, 1.3, '#ffffff', 0.8);
  // Kontur
  ctx.strokeStyle = rgba(INK, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (up) { ctx.moveTo(x0, PCH); ctx.lineTo(x0, by1); ctx.lineTo(x0 + inset, 0); ctx.lineTo(x1 - inset, 0); ctx.lineTo(x1, by1); ctx.lineTo(x1, PCH); }
  else { ctx.moveTo(x0, 0); ctx.lineTo(x0, by0); ctx.lineTo(x0 + inset, PCH); ctx.lineTo(x1 - inset, PCH); ctx.lineTo(x1, by0); ctx.lineTo(x1, 0); }
  ctx.stroke();
  // Schatten am Übergang zum Körper
  ctx.fillStyle = rgba(INK, 0.2);
  ctx.fillRect(x0, up ? PCH - 3 : 0, x1 - x0, 3);
};

// ============================================================
// WOLKEN (11): Pastell, viele Tiefenstaffeln aus Wolkenbänken
// ============================================================
// Gebauschte Wolke: Umriss aus Ballen, Grundverlauf hell oben und kühl unten, dann je Ballen
// ein weicher Schatten unten rechts und ein Licht oben links. Von oben nach unten gemalt, damit
// sich tiefere Ballen hell vom Schatten der oberen abheben.
function a2Billow(puffs, top, bot, lit, mid, low, hiA, shA, shadow) {
  if (!puffs.length) return;
  if (shadow) {
    blobPath(puffs.map(([x, y, r]) => [x + SHADOW.x * 0.45, y + SHADOW.y * 0.45, r]));
    ctx.fillStyle = shadow;
    ctx.fill();
  }
  const sorted = puffs.slice().sort((a, b) => (a[1] - a[2]) - (b[1] - b[2]));
  const shadeAll = () => {
    const dk = a2BlobSprite(low), lt = a2BlobSprite(lit);
    for (const [x, y, r] of sorted) {
      ctx.globalAlpha = shA;
      ctx.drawImage(dk, x + r * 0.25 - r * 1.1, y + r * 0.8 - r * 1.1, r * 2.2, r * 2.2);
      ctx.globalAlpha = hiA;
      ctx.drawImage(lt, x - r * 0.28 - r * 0.8, y - r * 0.32 - r * 0.8, r * 1.6, r * 1.6);
    }
    ctx.globalAlpha = 1;
  };
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m || m.b || m.c) {
    // ohne Matrixabfrage: Schattierung per Clip direkt auf das Ziel
    blobPath(puffs);
    ctx.fillStyle = vgrad(top, bot, [[0, lit], [0.5, mid], [1, low]]);
    ctx.fill();
    ctx.save();
    blobPath(puffs);
    ctx.clip();
    shadeAll();
    ctx.restore();
    return;
  }
  // Umriss und Schattierung auf einer Zwischenfläche in Gerätepixeln, Schattierung per source-atop
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y, r] of puffs) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
  const tw = ctx.canvas.width, th = ctx.canvas.height;
  const dx0 = clamp(Math.floor(m.a * x0 + m.e) - 2, 0, tw), dx1 = clamp(Math.ceil(m.a * x1 + m.e) + 2, 0, tw);
  const dy0 = clamp(Math.floor(m.d * y0 + m.f) - 2, 0, th), dy1 = clamp(Math.ceil(m.d * y1 + m.f) + 2, 0, th);
  if (dx1 - dx0 < 1 || dy1 - dy0 < 1) return;
  const off = newCanvas(dx1 - dx0, dy1 - dy0), g = off.getContext('2d'), target = ctx;
  g.setTransform(m.a, 0, 0, m.d, m.e - dx0, m.f - dy0);
  setupG(g);
  withCtx(g, () => {
    blobPath(puffs);
    ctx.fillStyle = vgrad(top, bot, [[0, lit], [0.5, mid], [1, low]]);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    shadeAll();
    ctx.globalCompositeOperation = 'source-over';
  });
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(off, dx0, dy0);
  target.restore();
  freeCanvas(off);
}
// einfache Variante ohne Einzelschattierung (kleine Wolkenreste an Säulen)
function a2Puffs(puffs, top, bot, lit, mid, low, rim, shadow) {
  if (shadow) {
    blobPath(puffs.map(([x, y, r]) => [x + 3, y + 4, r]));
    ctx.fillStyle = shadow;
    ctx.fill();
  }
  blobPath(puffs);
  ctx.fillStyle = vgrad(top, bot, [[0, lit], [0.55, mid], [1, low]]);
  ctx.fill();
  if (rim) dots(puffs.filter(p => p[1] - p[2] < lerp(top, bot, 0.5)).map(([x, y, r]) => [x - r * 0.26, y - r * 0.3, r * 0.58]), rim);
}

// Haufenwolke als Turm: unten breit, nach oben schmaler, Ballen nach außen größer
// Haufenwolke: Ballen entlang einer gebeulten Kuppel (oben größer), innen aufgefüllt,
// flache Basis; hohe Wolken bekommen eine zweite, kleinere Kuppel leicht versetzt obenauf
function a2Dome(out, x, base, w, h, r) {
  const n = Math.max(6, Math.round((w + h) / 15));
  for (let k = 0; k <= n; k++) {
    const a = Math.PI * k / n, s = Math.sin(a);
    const pr = (w * 0.16 + h * 0.12) * (0.7 + s * 0.5) * (0.85 + r() * 0.3);
    out.push([x - Math.cos(a) * w * 0.86 + (r() - 0.5) * pr * 0.3, base - s * (h - pr * 0.6) + pr * 0.3, pr]);
  }
  // Füllung innerhalb der Halbellipse, damit keine Löcher bleiben
  const mn = Math.min(w, h);
  out.push([x, base - h * 0.4, mn * 0.5]);
  for (let k = 0, m = 3 + Math.round(w / 25); k < m; k++) {
    const a = Math.PI * r(), q = Math.sqrt(r()) * 0.62;
    out.push([x - Math.cos(a) * w * 0.86 * q, base - Math.sin(a) * h * 0.9 * q, mn * (0.3 + r() * 0.12)]);
  }
}
function a2Heap(x, base, w, h, r) {
  const out = [];
  if (h > w * 1.2) {
    const h1 = h * 0.55;
    a2Dome(out, x, base, w, h1, r);
    a2Dome(out, x + w * 0.15, base - h1 * 0.7, w * 0.62, h - h1 * 0.7, r);
  } else a2Dome(out, x, base, w, h, r);
  return out;
}

// Reihe von Wolkenballen entlang einer Kammlinie; P > 0 periodisch
function a2CloudRow(P, x0, x1, f, rMin, rMax, step, rng) {
  const out = [];
  for (let x = x0; x < x1; x += step * (0.7 + rng() * 0.6)) {
    const r = rMin + rng() * (rMax - rMin);
    out.push([x, f(x) + r * 0.55, r]);
  }
  if (P) return out.concat(out.filter(p => p[0] < rMax * 2).map(p => [p[0] + P, p[1], p[2]]), out.filter(p => p[0] > P - rMax * 2).map(p => [p[0] - P, p[1], p[2]]));
  return out;
}

ART2.sky.clouds = (C, S, rng) => {
  const sx = S.sunX * W, sy = S.sunY, sun = mix(CREAM, C.accent, 0.2);
  ctx.fillStyle = rgrad(sx, sy, 0, 280, [[0, rgba(sun, 0.55)], [0.2, rgba(sun, 0.2)], [1, rgba(sun, 0)]]);
  ctx.fillRect(sx - 280, sy - 280, 560, 560);
  circle(sx, sy, 23, rgrad(sx, sy, 0, 23, [[0, mix(CREAM, '#ffffff', 0.7)], [1, mix(CREAM, C.accent, 0.15)]], sx - 6, sy - 6));
  // Federwolken weit oben
  for (let i = 0, n = Math.round(7 * W / 400); i < n; i++) {
    const x = rng() * W, y = 30 + rng() * 140, len = 60 + rng() * 110;
    a2Soft(x, y, len, len * 0.07, CREAM, 0.35, -0.12 + rng() * 0.1);
  }
  // fernste Staffel: blasse Türme am Horizont, kaum Kontrast
  const pale = mix(C.skyBottom, C.far, 0.35);
  for (let x = -40 + rng() * 60; x < W + 60; x += 110 + rng() * 90) {
    const h = 50 + rng() * 70, w = 40 + rng() * 30;
    a2Billow(a2Heap(x, 450, w, h, rng), 450 - h - 20, 470, mix(pale, CREAM, 0.5), pale, mix(pale, C.skyTop, 0.2), 0.35, 0.22, null);
  }
  ctx.fillStyle = vgrad(360, 470, [[0, rgba(C.skyBottom, 0)], [1, rgba(C.skyBottom, 0.45)]]);
  ctx.fillRect(0, 360, W, 110);
  // flaches Wolkenmeer am Horizont
  const sea = mix(C.skyBottom, C.far, 0.5), f2 = x => 470 - 8 * pnoise(x / 40, 1000, 9);
  a2Billow(a2CloudRow(0, -40, W + 40, f2, 12, 22, 18, rng), 455, 500, mix(sea, CREAM, 0.55), sea, mix(sea, C.skyTop, 0.25), 0.4, 0.25, null);
  ctx.fillStyle = vgrad(482, GROUND_Y, [[0, rgba(sea, 0)], [0.35, rgba(sea, 0.95)], [1, mix(sea, C.skyTop, 0.15)]]);
  ctx.fillRect(0, 482, W, GROUND_Y - 482);
};

// Ferne Ebene: Kumulustürme mit sonnigen Kappen, dazwischen kleine schwebende Inseln
ART2.layerExtent.cloudTowers = () => [230, GROUND_Y + 14];
ART2.layerTex.cloudTowers = () => ({ grain: 0.03, mottle: 0.05, contrast: 1 });
ART2.layer.cloudTowers = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14;
  const back = mix(col, C.skyBottom, 0.3), front = col;
  // hintere Staffel: einzelne Türme
  const towers = [];
  for (let k = 0, n = 4; k < n; k++) towers.push([(k + 0.5) * P / n + (rng() - 0.5) * 90, 140 + rng() * 110, 55 + rng() * 30, (rng() * 1e6) | 0]);
  for (const [x, h, w, seed] of towers) {
    wrapEach(x, P, w * 1.6, xx => a2Billow(a2Heap(xx, 500, w, h, mulberry32(seed)), 500 - h - 30, 520, mix(back, '#ffffff', 0.5), back, mix(back, C.skyTop, 0.22), 0.45, 0.3, null));
  }
  // eine kleine schwebende Insel in der größten Lücke zwischen zwei Türmen
  const xs = towers.map(t => t[0]).sort((a, b) => a - b);
  let gx = 0, gw = -1;
  for (let k = 0; k < xs.length; k++) { const a = xs[k], b = k + 1 < xs.length ? xs[k + 1] : xs[0] + P; if (b - a > gw) { gw = b - a; gx = (a + b) / 2; } }
  const ix = ((gx % P) + P) % P, iy = 318 + rng() * 24, iseed = (rng() * 1e6) | 0;
  wrapEach(ix, P, 70, xx => a2Isle(xx, iy, 0.95, C, mulberry32(iseed), mix(col, C.pipe, 0.25)));
  // vordere Staffel: breite, niedrigere Hügel
  const ff = ridgeFn(P, 524, 70, 0.005, l.seed + 3);
  a2Billow(a2CloudRow(P, 0, P, ff, 24, 46, 30, rng), 440, yb, mix(front, '#ffffff', 0.5), front, mix(front, C.skyTop, 0.25), 0.5, 0.32, null);
  ctx.fillStyle = vgrad(450, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, 0.4)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 450, P + 16, yb - 450);
  ctx.globalCompositeOperation = 'source-over';
};

// Kleine schwebende Felsinsel mit Gras, zwei Säulen und Wolkensaum
// Schwebende Felsinsel: kantiger Kegel mit Schichtlinien, Wiesenkappe, Blütenbäume,
// kleiner Tempel, dünner (ruhender) Wasserfall, Wolkenfetzen am Fels
function a2Isle(x, y, s, C, r, rock) {
  const w = 46 * s, d = 54 * s, lit = mix(rock, CREAM, 0.3), dk = shade(rock, -0.22);
  const meadow = mix(C.accent, C.far, 0.5), bloom = mix(mix(C.accent, CREAM, 0.3), C.far, 0.35), stone = mix(C.pipe, CREAM, 0.3);
  const tip = [x + w * 0.12, y + d];
  const outline = [[x - w, y], [x - w * 0.9, y + d * 0.2], [x - w * 0.62, y + d * 0.38], [x - w * 0.4, y + d * 0.62], tip,
    [x + w * 0.38, y + d * 0.5], [x + w * 0.72, y + d * 0.28], [x + w, y + d * 0.08], [x + w, y]];
  // Wasserfall hinter dem Fels, vom rechten Rand
  ctx.fillStyle = vgrad(y, y + 120 * s, [[0, rgba(CREAM, 0.6)], [1, rgba(CREAM, 0)]]);
  ctx.fillRect(x + w * 0.78, y - 1, 3.2 * s, 120 * s);
  poly(outline, hgrad(x - w, x + w, [[0, lit], [0.45, rock], [1, dk]]));
  poly([[x + w * 0.1, y + 2], [x + w, y], [x + w, y + d * 0.08], [x + w * 0.72, y + d * 0.28], [x + w * 0.38, y + d * 0.5], tip, [x + w * 0.18, y + d * 0.45]], rgba(INK, 0.13));
  const strata = [];
  for (let k = 1; k <= 3; k++) { const yy = y + d * k * 0.2; strata.push([x - w * (1 - k * 0.2) + 3, yy, x + w * (1 - k * 0.15) - 4, yy + (r() - 0.5) * 3]); }
  segs(strata, rgba(INK, 0.12), 0.9);
  // Wiesenkappe
  ctx.beginPath();
  ctx.ellipse(x, y, w + 2, 6.5 * s, 0, 0, TAU);
  ctx.fillStyle = vgrad(y - 6 * s, y + 6 * s, [[0, mix(meadow, CREAM, 0.35)], [1, shade(meadow, -0.12)]]);
  ctx.fill();
  // Tempelchen: zwei Säulen, Architrav, Giebel
  const tx = x - w * 0.32, th = 20 * s, tw = 13 * s;
  for (const cx of [tx - tw / 2, tx + tw / 2]) {
    ctx.fillStyle = hgrad(cx - 2 * s, cx + 2 * s, [[0, mix(stone, CREAM, 0.4)], [1, mix(stone, C.far, 0.3)]]);
    ctx.fillRect(cx - 2 * s, y - th, 4 * s, th);
  }
  ctx.fillStyle = stone;
  ctx.fillRect(tx - tw / 2 - 4 * s, y - th - 3 * s, tw + 8 * s, 3 * s);
  poly([[tx - tw / 2 - 4 * s, y - th - 3 * s], [tx, y - th - 9 * s], [tx + tw / 2 + 4 * s, y - th - 3 * s]], mix(stone, CREAM, 0.3));
  // Blütenbäume
  for (const [bx, bh, br] of [[x + w * 0.25, 16, 8], [x + w * 0.55, 11, 6]]) {
    line(bx, y, bx, y - bh * s, mix(rock, INK, 0.2), 1.6 * s);
    blobPath([[bx, y - bh * s - br * 0.4 * s, br * s], [bx - br * 0.6 * s, y - bh * s, br * 0.65 * s], [bx + br * 0.6 * s, y - bh * s + 1, br * 0.6 * s]]);
    ctx.fillStyle = rgrad(bx - br * 0.3 * s, y - bh * s - br * 0.6 * s, 0, br * 1.6 * s, [[0, mix(bloom, CREAM, 0.4)], [1, shade(bloom, -0.12)]]);
    ctx.fill();
  }
  // Wolkenfetzen am Fels
  a2Billow([[x - w * 0.75, y + d * 0.3, 9 * s], [x - w * 0.55, y + d * 0.36, 7 * s], [x - w * 0.95, y + d * 0.34, 6 * s]], y + d * 0.15, y + d * 0.5, mix(CREAM, '#ffffff', 0.4), mix(CREAM, C.far, 0.35), mix(C.far, C.skyTop, 0.2), 0.4, 0.3, null);
  a2Billow([[x + w * 0.4, y + d * 0.62, 8 * s], [x + w * 0.62, y + d * 0.58, 6 * s]], y + d * 0.45, y + d * 0.75, mix(CREAM, '#ffffff', 0.4), mix(CREAM, C.far, 0.35), mix(C.far, C.skyTop, 0.2), 0.4, 0.3, null);
}

// Mittlere Ebene: Wolkenmeer mit Marmorruinen
ART2.layerExtent.cloudSea = () => [350, GROUND_Y + 14];
ART2.layerTex.cloudSea = () => ({ grain: 0.03, mottle: 0.06, contrast: 1 });
ART2.layer.cloudSea = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, marble = mix(C.pipe, col, 0.45);
  for (let k = 0; k < 3; k++) {
    const x = (k + 0.25 + rng() * 0.5) * P / 3, seed = (rng() * 1e6) | 0;
    wrapEach(x, P, 70, xx => a2Ruin(xx, 500, C, marble, mulberry32(seed), k));
  }
  const f = ridgeFn(P, 508, 44, 0.006, l.seed);
  a2Billow(a2CloudRow(P, 0, P, f, 22, 40, 30, rng), 450, yb, mix(col, '#ffffff', 0.55), col, mix(col, C.far, 0.6), 0.5, 0.35, rgba(C.skyTop, 0.08));
};

// Säulenstümpfe und ein Bogen aus Marmor
function a2Ruin(x, base, C, marble, r, variant) {
  const lit = mix(marble, CREAM, 0.4), dark = shade(marble, -0.18), kind = [0.2, 0.5, 0.8][variant % 3];
  const column = (cx, ch, broken) => {
    const cw = 7;
    ctx.fillStyle = hgrad(cx - cw, cx + cw, [[0, lit], [0.45, marble], [1, dark]]);
    const topY = base - ch;
    ctx.beginPath();
    ctx.moveTo(cx - cw, base);
    if (broken) { ctx.lineTo(cx - cw, topY + 4); ctx.lineTo(cx - 2, topY); ctx.lineTo(cx + 3, topY + 6); ctx.lineTo(cx + cw, topY + 2); }
    else { ctx.lineTo(cx - cw, topY); ctx.lineTo(cx + cw, topY); }
    ctx.lineTo(cx + cw, base);
    ctx.closePath();
    ctx.fill();
    segs([[cx - 3, topY + 6, cx - 3, base], [cx + 1, topY + 6, cx + 1, base], [cx + 4.5, topY + 6, cx + 4.5, base]], rgba(dark, 0.45), 0.9);
    if (!broken) {
      ctx.fillStyle = hgrad(cx - cw - 3, cx + cw + 3, [[0, lit], [1, dark]]);
      ctx.fillRect(cx - cw - 3, topY - 5, cw * 2 + 6, 5);
      line(cx - cw - 3, topY - 4.6, cx + cw + 3, topY - 4.6, rgba(CREAM, 0.5), 0.8);
    }
  };
  if (kind < 0.35) {
    // zwei Säulen mit Architrav
    const ch = 80 + r() * 25, span = 20;
    column(x - span, ch, false);
    column(x + span, ch, false);
    ctx.fillStyle = vgrad(base - ch - 14, base - ch - 5, [[0, lit], [1, marble]]);
    ctx.fillRect(x - span - 12, base - ch - 14, span * 2 + 24, 9);
    line(x - span - 12, base - ch - 13.5, x + span + 12, base - ch - 13.5, rgba(CREAM, 0.55), 0.9);
    ctx.fillStyle = rgba(dark, 0.35);
    ctx.fillRect(x - span - 12, base - ch - 6, span * 2 + 24, 1.4);
    poly([[x - span - 10, base - ch - 14], [x, base - ch - 26], [x + span + 10, base - ch - 14]], vgrad(base - ch - 26, base - ch - 14, [[0, lit], [1, marble]]));
  } else if (kind < 0.65) {
    // gebrochene Säule, daneben eine umgestürzte Trommel
    column(x - 6, 60 + r() * 30, true);
    ctx.save();
    ctx.translate(x + 22, base - 8);
    ctx.rotate(0.15);
    roundRectPath(-12, -7, 24, 14, 3);
    ctx.fillStyle = vgrad(-7, 7, [[0, lit], [0.5, marble], [1, dark]]);
    ctx.fill();
    ellipse(-12, 0, 2.8, 7, 0, mix(marble, CREAM, 0.25));
    ctx.restore();
  } else {
    // Bogen auf zwei Säulen
    const ch = 70 + r() * 20, span = 22;
    column(x - span, ch, false);
    column(x + span, ch, false);
    ctx.beginPath();
    ctx.arc(x, base - ch - 5, span + 10, Math.PI, TAU);
    ctx.arc(x, base - ch - 5, span - 4, TAU, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = vgrad(base - ch - span - 16, base - ch, [[0, lit], [1, marble]]);
    ctx.fill();
    ctx.strokeStyle = rgba(dark, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

// Vordere Ebene: große helle Wolkenballen
ART2.layerExtent.cloudFront = () => [440, GROUND_Y + 14];
ART2.layerTex.cloudFront = () => ({ grain: 0.03, mottle: 0.05, contrast: 1 });
ART2.layer.cloudFront = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14;
  // Ballengruppen unterschiedlicher Größe, teils überlappend, mit Lücken für das Wolkenmeer dahinter
  for (let k = 0, n = 7; k < n; k++) {
    const big = k % 3 === 0, cx = (k + 0.5) * P / n + (rng() - 0.5) * 90, hw = big ? 85 + rng() * 30 : 40 + rng() * 35, hh = big ? 70 + rng() * 25 : 30 + rng() * 25, seed = (rng() * 1e6) | 0;
    wrapEach(cx, P, hw * 1.5 + 40, x => {
      const r = mulberry32(seed), puffs = a2Heap(x, yb - 4, hw, hh, r);
      a2Billow(puffs, yb - hh - 40, yb, mix(col, '#ffffff', 0.6), col, mix(col, C.far, 0.65), 0.55, 0.38, rgba(C.skyTop, 0.12));
      // warmer Lichtsaum oben links
      ctx.save();
      blobPath(puffs);
      ctx.clip();
      ctx.fillStyle = rgrad(x - hw * 0.5, yb - hh - 30, 0, hw * 0.9, [[0, rgba(C.accent, 0.13)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(x - hw * 1.5, yb - hh - 70, hw * 3, hh + 70);
      ctx.restore();
    });
  }
};

// Boden: weicher Wolkenboden in mehreren Lagen
ART2.ground.cloudfloor = (P, y, C, rng, band) => {
  const deep = mix(C.far, C.skyTop, 0.3);
  band(vgrad(y, H, [[0, mix(C.near, C.far, 0.5)], [1, deep]]), y + 8, H - y);
  // tiefere Lage, nur angedeutet
  const low = [];
  for (let x = -20; x < P + 20; x += 34 + rng() * 26) low.push([x, y + 40 + rng() * 6, 20 + rng() * 12]);
  const wrapP = list => list.concat(list.filter(p => p[0] < 50).map(p => [p[0] + P, p[1], p[2]]), list.filter(p => p[0] > P - 50).map(p => [p[0] - P, p[1], p[2]]));
  a2Billow(wrapP(low), y + 14, H, mix(C.far, C.near, 0.5), mix(C.far, C.skyTop, 0.12), deep, 0.35, 0.3, null);
  // oberste Lage: große, ungleiche Ballen, Kuppen 3 bis 10 über der Kante
  const top = [];
  for (let x = -20; x < P + 20;) {
    const r0 = 11 + rng() * 13;
    top.push([x, y + r0 - 3 - rng() * 7, r0]);
    x += r0 * (0.9 + rng() * 0.7);
  }
  a2Billow(wrapP(top), y - 10, y + 26, mix(C.near, '#ffffff', 0.6), C.near, mix(C.near, C.far, 0.65), 0.5, 0.38, rgba(C.skyTop, 0.14));
  // warmes Licht auf den Kuppen
  ctx.save();
  blobPath(wrapP(top));
  ctx.clip();
  ctx.fillStyle = vgrad(y - 12, y + 2, [[0, rgba(C.accent, 0.16)], [1, rgba(C.accent, 0)]]);
  ctx.fillRect(-8, y - 12, P + 16, 14);
  ctx.restore();
};

// Säule: kannelierte Marmorsäule in Pastell-Lavendel, in Wolkenbänder gehüllt
ART2.pipeBody.marble = (C, h, v, r) => {
  const m = mix(C.pipe, CREAM, 0.22);
  columnBase(h, m, shade(m, -CONFIG.SIDE_DARKEN), mix(m, CREAM, 0.55));
  // Kanneluren: Rinne links im Schatten, rechte Flanke im Licht
  for (let k = 0; k < 7; k++) {
    const gx = 5 + k * 8.33, t = gx / PW, sh = 0.1 + t * 0.18;
    ctx.fillStyle = hgrad(gx - 2.8, gx + 2.8, [[0, rgba(INK, sh)], [0.55, rgba(INK, sh * 0.25)], [0.8, rgba(CREAM, 0.22 * (1 - t))], [1, rgba(CREAM, 0)]]);
    ctx.fillRect(gx - 2.8, 0, 5.6, h);
  }
  // Marmoradern
  for (let k = 0; k < h / 60; k++) {
    let x = r() * PW, y = r() * h;
    const pts = [[x, y]];
    for (let j = 0; j < 6; j++) { x += (r() - 0.35) * 9; y += 6 + r() * 12; pts.push([x, y]); }
    a2Path(pts);
    ctx.strokeStyle = rgba(r() < 0.5 ? CREAM : C.pipeDark, 0.18 + r() * 0.12);
    ctx.lineWidth = 0.6 + r() * 0.8;
    ctx.stroke();
  }
  // Wolkenbänder um die Säule
  for (let y0 = 70 + v * 85; y0 < h - 10; y0 += 170) a2CloudWrap(y0, C, r);
};

function a2CloudWrap(y0, C, r) {
  const puffs = [];
  for (let x = -3; x <= PW + 3; x += 6 + r() * 3) puffs.push([x, y0 + Math.sin(x * 0.09) * 2 + x * 0.08, 5 + r() * 4]);
  // Schatten des Bandes auf der Säule
  ctx.fillStyle = rgba(INK, 0.14);
  ctx.beginPath();
  ctx.rect(0, y0 + 4, PW, 10);
  ctx.fill();
  a2Billow(puffs, y0 - 8, y0 + 12, mix(CREAM, '#ffffff', 0.6), mix(C.near, CREAM, 0.3), mix(C.near, C.far, 0.7), 0.6, 0.4, null);
  // dünne Fahne, die nach rechts abzieht
  a2Soft(PW - 6, y0 + 8, 16, 3, CREAM, 0.6, 0.1);
}

ART2.pipeCap.marble = (C, up) => {
  const m = mix(C.pipe, CREAM, 0.3), lit = mix(m, CREAM, 0.55), dark = shade(m, -CONFIG.SIDE_DARKEN - 0.05), gold = mix(C.accent, CREAM, 0.25);
  const slab = (x0, x1, y0, y1, convex) => {
    ctx.fillStyle = hgrad(x0, x1, [[0, lit], [0.15, m], [0.65, m], [0.8, dark], [1, shade(dark, -0.12)]]);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (convex) {
      ctx.fillStyle = vgrad(y0, y1, [[0, rgba(CREAM, 0.35)], [0.45, rgba(CREAM, 0)], [1, rgba(INK, 0.22)]]);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    ctx.strokeStyle = rgba(INK, 0.22);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  };
  if (up) {
    // Kapitell: Deckplatte, Wulst, Halsringe
    slab(-1, PW + 1, 18, 28, false);
    slab(-PCO + 1, PW + PCO - 1, 7, 16, true);
    ctx.beginPath();
    ctx.moveTo(-PCO + 1, 15.5); ctx.quadraticCurveTo(PW / 2, 22, PW + PCO - 1, 15.5); ctx.lineTo(PW + 1, 18); ctx.lineTo(-1, 18); ctx.closePath();
    ctx.fillStyle = rgba(INK, 0.16);
    ctx.fill();
    slab(-PCO, PW + PCO, 0, 7, false);
    line(-PCO + 1, 0.8, PW + PCO - 1, 0.8, rgba('#ffffff', 0.55), 1.2);
    line(-PCO, 5.5, PW + PCO, 5.5, gold, 1.4);
    segs([[0, 20.5, PW, 20.5], [0, 23.5, PW, 23.5]], rgba(INK, 0.18), 0.9);
    // Voluten an den Ecken
    for (const [vx, d] of [[-PCO + 4.5, 1], [PW + PCO - 4.5, -1]]) {
      ctx.strokeStyle = rgba(C.pipeDark, 0.5);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let a = 0; a < TAU * 1.6; a += 0.3) { const rr = 4.2 - a * 0.38; const px = vx + Math.cos(a) * rr * d, py = 11.5 + Math.sin(a) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
    }
    // kleine Wolke schmiegt sich an die Halsringe
    a2Billow([[PW - 2, 25, 5], [PW + 4, 23, 4], [PW - 8, 26, 3.5]], 18, 30, mix(CREAM, '#ffffff', 0.6), mix(C.near, CREAM, 0.3), mix(C.near, C.far, 0.7), 0.6, 0.4, null);
  } else {
    // Basis: Halsring, Wulst, Kehle, Wulst, Plinthe
    slab(-1, PW + 1, -4, 3, true);
    slab(0.5, PW - 0.5, 3, 7, false);
    ctx.fillStyle = rgba(INK, 0.2);
    ctx.fillRect(0.5, 3, PW - 1, 4);
    slab(-PCO + 1, PW + PCO - 1, 7, 15, true);
    slab(-PCO, PW + PCO, 15, PCH, false);
    line(-PCO, 16.2, PW + PCO, 16.2, gold, 1.4);
    line(-PCO + 1, 15.6, PW + PCO - 1, 15.6, rgba('#ffffff', 0.35), 0.8);
    a2Billow([[-2, 9, 5], [-7, 11, 4], [3, 12, 3.5]], 4, 16, mix(CREAM, '#ffffff', 0.6), mix(C.near, CREAM, 0.3), mix(C.near, C.far, 0.7), 0.6, 0.4, null);
  }
};

// ============================================================
// UHRWERK (12): Messing und Kupfer, ruhende Zahnräder im Hintergrund
// ============================================================
// Zahnrad als ruhende Silhouette: Zähne, Speichenfenster, Nabe, Kantenlicht oben links
function a2Gear(x, y, r, teeth, body, hole, rim, spokes) {
  const rin = r - Math.max(3, r * 0.12), step = TAU / teeth;
  ctx.beginPath();
  for (let k = 0; k < teeth; k++) {
    const a0 = k * step, P = (a, rr) => [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
    const p0 = P(a0, rin), p1 = P(a0 + step * 0.12, r), p2 = P(a0 + step * 0.38, r), p3 = P(a0 + step * 0.5, rin);
    if (k === 0) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
    ctx.arc(x, y, rin, a0 + step * 0.5, a0 + step);
  }
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  const n = spokes || 5, ro = rin - Math.max(3, r * 0.14), ri = r * 0.3, gap = Math.min(0.5, 7 / ro);
  if (ro > ri + 4) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a0 = k * TAU / n + 0.3 + gap, a1 = (k + 1) * TAU / n + 0.3 - gap;
      ctx.moveTo(x + Math.cos(a0) * ro, y + Math.sin(a0) * ro);
      ctx.arc(x, y, ro, a0, a1);
      ctx.arc(x, y, ri, a1 - gap * 0.4, a0 + gap * 0.4, true);
      ctx.closePath();
    }
    ctx.fillStyle = hole;
    ctx.fill();
  }
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.arc(x, y, rin - 1, Math.PI * 0.95, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, ri * 0.62, Math.PI * 0.95, Math.PI * 1.6);
    ctx.stroke();
  }
  circle(x, y, ri * 0.62, rgba(INK, 0.12));
  circle(x, y, ri * 0.22, hole);
}

ART2.sky.clockwork = (C, S, rng) => {
  const cx = S.sunX * W, cy = S.sunY, R = clamp(W * 0.4, 150, 205);
  const glow = mix(C.accentLight, C.pipeLight, 0.4), dark = mix(C.skyTop, C.far, 0.3);
  // Licht hinter dem Zifferblatt, gedämpft
  ctx.fillStyle = rgrad(cx, cy, R * 0.2, R * 1.7, [[0, rgba(glow, 0.2)], [0.55, rgba(glow, 0.07)], [1, rgba(glow, 0)]]);
  ctx.fillRect(cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4);
  // Lichtbahnen schräg nach unten links in den Raum
  a2Rays(cx, cy, 5, Math.PI * 0.62, Math.PI * 0.86, 620, R * 0.35, glow, 0.05, rng);
  // Zifferblatt: durchscheinendes Glas mit Sprossen, Stundenbalken, Zeiger
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgrad(cx, cy, 0, R, [[0, rgba(glow, 0.2)], [0.8, rgba(glow, 0.12)], [1, rgba(glow, 0.05)]]);
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
  const sp = [];
  for (let k = 0; k < 12; k++) { const a = k * TAU / 12; sp.push([cx + Math.cos(a) * R * 0.18, cy + Math.sin(a) * R * 0.18, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8]); }
  segs(sp, rgba(dark, 0.32), 2);
  for (const rr of [0.18, 0.5, 0.8]) {
    ctx.strokeStyle = rgba(dark, rr === 0.8 ? 0.45 : 0.28);
    ctx.lineWidth = rr === 0.8 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * rr, 0, TAU);
    ctx.stroke();
  }
  const ticks = [], bars = [];
  for (let k = 0; k < 60; k++) {
    const a = k * TAU / 60, big = k % 5 === 0, r0 = R * (big ? 0.82 : 0.86), r1 = R * 0.93;
    (big ? bars : ticks).push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]);
  }
  segs(ticks, rgba(dark, 0.32), 1.2);
  segs(bars, rgba(dark, 0.45), 4);
  // Rahmen mit Messingkante oben links
  ctx.strokeStyle = rgba(dark, 0.7);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 3, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.pipe, 0.22);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, Math.PI * 0.9, Math.PI * 1.65);
  ctx.stroke();
  // Zeiger auf zehn nach zehn
  const hand = (a, len, wd) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    poly([[-wd, R * 0.08], [-wd * 0.6, -len * 0.7], [0, -len], [wd * 0.6, -len * 0.7], [wd, R * 0.08]], rgba(dark, 0.7));
    circle(0, -len * 0.62, wd * 1.6, rgba(dark, 0.7));
    circle(0, -len * 0.62, wd * 0.7, rgba(glow, 0.12));
    ctx.restore();
  };
  hand(-Math.PI / 3 * 1.0 - 0.05, R * 0.52, 5);
  hand(Math.PI / 3, R * 0.74, 3.5);
  circle(cx, cy, 9, rgba(dark, 0.8));
  circle(cx - 2, cy - 2, 3, rgba(C.pipe, 0.3));
  // große ruhende Zahnräder in den oberen Ecken, dunkel
  const gb = mix(C.skyTop, C.far, 0.25), gh = shade(C.skyTop, -0.2), gr = rgba(C.pipe, 0.16);
  a2Gear(W * 0.08, 30, 120, 22, gb, gh, gr, 6);
  a2Gear(W * 0.08 + 150, -40, 62, 14, mix(gb, C.far, 0.2), gh, gr, 5);
  a2Gear(W * 1.02, 20, 90, 18, gb, gh, gr, 5);
  // schwebender Staub im Licht (ruhend, sehr zart)
  const dust = [];
  for (let k = 0, n = Math.round(W / 8); k < n; k++) dust.push([cx - R * 1.4 + rng() * R * 2, cy + rng() * 300, 0.5 + rng() * 0.6]);
  dots(dust, rgba(glow, 0.18));
  // Werkstattschein am Boden
  ctx.fillStyle = vgrad(320, GROUND_Y, [[0, rgba(C.accent, 0)], [1, rgba(C.accent, 0.22)]]);
  ctx.fillRect(0, 320, W, GROUND_Y - 320);
  ctx.fillStyle = vgrad(0, 90, [[0, rgba(gh, 0.45)], [1, rgba(gh, 0)]]);
  ctx.fillRect(0, 0, W, 90);
};

// Ferne Ebene: Wand aus großen ruhenden Zahnrädern mit Trägern und Wellen
ART2.layerExtent.gearWall = () => [150, GROUND_Y + 14];
ART2.layerTex.gearWall = () => ({ grain: 0.05, mottle: 0.14, contrast: 1.15 });
ART2.layer.gearWall = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, body = mix(col, C.skyTop, 0.2), hole = mix(body, C.skyTop, 0.42), rim = rgba(C.pipeLight, 0.16);
  // Träger und Querwelle; die Träger tauchen oben weich aus dem Dunst auf
  const beam = mix(body, C.skyBottom, 0.15);
  for (let x = 60; x < P; x += 250) {
    ctx.fillStyle = hgrad(x - 8, x + 8, [[0, shade(beam, 0.06)], [1, shade(beam, -0.14)]]);
    ctx.fillRect(x - 8, 150, 16, yb - 150);
    const cross = [];
    for (let y = 170; y < yb; y += 36) cross.push([x - 7, y, x + 7, y + 36], [x + 7, y, x - 7, y + 36]);
    segs(cross, rgba(INK, 0.14), 1.2);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vgrad(150, 250, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(x - 10, 150, 20, 100);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = vgrad(318, 330, [[0, shade(beam, 0.15)], [1, shade(beam, -0.2)]]);
  ctx.fillRect(-8, 318, P + 16, 12);
  // Zahnräder: großes Rad, kämmende Nachbarn
  const gears = [];
  let x = 40;
  while (x < P - 40) {
    const r = 46 + rng() * 70, y = 300 + rng() * 150;
    gears.push([x + r * 0.5, y, r, 12 + Math.round(r / 6)]);
    x += r * 1.75 + 10 + rng() * 40;
  }
  for (const [gx, gy, r, t] of gears) {
    const shade2 = mix(body, C.skyBottom, (gy - 300) / 600);
    wrapEach(gx, P, r + 4, xx => {
      a2Gear(xx + SHADOW.x * 0.6, gy + SHADOW.y * 0.6, r, t, rgba(INK, 0.18), rgba(INK, 0), null, 5);
      a2Gear(xx, gy, r, t, shade2, hole, rim, 5);
    });
  }
  // kleine Ritzel zwischen den großen Rädern
  for (let k = 0; k < gears.length - 1; k++) {
    const [ax, ay, ar] = gears[k], [bx, by] = gears[k + 1];
    const mx = (ax + bx) / 2, my = Math.min(ay, by) - ar * 0.4 - 10, r = 18 + rng() * 10;
    wrapEach(mx, P, r + 2, xx => a2Gear(xx, my, r, 10, shade(body, 0.08), hole, rim, 4));
  }
  ctx.fillStyle = vgrad(150, yb, [[0, rgba(C.haze, 0.2)], [0.5, rgba(C.haze, 0.34)], [1, rgba(C.haze, 0.6)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 150, P + 16, yb - 150);
  ctx.globalCompositeOperation = 'source-over';
};

// Mittlere Ebene: Dampfleitungen mit Flanschen, Ventilen, Manometern und Kesseln
ART2.layerExtent.steamworks = () => [290, GROUND_Y + 14];
ART2.layerTex.steamworks = () => ({ grain: 0.05, mottle: 0.14, contrast: 1.15 });
ART2.layer.steamworks = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, metal = mix(C.pipe, col, 0.62), lit = mix(metal, C.pipeLight, 0.35), dk = shade(metal, -0.35);
  const hpipe = (y, d) => {
    ctx.fillStyle = vgrad(y - d, y + d, [[0, dk], [0.25, lit], [0.45, metal], [1, shade(dk, -0.2)]]);
    ctx.fillRect(-8, y - d, P + 16, d * 2);
  };
  const flange = (x, y, d) => {
    ctx.fillStyle = hgrad(x - 4, x + 4, [[0, mix(C.accent, col, 0.35)], [1, shade(mix(C.accent, col, 0.5), -0.3)]]);
    ctx.fillRect(x - 4, y - d - 3, 8, d * 2 + 6);
    dots([[x, y - d, 1], [x, y + d, 1]], rgba(CREAM, 0.25));
  };
  // Kessel im Hintergrund der Ebene
  for (let k = 0; k < 2; k++) {
    const x = (k + 0.3 + rng() * 0.4) * P / 2, w = 34 + rng() * 14, top = 330 + rng() * 40;
    wrapEach(x, P, w + 10, xx => {
      ctx.fillStyle = hgrad(xx - w, xx + w, [[0, lit], [0.3, metal], [1, dk]]);
      roundRectPath(xx - w, top, w * 2, 520 - top, w * 0.9);
      ctx.fill();
      const bands = [];
      for (let y = top + 30; y < 500; y += 34) bands.push([xx - w, y, xx + w, y]);
      segs(bands, rgba(INK, 0.3), 2.5);
      const rv = [];
      for (const [a, b] of bands.map(s => [s[0], s[1]])) for (let rx = a + 6; rx < xx + w - 4; rx += 9) rv.push([rx, b - 3, 0.9]);
      dots(rv, rgba(CREAM, 0.18));
      // Manometer am Kessel
      const gy = top + 45;
      circle(xx - w * 0.2, gy, 9, mix(C.accent, col, 0.3));
      circle(xx - w * 0.2, gy, 7, mix(CREAM, col, 0.35));
      line(xx - w * 0.2, gy, xx - w * 0.2 + 4, gy - 4, rgba(INK, 0.6), 1);
    });
  }
  // senkrechte Steigrohre mit Knie in die Hauptleitung
  for (let k = 0; k < 4; k++) {
    const x = (k + 0.5) * P / 4 + (rng() - 0.5) * 60, top = 320 + rng() * 100, d = 6 + rng() * 3;
    wrapEach(x, P, d + 6, xx => {
      ctx.fillStyle = hgrad(xx - d, xx + d, [[0, dk], [0.25, lit], [0.45, metal], [1, shade(dk, -0.2)]]);
      ctx.fillRect(xx - d, top, d * 2, 480 - top);
      for (let y = top + 40; y < 470; y += 70) {
        ctx.fillStyle = vgrad(y - 3, y + 3, [[0, mix(C.accent, col, 0.3)], [1, shade(mix(C.accent, col, 0.5), -0.3)]]);
        ctx.fillRect(xx - d - 3, y - 3, d * 2 + 6, 6);
      }
      ctx.fillStyle = hgrad(xx - d - 3, xx + d + 3, [[0, lit], [1, dk]]);
      ctx.fillRect(xx - d - 3, top - 4, d * 2 + 6, 6);
    });
  }
  // zwei Hauptleitungen mit Flanschen und Handrädern
  hpipe(478, 9);
  hpipe(503, 7);
  for (let x = 30 + rng() * 40; x < P; x += 110 + rng() * 40) {
    wrapEach(x, P, 14, xx => { flange(xx, 478, 9); flange(xx + 35, 503, 7); });
  }
  for (let k = 0; k < 4; k++) {
    const x = (k + 0.5) * P / 4 + (rng() - 0.5) * 80;
    wrapEach(x, P, 16, xx => {
      line(xx, 469, xx, 455, dk, 3);
      ctx.strokeStyle = mix(C.accent, col, 0.25);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(xx, 452, 11, 3.5, 0, 0, TAU);
      ctx.stroke();
      segs([[xx - 11, 452, xx + 11, 452], [xx, 448.5, xx, 455.5]], mix(C.accent, col, 0.4), 1.4);
    });
  }
  // Sockel und Gitterbrüstung vorn
  ctx.fillStyle = vgrad(512, yb, [[0, shade(col, -0.1)], [1, shade(col, -0.35)]]);
  ctx.fillRect(-8, 512, P + 16, yb - 512);
  const rail = [];
  for (let x = 0; x < P; x += 24) rail.push([x, 512, x, 528]);
  segs(rail, rgba(dk, 0.8), 2);
  line(-8, 512, P + 8, 512, lit, 1.5);
  ctx.fillStyle = vgrad(250, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, 0.25)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 250, P + 16, yb - 250);
  ctx.globalCompositeOperation = 'source-over';
};

// Vordergrund: Ventilstutzen, Manometer, Federn, Mutternhaufen, Lampe
ART2.prop.clockjunk = { h: 100, paint: (x, base, s, r, v, C, col) => a2ClockProp(x, base, s, r, v, C, col) };
function a2ClockProp(x, base, s, r, v, C, col) {
  const brass = mix(C.pipe, col, 0.35), lit = mix(brass, C.pipeLight, 0.5), dk = shade(brass, -0.4), copper = mix(C.accent, col, 0.25);
  const stub = (h, d) => {
    ctx.fillStyle = hgrad(x - d, x + d, [[0, lit], [0.35, brass], [1, dk]]);
    ctx.fillRect(x - d, base - h, d * 2, h + 2);
    ctx.fillStyle = hgrad(x - d - 3, x + d + 3, [[0, mix(copper, CREAM, 0.2)], [1, shade(copper, -0.35)]]);
    ctx.fillRect(x - d - 3, base - 6, d * 2 + 6, 6);
  };
  ellipse(x + 8, base - 1, 16 * s, 3 * s, 0, rgba(INK, 0.25));
  if (v < 0.25) {
    // Ventil mit Handrad
    const h = (26 + r() * 14) * s;
    stub(h, 4 * s);
    ctx.strokeStyle = copper;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(x, base - h - 2, 12 * s, 4 * s, 0, 0, TAU);
    ctx.stroke();
    segs([[x - 12 * s, base - h - 2, x + 12 * s, base - h - 2], [x, base - h - 6 * s, x, base - h + 2 * s]], mix(copper, CREAM, 0.3), 1.6);
    circle(x, base - h - 2, 2.2, lit);
  } else if (v < 0.45) {
    // Manometer auf Stutzen
    const h = (30 + r() * 20) * s, gr = 10 * s;
    stub(h, 3 * s);
    circle(x + 1, base - h - gr + 1.5, gr + 2, rgba(INK, 0.3));
    circle(x, base - h - gr, gr + 2, hgrad(x - gr, x + gr, [[0, lit], [1, dk]]));
    circle(x, base - h - gr, gr, mix(CREAM, col, 0.25));
    const tk = [];
    for (let k = 0; k < 9; k++) { const a = Math.PI * 0.8 + k * Math.PI * 1.4 / 8; tk.push([x + Math.cos(a) * gr * 0.7, base - h - gr + Math.sin(a) * gr * 0.7, x + Math.cos(a) * gr * 0.9, base - h - gr + Math.sin(a) * gr * 0.9]); }
    segs(tk, rgba(INK, 0.5), 0.8);
    const na = Math.PI * (1.1 + r() * 0.9);
    line(x, base - h - gr, x + Math.cos(na) * gr * 0.75, base - h - gr + Math.sin(na) * gr * 0.75, mix(C.accent, INK, 0.3), 1.2);
    circle(x - gr * 0.35, base - h - gr * 1.35, gr * 0.3, rgba('#ffffff', 0.25));
  } else if (v < 0.6) {
    // Spiralfeder
    const h = (22 + r() * 16) * s, n = 7;
    ctx.strokeStyle = shade(brass, 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= n * 12; k++) {
      const t = k / (n * 12), a = t * n * TAU, px = x + Math.cos(a) * 7 * s, py = base - 3 - t * h + Math.sin(a) * 2 * s;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = dk;
    ctx.fillRect(x - 9 * s, base - 3, 18 * s, 4);
  } else if (v < 0.8) {
    // Muttern und Bolzen
    for (let k = 0; k < 5; k++) {
      const nx = x + (k - 2) * 6 * s + (r() - 0.5) * 3, ny = base - 3 - (k % 2) * 4 * s, nr = (3 + r() * 1.5) * s, pts = [];
      for (let j = 0; j < 6; j++) pts.push([nx + Math.cos(j * TAU / 6 + 0.3) * nr, ny + Math.sin(j * TAU / 6 + 0.3) * nr * 0.75]);
      poly(pts, hgrad(nx - nr, nx + nr, [[0, lit], [1, dk]]));
      circle(nx, ny, nr * 0.38, dk);
    }
  } else {
    // Werkstattlampe
    const h = (40 + r() * 16) * s;
    line(x, base, x, base - h, dk, 2.4);
    line(x, base - h, x + 10 * s, base - h - 4 * s, dk, 2);
    ctx.fillStyle = rgrad(x + 12 * s, base - h + 4, 0, 26, [[0, rgba(C.accentLight, 0.4)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x + 12 * s - 26, base - h - 22, 52, 52);
    ctx.beginPath();
    ctx.moveTo(x + 6 * s, base - h - 2 * s); ctx.lineTo(x + 18 * s, base - h - 2 * s); ctx.lineTo(x + 15 * s, base - h + 6 * s); ctx.lineTo(x + 9 * s, base - h + 6 * s); ctx.closePath();
    ctx.fillStyle = copper;
    ctx.fill();
    circle(x + 12 * s, base - h + 6.5 * s, 2.6 * s, mix(C.accentLight, CREAM, 0.5));
  }
}

// Boden: genietete Riffelbleche, Messing-Zahnstange an der Kante, Gitter mit Glut darunter
ART2.ground.clockfloor = (P, y, C, rng, band) => {
  const iron = mix(C.near, C.pipeDark, 0.4), brass = C.pipe;
  band(vgrad(y, H, [[0, shade(iron, 0.12)], [1, shade(iron, -0.35)]]), y + 8, H - y);
  // Platten mit Fugen, Nieten und Riffelmuster
  for (let x = 0; x < P; x += 60) {
    const grate = x % 360 === 180;
    if (grate) {
      ctx.fillStyle = vgrad(y + 14, H, [[0, mix(C.accent, INK, 0.35)], [1, mix(C.accent, INK, 0.75)]]);
      ctx.fillRect(x + 4, y + 16, 52, H - y - 20);
      ctx.fillStyle = rgrad(x + 30, y + 40, 0, 36, [[0, rgba(C.accentLight, 0.35)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(x - 6, y + 10, 72, 60);
      const bars = [];
      for (let gx = x + 8; gx < x + 56; gx += 6) bars.push([gx, y + 16, gx, H]);
      segs(bars, shade(iron, -0.2), 3);
      segs(bars.map(([a, b, c2, d]) => [a - 1, b, c2 - 1, d]), rgba(CREAM, 0.12), 0.8);
    } else {
      const tread = [];
      for (let ty = y + 18; ty < H - 4; ty += 7) for (let tx = x + 6 + ((ty / 7) % 2) * 3.5; tx < x + 54; tx += 7) {
        const d = ((tx + ty) / 7) % 2 < 1 ? 1 : -1;
        tread.push([tx - 2, ty - d * 1.2, tx + 2, ty + d * 1.2]);
      }
      segs(tread, rgba(CREAM, 0.07), 1.6);
      segs(tread.map(([a, b, c2, d]) => [a + 0.6, b + 0.8, c2 + 0.6, d + 0.8]), rgba(INK, 0.15), 1.2);
    }
    ctx.fillStyle = rgba(INK, 0.4);
    ctx.fillRect(x, y + 12, 1.6, H - y);
    ctx.fillStyle = rgba(CREAM, 0.07);
    ctx.fillRect(x + 1.6, y + 12, 1, H - y);
    const rv = [[x + 6, y + 18, 1.5], [x + 54, y + 18, 1.5], [x + 6, y + 50, 1.5], [x + 54, y + 50, 1.5]];
    dots(rv.map(([a, b, c2]) => [a + 0.6, b + 0.7, c2]), rgba(INK, 0.5));
    dots(rv, mix(iron, CREAM, 0.35));
  }
  // Zahnstange aus Messing an der Kante
  ctx.fillStyle = rgba(INK, 0.45);
  ctx.fillRect(-8, y + 9, P + 16, 4);
  ctx.beginPath();
  for (let x = -8; x < P + 8; x += 8) { ctx.moveTo(x, y + 1); ctx.lineTo(x + 1.5, y - 4); ctx.lineTo(x + 4.5, y - 4); ctx.lineTo(x + 6, y + 1); ctx.closePath(); }
  ctx.fillStyle = vgrad(y - 4, y + 1, [[0, mix(brass, CREAM, 0.35)], [1, shade(brass, -0.15)]]);
  ctx.fill();
  band(vgrad(y, y + 9, [[0, mix(brass, CREAM, 0.3)], [0.35, brass], [1, shade(brass, -0.35)]]), y, 9);
  const bolts = [];
  for (let x = 12; x < P; x += 40) bolts.push([x, y + 4.5, 1.5]);
  dots(bolts.map(([a, b, c2]) => [a + 0.5, b + 0.6, c2]), rgba(INK, 0.45));
  dots(bolts, mix(brass, CREAM, 0.4));
  band(rgba(CREAM, 0.25), y, 1);
};

// Säule: genietetes Messingrohr mit Kupferflanschen, Manometern und Handrädern
ART2.pipeBody.brasspipe = (C, h, v, r) => {
  const b = C.pipe;
  ctx.fillStyle = hgrad(0, PW, [[0, mix(b, CREAM, 0.25)], [0.08, C.pipeLight], [0.16, mix(C.pipeLight, CREAM, 0.35)], [0.24, b], [0.5, b], [0.62, shade(b, -0.1)], [0.74, C.pipeSide], [0.86, shade(C.pipeSide, -0.12)], [1, shade(C.pipeSide, -0.3)]]);
  ctx.fillRect(0, 0, PW, h);
  // matte Anlaufstellen und feine Kratzer
  const tarn = [];
  for (let k = 0; k < h / 40; k++) tarn.push([r() * PW, r() * h, 3 + r() * 6, 8 + r() * 18, 0]);
  ellipses(tarn, rgba(C.pipeDark, 0.12));
  const scr = [];
  for (let k = 0; k < h / 14; k++) { const sx = 4 + r() * 48, sy = r() * h; scr.push([sx, sy, sx + 3 + r() * 7, sy + (r() - 0.5) * 1.5]); }
  segs(scr, rgba(CREAM, 0.14), 0.6);
  // Längsnaht mit Nietreihe
  const seam = 47;
  line(seam, 0, seam, h, rgba(C.pipeDark, 0.55), 1.2);
  line(seam + 1.2, 0, seam + 1.2, h, rgba(C.pipeLight, 0.15), 0.8);
  const rv = [];
  for (let y = 5; y < h; y += 11) rv.push([seam - 3.5, y, 1.3]);
  dots(rv.map(([a, b2, c2]) => [a + 0.6, b2 + 0.8, c2]), rgba(INK, 0.4));
  dots(rv, mix(C.pipeLight, CREAM, 0.3));
  // Flansche und Armaturen abwechselnd
  let k = v;
  for (let y0 = 40 + v * 55; y0 < h - 6; y0 += 125, k++) {
    a2Flange(y0, C, 2.5, 9);
    const fy = y0 + 62;
    if (fy > h - 14) continue;
    if (k % 2 === 0) a2Gauge(21, fy, 8.5, C, r);
    else a2Handwheel(21, fy, 9, C);
  }
  // Außenkanten
  ctx.fillStyle = rgba(CREAM, 0.2);
  ctx.fillRect(0, 0, 1.2, h);
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.fillRect(PW - 1.2, 0, 1.2, h);
};

// Kupferflansch quer über das Rohr, etwas breiter, mit Schraubenköpfen
function a2Flange(y0, C, over, hh) {
  const c = mix(C.accent, C.pipeDark, 0.12);
  ctx.fillStyle = rgba(INK, CONFIG.SHADOW_ALPHA);
  ctx.fillRect(-over + SHADOW.x * 0.3, y0 + SHADOW.y * 0.3, PW + over * 2, hh);
  ctx.fillStyle = hgrad(-over, PW + over, [[0, mix(c, CREAM, 0.3)], [0.12, mix(c, CREAM, 0.12)], [0.5, c], [0.75, C.accentSide], [1, shade(C.accentSide, -0.25)]]);
  ctx.fillRect(-over, y0, PW + over * 2, hh);
  ctx.fillStyle = vgrad(y0, y0 + hh, [[0, rgba(CREAM, 0.25)], [0.3, rgba(CREAM, 0)], [1, rgba(INK, 0.25)]]);
  ctx.fillRect(-over, y0, PW + over * 2, hh);
  const bolts = [];
  for (let x = 6; x < PW; x += 12) bolts.push([x, y0 + hh / 2, 1.7]);
  dots(bolts.map(([a, b, c2]) => [a + 0.6, b + 0.7, c2]), rgba(INK, 0.45));
  dots(bolts, mix(c, CREAM, 0.45));
}

function a2Gauge(x, y, gr, C, r) {
  circle(x + 1.2, y + 1.6, gr + 2, rgba(INK, 0.3));
  circle(x, y, gr + 2, hgrad(x - gr, x + gr, [[0, mix(C.accent, CREAM, 0.3)], [1, shade(C.accent, -0.3)]]));
  circle(x, y, gr, mix(CREAM, C.pipe, 0.18));
  const tk = [];
  for (let k = 0; k < 9; k++) { const a = Math.PI * 0.8 + k * Math.PI * 1.4 / 8; tk.push([x + Math.cos(a) * gr * 0.68, y + Math.sin(a) * gr * 0.68, x + Math.cos(a) * gr * 0.88, y + Math.sin(a) * gr * 0.88]); }
  segs(tk, rgba(INK, 0.55), 0.8);
  const na = Math.PI * (1.15 + r() * 0.8);
  line(x, y, x + Math.cos(na) * gr * 0.78, y + Math.sin(na) * gr * 0.78, mix(C.accent, INK, 0.35), 1.2);
  circle(x, y, 1.4, INK);
  circle(x - gr * 0.35, y - gr * 0.38, gr * 0.28, rgba('#ffffff', 0.35));
}

function a2Handwheel(x, y, rr, C) {
  ellipse(x + 1.5, y + 2, rr, rr, 0, rgba(INK, 0.22));
  ctx.strokeStyle = mix(C.accent, INK, 0.15);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, rr - 1.5, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = mix(C.accent, CREAM, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, rr - 2, Math.PI * 0.95, Math.PI * 1.65);
  ctx.stroke();
  const sp = [];
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - 0.3; sp.push([x, y, x + Math.cos(a) * (rr - 2), y + Math.sin(a) * (rr - 2)]); }
  segs(sp, mix(C.accent, INK, 0.2), 1.6);
  circle(x, y, 2.6, mix(C.pipeLight, CREAM, 0.2));
}

ART2.pipeCap.brasspipe = (C, up) => {
  const c = mix(C.accent, C.pipeDark, 0.12), b = C.pipe, x0 = -PCO, x1 = PW + PCO;
  // breiter Kupferflansch mit Messinglippe zur Lücke
  ctx.fillStyle = hgrad(x0, x1, [[0, mix(c, CREAM, 0.3)], [0.12, mix(c, CREAM, 0.1)], [0.55, c], [0.75, C.accentSide], [1, shade(C.accentSide, -0.25)]]);
  roundRectPath(x0, 0, x1 - x0, PCH, 2.5);
  ctx.fill();
  const ly = up ? 0 : PCH - 7;
  ctx.fillStyle = hgrad(x0, x1, [[0, mix(b, CREAM, 0.35)], [0.15, C.pipeLight], [0.55, b], [0.8, C.pipeSide], [1, shade(C.pipeSide, -0.25)]]);
  ctx.fillRect(x0, ly, x1 - x0, 7);
  ctx.fillStyle = vgrad(ly, ly + 7, [[0, rgba(CREAM, up ? 0.35 : 0.12)], [0.4, rgba(CREAM, 0)], [1, rgba(INK, 0.25)]]);
  ctx.fillRect(x0, ly, x1 - x0, 7);
  if (up) {
    // offenes Rohrende
    ellipse(PW / 2, 2.6, PW / 2 - 5, 2, 0, mix(INK, C.near, 0.4));
    line(6, 3.6, PW - 6, 3.6, rgba(C.pipeLight, 0.4), 0.8);
  }
  // Wulst des Flanschs
  const fy0 = up ? 7 : 0, fy1 = up ? PCH : PCH - 7;
  ctx.fillStyle = vgrad(fy0, fy1, [[0, rgba(CREAM, 0.2)], [0.35, rgba(CREAM, 0)], [1, rgba(INK, 0.3)]]);
  ctx.fillRect(x0, fy0, x1 - x0, fy1 - fy0);
  const bolts = [];
  for (let x = 2; x < PW; x += 11.2) bolts.push([x, (fy0 + fy1) / 2]);
  for (const [bx, by] of bolts) {
    const pts = [];
    for (let j = 0; j < 6; j++) pts.push([bx + Math.cos(j * TAU / 6) * 2.6, by + Math.sin(j * TAU / 6) * 2.6]);
    poly(pts.map(([a, b2]) => [a + 0.7, b2 + 0.9]), rgba(INK, 0.4));
    poly(pts, hgrad(bx - 2.6, bx + 2.6, [[0, mix(b, CREAM, 0.4)], [1, shade(b, -0.3)]]));
  }
  ctx.strokeStyle = rgba(INK, 0.35);
  ctx.lineWidth = 1;
  roundRectPath(x0, 0, x1 - x0, PCH, 2.5);
  ctx.stroke();
  line(x0, up ? 7 : PCH - 7, x1, up ? 7 : PCH - 7, rgba(INK, 0.3), 1);
};

// ============================================================
// ASCHE (13): Schwarz und Orange, verbranntes Land, glimmende Glut.
// Achtung: Dunkelheit mit Sichtradius 300, daher helle Glutkanten an den Säulenenden.
// ============================================================
ART2.sky.ash = (C, S, rng) => {
  const smoke = shade(C.skyTop, -0.15), lit = mix(C.accent, C.skyBottom, 0.5);
  // Feuerschein am Horizont
  ctx.fillStyle = vgrad(330, GROUND_Y, [[0, rgba(C.accent, 0)], [0.6, rgba(C.accent, 0.16)], [1, rgba(mix(C.accent, CREAM, 0.2), 0.3)]]);
  ctx.fillRect(0, 330, W, GROUND_Y - 330);
  // trübe Sonne hinter Rauchbändern
  const sx = S.sunX * W, sy = S.sunY, sun = mix(C.accent, C.skyBottom, 0.4);
  ctx.fillStyle = rgrad(sx, sy, 0, 150, [[0, rgba(sun, 0.22)], [0.4, rgba(sun, 0.07)], [1, rgba(sun, 0)]]);
  ctx.fillRect(sx - 150, sy - 150, 300, 300);
  ctx.fillStyle = rgrad(sx, sy, 0, 36, [[0, rgba(mix(sun, CREAM, 0.2), 0.42)], [0.75, rgba(sun, 0.32)], [1, rgba(sun, 0)]]);
  ctx.fillRect(sx - 36, sy - 36, 72, 72);
  a2Soft(sx - 20, sy + 8, 90, 12, smoke, 0.5, -0.18);
  a2Soft(sx + 26, sy - 16, 60, 6, smoke, 0.35, -0.3);
  // Rauchschwaden: dunkle Ballen, die Unterseiten vom Feuer angeleuchtet
  for (let i = 0, n = Math.round(W / 26); i < n; i++) {
    const x = rng() * (W + 200) - 100, y = 40 + Math.pow(rng(), 0.8) * 300, rx = 50 + rng() * 90, a = 0.25 + rng() * 0.3;
    a2Soft(x, y, rx, rx * (0.32 + rng() * 0.15), smoke, a, -0.25 + rng() * 0.15);
    a2Soft(x + rx * 0.15, y + rx * 0.22, rx * 0.8, rx * 0.12, lit, a * 0.3, -0.2);
  }
  // Rauchsäulen von fernen Bränden, schräg nach rechts oben ziehend
  for (let i = 0, n = Math.max(2, Math.round(W / 300)); i < n; i++) {
    let x = (i + 0.3 + rng() * 0.4) * W / n, y = 470;
    for (let k = 0; k < 9; k++) {
      const rr = 18 + k * 9;
      a2Soft(x, y, rr * 1.4, rr, smoke, 0.32 - k * 0.025, 0);
      if (k < 3) a2Soft(x, y + rr * 0.4, rr * 0.9, rr * 0.4, C.accent, 0.12 - k * 0.03, 0);
      x += 10 + k * 3;
      y -= 26 + k * 4;
    }
  }
  ctx.fillStyle = vgrad(0, 160, [[0, rgba(smoke, 0.6)], [1, rgba(smoke, 0)]]);
  ctx.fillRect(0, 0, W, 160);
};

// Ferne Ebene: verbrannte Hügel mit Baumstümpfen, Feuerfronten und Rauch
ART2.layerExtent.ashRidge = () => [190, GROUND_Y + 14];
ART2.layerTex.ashRidge = () => ({ grain: 0.05, mottle: 0.14, contrast: 1.15 });
ART2.layer.ashRidge = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, f = ridgeFn(P, 490, 150, 0.0035, l.seed), f2 = ridgeFn(P, 500, 70, 0.007, l.seed + 4);
  // hintere Kette, blasser
  ridgePath(f, -8, P + 8, 5, yb);
  ctx.fillStyle = vgrad(340, yb, [[0, mix(col, C.skyBottom, 0.3)], [1, mix(col, C.skyBottom, 0.15)]]);
  ctx.fill();
  // tote Stämme auf dem Kamm
  const stubs = [];
  for (let x = 0; x < P; x += 4 + rng() * 10) {
    if (pnoise(x / P * 20, 20, l.seed + 2) < 0.5) continue;
    const y = f(x) + 1, hh = 5 + rng() * 12;
    stubs.push([x, y, x + (rng() - 0.5) * 2, y - hh]);
    if (rng() < 0.4) stubs.push([x, y - hh * 0.6, x + (rng() - 0.5) * 8, y - hh * 0.9]);
  }
  segs(stubs, mix(col, C.skyBottom, 0.3), 1.2);
  // Feuerfronten: glühende Linien entlang einzelner Kammabschnitte
  for (let k = 0; k < 3; k++) {
    const x0 = (k + rng() * 0.6) * P / 3, len = 50 + rng() * 80;
    wrapEach(x0, P, len + 20, xx => {
      const pts = [];
      for (let x = xx; x <= xx + len; x += 5) pts.push([x, f(x - xx + x0) + 2 + Math.sin(x * 0.3) * 1.2]);
      ctx.fillStyle = rgrad(xx + len / 2, f(x0 + len / 2), 0, len * 0.8, [[0, rgba(C.accent, 0.2)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(xx - len * 0.3, f(x0 + len / 2) - len * 0.8, len * 1.6, len * 1.2);
      a2GlowLine(pts, C, 0.7);
      // Rauch über der Front
      let sx2 = xx + len * 0.5, sy2 = f(x0 + len / 2) - 10;
      for (let j = 0; j < 6; j++) { a2Soft(sx2, sy2, 16 + j * 7, 10 + j * 5, shade(C.skyTop, -0.1), 0.3 - j * 0.04); sx2 += 8; sy2 -= 16; }
    });
  }
  // vordere Kette, dunkler
  ridgePath(f2, -8, P + 8, 5, yb);
  ctx.fillStyle = vgrad(430, yb, [[0, col], [1, shade(col, -0.25)]]);
  ctx.fill();
  ridgeLine(f2, -8, P + 8, 5, 1, rgba(C.accent, 0.18), 1.4);
  // Glutnester in der vorderen Kette
  const nests = [];
  for (let k = 0; k < P / 60; k++) { const x = rng() * P; nests.push([x, f2(x) + 8 + rng() * 40, 0.8 + rng() * 1.2]); }
  dots(nests, rgba(mix(C.accent, CREAM, 0.2), 0.55));
  ctx.fillStyle = vgrad(380, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, 0.45)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 230, P + 16, yb - 230);
  ctx.globalCompositeOperation = 'source-over';
};

// Mittlere Ebene: verkohlte Bäume mit glimmenden Rissen
ART2.layerExtent.charredTrees = () => [200, GROUND_Y + 14];
ART2.layerTex.charredTrees = () => ({ grain: 0.06, mottle: 0.16, contrast: 1.15 });
ART2.layer.charredTrees = (l, i, C, col, rng) => {
  const P = l.P, yb = GROUND_Y + 14, f = ridgeFn(P, 512, 26, 0.006, l.seed), bark = shade(col, -0.25);
  for (let k = 0, n = 8; k < n; k++) {
    const x = (k + 0.5) * P / n + (rng() - 0.5) * 80, hgt = 110 + rng() * 170, w = 7 + rng() * 7, seed = (rng() * 1e6) | 0;
    wrapEach(x, P, hgt * 0.35, xx => a2CharredTree(xx, f(xx) + 6, hgt, w, bark, C, seed));
  }
  // Aschehügel davor
  ridgePath(f, -8, P + 8, 4, yb);
  ctx.fillStyle = vgrad(486, yb, [[0, mix(col, C.far, 0.4)], [1, shade(col, -0.3)]]);
  ctx.fill();
  ridgeLine(f, -8, P + 8, 4, 1, rgba(mix(C.far, CREAM, 0.25), 0.25), 1.4);
  const em = [];
  for (let k = 0; k < P / 30; k++) { const x = rng() * P; em.push([x, f(x) + 5 + rng() * 30, 0.7 + rng()]); }
  for (const [x, y, r] of em) {
    ctx.fillStyle = rgrad(x, y, 0, r * 5, [[0, rgba(C.accent, 0.35)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  }
  dots(em, mix(C.accent, CREAM, 0.35));
};

function a2CharredTree(x, base, hgt, w, bark, C, seed) {
  const r = mulberry32(seed), lean = (r() - 0.5) * hgt * 0.16, top = base - hgt, bend = (r() - 0.5) * w * 2.5;
  const lit = mix(bark, C.far, 0.6), dk = shade(bark, -0.3), tw = w * (0.4 + r() * 0.25);
  // Stamm leicht gekrümmt, oben gesplittert
  ctx.beginPath();
  ctx.moveTo(x - w * 1.6, base + 3);
  ctx.bezierCurveTo(x - w * 0.6, base - hgt * 0.12, x - w * 0.5 + bend, base - hgt * 0.6, x + lean - tw, top + 12);
  ctx.lineTo(x + lean - tw * 0.6, top + 2);
  ctx.lineTo(x + lean - tw * 0.1, top + 9);
  ctx.lineTo(x + lean + tw * 0.3, top - 3);
  ctx.lineTo(x + lean + tw * 0.6, top + 8);
  ctx.lineTo(x + lean + tw, top + 14);
  ctx.bezierCurveTo(x + w * 0.5 + bend, base - hgt * 0.6, x + w * 0.6, base - hgt * 0.12, x + w * 1.6, base + 3);
  ctx.closePath();
  ctx.fillStyle = hgrad(x - w, x + w, [[0, lit], [0.4, bark], [1, dk]]);
  ctx.fill();
  // Krokodilhaut der Holzkohle
  ctx.save();
  ctx.clip();
  const cr = [];
  for (let y = top + 6; y < base; y += 6 + r() * 4) cr.push([x - w * 1.5, y, x + w * 1.5, y + (r() - 0.5) * 2]);
  segs(cr, rgba(INK, 0.35), 0.8);
  // Glutriss im Stamm
  if (r() < 0.6) {
    let px = x + lean * 0.5 + (r() - 0.5) * w * 0.4, py = base - 6;
    const pts = [[px, py]];
    while (py > base - hgt * (0.35 + r() * 0.3)) { px += (r() - 0.5) * w * 0.35; py -= 6 + r() * 8; pts.push([px, py]); }
    a2GlowLine(pts, C, 0.6);
  }
  ctx.restore();
  // abgebrochene, geknickte Äste, nur wenige Enden glimmen
  for (let k = 0, n = 3 + Math.floor(r() * 3); k < n; k++) {
    const t = 0.3 + r() * 0.6, side = r() < 0.5 ? -1 : 1, bx = x + lean * t + bend * Math.sin(t * Math.PI) * 0.6, by = base - hgt * t, len = (14 + r() * 30) * (1.1 - t * 0.5);
    const kx = bx + side * len * 0.55, ky = by - len * (0.15 + r() * 0.3), ex = kx + side * len * (0.3 + r() * 0.3), ey = ky - len * (0.2 + r() * 0.5);
    ctx.strokeStyle = bark;
    ctx.lineWidth = Math.max(1.4, w * 0.32 * (1 - t * 0.5));
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(kx, ky);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (r() < 0.5) {
      ctx.lineWidth = Math.max(1, w * 0.15);
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx + side * len * 0.25, ky + len * 0.12);
      ctx.stroke();
    }
    if (r() < 0.25) {
      ctx.fillStyle = rgrad(ex, ey, 0, 5, [[0, rgba(C.accent, 0.45)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(ex - 5, ey - 5, 10, 10);
      circle(ex, ey, 0.9, mix(C.accent, CREAM, 0.35));
    }
  }
  // Glutschein am Fuß
  ctx.fillStyle = rgrad(x, base, 0, w * 3, [[0, rgba(C.accent, 0.22)], [1, rgba(C.accent, 0)]]);
  ctx.fillRect(x - w * 3, base - w * 3, w * 6, w * 3.5);
}

// Vordergrund: verkohlte Stümpfe, schwelende Scheite, Aschehaufen mit Glut
ART2.prop.cinders = { h: 86, paint: (x, base, s, r, v, C, col) => a2CinderProp(x, base, s, r, v, C, col) };
function a2CinderProp(x, base, s, r, v, C, col) {
  const coal = mix(col, INK, 0.2), lit = mix(col, C.far, 0.8), ash = mix(C.far, CREAM, 0.2);
  if (v < 0.3) {
    // verkohlter Stumpf mit glühendem Kern
    const sw = (10 + r() * 6) * s, sh = (22 + r() * 22) * s;
    ellipse(x + 8, base - 1, sw * 1.8, 3.5 * s, 0, rgba(INK, 0.3));
    const top = [];
    for (let k = 0; k <= 6; k++) top.push([x - sw + k * sw / 3, base - sh + (k % 2 ? -5 : 2) * s * (0.5 + r())]);
    a2Path([[x - sw * 1.3, base + 2], ...top, [x + sw * 1.3, base + 2]], true);
    ctx.fillStyle = hgrad(x - sw, x + sw, [[0, lit], [0.45, coal], [1, shade(coal, -0.4)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const cr = [];
    for (let y = base - sh; y < base; y += 5) cr.push([x - sw * 1.3, y, x + sw * 1.3, y + (r() - 0.5) * 2]);
    segs(cr, rgba(INK, 0.4), 0.8);
    let px = x + (r() - 0.5) * sw * 0.5, py = base;
    const pts = [[px, py]];
    while (py > base - sh * 0.8) { px += (r() - 0.5) * 5; py -= 5 + r() * 5; pts.push([px, py]); }
    a2GlowLine(pts, C, 0.8);
    ctx.restore();
    ctx.fillStyle = rgrad(x, base - sh, 0, sw * 1.4, [[0, rgba(C.accent, 0.45)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - sw * 1.4, base - sh - sw * 1.4, sw * 2.8, sw * 2.2);
  } else if (v < 0.55) {
    // schwelender Scheit, quer liegend
    const lw = (20 + r() * 14) * s, lh = (6 + r() * 3) * s;
    ctx.fillStyle = rgrad(x, base - 2, 0, lw * 1.3, [[0, rgba(C.accent, 0.28)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - lw * 1.3, base - lw, lw * 2.6, lw + 4);
    ctx.save();
    ctx.translate(x, base - lh);
    ctx.rotate((r() - 0.5) * 0.25);
    roundRectPath(-lw, -lh, lw * 2, lh * 2, lh);
    ctx.fillStyle = vgrad(-lh, lh, [[0, lit], [0.5, coal], [1, shade(coal, -0.4)]]);
    ctx.fill();
    const seams = [];
    for (let k = -lw + 4; k < lw - 3; k += 4 + r() * 4) seams.push([k, -lh + 1, k + (r() - 0.5) * 3, lh - 1]);
    segs(seams, rgba(INK, 0.45), 0.9);
    for (const sg of seams.filter(() => r() < 0.4)) a2GlowLine([[sg[0], sg[1] + lh * 0.6], [sg[2], sg[3]]], C, 0.6);
    ellipse(lw - 1, 0, lh * 0.4, lh * 0.9, 0, mix(C.accent, coal, 0.4));
    ctx.restore();
  } else if (v < 0.8) {
    // Aschehaufen mit Glutpunkten
    const aw = (16 + r() * 12) * s, ah = (8 + r() * 8) * s;
    ctx.beginPath();
    ctx.moveTo(x - aw, base + 2);
    ctx.quadraticCurveTo(x - aw * 0.3, base - ah * 1.6, x + aw * 0.1, base - ah);
    ctx.quadraticCurveTo(x + aw * 0.6, base - ah * 0.5, x + aw, base + 2);
    ctx.closePath();
    ctx.fillStyle = vgrad(base - ah, base, [[0, mix(ash, CREAM, 0.12)], [1, shade(ash, -0.3)]]);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const ex = x + (r() - 0.5) * aw * 1.2, ey = base - r() * ah * 0.7;
      ctx.fillStyle = rgrad(ex, ey, 0, 5, [[0, rgba(C.accent, 0.5)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(ex - 5, ey - 5, 10, 10);
      circle(ex, ey, 0.9, mix(C.accent, CREAM, 0.5));
    }
  } else {
    // verkohlter Ast ragt aus dem Boden
    const hh = (30 + r() * 26) * s, lean = (r() - 0.5) * 18 * s;
    ctx.strokeStyle = coal;
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(x, base + 2);
    ctx.quadraticCurveTo(x + lean * 0.3, base - hh * 0.5, x + lean, base - hh);
    ctx.stroke();
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.4, base - hh * 0.55);
    ctx.lineTo(x + lean * 0.4 + 10 * s, base - hh * 0.75);
    ctx.stroke();
    ctx.fillStyle = rgrad(x + lean, base - hh, 0, 7, [[0, rgba(C.accent, 0.55)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x + lean - 7, base - hh - 7, 14, 14);
    circle(x + lean, base - hh, 1.3, mix(C.accent, CREAM, 0.45));
  }
}

// Boden: Ascheschicht über verbrannter Erde, Glutnester und glühende Risse
ART2.ground.ashland = (P, y, C, rng, band) => {
  const soil = mix(C.near, INK, 0.15), ash = mix(C.far, CREAM, 0.2);
  band(vgrad(y, H, [[0, shade(soil, 0.1)], [1, shade(soil, -0.35)]]), y + 6, H - y);
  // glühende Risse in der Erde
  for (let k = 0; k < P / 90; k++) {
    let x = rng() * P, yy = y + 18 + rng() * 10;
    const pts = [[x, yy]];
    for (let j = 0; j < 6; j++) { x += 6 + rng() * 10; yy += (rng() - 0.5) * 8; pts.push([x, clamp(yy, y + 14, H - 4)]); }
    wrapEach(pts[0][0], P, x - pts[0][0] + 8, xx => a2GlowLine(pts.map(([a, b]) => [a + xx - pts[0][0], b]), C, 0.7));
  }
  // Glutnester, halb unter Asche
  for (let k = 0; k < P / 110; k++) {
    const x = rng() * P, yy = y + 28 + rng() * 18, rx = 10 + rng() * 12, seed = (rng() * 1e6) | 0;
    wrapEach(x, P, rx * 2, xx => {
      const r = mulberry32(seed);
      ctx.fillStyle = rgrad(xx, yy, 0, rx * 2, [[0, rgba(C.accent, 0.3)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(xx - rx * 2, yy - rx * 2, rx * 4, rx * 4);
      const coals = [];
      for (let j = 0; j < 6; j++) coals.push([xx + (r() - 0.5) * rx * 1.6, yy + (r() - 0.5) * 5, 1.6 + r() * 2.4, 1.2 + r() * 1.6, 0]);
      ellipses(coals, mix(C.near, INK, 0.3));
      ellipses(coals.map(([a, b, c2, d]) => [a - 0.4, b - 0.3, c2 * 0.6, d * 0.6, 0]), mix(C.accent, CREAM, 0.25));
    });
  }
  // verkohlte Zweige
  const tw = [];
  for (let k = 0; k < P / 24; k++) { const x = rng() * P, yy = y + 10 + rng() * 40, a = rng() * Math.PI; tw.push([x, yy, x + Math.cos(a) * (4 + rng() * 8), yy + Math.sin(a) * 2]); }
  segs(tw, rgba(INK, 0.7), 1.3);
  // Aschedecke mit weichen, flachen Wehen an der Kante
  const drift = [];
  for (let x = -10; x < P + 10;) { const rr = 9 + rng() * 14; drift.push([x, y + rr - 3 - rng() * 3, rr]); x += rr * (1 + rng() * 0.8); }
  const all = drift.concat(drift.filter(d => d[0] < 30).map(d => [d[0] + P, d[1], d[2]]), drift.filter(d => d[0] > P - 30).map(d => [d[0] - P, d[1], d[2]]));
  ctx.save();
  ctx.beginPath();
  ctx.rect(-10, y - 18, P + 20, 30);
  ctx.clip();
  blobPath(all.map(([a, b, c2]) => [a + 1.5, b + 2, c2]));
  ctx.fillStyle = rgba(INK, 0.35);
  ctx.fill();
  blobPath(all);
  ctx.fillStyle = vgrad(y - 8, y + 12, [[0, mix(ash, CREAM, 0.15)], [1, shade(ash, -0.25)]]);
  ctx.fill();
  ctx.restore();
  band(vgrad(y + 8, y + 14, [[0, shade(ash, -0.25)], [1, rgba(soil, 0)]]), y + 8, 6);
  // Funken in der Asche
  const sp = [];
  for (let k = 0; k < P / 16; k++) sp.push([rng() * P, y - 2 + rng() * 10, 0.5 + rng() * 0.7]);
  dots(sp, rgba(mix(C.accent, CREAM, 0.3), 0.7));
};

// Säule: verkohlter Kohlestein mit Krokodilhaut-Rissen, einige Fugen glühen
ART2.pipeBody.coal = (C, h, v, r) => {
  const c = mix(C.pipe, INK, 0.3);
  columnBase(h, c, shade(c, -CONFIG.SIDE_DARKEN), mix(c, C.pipeLight, 0.4));
  // Krokodilhaut der Holzkohle: verschobenes Eckpunktgitter, jede Platte gewölbt
  const xs = [0, 14, 29, 44, PW], rows = [];
  for (let y = -6; y < h + 18; y += 11 + r() * 6) rows.push(xs.map((x, k) => [k === 0 || k === xs.length - 1 ? x : x + (r() - 0.5) * 7, y + (r() - 0.5) * 5]));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, PW, h);
  ctx.clip();
  const gloss = [], edges = [];
  for (let j = 0; j < rows.length - 1; j++) {
    for (let k = 0; k < xs.length - 1; k++) {
      const a = rows[j][k], b = rows[j][k + 1], c2 = rows[j + 1][k + 1], d = rows[j + 1][k];
      const t = (a[0] + b[0]) / 2 / PW, cx = (a[0] + b[0] + c2[0] + d[0]) / 4, cy = (a[1] + b[1] + c2[1] + d[1]) / 4;
      // Schattenhälfte unten rechts, Lichthälfte oben links
      poly([b, c2, d, [cx + 1, cy + 1]], rgba(INK, 0.2 + t * 0.14));
      poly([d, a, b, [cx - 1, cy - 1]], rgba(CREAM, 0.035 + (1 - t) * 0.04));
      if (t < 0.75) gloss.push([a[0] + 3, a[1] + 3, lerp(a[0], b[0], 0.55), lerp(a[1], b[1], 0.55) + 2.5]);
      // Kanten: oben (manche fehlen, dann verschmelzen Platten) und links
      if (r() > 0.18 || j === 0) edges.push([a, b, r() < 0.13]);
      if (k > 0 && r() > 0.12) edges.push([a, d, r() < 0.18]);
    }
  }
  segs(gloss, rgba(mix(CREAM, C.pipeLight, 0.4), 0.18), 1);
  segs(edges.map(([p, q]) => [p[0], p[1], q[0], q[1]]), rgba(mix(INK, C.near, 0.2), 0.85), 1.8);
  // glühende Fugen: Teilstücke mit leichtem Knick, mit Schein
  const hot = [];
  for (const [p, q, isHot] of edges) {
    if (!isHot) continue;
    const a = r() * 0.3, b = a + 0.45 + r() * 0.25;
    const p0 = [lerp(p[0], q[0], a), lerp(p[1], q[1], a)], p1 = [lerp(p[0], q[0], b), lerp(p[1], q[1], b)];
    hot.push([p0, [(p0[0] + p1[0]) / 2 + (r() - 0.5) * 1.5, (p0[1] + p1[1]) / 2 + (r() - 0.5) * 1.5], p1]);
  }
  for (const pts of hot) {
    const mx = pts[1][0], my = pts[1][1];
    ctx.fillStyle = rgrad(mx, my, 0, 10, [[0, rgba(C.accent, 0.22)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(mx - 10, my - 10, 20, 20);
  }
  for (const pts of hot) a2GlowLine(pts, C, 0.55 + r() * 0.3);
  for (let y0 = 60 + v * 80 + r() * 40; y0 < h; y0 += 150 + r() * 80) {
    let px = 10 + r() * 30, py = y0;
    const pts = [[px, py]];
    for (let j = 0; j < 5; j++) { px = clamp(px + (r() - 0.45) * 12, 4, PW - 6); py += 6 + r() * 9; pts.push([px, py]); }
    ctx.fillStyle = rgrad(px, (y0 + py) / 2, 0, 26, [[0, rgba(C.accent, 0.16)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(px - 26, y0 - 10, 52, py - y0 + 20);
    a2GlowLine(pts, C, 0.9);
  }
  // Funkenstaub
  const sp = [];
  for (let k = 0; k < h / 12; k++) sp.push([2 + r() * (PW - 4), r() * h, 0.4 + r() * 0.5]);
  dots(sp, rgba(mix(C.accent, CREAM, 0.3), 0.45));
  ctx.restore();
  // Außenkanten
  ctx.fillStyle = rgba(CREAM, 0.12);
  ctx.fillRect(0, 0, 1.2, h);
  ctx.fillStyle = rgba(INK, 0.35);
  ctx.fillRect(PW - 1.2, 0, 1.2, h);
};

ART2.pipeCap.coal = (C, up) => {
  const c = mix(C.pipe, INK, 0.18), x0 = -PCO, x1 = PW + PCO, r = mulberry32(up ? 1301 : 1302);
  capBase(c, shade(c, -CONFIG.SIDE_DARKEN), mix(c, C.pipeLight, 0.5), 3);
  // zwei Reihen gewölbter Kohleplatten wie am Körper
  ctx.save();
  roundRectPath(x0, 0, x1 - x0, PCH, 3);
  ctx.clip();
  const xs = [x0, 9, 21, 33, 45, 56, x1], rows = [-1, 11 + (r() - 0.5) * 3, PCH + 1].map((y, j) => xs.map((x, k) => [k === 0 || k === xs.length - 1 || j !== 1 ? x + (j === 1 ? 0 : (r() - 0.5) * 3) : x + (r() - 0.5) * 5, j === 1 ? y + (r() - 0.5) * 3 : y]));
  const edges = [];
  for (let j = 0; j < 2; j++) {
    for (let k = 0; k < xs.length - 1; k++) {
      const a = rows[j][k], b = rows[j][k + 1], c2 = rows[j + 1][k + 1], d = rows[j + 1][k], t = (a[0] + b[0]) / 2 / PW;
      const cx = (a[0] + b[0] + c2[0] + d[0]) / 4, cy = (a[1] + b[1] + c2[1] + d[1]) / 4;
      poly([b, c2, d, [cx + 1, cy + 1]], rgba(INK, 0.18 + t * 0.14));
      poly([d, a, b, [cx - 1, cy - 1]], rgba(CREAM, 0.04 + (1 - t) * 0.04));
      if (k > 0) edges.push([a, d]);
    }
  }
  edges.push(...rows[1].slice(0, -1).map((p, k) => [p, rows[1][k + 1]]));
  segs(edges.map(([p, q]) => [p[0], p[1], q[0], q[1]]), rgba(mix(INK, C.near, 0.2), 0.85), 1.6);
  ctx.restore();
  // heiße Kante zur Lücke: deutlich sichtbar, auch im Dunkeln, Glut kriecht in die Fugen
  const ey = up ? 0 : PCH - 6;
  ctx.fillStyle = vgrad(ey, ey + 6, up ? [[0, C.accentLight], [0.5, rgba(C.accent, 0.9)], [1, rgba(C.accent, 0)]] : [[0, rgba(C.accent, 0)], [0.5, rgba(C.accent, 0.9)], [1, C.accentLight]]);
  ctx.fillRect(x0 + 1, ey, x1 - x0 - 2, 6);
  const near = up ? 0 : 2;
  for (let k = 1; k < xs.length - 1; k++) {
    if (r() < 0.4) continue;
    const a = rows[near][k], b = rows[1][k];
    a2GlowLine([[a[0], up ? 1 : PCH - 1], [lerp(a[0], b[0], 0.5) + (r() - 0.5) * 2, lerp(up ? 1 : PCH - 1, b[1], 0.6)]], C, 0.6);
  }
  line(x0 + 2, up ? 0.8 : PCH - 0.8, x1 - 2, up ? 0.8 : PCH - 0.8, mix(C.accentLight, CREAM, 0.4), 1.2);
  // Schatten zum Körper
  ctx.fillStyle = rgba(INK, 0.35);
  ctx.fillRect(x0, up ? PCH - 4 : 0, x1 - x0, 4);
};

// ============================================================
// Level-Zuordnung (nur Darstellung, Spielwerte bleiben unverändert)
// ============================================================
const levelByName = n => LEVELS.find(L => L.name === n);
Object.assign(levelByName('Sumpf'), {
  sky: { body: 'none', sunX: 0.3, sunY: 140, extra: 'swamp' },
  layers: [
    { kind: 'swampTrees', P: 1000, seed: 91 },
    { kind: 'swampBank', P: 1200, seed: 92 },
    { kind: 'props', P: 1400, prop: 'bog', spacing: 40, seed: 93 }
  ]
});
levelByName('Sumpf').style.pipe = 'bogpost';
levelByName('Sumpf').style.ground = 'bog';

Object.assign(levelByName('Kristall'), {
  sky: { body: 'none', sunX: 0.74, sunY: 104, extra: 'crystal' },
  layers: [
    { kind: 'crystalPeaks', P: 1000, seed: 111 },
    { kind: 'crystalSpires', P: 1200, seed: 112 },
    { kind: 'props', P: 1400, prop: 'geode', spacing: 50, seed: 113 }
  ]
});
levelByName('Kristall').style.pipe = 'prism';
levelByName('Kristall').style.ground = 'crystalrock';

Object.assign(levelByName('Wolken'), {
  sky: { body: 'none', sunX: 0.26, sunY: 100, extra: 'clouds' },
  layers: [
    { kind: 'cloudTowers', P: 1000, seed: 121 },
    { kind: 'cloudSea', P: 1200, seed: 122 },
    { kind: 'cloudFront', P: 1400, seed: 123 }
  ]
});
levelByName('Wolken').style.pipe = 'marble';
levelByName('Wolken').style.ground = 'cloudfloor';

Object.assign(levelByName('Uhrwerk'), {
  sky: { body: 'none', sunX: 0.68, sunY: 238, extra: 'clockwork' },
  layers: [
    { kind: 'gearWall', P: 1000, seed: 131 },
    { kind: 'steamworks', P: 1200, seed: 132 },
    { kind: 'props', P: 1400, prop: 'clockjunk', spacing: 70, seed: 133 }
  ]
});
levelByName('Uhrwerk').style.pipe = 'brasspipe';
levelByName('Uhrwerk').style.ground = 'clockfloor';

Object.assign(levelByName('Asche'), {
  sky: { body: 'none', sunX: 0.72, sunY: 176, extra: 'ash' },
  layers: [
    { kind: 'ashRidge', P: 1000, seed: 141 },
    { kind: 'charredTrees', P: 1200, seed: 142 },
    { kind: 'props', P: 1400, prop: 'cinders', spacing: 56, seed: 143 }
  ]
});
levelByName('Asche').style.pipe = 'coal';
levelByName('Asche').style.ground = 'ashland';

