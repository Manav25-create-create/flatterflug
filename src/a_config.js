// ============================================================
// CONFIG: alle Tuning-Werte. Logische Höhe fest 600, logische Breite
// passt sich dem Seitenverhältnis an (360 bis 1000). Physik mit festem
// 60-FPS-Schritt, Einheiten px pro Frame.
// ============================================================
const CONFIG = {
  H: 600,
  W_MIN: 360,
  W_MAX: 1000,
  GROUND_H: 56,

  // Grundphysik, pro Level überschreibbar (physicsOverride)
  GRAVITY: 0.45,
  FLAP_IMPULSE: -8,
  MAX_FALL_SPEED: 12,
  SCROLL_SPEED: 2.5,              // über alle 15 Level konstant

  // Rohre
  PIPE_WIDTH: 60,
  PIPE_SPACING: 220,
  PIPE_EDGE_MARGIN: 60,           // Lücke mindestens 60 von Decke und Boden
  MOVING_EDGE_MARGIN: 50,         // bewegte Lücke nie näher als 50 an Decke und Boden
  PIPE_MAX_STEP: 170,             // max. Unterschied zweier aufeinanderfolgender Lückenmitten
  PIPE_SPAWN_AHEAD: 140,
  PIPE_CAP_H: 24,
  PIPE_CAP_OVERHANG: 4,           // rein optisch, Hitbox bleibt PIPE_WIDTH
  PIPES_BASE: 12,                 // Level n braucht 12 + 2*(n-1) Rohre
  PIPES_STEP: 2,

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
  RUSH_CHECKPOINT: 8,             // Leicht/Mittel: nach dem 8. Boss geht es bei einem Absturz ab Boss 9 weiter
  ATTACK_COOLDOWN: 90,
  TELEGRAPH_FRAMES: 30,
  TELEGRAPH_LONG: 60,             // flächige und säulenartige Angriffe (Muster 7, 9, 13)
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
  CHECKPOINT_FROM: 8,             // Index: ab Level 9 Checkpoint bei der Hälfte
  CHECKPOINT_BANNER: 120,

  // Fähigkeiten (ab Level 3): wirken sofort 5 Sekunden lang
  ABILITY_FROM: 2,
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
  STORAGE_KEY: 'flatterflug-15-biome-v4',         // Stand v4: Fortschritt und Einstellungen in einem Datensatz
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
  alternate: { warn: CONFIG.TELEGRAPH_FRAMES, label: 'Gezielter Schuss und Welle im Wechsel' }
};

