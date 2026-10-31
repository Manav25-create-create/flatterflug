// ============================================================
// SCHATTENREICH (Level 20): das Finale bei Nacht, violett und schwarz.
// Himmel: fahler, gesprungener Mond, aus dessen Riss kaltes Licht in den Himmel sickert,
// Wolkenbänder, wenige kalte Sterne, Schein am Horizont.
// Ebenen: ferne Nadelberge im Dunst (0.2), Dornenkamm mit Kristallen (0.5), Dornengestrüpp (0.8).
// Kulissen mit Ablauf: hinten (0.08) Nadelberge, Riesendorn, ferne Felsinseln und die Zitadelle,
// die am Ende der Röhrenphase den Horizont füllt; mittig (0.3) erst totes Grenzland
// (Dornenbäume, Monolithe, Wachtürme), dann schwebende Felsen, Dornentore und Mauern.
// Säulen: Obsidian mit Facetten und violett glimmenden Adern, Dornen an den Seiten.
// Boden: Basaltplatten mit glimmenden Rissen und Kristallsplittern.
// Alles in einer IIFE; nach außen gehen nur die Einträge in ART2 und SCENE.
// ============================================================
(() => {
  'use strict';
  const R = (r, a, b) => a + r() * (b - a);
  const DEEP = '#07050b';

  // ---------- Farben (aus der Palette abgeleitet, pro Farbsatz einmal) ----------
  const palCache = new Map();
  function pal(C) {
    let K = palCache.get(C);
    if (K) return K;
    const horizon = mix(C.skyBottom, C.accent, 0.3), farBase = mix(C.skyBottom, C.accent, 0.1);
    const fBody = mix(farBase, horizon, 0.38), m = mix(C.far, C.skyBottom, 0.3), l1 = mix(C.near, C.far, 0.5);
    K = {
      horizon, mist: mix(C.skyBottom, C.accent, 0.2), deep: DEEP,
      rim: mix(C.accent, CREAM, 0.55), hot: mix(C.accentLight, '#ffffff', 0.45),
      moon: mix(CREAM, '#a898cc', 0.6), moonDark: mix(mix(CREAM, '#a898cc', 0.6), C.skyBottom, 0.6),
      // ferne Spur: nah an den Himmelsfarben
      fBody, fLit: mix(fBody, horizon, 0.45), fDark: mix(fBody, C.skyBottom, 0.45),
      // Ebene 0: hintere und vordere Reihe
      l0Back: mix(farBase, C.far, 0.12), l0Front: mix(farBase, C.far, 0.48),
      // ferne schwebende Inseln: dunkel vor dem Nachthimmel
      fiBody: mix(C.skyTop, fBody, 0.55), fiLit: mix(mix(C.skyTop, fBody, 0.55), horizon, 0.4), fiDark: mix(C.skyTop, fBody, 0.3),
      // mittlere Spur
      m, mLit: mix(m, horizon, 0.42), mDark: shade(m, -0.4),
      // Ebene 1 und Vordergrund
      l1, l1Lit: mix(l1, horizon, 0.38), l1Dark: shade(l1, -0.4),
      near: C.near, nearLit: mix(C.near, horizon, 0.32),
      // Kristalle
      crys: mix(C.accent, C.far, 0.3), crysLit: mix(C.accent, CREAM, 0.42), crysDark: mix(C.accent, INK, 0.55),
      // Obsidian der Säulen
      obs: mix(C.pipe, '#140b1d', 0.32), obsLit: mix(C.pipe, '#a492d4', 0.46), obsDark: mix(C.pipe, DEEP, 0.62),
      sheen: mix(CREAM, C.accent, 0.22)
    };
    palCache.set(C, K);
    return K;
  }

  // ---------- Werkzeuge ----------
  function path(pts, close) {
    ctx.beginPath();
    pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    if (close) ctx.closePath();
  }
  function subPath(pts) {
    pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    ctx.closePath();
  }
  // weicher, gestreckter Fleck (Nebel, Schein)
  function soft(x, y, rx, ry, col, a) {
    if (a <= 0.002 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(col, a)], [0.5, rgba(col, a * 0.45)], [1, rgba(col, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  // Leuchtende Linien gebündelt in drei Lagen: Schein, Kern, helle Mitte
  function glowLines(list, C, k, a) {
    if (!list.length) return;
    const s = k || 1, al = a === undefined ? 1 : a;
    for (const [lw, col, aa] of [[6 * s, C.accent, 0.15], [2.1 * s, C.accent, 0.72], [0.85 * s, C.accentLight, 0.9]]) {
      ctx.beginPath();
      for (const pts of list) pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = rgba(col, aa * al);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  // Zickzacklinie von a nach b
  function zig(x0, y0, x1, y1, n, jit, q) {
    const pts = [[x0, y0]];
    for (let k = 1; k < n; k++) { const t = k / n; pts.push([lerp(x0, x1, t) + (q() - 0.5) * jit, lerp(y0, y1, t) + (q() - 0.5) * jit]); }
    pts.push([x1, y1]);
    return pts;
  }
  // Riss, der von (x, y) in Richtung ang wandert
  function crackFrom(x, y, ang, n, step, wob, q) {
    const pts = [[x, y]];
    let a = ang;
    for (let k = 0; k < n; k++) { a += (q() - 0.5) * wob; x += Math.cos(a) * step * (0.6 + q() * 0.8); y += Math.sin(a) * step * (0.6 + q() * 0.8); pts.push([x, y]); }
    return pts;
  }
  // Nur auf bereits Gemaltes (Motiv): Dunst nach unten, Luftperspektive
  function hazeOver(w, h, col, a0, a1, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(y0, y1, [[0, rgba(col, a0)], [1, rgba(col, a1)]]);
    ctx.fillRect(-2, Math.min(0, y0) - 2, w + 4, h + 4 - Math.min(0, y0));
    ctx.restore();
  }

  // Gebogener Dorn bzw. Nadel: Mittellinie als Bogen, Breite läuft spitz zu. Licht links, Schatten rechts.
  // Liefert die linke Kante (für Lichtkanten und Seitendornen).
  function horn(x, yb, bw, hh, bend, body, lit, dark, ex, q, jag) {
    const n = 8, L = [], Rr = [], M1 = [], M2 = [], cx1 = x, cy1 = yb - hh * 0.55, tx = x + bend, ty = yb - hh;
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      const px = u * u * x + 2 * u * t * cx1 + t * t * tx, py = u * u * yb + 2 * u * t * cy1 + t * t * ty;
      let dx = 2 * u * (cx1 - x) + 2 * t * (tx - cx1), dy = 2 * u * (cy1 - yb) + 2 * t * (ty - cy1);
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = -dy, ny = dx, j = jag && k > 0 && k < n ? 1 + (q() - 0.5) * jag : 1;
      const hw = bw * Math.pow(u, ex || 1.2) * j;
      L.push([px - nx * hw, py - ny * hw]);
      Rr.push([px + nx * hw, py + ny * hw]);
      M1.push([px - nx * hw * 0.38, py - ny * hw * 0.38]);
      M2.push([px + nx * hw * 0.22, py + ny * hw * 0.22]);
    }
    poly(L.concat(Rr.slice().reverse()), body);
    if (lit) poly(L.concat(M1.slice().reverse()), lit);
    if (dark) poly(M2.concat(Rr.slice().reverse()), dark);
    return { L, Rr };
  }
  // kleine Seitendornen entlang einer Kante (pts von unten nach oben), side -1 links, +1 rechts
  function sideThorns(pts, side, n, len, col, q) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const j = 1 + Math.floor(q() * (pts.length - 3)), p = pts[j], o = pts[j + 1], l = len * R(q, 0.6, 1.2);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + side * l, p[1] - l * R(q, 0.5, 1.1));
      ctx.lineTo(lerp(p[0], o[0], 0.6), lerp(p[1], o[1], 0.6));
      ctx.closePath();
    }
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Kristall (h > 0 nach oben, h < 0 nach unten hängend): Lichtfläche links, Schattenfläche rechts
  function crystal(x, yb, h, w, tilt, C, K, edge) {
    const tip = [x + tilt * Math.abs(h), yb - h], sl = [x - w / 2 + tilt * Math.abs(h) * 0.5, yb - h * 0.72], sr = [x + w / 2 + tilt * Math.abs(h) * 0.5, yb - h * 0.75];
    const bl = [x - w / 2, yb], br = [x + w / 2, yb], mid = [x + w * 0.08 + tilt * Math.abs(h) * 0.4, yb - h * 0.15];
    poly([bl, sl, tip, mid], K.crysLit);
    poly([mid, tip, sr, br], K.crys);
    poly([bl, mid, br], K.crysDark);
    if (edge) line(sl[0] + 0.6, sl[1], tip[0], tip[1] + (h > 0 ? 1 : -1), rgba('#ffffff', edge), 0.8);
  }
  // Kristallgruppe mit weichem Schein
  function crystalCluster(x, yb, s, C, K, q, glowA, down) {
    const dir = down ? -1 : 1;
    if (glowA) soft(x, yb - dir * 6 * s, 20 * s, 14 * s, C.accent, glowA);
    const n = 3 + Math.floor(q() * 3), list = [];
    for (let k = 0; k < n; k++) list.push([x + (k - (n - 1) / 2) * 4.5 * s + R(q, -2, 2), (k === Math.floor(n / 2) ? 1 : R(q, 0.4, 0.8)) * 18 * s, R(q, 4, 6.5) * s, (k - (n - 1) / 2) * 0.12 + R(q, -0.08, 0.08)]);
    list.sort((a, b) => a[1] - b[1]);
    for (const [cx, hh, ww, tl] of list) crystal(cx, yb, dir * hh, ww, tl, C, K, 0.45);
  }

  // Abfolge: feste Eröffnung, danach gewichteter Zufall ohne die letzten mem Motive.
  // Der Verlauf hängt an der rng-Funktion der Spur, damit Vorschau, Miniatur und Spiel unabhängig bleiben.
  const flowHist = new WeakMap();
  function flow(opening, pool, mem) {
    return (i, rng) => {
      let hist = flowHist.get(rng);
      if (!hist || i === 0) { hist = []; flowHist.set(rng, hist); }
      let k = opening[i];
      if (k === undefined) {
        const avoid = hist.slice(-(mem || 2)), cand = pool.filter(p => !avoid.includes(p[0]));
        let tot = 0;
        for (const p of cand) tot += p[1];
        let v = rng() * tot;
        k = cand[cand.length - 1][0];
        for (const p of cand) { v -= p[1]; if (v <= 0) { k = p[0]; break; } }
      }
      hist.push(k);
      return k;
    };
  }
  // Malen isolieren: Dunst (source-atop) darf in der Menü-Miniatur nur das Motiv treffen
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

  // ============================================================
  // HIMMEL
  // ============================================================
  ART2.sky.shShadow = (C, S, rng) => {
    const K = pal(C);
    // oben tiefer, unten kalter Schein über dem Horizont
    ctx.fillStyle = vgrad(0, 210, [[0, rgba(DEEP, 0.6)], [1, rgba(DEEP, 0)]]);
    ctx.fillRect(0, 0, W, 210);
    ctx.fillStyle = vgrad(250, GROUND_Y, [[0, rgba(K.horizon, 0)], [0.6, rgba(K.horizon, 0.28)], [1, rgba(mix(K.horizon, C.accent, 0.12), 0.62)]]);
    ctx.fillRect(0, 250, W, H - 250);
    const mx = Math.round(W * (W < 600 ? 0.36 : 0.34)), my = 128, mr = Math.round(clamp(W * 0.056, 42, 64));
    // Sterne: wenige, kalt, nach unten seltener, nicht im Mondhof
    const sm = [], md = [], big = [];
    for (let k = 0, n = Math.round(W / 6); k < n; k++) {
      const x = rng() * W, y = Math.pow(rng(), 1.5) * 360, d = Math.hypot(x - mx, y - my), s = rng();
      if (d < mr * 2.6) continue;
      if (s < 0.8) sm.push([x, y, 0.4 + rng() * 0.35]);
      else if (s < 0.97) md.push([x, y, 0.7 + rng() * 0.35]);
      else big.push([x, y, 1 + rng() * 0.5]);
    }
    dots(sm, rgba(mix(CREAM, C.accent, 0.25), 0.4));
    dots(md, rgba(mix(CREAM, C.accent, 0.15), 0.6));
    for (const [x, y, r] of big) {
      ctx.fillStyle = rgrad(x, y, 0, r * 5, [[0, rgba(K.rim, 0.35)], [1, rgba(K.rim, 0)]]);
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      segs([[x - r * 3.5, y, x + r * 3.5, y], [x, y - r * 3.5, x, y + r * 3.5]], rgba(CREAM, 0.25), 0.6);
      circle(x, y, r * 0.8, mix(CREAM, C.accent, 0.1));
    }
    // ferne Schleier: dunkle Wolkenbänder quer über den Himmel
    const cloud = mix(C.skyTop, C.far, 0.55);
    for (let k = 0, n = Math.round(W / 140); k < n; k++) {
      const x = rng() * (W + 200) - 100, y = 40 + rng() * 260, rx = 120 + rng() * 200;
      soft(x, y, rx, rx * (0.04 + rng() * 0.04), cloud, 0.45 + rng() * 0.25);
    }
    // Mondhof
    ctx.fillStyle = rgrad(mx, my, mr * 0.9, mr * 5, [[0, rgba(mix(K.moon, C.accent, 0.45), 0.14)], [0.35, rgba(mix(K.moon, C.accent, 0.6), 0.05)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    ctx.fillStyle = rgrad(mx, my, mr, mr * 1.6, [[0, rgba(K.moon, 0.13)], [1, rgba(K.moon, 0)]]);
    ctx.fillRect(mx - mr * 1.7, my - mr * 1.7, mr * 3.4, mr * 3.4);
    // Mondscheibe: fahl, Licht oben links, Meere, Krater
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.clip();
    ctx.fillStyle = rgrad(mx, my, 0, mr * 1.15, [[0, mix(K.moon, CREAM, 0.25)], [0.55, K.moon], [1, K.moonDark]], mx - mr * 0.38, my - mr * 0.42);
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    const mare = mix(K.moonDark, C.far, 0.25);
    for (let k = 0; k < 6; k++) soft(mx + R(rng, -0.55, 0.5) * mr, my + R(rng, -0.5, 0.55) * mr, R(rng, 0.18, 0.4) * mr, R(rng, 0.12, 0.28) * mr, mare, 0.28);
    for (let k = 0; k < 9; k++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * mr * 0.85, cx = mx + Math.cos(a) * d, cy = my + Math.sin(a) * d, cr = R(rng, 0.03, 0.09) * mr;
      ellipse(cx + cr * 0.25, cy + cr * 0.25, cr, cr, 0, rgba(mare, 0.35));
      ellipse(cx - cr * 0.2, cy - cr * 0.2, cr * 0.8, cr * 0.8, 0, rgba(CREAM, 0.08));
    }
    // Schattenseite unten rechts
    ctx.fillStyle = rgrad(mx - mr * 0.5, my - mr * 0.55, mr * 1.1, mr * 2.1, [[0, rgba(C.skyBottom, 0)], [1, rgba(C.skyBottom, 0.55)]]);
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    ctx.restore();
    ctx.strokeStyle = rgba(CREAM, 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(mx, my, mr - 0.8, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
    // Der Riss: ein klaffender Spalt quer durch den Mond, aus dem kaltes Licht sickert.
    // Außerhalb der Scheibe läuft er nur kurz und dünn weiter und verblasst.
    const a0 = -0.78, a1 = 2.3, c = [mx + mr * 0.06, my + mr * 0.02];
    const main = zig(mx + Math.cos(a0) * mr * 1.6, my + Math.sin(a0) * mr * 1.6, c[0], c[1], 6, mr * 0.16, rng)
      .concat(zig(c[0], c[1], mx + Math.cos(a1) * mr * 1.7, my + Math.sin(a1) * mr * 1.7, 6, mr * 0.16, rng).slice(1));
    const branches = [];
    for (let k = 0; k < 2; k++) {
      const p = main[4 + k * 3 + Math.floor(rng() * 2)];
      branches.push(crackFrom(p[0], p[1], (k ? 0.9 : -2.4) + R(rng, -0.4, 0.4), 3, mr * 0.13, 0.9, rng));
    }
    // Spalt als Splitter: Breite in der Mitte am größten, zu den Enden spitz
    const n = main.length - 1, Lr = [], Rr2 = [];
    for (let k = 0; k <= n; k++) {
      const p = main[k], q2 = main[Math.min(n, k + 1)], o = main[Math.max(0, k - 1)];
      let dx = q2[0] - o[0], dy = q2[1] - o[1];
      const len = Math.hypot(dx, dy) || 1, t = k / n, wd = mr * 0.075 * Math.pow(Math.sin(Math.PI * t), 1.6);
      dx /= len; dy /= len;
      Lr.push([p[0] - dy * wd, p[1] + dx * wd]);
      Rr2.push([p[0] + dy * wd * 0.6, p[1] - dx * wd * 0.6]);
    }
    soft(c[0], c[1], mr * 0.9, mr * 0.55, C.accent, 0.16);
    const fade = (col, a) => rgrad(mx, my, 0, mr * 1.75, [[0, rgba(col, a)], [0.55, rgba(col, a)], [0.75, rgba(col, a * 0.35)], [1, rgba(col, 0)]]);
    for (const [lw, col, a] of [[14, C.accent, 0.07], [6, C.accent, 0.2], [2, C.accent, 0.75]]) {
      ctx.beginPath();
      for (const pts of [main, ...branches]) pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = fade(col, a);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    // dunkle Bruchkante unten rechts, darüber der helle Spalt
    poly(Lr.concat(Rr2.slice().reverse()).map(([x, y]) => [x + 1.2, y + 1.2]), rgba(mix(K.moonDark, DEEP, 0.5), 0.6));
    poly(Lr.concat(Rr2.slice().reverse()), fade(mix(C.accentLight, CREAM, 0.3), 0.95));
    ctx.beginPath();
    for (const pts of [main, ...branches]) pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = fade(K.hot, 0.85);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // Wolkenbänder vor dem Mond, unten vom Mondlicht gesäumt
    for (let k = 0; k < 2; k++) {
      const y = my + mr * (k ? R(rng, 0.55, 0.8) : R(rng, 0.05, 0.3)), x = mx + R(rng, -0.5, 0.5) * mr, rx = mr * R(rng, 1.8, 2.6), ry = R(rng, 6, 9) * mr / 55;
      soft(x, y, rx, ry, cloud, k ? 0.6 : 0.4);
      soft(x - rx * 0.1, y - ry * 0.8, rx * 0.6, ry * 0.35, K.moon, 0.1);
    }
    // Dunst am Horizont
    for (let k = 0, n = Math.round(W / 70); k < n; k++) {
      const x = rng() * (W + 160) - 80, y = 470 + rng() * 70, rx = 90 + rng() * 160;
      soft(x, y, rx, rx * 0.14, K.mist, 0.22 + rng() * 0.18);
    }
  };

  // ============================================================
  // EBENEN
  // ============================================================
  // Ebene 0 (0.2): ferne Nadelberge in zwei Reihen, Füße im leuchtenden Dunst
  ART2.layerExtent.shFar = () => [270, GROUND_Y + 14];
  ART2.layerTex.shFar = () => ({ grain: 0.03, mottle: 0.07, contrast: 1.1 });
  ART2.layer.shFar = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, K = pal(C);
    const rows = [
      { base: 500, body: K.l0Back, hMin: 50, hMax: 150, tall: 0.16, tallH: [170, 235], step: [16, 42] },
      { base: 522, body: K.l0Front, hMin: 30, hMax: 100, tall: 0.1, tallH: [110, 160], step: [20, 50] }
    ];
    for (const row of rows) {
      const list = [];
      for (let x = rng() * 20; x < P; x += R(rng, row.step[0], row.step[1])) {
        const tall = rng() < row.tall, hh = tall ? R(rng, row.tallH[0], row.tallH[1]) : R(rng, row.hMin, row.hMax);
        list.push([x, hh, tall ? R(rng, 9, 15) : R(rng, 18, 40), R(rng, -0.12, 0.12) * hh, tall, (rng() * 1e6) | 0]);
      }
      list.sort((a, b) => b[1] - a[1]);
      const lit = mix(row.body, K.horizon, 0.3), dark = shade(row.body, -0.16);
      for (const [x, hh, bw, bend, tall, seed] of list) {
        wrapEach(x, P, bw + Math.abs(bend) + 12, xx => {
          const q = mulberry32(seed), e = horn(xx, row.base + 30, bw * 1.5, hh + 30, bend, row.body, lit, dark, tall ? 1.6 : 1.25, q, 0.25);
          if (tall) {
            sideThorns(e.L, -1, 2, 6, row.body, q);
            sideThorns(e.Rr, 1, 2, 6, dark, q);
            if (q() < 0.45) {
              const p = e.L[5], wx = p[0] + bw * 0.5, wy = p[1] + 4;
              ctx.fillStyle = rgrad(wx, wy, 0, 7, [[0, rgba(C.accent, 0.35)], [1, rgba(C.accent, 0)]]);
              ctx.fillRect(wx - 7, wy - 7, 14, 14);
              ctx.fillStyle = rgba(K.rim, 0.7);
              ctx.fillRect(wx - 0.6, wy - 1.6, 1.2, 3.2);
            }
          }
        });
      }
    }
    // Dunst: Füße im kalten Schein, oben klar
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(400, yb, [[0, rgba(K.horizon, 0)], [0.7, rgba(K.horizon, 0.45)], [1, rgba(mix(K.horizon, C.accent, 0.1), 0.7)]]);
    ctx.fillRect(-8, 270, P + 16, yb - 270);
    ctx.restore();
  };

  // Ebene 1 (0.5): Kamm aus dunklem Fels mit gebogenen Riesendornen, Dornenranken und Kristallen
  ART2.layerExtent.shThorns = () => [300, GROUND_Y + 14];
  ART2.layerTex.shThorns = () => ({ grain: 0.05, mottle: 0.13, contrast: 1.15 });
  ART2.layer.shThorns = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, K = pal(C), f = ridgeFn(P, 512, 26, 0.006, l.seed);
    // Dornenranke als Bogen zwischen zwei Fußpunkten
    for (let k = 0; k < 2; k++) {
      const x0 = (k + R(rng, 0.1, 0.5)) * P / 2, span = R(rng, 120, 200), hh = R(rng, 70, 120), seed = (rng() * 1e6) | 0;
      wrapEach(x0, P, span + 30, xx => {
        const q = mulberry32(seed), y0 = f(xx) + 6, y1 = f(xx + span) + 6, pts = [];
        for (let j = 0; j <= 16; j++) { const t = j / 16; pts.push([xx + span * t, lerp(y0, y1, t) - Math.sin(Math.PI * t) * hh * (1 + (q() - 0.5) * 0.1)]); }
        path(pts);
        ctx.strokeStyle = K.l1Dark;
        ctx.lineWidth = 6;
        ctx.stroke();
        path(pts.map(([a, b]) => [a - 0.6, b - 1.6]));
        ctx.strokeStyle = rgba(K.rim, 0.16);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        for (let j = 1; j < 16; j++) {
          const [a, b] = pts[j], up = q() < 0.6 ? -1 : 1, s = R(q, 4, 8);
          ctx.moveTo(a - 2.5, b);
          ctx.lineTo(a + R(q, -3, 3), b + up * (s + 3));
          ctx.lineTo(a + 2.5, b);
          ctx.closePath();
        }
        ctx.fillStyle = K.l1Dark;
        ctx.fill();
      });
    }
    // Riesendornen auf dem Kamm, die großen zuerst
    const list = [];
    for (let k = 0, n = 15; k < n; k++) {
      const big = k < 4, x = (k + rng() * 0.8) * P / n, hh = big ? R(rng, 130, 200) : R(rng, 40, 115);
      list.push([x, hh, big ? R(rng, 15, 22) : R(rng, 7, 15), (rng() < 0.5 ? -1 : 1) * R(rng, 0.12, 0.42) * hh, (rng() * 1e6) | 0]);
    }
    list.sort((a, b) => b[1] - a[1]);
    for (const [x, hh, bw, bend, seed] of list) {
      wrapEach(x, P, bw + Math.abs(bend) + 14, xx => {
        const q = mulberry32(seed), e = horn(xx, f(xx) + 10, bw, hh + 10, bend, K.l1, K.l1Lit, K.l1Dark, 1.15, q, 0.12);
        path(e.L.slice(1));
        ctx.strokeStyle = rgba(K.rim, 0.22);
        ctx.lineWidth = 1.1;
        ctx.stroke();
        if (hh > 90) { sideThorns(e.L, -1, 3, 7, K.l1, q); sideThorns(e.Rr, 1, 3, 7, K.l1Dark, q); }
      });
    }
    // Felskamm davor
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(486, yb, [[0, mix(K.l1, K.l1Lit, 0.4)], [0.4, K.l1], [1, K.l1Dark]]);
    ctx.fill();
    ridgeLine(f, -8, P + 8, 4, 0.6, rgba(K.rim, 0.2), 1.2);
    // Kristallgruppen mit Schein am Kamm
    for (let k = 0; k < 5; k++) {
      const x = (k + R(rng, 0.2, 0.8)) * P / 5, s = R(rng, 0.6, 1.1), seed = (rng() * 1e6) | 0;
      wrapEach(x, P, 30, xx => crystalCluster(xx, f(xx) + 5, s, C, K, mulberry32(seed), 0.28));
    }
    // Nebelbank vor dem Fuß
    for (let k = 0; k < P / 90; k++) {
      const x = rng() * P, y = 528 + rng() * 16, rx = 60 + rng() * 90, a = 0.14 + rng() * 0.12;
      wrapEach(x, P, rx, xx => soft(xx, y, rx, rx * 0.16, K.mist, a));
    }
  };

  // Vordergrund (0.8): Dornengestrüpp, Obsidiansplitter, Kristalle, tote Dornenbäumchen
  ART2.prop.shBramble = { h: 92, paint: (x, base, s, r, v, C) => shProp(x, base, s, r, v, C) };
  function shProp(x, base, s, r, v, C) {
    const K = pal(C), body = K.near, lit = K.nearLit, dark = shade(body, -0.45);
    if (v < 0.32) {
      // Dornengestrüpp: verschlungene Ranken mit Dornen
      const hh = R(r, 26, 48) * s, wd = R(r, 22, 36) * s, stems = [];
      ellipse(x + 6, base - 1, wd * 1.1, 3 * s, 0, rgba(DEEP, 0.4));
      for (let k = 0; k < 6; k++) {
        const x0 = x + R(r, -0.6, 0.6) * wd, tx = x0 + R(r, -0.8, 0.8) * wd, ty = base - hh * R(r, 0.5, 1);
        stems.push([x0, base + 2, (x0 + tx) / 2 + R(r, -10, 10) * s, (base + ty) / 2 - R(r, 0, 10) * s, tx, ty]);
      }
      ctx.beginPath();
      for (const [a, b, c1, d, e, g] of stems) { ctx.moveTo(a, b); ctx.quadraticCurveTo(c1, d, e, g); }
      ctx.strokeStyle = body;
      ctx.lineWidth = 2.2 * s;
      ctx.stroke();
      ctx.beginPath();
      for (const [a, b, c1, d, e, g] of stems) {
        for (let k = 1; k < 5; k++) {
          const t = k / 5, u = 1 - t, px = u * u * a + 2 * u * t * c1 + t * t * e, py = u * u * b + 2 * u * t * d + t * t * g, sd = r() < 0.5 ? -1 : 1, l = R(r, 3, 6) * s;
          ctx.moveTo(px - 1.2, py);
          ctx.lineTo(px + sd * l, py - l * 0.7);
          ctx.lineTo(px + 1.2, py);
          ctx.closePath();
        }
      }
      ctx.fillStyle = body;
      ctx.fill();
      ctx.beginPath();
      for (const [a, b, c1, d, e, g] of stems) { ctx.moveTo(a - 0.8, b - 1); ctx.quadraticCurveTo(c1 - 0.8, d - 1, e - 0.8, g - 1); }
      ctx.strokeStyle = rgba(K.rim, 0.14);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else if (v < 0.55) {
      // Obsidiansplitter, schräg aus dem Boden
      ellipse(x + 8, base - 1, 22 * s, 3.5 * s, 0, rgba(DEEP, 0.4));
      const n = 2 + Math.floor(r() * 3), list = [];
      for (let k = 0; k < n; k++) list.push([x + (k - (n - 1) / 2) * 9 * s + R(r, -3, 3), R(r, 18, 46) * s * (k === 0 ? 1 : R(r, 0.5, 0.9)), R(r, 5, 9) * s, R(r, -0.45, 0.45)]);
      list.sort((a, b) => b[1] - a[1]);
      for (const [sx, hh, ww, tl] of list) {
        const tip = [sx + tl * hh, base - hh], ml = [sx - ww * 0.5 + tl * hh * 0.4, base - hh * 0.55], mid = [sx + tl * hh * 0.35 + ww * 0.1, base - hh * 0.4];
        poly([[sx - ww, base + 2], ml, tip, mid, [sx, base + 2]], lit);
        poly([[sx, base + 2], mid, tip, [sx + ww, base + 2]], dark);
        poly([mid, tip, [sx + ww * 0.6, base - hh * 0.3]], body);
        line(ml[0] + 0.5, ml[1], tip[0], tip[1] + 1.5, rgba(K.sheen, 0.4), 0.8);
      }
    } else if (v < 0.68) {
      // kleine leuchtende Kristallgruppe
      ellipse(x + 6, base - 1, 14 * s, 3 * s, 0, rgba(DEEP, 0.35));
      crystalCluster(x, base + 1, s * 0.85, C, K, r, 0.3);
    } else if (v < 0.86) {
      // totes Dornenbäumchen
      const hh = R(r, 46, 80) * s, lean = R(r, -10, 10) * s, w0 = 3.2 * s;
      ellipse(x + 8, base - 1, 18 * s, 3 * s, 0, rgba(DEEP, 0.4));
      poly([[x - w0 * 1.6, base + 2], [x - w0 * 0.5 + lean * 0.5, base - hh * 0.5], [x + lean, base - hh], [x + w0 * 0.4 + lean * 0.5, base - hh * 0.5], [x + w0 * 1.6, base + 2]], body);
      poly([[x - w0 * 1.6, base + 2], [x - w0 * 0.5 + lean * 0.5, base - hh * 0.5], [x + lean, base - hh], [x - w0 * 0.2 + lean * 0.5, base - hh * 0.5], [x - w0 * 0.3, base + 2]], lit);
      const br = [];
      for (let k = 0; k < 6; k++) {
        const t = R(r, 0.3, 0.9), bx = x + lean * t, by = base - hh * t, sd = k % 2 ? 1 : -1, l = R(r, 10, 22) * s * (1.1 - t * 0.5);
        const kx = bx + sd * l * 0.6, ky = by - l * R(r, 0.2, 0.5);
        br.push([bx, by, kx, ky], [kx, ky, kx + sd * l * 0.5, ky - l * R(r, 0.3, 0.7)]);
        if (r() < 0.5) br.push([kx, ky, kx + sd * l * 0.2, ky + l * 0.25]);
      }
      segs(br, body, 1.6 * s);
      segs(br.filter((_, k) => k % 3 === 0).map(([a, b, c1, d]) => [a - 0.6, b - 0.6, c1 - 0.6, d - 0.6]), rgba(K.rim, 0.14), 0.7);
    } else {
      // Felsbrocken, von einer Dornenranke umschlungen
      const rw = R(r, 12, 20) * s, rh = R(r, 9, 15) * s;
      ellipse(x + 6, base - 1, rw * 1.3, 3 * s, 0, rgba(DEEP, 0.4));
      const pts = [[x - rw, base + 2], [x - rw * 0.9, base - rh * 0.6], [x - rw * 0.3, base - rh], [x + rw * 0.5, base - rh * 0.85], [x + rw, base - rh * 0.3], [x + rw * 1.05, base + 2]];
      poly(pts, vgrad(base - rh, base, [[0, lit], [1, body]]));
      poly([[x + rw * 0.1, base - rh * 0.95], [x + rw * 0.5, base - rh * 0.85], [x + rw, base - rh * 0.3], [x + rw * 1.05, base + 2], [x + rw * 0.2, base + 2]], dark);
      line(x - rw * 0.85, base - rh * 0.62, x - rw * 0.3, base - rh + 0.6, rgba(K.rim, 0.25), 0.9);
      const vine = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; vine.push([x - rw * 1.1 + t * rw * 2.2, base - rh * (0.25 + 0.55 * Math.sin(t * Math.PI)) + Math.sin(t * 9) * 2]); }
      path(vine);
      ctx.strokeStyle = shade(body, -0.2);
      ctx.lineWidth = 1.4 * s;
      ctx.stroke();
      if (r() < 0.4) glowLines([crackFrom(x + R(r, -0.3, 0.3) * rw, base, -Math.PI / 2 + R(r, -0.4, 0.4), 3, rh * 0.25, 0.8, r)], C, 0.6, 0.8);
    }
  }

  // ============================================================
  // BODEN: Basaltplatten, glimmende Risse, Kristallsplitter an der Kante
  // ============================================================
  ART2.ground.shBasalt = (P, y, C, rng, band) => {
    const K = pal(C), top = mix(C.far, C.pipe, 0.32), deep = mix(C.near, DEEP, 0.4);
    band(vgrad(y, H, [[0, top], [0.35, mix(top, deep, 0.5)], [1, deep]]), y + 2, H - y);
    // Plattenfugen: senkrechte Brüche mit Knick, dazu zwei Lagerfugen
    const seams = [], lits = [];
    for (let x = rng() * 30; x < P; x += R(rng, 36, 84)) {
      let xx = x, yy = y + 6;
      while (yy < H) { const nx = xx + R(rng, -6, 6), ny = yy + R(rng, 8, 16); seams.push([xx, yy, nx, ny]); lits.push([xx + 1, yy, nx + 1, ny]); xx = nx; yy = ny; }
    }
    for (const yy of [y + 22, y + 40]) for (let x = 0; x < P; x += R(rng, 30, 70)) { const x1 = x + R(rng, 20, 50), y0 = yy + R(rng, -3, 3); seams.push([x, y0, x1, y0 + R(rng, -3, 3)]); lits.push([x, y0 + 1, x1, y0 + 1]); }
    segs(lits, rgba(K.rim, 0.05), 1);
    segs(seams, rgba(DEEP, 0.6), 1.4);
    // glimmende Risse, einige verzweigt
    const cracks = [];
    for (let k = 0; k < P / 100; k++) {
      const x0 = rng() * P, pts = crackFrom(x0, y + R(rng, 14, 36), R(rng, -0.3, 0.3) + (rng() < 0.5 ? 0 : Math.PI), 5 + Math.floor(rng() * 3), 9, 0.9, rng);
      for (const p of pts) p[1] = clamp(p[1], y + 10, H - 4);
      const sub = [pts];
      if (rng() < 0.5) { const p = pts[2]; sub.push(crackFrom(p[0], p[1], R(rng, 0.6, 2.5), 3, 7, 0.8, rng)); }
      const minX = Math.min(...sub.flat().map(p => p[0])), maxX = Math.max(...sub.flat().map(p => p[0]));
      wrapEach(minX, P, maxX - minX + 10, xx => {
        const d = xx - minX, moved = sub.map(s => s.map(([a, b]) => [a + d, b]));
        const m = moved[0][Math.floor(moved[0].length / 2)];
        ctx.fillStyle = rgrad(m[0], m[1], 0, 26, [[0, rgba(C.accent, 0.13)], [1, rgba(C.accent, 0)]]);
        ctx.fillRect(m[0] - 26, m[1] - 26, 52, 52);
        cracks.push(...moved);
      });
    }
    glowLines(cracks, C, 0.75, 0.85);
    // Kies
    const pb = [];
    for (let k = 0; k < P / 9; k++) pb.push([rng() * P, y + 8 + rng() * 46, 1 + rng() * 2.2, 0.7 + rng() * 1.2, 0]);
    ellipses(pb.map(([a, b, c, d]) => [a + 0.6, b + 0.6, c, d, 0]), rgba(DEEP, 0.5));
    ellipses(pb, mix(top, K.horizon, 0.15));
    // Kante: zerklüfteter Rand mit Obsidiansplittern, Licht von oben
    const lip = [];
    for (let x = -10; x <= P + 10; x += R(rng, 5, 12)) lip.push([x, y + R(rng, -1.5, 2.5)]);
    lip[lip.length - 1] = [P + 10, lip[0][1]];
    ctx.beginPath();
    ctx.moveTo(-10, y + 14);
    for (const [a, b] of lip) ctx.lineTo(a, b);
    ctx.lineTo(P + 10, y + 14);
    ctx.closePath();
    ctx.fillStyle = vgrad(y - 2, y + 14, [[0, mix(top, K.horizon, 0.35)], [1, rgba(top, 0)]]);
    ctx.fill();
    path(lip);
    ctx.strokeStyle = rgba(K.rim, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Splitter und Kristalle ragen über die Kante
    for (let k = 0; k < P / 34; k++) {
      const x = rng() * P, hh = R(rng, 4, 12), ww = R(rng, 3, 6), tl = R(rng, -0.5, 0.5), cr = rng() < 0.22, seed = (rng() * 1e6) | 0;
      wrapEach(x, P, 20, xx => {
        if (cr) { crystalCluster(xx, y + 3, 0.5, C, K, mulberry32(seed), 0.25); return; }
        const tip = [xx + tl * hh, y - hh];
        poly([[xx - ww, y + 3], tip, [xx, y + 3]], mix(top, K.horizon, 0.3));
        poly([[xx, y + 3], tip, [xx + ww, y + 3]], shade(top, -0.35));
      });
    }
    // dünner Nebel über der Kante
    for (let k = 0; k < P / 120; k++) {
      const x = rng() * P, rx = R(rng, 50, 110);
      wrapEach(x, P, rx, xx => soft(xx, y - 3, rx, 5, K.mist, 0.22));
    }
  };

  // ============================================================
  // SÄULEN: Obsidian mit Facetten, glasigen Reflexen, violett glimmenden Adern, Dornen an den Seiten
  // ============================================================
  ART2.pipeBody.shObsidian = (C, h, v, r) => {
    const K = pal(C), top = -12, bot = h + 40;
    // Facettengrenzen als geknickte Linien (muschelig gebrochenes Glas)
    const bl = [], br = [];
    for (let y = top; ; y += R(r, 36, 80)) { bl.push([R(r, 10, 18), Math.min(y, bot)]); br.push([R(r, 38, 46), Math.min(y, bot)]); if (y >= bot) break; }
    ctx.fillStyle = hgrad(0, PW, [[0, mix(K.obs, K.obsLit, 0.2)], [0.5, K.obs], [1, shade(K.obs, -0.15)]]);
    ctx.fillRect(0, top, PW, bot - top);
    poly([[0, top], ...bl, [0, bot]], hgrad(0, 18, [[0, mix(K.obsLit, CREAM, 0.16)], [0.3, K.obsLit], [1, mix(K.obsLit, K.obs, 0.4)]]));
    poly([[PW, top], ...br, [PW, bot]], hgrad(38, PW, [[0, K.obsDark], [1, shade(K.obsDark, -0.35)]]));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, PW, bot - top);
    ctx.clip();
    // Spiegelung des Himmels: schmales, kühles Band auf der Vorderfläche
    ctx.fillStyle = hgrad(20, 34, [[0, rgba(C.accent, 0)], [0.5, rgba(mix(C.accent, CREAM, 0.3), 0.07)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(20, top, 14, bot - top);
    // gestapelte Bruchplatten: schräge Bruchkanten, darunter ein Schattenkeil, darüber eine Glanzkante
    const fr = [], frLit = [];
    for (let y = R(r, 20, 70) + v * 35; y < h; y += R(r, 70, 125)) {
      const dy = R(r, -16, 22), mid = R(r, 20, 40), my = y + dy * 0.5 + R(r, -5, 5);
      const pts = [[0, y], [mid, my], [PW, y + dy]];
      fr.push(pts);
      frLit.push(pts.map(([a, b]) => [a, b + 1.6]));
      ctx.fillStyle = vgrad(Math.min(y, y + dy) - 1, Math.max(y, y + dy) + 10, [[0, rgba(DEEP, 0.35)], [1, rgba(DEEP, 0)]]);
      poly([[0, y], [mid, my], [PW, y + dy], [PW, y + dy + 9], [mid, my + 9], [0, y + 9]], ctx.fillStyle);
    }
    for (const [list, col, lw] of [[frLit, rgba(K.sheen, 0.22), 1], [fr, rgba(DEEP, 0.7), 1.3]]) {
      ctx.beginPath();
      for (const pts of list) pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    // glasige Reflexe: scharfe, schräge Glanzstreifen auf der Lichtfläche
    for (let k = 0; k < 4; k++) {
      const x = R(r, 2, 11), w2 = R(r, 1.2, 3.2), y0 = R(r, top, h * 0.8), len = R(r, 50, 180);
      poly([[x, y0], [x + w2, y0 - 3], [x + w2 + 1, y0 + len - 3], [x + 1, y0 + len]], rgba(CREAM, R(r, 0.08, 0.2)));
    }
    // Facettenkanten: scharfer Glanz links, dunkle Kante rechts
    path(bl);
    ctx.strokeStyle = rgba(K.sheen, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    path(br);
    ctx.strokeStyle = rgba(DEEP, 0.6);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // glimmende Adern: wandern längs, verzweigen sich, an den Gabeln ein heller Knoten
    const veins = [], nodes = [];
    for (let y0 = R(r, -30, 30) + v * 70; y0 < h; y0 += R(r, 120, 190)) {
      const pts = crackFrom(R(r, 16, 44), y0, Math.PI / 2 + R(r, -0.35, 0.35), 6 + Math.floor(r() * 4), 12, 1.1, r);
      for (const p of pts) p[0] = clamp(p[0], 4, PW - 5);
      veins.push(pts);
      for (let b = 0; b < 2; b++) {
        if (r() < 0.35) continue;
        const p = pts[2 + Math.floor(r() * (pts.length - 4))];
        veins.push(crackFrom(p[0], p[1], (r() < 0.5 ? 0.5 : Math.PI - 0.5) + R(r, -0.3, 0.3), 2 + Math.floor(r() * 2), 8, 0.8, r).map(([a, b2]) => [clamp(a, 3, PW - 4), b2]));
        nodes.push(p);
      }
      const m = pts[Math.floor(pts.length / 2)];
      ctx.fillStyle = rgrad(m[0], m[1], 0, 30, [[0, rgba(C.accent, 0.18)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(m[0] - 30, m[1] - 30, 60, 60);
    }
    glowLines(veins, C, 0.95, 0.9);
    ctx.beginPath();
    for (const [a, b] of nodes) { ctx.moveTo(a, b - 2.4); ctx.lineTo(a + 1.6, b); ctx.lineTo(a, b + 2.4); ctx.lineTo(a - 1.6, b); ctx.closePath(); }
    ctx.fillStyle = K.hot;
    ctx.fill();
    ctx.restore();
    // Außenkanten
    ctx.fillStyle = rgba(CREAM, 0.26);
    ctx.fillRect(0, top, 1.3, bot - top);
    ctx.fillStyle = rgba(DEEP, 0.55);
    ctx.fillRect(PW - 1.3, top, 1.3, bot - top);
    // Dornen an den Seiten, leicht nach oben gerichtet; links im Licht, rechts im Schatten mit Glanzkante
    for (let y = R(r, 20, 60) + v * 40, k = 0; y < h; y += R(r, 70, 120), k++) {
      for (const side of (r() < 0.4 ? [-1, 1] : [(k + v) % 2 ? 1 : -1])) {
        const ex = side < 0 ? 0.5 : PW - 0.5, l = R(r, 9, 13), tip = [ex + side * l, y - R(r, 4, 8)], hb = R(r, 4, 5.5);
        poly([[ex, y - hb], tip, [ex, y]], side < 0 ? mix(K.obsLit, CREAM, 0.12) : K.obs);
        poly([[ex, y], tip, [ex, y + hb]], side < 0 ? K.obs : K.obsDark);
        line(ex, y - hb + 0.4, tip[0], tip[1], rgba(K.sheen, side < 0 ? 0.55 : 0.25), 0.8);
      }
    }
  };

  ART2.pipeCap.shObsidian = (C, up) => {
    // up: Kappe der unteren Säule (Spalt oben bei y = 0), sonst Kappe der oberen Säule (Spalt bei y = PCH)
    const K = pal(C), x0 = -PCO, x1 = PW + PCO, away = up ? 1 : -1, r = mulberry32(up ? 2011 : 2012);
    const back = up ? PCH : 0;   // Kante zur Säule
    // Dornenkranz zur Säule hin (ragt über den Körper)
    const crown = [];
    for (let k = 0; k < 6; k++) {
      const x = x0 + 5 + k * (x1 - x0 - 10) / 5, l = R(r, 5, 9) * (k === 0 || k === 5 ? 1.2 : 1);
      crown.push([[x - 3.5, back - away * 2], [x + (k - 2.5) * 0.9, back + away * l], [x + 3.5, back - away * 2]]);
    }
    for (const [a, b, c] of crown) { poly([a, b, c], K.obs); poly([[(a[0] + c[0]) / 2, a[1]], b, c], K.obsDark); }
    // große Dornen an beiden Seiten, schräg vom Spalt weg
    for (const side of [-1, 1]) {
      const ex = side < 0 ? x0 + 2 : x1 - 2, ym = PCH / 2 + away * 2;
      for (const [len, dy, hb] of [[12, 7, 5.5], [7, -2, 3.5]]) {
        const tip = [ex + side * len, ym + away * dy];
        poly([[ex, ym - hb], tip, [ex, ym + hb]], side < 0 ? mix(K.obsLit, CREAM, 0.1) : K.obsDark);
        poly([[ex, ym + away * hb * 0.1], tip, [ex, ym + away * hb]], side < 0 ? K.obs : shade(K.obsDark, -0.3));
        line(ex, ym - away * hb * 0.8, tip[0], tip[1], rgba(K.sheen, side < 0 ? 0.5 : 0.2), 0.7);
      }
    }
    // Block mit abgeschrägten Ecken
    const ch = 3.5, pts = [[x0, ch], [x0 + ch, 0], [x1 - ch, 0], [x1, ch], [x1, PCH - ch], [x1 - ch, PCH], [x0 + ch, PCH], [x0, PCH - ch]];
    poly(pts, hgrad(x0, x1, [[0, mix(K.obsLit, CREAM, 0.14)], [0.2, K.obsLit], [0.24, K.obs], [0.66, K.obs], [0.7, K.obsDark], [1, shade(K.obsDark, -0.3)]]));
    ctx.save();
    path(pts, true);
    ctx.clip();
    // Fase zum Spalt: bei der unteren Säule oben im Licht, bei der oberen unten im Schatten
    ctx.fillStyle = up ? rgba(K.sheen, 0.16) : rgba(DEEP, 0.35);
    ctx.fillRect(x0, up ? 0 : PCH - 5, x1 - x0, 5);
    // Bruchkante quer durch den Block
    const fy = PCH / 2 - away * 3, frac = [[x0, fy + R(r, -2, 2)], [R(r, 18, 40), fy + R(r, -3, 3)], [x1, fy + R(r, -2, 2)]];
    path(frac.map(([a, b]) => [a, b + 1.4]));
    ctx.strokeStyle = rgba(K.sheen, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();
    path(frac);
    ctx.strokeStyle = rgba(DEEP, 0.6);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // glimmende Naht nahe der Spaltkante (auch im Dunkeln lesbar), Adern kriechen in den Block
    const sy = up ? 5.5 : PCH - 5.5, seam = [];
    for (let x = x0 + 1; x <= x1 - 1; x += 6) seam.push([x, sy + R(r, -0.8, 0.8)]);
    const legs = [];
    for (let k = 0; k < 4; k++) { const x = R(r, 6, PW - 6); legs.push([[x, sy], [x + R(r, -3, 3), sy + away * R(r, 4, 7)], [x + R(r, -4, 4), sy + away * R(r, 8, 13)]]); }
    ctx.fillStyle = vgrad(sy - 6, sy + 6, [[0, rgba(C.accent, 0)], [0.5, rgba(C.accent, 0.32)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x0, sy - 6, x1 - x0, 12);
    glowLines([seam, ...legs], C, 0.85, 1);
    ctx.restore();
    // helle Kante direkt am Spalt
    line(x0 + ch, up ? 0.8 : PCH - 0.8, x1 - ch, up ? 0.8 : PCH - 0.8, rgba(K.hot, 0.8), 1.2);
    path(pts, true);
    ctx.strokeStyle = rgba(DEEP, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // ============================================================
  // KULISSEN
  // ============================================================
  // ---------- ferne Spur (0.08): nah an den Himmelsfarben, Füße im Dunst ----------
  // Nadel mit Fenster (ferne Türme)
  function fWindow(x, y, C, K) {
    ctx.fillStyle = rgrad(x, y, 0, 6, [[0, rgba(C.accent, 0.4)], [1, rgba(C.accent, 0)]]);
    ctx.fillRect(x - 6, y - 6, 12, 12);
    ctx.fillStyle = rgba(K.rim, 0.65);
    ctx.fillRect(x - 0.7, y - 1.8, 1.4, 3.6);
  }
  function fFinish(w, h, K) {
    hazeOver(w, h, K.horizon, 0, 0.62, h * 0.45, h);
  }
  // Gruppe ferner Nadelberge
  function fRange(w, h, q, C) {
    const K = pal(C), gy = h + 4, n = 6 + Math.floor(q() * 4), list = [];
    for (let k = 0; k < n; k++) list.push([w * (0.1 + 0.8 * k / (n - 1)) + R(q, -12, 12), (h - 10) * (Math.abs(k - n / 2) < 1.2 ? R(q, 0.8, 1) : R(q, 0.3, 0.75)), R(q, 16, 34), R(q, -0.12, 0.12)]);
    list.sort((a, b) => b[1] - a[1]);
    for (const [x, hh, bw, ln] of list) {
      const e = horn(x, gy, bw, hh, ln * hh, K.fBody, K.fLit, K.fDark, 1.45, q, 0.3);
      if (hh > h * 0.6) { sideThorns(e.L, -1, 2, 7, K.fBody, q); sideThorns(e.Rr, 1, 2, 7, K.fDark, q); }
    }
    fFinish(w, h, K);
  }
  // Riesendorn: ein gewaltiger, gebogener Dorn mit Nebendornen
  function fColossus(w, h, q, C) {
    const K = pal(C), gy = h + 4, dir = q() < 0.5 ? -1 : 1, cx = w * (0.5 - dir * 0.18);
    horn(cx + dir * w * 0.3, gy, w * 0.1, h * 0.35, dir * w * 0.06, K.fBody, K.fLit, K.fDark, 1.3, q, 0.2);
    const e = horn(cx, gy, w * 0.2, h - 6, dir * w * 0.42, K.fBody, K.fLit, K.fDark, 1.25, q, 0.1);
    sideThorns(e.L, -1, 4, 10, K.fBody, q);
    sideThorns(e.Rr, 1, 4, 10, K.fDark, q);
    path(e.L.slice(1));
    ctx.strokeStyle = rgba(K.rim, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
    horn(cx - dir * w * 0.22, gy, w * 0.08, h * 0.26, -dir * w * 0.05, K.fBody, K.fLit, K.fDark, 1.3, q, 0.2);
    fFinish(w, h, K);
  }
  // ferne schwebende Felsinseln: dunkel vor dem Nachthimmel, nur die Oberkante im Mondlicht
  function fIsles(w, h, q, C) {
    const K = pal(C), n = 2 + Math.floor(q() * 2);
    for (let k = 0; k < n; k++) {
      const rw = R(q, 0.11, 0.17) * w * (k === 0 ? 1.3 : 1), cx = w * (0.2 + 0.6 * k / Math.max(1, n - 1)) + R(q, -15, 15), ty = h * R(q, 0.3, 0.5) - (k === 0 ? 10 : 0);
      const top = floatRock(cx, ty, rw, rw * R(q, 0.9, 1.25), q, K.fiBody, K.fiLit, K.fiDark, K.rim, 0.12, C, K, 0);
      if (q() < 0.7) {
        const p = top[2 + Math.floor(q() * 5)], e = horn(p[0], p[1] + 3, rw * 0.13, rw * R(q, 0.6, 1.1), R(q, -6, 6), K.fiBody, K.fiLit, K.fiDark, 1.5, q, 0.2);
        if (q() < 0.5) fWindow(e.L[3][0] + rw * 0.08, e.L[3][1] + 2, C, K);
      }
      soft(cx, ty + rw * 1.1, rw * 0.4, 8, C.accent, 0.08);
    }
  }
  // Zitadellenturm: leicht verjüngter Schaft, Zinnenkranz aus Dornen, hohes Spitzdach, schmale Fenster
  function citTower(x, gy, tw, th, q, C, K, windows) {
    const top = gy - th, sh = top + th * 0.36, lw = tw * 1.3;
    poly([[x - tw, gy], [x - tw * 0.88, sh], [x + tw * 0.88, sh], [x + tw, gy]], K.fBody);
    poly([[x - tw, gy], [x - tw * 0.88, sh], [x - tw * 0.32, sh], [x - tw * 0.36, gy]], K.fLit);
    poly([[x + tw * 0.45, gy], [x + tw * 0.4, sh], [x + tw * 0.88, sh], [x + tw, gy]], K.fDark);
    // Kragen mit Dornenzinnen
    poly([[x - tw * 0.88, sh + 6], [x - lw, sh - 1], [x + lw, sh - 1], [x + tw * 0.88, sh + 6]], K.fBody);
    poly([[x - tw * 0.88, sh + 6], [x - lw, sh - 1], [x - lw * 0.35, sh - 1], [x - tw * 0.3, sh + 6]], K.fLit);
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { const mx = x - lw + (k + 0.5) * lw * 0.4; ctx.moveTo(mx - lw * 0.12, sh - 1); ctx.lineTo(mx + (k - 2) * 0.6, sh - 1 - R(q, 5, 9)); ctx.lineTo(mx + lw * 0.12, sh - 1); ctx.closePath(); }
    ctx.fillStyle = K.fBody;
    ctx.fill();
    // Spitzdach, leicht hohl geschwungen
    const e = horn(x, sh - 2, tw * 0.95, th * 0.64, R(q, -2, 2), K.fBody, K.fLit, K.fDark, 1.7, q, 0);
    sideThorns(e.L, -1, 1, tw * 0.6, K.fBody, q);
    sideThorns(e.Rr, 1, 1, tw * 0.6, K.fDark, q);
    for (let k = 0; k < windows; k++) fWindow(x + R(q, -0.35, 0.35) * tw, sh + (gy - sh) * R(q, 0.12, 0.55), C, K);
  }
  function fCitadel(w, h, q, C, part) {
    const K = pal(C), gy = h + 4;
    if (part === 'keep') {
      const cx = w * 0.5;
      // Nebentürme und Brücken zum Bergfried
      citTower(w * 0.16, gy, w * 0.055, h * 0.52, q, C, K, 1);
      citTower(w * 0.84, gy, w * 0.055, h * 0.58, q, C, K, 1);
      for (const [x0, x1, y] of [[w * 0.18, cx - w * 0.15, gy - h * 0.34], [cx + w * 0.15, w * 0.82, gy - h * 0.38]]) {
        ctx.beginPath();
        ctx.moveTo(x0, y - 6);
        ctx.lineTo(x1, y - 6);
        ctx.lineTo(x1, y + 2);
        ctx.quadraticCurveTo((x0 + x1) / 2, y - 3, x0, y + 2);
        ctx.closePath();
        ctx.fillStyle = K.fDark;
        ctx.fill();
      }
      // Sockel und Bergfried
      poly([[w * 0.1, gy], [w * 0.14, gy - h * 0.22], [w * 0.86, gy - h * 0.22], [w * 0.9, gy]], K.fBody);
      poly([[w * 0.1, gy], [w * 0.14, gy - h * 0.22], [w * 0.3, gy - h * 0.22], [w * 0.28, gy]], K.fLit);
      const kw = w * 0.15, kt = gy - h * 0.62;
      poly([[cx - kw, gy], [cx - kw * 0.85, kt], [cx + kw * 0.85, kt], [cx + kw, gy]], K.fBody);
      poly([[cx - kw, gy], [cx - kw * 0.85, kt], [cx - kw * 0.3, kt], [cx - kw * 0.34, gy]], K.fLit);
      poly([[cx + kw * 0.42, gy], [cx + kw * 0.38, kt], [cx + kw * 0.85, kt], [cx + kw, gy]], K.fDark);
      // Krone des Bergfrieds: vier Spitzen und die hohe Mittelnadel
      for (const [dx, hh] of [[-0.7, 0.13], [0.7, 0.14], [-0.35, 0.2], [0.35, 0.21]]) horn(cx + dx * kw, kt + 2, kw * 0.22, h * hh, dx * 6, K.fBody, K.fLit, K.fDark, 1.5, q, 0);
      const e = horn(cx, kt + 2, kw * 0.36, h * 0.37, 0, K.fBody, K.fLit, K.fDark, 1.6, q, 0);
      sideThorns(e.L, -1, 2, 8, K.fBody, q);
      sideThorns(e.Rr, 1, 2, 8, K.fDark, q);
      // Tor mit kaltem Schein, Fensterreihen
      const gw = w * 0.05, gt = gy - h * 0.17;
      soft(cx, gy - h * 0.06, gw * 3.6, h * 0.14, C.accent, 0.38);
      ctx.beginPath();
      ctx.moveTo(cx - gw, gy);
      ctx.lineTo(cx - gw, gt + gw);
      ctx.lineTo(cx, gt - gw * 0.5);
      ctx.lineTo(cx + gw, gt + gw);
      ctx.lineTo(cx + gw, gy);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(C.accent, K.fBody, 0.45), 0.9);
      ctx.fill();
      for (let k = 0; k < 3; k++) fWindow(cx + (k - 1) * kw * 0.5, gy - h * 0.42, C, K);
      for (let k = 0; k < 2; k++) fWindow(cx + (k - 0.5) * kw * 0.6, gy - h * 0.53, C, K);
      for (let k = 0; k < 4; k++) fWindow(cx + (k - 1.5) * kw * 0.42, gy - h * 0.3, C, K);
      // kalter Schein um die Spitze des Bergfrieds
      soft(cx, kt - h * 0.12, kw * 0.9, h * 0.2, C.accent, 0.1);
    } else {
      // Flügel: Mauer mit Dornenzinnen, zum Bergfried hin ansteigend, zwei bis drei Türme
      const left = part === 'wingL', wallTop = gy - h * R(q, 0.26, 0.32);
      ctx.beginPath();
      ctx.moveTo(-2, gy);
      for (let x = -2; x <= w + 2; x += 8) {
        const t = left ? x / w : 1 - x / w, y = wallTop + 26 * (1 - t);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 4, y - (Math.floor(x / 8) % 3 === 0 ? 9 : 5));
      }
      ctx.lineTo(w + 2, gy);
      ctx.closePath();
      ctx.fillStyle = vgrad(wallTop - 8, gy, [[0, K.fLit], [0.15, K.fBody], [1, K.fBody]]);
      ctx.fill();
      const n = 2 + Math.floor(q() * 2);
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), x = w * (0.14 + 0.72 * t) + R(q, -8, 8), grow = left ? 0.7 + 0.3 * t : 1 - 0.3 * t;
        citTower(x, gy, w * R(q, 0.04, 0.052), h * R(q, 0.7, 0.9) * grow, q, C, K, q() < 0.7 ? 1 : 0);
      }
      for (let k = 0; k < 3; k++) fWindow(R(q, 0.1, 0.9) * w, wallTop + R(q, 16, 34), C, K);
    }
    fFinish(w, h, K);
  }
  // fernes Dornentor: zwei Riesendornen, die sich oben kreuzen
  function fArch(w, h, q, C) {
    const K = pal(C), gy = h + 4;
    soft(w * 0.5, gy - h * 0.3, w * 0.2, h * 0.3, C.accent, 0.12);
    const a = horn(w * 0.2, gy, w * 0.1, h - 8, w * 0.48, K.fBody, K.fLit, K.fDark, 1.05, q, 0.1);
    const b = horn(w * 0.8, gy, w * 0.1, h * 0.88, -w * 0.46, K.fBody, K.fLit, K.fDark, 1.05, q, 0.1);
    sideThorns(a.L, -1, 4, 9, K.fBody, q);
    sideThorns(b.Rr, 1, 4, 9, K.fDark, q);
    horn(w * 0.08, gy, w * 0.05, h * 0.3, -6, K.fBody, K.fLit, K.fDark, 1.3, q, 0.2);
    horn(w * 0.92, gy, w * 0.05, h * 0.36, 8, K.fBody, K.fLit, K.fDark, 1.3, q, 0.2);
    fFinish(w, h, K);
  }

  // ---------- mittlere Spur (0.3) ----------
  // Schwebender Fels: zerklüftete Oberseite, umgekehrter Kegel mit Schichten, Kristalle an der Spitze.
  // Liefert die Oberkante (Punkte von links nach rechts).
  function floatRock(cx, ty, rw, depth, q, body, lit, dark, rim, rimA, C, K, crys) {
    const top = [];
    for (let k = 0; k <= 8; k++) top.push([cx - rw + 2 * rw * k / 8 + (k && k < 8 ? R(q, -3, 3) : 0), ty + (k === 0 || k === 8 ? 3 : R(q, -4, 2))]);
    const tip = [cx + R(q, -0.18, 0.18) * rw, ty + depth], rs = [], ls = [];
    for (let k = 1; k < 6; k++) { const t = k / 6; rs.push([lerp(cx + rw, tip[0], t) + R(q, -0.08, 0.1) * rw * (1 - t) + rw * 0.12 * Math.sin(t * Math.PI), ty + depth * Math.pow(t, 0.8) + R(q, -3, 3)]); }
    for (let k = 5; k >= 1; k--) { const t = k / 6; ls.push([lerp(cx - rw, tip[0], t) - R(q, -0.08, 0.1) * rw * (1 - t) - rw * 0.12 * Math.sin(t * Math.PI), ty + depth * Math.pow(t, 0.8) + R(q, -3, 3)]); }
    const outline = top.concat(rs, [tip], ls);
    if (crys) soft(tip[0], tip[1] + 6, rw * 0.55, 18, C.accent, 0.2 * crys);
    poly(outline, vgrad(ty, ty + depth, [[0, lit], [0.18, body], [1, dark]]));
    // Schattenhälfte rechts unten, Schichtlinien
    const mid = [cx + rw * 0.15, ty + 5];
    poly([mid, ...rs.slice(0, 5), tip], rgba(dark, 0.7));
    ctx.save();
    path(outline, true);
    ctx.clip();
    const st = [];
    for (let k = 1; k <= 4; k++) { const y = ty + depth * k * 0.19, f = 1 - Math.pow(k * 0.19, 0.9); st.push([cx - rw * f, y, cx + rw * f, y + R(q, -3, 3)]); }
    segs(st, rgba(DEEP, 0.3), 1);
    // Oberseite als helleres Band
    ctx.beginPath();
    top.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    for (let k = top.length - 1; k >= 0; k--) ctx.lineTo(top[k][0], top[k][1] + 6);
    ctx.closePath();
    ctx.fillStyle = rgba(lit, 0.8);
    ctx.fill();
    ctx.restore();
    if (rimA) {
      path(top.slice(0, 6));
      ctx.strokeStyle = rgba(rim, rimA);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    if (crys) {
      crystalCluster(tip[0], tip[1] - 6, 0.75 * crys, C, K, q, 0, true);
      for (let k = 0; k < 2; k++) { const p = ls[1 + Math.floor(q() * 3)]; crystal(p[0] + 3, p[1] - 2, -R(q, 6, 11), 4, R(q, -0.3, 0.1), C, K, 0.35); }
    }
    return top;
  }
  // kleine Brocken neben einem Fels
  function debris(list, body, dark) {
    for (const [x, y, s] of list) {
      poly([[x - s, y - s * 0.3], [x - s * 0.2, y - s * 0.8], [x + s, y - s * 0.4], [x + s * 0.3, y + s * 0.9]], body);
      poly([[x + s, y - s * 0.4], [x + s * 0.3, y + s * 0.9], [x - s * 0.1, y + s * 0.1]], dark);
    }
  }
  function mRock(w, h, q, C) {
    const K = pal(C), rw = w * R(q, 0.34, 0.4), cx = w * 0.5, ty = h * R(q, 0.34, 0.42), depth = h - 34 - ty;
    const top = floatRock(cx, ty, rw, depth, q, K.m, K.mLit, K.mDark, K.rim, 0.32, C, K, 1);
    // Dornen oder Säulenstumpf obenauf
    const n = 2 + Math.floor(q() * 3);
    for (let k = 0; k < n; k++) {
      const p = top[1 + Math.floor(q() * 7)], hh = (ty - 8) * R(q, 0.3, 0.95), e = horn(p[0], p[1] + 4, R(q, 4, 9), hh, R(q, -0.3, 0.3) * hh, K.m, K.mLit, K.mDark, 1.3, q, 0.15);
      path(e.L.slice(1));
      ctx.strokeStyle = rgba(K.rim, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    debris([[cx - rw * 1.05, ty + depth * 0.55, R(q, 4, 7)], [cx + rw * 1.1, ty + depth * 0.3, R(q, 3, 6)], [cx + rw * 0.7, ty + depth * 1.02, R(q, 3, 5)]], K.m, K.mDark);
  }
  // Größere Insel mit schiefem Turm
  function mIsle(w, h, q, C) {
    const K = pal(C), rw = w * 0.42, cx = w * 0.5, ty = h * 0.56, depth = h - 30 - ty;
    const top = floatRock(cx, ty, rw, depth, q, K.m, K.mLit, K.mDark, K.rim, 0.32, C, K, 1.2);
    const tx = cx + R(q, -0.25, 0.15) * rw, tw = R(q, 13, 18), th = ty - 26, lean = R(q, -0.08, 0.08);
    crookedTower(tx, ty + 4, tw, th, lean, q, C, K);
    for (let k = 0; k < 2; k++) { const p = top[k ? 7 : 1]; horn(p[0], p[1] + 4, 5, R(q, 18, 34), R(q, -8, 8), K.m, K.mLit, K.mDark, 1.3, q, 0.1); }
    debris([[cx - rw * 1.08, ty + depth * 0.4, R(q, 4, 7)], [cx + rw * 1.08, ty + depth * 0.6, R(q, 4, 6)]], K.m, K.mDark);
  }
  // Schiefer Turm mit Spitzdach, Dornenkranz und schmalen, kalt leuchtenden Fenstern
  function crookedTower(x, gy, tw, th, lean, q, C, K) {
    const n = 6, Lp = [], Rp = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, cx = x + lean * th * t + Math.sin(t * 2.6) * tw * 0.25, hw = tw * (1 - t * 0.28);
      Lp.push([cx - hw, gy - th * 0.72 * t]);
      Rp.push([cx + hw, gy - th * 0.72 * t]);
    }
    const roofY = gy - th * 0.72, rc = Lp[n][0] + (Rp[n][0] - Lp[n][0]) / 2;
    poly(Lp.concat(Rp.slice().reverse()), K.m);
    poly(Lp.concat(Lp.map(([a, b], k) => [a + (Rp[k][0] - a) * 0.3, b]).reverse()), K.mLit);
    poly(Rp.map(([a, b], k) => [a - (a - Lp[k][0]) * 0.3, b]).concat(Rp.slice().reverse()), K.mDark);
    // Steinlagen
    const seams = [];
    for (let k = 1; k < n; k++) seams.push([Lp[k][0], Lp[k][1], Rp[k][0], Rp[k][1]]);
    segs(seams, rgba(DEEP, 0.25), 0.8);
    // Kranz aus Dornen unter dem Dach
    const crown = [];
    for (let k = 0; k < 5; k++) { const x0 = Lp[n][0] - 3 + (Rp[n][0] - Lp[n][0] + 6) * k / 4; crown.push([[x0 - 2.5, roofY + 3], [x0 + (k - 2) * 2.5, roofY - R(q, 6, 10)], [x0 + 2.5, roofY + 3]]); }
    ctx.beginPath();
    crown.forEach(subPath);
    ctx.fillStyle = K.mDark;
    ctx.fill();
    const e = horn(rc, roofY + 2, tw * 1.05, th * 0.3, lean * th * 0.4 + R(q, -4, 4), K.m, K.mLit, K.mDark, 1.4, q, 0);
    path(e.L);
    ctx.strokeStyle = rgba(K.rim, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();
    path(Lp);
    ctx.stroke();
    // Fenster
    for (let k = 0, nw = 1 + Math.floor(q() * 3); k < nw; k++) {
      const t = R(q, 0.25, 0.8), j = Math.floor(t * n), wx = lerp(Lp[j][0], Rp[j][0], R(q, 0.35, 0.6)), wy = gy - th * 0.72 * t;
      ctx.fillStyle = rgrad(wx, wy, 0, 10, [[0, rgba(C.accent, 0.4)], [1, rgba(C.accent, 0)]]);
      ctx.fillRect(wx - 10, wy - 10, 20, 20);
      ctx.beginPath();
      ctx.moveTo(wx - 1.6, wy + 4);
      ctx.lineTo(wx - 1.6, wy - 2);
      ctx.lineTo(wx, wy - 4.5);
      ctx.lineTo(wx + 1.6, wy - 2);
      ctx.lineTo(wx + 1.6, wy + 4);
      ctx.closePath();
      ctx.fillStyle = K.crysLit;
      ctx.fill();
    }
  }
  // Boden unter den stehenden Motiven (läuft hinter den Dornenkamm der Ebene 1)
  function mMound(w, h, gy, q, K) {
    const pts = [[-2, h + 2]];
    for (let x = 0; x <= w; x += w / 10) pts.push([x, gy + Math.sin(Math.PI * x / w) * -8 + R(q, -2, 2) + (x === 0 || x >= w - 0.1 ? 10 : 0)]);
    pts.push([w + 2, h + 2]);
    poly(pts, vgrad(gy - 8, h, [[0, K.mLit], [0.2, K.m], [1, K.mDark]]));
  }
  function mSpire(w, h, q, C) {
    const K = pal(C), gy = h - 36;
    // Stützdornen am Fuß
    horn(w * 0.22, gy + 6, w * 0.1, h * 0.18, -w * 0.12, K.m, K.mLit, K.mDark, 1.2, q, 0.1);
    horn(w * 0.8, gy + 6, w * 0.1, h * 0.22, w * 0.12, K.m, K.mLit, K.mDark, 1.2, q, 0.1);
    crookedTower(w * 0.5, gy + 4, w * R(q, 0.15, 0.19), h * 0.95, R(q, -0.07, 0.07), q, C, K);
    mMound(w, h, gy, q, K);
  }
  // Obsidian-Monolithe mit leuchtenden Rinnen (abstrakte Muster, keine Schrift)
  function mMonolith(w, h, q, C) {
    const K = pal(C), gy = h - 34, n = 2 + Math.floor(q() * 3), list = [];
    for (let k = 0; k < n; k++) list.push([w * (0.2 + 0.6 * (n === 1 ? 0.5 : k / (n - 1))) + R(q, -8, 8), (gy - 6) * (k === Math.floor(n / 2) ? R(q, 0.85, 1) : R(q, 0.45, 0.75)), R(q, 12, 20), R(q, -0.12, 0.12)]);
    list.sort((a, b) => b[1] - a[1]);
    const obs = mix(K.m, INK, 0.2);
    for (const [x, hh, bw, tl] of list) {
      const top = gy - hh, tx = x + tl * hh;
      const pts = [[x - bw, gy + 4], [tx - bw * 0.75, top + bw * 0.6], [tx - bw * 0.1, top], [tx + bw * 0.7, top + bw * 0.4], [x + bw, gy + 4]];
      poly(pts, obs);
      poly([pts[0], pts[1], pts[2], [tx - bw * 0.25, top + 6], [x - bw * 0.35, gy + 4]], mix(obs, K.horizon, 0.35));
      poly([[x + bw * 0.45, gy + 4], [tx + bw * 0.3, top + 8], pts[3], pts[4]], shade(obs, -0.45));
      line(pts[1][0] + 0.6, pts[1][1], pts[2][0] + 0.3, pts[2][1] + 1, rgba(K.sheen, 0.4), 0.9);
      // Rinnen: senkrechte Linie mit Querstrichen und Punkten
      const gl = [], gx = tx * 0.6 + x * 0.4 - bw * 0.05;
      let y = top + 14;
      const spine = [[gx, y]];
      while (y < gy - 16) { y += R(q, 8, 14); spine.push([gx + (x - tx) * (y - top) / hh * 0.6 + R(q, -1, 1), y]); }
      gl.push(spine);
      for (let k = 1; k < spine.length - 1; k += 2) { const [a, b] = spine[k], s = q() < 0.5 ? -1 : 1; gl.push([[a, b], [a + s * bw * 0.35, b + R(q, -3, 3)]]); }
      soft(gx, (top + gy) / 2, bw * 1.6, hh * 0.45, C.accent, 0.12);
      glowLines(gl, C, 0.6, 0.85);
    }
    mMound(w, h, gy, q, K);
  }
  // Dornentor: zwei gewaltige Dornen bilden einen Bogen, dahinter kalter Schein
  function mArch(w, h, q, C) {
    const K = pal(C), gy = h - 32;
    soft(w * 0.5, gy - h * 0.25, w * 0.24, h * 0.32, C.accent, 0.2);
    soft(w * 0.5, gy - h * 0.1, w * 0.12, h * 0.16, K.crysLit, 0.12);
    const a = horn(w * 0.18, gy + 4, w * 0.09, h * 0.92, w * 0.5, K.m, K.mLit, K.mDark, 1.05, q, 0.12);
    const b = horn(w * 0.84, gy + 4, w * 0.08, h * 0.8, -w * 0.46, K.m, K.mLit, K.mDark, 1.05, q, 0.12);
    for (const e of [a, b]) { sideThorns(e.L, -1, 5, 9, K.m, q); sideThorns(e.Rr, 1, 5, 9, K.mDark, q); }
    path(a.L.slice(1));
    ctx.strokeStyle = rgba(K.rim, 0.3);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    horn(w * 0.06, gy + 4, w * 0.04, h * 0.3, -8, K.m, K.mLit, K.mDark, 1.3, q, 0.2);
    horn(w * 0.95, gy + 4, w * 0.04, h * 0.24, 6, K.m, K.mLit, K.mDark, 1.3, q, 0.2);
    crystalCluster(w * 0.5, gy + 2, 0.8, C, K, q, 0.25);
    mMound(w, h, gy, q, K);
  }
  // Toter Dornenbaum: knorriger Stamm, verzweigte Äste mit spitzen Enden
  function mTree(w, h, q, C) {
    const K = pal(C), gy = h - 34, x = w * R(q, 0.42, 0.58), bw = R(q, 7, 10), hh = (gy - 10) * R(q, 0.55, 0.7), lean = R(q, -0.1, 0.1) * hh;
    const e = horn(x, gy + 6, bw * 2.2, hh, lean, K.m, K.mLit, K.mDark, 0.7, q, 0.15);
    path(e.L.slice(1));
    ctx.strokeStyle = rgba(K.rim, 0.25);
    ctx.lineWidth = 1;
    ctx.stroke();
    const segsList = [];
    const grow = (x0, y0, ang, len, wd, d) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      segsList.push([x0, y0, x1, y1, wd]);
      if (d <= 0 || len < 8) return;
      const n = q() < 0.35 ? 3 : 2;
      for (let k = 0; k < n; k++) grow(x1, y1, ang + (k - (n - 1) / 2) * R(q, 0.5, 0.9) + R(q, -0.2, 0.2), len * R(q, 0.55, 0.75), wd * 0.62, d - 1);
    };
    const tx = x + lean, ty = gy + 6 - hh;
    for (let k = 0; k < 3; k++) grow(tx, ty + 6, -Math.PI / 2 + (k - 1) * 0.7 + R(q, -0.2, 0.2), R(q, 34, 52), bw * 0.8, 3);
    for (let k = 0; k < 2; k++) { const t = R(q, 0.35, 0.6), s = k ? 1 : -1; grow(x + lean * t, gy + 6 - hh * t, -Math.PI / 2 + s * R(q, 0.9, 1.3), R(q, 26, 40), bw * 0.6, 2); }
    // nach Stärke gebündelt zeichnen
    for (const [lo, hi] of [[3.5, 99], [1.8, 3.5], [0, 1.8]]) {
      const sel = segsList.filter(s => s[4] >= lo && s[4] < hi);
      if (!sel.length) continue;
      segs(sel, K.m, Math.max(1.2, (lo + Math.min(hi, 7)) / 2));
    }
    segs(segsList.filter(s => s[4] >= 1.8).map(([a, b, c1, d]) => [a - 0.7, b - 0.7, c1 - 0.7, d - 0.7]), rgba(K.rim, 0.12), 0.8);
    // Dornen an den Ästen
    ctx.beginPath();
    for (const [a, b, c1, d, wd] of segsList) {
      if (wd > 4 || q() < 0.4) continue;
      const t = R(q, 0.3, 0.8), px = lerp(a, c1, t), py = lerp(b, d, t), s = q() < 0.5 ? -1 : 1, l = R(q, 3, 6);
      ctx.moveTo(px - 1, py);
      ctx.lineTo(px + s * l, py - l);
      ctx.lineTo(px + 1, py);
      ctx.closePath();
    }
    ctx.fillStyle = K.m;
    ctx.fill();
    mMound(w, h, gy, q, K);
  }
  // Mauerstück der Zitadelle mit Dornenzinnen und einem leuchtenden Spalttor
  function mWall(w, h, q, C) {
    const K = pal(C), gy = h - 32, top = gy - (gy - 20) * R(q, 0.5, 0.65), broken = q() < 0.5;
    const pts = [[-2, gy + 6], [-2, top + 18]];
    for (let x = 0; x <= w; x += 12) {
      const drop = broken && x > w * 0.62 ? (x - w * 0.62) * 0.6 : 0;
      pts.push([x, top + drop + 4], [x + 3, top + drop - R(q, 6, 12)], [x + 6, top + drop + 4]);
    }
    pts.push([w + 2, gy + 6]);
    poly(pts, vgrad(top - 10, gy, [[0, K.mLit], [0.12, K.m], [1, K.mDark]]));
    // Quader
    const bricks = [];
    for (let y = top + 16, row = 0; y < gy; y += 14, row++) for (let x = (row % 2) * 13 - 4; x < w; x += 26) bricks.push([x, y, x + 26, y], [x, y, x, y + 14]);
    ctx.save();
    path(pts, true);
    ctx.clip();
    segs(bricks, rgba(DEEP, 0.28), 1);
    segs(bricks.filter((_, k) => k % 2 === 0).map(([a, b, c1, d]) => [a, b + 1, c1, d + 1]), rgba(K.rim, 0.05), 1);
    // Spalttor
    const gx = w * R(q, 0.3, 0.5), gw = R(q, 12, 18), gt = gy - (gy - top) * 0.6;
    soft(gx, gy - 6, gw * 2.6, (gy - gt) * 0.8, C.accent, 0.3);
    ctx.beginPath();
    ctx.moveTo(gx - gw, gy + 6);
    ctx.lineTo(gx - gw, gt + gw * 0.6);
    ctx.lineTo(gx, gt - gw * 0.5);
    ctx.lineTo(gx + gw, gt + gw * 0.6);
    ctx.lineTo(gx + gw, gy + 6);
    ctx.closePath();
    ctx.fillStyle = vgrad(gt, gy, [[0, mix(C.accent, K.m, 0.6)], [1, mix(C.accent, K.m, 0.35)]]);
    ctx.fill();
    ctx.restore();
    ridgeShadow(pts, K);
    // Risse mit Glut
    if (q() < 0.7) glowLines([crackFrom(w * R(q, 0.6, 0.85), gy, -Math.PI / 2 + R(q, -0.3, 0.3), 4, 12, 0.9, q)], C, 0.7, 0.75);
    mMound(w, h, gy + 4, q, K);
  }
  function ridgeShadow(pts, K) {
    path(pts.slice(1, -1));
    ctx.strokeStyle = rgba(K.rim, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ---------- Spuren ----------
  const kind = (size, paint, tex) => ({ size, paint, tex });
  const FAR_KINDS = {
    range: kind(q => [R(q, 280, 350), R(q, 210, 290)], (w, h, q, C) => fRange(w, h, q, C), { grain: 0.03 }),
    colossus: kind(q => [R(q, 170, 230), R(q, 290, 350)], (w, h, q, C) => fColossus(w, h, q, C), { grain: 0.03 }),
    isles: kind(q => [R(q, 260, 340), R(q, 170, 220)], (w, h, q, C) => fIsles(w, h, q, C), { grain: 0.03 }),
    wingL: kind(q => [R(q, 290, 340), R(q, 220, 260)], (w, h, q, C) => fCitadel(w, h, q, C, 'wingL'), { grain: 0.03 }),
    keep: kind(() => [320, 360], (w, h, q, C) => fCitadel(w, h, q, C, 'keep'), { grain: 0.03 }),
    wingR: kind(q => [R(q, 290, 340), R(q, 230, 270)], (w, h, q, C) => fCitadel(w, h, q, C, 'wingR'), { grain: 0.03 }),
    arch: kind(q => [R(q, 290, 350), R(q, 240, 300)], (w, h, q, C) => fArch(w, h, q, C), { grain: 0.03 })
  };
  const MID_KINDS = {
    tree: kind(q => [R(q, 150, 210), R(q, 220, 280)], (w, h, q, C) => mTree(w, h, q, C), { grain: 0.045 }),
    monolith: kind(q => [R(q, 130, 200), R(q, 170, 240)], (w, h, q, C) => mMonolith(w, h, q, C), { grain: 0.045 }),
    rock: kind(q => [R(q, 150, 230), R(q, 180, 240)], (w, h, q, C) => mRock(w, h, q, C), { grain: 0.045 }),
    isle: kind(q => [R(q, 200, 260), R(q, 300, 350)], (w, h, q, C) => mIsle(w, h, q, C), { grain: 0.045 }),
    spire: kind(q => [R(q, 100, 140), R(q, 280, 340)], (w, h, q, C) => mSpire(w, h, q, C), { grain: 0.045 }),
    arch: kind(q => [R(q, 230, 310), R(q, 220, 290)], (w, h, q, C) => mArch(w, h, q, C), { grain: 0.045 }),
    wall: kind(q => [R(q, 260, 340), R(q, 170, 230)], (w, h, q, C) => mWall(w, h, q, C), { grain: 0.045 })
  };
  for (const set of [FAR_KINDS, MID_KINDS]) for (const K of Object.values(set)) isolate(K);
  const BASE = GROUND_Y + 4;

  // Ablauf (50 Rohre sind etwa 11 500 px Kamera-x, danach der lange Ansturm bei voller Sicht):
  // hinten (0.08) Nadelberge und Riesendorn, gegen Ende der Röhrenphase die Zitadelle
  // (Flügel, Bergfried, Flügel), die beim Ansturm den Horizont füllt, danach Tore, Inseln, Berge;
  // mittig (0.3) erst totes Grenzland, gegen Ende Mauern, im Ansturm schwebende Felsen, Inseln, Tore.
  SCENE['Schattenreich'] = {
    tracks: [
      {
        z: 0, factor: 0.08, start: -60, gap: [-50, 10], maxKs: 1.5, kinds: FAR_KINDS,
        base: (i, q, k) => (k === 'isles' ? Math.round(R(q, 330, 380)) : BASE + 6),
        pick: flow(['range', 'colossus', 'range', 'isles', 'wingL', 'keep', 'wingR', 'range', 'arch', 'isles', 'colossus'],
          [['range', 2], ['colossus', 1.2], ['isles', 1.2], ['arch', 1]], 1)
      },
      {
        z: 1, factor: 0.3, start: 60, gap: [50, 190], maxKs: 2, kinds: MID_KINDS,
        base: (i, q, k) => (k === 'rock' ? Math.round(R(q, 330, 420)) : k === 'isle' ? Math.round(R(q, 410, 440)) : BASE),
        pick: flow(['tree', 'monolith', 'tree', 'spire', 'rock', 'monolith', 'tree', 'arch', 'wall', 'spire', 'wall', 'rock', 'isle', 'arch', 'rock'],
          [['rock', 2.2], ['isle', 1.3], ['arch', 1], ['spire', 1.1], ['monolith', 1], ['wall', 0.8], ['tree', 0.7]], 2)
      }
    ]
  };

  // ============================================================
  // Level-Zuordnung (nur Darstellung)
  // ============================================================
  const L20 = LEVELS.find(L => L.name === 'Schattenreich');
  if (L20) {
    Object.assign(L20, {
      sky: { body: 'none', extra: 'shShadow' },
      layers: [
        { kind: 'shFar', P: 1000, seed: 2011 },
        { kind: 'shThorns', P: 1200, seed: 2012 },
        { kind: 'props', P: 1400, prop: 'shBramble', spacing: 50, seed: 2013 }
      ]
    });
    L20.style.pipe = 'shObsidian';
    L20.style.ground = 'shBasalt';
  }
})();
