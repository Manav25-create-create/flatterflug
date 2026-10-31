// Bildzeit messen: Level LI mit Bot spielen, jedes Update rendern. Ergebnis: Mittel und 95-%-Wert in ms.
const f = window.__ff, LI = window.__LI === undefined ? 15 : window.__LI;
f.run(`progress.open[${LI}] = true; startFromMenu(${LI}); beginPlay(); SIM.god = true;`);
const times = [];
f.run(`window.__step = (() => { const D = AT.delay, hist = []; let lastFlap = 0, target = 270, n = 0;
  return () => { const y = birdCY(); target = pipeTarget(target); hist.push({ f: n, y, vy: bird.vy, target }); if (hist.length > D + 6) hist.shift();
    const o = hist.length > D ? hist[hist.length - 1 - D] : null; if (o && o.f > lastFlap && o.vy >= 0 && o.y > o.target) { flapBird(); lastFlap = n; } update(); n++; }; })();`);
const cv = document.getElementById('game'), cx2 = cv.getContext('2d');
for (let i = 0; i < 400; i++) { window.__step(); const t0 = performance.now(); f.get('render')(1); cx2.getImageData(0, 0, 1, 1); if (i > 20) times.push(performance.now() - t0); }
times.sort((a, b) => a - b);
return { W: f.get('W'), k: +f.get('view').k.toFixed(2), avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), max: +times[times.length - 1].toFixed(2) };
