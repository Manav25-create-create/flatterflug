// ============================================================
// Spielzustand und Fortschritt
// Zustände: MENU, LEVEL_SELECT, SKIN_SELECT, SKIN_EDITOR, LEVEL_INTRO,
// PLAYING, CHECKPOINT, BOSS_INTRO, BOSS_GRACE, BOSS_FIGHT, BOSS_DEFEATED,
// LEVEL_TRANSITION, GAME_OVER, VICTORY, AUTOTEST
// ============================================================
const game = {
  state: 'MENU', t: 0, level: 0, paused: false,
  score: 0, shownScore: 0, scorePop: 0, runFromStart: false, free: { pipe: false, boss: false }, rush: null, introShort: false,
  pipesSpawned: 0, pipesPassed: 0, pipesStart: 0, shownPipes: 0, obsPop: 0, lastSlot: null, lastCenter: null, lastAmp: 0, lastHamp: 0,
  dodges: 0, shownDodges: 0, dodgePop: 0,
  scroll: 0, prevScroll: 0, wt: 0, updraft: 0, dark: 0,
  runFrames: 0, deaths: 0, checkpoint: null, deathCause: '', diedInBoss: false, waitTap: false,
  flash: 0, flashColor: CREAM, trans: null, menuBg: { cur: 0, prev: 0, t: 99 }, resetArm: 0, toast: null,
  bossNote: 0, sel: 0, skinSel: 0, tileShake: null, defeat: null
};
let mouse = { x: -1, y: -1 }, uiStatic = false, dragging = null;
const hov = b => !uiStatic && b && inRect(mouse, b);
const MENU_STATES = new Set(['MENU', 'LEVEL_SELECT', 'SKIN_SELECT', 'SKIN_EDITOR']);
const ACTIVE_STATES = new Set(['PLAYING', 'CHECKPOINT', 'BOSS_INTRO', 'BOSS_GRACE', 'BOSS_FIGHT']);
const PIPE_STATES = new Set(['PLAYING', 'CHECKPOINT']);
const BOSS_STATES = new Set(['BOSS_INTRO', 'BOSS_GRACE', 'BOSS_FIGHT', 'BOSS_DEFEATED']);
const CALM_STATES = new Set(['MENU', 'LEVEL_SELECT', 'SKIN_SELECT', 'SKIN_EDITOR', 'GAME_OVER', 'VICTORY', 'AUTOTEST']);

// Fortschritt liegt im Speicher (Datenmodell v4, gespeichert wird weiter unten). Beide Objekte werden nur
// verändert, nie ersetzt: andere Module halten Referenzen.
const progress = { open: LEVELS.map((_, i) => i === 0), beaten: LEVELS.map(() => false),
  completed: false, best: null, customSkins: [], resume: null, savedAt: 0 };
const DIFFICULTIES = ['leicht', 'mittel', 'schwer'];
const SETTINGS_DEFAULT = Object.freeze({ skin: 0, ambient: false, volume: 0.8, difficulty: 'mittel' });
const settings = Object.assign({}, SETTINGS_DEFAULT);
const highestOpen = () => { let h = 0; progress.open.forEach((o, i) => { if (o) h = i; }); return h; };
// Vorschlag für "Weiter": das erste offene, noch nicht geschaffte Level, sonst das höchste offene
function continueLevel() {
  for (let i = 0; i < LEVELS.length; i++) if (progress.open[i] && !progress.beaten[i]) return i;
  return highestOpen();
}

function storageGet(key) {
  if (SIM.on) return null;
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, val) {
  if (SIM.on) return;
  try { window.localStorage.setItem(key, val); } catch (e) { /* ohne Speicher weiter */ }
}

// ---------- Stand v4 ----------
// Ein Stand, lokal und in der Cloud gleich aufgebaut:
// { v: 4, progress: { open, beaten, completed, best: { frames, deaths } | null, customSkins, resume: { li, pipes, frames } | null, savedAt },
//   settings: { skin, ambient, volume, difficulty } }
// Jede Quelle (lokal, Cloud, Hot-Reload, alte Fassungen) gilt als unzuverlässig und wird geprüft und bereinigt.
// Levelreihenfolgen alter Fassungen: deren Arrays werden per Levelname auf LEVELS abgebildet
const V3_LEVEL_ORDER = ['Wiese', 'Eis', 'Lava', 'Dschungel', 'Wüste', 'Ozean', 'Sturm', 'Höhle', 'Sumpf', 'Neon', 'Kristall', 'Wolken', 'Uhrwerk', 'Asche', 'Weltraum'];
const V2_LEVEL_ORDER = ['Wiese', 'Eis', 'Lava', 'Dschungel', 'Wüste', 'Ozean', 'Sturm', 'Höhle', 'Neon', 'Weltraum'];
const MAX_CUSTOM_SKINS = 8;
const levelIndexOf = name => LEVELS.findIndex(L => L.name === name);
const isRec = v => !!v && typeof v === 'object' && !Array.isArray(v);
// Ganzzahl ab 0, nach oben begrenzt; alles andere ergibt -1
const natIn = (v, max) => (typeof v === 'number' && v >= 0 && v < Infinity ? Math.min(Math.floor(v), max) : -1);
function parseSave(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// Eigener Skin: nur bekannte Felder und Werte (als eigene Schlüssel, nichts Geerbtes wie "constructor")
function cleanCustomSkin(s) {
  if (!isRec(s) || !validCustomSkin(s) || !s.name.trim()) return null;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k), hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  if (!own(SKIN_LABELS.shape, s.shape) || !own(SKIN_LABELS.wing, s.wing) || !own(SKIN_LABELS.eye, s.eye) || !own(SKIN_LABELS.trail, s.trail)) return null;
  const C = s.colors;
  const sk = { name: s.name, shape: s.shape, colors: { body: C.body, accent: C.accent, wing: hex(C.wing) ? C.wing : shade(C.body, -0.22) }, wing: s.wing, eye: s.eye, trail: s.trail, custom: true };
  if (hex(s.beak)) sk.beak = s.beak;
  return sk;
}
// Eigene Skins nach Name vereinen: bei gleichem Namen gilt die Fassung aus first, höchstens MAX_CUSTOM_SKINS
function unionSkins(first, second) {
  const out = [], seen = new Set();
  for (const list of [first, second]) {
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < Math.min(list.length, 64) && out.length < MAX_CUSTOM_SKINS; i++) {
      const sk = cleanCustomSkin(list[i]);
      if (sk && !seen.has(sk.name)) { seen.add(sk.name); out.push(sk); }
    }
  }
  return out;
}

// Fortschritt in der Form v4. names: Levelnamen in der Reihenfolge, in der die Arrays von d liegen (fehlt: aktuelle Reihenfolge)
function cleanProgress(d, names) {
  const N = LEVELS.length;
  const p = { open: LEVELS.map((_, i) => i === 0), beaten: LEVELS.map(() => false), completed: false, best: null, customSkins: [], resume: null, savedAt: 0 };
  if (!isRec(d)) return p;
  const at = i => (names ? (i < names.length ? levelIndexOf(names[i]) : -1) : (i < N ? i : -1));
  const each = (arr, fn) => {
    if (Array.isArray(arr)) for (let i = 0; i < Math.min(arr.length, 64); i++) if (arr[i] === true) { const j = at(i); if (j >= 0) fn(j); }
  };
  each(d.open, j => { p.open[j] = true; });
  each(d.beaten, j => { p.beaten[j] = true; });
  // Ein geschafftes Level ist offen, das in der aktuellen Reihenfolge folgende ebenso
  p.beaten.forEach((b, j) => { if (b) { p.open[j] = true; if (j + 1 < N) p.open[j + 1] = true; } });
  p.completed = d.completed === true;
  p.customSkins = unionSkins(d.customSkins, null);
  const b = d.best, frames = isRec(b) ? natIn(b.frames, 1e9) : -1;
  if (frames > 0) p.best = { frames, deaths: Math.max(0, natIn(b.deaths, 1e6)) };
  const r = d.resume, li = isRec(r) && Number.isInteger(r.li) && r.li >= 0 ? at(r.li) : -1;
  if (li >= 0 && natIn(r.pipes, 1e4) >= 0 && natIn(r.frames, 1e9) >= 0) p.resume = { li, pipes: natIn(r.pipes, 1e4), frames: natIn(r.frames, 1e9) };
  p.savedAt = Math.max(0, natIn(d.savedAt, Number.MAX_SAFE_INTEGER));
  return p;
}
// Einstellungen in der Form v4; Unbekanntes fällt auf den Standard zurück
function cleanSettings(d) {
  const s = Object.assign({}, SETTINGS_DEFAULT);
  if (!isRec(d)) return s;
  if (Number.isInteger(d.skin) && d.skin >= 0 && d.skin < SKINS.length) s.skin = d.skin;
  else if (typeof d.skin === 'string' && d.skin.startsWith('c:') && d.skin.length > 2 && d.skin.length <= 20) s.skin = d.skin;
  s.ambient = d.ambient === true;
  if (typeof d.volume === 'number' && Number.isFinite(d.volume)) s.volume = clamp(d.volume, 0, 1);
  if (DIFFICULTIES.includes(d.difficulty)) s.difficulty = d.difficulty;
  return s;
}
// Kanonische Form (feste Schlüsselreihenfolge, gleiche Stände ergeben gleiches JSON). Klein und begrenzt: 2 x 15 Werte, höchstens 8 Skins.
const saveRecord = st => ({ v: 4, progress: st.progress, settings: st.settings });
const saveJSON = st => JSON.stringify(saveRecord(st));
// Inhalt ohne savedAt: entscheidet, ob sich wirklich etwas geändert hat
const saveContent = st => JSON.stringify(saveRecord({ progress: Object.assign({}, st.progress, { savedAt: 0 }), settings: st.settings }));
// Bereinigter Stand aus den Objekten im Speicher
const currentSave = () => ({ progress: cleanProgress(progress), settings: cleanSettings(settings) });

// Bereinigten Stand in die bestehenden Objekte übernehmen (nie ersetzen)
function applyProgress(p) {
  for (const k of ['open', 'beaten']) { progress[k].length = LEVELS.length; p[k].forEach((v, i) => { progress[k][i] = v; }); }
  progress.completed = p.completed;
  progress.best = p.best ? { frames: p.best.frames, deaths: p.best.deaths } : null;
  progress.customSkins.splice(0, progress.customSkins.length, ...p.customSkins);
  progress.resume = p.resume ? Object.assign({}, p.resume) : null;
  progress.savedAt = p.savedAt;
}
function applySettings(s) { Object.assign(settings, s); }
function applySave(st) { applyProgress(st.progress); applySettings(st.settings); }

// Zwei Stände zusammenführen (a: dieses Gerät, b: Cloud oder Hot-Reload). Offene und geschaffte Level vereinigt,
// completed per ODER, eigene Skins nach Name vereint, Bestzeit mit weniger Frames; resume und Einstellungen vom Stand
// mit dem neueren savedAt (bei Gleichstand a). Das Ergebnis trägt das neuere savedAt.
function mergeSaves(a, b) {
  const A = a.progress, B = b.progress, bNewer = B.savedAt > A.savedAt, newer = bNewer ? b : a, older = bNewer ? a : b;
  return {
    progress: cleanProgress({
      open: A.open.map((o, i) => o || B.open[i]), beaten: A.beaten.map((x, i) => x || B.beaten[i]), completed: A.completed || B.completed,
      best: !A.best ? B.best : !B.best || A.best.frames <= B.best.frames ? A.best : B.best,
      customSkins: unionSkins(newer.progress.customSkins, older.progress.customSkins),
      resume: newer.progress.resume, savedAt: Math.max(A.savedAt, B.savedAt)
    }),
    settings: cleanSettings(newer.settings)
  };
}

// ---------- Übernahme alter Fassungen ----------
// v3: Arrays nach der alten Levelreihenfolge. Offene bleiben offen, geschaffte bleiben geschafft und offen, zu jedem
// geschafften Level öffnet sich das in der neuen Reihenfolge folgende. Dazu completed und customSkins, sonst nichts.
function progressFromV3(d) {
  const p = cleanProgress(d, V3_LEVEL_ORDER);
  p.best = null; p.resume = null; p.savedAt = 0;
  return p;
}
// v2 (zehn Biome): unlocked zählt die offenen Level in der Reihenfolge von v2, beaten liegt in derselben Reihenfolge
function progressFromV2(d) {
  if (!isRec(d) || !Number.isInteger(d.unlocked)) return null;
  const p = cleanProgress(null);
  for (let i = 0; i < Math.min(d.unlocked, V2_LEVEL_ORDER.length); i++) { const j = levelIndexOf(V2_LEVEL_ORDER[i]); if (j >= 0) p.open[j] = true; }
  if (Array.isArray(d.beaten)) {
    for (let i = 0; i < Math.min(d.beaten.length, V2_LEVEL_ORDER.length); i++) {
      const j = d.beaten[i] ? levelIndexOf(V2_LEVEL_ORDER[i]) : -1;
      if (j >= 0) { p.beaten[j] = p.open[j] = true; if (j + 1 < LEVELS.length) p.open[j + 1] = true; }
    }
  }
  return p;
}

// ---------- Lokal (localStorage) ----------
const localSave = { content: '' };      // Inhalt (ohne savedAt) des zuletzt gesicherten Stands
function readLocalSave() {
  const d = parseSave(storageGet(CONFIG.STORAGE_KEY));
  return isRec(d) && isRec(d.progress) ? { progress: cleanProgress(d.progress), settings: cleanSettings(d.settings) } : null;
}
function writeLocalSave(st) { storageSet(CONFIG.STORAGE_KEY, saveJSON(st)); }

// Lokalen Fortschritt laden: v4, sonst Übernahme aus v3, sonst aus v2. Synchron, wirft nie.
function loadProgress() {
  try {
    const own = readLocalSave();
    let p = own && own.progress;
    if (!p) { const d = parseSave(storageGet(CONFIG.STORAGE_KEY_V3)); if (isRec(d)) p = progressFromV3(d); }
    if (!p) { const d = parseSave(storageGet(CONFIG.STORAGE_KEY_OLD)); if (isRec(d)) p = progressFromV2(d); }
    if (p) applyProgress(p);
  } catch (e) { /* ohne Speicher weiter */ }
}
// Einstellungen laden: aus dem Stand v4, sonst aus dem alten Einstellungsschlüssel (Schwierigkeit dann "mittel")
function loadSettings() {
  try {
    const own = readLocalSave(), old = own ? null : parseSave(storageGet(CONFIG.SETTINGS_KEY));
    if (own) applySettings(own.settings);
    else if (isRec(old)) applySettings(cleanSettings(old));
  } catch (e) { /* Standardwerte */ }
}

// Speichern: nur bei echter Änderung savedAt setzen, lokal schreiben und das Cloud-Schreiben einplanen.
// saveProgress und saveSettings sichern beide den ganzen Stand. Im Autotest (SIM.on) geschieht nichts.
function commitSave() {
  if (SIM.on) return;
  try {
    const st = currentSave(), content = saveContent(st);
    if (content === localSave.content) return;
    progress.savedAt = st.progress.savedAt = Math.max(Date.now(), st.progress.savedAt + 1);
    localSave.content = content;
    writeLocalSave(st);
    queueCloudSave();
  } catch (e) { /* Speichern hält das Spiel nie an */ }
}
function saveProgress() { commitSave(); }
function saveSettings() { commitSave(); }

