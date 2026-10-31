// ============================================================
// Bosse 9 und 11 bis 14: Irrlichtkröte, Prismenwächter, Wolkenwal,
// Uhrwerkeule, Aschephönix. Jede Malfunktion zeichnet in die Bossbox
// 90 x 110 (Blick nach links, Maul bei 6/48) und nutzt nur Farben aus P,
// damit das Aufblitzen nach einem Ausweichen wirkt.
// t: Bildzähler für ruhige Bewegung, w: Vorwarnung 0..1.
// Ruhende Teile liegen in einer zwischengespeicherten Ebene; pro Bild werden
// nur die bewegten Teile neu gemalt.
// ============================================================
(() => {
  const SD = CONFIG.SIDE_DARKEN;
  const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  // ---------- Zwischenspeicher ----------
  // Malt paint() einmal in eine eigene Leinwand (logischer Bereich x0, y0, w, h) und kopiert sie danach nur noch.
  // Neu gemalt wird bei anderer Palette (Aufblitzen) oder Auflösung. Ohne Bereichsangabe deckt die Ebene die
  // ganze Bossfläche ab (Box plus 34 Rand) und sitzt dadurch pixelgenau. Unter Drehung gezeichnet dient sie als Sprite.
  const LP = 34, layerCache = new Map();
  function cached(id, P, paint, x0 = -LP, y0 = -LP, w = CONFIG.BOSS_W + LP * 2, h = CONFIG.BOSS_H + LP * 2) {
    const m = ctx.getTransform ? ctx.getTransform() : { a: view.k, b: 0 };
    const k = Math.hypot(m.a, m.b) || 1;
    const key = P.main + P.acc + P.near + P.far + P.sky + P.ink + '|' + k.toFixed(4);
    let L = layerCache.get(id);
    if (!L) {
      // Nur der gerade gezeigte Boss behält seine Ebenen
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

  // ---------- Zeichenhilfen ----------
  // Weicher Lichthof als radialer Verlauf
  function glow(x, y, r, col, a) {
    if (a <= 0.004 || r <= 0.5) return;
    ctx.fillStyle = rgrad(x, y, 0, r, [[0, rgba(col, Math.min(1, a))], [0.45, rgba(col, Math.min(1, a) * 0.38)], [1, rgba(col, 0)]]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // Form zweimal: Seitenfläche versetzt dahinter, Vorderseite darüber
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
  // Punkt p um (cx, cy) drehen
  const turn = (p, cx, cy, a) => {
    const c = Math.cos(a), s = Math.sin(a), dx = p[0] - cx, dy = p[1] - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  };
  // um einen Punkt gedreht zeichnen
  function pivot(x, y, a, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.translate(-x, -y);
    fn();
    ctx.restore();
  }
  // Vierzackiger Funkel
  function sparkle(x, y, s, col) {
    if (s <= 0.2) return;
    const q = s * 0.22;
    poly([[x, y - s], [x + q, y - q], [x + s, y], [x + q, y + q], [x, y + s], [x - q, y + q], [x - s, y], [x - q, y - q]], col);
  }
  // Linearer Verlauf zwischen zwei Punkten
  function lgrad(x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  // Kurvenzug als Strich (drei Punkte: quadratische Kurve)
  function curve(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  function stroke(pts, col, lw) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    curve(pts);
    ctx.stroke();
  }
  // mehrere Kurvenzüge gleicher Art in einem Strich
  function strokes(list, col, lw) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const pts of list) curve(pts);
    ctx.stroke();
  }
  // Kleines Zahnrad: Zähne als Trapeze
  function gearPathSmall(x, y, r, teeth, ang, depth) {
    const rin = r - depth, st = TAU / teeth;
    ctx.beginPath();
    for (let k = 0; k < teeth; k++) {
      const a0 = ang + k * st;
      const pts = [[a0, rin], [a0 + st * 0.16, r], [a0 + st * 0.42, r], [a0 + st * 0.58, rin]];
      pts.forEach(([a, rr], i) => {
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (k === 0 && i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.arc(x, y, rin, a0 + st * 0.58, a0 + st);
    }
    ctx.closePath();
  }
  // Spitz zulaufendes Band entlang einer quadratischen Kurve (Federn, Flammen).
  // ex verschiebt die breiteste Stelle: 1 in der Mitte, größer weiter zur Spitze.
  function ribbonPath(x0, y0, cx, cy, x1, y1, wMax, wBase, ex, segs) {
    const L = [], R = [], n = segs || 12, e = ex || 1;
    for (let i = 0; i <= n; i++) {
      const s = i / n, u = 1 - s;
      const x = u * u * x0 + 2 * u * s * cx + s * s * x1, y = u * u * y0 + 2 * u * s * cy + s * s * y1;
      const tx = 2 * u * (cx - x0) + 2 * s * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * s * (y1 - cy), tl = Math.hypot(tx, ty) || 1;
      const hw = Math.max((wBase || 0) * (1 - s), wMax * Math.sin(Math.PI * Math.pow(s, e)));
      L.push([x - ty / tl * hw, y + tx / tl * hw]);
      R.push([x + ty / tl * hw, y - tx / tl * hw]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  // Lidschlag alle period Bilder, dauer Bilder lang, als weicher Sinusbogen
  const blinkAt = (t, period, dur) => { const p = (t % period) / dur; return p < 1 ? Math.sin(p * Math.PI) : 0; };

  // Laufender Laser (Muster 'laser'): Ziellinie 0..1, Strahl 1, danach kurz abklingend.
  // Der Laser zielt und feuert, während warnProgress() noch 0 ist; so öffnet sich das Maul trotzdem im Takt.
  function laserOpen() {
    let v = 0;
    for (const s of shots) {
      if (s.type !== 'laser') continue;
      v = Math.max(v, s.t < s.warn ? s.t / s.warn : s.t < s.warn + s.active ? 1 : Math.max(0, 1 - (s.t - s.warn - s.active) / 10));
    }
    return v;
  }

  // ---------------------------------------------------------
  // 9 Irrlichtkröte: Moorkröte auf einem Seerosenblatt, vor ihr schwebt ein Irrlicht
  // ---------------------------------------------------------
  ART2.boss.toad = (P, t, w) => {
    const ew = smooth01(Math.max(w, laserOpen()));
    const skin = mix(P.main, P.far, 0.35), skinSide = shade(skin, -SD), skinDark = shade(skin, -0.35), skinLight = mix(skin, P.cream, 0.28);
    const belly = mix(mix(P.main, P.cream, 0.5), P.acc, 0.1), throat = mix(skin, belly, 0.8);
    const moss = mix(P.near, P.acc, 0.3), mossSide = shade(moss, -0.25), mossLight = mix(moss, P.acc, 0.45);
    const leaf = mix(P.near, P.far, 0.45), leafSide = shade(leaf, -0.3), leafLight = mix(leaf, P.acc, 0.22);
    const br = Math.sin(t * 0.045), fl = 0.5 + 0.5 * Math.sin(t * 0.09);
    const ex = 23.5, ey = 30;
    const glowWarts = [[57, 47, 1.7, 0], [74, 58, 1.5, 2], [63, 68, 1.3, 4]];
    const shrooms = [[74, 25, 1], [80, 30, 0.75]];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Tropfen unter dem Blatt
    for (let k = 0; k < 3; k++) {
      const p = ((t + k * 31) % 80) / 80;
      circle(26 + k * 24, 107 + p * p * 16, 1.3 * (1 - p * 0.4), rgba(mix(P.far, P.cream, 0.45), 0.75 * (1 - p)));
    }

    cached('toad', P, () => {
      // Seerosenblatt
      layered(() => { ctx.beginPath(); ctx.ellipse(48, 101, 41, 6.8, 0, 0, TAU); }, leafSide, leaf, 0, 1.8);
      ctx.strokeStyle = rgba(leafSide, 0.7);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { const a = 0.9 + k * 0.78; ctx.moveTo(48, 101); ctx.lineTo(48 + Math.cos(a) * 37, 101 + Math.sin(a) * 6); }
      ctx.stroke();
      ctx.strokeStyle = rgba(leafLight, 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(48, 101, 40, 6.1, 0, Math.PI * 1.02, Math.PI * 1.55);
      ctx.stroke();

      // zweites Auge hinter dem Kopf
      circle(38.6, 25.6, 6.4, skinSide);
      circle(38, 25, 5.8, skin);
      circle(35.6, 23.6, 2.5, P.accSide);

      // Körper
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(4, 52);
        ctx.bezierCurveTo(1, 44, 6, 36, 16, 33);
        ctx.bezierCurveTo(30, 26, 44, 21, 60, 24);
        ctx.bezierCurveTo(78, 28, 91, 44, 90, 66);
        ctx.bezierCurveTo(90, 84, 80, 97, 62, 98);
        ctx.lineTo(30, 98);
        ctx.bezierCurveTo(16, 97, 10, 82, 12, 68);
        ctx.bezierCurveTo(8, 63, 5, 58, 4, 52);
        ctx.closePath();
      };
      layered(body, skinSide, skin, 1.5, 2);
      ctx.save();
      body();
      ctx.clip();
      ctx.fillStyle = hgrad(56, 92, [[0, rgba(skinDark, 0)], [1, rgba(skinDark, 0.55)]]);
      ctx.fillRect(56, 20, 40, 82);
      ctx.fillStyle = vgrad(80, 100, [[0, rgba(P.mainDark, 0)], [1, rgba(P.mainDark, 0.4)]]);
      ctx.fillRect(0, 80, 92, 22);
      ctx.fillStyle = rgrad(22, 80, 2, 19, [[0, rgba(belly, 0.85)], [0.6, rgba(belly, 0.5)], [1, rgba(belly, 0)]]);
      ctx.fillRect(0, 58, 44, 44);
      ellipse(38, 33, 20, 6.5, -0.28, rgba(P.cream, 0.16));
      ctx.restore();

      // Hinterfuß und Oberschenkel
      const toes = [[34, 101.6], [39.5, 103.8], [45.5, 105], [52, 105.4]];
      strokes(toes.map(([x1, y1]) => [[60, 99], [x1 + 8, y1 - 1.5], [x1, y1]]), skinSide, 2.8);
      strokes(toes.map(([x1, y1]) => [[60, 98.5], [x1 + 8, y1 - 2], [x1, y1 - 0.4]]), skin, 1.4);
      dots(toes.map(([x, y]) => [x, y, 1.6]), skinLight);
      ellipse(74.5, 81, 17, 13.5, -0.4, skinSide);
      ellipse(73, 79.5, 15.8, 12.4, -0.4, skin);
      ellipse(68, 74, 8, 3.6, -0.55, rgba(P.cream, 0.14));

      // Moos, Sprossen und Leuchtpilze auf dem Rücken
      const mossBlobs = [[49, 26, 4.5], [55.5, 23.6, 5.4], [62.5, 23.4, 5.6], [69.5, 25.8, 5.2], [76, 29.6, 4.6], [81, 34.5, 3.6]];
      blobPath(mossBlobs.map(([x, y, r]) => [x + 0.8, y + 1.2, r]));
      ctx.fillStyle = mossSide;
      ctx.fill();
      blobPath(mossBlobs);
      ctx.fillStyle = moss;
      ctx.fill();
      dots(mossBlobs.map(([x, y, r]) => [x - r * 0.3, y - r * 0.35, r * 0.42]), mossLight);
      strokes([[[57, 20], [55, 15], [57.5, 10]], [[64, 19.5], [66.5, 15], [65, 11.5]]], mossSide, 1.1);
      ellipses([[55.8, 11, 2.6, 1.2, -0.6], [59, 10.2, 2.4, 1.1, 0.5], [66.6, 12.2, 2.4, 1.1, 0.6]], mossLight);
      for (const [mx, my, s] of shrooms) {
        glow(mx, my - 3 * s, 8 * s, P.accLight, 0.28);
        ctx.fillStyle = mix(P.cream, P.far, 0.25);
        ctx.fillRect(mx - 0.7 * s, my - 3.5 * s, 1.4 * s, 4 * s);
        ctx.beginPath();
        ctx.ellipse(mx, my - 3.5 * s, 3.4 * s, 2.6 * s, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = P.acc;
        ctx.fill();
        ellipse(mx - 1 * s, my - 4.8 * s, 1.3 * s, 0.7 * s, -0.3, P.accLight);
      }

      // Warzen
      const warts = [[52, 44, 2.3], [61, 38, 1.9], [70, 46, 2.5], [79, 52, 2], [58, 54, 2], [46, 50, 1.7], [66, 62, 1.8], [84, 66, 1.6], [37, 44, 1.5], [76, 74, 2.1], [82, 84, 1.7], [66, 84, 1.5]];
      dots(warts.map(([x, y, r]) => [x + 0.5, y + 0.6, r]), skinDark);
      dots(warts, mix(skin, P.cream, 0.12));
      dots(warts.map(([x, y, r]) => [x - r * 0.3, y - r * 0.35, r * 0.35]), rgba(P.cream, 0.35));

      // Ohrdrüse hinter dem Auge
      ellipse(46.6, 36.8, 10, 4.6, 0.32, skinSide);
      ellipse(45.8, 35.8, 9.2, 3.9, 0.32, skin);
      ellipse(43.6, 34.4, 5, 1.5, 0.32, rgba(P.cream, 0.22));
      dots([[41, 36.4, 0.6], [44.5, 37.4, 0.6], [48, 38.4, 0.55], [51, 39.2, 0.5]], skinDark);

      // Vorderbein, angewinkelt, mit gespreizten Fingern
      stroke([[32, 70], [38, 85], [26, 96.5]], skinSide, 8);
      stroke([[31, 69], [36.6, 84], [25.4, 95.6]], skin, 6.2);
      stroke([[29, 70], [33.5, 80], [33, 86]], rgba(P.cream, 0.16), 1.6);
      const fingers = [[13.5, 101.5], [19, 103.8], [26, 104.6], [32.5, 103.2]];
      strokes(fingers.map(([x1, y1]) => [[26, 97], [x1, y1]]), skinSide, 2.6);
      strokes(fingers.map(([x1, y1]) => [[25.6, 96.6], [x1, y1 - 0.4]]), skin, 1.3);
      dots(fingers.map(([x, y]) => [x, y, 1.5]), skinLight);
      circle(7.5, 41, 0.9, skinDark);

      // Auge: Wulst und leuchtende Iris
      glow(ex, ey, 15, P.accLight, 0.18);
      circle(ex + 0.9, ey + 1.2, 9.6, skinSide);
      circle(ex, ey, 9.4, skin);
      ellipse(ex - 3, ey - 5, 4.5, 2, -0.5, rgba(P.cream, 0.18));
      circle(ex - 0.2, ey + 0.2, 6.8, P.accDark);
      circle(ex - 0.4, ey, 6.2, rgrad(ex - 1.6, ey - 1.6, 0.5, 6.4, [[0, P.accLight], [0.55, P.acc], [1, P.accSide]]));
    });

    // Pilze und Warzen glimmen im eigenen Takt
    for (const [mx, my, s] of shrooms) glow(mx, my - 3.5 * s, 7 * s, P.accLight, 0.15 * fl);
    for (const [x, y, r, ph] of glowWarts) glow(x, y, r * 4.5, P.acc, 0.4 * (0.55 + 0.25 * Math.sin(t * 0.05 + ph) + 0.3 * ew));
    dots(glowWarts.map(([x, y, r]) => [x, y, r]), mix(P.acc, P.accLight, 0.4));

    // Maul: Unterkiefer klappt um das Gelenk auf, innen glimmt es
    const hx = 31, hy = 55, ja = -0.3 * ew;
    const upper = [[3.5, 47.5], [10, 48.6], [17, 50.2], [24, 52.4], [31, 55]];
    if (ew > 0.01) {
      const lower = upper.map(p => turn(p, hx, hy, ja)).reverse();
      poly(upper.concat(lower), mix(P.ink, P.mainDark, 0.3));
      glow(7, 50.5, 4 + ew * 12, P.accLight, ew * 0.9);
      circle(6.5, 49.6, 1 + ew * 2.2, rgba(P.cream, ew));
    }
    pivot(hx, hy, ja, () => {
      ctx.beginPath();
      ctx.moveTo(3.5, 47.5);
      ctx.quadraticCurveTo(17, 49.6, 31, 55);
      ctx.lineTo(31, 61);
      ctx.bezierCurveTo(26, 68, 15, 69, 9.5, 63);
      ctx.bezierCurveTo(6, 59, 3.5, 54, 3.5, 47.5);
      ctx.closePath();
      ctx.fillStyle = throat;
      ctx.fill();
      const sr = 1 + br * 0.05 + ew * 0.35;
      ellipse(17, 62.5, 9 * sr, 5.5 * sr, 0.08, mix(belly, P.accLight, ew * 0.8));
      if (ew > 0) glow(17, 62.5, 10 + ew * 8, P.accLight, ew * 0.55);
      ellipse(14.5, 60.5, 4 * sr, 1.6 * sr, 0.1, rgba(P.cream, 0.35));
      stroke([[3.5, 48], [17, 50.1], [31, 55.5]], skinSide, 1.4);
    });
    strokes([[[3, 47.4], [17, 49.6], [31, 55]], [[31, 55], [33.5, 56], [34, 58.5]]], rgba(P.ink, 0.75), 1.5);

    // Auge: waagrechte Pupille und schweres Lid
    if (ew > 0) glow(ex, ey, 15 + ew * 6, P.accLight, 0.32 * ew);
    ellipse(ex - 0.6, ey + 0.4, 4.3, Math.max(0.5, 1.7 - ew * 0.9), 0, P.ink);
    circle(ex - 2.6, ey - 2.4, 1.5, P.cream);
    circle(ex + 1.8, ey + 2.4, 0.6, rgba(P.cream, 0.6));
    const lid = blinkAt(t, 290, 16) * (1 - Math.min(1, ew * 3)) * 10 - ew * 2.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex - 0.2, ey + 0.2, 6.9, 0, TAU);
    ctx.clip();
    ellipse(ex - 1, ey - 9 + lid, 10, 6.6, -0.28, skin);
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(ex - 1, ey - 9 + lid, 10, 6.6, -0.28, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.restore();

    // Irrlicht
    const wx = 11 + Math.sin(t * 0.023) * 3, wy = 13 + Math.sin(t * 0.037) * 3, sway = Math.sin(t * 0.06) * 1.6;
    glow(wx, wy, 20 + ew * 8, P.accLight, 0.3 + 0.1 * fl + 0.3 * ew);
    ctx.beginPath();
    ctx.moveTo(wx - 4.6, wy + 1);
    ctx.bezierCurveTo(wx - 5.2, wy - 4, wx - 1.5, wy - 6, wx + 1.5 + sway, wy - 12);
    ctx.bezierCurveTo(wx + 2.2, wy - 6.5, wx + 5.6, wy - 3.5, wx + 4.6, wy + 1);
    ctx.arc(wx, wy + 1, 4.6, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = rgba(P.accLight, 0.92);
    ctx.fill();
    circle(wx - 0.4, wy + 0.8, 2.6, P.cream);
    for (let k = 0; k < 3; k++) {
      const a = t * 0.03 + k * 2.1;
      circle(wx + Math.cos(a) * 9, wy + 2 + Math.sin(a) * 4, 0.9, rgba(P.accLight, 0.55 + 0.3 * Math.sin(a * 1.3)));
    }
  };

  // ---------------------------------------------------------
  // 11 Prismenwächter: Kristalldrache aus facettierten Splittern mit rosa Kern
  // ---------------------------------------------------------
  ART2.boss.prism = (P, t, w) => {
    const ew = smooth01(w);
    const dark = mix(P.mainDark, P.near, 0.35);
    // Flächenfarbe nach Ausrichtung; Flächen nach rechts spiegeln den rosa Kern (Prismenschimmer)
    const facetCol = (dx, dy, base) => {
      const b = base || P.main, l = Math.hypot(dx, dy) || 1, i = (dx * LIGHT_DIR.x + dy * LIGHT_DIR.y) / l;
      const c = i >= 0 ? mix(b, P.cream, i * 0.72) : mix(b, dark, -i * 0.72);
      const pink = Math.max(0, (dx * 0.9 + dy * 0.15) / l);
      return mix(c, base ? P.accLight : P.acc, pink * 0.34);
    };
    // geschliffener Stein: äußerer Kranz aus Vierecken, innen eine Tafel
    const cutGem = (pts, c, k, base) => {
      const inner = pts.map(p => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]);
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length, a = pts[i], b = pts[j];
        poly([a, b, inner[j], inner[i]], facetCol((a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], base));
      }
      poly(inner, mix(base || P.main, P.cream, 0.22));
      ctx.strokeStyle = rgba(P.cream, 0.32);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(inner[i][0], inner[i][1]); }
      inner.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();
    };
    // Fächer aus Dreiecken um einen inneren Punkt
    const fanGem = (pts, c, base) => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        poly([c, a, b], facetCol((a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], base));
      }
      ctx.strokeStyle = rgba(P.cream, 0.3);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const p of pts) { ctx.moveTo(c[0], c[1]); ctx.lineTo(p[0], p[1]); }
      ctx.stroke();
    };
    // Splitter: Basis a-b, Spitze c; Hälften nach ihrer Seite schattiert
    const shard = (a, b, c) => {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ax = c[0] - m[0], ay = c[1] - m[1];
      let px = ay, py = -ax;
      if ((a[0] - m[0]) * px + (a[1] - m[1]) * py < 0) { px = -px; py = -py; }
      poly([a, m, c], facetCol(px + ax * 0.3, py + ay * 0.3));
      poly([m, b, c], facetCol(-px + ax * 0.3, -py + ay * 0.3));
      line(m[0], m[1], c[0], c[1], rgba(P.cream, 0.4), 0.6);
    };
    const bob = k => Math.sin(t * 0.035 + k * 1.9) * 1.6;
    const c = [64, 56];
    ctx.lineJoin = 'round';

    glow(62, 54, 50, P.acc, 0.24 + 0.2 * ew);
    // Kristallflügel: durchscheinende Haut zwischen drei Klingen, wiegt sich langsam (Sprite unter Drehung)
    const wingA = Math.sin(t * 0.03) * 0.05 - ew * 0.07;
    pivot(70, 34, wingA, () => cached('prism:wing', P, () => {
      const tips = [[94, -18], [116, 2], [120, 36]];
      ctx.beginPath();
      ctx.moveTo(62, 28);
      for (const p of tips) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(86, 62);
      ctx.closePath();
      ctx.fillStyle = lgrad(66, 40, 112, 6, [[0, rgba(P.acc, 0.42)], [1, rgba(P.main, 0.16)]]);
      ctx.fill();
      stroke(tips, rgba(P.cream, 0.4), 0.7);
      shard([60, 30], [72, 22], tips[0]);
      shard([72, 27], [82, 36], tips[1]);
      shard([80, 42], [86, 56], tips[2]);
    }, 54, -26, 70, 92));
    // Schwanzsplitter und schwebende Splitter unten
    shard([60, 90], [72, 82], [102, 108 + bob(3)]);
    for (const [x, y, s, a, k] of [[44, 101, 4.5, 0.5, 0], [60, 110, 5.5, -0.15, 1]]) {
      const yy = y + Math.sin(t * 0.04 + k * 2.2) * 2, an = a + Math.sin(t * 0.025 + k) * 0.25;
      const pts = [[0, -s * 1.7], [s * 0.75, 0], [0, s * 1.7], [-s * 0.75, 0]].map(p => turn([x + p[0], yy + p[1]], x, yy, an));
      shard(pts[1], pts[3], pts[0]);
      shard(pts[3], pts[1], pts[2]);
    }

    cached('prism', P, () => {
      // Körper: geschliffener Edelstein, leicht flieder getönt, damit der Kopf davor hervortritt
      const body = [[46, 28], [62, 15], [80, 24], [90, 48], [83, 80], [64, 100], [48, 86], [40, 62]];
      ctx.save();
      ctx.translate(1.5, 2.2);
      poly(body, dark);
      ctx.restore();
      cutGem(body, c, 0.5, mix(P.main, P.far, 0.3));
      // Prismenstreifen über den Lichtflächen
      ctx.save();
      poly(body);
      ctx.clip();
      line(42, 50, 58, 20, rgba(P.cream, 0.5), 1.1);
      line(45, 53, 61, 23, rgba(P.accLight, 0.55), 1.1);
      line(48, 56, 64, 26, rgba(P.mainLight, 0.45), 1.1);
      ctx.restore();
      stroke([[40, 62], [46, 28], [62, 15], [80, 24]], rgba(P.cream, 0.85), 1.1);
      stroke([[90, 48], [83, 80], [64, 100]], rgba(dark, 0.6), 1);
      // Kern in der Tafel
      glow(c[0], c[1], 20, P.accLight, 0.4);
      fanGem([[55, 57], [60, 46], [69, 47], [73, 57], [68, 67], [59, 66]], [64, 56.5], P.acc);
      circle(61.4, 51.6, 1.5, rgba(P.cream, 0.9));
      // Wangensplitter, Schädel, Hörner, Brauensplitter und Auge
      shard([38, 55], [46, 52], [58, 68]);
      const skull = [[1, 45.5], [8, 37], [20, 30], [33, 26], [45, 30], [50, 40], [44, 49.5], [24, 48.8]];
      fanGem(skull, [27, 39]);
      stroke([[1, 45.5], [8, 37], [20, 30], [33, 26], [45, 30]], rgba(P.cream, 0.9), 1.1);
      shard([30, 28], [40, 28.5], [54, 2]);
      shard([40, 30], [48, 37], [68, 16]);
      shard([16, 34], [30, 30.5], [44, 21]);
      glow(27, 36.8, 9, P.acc, 0.55);
      poly([[20.5, 38], [27.5, 34.2], [33.5, 36.2], [27, 40]], P.accLight);
      poly([[24, 37.6], [27.6, 35.8], [30.8, 36.8], [27.2, 38.6]], P.cream);
    });

    // Kern pulsiert
    glow(c[0], c[1], 20 + ew * 10, P.accLight, 0.15 * (0.5 + 0.5 * Math.sin(t * 0.05)) + 0.4 * ew);
    if (ew > 0) circle(61.4, 51.6, 1.5 + ew, rgba(P.cream, 0.9));
    // Unterkiefer klappt bei der Vorwarnung auf, im Maul wächst ein Splitter
    const hx = 44, hy = 50.5, ja = -0.32 * ew;
    if (ew > 0.01) {
      const up = [[2, 47], [24, 49], [44, 50.5]];
      const low = up.map(p => turn(p, hx, hy, ja)).reverse();
      poly(up.concat(low), mix(P.near, P.ink, 0.4));
      glow(8, 49.5, 5 + ew * 11, P.accLight, ew * 0.85);
      const s = 1.5 + ew * 4.5;
      shard([10, 49 - s * 0.6], [10, 49 + s * 0.6], [10 - s * 1.3, 49]);
      shard([10, 49 + s * 0.6], [10, 49 - s * 0.6], [10 + s * 1.3, 49]);
    }
    pivot(hx, hy, ja, () => {
      fanGem([[2, 47.5], [24, 49.2], [44, 50.5], [47, 55], [36, 60.5], [18, 58.5], [7, 53.5]], [26, 54]);
      stroke([[7, 53.5], [18, 58.5], [36, 60.5]], rgba(dark, 0.5), 0.9);
    });
    // Fangzähne
    for (const x of [9, 15, 21]) poly([[x - 1.5, 48.2], [x + 1.6, 48.6], [x + 0.2, 52.2]], mix(P.main, P.cream, 0.75));
    if (ew > 0) glow(27, 36.8, 9 + ew * 7, P.acc, 0.35 * ew);
    // Funkeln
    sparkle(54, 2, 2.6 * Math.max(0, Math.sin(t * 0.04)), P.cream);
    const wt = turn([94, -18], 70, 34, wingA);
    sparkle(wt[0], wt[1], 2.8 * Math.max(0, Math.sin(t * 0.04 + 2.5)), P.cream);
    sparkle(62, 15, 2.2 * Math.max(0, Math.sin(t * 0.04 + 4.4)), P.cream);
  };

  // ---------------------------------------------------------
  // 12 Wolkenwal: pausbäckiger Wal, der Rücken aus Wolkenballen
  // ---------------------------------------------------------
  ART2.boss.whale = (P, t, w) => {
    const ew = smooth01(w);
    const top = mix(P.main, P.cream, 0.6), mid = mix(P.main, P.cream, 0.32), low = P.main;
    const fill = () => vgrad(16, 100, [[0, top], [0.45, mid], [1, low]]);
    const sw = Math.sin(t * 0.04);
    const ex = 32, ey = 49;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(3, 52);
      ctx.bezierCurveTo(0, 30, 16, 17, 38, 17);
      ctx.bezierCurveTo(60, 17, 76, 27, 84, 40);
      ctx.bezierCurveTo(88, 44, 91, 42, 94, 35);
      ctx.lineTo(98, 41);
      ctx.bezierCurveTo(96, 58, 90, 76, 74, 88);
      ctx.bezierCurveTo(60, 98, 40, 102, 26, 96);
      ctx.bezierCurveTo(10, 90, 4, 72, 3, 52);
      ctx.closePath();
    };
    ctx.lineCap = 'round';

    // Wolkenfäden unter dem Bauch, je Reihe in einem Zug
    for (let j = 0; j < 4; j++) {
      const r = 4.8 - j * 1, row = [];
      for (let k = 0; k < 3; k++) row.push([32 + k * 17 + Math.sin(t * 0.03 + k * 1.7) * 2 * j / 3, 98 - k * 4 + j * 4.6, r]);
      dots(row.map(([x, y]) => [x + 0.6, y + 0.8, r]), rgba(P.mainSide, 0.75 - j * 0.15));
      dots(row, rgba(mid, 0.95 - j * 0.16));
      dots(row.map(([x, y]) => [x - r * 0.3, y - r * 0.3, r * 0.45]), rgba(P.cream, 0.55 - j * 0.1));
    }
    // Schwanzflosse
    pivot(92, 38, sw * 0.07 - ew * 0.12, () => {
      const fluke = () => {
        ctx.beginPath();
        ctx.moveTo(92, 37);
        ctx.bezierCurveTo(96, 26, 103, 16, 113, 10);
        ctx.bezierCurveTo(113, 20, 109, 30, 102, 36);
        ctx.bezierCurveTo(109, 36, 115, 40, 119, 47);
        ctx.bezierCurveTo(110, 48, 101, 45, 95, 41);
        ctx.closePath();
      };
      layered(fluke, P.mainSide, mid, 1.2, 1.8);
      ctx.strokeStyle = rgba(P.mainDark, 0.35);
      ctx.lineWidth = 1;
      fluke();
      ctx.stroke();
      stroke([[97, 34], [104, 22], [111, 13]], rgba(P.cream, 0.5), 1);
    });

    cached('whale', P, () => {
      // Rücken aus Wolkenballen: Körper und Ballen bilden eine gemeinsame Form
      const puffs = [[15, 31, 7], [24, 23, 8.5], [36, 19, 9], [49, 19, 8.5], [61, 22, 8], [71, 28, 7], [80, 35, 5.5]];
      const shape = () => {
        body();
        for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
      };
      ctx.save();
      ctx.translate(1.5, 2.2);
      shape();
      ctx.fillStyle = P.mainSide;
      ctx.fill();
      ctx.restore();
      // Kontur zuerst, Füllung darüber: so bleibt nur der Außenrand sichtbar
      shape();
      ctx.strokeStyle = rgba(P.mainDark, 0.42);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = fill();
      ctx.fill();
      ctx.save();
      shape();
      ctx.clip();
      ctx.fillStyle = hgrad(60, 98, [[0, rgba(P.mainSide, 0)], [1, rgba(P.mainSide, 0.45)]]);
      ctx.fillRect(60, 10, 40, 94);
      ellipses(puffs.map(([x, y, r]) => [x - r * 0.25, y - r * 0.3, r * 0.55, r * 0.38, -0.4]), rgba(P.cream, 0.32));
      ctx.restore();
      ctx.strokeStyle = rgba(P.cream, 0.75);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [x, y, r] of puffs) {
        const a0 = Math.PI * 1.12, a1 = Math.PI * 1.5, rr = r - 1.5;
        ctx.moveTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
        ctx.arc(x, y, rr, a0, a1);
      }
      ctx.stroke();
      // Blasloch und Auge
      ellipse(46, 11.5, 2.6, 1, 0, rgba(P.mainDark, 0.5));
      ellipse(ex + 0.4, ey + 0.6, 4.8, 4.4, 0, rgba(P.mainDark, 0.3));
      ellipse(ex, ey, 4.5, 4.2, 0, P.cream);
      circle(ex - 1.1, ey + 0.5, 2.7, P.ink);
      circle(ex - 2, ey - 0.5, 0.95, P.cream);
    });

    // Wolkenfontäne aus dem Blasloch
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.007 + k * 0.25) % 1, a = Math.sin(p * Math.PI) * (0.75 + 0.25 * ew);
      const px = 46 - p * 7 + Math.sin(p * 5 + k) * 2, py = 9 - p * 24, r = 2 + p * 5 + ew * 1.5;
      circle(px, py, r, rgba(top, a));
      circle(px - r * 0.3, py - r * 0.3, r * 0.45, rgba(P.cream, a * 0.8));
    }

    // Maul mit Kehlfurchen: der Unterkiefer klappt auf, innen leuchtet es
    const hx = 38, hy = 61, ja = -0.28 * ew;
    if (ew > 0.01) {
      const up = [[3, 50.5], [12, 53.5], [22, 56.5], [30, 58.8], [38, 61]];
      const lowp = up.map(p => turn(p, hx, hy, ja)).reverse();
      poly(up.concat(lowp), mix(P.mainDark, P.far, 0.3));
      glow(8, 53, 5 + ew * 12, P.accLight, ew * 0.9);
      dots([[10, 54 + ew * 2, 1.5 + ew * 2], [16, 56 + ew * 2.5, 1.2 + ew * 1.5]], rgba(P.cream, ew * 0.9));
    }
    pivot(hx, hy, ja, () => {
      ctx.beginPath();
      ctx.moveTo(3, 50.5);
      ctx.quadraticCurveTo(18, 55, 38, 61);
      ctx.lineTo(37, 76);
      ctx.bezierCurveTo(26, 84, 10, 78, 4.5, 64);
      ctx.closePath();
      ctx.fillStyle = fill();
      ctx.fill();
      ctx.save();
      body();
      ctx.clip();
      strokes([0, 1, 2, 3].map(k => [[10 + k * 2, 66 + k * 5.5], [28, 80 + k * 4], [46 + k * 2, 86 + k * 2.5]]), rgba(P.mainSide, 0.6), 1.1);
      ctx.restore();
    });
    strokes([[[3, 50.5], [18, 55], [38, 61]], [[38, 61], [40.5, 62], [41, 64.5]]], rgba(P.mainDark, 0.65), 1.5);

    // Brustflosse
    pivot(46, 84, 0.55 + sw * 0.15, () => {
      ellipse(55, 85, 12, 4.8, 0, P.mainSide);
      ellipse(54, 84, 11, 4, 0, mid);
      ellipse(61, 84.4, 4, 2.8, 0, rgba(P.acc, 0.45));
    });

    // Wangen blähen sich bei der Vorwarnung, schweres Lid über dem Auge
    ellipse(25, 62, 5.5 + ew * 1.5, 3 + ew, -0.2, rgba(P.acc, 0.42 + ew * 0.2));
    const blink = blinkAt(t, 260, 14) * (1 - Math.min(1, ew * 3));
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, 4.7, 4.4, 0, 0, TAU);
    ctx.clip();
    const lidY = ey - 6.2 + blink * 6 - ew * 1.2;
    ellipse(ex, lidY, 6, 4.6, -0.3, mid);
    ctx.strokeStyle = rgba(P.mainDark, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ex, lidY, 6, 4.6, -0.3, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  };

  // ---------------------------------------------------------
  // 13 Uhrwerkeule: Messingeule mit Linsenaugen, Zahnrädern, Nieten und Aufziehschlüssel
  // ---------------------------------------------------------
  ART2.boss.owl = (P, t, w) => {
    const ew = smooth01(w);
    const brass = P.main, brassSide = P.mainSide, brassLight = P.mainLight, brassDark = P.mainDark;
    const copper = P.acc, copperSide = P.accSide, copperLight = mix(P.acc, P.cream, 0.32);
    const glass = mix(P.ink, P.near, 0.45), lens = mix(P.accLight, P.cream, 0.45);
    const plate = mix(brass, P.cream, 0.26);
    const flap = Math.sin(t * 0.05);
    const spin = t * 0.025 + TAU * ew * ew;
    const eyes = [[13.5, 34, 6.6], [30, 34.5, 9.2]];
    const pcx = 42, pcy = 71;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Zahnrad oben im Kopf (halb verdeckt)
    gearPathSmall(37, 9, 8, 10, spin * 0.5, 2);
    ctx.fillStyle = brassSide;
    ctx.fill();
    circle(37, 9, 2.4, brassDark);

    // Aufziehschlüssel am Rücken: der Griff dreht sich um die Schaftachse
    const ka = t * 0.03 + TAU * ew * ew, sy = Math.cos(ka), ay = Math.max(0.12, Math.abs(sy));
    ctx.fillStyle = brassSide;
    ctx.fillRect(80, 54.2, 14, 4.2);
    ctx.fillStyle = brassLight;
    ctx.fillRect(80, 54.2, 14, 1.3);
    for (const sg of [-1, 1]) {
      const ly = 56.3 + sg * 6.2 * ay;
      ellipse(99.5, ly + 0.6, 5.4, 5.6 * ay, 0, copperSide);
      ellipse(99, ly, 5.2, 5.4 * ay, 0, sy > 0 ? copper : mix(copper, copperSide, 0.6));
      ellipse(99.6, ly, 2, 2.2 * ay, 0, brassDark);
    }
    roundRectPath(94.5, 53.4, 7, 5.8, 2);
    ctx.fillStyle = brass;
    ctx.fill();
    ctx.fillStyle = brassLight;
    ctx.fillRect(95.5, 54, 5, 1.2);

    cached('owl', P, () => {
      // Schwanzfedern unten rechts, halb unter der Flügelspitze
      for (let k = 0; k < 3; k++) {
        pivot(70, 94, 0.55 + k * 0.3, () => {
          roundRectPath(70, 91, 17, 6, 3);
          ctx.fillStyle = k % 2 ? P.accDark : mix(brassSide, brassDark, 0.5);
          ctx.fill();
        });
      }
      // Körper und Kopf als eine Form
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(8, 46);
        ctx.bezierCurveTo(1, 30, 8, 11, 28, 9);
        ctx.bezierCurveTo(46, 7, 61, 13, 63, 29);
        ctx.bezierCurveTo(78, 38, 87, 60, 85, 80);
        ctx.bezierCurveTo(83, 96, 70, 105, 54, 105);
        ctx.bezierCurveTo(38, 105, 26, 97, 23, 82);
        ctx.bezierCurveTo(21, 68, 14, 58, 8, 46);
        ctx.closePath();
      };
      layered(body, brassSide, brass, 1.6, 2);
      ctx.save();
      body();
      ctx.clip();
      ctx.fillStyle = hgrad(58, 88, [[0, rgba(brassDark, 0)], [1, rgba(brassDark, 0.45)]]);
      ctx.fillRect(58, 0, 32, 110);
      // Brustschuppen, Ton in Ton: je Farbe ein Füllzug, alle Kanten in einem Strich
      const scales = [[], []];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) scales[(r + c) % 2].push([24 + c * 8 + (r % 2) * 4, 82 + r * 6]);
      scales.forEach((list, i) => {
        ctx.beginPath();
        for (const [x, y] of list) { ctx.moveTo(x + 4.4, y); ctx.arc(x, y, 4.4, 0, Math.PI); ctx.closePath(); }
        ctx.fillStyle = i ? mix(brass, brassLight, 0.55) : mix(brass, copper, 0.22);
        ctx.fill();
      });
      ctx.beginPath();
      for (const [x, y] of scales[0].concat(scales[1])) { ctx.moveTo(x + 4.4, y); ctx.arc(x, y, 4.4, 0, Math.PI); ctx.closePath(); }
      ctx.strokeStyle = rgba(brassDark, 0.38);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ellipse(22, 16, 13, 5, -0.35, rgba(P.cream, 0.22));
      ctx.restore();
      // Kopfnaht mit Nieten
      ctx.strokeStyle = rgba(brassDark, 0.5);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(44, 54);
      ctx.bezierCurveTo(56, 50, 62, 40, 62, 30);
      ctx.stroke();
      dots([[16, 15.5, 0.8], [26, 12, 0.8], [47, 13.5, 0.8], [56, 19, 0.8], [53, 51.6, 0.8], [59.4, 44, 0.8]], brassLight);
      // Bullauge: Rahmen und Glas
      circle(pcx + 0.8, pcy + 1, 10.5, copperSide);
      circle(pcx, pcy, 10.5, copper);
      circle(pcx, pcy, 8.2, brassDark);
      circle(pcx, pcy, 7.5, glass);
      // Krallen
      ctx.fillStyle = brassSide;
      for (const fx of [40, 54]) ctx.fillRect(fx - 2, 100, 4, 5);
      strokes([40, 54].flatMap(fx => [[[fx, 104], [fx - 3.5, 106], [fx - 5, 109]], [[fx, 104], [fx, 107], [fx - 1, 110]], [[fx, 104], [fx + 3.5, 106], [fx + 4, 109]]]), mix(brassDark, P.ink, 0.3), 1.6);
      // Ohrbüschel
      poly([[8, 20], [6, 0], [14, 14]], copper);
      poly([[14, 14], [6, 0], [21, 12]], copperSide);
      poly([[41, 13], [52, -6], [48, 16]], copper);
      poly([[48, 16], [52, -6], [56, 19]], copperSide);
      // Gesichtsschleier: zwei Scheiben, die nähere größer
      ellipse(13.5, 36.5, 10, 15, 0.05, copper);
      ellipse(30.5, 37.5, 14.5, 17.5, 0, copper);
      ellipse(13.8, 36.5, 8.6, 13.6, 0.05, plate);
      ellipse(30.5, 37.5, 13, 16, 0, plate);
      const rivets = [];
      for (let k = 0; k < 7; k++) { const a = -0.3 + k * 0.42; rivets.push([30.5 + Math.cos(a) * 13.8, 37.5 + Math.sin(a) * 16.7, 0.7]); }
      dots(rivets, copperLight);
      // Linsenaugen
      for (const [x, y, r] of eyes) {
        circle(x + 0.6, y + 0.8, r, copperSide);
        circle(x, y, r, copper);
        circle(x, y, r * 0.82, brassDark);
        circle(x, y, r * 0.72, glass);
        glow(x, y, r * 1.8, P.accLight, 0.25);
        circle(x, y, r * 0.34, lens);
        circle(x, y, r * 0.15, P.cream);
        ctx.strokeStyle = rgba(P.cream, 0.55);
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.55, Math.PI * 1.1, Math.PI * 1.45);
        ctx.stroke();
        const rv = [];
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.5; rv.push([x + Math.cos(a) * r * 0.91, y + Math.sin(a) * r * 0.91, r * 0.075]); }
        dots(rv, brassLight);
      }
      // Brauen
      poly([[20, 27.5], [41, 21.5], [42, 24.5], [22, 30]], copperSide);
      poly([[4, 25], [16, 28.5], [15, 31], [4, 28]], copperSide);
    });

    // Zahnräder im Bullauge
    gearPathSmall(pcx - 1, pcy - 0.5, 6.2, 9, spin, 1.7);
    ctx.fillStyle = brass;
    ctx.fill();
    circle(pcx - 1, pcy - 0.5, 2.8, brassSide);
    circle(pcx - 1, pcy - 0.5, 1.1, brassDark);
    ctx.save();
    ctx.beginPath();
    ctx.arc(pcx, pcy, 7.5, 0, TAU);
    ctx.clip();
    gearPathSmall(pcx + 6, pcy + 5, 4.2, 8, -spin * 1.48 + 0.2, 1.3);
    ctx.fillStyle = copperSide;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(P.cream, 0.45);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 5.6, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    const prv = [];
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; prv.push([pcx + Math.cos(a) * 9.4, pcy + Math.sin(a) * 9.4, 0.75]); }
    dots(prv, brassLight);

    // Flügel, angelegt, aus Blechfedern (Sprite unter leichter Drehung), Schultergelenk dreht sich
    pivot(60, 40, flap * 0.04 - ew * 0.08, () => {
      cached('owl:wing', P, () => {
        const wing = () => {
          ctx.beginPath();
          ctx.moveTo(57, 36);
          ctx.bezierCurveTo(74, 36, 88, 56, 90, 80);
          ctx.bezierCurveTo(91, 92, 88, 101, 84, 108);
          ctx.bezierCurveTo(76, 98, 64, 84, 58, 68);
          ctx.bezierCurveTo(54, 56, 52, 44, 57, 36);
          ctx.closePath();
        };
        layered(wing, copperSide, copper, 1.4, 1.8);
        ctx.save();
        wing();
        ctx.clip();
        // Federreihen: Deckfedern oben, lange Schwungfedern unten
        ctx.strokeStyle = rgba(brassDark, 0.55);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const y0 = 52 + k * 7;
          ctx.moveTo(55, y0 + 4);
          for (let x = 58; x <= 92; x += 7) ctx.quadraticCurveTo(x - 3.5, y0 + 7 + (x - 58) * 0.3, x, y0 + (x - 58) * 0.3);
        }
        for (let k = 0; k < 4; k++) { ctx.moveTo(64 + k * 6, 74 + k * 2); ctx.quadraticCurveTo(76 + k * 3, 92, 82 + k * 1.5, 106); }
        ctx.stroke();
        ctx.fillStyle = rgba(copperLight, 0.35);
        ctx.fillRect(56, 34, 40, 6);
        ctx.fillStyle = hgrad(70, 92, [[0, rgba(P.accDark, 0)], [1, rgba(P.accDark, 0.4)]]);
        ctx.fillRect(70, 30, 24, 80);
        ctx.restore();
        dots([[62, 39.5, 0.8], [69, 41.5, 0.8], [76, 46, 0.8], [82, 53, 0.8]], copperLight);
      }, 50, 30, 46, 82);
      gearPathSmall(60, 42, 5.5, 8, -spin * 0.8, 1.5);
      ctx.fillStyle = brassLight;
      ctx.fill();
      circle(60, 42, 2, brassDark);
    });

    // Linsenaugen glühen bei der Vorwarnung auf
    if (ew > 0) for (const [x, y, r] of eyes) { glow(x, y, r * 1.8, P.accLight, 0.4 * ew); circle(x, y, r * 0.2, rgba(P.cream, ew)); }
    // Schnabel: Unterschnabel klappt auf
    pivot(16, 47, -0.45 * ew, () => poly([[17, 46], [7.5, 50], [13.5, 52.5]], mix(brassDark, P.ink, 0.3)));
    if (ew > 0.01) {
      glow(9, 49.5, 4 + ew * 10, P.accLight, ew * 0.85);
      circle(8.5, 49.4, 1 + ew * 1.8, rgba(P.cream, ew));
    }
    ctx.beginPath();
    ctx.moveTo(17, 38.5);
    ctx.quadraticCurveTo(24, 40.5, 21, 46);
    ctx.quadraticCurveTo(15, 50, 5, 49.5);
    ctx.quadraticCurveTo(7, 42, 17, 38.5);
    ctx.closePath();
    ctx.fillStyle = mix(brassDark, copper, 0.25);
    ctx.fill();
    stroke([[15.5, 40], [9, 42.5], [6.5, 47.5]], rgba(P.cream, 0.4), 0.9);
  };

  // ---------------------------------------------------------
  // 14 Aschephönix: verkohlter Feuervogel mit glühenden Rissen und Flammenfedern
  // ---------------------------------------------------------
  ART2.boss.phoenix = (P, t, w) => {
    const ew = smooth01(w);
    const coal = P.main, coalSide = P.mainSide, coalDark = P.mainDark, ash = mix(P.mainLight, P.cream, 0.2);
    const ember = P.acc, hot = P.accLight, white = mix(P.accLight, P.cream, 0.6);
    const beat = Math.sin(t * 0.05);
    const heat = 0.75 + 0.25 * Math.sin(t * 0.045) + 0.35 * ew, h1 = Math.min(1, heat);
    const featherFill = (x0, y0, x1, y1, dim) => lgrad(x0, y0, x1, y1, dim
      ? [[0, coalDark], [0.6, coalDark], [0.88, P.accDark], [1, P.accSide]]
      : [[0, coalDark], [0.45, coalSide], [0.72, coal], [0.9, P.accSide], [1, hot]]);
    const sources = [];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Kleine Flammenzunge, zeigt immer nach oben
    const flame = (x, y, s, k, dim) => {
      const sw = Math.sin(t * 0.09 + k * 1.7) * s * 0.35, hg = s * (1.9 + 0.25 * Math.sin(t * 0.07 + k * 2.3));
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y);
      ctx.quadraticCurveTo(x - s * 0.6, y - hg * 0.5, x + sw, y - hg);
      ctx.quadraticCurveTo(x + s * 0.6, y - hg * 0.5, x + s * 0.55, y);
      ctx.arc(x, y, s * 0.55, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = lgrad(x, y + s * 0.55, x, y - hg, [[0, dim ? ember : hot], [0.45, rgba(ember, 0.9)], [1, rgba(ember, 0)]]);
      ctx.fill();
      if (!dim) circle(x, y + s * 0.1, s * 0.28, rgba(P.cream, 0.75));
    };
    // Feder mit Glutrand; Deckfedern (cover) bleiben dunkel, hintere Federn (dim) ohne Rand
    const feather = (x0, y0, cx, cy, x1, y1, wMax, dim, cover) => {
      ribbonPath(x0, y0, cx, cy, x1, y1, wMax, 2, cover ? 1.2 : 1.6, 8);
      ctx.fillStyle = cover ? lgrad(x0, y0, x1, y1, [[0, coalSide], [0.7, coal], [1, mix(coal, ash, 0.5)]]) : featherFill(x0, y0, x1, y1, dim);
      ctx.fill();
      if (!cover && !dim) {
        ctx.strokeStyle = rgba(ember, 0.75);
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
    };
    // Punkt auf einem Linienzug bei Anteil f
    const along = (pts, f) => {
      const seg = [];
      let tot = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
      let d = f * tot;
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) { const u = Math.min(1, d / seg[i]); return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; }
        d -= seg[i];
      }
      return pts[pts.length - 1];
    };
    // Flügel: Federn hängen entlang des Arms, die Handschwingen an der Spitze sind am längsten.
    // Mit draw = false werden nur die Federspitzen berechnet (für Flammen auf dem zwischengespeicherten Flügel).
    const wing = (arm, n, L0, L1, d0, d1, wMax, dim, draw) => {
      const tips = [];
      for (let k = n - 1; k >= 0; k--) {
        const f = k / (n - 1), [ax, ay] = along(arm, f), d = lerp(d0, d1, f), L = lerp(L0, L1, f * f);
        const x1 = ax + Math.cos(d) * L, y1 = ay + Math.sin(d) * L;
        if (draw) feather(ax, ay, ax + Math.cos(d - 0.18) * L * 0.5, ay + Math.sin(d - 0.18) * L * 0.5, x1, y1, wMax, dim);
        tips[k] = [x1, y1];
      }
      return tips;
    };
    const farArm = [[56, 50], [59, 30], [61, 10], [62, -6]], nearArm = [[50, 56], [58, 34], [69, 14], [80, -2]];
    const FAR = [farArm, 6, 18, 32, 0.25, -0.75, 6, true], NEAR = [nearArm, 8, 22, 40, 0.5, -0.4, 7.4, false];

    // Glutschein hinter dem Vogel, damit er sich vom dunklen Himmel löst
    glow(56, 50, 56, P.acc, 0.36 + 0.15 * ew);

    // hinterer Flügel steil nach oben, dunkler
    const fa = -beat * 0.05 - ew * 0.1;
    pivot(56, 50, fa, () => {
      cached('phoenix:far', P, () => {
        wing(...FAR, true);
        ribbonPath(54, 54, 60, 20, 62, -6, 3.6, 3.4, 0.85);
        ctx.fillStyle = lgrad(54, 20, 64, 26, [[0, coalSide], [1, coalDark]]);
        ctx.fill();
      }, 40, -34, 56, 100);
      const tips = wing(...FAR, false);
      for (const k of [5, 3]) flame(tips[k][0], tips[k][1], 2.6, k + 20, true);
    });

    cached('phoenix', P, () => {
      // Schwanzfedern mit glühenden Augen
      [[66, 78, 82, 90, 104, 104], [62, 80, 70, 100, 86, 122], [70, 74, 92, 78, 116, 86], [64, 80, 78, 98, 98, 118]].forEach(([x0, y0, cx, cy, x1, y1], k) => {
        ribbonPath(x0, y0, cx, cy, x1, y1, 5.6 - k * 0.5, 2, 1.25, 8);
        ctx.fillStyle = featherFill(x0, y0, x1, y1, k === 3);
        ctx.fill();
        ctx.strokeStyle = rgba(ember, 0.5);
        ctx.lineWidth = 0.7;
        ctx.stroke();
        const ex = lerp(cx, x1, 0.7), ey = lerp(cy, y1, 0.7);
        glow(ex, ey, 6, ember, 0.4);
        circle(ex, ey, 1.8, hot);
      });
      // Körper und Hals mit glühendem Randlicht (Kontur zuerst, Füllung darüber)
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(14, 45);
        ctx.bezierCurveTo(20, 51, 24, 58, 29, 64);
        ctx.bezierCurveTo(34, 78, 50, 88, 66, 85);
        ctx.bezierCurveTo(78, 82, 76, 64, 62, 55);
        ctx.bezierCurveTo(50, 48, 40, 40, 32, 30);
        ctx.lineTo(22, 30);
        ctx.closePath();
      };
      const head = () => { ctx.beginPath(); ctx.arc(20, 37, 9, 0, TAU); };
      ctx.strokeStyle = rgba(ember, 0.5);
      ctx.lineWidth = 2.4;
      for (const fn of [body, head]) {
        for (const [dx, dy] of [[0, 0], [1.5, 2]]) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); ctx.stroke(); }
      }
      layered(body, coalDark, coal, 1.5, 2);
      ctx.save();
      body();
      ctx.clip();
      ctx.fillStyle = lgrad(20, 30, 50, 70, [[0, rgba(ash, 0.4)], [0.5, rgba(ash, 0.08)], [1, rgba(ash, 0)]]);
      ctx.fillRect(10, 24, 70, 66);
      ctx.fillStyle = hgrad(54, 78, [[0, rgba(coalDark, 0)], [1, rgba(coalDark, 0.6)]]);
      ctx.fillRect(54, 40, 26, 50);
      glow(40, 64, 20, ember, 0.2);
      // Brustgefieder als Schuppenreihen
      ctx.strokeStyle = rgba(ash, 0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const x = 26 + c * 7 + r * 5, y = 52 + r * 7 + c * 1.5;
        ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x, y + 3.5, x + 3, y);
      }
      ctx.stroke();
      ctx.restore();
      strokes([[[48, 84], [46, 89], [43, 91]], [[48, 84], [49, 90], [47, 93]], [[56, 85], [55, 90], [52, 93]]], coalDark, 1.6);
    });
    // brennende Spitzen der Schwanzfedern
    [[104, 104], [86, 122], [116, 86]].forEach(([x, y], k) => { flame(x, y, 2.4, k + 10, false); sources.push([x, y - 4]); });

    // Kamm aus langen, nach hinten wehenden Flammenfedern
    [[24, 33, 38, 30, 54, 34], [22, 31, 34, 20, 52, 18], [20, 30, 26, 16, 42, 6]].forEach(([x0, y0, cx, cy, x1, y1], k) => {
      const f = Math.sin(t * 0.06 + k * 2) * 1.6;
      ribbonPath(x0, y0, cx, cy, x1 + f * 0.5, y1 - f, 3.4 - k * 0.2, 1.6, 1.15, 9);
      ctx.fillStyle = featherFill(x0, y0, x1, y1, false);
      ctx.fill();
      ctx.strokeStyle = rgba(ember, 0.6 * h1);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // vorderer Flügel schräg nach oben, mit Deckfedern, glühender Vorderkante und brennenden Spitzen
    const na = -beat * 0.08 - ew * 0.14;
    pivot(52, 56, na, () => {
      cached('phoenix:near', P, () => {
        wing(...NEAR, true);
        for (let k = 4; k >= 0; k--) {
          const f = k / 5, [bx, by] = along(nearArm, f * 0.85), a = lerp(0.55, -0.3, f), L = 17 - k * 0.9;
          feather(bx, by, bx + Math.cos(a - 0.3) * L * 0.5, by + Math.sin(a - 0.3) * L * 0.5, bx + Math.cos(a) * L, by + Math.sin(a) * L, 5.4, false, true);
        }
        ribbonPath(47, 61, 58, 30, 80, -2, 4.8, 4.2, 0.85);
        ctx.fillStyle = lgrad(56, 26, 66, 34, [[0, ash], [0.45, coal], [1, coalSide]]);
        ctx.fill();
      }, 38, -34, 88, 112);
      const crack = [[50, 55], [55, 42], [61, 29], [70, 15], [78, 3]];
      stroke(crack, rgba(ember, 0.4 * heat), 2.6);
      stroke(crack, rgba(hot, h1 * 0.9), 0.9);
      const tips = wing(...NEAR, false);
      for (const k of [7, 6, 5, 4]) {
        flame(tips[k][0], tips[k][1], 2.6 + (k - 4) * 0.45, k, false);
        sources.push(turn([tips[k][0], tips[k][1] - 4], 52, 56, na));
      }
    });

    // glühende Risse am Körper
    const cracks = [[[30, 56], [35, 60], [33, 66], [39, 71]], [[48, 56], [53, 62], [51, 68], [56, 72]], [[60, 74], [66, 78]], [[24, 40], [28, 46], [26, 50]]];
    strokes(cracks, rgba(ember, 0.35 * heat), 2.8);
    strokes(cracks, rgba(hot, Math.min(1, 0.85 * heat)), 0.9);

    // Kopf
    layered(() => { ctx.beginPath(); ctx.arc(20, 37, 9, 0, TAU); }, coalDark, coal, 1, 1.4);
    ellipse(17, 32, 5, 2.4, -0.4, rgba(ash, 0.4));
    // Schnabel: Unterschnabel klappt auf, im Rachen glüht es
    pivot(14, 46, -0.42 * ew, () => poly([[14.5, 45.5], [5.5, 47.6], [13.5, 49.2]], coalDark));
    if (ew > 0.01) {
      glow(8, 48, 4 + ew * 11, hot, ew * 0.9);
      circle(7.5, 47.8, 1 + ew * 2, rgba(P.cream, ew));
    }
    ctx.beginPath();
    ctx.moveTo(14.5, 33.5);
    ctx.quadraticCurveTo(5, 34, 2.5, 46.5);
    ctx.quadraticCurveTo(6, 44.5, 14.5, 45.6);
    ctx.closePath();
    ctx.fillStyle = mix(coalDark, coal, 0.5);
    ctx.fill();
    line(12.5, 35, 4.5, 41, rgba(ash, 0.55), 0.8);
    stroke([[3, 46.2], [7, 45], [14, 45.6]], rgba(ember, 0.5 * heat), 0.8);
    // Auge
    glow(19.5, 36, 8 + ew * 4, ember, 0.5 + 0.35 * ew);
    ellipse(19.5, 36, 3.4, 2.1, -0.2, ember);
    ellipse(19.1, 35.8, 2.1, 1.25, -0.2, white);
    line(13.5, 32.6, 24.5, 31, coalDark, 1.8);

    // aufsteigende Glut von den brennenden Spitzen
    for (let k = 0; k < 9; k++) {
      const [bx, by] = sources[k % sources.length], p = (t * 0.01 + k * 0.111) % 1;
      const x = bx + Math.sin(k * 2.3 + p * 3) * 4, y = by - p * 24, a = Math.sin(p * Math.PI) * (0.8 + 0.2 * ew);
      circle(x, y, 1.3 * (1 - p) + 0.4, rgba(hot, a));
    }
  };
})();

