// ============================================================
// CONFIG: alle Tuning-Werte. Logische Höhe fest 600, logische Breite
// passt sich dem Seitenverhältnis an (360 bis 1400, wählbar Hoch/Quer). Physik mit festem
// 60-FPS-Schritt, Einheiten px pro Frame.
// ============================================================
const CONFIG = {
  H: 600,
  W_MIN: 360,
  W_MAX: 1400,                    // breite Monitore: mehr Weitblick
  W_PORTRAIT: [360, 450],         // Hochformat: schmale Spalte
  W_LANDSCAPE: [760, 1400],       // Querformat: mindestens so breit
  GROUND_H: 56,

  // Grundphysik, pro Level überschreibbar (physicsOverride)
  GRAVITY: 0.45,
  FLAP_IMPULSE: -8,
  MAX_FALL_SPEED: 12,
  SCROLL_SPEED: 2.5,              // Grundtempo; Wind (ab Level 8) macht es zeitweise schneller oder langsamer

  // Rohre
  PIPE_WIDTH: 60,
  PIPE_SPACING: 220,
  PIPE_EDGE_MARGIN: 60,           // Lücke mindestens 60 von Decke und Boden
  MOVING_EDGE_MARGIN: 50,         // bewegte Lücke nie näher als 50 an Decke und Boden
  PIPE_MAX_STEP: 170,             // max. Unterschied zweier aufeinanderfolgender Lückenmitten
  PIPE_SPAWN_AHEAD: 140,
  PIPE_CAP_H: 24,
  PIPE_CAP_OVERHANG: 4,           // rein optisch, Hitbox bleibt PIPE_WIDTH
  PIPES_BASE: 10,                 // Level n braucht 10 + 2*(n-1) Rohre, das letzte Level 50
  PIPES_STEP: 2,
  PIPES_LAST: 50,
  CP_EXTRA: 200,                  // Fortsetzen am Checkpoint: so viel mehr Anlauf vor dem nächsten Rohr
  TILT_MARGIN: 14,                // kippende Paare: zusätzlicher Abstand zu Decke und Boden

  // Vogel
  BIRD_W: 34,
  BIRD_H: 24,
  BIRD_X_FRAC: 0.2,               // Vogel-x = 0.2 * LOGICAL_W
  BIRD_START_Y: 250,
  BIRD_HITBOX_INSET: 2,
  SHOT_HITBOX_INSET: 3,
  CEILING_BOUNCE_VY: 1.5,         // Decke ist nicht tödlich: sanft abprallen

  // Boss
  BOSS_X_FRAC: 0.75,
  BOSS_W: 90,
  BOSS_H: 110,
  BOSS_Y_MIN: 80,
  BOSS_Y_MAX: 420,
  BOSS_Y_SPEED: 1.2,
  BOSS_INTRO_FRAMES: 90,          // fliegt ein, greift nicht an
  BOSS_GRACE_FRAMES: 120,         // Schonfrist mit "Bereit machen"
  BOSS_MOUTH_DX: 6,
  BOSS_MOUTH_DY: 48,
  BOSS_HIT_FLASH: 12,
  BOSS_DEFEAT_FLASH: 48,
  BOSS_FALL_GRAVITY: 0.35,
  RUSH_HITS: 2,                   // Boss-Ansturm im letzten Level: Treffer pro Boss
  RUSH_INTRO_FRAMES: 70,          // Einflug des nächsten Bosses im Ansturm
  RUSH_CHECKPOINTS: [7, 13],      // Leicht/Mittel: nach Boss 7 und Boss 13 geht es bei einem Absturz dort weiter
  ATTACK_COOLDOWN: 90,
  TELEGRAPH_FRAMES: 30,
  TELEGRAPH_LONG: 60,             // flächige und säulenartige Angriffe
  PROJECTILE_SPEED: 4.0,
  AIM_VY_MAX: 5,
  WAVE_GAP: 150,
  WAVE_SPEED: 2.5,

  // Ablauf
  CROSSFADE_FRAMES: 90,
  DEFEAT_MIN_FRAMES: 120,
  DEATH_PANEL_DELAY: 40,
  RESTART_LOCK: 20,
  INTRO_LOCK: 18,
  CHECKPOINT_FROM: 8,             // Index: ab Level 9 Checkpoint bei der Hälfte (nicht auf Schwer)
  CHECKPOINT_BANNER: 120,

  // Fähigkeiten (ab Level 3): wirken sofort 5 Sekunden lang. Schlechte Kugeln ab Level 5
  ABILITY_FROM: 2,
  DEBUFF_FROM: [['TEMPO', 4], ['RIESE', 9], ['BLEI', 13]],   // Art, ab Level-Index
  TEMPO_FACTOR: 1.3,
  GROW_SCALE: 1.45,
  LEAD_GRAVITY: 1.3,
  ABILITY_FRAMES: 300,
  SLOW_FACTOR: 0.6,
  SHRINK_SCALE: 0.6,
  REVIVE_INVULN: 60,

  // Darstellung
  PARALLAX: [0.2, 0.5, 0.8],
  SHADOW_ALPHA: 0.25,
  SIDE_DARKEN: 0.15,
  PARTICLE_MAX: 220,
  SHAKE_HIT: [6, 20],             // Amplitude, Abklingzeit in Frames
  SHAKE_CEILING: [2, 4],
  CACHE_MAX_SCALE: 4,
  STORAGE_KEY: 'flatterflug-20-biome-v5',         // Stand v5: 20 Level, Arrays mit Levelnamen
  STORAGE_KEY_V4: 'flatterflug-15-biome-v4',      // nur noch lesen (Übernahme per Levelname)
  STORAGE_KEY_V3: 'flatterflug-15-biome-v3',      // nur noch lesen (Übernahme, alte Levelreihenfolge)
  STORAGE_KEY_OLD: 'flatterflug-zehn-biome-v2',   // nur noch lesen (Übernahme)
  SETTINGS_KEY: 'flatterflug-einstellungen',      // Einstellungen bis v3, nur noch lesen
  MUSIC_KEY: 'flatterflug-musik',
  CLOUD_DELAY: 300,                               // Cloud-Speichern entprellen (ms)
  CLOUD_RETRY: [5000, 60000],                     // Zurückhalten nach Cloud-Fehlern: erste Pause, Obergrenze (ms)
  PASSWORD: 'bot',
  CODE_ALPHABET: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // ohne 0/O und 1/I
};

