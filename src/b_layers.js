// ============================================================
// Parallax-Ebenen: jede Ebene ist ein nahtlos kachelnder Streifen
// der Breite P, einmal gemalt, danach nur noch verschoben.
// ============================================================
function layerExtent(l) {
  const yb = GROUND_Y + 14;
  switch (l.kind) {
    case 'hills': return [l.clouds ? 26 : l.base - l.amp - (l.trees ? 46 : 8), yb];
    case 'dunes': return [l.base - l.amp - 8, yb];
    case 'peaks': return [l.base - l.amp - (l.volcano ? 120 : 12), yb];
    case 'spikes': return [GROUND_Y + 8 - l.amp - (l.crystals ? 30 : 12), yb];
    case 'trunks': return [0, yb];
    case 'hang': return [0, l.base + l.amp + (l.lianas ? 190 : l.points ? 80 : 50)];
    case 'mesas': return [l.base - l.amp - 12, yb];
    case 'reef': return [l.base - l.amp - 46, yb];
    case 'strands': return [GROUND_Y + 8 - l.height[1] - 26, yb];
    case 'city': return [l.base - l.amp - 34, yb];
    case 'stars': return [0, GROUND_Y + 4];
    case 'station': return [GROUND_Y - 110, yb];
    case 'props': return [GROUND_Y - ({ meadow: 46, fir: 120, fern: 84, cactus: 90, coral: 80, windgrass: 54 }[l.prop] || (ART2.prop[l.prop] && ART2.prop[l.prop].h) || 60), yb];
  }
  if (ART2.layerExtent[l.kind]) return ART2.layerExtent[l.kind](l, yb);
  return [0, yb];
}

function layerTex(l, i) {
  if (ART2.layerTex[l.kind]) return ART2.layerTex[l.kind](l, i);
  switch (l.kind) {
    case 'stars': return null;
    case 'city': return { grain: 0.05, mottle: 0.08 };
    case 'hang': return { grain: 0.07, mottle: 0.2, contrast: 1.2 };
    case 'trunks': return { grain: 0.06, mottle: 0.16 };
  }
  return { grain: 0.04 + i * 0.02, mottle: [0.12, 0.18, 0.2][i], contrast: 1.1 };
}

function buildLayer(li, i, ks) {
  const L = LEVELS[li], C = COLORS[li], l = L.layers[i];
  const [y0, y1] = layerExtent(l), tex = layerTex(l, i);
  return makeStrip(l.P, y0, y1, ks, () => paintLayer(l, i, C, L), tex && Object.assign({ seed: l.seed }, tex));
}

function paintLayer(l, i, C, L) {
  const rng = mulberry32(l.seed * 7919 + i * 13 + 1);
  const col = l.color ? l.color : i === 0 ? mix(C.far, C.skyBottom, 0.12) : i === 1 ? C.mid : C.near;
  switch (l.kind) {
    case 'hills': layerHills(l, i, C, col, rng); break;
    case 'dunes': layerDunes(l, i, C, col, rng); break;
    case 'peaks': layerPeaks(l, i, C, col, rng); break;
    case 'spikes': layerSpikes(l, i, C, col, rng); break;
    case 'trunks': layerTrunks(l, i, C, col, rng); break;
    case 'hang': layerHang(l, i, C, col, rng); break;
    case 'mesas': layerMesas(l, i, C, col, rng); break;
    case 'reef': layerReef(l, i, C, col, rng); break;
    case 'strands': layerStrands(l, i, C, col, rng); break;
    case 'city': layerCity(l, i, C, col, rng); break;
    case 'stars': layerStars(l, i, C, rng); break;
    case 'station': layerStation(l, i, C, col, rng); break;
    case 'props': layerProps(l, i, C, col, rng); break;
    default: if (ART2.layer[l.kind]) ART2.layer[l.kind](l, i, C, col, rng, L);
  }
}

// ---------- Hügel, Wolken, Bäume ----------
function layerHills(l, i, C, col, rng) {
  const P = l.P, f = ridgeFn(P, l.base, l.amp, l.freq, l.seed), yb = GROUND_Y + 14;
  if (l.clouds) layerClouds(l, C, rng);
  ridgePath(f, -8, P + 8, 4, yb);
  ctx.fillStyle = vgrad(l.base - l.amp, yb, [[0, shade(col, 0.1)], [0.45, col], [1, shade(col, -0.22)]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (l.fields) hillFields(f, l, C, col, rng);
  // Lichtflecken und Mulden
  const light = [], darkL = [];
  for (let k = 0; k < P / 34; k++) {
    const x = rng() * P, y = f(x) + 14 + rng() * 70, rx = 24 + rng() * 50, ry = 5 + rng() * 9;
    (rng() < 0.5 ? light : darkL).push([x, y, rx, ry, (rng() - 0.5) * 0.3]);
  }
  ellipses(light, rgba(shade(col, 0.16), 0.16));
  ellipses(darkL, rgba(shade(col, -0.18), 0.13));
  if (l.specks) {
    // ferne Baumgruppen als dunkle Büschel entlang der Kämme
    const dk = [];
    for (let x = 0; x < P; x += 3 + rng() * 9) {
      if (pnoise(x / P * 24, 24, l.seed + 9) < 0.45) continue;
      const y = f(x) + 2 + rng() * 5, r = 1.2 + rng() * 1.6;
      dk.push([x, y, r], [x + r * 0.9, y + 0.6, r * 0.8]);
    }
    dots(dk, rgba(shade(col, -0.22), 0.5));
  }
  if (i > 0) {
    const gs = [];
    for (let k = 0; k < P / 2.2; k++) {
      const x = rng() * P, y = f(x) + 3 + Math.pow(rng(), 1.6) * 80, len = 2 + rng() * 3.5;
      gs.push([x, y, x + (rng() - 0.3) * 1.5, y - len]);
    }
    segs(gs.slice(0, gs.length >> 1), rgba(shade(col, 0.22), 0.35), 0.9);
    segs(gs.slice(gs.length >> 1), rgba(shade(col, -0.25), 0.3), 0.9);
  }
  ctx.restore();
  ridgeLine(f, -8, P + 8, 4, 1.4, rgba(CREAM, i === 0 ? 0.16 : 0.26), 2.2);
  if (l.trees) hillTrees(f, l, C, col, rng);
  if (l.haze) {
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(l.base - l.amp * 0.5, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, l.haze)]]);
    ctx.fill();
  }
}

function hillFields(f, l, C, col, rng) {
  const P = l.P, cols = [mix(col, C.accent, 0.22), shade(col, 0.1), mix(col, '#c7b45c', 0.28), shade(col, -0.06)];
  let x = 0;
  while (x < P) {
    const w = 70 + rng() * 90, x1 = Math.min(P, x + w), c = cols[Math.floor(rng() * cols.length)];
    const off0 = 16 + rng() * 10, off1 = off0 + 18 + rng() * 22;
    ctx.beginPath();
    for (let xx = x; xx <= x1; xx += 4) ctx.lineTo(xx, f(xx) + off0);
    for (let xx = x1; xx >= x; xx -= 4) ctx.lineTo(xx, f(xx) + off1);
    ctx.closePath();
    ctx.fillStyle = rgba(c, 0.55);
    ctx.fill();
    const fur = [];
    for (let r = off0 + 4; r < off1; r += 4) for (let xx = x; xx < x1 - 4; xx += 8) fur.push([xx, f(xx) + r, xx + 8, f(xx + 8) + r]);
    segs(fur, rgba(shade(c, -0.25), 0.2), 0.8);
    // Hecke an der Feldgrenze
    const hedge = [];
    for (let xx = x; xx <= x1; xx += 3) hedge.push([xx, f(xx) + off1 + 1, 1.8 + hash(xx) * 1.2]);
    dots(hedge, rgba(shade(col, -0.35), 0.7));
    x = x1 + 10 + rng() * 30;
  }
}