// ============================================================
// LEVELS: ein Eintrag pro Biom, sortiert von friedlich zu bedrohlich.
// Schwierigkeit steigt mit der Position: mehr Rohre, mehr und weitere
// Bewegung (movingPipes: auf und ab, sidePipes: links und rechts). Die Engine ist levelunabhängig,
// ein neues Biom ist ein neuer Eintrag aus vorhandenen Bausteinen.
// Pflichtfelder laut Vorgabe: name, pipeCount, pipeGap, palette (6),
// hazard {type, params}, physicsOverride, movingPipes, boss, music, skinId.
// Darstellung: style, sky, layers (drei Parallax-Ebenen), hint.
// Palette: skyTop, skyBottom, far, near, pipe, accent.
// ============================================================
const LEVELS = [
  {
    name: 'Wiese', pipeCount: 12, pipeGap: 183,
    palette: { skyTop: '#6fa9dc', skyBottom: '#f1e4c0', far: '#9cc79a', near: '#5b9a48', pipe: '#6eaf54', accent: '#eebd4a' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0, amplitude: 0, period: 1, motion: 'sine' },
    sidePipes: { share: 0, amplitude: 0, period: 1 },
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
    hint: 'Flieg durch die Lücken zwischen den Stängeln. Die Decke ist harmlos, nur der Boden nicht.'
  },
  {
    name: 'Wolken', pipeCount: 14, pipeGap: 180,
    palette: { skyTop: '#86ace6', skyBottom: '#f6dce6', far: '#c8d4f2', near: '#e9e0f2', pipe: '#b9a5dd', accent: '#f6b77c' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.25, amplitude: 24, period: 260, motion: 'sine' },
    sidePipes: { share: 0, amplitude: 0, period: 1 },
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
    hint: 'Einige Wolkensäulen schweben langsam auf und ab. Die Lücke bleibt immer gleich groß.'
  },
  {
    name: 'Ozean', pipeCount: 16, pipeGap: 168,
    palette: { skyTop: '#1b5a82', skyBottom: '#3f9aa9', far: '#2a6d85', near: '#1b4a60', pipe: '#de796a', accent: '#8edece' },
    hazard: { type: 'none', params: {} },
    physicsOverride: { GRAVITY: 0.28, FLAP_IMPULSE: -6, MAX_FALL_SPEED: 7 },
    movingPipes: { share: 0.3, amplitude: 26, period: 250, motion: 'sine' },
    sidePipes: { share: 0, amplitude: 0, period: 1 },
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
    hint: 'Unter Wasser: weniger Schwerkraft, sanftere Flügelschläge. Leuchtende Kugeln geben dir 5 Sekunden lang eine Fähigkeit.'
  },
  {
    name: 'Dschungel', pipeCount: 18, pipeGap: 177,
    palette: { skyTop: '#2b5838', skyBottom: '#b2d093', far: '#44744c', near: '#21442b', pipe: '#6b4a2f', accent: '#bfdc62' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.3, amplitude: 28, period: 240, motion: 'sine' },
    sidePipes: { share: 0.25, amplitude: 14, period: 220 },
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
    hint: 'Neu: Manche Stämme schwanken nach links und rechts. Achte auf den Abstand zum nächsten Stamm.'
  },
  {
    name: 'Wüste', pipeCount: 20, pipeGap: 181,
    palette: { skyTop: '#6aa0cf', skyBottom: '#f4d8a2', far: '#e3b87c', near: '#c98c4b', pipe: '#d5a167', accent: '#df673d' },
    hazard: { type: 'wind', params: { every: 240, dur: 90, drift: 0.8, lead: 45 } },
    physicsOverride: {},
    movingPipes: { share: 0.35, amplitude: 30, period: 230, motion: 'sine' },
    sidePipes: { share: 0.2, amplitude: 14, period: 220 },
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
    hint: 'Windböen schieben dich vor oder zurück. Flugsand kündigt jede Böe an und zeigt die Richtung.'
  },
  {
    name: 'Sumpf', pipeCount: 22, pipeGap: 176,
    palette: { skyTop: '#46594a', skyBottom: '#b3bd92', far: '#66785a', near: '#33452f', pipe: '#6f6243', accent: '#cfd76c' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.4, amplitude: 32, period: 220, motion: 'sine' },
    sidePipes: { share: 0.25, amplitude: 16, period: 210 },
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
    hint: 'Viele Pfähle treiben auf und ab, einige schwanken zur Seite.'
  },
  {
    name: 'Eis', pipeCount: 24, pipeGap: 176,
    palette: { skyTop: '#5f93cc', skyBottom: '#dceaf3', far: '#a3bfdc', near: '#e6eff5', pipe: '#9dcde6', accent: '#4e7dbd' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.4, amplitude: 32, period: 215, motion: 'sine' },
    sidePipes: { share: 0.45, amplitude: 20, period: 200 },
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
    hint: 'Auf dem Eis rutschen die Säulen weit nach links und rechts.'
  },
  {
    name: 'Kristall', pipeCount: 26, pipeGap: 175,
    palette: { skyTop: '#2c2a5c', skyBottom: '#9a8fd0', far: '#5d5ba3', near: '#36316c', pipe: '#8fd3df', accent: '#ef8fcf' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.5, amplitude: 34, period: 205, motion: 'sine' },
    sidePipes: { share: 0.3, amplitude: 18, period: 200 },
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
    hint: 'Die Kristallsäulen bewegen sich schneller und weiter.'
  },
  {
    name: 'Höhle', pipeCount: 28, pipeGap: 176,
    palette: { skyTop: '#2a2231', skyBottom: '#5e4c5f', far: '#4b3d4e', near: '#342a37', pipe: '#8b717b', accent: '#7ee1ce' },
    hazard: { type: 'darkness', params: { sight: 220 } },
    physicsOverride: {},
    movingPipes: { share: 0.45, amplitude: 34, period: 210, motion: 'sine' },
    sidePipes: { share: 0.3, amplitude: 18, period: 200 },
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
    hint: 'Es ist dunkel, du siehst nur in deiner Nähe. Leuchtkristalle an den Säulen helfen.'
  },
  {
    name: 'Sturm', pipeCount: 30, pipeGap: 180,
    palette: { skyTop: '#2b293d', skyBottom: '#6d628b', far: '#474061', near: '#2d2a3f', pipe: '#5e5476', accent: '#dbcaff' },
    hazard: { type: 'wind', params: { every: 200, dur: 90, drift: 1.0, lead: 45 } },
    physicsOverride: {},
    movingPipes: { share: 0.5, amplitude: 36, period: 200, motion: 'sine' },
    sidePipes: { share: 0.35, amplitude: 20, period: 190 },
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
    hint: 'Starke Böen und schwankende Türme. Der Flugsand zeigt, woher der Wind kommt.'
  },
  {
    name: 'Uhrwerk', pipeCount: 32, pipeGap: 177,
    palette: { skyTop: '#2e231f', skyBottom: '#7d5b3b', far: '#5b4331', near: '#382a20', pipe: '#c18f46', accent: '#d97a4a' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.55, amplitude: 30, period: 260, motion: 'step' },
    sidePipes: { share: 0.35, amplitude: 20, period: 190 },
    boss: { pattern: 'gearroll', name: 'Uhrwerkeule' },
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
    hint: 'Die Rohre bewegen sich im Takt: kurz stillstehen, dann zügig springen.'
  },
  {
    name: 'Neon', pipeCount: 34, pipeGap: 173,
    palette: { skyTop: '#121937', skyBottom: '#2e2566', far: '#212653', near: '#15183a', pipe: '#4fd1de', accent: '#df4fbd' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.6, amplitude: 38, period: 195, motion: 'sine' },
    sidePipes: { share: 0.45, amplitude: 22, period: 185 },
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
    hint: 'Die Neontürme gleiten nach oben, unten und zur Seite.'
  },
  {
    name: 'Asche', pipeCount: 36, pipeGap: 174,
    palette: { skyTop: '#1e1716', skyBottom: '#5e2d20', far: '#3b2a2a', near: '#211a1a', pipe: '#433836', accent: '#f08a3c' },
    hazard: { type: 'darkness', params: { sight: 300 } },
    physicsOverride: {},
    movingPipes: { share: 0.6, amplitude: 38, period: 195, motion: 'sine' },
    sidePipes: { share: 0.45, amplitude: 22, period: 185 },
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
    hint: 'Rauch begrenzt die Sicht, fast alle Säulen bewegen sich.'
  },
  {
    name: 'Lava', pipeCount: 38, pipeGap: 172,
    palette: { skyTop: '#2a1419', skyBottom: '#86331f', far: '#4d2320', near: '#2c1918', pipe: '#5a3026', accent: '#ef763b' },
    hazard: { type: 'none', params: {} },
    physicsOverride: {},
    movingPipes: { share: 0.65, amplitude: 40, period: 185, motion: 'sine' },
    sidePipes: { share: 0.5, amplitude: 24, period: 180 },
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
    hint: 'Die Glutsäulen bewegen sich schnell und weit.'
  },
  {
    name: 'Weltraum', pipeCount: 40, pipeGap: 170,
    palette: { skyTop: '#0c0f24', skyBottom: '#2b1d48', far: '#3c2b61', near: '#1c2241', pipe: '#8f9bb9', accent: '#f0b35b' },
    hazard: { type: 'none', params: {} },
    physicsOverride: { GRAVITY: 0.30, FLAP_IMPULSE: -6.5 },
    movingPipes: { share: 0.7, amplitude: 40, period: 185, motion: 'sine' },
    sidePipes: { share: 0.55, amplitude: 24, period: 180 },
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
    hint: 'Kaum Schwerkraft, die Module treiben in alle Richtungen. Am Ende warten alle 15 Bosse nacheinander.'
  }
];
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