const H = CONFIG.H, TAU = Math.PI * 2;
let W = 400;                                        // wird in resize() gesetzt
const GROUND_Y = H - CONFIG.GROUND_H;
const birdHomeX = () => Math.round(W * CONFIG.BIRD_X_FRAC);
const birdHomeCX = () => birdHomeX() + CONFIG.BIRD_W / 2;
// Der Boss steht auf schmalen Bildschirmen bei etwa 0.75 W, auf breiten nie weiter als 360 vom Vogel entfernt
const bossDist = () => clamp(W * 0.55, 198, 360);
const bossHomeX = () => Math.round(birdHomeCX() + bossDist() - CONFIG.BOSS_W / 2);
const LIGHT_DIR = { x: -0.6, y: -0.8 };                          // Licht fällt von oben links ein
const SHADOW = { x: -LIGHT_DIR.x * 10, y: -LIGHT_DIR.y * 10 };   // Schlagschatten entgegen der Lichtrichtung
const INK = '#1e1a2c';
const CREAM = '#f6efe0';
const FONT = '"Trebuchet MS", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif';
const FS = { title: 38, xl: 44, lg: 28, md: 18, sm: 15, xs: 13, xxs: 11 };
let REDUCED_MOTION = false;
try { REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* Standard */ }

// Zufall: im Spiel Math.random, im Autotest ein fester Seed
let RNG = Math.random;