// Setzt auch den Cloud-Stand zurück: Ist die Cloud noch nicht gelesen, wird dort danach nichts zurückgeholt, sondern überschrieben.
function resetProgress() {
  progress.open.length = progress.beaten.length = LEVELS.length;
  progress.open.fill(false);
  progress.open[0] = true;
  progress.beaten.fill(false);
  progress.completed = false;
  progress.best = null;
  progress.customSkins.length = 0;
  progress.resume = null;
  settings.skin = 0;
  if (!SIM.on && !cloudSave.ready) cloudSave.resetPending = true;
  saveProgress();
  saveSettings();
  game.resetArm = 0;
  setMenuBg(0);
  showToast('Fortschritt gelöscht');
}

// Passwort "Bot" schaltet genau das angetippte Level frei (alte vierstellige Levelcodes gelten weiter)
function tryCode(li, value) {
  const v = String(value || '').trim().toUpperCase();
  if (!Number.isInteger(li) || li < 0 || li >= LEVELS.length) return { ok: false, text: 'Unbekanntes Level.' };
  if (v.toLowerCase() === CONFIG.PASSWORD || (v.length === 4 && v === LEVEL_CODES[li])) {
    unlockLevel(li);
    return { ok: true, li, text: `Level ${li + 1} freigeschaltet: ${LEVELS[li].name}` };
  }
  return { ok: false, text: 'Das Passwort stimmt nicht.' };
}
function unlockLevel(li) {
  if (!Number.isInteger(li) || li < 0 || li >= LEVELS.length) return;
  progress.open[li] = true;
  saveProgress();
}

// Fortsetzungspunkt für den Spielablauf: Level li, bereits passierte Rohre, gespielte Frames. Beide speichern sofort.
function setResume(li, pipes, frames) {
  if (!Number.isInteger(li) || li < 0 || li >= LEVELS.length) return false;
  progress.resume = { li, pipes: Math.max(0, natIn(pipes, 1e4)), frames: Math.max(0, natIn(frames, 1e9)) };
  saveProgress();
  return true;
}
function clearResume() {
  progress.resume = null;
  saveProgress();
}

// ---------- Hot-Reload im Artefakt-Viewer (z_boot.js) ----------
// Schnappschuss der laufenden Fassung: ganzer Stand v4 samt Levelnamen, damit eine spätere Fassung per Name zuordnen kann
function hotSnapshot() {
  return Object.assign({ names: LEVELS.map(L => L.name) }, saveRecord(currentSave()));
}
// Stand der alten Fassung mit dem geladenen zusammenführen (offene und geschaffte Level vereinigt, Regeln wie bei der Cloud).
// Ältere Fassungen lieferten nur progress: v3 mit open/beaten nach der alten Levelreihenfolge, v2 mit unlocked.
function adoptHotData(data) {
  try {
    const old = isRec(data) ? data.progress : null;
    if (!isRec(old)) return;
    const cur = currentSave();
    let p = null, s = cur.settings;
    if (data.v === 4) {
      const names = Array.isArray(data.names) && data.names.length <= 64 && data.names.every(n => typeof n === 'string') ? data.names : null;
      p = cleanProgress(old, names);
      if (isRec(data.settings)) s = cleanSettings(data.settings);
    } else if (Array.isArray(old.open)) p = progressFromV3(old);
    else p = progressFromV2(old);
    if (p) applySave(mergeSaves(cur, { progress: p, settings: s }));
  } catch (e) { /* ohne Übernahme */ }
}

// ---------- Cloud (Artefakt-Laufzeit, nur im claude.ai-Viewer) ----------
// Ein Dokument pro Person: data/users/<id>/save, Inhalt wie lokal. Zugang nur über window.claude.use(); window.claude
// kann fehlen oder kein use haben, use() liefert null, wo die Fähigkeit nicht läuft (auch nach 10 s ohne Antwort).
// Erst lesen und zusammenführen, danach nur bei echter Änderung schreiben, nie mehr als ein Schreibvorgang unterwegs.
// Fehler: invalid_argument (z. B. Betrachter ohne Schreibrecht), revoked, not_granted, capability_disabled und
// Verwandte schalten die Cloud für diese Sitzung ab. unavailable: einmal nach kurzer zufälliger Pause wiederholen.
// resource_exhausted (und wiederholtes unavailable): zurückhalten und später erneut versuchen.
const cloudSave = { init: null, ref: null, ready: false, dead: false, busy: false, dirty: false, timer: 0, wait: 0, json: '', resetPending: false, reads: 0, writes: 0 };
const CLOUD_STOP = ['invalid_argument', 'transform_error', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed'];
// Fehlercode einordnen; unbekannte Codes gelten als unavailable
const cloudCode = e => { const c = e && typeof e.code === 'string' ? e.code : ''; return CLOUD_STOP.includes(c) || c === 'resource_exhausted' ? c : 'unavailable'; };
const cloudPause = ms => new Promise(r => setTimeout(r, ms));
const cloudBackoff = () => (cloudSave.wait = Math.min(CONFIG.CLOUD_RETRY[1], cloudSave.wait ? cloudSave.wait * 2 : CONFIG.CLOUD_RETRY[0]));

// Start nach dem lokalen Laden (boot); läuft asynchron und wirft nie
function initCloudSave() {
  if (!cloudSave.init) cloudSave.init = cloudConnect();
  return cloudSave.init;
}
async function cloudConnect() {
  try {
    const C = window.claude;
    if (!C || typeof C.use !== 'function') return;
    const [db, user] = await Promise.all([C.use('db'), C.use('user')]);
    if (!db || !user || typeof db.doc !== 'function' || typeof user.id !== 'function') return;
    const uid = await user.id();
    if (typeof uid !== 'string' || !uid) return;                      // ohne Identität nur lokal
    cloudSave.ref = db.doc('data/users/' + uid + '/save');
  } catch (e) { cloudSave.ref = null; return; }
  await cloudPull();
}
// Cloud-Stand lesen und mit dem Stand im Speicher zusammenführen; bei vorübergehenden Fehlern später erneut
async function cloudPull() {
  cloudSave.timer = 0;
  if (cloudSave.dead || !cloudSave.ref) return;
  try {
    let snap;
    do {
      while (SIM.on) await cloudPause(1000);                          // im Autotest nichts lesen
      snap = await cloudCall(() => cloudSave.ref.get());
      cloudSave.reads++;
    } while (SIM.on);
    const raw = snap && snap.exists && typeof snap.data === 'function' ? snap.data() : null;
    if (isRec(raw) && Number(raw.v) > 4) { cloudStop(); return; }    // Stand einer neueren Fassung: nicht anfassen
    const local = currentSave();
    const remote = isRec(raw) ? { progress: cleanProgress(raw.progress), settings: isRec(raw.settings) ? cleanSettings(raw.settings) : local.settings } : null;
    const merged = remote && !cloudSave.resetPending ? mergeSaves(local, remote) : local;
    cloudSave.resetPending = false;
    applySave(merged);
    Music.setVolume(settings.volume);
    // Das Menü zeigt danach wie beim Start das Biom, mit dem "Weiter" beginnt
    if (game.state === 'MENU') { const ci = continueLevel(); if (ci !== game.menuBg.cur) { game.level = ci; setMenuBg(ci); } }
    localSave.content = saveContent(merged);
    writeLocalSave(merged);
    // Vergleichsbasis ist der Cloud-Stand in kanonischer Form; unvollständige Dokumente werden überschrieben
    cloudSave.json = remote && raw.v === 4 && isRec(raw.progress) && isRec(raw.settings) ? saveJSON(remote) : '';
    cloudSave.ready = true;
    cloudSave.wait = 0;
    cloudSave.dirty = saveJSON(merged) !== cloudSave.json;
    if (cloudSave.dirty) await flushCloudSave();
  } catch (e) {
    if (!cloudFailed(e)) cloudSave.timer = setTimeout(cloudPull, cloudBackoff());
  }
}
// Ein Aufruf; bei unavailable genau eine Wiederholung nach kurzer zufälliger Pause
async function cloudCall(fn) {
  try { return await fn(); } catch (e) {
    if (cloudCode(e) !== 'unavailable') throw e;
    await cloudPause(150 + Math.random() * 450);
    return await fn();
  }
}
// true, wenn der Fehler die Cloud für diese Sitzung abschaltet
function cloudFailed(e) {
  if (!CLOUD_STOP.includes(cloudCode(e))) return false;
  cloudStop();
  return true;
}
function cloudStop() {
  cloudSave.dead = true;
  cloudSave.ready = false;
  cloudSave.dirty = false;
  clearTimeout(cloudSave.timer);
  cloudSave.timer = 0;
}
// Schreiben einplanen, entprellt. Läuft schon ein Schreibvorgang oder wird zurückgehalten, folgt danach genau einer
// mit dem neuesten Stand. Vor dem ersten Lesen schreibt nichts: das übernimmt das Zusammenführen.
function queueCloudSave() {
  if (cloudSave.dead) return;
  cloudSave.dirty = true;
  if (!cloudSave.ready || cloudSave.busy || cloudSave.wait) return;
  clearTimeout(cloudSave.timer);
  cloudSave.timer = setTimeout(flushCloudSave, CONFIG.CLOUD_DELAY);
}
async function flushCloudSave() {
  clearTimeout(cloudSave.timer);
  cloudSave.timer = 0;
  if (cloudSave.dead || !cloudSave.ready || cloudSave.busy || !cloudSave.dirty) return;
  if (SIM.on) { cloudSave.timer = setTimeout(flushCloudSave, 1000); return; }   // im Autotest nichts schreiben, danach nachholen
  const st = currentSave(), json = saveJSON(st);
  cloudSave.dirty = false;
  if (json === cloudSave.json) return;                                 // nur bei echter Änderung
  cloudSave.busy = true;
  let next = CONFIG.CLOUD_DELAY;
  try {
    await cloudCall(() => cloudSave.ref.set(saveRecord(st)));
    cloudSave.json = json;
    cloudSave.writes++;
    cloudSave.wait = 0;
  } catch (e) {
    if (!cloudFailed(e)) { cloudSave.dirty = true; next = cloudBackoff(); }
  }
  cloudSave.busy = false;
  if (cloudSave.dirty && !cloudSave.dead) cloudSave.timer = setTimeout(flushCloudSave, next);
}
// Beim Verlassen der Seite nicht auf die Entprellung warten
function flushCloudNow() { if (cloudSave.dirty && !cloudSave.wait) flushCloudSave(); }
window.addEventListener('pagehide', flushCloudNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushCloudNow(); });

// ============================================================
// Hilfen für Zustand und Rückmeldung
// ============================================================
function setState(s) {
  game.state = s;
  game.t = 0;
  Music.duck(s === 'GAME_OVER' || game.paused);
}
function setPaused(on) {
  game.paused = on;
  Music.duck(on || game.state === 'GAME_OVER');
}
function flash(a, col) {
  if (SIM.on) return;
  game.flash = Math.max(game.flash, a);
  game.flashColor = col;
}
function addScore(n) {
  game.score += n;
  game.scorePop = 1;
}
function approach(cur, target, k) {
  const d = target - cur;
  if (Math.abs(d) < 0.05) return target;
  return cur + Math.sign(d) * Math.max(0.08, Math.abs(d) * k);
}
function formatTime(frames) {
  const cs = Math.floor(frames * 100 / 60);
  const m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')},${String(c).padStart(2, '0')}`;
}
const punkte = (n, dativ) => `${n} ${n === 1 ? 'Punkt' : dativ ? 'Punkten' : 'Punkte'}`;
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function showToast(text, t) { game.toast = { text, t: t || 170 }; }
function setMenuBg(i) {
  if (i !== game.menuBg.cur) game.menuBg = { prev: game.menuBg.cur, cur: i, t: 0 };
}

// ============================================================
// Ablauf der Level
// ============================================================
// Schwierigkeit: Leicht = Checkpoints und je ein Gratis-Respawn in Röhrenphase und Bosskampf,
// Mittel = Checkpoints ab Level 9, Schwer = keine Checkpoints, Tod beim Boss startet das Level neu.
// Der Autotest misst immer die Grundschwierigkeit (Mittel, ohne Hilfen).
const diff = () => (SIM.on ? 'mittel' : settings.difficulty);
const DIFF_LABEL = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };
const checkpointAt = li => (diff() === 'schwer' ? 0 : checkpointFor(li));

function startFromMenu(li) {
  if (li < 0 || li >= LEVELS.length || !progress.open[li]) return;
  game.runFrames = 0;
  game.deaths = 0;
  game.runFromStart = li === 0;
  game.checkpoint = null;
  // gespeicherter Checkpoint dieses Levels: dort weitermachen
  const r = progress.resume, cpAt = checkpointAt(li);
  if (r && r.li === li && cpAt && r.pipes === cpAt) {
    game.level = li;
    game.checkpoint = { pipes: r.pipes, frames: r.frames };
    game.runFromStart = false;
    startLevel(li, 'checkpoint');
    return;
  }
  startLevel(li, 'menu');
}

// mode: 'menu' (Auswahl), 'retry' (Levelanfang), 'checkpoint', 'next' (nach dem Boss)
function startLevel(li, mode) {
  if (mode !== 'checkpoint' && game.level !== li) game.checkpoint = null;
  game.level = li;
  if (mode === 'retry') game.checkpoint = null;
  const cp = mode === 'checkpoint' ? game.checkpoint : null;
  pipes = []; hazards = []; pickups = []; shots = []; attacks = []; boss = null; bossOut = null;
  game.pipesStart = cp ? cp.pipes : 0;
  game.pipesSpawned = game.pipesPassed = game.shownPipes = game.pipesStart;
  // Punkte zählen nur die Rohre dieses Levels: jedes Level beginnt bei 0 (am Checkpoint bei dessen Rohr)
  game.score = game.shownScore = game.pipesStart;
  game.dodges = 0; game.shownDodges = 0; game.rush = null; game.introShort = false;
  game.lastSlot = null; game.lastCenter = null; game.lastAmp = 0; game.lastHamp = 0;
  game.trans = null; game.paused = false; game.flash = 0; game.updraft = 0; game.wt = 0;
  game.defeat = null; game.waitTap = false; game.bossNote = 0;
  game.free = { pipe: diff() === 'leicht', boss: diff() === 'leicht' };
  wind.t = 0; wind.state = 'calm';
  const y = mode === 'next' && bird ? bird.y : CONFIG.BIRD_START_Y;
  bird = makeBird();
  bird.y = bird.hoverY = bird.py = y;
  resetAbilities(mode !== 'menu');
  if (mode !== 'next') particles = [];
  ambient.list = [];
  game.dark = sightRadius() ? 1 : 0;
  // Speicher der Menü- und Überblendebenen freigeben, solange gespielt wird
  sizeFadeLayer(false);
  freeMenuLayers();
  keepLevelCaches([li, li + 1]);
  getLevelCache(li);
  prefetchLevel(li + 1);
  setState('LEVEL_INTRO');
  Music.setTrack('level' + li);
}

function beginPlay() {
  setState('PLAYING');
  flapBird();
}

