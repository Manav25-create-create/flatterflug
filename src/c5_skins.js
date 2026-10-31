// ============================================================
// Skins: Körperform, 3 Farben, Flügelform, Augenstil, Schleppe.
// Klassik ist immer frei, dazu ein Skin pro abgeschlossenem Level.
// ============================================================
const SKINS = [
  { id: 0, name: 'Klassik', shape: 'round', colors: { body: '#ee7a5b', accent: '#fae1c1', wing: '#cf5b43' }, wing: 'feather', eye: 'round', trail: 'none', beak: '#f2b34b' },
  { id: 1, name: 'Wiesenflieger', shape: 'round', colors: { body: '#93c45c', accent: '#f6dd84', wing: '#5d9a3d' }, wing: 'leaf', eye: 'round', trail: 'leaf' },
  { id: 2, name: 'Frostschwinge', shape: 'angular', colors: { body: '#a9d7ee', accent: '#eef6fa', wing: '#5f8fc8' }, wing: 'crystal', eye: 'round', trail: 'frost' },
  { id: 3, name: 'Glutkern', shape: 'round', colors: { body: '#e66a3c', accent: '#ffd27a', wing: '#a83a22' }, wing: 'flame', eye: 'slit', trail: 'spark' },
  { id: 4, name: 'Blätterling', shape: 'round', colors: { body: '#5aa04a', accent: '#e4e08c', wing: '#2f6b35' }, wing: 'leaf', eye: 'big', trail: 'leaf' },
  { id: 5, name: 'Sandläufer', shape: 'angular', colors: { body: '#d9a35f', accent: '#f4dfb0', wing: '#a8683a' }, wing: 'feather', eye: 'sleepy', trail: 'sand' },
  { id: 6, name: 'Flossenflatter', shape: 'round', colors: { body: '#4fb2c3', accent: '#d9f2ee', wing: '#de796a' }, wing: 'fin', eye: 'big', trail: 'bubble' },
  { id: 7, name: 'Donnerfeder', shape: 'angular', colors: { body: '#6f6490', accent: '#dccaff', wing: '#3d3656' }, wing: 'bat', eye: 'glow', trail: 'spark' },
  { id: 8, name: 'Glühwürmchen', shape: 'segmented', colors: { body: '#5f4d61', accent: '#7ee1ce', wing: '#8b717b' }, wing: 'bat', eye: 'glow', trail: 'glow' },
  { id: 9, name: 'Moorhüpfer', shape: 'segmented', colors: { body: '#7d8c4c', accent: '#d6dc8a', wing: '#4e5c34' }, wing: 'leaf', eye: 'sleepy', trail: 'spore' },
  { id: 10, name: 'Pixelflügel', shape: 'angular', colors: { body: '#d9509f', accent: '#4fd1de', wing: '#3a2f78' }, wing: 'pixel', eye: 'visor', trail: 'pixel' },
  { id: 11, name: 'Prismling', shape: 'angular', colors: { body: '#8fd3df', accent: '#ef8fcf', wing: '#9a8fd0' }, wing: 'crystal', eye: 'round', trail: 'prism' },
  { id: 12, name: 'Wattebausch', shape: 'round', colors: { body: '#f1ebf6', accent: '#f6b77c', wing: '#b9a5dd' }, wing: 'cloud', eye: 'sleepy', trail: 'cloud' },
  { id: 13, name: 'Zahnradfink', shape: 'segmented', colors: { body: '#c18f46', accent: '#d97a4a', wing: '#7a5a2e' }, wing: 'gear', eye: 'monocle', trail: 'cog' },
  { id: 14, name: 'Aschefalke', shape: 'angular', colors: { body: '#4a3d3a', accent: '#f08a3c', wing: '#2b2323' }, wing: 'flame', eye: 'slit', trail: 'ember' },
  { id: 15, name: 'Sternenpilot', shape: 'round', colors: { body: '#8f9bb9', accent: '#f0b35b', wing: '#3c2b61' }, wing: 'feather', eye: 'helmet', trail: 'star' }
];
const SKIN_LABELS = {
  shape: { round: 'Rund', angular: 'Kantig', segmented: 'Segmentiert' },
  wing: { feather: 'Feder', leaf: 'Blatt', crystal: 'Kristall', flame: 'Flamme', fin: 'Flosse', bat: 'Hautflügel', pixel: 'Pixel', cloud: 'Wolke', gear: 'Zahnrad' },
  eye: { round: 'Rund', big: 'Groß', sleepy: 'Verschlafen', slit: 'Schlitz', glow: 'Leuchtend', visor: 'Visier', monocle: 'Monokel', helmet: 'Helm' },
  trail: { none: 'Keine', leaf: 'Blätter', frost: 'Frost', spark: 'Funken', sand: 'Sand', bubble: 'Blasen', glow: 'Glimmen', spore: 'Sporen', pixel: 'Pixel', prism: 'Prisma', cloud: 'Wölkchen', cog: 'Zahnrädchen', ember: 'Glut', star: 'Sterne' }
};

