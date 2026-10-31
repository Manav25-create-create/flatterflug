// ============================================================
// Kulissen, Teil C: Wiese, Ozean, Dschungel, Wüste, Sumpf.
// Einzelmotive für die Kulissen-Engine (b_scene.js). Alles steckt in einer
// eigenen Funktion, damit keine Namen mit anderen Dateien kollidieren; nach
// außen gehen nur die Einträge in SCENE.
// Pro Biom zwei Spuren: eine ferne (z 0, factor 0.08 bis 0.12) hinter der hinteren
// Ebene und eine mittlere (z 1, factor 0.3 bis 0.38) zwischen den Ebenen 0 und 1.
// Jede Spur hat einen festen Auftakt (Ablauf) und variiert danach gewichtet, ohne die
// letzten Motive direkt zu wiederholen. Luftperspektive über Paletten, die Richtung
// Dunst gemischt sind, oder eine Dunstschicht (source-atop); Nebelmotive blenden unten aus.
// Malkosten: node-canvas (Cairo) ist bei langen dünnen Strichen, Verläufen über große
// Flächen und Pfaden mit source-atop teuer. Deshalb Rechtecke statt Striche, wenige
// Verläufe, gebündelte Pfade und knappe Spritegrößen.
// ============================================================
(() => {
  'use strict';

  // ---------- gemeinsame Werkzeuge ----------
  // Ablauf: feste Eröffnung, danach gewichteter Zufall ohne die letzten `mem` Motive.
  // Der Verlauf hängt an der rng-Funktion der Spur, damit Vorschau, Miniatur und Spiel unabhängig bleiben.
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

  // Luftperspektive: alles bereits Gemalte Richtung Dunstfarbe ziehen (optional nach unten stärker)
  function hazeOver(w, h, col, a0, a1, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = a1 === undefined ? rgba(col, a0) : vgrad(y0 === undefined ? 0 : y0, y1 === undefined ? h : y1, [[0, rgba(col, a0)], [1, rgba(col, a1)]]);
    ctx.fillRect(-2, -2, w + 4, h + 4);
    ctx.restore();
  }
  // Unterkante weich ausblenden (Alpha nach unten auf 0), etwa für Motive im Nebel
  function dissolve(w, h, y0, y1) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vgrad(y0, y1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    ctx.fillRect(-2, y0, w + 4, h - y0 + 4);
    ctx.restore();
  }
  // weicher Fleck (Nebel, Schein)
  function soft(x, y, rx, ry, col, a) {
    if (a <= 0.002) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, Math.max(0.01, ry / rx));
    ctx.fillStyle = rgrad(0, 0, 0, rx, [[0, rgba(col, a)], [0.5, rgba(col, a * 0.45)], [1, rgba(col, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  // Pfad aus Punkten, mit quadratischen Kurven geglättet
  function smooth(pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    if (close) ctx.closePath();
  }
  const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ============================================================
  // WIESE: hinter den fernen Hügeln Turmhügel, Dorf, Mühlen und Wald;
  // zwischen den Hügelebenen Felder, Hof, Heu, Mühle, Einzelbaum, Dorf, Aussichtsturm
  // ============================================================
  // Palette der Wiese, um hz Richtung Dunst gezogen (mittlere Spur: leicht, ferne Spur: über die Dunstschicht)
  const wPalCache = new Map();
  function wPal(C, hz) {
    const key = C.skyTop + C.far + (hz || 0);
    let P = wPalCache.get(key);
    if (P) return P;
    P = {
      hillFar: mix(mix(C.far, C.skyBottom, 0.12), C.haze, 0.4),
      hillMid: mix(C.far, C.mid, 0.55),
      wall: mix(CREAM, C.skyBottom, 0.3),
      wall2: mix(CREAM, C.accent, 0.3),
      wall3: mix(CREAM, C.far, 0.22),
      roof: mix('#b25639', C.accent, 0.16),
      roof2: mix('#7f5a45', C.near, 0.12),
      slate: mix('#5f6c79', C.skyTop, 0.3),
      barn: mix('#a14a32', C.near, 0.1),
      wood: mix('#8a6748', C.near, 0.2),
      wheat: mix(C.accent, CREAM, 0.38),
      leaf: shade(C.near, 0.04),
      trunk: mix('#6b4c35', C.near, 0.25)
    };
    if (hz) for (const k of Object.keys(P)) if (k !== 'hillFar') P[k] = mix(P[k], C.haze, hz);
    wPalCache.set(key, P);
    return P;
  }

  // Kuppe, auf der ein Motiv steht. Läuft an beiden Rändern bis zur Unterkante, liefert die Bodenhöhe yAt(x)
  function wHill(w, h, top, col, it, o) {
    o = o || {};
    const r = mulberry32(it.seed + 11), sk = (r() - 0.5) * (o.skew === undefined ? 0.5 : o.skew), p = o.p || 0.55;
    const ph = r() * TAU, wob = o.wob === undefined ? 1.6 : o.wob;
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
    ctx.fillStyle = col;
    ctx.fill();
    // Flecken und Halme nur auf der Kuppe (source-atop statt Clip, das ist billiger); dazu ein
    // hellerer Saum unter dem Kamm statt eines Verlaufs über die ganze Fläche
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.beginPath();
    ctx.moveTo(-1, yAt(0) - 1);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, yAt(x) - 1);
    for (let x = w - (w % 8); x >= 0; x -= 8) ctx.lineTo(x, yAt(x) + 10 + (h - top) * 0.12);
    ctx.closePath();
    ctx.fillStyle = rgba(shade(col, 0.16), 0.45);
    ctx.fill();
    const lt = [], dk = [];
    for (let k = 0; k < (o.patches === false ? 0 : w / 34); k++) {
      const x = r() * w, y = yAt(x) + 6 + r() * (h - top) * 0.7;
      (r() < 0.45 ? lt : dk).push([x, y, 12 + r() * 22, 2.5 + r() * 4, (r() - 0.5) * 0.2]);
    }
    ellipses(lt, rgba(shade(col, 0.14), 0.18));
    ellipses(dk, rgba(shade(col, -0.16), 0.14));
    if (o.grass) {
      for (const [tone, a] of [[-0.24, 0.26]]) {
        ctx.beginPath();
        for (let k = 0; k < w / 7; k++) {
          const x = r() * w, y = yAt(x) + 2 + Math.pow(r(), 1.5) * (h - top), len = 1.5 + r() * 2.2;
          ctx.rect(x, y - len, 0.7, len);
        }
        ctx.fillStyle = rgba(shade(col, tone), a);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(2, yAt(2) + 0.4);
    for (let x = 8; x <= w - 2; x += 6) ctx.lineTo(x, yAt(x) + 0.4);
    for (let x = w - 2 - ((w - 4) % 6); x >= 2; x -= 6) ctx.lineTo(x, yAt(x) + 2);
    ctx.closePath();
    ctx.fillStyle = rgba(CREAM, o.rim || 0.22);
    ctx.fill();
    return yAt;
  }
  // tiefster Bodenpunkt unter einer Grundfläche, damit nichts schwebt
  const footY = (yAt, x0, x1) => Math.max(yAt(x0), yAt(x1), yAt((x0 + x1) / 2)) + 1;

  // Haus mit Giebel links im Licht, Längsseite zum Betrachter etwas dunkler
  function wHouse(x, y, gw, sw, wh, rh, wall, roof, o) {
    o = o || {};
    const yw = y - wh, yr = yw - rh, ov = Math.max(1, gw * 0.07);
    ellipse(x + (gw + sw) * 0.66, y + 0.4, (gw + sw) * 0.62, 1.4 + wh * 0.05, 0, rgba(INK, 0.13));
    if (o.chimney) {
      const cx = x + gw / 2 + sw * o.chimney;
      ctx.fillStyle = shade(roof, -0.28);
      ctx.fillRect(cx, yr - rh * 0.28, Math.max(1.5, gw * 0.14), rh * 0.8);
      ctx.fillStyle = rgba(CREAM, 0.18);
      ctx.fillRect(cx, yr - rh * 0.28, Math.max(0.6, gw * 0.05), rh * 0.8);
    }
    ctx.fillStyle = vgrad(yw, y, [[0, shade(wall, -0.12)], [1, shade(wall, -0.2)]]);
    ctx.fillRect(x + gw, yw, sw, wh);
    poly([[x, y], [x, yw], [x + gw / 2, yr], [x + gw, yw], [x + gw, y]], vgrad(yr, y, [[0, shade(wall, 0.06)], [1, shade(wall, -0.05)]]));
    if (o.planks) {
      const pl = [];
      for (let px = x + 2; px < x + gw + sw - 1; px += 2.2) {
        const top = px < x + gw ? (px < x + gw / 2 ? yw - rh * (px - x) / (gw / 2) : yw - rh * (x + gw - px) / (gw / 2)) : yw;
        pl.push([px, Math.min(y, top + 1), px, y]);
      }
      segs(pl, rgba(INK, 0.12), 0.5);
    }
    const rp = [[x + gw / 2, yr], [x + gw / 2 + sw + ov, yr], [x + gw + sw + ov * 1.5, yw + ov], [x + gw, yw + ov]];
    poly(rp, vgrad(yr, yw + ov, [[0, shade(roof, 0.12)], [1, shade(roof, -0.1)]]));
    // Ziegelreihen, Ortgang und First als schmale Flächen (Striche sind in node-canvas teuer)
    if (rh > 5 && !o.simple) {
      ctx.beginPath();
      for (let t = 0.25; t < 0.99; t += 0.25) {
        const yy = lerp(yr, yw + ov, t), xa = lerp(rp[0][0], rp[3][0], t);
        ctx.rect(xa, yy - 0.3, lerp(rp[1][0], rp[2][0], t) - xa, 0.6);
      }
      ctx.fillStyle = rgba(shade(roof, -0.32), 0.28);
      ctx.fill();
    }
    const vw = Math.max(0.9, ov * 0.9);
    ctx.beginPath();
    ctx.moveTo(x - ov, yw + ov);
    ctx.lineTo(x + gw / 2, yr - vw * 0.7);
    ctx.lineTo(x + gw + ov * 0.3, yw + ov * 0.8);
    ctx.lineTo(x + gw + ov * 0.3 - vw * 0.6, yw + ov * 0.8 + vw * 0.6);
    ctx.lineTo(x + gw / 2, yr + vw * 0.5);
    ctx.lineTo(x - ov + vw * 0.6, yw + ov + vw * 0.6);
    ctx.closePath();
    ctx.fillStyle = shade(roof, -0.15);
    ctx.fill();
    ctx.fillStyle = rgba(CREAM, 0.3);
    ctx.fillRect(x + gw / 2 + 0.6, yr - 0.1, sw + ov - 0.6, 0.8);
    ctx.fillStyle = rgba(INK, 0.2);
    ctx.fillRect(x + gw, yw + ov, sw, Math.max(1, wh * 0.08));
    // Fenster, Tür
    const ww = Math.max(1.4, wh * 0.17), wv = Math.max(1.8, wh * 0.24), win = [];
    if (!o.noWin && !o.simple) {
      const n = Math.max(1, Math.floor(sw / (ww * 3.2)));
      for (let k = 0; k < n; k++) win.push([x + gw + (k + 0.5) * sw / n - ww / 2, yw + wh * 0.32]);
      if (gw > 7) win.push([x + gw / 2 - ww / 2, yw - rh * 0.1 + (o.door === 'gable' ? -wv * 0.6 : wh * 0.32)]);
    }
    ctx.fillStyle = rgba(INK, 0.5);
    for (const [wx, wy] of win) ctx.fillRect(wx, wy, ww, wv);
    ctx.fillStyle = rgba(CREAM, 0.35);
    for (const [wx, wy] of win) ctx.fillRect(wx - 0.3, wy + wv, ww + 0.6, 0.5);
    if (o.door === 'barn') {
      const dw = gw * 0.5, dh = wh * 0.78, dx = x + gw / 2 - dw / 2;
      ctx.fillStyle = shade(wall, -0.35);
      ctx.fillRect(dx, y - dh, dw, dh);
      segs([[dx, y - dh, dx + dw, y], [dx + dw, y - dh, dx, y], [dx + dw / 2, y - dh, dx + dw / 2, y]], rgba(CREAM, 0.5), 0.6);
      ctx.strokeStyle = rgba(CREAM, 0.55);
      ctx.lineWidth = 0.7;
      ctx.strokeRect(dx, y - dh, dw, dh);
    } else if (o.door) {
      const dw = Math.max(1.6, wh * 0.2), dh = wh * 0.45, dx = o.door === 'gable' ? x + gw / 2 - dw / 2 : x + gw + sw * 0.7;
      ctx.fillStyle = shade(roof, -0.35);
      ctx.fillRect(dx, y - dh, dw, dh);
    }
  }

  // Kirche: Schiff mit Giebel links, davor Turm mit spitzem Helm (generisch)
  function wChurch(x, y, s, wall, roof, slate) {
    const tw = 9 * s, th = 34 * s, sh = 24 * s;
    wHouse(x + tw * 0.7, y, 11 * s, 24 * s, 13 * s, 9 * s, wall, roof, { door: false });
    ellipse(x + tw * 0.9, y + 0.4, tw * 0.9, 1.5, 0, rgba(INK, 0.14));
    ctx.fillStyle = hgrad(x, x + tw, [[0, shade(wall, 0.08)], [0.55, wall], [0.56, shade(wall, -0.12)], [1, shade(wall, -0.18)]]);
    ctx.fillRect(x, y - th, tw, th);
    ctx.fillStyle = rgba(INK, 0.16);
    ctx.fillRect(x, y - th + 6 * s, tw, 0.8 * s);
    // Schallöffnungen und Portal
    ctx.fillStyle = rgba(INK, 0.55);
    roundRectPath(x + tw * 0.32, y - th + 1.6 * s, tw * 0.36, 4 * s, tw * 0.18);
    ctx.fill();
    ctx.fillRect(x + tw * 0.4, y - th * 0.55, tw * 0.2, 3 * s);
    roundRectPath(x + tw * 0.3, y - 5 * s, tw * 0.4, 5.2 * s, tw * 0.2);
    ctx.fillStyle = shade(roof, -0.35);
    ctx.fill();
    // Helm: linke Hälfte im Licht
    const ax = x + tw / 2, ay = y - th - sh;
    poly([[x - 1, y - th + 0.5], [ax, ay], [x + tw + 1, y - th + 0.5]], shade(slate, -0.16));
    poly([[x - 1, y - th + 0.5], [ax, ay], [ax, y - th + 0.5]], shade(slate, 0.08));
    line(x - 1, y - th + 0.6, x + tw + 1, y - th + 0.6, shade(slate, -0.3), 0.8);
    circle(ax, ay - 0.8 * s, 0.9 * s, mix(C_GOLD, slate, 0.4));
  }
  const C_GOLD = '#c9a85a';

  // Windmühle (generisch, Turmholländer), Flügel stehen still
  function wMill(cx, y, s, body, cap, sail, ang) {
    const bh = 62 * s, b0 = 13 * s, b1 = 7 * s, top = y - bh;
    ellipse(cx + b0 * 0.6, y + 0.5, b0 * 1.3, 2, 0, rgba(INK, 0.14));
    const pts = [[cx - b0, y], [cx - b1, top], [cx + b1, top], [cx + b0, y]];
    poly(pts, hgrad(cx - b0, cx + b0, [[0, shade(body, 0.08)], [0.45, body], [0.5, shade(body, -0.1)], [1, shade(body, -0.2)]]));
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) { const xa = cx + k * b0 * 0.36, xb = cx + k * b1 * 0.36; ctx.moveTo(xa - 0.3, y); ctx.lineTo(xb - 0.3, top); ctx.lineTo(xb + 0.3, top); ctx.lineTo(xa + 0.3, y); ctx.closePath(); }
    ctx.fillStyle = rgba(INK, 0.1);
    ctx.fill();
    // Galerie mit Geländer
    const gy = y - bh * 0.36, gw = lerp(b0, b1, 0.36) + 4 * s;
    ctx.fillStyle = shade(body, -0.3);
    ctx.fillRect(cx - gw, gy, gw * 2, 1.4 * s);
    ctx.beginPath();
    for (let k = -gw; k <= gw; k += 2.4 * s) ctx.rect(cx + k - 0.25, gy - 2.6 * s, 0.5, 2.6 * s);
    ctx.rect(cx - gw, gy - 2.9 * s, gw * 2, 0.6);
    ctx.fillStyle = rgba(shade(body, -0.35), 0.75);
    ctx.fill();
    ctx.fillStyle = rgba(INK, 0.5);
    roundRectPath(cx - 2 * s, y - 7 * s, 4 * s, 7 * s, 2 * s);
    ctx.fill();
    ctx.fillRect(cx - 1.2 * s, top + bh * 0.2, 2.4 * s, 3 * s);
    // Kappe
    ctx.beginPath();
    ctx.moveTo(cx - b1 - 2 * s, top + 1);
    ctx.quadraticCurveTo(cx - b1, top - 9 * s, cx + 1 * s, top - 10 * s);
    ctx.quadraticCurveTo(cx + b1 + 2 * s, top - 8 * s, cx + b1 + 2 * s, top + 1);
    ctx.closePath();
    ctx.fillStyle = hgrad(cx - b1, cx + b1, [[0, shade(cap, 0.12)], [1, shade(cap, -0.2)]]);
    ctx.fill();
    // Flügel
    const hx = cx - b1 - 1.5 * s, hy = top - 4 * s, L = 44 * s, sw = 7 * s;
    // Flügel: Gitter als schmale Rechtecke im gedrehten Rahmen (ein Pfad je Farbe)
    const sails = (fn, col) => {
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = ang + k * Math.PI / 2;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(a);
        fn();
        ctx.restore();
      }
      ctx.fillStyle = col;
      ctx.fill();
    };
    sails(() => ctx.rect(L * 0.2, 0.6 * s, L * 0.8, sw), rgba(sail, 0.28));
    sails(() => {
      ctx.rect(L * 0.2, 0.6 * s + sw - 0.3, L * 0.8, 0.55);
      ctx.rect(L * 0.2, 0.6 * s + sw / 2 - 0.3, L * 0.8, 0.55);
      for (let t = L * 0.2; t <= L + 0.1; t += L * 0.1) ctx.rect(t - 0.28, 0.6 * s, 0.55, sw);
    }, rgba(shade(sail, -0.15), 0.85));
    sails(() => ctx.rect(0, -0.65 * s, L, 1.3 * s), shade(cap, -0.2));
    circle(hx, hy, 2 * s, shade(cap, -0.3));
  }

  // Aussichtsturm: Holzgerüst mit überdachter Plattform oder runder Steinturm mit Zinnen
  function wLookout(cx, y, s, wood, roof, stone, kind) {
    ellipse(cx + 6 * s, y + 0.5, 15 * s, 2, 0, rgba(INK, 0.14));
    if (kind === 'stone') {
      // runder Bruchsteinturm, leicht verjüngt, mit auskragender Zinnenkrone
      const b0 = 10 * s, b1 = 8.5 * s, th = 42 * s, top = y - th;
      poly([[cx - b0, y], [cx - b1, top], [cx + b1, top], [cx + b0, y]], hgrad(cx - b0, cx + b0, [[0, shade(stone, 0.14)], [0.38, stone], [1, shade(stone, -0.26)]]));
      const jo = [];
      for (let yy = top + 5 * s; yy < y - 1; yy += 3.6 * s) { const t = (y - yy) / th, hw = lerp(b0, b1, t); jo.push([cx - hw, yy, cx + hw, yy]); }
      segs(jo, rgba(INK, 0.1), 0.5);
      ctx.fillStyle = rgba(INK, 0.2);
      ctx.fillRect(cx - b1 - 1.5 * s, top, b1 * 2 + 3 * s, 2 * s);
      const cw = b1 + 2.6 * s;
      ctx.fillStyle = hgrad(cx - cw, cx + cw, [[0, shade(stone, 0.18)], [0.4, shade(stone, 0.04)], [1, shade(stone, -0.22)]]);
      ctx.fillRect(cx - cw, top - 6 * s, cw * 2, 6 * s);
      for (let k = 0; k < 4; k++) ctx.fillRect(cx - cw + k * (cw * 2 - 3 * s) / 3, top - 9.5 * s, 3 * s, 3.6 * s);
      ctx.fillStyle = rgba(INK, 0.5);
      ctx.fillRect(cx - 1.4 * s, top + 8 * s, 2.8 * s, 4 * s);
      ctx.fillRect(cx - 1.2 * s, top + 22 * s, 2.4 * s, 3.6 * s);
      roundRectPath(cx - 2.6 * s, y - 8 * s, 5.2 * s, 8 * s, 2.6 * s);
      ctx.fill();
      return;
    }
    // Holzturm: vier kräftige Stützen, zwei Kreuzfelder, oben eine überdachte Kanzel
    const th = 46 * s, b0 = 11 * s, b1 = 6 * s, top = y - th, dw = shade(wood, -0.28);
    const br = [];
    for (let k = 0; k < 2; k++) {
      const t0 = k / 2, t1 = (k + 1) / 2, ya = lerp(y, top, t0), yb = lerp(y, top, t1), xa = lerp(b0, b1, t0), xb = lerp(b0, b1, t1);
      br.push([cx - xa, ya, cx + xb, yb], [cx + xa, ya, cx - xb, yb], [cx - xb, yb, cx + xb, yb]);
    }
    segs([[cx - b0 * 0.35, y, cx - b1 * 0.35, top], [cx + b0 * 0.35, y, cx + b1 * 0.35, top]], rgba(dw, 0.75), 1.3 * s);
    segs(br, dw, 0.9 * s);
    segs([[cx - b0, y, cx - b1, top]], shade(wood, 0.14), 2.2 * s);
    segs([[cx + b0, y, cx + b1, top]], shade(wood, -0.18), 2.2 * s);
    // Kanzel mit Brüstung, Pfosten und Walmdach
    const kw = b1 + 4 * s, ky = top - 7 * s;
    ctx.fillStyle = hgrad(cx - kw, cx + kw, [[0, shade(wood, 0.12)], [0.5, wood], [1, shade(wood, -0.22)]]);
    ctx.fillRect(cx - kw, ky, kw * 2, 7.5 * s);
    const pl = [];
    for (let k = -kw + 2 * s; k < kw; k += 2.2 * s) pl.push([cx + k, ky + 0.6, cx + k, ky + 7 * s]);
    segs(pl, rgba(INK, 0.16), 0.5);
    ctx.fillStyle = rgba(INK, 0.45);
    ctx.fillRect(cx - kw + 1.2 * s, ky - 6.5 * s, kw * 2 - 2.4 * s, 6.5 * s);
    segs([[cx - kw + 0.8 * s, ky, cx - kw + 0.8 * s, ky - 7 * s], [cx + kw - 0.8 * s, ky, cx + kw - 0.8 * s, ky - 7 * s], [cx, ky, cx, ky - 7 * s]], dw, 1.1 * s);
    const ry = ky - 7 * s, rw = kw + 3 * s;
    poly([[cx - rw, ry], [cx - kw * 0.3, ry - 7 * s], [cx + kw * 0.3, ry - 7 * s], [cx + rw, ry]], vgrad(ry - 7 * s, ry, [[0, shade(roof, 0.1)], [1, shade(roof, -0.12)]]));
    poly([[cx + kw * 0.3, ry - 7 * s], [cx + rw, ry], [cx + rw * 0.55, ry]], rgba(INK, 0.14));
    line(cx - rw, ry + 0.3, cx + rw, ry + 0.3, rgba(INK, 0.25), 0.7);
  }

  // Großer Laubbaum: kräftiger Stamm, breite Krone aus vielen Ballen, Licht oben links
  function wTree(cx, y, s, leaf, bark, r, shx0, shx1) {
    const cw = 62 * s, ch = 48 * s, cy = y - 52 * s;
    // Schatten nur so breit, wie der Boden auf Höhe des Stammfußes reicht
    const sa = Math.max(shx0 === undefined ? -1e9 : shx0, cx - cw * 0.6), sb = Math.min(shx1 === undefined ? 1e9 : shx1, cx + cw * 1.2);
    if (sb > sa) ellipse((sa + sb) / 2, y + 1, (sb - sa) / 2, 3.2 * s, 0, rgba(INK, 0.15));
    ctx.beginPath();
    ctx.moveTo(cx - 9 * s, y + 1);
    ctx.quadraticCurveTo(cx - 4 * s, y - 6 * s, cx - 4.5 * s, cy + 10 * s);
    ctx.lineTo(cx + 4.5 * s, cy + 10 * s);
    ctx.quadraticCurveTo(cx + 4 * s, y - 6 * s, cx + 10 * s, y + 1);
    ctx.closePath();
    ctx.fillStyle = hgrad(cx - 6 * s, cx + 6 * s, [[0, shade(bark, 0.18)], [0.5, bark], [1, shade(bark, -0.3)]]);
    ctx.fill();
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of [[cx, cy + 14 * s, cx - 22 * s, cy - 4 * s], [cx, cy + 12 * s, cx + 24 * s, cy - 2 * s], [cx, cy + 10 * s, cx + 4 * s, cy - 18 * s]]) {
      ctx.moveTo(x0 - 2 * s, y0); ctx.lineTo(x1, y1 - 1.2 * s); ctx.lineTo(x1, y1 + 1.2 * s); ctx.lineTo(x0 + 2 * s, y0); ctx.closePath();
    }
    ctx.fillStyle = shade(bark, -0.1);
    ctx.fill();
    const balls = [];
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI + (r() - 0.5) * 0.3, rr = 0.72 + r() * 0.28;
      balls.push([cx + Math.cos(a) * cw * 0.68 * rr, cy + Math.sin(a) * ch * 0.7 * rr + ch * 0.12, (16 + r() * 8) * s]);
    }
    for (let k = 0; k < 2; k++) balls.push([cx + (k - 0.5) * cw * 0.6, cy + (r() - 0.2) * ch * 0.4, (18 + r() * 6) * s]);
    blobPath(balls.map(([a, b, c]) => [a + 2.5 * s, b + 3 * s, c]));
    ctx.fillStyle = shade(leaf, -0.32);
    ctx.fill();
    blobPath(balls);
    ctx.fillStyle = shade(leaf, 0.04);
    ctx.fill();
    // Licht oben links auf den Ballen, Schatten unten rechts
    // Licht oben links auf den Ballen, Schatten unten rechts, dazu Blattsprenkel (je ein Pfad)
    const hi = balls.filter(b => b[1] < cy + ch * 0.1 && b[0] < cx + cw * 0.5).map(([a, b, c]) => [a - c * 0.25, b - c * 0.3, c * 0.55]);
    const lo = balls.filter(b => b[1] > cy + ch * 0.05).map(([a, b, c]) => [a + c * 0.25, b + c * 0.35, c * 0.55]);
    for (let k = 0; k < 24; k++) {
      const a = r() * TAU, d = Math.sqrt(r());
      (Math.sin(a) < 0 ? hi : lo).push([cx + Math.cos(a) * d * cw * 0.85, cy + Math.sin(a) * d * ch * 0.7, (0.9 + r() * 1.1) * s]);
    }
    dots(hi, rgba(shade(leaf, 0.26), 0.34));
    dots(lo, rgba(shade(leaf, -0.3), 0.32));
  }

  // Pappel / schlanker Baum
  function wPoplar(x, y, hh, leaf, bark) {
    ctx.fillStyle = bark;
    ctx.fillRect(x - 0.8, y - hh * 0.25, 1.6, hh * 0.25);
    ctx.beginPath();
    ctx.ellipse(x, y - hh * 0.58, hh * 0.13, hh * 0.44, 0, 0, TAU);
    ctx.fillStyle = hgrad(x - hh * 0.13, x + hh * 0.13, [[0, shade(leaf, 0.14)], [1, shade(leaf, -0.25)]]);
    ctx.fill();
  }
  function wBale(x, y, rad, hay) {
    ellipse(x + rad * 1.2, y + 0.3, rad * 1.5, rad * 0.22, 0, rgba(INK, 0.16));
    const d = rad * 0.9;
    ctx.fillStyle = vgrad(y - rad * 2, y, [[0, shade(hay, 0.12)], [1, shade(hay, -0.22)]]);
    ctx.fillRect(x, y - rad * 2, d, rad * 2);
    ellipse(x + d, y - rad, rad * 0.32, rad, 0, shade(hay, -0.26));
    circle(x, y - rad, rad, shade(hay, 0.02));
    circle(x - rad * 0.08, y - rad * 1.06, rad * 0.62, shade(hay, 0.1));
    circle(x, y - rad, rad * 0.3, shade(hay, -0.12));
  }
  function wFence(yAt, x0, x1, col, step) {
    const p = [], rl = [];
    for (let x = x0; x <= x1; x += step) p.push([x, yAt(x) + 1, x, yAt(x) - 4.5]);
    for (let x = x0; x < x1 - 0.1; x += step) {
      const xe = Math.min(x1, x + step);
      rl.push([x, yAt(x) - 3.6, xe, yAt(xe) - 3.6], [x, yAt(x) - 1.8, xe, yAt(xe) - 1.8]);
    }
    segs(p, col, 0.8);
    segs(rl, rgba(col, 0.8), 0.5);
  }
  // Felder als Bänder entlang der Hangkontur, gleichfarbige in einem Pfad. Furchen und Saatreihen als
  // kurze Rechtecke in einem gemeinsamen Pfad: in node-canvas und im Browser viel billiger als dünne Striche
  function wFields(yAt, list) {
    const byCol = new Map();
    for (const f of list) { if (!byCol.has(f[4])) byCol.set(f[4], []); byCol.get(f[4]).push(f); }
    for (const [col, fl] of byCol) {
      ctx.beginPath();
      for (const [x0, x1, d0, d1] of fl) {
        const st = Math.max(4, (x1 - x0) / 8);
        ctx.moveTo(x0, yAt(x0) + d0);
        for (let x = x0 + st; x <= x1 + 0.1; x += st) ctx.lineTo(x, yAt(x) + d0);
        for (let x = x1; x >= x0 - 0.1; x -= st) ctx.lineTo(x, yAt(x) + d1);
        ctx.closePath();
      }
      ctx.fillStyle = col;
      ctx.fill();
    }
    ctx.beginPath();
    for (const [x0, x1, d0, d1, , kind] of list) {
      if (kind === 'none') continue;
      const sp = kind === 'rows' ? 3.6 : 5, dx = kind === 'rows' ? 7 : 6, len = kind === 'rows' ? 4.6 : 1.4;
      for (let d = d0 + 2; d < d1 - 1; d += sp) {
        for (let x = x0 + 1 + (d % 2) * 1.5; x < x1 - len; x += dx) ctx.rect(x, yAt(x) + d, len, kind === 'rows' ? 0.6 : 1);
      }
    }
    ctx.fillStyle = rgba(INK, 0.14);
    ctx.fill();
  }
  // Hecken entlang der Feldraine aus kleinen Blöcken, mit hellerer Oberkante
  function wHedges(yAt, list, col) {
    ctx.beginPath();
    for (const [x0, x1, d] of list) for (let x = x0; x < x1 - 1; x += 3.6) ctx.rect(x, yAt(x) + d - 1.3 - hash(x + d) * 0.8, 4, 2.6);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.beginPath();
    for (const [x0, x1, d] of list) for (let x = x0 + 0.5; x < x1 - 1; x += 7.2) ctx.rect(x, yAt(x) + d - 1.8 - hash(x + d) * 0.8, 2.4, 0.8);
    ctx.fillStyle = rgba(shade(col, 0.4), 0.4);
    ctx.fill();
  }
  // viele kleine Bäume in einem Zug (Stämme, Schatten, Kronen, Lichter je ein Pfad)
  function wTrees(list, leaf, bark) {
    if (!list.length) return;
    let y0 = 1e9, y1 = -1e9;
    ctx.beginPath();
    for (const [x, y, rr] of list) { ctx.rect(x - rr * 0.12, y - rr * 1.1, rr * 0.24, rr * 1.1); y0 = Math.min(y0, y - rr * 2.5); y1 = Math.max(y1, y - rr * 0.4); }
    ctx.fillStyle = bark;
    ctx.fill();
    const blobs = [];
    for (const [x, y, rr] of list) blobs.push([x, y - rr * 1.5, rr], [x - rr * 0.6, y - rr * 1.15, rr * 0.7], [x + rr * 0.62, y - rr * 1.2, rr * 0.72]);
    blobPath(blobs.map(([a, c, d]) => [a + d * 0.16, c + d * 0.2, d]));
    ctx.fillStyle = shade(leaf, -0.28);
    ctx.fill();
    blobPath(blobs);
    ctx.fillStyle = vgrad(y0, y1, [[0, shade(leaf, 0.16)], [1, shade(leaf, -0.14)]]);
    ctx.fill();
    dots(list.map(([x, y, rr]) => [x - rr * 0.3, y - rr * 1.8, rr * 0.42]), rgba(shade(leaf, 0.24), 0.35));
  }

  // ---------- Wiese: Motive der mittleren Spur (Kuppen zwischen den Hügelebenen) ----------
  const W_MID = 460;                   // Unterkante: sicher hinter der vorderen Hügelebene (Kamm 430 bis 452)
  const wTop = (it, h, worldY) => worldY - (it.yb - h);   // Weltkoordinate -> lokal
  const wiMid = {
    fields: {
      size: r => [250 + r() * 50, 108],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.1), yAt = wHill(w, h, wTop(it, h, 380 + r() * 10), P.hillMid, it, { p: 0.36, skew: 0.5, patches: false });
        ctx.save();
        const cols = [[P.wheat, 'rows'], [shade(P.hillMid, 0.12), 'grid'], [mix(P.wood, P.hillMid, 0.45), 'rows'], [shade(P.hillMid, -0.1), 'none'], [mix(P.wheat, P.hillMid, 0.45), 'grid']];
        let x = 6 + r() * 20, ci = Math.floor(r() * cols.length);
        const hedges = [], fl = [];
        while (x < w - 24) {
          const xw = 80 + r() * 60, x1 = Math.min(w - 4, x + xw), nb = 2 + (r() < 0.25 ? 1 : 0);
          let d = 4 + r() * 3;
          for (let band = 0; band < nb; band++) {
            const dd = d + 14 + r() * 16, [c, k] = cols[ci % cols.length];
            fl.push([x, x1, d, dd, rgba(c, 0.8), k]);
            hedges.push([x, x1, dd + 1]);
            d = dd + 2.5;
            ci += 1 + Math.floor(r() * 2);
          }
          x = x1 + 5 + r() * 6;
        }
        wFields(yAt, fl);
        wHedges(yAt, hedges, rgba(shade(P.hillMid, -0.36), 0.75));
        ctx.restore();
        // Bäume an den Feldrainen und eine Feldscheune
        const tl = [];
        for (let k = 0; k < 4; k++) { const t = w * (0.12 + r() * 0.76); tl.push([t, yAt(t) + 3 + r() * 6, 4.5 + r() * 2.5]); }
        tl.sort((a, b) => a[1] - b[1]);
        wTrees(tl, P.leaf, P.trunk);
        const sx = w * (0.4 + r() * 0.3), sy = footY(yAt, sx, sx + 18);
        wHouse(sx, sy, 8, 12, 7, 5, P.wood, P.roof2, { noWin: true });
      },
      tex: null
    },
    farm: {
      size: r => [250 + r() * 50, 118],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.08), yAt = wHill(w, h, wTop(it, h, 404 + r() * 6), P.hillMid, it, { p: 0.45, skew: 0.3, grass: true });
        const x0 = w * 0.2 + r() * 10;
        // Bäume hinter dem Hof
        wTrees([[x0 - 10, footY(yAt, x0 - 14, x0 - 6) + 2, 9], [x0 + 130, footY(yAt, x0 + 126, x0 + 134) + 2, 11]], P.leaf, P.trunk);
        // Silo
        const sx = x0 + 62, sy = footY(yAt, sx, sx + 11), sh = 36;
        ctx.fillStyle = hgrad(sx, sx + 11, [[0, shade(P.slate, 0.35)], [0.4, shade(P.slate, 0.15)], [1, shade(P.slate, -0.15)]]);
        ctx.fillRect(sx, sy - sh, 11, sh);
        ctx.beginPath();
        ctx.ellipse(sx + 5.5, sy - sh, 5.5, 5, 0, Math.PI, TAU);
        ctx.fill();
        segs([[sx, sy - sh * 0.33, sx + 11, sy - sh * 0.33], [sx, sy - sh * 0.66, sx + 11, sy - sh * 0.66]], rgba(INK, 0.15), 0.6);
        // Scheune und Wohnhaus
        const bx = x0 + 6, by = footY(yAt, bx, bx + 62);
        wHouse(bx, by, 26, 32, 18, 15, P.barn, P.slate, { door: 'barn', planks: true, noWin: true });
        const hx = x0 + 86, hy = footY(yAt, hx, hx + 44);
        wHouse(hx, hy, 15, 26, 14, 10, P.wall, P.roof, { chimney: 0.7, door: 'side' });
        wFence(yAt, x0 - 30, x0 + 4, rgba(shade(P.wood, 0.1), 0.85), 5);
        wFence(yAt, hx + 46, Math.min(w - 20, hx + 90), rgba(shade(P.wood, 0.1), 0.85), 5);
        wBale(x0 - 2, footY(yAt, x0 - 2, x0 + 6) + 1, 4, P.wheat);
      },
      tex: { grain: 0.035 }
    },
    hay: {
      size: r => [200 + r() * 50, 96],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.08), yAt = wHill(w, h, wTop(it, h, 398 + r() * 8), P.hillMid, it, { p: 0.6 });
        // Stoppelfeld mit Mähreihen entlang der Kontur
        ctx.beginPath();
        ctx.moveTo(0, h + 2);
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, yAt(x) + 3);
        ctx.lineTo(w, yAt(w) + 3);
        ctx.lineTo(w, h + 2);
        ctx.closePath();
        ctx.fillStyle = vgrad(0, h, [[0, mix(P.wheat, P.hillMid, 0.1)], [1, mix(P.wheat, P.hillMid, 0.5)]]);
        ctx.fill();
        ctx.beginPath();
        for (let d = 8; d < h; d += 5) for (let x = 2 + (d % 2) * 3; x < w - 3; x += 6) ctx.rect(x, yAt(x) + d, 3.4, 0.8);
        ctx.fillStyle = rgba(shade(P.wheat, -0.28), 0.32);
        ctx.fill();
        wHedges(yAt, [[2, w - 2, 3]], rgba(shade(P.hillMid, -0.3), 0.8));
        const n = 4 + Math.floor(r() * 3), bales = [];
        for (let k = 0; k < n; k++) {
          const bx = w * (0.15 + 0.7 * (k + r() * 0.6) / n), dep = 6 + r() * 14;
          bales.push([bx, yAt(bx) + dep, 4.5 + r() * 1.5 + dep * 0.06]);
        }
        bales.sort((a, b) => a[1] - b[1]);
        for (const [bx, by, rr] of bales) wBale(bx, by, rr, P.wheat);
        if (r() < 0.6) { const tx = w * (0.75 + r() * 0.15); wTrees([[tx, yAt(tx) + 3, 8]], P.leaf, P.trunk); }
      },
      tex: null
    },
    windmill: {
      size: r => [150 + r() * 30, 205],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.08), yAt = wHill(w, h, wTop(it, h, 392 + r() * 8), P.hillMid, it, { p: 0.5, skew: 0.2, grass: true });
        const cx = w * (0.48 + (r() - 0.5) * 0.1), y = footY(yAt, cx - 12, cx + 12);
        if (r() < 0.7) wTrees([[cx + 34, footY(yAt, cx + 30, cx + 38) + 1, 7]], P.leaf, P.trunk);
        wMill(cx, y + 1, 1.12, mix(P.wall, P.wood, 0.2), P.roof2, mix(CREAM, C.haze, 0.1), 0.25 + r() * 0.5);
        wHouse(cx - 44, footY(yAt, cx - 44, cx - 22), 9, 13, 8, 6, P.wall2, P.roof, { door: 'side' });
      },
      tex: { grain: 0.035 }
    },
    bigtree: {
      size: r => [196 + r() * 26, 194],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.06), yAt = wHill(w, h, wTop(it, h, 398 + r() * 6), P.hillMid, it, { p: 0.5 });
        const cx = w * (0.5 + (r() - 0.5) * 0.12), y = footY(yAt, cx - 8, cx + 8);
        let sa = cx, sb = cx;
        while (sa > 0 && yAt(sa - 2) < y + 2) sa -= 2;
        while (sb < w && yAt(sb + 2) < y + 2) sb += 2;
        wTree(cx, y + 1, 1.25, P.leaf, P.trunk, r, sa + 6, sb - 6);
      },
      tex: { grain: 0.035 }
    },
    village: {
      size: r => [290 + r() * 40, 146],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.08), yAt = wHill(w, h, wTop(it, h, 402 + r() * 6), P.hillMid, it, { p: 0.4, skew: 0.25 });
        // Bäume hinter den Häusern
        const back = [];
        for (let k = 0; k < 5; k++) { const tx = w * (0.12 + k * 0.18 + r() * 0.05); back.push([tx, footY(yAt, tx - 3, tx + 3) - 1, 7 + r() * 4]); }
        wTrees(back, shade(P.leaf, -0.05), P.trunk);
        const walls = [P.wall, P.wall2, P.wall3], roofs = [P.roof, P.roof, P.roof2, P.slate];
        const ch = w * (0.38 + r() * 0.2), spots = [];
        for (let x = w * 0.12; x < w * 0.86; x += 38 + r() * 12) if (Math.abs(x - ch) > 34) spots.push(x);
        // hintere Häuser auf der Kuppe, jedes zweite etwas tiefer am Hang
        spots.forEach((x, k) => {
          const gw = 9 + r() * 5, sw = 14 + r() * 10, wh = 10 + r() * 5;
          wHouse(x, footY(yAt, x, x + gw + sw) + (k % 2 ? 6 : 0), gw, sw, wh, wh * 0.7, pickOf(r, walls), pickOf(r, roofs), { chimney: r() < 0.5 ? 0.6 : 0, door: r() < 0.5 ? 'side' : 'gable' });
        });
        wChurch(ch, footY(yAt, ch, ch + 38) + 1, 1.2, P.wall, P.roof2, P.slate);
        const front = [];
        for (let k = 0; k < 2; k++) { const tx = w * (0.25 + k * 0.42 + r() * 0.06); front.push([tx, footY(yAt, tx - 3, tx + 3) + 12, 6 + r() * 3]); }
        wTrees(front, P.leaf, P.trunk);
      },
      tex: { grain: 0.035 }
    },
    towerhill: {
      size: r => [210 + r() * 40, 215],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.08), yAt = wHill(w, h, wTop(it, h, 336 + r() * 10), shade(P.hillMid, -0.03), it, { p: 0.85, skew: 0.4, grass: true });
        let px = 0;
        for (let x = 0; x < w; x += 2) if (yAt(x) < yAt(px)) px = x;
        const trees = [];
        for (let k = 0; k < 9; k++) {
          const tx = w * (0.08 + r() * 0.84);
          if (Math.abs(tx - px) < 16) continue;
          trees.push([tx, yAt(tx) + 6 + r() * 16, 6 + r() * 4]);
        }
        trees.sort((a, b) => a[1] - b[1]);
        wTrees(trees, P.leaf, P.trunk);
        wLookout(px, footY(yAt, px - 8, px + 8) + 1, 1.1, P.wood, P.roof2, mix(P.wall3, P.slate, 0.3), r() < 0.55 ? 'wood' : 'stone');
      },
      tex: { grain: 0.035 }
    },
    orchard: {
      size: r => [220 + r() * 50, 96],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C, 0.08), top = wTop(it, h, 398 + r() * 6), yAt = wHill(w, h, top, P.hillMid, it, { p: 0.3, skew: 0.2, grass: true });
        // Obstbäume in Reihen auf der flachen Kuppe, nur wo der Boden nahe der Kuppenhöhe liegt
        const rows = [], fruit = [];
        for (let row = 0; row < 2; row++) {
          for (let x = 12 + row * 11; x < w - 12; x += 22 + r() * 5) {
            const gy = yAt(x), y = Math.max(gy + 3, top + 6 + row * 7);
            if (gy > top + 14) continue;
            const rr = 5 + r() * 1.5;
            rows.push([x + (r() - 0.5) * 3, y, rr]);
            if (r() < 0.6) fruit.push([x - rr * 0.3, y - rr * 1.5, 0.9], [x + rr * 0.4, y - rr * 1.2, 0.8]);
          }
        }
        rows.sort((a, b) => a[1] - b[1]);
        wTrees(rows, mix(P.leaf, C.accent, 0.08), P.trunk);
        dots(fruit, mix(P.roof, C.accent, 0.3));
        // Zaun vor den Reihen, nur wo der Hang noch hoch genug ist
        let xa = w, xb = 0;
        for (let x = 0; x <= w; x += 4) if (yAt(x) <= top + 24) { xa = Math.min(xa, x); xb = Math.max(xb, x); }
        if (xb - xa > 30) wFence(() => top + 28, xa + 6, xb - 6, rgba(shade(P.wood, 0.05), 0.7), 6);
      },
      tex: { grain: 0.035 }
    }
  };

  // ---------- Wiese: ferne Motive hinter der hinteren Hügelebene (Kamm 328 bis 368) ----------
  const W_FAR = 376;
  const wiFar = {
    ftower: {
      size: r => [180 + r() * 50, 138],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C), yAt = wHill(w, h, wTop(it, h, 290 + r() * 12), P.hillFar, it, { p: 0.8, skew: 0.5, rim: 0.3 });
        let px = 0;
        for (let x = 0; x < w; x += 2) if (yAt(x) < yAt(px)) px = x;
        const tr = [];
        for (let k = 0; k < 40; k++) { const x = r() * w; if (Math.abs(x - px) > 8) tr.push([x, yAt(x) + 2 + r() * 10, 1.8 + r() * 2]); }
        dots(tr, rgba(shade(P.hillFar, -0.2), 0.7));
        wLookout(px, footY(yAt, px - 4, px + 4) + 1, 0.62, P.wood, P.roof2, P.wall3, r() < 0.5 ? 'wood' : 'stone');
        hazeOver(w, h, C.haze, 0.34);
      },
      tex: null
    },
    fvillage: {
      size: r => [220 + r() * 60, 124],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C), yAt = wHill(w, h, wTop(it, h, 300 + r() * 10), P.hillFar, it, { p: 0.45, rim: 0.3 });
        const ch = w * (0.4 + r() * 0.2), walls = [P.wall, P.wall2, P.wall3], roofs = [P.roof, P.roof2, P.slate];
        for (let x = w * 0.18; x < w * 0.82; x += 13 + r() * 6) {
          if (Math.abs(x - ch) < 12) continue;
          const gw = 5 + r() * 2, sw = 7 + r() * 5, wh = 5 + r() * 2;
          wHouse(x, footY(yAt, x, x + gw + sw) + r() * 3, gw, sw, wh, wh * 0.7, pickOf(r, walls), pickOf(r, roofs), { simple: true });
        }
        wChurch(ch, footY(yAt, ch, ch + 16) + 1, 0.55, P.wall, P.roof2, P.slate);
        const tr = [];
        for (let k = 0; k < 26; k++) { const x = r() * w; tr.push([x, yAt(x) + 6 + r() * 12, 1.8 + r() * 1.8]); }
        dots(tr, rgba(shade(P.hillFar, -0.2), 0.7));
        hazeOver(w, h, C.haze, 0.36);
      },
      tex: null
    },
    fmills: {
      size: r => [200 + r() * 60, 146],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C), yAt = wHill(w, h, wTop(it, h, 300 + r() * 10), P.hillFar, it, { p: 0.4, skew: 0.3, rim: 0.3 });
        const n = 2 + (r() < 0.4 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const cx = w * (0.28 + 0.46 * k / Math.max(1, n - 1)) + (r() - 0.5) * 10;
          wMill(cx, footY(yAt, cx - 5, cx + 5) + 1, 0.42 + r() * 0.08, P.wall, P.roof2, CREAM, r() * 1.4);
        }
        const tr = [];
        for (let k = 0; k < 30; k++) { const x = r() * w; tr.push([x, yAt(x) + 3 + r() * 14, 1.6 + r() * 1.6]); }
        dots(tr, rgba(shade(P.hillFar, -0.18), 0.6));
        hazeOver(w, h, C.haze, 0.36);
      },
      tex: null
    },
    fforest: {
      size: r => [230 + r() * 70, 112],
      paint: (w, h, r, C, L, it) => {
        const P = wPal(C), yAt = wHill(w, h, wTop(it, h, 306 + r() * 10), P.hillFar, it, { p: 0.6, rim: 0.2 });
        const dk = shade(mix(P.hillFar, C.near, 0.25), -0.12), crowns = [], hi = [];
        for (let x = 4; x < w - 4; x += 3 + r() * 3) {
          const e = Math.sin(Math.PI * x / w);
          if (e < 0.3) continue;
          const y = yAt(x) + 1 + r() * 4, rr = 3.5 + r() * 3.5 * e;
          crowns.push([x, y, rr]);
          hi.push([x - rr * 0.3, y - rr * 0.35, rr * 0.5]);
        }
        dots(crowns, dk);
        dots(hi, rgba(shade(dk, 0.18), 0.6));
        for (let k = 0; k < 4; k++) { const x = w * (0.2 + r() * 0.6); wPoplar(x, yAt(x) + 2, 20 + r() * 8, dk, shade(dk, -0.3)); }
        hazeOver(w, h, C.haze, 0.32);
      },
      tex: null
    }
  };

  SCENE['Wiese'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 30, gap: [40, 160], maxKs: 1.5, base: () => W_FAR,
        pick: flow(['fforest', 'ftower', 'fvillage', 'fmills'], [['ftower', 2], ['fvillage', 2], ['fmills', 2], ['fforest', 1.5]], 1),
        kinds: wiFar },
      { z: 1, factor: 0.38, start: 10, gap: [-10, 70], maxKs: 2, base: () => W_MID,
        pick: flow(['fields', 'farm', 'hay', 'windmill', 'bigtree', 'village', 'towerhill', 'orchard'],
          [['fields', 2], ['farm', 1.6], ['hay', 1.6], ['windmill', 1.5], ['bigtree', 1.4], ['village', 1.6], ['towerhill', 1.2], ['orchard', 1.3]], 3),
        kinds: wiMid }
    ]
  };
  // ============================================================
  // OZEAN: hinter dem Riff blasse Silhouetten (Tempel, Wrack, Korallentürme, Felsbogen,
  // Tangwald); davor auf dem Meeresgrund Muschel, Anker, Wrack, Taucherglocke, Säulen,
  // Tangwald und Korallenriesen
  // ============================================================
  const oPalCache = new Map();
  function oPal(C, hz) {
    const key = C.skyTop + (hz || 0);
    let P = oPalCache.get(key);
    if (P) return P;
    const water = mix(C.haze, C.skyBottom, 0.3);
    P = {
      water,
      sand: mix(mix(CREAM, C.far, 0.45), water, 0.25),
      stone: mix(mix(CREAM, C.far, 0.42), C.accent, 0.08),
      wood: mix('#6a4c34', C.far, 0.42),
      dark: mix(INK, C.near, 0.45),
      metal: mix('#a8844c', C.far, 0.4),
      verd: mix(C.accent, C.far, 0.35),
      coral: mix(C.pipe, C.far, 0.22),
      coral2: mix(mix(C.pipe, '#e7b35a', 0.45), C.far, 0.25),
      pale: mix(C.accent, CREAM, 0.25),
      kelp: mix('#7a8c40', C.mid, 0.42),
      rock: mix(C.far, C.near, 0.35)
    };
    if (hz) for (const k of Object.keys(P)) if (k !== 'water') P[k] = mix(P[k], water, hz);
    oPalCache.set(key, P);
    return P;
  }

  // Sandwehe am Fuß eines Motivs: weiche Kuppe bis zur Unterkante
  function oSand(x0, x1, yb, hgt, col, r) {
    const n = 7, pts = [[x0, yb + 2]];
    for (let k = 1; k < n; k++) {
      const t = k / n, e = Math.sin(t * Math.PI);
      pts.push([lerp(x0, x1, t), yb - hgt * Math.pow(e, 0.6) * (0.75 + r() * 0.5)]);
    }
    pts.push([x1, yb + 2]);
    smooth(pts, true);
    ctx.fillStyle = vgrad(yb - hgt, yb, [[0, shade(col, 0.08)], [1, shade(col, -0.12)]]);
    ctx.fill();
    ctx.beginPath();
    for (let k = 0; k < (x1 - x0) / 9; k++) ctx.rect(lerp(x0, x1, 0.1 + r() * 0.8), yb - hgt * (0.1 + r() * 0.5), 1.2 + r() * 2, 0.8);
    ctx.fillStyle = rgba(shade(col, -0.25), 0.4);
    ctx.fill();
  }
  // Fels als unregelmäßiger Buckel, Licht von oben links
  function oRock(cx, yb, rw, rh, col, r) {
    const pts = [[cx - rw, yb + 2]];
    for (let k = 1; k < 8; k++) {
      const a = Math.PI - k / 8 * Math.PI;
      pts.push([cx + Math.cos(a) * rw * (0.85 + r() * 0.2), yb - Math.sin(a) * rh * (0.8 + r() * 0.3)]);
    }
    pts.push([cx + rw, yb + 2]);
    smooth(pts, true);
    ctx.fillStyle = col;
    ctx.fill();
    ellipse(cx + rw * 0.35, yb - rh * 0.3, rw * 0.5, rh * 0.45, 0, rgba(INK, 0.12));
    ellipse(cx - rw * 0.35, yb - rh * 0.72, rw * 0.36, rh * 0.18, 0, rgba(CREAM, 0.08));
  }
  // Algenbüschel und kleine Korallen als Bewuchs
  function oWeeds(list, col) {
    ctx.beginPath();
    for (const [x, y, hh, lean] of list) {
      for (let k = -1; k <= 1; k++) {
        const bx = x + k * 1.6, l = lean + k * 1.5;
        ctx.moveTo(bx - 1, y);
        ctx.quadraticCurveTo(bx - 0.5 + l * 0.4, y - hh * 0.6, bx + l, y - hh * (1 - Math.abs(k) * 0.25));
        ctx.quadraticCurveTo(bx + 0.5 + l * 0.4, y - hh * 0.6, bx + 1, y);
        ctx.closePath();
      }
    }
    ctx.fillStyle = col;
    ctx.fill();
  }
  // verzweigte Koralle als gefüllte, sich verjüngende Äste in einem Pfad
  function oBranchCoral(x, y, len, wid, col, r, depth) {
    const segsL = [];
    const grow = (x0, y0, a, l, wd, d) => {
      const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l, w1 = wd * 0.72;
      segsL.push([x0, y0, x1, y1, wd, w1]);
      if (d < depth) {
        grow(x1, y1, a - 0.35 - r() * 0.3, l * (0.68 + r() * 0.15), w1, d + 1);
        grow(x1, y1, a + 0.3 + r() * 0.3, l * (0.68 + r() * 0.15), w1, d + 1);
      } else segsL.push([x1, y1, x1, y1, w1 * 1.3, 0]);
    };
    grow(x, y, -Math.PI / 2 + (r() - 0.5) * 0.3, len, wid, 0);
    const shape = dx => {
      ctx.beginPath();
      for (const [x0, y0, x1, y1, w0, w1] of segsL) {
        if (x0 === x1 && y0 === y1) { ctx.moveTo(x0 + dx + w0 / 2, y0); ctx.arc(x0 + dx, y0, w0 / 2, 0, TAU); continue; }
        const dl = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / dl, ny = (x1 - x0) / dl;
        ctx.moveTo(x0 + dx + nx * w0 / 2, y0 + ny * w0 / 2);
        ctx.lineTo(x1 + dx + nx * w1 / 2, y1 + ny * w1 / 2);
        ctx.lineTo(x1 + dx - nx * w1 / 2, y1 - ny * w1 / 2);
        ctx.lineTo(x0 + dx - nx * w0 / 2, y0 - ny * w0 / 2);
        ctx.closePath();
        ctx.moveTo(x0 + dx + w0 / 2, y0);
        ctx.arc(x0 + dx, y0, w0 / 2, 0, TAU);
      }
    };
    shape(1.6);
    ctx.fillStyle = shade(col, -0.25);
    ctx.fill();
    shape(0);
    ctx.fillStyle = vgrad(y - len * 2.6, y, [[0, shade(col, 0.16)], [1, shade(col, -0.08)]]);
    ctx.fill();
  }
  // Hirnkoralle: Kuppel mit gewundenen Rillen
  function oBrain(cx, yb, rw, rh, col, r) {
    ctx.beginPath();
    ctx.ellipse(cx, yb, rw, rh, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = vgrad(yb - rh, yb, [[0, shade(col, 0.16)], [1, shade(col, -0.18)]]);
    ctx.fill();
    ctx.beginPath();
    for (let k = 1; k < 5; k++) {
      const ry = rh * k / 5, rx = rw * Math.sqrt(1 - Math.pow(k / 5, 2)) * 0.92, y = yb - ry;
      for (let t = -rx; t < rx - 2; t += 3.2) ctx.rect(cx + t, y + Math.sin(t * 0.5 + k * 1.7) * 1.4, 2.4, 0.8);
    }
    ctx.fillStyle = rgba(shade(col, -0.32), 0.55);
    ctx.fill();
  }
  // Tang in einem Zug: Stängel als schmale Bänder, Blätter und Schwimmblasen je ein Pfad
  function oKelps(list, c, C) {
    const bz = (a, b, cc, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * cc + t * t * t * d; };
    const lL = [], lR = [], bl = [];
    ctx.beginPath();
    for (const [x, base, hh, sw, seed] of list) {
      const r = mulberry32(seed), p = [x, base, x - sw * 0.6, base - hh * 0.35, x + sw, base - hh * 0.7, x + sw * 0.6, base - hh];
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([bz(p[0], p[2], p[4], p[6], t), bz(p[1], p[3], p[5], p[7], t)]); }
      ctx.moveTo(pts[0][0] - 1.8, pts[0][1]);
      for (const [px, py] of pts) ctx.lineTo(px - 1.5, py);
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0] + 1.5, pts[k][1]);
      ctx.closePath();
      const n = Math.floor(hh / 19);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1), px = bz(p[0], p[2], p[4], p[6], t), py = bz(p[1], p[3], p[5], p[7], t), side = k % 2 ? 1 : -1;
        (side > 0 ? lR : lL).push([px + side * 7.5, py - 3, 10 + r() * 4, 3, side * -0.7]);
        if (k % 4 === 0) bl.push([px + side * 2, py, 2]);
      }
    }
    ctx.fillStyle = shade(c, -0.15);
    ctx.fill();
    // Blätter als spitze Rauten (billiger als gedrehte Ellipsen)
    for (const [L, col] of [[lL, shade(c, 0.12)], [lR, shade(c, -0.08)]]) {
      ctx.beginPath();
      for (const [x, y, a, b, rot] of L) {
        const ca = Math.cos(rot), sa = Math.sin(rot);
        ctx.moveTo(x + ca * a, y + sa * a);
        ctx.lineTo(x - sa * b, y + ca * b);
        ctx.lineTo(x - ca * a, y - sa * a);
        ctx.lineTo(x + sa * b, y - ca * b);
        ctx.closePath();
      }
      ctx.fillStyle = col;
      ctx.fill();
    }
    dots(bl, mix(c, C.accent, 0.3));
  }
  // Säule mit Basis und Kapitell; abgebrochen mit gezacktem Ende
  function oColumn(x, yb, cw, chh, stone, broken, r) {
    const top = yb - chh;
    ellipse(x + cw * 0.9, yb, cw * 1.1, 2.2, 0, rgba(INK, 0.16));
    ctx.fillStyle = hgrad(x - cw * 0.65, x + cw * 0.65, [[0, shade(stone, -0.08)], [0.5, shade(stone, -0.12)], [1, shade(stone, -0.3)]]);
    ctx.fillRect(x - cw * 0.65, yb - 4, cw * 1.3, 4);
    if (broken) {
      const pts = [[x - cw / 2, yb - 4], [x - cw / 2, top + r() * 6]];
      for (let k = 1; k < 5; k++) pts.push([x - cw / 2 + cw * k / 5, top + (k % 2 ? -3 - r() * 4 : 2 + r() * 3)]);
      pts.push([x + cw / 2, top + r() * 8], [x + cw / 2, yb - 4]);
      poly(pts, stone);
      ctx.fillStyle = rgba(INK, 0.2);
      ctx.fillRect(x + cw * 0.22, top + 8, cw * 0.28, yb - top - 12);
    } else {
      ctx.fillStyle = stone;
      ctx.fillRect(x - cw / 2, top + 5, cw, chh - 9);
      ctx.fillStyle = shade(stone, 0.06);
      ctx.fillRect(x - cw * 0.75, top, cw * 1.5, 3.4);
      ctx.fillRect(x - cw * 0.6, top + 3.4, cw * 1.2, 2);
      ctx.fillStyle = rgba(CREAM, 0.16);
      ctx.fillRect(x - cw / 2, top + 5, cw * 0.22, chh - 9);
      ctx.fillStyle = rgba(INK, 0.2);
      ctx.fillRect(x + cw * 0.22, top + 5, cw * 0.28, chh - 9);
      ctx.fillRect(x + cw * 0.3, top, cw * 0.45, 5.4);
    }
    ctx.beginPath();
    for (let k = 1; k < 4; k++) ctx.rect(x - cw / 2 + cw * k / 4 - 0.4, top + 6, 0.8, chh - 11);
    ctx.fillStyle = rgba(INK, 0.12);
    ctx.fill();
  }

  const O_MID = GROUND_Y + 6;          // Meeresgrund: Unterkante hinter dem Bodenstreifen
  const oMid = {
    clam: {
      size: r => [150 + r() * 30, 92],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.24), yb = h - 4, cx = w * 0.48;
        oRock(cx, yb, w * 0.34, 30, P.rock, r);
        // Riesenmuschel: untere Schale, Mantel, obere Schale leicht geöffnet
        const sw = 44 + r() * 8, sy = yb - 26, open = 7 + r() * 4;
        const lip = (y0, dir) => { const pts = []; for (let k = 0; k <= 10; k++) pts.push([cx - sw + k * sw / 5, y0 + (k % 2 ? dir * 4 : 0)]); return pts; };
        ctx.beginPath();
        ctx.moveTo(cx - sw, sy);
        ctx.quadraticCurveTo(cx - sw * 0.6, sy + 22, cx, sy + 24);
        ctx.quadraticCurveTo(cx + sw * 0.6, sy + 22, cx + sw, sy);
        for (const [px, py] of lip(sy, 1).reverse()) ctx.lineTo(px, py);
        ctx.closePath();
        ctx.fillStyle = vgrad(sy, sy + 24, [[0, shade(P.pale, 0.04)], [1, shade(P.pale, -0.3)]]);
        ctx.fill();
        // Mantel
        ctx.beginPath();
        const ml = lip(sy - 1, 1), mu = lip(sy - open, -1);
        ctx.moveTo(ml[0][0], ml[0][1]);
        for (const p of ml) ctx.lineTo(p[0], p[1]);
        for (const p of mu.reverse()) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
        ctx.fillStyle = hgrad(cx - sw, cx + sw, [[0, mix(P.verd, C.accent, 0.4)], [0.5, mix(P.verd, '#6e5aa8', 0.3)], [1, shade(P.verd, -0.2)]]);
        ctx.fill();
        const spots = [];
        for (let k = 0; k < 14; k++) spots.push([cx - sw * 0.9 + r() * sw * 1.8, sy - open * (0.2 + r() * 0.6), 0.8 + r() * 0.8]);
        dots(spots, rgba(mix(C.accent, CREAM, 0.5), 0.6));
        // obere Schale
        ctx.beginPath();
        ctx.moveTo(cx - sw, sy - open);
        ctx.quadraticCurveTo(cx - sw * 0.55, sy - open - 22, cx, sy - open - 24);
        ctx.quadraticCurveTo(cx + sw * 0.55, sy - open - 22, cx + sw, sy - open);
        for (const [px, py] of lip(sy - open, -1).reverse()) ctx.lineTo(px, py);
        ctx.closePath();
        ctx.fillStyle = vgrad(sy - open - 24, sy - open, [[0, shade(P.pale, 0.18)], [1, shade(P.pale, -0.12)]]);
        ctx.fill();
        // Rippen beider Schalen
        ctx.beginPath();
        for (let k = 1; k < 5; k++) {
          const lx = cx - sw + k * sw * 2 / 5;
          ctx.rect(lx - 0.6, sy - open - 22 + Math.abs(k - 2.5) * 5, 1.2, 20 - Math.abs(k - 2.5) * 5);
          ctx.rect(lx - 0.6, sy + 2, 1.2, 18 - Math.abs(k - 2.5) * 5);
        }
        ctx.fillStyle = rgba(INK, 0.14);
        ctx.fill();
        // kleine Korallen und Algen ringsum
        oBranchCoral(cx - sw - 14, yb - 4, 10, 3, P.coral, r, 2);
        oBranchCoral(cx + sw + 18, yb - 2, 12, 3.4, P.coral2, r, 3);
        const wd = [];
        for (let k = 0; k < 6; k++) wd.push([w * (0.1 + r() * 0.8), yb + 1, 8 + r() * 10, (r() - 0.5) * 6]);
        oWeeds(wd, rgba(P.kelp, 0.85));
        oSand(0, w, h, 10, P.sand, r);
      }
    },
    anchor: {
      size: r => [130 + r() * 20, 150],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.24), yb = h - 6, ang = 0.32 + r() * 0.2, cx = w * 0.46;
        const iron = mix(mix('#6b5446', C.far, 0.35), P.water, 0.2);
        // Kette vom Ring in einem Bogen in den Sand
        ctx.save();
        ctx.translate(cx, yb - 6);
        ctx.rotate(ang);
        const L = 104;
        // Arme mit Flunken (zur Hälfte im Sand)
        ctx.strokeStyle = shade(iron, -0.05);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, -30, 30, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
        for (const s of [-1, 1]) {
          const fx = s * 30 * Math.cos(Math.PI * 0.18), fy = -30 + 30 * Math.sin(Math.PI * 0.18);
          poly([[fx, fy], [fx + s * 6, fy - 14], [fx - s * 6, fy - 6]], shade(iron, s < 0 ? 0.1 : -0.15));
        }
        // Schaft, Stock, Ring
        ctx.fillStyle = hgrad(-4, 4, [[0, shade(iron, 0.2)], [0.5, iron], [1, shade(iron, -0.3)]]);
        ctx.fillRect(-3.5, -L, 7, L);
        ctx.fillStyle = vgrad(-L + 8, -L + 14, [[0, shade(iron, 0.18)], [1, shade(iron, -0.25)]]);
        roundRectPath(-30, -L + 8, 60, 6, 3);
        ctx.fill();
        ctx.strokeStyle = shade(iron, -0.1);
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(0, -L - 6, 7, 0, TAU);
        ctx.stroke();
        // Rost und Bewuchs
        const rust = [];
        for (let k = 0; k < 10; k++) rust.push([(r() - 0.5) * 6, -r() * L, 1.2 + r() * 2.4, 0.8 + r() * 1.4, 0]);
        ellipses(rust, rgba(mix(C.pipe, '#7a4a2a', 0.5), 0.45));
        ellipses([[-1, -L * 0.55, 3, 5, 0], [1, -L * 0.25, 2.6, 4, 0]], rgba(P.verd, 0.5));
        ctx.restore();
        // Kette: Glieder abwechselnd quer und längs
        const rx = cx + Math.sin(ang) * (L + 12), ry = yb - 6 - Math.cos(ang) * (L + 12);
        const ex = w * 0.92, ey = yb - 2;
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) {
          const t = k / 16, x = lerp(rx, ex, t), y = lerp(ry, ey, t) + Math.sin(t * Math.PI) * 26 * (1 - t * 0.3);
          if (k % 2) { ctx.moveTo(x + 2.6, y); ctx.ellipse(x, y, 2.6, 1.5, 0.6, 0, TAU); } else { ctx.moveTo(x + 1.2, y); ctx.ellipse(x, y, 1.2, 2.4, 0.6, 0, TAU); }
        }
        ctx.strokeStyle = shade(iron, -0.1);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        oSand(cx - 44, cx + 50, h, 16, P.sand, r);
        oSand(w * 0.6, w + 6, h, 8, P.sand, r);
        const wd = [];
        for (let k = 0; k < 4; k++) wd.push([w * (0.15 + r() * 0.7), h - 8, 6 + r() * 8, (r() - 0.5) * 5]);
        oWeeds(wd, rgba(P.kelp, 0.85));
      }
    },
    wreck: {
      size: r => [290 + r() * 30, 196],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.26), yb = h - 6, L = w * 0.86, Hh = 50, tilt = -0.07 - r() * 0.05;
        const wood = P.wood, dark = P.dark;
        ctx.save();
        ctx.translate(w * 0.06, yb - 8);
        ctx.rotate(tilt);
        // Masten (hinter dem Rumpf), einer mit gebrochener Rah und Tauresten
        const mast = (mx, mh, lean) => {
          ctx.save();
          ctx.translate(mx, -Hh);
          ctx.rotate(lean);
          ctx.fillStyle = hgrad(-3, 3, [[0, shade(wood, 0.15)], [1, shade(wood, -0.25)]]);
          ctx.beginPath();
          ctx.moveTo(-3, 0);
          ctx.lineTo(-2.4, -mh);
          ctx.lineTo(0, -mh + 4);
          ctx.lineTo(1.2, -mh - 3);
          ctx.lineTo(2.6, -mh + 2);
          ctx.lineTo(3, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };
        mast(L * 0.36, 76 + r() * 20, -0.06);
        mast(L * 0.68, 44 + r() * 14, 0.12);
        ctx.save();
        ctx.translate(L * 0.36, -Hh);
        ctx.rotate(-0.06);
        ctx.fillStyle = shade(wood, -0.08);
        ctx.save();
        ctx.translate(0, -58);
        ctx.rotate(0.5);
        ctx.fillRect(-24, -1.5, 40, 3);
        ctx.restore();
        ctx.strokeStyle = rgba(shade(wood, -0.3), 0.7);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-14, -66);
        ctx.quadraticCurveTo(-20, -40, -8, -20);
        ctx.moveTo(10, -50);
        ctx.quadraticCurveTo(16, -30, 30, -8);
        ctx.stroke();
        ctx.restore();
        // Rumpf
        const hull = () => {
          ctx.beginPath();
          ctx.moveTo(0, -Hh - 14);
          ctx.quadraticCurveTo(L * 0.4, -Hh + 2, L * 0.95, -Hh - 6);
          ctx.quadraticCurveTo(L * 1.02, -Hh * 0.4, L * 0.84, 0);
          ctx.lineTo(L * 0.12, 0);
          ctx.quadraticCurveTo(0, -4, 0, -Hh - 14);
          ctx.closePath();
        };
        hull();
        ctx.fillStyle = vgrad(-Hh - 14, 0, [[0, shade(wood, 0.12)], [0.6, wood], [1, shade(wood, -0.3)]]);
        ctx.fill();
        // Planken als schmale Bänder, nur im sicheren Innenbereich des Rumpfs
        ctx.beginPath();
        for (let k = 1; k < 7; k++) {
          const yy = -Hh + k * Hh / 7, xa = L * 0.1, xb = L * 0.86;
          ctx.moveTo(xa, yy - 4.4);
          ctx.quadraticCurveTo(L * 0.45, yy + 5, xb, yy - 2);
          ctx.lineTo(xb, yy - 1);
          ctx.quadraticCurveTo(L * 0.45, yy + 6, xa, yy - 3.4);
          ctx.closePath();
        }
        ctx.fillStyle = rgba(INK, 0.18);
        ctx.fill();
        // Loch mit Spanten
        const hx = L * (0.46 + r() * 0.12), hw = 34 + r() * 14;
        const hole = [[hx - hw / 2, -Hh * 0.62]];
        for (let k = 1; k < 7; k++) hole.push([hx - hw / 2 + hw * k / 7, -Hh * 0.62 + (k % 2 ? -5 : 3) + r() * 3]);
        hole.push([hx + hw / 2, -Hh * 0.55], [hx + hw * 0.38, -6], [hx - hw * 0.4, -4]);
        poly(hole, dark);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) ctx.rect(hx - hw * 0.4 + k * hw * 0.25, -Hh * 0.62, 2.4, Hh * 0.6);
        ctx.fillStyle = shade(wood, -0.2);
        ctx.fill();
        // Reling, Achterkastell mit Fenstern, Stückpforten
        ctx.fillStyle = shade(wood, 0.2);
        ctx.beginPath();
        ctx.moveTo(0, -Hh - 14);
        ctx.quadraticCurveTo(L * 0.4, -Hh + 2, L * 0.95, -Hh - 6);
        ctx.lineTo(L * 0.95, -Hh - 3.6);
        ctx.quadraticCurveTo(L * 0.4, -Hh + 4.4, 0, -Hh - 11.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(wood, 0.04);
        ctx.fillRect(2, -Hh - 26, L * 0.16, 13);
        ctx.fillStyle = dark;
        for (let k = 0; k < 3; k++) ctx.fillRect(6 + k * L * 0.045, -Hh - 22, 4, 5);
        for (let k = 0; k < 6; k++) {
          const px = L * (0.2 + k * 0.11);
          if (Math.abs(px - hx) < hw * 0.6) continue;
          ctx.fillRect(px, -Hh * 0.72 + (px / L - 0.45) * 8, 5, 4);
        }
        // Bewuchs auf dem Deck
        const grow = [];
        for (let k = 0; k < 16; k++) { const gx = r() * L * 0.9; grow.push([gx, -Hh - 4 + Math.pow((gx / L - 0.4) * 2, 2) * 4 - 6 + r() * 3, 1.4 + r() * 2.2]); }
        dots(grow, rgba(P.coral, 0.75));
        ctx.restore();
        oSand(-4, w * 0.62, h, 30, P.sand, r);
        oSand(w * 0.4, w + 4, h, 22, P.sand, r);
        const wd = [];
        for (let k = 0; k < 8; k++) wd.push([w * (0.05 + r() * 0.9), h - 10 - r() * 10, 8 + r() * 14, (r() - 0.5) * 8]);
        oWeeds(wd, rgba(P.kelp, 0.8));
      }
    },
    bell: {
      size: r => [130 + r() * 20, 140],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.24), yb = h - 12, cx = w * 0.46, bw = 34, bh = 62, tilt = (r() - 0.5) * 0.16;
        const metal = P.metal;
        ctx.save();
        ctx.translate(cx, yb);
        ctx.rotate(tilt);
        // Glockenkörper: unten ausgestellt, oben gewölbt
        const body = () => {
          ctx.beginPath();
          ctx.moveTo(-bw, 0);
          ctx.bezierCurveTo(-bw * 0.9, -bh * 0.35, -bw * 0.78, -bh * 0.7, -bw * 0.62, -bh * 0.88);
          ctx.quadraticCurveTo(0, -bh * 1.12, bw * 0.62, -bh * 0.88);
          ctx.bezierCurveTo(bw * 0.78, -bh * 0.7, bw * 0.9, -bh * 0.35, bw, 0);
          ctx.closePath();
        };
        body();
        ctx.fillStyle = hgrad(-bw, bw, [[0, shade(metal, 0.2)], [0.35, shade(metal, 0.04)], [0.75, shade(metal, -0.18)], [1, shade(metal, -0.32)]]);
        ctx.fill();
        // Bänder mit Nieten
        ctx.fillStyle = rgba(INK, 0.18);
        ctx.fillRect(-bw, -5, bw * 2, 5);
        ctx.fillRect(-bw * 0.86, -bh * 0.5, bw * 1.72, 3);
        const riv = [];
        for (let k = -6; k <= 6; k++) riv.push([k * bw / 7, -2.5, 0.9], [k * bw * 0.84 / 7, -bh * 0.5 + 1.5, 0.8]);
        dots(riv, rgba(mix(metal, CREAM, 0.4), 0.7));
        // Bullaugen
        for (const [px, py, pr] of [[-bw * 0.4, -bh * 0.7, 6], [bw * 0.12, -bh * 0.74, 6], [-bw * 0.12, -bh * 0.28, 5]]) {
          circle(px, py, pr + 2.2, shade(metal, -0.12));
          circle(px, py, pr, mix(P.dark, P.water, 0.3));
          ellipse(px - pr * 0.35, py - pr * 0.35, pr * 0.35, pr * 0.22, -0.6, rgba(P.water, 0.6));
        }
        // Grünspan
        ctx.save();
        body();
        ctx.clip();
        const vg = [];
        for (let k = 0; k < 9; k++) vg.push([(r() - 0.5) * bw * 1.8, -r() * bh, 4 + r() * 7, 2 + r() * 4, r()]);
        ellipses(vg, rgba(P.verd, 0.42));
        ctx.restore();
        // Hebeöse oben
        ctx.strokeStyle = shade(metal, -0.2);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -bh * 1.02 - 6, 5.5, Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();
        ctx.restore();
        // gerissene Kette liegt im Sand
        ctx.beginPath();
        for (let k = 0; k < 12; k++) {
          const x = cx + bw * 0.9 + k * 4.2, y = yb + 4 - Math.sin(k * 0.6) * 2;
          if (k % 2) { ctx.moveTo(x + 2.4, y); ctx.ellipse(x, y, 2.4, 1.3, 0.2, 0, TAU); } else { ctx.moveTo(x + 1.1, y); ctx.ellipse(x, y, 1.1, 2.2, 0.2, 0, TAU); }
        }
        ctx.strokeStyle = shade(metal, -0.3);
        ctx.lineWidth = 1.1;
        ctx.stroke();
        oSand(cx - bw - 18, cx + bw + 20, h, 16, P.sand, r);
        oBranchCoral(cx - bw - 14, h - 8, 9, 2.6, P.coral2, r, 2);
        const wd = [];
        for (let k = 0; k < 4; k++) wd.push([w * (0.1 + r() * 0.8), h - 6, 6 + r() * 8, (r() - 0.5) * 5]);
        oWeeds(wd, rgba(P.kelp, 0.85));
      }
    },
    ruins: {
      size: r => [240 + r() * 50, 205],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.3), yb = h - 14, st = P.stone;
        // Stufenunterbau
        for (let k = 0; k < 3; k++) {
          const x0 = w * 0.08 + k * 8, x1 = w * 0.86 - k * 8, y = yb - k * 6;
          ctx.fillStyle = vgrad(y - 6, y, [[0, shade(st, 0.1 - k * 0.02)], [1, shade(st, -0.18)]]);
          ctx.fillRect(x0, y - 6, x1 - x0, 6);
          ctx.fillStyle = rgba(INK, 0.16);
          ctx.fillRect(x1 - 6, y - 6, 6, 6);
        }
        const fy = yb - 18, n = 4 + (r() < 0.5 ? 1 : 0), cw = 13 + r() * 3, sp = (w * 0.66) / (n - 1);
        const hs = [];
        for (let k = 0; k < n; k++) hs.push(k === 1 || k === 2 ? 130 + r() * 30 : 60 + r() * 70);
        // Gebälk auf den beiden hohen Säulen
        const x1c = w * 0.17 + sp, x2c = w * 0.17 + sp * 2, bh = Math.min(hs[1], hs[2]);
        hs[1] = hs[2] = bh;
        for (let k = 0; k < n; k++) oColumn(w * 0.17 + k * sp, fy, cw, hs[k], st, !(k === 1 || k === 2) && r() < 0.8, r);
        const ay = fy - bh - 12;
        ctx.fillStyle = vgrad(ay, ay + 12, [[0, shade(st, 0.16)], [1, shade(st, -0.16)]]);
        ctx.beginPath();
        ctx.moveTo(x1c - cw - 8, ay + 12);
        ctx.lineTo(x1c - cw - 8, ay);
        ctx.lineTo(x2c + cw + 2, ay - 1);
        ctx.lineTo(x2c + cw + 14, ay + 4);
        ctx.lineTo(x2c + cw + 6, ay + 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(INK, 0.15);
        ctx.fillRect(x1c - cw - 8, ay + 8, x2c - x1c + 2 * cw + 10, 1.6);
        // umgestürzte Säulentrommeln
        const dx = w * (0.6 + r() * 0.2);
        for (let k = 0; k < 3; k++) {
          const ex = dx + k * 15, ey = yb - 5;
          ellipse(ex + 8, ey + 1, 9, 2, 0, rgba(INK, 0.14));
          ctx.fillStyle = vgrad(ey - 12, ey, [[0, shade(st, 0.14)], [1, shade(st, -0.2)]]);
          ctx.fillRect(ex, ey - 12, 13, 12);
          ellipse(ex + 13, ey - 6, 2.6, 6, 0, shade(st, -0.12));
        }
        // Bewuchs: Algen, Seeanemonen, kleine Korallen
        const wd = [];
        for (let k = 0; k < 8; k++) wd.push([w * (0.06 + r() * 0.88), yb - r() * 16, 7 + r() * 12, (r() - 0.5) * 6]);
        oWeeds(wd, rgba(P.kelp, 0.82));
        oBranchCoral(w * 0.12, yb, 12, 3.4, P.coral, r, 2);
        oBrain(w * 0.9, yb + 2, 14, 10, P.coral2, r);
        const an = [];
        for (let k = 0; k < 6; k++) an.push([w * (0.2 + r() * 0.6), fy - r() * 4, 1.6 + r()]);
        dots(an, rgba(mix(C.accent, CREAM, 0.3), 0.7));
        oSand(-4, w + 4, h, 12, P.sand, r);
      }
    },
    kelpwood: {
      size: r => [170 + r() * 40, 310],
      paint: (w, h, r, C, L, it) => {
        const P = oPal(C, 0.2), base = h - 2;
        oRock(w * 0.5, h - 4, w * 0.36, 26, P.rock, r);
        // drei Tiefen: hinten dunkel und dunstig, vorn kräftiger
        for (const [tone, n, hmin] of [[0.5, 3, 0.72], [0.28, 3, 0.6], [0.04, 3, 0.45]]) {
          const list = [];
          for (let k = 0; k < n; k++) list.push([w * (0.12 + r() * 0.76), base - 8, h * (hmin + r() * (0.98 - hmin)) - 10, (r() - 0.5) * 40, (r() * 1e6) | 0]);
          oKelps(list, shade(mix(P.kelp, P.water, tone), -0.06), C);
        }
        oSand(0, w, h, 10, P.sand, r);
      }
    },
    corals: {
      size: r => [220 + r() * 50, 220],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.24), yb = h - 6;
        oRock(w * 0.52, yb, w * 0.44, 44, P.rock, r);
        // Fächer hinten, dann Baumkoralle, Tischkoralle, Hirnkoralle
        ctx.save();
        ctx.translate(w * 0.72, yb - 22);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.ellipse(0, 0, 46, 64, 0, Math.PI * 1.08, Math.PI * 1.92);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(P.coral2, P.pale, 0.3), 0.55);
        ctx.fill();
        ctx.beginPath();
        for (let a = Math.PI * 1.12; a < Math.PI * 1.9; a += 0.12) { ctx.moveTo(-0.5, 0); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 62); ctx.lineTo(Math.cos(a) * 44 + 0.9, Math.sin(a) * 62); ctx.lineTo(0.5, 0); ctx.closePath(); }
        ctx.fillStyle = rgba(shade(P.coral2, -0.3), 0.5);
        ctx.fill();
        ctx.restore();
        oBranchCoral(w * 0.34, yb - 36, 46 + r() * 10, 12, P.coral, r, 3);
        // Tischkoralle
        const tx = w * 0.62, ty = yb - 58 - r() * 10;
        ctx.fillStyle = shade(P.pale, -0.2);
        ctx.fillRect(tx - 3, ty, 6, 30);
        ellipse(tx + 3, ty + 4, 38, 6, 0, rgba(INK, 0.15));
        ellipse(tx, ty, 38, 7, 0, vgrad(ty - 7, ty + 7, [[0, shade(P.pale, 0.12)], [1, shade(P.pale, -0.2)]]));
        ellipse(tx - 6, ty - 2.5, 26, 3, 0, rgba(CREAM, 0.16));
        oBrain(w * 0.18, yb - 2, 30 + r() * 8, 24, mix(P.coral2, P.verd, 0.3), r);
        const an = [];
        for (let k = 0; k < 6; k++) an.push([w * (0.1 + r() * 0.8), yb - 30 - r() * 20, 1.4 + r() * 1.2]);
        dots(an, rgba(mix(C.accent, CREAM, 0.35), 0.65));
        const wd = [];
        for (let k = 0; k < 4; k++) wd.push([w * (0.05 + r() * 0.9), yb, 8 + r() * 12, (r() - 0.5) * 6]);
        oWeeds(wd, rgba(P.kelp, 0.85));
        oSand(-4, w + 4, h, 12, P.sand, r);
      }
    }
  };
  // Maßstab je Motiv: Größe und Malen werden gemeinsam skaliert
  function scaleKind(K, k) {
    const size = K.size, paint = K.paint;
    K.size = r => size(r).map(v => v * k);
    K.paint = (w, h, r, C, L, it) => { ctx.save(); ctx.scale(k, k); paint(w / k, h / k, r, C, L, it); ctx.restore(); };
    return K;
  }
  for (const [k, sc] of [['clam', 1.35], ['anchor', 1.35], ['wreck', 1.05], ['bell', 1.4], ['ruins', 1.15], ['corals', 1.1]]) scaleKind(oMid[k], sc);
  for (const k of Object.keys(oMid)) oMid[k].tex = { grain: 0.035 };

  // ---------- Ozean: ferne Silhouetten hinter dem Riff (Kamm 373 bis 442) ----------
  const O_FAR = 450;
  const oFarSil = (w, h, C, a) => hazeOver(w, h, oPal(C).water, a);
  const oFar = {
    ftemple: {
      size: r => [200 + r() * 60, 210],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.3), st = P.stone, yb = h - 70;
        oRock(w * 0.5, h, w * 0.5, 84, P.rock, r);
        ctx.fillStyle = vgrad(yb - 12, yb, [[0, shade(st, 0.08)], [1, shade(st, -0.15)]]);
        ctx.fillRect(w * 0.12, yb - 12, w * 0.76, 12);
        const n = 6, sp = w * 0.6 / (n - 1), top = yb - 12 - 74, broke = Math.floor(r() * n);
        for (let k = 0; k < n; k++) {
          if (k === broke) { oColumn(w * 0.2 + k * sp, yb - 12, 10, 30 + r() * 20, st, true, r); continue; }
          oColumn(w * 0.2 + k * sp, yb - 12, 10, 74, st, false, r);
        }
        // Gebälk und Giebel, eine Ecke abgebrochen
        ctx.fillStyle = vgrad(top - 10, top, [[0, shade(st, 0.12)], [1, shade(st, -0.12)]]);
        ctx.fillRect(w * 0.14, top - 10, w * 0.7, 10);
        poly([[w * 0.14, top - 10], [w * 0.49, top - 34], [w * 0.75, top - 16], [w * 0.7, top - 10]], shade(st, 0.04));
        poly([[w * 0.49, top - 34], [w * 0.75, top - 16], [w * 0.7, top - 10], [w * 0.62, top - 10]], rgba(INK, 0.12));
        oFarSil(w, h, C, 0.58);
      }
    },
    fwreck: {
      size: r => [220 + r() * 50, 170],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.3), yb = h - 54;
        oRock(w * 0.5, h, w * 0.52, 66, P.rock, r);
        ctx.save();
        ctx.translate(w * 0.1, yb);
        ctx.rotate(0.12 + r() * 0.08);
        const L = w * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.quadraticCurveTo(L * 0.4, -28, L, -36);
        ctx.quadraticCurveTo(L * 1.04, -14, L * 0.84, 4);
        ctx.lineTo(L * 0.1, 4);
        ctx.quadraticCurveTo(-2, -2, 0, -40);
        ctx.closePath();
        ctx.fillStyle = vgrad(-40, 4, [[0, shade(P.wood, 0.1)], [1, shade(P.wood, -0.2)]]);
        ctx.fill();
        ctx.fillStyle = shade(P.wood, -0.1);
        ctx.fillRect(L * 0.32, -96, 4, 64);
        ctx.fillRect(L * 0.62, -70, 4, 38);
        ctx.save();
        ctx.translate(L * 0.34, -80);
        ctx.rotate(0.6);
        ctx.fillRect(-18, -1.2, 30, 2.4);
        ctx.restore();
        ctx.fillStyle = rgba(INK, 0.3);
        poly([[L * 0.5, -26], [L * 0.6, -30], [L * 0.64, -6], [L * 0.52, -4]], rgba(INK, 0.3));
        ctx.restore();
        oFarSil(w, h, C, 0.52);
      }
    },
    fcoral: {
      size: r => [200 + r() * 60, 250],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.3);
        oRock(w * 0.5, h, w * 0.5, 70, P.rock, r);
        // riesige Baumkoralle und Röhrenschwämme als blasse Silhouetten
        oBranchCoral(w * 0.42, h - 56, 60 + r() * 12, 17, P.coral, r, 3);
        for (let k = 0; k < 3; k++) {
          const x = w * (0.72 + k * 0.08), th = 50 + r() * 50, tw = 7 + r() * 4, yb = h - 50 + k * 4;
          ctx.fillStyle = hgrad(x - tw, x + tw, [[0, shade(P.coral2, 0.12)], [1, shade(P.coral2, -0.18)]]);
          ctx.fillRect(x - tw, yb - th, tw * 2, th);
          ellipse(x, yb - th, tw, 2.6, 0, shade(P.coral2, -0.35));
        }
        oBrain(w * 0.16, h - 50, 26, 22, P.verd, r);
        oFarSil(w, h, C, 0.52);
      }
    },
    farch: {
      size: r => [200 + r() * 60, 200],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.3), c = shade(P.rock, 0.05), yb = h;
        ctx.beginPath();
        ctx.moveTo(0, yb);
        ctx.quadraticCurveTo(w * 0.02, h * 0.3, w * 0.22, h * 0.12);
        ctx.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.78, h * 0.16);
        ctx.quadraticCurveTo(w * 0.96, h * 0.3, w, yb);
        ctx.lineTo(w * 0.74, yb);
        ctx.quadraticCurveTo(w * 0.72, h * 0.42, w * 0.5, h * 0.4);
        ctx.quadraticCurveTo(w * 0.3, h * 0.42, w * 0.28, yb);
        ctx.closePath();
        ctx.fillStyle = vgrad(0, h, [[0, shade(c, 0.12)], [1, shade(c, -0.15)]]);
        ctx.fill();
        const bl = [];
        for (let k = 0; k < 12; k++) bl.push([w * (0.15 + r() * 0.7), h * (0.06 + r() * 0.12), 4 + r() * 6]);
        dots(bl, rgba(P.coral, 0.5));
        oFarSil(w, h, C, 0.5);
      }
    },
    fkelp: {
      size: r => [180 + r() * 60, 300],
      paint: (w, h, r, C) => {
        const P = oPal(C, 0.3);
        oRock(w * 0.5, h, w * 0.5, 60, P.rock, r);
        const list = [];
        for (let k = 0; k < 6; k++) list.push([w * (0.1 + r() * 0.8), h - 30, h * (0.55 + r() * 0.42), (r() - 0.5) * 30, (r() * 1e6) | 0]);
        oKelps(list, mix(P.kelp, P.water, 0.35), C);
        oFarSil(w, h, C, 0.5);
      }
    }
  };
  for (const k of Object.keys(oFar)) oFar[k].tex = null;

  SCENE['Ozean'] = {
    tracks: [
      { z: 0, factor: 0.12, start: 20, gap: [30, 150], maxKs: 1.5, base: () => O_FAR,
        pick: flow(['fcoral', 'ftemple', 'fkelp', 'fwreck', 'farch'], [['ftemple', 2], ['fwreck', 1.6], ['fcoral', 2], ['farch', 1.4], ['fkelp', 1.4]], 1),
        kinds: oFar },
      { z: 1, factor: 0.32, start: 40, gap: [20, 110], maxKs: 2, base: () => O_MID,
        pick: flow(['clam', 'anchor', 'wreck', 'bell', 'ruins', 'kelpwood', 'corals'],
          [['clam', 1.3], ['anchor', 1.1], ['wreck', 1.4], ['bell', 1.1], ['ruins', 1.6], ['kelpwood', 1.3], ['corals', 1.8]], 3),
        kinds: oMid }
    ]
  };

  // ============================================================
  // DSCHUNGEL: im Nebel hinter den Stämmen Stufentempel, Felswand mit Wasserfall,
  // Urwaldriesen und Karstfelsen; davor moosige Felsen, Riesenbaum, Tempeltor,
  // Hängebrücke, Wasserfall und kleiner Schrein
  // ============================================================
  const jPalCache = new Map();
  function jPal(C, hz) {
    const key = C.skyTop + (hz || 0);
    let P = jPalCache.get(key);
    if (P) return P;
    const mist = mix(C.skyBottom, C.haze, 0.4);
    P = {
      mist,
      stone: mix(mix(CREAM, C.far, 0.56), '#8a8068', 0.25),
      moss: mix(C.accent, C.far, 0.5),
      leaf: mix(C.near, C.far, 0.45),
      bark: mix('#6e5c42', C.far, 0.42),
      rock: mix('#71766a', C.far, 0.38),
      water: mix(CREAM, C.skyBottom, 0.35),
      dark: mix(INK, C.near, 0.5),
      rope: mix('#a08660', C.far, 0.3),
      wood: mix('#7c5c3c', C.far, 0.32)
    };
    if (hz) for (const k of Object.keys(P)) if (k !== 'mist') P[k] = mix(P[k], mist, hz);
    jPalCache.set(key, P);
    return P;
  }
  // Steinblock: Licht oben links, Schattenkante rechts und unten, Moos auf der Oberseite
  function jBlocks(list, stone, moss) {
    ctx.beginPath();
    for (const [x, y, bw, bh] of list) ctx.rect(x, y, bw, bh);
    ctx.fillStyle = stone;
    ctx.fill();
    ctx.beginPath();
    for (const [x, y, bw, bh] of list) { ctx.rect(x + bw - 2.2, y, 2.2, bh); ctx.rect(x, y + bh - 1.6, bw, 1.6); }
    ctx.fillStyle = rgba(INK, 0.2);
    ctx.fill();
    ctx.beginPath();
    for (const [x, y, bw] of list) ctx.rect(x, y, bw - 2.2, 1.2);
    ctx.fillStyle = rgba(CREAM, 0.16);
    ctx.fill();
    if (moss) {
      ctx.beginPath();
      for (const [x, y, bw, bh, m] of list) if (m) { ctx.moveTo(x, y + 2); ctx.quadraticCurveTo(x + bw * 0.3, y - 3, x + bw * m, y + 1); ctx.lineTo(x + bw * m, y + 3); ctx.lineTo(x, y + 4); ctx.closePath(); }
      ctx.fillStyle = moss;
      ctx.fill();
    }
  }
  // herabhängende Ranken als Blattketten (gefüllt, kein Strich)
  function jVines(list, col) {
    ctx.beginPath();
    for (const [x, y, len, sw] of list) {
      for (let t = 0, k = 0; t < len; t += 6, k++) {
        const px = x + Math.sin(t * 0.06) * sw, py = y + t, s = k % 2 ? 1 : -1;
        ctx.moveTo(px, py);
        ctx.lineTo(px + s * 5, py + 1.5);
        ctx.lineTo(px + s * 1.5, py + 4.5);
        ctx.closePath();
      }
      ctx.rect(x - 0.5, y, 1, len);
    }
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Blattbüschel / Farnwedel als gefüllte Keile
  function jBush(x, yb, s, col, r) {
    ctx.beginPath();
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.4, len = (14 + r() * 10) * s;
      const ex = x + Math.cos(a) * len, ey = yb + Math.sin(a) * len * 0.8, nx = -Math.sin(a) * 3.2 * s, ny = Math.cos(a) * 3.2 * s;
      ctx.moveTo(x, yb);
      ctx.quadraticCurveTo((x + ex) / 2 + nx, (yb + ey) / 2 + ny - 3, ex, ey);
      ctx.quadraticCurveTo((x + ex) / 2 - nx, (yb + ey) / 2 - ny - 3, x, yb);
    }
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Fels mit Moospolster
  function jBoulder(cx, yb, rw, rh, rock, moss, r) {
    const pts = [[cx - rw, yb + 2]];
    for (let k = 1; k < 9; k++) { const a = Math.PI - k / 9 * Math.PI; pts.push([cx + Math.cos(a) * rw * (0.88 + r() * 0.16), yb - Math.sin(a) * rh * (0.82 + r() * 0.24)]); }
    pts.push([cx + rw, yb + 2]);
    smooth(pts, true);
    ctx.fillStyle = rock;
    ctx.fill();
    ellipse(cx + rw * 0.4, yb - rh * 0.35, rw * 0.5, rh * 0.45, 0, rgba(INK, 0.16));
    const cap = [];
    for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, a = Math.PI - t * Math.PI * 0.75 - 0.2; cap.push([cx + Math.cos(a) * rw * 0.75, yb - Math.sin(a) * rh * 0.92, rw * 0.22 + r() * 3]); }
    blobPath(cap);
    ctx.fillStyle = moss;
    ctx.fill();
  }
  // Wasserfall: Band mit Streifen, Gischt unten
  function jFall(x, y0, y1, fw, water, mist) {
    ctx.fillStyle = rgba(water, 0.82);
    ctx.fillRect(x - fw * 0.45, y0, fw * 0.9, y1 - y0);
    ctx.fillStyle = rgba(water, 0.5);
    ctx.fillRect(x - fw * 0.55, y0 + (y1 - y0) * 0.5, fw * 1.1, (y1 - y0) * 0.5);
    ctx.beginPath();
    for (let k = 0; k < fw / 2.2; k++) { const sx = x - fw * 0.45 + k * 2.2 + hash(k * 3.1 + x) * 1.2, sy = y0 + hash(k + x) * 30; ctx.rect(sx, sy, 0.8, (y1 - sy) * (0.4 + hash(k * 7.7) * 0.6)); }
    ctx.fillStyle = rgba(CREAM, 0.35);
    ctx.fill();
    soft(x, y1 - 6, fw * 1.5, 16, mix(CREAM, mist, 0.3), 0.55);
  }

  // Felswand: unregelmäßiger Umriss, oben höher in der Mitte; Pfeilerflächen (Licht links, Schatten rechts)
  // nur im Inneren unter der Kante, Simse mit Moos, Bewuchs entlang der Kante
  function jCliff(w, h, yb, top, rock, P, r, noVines) {
    const n = 8, edge = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = lerp(w * 0.03, w * 0.97, t);
      edge.push([x, top + Math.pow(Math.abs(t - 0.5) * 2, 1.6) * 70 + (r() - 0.5) * 18]);
    }
    const body = [[0, yb + 2], [w * 0.01, edge[0][1] + 60], ...edge, [w * 0.99, edge[n][1] + 50], [w, yb + 2]];
    smooth(body, true);
    ctx.fillStyle = vgrad(top, yb, [[0, shade(rock, 0.08)], [1, shade(rock, -0.15)]]);
    ctx.fill();
    // Flächen nur im Inneren (unter der Kante), damit nichts übersteht; die Kante deckt der Bewuchs
    const eAt = x => { const t = clamp((x - w * 0.03) / (w * 0.94), 0, 1) * n, i = Math.min(n - 1, Math.floor(t)); return lerp(edge[i][1], edge[i + 1][1], t - i); };
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const x = w * (0.24 + k * 0.24) + (r() - 0.5) * 10, bw = 7 + r() * 8, y0 = Math.max(eAt(x), eAt(x + bw)) + 8; ctx.rect(x, y0, bw, yb - y0); }
    ctx.fillStyle = rgba(INK, 0.15);
    ctx.fill();
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const x = w * (0.14 + k * 0.2) + r() * 6; ctx.rect(x, eAt(x) + 8, 2.6, yb - eAt(x) - 8); }
    ctx.fillStyle = rgba(CREAM, 0.1);
    ctx.fill();
    ctx.beginPath();
    const ms = [];
    for (let k = 0; k < 7; k++) {
      const x = w * (0.12 + r() * 0.7), lw = 14 + r() * 24, y = Math.max(eAt(x), eAt(x + lw)) + 14 + r() * (yb - top - 40);
      if (y < yb - 6) { ctx.rect(x, y, lw, 1.6); ms.push([x + lw * 0.5, y - 1, lw * 0.45, 2.4, 0]); }
    }
    ctx.fillStyle = rgba(INK, 0.16);
    ctx.fill();
    ellipses(ms, rgba(P.moss, 0.75));
    // Dschungel auf der Kante: Laubband mit gewellter Oberkante, darunter ein Schattensaum
    const band = (dy, up, col) => {
      const pts = [];
      for (let k = 0; k <= n * 3; k++) { const t = k / 3, i = Math.min(n - 1, Math.floor(t)), f = t - i; pts.push([lerp(edge[i][0], edge[i + 1][0], f), lerp(edge[i][1], edge[i + 1][1], f) + dy]); }
      ctx.beginPath();
      ctx.moveTo(pts[0][0] - 6, pts[0][1] + 14);
      ctx.lineTo(pts[0][0] - 6, pts[0][1]);
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
        ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - up * (0.6 + hash(x1 + dy) * 0.8), x1, y1);
      }
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0] + (k === pts.length - 1 ? 6 : 0), pts[k][1] + 12 + hash(k * 3.7 + dy) * 9);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    band(5, 9, shade(P.leaf, -0.2));
    band(0, 11, shade(P.leaf, 0.04));
    const hl = [];
    for (let k = 0; k < n * 2; k++) { const t = (k + 0.5) / 2, i = Math.min(n - 1, Math.floor(t)), f = t - i; hl.push([lerp(edge[i][0], edge[i + 1][0], f) - 3, lerp(edge[i][1], edge[i + 1][1], f) - 3, 3 + r() * 2]); }
    dots(hl, rgba(shade(P.leaf, 0.22), 0.4));
    if (!noVines) jVines([[edge[1][0], edge[1][1] + 6, 80 + r() * 60, 4], [edge[6][0], edge[6][1] + 8, 100 + r() * 50, 5]], shade(P.leaf, 0.04));
    return edge;
  }

  const J_MID = GROUND_Y + 6;
  const jMid = {
    rocks: {
      size: r => [210 + r() * 40, 120],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.18), yb = h - 4;
        jBoulder(w * 0.3, yb, 46 + r() * 10, 58 + r() * 14, P.rock, P.moss, r);
        jBoulder(w * 0.62, yb, 38 + r() * 10, 40 + r() * 10, shade(P.rock, -0.05), P.moss, r);
        jBoulder(w * 0.84, yb, 22, 22, shade(P.rock, 0.04), P.moss, r);
        jBush(w * 0.12, yb, 1.2, shade(P.leaf, 0.1), r);
        jBush(w * 0.5, yb, 1, P.leaf, r);
        jBush(w * 0.95, yb, 0.9, shade(P.leaf, 0.06), r);
        const sh = [];
        for (let k = 0; k < 4; k++) sh.push([w * (0.4 + r() * 0.3), yb - 1, 2 + r() * 1.5]);
        ctx.beginPath();
        for (const [x, y] of sh) ctx.rect(x - 0.6, y - 4, 1.2, 4);
        ctx.fillStyle = mix(CREAM, P.stone, 0.4);
        ctx.fill();
        ellipses(sh.map(([x, y, rr]) => [x, y - 4, rr, rr * 0.55, 0]), mix(C.accent, '#d8673f', 0.45));
      }
    },
    giant: {
      size: r => [220 + r() * 40, 300],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.2), yb = h - 2, cx = w * (0.48 + (r() - 0.5) * 0.08), tw = 26 + r() * 6, bark = P.bark;
        // Brettwurzeln
        const fins = [[-1, 2.6], [-1, 1.6], [1, 1.7], [1, 2.8]];
        for (const [d, sp] of fins) {
          const fx = cx + d * tw * sp, fh = 60 + r() * 40;
          poly([[cx + d * tw * 0.3, yb - fh], [fx, yb + 2], [cx + d * tw * 0.2, yb + 2]], d < 0 ? shade(bark, 0.06) : shade(bark, -0.2));
          poly([[cx + d * tw * 0.3, yb - fh], [fx, yb + 2], [fx - d * 4, yb + 2]], rgba(INK, d < 0 ? 0.08 : 0.2));
        }
        // Stamm: gerader Teil als Rechteck (schneller Rasterweg), unten der Wurzelanlauf
        const tg = hgrad(cx - tw, cx + tw, [[0, shade(bark, 0.16)], [0.4, bark], [1, shade(bark, -0.3)]]);
        ctx.fillStyle = tg;
        ctx.fillRect(cx - tw * 0.64, 0, tw * 1.28, yb - 58);
        ctx.beginPath();
        ctx.moveTo(cx - tw * 0.64, yb - 60);
        ctx.quadraticCurveTo(cx - tw * 0.7, yb - 20, cx - tw * 1.2, yb);
        ctx.lineTo(cx + tw * 1.25, yb);
        ctx.quadraticCurveTo(cx + tw * 0.7, yb - 20, cx + tw * 0.64, yb - 60);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        for (let k = 0; k < 28; k++) { const bx = cx - tw * 0.55 + r() * tw * 1.1, by = r() * (yb - 40); ctx.rect(bx, by, 1, 14 + r() * 24); }
        ctx.fillStyle = rgba(INK, 0.14);
        ctx.fill();
        // Würgefeigen-Wurzeln und Moos
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const x0 = cx - tw * 0.4 + k * tw * 0.4;
          ctx.moveTo(x0, 0);
          for (let y = 0; y <= yb; y += 20) ctx.lineTo(x0 + Math.sin(y * 0.03 + k * 2) * tw * 0.25, y);
          for (let y = yb; y >= 0; y -= 20) ctx.lineTo(x0 + Math.sin(y * 0.03 + k * 2) * tw * 0.25 + 3, y);
          ctx.closePath();
        }
        ctx.fillStyle = rgba(shade(bark, 0.2), 0.55);
        ctx.fill();
        const mo = [];
        for (let k = 0; k < 7; k++) mo.push([cx - tw * 0.5 + r() * tw * 0.4, 40 + r() * (yb - 100), 4 + r() * 4, 10 + r() * 16, 0]);
        ellipses(mo, rgba(P.moss, 0.55));
        // Aufsitzerpflanzen auf Astansätzen
        for (let k = 0; k < 3; k++) jBush(cx + (k % 2 ? tw * 0.7 : -tw * 0.7), 70 + k * 70 + r() * 20, 0.8, shade(P.leaf, 0.12), r);
        jVines([[cx + tw * 0.5, 0, 120 + r() * 80, 6], [cx - tw * 0.9, 20, 90 + r() * 60, 5]], shade(P.leaf, 0.05));
        jBush(cx - tw * 1.6, yb, 1.1, P.leaf, r);
        jBush(cx + tw * 1.8, yb, 1.2, shade(P.leaf, 0.08), r);
        // oben im Dunst ausblenden
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = vgrad(0, 110, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
        ctx.fillRect(-2, -2, w + 4, 112);
        ctx.restore();
      }
    },
    temple: {
      size: r => [250 + r() * 40, 230],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.2), yb = h - 4, st = P.stone, moss = rgba(P.moss, 0.9);
        // Stufen
        const steps = [];
        for (let k = 0; k < 3; k++) steps.push([w * 0.06 + k * 10, yb - (k + 1) * 9, w * 0.88 - k * 20, 9, 0.5 + r() * 0.4]);
        jBlocks(steps, shade(st, -0.04), moss);
        // zwei Pfeiler aus Blöcken, Türsturz mit Stufenkrone
        const by = yb - 27, px1 = w * 0.24, px2 = w * 0.62, pw = 30, ph = 120 + r() * 20;
        const blocks = [];
        for (const px of [px1, px2]) for (let y = by - 20, k = 0; y > by - ph; y -= 20, k++) blocks.push([px + (k % 2 ? 2 : 0), y, pw, 20, r() < 0.3 ? 0.7 : 0]);
        const ly = by - ph - 22;
        blocks.push([px1 - 10, ly, px2 - px1 + pw + 20, 22, 0.9]);
        blocks.push([px1 + 6, ly - 16, px2 - px1 + pw - 12, 16, 0.6]);
        blocks.push([px1 + 24, ly - 30, px2 - px1 + pw - 48, 14, 0.8]);
        jBlocks(blocks, st, moss);
        // dunkler Durchgang
        ctx.fillStyle = vgrad(ly + 22, by, [[0, rgba(P.dark, 0.85)], [1, rgba(P.dark, 0.55)]]);
        ctx.fillRect(px1 + pw + 2, ly + 22, px2 - px1 - pw - 2, by - ly - 22);
        // eingemeißelte Rillen am Sturz
        ctx.beginPath();
        for (let k = 0; k < 7; k++) ctx.rect(px1 + 4 + k * (px2 - px1 + pw - 8) / 7, ly + 7, 6, 2);
        ctx.fillStyle = rgba(INK, 0.22);
        ctx.fill();
        // Mauerrest rechts, umgestürzte Blöcke
        const rest = [];
        for (let k = 0; k < 3; k++) rest.push([w * 0.78, by - 18 * (k + 1), 26 - k * 5, 18, r() < 0.5 ? 0.8 : 0]);
        rest.push([w * 0.04, yb - 14, 22, 14, 0.7], [w * 0.88, yb - 12, 18, 12, 0.6]);
        jBlocks(rest, shade(st, -0.06), moss);
        jVines([[px1 + 8, ly + 4, 60 + r() * 50, 4], [px2 + 20, ly + 2, 80 + r() * 40, 5], [w * 0.5, ly - 20, 40 + r() * 30, 3]], P.leaf);
        jBush(w * 0.14, yb - 27, 1.1, shade(P.leaf, 0.1), r);
        jBush(w * 0.9, yb, 1.2, P.leaf, r);
        jBush(px2 + pw * 0.5, ly - 30, 0.8, shade(P.leaf, 0.14), r);
      }
    },
    bridge: {
      size: r => [300 + r() * 30, 270],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.12), yb = h - 2, bark = shade(P.bark, -0.06);
        // zwei Stämme an den Rändern, oben im Dunst
        const tr = (cx, tw) => {
          ctx.fillStyle = hgrad(cx - tw, cx + tw, [[0, shade(bark, 0.14)], [0.45, bark], [1, shade(bark, -0.28)]]);
          ctx.fillRect(cx - tw * 0.52, 0, tw * 1.04, yb - 38);
          ctx.beginPath();
          ctx.moveTo(cx - tw * 0.52, yb - 40);
          ctx.quadraticCurveTo(cx - tw * 0.6, yb - 12, cx - tw * 1.3, yb);
          ctx.lineTo(cx + tw * 1.3, yb);
          ctx.quadraticCurveTo(cx + tw * 0.6, yb - 12, cx + tw * 0.52, yb - 40);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          for (let k = 0; k < 14; k++) ctx.rect(cx - tw * 0.4 + r() * tw * 0.8, r() * (yb - 30), 1, 12 + r() * 20);
          ctx.fillStyle = rgba(INK, 0.14);
          ctx.fill();
        };
        const x1 = w * 0.1, x2 = w * 0.9, by = 96 + r() * 22, sag = 28 + r() * 10;
        tr(x1, 18 + r() * 4);
        tr(x2, 20 + r() * 4);
        // Plattformen
        jBlocks([[x1 - 12, by - 4, 34, 6, 0], [x2 - 22, by - 4, 34, 6, 0]], P.wood, null);
        const cat = t => by + Math.sin(t * Math.PI) * sag;
        const xs = x1 + 20, xe = x2 - 20;
        // Planken
        ctx.beginPath();
        for (let t = 0.02; t < 0.99; t += 0.035) { const x = lerp(xs, xe, t); ctx.rect(x - 2.8, cat(t) - 2, 5.6, 4.4); }
        ctx.fillStyle = P.wood;
        ctx.fill();
        ctx.beginPath();
        for (let t = 0.02; t < 0.99; t += 0.035) { const x = lerp(xs, xe, t); ctx.rect(x + 1.4, cat(t) - 1.5, 1, 3.4); }
        ctx.fillStyle = rgba(INK, 0.25);
        ctx.fill();
        // Handläufe und Hänger
        ctx.beginPath();
        for (const off of [-20, 1.5]) {
          ctx.moveTo(xs - 6, by + off - (off < 0 ? 4 : 0));
          for (let t = 0; t <= 1.001; t += 0.1) ctx.lineTo(lerp(xs, xe, t), cat(t) + off * (off < 0 ? 0.85 : 1));
          ctx.lineTo(xe + 6, by + off - (off < 0 ? 4 : 0));
        }
        ctx.strokeStyle = P.rope;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        for (let t = 0.05; t < 0.97; t += 0.07) { const x = lerp(xs, xe, t); ctx.rect(x - 0.4, cat(t) - 17, 0.8, 17); }
        ctx.fillStyle = rgba(P.rope, 0.8);
        ctx.fill();
        jVines([[x1 + 8, 20, 120 + r() * 60, 5], [x2 - 10, 0, 160 + r() * 40, 6], [w * 0.45, cat(0.45) + 2, 30 + r() * 30, 3], [w * 0.62, cat(0.62) + 2, 20 + r() * 26, 3]], P.leaf);
        for (const x of [x1, x2]) { jBush(x - 26, yb, 1.1, P.leaf, r); jBush(x + 28, yb, 1, shade(P.leaf, 0.1), r); }
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = vgrad(0, 90, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
        ctx.fillRect(-2, -2, w + 4, 92);
        ctx.restore();
      }
    },
    falls: {
      size: r => [210 + r() * 36, 256],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.16), yb = h - 2, rock = shade(P.rock, -0.08), top = 26 + r() * 14;
        const edge = jCliff(w, h, yb, top, rock, P, r);
        // Wasserfall aus der Scharte in der Mitte, Becken mit Gischt
        const fx = edge[4][0] + (r() - 0.5) * 10, fw = 22 + r() * 8, fy = edge[4][1] + 6;
        ctx.fillStyle = rgba(P.dark, 0.4);
        ctx.fillRect(fx - fw * 0.75, fy, fw * 1.5, yb - fy - 24);
        jFall(fx, fy, yb - 14, fw, P.water, P.mist);
        ellipse(fx, yb - 6, fw * 2.3, 7, 0, rgba(mix(P.water, P.mist, 0.35), 0.9));
        jBoulder(fx + fw * 2.1, yb, 26, 20, shade(rock, 0.02), P.moss, r);
        jBush(w * 0.1, yb, 1.3, P.leaf, r);
      }
    },
    shrine: {
      size: r => [170 + r() * 30, 150],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.2), yb = h - 4, st = P.stone, moss = rgba(P.moss, 0.9), cx = w * 0.5;
        const bl = [[cx - 54, yb - 10, 108, 10, 0.6], [cx - 42, yb - 20, 84, 10, 0.4], [cx - 30, yb - 70, 14, 50, 0.9], [cx + 16, yb - 70, 14, 50, 0], [cx - 40, yb - 84, 80, 14, 0.8], [cx - 30, yb - 96, 60, 12, 0.5], [cx - 14, yb - 106, 28, 10, 0.9]];
        jBlocks(bl, st, moss);
        ctx.fillStyle = rgba(P.dark, 0.7);
        ctx.fillRect(cx - 16, yb - 70, 32, 50);
        // Steinkugel / Opferschale (generisch) im Dunkel
        ellipse(cx, yb - 22, 9, 3, 0, shade(st, -0.2));
        circle(cx, yb - 28, 6, vgrad(yb - 34, yb - 22, [[0, shade(st, 0.08)], [1, shade(st, -0.2)]]));
        jVines([[cx - 34, yb - 84, 40 + r() * 20, 3], [cx + 30, yb - 82, 30 + r() * 20, 3]], P.leaf);
        jBush(cx - 64, yb, 1.1, P.leaf, r);
        jBush(cx + 66, yb, 1.2, shade(P.leaf, 0.1), r);
        jBoulder(cx + 64, yb, 14, 12, P.rock, P.moss, r);
      }
    }
  };
  for (const k of Object.keys(jMid)) jMid[k].tex = { grain: 0.035 };

  // ---------- Dschungel: ferne Silhouetten im Nebel hinter den Stämmen ----------
  const J_FAR = GROUND_Y + 4;
  const jFarEnd = (w, h) => dissolve(w, h, h * 0.55, h);
  const jFar = {
    fpyramid: {
      size: r => [230 + r() * 50, 300],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.62), st = P.stone, n = 5, cx = w / 2, yb = h - 40;
        for (let k = 0; k < n; k++) {
          const tw = w * (0.48 - k * 0.075), th = 30, y = yb - k * th;
          poly([[cx - tw, y], [cx - tw + 8, y - th], [cx + tw - 8, y - th], [cx + tw, y]], hgrad(cx - tw, cx + tw, [[0, shade(st, 0.1)], [0.5, st], [1, shade(st, -0.2)]]));
          ctx.fillStyle = rgba(INK, 0.15);
          ctx.fillRect(cx - tw + 8, y - th, (tw - 8) * 2, 3);
        }
        // Treppe in der Mitte, Tempelhaus oben
        ctx.fillStyle = rgba(INK, 0.12);
        ctx.fillRect(cx - 12, yb - n * 30, 24, n * 30);
        const ty = yb - n * 30;
        jBlocks([[cx - 24, ty - 34, 48, 34, 0.7], [cx - 30, ty - 44, 60, 10, 0.8]], st, rgba(P.moss, 0.8));
        ctx.fillStyle = rgba(P.dark, 0.6);
        ctx.fillRect(cx - 8, ty - 26, 16, 26);
        // Bewuchs auf den Terrassen
        const tb = [];
        for (let k = 0; k < 18; k++) { const lv = Math.floor(r() * n), tw = w * (0.48 - lv * 0.075); tb.push([cx + (r() - 0.5) * tw * 1.8, yb - lv * 30 - 30 + 2, 5 + r() * 6]); }
        dots(tb, rgba(P.leaf, 0.85));
        jFarEnd(w, h);
      }
    },
    ffalls: {
      size: r => [200 + r() * 40, 270],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.62), top = 30 + r() * 30;
        const edge = jCliff(w, h, h, top, P.rock, P, r);
        jFall(edge[4][0], edge[4][1] + 8, h - 70, 16 + r() * 6, P.water, P.mist);
        jFarEnd(w, h);
      }
    },
    fgiants: {
      size: r => [220 + r() * 50, 290],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.62), n = 2 + (r() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const cx = w * (0.22 + 0.56 * k / Math.max(1, n - 1)) + (r() - 0.5) * 20, tw = 9 + r() * 5, ct = 30 + r() * 60;
          ctx.fillStyle = P.bark;
          ctx.fillRect(cx - tw * 0.85, ct + 20, tw * 1.7, h - ct - 58);
          ctx.beginPath();
          ctx.moveTo(cx - tw * 0.85, h - 40);
          ctx.quadraticCurveTo(cx - tw, h - 12, cx - tw * 2.2, h);
          ctx.lineTo(cx + tw * 2.2, h);
          ctx.quadraticCurveTo(cx + tw, h - 12, cx + tw * 0.85, h - 40);
          ctx.closePath();
          ctx.fill();
          // Schirmkrone
          const cr = [];
          for (let j = 0; j < 9; j++) cr.push([cx + (j - 4) * 11 + (r() - 0.5) * 6, ct + Math.abs(j - 4) * 4 + (r() - 0.5) * 6, 14 + r() * 8]);
          blobPath(cr.map(([a, b, c]) => [a + 2, b + 4, c]));
          ctx.fillStyle = shade(P.leaf, -0.2);
          ctx.fill();
          ctx.fillStyle = shade(P.bark, -0.18);
          ctx.fillRect(cx + tw * 0.2, ct + 20, tw * 0.6, h - ct - 20);
          blobPath(cr);
          ctx.fillStyle = P.leaf;
          ctx.fill();
          dots(cr.map(([a, b, c]) => [a - c * 0.2, b - c * 0.35, c * 0.5]), rgba(shade(P.leaf, 0.16), 0.5));
        }
        jFarEnd(w, h);
      }
    },
    fkarst: {
      size: r => [200 + r() * 60, 300],
      paint: (w, h, r, C) => {
        const P = jPal(C, 0.62), n = 3;
        for (let k = 0; k < n; k++) {
          const cx = w * (0.2 + 0.3 * k) + (r() - 0.5) * 20, tw = 24 + r() * 16, top = 40 + r() * 120;
          const pts = [[cx - tw * 1.3, h], [cx - tw, top + 30], [cx - tw * 0.6, top + 6], [cx, top], [cx + tw * 0.7, top + 10], [cx + tw, top + 40], [cx + tw * 1.3, h]];
          smooth(pts, true);
          ctx.fillStyle = shade(P.rock, -k * 0.04);
          ctx.fill();
          poly([[cx + tw * 0.15, top + 4], [cx + tw * 0.7, top + 10], [cx + tw, top + 40], [cx + tw * 1.3, h], [cx + tw * 0.3, h]], rgba(INK, 0.1));
          const tb = [];
          for (let j = 0; j < 8; j++) tb.push([cx + (r() - 0.5) * tw * 1.6, top + 4 + r() * 30, 5 + r() * 6]);
          dots(tb, rgba(P.leaf, 0.85));
        }
        jFarEnd(w, h);
      }
    }
  };
  for (const k of Object.keys(jFar)) jFar[k].tex = null;

  SCENE['Dschungel'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 40, gap: [20, 140], maxKs: 1.5, base: () => J_FAR,
        pick: flow(['fgiants', 'fpyramid', 'ffalls', 'fkarst'], [['fpyramid', 1.8], ['ffalls', 1.6], ['fgiants', 2], ['fkarst', 1.4]], 1),
        kinds: jFar },
      { z: 1, factor: 0.32, start: 30, gap: [30, 130], maxKs: 2, base: () => J_MID,
        pick: flow(['rocks', 'giant', 'temple', 'bridge', 'falls', 'shrine'],
          [['rocks', 1.3], ['giant', 1.5], ['temple', 1.6], ['bridge', 1.2], ['falls', 1.3], ['shrine', 1.2]], 3),
        kinds: jMid }
    ]
  };

  // ============================================================
  // WÜSTE: hinter den Dünen eine Karawane, Ruinenstadt, Felsnadeln und ein ferner Bogen;
  // zwischen Dünen und Tafelbergen windgeformte Felsen, Felsbogen, Oase, Säulenreste, Ruinenstadt
  // ============================================================
  const dPalCache = new Map();
  function dPal(C, hz) {
    const key = C.skyTop + (hz || 0);
    let P = dPalCache.get(key);
    if (P) return P;
    const rock = mix(C.near, C.accent, 0.16);
    P = {
      sand: mix(C.far, C.skyBottom, 0.18),
      rock,
      band1: mix(rock, C.accent, 0.3),
      band2: mix(rock, CREAM, 0.24),
      band3: shade(rock, -0.1),
      brick: mix(C.far, '#b4875a', 0.45),
      stone: mix(CREAM, C.far, 0.42),
      palm: mix('#5f8244', C.far, 0.22),
      trunk: mix('#86684a', C.far, 0.3),
      water: mix(C.skyTop, C.skyBottom, 0.35),
      grass: mix('#7f9a4c', C.far, 0.3),
      cloth: mix(CREAM, C.accent, 0.2),
      dark: mix(C.near, INK, 0.45),
      camel: mix(C.near, INK, 0.25)
    };
    if (hz) for (const k of Object.keys(P)) P[k] = mix(P[k], C.haze, hz);
    dPalCache.set(key, P);
    return P;
  }
  // Sandverwehung am Fuß
  function dDrift(x0, x1, yb, hgt, col, r) {
    oSand(x0, x1, yb, hgt, col, r);
  }
  // Schichtbänder auf einer Felsform (Form muss schon gefüllt sein): waagrechte Streifen, an der Form beschnitten
  function dBands(pathFn, y0, y1, w, P, r) {
    ctx.save();
    pathFn();
    ctx.clip();
    ctx.beginPath();
    const cols = [P.band1, P.band2, P.band3];
    let y = y0;
    const byCol = [[], [], []];
    while (y < y1) { const bh = 4 + r() * 9; byCol[Math.floor(r() * 3)].push([y, bh]); y += bh + 2 + r() * 6; }
    byCol.forEach((L, i) => { ctx.beginPath(); for (const [yy, bh] of L) ctx.rect(-2, yy, w + 4, bh); ctx.fillStyle = rgba(cols[i], 0.45); ctx.fill(); });
    ctx.restore();
  }
  // Dattelpalme: gebogener Stamm mit Ringen, Krone aus hängenden Wedeln
  function dPalm(x, yb, hh, lean, P, r) {
    const tx = x + lean, ty = yb - hh;
    ctx.beginPath();
    ctx.moveTo(x - 4, yb);
    ctx.quadraticCurveTo(x + lean * 0.2 - 3, yb - hh * 0.55, tx - 2, ty);
    ctx.lineTo(tx + 2, ty);
    ctx.quadraticCurveTo(x + lean * 0.2 + 3, yb - hh * 0.55, x + 4, yb);
    ctx.closePath();
    ctx.fillStyle = hgrad(x - 4, x + 4, [[0, shade(P.trunk, 0.15)], [1, shade(P.trunk, -0.25)]]);
    ctx.fill();
    ctx.beginPath();
    for (let t = 0.06; t < 0.98; t += 0.07) {
      const u = 1 - t, px = u * u * x + 2 * u * t * (x + lean * 0.2) + t * t * tx, py = u * u * yb + 2 * u * t * (yb - hh * 0.55) + t * t * ty;
      ctx.rect(px - 3.2 + t, py, 6.4 - 2 * t, 1);
    }
    ctx.fillStyle = rgba(INK, 0.2);
    ctx.fill();
    // Wedel: Blattfedern als gefüllte Bögen, dunkle zuerst
    const fr = [];
    const n = 8 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const a = -Math.PI * 0.95 + k / (n - 1) * Math.PI * 0.9 + (r() - 0.5) * 0.2; fr.push([a, 26 + r() * 10]); }
    for (const [pass, col] of [[0, shade(P.palm, -0.2)], [1, P.palm]]) {
      ctx.beginPath();
      for (const [a, len] of fr) {
        if ((a < -Math.PI / 2) === (pass === 0)) continue;
        const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.45 + len * 0.42, mx = tx + Math.cos(a) * len * 0.55, my = ty + Math.sin(a) * len * 0.5 - 4;
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(mx, my - 3, ex, ey);
        ctx.quadraticCurveTo(mx, my + 3, tx, ty + 2);
      }
      ctx.fillStyle = col;
      ctx.fill();
    }
    dots([[tx - 2, ty + 3, 2.2], [tx + 2, ty + 4, 2], [tx, ty + 5, 2]], mix(P.trunk, C_GOLD, 0.4));
  }
  // Kamel als kleine Silhouette (Gehrichtung rechts), optional mit Reiter oder Last
  function dCamel(x, y, s, col, load) {
    ctx.beginPath();
    ctx.ellipse(x, y - 9 * s, 7 * s, 3.4 * s, 0, 0, TAU);
    ctx.moveTo(x - 2 * s, y - 11 * s);
    ctx.ellipse(x - 1 * s, y - 11.5 * s, 3.2 * s, 2.6 * s, 0, Math.PI, TAU);
    ctx.moveTo(x + 5 * s, y - 10 * s);
    ctx.quadraticCurveTo(x + 9 * s, y - 10 * s, x + 9.5 * s, y - 15 * s);
    ctx.lineTo(x + 12 * s, y - 15 * s);
    ctx.lineTo(x + 12 * s, y - 13.6 * s);
    ctx.lineTo(x + 10.6 * s, y - 13.6 * s);
    ctx.quadraticCurveTo(x + 10 * s, y - 8 * s, x + 6 * s, y - 7.5 * s);
    ctx.closePath();
    for (const lx of [-5, -3.4, 3.2, 5]) ctx.rect(x + lx * s, y - 7 * s, 1 * s, 7 * s);
    if (load === 1) { ctx.rect(x - 2.4 * s, y - 18 * s, 2.6 * s, 5 * s); ctx.moveTo(x - 1.1 * s + 1.6 * s, y - 19 * s); ctx.arc(x - 1.1 * s, y - 19 * s, 1.6 * s, 0, TAU); }
    if (load === 2) ctx.rect(x - 5 * s, y - 15.5 * s, 8 * s, 4 * s);
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Lehmziegelmauer mit Zinnen, Löchern und Abbruchkante
  function dWall(x, yb, ww, wh, col, r, o) {
    o = o || {};
    const pts = [[x, yb], [x, yb - wh]];
    const crumb = o.crumb === undefined ? 0.5 : o.crumb;
    for (let k = 1; k < 8; k++) pts.push([x + ww * k / 8, yb - wh + (r() < crumb ? r() * wh * 0.35 : 0)]);
    pts.push([x + ww, yb - wh * (0.6 + r() * 0.4)], [x + ww, yb]);
    poly(pts, vgrad(yb - wh, yb, [[0, shade(col, 0.1)], [1, shade(col, -0.12)]]));
    if (o.merlons) {
      ctx.beginPath();
      for (let k = 0; k < ww / 9; k++) ctx.rect(x + 1 + k * 9, yb - wh - 5, 5, 5);
      ctx.fillStyle = shade(col, 0.04);
      ctx.fill();
    }
    ctx.beginPath();
    for (let k = 0; k < ww * wh / 260; k++) ctx.rect(x + 2 + r() * (ww - 8), yb - wh * 0.15 - r() * wh * 0.7, 4 + r() * 3, 1.2);
    ctx.fillStyle = rgba(INK, 0.12);
    ctx.fill();
    ctx.fillStyle = rgba(INK, 0.16);
    ctx.fillRect(x + ww - 3, yb - wh * 0.9, 3, wh * 0.9);
  }

  const D_MID = 496, D_FAR = 452;
  const dMid = {
    hoodoo: {
      size: r => [200 + r() * 40, 190],
      paint: (w, h, r, C) => {
        const P = dPal(C, 0.14), yb = h - 6;
        // zwei, drei Pilzfelsen: schmaler Sockel, breite Kappe, windgeschliffen
        const n = 2 + (r() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const cx = w * (0.22 + 0.56 * k / Math.max(1, n - 1)) + (r() - 0.5) * 14, ph = 50 + r() * 70, pw = 9 + r() * 6, cw = 24 + r() * 12, ch = 18 + r() * 10, top = yb - ph - ch;
          const shape = () => {
            ctx.beginPath();
            ctx.moveTo(cx - pw * 1.8, yb + 2);
            ctx.quadraticCurveTo(cx - pw * 0.6, yb - ph * 0.4, cx - pw, yb - ph);
            ctx.quadraticCurveTo(cx - cw * 1.1, yb - ph - 2, cx - cw, top + ch * 0.4);
            ctx.quadraticCurveTo(cx - cw * 0.6, top - 3, cx, top);
            ctx.quadraticCurveTo(cx + cw * 0.7, top - 2, cx + cw, top + ch * 0.5);
            ctx.quadraticCurveTo(cx + cw * 0.9, yb - ph + 3, cx + pw, yb - ph);
            ctx.quadraticCurveTo(cx + pw * 0.7, yb - ph * 0.4, cx + pw * 1.9, yb + 2);
            ctx.closePath();
          };
          shape();
          ctx.fillStyle = hgrad(cx - cw, cx + cw, [[0, shade(P.rock, 0.16)], [0.45, P.rock], [1, shade(P.rock, -0.22)]]);
          ctx.fill();
          dBands(shape, top, yb, w, P, r);
          // Schatten unter der Kappe
          ellipse(cx + 3, yb - ph + 1, cw * 0.75, 3.2, 0, rgba(INK, 0.22));
          line(cx - cw * 0.7, top + 1.5, cx + cw * 0.2, top - 0.5, rgba(CREAM, 0.35), 1.2);
        }
        dDrift(-4, w + 4, h, 14, P.sand, r);
      }
    },
    arch: {
      size: r => [240 + r() * 40, 200],
      paint: (w, h, r, C) => {
        const P = dPal(C, 0.24), yb = h - 6, top = 12 + r() * 14, th = 28 + r() * 10, ow = w * (0.36 + r() * 0.06), cx = w * 0.5;
        const shape = () => {
          ctx.beginPath();
          ctx.moveTo(w * 0.02, yb + 2);
          ctx.quadraticCurveTo(w * 0.06, top + 40, w * 0.2, top + 6);
          ctx.quadraticCurveTo(cx, top - 8, w * 0.8, top + 10);
          ctx.quadraticCurveTo(w * 0.95, top + 40, w * 0.98, yb + 2);
          ctx.lineTo(cx + ow * 0.62, yb + 2);
          ctx.quadraticCurveTo(cx + ow * 0.66, top + th + 20, cx, top + th);
          ctx.quadraticCurveTo(cx - ow * 0.66, top + th + 20, cx - ow * 0.62, yb + 2);
          ctx.closePath();
        };
        shape();
        ctx.fillStyle = hgrad(0, w, [[0, shade(P.rock, 0.14)], [0.5, P.rock], [1, shade(P.rock, -0.2)]]);
        ctx.fill();
        dBands(shape, top - 8, yb, w, P, r);
        // Innenseite des Bogens im Schatten
        ctx.beginPath();
        ctx.moveTo(cx + ow * 0.62, yb + 2);
        ctx.quadraticCurveTo(cx + ow * 0.66, top + th + 20, cx, top + th);
        ctx.lineTo(cx + 4, top + th + 6);
        ctx.quadraticCurveTo(cx + ow * 0.55, top + th + 26, cx + ow * 0.5, yb + 2);
        ctx.closePath();
        ctx.fillStyle = rgba(INK, 0.2);
        ctx.fill();
        line(w * 0.22, top + 6, cx, top - 6, rgba(CREAM, 0.32), 1.4);
        dDrift(-4, w * 0.36, h, 16, P.sand, r);
        dDrift(w * 0.64, w + 4, h, 16, P.sand, r);
        // Geröll
        const sc = [];
        for (let k = 0; k < 20; k++) sc.push([w * (0.05 + r() * 0.9), yb - r() * 6, 1 + r() * 2]);
        dots(sc, rgba(shade(P.rock, -0.2), 0.7));
      }
    },
    oasis: {
      size: r => [260 + r() * 40, 172],
      paint: (w, h, r, C) => {
        const P = dPal(C, 0.12), yb = h - 6, py = yb - 10;
        // Grasring, Teich mit Himmelsspiegelung
        ellipse(w * 0.5, py, w * 0.44, 12, 0, P.grass);
        ellipse(w * 0.5, py + 1, w * 0.36, 8, 0, vgrad(py - 8, py + 8, [[0, shade(P.water, 0.1)], [1, shade(P.water, -0.15)]]));
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.rect(w * (0.25 + r() * 0.45), py - 3 + r() * 6, 8 + r() * 14, 0.8);
        ctx.fillStyle = rgba(CREAM, 0.4);
        ctx.fill();
        // Schilf und Büsche am Ufer
        const bl = [];
        for (let k = 0; k < 10; k++) bl.push([w * (0.08 + r() * 0.84), py + 2 + r() * 6, 6 + r() * 8, (r() - 0.5) * 4]);
        oWeeds(bl, rgba(shade(P.grass, -0.05), 0.95));
        // Palmen hinten, dann vorn
        const n = 4 + Math.floor(r() * 2), palms = [];
        for (let k = 0; k < n; k++) palms.push([w * (0.12 + 0.76 * k / (n - 1)) + (r() - 0.5) * 16, py - 4 + (k % 2) * 6, 70 + r() * 60, (r() - 0.5) * 30]);
        palms.sort((a, b) => a[1] - b[1]);
        for (const [x, y, hh, lean] of palms) dPalm(x, y, hh, lean, P, r);
        // kleines Zelt
        if (r() < 0.7) {
          const tx = w * (r() < 0.5 ? 0.2 : 0.7), ty = yb - 2;
          poly([[tx - 16, ty], [tx - 4, ty - 16], [tx + 14, ty - 14], [tx + 20, ty]], vgrad(ty - 16, ty, [[0, shade(P.cloth, 0.08)], [1, shade(P.cloth, -0.14)]]));
          poly([[tx - 4, ty - 16], [tx + 1, ty], [tx - 9, ty]], rgba(INK, 0.3));
        }
        dDrift(-4, w * 0.3, h, 8, P.sand, r);
        dDrift(w * 0.7, w + 4, h, 8, P.sand, r);
      }
    },
    columns: {
      size: r => [230 + r() * 40, 180],
      paint: (w, h, r, C) => {
        const P = dPal(C, 0.14), yb = h - 12, st = P.stone;
        // Stylobat, halb im Sand
        ctx.fillStyle = vgrad(yb - 8, yb, [[0, shade(st, 0.08)], [1, shade(st, -0.18)]]);
        ctx.fillRect(w * 0.06, yb - 8, w * 0.86, 8);
        const n = 5, sp = w * 0.72 / (n - 1), hs = [], cw = 13 + r() * 3;
        for (let k = 0; k < n; k++) hs.push(k === 1 || k === 2 ? 118 + r() * 20 : 40 + r() * 70);
        hs[1] = hs[2] = Math.min(hs[1], hs[2]);
        for (let k = 0; k < n; k++) oColumn(w * 0.14 + k * sp, yb - 8, cw, hs[k], st, !(k === 1 || k === 2), r);
        const x1c = w * 0.14 + sp, x2c = x1c + sp, ay = yb - 8 - hs[1] - 12;
        ctx.fillStyle = vgrad(ay, ay + 12, [[0, shade(st, 0.14)], [1, shade(st, -0.16)]]);
        ctx.beginPath();
        ctx.moveTo(x1c - cw - 6, ay + 12);
        ctx.lineTo(x1c - cw - 6, ay);
        ctx.lineTo(x2c + cw + 4, ay);
        ctx.lineTo(x2c + cw + 12, ay + 5);
        ctx.lineTo(x2c + cw + 2, ay + 12);
        ctx.closePath();
        ctx.fill();
        // umgestürzte Trommeln, Kapitell im Sand
        for (let k = 0; k < 2; k++) {
          const ex = w * (0.62 + k * 0.12) + r() * 8, ey = yb + 2;
          ellipse(ex + 8, ey, 10, 2, 0, rgba(INK, 0.14));
          ctx.fillStyle = vgrad(ey - 11, ey, [[0, shade(st, 0.12)], [1, shade(st, -0.2)]]);
          ctx.fillRect(ex, ey - 11, 13, 11);
          ellipse(ex + 13, ey - 5.5, 2.4, 5.5, 0, shade(st, -0.1));
        }
        dDrift(-4, w * 0.5, h, 16, P.sand, r);
        dDrift(w * 0.45, w + 4, h, 12, P.sand, r);
      }
    },
    city: {
      size: r => [280 + r() * 40, 160],
      paint: (w, h, r, C) => {
        const P = dPal(C, 0.14), yb = h - 8, br = P.brick;
        // Turmstumpf, Kuppelbau, Mauern mit Tor
        const tx = w * (0.1 + r() * 0.06);
        dWall(tx, yb, 34, 96 + r() * 20, shade(br, 0.04), r, { crumb: 0.6 });
        ctx.fillStyle = rgba(P.dark, 0.7);
        ctx.fillRect(tx + 13, yb - 70, 7, 11);
        ctx.fillRect(tx + 13, yb - 40, 7, 10);
        const dx = w * (0.5 + r() * 0.08), dw = 30 + r() * 8;
        dWall(dx - dw, yb, dw * 2, 50, br, r, { crumb: 0.1 });
        ctx.beginPath();
        ctx.moveTo(dx - dw * 0.85, yb - 50);
        ctx.ellipse(dx, yb - 50, dw * 0.85, dw * 0.8, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = hgrad(dx - dw, dx + dw, [[0, shade(br, 0.18)], [0.5, shade(br, 0.02)], [1, shade(br, -0.2)]]);
        ctx.fill();
        // eingestürzter Teil der Kuppel
        poly([[dx + dw * 0.1, yb - 50 - dw * 0.78], [dx + dw * 0.5, yb - 50 - dw * 0.6], [dx + dw * 0.3, yb - 50 - dw * 0.3], [dx + dw * 0.05, yb - 50 - dw * 0.42]], rgba(P.dark, 0.7));
        ctx.fillStyle = rgba(P.dark, 0.7);
        roundRectPath(dx - 7, yb - 30, 14, 30, 7);
        ctx.fill();
        dWall(tx + 30, yb, dx - dw - tx - 30, 44, shade(br, -0.03), r, { merlons: true, crumb: 0.3 });
        dWall(dx + dw, yb, w * 0.92 - dx - dw, 36 + r() * 14, shade(br, -0.05), r, { crumb: 0.7 });
        // Tor mit Bogen in der linken Mauer
        const gx = (tx + 30 + dx - dw) / 2;
        ctx.fillStyle = rgba(P.dark, 0.75);
        roundRectPath(gx - 8, yb - 30, 16, 30, 8);
        ctx.fill();
        dDrift(-4, w * 0.45, h, 18, P.sand, r);
        dDrift(w * 0.4, w + 4, h, 14, P.sand, r);
      }
    }
  };
  for (const k of Object.keys(dMid)) dMid[k].tex = { grain: 0.035 };

  // ---------- Wüste: ferne Motive hinter den Dünen (Kämme 382 bis 446) ----------
  const dFarPal = C => dPal(C, 0.42);
  const dFar = {
    fcaravan: {
      size: r => [260 + r() * 60, 92],
      paint: (w, h, r, C) => {
        const P = dFarPal(C), crest = 30 + r() * 8;
        // flacher Dünenkamm, auf dem die Karawane zieht
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.quadraticCurveTo(w * 0.15, crest + 6, w * 0.5, crest);
        ctx.quadraticCurveTo(w * 0.85, crest + 6, w, h);
        ctx.closePath();
        ctx.fillStyle = vgrad(crest, h, [[0, shade(P.sand, 0.06)], [1, shade(P.sand, -0.08)]]);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w * 0.5, crest);
        ctx.quadraticCurveTo(w * 0.85, crest + 6, w, h);
        ctx.lineTo(w * 0.6, h);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(P.rock, C.skyTop, 0.3), 0.16);
        ctx.fill();
        const n = 5 + Math.floor(r() * 3), col = mix(P.camel, C.haze, 0.25);
        for (let k = 0; k < n; k++) {
          const t = 0.22 + 0.56 * k / (n - 1), x = w * t, y = crest + Math.pow((t - 0.5) * 2, 2) * 5 + 1;
          dCamel(x, y, 0.9, col, k % 3 === 0 ? 1 : 2);
        }
        hazeOver(w, h, C.haze, 0.12);
      }
    },
    fcity: {
      size: r => [240 + r() * 50, 130],
      paint: (w, h, r, C) => {
        const P = dFarPal(C), base = 64;
        // Plateau
        poly([[0, h], [w * 0.06, base], [w * 0.94, base + 2], [w, h]], vgrad(base, h, [[0, shade(P.rock, 0.06)], [1, shade(P.rock, -0.1)]]));
        // Silhouette aus Türmen, Kuppeln und Mauern
        ctx.beginPath();
        for (let x = w * 0.1; x < w * 0.88; ) {
          const v = r(), bw = 14 + r() * 22;
          if (v < 0.35) ctx.rect(x, base - 20 - r() * 34, bw * 0.6, 60);
          else if (v < 0.6) { ctx.rect(x, base - 16, bw, 20); ctx.moveTo(x, base - 16); ctx.ellipse(x + bw / 2, base - 16, bw / 2, bw * 0.45, 0, Math.PI, TAU); }
          else ctx.rect(x, base - 8 - r() * 10, bw, 30);
          x += bw * (0.7 + r() * 0.5);
        }
        ctx.fillStyle = shade(P.brick, -0.04);
        ctx.fill();
        ctx.beginPath();
        for (let k = 0; k < 12; k++) ctx.rect(w * (0.12 + r() * 0.74), base - 6 - r() * 30, 2.2, 3);
        ctx.fillStyle = rgba(P.dark, 0.5);
        ctx.fill();
        hazeOver(w, h, C.haze, 0.1);
      }
    },
    fbutte: {
      size: r => [200 + r() * 60, 170],
      paint: (w, h, r, C) => {
        const P = dFarPal(C), n = 3 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const cx = w * (0.15 + 0.7 * k / (n - 1)) + (r() - 0.5) * 16, bw = 10 + r() * 20, top = 10 + r() * 80;
          const pts = [[cx - bw - 14, h], [cx - bw, top + 8], [cx - bw * 0.7, top], [cx + bw * 0.7, top], [cx + bw, top + 10], [cx + bw + 16, h]];
          poly(pts, hgrad(cx - bw, cx + bw, [[0, shade(P.rock, 0.1)], [0.6, P.rock], [1, shade(P.rock, -0.14)]]));
          ctx.beginPath();
          for (let y = top + 6; y < h; y += 8 + r() * 8) ctx.rect(cx - bw - 6, y, bw * 2 + 12, 2.4);
          ctx.fillStyle = rgba(P.band1, 0.35);
          ctx.fill();
        }
        hazeOver(w, h, C.haze, 0.1);
      }
    },
    farch: {
      size: r => [200 + r() * 50, 140],
      paint: (w, h, r, C) => {
        const P = dFarPal(C), top = 34 + r() * 10, cx = w * 0.5;
        // flache Naturbrücke mit dünnem Bogen über einer breiten Öffnung, links ein Felsblock
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.04, top + 10);
        ctx.lineTo(w * 0.2, top);
        ctx.quadraticCurveTo(cx, top - 4, w * 0.84, top + 4);
        ctx.lineTo(w * 0.94, top + 20);
        ctx.lineTo(w, h);
        ctx.lineTo(w * 0.86, h);
        ctx.quadraticCurveTo(w * 0.84, top + 18, cx + w * 0.1, top + 13);
        ctx.quadraticCurveTo(w * 0.24, top + 18, w * 0.2, h);
        ctx.closePath();
        ctx.fillStyle = hgrad(0, w, [[0, shade(P.rock, 0.1)], [1, shade(P.rock, -0.14)]]);
        ctx.fill();
        hazeOver(w, h, C.haze, 0.08);
      }
    }
  };
  for (const k of Object.keys(dFar)) dFar[k].tex = null;

  SCENE['Wüste'] = {
    tracks: [
      { z: 0, factor: 0.08, start: 60, gap: [40, 180], maxKs: 1.5, base: () => D_FAR,
        pick: flow(['fbutte', 'fcaravan', 'fcity', 'farch'], [['fcaravan', 1.6], ['fcity', 1.8], ['fbutte', 2], ['farch', 1.4]], 1),
        kinds: dFar },
      { z: 1, factor: 0.3, start: 20, gap: [30, 140], maxKs: 2, base: () => D_MID,
        pick: flow(['hoodoo', 'arch', 'oasis', 'columns', 'city'],
          [['hoodoo', 1.4], ['arch', 1.5], ['oasis', 1.5], ['columns', 1.4], ['city', 1.6]], 2),
        kinds: dMid }
    ]
  };

  // ============================================================
  // SUMPF: im Nebel hinter den Zypressen eine verfallene Mühle, Pfahlhütten und tote Bäume;
  // davor im Wasser toter Baum, Steg mit altem Boot, Pfahlhütte, schwache Laternen, Mühle
  // ============================================================
  const sPalCache = new Map();
  function sPal(C, hz) {
    const key = C.skyTop + (hz || 0);
    let P = sPalCache.get(key);
    if (P) return P;
    const fog = mix(C.skyBottom, CREAM, 0.3);
    P = {
      fog,
      wood: mix('#6a5a45', C.far, 0.35),
      thatch: mix('#8c7e56', C.far, 0.32),
      stone: mix('#8c8a78', C.far, 0.38),
      dead: mix('#5e5a4e', C.far, 0.32),
      moss: mix(C.accent, C.far, 0.55),
      reed: mix(C.near, C.accent, 0.25),
      lamp: mix(C.accent, CREAM, 0.45),
      dark: mix(INK, C.near, 0.5),
      water: mix(C.skyBottom, C.mid, 0.42)
    };
    if (hz) for (const k of Object.keys(P)) if (k !== 'fog') P[k] = mix(P[k], mix(C.haze, fog, 0.3), hz);
    sPalCache.set(key, P);
    return P;
  }
  // Pfähle als schmale Rechtecke mit Lichtkante, leicht schief
  function sPosts(list, wood) {
    ctx.beginPath();
    for (const [x, y0, y1, pw, lean] of list) { ctx.moveTo(x - pw / 2, y1); ctx.lineTo(x - pw / 2 + lean, y0); ctx.lineTo(x + pw / 2 + lean, y0); ctx.lineTo(x + pw / 2, y1); ctx.closePath(); }
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.beginPath();
    for (const [x, y0, y1, pw, lean] of list) { ctx.moveTo(x + pw * 0.15, y1); ctx.lineTo(x + pw * 0.15 + lean, y0); ctx.lineTo(x + pw / 2 + lean, y0); ctx.lineTo(x + pw / 2, y1); ctx.closePath(); }
    ctx.fillStyle = rgba(INK, 0.22);
    ctx.fill();
  }
  // Schilfbüschel am Wasser
  function sReeds(list, col) {
    oWeeds(list.map(([x, y, hh, lean]) => [x, y, hh, lean]), col);
  }
  // schwache Laterne: Gehäuse, matt leuchtendes Glas, kaum Schein
  function sLamp(x, y, s, P) {
    soft(x, y, 16 * s, 16 * s, P.lamp, 0.16);
    ctx.fillStyle = P.dark;
    ctx.fillRect(x - 3.4 * s, y - 5 * s, 6.8 * s, 1.4 * s);
    ctx.fillRect(x - 2.8 * s, y + 4 * s, 5.6 * s, 1.4 * s);
    ctx.fillStyle = rgba(P.lamp, 0.7);
    ctx.fillRect(x - 2.6 * s, y - 3.6 * s, 5.2 * s, 7.6 * s);
    ctx.fillStyle = rgba(P.dark, 0.8);
    ctx.fillRect(x - 0.4 * s, y - 3.6 * s, 0.8 * s, 7.6 * s);
    poly([[x - 3.6 * s, y - 5 * s], [x, y - 8.5 * s], [x + 3.6 * s, y - 5 * s]], P.dark);
  }
  // kahler, knorriger Baum: Äste als gefüllte, sich verjüngende Bänder in einem Pfad
  function sDeadTree(x, yb, hh, tw, col, r, beards) {
    const segsL = [];
    const grow = (x0, y0, a, l, wd, d) => {
      const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l, w1 = wd * 0.66;
      segsL.push([x0, y0, x1, y1, wd, w1]);
      if (d < 3) {
        const nb = d === 0 ? 3 : 2;
        for (let k = 0; k < nb; k++) grow(x1, y1, a + (k - (nb - 1) / 2) * (0.7 + r() * 0.3) + (r() - 0.5) * 0.3, l * (0.55 + r() * 0.2), w1, d + 1);
      } else if (beards) beards.push([x1, y1, 10 + r() * 16, 1.1, (r() - 0.5) * 2]);
    };
    // Stamm mit Wurzelanlauf
    ctx.beginPath();
    ctx.moveTo(x - tw * 1.6, yb + 2);
    ctx.quadraticCurveTo(x - tw * 0.6, yb - hh * 0.12, x - tw * 0.45, yb - hh * 0.55);
    ctx.lineTo(x + tw * 0.45, yb - hh * 0.55);
    ctx.quadraticCurveTo(x + tw * 0.6, yb - hh * 0.12, x + tw * 1.7, yb + 2);
    ctx.closePath();
    ctx.fillStyle = hgrad(x - tw, x + tw, [[0, shade(col, 0.12)], [0.5, col], [1, shade(col, -0.26)]]);
    ctx.fill();
    grow(x, yb - hh * 0.5, -Math.PI / 2 + (r() - 0.5) * 0.3, hh * 0.32, tw * 0.9, 0);
    ctx.beginPath();
    for (const [x0, y0, x1, y1, w0, w1] of segsL) {
      const dl = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / dl, ny = (x1 - x0) / dl;
      ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
      ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
      ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
      ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
      ctx.closePath();
    }
    ctx.fillStyle = col;
    ctx.fill();
    // Astloch, Rindenrisse
    ellipse(x + tw * 0.1, yb - hh * 0.3, tw * 0.22, tw * 0.4, 0, rgba(INK, 0.45));
    ctx.beginPath();
    for (let k = 0; k < 8; k++) ctx.rect(x - tw * 0.4 + r() * tw * 0.8, yb - hh * (0.1 + r() * 0.4), 0.9, 10 + r() * 14);
    ctx.fillStyle = rgba(INK, 0.2);
    ctx.fill();
  }

  const S_MID = 516, S_FAR = 520;
  const sMid = {
    deadtree: {
      size: r => [200 + r() * 40, 250],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.2), yb = h - 20, beards = [];
        sDeadTree(w * (0.45 + (r() - 0.5) * 0.1), yb, 210 + r() * 30, 13 + r() * 4, P.dead, r, beards);
        a2MossBeards(beards, rgba(P.moss, 0.6));
        // zweiter, kleiner Stumpf
        if (r() < 0.7) sPosts([[w * 0.8, yb - 40 - r() * 30, yb + 20, 10, (r() - 0.5) * 6]], shade(P.dead, -0.05));
        sReeds([[w * 0.2, yb, 18, -3], [w * 0.3, yb + 2, 14, 2], [w * 0.66, yb, 20, 3], [w * 0.88, yb + 2, 12, -2]], rgba(P.reed, 0.9));
      }
    },
    jetty: {
      size: r => [250 + r() * 40, 140],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.2), wl = h - 24, dy = wl - 22, yb = h;
        // Pfähle, Planken mit Lücken, ein abgesackter Teil
        const posts = [];
        for (let x = 12; x < w * 0.86; x += 30 + r() * 8) posts.push([x, dy - 6, yb, 5, (r() - 0.5) * 3]);
        sPosts(posts, P.wood);
        const brk = w * (0.45 + r() * 0.2);
        ctx.beginPath();
        for (let x = 6; x < w * 0.88; x += 6.4) {
          if (Math.abs(x - brk) < 14) continue;
          const sag = x > brk ? (x - brk) * 0.05 : 0;
          if (r() < 0.12) continue;
          ctx.rect(x, dy + sag + (r() - 0.5) * 1.2, 5.4, 3.2);
        }
        ctx.fillStyle = shade(P.wood, 0.12);
        ctx.fill();
        ctx.fillStyle = rgba(INK, 0.25);
        ctx.fillRect(6, dy + 3.2, brk - 20, 1.4);
        // altes Boot, halb voll Wasser, an der Leine
        const bx = w * (0.18 + r() * 0.2), by = wl + 2, bl = 64 + r() * 14;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(-0.06 + r() * 0.04);
        ctx.beginPath();
        ctx.moveTo(-bl / 2, -10);
        ctx.quadraticCurveTo(-bl * 0.35, 4, 0, 4);
        ctx.quadraticCurveTo(bl * 0.35, 4, bl / 2 + 4, -12);
        ctx.lineTo(bl / 2 - 2, -9);
        ctx.quadraticCurveTo(0, -6, -bl / 2 + 2, -8);
        ctx.closePath();
        ctx.fillStyle = vgrad(-12, 4, [[0, shade(P.wood, 0.1)], [1, shade(P.wood, -0.3)]]);
        ctx.fill();
        ctx.fillStyle = rgba(INK, 0.22);
        ctx.fillRect(-bl * 0.3, -6, bl * 0.6, 1.2);
        ctx.fillStyle = shade(P.wood, -0.15);
        ctx.fillRect(-bl * 0.1, -9.5, 5, 2);
        ctx.restore();
        ctx.strokeStyle = rgba(shade(P.wood, -0.3), 0.8);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(bx + bl * 0.45, by - 10);
        ctx.quadraticCurveTo(bx + bl * 0.6, by - 2, posts[Math.min(posts.length - 1, 3)][0], dy + 4);
        ctx.stroke();
        // Laternenpfahl am Stegende
        const lx = posts[posts.length - 1][0] + 2;
        sPosts([[lx, dy - 46, dy, 3.4, 0]], shade(P.wood, -0.08));
        ctx.fillStyle = shade(P.wood, -0.1);
        ctx.fillRect(lx, dy - 44, 10, 2);
        sLamp(lx + 9, dy - 36, 0.9, P);
        sReeds([[w * 0.92, wl + 4, 22, 3], [w * 0.97, wl + 6, 16, -2], [8, wl + 6, 14, 2]], rgba(P.reed, 0.9));
      }
    },
    hut: {
      size: r => [190 + r() * 30, 196],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.2), wl = h - 24, fy = wl - 40, cx = w * 0.5, hw = 50 + r() * 10, wh = 40 + r() * 8;
        // Stelzen, Plattform, Leiter
        const posts = [];
        for (let k = 0; k < 6; k++) posts.push([cx - hw - 8 + k * (hw * 2 + 16) / 5, fy, h, 4.4, (r() - 0.5) * 4]);
        sPosts(posts, shade(P.wood, -0.05));
        ctx.fillStyle = shade(P.wood, 0.08);
        ctx.fillRect(cx - hw - 14, fy - 4, hw * 2 + 28, 5);
        ctx.fillStyle = rgba(INK, 0.25);
        ctx.fillRect(cx - hw - 14, fy + 1, hw * 2 + 28, 1.6);
        const lx = cx + hw + 2;
        ctx.beginPath();
        ctx.rect(lx, fy, 1.6, wl - fy + 10);
        ctx.rect(lx + 8, fy, 1.6, wl - fy + 10);
        for (let y = fy + 6; y < wl + 6; y += 7) ctx.rect(lx, y, 9.6, 1.4);
        ctx.fillStyle = shade(P.wood, -0.12);
        ctx.fill();
        // Hütte: Bretterwand, kleines Fenster mit mattem Licht, Tür
        const top = fy - 4 - wh;
        ctx.fillStyle = hgrad(cx - hw, cx + hw, [[0, shade(P.wood, 0.1)], [1, shade(P.wood, -0.2)]]);
        ctx.fillRect(cx - hw, top, hw * 2, wh);
        ctx.beginPath();
        for (let x = cx - hw + 5; x < cx + hw; x += 5) ctx.rect(x, top, 0.8, wh);
        ctx.fillStyle = rgba(INK, 0.16);
        ctx.fill();
        ctx.fillStyle = rgba(P.lamp, 0.55);
        ctx.fillRect(cx - hw * 0.6, top + wh * 0.3, 11, 9);
        ctx.fillStyle = P.dark;
        ctx.fillRect(cx - hw * 0.6 + 5, top + wh * 0.3, 1.2, 9);
        ctx.fillRect(cx + hw * 0.25, top + wh * 0.25, 13, wh * 0.75);
        // Schilfdach mit ausgefranstem Rand, eine Ecke eingesunken
        const ry = top - 26 - r() * 6;
        poly([[cx - hw - 12, top + 6], [cx - 6, ry], [cx + 8, ry + 1], [cx + hw + 14, top + 8]], vgrad(ry, top + 8, [[0, shade(P.thatch, 0.14)], [1, shade(P.thatch, -0.15)]]));
        ctx.beginPath();
        for (let x = cx - hw - 10; x < cx + hw + 12; x += 3) ctx.rect(x, top + 5 + (x - cx) * 0.02 + hash(x) * 3, 1.4, 3 + hash(x * 2.3) * 4);
        ctx.fillStyle = shade(P.thatch, -0.12);
        ctx.fill();
        ctx.beginPath();
        for (let k = 0; k < 12; k++) { const x = cx - hw + r() * hw * 2; ctx.rect(x, ry + 4 + r() * (top - ry - 6) * 0.8, 6 + r() * 6, 0.8); }
        ctx.fillStyle = rgba(INK, 0.16);
        ctx.fill();
        // Moos auf dem Dach, Laterne am Eingang
        ellipses([[cx - hw * 0.3, top - 6, 14, 3, -0.2], [cx + hw * 0.5, top - 2, 10, 2.4, 0.15]], rgba(P.moss, 0.6));
        sLamp(cx + hw * 0.25 - 6, top + wh * 0.35, 0.8, P);
        sReeds([[cx - hw - 20, wl + 4, 20, -3], [cx + hw + 26, wl + 6, 16, 3], [cx - 10, wl + 8, 12, 2]], rgba(P.reed, 0.9));
      }
    },
    lanterns: {
      size: r => [160 + r() * 30, 150],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.2), wl = h - 24;
        // kleine Bulte mit Schilf, darauf zwei, drei Laternenpfähle
        ctx.beginPath();
        ctx.ellipse(w * 0.5, wl + 4, w * 0.42, 9, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = vgrad(wl - 5, wl + 4, [[0, shade(P.reed, -0.05)], [1, shade(P.reed, -0.3)]]);
        ctx.fill();
        const n = 2 + (r() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const x = w * (0.28 + 0.44 * k / Math.max(1, n - 1)) + (r() - 0.5) * 10, ph = 70 + r() * 30, lean = (r() - 0.5) * 8;
          sPosts([[x, wl - ph, wl + 6, 3.6, lean]], shade(P.wood, -0.05));
          ctx.fillStyle = shade(P.wood, -0.1);
          ctx.fillRect(x + lean, wl - ph + 2, 11, 2);
          ctx.fillRect(x + lean + 9, wl - ph + 2, 1, 6);
          sLamp(x + lean + 9.5, wl - ph + 12, 0.9, P);
        }
        const rd = [];
        for (let k = 0; k < 8; k++) rd.push([w * (0.12 + r() * 0.76), wl + 2, 14 + r() * 16, (r() - 0.5) * 6]);
        sReeds(rd, rgba(P.reed, 0.9));
      }
    },
    mill: {
      size: r => [200 + r() * 30, 260],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.22), wl = h - 24, cx = w * 0.48, bw0 = 26, bw1 = 17, bh = 120 + r() * 20, top = wl - bh;
        // Insel
        ctx.beginPath();
        ctx.ellipse(cx, wl + 6, w * 0.4, 14, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = vgrad(wl - 8, wl + 6, [[0, shade(P.reed, -0.05)], [1, shade(P.reed, -0.3)]]);
        ctx.fill();
        // Steinturm, verjüngt, mit Rissen und Moos
        poly([[cx - bw0, wl + 4], [cx - bw1, top], [cx + bw1, top], [cx + bw0, wl + 4]], hgrad(cx - bw0, cx + bw0, [[0, shade(P.stone, 0.12)], [0.45, P.stone], [1, shade(P.stone, -0.25)]]));
        ctx.beginPath();
        for (let y = top + 6; y < wl; y += 7) { const t = (wl - y) / bh, hw = lerp(bw0, bw1, t); for (let x = -hw + ((y / 7) % 2) * 4; x < hw - 4; x += 9) ctx.rect(cx + x, y, 7, 0.9); }
        ctx.fillStyle = rgba(INK, 0.13);
        ctx.fill();
        ctx.fillStyle = rgba(P.dark, 0.8);
        roundRectPath(cx - 5, wl - 22, 10, 22, 5);
        ctx.fill();
        ctx.fillRect(cx - 3, top + 24, 6, 8);
        ctx.fillRect(cx + 2, top + 60, 5, 7);
        poly([[cx + bw1 - 4, top + 10], [cx + bw1 + 1, top + 30], [cx + bw1 - 6, top + 52]], rgba(INK, 0.3));
        ellipses([[cx - bw1, top + 40, 6, 12, 0], [cx - bw0 + 4, wl - 20, 7, 10, 0]], rgba(P.moss, 0.6));
        // eingesunkene Kappe mit bloßen Sparren
        poly([[cx - bw1 - 4, top + 2], [cx - 4, top - 18], [cx + bw1 + 4, top + 4]], vgrad(top - 18, top + 4, [[0, shade(P.wood, 0.05)], [1, shade(P.wood, -0.2)]]));
        ctx.fillStyle = rgba(P.dark, 0.85);
        poly([[cx + 1, top - 14], [cx + bw1 + 2, top + 3], [cx + 6, top + 3]], rgba(P.dark, 0.85));
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const x = cx + 4 + k * 4; ctx.moveTo(x, top + 3); ctx.lineTo(x - 1 + k, top - 12 + k * 4); ctx.lineTo(x + 0.4 + k, top - 12 + k * 4); ctx.lineTo(x + 1.4, top + 3); ctx.closePath(); }
        ctx.fillStyle = shade(P.wood, -0.1);
        ctx.fill();
        // gebrochene Flügel: einer steht schräg, einer hängt
        const hx = cx - bw1 - 2, hy = top - 4;
        ctx.save();
        ctx.translate(hx, hy);
        for (const [a, L] of [[-0.9 + r() * 0.2, 70], [1.45, 44]]) {
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = shade(P.wood, -0.15);
          ctx.fillRect(0, -1.4, L, 2.8);
          ctx.beginPath();
          for (let t = L * 0.3; t < L - 2; t += 6) ctx.rect(t, 1.4, 1, 9);
          ctx.rect(L * 0.3, 9.4, L * 0.7 - 2, 1);
          ctx.fillStyle = rgba(shade(P.wood, -0.1), 0.85);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        circle(hx, hy, 3, P.dark);
        sReeds([[cx - w * 0.34, wl + 4, 18, -3], [cx + w * 0.32, wl + 2, 22, 3], [cx + w * 0.2, wl + 6, 12, 1]], rgba(P.reed, 0.9));
      }
    }
  };
  scaleKind(sMid.jetty, 1.2);
  for (const k of Object.keys(sMid)) sMid[k].tex = { grain: 0.035 };

  // ---------- Sumpf: ferne Silhouetten im Nebel hinter den Zypressen ----------
  const sFarEnd = (w, h, C, a) => { hazeOver(w, h, sPal(C).fog, a); dissolve(w, h, h * 0.62, h); };
  const sFar = {
    fmill: {
      size: r => [140 + r() * 40, 230],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.3), cx = w * 0.5, yb = h - 40, bh = 110 + r() * 20, top = yb - bh;
        ctx.beginPath();
        ctx.ellipse(cx, h, w * 0.48, 60, 0, Math.PI, TAU);
        ctx.fillStyle = shade(P.reed, -0.1);
        ctx.fill();
        poly([[cx - 20, yb + 30], [cx - 13, top], [cx + 13, top], [cx + 20, yb + 30]], hgrad(cx - 20, cx + 20, [[0, shade(P.stone, 0.08)], [1, shade(P.stone, -0.2)]]));
        poly([[cx - 16, top + 2], [cx - 2, top - 14], [cx + 15, top + 3]], shade(P.wood, -0.05));
        ctx.save();
        ctx.translate(cx - 14, top - 2);
        for (const a of [-0.8 + r() * 0.3, 1.5]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = shade(P.wood, -0.15); ctx.fillRect(0, -1.2, a > 1 ? 34 : 54, 2.4); ctx.fillRect(16, 1, a > 1 ? 16 : 36, 6); ctx.restore(); }
        ctx.restore();
        sFarEnd(w, h, C, 0.5);
      }
    },
    fhuts: {
      size: r => [200 + r() * 40, 160],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.3), n = 2 + (r() < 0.5 ? 1 : 0), wl = h - 50;
        for (let k = 0; k < n; k++) {
          const cx = w * (0.22 + 0.56 * k / Math.max(1, n - 1)), hw = 22 + r() * 10, fy = wl - 20 - r() * 10, wh = 22 + r() * 6;
          const posts = [];
          for (let j = 0; j < 4; j++) posts.push([cx - hw + j * hw * 2 / 3, fy, h, 3, 0]);
          sPosts(posts, P.wood);
          ctx.fillStyle = P.wood;
          ctx.fillRect(cx - hw - 4, fy - 3, hw * 2 + 8, 3);
          ctx.fillRect(cx - hw, fy - 3 - wh, hw * 2, wh);
          poly([[cx - hw - 8, fy - wh], [cx, fy - wh - 18], [cx + hw + 8, fy - wh]], shade(P.thatch, -0.05));
          ctx.fillStyle = rgba(P.lamp, 0.4);
          ctx.fillRect(cx - 4, fy - wh * 0.7, 6, 5);
        }
        sFarEnd(w, h, C, 0.5);
      }
    },
    fruin: {
      size: r => [130 + r() * 40, 210],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.3), cx = w * 0.5, yb = h - 30, th = 100 + r() * 40, b0 = 22, b1 = 17, top = yb - th;
        ctx.beginPath();
        ctx.ellipse(cx, h, w * 0.48, 50, 0, Math.PI, TAU);
        ctx.fillStyle = shade(P.reed, -0.1);
        ctx.fill();
        // abgebrochener Turm mit gezackter Krone, Fensterschlitze, ein Mauerrest daneben
        const pts = [[cx - b0, h], [cx - b1, top + 10]];
        for (let k = 1; k < 6; k++) pts.push([cx - b1 + k * b1 * 2 / 6, top + (k % 2 ? 0 : 8) + r() * 10]);
        pts.push([cx + b1, top + 18], [cx + b0, h]);
        poly(pts, P.stone);
        ctx.fillStyle = rgba(INK, 0.18);
        ctx.fillRect(cx + b1 * 0.3, top + 16, b1 * 0.7, h - top - 16);
        ctx.fillStyle = rgba(P.dark, 0.7);
        ctx.fillRect(cx - 2.5, top + 30, 5, 10);
        ctx.fillRect(cx - 2.5, top + 64, 5, 10);
        poly([[cx + b0 + 4, h], [cx + b0 + 6, yb - 30 - r() * 14], [cx + b0 + 22, yb - 18], [cx + b0 + 30, h]], shade(P.stone, -0.06));
        sFarEnd(w, h, C, 0.5);
      }
    },
    fdead: {
      size: r => [180 + r() * 50, 220],
      paint: (w, h, r, C) => {
        const P = sPal(C, 0.3), n = 2 + (r() < 0.6 ? 1 : 0);
        for (let k = 0; k < n; k++) sDeadTree(w * (0.2 + 0.6 * k / Math.max(1, n - 1)) + (r() - 0.5) * 16, h - 30, 130 + r() * 60, 7 + r() * 3, shade(P.dead, k * 0.04), r, null);
        sFarEnd(w, h, C, 0.5);
      }
    }
  };
  for (const k of Object.keys(sFar)) sFar[k].tex = null;

  SCENE['Sumpf'] = {
    tracks: [
      { z: 0, factor: 0.1, start: 60, gap: [40, 170], maxKs: 1.5, base: () => S_FAR,
        pick: flow(['fdead', 'fmill', 'fhuts', 'fruin'], [['fmill', 1.3], ['fhuts', 2], ['fdead', 1.8], ['fruin', 1.4]], 1),
        kinds: sFar },
      { z: 1, factor: 0.33, start: 30, gap: [40, 140], maxKs: 2, base: () => S_MID,
        pick: flow(['deadtree', 'jetty', 'hut', 'lanterns', 'mill'],
          [['deadtree', 1.4], ['jetty', 1.3], ['hut', 1.6], ['lanterns', 1.1], ['mill', 1.1]], 2),
        kinds: sMid }
    ]
  };

  // Malen isolieren: Im eigenen Sprite (Leinwand so groß wie das Motiv, ohne Versatz) wird direkt gemalt.
  // Die Menü-Miniatur malt dagegen direkt ins fertige Bild; dort läuft das Motiv über eine
  // Zwischenleinwand, damit Dunstschicht (source-atop) und Ausblenden (destination-out) nur das Motiv treffen.
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
  for (const name of ['Wiese', 'Ozean', 'Dschungel', 'Wüste', 'Sumpf']) for (const T of SCENE[name].tracks) for (const K of Object.values(T.kinds)) isolate(K);
})();