function onPipePassed() {
  const li = game.level, cpAt = checkpointAt(li);
  if (cpAt && !game.checkpoint && game.pipesPassed === cpAt) {
    game.checkpoint = { pipes: game.pipesPassed, frames: game.runFrames };
    if (!SIM.on) setResume(li, game.pipesPassed, game.runFrames);   // auch nach dem Schließen ab hier weiter
    setState('CHECKPOINT');
    sfx('checkpoint');
  }
}

// Bosskampf beginnen. Im letzten Level der Boss-Ansturm: alle 15 Bosse nacheinander.
function beginBossIntro(restart) {
  shots = []; attacks = []; hazards = []; pickups = []; pipes = []; bossOut = null;
  ghostInfo.clear();
  game.dodges = 0;
  game.shownDodges = 0;
  game.updraft = 0;
  game.introShort = false;
  if (isRushLevel(game.level)) {
    if (!restart || !game.rush) game.rush = { i: 0, cp: false };
    else game.rush.i = game.rush.cp && diff() !== 'schwer' ? CONFIG.RUSH_CHECKPOINT : 0;
    boss = makeBoss(game.rush.i);
  } else {
    game.rush = null;
    boss = makeBoss(game.level);
  }
  if (diff() === 'leicht') game.free.boss = true;
  clearAbilitiesForBoss();
  setState('BOSS_INTRO');
  Music.setTrack('boss' + game.level);
}

// Tod im Bosskampf: auf Leicht und Mittel beginnt nur der Bosskampf neu, auf Schwer das Level
function restartBoss() {
  if (diff() === 'schwer') { startLevel(game.level, 'retry'); return; }
  pipes = []; hazards = []; pickups = []; particles = [];
  bird = makeBird();
  bird.y = bird.hoverY = bird.py = CONFIG.BIRD_START_Y;
  game.waitTap = true;
  game.paused = false;
  beginBossIntro(true);
}

// Der aktuelle Boss hat genug Treffer: im Ansturm kommt der nächste, sonst ist das Level geschafft
function bossBeaten() {
  if (game.rush && game.rush.i < LEVELS.length - 1) rushNextBoss();
  else defeatBoss();
}
function rushNextBoss() {
  const old = boss, C = COLORS[old.li];
  old.defeated = true;
  old.flash = 30;
  old.vy = 0;
  bossOut = old;
  burst(old.x + CONFIG.BOSS_W / 2, old.y + CONFIG.BOSS_H / 2, 16, [CREAM, C.accent, C.pipe], 3.4, 26);
  flash(0.2, CREAM);
  shake(3, 12);
  sfx('levelup');
  game.rush.i++;
  if (game.rush.i >= CONFIG.RUSH_CHECKPOINT && !game.rush.cp && diff() !== 'schwer') {
    game.rush.cp = true;
    if (!SIM.on) showToast(`Checkpoint: Ab jetzt geht es bei Boss ${CONFIG.RUSH_CHECKPOINT + 1} weiter`, 150);
  }
  shots = []; attacks = [];
  ghostInfo.clear();
  game.dodges = 0;
  game.shownDodges = 0;
  boss = makeBoss(game.rush.i);
  game.introShort = true;
  setState('BOSS_INTRO');
}

function defeatBoss() {
  setState('BOSS_DEFEATED');
  const li = game.level, C = COLORS[boss.li];
  boss.defeated = true;
  boss.flash = CONFIG.BOSS_DEFEAT_FLASH;
  boss.vy = 0;
  for (const s of shots) if (s.type === 'orb' && !s.ghost) burst(s.x, s.y, 5, [C.accent, CREAM], 2.2, 16);
  shots = [];
  attacks = [];
  burst(boss.x + CONFIG.BOSS_W / 2, boss.y + CONFIG.BOSS_H / 2, 22, [CREAM, C.accent, C.pipe], 4, 32);
  flash(0.35, CREAM);
  shake(4, 16);
  sfx('levelup');
  if (SIM.on) return;                       // Autotest verändert den Fortschritt nicht
  const newSkin = !progress.beaten[li];
  progress.beaten[li] = true;
  const next = li + 1;
  game.defeat = { skin: newSkin ? SKINS[LEVELS[li].skinId] : null, next };
  if (next < LEVELS.length) progress.open[next] = true;
  else {
    game.defeat.editor = !progress.completed;
    progress.completed = true;
    if (game.runFromStart && (!progress.best || game.runFrames < progress.best.frames)) progress.best = { frames: game.runFrames, deaths: game.deaths };
  }
  if (progress.resume && progress.resume.li === li) progress.resume = null;
  saveProgress();
}

// Abgeschossener Boss: kurz blinken, dann absacken; false, wenn er aus dem Bild ist
function updateFallingBoss(b) {
  b.t++;
  if (b.flash > 0) {
    b.flash--;
    if (b.flash % 12 === 0) burst(b.x + rand(10, 80), b.y + rand(10, 100), 4, [CREAM, COLORS[b.li].accent], 2.2, 14);
    if (b.flash === 0) b.vy = -3;
  } else {
    b.vy += CONFIG.BOSS_FALL_GRAVITY;
    b.y += b.vy;
    b.x += 0.6;
    b.rot += 0.03;
    if (b.y > H + 60) return false;
  }
  return true;
}
function updateDefeatedBoss() {
  if (boss && !updateFallingBoss(boss)) boss = null;
}

// Nach dem Bosssieg weiter: Überblendung ins nächste Biom oder Endbildschirm
function continueAfterBoss() {
  if (game.state !== 'BOSS_DEFEATED' || game.t < 50) return;
  const li = game.level;
  if (li >= LEVELS.length - 1) { setState('VICTORY'); Music.setTrack('victory'); return; }
  getLevelCache(li + 1);
  game.trans = { from: li, to: li + 1 };
  setState('LEVEL_TRANSITION');
  Music.setTrack('level' + (li + 1));
}

function killBird(cause) {
  if (bird.dead || SIM.god) return;
  if (bird.inv > 0) return;
  const bossPhase = BOSS_STATES.has(game.state), slot = bossPhase ? 'boss' : 'pipe';
  // Leicht: einmal pro Röhrenphase und einmal pro Bosskampf gratis weiter
  if (diff() === 'leicht' && game.free && game.free[slot]) {
    game.free[slot] = false;
    reviveBird('#9fe6c8');
    showToast(bossPhase ? 'Gratis-Respawn im Bosskampf genutzt' : 'Gratis-Respawn genutzt', 120);
    return;
  }
  if (hasSecondChance()) { useSecondChance(); return; }
  bird.dead = true;
  bird.idle = false;
  if (bird.y + CONFIG.BIRD_H >= GROUND_Y - 1) { bird.grounded = true; bird.vy = 0; }
  else bird.vy = -3.5;
  game.deaths++;
  game.deathCause = cause || 'Rohr';
  game.diedInBoss = bossPhase;
  abil.slow = abil.phantom = abil.shrink = 0;
  abil.active = null;
  flash(0.45, CREAM);
  shake(CONFIG.SHAKE_HIT[0], CONFIG.SHAKE_HIT[1]);
  sfx('death');
  const B = currentSkin().colors;
  burst(bird.x + 17, bird.y + 12, 10, [B.body, B.accent, B.wing], 3, 40, { kind: 'feather', vr: 0.12, grav: 0.06, drag: 0.96 });
  setState('GAME_OVER');
  if (SIM.onDeath) SIM.onDeath(game.deathCause);
}

function goMenu(state) {
  game.paused = false;
  pipes = []; hazards = []; pickups = []; shots = []; attacks = []; boss = null; bossOut = null; particles = [];
  game.rush = null;
  const sel = clamp(game.level, 0, LEVELS.length - 1);
  game.sel = sel;
  if (!game.menuBg || game.state !== 'MENU') game.menuBg = { cur: progress.open[sel] ? sel : continueLevel(), prev: 0, t: 99 };
  game.menuBg.prev = game.menuBg.cur;
  bird = makeBird();
  shakeFx.t = 0;
  setState(state || 'MENU');
  Music.setTrack('menu');
}

// ============================================================
// Kollisionen
// ============================================================
function checkWorld() {
  const box = birdBox(CONFIG.BIRD_HITBOX_INSET);
  if (box.y + box.h >= GROUND_Y) {
    if (bird.inv > 0) { bird.y = GROUND_Y - CONFIG.BIRD_H / 2 - box.h / 2 - 1; bird.vy = -5; return false; }
    killBird('Boden');
    return true;
  }
  if (abil.phantom > 0 || bird.inv > 0) return false;
  for (const p of pipes) if (pipeHits(p, box)) { killBird('Rohr'); return true; }
  for (const h of hazards) if (hazardHits(h, box)) { killBird(HAZARD_CAUSE[h.type] || 'Hindernis'); return true; }
  return false;
}

function checkBossBounds() {
  const box = birdBox(CONFIG.BIRD_HITBOX_INSET);
  if (box.y + box.h >= GROUND_Y) {
    if (SIM.god) { bird.vy = -6; return false; }
    killBird('Boden');
    return true;
  }
  return false;
}

function checkShots() {
  const box = birdBox(CONFIG.SHOT_HITBOX_INSET);
  for (const s of shots) {
    if (shotHits(s, box)) {
      const a = attacks.find(q => q.id === s.group);
      if (a) a.hit = true;
      killBird(SHOT_CAUSE[s.type] || 'Geschoss');
      return true;
    }
  }
  return false;
}

// ============================================================
// Update: ein Aufruf entspricht einem 60-FPS-Schritt
// ============================================================
function snapshot() {
  game.prevScroll = game.scroll;
  if (bird) { bird.px = bird.x; bird.py = bird.y; bird.prot = bird.rot; }
  if (boss) { boss.px = boss.x; boss.py = boss.y; }
  if (bossOut) { bossOut.px = bossOut.x; bossOut.py = bossOut.y; }
  for (const s of shots) { s.px = s.x; s.py = s.y; }
  for (const p of particles) { p.px = p.x; p.py = p.y; }
  for (const p of pipes) { p.pgapY = p.gapY; p.pox = p.ox; }
  for (const h of hazards) { h.py = h.y; h.pang = h.ang; h.px = h.x; }
  for (const p of ambient.list) { p.px = p.x; p.py = p.y; }
}

function update() {
  frame++;
  snapshot();
  updateShake();
  game.shownScore = approach(game.shownScore, game.score, 0.15);
  game.shownPipes = approach(game.shownPipes, game.pipesPassed, 0.2);
  game.shownDodges = approach(game.shownDodges, game.dodges, 0.2);
  game.scorePop = Math.max(0, game.scorePop - 0.08);
  game.obsPop = Math.max(0, game.obsPop - 0.08);
  game.dodgePop = Math.max(0, game.dodgePop - 0.07);
  if (game.menuBg.t < 99) game.menuBg.t++;
  if (game.resetArm > 0) game.resetArm--;
  if (game.toast && --game.toast.t <= 0) game.toast = null;
  if (game.tileShake && --game.tileShake.t <= 0) game.tileShake = null;
  if (game.paused) return;
  game.t++;
  game.flash *= 0.86;
  if (game.flash < 0.01) game.flash = 0;
  if (game.bossNote > 0) game.bossNote--;
  const li = game.level, S = CONFIG.SCROLL_SPEED;
  const darkTarget = sightRadius() && !BOSS_STATES.has(game.state) && game.state !== 'LEVEL_TRANSITION' && !(game.state === 'GAME_OVER' && game.diedInBoss) ? 1 : 0;
  game.dark += (darkTarget - game.dark) * 0.04;
  switch (game.state) {
    case 'MENU': case 'LEVEL_SELECT': case 'SKIN_SELECT': case 'SKIN_EDITOR': case 'AUTOTEST':
      break;
    case 'LEVEL_INTRO':
      game.scroll += S;
      updateBird('hover', 1);
      updateParticles(1);
      updateAmbient(1);
      break;
    case 'PLAYING': case 'CHECKPOINT': {
      updateAbilityTimers();
      const dt = abil.tf;
      game.scroll += S * dt;
      game.wt += dt;
      game.runFrames++;
      if (hazardType() === 'wind') updateWind(dt);
      updateHazards(dt);
      updateBird('physics', dt);
      updatePipes(dt);
      updatePickups(dt);
      updateParticles(dt);
      updateAmbient(dt);
      if (checkWorld()) break;
      if (game.state === 'CHECKPOINT' && game.t >= CONFIG.CHECKPOINT_BANNER) game.state = 'PLAYING';
      if (game.pipesPassed >= pipesFor(li) && pipes.length === 0) beginBossIntro(false);
      break;
    }
    case 'BOSS_INTRO': case 'BOSS_GRACE': case 'BOSS_FIGHT': {
      game.scroll += S;
      game.wt += 1;
      game.runFrames++;
      bird.dx *= 0.94;
      if (game.waitTap) updateBird('hover', 1); else updateBird('physics', 1);
      updateParticles(1);
      updateAmbient(1);
      if (bossOut && !updateFallingBoss(bossOut)) bossOut = null;
      if (game.state === 'BOSS_INTRO') {
        updateBossIntro();
        if (!game.waitTap && checkBossBounds()) break;
        // Im Boss-Ansturm folgt der nächste Boss ohne Schonfrist
        if (game.t >= introFrames()) { if (game.introShort) { setState('BOSS_FIGHT'); boss.timer = 0; } else setState('BOSS_GRACE'); }
      } else if (game.state === 'BOSS_GRACE') {
        updateBossIdle();
        if (game.waitTap) { game.t = Math.min(game.t, 1); break; }
        if (checkBossBounds()) break;
        if (game.t >= CONFIG.BOSS_GRACE_FRAMES) { setState('BOSS_FIGHT'); boss.timer = 0; }
      } else {
        updateBossFight();
        if (game.state !== 'BOSS_FIGHT') break;
        updateShots();
        if (game.state === 'BOSS_FIGHT' && !checkBossBounds()) checkShots();
      }
      break;
    }
    case 'BOSS_DEFEATED':
      game.scroll += S;
      updateBird('auto', 1);
      updateDefeatedBoss();
      updateParticles(1);
      updateAmbient(1);
      break;
    case 'LEVEL_TRANSITION':
      game.scroll += S;
      game.runFrames++;
      updateBird('auto', 1);
      updateParticles(1);
      if (game.t >= CONFIG.CROSSFADE_FRAMES) startLevel(game.trans.to, 'next');
      break;
    case 'GAME_OVER':
      updateBird('dead', 1);
      updateParticles(1);
      break;
    case 'VICTORY':
      game.scroll += S * 0.5;
      updateBird('auto', 1);
      if (!REDUCED_MOTION && game.t < 400 && game.t % 4 === 0) {
        addParticle({ x: rand(0, W), y: -10, vx: rand(-0.6, 0.6), vy: rand(1.2, 2.2), life: 360, size: rand(3, 5),
          color: pick(LEVELS.map(L => L.palette.accent)), kind: 'confetti', rot: rand(0, TAU), vr: rand(-0.08, 0.08), front: true, drag: 1 });
      }
      updateParticles(1);
      break;
  }
}