// Jeder Biom-Skin gehört zu dem Level, in dem sein Biom vorkommt
const skinLevel = id => LEVELS.findIndex(L => L.skinId === id);
const skinUnlocked = id => id === 0 || (skinLevel(id) >= 0 && !!progress.beaten[skinLevel(id)]);
function currentSkin() {
  const s = settings.skin;
  if (typeof s === 'string' && s.startsWith('c:')) {
    const c = progress.customSkins.find(k => 'c:' + k.name === s);
    if (c) return c;
  }
  const n = Number(s);
  return SKINS[Number.isInteger(n) && n >= 0 && n < SKINS.length && skinUnlocked(n) ? n : 0];
}
const skinKey = sk => [sk.shape, sk.colors.body, sk.colors.accent, sk.colors.wing, sk.wing, sk.eye, sk.beak || ''].join('|');

// ============================================================
// Malen: Ursprung = Vogelmitte, Hitbox 34 x 24 um (0, 0)
// ============================================================
const birdSprites = new Map();
function getBirdSprite(sk, phase, dead) {
  const ks = Math.min(view.k * 1.25, 5), key = skinKey(sk);
  let e = birdSprites.get(key);
  if (!e || e.ks !== ks) {
    if (e) e.list.forEach(s => freeCanvas(s.c));
    if (!e && birdSprites.size > 6) {
      for (const [k2, v] of birdSprites) { if (k2 !== skinKey(currentSkin())) { v.list.forEach(s => freeCanvas(s.c)); birdSprites.delete(k2); break; } }
    }
    e = { ks, list: [0, 1, 2, 3].map(i => makeSprite(-30, -26, 60, 50, ks, () => paintBird(sk, i === 3 ? 0 : i, i === 3))) };
    birdSprites.set(key, e);
  }
  return e.list[dead ? 3 : phase];
}

function paintBird(sk, phase, dead) {
  const B = sk.colors, body = B.body, side = shade(body, -CONFIG.SIDE_DARKEN), belly = B.accent;
  const beak = sk.beak || mix(B.accent, '#f2b34b', 0.6);
  paintTail(sk, B);
  paintBody(sk, B, side, belly);
  paintWing(sk, B, phase);
  paintHead(sk, B, side, dead, beak);
}

function paintTail(sk, B) {
  if (sk.shape === 'angular') {
    poly([[-11, -4], [-25, -10], [-19, -1], [-25, 6], [-11, 4]], hgrad(-25, -11, [[0, shade(B.wing, -0.25)], [1, B.wing]]));
    line(-12, 0, -21, -1, rgba(INK, 0.25), 0.7);
  } else if (sk.shape === 'segmented') {
    poly([[-14, -2], [-24, -1], [-15, 4]], shade(B.wing, -0.1));
    circle(-15, 1, 3.4, shade(B.body, -0.2));
  } else {
    poly([[-11, -3], [-23, -9], [-20, -2], [-24, 4], [-11, 4]], hgrad(-24, -11, [[0, shade(B.wing, -0.2)], [1, B.wing]]));
    segs([[-12, -1, -21, -6], [-12, 2, -21, 2]], rgba(INK, 0.2), 0.7);
  }
}

