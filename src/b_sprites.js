// ============================================================
// Sprites: Säulen, Biom-Tore und Vogel, einmal pro Auflösung gemalt
// ============================================================
const PIPE_PAD = 16;
const PW = CONFIG.PIPE_WIDTH, PCH = CONFIG.PIPE_CAP_H, PCO = CONFIG.PIPE_CAP_OVERHANG;

function buildPipeSprites(li, ks) {
  const L = LEVELS[li], C = COLORS[li], st = L.style.pipe, bodyH = GROUND_Y + 40;
  const tex = v => ({ mottle: 0.2, grain: 0.07, seed: li * 11 + v, contrast: 1.25, cells: 3 });
  const bodies = [0, 1].map(v => makeSprite(-PIPE_PAD, 0, PW + PIPE_PAD * 2, bodyH, ks, () => paintPipeBody(st, C, bodyH, v), tex(v)));
  const capTop = makeSprite(-PIPE_PAD, -12, PW + PIPE_PAD * 2, PCH + 24, ks, () => paintPipeCap(st, C, 'down'), tex(5));
  const capBot = makeSprite(-PIPE_PAD, -12, PW + PIPE_PAD * 2, PCH + 24, ks, () => paintPipeCap(st, C, 'up'), tex(6));
  return { bodies, capTop, capBot, bodyH, sprites: [...bodies, capTop, capBot] };
}

function columnBase(h, front, side, light) {
  ctx.fillStyle = hgrad(0, PW, [[0, light], [0.13, front], [0.6, front], [0.74, side], [1, shade(side, -0.14)]]);
  ctx.fillRect(0, 0, PW, h);
  ctx.fillStyle = rgba(CREAM, 0.16);
  ctx.fillRect(0, 0, 1.2, h);
  ctx.fillStyle = rgba(INK, 0.25);
  ctx.fillRect(PW - 1.2, 0, 1.2, h);
}

