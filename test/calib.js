// Kalibriert pipeGap pro Level, bis der Bot in der Rohrphase etwa das Ziel 92 - 1,8 * Index Prozent schafft.
const f = window.__ff, L = f.get('LEVELS'), runs = window.__RUNS || 250, out = [];
const levels = window.__LEVELS || L.map((_, i) => i);
for (const li of levels) {
  const target = 92 - 1.8 * li;
  let gap = L[li].pipeGap, best = null;
  for (let it = 0; it < 8; it++) {
    L[li].pipeGap = Math.round(gap);
    const r = f.get('runAutotestSync')({ runs, levels: [li], phases: 'pipe' }).rows[0];
    const p = r.pipe;
    if (!best || Math.abs(p - target) < Math.abs(best.p - target)) best = { gap: Math.round(gap), p };
    if (Math.abs(p - target) <= 3) break;
    gap = clamp(gap + (target - p) * 0.22, 150, 215);
  }
  L[li].pipeGap = best.gap;
  out.push([L[li].name, best.gap, best.p, Math.round(target)]);
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
return out.map(r => r.join(' ')).join('\n');