function paintBody(sk, B, side, belly) {
  const body = B.body;
  if (sk.shape === 'angular') {
    const pts = [[-15, -1], [-9, -10], [3, -10.5], [12, -4], [10, 7.5], [-2, 10.5], [-13, 6.5]];
    poly(pts.map(([x, y]) => [x + 1, y + 1.4]), side);
    poly(pts, body);
    poly([[-15, -1], [-9, -10], [3, -10.5], [-2, -2]], shade(body, 0.16));
    poly([[3, -10.5], [12, -4], [-2, -2]], shade(body, 0.05));
    poly([[-13, 6.5], [-2, 10.5], [10, 7.5], [-2, -2]], shade(body, -0.1));
    poly([[-4, 2], [9, 2], [7, 8.5], [-2, 10]], mix(belly, '#ffffff', 0.15));
    poly([[-4, 2], [9, 2], [3, 5]], rgba('#ffffff', 0.25));
    ctx.strokeStyle = rgba(INK, 0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  } else if (sk.shape === 'segmented') {
    const segsList = [[-11, 1.5, 7], [-3, 0.5, 8.6], [5, -0.5, 8.2]];
    for (const [x, y, r] of segsList) circle(x + 0.9, y + 1.2, r, side);
    for (const [x, y, r] of segsList) {
      circle(x, y, r, rgrad(x, y, 0.5, r, [[0, shade(body, 0.22)], [0.65, body], [1, shade(body, -0.15)]], x - r * 0.4, y - r * 0.45));
      ctx.strokeStyle = rgba(INK, 0.28);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.5, -Math.PI * 0.35, Math.PI * 0.55);
      ctx.stroke();
    }
    ellipse(1, 5, 9, 3.6, 0, rgba(belly, 0.85));
    dots([[-11, 5.5, 1], [-3, 6, 1], [4.5, 5.4, 1]], rgba(B.accent, 0.9));
  } else {
    ellipse(-1, 1.2, 15, 11, 0, side);
    ellipse(-2, -0.4, 13.6, 9.8, 0, rgrad(-2, -0.4, 1, 15, [[0, shade(body, 0.22)], [0.6, body], [1, shade(body, -0.12)]], -6, -6));
    ctx.strokeStyle = rgba(shade(body, -0.25), 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const [x, y] of [[-8, -6], [-3, -7.5], [2, -6.5], [-10, -1], [-5, -2.5]]) { ctx.moveTo(x - 2.4, y); ctx.arc(x, y, 2.4, Math.PI, 0, true); }
    ctx.stroke();
    ellipse(2, 4.6, 9.6, 5.4, 0, rgrad(2, 4.6, 0.5, 10, [[0, mix(belly, '#ffffff', 0.4)], [1, shade(belly, -0.08)]], 0, 2.5));
    dots([[0, 5.5, 0.5], [3, 6.5, 0.5], [5.5, 4.5, 0.5]], rgba(shade(belly, -0.3), 0.6));
  }
}