// ============================================================
// Hintergrundpartikel pro Biom: standardmäßig aus (Menüschalter)
// ============================================================
const ambient = { list: [] };
const AMBIENT = {
  pollen: C => ({ kind: 'dot', color: rgba(mix(C.accent, CREAM, 0.4), 0.7), size: 1.2, vx: -0.3, vy: 0.15 }),
  snow: C => ({ kind: 'snow', color: rgba(CREAM, 0.85), size: 1.6 + Math.random() * 1.4, vx: -0.4, vy: 0.7 + Math.random() * 0.5 }),
  ash: C => ({ kind: 'dot', color: rgba(mix(C.far, CREAM, 0.3), 0.7), size: 1.3, vx: -0.5, vy: 0.4 + Math.random() * 0.4 }),
  leaves: C => ({ kind: 'leaf', color: shade(C.accent, -0.3), size: 2.4, vx: -0.6, vy: 0.6, vr: 0.04 }),
  dust: C => ({ kind: 'dot', color: rgba(mix(C.pipe, CREAM, 0.3), 0.55), size: 1.1, vx: -0.9, vy: 0.1 }),
  bubbles: C => ({ kind: 'bubble', color: rgba(mix(C.accent, CREAM, 0.5), 0.6), size: 1.5 + Math.random() * 2, vx: -0.2, vy: -0.6 - Math.random() * 0.4, fromBottom: true }),
  rain: C => ({ kind: 'streak', color: rgba(mix(CREAM, C.skyBottom, 0.3), 0.35), size: 1, len: 14, vx: -2, vy: 9 }),
  motes: C => ({ kind: 'spark', color: C.accent, size: 0.9, vx: -0.2, vy: -0.1 }),
  spores: C => ({ kind: 'dot', color: rgba(C.accent, 0.6), size: 1.2, vx: -0.25, vy: -0.25, fromBottom: true }),
  glints: C => ({ kind: 'star', color: rgba(mix(C.accent, CREAM, 0.5), 0.8), size: 1.6, vx: -0.15, vy: 0.2 }),
  feathers: C => ({ kind: 'feather', color: rgba(CREAM, 0.75), size: 1.6, vx: -0.6, vy: 0.3, vr: 0.03 }),
  sparks: C => ({ kind: 'ember', color: C.accent, size: 1.1, vx: -0.4, vy: -0.6 - Math.random() * 0.6, fromBottom: true })
};
function updateAmbient(dt) {
  const kind = LEVELS[game.level].ambient, f = AMBIENT[kind];
  if (!settings.ambient || !f || SIM.on) { if (ambient.list.length) ambient.list = []; return; }
  if (ambient.list.length < 40 && Math.random() < 0.35 * dt) {
    const o = f(COLORS[game.level]), p = Object.assign({ x: Math.random() * (W + 80), y: o.fromBottom ? GROUND_Y + 4 : -8, life: 600, rot: Math.random() * TAU, vr: 0 }, o);
    p.px = p.x; p.py = p.y; p.max = p.life;
    ambient.list.push(p);
  }
  for (const p of ambient.list) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt;
  }
  ambient.list = ambient.list.filter(p => p.life > 0 && p.y < GROUND_Y + 10 && p.y > -20 && p.x > -20);
}
function drawAmbient(a) {
  if (!ambient.list.length) return;
  for (const p of ambient.list) {
    ctx.globalAlpha = Math.min(1, p.life / 60, (p.max - p.life) / 30) * 0.9;
    drawParticle(p, lerp(p.px, p.x, a), lerp(p.py, p.y, a));
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// Layout: logische Koordinaten, an die Kanten gebunden
// ============================================================
const UI = {
  back: () => ({ x: 8, y: 8, w: 34, h: 34 }),
  pause: () => ({ x: 8, y: 8, w: 34, h: 34 }),
  mute: () => ({ x: W - 148, y: GROUND_Y + 13, w: 32, h: 32 }),
  vol: () => ({ x: W - 106, y: GROUND_Y + 22, w: 92, h: 14 }),
  volHit: () => ({ x: W - 114, y: GROUND_Y + 8, w: 108, h: 42 })
};
function menuCol() { const w = Math.min(320, W - 40); return { x: Math.round((W - w) / 2), w }; }
function menuButtons() {
  const c = menuCol(), list = [];
  list.push({ id: 'play', x: c.x, y: 184, w: c.w, h: 50 });
  list.push({ id: 'levels', x: c.x, y: 244, w: c.w, h: 40 });
  list.push({ id: 'skins', x: c.x, y: 292, w: c.w, h: 40 });
  list.push({ id: 'editor', x: c.x, y: 340, w: c.w, h: 40 });
  list.push({ id: 'difficulty', x: c.x, y: 392, w: c.w, h: 36 });
  list.push({ id: 'ambient', x: c.x, y: 436, w: c.w, h: 32 });
  if (progress.open.some((o, i) => i > 0 && o) || progress.beaten.some(Boolean)) list.push({ id: 'reset', x: c.x + c.w / 2 - 80, y: 476, w: 160, h: 26 });
  return list;
}
const audioVisible = () => MENU_STATES.has(game.state) || game.paused;
const DIFF_HINT = {
  leicht: 'Leicht: Checkpoints ab Level 9 und in jedem Level ein Gratis-Respawn bei den Röhren und einer im Bosskampf',
  mittel: 'Mittel: Checkpoint bei der Hälfte ab Level 9, ein Absturz beim Boss startet nur den Bosskampf neu',
  schwer: 'Schwer: keine Checkpoints, ein Absturz beim Boss startet das ganze Level neu'
};
function gridLayout(n, colsWide, colsNarrow, maxH) {
  const cols = W >= 760 ? colsWide : colsNarrow, rows = Math.ceil(n / cols);
  const x0 = 16, y0 = 80, gap = 10, aw = W - 32, ah = GROUND_Y - 8 - y0;
  const tw = (aw - (cols - 1) * gap) / cols, th = Math.min(maxH, (ah - (rows - 1) * gap) / rows);
  const usedH = rows * th + (rows - 1) * gap, oy = y0 + Math.max(0, (ah - usedH) / 2) * 0.4;
  return { cols, rows, tw, th, rect: i => ({ x: x0 + (i % cols) * (tw + gap), y: oy + Math.floor(i / cols) * (th + gap), w: tw, h: th }) };
}
const tileGrid = () => gridLayout(LEVELS.length, 5, 3, 150);
const skinList = () => [SKINS[0]].concat(LEVELS.map(L => SKINS[L.skinId])).map(s => ({ skin: s, id: s.id, custom: false })).concat(progress.customSkins.map(s => ({ skin: s, id: 'c:' + s.name, custom: true })));
const skinGrid = () => gridLayout(skinList().length, 6, 4, 118);
function panelRect(w, h, cy) { const pw = Math.min(w, W - 24); return { x: Math.round((W - pw) / 2), y: Math.round(cy - h / 2), w: pw, h }; }
function gameOverButtons() {
  const P = panelRect(320, 300, 318), bx = P.x + 24, bw = P.w - 48, list = [];
  if (game.diedInBoss) {
    list.push({ id: diff() === 'schwer' ? 'retry' : 'boss', x: bx, y: P.y + 158, w: bw, h: 48 });
  } else {
    if (game.checkpoint) list.push({ id: 'checkpoint', x: bx, y: P.y + 150, w: bw, h: 46 });
    list.push({ id: 'retry', x: bx, y: P.y + (game.checkpoint ? 204 : 158), w: bw, h: game.checkpoint ? 38 : 48 });
  }
  list.push({ id: 'menu', x: bx + bw / 2 - 80, y: P.y + 250, w: 160, h: 36 });
  return list;
}
function defeatButtons() {
  const P = defeatPanel(), bx = P.x + 24, bw = P.w - 48;
  return [{ id: 'next', x: bx, y: P.y + P.h - 60, w: bw, h: 44 }];
}
function defeatPanel() {
  const d = game.defeat || {}, h = 168 + (d.skin ? 92 : 0) + (d.editor ? 34 : 0);
  return panelRect(340, h, 300);
}
function pauseButtons() {
  const P = panelRect(288, 252, 332), bx = P.x + 24, bw = P.w - 48;
  return [{ id: 'resume', x: bx, y: P.y + 86, w: bw, h: 46 }, { id: 'music', x: bx, y: P.y + 144, w: bw, h: 38 }, { id: 'menu', x: bx, y: P.y + 194, w: bw, h: 38 }];
}
function victoryButtons() {
  const P = panelRect(340, 440, 320), bx = P.x + 24, bw = P.w - 48;
  return [{ id: 'editor', x: bx, y: P.y + P.h - 112, w: bw, h: 42 }, { id: 'menu', x: bx, y: P.y + P.h - 60, w: bw, h: 44 }];
}
const hitList = (list, p) => list.find(b => inRect(p, b));

// ============================================================
// Eingabe
// ============================================================
const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
function onKey(code) {
  if (SIM.autotest) { autotestKey(code); return; }
  Music.unlock();
  if (code === 'KeyM') { Music.toggle(); return; }
  const flapKey = FLAP_KEYS.has(code), enter = code === 'Enter' || code === 'NumpadEnter';
  if (game.paused) {
    if (flapKey || enter || code === 'KeyP') setPaused(false);
    else if (code === 'Escape') goMenu();
    return;
  }
  switch (game.state) {
    case 'MENU': menuKey(code); break;
    case 'LEVEL_SELECT': gridKey(code, LEVELS.length, tileGrid().cols, i => tileActivate(i), () => goMenu()); break;
    case 'SKIN_SELECT': gridKey(code, skinList().length, skinGrid().cols, i => skinActivate(i), () => goMenu()); break;
    case 'LEVEL_INTRO':
      if (code === 'Escape') goMenu();
      else if ((flapKey || enter) && game.t >= CONFIG.INTRO_LOCK) beginPlay();
      break;
    case 'PLAYING': case 'CHECKPOINT': case 'BOSS_INTRO': case 'BOSS_GRACE': case 'BOSS_FIGHT':
      if (flapKey) { game.waitTap = false; flapBird(); }
      else if (code === 'Escape' || code === 'KeyP') setPaused(true);
      break;
    case 'BOSS_DEFEATED':
      if ((flapKey || enter) && game.t >= 50) continueAfterBoss();
      break;
    case 'GAME_OVER': {
      if (game.t < CONFIG.DEATH_PANEL_DELAY + CONFIG.RESTART_LOCK) return;
      if (code === 'Escape') goMenu();
      else if (game.diedInBoss) { if (flapKey || enter || code === 'KeyR') restartBoss(); }
      else if (code === 'KeyR') startLevel(game.level, 'retry');
      else if (flapKey || enter || code === 'KeyC') startLevel(game.level, game.checkpoint ? 'checkpoint' : 'retry');
      break;
    }
    case 'VICTORY':
      if ((flapKey || enter || code === 'Escape') && game.t > 60) goMenu();
      break;
  }
}

function menuKey(code) {
  const list = menuButtons();
  let s = clamp(game.sel, 0, list.length - 1);
  if (code === 'ArrowDown' || code === 'KeyS') s = Math.min(list.length - 1, s + 1);
  else if (code === 'ArrowUp' || code === 'KeyW') s = Math.max(0, s - 1);
  else if (code === 'KeyL') { openLevelSelect(); return; }
  else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { menuAction(list[s].id); return; }
  game.sel = s;
}

function gridKey(code, n, cols, activate, back) {
  let s = clamp(game.sel, 0, n - 1);
  if (code === 'ArrowLeft' || code === 'KeyA') s = Math.max(0, s - 1);
  else if (code === 'ArrowRight' || code === 'KeyD') s = Math.min(n - 1, s + 1);
  else if (code === 'ArrowUp' || code === 'KeyW') s = Math.max(0, s - cols);
  else if (code === 'ArrowDown' || code === 'KeyS') s = Math.min(n - 1, s + cols);
  else if (code === 'Escape' || code === 'Backspace') { back(); return; }
  else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { activate(s); return; }
  game.sel = s;
  if (game.state === 'LEVEL_SELECT') setMenuBg(progress.open[s] ? s : game.menuBg.cur);
}

function menuAction(id) {
  switch (id) {
    case 'play': startFromMenu(continueLevel()); break;
    case 'levels': openLevelSelect(); break;
    case 'skins': game.sel = Math.max(0, skinList().findIndex(e => e.id === settings.skin)); setState('SKIN_SELECT'); break;
    case 'editor': if (progress.completed) openSkinEditor(); else showToast('Der Skin-Editor wird nach Level 15 freigeschaltet'); break;
    case 'ambient': settings.ambient = !settings.ambient; saveSettings(); break;
    case 'difficulty': {
      settings.difficulty = DIFFICULTIES[(DIFFICULTIES.indexOf(settings.difficulty) + 1) % DIFFICULTIES.length];
      saveSettings();
      showToast(DIFF_HINT[settings.difficulty], 200);
      break;
    }
    case 'reset': if (game.resetArm > 0) resetProgress(); else game.resetArm = 180; break;
  }
}
function openLevelSelect() { game.sel = continueLevel(); setState('LEVEL_SELECT'); }

function tileActivate(i) {
  game.sel = i;
  if (progress.open[i]) startFromMenu(i);
  else openCodeDialog(i);
}
function skinActivate(i) {
  const e = skinList()[i];
  if (!e) return;
  game.sel = i;
  if (!e.custom && !skinUnlocked(e.id)) { shakeTile(i); showToast(`Freischalten durch Level ${skinLevel(e.id) + 1}: ${LEVELS[skinLevel(e.id)].name}`); return; }
  settings.skin = e.id;
  saveSettings();
  sfx('collect');
}
function shakeTile(i) { game.tileShake = { i, t: 24 }; }

function onPress(p, src) {
  mouse = p;
  if (SIM.autotest) { autotestPress(p); return; }
  Music.unlock();
  // Ton-Regler unten rechts gibt es nur im Menü und in der Pause
  if (audioVisible() && inRect(p, UI.mute())) { Music.toggle(); return; }
  if (audioVisible() && inRect(p, UI.volHit())) { dragging = 'vol'; setVolumeFromX(p.x); return; }
  if (game.paused) {
    const b = hitList(pauseButtons(), p);
    if (b && b.id === 'menu') goMenu();
    else if (b && b.id === 'music') Music.toggle();
    else setPaused(false);
    return;
  }
  switch (game.state) {
    case 'MENU': { const b = hitList(menuButtons(), p); if (b) menuAction(b.id); break; }
    case 'LEVEL_SELECT': {
      if (inRect(p, UI.back())) { goMenu(); break; }
      const g = tileGrid();
      for (let i = 0; i < LEVELS.length; i++) if (inRect(p, g.rect(i))) { tileActivate(i); break; }
      break;
    }
    case 'SKIN_SELECT': {
      if (inRect(p, UI.back())) { goMenu(); break; }
      const g = skinGrid(), n = skinList().length;
      for (let i = 0; i < n; i++) if (inRect(p, g.rect(i))) { skinActivate(i); break; }
      break;
    }
    case 'LEVEL_INTRO':
      if (inRect(p, UI.pause())) { goMenu(); break; }
      if (game.t >= CONFIG.INTRO_LOCK) beginPlay();
      break;
    case 'PLAYING': case 'CHECKPOINT': case 'BOSS_INTRO': case 'BOSS_GRACE': case 'BOSS_FIGHT':
      if (inRect(p, UI.pause())) { setPaused(true); break; }
      game.waitTap = false;
      flapBird();
      break;
    case 'BOSS_DEFEATED':
      if (game.t >= 50) continueAfterBoss();
      break;
    case 'GAME_OVER': {
      if (game.t < CONFIG.DEATH_PANEL_DELAY + CONFIG.RESTART_LOCK) return;
      const b = hitList(gameOverButtons(), p);
      if (!b) return;
      if (b.id === 'menu') goMenu();
      else if (b.id === 'boss') restartBoss();
      else if (b.id === 'checkpoint') startLevel(game.level, 'checkpoint');
      else if (b.id === 'retry') startLevel(game.level, 'retry');
      break;
    }
    case 'VICTORY': {
      if (game.t <= 60) return;
      const b = hitList(victoryButtons(), p);
      if (b && b.id === 'editor') { goMenu(); openSkinEditor(); }
      else if (b && b.id === 'menu') goMenu();
      break;
    }
  }
}
function onDrag(p) {
  mouse = p;
  if (dragging === 'vol') setVolumeFromX(p.x);
  if (game.state === 'LEVEL_SELECT' && !dialogOpen()) {
    const g = tileGrid();
    for (let i = 0; i < LEVELS.length; i++) if (inRect(p, g.rect(i))) { if (game.sel !== i) { game.sel = i; if (progress.open[i]) setMenuBg(i); } break; }
  }
}
function onRelease() {
  if (dragging === 'vol') { dragging = null; saveSettings(); }
}
function setVolumeFromX(x) {
  const r = UI.vol();
  settings.volume = clamp((x - r.x) / r.w, 0, 1);
  Music.setVolume(settings.volume);
}

function autoPause() {
  if (ACTIVE_STATES.has(game.state) && !game.waitTap) setPaused(true);
}
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

// ---------- Dialoge (HTML, damit Tastaturen auf Mobilgeräten erscheinen) ----------
const dlg = {
  code: document.getElementById('codeDlg'), codeForm: document.getElementById('codeForm'), codeInput: document.getElementById('codeInput'),
  codeTitle: document.getElementById('codeTitle'), codeMsg: document.getElementById('codeMsg'), codeCancel: document.getElementById('codeCancel'),
  skin: document.getElementById('skinDlg'), skinForm: document.getElementById('skinForm'), skinCancel: document.getElementById('skinCancel'),
  skinPrev: document.getElementById('skinPrev'), skinMsg: document.getElementById('skinMsg'),
  open: null, codeLevel: -1, edit: null, prevT: 0
};
function dialogOpen() { return !!dlg.open; }
function openCodeDialog(li) {
  if (!dlg.code || !dlg.codeInput) {
    const v = typeof window.prompt === 'function' ? window.prompt(`Code für Level ${li + 1}`) : null;
    if (v !== null && v !== undefined) submitCode(li, v);
    return;
  }
  dlg.open = 'code';
  dlg.codeLevel = li;
  dlg.code.hidden = false;
  dlg.codeInput.value = '';
  if (dlg.codeTitle) dlg.codeTitle.textContent = `Level ${li + 1}: ${LEVELS[li].name}`;
  if (dlg.codeMsg) dlg.codeMsg.textContent = '';
  setTimeout(() => { try { dlg.codeInput.focus(); } catch (e) { /* ohne Fokus */ } }, 30);
}
function closeDialog() {
  if (dlg.code) dlg.code.hidden = true;
  if (dlg.skin) dlg.skin.hidden = true;
  const was = dlg.open;
  dlg.open = null;
  if (was === 'skin' && game.state === 'SKIN_EDITOR') setState('MENU');
  focusCanvas();
}
function submitCode(li, value) {
  // "TEST" startet den Autotest auch dort, wo die Adresse keine Parameter durchreicht (Artefakt)
  if (String(value || '').trim().toUpperCase() === 'TEST') {
    closeDialog();
    Music.setTrack(null);
    startAutotest();
    return true;
  }
  const res = tryCode(li, value);
  if (!res.ok) {
    shakeTile(li);
    sfx('error');
    if (dlg.codeMsg) dlg.codeMsg.textContent = res.text;
    try { dlg.codeInput.select(); } catch (e) { /* egal */ }
    return false;
  }
  closeDialog();
  sfx('levelup');
  if (res.li === li) { game.sel = li; startFromMenu(li); }
  else { showToast(res.text, 220); if (res.li >= 0) { game.sel = res.li; setMenuBg(res.li); } }
  return true;
}
if (dlg.codeForm) {
  dlg.codeForm.addEventListener('submit', e => { e.preventDefault(); submitCode(dlg.codeLevel, dlg.codeInput.value); });
  dlg.codeInput.addEventListener('input', () => { const v = dlg.codeInput.value.toUpperCase(); if (v !== dlg.codeInput.value) dlg.codeInput.value = v; });
}
if (dlg.codeCancel) dlg.codeCancel.addEventListener('click', closeDialog);
for (const box of [dlg.code, dlg.skin]) {
  if (!box) continue;
  box.addEventListener('keydown', e => { if (e.key === 'Escape') closeDialog(); e.stopPropagation(); });
  box.addEventListener('pointerdown', e => { if (e.target === box) closeDialog(); });
  box.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
}

// ---------- Skin-Editor ----------
function editorOptions() {
  const unlocked = SKINS.filter(s => skinUnlocked(s.id));
  const uniq = key => [...new Set(unlocked.map(s => s[key]))];
  return { shape: uniq('shape'), wing: uniq('wing'), eye: uniq('eye'), trail: uniq('trail') };
}
function validCustomSkin(s) {
  return s && typeof s.name === 'string' && s.name.length > 0 && s.name.length <= 18 && s.colors && /^#[0-9a-f]{6}$/i.test(s.colors.body || '') && /^#[0-9a-f]{6}$/i.test(s.colors.accent || '')
    && SKIN_LABELS.shape[s.shape] && SKIN_LABELS.wing[s.wing] && SKIN_LABELS.eye[s.eye] && SKIN_LABELS.trail[s.trail];
}
function fillSelect(el, list, labels, val) {
  if (!el) return;
  el.textContent = '';
  for (const v of list) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = labels[v];
    if (v === val) o.selected = true;
    el.appendChild(o);
  }
}
const edEl = id => document.getElementById(id);
function openSkinEditor() {
  if (!progress.completed) return;
  const base = currentSkin(), opt = editorOptions();
  dlg.edit = { name: '', shape: base.shape, wing: base.wing, eye: base.eye, trail: base.trail, colors: { body: base.colors.body, accent: base.colors.accent, wing: base.colors.wing } };
  if (!dlg.skin) { showToast('Der Editor braucht die HTML-Fassung'); return; }
  edEl('seBody').value = base.colors.body;
  edEl('seAccent').value = base.colors.accent;
  fillSelect(edEl('seShape'), opt.shape, SKIN_LABELS.shape, base.shape);
  fillSelect(edEl('seWing'), opt.wing, SKIN_LABELS.wing, base.wing);
  fillSelect(edEl('seEye'), opt.eye, SKIN_LABELS.eye, base.eye);
  fillSelect(edEl('seTrail'), opt.trail, SKIN_LABELS.trail, base.trail);
  edEl('seName').value = '';
  if (dlg.skinMsg) dlg.skinMsg.textContent = '';
  dlg.open = 'skin';
  dlg.skin.hidden = false;
  setState('SKIN_EDITOR');
  readEditor();
}
function readEditor() {
  const e = dlg.edit;
  if (!e) return;
  e.colors.body = edEl('seBody').value;
  e.colors.accent = edEl('seAccent').value;
  e.colors.wing = shade(e.colors.body, -0.22);
  e.shape = edEl('seShape').value;
  e.wing = edEl('seWing').value;
  e.eye = edEl('seEye').value;
  e.trail = edEl('seTrail').value;
}
function drawEditorPreview() {
  if (dlg.open !== 'skin' || !dlg.skinPrev || !dlg.edit) return;
  const c = dlg.skinPrev, g = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const cw = c.clientWidth || 160, chh = c.clientHeight || 110;
  if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(chh * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(chh * dpr); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  const s = Math.min(cw / 60, chh / 50) * 0.95 * dpr, phase = [1, 2, 1, 0][Math.floor(frame / 9) % 4];
  const ks = s, spr = makeSprite(-30, -26, 60, 50, ks, () => paintBird(dlg.edit, phase, false));
  g.drawImage(spr.c, c.width / 2 - spr.c.width / 2, c.height / 2 - spr.c.height / 2 + Math.sin(frame * 0.06) * 3 * dpr);
  freeCanvas(spr.c);
}
if (dlg.skinForm) {
  dlg.skinForm.addEventListener('input', readEditor);
  dlg.skinForm.addEventListener('change', readEditor);
  dlg.skinForm.addEventListener('submit', e => {
    e.preventDefault();
    readEditor();
    const name = String(edEl('seName').value || '').trim().slice(0, 18);
    if (!name) { if (dlg.skinMsg) dlg.skinMsg.textContent = 'Bitte gib deinem Skin einen Namen.'; return; }
    const sk = Object.assign({}, dlg.edit, { name, colors: Object.assign({}, dlg.edit.colors), custom: true });
    const i = progress.customSkins.findIndex(s => s.name === name);
    if (i >= 0) progress.customSkins[i] = sk;
    else {
      if (progress.customSkins.length >= 8) progress.customSkins.shift();
      progress.customSkins.push(sk);
    }
    settings.skin = 'c:' + name;
    saveProgress();
    saveSettings();
    closeDialog();
    showToast(`Skin "${name}" gespeichert und ausgewählt`);
  });
}
if (dlg.skinCancel) dlg.skinCancel.addEventListener('click', closeDialog);

// ============================================================
// Rendern: Kulissen aus Caches, Interpolation zwischen zwei Updates
// ============================================================
function onViewChanged(oldW) {
  const s = view.scale;
  if (document.documentElement && document.documentElement.style && document.documentElement.style.setProperty) document.documentElement.style.setProperty('--s', String(s));
  // Ein laufender Versuch wird nur neu ausgelegt: Die Weltposition des Vogels bleibt gleich
  if (oldW && oldW !== W && bird) {
    const d = Math.round(oldW * CONFIG.BIRD_X_FRAC) - birdHomeX();
    game.scroll += d;
    game.prevScroll += d;
    bird.x = bird.px = birdHomeX() + bird.dx;
  }
}

function drawScene(li, camX, a, withWorld) {
  const cache = getLevelCache(li), k = view.k;
  camXd = Math.round(camX * k);
  ctx.save();
  devT();
  ctx.globalAlpha = 1;
  drawSkyDev(cache, li);
  drawSceneTracks(cache, 0, camX);
  for (let i = 0; i < 3; i++) {
    if (!sceneHidesLayer(li, i)) drawStrip(cache.layers[i], camX * CONFIG.PARALLAX[i]);
    drawSceneTracks(cache, i + 1, camX);
  }
  ctx.restore();
  if (withWorld) {
    logT();
    drawAmbient(a);
    drawHazards(cache, a, false, camX);
    drawPipes(cache, a);
  }
  ctx.save();
  devT();
  drawStrip(cache.ground, camX);
  if (cache.ceiling) drawStrip(cache.ceiling, camX);
  ctx.restore();
  if (withWorld) {
    logT();
    drawPickups(a);
    drawHazards(cache, a, true, camX);
  }
}

// Himmel möglichst als 1:1-Kopie (schnellster Weg). Beim Wackeln werden die frei werdenden
// Ränder mit der Himmelsfarbe gefüllt statt das Bild zu skalieren.
function drawSkyDev(cache, li) {
  const s = cache.sky, cw = canvas.width, ch = canvas.height;
  if (s.width === cw && s.height === ch) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const ox = Math.round(shakeFx.x * view.k), oy = Math.round(shakeFx.y * view.k);
    if (ox || oy) {
      const C = COLORS[li];
      ctx.fillStyle = C.skyTop;
      if (oy > 0) ctx.fillRect(-ox - 2, -oy - 2, cw + 4 + Math.abs(ox), oy + 2);
      if (oy < 0) ctx.fillRect(-ox - 2, ch, cw + 4 + Math.abs(ox), -oy + 2);
      ctx.fillStyle = mix(C.skyTop, C.skyBottom, 0.5);
      if (ox > 0) ctx.fillRect(-ox - 2, -oy - 2, ox + 2, ch + 4 + Math.abs(oy));
      if (ox < 0) ctx.fillRect(cw, -oy - 2, -ox + 2, ch + 4 + Math.abs(oy));
    }
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, 0, 0, cw, ch);
  }
}

