// Start ganz am Ende, damit alle Konstanten (auch die des Autotests) bereits initialisiert sind.
const hot = window.claude && window.claude.hot;
// Hot-Reload: ganzer Stand v4 samt Levelnamen; die neue Fassung führt ihn in boot() mit ihrem zusammen
try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => hotSnapshot()); } catch (e) { /* ohne Übernahme */ }
if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot((hot && hot.data) || {});