function paintWing(sk, B, phase) {
  const w = B.wing, under = shade(w, -CONFIG.SIDE_DARKEN);
  ctx.save();
  ctx.translate(-3, -1);
  ctx.rotate([0.95, 0.1, -0.8][phase]);
  switch (sk.wing) {
    case 'leaf': {
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.quadraticCurveTo(-9, -8, -21, -1);
      ctx.quadraticCurveTo(-9, 7, 1, 0);
      ctx.fillStyle = hgrad(-21, 1, [[0, shade(w, -0.1)], [1, shade(w, 0.18)]]);
      ctx.fill();
      line(0, 0, -19, -1, rgba(shade(w, -0.4), 0.6), 0.9);
      segs([[-5, -0.5, -9, -4.5], [-10, -0.8, -14, -4.2], [-5, -0.3, -9, 3.6], [-11, -0.8, -15, 2.8]], rgba(shade(w, -0.35), 0.45), 0.6);
      break;
    }
    case 'crystal': {
      poly([[1, 1], [-8, -7], [-22, -2], [-12, 5]], hgrad(-22, 1, [[0, shade(w, -0.15)], [1, mix(w, CREAM, 0.45)]]));
      poly([[1, 1], [-8, -7], [-12, 5]], rgba('#ffffff', 0.28));
      line(-8, -7, -12, 5, rgba(CREAM, 0.6), 0.7);
      line(-3, -2, -18, -2, rgba('#ffffff', 0.4), 0.6);
      break;
    }
    case 'flame': {
      ctx.beginPath();
      ctx.moveTo(1, 2);
      ctx.quadraticCurveTo(-6, -9, -14, -6);
      ctx.quadraticCurveTo(-11, -3, -19, -3);
      ctx.quadraticCurveTo(-14, 0, -21, 2);
      ctx.quadraticCurveTo(-10, 6, 1, 2);
      ctx.fillStyle = hgrad(-21, 1, [[0, mix(B.accent, '#ffe9a6', 0.4)], [0.5, mix(w, B.accent, 0.4)], [1, w]]);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1, 1.5);
      ctx.quadraticCurveTo(-7, -3, -12, -2);
      ctx.quadraticCurveTo(-8, 2, -1, 1.5);
      ctx.fillStyle = rgba('#ffe9a6', 0.55);
      ctx.fill();
      break;
    }
    case 'fin': {
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.quadraticCurveTo(-8, -10, -20, -6);
      ctx.quadraticCurveTo(-17, 1, -19, 5);
      ctx.quadraticCurveTo(-8, 5, 1, 0);
      ctx.fillStyle = rgba(w, 0.85);
      ctx.fill();
      segs([[0, 0, -18, -5], [0, 0, -18, -1], [0, 0, -18, 3]], rgba(shade(w, -0.3), 0.6), 0.8);
      ctx.strokeStyle = rgba(CREAM, 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-20, -6); ctx.quadraticCurveTo(-17, 1, -19, 5);
      ctx.stroke();
      break;
    }
    case 'bat': {
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-21, -5);
      ctx.quadraticCurveTo(-18, -1, -20, 2);
      ctx.quadraticCurveTo(-15, 0, -14, 5);
      ctx.quadraticCurveTo(-9, 2, -6, 6);
      ctx.closePath();
      ctx.fillStyle = hgrad(-21, 1, [[0, under], [1, shade(w, 0.12)]]);
      ctx.fill();
      segs([[-6, -8, -21, -5], [-6, -8, -20, 2], [-6, -8, -14, 5]], rgba(shade(w, -0.45), 0.7), 0.9);
      break;
    }
    case 'pixel': {
      ctx.fillStyle = under;
      ctx.fillRect(-20, -1, 21, 4);
      ctx.fillStyle = w;
      ctx.fillRect(-16, -5, 17, 4);
      ctx.fillRect(-12, -9, 13, 4);
      ctx.fillStyle = B.accent;
      ctx.fillRect(-20, 3, 6, 2);
      ctx.fillRect(-16, -1, 4, 2);
      ctx.fillStyle = rgba('#ffffff', 0.3);
      ctx.fillRect(-12, -9, 13, 1.2);
      break;
    }
    case 'cloud': {
      const bl = [[-4, 0, 6], [-11, -2, 6.5], [-17, 1, 5], [-9, 3, 5]];
      blobPath(bl.map(([x, y, r]) => [x + 0.8, y + 1.2, r]));
      ctx.fillStyle = shade(w, -0.12);
      ctx.fill();
      blobPath(bl);
      ctx.fillStyle = rgrad(-10, -3, 1, 12, [[0, mix(w, '#ffffff', 0.55)], [1, w]]);
      ctx.fill();
      break;
    }
    case 'gear': {
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI + k * Math.PI / 8, r = k % 2 ? 15 : 18;
        const x = -8 + Math.cos(a) * r * 0.75, y = Math.sin(a) * r * 0.5;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.lineTo(1, 2);
      ctx.closePath();
      ctx.fillStyle = hgrad(-22, 1, [[0, shade(w, -0.1)], [1, mix(w, B.accent, 0.4)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(INK, 0.3);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      circle(-8, 0, 2.2, mix(B.accent, CREAM, 0.3));
      circle(-8, 0, 1, rgba(INK, 0.5));
      break;
    }
    default: {
      ellipse(-9, 2.2, 10.5, 4.8, 0.08, under);
      ellipse(-10, -0.4, 10, 4.4, -0.06, hgrad(-20, 0, [[0, shade(w, -0.08)], [1, shade(w, 0.12)]]));
      ellipse(-5, -1, 6.5, 4, 0, shade(w, 0.16));
      segs([[-17, 1, -5, 1], [-15, 3, -6, 3], [-18, -1, -9, -1.5]], rgba(INK, 0.2), 0.7);
    }
  }
  ctx.restore();
}

function paintHead(sk, B, side, dead, beak) {
  const body = B.body;
  let hx = 7.4, hy = -4.6;
  if (sk.shape === 'angular') {
    const pts = [[1, -10], [9, -13], [15.5, -7], [14.5, 0.5], [5, 2]];
    poly(pts.map(([x, y]) => [x + 0.8, y + 1]), side);
    poly(pts, shade(body, 0.06));
    poly([[1, -10], [9, -13], [8, -5]], shade(body, 0.2));
    poly([[15.5, -7], [14.5, 0.5], [8, -5]], shade(body, -0.06));
    hx = 9; hy = -5.5;
  } else if (sk.shape === 'segmented') {
    circle(9.5, -3.6, 7.4, side);
    circle(9, -4.6, 6.8, rgrad(9, -4.6, 0.5, 7.5, [[0, shade(body, 0.25)], [0.7, body], [1, shade(body, -0.1)]], 6.5, -7.5));
    // Fühler
    ctx.strokeStyle = shade(body, -0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, -10); ctx.quadraticCurveTo(4, -16, 0, -17);
    ctx.moveTo(9, -11); ctx.quadraticCurveTo(10, -17, 14, -18);
    ctx.stroke();
    circle(0, -17, 1.6, B.accent);
    circle(14, -18, 1.6, B.accent);
    hx = 9; hy = -4.6;
  } else {
    circle(8, -3.5, 8.8, side);
    circle(7.4, -4.6, 8, rgrad(7.4, -4.6, 0.5, 9, [[0, shade(body, 0.25)], [0.7, body], [1, shade(body, -0.1)]], 4.5, -8));
    poly([[3, -11], [5, -16], [7, -11.5]], B.wing);
    poly([[5.5, -11.5], [9, -15], [9.5, -11]], shade(B.wing, 0.1));
  }
  ellipse(hx - 1.4, hy + 5.6, 2.8, 1.7, 0, rgba('#e8607a', 0.32));
  const ex = hx + 3.6, ey = hy - 1.4;
  if (dead) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ex - 2.5, ey - 2.5); ctx.lineTo(ex + 2.5, ey + 2.5);
    ctx.moveTo(ex + 2.5, ey - 2.5); ctx.lineTo(ex - 2.5, ey + 2.5);
    ctx.stroke();
  } else paintEye(sk, B, ex, ey);
  // Schnabel
  const bx = sk.shape === 'angular' ? 15 : 14.5;
  if (sk.shape === 'segmented') {
    poly([[14.5, -4.5], [20, -2.4], [14.5, -0.5]], hgrad(14, 20, [[0, shade(beak, 0.15)], [1, beak]]));
  } else {
    poly([[bx, -3.6], [sk.shape === 'angular' ? 25 : 23.5, -0.6], [bx, 1]], hgrad(14, 24, [[0, shade(beak, 0.15)], [1, beak]]));
    poly([[bx, 1], [21, 0.5], [bx, 3.8]], shade(beak, -CONFIG.SIDE_DARKEN));
    circle(bx + 2, -1.8, 0.5, rgba(INK, 0.5));
  }
  if (sk.eye === 'helmet' && !dead) {
    circle(hx + 0.6, hy, 11.5, rgba('#bfe6ff', 0.18));
    ctx.strokeStyle = rgba(CREAM, 0.75);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(hx + 0.6, hy, 11.5, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.7);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(hx + 0.6, hy, 9, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = mix(B.accent, INK, 0.2);
    ctx.fillRect(hx - 6, hy + 10.5, 13, 2.4);
  }
  // feine Kontur für Lesbarkeit vor jedem Hintergrund
  if (sk.shape === 'round') {
    ctx.strokeStyle = rgba(INK, 0.35);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(-1.5, 0, 14.6, 10.8, 0, 0.5, Math.PI * 1.35);
    ctx.stroke();
  }
}