function renderWorld(a, camX) {
  const li = game.level;
  drawScene(li, camX, a, true);
  logT();
  drawBoss(li, a);
  drawShots(li, a);
  drawParticles(false, a);
  drawBird(a);
  logT();
  drawParticles(true, a);
  if (game.dark > 0.01) drawDarkness(a, game.dark);
}

function renderTransition(a, camX) {
  const tr = game.trans, f = ease.inOutQuad((game.t + a) / CONFIG.CROSSFADE_FRAMES);
  drawScene(tr.from, camX, a, false);
  sizeFadeLayer(true);
  withCtx(fadeLayer.ctx, () => { applyContextState(fadeLayer.ctx); drawScene(tr.to, camX, a, false); });
  blit(fadeLayer.canvas, clamp(f, 0, 1));
  logT();
  drawParticles(false, a);
  drawBird(a);
  logT();
  drawParticles(true, a);
}

function render(a) {
  if ((window.devicePixelRatio || 1) !== view.dpr) resize();
  ctx = mainCtx;
  applyContextState(mainCtx);
  if (SIM.autotest) { renderAutotest(); return; }
  if (MENU_STATES.has(game.state)) {
    renderMenu();
    drawAudioControls();
    drawToast();
    if (dlg.open === 'skin') drawEditorPreview();
    return;
  }
  const camX = lerp(game.prevScroll, game.scroll, a);
  if (game.state === 'LEVEL_TRANSITION') renderTransition(a, camX); else renderWorld(a, camX);
  applyContextState(mainCtx);
  if (game.flash > 0) {
    ctx.fillStyle = rgba(game.flashColor, game.flash * 0.55);
    ctx.fillRect(0, 0, W, H);
  }
  blitVignette();
  drawHUD();
  drawStateOverlay(a);
  if (game.paused) { drawPause(); drawAudioControls(); }
  drawToast();
}

function blitVignette() {
  const v = getVignette();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(v, 0, 0);
  ctx.restore();
}

// ============================================================
// Bausteine der Oberfläche
// ============================================================
const gradCache = new Map();
function vgradMain(y0, y1, stops) {
  const key = y0 + ':' + y1 + ':' + stops.map(s => s.join('@')).join('|');
  let g = gradCache.get(key);
  if (!g) {
    g = mainCtx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    if (gradCache.size > 96) gradCache.clear();
    gradCache.set(key, g);
  }
  return g;
}

