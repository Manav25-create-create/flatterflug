// Speicher-Tests im echten Browser: Übernahme v4, Sicherung, nie kleiner werden, unbekannte Level, Zurücksetzen.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
import path from 'path';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
const url = 'file://' + path.resolve('out/test.html');
const errs = []; page.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const check = (name, ok, info) => { if (ok) pass++; else { fail++; console.log('FEHLER:', name, info === undefined ? '' : JSON.stringify(info)); } };
const load = async () => { await page.goto(url); await page.waitForFunction(() => window.__ff); await page.waitForTimeout(150); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const KEY = 'flatterflug-spielstand', BAK = 'flatterflug-spielstand-sicherung', V4 = 'flatterflug-15-biome-v4';
const v4rec = { v: 4, progress: { open: Array(15).fill(false).map((_, i) => i < 9), beaten: Array(15).fill(false).map((_, i) => i < 8),
  completed: false, best: null, customSkins: [], resume: null, savedAt: 5 }, settings: { skin: 0, ambient: false, volume: 0.6, difficulty: 'schwer' } };

// 1. Übernahme aus v4
await load();
await ev(([v4, V4]) => { localStorage.clear(); localStorage.setItem(V4, JSON.stringify(v4)); }, [v4rec, V4]);
await load();
let r = await ev(() => { const f = window.__ff, L = f.get('LEVELS'), p = f.get('progress'); return { beaten: L.filter((_, i) => p.beaten[i]).map(l => l.name), diff: f.get('settings').difficulty }; });
check('v4 geschaffte Level per Name', r.beaten.join() === 'Wiese,Wolken,Ozean,Eis,Dschungel,Wüste,Sumpf,Kristall', r);
check('v4 Einstellungen', r.diff === 'schwer', r);
await ev(() => window.__ff.run("settings.ambient = true; saveSettings();"));
r = await ev(([K, V4]) => ({ main: JSON.parse(localStorage.getItem(K)), v4: localStorage.getItem(V4) }), [KEY, V4]);
check('Hauptstand geschrieben, legacy markiert', r.main && r.main.v === 5 && r.main.legacy === true && r.main.names.length === 20, r.main && { v: r.main.v, legacy: r.main.legacy });
check('v4-Schlüssel bleibt', !!r.v4);

// 2. Nie kleiner: Fortschritt im Speicher künstlich verlieren, dann speichern
await ev(() => window.__ff.run("const i = levelIndexOf('Kristall'); progress.beaten[i] = false; settings.volume = 0.3; saveSettings();"));
r = await ev(([K]) => { const f = window.__ff, m = JSON.parse(localStorage.getItem(K)), i = m.names.indexOf('Kristall'); return { stored: m.progress.beaten[i], mem: f.get('progress').beaten[f.get('levelIndexOf')('Kristall')], vol: m.settings.volume }; }, [KEY]);
check('Gespeicherter Fortschritt bleibt erhalten', r.stored === true && r.mem === true, r);
check('Einstellung trotzdem gespeichert', r.vol === 0.3, r);

// 3. Neu laden: v4 wird nicht erneut eingemischt, Stand stimmt
await load();
r = await ev(() => { const f = window.__ff, p = f.get('progress'); return p.beaten.filter(Boolean).length; });
check('Nach Neuladen 8 geschafft', r === 8, r);

// 4. Unbekanntes Level und unbekanntes Feld (neuere Fassung) bleiben erhalten
await ev(([K]) => { const m = JSON.parse(localStorage.getItem(K)); m.names.push('Zukunftsland'); for (const k of ['open', 'beaten', 'bot']) m.progress[k].push(k !== 'bot'); m.zukunft = { x: 1 }; m.progress.sterne = [3, 2]; localStorage.setItem(K, JSON.stringify(m)); }, [KEY]);
await load();
await ev(() => window.__ff.run("settings.ambient = !settings.ambient; saveSettings();"));
r = await ev(([K]) => { const m = JSON.parse(localStorage.getItem(K)), i = m.names.indexOf('Zukunftsland'); return { i, beaten: i >= 0 && m.progress.beaten[i], z: m.zukunft, s: m.progress.sterne }; }, [KEY]);
check('Unbekanntes Level bleibt', r.i >= 0 && r.beaten === true, r);
check('Unbekannte Felder bleiben', r.z && r.z.x === 1 && Array.isArray(r.s), r);

// 5. Sicherung: Hauptstand beschädigt
await ev(([K, B]) => { localStorage.setItem(B, localStorage.getItem(K)); localStorage.setItem(K, '{kaputt'); }, [KEY, BAK]);
await load();
r = await ev(() => window.__ff.get('progress').beaten.filter(Boolean).length);
check('Sicherung wird gelesen', r === 8, r);

// 6. Zurücksetzen darf verkleinern, v4 kommt nicht wieder
await ev(() => window.__ff.run("resetProgress();"));
await load();
r = await ev(() => window.__ff.get('progress').beaten.filter(Boolean).length);
check('Zurücksetzen bleibt nach Neuladen', r === 0, r);

// 7. Umsortierung simulieren: Arrays in anderer Reihenfolge der Namen
await ev(([K]) => { const m = JSON.parse(localStorage.getItem(K)); m.names.reverse(); for (const k of ['open', 'beaten', 'bot']) m.progress[k].reverse();
  const i = m.names.indexOf('Lava'); m.progress.beaten[i] = true; m.legacy = true; localStorage.setItem(K, JSON.stringify(m)); }, [KEY]);
await load();
r = await ev(() => { const f = window.__ff; return f.get('progress').beaten[f.get('levelIndexOf')('Lava')]; });
check('Zuordnung über Namen bei anderer Reihenfolge', r === true, r);

check('Keine Seitenfehler', errs.length === 0, errs);
console.log(`${pass} bestanden, ${fail} fehlgeschlagen`);
await browser.close();
