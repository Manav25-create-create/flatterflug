// ============================================================
// Kulissen: einzelne Motive pro Biom (Gebäude, Planeten, Ruinen ...),
// die sich entlang des Levels nicht wiederholen. Jede Spur hat einen
// eigenen Parallaxfaktor und liegt vor einer der drei periodischen
// Ebenen (z). Jedes Motiv wird einmal als Sprite gemalt und danach nur
// noch kopiert, Reihenfolge und Abstände sind pro Level fest (Seed).
//
// SCENE[schlüssel] = {
//   hideLayers: [0, 1],          // periodische Ebenen, die diese Kulisse ersetzt (optional)
//   tracks: [{
//     z: 0..3,                   // 0: direkt nach dem Himmel, 1: nach Ebene 0, 2: nach Ebene 1, 3: nach Ebene 2
//     factor: 0.3,               // Parallax: Spur-x = Kamera-x * factor
//     start: 80,                 // Spur-x des ersten Motivs
//     gap: [40, 160],            // Abstand zwischen rechter Kante und nächstem Motiv (darf negativ sein: Überlappung)
//     maxKs: 2,                  // höchste Auflösung der Sprites (Gerätepixel pro logischem Pixel)
//     pick: (i, rng) => 'name',  // welches Motiv als i-tes kommt (Abfolge, "Ablauf")
//     base: (i, rng, kind, h) => y, // Unterkante des Motivs (logisch), Standard GROUND_Y
//     kinds: { name: { size: rng => [w, h], paint: (w, h, rng, C, L) => {...}, tex: { grain, mottle } } }
//   }]
// }
// paint zeichnet mit den üblichen Helfern (ctx, poly, circle, vgrad ...) im Bereich [0, w] x [0, h].
// Schlüssel ist LEVELS[i].scene oder der Biomname.
// ============================================================
const SCENE = {};
const SCENE_SPRITES_MAX = 40;

function sceneOf(li) {
  const L = LEVELS[li];
  return (L && SCENE[L.scene || L.name]) || null;
}
const sceneHidesLayer = (li, i) => { const S = sceneOf(li); return !!(S && S.hideLayers && S.hideLayers.includes(i)); };

function newSceneTrack(li, ti, T) {
  return { T, ti, items: [], first: 0, nextX: T.start || 0, rng: mulberry32((li + 1) * 7331 + ti * 977 + 13) };
}

// Zustand pro Level-Cache: Spuren mit erzeugten Motiven und gemalten Sprites
function sceneState(cache) {
  if (cache.scene !== undefined) return cache.scene;
  const S = sceneOf(cache.li);
  cache.scene = S ? { S, li: cache.li, tracks: S.tracks.map((T, ti) => newSceneTrack(cache.li, ti, T)), sprites: new Map() } : null;
  return cache.scene;
}

// Motive bis zur Spur-x x1 erzeugen (deterministisch, unabhängig vom Bildschirm)
function sceneGen(st, x1) {
  const T = st.T, rng = st.rng;
  while (st.nextX <= x1 && st.items.length < 4000) {
    const i = st.items.length, kind = T.pick ? T.pick(i, rng) : Object.keys(T.kinds)[0];
    const K = T.kinds[kind];
    const seed = Math.floor(rng() * 2147483646) + 1;
    const sz = K.size ? K.size(mulberry32(seed)) : [K.w || 60, K.h || 60];
    const w = Math.max(4, Math.round(sz[0])), h = Math.max(4, Math.round(sz[1]));
    const yb = T.base ? T.base(i, rng, kind, h) : GROUND_Y;
    st.items.push({ i, kind, x: st.nextX, w, h, yb, seed });
    const g = T.gap || [40, 120];
    st.nextX += w + g[0] + rng() * (g[1] - g[0]);
  }
}

// Sprites in voller Geräteauflösung: Dann ist jedes Zeichnen eine 1:1-Kopie ohne Filter. Skaliertes Kopieren
// großer Motive kostete auf Handys ein Vielfaches (gemessen 15 bis 30 ms statt 3 bis 5 ms pro Bild).
function sceneSpriteKs() {
  return Math.max(0.5, Math.min(view.k, CONFIG.CACHE_MAX_SCALE));
}

function paintSceneSprite(sc, st, it) {
  const T = st.T, K = T.kinds[it.kind], ks = sceneSpriteKs(), C = COLORS[sc.li], L = LEVELS[sc.li];
  const s = makeSprite(0, 0, it.w, it.h, ks, () => K.paint(it.w, it.h, mulberry32(it.seed + 1), C, L, it), K.tex);
  s.ks = ks;
  return s;
}