function wavyLines(r, n, x0, x1, h, col, lw, wob) {
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const x = lerp(x0, x1, (k + 0.5) / n) + (r() - 0.5) * 3;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 24) ctx.lineTo(x + Math.sin(y * 0.02 + k * 1.7) * wob, y);
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function paintPipeBody(st, C, h, v) {
  const r = mulberry32(st.length * 977 + v * 31 + 3);
  switch (st) {
    case 'stem': {
      columnBase(h, C.pipe, C.pipeSide, C.pipeLight);
      wavyLines(r, 7, 3, 44, h, rgba(C.pipeLight, 0.3), 1, 1.2);
      wavyLines(r, 5, 8, 54, h, rgba(C.pipeDark, 0.25), 1, 1);
      for (let y = 30 + v * 26, k = 0; y < h; y += 70, k++) {
        ctx.fillStyle = rgba(C.pipeDark, 0.45);
        ctx.fillRect(0, y - 2, PW, 4);
        ctx.fillStyle = rgba(C.pipeLight, 0.45);
        ctx.fillRect(0, y - 4.5, PW, 1.5);
        const side = (k + v) % 2 ? 1 : -1, x0 = side < 0 ? 2 : PW - 2;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(x0 + side * 6, y - 14, x0 + side * 16, y - 18, x0 + side * 15, y - 26);
        ctx.bezierCurveTo(x0 + side * 4, y - 22, x0 - side * 1, y - 10, x0, y);
        ctx.fillStyle = hgrad(x0, x0 + side * 16, [[0, C.pipeSide], [1, side < 0 ? C.pipeLight : C.pipe]]);
        ctx.fill();
        line(x0, y - 1, x0 + side * 13, y - 22, rgba(C.pipeDark, 0.5), 0.8);
      }
      break;
    }
    case 'ice': {
      const ice = C.pipe;
      ctx.fillStyle = hgrad(0, PW, [[0, mix(ice, '#ffffff', 0.55)], [0.14, mix(ice, CREAM, 0.15)], [0.58, ice], [0.74, shade(ice, -0.16)], [1, shade(ice, -0.28)]]);
      ctx.fillRect(0, 0, PW, h);
      for (let k = 0; k < 5; k++) {
        const x = 8 + r() * 38, w2 = 3 + r() * 6;
        ctx.fillStyle = hgrad(x, x + w2, [[0, rgba('#ffffff', 0)], [0.5, rgba('#ffffff', 0.16)], [1, rgba('#ffffff', 0)]]);
        ctx.fillRect(x, 0, w2, h);
      }
      const cr = [];
      for (let k = 0; k < h / 40; k++) {
        let x = 10 + r() * 34, y = r() * h;
        for (let j = 0; j < 4; j++) { const nx = x + (r() - 0.3) * 12, ny = y + 6 + r() * 10; cr.push([x, y, nx, ny]); if (r() < 0.4) cr.push([nx, ny, nx + (r() - 0.5) * 10, ny + 6]); x = nx; y = ny; }
      }
      segs(cr, rgba('#ffffff', 0.35), 0.8);
      const bub = [];
      for (let k = 0; k < h / 12; k++) bub.push([6 + r() * 46, r() * h, 0.8 + r() * 1.4]);
      ctx.strokeStyle = rgba('#ffffff', 0.3);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const [x, y, rr] of bub) { ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU); }
      ctx.stroke();
      const fr = [];
      for (let k = 0; k < h / 3; k++) fr.push([r() * 6, r() * h, 0.5 + r() * 0.8]);
      dots(fr, rgba('#ffffff', 0.5));
      break;
    }
    case 'lava': {
      columnBase(h, C.pipe, C.pipeSide, shade(C.pipe, 0.14));
      const cols = [0, 19 + r() * 3, 39 + r() * 3, PW], joints = [];
      for (let c = 0; c < 3; c++) {
        let y = r() * 30;
        while (y < h) { joints.push([cols[c] + 1, y, cols[c + 1] - 1, y + (r() - 0.5) * 3, r() < 0.35]); y += 26 + r() * 30; }
      }
      segs([[cols[1], 0, cols[1], h], [cols[2], 0, cols[2], h]], rgba(INK, 0.4), 1.2);
      segs([[cols[1] + 1.2, 0, cols[1] + 1.2, h], [cols[2] + 1.2, 0, cols[2] + 1.2, h]], rgba(CREAM, 0.08), 1);
      segs(joints.map(j => j.slice(0, 4)), rgba(INK, 0.45), 1.2);
      const hot = joints.filter(j => j[4]).map(j => j.slice(0, 4));
      segs(hot, rgba(C.accent, 0.22), 5);
      segs(hot, rgba(C.accent, 0.85), 1.4);
      const sp = [];
      for (let k = 0; k < h / 4; k++) sp.push([r() * PW, r() * h, 0.6 + r() * 0.8]);
      dots(sp, rgba(INK, 0.25));
      break;
    }
    case 'trunk': {
      columnBase(h, C.pipe, C.pipeSide, C.pipeLight);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const gx = 5 + k * 9 + r() * 4;
        ctx.moveTo(gx, 0);
        for (let y = 0; y <= h; y += 30) ctx.lineTo(gx + Math.sin(y * 0.03 + k * 2.3) * 2.5 + (r() - 0.5) * 1.5, y);
      }
      ctx.strokeStyle = rgba(C.pipeDark, 0.55);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.translate(1.6, 0);
      ctx.strokeStyle = rgba(C.pipeLight, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.translate(-1.6, 0);
      for (let k = 0; k < h / 160; k++) {
        const kx = 14 + r() * 26, ky = 40 + r() * (h - 80);
        ellipse(kx, ky, 6, 9, 0, C.pipeDark);
        ellipse(kx - 1, ky - 1, 3.5, 6, 0, mix(C.pipeDark, INK, 0.4));
        ctx.strokeStyle = rgba(C.pipeLight, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 8.5, 12, 0, 0, TAU);
        ctx.stroke();
      }
      const moss = [];
      for (let k = 0; k < h / 30; k++) moss.push([2 + r() * 14, r() * h, 2 + r() * 4, 4 + r() * 8, 0]);
      ellipses(moss, rgba(mix(C.accent, C.near, 0.3), 0.55));
      // Ranke vorn um den Stamm
      ctx.strokeStyle = mix(C.accent, C.near, 0.25);
      ctx.lineWidth = 2.4;
      const lv = [];
      ctx.beginPath();
      let drawing = false;
      for (let y = 0; y <= h; y += 4) {
        const ph = y * 0.045 + v * 2, vx = PW / 2 + Math.sin(ph) * (PW / 2 - 2), front = Math.cos(ph) > -0.2;
        if (front) { if (!drawing) ctx.moveTo(vx, y); else ctx.lineTo(vx, y); drawing = true; if (y % 28 === 0) lv.push([vx + 4, y, 5, 2.6, 0.6]); }
        else drawing = false;
      }
      ctx.stroke();
      ellipses(lv, C.accent);
      break;
    }
    case 'sandstone': {
      columnBase(h, C.pipe, C.pipeSide, mix(C.pipe, CREAM, 0.32));
      let y = 0;
      while (y < h) {
        const bh = 8 + r() * 12, c = [mix(C.pipe, C.accent, 0.3), mix(C.pipe, CREAM, 0.3), shade(C.pipe, -0.1)][Math.floor(r() * 3)];
        ctx.fillStyle = rgba(c, 0.4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(PW / 2, y + (r() - 0.5) * 4, PW, y);
        ctx.lineTo(PW, y + bh);
        ctx.lineTo(0, y + bh);
        ctx.closePath();
        ctx.fill();
        y += bh;
      }
      const notch = [];
      for (let k = 0; k < h / 26; k++) { const ny = r() * h, left = r() < 0.5, d = 3 + r() * 5; notch.push(left ? [[0, ny], [d, ny + 4], [0, ny + 9]] : [[PW, ny], [PW - d, ny + 4], [PW, ny + 9]]); }
      for (const n of notch) poly(n, rgba(C.pipeDark, 0.5));
      const sp = [];
      for (let k = 0; k < h / 3; k++) sp.push([r() * PW, r() * h, 0.5 + r() * 0.7]);
      dots(sp, rgba(C.pipeDark, 0.25));
      break;
    }
    case 'coral': {
      const kn = [], knS = [];
      for (let y = 6; y < h; y += 14 + r() * 6) { kn.push([1, y, 5 + r() * 3]); knS.push([PW - 1, y + 6, 5 + r() * 3]); }
      dots(kn, C.pipeLight);
      dots(knS, C.pipeSide);
      columnBase(h, C.pipe, C.pipeSide, C.pipeLight);
      const pores = [];
      for (let k = 0; k < h / 4; k++) pores.push([4 + r() * 50, r() * h, 1.1 + r() * 1.2]);
      dots(pores.map(([a, b, c]) => [a - 0.5, b - 0.5, c + 0.5]), rgba(C.pipeLight, 0.35));
      dots(pores, rgba(C.pipeDark, 0.45));
      const pol = [];
      for (let k = 0; k < h / 18; k++) { const px = 8 + r() * 40, py = r() * h; for (let j = 0; j < 4; j++) pol.push([px + Math.cos(j * 1.57) * 2.4, py + Math.sin(j * 1.57) * 2.4, 1]); }
      dots(pol, rgba(C.accent, 0.8));
      break;
    }
    case 'tower': {
      columnBase(h, C.pipe, C.pipeSide, C.pipeLight);
      const mort = [], lt = [], dk = [];
      for (let row = 0, y = 0; y < h; row++, y += 11) {
        mort.push([0, y, PW, y]);
        for (let x = row % 2 ? -10 : 0; x < PW; x += 20) {
          mort.push([x, y, x, y + 11]);
          const q = r();
          if (q < 0.25) lt.push([x + 1, y + 1, 18, 9]); else if (q < 0.45) dk.push([x + 1, y + 1, 18, 9]);
        }
      }
      ctx.fillStyle = rgba(C.pipeLight, 0.18);
      for (const q of lt) ctx.fillRect(q[0], q[1], q[2], q[3]);
      ctx.fillStyle = rgba(C.pipeDark, 0.2);
      for (const q of dk) ctx.fillRect(q[0], q[1], q[2], q[3]);
      segs(mort, rgba(C.pipeDark, 0.55), 1);
      for (let y = 50 + v * 40; y < h - 20; y += 110) {
        ctx.fillStyle = rgrad(28, y, 0, 18, [[0, rgba(mix(C.accent, '#ffcf7a', 0.5), 0.35)], [1, rgba(C.accent, 0)]]);
        ctx.fillRect(10, y - 18, 36, 36);
        roundRectPath(24, y - 10, 8, 20, 4);
        ctx.fillStyle = mix(INK, C.pipeDark, 0.4);
        ctx.fill();
        roundRectPath(25.5, y - 7, 5, 15, 2.5);
        ctx.fillStyle = mix('#ffcf7a', C.accent, 0.3);
        ctx.fill();
      }
      break;
    }
    case 'rock': {
      ctx.beginPath();
      ctx.moveTo(2, 0);
      for (let y = 0; y <= h; y += 16) ctx.lineTo(1 + r() * 3, y);
      ctx.lineTo(PW - 1, h);
      for (let y = h; y >= 0; y -= 16) ctx.lineTo(PW - 1 - r() * 3, y);
      ctx.closePath();
      ctx.fillStyle = hgrad(0, PW, [[0, shade(C.pipe, 0.16)], [0.15, C.pipe], [0.62, C.pipe], [0.75, C.pipeSide], [1, shade(C.pipeSide, -0.15)]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let y = r() * 20; y < h; y += 30 + r() * 30) {
        const f1 = [[0, y], [PW * (0.3 + r() * 0.3), y + 8 + r() * 10], [PW, y + r() * 16], [PW, y + 30], [0, y + 26]];
        poly(f1, rgba(r() < 0.5 ? CREAM : INK, 0.06 + r() * 0.06));
      }
      const veins = [];
      for (let k = 0; k < h / 60; k++) { let x = r() * PW, y = r() * h; for (let j = 0; j < 3; j++) { const nx = x + (r() - 0.5) * 16, ny = y + 8 + r() * 10; veins.push([x, y, nx, ny]); x = nx; y = ny; } }
      segs(veins, rgba(C.accent, 0.3), 1);
      const sp = [];
      for (let k = 0; k < h / 3; k++) sp.push([r() * PW, r() * h, 0.5 + r() * 0.8]);
      dots(sp, rgba(INK, 0.25));
      ctx.restore();
      break;
    }
    case 'neon': {
      const body = mix(INK, C.near, 0.45);
      columnBase(h, body, shade(body, -0.2), mix(body, C.pipe, 0.14));
      const pl = [];
      for (let y = 0; y < h; y += 14) pl.push([14, y + 4, 44, y + 4]);
      segs(pl, rgba(C.pipe, 0.1), 2.5);
      for (let y = 32 + v * 30; y < h; y += 64) {
        ctx.fillStyle = rgba(C.accent, 0.25);
        ctx.fillRect(0, y - 3, PW, 6);
        ctx.fillStyle = mix(C.accent, CREAM, 0.3);
        ctx.fillRect(0, y - 1, PW, 2);
      }
      for (const x of [1.5, PW - 1.5]) {
        ctx.fillStyle = hgrad(x - 5, x + 5, [[0, rgba(C.pipe, 0)], [0.5, rgba(C.pipe, 0.35)], [1, rgba(C.pipe, 0)]]);
        ctx.fillRect(x - 5, 0, 10, h);
        ctx.fillStyle = mix(C.pipe, CREAM, 0.3);
        ctx.fillRect(x - 0.9, 0, 1.8, h);
      }
      break;
    }
    case 'station': {
      columnBase(h, C.pipe, C.pipeSide, C.pipeLight);
      const seams = [];
      for (let y = 20 + v * 10; y < h; y += 40) seams.push([0, y, PW, y]);
      segs(seams, rgba(C.pipeDark, 0.6), 1.6);
      segs(seams.map(s => [s[0], s[1] + 1.6, s[2], s[3] + 1.6]), rgba(CREAM, 0.15), 1);
      ctx.fillStyle = mix(INK, C.far, 0.3);
      ctx.fillRect(21, 0, 12, h);
      const win = [];
      for (let y = 8; y < h; y += 22) win.push([24, y, 6, 5]);
      for (const [x, y, w2, h2b] of win) {
        ctx.fillStyle = rgba(C.accent, 0.25);
        ctx.fillRect(x - 2, y - 2, w2 + 4, h2b + 4);
        ctx.fillStyle = mix(C.accent, CREAM, 0.35);
        ctx.fillRect(x, y, w2, h2b);
      }
      const rv = [];
      for (let y = 8; y < h; y += 20) rv.push([8, y, 1.2], [46, y, 1.2]);
      dots(rv.map(([a, b, c]) => [a + 0.5, b + 0.5, c]), rgba(INK, 0.4));
      dots(rv, rgba(CREAM, 0.4));
      break;
    }
    default: if (ART2.pipeBody[st]) ART2.pipeBody[st](C, h, v, r);
  }
}

