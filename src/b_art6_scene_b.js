// ============================================================
// Kulissen B: Weltraum, Kristall, Eis, Lava, Wolken.
// Einzelmotive pro Biom (Planeten, Kristallgruppen, Eisberge, Vulkane,
// schwebende Inseln ...) mit eigenem Ablauf, registriert in SCENE
// (API siehe b_scene.js). Alles steckt in einer Funktion, damit keine
// Namen mit anderen Dateien kollidieren.
// ============================================================
(() => {
  const PI = Math.PI, LD = LIGHT_DIR;
  const R = (q, a, b) => a + q() * (b - a);
  const sgn = q => (q() < 0.5 ? -1 : 1);

  // ---------- Ablauf und Motivarten ----------
  // Feste Einleitung, danach gemischte Beutel aus dem Vorrat, nie zweimal dieselbe Art hintereinander,
  // kein Paar, das in den letzten 14 Motiven schon vorkam (keine sichtbar gleichen Folgen);
  // seltene Arten (rare: Art -> Mindestabstand in Motiven) kommen nicht kurz nacheinander.
  // sep (optional) steht zwischen je zwei Beutelmotiven (Pausen für sparsame Spuren).
  // Reine Funktion von i: die Liste wird nur verlängert, Spiel und Miniaturen sehen dieselbe Folge.
  function flow(intro, pool, seed, sep, rare) {
    const list = intro.filter(k => k !== sep), out = intro.slice(), q = mulberry32(seed), gapOf = rare || {};
    const ok = k => {
      const n = list.length, at = list.lastIndexOf(k), prev = list[n - 1];
      if (at >= 0 && n - at <= (gapOf[k] || 1)) return false;
      for (let j = Math.max(1, n - 14); j < n; j++) if (list[j - 1] === prev && list[j] === k) return false;
      return true;
    };
    return i => {
      while (out.length <= i) {
        const rest = pool.slice();
        while (rest.length) {
          let j = Math.floor(q() * rest.length);
          for (let t = 0; t < 16 && !ok(rest[j]); t++) j = Math.floor(q() * rest.length);
          if (rest[j] === list[list.length - 1]) j = rest.findIndex(k => k !== list[list.length - 1]);
          if (j < 0) j = 0;
          const k = rest.splice(j, 1)[0];
          list.push(k);
          if (sep && out[out.length - 1] !== sep) out.push(sep);
          out.push(k);
        }
      }
      return out[i];
    };
  }
  // Motivart, deren Maße und Grundform aus dem Größen-Zufall (Motiv-Seed) kommen:
  // size und paint ziehen dieselben Werte, paint bekommt sie als p
  function kind(params, paint, tex) {
    return {
      size: q => { const p = params(q); return [p.w, p.h]; },
      paint: (w, h, rng, C, L, it) => paint(w, h, rng, C, params(mulberry32(it ? it.seed : 7)), it || { i: 0, yb: GROUND_Y }),
      tex
    };
  }
  // Leeres Motiv: schafft Luft in sparsamen Spuren
  const pause = (a, b) => ({ size: q => [R(q, a, b), 4], paint: () => {} });
  // Unterkante aus einer Mittenhöhe je Art
  const midBase = tab => (i, q, k, h) => { const m = tab[k] || [200, 300]; return Math.round(R(q, m[0], m[1]) + h / 2); };

  // ---------- Pfade ----------
  function path(pts, close) {
    ctx.beginPath();
    pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    if (close) ctx.closePath();
  }
  // Glatter, geschlossener Umriss durch die Kantenmitten, als Teilpfad (mehrere Formen in einem Pfad)
  function subSmooth(pts) {
    const n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = m(pts[n - 1], pts[0]);
    ctx.moveTo(s[0], s[1]);
    for (let k = 0; k < n; k++) { const e = m(pts[k], pts[(k + 1) % n]); ctx.quadraticCurveTo(pts[k][0], pts[k][1], e[0], e[1]); }
    ctx.closePath();
  }
  function smooth(pts) { ctx.beginPath(); subSmooth(pts); }
  function subPoly(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }

  // ---------- vorberechnete Verlaufsbilder ----------
  // node-canvas rechnet Radialverläufe und geglättetes Skalieren sehr langsam. Weiche Formen (Schein,
  // Randdunst, Terminator, Nebelflecken) werden daher einmal pro Farbe als Bild gemalt und danach
  // ungeglättet skaliert kopiert; bei sanften Verläufen ist das nicht zu sehen.
  const GC = new Map();
  function gsprite(key, S, E, paint) {
    let c = GC.get(key);
    if (!c) {
      if (GC.size >= 64) { for (const v of GC.values()) freeCanvas(v); GC.clear(); }
      c = newCanvas(S, S);
      const g = c.getContext('2d');
      g.setTransform(S / (2 * E), 0, 0, S / (2 * E), S / 2, S / 2);
      setupG(g);
      withCtx(g, paint);
      GC.set(key, c);
    }
    return c;
  }
  function stamp(c, x, y, w, h, a) {
    const sm = ctx.imageSmoothingEnabled, ga = ctx.globalAlpha;
    ctx.imageSmoothingEnabled = false;
    if (a !== undefined) ctx.globalAlpha = ga * a;
    ctx.drawImage(c, x, y, w, h);
    ctx.globalAlpha = ga;
    ctx.imageSmoothingEnabled = sm;
  }
  // Weicher Fleck (Verlauf wie a2Soft) aus einem vorberechneten Bild
  function soft(x, y, rx, ry, col, a, rot) {
    if (a <= 0.003 || rx < 0.5 || ry < 0.5) return;
    const c = gsprite('s' + col, 128, 1, () => {
      ctx.fillStyle = rgrad(0, 0, 0, 1, [[0, rgba(col, 1)], [0.5, rgba(col, 0.5)], [1, rgba(col, 0)]]);
      ctx.fillRect(-1, -1, 2, 2);
    });
    if (rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      stamp(c, -rx, -ry, rx * 2, ry * 2, a);
      ctx.restore();
    } else stamp(c, x - rx, y - ry, rx * 2, ry * 2, a);
  }
  // Lichtpunkt mit schnell abfallendem Schein (Sterne, Glut)
  function glow(x, y, rr, col, a) {
    const c = gsprite('g' + col, 96, 1, () => {
      ctx.fillStyle = rgrad(0, 0, 0, 1, [[0, rgba(col, 1)], [0.25, rgba(col, 0.35)], [1, rgba(col, 0)]]);
      ctx.fillRect(-1, -1, 2, 2);
    });
    stamp(c, x - rr, y - rr, rr * 2, rr * 2, a);
  }

  // ============================================================
  // Kugeln mit Licht von oben links
  // ============================================================
  // Punkt (Breite, Länge) auf der Kugel relativ zur Mitte; der Betrachter steht um beta über dem Äquator
  function proj(r, beta, lat, lon) {
    const cl = Math.cos(lat), x = r * cl * Math.sin(lon), y = r * Math.sin(lat), z = r * cl * Math.cos(lon);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    return [x, -(y * cb - z * sb), y * sb + z * cb];
  }
  // wie proj, Punkte der Rückseite an den Rand gedrückt: Umrisse enden sauber am Planetenrand
  function projL(r, beta, lat, lon) {
    const p = proj(r, beta, lat, lon);
    if (p[2] < 0) { const m = Math.hypot(p[0], p[1]) || 1; p[0] *= r * 1.06 / m; p[1] *= r * 1.06 / m; }
    return p;
  }
  // Fleck auf der Oberfläche als verkürzte Ellipse (Eintrag für ellipses), null auf der Rückseite
  function spot(r, beta, lat, lon, rad) {
    const p = proj(r, beta, lat, lon);
    if (p[2] < r * 0.04) return null;
    return [p[0], p[1], rad * Math.max(0.1, p[2] / r), rad, Math.atan2(p[1], p[0])];
  }
  // Fläche mit welligem Rand um (lat0, lon0) mit Winkelradius rad
  function blobOn(r, beta, lat0, lon0, rad, q, n, rough) {
    const pts = [], cl = Math.max(0.3, Math.cos(lat0)), p1 = q() * TAU, p2 = q() * TAU;
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, d = rad * (1 + rough * (0.5 * Math.sin(a * 2 + p1) + 0.3 * Math.sin(a * 3 + p2) + (q() - 0.5) * 0.5));
      pts.push(projL(r, beta, lat0 + Math.sin(a) * d, lon0 + Math.cos(a) * d / cl));
    }
    return pts;
  }
  // Polkappe: gewellter Breitenkreis
  function capOn(r, beta, lat, q, n) {
    const pts = [], ph = q() * TAU;
    for (let k = 0; k < n; k++) { const lo = k / n * TAU; pts.push(projL(r, beta, lat + 0.06 * Math.sin(lo * 3 + ph) + (q() - 0.5) * 0.08, lo)); }
    return pts;
  }
  // Wolkendecke: breite, gerundete Züge in zwei Lagen (Dunst und hellerer Kern)
  function cloudsOn(r, beta, q, n, cloud, a, hw0, hw1) {
    const list = [];
    for (let k = 0; k < n; k++) list.push([R(q, -1.15, 1.15), R(q, -2.1, 0.9), R(q, 0.5, 1.2), R(q, hw0, hw1), R(q, 0.005, 0.025), q() * TAU]);
    for (const [k, al] of [[1, a * 0.55], [0.5, a * 0.7]]) {
      ctx.beginPath();
      for (const [la, lo, len, hw, wav, ph] of list) subPoly(streakOn(r, beta, la, lo, len, hw * k, wav, ph));
      ctx.fillStyle = rgba(k < 1 ? mix(cloud, '#ffffff', 0.3) : cloud, al);
      ctx.fill();
    }
  }
  // Zug (Wolke, Staub): spitz zulaufendes Band entlang einer Breite
  function streakOn(r, beta, lat, lon0, len, hw, wav, ph) {
    const up = [], dn = [], N = 12;
    for (let k = 0; k <= N; k++) {
      const t = k / N, lo = lon0 + len * t, tp = Math.pow(Math.sin(PI * t), 0.45) * hw * (0.75 + 0.25 * Math.sin(t * 9 + ph)), la = lat + Math.sin(t * PI * 2 + ph) * wav;
      up.push(projL(r, beta, la + tp, lo));
      dn.push(projL(r, beta, la - tp, lo));
    }
    return up.concat(dn.reverse());
  }
  // Breitenband zwischen p0 < p1 (rad) als Teilpfad, Ränder leicht gewellt
  function subBand(r, beta, p0, p1, wob, ph) {
    const pts = [], N = 14;
    const edge = (p, rev) => {
      const yc = -r * Math.sin(p) * Math.cos(beta), rx = Math.max(1, r * Math.cos(p)), ry = r * Math.cos(p) * Math.sin(beta);
      for (let k = 0; k <= N; k++) {
        const t = rev ? 1 - k / N : k / N, x = (t * 2 - 1) * r * 1.1, u = clamp(x / rx, -1, 1);
        pts.push([x, yc + ry * Math.sqrt(1 - u * u) + wob * Math.sin(x * 6 / r + ph + p * 4)]);
      }
    };
    edge(p1, false);
    edge(p0, true);
    subPoly(pts);
  }
  // Linien über die Kugel (Risse, Schluchten) in einem Pfad, Rückseite ausgelassen
  function sphereLines(r, beta, lines, col, lw) {
    ctx.beginPath();
    for (const pts of lines) {
      let on = false;
      for (const [la, lo] of pts) {
        const p = proj(r, beta, la, lo);
        if (p[2] < r * 0.05) { on = false; continue; }
        if (on) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        on = true;
      }
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // Krater (Liste von Ellipsen): Licht außen oben links, Schatten an der oberen Innenwand, heller Boden
  function craters(list, base) {
    const lit = [], bowl = [], floor = [];
    for (const [x, y, rx, ry, rot] of list) {
      const m = Math.min(rx, ry), dx = -LD.x * m, dy = -LD.y * m;
      lit.push([x - dx * 0.15, y - dy * 0.15, rx, ry, rot]);
      bowl.push([x, y, rx, ry, rot]);
      floor.push([x + dx * 0.17, y + dy * 0.17, rx * 0.74, ry * 0.74, rot]);
    }
    ellipses(lit, rgba(shade(base, 0.24), 0.7));
    ellipses(bowl, shade(base, -0.32));
    ellipses(floor, shade(base, -0.07));
  }

  // Schein um die Kugel, auf der Lichtseite weiter
  function haloSprite(atm, haloA, hf) {
    const E = 1 + hf * 1.32;
    return {
      E, c: gsprite(['h', atm, haloA, hf].join(), 192, E, () => {
        ctx.fillStyle = rgrad(LD.x * hf * 0.6, LD.y * hf * 0.6, 0.96, 1 + hf * 0.7, [[0, rgba(atm, haloA)], [0.35, rgba(atm, haloA * 0.4)], [1, rgba(atm, 0)]], 0, 0);
        ctx.fillRect(-E, -E, E * 2, E * 2);
      })
    };
  }
  // Randdunst, Glanz und weicher Terminator unten rechts in einem Bild (Einheitskreis)
  function overlaySprite(nt, hiA, atm, limbA) {
    return gsprite(['o', nt, hiA, atm, limbA].join(), 192, 1, () => {
      if (atm && limbA) {
        ctx.fillStyle = rgrad(0, 0, 0.58, 1, [[0, rgba(atm, 0)], [0.6, rgba(atm, limbA * 0.3)], [1, rgba(atm, limbA)]]);
        ctx.fillRect(-1, -1, 2, 2);
      }
      ctx.fillStyle = rgrad(LD.x * 0.62, LD.y * 0.62, 0, 1.62, [[0, rgba(CREAM, hiA)], [0.28, rgba(CREAM, 0)], [0.43, rgba(nt, 0)],
        [0.58, rgba(nt, 0.45)], [0.74, rgba(nt, 0.84)], [1, rgba(nt, 0.96)]]);
      ctx.fillRect(-1, -1, 2, 2);
    });
  }
  // Kugel: Schein, Grundfarbe, Oberfläche (im Umriss), Licht und Schatten, Lichtsaum oben links,
  // schwaches Streulicht am Nachtrand
  function sphere(cx, cy, r, o) {
    if (o.halo) { const hs = haloSprite(o.atm, o.haloA, o.halo); stamp(hs.c, cx - r * hs.E, cy - r * hs.E, r * hs.E * 2, r * hs.E * 2); }
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = o.base;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (o.surface) o.surface();
    stamp(overlaySprite(o.night, o.hiA === undefined ? 0.16 : o.hiA, o.atm || '', o.limbA || 0), cx - r, cy - r, r * 2, r * 2);
    if (o.nightSide) o.nightSide(cx + LD.x * r * 0.62, cy + LD.y * r * 0.62);
    ctx.restore();
    const rimC = o.rim || CREAM, lw = Math.max(0.8, r * 0.02), ra = o.rimA === undefined ? 0.3 : o.rimA;
    ctx.lineWidth = lw;
    ctx.strokeStyle = rgba(rimC, ra * 0.45);
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw * 0.5, PI * 0.93, PI * 1.66);
    ctx.stroke();
    ctx.strokeStyle = rgba(rimC, ra);
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw * 0.5, PI * 1.08, PI * 1.5);
    ctx.stroke();
    if (o.back) {
      ctx.strokeStyle = rgba(o.atm || rimC, o.back);
      ctx.beginPath();
      ctx.arc(cx, cy, r - lw * 0.5, PI * 0.04, PI * 0.54);
      ctx.stroke();
    }
  }

  // ---------- Brocken (Asteroiden, Felsen im All) ----------
  function rockPts(x, y, rr, q) {
    const n = 8 + Math.floor(q() * 4), el = R(q, 0.62, 0.95), rot = q() * TAU, pts = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, d = rr * (0.76 + q() * 0.32), px = Math.cos(a) * d, py = Math.sin(a) * d * el;
      pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
    }
    return pts;
  }
  // Viele kleine Brocken gebündelt: dunkle Körper, beleuchteter Teil oben links (im Umriss), Glanzpunkte
  function smallRocks(list, base, q) {
    if (!list.length) return;
    const shapes = list.map(([x, y, rr]) => [x, y, rr, rockPts(x, y, rr, q)]);
    ctx.beginPath();
    for (const s of shapes) subSmooth(s[3]);
    ctx.fillStyle = shade(base, -0.32);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    for (const [x, y, rr, pts] of shapes) subSmooth(pts.map(([a, b]) => [x + (a - x) * 0.82 + LD.x * rr * 0.22, y + (b - y) * 0.82 + LD.y * rr * 0.22]));
    ctx.fillStyle = mix(base, CREAM, 0.08);
    ctx.fill();
    ctx.restore();
    dots(shapes.filter(s => s[2] > 2.2).map(([x, y, rr]) => [x + LD.x * rr * 0.4, y + LD.y * rr * 0.4, rr * 0.16]), rgba(CREAM, 0.35));
  }
  // Großer Brocken einzeln: Grundfarbe, Kugelschatten aus dem Vorrat, Krater, Lichtkante
  function bigRock(x, y, rr, q, base, night) {
    const pts = rockPts(x, y, rr, q);
    smooth(pts);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const cr = [];
    for (let k = 0, m = 1 + Math.floor(q() * 3); k < m; k++) { const a = q() * TAU, d = q() * rr * 0.5, c = rr * R(q, 0.1, 0.22); cr.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, c, c * 0.8, a]); }
    craters(cr, base);
    stamp(overlaySprite(night, 0.16, '', 0), x - rr * 1.12, y - rr * 1.12, rr * 2.24, rr * 2.24);
    ctx.translate(-LD.x * 1.1, -LD.y * 1.1);
    smooth(pts);
    ctx.strokeStyle = rgba(CREAM, 0.38);
    ctx.lineWidth = Math.max(0.8, rr * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================
  // WELTRAUM: ferne Planetenspur, mittlere Spur mit Monden und Asteroiden
  // ============================================================
  const spaceNight = C => mix(C.skyTop, INK, 0.3);

  // Heimatplanet: Ozean, Kontinente mit Schelf und Küste, Polkappen, Wolkenzüge, Stadtlichter
  function paintHome(w, h, q, C, p) {
    const cx = w / 2, cy = h / 2, r = p.r, beta = 0.3, tilt = R(q, -0.3, 0.05);
    const ocean = mix(mix('#2b5d9c', C.far, 0.3), C.skyBottom, 0.06), deep = shade(ocean, -0.24);
    const shallow = mix(ocean, '#5ab4c2', 0.45), sand = mix(mix('#c9aa70', C.far, 0.2), C.accent, 0.08);
    const green = mix(mix('#4d8a5a', C.far, 0.24), ocean, 0.04), forest = shade(green, -0.2), dry = mix(sand, green, 0.35);
    const ice = mix(CREAM, C.pipe, 0.14), cloud = mix(CREAM, C.pipe, 0.08), atm = mix('#7cb0ff', C.pipe, 0.3);
    const ct = Math.cos(tilt), st = Math.sin(tilt), cities = [];
    sphere(cx, cy, r, {
      base: ocean, night: spaceNight(C), atm, halo: 0.17, haloA: 0.32, limbA: 0.55, rim: mix(atm, CREAM, 0.5), rimA: 0.55, back: 0.16,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        ctx.beginPath();
        for (let k = 0; k < 2; k++) subSmooth(blobOn(r, beta, R(q, -0.8, 0.8), R(q, -1.4, 1.4), R(q, 0.25, 0.4), q, 12, 0.45));
        ctx.fillStyle = rgba(deep, 0.4);
        ctx.fill();
        const outl = [], inner = [], dryL = [];
        for (let k = 0; k < 3; k++) {
          const la = R(q, -0.7, 0.65), lo = -1.2 + k * 1.05 + R(q, -0.2, 0.2), rad = R(q, 0.3, 0.48);
          outl.push([la, lo, rad, (q() * 1e9) | 0, 18]);
          outl.push([la + R(q, -0.4, 0.4), lo + R(q, 0.25, 0.5) * sgn(q), rad * R(q, 0.3, 0.5), (q() * 1e9) | 0, 12]);
          inner.push(blobOn(r, beta, la + R(q, -0.1, 0.1), lo + R(q, -0.12, 0.12), rad * 0.5, q, 16, 0.6));
          dryL.push(blobOn(r, beta, la - rad * 0.35, lo + rad * 0.3, rad * 0.32, q, 14, 0.6));
          for (let j = 0; j < 14; j++) {
            const s = proj(r, beta, la + (q() - 0.5) * rad * 1.3, lo + (q() - 0.5) * rad * 1.5);
            if (s[2] > r * 0.15) cities.push([cx + s[0] * ct - s[1] * st, cy + s[0] * st + s[1] * ct, R(q, 0.45, 0.95)]);
          }
        }
        // Schelf, Strand und Land als drei Flächen derselben Umrisse (gleicher Zufall, andere Größe)
        for (const [k, col] of [[1.2, rgba(shallow, 0.5)], [1, sand], [0.9, green]]) {
          ctx.beginPath();
          for (const [la, lo, rad, seed, n] of outl) subSmooth(blobOn(r, beta, la, lo, rad * k, mulberry32(seed), n, 0.6));
          ctx.fillStyle = col;
          ctx.fill();
        }
        ctx.beginPath();
        inner.forEach(subSmooth);
        ctx.fillStyle = rgba(forest, 0.6);
        ctx.fill();
        ctx.beginPath();
        dryL.forEach(subSmooth);
        ctx.fillStyle = rgba(dry, 0.75);
        ctx.fill();
        ctx.beginPath();
        subSmooth(capOn(r, beta, 1.2, q, 24));
        subSmooth(capOn(r, beta, -1.25, q, 24));
        ctx.fillStyle = rgba(ice, 0.92);
        ctx.fill();
        cloudsOn(r, beta, q, 10, cloud, 0.75, 0.035, 0.075);
        ctx.restore();
      },
      nightSide: (lx, ly) => {
        const lim = r * 1.62 * 0.66;
        dots(cities.filter(([x, y]) => Math.hypot(x - lx, y - ly) > lim), rgba(mix(C.accent, CREAM, 0.3), 0.7));
      }
    });
  }

  // Ozeanwelt: tiefes Blau, Schelfmeere, winzige Inseln, viele Wolken und ein großer Wirbelsturm
  function paintOcean(w, h, q, C, p) {
    const cx = w / 2, cy = h / 2, r = p.r, beta = R(q, 0.15, 0.35), tilt = R(q, -0.4, 0.3);
    const ocean = mix(mix('#2a6a96', C.far, 0.36), C.skyBottom, 0.1), shallow = mix(ocean, '#5fbac2', 0.42);
    const isle = mix(mix('#b9a46e', C.far, 0.3), ocean, 0.1), cloud = mix(CREAM, C.pipe, 0.14), atm = mix('#78c0e8', C.pipe, 0.3);
    sphere(cx, cy, r, {
      base: ocean, night: spaceNight(C), atm, halo: 0.16, haloA: 0.26, limbA: 0.5, rim: mix(atm, CREAM, 0.45), rimA: 0.5, back: 0.14,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) subSmooth(blobOn(r, beta, R(q, -1, 1), R(q, -1.4, 1.2), R(q, 0.15, 0.3), q, 16, 0.6));
        ctx.fillStyle = rgba(shallow, 0.32);
        ctx.fill();
        const il = [];
        for (let k = 0; k < 12; k++) { const e = spot(r, beta, R(q, -1, 1), R(q, -1.5, 1.5), r * R(q, 0.012, 0.03)); if (e) il.push(e); }
        ellipses(il, isle);
        cloudsOn(r, beta, q, 9, cloud, 0.7, 0.06, 0.12);
        ctx.restore();
      }
    });
  }

  // Gasriese: Bänder mit Wirbeln, Sturmauge, oft ein kleiner Mond oben links mit Schatten auf dem Riesen
  function paintGas(w, h, q, C, p) {
    const cx = w / 2, cy = h / 2, r = p.r, beta = R(q, 0.12, 0.3), tilt = R(q, -0.3, 0.3), warm = q() < 0.6;
    const zone = mix(mix(CREAM, warm ? C.accent : C.pipe, 0.35), C.far, 0.3);
    const belt = warm ? mix(mix(C.accent, '#9c4f36', 0.5), C.far, 0.38) : mix(mix(C.pipe, '#4f5fa0', 0.4), C.far, 0.3);
    const deepB = mix(belt, INK, 0.22), base = mix(zone, belt, 0.4);
    const tones = [[zone, 0.8], [mix(zone, CREAM, 0.18), 0.7], [belt, 0.8], [mix(C.far, C.pipe, 0.3), 0.6], [deepB, 0.7]];
    const mr = p.mr, md = r + mr + R(q, 12, 22), ma = PI * 1.25 + R(q, -0.18, 0.18), mx = cx + Math.cos(ma) * md, my = cy + Math.sin(ma) * md;
    sphere(cx, cy, r, {
      base, night: spaceNight(C), atm: mix(zone, CREAM, 0.2), halo: 0.12, haloA: 0.16, limbA: 0.28, rim: mix(zone, CREAM, 0.5), rimA: 0.45, back: 0.1,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        const groups = tones.map(() => []);
        let lat = -1.52, k = 0;
        while (lat < 1.52) {
          const dl = Math.abs(lat) < 0.2 ? R(q, 0.2, 0.3) : R(q, 0.08, 0.22);
          groups[k % 2 ? 2 + Math.floor(q() * 3) : Math.floor(q() * 2)].push([lat, lat + dl, r * R(q, 0.004, 0.018), q() * TAU]);
          lat += dl;
          k++;
        }
        groups.forEach((list, j) => {
          if (!list.length) return;
          ctx.beginPath();
          for (const b of list) subBand(r, beta, b[0], b[1], b[2], b[3]);
          ctx.fillStyle = rgba(tones[j][0], tones[j][1]);
          ctx.fill();
        });
        const sw = [[], []];
        for (let j = 0; j < 20; j++) {
          const s = proj(r, beta, R(q, -1.2, 1.2), R(q, -1.5, 1.5));
          if (s[2] < r * 0.2) continue;
          const f = 0.35 + 0.65 * s[2] / r, rad = r * R(q, 0.012, 0.03);
          sw[j % 2].push([s[0], s[1], rad * 2.6 * f, rad * 0.7, 0]);
        }
        ellipses(sw[0], rgba(mix(zone, CREAM, 0.3), 0.32));
        ellipses(sw[1], rgba(deepB, 0.3));
        const s = proj(r, beta, R(q, 0.25, 0.45) * sgn(q), R(q, -0.7, 0.3));
        if (s[2] > r * 0.3) {
          const f = 0.35 + 0.65 * s[2] / r, rs = r * R(q, 0.07, 0.11);
          ellipse(s[0], s[1], rs * 1.7 * f, rs, 0, rgba(mix(belt, CREAM, 0.1), 0.75));
          ellipse(s[0], s[1], rs * 1.25 * f, rs * 0.72, 0, rgba(mix(zone, C.accent, 0.25), 0.8));
          ellipse(s[0] - rs * 0.1, s[1] - rs * 0.05, rs * 0.65 * f, rs * 0.38, 0, rgba(mix(C.accent, CREAM, 0.35), 0.5));
        }
        ctx.restore();
        if (p.moon) ellipse(mx - LD.x * r * 0.5, my - LD.y * r * 0.5, mr * 0.95, mr * 0.8, 0.6, rgba(INK, 0.4));
      }
    });
    if (p.moon) sphere(mx, my, mr, { base: mix(mix(C.pipe, C.far, 0.4), CREAM, 0.08), night: spaceNight(C), rim: CREAM, rimA: 0.3 });
  }

  // Ringplanet: Ringe hinten (mit Planetenschatten), Kugel mit Bändern und Ringschatten, Ringe vorn
  function ringHalf(cx, cy, p, stops, front) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.tilt);
    ctx.scale(1, p.k);
    const a0 = front ? 0 : PI, a1 = front ? PI : TAU;
    ctx.beginPath();
    ctx.arc(0, 0, p.ro, a0, a1);
    ctx.arc(0, 0, p.ri, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = rgrad(0, 0, p.ri, p.ro, stops);
    ctx.fill();
    if (!front) {
      // Schatten des Planeten auf dem hinteren Ring
      ctx.beginPath();
      ctx.arc(0, 0, p.ro, PI * 1.5, PI * 1.5 + 0.75);
      ctx.arc(0, 0, p.ri, PI * 1.5 + 0.75, PI * 1.5, true);
      ctx.closePath();
      ctx.fillStyle = rgba(INK, 0.5);
      ctx.fill();
    }
    ctx.restore();
  }
  function paintRing(w, h, q, C, p) {
    const cx = w / 2, cy = h / 2, r = p.r, beta = Math.asin(p.k);
    const body = mix(mix(C.pipe, C.accent, R(q, 0.12, 0.4)), C.far, 0.3), light = mix(body, CREAM, 0.25), dark = mix(body, C.far, 0.45);
    const rc = mix(mix(C.pipe, CREAM, 0.32), C.far, 0.12), rw = mix(rc, C.accent, 0.3), gap = R(q, 0.55, 0.7);
    const stops = [[0, rgba(rc, 0.1)], [0.12, rgba(rc, 0.3)], [0.3, rgba(rw, 0.55)], [gap - 0.06, rgba(rc, 0.75)], [gap - 0.02, rgba(rc, 0.08)],
      [gap + 0.03, rgba(rc, 0.08)], [gap + 0.07, rgba(mix(rc, CREAM, 0.2), 0.62)], [0.88, rgba(rw, 0.45)], [0.96, rgba(rc, 0.3)], [1, rgba(rc, 0)]];
    ringHalf(cx, cy, p, stops, false);
    sphere(cx, cy, r, {
      base: body, night: spaceNight(C), atm: mix(mix(C.pipe, C.accent, 0.25), CREAM, 0.3), halo: 0.1, haloA: 0.14, limbA: 0.24, rim: mix(body, CREAM, 0.5), rimA: 0.45, back: 0.1,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.tilt);
        const g = [[], []];
        let lat = -1.5, k = 0;
        while (lat < 1.5) { const dl = R(q, 0.1, 0.3); g[k % 2].push([lat, lat + dl, r * 0.006, q() * TAU]); lat += dl; k++; }
        g.forEach((list, j) => {
          ctx.beginPath();
          for (const b of list) subBand(r, beta, b[0], b[1], b[2], b[3]);
          ctx.fillStyle = rgba(j ? dark : light, 0.42);
          ctx.fill();
        });
        // Schatten des Rings auf der Kugel (nach unten rechts versetzt)
        ctx.rotate(-p.tilt);
        ctx.translate(-LD.x * r * 0.16, -LD.y * r * 0.16);
        ctx.rotate(p.tilt);
        ctx.scale(1, p.k);
        ctx.beginPath();
        ctx.arc(0, 0, p.ro * 0.97, 0, PI);
        ctx.arc(0, 0, p.ri * 1.03, PI, 0, true);
        ctx.closePath();
        ctx.fillStyle = rgba(INK, 0.42);
        ctx.fill();
        ctx.restore();
      }
    });
    ringHalf(cx, cy, p, stops, true);
  }

  // Gesteinsmond: Mare, Krater, beim großen Mond ein junger Strahlenkrater
  function paintMoonBody(cx, cy, r, q, C, tone, haze) {
    const base = mix(mix(mix(C.pipe, C.far, 0.42), tone, 0.3), C.skyBottom, haze), dark = shade(base, -0.24), beta = 0.1;
    sphere(cx, cy, r, {
      base, night: spaceNight(C), rim: CREAM, rimA: 0.32,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) subSmooth(blobOn(r, beta, R(q, -0.8, 0.8), R(q, -1.2, 0.9), R(q, 0.2, 0.42), q, 14, 0.6));
        ctx.fillStyle = rgba(dark, 0.32);
        ctx.fill();
        const list = [];
        for (let k = 0, n = Math.min(16, 5 + Math.round(r * 0.3)); k < n; k++) {
          const e = spot(r, beta, R(q, -1.35, 1.35), R(q, -1.45, 1.45), r * (Math.pow(q(), 2.2) * 0.2 + 0.03));
          if (e) list.push(e);
        }
        craters(list, base);
        if (r > 26) {
          const e = spot(r, beta, R(q, -0.5, 0.5), R(q, -0.7, 0.5), r * 0.05);
          if (e) {
            const rays = [];
            for (let k = 0; k < 12; k++) { const a = q() * TAU, l = r * R(q, 0.2, 0.55); rays.push([e[0], e[1], e[0] + Math.cos(a) * l, e[1] + Math.sin(a) * l * 0.9]); }
            segs(rays, rgba(mix(base, CREAM, 0.4), 0.18), r * 0.02);
            ellipse(e[0], e[1], e[2] * 1.4, e[3] * 1.4, e[4], rgba(mix(base, CREAM, 0.45), 0.6));
          }
        }
        ctx.restore();
      }
    });
  }

  // Eisplanet: blasses Cyan, feine Bänder, lange Risse, Polkappe
  function paintIce(w, h, q, C, p) {
    const cx = w / 2, cy = h / 2, r = p.r, beta = R(q, 0.15, 0.4), tilt = R(q, -0.5, 0.5);
    const base = mix(mix(CREAM, C.pipe, 0.55), C.far, 0.24), crack = shade(base, -0.32), atm = mix(C.pipe, CREAM, 0.4);
    sphere(cx, cy, r, {
      base, night: spaceNight(C), atm, halo: 0.12, haloA: 0.18, limbA: 0.32, rim: CREAM, rimA: 0.5, back: 0.1,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        const g = [[], []];
        let lat = -1.5;
        while (lat < 1.5) { const dl = R(q, 0.12, 0.35); g[q() < 0.5 ? 0 : 1].push([lat, lat + dl]); lat += dl * 2; }
        g.forEach((list, j) => {
          ctx.beginPath();
          for (const b of list) subBand(r, beta, b[0], b[1], 0, 0);
          ctx.fillStyle = rgba(j ? shade(base, -0.12) : mix(base, CREAM, 0.25), 0.22);
          ctx.fill();
        });
        ctx.beginPath();
        for (let k = 0; k < 4; k++) subSmooth(blobOn(r, beta, R(q, -1, 1), R(q, -1.3, 1), R(q, 0.15, 0.3), q, 14, 0.6));
        ctx.fillStyle = rgba(mix(base, C.far, 0.3), 0.24);
        ctx.fill();
        const lines = [];
        for (let k = 0; k < 6; k++) {
          let la = R(q, -1.1, 1.1), lo = R(q, -1.8, 0.6), dir = R(q, -0.5, 0.5);
          const pts = [];
          for (let j = 0, n = 10 + Math.floor(q() * 14); j < n; j++) { pts.push([la, lo]); dir += (q() - 0.5) * 0.4; la += Math.sin(dir) * 0.08; lo += Math.cos(dir) * 0.09; }
          lines.push(pts);
        }
        sphereLines(r, beta, lines, rgba(crack, 0.5), Math.max(0.7, r * 0.016));
        ctx.translate(-LD.x * 0.9, -LD.y * 0.9);
        sphereLines(r, beta, lines, rgba(CREAM, 0.22), 0.7);
        ctx.translate(LD.x * 0.9, LD.y * 0.9);
        ctx.beginPath();
        subSmooth(capOn(r, beta, 1.15, q, 24));
        ctx.fillStyle = rgba(mix(base, CREAM, 0.6), 0.85);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // Roter Wüstenplanet: Rost, dunkle Ebenen, helle Staubflächen, Schlucht, Krater, kleine Polkappe
  function paintDesert(w, h, q, C, p) {
    const cx = w / 2, cy = h / 2, r = p.r, beta = R(q, 0.15, 0.35), tilt = R(q, -0.35, 0.35);
    const base = mix(mix(C.accent, '#a2442f', 0.58), C.far, 0.3), dark = shade(base, -0.3), light = mix(base, CREAM, 0.22), atm = mix(C.accent, '#e0866a', 0.45);
    sphere(cx, cy, r, {
      base, night: spaceNight(C), atm, halo: 0.1, haloA: 0.14, limbA: 0.28, rim: mix(atm, CREAM, 0.4), rimA: 0.45, back: 0.08,
      surface: () => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) subSmooth(blobOn(r, beta, R(q, -1, 1), R(q, -1.4, 1), R(q, 0.18, 0.34), q, 16, 0.6));
        ctx.fillStyle = rgba(light, 0.28);
        ctx.fill();
        ctx.beginPath();
        for (let k = 0; k < 4; k++) subSmooth(blobOn(r, beta, R(q, -0.9, 0.9), R(q, -1.4, 1), R(q, 0.14, 0.3), q, 16, 0.7));
        ctx.fillStyle = rgba(dark, 0.45);
        ctx.fill();
        let la = R(q, -0.35, 0.1), lo = R(q, -1.6, -0.8), dir = R(q, -0.2, 0.2);
        const can = [];
        for (let j = 0; j < 30; j++) { can.push([la, lo]); dir += (q() - 0.5) * 0.3; la += Math.sin(dir) * 0.05; lo += Math.cos(dir) * 0.08; }
        sphereLines(r, beta, [can], rgba(shade(base, -0.45), 0.6), Math.max(1.2, r * 0.035));
        ctx.translate(-LD.x * 1.2, -LD.y * 1.2);
        sphereLines(r, beta, [can], rgba(light, 0.35), Math.max(0.6, r * 0.012));
        ctx.translate(LD.x * 1.2, LD.y * 1.2);
        const list = [];
        for (let k = 0; k < 9; k++) { const e = spot(r, beta, R(q, -1.2, 1.2), R(q, -1.4, 1.4), r * R(q, 0.025, 0.07)); if (e) list.push(e); }
        craters(list, base);
        ctx.beginPath();
        subSmooth(capOn(r, beta, 1.3, q, 20));
        ctx.fillStyle = rgba(mix(CREAM, base, 0.12), 0.85);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // Ferne Spiralgalaxie: geneigte Scheibe, zwei bis drei Arme aus Sternstaub, warmer Kern
  function paintGalaxy(w, h, q, C, p) {
    const Rg = p.Rg, arms = q() < 0.7 ? 2 : 3, turns = R(q, 0.75, 1.05), ph = q() * TAU;
    const disk = mix(C.far, C.pipe, 0.35), warm = mix(C.accent, CREAM, 0.4), star = mix(CREAM, C.pipe, 0.3), knot = mix(C.accent, '#e0789c', 0.55);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(p.rot);
    ctx.scale(1, p.k);
    soft(0, 0, Rg, Rg, disk, 0.32);
    soft(0, 0, Rg * 0.5, Rg * 0.5, warm, 0.3);
    const dust = [], knots = [], lanes = [];
    for (let a = 0; a < arms; a++) {
      const pts = [];
      for (let j = 0; j <= 30; j++) {
        const t = j / 30, th = ph + a * TAU / arms + t * turns * TAU, d = Rg * (0.1 + 0.84 * Math.pow(t, 0.85));
        pts.push([Math.cos(th) * d, Math.sin(th) * d]);
      }
      path(pts);
      ctx.strokeStyle = rgba(disk, 0.07);
      ctx.lineWidth = Rg * 0.24;
      ctx.stroke();
      path(pts.slice(0, 22));
      ctx.strokeStyle = rgba(mix(disk, warm, 0.35), 0.1);
      ctx.lineWidth = Rg * 0.09;
      ctx.stroke();
      lanes.push(pts.slice(3, 22).map(([x, y]) => [x * 0.92, y * 0.92]));
      for (let k = 0; k < 55; k++) {
        const j = Math.floor(Math.pow(q(), 0.8) * 30), sp = Rg * 0.09 * (q() + q() - 1);
        dust.push([pts[j][0] + sp, pts[j][1] + sp * (q() - 0.5) * 2, R(q, 0.35, 0.9)]);
      }
      for (let k = 0; k < 5; k++) { const j = 6 + Math.floor(q() * 22); knots.push([pts[j][0] + (q() - 0.5) * 4, pts[j][1] + (q() - 0.5) * 4, R(q, 0.7, 1.3)]); }
    }
    ctx.beginPath();
    for (const l of lanes) l.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = rgba(INK, 0.16);
    ctx.lineWidth = Rg * 0.035;
    ctx.stroke();
    dots(dust, rgba(star, 0.5));
    dots(knots, rgba(knot, 0.55));
    glow(0, 0, Rg * 0.2, mix(warm, CREAM, 0.5), 0.9);
    ctx.restore();
  }

  // Nebelschleier: zusammenhängende Wolke entlang einer geschwungenen Achse: violetter Schleier außen,
  // farbiger Kern, heller Saum oben links, dunkle Staubbahnen, junge Sterne
  function paintNebula(w, h, q, C, p) {
    const veil = p.warm ? mix(mix(C.far, '#b0609a', 0.42), CREAM, 0.06) : mix(mix(C.far, '#4f8fc0', 0.5), CREAM, 0.06);
    const core = p.warm ? mix(mix(C.far, '#e0729a', 0.62), C.accent, 0.14) : mix(mix(C.pipe, '#5fc0c8', 0.5), C.far, 0.1);
    const core2 = p.warm ? mix(C.accent, '#d86a8e', 0.4) : mix(C.pipe, '#a08ae0', 0.45);
    const rim = mix(p.warm ? C.accent : C.pipe, CREAM, 0.45), dust = mix(C.skyTop, INK, 0.35);
    const ph = q() * TAU, amp = R(q, 0.08, 0.16);
    const at = t => [lerp(w * 0.16, w * 0.84, t), h * (0.5 + Math.sin(t * PI * 1.3 + ph) * amp)];
    const put = (t, rx, ry, col, a, rot) => {
      const [x, y] = at(t), c = Math.cos(rot || 0), s2 = Math.sin(rot || 0);
      const hw = Math.sqrt(rx * rx * c * c + ry * ry * s2 * s2), hh = Math.sqrt(rx * rx * s2 * s2 + ry * ry * c * c);
      soft(clamp(x, hw + 1, w - hw - 1), clamp(y, hh + 1, h - hh - 1), Math.min(rx, w / 2 - 1), Math.min(ry, h / 2 - 1), col, a, rot);
    };
    for (let k = 0; k < 4; k++) put((k + 0.5) / 4 + R(q, -0.05, 0.05), w * R(q, 0.24, 0.3), h * R(q, 0.36, 0.46), veil, R(q, 0.36, 0.46));
    for (let k = 0; k < 6; k++) put(R(q, 0.12, 0.88), w * R(q, 0.11, 0.18), h * R(q, 0.16, 0.28), k % 2 ? core2 : core, R(q, 0.34, 0.48), k < 2 ? R(q, -0.5, 0.5) : 0);
    for (let k = 0; k < 3; k++) {
      const t = R(q, 0.2, 0.8), [x, y] = at(t), rx = w * R(q, 0.06, 0.1);
      soft(clamp(x - rx * 0.4, rx + 1, w - rx - 1), clamp(y - h * 0.12, rx * 0.5 + 1, h - rx * 0.5 - 1), rx, rx * 0.45, rim, R(q, 0.16, 0.24));
    }
    for (let k = 0; k < 2; k++) put(R(q, 0.3, 0.7), w * R(q, 0.1, 0.16), h * R(q, 0.03, 0.05), dust, R(q, 0.35, 0.5), R(q, -0.7, 0.7));
    const st = [], ts = R(q, 0.15, 0.85);
    for (let k = 0; k < 6; k++) {
      const [x0, y0] = at(ts), x = clamp(x0 + R(q, -w * 0.1, w * 0.1), 10, w - 10), y = clamp(y0 + R(q, -h * 0.12, h * 0.12), 10, h - 10), s2 = R(q, 0.6, 1.3);
      glow(x, y, s2 * 7, CREAM, 0.45);
      st.push([x, y, s2 * 0.7]);
      if (k === 0) segs([[x - s2 * 6, y, x + s2 * 6, y], [x, y - s2 * 6, x, y + s2 * 6]], rgba(CREAM, 0.3), 0.6);
    }
    dots(st, mix(CREAM, rim, 0.2));
  }

  // Komet (ruhend): Kern oben links, Koma, gebogener Staubschweif und gerader Ionenschweif nach unten rechts
  function paintComet(w, h, q, C, p) {
    const hx = p.hx, hy = p.hy, ang = Math.atan2(h - hy - 14, w - hx - 14), L = Math.hypot(w - hx - 14, h - hy - 14);
    const dust = mix(C.accent, CREAM, 0.4), ion = mix(C.pipe, '#9fd0ff', 0.3), bend = R(q, 0.08, 0.18);
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const fan = (len, w0, w1, curve, col, a) => {
      const L1 = [], L2 = [];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12, x = hx + ca * len * t + nx * curve * len * t * t, y = hy + sa * len * t + ny * curve * len * t * t, hw = w0 + (w1 - w0) * t;
        L1.push([x + nx * hw, y + ny * hw]);
        L2.push([x - nx * hw * 0.6, y - ny * hw * 0.6]);
      }
      poly(L1.concat(L2.reverse()));
      const g = ctx.createLinearGradient(hx, hy, hx + ca * len, hy + sa * len);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.35, rgba(col, a * 0.45));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fill();
    };
    fan(L * 0.95, 4, h * 0.2, bend, dust, 0.22);
    fan(L * 0.8, 2.5, h * 0.09, bend * 0.8, dust, 0.3);
    const ia = ang - bend * 0.6, ic = Math.cos(ia), is = Math.sin(ia), il = L * 0.92;
    poly([[hx - is * 1.5, hy + ic * 1.5], [hx + ic * il - is * 5, hy + is * il + ic * 5], [hx + ic * il + is * 2, hy + is * il - ic * 2], [hx + is * 1.5, hy - ic * 1.5]]);
    const g = ctx.createLinearGradient(hx, hy, hx + ic * il, hy + is * il);
    g.addColorStop(0, rgba(ion, 0.4));
    g.addColorStop(1, rgba(ion, 0));
    ctx.fillStyle = g;
    ctx.fill();
    glow(hx, hy, 20, mix(dust, CREAM, 0.5), 0.8);
    circle(hx, hy, 1.7, CREAM);
  }

  // Ferne Doppelsterne: warmer großer und kühler kleiner Stern, Gasstrom, Scheibe, gemeinsamer Schein
  function paintBinary(w, h, q, C, p) {
    const ax = w * 0.4, ay = h * 0.55, d = R(q, 26, 40), an = R(q, -0.5, 0.3), bx = ax + Math.cos(an) * d, by = ay + Math.sin(an) * d;
    const ca = mix(C.accent, CREAM, 0.35), cb = mix(C.pipe, '#bfe0ff', 0.45), ra = R(q, 3, 4.2), rb = R(q, 1.8, 2.6);
    soft((ax + bx) / 2, (ay + by) / 2, d * 1.5, d * 1.2, mix(ca, cb, 0.5), 0.16);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(an + 0.3);
    ctx.scale(1, 0.35);
    ctx.strokeStyle = rgba(cb, 0.35);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, rb * 3.4, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(an) * ra, ay + Math.sin(an) * ra);
    ctx.quadraticCurveTo((ax + bx) / 2 + Math.sin(an) * d * 0.2, (ay + by) / 2 - Math.cos(an) * d * 0.2, bx - Math.cos(an) * rb * 3, by - Math.sin(an) * rb * 3);
    ctx.strokeStyle = rgba(mix(ca, cb, 0.3), 0.3);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const sp = [];
    for (const [x, y, rr, col] of [[ax, ay, ra, ca], [bx, by, rb, cb]]) {
      glow(x, y, rr * 8, col, 0.75);
      sp.push([x - rr * 6, y, x + rr * 6, y], [x, y - rr * 6, x, y + rr * 6]);
    }
    segs(sp, rgba(CREAM, 0.26), 0.7);
    dots([[ax, ay, ra], [bx, by, rb]], CREAM);
  }

  // Asteroidengruppe oder Gürtelstück; kleine Brocken (weiter weg) dunstiger
  function paintRocks(w, h, q, C, p, belt) {
    const night = spaceNight(C), base = mix(mix(C.pipe, C.far, 0.5), C.accent, 0.08), list = [];
    if (belt) {
      const mid = h * 0.5;
      // Staubband, an beiden Enden ausgeblendet, damit die Gürtelstücke ineinander übergehen
      for (let k = 0; k < 7; k++) {
        const x = (k + 0.5) / 7 * w, f = Math.sin(PI * x / w);
        soft(x, mid + Math.sin(x / w * PI * 2) * 4, w * 0.13, h * 0.12, mix(C.far, C.accent, 0.2), 0.22 * f * f);
      }
      const dd = [];
      for (let k = 0; k < 110; k++) { const x = R(q, 4, w - 4), f = Math.sin(PI * x / w); if (q() > f) continue; dd.push([x, mid + (q() + q() - 1) * h * 0.18, R(q, 0.3, 0.75)]); }
      dots(dd, rgba(mix(base, CREAM, 0.3), 0.45));
      for (let k = 0; k < p.n; k++) {
        const x = R(q, 12, w - 12), f = Math.sin(PI * x / w), rr = (2 + Math.pow(q(), 3) * 13) * (0.5 + 0.5 * f);
        list.push([x, mid + (q() + q() - 1) * h * 0.2, rr]);
      }
    } else {
      for (let k = 0; k < p.n; k++) {
        const rr = k === 0 ? R(q, 14, 24) : 3 + Math.pow(q(), 2) * 13;
        list.push([R(q, rr + 3, w - rr - 3), R(q, rr + 3, h - rr - 3), rr]);
      }
    }
    list.sort((a, b) => a[2] - b[2]);
    smallRocks(list.filter(r => r[2] < 6.5), mix(base, C.skyBottom, 0.25), q);
    for (const [x, y, rr] of list) if (rr >= 6.5) bigRock(x, y, rr, q, mix(base, C.skyBottom, clamp(1 - rr / 16, 0, 1) * 0.3), night);
  }

  const SPACE_FAR_Y = { home: [312, 326], ring: [150, 250], nebula: [190, 290], galaxy: [110, 190], gas: [215, 300], ice: [130, 320],
    desert: [140, 330], ocean: [140, 320], rock: [110, 300], binary: [80, 180], comet: [95, 200] };
  const SPACE_MID_Y = { moon: [110, 330], rocks: [100, 380], pause: [200, 300] };
  const sq = (r, m) => 2 * (r + m);
  const texSmall = { grain: 0.03, mottle: 0.08 };

  SCENE['Weltraum'] = {
    tracks: [
      {
        // sehr fern: Planeten, Nebel, Galaxien (vor den Sternenebenen, hinter der Station)
        z: 2, factor: 0.1, start: 150, gap: [80, 190], maxKs: 1.5,
        pick: flow(['home', 'ring', 'nebula', 'galaxy'], ['gas', 'ice', 'desert', 'ocean', 'binary', 'comet', 'rock', 'ring', 'nebula', 'galaxy'], 1501, null, { ring: 4, nebula: 3, galaxy: 3 }),
        base: midBase(SPACE_FAR_Y),
        kinds: {
          home: kind(q => { const r = R(q, 128, 140); return { r, w: sq(r, r * 0.2 + 4), h: sq(r, r * 0.2 + 4) }; }, paintHome),
          ocean: kind(q => { const r = R(q, 56, 90); return { r, w: sq(r, r * 0.2 + 4), h: sq(r, r * 0.2 + 4) }; }, paintOcean),
          gas: kind(q => { const r = R(q, 92, 122); return { r, moon: q() < 0.65, mr: R(q, 8, 13), w: sq(r, r * 0.2 + 6), h: sq(r, r * 0.2 + 6) }; }, paintGas),
          ring: kind(q => {
            const r = R(q, 48, 70), ro = r * R(q, 1.85, 2.25), ri = r * R(q, 1.22, 1.36), k = R(q, 0.2, 0.36), tilt = R(q, 0.12, 0.42) * sgn(q);
            const A = ro, B = ro * k, c = Math.cos(tilt), s = Math.sin(tilt);
            const hw = Math.sqrt(A * A * c * c + B * B * s * s), hh = Math.sqrt(A * A * s * s + B * B * c * c);
            return { r, ro, ri, k, tilt, w: 2 * Math.max(hw, r * 1.15) + 16, h: 2 * Math.max(hh, r * 1.15) + 16 };
          }, paintRing),
          ice: kind(q => { const r = R(q, 44, 78); return { r, w: sq(r, r * 0.16 + 4), h: sq(r, r * 0.16 + 4) }; }, paintIce),
          desert: kind(q => { const r = R(q, 42, 76); return { r, w: sq(r, r * 0.14 + 4), h: sq(r, r * 0.14 + 4) }; }, paintDesert),
          rock: kind(q => { const r = R(q, 30, 52); return { r, w: sq(r, 5), h: sq(r, 5) }; }, (w, h, q, C, p) => paintMoonBody(w / 2, h / 2, p.r, q, C, C.pipe, 0.12)),
          galaxy: kind(q => {
            const Rg = R(q, 100, 140), k = R(q, 0.3, 0.52), rot = R(q, -0.55, 0.55), c = Math.cos(rot), s = Math.sin(rot);
            const hw = Math.sqrt(Rg * Rg * c * c + Rg * Rg * k * k * s * s), hh = Math.sqrt(Rg * Rg * s * s + Rg * Rg * k * k * c * c);
            return { Rg, k, rot, w: 2 * hw + 12, h: 2 * hh + 12 };
          }, paintGalaxy),
          nebula: kind(q => ({ warm: q() < 0.6, w: R(q, 290, 356), h: R(q, 190, 270) }), paintNebula),
          comet: kind(q => ({ w: R(q, 230, 320), h: R(q, 100, 150), hx: R(q, 22, 34), hy: R(q, 20, 30) }), paintComet),
          binary: kind(q => ({ w: R(q, 120, 160), h: R(q, 90, 120) }), paintBinary)
        }
      },
      {
        // mittel und sparsam: Monde nahe dem Heimatplaneten, dann ein Asteroidengürtel, danach vereinzelt
        z: 2, factor: 0.3, start: 430, gap: [-50, 30], maxKs: 2,
        pick: flow(['moon', 'pause', 'moon', 'pause', 'belt', 'belt', 'belt', 'pause'], ['rocks', 'moon', 'rocks', 'moon', 'belt', 'rocks'], 1502, 'pause'),
        base: (i, q, k, h) => (k === 'belt' ? Math.round(282 + h * 0.5) : midBase(SPACE_MID_Y)(i, q, k, h)),
        kinds: {
          moon: kind(q => { const r = R(q, 11, 26); return { r, tone: Math.floor(q() * 3), w: sq(r, 5), h: sq(r, 5) }; },
            (w, h, q, C, p) => paintMoonBody(w / 2, h / 2, p.r, q, C, [C.pipe, C.accent, CREAM][p.tone], 0), texSmall),
          rocks: kind(q => ({ n: 4 + Math.floor(q() * 5), w: R(q, 110, 190), h: R(q, 80, 130) }), (w, h, q, C, p) => paintRocks(w, h, q, C, p, false)),
          belt: kind(q => ({ n: 16 + Math.floor(q() * 8), w: R(q, 300, 356), h: R(q, 110, 140) }), (w, h, q, C, p) => paintRocks(w, h, q, C, p, true)),
          pause: pause(260, 520)
        }
      }
    ]
  };
  // ============================================================
  // Werkzeuge für Motive am Boden (Kristall, Eis, Lava) und in den Wolken
  // ============================================================
  // Feines Korn wie bei den Ebenen, aber billig: Rauschkachel 1:1 in Gerätepixeln, nur auf gemalte Pixel.
  // Nur im eigenen Sprite; in Vorschaubildern teilt sich die Fläche mit dem Hintergrund, dort entfällt es.
  function grain(w, h, a) {
    const c = ctx.canvas, m = ctx.getTransform ? ctx.getTransform() : null;
    if (!m || m.b || m.c || Math.abs(m.e) > 0.5 || Math.abs(m.f) > 0.5 || c.width !== Math.ceil(w * m.a) || c.height !== Math.ceil(h * m.d)) return;
    if (!TEX.fine) TEX.fine = buildFineTile();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = a;
    for (let y = 0; y < c.height; y += 256) for (let x = 0; x < c.width; x += 256) ctx.drawImage(TEX.fine, x, y);
    ctx.restore();
  }
  // Dunst nach unten (Luftperspektive) über alles Gemalte; y0 in Bildschirmhöhe, it.yb = Unterkante
  function hazeOver(w, h, it, y0, a0, a1, col) {
    const top = it.yb - h, ly0 = y0 - top;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(ly0, h, [[0, rgba(col, a0)], [1, rgba(col, a1)]]);
    ctx.fillRect(0, Math.min(0, ly0), w, h - Math.min(0, ly0));
    ctx.restore();
  }
  // Hügel über die ganze Motivbreite, an den Rändern flach auslaufend (Nachbarmotive gehen ineinander über)
  function moundPts(w, h, top, q, peak, rough) {
    const pts = [[-2, h + 2], [-2, h - 3]], n = 14, pk = peak === undefined ? 0.5 : peak;
    for (let k = 1; k < n; k++) {
      const t = k / n, u = t < pk ? t / pk : (1 - t) / (1 - pk), f = Math.pow(Math.sin(PI / 2 * u), 0.8);
      pts.push([t * w, h - 3 - (h - top - 3) * f + (q() - 0.5) * (rough || 4)]);
    }
    pts.push([w + 2, h - 3], [w + 2, h + 2]);
    return pts;
  }
  function mound(w, h, top, q, col, peak, rough, edge) {
    const pts = moundPts(w, h, top, q, peak, rough);
    poly(pts, vgrad(top, h, [[0, shade(col, 0.08)], [1, shade(col, -0.18)]]));
    if (edge) { path(pts.slice(2, -2)); ctx.strokeStyle = edge; ctx.lineWidth = 1.1; ctx.stroke(); }
    return pts;
  }
  // Prisma mit Spitze (Form wie a2Crystal, aber nur vier Flächen): Lichtseite links, Front, Schattenseite rechts
  function prism(x, base, hh, ww, tilt, lit, mid, dark, edges) {
    const c = Math.cos(tilt), s = Math.sin(tilt), P = (a, b) => [x + a * c - b * s, base + a * s + b * c];
    const sh = Math.min(hh * 0.45, ww * 1.25), ys = -hh + sh, xl = -ww, x1 = -ww * 0.32, x2 = ww * 0.42, xr = ww, tx = ww * 0.06;
    const yl = ys + ww * 0.16, y2 = ys + ww * 0.06, yr = ys + ww * 0.26;
    poly([P(xl, 3), P(xl, yl), P(tx, -hh), P(x1, ys), P(x1, 3)], lit);
    poly([P(x1, 3), P(x1, ys), P(tx, -hh), P(x2, y2), P(x2, 3)], mid);
    poly([P(x2, 3), P(x2, y2), P(tx, -hh), P(xr, yr), P(xr, 3)], dark);
    poly([P(xl, yl), P(tx, -hh), P(x1, ys)], mix(lit, CREAM, 0.3));
    if (edges) { const a = P(x1, 0), b = P(x1, ys), t = P(tx, -hh); edges.push([a[0], a[1], b[0], b[1]], [b[0], b[1], t[0], t[1]]); }
  }
  // Doppelspitziger Splitter um (x, y)
  function bipyr(x, y, len, ww, tilt, lit, mid, dark) {
    const c = Math.cos(tilt), s = Math.sin(tilt), P = (a, b) => [x + a * c - b * s, y + a * s + b * c];
    const t = len / 2, sh = Math.min(len * 0.3, ww * 1.6), x1 = -ww * 0.3, x2 = ww * 0.42;
    poly([P(-ww, -t + sh), P(0, -t), P(x1, -t + sh * 0.9), P(x1, t - sh * 0.9), P(0, t), P(-ww, t - sh)], lit);
    poly([P(x1, -t + sh * 0.9), P(0, -t), P(x2, -t + sh * 0.95), P(x2, t - sh * 0.95), P(0, t), P(x1, t - sh * 0.9)], mid);
    poly([P(x2, -t + sh * 0.95), P(0, -t), P(ww, -t + sh * 1.05), P(ww, t - sh * 1.05), P(0, t), P(x2, t - sh * 0.95)], dark);
    poly([P(-ww, -t + sh), P(0, -t), P(x1, -t + sh * 0.9)], mix(lit, CREAM, 0.35));
    poly([P(x2, t - sh * 0.95), P(0, t), P(ww, t - sh * 1.05)], shade(dark, -0.15));
  }
  // Leuchtende Linien (Lava, Risse) gebündelt: Schein, Kern, heiße Mitte
  function glowLines(lines, C, k, a) {
    const s = k || 1, al = a === undefined ? 1 : a;
    for (const [lw, c] of [[6 * s, rgba(C.accent, 0.16 * al)], [2 * s, rgba(C.accent, 0.72 * al)], [0.8 * s, rgba(C.accentLight, 0.85 * al)]]) {
      ctx.beginPath();
      for (const pts of lines) pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  // Wolkenballen, billig: Umriss mit senkrechtem Verlauf, Schatten unten rechts und Licht oben links je Ballen
  function puff(pf, top, bot, lit, mid, low, shadow, hiA) {
    if (!pf.length) return;
    if (shadow) {
      blobPath(pf.map(([x, y, r]) => [x + SHADOW.x * 0.4, y + SHADOW.y * 0.4, r]));
      ctx.fillStyle = shadow;
      ctx.fill();
    }
    blobPath(pf);
    ctx.fillStyle = vgrad(top, bot, [[0, lit], [0.55, mid], [1, low]]);
    ctx.fill();
    dots(pf.map(([x, y, r]) => [x + r * 0.2, y + r * 0.36, r * 0.58]), rgba(low, 0.22));
    dots(pf.map(([x, y, r]) => [x - r * 0.22, y - r * 0.28, r * 0.5]), rgba(lit, hiA === undefined ? 0.36 : hiA));
  }
  // Ballenreihe für eine Wolkenbank zwischen x0 und x1 um die Höhe y
  function puffRow(x0, x1, y, r0, r1, q, lift) {
    const out = [];
    for (let x = x0; x < x1;) {
      const t = (x - x0) / Math.max(1, x1 - x0), r = (r0 + q() * (r1 - r0)) * (0.55 + 0.45 * Math.sin(PI * clamp(t, 0, 1)));
      out.push([x, y - r * 0.4 - (lift || 0) * Math.sin(PI * t) * q(), r]);
      x += r * (0.7 + q() * 0.5);
    }
    return out;
  }

  // ============================================================
  // KRISTALL: einzelne Riesenformationen statt der sich wiederholenden fernen Kristallberge
  // (Gruppen, Bögen, Geoden, Nadeln, Tafelberge, gestürzte Prismen), davor schwebende Splitter
  // ============================================================
  // Ferne Farben wie die bisherige Ebene 0 (Kristallberge im Dunst)
  function kFar(C) {
    const col = mix(C.far, C.skyBottom, 0.12);
    return {
      col, rock: shade(col, -0.1), tints: [col, mix(col, C.accent, 0.14), mix(col, C.pipe, 0.12)],
      set: t => [mix(t, C.skyBottom, 0.32), t, shade(t, -0.2)], glow: [mix(C.pipe, C.skyBottom, 0.3), mix(C.accent, C.skyBottom, 0.3)]
    };
  }
  function kPrisms(list, F, q, base) {
    list.sort((a, b) => b[1] - a[1]);
    for (const [x0, hh, ww, t0, gy] of list) {
      const x = clamp(x0, ww + 3, base.w - ww - 3), lim = Math.asin(clamp((Math.min(x, base.w - x) - ww - 3) / hh, 0.03, 0.95));
      const [lit, mid, dark] = F.set(F.tints[Math.floor(q() * 3)]);
      prism(x, gy === undefined ? base.gy : gy, hh, ww, Math.abs(t0) < PI / 2 ? clamp(t0, -lim, lim) : t0, lit, mid, dark);
    }
  }
  function kFinish(w, h, it, C) {
    hazeOver(w, h, it, 300, 0, 0.5, C.haze);
    grain(w, h, 0.035);
  }
  // Riesige Kristallgruppe auf einem Felshügel, dahinter Höhlenleuchten
  function kCluster(w, h, q, C, p, it) {
    const F = kFar(C), gy = h - 16, cx = w * R(q, 0.42, 0.58), H = h - 22;
    soft(cx, gy - H * 0.45, w * 0.48, H * 0.5, F.glow[q() < 0.35 ? 1 : 0], 0.24);
    const list = [[cx, H, 12 + H * 0.07, R(q, -0.06, 0.06)]];
    for (let k = 0; k < p.n; k++) {
      const dx = (q() - 0.5) * w * 0.8, hh = H * R(q, 0.28, 0.78) * (1 - Math.abs(dx) / (w * 0.5) * 0.6);
      list.push([cx + dx, hh, 6 + hh * 0.09, dx / w * 1.4 + R(q, -0.12, 0.12)]);
    }
    kPrisms(list, F, q, { w, gy });
    mound(w, h, gy - 12, q, F.rock, cx / w, 5);
    kFinish(w, h, it, C);
  }
  // Felsbogen, oben Kristalle, unten hängende Spitzen, Leuchten in der Öffnung
  function kArch(w, h, q, C, p, it) {
    const F = kFar(C), gy = h - 14, cx = w / 2, rxo = w * 0.4, ryo = h - 30, th = w * R(q, 0.09, 0.12);
    const rxi = rxo - th, ryi = ryo - th * 0.85, rock = mix(F.rock, C.far, 0.2), dark = shade(rock, -0.22), N = 18;
    soft(cx, gy - ryi * 0.42, rxi * 0.95, ryi * 0.7, F.glow[q() < 0.5 ? 1 : 0], 0.32);
    const outer = [], inner = [];
    for (let k = 0; k <= N; k++) { const a = PI + PI * k / N, j = 1 + (q() - 0.5) * 0.05; outer.push([cx + Math.cos(a) * rxo * j, gy + Math.sin(a) * ryo * j]); }
    for (let k = 0; k <= N; k++) { const a = PI + PI * k / N; inner.push([cx + Math.cos(a) * rxi, gy + Math.sin(a) * ryi]); }
    const fl = [cx - rxo - w * 0.06, gy + 12], fr = [cx + rxo + w * 0.06, gy + 12];
    poly([fl, ...outer, fr, ...inner.slice().reverse()], rock);
    const ks = Math.round(N * 0.62);
    poly([...outer.slice(ks), fr, ...inner.slice(ks).reverse()], dark);
    path(inner);
    ctx.strokeStyle = rgba(INK, 0.22);
    ctx.lineWidth = 3;
    ctx.stroke();
    path(outer.slice(2, ks + 1));
    ctx.strokeStyle = rgba(CREAM, 0.14);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const list = [];
    for (let k = 0; k < p.n; k++) {
      const a = PI + PI * R(q, 0.15, 0.85), nx = Math.cos(a) * ryo, ny = Math.sin(a) * rxo, t = Math.atan2(nx, -ny) * 0.45 + R(q, -0.15, 0.15), hh = R(q, 16, 40);
      list.push([cx + Math.cos(a) * (rxo - 5), hh, 4 + hh * 0.1, t, gy + Math.sin(a) * (ryo - 5)]);
    }
    for (let k = 0; k < 5; k++) {
      const a = PI + PI * R(q, 0.2, 0.8), nx = Math.cos(a) * ryi, ny = Math.sin(a) * rxi, t = Math.atan2(-nx, ny), hh = R(q, 10, 26);
      list.push([cx + Math.cos(a) * (rxi + 2), hh, 3 + hh * 0.12, t, gy + Math.sin(a) * (ryi + 2)]);
    }
    kPrisms(list, F, q, { w, gy });
    mound(w, h, gy - 10, q, F.rock, 0.5, 4);
    kFinish(w, h, it, C);
  }
  // Riesige, aufgebrochene Geode: Schale mit Kugelschatten, leuchtende Höhlung mit Kristallbesatz, halb im Boden
  function kGeode(w, h, q, C, p, it) {
    const F = kFar(C), cx = w / 2, rx = w * 0.42, ry = Math.min(h * 0.47, rx * R(q, 0.82, 0.98)), cy = h - 16 - ry * 0.8;
    const rock = mix(F.rock, C.far, 0.25), gc = F.glow[q() < 0.45 ? 1 : 0], cav = mix(mix(C.near, gc, 0.35), INK, 0.12);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fillStyle = rock;
    ctx.fill();
    ctx.clip();
    stamp(overlaySprite(mix(C.skyTop, INK, 0.2), 0.16, '', 0), cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();
    const crx = rx * 0.76, cry = ry * 0.74, ccx = cx + rx * 0.03, ccy = cy + ry * 0.03;
    ellipse(ccx, ccy, crx, cry, 0, cav);
    soft(ccx, ccy, crx * 0.9, cry * 0.9, gc, 0.6);
    const lit = [], dk = [];
    for (let k = 0, n = 72; k < n; k++) {
      const ring = k % 3, a = k / n * TAU + q() * 0.35, f = [1.02, 0.86, 0.7][ring], bx = ccx + Math.cos(a) * crx * f, by = ccy + Math.sin(a) * cry * f;
      const ux = ccx - bx, uy = ccy - by, d = Math.hypot(ux, uy) || 1, L = Math.min(crx, cry) * R(q, 0.07, 0.17) * (ring ? 0.8 : 1), hw = L * R(q, 0.28, 0.4);
      const nx = -uy / d * hw, ny = ux / d * hw, T = [bx + ux / d * L, by + uy / d * L], M = [bx, by], A = [bx + nx, by + ny], B = [bx - nx, by - ny];
      if (nx * LD.x + ny * LD.y > 0) { lit.push([A, T, M]); dk.push([B, T, M]); } else { lit.push([B, T, M]); dk.push([A, T, M]); }
    }
    ctx.beginPath();
    dk.forEach(subPoly);
    ctx.fillStyle = mix(gc, C.far, 0.4);
    ctx.fill();
    ctx.beginPath();
    lit.forEach(subPoly);
    ctx.fillStyle = mix(gc, CREAM, 0.35);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(CREAM, 0.22);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 0.7, ry - 0.7, 0, PI * 0.95, PI * 1.6);
    ctx.stroke();
    const gl = [];
    for (let k = 0; k < 10; k++) { const a = q() * TAU, f = R(q, 0.5, 0.95); gl.push([ccx + Math.cos(a) * crx * f, ccy + Math.sin(a) * cry * f, R(q, 0.6, 1.2)]); }
    dots(gl, rgba(CREAM, 0.6));
    mound(w, h, cy + ry * 0.5, q, F.rock, 0.5, 5);
    kFinish(w, h, it, C);
  }
  // Zwei bis drei sehr hohe Kristallnadeln mit kleinen Prismen am Fuß
  function kSpires(w, h, q, C, p, it) {
    const F = kFar(C), gy = h - 14, H = h - 16, n = p.n;
    soft(w / 2, gy - H * 0.4, w * 0.46, H * 0.45, F.glow[q() < 0.3 ? 1 : 0], 0.2);
    const list = [];
    for (let k = 0; k < n; k++) list.push([w * (n === 1 ? 0.5 : 0.28 + 0.44 * k / (n - 1)) + R(q, -8, 8), H * (k === 1 || n === 1 ? 1 : R(q, 0.6, 0.85)), R(q, 7, 11), R(q, -0.08, 0.08)]);
    for (let k = 0; k < 6; k++) { const hh = H * R(q, 0.08, 0.24); list.push([w * R(q, 0.12, 0.88), hh, 4 + hh * 0.1, R(q, -0.55, 0.55)]); }
    kPrisms(list, F, q, { w, gy });
    mound(w, h, gy - 10, q, F.rock, 0.5, 4);
    kFinish(w, h, it, C);
  }
  // Tafelberg mit Schichtung und einer Krone aus Kristallen
  function kTerrace(w, h, q, C, p, it) {
    const F = kFar(C), gy = h - 12, mh = h * R(q, 0.36, 0.48), top = gy - mh, tl = w * R(q, 0.2, 0.28), tr = w * R(q, 0.72, 0.8);
    const rock = mix(F.rock, C.far, 0.15), dark = shade(rock, -0.24), tp = [];
    for (let k = 0; k <= 8; k++) tp.push([lerp(tl, tr, k / 8), top + (q() - 0.5) * 6]);
    poly([[w * 0.05, gy + 6], ...tp, [w * 0.95, gy + 6]], rock);
    poly([tp[5], ...tp.slice(6), [w * 0.95, gy + 6], [lerp(tl, tr, 0.7) + w * 0.06, gy + 6]], dark);
    const st = [];
    for (let k = 1; k < 5; k++) { const y = top + mh * k / 5, f = k / 5; st.push([lerp(tl, w * 0.05, f) + 3, y, lerp(tr, w * 0.95, f) - 3, y + (q() - 0.5) * 3]); }
    segs(st, rgba(INK, 0.14), 1.2);
    line(tl + 2, top + 1, tr - 2, top + 1, rgba(CREAM, 0.16), 1.2);
    const list = [];
    for (let k = 0; k < p.n; k++) { const x = R(q, tl + 8, tr - 8), hh = (h - mh - 22) * R(q, 0.35, 1); list.push([x, hh, 5 + hh * 0.1, (x - w / 2) / w * 1.2 + R(q, -0.15, 0.15), top + 4]); }
    for (let k = 0; k < 3; k++) { const f = R(q, 0.3, 0.8), x = lerp(tl, w * 0.05, f) + 6, hh = R(q, 14, 30); list.push([x, hh, 4 + hh * 0.1, R(q, -0.7, -0.2), top + mh * f]); }
    kPrisms(list, F, q, { w, gy });
    mound(w, h, gy - 8, q, F.rock, 0.5, 3);
    kFinish(w, h, it, C);
  }
  // Gestürztes Riesenprisma, Bruchfläche am Fuß, kleine Kristalle ringsum
  function kFallen(w, h, q, C, p, it) {
    const F = kFar(C), gy = h - 14, dir = p.dir, x0 = dir > 0 ? w * 0.16 : w * 0.84, ww = p.ww, y0 = gy - ww * 0.4;
    const [lit, mid, dark] = F.set(F.tints[1 + Math.floor(q() * 2)]);
    soft(w / 2, gy - h * 0.35, w * 0.45, h * 0.38, F.glow[0], 0.18);
    prism(x0, y0, p.len, ww, p.tilt * dir, lit, mid, dark);
    const c = Math.cos(p.tilt * dir), s = Math.sin(p.tilt * dir), P = (a, b) => [x0 + a * c - b * s, y0 + a * s + b * c];
    poly([P(-ww, 2), P(-ww * 0.4, 6), P(ww * 0.3, 1), P(ww, 4), P(ww * 0.9, -4), P(0, -2), P(-ww * 0.8, -3)], mix(lit, CREAM, 0.2));
    const list = [];
    for (let k = 0; k < p.n; k++) { const hh = R(q, 14, 46); list.push([w * R(q, 0.08, 0.92), hh, 4 + hh * 0.1, R(q, -0.6, 0.6)]); }
    kPrisms(list, F, q, { w, gy });
    mound(w, h, gy - 10, q, F.rock, dir > 0 ? 0.3 : 0.7, 4);
    kFinish(w, h, it, C);
  }
  // Niedriger Felsrücken mit kleinen Kristallen (Luft zwischen den großen Formationen)
  function kRidge(w, h, q, C, p, it) {
    const F = kFar(C), pts = mound(w, h, 14, q, F.rock, R(q, 0.3, 0.7), 8, rgba(CREAM, 0.1)), list = [];
    for (let k = 0; k < p.n; k++) { const j = 4 + Math.floor(q() * (pts.length - 8)), hh = R(q, 12, 40); list.push([pts[j][0], hh, 3 + hh * 0.12, R(q, -0.5, 0.5), pts[j][1] + 5]); }
    kPrisms(list, F, q, { w, gy: h - 10 });
    kFinish(w, h, it, C);
  }

  // Nähere Farben wie Ebene 1 (Kristalldome): Cyan und Rosa
  function kNear(C) {
    const col = C.mid, set = t => [mix(t, CREAM, 0.3), t, shade(mix(col, t, 0.5), -0.16)];
    return { cyan: mix(mix(col, C.pipe, 0.36), C.skyBottom, 0.12), pink: mix(mix(col, C.accent, 0.34), C.skyBottom, 0.12), set };
  }
  function kSpark(x, y, s, C) {
    glow(x, y, s * 6, mix(CREAM, C.pipe, 0.3), 0.6);
    segs([[x - s * 3, y, x + s * 3, y], [x, y - s * 3, x, y + s * 3]], rgba(CREAM, 0.55), 0.8);
  }
  // Schwebender Splitter mit Bruchstücken und schwachem Schein
  function kShard(w, h, q, C, p) {
    const K = kNear(C), pink = q() < 0.35, [lit, mid, dark] = K.set(pink ? K.pink : K.cyan), cx = w / 2, cy = h / 2;
    soft(cx, cy, w * 0.48, h * 0.48, pink ? C.accent : C.pipe, 0.2);
    bipyr(cx, cy, p.len, p.ww, p.tilt, lit, mid, dark);
    for (let k = 0; k < 4; k++) {
      const a = q() * TAU, d = R(q, 0.62, 0.9), x = clamp(cx + Math.cos(a) * w * 0.5 * d, 8, w - 8), y = clamp(cy + Math.sin(a) * h * 0.5 * d, 8, h - 8);
      bipyr(x, y, R(q, 8, 15), R(q, 2, 3.4), q() * TAU, lit, mid, dark);
    }
    kSpark(cx - Math.sin(p.tilt) * p.len * 0.4, cy - Math.cos(p.tilt) * p.len * 0.4, 1.2, C);
    grain(w, h, 0.03);
  }
  // Drei Splitter in einer schrägen Reihe
  function kTrio(w, h, q, C, p) {
    const K = kNear(C);
    soft(w / 2, h / 2, w * 0.48, h * 0.46, C.pipe, 0.16);
    for (let k = 0; k < 3; k++) {
      const f = k / 2, len = h * (0.62 - k * 0.14), ww = len * R(q, 0.13, 0.17), [lit, mid, dark] = K.set(k === 1 ? K.pink : K.cyan);
      bipyr(lerp(w * 0.24, w * 0.76, f), lerp(h * 0.6, h * 0.36, f) + R(q, -6, 6), len, ww, R(q, -0.3, 0.3), lit, mid, dark);
    }
    kSpark(w * R(q, 0.3, 0.7), h * R(q, 0.2, 0.4), 1, C);
    grain(w, h, 0.03);
  }
  // Schwebender Fels mit Kristallen oben und hängenden Spitzen unten
  function kFloatRock(w, h, q, C, p) {
    const K = kNear(C), cx = w / 2, topY = h * 0.5, rw = w * 0.4, rock = mix(C.mid, C.near, 0.4), [lit, mid, dark] = K.set(q() < 0.4 ? K.pink : K.cyan);
    soft(cx, topY, w * 0.48, h * 0.45, C.pipe, 0.18);
    const pts = [[cx - rw, topY], [cx - rw * 0.7, topY - 5], [cx + rw * 0.6, topY - 4], [cx + rw, topY + 2], [cx + rw * 0.55, topY + h * 0.18], [cx + rw * 0.1, h - 8], [cx - rw * 0.45, topY + h * 0.2]];
    smooth(pts);
    ctx.fillStyle = vgrad(topY - 5, h - 8, [[0, shade(rock, 0.12)], [1, shade(rock, -0.3)]]);
    ctx.fill();
    poly([[cx + rw * 0.05, topY], [cx + rw, topY + 2], [cx + rw * 0.55, topY + h * 0.18], [cx + rw * 0.1, h - 8]], rgba(INK, 0.16));
    for (let k = 0; k < 3; k++) { const x = cx + R(q, -0.3, 0.4) * rw, hh = R(q, 10, 22); prism(x, topY + h * 0.22 + R(q, -4, 4), hh, 2.5 + hh * 0.1, PI + R(q, -0.3, 0.3), lit, mid, dark); }
    const list = [];
    for (let k = 0; k < 5; k++) { const hh = (topY - 10) * R(q, 0.35, 1); list.push([cx + R(q, -0.75, 0.75) * rw, hh, 3 + hh * 0.11, R(q, -0.4, 0.4)]); }
    list.sort((a, b) => b[1] - a[1]);
    for (const [x, hh, ww, t] of list) prism(x, topY + 2, hh, ww, t, lit, mid, dark);
    grain(w, h, 0.03);
  }

  SCENE['Kristall'] = {
    hideLayers: [0],
    tracks: [
      {
        // Riesenformationen an der Stelle der fernen Kristallberge (Ebene 0, gleiche Tiefe)
        z: 1, factor: 0.2, start: 20, gap: [-40, 30], maxKs: 1.5,
        pick: flow(['cluster', 'ridge', 'arch', 'geode', 'spires', 'terrace'], ['cluster', 'arch', 'geode', 'spires', 'terrace', 'fallen', 'ridge', 'ridge', 'cluster'], 801, null, { geode: 5, arch: 4, fallen: 4 }),
        base: (i, q) => Math.round(R(q, 522, 530)),
        kinds: {
          cluster: kind(q => ({ n: 6 + Math.floor(q() * 4), w: R(q, 200, 320), h: R(q, 230, 330) }), kCluster),
          arch: kind(q => ({ n: 6 + Math.floor(q() * 4), w: R(q, 250, 340), h: R(q, 170, 240) }), kArch),
          geode: kind(q => ({ w: R(q, 200, 290), h: R(q, 170, 240) }), kGeode),
          spires: kind(q => ({ n: 2 + Math.floor(q() * 2), w: R(q, 120, 190), h: R(q, 280, 340) }), kSpires),
          terrace: kind(q => ({ n: 5 + Math.floor(q() * 4), w: R(q, 240, 340), h: R(q, 190, 260) }), kTerrace),
          fallen: kind(q => {
            const w = R(q, 270, 345), tilt = R(q, 1.0, 1.2), len = w * R(q, 0.6, 0.7), ww = R(q, 18, 26);
            return { w, tilt, len, ww, dir: sgn(q), n: 4 + Math.floor(q() * 3), h: len * Math.cos(tilt) + ww * 2 + 40 };
          }, kFallen),
          ridge: kind(q => ({ n: 5 + Math.floor(q() * 4), w: R(q, 200, 300), h: R(q, 70, 100) }), kRidge)
        }
      },
      {
        // schwebende Splitter in mittlerer Tiefe, sparsam
        z: 1, factor: 0.35, start: 380, gap: [60, 160], maxKs: 2,
        pick: flow(['pause', 'shard', 'pause', 'rock', 'pause', 'trio'], ['shard', 'rock', 'trio', 'shard'], 802, 'pause'),
        base: midBase({ shard: [150, 300], trio: [140, 280], rock: [170, 320], pause: [200, 300] }),
        kinds: {
          shard: kind(q => {
            const len = R(q, 100, 150), ww = len * R(q, 0.12, 0.16), tilt = R(q, -0.35, 0.35);
            return { len, ww, tilt, w: 2 * (Math.abs(Math.sin(tilt)) * len / 2 + ww) + 46, h: len * Math.cos(tilt) + 2 * ww * Math.abs(Math.sin(tilt)) + 40 };
          }, kShard),
          trio: kind(q => ({ w: R(q, 120, 170), h: R(q, 110, 150) }), kTrio),
          rock: kind(q => ({ w: R(q, 100, 150), h: R(q, 110, 150) }), kFloatRock),
          pause: pause(160, 420)
        }
      }
    ]
  };

  // ============================================================
  // EIS: anstelle der näheren Bergkette eine Folge aus Kuppelhütten, Eisklippen, gefrorenem
  // Wasserfall, Eisbergen in einer zugefrorenen Bucht, eingefrorenem Schiff und Eistürmen
  // ============================================================
  function eCols(C) {
    return {
      snow: mix(CREAM, '#ffffff', 0.25), snowSh: mix(mix(CREAM, C.skyTop, 0.4), C.far, 0.2),
      lit: mix(C.near, C.far, 0.12), ice: mix(C.pipe, C.near, 0.5), dk: mix(C.pipe, C.far, 0.55), deep: mix(mix(C.pipe, C.accent, 0.45), C.far, 0.2),
      rock: mix(mix(C.far, C.accent, 0.3), C.skyTop, 0.2)
    };
  }
  function eFinish(w, h, it, C) {
    hazeOver(w, h, it, 380, 0, 0.3, C.haze);
    grain(w, h, 0.03);
  }
  // Schneewehe über die ganze Breite (Fuß jedes Motivs)
  function eDrift(w, h, q, K, top) {
    const pts = moundPts(w, h, top, q, R(q, 0.35, 0.65), 3);
    poly(pts, vgrad(top, h, [[0, K.snow], [1, mix(K.snow, K.snowSh, 0.5)]]));
    path(pts.slice(2, -2));
    ctx.strokeStyle = rgba(K.snowSh, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Eismassiv: Flanken laufen zum Boden aus, gezackter Kamm, schräge Facetten in drei gedämpften Tönen,
  // Schneekappe mit Zapfen; liefert die Höhe des Kamms über x
  function eWall(x0, x1, gy, topY, q, K, rough, rock) {
    const N = 14, top = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, e = Math.min(1, Math.min(t, 1 - t) / 0.2), y = gy - (gy - topY) * Math.pow(e, 0.55);
      top.push([lerp(x0, x1, t), Math.min(gy, y + (q() - 0.5) * rough * e - (k % 3 === 1 ? rough * 0.6 * q() * e : 0))]);
    }
    const f = x => { const t = clamp((x - x0) / (x1 - x0), 0, 1) * N, k = Math.min(N - 1, Math.floor(t)); return lerp(top[k][1], top[k + 1][1], t - k); };
    const tones = rock ? [mix(rock, CREAM, 0.12), rock, shade(rock, -0.18)] : [K.lit, K.ice, K.dk], grp = [[], [], []];
    for (let k = 0; k < N; k++) {
      const s0 = R(q, -6, 6), s1 = R(q, -6, 6), g = top[k + 1][1] < top[k][1] - 2 ? 0 : top[k + 1][1] > top[k][1] + 2 ? 2 : 1;
      grp[(g + (q() < 0.25 ? 1 : 0)) % 3].push([top[k], top[k + 1], [top[k + 1][0] + s1, gy + 2], [top[k][0] + s0, gy + 2]]);
    }
    tones.forEach((c, j) => { ctx.beginPath(); grp[j].forEach(subPoly); ctx.fillStyle = c; ctx.fill(); });
    const st = [];
    for (let k = 0; k < 5; k++) { const y = lerp(topY, gy, R(q, 0.3, 0.9)), xa = R(q, x0, x1); st.push([xa, y, xa + R(q, 20, 60), y + R(q, -2, 2)]); }
    segs(st, rgba(K.deep, 0.18), 1);
    const cap = top.map(([a, b]) => [a, b - 2]), under = [], ic = [];
    for (let k = top.length - 1; k >= 0; k--) under.push([top[k][0], top[k][1] + R(q, 3, 8) * (k && k < N ? 1 : 0)]);
    poly(cap.concat(under), K.snow);
    for (let k = 0; k < 9; k++) { const ix = R(q, x0 + (x1 - x0) * 0.2, x1 - (x1 - x0) * 0.2), iy = f(ix) + 5, il = R(q, 5, 12); ic.push([[ix - 1.5, iy], [ix + 1.5, iy], [ix, iy + il]]); }
    ctx.beginPath();
    ic.forEach(subPoly);
    ctx.fillStyle = mix(K.lit, '#ffffff', 0.2);
    ctx.fill();
    return f;
  }
  function eCliff(w, h, q, C, p, it) {
    const K = eCols(C), gy = h - 10;
    eWall(w * 0.02, w * 0.98, gy, h * R(q, 0.04, 0.16), q, K, 30);
    eDrift(w, h, q, K, gy - 14);
    eFinish(w, h, it, C);
  }
  // Gefrorener Wasserfall: dunkle Felsklippe mit Schnee, heller Eisvorhang, der sich nach unten weitet,
  // Rillen und Lichtkanten, Eisbuckel und zugefrorenes Becken am Fuß
  function eFall(w, h, q, C, p, it) {
    const K = eCols(C), gy = h - 10, fx = w * R(q, 0.42, 0.58), fw = w * R(q, 0.11, 0.15);
    const f = eWall(w * 0.02, w * 0.98, gy, h * R(q, 0.04, 0.12), q, K, 16, K.rock);
    const t0 = f(fx) + 4, L = [], Rr = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, y = lerp(t0, gy - 4, t), wd = fw * (0.55 + t * 0.6);
      L.push([fx - wd + Math.sin(t * 9 + 1) * 3, y]);
      Rr.push([fx + wd + Math.sin(t * 8 + 2) * 3, y]);
    }
    poly(L.concat(Rr.reverse()), vgrad(t0, gy, [[0, mix(K.snow, '#ffffff', 0.2)], [1, mix(K.ice, K.lit, 0.4)]]));
    const gr = [], hi = [];
    for (let k = 0; k < 9; k++) {
      const a = (k + 0.5) / 9 - 0.5, x0 = fx + a * fw * 1.0, x1 = fx + a * fw * 2.1, y0 = t0 + R(q, 2, 14), y1 = gy - R(q, 6, 22);
      (k % 2 ? gr : hi).push([x0, y0, x1, y1]);
    }
    segs(gr, rgba(K.dk, 0.45), 1.3);
    segs(hi, rgba('#ffffff', 0.55), 1);
    blobPath([[fx - fw * 0.6, gy - 4, fw * 0.45], [fx + fw * 0.2, gy - 6, fw * 0.55], [fx + fw * 0.9, gy - 3, fw * 0.4]]);
    ctx.fillStyle = vgrad(gy - fw * 0.6, gy, [[0, K.snow], [1, K.ice]]);
    ctx.fill();
    ellipse(fx, gy + 3, fw * 1.6, 5, 0, mix(K.lit, K.ice, 0.3));
    eDrift(w, h, q, K, gy - 8);
    eFinish(w, h, it, C);
  }
  // Eisberge in einer zugefrorenen Bucht: kantige Blöcke (helle Oberseite, Front, blauer Schatten)
  function eBerg(w, h, q, C, p, it) {
    const K = eCols(C), gy = h - 14, n = p.n;
    poly([[-2, gy - 4], [w + 2, gy - 6], [w + 2, h + 2], [-2, h + 2]], vgrad(gy - 6, h, [[0, mix(K.lit, K.ice, 0.3)], [1, mix(K.ice, K.dk, 0.3)]]));
    const cr = [];
    for (let k = 0; k < 6; k++) { const x = R(q, 10, w - 10), y = R(q, gy, h - 3); cr.push([x - R(q, 10, 30), y, x + R(q, 10, 30), y + R(q, -2, 2)]); }
    segs(cr, rgba(K.dk, 0.35), 0.9);
    const bergs = [];
    for (let k = 0; k < n; k++) bergs.push([w * (n === 1 ? 0.5 : 0.2 + 0.6 * k / (n - 1)) + R(q, -14, 14), (gy - 8) * (k === Math.floor(n / 2) ? 1 : R(q, 0.45, 0.75)), w / n * R(q, 0.32, 0.45)]);
    bergs.sort((a, b) => b[1] - a[1]);
    for (const [cx, bh, bw] of bergs) {
      const top = gy - bh, tl = cx - bw * R(q, 0.4, 0.6), tr = cx + bw * R(q, 0.3, 0.55), ty = top + R(q, 2, 10);
      const ridge = cx + R(q, -0.15, 0.2) * bw;
      poly([[cx - bw, gy], [tl, ty], [ridge, top], [ridge + bw * 0.1, gy]], K.lit);
      poly([[ridge, top], [tr, top + bh * 0.15], [cx + bw, gy], [ridge + bw * 0.1, gy]], K.dk);
      poly([[tl, ty], [ridge, top], [tr, top + bh * 0.15], [ridge + bw * 0.05, ty + bh * 0.08]], K.snow);
      segs([[cx - bw * 0.5, gy - bh * 0.3, cx - bw * 0.45, gy - 2], [ridge + bw * 0.4, top + bh * 0.4, ridge + bw * 0.42, gy - 3]], rgba(K.deep, 0.3), 1);
      ellipse(cx + bw * 0.1, gy + 1, bw * 1.05, 3, 0, rgba(K.deep, 0.25));
    }
    const ch = [];
    for (let k = 0; k < 7; k++) { const x = R(q, 8, w - 8), s = R(q, 2, 5); ch.push([[x - s, gy + 2], [x - s * 0.4, gy - s], [x + s, gy - s * 0.6], [x + s * 1.2, gy + 2]]); }
    ctx.beginPath();
    ch.forEach(subPoly);
    ctx.fillStyle = K.snow;
    ctx.fill();
    eFinish(w, h, it, C);
  }
  // Kuppelhütten aus Schneeblöcken mit Eingangstunnel, ein Gestell mit Fellen, schwacher Lichtschein
  function eHuts(w, h, q, C, p, it) {
    const K = eCols(C), n = p.n, warm = mix(CREAM, '#ffcf8a', 0.5), hill = moundPts(w, h, h * 0.42, q, 0.5, 2);
    poly(hill, vgrad(h * 0.42, h, [[0, K.snow], [1, mix(K.snow, K.snowSh, 0.6)]]));
    const hy = x => { for (let k = 1; k < hill.length; k++) if (hill[k][0] >= x) { const a = hill[k - 1], b = hill[k], t = (x - a[0]) / ((b[0] - a[0]) || 1); return lerp(a[1], b[1], t); } return h; };
    const list = [];
    for (let k = 0; k < n; k++) list.push([w * (0.3 + 0.4 * (n === 1 ? 0.5 : k / (n - 1))) + R(q, -8, 8), R(q, 18, 30) * (k === 1 ? 1.15 : 1)]);
    list.sort((a, b) => a[1] - b[1]);
    const rack = w * (q() < 0.5 ? R(q, 0.16, 0.24) : R(q, 0.76, 0.84)), ry0 = hy(rack) + 2;
    segs([[rack - 9, ry0, rack - 7, ry0 - 22], [rack + 9, ry0, rack + 7, ry0 - 22], [rack - 11, ry0 - 20, rack + 11, ry0 - 20]], mix(C.far, INK, 0.35), 1.6);
    poly([[rack - 6, ry0 - 20], [rack + 6, ry0 - 20], [rack + 5, ry0 - 9], [rack - 5, ry0 - 10]], mix(mix('#9a7a5a', C.far, 0.4), CREAM, 0.1));
    for (const [x, r] of list) {
      const ry = r * 0.85, base = hy(x) + 4;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, base, r, ry, 0, PI, TAU);
      ctx.closePath();
      ctx.fillStyle = K.snowSh;
      ctx.fill();
      ctx.clip();
      ellipse(x - r * 0.28, base - ry * 0.12, r * 0.98, ry * 0.98, 0, K.snow);
      const bl = [];
      for (let k = 1; k <= 3; k++) { const yy = base - ry * k / 3.6; bl.push([x - r, yy, x + r, yy]); }
      for (let k = 0; k < 7; k++) { const yy = base - ry * (Math.floor(k / 3) + 0.5) / 3.6 * 1, xx = x + (k % 3 - 1) * r * 0.45 + (Math.floor(k / 3) % 2) * r * 0.22; bl.push([xx, yy + ry * 0.12, xx, yy - ry * 0.14]); }
      segs(bl, rgba(K.snowSh, 0.5), 0.8);
      ctx.restore();
      const ex = x + r * 0.55, er = r * 0.42;
      ctx.beginPath();
      ctx.ellipse(ex, base, er, er * 0.8, 0, PI, TAU);
      ctx.closePath();
      ctx.fillStyle = K.snow;
      ctx.fill();
      ellipse(ex + er * 0.35, base - er * 0.3, er * 0.35, er * 0.42, 0, mix(K.deep, INK, 0.3));
      soft(ex + er * 0.35, base - er * 0.3, er * 1.2, er * 0.9, warm, 0.35);
    }
    eFinish(w, h, it, C);
  }
  // Eingefrorenes Segelschiff: geneigter Rumpf im Packeis, Masten mit gerefften, bereiften Segeln, Zapfen
  function eShip(w, h, q, C, p, it) {
    const K = eCols(C), gy = h - 14, dir = p.dir, tilt = p.tilt * dir, wood = mix('#5e4436', C.far, 0.22);
    const woodLit = mix(wood, CREAM, 0.18), hl = w * 0.72, hx = w / 2, hy = gy - h * 0.12;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tilt);
    ctx.scale(dir, 1);
    const mastH = h * 0.66, masts = [-hl * 0.22, hl * 0.08, hl * 0.32].slice(0, p.masts);
    const rig = [];
    for (const mx of masts) {
      const mh = mastH * (mx === masts[0] ? 0.9 : 1);
      rig.push([mx, -16, mx, -16 - mh]);
      for (let k = 1; k <= 2; k++) {
        const yy = -16 - mh * (0.35 + k * 0.25), yw = hl * 0.12 * (1.25 - k * 0.25);
        rig.push([mx - yw, yy, mx + yw, yy]);
        poly([[mx - yw * 0.9, yy + 1], [mx + yw * 0.9, yy + 1], [mx + yw * 0.75, yy + mh * 0.16], [mx - yw * 0.8, yy + mh * 0.18]], rgba(mix(CREAM, K.snowSh, 0.3), 0.85));
        segs([[mx - yw * 0.6, yy + mh * 0.05, mx - yw * 0.55, yy + mh * 0.15], [mx + yw * 0.3, yy + mh * 0.04, mx + yw * 0.3, yy + mh * 0.13]], rgba(K.snowSh, 0.6), 0.8);
      }
    }
    rig.push([masts[0], -16 - mastH * 0.9, -hl * 0.5, -22], [masts[masts.length - 1], -16 - mastH, hl * 0.5, -20]);
    segs(rig, rgba(mix(wood, INK, 0.2), 0.75), 1);
    // Rumpf: Bug rechts, Heck links erhöht
    const hull = [[-hl * 0.5, -26], [-hl * 0.42, -18], [hl * 0.36, -16], [hl * 0.52, -24], [hl * 0.44, 10], [-hl * 0.4, 12]];
    poly(hull, vgrad(-26, 12, [[0, woodLit], [0.4, wood], [1, shade(wood, -0.3)]]));
    segs([[-hl * 0.42, -8, hl * 0.42, -8], [-hl * 0.4, 0, hl * 0.4, 0]], rgba(INK, 0.25), 1);
    poly([[-hl * 0.5, -26], [-hl * 0.42, -18], [hl * 0.36, -16], [hl * 0.52, -24], [hl * 0.5, -21], [hl * 0.35, -13], [-hl * 0.42, -15], [-hl * 0.5, -23]], K.snow);
    const ic = [];
    for (let k = 0; k < 9; k++) { const ix = R(q, -hl * 0.38, hl * 0.38), il = R(q, 4, 11); ic.push([[ix - 1.5, 10], [ix + 1.5, 10], [ix, 10 + il]]); }
    ctx.beginPath();
    ic.forEach(subPoly);
    ctx.fillStyle = mix(K.lit, '#ffffff', 0.3);
    ctx.fill();
    ctx.restore();
    // Packeis um den Rumpf
    const blocks = [];
    for (let k = 0; k < 11; k++) {
      const bx = w * R(q, 0.08, 0.92), bs = R(q, 6, 15), by = gy - R(q, 0, 8);
      blocks.push([[bx - bs, by + 6], [bx - bs * 0.6, by - bs * 0.8], [bx + bs * 0.4, by - bs], [bx + bs, by + 6]]);
    }
    eDrift(w, h, q, K, gy - 12);
    ctx.beginPath();
    blocks.forEach(subPoly);
    ctx.fillStyle = K.lit;
    ctx.fill();
    ctx.beginPath();
    blocks.forEach(b => subPoly([b[2], b[3], [b[3][0] - 2, b[2][1] + 4]]));
    ctx.fillStyle = rgba(K.dk, 0.7);
    ctx.fill();
    eFinish(w, h, it, C);
  }
  // Eistürme (Séracs): spitze Zinnen mit Licht- und Schattenseite und Schnee auf den Spitzen
  function eSeracs(w, h, q, C, p, it) {
    const K = eCols(C), gy = h - 10, list = [];
    for (let k = 0; k < p.n; k++) list.push([w * R(q, 0.14, 0.86), (gy - 6) * R(q, 0.4, 1), R(q, 15, 28)]);
    list.sort((a, b) => b[1] - a[1]);
    for (const [x, hh, bw] of list) {
      const top = gy - hh, tx = x + R(q, -0.3, 0.3) * bw, mx = x + R(q, -0.15, 0.15) * bw;
      poly([[x - bw, gy], [x - bw * 0.7, gy - hh * 0.55], [tx, top], [mx, gy]], K.lit);
      poly([[tx, top], [x + bw * 0.75, gy - hh * 0.5], [x + bw, gy], [mx, gy]], K.dk);
      poly([[x - bw * 0.72, gy - hh * 0.5], [tx, top], [x + bw * 0.6, gy - hh * 0.6], [tx + 1, top + hh * 0.22], [x - bw * 0.3, gy - hh * 0.42]], K.snow);
      line(mx, gy - 2, mx + (tx - mx) * 0.6, gy - hh * 0.6, rgba(K.deep, 0.25), 1);
    }
    eDrift(w, h, q, K, gy - 10);
    eFinish(w, h, it, C);
  }
  // Flache Schneewehen mit ein paar Eisschollen (Luft zwischen den großen Motiven)
  function eLow(w, h, q, C, p, it) {
    const K = eCols(C), gy = h - 8;
    eDrift(w, h, q, K, 10);
    const bl = [];
    for (let k = 0; k < p.n; k++) { const x = R(q, 12, w - 12), s = R(q, 5, 12), y = gy - R(q, 2, 10); bl.push([[x - s, y + 4], [x - s * 0.5, y - s], [x + s * 0.6, y - s * 0.8], [x + s, y + 4]]); }
    ctx.beginPath();
    bl.forEach(subPoly);
    ctx.fillStyle = K.lit;
    ctx.fill();
    ctx.beginPath();
    bl.forEach(b => subPoly([b[2], b[3], [b[3][0] - 2, b[2][1] + 3]]));
    ctx.fillStyle = rgba(K.dk, 0.6);
    ctx.fill();
    eFinish(w, h, it, C);
  }

  SCENE['Eis'] = {
    hideLayers: [1],
    tracks: [
      {
        // an der Stelle der näheren Bergkette (Ebene 1), vor den fernen Gipfeln und hinter den Tannen
        z: 1, factor: 0.45, start: 60, gap: [-30, 40], maxKs: 2,
        pick: flow(['huts', 'drift', 'cliff', 'fall', 'berg', 'ship', 'berg', 'seracs'], ['cliff', 'fall', 'berg', 'huts', 'seracs', 'drift', 'berg', 'cliff', 'ship', 'drift'], 701, null, { ship: 8, huts: 4, fall: 3 }),
        base: (i, q) => Math.round(R(q, 530, 538)),
        kinds: {
          huts: kind(q => ({ n: 2 + Math.floor(q() * 2), w: R(q, 200, 270), h: R(q, 120, 145) }), eHuts),
          drift: kind(q => ({ n: 3 + Math.floor(q() * 4), w: R(q, 180, 280), h: R(q, 40, 64) }), eLow),
          cliff: kind(q => ({ w: R(q, 220, 330), h: R(q, 130, 200) }), eCliff),
          fall: kind(q => ({ w: R(q, 220, 320), h: R(q, 160, 220) }), eFall),
          berg: kind(q => ({ n: 1 + Math.floor(q() * 3), w: R(q, 200, 330), h: R(q, 90, 170) }), eBerg),
          ship: kind(q => ({ dir: sgn(q), tilt: R(q, 0.05, 0.12), masts: 2 + Math.floor(q() * 2), w: R(q, 260, 330), h: R(q, 180, 220) }), eShip),
          seracs: kind(q => ({ n: 5 + Math.floor(q() * 4), w: R(q, 170, 250), h: R(q, 130, 190) }), eSeracs)
        }
      }
    ]
  };

  // ============================================================
  // LAVA: statt der fernen Vulkankette (immer derselbe Vulkan) eine ruhige, bedrohliche Folge:
  // Vulkane mit Glut und Rauch, Obsidiantürme, erstarrte Lavaströme, Felsbrücken, Basaltsäulen
  // ============================================================
  function vCols(C) {
    const col = mix(C.far, C.skyBottom, 0.12);
    return { col, lit: shade(col, 0.16), dark: shade(col, -0.3), deep: mix(C.near, INK, 0.25), smoke: mix(mix(C.far, C.skyBottom, 0.3), CREAM, 0.16) };
  }
  function vFinish(w, h, it, C) {
    hazeOver(w, h, it, 330, 0, 0.32, C.haze);
    grain(w, h, 0.04);
  }
  // Rauchsäule aus weichen Schwaden, nach rechts treibend, unten von der Glut angeleuchtet
  function vPlume(x, y, w, q, K, C, n, size) {
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), r = size * (0.45 + t * 0.9), px = clamp(x + t * t * size * 2.2 + R(q, -4, 4), r + 1, w - r - 1), py = Math.max(r * 0.8 + 1, y - t * size * 3.2);
      soft(px, py, r, r * 0.8, K.smoke, 0.55 - t * 0.3);
    }
    soft(x, y - size * 0.2, size * 0.8, size * 0.5, C.accent, 0.3);
  }
  // Zerklüfteter Kegel: Lichtflanke links, Schattenflanke rechts, Rinnen
  function vCone(cx, gy, top, hwL, hwR, flat, q, K, jag, C) {
    const L = [[cx - hwL, gy + 2]], Rr = [];
    for (let j = 1; j < 8; j++) { const t = j / 8; L.push([cx - flat - (hwL - flat) * (1 - t) + (q() - 0.5) * hwL * jag, gy - (gy - top) * t + (q() - 0.5) * 6]); }
    L.push([cx - flat, top]);
    Rr.push([cx + flat, top]);
    for (let j = 1; j < 8; j++) { const t = j / 8; Rr.push([cx + flat + (hwR - flat) * t + (q() - 0.5) * hwR * jag, top + (gy - top) * t + (q() - 0.5) * 6]); }
    Rr.push([cx + hwR, gy + 2]);
    const ridge = [[cx + flat * 0.4, top], [cx + hwR * 0.08, top + (gy - top) * 0.35], [cx - hwL * 0.02, top + (gy - top) * 0.7], [cx + hwR * 0.12, gy + 2]];
    poly(L.concat(ridge), vgrad(top, gy, [[0, K.lit], [1, K.col]]));
    poly(ridge.concat(Rr.slice().reverse()), vgrad(top, gy, [[0, mix(K.dark, K.col, 0.3)], [1, K.dark]]));
    const gl = [];
    for (let k = 0; k < 8; k++) { const t = R(q, 0.2, 0.75), yy = top + (gy - top) * t, xl = cx - hwL * t * R(q, 0.15, 0.85); gl.push([xl, yy, xl - 4, yy + (gy - top) * 0.12]); }
    segs(gl, rgba(shade(K.col, -0.25), 0.35), 1);
    path(L.slice(4));
    ctx.strokeStyle = rgba(C.accent, 0.22);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    return L;
  }
  // Vulkan mit glühendem Krater, zwei Lavarinnen und Rauchsäule
  function vVolcano(w, h, q, C, p, it) {
    const K = vCols(C), gy = h - 10, cx = w * R(q, 0.44, 0.56), ch = p.ch, top = gy - ch, flat = w * R(q, 0.04, 0.07);
    vPlume(cx, top - 6, w, q, K, C, 7, R(q, 22, 30));
    vCone(cx, gy, top, w * R(q, 0.42, 0.48), w * R(q, 0.4, 0.47), flat, q, K, 0.08, C);
    soft(cx, top + 2, flat * 3, flat * 1.6, C.accent, 0.5);
    ellipse(cx, top + 1.5, flat, 2.6, 0, C.accentLight);
    const lines = [];
    for (let k = 0; k < 2; k++) {
      let x = cx - flat * 0.6 + k * flat * 0.9, y = top + 3;
      const pts = [[x, y]], slope = R(q, 0.5, 0.9) * (k ? 0.6 : 1);
      while (y < gy - ch * R(q, 0.25, 0.5)) { const dy = 8 + q() * 7; x -= slope * dy * (k ? -0.6 : 1) + (q() - 0.5) * 4; y += dy; pts.push([x, y]); }
      lines.push(pts);
    }
    glowLines(lines, C, 1, 0.85);
    vFinish(w, h, it, C);
  }
  // Schildvulkan: breiter, flacher Rücken mit glühender Spalte und dünnem Rauch
  function vShield(w, h, q, C, p, it) {
    const K = vCols(C), gy = h - 10, top = gy - p.ch, cx = w * R(q, 0.4, 0.6);
    vPlume(cx + w * 0.05, top - 4, w, q, K, C, 4, R(q, 12, 18));
    const L = [[-2, gy + 2]], Rr = [];
    for (let j = 0; j <= 10; j++) { const t = j / 10, x = lerp(4, cx, t), y = gy - (gy - top) * Math.sin(t * PI / 2) + (q() - 0.5) * 4; L.push([x, y]); }
    for (let j = 1; j <= 10; j++) { const t = j / 10, x = lerp(cx, w - 4, t), y = top + (gy - top) * (1 - Math.cos(t * PI / 2)) + (q() - 0.5) * 4; Rr.push([x, y]); }
    const dome = L.concat(Rr, [[w + 2, gy + 2]]);
    poly(dome, vgrad(top, gy, [[0, K.lit], [1, K.col]]));
    poly([[cx, top], ...Rr, [w + 2, gy + 2], [cx + w * 0.08, gy + 2]], vgrad(top, gy, [[0, mix(K.dark, K.col, 0.3)], [1, K.dark]]));
    const f = [];
    let x = cx - w * 0.22, y = top + 8;
    for (let k = 0; k < 9; k++) { f.push([x, y]); x += w * 0.05; y = top + 6 + Math.abs(x - cx) * (gy - top) / w * 0.8 + (q() - 0.5) * 3; }
    ctx.save();
    path(dome, true);
    ctx.clip();
    glowLines([f], C, 1, 0.8);
    ctx.restore();
    soft(cx, top + 8, w * 0.22, 8, C.accent, 0.3);
    vFinish(w, h, it, C);
  }
  // Obsidiantürme: schwarze, glasige Nadeln mit scharfen, kühlen Glanzkanten
  function vObsidian(w, h, q, C, p, it) {
    const K = vCols(C), gy = h - 10, glass = mix(INK, C.far, 0.35), sheen = mix(C.accent, '#c8a0ff', 0.45), list = [];
    for (let k = 0; k < p.n; k++) list.push([w * (0.24 + 0.52 * (p.n === 1 ? 0.5 : k / (p.n - 1))) + R(q, -10, 10), (gy - 8) * (k === 1 ? 1 : R(q, 0.5, 0.85)), R(q, 20, 34)]);
    list.sort((a, b) => b[1] - a[1]);
    for (const [x, hh, bw] of list) {
      const top = gy - hh, tx = x + R(q, -0.3, 0.3) * bw, ml = [x - bw * 0.75, gy - hh * R(q, 0.4, 0.6)], mr = [x + bw * 0.7, gy - hh * R(q, 0.45, 0.65)], mid = x + R(q, -0.1, 0.25) * bw;
      poly([[x - bw, gy], ml, [tx, top], [mid, gy]], mix(glass, C.far, 0.2));
      poly([[tx, top], mr, [x + bw, gy], [mid, gy]], shade(glass, -0.3));
      segs([[tx, top, ml[0], ml[1]], [tx, top, mid, gy - 4]], rgba(sheen, 0.45), 1);
      line(tx - 1, top + 6, lerp(tx, ml[0], 0.5) + 1, lerp(top, ml[1], 0.5), rgba(CREAM, 0.35), 0.8);
    }
    mound(w, h, gy - 10, q, K.col, 0.5, 5);
    vFinish(w, h, it, C);
  }
  // Erstarrter Lavastrom: dunkle Zunge mit Stricklava-Wülsten und feinen glühenden Rissen
  function vFlow(w, h, q, C, p, it) {
    const K = vCols(C), gy = h - 8, back = mound(w, h, h * R(q, 0.15, 0.3), q, K.col, R(q, 0.2, 0.35), 8), basalt = mix(K.deep, K.col, 0.35);
    const pk = back.reduce((a, b) => (b[1] < a[1] ? b : a));
    const sx = pk[0], sy = pk[1] + 6, tongue = [[sx - 8, sy]];
    for (let j = 1; j <= 8; j++) { const t = j / 8; tongue.push([sx - 8 + (w - sx) * t * 0.9 + Math.sin(t * 7) * 6, sy + (gy - sy) * Math.pow(t, 0.7) - 6 - t * 10]); }
    const lower = [];
    for (let j = 8; j >= 0; j--) { const t = j / 8; lower.push([sx + 6 + (w - sx) * t * 0.95, Math.min(gy + 2, sy + 10 + (gy - sy) * Math.pow(t, 0.6) + 8)]); }
    smooth(tongue.concat(lower));
    ctx.fillStyle = vgrad(sy, gy, [[0, basalt], [1, shade(basalt, -0.2)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    for (let k = 0; k < 22; k++) { const t = R(q, 0.05, 0.95), x = sx + (w - sx) * t * 0.92, y = sy + (gy - sy) * Math.pow(t, 0.65) + R(q, -4, 8), r = R(q, 5, 11); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 0.7, x + r, y); }
    ctx.strokeStyle = rgba(K.lit, 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const cracks = [];
    for (let k = 0; k < 4; k++) { const t = R(q, 0.15, 0.85); let x = sx + (w - sx) * t * 0.92, y = sy + (gy - sy) * Math.pow(t, 0.65); const pts = [[x, y]]; for (let j = 0; j < 4; j++) { x += R(q, 4, 10); y += R(q, -3, 5); pts.push([x, y]); } cracks.push(pts); }
    glowLines(cracks, C, 0.7, 0.6);
    ctx.restore();
    vFinish(w, h, it, C);
  }
  // Natürliche Felsbrücke über einer Kluft, darunter Glut
  function vBridge(w, h, q, C, p, it) {
    const K = vCols(C), gy = h - 8, cx = w / 2, rxo = w * 0.42, ryo = h - 24, th = h * R(q, 0.16, 0.24), rxi = rxo - w * 0.1, ryi = ryo - th, N = 16;
    soft(cx, gy - 6, rxi * 0.9, ryi * 0.45, C.accent, 0.45);
    soft(cx, gy - 2, rxi * 0.5, 10, C.accentLight, 0.4);
    const outer = [], inner = [];
    for (let k = 0; k <= N; k++) { const a = PI + PI * k / N, j = 1 + (q() - 0.5) * 0.08; outer.push([cx + Math.cos(a) * rxo * j, gy + Math.sin(a) * ryo * j]); }
    for (let k = 0; k <= N; k++) { const a = PI + PI * k / N, j = 1 + (q() - 0.5) * 0.06; inner.push([cx + Math.cos(a) * rxi * j, gy + Math.sin(a) * ryi * j]); }
    const fl = [cx - rxo - w * 0.07, gy + 4], fr = [cx + rxo + w * 0.07, gy + 4];
    poly([fl, ...outer, fr, ...inner.slice().reverse()], vgrad(gy - ryo, gy, [[0, K.lit], [1, K.col]]));
    const ks = Math.round(N * 0.6);
    poly([...outer.slice(ks), fr, ...inner.slice(ks).reverse()], rgba(K.dark, 0.85));
    path(inner);
    ctx.strokeStyle = rgba(C.accent, 0.3);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    const sp = [];
    for (let k = 0; k < 7; k++) { const a = PI + PI * R(q, 0.15, 0.85), x = cx + Math.cos(a) * rxi, y = gy + Math.sin(a) * ryi, l = R(q, 6, 16); sp.push([[x - 3, y - 2], [x + 3, y - 2], [x + R(q, -1, 1), y + l]]); }
    ctx.beginPath();
    sp.forEach(subPoly);
    ctx.fillStyle = K.col;
    ctx.fill();
    path(outer.slice(1, ks));
    ctx.strokeStyle = rgba(CREAM, 0.12);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    vFinish(w, h, it, C);
  }
  // Basaltsäulen: sechseckige Prismen in Stufen, Deckflächen im Licht
  function vColumns(w, h, q, C, p, it) {
    const K = vCols(C), gy = h - 8, n = p.n, cw = (w - 20) / n;
    soft(w / 2, gy, w * 0.4, 12, C.accent, 0.2);
    for (let k = 0; k < n; k++) {
      const x = 10 + k * cw, hh = (h - 20) * (0.35 + 0.65 * Math.sin(PI * (k + 0.5) / n)) * R(q, 0.75, 1), top = gy - hh, d = cw * 0.28;
      poly([[x, gy], [x, top + d], [x + cw * 0.62, top + d], [x + cw * 0.62, gy]], vgrad(top, gy, [[0, K.lit], [1, shade(K.col, -0.1)]]));
      poly([[x + cw * 0.62, top + d], [x + cw, top], [x + cw, gy], [x + cw * 0.62, gy]], K.dark);
      poly([[x, top + d], [x + cw * 0.38, top], [x + cw, top], [x + cw * 0.62, top + d]], mix(K.lit, CREAM, 0.12));
      line(x + 0.6, top + d, x + 0.6, gy, rgba(INK, 0.3), 1);
      if (q() < 0.4) { const cy = top + d + R(q, 8, hh * 0.6); line(x + 2, cy, x + cw * 0.6, cy + R(q, -2, 2), rgba(INK, 0.3), 1); }
    }
    mound(w, h, gy - 6, q, K.col, 0.5, 4);
    vFinish(w, h, it, C);
  }
  // Niedriger, gezackter Rücken mit einzelnen Glutadern
  function vRidge(w, h, q, C, p, it) {
    const K = vCols(C), pts = mound(w, h, 10, q, K.col, R(q, 0.3, 0.7), 14), sh = [];
    for (let k = 3; k < pts.length - 3; k += 2) sh.push([pts[k], pts[k + 1], [pts[k + 1][0], h], [pts[k][0] + 6, h]]);
    ctx.beginPath();
    sh.forEach(subPoly);
    ctx.fillStyle = rgba(K.dark, 0.35);
    ctx.fill();
    if (q() < 0.6) { const j = 4 + Math.floor(q() * (pts.length - 8)); let x = pts[j][0], y = pts[j][1] + 6; const v = [[x, y]]; for (let k = 0; k < 4; k++) { x += R(q, -6, 6); y += R(q, 6, 12); v.push([x, Math.min(h - 2, y)]); } glowLines([v], C, 0.8, 0.7); }
    vFinish(w, h, it, C);
  }

  SCENE['Lava'] = {
    hideLayers: [0],
    tracks: [
      {
        // an der Stelle der fernen Vulkankette (Ebene 0), hinter den zackigen Bergen der Ebene 1
        z: 1, factor: 0.2, start: 40, gap: [-40, 30], maxKs: 1.5,
        pick: flow(['volcano', 'ridge', 'obsidian', 'flow', 'bridge', 'shield', 'columns'], ['volcano', 'shield', 'obsidian', 'flow', 'bridge', 'columns', 'ridge', 'ridge', 'volcano'], 1401, null, { volcano: 3, bridge: 4 }),
        base: (i, q) => Math.round(R(q, 504, 512)),
        kinds: {
          volcano: kind(q => { const h = R(q, 330, 360); return { ch: h * R(q, 0.62, 0.72), w: R(q, 290, 356), h }; }, vVolcano),
          shield: kind(q => { const h = R(q, 230, 280); return { ch: h * R(q, 0.5, 0.58), w: R(q, 310, 356), h }; }, vShield),
          obsidian: kind(q => ({ n: 2 + Math.floor(q() * 3), w: R(q, 150, 240), h: R(q, 260, 330) }), vObsidian),
          flow: kind(q => ({ w: R(q, 270, 350), h: R(q, 180, 230) }), vFlow),
          bridge: kind(q => ({ w: R(q, 270, 345), h: R(q, 230, 290) }), vBridge),
          columns: kind(q => ({ n: 7 + Math.floor(q() * 6), w: R(q, 170, 260), h: R(q, 200, 270) }), vColumns),
          ridge: kind(q => ({ w: R(q, 200, 300), h: R(q, 140, 185) }), vRidge)
        }
      }
    ]
  };

  // ============================================================
  // WOLKEN: zwischen Wolkentürmen und Wolkenmeer schwebende Inseln mit Bäumen, Wolkenschlösser,
  // Himmelsbrücken, kleine Inselgruppen und Pavillons auf Wolkensäulen; davor Heißluftballons
  // ============================================================
  function wCols(C) {
    const hz = t => mix(t, C.skyBottom, 0.18);
    return {
      rock: hz(mix(C.pipe, C.far, 0.3)), meadow: hz(mix(mix('#a8d49c', C.far, 0.3), C.accent, 0.08)), leaf: hz(mix('#8cc49a', C.far, 0.3)),
      bloom: hz(mix(mix(C.accent, '#f0a0b8', 0.5), CREAM, 0.2)), stone: hz(mix(C.pipe, CREAM, 0.45)), roof: hz(mix(C.accent, C.pipe, 0.25)), roof2: hz(mix(C.pipe, C.far, 0.25)),
      cl: mix(C.near, '#ffffff', 0.6), cm: mix(C.near, C.far, 0.2), clow: mix(C.near, C.far, 0.65), shadowA: rgba(C.skyTop, 0.1), night: mix(C.pipe, C.skyTop, 0.45)
    };
  }
  // Wolkenfetzen um (x, y)
  function wWisp(x, y, s, q, K) {
    const pf = [];
    for (let k = 0; k < 5; k++) pf.push([x + (k - 2) * s * 0.9 + R(q, -2, 2), y + R(q, -s * 0.3, s * 0.2), s * R(q, 0.6, 1)]);
    puff(pf, y - s * 1.2, y + s, K.cl, K.cm, K.clow, null, 0.3);
  }
  // Runder Baum (Krone aus drei Ballen, Licht oben links)
  function wTree(x, y, r, col, K) {
    line(x, y, x, y - r * 0.9, mix(K.rock, INK, 0.3), Math.max(1.2, r * 0.18));
    const cy = y - r * 1.25, bl = [[x, cy, r], [x - r * 0.6, cy + r * 0.3, r * 0.68], [x + r * 0.6, cy + r * 0.28, r * 0.72]];
    blobPath(bl.map(([a, b, c]) => [a + r * 0.1, b + r * 0.12, c]));
    ctx.fillStyle = shade(col, -0.22);
    ctx.fill();
    blobPath(bl);
    ctx.fillStyle = vgrad(cy - r, cy + r, [[0, mix(col, CREAM, 0.3)], [1, shade(col, -0.08)]]);
    ctx.fill();
    dots([[x - r * 0.35, cy - r * 0.35, r * 0.4]], rgba(CREAM, 0.3));
  }
  // Felskegel einer schwebenden Insel mit Wiesenkappe; liefert die Oberkante
  function wRock(cx, topY, rw, depth, q, K) {
    const tip = [cx + rw * R(q, -0.1, 0.2), topY + depth], pts = [[cx - rw, topY]];
    for (let k = 1; k < 5; k++) { const t = k / 5; pts.push([lerp(cx - rw, tip[0], t) + R(q, -4, 2), topY + depth * Math.pow(t, 1.4) + R(q, -3, 3)]); }
    pts.push(tip);
    for (let k = 4; k >= 1; k--) { const t = k / 5; pts.push([lerp(cx + rw, tip[0], t) + R(q, -2, 4), topY + depth * Math.pow(t, 1.2) + R(q, -3, 3)]); }
    pts.push([cx + rw, topY]);
    poly(pts, vgrad(topY, topY + depth, [[0, mix(K.rock, CREAM, 0.25)], [1, shade(K.rock, -0.12)]]));
    poly([[cx + rw * 0.1, topY + 2], ...pts.slice(6)], rgba(K.night, 0.35));
    const st = [];
    for (let k = 1; k <= 3; k++) { const y = topY + depth * k * 0.2, f = 1 - Math.pow(k * 0.2, 1.3); st.push([cx - rw * f * 0.9, y, cx + rw * f * 0.9, y + R(q, -2, 2)]); }
    segs(st, rgba(K.night, 0.3), 0.9);
    ctx.beginPath();
    ctx.ellipse(cx, topY, rw + 2, Math.max(4, rw * 0.11), 0, 0, TAU);
    ctx.fillStyle = vgrad(topY - 6, topY + 6, [[0, mix(K.meadow, CREAM, 0.35)], [1, shade(K.meadow, -0.12)]]);
    ctx.fill();
  }
  // Schwebende Insel: Fels, Wiese, Bäume, manchmal Hütte und Wasserfall, Wolkenfetzen am Fels
  function wIsle(w, h, q, C, p) {
    const K = wCols(C), cx = w / 2, topY = h * 0.42, rw = w * 0.4, depth = h - topY - 10;
    if (p.fall) {
      const fx = cx + rw * 0.72;
      ctx.fillStyle = vgrad(topY, h - 4, [[0, rgba(CREAM, 0.7)], [1, rgba(CREAM, 0)]]);
      ctx.fillRect(fx - 2, topY, 4, h - 4 - topY);
    }
    wRock(cx, topY, rw, depth, q, K);
    const roots = [];
    for (let k = 0; k < 5; k++) { const x = cx + R(q, -0.6, 0.5) * rw, y = topY + depth * R(q, 0.2, 0.5); roots.push([x, y, x + R(q, -4, 4), y + R(q, 10, 24)]); }
    segs(roots, rgba(shade(K.leaf, -0.3), 0.5), 1);
    if (p.hut) {
      const hx = cx - rw * R(q, 0.15, 0.4), hw = rw * 0.28, hh = hw * 0.8;
      poly([[hx - hw / 2, topY], [hx - hw / 2, topY - hh], [hx + hw / 2, topY - hh], [hx + hw / 2, topY]], mix(K.stone, CREAM, 0.3));
      poly([[hx + hw * 0.1, topY], [hx + hw * 0.1, topY - hh], [hx + hw / 2, topY - hh], [hx + hw / 2, topY]], rgba(K.night, 0.3));
      poly([[hx - hw * 0.65, topY - hh], [hx, topY - hh - hw * 0.55], [hx + hw * 0.65, topY - hh]], K.roof);
      poly([[hx, topY - hh - hw * 0.55], [hx + hw * 0.65, topY - hh], [hx + hw * 0.1, topY - hh]], shade(K.roof, -0.15));
      ctx.fillStyle = rgba(INK, 0.35);
      ctx.fillRect(hx - hw * 0.3, topY - hh * 0.55, hw * 0.2, hh * 0.3);
    }
    const trees = [];
    for (let k = 0; k < p.trees; k++) trees.push([cx + R(q, -0.75, 0.75) * rw, R(q, 7, 12) * Math.min(1.3, w / 180), q() < 0.4 ? K.bloom : K.leaf]);
    trees.sort((a, b) => a[1] - b[1]);
    for (const [x, r, col] of trees) wTree(x, topY + 2, r, col, K);
    wWisp(cx - rw * 0.75, topY + depth * 0.32, rw * 0.13, q, K);
    wWisp(cx + rw * 0.45, topY + depth * 0.62, rw * 0.11, q, K);
    grain(w, h, 0.025);
  }
  // Wolkenschloss: Türme mit Kegeldächern, Mauer mit Zinnen, Tor, auf einer Wolkenbank
  function wCastle(w, h, q, C, p) {
    const K = wCols(C), baseY = h * 0.74, lit = mix(K.stone, '#ffffff', 0.35), side = mix(K.stone, K.night, 0.35);
    const towers = [[w * 0.5, w * R(q, 0.14, 0.18), baseY - h * R(q, 0.06, 0.12)]];
    for (let k = 0; k < p.n; k++) { const f = k % 2 ? 1 : -1, d = 0.16 + Math.floor(k / 2) * 0.17; towers.push([w * (0.5 + f * d) + R(q, -6, 6), w * R(q, 0.09, 0.12), baseY - h * R(q, 0.22, 0.4)]); }
    const wl = Math.min(...towers.map(t => t[0])), wr = Math.max(...towers.map(t => t[0])), wy = baseY - h * R(q, 0.12, 0.18);
    poly([[wl, baseY], [wl, wy], [wr, wy], [wr, baseY]], K.stone);
    const cren = [];
    for (let x = wl; x < wr - 4; x += 8) cren.push([[x, wy], [x, wy - 5], [x + 4.5, wy - 5], [x + 4.5, wy]]);
    ctx.beginPath();
    cren.forEach(subPoly);
    ctx.fillStyle = K.stone;
    ctx.fill();
    poly([[w * 0.5 - 7, baseY], [w * 0.5 - 7, baseY - 14], [w * 0.5, baseY - 19], [w * 0.5 + 7, baseY - 14], [w * 0.5 + 7, baseY]], rgba(K.night, 0.6));
    towers.sort((a, b) => a[2] - b[2]);
    towers.reverse();
    const wins = [];
    for (const [x, tw, top] of towers.slice().sort((a, b) => Math.abs(b[0] - w / 2) - Math.abs(a[0] - w / 2))) {
      const hw = tw / 2;
      poly([[x - hw, baseY], [x - hw, top], [x + hw * 0.2, top], [x + hw * 0.2, baseY]], lit);
      poly([[x + hw * 0.2, baseY], [x + hw * 0.2, top], [x + hw, top], [x + hw, baseY]], side);
      const rc = q() < 0.6 ? K.roof : K.roof2, rh = tw * R(q, 1, 1.4);
      poly([[x - hw * 1.2, top], [x, top - rh], [x + hw * 0.2, top]], mix(rc, CREAM, 0.15));
      poly([[x + hw * 0.2, top], [x, top - rh], [x + hw * 1.2, top]], shade(rc, -0.15));
      line(x, top - rh, x, top - rh - 8, mix(K.rock, INK, 0.3), 1);
      poly([[x, top - rh - 8], [x + 7, top - rh - 6], [x, top - rh - 4]], mix(C.accent, CREAM, 0.2));
      for (let y = top + tw * 0.6; y < baseY - 14; y += tw * 0.9) wins.push([x - hw * 0.3, y]);
    }
    ctx.beginPath();
    for (const [x, y] of wins) { ctx.moveTo(x - 1.6, y + 4); ctx.lineTo(x - 1.6, y); ctx.arc(x, y, 1.6, PI, TAU); ctx.lineTo(x + 1.6, y + 4); ctx.closePath(); }
    ctx.fillStyle = rgba(K.night, 0.75);
    ctx.fill();
    const pf = puffRow(w * 0.04, w * 0.96, baseY + 8, 14, 26, q, 10);
    for (let k = 0; k < 2; k++) pf.push([w * R(q, 0.25, 0.75), baseY + R(q, 8, 18), R(q, 16, 24)]);
    puff(pf, baseY - 20, h - 2, K.cl, K.cm, K.clow, K.shadowA);
    grain(w, h, 0.025);
  }
  // Himmelsbrücke: zwei Inselchen, dazwischen eine durchhängende Hängebrücke
  function wBridge(w, h, q, C, p) {
    const K = wCols(C), y1 = h * R(q, 0.34, 0.5), y2 = h * R(q, 0.34, 0.5), x1 = w * 0.16, x2 = w * 0.84, rw = w * 0.13;
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      wRock(x, y, rw, (h - y) * R(q, 0.6, 0.85), q, K);
      wTree(x + R(q, -0.4, 0.4) * rw, y + 2, R(q, 7, 10), q() < 0.5 ? K.bloom : K.leaf, K);
    }
    const ax = x1 + rw * 0.8, bx = x2 - rw * 0.8, ay = y1 - 2, by = y2 - 2, sag = (bx - ax) * R(q, 0.12, 0.2);
    const at = t => { const u = 1 - t; return [u * u * ax + 2 * u * t * (ax + bx) / 2 + t * t * bx, u * u * ay + 2 * u * t * ((ay + by) / 2 + sag) + t * t * by]; };
    const pl = [], hang = [], wood = mix(mix('#b08a6a', C.far, 0.35), CREAM, 0.1);
    for (let k = 0; k <= 16; k++) { const [x, y] = at(k / 16); pl.push([x - 1.8, y, x + 1.8, y]); hang.push([x, y, x, y - 10 + Math.sin(PI * k / 16) * 3]); }
    segs(hang, rgba(shade(wood, -0.3), 0.7), 0.8);
    ctx.beginPath();
    for (const off of [0, -11]) { for (let k = 0; k <= 16; k++) { const [x, y] = at(k / 16); const yy = y + off + (off ? Math.sin(PI * k / 16) * 3 : 0); if (k) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); } }
    ctx.strokeStyle = shade(wood, -0.3);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    segs(pl, wood, 2.6);
    for (const [x, y] of [[x1, y1], [x2, y2]]) wWisp(x - rw * 0.2, y + (h - y) * 0.35, rw * 0.17, q, K);
    grain(w, h, 0.025);
  }
  // Kleine Inselgruppe: drei bis fünf Felsbrocken mit je einem Baum oder Busch
  function wArchi(w, h, q, C, p) {
    const K = wCols(C), list = [];
    for (let k = 0; k < p.n; k++) list.push([w * (0.14 + 0.72 * k / Math.max(1, p.n - 1)) + R(q, -8, 8), h * R(q, 0.3, 0.62), w * R(q, 0.06, 0.1)]);
    for (const [x, y, rw] of list) {
      wRock(x, y, rw, Math.min(h - y - 6, rw * R(q, 1.2, 1.8)), q, K);
      if (q() < 0.75) wTree(x + R(q, -0.3, 0.3) * rw, y + 2, rw * R(q, 0.5, 0.75), q() < 0.4 ? K.bloom : K.leaf, K);
    }
    wWisp(w * R(q, 0.3, 0.7), h * 0.75, w * 0.04, q, K);
    grain(w, h, 0.025);
  }
  // Pavillon: kleiner Rundtempel auf einer hohen Wolkensäule
  function wPavilion(w, h, q, C, p) {
    const K = wCols(C), cx = w / 2, ty = h * 0.3, pf = [];
    for (let y = ty + 12; y < h - 14; y += 17) {
      const t = (y - ty) / (h - ty), r = Math.min(w * (0.22 + t * 0.1), (h - 3 - y) * 0.9);
      pf.push([cx + R(q, -6, 6) - r * 0.4, y, r * R(q, 0.75, 0.95)], [cx + R(q, -6, 6) + r * 0.4, Math.min(y + 5, h - 3 - r), r * R(q, 0.75, 0.95)]);
    }
    puff(pf, ty, h - 4, K.cl, K.cm, K.clow);
    const rw = w * 0.26, colH = w * 0.32, lit = mix(K.stone, '#ffffff', 0.4), side = mix(K.stone, K.night, 0.35);
    ellipse(cx, ty + 4, rw + 4, 5, 0, side);
    ellipse(cx, ty + 2, rw + 4, 4.5, 0, lit);
    const cols = [];
    for (let k = 0; k < 5; k++) { const x = cx - rw + k * rw / 2; cols.push([[x - 2.2, ty], [x - 2.2, ty - colH], [x + 2.2, ty - colH], [x + 2.2, ty]]); }
    ctx.beginPath();
    cols.forEach(subPoly);
    ctx.fillStyle = lit;
    ctx.fill();
    ctx.fillStyle = rgba(K.night, 0.35);
    for (const c of cols) ctx.fillRect(c[0][0] + 2.6, c[1][1], 1.8, colH);
    ellipse(cx, ty - colH, rw + 6, 4, 0, side);
    ctx.beginPath();
    ctx.ellipse(cx, ty - colH - 2, rw + 2, rw * 0.85, 0, PI, TAU);
    ctx.closePath();
    ctx.fillStyle = vgrad(ty - colH - rw, ty - colH, [[0, mix(K.roof, CREAM, 0.25)], [1, K.roof]]);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, ty - colH - 2, rw + 2, rw * 0.85, 0, PI * 1.62, TAU);
    ctx.lineTo(cx, ty - colH - 2);
    ctx.closePath();
    ctx.fillStyle = rgba(K.night, 0.28);
    ctx.fill();
    circle(cx, ty - colH - rw * 0.85 - 4, 2.6, mix(C.accent, CREAM, 0.3));
    grain(w, h, 0.025);
  }
  // Heißluftballon: Hülle mit Bahnen, Kugelschatten aus dem Vorrat, Seile, Korb
  function wBalloon(x, y, r, q, C, K) {
    const yb = y + r * 1.22, m = r * 0.3, cols = [[C.accent, CREAM], [C.pipe, CREAM], [C.accent, C.pipe], [mix(C.accent, '#f08aa0', 0.5), CREAM]][Math.floor(q() * 4)];
    const env = () => {
      ctx.beginPath();
      ctx.moveTo(x - m, yb);
      ctx.bezierCurveTo(x - r * 1.28, y + r * 0.5, x - r * 1.18, y - r * 1.02, x, y - r);
      ctx.bezierCurveTo(x + r * 1.18, y - r * 1.02, x + r * 1.28, y + r * 0.5, x + m, yb);
      ctx.closePath();
    };
    env();
    ctx.fillStyle = mix(cols[0], C.skyBottom, 0.12);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    for (let k = -3; k < 3; k += 2) {
      const s0 = Math.sin(k * PI / 8), s1 = Math.sin((k + 1) * PI / 8);
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x + r * 1.35 * s0, y - r * 0.2, x + m * s0, yb);
      ctx.lineTo(x + m * s1, yb);
      ctx.quadraticCurveTo(x + r * 1.35 * s1, y - r * 0.2, x, y - r);
    }
    ctx.fillStyle = mix(cols[1], C.skyBottom, 0.12);
    ctx.fill();
    stamp(overlaySprite(K.night, 0.3, '', 0), x - r * 1.15, y - r * 1.05, r * 2.3, r * 2.35);
    ctx.restore();
    const bw = r * 0.32, by = yb + r * 0.45;
    segs([[x - m, yb, x - bw * 0.8, by], [x + m, yb, x + bw * 0.8, by], [x - m * 0.3, yb, x - bw * 0.3, by], [x + m * 0.3, yb, x + bw * 0.3, by]], rgba(mix(K.rock, INK, 0.4), 0.7), 0.7);
    poly([[x - bw, by], [x + bw, by], [x + bw * 0.85, by + bw * 1.1], [x - bw * 0.85, by + bw * 1.1]], mix(mix('#b08a6a', C.far, 0.3), CREAM, 0.1));
    poly([[x + bw * 0.2, by], [x + bw, by], [x + bw * 0.85, by + bw * 1.1], [x + bw * 0.15, by + bw * 1.1]], rgba(K.night, 0.35));
  }
  function wBalloons(w, h, q, C, p) {
    const K = wCols(C);
    if (p.pair) {
      const r2 = w * 0.16;
      wBalloon(w * 0.7, h * 0.22 + r2, r2, q, C, K);
      const r1 = w * 0.22;
      wBalloon(w * 0.32, h - r1 * 1.95 - 4, r1, q, C, K);
    } else {
      const r = w * 0.4;
      wBalloon(w / 2, r + 4, r, q, C, K);
    }
    grain(w, h, 0.02);
  }

  SCENE['Wolken'] = {
    tracks: [
      {
        // zwischen den fernen Wolkentürmen (Ebene 0) und dem Wolkenmeer mit Ruinen (Ebene 1)
        z: 1, factor: 0.32, start: 200, gap: [50, 150], maxKs: 2,
        pick: flow(['isle', 'castle', 'bridge', 'archi', 'pavilion'], ['isle', 'castle', 'bridge', 'archi', 'pavilion', 'isle'], 201, null, { castle: 3 }),
        base: midBase({ isle: [200, 290], castle: [270, 330], bridge: [210, 290], archi: [200, 280], pavilion: [300, 345] }),
        kinds: {
          isle: kind(q => ({ trees: 2 + Math.floor(q() * 4), hut: q() < 0.4, fall: q() < 0.5, w: R(q, 130, 220), h: R(q, 130, 190) }), wIsle),
          castle: kind(q => ({ n: 2 + Math.floor(q() * 3), w: R(q, 220, 320), h: R(q, 200, 270) }), wCastle),
          bridge: kind(q => ({ w: R(q, 260, 340), h: R(q, 120, 170) }), wBridge),
          archi: kind(q => ({ n: 3 + Math.floor(q() * 3), w: R(q, 190, 280), h: R(q, 120, 180) }), wArchi),
          pavilion: kind(q => ({ w: R(q, 110, 160), h: R(q, 210, 280) }), wPavilion)
        }
      },
      {
        // Heißluftballons (ruhend), etwas näher, sparsam
        z: 1, factor: 0.42, start: 560, gap: [80, 200], maxKs: 2,
        pick: flow(['balloon', 'pause', 'pair'], ['balloon', 'pair', 'balloon'], 202, 'pause'),
        base: midBase({ balloon: [90, 290], pair: [110, 280], pause: [200, 300] }),
        kinds: {
          balloon: kind(q => { const w = R(q, 40, 62); return { w, h: w * 1.62 + 10 }; }, wBalloons),
          pair: kind(q => { const w = R(q, 100, 140); return { pair: true, w, h: w * 1.15 }; }, wBalloons),
          pause: pause(300, 700)
        }
      }
    ]
  };

  // Der statische Planet im Himmel weicht den wandernden Planeten der Kulisse
  {
    const L = LEVELS.find(x => x.name === 'Weltraum');
    if (L) L.sky = Object.assign({}, L.sky, { body: 'none' });
  }
})();