function paintEye(sk, B, ex, ey) {
  switch (sk.eye) {
    case 'big':
      circle(ex, ey, 5.2, CREAM);
      circle(ex + 1.3, ey + 0.4, 3.3, INK);
      circle(ex + 2.2, ey - 0.9, 1.2, '#ffffff');
      circle(ex + 0.4, ey + 1.6, 0.6, '#ffffff');
      break;
    case 'sleepy':
      circle(ex, ey, 4.5, CREAM);
      circle(ex + 1.2, ey + 0.8, 2.4, INK);
      ctx.save();
      ctx.beginPath();
      ctx.arc(ex, ey, 4.6, 0, TAU);
      ctx.clip();
      ctx.fillStyle = shade(B.body, -0.05);
      ctx.fillRect(ex - 5, ey - 5, 10, 4.2);
      ctx.restore();
      line(ex - 4.4, ey - 0.8, ex + 4.4, ey - 0.8, rgba(INK, 0.6), 0.9);
      break;
    case 'slit':
      circle(ex, ey, 4.5, mix('#ffd27a', CREAM, 0.3));
      ellipse(ex + 1, ey, 0.9, 3.4, 0, INK);
      circle(ex + 2, ey - 1.8, 0.7, '#ffffff');
      break;
    case 'glow':
      ctx.fillStyle = rgrad(ex, ey, 0, 8, [[0, rgba(B.accent, 0.7)], [1, rgba(B.accent, 0)]]);
      ctx.fillRect(ex - 8, ey - 8, 16, 16);
      circle(ex, ey, 3.8, mix(B.accent, CREAM, 0.5));
      circle(ex + 0.8, ey, 1.6, CREAM);
      break;
    case 'visor':
      poly([[ex - 6, ey - 3], [ex + 6, ey - 4], [ex + 6.5, ey + 2], [ex - 5.5, ey + 2.6]], mix(INK, B.accent, 0.25));
      line(ex - 4, ey - 1.6, ex + 4.6, ey - 2.4, rgba(B.accent, 0.9), 1.4);
      line(ex - 3, ey + 0.8, ex + 1, ey + 0.4, rgba('#ffffff', 0.4), 0.7);
      break;
    case 'monocle':
      circle(ex, ey, 4.3, CREAM);
      circle(ex + 1.1, ey + 0.3, 2.3, INK);
      circle(ex + 1.9, ey - 0.8, 0.8, '#ffffff');
      ctx.strokeStyle = mix(B.accent, '#e0b35a', 0.6);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ex, ey, 5.3, 0, TAU);
      ctx.moveTo(ex - 3, ey + 4.4);
      ctx.quadraticCurveTo(ex - 6, ey + 10, ex - 10, ey + 9);
      ctx.stroke();
      break;
    default:
      circle(ex, ey, 4.5, CREAM);
      circle(ex + 1.2, ey + 0.2, 2.5, INK);
      circle(ex + 2, ey - 1, 0.95, '#ffffff');
      ctx.strokeStyle = rgba(INK, 0.45);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(ex, ey, 4.5, Math.PI * 1.1, Math.PI * 1.75);
      ctx.stroke();
  }
}