function roundTree(x, y, r, col, C, leaves) {
  ellipse(x + r * 0.7, y + 1, r * 1.15, r * 0.26, 0, rgba(INK, 0.16));
  ctx.fillStyle = shade(col, -0.5);
  ctx.fillRect(x - r * 0.11, y - r * 0.95, r * 0.22, r);
  const cy = y - r * 1.3;
  const blobs = [[x, cy, r], [x - r * 0.58, cy + r * 0.32, r * 0.68], [x + r * 0.6, cy + r * 0.28, r * 0.74]];
  blobPath(blobs.map(([bx, by, br]) => [bx + r * 0.08, by + r * 0.1, br]));
  ctx.fillStyle = shade(col, -0.3);
  ctx.fill();
  blobPath(blobs);
  ctx.fillStyle = rgrad(x, cy, r * 0.1, r * 1.5, [[0, shade(col, 0.26)], [0.55, shade(col, 0.02)], [1, shade(col, -0.24)]], x - r * 0.45, cy - r * 0.6);
  ctx.fill();
  if (leaves) {
    for (let k = 0; k < 9; k++) {
      const a = hash(x * 3.1 + k) * TAU, d = Math.sqrt(hash(x * 1.7 + k * 3)) * r * 0.9;
      const lx = x + Math.cos(a) * d, ly = cy + Math.sin(a) * d * 0.85;
      (ly < cy ? leaves.hi : leaves.lo).push([lx, ly, 0.9 + hash(k + x) * 1.2]);
    }
  }
}

function hillTrees(f, l, C, col, rng) {
  const P = l.P, leaves = { hi: [], lo: [] }, tc = shade(col, -0.06), list = [];
  for (let x = 6; x < P; x += 14 + rng() * 26) {
    if (rng() > l.trees) continue;
    const lower = rng() < 0.35;
    list.push([x, f(x) + (lower ? 12 + rng() * 26 : 4), (lower ? 5 : 7) + rng() * 5]);
  }
  list.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of list) wrapEach(x, P, r * 2, xx => roundTree(xx, y, r, tc, C, leaves));
  dots(leaves.hi, rgba(shade(tc, 0.32), 0.6));
  dots(leaves.lo, rgba(shade(tc, -0.32), 0.5));
}

function layerClouds(l, C, rng) {
  const P = l.P, n = Math.max(2, Math.round(P / 230));
  for (let k = 0; k < n; k++) {
    const x = (k + 0.2 + rng() * 0.6) * P / n, y = 70 + rng() * 120, s = 0.75 + rng() * 0.6, seed = l.seed * 31 + k;
    wrapEach(x, P, 95 * s, xx => cloudShape(xx, y, s, C, mulberry32(seed)));
  }
}

function cloudShape(x, y, s, C, r) {
  const puffs = [], n = 8;
  for (let j = 0; j < n; j++) {
    const a = j / (n - 1);
    puffs.push([x + (a - 0.5) * 128 * s + (r() - 0.5) * 12 * s, y - Math.sin(a * Math.PI) * 20 * s - r() * 12 * s, (13 + Math.sin(a * Math.PI) * 17 + r() * 8) * s]);
  }
  for (let j = 0; j < 3; j++) puffs.push([x + (r() - 0.5) * 60 * s, y - 26 * s - r() * 10 * s, (14 + r() * 8) * s]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 140 * s, y - 100 * s, 280 * s, 100 * s + 9 * s);
  ctx.clip();
  blobPath(puffs.map(([px, py, pr]) => [px + 3 * s, py + 4 * s, pr]));
  ctx.fillStyle = rgba(mix(C.skyTop, INK, 0.25), 0.1);
  ctx.fill();
  blobPath(puffs);
  ctx.fillStyle = vgrad(y - 60 * s, y + 9 * s, [[0, mix(CREAM, '#ffffff', 0.5)], [0.55, CREAM], [1, mix(CREAM, C.skyTop, 0.38)]]);
  ctx.fill();
  const hl = puffs.filter(p => p[1] < y - 8 * s).map(([px, py, pr]) => [px - pr * 0.25, py - pr * 0.3, pr * 0.55]);
  dots(hl, rgba('#ffffff', 0.32));
  ctx.restore();
}

// ---------- Dünen ----------
function layerDunes(l, i, C, col, rng) {
  const P = l.P, n = Math.max(3, Math.round(P / 150)), base = l.base, yb = GROUND_Y + 14;
  ctx.fillStyle = vgrad(base - 10, yb, [[0, col], [1, shade(col, -0.12)]]);
  ctx.fillRect(-8, base - 6, P + 16, yb - base + 6);
  const list = [];
  for (let k = 0; k < n; k++) list.push({ cx: (k + 0.5) * P / n + (rng() - 0.5) * 40, h: l.amp * (0.45 + 0.55 * rng()), wl: 90 + rng() * 70, wr: 50 + rng() * 40 });
  list.sort((a, b) => b.h - a.h);
  const lit = shade(col, 0.12), dark = mix(shade(col, -0.2), C.skyTop, 0.12);
  for (const d of list) {
    wrapEach(d.cx, P, d.wl + d.wr, x => {
      const top = base - d.h, bl = base + 4;
      ctx.beginPath();
      ctx.moveTo(x - d.wl, bl);
      ctx.bezierCurveTo(x - d.wl * 0.5, bl, x - d.wl * 0.35, top, x, top);
      ctx.bezierCurveTo(x + d.wr * 0.3, top, x + d.wr * 0.55, bl, x + d.wr, bl);
      ctx.closePath();
      ctx.fillStyle = vgrad(top, bl, [[0, lit], [1, col]]);
      ctx.fill();
      // Leeseite im Schatten mit scharfem Kamm
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.bezierCurveTo(x + d.wr * 0.3, top, x + d.wr * 0.55, bl, x + d.wr, bl);
      ctx.lineTo(x + d.wr * 0.15, bl);
      ctx.quadraticCurveTo(x + d.wr * 0.05, top + d.h * 0.45, x, top);
      ctx.closePath();
      ctx.fillStyle = vgrad(top, bl, [[0, dark], [1, shade(dark, -0.08)]]);
      ctx.fill();
      line(x - d.wl * 0.3, top + d.h * 0.12, x, top, rgba(CREAM, 0.35), 1.2);
      const rip = [];
      for (let k = 1; k < 5; k++) {
        const yy = top + d.h * (0.25 + k * 0.15), xx = x - d.wl * (0.15 + k * 0.12);
        rip.push([xx - 14, yy + 2, xx + 10, yy - 1]);
      }
      segs(rip, rgba(shade(col, -0.15), 0.35), 0.9);
    });
  }
  if (l.haze) {
    ctx.fillStyle = vgrad(base - l.amp, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, l.haze)]]);
    ctx.fillRect(-8, base - l.amp, P + 16, yb - base + l.amp);
  }
}