function panel(x, y, w, h, C) {
  roundRectPath(x + 3, y + 5, w, h, 16);
  ctx.fillStyle = rgba(INK, 0.28);
  ctx.fill();
  roundRectPath(x, y, w, h, 16);
  ctx.fillStyle = (ctx === mainCtx ? vgradMain : vgrad)(y, y + h, [[0, rgba(mix(INK, C.near, 0.35), 0.95)], [1, rgba(mix(INK, C.near, 0.15), 0.95)]]);
  ctx.fill();
  ctx.strokeStyle = rgba(C.accent, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRectPath(x + 4, y + 4, w - 8, h - 8, 12);
  ctx.strokeStyle = rgba(CREAM, 0.07);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function button(b, label, primary, C, disabled) {
  const hover = !disabled && hov(b);
  roundRectPath(b.x + 1.5, b.y + 3, b.w, b.h, 12);
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.fill();
  roundRectPath(b.x, b.y, b.w, b.h, 12);
  if (primary) {
    const base = hover ? mix(C.accent, CREAM, 0.2) : C.accent;
    ctx.fillStyle = (ctx === mainCtx ? vgradMain : vgrad)(b.y, b.y + b.h, [[0, mix(base, CREAM, 0.18)], [1, shade(base, -0.12)]]);
  } else ctx.fillStyle = hover ? rgba(CREAM, 0.22) : rgba(CREAM, 0.1);
  ctx.globalAlpha = disabled ? 0.45 : 1;
  ctx.fill();
  ctx.strokeStyle = primary ? rgba(CREAM, 0.35) : rgba(CREAM, 0.3);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const fg = primary ? (luminance(C.accent) > 0.3 ? INK : CREAM) : CREAM;
  const size = b.h >= 44 ? FS.md : b.h >= 34 ? FS.sm : FS.xs;
  let lab = label;
  ctx.font = `bold ${size}px ${FONT}`;
  while (ctx.measureText(lab).width > b.w - 20 && lab.length > 4) lab = lab.slice(0, -2).trimEnd() + '…';
  text(lab, b.x + b.w / 2, b.y + b.h / 2 + 1, size, fg);
  ctx.globalAlpha = 1;
}

function speakerIcon(x, y, on, col) {
  poly([[x - 6, y - 3], [x - 3, y - 3], [x + 2, y - 7], [x + 2, y + 7], [x - 3, y + 3], [x - 6, y + 3]], col);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (on) {
    ctx.arc(x + 3, y, 5, -0.8, 0.8);
    ctx.moveTo(x + 3 + Math.cos(-0.8) * 9, y + Math.sin(-0.8) * 9);
    ctx.arc(x + 3, y, 9, -0.8, 0.8);
  } else {
    ctx.moveTo(x + 5, y - 4); ctx.lineTo(x + 12, y + 4);
    ctx.moveTo(x + 12, y - 4); ctx.lineTo(x + 5, y + 4);
  }
  ctx.stroke();
}

function iconButton(b, draw) {
  roundRectPath(b.x, b.y, b.w, b.h, 9);
  ctx.fillStyle = rgba(INK, hov(b) ? 0.55 : 0.4);
  ctx.fill();
  ctx.strokeStyle = rgba(CREAM, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  draw(b);
}
const backIcon = b => {
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(b.x + 21, b.y + 10); ctx.lineTo(b.x + 13, b.y + 17); ctx.lineTo(b.x + 21, b.y + 24);
  ctx.stroke();
};

// Mute-Knopf und Lautstärkeregler, unten rechts auf dem Bodenstreifen
function drawAudioControls() {
  const m = UI.mute(), r = UI.vol(), on = Music.enabled;
  ctx.save();
  applyContextState(ctx);
  ctx.globalAlpha = MENU_STATES.has(game.state) || game.paused ? 1 : 0.82;
  iconButton(m, b => speakerIcon(b.x + 13, b.y + b.h / 2, on, on ? CREAM : rgba(CREAM, 0.6)));
  roundRectPath(r.x, r.y + 4, r.w, 6, 3);
  ctx.fillStyle = rgba(INK, 0.55);
  ctx.fill();
  const f = settings.volume;
  if (f > 0.01) { roundRectPath(r.x, r.y + 4, Math.max(6, r.w * f), 6, 3); ctx.fillStyle = on ? mix(CREAM, COLORS[MENU_STATES.has(game.state) ? game.menuBg.cur : game.level].accent, 0.4) : rgba(CREAM, 0.35); ctx.fill(); }
  circle(r.x + r.w * f, r.y + 7, 7, on ? CREAM : mix(CREAM, INK, 0.4));
  ctx.strokeStyle = rgba(INK, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(r.x + r.w * f, r.y + 7, 7, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawToast() {
  if (!game.toast) return;
  const C = COLORS[MENU_STATES.has(game.state) ? game.menuBg.cur : game.level];
  const al = Math.min(1, game.toast.t / 20);
  ctx.save();
  applyContextState(ctx);
  ctx.globalAlpha = al;
  const lines = wrapLines(game.toast.text, Math.min(340, W - 60), FS.sm, 'bold');
  ctx.font = `bold ${FS.sm}px ${FONT}`;
  const tw = Math.min(W - 24, Math.max(...lines.map(l => ctx.measureText(l).width)) + 36), th = 18 + lines.length * 20;
  const y = MENU_STATES.has(game.state) ? 500 : GROUND_Y - 30;
  roundRectPath(W / 2 - tw / 2, y - th / 2, tw, th, 12);
  ctx.fillStyle = rgba(mix(INK, C.near, 0.3), 0.96);
  ctx.fill();
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  lines.forEach((l, i) => text(l, W / 2, y - (lines.length - 1) * 10 + i * 20 + 1, FS.sm, CREAM));
  ctx.restore();
}

// ============================================================
// HUD: an die Kanten gebunden
// ============================================================
function drawHUD() {
  const L = LEVELS[game.level], C = COLORS[game.level], stroke = rgba(INK, 0.78);
  const bossPhase = BOSS_STATES.has(game.state) || (game.state === 'GAME_OVER' && game.diedInBoss);
  if (game.state === 'VICTORY') return;
  if (!bossPhase) {
    // Punkte: die Rohre dieses Levels, jedes Level beginnt bei 0
    const sp = REDUCED_MOTION ? 1 : 1 + 0.18 * game.scorePop;
    ctx.save();
    ctx.translate(W / 2, 46);
    ctx.transform(sp, 0, 0, sp, 0, 0);
    text(String(Math.round(game.shownScore)), 0, 2, FS.xl, rgba(INK, 0.35), { stroke: rgba(INK, 0.35), lw: 9 });
    text(String(Math.round(game.shownScore)), 0, 0, FS.xl, CREAM, { stroke: rgba(INK, 0.85), lw: 7 });
    ctx.restore();
  }
  if (game.state === 'LEVEL_TRANSITION' || game.state === 'VICTORY') return;
  iconButton(UI.pause(), b => {
    if (game.state === 'LEVEL_INTRO') backIcon(b);
    else { ctx.fillStyle = CREAM; ctx.fillRect(b.x + 11, b.y + 10, 4, 14); ctx.fillRect(b.x + 19, b.y + 10, 4, 14); }
  });
  if (bossPhase) drawBossBar(C, stroke);
  else {
    const maxNameW = W / 2 - 52 - 40;
    ctx.font = `bold ${FS.md}px ${FONT}`;
    const nameSize = ctx.measureText(L.name).width > maxNameW ? FS.sm : FS.md;
    text(`Level ${game.level + 1} von ${LEVELS.length}`, 52, 17, FS.xxs, mix(CREAM, C.accent, 0.4), { align: 'left', stroke, lw: 3 });
    text(L.name, 52, 35, nameSize, CREAM, { align: 'left', stroke, lw: 4 });
    const total = pipesFor(game.level), pop = 1 + 0.2 * game.obsPop, label = `${Math.round(game.shownPipes)} / ${total}`;
    ctx.save();
    ctx.translate(W - 14, 19);
    ctx.transform(pop, 0, 0, pop, 0, 0);
    text(label, 0, 0, FS.md, CREAM, { align: 'right', stroke, lw: 4 });
    ctx.restore();
    ctx.font = `bold ${FS.md}px ${FONT}`;
    const ix = W - 14 - ctx.measureText(label).width - 16;
    ctx.fillStyle = rgba(INK, 0.6);
    ctx.fillRect(ix - 1, 10, 10, 20);
    ctx.fillStyle = C.pipe;
    ctx.fillRect(ix, 16, 8, 13);
    ctx.fillRect(ix - 1.5, 11, 11, 6);
    const bw = 84, bx = W - 14 - bw, by = 35;
    roundRectPath(bx, by, bw, 6, 3);
    ctx.fillStyle = rgba(INK, 0.5);
    ctx.fill();
    const f = clamp(game.shownPipes / total, 0, 1);
    if (f > 0.01) { roundRectPath(bx, by, Math.max(6, bw * f), 6, 3); ctx.fillStyle = C.accent; ctx.fill(); }
    const cpAt = checkpointAt(game.level);
    if (cpAt) {
      const cx = bx + bw * cpAt / total;
      ctx.fillStyle = game.checkpoint ? CREAM : rgba(CREAM, 0.55);
      ctx.fillRect(cx - 1, by - 3, 2, 12);
      poly([[cx, by - 7], [cx + 6, by - 4.5], [cx, by - 2]], game.checkpoint ? C.accent : rgba(CREAM, 0.55));
    }
  }
  drawHelpers(C);
}

// Im Bosskampf oben links: Name des Bosses und sein Lebensbalken, ein Feld pro nötigem Treffer
function drawBossBar(C, stroke) {
  const b = boss || bossOut;
  if (!b) return;
  const need = b.need || 1, hits = Math.min(need, b.hits || 0), BC = COLORS[b.li], pop = 1 + 0.12 * game.dodgePop;
  const top = game.rush ? `Boss ${game.rush.i + 1} von ${LEVELS.length}` : `Level ${game.level + 1} von ${LEVELS.length}`;
  text(top, 52, 15, FS.xxs, mix(CREAM, C.accent, 0.4), { align: 'left', stroke, lw: 3 });
  const right = `Treffer ${hits} / ${need}`;
  ctx.font = `bold ${FS.xs}px ${FONT}`;
  const rw = ctx.measureText(right).width, maxNameW = W - 52 - rw - 30;
  let name = LEVELS[b.li].boss.name, size = FS.md;
  ctx.font = `bold ${size}px ${FONT}`;
  if (ctx.measureText(name).width > maxNameW) size = FS.sm;
  text(name, 52, 32, size, CREAM, { align: 'left', stroke, lw: 4 });
  text(right, W - 14, 19, FS.xs, mix(CREAM, C.accent, 0.35), { align: 'right', stroke, lw: 4 });
  const bw = Math.min(180, W - 52 - 14), bx = 52, by = 46, gap = need > 10 ? 2 : 3, cw = (bw - gap * (need - 1)) / need;
  ctx.save();
  ctx.translate(bx, by + 4);
  ctx.transform(pop, 0, 0, pop, 0, 0);
  ctx.translate(-bx, -(by + 4));
  roundRectPath(bx - 3, by - 3, bw + 6, 14, 6);
  ctx.fillStyle = rgba(INK, 0.6);
  ctx.fill();
  for (let i = 0; i < need; i++) {
    roundRectPath(bx + i * (cw + gap), by, cw, 8, Math.min(4, cw / 2));
    ctx.fillStyle = i < need - hits ? mix(BC.accent, CREAM, 0.15) : rgba(CREAM, 0.12);
    ctx.fill();
  }
  ctx.restore();
}

// Unten links auf dem Bodenstreifen: laufende Fähigkeit als Balken, Extraleben und Gratis-Respawn als Symbole
function drawHelpers(C) {
  if ((!ACTIVE_STATES.has(game.state) && game.state !== 'LEVEL_INTRO') || game.paused) return;
  let x = 12;
  const y = GROUND_Y + 28;
  const chip = (draw, label, col) => {
    ctx.font = `bold ${FS.xxs}px ${FONT}`;
    const w = 30 + ctx.measureText(label).width;
    roundRectPath(x, y - 12, w, 24, 12);
    ctx.fillStyle = rgba(INK, 0.6);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    draw(x + 13, y);
    text(label, x + 24, y + 1, FS.xxs, CREAM, { align: 'left' });
    x += w + 8;
  };
  if (abil.extra) chip((cx, cy) => abilityIcon('ZWEITE_CHANCE', cx, cy, 7, ABILITIES.ZWEITE_CHANCE.color), 'Extraleben', ABILITIES.ZWEITE_CHANCE.color);
  const bossPhase = BOSS_STATES.has(game.state);
  if (diff() === 'leicht' && game.free && game.free[bossPhase ? 'boss' : 'pipe']) {
    chip((cx, cy) => {
      ctx.strokeStyle = '#9fe6c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, -0.4, Math.PI * 1.5);
      ctx.stroke();
      poly([[cx + 2, cy - 9], [cx + 7, cy - 6], [cx + 2, cy - 2]], '#9fe6c8');
    }, 'Gratis-Respawn', '#9fe6c8');
  }
  // laufende Fähigkeit: Balken oben in der Mitte unter den Punkten
  const k = abil.active;
  if (k) {
    const left = abil[TIMED[k]] / CONFIG.ABILITY_FRAMES, w = 150, bx = W / 2 - w / 2, by = 76;
    roundRectPath(bx, by, w, 18, 9);
    ctx.fillStyle = rgba(INK, 0.6);
    ctx.fill();
    roundRectPath(bx, by, Math.max(14, w * left), 18, 9);
    ctx.fillStyle = ABILITIES[k].color;
    ctx.fill();
    abilityIcon(k, bx + 12, by + 9, 6, INK);
    text(`${ABILITIES[k].name} ${Math.ceil(abil[TIMED[k]] / 60)} s`, W / 2 + 6, by + 10, FS.xs, INK);
  }
}

function drawStateOverlay(a) {
  switch (game.state) {
    case 'LEVEL_INTRO': drawIntroCard(); break;
    case 'CHECKPOINT': drawCheckpointBanner(); break;
    case 'BOSS_INTRO': drawBossBanner(game.introShort ? Math.min(1, game.t / 12, (introFrames() - game.t) / 16) : Math.min(1, game.t / 20)); break;
    case 'BOSS_GRACE': drawBossBanner(Math.max(0, 1 - game.t / 30)); drawGrace(); break;
    case 'BOSS_DEFEATED': drawDefeat(); break;
    case 'LEVEL_TRANSITION': drawTransitionBanner(a); break;
    case 'GAME_OVER': drawGameOver(); break;
    case 'VICTORY': drawVictory(); break;
  }
}

function drawIntroCard() {
  const L = LEVELS[game.level], C = COLORS[game.level], li = game.level;
  const p = REDUCED_MOTION ? 1 : ease.outBack(Math.min(1, game.t / 22));
  const P = panelRect(340, 210, 386), cx = W / 2;
  ctx.save();
  ctx.translate(cx, P.y + P.h / 2);
  ctx.transform(p, 0, 0, p, 0, 0);
  ctx.translate(-cx, -(P.y + P.h / 2));
  panel(P.x, P.y, P.w, P.h, C);
  text(`Level ${li + 1} von ${LEVELS.length}`, cx, P.y + 24, FS.xs, C.accent);
  text(L.name, cx, P.y + 56, FS.title - 4, CREAM);
  const fromCp = game.pipesStart > 0;
  const hint = fromCp ? `Weiter ab Checkpoint: Rohr ${game.pipesStart} von ${L.pipeCount}.` : L.hint;
  const lines = wrapLines(hint, P.w - 44, FS.sm);
  lines.slice(0, 4).forEach((ln, i) => text(ln, cx, P.y + 92 + i * 21, FS.sm, rgba(CREAM, 0.9), { weight: 'normal' }));
  const yy = P.y + P.h - 22;
  const info = `${L.pipeCount} Rohre, dann ` + (isRushLevel(li) ? 'alle 15 Bosse nacheinander' : `${L.boss.name} (${bossNeedFor(li)} ${bossNeedFor(li) === 1 ? 'Treffer' : 'Treffer'})`) +
    (checkpointAt(li) && !fromCp ? ', Checkpoint bei der Hälfte' : '') + `. ${DIFF_LABEL[diff()]}`;
  const il = wrapLines(info, P.w - 40, FS.xs);
  il.slice(0, 2).forEach((ln, i) => text(ln, cx, yy - (il.length - 1 - i) * 17, FS.xs, mix(CREAM, C.accent, 0.4), { weight: 'normal' }));
  ctx.restore();
  text('Tippen, klicken oder Leertaste', cx, P.y + P.h + 30, FS.sm, CREAM, { stroke: rgba(INK, 0.7), lw: 4 });
}

function drawCheckpointBanner() {
  const C = COLORS[game.level], t = game.t, al = t < 15 ? t / 15 : t > CONFIG.CHECKPOINT_BANNER - 25 ? (CONFIG.CHECKPOINT_BANNER - t) / 25 : 1;
  ctx.save();
  ctx.globalAlpha = clamp(al, 0, 1);
  const tw = Math.min(W - 40, 260);
  roundRectPath(W / 2 - tw / 2, 82, tw, 52, 14);
  ctx.fillStyle = rgba(mix(INK, C.near, 0.3), 0.9);
  ctx.fill();
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text('Checkpoint erreicht', W / 2, 101, FS.md, CREAM);
  text(`Neustart ab hier bei Rohr ${game.checkpoint ? game.checkpoint.pipes : 0}`, W / 2, 121, FS.xxs, mix(CREAM, C.accent, 0.4), { weight: 'normal' });
  ctx.restore();
}

function drawBossBanner(a) {
  if (a <= 0 || !boss) return;
  const L = LEVELS[boss.li], C = COLORS[boss.li];
  const off = (1 - ease.outCubic(a)) * -40, P = panelRect(330, 70, 101 + off);
  ctx.save();
  ctx.globalAlpha = a;
  panel(P.x, P.y, P.w, P.h, C);
  const title = game.rush ? `Boss ${game.rush.i + 1} von ${LEVELS.length}: ${L.boss.name}` : `Boss: ${L.boss.name}`;
  text(title, W / 2, P.y + 22, FS.md, CREAM);
  const n = boss.need, lab = `${PATTERNS[L.boss.pattern].label}. ` + (n === 1 ? 'Weiche einem Angriff aus, er prallt zurück und trifft den Boss.' : `Weiche ${n} Angriffen aus, sie prallen zurück und treffen den Boss.`);
  const ls = wrapLines(lab, P.w - 24, FS.xxs);
  ls.slice(0, 2).forEach((l, i) => text(l, W / 2, P.y + 46 + i * 13 - (ls.length - 1) * 6, FS.xxs, mix(CREAM, C.accent, 0.35), { weight: 'normal' }));
  ctx.restore();
}

function drawGrace() {
  const C = COLORS[game.level], f = game.waitTap ? 0 : clamp(game.t / CONFIG.BOSS_GRACE_FRAMES, 0, 1);
  const y = 196, al = game.t > CONFIG.BOSS_GRACE_FRAMES - 15 ? (CONFIG.BOSS_GRACE_FRAMES - game.t) / 15 : Math.min(1, game.t / 10 + (game.waitTap ? 1 : 0));
  ctx.save();
  ctx.globalAlpha = clamp(al, 0, 1);
  text('Bereit machen', W / 2, y, FS.lg, CREAM, { stroke: rgba(INK, 0.8), lw: 6 });
  if (game.waitTap) text('Tippen, klicken oder Leertaste', W / 2, y + 34, FS.sm, mix(CREAM, C.accent, 0.4), { stroke: rgba(INK, 0.7), lw: 4 });
  else {
    roundRectPath(W / 2 - 60, y + 26, 120, 6, 3);
    ctx.fillStyle = rgba(INK, 0.5);
    ctx.fill();
    roundRectPath(W / 2 - 60, y + 26, Math.max(6, 120 * (1 - f)), 6, 3);
    ctx.fillStyle = C.accent;
    ctx.fill();
  }
  ctx.restore();
}

function drawDefeat() {
  const L = LEVELS[game.level], C = COLORS[game.level], d = game.defeat || {};
  const name = boss ? LEVELS[boss.li].boss.name : L.boss.name;
  const p = REDUCED_MOTION ? 1 : ease.outBack(Math.min(1, game.t / 24));
  if (game.t < 40) {
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.transform(p, 0, 0, p, 0, 0);
    text(game.rush ? 'Alle 15 Bosse besiegt' : `${name} besiegt`, 0, 0, FS.lg, CREAM, { stroke: rgba(INK, 0.8), lw: 6 });
    ctx.restore();
    return;
  }
  const q = REDUCED_MOTION ? 1 : ease.outBack(Math.min(1, (game.t - 40) / 22)), P = defeatPanel();
  ctx.fillStyle = rgba(INK, 0.3 * Math.min(1, (game.t - 40) / 20));
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, P.y + P.h / 2);
  ctx.transform(q, 0, 0, q, 0, 0);
  ctx.translate(-W / 2, -(P.y + P.h / 2));
  panel(P.x, P.y, P.w, P.h, C);
  let y = P.y + 32;
  text(game.rush ? 'Alle Bosse besiegt' : `${name} besiegt`, W / 2, y, FS.lg - 4, CREAM);
  y += 30;
  text(`Level ${game.level + 1} geschafft: ${L.name}`, W / 2, y, FS.xs, mix(CREAM, C.accent, 0.4), { weight: 'normal' });
  y += 28;
  if (d.skin) {
    ctx.fillStyle = rgba(CREAM, 0.08);
    roundRectPath(P.x + 20, y - 6, P.w - 40, 80, 12);
    ctx.fill();
    drawSkinPreview(d.skin, P.x + 70, y + 34, 1.5, [1, 2, 1, 0][Math.floor(frame / 8) % 4]);
    text('Neuer Skin', P.x + 118, y + 20, FS.xs, mix(CREAM, C.accent, 0.4), { align: 'left', weight: 'normal' });
    text(d.skin.name, P.x + 118, y + 42, FS.md, CREAM, { align: 'left' });
    y += 92;
  }
  if (d.editor) text('Skin-Editor freigeschaltet', W / 2, y + 4, FS.md, C.accent);
  const ready = game.t >= 50;
  for (const b of defeatButtons()) button(b, game.level >= LEVELS.length - 1 ? 'Zum Abschluss' : 'Weiter', true, C, !ready);
  ctx.restore();
}

function drawTransitionBanner(a) {
  const tr = game.trans, L = LEVELS[tr.to], C = COLORS[tr.to];
  const t = (game.t + a) / CONFIG.CROSSFADE_FRAMES;
  const al = t < 0.2 ? t / 0.2 : t > 0.85 ? (1 - t) / 0.15 : 1;
  ctx.save();
  ctx.globalAlpha = clamp(al, 0, 1);
  text('Nächstes Biom', W / 2, 150, FS.sm, mix(CREAM, C.accent, 0.4), { stroke: rgba(INK, 0.7), lw: 4 });
  text(L.name, W / 2, 186, FS.title, CREAM, { stroke: rgba(INK, 0.8), lw: 7 });
  ctx.restore();
}

function drawGameOver() {
  const d = game.t - CONFIG.DEATH_PANEL_DELAY;
  if (d < 0) return;
  const L = LEVELS[game.level], C = COLORS[game.level], P = panelRect(320, 300, 318), hard = diff() === 'schwer';
  ctx.fillStyle = rgba(INK, 0.35 * Math.min(1, d / 20));
  ctx.fillRect(0, 0, W, H);
  const p = REDUCED_MOTION ? 1 : ease.outBack(Math.min(1, d / 22));
  ctx.save();
  ctx.translate(W / 2, P.y + P.h / 2);
  ctx.transform(p, 0, 0, p, 0, 0);
  ctx.translate(-W / 2, -(P.y + P.h / 2));
  panel(P.x, P.y, P.w, P.h, C);
  text('Abgestürzt', W / 2, P.y + 34, FS.lg, CREAM);
  text(`Level ${game.level + 1}: ${L.name}, Ursache: ${game.deathCause}`, W / 2, P.y + 64, FS.xs, mix(CREAM, C.accent, 0.4), { weight: 'normal' });
  const b0 = boss || bossOut;
  const reached = game.diedInBoss
    ? (game.rush ? `Boss ${game.rush.i + 1} von ${LEVELS.length}` : `Boss: ${b0 ? b0.hits : 0} von ${b0 ? b0.need : 0} Treffern`)
    : `Rohre: ${game.pipesPassed} von ${pipesFor(game.level)}`;
  text(reached, W / 2, P.y + 98, FS.md, CREAM);
  const note = game.diedInBoss
    ? (hard ? 'Schwer: Das Level beginnt von vorn' : game.rush && game.rush.cp ? `Der Ansturm geht ab Boss ${CONFIG.RUSH_CHECKPOINT + 1} weiter` : 'Der Bosskampf beginnt neu')
    : game.checkpoint ? `Checkpoint bei Rohr ${game.checkpoint.pipes}` : 'Neustart am Levelanfang';
  text(note, W / 2, P.y + 126, FS.xxs, rgba(CREAM, 0.75), { weight: 'normal' });
  const locked = game.t < CONFIG.DEATH_PANEL_DELAY + CONFIG.RESTART_LOCK;
  for (const b of gameOverButtons()) {
    const lab = { boss: 'Bosskampf neu starten', checkpoint: `Ab Checkpoint (Rohr ${game.checkpoint ? game.checkpoint.pipes : 0})`, retry: 'Levelanfang', menu: 'Zum Menü' }[b.id];
    button(b, lab, b.id === 'boss' || b.id === 'checkpoint' || (b.id === 'retry' && !game.checkpoint), C, locked);
  }
  ctx.restore();
  const keys = game.diedInBoss ? (hard ? 'Leertaste: Level neu, Esc: Menü' : 'Leertaste: Bosskampf, Esc: Menü') : game.checkpoint ? 'Leertaste: Checkpoint, R: Levelanfang, Esc: Menü' : 'Leertaste: neu starten, Esc: Menü';
  text(keys, W / 2, P.y + P.h + 22, FS.xxs, rgba(CREAM, 0.75), { stroke: rgba(INK, 0.6), lw: 3, weight: 'normal' });
}

function drawPause() {
  const C = COLORS[game.level], P = panelRect(288, 252, 332);
  ctx.fillStyle = rgba(INK, 0.55);
  ctx.fillRect(0, 0, W, H);
  panel(P.x, P.y, P.w, P.h, C);
  text('Pause', W / 2, P.y + 36, FS.lg, CREAM);
  text('Leertaste: weiter, Esc: Menü, M: Musik', W / 2, P.y + 66, FS.xxs, rgba(CREAM, 0.75), { weight: 'normal' });
  const [r, m, mn] = pauseButtons();
  button(r, 'Weiter', true, C);
  button(m, Music.enabled ? 'Musik an' : 'Musik aus', false, C);
  button(mn, 'Zum Menü', false, C);
}

function drawVictory() {
  const t = game.t, C = COLORS[game.level], P = panelRect(340, 440, 320);
  ctx.fillStyle = rgba(INK, 0.5 * Math.min(1, t / 30));
  ctx.fillRect(0, 0, W, H);
  const p = REDUCED_MOTION ? 1 : ease.outBack(Math.min(1, t / 30)), e = REDUCED_MOTION ? 1 : ease.outCubic(clamp((t - 20) / 70, 0, 1));
  ctx.save();
  ctx.translate(W / 2, P.y + P.h / 2);
  ctx.transform(p, 0, 0, p, 0, 0);
  ctx.translate(-W / 2, -(P.y + P.h / 2));
  panel(P.x, P.y, P.w, P.h, C);
  text('Geschafft', W / 2, P.y + 40, FS.title, CREAM);
  text('Alle 15 Biome und Bosse', W / 2, P.y + 76, FS.sm, mix(CREAM, C.accent, 0.4), { weight: 'normal' });
  const rows = [
    [game.runFromStart ? 'Gesamtzeit' : 'Spielzeit', formatTime(Math.round(game.runFrames * e))],
    ['Abstürze', String(Math.round(game.deaths * e))],
    ['Schwierigkeit', DIFF_LABEL[diff()]]
  ];
  rows.forEach(([k, v], i) => {
    const y = P.y + 122 + i * 46;
    text(k, P.x + 30, y, FS.sm, rgba(CREAM, 0.75), { align: 'left', weight: 'normal' });
    text(v, P.x + P.w - 30, y, FS.lg - 4, CREAM, { align: 'right' });
    ctx.fillStyle = rgba(CREAM, 0.12);
    ctx.fillRect(P.x + 30, y + 20, P.w - 60, 1);
  });
  const y2 = P.y + 268;
  if (progress.best) text(`Bester Lauf ab Level 1: ${formatTime(progress.best.frames)}, ${progress.best.deaths} Abstürze`, W / 2, y2, FS.xxs, mix(CREAM, C.accent, 0.4), { weight: 'normal' });
  text('Der Skin-Editor ist jetzt freigeschaltet', W / 2, y2 + 24, FS.xs, CREAM, { weight: 'normal' });
  if (t > 60) { const [ed, mn] = victoryButtons(); button(ed, 'Skin-Editor öffnen', false, C); button(mn, 'Zum Menü', true, C); }
  ctx.restore();
}

// ============================================================
// Menüs: alles Statische liegt in einer zwischengespeicherten Ebene,
// pro Frame kommen nur Auswahl, Hover, Vorschau-Vogel und Hinweise dazu
// ============================================================
const menuFx = { key: '', c: null, prev: null, bg: -1 };
function freeMenuLayers() {
  freeCanvas(menuFx.c); freeCanvas(menuFx.prev);
  menuFx.c = menuFx.prev = null;
  menuFx.key = '';
}
function menuCacheKey() {
  const st = game.state === 'SKIN_EDITOR' ? 'MENU' : game.state;
  return [st, canvas.width, canvas.height, W, game.menuBg.cur, progress.open.map(o => (o ? 1 : 0)).join(''), progress.beaten.map(b => (b ? 1 : 0)).join(''),
    progress.completed, progress.customSkins.length, settings.ambient, settings.difficulty, progress.resume ? progress.resume.li + ':' + progress.resume.pipes : '-', String(settings.skin), game.resetArm > 0,
    thumbs.list.filter(Boolean).length, thumbs.kt, game.tileShake ? game.tileShake.i + ':' + game.tileShake.t : '-'].join('|');
}
function renderMenu() {
  const key = menuCacheKey(), mb = game.menuBg;
  if (key !== menuFx.key) {
    if (menuFx.c && menuFx.bg !== mb.cur) { freeCanvas(menuFx.prev); menuFx.prev = menuFx.c; menuFx.c = null; }
    if (!menuFx.c || menuFx.c.width !== canvas.width || menuFx.c.height !== canvas.height) { freeCanvas(menuFx.c); menuFx.c = newCanvas(canvas.width, canvas.height); }
    const g = menuFx.c.getContext('2d');
    withCtx(g, () => {
      applyContextState(g);
      uiStatic = true;
      try {
        renderMenuScene();
        blitVignette();
        applyContextState(g);
        if (game.state === 'LEVEL_SELECT') drawLevelSelect();
        else if (game.state === 'SKIN_SELECT') drawSkinSelect();
        else drawMainMenu();
      } finally { uiStatic = false; }
    });
    menuFx.key = key;
    menuFx.bg = mb.cur;
  }
  const fading = mb.t < 20 && mb.cur !== mb.prev && menuFx.prev && menuFx.prev.width === canvas.width;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (fading) ctx.drawImage(menuFx.prev, 0, 0);
  ctx.globalAlpha = fading ? ease.inOutQuad(mb.t / 20) : 1;
  ctx.drawImage(menuFx.c, 0, 0);
  ctx.restore();
  applyContextState(mainCtx);
  if (game.state === 'LEVEL_SELECT') drawLevelSelectDynamic();
  else if (game.state === 'SKIN_SELECT') drawSkinSelectDynamic();
  else drawMainMenuDynamic();
}

function drawThumbFull(li, alpha) {
  const t = getThumb(li, true);
  if (!t) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(t, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
function renderMenuScene() {
  drawThumbFull(game.menuBg.cur, 1);
  applyContextState(ctx);
  ctx.fillStyle = vgrad(0, H, [[0, rgba(INK, 0.62)], [0.3, rgba(INK, 0.42)], [1, rgba(INK, 0.58)]]);
  ctx.fillRect(0, 0, W, H);
}

// ---------- Hauptmenü ----------
function drawMainMenu() {
  const C = COLORS[game.menuBg.cur], ci = continueLevel(), list = menuButtons();
  text('Flatterflug', W / 2, 62, FS.title + 4, CREAM, { stroke: rgba(INK, 0.8), lw: 7 });
  text('15 Biome, 15 Bosse', W / 2, 100, FS.sm, mix(CREAM, C.accent, 0.4), { stroke: rgba(INK, 0.6), lw: 3, weight: 'normal' });
  const started = progress.open.some((o, i) => i > 0 && o) || progress.beaten.some(Boolean);
  const done = progress.beaten.filter(Boolean).length;
  text(`${done} von ${LEVELS.length} Leveln geschafft`, W / 2, 168, FS.xs, rgba(CREAM, 0.75), { weight: 'normal', stroke: rgba(INK, 0.5), lw: 3 });
  for (const b of list) {
    switch (b.id) {
      case 'play': {
        const r = progress.resume, fromCp = r && r.li === ci && checkpointAt(ci) && r.pipes === checkpointAt(ci);
        button(b, started ? `Weiter: Level ${ci + 1}, ${LEVELS[ci].name}${fromCp ? ' (Checkpoint)' : ''}` : 'Spiel starten', true, COLORS[ci]);
        break;
      }
      case 'levels': button(b, 'Levelauswahl', false, C); break;
      case 'difficulty': button(b, `Schwierigkeit: ${DIFF_LABEL[settings.difficulty]}`, false, C); break;
      case 'skins': button(b, `Skins (${SKINS.filter(s => skinUnlocked(s.id)).length} von ${SKINS.length})`, false, C); break;
      case 'editor':
        button(b, progress.completed ? 'Skin-Editor' : 'Skin-Editor (nach Level 15)', false, C, !progress.completed);
        break;
      case 'ambient': button(b, `Hintergrundpartikel: ${settings.ambient ? 'an' : 'aus'}`, false, C); break;
      case 'reset': {
        const armed = game.resetArm > 0;
        roundRectPath(b.x, b.y, b.w, b.h, 9);
        ctx.fillStyle = armed ? rgba(C.accent, 0.35) : rgba(CREAM, 0.08);
        ctx.fill();
        ctx.strokeStyle = rgba(CREAM, 0.25);
        ctx.lineWidth = 1;
        ctx.stroke();
        text(armed ? 'Nochmal: wirklich löschen' : 'Fortschritt löschen', b.x + b.w / 2, b.y + b.h / 2 + 1, FS.xxs, CREAM, { weight: armed ? 'bold' : 'normal' });
        break;
      }
    }
  }
  const hint = wrapLines('Tippen, Klick oder Leertaste: flattern. Esc oder P: Pause. M: Musik', W - 40, FS.xxs);
  hint.forEach((l, i) => text(l, W / 2, 516 + i * 14, FS.xxs, rgba(CREAM, 0.7), { weight: 'normal', stroke: rgba(INK, 0.5), lw: 3 }));
}
function drawMainMenuDynamic() {
  const C = COLORS[game.menuBg.cur], list = menuButtons(), sel = list[clamp(game.sel, 0, list.length - 1)];
  for (const b of list) {
    if (b.id === 'editor' && !progress.completed) continue;
    if (inRect(mouse, b) || b === sel) {
      roundRectPath(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 13);
      ctx.strokeStyle = inRect(mouse, b) ? rgba(CREAM, 0.7) : rgba(C.accent, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // gewählter Skin flattert neben dem Titel
  const sk = currentSkin(), ph = [1, 2, 1, 0][Math.floor(frame / 8) % 4];
  ctx.font = `bold ${FS.title + 4}px ${FONT}`;
  const tx = W / 2 + ctx.measureText('Flatterflug').width / 2 + 34;
  if (tx < W - 26) drawSkinPreview(sk, tx, 58 + Math.sin(frame * 0.06) * 4, 1.25, ph);
  else drawSkinPreview(sk, W / 2, 136 + Math.sin(frame * 0.06) * 3, 1.1, ph);
}

// ---------- Levelauswahl ----------
function drawLevelSelect() {
  const g = tileGrid();
  iconButton(UI.back(), backIcon);
  text('Levelauswahl', W / 2, 30, FS.lg - 4, CREAM, { stroke: rgba(INK, 0.8), lw: 5 });
  text('Gesperrtes Level antippen und Passwort eingeben', W / 2, 58, FS.xxs, rgba(CREAM, 0.75), { weight: 'normal', stroke: rgba(INK, 0.5), lw: 3 });
  for (let i = 0; i < LEVELS.length; i++) {
    const r = g.rect(i), sh = game.tileShake && game.tileShake.i === i ? Math.sin(game.tileShake.t * 1.3) * 6 * (game.tileShake.t / 24) : 0;
    drawTile(i, { x: r.x + sh, y: r.y, w: r.w, h: r.h });
  }
}
function drawTile(i, r) {
  const L = LEVELS[i], C = COLORS[i], open = progress.open[i], done = !!progress.beaten[i];
  roundRectPath(r.x + 2, r.y + 4, r.w, r.h, 12);
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.fill();
  ctx.save();
  roundRectPath(r.x, r.y, r.w, r.h, 12);
  ctx.clip();
  const th = getThumb(i, false);
  if (th) {
    const kt = th.width / (th.logicalW || W), lw = th.logicalW || W;
    const srcW = Math.min(lw, r.w / r.h * 230), sx = (lw - srcW) / 2;
    ctx.globalAlpha = open ? 1 : 0.45;
    ctx.drawImage(th, sx * kt, 300 * kt, srcW * kt, 230 * kt, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = vgrad(r.y, r.y + r.h, [[0, L.palette.skyTop], [0.6, L.palette.skyBottom], [1, L.palette.near]]);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.fillStyle = vgrad(r.y, r.y + r.h, [[0, rgba(INK, open ? 0.5 : 0.7)], [0.55, rgba(INK, open ? 0.2 : 0.6)], [1, rgba(INK, open ? 0.55 : 0.75)]]);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  roundRectPath(r.x, r.y, r.w, r.h, 12);
  ctx.strokeStyle = rgba(CREAM, 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();
  const small = r.w < 130;
  circle(r.x + 17, r.y + 18, 11, open ? C.accent : rgba(CREAM, 0.16));
  text(String(i + 1), r.x + 17, r.y + 19, FS.xs, open ? (luminance(C.accent) > 0.3 ? INK : CREAM) : rgba(CREAM, 0.6));
  let nameSize = small ? FS.xs : FS.sm;
  ctx.font = `bold ${nameSize}px ${FONT}`;
  if (ctx.measureText(L.name).width > r.w - 40) nameSize = FS.xxs;
  text(L.name, r.x + 33, r.y + 19, nameSize, open ? CREAM : rgba(CREAM, 0.6), { align: 'left', stroke: rgba(INK, 0.5), lw: 3 });
  // Farbvorschau: die sechs Biomfarben
  const sw = Math.min(14, (r.w - 20) / 6 - 2);
  ['skyTop', 'skyBottom', 'far', 'near', 'pipe', 'accent'].forEach((k, j) => {
    roundRectPath(r.x + 10 + j * (sw + 2), r.y + r.h - 18, sw, 9, 3);
    ctx.fillStyle = L.palette[k];
    ctx.globalAlpha = open ? 1 : 0.5;
    ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.35);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  if (r.h > 70) text(open ? `${L.pipeCount} Rohre` : 'Gesperrt', r.x + 10, r.y + r.h - 32, FS.xxs, rgba(CREAM, open ? 0.8 : 0.6), { align: 'left', weight: 'normal' });
  if (!open) {
    const lx = r.x + r.w - 16, ly = r.h > 70 ? r.y + r.h - 36 : r.y + r.h - 20;
    roundRectPath(lx - 8, ly - 2, 16, 12, 3);
    ctx.fillStyle = rgba(CREAM, 0.55);
    ctx.fill();
    ctx.strokeStyle = rgba(CREAM, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, ly - 2, 5, Math.PI, TAU);
    ctx.stroke();
  } else if (done) {
    const cx = r.x + r.w - 20, cy = r.y + 19;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy); ctx.lineTo(cx - 2, cy + 5); ctx.lineTo(cx + 7, cy - 6);
    ctx.stroke();
  }
}
function drawLevelSelectDynamic() {
  const g = tileGrid(), i = clamp(game.sel, 0, LEVELS.length - 1), r = g.rect(i), C = COLORS[i];
  roundRectPath(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 13);
  ctx.strokeStyle = progress.open[i] ? C.accent : rgba(CREAM, 0.6);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ---------- Skinauswahl ----------
function drawSkinSelect() {
  const g = skinGrid(), list = skinList();
  iconButton(UI.back(), backIcon);
  text('Skins', W / 2, 30, FS.lg - 4, CREAM, { stroke: rgba(INK, 0.8), lw: 5 });
  text('Jedes geschaffte Level schaltet einen Skin frei', W / 2, 58, FS.xxs, rgba(CREAM, 0.75), { weight: 'normal', stroke: rgba(INK, 0.5), lw: 3 });
  list.forEach((e, i) => {
    const r0 = g.rect(i), sh = game.tileShake && game.tileShake.i === i ? Math.sin(game.tileShake.t * 1.3) * 6 * (game.tileShake.t / 24) : 0;
    const r = { x: r0.x + sh, y: r0.y, w: r0.w, h: r0.h }, open = e.custom || skinUnlocked(e.id), chosen = String(settings.skin) === String(e.id);
    roundRectPath(r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = chosen ? rgba(CREAM, 0.2) : rgba(INK, open ? 0.35 : 0.55);
    ctx.fill();
    ctx.strokeStyle = chosen ? CREAM : rgba(CREAM, 0.18);
    ctx.lineWidth = chosen ? 2 : 1;
    ctx.stroke();
    const s = Math.min(r.w / 52, (r.h - 22) / 40, 1.9);
    ctx.globalAlpha = open ? 1 : 0.3;
    if (!(chosen && open)) drawSkinPreview(e.skin, r.x + r.w / 2, r.y + (r.h - 18) / 2 + 2, s, 1);
    ctx.globalAlpha = 1;
    const name = open ? e.skin.name : `Level ${skinLevel(e.id) + 1}`;
    let fsz = FS.xxs;
    ctx.font = `bold ${fsz}px ${FONT}`;
    if (ctx.measureText(name).width > r.w - 6) { fsz = 9.5; ctx.font = `bold ${fsz}px ${FONT}`; }
    let lab = name;
    while (ctx.measureText(lab).width > r.w - 6 && lab.length > 4) lab = lab.slice(0, -2) + '…';
    text(lab, r.x + r.w / 2, r.y + r.h - 11, fsz, open ? CREAM : rgba(CREAM, 0.55), { weight: open ? 'bold' : 'normal' });
    if (!open) {
      const lx = r.x + r.w / 2, ly = r.y + (r.h - 18) / 2;
      roundRectPath(lx - 8, ly - 2, 16, 12, 3);
      ctx.fillStyle = rgba(CREAM, 0.6);
      ctx.fill();
      ctx.strokeStyle = rgba(CREAM, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly - 2, 5, Math.PI, TAU);
      ctx.stroke();
    }
  });
}
function drawSkinSelectDynamic() {
  const g = skinGrid(), list = skinList(), C = COLORS[game.menuBg.cur];
  const ci = list.findIndex(e => String(e.id) === String(settings.skin));
  if (ci >= 0) {
    const r = g.rect(ci), s = Math.min(r.w / 52, (r.h - 22) / 40, 1.9);
    drawSkinPreview(list[ci].skin, r.x + r.w / 2, r.y + (r.h - 18) / 2 + 2 + Math.sin(frame * 0.07) * 2, s, [1, 2, 1, 0][Math.floor(frame / 8) % 4]);
  }
  const i = clamp(game.sel, 0, list.length - 1), r = g.rect(i);
  roundRectPath(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 13);
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ============================================================
// Hauptschleife: fester 60-FPS-Schritt mit Akkumulator, Rendern mit
// Bildschirmrate und Interpolation, damit nichts ruckelt
// ============================================================
const STEP = 1000 / 60;
let lastTime = performance.now(), accTime = 0;
const perf = { frames: 0, slow: 0, worst: 0 };
function loop(now) {
  const t0 = performance.now();
  let dt = now - lastTime;
  lastTime = now;
  if (!(dt > 0)) dt = 0;
  if (dt > 250) dt = 250;
  accTime += dt;
  let steps = 0;
  if (SIM.autotest) accTime = 0;           // der Autotest rechnet in eigenen Häppchen
  while (accTime >= STEP && steps < 8) { update(); accTime -= STEP; steps++; }
  if (steps >= 8) accTime = 0;
  render(clamp(accTime / STEP, 0, 1));
  const cost = performance.now() - t0;
  perf.frames++;
  if (cost > perf.worst) perf.worst = cost;
  if (cost > 12) perf.slow++;
  if (!SIM.autotest) runIdleWork(t0, game.paused || CALM_STATES.has(game.state));
  requestAnimationFrame(loop);
}

// Start: erst lokal laden (synchron) und starten, danach asynchron den Cloud-Stand holen und zusammenführen.
// Wird die Seite im Artefakt-Viewer aktualisiert, bringt data den Stand der alten Fassung mit (z_boot.js).
function boot(data) {
  try {
    loadProgress();
    loadSettings();
    const loaded = saveContent(currentSave());
    adoptHotData(data);
    localSave.content = saveContent(currentSave());
    // Was der Hot-Reload mitbrachte, gleich lokal sichern (kein neuer Stand, savedAt bleibt)
    if (localSave.content !== loaded) writeLocalSave(currentSave());
  } catch (e) { /* ohne Speicher weiter */ }
  resize();
  Music.setVolume(settings.volume);
  game.sel = 0;
  const ci = continueLevel();
  game.menuBg = { cur: ci, prev: ci, t: 99 };
  game.level = ci;
  bird = makeBird();
  if (isAutotest()) startAutotest();
  else Music.setTrack('menu');
  focusCanvas();
  requestAnimationFrame(loop);
  initCloudSave();
}

