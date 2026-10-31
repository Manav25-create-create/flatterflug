# Flatterflug (Projekt „Jumping Bird“): Arbeitsnotizen

Live: https://manav25-create-create.github.io/flatterflug/ (GitHub Pages aus `main`, Datei `index.html`).

## Aufbau
- `src/` enthält die Bausteine, `build.py` verkettet sie unverändert zu einer Datei:
  - `index.html`: eigenständig, für GitHub Pages.
  - `out/artifact.html`: Fragment für ein Claude-Artefakt.
  - `out/test.html`: Testfassung mit `window.__ff` (get/set/run im Spielkontext).
- Reihenfolge der Bausteine steht in `build.py` (PARTS). `z_boot.js` muss zuletzt kommen (Boot nach allen Konstanten).
- Nur Canvas 2D und Vanilla JS. Keine Bilder, Audiodateien, Bibliotheken, CDNs oder Webfonts. Läuft offline.

## Wichtige Stellen
- `a_config.js`: CONFIG, PATTERNS (Boss-Angriffe), LEVELS (20 Biome), MECH_PLAN (Hindernisse je Level), BOSS_LIVES.
  - Hindernisse: ab Level 4 auf und ab, ab 8 Wind (Rückenwind schneller, Gegenwind langsamer), ab 12 seitlich,
    ab 16 kippend, ab 20 Dunkelheit. Im Einführungslevel allein, danach kombiniert.
  - Rohre: 10 + 2·(n−1), Level 20: 50. Boss-Leben: Level 1 = 1, +1 in jedem Level ohne neues Hindernis.
  - Level 20 ist der Ansturm der 19 Bosse (je 2 Treffer), Checkpoints nach Boss 7 und 13 (nicht auf Schwer).
- `c_world.js`: Vogel und Rohre. Alle Rohre eines Versuchs stehen im Layout (`makeLayout`, Seed).
  `resumeWorldAt(j)` setzt nach dem Checkpoint fort: Rohre dahinter wie zuvor, vor Rohr j zusätzlicher Anlauf.
  Gekippte Paare: Kollision per SAT (`obbHitsBox`), Zeichnen mit Drehung um die Lückenmitte.
- `c3_hazards.js`: Wind (`updateWind`, Tempo über `wind.speed`), Dunkelheit (`drawDarkness`).
- `c4_abilities.js`: gute Kugeln (Zeitlupe bremst nur die Welt) und schlechte Kugeln (Tempo, Riesenvogel, Bleiflügel).
- `c2_boss.js`: Bosse, Rückpraller, Muster. `f_autotest.js`: Bot und Autotest (`?autotest=1` oder Passwort TEST).
- `e_game.js`: Zustand, Speichern (v5, Arrays mit Levelnamen; v4 wird per Name übernommen), Ablauf, Bot-Spule
  (`enterScrub`, `recordGhost`), Menüs, HUD, Bildformat (`applyFormat`, `VIEWFMT` in a_core.js).
- Grafik neuer Biome: `b_art8_bloom.js` (Blütenhain, Lagune), `b_art9_autumn.js` (Herbstwald, Ruinen),
  `b_art10_shadow.js` (Schattenreich). Muster dafür: `b_art2.js`, Kulissen-API in `b_scene.js`.

## Speicher
- Schlüssel `flatterflug-20-biome-v5`. Nie ändern ohne Übernahme des alten Stands.
- Auf derselben Domain laufen andere Projekte: nur Schlüssel mit Präfix `flatterflug` verwenden.

## Testen
- `python3 build.py` und dann `node test/h.mjs <breite> <höhe> <datei.js>` (Funktionskörper, Rückgabe als JSON).
- Bot: `window.__ff.get('runAutotestSync')({ runs, levels, phases: 'pipe' | 'boss' })`.
- Rohrlücken kalibrieren: `node test/h.mjs 800 600 test/calib.js` (Ziel 92 − 1,8·Index Prozent).
- Vorschau eines Bioms: `node test/preview.mjs <Biom> <Breite> [x1,x2] [pipes] [boss]`.
- Spielszene als Bild: `test/play_shot.js` (Bot unverwundbar, danach Screenshot über `SHOT=datei.png`).
- Botwerte sind kein Beweis für menschliche Schwierigkeit.