// ============================================================
// Vogel zeichnen: Schatten, Sprite, Effekte der Fähigkeiten
// ============================================================
function drawBird(a) {
  const x = lerp(bird.px, bird.x, a), y = lerp(bird.py, bird.y, a), rot = lerp(bird.prot, bird.rot, a);
  const cx = x + CONFIG.BIRD_W / 2, cy = y + CONFIG.BIRD_H / 2, k = view.k, sk = currentSkin();
  bird.vs = bird.vs === undefined ? 1 : bird.vs + (birdScale() - bird.vs) * 0.2;
  const s = bird.vs;
  let alpha = 1;
  if (bird.inv > 0 && !bird.dead) alpha = Math.floor(bird.inv / 4) % 2 ? 0.3 : 1;
  if (abil.phantom > 0) alpha *= 0.5;
  ellipse(cx + SHADOW.x * 0.7, cy + SHADOW.y * 0.7, 15 * s, 10 * s, rot * 0.5, rgba(INK, CONFIG.SHADOW_ALPHA * alpha));
  const spr = getBirdSprite(sk, wingPhase(), bird.dead), c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
  ctx.save();
  if (abil.phantom > 0 && !bird.dead) {
    // Nachbilder als Schleppe
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.12 * (4 - i) / 3;
      ctx.setTransform(k * c, k * sn, -k * sn, k * c, (cx - i * 7 + shakeFx.x) * k, (cy + i * bird.vy * 0.6 + shakeFx.y) * k);
      ctx.drawImage(spr.c, spr.x0, spr.y0, spr.w, spr.h);
    }
  }
  ctx.globalAlpha = alpha;
  ctx.setTransform(k * c, k * sn, -k * sn, k * c, (cx + shakeFx.x) * k, (cy + shakeFx.y) * k);
  ctx.drawImage(spr.c, spr.x0, spr.y0, spr.w, spr.h);
  ctx.restore();
  if (abil.shrink > 0 && abil.shrink < 50 && Math.floor(abil.shrink / 6) % 2 === 0) {
    ctx.strokeStyle = rgba(ABILITIES.SCHRUMPFEN.color, 0.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, TAU);
    ctx.stroke();
  }
}

