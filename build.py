# Baut das Spiel aus den Bausteinen in src/ zusammen.
#   index.html          eigenständige Datei (GitHub Pages)
#   out/artifact.html   Fragment ohne eigenes Gerüst (Claude-Artefakt)
#   out/test.html       Testfassung mit window.__ff für automatische Prüfungen
import os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
PARTS = ['a_config.js', 'a_core.js', 'b_tex.js', 'b_layers.js', 'b_ground.js', 'b_sprites.js', 'b_scene.js',
         'b_art2.js', 'b_art3_bosses.js', 'b_art5_scene_a.js', 'b_art6_scene_b.js', 'b_art7_scene_c.js',
         'b_art8_bloom.js', 'b_art9_autumn.js', 'b_art10_shadow.js',
         'c_world.js', 'c3_hazards.js', 'c2_boss.js', 'c4_abilities.js', 'c5_skins.js', 'd_music.js',
         'e_game.js', 'f_autotest.js', 'z_boot.js']
rd = lambda n: open(os.path.join(SRC, n), encoding='utf-8').read()
head, tail = rd('_head.html'), rd('_tail.html')
body = ''.join(rd(p) for p in PARTS if os.path.exists(os.path.join(SRC, p)))
# Versionsstempel: Kennung aus dem Inhalt (gleicher Code = gleiche Kennung), Datum nur zur Anzeige.
# version.json liegt neben index.html; das Spiel vergleicht beim Start online damit (siehe checkForUpdate).
import hashlib, json, datetime
try:
    from zoneinfo import ZoneInfo
    now = datetime.datetime.now(ZoneInfo('Europe/Berlin'))
except Exception:
    now = datetime.datetime.now()
BUILD_ID = hashlib.sha1(body.encode('utf-8')).hexdigest()[:8]
BUILD_DATE = now.strftime('%d.%m.%Y')
body = "const BUILD = { id: '%s', date: '%s' };\n" % (BUILD_ID, BUILD_DATE) + body
open(os.path.join(ROOT, 'version.json'), 'w', encoding='utf-8').write(json.dumps({'build': BUILD_ID, 'date': BUILD_DATE}) + '\n')
EXPOSE = rd('_expose.js') if os.path.exists(os.path.join(SRC, '_expose.js')) else ''
standalone = head + body + tail
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(standalone)
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
# Fragment: Inhalt zwischen <head> und </body> ohne Doctype, html, head, body und meta
m_title = re.search(r'<title>.*?</title>', head, re.S).group(0)
m_style = re.search(r'<style>.*?</style>', head, re.S).group(0)
m_body = head.split('<body>\n', 1)[1]
tail_frag = tail.split('</body>', 1)[0]
open(os.path.join(ROOT, 'out', 'artifact.html'), 'w', encoding='utf-8').write(m_title + '\n' + m_style + '\n' + m_body + body + tail_frag)
open(os.path.join(ROOT, 'out', 'test.html'), 'w', encoding='utf-8').write(head + body + EXPOSE + tail)
print('ok', len(standalone), BUILD_ID, BUILD_DATE)