function capBase(front, side, light, rad) {
  roundRectPath(-PCO, 0, PW + PCO * 2, PCH, rad);
  ctx.fillStyle = hgrad(-PCO, PW + PCO, [[0, light], [0.13, front], [0.6, front], [0.74, side], [1, shade(side, -0.14)]]);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function paintPipeCap(st, C, dir) {
  const up = dir === 'up', edge = up ? 0 : PCH, inward = up ? 1 : -1;   // edge = Kante zur Lücke
  const r = mulberry32(st.length * 31 + (up ? 7 : 3));
  // weiche Schattenkante dort, wo der Körper anschließt
  switch (st) {
    case 'stem': {
      capBase(shade(C.pipe, 0.06), C.pipeSide, C.pipeLight, 10);
      const sc = [];
      for (let k = 0; k < 6; k++) sc.push([-PCO + 6 + k * 11.2, edge, 5.6]);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-PCO - 2, up ? -10 : 0, PW + PCO * 2 + 4, PCH + 10);
      ctx.clip();
      dots(sc, shade(C.pipe, 0.12));
      ctx.restore();
      const pol = [];
      for (let k = 0; k < 9; k++) pol.push([-PCO + 5 + k * 7.6, edge + inward * 3.5, 1.7]);
      dots(pol, C.accent);
      ctx.fillStyle = rgba(C.pipeDark, 0.35);
      ctx.fillRect(-PCO, up ? PCH - 4 : 0, PW + PCO * 2, 4);
      break;
    }
    case 'ice': {
      capBase(mix(C.pipe, CREAM, 0.32), shade(C.pipe, -0.1), mix(C.pipe, '#ffffff', 0.6), 4);
      ctx.fillStyle = rgba('#ffffff', 0.5);
      ctx.fillRect(-PCO + 4, 3, 5, PCH - 6);
      if (up) {
        const sn = [];
        for (let k = 0; k < 7; k++) sn.push([-PCO + 4 + k * 10, 1, 5 + r() * 2]);
        ctx.save();
        ctx.beginPath();
        ctx.rect(-PCO - 4, -8, PW + PCO * 2 + 8, 11);
        ctx.clip();
        blobPath(sn);
        ctx.fillStyle = mix(CREAM, '#ffffff', 0.5);
        ctx.fill();
        ctx.restore();
      } else {
        const fr = [];
        for (let k = 0; k < 14; k++) fr.push([-PCO + 2 + k * 5, PCH - 1, 1.6 + r() * 1.2]);
        dots(fr, rgba('#ffffff', 0.7));
      }
      break;
    }
    case 'lava': {
      capBase(mix(C.pipe, C.accent, 0.25), shade(mix(C.pipe, C.accent, 0.25), -0.2), mix(C.pipe, C.accent, 0.45), 3);
      ctx.fillStyle = vgrad(up ? 0 : PCH - 7, up ? 7 : PCH, up ? [[0, C.accentLight], [1, rgba(C.accent, 0)]] : [[0, rgba(C.accent, 0)], [1, C.accentLight]]);
      ctx.fillRect(-PCO, up ? 0 : PCH - 7, PW + PCO * 2, 7);
      const cr = [];
      for (let k = 0; k < 6; k++) { const x = -PCO + 4 + k * 12; cr.push([x, 4, x + 4, PCH - 4]); }
      segs(cr, rgba(C.accent, 0.6), 1.2);
      break;
    }
    case 'trunk': {
      capBase(shade(C.pipe, 0.05), C.pipeSide, C.pipeLight, 4);
      if (up) {
        ellipse(PW / 2, 5, PW / 2 + PCO, 6, 0, mix(C.pipe, CREAM, 0.38));
        ctx.strokeStyle = rgba(C.pipeDark, 0.5);
        ctx.lineWidth = 0.9;
        for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.ellipse(PW / 2 + 1, 5, k * 7, k * 1.25, 0, 0, TAU); ctx.stroke(); }
        circle(PW / 2 + 1, 5, 1.6, C.pipeDark);
      } else {
        const sp = [];
        let x = -PCO;
        while (x < PW + PCO) { const w2 = 6 + r() * 6; sp.push([[x, PCH - 2], [x + w2 * 0.5, PCH + 3 + r() * 5], [x + w2, PCH - 2]]); x += w2; }
        for (const s of sp) poly(s, C.pipeSide);
      }
      const ring = [];
      for (let k = 0; k < 5; k++) ring.push([-PCO + 4 + k * 13, up ? PCH - 6 : 6, -PCO + 10 + k * 13, up ? PCH - 6 : 6]);
      segs(ring, rgba(C.pipeDark, 0.4), 1);
      break;
    }
    case 'sandstone': {
      capBase(shade(C.pipe, 0.1), C.pipeSide, mix(C.pipe, CREAM, 0.35), 5);
      ctx.fillStyle = rgba(C.pipeDark, 0.4);
      ctx.fillRect(-PCO, up ? PCH - 4 : 0, PW + PCO * 2, 4);
      ctx.fillStyle = rgba(mix(C.accent, C.pipe, 0.5), 0.6);
      ctx.fillRect(-PCO, up ? 6 : PCH - 10, PW + PCO * 2, 4);
      line(-PCO + 2, up ? 1 : PCH - 1, PW + PCO - 2, up ? 1 : PCH - 1, rgba(CREAM, up ? 0.45 : 0.15), 1.2);
      break;
    }
    case 'coral': {
      capBase(C.pipeSide, shade(C.pipeSide, -0.1), C.pipe, 8);
      const cy = PCH / 2;
      for (let k = 0; k < 5; k++) circle(-PCO + 7 + k * 13, cy, 9, k === 4 ? C.pipeSide : mix(C.pipe, CREAM, 0.12 + (k % 2) * 0.06));
      const tips = [];
      for (let k = 0; k < 5; k++) tips.push([-PCO + 7 + k * 13, cy, 2.6]);
      dots(tips, C.accent);
      dots(tips.map(([a, b]) => [a - 0.8, b - 0.8, 0.9]), CREAM);
      break;
    }
    case 'tower': {
      capBase(shade(C.pipe, 0.06), C.pipeSide, C.pipeLight, 2);
      const cren = [];
      for (let k = 0; k < 4; k++) cren.push([-PCO + 4 + k * 17, up ? -6 : PCH, 10, 6]);
      ctx.fillStyle = shade(C.pipe, 0.02);
      for (const [x, y, w2, h2b] of cren) ctx.fillRect(x, y, w2, h2b);
      ctx.fillStyle = rgba(INK, 0.3);
      for (const [x, y, w2, h2b] of cren) ctx.fillRect(x + w2 - 2.5, y, 2.5, h2b);
      const mort = [];
      for (let y = 6; y < PCH; y += 7) mort.push([-PCO, y, PW + PCO, y]);
      segs(mort, rgba(C.pipeDark, 0.45), 1);
      break;
    }
    case 'rock': {
      capBase(shade(C.pipe, 0.08), C.pipeSide, shade(C.pipe, 0.2), 3);
      for (let k = 0; k < 4; k++) {
        const x = -PCO + 8 + k * 16 + r() * 4, hh = 7 + r() * 6;
        ctx.save();
        ctx.translate(x, edge);
        ctx.rotate((r() - 0.5) * 0.6);
        const d = inward;
        poly([[-3, 0], [-3, d * hh * 0.7], [0, d * hh], [3, d * hh * 0.7], [3, 0]], mix(C.accent, CREAM, 0.15));
        poly([[0, 0], [0, d * hh], [3, d * hh * 0.7], [3, 0]], mix(C.accent, C.pipe, 0.4));
        ctx.restore();
      }
      break;
    }
    case 'neon': {
      const body = mix(INK, C.near, 0.6);
      capBase(body, shade(body, -0.2), mix(body, C.pipe, 0.2), 3);
      ctx.strokeStyle = rgba(C.accent, 0.25);
      ctx.lineWidth = 6;
      ctx.strokeRect(-PCO, 0, PW + PCO * 2, PCH);
      ctx.strokeStyle = mix(C.accent, CREAM, 0.3);
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-PCO, 0, PW + PCO * 2, PCH);
      poly([[PW / 2 - 7, PCH / 2], [PW / 2, 5], [PW / 2 + 7, PCH / 2], [PW / 2, PCH - 5]], C.pipe);
      break;
    }
    case 'station': {
      capBase(mix(C.pipe, INK, 0.3), shade(mix(C.pipe, INK, 0.3), -0.2), mix(C.pipe, CREAM, 0.2), 3);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-PCO, 5, PW + PCO * 2, PCH - 10);
      ctx.clip();
      ctx.beginPath();
      for (let k = -1; k < 8; k++) { const x = -PCO + k * 12; ctx.moveTo(x, PCH); ctx.lineTo(x + 6, PCH); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 10, 0); ctx.closePath(); }
      ctx.fillStyle = C.accent;
      ctx.fill();
      ctx.restore();
      line(-PCO, up ? 1 : PCH - 1, PW + PCO, up ? 1 : PCH - 1, rgba(CREAM, 0.45), 1.5);
      break;
    }
    default: if (ART2.pipeCap[st]) ART2.pipeCap[st](C, up, dir);
  }
  // Kante zur Lücke: oben beleuchtet, unten im Schatten
  line(-PCO + 2, up ? 0.8 : PCH - 0.8, PW + PCO - 2, up ? 0.8 : PCH - 0.8, rgba(up ? CREAM : INK, up ? 0.3 : 0.25), 1.2);
}

// ============================================================
// Geometriehelfer für Hindernisse mit Polygon-Hitbox
// ============================================================
// Konvexes Polygon um d nach innen versetzen (Kanten parallel verschieben, Nachbarn schneiden)
function insetConvex(pts, d) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const sgn = area > 0 ? 1 : -1, lines = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * sgn, ny = dx / len * sgn;   // Innennormale
    lines.push({ px: p[0] + nx * d, py: p[1] + ny * d, dx, dy });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i];
    const den = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(den) < 1e-9) { out.push([b.px, b.py]); continue; }
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den;
    out.push([a.px + a.dx * t, a.py + a.dy * t]);
  }
  return out;
}

function outlinePath(pts, r, jit) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = jit ? (r() - 0.5) * jit : 0, jy = jit ? (r() - 0.5) * jit : 0;
    if (i === 0) ctx.moveTo(x + jx, y + jy); else ctx.lineTo(x + jx, y + jy);
  });
  ctx.closePath();
}
// Weiche Polygonkontur mit Kurven durch die Kantenmitten
function smoothPath(pts) {
  const n = pts.length, mid = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  ctx.beginPath();
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  ctx.closePath();
}

