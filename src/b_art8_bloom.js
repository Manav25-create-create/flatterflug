// ============================================================
// Kunst für Blütenhain (Level 1) und Lagune (Level 4): Himmel, Ebenen,
// Kulissen, Säulen, Boden, Bosse (Blütenmotte, Lagunenkrabbe) und Geschosse
// (Blütenblatt, Muschel). Alles steckt in einer IIFE; nach außen gehen nur
// Einträge in ART2 und SCENE sowie die Darstellungsfelder der beiden Level.
// Blütenhain ist das freundlichste Level: Pastell, runde Formen, wenig Kontrast
// im Hintergrund, dunklere Kirschstämme als Säulen. Die Lagune bleibt sonnig,
// mit Türkis, hellem Sand und Palmenstämmen.
// Malkosten: Striche und große Verläufe sparsam, Punkte und Flächen gebündelt.
// ============================================================
(() => {
  'use strict';
  const SD = CONFIG.SIDE_DARKEN;
  const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ---------- gemeinsame Werkzeuge ----------
  // Ablauf: feste Eröffnung, danach gewichteter Zufall ohne die letzten `mem` Motive
  const flowHist = new WeakMap();
  function flow(opening, pool, mem) {
    const m = mem || 2;
    return (i, rng) => {
      let h = flowHist.get(rng);
      if (!h || i === 0) { h = []; flowHist.set(rng, h); }
      let k = opening[i];
      if (k === undefined) {
        const avoid = h.slice(-m), cand = pool.filter(p => !avoid.includes(p[0]));
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
  // Unterkante weich ausblenden
  function dissolve(w, h, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vgrad(y0, y1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    ctx.fillRect(-2, y0, w + 4, h - y0 + 4);
    ctx.restore();
  }
  // weicher Fleck
  function soft(x, y, rx, ry, col, a) {
    if (a <= 0.002 || rx <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, Math.max(0.01, ry / rx));
    ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(col, a)], [0.5, rgba(col, a * 0.45)], [1, rgba(col, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  // Liste periodisch ergänzen: Elemente nahe der Kante zusätzlich um ±P versetzt
  function wrapList(list, P, pad) {
    const out = list.slice();
    for (const e of list) {
      if (e[0] < pad) out.push([e[0] + P].concat(e.slice(1)));
      if (e[0] > P - pad) out.push([e[0] - P].concat(e.slice(1)));
    }
    return out;
  }
  // Rechtecke gebündelt füllen: [x, y, w, h]
  function rects(list, col) {
    if (!list.length) return;
    ctx.beginPath();
    for (const [x, y, w, h] of list) ctx.rect(x, y, w, h);
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Alle Farbwerte eines Objekts Richtung Dunst mischen (auch verschachtelt)
  function hazeAll(o, col, t) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string' && v[0] === '#') o[k] = mix(v, col, t);
      else if (v && typeof v === 'object') hazeAll(v, col, t);
    }
    return o;
  }
  // Fünfblättrige Blüten, gebündelt nach Farbe: [x, y, r, Drehung]
  function blooms(list, petal, center) {
    if (!list.length) return;
    ctx.beginPath();
    for (const [x, y, r, a] of list) {
      for (let k = 0; k < 5; k++) {
        const an = (a || 0) + k * TAU / 5, px = x + Math.cos(an) * r * 0.52, py = y + Math.sin(an) * r * 0.52;
        ctx.moveTo(px + r * 0.5, py);
        ctx.arc(px, py, r * 0.5, 0, TAU);
      }
    }
    ctx.fillStyle = petal;
    ctx.fill();
    if (center) dots(list.map(([x, y, r]) => [x, y, r * 0.24]), center);
  }
  // Kuppe, auf der ein Motiv steht; läuft an beiden Rändern bis zur Unterkante. Liefert yAt(x)
  function mound(w, h, top, col, it, o) {
    o = o || {};
    const r = mulberry32(it.seed + 11), sk = (r() - 0.5) * (o.skew === undefined ? 0.4 : o.skew), p = o.p || 0.55, ph = r() * TAU;
    const wob = o.wob === undefined ? 1.4 : o.wob;
    const yAt = x => {
      const t = clamp(x / w, 0, 1), u = t + sk * t * (1 - t), e = Math.sin(Math.PI * u);
      return h + 2 - (h + 2 - top) * Math.pow(e, p) + Math.sin(x * 0.045 + ph) * wob * e;
    };
    ctx.beginPath();
    ctx.moveTo(-1, h + 2);
    for (let x = 0; x <= w; x += 5) ctx.lineTo(x, yAt(x));
    ctx.lineTo(w, yAt(w));
    ctx.lineTo(w + 1, h + 2);
    ctx.closePath();
    ctx.fillStyle = vgrad(top, h, [[0, shade(col, 0.07)], [1, shade(col, -0.1)]]);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const lt = [], dk = [];
    for (let k = 0; k < w / 30; k++) {
      const x = r() * w, y = yAt(x) + 5 + r() * (h - top) * 0.6;
      (r() < 0.5 ? lt : dk).push([x, y, 10 + r() * 20, 2 + r() * 3.5, (r() - 0.5) * 0.2]);
    }
    ellipses(lt, rgba(shade(col, 0.14), 0.2));
    ellipses(dk, rgba(shade(col, -0.14), 0.15));
    if (o.flowers) {
      const fl = [[], [], []];
      for (let k = 0; k < w * o.flowers; k++) { const x = r() * w; fl[k % 3].push([x, yAt(x) + 2 + Math.pow(r(), 1.4) * (h - top) * 0.8, 0.6 + r() * 0.6]); }
      dots(fl[0], rgba(CREAM, 0.7));
      dots(fl[1], rgba(o.fcol || '#f0a8c8', 0.6));
      dots(fl[2], rgba(o.fcol2 || '#f4d36a', 0.5));
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(2, yAt(2) + 0.4);
    let xe = 2;
    for (let x = 8; x <= w - 2; x += 6) { ctx.lineTo(x, yAt(x) + 0.4); xe = x; }
    for (let x = xe; x >= 2; x -= 6) ctx.lineTo(x, yAt(x) + 2.2);
    ctx.closePath();
    ctx.fillStyle = rgba(CREAM, o.rim || 0.24);
    ctx.fill();
    return yAt;
  }
  const footY = (yAt, x0, x1) => Math.max(yAt(x0), yAt(x1), yAt((x0 + x1) / 2)) + 1;
  const toLocal = (it, h, worldY) => worldY - (it.yb - h);

  // ============================================================
  // BLÜTENHAIN (Level 1): Frühlingshain in Pastell
  // ============================================================
  const palCache = new Map();
  function bloomPal(C, hz) {
    const key = 'b' + C.pipe + C.near + C.skyTop + (hz || 0);
    let P = palCache.get(key);
    if (P) return P;
    const pink = mix(C.pipe, CREAM, 0.38);
    P = {
      pink: { crown: pink, lit: mix(pink, '#ffffff', 0.6), dark: mix(C.pipe, '#9d78b4', 0.32), spark: '#ffffff', leaf: mix(C.near, CREAM, 0.1) },
      white: { crown: mix(CREAM, C.skyBottom, 0.3), lit: mix(CREAM, '#ffffff', 0.75), dark: mix(mix(CREAM, C.skyTop, 0.42), C.far, 0.3), spark: '#ffffff', leaf: mix(C.near, CREAM, 0.1) },
      deep: { crown: mix(C.pipe, '#e27aa6', 0.3), lit: mix(C.pipe, CREAM, 0.55), dark: mix(shade(C.pipe, -0.2), '#8a6aa8', 0.3), spark: mix(CREAM, '#ffffff', 0.5), leaf: C.near },
      green: { crown: shade(C.near, 0.02), lit: mix(C.near, CREAM, 0.42), dark: shade(C.near, -0.26), spark: mix(C.near, CREAM, 0.6), leaf: shade(C.near, -0.15) },
      bark: mix('#7a5450', C.pipe, 0.16),
      wood: mix('#a8805e', CREAM, 0.12),
      stone: mix(CREAM, C.far, 0.22),
      water: mix(C.skyTop, '#a9e0e6', 0.45),
      roof: mix('#86c9b6', C.near, 0.3),
      roof2: mix('#d98a80', C.pipe, 0.35),
      wall: mix(CREAM, C.skyBottom, 0.22),
      straw: mix('#d9b56a', CREAM, 0.18),
      hive: ['#f4f0e4', mix('#a6cdea', CREAM, 0.22), mix('#bfe3c3', CREAM, 0.2), mix(C.accent, CREAM, 0.35)],
      tulip: [mix('#e5607c', C.pipe, 0.3), mix(C.accent, CREAM, 0.08), mix(CREAM, '#ffffff', 0.3), mix('#b48ad8', C.pipe, 0.3)],
      lawn: mix(C.near, C.haze, 0.2),
      path: mix(CREAM, '#e8d2b0', 0.5)
    };
    if (hz) hazeAll(P, C.haze, hz);
    palCache.set(key, P);
    return P;
  }

  // Blütenbaum: Stamm mit zwei Ästen, Krone aus Ballen. x, y: Fußpunkt, s: Maßstab (Höhe etwa 44 s)
  function bloomTree(x, y, s, cols, bark, r, o) {
    o = o || {};
    if (!o.noShadow) ellipse(x + 5 * s, y + 0.4, 12 * s * (o.wide || 1), 2 * s, 0, rgba(INK, 0.12));
    const th = (o.trunk || 18) * s, tw = 2.1 * s;
    poly([[x - tw, y + 0.5], [x - tw * 0.45, y - th], [x + tw * 0.45, y - th], [x + tw * 1.1, y + 0.5]], bark);
    poly([[x + tw * 0.1, y + 0.5], [x + tw * 0.1, y - th], [x + tw * 0.45, y - th], [x + tw * 1.1, y + 0.5]], shade(bark, -0.22));
    ctx.strokeStyle = bark;
    ctx.lineWidth = Math.max(0.7, 1.2 * s);
    ctx.beginPath();
    ctx.moveTo(x, y - th * 0.7);
    ctx.quadraticCurveTo(x - 5 * s, y - th - 2 * s, x - 8 * s, y - th - 5 * s);
    ctx.moveTo(x, y - th * 0.85);
    ctx.quadraticCurveTo(x + 4 * s, y - th - 1 * s, x + 8 * s, y - th - 4 * s);
    ctx.stroke();
    const R = 12 * s * (o.wide || 1), cy = y - th - 6 * s;
    const blobs = [[x, cy - R * 0.15, R * 0.8], [x - R * 0.72, cy + R * 0.22, R * 0.6], [x + R * 0.74, cy + R * 0.18, R * 0.64],
      [x - R * 0.34, cy - R * 0.55, R * 0.56], [x + R * 0.36, cy - R * 0.52, R * 0.54]];
    for (const b of blobs) { b[0] += (r() - 0.5) * R * 0.16; b[1] += (r() - 0.5) * R * 0.12; }
    blobPath(blobs.map(([a, b, c]) => [a + R * 0.1, b + R * 0.12, c]));
    ctx.fillStyle = cols.dark;
    ctx.fill();
    blobPath(blobs);
    ctx.fillStyle = rgrad(x - R * 0.4, cy - R * 0.55, R * 0.1, R * 1.75, [[0, cols.lit], [0.5, cols.crown], [1, cols.dark]]);
    ctx.fill();
    if (s >= 0.45) {
      const hi = [], lo = [], lf = [], n = Math.round(8 + R * 1.1);
      for (let k = 0; k < n; k++) {
        const a = r() * TAU, d = Math.sqrt(r()) * R * 0.95;
        const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.8;
        const rr = (0.5 + r() * 0.6) * Math.max(0.8, s);
        if (py < cy && px < x + R * 0.35) hi.push([px, py, rr]);
        else if (r() < 0.65) lo.push([px, py + 1, rr]);
        else lf.push([px, py + 1, rr * 0.9]);
      }
      dots(hi, rgba(cols.spark, 0.7));
      dots(lo, rgba(mix(cols.dark, INK, 0.1), 0.4));
      dots(lf, rgba(cols.leaf, 0.55));
    }
    return cy;
  }
  // Blütenteppich unter Bäumen
  function petalCarpet(yAt, x0, x1, yOff, col, r, n) {
    const list = [];
    for (let k = 0; k < n; k++) { const x = x0 + r() * (x1 - x0); list.push([x, yAt(x) + yOff + r() * 5, 0.9 + r() * 1.4, 0.4 + r() * 0.5, r() * 3]); }
    ellipses(list, rgba(col, 0.55));
  }
  // Kleiner Lattenzaun entlang einer Bodenlinie
  function picket(yAt, x0, x1, col, hgt, step) {
    const lit = [], dk = [];
    for (let x = x0; x <= x1; x += step) { const y = yAt(x); lit.push([x - 0.6, y - hgt, 1.2, hgt]); dk.push([x + 0.6, y - hgt, 0.5, hgt]); }
    rects(lit, col);
    rects(dk, rgba(INK, 0.15));
    ctx.beginPath();
    for (const f of [0.35, 0.75]) {
      ctx.moveTo(x0, yAt(x0) - hgt * f);
      for (let x = x0 + 4; x <= x1; x += 4) ctx.lineTo(x, yAt(x) - hgt * f);
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // Trauerweide: Krone mit hängenden Vorhängen aus Ruten
  function willow(x, y, s, col, bark, r) {
    ellipse(x + 6 * s, y + 0.4, 16 * s, 2.2 * s, 0, rgba(INK, 0.12));
    poly([[x - 2.6 * s, y + 0.5], [x - 1.2 * s, y - 26 * s], [x + 1.2 * s, y - 26 * s], [x + 3 * s, y + 0.5]], bark);
    const cy = y - 30 * s, R = 16 * s;
    blobPath([[x, cy, R * 0.8], [x - R * 0.7, cy + R * 0.25, R * 0.55], [x + R * 0.7, cy + R * 0.2, R * 0.6]]);
    ctx.fillStyle = rgrad(x - R * 0.4, cy - R * 0.5, 1, R * 1.6, [[0, mix(col, CREAM, 0.4)], [0.6, col], [1, shade(col, -0.2)]]);
    ctx.fill();
    // hängende Ruten als schmale Streifen
    const lit = [], dk = [];
    for (let k = 0; k < 34 * s; k++) {
      const a = -Math.PI * 0.95 + r() * Math.PI * 0.9 + Math.PI, px = x + Math.cos(a) * R * (0.4 + r() * 0.75);
      const top = cy + Math.sin(a) * R * 0.3 - 2 * s, len = (14 + r() * 16) * s * (1 - Math.abs(px - x) / (R * 2.2));
      (px < x - R * 0.1 ? lit : dk).push([px, top, 1.1 * s, Math.max(3, len)]);
    }
    rects(dk, rgba(shade(col, -0.18), 0.85));
    rects(lit, rgba(mix(col, CREAM, 0.25), 0.9));
  }

  // ---------- Himmel ----------
  ART2.sky.blBloom = (C, S, rng) => {
    const sx = S.sunX <= 1 ? S.sunX * W : S.sunX;
    ctx.fillStyle = vgrad(230, GROUND_Y, [[0, rgba(C.skyBottom, 0)], [1, rgba(mix(C.skyBottom, C.far, 0.25), 0.55)]]);
    ctx.fillRect(0, 230, W, GROUND_Y - 230);
    // weiche Haufenwolken, nicht vor der Sonne
    const lit = mix(CREAM, '#ffffff', 0.75), mid = mix(CREAM, C.skyBottom, 0.45), low = mix(mix(C.skyTop, C.far, 0.45), CREAM, 0.25);
    const n = Math.max(2, Math.round(W / 320));
    for (let k = 0; k < n; k++) {
      let x = (k + 0.15 + rng() * 0.7) * W / n;
      const y = 200 + rng() * 100, cw = 34 + rng() * 34, ch = 18 + rng() * 16;
      if (Math.abs(x - sx) < 90 && y < 230) x += x < sx ? -90 : 90;
      a2Billow(a2Heap(x, y, cw, ch, rng), y - ch - 14, y + 4, lit, mid, low, 0.45, 0.26, null);
    }
    // ferne, blasse Hügelkette mit Blütenwäldern
    const hill = mix(mix(C.near, C.skyTop, 0.35), C.haze, 0.6);
    const f = x => 378 - 30 * pnoise(x / 150, 1000, 3) - 12 * pnoise(x / 50, 1000, 4);
    ctx.beginPath();
    ctx.moveTo(-4, GROUND_Y);
    for (let x = -4; x <= W + 4; x += 6) ctx.lineTo(x, f(x));
    ctx.lineTo(W + 4, GROUND_Y);
    ctx.closePath();
    ctx.fillStyle = vgrad(340, 430, [[0, hill], [1, mix(hill, C.haze, 0.5)]]);
    ctx.fill();
    const pk = [], wh = [];
    for (let x = 0; x < W; x += 2 + rng() * 5) {
      if (pnoise(x / 60, 1000, 7) < 0.48) continue;
      (rng() < 0.55 ? pk : wh).push([x, f(x) + 1.5 + rng() * 4, 1.3 + rng() * 1.6]);
    }
    dots(pk, rgba(mix(C.pipe, C.haze, 0.5), 0.7));
    dots(wh, rgba(mix(CREAM, C.haze, 0.25), 0.7));
    ridgeLine(f, -4, W + 4, 6, 0.8, rgba(CREAM, 0.25), 1.4);
  };

  // ---------- Ebene 0: ferne Hügel mit Obstgärten und Blütenwäldchen ----------
  ART2.layerExtent.blHills = () => [352, GROUND_Y + 14];
  ART2.layerTex.blHills = () => ({ grain: 0.03, mottle: 0.08, contrast: 1 });
  ART2.layer.blHills = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, f = ridgeFn(P, 430, 50, 0.004, l.seed);
    const base = mix(mix(C.near, C.skyTop, 0.2), C.haze, 0.4), pal = bloomPal(C, 0.4);
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(380, yb, [[0, shade(base, 0.06)], [0.45, base], [1, mix(base, C.haze, 0.3)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Felder: Rapsgelb, frisches Grün und zartes Rosa in Bändern parallel zum Kamm
    const fc = [mix(mix(C.accent, CREAM, 0.3), base, 0.4), shade(base, 0.1), mix(mix(C.pipe, CREAM, 0.3), base, 0.5)];
    for (let x = rng() * 40; x < P;) {
      const w = 60 + rng() * 110, x1 = Math.min(P, x + w), off0 = 16 + rng() * 14, off1 = off0 + 10 + rng() * 14, c = fc[Math.floor(rng() * fc.length)];
      ctx.beginPath();
      for (let xx = x; xx <= x1; xx += 5) ctx.lineTo(xx, f(xx) + off0);
      for (let xx = x1; xx >= x; xx -= 5) ctx.lineTo(xx, f(xx) + off1);
      ctx.closePath();
      ctx.fillStyle = rgba(c, 0.6);
      ctx.fill();
      x = x1 + 20 + rng() * 60;
    }
    // Obstreihen: Reihen kleiner Blütentupfer am Hang
    const rows = { pk: [], wh: [], sh: [] };
    for (let row = 0; row < 3; row++) {
      const off = 40 + row * 6;
      for (let x = row * 2.5; x < P; x += 5) {
        if (pnoise(x / P * 14, 14, l.seed + row * 3) < 0.6) continue;
        const y = f(x) + off + (rng() - 0.5), rr = 1.4 + rng() * 0.4;
        rows.sh.push([x + 0.6, y + 0.8, rr]);
        (rng() < 0.55 ? rows.pk : rows.wh).push([x, y, rr]);
      }
    }
    dots(rows.sh, rgba(pal.pink.dark, 0.35));
    dots(rows.pk, rgba(pal.pink.crown, 0.8));
    dots(rows.wh, rgba(pal.white.crown, 0.8));
    const lt = [], dk = [];
    for (let k = 0; k < P / 40; k++) {
      const x = rng() * P, y = f(x) + 20 + rng() * 70;
      (rng() < 0.5 ? lt : dk).push([x, y, 24 + rng() * 40, 4 + rng() * 6, 0]);
    }
    ellipses(lt, rgba(shade(base, 0.12), 0.18));
    ellipses(dk, rgba(shade(base, -0.12), 0.12));
    ctx.restore();
    ridgeLine(f, -8, P + 8, 4, 1.2, rgba(CREAM, 0.22), 2);
    // Blütenwäldchen auf dem Kamm: Ballen in Rosa und Weiß, einige grün
    const sets = [pal.pink, pal.white, pal.green], buckets = sets.map(() => ({ sh: [], m: [], hi: [] }));
    for (let x = 0; x < P; x += 2.5 + rng() * 4) {
      if (pnoise(x / P * 18, 18, l.seed + 9) < 0.44) continue;
      const k = rng() < 0.45 ? 0 : rng() < 0.7 ? 1 : 2, b = buckets[k];
      const y = f(x) + 1 + rng() * 5, rr = 2.6 + rng() * 2.8;
      b.sh.push([x + rr * 0.25, y + rr * 0.3, rr]);
      b.m.push([x, y, rr]);
      b.hi.push([x - rr * 0.3, y - rr * 0.35, rr * 0.45]);
    }
    buckets.forEach((b, k) => {
      dots(wrapList(b.sh, P, 8), sets[k].dark);
      dots(wrapList(b.m, P, 8), sets[k].crown);
      dots(wrapList(b.hi, P, 8), rgba(sets[k].lit, 0.7));
    });
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(420, yb, [[0, rgba(C.haze, 0)], [1, rgba(C.haze, 0.45)]]);
    ctx.fill();
  };

  // ---------- Ebene 1: Wiesenhügel mit Hecken und einzelnen Blütenbäumen ----------
  ART2.layerExtent.blMeadow = () => [360, GROUND_Y + 14];
  ART2.layerTex.blMeadow = () => ({ grain: 0.04, mottle: 0.12, contrast: 1.05 });
  ART2.layer.blMeadow = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, f = ridgeFn(P, 474, 36, 0.005, l.seed), g = mix(C.near, CREAM, 0.08), pal = bloomPal(C, 0.08);
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(436, yb, [[0, shade(g, 0.1)], [0.4, g], [1, shade(g, -0.16)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const lt = [], dk = [];
    for (let k = 0; k < P / 32; k++) {
      const x = rng() * P, y = f(x) + 10 + rng() * 60;
      (rng() < 0.5 ? lt : dk).push([x, y, 20 + rng() * 40, 3 + rng() * 6, (rng() - 0.5) * 0.2]);
    }
    ellipses(lt, rgba(shade(g, 0.14), 0.2));
    ellipses(dk, rgba(shade(g, -0.16), 0.14));
    // Hecken als dunkle Bänder parallel zum Kamm
    for (let x = rng() * 200; x < P;) {
      const w = 80 + rng() * 160, x1 = Math.min(P + 20, x + w), off = 20 + rng() * 22, hed = [];
      for (let xx = x; xx <= x1; xx += 2.6) hed.push([xx, f(xx) + off + Math.sin(xx * 0.3) * 0.6, 2.2 + hash(xx) * 1.4]);
      dots(hed.map(([a, b, c]) => [a + 0.6, b + 0.8, c]), rgba(shade(g, -0.38), 0.6));
      dots(hed, rgba(shade(g, -0.2), 0.85));
      dots(hed.filter((_, k) => k % 3 === 0).map(([a, b, c]) => [a - 0.6, b - c * 0.4, c * 0.5]), rgba(mix(g, CREAM, 0.3), 0.5));
      x = x1 + 140 + rng() * 200;
    }
    // Blumenfelder in Wolken (weiß, rosa, gelb)
    const fl = [[], [], []];
    for (let k = 0; k < 16; k++) {
      const cx = rng() * P, cy = 18 + rng() * 40, n = 20 + rng() * 30, kind = k % 3;
      for (let j = 0; j < n; j++) { const x = cx + (rng() - 0.5) * 70, y = f(x) + cy + (rng() - 0.5) * 14; fl[kind].push([x, y, 0.8 + rng() * 0.6]); }
    }
    dots(fl[0], rgba(CREAM, 0.75));
    dots(fl[1], rgba(pal.pink.crown, 0.8));
    dots(fl[2], rgba(mix(C.accent, CREAM, 0.2), 0.7));
    const gs = [];
    for (let k = 0; k < P / 2.4; k++) {
      const x = rng() * P, y = f(x) + 3 + Math.pow(rng(), 1.5) * 80, len = 2 + rng() * 3;
      gs.push([x, y - len, 0.8, len]);
    }
    rects(gs.slice(0, gs.length >> 1), rgba(shade(g, 0.22), 0.35));
    rects(gs.slice(gs.length >> 1), rgba(shade(g, -0.25), 0.3));
    ctx.restore();
    ridgeLine(f, -8, P + 8, 4, 1.3, rgba(CREAM, 0.3), 2.2);
    // Bäume und Büsche auf dem Kamm
    const trees = [];
    for (let x = 40 + rng() * 80; x < P; x += 150 + rng() * 210) {
      const v = rng(), set = v < 0.45 ? pal.pink : v < 0.75 ? pal.white : v < 0.88 ? pal.deep : pal.green;
      trees.push([x, f(x) + 4 + rng() * 6, 0.75 + rng() * 0.4, set, (rng() * 1e6) | 0, 'tree']);
      if (rng() < 0.6) trees.push([x + (rng() < 0.5 ? -1 : 1) * (20 + rng() * 14), f(x) + 8 + rng() * 6, 0.5 + rng() * 0.2, pal.green, (rng() * 1e6) | 0, 'bush']);
    }
    trees.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, set, seed, kind] of trees) {
      wrapEach(x, P, 34 * s, xx => {
        if (kind === 'tree') bloomTree(xx, y, s, set, pal.bark, mulberry32(seed));
        else {
          const bl = [[xx - 6 * s, y - 5 * s, 7 * s], [xx + 5 * s, y - 5 * s, 7.5 * s], [xx, y - 10 * s, 8 * s]];
          ellipse(xx + 6 * s, y, 13 * s, 2 * s, 0, rgba(INK, 0.12));
          blobPath(bl.map(([a, b, c]) => [a + 1, b + 1.2, c]));
          ctx.fillStyle = set.dark;
          ctx.fill();
          blobPath(bl);
          ctx.fillStyle = rgrad(xx - 4 * s, y - 13 * s, 1, 16 * s, [[0, set.lit], [0.55, set.crown], [1, set.dark]]);
          ctx.fill();
        }
      });
    }
  };

  // ---------- Ebene 2: Blumen und Sträucher im Vordergrund ----------
  ART2.prop.blFlower = { h: 64, paint: (x, base, s, r, v, C, col) => blFlowerProp(x, base, s, r, v, C, col) };
  function blFlowerProp(x, base, s, r, v, C, col) {
    const pal = bloomPal(C), side = shade(col, -SD), hi = shade(col, 0.2);
    if (v < 0.26) {
      // blühender Strauch
      ellipse(x + 8 * s, base - 2, 20 * s, 4 * s, 0, rgba(INK, 0.16));
      const bl = [[x - 9 * s, base - 7 * s, 9 * s], [x + 9 * s, base - 7 * s, 10 * s], [x, base - 13 * s, 12 * s], [x - 3 * s, base - 20 * s, 8 * s]];
      blobPath(bl.map(([a, b, c]) => [a + 2, b + 2, c]));
      ctx.fillStyle = side;
      ctx.fill();
      blobPath(bl);
      ctx.fillStyle = rgrad(x, base - 13 * s, 2, 22 * s, [[0, hi], [0.6, col], [1, side]], x - 8 * s, base - 22 * s);
      ctx.fill();
      const set = r() < 0.5 ? pal.pink : pal.white, fl = [], fd = [];
      for (let k = 0; k < 9; k++) {
        const fx = x + (r() - 0.5) * 26 * s, fy = base - 5 * s - r() * 20 * s;
        (fx > x + 5 * s ? fd : fl).push([fx, fy, 2.6 * s, r() * 2]);
      }
      blooms(fl, set.lit, mix(C.accent, '#c58a3a', 0.2));
      blooms(fd, set.crown, mix(C.accent, '#c58a3a', 0.3));
    } else if (v < 0.48) {
      // Tulpen mit breiten Blättern
      const n = 3 + Math.floor(r() * 3), c = pal.tulip[Math.floor(r() * pal.tulip.length)];
      for (let k = 0; k < n; k++) {
        const fx = x + (k - (n - 1) / 2) * 6 * s + (r() - 0.5) * 3, fh = (18 + r() * 14) * s, lean = (r() - 0.5) * 4;
        a2Blade(fx - 2, base, fh * 0.55, -4 - r() * 3, 2.2 * s, shade(col, 0.05));
        line(fx, base, fx + lean, base - fh, shade(col, -0.12), 1.2);
        const cx = fx + lean, cy = base - fh, cw = 3.4 * s, ch = 5.6 * s;
        ctx.beginPath();
        ctx.moveTo(cx - cw, cy - ch);
        ctx.lineTo(cx - cw * 0.35, cy - ch * 0.62);
        ctx.lineTo(cx, cy - ch * 1.02);
        ctx.lineTo(cx + cw * 0.35, cy - ch * 0.62);
        ctx.lineTo(cx + cw, cy - ch);
        ctx.quadraticCurveTo(cx + cw * 1.05, cy, cx, cy + 0.6);
        ctx.quadraticCurveTo(cx - cw * 1.05, cy, cx - cw, cy - ch);
        ctx.closePath();
        ctx.fillStyle = hgrad(cx - cw, cx + cw, [[0, mix(c, CREAM, 0.3)], [0.55, c], [1, shade(c, -0.22)]]);
        ctx.fill();
        a2Blade(fx + 2, base, fh * 0.45, 4 + r() * 3, 2 * s, shade(col, -0.08));
      }
    } else if (v < 0.7) {
      // Gänseblümchen und Margeriten zwischen Halmen
      const bl = [];
      for (let k = -4; k <= 4; k++) bl.push([x + k * 2.4, base, x + k * 3 + (r() - 0.5) * 3, base - (11 - Math.abs(k) * 1.4) * s - r() * 5]);
      segs(bl.slice(0, 5), shade(col, 0.12), 1.3);
      segs(bl.slice(5), side, 1.3);
      const heads = [], st = [];
      for (let k = 0; k < 5; k++) {
        const fx = x + (r() - 0.5) * 22 * s, fh = (10 + r() * 16) * s;
        st.push([fx, base, fx + (r() - 0.5) * 3, base - fh]);
        heads.push([st[k][2], base - fh, (2.6 + r() * 1.2) * s, r() * 2]);
      }
      segs(st, shade(col, -0.1), 1);
      blooms(heads.map(([a, b, c, d]) => [a + 0.5, b + 0.6, c, d]), rgba(INK, 0.12));
      blooms(heads, mix(CREAM, '#ffffff', 0.5), mix(C.accent, '#e0a030', 0.25));
    } else if (v < 0.86) {
      // Grasbüschel mit Vergissmeinnicht und Klee
      const bl = [];
      for (let k = -5; k <= 5; k++) bl.push([x + k * 2, base, x + k * 2.8 + (r() - 0.5) * 3, base - (14 - Math.abs(k) * 1.5) * s - r() * 5]);
      segs(bl.slice(0, 6), shade(col, 0.15), 1.3);
      segs(bl.slice(6), side, 1.3);
      const fm = [];
      for (let k = 0; k < 7; k++) fm.push([x + (r() - 0.5) * 20 * s, base - 4 * s - r() * 10 * s, 1.9 * s, r() * 2]);
      blooms(fm, mix('#8fb8f0', CREAM, 0.15), mix(C.accent, CREAM, 0.2));
      const cl = [];
      for (let k = 0; k < 3; k++) { const cx = x + (r() - 0.5) * 24 * s, cy = base - 2 - r() * 3; cl.push([cx - 1.5, cy, 1.6], [cx + 1.5, cy, 1.6], [cx, cy - 2.2, 1.6]); }
      dots(cl, shade(col, -0.05));
    } else {
      // junges Bäumchen in Blüte
      const set = r() < 0.6 ? pal.pink : pal.white;
      bloomTree(x, base - 2, 0.85 * s, set, pal.bark, r, { trunk: 22 });
    }
  }

  // ---------- Boden: Wiese mit kleinen Blüten ----------
  ART2.ground.blGrass = (P, y, C, rng, band) => {
    const soil = mix(mix(shade(C.near, -0.45), '#8a5e40', 0.5), C.pipe, 0.08);
    band(vgrad(y, H, [[0, shade(soil, 0.12)], [1, shade(soil, -0.28)]]), y + 4, H - y + 4);
    for (let k = 0; k < 3; k++) {
      const yy = y + 21 + k * 11;
      ctx.beginPath();
      for (let x = -8; x <= P + 8; x += 12) {
        const v = yy + Math.sin(x * TAU / P * 17 + k * 2) * 2.4 + Math.sin(x * TAU / P * 43 + k) * 1;
        if (x === -8) ctx.moveTo(x, v); else ctx.lineTo(x, v);
      }
      ctx.strokeStyle = rgba(k % 2 ? shade(soil, -0.25) : shade(soil, 0.14), 0.42);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    const pb = [];
    for (let k = 0; k < P / 11; k++) pb.push([rng() * P, y + 18 + rng() * 38, 1.4 + rng() * 3, 1.1 + rng() * 1.8]);
    ellipses(pb.map(([a, b, c, d]) => [a + 0.8, b + 0.9, c, d, 0]), rgba(INK, 0.3));
    ellipses(pb, mix(soil, '#c4ae94', 0.45));
    ellipses(pb.map(([a, b, c, d]) => [a - c * 0.3, b - d * 0.35, c * 0.45, d * 0.35, 0]), rgba(CREAM, 0.28));
    const roots = [];
    for (let k = 0; k < P / 30; k++) { const x = rng() * P, yy = y + 12 + rng() * 10; roots.push([x, yy, x + (rng() - 0.5) * 16, yy + 6 + rng() * 10]); }
    segs(roots, rgba(shade(soil, -0.35), 0.55), 1);
    // Grasnarbe
    band(vgrad(y - 2, y + 13, [[0, shade(C.near, 0.16)], [1, shade(C.near, -0.12)]]), y - 1, 13);
    band(rgba(INK, 0.2), y + 11, 3);
    // Kleeblätter auf der Narbe
    const cl = [];
    for (let k = 0; k < P / 14; k++) { const x = rng() * P, yy = y + 3 + rng() * 6; cl.push([x - 1.4, yy, 1.5], [x + 1.4, yy, 1.5], [x, yy - 2, 1.5]); }
    dots(cl, rgba(shade(C.near, -0.2), 0.6));
    const tones = [shade(C.near, 0.24), mix(C.near, CREAM, 0.08), shade(C.near, -0.16)];
    for (let t = 0; t < 3; t++) {
      ctx.beginPath();
      for (let x = -6 + t * 2; x < P + 8; x += 3 + rng() * 2) {
        const hgt = 4 + rng() * 9, lean = (rng() - 0.4) * 3;
        ctx.moveTo(x - 1.5, y + 2);
        ctx.lineTo(x + lean, y + 1 - hgt);
        ctx.lineTo(x + 1.5, y + 2);
      }
      ctx.fillStyle = tones[t];
      ctx.fill();
    }
    // Blüten über der Kante: Gänseblümchen, rosa Klee, Butterblumen, Ehrenpreis
    const pal = bloomPal(C), daisy = [], clover = [], butter = [], blue = [], petals = [];
    for (let k = 0; k < P / 20; k++) daisy.push([8 + rng() * (P - 16), y - 2 - rng() * 6, 2.3 + rng() * 0.6, rng() * 2]);
    for (let k = 0; k < P / 40; k++) clover.push([rng() * P, y - 3 - rng() * 5, 1.6 + rng() * 0.6, 2.2 + rng() * 0.6, 0]);
    for (let k = 0; k < P / 36; k++) butter.push([6 + rng() * (P - 12), y - 3 - rng() * 6, 2 + rng() * 0.4, rng() * 2]);
    for (let k = 0; k < P / 30; k++) blue.push([rng() * P, y - 1 - rng() * 4, 1.1 + rng() * 0.4]);
    for (let k = 0; k < P / 16; k++) petals.push([rng() * P, y + 1 + rng() * 9, 1.3 + rng() * 0.6, 0.6 + rng() * 0.3, rng() * 3]);
    ellipses(petals, rgba(pal.pink.crown, 0.8));
    blooms(daisy.map(([a, b, c, d]) => [a + 0.6, b + 0.7, c, d]), rgba(INK, 0.14));
    blooms(daisy, mix(CREAM, '#ffffff', 0.55), mix(C.accent, '#e09a2a', 0.25));
    ellipses(wrapList(clover, P, 4), mix(pal.pink.crown, C.pipe, 0.4));
    ellipses(wrapList(clover, P, 4).map(([a, b, c, d]) => [a - 0.5, b - 0.8, c * 0.5, d * 0.45, 0]), rgba(CREAM, 0.45));
    blooms(butter, mix(C.accent, '#ffe27a', 0.3), mix(C.accent, '#c88a2a', 0.4));
    dots(wrapList(blue, P, 3), mix('#8fb3f0', CREAM, 0.2));
  };

  // ---------- Säule: junger Kirschstamm, an der Kappe dicht in Blüte ----------
  const cherryBark = C => mix('#8a5650', C.pipe, 0.22);
  ART2.pipeBody.blCherry = (C, h, v, r) => {
    const bark = cherryBark(C), side = shade(bark, -SD), lit = mix(bark, CREAM, 0.32);
    columnBase(h, bark, side, lit);
    // feine Längsfasern
    const fib = [];
    for (let k = 0; k < 9; k++) { const x = 4 + k * 6 + r() * 3; fib.push([x, 0, 0.7, h]); }
    rects(fib, rgba(INK, 0.06));
    // Querbänder wie bei Kirschrinde
    const bands = [], bandLit = [];
    for (let y = 18 + v * 23 + r() * 10; y < h; y += 48 + r() * 26) { bands.push([0, y, PW, 2.6]); bandLit.push([0, y - 1.2, PW, 1.1]); }
    rects(bands, rgba(shade(bark, -0.35), 0.45));
    rects(bandLit, rgba(lit, 0.35));
    // Lentizellen: kurze helle Querstriche mit dunkler Unterkante
    const lent = [], lentD = [], lentS = [];
    for (let y = 4 + r() * 5; y < h; y += 6 + r() * 6) {
      for (let k = 0, n = 1 + Math.floor(r() * 2.6); k < n; k++) {
        const x = 3 + r() * 50, len = 3 + r() * 6;
        (x > 38 ? lentS : lent).push([x, y, Math.min(len, PW - 1 - x), 1.1]);
        lentD.push([x + 0.4, y + 1.1, Math.min(len, PW - 1 - x), 0.8]);
      }
    }
    rects(lentD, rgba(INK, 0.2));
    rects(lent, rgba(mix(bark, CREAM, 0.55), 0.5));
    rects(lentS, rgba(mix(bark, CREAM, 0.35), 0.35));
    // Astnarben
    for (let y = 60 + v * 140 + r() * 40; y < h; y += 220 + r() * 80) {
      const x = 14 + r() * 26;
      ellipse(x + 0.6, y + 0.8, 3.6, 2.6, 0, rgba(INK, 0.25));
      ellipse(x, y, 3.2, 2.2, 0, shade(bark, -0.25));
      ellipse(x - 0.6, y - 0.6, 1.6, 1, 0, rgba(lit, 0.6));
    }
    // seitliche Zweige mit Blütenbüscheln
    const pal = bloomPal(C);
    for (let y = 70 + v * 60 + r() * 20, k = 0; y < h - 20; y += 104 + r() * 30, k++) {
      const sd = (k + v) % 2 ? 1 : -1, x0 = sd < 0 ? 1.5 : PW - 1.5, tx = x0 + sd * 13, ty = y - 15;
      ctx.strokeStyle = sd < 0 ? bark : side;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x0 - sd * 2, y + 2);
      ctx.quadraticCurveTo(x0 + sd * 7, y - 2, tx, ty);
      ctx.stroke();
      // Blätter
      ellipse(x0 + sd * 8, y - 2, 4.2, 1.8, sd * 0.5, sd < 0 ? pal.green.lit : pal.green.crown);
      ellipse(tx - sd * 1, ty + 5, 3.8, 1.7, -sd * 0.7, pal.green.crown);
      const set = k % 3 === 2 ? pal.white : pal.pink;
      const fl = [[tx, ty - 1, 4.4, 0.3], [tx - sd * 5.5, ty + 2.5, 3.8, 1.1], [x0 + sd * 5, y - 6, 3.4, 0.7]];
      blooms(fl.map(([a, b, c, d]) => [a + 0.6, b + 0.8, c, d]), rgba(INK, 0.16));
      blooms(fl, sd < 0 ? set.lit : set.crown, mix(C.accent, '#c8862a', 0.3));
    }
  };
  ART2.pipeCap.blCherry = (C, up) => {
    const pal = bloomPal(C), bark = cherryBark(C), inward = up ? 1 : -1, trunkEdge = up ? PCH : 0;
    // Blattkranz zum Stamm hin
    const lv = [], lvD = [];
    for (let k = 0; k < 8; k++) {
      const x = -PCO + 3 + k * 9.4, tip = trunkEdge + inward * (6 + (k % 2) * 3);
      (x < PW * 0.6 ? lv : lvD).push([x, trunkEdge - inward * 2, (k % 2 ? 0.35 : -0.35), tip]);
    }
    for (const [list, c] of [[lv, pal.green.lit], [lvD, pal.green.dark]]) {
      ctx.beginPath();
      for (const [x, y0, a, tip] of list) {
        ctx.moveTo(x - 3.2, y0);
        ctx.quadraticCurveTo(x - 2 + a * 6, (y0 + tip) / 2, x + a * 5, tip);
        ctx.quadraticCurveTo(x + 2 + a * 6, (y0 + tip) / 2, x + 3.2, y0);
        ctx.closePath();
      }
      ctx.fillStyle = c;
      ctx.fill();
    }
    // Polster aus Blüten: Grundform mit Licht links, Schatten rechts
    const lit = pal.pink.lit, mid = pal.pink.crown, dark = pal.pink.dark;
    roundRectPath(-PCO, 0, PW + PCO * 2, PCH, 9);
    ctx.fillStyle = hgrad(-PCO, PW + PCO, [[0, lit], [0.18, mid], [0.6, mid], [0.8, dark], [1, shade(dark, -0.15)]]);
    ctx.fill();
    ctx.fillStyle = vgrad(0, PCH, up ? [[0, rgba(CREAM, 0.18)], [1, rgba(INK, 0.12)]] : [[0, rgba(INK, 0.1)], [1, rgba(CREAM, 0.1)]]);
    ctx.fill();
    ctx.strokeStyle = rgba(mix(bark, INK, 0.3), 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    // einzelne Blüten, nach Lage schattiert
    const rr = mulberry32(up ? 41 : 43), bk = { a: [], b: [], c: [], d: [] };
    for (let row = 0; row < 3; row++) {
      const yy = 5 + row * 7;
      for (let x = -PCO + 4 + (row % 2) * 3.6 + rr() * 2; x < PW + PCO - 3; x += 7 + rr() * 1.5) {
        const fx = x, fy = yy + (rr() - 0.5) * 2, fr = 3.4 + rr() * 0.9, white = rr() < 0.3;
        const lightSide = fx < PW * 0.55;
        (white ? (lightSide ? bk.c : bk.d) : (lightSide ? bk.a : bk.b)).push([fx, fy, fr, rr() * 2]);
      }
    }
    ctx.save();
    roundRectPath(-PCO - 1.5, -1.5, PW + PCO * 2 + 3, PCH + 3, 10);
    ctx.clip();
    const all = bk.a.concat(bk.b, bk.c, bk.d);
    blooms(all.map(([a, b, c, d]) => [a + 0.7, b + 0.9, c, d]), rgba(mix(dark, INK, 0.2), 0.4));
    blooms(bk.a, mix(mid, CREAM, 0.25), null);
    blooms(bk.b, mix(mid, dark, 0.3), null);
    blooms(bk.c, mix(CREAM, '#ffffff', 0.5), null);
    blooms(bk.d, mix(pal.white.crown, pal.white.dark, 0.35), null);
    dots(all.map(([a, b, c]) => [a, b, c * 0.26]), mix(C.accent, '#c8862a', 0.25));
    dots(all.filter(f => f[0] < PW * 0.5).map(([a, b, c]) => [a - c * 0.4, b - c * 0.45, c * 0.22]), rgba('#ffffff', 0.7));
    ctx.restore();
  };

  // ---------- Kulissen Blütenhain ----------
  // mittlere Spur: zwischen Ebene 0 und 1, Unterkante sicher hinter dem Wiesenkamm (438 bis 474)
  const B_MID = 478, B_FAR = 412;
  const bMid = {
    grove: {
      size: r => [250 + r() * 60, 150],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 414 + r() * 8);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.4, flowers: 0.12, fcol: P.pink.crown });
        petalCarpet(yAt, w * 0.15, w * 0.85, 2, P.pink.crown, r, 60);
        const tr = [];
        for (let x = w * 0.16; x < w * 0.86; x += 26 + r() * 16) {
          const back = r() < 0.45, y = footY(yAt, x - 3, x + 3) + (back ? 1 : 6 + r() * 6);
          tr.push([x + (r() - 0.5) * 8, y, back ? 0.85 + r() * 0.25 : 1.05 + r() * 0.35, r() < 0.65 ? P.pink : r() < 0.6 ? P.white : P.deep, (r() * 1e6) | 0]);
        }
        tr.sort((a, b) => a[1] - b[1]);
        for (const [x, y, s, set, seed] of tr) bloomTree(x, y, s, set, P.bark, mulberry32(seed));
      },
      tex: { grain: 0.035 }
    },
    pond: {
      size: r => [290 + r() * 40, 124],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 436 + r() * 6);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.28, flowers: 0.1, skew: 0.2 });
        const px = w * 0.56, py = top + 16, rx = w * 0.26, ry = 6.5;
        // Teich mit Himmelsspiegelung und Uferkante
        ellipse(px, py + 1.4, rx + 2, ry + 1.6, 0, rgba(shade(P.lawn, -0.3), 0.55));
        ellipse(px, py, rx, ry, 0, vgrad(py - ry, py + ry, [[0, mix(P.water, CREAM, 0.35)], [1, shade(P.water, -0.08)]]));
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, TAU);
        ctx.clip();
        rects([[px - rx * 0.7, py - 2, rx * 0.8, 0.8], [px - rx * 0.2, py + 1.5, rx * 0.9, 0.7], [px - rx * 0.9, py + 3.5, rx * 0.5, 0.6]], rgba('#ffffff', 0.45));
        // Spiegelbild der Weide
        ellipse(px - rx * 0.78, py + 1, 12, 4, 0, rgba(mix(P.green.crown, P.water, 0.4), 0.6));
        ctx.restore();
        // Seerosen
        const pads = [];
        for (let k = 0; k < 7; k++) pads.push([px + rx * (0.15 + r() * 0.7) * (r() < 0.5 ? -0.6 : 1), py + (r() - 0.3) * ry * 1.1, 2.4 + r() * 1.4, 0.9 + r() * 0.5, 0]);
        ellipses(pads, mix(P.green.crown, P.water, 0.15));
        blooms(pads.filter((_, k) => k % 2 === 0).map(([a, b]) => [a + 0.6, b - 1, 2.2, 0.4]), mix(P.pink.crown, CREAM, 0.3), mix(C.accent, CREAM, 0.2));
        // Steg mit Pfosten von links ins Wasser
        const sx0 = px - rx - 8, sx1 = px - rx * 0.25, sy = py - 2.4;
        const posts = [];
        for (let x = sx0 + 4; x <= sx1; x += 11) posts.push([x, sy, 1.6, 6.5]);
        rects(posts, shade(P.wood, -0.35));
        rects(posts.map(([a, b, c, d]) => [a, b + d, c, 4]), rgba(shade(P.wood, -0.3), 0.25));
        ctx.fillStyle = shade(P.wood, -0.12);
        ctx.fillRect(sx0, sy - 1, sx1 - sx0, 2.6);
        ctx.fillStyle = mix(P.wood, CREAM, 0.35);
        ctx.fillRect(sx0, sy - 1.6, sx1 - sx0, 0.9);
        const pl = [];
        for (let x = sx0 + 2; x < sx1; x += 3) pl.push([x, sy - 0.8, 0.5, 2.2]);
        rects(pl, rgba(INK, 0.12));
        // Schilf am rechten Ufer
        const reed = [];
        for (let k = 0; k < 16; k++) { const x = px + rx * 0.82 + r() * 18, y = py + 1 + r() * 4; reed.push([x, y - 8 - r() * 9, 0.9, 10 + r() * 6]); }
        rects(reed, mix(P.green.crown, C.accent, 0.12));
        rects(reed.filter((_, k) => k % 3 === 0).map(([a, b]) => [a - 0.6, b - 4, 2.1, 4.5]), mix('#8a6a4a', P.green.dark, 0.3));
        // Trauerweide links, Blütenbaum rechts
        willow(px - rx - 22, footY(yAt, px - rx - 28, px - rx - 16) + 1, 1.25, mix(P.green.crown, '#c8e08a', 0.35), P.bark, r);
        bloomTree(px + rx + 26, footY(yAt, px + rx + 22, px + rx + 30) + 2, 1.05, P.pink, P.bark, r);
      },
      tex: { grain: 0.035 }
    },
    pavilion: {
      size: r => [240 + r() * 40, 172],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 394 + r() * 8);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.62, flowers: 0.1, skew: 0.15 });
        let cx = 0;
        for (let x = 0; x < w; x += 2) if (yAt(x) < yAt(cx)) cx = x;
        const gy = footY(yAt, cx - 18, cx + 18) - 1;
        // Weg vom Pavillon den Hang hinab
        ctx.beginPath();
        ctx.moveTo(cx + 4, gy + 1);
        ctx.quadraticCurveTo(cx + 34, gy + 18, cx + 18, gy + 40);
        ctx.quadraticCurveTo(cx + 4, gy + 58, cx + 30, h);
        ctx.lineTo(cx + 44, h);
        ctx.quadraticCurveTo(cx + 16, gy + 58, cx + 26, gy + 40);
        ctx.quadraticCurveTo(cx + 42, gy + 18, cx + 10, gy + 1);
        ctx.closePath();
        ctx.fillStyle = rgba(P.path, 0.8);
        ctx.fill();
        // Bäume dahinter
        bloomTree(cx - 40, footY(yAt, cx - 44, cx - 36) + 3, 1.15, P.pink, P.bark, r);
        bloomTree(cx + 44, footY(yAt, cx + 40, cx + 48) + 4, 0.95, P.white, P.bark, r);
        // Pavillon: Sockel, Säulen, Kuppeldach mit Spitze
        const pw = 36, ph = 22, x0 = cx - pw / 2, stone = P.stone, roof = P.roof;
        ellipse(cx + 8, gy + 1, pw * 0.75, 2.6, 0, rgba(INK, 0.14));
        ctx.fillStyle = vgrad(gy - 4, gy + 1, [[0, mix(stone, CREAM, 0.4)], [1, shade(stone, -0.12)]]);
        ctx.fillRect(x0 - 5, gy - 4, pw + 10, 5);
        ctx.fillStyle = mix(stone, CREAM, 0.2);
        ctx.fillRect(x0 - 2, gy - 6.5, pw + 4, 2.5);
        ctx.fillStyle = rgba(mix(INK, P.roof, 0.4), 0.28);
        ctx.fillRect(x0, gy - 6.5 - ph, pw, ph);
        const cols = [0, 0.27, 0.5, 0.73, 1];
        for (const t of cols) {
          const x = x0 + t * pw;
          ctx.fillStyle = hgrad(x - 1.8, x + 1.8, [[0, mix(stone, '#ffffff', 0.5)], [0.6, stone], [1, shade(stone, -0.18)]]);
          ctx.fillRect(x - 1.8, gy - 6.5 - ph, 3.6, ph);
        }
        // Geländer zwischen den Säulen
        rects([[x0, gy - 14, pw, 1.2], [x0, gy - 9.5, pw, 0.8]], mix(stone, CREAM, 0.3));
        const ry = gy - 6.5 - ph;
        ctx.fillStyle = mix(stone, CREAM, 0.3);
        ctx.fillRect(x0 - 3, ry - 3, pw + 6, 3.2);
        ctx.beginPath();
        ctx.moveTo(x0 - 6, ry - 2.5);
        ctx.quadraticCurveTo(x0 - 2, ry - 6, x0 + 2, ry - 9);
        ctx.quadraticCurveTo(cx, ry - 26, x0 + pw - 2, ry - 9);
        ctx.quadraticCurveTo(x0 + pw + 2, ry - 6, x0 + pw + 6, ry - 2.5);
        ctx.closePath();
        ctx.fillStyle = hgrad(x0 - 6, x0 + pw + 6, [[0, mix(roof, CREAM, 0.45)], [0.35, roof], [0.75, shade(roof, -0.12)], [1, shade(roof, -0.25)]]);
        ctx.fill();
        segs([[cx - 9, ry - 6, cx - 6, ry - 15], [cx, ry - 3, cx, ry - 17], [cx + 9, ry - 6, cx + 6, ry - 15]], rgba(shade(roof, -0.3), 0.4), 0.8);
        line(cx, ry - 18, cx, ry - 25, shade(P.stone, -0.25), 1.2);
        circle(cx, ry - 25.5, 1.8, mix(C.accent, CREAM, 0.2));
        // Beete und Büsche am Fuß
        const bush = [];
        for (const bx of [cx - 22, cx + 24, cx - 60, cx + 70]) bush.push([bx, footY(yAt, bx - 3, bx + 3) + 5, 4 + r() * 2]);
        dots(bush.map(([a, b, c]) => [a + 1, b + 1, c]), P.green.dark);
        dots(bush, P.green.crown);
        blooms(bush.map(([a, b, c]) => [a - 1, b - c * 0.4, 2, 0.5]), P.pink.lit, null);
      },
      tex: { grain: 0.035 }
    },
    avenue: {
      size: r => [310 + r() * 40, 116],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 432 + r() * 6);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.22, skew: 0.1, wob: 0.6, flowers: 0.08 });
        // Weg als helles Band entlang der Kuppe
        const pathY = x => yAt(x) + 10;
        let xa = w, xb = 0;
        for (let x = 0; x <= w; x += 4) if (yAt(x) <= top + 5) { xa = Math.min(xa, x); xb = Math.max(xb, x); }
        ctx.beginPath();
        ctx.moveTo(xa - 10, pathY(xa - 10) + 6);
        for (let x = xa - 10; x <= xb + 10; x += 6) ctx.lineTo(x, pathY(x));
        for (let x = xb + 10; x >= xa - 10; x -= 6) ctx.lineTo(x, pathY(x) + 4.5);
        ctx.closePath();
        ctx.fillStyle = P.path;
        ctx.fill();
        // gleichmäßige Baumreihe hinter dem Weg
        const set = r() < 0.6 ? P.pink : P.white, n = Math.max(4, Math.floor((xb - xa) / 38));
        for (let k = 0; k <= n; k++) {
          const x = lerp(xa + 8, xb - 8, k / n);
          bloomTree(x, pathY(x) - 1, 0.95, set, P.bark, mulberry32(it.seed + k * 7), { wide: 1.05 });
        }
        // Bänke und Laternen am Weg, niedrige Hecke davor
        for (let k = 0; k < n; k += 2) {
          const x = lerp(xa + 8, xb - 8, (k + 0.5) / n), y = pathY(x) + 1;
          rects([[x - 5, y - 3.5, 10, 1.2], [x - 4.5, y - 3, 0.9, 3], [x + 3.6, y - 3, 0.9, 3], [x - 5, y - 6, 10, 0.9]], shade(P.wood, -0.1));
        }
        const hed = [];
        for (let x = xa - 6; x <= xb + 6; x += 2.6) hed.push([x, pathY(x) + 8 + Math.sin(x * 0.5) * 0.5, 2.4]);
        dots(hed.map(([a, b, c]) => [a + 0.6, b + 0.8, c]), P.green.dark);
        dots(hed, P.green.crown);
      },
      tex: { grain: 0.035 }
    },
    hives: {
      size: r => [270 + r() * 40, 118],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 436 + r() * 6);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.32, skew: 0.2 });
        // Gartenhäuschen hinten rechts
        const hx = w * 0.72, hy = footY(yAt, hx, hx + 22);
        ctx.fillStyle = vgrad(hy - 14, hy, [[0, P.wall], [1, shade(P.wall, -0.1)]]);
        ctx.fillRect(hx, hy - 13, 22, 13);
        poly([[hx - 3, hy - 12], [hx + 11, hy - 22], [hx + 25, hy - 12]], vgrad(hy - 22, hy - 12, [[0, mix(P.roof2, CREAM, 0.2)], [1, shade(P.roof2, -0.1)]]));
        ctx.fillStyle = shade(P.wood, -0.3);
        ctx.fillRect(hx + 8, hy - 8, 5, 8);
        ctx.fillStyle = mix(P.water, CREAM, 0.3);
        ctx.fillRect(hx + 15, hy - 10, 4, 3.5);
        // Beete in Streifen
        for (let k = 0, bx = w * 0.07; k < 4 && bx < w * 0.62; k++) {
          const bw = 24 + r() * 10, by = footY(yAt, bx, bx + bw) + 7, c = P.tulip[(k + Math.floor(it.seed % 4)) % 4], fl = [];
          ellipse(bx + bw / 2, by + 1.5, bw / 2 + 2, 4.2, 0, rgba(shade(P.lawn, -0.4), 0.45));
          for (let row = 0; row < 2; row++) for (let x = bx + 2 + row * 1.6; x < bx + bw - 1; x += 3.2) fl.push([x, by - 1 + row * 3, 1.3 + r() * 0.4]);
          dots(fl.map(([a, b2, d]) => [a + 0.4, b2 + 0.6, d]), rgba(INK, 0.14));
          dots(fl, c);
          bx += bw + 8 + r() * 8;
        }
        // Bienenstöcke: Kästen in Pastell auf Böckchen, ein Strohkorb
        const hv = [];
        for (let k = 0; k < 4; k++) hv.push(w * (0.12 + k * 0.13) + (r() - 0.5) * 4);
        hv.forEach((x, k) => {
          const y = footY(yAt, x, x + 12) - 2, c = P.hive[k % P.hive.length];
          ellipse(x + 9, y + 2, 10, 1.8, 0, rgba(INK, 0.14));
          rects([[x + 1, y - 3, 1.2, 4], [x + 10, y - 3, 1.2, 4]], shade(P.wood, -0.3));
          if (k === 2) {
            // Strohkorb
            ctx.beginPath();
            ctx.moveTo(x, y - 3);
            ctx.bezierCurveTo(x - 1, y - 17, x + 13, y - 17, x + 12, y - 3);
            ctx.closePath();
            ctx.fillStyle = hgrad(x, x + 12, [[0, mix(P.straw, CREAM, 0.4)], [0.6, P.straw], [1, shade(P.straw, -0.2)]]);
            ctx.fill();
            segs([[x + 0.5, y - 6.5, x + 11.5, y - 6.5], [x + 1, y - 10, x + 11, y - 10], [x + 2.5, y - 13, x + 9.5, y - 13]], rgba(shade(P.straw, -0.35), 0.5), 0.7);
            ctx.fillStyle = rgba(INK, 0.5);
            ctx.fillRect(x + 5, y - 5, 2.4, 1.6);
          } else {
            const bh = 11;
            ctx.fillStyle = hgrad(x, x + 12, [[0, mix(c, '#ffffff', 0.4)], [0.65, c], [1, shade(c, -0.18)]]);
            ctx.fillRect(x, y - 3 - bh, 12, bh);
            rects([[x, y - 3 - bh * 0.5, 12, 0.7]], rgba(INK, 0.16));
            poly([[x - 1.5, y - 3 - bh], [x + 6, y - 7 - bh], [x + 13.5, y - 3 - bh]], mix(P.roof2, CREAM, 0.1));
            ctx.fillStyle = rgba(INK, 0.45);
            ctx.fillRect(x + 4, y - 4.6, 4, 1.2);
          }
        });
        // ein paar Bienen
        const bees = [];
        for (let k = 0; k < 7; k++) bees.push([w * (0.1 + r() * 0.55), top - 4 - r() * 12, 0.9]);
        dots(bees, mix(C.accent, INK, 0.25));
        // Blütenbaum und Zaun
        bloomTree(w * 0.86, footY(yAt, w * 0.84, w * 0.88) + 3, 1.0, P.white, P.bark, r);
        let xa = w, xb = 0;
        for (let x = 0; x <= w; x += 4) if (yAt(x) <= top + 22) { xa = Math.min(xa, x); xb = Math.max(xb, x); }
        if (xb - xa > 30) picket(x => yAt(x) + 22, xa + 4, xb - 4, mix(CREAM, '#ffffff', 0.4), 6, 4);
      },
      tex: { grain: 0.035 }
    },
    bridge: {
      size: r => [250 + r() * 40, 120],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 436 + r() * 6);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.3, flowers: 0.1 });
        const bx = w * 0.5, by = top + 12, bw = 56;
        // Bach als Band quer über die Kuppe
        ctx.beginPath();
        ctx.moveTo(bx - 22, by - 4);
        ctx.quadraticCurveTo(bx - 4, by + 10, bx - 18, h);
        ctx.lineTo(bx + 16, h);
        ctx.quadraticCurveTo(bx + 18, by + 10, bx + 22, by - 4);
        ctx.closePath();
        ctx.fillStyle = vgrad(by - 4, h, [[0, mix(P.water, CREAM, 0.3)], [1, P.water]]);
        ctx.fill();
        rects([[bx - 10, by + 6, 14, 0.7], [bx - 6, by + 14, 16, 0.7], [bx - 14, by + 24, 12, 0.7]], rgba('#ffffff', 0.5));
        ellipses([[bx - 6, by + 10, 1.2, 0.6, 0.4], [bx + 4, by + 19, 1.2, 0.6, 1], [bx - 2, by + 28, 1.3, 0.6, 2]], P.pink.crown);
        // Bogenbrücke aus hellem Stein
        const stone = P.stone, deck = by - 7;
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2, by + 2);
        ctx.quadraticCurveTo(bx, deck - 12, bx + bw / 2, by + 2);
        ctx.lineTo(bx + bw / 2 - 6, by + 2);
        ctx.quadraticCurveTo(bx, deck + 4, bx - bw / 2 + 6, by + 2);
        ctx.closePath();
        ctx.fillStyle = hgrad(bx - bw / 2, bx + bw / 2, [[0, mix(stone, '#ffffff', 0.4)], [0.5, stone], [1, shade(stone, -0.16)]]);
        ctx.fill();
        ctx.strokeStyle = rgba(INK, 0.18);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Geländer
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2 + 2, by - 3);
        ctx.quadraticCurveTo(bx, deck - 20, bx + bw / 2 - 2, by - 3);
        ctx.strokeStyle = mix(stone, CREAM, 0.2);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        const posts = [];
        for (let k = 0; k <= 6; k++) { const t = k / 6, x = lerp(bx - bw / 2 + 2, bx + bw / 2 - 2, t), y0 = (1 - t) * (1 - t) * (by - 3) + 2 * (1 - t) * t * (deck - 20) + t * t * (by - 3); posts.push([x - 0.5, y0, 1, 5.5]); }
        rects(posts, mix(stone, CREAM, 0.15));
        bloomTree(bx - bw / 2 - 26, footY(yAt, bx - bw / 2 - 30, bx - bw / 2 - 22) + 3, 1.1, P.pink, P.bark, r);
        bloomTree(bx + bw / 2 + 30, footY(yAt, bx + bw / 2 + 26, bx + bw / 2 + 34) + 3, 0.9, P.deep, P.bark, r);
      },
      tex: { grain: 0.035 }
    },
    bigtree: {
      size: r => [220 + r() * 30, 168],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.1), top = toLocal(it, h, 428 + r() * 6);
        const yAt = mound(w, h, top, P.lawn, it, { p: 0.4, flowers: 0.12 });
        const tx = w * 0.46, ty = footY(yAt, tx - 4, tx + 4) + 4;
        petalCarpet(yAt, w * 0.2, w * 0.8, 3, P.pink.crown, r, 70);
        bloomTree(tx, ty, 2.1, P.pink, P.bark, r, { wide: 1.08, trunk: 17 });
        // Schaukel am rechten Ast
        const sx = tx + 15, sy = ty - 36;
        segs([[sx - 3, sy, sx - 3, ty - 9], [sx + 4, sy - 1, sx + 4, ty - 9]], rgba(mix(P.wood, INK, 0.3), 0.8), 0.6);
        ctx.fillStyle = shade(P.wood, -0.15);
        ctx.fillRect(sx - 5, ty - 9.5, 11, 1.8);
        // Picknickdecke mit Korb
        const bx = tx - 38, byy = footY(yAt, bx - 10, bx + 10) + 4;
        poly([[bx - 13, byy], [bx - 8, byy - 4], [bx + 12, byy - 4], [bx + 15, byy]], mix(CREAM, '#ffffff', 0.4));
        rects([[bx - 9, byy - 4, 4, 4], [bx - 1, byy - 4, 4, 4], [bx + 7, byy - 4, 4, 4]], rgba(mix(P.roof2, '#e07070', 0.4), 0.7));
        ctx.fillStyle = P.straw;
        ctx.fillRect(bx + 3, byy - 8, 6, 4);
        ctx.strokeStyle = shade(P.straw, -0.3);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(bx + 6, byy - 8, 2.4, Math.PI, TAU);
        ctx.stroke();
      },
      tex: { grain: 0.035 }
    }
  };
  // ferne Spur hinter Ebene 0 (Kamm 380 bis 430)
  const bFar = {
    fgrove: {
      size: r => [200 + r() * 60, 104],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.3), hill = mix(mix(C.near, C.skyTop, 0.25), C.haze, 0.42);
        const yAt = mound(w, h, toLocal(it, h, 330 + r() * 10), hill, it, { p: 0.65, rim: 0.3 });
        const sets = [P.pink, P.white, P.pink, P.green], b = sets.map(() => []);
        for (let k = 0; k < w * 0.55; k++) {
          const x = 4 + r() * (w - 8), e = Math.sin(Math.PI * x / w);
          if (e < 0.25) continue;
          b[Math.floor(r() * sets.length)].push([x, yAt(x) + 2 + r() * (h - yAt(x)) * 0.5, 2 + r() * 2.4 * e]);
        }
        b.forEach((list, k) => { dots(list.map(([a, c, d]) => [a + 0.6, c + 0.8, d]), sets[k].dark); dots(list, sets[k].crown); });
        hazeOver(w, h, C.haze, 0.3, 0.5, 0, h);
      },
      tex: null
    },
    forchard: {
      size: r => [240 + r() * 60, 92],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.3), hill = mix(mix(C.near, C.skyTop, 0.25), C.haze, 0.42), top = toLocal(it, h, 346 + r() * 8);
        const yAt = mound(w, h, top, hill, it, { p: 0.35, rim: 0.3 });
        const sh = [], pk = [], wh = [];
        for (let row = 0; row < 6; row++) {
          for (let x = 10 + (row % 2) * 3; x < w - 10; x += 6.5) {
            const y = yAt(x) + 4 + row * 5 + (r() - 0.5);
            if (y > h - 4 || yAt(x) > top + 30) continue;
            const rr = 1.6 + r() * 0.5;
            sh.push([x + 0.5, y + 0.7, rr]);
            (r() < 0.6 ? pk : wh).push([x, y, rr]);
          }
        }
        dots(sh, rgba(P.pink.dark, 0.6));
        dots(pk, P.pink.crown);
        dots(wh, P.white.crown);
        hazeOver(w, h, C.haze, 0.36, 0.55, 0, h);
      },
      tex: null
    },
    flone: {
      size: r => [190 + r() * 40, 118],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.3), hill = mix(mix(C.near, C.skyTop, 0.25), C.haze, 0.42);
        const yAt = mound(w, h, toLocal(it, h, 340 + r() * 8), hill, it, { p: 0.8, skew: 0.5, rim: 0.3 });
        let px = 0;
        for (let x = 0; x < w; x += 2) if (yAt(x) < yAt(px)) px = x;
        bloomTree(px, yAt(px) + 2, 1.15, P.pink, P.bark, r, { noShadow: true, wide: 1.1 });
        const dk = [];
        for (let k = 0; k < 24; k++) { const x = r() * w; if (Math.abs(x - px) > 16) dk.push([x, yAt(x) + 3 + r() * 10, 1.8 + r() * 1.6]); }
        dots(dk, P.white.crown);
        hazeOver(w, h, C.haze, 0.3, 0.5, 0, h);
      },
      tex: null
    },
    fhamlet: {
      size: r => [220 + r() * 50, 100],
      paint: (w, h, r, C, L, it) => {
        const P = bloomPal(C, 0.3), hill = mix(mix(C.near, C.skyTop, 0.25), C.haze, 0.42), top = toLocal(it, h, 344 + r() * 8);
        const yAt = mound(w, h, top, hill, it, { p: 0.45, rim: 0.3 });
        const roofs = [P.roof2, P.roof, mix(P.roof2, CREAM, 0.2)];
        for (let x = w * 0.25; x < w * 0.75; x += 12 + r() * 8) {
          const y = footY(yAt, x, x + 10) + 1 + r() * 2, hw = 8 + r() * 3, hh = 5 + r() * 2;
          ctx.fillStyle = P.wall;
          ctx.fillRect(x, y - hh, hw, hh);
          ctx.fillStyle = rgba(INK, 0.1);
          ctx.fillRect(x + hw * 0.6, y - hh, hw * 0.4, hh);
          poly([[x - 1.2, y - hh], [x + hw * 0.5, y - hh - 4.5], [x + hw + 1.2, y - hh]], pickOf(r, roofs));
        }
        const tr = [[], []];
        for (let k = 0; k < 30; k++) { const x = r() * w; tr[k % 2].push([x, yAt(x) + 2 + r() * 12, 2 + r() * 1.8]); }
        dots(tr[0], P.pink.crown);
        dots(tr[1], P.white.crown);
        hazeOver(w, h, C.haze, 0.3, 0.5, 0, h);
      },
      tex: null
    }
  };
  SCENE['Blütenhain'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 20, gap: [30, 150], maxKs: 1.5, base: () => B_FAR,
        pick: flow(['fgrove', 'forchard', 'flone', 'fhamlet'], [['fgrove', 2], ['forchard', 2], ['flone', 1.4], ['fhamlet', 1.4]], 1),
        kinds: bFar },
      { z: 1, factor: 0.36, start: 10, gap: [-10, 60], maxKs: 2, base: () => B_MID,
        pick: flow(['grove', 'pond', 'pavilion', 'avenue', 'hives'],
          [['grove', 2], ['pond', 1.4], ['pavilion', 1.2], ['avenue', 1.4], ['hives', 1.3], ['bridge', 1.3], ['bigtree', 1.2]], 3),
        kinds: bMid }
    ]
  };

  // ============================================================
  // LAGUNE (Level 4): tropische Lagune am Nachmittag
  // ============================================================
  const L_HZ = 392;   // Horizont
  function lagPal(C, hz) {
    const key = 'l' + C.pipe + C.far + C.skyTop + (hz || 0);
    let P = palCache.get(key);
    if (P) return P;
    P = {
      sand: mix('#f4dfb2', CREAM, 0.3), sandDk: mix('#d9b67e', C.pipe, 0.3), wet: mix('#c9a57a', C.near, 0.18),
      seaFar: mix('#3a9db6', C.skyTop, 0.25), sea: mix(C.far, '#2fb6bd', 0.45), shallow: mix(C.far, '#c6f2e2', 0.45), foam: mix(CREAM, '#ffffff', 0.6),
      leaf: mix('#3f9a58', C.near, 0.25), leafDk: mix('#22654a', C.near, 0.2), leafLt: mix('#86c46a', CREAM, 0.12),
      trunk: mix(C.pipe, '#8d6a4a', 0.4), wood: mix('#9c7552', C.pipe, 0.2), woodDk: mix('#6e5038', INK, 0.1), thatch: mix('#d6ad64', C.pipe, 0.35),
      rock: mix('#a69c8e', C.far, 0.15), coconut: '#8a6a3c',
      hull: [mix(CREAM, '#ffffff', 0.4), mix(C.accent, CREAM, 0.12), mix('#3d8fb0', CREAM, 0.15), mix('#f2c45a', CREAM, 0.2)],
      sail: mix(CREAM, C.skyBottom, 0.25), island: mix('#4f9f6a', C.far, 0.3), flower: mix('#f07aa0', C.accent, 0.3)
    };
    if (hz) hazeAll(P, C.haze, hz);
    palCache.set(key, P);
    return P;
  }

  // Palmwedel: Mittelrippe als Kurve, Fiedern als schmale Dreiecke zu beiden Seiten.
  // Die Fiedern der Oberseite (nach oben weisend) im Licht, die anderen im Schatten.
  function frond(out, x0, y0, ang, len, droop, wid) {
    const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len + droop;
    const mx = x0 + Math.cos(ang) * len * 0.55, my = y0 + Math.sin(ang) * len * 0.55 - Math.abs(droop) * 0.3;
    const pt = t => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * ex, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * ey];
    out.rib.push([x0, y0, mx, my, ex, ey]);
    for (let t = 0.1; t < 0.99; t += 0.075) {
      const p = pt(t), q = pt(t + 0.03), dx = q[0] - p[0], dy = q[1] - p[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
      const ll = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.7) * (1 - t * 0.35);
      for (const sd of [1, -1]) {
        const nx = -uy * sd, ny = ux * sd;
        const tx = p[0] + nx * ll + ux * ll * 0.55, ty = p[1] + ny * ll + uy * ll * 0.55 + ll * 0.35;
        (ny < 0.15 ? out.lit : out.dark).push([p[0] - ux * 1.6, p[1] - uy * 1.6, tx, ty, p[0] + ux * 1.6, p[1] + uy * 1.6]);
      }
    }
  }
  function frondPaint(out, lit, dark, rib, lw) {
    for (const [list, c] of [[out.dark, dark], [out.lit, lit]]) {
      if (!list.length) continue;
      ctx.beginPath();
      for (const [a, b, c2, d, e, f] of list) { ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.lineTo(e, f); ctx.closePath(); }
      ctx.fillStyle = c;
      ctx.fill();
    }
    ctx.beginPath();
    for (const [a, b, c2, d, e, f] of out.rib) { ctx.moveTo(a, b); ctx.quadraticCurveTo(c2, d, e, f); }
    ctx.strokeStyle = rib;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // Palme: gebogener Stamm mit Ringen, Wedelkrone und Kokosnüssen. x, y Fußpunkt, hgt Höhe, lean Neigung an der Spitze
  function palm(x, y, hgt, lean, s, pal, r, o) {
    o = o || {};
    const tx = x + lean, ty = y - hgt, cx = x + lean * 0.1, cy = y - hgt * 0.5;
    if (!o.noShadow) ellipse(x + 6 * s, y + 0.5, 11 * s, 1.8 * s, 0, rgba(INK, 0.13));
    const pt = t => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * tx, (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ty];
    const L = [], R = [], rings = [];
    for (let t = 0; t <= 1.001; t += 0.1) {
      const p = pt(t), q = pt(Math.min(1, t + 0.02)), p0 = pt(Math.max(0, t - 0.02)), dx = q[0] - p0[0], dy = q[1] - p0[1], dl = Math.hypot(dx, dy) || 1;
      const wd = lerp(3.2, 1.7, t) * s, nx = -dy / dl, ny = dx / dl;
      L.push([p[0] - nx * wd, p[1] - ny * wd]);
      R.push([p[0] + nx * wd, p[1] + ny * wd]);
    }
    for (let t = 0.04; t < 0.97; t += 0.045 / Math.max(0.6, s)) {
      const p = pt(t), q = pt(t + 0.02), dx = q[0] - p[0], dy = q[1] - p[1], dl = Math.hypot(dx, dy) || 1, wd = lerp(3.2, 1.7, t) * s;
      rings.push([p[0] + dy / dl * wd, p[1] - dx / dl * wd, p[0] - dy / dl * wd, p[1] + dx / dl * wd]);
    }
    poly(L.concat(R.slice().reverse()), pal.trunk);
    // Schattenseite rechts
    const mid = L.map((p, k) => [(p[0] + R[k][0]) / 2 + (R[k][0] - p[0]) * 0.1, (p[1] + R[k][1]) / 2]);
    poly(mid.concat(R.slice().reverse()), shade(pal.trunk, -0.2));
    segs(rings, rgba(INK, 0.22), Math.max(0.6, 0.8 * s));
    // Krone
    const n = o.fronds || 7;
    const angs = [-2.95, -2.45, -1.95, -1.25, -0.75, -0.25, 0.2, -1.6, 2.8].slice(0, n);
    if (s < 0.55) {
      // kleine, ferne Palmen: Wedel als einfache Bögen
      ctx.beginPath();
      for (const a of angs) {
        const len = (20 + r() * 6) * s, ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len + 5 * s;
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 3 * s, ex, ey);
      }
      ctx.strokeStyle = pal.leaf;
      ctx.lineWidth = Math.max(1, 3 * s);
      ctx.stroke();
      return [tx, ty];
    }
    const out = { lit: [], dark: [], rib: [] };
    for (const a of angs) {
      const aa = a + (r() - 0.5) * 0.2, len = (23 + r() * 8) * s * (Math.abs(aa + Math.PI / 2) < 0.6 ? 0.72 : 1);
      frond(out, tx, ty, aa, len, (6 + r() * 5) * s * (Math.abs(Math.cos(aa)) + 0.2), 5.6 * s);
    }
    frondPaint(out, pal.leafLt, pal.leafDk, pal.leaf, Math.max(0.6, 0.9 * s));
    if (o.nuts !== false && s > 0.5) {
      const nuts = [[tx - 2 * s, ty + 2.5 * s, 2 * s], [tx + 1.8 * s, ty + 3 * s, 1.9 * s], [tx, ty + 4.6 * s, 1.8 * s]];
      dots(nuts, pal.coconut);
      dots(nuts.map(([a, b, c]) => [a - c * 0.3, b - c * 0.35, c * 0.35]), rgba(CREAM, 0.3));
    }
    return [tx, ty];
  }
  // Muscheln und Schnecken als kleine Formen (Boden, Requisiten)
  function shells(list, C, pal) {
    // [x, y, Größe, Art]
    const sc = list.filter(s => s[3] === 0), cn = list.filter(s => s[3] === 1), st = list.filter(s => s[3] === 2);
    for (const [x, y, s] of sc) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.6);
      ctx.arc(x, y - s * 0.1, s, Math.PI * 0.8, Math.PI * 2.2);
      ctx.closePath();
      ctx.fillStyle = mix(C.accent, CREAM, 0.45);
      ctx.fill();
      segs([[x, y + s * 0.5, x - s * 0.7, y - s * 0.6], [x, y + s * 0.5, x, y - s * 1.05], [x, y + s * 0.5, x + s * 0.7, y - s * 0.6]], rgba(shade(C.accent, -0.3), 0.5), 0.5);
    }
    ellipses(cn.map(([x, y, s]) => [x, y, s * 1.3, s * 0.65, -0.4]), mix(pal.sand, '#e8c8b8', 0.5));
    ellipses(cn.map(([x, y, s]) => [x - s * 0.3, y - s * 0.2, s * 0.5, s * 0.25, -0.4]), rgba('#ffffff', 0.45));
    for (const [x, y, s] of st) {
      const pts = [];
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.42 : s; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6]); }
      poly(pts.map(([a, b]) => [a + 0.5, b + 0.6]), rgba(INK, 0.18));
      poly(pts, mix(C.accent, '#f0a050', 0.4));
    }
  }

  // ---------- Himmel mit Meer bis zum Strand ----------
  ART2.sky.blLagoon = (C, S, rng) => {
    const pal = lagPal(C), sx = S.sunX <= 1 ? S.sunX * W : S.sunX;
    ctx.fillStyle = vgrad(170, L_HZ, [[0, rgba(C.skyBottom, 0)], [1, rgba(mix(C.skyBottom, '#ffc896', 0.25), 0.6)]]);
    ctx.fillRect(0, 170, W, L_HZ - 170);
    // Passatwolken mit flacher Basis
    const lit = mix(CREAM, '#ffffff', 0.65), mid = mix(CREAM, C.skyBottom, 0.45), low = mix(mix(C.skyTop, '#b4a8cc', 0.4), CREAM, 0.3);
    const n = Math.max(2, Math.round(W / 260));
    for (let k = 0; k < n; k++) {
      let x = (k + 0.1 + rng() * 0.8) * W / n;
      const y = 300 + rng() * 46, cw = 30 + rng() * 50, ch = 16 + rng() * 30 * (1 - (y - 300) / 80);
      if (Math.abs(x - sx) < 70) x += x < sx ? -70 : 70;
      a2Billow(a2Heap(x, y, cw, ch, rng), y - ch - 12, y + 3, lit, mid, low, 0.5, 0.3, null);
    }
    for (let k = 0, m = Math.max(1, Math.round(W / 500)); k < m; k++) {
      const x = (k + 0.3 + rng() * 0.4) * W / m, y = 200 + rng() * 40;
      if (Math.abs(x - sx) < 120) continue;
      a2Billow(a2Heap(x, y, 26 + rng() * 16, 12 + rng() * 8, rng), y - 26, y + 3, lit, mid, low, 0.4, 0.22, null);
    }
    ctx.fillStyle = vgrad(330, L_HZ, [[0, rgba(C.skyBottom, 0)], [1, rgba(C.skyBottom, 0.5)]]);
    ctx.fillRect(0, 330, W, L_HZ - 330);
    // ferne Inseln, kaum sichtbar
    const isl = mix(mix(pal.island, C.skyTop, 0.3), C.haze, 0.62);
    for (let x = -60 + rng() * 120; x < W + 60; x += 260 + rng() * 300) {
      const iw = 80 + rng() * 120, ih = 10 + rng() * 18;
      ctx.beginPath();
      ctx.moveTo(x - iw / 2, L_HZ + 0.5);
      ctx.bezierCurveTo(x - iw * 0.3, L_HZ - ih * 0.6, x - iw * 0.1, L_HZ - ih, x + iw * 0.05, L_HZ - ih);
      ctx.bezierCurveTo(x + iw * 0.25, L_HZ - ih * 0.9, x + iw * 0.3, L_HZ - ih * 0.4, x + iw / 2, L_HZ + 0.5);
      ctx.closePath();
      ctx.fillStyle = isl;
      ctx.fill();
    }
    // Meer: am Horizont tief und dunstig, nach vorn heller Türkis
    ctx.fillStyle = vgrad(L_HZ, GROUND_Y + 10, [[0, mix(pal.seaFar, C.haze, 0.35)], [0.1, pal.seaFar], [0.5, pal.sea], [1, mix(pal.sea, pal.shallow, 0.5)]]);
    ctx.fillRect(0, L_HZ, W, H - L_HZ);
    ctx.fillStyle = rgba(CREAM, 0.35);
    ctx.fillRect(0, L_HZ, W, 1);
    // Glitzerspur unter der Sonne
    const gl = [[], [], []];
    for (let y = L_HZ + 2; y < GROUND_Y; y += 2.6 + (y - L_HZ) * 0.03) {
      const d = (y - L_HZ) / (GROUND_Y - L_HZ), spread = 16 + d * 90, m = 3 + Math.round(d * 5);
      for (let k = 0; k < m; k++) {
        const off = (rng() - 0.5) * 2 * spread, a = 1 - Math.abs(off) / spread;
        gl[a > 0.66 ? 0 : a > 0.33 ? 1 : 2].push([sx + off, y, 2 + rng() * (4 + d * 10), 0.8 + d * 0.6]);
      }
    }
    rects(gl[0], rgba(mix(CREAM, '#fff2c8', 0.5), 0.6));
    rects(gl[1], rgba(CREAM, 0.38));
    rects(gl[2], rgba(CREAM, 0.18));
    // ruhige Streifen auf dem Wasser
    const st = [], sd = [];
    for (let k = 0; k < W / 10; k++) {
      const y = L_HZ + 4 + Math.pow(rng(), 1.3) * (GROUND_Y - L_HZ - 4), d = (y - L_HZ) / (GROUND_Y - L_HZ);
      (rng() < 0.6 ? st : sd).push([rng() * W, y, 10 + rng() * 40 * (0.4 + d), 0.6 + d * 0.6]);
    }
    rects(st, rgba(pal.shallow, 0.22));
    rects(sd, rgba(pal.seaFar, 0.12));
  };

  // ---------- Ebene 0: Riffkante mit Brandung, flache Sandbänke ----------
  ART2.layerExtent.blReef = () => [380, 492];
  ART2.layerTex.blReef = () => ({ grain: 0.025, mottle: 0.05, contrast: 1 });
  ART2.layer.blReef = (l, i, C, col, rng) => {
    const P = l.P, pal = lagPal(C, 0.35), fy = x => 414 + 3 * Math.sin(x * TAU / P * 3 + 1) + 2 * Math.sin(x * TAU / P * 7 + l.seed);
    // innerhalb des Riffs heller
    ctx.beginPath();
    ctx.moveTo(-8, fy(-8) + 2);
    for (let x = -8; x <= P + 8; x += 8) ctx.lineTo(x, fy(x) + 2);
    ctx.lineTo(P + 8, 492);
    ctx.lineTo(-8, 492);
    ctx.closePath();
    ctx.fillStyle = vgrad(410, 492, [[0, rgba(pal.shallow, 0.32)], [0.5, rgba(pal.shallow, 0.12)], [1, rgba(pal.shallow, 0)]]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, fy(-8) - 3);
    for (let x = -8; x <= P + 8; x += 8) ctx.lineTo(x, fy(x) - 3);
    for (let x = P + 8; x >= -8; x -= 8) ctx.lineTo(x, fy(x) + 1);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.seaFar, 0.18);
    ctx.fill();
    // Brandung am Riff
    const fm = [], fm2 = [];
    for (let x = 0; x < P; x += 2.5 + rng() * 3) {
      if (pnoise(x / P * 22, 22, l.seed) < 0.38) continue;
      (rng() < 0.6 ? fm : fm2).push([x, fy(x) - rng() * 1.6, 2 + rng() * 6, 1.1]);
    }
    rects(fm, rgba(pal.foam, 0.6));
    rects(fm2, rgba(pal.foam, 0.32));
    // Sandbänke mit Flachwasserhof, einige mit kleinen Palmen
    for (let k = 0; k < 3; k++) {
      const x = (k + 0.2 + rng() * 0.6) * P / 3, y = 432 + rng() * 22, rx = 26 + rng() * 44, ry = 2.2 + rng() * 1.6, seed = (rng() * 1e6) | 0, palms = rng() < 0.7 ? 1 + Math.floor(rng() * 3) : 0;
      wrapEach(x, P, rx + 20, xx => {
        const rr = mulberry32(seed);
        ellipse(xx, y + 0.5, rx + 16, ry + 5, 0, rgba(pal.shallow, 0.4));
        ellipse(xx, y, rx, ry, 0, vgrad(y - ry, y + ry, [[0, mix(pal.sand, '#ffffff', 0.3)], [1, pal.sandDk]]));
        for (let j = 0; j < palms; j++) {
          const px = xx + (rr() - 0.5) * rx * 1.1;
          palm(px, y - 0.5, 12 + rr() * 8, (rr() - 0.5) * 6, 0.42, pal, rr, { noShadow: true, fronds: 6, nuts: false });
        }
      });
    }
    const st = [];
    for (let k = 0; k < P / 14; k++) { const y = 420 + rng() * 70; st.push([rng() * P, y, 12 + rng() * 40, 0.7 + (y - 420) * 0.008]); }
    rects(wrapList(st, P, 50), rgba(pal.foam, 0.12));
  };

  // ---------- Ebene 1: Strand mit Flachwasser, Palmen und Strandgut ----------
  ART2.layerExtent.blBeach = () => [330, GROUND_Y + 14];
  ART2.layerTex.blBeach = () => ({ grain: 0.035, mottle: 0.08, contrast: 1 });
  ART2.layer.blBeach = (l, i, C, col, rng) => {
    const P = l.P, yb = GROUND_Y + 14, f = ridgeFn(P, 500, 24, 0.004, l.seed), pal = lagPal(C, 0.12);
    // Flachwasser vor dem Ufer
    ctx.beginPath();
    ctx.moveTo(-8, f(-8) - 20);
    for (let x = -8; x <= P + 8; x += 6) ctx.lineTo(x, f(x) - 20 - 3 * Math.sin(x * TAU / P * 5));
    for (let x = P + 8; x >= -8; x -= 6) ctx.lineTo(x, f(x) + 2);
    ctx.closePath();
    ctx.fillStyle = vgrad(450, 500, [[0, rgba(pal.shallow, 0)], [0.6, rgba(pal.shallow, 0.55)], [1, rgba(mix(pal.shallow, pal.sand, 0.4), 0.8)]]);
    ctx.fill();
    // Sand
    ridgePath(f, -8, P + 8, 4, yb);
    ctx.fillStyle = vgrad(476, yb, [[0, mix(pal.sand, '#ffffff', 0.2)], [0.5, pal.sand], [1, shade(pal.sand, -0.08)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // nasser Saum und Rippel
    ridgeLine(f, -8, P + 8, 4, 2.2, rgba(pal.wet, 0.45), 3.4);
    const rp = [], gr = [];
    for (let k = 0; k < P / 16; k++) { const x = rng() * P, y = f(x) + 10 + rng() * 50; rp.push([x, y, 6 + rng() * 14, 0.7]); }
    rects(rp, rgba(pal.sandDk, 0.3));
    for (let k = 0; k < P / 3; k++) { const x = rng() * P; gr.push([x, f(x) + 4 + rng() * 60, 0.45]); }
    dots(gr, rgba(pal.sandDk, 0.4));
    ctx.restore();
    // Schaumsaum
    ctx.beginPath();
    ctx.moveTo(-8, f(-8) - 0.5);
    for (let x = -8; x <= P + 8; x += 4) ctx.lineTo(x, f(x) - 0.5 + Math.sin(x * TAU / P * 31) * 0.8);
    ctx.strokeStyle = rgba(pal.foam, 0.85);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const lace = [];
    for (let x = 0; x < P; x += 3 + rng() * 4) lace.push([x, f(x) - 2.2 - rng() * 2, 0.8 + rng() * 1.1]);
    dots(wrapList(lace, P, 3), rgba(pal.foam, 0.55));
    // Felsen, Strandgras, Muscheln
    for (let k = 0; k < 5; k++) {
      const x = rng() * P, y = f(x) + 8 + rng() * 22, s = 0.7 + rng() * 0.7, seed = (rng() * 1e6) | 0;
      wrapEach(x, P, 20 * s, xx => {
        const rr = mulberry32(seed), pts = [];
        for (let j = 0; j < 7; j++) { const a = Math.PI + j * Math.PI / 6, d = (7 + rr() * 4) * s; pts.push([xx + Math.cos(a) * d * 1.4, y + Math.sin(a) * d * 0.9]); }
        ellipse(xx + 5 * s, y + 1, 12 * s, 2 * s, 0, rgba(INK, 0.12));
        poly(pts, pal.rock);
        poly(pts.slice(3).concat([[xx, y]]), shade(pal.rock, -0.15));
        poly(pts.slice(0, 4).map(([a, b]) => [a + (xx - a) * 0.3, b + (y - b) * 0.25]).concat([[xx - 2 * s, y - 2 * s]]), rgba(CREAM, 0.25));
      });
    }
    const sh = [];
    for (let k = 0; k < P / 60; k++) { const x = rng() * P; sh.push([x, f(x) + 8 + rng() * 40, 1.4 + rng() * 1.2, Math.floor(rng() * 3)]); }
    shells(wrapList(sh, P, 6), C, pal);
    // Boot am Strand, Palmen
    const bx = rng() * P, bseed = (rng() * 1e6) | 0;
    wrapEach(bx, P, 40, xx => beachBoat(xx, f(bx) + 16, 1, pal, mulberry32(bseed)));
    const items = [];
    for (let x = 60 + rng() * 120; x < P; x += 220 + rng() * 240) {
      const n = rng() < 0.4 ? 2 : 1;
      for (let j = 0; j < n; j++) items.push([x + j * (18 + rng() * 14), f(x) + 10 + rng() * 10, 70 + rng() * 50, (rng() < 0.5 ? -1 : 1) * (10 + rng() * 22), 0.95 + rng() * 0.25, (rng() * 1e6) | 0]);
    }
    items.sort((a, b) => a[1] - b[1]);
    for (const [x, y, hgt, lean, s, seed] of items) wrapEach(x, P, 60, xx => palm(xx, y, hgt, lean, s, pal, mulberry32(seed)));
    const grass = [];
    for (let k = 0; k < P / 50; k++) {
      const x = rng() * P, y = f(x) + 12 + rng() * 16;
      for (let j = -3; j <= 3; j++) grass.push([x + j * 1.6, y, x + j * 2.6 + (rng() - 0.5) * 2, y - 6 - rng() * 6 + Math.abs(j)]);
    }
    segs(wrapList(grass, P, 10), rgba(mix(pal.leaf, pal.sand, 0.3), 0.85), 1);
  };
  // Auslegerkanu auf dem Sand
  function beachBoat(x, y, s, pal, r) {
    const c = pickOf(r, pal.hull), L = 34 * s;
    ellipse(x + 4, y + 1.5, L * 0.6, 2.5 * s, 0, rgba(INK, 0.14));
    ctx.beginPath();
    ctx.moveTo(x - L / 2, y - 5 * s);
    ctx.quadraticCurveTo(x - L / 2 + 3 * s, y + 1, x - L / 4, y + 1);
    ctx.lineTo(x + L / 4, y + 1);
    ctx.quadraticCurveTo(x + L / 2 - 3 * s, y + 1, x + L / 2, y - 5 * s);
    ctx.closePath();
    ctx.fillStyle = vgrad(y - 5 * s, y + 1, [[0, mix(c, '#ffffff', 0.3)], [1, shade(c, -0.18)]]);
    ctx.fill();
    ctx.fillStyle = mix(pal.hull[1], c, 0.2);
    ctx.fillRect(x - L / 2 + 3 * s, y - 3.6 * s, L - 6 * s, 1.2 * s);
    segs([[x - 8 * s, y - 4 * s, x - 6 * s, y - 10 * s], [x + 6 * s, y - 4 * s, x + 8 * s, y - 10 * s]], pal.woodDk, 1.1 * s);
    ellipse(x + 1 * s, y - 10.5 * s, 14 * s, 1.6 * s, 0, pal.wood);
  }

  // ---------- Ebene 2: Strandpflanzen und Strandgut ----------
  ART2.prop.blBeachProp = { h: 78, paint: (x, base, s, r, v, C, col) => blBeachProp(x, base, s, r, v, C, col) };
  function blBeachProp(x, base, s, r, v, C) {
    const pal = lagPal(C);
    if (v < 0.22) {
      palm(x, base - 1, (44 + r() * 22) * s, (r() - 0.5) * 18 * s, 0.85 * s, pal, r);
    } else if (v < 0.42) {
      // Strandgras mit Prunkwinde
      const bl = [];
      for (let k = -5; k <= 5; k++) bl.push([x + k * 2.2, base, x + k * 3.2 + (r() - 0.5) * 3, base - (17 - Math.abs(k) * 1.6) * s - r() * 5]);
      segs(bl.slice(0, 6), pal.leafLt, 1.3);
      segs(bl.slice(6), pal.leaf, 1.3);
      const lv = [];
      for (let k = 0; k < 6; k++) lv.push([x + (r() - 0.5) * 30 * s, base - 1 - r() * 3, 2.6 * s, 1.8 * s, r()]);
      ellipses(lv, pal.leafDk);
      const fl = [];
      for (let k = 0; k < 3; k++) fl.push([x + (r() - 0.5) * 26 * s, base - 3 - r() * 4, 2.4 * s]);
      dots(fl, pal.flower);
      dots(fl.map(([a, b]) => [a, b, 0.8]), CREAM);
    } else if (v < 0.6) {
      // Felsgruppe mit Seestern und Muscheln
      const pts = [];
      for (let j = 0; j < 8; j++) { const a = Math.PI + j * Math.PI / 7, d = (10 + r() * 5) * s; pts.push([x + Math.cos(a) * d * 1.3, base - 1 + Math.sin(a) * d]); }
      ellipse(x + 6 * s, base, 18 * s, 3 * s, 0, rgba(INK, 0.16));
      poly(pts, vgrad(base - 16 * s, base, [[0, mix(pal.rock, CREAM, 0.25)], [1, shade(pal.rock, -0.12)]]));
      poly(pts.slice(4).concat([[x + 2 * s, base]]), rgba(INK, 0.14));
      ellipse(x - 4 * s, base - 9 * s, 5 * s, 2.4 * s, -0.3, rgba(CREAM, 0.25));
      shells([[x + 14 * s, base - 2, 3 * s, 2], [x - 13 * s, base - 1.5, 2 * s, 0], [x + 6 * s, base - 1, 1.6 * s, 1]], C, pal);
    } else if (v < 0.76) {
      // Meertraube: runde Blätter mit roten Adern
      ellipse(x + 8 * s, base - 1, 20 * s, 3.4 * s, 0, rgba(INK, 0.15));
      const lv = [];
      for (let k = 0; k < 14; k++) lv.push([x + (r() - 0.5) * 30 * s, base - 4 * s - r() * 22 * s, (4 + r() * 2.4) * s]);
      lv.sort((a, b) => a[1] - b[1]);
      line(x, base, x - 2, base - 18 * s, pal.woodDk, 1.4);
      line(x + 2, base, x + 7, base - 14 * s, pal.woodDk, 1.2);
      dots(lv.map(([a, b, c]) => [a + 0.8, b + 1, c]), pal.leafDk);
      dots(lv, pal.leaf);
      dots(lv.filter(l => l[0] < x).map(([a, b, c]) => [a - c * 0.3, b - c * 0.35, c * 0.5]), rgba(pal.leafLt, 0.6));
      segs(lv.map(([a, b, c]) => [a, b + c * 0.6, a + c * 0.1, b - c * 0.5]), rgba(mix(C.accent, '#b04030', 0.4), 0.45), 0.6);
    } else if (v < 0.88) {
      // Treibholz
      const L = (26 + r() * 14) * s, a = (r() - 0.5) * 0.2;
      ctx.save();
      ctx.translate(x, base - 3 * s);
      ctx.rotate(a);
      ellipse(4, 3 * s, L * 0.6, 2 * s, 0, rgba(INK, 0.14));
      roundRectPath(-L / 2, -3 * s, L, 6 * s, 3 * s);
      ctx.fillStyle = vgrad(-3 * s, 3 * s, [[0, mix(pal.wood, CREAM, 0.45)], [1, shade(pal.wood, -0.05)]]);
      ctx.fill();
      segs([[-L / 2 + 4, -1, L / 2 - 6, -0.5], [-L / 2 + 8, 1.4, L / 2 - 10, 1.2]], rgba(INK, 0.15), 0.6);
      line(L * 0.2, -2 * s, L * 0.32, -9 * s, mix(pal.wood, CREAM, 0.3), 1.6 * s);
      ctx.restore();
      shells([[x - L * 0.55, base - 1.5, 2 * s, 1]], C, pal);
    } else {
      // Kokosnüsse, eine treibt aus
      const nuts = [[x - 4 * s, base - 3.5 * s, 4 * s], [x + 4 * s, base - 3 * s, 3.6 * s]];
      ellipse(x + 4, base, 12 * s, 2.4 * s, 0, rgba(INK, 0.16));
      dots(nuts, pal.coconut);
      dots(nuts.map(([a, b, c]) => [a - c * 0.3, b - c * 0.35, c * 0.4]), rgba(CREAM, 0.28));
      const out = { lit: [], dark: [], rib: [] };
      frond(out, x - 4 * s, base - 6 * s, -1.9, 14 * s, 2, 3 * s);
      frond(out, x - 4 * s, base - 6 * s, -1.2, 12 * s, 2, 3 * s);
      frondPaint(out, pal.leafLt, pal.leaf, pal.leafDk, 0.8);
    }
  }

  // ---------- Boden: heller Sand mit Muscheln und Wasserkante ----------
  ART2.ground.blSand = (P, y, C, rng, band) => {
    const pal = lagPal(C), sand = mix(mix('#f6d9a0', CREAM, 0.2), C.accent, 0.04);
    band(vgrad(y, H, [[0, shade(sand, 0.04)], [1, shade(sand, -0.14)]]), y + 2, H - y + 4);
    // Rippelmarken
    for (let k = 0; k < 6; k++) {
      const yy = y + 12 + k * 7.5;
      ctx.beginPath();
      for (let x = -8; x <= P + 8; x += 6) {
        const v = yy + Math.sin(x * TAU / P * 29 + k * 1.3) * 2 + Math.sin(x * TAU / P * 7 + k) * 1.6;
        if (x === -8) ctx.moveTo(x, v); else ctx.lineTo(x, v);
      }
      ctx.strokeStyle = rgba(pal.sandDk, 0.32);
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.translate(0, -1.1);
      ctx.strokeStyle = rgba('#ffffff', 0.28);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.translate(0, 1.1);
    }
    const gr = [], gr2 = [];
    for (let k = 0; k < P / 1.6; k++) (k % 3 ? gr : gr2).push([rng() * P, y + 6 + rng() * 52, 0.5]);
    dots(gr, rgba(pal.sandDk, 0.28));
    dots(gr2, rgba('#ffffff', 0.45));
    const pb = [];
    for (let k = 0; k < P / 40; k++) pb.push([rng() * P, y + 14 + rng() * 40, 1 + rng() * 2, 0.8 + rng() * 1.2, 0]);
    ellipses(pb.map(([a, b, c, d]) => [a + 0.6, b + 0.7, c, d, 0]), rgba(INK, 0.25));
    ellipses(pb, mix(sand, pal.rock, 0.6));
    // Muscheln, Schnecken, Seesterne
    const sh = [];
    for (let k = 0; k < P / 28; k++) sh.push([6 + rng() * (P - 12), y + 10 + rng() * 42, 1.8 + rng() * 1.6, rng() < 0.5 ? 0 : rng() < 0.75 ? 1 : 2]);
    shells(sh, C, pal);
    // Wasserkante: nasser Saum, darüber ein dünner Film Flachwasser mit Schaumspitzen am Rand
    const wet = mix(mix(sand, pal.wet, 0.6), pal.shallow, 0.2);
    band(vgrad(y, y + 12, [[0, rgba(wet, 0.9)], [1, rgba(wet, 0)]]), y, 12);
    const film = [], lace = [], bub = [];
    for (let x = -10; x < P + 10; x += 8 + rng() * 10) {
      const ww = 16 + rng() * 30, d = 2.5 + rng() * 3;
      film.push([x + ww / 2, y + d * 0.3, ww * 0.62, d, 0]);
      for (let k = 0; k < ww / 2.6; k++) { const xx = x + k * 2.6 + rng(), e = 1 - Math.pow((xx - x - ww / 2) / (ww / 2), 2); lace.push([xx, y + d * 0.3 + d * Math.sqrt(Math.max(0, e)) * 0.85, 0.8 + rng() * 0.9]); }
    }
    for (let k = 0; k < P / 6; k++) bub.push([rng() * P, y + 3 + rng() * 6, 0.45 + rng() * 0.5]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-8, y - 1, P + 16, 12);
    ctx.clip();
    band(rgba(pal.shallow, 0.55), y - 1, 2.6);
    ellipses(film, rgba(pal.shallow, 0.55));
    dots(lace, rgba(pal.foam, 0.85));
    ctx.restore();
    dots(bub, rgba('#ffffff', 0.45));
    band(rgba('#ffffff', 0.5), y - 1, 1);
  };

  // ---------- Säule: geringelter Palmenstamm, Wedelkrone an der Kappe ----------
  const palmTrunk = C => mix(C.pipe, '#87633f', 0.42);
  ART2.pipeBody.blPalm = (C, h, v, r) => {
    const tr = palmTrunk(C), side = shade(tr, -SD), lit = mix(tr, CREAM, 0.38);
    columnBase(h, tr, side, lit);
    // Fasern
    const fib = [];
    for (let k = 0; k < 14; k++) fib.push([2 + r() * 55, 0, 0.6, h]);
    rects(fib, rgba(INK, 0.05));
    // Ringe: Wulst oben im Licht, Fuge darunter dunkel, leicht gewölbt; Kanten treten etwas vor
    const grooves = [], lips = [], knobsL = [], knobsR = [];
    for (let y = 3 + v * 5 + r() * 3; y < h; y += 8.5 + r() * 3) {
      const sag = 1.6 + r() * 0.8;
      grooves.push([y, sag]);
      knobsL.push([0.2, y + 0.4, 1.6]);
      knobsR.push([PW - 0.2, y + 0.4, 1.6]);
      lips.push([y - 2.6, sag]);
    }
    const band = (list, col, lw, dy) => {
      ctx.beginPath();
      for (const [y, sag] of list) { ctx.moveTo(0, y + dy); ctx.quadraticCurveTo(PW / 2, y + dy + sag * 2, PW, y + dy); }
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    // Schattierung jedes Segments: unten dunkler
    ctx.beginPath();
    for (const [y, sag] of grooves) { ctx.moveTo(0, y - 3.2); ctx.quadraticCurveTo(PW / 2, y - 3.2 + sag * 2, PW, y - 3.2); ctx.lineTo(PW, y); ctx.quadraticCurveTo(PW / 2, y + sag * 2, 0, y); ctx.closePath(); }
    ctx.fillStyle = rgba(INK, 0.1);
    ctx.fill();
    band(grooves, rgba(INK, 0.38), 1.5, 0);
    band(lips, rgba(lit, 0.32), 1.1, 0);
    dots(knobsL, mix(tr, CREAM, 0.15));
    dots(knobsR, shade(side, -0.12));
    // vereinzelte Blattnarben
    for (let y = 40 + v * 90 + r() * 30; y < h; y += 150 + r() * 80) {
      const x = 16 + r() * 26;
      poly([[x - 5, y], [x, y - 3], [x + 5, y], [x, y + 2]], rgba(INK, 0.18));
    }
  };
  ART2.pipeCap.blPalm = (C, up) => {
    const pal = lagPal(C), tr = palmTrunk(C), inward = up ? 1 : -1, gapEdge = up ? 0 : PCH;
    const Y = d => gapEdge + inward * d;   // d: Abstand von der Lückenkante Richtung Stamm
    const rr = mulberry32(up ? 71 : 73);
    // hintere Wedel hängen seitlich zum Stamm hin
    const back = { lit: [], dark: [], rib: [] };
    for (const sd of [-1, 1]) {
      frond(back, PW / 2 + sd * 8, Y(10), up ? (sd < 0 ? Math.PI - 0.32 : 0.32) : (sd < 0 ? Math.PI + 0.32 : -0.32), 40, inward * 9, 6.5);
      frond(back, PW / 2 + sd * 4, Y(12), up ? (sd < 0 ? Math.PI - 0.95 : 0.95) : (sd < 0 ? Math.PI + 0.95 : -0.95), 30, inward * 4, 5.5);
    }
    frondPaint(back, mix(pal.leaf, pal.leafDk, 0.3), shade(pal.leafDk, -0.15), pal.leafDk, 1.1);
    // Kokosnüsse am Stammansatz
    const nuts = [[PW / 2 - 9, Y(21), 4.6], [PW / 2 + 1, Y(22.5), 4.8], [PW / 2 + 10, Y(21), 4.4]];
    dots(nuts.map(([a, b, c]) => [a + 0.8, b + 1, c]), rgba(INK, 0.3));
    for (const [x, y, rad] of nuts) circle(x, y, rad, rgrad(x - rad * 0.4, y - rad * 0.45, 0.5, rad * 1.3, [[0, mix(pal.coconut, '#c8b060', 0.5)], [0.6, pal.coconut], [1, shade(pal.coconut, -0.3)]]));
    // Polster aus Blattscheiden (die eigentliche Kappe)
    roundRectPath(-PCO, up ? 0 : 6, PW + PCO * 2, PCH - 6, 7);
    const g1 = mix(pal.leaf, tr, 0.25);
    ctx.fillStyle = hgrad(-PCO, PW + PCO, [[0, mix(g1, CREAM, 0.35)], [0.15, g1], [0.6, g1], [0.8, shade(g1, -0.18)], [1, shade(g1, -0.3)]]);
    ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Scheiden als überlappende Bögen
    ctx.save();
    roundRectPath(-PCO, up ? 0 : 6, PW + PCO * 2, PCH - 6, 7);
    ctx.clip();
    const arcsL = [], arcsD = [];
    for (let row = 0; row < 3; row++) {
      for (let x = -PCO - 4 + (row % 2) * 6; x < PW + PCO + 6; x += 12) (x < PW * 0.6 ? arcsL : arcsD).push([x, Y(3 + row * 6), 7.5]);
    }
    ctx.beginPath();
    for (const [x, y, rad] of arcsL.concat(arcsD)) { ctx.moveTo(x - rad, y); ctx.arc(x, y, rad, up ? 0 : Math.PI, up ? Math.PI : TAU, !up); }
    ctx.strokeStyle = rgba(INK, 0.13);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // vordere Wedel: liegen über den Seiten des Polsters und hängen nach außen
    const front = { lit: [], dark: [], rib: [] };
    for (const sd of [-1, 1]) {
      frond(front, PW / 2 + sd * 10, Y(4), up ? (sd < 0 ? Math.PI + 0.1 : -0.1) : (sd < 0 ? Math.PI - 0.1 : 0.1), 38 + rr() * 3, inward * 20, 7.5);
      frond(front, PW / 2 + sd * 2, Y(6), up ? (sd < 0 ? Math.PI - 0.5 : 0.5) : (sd < 0 ? Math.PI + 0.5 : -0.5), 26, inward * 8, 6);
    }
    frondPaint(front, pal.leafLt, pal.leaf, mix(pal.leafDk, pal.leaf, 0.3), 1.2);
  };

  // ---------- Kulissen Lagune ----------
  // ferne Spur: am Horizont (392), Unterkante etwas darunter für das Spiegelbild
  const L_FAR = 402, L_MID = 482;
  // Spiegelung: senkrecht gespiegelte, blasse Kopie einer Malfunktion unterhalb der Wasserlinie yW
  function reflect(w, h, yW, a, fn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-2, yW, w + 4, h - yW + 2);
    ctx.clip();
    ctx.globalAlpha = a;
    ctx.translate(0, yW * 2);
    ctx.scale(1, -1);
    fn();
    ctx.restore();
  }
  function ripples(w, yW, h, x0, x1, r, n, col) {
    const list = [];
    for (let k = 0; k < n; k++) { const y = yW + 1 + Math.pow(r(), 1.3) * (h - yW - 2); list.push([x0 + r() * (x1 - x0), y, 4 + r() * 14, 0.7]); }
    rects(list, col);
  }
  function hut(x, yF, w, wh, rh, pal, r, o) {
    o = o || {};
    // Wände aus Rohr
    ctx.fillStyle = hgrad(x, x + w, [[0, mix(pal.thatch, CREAM, 0.35)], [0.6, mix(pal.thatch, pal.wood, 0.4)], [1, shade(mix(pal.thatch, pal.wood, 0.5), -0.18)]]);
    ctx.fillRect(x, yF - wh, w, wh);
    const cane = [];
    for (let xx = x + 1.5; xx < x + w; xx += 2.2) cane.push([xx, yF - wh, 0.5, wh]);
    rects(cane, rgba(INK, 0.1));
    ctx.fillStyle = rgba(INK, 0.55);
    ctx.fillRect(x + w * 0.2, yF - wh * 0.78, w * 0.22, wh * 0.78);
    if (w > 18) { ctx.fillStyle = rgba(INK, 0.45); ctx.fillRect(x + w * 0.6, yF - wh * 0.7, w * 0.2, wh * 0.32); }
    // Walmdach aus Stroh mit Fransen
    const ov = 4 + w * 0.08, yr = yF - wh;
    const roof = [[x - ov, yr + 2], [x + w * 0.22, yr - rh], [x + w * 0.78, yr - rh], [x + w + ov, yr + 2]];
    poly(roof, vgrad(yr - rh, yr + 2, [[0, mix(pal.thatch, CREAM, 0.25)], [1, shade(pal.thatch, -0.12)]]));
    poly([[x + w * 0.5, yr + 2], [x + w * 0.78, yr - rh], [x + w + ov, yr + 2]], rgba(INK, 0.12));
    const str = [];
    for (let k = 0; k < (w + ov * 2) / 2.5; k++) { const t = k / ((w + ov * 2) / 2.5), xx = lerp(x - ov, x + w + ov, t); str.push([xx, yr - rh * 0.6 * Math.sin(Math.PI * t) - 1, 0.5, rh * 0.5 + 2]); }
    rects(str, rgba(shade(pal.thatch, -0.35), 0.28));
    const fr = [];
    for (let xx = x - ov; xx < x + w + ov; xx += 2) fr.push([xx, yr + 1.5, 1.2, 1.5 + hash(xx) * 2]);
    rects(fr, shade(pal.thatch, -0.15));
    rects([[x + w * 0.22, yr - rh - 1, w * 0.56, 1.6]], shade(pal.thatch, -0.3));
    if (o.flag) { line(x + w * 0.5, yr - rh, x + w * 0.5, yr - rh - 10, pal.woodDk, 0.8); poly([[x + w * 0.5, yr - rh - 10], [x + w * 0.5 + 7, yr - rh - 8.5], [x + w * 0.5, yr - rh - 7]], o.flag); }
  }
  const lMid = {
    stilts: {
      size: r => [270 + r() * 40, 120],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.14), yW = toLocal(it, h, 462), yF = yW - 13;
        const huts = [[w * 0.1, 34, 17, 13], [w * 0.44, 42, 20, 15], [w * 0.75, 30, 16, 12]];
        const draw = () => {
          // Pfähle und Stege
          const posts = [];
          for (const [x, hw] of huts) for (let xx = x - 2; xx <= x + hw + 2; xx += 7) posts.push([xx, yF, 1.8, yW - yF + 2]);
          for (let xx = w * 0.1 + 36; xx < w * 0.75; xx += 9) posts.push([xx, yF + 1, 1.3, yW - yF + 1]);
          rects(posts, pal.woodDk);
          ctx.fillStyle = shade(pal.wood, -0.05);
          ctx.fillRect(w * 0.1 - 5, yF - 1.5, w * 0.68 + 10, 2.6);
          ctx.fillStyle = mix(pal.wood, CREAM, 0.35);
          ctx.fillRect(w * 0.1 - 5, yF - 2, w * 0.68 + 10, 0.9);
          // Geländer am Steg
          const rail = [];
          for (let xx = w * 0.1 + 38; xx < w * 0.44 - 3; xx += 6) rail.push([xx, yF - 6, 0.8, 5]);
          for (let xx = w * 0.44 + 46; xx < w * 0.75 - 3; xx += 6) rail.push([xx, yF - 6, 0.8, 5]);
          rects(rail, pal.woodDk);
          rects([[w * 0.1 + 36, yF - 6, w * 0.34 - 38, 0.9], [w * 0.44 + 44, yF - 6, w * 0.31 - 46, 0.9]], pal.wood);
          for (const [x, hw, wh, rh] of huts) hut(x, yF - 1.5, hw, wh, rh, pal, r, { flag: hw > 40 ? pal.hull[1] : null });
          // Leiter
          rects([[w * 0.44 - 6, yF, 0.9, yW - yF], [w * 0.44 - 1.5, yF, 0.9, yW - yF]], pal.woodDk);
          rects([[w * 0.44 - 6, yF + 4, 5.4, 0.8], [w * 0.44 - 6, yF + 8, 5.4, 0.8]], pal.woodDk);
        };
        draw();
        reflect(w, h, yW, 0.22, draw);
        // Kanu an der Leiter
        const cx = w * 0.44 - 18;
        ctx.beginPath();
        ctx.moveTo(cx - 14, yW - 2.5);
        ctx.quadraticCurveTo(cx, yW + 2.5, cx + 14, yW - 2.5);
        ctx.closePath();
        ctx.fillStyle = pal.hull[2];
        ctx.fill();
        ripples(w, yW, h, 0, w, r, 26, rgba(pal.foam, 0.35));
      },
      tex: { grain: 0.03 }
    },
    sandbank: {
      size: r => [250 + r() * 50, 150],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.14), yW = toLocal(it, h, 464);
        ellipse(w / 2, yW + 1, w * 0.48, 6, 0, rgba(pal.shallow, 0.55));
        ctx.beginPath();
        ctx.moveTo(w * 0.06, yW + 1);
        ctx.bezierCurveTo(w * 0.2, yW - 9, w * 0.75, yW - 11, w * 0.94, yW + 1);
        ctx.closePath();
        ctx.fillStyle = vgrad(yW - 10, yW + 1, [[0, mix(pal.sand, '#ffffff', 0.25)], [1, pal.sandDk]]);
        ctx.fill();
        ctx.fillStyle = rgba(pal.foam, 0.7);
        ctx.fillRect(w * 0.08, yW, w * 0.84, 1);
        // zwei Palmen mit Hängematte, eine dritte geneigt
        const p1 = palm(w * 0.32, yW - 6, 62, -16, 1.0, pal, r);
        const p2 = palm(w * 0.5, yW - 7, 72, 10, 1.05, pal, r);
        palm(w * 0.72, yW - 5, 52, 26, 0.9, pal, r);
        const ha = [w * 0.32 - 7, yW - 30], hb = [w * 0.5 + 3, yW - 34];
        ctx.beginPath();
        ctx.moveTo(ha[0], ha[1]);
        ctx.quadraticCurveTo((ha[0] + hb[0]) / 2, yW - 16, hb[0], hb[1]);
        ctx.quadraticCurveTo((ha[0] + hb[0]) / 2, yW - 20, ha[0], ha[1]);
        ctx.fillStyle = mix(pal.hull[1], CREAM, 0.2);
        ctx.fill();
        void p1; void p2;
        // Felsen und Gras am Rand
        const rk = [[w * 0.84, yW - 2, 5], [w * 0.88, yW - 1, 3.4], [w * 0.15, yW - 1.5, 3.6]];
        dots(rk.map(([a, b, c]) => [a + 0.8, b + 0.8, c]), shade(pal.rock, -0.25));
        dots(rk, pal.rock);
        ripples(w, yW + 2, h, w * 0.05, w * 0.95, r, 18, rgba(pal.foam, 0.3));
      },
      tex: { grain: 0.03 }
    },
    boats: {
      size: r => [250 + r() * 30, 132],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.14), yW = toLocal(it, h, 462);
        const sb = w * 0.36, cb = w * 0.74, hull = pal.hull[r() < 0.5 ? 0 : 3], stripe = pal.hull[r() < 0.5 ? 1 : 2];
        const sail = () => {
          // Segelboot: Rumpf, Mast, Großsegel und Fock
          ctx.beginPath();
          ctx.moveTo(sb - 30, yW - 9);
          ctx.lineTo(sb + 34, yW - 9);
          ctx.quadraticCurveTo(sb + 30, yW + 1, sb + 18, yW + 1);
          ctx.lineTo(sb - 22, yW + 1);
          ctx.quadraticCurveTo(sb - 28, yW - 2, sb - 30, yW - 9);
          ctx.closePath();
          ctx.fillStyle = vgrad(yW - 9, yW + 1, [[0, mix(hull, '#ffffff', 0.4)], [1, shade(hull, -0.15)]]);
          ctx.fill();
          ctx.fillStyle = stripe;
          ctx.fillRect(sb - 28, yW - 6.5, 61, 1.8);
          ctx.fillStyle = pal.woodDk;
          ctx.fillRect(sb - 1, yW - 86, 1.8, 78);
          ctx.beginPath();
          ctx.moveTo(sb + 1.5, yW - 84);
          ctx.quadraticCurveTo(sb + 26, yW - 46, sb + 30, yW - 13);
          ctx.lineTo(sb + 1.5, yW - 13);
          ctx.closePath();
          ctx.fillStyle = hgrad(sb, sb + 30, [[0, mix(pal.sail, '#ffffff', 0.5)], [1, shade(pal.sail, -0.1)]]);
          ctx.fill();
          ctx.fillStyle = rgba(stripe, 0.85);
          ctx.beginPath();
          ctx.moveTo(sb + 1.5, yW - 34);
          ctx.lineTo(sb + 26, yW - 30);
          ctx.lineTo(sb + 27.5, yW - 25);
          ctx.lineTo(sb + 1.5, yW - 28);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(sb - 2, yW - 78);
          ctx.quadraticCurveTo(sb - 16, yW - 40, sb - 24, yW - 13);
          ctx.lineTo(sb - 2, yW - 13);
          ctx.closePath();
          ctx.fillStyle = hgrad(sb - 24, sb, [[0, mix(pal.sail, '#ffffff', 0.6)], [1, mix(pal.sail, C.skyTop, 0.12)]]);
          ctx.fill();
          rects([[sb - 18, yW - 14, 50, 1.4]], pal.woodDk);
        };
        const canoe = () => {
          // Auslegerkanu mit Querhölzern und Schwimmer
          ctx.beginPath();
          ctx.moveTo(cb - 30, yW - 7);
          ctx.quadraticCurveTo(cb - 26, yW + 1, cb - 14, yW + 1);
          ctx.lineTo(cb + 14, yW + 1);
          ctx.quadraticCurveTo(cb + 26, yW + 1, cb + 30, yW - 7);
          ctx.closePath();
          ctx.fillStyle = vgrad(yW - 7, yW + 1, [[0, mix(pal.hull[2], '#ffffff', 0.3)], [1, shade(pal.hull[2], -0.2)]]);
          ctx.fill();
          rects([[cb - 26, yW - 6, 52, 1.2]], pal.hull[3]);
          segs([[cb - 8, yW - 5, cb - 4, yW - 15], [cb + 8, yW - 5, cb + 12, yW - 15]], pal.woodDk, 1.3);
          ctx.fillStyle = mix(pal.wood, CREAM, 0.2);
          ctx.fillRect(cb - 10, yW - 16, 26, 2.4);
          line(cb + 18, yW - 12, cb + 28, yW - 24, pal.woodDk, 1);
          ellipse(cb + 29, yW - 26, 2, 3.6, 0.6, pal.wood);
        };
        // Pfahl mit Möwe
        const pole = () => { rects([[w * 0.08, yW - 30, 2.6, 30]], pal.woodDk); ellipse(w * 0.08 + 1.3, yW - 33, 4, 2.4, 0, mix(CREAM, '#ffffff', 0.5)); circle(w * 0.08 - 1.2, yW - 35, 1.8, mix(CREAM, '#ffffff', 0.5)); };
        pole();
        canoe();
        sail();
        reflect(w, h, yW, 0.24, () => { pole(); canoe(); sail(); });
        line(w * 0.08 + 1.3, yW - 26, sb - 30, yW - 8, rgba(pal.woodDk, 0.7), 0.6);
        ripples(w, yW, h, 0, w, r, 30, rgba(pal.foam, 0.35));
      },
      tex: { grain: 0.03 }
    },
    pier: {
      size: r => [300 + r() * 40, 120],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.14), yW = toLocal(it, h, 462), yD = yW - 10;
        // kleine Sandinsel links, von dort führt der Steg hinaus
        ctx.beginPath();
        ctx.moveTo(0, yW + 1);
        ctx.bezierCurveTo(w * 0.04, yW - 10, w * 0.22, yW - 12, w * 0.3, yW + 1);
        ctx.closePath();
        ctx.fillStyle = vgrad(yW - 12, yW + 1, [[0, mix(pal.sand, '#ffffff', 0.25)], [1, pal.sandDk]]);
        ctx.fill();
        palm(w * 0.12, yW - 7, 58, -12, 0.95, pal, r);
        const draw = () => {
          const posts = [];
          for (let xx = w * 0.24; xx < w * 0.9; xx += 10) posts.push([xx, yD, 2, yW - yD + 2]);
          rects(posts, pal.woodDk);
          ctx.fillStyle = vgrad(yD - 2, yD + 2, [[0, mix(pal.wood, CREAM, 0.35)], [1, shade(pal.wood, -0.15)]]);
          ctx.fillRect(w * 0.22, yD - 2, w * 0.7, 3.4);
          // Seilgeländer zwischen Pfosten
          const pp = [];
          for (let xx = w * 0.24; xx < w * 0.66; xx += 20) pp.push([xx, yD - 9, 1.4, 8]);
          rects(pp, pal.woodDk);
          ctx.beginPath();
          for (let xx = w * 0.24; xx < w * 0.64; xx += 20) { ctx.moveTo(xx + 0.7, yD - 8); ctx.quadraticCurveTo(xx + 10, yD - 5, xx + 20.7, yD - 8); }
          ctx.strokeStyle = mix(pal.thatch, CREAM, 0.2);
          ctx.lineWidth = 0.7;
          ctx.stroke();
          hut(w * 0.7, yD - 1.5, 40, 18, 15, pal, r, { flag: pal.hull[1] });
          // Laternenpfahl
          rects([[w * 0.5, yD - 22, 1.4, 21]], pal.woodDk);
          circle(w * 0.5 + 0.7, yD - 23, 2.4, mix(C.accent, CREAM, 0.45));
        };
        draw();
        reflect(w, h, yW, 0.22, draw);
        ripples(w, yW, h, w * 0.2, w, r, 26, rgba(pal.foam, 0.35));
      },
      tex: { grain: 0.03 }
    },
    rock: {
      size: r => [210 + r() * 40, 172],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.14), yW = toLocal(it, h, 464), rock = mix(pal.rock, '#c8b8a0', 0.2);
        // Kalkfelsen mit Durchbruch, bewachsener Kuppe
        const top = yW - 92, cx = w * 0.5;
        const outline = [[cx - 70, yW + 1], [cx - 66, yW - 30], [cx - 58, yW - 62], [cx - 42, top + 8], [cx - 20, top], [cx + 6, top + 4], [cx + 30, top + 14],
          [cx + 52, yW - 58], [cx + 62, yW - 26], [cx + 68, yW + 1]];
        const draw = () => {
          ctx.beginPath();
          ctx.moveTo(outline[0][0], outline[0][1]);
          for (let k = 1; k < outline.length - 1; k++) ctx.quadraticCurveTo(outline[k][0], outline[k][1], (outline[k][0] + outline[k + 1][0]) / 2, (outline[k][1] + outline[k + 1][1]) / 2);
          ctx.lineTo(outline[outline.length - 1][0], outline[outline.length - 1][1]);
          // Bogen
          ctx.lineTo(cx + 26, yW + 1);
          ctx.quadraticCurveTo(cx + 22, yW - 40, cx + 4, yW - 40);
          ctx.quadraticCurveTo(cx - 14, yW - 40, cx - 16, yW + 1);
          ctx.closePath();
          ctx.fillStyle = hgrad(cx - 70, cx + 68, [[0, mix(rock, CREAM, 0.35)], [0.45, rock], [1, shade(rock, -0.25)]]);
          ctx.fill();
        };
        draw();
        // Schichten und Rinnen
        ctx.save();
        draw();
        ctx.clip();
        const st = [];
        for (let k = 0; k < 9; k++) { const y = top + 14 + k * 9 + r() * 4; st.push([cx - 70, y, 140, 0.9]); }
        rects(st, rgba(INK, 0.1));
        const gul = [];
        for (let k = 0; k < 14; k++) { const x = cx - 60 + r() * 120; gul.push([x, top + 10 + r() * 20, 1.2, 20 + r() * 40]); }
        rects(gul, rgba(INK, 0.08));
        ctx.fillStyle = vgrad(yW - 30, yW, [[0, rgba(pal.leafDk, 0)], [1, rgba(pal.leafDk, 0.25)]]);
        ctx.fillRect(0, yW - 30, w, 31);
        ctx.restore();
        reflect(w, h, yW, 0.2, draw);
        // Grün auf der Kuppe: Haube im Fels, Büsche entlang der Kontur, hängende Ranken
        ctx.save();
        draw();
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(0, top - 4);
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, top + 22 + Math.abs(x - cx) * 0.18 + Math.sin(x * 0.4) * 3);
        ctx.lineTo(w, top - 4);
        ctx.closePath();
        ctx.fillStyle = vgrad(top, top + 40, [[0, pal.leaf], [1, pal.leafDk]]);
        ctx.fill();
        const vine = [];
        for (let x = cx - 64; x < cx + 60; x += 4 + r() * 4) vine.push([x, top + 20 + Math.abs(x - cx) * 0.18, 1, 6 + r() * 16]);
        rects(vine, rgba(pal.leafDk, 0.75));
        ctx.restore();
        const bush = [];
        for (let k = 2; k < 8; k++) {
          const [ax, ay] = outline[k], [bx2, by2] = outline[k + 1];
          for (let j = 0; j < 3; j++) { const u = (j + 0.5) / 3, mx2 = lerp((outline[k - 1][0] + ax) / 2, (ax + bx2) / 2, u), my2 = lerp((outline[k - 1][1] + ay) / 2, (ay + by2) / 2, u); bush.push([mx2, my2 + 2.5, 4 + r() * 3]); }
        }
        dots(bush.map(([a, b, c]) => [a + 1, b + 1.4, c]), pal.leafDk);
        dots(bush, pal.leaf);
        dots(bush.filter((_, k) => k % 2 === 0).map(([a, b, c]) => [a - c * 0.3, b - c * 0.4, c * 0.45]), rgba(pal.leafLt, 0.7));
        palm(cx - 24, top + 6, 40, -14, 0.8, pal, r, { noShadow: true });
        palm(cx + 14, top + 8, 50, 18, 0.85, pal, r, { noShadow: true });
        ripples(w, yW, h, 0, w, r, 22, rgba(pal.foam, 0.35));
        ctx.fillStyle = rgba(pal.foam, 0.6);
        ctx.fillRect(cx - 70, yW - 0.5, 54, 1.2);
        ctx.fillRect(cx + 26, yW - 0.5, 42, 1.2);
      },
      tex: { grain: 0.035 }
    }
  };
  const lFar = {
    fisle: {
      size: r => [230 + r() * 70, 92],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.45), yW = h - (L_FAR - L_HZ), col = mix(pal.island, C.skyTop, 0.12);
        const p1 = w * (0.35 + r() * 0.15), p2 = p1 + w * (0.18 + r() * 0.1), t1 = yW - 50 - r() * 22, t2 = yW - 30 - r() * 14;
        const draw = () => {
          ctx.beginPath();
          ctx.moveTo(w * 0.04, yW);
          ctx.bezierCurveTo(w * 0.2, yW - 8, p1 - 26, t1 + 18, p1, t1);
          ctx.bezierCurveTo(p1 + 14, t1 + 10, p2 - 14, t2, p2, t2);
          ctx.bezierCurveTo(p2 + 22, t2 + 6, w * 0.82, yW - 8, w * 0.96, yW);
          ctx.closePath();
          ctx.fillStyle = hgrad(0, w, [[0, mix(col, CREAM, 0.15)], [0.5, col], [1, shade(col, -0.1)]]);
          ctx.fill();
        };
        draw();
        reflect(w, h, yW, 0.25, draw);
        ctx.fillStyle = rgba(pal.sand, 0.9);
        ctx.fillRect(w * 0.06, yW - 1.6, w * 0.88, 1.8);
        const tr = [];
        for (let k = 0; k < 18; k++) { const x = w * 0.1 + r() * w * 0.8; tr.push([x, yW - 3 - r() * 8, 1.4 + r() * 1.4]); }
        dots(tr, shade(col, -0.12));
        hazeOver(w, h, C.haze, 0.22);
      },
      tex: null
    },
    fsail: {
      size: r => [110 + r() * 40, 50],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.35), yW = h - (L_FAR - L_HZ);
        for (let k = 0, n = 1 + (r() < 0.5 ? 1 : 0); k < n; k++) {
          const x = w * (0.3 + k * 0.4), s = 0.75 - k * 0.15;
          ctx.fillStyle = pal.hull[k % 2 ? 2 : 0];
          ctx.fillRect(x - 9 * s, yW - 3 * s, 18 * s, 3 * s);
          poly([[x, yW - 30 * s], [x + 12 * s, yW - 4 * s], [x, yW - 4 * s]], mix(pal.sail, '#ffffff', 0.4));
          poly([[x - 1, yW - 26 * s], [x - 1, yW - 4 * s], [x - 8 * s, yW - 4 * s]], mix(pal.sail, C.skyTop, 0.15));
          rects([[x - 9 * s, yW + 1, 18 * s, 0.6], [x - 6 * s, yW + 3, 12 * s, 0.6]], rgba(mix(pal.sail, C.far, 0.5), 0.5));
        }
      },
      tex: null
    },
    fatoll: {
      size: r => [250 + r() * 60, 44],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.42), yW = h - (L_FAR - L_HZ);
        ellipse(w / 2, yW, w * 0.46, 3, 0, rgba(pal.shallow, 0.5));
        ctx.fillStyle = pal.sand;
        ctx.fillRect(w * 0.08, yW - 2, w * 0.84, 2.2);
        const dome = [];
        for (let x = w * 0.15; x < w * 0.85; x += 4) dome.push([x, yW - 3 - Math.sin(Math.PI * (x / w - 0.15) / 0.7) * 4, 3.2]);
        dots(dome, mix(pal.island, C.skyTop, 0.1));
        for (let x = w * 0.14; x < w * 0.86; x += 14 + r() * 16) palm(x, yW - 2, 14 + r() * 8, (r() - 0.5) * 6, 0.4, pal, r, { noShadow: true, fronds: 6, nuts: false });
        hazeOver(w, h, C.haze, 0.2);
      },
      tex: null
    },
    fkarst: {
      size: r => [170 + r() * 40, 108],
      paint: (w, h, r, C, L, it) => {
        const pal = lagPal(C, 0.42), yW = h - (L_FAR - L_HZ), col = mix(pal.rock, pal.island, 0.35);
        const towers = [[w * 0.3, 54 + r() * 16, 30], [w * 0.56, 38 + r() * 12, 25], [w * 0.78, 24 + r() * 8, 20]];
        const green = mix(pal.island, C.skyTop, 0.1);
        const draw = () => {
          for (const [x, th, tw] of towers) {
            const shape = () => {
              ctx.beginPath();
              ctx.moveTo(x - tw, yW);
              ctx.bezierCurveTo(x - tw * 0.95, yW - th * 0.7, x - tw * 0.6, yW - th, x - tw * 0.05, yW - th);
              ctx.bezierCurveTo(x + tw * 0.6, yW - th, x + tw * 0.98, yW - th * 0.65, x + tw, yW);
              ctx.closePath();
            };
            shape();
            ctx.fillStyle = hgrad(x - tw, x + tw, [[0, mix(col, CREAM, 0.2)], [0.5, col], [1, shade(col, -0.15)]]);
            ctx.fill();
            // Bewuchs als Haube, an den Fels gebunden
            ctx.save();
            shape();
            ctx.clip();
            ctx.fillStyle = green;
            ctx.fillRect(x - tw - 2, yW - th - 2, tw * 2 + 4, th * 0.32);
            const hang = [];
            for (let xx = x - tw; xx <= x + tw; xx += 4) hang.push([xx, yW - th * 0.7 + Math.sin(xx * 0.7) * 2.5, 3]);
            dots(hang, green);
            ctx.restore();
          }
        };
        draw();
        reflect(w, h, yW, 0.22, draw);
        hazeOver(w, h, C.haze, 0.2);
      },
      tex: null
    }
  };
  SCENE['Lagune'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 40, gap: [60, 200], maxKs: 1.5, base: () => L_FAR,
        pick: flow(['fisle', 'fsail', 'fatoll', 'fkarst'], [['fisle', 2], ['fsail', 1.4], ['fatoll', 1.5], ['fkarst', 1.4]], 1),
        kinds: lFar },
      { z: 1, factor: 0.34, start: 20, gap: [20, 110], maxKs: 2, base: () => L_MID,
        pick: flow(['sandbank', 'stilts', 'boats', 'rock', 'pier'],
          [['sandbank', 1.6], ['stilts', 1.6], ['boats', 1.4], ['rock', 1.2], ['pier', 1.3]], 2),
        kinds: lMid }
    ]
  };

  // Malen isolieren (siehe b_art7_scene_c.js): im eigenen Sprite direkt, sonst über eine Zwischenleinwand,
  // damit Dunst (source-atop) und Ausblenden nur das Motiv treffen
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
  for (const name of ['Blütenhain', 'Lagune']) for (const T of SCENE[name].tracks) for (const K of Object.values(T.kinds)) isolate(K);

  // ============================================================
  // Bosse
  // ============================================================
  // Zwischenspeicher für ruhende Teile (wie in b_art3_bosses.js): einmal gemalt, danach nur kopiert,
  // unter Drehung gezeichnet als Sprite. Neu gemalt bei anderer Palette oder Auflösung.
  const LP = 34, layerCache = new Map();
  function cached(id, P, paint) {
    const x0 = -LP, y0 = -LP, w = CONFIG.BOSS_W + LP * 2, h = CONFIG.BOSS_H + LP * 2;
    const m = ctx.getTransform ? ctx.getTransform() : { a: view.k, b: 0 };
    const k = Math.hypot(m.a, m.b) || 1;
    const key = P.main + P.acc + P.near + P.far + P.sky + P.ink + '|' + k.toFixed(4);
    let Lc = layerCache.get(id);
    if (!Lc) {
      const owner = id.split(':')[0];
      for (const [oid, ol] of layerCache) if (oid.split(':')[0] !== owner) { freeCanvas(ol.c); layerCache.delete(oid); }
      Lc = { c: newCanvas(1, 1), key: '', k: 1 };
      layerCache.set(id, Lc);
    }
    if (Lc.key !== key) {
      const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      if (Lc.c.width !== cw || Lc.c.height !== ch) { Lc.c.width = cw; Lc.c.height = ch; }
      const g = Lc.c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
      setupG(g);
      withCtx(g, paint);
      Lc.key = key;
      Lc.k = k;
    }
    ctx.drawImage(Lc.c, x0, y0, Lc.c.width / Lc.k, Lc.c.height / Lc.k);
  }
  function glow(x, y, r, col, a) {
    if (a <= 0.004 || r <= 0.5) return;
    ctx.fillStyle = rgrad(x, y, 0, r, [[0, rgba(col, Math.min(1, a))], [0.45, rgba(col, Math.min(1, a) * 0.38)], [1, rgba(col, 0)]]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
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

  // Blütenblatt als Pfad, Mitte (0, 0), Spitze mit Kerbe nach oben (-y), Grund nach unten
  function petalPath(r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.95);
    ctx.bezierCurveTo(-r * 0.6, r * 0.78, -r * 1.02, r * 0.12, -r * 0.88, -r * 0.42);
    ctx.bezierCurveTo(-r * 0.76, -r * 0.92, -r * 0.26, -r * 1.02, 0, -r * 0.7);
    ctx.bezierCurveTo(r * 0.26, -r * 1.02, r * 0.76, -r * 0.92, r * 0.88, -r * 0.42);
    ctx.bezierCurveTo(r * 1.02, r * 0.12, r * 0.6, r * 0.78, 0, r * 0.95);
    ctx.closePath();
  }
  function paintPetal(r, pink, deep, light, rim, base) {
    ctx.save();
    ctx.translate(r * 0.08, r * 0.1);
    petalPath(r);
    ctx.fillStyle = rgba(INK, 0.22);
    ctx.fill();
    ctx.restore();
    petalPath(r);
    ctx.fillStyle = rgrad(-r * 0.3, -r * 0.35, r * 0.05, r * 1.2, [[0, light], [0.45, pink], [1, deep]]);
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.stroke();
    ctx.save();
    petalPath(r);
    ctx.clip();
    ctx.fillStyle = rgrad(0, r * 0.95, 0, r * 0.75, [[0, rgba(base, 0.9)], [1, rgba(base, 0)]]);
    ctx.fillRect(-r, 0, r * 2, r);
    ctx.beginPath();
    for (const a of [-0.55, -0.2, 0.2, 0.55]) { ctx.moveTo(0, r * 0.8); ctx.quadraticCurveTo(a * r * 0.6, r * 0.1, a * r * 1.1, -r * 0.55); }
    ctx.strokeStyle = rgba(deep, 0.35);
    ctx.lineWidth = Math.max(0.6, r * 0.06);
    ctx.stroke();
    ctx.restore();
    ellipse(-r * 0.38, -r * 0.32, r * 0.26, r * 0.15, -0.6, rgba('#ffffff', 0.65));
  }

  // ---------------------------------------------------------
  // Blütenmotte: flauschig und rund, Flügel mit Blütenmuster. Vorwarnung: Flügel spreizen sich weit,
  // die Blüten auf den Flügeln leuchten, Fühler richten sich auf, am Mund wächst ein Blütenblatt.
  // ---------------------------------------------------------
  const MW_PIV = [42, 46];
  function mothWingShape() {
    ctx.beginPath();
    ctx.moveTo(42, 44);
    ctx.bezierCurveTo(46, 22, 58, 2, 78, -6);
    ctx.bezierCurveTo(91, -11, 104, -3, 104, 10);
    ctx.bezierCurveTo(104, 24, 96, 33, 84, 37);
    ctx.bezierCurveTo(70, 41, 56, 46, 46, 50);
    ctx.closePath();
  }
  function mothHindShape() {
    ctx.beginPath();
    ctx.moveTo(46, 47);
    ctx.bezierCurveTo(60, 38, 82, 34, 95, 41);
    ctx.bezierCurveTo(104, 47, 101, 62, 89, 66);
    ctx.bezierCurveTo(75, 70, 59, 61, 48, 54);
    ctx.closePath();
  }
  // Blüte aus fünf Blättern mit Mitte
  function wingFlower(x, y, r, petal, inner, center, rot) {
    const pts = [];
    for (let k = 0; k < 5; k++) { const a = rot + k * TAU / 5; pts.push([x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48]); }
    dots(pts, petal);
    circle(x, y, r * 0.42, inner);
    circle(x, y, r * 0.26, center);
  }
  const MOTH_FLOWERS = [[76, 12, 9.5, 0.3], [60, 27, 5, 0.9], [92, 6, 4, 0.1], [80, 52, 6.5, 0.5]];
  function mothWing(P, dim) {
    const base = dim ? mix(P.mainSide, P.mainDark, 0.25) : P.mainSide, body = dim ? mix(P.main, P.mainSide, 0.55) : P.main, edge = dim ? P.main : P.mainLight;
    // Hinterflügel
    mothHindShape();
    ctx.fillStyle = rgrad(46, 50, 2, 56, [[0, base], [0.45, mix(body, P.far, 0.4)], [1, mix(edge, P.far, 0.3)]]);
    ctx.fill();
    ctx.strokeStyle = rgba(P.mainDark, dim ? 0.45 : 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Vorderflügel
    mothWingShape();
    ctx.fillStyle = rgrad(42, 46, 2, 70, [[0, base], [0.4, body], [1, edge]]);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    mothWingShape();
    ctx.clip();
    // Adern
    ctx.beginPath();
    for (const [ex, ey] of [[70, -4], [90, 2], [100, 18], [86, 32]]) { ctx.moveTo(44, 46); ctx.quadraticCurveTo((44 + ex) / 2 - 4, (46 + ey) / 2 + 4, ex, ey); }
    ctx.strokeStyle = rgba(P.mainDark, dim ? 0.18 : 0.22);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // flauschiger Rand
    const fr = [];
    for (let t = 0; t <= 1; t += 0.07) {
      const a = lerp(-1.75, 0.95, t);
      fr.push([86 + Math.cos(a) * 19, 15 + Math.sin(a) * 23, 2]);
    }
    dots(fr, rgba(P.cream, dim ? 0.25 : 0.45));
    ctx.restore();
    // Blütenmuster
    const pet = dim ? mix(P.cream, P.main, 0.45) : mix(P.cream, P.sky, 0.3), inner = dim ? mix(P.far, P.main, 0.3) : P.far, cen = dim ? mix(P.acc, P.main, 0.4) : P.acc;
    for (const [x, y, r, a] of MOTH_FLOWERS) wingFlower(x, y, r, pet, inner, cen, a);
    if (!dim) dots(MOTH_FLOWERS.map(([x, y, r]) => [x - r * 0.12, y - r * 0.12, r * 0.1]), P.accLight);
    // Pelz am Flügelansatz
    dots([[44, 44, 4.2], [48, 47, 3.6], [45, 50, 3.2]], dim ? mix(P.sky, P.main, 0.5) : mix(P.cream, P.sky, 0.5));
  }
  ART2.boss.moth = (P, t, w) => {
    const ew = smooth01(w), pulse = 0.5 + 0.5 * Math.sin(t * 0.35);
    const flap = Math.sin(t * 0.085);
    const aNear = -0.38 * ew + flap * 0.11 * (1 - ew * 0.6) + 0.02, aFar = 0.32 * ew + Math.sin(t * 0.085 - 0.6) * 0.08 * (1 - ew * 0.6) + 0.07;
    const fur = mix(P.cream, P.sky, 0.45), furSide = mix(P.sky, P.far, 0.6), furDark = mix(P.far, P.main, 0.45);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // etwas größer als die Grundform, Mund bleibt bei (6, 48)
    ctx.save();
    ctx.translate(6, 48);
    ctx.scale(1.12, 1.12);
    ctx.translate(-6, -48 + Math.sin(t * 0.06) * 1.2);
    // hinterer Flügel (dunkler, leicht versetzt)
    ctx.save();
    ctx.translate(5, -3);
    pivot(MW_PIV[0], MW_PIV[1], aFar, () => {
      ctx.translate(MW_PIV[0], MW_PIV[1]);
      ctx.scale(0.92, 0.92);
      ctx.translate(-MW_PIV[0], -MW_PIV[1]);
      cached('moth:far', P, () => mothWing(P, true));
      if (ew > 0.01) for (const [x, y, r] of MOTH_FLOWERS) glow(x, y, r * (1.2 + ew), P.accLight, ew * (0.35 + 0.25 * pulse));
    });
    ctx.restore();
    // vorderer Flügel
    pivot(MW_PIV[0], MW_PIV[1], aNear, () => {
      cached('moth:near', P, () => mothWing(P, false));
      if (ew > 0.01) {
        for (const [x, y, r] of MOTH_FLOWERS) glow(x, y, r * (1.5 + ew * 1.4), P.accLight, ew * (0.65 + 0.35 * pulse));
        for (const [x, y, r, a] of MOTH_FLOWERS) wingFlower(x, y, r * (0.95 + 0.1 * pulse * ew), rgba(P.cream, ew * 0.8), rgba(P.accLight, ew * 0.9), P.acc, a);
      }
    });
    // Körper
    cached('moth:body', P, () => {
      // Beinchen mit Pelzsocken
      ctx.strokeStyle = P.mainDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [x0, x1, y1] of [[32, 24, 82], [40, 35, 87], [48, 47, 88]]) { ctx.moveTo(x0, 62); ctx.quadraticCurveTo((x0 + x1) / 2 - 3, 76, x1, y1); }
      ctx.stroke();
      dots([[24, 82, 2.6], [35, 87, 2.6], [47, 88, 2.6]], fur);
      // Hinterleib aus Ballen, rundlich und schwer, mit weichen Ringen
      const abd = [[48, 63, 13], [58, 69, 15], [68, 75, 14.5], [77, 81, 12], [84, 87, 8.5]];
      const abdPath = () => blobPath(abd.concat([[54, 76, 8], [64, 82, 8], [74, 88, 6], [58, 56, 6], [70, 63, 6]]));
      ctx.save();
      ctx.translate(1.5, 2);
      abdPath();
      ctx.fillStyle = furDark;
      ctx.fill();
      ctx.restore();
      abdPath();
      ctx.fillStyle = vgrad(50, 86, [[0, fur], [0.55, mix(fur, furSide, 0.5)], [1, furSide]]);
      ctx.fill();
      ctx.save();
      abdPath();
      ctx.clip();
      ctx.beginPath();
      for (const x of [57, 67, 77]) { ctx.moveTo(x - 5, 50); ctx.quadraticCurveTo(x + 5, 72, x - 3, 98); }
      ctx.strokeStyle = rgba(P.main, 0.45);
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.fillStyle = hgrad(60, 96, [[0, rgba(furDark, 0)], [1, rgba(furDark, 0.4)]]);
      ctx.fillRect(60, 48, 38, 52);
      ctx.fillStyle = vgrad(74, 98, [[0, rgba(furDark, 0)], [1, rgba(furDark, 0.3)]]);
      ctx.fillRect(40, 74, 56, 26);
      ctx.restore();
      dots([[89, 89, 3.8], [91, 85, 2.8], [89, 93, 2.6]], P.acc);
      dots(abd.slice(0, 4).map(([x, y, r]) => [x - r * 0.3, y - r * 0.45, r * 0.32]), rgba(P.cream, 0.55));
      // Brust: großer Pelzball mit Büscheln
      const tufts = [];
      for (let k = 0; k < 14; k++) { const a = k * TAU / 14; tufts.push([37 + Math.cos(a) * 14, 54 + Math.sin(a) * 13, 4.2]); }
      blobPath(tufts.concat([[37, 54, 14]]).map(([x, y, r]) => [x + 1.4, y + 1.8, r]));
      ctx.fillStyle = furDark;
      ctx.fill();
      blobPath(tufts.concat([[37, 54, 14]]));
      ctx.fillStyle = rgrad(31, 46, 2, 22, [[0, P.cream], [0.55, fur], [1, furSide]]);
      ctx.fill();
      // Kragen in Gelb zwischen Kopf und Brust
      const col = [[27, 42, 4.4], [25.5, 49, 4.6], [26, 56, 4.4], [28, 62, 3.8]];
      dots(col.map(([x, y, r]) => [x + 1, y + 1.2, r]), P.accSide);
      dots(col, P.acc);
      dots(col.map(([x, y, r]) => [x - r * 0.3, y - r * 0.35, r * 0.4]), P.accLight);
      // Kopf
      const head = [[18, 50, 12], [12, 46, 6], [14, 56, 6], [22, 42, 6], [24, 57, 6]];
      blobPath(head.map(([x, y, r]) => [x + 1.2, y + 1.6, r]));
      ctx.fillStyle = furSide;
      ctx.fill();
      blobPath(head);
      ctx.fillStyle = rgrad(13, 44, 1, 16, [[0, P.cream], [0.6, mix(P.sky, P.cream, 0.4)], [1, mix(P.sky, P.far, 0.5)]]);
      ctx.fill();
      // Bäckchen und Mund
      ellipse(16.5, 57.5, 3.6, 2.1, 0, rgba(P.main, 0.5));
      ctx.strokeStyle = P.mainDark;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(6.5, 51.5);
      ctx.quadraticCurveTo(8.5, 54, 11, 52.5);
      ctx.stroke();
    });
    // Auge: groß und rund, blinzelt; bei der Vorwarnung weit offen mit hellem Funkeln
    const ex = 13.5, ey = 46.5, blink = blinkAt(t, 230, 12) * (1 - Math.min(1, ew * 3));
    ellipse(ex, ey, 6.3, 6.6 * (1 - blink * 0.85), 0, P.ink);
    if (blink < 0.5) {
      circle(ex - 2, ey - 2.4, 2.2 + ew * 0.6, P.cream);
      circle(ex + 1.8, ey + 2, 1.1 + ew * 0.4, rgba(P.cream, 0.85));
      if (ew > 0.01) {
        const q = (1.5 + 2.5 * ew) * (0.8 + 0.2 * pulse), sx = ex - 2, sy = ey - 2.4;
        poly([[sx, sy - q * 1.6], [sx + q * 0.3, sy - q * 0.3], [sx + q * 1.6, sy], [sx + q * 0.3, sy + q * 0.3], [sx, sy + q * 1.6], [sx - q * 0.3, sy + q * 0.3], [sx - q * 1.6, sy], [sx - q * 0.3, sy - q * 0.3]], rgba('#ffffff', 0.85 * ew));
      }
    } else {
      ctx.strokeStyle = P.mainDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex - 5, ey);
      ctx.quadraticCurveTo(ex, ey + 3, ex + 5, ey);
      ctx.stroke();
    }
    // gefiederte Fühler: wiegen sich, richten sich bei der Vorwarnung nach vorn auf
    const sway = Math.sin(t * 0.05) * 1.6;
    const ants = [[[20, 39], [10 - ew * 4, 22 - ew * 2], [4 - ew * 10 + sway, 12 + ew * 6]], [[25, 38], [22 - ew * 2, 20 - ew * 4], [18 - ew * 8 + sway * 0.7, 8 - ew * 2]]];
    const barbs = [];
    for (const [a, b, c] of ants) {
      for (let tt = 0.3; tt < 0.98; tt += 0.1) {
        const px = (1 - tt) * (1 - tt) * a[0] + 2 * (1 - tt) * tt * b[0] + tt * tt * c[0], py = (1 - tt) * (1 - tt) * a[1] + 2 * (1 - tt) * tt * b[1] + tt * tt * c[1];
        const dx = 2 * (1 - tt) * (b[0] - a[0]) + 2 * tt * (c[0] - b[0]), dy = 2 * (1 - tt) * (b[1] - a[1]) + 2 * tt * (c[1] - b[1]), dl = Math.hypot(dx, dy) || 1;
        const ll = 3.8 * (1 - tt * 0.5), nx = -dy / dl, ny = dx / dl;
        barbs.push([px, py, px + nx * ll + dx / dl * ll * 0.6, py + ny * ll + dy / dl * ll * 0.6], [px, py, px - nx * ll + dx / dl * ll * 0.6, py - ny * ll + dy / dl * ll * 0.6]);
      }
    }
    segs(barbs, mix(P.main, P.mainDark, 0.3), 0.9);
    ctx.strokeStyle = P.mainDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [a, b, c] of ants) { ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); }
    ctx.stroke();
    for (const [, , c] of ants) {
      if (ew > 0.01) glow(c[0], c[1], 4 + ew * 6, P.accLight, ew * (0.6 + 0.3 * pulse));
      circle(c[0], c[1], 1.8 + ew * 0.8, ew > 0.3 ? P.accLight : P.acc);
    }
    // Blütenblatt formt sich am Mund
    if (ew > 0.02) {
      glow(3, 48, 8 + ew * 10, P.accLight, ew * 0.55);
      ctx.save();
      ctx.translate(2, 48);
      ctx.rotate(-1.2 + Math.sin(t * 0.2) * 0.15);
      ctx.scale(ew, ew);
      paintPetal(8.5, mix(P.main, P.cream, 0.15), P.mainSide, mix(P.cream, '#ffffff', 0.5), rgba(P.mainDark, 0.75), P.accLight);
      ctx.restore();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------
  // Lagunenkrabbe: rund, korallenrot mit türkisen Tupfen, Stielaugen, eine große Schere vorn.
  // Vorwarnung: beide Scheren heben sich, vorn erscheint die Muschel in der Schere, die Augen
  // fahren aus und funkeln, die hintere Schere winkt frech.
  // ---------------------------------------------------------
  function crabClaw(cx, cy, ang, open, s, P, dim) {
    const shell = dim ? P.accSide : P.acc, side = dim ? mix(P.accSide, P.accDark, 0.4) : P.accSide, lit = dim ? P.acc : P.accLight;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.scale(s, s);
    // fester Finger
    const fixed = () => {
      ctx.beginPath();
      ctx.moveTo(-6, 1);
      ctx.bezierCurveTo(-14, 1, -22, 4, -26, 2);
      ctx.bezierCurveTo(-22, 8, -12, 10, -4, 8);
      ctx.closePath();
    };
    const movable = () => {
      ctx.save();
      ctx.translate(-5, -3);
      ctx.rotate(-open);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-8, -6, -18, -6, -23, -1);
      ctx.bezierCurveTo(-16, -1, -8, 1, 0, 4);
      ctx.closePath();
      ctx.restore();
    };
    for (const [fn, dx] of [[fixed, 1.2], [movable, 1.2]]) {
      ctx.save();
      ctx.translate(dx, 1.5);
      fn();
      ctx.fillStyle = side;
      ctx.fill();
      ctx.restore();
      fn();
      ctx.fillStyle = hgrad(-26, -2, [[0, P.accDark], [0.28, mix(P.accDark, shell, 0.5)], [0.5, shell], [1, shell]]);
      ctx.fill();
    }
    // Handballen
    ctx.beginPath();
    ctx.ellipse(1.5, 2, 12, 9, 0, 0, TAU);
    ctx.fillStyle = side;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 12, 9, 0, 0, TAU);
    ctx.fillStyle = rgrad(-4, -4, 1, 14, [[0, lit], [0.5, shell], [1, side]]);
    ctx.fill();
    ctx.strokeStyle = rgba(P.accDark, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    dots([[3, 3, 1.8], [6.5, -2, 1.3], [-2, 5, 1.2]], rgba(P.far, dim ? 0.5 : 0.85));
    ellipse(-3, -4, 5, 2.4, -0.3, rgba(P.cream, dim ? 0.2 : 0.45));
    ctx.restore();
  }
  // Glied aus zwei Segmenten mit Gelenk (Beine, Arme)
  function limb(a, b, c, wd, P, dim) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.strokeStyle = dim ? mix(P.accSide, P.accDark, 0.45) : P.accSide;
    ctx.lineWidth = wd;
    ctx.stroke();
    ctx.strokeStyle = dim ? P.accSide : P.acc;
    ctx.lineWidth = wd * 0.55;
    ctx.beginPath();
    ctx.moveTo(a[0] - 0.4, a[1] - 0.6);
    ctx.lineTo(b[0] - 0.4, b[1] - 0.6);
    ctx.lineTo(c[0] - 0.4, c[1] - 0.6);
    ctx.stroke();
  }
  // Jakobsmuschel: Fächer mit Rippen und Öhrchen. Mitte (0, 0), Radius r, Schloss unten
  function scallop(r, P) {
    const light = mix(P.acc, P.cream, 0.55), mid = mix(P.acc, P.cream, 0.2), dark = P.accSide, rim = P.accDark;
    const A0 = Math.PI - 0.42, A1 = TAU + 0.42, NR = 9, cy = -r * 0.08, R = r * 0.86;
    const fan = () => {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.84);
      ctx.lineTo(Math.cos(A0) * R, cy + Math.sin(A0) * R);
      for (let k = 0; k < NR; k++) {
        const am = lerp(A0, A1, (k + 0.5) / NR), ab = lerp(A0, A1, (k + 1) / NR);
        ctx.quadraticCurveTo(Math.cos(am) * R * 1.13, cy + Math.sin(am) * R * 1.13, Math.cos(ab) * R, cy + Math.sin(ab) * R);
      }
      ctx.closePath();
    };
    // Öhrchen am Schloss
    poly([[-r * 0.4, r * 0.6], [r * 0.4, r * 0.6], [r * 0.34, r * 0.94], [-r * 0.34, r * 0.94]], dark);
    poly([[-r * 0.36, r * 0.6], [r * 0.06, r * 0.6], [r * 0.04, r * 0.88], [-r * 0.3, r * 0.88]], mid);
    ctx.save();
    ctx.translate(r * 0.08, r * 0.1);
    fan();
    ctx.fillStyle = rgba(INK, 0.25);
    ctx.fill();
    ctx.restore();
    fan();
    ctx.fillStyle = rgrad(-r * 0.3, -r * 0.4, r * 0.05, r * 1.2, [[0, light], [0.55, mid], [1, dark]]);
    ctx.fill();
    // Rippen: abwechselnd helle und dunkle Keile
    ctx.save();
    fan();
    ctx.clip();
    // Rippen: Furchen vom Schloss zu den Einbuchtungen des Rands, dazwischen helle Grate
    ctx.beginPath();
    for (let k = 1; k < NR; k++) { const a = lerp(A0, A1, k / NR); ctx.moveTo(0, r * 0.8); ctx.lineTo(Math.cos(a) * R, cy + Math.sin(a) * R); }
    ctx.strokeStyle = rgba(dark, 0.75);
    ctx.lineWidth = Math.max(0.8, r * 0.09);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < NR; k++) { const a = lerp(A0, A1, (k + 0.5) / NR); ctx.moveTo(0, r * 0.7); ctx.lineTo(Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98); }
    ctx.strokeStyle = rgba('#ffffff', 0.3);
    ctx.lineWidth = Math.max(0.6, r * 0.06);
    ctx.stroke();
    ctx.restore();
    fan();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.stroke();
    ellipse(-r * 0.35, -r * 0.4, r * 0.24, r * 0.13, -0.5, rgba('#ffffff', 0.6));
  }
  ART2.boss.crab = (P, t, w) => {
    const ew = smooth01(w), pulse = 0.5 + 0.5 * Math.sin(t * 0.4);
    const bob = Math.sin(t * 0.06) * 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(6, 48);
    ctx.scale(1.17, 1.17);
    ctx.translate(-6, -48);
    // Blasen unter der Krabbe (sie schwebt auf einem Blasenpolster)
    for (let k = 0; k < 6; k++) {
      const p = ((t * 0.6 + k * 23) % 70) / 70, x = 34 + k * 9 + Math.sin(t * 0.05 + k * 2) * 2, y = 114 - p * 26, rr = 1.6 + (k % 3) * 0.8;
      ctx.strokeStyle = rgba(P.cream, 0.7 * Math.sin(p * Math.PI));
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.stroke();
      circle(x - rr * 0.35, y - rr * 0.35, rr * 0.3, rgba(P.cream, 0.8 * Math.sin(p * Math.PI)));
    }
    // hintere Beine (dunkler)
    for (let k = 0; k < 3; k++) {
      const hx = 58 + k * 9, wig = Math.sin(t * 0.09 + k * 1.3) * 1.6;
      limb([hx, 84 + bob], [hx + 10 + k * 2, 92 + wig + bob], [hx + 13 + k * 3, 104 + wig * 0.5 + bob], 4.4, P, true);
    }
    // hintere Schere: ruht neben dem Körper, winkt bei der Vorwarnung hoch über dem Panzer
    const wave = Math.sin(t * 0.32) * 0.25 * ew;
    const bc = [lerp(94, 92, ew), lerp(70, 30, ew) + bob];
    limb([78, 74 + bob], [lerp(90, 92, ew), lerp(80, 56, ew) + bob], [bc[0] + 4, bc[1] + 8], 5, P, true);
    crabClaw(bc[0], bc[1], lerp(-0.9, -1.75, ew) + wave, 0.25 + ew * (0.25 + 0.25 * pulse), 0.62, P, true);
    // Panzer, Bauch, Mund
    ctx.save();
    ctx.translate(0, bob);
    cached('crab:body', P, () => {
      const shell = () => {
        ctx.beginPath();
        ctx.moveTo(22, 74);
        ctx.bezierCurveTo(20, 58, 35, 47, 54, 47);
        ctx.bezierCurveTo(73, 47, 87, 57, 87, 72);
        ctx.bezierCurveTo(87, 82, 75, 88, 56, 88);
        ctx.bezierCurveTo(37, 88, 23, 84, 22, 74);
        ctx.closePath();
      };
      // Bauch
      ellipse(55, 87, 25, 5.5, 0, mix(P.sky, P.main, 0.35));
      ellipse(54, 86, 23, 4.2, 0, P.sky);
      ctx.save();
      ctx.translate(1.6, 2.2);
      shell();
      ctx.fillStyle = P.accDark;
      ctx.fill();
      ctx.restore();
      shell();
      ctx.fillStyle = rgrad(42, 54, 2, 44, [[0, P.accLight], [0.35, P.acc], [1, P.accSide]]);
      ctx.fill();
      ctx.strokeStyle = rgba(P.accDark, 0.6);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.save();
      shell();
      ctx.clip();
      ctx.fillStyle = vgrad(70, 90, [[0, rgba(P.accDark, 0)], [1, rgba(P.accDark, 0.35)]]);
      ctx.fillRect(18, 70, 72, 20);
      // Furchen
      ctx.beginPath();
      ctx.moveTo(44, 50); ctx.quadraticCurveTo(48, 64, 42, 80);
      ctx.moveTo(66, 50); ctx.quadraticCurveTo(62, 64, 68, 80);
      ctx.strokeStyle = rgba(P.accDark, 0.3);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
      // türkise Tupfen und helle Sprenkel
      const sp = [[54, 58, 3.4], [64, 64, 2.6], [46, 66, 2.4], [74, 70, 2.8], [58, 74, 2], [36, 70, 1.8], [80, 62, 1.8]];
      dots(sp.map(([a, b, c]) => [a + 0.5, b + 0.7, c]), rgba(P.accDark, 0.4));
      dots(sp, P.far);
      dots(sp.map(([a, b, c]) => [a - c * 0.3, b - c * 0.35, c * 0.35]), rgba(P.cream, 0.6));
      dots([[48, 54, 0.9], [60, 52, 0.8], [70, 57, 0.9], [40, 60, 0.8]], rgba(P.cream, 0.7));
      ellipse(44, 53, 12, 3.6, -0.25, rgba(P.cream, 0.35));
      // Zacken am Panzerrand vorn
      const tz = [];
      for (const [x, y] of [[25, 62], [29, 56], [34, 51]]) tz.push([x, y]);
      for (const [x, y] of tz) poly([[x - 2.4, y + 2], [x - 4.2, y - 2], [x + 1.8, y - 0.5]], P.acc);
      // breites Grinsen
      ctx.beginPath();
      ctx.moveTo(25, 73);
      ctx.quadraticCurveTo(30, 80, 38, 76);
      ctx.strokeStyle = P.accDark;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ellipse(36, 71, 3, 1.7, 0, rgba(P.main, 0.55));
    });
    ctx.restore();
    // Stielaugen: fahren bei der Vorwarnung aus, Pupillen schauen nach vorn, Lider heben sich
    const eyes = [[36, 52, lerp(31, 28, ew), lerp(34, 24, ew), 5.6], [47, 50, lerp(45, 43, ew), lerp(30, 19, ew), 5.2]];
    for (const [x0, y0, x1, y1] of eyes) {
      line(x0, y0 + bob, x1, y1 + 4 + bob, P.accSide, 3.4);
      line(x0 - 0.5, y0 + bob, x1 - 0.5, y1 + 4 + bob, P.acc, 1.8);
    }
    const blink = blinkAt(t, 200, 10) * (1 - Math.min(1, ew * 3));
    eyes.forEach(([, , x, y0, r], k) => {
      const y = y0 + bob;
      circle(x + 0.6, y + 0.8, r, rgba(P.accDark, 0.5));
      circle(x, y, r, P.cream);
      ctx.strokeStyle = rgba(P.accDark, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      const pr = r * lerp(0.55, 0.45, ew);
      circle(x - 1.6 - ew * 0.6, y + 0.6, pr, P.ink);
      circle(x - 2.4 - ew * 0.6, y - 0.6, pr * 0.38, P.cream);
      if (ew > 0.01) {
        glow(x, y, r + 5 + ew * 4, P.accLight, ew * (0.35 + 0.3 * pulse));
        ctx.strokeStyle = rgba(P.accLight, ew);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, r + 1.2, 0, TAU);
        ctx.stroke();
      }
      // Lid: in Ruhe halb geschlossen (verschmitzt, beim linken Auge mehr), blinzelt; bei Vorwarnung weit offen
      const lid = Math.max(blink, (k === 0 ? 0.42 : 0.3) * (1 - ew));
      if (lid > 0.02) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r + 0.3, 0, TAU);
        ctx.clip();
        ctx.fillStyle = P.acc;
        ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, (r * 2 + 2) * lid);
        ctx.strokeStyle = P.accDark;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r - 1 + (r * 2 + 2) * lid);
        ctx.lineTo(x + r, y - r - 1 + (r * 2 + 2) * lid - (k === 0 ? 1.2 : -0.6));
        ctx.stroke();
        ctx.restore();
      }
    });
    // vordere Beine
    for (let k = 0; k < 2; k++) {
      const hx = 34 + k * 10, wig = Math.sin(t * 0.09 + k * 1.7 + 1) * 1.6;
      limb([hx, 84 + bob], [hx - 9 - k * 2, 93 + wig + bob], [hx - 11 - k * 3, 105 + wig * 0.5 + bob], 4.6, P, false);
    }
    // vordere große Schere: hebt sich zum Wurf bis vor den Mund (6/48), hält dann die Muschel
    const cc = [lerp(16, 15, ew), lerp(70, 50, ew) + bob * (1 - ew)];
    limb([32, 78 + bob], [lerp(26, 30, ew), lerp(86, 72, ew) + bob], [cc[0] + 9, cc[1] + 3], 6, P, false);
    const open = 0.15 + ew * 0.55;
    if (ew > 0.02) glow(4, 48, 10 + ew * 9, P.accLight, ew * (0.45 + 0.3 * pulse));
    crabClaw(cc[0], cc[1], lerp(-0.12, -0.05, ew), open, 1.05, P, false);
    if (ew > 0.02) {
      ctx.save();
      ctx.translate(4, 47);
      ctx.rotate(-0.35 + Math.sin(t * 0.25) * 0.08);
      ctx.scale(ew * 0.8, ew * 0.8);
      scallop(10, P);
      ctx.restore();
    }
    ctx.restore();
  };

  // ============================================================
  // Geschosse
  // ============================================================
  // Blütenblatt: rosa mit dunklem Rand, hellem Grund und Adern; dreht sich langsam beim Schweben
  ART2.projectile.petal = (s, C, x, y) => {
    const r = s.r, ang = Math.atan2(s.vy || 0, s.vx || -1);
    const pink = mix(C.pipe, '#e8709e', 0.35), deep = mix(shade(C.pipe, -0.28), '#a04a7a', 0.3), light = mix(C.pipe, '#ffffff', 0.62);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2 + Math.sin((s.t || 0) * 0.08) * 0.5);
    paintPetal(r, pink, deep, light, rgba(mix(deep, INK, 0.35), 0.85), mix(C.accent, CREAM, 0.4));
    ctx.restore();
  };
  // Muschel: Jakobsmuschel in Koralle und Creme, dunkler Rand; dreht sich im Wurf
  ART2.projectile.shell = (s, C, x, y) => {
    const r = s.r;
    const P = { acc: C.accent, accSide: shade(C.accent, -0.22), accDark: shade(C.accent, -0.5), cream: CREAM };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((s.t || 0) * 0.12 * (s.vx > 0 ? 1 : -1));
    scallop(r, P);
    ctx.restore();
  };

  // ============================================================
  // Level-Zuordnung (nur Darstellung)
  // ============================================================
  const byName = n => LEVELS.find(L => L.name === n);
  const LB = byName('Blütenhain');
  if (LB) {
    Object.assign(LB, {
      sky: { body: 'sun', sunX: 0.72, sunY: 108, cirrus: true, extra: 'blBloom' },
      layers: [
        { kind: 'blHills', P: 1000, seed: 161 },
        { kind: 'blMeadow', P: 1200, seed: 162 },
        { kind: 'props', P: 1400, prop: 'blFlower', spacing: 46, seed: 163 }
      ]
    });
    LB.style.pipe = 'blCherry';
    LB.style.ground = 'blGrass';
    LB.style.boss = 'moth';
    LB.style.projectile = 'petal';
  }
  const LL = byName('Lagune');
  if (LL) {
    Object.assign(LL, {
      sky: { body: 'sun', sunX: 0.78, sunY: 150, big: true, extra: 'blLagoon' },
      layers: [
        { kind: 'blReef', P: 1000, seed: 171 },
        { kind: 'blBeach', P: 1200, seed: 172 },
        { kind: 'props', P: 1400, prop: 'blBeachProp', spacing: 72, seed: 173 }
      ]
    });
    LL.style.pipe = 'blPalm';
    LL.style.ground = 'blSand';
    LL.style.boss = 'crab';
    LL.style.projectile = 'shell';
  }
})();
