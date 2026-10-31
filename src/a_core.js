// ============================================================
// Helfer
// ============================================================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (lo, hi) => lo + RNG() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick = arr => arr[Math.floor(RNG() * arr.length)];
const ease = {
  outCubic: t => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
  inOutQuad: t => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  outBack: t => { t = clamp(t, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + toHex(lerp(A[0], B[0], t)) + toHex(lerp(A[1], B[1], t)) + toHex(lerp(A[2], B[2], t));
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  const f = v => amt < 0 ? v * (1 + amt) : v + (255 - v) * amt;
  return '#' + toHex(f(c[0])) + toHex(f(c[1])) + toHex(f(c[2]));
}
const rgbaCache = new Map();
function rgba(hex, a) {
  const al = clamp(a, 0, 1).toFixed(3), key = hex + al;
  let s = rgbaCache.get(key);
  if (!s) {
    const c = hexToRgb(hex);
    s = `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    if (rgbaCache.size < 6000) rgbaCache.set(key, s);
  }
  return s;
}

// Abgeleitete Farben pro Level, einmal berechnet
const COLORS = LEVELS.map(L => {
  const P = L.palette;
  return Object.assign({}, P, {
    mid: mix(P.far, P.near, 0.5),
    ground: shade(P.near, -0.25),
    pipeSide: shade(P.pipe, -CONFIG.SIDE_DARKEN),
    pipeLight: shade(P.pipe, 0.25),
    pipeDark: shade(P.pipe, -0.45),
    accentSide: shade(P.accent, -CONFIG.SIDE_DARKEN),
    accentLight: mix(P.accent, CREAM, 0.5),
    haze: mix(P.skyBottom, P.far, 0.25)
  });
});

// Deterministisches Rauschen
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
const h2 = (a, b) => hash(a * 12.9898 + b * 78.233);
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Periodisches Wertrauschen: n Gitterpunkte pro Periode, damit Ebenen nahtlos kacheln
function pnoise(u, n, seed) {
  const i = Math.floor(u), f = u - i, s = f * f * (3 - 2 * f);
  const a = hash((((i % n) + n) % n) * 1.731 + seed * 17.13);
  const b = hash(((((i + 1) % n) + n) % n) * 1.731 + seed * 17.13);
  return a + (b - a) * s;
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inRect = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
function circleBox(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
// Trennachsentest: achsenparalleles Rechteck gegen konvexes Polygon (Punkte als [x, y])
function polyHitsBox(pts, ox, oy, b) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    const x = p[0] + ox, y = p[1] + oy;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX <= b.x || minX >= b.x + b.w || maxY <= b.y || minY >= b.y + b.h) return false;
  const bx = [b.x, b.x + b.w, b.x + b.w, b.x], by = [b.y, b.y, b.y + b.h, b.y + b.h];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const nx = -(q[1] - p[1]), ny = q[0] - p[0];
    let pMin = Infinity, pMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const r of pts) { const d = (r[0] + ox) * nx + (r[1] + oy) * ny; if (d < pMin) pMin = d; if (d > pMax) pMax = d; }
    for (let j = 0; j < 4; j++) { const d = bx[j] * nx + by[j] * ny; if (d < bMin) bMin = d; if (d > bMax) bMax = d; }
    if (pMax <= bMin || bMax <= pMin) return false;
  }
  return true;
}


// ============================================================
// Canvas in nativer Displayauflösung. Logische Höhe fest 600,
// logische Breite aus dem Seitenverhältnis (360 bis 1000).
// ============================================================
const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
let ctx = mainCtx;
const view = { scale: 1, dpr: 1, k: 1, resizedAt: 0 };
function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function freeCanvas(c) {
  if (c && c.width) { c.width = 1; c.height = 1; }
}
// Zwischenebene für Überblendungen und Dunkelheit, nur bei Bedarf in voller Größe
const fadeLayer = { canvas: newCanvas(1, 1) };
fadeLayer.ctx = fadeLayer.canvas.getContext('2d');
function sizeFadeLayer(on) {
  const w = on ? canvas.width : 1, h = on ? canvas.height : 1;
  if (fadeLayer.canvas.width !== w || fadeLayer.canvas.height !== h) {
    fadeLayer.canvas.width = w;
    fadeLayer.canvas.height = h;
    applyContextState(fadeLayer.ctx);
  }
}

// Transform per setTransform (nie ctx.scale), Kontextzustand nach jeder Größenänderung neu setzen
function applyContextState(c, sx = 0, sy = 0) {
  c.setTransform(view.k, 0, 0, view.k, view.k * sx, view.k * sy);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.lineWidth = 1;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.font = `bold ${FS.sm}px ${FONT}`;
  c.textBaseline = 'middle';
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

// Verfügbare Fläche: der Bühnencontainer (berücksichtigt Seitenrand und sichere Bereiche), sonst das Fenster
function availableSize() {
  const stage = document.getElementById('stage');
  const r = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
  return r && r.width > 0 && r.height > 0 ? [r.width, r.height] : [window.innerWidth || 400, window.innerHeight || 600];
}
// Bildformat (Einstellung): 'auto' folgt dem Fenster, 'hoch' spielt in einer schmalen Spalte, 'quer' immer breit.
// Liegt hier statt in den Einstellungen, weil resize() schon vor deren Laden läuft.
const VIEWFMT = { format: 'auto', aw: 400, ah: 600 };
function targetW(aw, ah) {
  const w = Math.round(H * aw / ah);
  if (VIEWFMT.format === 'hoch') return clamp(w, CONFIG.W_PORTRAIT[0], CONFIG.W_PORTRAIT[1]);
  if (VIEWFMT.format === 'quer') return clamp(w, CONFIG.W_LANDSCAPE[0], CONFIG.W_LANDSCAPE[1]);
  return clamp(w, CONFIG.W_MIN, CONFIG.W_MAX);
}
// Querformat gewählt, aber das Gerät steht hochkant (oder umgekehrt): Hinweis zum Drehen
const formatMismatch = () => (VIEWFMT.format === 'quer' && VIEWFMT.ah > VIEWFMT.aw * 1.15);
function resize() {
  const [aw, ah] = availableSize();
  const oldW = W;
  VIEWFMT.aw = aw; VIEWFMT.ah = ah;
  W = targetW(aw, ah);
  const scale = Math.min(aw / W, ah / H) || 1;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  view.scale = scale;
  view.dpr = dpr;
  view.k = scale * dpr;
  view.resizedAt = performance.now();
  if (fadeLayer.canvas.width > 1) sizeFadeLayer(true);
  applyContextState(mainCtx);
  if (typeof onViewChanged === 'function') onViewChanged(oldW);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 120); });

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / (r.width || W), y: (e.clientY - r.top) * H / (r.height || H) };
}
function withCtx(c, fn) {
  const saved = ctx;
  ctx = c;
  try { fn(c); } finally { ctx = saved; }
}
// Bild im Gerätemaßstab deckend oder mit Alpha auf das aktuelle Ziel kopieren
function blit(src, alpha) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(src, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// ============================================================
// Eingabe: Klick, Tap und Leertaste lösen denselben Flap aus.
// Touch läuft über touchstart mit preventDefault (kein Scrollen,
// keine emulierten Mausereignisse), Maus und Stift über Pointer.
// ============================================================
function focusCanvas() {
  try { canvas.focus({ preventScroll: true }); } catch (err) { /* ohne Fokus weiter */ }
}
window.addEventListener('keydown', e => {
  if (typeof dialogOpen === 'function' && dialogOpen()) return;   // Eingaben gehören dem offenen Dialog
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  onKey(e.code);
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches && e.changedTouches[0];
  if (t) { focusCanvas(); onPress(toLogical(t), 'touch'); }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.changedTouches && e.changedTouches[0];
  if (t) onDrag(toLogical(t));
}, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); onRelease(); }, { passive: false });
canvas.addEventListener('touchcancel', () => onRelease());
if (window.PointerEvent) {
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;                          // Touch kommt über touchstart
    e.preventDefault();
    focusCanvas();
    onPress(toLogical(e), 'pointer');
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') onDrag(toLogical(e)); });
  window.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') onRelease(); });
} else {
  canvas.addEventListener('mousedown', e => { e.preventDefault(); focusCanvas(); onPress(toLogical(e), 'pointer'); });
  canvas.addEventListener('mousemove', e => onDrag(toLogical(e)));
  window.addEventListener('mouseup', () => onRelease());
}
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
// Zeichenhelfer (arbeiten auf dem aktuellen ctx)
// ============================================================
function roundRectPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ellipse(x, y, rx, ry, rot, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}
function circle(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}
function poly(pts, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function line(x1, y1, x2, y2, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function text(str, x, y, size, fill, opt = {}) {
  ctx.font = `${opt.weight || 'bold'} ${size}px ${FONT}`;
  ctx.textAlign = opt.align || 'center';
  ctx.textBaseline = 'middle';
  if (opt.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = opt.lw || Math.max(2, size / 7);
    ctx.strokeStyle = opt.stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}
function wrapLines(str, maxW, size, weight = 'normal') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}