// Angriffsmuster der Bosse. warn = sichtbare Vorwarnung in Frames.
const PATTERNS = {
  aimed:     { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Gezielter Schuss' },
  salvo3:    { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Dreiersalve: knapp zwischen die Bahnen oder weit vorbei' },
  arc:       { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Bogenwurf' },
  diverge:   { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Zwei Schüsse, einer schert aus' },
  wave:      { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Langsame Welle mit Lücke' },
  riser:     { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Schuss, der aufsteigt' },
  column:    { warn: CONFIG.TELEGRAPH_LONG, active: 20, label: 'Blitzsäule an deiner Position' },
  split:     { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Brocken, der in drei Teile zerfällt' },
  laser:     { warn: CONFIG.TELEGRAPH_LONG, active: 12, label: 'Laser mit Ziellinie' },
  spiral:    { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Rotierender Ring: ruhig bleiben oder weit ausweichen' },
  shatter:   { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Geschoss, das in der Mitte zersplittert' },
  twinwave:  { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Zwei Wellen aus beiden Richtungen' },
  gearroll:  { warn: CONFIG.TELEGRAPH_LONG, label: 'Zahnrad rollt am Boden oder an der Decke' },
  emberrain: { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Glutregen mit sicherer Spalte' },
  alternate: { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Gezielter Schuss und Welle im Wechsel' },
  petal:     { warn: CONFIG.TELEGRAPH_FRAMES + 6, label: 'Langsames Blütenblatt, schwebt leicht' },
  bounce:    { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Muschel prallt einmal am Wasser ab' },
  zigzag:    { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Blatt im Zickzack: weit ausweichen' },
  converge:  { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Zwei Steine treffen sich an deiner Stelle' },
  ticktock:  { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Tick, tack, tick: drei Zahnräder im Takt' }
};

// ============================================================
// LEVELS: ein Eintrag pro Biom, sortiert von friedlich zu bedrohlich.
// Schwierigkeit steigt mit der Position: mehr Rohre und neue Hindernisse
// (siehe MECH_PLAN unter der Liste, setzt pipeCount, movingPipes, sidePipes,
// tiltPipes, wind, dark und hazard). Ein Eintrag: name, pipeGap, palette (6),
// physicsOverride, boss, music, skinId; Darstellung: style, sky, layers, hint.
// Palette: skyTop, skyBottom, far, near, pipe, accent.
// ============================================================
const LEVELS = [
  {
    name: 'Blütenhain', pipeGap: 183,
    palette: { skyTop: '#86bde8', skyBottom: '#fbe3ec', far: '#e3b8d4', near: '#93c27e', pipe: '#d68fb0', accent: '#f4c84f' },
    physicsOverride: {},
    boss: { pattern: 'petal', name: 'Blütenmotte' },
    music: { scale: 'majorPent', root: 64, bpm: 92, waves: { lead: 'triangle', bass: 'sine', pad: 'triangle' }, filter: 5600, delayFb: 0.3, reverb: 0.4, perc: 'light', feel: 'bright', seed: 1601 },
    skinId: 16,
    ambient: 'pollen',
    style: { boss: 'moth', pipe: 'stem', ground: 'grass', projectile: 'petal', pipeNoun: 'Blütenstängel' },
    sky: { body: 'sun', sunX: 0.7, sunY: 110, cirrus: true },
    layers: [
      { kind: 'hills', P: 1000, base: 412, amp: 80, freq: 0.004, seed: 161, clouds: true, haze: 0.3, specks: true },
      { kind: 'hills', P: 1200, base: 474, amp: 50, freq: 0.006, seed: 162, trees: 0.6, fields: true, color: '#9cc884' },
      { kind: 'props', P: 1400, prop: 'meadow', spacing: 44, seed: 163 }
    ],
    hint: 'Flieg durch die Lücken zwischen den Stängeln. Die Decke ist harmlos, nur der Boden nicht.'
  },
  {
    name: 'Wiese', pipeGap: 183,
    palette: { skyTop: '#6fa9dc', skyBottom: '#f1e4c0', far: '#9cc79a', near: '#5b9a48', pipe: '#6eaf54', accent: '#eebd4a' },
    physicsOverride: {},
    boss: { pattern: 'aimed', name: 'Hummelkönigin' },
    music: { scale: 'majorPent', root: 60, bpm: 100, waves: { lead: 'triangle', bass: 'triangle', pad: 'triangle' }, filter: 5200, delayFb: 0.24, reverb: 0.3, perc: 'light', feel: 'bright', seed: 101 },
    skinId: 1,
    ambient: 'pollen',
    style: { boss: 'bee', pipe: 'stem', ground: 'grass', projectile: 'pollen', pipeNoun: 'Pflanzenstängel' },
    sky: { body: 'sun', sunX: 0.76, sunY: 112, cirrus: true },
    layers: [
      { kind: 'hills', P: 1000, base: 408, amp: 96, freq: 0.004, seed: 11, clouds: true, haze: 0.3, specks: true },
      { kind: 'hills', P: 1200, base: 470, amp: 56, freq: 0.0065, seed: 12, trees: 0.55, fields: true, color: '#7db368' },
      { kind: 'props', P: 1400, prop: 'meadow', spacing: 46, seed: 13 }
    ],
    hint: 'Leuchtende Kugeln geben dir 5 Sekunden lang eine Fähigkeit. Einfach hindurchfliegen.'
  },
  {
    name: 'Wolken', pipeGap: 180,
    palette: { skyTop: '#86ace6', skyBottom: '#f6dce6', far: '#c8d4f2', near: '#e9e0f2', pipe: '#b9a5dd', accent: '#f6b77c' },
    physicsOverride: {},
    boss: { pattern: 'arc', name: 'Wolkenwal' },
    music: { scale: 'major', root: 65, bpm: 88, waves: { lead: 'triangle', bass: 'sine', pad: 'triangle' }, filter: 3400, delayFb: 0.36, reverb: 0.55, perc: 'soft', feel: 'soft', seed: 1212 },
    skinId: 12,
    ambient: 'feathers',
    style: { boss: 'whale', pipe: 'stem', ground: 'snow', projectile: 'bubble', wave: 'cloud', pipeNoun: 'Wolkensäule' },
    sky: { body: 'sun', sunX: 0.7, sunY: 120, pale: true, cirrus: true },
    layers: [
      { kind: 'hills', P: 1000, base: 400, amp: 40, freq: 0.004, seed: 121, clouds: true },
      { kind: 'hang', P: 1200, base: 60, amp: 40, freq: 0.01, seed: 122, clouds: true },
      { kind: 'dunes', P: 1400, base: 520, amp: 24, freq: 0.004, seed: 123 }
    ],
    hint: 'Die Wolkensäulen stehen noch still. Genieß die Aussicht, bald kommt Bewegung ins Spiel.'
  },
  {
    name: 'Lagune', pipeGap: 179,
    palette: { skyTop: '#4fb3d9', skyBottom: '#ffe1b3', far: '#86d0c4', near: '#2f9c8f', pipe: '#d9ad6c', accent: '#ff8a65' },
    physicsOverride: {},
    boss: { pattern: 'bounce', name: 'Lagunenkrabbe' },
    music: { scale: 'mixolydian', root: 62, bpm: 98, waves: { lead: 'triangle', bass: 'triangle', pad: 'sine' }, filter: 4600, delayFb: 0.3, reverb: 0.45, perc: 'light', feel: 'bright', swing: 0.08, seed: 1701 },
    skinId: 17,
    ambient: 'feathers',
    style: { boss: 'crab', pipe: 'stem', ground: 'sand', projectile: 'shell', pipeNoun: 'Palmenstamm' },
    sky: { body: 'sun', sunX: 0.78, sunY: 150, big: true },
    layers: [
      { kind: 'dunes', P: 1000, base: 470, amp: 30, freq: 0.004, seed: 171, haze: 0.3 },
      { kind: 'hills', P: 1200, base: 500, amp: 30, freq: 0.006, seed: 172, color: '#3aa89a' },
      { kind: 'props', P: 1400, prop: 'meadow', spacing: 80, seed: 173 }
    ],
    hint: 'Neu: Manche Palmenstämme fahren langsam auf und ab. Die Lücke bleibt gleich groß.'
  },
  {
    name: 'Ozean', pipeGap: 172,
    palette: { skyTop: '#1b5a82', skyBottom: '#3f9aa9', far: '#2a6d85', near: '#1b4a60', pipe: '#de796a', accent: '#8edece' },
    physicsOverride: { GRAVITY: 0.28, FLAP_IMPULSE: -6, MAX_FALL_SPEED: 7 },
    boss: { pattern: 'riser', name: 'Tiefseeangler' },
    music: { scale: 'lydian', root: 53, bpm: 72, waves: { lead: 'sine', bass: 'sine', pad: 'sine' }, filter: 3000, delayFb: 0.42, reverb: 0.75, perc: 'none', feel: 'deep', seed: 606 },
    skinId: 6,
    ambient: 'bubbles',
    style: { boss: 'angler', pipe: 'coral', ground: 'seabed', projectile: 'bubble', pipeNoun: 'Koralle' },
    sky: { body: 'none', rays: true, surface: true },
    layers: [
      { kind: 'reef', P: 1000, base: 456, amp: 116, freq: 0.005, seed: 61, haze: 0.42 },
      { kind: 'strands', P: 1200, spacing: 40, height: [170, 330], seed: 62 },
      { kind: 'props', P: 1400, prop: 'coral', spacing: 62, seed: 63 }
    ],
    hint: 'Unter Wasser: weniger Schwerkraft. Neu sind dunkle Kugeln: Sie machen dich schneller, also drüber oder drunter fliegen.'
  },
  {
    name: 'Eis', pipeGap: 180,
    palette: { skyTop: '#5f93cc', skyBottom: '#dceaf3', far: '#a3bfdc', near: '#e6eff5', pipe: '#9dcde6', accent: '#4e7dbd' },
    physicsOverride: {},
    boss: { pattern: 'salvo3', name: 'Frostgolem' },
    music: { scale: 'major', root: 62, bpm: 86, waves: { lead: 'sine', bass: 'sine', pad: 'sine' }, filter: 5600, delayFb: 0.5, reverb: 0.45, perc: 'sparse', feel: 'bells', seed: 202 },
    skinId: 2,
    ambient: 'snow',
    style: { boss: 'golem', pipe: 'ice', ground: 'snow', projectile: 'shard', pipeNoun: 'Eissäule' },
    sky: { body: 'sun', sunX: 0.24, sunY: 150, pale: true, aurora: true },
    layers: [
      { kind: 'peaks', P: 1000, base: 440, amp: 210, spacing: 170, seed: 21, caps: 0.42, haze: 0.38 },
      { kind: 'peaks', P: 1200, base: 494, amp: 124, spacing: 118, seed: 22, caps: 0.55, haze: 0.12 },
      { kind: 'props', P: 1400, prop: 'fir', spacing: 58, seed: 23 }
    ],
    hint: 'Mehr Eissäulen gleiten auf und ab.'
  },
  {
    name: 'Dschungel', pipeGap: 179,
    palette: { skyTop: '#2b5838', skyBottom: '#b2d093', far: '#44744c', near: '#21442b', pipe: '#6b4a2f', accent: '#bfdc62' },
    physicsOverride: {},
    boss: { pattern: 'diverge', name: 'Schlingchamäleon' },
    music: { scale: 'dorian', root: 55, bpm: 112, waves: { lead: 'triangle', bass: 'triangle', pad: 'triangle' }, filter: 3600, delayFb: 0.2, reverb: 0.3, perc: 'tribal', feel: 'wood', swing: 0.12, seed: 404 },
    skinId: 4,
    ambient: 'leaves',
    style: { boss: 'chameleon', pipe: 'trunk', ground: 'jungle', projectile: 'seed', pipeNoun: 'Baumstamm' },
    sky: { body: 'none', rays: true, mist: true },
    layers: [
      { kind: 'trunks', P: 1000, spacing: 78, width: [12, 26], seed: 41, haze: 0.3 },
      { kind: 'hang', P: 1200, base: 86, amp: 54, freq: 0.011, seed: 42, foliage: true, lianas: true },
      { kind: 'props', P: 1400, prop: 'fern', spacing: 50, seed: 43 }
    ],
    hint: 'Fast jeder zweite Stamm bewegt sich jetzt.'
  },
  {
    name: 'Wüste', pipeGap: 185,
    palette: { skyTop: '#6aa0cf', skyBottom: '#f4d8a2', far: '#e3b87c', near: '#c98c4b', pipe: '#d5a167', accent: '#df673d' },
    physicsOverride: {},
    boss: { pattern: 'wave', name: 'Sandskarabäus' },
    music: { scale: 'phrygDom', root: 52, bpm: 96, waves: { lead: 'sawtooth', bass: 'triangle', pad: 'sawtooth' }, filter: 1500, filterQ: 6, delayFb: 0.3, reverb: 0.3, perc: 'frame', feel: 'narrow', swing: 0.1, seed: 505 },
    skinId: 5,
    ambient: 'dust',
    style: { boss: 'scarab', pipe: 'sandstone', ground: 'sand', projectile: 'sand', pipeNoun: 'Sandsteinsäule' },
    sky: { body: 'sun', sunX: 0.72, sunY: 128, big: true, haze: true },
    layers: [
      { kind: 'dunes', P: 1000, base: 446, amp: 64, freq: 0.003, seed: 51, haze: 0.34 },
      { kind: 'mesas', P: 1200, base: 492, amp: 136, spacing: 196, seed: 52 },
      { kind: 'props', P: 1400, prop: 'cactus', spacing: 92, seed: 53 }
    ],
    hint: 'Neu: Wind. Rückenwind macht dich schneller, Gegenwind langsamer. Flugsand kündigt jede Böe an.'
  },
  {
    name: 'Herbstwald', pipeGap: 181,
    palette: { skyTop: '#6f86a8', skyBottom: '#f0c48a', far: '#b8743e', near: '#6f3b22', pipe: '#8a5a36', accent: '#e8642c' },
    physicsOverride: {},
    boss: { pattern: 'zigzag', name: 'Pilzkönig' },
    music: { scale: 'dorian', root: 57, bpm: 100, waves: { lead: 'triangle', bass: 'triangle', pad: 'triangle' }, filter: 3200, delayFb: 0.28, reverb: 0.4, perc: 'soft', feel: 'wood', seed: 1801 },
    skinId: 18,
    ambient: 'leaves',
    style: { boss: 'mushroom', pipe: 'trunk', ground: 'jungle', projectile: 'leaf', pipeNoun: 'Baumstamm' },
    sky: { body: 'sun', sunX: 0.28, sunY: 150, pale: true, haze: true },
    layers: [
      { kind: 'trunks', P: 1000, spacing: 84, width: [12, 24], seed: 181, haze: 0.35 },
      { kind: 'hills', P: 1200, base: 480, amp: 40, freq: 0.006, seed: 182, trees: 0.7, color: '#9a5a2e' },
      { kind: 'props', P: 1400, prop: 'fern', spacing: 54, seed: 183 }
    ],
    hint: 'Wind und bewegte Stämme kommen jetzt zusammen.'
  },
  {
    name: 'Sumpf', pipeGap: 186,
    palette: { skyTop: '#46594a', skyBottom: '#b3bd92', far: '#66785a', near: '#33452f', pipe: '#6f6243', accent: '#cfd76c' },
    physicsOverride: {},
    boss: { pattern: 'split', name: 'Irrlichtkröte' },
    music: { scale: 'minorPent', root: 45, bpm: 80, waves: { lead: 'triangle', bass: 'sawtooth', pad: 'triangle' }, filter: 1700, delayFb: 0.34, reverb: 0.45, perc: 'soft', feel: 'sluggish', seed: 909 },
    skinId: 9,
    ambient: 'spores',
    style: { boss: 'toad', pipe: 'trunk', ground: 'jungle', projectile: 'seed', pipeNoun: 'Moorpfahl' },
    sky: { body: 'sun', sunX: 0.3, sunY: 140, pale: true, haze: true },
    layers: [
      { kind: 'trunks', P: 1000, spacing: 90, width: [10, 20], seed: 91, haze: 0.4 },
      { kind: 'hills', P: 1200, base: 486, amp: 30, freq: 0.006, seed: 92 },
      { kind: 'props', P: 1400, prop: 'fern', spacing: 60, seed: 93 }
    ],
    hint: 'Neu bei den dunklen Kugeln: Manche machen dich größer. Weich ihnen aus.'
  },
  {
    name: 'Kristall', pipeGap: 182,
    palette: { skyTop: '#2c2a5c', skyBottom: '#9a8fd0', far: '#5d5ba3', near: '#36316c', pipe: '#8fd3df', accent: '#ef8fcf' },
    physicsOverride: {},
    boss: { pattern: 'shatter', name: 'Prismenwächter' },
    music: { scale: 'lydian', root: 64, bpm: 104, waves: { lead: 'sine', bass: 'triangle', pad: 'sine' }, filter: 7000, delayFb: 0.4, reverb: 0.5, perc: 'light', feel: 'bells', seed: 1111 },
    skinId: 11,
    ambient: 'glints',
    style: { boss: 'prism', pipe: 'ice', ground: 'cavefloor', projectile: 'shard', pipeNoun: 'Kristallsäule' },
    sky: { body: 'none', caveGlow: true },
    layers: [
      { kind: 'spikes', P: 1000, amp: 200, spacing: 130, seed: 111, crystals: true },
      { kind: 'spikes', P: 1200, amp: 120, spacing: 90, seed: 112, crystals: true },
      { kind: 'spikes', P: 1400, amp: 60, spacing: 56, seed: 113, crystals: true }
    ],
    hint: 'Kristallsäulen in Bewegung und kräftiger Wind.'
  },
  {
    name: 'Ruinen', pipeGap: 180,
    palette: { skyTop: '#3d4a5e', skyBottom: '#c99a6b', far: '#6b6a5c', near: '#3f4234', pipe: '#9a917a', accent: '#e0c060' },
    physicsOverride: {},
    boss: { pattern: 'converge', name: 'Steinwächter' },
    music: { scale: 'phrygian', root: 52, bpm: 96, waves: { lead: 'triangle', bass: 'sawtooth', pad: 'triangle' }, filter: 1800, delayFb: 0.32, reverb: 0.5, perc: 'frame', feel: 'narrow', seed: 1901 },
    skinId: 19,
    ambient: 'dust',
    style: { boss: 'guardian', pipe: 'sandstone', ground: 'sand', projectile: 'rock', pipeNoun: 'Tempelsäule' },
    sky: { body: 'sun', sunX: 0.3, sunY: 170, pale: true, haze: true },
    layers: [
      { kind: 'mesas', P: 1000, base: 460, amp: 120, spacing: 220, seed: 191, haze: 0.3 },
      { kind: 'trunks', P: 1200, spacing: 100, width: [10, 18], seed: 192 },
      { kind: 'props', P: 1400, prop: 'fern', spacing: 70, seed: 193 }
    ],
    hint: 'Neu: Die Säulen schwanken nach links und rechts. Achte auf den Abstand zur nächsten.'
  },
  {
    name: 'Höhle', pipeGap: 178,
    palette: { skyTop: '#2a2231', skyBottom: '#5e4c5f', far: '#4b3d4e', near: '#342a37', pipe: '#8b717b', accent: '#7ee1ce' },
    physicsOverride: {},
    boss: { pattern: 'column', name: 'Grottenspinne' },
    music: { scale: 'minor', root: 52, bpm: 60, waves: { lead: 'sine', bass: 'sine', pad: 'triangle' }, filter: 950, delayFb: 0.55, reverb: 0.6, perc: 'drip', feel: 'sparse', seed: 808 },
    skinId: 8,
    ambient: 'motes',
    style: { boss: 'spider', pipe: 'rock', ground: 'cavefloor', projectile: 'rock', ceiling: 'rock', pipeNoun: 'Felssäule' },
    sky: { body: 'none', caveGlow: true },
    layers: [
      { kind: 'hang', P: 1000, base: 104, amp: 60, freq: 0.01, seed: 81, points: true },
      { kind: 'spikes', P: 1200, amp: 160, spacing: 118, seed: 82, rock: true },
      { kind: 'spikes', P: 1400, amp: 66, spacing: 56, seed: 83, crystals: true }
    ],
    hint: 'Seitlich und auf und ab: Die Felssäulen bewegen sich in alle Richtungen.'
  },
  {
    name: 'Sturm', pipeGap: 182,
    palette: { skyTop: '#2b293d', skyBottom: '#6d628b', far: '#474061', near: '#2d2a3f', pipe: '#5e5476', accent: '#dbcaff' },
    physicsOverride: {},
    boss: { pattern: 'laser', name: 'Gewitterkoloss' },
    music: { scale: 'phrygian', root: 50, bpm: 140, waves: { lead: 'square', bass: 'sawtooth', pad: 'sawtooth' }, filter: 2600, delayFb: 0.26, reverb: 0.35, perc: 'storm', feel: 'storm', seed: 707 },
    skinId: 7,
    ambient: 'rain',
    style: { boss: 'stormcloud', pipe: 'tower', ground: 'wetrock', projectile: 'plasma', pipeNoun: 'Turm' },
    sky: { body: 'none', stormClouds: true, rain: true },
    layers: [
      { kind: 'peaks', P: 1000, base: 474, amp: 170, spacing: 140, seed: 71, haze: 0.28 },
      { kind: 'hang', P: 1200, base: 70, amp: 58, freq: 0.01, seed: 72, clouds: true },
      { kind: 'props', P: 1400, prop: 'windgrass', spacing: 30, seed: 73 }
    ],
    hint: 'Neu bei den dunklen Kugeln: Bleiflügel machen dich schwerer. Dazu Sturm und Bewegung.'
  },
  {
    name: 'Uhrwerk', pipeGap: 184,
    palette: { skyTop: '#2e231f', skyBottom: '#7d5b3b', far: '#5b4331', near: '#382a20', pipe: '#c18f46', accent: '#d97a4a' },
    physicsOverride: {},
    boss: { pattern: 'ticktock', name: 'Uhrwerkeule' },
    music: { scale: 'minor', root: 50, bpm: 118, waves: { lead: 'square', bass: 'triangle', pad: 'sawtooth' }, filter: 3000, delayFb: 0.2, reverb: 0.25, perc: 'clock', feel: 'clock', seed: 1313 },
    skinId: 13,
    ambient: 'none',
    style: { boss: 'owl', pipe: 'station', ground: 'deck', projectile: 'rock', pipeNoun: 'Messingrohr' },
    sky: { body: 'none', glow: true },
    layers: [
      { kind: 'city', P: 1000, base: 420, amp: 160, spacing: 70, seed: 131, windows: 0.1 },
      { kind: 'station', P: 1200, seed: 132 },
      { kind: 'spikes', P: 1400, amp: 50, spacing: 60, seed: 133, rock: true }
    ],
    hint: 'Die Rohre springen im Takt, dazu Wind und seitliches Schwanken.'
  },
  {
    name: 'Neon', pipeGap: 180,
    palette: { skyTop: '#121937', skyBottom: '#2e2566', far: '#212653', near: '#15183a', pipe: '#4fd1de', accent: '#df4fbd' },
    physicsOverride: {},
    boss: { pattern: 'spiral', name: 'Sektorwächter' },
    music: { scale: 'minor', root: 57, bpm: 124, waves: { lead: 'square', bass: 'square', pad: 'sawtooth' }, filter: 4200, delayFb: 0.32, reverb: 0.3, perc: 'synth', feel: 'arp', seed: 1010 },
    skinId: 10,
    ambient: 'none',
    style: { boss: 'mech', pipe: 'neon', ground: 'street', projectile: 'plasma', pipeNoun: 'Neonturm' },
    sky: { body: 'moon', glow: true, stars: 0.35 },
    layers: [
      { kind: 'city', P: 1000, base: 420, amp: 210, spacing: 46, seed: 101, windows: 0.22 },
      { kind: 'city', P: 1200, base: 484, amp: 180, spacing: 60, seed: 102, windows: 0.34, signs: true },
      { kind: 'city', P: 1400, base: 552, amp: 76, spacing: 86, seed: 103, windows: 0.3, roofs: true }
    ],
    hint: 'Neu: Die Neontürme kippen leicht zur Seite. Die Lücke liegt dann schräg.'
  },
  {
    name: 'Weltraum', pipeGap: 168,
    palette: { skyTop: '#0c0f24', skyBottom: '#2b1d48', far: '#3c2b61', near: '#1c2241', pipe: '#8f9bb9', accent: '#f0b35b' },
    physicsOverride: { GRAVITY: 0.30, FLAP_IMPULSE: -6.5 },
    boss: { pattern: 'alternate', name: 'Nebelqualle' },
    music: { scale: 'wholeTone', root: 50, bpm: 90, waves: { lead: 'sine', bass: 'sine', pad: 'triangle' }, filter: 4200, delayFb: 0.5, reverb: 0.6, perc: 'soft', feel: 'float', seed: 1515 },
    skinId: 15,
    ambient: 'none',
    style: { boss: 'jelly', pipe: 'station', ground: 'deck', projectile: 'plasma', wave: 'energy', pipeNoun: 'Stationsmodul' },
    sky: { body: 'planet', nebula: true, stars: 1 },
    layers: [
      { kind: 'stars', P: 1000, cell: 24, chance: 0.5, size: [0.6, 1.3], seed: 151 },
      { kind: 'stars', P: 1200, cell: 44, chance: 0.45, size: [1.0, 2.0], seed: 152, dust: true },
      { kind: 'station', P: 1400, seed: 153 }
    ],
    hint: 'Kaum Schwerkraft, dazu kippende und treibende Module.'
  },
  {
    name: 'Asche', pipeGap: 182,
    palette: { skyTop: '#1e1716', skyBottom: '#5e2d20', far: '#3b2a2a', near: '#211a1a', pipe: '#433836', accent: '#f08a3c' },
    physicsOverride: {},
    boss: { pattern: 'emberrain', name: 'Aschephönix' },
    music: { scale: 'harmMinor', root: 49, bpm: 92, waves: { lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth' }, filter: 1300, delayFb: 0.3, reverb: 0.4, perc: 'heavy', feel: 'dark', seed: 1414 },
    skinId: 14,
    ambient: 'sparks',
    style: { boss: 'phoenix', pipe: 'lava', ground: 'lavarock', projectile: 'blob', pipeNoun: 'Kohlesäule' },
    sky: { body: 'none', glow: true, smoke: true },
    layers: [
      { kind: 'peaks', P: 1000, base: 460, amp: 150, spacing: 200, seed: 141, haze: 0.2 },
      { kind: 'trunks', P: 1200, spacing: 110, width: [8, 16], seed: 142 },
      { kind: 'spikes', P: 1400, amp: 40, spacing: 50, seed: 143, cracks: true }
    ],
    hint: 'Kippen, Schwanken, Wind: Hier kommt alles zusammen.'
  },
  {
    name: 'Lava', pipeGap: 183,
    palette: { skyTop: '#2a1419', skyBottom: '#86331f', far: '#4d2320', near: '#2c1918', pipe: '#5a3026', accent: '#ef763b' },
    physicsOverride: {},
    boss: { pattern: 'twinwave', name: 'Magmageist' },
    music: { scale: 'minorPent', root: 52, bpm: 128, waves: { lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth' }, filter: 2400, delayFb: 0.22, reverb: 0.25, perc: 'rock', feel: 'distorted', seed: 303 },
    skinId: 3,
    ambient: 'ash',
    style: { boss: 'magma', pipe: 'lava', ground: 'lavarock', projectile: 'blob', pipeNoun: 'Glutsäule' },
    sky: { body: 'none', glow: true, smoke: true },
    layers: [
      { kind: 'peaks', P: 1000, base: 452, amp: 230, spacing: 270, seed: 31, volcano: true, haze: 0.18 },
      { kind: 'peaks', P: 1200, base: 498, amp: 132, spacing: 104, seed: 32, jagged: true, veins: true },
      { kind: 'spikes', P: 1400, amp: 54, spacing: 50, seed: 33, cracks: true }
    ],
    hint: 'Der letzte Einzelgegner wartet. Alles bewegt sich, schnell und weit.'
  },
  {
    name: 'Schattenreich', pipeGap: 184,
    palette: { skyTop: '#0b0812', skyBottom: '#2a1636', far: '#1d1226', near: '#120b18', pipe: '#3a2a46', accent: '#b06cff' },
    physicsOverride: {},
    boss: { pattern: 'aimed', name: 'Bossansturm' },
    music: { scale: 'harmMinor', root: 45, bpm: 84, waves: { lead: 'sawtooth', bass: 'sawtooth', pad: 'triangle' }, filter: 1400, delayFb: 0.4, reverb: 0.6, perc: 'heavy', feel: 'dark', seed: 2001 },
    skinId: 20,
    ambient: 'motes',
    style: { boss: 'jelly', pipe: 'rock', ground: 'cavefloor', projectile: 'plasma', pipeNoun: 'Schattensäule' },
    sky: { body: 'none', glow: true, stars: 0.2 },
    layers: [
      { kind: 'spikes', P: 1000, amp: 180, spacing: 140, seed: 201, rock: true },
      { kind: 'spikes', P: 1200, amp: 110, spacing: 96, seed: 202, rock: true },
      { kind: 'spikes', P: 1400, amp: 50, spacing: 56, seed: 203, crystals: true }
    ],
    hint: 'Neu: Dunkelheit. Du siehst nur in deiner Nähe, Leuchtkristalle helfen. Am Ende kommen alle 19 Bosse nacheinander.'
  }
];
// ============================================================
// Hindernisplan: alle vier Level etwas Neues, das in seinem ersten Level allein
// auftritt und danach mit dem Bisherigen kombiniert wird.
//   ab 4: auf und ab, ab 8: Wind (schneller/langsamer), ab 12: seitlich,
//   ab 16: kippend, ab 20: Dunkelheit.
// vert/side: [Anteil, Ausschlag px, Periode Frames, Art], tilt: [Anteil, Winkel rad, Periode]
// wind: Böe alle every Frames, dur lang, lead vorher angekündigt; tail/head = Tempofaktor
// ============================================================
const W8 = (every, tail, head) => ({ every, dur: 120, lead: 60, tail, head });
const MECH_PLAN = [
  {}, {}, {},
  { vert: [0.35, 26, 250] },
  { vert: [0.45, 30, 235] },
  { vert: [0.5, 32, 225] },
  { vert: [0.55, 34, 215] },
  { wind: W8(300, 1.3, 0.75) },
  { vert: [0.45, 32, 225], wind: W8(285, 1.3, 0.75) },
  { vert: [0.5, 34, 215], wind: W8(270, 1.33, 0.73) },
  { vert: [0.55, 36, 205], wind: W8(260, 1.35, 0.72) },
  { side: [0.45, 18, 210] },
  { vert: [0.45, 32, 215], side: [0.4, 18, 205] },
  { vert: [0.5, 34, 205], side: [0.4, 20, 200], wind: W8(260, 1.35, 0.72) },
  { vert: [0.55, 30, 260, 'step'], side: [0.45, 20, 195], wind: W8(250, 1.35, 0.72) },
  { tilt: [0.5, 0.15, 260] },
  { vert: [0.45, 34, 205], side: [0.35, 20, 195], tilt: [0.4, 0.14, 250] },
  { vert: [0.5, 36, 200], side: [0.4, 22, 190], tilt: [0.45, 0.15, 240], wind: W8(250, 1.35, 0.72) },
  { vert: [0.6, 38, 190], side: [0.45, 24, 185], tilt: [0.5, 0.16, 230], wind: W8(240, 1.37, 0.7) },
  { vert: [0.5, 34, 205], side: [0.4, 20, 195], tilt: [0.4, 0.14, 250], wind: W8(270, 1.33, 0.73), dark: { sight: 240 } }
];
// Level, in denen ein neues Hindernis dazukommt (Index): dort bekommt der Boss kein zusätzliches Leben
const NEW_MECH_LEVELS = new Set([0, 3, 7, 11, 15, 19]);
LEVELS.forEach((L, i) => {
  const M = MECH_PLAN[i] || {}, v = M.vert, sd = M.side, tl = M.tilt;
  L.pipeCount = i === LEVELS.length - 1 ? CONFIG.PIPES_LAST : CONFIG.PIPES_BASE + CONFIG.PIPES_STEP * i;
  L.movingPipes = v ? { share: v[0], amplitude: v[1], period: v[2], motion: v[3] || 'sine' } : { share: 0, amplitude: 0, period: 1, motion: 'sine' };
  L.sidePipes = sd ? { share: sd[0], amplitude: sd[1], period: sd[2] } : { share: 0, amplitude: 0, period: 1 };
  L.tiltPipes = tl ? { share: tl[0], angle: tl[1], period: tl[2] } : { share: 0, angle: 0, period: 1 };
  L.wind = M.wind || null;
  L.dark = M.dark || null;
  L.hazard = M.dark ? { type: 'darkness', params: { sight: M.dark.sight } } : { type: 'none', params: {} };
});
// Boss-Leben (= nötige Treffer): Level 1 hat 1, jedes Level ohne neues Hindernis +1
const BOSS_LIVES = (() => { const out = []; let n = 0; LEVELS.forEach((_, i) => { if (i === 0 || !NEW_MECH_LEVELS.has(i)) n++; out.push(n); }); return out; })();
const pipesFor = li => LEVELS[li].pipeCount;
const checkpointFor = li => (li >= CONFIG.CHECKPOINT_FROM ? Math.floor(LEVELS[li].pipeCount / 2) : 0);

// Levelcodes: vierstellig, deterministisch aus dem Index, eindeutig
const LEVEL_CODES = (() => {
  const A = CONFIG.CODE_ALPHABET, out = [], seen = new Set();
  for (let i = 0; i < LEVELS.length; i++) {
    let salt = 0, code = '';
    do {
      const r = mulberry32((Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b) ^ 0x2c1b3c6d) >>> 0);
      r(); r();
      code = '';
      for (let k = 0; k < 4; k++) code += A[Math.floor(r() * A.length)];
      salt++;
    } while (seen.has(code));
    seen.add(code);
    out.push(code);
  }
  return out;
})();

