// ============================================================
// Texturen und Caches. Alles Statische (Himmel, Ebenen, Boden,
// Säulen, Tore, Vogel) wird einmal pro Level und Auflösung
// vorgerendert. Pro Frame bleiben wenige drawImage-Aufrufe.
// ============================================================
let frame = 0;
const TEX = { fine: null };
// Erweiterungen für weitere Biome: Malfunktionen werden hier nach Art registriert
const ART2 = { sky: {}, layer: {}, layerExtent: {}, layerTex: {}, ground: {}, pipeBody: {}, pipeCap: {}, boss: {}, projectile: {}, prop: {} };

// Feines Korn: zufällige Pixel, schwarz oder weiß mit Alpha. Nahtstellen fallen bei
// weißem Rauschen nicht auf, deshalb reicht eine feste Kachel in Gerätepixeln.
function buildFineTile() {
  const n = 256, c = newCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n), d = img.data, rng = mulberry32(7);
  for (let i = 0; i < n * n; i++) {
    const v = rng() * 2 - 1, p = i * 4;
    d[p] = d[p + 1] = d[p + 2] = v > 0 ? 255 : 0;
    d[p + 3] = Math.round(Math.abs(v) * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Weiche Flecken: Wertrauschen in niedriger Auflösung (ein Wert pro 3 logische Pixel),
// horizontal periodisch über die ganze Breite, damit gekachelte Streifen nahtlos bleiben.
// Ergebnisse werden pro Größe und Seed wiederverwendet.
const mottleCache = new Map();
function mottleCanvas(wl, hl, cellsX, seed, contrast) {
  const w = Math.max(8, Math.round(wl / 3)), h = Math.max(4, Math.round(hl / 3));
  const key = w + 'x' + h + ':' + cellsX + ':' + seed + ':' + contrast;
  const hit = mottleCache.get(key);
  if (hit) return hit;
  const c = newCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data, acc = new Float32Array(w * h);
  const oct = [[cellsX, 0.62], [cellsX * 2 + 1, 0.28], [cellsX * 5 + 2, 0.1]];
  oct.forEach(([cx, amp], idx) => {
    const cy = Math.max(2, Math.round(cx * h / w) + 1), rng = mulberry32(seed * 97 + idx * 13 + 5);
    const vals = new Float32Array(cx * (cy + 1));
    for (let i = 0; i < vals.length; i++) vals[i] = rng();
    const xi0 = new Int32Array(w), xi1 = new Int32Array(w), xs = new Float32Array(w);
    for (let x = 0; x < w; x++) { const u = x / w * cx, i0 = Math.floor(u), f = u - i0; xi0[x] = i0; xi1[x] = (i0 + 1) % cx; xs[x] = f * f * (3 - 2 * f); }
    for (let y = 0; y < h; y++) {
      const t = y / h * cy, j0 = Math.floor(t), ft = t - j0, st = ft * ft * (3 - 2 * ft), j1 = Math.min(j0 + 1, cy);
      const r0 = j0 * cx, r1 = j1 * cx, row = y * w;
      for (let x = 0; x < w; x++) {
        const a = vals[r0 + xi0[x]], b = vals[r0 + xi1[x]], e = vals[r1 + xi0[x]], f2 = vals[r1 + xi1[x]], sx = xs[x];
        const top = a + (b - a) * sx, bot = e + (f2 - e) * sx;
        acc[row + x] += amp * (top + (bot - top) * st);
      }
    }
  });
  for (let i = 0; i < w * h; i++) {
    const s2 = clamp((acc[i] - 0.5) * 2 * contrast, -1, 1), p = i * 4;
    d[p] = d[p + 1] = d[p + 2] = s2 > 0 ? 255 : 0;
    d[p + 3] = Math.round(Math.abs(s2) * 255);
  }
  g.putImageData(img, 0, 0);
  if (mottleCache.size > 80) mottleCache.clear();
  mottleCache.set(key, c);
  return c;
}

// Textur nur auf bereits gezeichnete Pixel legen (source-atop), in Gerätepixeln
function texturize(c, opt) {
  const g = c.getContext('2d');
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  if (opt.mottle) {
    const m = mottleCanvas(opt.wl || c.width, opt.hl || c.height, opt.cells || 8, opt.seed || 1, opt.contrast || 1);
    g.globalAlpha = opt.mottle;
    g.imageSmoothingEnabled = true;
    g.drawImage(m, 0, 0, c.width, c.height);
  }
  if (opt.grain) {
    if (!TEX.fine) TEX.fine = buildFineTile();
    g.globalAlpha = opt.grain;
    g.fillStyle = g.createPattern(TEX.fine, 'repeat');
    g.fillRect(0, 0, c.width, c.height);
  }
  g.restore();
}

// Browser rastern Zeichenbefehle oft erst beim ersten Gebrauch. Ein Zug in ein 1x1-Canvas
// erzwingt das sofort, damit die Kosten im Bauschritt anfallen und nicht mitten im Spiel.
let warmCtx = null;
function warmUp(c) {
  if (!warmCtx) warmCtx = newCanvas(1, 1).getContext('2d');
  try { warmCtx.drawImage(c, 0, 0, 1, 1); } catch (e) { /* ohne Aufwärmen weiter */ }
  return c;
}

function setupG(g) {
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// Leinwand mit logischem Koordinatensystem bemalen: (ox, oy) landet bei Gerätepixel 0
function paintCanvas(c, sx, sy, ox, oy, fn) {
  const g = c.getContext('2d');
  g.setTransform(sx, 0, 0, sy, -ox * sx, -oy * sy);
  setupG(g);
  withCtx(g, fn);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// Periodischer Streifen der Breite P (logisch) zwischen y0 und y1
function makeStrip(P, y0, y1, ks, paint, tex) {
  const wd = Math.max(16, Math.round(P * ks)), hd = Math.max(2, Math.ceil((y1 - y0) * ks));
  const c = newCanvas(wd, hd), kx = wd / P;
  paintCanvas(c, kx, ks, 0, y0, paint);
  if (tex) texturize(c, Object.assign({ cells: Math.max(4, Math.round(P / 70)), wl: P, hl: y1 - y0 }, tex));
  warmUp(c);
  return { c, P, y0, y1, ks, kx, wd, hd };
}

// Sprite mit eigenem Ursprung: logischer Bereich [x0, x0 + w] x [y0, y0 + h]
function makeSprite(x0, y0, w, h, ks, paint, tex) {
  const c = newCanvas(Math.ceil(w * ks), Math.ceil(h * ks));
  paintCanvas(c, ks, ks, x0, y0, paint);
  if (tex) texturize(c, Object.assign({ cells: Math.max(2, Math.round(w / 40)), wl: w, hl: h }, tex));
  warmUp(c);
  return { c, x0, y0, w, h, ks };
}

// ---------- Zeichenwerkzeuge für die Caches ----------
const vgrad = (y0, y1, stops) => { const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const hgrad = (x0, x1, stops) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const rgrad = (x, y, r0, r1, stops, fx, fy) => { const g = ctx.createRadialGradient(fx === undefined ? x : fx, fy === undefined ? y : fy, r0, x, y, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };

function ridgeFn(P, base, amp, freq, seed) {
  const c1 = Math.max(1, Math.round(P * freq)), c2 = c1 * 2 + 1, c3 = c1 * 5 + 3;
  return x => {
    const u = x / P;
    return base - amp * (0.6 * pnoise(u * c1, c1, seed) + 0.3 * pnoise(u * c2, c2, seed + 1) + 0.1 * pnoise(u * c3, c3, seed + 2));
  };
}
function ridgePath(fy, x0, x1, step, yClose) {
  ctx.beginPath();
  ctx.moveTo(x0, yClose);
  for (let x = x0; x < x1; x += step) ctx.lineTo(x, fy(x));
  ctx.lineTo(x1, fy(x1));
  ctx.lineTo(x1, yClose);
  ctx.closePath();
}
function ridgeLine(fy, x0, x1, step, dy, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x0, fy(x0) + dy);
  for (let x = x0 + step; x < x1; x += step) ctx.lineTo(x, fy(x) + dy);
  ctx.lineTo(x1, fy(x1) + dy);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}
function dots(list, color) {
  if (!list.length) return;
  ctx.beginPath();
  for (const d of list) { ctx.moveTo(d[0] + d[2], d[1]); ctx.arc(d[0], d[1], Math.max(0.1, d[2]), 0, TAU); }
  ctx.fillStyle = color;
  ctx.fill();
}
function segs(list, color, lw) {
  if (!list.length) return;
  ctx.beginPath();
  for (const s of list) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}
function ellipses(list, color) {
  if (!list.length) return;
  ctx.beginPath();
  for (const e of list) {
    ctx.moveTo(e[0] + Math.cos(e[4] || 0) * e[2], e[1] + Math.sin(e[4] || 0) * e[2]);
    ctx.ellipse(e[0], e[1], Math.max(0.1, e[2]), Math.max(0.1, e[3]), e[4] || 0, 0, TAU);
  }
  ctx.fillStyle = color;
  ctx.fill();
}
// Element an x und an seinen periodischen Kopien zeichnen, falls es über den Rand ragt
function wrapEach(x, P, pad, fn) {
  fn(x);
  if (x - pad < 0) fn(x + P);
  if (x + pad > P) fn(x - P);
}
// Blob aus Kreisen als ein Pfad (nonzero füllt die Vereinigung)
function blobPath(list) {
  ctx.beginPath();
  for (const [x, y, r] of list) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
}

// ============================================================
// Himmel: ein statisches Vollbild pro Level
// ============================================================
function buildSky(li, ks) {
  const c = newCanvas(W * ks, H * ks);
  c.logicalW = W;
  paintCanvas(c, c.width / W, c.height / H, 0, 0, () => paintSky(li));
  texturize(c, { grain: 0.035 });
  return warmUp(c);
}

function paintSky(li) {
  const L = LEVELS[li], C = COLORS[li], S = L.sky;
  ctx.fillStyle = vgrad(0, GROUND_Y, [[0, C.skyTop], [0.55, mix(C.skyTop, C.skyBottom, 0.62)], [1, C.skyBottom]]);
  ctx.fillRect(0, 0, W, H);
  const rng = mulberry32(li * 1000 + 77);
  if (S.nebula) skyNebula(C, rng);
  if (S.stars) skyStars(C, S.stars, rng);
  if (S.aurora) skyAurora(C);
  if (S.glow) skyGlow(C);
  if (S.smoke) skySmoke(C, rng);
  if (S.caveGlow) skyCave(C, rng);
  if (S.stormClouds) skyStorm(C, rng);
  if (S.cirrus) skyCirrus(C, rng);
  if (S.body === 'sun') skySun(C, S);
  else if (S.body === 'moon') skyMoon(C);
  else if (S.body === 'planet') skyPlanet(C, rng);
  if (S.rays) skyRays(C, L);
  if (S.surface) skySurface(C, rng);
  if (S.haze) skyHaze(C);
  if (S.rain) skyRain(C, rng);
  if (S.extra && ART2.sky[S.extra]) ART2.sky[S.extra](C, S, rng, L);
}

function skySun(C, S) {
  const x = S.sunX <= 1 ? S.sunX * W : S.sunX, y = S.sunY, r = S.big ? 34 : 27;
  const col = S.pale ? mix(CREAM, C.skyBottom, 0.25) : mix(CREAM, '#ffd27a', S.big ? 0.3 : 0.45);
  ctx.fillStyle = rgrad(x, y, 0, 190, [[0, rgba(col, 0.45)], [0.3, rgba(col, 0.16)], [1, rgba(col, 0)]]);
  ctx.fillRect(x - 190, y - 190, 380, 380);
  ctx.fillStyle = rgrad(x, y, r * 0.8, r * 2.2, [[0, rgba(CREAM, 0.55)], [1, rgba(CREAM, 0)]]);
  ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  circle(x, y, r, rgrad(x, y, 0, r, [[0, mix(CREAM, '#ffffff', 0.6)], [0.7, mix(col, CREAM, 0.45)], [1, col]], x - r * 0.3, y - r * 0.3));
}

function skyMoon(C) {
  const x = Math.round(W * 0.78), y = 96, r = 24, col = mix(CREAM, C.pipe, 0.12);
  ctx.fillStyle = rgrad(x, y, r, 120, [[0, rgba(C.pipe, 0.22)], [1, rgba(C.pipe, 0)]]);
  ctx.fillRect(x - 120, y - 120, 240, 240);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  circle(x, y, r, rgrad(x, y, 0, r, [[0, mix(col, '#ffffff', 0.4)], [1, shade(col, -0.12)]], x - 8, y - 8));
  dots([[x - 8, y + 6, 4], [x + 2, y - 9, 3], [x - 12, y - 6, 2.2], [x + 6, y + 10, 2.4]], rgba(INK, 0.12));
  circle(x + 13, y - 8, r * 0.95, mix(C.skyTop, C.skyBottom, y / GROUND_Y * 0.9));
  ctx.restore();
}

function skyPlanet(C, rng) {
  const x = Math.round(W * 0.8), y = 360, r = 132;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.28);
  ctx.strokeStyle = rgba(C.pipe, 0.32);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.62, r * 0.33, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(CREAM, 0.12);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.5, r * 0.29, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.restore();
  circle(x, y, r, rgrad(x, y, r * 0.1, r, [[0, mix(C.far, C.accent, 0.42)], [0.55, C.far], [1, shade(C.far, -0.6)]], x - r * 0.5, y - r * 0.55));
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-0.28);
  for (let k = -5; k <= 5; k++) {
    ctx.fillStyle = rgba(k % 2 ? INK : mix(C.accent, CREAM, 0.4), k % 2 ? 0.12 : 0.07);
    ctx.beginPath();
    ctx.ellipse(0, k * 24 + rng() * 6, r * 1.3, 5 + rng() * 7, 0, 0, TAU);
    ctx.fill();
  }
  ellipse(-30, 40, 22, 10, 0, rgba(C.accent, 0.18));
  ctx.restore();
  ctx.strokeStyle = rgba(mix(C.accent, CREAM, 0.3), 0.55);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.5, Math.PI * 1.02, Math.PI * 1.6);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.28);
  ctx.strokeStyle = rgba(C.pipe, 0.55);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.62, r * 0.33, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = rgba(CREAM, 0.25);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.5, r * 0.29, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function skyNebula(C, rng) {
  const blobs = [[70, 150, 170, C.far, 0.6], [260, 70, 130, C.accent, 0.14], [350, 240, 190, C.far, 0.45],
    [150, 320, 150, mix(C.skyBottom, C.accent, 0.2), 0.5], [40, 420, 120, C.far, 0.35], [230, 200, 90, mix(C.accent, CREAM, 0.3), 0.08]];
  const fx = W / 400;
  for (const [x0, y, r, col, a] of blobs) {
    const x = x0 * fx;
    ctx.fillStyle = rgrad(x, y, 0, r, [[0, rgba(col, a)], [0.6, rgba(col, a * 0.35)], [1, rgba(col, 0)]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // dunkle Staubbahn
  ctx.save();
  ctx.translate(W / 2, 260);
  ctx.rotate(-0.5 * Math.min(1, 400 / W));
  ctx.transform(fx, 0, 0, 0.18, 0, 0);
  ctx.fillStyle = rgrad(0, 0, 0, 260, [[0, rgba(INK, 0.35)], [1, rgba(INK, 0)]]);
  ctx.fillRect(-260, -260, 520, 520);
  ctx.restore();
}

function skyStars(C, density, rng) {
  const n = Math.round(220 * density), small = [], mid = [], big = [];
  for (let i = 0; i < n; i++) {
    const x = rng() * W, y = rng() * (GROUND_Y - 40), s = rng();
    if (s < 0.75) small.push([x, y, 0.45 + rng() * 0.35]);
    else if (s < 0.95) mid.push([x, y, 0.8 + rng() * 0.4]);
    else big.push([x, y, 1.2 + rng() * 0.6]);
  }
  dots(small, rgba(CREAM, 0.55));
  dots(mid, rgba(mix(CREAM, C.pipe, 0.2), 0.8));
  for (const [x, y, r] of big) {
    ctx.fillStyle = rgrad(x, y, 0, r * 6, [[0, rgba(CREAM, 0.45)], [1, rgba(CREAM, 0)]]);
    ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    segs([[x - r * 4, y, x + r * 4, y], [x, y - r * 4, x, y + r * 4]], rgba(CREAM, 0.35), 0.6);
    circle(x, y, r, CREAM);
  }
}

function skyAurora(C) {
  const bands = [[86, 14, 0.019, 0.6, '#8ff0c4', 64, 0.22], [118, 10, 0.024, 2.3, '#7fd8e6', 50, 0.16], [62, 9, 0.015, 4.2, '#b7a6ff', 40, 0.1]];
  for (const [base, amp, f, ph, col, hgt, a] of bands) {
    const yAt = x => base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph * 1.3) * amp * 0.35;
    // Vorhang: unten hell, nach oben ausblendend, aus vielen feinen Strahlen
    for (let x = -4; x <= W + 4; x += 2) {
      const y = yAt(x), len = hgt * (0.55 + 0.45 * pnoise(x * 0.05, 1000, base));
      const g = ctx.createLinearGradient(0, y - len, 0, y + 4);
      const k = a * (0.55 + 0.45 * pnoise(x * 0.08, 1000, base + 7));
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.75, rgba(col, k * 0.6));
      g.addColorStop(1, rgba(col, k));
      ctx.fillStyle = g;
      ctx.fillRect(x, y - len, 2.2, len + 4);
    }
  }
}

function skyGlow(C) {
  ctx.fillStyle = vgrad(250, GROUND_Y, [[0, rgba(C.accent, 0)], [0.7, rgba(C.accent, 0.16)], [1, rgba(C.accent, 0.34)]]);
  ctx.fillRect(0, 250, W, GROUND_Y - 250);
}

function skySmoke(C, rng) {
  for (let i = 0, n = Math.round(9 * W / 400); i < n; i++) {
    const x = rng() * W, y = 30 + rng() * 170, r = 60 + rng() * 70;
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1.6, 0, 0, 0.6, 0, 0);
    ctx.fillStyle = rgrad(0, 0, 0, r, [[0, rgba(shade(C.skyTop, -0.3), 0.55)], [1, rgba(C.skyTop, 0)]]);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = rgrad(0, r * 0.45, 0, r * 0.7, [[0, rgba(C.accent, 0.1)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(-r, -r * 0.3, r * 2, r * 1.5);
    ctx.restore();
  }
}

function skyCave(C, rng) {
  // ferne Höhlenwand mit Säulen und Kristallschimmer
  const wall = mix(C.skyTop, C.far, 0.45);
  for (let i = 0, n = Math.ceil(W / 64) + 1; i < n; i++) {
    const x = i * 64 + rng() * 30, w2 = 18 + rng() * 26;
    ctx.fillStyle = hgrad(x - w2, x + w2, [[0, rgba(shade(wall, 0.08), 0.55)], [1, rgba(shade(wall, -0.2), 0.55)]]);
    ctx.beginPath();
    ctx.moveTo(x - w2, GROUND_Y);
    ctx.quadraticCurveTo(x - w2 * 0.4, 300, x - w2 * 0.8, 0);
    ctx.lineTo(x + w2 * 0.8, 0);
    ctx.quadraticCurveTo(x + w2 * 0.4, 300, x + w2, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0, n = Math.round(9 * W / 400); i < n; i++) {
    const x = rng() * W, y = 150 + rng() * 320, r = 30 + rng() * 60;
    ctx.fillStyle = rgrad(x, y, 0, r, [[0, rgba(C.accent, 0.13)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.save();
  ctx.translate(Math.round(W * 0.62), 0);
  ctx.rotate(0.18);
  ctx.fillStyle = hgrad(-40, 40, [[0, rgba(CREAM, 0)], [0.5, rgba(mix(CREAM, C.accent, 0.3), 0.07)], [1, rgba(CREAM, 0)]]);
  ctx.fillRect(-40, -20, 80, GROUND_Y + 40);
  ctx.restore();
  ctx.fillStyle = vgrad(0, 220, [[0, rgba(INK, 0.45)], [1, rgba(INK, 0)]]);
  ctx.fillRect(0, 0, W, 220);
}

function skyStorm(C, rng) {
  // weiche Wolkenbänke aus vielen verlaufenden Ballen, kein harter Rand
  const dark = shade(C.skyTop, -0.25), mid = mix(C.far, C.skyBottom, 0.35), lit = mix(C.skyBottom, CREAM, 0.18);
  for (let row = 0; row < 4; row++) {
    for (let i = 0, n = Math.ceil((W + 60) / 52); i < n; i++) {
      const x = i * 52 - 30 + rng() * 34, y = 20 + row * 46 + rng() * 22, r = 44 + rng() * 40;
      ctx.fillStyle = rgrad(x, y + 8, 0, r, [[0, rgba(dark, 0.5)], [0.6, rgba(dark, 0.3)], [1, rgba(dark, 0)]]);
      ctx.fillRect(x - r, y + 8 - r, r * 2, r * 2);
      ctx.fillStyle = rgrad(x - r * 0.2, y - r * 0.25, 0, r * 0.8, [[0, rgba(mid, 0.45)], [1, rgba(mid, 0)]]);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.fillStyle = vgrad(0, 110, [[0, rgba(dark, 0.55)], [1, rgba(dark, 0)]]);
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = rgrad(110, 250, 0, 140, [[0, rgba(lit, 0.18)], [1, rgba(lit, 0)]]);
  ctx.fillRect(0, 110, 260, 280);
}

function skyCirrus(C, rng) {
  for (let i = 0, n = Math.round(6 * W / 400); i < n; i++) {
    const x = rng() * W, y = 30 + rng() * 120, len = 70 + rng() * 90;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.08 + rng() * 0.16);
    ctx.transform(1, 0, 0, 0.09, 0, 0);
    ctx.fillStyle = rgrad(0, 0, 0, len, [[0, rgba(CREAM, 0.42)], [1, rgba(CREAM, 0)]]);
    ctx.fillRect(-len, -len, len * 2, len * 2);
    ctx.restore();
  }
}

function skyRays(C, L) {
  const ocean = !!L.sky.surface;
  const col = ocean ? mix(CREAM, C.accent, 0.3) : mix(CREAM, C.accent, 0.2);
  for (let i = 0, n = Math.ceil((W + 120) / 82); i < n; i++) {
    const x0 = -40 + i * 82 + (i % 2) * 14, wTop = 18 + (i % 3) * 9, slant = ocean ? 70 : 150, wBot = wTop * 3;
    ctx.beginPath();
    ctx.moveTo(x0, -10);
    ctx.lineTo(x0 + wTop, -10);
    ctx.lineTo(x0 + wTop + slant + wBot * 0.5, GROUND_Y);
    ctx.lineTo(x0 + slant - wBot * 0.5, GROUND_Y);
    ctx.closePath();
    ctx.fillStyle = vgrad(0, GROUND_Y, [[0, rgba(col, 0.16 - (i % 3) * 0.03)], [0.7, rgba(col, 0.03)], [1, rgba(col, 0)]]);
    ctx.fill();
  }
}

function skySurface(C, rng) {
  ctx.fillStyle = vgrad(0, 80, [[0, rgba(CREAM, 0.45)], [1, rgba(CREAM, 0)]]);
  ctx.fillRect(0, 0, W, 80);
  // Lichtnetz der Wasseroberfläche: verzerrtes Gitter aus weichen Bögen
  const cell = 15, cols = Math.ceil(W / cell) + 2, rows = 8, pts = [];
  for (let j = 0; j < rows; j++) {
    pts.push([]);
    for (let i = 0; i < cols; i++) pts[j].push([i * cell - cell + (rng() - 0.5) * cell * 0.8, 6 + j * cell * 0.62 + (rng() - 0.5) * cell * 0.4]);
  }
  for (let j = 0; j < rows; j++) {
    const a = 0.2 * (1 - j / rows);
    ctx.strokeStyle = rgba(CREAM, a);
    ctx.lineWidth = 1.3 - j * 0.1;
    ctx.beginPath();
    for (let i = 0; i < cols; i++) {
      const p = pts[j][i];
      if (i + 1 < cols) { const q = pts[j][i + 1]; ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo((p[0] + q[0]) / 2 + (rng() - 0.5) * 5, (p[1] + q[1]) / 2 + (rng() - 0.5) * 5, q[0], q[1]); }
      if (j + 1 < rows) { const q = pts[j + 1][i]; ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo((p[0] + q[0]) / 2 + (rng() - 0.5) * 6, (p[1] + q[1]) / 2, q[0], q[1]); }
    }
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(CREAM, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -6; x <= W + 6; x += 6) {
    const y = 8 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13 + 1) * 1.4;
    if (x === -6) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function skyHaze(C) {
  ctx.fillStyle = vgrad(330, GROUND_Y, [[0, rgba(mix(C.skyBottom, CREAM, 0.4), 0)], [1, rgba(mix(C.skyBottom, CREAM, 0.4), 0.45)]]);
  ctx.fillRect(0, 330, W, GROUND_Y - 330);
}

function skyRain(C, rng) {
  const list = [];
  for (let i = 0, n = Math.round(160 * W / 400); i < n; i++) {
    const x = rng() * (W + 120) - 60, y = rng() * GROUND_Y, len = 14 + rng() * 20;
    list.push([x, y, x - len * 0.25, y + len]);
  }
  segs(list, rgba(mix(CREAM, C.skyBottom, 0.4), 0.07), 1);
}

// ============================================================
// Cache-Verwaltung: aktuelles und nächstes Level, Rest wird freigegeben
// ============================================================
const levelCaches = new Map();
const cacheQueue = [];
// Geschätzte Dauer eines Bauschritts (gleitender Mittelwert), damit kein Frame überläuft
const idle = { est: 10 };
const cacheScale = () => Math.min(view.k, CONFIG.CACHE_MAX_SCALE);

function* levelBuildSteps(cache) {
  const li = cache.li, ks = cache.ks;
  cache.sky = buildSky(li, ks); yield;
  for (let i = 0; i < 3; i++) { cache.layers[i] = buildLayer(li, i, ks); yield; }
  cache.ground = buildGround(li, ks); yield;
  if (LEVELS[li].style.ceiling) { cache.ceiling = buildCeiling(li, ks); yield; }
  cache.pipe = buildPipeSprites(li, ks); yield;
  cache.hazard = buildHazardSprites(li, ks); yield;
  cache.ready = true;
}

function freeLevelCache(c) {
  const all = [c.sky, c.ground && c.ground.c, c.ceiling && c.ceiling.c];
  for (const l of c.layers) if (l) all.push(l.c);
  for (const grp of [c.pipe, c.hazard]) if (grp) for (const s of grp.sprites || []) all.push(s.c);
  all.forEach(freeCanvas);
  freeSceneState(c);
  c.ready = false;
  c.freed = true;
}

function newLevelCache(li) {
  const c = { li, ks: cacheScale(), w: W, layers: [null, null, null], ready: false, used: 0 };
  c.gen = levelBuildSteps(c);
  levelCaches.set(li, c);
  return c;
}

function finishCache(c) {
  // Synchrones Fertigbauen liefert zugleich eine Schätzung, wie teuer ein Bauschritt auf diesem Gerät ist
  const t0 = performance.now();
  let steps = 0;
  while (!c.ready) { steps++; if (c.gen.next().done) break; }
  if (steps >= 4) idle.est = Math.max(idle.est, (performance.now() - t0) / steps);
  return c;
}

// Liefert einen fertigen Cache. Während eines laufenden Größenwechsels wird ein
// älterer Cache skaliert weiterverwendet und erst danach neu aufgebaut.
function getLevelCache(li) {
  let c = levelCaches.get(li);
  if (c && c.ks !== cacheScale()) {
    if (c.ready && performance.now() - view.resizedAt < 400) { c.used = frame; return c; }
    freeLevelCache(c);
    levelCaches.delete(li);
    c = null;
  }
  // Nur der Himmel hängt von der logischen Breite ab: bei neuer Breite nur ihn neu malen
  if (c && c.ready && c.w !== W && !(performance.now() - view.resizedAt < 400)) {
    freeCanvas(c.sky);
    c.sky = buildSky(li, c.ks);
    c.w = W;
  }
  if (!c) c = newLevelCache(li);
  finishCache(c);
  c.used = frame;
  return c;
}

function prefetchLevel(li) {
  if (li < 0 || li >= LEVELS.length) return;
  const c = levelCaches.get(li);
  if (c && c.ks === cacheScale() && c.w === W) { if (!c.ready && !cacheQueue.includes(c)) cacheQueue.push(c); return; }
  if (c) { freeLevelCache(c); levelCaches.delete(li); }
  cacheQueue.push(newLevelCache(li));
}

// Höchstens zwei Level behalten: das gezeigte und das vorgeladene
function keepLevelCaches(list) {
  for (const [li, c] of levelCaches) {
    if (!list.includes(li)) { freeLevelCache(c); levelCaches.delete(li); }
  }
  for (let i = cacheQueue.length - 1; i >= 0; i--) if (cacheQueue[i].freed) cacheQueue.splice(i, 1);
}

// Ein Bauschritt pro Frame, nur wenn im Frame noch Zeit übrig ist
function runIdleWork(frameStart, calm) {
  const spent = performance.now() - frameStart;
  // Nach dem Bosssieg (keine Steuerung nötig) wird spätestens jetzt vorgeladen, ein Schritt alle 4 Frames
  const due = (game.state === 'BOSS_DEFEATED' || game.state === 'BOSS_GRACE') && cacheQueue.length > 0 && game.t % 4 === 0;
  if (!calm && !due && spent + idle.est > 13) return;
  while (cacheQueue.length && (cacheQueue[0].ready || cacheQueue[0].freed)) cacheQueue.shift();
  const t0 = performance.now();
  if (cacheQueue.length) {
    const c = cacheQueue[0];
    if (c.gen.next().done || c.ready) cacheQueue.shift();
  } else if (!(ACTIVE_STATES.has(game.state) || game.state === 'LEVEL_INTRO') || !scenePrepaint(game.level, game.scroll)) {
    if (!buildNextThumb()) return;
  }
  idle.est = idle.est * 0.7 + (performance.now() - t0) * 0.3;
}

// ============================================================
// Vorschaubilder für Menü und Levelkarten (niedrigere Auflösung)
// ============================================================
const thumbs = { kt: 0, w: 0, list: [] };
const thumbScale = () => clamp(view.k * 0.5, 0.75, 1.5);

function buildThumb(li) {
  const kt = thumbScale(), c = newCanvas(W * kt, H * kt), g = c.getContext('2d');
  c.logicalW = W;
  const sky = buildSky(li, kt);
  g.drawImage(sky, 0, 0, c.width, c.height);
  freeCanvas(sky);
  const off = 260;
  const parts = [0, 1, 2].map(i => [sceneHidesLayer(li, i) ? null : buildLayer(li, i, kt), off * CONFIG.PARALLAX[i], i + 1]);
  parts.push([buildGround(li, kt), off, -1]);
  if (LEVELS[li].style.ceiling) parts.push([buildCeiling(li, kt), off, -1]);
  drawSceneThumb(li, g, kt, off, 0);
  for (const [s, o, z] of parts) {
    if (s) {
      const sx = Math.round(o * s.kx) % s.wd, dy = Math.round(s.y0 * kt);
      let dx = 0, x = sx;
      while (dx < c.width) {
        const w = Math.min(s.wd - x, c.width - dx);
        g.drawImage(s.c, x, 0, w, s.hd, dx, dy, w, s.hd);
        dx += w;
        x = 0;
      }
      freeCanvas(s.c);
    }
    if (z > 0) drawSceneThumb(li, g, kt, off, z);
  }
  return warmUp(c);
}

function buildNextThumb() {
  const kt = thumbScale();
  if (thumbs.kt !== kt || thumbs.w !== W) {
    if (performance.now() - view.resizedAt < 400 && thumbs.list.some(Boolean)) return false;
    thumbs.list.forEach(freeCanvas);
    thumbs.list = [];
    thumbs.kt = kt;
    thumbs.w = W;
  }
  if (!MENU_STATES.has(game.state)) return false;
  const order = [game.menuBg.cur, ...LEVELS.map((_, i) => i)];
  for (const li of order) {
    if (!thumbs.list[li]) { thumbs.list[li] = buildThumb(li); return true; }
  }
  return false;
}

function getThumb(li, force) {
  if ((thumbs.kt !== thumbScale() || thumbs.w !== W) && force) buildNextThumb();
  if (!thumbs.list[li] && force) thumbs.list[li] = buildThumb(li);
  return thumbs.list[li] || null;
}

// ============================================================
// Gemeinsame Bildschirm-Sprites (Vignette, Leuchtpunkte)
// ============================================================
const screenFx = { k: 0, cw: 0, ch: 0, vignette: null, glow: new Map() };
function getVignette() {
  if (screenFx.k !== view.k || screenFx.cw !== canvas.width || screenFx.ch !== canvas.height || !screenFx.vignette) {
    freeCanvas(screenFx.vignette);
    const c = newCanvas(canvas.width, canvas.height);
    paintCanvas(c, view.k, view.k, 0, 0, () => {
      ctx.fillStyle = rgrad(W / 2, H / 2, H * 0.3, Math.max(H, W) * 0.8, [[0, rgba(INK, 0)], [0.7, rgba(INK, 0.14)], [1, rgba(INK, 0.36)]]);
      ctx.fillRect(0, 0, W, H);
    });
    screenFx.vignette = warmUp(c);
    screenFx.cw = canvas.width;
    screenFx.ch = canvas.height;
    const kChanged = screenFx.k !== view.k;
    screenFx.k = view.k;
    if (!kChanged) return screenFx.vignette;
    for (const g of screenFx.glow.values()) freeCanvas(g);
    screenFx.glow.clear();
  }
  return screenFx.vignette;
}
// Weicher Leuchtpunkt einer Farbe als Sprite (Radius 32 logisch)
function glowSprite(col) {
  getVignette();
  let s = screenFx.glow.get(col);
  if (!s) {
    const ks = Math.min(view.k, 3);
    s = newCanvas(64 * ks, 64 * ks);
    paintCanvas(s, ks, ks, -32, -32, () => {
      ctx.fillStyle = rgrad(0, 0, 0, 32, [[0, rgba(col, 0.55)], [0.4, rgba(col, 0.22)], [1, rgba(col, 0)]]);
      ctx.fillRect(-32, -32, 64, 64);
    });
    screenFx.glow.set(col, warmUp(s));
  }
  return s;
}