// Schleppe: wenige, kurzlebige Partikel hinter dem Vogel
const TRAILS = {
  leaf: sk => ({ kind: 'leaf', color: pick([sk.colors.wing, sk.colors.body]), size: 2.2, vr: (Math.random() - 0.5) * 0.2, vy: 0.4, grav: 0.02 }),
  frost: sk => ({ kind: 'frost', color: mix(sk.colors.accent, '#ffffff', 0.4), size: 2.4, vr: 0.05 }),
  spark: sk => ({ kind: 'spark', color: sk.colors.accent, size: 1.4, vy: -0.2 }),
  sand: sk => ({ kind: 'puff', color: mix(sk.colors.body, CREAM, 0.3), size: 2, grow: 0.12, alpha: 0.45 }),
  bubble: sk => ({ kind: 'bubble', color: rgba(mix(sk.colors.accent, '#ffffff', 0.3), 0.8), size: 1.8, vy: -0.5 }),
  glow: sk => ({ kind: 'spark', color: sk.colors.accent, size: 1.6, vy: (Math.random() - 0.5) * 0.4 }),
  spore: sk => ({ kind: 'dot', color: rgba(sk.colors.accent, 0.8), size: 1.3, vy: -0.35 }),
  pixel: sk => ({ kind: 'pixel', color: pick([sk.colors.accent, sk.colors.body]), size: 1.6 }),
  prism: sk => ({ kind: 'prism', color: pick([sk.colors.accent, sk.colors.body, '#ffe58a', '#9fe8ff']), size: 2, vr: 0.1 }),
  cloud: sk => ({ kind: 'puff', color: mix(sk.colors.body, '#ffffff', 0.4), size: 2.6, grow: 0.1, alpha: 0.55 }),
  cog: sk => ({ kind: 'cog', color: mix(sk.colors.body, sk.colors.accent, 0.3), size: 2.4, vr: 0.12, grav: 0.03 }),
  ember: sk => ({ kind: 'ember', color: sk.colors.accent, size: 1.5, vy: -0.4 }),
  star: sk => ({ kind: 'star', color: mix(sk.colors.accent, CREAM, 0.4), size: 2, vr: 0.05 })
};
function emitTrail(dt) {
  if (SIM.on) return;
  const sk = currentSkin(), f = TRAILS[sk.trail];
  if (!f) return;
  bird.trailT += dt;
  if (bird.trailT < 3) return;
  bird.trailT = 0;
  const o = f(sk), s = birdScale();
  addParticle(Object.assign({ x: bird.x + 6, y: bird.y + 12 + (Math.random() - 0.5) * 8 * s, vx: -0.6 - Math.random() * 0.6, life: 26, alpha: 0.75, scroll: true }, o));
}

// Vorschau eines Skins (Menü und Editor) im aktuellen ctx, Mittelpunkt x, y, Maßstab s
function drawSkinPreview(sk, x, y, s, phase) {
  const spr = getBirdSprite(sk, phase === undefined ? 1 : phase, false);
  ctx.drawImage(spr.c, x + spr.x0 * s, y + spr.y0 * s, spr.w * s, spr.h * s);
}