function sceneSprite(sc, st, it) {
  const key = st.ti + ':' + it.i;
  let s = sc.sprites.get(key);
  if (s && s.ks !== sceneSpriteKs()) { freeCanvas(s.c); sc.sprites.delete(key); s = null; }
  if (!s) {
    s = paintSceneSprite(sc, st, it);
    sc.sprites.set(key, s);
    if (sc.sprites.size > SCENE_SPRITES_MAX) sceneEvict(sc);
  }
  s.used = frame;
  return s;
}

// Die am längsten nicht gebrauchten Sprites freigeben
function sceneEvict(sc) {
  const list = [...sc.sprites.entries()].sort((a, b) => a[1].used - b[1].used);
  for (let i = 0; i < list.length - SCENE_SPRITES_MAX + 8; i++) { freeCanvas(list[i][1].c); sc.sprites.delete(list[i][0]); }
}

function freeSceneState(cache) {
  if (!cache.scene) return;
  for (const s of cache.scene.sprites.values()) freeCanvas(s.c);
  cache.scene.sprites.clear();
}

// Alle Spuren mit Ebene z zeichnen (Gerätepixel, ganzzahlig, wie die Streifen)
function drawSceneTracks(cache, z, camX) {
  const sc = sceneState(cache);
  if (!sc) return;
  const k = view.k;
  for (const st of sc.tracks) {
    if ((st.T.z === undefined ? 1 : st.T.z) !== z) continue;
    const off = camX * st.T.factor, x0 = off - 16, x1 = off + W + 16;
    sceneGen(st, x1);
    if (st.first >= st.items.length || st.items[st.first].x > x0) st.first = 0;
    while (st.first < st.items.length - 1 && st.items[st.first].x + st.items[st.first].w < x0) {
      // Motive, die links aus dem Bild sind, kommen in diesem Versuch nicht wieder: Speicher freigeben
      const key = st.ti + ':' + st.items[st.first].i, old = sc.sprites.get(key);
      if (old) { freeCanvas(old.c); sc.sprites.delete(key); }
      st.first++;
    }
    for (let j = st.first; j < st.items.length; j++) {
      const it = st.items[j];
      if (it.x > x1) break;
      if (it.x + it.w < x0) continue;
      const s = sceneSprite(sc, st, it);
      const dx = Math.round((it.x - off) * k), dy = Math.round((it.yb - it.h) * k);
      const f = k / s.ks;
      ctx.imageSmoothingEnabled = f !== 1;
      ctx.drawImage(s.c, dx, dy, Math.round(s.c.width * f), Math.round(s.c.height * f));
    }
  }
  ctx.imageSmoothingEnabled = true;
}

// Im Leerlauf das nächste noch ungemalte Motiv vorbereiten, das bald ins Bild kommt
function scenePrepaint(li, camX) {
  const cache = levelCaches.get(li);
  if (!cache || !cache.ready) return false;
  const sc = sceneState(cache);
  if (!sc) return false;
  for (const st of sc.tracks) {
    const off = camX * st.T.factor, x1 = off + W * 2;
    sceneGen(st, x1);
    for (let j = st.first; j < st.items.length; j++) {
      const it = st.items[j];
      if (it.x > x1) break;
      if (it.x + it.w < off - 16) continue;
      if (!sc.sprites.has(st.ti + ':' + it.i)) { sceneSprite(sc, st, it); return true; }
    }
  }
  return false;
}

// Vorschaubild: sichtbare Motive direkt in die Miniatur malen
function drawSceneThumb(li, g, kt, camX, z) {
  const S = sceneOf(li);
  if (!S) return;
  S.tracks.forEach((T, ti) => {
    if ((T.z === undefined ? 1 : T.z) !== z) return;
    const st = newSceneTrack(li, ti, T), off = camX * T.factor;
    sceneGen(st, off + W + 16);
    for (const it of st.items) {
      if (it.x + it.w < off - 16 || it.x > off + W + 16) continue;
      const K = T.kinds[it.kind];
      g.save();
      g.setTransform(kt, 0, 0, kt, Math.round((it.x - off) * kt), Math.round((it.yb - it.h) * kt));
      setupG(g);
      withCtx(g, () => K.paint(it.w, it.h, mulberry32(it.seed + 1), COLORS[li], LEVELS[li], it));
      g.restore();
    }
  });
}

