// ============================================================
// Boden und Decke: Streifen, die sich mit den Hindernissen bewegen
// ============================================================
const GROUND_P = 1200;

function buildGround(li, ks) {
  const L = LEVELS[li], C = COLORS[li];
  return makeStrip(GROUND_P, GROUND_Y - 18, H, ks, () => paintGround(L, C, mulberry32(li * 313 + 5)), { mottle: 0.2, grain: 0.08, seed: li * 17 + 3, contrast: 1.15 });
}

function buildCeiling(li, ks) {
  const C = COLORS[li];
  return makeStrip(GROUND_P, -2, 44, ks, () => paintCeiling(C, mulberry32(li * 71 + 9)), { mottle: 0.22, grain: 0.08, seed: li * 5 + 1 });
}

// Kieselsteine mit Licht oben links und Schatten unten rechts
function pebbles(list, base) {
  ellipses(list.map(([x, y, rx, ry]) => [x + 0.8, y + 0.9, rx, ry, 0]), rgba(INK, 0.35));
  ellipses(list.map(([x, y, rx, ry]) => [x, y, rx, ry, 0]), base);
  ellipses(list.map(([x, y, rx, ry]) => [x - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.35, 0]), rgba(CREAM, 0.28));
}

function paintGround(L, C, rng) {
  const P = GROUND_P, y = GROUND_Y, gh = H - y + 4;
  const band = (col, y0, h) => { ctx.fillStyle = col; ctx.fillRect(-8, y0, P + 16, h); };
  const rp = n => { const a = []; for (let k = 0; k < n; k++) a.push(rng()); return a; };
  switch (L.style.ground) {
    case 'grass': {
      const soil = mix(shade(C.near, -0.5), '#7a5332', 0.5);
      band(vgrad(y, H, [[0, shade(soil, 0.1)], [1, shade(soil, -0.3)]]), y + 4, gh);
      for (let k = 0; k < 3; k++) {
        const yy = y + 20 + k * 12;
        ctx.beginPath();
        ctx.moveTo(-8, yy);
        for (let x = -8; x <= P + 8; x += 16) ctx.lineTo(x, yy + Math.sin(x * 0.02 + k * 2) * 3);
        ctx.strokeStyle = rgba(k % 2 ? shade(soil, -0.25) : shade(soil, 0.12), 0.45);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const pb = [];
      for (let k = 0; k < P / 10; k++) pb.push([rng() * P, y + 16 + rng() * 40, 1.5 + rng() * 3.5, 1.2 + rng() * 2]);
      pebbles(pb, mix(soil, '#b8a48a', 0.45));
      const roots = [];
      for (let k = 0; k < P / 30; k++) { const x = rng() * P, yy = y + 12 + rng() * 10; roots.push([x, yy, x + (rng() - 0.5) * 16, yy + 6 + rng() * 10]); }
      segs(roots, rgba(shade(soil, -0.35), 0.6), 1);
      band(vgrad(y - 2, y + 13, [[0, shade(C.near, 0.12)], [1, shade(C.near, -0.15)]]), y - 1, 13);
      band(rgba(INK, 0.22), y + 11, 3);
      const tones = [shade(C.near, 0.22), C.near, shade(C.near, -0.18)];
      for (let t = 0; t < 3; t++) {
        ctx.beginPath();
        for (let x = -6 + t * 2; x < P + 8; x += 3.2 + rng() * 2) {
          const hgt = 4 + rng() * 9, lean = (rng() - 0.4) * 3;
          ctx.moveTo(x - 1.6, y + 2);
          ctx.lineTo(x + lean, y + 1 - hgt);
          ctx.lineTo(x + 1.6, y + 2);
        }
        ctx.fillStyle = tones[t];
        ctx.fill();
      }
      const fl = [[], [], []], fc = [CREAM, C.accent, mix(C.accent, '#e86f8a', 0.6)];
      for (let k = 0; k < P / 26; k++) fl[k % 3].push([rng() * P, y - 3 - rng() * 6, 1.3 + rng() * 0.8]);
      fl.forEach((f, j) => dots(f, fc[j]));
      break;
    }
    case 'snow': {
      const soil = mix(mix(C.pipe, C.far, 0.5), INK, 0.35);
      band(vgrad(y, H, [[0, soil], [1, shade(soil, -0.3)]]), y + 6, gh);
      const cr = [];
      for (let k = 0; k < P / 40; k++) { const x = rng() * P, yy = y + 20 + rng() * 30; cr.push([x, yy, x + 10 + rng() * 10, yy + 4 + rng() * 8]); }
      segs(cr, rgba(CREAM, 0.18), 1);
      band(rgba(mix(C.pipe, CREAM, 0.4), 0.55), y + 12, 4);
      const snow = mix(CREAM, '#ffffff', 0.4), snowS = mix(CREAM, C.skyTop, 0.4);
      const mounds = [];
      for (let x = -10; x < P + 10; x += 10 + rng() * 10) mounds.push([x, y + 4 + rng() * 3, 7 + rng() * 6]);
      const wrapM = mounds.concat(mounds.filter(m => m[0] < 20).map(m => [m[0] + P, m[1], m[2]]), mounds.filter(m => m[0] > P - 20).map(m => [m[0] - P, m[1], m[2]]));
      ctx.save();
      ctx.beginPath();
      ctx.rect(-10, y - 20, P + 20, 34);
      ctx.clip();
      blobPath(wrapM.map(([a, b, c]) => [a + 2, b + 2, c]));
      ctx.fillStyle = snowS;
      ctx.fill();
      blobPath(wrapM);
      ctx.fillStyle = vgrad(y - 8, y + 12, [[0, snow], [1, mix(snow, snowS, 0.5)]]);
      ctx.fill();
      ctx.restore();
      band(vgrad(y + 8, y + 14, [[0, snow], [1, snowS]]), y + 6, 7);
      const sp = [];
      for (let k = 0; k < P / 5; k++) sp.push([rng() * P, y - 4 + rng() * 16, 0.5 + rng() * 0.5]);
      dots(sp, rgba('#ffffff', 0.8));
      const gl = [];
      for (let k = 0; k < P / 120; k++) { const x = rng() * P, yy = y - 2 + rng() * 10; gl.push([x - 3, yy, x + 3, yy], [x, yy - 3, x, yy + 3]); }
      segs(gl, rgba('#ffffff', 0.6), 0.6);
      break;
    }
    case 'lavarock': {
      const rock = shade(C.near, -0.15);
      band(vgrad(y, H, [[0, shade(rock, 0.12)], [1, shade(rock, -0.35)]]), y, gh);
      // erkaltete Krustenplatten, dazwischen glühende Fugen
      const rows = [y + 3, y + 19, y + 36, H + 4], seams = [];
      for (let ri = 0; ri < rows.length - 1; ri++) {
        const y0 = rows[ri], y1 = rows[ri + 1];
        let x = rng() * 30;
        while (x < P + 40) {
          const w2 = 34 + rng() * 46, x0 = x, x1 = x + w2, j = () => (rng() - 0.5) * 6;
          const plate = [[x0 + 2 + j(), y0 + 2], [x1 - 2 + j(), y0 + 2 + j() * 0.3], [x1 - 2 + j(), y1 - 2], [x0 + 2 + j(), y1 - 2 + j() * 0.3]];
          for (const shift of [0, -P]) {
            const pl = plate.map(([a, b]) => [a + shift, b]);
            poly(pl, vgrad(y0, y1, [[0, shade(rock, 0.18 - ri * 0.06)], [1, shade(rock, -0.05 - ri * 0.08)]]));
            line(pl[0][0], pl[0][1] + 0.6, pl[1][0], pl[1][1] + 0.6, rgba(CREAM, 0.12), 1);
          }
          seams.push([x1, y0, x1 + (rng() - 0.5) * 8, y1]);
          x = x1;
        }
        seams.push([-8, y1, P + 8, y1]);
      }
      const hot = seams.filter(() => rng() < 0.55);
      for (const [lw, c] of [[7, rgba(C.accent, 0.14)], [2.2, rgba(C.accent, 0.6)], [0.9, rgba(C.accentLight, 0.75)]]) segs(hot, c, lw);
      for (let k = 0; k < P / 260; k++) {
        const x = rng() * P, yy = y + 28 + rng() * 14, rx = 16 + rng() * 14;
        ellipse(x, yy, rx + 4, 6, 0, rgba(INK, 0.45));
        ellipse(x, yy, rx, 4.5, 0, rgrad(x, yy, 0, rx, [[0, C.accentLight], [0.6, C.accent], [1, shade(C.accent, -0.4)]]));
      }
      const crust = [];
      for (let x = -8; x < P + 8; x += 5 + rng() * 6) crust.push([x, y - rng() * 4]);
      ctx.beginPath();
      ctx.moveTo(-8, y + 6);
      crust.forEach(([a, b]) => ctx.lineTo(a, b));
      ctx.lineTo(P + 8, y + 6);
      ctx.closePath();
      ctx.fillStyle = shade(rock, 0.14);
      ctx.fill();
      ctx.beginPath();
      crust.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.strokeStyle = rgba(C.accent, 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }
    case 'jungle': {
      const soil = mix(mix(C.pipe, C.near, 0.5), INK, 0.35);
      band(vgrad(y, H, [[0, shade(soil, 0.1)], [1, shade(soil, -0.35)]]), y + 4, gh);
      const lit = [[], [], [], []], lc = [mix(C.accent, C.near, 0.3), shade(C.near, 0.15), mix(C.pipe, '#9a6a3a', 0.4), mix(C.accent, '#d3b24a', 0.4)];
      for (let k = 0; k < P / 3; k++) lit[k % 4].push([rng() * P, y + 8 + rng() * 46, 2.5 + rng() * 2.5, 1 + rng() * 0.8, rng() * TAU]);
      lit.forEach((L2, j) => ellipses(L2, rgba(lc[j], 0.55)));
      for (let k = 0; k < P / 80; k++) {
        const x = rng() * P, w2 = 30 + rng() * 40;
        ctx.strokeStyle = mix(C.pipe, INK, 0.25);
        ctx.lineWidth = 3 + rng() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        ctx.quadraticCurveTo(x + w2 * 0.5, y + 18 + rng() * 14, x + w2, y + 8);
        ctx.stroke();
      }
      const moss = [];
      for (let x = -8; x < P + 8; x += 5 + rng() * 5) moss.push([x, y + 3 + rng() * 2, 4 + rng() * 4]);
      blobPath(moss);
      ctx.fillStyle = vgrad(y - 6, y + 10, [[0, mix(C.near, C.accent, 0.35)], [1, shade(C.near, -0.1)]]);
      ctx.fill();
      dots(moss.map(([a, b, c]) => [a - c * 0.3, b - c * 0.4, c * 0.4]), rgba(C.accent, 0.35));
      break;
    }
    case 'sand': {
      const sand = mix(C.far, C.near, 0.4);
      band(vgrad(y, H, [[0, shade(sand, 0.1)], [1, shade(sand, -0.18)]]), y, gh);
      for (let r = 0; r < 7; r++) {
        const yy = y + 8 + r * 7;
        ctx.beginPath();
        for (let x = -8; x <= P + 8; x += 6) {
          const w2 = yy + Math.sin(x * 0.04 + r * 1.3) * 2.2 + Math.sin(x * 0.011 + r) * 2;
          if (x === -8) ctx.moveTo(x, w2); else ctx.lineTo(x, w2);
        }
        ctx.strokeStyle = rgba(shade(sand, -0.22), 0.35);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.translate(0, -1.2);
        ctx.strokeStyle = rgba(CREAM, 0.22);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.translate(0, 1.2);
      }
      const pb = [];
      for (let k = 0; k < P / 30; k++) pb.push([rng() * P, y + 10 + rng() * 40, 1 + rng() * 2.2, 0.8 + rng() * 1.4]);
      pebbles(pb, mix(sand, C.accent, 0.3));
      band(rgba(CREAM, 0.3), y, 2);
      const gr = [];
      for (let k = 0; k < P / 2; k++) gr.push([rng() * P, y + rng() * 50, 0.45]);
      dots(gr, rgba(shade(sand, -0.3), 0.35));
      break;
    }
    case 'seabed': {
      const sand = mix(CREAM, C.far, 0.45);
      band(vgrad(y, H, [[0, shade(sand, 0.05)], [1, shade(sand, -0.3)]]), y, gh);
      for (let r = 0; r < 5; r++) {
        const yy = y + 12 + r * 9;
        ctx.beginPath();
        for (let x = -8; x <= P + 8; x += 6) { const w2 = yy + Math.sin(x * 0.06 + r) * 1.8; if (x === -8) ctx.moveTo(x, w2); else ctx.lineTo(x, w2); }
        ctx.strokeStyle = rgba(shade(sand, -0.2), 0.35);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      for (let k = 0; k < P / 40; k++) {
        const x = rng() * P, yy = y + 14 + rng() * 32, s = 3 + rng() * 2.5;
        ctx.save();
        ctx.translate(x, yy);
        ctx.rotate((rng() - 0.5) * 0.8);
        ctx.beginPath();
        ctx.moveTo(0, s * 0.5);
        ctx.arc(0, s * 0.5, s, Math.PI * 1.1, Math.PI * 1.9);
        ctx.closePath();
        ctx.fillStyle = mix(C.pipe, CREAM, 0.45);
        ctx.fill();
        const rays = [];
        for (let a = 1.2; a < 1.85; a += 0.16) rays.push([0, s * 0.5, Math.cos(a * Math.PI) * s, s * 0.5 + Math.sin(a * Math.PI) * s]);
        segs(rays, rgba(shade(C.pipe, -0.3), 0.5), 0.6);
        ctx.restore();
      }
      const pb = [];
      for (let k = 0; k < P / 16; k++) pb.push([rng() * P, y + 8 + rng() * 44, 1.2 + rng() * 2.5, 1 + rng() * 1.5]);
      pebbles(pb, mix(sand, C.far, 0.35));
      const gr = [];
      for (let x = 0; x < P; x += 10 + rng() * 30) for (let k = -2; k <= 2; k++) gr.push([x + k * 2, y + 2, x + k * 3 + (rng() - 0.5) * 3, y - 4 - rng() * 9]);
      segs(gr, mix(C.accent, C.near, 0.45), 1.2);
      band(rgba(CREAM, 0.25), y, 1.5);
      break;
    }
    case 'wetrock': {
      const rock = shade(C.near, -0.1);
      band(vgrad(y, H, [[0, shade(rock, 0.1)], [1, shade(rock, -0.35)]]), y, gh);
      const cr = [];
      for (let k = 0; k < P / 20; k++) { const x = rng() * P, yy = y + 6 + rng() * 44; cr.push([x, yy, x + 6 + rng() * 12, yy + (rng() - 0.5) * 8]); }
      segs(cr, rgba(INK, 0.35), 1);
      for (let k = 0; k < P / 70; k++) {
        const x = rng() * P, yy = y + 16 + rng() * 28, rx = 14 + rng() * 22;
        ellipse(x, yy, rx + 2, 4.5, 0, rgba(INK, 0.35));
        ellipse(x, yy, rx, 3.4, 0, hgrad(x - rx, x + rx, [[0, rgba(C.skyBottom, 0.5)], [0.5, rgba(mix(C.skyBottom, CREAM, 0.3), 0.6)], [1, rgba(C.skyBottom, 0.3)]]));
        line(x - rx * 0.6, yy - 1, x + rx * 0.2, yy - 1, rgba(CREAM, 0.35), 0.8);
      }
      const edge = [];
      for (let x = -8; x < P + 8; x += 6 + rng() * 8) edge.push([x, y - rng() * 4]);
      ctx.beginPath();
      ctx.moveTo(-8, y + 6);
      edge.forEach(([a, b]) => ctx.lineTo(a, b));
      ctx.lineTo(P + 8, y + 6);
      ctx.closePath();
      ctx.fillStyle = shade(rock, 0.08);
      ctx.fill();
      ctx.beginPath();
      edge.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.strokeStyle = rgba(C.accent, 0.25);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const moss = [];
      for (let k = 0; k < P / 30; k++) moss.push([rng() * P, y + 1 + rng() * 3, 3 + rng() * 5, 1.5 + rng(), 0]);
      ellipses(moss, rgba(mix(C.near, '#6f8a4a', 0.5), 0.6));
      break;
    }
    case 'cavefloor': {
      const rock = shade(C.near, -0.05);
      band(vgrad(y, H, [[0, shade(rock, 0.1)], [1, shade(rock, -0.4)]]), y, gh);
      const pb = [];
      for (let k = 0; k < P / 9; k++) pb.push([rng() * P, y + 8 + rng() * 46, 1.5 + rng() * 4, 1.2 + rng() * 2.5]);
      pebbles(pb, mix(rock, C.far, 0.6));
      const sp = [];
      for (let k = 0; k < P / 6; k++) sp.push([rng() * P, y + 4 + rng() * 50, 0.5 + rng() * 0.6]);
      dots(sp, rgba(C.accent, 0.35));
      for (let k = 0; k < P / 90; k++) {
        const x = rng() * P;
        ctx.fillStyle = rgrad(x, y, 0, 22, [[0, rgba(C.accent, 0.3)], [1, rgba(C.accent, 0)]]);
        ctx.fillRect(x - 22, y - 22, 44, 30);
        for (const [dx, hh, a] of [[-3, 8, -0.3], [2, 12, 0.1], [6, 6, 0.4]]) {
          ctx.save();
          ctx.translate(x + dx, y + 2);
          ctx.rotate(a);
          poly([[-2, 0], [-2, -hh * 0.75], [0, -hh], [2, -hh * 0.75], [2, 0]], mix(C.accent, CREAM, 0.2));
          poly([[0, 0], [0, -hh], [2, -hh * 0.75], [2, 0]], mix(C.accent, C.near, 0.35));
          ctx.restore();
        }
      }
      band(rgba(CREAM, 0.08), y, 2);
      break;
    }
    case 'street': {
      const asph = mix(INK, C.near, 0.55);
      band(vgrad(y, H, [[0, shade(asph, 0.08)], [1, shade(asph, -0.3)]]), y, gh);
      const refl = [];
      for (let k = 0; k < P / 12; k++) refl.push([rng() * P, rng() < 0.5 ? C.pipe : C.accent, 2 + rng() * 5, 14 + rng() * 30]);
      for (const [x, c, w2, h2b] of refl) { ctx.fillStyle = vgrad(y + 8, y + 8 + h2b, [[0, rgba(c, 0.22)], [1, rgba(c, 0)]]); ctx.fillRect(x, y + 8, w2, h2b); }
      ctx.fillStyle = rgba(mix(C.accent, CREAM, 0.2), 0.55);
      for (let x = 0; x < P; x += 60) ctx.fillRect(x, y + 32, 28, 2.5);
      for (let k = 0; k < P / 160; k++) {
        const x = rng() * P;
        ellipse(x, y + 46, 12, 3, 0, rgba(INK, 0.5));
        ellipse(x, y + 45.5, 10, 2.2, 0, rgba(shade(asph, 0.15), 0.9));
      }
      band(vgrad(y, y + 7, [[0, mix(asph, CREAM, 0.25)], [1, shade(asph, 0.05)]]), y, 7);
      band(rgba(C.pipe, 0.5), y, 1.5);
      const gr = [];
      for (let k = 0; k < P / 2; k++) gr.push([rng() * P, y + 8 + rng() * 48, 0.4]);
      dots(gr, rgba(CREAM, 0.12));
      break;
    }
    case 'deck': {
      const metal = mix(C.pipe, INK, 0.5);
      band(vgrad(y, H, [[0, metal], [1, shade(metal, -0.3)]]), y, gh);
      for (let x = 0; x < P; x += 48) {
        ctx.fillStyle = rgba(CREAM, 0.06);
        ctx.fillRect(x + 2, y + 14, 44, 2);
        ctx.fillStyle = rgba(INK, 0.35);
        ctx.fillRect(x, y + 12, 2, gh);
        const rv = [[x + 7, y + 20, 1.3], [x + 41, y + 20, 1.3], [x + 7, y + 48, 1.3], [x + 41, y + 48, 1.3]];
        dots(rv.map(([a, b, c]) => [a + 0.5, b + 0.5, c]), rgba(INK, 0.5));
        dots(rv, rgba(CREAM, 0.35));
      }
      band(INK, y, 10);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-8, y + 1, P + 16, 8);
      ctx.clip();
      ctx.beginPath();
      for (let x = -16; x < P + 16; x += 16) { ctx.moveTo(x, y + 10); ctx.lineTo(x + 8, y + 10); ctx.lineTo(x + 16, y); ctx.lineTo(x + 8, y); ctx.closePath(); }
      ctx.fillStyle = C.accent;
      ctx.fill();
      ctx.restore();
      band(rgba(CREAM, 0.35), y + 10, 1.2);
      for (let x = 24; x < P; x += 96) {
        ctx.fillStyle = rgrad(x, y + 30, 0, 16, [[0, rgba(C.pipe, 0.35)], [1, rgba(C.pipe, 0)]]);
        ctx.fillRect(x - 16, y + 14, 32, 32);
        ctx.fillStyle = mix(C.pipe, CREAM, 0.4);
        ctx.fillRect(x - 6, y + 29, 12, 2);
      }
      break;
    }
    default: if (ART2.ground[L.style.ground]) ART2.ground[L.style.ground](P, y, C, rng, band, L);
  }
  band(rgba(CREAM, 0.1), y, 1);
}

function paintCeiling(C, rng) {
  const P = GROUND_P, col = shade(C.near, -0.1), lit = shade(col, 0.15);
  const edge = [];
  for (let x = -8; x <= P + 8; x += 6) edge.push([x, 10 + pnoise(x / P * 48, 48, 3) * 10]);
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  edge.forEach(([a, b]) => ctx.lineTo(a, b));
  ctx.lineTo(P + 8, -4);
  ctx.closePath();
  ctx.fillStyle = vgrad(0, 22, [[0, shade(col, -0.3)], [1, col]]);
  ctx.fill();
  for (let x = 6; x < P; x += 12 + rng() * 18) {
    const yy = 10 + pnoise(x / P * 48, 48, 3) * 10 - 2, len = 6 + rng() * 16, hw = 3 + rng() * 4;
    wrapEach(x, P, hw + 2, xx => {
      poly([[xx - hw, yy], [xx + 0.5, yy + len], [xx + 0.5, yy]], lit);
      poly([[xx + 0.5, yy], [xx + 0.5, yy + len], [xx + hw, yy]], shade(col, -0.25));
    });
  }
  ctx.beginPath();
  edge.forEach(([a, b], j) => (j ? ctx.lineTo(a, b + 1) : ctx.moveTo(a, b + 1)));
  ctx.strokeStyle = rgba(C.accent, 0.12);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

