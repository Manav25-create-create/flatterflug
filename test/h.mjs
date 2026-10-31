// Testharness: lädt out/test.html in Chromium (Playwright) und führt Code im Spielkontext aus.
// node test/h.mjs <breite> <höhe> <datei-mit-js-ausdruck> [query]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
import fs from 'fs'; import path from 'path';
const [w, h, file, query] = process.argv.slice(2);
const code = fs.readFileSync(file, 'utf8');
const url = 'file://' + path.resolve('out/test.html') + (query || '');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ff, null, { timeout: 20000 });
await page.waitForTimeout(400);
let out;
try { out = await page.evaluate(new Function('return (async () => {' + code + '})()')); }
catch (e) { out = 'EVAL ERROR: ' + e.message; }
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close();
