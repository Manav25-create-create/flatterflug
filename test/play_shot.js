// Spielt Level LI mit dem Bot (unverwundbar) für FR Frames und rendert dann das Bild (für Screenshots).
// Aufruf: LI und FR über window.__args, z. B. node test/h.mjs 1000 600 test/play_shot.js '?x' mit gesetzten Werten unten.
const f = window.__ff, LI = window.__LI || 15, FR = window.__FR || 900;
f.run(`progress.open[${LI}] = true; startFromMenu(${LI}); beginPlay(); SIM.god = true;`);
f.run(`
  const D = AT.delay, hist = []; let lastFlap = 0, target = 270;
  for (let n = 0; n < ${FR}; n++) {
    const y = birdCY(); target = pipeTarget(target);
    hist.push({ f: n, y, vy: bird.vy, target }); if (hist.length > D + 6) hist.shift();
    const o = hist.length > D ? hist[hist.length - 1 - D] : null;
    if (o && o.f > lastFlap && o.vy >= 0 && o.y > o.target) { flapBird(); lastFlap = n; }
    update();
  }
  SIM.god = false; render(1);
`);
await new Promise(r => setTimeout(r, 50));
const g = f.get('game');
return { state: g.state, passed: g.pipesPassed, tilted: f.get('pipes').filter(p => p.tamp).map(p => +p.ang.toFixed(3)), windSpeed: +f.get('wind').speed.toFixed(2) };