// ---------- Berge ----------
function layerPeaks(l, i, C, col, rng) {
  const P = l.P, n = Math.max(2, Math.round(P / l.spacing)), base = l.base, yb = GROUND_Y + 14;
  ctx.fillStyle = vgrad(base - 6, yb, [[0, col], [1, shade(col, -0.22)]]);
  ctx.fillRect(-8, base - 2, P + 16, yb - base + 2);
  const peaks = [];
  for (let k = 0; k < n; k++) {
    const sp = P / n;
    peaks.push({ cx: (k + 0.5) * sp + (rng() - 0.5) * sp * 0.5, h: l.amp * (0.5 + 0.5 * rng()), hw: l.spacing * (0.55 + 0.35 * rng()), s: (rng() * 1e6) | 0, volcano: false });
  }
  if (l.volcano) Object.assign(peaks[0], { h: l.amp, hw: l.spacing * 0.95, volcano: true });
  peaks.sort((a, b) => b.h - a.h);
  for (const p of peaks) wrapEach(p.cx, P, p.hw + 6, x => mountain(x, base, p, l, C, col));
  if (l.haze) {
    ctx.fillStyle = vgrad(base - l.amp * 0.55, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, l.haze)]]);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(-8, base - l.amp, P + 16, yb - base + l.amp);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function mountain(x, base, p, l, C, col) {
  const r = mulberry32(p.s), top = base - p.h, jag = l.jagged ? 0.16 : 0.08, nSeg = 8;
  const lit = shade(col, 0.14), dark = shade(col, -0.26), flat = p.volcano ? p.hw * 0.16 : 0;
  const left = [[x - p.hw, base + 2]];
  for (let j = 1; j < nSeg; j++) {
    const t = j / nSeg;
    left.push([x - flat - (p.hw - flat) * (1 - t) + (r() - 0.5) * p.hw * jag, base - p.h * t + (r() - 0.5) * p.h * jag * 0.6]);
  }
  left.push([x - flat, top]);
  const right = [[x + flat, top]];
  for (let j = 1; j < nSeg; j++) {
    const t = j / nSeg;
    right.push([x + flat + (p.hw * 0.92 - flat) * t + (r() - 0.5) * p.hw * jag, top + p.h * t + (r() - 0.5) * p.h * jag * 0.6]);
  }
  right.push([x + p.hw * 0.92, base + 2]);
  const ridge = [[x + flat * 0.5, top], [x + p.hw * 0.06 + (r() - 0.5) * 6, top + p.h * 0.32], [x - p.hw * 0.02 + (r() - 0.5) * 8, top + p.h * 0.62], [x + p.hw * 0.1, base + 2]];
  const litFace = left.concat(ridge.slice().reverse());
  const darkFace = ridge.concat(right.slice(1).reverse());
  poly(litFace, vgrad(top, base, [[0, lit], [1, col]]));
  poly(darkFace, vgrad(top, base, [[0, mix(dark, col, 0.3)], [1, dark]]));
  // Rinnen auf beiden Flanken
  const gl = [], gd = [];
  for (let k = 0; k < 9; k++) {
    const t = 0.18 + r() * 0.55, yy = top + p.h * t, len = p.h * (0.06 + r() * 0.1);
    const xl = x - p.hw * t * (0.15 + 0.7 * r()), xr = x + p.hw * 0.92 * t * (0.15 + 0.7 * r());
    gl.push([xl, yy, xl - len * 0.3, yy + len]);
    gd.push([xr, yy, xr + len * 0.25, yy + len]);
  }
  segs(gl, rgba(shade(col, -0.2), 0.28), 1);
  segs(gd, rgba(shade(col, 0.12), 0.14), 1);
  if (l.caps) {
    const capY = top + p.h * l.caps, cap = [];
    for (const q of left) if (q[1] <= capY) cap.push(q);
    const xl = x - flat - (p.hw - flat) * (1 - (base - capY) / p.h), xr = x + flat + (p.hw * 0.92 - flat) * ((capY - top) / p.h);
    const zz = [];
    for (let k = 0; k <= 8; k++) zz.push([lerp(xl, xr, k / 8), capY + (k % 2 ? -p.h * 0.05 : p.h * 0.04) * (0.6 + r() * 0.8)]);
    const capPoly = [[xl, capY]].concat(left.filter(q => q[1] <= capY), right.filter(q => q[1] <= capY), zz.reverse());
    const snowLit = mix(CREAM, '#ffffff', 0.3), snowDark = mix(CREAM, C.skyTop, 0.42);
    ctx.save();
    poly(litFace);
    ctx.clip();
    poly(capPoly, vgrad(top, capY, [[0, snowLit], [1, mix(snowLit, col, 0.15)]]));
    ctx.restore();
    ctx.save();
    poly(darkFace);
    ctx.clip();
    poly(capPoly, snowDark);
    ctx.restore();
  }
  if (p.volcano) {
    ctx.fillStyle = rgrad(x, top, 0, 64, [[0, rgba(C.accentLight, 0.55)], [0.35, rgba(C.accent, 0.25)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - 64, top - 64, 128, 128);
    ellipse(x, top + 1, flat, 3, 0, C.accentLight);
    for (let k = 0; k < 3; k++) {
      // Lavaströme folgen der Flanke nach unten links
      const pts = [[x - flat * 0.7 + k * flat * 0.45, top + 2]];
      let px = pts[0][0], py = top + 2;
      const slope = p.hw / p.h * (0.35 + k * 0.22);
      while (py < base - 14) { const dy = 9 + r() * 7; px -= slope * dy + (r() - 0.5) * 5; py += dy; pts.push([px, py]); }
      for (const [lw, c] of [[7, rgba(C.accent, 0.22)], [2.2, rgba(C.accent, 0.85)], [0.9, rgba(C.accentLight, 0.9)]]) {
        ctx.beginPath();
        pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }
    for (let k = 0; k < 6; k++) {
      const sy = top - 14 - k * 11, sx = x + k * 7 + (r() - 0.5) * 6, sr = 12 + k * 4;
      circle(sx, sy, sr, rgba(mix(C.skyTop, CREAM, 0.15), 0.28 - k * 0.035));
    }
  }
  if (l.veins) {
    ctx.save();
    poly(litFace.concat(darkFace.slice(1)));
    ctx.clip();
    for (let k = 0; k < 2; k++) {
      let px = x - p.hw * (0.1 + r() * 0.4), py = top + p.h * (0.3 + r() * 0.2);
      const pts = [[px, py]];
      for (let j = 0; j < 5; j++) { px += (r() - 0.5) * 12; py += 8 + r() * 8; pts.push([px, py]); }
      for (const [lw, c] of [[5, rgba(C.accent, 0.18)], [1.4, rgba(C.accent, 0.8)]]) {
        ctx.beginPath();
        pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Lichtkante nur im oberen Teil der beleuchteten Flanke
  ctx.beginPath();
  left.slice(Math.floor(left.length * 0.45)).forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.strokeStyle = rgba(l.veins || l.volcano ? C.accent : CREAM, l.veins || l.volcano ? 0.22 : 0.14);
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

// ---------- Spitzen, Stalagmiten, Kristalle ----------
function layerSpikes(l, i, C, col, rng) {
  const P = l.P, n = Math.max(3, Math.round(P / l.spacing)), base = GROUND_Y + 8;
  const items = [];
  for (let k = 0; k < n; k++) {
    const sp = P / n;
    items.push({ cx: (k + 0.5) * sp + (rng() - 0.5) * sp * 0.6, h: l.amp * (0.4 + 0.6 * rng()), hw: l.spacing * (0.26 + 0.2 * rng()),
      crystal: !!l.crystals && rng() > 0.45, s: (rng() * 1e6) | 0 });
  }
  items.sort((a, b) => b.h - a.h);
  for (const it of items) {
    wrapEach(it.cx, P, it.hw * 3, x => (it.crystal ? crystalCluster(x, base, it.h, it.hw, C, col, it.s) : spike(x, base, it, l, C, col)));
  }
}

function spike(x, base, it, l, C, col) {
  const r = mulberry32(it.s), h = it.h, hw = it.hw, top = base - h, lean = (r() - 0.5) * hw * 0.5;
  const lit = shade(col, 0.12), dark = shade(col, -0.25), tipR = l.rock ? hw * 0.18 : 0;
  ctx.beginPath();
  ctx.moveTo(x - hw, base);
  ctx.quadraticCurveTo(x - hw * 0.35, base - h * 0.45, x + lean - tipR, top + tipR);
  ctx.quadraticCurveTo(x + lean, top - tipR * 0.4, x + lean + tipR, top + tipR);
  ctx.quadraticCurveTo(x + hw * 0.35, base - h * 0.45, x + hw, base);
  ctx.closePath();
  ctx.fillStyle = hgrad(x - hw, x + hw, [[0, lit], [0.5, col], [1, dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(INK, 0.16);
  ctx.beginPath();
  ctx.moveTo(x + lean * 0.8 + hw * 0.08, top);
  ctx.quadraticCurveTo(x + hw * 0.2, base - h * 0.4, x + hw * 0.25, base);
  ctx.lineTo(x + hw * 1.2, base);
  ctx.lineTo(x + hw * 1.2, top);
  ctx.closePath();
  ctx.fill();
  if (l.rock) {
    const rings = [];
    for (let yy = top + 12; yy < base; yy += 9 + r() * 7) { const w = hw * (yy - top) / h; rings.push([x - w * 0.9, yy, x + w * 0.9, yy + 2]); }
    segs(rings, rgba(CREAM, 0.08), 1);
  }
  ctx.restore();
  if (l.cracks) {
    let px = x - hw * 0.2, py = base;
    const pts = [[px, py]];
    while (py > top + h * 0.35) { px += (r() - 0.5) * hw * 0.3; py -= 6 + r() * 8; pts.push([px, py]); }
    for (const [lw, c] of [[5, rgba(C.accent, 0.2)], [1.6, rgba(C.accent, 0.85)], [0.7, rgba(C.accentLight, 0.9)]]) {
      ctx.beginPath();
      pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.fillStyle = rgrad(x, base, 0, hw * 1.6, [[0, rgba(C.accent, 0.25)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - hw * 1.6, base - hw * 1.6, hw * 3.2, hw * 1.6);
  }
  line(x - hw * 0.62, base - h * 0.2, x + lean - tipR - 1, top + tipR + 3, rgba(CREAM, 0.16), 1.2);
}

function crystalCluster(x, base, h, hw, C, col, seed) {
  const r = mulberry32(seed), cf = mix(C.accent, CREAM, 0.12), cs = mix(C.accent, col, 0.45);
  ctx.fillStyle = rgrad(x, base - h * 0.4, 0, h * 0.9, [[0, rgba(C.accent, 0.28)], [1, rgba(C.accent, 0)]]);
  ctx.fillRect(x - h * 0.9, base - h * 1.3, h * 1.8, h * 1.3);
  const parts = [[-hw * 0.55, 0.65, -0.32], [hw * 0.6, 0.55, 0.38], [hw * 0.1, 0.4, 0.75], [0, 1, 0.02]];
  for (const [dx, sc, tilt] of parts) {
    const hh = h * sc, ww = hw * 0.32 * (0.7 + sc * 0.4);
    ctx.save();
    ctx.translate(x + dx, base + 2);
    ctx.rotate(tilt * (0.8 + r() * 0.4));
    poly([[-ww, 0], [-ww, -hh * 0.78], [0, -hh], [0, 0]], rgba(cf, 0.9));
    poly([[0, 0], [0, -hh], [ww, -hh * 0.78], [ww, 0]], rgba(cs, 0.92));
    line(-ww * 0.55, -hh * 0.1, -ww * 0.55, -hh * 0.7, rgba('#ffffff', 0.55), 1);
    poly([[-ww, -hh * 0.78], [0, -hh], [0, -hh * 0.86]], rgba('#ffffff', 0.35));
    ctx.restore();
  }
}

// ---------- Dschungelstämme ----------
function layerTrunks(l, i, C, col, rng) {
  const P = l.P, n = Math.round(P / l.spacing), yb = GROUND_Y + 14;
  const list = [];
  for (let k = 0; k < n; k++) {
    if (rng() < 0.15) continue;
    list.push({ x: (k + 0.5) * P / n + (rng() - 0.5) * P / n * 0.6, w: lerp(l.width[0], l.width[1], rng()), s: (rng() * 1e6) | 0, far: rng() < 0.4 });
  }
  list.sort((a, b) => (b.far - a.far));
  for (const t of list) wrapEach(t.x, P, t.w * 2 + 50, x => trunk(x, t, C, t.far ? mix(col, C.skyBottom, 0.3) : col, yb));
  // Lianen zwischen den Stämmen
  const lc = shade(col, -0.1);
  for (let k = 0; k < P / 70; k++) {
    const x = rng() * P, len = 60 + rng() * 150, bend = (rng() - 0.5) * 30;
    wrapEach(x, P, 30, xx => {
      ctx.strokeStyle = lc;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(xx, -4);
      ctx.quadraticCurveTo(xx + bend, len * 0.6, xx + bend * 0.4, len);
      ctx.stroke();
    });
  }
  ctx.fillStyle = vgrad(250, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, l.haze || 0.3)]]);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillRect(-8, 250, P + 16, yb - 250);
  ctx.globalCompositeOperation = 'source-over';
}

function trunk(x, t, C, col, yb) {
  const r = mulberry32(t.s), w = t.w, lit = shade(col, 0.12), dark = shade(col, -0.25);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.42, -10);
  ctx.lineTo(x + w * 0.42, -10);
  ctx.bezierCurveTo(x + w * 0.5, 300, x + w * 0.55, yb - 60, x + w * 1.4, yb);
  ctx.lineTo(x - w * 1.3, yb);
  ctx.bezierCurveTo(x - w * 0.55, yb - 60, x - w * 0.5, 300, x - w * 0.42, -10);
  ctx.closePath();
  ctx.fillStyle = hgrad(x - w * 0.6, x + w * 0.6, [[0, lit], [0.45, col], [1, dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const bark = [];
  for (let k = 0; k < 6; k++) {
    const bx = x - w * 0.4 + k * w * 0.16 + (r() - 0.5) * 2;
    let yy = -10;
    while (yy < yb) { const ny = yy + 14 + r() * 20; bark.push([bx + (r() - 0.5) * 2, yy, bx + (r() - 0.5) * 2, ny]); yy = ny + 2 + r() * 6; }
  }
  segs(bark, rgba(INK, 0.16), 1);
  const moss = [];
  for (let k = 0; k < 6; k++) moss.push([x - w * 0.25 + (r() - 0.5) * w * 0.3, 40 + r() * (yb - 80), w * (0.2 + r() * 0.2), 8 + r() * 18, 0]);
  ellipses(moss, rgba(mix(C.accent, col, 0.45), 0.35));
  ctx.restore();
  line(x - w * 0.36, -10, x - w * 0.42, yb - 70, rgba(CREAM, 0.1), 1.2);
  if (r() < 0.6) {
    const by = 60 + r() * 220, dir = r() < 0.5 ? -1 : 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2.5, w * 0.22);
    ctx.beginPath();
    ctx.moveTo(x + dir * w * 0.3, by);
    ctx.quadraticCurveTo(x + dir * w * 1.2, by - 10, x + dir * (w + 26), by - 36);
    ctx.stroke();
    const cx = x + dir * (w + 26), cy = by - 40;
    blobPath([[cx, cy, 12], [cx - 9, cy + 5, 9], [cx + 9, cy + 4, 9]]);
    ctx.fillStyle = mix(C.near, C.accent, 0.25);
    ctx.fill();
  }
}

// ---------- Hängende Massen: Blätterdach, Sturmwolken, Höhlendecke ----------
function layerHang(l, i, C, col, rng) {
  const P = l.P, c1 = Math.max(1, Math.round(P * l.freq)), c2 = c1 * 2 + 1;
  const f = x => { const u = x / P; return l.base + l.amp * (0.62 * pnoise(u * c1, c1, l.seed) + 0.38 * pnoise(u * c2, c2, l.seed + 1) - 0.5); };
  if (l.clouds) col = mix(C.far, C.skyTop, 0.2);
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  for (let x = -8; x <= P + 8; x += 4) ctx.lineTo(x, f(x));
  ctx.lineTo(P + 8, -10);
  ctx.closePath();
  ctx.fillStyle = vgrad(0, l.base + l.amp, [[0, shade(col, -0.25)], [1, col]]);
  ctx.fill();
  if (l.foliage) hangFoliage(f, l, C, col, rng);
  if (l.clouds) hangClouds(f, l, C, col, rng);
  if (l.points) hangRock(f, l, C, col, rng);
}

function hangFoliage(f, l, C, col, rng) {
  const P = l.P, puffs = [];
  for (let x = -6; x < P + 6; x += 10 + rng() * 8) puffs.push([x, f(x) + 2 + rng() * 6, 10 + rng() * 12]);
  const extra = puffs.filter(p => p[0] < 30).map(p => [p[0] + P, p[1], p[2]]).concat(puffs.filter(p => p[0] > P - 30).map(p => [p[0] - P, p[1], p[2]]));
  const all = puffs.concat(extra);
  blobPath(all.map(([x, y, r]) => [x, y + 3, r]));
  ctx.fillStyle = shade(col, -0.2);
  ctx.fill();
  blobPath(all);
  ctx.fillStyle = vgrad(l.base - l.amp, l.base + l.amp + 20, [[0, shade(col, -0.1)], [1, shade(col, 0.12)]]);
  ctx.fill();
  // Blattstruktur
  const tones = [shade(col, 0.22), shade(col, -0.18), mix(col, C.accent, 0.3)], lists = [[], [], []];
  for (let k = 0; k < P / 1.6; k++) {
    const x = rng() * P, y = rng() * (f(x) + 10);
    if (y > f(x) + 12) continue;
    lists[Math.floor(rng() * 3)].push([x, y, 3 + rng() * 3, 1.4 + rng(), rng() * TAU]);
  }
  lists.forEach((L, j) => ellipses(L, rgba(tones[j], j === 2 ? 0.45 : 0.5)));
  if (l.lianas) {
    const lc = mix(col, C.accent, 0.2), leaves = [];
    for (let k = 0; k < P / 46; k++) {
      const x = rng() * P, y0 = f(x), len = 40 + rng() * 150, bend = (rng() - 0.5) * 26;
      wrapEach(x, P, 30, xx => {
        ctx.strokeStyle = shade(lc, -0.2);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xx, y0);
        ctx.quadraticCurveTo(xx + bend, y0 + len * 0.55, xx + bend * 0.3, y0 + len);
        ctx.stroke();
        for (let t = 0.2; t < 1; t += 0.16) {
          const px = lerp(lerp(xx, xx + bend, t), lerp(xx + bend, xx + bend * 0.3, t), t), py = y0 + len * t;
          leaves.push([px + (t * 10 % 2 > 1 ? 4 : -4), py, 4.5, 2, t * 10 % 2 > 1 ? 0.6 : -0.6]);
        }
      });
    }
    ellipses(leaves, lc);
  }
}

function hangClouds(f, l, C, col, rng) {
  // Wolkenbank von oben: weiche Ballen entlang der Unterkante, Unterseiten dunkler
  const P = l.P, puffs = [];
  for (let x = -20; x < P + 20; x += 9 + rng() * 9) puffs.push([x, f(x) - 6 + rng() * 12, 18 + rng() * 20]);
  const all = puffs.concat(puffs.filter(p => p[0] < 50).map(p => [p[0] + P, p[1], p[2]]), puffs.filter(p => p[0] > P - 50).map(p => [p[0] - P, p[1], p[2]]));
  const under = shade(col, -0.22), lit = mix(col, C.skyBottom, 0.3);
  for (const [x, y, r] of all) {
    ctx.fillStyle = rgrad(x, y, r * 0.2, r, [[0, rgba(col, 1)], [0.7, rgba(col, 0.85)], [1, rgba(col, 0)]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const [x, y, r] of all) {
    ctx.fillStyle = rgrad(x + r * 0.15, y + r * 0.45, 0, r * 0.75, [[0, rgba(under, 0.5)], [1, rgba(under, 0)]]);
    ctx.fillRect(x - r, y - r * 0.4, r * 2, r * 1.6);
  }
  for (const [x, y, r] of all) {
    ctx.fillStyle = rgrad(x - r * 0.35, y + r * 0.2, 0, r * 0.5, [[0, rgba(lit, 0.18)], [1, rgba(lit, 0)]]);
    ctx.fillRect(x - r, y - r * 0.4, r * 1.4, r * 1.2);
  }
}

function hangRock(f, l, C, col, rng) {
  const P = l.P, lit = shade(col, 0.12), dark = shade(col, -0.28);
  for (let x = 4; x < P; x += 16 + rng() * 22) {
    if (rng() < 0.3) continue;
    const y = f(x) - 3, len = 16 + rng() * 60, hw = 4 + rng() * 7, seed = (rng() * 1e6) | 0;
    wrapEach(x, P, hw + 2, xx => {
      const rr = mulberry32(seed), lean = (rr() - 0.5) * 4;
      ctx.beginPath();
      ctx.moveTo(xx - hw, y);
      ctx.quadraticCurveTo(xx - hw * 0.3, y + len * 0.5, xx + lean, y + len);
      ctx.quadraticCurveTo(xx + hw * 0.3, y + len * 0.5, xx + hw, y);
      ctx.closePath();
      ctx.fillStyle = hgrad(xx - hw, xx + hw, [[0, lit], [0.55, col], [1, dark]]);
      ctx.fill();
      circle(xx + lean, y + len - 1.2, 1.3, rgba(mix(C.accent, CREAM, 0.4), 0.7));
    });
  }
  ridgeLine(f, -8, P + 8, 4, -1, rgba(CREAM, 0.08), 2);
}

// ---------- Tafelberge ----------
function layerMesas(l, i, C, col, rng) {
  const P = l.P, n = Math.max(2, Math.round(P / l.spacing)), base = l.base, yb = GROUND_Y + 14;
  ctx.fillStyle = vgrad(base - 6, yb, [[0, col], [1, shade(col, -0.16)]]);
  ctx.fillRect(-8, base - 2, P + 16, yb - base + 2);
  const bands = [mix(col, C.accent, 0.3), shade(col, 0.1), mix(col, CREAM, 0.22), shade(col, -0.08), mix(col, C.accent, 0.15)];
  for (let k = 0; k < n; k++) {
    if (rng() < 0.2) continue;
    const sp = P / n, cx = (k + 0.5) * sp + (rng() - 0.5) * sp * 0.4, hw = l.spacing * (0.17 + 0.18 * rng());
    const h = l.amp * (0.45 + 0.55 * rng()), top = base - h, sl = 12 + h * 0.14, seed = (rng() * 1e6) | 0;
    wrapEach(cx, P, hw + sl + 4, x => {
      const r = mulberry32(seed), body = [[x - hw - sl, base + 2], [x - hw, top + 8], [x - hw + 4, top], [x + hw - 4, top], [x + hw, top + 8], [x + hw + sl, base + 2]];
      poly(body, hgrad(x - hw - sl, x + hw + sl, [[0, shade(col, 0.1)], [0.5, col], [1, shade(col, -0.18)]]));
      ctx.save();
      poly(body);
      ctx.clip();
      let yy = top + 6;
      while (yy < base) {
        const bh = 5 + r() * 10;
        ctx.fillStyle = rgba(bands[Math.floor(r() * bands.length)], 0.5);
        ctx.beginPath();
        ctx.moveTo(x - hw - sl, yy);
        ctx.quadraticCurveTo(x, yy + (r() - 0.5) * 4, x + hw + sl, yy + (r() - 0.5) * 3);
        ctx.lineTo(x + hw + sl, yy + bh);
        ctx.lineTo(x - hw - sl, yy + bh);
        ctx.closePath();
        ctx.fill();
        yy += bh;
      }
      ctx.fillStyle = rgba(INK, 0.18);
      ctx.beginPath();
      ctx.moveTo(x + hw * 0.45, top);
      ctx.lineTo(x + hw + 2, top);
      ctx.lineTo(x + hw + sl + 2, base + 2);
      ctx.lineTo(x + hw * 0.6, base + 2);
      ctx.closePath();
      ctx.fill();
      const gul = [];
      for (let g = 0; g < 6; g++) { const gx = x - hw + r() * hw * 2; gul.push([gx, top + 6 + r() * 10, gx + (r() - 0.5) * 6, top + 20 + r() * h * 0.6]); }
      segs(gul, rgba(INK, 0.14), 1.2);
      ctx.fillStyle = rgba(INK, 0.22);
      ctx.fillRect(x - hw, top + 6, hw * 2, 3);
      ctx.restore();
      line(x - hw + 4, top + 0.6, x + hw - 4, top + 0.6, rgba(CREAM, 0.4), 1.4);
      const scree = [];
      for (let g = 0; g < 26; g++) scree.push([x - hw - sl + r() * (hw + sl) * 2, base - r() * 8, 0.8 + r() * 1.6]);
      dots(scree, rgba(shade(col, -0.25), 0.6));
    });
  }
}

// ---------- Riff (Ozean, fern) ----------
function layerReef(l, i, C, col, rng) {
  const P = l.P, f = ridgeFn(P, l.base, l.amp, l.freq, l.seed), yb = GROUND_Y + 14;
  // Schwämme und Fächer hinter dem Riff
  for (let k = 0; k < P / 36; k++) {
    const x = rng() * P, y = f(x) + 4, kind = rng(), s = 0.7 + rng() * 0.7, seed = (rng() * 1e6) | 0;
    wrapEach(x, P, 30, xx => {
      const r = mulberry32(seed), c = mix(col, C.pipe, 0.25 + r() * 0.2);
      if (kind < 0.5) {
        for (let t = 0; t < 3; t++) {
          const tx = xx + (t - 1) * 6 * s, th = (16 + r() * 22) * s;
          roundRectPath(tx - 3 * s, y - th, 6 * s, th + 4, 3 * s);
          ctx.fillStyle = c;
          ctx.fill();
          ellipse(tx, y - th + 1, 2.6 * s, 1.2 * s, 0, shade(c, -0.35));
        }
      } else {
        ctx.save();
        ctx.translate(xx, y);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.ellipse(0, 0, 22 * s, 26 * s, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = rgba(c, 0.75);
        ctx.fill();
        const rays = [];
        for (let a = Math.PI + 0.2; a < TAU - 0.1; a += 0.3) rays.push([0, 0, Math.cos(a) * 20 * s, Math.sin(a) * 24 * s]);
        segs(rays, rgba(shade(c, -0.3), 0.5), 0.8);
        ctx.restore();
      }
    });
  }
  ridgePath(f, -8, P + 8, 4, yb);
  ctx.fillStyle = vgrad(l.base - l.amp, yb, [[0, shade(col, 0.08)], [1, shade(col, -0.2)]]);
  ctx.fill();
  const knobs = [];
  for (let x = 0; x < P; x += 8 + rng() * 10) knobs.push([x, f(x) + 3, 4 + rng() * 7]);
  dots(knobs.map(([x, y, r]) => [x + 1, y + 1, r]), shade(col, -0.12));
  dots(knobs, rgba(shade(col, 0.08), 0.9));
  ridgeLine(f, -8, P + 8, 4, 0, rgba(CREAM, 0.12), 2);
  if (l.haze) {
    ctx.fillStyle = vgrad(l.base - l.amp - 40, yb, [[0, rgba(C.haze, 0.15)], [1, rgba(C.haze, l.haze)]]);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(-8, l.base - l.amp - 50, P + 16, yb);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------- Seetang ----------
function layerStrands(l, i, C, col, rng) {
  const P = l.P, n = Math.round(P / l.spacing), base = GROUND_Y + 10;
  const kelp = mix('#7a8c40', C.mid, 0.42);
  for (let k = 0; k < n; k++) {
    if (rng() < 0.2) continue;
    const x = (k + 0.5) * P / n + (rng() - 0.5) * P / n * 0.7, hh = lerp(l.height[0], l.height[1], rng()), sw = (rng() - 0.5) * 34, seed = (rng() * 1e6) | 0;
    const dim = rng() < 0.4;
    wrapEach(x, P, 40, xx => kelpStrand(xx, base, hh, sw, dim ? mix(kelp, C.far, 0.4) : kelp, seed, C));
  }
}

function kelpStrand(x, base, hh, sw, c, seed, C) {
  const r = mulberry32(seed), p = [x, base, x - sw * 0.6, base - hh * 0.35, x + sw, base - hh * 0.7, x + sw * 0.6, base - hh];
  const bz = (a, b, cc, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * cc + t * t * t * d; };
  const leavesL = [], leavesR = [], bl = [];
  for (let k = 1; k <= Math.floor(hh / 15); k++) {
    const t = k / Math.floor(hh / 15 + 1), px = bz(p[0], p[2], p[4], p[6], t), py = bz(p[1], p[3], p[5], p[7], t), side = k % 2 ? 1 : -1;
    (side > 0 ? leavesR : leavesL).push([px + side * 7, py - 3, 9 + r() * 4, 2.6, side * -0.7]);
    if (k % 3 === 0) bl.push([px + side * 2, py, 2]);
  }
  ellipses(leavesL, shade(c, 0.12));
  ctx.strokeStyle = shade(c, -0.15);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
  ctx.stroke();
  ellipses(leavesR, shade(c, -0.08));
  dots(bl, mix(c, C.accent, 0.3));
}

// ---------- Stadt ----------
function layerCity(l, i, C, col, rng) {
  const P = l.P, n = Math.round(P / l.spacing), yb = GROUND_Y + 14;
  const body = i === 0 ? mix(C.far, C.skyTop, 0.2) : i === 1 ? mix(C.far, C.near, 0.5) : C.near;
  const winWarm = mix(CREAM, '#ffcf7a', 0.55), winCool = mix(C.pipe, CREAM, 0.45);
  for (let k = 0; k < n; k++) {
    const sp = P / n, x = k * sp + (rng() - 0.5) * sp * 0.25, bw = sp * (0.66 + 0.32 * rng()), bh = l.amp * (0.35 + 0.65 * rng()), seed = (rng() * 1e6) | 0;
    wrapEach(x + bw / 2, P, bw / 2 + 20, cx => building(cx - bw / 2, l.base - bh, bw, yb, body, l, i, C, seed, winWarm, winCool));
  }
}

function building(x, top, bw, yb, body, l, i, C, seed, winWarm, winCool) {
  const r = mulberry32(seed), side = shade(body, -0.25);
  ctx.fillStyle = vgrad(top, yb, [[0, shade(body, 0.04)], [1, mix(body, C.accent, 0.1)]]);
  ctx.fillRect(x, top, bw, yb - top);
  ctx.fillStyle = side;
  ctx.fillRect(x + bw * 0.8, top, bw * 0.2, yb - top);
  line(x + 0.5, top, x + 0.5, yb, rgba(mix(C.pipe, CREAM, 0.5), 0.12), 1);
  ctx.fillStyle = rgba(CREAM, 0.08);
  ctx.fillRect(x, top, bw, 1.5);
  const ww = i === 0 ? 2 : 3, wh = i === 0 ? 3 : 4, gx = i === 0 ? 6 : 8, gy = i === 0 ? 9 : 10;
  const warm = [], cool = [], pink = [], off = [];
  for (let yy = top + 7; yy < GROUND_Y - 6; yy += gy) {
    for (let xx = x + 4; xx < x + bw * 0.76 - ww; xx += gx) {
      const v = r();
      const rect = [xx, yy, ww, wh];
      if (v < l.windows * 0.62) warm.push(rect);
      else if (v < l.windows * 0.92) cool.push(rect);
      else if (v < l.windows) pink.push(rect);
      else off.push(rect);
    }
  }
  const fillRects = (list, c) => { ctx.fillStyle = c; for (const q of list) ctx.fillRect(q[0], q[1], q[2], q[3]); };
  fillRects(off, rgba(CREAM, 0.05));
  fillRects(warm, rgba(winWarm, i === 0 ? 0.55 : 0.8));
  fillRects(cool, rgba(winCool, i === 0 ? 0.5 : 0.75));
  fillRects(pink, rgba(mix(C.accent, CREAM, 0.3), 0.8));
  if (l.signs && r() > 0.45) {
    const sx = x + bw * 0.1, sy = top + 14 + r() * 30, sw = bw * 0.56, col = r() < 0.5 ? C.accent : C.pipe;
    ctx.strokeStyle = rgba(col, 0.2);
    ctx.lineWidth = 7;
    ctx.strokeRect(sx, sy, sw, 11);
    ctx.fillStyle = rgba(INK, 0.6);
    ctx.fillRect(sx, sy, sw, 11);
    ctx.strokeStyle = mix(col, CREAM, 0.35);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(sx, sy, sw, 11);
    const bars = [];
    for (let bx = sx + 4; bx < sx + sw - 6; bx += 5 + r() * 4) bars.push([bx, sy + 4, 2.5 + r() * 2, 3]);
    fillRects(bars, mix(col, CREAM, 0.5));
  }
  if (l.roofs) {
    if (r() > 0.4) {
      const tx = x + bw * (0.2 + r() * 0.4), ty = top - 16;
      ctx.fillStyle = shade(body, 0.1);
      roundRectPath(tx, ty, 14, 11, 3);
      ctx.fill();
      segs([[tx + 2, ty + 11, tx + 1, top], [tx + 12, ty + 11, tx + 13, top]], shade(body, 0.1), 1.4);
      ctx.fillStyle = rgba(CREAM, 0.12);
      ctx.fillRect(tx + 2, ty + 2, 3, 7);
    }
    if (r() > 0.4) {
      const ax = x + bw * (0.65 + r() * 0.2);
      line(ax, top, ax, top - 24, shade(body, 0.15), 1.4);
      ctx.fillStyle = rgrad(ax, top - 25, 0, 7, [[0, rgba('#ff5a6a', 0.6)], [1, rgba('#ff5a6a', 0)]]);
      ctx.fillRect(ax - 7, top - 32, 14, 14);
      circle(ax, top - 25, 1.6, '#ff8a8a');
    }
    const ac = [];
    for (let k = 0; k < 2; k++) if (r() > 0.5) ac.push([x + 4 + r() * (bw - 20), top - 6, 10, 6]);
    fillRects(ac, shade(body, 0.08));
  }
}

// ---------- Sterne ----------
function layerStars(l, i, C, rng) {
  const P = l.P, cols = [CREAM, mix(CREAM, C.pipe, 0.35), mix(CREAM, C.accent, 0.35)];
  const lists = [[], [], []], big = [];
  for (let cx = 0; cx < P; cx += l.cell) {
    for (let cy = 0; cy < GROUND_Y; cy += l.cell) {
      if (rng() > l.chance) continue;
      const x = cx + rng() * l.cell, y = cy + rng() * l.cell, s = lerp(l.size[0], l.size[1], rng());
      if (s > 1.7 && rng() < 0.35) big.push([x, y, s]);
      else lists[Math.floor(rng() * 3)].push([x, y, s * 0.5]);
    }
  }
  lists.forEach((L, j) => dots(L, rgba(cols[j], 0.75)));
  for (const [x, y, s] of big) {
    wrapEach(x, P, 12, xx => {
      ctx.fillStyle = rgrad(xx, y, 0, s * 5, [[0, rgba(CREAM, 0.4)], [1, rgba(CREAM, 0)]]);
      ctx.fillRect(xx - s * 5, y - s * 5, s * 10, s * 10);
      segs([[xx - s * 3.5, y, xx + s * 3.5, y], [xx, y - s * 3.5, xx, y + s * 3.5]], rgba(CREAM, 0.3), 0.6);
      circle(xx, y, s * 0.6, CREAM);
    });
  }
  if (l.dust) {
    for (let k = 0; k < 5; k++) {
      const x = rng() * P, y = 60 + rng() * 380, rx = 60 + rng() * 80;
      wrapEach(x, P, rx, xx => {
        ctx.save();
        ctx.translate(xx, y);
        ctx.rotate(-0.4 + rng() * 0.2);
        ctx.transform(1, 0, 0, 0.22, 0, 0);
        ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(mix(C.far, C.accent, 0.3), 0.18)], [1, rgba(C.far, 0)]]);
        ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
      });
    }
  }
}

// ---------- Raumstation im Vordergrund ----------
function layerStation(l, i, C, col, rng) {
  const P = l.P, beamY = GROUND_Y - 34, metal = mix(C.pipe, C.near, 0.55), dark = shade(metal, -0.35);
  ctx.fillStyle = vgrad(beamY - 4, beamY + 8, [[0, shade(metal, 0.15)], [1, dark]]);
  ctx.fillRect(-8, beamY - 4, P + 16, 10);
  ctx.fillRect(-8, GROUND_Y - 4, P + 16, 10);
  const truss = [];
  for (let x = -8; x < P + 8; x += 24) { truss.push([x, beamY + 5, x + 24, GROUND_Y - 4]); truss.push([x + 24, beamY + 5, x, GROUND_Y - 4]); truss.push([x, beamY, x, GROUND_Y]); }
  segs(truss, rgba(metal, 0.85), 1.6);
  line(-8, beamY - 3.5, P + 8, beamY - 3.5, rgba(CREAM, 0.3), 1);
  for (let k = 0; k < P / 150; k++) {
    const x = (k + 0.3 + rng() * 0.4) * 150, kind = rng(), seed = (rng() * 1e6) | 0;
    wrapEach(x, P, 50, xx => {
      const r = mulberry32(seed);
      if (kind < 0.4) {
        const hgt = 40 + r() * 30;
        line(xx, beamY - 4, xx, beamY - hgt, metal, 2);
        ctx.save();
        ctx.translate(xx, beamY - hgt);
        ctx.rotate(-0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI);
        ctx.closePath();
        ctx.fillStyle = shade(metal, 0.2);
        ctx.fill();
        ctx.restore();
        circle(xx, beamY - hgt - 2, 1.8, C.accent);
      } else if (kind < 0.75) {
        const pw = 46, ph = 22, py = beamY - 30;
        line(xx, beamY - 4, xx, py + ph / 2, metal, 2);
        for (const side of [-1, 1]) {
          const px = side < 0 ? xx - pw - 4 : xx + 4;
          ctx.fillStyle = mix(INK, C.pipe, 0.35);
          ctx.fillRect(px, py, pw, ph);
          const grid = [];
          for (let gx = px + 6; gx < px + pw; gx += 6) grid.push([gx, py, gx, py + ph]);
          grid.push([px, py + ph / 2, px + pw, py + ph / 2]);
          segs(grid, rgba(C.pipe, 0.4), 0.7);
          ctx.strokeStyle = rgba(CREAM, 0.3);
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, pw, ph);
        }
      } else {
        ctx.fillStyle = rgrad(xx, beamY - 8, 0, 10, [[0, rgba(C.accent, 0.5)], [1, rgba(C.accent, 0)]]);
        ctx.fillRect(xx - 10, beamY - 18, 20, 20);
        circle(xx, beamY - 8, 2.2, mix(C.accent, CREAM, 0.4));
        line(xx, beamY - 4, xx, beamY - 7, metal, 2);
      }
    });
  }
}

// ---------- Vordergrund-Requisiten ----------
function layerProps(l, i, C, col, rng) {
  const P = l.P, base = GROUND_Y + 6;
  const items = [];
  for (let x = 0; x < P; x += l.spacing * (0.6 + rng() * 0.8)) items.push([x, 0.7 + rng() * 0.6, (rng() * 1e6) | 0, rng()]);
  for (const [x, s, seed, v] of items) wrapEach(x, P, 60 * s, xx => prop(l.prop, xx, base, s, mulberry32(seed), v, C, col));
}

function prop(kind, x, base, s, r, v, C, col) {
  const side = shade(col, -CONFIG.SIDE_DARKEN), hi = shade(col, 0.18);
  switch (kind) {
    case 'meadow': {
      if (v < 0.45) {
        ellipse(x + 8, base - 2, 22 * s, 5 * s, 0, rgba(INK, 0.18));
        const bl = [[x - 10 * s, base - 8 * s, 10 * s], [x + 10 * s, base - 8 * s, 11 * s], [x, base - 14 * s, 13 * s], [x - 3 * s, base - 22 * s, 8 * s]];
        blobPath(bl.map(([a, b, c]) => [a + 2, b + 2, c]));
        ctx.fillStyle = side;
        ctx.fill();
        blobPath(bl);
        ctx.fillStyle = rgrad(x, base - 14 * s, 2, 22 * s, [[0, hi], [0.6, col], [1, side]], x - 8 * s, base - 22 * s);
        ctx.fill();
        const lv = [];
        for (let k = 0; k < 14; k++) lv.push([x + (r() - 0.5) * 30 * s, base - 4 * s - r() * 24 * s, 1.2 + r()]);
        dots(lv, rgba(shade(col, r() < 0.5 ? 0.3 : -0.3), 0.5));
        if (r() < 0.6) {
          const fl = [];
          for (let k = 0; k < 4; k++) fl.push([x + (r() - 0.5) * 24 * s, base - 8 * s - r() * 16 * s, 1.8]);
          dots(fl, mix(C.accent, CREAM, 0.2));
        }
      } else if (v < 0.8) {
        const st = [], heads = [];
        for (let k = 0; k < 4; k++) {
          const fx = x + (r() - 0.5) * 18 * s, fh = (16 + r() * 18) * s;
          st.push([fx, base, fx + (r() - 0.5) * 4, base - fh]);
          heads.push([fx + (r() - 0.5) * 2, base - fh, 2.6 * s, k]);
        }
        segs(st, shade(col, -0.1), 1.1);
        const petals = [CREAM, C.accent, mix(C.accent, '#e86f8a', 0.6), mix(CREAM, '#b7a6ff', 0.4)];
        for (const [hx, hy, hr, k] of heads) {
          const pc = petals[(k + Math.floor(v * 10)) % petals.length], pl = [];
          for (let a = 0; a < 5; a++) pl.push([hx + Math.cos(a * 1.257) * hr, hy + Math.sin(a * 1.257) * hr, hr * 0.7]);
          dots(pl, pc);
          circle(hx, hy, hr * 0.55, mix(C.accent, '#a8622c', 0.4));
        }
      } else {
        const bl = [];
        for (let k = -4; k <= 4; k++) bl.push([x + k * 2.2, base, x + k * 3.2 + (r() - 0.5) * 3, base - (12 - Math.abs(k) * 1.6) * s - r() * 6]);
        segs(bl.slice(0, 5), shade(col, 0.12), 1.4);
        segs(bl.slice(5), side, 1.4);
      }
      break;
    }
    case 'fir': {
      const h = (60 + v * 50) * s, w = h * 0.42, dk = mix('#2f5a54', C.far, 0.25), snow = mix(CREAM, '#ffffff', 0.3), snowS = mix(CREAM, C.skyTop, 0.4);
      ellipse(x + 10, base - 2, w * 0.9, 4, 0, rgba(C.skyTop, 0.25));
      ctx.fillStyle = shade(dk, -0.4);
      ctx.fillRect(x - 2.5, base - 12, 5, 12);
      const tiers = 5;
      for (let t = 0; t < tiers; t++) {
        const ty = base - 8 - t * h / (tiers + 0.6), tw = w * (1 - t / (tiers + 0.4)), th = h / tiers * 1.5;
        poly([[x - tw, ty], [x, ty - th], [x + tw, ty]], dk);
        poly([[x, ty - th], [x + tw, ty], [x + tw * 0.15, ty]], shade(dk, -0.25));
        poly([[x - tw * 0.85, ty - 2], [x - tw * 0.2, ty - th * 0.62], [x, ty - th], [x + tw * 0.15, ty - th * 0.8], [x + tw * 0.7, ty - 3], [x + tw * 0.25, ty - th * 0.25], [x - tw * 0.3, ty - th * 0.3]], snow);
        poly([[x, ty - th], [x + tw * 0.15, ty - th * 0.8], [x + tw * 0.7, ty - 3], [x + tw * 0.25, ty - th * 0.25]], snowS);
      }
      break;
    }
    case 'fern': {
      if (v < 0.6) {
        const fronds = 6 + Math.floor(r() * 3), lf = [], rf = [];
        for (let k = 0; k < fronds; k++) {
          const a = -Math.PI / 2 + (k / (fronds - 1) - 0.5) * 2.2, len = (34 + r() * 26) * s;
          const ex = x + Math.cos(a) * len, ey = base + Math.sin(a) * len * 0.95, mx = x + Math.cos(a) * len * 0.5, my = base + Math.sin(a) * len * 0.75 - 6;
          ctx.strokeStyle = shade(col, -0.15);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, base);
          ctx.quadraticCurveTo(mx, my, ex, ey + 8);
          ctx.stroke();
          for (let t = 0.2; t < 1; t += 0.1) {
            const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex, py = (1 - t) * (1 - t) * base + 2 * (1 - t) * t * my + t * t * (ey + 8);
            const ll = (1 - t) * 7 * s + 2;
            lf.push([px - 2, py - 1, ll, 1.5, a - 0.9]);
            rf.push([px + 2, py + 1, ll, 1.5, a + 0.9]);
          }
        }
        ellipses(lf, mix(col, C.accent, 0.3));
        ellipses(rf, col);
      } else {
        const lh = (40 + r() * 30) * s, lw = 16 * s;
        line(x, base, x + 6, base - lh * 0.6, shade(col, -0.2), 2);
        ctx.save();
        ctx.translate(x + 6, base - lh * 0.6);
        ctx.rotate(-0.4 + r() * 0.8);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-lw, -lh * 0.2, -lw * 0.6, -lh * 0.7, 0, -lh * 0.8);
        ctx.bezierCurveTo(lw * 0.6, -lh * 0.7, lw, -lh * 0.2, 0, 0);
        ctx.fillStyle = hgrad(-lw, lw, [[0, mix(col, C.accent, 0.35)], [1, shade(col, -0.1)]]);
        ctx.fill();
        line(0, 0, 0, -lh * 0.75, rgba(INK, 0.25), 1);
        ctx.restore();
        if (r() < 0.4) {
          line(x - 12, base, x - 12, base - 10, CREAM, 2);
          ellipse(x - 12, base - 11, 6, 3.5, 0, mix(C.accent, '#d8673f', 0.5));
          dots([[x - 14, base - 12, 0.9], [x - 10, base - 11.5, 0.8]], CREAM);
        }
      }
      break;
    }
    case 'cactus': {
      if (v < 0.5) {
        const tw = 10 * s, th = (44 + r() * 30) * s, cc = mix(col, '#5f8a4a', 0.55);
        ellipse(x + 10, base - 1, 14 * s, 3.5 * s, 0, rgba(INK, 0.2));
        const arm = (dir, ay, ah) => {
          ctx.strokeStyle = cc;
          ctx.lineWidth = 7 * s;
          ctx.beginPath();
          ctx.moveTo(x, base - ay);
          ctx.lineTo(x + dir * 11 * s, base - ay);
          ctx.lineTo(x + dir * 11 * s, base - ay - ah);
          ctx.stroke();
        };
        arm(-1, th * 0.4, th * 0.25);
        if (r() > 0.35) arm(1, th * 0.55, th * 0.2);
        roundRectPath(x - tw / 2, base - th, tw, th + 2, tw / 2);
        ctx.fillStyle = hgrad(x - tw / 2, x + tw / 2, [[0, shade(cc, 0.2)], [0.6, cc], [1, shade(cc, -0.25)]]);
        ctx.fill();
        segs([[x - tw * 0.18, base - th + 4, x - tw * 0.18, base - 2], [x + tw * 0.18, base - th + 4, x + tw * 0.18, base - 2]], rgba(INK, 0.2), 0.8);
        if (r() < 0.5) circle(x, base - th - 1, 2.4, mix(C.accent, '#f0a0c0', 0.5));
      } else if (v < 0.8) {
        const rr = (8 + r() * 6) * s;
        poly([[x - rr * 1.6, base + 2], [x - rr, base - rr * 0.9], [x + rr * 0.3, base - rr * 1.2], [x + rr * 1.5, base - rr * 0.4], [x + rr * 1.8, base + 2]], hgrad(x - rr * 1.6, x + rr * 1.8, [[0, shade(col, 0.15)], [1, shade(col, -0.25)]]));
        line(x - rr, base - rr * 0.9, x + rr * 0.3, base - rr * 1.2, rgba(CREAM, 0.3), 1);
      } else {
        const bl = [];
        for (let k = -3; k <= 3; k++) bl.push([x + k * 2, base, x + k * 4.5, base - (9 - Math.abs(k)) * s - r() * 4]);
        segs(bl, mix(col, '#b39a5a', 0.4), 1.1);
      }
      break;
    }
    case 'coral': {
      const cc = mix(C.pipe, C.near, 0.25 + r() * 0.2);
      if (v < 0.4) {
        const br = (dx, dy, len, a, d) => {
          const ex = dx + Math.cos(a) * len, ey = dy + Math.sin(a) * len;
          ctx.strokeStyle = cc;
          ctx.lineWidth = Math.max(1.5, 4.5 - d);
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          if (d < 3) { br(ex, ey, len * 0.72, a - 0.45, d + 1); br(ex, ey, len * 0.72, a + 0.4, d + 1); }
          else circle(ex, ey, 2, mix(cc, CREAM, 0.3));
        };
        br(x, base, 16 * s, -Math.PI / 2, 0);
      } else if (v < 0.7) {
        ctx.save();
        ctx.translate(x, base);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.ellipse(0, -2, 22 * s, 30 * s, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(C.accent, CREAM, 0.1), 0.7);
        ctx.fill();
        const rays = [];
        for (let a = Math.PI + 0.15; a < TAU - 0.1; a += 0.22) rays.push([0, 0, Math.cos(a) * 21 * s, -2 + Math.sin(a) * 28 * s]);
        segs(rays, rgba(shade(C.accent, -0.35), 0.6), 0.8);
        ctx.restore();
      } else {
        const tent = [];
        for (let k = -5; k <= 5; k++) tent.push([x + k * 1.6, base - 4, x + k * 3.4 + (r() - 0.5) * 3, base - 16 * s - r() * 6]);
        ellipse(x, base - 3, 9 * s, 5 * s, 0, shade(cc, -0.15));
        segs(tent, mix(C.accent, CREAM, 0.25), 1.6);
        if (r() < 0.5) {
          ctx.save();
          ctx.translate(x + 16, base - 2);
          const st = [];
          for (let a = 0; a < 10; a++) { const rr = a % 2 ? 2.2 : 6; st.push([Math.cos(a * TAU / 10 - Math.PI / 2) * rr, Math.sin(a * TAU / 10 - Math.PI / 2) * rr * 0.6]); }
          poly(st, mix(C.accent, '#f08a5a', 0.6));
          ctx.restore();
        }
      }
      break;
    }
    case 'windgrass': {
      if (v < 0.75) {
        const bl = [];
        for (let k = -4; k <= 4; k++) {
          const bx = x + k * 2.6, hgt = (18 + r() * 24) * s;
          bl.push([bx, base, bx - hgt * 0.55, base - hgt]);
        }
        ctx.lineWidth = 1.5;
        for (const [a, b, c, d] of bl) {
          ctx.strokeStyle = hash(a) > 0.5 ? shade(col, 0.15) : side;
          ctx.beginPath();
          ctx.moveTo(a, b);
          ctx.quadraticCurveTo(a - (a - c) * 0.1, b - (b - d) * 0.6, c, d);
          ctx.stroke();
        }
      } else {
        const rr = (9 + r() * 7) * s;
        poly([[x - rr * 1.5, base + 2], [x - rr, base - rr], [x + rr * 0.4, base - rr * 1.15], [x + rr * 1.5, base + 2]], hgrad(x - rr, x + rr, [[0, shade(col, 0.15)], [1, shade(col, -0.3)]]));
        ellipse(x - rr * 0.3, base - rr * 0.9, rr * 0.6, rr * 0.2, -0.1, rgba(mix(col, C.accent, 0.2), 0.5));
      }
      break;
    }
    default: if (ART2.prop[kind]) ART2.prop[kind].paint(x, base, s, r, v, C, col);
  }
}

