// ============================================================
// Kunst für zwei Biome: Herbstwald (9) und Ruinen (12).
// Himmel, Parallaxebenen, Requisiten, Boden, Säulen, Kulissen mit Ablauf,
// Bosse (Pilzkönig, Steinwächter) und ihre Geschosse (Blatt, Glyphenstein).
// Alles steckt in einer IIFE; nach außen gehen nur Einträge in ART2 und SCENE
// sowie die Umlenkung der Darstellungsfelder am Dateiende.
// ============================================================
(() => {
  'use strict';
  const SD = CONFIG.SIDE_DARKEN;
  const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const pickOf = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

  // ---------- gemeinsame Werkzeuge ----------
  // Weicher, gestreckter Fleck (Nebel, Schein)
  function soft(x, y, rx, ry, col, a, rot) {
    if (a <= 0.002 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(1, Math.max(0.01, ry / rx));
    ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(col, a)], [0.5, rgba(col, a * 0.45)], [1, rgba(col, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  // Nebelschwaden; P > 0: periodisch im Streifen, sonst über die Himmelsbreite
  function mist(P, y, h, col, a, rng, n, rx0, rx1, flat) {
    for (let k = 0; k < n; k++) {
      const x = P ? rng() * P : -80 + rng() * (W + 160), yy = y + (rng() - 0.5) * h;
      const rx = rx0 + rng() * (rx1 - rx0), ry = rx * (flat || 0.12) * (0.7 + rng() * 0.6), al = a * (0.45 + rng() * 0.55);
      if (P) wrapEach(x, P, rx, xx => soft(xx, yy, rx, ry, col, al)); else soft(x, yy, rx, ry, col, al);
    }
  }
  // Lichtstrahlen als spitze Keile aus einem Punkt
  function rays(x, y, n, a0, a1, len, w0, col, alpha, rng) {
    for (let k = 0; k < n; k++) {
      const a = lerp(a0, a1, (k + 0.5) / n) + (rng() - 0.5) * 0.05, wd = w0 * (0.5 + rng());
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, nx = -Math.sin(a), ny = Math.cos(a);
      ctx.beginPath();
      ctx.moveTo(x + nx * 3, y + ny * 3);
      ctx.lineTo(ex + nx * wd, ey + ny * wd);
      ctx.lineTo(ex - nx * wd, ey - ny * wd);
      ctx.lineTo(x - nx * 3, y - ny * 3);
      ctx.closePath();
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, rgba(col, alpha * (0.5 + rng() * 0.5)));
      g.addColorStop(0.5, rgba(col, alpha * 0.25));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
  }
  // Pfad aus Punkten, mit quadratischen Kurven geglättet
  function smooth(pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    if (close) ctx.closePath();
  }
  // Rechtecke einer Farbe in einem Pfad
  function rects(list, col) {
    if (!list.length) return;
    ctx.beginPath();
    for (const q of list) ctx.rect(q[0], q[1], q[2], q[3]);
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Liste periodisch ergänzen: Elemente nahe den Rändern zusätzlich um ±P versetzt
  const wrapList = (list, P, pad) => list.concat(list.filter(e => e[0] < pad).map(e => [e[0] + P, ...e.slice(1)]), list.filter(e => e[0] > P - pad).map(e => [e[0] - P, ...e.slice(1)]));
  // Ablauf: feste Eröffnung, danach gewichteter Zufall ohne die letzten mem Motive;
  // pool darf eine Funktion von i sein (Stimmung ändert sich entlang des Levels)
  const flowHist = new WeakMap();
  function flow(opening, pool, mem) {
    const m = mem || 2;
    return (i, rng) => {
      let h = flowHist.get(rng);
      if (!h || i === 0) { h = []; flowHist.set(rng, h); }
      let k = opening[i];
      if (k === undefined) {
        const pl = typeof pool === 'function' ? pool(i) : pool;
        const avoid = h.slice(-m), cand = pl.filter(p => !avoid.includes(p[0]));
        let tot = 0;
        for (const p of cand) tot += p[1];
        let v = rng() * tot;
        k = cand[cand.length - 1][0];
        for (const p of cand) { v -= p[1]; if (v <= 0) { k = p[0]; break; } }
      }
      h.push(k);
      return k;
    };
  }
  // Luftperspektive: bereits Gemaltes Richtung Dunst ziehen
  function hazeOver(w, h, col, a0, a1, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = a1 === undefined ? rgba(col, a0) : vgrad(y0 === undefined ? 0 : y0, y1 === undefined ? h : y1, [[0, rgba(col, a0)], [1, rgba(col, a1)]]);
    ctx.fillRect(-2, -2, w + 4, h + 4);
    ctx.restore();
  }
  // Unterkante weich ausblenden (Alpha nach unten auf 0)
  function dissolve(w, h, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vgrad(y0, y1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    ctx.fillRect(-2, y0, w + 4, h - y0 + 4);
    ctx.restore();
  }
  // Oberkante weich ausblenden
  function dissolveTop(w, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vgrad(y0, y1, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(-2, y0 - 2, w + 4, y1 - y0 + 2);
    ctx.restore();
  }
  // Motive mit source-atop/destination-out: in der Menü-Miniatur über eine eigene Zwischenleinwand malen
  function isolate(K) {
    const paint = K.paint;
    K.paint = (w, h, r, C, L, it) => {
      const g = ctx, m = typeof g.getTransform === 'function' ? g.getTransform() : null, k = m ? m.a : 0;
      if (m && m.b === 0 && m.c === 0 && Math.abs(m.e) < 0.01 && Math.abs(m.f) < 0.01 && g.canvas &&
          g.canvas.width === Math.ceil(w * k) && g.canvas.height === Math.ceil(h * k)) { paint(w, h, r, C, L, it); return; }
      const ks = clamp(k || 1, 0.5, 4), c = newCanvas(Math.ceil(w * ks), Math.ceil(h * ks)), cg = c.getContext('2d');
      cg.setTransform(ks, 0, 0, ks, 0, 0);
      setupG(cg);
      withCtx(cg, () => paint(w, h, r, C, L, it));
      g.drawImage(c, 0, 0, c.width / ks, c.height / ks);
      freeCanvas(c);
    };
  }

  // ---------- Blätter ----------
  // Gezacktes Blatt als Einheitsform: Stiel bei x = -0.5, Spitze bei +0.5, halbe Breite bis 0.5.
  // Die Zähne zeigen zur Spitze.
  function leafUnit(n, jag, ex) {
    const right = [], m = n * 2 + 1;
    for (let i = 1; i < m; i++) {
      const u = i / m, tooth = i % 2 === 1;
      const wv = Math.sin(Math.PI * Math.pow(u, ex || 0.8)) * 0.5 * (tooth ? 1 + jag : 1 - jag * 0.45);
      right.push([-0.5 + u + (tooth ? 0.45 / m : 0), wv]);
    }
    return [[-0.5, 0], ...right, [0.5, 0], ...right.slice().reverse().map(([a, b]) => [a, -b])];
  }
  const LEAF_A = leafUnit(4, 0.34, 0.75), LEAF_B = leafUnit(3, 0.2, 0.9), LEAF_C = leafUnit(5, 0.42, 0.7);
  // Blattumriss an (x, y), Länge len, Breite wid, Winkel ang (ohne beginPath, damit viele in einen Pfad passen)
  function leafPath(x, y, len, wid, ang, shape) {
    const c = Math.cos(ang), s = Math.sin(ang), pts = shape || LEAF_A;
    for (let i = 0; i < pts.length; i++) {
      const px = pts[i][0] * len, py = pts[i][1] * wid, X = x + px * c - py * s, Y = y + px * s + py * c;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.closePath();
  }
  // Einzelnes Blatt mit Mittelrippe; Licht von oben links
  function leaf(x, y, len, wid, ang, col, shape, rib) {
    ctx.beginPath();
    leafPath(x + 0.5, y + 0.8, len, wid, ang, shape);
    ctx.fillStyle = rgba(INK, 0.22);
    ctx.fill();
    ctx.beginPath();
    leafPath(x, y, len, wid, ang, shape);
    ctx.fillStyle = col;
    ctx.fill();
    if (rib !== false && len > 6) {
      const c = Math.cos(ang), s = Math.sin(ang);
      line(x - c * len * 0.62, y - s * len * 0.62, x + c * len * 0.42, y + s * len * 0.42, rgba(shade(col, -0.35), 0.7), Math.max(0.5, len * 0.05));
    }
  }

  // Pilz: Stiel, Lamellenrand, Hut mit Licht oben links
  function shroom(x, base, hgt, cr, cap, stem, tilt, flat) {
    const tx = x + tilt * hgt, ty = base - hgt;
    ctx.beginPath();
    ctx.moveTo(x - cr * 0.3, base);
    ctx.quadraticCurveTo(x - cr * 0.2 + tilt * hgt * 0.5, base - hgt * 0.5, tx - cr * 0.18, ty);
    ctx.lineTo(tx + cr * 0.18, ty);
    ctx.quadraticCurveTo(x + cr * 0.24 + tilt * hgt * 0.5, base - hgt * 0.5, x + cr * 0.34, base);
    ctx.closePath();
    ctx.fillStyle = flat ? stem : hgrad(x - cr * 0.3, x + cr * 0.34, [[0, mix(stem, CREAM, 0.35)], [0.6, stem], [1, shade(stem, -0.25)]]);
    ctx.fill();
    ellipse(tx, ty + cr * 0.06, cr * 0.96, cr * 0.24, tilt * 0.5, shade(stem, -0.18));
    ctx.beginPath();
    ctx.ellipse(tx, ty, cr, cr * 0.7, tilt * 0.5, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = flat ? cap : rgrad(tx - cr * 0.35, ty - cr * 0.4, cr * 0.1, cr * 1.15, [[0, mix(cap, CREAM, 0.32)], [0.5, cap], [1, shade(cap, -0.32)]]);
    ctx.fill();
    if (!flat) ellipse(tx - cr * 0.35, ty - cr * 0.38, cr * 0.32, cr * 0.14, -0.3 + tilt * 0.5, rgba(CREAM, 0.3));
  }

  // Baumpilz (Konsole) an einer Stammkante: dir = 1 nach rechts, -1 nach links
  function bracket(x, y, wd, col, dir) {
    const rim = mix(col, CREAM, 0.45);
    ctx.beginPath();
    ctx.moveTo(x, y - wd * 0.3);
    ctx.quadraticCurveTo(x + dir * wd * 1.05, y - wd * 0.45, x + dir * wd, y + wd * 0.05);
    ctx.quadraticCurveTo(x + dir * wd * 0.6, y + wd * 0.2, x, y + wd * 0.12);
    ctx.closePath();
    ctx.fillStyle = vgrad(y - wd * 0.45, y + wd * 0.2, [[0, mix(col, CREAM, 0.2)], [0.6, col], [1, shade(col, -0.3)]]);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.35), 0.6);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let k = 1; k <= 2; k++) {
      const f = k / 3;
      ctx.moveTo(x, y - wd * 0.3 * (1 - f) + wd * 0.04);
      ctx.quadraticCurveTo(x + dir * wd * 1.05 * (1 - f * 0.5), y - wd * 0.45 * (1 - f) + wd * 0.02, x + dir * wd * (1 - f * 0.35), y + wd * 0.05);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(rim, 0.85);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x + dir * wd, y + wd * 0.05);
    ctx.quadraticCurveTo(x + dir * wd * 0.6, y + wd * 0.2, x, y + wd * 0.12);
    ctx.stroke();
  }

  // ============================================================
  // HERBSTWALD (9): tief stehende Sonne, Laubwald in Rot, Orange und Gelb,
  // Nebel in den Senken, Felder mit Strohballen, Bach mit Holzbrücke, Hochsitz.
  // Gemütlich, aber mit erster Melancholie: später im Level mehr kahle Bäume und Nebel.
  // ============================================================
  const auPalCache = new Map();
  function auPal(C, hz) {
    const key = C.skyTop + C.near + '|' + (hz || 0);
    let Q = auPalCache.get(key);
    if (Q) return Q;
    const haze = mix(C.haze, C.skyBottom, 0.35);
    Q = {
      red: mix('#b8442c', C.far, 0.1),
      crimson: mix('#93382c', C.near, 0.12),
      orange: mix(C.accent, C.far, 0.28),
      yellow: mix('#e2b04a', C.far, 0.1),
      gold: mix('#c99838', C.far, 0.2),
      olive: mix('#7e8444', C.far, 0.3),
      brownleaf: mix('#8a5a34', C.far, 0.25),
      fir: mix('#3a5446', C.near, 0.22),
      bark: mix('#55463c', C.near, 0.2),
      birch: mix(CREAM, C.skyBottom, 0.2),
      meadow: mix('#9c8448', C.far, 0.3),
      stubble: mix('#d6b06a', C.skyBottom, 0.25),
      straw: mix('#e0bb6c', CREAM, 0.12),
      wood: mix('#7a583c', C.near, 0.2),
      woodLight: mix('#a9835a', C.far, 0.15),
      roof: mix('#7e4632', C.near, 0.2),
      wall: mix(CREAM, C.far, 0.22),
      stone: mix('#958d80', C.far, 0.22),
      water: mix(C.skyTop, C.skyBottom, 0.42),
      moss: mix('#7a8a3c', C.far, 0.3),
      bracken: mix('#b4652c', C.far, 0.25),
      cap: mix('#8c4a28', C.far, 0.15),
      dark: mix(INK, C.near, 0.4),
      mist: mix(C.skyBottom, CREAM, 0.5),
      haze
    };
    if (hz) for (const k of Object.keys(Q)) if (k !== 'haze' && k !== 'mist') Q[k] = mix(Q[k], haze, hz);
    auPalCache.set(key, Q);
    return Q;
  }
  const auLeafCols = Q => [Q.red, Q.orange, Q.yellow, Q.gold, Q.crimson, Q.brownleaf];

  // Laubkrone aus Ballen: Schattenmasse, Hauptmasse mit Licht von oben links, helle Ballen, Farbtupfer
  function crown(cx, cy, rx, ry, col, col2, r, n, specks) {
    const lobes = [], rm = (rx + ry) * 0.5;
    for (let k = 0; k < n; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.7;
      lobes.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, rm * (0.26 + r() * 0.18)]);
    }
    // flache Lagen statt Verläufen (billig zu malen): Schattenmasse, Grundton, Lichtseite, Glanz
    blobPath(lobes.map(([x, y, rr]) => [x + rr * 0.16, y + rr * 0.22, rr]));
    ctx.fillStyle = shade(col, -0.32);
    ctx.fill();
    blobPath(lobes);
    ctx.fillStyle = shade(col, -0.08);
    ctx.fill();
    blobPath(lobes.filter(([x, y]) => (x - cx) / rx + (y - cy) / ry < 0.5).map(([x, y, rr]) => [x - rr * 0.14, y - rr * 0.18, rr * 0.78]));
    ctx.fillStyle = shade(col, 0.06);
    ctx.fill();
    const hi = lobes.filter(([x, y]) => (x - cx) / rx + (y - cy) / ry < -0.25).map(([x, y, rr]) => [x - rr * 0.26, y - rr * 0.32, rr * 0.5]);
    dots(hi, rgba(mix(col, CREAM, 0.4), 0.45));
    if (specks) {
      const sp = [], sp2 = [];
      for (let k = 0; k < specks; k++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 0.82, x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
        (k % 3 ? sp : sp2).push([x, y, 0.9 + r() * rm * 0.045]);
      }
      dots(sp, rgba(col2, 0.75));
      dots(sp2, rgba(shade(col, -0.3), 0.5));
    }
    return lobes;
  }
  // Stamm mit Wurzelanlauf
  function trunkShape(x, base, top, w0, w1, lean, col) {
    ctx.beginPath();
    ctx.moveTo(x - w0 * 0.85, base + 1);
    ctx.quadraticCurveTo(x - w0 * 0.5, base - 2, x - w0 * 0.5, base - w0 * 1.4);
    ctx.lineTo(x + lean - w1 * 0.5, top);
    ctx.lineTo(x + lean + w1 * 0.5, top);
    ctx.lineTo(x + w0 * 0.5, base - w0 * 1.4);
    ctx.quadraticCurveTo(x + w0 * 0.5, base - 2, x + w0 * 0.85, base + 1);
    ctx.closePath();
    ctx.fillStyle = hgrad(x - w0 * 0.5, x + w0 * 0.5, [[0, shade(col, 0.14)], [0.45, col], [1, shade(col, -0.28)]]);
    ctx.fill();
  }
  // Astwerk rekursiv sammeln: [x0, y0, x1, y1, Breite]
  function boughs(x, y, ang, len, wd, depth, r, list, spread) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    list.push([x, y, ex, ey, wd]);
    if (depth <= 0) return;
    const n = 2 + (r() < 0.35 ? 1 : 0), sp = spread || 0.5;
    for (let k = 0; k < n; k++) boughs(ex, ey, ang + (k - (n - 1) / 2) * sp + (r() - 0.5) * 0.35, len * (0.6 + r() * 0.16), wd * 0.62, depth - 1, r, list, sp);
  }
  function drawBoughs(list, col) {
    ctx.strokeStyle = col;
    for (const [x0, y0, x1, y1, wd] of list) {
      ctx.lineWidth = Math.max(0.6, wd);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  // Laubbaum in mehreren Arten; langer Schatten nach rechts (Sonne tief links)
  function auTree(x, base, h, type, Q, r, shadowA) {
    const reds = [Q.red, Q.orange, Q.yellow, Q.gold, Q.orange, Q.crimson, Q.olive];
    if (shadowA) ellipse(x + h * 0.42, base + 1, h * 0.46, 2.6, 0, rgba(INK, shadowA));
    if (type === 'fir') {
      const w = h * 0.19, dk = Q.fir;
      ctx.fillStyle = shade(Q.bark, -0.2);
      ctx.fillRect(x - 1.8, base - h * 0.16, 3.6, h * 0.16);
      for (let t = 0; t < 6; t++) {
        const ty = base - h * 0.1 - t * h * 0.145, tw = w * (1 - t / 6.6), th = h * 0.25;
        poly([[x - tw, ty], [x - tw * 0.2, ty - th * 0.7], [x, ty - th], [x + tw, ty]], dk);
        poly([[x, ty - th], [x + tw, ty], [x + tw * 0.15, ty - 1]], shade(dk, -0.25));
      }
      return;
    }
    if (type === 'birch') {
      const n = 2 + (r() < 0.25 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const bx = x + (k - (n - 1) / 2) * h * 0.09, bh = h * (0.85 + r() * 0.15), lean = (r() - 0.5) * h * 0.12, tw = Math.max(2, h * 0.026);
        ctx.beginPath();
        ctx.moveTo(bx - tw, base + 1);
        ctx.lineTo(bx + lean - tw * 0.4, base - bh);
        ctx.lineTo(bx + lean + tw * 0.4, base - bh);
        ctx.lineTo(bx + tw, base + 1);
        ctx.closePath();
        ctx.fillStyle = hgrad(bx - tw, bx + tw, [[0, mix(Q.birch, CREAM, 0.3)], [0.6, Q.birch], [1, shade(Q.birch, -0.3)]]);
        ctx.fill();
        const marks = [];
        for (let j = 0; j < bh / 9; j++) { const t = r(), mx = lerp(bx, bx + lean, t), my = base - bh * t; marks.push([mx - tw * 0.6, my, tw * (0.5 + r() * 0.7), 0.9]); }
        rects(marks, rgba(Q.dark, 0.6));
        for (let j = 0; j < 3; j++) {
          const t = 0.48 + j * 0.17 + r() * 0.05, cx = lerp(bx, bx + lean, t) + (j % 2 ? 1 : -1) * h * 0.06, cy = base - bh * t;
          line(lerp(bx, bx + lean, t), cy + 4, cx, cy, rgba(Q.dark, 0.5), 0.8);
          crown(cx, cy - h * 0.03, h * 0.07, h * 0.06, pickOf(r, [Q.yellow, Q.gold, Q.yellow]), Q.orange, r, 6, 6);
        }
      }
      return;
    }
    if (type === 'bare') {
      const tw = Math.max(2.5, h * 0.05), list = [];
      trunkShape(x, base, base - h * 0.45, tw, tw * 0.6, 0, Q.bark);
      boughs(x, base - h * 0.42, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.24, tw * 0.6, 3, r, list, 0.55);
      drawBoughs(list, Q.bark);
      const lv = [];
      for (const s of list) if (s[4] < tw * 0.3 && r() < 0.45) lv.push([s[2], s[3], 1.2 + r() * 1.2]);
      dots(lv, Q.orange);
      return;
    }
    const tw = Math.max(3, h * 0.055);
    let rx, ry, cy;
    if (type === 'poplar') { rx = h * 0.11; ry = h * 0.4; cy = base - h * 0.55; }
    else if (type === 'beech') { rx = h * 0.22; ry = h * 0.34; cy = base - h * 0.6; }
    else { rx = h * (0.3 + r() * 0.07); ry = h * (0.26 + r() * 0.05); cy = base - h * 0.64; }
    trunkShape(x, base, cy + ry * 0.2, tw, tw * 0.55, (r() - 0.5) * tw, Q.bark);
    const br = [];
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 0.75 + (r() - 0.5) * 0.3; br.push([x, cy + ry * 0.45, x + Math.cos(a) * rx * 0.6, cy + ry * 0.45 + Math.sin(a) * ry * 0.7]); }
    segs(br, Q.bark, tw * 0.45);
    const c1 = type === 'poplar' ? pickOf(r, [Q.yellow, Q.gold]) : pickOf(r, reds);
    crown(x, cy, rx, ry, c1, pickOf(r, reds), r, type === 'poplar' ? 10 : 14, Math.round(h * 0.25));
  }

  // ---------- Himmel ----------
  ART2.sky.auAutumn = (C, S, rng) => {
    const sx = S.sunX * W, sy = S.sunY;
    const warm = mix(C.skyBottom, '#ffd8a0', 0.35), rose = mix(mix(C.accent, CREAM, 0.55), '#e8a0a0', 0.2), cool = mix(C.skyTop, CREAM, 0.15);
    // kühler, etwas dunklerer Zenit rechts oben: die erste Melancholie
    ctx.fillStyle = rgrad(W, -60, 0, Math.max(W, 700), [[0, rgba(shade(C.skyTop, -0.2), 0.4)], [1, rgba(C.skyTop, 0)]]);
    ctx.fillRect(0, 0, W, 420);
    // breiter warmer Schein um die tiefe Sonne
    ctx.fillStyle = rgrad(sx, sy, 0, 480, [[0, rgba(warm, 0.62)], [0.3, rgba(warm, 0.26)], [1, rgba(warm, 0)]]);
    ctx.fillRect(sx - 480, sy - 480, 960, 960);
    // lange Schichtwolken, Unterseiten vom tiefen Licht angestrahlt
    for (let k = 0, n = Math.round(W / 64) + 5; k < n; k++) {
      const x = rng() * (W + 240) - 120, y = 40 + Math.pow(rng(), 0.85) * 240, rx = 90 + rng() * 180, ry = 4 + rng() * 6;
      const nearSun = clamp(1 - Math.hypot((x - sx) / 520, (y - sy) / 300), 0, 1);
      soft(x, y, rx, ry * 1.7, mix(cool, C.skyBottom, 0.2), 0.24 + rng() * 0.18);
      soft(x + rx * 0.05, y + ry * 1.1, rx * 0.85, ry * 0.75, mix(rose, warm, nearSun), (0.22 + 0.38 * nearSun) * (0.6 + rng() * 0.4));
    }
    // Sonnenscheibe, tief und vom Dunst gedämpft
    ctx.fillStyle = rgrad(sx, sy, 18, 100, [[0, rgba(CREAM, 0.6)], [1, rgba(CREAM, 0)]]);
    ctx.fillRect(sx - 100, sy - 100, 200, 200);
    circle(sx, sy, 27, rgrad(sx, sy, 0, 27, [[0, mix(CREAM, '#ffffff', 0.6)], [0.7, mix(CREAM, '#ffe0a8', 0.45)], [1, mix(warm, CREAM, 0.35)]], sx - 6, sy - 6));
    soft(sx - 30, sy + 9, 160, 7, mix(C.skyBottom, C.accent, 0.12), 0.42);
    soft(sx + 50, sy - 13, 120, 5, mix(C.skyBottom, CREAM, 0.2), 0.32);
    // flache Lichtbahnen
    rays(sx, sy, 10, -0.3, 0.5, Math.max(W, 900), 34, mix(CREAM, '#ffd9a0', 0.4), 0.075, rng);
    // Zugvögel in Keilformation, ziehen nach Süden
    const bx = W * 0.62, by = 118, bc = rgba(mix(C.skyTop, INK, 0.45), 0.55);
    ctx.strokeStyle = bc;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let k = 0; k < 11; k++) {
      const side = k % 2 ? 1 : -1, j = Math.ceil(k / 2);
      const x = bx + j * 10 + (rng() - 0.5) * 2, y = by + side * j * 5.5 + (rng() - 0.5) * 1.5, s = 2.3 - j * 0.1, fl = (rng() - 0.5) * 0.8;
      ctx.moveTo(x - s * 1.7, y - s * (0.3 + fl));
      ctx.quadraticCurveTo(x - s * 0.7, y - s * 1.1, x, y);
      ctx.quadraticCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.7, y - s * (0.3 - fl));
    }
    ctx.stroke();
    // warmer Dunst über dem Horizont
    ctx.fillStyle = vgrad(290, GROUND_Y, [[0, rgba(warm, 0)], [1, rgba(mix(warm, CREAM, 0.3), 0.55)]]);
    ctx.fillRect(0, 290, W, GROUND_Y - 290);
  };

  // ---------- Ebene 0: bewaldete Hügel mit Nebel in den Senken ----------
  ART2.layerExtent.auHills = () => [300, GROUND_Y + 14];
  ART2.layerTex.auHills = () => ({ grain: 0.035, mottle: 0.08, contrast: 1.05 });
  ART2.layer.auHills = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, Q = auPal(C, 0.52), mc = Q.mist;
    const f = ridgeFn(P, 420, 64, 0.004, l.seed);
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(350, yb, [[0, mix(Q.brownleaf, Q.haze, 0.3)], [1, shade(mix(Q.brownleaf, Q.haze, 0.3), -0.1)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Kronendach in Reihen, Farbinseln aus periodischem Rauschen
    const cols = [Q.red, Q.orange, Q.yellow, Q.olive, Q.gold, Q.crimson];
    for (let row = 0; row < 11; row++) {
      const groups = cols.map(() => []), sh = [], hi = [];
      for (let x = -6; x < P + 6; x += 3.5 + rng() * 4) {
        const y = f(x) + 2 + row * 12 + rng() * 6, rr = 3.6 + row * 0.5 + rng() * 2.4;
        const ci = Math.min(cols.length - 1, Math.floor(pnoise(x / P * 16, 16, l.seed + Math.floor(y / 26)) * cols.length * 1.15 + rng() * 0.7) % cols.length);
        groups[ci].push([x, y, rr]);
        sh.push([x + rr * 0.25, y + rr * 0.35, rr]);
        if (rng() < 0.6) hi.push([x - rr * 0.3, y - rr * 0.35, rr * 0.45]);
      }
      dots(sh, rgba(shade(Q.brownleaf, -0.25), 0.55));
      groups.forEach((g, j) => dots(g, cols[j]));
      dots(hi, rgba(CREAM, 0.14));
    }
    ctx.restore();
    // einzelne Pappeln und Fichten überragen den Kamm
    for (let k = 0; k < 9; k++) {
      const x = rng() * P, y = f(x) + 4;
      if (rng() < 0.6) wrapEach(x, P, 8, xx => { ellipse(xx + 1, y - 13, 4.2, 15, 0, shade(Q.gold, -0.2)); ellipse(xx, y - 14, 3.8, 14.5, 0, Q.gold); });
      else wrapEach(x, P, 8, xx => poly([[xx - 5, y], [xx, y - 22], [xx + 5, y]], Q.fir));
    }
    ridgeLine(f, -8, P + 8, 4, 1.2, rgba(CREAM, 0.16), 1.8);
    // Nebel liegt in den Senken
    for (let x = 30; x < P; x += 46 + rng() * 30) {
      const y = f(x);
      if (y < 404) continue;
      const rx = 70 + rng() * 60;
      wrapEach(x, P, rx, xx => soft(xx, y + 8, rx, 13 + rng() * 6, mc, 0.55 + (y - 404) / 120));
    }
    mist(P, 476, 24, mc, 0.42, rng, 26, 80, 190, 0.12);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(360, yb, [[0, rgba(Q.haze, 0.05)], [0.6, rgba(mc, 0.3)], [1, rgba(mc, 0.55)]]);
    ctx.fillRect(-8, 340, P + 16, yb - 340);
    ctx.restore();
  };

  // ---------- Ebene 1: Baumgruppen auf einer Herbstwiese ----------
  ART2.layerExtent.auGrove = () => [230, GROUND_Y + 14];
  ART2.layerTex.auGrove = () => ({ grain: 0.045, mottle: 0.1, contrast: 1.1 });
  ART2.layer.auGrove = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, Q = auPal(C, 0.38);
    const g = ridgeFn(P, 503, 12, 0.003, l.seed);
    const trees = [], n = 6;
    const types = ['round', 'round', 'round', 'beech', 'beech', 'poplar', 'birch', 'birch', 'fir', 'bare'];
    for (let k = 0; k < n; k++) {
      const cx = (k + 0.5) * P / n + (rng() - 0.5) * 50, m = 1 + Math.floor(rng() * 2.8);
      for (let j = 0; j < m; j++) trees.push({ x: cx + (j - (m - 1) / 2) * (30 + rng() * 26), h: 120 + rng() * 120, type: pickOf(rng, types), seed: (rng() * 1e6) | 0, dy: rng() * 8 });
    }
    trees.sort((a, b) => a.dy - b.dy);
    for (const t of trees) wrapEach(t.x, P, t.h * 0.5, xx => auTree(xx, g(xx) + 3 + t.dy, t.h, t.type, Q, mulberry32(t.seed), 0.1));
    // Wiese davor
    ridgePath(g, -8, P + 8, 6, yb);
    ctx.fillStyle = vgrad(486, yb, [[0, shade(Q.meadow, 0.08)], [1, shade(Q.meadow, -0.2)]]);
    ctx.fill();
    ridgeLine(g, -8, P + 8, 6, 1, rgba(CREAM, 0.18), 1.4);
    const gs = [], lv = auLeafCols(Q).map(() => []);
    for (let k = 0; k < P / 2.6; k++) {
      const x = rng() * P, y = g(x) + 2 + Math.pow(rng(), 1.5) * 50, len = 2 + rng() * 3.5;
      gs.push([x, y, x + (rng() - 0.3) * 1.5, y - len]);
    }
    segs(gs.slice(0, gs.length >> 1), rgba(shade(Q.meadow, 0.22), 0.45), 0.9);
    segs(gs.slice(gs.length >> 1), rgba(shade(Q.meadow, -0.25), 0.4), 0.9);
    for (const t of trees) for (let k = 0; k < 16; k++) {
      const x = t.x + (rng() - 0.3) * t.h * 0.6, y = g(x) + 2 + rng() * 14;
      lv[Math.floor(rng() * lv.length)].push([x, y, 1.3 + rng() * 1.1, 0.7 + rng() * 0.4, rng() * 3]);
    }
    lv.forEach((list, j) => ellipses(wrapList(list, P, 6), rgba(auLeafCols(Q)[j], 0.8)));
    // Nebel am Fuß der Bäume
    mist(P, 498, 12, Q.mist, 0.42, rng, 30, 60, 150, 0.14);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(230, yb, [[0, rgba(Q.haze, 0.06)], [0.75, rgba(Q.haze, 0.22)], [1, rgba(Q.mist, 0.45)]]);
    ctx.fillRect(-8, 230, P + 16, yb - 230);
    ctx.restore();
  };

  // ---------- Ebene 2: Requisiten am Waldboden ----------
  ART2.prop.auforest = { h: 84, paint: (x, base, s, r, v, C) => auProp(x, base, s, r, v, C) };
  function auProp(x, base, s, r, v, C) {
    const Q = auPal(C, 0.08), lc = auLeafCols(Q);
    if (v < 0.2) {
      // Adlerfarn, bronzefarben
      ellipse(x + 8, base - 1, 24 * s, 4 * s, 0, rgba(INK, 0.18));
      const n = 4 + Math.floor(r() * 3), tones = [Q.bracken, shade(Q.bracken, -0.18), mix(Q.bracken, Q.yellow, 0.35)];
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 1 : -1, len = (34 + r() * 30) * s, lean = side * (0.3 + r() * 0.55), c = tones[k % 3];
        const x0 = x + (r() - 0.5) * 8 * s, tx = x0 + Math.sin(lean) * len, ty = base - len * (0.55 + r() * 0.2);
        const cx = x0 + Math.sin(lean) * len * 0.25, cy = base - len * 0.95;
        ctx.beginPath();
        for (let j = 2; j <= 13; j++) {
          const u = j / 13, iu = 1 - u;
          const px = iu * iu * x0 + 2 * iu * u * cx + u * u * tx, py = iu * iu * base + 2 * iu * u * cy + u * u * ty;
          const dx = 2 * iu * (cx - x0) + 2 * u * (tx - cx), dy = 2 * iu * (cy - base) + 2 * u * (ty - cy), dl = Math.hypot(dx, dy) || 1;
          const ux = dx / dl, uy = dy / dl, ll = ((1 - u) * 6.5 + 1.6) * s;
          for (const sd of [1, -1]) {
            ctx.moveTo(px - ux * 1.2, py - uy * 1.2);
            ctx.lineTo(px - uy * sd * ll + ux * ll * 0.45, py + ux * sd * ll + uy * ll * 0.45 + ll * 0.25);
            ctx.lineTo(px + ux * 1.6, py + uy * 1.6);
          }
        }
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = shade(c, -0.35);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x0, base);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.stroke();
      }
    } else if (v < 0.36) {
      // Moospolster mit Pilzgruppe
      ellipse(x + 8, base - 1, 20 * s, 3.5 * s, 0, rgba(INK, 0.2));
      const bl = [[x - 10 * s, base - 3, 7 * s], [x, base - 5, 9 * s], [x + 11 * s, base - 3, 6.5 * s]];
      blobPath(bl.map(([a, b, c]) => [a + 1, b + 1.5, c]));
      ctx.fillStyle = shade(Q.moss, -0.3);
      ctx.fill();
      blobPath(bl);
      ctx.fillStyle = vgrad(base - 14 * s, base, [[0, mix(Q.moss, Q.yellow, 0.25)], [1, shade(Q.moss, -0.15)]]);
      ctx.fill();
      const m = 2 + Math.floor(r() * 4), list = [];
      for (let k = 0; k < m; k++) list.push([x + (r() - 0.5) * 26 * s, (8 + r() * 16) * s, (4 + r() * 5) * s, (r() - 0.5) * 0.35, r() < 0.3 ? Q.orange : r() < 0.5 ? mix(Q.cap, Q.red, 0.4) : Q.cap]);
      list.sort((a, b) => b[1] - a[1]);
      for (const [mx, hh, cr, tl, cc] of list) shroom(mx, base - 3, hh, cr, cc, mix(Q.birch, Q.stubble, 0.3), tl);
    } else if (v < 0.5) {
      // Laubhaufen
      ellipse(x + 10, base - 1, 26 * s, 4 * s, 0, rgba(INK, 0.2));
      const groups = lc.map(() => []);
      for (let k = 0; k < 70; k++) {
        const u = r() * 2 - 1, hh = Math.sqrt(1 - u * u) * 15 * s * r();
        groups[Math.floor(r() * lc.length)].push([x + u * 24 * s, base - 2 - hh, (2.6 + r() * 2) * s, (1.3 + r()) * s, r() * Math.PI]);
      }
      groups.forEach((gg, j) => ellipses(gg, lc[j]));
      const hi = groups[2].slice(0, 8).map(([a, b, c, d, e]) => [a - 0.5, b - 0.6, c * 0.6, d * 0.5, e]);
      ellipses(hi, rgba(CREAM, 0.3));
    } else if (v < 0.64) {
      // Baumstumpf mit Baumpilzen und Moos
      const sw = (10 + r() * 5) * s, sh = (18 + r() * 14) * s, wood = Q.bark;
      ellipse(x + 12, base - 1, sw * 1.9, 3.5 * s, 0, rgba(INK, 0.22));
      ctx.beginPath();
      ctx.moveTo(x - sw * 1.35, base + 2);
      ctx.quadraticCurveTo(x - sw, base - 4, x - sw, base - sh);
      ctx.lineTo(x + sw, base - sh);
      ctx.quadraticCurveTo(x + sw, base - 4, x + sw * 1.4, base + 2);
      ctx.closePath();
      ctx.fillStyle = hgrad(x - sw, x + sw, [[0, shade(wood, 0.18)], [0.5, wood], [1, shade(wood, -0.32)]]);
      ctx.fill();
      const fur = [];
      for (let k = 0; k < 6; k++) { const fx = x - sw * 0.8 + k * sw * 0.32; fur.push([fx, base - sh + 4, fx + (r() - 0.5) * 2, base - 2]); }
      segs(fur, rgba(INK, 0.25), 0.9);
      ellipse(x, base - sh, sw, sw * 0.32, 0, mix(Q.woodLight, CREAM, 0.15));
      ctx.strokeStyle = rgba(shade(Q.woodLight, -0.3), 0.55);
      ctx.lineWidth = 0.6;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(x + 1, base - sh, sw * k / 4, sw * 0.32 * k / 4, 0, 0, TAU); ctx.stroke(); }
      bracket(x + sw * 0.9, base - sh * 0.55, 6 * s, mix(Q.yellow, Q.bracken, 0.5), 1);
      bracket(x + sw * 0.95, base - sh * 0.3, 4.5 * s, mix(Q.yellow, Q.bracken, 0.5), 1);
      const ms = [[x - sw * 0.9, base - sh * 0.4, 3 * s], [x - sw * 0.8, base - sh * 0.2, 3.5 * s], [x - sw * 0.5, base - sh + 1, 2.6 * s]];
      dots(ms, Q.moss);
      leaf(x - 3, base - sh - 1, 7 * s, 4.5 * s, 0.4, Q.red, LEAF_A, false);
    } else if (v < 0.78) {
      // Strauch mit gelbem Laub und roten Beeren
      ellipse(x + 10, base - 1, 22 * s, 4 * s, 0, rgba(INK, 0.2));
      const bl = [[x - 9 * s, base - 9 * s, 9 * s], [x + 8 * s, base - 10 * s, 10 * s], [x, base - 18 * s, 11 * s], [x + 3 * s, base - 26 * s, 7 * s]];
      blobPath(bl.map(([a, b, c]) => [a + 1.5, b + 2, c]));
      ctx.fillStyle = shade(Q.gold, -0.35);
      ctx.fill();
      blobPath(bl);
      ctx.fillStyle = rgrad(x, base - 15 * s, 2, 22 * s, [[0, mix(Q.yellow, CREAM, 0.15)], [0.6, Q.gold], [1, shade(Q.gold, -0.25)]], x - 8 * s, base - 24 * s);
      ctx.fill();
      const sp = [];
      for (let k = 0; k < 20; k++) sp.push([x + (r() - 0.5) * 30 * s, base - 4 * s - r() * 26 * s, 0.9 + r()]);
      dots(sp, rgba(Q.orange, 0.7));
      const be = [];
      for (let k = 0; k < 5; k++) { const bx = x + (r() - 0.5) * 22 * s, by = base - 6 * s - r() * 18 * s; for (let j = 0; j < 3; j++) be.push([bx + (j - 1) * 2, by + (j % 2) * 1.6, 1.4]); }
      dots(be, Q.crimson);
      dots(be.map(([a, b]) => [a - 0.4, b - 0.4, 0.5]), rgba(CREAM, 0.6));
    } else if (v < 0.9) {
      // liegendes Totholz mit Moos und Pilzchen
      const lw = (34 + r() * 18) * s, lr = (5 + r() * 3) * s, ly = base - lr;
      ellipse(x + 6, base - 0.5, lw * 0.8, 3 * s, 0, rgba(INK, 0.24));
      roundRectPath(x - lw / 2, ly - lr, lw, lr * 2, lr);
      ctx.fillStyle = vgrad(ly - lr, ly + lr, [[0, shade(Q.bark, 0.2)], [0.45, Q.bark], [1, shade(Q.bark, -0.35)]]);
      ctx.fill();
      const fur = [];
      for (let k = 0; k < lw / 5; k++) { const fx = x - lw / 2 + 4 + k * 5 + r() * 2; fur.push([fx, ly - lr * 0.6, fx + 3, ly + lr * 0.5]); }
      segs(fur, rgba(INK, 0.2), 0.8);
      ellipse(x - lw / 2 + lr * 0.4, ly, lr * 0.45, lr, 0, mix(Q.woodLight, CREAM, 0.1));
      ctx.strokeStyle = rgba(shade(Q.woodLight, -0.3), 0.6);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(x - lw / 2 + lr * 0.4, ly, lr * 0.25, lr * 0.55, 0, 0, TAU);
      ctx.stroke();
      const ms = [];
      for (let k = 0; k < 6; k++) ms.push([x - lw * 0.3 + r() * lw * 0.6, ly - lr * 0.8, (2 + r() * 2) * s]);
      dots(ms, Q.moss);
      for (let k = 0; k < 3; k++) shroom(x + (k - 1) * 4 * s + lw * 0.15, ly - lr * 0.7, (4 + r() * 3) * s, 2.4 * s, Q.cap, Q.birch, (r() - 0.5) * 0.2, true);
    } else {
      // trockenes Gras mit Samenständen
      const bl = [];
      for (let k = -5; k <= 5; k++) bl.push([x + k * 2, base, x + k * 3.4 + (r() - 0.5) * 4, base - (16 - Math.abs(k) * 1.6) * s - r() * 8]);
      segs(bl.slice(0, 6), Q.stubble, 1.2);
      segs(bl.slice(6), shade(Q.stubble, -0.25), 1.2);
      ellipses(bl.filter(() => r() < 0.4).map(([a, b, c2, d]) => [c2, d, 1.2, 3.2, 0.2]), mix(Q.stubble, Q.brownleaf, 0.4));
    }
  }

  // ---------- Boden: Waldboden mit Laubdecke ----------
  ART2.ground.auleaves = (P, y, C, rng, band) => {
    const Q = auPal(C, 0), soil = mix(mix(C.near, INK, 0.3), '#4c3626', 0.35), lc = auLeafCols(Q);
    band(vgrad(y, H, [[0, shade(soil, 0.1)], [1, shade(soil, -0.38)]]), y + 4, H - y + 4);
    for (let k = 0; k < 3; k++) {
      const yy = y + 22 + k * 11;
      ctx.beginPath();
      for (let x = -8; x <= P + 8; x += 12) {
        const w2 = yy + Math.sin(x * TAU / P * 11 + k * 2) * 2 + Math.sin(x * TAU / P * 29 + k) * 1.2;
        if (x === -8) ctx.moveTo(x, w2); else ctx.lineTo(x, w2);
      }
      ctx.strokeStyle = rgba(k % 2 ? shade(soil, -0.3) : shade(soil, 0.14), 0.4);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    const pb = [];
    for (let k = 0; k < P / 16; k++) pb.push([rng() * P, y + 18 + rng() * 36, 1.2 + rng() * 2.6, 1 + rng() * 1.6]);
    pebbles(pb, mix(soil, Q.stone, 0.5));
    // Eicheln
    const ac = [];
    for (let k = 0; k < P / 60; k++) ac.push([rng() * P, y + 14 + rng() * 30]);
    ellipses(ac.map(([a, b]) => [a, b, 1.6, 2.2, 0.4]), mix(Q.gold, Q.bark, 0.3));
    ellipses(ac.map(([a, b]) => [a - 0.6, b - 1.6, 1.8, 1, 0.4]), shade(Q.bark, -0.2));
    const roots = [];
    for (let k = 0; k < P / 26; k++) { const x = rng() * P, yy = y + 10 + rng() * 14; roots.push([x, yy, x + (rng() - 0.5) * 18, yy + 5 + rng() * 9]); }
    segs(roots, rgba(shade(soil, -0.45), 0.6), 1.1);
    // vergrabene, blasse Blätter in der Humusschicht
    const deep = [];
    for (let k = 0; k < P / 7; k++) deep.push([rng() * P, y + 14 + Math.pow(rng(), 1.4) * 34, 2 + rng() * 2, 0.9 + rng() * 0.8, rng() * Math.PI]);
    ellipses(wrapList(deep, P, 5), rgba(mix(Q.brownleaf, soil, 0.4), 0.55));
    // Laubdecke in drei Lagen, unten dunkler; Schattenkante darunter
    band(rgba(INK, 0.26), y + 9, 4);
    const tone = [-0.3, -0.12, 0.04];
    for (let t = 0; t < 3; t++) {
      const groups = lc.map(() => []);
      for (let x = rng() * 3; x < P; x += 2.2 + rng() * 2.6) {
        const ci = Math.floor(pnoise(x / P * 40, 40, 77 + t) * 2.2 + rng() * 4.2) % lc.length;
        groups[ci].push([x, y + 9 - t * 3.2 + rng() * 4, 2.6 + rng() * 2, 1.3 + rng() * 0.9, (rng() - 0.5) * 1.2]);
      }
      groups.forEach((gg, j) => ellipses(wrapList(gg, P, 6), shade(lc[j], tone[t])));
    }
    // gezackte Einzelblätter oben auf und etwas Licht auf den Kanten
    for (let k = 0; k < P / 28; k++) {
      const x = 6 + rng() * (P - 12), yy = y + 1 + rng() * 5, c = lc[Math.floor(rng() * 4)];
      leaf(x, yy, 7 + rng() * 4, 4 + rng() * 2, (rng() - 0.5) * 1.2, shade(c, 0.06), rng() < 0.5 ? LEAF_A : LEAF_B);
    }
    const hl = [];
    for (let k = 0; k < P / 5; k++) hl.push([rng() * P, y + 1 + rng() * 6, 1.3 + rng(), 0.5, (rng() - 0.5) * 0.6]);
    ellipses(hl, rgba(mix(Q.yellow, CREAM, 0.4), 0.35));
    // Moosbüschel, Zweige und vereinzelte Pilzchen ragen über die Kante
    const tw = [];
    for (let k = 0; k < P / 70; k++) { const x = rng() * P, yy = y + 2 + rng() * 4, d = (rng() - 0.5) * 22; tw.push([x, yy, x + d, yy - 3 - rng() * 4]); }
    segs(tw, shade(Q.bark, -0.2), 1.2);
    for (let k = 0; k < P / 130; k++) {
      const x = 10 + rng() * (P - 20);
      dots([[x - 4, y + 2, 3.2], [x + 1, y + 1, 3.8], [x + 5, y + 2.5, 2.8]], Q.moss);
      shroom(x + (rng() - 0.5) * 6, y + 2, 5 + rng() * 4, 2.6 + rng() * 1.6, rng() < 0.5 ? Q.cap : Q.orange, Q.birch, (rng() - 0.5) * 0.3, true);
    }
  };

  // ---------- Säule: Baumstamm mit tiefer Borke, etwas Laub und kleinen Pilzen ----------
  const auBark = C => mix(C.pipe, '#5c4d44', 0.42);
  ART2.pipeBody.aubark = (C, h, v, r) => {
    const Q = auPal(C, 0), bark = auBark(C), furrow = mix(bark, INK, 0.42);
    columnBase(h, furrow, shade(furrow, -0.15), mix(furrow, CREAM, 0.2));
    // Borkenplatten in Spalten, Farbe nach Lage auf dem Rund (Licht links)
    const ncol = 8;
    for (let c = 0; c < ncol; c++) {
      const cx = 3.6 + c * (PW - 7.2) / (ncol - 1), t = cx / PW;
      const pc = t < 0.18 ? mix(bark, CREAM, 0.26 - t * 0.6) : t < 0.6 ? mix(bark, CREAM, 0.06) : shade(bark, -(t - 0.6) * 0.75);
      const plates = [], lit = [], sh = [];
      let y = -r() * 30;
      while (y < h) {
        const ph = 14 + r() * 30, pw = 5.4 + r() * 1.6, px = cx - pw / 2 + (r() - 0.5) * 1.4;
        plates.push([px, y, pw, ph]);
        lit.push([px, y + 1, 1, ph - 2]);
        sh.push([px + 0.5, y + ph - 2, pw - 1, 2]);
        y += ph + 1.5 + r() * 3;
      }
      ctx.beginPath();
      for (const [px, py, pw, ph] of plates) roundRectPath2(px, py, pw, ph, 2);
      ctx.fillStyle = pc;
      ctx.fill();
      rects(lit, rgba(CREAM, 0.13 * (1 - t)));
      rects(sh, rgba(INK, 0.22));
    }
    // Moos auf der Schattenseite
    const ms = [];
    for (let k = 0; k < h / 26; k++) { const my = r() * h, mx = PW - 6 - r() * 14; for (let j = 0; j < 6; j++) ms.push([mx + (r() - 0.5) * 8, my + (r() - 0.5) * 12, 1.4 + r() * 2]); }
    dots(ms.map(([a, b, c]) => [a + 0.5, b + 0.8, c]), rgba(INK, 0.25));
    dots(ms, rgba(mix(Q.moss, C.near, 0.2), 0.85));
    dots(ms.filter((_, k) => k % 3 === 0).map(([a, b, c]) => [a - c * 0.3, b - c * 0.3, c * 0.45]), rgba(Q.yellow, 0.35));
    // Astnarben
    for (let k = 0; k < h / 200; k++) {
      const kx = 16 + r() * 24, ky = 40 + r() * (h - 80);
      ellipse(kx + 1, ky + 1.5, 6, 8, 0, rgba(INK, 0.35));
      ellipse(kx, ky, 6, 8, 0, mix(bark, Q.woodLight, 0.3));
      ellipse(kx - 0.5, ky + 0.6, 3, 4.4, 0, mix(furrow, INK, 0.3));
      ctx.strokeStyle = rgba(CREAM, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 8.5, 11, 0, Math.PI * 0.95, Math.PI * 1.6);
      ctx.stroke();
    }
    // Baumpilze an der rechten Kante, Pilzchen auf einem Absatz links
    const bc = mix(Q.yellow, Q.bracken, 0.45);
    for (let y0 = 120 + v * 170; y0 < h - 30; y0 += 340) {
      bracket(PW - 1, y0, 11, bc, 1);
      bracket(PW - 1, y0 + 10, 8, shade(bc, -0.08), 1);
      bracket(PW - 1, y0 - 8, 6.5, mix(bc, CREAM, 0.1), 1);
    }
    for (let y0 = 260 - v * 150; y0 < h - 20; y0 += 330) {
      ellipse(3, y0 + 1, 8, 2.4, 0, rgba(INK, 0.3));
      dots([[1, y0, 3], [5, y0 - 0.5, 3.4], [-2, y0 + 0.5, 2.4]], mix(Q.moss, C.near, 0.15));
      shroom(-1, y0, 6, 3.4, Q.orange, Q.birch, -0.25);
      shroom(4, y0, 8, 4, mix(Q.cap, Q.red, 0.3), Q.birch, -0.1);
      shroom(8.5, y0, 4.5, 2.6, Q.cap, Q.birch, 0.1);
    }
    // Wasserreis: dünner Trieb mit bunten Blättern, dazu angeklebtes Laub
    const lc = auLeafCols(Q);
    for (let y0 = 60 + v * 220; y0 < h - 20; y0 += 300) {
      const left = (Math.floor(y0 / 300) + v) % 2 === 0, sx = left ? 1 : PW - 1, d = left ? -1 : 1;
      ctx.strokeStyle = shade(bark, -0.2);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, y0);
      ctx.quadraticCurveTo(sx + d * 6, y0 - 4, sx + d * 13, y0 - 12);
      ctx.stroke();
      leaf(sx + d * 14, y0 - 15, 9, 5.5, d > 0 ? -0.9 : -2.2, lc[0]);
      leaf(sx + d * 9, y0 - 6, 8, 5, d > 0 ? 0.3 : 2.8, lc[2]);
      leaf(sx + d * 5, y0 - 1, 7, 4.5, d > 0 ? 1.1 : 2, lc[1]);
    }
    for (let k = 0; k < h / 90; k++) {
      const lx = 8 + r() * 44, ly = r() * h;
      leaf(lx, ly, 7 + r() * 3, 4 + r() * 1.5, r() * TAU, lc[Math.floor(r() * lc.length)]);
    }
  };
  // abgerundete Platte ohne beginPath (viele in einem Pfad)
  function roundRectPath2(x, y, w, h, rr) {
    rr = Math.max(0, Math.min(rr, w / 2, h / 2));
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  ART2.pipeCap.aubark = (C, up) => {
    const Q = auPal(C, 0), r = mulberry32(up ? 917 : 918), bark = auBark(C), lc = auLeafCols(Q);
    // Rindenwulst
    capBase(shade(bark, 0.04), shade(bark, -SD), mix(bark, CREAM, 0.3), 4);
    const fur = [];
    for (let x = -PCO + 3; x < PW + PCO - 2; x += 3.5 + r() * 3) fur.push([x, up ? 10 : 3, x + (r() - 0.5) * 1.6, up ? PCH - 3 : PCH - 7]);
    segs(fur, rgba(mix(bark, INK, 0.5), 0.6), 1.1);
    segs(fur.map(([a, b, c2, d]) => [a + 1.1, b, c2 + 1.1, d]), rgba(CREAM, 0.12), 0.7);
    if (up) {
      // Schnittfläche mit Jahresringen, darauf Laub, Moos und zwei Pilzchen
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(PW / 2, 5.5, PW / 2 + PCO - 1.5, 5.5, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = hgrad(-PCO, PW + PCO, [[0, mix(Q.woodLight, CREAM, 0.42)], [0.65, mix(Q.woodLight, CREAM, 0.2)], [1, Q.woodLight]]);
      ctx.fillRect(-PCO, -1, PW + PCO * 2, 13);
      ctx.strokeStyle = rgba(shade(Q.woodLight, -0.35), 0.5);
      ctx.lineWidth = 0.7;
      for (let k = 1; k <= 6; k++) { ctx.beginPath(); ctx.ellipse(PW / 2 + 2, 6, k * 5, k * 0.85, 0, 0, TAU); ctx.stroke(); }
      segs([[PW / 2 + 2, 6, PW / 2 - 14, 3.6], [PW / 2 + 2, 6, PW / 2 + 20, 8.6]], rgba(shade(Q.woodLight, -0.5), 0.55), 0.8);
      ctx.restore();
      ctx.strokeStyle = rgba(mix(bark, INK, 0.3), 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(PW / 2, 5.5, PW / 2 + PCO - 1.5, 5.5, 0, 0, TAU);
      ctx.stroke();
      const bl = [[-PCO + 3, 5, 3.6], [1, 3.5, 4], [6, 4.5, 3]];
      blobPath(bl.map(([a, b, c]) => [a + 0.8, b + 1.2, c]));
      ctx.fillStyle = rgba(INK, 0.25);
      ctx.fill();
      blobPath(bl);
      ctx.fillStyle = Q.moss;
      ctx.fill();
      leaf(22, 3.5, 11, 6.5, 0.35, lc[0]);
      leaf(33, 6, 10, 6, -0.6, lc[2]);
      leaf(15, 7.5, 9, 5, 2.6, lc[1], LEAF_B);
      shroom(PW - 7, 4.5, 6, 3.6, Q.orange, Q.birch, -0.15);
      shroom(PW - 1.5, 5, 4.2, 2.6, Q.cap, Q.birch, 0.15);
    } else {
      // Unterseite: gerissene Rinde, ein Zweig mit Blättern, ein kleiner Baumpilz
      const sp = [];
      let x = -PCO;
      while (x < PW + PCO) { const w2 = 5 + r() * 6; sp.push([[x, PCH - 2], [x + w2 * 0.5, PCH + 1.5 + r() * 3.5], [x + w2, PCH - 2]]); x += w2; }
      for (const s of sp) poly(s, shade(bark, -0.25));
      ctx.strokeStyle = shade(bark, -0.15);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(14, PCH);
      ctx.quadraticCurveTo(11, PCH + 4, 6, PCH + 6);
      ctx.stroke();
      leaf(4, PCH + 8, 9, 5.5, 2.2, lc[1]);
      leaf(11, PCH + 6, 8, 5, 1.2, lc[2], LEAF_B);
      bracket(PW + PCO - 1, 9, 7, mix(Q.yellow, Q.bracken, 0.45), 1);
      bracket(PW + PCO - 1, 15, 5, mix(Q.yellow, Q.bracken, 0.5), 1);
    }
    ctx.fillStyle = rgba(INK, 0.32);
    ctx.fillRect(-PCO, up ? PCH - 4 : 0, PW + PCO * 2, 4);
  };

  // ---------- Kulissen Herbstwald ----------
  // Rasenhügel über die Motivbreite; liefert die Oberkante y(x)
  function auMound(w, yb, top, col, r, grass) {
    const yAt = x => yb - (yb - top) * Math.pow(Math.sin(Math.PI * clamp(x / w, 0, 1)), 0.45);
    const pts = [[-2, yb + 2]];
    for (let k = 0; k <= 16; k++) pts.push([w * k / 16, yAt(w * k / 16) + (k > 0 && k < 16 ? (r() - 0.5) * 2 : 0)]);
    pts.push([w + 2, yb + 2]);
    smooth(pts, true);
    ctx.fillStyle = vgrad(top, yb, [[0, shade(col, 0.08)], [1, shade(col, -0.16)]]);
    ctx.fill();
    if (grass) {
      const gs = [];
      for (let k = 0; k < w / 3; k++) { const x = r() * w, y = yAt(x) + 1 + r() * 4; gs.push([x, y + 1, x + (r() - 0.4) * 2, y - 2 - r() * 3]); }
      segs(gs, rgba(shade(col, 0.2), 0.6), 0.9);
    }
    return yAt;
  }
  function auStrewn(n, x0, x1, yAt, dy, Q, r, a) {
    const lc = auLeafCols(Q), groups = lc.map(() => []);
    for (let k = 0; k < n; k++) { const x = lerp(x0, x1, r()); groups[Math.floor(r() * lc.length)].push([x, yAt(x) + 1 + r() * dy, 1.4 + r() * 1.2, 0.7 + r() * 0.4, r() * 3]); }
    groups.forEach((g, j) => ellipses(g, rgba(lc[j], a || 0.85)));
  }
  // Rundballen von vorn mit Wickelspirale; der lange Schatten fällt nach rechts
  function auBale(x, y, R, Q) {
    ellipse(x + R * 2.2, y - 0.5, R * 2.4, R * 0.22, 0, rgba(INK, 0.2));
    roundRectPath(x, y - R * 2, R * 0.9, R * 2, R * 0.5);
    ctx.fillStyle = vgrad(y - R * 2, y, [[0, shade(Q.straw, -0.06)], [1, shade(Q.straw, -0.3)]]);
    ctx.fill();
    circle(x, y - R, R, rgrad(x, y - R, R * 0.1, R, [[0, mix(Q.straw, CREAM, 0.3)], [0.7, Q.straw], [1, shade(Q.straw, -0.22)]], x - R * 0.35, y - R * 1.35));
    ctx.strokeStyle = rgba(shade(Q.straw, -0.4), 0.45);
    ctx.lineWidth = Math.max(0.5, R * 0.07);
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.6; a += 0.35) { const rr = R * (0.15 + a / (TAU * 2.6) * 0.78), px = x + Math.cos(a) * rr, py = y - R + Math.sin(a) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
  }
  // Ferner Hügel als weiche Kuppe
  function auFarHill(w, h, top, col, r) {
    const yAt = x => h - (h - top) * Math.pow(Math.sin(Math.PI * clamp(x / w, 0, 1)), 0.7);
    const pts = [[-2, h + 2]];
    for (let k = 0; k <= 14; k++) pts.push([w * k / 14, yAt(w * k / 14) + (k > 0 && k < 14 ? (r() - 0.5) * 3 : 0)]);
    pts.push([w + 2, h + 2]);
    smooth(pts, true);
    ctx.fillStyle = vgrad(top, h, [[0, shade(col, 0.06)], [1, shade(col, -0.08)]]);
    ctx.fill();
    return yAt;
  }
  // Ferne Kronen als Tupfer entlang einer Linie
  function auFarCanopy(x0, x1, yAt, Q, r, rows, rr) {
    const cols = [Q.red, Q.orange, Q.yellow, Q.gold, Q.olive];
    for (let row = 0; row < rows; row++) {
      const groups = cols.map(() => []), sh = [];
      for (let x = x0; x < x1; x += 3 + r() * 3) {
        const y = yAt(x) + 1 + row * 7 + r() * 3, rad = rr * (0.7 + r() * 0.6);
        groups[Math.floor(r() * cols.length)].push([x, y, rad]);
        sh.push([x + rad * 0.3, y + rad * 0.35, rad]);
      }
      dots(sh, rgba(shade(Q.brownleaf, -0.2), 0.5));
      groups.forEach((g, j) => dots(g, cols[j]));
    }
  }

  const AU_FAR = 448, AU_MID = 506;
  const auFar = {
    fbales: {
      size: r => [260 + r() * 50, 150],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.58), top = h - 72 - r() * 16;
        const yAt = auFarHill(w, h, top, Q.stubble, r);
        ctx.save();
        ctx.clip();
        const fc = [Q.stubble, shade(Q.stubble, -0.08), mix(Q.stubble, Q.meadow, 0.5), mix(Q.brownleaf, Q.stubble, 0.4)];
        for (let k = 0; k < 7; k++) {
          const y0 = top + k * 11 + r() * 4;
          ctx.beginPath();
          ctx.moveTo(-4, y0 + 6);
          ctx.lineTo(w + 4, y0 - 4);
          ctx.lineTo(w + 4, y0 + 8);
          ctx.lineTo(-4, y0 + 18);
          ctx.closePath();
          ctx.fillStyle = rgba(fc[k % 4], 0.7);
          ctx.fill();
        }
        ctx.restore();
        const bales = [];
        for (let k = 0; k < 9; k++) { const x = w * (0.15 + r() * 0.7), y = yAt(x) + 6 + r() * 26; bales.push([x, y]); }
        ellipses(bales.map(([x, y]) => [x + 4, y + 1, 4.5, 0.8, 0]), rgba(INK, 0.15));
        dots(bales.map(([x, y]) => [x, y - 1.6, 2]), mix(Q.straw, CREAM, 0.15));
        const ex = w * (0.3 + r() * 0.4);
        crown(ex, yAt(ex) - 9, 9, 8, Q.orange, Q.yellow, r, 6, 6);
        auFarCanopy(w * 0.72, w * 0.95, x => yAt(x) + 2, Q, r, 1, 3.4);
      }
    },
    fvillage: {
      size: r => [250 + r() * 40, 160],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.56), top = h - 80;
        const yAt = auFarHill(w, h, top, mix(Q.meadow, Q.stubble, 0.3), r);
        auFarCanopy(w * 0.06, w * 0.3, x => yAt(x) + 2, Q, r, 2, 4);
        // Häuser mit steilen Dächern, eine Kirche mit schlankem Turm
        const cx = w * 0.55, houses = [];
        for (let k = 0; k < 6; k++) houses.push([cx + (k - 2.5) * 19 + (r() - 0.5) * 6, 10 + r() * 6, 12 + r() * 6]);
        const ty = yAt(cx) - 2;
        // Rauchfahnen ziehen nach rechts
        for (const [hx, hw] of houses.filter((_, k) => k % 2 === 0)) {
          for (let j = 0; j < 5; j++) soft(hx + hw * 0.3 + j * 7, ty - 26 - j * 6, 6 + j * 2.5, 4 + j, mix(CREAM, Q.haze, 0.3), 0.32 - j * 0.05);
        }
        const kx = cx + 30, ky = ty + 2;
        ctx.fillStyle = Q.wall;
        ctx.fillRect(kx - 4, ky - 40, 8, 40);
        poly([[kx - 5, ky - 40], [kx, ky - 62], [kx + 5, ky - 40]], Q.roof);
        poly([[kx, ky - 62], [kx + 5, ky - 40], [kx + 1, ky - 40]], shade(Q.roof, -0.25));
        ctx.fillStyle = rgba(INK, 0.2);
        ctx.fillRect(kx + 1, ky - 40, 3, 40);
        for (const [hx, hw, hh] of houses) {
          const yb = yAt(hx) + 3;
          ctx.fillStyle = Q.wall;
          ctx.fillRect(hx - hw / 2, yb - hh * 0.55, hw, hh * 0.55);
          ctx.fillStyle = rgba(INK, 0.18);
          ctx.fillRect(hx + hw * 0.15, yb - hh * 0.55, hw * 0.35, hh * 0.55);
          poly([[hx - hw / 2 - 1.5, yb - hh * 0.55], [hx, yb - hh * 1.15], [hx + hw / 2 + 1.5, yb - hh * 0.55]], Q.roof);
          poly([[hx, yb - hh * 1.15], [hx + hw / 2 + 1.5, yb - hh * 0.55], [hx + 1, yb - hh * 0.55]], shade(Q.roof, -0.22));
          if (r() < 0.5) { ctx.fillStyle = mix(Q.yellow, CREAM, 0.4); ctx.fillRect(hx - hw * 0.3, yb - hh * 0.38, 2, 2.4); }
        }
        auFarCanopy(w * 0.78, w * 0.98, x => yAt(x) + 3, Q, r, 2, 3.8);
      }
    },
    fpoplars: {
      size: r => [230 + r() * 40, 160],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.58), top = h - 64;
        const yAt = auFarHill(w, h, top, mix(Q.meadow, Q.brownleaf, 0.3), r);
        ctx.strokeStyle = rgba(mix(Q.stubble, CREAM, 0.3), 0.4);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(w * 0.05, yAt(w * 0.05) + 12);
        for (let k = 1; k <= 10; k++) { const x = w * (0.05 + k * 0.09); ctx.lineTo(x, yAt(x) + 8 + k * 0.6); }
        ctx.stroke();
        for (let k = 0; k < 9; k++) {
          const x = w * (0.1 + k * 0.095) + (r() - 0.5) * 4, y = yAt(x) + 7, ph = 34 + r() * 14;
          ellipse(x + ph * 0.35, y + 1, ph * 0.4, 1.4, 0, rgba(INK, 0.12));
          ellipse(x + 1.2, y - ph * 0.5 + 1, 4.6, ph * 0.5, 0, shade(Q.gold, -0.22));
          ellipse(x, y - ph * 0.5, 4.2, ph * 0.5, 0, k % 3 === 2 ? Q.orange : Q.yellow);
          ellipse(x - 1.4, y - ph * 0.62, 1.6, ph * 0.3, 0, rgba(CREAM, 0.2));
        }
      }
    },
    fwoods: {
      size: r => [270 + r() * 40, 190],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.6), top = h - 120;
        const yAt = auFarHill(w, h, top, Q.brownleaf, r);
        auFarCanopy(w * 0.04, w * 0.96, x => yAt(x) - 1, Q, r, 5, 6);
        // hölzerner Aussichtsturm auf der Kuppe
        const tx = w * (0.45 + r() * 0.1), ty = yAt(tx) - 2, wood = Q.wood;
        segs([[tx - 8, ty, tx - 4, ty - 46], [tx + 8, ty, tx + 4, ty - 46], [tx - 7, ty - 10, tx + 6, ty - 26], [tx + 7, ty - 10, tx - 6, ty - 26], [tx - 6, ty - 30, tx + 5, ty - 44]], wood, 1.4);
        ctx.fillStyle = wood;
        ctx.fillRect(tx - 7, ty - 54, 14, 8);
        poly([[tx - 9, ty - 54], [tx, ty - 62], [tx + 9, ty - 54]], Q.roof);
        soft(w * 0.5, h - 18, w * 0.5, 14, Q.mist, 0.6);
      }
    }
  };

  const auMid = {
    bales: {
      size: r => [300 + r() * 40, 130],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.34), top = h - 62 - r() * 10;
        // Hecke und Bäumchen am oberen Feldrand
        auTree(w * 0.86, top + 12, 92, 'round', Q, r, 0);
        auTree(w * 0.1, top + 16, 70, 'round', Q, r, 0);
        const yAt = auMound(w, h, top, Q.stubble, r, false);
        // Stoppelreihen folgen der Wölbung
        const st = [], st2 = [];
        for (let row = 0; row < 9; row++) {
          for (let x = 4 + (row % 2) * 4; x < w - 4; x += 8) {
            const y = yAt(x) + 4 + row * 6;
            if (y > h - 2) continue;
            (row % 2 ? st : st2).push([x, y - 2, 0.8, 2.2]);
          }
        }
        rects(st, rgba(shade(Q.stubble, -0.3), 0.5));
        rects(st2, rgba(mix(Q.stubble, CREAM, 0.35), 0.5));
        const he = [];
        for (let x = w * 0.2; x < w * 0.75; x += 3) he.push([x, yAt(x) + 1, 2.4 + r() * 1.4]);
        dots(he, shade(Q.olive, -0.15));
        dots(he.filter(() => r() < 0.4).map(([a, b, c]) => [a, b - 1, c * 0.6]), Q.orange);
        // Rundballen, hinten kleiner
        const list = [];
        for (let k = 0; k < 5; k++) { const x = w * (0.12 + k * 0.17) + (r() - 0.5) * 14, d = r(); list.push([x, yAt(x) + 10 + d * 34, 6 + d * 8]); }
        list.sort((a, b) => a[1] - b[1]);
        for (const [x, y, R] of list) auBale(x, y, R, Q);
        // gestapelte Quaderballen
        const sx = w * (0.7 + r() * 0.1), sy = yAt(sx) + 30;
        for (const [dx, dy] of [[0, 0], [16, 0], [8, -9]]) {
          ctx.fillStyle = shade(Q.straw, -0.05);
          ctx.fillRect(sx + dx, sy + dy - 9, 16, 9);
          ctx.fillStyle = rgba(INK, 0.2);
          ctx.fillRect(sx + dx + 12, sy + dy - 9, 4, 9);
          segs([[sx + dx + 5, sy + dy - 9, sx + dx + 5, sy + dy], [sx + dx + 10, sy + dy - 9, sx + dx + 10, sy + dy]], rgba(shade(Q.straw, -0.4), 0.5), 0.6);
        }
        ellipse(sx + 34, sy, 22, 1.6, 0, rgba(INK, 0.18));
      }
    },
    bridge: {
      size: r => [320 + r() * 30, 200],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.34), yb = h, wl = yb - 26;
        auTree(w * 0.12, yb - 64, 130, 'round', Q, r, 0);
        auTree(w * 0.86, yb - 62, 150, 'birch', Q, r, 0);
        // Bach in der Senke
        ctx.fillStyle = vgrad(wl, yb, [[0, mix(Q.water, CREAM, 0.25)], [0.5, Q.water], [1, shade(Q.water, -0.2)]]);
        ctx.fillRect(w * 0.3, wl, w * 0.4, yb - wl);
        const rip = [];
        for (let k = 0; k < 14; k++) { const x = w * (0.34 + r() * 0.32), y = wl + 3 + r() * 20; rip.push([x, y, x + 5 + r() * 8, y]); }
        segs(rip, rgba(CREAM, 0.35), 0.8);
        auStrewn(10, w * 0.36, w * 0.64, () => wl + 2, 18, Q, r, 0.8);
        // Ufer links und rechts
        for (const d of [-1, 1]) {
          const x0 = d < 0 ? -2 : w + 2, xe = w * 0.5 + d * w * 0.09, xt = w * 0.5 + d * w * 0.2;
          const pts = [[x0, yb + 2], [x0, yb - 68], [xt, yb - 66], [lerp(xt, xe, 0.6), yb - 44], [xe, wl + 2], [xe, yb + 2]];
          smooth(pts, true);
          ctx.fillStyle = vgrad(yb - 70, yb, [[0, shade(Q.meadow, d < 0 ? 0.08 : -0.04)], [1, shade(Q.meadow, -0.25)]]);
          ctx.fill();
          const stn = [[xe - d * 6, wl + 4, 5, 3], [xe + d * 3, wl + 10, 4, 2.6], [lerp(xt, xe, 0.7), yb - 36, 4, 2.4]];
          pebbles(stn, Q.stone);
          const rd = [];
          for (let k = 0; k < 8; k++) { const x = xe - d * (2 + r() * 14), y = wl + 2; rd.push([x, y, x + (r() - 0.5) * 4, y - 8 - r() * 10]); }
          segs(rd, shade(Q.olive, -0.1), 1.1);
        }
        auStrewn(16, 2, w * 0.22, () => yb - 68, 4, Q, r);
        auStrewn(16, w * 0.78, w - 2, () => yb - 68, 4, Q, r);
        // Nebel in der Senke
        soft(w * 0.5, wl - 6, w * 0.26, 12, Q.mist, 0.65);
        soft(w * 0.42, wl - 14, w * 0.16, 7, Q.mist, 0.4);
        // Holzbrücke im flachen Bogen
        const L = [w * 0.24, yb - 68], R = [w * 0.76, yb - 68], cy = yb - 120, wood = Q.wood, lit = mix(Q.woodLight, CREAM, 0.2);
        const at = t => { const u = 1 - t; return [u * u * L[0] + 2 * u * t * w * 0.5 + t * t * R[0], u * u * L[1] + 2 * u * t * cy + t * t * R[1]]; };
        segs([[w * 0.3, yb - 52, at(0.25)[0], at(0.25)[1] + 5], [w * 0.7, yb - 52, at(0.75)[0], at(0.75)[1] + 5]], shade(wood, -0.2), 3);
        ctx.beginPath();
        ctx.moveTo(L[0], L[1]);
        ctx.quadraticCurveTo(w * 0.5, cy, R[0], R[1]);
        ctx.lineTo(R[0], R[1] + 7);
        ctx.quadraticCurveTo(w * 0.5, cy + 7, L[0], L[1] + 7);
        ctx.closePath();
        ctx.fillStyle = vgrad(cy * 0.5 + L[1] * 0.5 - 4, L[1] + 7, [[0, lit], [0.35, wood], [1, shade(wood, -0.3)]]);
        ctx.fill();
        const pl = [];
        for (let k = 1; k < 18; k++) { const [px, py] = at(k / 18); pl.push([px, py + 1, px, py + 6]); }
        segs(pl, rgba(INK, 0.3), 0.7);
        // Geländer: Pfosten, Handlauf, Mittellatte
        const posts = [];
        for (let k = 0; k <= 8; k++) { const [px, py] = at(k / 8); posts.push([px, py, px, py - 17]); }
        segs(posts, shade(wood, -0.15), 2.4);
        segs(posts.map(([a, b, c, d]) => [a - 0.7, b, c - 0.7, d]), rgba(lit, 0.6), 0.7);
        for (const [off, lw, c] of [[-17, 2, wood], [-9, 1.4, shade(wood, -0.1)]]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(L[0], L[1] + off);
          ctx.quadraticCurveTo(w * 0.5, cy + off, R[0], R[1] + off);
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(lit, 0.55);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(L[0], L[1] - 18);
        ctx.quadraticCurveTo(w * 0.5, cy - 18, R[0], R[1] - 18);
        ctx.stroke();
        auStrewn(8, w * 0.3, w * 0.7, x => at((x - L[0]) / (R[0] - L[0]))[1] - 1, 1, Q, r);
      }
    },
    hochsitz: {
      size: r => [210 + r() * 30, 250],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.34), yb = h - 4;
        auTree(w * 0.74, yb, 180, 'round', Q, r, 0);
        auTree(w * 0.12, yb + 2, 150, 'fir', Q, r, 0);
        auTree(w * 0.92, yb + 2, 120, 'fir', Q, r, 0);
        const yAt = auMound(w, h, yb - 8, Q.meadow, r, true);
        const x0 = w * 0.47, ph = 124, pt = yb - 6 - ph, wood = Q.wood, back = shade(wood, -0.3), lit = mix(Q.woodLight, CREAM, 0.15);
        ellipse(x0 + 70, yb - 2, 80, 3.4, 0, rgba(INK, 0.2));
        // hintere Beine und Streben
        segs([[x0 - 26, yb - 2, x0 - 16, pt], [x0 + 38, yb - 4, x0 + 24, pt]], back, 3.2);
        // vordere Beine mit Andreaskreuzen
        segs([[x0 - 36, yb, x0 - 22, pt], [x0 + 32, yb, x0 + 20, pt]], wood, 3.8);
        segs([[x0 - 36, yb + 1, x0 - 22, pt + 1].map((v, k) => v - (k % 2 ? 0 : 1.2))], rgba(lit, 0.6), 1);
        segs([[x0 - 33, yb - 20, x0 + 26, yb - 72], [x0 + 30, yb - 20, x0 - 29, yb - 72], [x0 - 28, yb - 72, x0 + 24, yb - 112], [x0 + 26, yb - 72, x0 - 25, yb - 112]], shade(wood, -0.08), 2);
        // Plattform und Kanzel
        ctx.fillStyle = shade(wood, -0.1);
        ctx.fillRect(x0 - 30, pt - 2, 60, 6);
        const cw = 48, ch = 36, cx = x0 - 24, cyy = pt - ch - 2;
        ctx.fillStyle = hgrad(cx, cx + cw, [[0, lit], [0.25, wood], [1, shade(wood, -0.25)]]);
        ctx.fillRect(cx, cyy, cw, ch);
        const pl = [];
        for (let x = cx + 6; x < cx + cw; x += 6) pl.push([x, cyy + 2, x, cyy + ch]);
        segs(pl, rgba(INK, 0.25), 0.7);
        ctx.fillStyle = mix(Q.dark, INK, 0.3);
        ctx.fillRect(cx + 6, cyy + 9, cw - 12, 9);
        ctx.fillStyle = rgba(INK, 0.2);
        ctx.fillRect(cx, cyy + ch - 4, cw, 4);
        poly([[cx - 7, cyy + 2], [cx + cw + 6, cyy - 7], [cx + cw + 6, cyy - 3], [cx - 7, cyy + 6]], shade(Q.roof, -0.2));
        poly([[cx - 7, cyy + 2], [cx + cw + 6, cyy - 7], [cx + cw + 4, cyy - 9], [cx - 8, cyy]], mix(Q.roof, CREAM, 0.1));
        // Leiter
        const lx0 = x0 - 64, lx1 = x0 - 30;
        segs([[lx0, yb, lx1, pt + 2], [lx0 + 9, yb, lx1 + 9, pt + 2]], wood, 2);
        const rung = [];
        for (let t = 0.08; t < 1; t += 0.085) rung.push([lerp(lx0, lx1, t), lerp(yb, pt, t), lerp(lx0, lx1, t) + 9, lerp(yb, pt, t)]);
        segs(rung, shade(wood, -0.1), 1.4);
        auStrewn(26, 6, w - 6, yAt, 4, Q, r);
        // Laub auf dem Dach
        auStrewn(5, cx, cx + cw, x => lerp(cyy - 1, cyy - 9, (x - cx) / cw), 1, Q, r);
      }
    },
    oak: {
      size: r => [270 + r() * 30, 290],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.34), yb = h - 6, x0 = w * 0.48;
        const yAt = auMound(w, h, yb - 4, Q.meadow, r, true);
        ellipse(x0 + 120, yb - 1, 130, 4, 0, rgba(INK, 0.18));
        // Laubteppich unter der Krone
        ellipse(x0, yb - 1, 110, 6, 0, rgba(Q.orange, 0.45));
        auStrewn(70, x0 - 110, x0 + 110, () => yb - 4, 7, Q, r);
        // Bank
        const bx = w * 0.12;
        segs([[bx, yb - 1, bx, yb - 12], [bx + 30, yb - 1, bx + 30, yb - 12], [bx + 2, yb - 12, bx + 2, yb - 24], [bx + 28, yb - 12, bx + 28, yb - 24]], shade(Q.wood, -0.2), 2);
        ctx.fillStyle = Q.wood;
        ctx.fillRect(bx - 3, yb - 14, 37, 3.2);
        ctx.fillRect(bx - 2, yb - 25, 35, 2.6);
        ctx.fillRect(bx - 2, yb - 20, 35, 2.2);
        // Stamm und Äste
        const tw = 26, list = [];
        trunkShape(x0, yb, yb - 128, tw, tw * 0.7, 0, Q.bark);
        for (const [a, len] of [[-2.2, 70], [-1.75, 64], [-1.25, 66], [-0.85, 72]]) boughs(x0 + (a + 1.57) * 10, yb - 118, a, len, tw * 0.32, 1, r, list, 0.45);
        drawBoughs(list, Q.bark);
        const fur = [];
        for (let k = 0; k < 9; k++) { const fx = x0 - tw * 0.4 + k * tw * 0.1; fur.push([fx, yb - 120, fx + (r() - 0.5) * 3, yb - 8]); }
        segs(fur, rgba(INK, 0.22), 1);
        // Krone aus vier Teilen
        const cy = yb - 186;
        crown(x0 - 70, cy + 20, 58, 46, Q.orange, Q.red, r, 12, 40);
        crown(x0 + 72, cy + 24, 56, 44, Q.gold, Q.orange, r, 12, 40);
        crown(x0 + 20, cy - 10, 72, 54, Q.red, Q.orange, r, 16, 60);
        crown(x0 - 24, cy - 30, 54, 40, Q.orange, Q.yellow, r, 12, 40);
        // fallende Blätter
        const fl = [];
        for (let k = 0; k < 8; k++) fl.push([x0 + (r() - 0.3) * 160, cy + 60 + r() * 80]);
        for (const [fx, fy] of fl) leaf(fx, fy, 5, 3, r() * TAU, pickOf(r, auLeafCols(Q)), LEAF_B, false);
      }
    },
    birches: {
      size: r => [220 + r() * 40, 270],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.34), yb = h - 6;
        auTree(w * 0.76, yb, 150, 'round', Q, r, 0);
        const n = 3;
        for (let k = 0; k < n; k++) auTree(w * (0.14 + k * 0.72 / (n - 1)) + (r() - 0.5) * 10, yb + 2, 190 + r() * 70, 'birch', Q, r, 0.08);
        const yAt = auMound(w, h, yb - 6, Q.meadow, r, true);
        auStrewn(40, 4, w - 4, yAt, 5, Q, r);
        for (let k = 0; k < 7; k++) leaf(w * r(), 40 + r() * (h - 90), 5, 3, r() * TAU, pickOf(r, [Q.yellow, Q.gold, Q.orange]), LEAF_B, false);
      }
    },
    woodpile: {
      size: r => [200 + r() * 30, 130],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.34), yb = h - 6;
        auTree(w * 0.8, yb, 110, pickOf(r, ['round', 'beech']), Q, r, 0);
        const yAt = auMound(w, h, yb - 4, Q.meadow, r, true);
        const x0 = w * 0.1, x1 = w * 0.66, top = yb - 66;
        ellipse(x1 + 50, yb - 1, 70, 3, 0, rgba(INK, 0.2));
        // Pfosten und Pultdach
        segs([[x0 - 3, yb, x0 - 3, top - 10], [x1 + 3, yb, x1 + 3, top - 4]], shade(Q.wood, -0.25), 3);
        // Scheite: Stirnseiten in versetzten Reihen
        const ends = [], rings = [], cores = [];
        for (let row = 0, y = yb - 7; y > top + 2; row++, y -= 11) {
          for (let x = x0 + 6 + (row % 2) * 6; x < x1 - 4; x += 12.5) { const rr = 5.6 + r() * 1.2; ends.push([x, y, rr]); rings.push([x + 0.4, y + 0.3, rr * 0.55]); cores.push([x + 0.6, y + 0.4, 0.9]); }
        }
        dots(ends.map(([a, b, c]) => [a + 0.8, b + 1, c + 0.6]), shade(Q.bark, -0.2));
        dots(ends, mix(Q.woodLight, CREAM, 0.12));
        ctx.strokeStyle = rgba(shade(Q.woodLight, -0.35), 0.55);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (const [a, b, c] of rings) { ctx.moveTo(a + c, b); ctx.arc(a, b, c, 0, TAU); }
        ctx.stroke();
        dots(cores, shade(Q.woodLight, -0.4));
        dots(ends.map(([a, b, c]) => [a - c * 0.35, b - c * 0.35, c * 0.35]), rgba(CREAM, 0.25));
        poly([[x0 - 10, top - 8], [x1 + 10, top - 2], [x1 + 10, top + 3], [x0 - 10, top - 3]], shade(Q.roof, -0.15));
        poly([[x0 - 10, top - 8], [x1 + 10, top - 2], [x1 + 9, top - 5], [x0 - 11, top - 11]], mix(Q.roof, CREAM, 0.1));
        auStrewn(6, x0, x1, x => lerp(top - 10, top - 4, (x - x0) / (x1 - x0)), 1, Q, r);
        // Hackklotz mit Axt
        const kx = w * 0.8, ky = yb - 2;
        roundRectPath(kx - 9, ky - 14, 18, 14, 2);
        ctx.fillStyle = hgrad(kx - 9, kx + 9, [[0, shade(Q.bark, 0.2)], [1, shade(Q.bark, -0.3)]]);
        ctx.fill();
        ellipse(kx, ky - 14, 9, 2.6, 0, mix(Q.woodLight, CREAM, 0.15));
        line(kx - 2, ky - 15, kx - 14, ky - 34, Q.woodLight, 2);
        poly([[kx - 4, ky - 14], [kx + 4, ky - 21], [kx + 6, ky - 17], [kx + 1, ky - 12]], mix(Q.stone, CREAM, 0.15));
        auStrewn(18, 4, w - 4, yAt, 4, Q, r);
      }
    },
    pond: {
      size: r => [300 + r() * 40, 160],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.36), yb = h - 4, wy = yb - 26;
        auTree(w * 0.18, wy - 14, 120, 'round', Q, r, 0);
        auTree(w * 0.4, wy - 18, 140, 'poplar', Q, r, 0);
        auTree(w * 0.74, wy - 16, 130, 'fir', Q, r, 0);
        auTree(w * 0.9, wy - 12, 100, 'round', Q, r, 0);
        auMound(w, h, wy - 22, Q.meadow, r, true);
        // Teich mit gespiegeltem Himmel und Baumspiegelungen
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(w * 0.5, wy + 6, w * 0.42, 15, 0, 0, TAU);
        ctx.clip();
        ctx.fillStyle = vgrad(wy - 10, wy + 22, [[0, mix(Q.water, CREAM, 0.35)], [0.6, Q.water], [1, shade(Q.water, -0.2)]]);
        ctx.fillRect(0, wy - 10, w, 34);
        for (const [tx, c] of [[0.18, Q.orange], [0.4, Q.yellow], [0.74, Q.fir], [0.9, Q.red]]) ctx.fillStyle = rgba(c, 0.35), ctx.fillRect(w * tx - 14, wy - 9, 28, 30);
        const rip = [];
        for (let k = 0; k < 16; k++) { const x = w * (0.12 + r() * 0.76), y = wy - 4 + r() * 18; rip.push([x, y, x + 6 + r() * 10, y]); }
        segs(rip, rgba(CREAM, 0.4), 0.8);
        auStrewn(10, w * 0.15, w * 0.85, () => wy - 4, 16, Q, r, 0.85);
        ctx.restore();
        // Schilf und Rohrkolben am Rand
        const rd = [];
        for (let k = 0; k < 24; k++) { const side = k % 2 ? 1 : -1, x = w * 0.5 + side * w * (0.3 + r() * 0.14), y = wy + 6 + r() * 6; rd.push([x, y, x + (r() - 0.5) * 5, y - 10 - r() * 16]); }
        segs(rd, shade(Q.olive, -0.08), 1.1);
        for (const [, , x, y] of rd.filter(() => r() < 0.3)) { roundRectPath(x - 1.3, y - 3, 2.6, 7, 1.3); ctx.fillStyle = shade(Q.bark, 0.05); ctx.fill(); }
        soft(w * 0.5, wy - 2, w * 0.38, 9, Q.mist, 0.6);
        soft(w * 0.35, wy - 10, w * 0.2, 6, Q.mist, 0.35);
      }
    },
    baretree: {
      size: r => [230 + r() * 30, 280],
      paint: (w, h, r, C) => {
        const Q = auPal(C, 0.36), yb = h - 6, x0 = w * 0.45;
        const yAt = auMound(w, h, yb - 4, shade(Q.meadow, -0.05), r, true);
        ellipse(x0 + 110, yb - 1, 120, 3.4, 0, rgba(INK, 0.16));
        const tw = 16, list = [];
        trunkShape(x0, yb, yb - 110, tw, tw * 0.6, 4, Q.bark);
        for (const [a, len] of [[-2.3, 60], [-1.85, 70], [-1.35, 72], [-0.9, 58]]) boughs(x0 + 4 + (a + 1.57) * 6, yb - 104, a, len, tw * 0.3, 3, r, list, 0.5);
        drawBoughs(list, Q.bark);
        // letzte Blätter und Krähen
        const lv = [];
        for (const s of list) if (s[4] < 2 && r() < 0.3) lv.push([s[2], s[3], 1.4 + r()]);
        dots(lv, Q.orange);
        dots(lv.filter((_, k) => k % 3 === 0).map(([a, b, c]) => [a + 1, b + 1, c]), Q.red);
        const perches = list.filter(s => s[4] > 1.4 && s[4] < 4).slice(0, 12);
        for (let k = 0; k < 2 && perches.length; k++) {
          const s = perches[Math.floor(r() * perches.length)], bx = (s[0] + s[2]) / 2, by = (s[1] + s[3]) / 2 - 1;
          ellipse(bx, by - 3.5, 4.2, 3, -0.2, Q.dark);
          circle(bx - 3.6, by - 6, 2.2, Q.dark);
          poly([[bx - 5.4, by - 6.4], [bx - 8, by - 5.6], [bx - 5.4, by - 5.2]], shade(Q.stone, -0.3));
          poly([[bx + 3, by - 4.2], [bx + 8, by - 1.8], [bx + 3, by - 2]], Q.dark);
        }
        const fx = w * 0.8, fy = 50 + r() * 30;
        ctx.strokeStyle = Q.dark;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(fx - 9, fy - 3); ctx.quadraticCurveTo(fx - 4, fy - 6, fx, fy); ctx.quadraticCurveTo(fx + 4, fy - 6, fx + 9, fy - 3);
        ctx.stroke();
        auStrewn(40, 6, w - 6, yAt, 5, Q, r);
        soft(w * 0.5, yb - 8, w * 0.5, 12, Q.mist, 0.55);
      }
    }
  };

  // Der Ablauf: erst gemütlich (Ballen, Eiche, Brücke, Hochsitz), später mehr kahle Bäume und Nebelteiche
  SCENE['Herbstwald'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 40, gap: [30, 150], maxKs: 1.5, base: () => AU_FAR,
        pick: flow(['fbales', 'fvillage', 'fwoods', 'fpoplars'], [['fbales', 1.5], ['fvillage', 1.4], ['fwoods', 1.8], ['fpoplars', 1.3]], 1),
        kinds: auFar },
      { z: 1, factor: 0.34, start: 20, gap: [20, 120], maxKs: 2, base: () => AU_MID,
        pick: flow(['bales', 'oak', 'bridge', 'hochsitz', 'woodpile', 'birches', 'pond'],
          i => [['bales', 1.2], ['oak', 1.2], ['bridge', 1.3], ['hochsitz', 1.2], ['woodpile', 1], ['birches', 1.2], ['pond', 0.9 + i * 0.04], ['baretree', 0.3 + i * 0.12]], 3),
        kinds: auMid }
      // Keine herabhängenden Laubzweige: sie ähnelten dem Blattgeschoss des Bosses zu sehr
    ]
  };

  // ============================================================
  // Bosse: Zwischenspeicher für ruhende Teile (wie b_art3_bosses.js)
  // ============================================================
  const LP = 34, layerCache = new Map();
  function cached(id, P, paint, x0 = -LP, y0 = -LP, w = CONFIG.BOSS_W + LP * 2, h = CONFIG.BOSS_H + LP * 2) {
    const m = ctx.getTransform ? ctx.getTransform() : { a: view.k, b: 0 };
    const k = Math.hypot(m.a, m.b) || 1;
    const key = P.main + P.acc + P.near + P.far + P.sky + P.ink + '|' + k.toFixed(4);
    let L = layerCache.get(id);
    if (!L) {
      const owner = id.split(':')[0];
      for (const [oid, ol] of layerCache) if (oid.split(':')[0] !== owner) { freeCanvas(ol.c); layerCache.delete(oid); }
      L = { c: newCanvas(1, 1), key: '', k: 1 };
      layerCache.set(id, L);
    }
    if (L.key !== key) {
      const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      if (L.c.width !== cw || L.c.height !== ch) { L.c.width = cw; L.c.height = ch; }
      const g = L.c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
      setupG(g);
      withCtx(g, paint);
      L.key = key;
      L.k = k;
    }
    ctx.drawImage(L.c, x0, y0, L.c.width / L.k, L.c.height / L.k);
  }
  function glow(x, y, r, col, a) {
    if (a <= 0.004 || r <= 0.5) return;
    ctx.fillStyle = rgrad(x, y, 0, r, [[0, rgba(col, Math.min(1, a))], [0.45, rgba(col, Math.min(1, a) * 0.38)], [1, rgba(col, 0)]]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  function layered(path, side, front, dx, dy) {
    ctx.save();
    ctx.translate(dx === undefined ? 1.5 : dx, dy === undefined ? 2 : dy);
    path();
    ctx.fillStyle = side;
    ctx.fill();
    ctx.restore();
    path();
    ctx.fillStyle = front;
    ctx.fill();
  }
  function pivot(x, y, a, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.translate(-x, -y);
    fn();
    ctx.restore();
  }
  const blinkAt = (t, period, dur) => { const p = (t % period) / dur; return p < 1 ? Math.sin(p * Math.PI) : 0; };

  // ---------------------------------------------------------
  // Pilzkönig: dicker Pilz mit schiefer Krone, Halskrause aus Lamellenstoff,
  // Eichel-Zepter und kleinem Schnurrbart. Vorwarnung: Hut hebt sich, Lamellen
  // glühen, Sporenwolke, Augen funkeln, das Maul öffnet sich und ein Blatt erscheint.
  // ---------------------------------------------------------
  ART2.boss.mushroom = (P, t, w) => {
    const ew = smooth01(w), br = Math.sin(t * 0.05);
    const stem = mix(P.sky, P.cream, 0.4), stemSide = mix(stem, P.far, 0.45), stemDark = mix(P.far, P.main, 0.35);
    const capC = mix(P.acc, P.main, 0.38), capLight = mix(capC, P.sky, 0.45), capDark = mix(capC, P.near, 0.55);
    const gill = mix(P.sky, P.far, 0.4), gillDark = mix(P.far, P.main, 0.45);
    const gold = P.sky, goldSide = P.far, goldDark = mix(P.far, P.main, 0.5);
    const capY = br * 1.1 - ew * 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Zepter: Zweig mit Eichel, hinter dem Körper; bei der Vorwarnung nach vorn gereckt
    pivot(82, 76, -0.12 - ew * 0.3 + br * 0.03, () => {
      ctx.strokeStyle = goldDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(84, 104);
      ctx.quadraticCurveTo(80, 64, 86, 26);
      ctx.stroke();
      ctx.strokeStyle = rgba(P.cream, 0.35);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(83, 100);
      ctx.quadraticCurveTo(79, 64, 85, 28);
      ctx.stroke();
      ellipse(86.6, 16.6, 5.4, 6.6, 0.1, P.far);
      ellipse(85.4, 15, 2.4, 3.6, 0.1, rgba(P.cream, 0.45));
      ctx.beginPath();
      ctx.ellipse(86, 22, 6.4, 3.8, 0.1, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = P.main;
      ctx.fill();
      dots([[82.6, 21, 0.8], [85.6, 19.8, 0.8], [88.8, 20.6, 0.8]], P.mainDark);
      line(86.5, 10.4, 87.6, 7.6, goldDark, 1.2);
    });

    // Myzelfäden unter dem Fuß
    ctx.strokeStyle = rgba(stemSide, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const x0 = 26 + k * 8.5, len = 9 + (k * 7) % 8, sw = Math.sin(t * 0.06 + k * 1.3) * 2.5;
      ctx.moveTo(x0, 102);
      ctx.quadraticCurveTo(x0 + sw * 0.5, 102 + len * 0.6, x0 + sw, 102 + len);
    }
    ctx.stroke();

    // Lamellen-Unterseite des Huts (bewegt sich mit dem Hut)
    ctx.save();
    ctx.translate(0, capY);
    cached('au:gills', P, () => {
      ctx.beginPath();
      ctx.ellipse(45, 22.5, 47, 8.6, -0.07, 0, TAU);
      ctx.fillStyle = gill;
      ctx.fill();
      ctx.strokeStyle = rgba(gillDark, 0.75);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let k = 0; k <= 26; k++) {
        const a = Math.PI * (k / 26), ex = 45 + Math.cos(a) * 46, ey = 22.5 + Math.sin(a) * 8.2 - (45 + Math.cos(a) * 46 - 45) * 0.07;
        ctx.moveTo(45 + Math.cos(a) * 12, 25 + Math.sin(a) * 2);
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.fillStyle = vgrad(18, 31, [[0, rgba(gillDark, 0.5)], [1, rgba(gillDark, 0)]]);
      ctx.fillRect(-4, 18, 98, 13);
    }, -8, 8, 106, 28);
    if (ew > 0.02) glow(45, 26, 30 + ew * 14, P.accLight, ew * 0.55);
    ctx.restore();

    // Körper mit Halskrause und Laubhäufchen am Fuß
    cached('au:stem', P, () => {
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(27, 24);
        ctx.bezierCurveTo(15, 26, 5, 34, 2.5, 45);
        ctx.bezierCurveTo(0.5, 55, 5, 62, 10, 66);
        ctx.bezierCurveTo(10, 77, 12, 91, 20, 100);
        ctx.bezierCurveTo(30, 107, 66, 107, 77, 100);
        ctx.bezierCurveTo(86, 90, 85, 66, 81, 50);
        ctx.bezierCurveTo(79, 36, 73, 26, 66, 24);
        ctx.closePath();
      };
      layered(body, stemDark, stem, 1.6, 1.8);
      body();
      ctx.strokeStyle = rgba(P.ink, 0.3);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.save();
      body();
      ctx.clip();
      ctx.fillStyle = hgrad(40, 88, [[0, rgba(stemSide, 0)], [0.55, rgba(stemSide, 0.7)], [1, rgba(stemDark, 0.85)]]);
      ctx.fillRect(40, 20, 50, 90);
      ctx.fillStyle = vgrad(22, 36, [[0, rgba(gillDark, 0.6)], [1, rgba(gillDark, 0)]]);
      ctx.fillRect(0, 22, 90, 14);
      ctx.fillStyle = vgrad(84, 106, [[0, rgba(stemDark, 0)], [1, rgba(stemDark, 0.55)]]);
      ctx.fillRect(0, 84, 90, 24);
      // feine Längsfasern
      ctx.strokeStyle = rgba(stemSide, 0.45);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let k = 0; k < 9; k++) { const x = 30 + k * 6; ctx.moveTo(x, 34); ctx.quadraticCurveTo(x - 2, 60, x - 4 + k * 0.6, 100); }
      ctx.stroke();
      ellipse(16, 44, 9, 15, 0.25, rgba(P.cream, 0.28));
      ctx.restore();
      // Wangenröte
      ellipse(25, 52, 6.5, 3.6, -0.1, rgba(P.acc, 0.22));
      ellipse(45, 50, 4.5, 3, -0.1, rgba(P.acc, 0.14));
      // Halskrause: gefältelter Kragen mit gewelltem Saum
      const ruff = () => {
        ctx.beginPath();
        ctx.moveTo(1, 72);
        ctx.quadraticCurveTo(44, 62, 88, 69);
        ctx.lineTo(89, 74);
        for (let k = 0; k < 9; k++) {
          const xa = 89 - k * 9.9, xb = xa - 9.9, yy = 75 + Math.sin(k * 0.6) * 1.2;
          ctx.quadraticCurveTo((xa + xb) / 2, yy + 7, xb, yy);
        }
        ctx.closePath();
      };
      ctx.fillStyle = rgba(stemDark, 0.5);
      ctx.fillRect(10, 78, 72, 5);
      layered(ruff, gillDark, gill, 1.2, 2);
      ctx.save();
      ruff();
      ctx.clip();
      ctx.fillStyle = vgrad(62, 84, [[0, rgba(P.cream, 0.7)], [0.5, rgba(P.cream, 0.15)], [1, rgba(gillDark, 0.35)]]);
      ctx.fillRect(0, 60, 92, 26);
      ctx.fillStyle = hgrad(40, 90, [[0, rgba(gillDark, 0)], [1, rgba(gillDark, 0.45)]]);
      ctx.fillRect(40, 60, 52, 26);
      ctx.strokeStyle = rgba(gillDark, 0.7);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 1; k < 9; k++) { const x = 89 - k * 9.9; ctx.moveTo(x + 1, 69 - (44 - Math.abs(x - 44)) * 0.1); ctx.lineTo(x, 75); }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = rgba(P.acc, 0.8);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(2, 71.4);
      ctx.quadraticCurveTo(44, 61.4, 87.5, 68.4);
      ctx.stroke();
      // Ärmchen rechts am Zepter
      ellipse(81, 77, 5, 4, 0.4, stemDark);
      ellipse(80.4, 76.2, 4.2, 3.3, 0.4, stemSide);
      // Laubhäufchen am Fuß
      const lv = [[24, 102, 0.3, P.acc], [36, 104, -0.4, P.far], [50, 104, 0.2, P.accDark], [62, 103, -0.3, P.acc], [72, 101, 0.5, P.far]];
      for (const [lx, ly, a, c] of lv) leaf(lx, ly, 10, 6, a, c);
    });

    // Gesicht: Nase, Schnurrbart, Maul, Augen, Brauen
    const blink = blinkAt(t, 230, 14) * (1 - Math.min(1, ew * 3));
    // Maul: geschlossen ein schiefes Lächeln, offen ein dunkles Oval mit Glut und Blatt
    const mo = ew;
    if (mo > 0.02) {
      const mx = 10, my = 51 + mo * 1.2, rx = 5 + mo * 4.5, ry = 1.2 + mo * 6.2;
      ellipse(mx, my, rx, ry, -0.12, mix(P.ink, P.mainDark, 0.3));
      glow(mx - 1, my, rx + 6, P.accLight, mo * 0.7);
      if (mo > 0.45) {
        const s = (mo - 0.45) / 0.55;
        leaf(mx - 1, my + 0.5, 8 * s + 2, 5 * s + 1, -0.5 + Math.sin(t * 0.2) * 0.2, P.acc);
      }
      ctx.strokeStyle = rgba(stemDark, 0.9);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(mx, my, rx, ry, -0.12, 0, TAU);
      ctx.stroke();
    } else {
      ctx.strokeStyle = mix(P.ink, P.mainDark, 0.4);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(4, 50);
      ctx.quadraticCurveTo(11, 55.5, 19, 51.5);
      ctx.stroke();
      line(19, 51.5, 20.5, 50, mix(P.ink, P.mainDark, 0.4), 1.1);
    }
    // Nase
    circle(5, 44.6, 4.2, stemSide);
    circle(4.3, 43.8, 3.7, mix(stem, P.acc, 0.12));
    circle(3.2, 42.6, 1.2, rgba(P.cream, 0.7));
    // Schnurrbart: zwei geschwungene Büschel, hebt sich beim Öffnen
    const lift = mo * 2.4;
    for (const [d, x0] of [[-1, 4], [1, 9]]) {
      ctx.beginPath();
      ctx.moveTo(x0, 47.5 - lift * 0.5);
      ctx.quadraticCurveTo(x0 + d * 6, 46 - lift, x0 + d * 9, 43.5 - lift + Math.sin(t * 0.07) * 0.6);
      ctx.quadraticCurveTo(x0 + d * 5, 49.5 - lift, x0 - d * 0.5, 49.2 - lift * 0.5);
      ctx.closePath();
      ctx.fillStyle = gillDark;
      ctx.fill();
    }
    // Augen
    const eyes = [[17, 38, 5.6, 6.6], [35.5, 37, 4.3, 5.6]];
    for (const [ex, ey, rx, ry] of eyes) {
      const ryo = ry * (1 + ew * 0.12);
      ellipse(ex + 0.6, ey + 0.8, rx + 0.6, ryo + 0.6, 0, stemDark);
      ellipse(ex, ey, rx, ryo, 0, P.cream);
      if (ew > 0.02) glow(ex - 1.2, ey + 0.5, rx * 2.2, P.acc, ew * 0.5);
      const pr = rx * (0.55 - ew * 0.12);
      circle(ex - 1.4, ey + 0.6, pr, ew > 0.3 ? mix(P.ink, P.accDark, ew) : P.ink);
      circle(ex - 2.2, ey - 1, pr * 0.38, P.cream);
      if (blink > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, rx + 0.3, ryo + 0.3, 0, 0, TAU);
        ctx.clip();
        ctx.fillStyle = stem;
        ctx.fillRect(ex - rx - 1, ey - ryo - 1, rx * 2 + 2, (ryo * 2 + 2) * blink);
        ctx.restore();
      }
    }
    // Brauen: buschig, bei der Vorwarnung grimmig nach innen gezogen
    for (const [bx, by, len, d] of [[17, 29.5, 13, 1], [35.5, 29, 10, 1]]) {
      const tilt = 0.12 - ew * 0.38 + Math.sin(t * 0.04) * 0.04;
      pivot(bx, by - ew * 0.8, tilt, () => {
        ctx.beginPath();
        ctx.moveTo(bx - len * 0.55, by + 1.4);
        ctx.quadraticCurveTo(bx - len * 0.2, by - 3.2, bx + len * 0.5, by - 0.6);
        ctx.quadraticCurveTo(bx + len * 0.1, by + 1.8, bx - len * 0.55, by + 1.4);
        ctx.closePath();
        ctx.fillStyle = gillDark;
        ctx.fill();
        line(bx - len * 0.3, by - 0.4, bx + len * 0.3, by - 1, rgba(P.cream, 0.3), 0.7);
      });
    }

    // Hut mit Krone obenauf
    ctx.save();
    ctx.translate(0, capY);
    cached('au:cap', P, () => {
      const dome = () => {
        ctx.beginPath();
        ctx.moveTo(-5, 25);
        ctx.bezierCurveTo(-8, 4, 18, -14, 46, -14);
        ctx.bezierCurveTo(74, -13, 98, -1, 94, 18);
        ctx.quadraticCurveTo(46, 27, -5, 25);
        ctx.closePath();
      };
      layered(dome, capDark, capC, 1.6, 2);
      dome();
      ctx.strokeStyle = rgba(P.ink, 0.3);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.save();
      dome();
      ctx.clip();
      ctx.fillStyle = rgrad(30, -2, 4, 70, [[0, rgba(capLight, 0.75)], [0.45, rgba(capLight, 0.15)], [1, rgba(capDark, 0)]]);
      ctx.fillRect(-10, -16, 110, 46);
      ctx.fillStyle = hgrad(50, 96, [[0, rgba(capDark, 0)], [1, rgba(capDark, 0.6)]]);
      ctx.fillRect(50, -16, 50, 46);
      // Fasern vom Scheitel zum Rand
      ctx.strokeStyle = rgba(capDark, 0.32);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) { const ex = -4 + k * 6.1; ctx.moveTo(44 + (ex - 44) * 0.15, -10); ctx.quadraticCurveTo(44 + (ex - 44) * 0.7, 2, ex, 22 + (ex < 46 ? 2 : -1)); }
      ctx.stroke();
      // flache, hellere Schuppenfelder (kein Punktmuster)
      ellipses([[26, 2, 5, 2.2, -0.3], [58, 0, 4.5, 2, 0.25], [40, 10, 6, 2.4, 0], [70, 8, 4, 1.8, 0.4], [14, 12, 4, 1.8, -0.5]], rgba(capLight, 0.35));
      ctx.restore();
      // heller Randwulst
      ctx.strokeStyle = rgba(capLight, 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, 24.4);
      ctx.quadraticCurveTo(46, 26.4, 93.5, 17.6);
      ctx.stroke();
      ellipse(22, -1, 14, 4.5, -0.45, rgba(P.cream, 0.35));
      // klebende Blätter
      leaf(64, 6, 12, 7, 0.5, P.acc);
      leaf(72, 12, 10, 6, -0.4, P.far, LEAF_B);
      leaf(8, 14, 9, 5.5, 2.6, P.accDark);
    }, -12, -18, 112, 48);
    // Krone, schief aufgesetzt und leicht wippend
    pivot(44, -13, -0.24 + Math.sin(t * 0.07) * 0.04 - ew * 0.06, () => {
      cached('au:crown', P, () => {
        const cr = () => {
          ctx.beginPath();
          ctx.moveTo(30, -12);
          ctx.lineTo(29, -22);
          ctx.lineTo(34.5, -17);
          ctx.lineTo(39, -27);
          ctx.lineTo(44, -17);
          ctx.lineTo(49, -27);
          ctx.lineTo(53.5, -17);
          ctx.lineTo(59, -22);
          ctx.lineTo(58, -12);
          ctx.closePath();
        };
        layered(cr, goldDark, gold, 1.2, 1.4);
        ctx.save();
        cr();
        ctx.clip();
        ctx.fillStyle = hgrad(30, 58, [[0, rgba(P.cream, 0.55)], [0.4, rgba(P.cream, 0)], [0.7, rgba(goldSide, 0.3)], [1, rgba(goldSide, 0.75)]]);
        ctx.fillRect(28, -28, 32, 17);
        ctx.fillStyle = rgba(goldSide, 0.8);
        ctx.fillRect(28, -15.5, 32, 3.5);
        ctx.restore();
        dots([[29, -22.5, 1.6], [39, -27.5, 1.8], [49, -27.5, 1.8], [59, -22.5, 1.6]], gold);
        dots([[38.6, -28, 0.7], [48.6, -28, 0.7]], P.cream);
        circle(44, -14, 2, P.accDark);
        circle(43.5, -14.5, 1.4, P.acc);
        circle(36, -14, 1.3, P.accDark);
        circle(52, -14, 1.3, P.accDark);
      }, 24, -32, 40, 24);
    });
    // Sporen rieseln unter dem Hut, bei der Vorwarnung pufft eine Wolke heraus
    const sp = [];
    for (let k = 0; k < 6; k++) {
      const p = ((t + k * 29) % 110) / 110;
      sp.push([8 + k * 15 + Math.sin(t * 0.03 + k) * 3, 28 + p * 34, 0.9, (1 - p) * 0.55]);
    }
    for (const [x, y, r0, a] of sp) circle(x, y, r0, rgba(gill, a));
    ctx.restore();
    if (ew > 0.05) {
      for (let k = 0; k < 12; k++) {
        const a = Math.PI * (0.05 + k / 11 * 0.9), d = 34 + ew * 16 + (k % 3) * 4;
        const px = 45 + Math.cos(a) * d * 1.25, py = 24 + capY + Math.sin(a) * d * 0.28 + ew * 4;
        circle(px, py, 1.4 + (k % 3) * 0.8 + ew, rgba(mix(gill, P.accLight, 0.5), ew * 0.55));
      }
    }
  };

  // Geschoss Herbstblatt: gezackt, dreht und taumelt; halb heller (Licht) halb dunkler, dunkle Kontur
  const LEAF_HALF = (() => { const n = (LEAF_C.length - 2) / 2; return LEAF_C.slice(0, n + 2); })();
  ART2.projectile.leaf = (s, C, x, y) => {
    const r = s.r, t = s.t || 0, ang = t * 0.11 + (s.group || 0) * 1.7, len = r * 2.7;
    const wid = r * 1.6 * (0.62 + 0.38 * Math.abs(Math.cos(t * 0.09 + (s.group || 0))));
    const body = mix(C.accent, '#c8321e', 0.42), lit = mix(body, '#f2b04a', 0.45), dark = shade(body, -0.35);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    leafPath(x, y, len, wid, ang, LEAF_C);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.7);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    leafPath(x, y, len, wid, ang, LEAF_HALF);
    ctx.fillStyle = lit;
    ctx.fill();
    const c = Math.cos(ang), sn = Math.sin(ang);
    // Stiel, Mittelrippe, Seitenadern
    line(x - c * len * 0.5, y - sn * len * 0.5, x - c * len * 0.72, y - sn * len * 0.72, rgba(INK, 0.75), 1.6);
    ctx.strokeStyle = rgba(mix(CREAM, lit, 0.3), 0.85);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x - c * len * 0.5, y - sn * len * 0.5);
    ctx.lineTo(x + c * len * 0.42, y + sn * len * 0.42);
    for (let k = 0; k < 3; k++) {
      const u = -0.28 + k * 0.22, bx = x + c * len * u, by = y + sn * len * u;
      for (const d of [1, -1]) {
        const vx = c * 0.55 - sn * d * 0.85, vy = sn * 0.55 + c * d * 0.85, vl = wid * 0.38 * (1 - k * 0.18);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + vx * vl, by + vy * vl);
      }
    }
    ctx.stroke();
  };

  // ============================================================
  // RUINEN (12): überwucherte Tempelruinen im Abendlicht. Eingestürzte Säulenhallen,
  // Treppen, gesichtslose Statuen, Lianen, ferner Dschungel, goldene Lichtakzente,
  // Staub in der Luft. Geheimnisvoll; entlang des Levels legt sich mehr Dämmerung darüber.
  // ============================================================
  const ruPalCache = new Map();
  function ruPal(C, hz) {
    const key = C.skyTop + C.pipe + '|' + (hz || 0);
    let Q = ruPalCache.get(key);
    if (Q) return Q;
    const haze = mix(C.haze, C.skyBottom, 0.3), stone = mix('#a49b85', C.far, 0.15);
    Q = {
      stone,
      stoneLit: mix(stone, mix(C.skyBottom, C.accent, 0.25), 0.42),
      stoneShade: mix(stone, C.skyTop, 0.5),
      stoneDark: mix(INK, C.near, 0.5),
      moss: mix('#5f6d36', C.near, 0.2),
      leaf: mix('#3a5532', C.near, 0.25),
      leaf2: mix('#5f7a3c', C.far, 0.2),
      vine: mix('#435a36', C.near, 0.2),
      earth: mix('#5c4c3a', C.near, 0.3),
      gold: mix(C.accent, CREAM, 0.15),
      dark: mix(INK, C.near, 0.35),
      dusk: mix(C.skyTop, INK, 0.2),
      mist: mix(C.skyBottom, CREAM, 0.35),
      haze
    };
    if (hz) for (const k of Object.keys(Q)) if (k !== 'haze' && k !== 'mist') Q[k] = mix(Q[k], haze, k === 'gold' ? hz * 0.5 : hz);
    ruPalCache.set(key, Q);
    return Q;
  }

  // Quader mit Lichtkante oben links und Moos obenauf: [x, y, w, h, moos 0..1]
  function ruBlocks(list, st, Q) {
    if (!list.length) return;
    rects(list.map(([x, y, w, h]) => [x + 1, y + 1.5, w, h]), rgba(INK, 0.22));
    const tones = [shade(st, 0.05), st, shade(st, -0.07)], groups = [[], [], []];
    for (const b of list) groups[Math.floor(hash(b[0] * 0.37 + b[1] * 1.3) * 2.999)].push(b);
    groups.forEach((g, j) => rects(g, tones[j]));
    rects(list.map(([x, y, w]) => [x, y, w, 1.3]), rgba(mix(Q.stoneLit, CREAM, 0.3), 0.45));
    rects(list.map(([x, y, , h]) => [x, y, 1.2, h]), rgba(Q.stoneLit, 0.4));
    rects(list.map(([x, y, w, h]) => [x + w - 1.4, y, 1.4, h]), rgba(INK, 0.2));
    rects(list.map(([x, y, w, h]) => [x, y + h - 1.2, w, 1.2]), rgba(INK, 0.22));
    const ms = [];
    for (const [x, y, w, , m] of list) if (m > 0) for (let k = 0; k < w / 5 * m; k++) ms.push([x + hash(x + k * 3.1) * w, y + 0.5, 1.8 + hash(y + k) * 2.4, 1.2 + hash(k * 7.7 + x) * 1.2, 0]);
    ellipses(ms, Q.moss);
  }
  // Kannelierte Säule: abgebrochen (gezackte Oberkante) oder mit Kapitell; Licht links, Dämmerblau rechts
  function ruColumn(x, base, top, wd, Q, r, cap, broken) {
    const hw = wd / 2, st = Q.stone;
    ctx.beginPath();
    ctx.moveTo(x - hw, base);
    if (broken) {
      ctx.lineTo(x - hw, top + r() * 6);
      for (let k = 1; k < 5; k++) ctx.lineTo(x - hw + wd * k / 5, top + (r() - 0.35) * 12);
      ctx.lineTo(x + hw, top + r() * 9);
    } else { ctx.lineTo(x - hw, top); ctx.lineTo(x + hw, top); }
    ctx.lineTo(x + hw, base);
    ctx.closePath();
    ctx.fillStyle = hgrad(x - hw, x + hw, [[0, Q.stoneLit], [0.3, st], [0.68, Q.stoneShade], [1, shade(Q.stoneShade, -0.18)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const nf = Math.max(3, Math.round(wd / 4.5)), fl = [], jt = [];
    for (let k = 1; k < nf; k++) fl.push([x - hw + k * wd / nf - 0.5, top - 10, 1, base - top + 10]);
    rects(fl, rgba(INK, 0.17));
    for (let y = base - 16 - r() * 10; y > top + 6; y -= 20 + r() * 16) jt.push([x - hw, y, wd, 1.1]);
    rects(jt, rgba(INK, 0.3));
    rects(jt.map(([a, b, c]) => [a, b + 1.1, c, 0.8]), rgba(Q.stoneLit, 0.35));
    ctx.restore();
    if (cap && !broken) {
      poly([[x - hw, top + 3], [x - hw * 1.35, top - 3], [x + hw * 1.35, top - 3], [x + hw, top + 3]], shade(st, -0.05));
      ctx.fillStyle = hgrad(x - hw * 1.5, x + hw * 1.5, [[0, Q.stoneLit], [0.4, st], [1, Q.stoneShade]]);
      ctx.fillRect(x - hw * 1.5, top - 8, wd * 1.5, 5);
    }
    ctx.fillStyle = hgrad(x - hw * 1.4, x + hw * 1.4, [[0, Q.stoneLit], [0.4, st], [1, Q.stoneShade]]);
    ctx.fillRect(x - hw * 1.35, base - 5, wd * 1.35, 5);
  }
  // Liane mit kleinen Blättern
  function ruVine(x, y0, len, sway, col, r, lw) {
    const ex = x + sway, ey = y0 + len, cx = x + sway * 0.2 + (r() - 0.5) * 10, cy = y0 + len * 0.6;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    const lv = [];
    for (let t = 0.12; t < 1; t += 0.09 + r() * 0.08) {
      const u = 1 - t, px = u * u * x + 2 * u * t * cx + t * t * ex, py = u * u * y0 + 2 * u * t * cy + t * t * ey, d = r() < 0.5 ? -1 : 1;
      lv.push([px + d * 2.4, py + 1.5, 3 + r() * 1.5, 1.6 + r() * 0.6, d * 0.9 + 0.3]);
    }
    ellipses(lv, col);
    ellipses(lv.filter((_, k) => k % 2 === 0).map(([a, b, c, d, e]) => [a - 0.5, b - 0.5, c * 0.55, d * 0.45, e]), rgba(mix(col, CREAM, 0.35), 0.5));
  }
  // Dschungelbusch: Ballen und spitze Blätter am Rand
  function ruBush(x, base, s, col, r) {
    crown(x, base - 11 * s, 20 * s, 12 * s, col, shade(col, 0.25), r, 9, 10);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) { const a = Math.PI * (1.05 + k / 6 * 0.9), d = 18 * s; leafPath(x + Math.cos(a) * d, base - 9 * s + Math.sin(a) * d * 0.7, 12 * s, 5 * s, a, LEAF_B); }
    ctx.fillStyle = shade(col, -0.12);
    ctx.fill();
  }
  // Dschungelbaum: schlanker Stamm, Schirmkrone
  function ruTree(x, base, h, Q, r) {
    const tw = Math.max(3, h * 0.045), lean = (r() - 0.5) * h * 0.1;
    trunkShape(x, base, base - h * 0.78, tw, tw * 0.6, lean, mix(Q.earth, Q.stone, 0.3));
    const cx = x + lean, cy = base - h * 0.8;
    crown(cx - h * 0.12, cy + h * 0.04, h * 0.18, h * 0.08, Q.leaf, Q.leaf2, r, 8, 12);
    crown(cx + h * 0.14, cy + h * 0.02, h * 0.2, h * 0.09, Q.leaf, Q.leaf2, r, 8, 12);
    crown(cx, cy - h * 0.05, h * 0.22, h * 0.1, shade(Q.leaf, 0.05), Q.leaf2, r, 9, 14);
  }
  // Rankfeigen-Wurzeln, die über Mauerwerk fließen
  function ruRoots(x, y0, y1, n, col, r) {
    ctx.strokeStyle = col;
    for (let k = 0; k < n; k++) {
      const x0 = x + (k - (n - 1) / 2) * 5, sw = (r() - 0.5) * 18;
      ctx.lineWidth = 2.6 - k * 0.3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + sw, lerp(y0, y1, 0.3), x0 - sw, lerp(y0, y1, 0.7), x0 + sw * 0.5, y1);
      ctx.stroke();
    }
  }

  // ---------- Himmel ----------
  ART2.sky.ruDusk = (C, S, rng) => {
    const sx = S.sunX * W, sy = S.sunY, Q = ruPal(C, 0);
    const amber = mix(C.skyBottom, C.accent, 0.3), violet = mix(C.skyTop, '#8a6a86', 0.4), band = mix(C.skyTop, INK, 0.18);
    // violetter Schimmer im mittleren Himmel
    ctx.fillStyle = vgrad(90, 330, [[0, rgba(violet, 0)], [0.5, rgba(violet, 0.3)], [1, rgba(violet, 0)]]);
    ctx.fillRect(0, 90, W, 240);
    // erste Sterne
    const st = [];
    for (let k = 0, n = Math.round(W / 34); k < n; k++) st.push([rng() * W, rng() * 130, 0.5 + rng() * 0.6]);
    dots(st, rgba(CREAM, 0.4));
    // Glut um die tiefe Sonne
    ctx.fillStyle = rgrad(sx, sy, 0, 520, [[0, rgba(amber, 0.6)], [0.3, rgba(amber, 0.24)], [1, rgba(amber, 0)]]);
    ctx.fillRect(sx - 520, sy - 520, 1040, 1040);
    rays(sx, sy, 9, -2.75, -0.45, Math.max(W, 900) * 0.9, 30, mix(C.accent, CREAM, 0.4), 0.06, rng);
    // lange dunkle Wolkenbänder mit goldenen Unterkanten
    for (let k = 0, n = Math.round(W / 70) + 6; k < n; k++) {
      const x = rng() * (W + 260) - 130, y = 60 + Math.pow(rng(), 0.9) * 270, rx = 110 + rng() * 200, ry = 4 + rng() * 7;
      const nearSun = clamp(1 - Math.hypot((x - sx) / 600, (y - sy) / 260), 0, 1);
      soft(x, y, rx, ry * 1.8, band, 0.3 + rng() * 0.2);
      soft(x + rx * 0.05, y + ry * 1.2, rx * 0.8, ry * 0.6, mix(Q.gold, amber, 0.4), (0.15 + 0.5 * nearSun) * (0.6 + rng() * 0.4));
    }
    // Sonnenscheibe, von zwei Wolkenbändern geschnitten
    ctx.fillStyle = rgrad(sx, sy, 20, 110, [[0, rgba(mix(C.accent, CREAM, 0.5), 0.55)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(sx - 110, sy - 110, 220, 220);
    circle(sx, sy, 33, rgrad(sx, sy, 0, 33, [[0, mix(CREAM, '#fff4d8', 0.5)], [0.6, mix(C.accent, CREAM, 0.45)], [1, mix(C.accent, C.skyBottom, 0.3)]], sx - 8, sy - 8));
    soft(sx - 10, sy - 6, 170, 5, band, 0.6);
    soft(sx + 30, sy + 14, 140, 4, band, 0.5);
    // Staub in der Luft, im Licht golden
    const dust = [], dust2 = [];
    for (let k = 0, n = Math.round(W / 4); k < n; k++) {
      const x = rng() * W, y = 180 + rng() * (GROUND_Y - 200), near = clamp(1 - Math.hypot(x - sx, y - sy) / 520, 0, 1);
      (rng() < near ? dust2 : dust).push([x, y, 0.5 + rng() * 0.8]);
    }
    dots(dust, rgba(mix(C.skyBottom, CREAM, 0.4), 0.3));
    dots(dust2, rgba(mix(C.accent, CREAM, 0.4), 0.55));
    // Dunst über dem Horizont
    ctx.fillStyle = vgrad(300, GROUND_Y, [[0, rgba(amber, 0)], [1, rgba(mix(amber, CREAM, 0.2), 0.5)]]);
    ctx.fillRect(0, 300, W, GROUND_Y - 300);
  };

  // ---------- Ebene 0: ferner Dschungel mit Urwaldriesen ----------
  ART2.layerExtent.ruJungle = () => [300, GROUND_Y + 14];
  ART2.layerTex.ruJungle = () => ({ grain: 0.035, mottle: 0.08, contrast: 1.05 });
  ART2.layer.ruJungle = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, Q = ruPal(C, 0.55), rim = mix(Q.gold, Q.haze, 0.25);
    const f = ridgeFn(P, 426, 52, 0.005, l.seed);
    // Urwaldriesen mit flachen, buckligen Kronen ragen heraus (Stämme verschwinden im Kronendach)
    for (let k = 0; k < 5; k++) {
      const x = (k + 0.2 + rng() * 0.6) * P / 5, hh = 46 + rng() * 40, y = f(x) + 12, seed = (rng() * 1e6) | 0;
      wrapEach(x, P, 50, xx => {
        const r = mulberry32(seed), cx = xx + (r() - 0.5) * 10, cy = y - hh;
        ctx.fillStyle = shade(Q.leaf, -0.12);
        poly([[xx - 3, y], [cx - 1.4, cy + 4], [cx + 1.4, cy + 4], [xx + 3, y]], shade(Q.leaf, -0.12));
        segs([[cx, cy + 10, cx - 14, cy + 2], [cx, cy + 12, cx + 16, cy + 3]], shade(Q.leaf, -0.12), 1.6);
        crown(cx - 12, cy + 2, 18, 6, mix(Q.leaf, Q.haze, 0.08), Q.leaf2, r, 7, 0);
        crown(cx + 13, cy + 3, 17, 6, mix(Q.leaf, Q.haze, 0.08), Q.leaf2, r, 7, 0);
        crown(cx, cy - 3, 22, 7, mix(Q.leaf, Q.haze, 0.04), Q.leaf2, r, 8, 0);
        ctx.strokeStyle = rgba(rim, 0.5);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx - 2, cy - 2, 22, 7, 0, Math.PI * 1.08, Math.PI * 1.55);
        ctx.stroke();
      });
    }
    // Kronendach in zwei Reihen: hinten heller und höher, vorn dunkler
    const back = [], balls = [];
    for (let x = -10; x < P + 10; x += 12 + rng() * 16) { const rr = 12 + rng() * 15; back.push([x, f(x) + rr * 0.4 - rng() * 10, rr]); }
    for (let x = -10; x < P + 10; x += 9 + rng() * 14) { const rr = 8 + rng() * 14; balls.push([x, f(x) + 10 + rr * 0.5 + rng() * 8, rr]); }
    blobPath(wrapList(back, P, 30));
    ctx.fillStyle = mix(Q.leaf, Q.haze, 0.22);
    ctx.fill();
    blobPath(wrapList(balls, P, 30).map(([x, y, rr]) => [x + rr * 0.15, y + rr * 0.2, rr]));
    ctx.fillStyle = shade(Q.leaf, -0.18);
    ctx.fill();
    blobPath(wrapList(balls, P, 30));
    ctx.fillStyle = Q.leaf;
    ctx.fill();
    ridgePath(x => f(x) + 16, -8, P + 8, 6, yb);
    ctx.fillStyle = vgrad(400, yb, [[0, Q.leaf], [1, shade(Q.leaf, -0.1)]]);
    ctx.fill();
    // goldene Lichtkanten links oben an den Ballen, Struktur im Dach
    ctx.strokeStyle = rgba(rim, 0.45);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const [x, y, rr] of wrapList(back.concat(balls), P, 30)) { if (hash(x * 1.7) < 0.35) continue; ctx.moveTo(x + Math.cos(Math.PI * 1.1) * rr * 0.92, y + Math.sin(Math.PI * 1.1) * rr * 0.92); ctx.arc(x, y, rr * 0.92, Math.PI * 1.1, Math.PI * 1.5); }
    ctx.stroke();
    const sp = [];
    for (let k = 0; k < P / 3; k++) { const x = rng() * P, y = f(x) + 8 + rng() * 80; sp.push([x, y, 2 + rng() * 4]); }
    dots(sp.slice(0, sp.length >> 1), rgba(shade(Q.leaf, 0.12), 0.5));
    dots(sp.slice(sp.length >> 1), rgba(shade(Q.leaf, -0.2), 0.45));
    // Dunst und Nebel in den Senken
    for (let x = 30; x < P; x += 50 + rng() * 30) {
      const y = f(x);
      if (y < 410) continue;
      const rx = 70 + rng() * 60;
      wrapEach(x, P, rx, xx => soft(xx, y + 14, rx, 12 + rng() * 6, Q.mist, 0.45 + (y - 410) / 140));
    }
    mist(P, 480, 26, Q.mist, 0.4, rng, 24, 80, 190, 0.12);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(360, yb, [[0, rgba(Q.haze, 0.05)], [0.6, rgba(Q.mist, 0.3)], [1, rgba(Q.mist, 0.55)]]);
    ctx.fillRect(-8, 340, P + 16, yb - 340);
    ctx.restore();
  };

  // ---------- Ebene 1: Trümmerfeld mit Mauerresten, Stümpfen und Unterholz ----------
  ART2.layerExtent.ruRubble = () => [340, GROUND_Y + 14];
  ART2.layerTex.ruRubble = () => ({ grain: 0.045, mottle: 0.12, contrast: 1.1 });
  ART2.layer.ruRubble = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, Q = ruPal(C, 0.3);
    const g = ridgeFn(P, 503, 9, 0.003, l.seed), st = mix(Q.stone, Q.stoneShade, 0.35);
    const n = 9;
    for (let k = 0; k < n; k++) {
      const x = (k + 0.5) * P / n + (rng() - 0.5) * 60, kind = rng(), seed = (rng() * 1e6) | 0;
      wrapEach(x, P, 90, xx => {
        const r = mulberry32(seed), y = g(xx) + 4;
        if (kind < 0.3) {
          // niedrige Mauer, nach rechts abbrechend
          const list = [], cw = 70 + r() * 60;
          for (let row = 0; row < 4; row++) {
            const len = cw * (1 - row * 0.22) - r() * 10;
            for (let bx = 0; bx < len; bx += 14 + r() * 8) list.push([xx - cw / 2 + bx + (row % 2) * 6, y - (row + 1) * 10, 13 + r() * 6, 10, row === 3 || r() < 0.2 ? 0.8 : 0]);
          }
          ruBlocks(list, st, Q);
        } else if (kind < 0.55) {
          // Säulenstumpf, dunkler und kürzer als die Spielsäulen
          ruColumn(xx, y, y - 30 - r() * 34, 16 + r() * 6, { stone: shade(st, -0.12), stoneLit: mix(Q.stoneLit, st, 0.4), stoneShade: shade(Q.stoneShade, -0.1) }, r, false, true);
          ruBush(xx + 18, y + 2, 0.7, Q.leaf, r);
        } else if (kind < 0.75) {
          // umgestürzte Säulentrommeln
          for (let j = 0; j < 3; j++) {
            const dx = xx - 30 + j * 22 + r() * 4, rr = 8 + r() * 2;
            roundRectPath(dx - 10, y - rr * 2, 20, rr * 2, 3);
            ctx.fillStyle = vgrad(y - rr * 2, y, [[0, Q.stoneLit], [0.5, st], [1, Q.stoneShade]]);
            ctx.fill();
            ellipse(dx - 10, y - rr, 3, rr, 0, shade(st, 0.05));
          }
        } else {
          ruBush(xx, y + 2, 1 + r() * 0.5, Q.leaf, r);
          ruBush(xx + 26, y + 3, 0.8, shade(Q.leaf, 0.06), r);
        }
      });
    }
    // Boden mit Gras
    ridgePath(g, -8, P + 8, 6, yb);
    ctx.fillStyle = vgrad(490, yb, [[0, mix(Q.earth, Q.moss, 0.5)], [1, shade(Q.earth, -0.15)]]);
    ctx.fill();
    ridgeLine(g, -8, P + 8, 6, 1, rgba(mix(Q.gold, CREAM, 0.3), 0.25), 1.2);
    const gs = [];
    for (let k = 0; k < P / 2.4; k++) { const x = rng() * P, y = g(x) + 2 + Math.pow(rng(), 1.5) * 50; gs.push([x, y, x + (rng() - 0.3) * 1.5, y - 2 - rng() * 4]); }
    segs(gs.slice(0, gs.length >> 1), rgba(shade(Q.moss, 0.2), 0.5), 0.9);
    segs(gs.slice(gs.length >> 1), rgba(shade(Q.moss, -0.25), 0.45), 0.9);
    const pb = [];
    for (let k = 0; k < P / 20; k++) pb.push([rng() * P, 0, 1.5 + rng() * 2.5, 1 + rng() * 1.5]);
    for (const p of pb) p[1] = g(p[0]) + 4 + rng() * 30;
    pebbles(wrapList(pb, P, 6), Q.stone);
    mist(P, 500, 14, Q.mist, 0.3, rng, 22, 60, 150, 0.14);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(340, yb, [[0, rgba(Q.dusk, 0.05)], [0.8, rgba(Q.haze, 0.18)], [1, rgba(Q.mist, 0.35)]]);
    ctx.fillRect(-8, 340, P + 16, yb - 340);
    ctx.restore();
  };

  // ---------- Ebene 2: Requisiten im Vordergrund ----------
  ART2.prop.ruprops = { h: 80, paint: (x, base, s, r, v, C) => ruProp(x, base, s, r, v, C) };
  function ruProp(x, base, s, r, v, C) {
    const Q = ruPal(C, 0.06);
    if (v < 0.18) {
      // liegende Säulentrommel mit kannelierter Stirn
      const rr = (11 + r() * 4) * s, lw = (26 + r() * 10) * s, y = base - rr;
      ellipse(x + 14, base - 0.5, lw, 3.4 * s, 0, rgba(INK, 0.25));
      ctx.fillStyle = vgrad(y - rr, y + rr, [[0, Q.stoneLit], [0.45, Q.stone], [1, Q.stoneShade]]);
      ctx.fillRect(x, y - rr, lw, rr * 2);
      const fl = [];
      for (let k = 1; k < 6; k++) fl.push([x, y - rr + k * rr * 2 / 6 - 0.5, lw, 1]);
      rects(fl, rgba(INK, 0.15));
      circle(x, y, rr, shade(Q.stone, 0.04));
      ctx.strokeStyle = rgba(INK, 0.22);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < 12; k++) { const a = k * TAU / 12; ctx.moveTo(x + Math.cos(a) * rr * 0.8, y + Math.sin(a) * rr * 0.8); ctx.arc(x + Math.cos(a) * rr * 0.92, y + Math.sin(a) * rr * 0.92, rr * 0.1, 0, TAU); }
      ctx.stroke();
      ellipse(x - rr * 0.3, y - rr * 0.35, rr * 0.4, rr * 0.25, -0.5, rgba(CREAM, 0.2));
      ellipses([[x + lw * 0.5, y - rr + 1, 6 * s, 2, 0], [x + lw * 0.8, y - rr + 1, 4 * s, 1.6, 0]], Q.moss);
    } else if (v < 0.34) {
      // Schutthaufen
      const list = [];
      for (let k = 0; k < 7; k++) { const bw = (8 + r() * 10) * s, bh = (5 + r() * 7) * s; list.push([x + (r() - 0.5) * 34 * s, base - bh - (k > 3 ? 8 * s : 0), bw, bh, r() < 0.4 ? 1 : 0]); }
      list.sort((a, b) => a[1] - b[1]);
      ruBlocks(list, Q.stone, Q);
    } else if (v < 0.5) {
      // breite Dschungelblätter
      ellipse(x + 8, base - 1, 22 * s, 3.5 * s, 0, rgba(INK, 0.2));
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.45 + (r() - 0.5) * 0.2, len = (30 + r() * 16) * s, bx = x + Math.cos(a) * len * 0.5, by = base - 6 * s + Math.sin(a) * len * 0.5;
        line(x, base, bx, by, Q.vine, 1.2);
        const c = k % 2 ? Q.leaf : Q.leaf2;
        ctx.beginPath();
        leafPath(bx + Math.cos(a) * len * 0.3, by + Math.sin(a) * len * 0.3, len * 0.75, len * 0.42, a + (k - 2) * 0.12, LEAF_B);
        ctx.fillStyle = c;
        ctx.fill();
        line(bx, by, bx + Math.cos(a) * len * 0.6, by + Math.sin(a) * len * 0.6, rgba(mix(c, CREAM, 0.3), 0.6), 0.8);
      }
    } else if (v < 0.62) {
      // Farn
      const bl = [];
      for (let k = -4; k <= 4; k++) {
        const a = -Math.PI / 2 + k * 0.28, len = (30 - Math.abs(k) * 3) * s;
        const ex = x + Math.cos(a) * len, ey = base + Math.sin(a) * len * 0.85;
        bl.push([x, base, ex, ey]);
        for (let j = 1; j < 7; j++) {
          const t2 = j / 7, px = lerp(x, ex, t2), py = lerp(base, ey, t2), ll = (1 - t2) * 6 * s + 1;
          bl.push([px, py, px - ll, py - ll * 0.4], [px, py, px + ll, py - ll * 0.4]);
        }
      }
      segs(bl, Q.leaf2, 1.1);
    } else if (v < 0.74) {
      // liegendes Kapitell
      const cw = 34 * s, ch = 18 * s;
      ellipse(x + 12, base - 0.5, cw * 0.8, 3 * s, 0, rgba(INK, 0.25));
      poly([[x - cw * 0.35, base], [x - cw * 0.5, base - ch * 0.55], [x + cw * 0.5, base - ch * 0.55], [x + cw * 0.35, base]], Q.stone);
      poly([[x + cw * 0.12, base], [x + cw * 0.5, base - ch * 0.55], [x + cw * 0.35, base]], rgba(Q.stoneShade, 0.8));
      ctx.fillStyle = hgrad(x - cw * 0.55, x + cw * 0.55, [[0, Q.stoneLit], [0.5, Q.stone], [1, Q.stoneShade]]);
      ctx.fillRect(x - cw * 0.55, base - ch, cw * 1.1, ch * 0.45);
      poly([[x + cw * 0.3, base - ch], [x + cw * 0.55, base - ch], [x + cw * 0.55, base - ch * 0.7]], rgba(INK, 0.3));
      ellipses([[x - cw * 0.2, base - ch, 7 * s, 2, 0]], Q.moss);
    } else if (v < 0.84) {
      // gesichtsloser Kopf einer Statue, halb versunken
      const rr = 13 * s;
      ellipse(x + 10, base - 0.5, rr * 1.6, 3 * s, 0, rgba(INK, 0.25));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - rr * 2, base - rr * 3, rr * 4, rr * 3);
      ctx.clip();
      ellipse(x, base - rr * 0.6, rr * 0.95, rr * 1.2, 0.3, rgrad(x - rr * 0.4, base - rr * 1.2, 1, rr * 1.4, [[0, Q.stoneLit], [0.55, Q.stone], [1, Q.stoneShade]]));
      ctx.restore();
      ctx.fillStyle = rgba(Q.stoneShade, 0.7);
      ctx.fillRect(x - rr * 1.1, base - rr * 1.6, rr * 2.2, 3 * s);
      line(x - rr * 0.2, base - rr * 1.5, x + rr * 0.3, base - rr * 0.6, rgba(INK, 0.3), 0.9);
      ellipses([[x - rr * 0.2, base - rr * 1.75, 6 * s, 2.2, 0.2]], Q.moss);
    } else if (v < 0.92) {
      // zerbrochenes Steingefäß
      const rr = 10 * s;
      ellipse(x + 10, base - 0.5, rr * 1.8, 3, 0, rgba(INK, 0.25));
      ctx.beginPath();
      ctx.moveTo(x - rr * 0.5, base);
      ctx.quadraticCurveTo(x - rr * 1.4, base - rr, x - rr * 0.6, base - rr * 1.9);
      ctx.lineTo(x - rr * 0.1, base - rr * 1.6);
      ctx.lineTo(x + rr * 0.3, base - rr * 2);
      ctx.lineTo(x + rr * 0.6, base - rr * 1.7);
      ctx.quadraticCurveTo(x + rr * 1.4, base - rr, x + rr * 0.5, base);
      ctx.closePath();
      ctx.fillStyle = hgrad(x - rr, x + rr, [[0, Q.stoneLit], [0.5, Q.stone], [1, Q.stoneShade]]);
      ctx.fill();
      ctx.fillStyle = rgba(mix(Q.gold, Q.stone, 0.5), 0.6);
      ctx.fillRect(x - rr * 1.05, base - rr * 1.1, rr * 2.1, 1.8);
      poly([[x + rr * 1.2, base], [x + rr * 1.6, base - rr * 0.5], [x + rr * 2, base]], Q.stone);
    } else {
      // Block mit Ranke
      ruBlocks([[x - 12 * s, base - 16 * s, 24 * s, 16 * s, 1]], Q.stone, Q);
      ruVine(x - 10 * s, base - 16 * s, 18 * s, 6, Q.vine, r, 1.1);
      ruVine(x + 4 * s, base - 16 * s, 14 * s, -4, Q.vine, r, 1.1);
    }
  }

  // ---------- Boden: Steinplatten mit Moos auf Quadermauerwerk ----------
  ART2.ground.ruslabs = (P, y, C, rng, band) => {
    const Q = ruPal(C, 0), st = mix(Q.stone, C.near, 0.4), top = mix(Q.stone, Q.stoneLit, 0.35);
    band(vgrad(y, H, [[0, shade(st, -0.05)], [1, shade(st, -0.45)]]), y + 10, H - y);
    // Quaderlagen
    const blocks = [];
    for (let row = 0, yy = y + 12; yy < H; row++, yy += 13) {
      for (let x = -((row * 17) % 40); x < P + 40; x += 26 + rng() * 22) blocks.push([x, yy, 26 + rng() * 22, 13]);
    }
    const jt = [], jv = [], cr = [];
    for (const [x, yy, w2] of blocks) { jv.push([x, yy, 1.2, 13]); if (rng() < 0.12) cr.push([x + rng() * w2, yy + 1, x + rng() * w2, yy + 12]); }
    for (let yy = y + 12; yy < H; yy += 13) jt.push([-8, yy, P + 16, 1.4]);
    const tones = [];
    for (const [x, yy, w2] of blocks) if (rng() < 0.35) tones.push([x, yy, w2, 13]);
    rects(tones, rgba(rng() < 0.5 ? CREAM : INK, 0.05));
    rects(jv, rgba(INK, 0.3));
    rects(jt, rgba(INK, 0.32));
    rects(jt.map(([a, b, c]) => [a, b + 1.4, c, 0.8]), rgba(Q.stoneLit, 0.18));
    segs(cr, rgba(INK, 0.3), 0.8);
    const jm = [];
    for (const [x, yy] of blocks) if (rng() < 0.3) jm.push([x + 0.6, yy + 3 + rng() * 8, 1.6, 2.4 + rng() * 2, 0]);
    ellipses(jm, rgba(Q.moss, 0.7));
    // Plattenlage obenauf: helle Oberseite, Fugen schräg, Kante mit Schatten
    band(vgrad(y - 1, y + 11, [[0, mix(top, CREAM, 0.15)], [1, shade(top, -0.12)]]), y - 1, 12);
    band(rgba(INK, 0.32), y + 10, 2.4);
    const fj = [], fm = [], chips = [];
    for (let x = rng() * 30; x < P; x += 34 + rng() * 30) {
      fj.push([x, y - 1, x - 3, y + 11]);
      fm.push([x - 1.5, y + 4 + rng() * 4, 2.2, 3.2, 0.3]);
      if (rng() < 0.4) chips.push([[x + 4, y + 11], [x + 10, y + 7], [x + 16, y + 11]]);
    }
    segs(fj, rgba(INK, 0.35), 1.1);
    segs(fj.map(([a, b, c, d]) => [a + 1.1, b, c + 1.1, d]), rgba(CREAM, 0.12), 0.7);
    for (const c of chips) poly(c, rgba(INK, 0.25));
    ellipses(wrapList(fm, P, 6), Q.moss);
    const sp = [];
    for (let k = 0; k < P / 5; k++) sp.push([rng() * P, y + rng() * 10, 0.5 + rng() * 0.6]);
    dots(sp, rgba(INK, 0.15));
    // Moospolster, Grasbüschel und kleine Farne über der Kante
    const ms = [];
    for (let k = 0; k < P / 40; k++) { const x = rng() * P; for (let j = 0; j < 5; j++) ms.push([x + (rng() - 0.5) * 14, y + (rng() - 0.3) * 3, 1.6 + rng() * 2.2]); }
    dots(wrapList(ms, P, 8).map(([a, b, c]) => [a + 0.5, b + 1, c]), rgba(INK, 0.25));
    dots(wrapList(ms, P, 8), Q.moss);
    dots(wrapList(ms.filter((_, k) => k % 3 === 0), P, 8).map(([a, b, c]) => [a - c * 0.3, b - c * 0.4, c * 0.4]), rgba(mix(Q.moss, Q.gold, 0.4), 0.6));
    const gr = [];
    for (let k = 0; k < P / 30; k++) { const x = 6 + rng() * (P - 12); for (let j = -3; j <= 3; j++) gr.push([x + j * 1.4, y + 1, x + j * 2.6 + (rng() - 0.5) * 2, y - 4 - rng() * 7 + Math.abs(j)]); }
    segs(gr, Q.leaf2, 1);
  };

  // ---------- Säule: verwitterte, kannelierte Tempelsäule ----------
  const ruStone = C => mix(C.pipe, CREAM, 0.12);
  ART2.pipeBody.ruincol = (C, h, v, r) => {
    const Q = ruPal(C, 0), stone = ruStone(C), side = mix(shade(stone, -SD - 0.05), C.skyTop, 0.2), lit = mix(stone, mix(C.accent, CREAM, 0.45), 0.4);
    columnBase(h, stone, side, lit);
    // Kanneluren: Rinne mit Schattenkante links, Lichtflanke rechts
    for (let k = 0; k < 8; k++) {
      const gx = 4 + k * 7.4, t = gx / PW, sh = 0.12 + t * 0.2;
      ctx.fillStyle = hgrad(gx - 2.6, gx + 2.6, [[0, rgba(INK, sh)], [0.5, rgba(INK, sh * 0.3)], [0.8, rgba(CREAM, 0.2 * (1 - t))], [1, rgba(CREAM, 0)]]);
      ctx.fillRect(gx - 2.6, 0, 5.2, h);
    }
    // Trommelfugen mit abgeschlagenen Kanten und Wasserspuren darunter
    for (let y0 = 30 + v * 37 + r() * 10; y0 < h - 6; y0 += 60 + r() * 26) {
      ctx.fillStyle = rgba(INK, 0.38);
      ctx.fillRect(0, y0, PW, 1.4);
      ctx.fillStyle = rgba(CREAM, 0.22);
      ctx.fillRect(0, y0 + 1.4, PW, 0.9);
      if (r() < 0.6) poly([[0, y0 - 3 - r() * 4], [3 + r() * 4, y0], [0, y0 + 3 + r() * 3]], rgba(INK, 0.4));
      if (r() < 0.6) poly([[PW, y0 - 2 - r() * 4], [PW - 3 - r() * 4, y0 + 1], [PW, y0 + 3]], rgba(INK, 0.45));
      for (let k = 0; k < 3; k++) {
        const sx = 6 + r() * 46, sw = 2 + r() * 4, sl = 14 + r() * 30;
        ctx.fillStyle = vgrad(y0 + 2, y0 + 2 + sl, [[0, rgba(mix(INK, C.near, 0.5), 0.18)], [1, rgba(INK, 0)]]);
        ctx.fillRect(sx, y0 + 2, sw, sl);
      }
      if (r() < 0.55) {
        const ms = [];
        for (let k = 0; k < 7; k++) ms.push([4 + r() * 50, y0 - 1 + r() * 3, 1.2 + r() * 1.8]);
        dots(ms, Q.moss);
      }
    }
    // Risse
    for (let k = 0; k < h / 120; k++) {
      let cx = 8 + r() * 44, cy = r() * h;
      const pts = [[cx, cy]];
      for (let j = 0; j < 5; j++) { cx += (r() - 0.5) * 6; cy += 5 + r() * 9; pts.push([cx, cy]); }
      ctx.beginPath();
      pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.strokeStyle = rgba(INK, 0.4);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    // Flechten: goldene und graugrüne Tupfer
    const lich = [], lich2 = [];
    for (let k = 0; k < h / 30; k++) { const lx = 4 + r() * 50, ly = r() * h; for (let j = 0; j < 5; j++) (k % 2 ? lich : lich2).push([lx + (r() - 0.5) * 6, ly + (r() - 0.5) * 6, 0.6 + r() * 1.1]); }
    dots(lich, rgba(mix(C.accent, stone, 0.35), 0.55));
    dots(lich2, rgba(mix(Q.moss, CREAM, 0.25), 0.5));
    // Liane windet sich um die Säule
    const lv = [];
    ctx.strokeStyle = Q.vine;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let drawing = false;
    for (let y = 0; y <= h; y += 4) {
      const ph = y * 0.03 + v * 2.4 + 1, vx = PW / 2 + Math.sin(ph) * (PW / 2 + 1), front = Math.cos(ph) > -0.15;
      if (front) { if (!drawing) ctx.moveTo(vx, y); else ctx.lineTo(vx, y); drawing = true; if (y % 20 === 0) lv.push([vx + (Math.sin(y) > 0 ? 3 : -3), y + 1, 4, 1.8, Math.sin(y) > 0 ? 0.6 : -0.6]); }
      else drawing = false;
    }
    ctx.stroke();
    ellipses(lv, Q.leaf2);
    ellipses(lv.map(([a, b, c, d, e]) => [a - 0.6, b - 0.5, c * 0.5, d * 0.4, e]), rgba(CREAM, 0.25));
  };
  ART2.pipeCap.ruincol = (C, up) => {
    const Q = ruPal(C, 0), stone = ruStone(C), lit = mix(stone, mix(C.accent, CREAM, 0.45), 0.45), side = mix(shade(stone, -SD - 0.05), C.skyTop, 0.2);
    const slab = (x0, x1, y0, y1, convex) => {
      ctx.fillStyle = hgrad(x0, x1, [[0, lit], [0.16, stone], [0.62, stone], [0.8, side], [1, shade(side, -0.15)]]);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (convex) { ctx.fillStyle = vgrad(y0, y1, [[0, rgba(CREAM, 0.3)], [0.45, rgba(CREAM, 0)], [1, rgba(INK, 0.25)]]); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      ctx.strokeStyle = rgba(INK, 0.28);
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    };
    if (up) {
      // Kapitell: Halsringe, Wulst (Echinus), Deckplatte; eine Ecke abgeschlagen, Moos obenauf
      slab(-0.5, PW + 0.5, 17, 26, false);
      segs([[0, 19.5, PW, 19.5], [0, 22.5, PW, 22.5]], rgba(INK, 0.25), 0.9);
      ctx.beginPath();
      ctx.moveTo(-0.5, 17);
      ctx.quadraticCurveTo(-PCO - 2, 13, -PCO - 2, 8);
      ctx.lineTo(PW + PCO + 2, 8);
      ctx.quadraticCurveTo(PW + PCO + 2, 13, PW + 0.5, 17);
      ctx.closePath();
      ctx.fillStyle = hgrad(-PCO - 2, PW + PCO + 2, [[0, lit], [0.18, stone], [0.62, stone], [0.82, side], [1, shade(side, -0.15)]]);
      ctx.fill();
      ctx.fillStyle = vgrad(8, 17, [[0, rgba(CREAM, 0.25)], [1, rgba(INK, 0.3)]]);
      ctx.fill();
      slab(-PCO - 3, PW + PCO + 3, 0, 8, false);
      poly([[PW + PCO + 3.5, -0.5], [PW + PCO - 6, -0.5], [PW + PCO + 3.5, 6]], rgba(INK, 0.5));
      poly([[PW + PCO - 6, -0.5], [PW + PCO + 3.5, 6], [PW + PCO + 3.5, 8.5], [PW + PCO - 7, 0.5]], rgba(side, 0.9));
      line(-PCO - 2, 0.8, PW + PCO - 6, 0.8, rgba(mix(C.accent, CREAM, 0.55), 0.75), 1.3);
      line(-PCO - 2, 6.5, PW + PCO + 2, 6.5, rgba(INK, 0.18), 0.8);
      const ms = [[-PCO + 1, 0, 3.4], [4, -1, 4], [10, 0, 3], [16, 0.5, 2.4], [PW - 18, 0.2, 2.6]];
      dots(ms.map(([a, b, c]) => [a + 0.6, b + 1, c]), rgba(INK, 0.3));
      dots(ms, Q.moss);
      dots(ms.map(([a, b, c]) => [a - c * 0.3, b - c * 0.4, c * 0.4]), rgba(mix(Q.moss, Q.gold, 0.5), 0.6));
      const gr = [];
      for (let j = -3; j <= 3; j++) gr.push([6 + j * 1.2, 0, 6 + j * 2.4, -5 - (3 - Math.abs(j)) * 1.2]);
      segs(gr, Q.leaf2, 1);
    } else {
      // Basis: Halsring, oberer Wulst, Kehle, unterer Wulst, Plinthe (zur Lücke hin)
      slab(-0.5, PW + 0.5, -2, 3, false);
      slab(-2, PW + 2, 3, 8, true);
      ctx.fillStyle = rgba(INK, 0.35);
      ctx.fillRect(-1, 8, PW + 2, 3);
      slab(-PCO, PW + PCO, 11, 17, true);
      slab(-PCO - 2, PW + PCO + 2, 17, PCH, false);
      poly([[-PCO - 2.5, PCH + 0.5], [-PCO + 6, PCH + 0.5], [-PCO - 2.5, PCH - 5]], rgba(INK, 0.5));
      line(-PCO - 1, 17.8, PW + PCO + 1, 17.8, rgba(mix(C.accent, CREAM, 0.5), 0.6), 1.1);
      ruVine(PW - 10, PCH - 1, 10, -3, Q.vine, mulberry32(77), 1.1);
    }
  };

  // ---------- Kulissen Ruinen ----------
  const RU_FAR = 450, RU_MID = 506;
  // Ferner Hügel mit Dschungelbewuchs
  function ruFarGround(w, h, top, Q, r) {
    const yAt = auFarHill(w, h, top, mix(Q.leaf, Q.haze, 0.1), r);
    const bl = [];
    for (let x = 4; x < w - 4; x += 8 + r() * 8) bl.push([x, yAt(x) + 3, 6 + r() * 6]);
    blobPath(bl);
    ctx.fillStyle = Q.leaf;
    ctx.fill();
    return yAt;
  }
  // Goldene Lichtkante links an einer senkrechten Kante
  const ruRim = (x, y0, y1, Q, a) => rects([[x, y0, 1.4, y1 - y0]], rgba(mix(Q.gold, CREAM, 0.25), a || 0.55));

  const ruFar = {
    fpyramid: {
      size: r => [280 + r() * 40, 200],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.6), cx = w * 0.5, base = h - 12, sil = mix(Q.stone, Q.stoneShade, 0.45);
        ruFarGround(w, h, h - 30, Q, r);
        let y = base, tw = w * 0.8;
        for (let k = 0; k < 5; k++) {
          const th = 24;
          y -= th;
          ctx.fillStyle = sil;
          ctx.fillRect(cx - tw / 2, y, tw, th);
          ctx.fillStyle = rgba(INK, 0.14);
          ctx.fillRect(cx + tw * 0.12, y, tw * 0.38, th);
          ctx.fillStyle = rgba(mix(Q.gold, CREAM, 0.3), 0.3);
          ctx.fillRect(cx - tw / 2, y, tw, 1.3);
          ruRim(cx - tw / 2, y, y + th, Q);
          if (r() < 0.7) crown(cx - tw / 2 + 10 + r() * tw * 0.3, y - 2, 9, 5, Q.leaf, Q.leaf2, r, 5, 0);
          if (r() < 0.6) crown(cx + tw * 0.2 + r() * tw * 0.25, y - 2, 8, 4.5, Q.leaf, Q.leaf2, r, 5, 0);
          tw *= 0.8;
        }
        ctx.fillStyle = mix(sil, Q.stoneLit, 0.3);
        ctx.fillRect(cx - 9, y, 18, base - y);
        const stp = [];
        for (let yy = y + 3; yy < base; yy += 4) stp.push([cx - 9, yy, 18, 1]);
        rects(stp, rgba(INK, 0.18));
        ctx.fillStyle = sil;
        ctx.fillRect(cx - 20, y - 26, 40, 26);
        ctx.fillRect(cx - 24, y - 31, 48, 6);
        ctx.fillStyle = rgba(INK, 0.4);
        ctx.fillRect(cx - 6, y - 20, 12, 20);
        ruRim(cx - 24, y - 31, y, Q);
        soft(cx, base - 4, w * 0.48, 12, Q.mist, 0.55);
      }
    },
    fcolonnade: {
      size: r => [280 + r() * 40, 160],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.6), sil = mix(Q.stone, Q.stoneShade, 0.4), top = h - 52;
        const yAt = ruFarGround(w, h, top, Q, r);
        const pl = h - 40;
        ctx.fillStyle = sil;
        ctx.fillRect(w * 0.08, pl - 8, w * 0.84, 10);
        const n = 9, xs = [], tops = [];
        for (let k = 0; k < n; k++) {
          const x = w * (0.12 + k * 0.76 / (n - 1)), full = r() < 0.55, ht = full ? 74 : 20 + r() * 44;
          xs.push(x);
          tops.push(full ? pl - 8 - ht : null);
          ctx.fillStyle = sil;
          ctx.fillRect(x - 3.5, pl - 8 - ht, 7, ht);
          ctx.fillStyle = rgba(INK, 0.15);
          ctx.fillRect(x + 1, pl - 8 - ht, 2.5, ht);
          ruRim(x - 3.5, pl - 8 - ht, pl - 8, Q);
        }
        for (let k = 0; k < n - 1; k++) if (tops[k] && tops[k + 1]) { ctx.fillStyle = sil; ctx.fillRect(xs[k] - 6, tops[k] - 9, xs[k + 1] - xs[k] + 12, 9); ctx.fillStyle = rgba(mix(Q.gold, CREAM, 0.3), 0.35); ctx.fillRect(xs[k] - 6, tops[k] - 9, xs[k + 1] - xs[k] + 12, 1.2); }
        crown(w * 0.9, pl - 16, 14, 10, Q.leaf, Q.leaf2, r, 6, 0);
        soft(w * 0.5, h - 10, w * 0.5, 12, Q.mist, 0.5);
        void yAt;
      }
    },
    ftower: {
      size: r => [160 + r() * 30, 230],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.58), sil = mix(Q.stone, Q.stoneShade, 0.45), cx = w * 0.5;
        ruFarGround(w, h, h - 40, Q, r);
        const base = h - 24, top = 46, b0 = 30, b1 = 22;
        ctx.beginPath();
        ctx.moveTo(cx - b0, base);
        ctx.lineTo(cx - b1, top + 6);
        ctx.lineTo(cx - b1 * 0.5, top);
        ctx.lineTo(cx - 4, top + 10);
        ctx.lineTo(cx + 6, top + 2);
        ctx.lineTo(cx + b1, top + 16);
        ctx.lineTo(cx + b0, base);
        ctx.closePath();
        ctx.fillStyle = sil;
        ctx.fill();
        ctx.fillStyle = rgba(INK, 0.15);
        ctx.fillRect(cx + 6, top + 16, b1, base - top - 16);
        const co = [];
        for (let y = top + 18; y < base; y += 10) co.push([cx - b0, y, b0 * 2, 0.9]);
        rects(co, rgba(INK, 0.16));
        ctx.fillStyle = rgba(INK, 0.45);
        for (const [dy, dx] of [[50, -6], [100, 4], [140, -8]]) if (top + dy < base - 10) { roundRectPath(cx + dx - 3.5, top + dy, 7, 13, 3.5); ctx.fill(); }
        ruRim(cx - b1 - 0.5, top + 8, base, Q);
        crown(cx - 6, top + 2, 20, 10, Q.leaf, Q.leaf2, r, 8, 0);
        crown(cx + 12, top + 10, 12, 7, Q.leaf, Q.leaf2, r, 6, 0);
        for (let k = 0; k < 3; k++) ruVine(cx - 12 + k * 10, top + 8, 30 + r() * 40, (r() - 0.5) * 6, Q.leaf, r, 1);
        soft(cx, base, w * 0.5, 12, Q.mist, 0.5);
      }
    },
    fcolossus: {
      size: r => [220 + r() * 40, 250],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.58), sil = mix(Q.stone, Q.stoneShade, 0.5), cx = w * 0.5;
        ruFarGround(w, h, h - 36, Q, r);
        const base = h - 22, sh = (pts, c) => poly(pts, c);
        sh([[cx - 70, base], [cx - 66, base - 34], [cx + 66, base - 34], [cx + 70, base]], sil);
        sh([[cx - 56, base - 34], [cx - 52, base - 70], [cx + 54, base - 70], [cx + 58, base - 34]], shade(sil, 0.04));
        sh([[cx - 40, base - 70], [cx - 46, base - 150], [cx + 46, base - 150], [cx + 40, base - 70]], sil);
        sh([[cx - 60, base - 150], [cx - 52, base - 162], [cx + 52, base - 162], [cx + 60, base - 150], [cx + 48, base - 138], [cx - 48, base - 138]], shade(sil, 0.03));
        ellipse(cx, base - 186, 20, 25, 0, sil);
        ctx.fillStyle = shade(sil, 0.06);
        ctx.fillRect(cx - 22, base - 204, 44, 8);
        sh([[cx + 6, base - 150], [cx + 46, base - 150], [cx + 40, base - 70], [cx + 8, base - 70]], rgba(INK, 0.14));
        ellipse(cx + 8, base - 184, 12, 22, 0, rgba(INK, 0.1));
        sh([[cx - 46, base - 150], [cx - 44, base - 110], [cx - 30, base - 74], [cx - 38, base - 74], [cx - 54, base - 112]], shade(sil, 0.05));
        ruRim(cx - 46, base - 150, base - 70, Q, 0.5);
        crown(cx - 46, base - 160, 18, 9, Q.leaf, Q.leaf2, r, 7, 0);
        crown(cx + 12, base - 210, 14, 8, Q.leaf, Q.leaf2, r, 6, 0);
        for (let k = 0; k < 4; k++) ruVine(cx - 40 + k * 26, base - 150, 30 + r() * 50, (r() - 0.5) * 8, Q.leaf, r, 1);
        soft(cx, base, w * 0.5, 14, Q.mist, 0.55);
      }
    }
  };

  const ruMid = {
    stairs: {
      size: r => [300 + r() * 30, 230],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4, cx = w * 0.44, n = 12, sh = 10, ptop = yb - n * sh;
        ruTree(w * 0.86, ptop + 40, 130, Q, r);
        // Plattform und Tempelrest oben
        const pf = [];
        for (let x = w * 0.08; x < w * 0.8; x += 26 + r() * 10) pf.push([x, ptop - 12, 28, 12, 0.6]);
        ruBlocks(pf, Q.stone, Q);
        ctx.fillStyle = vgrad(ptop - 110, ptop - 12, [[0, rgba(Q.stoneDark, 0.75)], [1, rgba(Q.stoneDark, 0.9)]]);
        ctx.fillRect(cx - 26, ptop - 92, 52, 80);
        ruColumn(cx - 46, ptop - 12, ptop - 112, 15, Q, r, true, false);
        ruColumn(cx + 46, ptop - 12, ptop - 70, 15, Q, r, false, true);
        ruColumn(cx - 76, ptop - 12, ptop - 46, 15, Q, r, false, true);
        ruBlocks([[cx - 62, ptop - 132, 50, 12, 0.8], [cx - 56, ptop - 120, 30, 6, 0]], Q.stone, Q);
        // Stufen: Trittflächen im Licht, Setzstufen im Schatten, nach oben schmaler
        for (let k = n - 1; k >= 0; k--) {
          const y = yb - (k + 1) * sh, sw = lerp(w * 0.56, w * 0.36, k / n);
          ctx.fillStyle = mix(Q.stone, Q.stoneShade, 0.25);
          ctx.fillRect(cx - sw / 2, y + 2.6, sw, sh - 2.6);
          ctx.fillStyle = Q.stoneLit;
          ctx.fillRect(cx - sw / 2, y, sw, 2.6);
          ctx.fillStyle = rgba(INK, 0.18);
          ctx.fillRect(cx + sw * 0.25, y + 2.6, sw * 0.25, sh - 2.6);
          if (r() < 0.5) ellipses([[cx - sw / 2 + r() * sw, y + 1.2, 4 + r() * 5, 1.4, 0]], Q.moss);
        }
        // Wangenmauern links und rechts
        for (const d of [-1, 1]) {
          const ob = cx + d * (w * 0.28 + 14), ot = cx + d * (w * 0.18 + 10), ib = cx + d * w * 0.28, it2 = cx + d * w * 0.18;
          poly([[ib, yb], [ob, yb], [ot, ptop - 4], [it2, ptop - 4]], d < 0 ? Q.stoneLit : Q.stoneShade);
          line(it2, ptop - 4, ib, yb, rgba(INK, 0.3), 1.2);
          const jl = [];
          for (let k = 1; k < 6; k++) { const t = k / 6; jl.push([lerp(ib, it2, t), lerp(yb, ptop - 4, t), lerp(ob, ot, t), lerp(yb, ptop - 4, t)]); }
          segs(jl, rgba(INK, 0.2), 0.8);
        }
        ruRoots(w * 0.82, ptop - 10, yb - 10, 4, mix(Q.earth, Q.stone, 0.35), r);
        ruBush(w * 0.12, yb + 2, 1.2, Q.leaf, r);
        ruBush(w * 0.78, yb + 2, 1, shade(Q.leaf, 0.05), r);
        for (let k = 0; k < 4; k++) ruVine(w * (0.15 + k * 0.17), ptop - 12, 24 + r() * 40, (r() - 0.5) * 8, Q.vine, r);
      }
    },
    hall: {
      size: r => [330 + r() * 30, 270],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4, floor = yb - 18;
        // Rückwand, oben abgebrochen
        const wall = [];
        for (let row = 0, y = floor - 14; y > floor - 150; row++, y -= 14) {
          const lim = w * (0.78 - row * 0.03) - r() * 30;
          for (let x = w * 0.08 + (row % 2) * 10; x < lim; x += 22 + r() * 12) wall.push([x, y, 24 + r() * 8, 14, 0]);
        }
        ruBlocks(wall, mix(Q.stone, Q.stoneShade, 0.55), Q);
        hazeOver(w, h, Q.stoneDark, 0.18);
        // Stufenunterbau
        ruBlocks([[w * 0.02, yb - 9, w * 0.96, 9, 0.3], [w * 0.05, floor, w * 0.9, 9, 0.6]], Q.stone, Q);
        const xs = [0.12, 0.31, 0.5, 0.69, 0.88].map(f => w * f), hts = [196, 196, 120 + r() * 30, 50 + r() * 30, 196];
        xs.forEach((x, k) => ruColumn(x, floor, floor - hts[k], 20, Q, r, hts[k] > 190, hts[k] < 190));
        // Gebälk über den ersten beiden Säulen mit geometrischem Fries
        const at = floor - 196 - 8;
        ruBlocks([[xs[0] - 16, at - 22, xs[1] - xs[0] + 32, 22, 0.8], [xs[4] - 14, at - 20, 34, 20, 0.6]], Q.stone, Q);
        ctx.strokeStyle = rgba(INK, 0.28);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let x = xs[0] - 12; x < xs[1] + 10; x += 8) { ctx.moveTo(x, at - 6); ctx.lineTo(x, at - 15); ctx.lineTo(x + 5, at - 15); ctx.lineTo(x + 5, at - 9); ctx.lineTo(x + 2.5, at - 9); }
        ctx.stroke();
        // herabgestürzter Balken lehnt an der Bruchsäule
        ctx.save();
        ctx.translate(xs[2] + 20, floor);
        ctx.rotate(-0.55);
        ruBlocks([[0, -18, 70, 18, 0.4]], shade(Q.stone, -0.04), Q);
        ctx.restore();
        // Trommeln am Boden
        for (const dx of [0.6, 0.76]) {
          const x = w * dx, rr = 9;
          roundRectPath(x - 12, floor - rr * 2, 24, rr * 2, 3);
          ctx.fillStyle = vgrad(floor - rr * 2, floor, [[0, Q.stoneLit], [0.5, Q.stone], [1, Q.stoneShade]]);
          ctx.fill();
          ellipse(x - 12, floor - rr, 3, rr, 0, shade(Q.stone, 0.06));
        }
        ruRoots(xs[4] + 2, at - 18, floor - 6, 4, mix(Q.earth, Q.stone, 0.3), r);
        crown(xs[4] + 4, at - 16, 24, 12, Q.leaf, Q.leaf2, r, 10, 14);
        for (let k = 0; k < 5; k++) ruVine(xs[0] - 10 + k * (xs[1] - xs[0] + 20) / 4, at, 30 + r() * 60, (r() - 0.5) * 10, Q.vine, r);
        ruBush(w * 0.4, floor + 2, 0.9, Q.leaf, r);
        ruBush(w * 0.96, yb + 2, 1.1, shade(Q.leaf, 0.05), r);
      }
    },
    statue: {
      size: r => [170 + r() * 30, 280],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4, cx = w * 0.48, pt = yb - 46;
        ruBlocks([[cx - 40, yb - 22, 80, 22, 0.3], [cx - 34, yb - 40, 68, 18, 0.5], [cx - 38, pt, 76, 6, 0.8]], Q.stone, Q);
        // Gewandfigur: Licht links, Dämmerung rechts
        const robe = () => {
          ctx.beginPath();
          ctx.moveTo(cx - 28, pt);
          ctx.quadraticCurveTo(cx - 24, pt - 70, cx - 20, pt - 118);
          ctx.quadraticCurveTo(cx - 30, pt - 140, cx - 26, pt - 158);
          ctx.quadraticCurveTo(cx, pt - 168, cx + 26, pt - 156);
          ctx.quadraticCurveTo(cx + 28, pt - 136, cx + 20, pt - 116);
          ctx.quadraticCurveTo(cx + 26, pt - 70, cx + 30, pt);
          ctx.closePath();
        };
        robe();
        ctx.fillStyle = hgrad(cx - 30, cx + 30, [[0, Q.stoneLit], [0.35, Q.stone], [0.75, Q.stoneShade], [1, shade(Q.stoneShade, -0.15)]]);
        ctx.fill();
        ctx.strokeStyle = rgba(INK, 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const x = cx - 18 + k * 7; ctx.moveTo(x, pt - 110 + k * 3); ctx.quadraticCurveTo(x + 3, pt - 60, x + (k - 2.5) * 1.8, pt - 2); }
        ctx.stroke();
        // Arme: einer hängt, einer ist abgebrochen
        poly([[cx - 26, pt - 154], [cx - 34, pt - 120], [cx - 32, pt - 86], [cx - 25, pt - 88], [cx - 25, pt - 120]], mix(Q.stoneLit, Q.stone, 0.4));
        poly([[cx + 24, pt - 152], [cx + 36, pt - 126], [cx + 30, pt - 118], [cx + 21, pt - 132]], Q.stoneShade);
        poly([[cx + 36, pt - 126], [cx + 33, pt - 119], [cx + 30, pt - 118]], rgba(INK, 0.35));
        // Kopf ohne Gesicht, mit Riss
        ctx.fillStyle = Q.stoneShade;
        ctx.fillRect(cx - 5, pt - 172, 11, 12);
        ellipse(cx + 1, pt - 186, 13, 16, 0.08, rgrad(cx - 5, pt - 194, 1, 20, [[0, Q.stoneLit], [0.55, Q.stone], [1, Q.stoneShade]]));
        ctx.fillStyle = rgba(INK, 0.12);
        ctx.fillRect(cx - 12, pt - 196, 26, 3);
        line(cx + 4, pt - 202, cx - 2, pt - 182, rgba(INK, 0.35), 0.9);
        ellipses([[cx - 2, pt - 200, 8, 3, 0.1], [cx - 18, pt - 156, 7, 2.6, -0.3], [cx + 18, pt - 154, 6, 2.4, 0.3]], Q.moss);
        ruVine(cx - 30, pt + 2, 30, -6, Q.vine, r);
        ruVine(cx + 26, pt - 150, 70, 4, Q.vine, r);
        ruBush(cx - 44, yb + 2, 0.9, Q.leaf, r);
        ruBush(cx + 46, yb + 2, 1.1, shade(Q.leaf, 0.06), r);
      }
    },
    arch: {
      size: r => [240 + r() * 30, 250],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4, cx = w * 0.5, R = w * 0.17, spring = yb - 120, pw = w * 0.15;
        ctx.fillStyle = vgrad(spring - R, yb, [[0, rgba(Q.stoneDark, 0.8)], [1, rgba(Q.stoneDark, 0.55)]]);
        ctx.beginPath();
        ctx.moveTo(cx - R, yb);
        ctx.lineTo(cx - R, spring);
        ctx.arc(cx, spring, R, Math.PI, TAU);
        ctx.lineTo(cx + R, yb);
        ctx.closePath();
        ctx.fill();
        soft(cx, yb - 10, R * 0.9, 26, mix(C.accent, CREAM, 0.3), 0.35);
        const piers = [];
        for (const x0 of [cx - R - pw, cx + R]) for (let y = yb - 16, k = 0; y > spring - 4; y -= 16, k++) piers.push([x0 + (k % 2 ? 2 : 0), y, pw - 2, 16, 0]);
        ruBlocks(piers, Q.stone, Q);
        // Keilsteine; rechts fehlen einige
        for (let k = 0; k < 11; k++) {
          if (k >= 8 && k <= 9) continue;
          const a0 = Math.PI + k * Math.PI / 11, a1 = a0 + Math.PI / 11, ro = R + 22;
          const pts = [[cx + Math.cos(a0) * R, spring + Math.sin(a0) * R], [cx + Math.cos(a0) * ro, spring + Math.sin(a0) * ro], [cx + Math.cos(a1) * ro, spring + Math.sin(a1) * ro], [cx + Math.cos(a1) * R, spring + Math.sin(a1) * R]];
          const lit = Math.cos((a0 + a1) / 2 + 2.2);
          poly(pts.map(([x, y]) => [x + 1, y + 1.4]), rgba(INK, 0.25));
          poly(pts, k === 5 ? mix(Q.stone, Q.gold, 0.15) : lit > 0 ? mix(Q.stone, Q.stoneLit, lit * 0.6) : mix(Q.stone, Q.stoneShade, -lit * 0.6));
          poly(pts, null, rgba(INK, 0.25), 0.8);
        }
        ruBlocks([[cx - R - pw - 4, spring - 40, 40, 16, 0.8], [cx - R - pw, spring - 56, 26, 16, 0.6], [cx + R + 4, spring - 24, 30, 14, 0.7]], Q.stone, Q);
        ruBlocks([[cx + R + pw + 4, yb - 12, 18, 12, 0.5], [cx + R + pw - 8, yb - 9, 14, 9, 0.6]], shade(Q.stone, -0.05), Q);
        for (let k = 0; k < 5; k++) ruVine(cx - R + k * R * 0.45, spring - R * 0.7 - 6 + Math.abs(k - 2) * 8, 30 + r() * 50, (r() - 0.5) * 8, Q.vine, r);
        crown(cx - R - pw * 0.4, spring - 60, 22, 12, Q.leaf, Q.leaf2, r, 9, 12);
        ruBush(cx - R - pw - 6, yb + 2, 1, Q.leaf, r);
      }
    },
    head: {
      size: r => [210 + r() * 30, 150],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4, cx = w * 0.48, cy = yb - 40, a = 0.42;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ellipse(4, 6, 62, 50, 0, rgba(INK, 0.25));
        ellipse(0, 0, 60, 48, 0, rgrad(-24, -22, 4, 70, [[0, Q.stoneLit], [0.5, Q.stone], [1, Q.stoneShade]]));
        // abgetragenes Gesicht: nur eine flache Wölbung, keine Züge
        ellipse(-30, 4, 16, 30, 0.1, rgba(CREAM, 0.08));
        // Stirnband mit Treppenmuster
        ctx.fillStyle = rgba(Q.stoneShade, 0.75);
        ctx.fillRect(-58, -30, 116, 12);
        ctx.strokeStyle = rgba(INK, 0.3);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let x = -54; x < 52; x += 9) { ctx.moveTo(x, -20); ctx.lineTo(x, -27); ctx.lineTo(x + 5, -27); ctx.lineTo(x + 5, -23); }
        ctx.stroke();
        circle(46, 6, 9, Q.stoneShade);
        circle(46, 6, 5, rgba(INK, 0.2));
        ctx.restore();
        segs([[cx - 6, cy - 46, cx + 4, cy - 24], [cx + 4, cy - 24, cx - 2, cy - 6]], rgba(INK, 0.4), 1);
        ellipses([[cx - 12, cy - 44, 18, 4, 0.4], [cx + 20, cy - 34, 12, 3, 0.4]], Q.moss);
        // Bäumchen wächst aus dem Riss
        line(cx - 4, cy - 40, cx - 8, cy - 70, mix(Q.earth, Q.stone, 0.3), 2);
        crown(cx - 8, cy - 78, 16, 10, Q.leaf2, Q.leaf, r, 8, 8);
        // halb versunken: Erdwall davor
        auMound(w, h, yb - 14, mix(Q.earth, Q.moss, 0.5), r, true);
        ruBush(w * 0.12, yb + 2, 1, Q.leaf, r);
        ruBush(w * 0.86, yb + 2, 0.9, shade(Q.leaf, 0.05), r);
        for (let k = 0; k < 3; k++) ruVine(cx + 10 + k * 12, cy - 30 + k * 6, 20 + r() * 20, 4, Q.vine, r);
      }
    },
    braziers: {
      size: r => [210 + r() * 30, 180],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.3), yb = h - 4, ty = yb - 24, fire = mix(C.accent, '#ffb84a', 0.25);
        ruBlocks([[w * 0.03, yb - 12, w * 0.94, 12, 0.3], [w * 0.08, ty, w * 0.84, 12, 0.6]], Q.stone, Q);
        // Stele mit eingeschnittenen Quadraten
        ruBlocks([[w * 0.5 - 16, ty - 70, 32, 70, 0.3]], Q.stone, Q);
        ctx.strokeStyle = rgba(INK, 0.3);
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) ctx.strokeRect(w * 0.5 - 11 + k * 3.5, ty - 62 + k * 3.5, 22 - k * 7, 22 - k * 7);
        ctx.strokeRect(w * 0.5 - 11, ty - 32, 22, 22);
        line(w * 0.5 - 11, ty - 21, w * 0.5 + 11, ty - 21, rgba(INK, 0.3), 1);
        for (const fx of [w * 0.2, w * 0.8]) {
          // Lichtschein auf dem Stein
          soft(fx, ty - 66, 70, 52, fire, 0.32);
          ruColumn(fx, ty, ty - 44, 13, Q, r, false, false);
          ctx.beginPath();
          ctx.moveTo(fx - 22, ty - 56);
          ctx.lineTo(fx + 22, ty - 56);
          ctx.quadraticCurveTo(fx + 18, ty - 42, fx, ty - 42);
          ctx.quadraticCurveTo(fx - 18, ty - 42, fx - 22, ty - 56);
          ctx.closePath();
          ctx.fillStyle = hgrad(fx - 22, fx + 22, [[0, Q.stoneLit], [0.4, Q.stone], [1, Q.stoneShade]]);
          ctx.fill();
          ellipse(fx, ty - 56, 22, 4, 0, Q.stoneDark);
          // Flammen in drei Lagen
          for (const [s, c] of [[1, rgba(fire, 0.85)], [0.68, mix(C.accent, CREAM, 0.4)], [0.36, mix(CREAM, '#fff6dc', 0.5)]]) {
            ctx.beginPath();
            ctx.moveTo(fx - 16 * s, ty - 57);
            ctx.quadraticCurveTo(fx - 16 * s, ty - 57 - 22 * s, fx - 2, ty - 57 - 40 * s);
            ctx.quadraticCurveTo(fx + 2 * s, ty - 57 - 24 * s, fx + 8 * s, ty - 57 - 30 * s);
            ctx.quadraticCurveTo(fx + 16 * s, ty - 57 - 14 * s, fx + 16 * s, ty - 57);
            ctx.closePath();
            ctx.fillStyle = c;
            ctx.fill();
          }
          const sp = [];
          for (let k = 0; k < 6; k++) sp.push([fx + (r() - 0.5) * 30, ty - 100 - r() * 40, 0.8 + r() * 0.8]);
          dots(sp, rgba(mix(C.accent, CREAM, 0.5), 0.8));
        }
        ruBush(w * 0.04, yb + 2, 0.8, Q.leaf, r);
        ruBush(w * 0.97, yb + 2, 0.9, Q.leaf, r);
      }
    },
    wall: {
      size: r => [280 + r() * 40, 200],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4;
        ruTree(w * 0.78, yb - 120, 120, Q, r);
        // Mauer mit gebrochener Oberkante
        const cols = Math.ceil(w / 26), topAt = [];
        for (let k = 0; k < cols; k++) topAt.push(yb - 60 - Math.max(0, Math.sin(k / cols * Math.PI) * 110 + (r() - 0.5) * 40));
        const list = [];
        for (let row = 0, y = yb - 14; y > yb - 190; row++, y -= 14) {
          for (let x = (row % 2) * -12; x < w; x += 26) {
            const k = clamp(Math.floor((x + 13) / 26), 0, cols - 1);
            if (y >= topAt[k]) list.push([x, y, 26, 14, y - 14 < topAt[k] ? 0.9 : 0]);
          }
        }
        ruBlocks(list, Q.stone, Q);
        // Fries mit Mäanderband
        const fy = yb - 98, fx0 = w * 0.18, fx1 = w * 0.82;
        ctx.fillStyle = rgba(Q.stoneShade, 0.5);
        ctx.fillRect(fx0, fy, fx1 - fx0, 16);
        ctx.strokeStyle = rgba(INK, 0.32);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let x = fx0 + 2; x < fx1 - 12; x += 13) { ctx.moveTo(x, fy + 13); ctx.lineTo(x, fy + 3); ctx.lineTo(x + 10, fy + 3); ctx.lineTo(x + 10, fy + 10); ctx.lineTo(x + 4, fy + 10); ctx.lineTo(x + 4, fy + 6); }
        ctx.stroke();
        // Nische mit gesichtsloser Figur
        const nx = w * 0.5;
        ctx.fillStyle = rgba(Q.stoneDark, 0.85);
        ctx.beginPath();
        ctx.moveTo(nx - 15, yb - 18);
        ctx.lineTo(nx - 15, yb - 64);
        ctx.arc(nx, yb - 64, 15, Math.PI, TAU);
        ctx.lineTo(nx + 15, yb - 18);
        ctx.closePath();
        ctx.fill();
        poly([[nx - 9, yb - 18], [nx - 7, yb - 56], [nx + 7, yb - 56], [nx + 9, yb - 18]], mix(Q.stone, Q.stoneShade, 0.3));
        ellipse(nx, yb - 63, 6, 7.5, 0, mix(Q.stoneLit, Q.stone, 0.5));
        ruRoots(w * 0.72, yb - 140, yb - 30, 4, mix(Q.earth, Q.stone, 0.3), r);
        for (let k = 0; k < 4; k++) ruVine(w * (0.2 + k * 0.12), topAt[Math.floor(cols * (0.2 + k * 0.12))] + 4, 30 + r() * 40, (r() - 0.5) * 8, Q.vine, r);
        ruBush(w * 0.1, yb + 2, 1.2, Q.leaf, r);
        ruBush(w * 0.9, yb + 2, 1, shade(Q.leaf, 0.05), r);
      }
    },
    obelisk: {
      size: r => [120 + r() * 20, 290],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.32), yb = h - 4, cx = w * 0.5;
        ruBlocks([[cx - 34, yb - 16, 68, 16, 0.4], [cx - 28, yb - 30, 56, 14, 0.7]], Q.stone, Q);
        ctx.save();
        ctx.translate(cx, yb - 30);
        ctx.rotate(0.05);
        ctx.beginPath();
        ctx.moveTo(-17, 0);
        ctx.lineTo(-12, -200);
        ctx.lineTo(-4, -214);
        ctx.lineTo(3, -204);
        ctx.lineTo(12, -222);
        ctx.lineTo(17, 0);
        ctx.closePath();
        ctx.fillStyle = hgrad(-17, 17, [[0, Q.stoneLit], [0.35, Q.stone], [0.75, Q.stoneShade], [1, shade(Q.stoneShade, -0.15)]]);
        ctx.fill();
        // geometrische Bänder: Winkel, Kreise, Stufen (keine Schrift)
        ctx.strokeStyle = rgba(INK, 0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const y = -30 - k * 44, hw = 15 - k * 1.2;
          ctx.moveTo(-hw, y); ctx.lineTo(hw, y);
          ctx.moveTo(-hw, y - 18); ctx.lineTo(hw, y - 18);
          if (k % 2 === 0) { ctx.moveTo(-hw + 2, y - 4); ctx.lineTo(0, y - 14); ctx.lineTo(hw - 2, y - 4); }
          else { ctx.moveTo(4, y - 9); ctx.arc(0, y - 9, 4, 0, TAU); }
        }
        ctx.stroke();
        ruRim(-17, -200, 0, Q, 0.4);
        ellipses([[-6, -150, 5, 2, 0.3], [6, -60, 6, 2.2, -0.2]], Q.moss);
        ctx.restore();
        poly([[cx + 26, yb], [cx + 36, yb - 14], [cx + 46, yb - 6], [cx + 44, yb]], Q.stoneShade);
        ruVine(cx - 14, yb - 120, 80, -4, Q.vine, r);
        ruVine(cx + 4, yb - 200, 60, 6, Q.vine, r);
        ruBush(cx - 34, yb + 2, 1, Q.leaf, r);
      }
    }
  };

  // Lianenbündel vom oberen Bildrand
  const ruHang = {
    lianas: {
      size: r => [120 + r() * 70, 150 + r() * 90],
      paint: (w, h, r, C) => {
        const Q = ruPal(C, 0.28), n = 4 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) ruVine(w * (0.1 + 0.8 * k / (n - 1)) + (r() - 0.5) * 10, -4, h * (0.45 + r() * 0.5), (r() - 0.5) * 24, shade(Q.vine, (k % 2) * 0.08), r, 1.6);
        const lv = [];
        for (let k = 0; k < 14; k++) lv.push([w * r(), r() * 16, 10 + r() * 8]);
        crown(w * 0.5, 4, w * 0.45, 14, Q.leaf, Q.leaf2, r, 12, 10);
        ctx.beginPath();
        for (const [x, y, len] of lv) leafPath(x, y + 10, len, len * 0.45, Math.PI / 2 + (r() - 0.5) * 1.2, LEAF_B);
        ctx.fillStyle = shade(Q.leaf, -0.1);
        ctx.fill();
      }
    }
  };

  // Ablauf: Treppe, Halle, Statue, Feuerschalen, Bogen, Kopf, Mauer; danach häufiger Statuen,
  // Köpfe und Stelen, und jedes spätere Motiv liegt etwas tiefer in der Dämmerung
  SCENE['Ruinen'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 30, gap: [20, 140], maxKs: 1.5, base: () => RU_FAR,
        pick: flow(['fcolonnade', 'fpyramid', 'ftower', 'fcolossus'], [['fcolonnade', 1.4], ['fpyramid', 1.5], ['ftower', 1.3], ['fcolossus', 1.2]], 1),
        kinds: ruFar },
      { z: 1, factor: 0.34, start: 20, gap: [20, 120], maxKs: 2, base: () => RU_MID,
        pick: flow(['stairs', 'hall', 'statue', 'braziers', 'arch', 'head', 'wall'],
          i => [['hall', 1.3], ['arch', 1.1], ['stairs', 1], ['statue', 0.9 + i * 0.04], ['braziers', 0.9], ['head', 0.7 + i * 0.05], ['wall', 1.1], ['obelisk', 0.6 + i * 0.05]], 3),
        kinds: ruMid },
      { z: 2, factor: 0.58, start: 600, gap: [600, 1300], maxKs: 2, base: (i, rng, kind, h) => h,
        pick: () => 'lianas', kinds: ruHang }
    ]
  };
  // Stimmung entlang des Levels: spätere Motive bekommen mehr Dämmerung (Ruinen) bzw. kühleren Dunst (Herbstwald)
  function moodShift(K, colOf, maxA, step) {
    const paint = K.paint;
    K.paint = (w, h, r, C, L, it) => {
      paint(w, h, r, C, L, it);
      const i = (it && it.i) || 0, a = clamp((i - 4) * step, 0, maxA);
      if (a > 0.004) hazeOver(w, h, colOf(C), a);
    };
  }
  for (const K of Object.values(ruMid)) moodShift(K, C => mix(C.skyTop, INK, 0.25), 0.24, 0.016);
  for (const K of Object.values(auMid)) moodShift(K, C => mix(C.skyTop, CREAM, 0.35), 0.16, 0.012);
  for (const name of ['Herbstwald', 'Ruinen']) for (const T of SCENE[name].tracks) for (const K of Object.values(T.kinds)) { K.tex = K.tex || null; isolate(K); }

  // ---------------------------------------------------------
  // Steinwächter: schwebender Steinkopf mit Stufenkrone, Glyphenaugen (geometrisch, keine Schrift)
  // und vier kreisenden Steintafeln. Vorwarnung: Augen und Rillen glühen golden auf, der Kiefer
  // sinkt, zwei Tafeln leuchten und schwingen nach vorn.
  // ---------------------------------------------------------
  // Glyphe als Pfad: Raute mit Punkt (0), Ring mit Kreuz (1), Stufenwinkel (2)
  function glyphPath(x, y, s, kind) {
    if (kind === 0) {
      ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
      ctx.moveTo(x + s * 0.28, y); ctx.arc(x, y, s * 0.28, 0, TAU);
    } else if (kind === 1) {
      ctx.moveTo(x + s * 0.8, y); ctx.arc(x, y, s * 0.8, 0, TAU);
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    } else {
      ctx.moveTo(x - s, y + s); ctx.lineTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y + s * 0.2); ctx.lineTo(x - s * 0.2, y + s * 0.2); ctx.lineTo(x - s * 0.2, y - s * 0.3);
    }
  }
  ART2.boss.guardian = (P, t, w) => {
    const ew = smooth01(w), bob = Math.sin(t * 0.04) * 2;
    const stone = P.main, lit = mix(mix(P.main, P.cream, 0.3), P.sky, 0.25), side = mix(P.mainSide, P.far, 0.35), dark = mix(P.mainDark, P.far, 0.2);
    const groove = mix(P.ink, P.mainDark, 0.35), moss = mix(P.near, P.acc, 0.22), gold = P.acc, goldL = P.accLight;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.06);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Tafeln auf der Umlaufbahn: hinten vor dem Kopf malen, vorn danach
    const tabs = [];
    for (let k = 0; k < 4; k++) {
      const a = t * 0.022 + k * TAU / 4 + ew * 1.6, ox = Math.cos(a) * (58 - ew * 6), oy = Math.sin(a) * 12, tl = -0.1;
      const x = 46 + ox * Math.cos(tl) - oy * Math.sin(tl), y = 50 + ox * Math.sin(tl) + oy * Math.cos(tl) + Math.sin(t * 0.05 + k) * 2;
      tabs.push({ k, x, y, front: Math.sin(a) > 0, s: 0.86 + 0.14 * Math.sin(a), rot: Math.sin(t * 0.03 + k * 1.7) * 0.25 + (k % 2 ? 0.1 : -0.1), hot: k % 2 === 0 ? ew : ew * 0.25 });
    }
    const drawTab = b => {
      ctx.save();
      ctx.translate(b.x, b.y + bob);
      ctx.rotate(b.rot);
      ctx.scale(b.s, b.s);
      cached('ru:tab', P, () => {
        ctx.fillStyle = rgba(P.ink, 0.25);
        ctx.fillRect(-4.6, -6.2, 11, 15);
        ctx.fillStyle = side;
        ctx.fillRect(3.5, -7.5, 3, 14.5);
        ctx.fillStyle = lit;
        ctx.fillRect(-5.5, -7.5, 9, 14.5);
        ctx.fillStyle = rgba(P.cream, 0.35);
        ctx.fillRect(-5.5, -7.5, 9, 1.2);
        ctx.strokeStyle = rgba(groove, 0.7);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        glyphPath(-1, -0.5, 3, 2);
        ctx.stroke();
        ctx.fillStyle = moss;
        ctx.fillRect(-5.5, -7.5, 4, 1.4);
      }, -8, -10, 16, 20);
      ctx.restore();
      const ga = 0.2 + 0.15 * pulse + b.hot * 0.8;
      glow(b.x - 1, b.y + bob, 6 + b.hot * 9, gold, ga * 0.6);
      ctx.save();
      ctx.translate(b.x, b.y + bob);
      ctx.rotate(b.rot);
      ctx.scale(b.s, b.s);
      ctx.strokeStyle = rgba(mix(gold, P.cream, 0.4), Math.min(1, ga));
      ctx.lineWidth = 1;
      ctx.beginPath();
      glyphPath(-1, -0.5, 3, 2);
      ctx.stroke();
      ctx.restore();
    };
    for (const b of tabs) if (!b.front) drawTab(b);

    ctx.save();
    ctx.translate(0, bob);
    // Bruchkante unter dem Kinn, rieselnde Steinchen
    for (let k = 0; k < 4; k++) {
      const p = ((t + k * 23) % 70) / 70;
      circle(24 + k * 13, 86 + p * 26, 1.2 - p * 0.5, rgba(side, 1 - p));
    }
    // Kiefer: sinkt bei der Vorwarnung, dahinter goldenes Licht
    const jd = ew * 8;
    if (jd > 0.2) {
      poly([[3, 48.5], [58, 49.5], [88, 54], [88, 56 + jd], [58, 51 + jd], [3, 50.5 + jd]], groove);
      glow(14, 50 + jd * 0.5, 14 + jd * 2.2, goldL, ew * 0.85);
      ctx.fillStyle = rgba(P.cream, ew * 0.8);
      ctx.fillRect(3, 49.5 + jd * 0.35, 30, Math.max(0.8, jd * 0.3));
    }
    ctx.save();
    ctx.translate(0, jd);
    cached('ru:jaw', P, () => {
      poly([[58, 51], [88, 55], [86, 72], [58, 80]], side);
      poly([[3, 50], [58, 51], [58, 80], [16, 82], [6, 66]], stone);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(3, 50); ctx.lineTo(58, 51); ctx.lineTo(58, 80); ctx.lineTo(16, 82); ctx.lineTo(6, 66); ctx.closePath();
      ctx.clip();
      ctx.fillStyle = hgrad(0, 58, [[0, rgba(lit, 0.9)], [0.45, rgba(lit, 0)], [1, rgba(P.mainDark, 0.25)]]);
      ctx.fillRect(0, 48, 60, 36);
      ctx.restore();
      // Kinnrillen
      ctx.strokeStyle = rgba(groove, 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const x = 14 + k * 9; ctx.moveTo(x, 58); ctx.lineTo(x, 74 - Math.abs(k - 2) * 2); }
      ctx.moveTo(8, 56); ctx.lineTo(54, 57);
      ctx.stroke();
      ctx.strokeStyle = rgba(lit, 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const x = 13.2 + k * 9; ctx.moveTo(x, 58); ctx.lineTo(x, 73 - Math.abs(k - 2) * 2); }
      ctx.stroke();
      // Bruchkante unten
      poly([[16, 82], [24, 88], [31, 84], [40, 90], [48, 85], [58, 80]], dark);
      poly([[58, 80], [64, 85], [74, 79], [86, 72]], mix(dark, P.ink, 0.3));
      poly([[50, 51], [58, 51], [58, 56]], rgba(P.ink, 0.35));
    }, -2, 46, 94, 48);
    ctx.restore();

    // Kopf mit Stufenkrone
    cached('ru:head', P, () => {
      // Seitenfläche (Dämmerung) und Ohrscheibe
      poly([[56, 2], [86, 10], [88, 55], [58, 51]], side);
      poly([[60, -6], [84, 2], [86, 10], [56, 2]], mix(side, P.far, 0.3));
      circle(72.5, 32, 8, mix(side, lit, 0.25));
      circle(72.5, 32, 5.2, side);
      ctx.strokeStyle = rgba(groove, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(72.5, 32, 6.5, 0, TAU);
      ctx.stroke();
      circle(72.5, 32, 1.8, groove);
      // Stufenkrone
      const tiers = [[6, -6, 56, 10], [13, -15, 42, 9], [23, -23, 22, 8]];
      for (const [x, y, wd, hh] of tiers) {
        poly([[x + wd, y], [x + wd + 10, y + 3], [x + wd + 10, y + hh + 3], [x + wd, y + hh]], side);
        ctx.fillStyle = hgrad(x, x + wd, [[0, lit], [0.5, stone], [1, mix(stone, side, 0.5)]]);
        ctx.fillRect(x, y, wd, hh);
        ctx.fillStyle = rgba(P.cream, 0.35);
        ctx.fillRect(x, y, wd, 1.2);
      }
      ctx.strokeStyle = rgba(groove, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 9; x < 58; x += 8) { ctx.moveTo(x, 2); ctx.lineTo(x, -3); ctx.lineTo(x + 5, -3); ctx.lineTo(x + 5, 1); ctx.lineTo(x + 2.5, 1); }
      ctx.moveTo(30.5, -19); ctx.arc(33, -19, 2.5, Math.PI, Math.PI * 3);
      ctx.stroke();
      // Vorderseite des Gesichts
      const face = () => {
        ctx.beginPath();
        ctx.moveTo(8, 4); ctx.lineTo(56, 2); ctx.lineTo(58, 51); ctx.lineTo(3, 50);
        ctx.lineTo(4, 43); ctx.lineTo(0, 40); ctx.lineTo(1, 30); ctx.lineTo(6, 23);
        ctx.closePath();
      };
      face();
      ctx.fillStyle = stone;
      ctx.fill();
      ctx.save();
      face();
      ctx.clip();
      ctx.fillStyle = hgrad(0, 58, [[0, rgba(lit, 0.95)], [0.45, rgba(lit, 0.15)], [1, rgba(P.mainDark, 0.2)]]);
      ctx.fillRect(-2, 0, 62, 52);
      ctx.fillStyle = vgrad(36, 52, [[0, rgba(P.mainDark, 0)], [1, rgba(P.mainDark, 0.25)]]);
      ctx.fillRect(-2, 36, 62, 16);
      ctx.restore();
      // Brauenwulst und Nase
      ctx.fillStyle = rgba(P.mainDark, 0.35);
      ctx.fillRect(6, 24, 52, 2.4);
      ctx.fillStyle = rgba(P.cream, 0.3);
      ctx.fillRect(6, 19, 50, 1.4);
      poly([[9, 24], [3, 30], [0, 40], [5, 42], [11, 38]], mix(lit, P.cream, 0.15));
      poly([[11, 38], [5, 42], [12, 42]], rgba(P.mainDark, 0.45));
      // Augenhöhlen
      roundRectPath(13, 27, 15, 10, 3);
      ctx.fillStyle = groove;
      ctx.fill();
      roundRectPath(36, 27, 13, 9.5, 3);
      ctx.fill();
      ctx.fillStyle = rgba(P.cream, 0.25);
      ctx.fillRect(13, 37, 15, 1);
      ctx.fillRect(36, 36.5, 13, 1);
      // Rillen in Wangen und Stirn (leuchten später auf)
      ctx.strokeStyle = rgba(groove, 0.65);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(20.5, 39); ctx.lineTo(20.5, 45); ctx.lineTo(30, 45);
      ctx.moveTo(42.5, 38); ctx.lineTo(42.5, 44); ctx.lineTo(52, 44); ctx.lineTo(52, 30);
      ctx.moveTo(14, 13); ctx.lineTo(28, 13); ctx.lineTo(28, 8); ctx.moveTo(34, 8); ctx.lineTo(34, 13); ctx.lineTo(50, 13);
      ctx.stroke();
      // Riss und abgeschlagene Ecke
      ctx.strokeStyle = rgba(P.ink, 0.5);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(38, -6); ctx.lineTo(35, 2); ctx.lineTo(37, 9); ctx.lineTo(33, 18); ctx.lineTo(34, 24);
      ctx.moveTo(70, 8); ctx.lineTo(73, 18); ctx.lineTo(70, 22);
      ctx.stroke();
      poly([[62, -6.5], [72, -3], [62, 1]], rgba(P.ink, 0.3));
      // Moos auf der Krone und an der Kante
      const ms = [[10, -5.6, 4.5], [17, -6, 3.4], [16, -14.6, 3.6], [26, -22.6, 3.4], [62, -5.4, 3.2], [79, 1.4, 3.6], [86.4, 14, 1.4]];
      ellipses(ms.map(([a, b, c]) => [a + 0.5, b + 0.9, c, c * 0.42, 0]), rgba(P.ink, 0.22));
      ellipses(ms.map(([a, b, c]) => [a, b, c, c * 0.42, 0]), moss);
      ellipses(ms.map(([a, b, c]) => [a - c * 0.25, b - c * 0.12, c * 0.45, c * 0.16, 0]), rgba(goldL, 0.45));
      ellipses([[4, 30, 1.4, 4, 0], [86.6, 40, 1.2, 6, 0]], rgba(moss, 0.8));
    }, -4, -30, 96, 84);

    // Glyphenaugen: glimmen ruhig, bei der Vorwarnung hell
    const eg = 0.45 + 0.2 * pulse + 0.55 * ew;
    for (const [ex, ey, kind] of [[20.5, 32, 0], [42.5, 31.8, 1]]) {
      glow(ex, ey, 8 + ew * 12, gold, eg * 0.7);
      ctx.strokeStyle = rgba(mix(gold, P.cream, 0.3 + ew * 0.5), Math.min(1, eg + 0.2));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      glyphPath(ex, ey, kind === 0 ? 3.6 : 3.3, kind);
      ctx.stroke();
    }
    if (ew > 0.02) {
      ctx.strokeStyle = rgba(goldL, ew * 0.9);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(20.5, 39); ctx.lineTo(20.5, 45); ctx.lineTo(30, 45);
      ctx.moveTo(42.5, 38); ctx.lineTo(42.5, 44); ctx.lineTo(52, 44); ctx.lineTo(52, 30);
      ctx.moveTo(14, 13); ctx.lineTo(28, 13); ctx.lineTo(28, 8); ctx.moveTo(34, 8); ctx.lineTo(34, 13); ctx.lineTo(50, 13);
      ctx.stroke();
    }
    // Ranken unter dem Kinn
    ctx.strokeStyle = moss;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const x0 = 20 + k * 14, len = 12 + k * 4, sw = Math.sin(t * 0.05 + k * 1.9) * 3;
      ctx.moveTo(x0, 82 + jd);
      ctx.quadraticCurveTo(x0 + sw * 0.5, 82 + jd + len * 0.6, x0 + sw, 82 + jd + len);
    }
    ctx.stroke();
    ctx.restore();
    for (const b of tabs) if (b.front) drawTab(b);
  };

  // Geschoss Glyphenstein: kantiger Brocken mit dunkler Kontur und golden leuchtender Glyphe
  ART2.projectile.glyphstone = (s, C, x, y) => {
    const r = s.r, rng = mulberry32((s.group || 0) * 31 + (s.piece ? 7 : 0) + 3), ang = (s.t || 0) * 0.05 + (s.group || 0);
    const stone = mix(C.pipe, CREAM, 0.28), dark = mix(C.pipe, INK, 0.5), gold = mix(C.accent, CREAM, 0.3);
    const pts = [];
    for (let k = 0; k < 7; k++) { const a = ang + k * TAU / 7, rr = r * (0.88 + rng() * 0.22); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    poly(pts, null, rgba(C.accent, 0.45), 4.6);
    poly(pts, dark, rgba(INK, 0.85), 1.7);
    poly(pts.map(([px, py]) => [x - 1.4 + (px - x) * 0.8, y - 1.6 + (py - y) * 0.8]), stone);
    ellipse(x - r * 0.35, y - r * 0.42, r * 0.38, r * 0.2, -0.6, rgba(CREAM, 0.4));
    circle(x, y, r * 0.62, rgba(C.accent, 0.35));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = rgba(INK, 0.45);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    glyphPath(0, 0, r * 0.42, (s.group || 0) % 3);
    ctx.stroke();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  };

  // @@RU_DONE@@

  // ============================================================
  // Level-Zuordnung (nur Darstellung, Spielwerte bleiben unverändert)
  // ============================================================
  const au = levelByName('Herbstwald');
  if (au) {
    Object.assign(au, {
      sky: { body: 'none', sunX: 0.3, sunY: 330, extra: 'auAutumn' },
      layers: [
        { kind: 'auHills', P: 1000, seed: 181 },
        { kind: 'auGrove', P: 1200, seed: 182 },
        { kind: 'props', P: 1400, prop: 'auforest', spacing: 54, seed: 183 }
      ]
    });
    au.style.pipe = 'aubark';
    au.style.ground = 'auleaves';
    au.style.boss = 'mushroom';
    au.style.projectile = 'leaf';
  }
  const ru = levelByName('Ruinen');
  if (ru) {
    Object.assign(ru, {
      sky: { body: 'none', sunX: 0.24, sunY: 372, extra: 'ruDusk' },
      layers: [
        { kind: 'ruJungle', P: 1000, seed: 191 },
        { kind: 'ruRubble', P: 1200, seed: 192 },
        { kind: 'props', P: 1400, prop: 'ruprops', spacing: 62, seed: 193 }
      ]
    });
    ru.style.pipe = 'ruincol';
    ru.style.ground = 'ruslabs';
    ru.style.boss = 'guardian';
    ru.style.projectile = 'glyphstone';
  }
  // @@MAP@@
})();
