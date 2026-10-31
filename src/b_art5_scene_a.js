// ============================================================
// Kulissen, Teil A: Neon (Hauptbiom), Uhrwerk, Sturm, Asche, Höhle.
// Einzelmotive pro Spur (siehe b_scene.js). Die Abfolge entsteht in pick():
// ein kleiner Zustand pro Spurinstanz (Schlüssel ist deren rng) schätzt die
// Spur-x und wählt danach Stadtteil, Gebirgsabschnitt usw.
// Alles steckt in einer Funktion, damit keine Namen mit anderen Dateien kollidieren.
// ============================================================
(() => {
  // ---------- gemeinsame Werkzeuge ----------
  const R = (r, a, b) => a + r() * (b - a);
  const PK = (r, arr) => arr[Math.floor(r() * arr.length)];
  const BASE = GROUND_Y + 4;
  function rects(list, col) {
    if (!list.length) return;
    ctx.beginPath();
    for (const q of list) ctx.rect(q[0], q[1], q[2], q[3]);
    ctx.fillStyle = col;
    ctx.fill();
  }
  function path(pts, close) {
    ctx.beginPath();
    pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    if (close) ctx.closePath();
  }
  function stroke(pts, col, lw) {
    path(pts);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  function glow(x, y, rad, col, a) {
    ctx.fillStyle = rgrad(x, y, 0, rad, [[0, rgba(col, a)], [0.45, rgba(col, a * 0.35)], [1, rgba(col, 0)]]);
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // weicher, gestreckter Fleck (Dunst, Rauch)
  function soft(x, y, rx, ry, col, a) {
    if (a <= 0.002 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(col, a)], [0.5, rgba(col, a * 0.5)], [1, rgba(col, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  // Abfolge: Zustand je Spurinstanz. Vorschaubilder erzeugen eigene Instanzen und stören das Spiel nicht.
  const flowState = new WeakMap();
  function flow(rng, i, init) {
    let s = flowState.get(rng);
    if (!s || i === 0) { s = Object.assign({ x: 0, last: [], n: 0 }, init()); flowState.set(rng, s); }
    s.n = i;
    return s;
  }
  // Gewichtete Wahl, die letzten `avoid` Motive sind ausgeschlossen
  function choose(rng, weights, last, avoid) {
    const recent = avoid ? last.slice(-avoid) : [];
    let keys = Object.keys(weights).filter(k => weights[k] > 0 && !recent.includes(k));
    if (!keys.length) keys = Object.keys(weights).filter(k => weights[k] > 0);
    let tot = 0;
    for (const k of keys) tot += weights[k];
    let v = rng() * tot;
    for (const k of keys) { v -= weights[k]; if (v <= 0) return k; }
    return keys[keys.length - 1];
  }
  const remember = (s, k, keep) => { s.last.push(k); if (s.last.length > (keep || 8)) s.last.shift(); };

  // ============================================================
  // NEON: Nachtstadt. Ferne Skyline (ruhig, nah an den Himmelsfarben) und
  // mittlere Gebäude mit Fensterraster. Ablauf: Stadtrand, dichter und höher,
  // Innenstadt mit den höchsten Türmen und Fernsehturm, Hafen mit Hängebrücke,
  // danach wechselnde Viertel.
  // ============================================================
  const nPal = C => ({
    body: mix(C.far, C.near, 0.3),
    warm: mix(CREAM, '#ffcf7a', 0.55),
    cool: mix(C.pipe, CREAM, 0.45),
    pink: mix(C.accent, CREAM, 0.3),
    red: mix(C.accent, '#ff5040', 0.55),
    glass: mix(C.far, C.pipe, 0.16)
  });
  const nVary = (col, r, C) => mix(shade(col, R(r, -0.1, 0.07)), C.skyBottom, R(r, 0, 0.14));

  // Quader: Front mit Verlauf, rechte Seite im Schatten, Lichtkante oben und links
  function nBox(x, y, w, h, body, C, sf) {
    const sw = Math.max(2, Math.round(w * (sf === undefined ? 0.16 : sf))), fw = w - sw;
    ctx.fillStyle = vgrad(y, y + h, [[0, shade(body, 0.08)], [0.55, body], [1, mix(body, C.accent, 0.12)]]);
    ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = vgrad(y, y + h, [[0, shade(body, -0.26)], [1, shade(mix(body, C.accent, 0.1), -0.3)]]);
    ctx.fillRect(x + fw, y, sw, h);
    ctx.fillStyle = rgba(CREAM, 0.13);
    ctx.fillRect(x, y, fw, 1.2);
    ctx.fillStyle = rgba(C.pipe, 0.07);
    ctx.fillRect(x, y, 1, h);
    return fw;
  }

  // Fensterraster: dunkle Scheiben, einzelne beleuchtete Fenster, manche Etagen ganz hell oder dunkel
  function nWins(x0, x1, y0, y1, o, r, P) {
    o = Object.assign({ ww: 2.6, wh: 3.4, gx: 6, gy: 8, lit: 0.28, warm: 0.62, a: 0.7, offA: 0.06 }, o);
    const nx = Math.floor((x1 - x0 - o.ww) / o.gx) + 1;
    if (nx < 1 || y1 - y0 < o.wh) return;
    const ox = x0 + (x1 - x0 - ((nx - 1) * o.gx + o.ww)) / 2, colF = [];
    for (let c = 0; c < nx; c++) colF.push(r() < 0.18 ? 0.25 : 1);
    const off = [], warm = [], cool = [], pink = [];
    for (let y = y0; y + o.wh <= y1; y += o.gy) {
      const fl = r(), f = fl < 0.08 ? 2.4 : fl < 0.22 ? 0.2 : 1;
      for (let c = 0; c < nx; c++) {
        const q = [ox + c * o.gx, y, o.ww, o.wh];
        if (r() < o.lit * f * colF[c]) { const v = r(); (v < o.warm ? warm : v < 0.95 ? cool : pink).push(q); } else off.push(q);
      }
    }
    rects(off, rgba(o.offCol || CREAM, o.offA));
    rects(warm, rgba(P.warm, o.a));
    rects(cool, rgba(P.cool, o.a * 0.9));
    rects(pink, rgba(P.pink, o.a * 0.85));
  }

  // Erdgeschoss: dunkler Sockel mit Schaufenstern, Eingängen, gelegentlich ein farbiges Vordach
  function nShop(x0, x1, h, C, P, r) {
    const sh = 13, y = h - 4 - sh;
    rects([[x0, y - 1, x1 - x0, sh + 5]], rgba(INK, 0.3));
    const warm = [], cool = [], doors = [];
    let x = x0 + R(r, 2, 5);
    while (x < x1 - 9) {
      const ww = Math.min(x1 - 3 - x, R(r, 7, 18));
      if (ww < 5) break;
      if (r() < 0.2) doors.push([x, y + 4, 4, sh - 4]); else (r() < 0.6 ? warm : cool).push([x, y + 3, ww, sh - 5]);
      x += ww + R(r, 2.5, 6);
    }
    rects(warm, rgba(P.warm, 0.36));
    rects(cool, rgba(P.cool, 0.3));
    rects(doors, rgba(P.warm, 0.5));
    if (r() < 0.45) rects([[x0 + R(r, 0, (x1 - x0) * 0.4), y - 1, (x1 - x0) * R(r, 0.25, 0.55), 2]], rgba(r() < 0.5 ? C.accent : C.pipe, 0.42));
  }

  // Neonröhre: weicher Schein und dünner heller Kern (gedämpft, damit nichts mit den Rohren konkurriert)
  function nTube(pts, col, a) {
    ctx.lineCap = 'round';
    stroke(pts, rgba(col, a * 0.12), 6);
    stroke(pts, rgba(col, a * 0.3), 2.6);
    stroke(pts, rgba(mix(col, CREAM, 0.45), a), 1.1);
  }
  function nRed(x, y, P, s) {
    glow(x, y, 6 * (s || 1), P.red, 0.4);
    circle(x, y, 1.2 * (s || 1), mix(P.red, CREAM, 0.35));
  }
  // Leuchttafel ohne Schrift: Farbfeld mit abstrakten Formen
  function nPanel(x, y, w, h, C, r) {
    const c1 = r() < 0.5 ? C.accent : C.pipe, c2 = c1 === C.accent ? C.pipe : C.accent;
    ctx.fillStyle = rgba(c1, 0.07);
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = rgba(INK, 0.75);
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.clip();
    ctx.fillStyle = hgrad(x, x + w, [[0, rgba(c1, 0.42)], [1, rgba(mix(c1, c2, 0.6), 0.28)]]);
    ctx.fillRect(x, y, w, h);
    const v = r();
    if (v < 0.35) {
      circle(x + w * R(r, 0.25, 0.4), y + h * 0.55, h * R(r, 0.25, 0.38), rgba(mix(c2, CREAM, 0.3), 0.4));
      rects([[x + w * 0.55, y + h * 0.3, w * 0.32, h * 0.12], [x + w * 0.55, y + h * 0.55, w * 0.22, h * 0.1]], rgba(CREAM, 0.3));
    } else if (v < 0.7) {
      for (let k = -3; k < 8; k++) {
        const bx = x + k * w / 6;
        path([[bx, y + h], [bx + w / 12, y + h], [bx + w / 12 + h * 0.6, y], [bx + h * 0.6, y]], true);
        ctx.fillStyle = rgba(k % 2 ? c2 : CREAM, k % 2 ? 0.22 : 0.08);
        ctx.fill();
      }
    } else {
      ellipse(x + w * 0.5, y + h * 1.05, w * 0.42, h * 0.6, 0, rgba(mix(c2, CREAM, 0.2), 0.35));
      ellipse(x + w * 0.5, y + h * 1.05, w * 0.26, h * 0.36, 0, rgba(CREAM, 0.12));
    }
    ctx.restore();
    ctx.strokeStyle = rgba(mix(c1, CREAM, 0.35), 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // ---------- mittlere Gebäude (Archetypen) ----------
  // Wohnblock: Balkonbänder, warmes Licht, Treppenhaus, Dachaufbau
  function nWohn(w, h, r, C, P) {
    const roof = r() < 0.75, rt = roof ? 18 : 3, body = nVary(P.body, r, C), gy = 9;
    const fw = nBox(0, rt, w, h - rt, body, C, 0.13);
    const bands = [];
    for (let y = rt + 13; y < h - 20; y += gy) bands.push([1, y, fw - 2, 1.1]);
    rects(bands, rgba(CREAM, 0.05));
    rects([[0, rt + 3, fw, 1.4]], rgba(INK, 0.3));
    nWins(4, fw - 4, rt + 7, h - 22, { gx: 7, gy, ww: 3.2, wh: 4, lit: 0.32, warm: 0.8, a: 0.68 }, r, P);
    nShop(0, fw, h, C, P, r);
    if (r() < 0.7) {
      const sx = Math.round(fw * R(r, 0.3, 0.7)), list = [];
      ctx.fillStyle = rgba(INK, 0.3);
      ctx.fillRect(sx - 3, rt + 4, 6, h - rt - 4);
      for (let y = rt + 9; y < h - 22; y += gy) list.push([sx - 1.3, y, 2.6, 3]);
      rects(list, rgba(r() < 0.5 ? P.cool : P.warm, 0.5));
    }
    if (roof) {
      const bw = R(r, 12, 22), bx = R(r, 3, Math.max(4, fw - bw - 3));
      nBox(bx, rt - 9, bw, 9, shade(body, 0.05), C, 0.25);
      if (r() < 0.7) {
        const ax = R(r, 6, fw - 6), ah = 10 + r() * 8;
        line(ax, rt, ax, rt - ah, shade(body, 0.25), 1);
        segs([[ax - 4, rt - ah + 3, ax + 4, rt - ah + 3], [ax - 3, rt - ah + 6, ax + 3, rt - ah + 6]], shade(body, 0.2), 0.8);
      }
      if (r() < 0.5) {
        const dx = R(r, 4, fw - 10);
        ellipse(dx, rt - 4, 3.5, 2.2, -0.5, shade(body, 0.22));
        line(dx, rt - 2, dx + 1, rt, shade(body, 0.2), 1);
      }
    }
  }

  // Bürogebäude mit Glasfassade: Pfosten, Etagenlinien, ganze Etagen beleuchtet, Spiegelung
  function nBuero(w, h, r, C, P) {
    const crown = PK(r, ['flat', 'slant', 'slant', 'step', 'fin']);
    const sw = Math.max(3, Math.round(w * 0.15)), fw = w - sw, s = Math.min(34, w * 0.42);
    const top = crown === 'fin' ? 30 : crown === 'step' ? 16 : 3;
    let F, S;
    if (crown === 'slant') {
      const up = r() < 0.5;
      F = [[0, up ? top + s : top], [fw, up ? top : top + s], [fw, h], [0, h]];
      S = [[fw, up ? top : top + s], [w, (up ? top : top + s) + 3], [w, h], [fw, h]];
    } else {
      F = [[0, top], [fw, top], [fw, h], [0, h]];
      S = [[fw, top], [w, top + 2], [w, h], [fw, h]];
    }
    const g0 = mix(shade(P.glass, 0.04), C.skyBottom, 0.15), g1 = mix(C.near, C.accent, 0.1);
    poly(F, vgrad(top, h, [[0, g0], [0.6, mix(g0, g1, 0.6)], [1, g1]]));
    poly(S, vgrad(top, h, [[0, shade(g0, -0.3)], [1, shade(g1, -0.3)]]));
    ctx.save();
    poly(F);
    ctx.clip();
    // Etagen: beleuchtete Bänder (Büros), einzelne helle Abschnitte
    const fl = [], bright = [], mull = [], lines = [];
    for (let y = top + 4; y < h; y += 6) {
      lines.push([0, y, fw, y]);
      const v = r();
      if (v < 0.22) fl.push([0, y + 1, fw, 4]);
      else if (v < 0.36) { const a = R(r, 0, fw * 0.6); bright.push([a, y + 1, R(r, 8, fw - a), 4]); }
    }
    rects(fl, rgba(P.cool, 0.2));
    rects(bright, rgba(mix(P.cool, P.warm, 0.4), 0.32));
    for (let x = 3; x < fw; x += 5) mull.push([x, top, x, h]);
    segs(mull, rgba(INK, 0.3), 0.8);
    segs(lines, rgba(CREAM, 0.06), 0.7);
    // schräge Spiegelung
    path([[fw * 0.15, top - 10], [fw * 0.45, top - 10], [fw * 0.05, h * 0.75], [-fw * 0.25, h * 0.75]], true);
    ctx.fillStyle = rgba(mix(C.pipe, CREAM, 0.5), 0.05);
    ctx.fill();
    ctx.restore();
    rects([[0, h - 18, fw, 14]], rgba(INK, 0.35));
    rects([[2, h - 16, fw - 4, 10]], rgba(mix(P.warm, P.cool, 0.5), 0.3));
    segs([[fw * 0.3, h - 16, fw * 0.3, h - 6], [fw * 0.6, h - 16, fw * 0.6, h - 6]], rgba(INK, 0.4), 1);
    stroke([F[0], F[1]], rgba(mix(C.pipe, CREAM, 0.4), 0.35), 1.1);
    line(0.5, F[0][1], 0.5, h, rgba(C.pipe, 0.12), 1);
    if (crown === 'step') {
      const bx = fw * R(r, 0.15, 0.3), bw = fw * R(r, 0.4, 0.55);
      nBox(bx, 3, bw, top - 3, shade(P.body, 0.04), C, 0.2);
      rects([[bx + 2, 6, bw * 0.75, 2]], rgba(P.cool, 0.25));
    }
    if (crown === 'fin') {
      const fx = fw * R(r, 0.3, 0.7);
      poly([[fx - 3, top], [fx, 0], [fx + 3, top]], shade(P.body, 0.1));
      line(fx, 2, fx, top, rgba(C.pipe, 0.2), 0.8);
      nRed(fx, 1.5, P, 0.8);
    }
  }

  // Schlanker Turm, oft mit Sockelbau; Fensterbänder, Lichtlinie, Antenne
  function nSlim(w, h, r, C, P) {
    const pod = w > 72, tw = pod ? Math.round(w * R(r, 0.46, 0.58)) : w, tx = pod ? (r() < 0.5 ? 0 : w - tw) : 0;
    const body = nVary(P.body, r, C), ant = R(r, 18, 40), topH = R(r, 14, 30), y0 = ant;
    if (pod) {
      const ph = R(r, 40, 80), px = tx === 0 ? tw - 4 : 0, pw = w - tw + 4;
      const fw2 = nBox(px, h - ph, pw, ph, shade(body, 0.03), C, 0.14);
      nWins(px + 4, px + fw2 - 3, h - ph + 6, h - 22, { gx: 6, gy: 8, lit: 0.3, warm: 0.5 }, r, P);
      nShop(px, px + fw2, h, C, P, r);
    }
    const fw = nBox(tx, y0 + topH, tw, h - y0 - topH, body, C, 0.2);
    const ix = tw * 0.16;
    nBox(tx + ix, y0, tw - ix * 2, topH + 1, shade(body, 0.05), C, 0.2);
    // Fensterbänder in zwei bis drei Spalten
    nWins(tx + 4, tx + fw - 3, y0 + topH + 6, h - 22, { gx: 5, gy: 6, ww: 2.2, wh: 2.8, lit: 0.24, warm: 0.45, a: 0.66 }, r, P);
    nShop(tx, tx + fw, h, C, P, r);
    if (r() < 0.55) {
      const lx = tx + fw * 0.5;
      nTube([[lx, y0 + topH + 4], [lx, h - 30]], r() < 0.6 ? C.pipe : C.accent, 0.45);
    }
    rects([[tx + ix + 2, y0 + topH * 0.45, (tw - ix * 2) * 0.6, 1.6]], rgba(P.cool, 0.35));
    const ax = tx + tw * 0.48;
    line(ax, y0, ax, 3, shade(body, 0.3), 1.2);
    line(ax - 2, y0 - ant * 0.35, ax + 2, y0 - ant * 0.35, shade(body, 0.3), 1);
    nRed(ax, 3, P);
  }

  // Gestuftes Hochhaus: drei bis vier zurückspringende Stufen, Spitze
  function nStufen(w, h, r, C, P) {
    const tiers = r() < 0.5 ? 3 : 4, spire = R(r, 12, 36), body = nVary(P.body, r, C);
    const fr = tiers === 3 ? [0.5, 0.32, 0.18] : [0.42, 0.27, 0.19, 0.12];
    let x0 = 0, x1 = w, y1 = h;
    const avail = h - spire;
    for (let t = 0; t < tiers; t++) {
      const th = avail * fr[t], bw = x1 - x0;
      const fw = nBox(x0, y1 - th, bw, th + (t ? 1 : 0), shade(body, t * 0.03), C, 0.17);
      nWins(x0 + 4, x0 + fw - 3, y1 - th + 5, y1 - (t ? 5 : 22), { gx: 6, gy: 7, ww: 2.4, wh: 3.2, lit: 0.22 + t * 0.04, warm: 0.55 }, r, P);
      if (!t) nShop(x0, x0 + fw, h, C, P, r);
      if (t > 0) rects([[x0, y1 - 1, bw, 1.4]], rgba(CREAM, 0.1));
      y1 -= th;
      const inset = bw * R(r, 0.12, 0.2);
      x0 += inset * R(r, 0.6, 1.4);
      x1 -= inset * R(r, 0.6, 1.4);
      if (x1 - x0 < 12) { const m = (x0 + x1) / 2; x0 = m - 6; x1 = m + 6; }
    }
    const cx = (x0 + x1) / 2;
    if (r() < 0.5) poly([[cx - (x1 - x0) * 0.3, y1], [cx, y1 - spire + 2], [cx + (x1 - x0) * 0.3, y1]], shade(body, 0.08));
    line(cx, y1, cx, y1 - spire + 2, shade(body, 0.3), 1.2);
    nRed(cx, y1 - spire + 3, P);
    if (r() < 0.5) rects([[x0 + 2, y1 + 4, (x1 - x0) * 0.6, 1.5]], rgba(C.accent, 0.35));
  }

  // Gebäude mit Dachaufbauten: Wassertank auf Stelzen, Gittermast, Klimakästen
  function nDach(w, h, r, C, P) {
    const rt = 36, body = nVary(P.body, r, C);
    const fw = nBox(0, rt, w, h - rt, body, C, 0.15);
    nWins(4, fw - 4, rt + 7, h - 22, { gx: 6.5, gy: 8, ww: 3, wh: 3.6, lit: 0.27, warm: 0.65 }, r, P);
    nShop(0, fw, h, C, P, r);
    rects([[0, rt + 3, fw, 1.2]], rgba(INK, 0.3));
    const metal = shade(body, 0.16), dk = shade(body, -0.2);
    // Wassertank
    const tx = R(r, 6, fw * 0.45), tw = R(r, 14, 20), th = R(r, 12, 16), legs = 9;
    segs([[tx + 2, rt, tx + 3, rt - legs], [tx + tw - 2, rt, tx + tw - 3, rt - legs], [tx + 2, rt - 3, tx + tw - 2, rt - legs + 1], [tx + tw - 2, rt - 3, tx + 2, rt - legs + 1]], dk, 1);
    ctx.fillStyle = hgrad(tx, tx + tw, [[0, shade(metal, 0.08)], [0.4, metal], [1, shade(metal, -0.3)]]);
    ctx.fillRect(tx, rt - legs - th, tw, th);
    segs([[tx, rt - legs - th * 0.35, tx + tw, rt - legs - th * 0.35], [tx, rt - legs - th * 0.75, tx + tw, rt - legs - th * 0.75]], rgba(INK, 0.3), 0.8);
    poly([[tx - 1, rt - legs - th], [tx + tw / 2, rt - legs - th - 6], [tx + tw + 1, rt - legs - th]], shade(metal, -0.08));
    // Gittermast mit rotem Licht
    if (r() < 0.75) {
      const mx = R(r, fw * 0.6, fw - 6), mh = R(r, 22, 34);
      const lat = [];
      for (let y = rt; y > rt - mh + 4; y -= 5) lat.push([mx - 2, y, mx + 2, y - 5], [mx + 2, y, mx - 2, y - 5]);
      segs(lat, rgba(metal, 0.7), 0.6);
      segs([[mx - 2.5, rt, mx - 0.5, rt - mh], [mx + 2.5, rt, mx + 0.5, rt - mh]], metal, 0.9);
      nRed(mx, rt - mh, P);
    }
    const ac = [];
    for (let k = 0; k < 3; k++) if (r() < 0.6) ac.push([R(r, 4, fw - 14), rt - 5, R(r, 7, 12), 5]);
    rects(ac, shade(body, 0.1));
  }

  // Turm mit Kuppel: Tambour mit Lichterring, gerippte Kuppel, Laterne
  function nKuppel(w, h, r, C, P) {
    const body = nVary(P.body, r, C), dw = w * R(r, 0.5, 0.7), dh = dw * R(r, 0.45, 0.6), needle = 14, lant = 9, drum = 10;
    const cx = (w - w * 0.15) / 2, top = needle + lant + dh + drum;
    const fw = nBox(0, top, w, h - top, body, C, 0.15);
    nWins(4, fw - 4, top + 8, h - 22, { gx: 7, gy: 9, ww: 3, wh: 4.4, lit: 0.26, warm: 0.7 }, r, P);
    nShop(0, fw, h, C, P, r);
    rects([[0, top + 3, fw, 1.6]], rgba(CREAM, 0.08));
    nBox(cx - dw / 2, top - drum, dw, drum + 1, shade(body, 0.05), C, 0.15);
    const cols = [];
    for (let x = cx - dw / 2 + 3; x < cx + dw / 2 - 4; x += 4) cols.push([x, top - drum + 2, 1.6, drum - 3]);
    rects(cols, rgba(P.warm, 0.3));
    const dy = top - drum, dome = mix(body, C.pipe, 0.12);
    ctx.beginPath();
    ctx.ellipse(cx, dy, dw / 2, dh, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = rgrad(cx - dw * 0.2, dy - dh * 0.7, 1, dw * 0.8, [[0, shade(dome, 0.22)], [0.6, dome], [1, shade(dome, -0.3)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const ribs = [];
    for (let k = 1; k < 6; k++) { const xx = cx - dw / 2 + k * dw / 6; ribs.push([xx, dy, cx + (xx - cx) * 0.25, dy - dh]); }
    segs(ribs, rgba(INK, 0.22), 0.9);
    ctx.restore();
    ctx.strokeStyle = rgba(CREAM, 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, dy, dw / 2 - 1, dh - 1, 0, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
    nBox(cx - 4, dy - dh - lant + 1, 8, lant, shade(body, 0.1), C, 0.3);
    rects([[cx - 2.5, dy - dh - lant + 3, 4, 4]], rgba(P.warm, 0.5));
    line(cx, dy - dh - lant + 1, cx, 2, shade(body, 0.3), 1);
    nRed(cx, 2.5, P, 0.8);
    const ring = [];
    for (let x = cx - dw / 2 + 2; x < cx + dw / 2; x += 3.2) ring.push([x, dy + 1, 0.8]);
    dots(ring, rgba(P.cool, 0.6));
  }

  // Fernsehturm (generisch): Schaft, Korb mit Fensterband, Antennenspitze, Sockelbau
  function nTV(w, h, r, C, P) {
    const body = mix(nVary(P.body, r, C), C.skyBottom, 0.1), cx = w * 0.45, podY = h * R(r, 0.28, 0.34), ant = R(r, 50, 70);
    const bh = R(r, 26, 38);
    const fw = nBox(0, h - bh, w, bh, shade(body, -0.02), C, 0.15);
    nWins(4, fw - 4, h - bh + 6, h - 6, { gx: 6, gy: 7, lit: 0.4, warm: 0.7 }, r, P);
    const lit = shade(body, 0.12), dk = shade(body, -0.25);
    // Schaft, leicht verjüngt, Licht von links
    const s0 = 8, s1 = 4.5, sy = ant + 8;
    poly([[cx - s0, h - bh], [cx - s1, sy], [cx + s1, sy], [cx + s0, h - bh]], hgrad(cx - s0, cx + s0, [[0, lit], [0.45, body], [1, dk]]));
    const marks = [];
    for (let y = sy + 30; y < h - bh; y += 26) marks.push([cx - 5, y, 10, 1.4]);
    rects(marks, rgba(P.cool, 0.25));
    // Korb: untere Scheibe, Glasband, obere Scheibe
    const pr = Math.min(w * 0.44, 34);
    ellipse(cx, podY + 9, pr * 0.75, 4, 0, dk);
    poly([[cx - pr * 0.75, podY + 9], [cx - pr, podY + 2], [cx + pr, podY + 2], [cx + pr * 0.75, podY + 9]], hgrad(cx - pr, cx + pr, [[0, lit], [0.5, body], [1, dk]]));
    ctx.fillStyle = hgrad(cx - pr, cx + pr, [[0, rgba(P.warm, 0.5)], [0.5, rgba(P.cool, 0.45)], [1, rgba(P.cool, 0.2)]]);
    ctx.fillRect(cx - pr, podY - 4, pr * 2, 6);
    const pane = [];
    for (let x = cx - pr + 3; x < cx + pr; x += 4) pane.push([x, podY - 4, x, podY + 2]);
    segs(pane, rgba(INK, 0.4), 0.7);
    poly([[cx - pr, podY - 4], [cx - pr * 0.7, podY - 11], [cx + pr * 0.7, podY - 11], [cx + pr, podY - 4]], hgrad(cx - pr, cx + pr, [[0, lit], [0.5, body], [1, dk]]));
    line(cx - pr * 0.7, podY - 11, cx + pr * 0.4, podY - 11, rgba(CREAM, 0.2), 1);
    // zweiter, kleiner Ring darüber
    const p2 = podY - 11 - (podY - 11 - sy) * 0.4;
    ctx.fillStyle = hgrad(cx - 9, cx + 9, [[0, lit], [1, dk]]);
    ctx.fillRect(cx - 9, p2 - 3, 18, 5);
    rects([[cx - 8, p2 - 1.5, 15, 1.5]], rgba(P.warm, 0.45));
    // Antenne
    line(cx, sy, cx, 2, shade(body, 0.28), 2);
    line(cx, sy - ant * 0.5, cx, 2, shade(body, 0.35), 1);
    nRed(cx, 2.5, P);
    nRed(cx, sy - ant * 0.45, P, 0.7);
  }

  // Gebäude mit Leuchttafel (ohne Schrift), wahlweise Dachtafel auf Gerüst
  function nTafel(w, h, r, C, P) {
    const roofB = r() < 0.45, rt = roofB ? R(r, 34, 44) : 4, body = nVary(P.body, r, C);
    const fw = nBox(0, rt, w, h - rt, body, C, 0.15);
    nWins(4, fw - 4, rt + 6, h - 22, { gx: 6, gy: 8, lit: 0.25, warm: 0.6 }, r, P);
    nShop(0, fw, h, C, P, r);
    if (roofB) {
      const bw = fw * R(r, 0.6, 0.85), bx = R(r, 2, fw - bw - 2), bh = rt - 14;
      const st = [];
      for (let x = bx + 4; x < bx + bw; x += bw / 3) st.push([x, rt, x, rt - 9], [x - 3, rt, x + 3, rt - 9]);
      segs(st, shade(body, 0.15), 1);
      nPanel(bx, 3, bw, bh, C, r);
    }
    if (!roofB || r() < 0.5) {
      const pw = fw * R(r, 0.4, 0.62), ph = Math.min(h - rt - 30, pw * R(r, 0.9, 1.6)), px = r() < 0.5 ? 5 : fw - pw - 5, py = rt + R(r, 12, Math.max(14, (h - rt) * 0.3));
      nPanel(px, py, pw, ph, C, r);
    }
  }

  // Neon-Akzent: dunkler Turm mit Röhren an den Kanten, Leuchtbändern und schmaler Senkrechttafel
  function nNeon(w, h, r, C, P) {
    const top = R(r, 4, 14), body = mix(nVary(P.body, r, C), INK, 0.25);
    const fw = nBox(0, top, w, h - top, body, C, 0.16);
    nWins(5, fw - 5, top + 8, h - 22, { gx: 6, gy: 7, ww: 2.4, wh: 3, lit: 0.2, warm: 0.45, a: 0.62 }, r, P);
    nShop(0, fw, h, C, P, r);
    const cA = r() < 0.5 ? C.pipe : C.accent, cB = cA === C.pipe ? C.accent : C.pipe;
    nTube([[1.5, h - 20], [1.5, top + 2], [fw - 1.5, top + 2]], cA, 0.55);
    const nb = 1 + Math.floor(r() * 3);
    for (let k = 0; k < nb; k++) { const y = top + 18 + r() * (h - top - 60); nTube([[4, y], [fw - 4, y]], cB, 0.45); }
    if (r() < 0.7) {
      const bx = R(r, 6, fw - 16), by = top + R(r, 16, 40), bh2 = Math.min(h - by - 30, R(r, 50, 90)), bl = [];
      ctx.fillStyle = rgba(INK, 0.8);
      ctx.fillRect(bx, by, 9, bh2);
      for (let y = by + 3; y < by + bh2 - 6; y += 8) bl.push([bx + 2, y, 5, 5]);
      rects(bl, rgba(mix(cB, CREAM, 0.3), 0.5));
      ctx.strokeStyle = rgba(cB, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, 8, bh2 - 1);
    }
  }

  // Lagerhalle am Stadtrand: Shedddach oder Tonnendach, Tore, Wandlampen, Schornstein
  function nLager(w, h, r, C, P) {
    const body = mix(nVary(P.body, r, C), C.skyBottom, 0.08), saw = r() < 0.55, chim = r() < 0.5, roofH = saw ? 12 : 16;
    const cw = chim ? 12 : 0, hallW = w - cw, wallTop = Math.max(roofH + 4, h * 0.42);
    if (chim) {
      const cx = w - cw + 2;
      ctx.fillStyle = hgrad(cx, cx + 9, [[0, shade(body, 0.12)], [1, shade(body, -0.25)]]);
      ctx.fillRect(cx, 6, 9, h - 6);
      rects([[cx - 1, 6, 11, 3], [cx, 26, 9, 1.5]], shade(body, 0.2));
      nRed(cx + 4.5, 4, P, 0.7);
    }
    const fw = nBox(0, wallTop, hallW, h - wallTop, body, C, 0.12);
    if (saw) {
      const n = Math.max(3, Math.round(hallW / 34)), tw = hallW / n;
      for (let k = 0; k < n; k++) {
        const x = k * tw;
        poly([[x, wallTop], [x + tw * 0.75, wallTop - roofH], [x + tw * 0.78, wallTop - roofH], [x + tw * 0.78, wallTop]], shade(body, 0.07));
        poly([[x + tw * 0.78, wallTop - roofH], [x + tw, wallTop], [x + tw * 0.78, wallTop]], rgba(P.cool, 0.22));
        line(x + 1, wallTop - 0.5, x + tw * 0.75, wallTop - roofH, rgba(CREAM, 0.12), 1);
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(hallW / 2, wallTop, hallW / 2, roofH, 0, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = vgrad(wallTop - roofH, wallTop, [[0, shade(body, 0.12)], [1, shade(body, -0.05)]]);
      ctx.fill();
      const rib = [];
      for (let k = 1; k < 8; k++) { const x = k * hallW / 8; rib.push([x, wallTop, hallW / 2 + (x - hallW / 2) * 0.9, wallTop - roofH * Math.sqrt(1 - Math.pow((x - hallW / 2) / (hallW / 2), 2))]); }
      segs(rib, rgba(INK, 0.18), 0.8);
    }
    // Tore mit Lamellen, Lampen darüber
    const doors = Math.max(1, Math.floor(fw / 46)), dwid = Math.min(26, fw / doors * 0.55), dh = Math.min(28, (h - wallTop) * 0.55);
    for (let k = 0; k < doors; k++) {
      const dx = (k + 0.5) * fw / doors - dwid / 2;
      ctx.fillStyle = shade(body, -0.3);
      ctx.fillRect(dx, h - dh, dwid, dh);
      const sl = [];
      for (let y = h - dh + 3; y < h; y += 3) sl.push([dx, y, dx + dwid, y]);
      segs(sl, rgba(CREAM, 0.06), 0.7);
      glow(dx + dwid / 2, h - dh - 5, 12, P.warm, 0.3);
      rects([[dx + dwid / 2 - 2, h - dh - 6, 4, 1.6]], rgba(P.warm, 0.75));
    }
    nWins(5, fw - 5, wallTop + 5, h - dh - 10, { gx: 7, gy: 7, ww: 4, wh: 3, lit: 0.3, warm: 0.5, a: 0.6 }, r, P);
  }

  // Häuserzeile am Stadtrand: kleine Häuser mit Satteldach, Schornsteinen und Bäumen
  function nHaus(w, h, r, C, P) {
    let x = 0;
    const tree = (tx, th) => {
      const tc = mix(C.near, C.far, 0.25);
      line(tx, h, tx, h - th * 0.4, shade(tc, -0.2), 2);
      blobPath([[tx, h - th * 0.62, th * 0.3], [tx - th * 0.18, h - th * 0.48, th * 0.22], [tx + th * 0.18, h - th * 0.46, th * 0.22]]);
      ctx.fillStyle = rgrad(tx - th * 0.15, h - th * 0.75, 1, th * 0.5, [[0, shade(tc, 0.12)], [1, shade(tc, -0.2)]]);
      ctx.fill();
    };
    while (x < w - 24) {
      if (r() < 0.25 && x > 8) { const th = R(r, 26, Math.min(48, h * 0.7)); tree(x + 9, th); x += 18; continue; }
      const hw = Math.min(w - x, R(r, 30, 52)), hh = R(r, h * 0.38, h * 0.62), rf = R(r, 10, Math.min(20, h - hh - 2));
      const body = mix(nVary(P.body, r, C), C.skyBottom, 0.08), top = h - hh;
      const fw = nBox(x, top, hw, hh, body, C, 0.18);
      if (r() < 0.7) {
        poly([[x - 2, top + 1], [x + fw * 0.5, top - rf], [x + hw + 1, top + 1]], shade(body, -0.12));
        line(x - 1, top + 0.5, x + fw * 0.5, top - rf, rgba(CREAM, 0.14), 1);
        if (r() < 0.6) { const cx2 = x + fw * R(r, 0.6, 0.8); rects([[cx2, top - rf * 0.75, 4, rf * 0.6]], shade(body, -0.05)); }
      } else rects([[x - 1, top - 2, hw + 2, 2.5]], shade(body, 0.12));
      nWins(x + 4, x + fw - 4, top + 6, h - 10, { gx: 9, gy: 10, ww: 4, wh: 5, lit: 0.45, warm: 0.9, a: 0.7 }, r, P);
      rects([[x + fw * 0.4, h - 9, 5, 9]], shade(body, -0.35));
      x += hw + R(r, 1, 6);
    }
  }

  // Baustelle: halb fertiges Hochhaus mit offenem Rohbau und Turmdrehkran
  function nKran(w, h, r, C, P) {
    const body = nVary(P.body, r, C), bw = w * R(r, 0.5, 0.62), bx = r() < 0.5 ? 0 : w - bw, crTop = 14;
    const bTop = crTop + R(r, 40, 70), done = bTop + (h - bTop) * R(r, 0.35, 0.55);
    const fw = nBox(bx, done, bw, h - done, body, C, 0.15);
    nWins(bx + 4, bx + fw - 4, done + 6, h - 8, { gx: 6, gy: 8, lit: 0.22, warm: 0.6 }, r, P);
    // Rohbau: Deckenplatten und Stützen, dazwischen Himmel
    const slab = shade(body, 0.1), sl = [], co = [];
    for (let y = done; y > bTop; y -= 9) sl.push([bx, y - 2, bw, 2.2]);
    for (let x = bx + 2; x < bx + bw; x += bw / 5) co.push([x, bTop, 2, done - bTop]);
    rects(co, shade(body, -0.05));
    rects(sl, slab);
    rects([[bx, bTop - 1, bw * 0.6, 2.2]], slab);
    if (r() < 0.6) glow(bx + bw * 0.5, done - 14, 14, P.warm, 0.25);
    // Kran: Gittermast, Ausleger, Gegenausleger mit Gewicht, Seil
    const mx = bx === 0 ? bw + 8 : bx - 8, metal = mix(shade(body, 0.25), C.accent, 0.1);
    const lat = [];
    for (let y = h; y > crTop + 6; y -= 6) lat.push([mx - 3, y, mx + 3, y - 6], [mx + 3, y, mx - 3, y - 6]);
    segs(lat, rgba(metal, 0.55), 0.6);
    segs([[mx - 3, h, mx - 3, crTop + 4], [mx + 3, h, mx + 3, crTop + 4]], metal, 1);
    const jl = bx === 0 ? -mx + 2 : w - mx - 2, cl = -jl * 0.35;
    segs([[mx, crTop + 4, mx + jl, crTop + 6], [mx, crTop + 9, mx + jl, crTop + 9], [mx, crTop + 4, mx + cl, crTop + 6], [mx, crTop + 9, mx + cl, crTop + 9]], metal, 1);
    const jt = [];
    for (let k = 0; k < 14; k++) { const t0 = k / 14, t1 = (k + 1) / 14; jt.push([mx + jl * t0, crTop + 9, mx + jl * t1, crTop + 5 + t1]); }
    segs(jt, rgba(metal, 0.5), 0.6);
    line(mx, crTop + 4, mx, crTop - 6, metal, 1.2);
    segs([[mx, crTop - 6, mx + jl * 0.6, crTop + 5], [mx, crTop - 6, mx + cl, crTop + 5]], rgba(metal, 0.6), 0.6);
    rects([[mx + cl - (cl > 0 ? 0 : -1) * 0 - 4, crTop + 9, 8, 7]], shade(body, -0.1));
    rects([[mx + (bx === 0 ? 3 : -9), crTop + 10, 6, 6]], rgba(P.warm, 0.4));
    const hx = mx + jl * R(r, 0.35, 0.7), hy = crTop + R(r, 50, 110);
    line(hx, crTop + 9, hx, hy, rgba(metal, 0.7), 0.6);
    rects([[hx - 2, hy, 4, 3]], metal);
    nRed(mx + jl, crTop + 6, P, 0.7);
    nRed(mx, crTop - 6, P, 0.8);
  }

  // Park: runde Baumkronen, Laternen mit warmem Schein, Pavillon
  function nPark(w, h, r, C, P) {
    const tc = mix(C.near, C.far, 0.3), lamps = [];
    if (r() < 0.5) {
      const px = R(r, w * 0.2, w * 0.7), pw = 26, py = h - 20;
      rects([[px + 3, py, 2, 20], [px + pw - 5, py, 2, 20]], shade(tc, 0.05));
      poly([[px - 3, py + 1], [px + pw / 2, py - 10], [px + pw + 3, py + 1]], shade(tc, 0.1));
      glow(px + pw / 2, py + 10, 16, P.warm, 0.22);
    }
    for (let x = 6; x < w - 6; x += R(r, 14, 26)) {
      const th = R(r, h * 0.45, h * 0.95);
      line(x, h, x, h - th * 0.45, shade(tc, -0.25), 2.2);
      const bl = [[x, h - th * 0.7, th * 0.26], [x - th * 0.17, h - th * 0.55, th * 0.2], [x + th * 0.16, h - th * 0.52, th * 0.21], [x + th * 0.05, h - th * 0.85, th * 0.17]];
      blobPath(bl);
      ctx.fillStyle = rgrad(x - th * 0.12, h - th * 0.85, 1, th * 0.55, [[0, shade(tc, 0.14)], [0.6, tc], [1, shade(tc, -0.25)]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = vgrad(h - th, h, [[0, rgba(C.pipe, 0)], [1, rgba(C.pipe, 0.08)]]);
      ctx.fillRect(x - th * 0.5, h - th, th, th);
      ctx.restore();
      if (r() < 0.45) lamps.push(x + R(r, 6, 10));
    }
    for (const lx of lamps) {
      line(lx, h, lx, h - 22, shade(tc, 0.1), 1);
      glow(lx, h - 23, 11, P.warm, 0.35);
      circle(lx, h - 23, 1.5, mix(P.warm, CREAM, 0.4));
    }
  }

  // Wasserband am unteren Rand: Verlauf, waagerechte Glanzstriche, weiche Spiegelungen einzelner Lichter
  function nWater(x0, x1, y, h, C, P, r, lights) {
    ctx.fillStyle = vgrad(y, h, [[0, mix(C.near, C.skyBottom, 0.5)], [1, shade(C.near, -0.1)]]);
    ctx.fillRect(x0, y, x1 - x0, h - y);
    rects([[x0, y, x1 - x0, 1]], rgba(mix(C.pipe, CREAM, 0.4), 0.16));
    const gl = [], gd = [];
    for (let k = 0, n = Math.round((x1 - x0) / 8); k < n; k++) {
      const yy = y + 3 + r() * (h - y - 7), xx = x0 + r() * (x1 - x0);
      (r() < 0.6 ? gl : gd).push([xx, yy, R(r, 4, 16), 0.8]);
    }
    rects(gl, rgba(mix(C.pipe, CREAM, 0.4), 0.12));
    rects(gd, rgba(INK, 0.2));
    if (lights && lights.length) {
      ctx.beginPath();
      for (const [lx, w2] of lights) for (let yy = y + 2; yy < h - 5; yy += 3) ctx.rect(lx - w2 / 2 + (r() - 0.5) * 2, yy, w2 * R(r, 0.5, 1), 1.2);
      ctx.fillStyle = vgrad(y, h - 4, [[0, rgba(P.warm, 0.3)], [1, rgba(P.warm, 0)]]);
      ctx.fill();
    }
  }

  // Hängebrücke über ein Hafenbecken: Ankerblöcke, Pylone, Tragseile, Hänger, Fahrbahn mit Lichterkette
  function nBruecke(w, h, r, C, P) {
    const body = mix(nVary(P.body, r, C), C.skyBottom, 0.12), dk = shade(body, -0.25), lit = shade(body, 0.12);
    const deckY = h - R(r, 98, 108), waterY = h - 30, p1 = w * 0.23, p2 = w * 0.77, pw = 9, ptop = 8, aw = 24;
    nWater(aw - 2, w - aw + 2, waterY, h, C, P, r, [[p1 - 30, 4], [w * 0.5, 5], [p2 + 26, 4]]);
    // Ankerblöcke an beiden Enden (Land), mit einzelnen Fenstern
    for (const ax of [0, w - aw]) {
      const fw = nBox(ax, deckY - 6, aw, h - deckY + 6, shade(body, -0.04), C, 0.22);
      rects([[ax + 4, deckY + 10, fw - 8, 3], [ax + 4, deckY + 30, fw - 8, 3]], rgba(P.warm, 0.3));
    }
    // Pylone mit Öffnungen und Sockel im Wasser
    for (const px of [p1, p2]) {
      ctx.fillStyle = hgrad(px - pw / 2, px + pw / 2, [[0, lit], [0.45, body], [1, dk]]);
      ctx.fillRect(px - pw / 2, ptop, pw, h - ptop);
      const op = [];
      for (const y of [ptop + 18, ptop + 54, deckY - 32]) op.push([px - pw / 2 + 2.5, y, pw - 5, 13]);
      rects(op, rgba(INK, 0.45));
      rects([[px - pw / 2 - 2, deckY - 2, pw + 4, 6]], dk);
      nBox(px - pw / 2 - 4, waterY - 6, pw + 8, h - waterY + 6, shade(body, -0.06), C, 0.25);
      line(px - pw / 2 + 0.5, ptop, px - pw / 2 + 0.5, deckY - 3, rgba(CREAM, 0.12), 1);
      nRed(px, ptop - 1, P, 0.8);
    }
    // Tragseile: Hauptfeld durchhängend, Seitenfelder zu den Ankern
    const sag = deckY - 10, cy = t => ptop + 3 + (sag - ptop - 3) * (1 - Math.pow(2 * t - 1, 2));
    const pts = [];
    for (let k = 0; k <= 32; k++) pts.push([lerp(p1, p2, k / 32), cy(k / 32)]);
    stroke(pts, lit, 1.6);
    const side = (xa, xb, t) => lerp(deckY - 7, ptop + 3, Math.pow(t, 1.35));
    const sl = [], sr = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; sl.push([lerp(aw * 0.5, p1, t), side(0, 0, t)]); sr.push([lerp(w - aw * 0.5, p2, t), side(0, 0, t)]); }
    stroke(sl, lit, 1.4);
    stroke(sr, lit, 1.4);
    const hang = [];
    for (let x = p1 + 7; x < p2 - 4; x += 7) hang.push([x, cy((x - p1) / (p2 - p1)), x, deckY]);
    for (let x = aw + 4; x < p1 - 4; x += 7) hang.push([x, side(0, 0, (x - aw * 0.5) / (p1 - aw * 0.5)), x, deckY]);
    for (let x = p2 + 7; x < w - aw - 3; x += 7) hang.push([x, side(0, 0, (w - aw * 0.5 - x) / (w - aw * 0.5 - p2)), x, deckY]);
    segs(hang, rgba(lit, 0.45), 0.6);
    // Fahrbahn mit Fachwerkträger und Lichterkette
    ctx.fillStyle = vgrad(deckY, deckY + 9, [[0, lit], [0.3, body], [1, dk]]);
    ctx.fillRect(0, deckY, w, 9);
    const tr = [];
    for (let x = 0; x < w; x += 8) tr.push([x, deckY + 9, x + 4, deckY + 3.5], [x + 4, deckY + 3.5, x + 8, deckY + 9]);
    segs(tr, rgba(INK, 0.35), 0.7);
    rects([[0, deckY, w, 1]], rgba(CREAM, 0.15));
    const lights = [];
    for (let x = 4; x < w; x += 9) lights.push([x, deckY - 1.5, 0.9]);
    dots(lights, rgba(P.warm, 0.8));
  }

  // Hafen: Kai mit Containerstapeln und Containerbrücke, davor ein Hafenbecken
  function nHafen(w, h, r, C, P) {
    const body = mix(nVary(P.body, r, C), C.skyBottom, 0.1), quay = h - 30, cw = 22, ch = 9;
    const left = r() < 0.5, kx0 = left ? 0 : w * R(r, 0.3, 0.38), kx1 = left ? w * R(r, 0.62, 0.7) : w;
    nWater(left ? kx1 - 2 : 0, left ? w : kx0 + 2, quay + 4, h, C, P, r, [[left ? kx1 + 20 : kx0 - 24, 4]]);
    // Kaimauer mit Pollern
    const fw = nBox(kx0, quay, kx1 - kx0, h - quay, shade(body, -0.06), C, 0.06);
    rects([[kx0, quay + 7, fw, 1.2]], rgba(INK, 0.3));
    const bol = [];
    for (let x = kx0 + 8; x < kx1 - 6; x += R(r, 26, 40)) bol.push([x, quay - 3, 3, 3]);
    rects(bol, shade(body, 0.15));
    // Container in Stapeln
    const cc = [mix(C.far, C.accent, 0.35), mix(C.far, C.pipe, 0.35), mix(C.far, '#d9a35a', 0.35), mix(C.far, CREAM, 0.2), mix(C.far, '#7fbf7a', 0.25)];
    const cranePos = left ? kx1 - R(r, 40, 60) : kx0 + R(r, 10, 24);
    let sx = kx0 + 4;
    while (sx < kx1 - cw - 2) {
      if (Math.abs(sx + cw / 2 - cranePos - 23) < 30) { sx += cw; continue; }
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const y = quay - (k + 1) * ch, c = PK(r, cc);
        ctx.fillStyle = vgrad(y, y + ch, [[0, shade(c, 0.08)], [1, shade(c, -0.15)]]);
        ctx.fillRect(sx, y, cw, ch - 0.6);
        const rib = [];
        for (let x = sx + 2; x < sx + cw - 1; x += 2.2) rib.push([x, y + 1, x, y + ch - 1.5]);
        segs(rib, rgba(INK, 0.22), 0.5);
        rects([[sx, y, cw, 0.8]], rgba(CREAM, 0.12));
      }
      sx += cw + (r() < 0.3 ? 6 : 1);
    }
    // Containerbrücke: Beine auf dem Kai, Ausleger über das Wasser, Laufkatze, Seile
    const metal = mix(shade(body, 0.2), C.accent, 0.12), lx = cranePos, lw2 = 46, top = 22, beam = 50;
    segs([[lx, quay, lx + 4, top + beam], [lx + lw2, quay, lx + lw2 - 4, top + beam]], metal, 3);
    segs([[lx + 2, top + beam + 30, lx + lw2 - 2, top + beam + 30], [lx + 3, top + beam + 30, lx + lw2 - 3, top + beam]], metal, 1.2);
    const bx0 = left ? lx - 24 : 4, bx1 = left ? w - 4 : lx + lw2 + 24;
    ctx.fillStyle = vgrad(top + beam - 6, top + beam, [[0, shade(metal, 0.15)], [1, shade(metal, -0.2)]]);
    ctx.fillRect(bx0, top + beam - 6, bx1 - bx0, 6);
    const tr = [];
    for (let x = bx0 + 2; x < bx1 - 3; x += 7) tr.push([x, top + beam - 6, x + 3.5, top + beam]);
    segs(tr, rgba(INK, 0.3), 0.6);
    const apex = lx + lw2 / 2;
    segs([[lx + 2, top + beam - 6, apex, top], [apex, top, lx + lw2 - 2, top + beam - 6], [apex, top, bx0 + 2, top + beam - 6], [apex, top, bx1 - 2, top + beam - 6]], rgba(metal, 0.8), 0.9);
    const cabX = left ? lx - 16 : lx + lw2 - 4;
    nBox(cabX, top + beam - 16, 18, 10, shade(body, 0.05), C, 0.2);
    rects([[cabX + 3, top + beam - 13, 8, 4]], rgba(P.warm, 0.45));
    const tx = left ? R(r, lx + lw2 + 20, w - 14) : R(r, 14, lx - 14);
    rects([[tx - 4, top + beam, 8, 4]], metal);
    line(tx, top + beam + 4, tx, quay - R(r, 10, 40), rgba(metal, 0.7), 0.6);
    nRed(apex, top - 1, P, 0.8);
    nRed(left ? bx1 - 1 : bx0 + 1, top + beam - 6, P, 0.6);
    for (let x = kx0 + 14; x < kx1 - 10; x += 46) { glow(x, quay - 1, 10, P.warm, 0.22); rects([[x - 1.5, quay - 2, 3, 1.5]], rgba(P.warm, 0.6)); }
  }

  // ---------- ferne Skyline: Gruppen ruhiger Silhouetten ----------
  // Alle Fronten einer Reihe als ein Pfad mit einem Verlauf, ebenso die Schattenseiten (schnell)
  function fillPolys(list, style) {
    if (!list.length) return;
    ctx.beginPath();
    for (const p of list) {
      ctx.moveTo(p[0][0], p[0][1]);
      for (let k = 1; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1]);
      ctx.closePath();
    }
    ctx.fillStyle = style;
    ctx.fill();
  }
  function nFarRow(w, h, r, C, cfg, col, row, red) {
    const side = shade(col, -0.16), F = [], S = [], N = [], E = [], Wn = [], reds = [];
    const box = (x, y, bw, yb) => {
      const sw = Math.max(1.5, bw * 0.16);
      F.push([[x, y], [x + bw - sw, y], [x + bw - sw, yb], [x, yb]]);
      S.push([[x + bw - sw, y], [x + bw, y + 1], [x + bw, yb], [x + bw - sw, yb]]);
      E.push([x, y, bw - sw, 1]);
      return sw;
    };
    let x = R(r, -4, 10);
    while (x < w - 10) {
      const bw = Math.min(w - x, R(r, 16, 38) * (row ? 1 : 0.9)), hh = h * R(r, cfg.lo, cfg.hi) * (row ? 0.85 : 1), top = h - hh;
      const type = PK(r, cfg.types);
      let peak = top, px = x + bw * 0.45;
      if (type === 'step') {
        box(x, top + hh * 0.3, bw, h);
        box(x + bw * 0.15, top + hh * 0.12, bw * 0.7, top + hh * 0.3 + 1);
        box(x + bw * 0.3, top, bw * 0.4, top + hh * 0.12 + 1);
        px = x + bw * 0.48;
      } else if (type === 'spire') {
        box(x, top, bw, h);
        F.push([[x + bw * 0.25, top + 0.5], [x + bw * 0.42, top - bw * 0.9], [x + bw * 0.6, top + 0.5]]);
        px = x + bw * 0.42;
        peak = top - bw * 0.9 - 10;
        N.push([px, top - bw * 0.9, px, peak]);
      } else if (type === 'wedge') {
        const yb = top + bw * 0.4, sw = box(x, yb, bw, h);
        F.push([[x, yb + 0.5], [x + bw - sw, top], [x + bw - sw, yb + 1]]);
        S.push([[x + bw - sw, top], [x + bw, top + 2], [x + bw, yb + 1], [x + bw - sw, yb + 1]]);
        px = x + bw - sw;
      } else if (type === 'dome') {
        const cy = top + bw * 0.3, rx = bw * 0.32, ry = bw * 0.3, cx = x + bw * 0.42, pts = [];
        box(x, cy, bw, h);
        for (let k = 0; k <= 8; k++) { const a = Math.PI + k * Math.PI / 8; pts.push([cx + Math.cos(a) * rx, cy + 0.5 + Math.sin(a) * ry]); }
        F.push(pts);
        peak = cy - ry - 8;
        px = cx;
        N.push([cx, cy - ry, cx, peak]);
      } else if (type === 'antenna') {
        box(x, top, bw, h);
        px = x + bw * 0.6;
        peak = top - 14;
        N.push([px, top, px, peak]);
      } else if (type === 'box2') {
        box(x, top, bw, h);
        box(x + bw * 0.2, top - 8, bw * 0.45, top + 1);
        peak = top - 8;
      } else box(x, top, bw, h);
      // vereinzelte winzige Fenster: Anzahl aus der Fläche, Lage auf dem Raster
      const cols = Math.max(1, Math.floor((bw * 0.84 - 4) / 4)), rowsN = Math.max(0, Math.floor((hh - 10) / 5));
      for (let k = Math.round(cols * rowsN * 0.07); k > 0; k--) Wn.push([x + 2 + Math.floor(r() * cols) * 4, top + 6 + Math.floor(r() * rowsN) * 5, 1.3, 1.6]);
      if (hh > h * 0.8) reds.push([px, peak]);
      x += bw + R(r, 0, row ? 10 : 4);
    }
    fillPolys(F, col);
    fillPolys(S, side);
    segs(N, col, 1);
    rects(E, rgba(CREAM, 0.07));
    rects(Wn, rgba(mix(CREAM, C.pipe, 0.3), 0.3));
    reds.sort((p, q) => p[1] - q[1]);
    for (const [a, b] of reds.slice(0, 2)) glow(a, b, 5, red, 0.32);
  }

  function nFar(w, h, r, C, kind) {
    const back = mix(mix(C.far, C.skyBottom, 0.55), C.skyTop, 0.1), front = mix(C.far, C.skyBottom, 0.3), red = mix(C.accent, '#ff5040', 0.5);
    const cfg = {
      f0: { lo: 0.2, hi: 0.55, types: ['box', 'box', 'box2', 'antenna', 'wedge'] },
      f1: { lo: 0.3, hi: 0.75, types: ['box', 'box2', 'step', 'antenna', 'wedge', 'dome'] },
      f2: { lo: 0.45, hi: 1, types: ['step', 'spire', 'wedge', 'box2', 'antenna', 'dome', 'box'] }
    }[kind === 'f2tv' ? 'f2' : kind];
    nFarRow(w, h, r, C, cfg, back, 0, red);
    nFarRow(w, h, r, C, cfg, front, 1, red);
    if (kind === 'f2tv') nFarTV(w * R(r, 0.3, 0.6), 22, 4, h, mix(front, C.skyBottom, 0.15), C, red);
    // ein Verlauf für alles: oben etwas heller, unten Dunst mit dem Schein der Straßen
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(0, h, [[0, rgba(CREAM, 0.04)], [0.45, rgba(C.haze, 0)], [1, rgba(mix(C.haze, C.accent, 0.25), 0.5)]]);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // ferner Fernsehturm
  function nFarTV(x, bw, top, h, col, C, red) {
    const cx = x + bw / 2, py = top + (h - top) * 0.22;
    poly([[cx - 4, h], [cx - 2.2, top + 16], [cx + 2.2, top + 16], [cx + 4, h]], col);
    ellipse(cx, py, bw * 0.5, 4, 0, col);
    ctx.fillStyle = rgba(mix(C.pipe, CREAM, 0.4), 0.22);
    ctx.fillRect(cx - bw * 0.42, py - 1, bw * 0.84, 1.4);
    ellipse(cx, py - 5, bw * 0.3, 3, 0, shade(col, 0.04));
    line(cx, top + 16, cx, top - 2, col, 1.4);
    glow(cx, top - 2, 5, red, 0.35);
  }

  // Ferne Brücke über die Bucht und Kräne: lange flache Silhouette mit Lichterkette
  function nFarBay(w, h, r, C, kind) {
    const col = mix(C.far, C.skyBottom, 0.38), dY = h - 34;
    ctx.fillStyle = vgrad(dY + 8, h, [[0, rgba(mix(C.skyBottom, C.near, 0.4), 0.9)], [1, mix(C.near, C.skyBottom, 0.3)]]);
    ctx.fillRect(0, dY + 8, w, h - dY - 8);
    const ref = [];
    for (let x = 3; x < w; x += R(r, 6, 14)) ref.push([x, dY + 12 + r() * 10, R(r, 3, 9), 0.8]);
    rects(ref, rgba(mix(CREAM, C.pipe, 0.4), 0.14));
    if (kind === 'f3') {
      // ferne Schrägseilbrücke: zwei A-Pylone mit Seilfächern, flache Rampen zu beiden Ufern
      const dk = dY - 8;
      ctx.fillStyle = col;
      ctx.fillRect(0, dk, w, 4);
      const pyl = [w * 0.3, w * 0.7], top = h - 150, fan = [], piers = [];
      for (const px of pyl) {
        poly([[px - 9, dk + 4], [px - 1.5, top], [px + 1.5, top], [px + 9, dk + 4]], col);
        poly([[px - 5, dk + 1], [px - 1, top + 30], [px + 1, top + 30], [px + 5, dk + 1]], mix(col, C.skyBottom, 0.5));
        for (let k = 1; k <= 7; k++) { const y = top + 6 + k * 3; fan.push([px, y, px - k * 13, dk], [px, y, px + k * 13, dk]); }
        glow(px, top, 5, mix(C.accent, '#ff5040', 0.5), 0.35);
      }
      for (let x = 20; x < w; x += 46) piers.push([x - 2, dk + 4, 4, h - dk - 4]);
      rects(piers, col);
      segs(fan, rgba(col, 0.75), 0.6);
      const lt = [];
      for (let x = 3; x < w; x += 7) lt.push([x, dk - 0.5, 0.7]);
      dots(lt, rgba(mix(CREAM, '#ffcf7a', 0.5), 0.55));
    } else {
      // Hafenkante mit Kränen und flachen Hallen
      const halls = [];
      let x = 0;
      while (x < w - 10) {
        const hw = R(r, 30, 60), hh = R(r, 14, 30);
        halls.push([x, dY + 8 - hh, hw, hh]);
        x += hw + R(r, 0, 20);
      }
      rects(halls, vgrad(dY - 30, dY + 8, [[0, shade(col, 0.05)], [1, mix(col, C.skyBottom, 0.3)]]));
      rects(halls.map(q => [q[0], q[1], q[2], 1]), rgba(CREAM, 0.06));
      for (let k = 0; k < 3; k++) {
        const cx = (k + 0.3 + r() * 0.4) * w / 3, ct = dY - R(r, 60, 90);
        segs([[cx - 8, dY + 8, cx - 5, ct + 20], [cx + 8, dY + 8, cx + 5, ct + 20]], col, 2);
        ctx.fillStyle = col;
        ctx.fillRect(cx - 34, ct + 16, 52, 4);
        segs([[cx, ct, cx - 30, ct + 16], [cx, ct, cx + 16, ct + 16], [cx, ct, cx, ct + 16]], col, 1);
        glow(cx, ct, 4, mix(C.accent, '#ff5040', 0.5), 0.3);
      }
    }
  }

  // ---------- Neon: Spuren und Ablauf ----------
  // Archetypen der mittleren Spur: Breite und Höhe je Zone (0 Stadtrand, 1 dichter, 2 Innenstadt, 3 Hafen, 4 gemischt)
  const N_ARCH = {
    haus: { w: [170, 260], h: [[60, 90], [64, 96], [64, 96], [60, 90]], paint: nHaus },
    lager: { w: [170, 250], h: [[60, 92], [70, 100], [70, 100], [70, 104]], paint: nLager },
    park: { w: [110, 170], h: [[56, 84], [60, 90], [60, 90], [56, 80]], paint: nPark },
    wohn: { w: [120, 200], h: [[96, 150], [130, 200], [150, 220], [100, 160]], paint: nWohn },
    dach: { w: [110, 170], h: [[110, 160], [140, 220], [180, 240], [120, 180]], paint: nDach },
    buero: { w: [90, 150], h: [[130, 170], [170, 250], [230, 330], [150, 210]], paint: nBuero },
    slim: { w: [92, 150], h: [[170, 220], [210, 280], [270, 356], [200, 260]], paint: nSlim },
    stufen: { w: [120, 180], h: [[160, 210], [190, 260], [250, 350], [180, 240]], paint: nStufen },
    kuppel: { w: [100, 150], h: [[150, 200], [170, 240], [220, 300], [160, 220]], paint: nKuppel },
    tv: { w: [110, 140], h: [[345, 358], [345, 358], [345, 358], [345, 358]], paint: nTV },
    tafel: { w: [100, 160], h: [[100, 150], [130, 200], [170, 240], [120, 180]], paint: nTafel },
    neon: { w: [92, 140], h: [[130, 180], [150, 230], [200, 290], [150, 220]], paint: nNeon },
    kran: { w: [140, 210], h: [[180, 240], [200, 280], [260, 340], [200, 260]], paint: nKran },
    bruecke: { w: [360, 360], h: [[240, 260], [240, 260], [240, 260], [240, 260]], paint: nBruecke },
    hafen: { w: [240, 330], h: [[190, 240], [190, 240], [200, 250], [190, 240]], paint: nHafen }
  };
  const N_GAP = [-10, 60], N_GAP_MEAN = 25;
  // Mindestabstand in Motiven, bevor ein Archetyp wiederkommt (seltene Motive seltener)
  const N_CD = { kuppel: 6, kran: 7, tv: 24, bruecke: 40, hafen: 2, tafel: 2, neon: 2, park: 3, lager: 2 };
  const cooled = (s, i, wts, cd) => {
    const o = {};
    for (const k in wts) { const at = s.at[k] === undefined ? -999 : s.at[k]; if (i - at > (cd[k] || 2)) o[k] = wts[k]; }
    return Object.keys(o).length ? o : wts;
  };
  const N_ZONE = [
    { haus: 3, lager: 2, park: 2, wohn: 3, dach: 1.5, tafel: 0.6 },
    { wohn: 2.5, dach: 2, buero: 2, neon: 1.5, tafel: 1.4, kuppel: 1, kran: 1, haus: 0.4, stufen: 0.8 },
    { slim: 2.6, stufen: 2.4, buero: 2.6, neon: 1.3, tafel: 1, kuppel: 1, dach: 0.6, kran: 0.6 }
  ];
  // gemischte Viertel nach dem Hafen, ihre Reihenfolge wechselt
  const N_DISTRICTS = [
    { z: 2, w: N_ZONE[2] },
    { z: 1, w: N_ZONE[1] },
    { z: 0, w: { haus: 2, wohn: 3, park: 1.5, dach: 2, tafel: 1, neon: 0.8 } },
    { z: 1, w: { buero: 2, neon: 2, tafel: 2, kuppel: 1.2, slim: 1.2, kran: 1 } },
    { z: 3, w: { lager: 2, hafen: 1.5, park: 1, wohn: 1.5, dach: 1.5 } }
  ];
  const N_HARBOR = ['lager', 'hafen', 'park', 'bruecke', 'hafen', 'lager'];

  function nMidPick(i, rng) {
    const s = flow(rng, i, () => ({ x: -30, tv: -99, seq: null, d: -1, dk: N_DISTRICTS.length - 1, at: {} }));
    let a, z;
    // Zonen kürzer als im ersten Entwurf: Schon im ersten Drittel des Levels wird die Stadt dicht und hoch
    if (s.x < 380) { z = 0; a = choose(rng, cooled(s, i, N_ZONE[0], N_CD), s.last, 0); }
    else if (s.x < 950) { z = 1; a = choose(rng, cooled(s, i, N_ZONE[1], N_CD), s.last, 0); }
    else if (s.x < 2100) {
      z = 2;
      a = s.tv < 0 && s.x > 1350 ? 'tv' : choose(rng, cooled(s, i, N_ZONE[2], N_CD), s.last, 0);
    } else if (s.x < 2100 + 1350 && (!s.seq || s.seq.length)) {
      z = 3;
      if (!s.seq) s.seq = N_HARBOR.slice();
      a = s.seq.shift();
    } else {
      // gemischte Viertel, je etwa 1400 px, ohne direkte Wiederholung
      const d = Math.floor(Math.max(0, s.x - 3450) / 1400);
      if (d !== s.d) {
        let k;
        do k = Math.floor(rng() * N_DISTRICTS.length); while (k === s.dk && N_DISTRICTS.length > 1);
        s.d = d;
        s.dk = k;
      }
      const D = N_DISTRICTS[s.dk];
      z = D.z;
      const wts = Object.assign({}, D.w);
      if (z === 2) wts.tv = 0.5;
      a = choose(rng, cooled(s, i, wts, N_CD), s.last, 0);
    }
    if (a === 'tv') s.tv = i;
    s.at[a] = i;
    remember(s, a, 6);
    const A = N_ARCH[a];
    s.x += (A.w[0] + A.w[1]) / 2 + N_GAP_MEAN;
    return a + z;
  }

  const N_FAR_PLAN = ['f0', 'f0', 'f1', 'f2', 'f2tv', 'f2', 'f3', 'f3p', 'f1'];
  function nFarPick(i, rng) {
    const s = flow(rng, i, () => ({ tv: 4, br: 6 }));
    let k;
    if (i < N_FAR_PLAN.length) k = N_FAR_PLAN[i];
    else {
      const wts = { f0: 1, f1: 2, f2: 2.2, f3p: 0.5 };
      if (i - s.tv > 6) wts.f2tv = 0.6;
      if (i - s.br > 9) wts.f3 = 0.4;
      k = choose(rng, wts, s.last, 1);
    }
    if (k === 'f2tv') s.tv = i;
    if (k === 'f3') s.br = i;
    remember(s, k, 4);
    return k;
  }

  function nKinds() {
    const kinds = {};
    for (const a in N_ARCH) {
      const A = N_ARCH[a];
      for (let z = 0; z < 4; z++) {
        kinds[a + z] = {
          size: rng => [R(rng, A.w[0], A.w[1]), R(rng, A.h[z][0], A.h[z][1])],
          paint: (w, h, rng, C) => A.paint(w, h, rng, C, nPal(C)),
          tex: { grain: 0.04 }
        };
      }
    }
    return kinds;
  }
  const nFarKinds = {
    f0: { size: r => [R(r, 320, 360), 150], paint: (w, h, r, C) => nFar(w, h, r, C, 'f0'), tex: { grain: 0.03 } },
    f1: { size: r => [R(r, 320, 360), 220], paint: (w, h, r, C) => nFar(w, h, r, C, 'f1'), tex: { grain: 0.03 } },
    f2: { size: r => [R(r, 320, 360), 330], paint: (w, h, r, C) => nFar(w, h, r, C, 'f2'), tex: { grain: 0.03 } },
    f2tv: { size: r => [R(r, 320, 360), 350], paint: (w, h, r, C) => nFar(w, h, r, C, 'f2tv'), tex: { grain: 0.03 } },
    f3: { size: () => [360, 200], paint: (w, h, r, C) => nFarBay(w, h, r, C, 'f3'), tex: { grain: 0.03 } },
    f3p: { size: r => [R(r, 320, 360), 130], paint: (w, h, r, C) => nFarBay(w, h, r, C, 'f3p'), tex: { grain: 0.03 } }
  };

  SCENE.Neon = {
    hideLayers: [0, 1, 2],
    tracks: [
      { z: 0, factor: 0.12, start: -40, gap: [-10, 20], maxKs: 1.5, pick: nFarPick, base: () => BASE, kinds: nFarKinds },
      { z: 2, factor: 0.35, start: -30, gap: N_GAP, maxKs: 2, pick: nMidPick, base: () => BASE, kinds: nKinds() }
    ]
  };

  // ============================================================
  // Allgemeiner Ablauf: Zonen nach Spur-x, danach wechselnde Abschnitte.
  // opt: { start, zones: [[bis-x, Gewichte]], mixed: [Gewichte], dl, widths, gapMean, cd, once: [{ k, after }] }
  // ============================================================
  function makePick(opt) {
    return (i, rng) => {
      const s = flow(rng, i, () => ({ x: opt.start, at: {}, d: -1, dk: -1, done: {} }));
      let k = null;
      for (const o of opt.once || []) if (!s.done[o.k] && s.x >= o.after) { k = o.k; s.done[o.k] = 1; break; }
      if (!k) {
        let wts = null;
        for (const z of opt.zones) if (s.x < z[0]) { wts = z[1]; break; }
        if (!wts) {
          const d = Math.floor((s.x - opt.zones[opt.zones.length - 1][0]) / opt.dl);
          if (d !== s.d) {
            let q;
            do q = Math.floor(rng() * opt.mixed.length); while (q === s.dk && opt.mixed.length > 1);
            s.d = d;
            s.dk = q;
          }
          wts = opt.mixed[s.dk];
        }
        k = choose(rng, cooled(s, i, wts, opt.cd || {}), [], 0);
      }
      s.at[k] = i;
      s.x += opt.widths[k] + opt.gapMean;
      return k;
    };
  }
  const meanW = kinds => { const o = {}; for (const k in kinds) { const r = mulberry32(7), n = 6; let t = 0; for (let j = 0; j < n; j++) t += kinds[k].size(r)[0]; o[k] = t / n; } return o; };

  // ============================================================
  // UHRWERK: Messing, Kupfer, warmes Dunkel. Mittlere Spur zwischen Zahnradwand und
  // Dampfleitungen: Fabrikhallen und Schlote, dann Zahnradtürme und Pendel,
  // dann Uhrtürme mit großen Zifferblättern (ohne Ziffern) und die Hauptuhr.
  // ============================================================
  const uPal = C => {
    const brass = mix(mix(C.pipe, C.far, 0.4), C.skyBottom, 0.15);
    return {
      stone: mix(mix(C.far, C.near, 0.25), C.skyBottom, 0.18),
      brass, brassL: mix(brass, C.pipeLight, 0.4), brassD: shade(brass, -0.4),
      copper: mix(mix(C.accent, C.far, 0.55), C.skyBottom, 0.15),
      face: mix(CREAM, C.skyBottom, 0.68),
      glow: mix(C.accentLight, C.pipeLight, 0.4),
      win: mix(CREAM, C.accent, 0.35)
    };
  };
  // Mauerwerk: Front mit Verlauf, Schattenseite rechts, Steinlagen, Lichtkante
  function uStone(x, y, w, h, col, C) {
    const sw = Math.max(3, Math.round(w * 0.18)), fw = w - sw;
    ctx.fillStyle = vgrad(y, y + h, [[0, shade(col, 0.1)], [0.6, col], [1, mix(col, C.accent, 0.14)]]);
    ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = vgrad(y, y + h, [[0, shade(col, -0.24)], [1, shade(col, -0.36)]]);
    ctx.fillRect(x + fw, y, sw, h);
    const br = [];
    for (let yy = y + 5; yy < y + h; yy += 5) br.push([x, yy, x + w, yy]);
    segs(br, rgba(INK, 0.1), 0.6);
    rects([[x, y, fw, 1.2]], rgba(C.pipeLight, 0.14));
    rects([[x, y, 1, h]], rgba(C.pipeLight, 0.07));
    return fw;
  }
  // Gesims: vorspringendes Band mit Licht oben
  function uBand(x, y, w, C, P) {
    ctx.fillStyle = vgrad(y, y + 4, [[0, P.brassL], [1, P.brassD]]);
    ctx.fillRect(x - 2, y, w + 4, 4);
  }
  // Zahnrad als ruhende Silhouette (wie die Zahnradwand), mit Speichenfenstern und Nabe
  function uGear(x, y, rad, teeth, body, hole, rim, spokes) {
    const rin = rad - Math.max(2.5, rad * 0.13), step = TAU / teeth;
    ctx.beginPath();
    for (let k = 0; k < teeth; k++) {
      const a0 = k * step, p = (a, rr) => [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
      const p0 = p(a0, rin), p1 = p(a0 + step * 0.12, rad), p2 = p(a0 + step * 0.38, rad), p3 = p(a0 + step * 0.5, rin);
      if (k === 0) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
      ctx.arc(x, y, rin, a0 + step * 0.5, a0 + step);
    }
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    const n = spokes || 5, ro = rin - Math.max(2.5, rad * 0.15), ri = rad * 0.3, gap = Math.min(0.5, 6 / Math.max(1, ro));
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
      ctx.lineWidth = Math.max(1, rad * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, rin - 1, Math.PI * 0.95, Math.PI * 1.6);
      ctx.stroke();
    }
    circle(x, y, ri * 0.55, rgba(INK, 0.15));
    circle(x, y, ri * 0.22, hole);
  }
  // Zifferblatt ohne Ziffern: Messingring, mattes Glas mit Schein, zwölf Stundenbalken, zwei Zeiger
  function uDial(x, y, rad, C, P, r) {
    glow(x, y, rad * 1.3, P.glow, 0.18);
    circle(x + 1.5, y + 2, rad + 3.5, rgba(INK, 0.3));
    circle(x, y, rad + 3.5, rgrad(x - rad * 0.4, y - rad * 0.4, 0, rad * 1.6, [[0, P.brassL], [0.5, P.brass], [1, P.brassD]]));
    circle(x, y, rad, mix(C.far, C.skyBottom, 0.5));
    circle(x, y, rad, rgrad(x - rad * 0.3, y - rad * 0.35, 0, rad * 1.3, [[0, rgba(P.face, 0.62)], [0.7, rgba(mix(P.face, P.glow, 0.4), 0.48)], [1, rgba(mix(P.face, C.far, 0.5), 0.42)]]));
    const bars = [], ticks = [];
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; bars.push([x + Math.cos(a) * rad * 0.74, y + Math.sin(a) * rad * 0.74, x + Math.cos(a) * rad * 0.9, y + Math.sin(a) * rad * 0.9]); }
    if (rad > 26) for (let k = 0; k < 60; k++) if (k % 5) { const a = k * TAU / 60; ticks.push([x + Math.cos(a) * rad * 0.84, y + Math.sin(a) * rad * 0.84, x + Math.cos(a) * rad * 0.9, y + Math.sin(a) * rad * 0.9]); }
    segs(ticks, rgba(INK, 0.25), 0.7);
    segs(bars, rgba(INK, 0.4), Math.max(1.4, rad * 0.07));
    ctx.strokeStyle = rgba(INK, 0.25);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.62, 0, TAU);
    ctx.stroke();
    const ah = r() * TAU, am = r() * TAU, hand = (a, len, wd) => {
      const ex = x + Math.sin(a) * len, ey = y - Math.cos(a) * len;
      line(x - Math.sin(a) * len * 0.15, y + Math.cos(a) * len * 0.15, ex, ey, rgba(INK, 0.55), wd);
    };
    hand(ah, rad * 0.5, Math.max(1.6, rad * 0.08));
    hand(am, rad * 0.76, Math.max(1, rad * 0.05));
    circle(x, y, Math.max(1.5, rad * 0.08), P.brassD);
    ctx.strokeStyle = rgba(CREAM, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, rad + 2, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
  }
  // Fenster mit Rundbogen, warm oder dunkel
  function uArchWins(x0, x1, y0, y1, ww, wh, gx, gy, lit, C, P, r) {
    const nx = Math.max(1, Math.floor((x1 - x0 - ww) / gx) + 1), ox = x0 + (x1 - x0 - ((nx - 1) * gx + ww)) / 2;
    const on = [], off = [];
    for (let y = y0; y + wh <= y1; y += gy) for (let c = 0; c < nx; c++) (r() < lit ? on : off).push([ox + c * gx, y]);
    const pth = list => {
      ctx.beginPath();
      for (const [x, y] of list) { ctx.moveTo(x, y + wh); ctx.lineTo(x, y + ww / 2); ctx.arc(x + ww / 2, y + ww / 2, ww / 2, Math.PI, TAU); ctx.lineTo(x + ww, y + wh); ctx.closePath(); }
    };
    pth(off);
    ctx.fillStyle = rgba(INK, 0.35);
    ctx.fill();
    pth(on);
    ctx.fillStyle = rgba(P.win, 0.5);
    ctx.fill();
  }
  // statischer Rauch: weiche Ballen, nach rechts oben ziehend
  function uSmoke(x, y, C, r, n) {
    const col = mix(C.skyBottom, CREAM, 0.15);
    let sx = x, sy = y;
    for (let k = 0; k < n; k++) {
      const rr = 8 + k * 5;
      soft(sx, sy, rr * 1.3, rr * 0.8, col, 0.22 - k * 0.025);
      sx += 6 + k * 3 + r() * 4;
      sy -= 8 + k * 2;
    }
  }

  // Uhrturm: Schaft aus Stein, Zifferblatt, Dach (spitz, Kuppel, Zinnen oder Laterne)
  function uUhrturm(w, h, r, C, P, great) {
    const roofT = great ? 'spitz' : PK(r, ['spitz', 'kuppel', 'zinnen', 'laterne']), tw = w * (great ? 0.62 : 0.78), tx = (w - tw) / 2;
    const roofH = roofT === 'spitz' ? tw * (great ? 1.5 : 1.1) : roofT === 'kuppel' ? tw * 0.7 : roofT === 'laterne' ? tw * 0.95 : 10;
    const top = roofH + 6, stone = mix(P.stone, C.far, R(r, 0, 0.2));
    if (great) {
      // Seitenflügel mit Zahnrädern
      const ww = (w - tw) / 2 + 6, wy = h * 0.55;
      for (const x0 of [0, w - ww]) {
        uStone(x0, wy, ww, h - wy, shade(stone, -0.05), C);
        uBand(x0, wy, ww, C, P);
        uGear(x0 + ww / 2, wy - 12, 16, 12, P.brass, mix(P.brassD, C.far, 0.4), rgba(C.pipeLight, 0.3), 4);
      }
    }
    const fw = uStone(tx, top, tw, h - top, stone, C);
    uBand(tx, top, tw, C, P);
    const dy = top + tw * 0.62, dr = tw * (great ? 0.4 : 0.36);
    uBand(tx, dy + dr + 8, tw, C, P);
    uArchWins(tx + 5, tx + fw - 4, dy + dr + 18, h - 30, 4, 10, 9, 22, 0.35, C, P, r);
    uDial(tx + fw / 2, dy, dr, C, P, r);
    const cx = tx + fw / 2;
    if (roofT === 'spitz') {
      poly([[tx - 3, top + 1], [cx, 2], [tx + tw + 3, top + 1]], vgrad(0, top, [[0, P.copper], [1, shade(P.copper, -0.2)]]));
      poly([[cx, 2], [tx + tw + 3, top + 1], [cx + tw * 0.12, top + 1]], rgba(INK, 0.22));
      line(cx, 2, tx - 2, top, rgba(CREAM, 0.16), 1);
      if (great) { line(cx, 2, cx, -0, P.brassL, 1); }
    } else if (roofT === 'kuppel') {
      ctx.beginPath();
      ctx.ellipse(cx, top + 1, tw / 2 + 2, roofH - 6, 0, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = rgrad(cx - tw * 0.2, top - roofH * 0.6, 1, tw, [[0, P.brassL], [0.6, P.copper], [1, shade(P.copper, -0.3)]]);
      ctx.fill();
      line(cx, top - roofH + 6, cx, 2, P.brassL, 1.4);
      circle(cx, 3, 2, P.brassL);
    } else if (roofT === 'laterne') {
      const lw = tw * 0.5;
      uStone(cx - lw / 2, top - roofH * 0.6, lw, roofH * 0.6, shade(stone, 0.05), C);
      rects([[cx - lw * 0.25, top - roofH * 0.5, lw * 0.3, roofH * 0.35]], rgba(P.win, 0.45));
      poly([[cx - lw / 2 - 3, top - roofH * 0.6 + 1], [cx, 2], [cx + lw / 2 + 3, top - roofH * 0.6 + 1]], P.copper);
      uBand(tx, top, tw, C, P);
    } else {
      const cr = [];
      for (let x = tx - 2; x < tx + tw; x += 7) cr.push([x, top - 6, 4, 7]);
      rects(cr, shade(stone, 0.05));
      line(cx, top - 6, cx, 2, P.brassD, 1.2);
      poly([[cx, 3], [cx + 12, 7], [cx, 11]], P.copper);
    }
  }

  // Zahnradturm: Stahlgerüst mit mehreren kämmenden Zahnrädern, oben ein Getriebehaus
  function uZahnturm(w, h, r, C, P) {
    const top = 28, x0 = 8, x1 = w - 10, beam = mix(P.brassD, C.far, 0.3), lit = mix(P.brass, C.far, 0.2);
    const posts = [x0, x1];
    if (w > 130) posts.splice(1, 0, (x0 + x1) / 2);
    const br = [];
    for (let y = top + 10; y < h; y += 40) for (let k = 0; k < posts.length - 1; k++) br.push([posts[k], y, posts[k + 1], y + 40], [posts[k + 1], y, posts[k], y + 40]);
    segs(br, rgba(beam, 0.7), 1.4);
    for (const px of posts) {
      ctx.fillStyle = hgrad(px - 3, px + 3, [[0, lit], [1, shade(beam, -0.2)]]);
      ctx.fillRect(px - 3, top, 6, h - top);
    }
    const hb = [];
    for (let y = top + 10; y < h; y += 40) hb.push([x0 - 3, y, x1 - x0 + 6, 4]);
    rects(hb, beam);
    // Zahnräder: von oben nach unten, abwechselnd links und rechts, kämmend
    let gy = top + 30, gx = w * R(r, 0.35, 0.5), prev = null;
    const body = P.brass, hole = mix(P.brassD, C.far, 0.5), rim = rgba(C.pipeLight, 0.3);
    while (gy < h - 60) {
      const rad = R(r, 16, Math.min(46, w * 0.36));
      if (prev) {
        const d = prev.r + rad - 3, ang = R(r, 0.6, 1.2) * (r() < 0.5 ? 1 : -1);
        gx = clamp(prev.x + Math.sin(ang) * d, rad + 2, w - rad - 2);
        gy = prev.y + Math.abs(Math.cos(ang)) * d;
      }
      if (gy > h - 50) break;
      uGear(gx + 2, gy + 2.5, rad, Math.max(8, Math.round(rad / 2.6)), rgba(INK, 0.22), rgba(INK, 0), null, 5);
      uGear(gx, gy, rad, Math.max(8, Math.round(rad / 2.6)), body, hole, rim, rad > 24 ? 5 : 4);
      line(gx, gy, gx > w / 2 ? x1 : x0, gy, rgba(beam, 0.8), 2);
      prev = { x: gx, y: gy, r: rad };
    }
    // Getriebehaus oben
    const fw = uStone(2, 4, w - 4, top, P.stone, C);
    uBand(2, top, w - 4, C, P);
    rects([[8, 10, fw - 12, 6]], rgba(P.win, 0.3));
    line(w * 0.5, 4, w * 0.5, 0, P.brassD, 1);
  }

  // Pendelgerüst: Portal mit Getriebekasten, langes Pendel mit Messingscheibe, Gradbogen
  function uPendel(w, h, r, C, P) {
    const pw = 12, top = 34, stone = P.stone, cx = w / 2, piv = top + 14;
    uStone(0, top, pw, h - top, stone, C);
    uStone(w - pw, top, pw, h - top, stone, C);
    const fw = uStone(0, 6, w, top - 4, shade(stone, 0.04), C);
    uBand(0, top, w, C, P);
    uGear(fw * 0.3, 18, 13, 11, P.brass, mix(P.brassD, C.far, 0.5), null, 4);
    uGear(fw * 0.3 + 21, 22, 9, 9, P.brassL, mix(P.brassD, C.far, 0.5), null, 3);
    rects([[fw * 0.62, 12, fw * 0.25, 10]], rgba(P.win, 0.35));
    // Bogen unter dem Querbalken
    ctx.strokeStyle = shade(stone, -0.1);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, top + 8, (w - pw * 2) / 2, Math.PI, TAU);
    ctx.stroke();
    // Pendel, ruhend leicht ausgelenkt
    const len = h - piv - R(r, 70, 100), a = R(r, -0.14, 0.14), bx = cx + Math.sin(a) * len, by = piv + Math.cos(a) * len, br = Math.min(w * 0.2, 24);
    line(cx, piv, bx, by, P.brassD, 3);
    line(cx - 0.8, piv, bx - 0.8, by, rgba(C.pipeLight, 0.3), 0.8);
    circle(bx + 2, by + 3, br, rgba(INK, 0.25));
    circle(bx, by, br, rgrad(bx - br * 0.35, by - br * 0.35, 0, br * 1.2, [[0, P.brassL], [0.55, P.brass], [1, P.brassD]]));
    ctx.strokeStyle = rgba(INK, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.7, 0, TAU);
    ctx.stroke();
    circle(cx, piv, 4, P.brassL);
    // Gradbogen
    const ar = len + br + 10, tk = [];
    ctx.strokeStyle = rgba(P.brassL, 0.55);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, piv, ar, Math.PI / 2 - 0.22, Math.PI / 2 + 0.22);
    ctx.stroke();
    for (let k = -4; k <= 4; k++) { const aa = Math.PI / 2 + k * 0.05; tk.push([cx + Math.cos(aa) * ar, piv + Math.sin(aa) * ar, cx + Math.cos(aa) * (ar + (k % 2 ? 3 : 6)), piv + Math.sin(aa) * (ar + (k % 2 ? 3 : 6))]); }
    segs(tk, rgba(P.brassL, 0.55), 1);
  }

  // Fabrikhalle: Shed- oder Satteldach, große Rundbogenfenster mit warmem Licht, Rundfenster
  function uHalle(w, h, r, C, P) {
    const saw = r() < 0.5, wallTop = h * R(r, 0.32, 0.42), stone = mix(P.stone, C.accent, 0.06);
    const fw = uStone(0, wallTop, w, h - wallTop, stone, C);
    if (saw) {
      const n = Math.max(3, Math.round(w / 46)), tw = fw / n, rh = 22;
      for (let k = 0; k < n; k++) {
        const x = k * tw;
        poly([[x, wallTop + 1], [x + tw * 0.78, wallTop - rh], [x + tw * 0.8, wallTop - rh], [x + tw * 0.8, wallTop + 1]], shade(stone, -0.06));
        poly([[x + tw * 0.8, wallTop - rh], [x + tw, wallTop + 1], [x + tw * 0.8, wallTop + 1]], rgba(P.win, 0.35));
        line(x + 1, wallTop, x + tw * 0.78, wallTop - rh, rgba(C.pipeLight, 0.2), 1);
      }
    } else {
      const gh = Math.min(wallTop - 4, fw * 0.32);
      poly([[-1, wallTop + 1], [fw / 2, wallTop - gh], [fw + 1, wallTop + 1]], shade(stone, 0.04));
      line(0, wallTop, fw / 2, wallTop - gh, rgba(C.pipeLight, 0.22), 1.2);
      const ox = fw / 2, oy = wallTop - gh * 0.42, orr = Math.min(gh * 0.3, 14);
      circle(ox, oy, orr + 2, P.brassD);
      circle(ox, oy, orr, rgba(P.win, 0.5));
      segs([[ox - orr, oy, ox + orr, oy], [ox, oy - orr, ox, oy + orr]], rgba(INK, 0.45), 1);
    }
    uBand(0, wallTop, fw, C, P);
    uArchWins(6, fw - 6, wallTop + 14, h - 40, 12, 34, 20, 44, 0.55, C, P, r);
    const mul = [];
    for (let x = 6; x < fw - 6; x += 4) mul.push([x, wallTop + 30, x, wallTop + 31]);
    if (r() < 0.6) {
      const cx = R(r, fw * 0.6, fw - 14), ch = R(r, 40, 70);
      uStone(cx, wallTop - ch, 10, ch, shade(stone, 0.05), C);
      rects([[cx - 1, wallTop - ch, 12, 3]], P.copper);
      uSmoke(cx + 5, wallTop - ch - 8, C, r, 4);
    }
  }

  // Schlote: zwei bis drei verjüngte Ziegelschlote mit Kupferbändern auf einem Kesselhaus, ruhiger Rauch
  function uSchlot(w, h, r, C, P) {
    const baseH = R(r, 60, 90), n = w > 90 ? 3 : 2, stone = mix(P.stone, C.accent, 0.1);
    const xs = [];
    for (let k = 0; k < n; k++) xs.push((k + 0.5) * w / n + R(r, -5, 5));
    const tops = xs.map((x, k) => k === 1 || n === 2 && k === 0 ? R(r, 34, 60) : R(r, 60, h * 0.3));
    xs.forEach((x, k) => {
      const t = tops[k], b0 = R(r, 12, 16), b1 = b0 * 0.68;
      poly([[x - b0, h - baseH], [x - b1, t], [x + b1, t], [x + b0, h - baseH]], hgrad(x - b0, x + b0, [[0, shade(stone, 0.12)], [0.45, stone], [1, shade(stone, -0.3)]]));
      const bands = [];
      for (let y = t + 12; y < h - baseH - 10; y += R(r, 30, 50)) { const f = (y - t) / (h - baseH - t), hw = lerp(b1, b0, f); bands.push([x - hw - 0.5, y, hw * 2 + 1, 2.5]); }
      rects(bands, P.copper);
      rects([[x - b1 - 2, t, b1 * 2 + 4, 4]], P.brassD);
      uSmoke(x, t - 8, C, r, 5);
    });
    const fw = uStone(0, h - baseH, w, baseH, shade(stone, -0.04), C);
    uBand(0, h - baseH, fw, C, P);
    uArchWins(5, fw - 5, h - baseH + 10, h - 20, 7, 18, 13, 30, 0.5, C, P, r);
  }

  // Große Wanduhr: Zifferblatt auf einem Pfeiler, dahinter halb verdeckte Zahnräder
  function uWanduhr(w, h, r, C, P) {
    const dr = w * R(r, 0.34, 0.4), cx = w * 0.47, dy = dr + 8, stone = P.stone;
    uGear(cx + dr * 0.9, dy + dr * 0.55, dr * 0.55, 14, mix(P.brassD, C.far, 0.25), mix(P.brassD, C.far, 0.6), null, 5);
    uGear(cx - dr * 0.95, dy + dr * 0.35, dr * 0.42, 12, mix(P.brassD, C.far, 0.35), mix(P.brassD, C.far, 0.6), null, 4);
    const pw = dr * 1.2, fw = uStone(cx - pw / 2, dy, pw, h - dy, stone, C);
    uBand(cx - pw / 2, dy + dr + 10, pw, C, P);
    uArchWins(cx - pw / 2 + 5, cx - pw / 2 + fw - 5, dy + dr + 22, h - 30, 5, 12, 11, 26, 0.3, C, P, r);
    uDial(cx, dy, dr, C, P, r);
  }

  // Wasserturm: genieteter Kupferbehälter mit Kegeldach auf einem Stahlgerüst, Leiter und Fallrohr
  function uWasserturm(w, h, r, C, P) {
    const tw = w * 0.8, tx = (w - tw) / 2, th = tw * R(r, 0.6, 0.8), ty = 18, legT = ty + th, beam = mix(P.brassD, C.far, 0.25);
    const lx = [tx + 4, tx + tw * 0.35, tx + tw * 0.65, tx + tw - 4], br = [];
    for (let y = legT; y < h; y += 34) br.push([lx[0], y, lx[3], y + 34], [lx[3], y, lx[0], y + 34], [lx[0], y, lx[3], y]);
    segs(br, rgba(beam, 0.6), 1.1);
    segs(lx.map((x, k) => [x, legT, x + (k - 1.5) * 4, h]), beam, 3);
    line(tx + tw * 0.5, legT, tx + tw * 0.5, h, mix(P.copper, C.far, 0.3), 4);
    ctx.fillStyle = hgrad(tx, tx + tw, [[0, mix(P.copper, P.brassL, 0.3)], [0.4, P.copper], [1, shade(P.copper, -0.35)]]);
    ctx.fillRect(tx, ty, tw, th);
    const rv = [];
    for (let y = ty + 6; y < ty + th; y += 9) for (let x = tx + 3; x < tx + tw; x += 5) rv.push([x, y, 0.8]);
    dots(rv, rgba(CREAM, 0.12));
    rects([[tx, ty + th * 0.33, tw, 1.5], [tx, ty + th * 0.66, tw, 1.5]], rgba(INK, 0.25));
    poly([[tx - 3, ty + 1], [tx + tw / 2, 2], [tx + tw + 3, ty + 1]], vgrad(0, ty, [[0, P.brassL], [1, P.brassD]]));
    const lad = [];
    for (let y = ty; y < h; y += 5) lad.push([tx + tw - 10, y, tx + tw - 5, y]);
    segs(lad, rgba(beam, 0.5), 0.6);
    segs([[tx + tw - 10, ty, tx + tw - 10, h], [tx + tw - 5, ty, tx + tw - 5, h]], rgba(beam, 0.7), 0.8);
  }

  // Rohrbrücke: zwei Gittermasten tragen gebündelte Rohre mit Flanschen und einem Handrad
  function uRohrbruecke(w, h, r, C, P) {
    const py = 30, n = 2 + (r() < 0.5 ? 1 : 0), beam = mix(P.brassD, C.far, 0.25), metal = P.brass;
    for (const mx of [w * 0.16, w * 0.84]) {
      const br = [];
      for (let y = py + 20; y < h; y += 22) br.push([mx - 8, y, mx + 8, y + 22], [mx + 8, y, mx - 8, y + 22]);
      segs(br, rgba(beam, 0.6), 1);
      segs([[mx - 9, h, mx - 6, py + 16], [mx + 9, h, mx + 6, py + 16]], beam, 2.4);
      rects([[mx - 12, py + 14, 24, 4]], beam);
    }
    for (let k = 0; k < n; k++) {
      const y = py + k * 11 - (n - 1) * 5, d = 4 - k * 0.5;
      ctx.fillStyle = vgrad(y - d, y + d, [[0, P.brassD], [0.3, mix(metal, P.brassL, 0.4)], [0.55, metal], [1, shade(P.brassD, -0.2)]]);
      ctx.fillRect(0, y - d, w, d * 2);
      for (let x = R(r, 10, 30); x < w - 6; x += R(r, 40, 70)) rects([[x - 2, y - d - 2, 4, d * 2 + 4]], P.copper);
      // Rohrenden knicken nach unten ab
      const ex = k % 2 ? 6 : w - 6;
      ctx.fillStyle = hgrad(ex - d, ex + d, [[0, mix(metal, P.brassL, 0.4)], [1, P.brassD]]);
      ctx.fillRect(ex - d, y, d * 2, h - y);
    }
    const vx = R(r, w * 0.3, w * 0.7);
    line(vx, py - 8, vx, py - 18, P.brassD, 2);
    ctx.strokeStyle = P.copper;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(vx, py - 20, 9, 3, 0, 0, TAU);
    ctx.stroke();
    segs([[vx - 9, py - 20, vx + 9, py - 20]], P.brassL, 1);
    const g = [];
    for (let k = 0; k < 2; k++) g.push(R(r, 20, w - 20));
    for (const gx of g) { circle(gx, py + 16, 5, P.brassD); circle(gx, py + 16, 3.6, rgba(P.face, 0.6)); }
  }

  // Glockenturm: offene Glockenstube mit Glocke, Pyramidendach, schmale Fenster
  function uGlocke(w, h, r, C, P) {
    const tw = w * 0.76, tx = (w - tw) / 2, roofH = tw * 0.8, bt = roofH + 4, bh = tw * 0.9, stone = mix(P.stone, C.far, 0.1);
    const fw = uStone(tx, bt, tw, h - bt, stone, C);
    // Glockenstube
    const ox = tx + fw * 0.2, ow = fw * 0.6, oy = bt + 10;
    ctx.beginPath();
    ctx.moveTo(ox, oy + bh * 0.8);
    ctx.lineTo(ox, oy + ow / 2);
    ctx.arc(ox + ow / 2, oy + ow / 2, ow / 2, Math.PI, TAU);
    ctx.lineTo(ox + ow, oy + bh * 0.8);
    ctx.closePath();
    ctx.fillStyle = mix(C.skyTop, C.far, 0.3);
    ctx.fill();
    const bc = ox + ow / 2, by = oy + ow * 0.35, bwid = ow * 0.36;
    line(bc - ow / 2, by - 4, bc + ow / 2, by - 4, P.brassD, 2);
    ctx.beginPath();
    ctx.moveTo(bc - bwid * 0.45, by);
    ctx.quadraticCurveTo(bc - bwid * 0.5, by + bwid * 0.9, bc - bwid, by + bwid * 1.25);
    ctx.lineTo(bc + bwid, by + bwid * 1.25);
    ctx.quadraticCurveTo(bc + bwid * 0.5, by + bwid * 0.9, bc + bwid * 0.45, by);
    ctx.closePath();
    ctx.fillStyle = hgrad(bc - bwid, bc + bwid, [[0, P.brassL], [0.4, P.brass], [1, P.brassD]]);
    ctx.fill();
    circle(bc, by + bwid * 1.3, 2, P.brassD);
    uBand(tx, oy + bh * 0.8, tw, C, P);
    uBand(tx, bt, tw, C, P);
    uArchWins(tx + 6, tx + fw - 5, oy + bh * 0.8 + 16, h - 30, 4, 12, 10, 30, 0.3, C, P, r);
    poly([[tx - 4, bt + 1], [tx + tw / 2, 3], [tx + tw + 4, bt + 1]], vgrad(0, bt, [[0, P.copper], [1, shade(P.copper, -0.25)]]));
    poly([[tx + tw / 2, 3], [tx + tw + 4, bt + 1], [tx + tw * 0.62, bt + 1]], rgba(INK, 0.2));
    line(tx + tw / 2, 3, tx + tw / 2, 0, P.brassL, 1);
  }

  const U_KINDS = {
    uhrturm: { size: r => [R(r, 70, 100), R(r, 250, 330)], paint: (w, h, r, C) => uUhrturm(w, h, r, C, uPal(C), false) },
    hauptuhr: { size: r => [R(r, 150, 170), R(r, 348, 358)], paint: (w, h, r, C) => uUhrturm(w, h, r, C, uPal(C), true) },
    zahnturm: { size: r => [R(r, 100, 150), R(r, 260, 340)], paint: (w, h, r, C) => uZahnturm(w, h, r, C, uPal(C)) },
    pendel: { size: r => [R(r, 100, 140), R(r, 260, 330)], paint: (w, h, r, C) => uPendel(w, h, r, C, uPal(C)) },
    halle: { size: r => [R(r, 200, 300), R(r, 190, 240)], paint: (w, h, r, C) => uHalle(w, h, r, C, uPal(C)) },
    schlot: { size: r => [R(r, 90, 140), R(r, 300, 355)], paint: (w, h, r, C) => uSchlot(w, h, r, C, uPal(C)) },
    wanduhr: { size: r => [R(r, 130, 170), R(r, 240, 300)], paint: (w, h, r, C) => uWanduhr(w, h, r, C, uPal(C)) },
    wasserturm: { size: r => [R(r, 70, 100), R(r, 220, 290)], paint: (w, h, r, C) => uWasserturm(w, h, r, C, uPal(C)) },
    rohrbruecke: { size: r => [R(r, 200, 300), R(r, 200, 250)], paint: (w, h, r, C) => uRohrbruecke(w, h, r, C, uPal(C)) },
    glocke: { size: r => [R(r, 80, 110), R(r, 250, 320)], paint: (w, h, r, C) => uGlocke(w, h, r, C, uPal(C)) }
  };
  for (const k in U_KINDS) {
    const K = U_KINDS[k], fn = K.paint;
    K.tex = { grain: 0.05 };
    K.paint = (w, h, r, C, L, it) => {
      fn(w, h, r, C, L, it);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = vgrad(0, h, [[0, rgba(C.haze, 0.16)], [0.6, rgba(C.haze, 0.3)], [1, rgba(C.haze, 0.45)]]);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };
  }
  const U_GAP = [40, 170];
  SCENE.Uhrwerk = {
    tracks: [{
      z: 1, factor: 0.3, start: 60, gap: U_GAP, maxKs: 2, base: () => BASE, kinds: U_KINDS,
      pick: makePick({
        start: 60, dl: 1100, gapMean: (U_GAP[0] + U_GAP[1]) / 2, widths: meanW(U_KINDS),
        cd: { hauptuhr: 99, wanduhr: 4, pendel: 3, glocke: 4, rohrbruecke: 3, halle: 2, wasserturm: 3 },
        zones: [
          [800, { halle: 3, schlot: 3, wasserturm: 2, rohrbruecke: 2 }],
          [1600, { zahnturm: 3, pendel: 2.5, rohrbruecke: 1.5, wanduhr: 1, schlot: 1, halle: 1 }],
          [2500, { uhrturm: 3, wanduhr: 2, glocke: 1.5, zahnturm: 1, pendel: 1 }]
        ],
        mixed: [
          { halle: 2, schlot: 2, wasserturm: 1.5, rohrbruecke: 1.5, zahnturm: 1 },
          { zahnturm: 2.5, pendel: 2, wanduhr: 1.5, rohrbruecke: 1, uhrturm: 1 },
          { uhrturm: 2.5, glocke: 1.5, wanduhr: 1.5, pendel: 1, schlot: 1 }
        ],
        once: [{ k: 'hauptuhr', after: 1950 }]
      })
    }]
  };

  // ============================================================
  // STURM: Gewitter, dunkles Violett. Mittlere Spur mit Landmarken auf Hügeln und Klippen
  // (Windmühle, Gehöft, Ruinen, Hinkelsteine, Klippen, Leuchtturm), nahe Spur mit
  // wenigen windgebeugten Bäumen. Wind und Regen kommen von rechts, alles neigt sich nach links.
  // ============================================================
  const sPal = C => {
    const rock = mix(C.near, C.far, 0.5);
    return {
      rock,
      grass: mix(rock, '#6f8a4a', 0.3),
      wall: mix(rock, CREAM, 0.14),
      white: mix(CREAM, C.skyBottom, 0.45),
      wood: mix(C.near, '#8a6a4a', 0.3),
      glow: mix(CREAM, '#ffd27a', 0.4)
    };
  };
  // Höhe des Umrisses an der Stelle x (lineare Interpolation)
  function yAt(top, x) {
    if (x <= top[0][0]) return top[0][1];
    for (let k = 0; k < top.length - 1; k++) if (x <= top[k + 1][0]) return lerp(top[k][1], top[k + 1][1], (x - top[k][0]) / Math.max(0.01, top[k + 1][0] - top[k][0]));
    return top[top.length - 1][1];
  }
  // Felsmasse oder Hügel: Umriss oben (Punkte von links nach rechts), gefüllt bis h.
  // Licht von links oben: helle Oberkante, Schatten unter steil abfallenden Kanten, Facettenlinien, Risse.
  function sMass(top, h, C, P, r, o) {
    o = o || {};
    const x0 = top[0][0], x1 = top[top.length - 1][0], col = o.col || P.rock;
    const pts = [[x0, h + 2]].concat(top, [[x1, h + 2]]);
    let minY = h;
    for (const q of top) minY = Math.min(minY, q[1]);
    poly(pts, vgrad(minY, h, [[0, shade(col, 0.12)], [0.45, col], [1, mix(shade(col, -0.18), C.haze, 0.22)]]));
    const sh = [];
    for (let k = 0; k < top.length - 1; k++) {
      const [ax, ay] = top[k], [bx, by] = top[k + 1];
      if (by - ay > 4 && by - ay > (bx - ax) * 0.7) sh.push([[ax, ay], [bx, by], [bx, h], [ax, h]]);
    }
    fillPolys(sh, rgba(INK, 0.16));
    if (o.rock !== false) {
      const dl = [], ll = [], cr = [];
      for (let x = x0 + R(r, 4, 10); x < x1 - 3; x += R(r, 7, 16)) {
        const y = yAt(top, x) + 2, d = R(r, -3, 3);
        dl.push([x, y, x + d, h]);
        if (r() < 0.6) ll.push([x + 1.3, y + R(r, 2, 8), x + 1.3 + d * 0.4, y + R(r, 16, 50)]);
      }
      for (let k = 0, n = Math.round((x1 - x0) / 14); k < n; k++) {
        const x = R(r, x0 + 4, x1 - 4), y0 = yAt(top, x) + 8;
        if (y0 > h - 10) continue;
        const y = R(r, y0, h - 6);
        cr.push([x, y, x + R(r, -6, 6), y + R(r, -1, 2)]);
      }
      segs(dl, rgba(INK, 0.2), 1);
      segs(ll, rgba(CREAM, 0.06), 1);
      segs(cr, rgba(INK, 0.18), 0.9);
    }
    if (o.grass !== false) {
      const gt = [];
      for (let k = 0; k < top.length - 1; k++) {
        const [ax, ay] = top[k], [bx, by] = top[k + 1];
        if (Math.abs(by - ay) < (bx - ax) * 1.1) gt.push([ax, ay, bx, by]);
      }
      segs(gt, P.grass, 3);
      const tufts = [];
      for (const [ax, ay, bx, by] of gt) for (let x = ax; x < bx; x += R(r, 6, 12)) { const y = lerp(ay, by, (x - ax) / Math.max(1, bx - ax)); tufts.push([x, y + 1, x - R(r, 2, 5), y - R(r, 2, 6)]); }
      segs(tufts, P.grass, 1);
    }
    const lit = [];
    for (let k = 0; k < top.length - 1; k++) { const [ax, ay] = top[k], [bx, by] = top[k + 1]; if (by < ay) lit.push([ax, ay, bx, by]); }
    segs(lit, rgba(CREAM, 0.13), 1);
  }
  // Umriss mit Zufallszacken zwischen Stützpunkten
  function sProfile(keys, r, jag) {
    const out = [];
    for (let k = 0; k < keys.length - 1; k++) {
      const [ax, ay] = keys[k], [bx, by] = keys[k + 1], n = Math.max(1, Math.round((bx - ax) / 12));
      for (let j = 0; j < n; j++) { const t = j / n; out.push([lerp(ax, bx, t), lerp(ay, by, t) + (j ? (r() - 0.5) * jag : 0)]); }
    }
    out.push(keys[keys.length - 1]);
    return out;
  }
  // windgebeugter Baum: Stamm biegt sich nach links, alle Äste nach links, Laub in flachen Ballen an den Astenden
  function sTree(x, base, hh, C, col, r) {
    const lean = hh * R(r, 0.26, 0.38), p0 = [x, base + 2], p1 = [x + hh * 0.04, base - hh * 0.4], p2 = [x - lean, base - hh * 0.76];
    const bz = t => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
    const tw0 = Math.max(2.4, hh * 0.04), N = 12, Ls = [], Rs = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, a = bz(t), b2 = bz(Math.min(1, t + 0.02)), dx = b2[0] - a[0], dy = b2[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, wd = tw0 * (1 - t * 0.65) * (k === 0 ? 1.35 : 1);
      Ls.push([a[0] + nx * wd, a[1] + ny * wd]);
      Rs.push([a[0] - nx * wd, a[1] - ny * wd]);
    }
    poly(Ls.concat(Rs.reverse()), hgrad(x - lean, x + tw0 * 2, [[0, shade(col, 0.06)], [1, shade(col, -0.28)]]));
    // Äste aus dem oberen Stamm, oben am längsten, fast waagerecht nach links (Fahnenform)
    const tips = [[p2[0], p2[1], hh * 0.12]];
    ctx.strokeStyle = col;
    for (let k = 0; k < 5; k++) {
      const [bx, by] = bz(0.58 + k * 0.1), len = hh * (0.16 + k * 0.07) * R(r, 0.85, 1.15);
      const ex = bx - len, ey = by - len * R(r, 0, 0.16);
      ctx.lineWidth = Math.max(1, tw0 * (0.8 - k * 0.1));
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx - len * 0.45, by - len * 0.12, ex, ey);
      ctx.stroke();
      tips.push([ex, ey, len], [bx - len * 0.55, by - len * 0.08, len * 0.5]);
    }
    // Laub: flache Ellipsen, leeseitig kleiner, mit dunkler Unterseite und fahler Oberkante
    const cl = [];
    for (const [ex, ey, len] of tips) {
      const cr = hh * R(r, 0.05, 0.075) * (len > hh * 0.2 ? 1 : 0.85);
      for (let j = 0; j < 4; j++) cl.push([ex + R(r, -cr * 1.4, cr * 1.2), ey + R(r, -cr * 0.35, cr * 0.3), cr * R(r, 1.1, 1.6), cr * R(r, 0.6, 0.85), R(r, -0.15, 0.1)]);
    }
    ellipses(cl, col);
    ellipses(cl.filter((q, j) => j % 3 === 1).map(([a, b2, rx, ry, rot]) => [a + rx * 0.15, b2 + ry * 0.45, rx * 0.7, ry * 0.5, rot]), rgba(INK, 0.2));
    ellipses(cl.filter((q, j) => j % 2 === 0).map(([a, b2, rx, ry, rot]) => [a - rx * 0.2, b2 - ry * 0.4, rx * 0.6, ry * 0.45, rot]), rgba(mix(col, CREAM, 0.3), 0.22));
  }
  // zarte Regenstriche nur auf dem Motiv (source-atop), damit es im Gewitter steht
  function sAtmos(w, h, C, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const rain = [];
    for (let k = 0, n = Math.round(w * h / 1600); k < n; k++) { const x = r() * (w + 40), y = r() * h, len = R(r, 10, 22); rain.push([x, y, x - len * 0.25, y + len]); }
    segs(rain, rgba(mix(CREAM, C.skyBottom, 0.4), 0.1), 0.8);
    ctx.restore();
  }

  // Klippen: steile Felsnase mit Plateau, manchmal eine Felsnadel daneben
  function sKlippe(w, h, r, C, P) {
    const right = r() < 0.5, top = R(r, 6, 30), stack = r() < 0.45;
    const keys = right
      ? [[0, h - R(r, 10, 40)], [w * 0.14, h * R(r, 0.4, 0.55)], [w * 0.26, top + 14], [w * 0.5, top], [w * 0.62, top + 10], [w * 0.66, h * 0.5], [w * 0.7, h * 0.56], [w * 0.74, h * 0.82], [stack ? w * 0.76 : w, h - 6]]
      : [[stack ? w * 0.24 : 0, h - 6], [w * 0.26, h * 0.8], [w * 0.3, h * 0.55], [w * 0.36, h * 0.48], [w * 0.4, top + 12], [w * 0.55, top], [w * 0.76, top + 16], [w * 0.88, h * 0.5], [w, h - R(r, 10, 40)]];
    if (stack) {
      const sx = right ? w * 0.88 : w * 0.11, sw = w * 0.07, st = h * R(r, 0.35, 0.5);
      sMass(sProfile([[sx - sw, h], [sx - sw * 0.6, st + 10], [sx - sw * 0.1, st], [sx + sw * 0.5, st + 6], [sx + sw, h]], r, 5), h, C, P, r, { grass: false });
    }
    sMass(sProfile(keys, r, 7), h, C, P, r);
  }

  // Leuchtturm auf der Klippe: rot-weiß gebänderter Turm (gedämpft), Galerie, Laterne mit schwachem Schein, Wärterhaus
  function sLeucht(w, h, r, C, P) {
    const tx = w * R(r, 0.4, 0.5), plat = h * R(r, 0.5, 0.58), tb = 15, tt = 9, tTop = 40;
    const keys = [[0, h - 14], [w * 0.12, h * 0.75], [w * 0.2, plat + 8], [tx - 30, plat], [tx + 50, plat + 4], [w * 0.78, plat + 10], [w * 0.82, h * 0.72], [w * 0.88, h * 0.8], [w, h - 10]];
    sMass(sProfile(keys, r, 5), h, C, P, r);
    // Wärterhaus
    const hx = tx + 18, hw = 34, hh = 20;
    poly([[hx, plat + 2], [hx, plat - hh], [hx + hw, plat - hh], [hx + hw, plat + 2]], hgrad(hx, hx + hw, [[0, shade(P.wall, 0.08)], [1, shade(P.wall, -0.2)]]));
    poly([[hx - 3, plat - hh + 1], [hx + hw * 0.5, plat - hh - 12], [hx + hw + 3, plat - hh + 1]], mix(P.rock, C.far, 0.4));
    rects([[hx + 6, plat - hh + 6, 5, 6]], rgba(P.glow, 0.45));
    rects([[hx + hw - 12, plat - hh + 6, 5, 6]], rgba(INK, 0.4));
    // Turm, verjüngt, gebändert
    const body = [[tx - tb, plat + 3], [tx - tt, tTop], [tx + tt, tTop], [tx + tb, plat + 3]];
    poly(body, hgrad(tx - tb, tx + tb, [[0, shade(P.white, 0.05)], [0.5, P.white], [1, shade(P.white, -0.3)]]));
    ctx.save();
    poly(body);
    ctx.clip();
    const band = mix(mix(C.accent, '#c0505a', 0.6), C.skyBottom, 0.35), bh = (plat - tTop) / 5;
    for (let k = 1; k < 5; k += 2) {
      ctx.fillStyle = hgrad(tx - tb, tx + tb, [[0, shade(band, 0.05)], [1, shade(band, -0.3)]]);
      ctx.fillRect(tx - tb, tTop + k * bh, tb * 2, bh);
    }
    rects([[tx - 2, tTop + bh * 0.6, 3, 5], [tx - 2, tTop + bh * 2.6, 3, 5]], rgba(INK, 0.45));
    ctx.restore();
    // Galerie, Laterne, Kuppel
    rects([[tx - tt - 5, tTop - 2, tt * 2 + 10, 3]], mix(P.rock, C.far, 0.3));
    const rail = [];
    for (let x = tx - tt - 4; x <= tx + tt + 4; x += 3) rail.push([x, tTop - 2, x, tTop - 7]);
    segs(rail, rgba(mix(P.rock, C.far, 0.3), 0.8), 0.7);
    line(tx - tt - 4, tTop - 7, tx + tt + 4, tTop - 7, mix(P.rock, C.far, 0.3), 0.8);
    glow(tx, tTop - 13, 26, P.glow, 0.22);
    rects([[tx - 6, tTop - 19, 12, 12]], rgba(P.glow, 0.55));
    segs([[tx - 2, tTop - 19, tx - 2, tTop - 7], [tx + 2, tTop - 19, tx + 2, tTop - 7]], rgba(INK, 0.4), 0.8);
    ctx.beginPath();
    ctx.ellipse(tx, tTop - 19, 8, 7, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = mix(P.rock, C.far, 0.2);
    ctx.fill();
    line(tx, tTop - 26, tx, tTop - 31, mix(P.rock, C.far, 0.2), 1);
  }

  // Windmühle auf einem Hügel: Turmwindmühle mit Kappe, vier Flügel (einer zerbrochen), verlassen
  function sMuehle(w, h, r, C, P) {
    const mx = w * R(r, 0.42, 0.55), hillT = h * R(r, 0.72, 0.8);
    sMass(sProfile([[0, h - 4], [w * 0.2, hillT + 10], [mx - 20, hillT], [mx + 30, hillT + 2], [w * 0.8, hillT + 12], [w, h - 4]], r, 3), h, C, P, r, { col: mix(P.rock, P.grass, 0.35), rock: false });
    const bt = 58, b0 = 22, b1 = 14, mTop = hillT - 92;
    const body = [[mx - b0, hillT + 3], [mx - b1, mTop], [mx + b1, mTop], [mx + b0, hillT + 3]];
    poly(body, hgrad(mx - b0, mx + b0, [[0, shade(P.wall, 0.06)], [0.5, P.wall], [1, shade(P.wall, -0.3)]]));
    rects([[mx - 4, hillT - 22, 8, 24]], rgba(INK, 0.5));
    rects([[mx - 3, mTop + 22, 5, 7]], rgba(INK, 0.45));
    const brk = [];
    for (let k = 0; k < 5; k++) { const y = R(r, mTop + 6, hillT - 8), x = mx + R(r, -b1, b1); brk.push([x, y, x + R(r, 2, 6), y + R(r, 1, 3)]); }
    segs(brk, rgba(INK, 0.3), 1);
    // Kappe
    ctx.beginPath();
    ctx.ellipse(mx, mTop + 1, b1 + 4, 14, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = hgrad(mx - b1, mx + b1, [[0, shade(P.wood, 0.1)], [1, shade(P.wood, -0.3)]]);
    ctx.fill();
    // Flügel: Gitterrahmen, statisch schräg gestellt
    const hub = [mx - 3, mTop - 4], a0 = R(r, 0.2, 0.6), broken = Math.floor(r() * 4), len = Math.min(bt + 26, mTop + 4);
    for (let k = 0; k < 4; k++) {
      const a = a0 + k * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, L = k === broken ? len * 0.55 : len;
      line(hub[0], hub[1], hub[0] + dx * L, hub[1] + dy * L, P.wood, 2.2);
      const frame = [], sl = [];
      const f0 = 10, wdt = 9;
      frame.push([hub[0] + dx * f0 + nx * wdt, hub[1] + dy * f0 + ny * wdt, hub[0] + dx * L + nx * wdt, hub[1] + dy * L + ny * wdt]);
      for (let t = f0; t <= L; t += 6) if (!(k === broken && t > L * 0.7 && r() < 0.5)) sl.push([hub[0] + dx * t, hub[1] + dy * t, hub[0] + dx * t + nx * wdt, hub[1] + dy * t + ny * wdt]);
      segs(frame, rgba(P.wood, 0.9), 1);
      segs(sl, rgba(P.wood, 0.75), 0.8);
    }
    circle(hub[0], hub[1], 3.5, shade(P.wood, -0.2));
  }

  // Ruine: zerbrochener Rundturm oder Mauer mit Bögen auf einer Felskuppe, Schutt
  function sRuine(w, h, r, C, P) {
    const knoll = h * R(r, 0.68, 0.78), tower = r() < 0.6;
    sMass(sProfile([[0, h - 4], [w * 0.15, knoll + 12], [w * 0.35, knoll], [w * 0.7, knoll + 4], [w * 0.88, knoll + 14], [w, h - 4]], r, 5), h, C, P, r);
    const wall = mix(P.wall, P.rock, 0.3);
    if (tower) {
      const tx = w * R(r, 0.35, 0.5), tw = Math.min(46, w * 0.3), tTop = R(r, 6, 20);
      const brk = [];
      for (let k = 0; k <= 8; k++) brk.push([tx - tw / 2 + k * tw / 8, tTop + (k % 2 ? R(r, 4, 14) : R(r, 0, 6)) + (k / 8) * R(r, 10, 40)]);
      const pts = [[tx - tw / 2, knoll + 3]].concat(brk, [[tx + tw / 2, knoll + 3]]);
      poly(pts, hgrad(tx - tw / 2, tx + tw / 2, [[0, shade(wall, 0.08)], [0.5, wall], [1, shade(wall, -0.3)]]));
      ctx.save();
      poly(pts);
      ctx.clip();
      const st = [];
      for (let y = tTop; y < knoll; y += 6) for (let x = tx - tw / 2 + ((y / 6) % 2) * 5; x < tx + tw / 2; x += 10) st.push([x, y, x, y + 6]);
      segs(st, rgba(INK, 0.12), 0.6);
      const rows = [];
      for (let y = tTop + 3; y < knoll; y += 6) rows.push([tx - tw / 2, y, tx + tw / 2, y]);
      segs(rows, rgba(INK, 0.14), 0.6);
      ctx.restore();
      // Rundbogenfenster, dunkel; eines mit Durchblick
      for (const [wx, wy] of [[tx - 4, tTop + 40], [tx + 2, tTop + 90]]) {
        if (wy > knoll - 20) continue;
        ctx.beginPath();
        ctx.moveTo(wx - 4, wy + 14);
        ctx.lineTo(wx - 4, wy);
        ctx.arc(wx, wy, 4, Math.PI, TAU);
        ctx.lineTo(wx + 4, wy + 14);
        ctx.closePath();
        ctx.fillStyle = rgba(INK, 0.55);
        ctx.fill();
      }
    } else {
      // Mauerrest mit Bögen
      const mx0 = w * 0.18, mx1 = w * 0.82, mt = knoll - R(r, 70, 110), n = 3;
      const top = [];
      for (let k = 0; k <= 10; k++) top.push([lerp(mx0, mx1, k / 10), mt + R(r, 0, 30) + Math.abs(k - 3) * R(r, 0, 6)]);
      const pts = [[mx0, knoll + 3]].concat(top, [[mx1, knoll + 3]]);
      ctx.save();
      poly(pts);
      ctx.clip();
      ctx.fillStyle = hgrad(mx0, mx1, [[0, shade(wall, 0.08)], [1, shade(wall, -0.25)]]);
      ctx.fillRect(mx0, mt - 4, mx1 - mx0, knoll - mt + 8);
      const aw = (mx1 - mx0) / n;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const ax = mx0 + aw * (k + 0.2), ar = aw * 0.3, ay = knoll - 40;
        ctx.moveTo(ax, knoll + 3);
        ctx.lineTo(ax, ay);
        ctx.arc(ax + ar, ay, ar, Math.PI, TAU);
        ctx.lineTo(ax + ar * 2, knoll + 3);
        ctx.closePath();
      }
      ctx.fillStyle = mix(C.skyBottom, C.far, 0.5);
      ctx.fill();
      ctx.restore();
    }
    const rub = [];
    for (let k = 0; k < 16; k++) rub.push([R(r, w * 0.15, w * 0.85), knoll + R(r, -2, 4), R(r, 1.5, 4), R(r, 1, 2.5)]);
    ellipses(rub.map(q => [q[0], q[1], q[2], q[3], 0]), shade(wall, -0.2));
  }

  // Gruppe windgebeugter Bäume auf einer Anhöhe
  function sHain(w, h, r, C, P) {
    const ht = h * R(r, 0.8, 0.86);
    sMass(sProfile([[0, h - 4], [w * 0.25, ht + 6], [w * 0.55, ht], [w * 0.8, ht + 8], [w, h - 4]], r, 3), h, C, P, r, { col: mix(P.rock, P.grass, 0.45), rock: false });
    const n = 1 + Math.floor(r() * 3), col = mix(mix(C.near, P.grass, 0.35), C.far, 0.2);
    for (let k = 0; k < n; k++) sTree(w * (0.5 + (k - (n - 1) / 2) * 0.25) + R(r, -8, 8) + w * 0.12, ht + 3, (ht - 10) * R(r, 0.7, 1), C, col, r);
  }

  // Hinkelsteine: ein Kreis aufrechter Steine auf flachem Hügel, einer umgestürzt
  function sSteine(w, h, r, C, P) {
    const ht = h * 0.62;
    sMass(sProfile([[0, h - 2], [w * 0.2, ht + 6], [w * 0.5, ht], [w * 0.8, ht + 6], [w, h - 2]], r, 2), h, C, P, r, { col: mix(P.rock, P.grass, 0.45), rock: false });
    const stones = 4 + Math.floor(r() * 3), sc = mix(P.wall, P.rock, 0.5);
    for (let k = 0; k < stones; k++) {
      const x = w * (0.18 + 0.64 * k / (stones - 1)) + R(r, -5, 5), sw = R(r, 7, 12), sh = R(r, 24, ht - 8), y = ht + 2 + Math.abs(k - (stones - 1) / 2) * 1.5;
      if (k === 2 && r() < 0.6) { poly([[x - sh * 0.5, y], [x - sh * 0.45, y - sw], [x + sh * 0.5, y - sw * 0.8], [x + sh * 0.5, y]], hgrad(x - sh * 0.5, x + sh * 0.5, [[0, shade(sc, 0.1)], [1, shade(sc, -0.25)]])); continue; }
      poly([[x - sw, y + 2], [x - sw * 0.8, y - sh * 0.8], [x - sw * 0.3, y - sh], [x + sw * 0.6, y - sh * 0.92], [x + sw, y + 2]], hgrad(x - sw, x + sw, [[0, shade(sc, 0.12)], [0.5, sc], [1, shade(sc, -0.3)]]));
      line(x - sw * 0.8, y - sh * 0.8, x - sw * 0.3, y - sh, rgba(CREAM, 0.15), 1);
    }
  }

  // Verlassenes Gehöft: Scheune mit eingebrochenem Dach, schiefer Zaun, kahler Baum
  function sHof(w, h, r, C, P) {
    const gy = h - 10;
    sMass([[0, gy + 4], [w * 0.3, gy - 2], [w * 0.7, gy], [w, gy + 4]], h, C, P, r, { col: mix(P.rock, P.grass, 0.5), rock: false });
    const bx = w * R(r, 0.15, 0.3), bw = w * 0.45, bh = h * R(r, 0.35, 0.45), rf = bh * 0.7, wood = P.wood;
    poly([[bx, gy], [bx, gy - bh], [bx + bw, gy - bh], [bx + bw, gy]], hgrad(bx, bx + bw, [[0, shade(wood, 0.08)], [1, shade(wood, -0.25)]]));
    const pl = [];
    for (let x = bx + 4; x < bx + bw; x += 5) pl.push([x, gy - bh, x, gy]);
    segs(pl, rgba(INK, 0.22), 0.7);
    rects([[bx + bw * 0.38, gy - bh * 0.62, bw * 0.24, bh * 0.62]], rgba(INK, 0.5));
    // Dach: linke Hälfte geschlossen, rechte eingebrochen (nur Sparren)
    const ridge = bx + bw * 0.5, ry = gy - bh - rf, roofC = mix(P.rock, C.near, 0.4);
    poly([[bx - 5, gy - bh + 2], [ridge, ry], [ridge + 2, ry + 3], [ridge - 2, gy - bh + 1]], roofC);
    line(bx - 5, gy - bh + 1.5, ridge, ry, rgba(CREAM, 0.12), 1);
    const raft = [];
    for (let k = 1; k <= 4; k++) { const t = k / 5; raft.push([ridge + 1, ry + 2, lerp(ridge, bx + bw + 5, t + 0.15), lerp(ry, gy - bh + 1, t + 0.15) + (k === 3 ? 6 : 0)]); }
    segs(raft, shade(P.wood, -0.15), 1.4);
    line(ridge, ry, bx + bw + 5, gy - bh + 2, shade(P.wood, -0.15), 1.8);
    // Zaun, schief
    const fx0 = bx + bw + 10, posts = [];
    for (let x = fx0; x < w - 6; x += 11) posts.push([x, gy, x - R(r, 0, 4), gy - R(r, 10, 16)]);
    segs(posts, P.wood, 1.6);
    if (posts.length > 1) segs([[posts[0][2], posts[0][3] + 4, posts[posts.length - 1][2], posts[posts.length - 1][3] + 6]], rgba(P.wood, 0.8), 1);
    if (r() < 0.7) sTree(R(r, w * 0.06, bx - 4) + 8, gy, h * R(r, 0.55, 0.8), C, mix(C.near, P.rock, 0.3), r);
  }

  const S_KINDS = {
    klippe: { size: r => [R(r, 180, 300), R(r, 150, 260)], paint: sKlippe },
    leucht: { size: r => [R(r, 230, 290), R(r, 330, 356)], paint: sLeucht },
    muehle: { size: r => [R(r, 170, 230), R(r, 230, 290)], paint: sMuehle },
    ruine: { size: r => [R(r, 140, 210), R(r, 190, 280)], paint: sRuine },
    hain: { size: r => [R(r, 150, 230), R(r, 150, 230)], paint: sHain },
    steine: { size: r => [R(r, 150, 220), R(r, 90, 130)], paint: sSteine },
    hof: { size: r => [R(r, 170, 240), R(r, 110, 160)], paint: sHof }
  };
  for (const k in S_KINDS) {
    const K = S_KINDS[k], fn = K.paint;
    K.tex = { grain: 0.05 };
    K.paint = (w, h, r, C) => { fn(w, h, r, C, sPal(C)); sAtmos(w, h, C, r); };
  }
  const S_GAP = [20, 150];
  const S_TREE = {
    baum: {
      size: r => [R(r, 160, 220), R(r, 150, 210)],
      paint: (w, h, r, C) => {
        const P = sPal(C), col = mix(mix(C.near, P.grass, 0.32), C.far, 0.12);
        ctx.fillStyle = rgba(INK, 0.2);
        ctx.beginPath();
        ctx.ellipse(w * 0.62, h - 3, w * 0.3, 4, 0, 0, TAU);
        ctx.fill();
        sTree(w * 0.74, h - 2, h * 0.98, C, col, r);
        sAtmos(w, h, C, r);
      },
      tex: { grain: 0.05 }
    }
  };
  SCENE.Sturm = {
    tracks: [
      {
        z: 1, factor: 0.32, start: 40, gap: S_GAP, maxKs: 2, base: () => BASE, kinds: S_KINDS,
        pick: makePick({
          start: 40, dl: 1000, gapMean: (S_GAP[0] + S_GAP[1]) / 2, widths: meanW(S_KINDS),
          cd: { leucht: 99, muehle: 6, hof: 4, steine: 4, ruine: 3 },
          zones: [
            [800, { hain: 3, hof: 2, steine: 1, muehle: 1.5 }],
            [1600, { ruine: 3, steine: 1.5, hain: 2, klippe: 1, muehle: 0.8 }],
            [2500, { klippe: 4, ruine: 1, hain: 0.8 }]
          ],
          mixed: [
            { hain: 2, hof: 1.5, muehle: 1.2, steine: 1 },
            { ruine: 2, klippe: 1.5, hain: 1.5, steine: 1 },
            { klippe: 3, hain: 1, ruine: 1 }
          ],
          once: [{ k: 'muehle', after: 300 }, { k: 'leucht', after: 2000 }]
        })
      },
      { z: 2, factor: 0.55, start: 700, gap: [600, 1300], maxKs: 2, base: () => BASE + 2, kinds: S_TREE }
    ]
  };

  // ============================================================
  // ASCHE: sehr dunkel, Rauch, Sichtradius 300. Wenige große, ruhige Motive:
  // ferne Vulkane mit schwachem Glühen; davor verkohlter Wald, ausgebrannte
  // Häuser, dann die Ruinen einer Festung (Türme, Tor, Mauern).
  // ============================================================
  const aPal = C => ({
    stone: mix(C.near, C.far, 0.55),
    char: mix(C.near, INK, 0.25),
    ash: mix(C.far, CREAM, 0.12)
  });
  // Glühender Riss: Schein, Kern, heiße Mitte
  function aGlow(pts, C, k) {
    const s2 = k || 1;
    for (const [lw, c] of [[5 * s2, rgba(C.accent, 0.14)], [1.8 * s2, rgba(C.accent, 0.7)], [0.8 * s2, rgba(C.accentLight, 0.85)]]) stroke(pts, c, lw);
  }
  function aCrack(x, y, len, C, r, k) {
    const pts = [[x, y]];
    let px = x, py = y;
    while (py > y - len) { px += R(r, -3, 3); py -= R(r, 5, 9); pts.push([px, py]); }
    aGlow(pts, C, k);
  }
  // Glutschein von unten und Rauchdunst oben, nur auf dem Motiv
  function aLight(w, h, C, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(0, h, [[0, rgba(C.skyTop, 0.25)], [0.55, rgba(C.accent, 0)], [1, rgba(C.accent, a)]]);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // Mauerwerk mit gebrochener Oberkante (Umriss oben von links nach rechts), Fenster als Löcher (evenodd)
  function aWall(top, h, holes, col, C) {
    const x0 = top[0][0], x1 = top[top.length - 1][0];
    ctx.beginPath();
    ctx.moveTo(x0, h + 2);
    for (const q of top) ctx.lineTo(q[0], q[1]);
    ctx.lineTo(x1, h + 2);
    ctx.closePath();
    for (const [hx, hy, hw, hh] of holes) {
      ctx.moveTo(hx, hy + hh);
      ctx.lineTo(hx, hy + hw / 2);
      ctx.arc(hx + hw / 2, hy + hw / 2, hw / 2, Math.PI, TAU);
      ctx.lineTo(hx + hw, hy + hh);
      ctx.closePath();
    }
    ctx.fillStyle = hgrad(x0, x1, [[0, shade(col, 0.1)], [0.6, col], [1, shade(col, -0.25)]]);
    ctx.fill('evenodd');
    // Bruchkante: schmale, hellere Oberfläche der Mauerdicke, darunter ein Schattenstrich
    const lit = [], shd = [];
    for (let k = 0; k < top.length - 1; k++) {
      lit.push([top[k][0], top[k][1] + 1, top[k + 1][0], top[k + 1][1] + 1]);
      shd.push([top[k][0], top[k][1] + 3.5, top[k + 1][0], top[k + 1][1] + 3.5]);
    }
    segs(lit, rgba(mix(col, CREAM, 0.25), 0.9), 2.2);
    segs(shd, rgba(INK, 0.25), 1.2);
    // Laibungen der Öffnungen: rechte Kante hell (Licht von links fällt hinein), oben dunkel
    const jamb = [];
    for (const [hx, hy, hw, hh] of holes) jamb.push([hx + hw - 1, hy + hw / 2, hx + hw - 1, hy + hh]);
    segs(jamb, rgba(mix(col, CREAM, 0.2), 0.6), 1.4);
  }
  // Steinlagen und Rußspuren (source-atop)
  function aCourses(x0, x1, y0, h, C, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const br = [];
    for (let y = y0 + 6; y < h; y += 7) br.push([x0, y, x1, y + R(r, -0.5, 0.5)]);
    segs(br, rgba(INK, 0.16), 0.7);
    for (let k = 0; k < 2; k++) soft(R(r, x0, x1), R(r, y0, h * 0.7), R(r, 12, 30), R(r, 20, 50), INK, 0.25);
    ctx.restore();
  }
  function aRubble(x0, x1, y, col, r) {
    const rb = [];
    for (let x = x0; x < x1; x += R(r, 3, 7)) rb.push([x, y - R(r, 0, 5), R(r, 2, 6), R(r, 1.5, 4), R(r, -0.4, 0.4)]);
    ellipses(rb, col);
  }

  // Turmkörper: leicht verjüngt, schräg abgebrochen, kurzer Rest der Rückwand, Gesimsband, Fensterhöhlen
  function aTowerBody(cx, b0, b1, hiY, loY, h, left, P, C, r) {
    const edgeX = y => lerp(b1, b0, y / h), brk = [];
    for (let k = 0; k <= 9; k++) {
      const t = k / 9, y = lerp(left ? hiY : loY, left ? loY : hiY, t) + (k % 2 ? R(r, 3, 12) : R(r, -2, 3));
      brk.push([cx - edgeX(y) + t * 2 * edgeX(y), y]);
    }
    const hx = left ? cx - b1 * 0.55 : cx + b1 * 0.55, hy = lerp(hiY, loY, 0.45);
    poly([[hx - b1 * 0.35, hy + 30], [hx - b1 * 0.3, hy + 4], [hx, hy - 6], [hx + b1 * 0.3, hy + 6], [hx + b1 * 0.35, hy + 30]], shade(P.stone, -0.32));
    const pts = [[cx - b0, h + 2], [cx - edgeX(brk[0][1]), brk[0][1]]].concat(brk.slice(1, -1), [[cx + edgeX(brk[brk.length - 1][1]), brk[brk.length - 1][1]], [cx + b0, h + 2]]);
    const holes = [], wy0 = Math.max(hiY, loY) + 24;
    for (let y = wy0, k = 0; y < h - 70; y += R(r, 46, 64), k++) {
      const big = k === 1, hw = big ? 16 : 9, hh = big ? 30 : 22;
      holes.push([cx - hw / 2 + R(r, -b1 * 0.3, b1 * 0.3), y, hw, hh]);
    }
    aWall(pts, h, holes, P.stone, C);
    aCourses(cx - b0, cx + b0, Math.min(hiY, loY), h, C, r);
    rects([[cx - edgeX(wy0 - 10) - 2, wy0 - 10, edgeX(wy0 - 10) * 2 + 4, 4]], shade(P.stone, 0.08));
    return holes;
  }
  // Ruinenturm mit glimmender Fensterhöhle, Riss und Schuttkegel
  function aTurm(w, h, r, C, P) {
    const cx = w / 2, b0 = w * 0.42, b1 = w * 0.34, hiY = R(r, 4, 24);
    const holes = aTowerBody(cx, b0, b1, hiY, hiY + R(r, 50, 90), h, r() < 0.5, P, C, r);
    if (holes.length) { const [hx, hy, hw, hh] = holes[Math.floor(r() * holes.length)]; glow(hx + hw / 2, hy + hh * 0.7, 14, C.accent, 0.32); }
    if (r() < 0.6) aCrack(cx + R(r, -b1 * 0.5, b1 * 0.5), h - 6, R(r, 40, 90), C, r, 0.8);
    blobPath([[cx - b0 * 1.1, h, 14], [cx - b0 * 0.6, h - 4, 12], [cx + b0 * 1.05, h, 16], [cx + b0 * 0.7, h - 3, 10]]);
    ctx.fillStyle = shade(P.stone, -0.12);
    ctx.fill();
    aRubble(0, w, h - 2, shade(P.stone, -0.2), r);
    aLight(w, h, C, 0.26);
  }

  // Zerbrochene Mauer mit Bogenfenstern, ein heruntergefallener Balken
  function aMauer(w, h, r, C, P) {
    // Mauerkrone: hohe Pfeilerreste wechseln mit fast bis zum Boden eingestürzten Abschnitten
    const top = [], lvl = [R(r, 4, 24), R(r, 34, 70), h - R(r, 26, 50)];
    let state = 0;
    for (let x = 0; x <= w; x += R(r, 12, 22)) {
      if (r() < 0.35) state = clamp(state + (r() < 0.5 ? -1 : 1), 0, 2);
      top.push([Math.min(x, w), lvl[state] + R(r, -6, 6)]);
    }
    if (top[top.length - 1][0] < w) top.push([w, lvl[state] + R(r, 0, 10)]);
    const holes = [], n = Math.max(2, Math.floor(w / 64)), hy = h * R(r, 0.36, 0.44);
    for (let k = 0; k < n; k++) { const hw = R(r, 20, 26), hx = (k + 0.25) * w / n; if (Math.max(yAt(top, hx), yAt(top, hx + hw)) < hy - 18) holes.push([hx, hy, hw, h - hy - 16]); }
    aWall(top, h, holes, P.stone, C);
    aCourses(0, w, 4, h, C, r);
    const bx = R(r, w * 0.2, w * 0.6);
    ctx.save();
    ctx.translate(bx, h - 8);
    ctx.rotate(R(r, -0.5, -0.25));
    ctx.fillStyle = P.char;
    ctx.fillRect(0, -3, R(r, 50, 80), 6);
    ctx.restore();
    aCrack(R(r, w * 0.3, w * 0.8), h - 4, R(r, 30, 60), C, r, 0.7);
    aRubble(0, w, h - 1, shade(P.stone, -0.15), r);
    aLight(w, h, C, 0.32);
  }

  // Ausgebranntes Haus: Giebelwand mit leeren Fenstern, verkohlte Sparren, Schornstein
  function aHaus(w, h, r, C, P) {
    const gx0 = w * 0.08, gx1 = w * 0.78, eave = h * R(r, 0.42, 0.5), ridge = R(r, 10, 30), gm = (gx0 + gx1) / 2;
    const top = [[gx0, eave], [gm - 8, ridge + 12], [gm - 2, ridge + R(r, 0, 20)], [gm + 10, ridge + 25], [gx1, eave + R(r, 0, 20)]];
    const holes = [[gx0 + (gx1 - gx0) * 0.18, eave + 18, 12, 26], [gx0 + (gx1 - gx0) * 0.62, eave + 18, 12, 26], [gm - 7, ridge + 50, 14, 24]];
    // verkohlte Sparren hinter dem Giebel, ragen nach rechts heraus
    const raft = [];
    for (let k = 0; k < 3; k++) raft.push([gm - 4, ridge + 18 + k * 10, gx1 + R(r, 14, 34), eave + R(r, -26, 4) + k * 6]);
    segs(raft, P.char, 3);
    aWall(top, h, holes, P.stone, C);
    aCourses(gx0, gx1, ridge, h, C, r);
    const cx = gx1 + 4, cw = 14, ct = R(r, 4, 20);
    poly([[cx, h], [cx, ct], [cx + cw, ct], [cx + cw, h]], hgrad(cx, cx + cw, [[0, shade(P.stone, 0.05)], [1, shade(P.stone, -0.3)]]));
    rects([[cx - 2, ct, cw + 4, 4]], shade(P.stone, -0.1));
    glow(holes[0][0] + 6, holes[0][1] + 20, 16, C.accent, 0.22);
    aRubble(gx0 - 6, gx1 + 8, h - 1, shade(P.stone, -0.15), r);
    aLight(w, h, C, 0.35);
  }

  // Einzelner Schornstein eines abgebrannten Hauses mit Mauerstümpfen
  function aKamin(w, h, r, C, P) {
    const cx = w * R(r, 0.4, 0.55), cw = R(r, 16, 22), ct = R(r, 4, 24);
    poly([[cx, h], [cx + 1, ct], [cx + cw - 1, ct], [cx + cw, h]], hgrad(cx, cx + cw, [[0, shade(P.stone, 0.08)], [0.5, P.stone], [1, shade(P.stone, -0.3)]]));
    aCourses(cx, cx + cw, ct, h, C, r);
    rects([[cx - 3, ct, cw + 6, 5], [cx - 1, ct + 40, cw + 2, 3]], shade(P.stone, -0.08));
    for (const [x0, x1, hh] of [[0, cx - 2, R(r, 20, 50)], [cx + cw + 2, w, R(r, 14, 40)]]) {
      const top = [];
      for (let x = x0; x <= x1; x += 8) top.push([x, h - hh + R(r, -8, 8)]);
      if (top.length > 1) aWall(top, h, [], shade(P.stone, -0.05), C);
    }
    glow(cx + cw / 2, h - 10, 22, C.accent, 0.3);
    aCrack(cx + cw * 0.5, h - 4, 30, C, r, 0.6);
    aRubble(0, w, h - 1, shade(P.stone, -0.15), r);
    aLight(w, h, C, 0.3);
  }

  // Großer verkohlter Baum: gesplitterter Stamm, geknickte Äste, Glutrisse
  function aBaum(w, h, r, C, P) {
    const x = w * R(r, 0.45, 0.55), tw = R(r, 9, 13), top = R(r, 4, 30), lean = R(r, -14, 14), bark = P.char;
    ctx.beginPath();
    ctx.moveTo(x - tw * 2.2, h + 2);
    ctx.bezierCurveTo(x - tw * 0.8, h - h * 0.15, x - tw * 0.7 + lean, h * 0.45, x + lean - tw * 0.5, top + 14);
    ctx.lineTo(x + lean - tw * 0.2, top);
    ctx.lineTo(x + lean + tw * 0.15, top + 10);
    ctx.lineTo(x + lean + tw * 0.45, top + 4);
    ctx.lineTo(x + lean + tw * 0.6, top + 16);
    ctx.bezierCurveTo(x + tw * 0.7 + lean, h * 0.45, x + tw * 0.8, h - h * 0.15, x + tw * 2.2, h + 2);
    ctx.closePath();
    ctx.fillStyle = hgrad(x - tw, x + tw, [[0, mix(bark, C.far, 0.5)], [0.45, bark], [1, shade(bark, -0.3)]]);
    ctx.fill();
    const br = [];
    for (let k = 0; k < 7; k++) {
      const t = R(r, 0.25, 0.85), side = r() < 0.5 ? -1 : 1, bx = x + lean * t, by = h - (h - top) * t, len = R(r, 20, 55) * (1.1 - t * 0.5);
      const kx = bx + side * len * 0.6, ky = by - len * R(r, 0.15, 0.5);
      br.push([bx, by, kx, ky], [kx, ky, kx + side * len * R(r, 0.2, 0.5), ky - len * R(r, 0.1, 0.5)]);
    }
    segs(br, bark, Math.max(1.6, tw * 0.3));
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const cr = [];
    for (let y = top + 8; y < h; y += R(r, 5, 9)) cr.push([x - tw * 2, y, x + tw * 2, y + R(r, -1, 1)]);
    segs(cr, rgba(INK, 0.3), 0.8);
    ctx.restore();
    aCrack(x + lean * 0.3, h - 8, R(r, 50, 110), C, r, 0.7);
    glow(x, h - 4, tw * 4, C.accent, 0.22);
    aLight(w, h, C, 0.22);
  }

  // Festungstor: zwei abgebrochene Tortürme, dazwischen ein Bogen, dessen rechte Hälfte eingestürzt ist
  function aTor(w, h, r, C, P) {
    const tw = w * 0.28, ax0 = tw * 0.9, ax1 = w - tw * 0.9, acx = (ax0 + ax1) / 2, ar = (ax1 - ax0) / 2, spring = h * R(r, 0.5, 0.58);
    // Bogen hinter den Türmen: Ring aus Keilsteinen, rechts ab etwa der Mitte weggebrochen
    const a0 = Math.PI, a1 = Math.PI * R(r, 1.55, 1.7), th = 14;
    ctx.beginPath();
    ctx.arc(acx, spring, ar + th, a0, a1);
    ctx.arc(acx, spring, ar, a1 + 0.04, a0, true);
    ctx.closePath();
    ctx.fillStyle = hgrad(ax0, ax1, [[0, shade(P.stone, 0.06)], [1, shade(P.stone, -0.2)]]);
    ctx.fill();
    const vs = [];
    for (let a = a0 + 0.12; a < a1; a += 0.14) vs.push([acx + Math.cos(a) * ar, spring + Math.sin(a) * ar, acx + Math.cos(a) * (ar + th), spring + Math.sin(a) * (ar + th)]);
    segs(vs, rgba(INK, 0.3), 0.8);
    ctx.strokeStyle = rgba(mix(P.stone, CREAM, 0.25), 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(acx, spring, ar + th - 0.8, a0 + 0.05, a1);
    ctx.stroke();
    // Mauer über dem Bogen auf der stehenden Seite
    poly([[ax0, spring - ar - th + 2], [acx - ar * 0.3, spring - ar - th - R(r, 4, 16)], [acx - ar * 0.1, spring - ar - th + 4], [ax0, spring - ar * 0.4]], shade(P.stone, -0.04));
    const holesL = aTowerBody(tw / 2, tw * 0.5, tw * 0.42, R(r, 6, 30), R(r, 60, 90), h, false, P, C, r);
    aTowerBody(w - tw / 2, tw * 0.5, tw * 0.42, R(r, 30, 60), R(r, 80, 110), h, true, P, C, r);
    if (holesL.length) glow(holesL[0][0] + 4, holesL[0][1] + 14, 12, C.accent, 0.28);
    aRubble(ax0, ax1, h - 1, shade(P.stone, -0.15), r);
    blobPath([[acx + ar * 0.3, h, 18], [acx + ar * 0.6, h - 6, 12], [acx + ar * 0.1, h - 3, 10]]);
    ctx.fillStyle = shade(P.stone, -0.12);
    ctx.fill();
    glow(acx, h - 6, 30, C.accent, 0.25);
    aLight(w, h, C, 0.3);
  }

  // Ferne Vulkane und Grate: nah an den Himmelsfarben, Krater mit schwachem Glühen, Rauchfahne
  function aFern(w, h, r, C, kind) {
    const col = mix(mix(C.far, C.skyBottom, 0.3), C.skyTop, 0.15), dk = shade(col, -0.2);
    if (kind === 'grat') {
      const top = [[0, h]];
      for (let x = 0; x <= w; x += R(r, 14, 30)) top.push([Math.min(x, w), h * R(r, 0.25, 0.7)]);
      top.push([w, h]);
      poly(top, vgrad(h * 0.2, h, [[0, col], [1, mix(col, C.skyBottom, 0.3)]]));
      const sh = [];
      for (let k = 1; k < top.length - 2; k++) if (top[k + 1][1] > top[k][1]) sh.push([[top[k][0], top[k][1]], [top[k + 1][0], top[k + 1][1]], [top[k + 1][0], h], [top[k][0] + 4, h]]);
      fillPolys(sh, rgba(INK, 0.12));
      return;
    }
    const cx = w * 0.5, top = kind === 'vulkan' ? h * 0.12 : h * 0.3, cr = kind === 'vulkan' ? w * 0.07 : w * 0.05;
    const pts = [[0, h], [cx - w * 0.3, h * 0.7], [cx - cr * 1.6, top + 14], [cx - cr, top], [cx + cr, top + 3], [cx + cr * 1.7, top + 16], [cx + w * 0.32, h * 0.72], [w, h]];
    poly(pts, vgrad(top, h, [[0, col], [1, mix(col, C.skyBottom, 0.3)]]));
    poly([[cx + cr * 0.2, top + 2], [cx + cr, top + 3], [cx + cr * 1.7, top + 16], [cx + w * 0.32, h * 0.72], [w, h], [cx + w * 0.05, h]], rgba(dk, 0.5));
    const rills = [];
    for (let k = 0; k < 10; k++) { const t = R(r, 0.1, 0.6), xx = lerp(cx - cr, cx - w * 0.3, t) + R(r, 0, 20), yy = lerp(top, h * 0.7, t); rills.push([xx, yy, xx - R(r, 4, 10), yy + R(r, 15, 40)]); }
    segs(rills, rgba(INK, 0.15), 1);
    if (kind === 'vulkan') {
      glow(cx, top + 2, w * 0.18, C.accent, 0.26);
      ellipse(cx, top + 1.5, cr * 0.8, 1.8, 0, rgba(C.accent, 0.35));
      const lava = [[cx - cr * 0.3, top + 3]];
      let lx = cx - cr * 0.3, ly = top + 3;
      while (ly < top + (h - top) * 0.4) { lx -= R(r, 1, 5); ly += R(r, 6, 10); lava.push([lx, ly]); }
      for (const [lw, c] of [[4, rgba(C.accent, 0.1)], [1.1, rgba(C.accent, 0.32)]]) stroke(lava, c, lw);
      // Rauchfahne, nach rechts ziehend
      const sm = mix(C.skyTop, C.far, 0.4);
      let sx = cx, sy = top - 10;
      for (let k = 0; k < 5; k++) { const rr = 16 + k * 9; soft(sx, sy, rr * 1.4, rr, sm, 0.42 - k * 0.05); sx += 13 + k * 5; sy -= 15 + k * 3; }
    }
  }

  const A_KINDS = {
    turm: { size: r => [R(r, 80, 120), R(r, 260, 350)], paint: aTurm },
    mauer: { size: r => [R(r, 200, 320), R(r, 120, 190)], paint: aMauer },
    haus: { size: r => [R(r, 140, 200), R(r, 160, 220)], paint: aHaus },
    kamin: { size: r => [R(r, 80, 130), R(r, 180, 260)], paint: aKamin },
    baum: { size: r => [R(r, 130, 190), R(r, 270, 350)], paint: aBaum },
    tor: { size: r => [R(r, 190, 260), R(r, 220, 290)], paint: aTor }
  };
  for (const k in A_KINDS) { const K = A_KINDS[k], fn = K.paint; K.tex = { grain: 0.05 }; K.paint = (w, h, r, C) => fn(w, h, r, C, aPal(C)); }
  const A_GAP = [120, 380];
  const A_FAR = {
    vulkan: { size: () => [360, 330], paint: (w, h, r, C) => aFern(w, h, r, C, 'vulkan'), tex: { grain: 0.03 } },
    kegel: { size: r => [R(r, 260, 320), R(r, 200, 240)], paint: (w, h, r, C) => aFern(w, h, r, C, 'kegel'), tex: { grain: 0.03 } },
    grat: { size: r => [R(r, 320, 360), R(r, 200, 260)], paint: (w, h, r, C) => aFern(w, h, r, C, 'grat'), tex: { grain: 0.03 } }
  };
  const A_FAR_PLAN = ['vulkan', 'grat', 'kegel', 'grat', 'vulkan'];
  SCENE.Asche = {
    tracks: [
      {
        z: 0, factor: 0.05, start: 100, gap: [-40, 60], maxKs: 1.5, base: () => BASE, kinds: A_FAR,
        pick: (i, rng) => (i < A_FAR_PLAN.length ? A_FAR_PLAN[i] : PK(rng, i % 4 === 0 ? ['vulkan', 'kegel'] : ['grat', 'kegel', 'grat']))
      },
      {
        z: 1, factor: 0.28, start: 80, gap: A_GAP, maxKs: 2, base: () => BASE, kinds: A_KINDS,
        pick: makePick({
          start: 80, dl: 1000, gapMean: (A_GAP[0] + A_GAP[1]) / 2, widths: meanW(A_KINDS),
          cd: { tor: 9, turm: 2, kamin: 2, mauer: 2 },
          zones: [
            [800, { baum: 3, kamin: 1.5, haus: 1 }],
            [1700, { haus: 3, kamin: 2, mauer: 1.5, baum: 1 }],
            [2600, { turm: 3, tor: 1.5, mauer: 2 }]
          ],
          mixed: [{ baum: 2, haus: 1.5, kamin: 1 }, { turm: 2, mauer: 2, tor: 1 }, { haus: 2, mauer: 1.5, baum: 1.5, turm: 1 }],
          once: [{ k: 'tor', after: 1900 }]
        })
      }
    ]
  };

  // ============================================================
  // HÖHLE: dunkel, Sichtradius 220. Hinten Tropfsteinsäulen vom Boden bis unter die
  // Höhlendecke (schmal, daher über 360 px hoch, Fläche aber kleiner als 360 x 360).
  // Vorn wenige große Motive: Grubenausbau mit Schienen und Lore am Eingang,
  // dann Kristallgruppen, dann Riesenpilze.
  // ============================================================
  const hPal = C => ({
    rock: mix(mix(C.far, C.near, 0.4), C.skyBottom, 0.1),
    wood: mix(mix(C.near, '#8a6a4a', 0.45), C.far, 0.2),
    metal: mix(C.pipe, C.near, 0.45),
    cap: mix(mix(C.pipe, C.accent, 0.22), C.far, 0.25)
  });
  // Tropfsteinsäule: oben breit aus der Decke, Taille, unten breiter Fuß; Sinterwülste, Rillen, nasse Lichtkante
  function hSaeule(w, h, r, C, P) {
    const cx = w / 2, broken = r() < 0.35, waist = h * R(r, 0.38, 0.55), gapH = broken ? R(r, 14, 30) : 0;
    const hwT = w * 0.48, hwW = w * R(r, 0.1, 0.16), hwB = w * 0.46, N = 30;
    // Wülste der Sinterfahnen: einige zufällige Ausbuchtungen entlang der Höhe
    const bumps = [];
    for (let k = 0; k < 9; k++) bumps.push([R(r, 0, h), R(r, 8, 26), R(r, 0.08, 0.26)]);
    const prof = y => {
      const t = y / h;
      let hw = y < waist ? lerp(hwT, hwW, Math.pow(y / waist, 0.6)) : lerp(hwW, hwB, Math.pow((y - waist) / (h - waist), 1.8));
      let b2 = 0;
      for (const [by, bw, ba] of bumps) { const d = (y - by) / bw; b2 += ba * Math.exp(-d * d); }
      return hw * (1 + b2 + 0.04 * Math.sin(t * 61 + cx));
    };
    const part = (y0, y1, tipUp, tipDown) => {
      const L2 = [], R2 = [];
      for (let k = 0; k <= N; k++) {
        const y = lerp(y0, y1, k / N);
        let hw = prof(y);
        if (tipDown && y > y1 - 30) hw *= Math.max(0.08, (y1 - y) / 30);
        if (tipUp && y < y0 + 30) hw *= Math.max(0.08, (y - y0) / 30);
        L2.push([cx - hw + Math.sin(y * 0.05) * 2, y]);
        R2.push([cx + hw + Math.sin(y * 0.05) * 2, y]);
      }
      const pts = L2.concat(R2.reverse());
      poly(pts, hgrad(cx - hwT, cx + hwT, [[0, mix(shade(P.rock, 0.2), C.accent, 0.08)], [0.4, P.rock], [1, shade(P.rock, -0.38)]]));
      // Rillen der Sinterfahnen
      const gr = [];
      for (let k = 1; k < 5; k++) { const f = k / 5 - 0.5; for (let j = 0; j < N; j += 3) { const a = lerp(y0, y1, j / N), b2 = lerp(y0, y1, Math.min(N, j + 3) / N); gr.push([cx + f * 2 * prof(a) * 0.9, a, cx + f * 2 * prof(b2) * 0.9, b2]); } }
      segs(gr, rgba(INK, 0.14), 0.8);
      stroke(L2, rgba(mix(CREAM, C.accent, 0.3), 0.14), 1.2);
    };
    if (broken) { part(0, waist - gapH / 2, false, true); part(waist + gapH / 2, h, true, false); }
    else part(0, h, false, false);
    // Sinterwülste als gerundete Ringe: helle Oberkante, Schatten darunter
    for (const [by] of bumps) {
      if (by < 30 || by > h - 20 || (broken && Math.abs(by - waist) < gapH + 6)) continue;
      const hw = prof(by) * 0.96;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(CREAM, 0.09);
      ctx.beginPath();
      ctx.ellipse(cx, by - 2, hw, 3, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
      ctx.strokeStyle = rgba(INK, 0.22);
      ctx.beginPath();
      ctx.ellipse(cx, by + 1.5, hw, 3.5, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }
    const wet = [];
    for (let k = 0; k < 12; k++) { const y = R(r, 20, h - 20); wet.push([cx - prof(y) * R(r, 0.5, 0.9), y, 0.8]); }
    dots(wet, rgba(C.accent, 0.4));
    if (broken) circle(cx + 1, waist - gapH / 2 + 2, 1.4, rgba(mix(C.accent, CREAM, 0.4), 0.7));
  }

  // Grubenausbau: kräftige Türstöcke aus Holz mit Kappe und Kopfbändern, Verzug, Schienen mit Lore, Grubenlampe
  function hStollen(w, h, r, C, P) {
    const top = R(r, 6, 16), rail = h - 7, wood = P.wood, dk = shade(wood, -0.32), lit = shade(wood, 0.18), pw = 9;
    // dunkle Stollenöffnung hinter dem Ausbau
    ctx.fillStyle = vgrad(top, h, [[0, rgba(INK, 0.55)], [1, rgba(INK, 0.35)]]);
    ctx.fillRect(6, top + 10, w - 12, h - top - 10);
    const posts = [];
    for (let x = 12; x < w - 8; x += R(r, 56, 72)) posts.push(x);
    if (posts[posts.length - 1] < w - 30) posts.push(w - 12);
    // Verzug: Bretter über der Kappe
    const lag = [];
    for (let x = 2; x < w - 2; x += 6) lag.push([x, top - R(r, 3, 7), 4.2, top + 4 - (top - 7)]);
    rects(lag.map(q => [q[0], q[1], q[2], 8]), shade(wood, -0.1));
    // Kappe
    ctx.fillStyle = vgrad(top, top + 11, [[0, lit], [0.4, wood], [1, dk]]);
    ctx.fillRect(2, top + 2, w - 4, 11);
    for (const x of posts) {
      const lean = R(r, -2.5, 2.5);
      poly([[x - pw / 2 - 1, h], [x - pw / 2 + lean, top + 12], [x + pw / 2 + lean, top + 12], [x + pw / 2 + 1, h]], hgrad(x - pw / 2, x + pw / 2, [[0, lit], [0.4, wood], [1, dk]]));
      segs([[x - 1.5, top + 24, x - 1, h - 22], [x + 2, top + 40, x + 2.3, h - 40]], rgba(INK, 0.22), 0.8);
      // Kopfbänder
      segs([[x - 22, top + 13, x - pw / 2, top + 30], [x + 22, top + 13, x + pw / 2, top + 30]], wood, 3.2);
      segs([[x - 22, top + 12.5, x - pw / 2, top + 29.5]], rgba(CREAM, 0.12), 0.8);
      dots([[x, top + 7, 1.2]], rgba(CREAM, 0.25));
    }
    // Schienen und Schwellen
    const sl = [];
    for (let x = 0; x < w; x += 10) sl.push([x, rail + 1, 7, 3.5]);
    rects(sl, dk);
    segs([[0, rail, w, rail]], P.metal, 2.2);
    segs([[0, rail - 1, w, rail - 1]], rgba(CREAM, 0.22), 0.7);
    // Lore auf den Schienen, mit Erzbrocken
    const lx = R(r, w * 0.25, w * 0.55), lw = 50, lh = 26, ly = rail - 9;
    poly([[lx, ly - lh], [lx + lw, ly - lh], [lx + lw - 6, ly], [lx + 6, ly]], hgrad(lx, lx + lw, [[0, shade(P.metal, 0.22)], [1, shade(P.metal, -0.32)]]));
    rects([[lx - 1.5, ly - lh, lw + 3, 3.5]], shade(P.metal, 0.3));
    rects([[lx + 4, ly - lh * 0.55, lw - 8, 2]], rgba(INK, 0.3));
    const rv = [];
    for (let x = lx + 5; x < lx + lw - 3; x += 6) rv.push([x, ly - lh + 7, 0.8], [x, ly - 5, 0.8]);
    dots(rv, rgba(CREAM, 0.2));
    blobPath([[lx + 12, ly - lh, 7], [lx + 24, ly - lh - 4, 8], [lx + 37, ly - lh - 1, 7]]);
    ctx.fillStyle = shade(P.rock, -0.1);
    ctx.fill();
    dots([[lx + 22, ly - lh - 6, 1.4], [lx + 33, ly - lh - 3, 1.1], [lx + 15, ly - lh - 2, 1]], rgba(C.accent, 0.65));
    for (const wx of [lx + 11, lx + lw - 11]) { circle(wx, rail - 5, 5.5, shade(P.metal, -0.38)); circle(wx, rail - 5, 2, shade(P.metal, 0.2)); }
    // Grubenlampe unter der Kappe
    const gx = posts[Math.min(posts.length - 1, 1)] + R(r, 16, 26), warm = mix(CREAM, '#ffc27a', 0.5);
    line(gx, top + 13, gx, top + 24, P.metal, 1);
    glow(gx, top + 29, 30, warm, 0.32);
    rects([[gx - 3, top + 24, 6, 8]], rgba(warm, 0.85));
    rects([[gx - 4, top + 23, 8, 1.6]], P.metal);
  }

  // Kristallgruppe: große Prismen mit hellen Facetten und Schein am Fuß
  function hKristall(w, h, r, C, P) {
    const base = h - 4, cf = mix(C.accent, CREAM, 0.15), cs = mix(C.accent, C.far, 0.5), cd = mix(C.accent, C.near, 0.65);
    glow(w / 2, base - h * 0.25, h * 0.7, C.accent, 0.18);
    blobPath([[w * 0.3, base + 4, w * 0.22], [w * 0.55, base + 2, w * 0.26], [w * 0.78, base + 6, w * 0.18]]);
    ctx.fillStyle = shade(P.rock, -0.1);
    ctx.fill();
    const n = 5 + Math.floor(r() * 3), parts = [];
    for (let k = 0; k < n; k++) parts.push([w * R(r, 0.2, 0.8), h * R(r, 0.35, 0.95) * (k === 0 ? 1.05 : 1), R(r, -0.55, 0.55) * (k === 0 ? 0.3 : 1)]);
    parts.sort((a, b) => a[1] - b[1]);
    for (const [x, hh0, tilt0] of parts) {
      const hh = Math.min(hh0, base - 4), ww = Math.max(5, hh * R(r, 0.12, 0.18));
      const room = Math.max(0, Math.min(x, w - x) - ww - 2), tilt = clamp(tilt0, -Math.asin(Math.min(1, room / hh)), Math.asin(Math.min(1, room / hh)));
      ctx.save();
      ctx.translate(x, base + 2);
      ctx.rotate(tilt);
      poly([[-ww, 0], [-ww, -hh * 0.8], [0, -hh], [0, 0]], vgrad(-hh, 0, [[0, cf], [1, cs]]));
      poly([[0, 0], [0, -hh], [ww, -hh * 0.8], [ww, 0]], vgrad(-hh, 0, [[0, cs], [1, cd]]));
      poly([[-ww, -hh * 0.8], [0, -hh], [0, -hh * 0.86]], rgba(CREAM, 0.4));
      line(-ww * 0.55, -hh * 0.12, -ww * 0.55, -hh * 0.72, rgba(CREAM, 0.4), 1);
      ctx.restore();
    }
    const gl = [];
    for (let k = 0; k < 8; k++) gl.push([R(r, w * 0.1, w * 0.9), R(r, base - h * 0.6, base), 0.9]);
    dots(gl, rgba(mix(C.accent, CREAM, 0.5), 0.6));
  }

  // Riesenpilze: hohe Stiele, breite Hüte mit Flecken, schwach leuchtende Lamellen, kleine Pilze am Fuß
  function hPilz(w, h, r, C, P) {
    const n = 2 + Math.floor(r() * 2), base = h - 3, stem = mix(CREAM, P.rock, 0.6);
    const list = [];
    for (let k = 0; k < n; k++) list.push([w * (0.22 + 0.56 * (n === 1 ? 0.5 : k / (n - 1))) + R(r, -10, 10), h * R(r, 0.45, 0.95) * (k === 1 ? 1 : 0.85), R(r, -0.25, 0.25)]);
    list.sort((a, b) => b[1] - a[1]);
    for (const [x0, hh, tilt0] of list) {
      const cr = Math.min(w * 0.3, hh * R(r, 0.38, 0.5)), sw = Math.max(4, cr * 0.2);
      const tx = clamp(x0 + Math.sin(tilt0) * hh, cr + 3, w - cr - 3), x = clamp(x0, sw * 2, w - sw * 2), tilt = Math.asin(clamp((tx - x) / hh, -0.5, 0.5)), ty = base - hh;
      ctx.beginPath();
      ctx.moveTo(x - sw * 1.4, base);
      ctx.quadraticCurveTo(x - sw * 0.6, base - hh * 0.5, tx - sw * 0.7, ty + 4);
      ctx.lineTo(tx + sw * 0.7, ty + 4);
      ctx.quadraticCurveTo(x + sw * 0.8, base - hh * 0.5, x + sw * 1.5, base);
      ctx.closePath();
      ctx.fillStyle = hgrad(x - sw, x + sw, [[0, shade(stem, 0.1)], [1, shade(stem, -0.3)]]);
      ctx.fill();
      // Lamellen mit Schein
      glow(tx, ty + 6, cr * 1.1, C.accent, 0.22);
      ellipse(tx, ty + 2, cr * 0.92, cr * 0.18, tilt * 0.5, rgba(mix(C.accent, P.cap, 0.4), 0.7));
      // Hut
      ctx.save();
      ctx.translate(tx, ty + 2);
      ctx.rotate(tilt * 0.5);
      ctx.beginPath();
      ctx.moveTo(-cr, 0);
      ctx.bezierCurveTo(-cr * 0.95, -cr * 0.75, cr * 0.95, -cr * 0.75, cr, 0);
      ctx.quadraticCurveTo(0, cr * 0.12, -cr, 0);
      ctx.closePath();
      ctx.fillStyle = rgrad(-cr * 0.35, -cr * 0.45, 1, cr * 1.2, [[0, shade(P.cap, 0.22)], [0.6, P.cap], [1, shade(P.cap, -0.3)]]);
      ctx.fill();
      const sp = [];
      for (let k = 0; k < 6; k++) sp.push([R(r, -cr * 0.7, cr * 0.7), -R(r, cr * 0.12, cr * 0.48), R(r, 1.2, cr * 0.09), R(r, 1, cr * 0.06), 0]);
      ellipses(sp, rgba(mix(C.accent, CREAM, 0.5), 0.45));
      ctx.restore();
    }
    const small = [];
    for (let k = 0; k < 5; k++) small.push([R(r, w * 0.1, w * 0.9), base, R(r, 4, 8)]);
    for (const [x, y, s2] of small) {
      line(x, y, x, y - s2 * 1.4, stem, 1.5);
      ellipse(x, y - s2 * 1.4, s2, s2 * 0.5, 0, P.cap);
      circle(x, y - s2 * 1.2, 0.9, rgba(C.accent, 0.6));
    }
  }

  const H_BACK = {
    saeule: { size: r => [R(r, 80, 140), 490], paint: (w, h, r, C) => hSaeule(w, h, r, C, hPal(C)) }
  };
  const H_FRONT = {
    stollen: { size: r => [R(r, 260, 350), R(r, 150, 190)], paint: (w, h, r, C) => hStollen(w, h, r, C, hPal(C)), tex: { grain: 0.05 } },
    kristall: { size: r => [R(r, 120, 190), R(r, 110, 180)], paint: (w, h, r, C) => hKristall(w, h, r, C, hPal(C)), tex: { grain: 0.04 } },
    pilz: { size: r => [R(r, 130, 200), R(r, 120, 200)], paint: (w, h, r, C) => hPilz(w, h, r, C, hPal(C)), tex: { grain: 0.04 } }
  };
  const H_GAP = [260, 620];
  SCENE['Höhle'] = {
    tracks: [
      { z: 0, factor: 0.3, start: 160, gap: [260, 620], maxKs: 1.5, base: () => BASE, kinds: H_BACK },
      {
        z: 2, factor: 0.62, start: 120, gap: H_GAP, maxKs: 2, base: () => BASE, kinds: H_FRONT,
        pick: makePick({
          start: 120, dl: 1300, gapMean: (H_GAP[0] + H_GAP[1]) / 2, widths: meanW(H_FRONT), cd: { stollen: 1 },
          zones: [[1300, { stollen: 3, kristall: 1 }], [2700, { kristall: 3, pilz: 1, stollen: 0.4 }], [4100, { pilz: 3, kristall: 1.5 }]],
          mixed: [{ stollen: 2, kristall: 1.5 }, { kristall: 2, pilz: 2 }, { pilz: 2.5, kristall: 1, stollen: 0.5 }]
        })
      }
    ]
  };
})();

