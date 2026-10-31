// ============================================================
// Musik und Geräusche: vollständig prozedural mit Web Audio, ohne Dateien.
// Sequenzer mit vier Stimmen: Bass, Melodie, Flächenklang und Perkussion
// aus kurzen Rauschstößen. Pro Stück ein Tiefpass (Filterfrequenz des
// Bioms) und ein Echo (Rückkopplung des Bioms), dazu ein gemeinsamer Hall,
// Kompressor und ein weicher Begrenzer gegen Übersteuern.
// Jedes Biom liefert Tonleiter, Grundton, Tempo, Wellenformen, Filter und
// Echo (LEVELS[i].music). Daraus entsteht deterministisch ein Stück aus
// 16 Takten, das nahtlos wiederholt wird. Bossmusik: gleiche Tonleiter,
// Tempo plus 20, zusätzlich ein verstimmter Sägezahnbass. Wechsel zwischen
// Stücken werden über 60 Frames (1 s) übergeblendet.
// Der AudioContext entsteht erst bei der ersten Nutzereingabe (unlock).
// ============================================================

// ---------- Komposition: reine Rechnung, ohne Audio ----------
const MusicGen = (() => {
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmMinor: [0, 2, 3, 5, 7, 8, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], phrygDom: [0, 1, 4, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    majorPent: [0, 2, 4, 7, 9], minorPent: [0, 3, 5, 7, 10], wholeTone: [0, 2, 4, 6, 8, 10]
  };
  const BARS = 16, STEPS = BARS * 16;
  const mod = (a, n) => ((a % n) + n) % n;
  const or = (a, b) => (a === undefined || a === null ? b : a);
  const hzOf = m => 440 * Math.pow(2, (m - 69) / 12);
  const onsets = pat => { const o = []; for (let i = 0; i < pat.length; i++) if (pat[i] !== '.') o.push(i); return o; };

  // Tonart: Stufe d (ganze Zahl, auch negativ) auf MIDI abbilden, für Tonleitern mit 5, 6 oder 7 Tönen
  function keyOf(scale, root) {
    const sc = SCALES[scale] || SCALES.major, n = sc.length, set = new Set(sc);
    const midi = d => root + 12 * Math.floor(d / n) + sc[mod(d, n)];
    const near = m => {                                   // Stufe mit dem nächstgelegenen Ton
      let d = n * Math.floor((m - root) / 12);
      while (midi(d + 1) <= m) d++;
      return m - midi(d) <= midi(d + 1) - m ? d : d + 1;
    };
    return { scale, sc, n, root, set, midi, near, pc: m => mod(m - root, 12) };
  }

  // Akkord auf Stufe d nur aus Tönen der Tonleiter: Terz (fehlt sie, Quarte oder Sekunde),
  // Quinte (sonst übermäßig oder vermindert), als Erweiterung Septime und None.
  // Pentatonik ergibt so offene sus-Klänge, die Ganztonleiter übermäßige Akkorde.
  function chordOf(K, d) {
    const r = K.sc[mod(d, K.n)], has = s => K.set.has(mod(r + s, 12));
    const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : has(2) ? 2 : 0;
    const fifth = has(7) ? 7 : has(8) ? 8 : has(6) ? 6 : 0;
    const tones = [0];
    if (third) tones.push(third);
    if (fifth) tones.push(fifth);
    const ext = [];
    if (has(10)) ext.push(10); else if (has(11)) ext.push(11);
    if (third !== 2 && has(2)) ext.push(14);
    return { d, r, third, fifth, tones, ext, pcs: new Set(tones.map(s => mod(r + s, 12))) };
  }

  // Lage eines Flächenakkords: alle Töne im Fenster, möglichst wenig Bewegung zum Vorgänger
  function voicing(K, ch, prev, P) {
    const span = P.span + 3 * Math.max(0, P.ext - 1), lo = P.center - (span >> 1), hi = lo + span, base = K.root + ch.r;
    if (P.power && ch.fifth === 7) {                     // Quintklang mit Oktave
      let r = lo + mod(base - lo, 12);
      if (prev && Math.abs(r - 12 - prev[0]) < Math.abs(r - prev[0]) && r - 12 >= lo - 4) r -= 12;
      return [r, r + 7, r + 12];
    }
    // beste Lage für die Intervalle ints; rau = enthält Halbton oder kleine None
    const search = ints => {
      const opts = ints.map(x => { const o = []; for (let m = lo; m <= hi; m++) if (mod(m - base - x, 12) === 0) o.push(m); return o; });
      let best = null, bestS = Infinity;
      const pick = [];
      const rec = i => {
        if (i === opts.length) {
          const v = pick.slice().sort((a, b) => a - b);
          let s = 0;
          for (let k = 1; k < v.length; k++) {
            const iv = v[k] - v[k - 1];
            if (iv === 0) s += 50; else if (iv < 2) s += 40; else if (iv < 3 && v[k - 1] < 58) s += 6;
          }
          for (let k = 0; k < v.length; k++) for (let j = k + 1; j < v.length; j++) if (v[j] - v[k] === 13) s += 20;   // kleine None
          const mean = v.reduce((a, b) => a + b, 0) / v.length;
          s += Math.abs(mean - P.center) * 0.35;
          if (prev) for (let k = 0; k < Math.min(v.length, prev.length); k++) s += Math.abs(v[k] - prev[k]) * 0.7;
          if (s < bestS) { bestS = s; best = v; }
          return;
        }
        for (const m of opts[i]) { pick.push(m); rec(i + 1); pick.pop(); }
      };
      rec(0);
      const rough = !!best && best.some((m, k) => best.some(q => q - m === 1 || q - m === 13));
      return { best, rough };
    };
    let r = search(ch.tones.concat(ch.ext.slice(0, P.ext)));
    if (r.rough && P.ext) r = search(ch.tones);            // Erweiterung nur, wenn sie sich ohne Reibung setzen lässt
    return r.best || [base];
  }

  // Melodierhythmen: zwei Takte zu je 16 Sechzehnteln
  const RH = {
    mid: ['x...x.x.x...x...x.x.x...x.......', 'x.....x.x...x.x.x.......x...x...', 'x...x...x.x.x...x.x...x.x.......',
      'x..x..x.x...x...x..x..x.x.......', '..x.x.x.x...x.....x.x.x.x.......', 'x.x.x...x...x.x.x...x...x.......'],
    slow: ['x.......x...x...x...............', 'x...........x...x.......x.......', 'x.......x.......x...x...x.......',
      'x.....x.........x.......x.......', 'x.....x.x.......x...x...........'],
    fast: ['x.x.x.x.x...x.x.x.x.x.x.x.......', 'x..x..x.x.x.x...x..x..x.x...x...', 'x.x...x.x.x...x.x.x.x...x...x...',
      'x...x.x.x.x.x.x.x...x.x.x.......'],
    sparse: ['x.......x.......................', 'x...............x.......x.......', 'x.......................x.......',
      '....x.......x...x...............'],
    clock: ['x.x.x.x.x...x...x.x.x.x.x.......', 'x.x.x...x.x.x...x.x.x...x.x.x...', 'x...x.x.x...x.x.x...x.x.x.......'],
    cad: ['x.x.x...x.x.x...x...............', 'x...x.x.x.......x...............', 'x.....x.x...x...x...............',
      'x.......x...x...x...............']
  };
  // Arpeggien (Index in die Leiter der Akkordtöne, -1 = Pause)
  const ARP = {
    a: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
    b: [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 2, 1, 3, 5, 3],
    t: [5, 4, 3, 2, 4, 3, 2, 1, 3, 2, 1, 0, 2, 1, 0, -1]
  };
  // Schlagzeug, nur Rauschstöße. x = betont, o = leise. main: Takte 1 bis 8 und 13 bis 16,
  // thin: ausgedünnter Mittelteil (Takte 9 bis 12), fill: zweite Hälfte von Takt 8 und 16
  const KITS = {
    light: {
      main: { kick: 'x.......x.......', rim: '....o.......o...', shaker: 'o.x.o.x.o.x.o.x.' },
      thin: { kick: 'x...............', shaker: 'o...o...o...o...' },
      fill: { rim: '........o.o.o.oo' },
      boss: { kick: 'x...x...x...x...', snare: '....x.......x...', shaker: 'oxoxoxoxoxoxoxox' },
      bfill: { snare: '........x.x.xxxx' }
    },
    sparse: {
      main: { kick: 'x...............', hat: '....o.......o...' },
      thin: { hat: '....o...........' },
      boss: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.' },
      bfill: { snare: '............x.xx' }
    },
    rock: {
      main: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
      thin: { kick: 'x.......x.......', snare: '........x.......', hat: 'x...x...x...x...' },
      fill: { snare: '........x.x.xxxx', tom: '........o..o..o.' },
      boss: { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo' },
      bfill: { snare: '........xxxxxxxx' },
      crash: true
    },
    tribal: {
      main: { tom: 'x.....x...x.....', woodH: '..x..x......x..x', woodL: '........x.....x.', shaker: 'o.o.o.o.o.o.o.o.' },
      thin: { woodH: '..x..x......x..x', shaker: 'o.o.o.o.o.o.o.o.' },
      fill: { tom: '........x.x.x.xx' },
      boss: { kick: 'x...x...x...x...', tom: 'x..x..x...x..x..', woodH: '..x...x...x...x.', shaker: 'oooooooooooooooo' },
      bfill: { tom: '........xxx.xxxx' }
    },
    frame: {
      main: { doum: 'x.......x.......', tek: '..x.o.x.o...x.o.' },
      thin: { doum: 'x...............', tek: '..o...o.....o...' },
      fill: { tek: '........x.x.xxxx' },
      boss: { doum: 'x.....x.x.......', tek: '..x.x...x.x.x.xo' },
      bfill: { doum: '........x..x..x.', tek: '........xxx.xxxx' }
    },
    surf: {
      main: {}, special: 'surf',
      boss: { kick: 'x.......x.......', snare: '....o.......o...', shaker: 'o.o.o.o.o.o.o.o.' }
    },
    storm: {
      main: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
      thin: { kick: 'x.......x.......', hat: 'x...x...x...x...' },
      fill: { snare: '............xxxx' },
      boss: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo' },
      bfill: { snare: '........x.x.xxxx' },
      special: 'thunder'
    },
    drip: {
      main: {}, special: 'drip',
      boss: { kick: 'x.......x.......', snareM: '........x.......', hat: 'o...o...o...o...' }
    },
    swamp: {
      main: { kick: 'x.........x.....', snareM: '........x.......', shaker: 'o..o..o.o..o..o.' },
      thin: { kick: 'x...............', shaker: '...o.......o....' },
      fill: { snareM: '............o.oo' },
      boss: { kick: 'x.....x...x.....', snareM: '....x.......x...', shaker: 'o.o.o.o.o.o.o.o.' },
      bfill: { snareM: '........x..x.xxx' }
    },
    synth: {
      main: { kick: 'x...x...x...x...', clap: '....x.......x...', ohat: '..x...x...x...x.' },
      thin: { kick: 'x.......x.......', ohat: '..x...x...x...x.' },
      fill: { clap: '............x.xx' },
      boss: { kick: 'x...x...x...x...', clap: '....x.......x...', ohat: '..x...x...x...x.', hat: 'o.oo.oo.o.oo.oo.' },
      bfill: { clap: '........x.x.xxxx' }
    },
    brush: {
      main: { kick: 'x.......x.......', brush: 'o...x...o...x...' },
      thin: { brush: 'o...x...o...x...' },
      fill: { brush: '........o.o.x.o.' },
      boss: { kick: 'x...x...x...x...', snare: '....x.......x...', brush: 'oooooooooooooooo' },
      bfill: { snare: '............x.xx' }
    },
    clock: {
      main: { tick: 'x...x...x...x...', tock: '.ooo.ooo.ooo.ooo', kick: 'x.......x.......', snare: '....o.......o...' },
      thin: { tick: 'x...x...x...x...', tock: '.ooo.ooo.ooo.ooo' },
      fill: { snare: '........o.o.oxox' },
      boss: { tick: 'x...x...x...x...', tock: '.ooo.ooo.ooo.ooo', kick: 'x...x...x...x...', snare: '....x.......x...' },
      bfill: { snare: '........x.x.xxxx' }
    },
    heavy: {
      main: { kick: 'x.......x..x....', snare: '........x.......', ride: 'x...x...x...x...' },
      thin: { kick: 'x...............', ride: 'x...x...x...x...' },
      fill: { tom: '........x..x.xxx' },
      boss: { kick: 'x..x..x.x..x....', snare: '....x.......x...', ride: 'x.x.x.x.x.x.x.x.' },
      bfill: { tom: '........xx.xx.xx' }
    },
    space: {
      main: { kick: 'x...............', hat: 'o.....o.....o...' },
      thin: { hat: 'o.....o.........' },
      boss: { kick: 'x.......x.......', snare: '....o.......o...', hat: 'o.o.o.o.o.o.o.o.' },
      special: 'swell'
    },
    pop: {
      main: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.' },
      thin: { kick: 'x.......x.......', hat: 'o.o.o.o.o.o.o.o.' },
      fill: { snare: '........x.x.xxxx' },
      crash: true
    }
  };

  // Grundeinstellungen der Stimmen, pro Stück überschrieben
  const D_LEAD = { inst: 'pluck', center: 74, pool: 'mid', art: 0.9, maxLen: 8, gain: 1, decay: 0.3, att: 0.005, sus: 0.8, rel: 0.12,
    vib: 0, glide: 0, bend: 0, grace: 0, plan: [1, 1, 1, 1, 1, 1, 1, 1], partials: null, pan: 0, lp: 0, lpQ: 0, lfo: 0, drive: 0 };
  const D_PAD = { mode: 'sustain', center: 62, span: 17, ext: 0, att: 0.5, rel: 0.9, sus: 1, dec: 0.5, gain: 1, det: 6, lp: 4000,
    art: 0.97, pat: 'x...............', idx: [0, 1, 2], power: false, maxBars: 2, trem: 0, pump: false, lfo: 0, drive: 0 };
  const D_BASS = { pat: 'r.......5.......', patChange: null, pat2: null, lo: 36, art: 0.85, gain: 1, lp: 900, glide: 0, lag: 0, att: 0.006, sus: 0.85 };
  const D_SEND = { dly: 0.15, dlyPerc: 0, rev: 1, revPad: 1, revPerc: 0.35 };

  // Pro Biom (Reihenfolge wie BIOME_NAMES): Akkordfolge über 16 Takte und Boss-Riff über 4 Takte, beides als
  // Stufen der Biom-Tonleiter; Spielweise, Lage und Pegel der Stimmen; Schlagzeug; Sende-Anteile
  // für Echo und Hall; trim gleicht die Lautheit an (in dB). Tonleiter, Tempo und Wellenformen
  // kommen unverändert aus LEVELS[i].music. tune enthält die erlaubte Feinabstimmung.
  const BIOME_NAMES = ['Wiese', 'Eis', 'Lava', 'Dschungel', 'Wüste', 'Ozean', 'Sturm', 'Höhle', 'Sumpf', 'Neon', 'Kristall', 'Wolken', 'Uhrwerk', 'Asche', 'Weltraum'];
  const BIOME = [
    { // 0 Wiese: Dur-Pentatonik, hell und federnd
      harm: [0, 4, 1, 3, 0, 4, 3, 0, 4, 2, 1, 3, 0, 4, 1, 3], riff: [4, 3, 0, 1],
      lead: { inst: 'pluck', center: 76, decay: 0.3 },
      pad: { mode: 'strum', pat: 'x.....x...x.....', att: 0.006, sus: 0.35, dec: 0.25, rel: 0.12, lp: 2600, center: 64, gain: 0.9, art: 0.9 },
      bass: { pat: 'r.....5.r...5.a.', lo: 36 },
      kit: 'light', send: { dly: 0.16, rev: 0.8 }
    },
    { // 1 Eis: Dur, Glocken aus Sinustönen, viel Echo
      harm: [0, 3, 5, 4, 0, 3, 1, 4, 5, 3, 0, 4, 5, 2, 3, 4], riff: [5, 3, 0, 4],
      lead: { inst: 'bell', center: 74, pool: 'slow', decay: 0.55, maxLen: 16, partials: [[1, 1, 1], [2.76, 0.3, 0.4], [5.4, 0.12, 0.18]] },
      pad: { att: 0.8, rel: 1.4, ext: 1, center: 64, gain: 0.8 },
      bass: { pat: 'r.......5.......', lo: 40 },
      kit: 'sparse', send: { dly: 0.42, dlyPerc: 0.35, rev: 1 }
    },
    { // 2 Lava: Moll-Pentatonik, verzerrter Sägezahn
      harm: [0, 0, 1, 2, 0, 0, 4, 2, 1, 1, 2, 2, 0, 1, 2, 4], riff: [0, 1, 2, 4],
      lead: { inst: 'dist', center: 71, art: 0.95, bend: 0.35, drive: 5, lp: 2300 },
      pad: { mode: 'pulse', pat: 'x.x.x.x.x.x.x.x.', art: 0.5, att: 0.004, sus: 0.6, dec: 0.1, rel: 0.05, power: true, lp: 1100, center: 56, gain: 0.9, drive: 3 },
      bass: { pat: 'r.r.r.r.r.r.o.r.', lo: 33, lp: 800, art: 0.7 },
      kit: 'rock', send: { dly: 0.12, rev: 0.7 }
    },
    { // 3 Dschungel: dorisch, perkussiv, Holzklang
      harm: [0, 3, 0, 3, 0, 3, 6, 6, 2, 6, 3, 3, 0, 3, 4, 4], riff: [0, 6, 3, 4],
      lead: { inst: 'mallet', center: 72, decay: 0.16, art: 1 },
      pad: { mode: 'broken', pat: 'x..x..x.x..x..x.', idx: [0, 2, 1, 0, 2, 1], art: 0.9, att: 0.004, sus: 0.2, dec: 0.12, rel: 0.08, center: 62, gain: 1, lp: 2400 },
      bass: { pat: 'r..r..5...r.5...', lo: 36, art: 0.7 },
      kit: 'tribal', send: { dly: 0.12, rev: 0.8 }
    },
    { // 4 Wüste: phrygisch-dominant, enger Filter, gezupft wie eine Oud
      harm: [0, 0, 1, 0, 0, 0, 1, 1, 3, 3, 6, 6, 3, 6, 1, 1], riff: [0, 1, 6, 1],
      lead: { inst: 'oud', center: 69, decay: 0.3, grace: 0.3 },
      pad: { att: 1, rel: 1.2, power: true, lp: 900, center: 52, gain: 0.7 },
      bass: { pat: 'r..r....5..r....', lo: 36 },
      kit: 'frame', hp: 200, send: { dly: 0.2, rev: 0.9 }
    },
    { // 5 Ozean: lydisch, langsam, lange Hallfahnen, Brandung aus Rauschen
      harm: [0, 0, 1, 1, 0, 0, 1, 1, 5, 5, 6, 6, 2, 2, 1, 1], riff: [5, 1, 0, 1],
      lead: { inst: 'soft', center: 72, pool: 'slow', att: 0.09, sus: 0.85, rel: 0.5, maxLen: 16, art: 1, vib: 9, glide: 0.35 },
      pad: { att: 1.4, rel: 2.4, ext: 2, center: 62, gain: 0.9 },
      bass: { pat: 'r...............', lo: 40, art: 0.95 },
      kit: 'surf', send: { dly: 0.28, rev: 1.25, revPad: 1.3 }
    },
    { // 6 Sturm: phrygisch, schnell, Donner aus tiefem Rauschen
      harm: [0, 0, 1, 1, 0, 0, 6, 1, 5, 5, 6, 6, 3, 3, 1, 1], riff: [0, 1, 5, 1],
      lead: { inst: 'square', center: 74, pool: 'fast', art: 0.6, maxLen: 6, sus: 0.55, lp: 2600 },
      pad: { att: 0.25, rel: 0.6, lp: 1300, center: 60, gain: 0.8, trem: 0.3 },
      bass: { pat: 'r.r.r.r.r.r.r.rr', lo: 33, lp: 800, art: 0.75 },
      kit: 'storm', send: { dly: 0.14, rev: 0.8 }
    },
    { // 7 Höhle: natürliches Moll, sehr sparsam, tiefer Filter, Tropfen
      harm: [0, 0, 5, 5, 3, 3, 0, 0, 5, 5, 6, 6, 3, 3, 4, 4], riff: [0, 5, 3, 4],
      lead: { inst: 'soft', center: 67, pool: 'slow', att: 0.06, sus: 0.8, rel: 0.6, maxLen: 16, art: 1, vib: 6, glide: 0.25, plan: [1, 0, 1, 0, 1, 0, 1, 1] },
      pad: { att: 2, rel: 2.5, power: true, center: 52, gain: 0.7 },
      bass: { pat: 'r...............', pat2: '................', lo: 36, art: 1 },
      kit: 'drip', send: { dly: 0.4, dlyPerc: 0.5, rev: 1.1, revPerc: 1.2 }
    },
    { // 8 Sumpf: Moll-Pentatonik, träge Bassläufe mit Gleiten
      harm: [0, 0, 2, 2, 0, 0, 1, 4, 2, 2, 0, 0, 1, 4, 2, 2], riff: [0, 2, 0, 4],
      lead: { inst: 'soft', center: 69, pool: 'slow', att: 0.05, sus: 0.8, rel: 0.25, art: 0.95, glide: 0.5, vib: 7 },
      pad: { att: 0.9, rel: 1.3, center: 60, gain: 0.8, lp: 1600, lfo: 0.07 },
      bass: { pat: 'r.....r...5.....', patChange: 'r.......R.R.R.R.', lo: 33, lp: 650, glide: 0.08, lag: 0.018, art: 0.95 },
      kit: 'swamp', send: { dly: 0.2, rev: 0.9 }
    },
    { // 9 Neon: Moll, Rechteck-Arpeggien, pumpende Fläche
      harm: [0, 5, 2, 6, 0, 5, 2, 6, 3, 5, 0, 6, 3, 5, 6, 6], riff: [0, 5, 2, 6],
      lead: { inst: 'arp', center: 69, decay: 0.09, art: 0.8, lp: 1900, lpQ: 4, lfo: 0.06 },
      pad: { att: 0.3, rel: 0.7, ext: 1, lp: 1500, center: 62, gain: 0.8, pump: true },
      bass: { pat: 'r.r.o.r.r.r.o.r.', lo: 33, lp: 850, art: 0.6 },
      kit: 'synth', send: { dly: 0.22, rev: 0.7 }
    },
    { // 10 Kristall: lydisch, hohe Sinusglocken
      harm: [0, 1, 0, 1, 5, 4, 1, 1, 0, 1, 2, 5, 6, 4, 1, 1], riff: [2, 1, 0, 1],
      lead: { inst: 'bell', center: 86, decay: 0.45, partials: [[1, 1, 1], [2, 0.18, 0.5], [4.2, 0.08, 0.2]] },
      pad: { att: 0.6, rel: 1.1, ext: 1, center: 70, gain: 0.6 },
      bass: { pat: 'r.......r...5...', lo: 40 },
      kit: 'light', percGain: 0.8, send: { dly: 0.3, rev: 1 }
    },
    { // 11 Wolken: Dur, weiche Flächen
      harm: [0, 0, 3, 3, 5, 5, 3, 4, 0, 2, 3, 0, 5, 1, 3, 4], riff: [5, 3, 0, 4],
      lead: { inst: 'soft', center: 77, pool: 'slow', att: 0.07, sus: 0.85, rel: 0.4, art: 1, vib: 6, maxLen: 16 },
      pad: { att: 1.2, rel: 1.8, ext: 2, center: 64, gain: 1.25, det: 8 },
      bass: { pat: 'r.......r...5...', lo: 40 },
      kit: 'brush', send: { dly: 0.24, rev: 1, revPad: 1.2 }
    },
    { // 12 Uhrwerk: Moll, Perkussion durchgehend im Sechzehntelraster
      harm: [0, 0, 5, 6, 0, 0, 3, 4, 5, 6, 0, 0, 3, 5, 6, 4], riff: [0, 5, 6, 4],
      lead: { inst: 'square', center: 74, pool: 'clock', art: 0.45, maxLen: 4, sus: 0.5, lp: 2400 },
      pad: { mode: 'pulse', pat: 'x.x.x.x.x.x.x.x.', art: 0.35, att: 0.004, sus: 0.5, dec: 0.08, rel: 0.05, lp: 1500, center: 60, gain: 0.8 },
      bass: { pat: 'r...5...r...5...', lo: 36, art: 0.55 },
      kit: 'clock', send: { dly: 0.1, rev: 0.7 }
    },
    { // 13 Asche: harmonisch Moll, dunkel
      harm: [0, 0, 5, 5, 3, 3, 4, 4, 0, 0, 5, 3, 5, 3, 4, 4], riff: [0, 5, 3, 4],
      lead: { inst: 'dark', center: 64, pool: 'slow', att: 0.07, sus: 0.85, rel: 0.35, art: 1, vib: 8, maxLen: 12 },
      pad: { att: 1, rel: 1.6, lp: 750, center: 56, gain: 0.85 },
      bass: { pat: 'r.......r..r....', lo: 33, lp: 600 },
      kit: 'heavy', send: { dly: 0.14, rev: 0.9, revPerc: 0.8 }
    },
    { // 14 Weltraum: Ganztonleiter, schwebend
      harm: [0, 0, 1, 1, 2, 2, 1, 1, 5, 5, 4, 4, 3, 3, 1, 1], riff: [0, 1, 2, 1],
      lead: { inst: 'soft', center: 74, pool: 'slow', att: 0.12, sus: 0.85, rel: 0.6, art: 1, vib: 5, glide: 0.5, maxLen: 16 },
      pad: { att: 1.6, rel: 2.2, ext: 2, center: 62, gain: 0.85, lfo: 0.05 },
      bass: { pat: 'r...........5...', lo: 40 },
      kit: 'space', send: { dly: 0.4, dlyPerc: 0.4, rev: 1.1 }
    }
  ];
  // Menü und Endbildschirm
  const SPECIAL = {
    menu: {
      music: { scale: 'major', root: 55, bpm: 92, waves: { lead: 'triangle', bass: 'triangle', pad: 'sine' }, filter: 4600, delayFb: 0.3, reverb: 0.4, perc: 'light', feel: 'menu', seed: 11 },
      harm: [0, 0, 3, 3, 5, 5, 4, 4, 0, 0, 3, 3, 1, 1, 4, 4], riff: [0, 3, 4, 0],
      lead: { inst: 'pluck', center: 74, pool: 'slow', decay: 0.45, maxLen: 12 },
      pad: { att: 0.7, rel: 1.2, ext: 1, center: 62, gain: 0.85 },
      bass: { pat: 'r.......5.......', lo: 36 },
      kit: 'light', percGain: 0.6, send: { dly: 0.22, rev: 1 }
    },
    victory: {
      music: { scale: 'major', root: 60, bpm: 116, waves: { lead: 'square', bass: 'triangle', pad: 'sawtooth' }, filter: 5000, delayFb: 0.25, reverb: 0.35, perc: 'pop', feel: 'victory', seed: 99 },
      harm: [0, 3, 4, 0, 5, 3, 4, 4, 0, 3, 5, 4, 3, 4, 0, 4], riff: [0, 3, 4, 0],
      lead: { inst: 'brass', center: 76, art: 0.9, sus: 0.75, lp: 2400 },
      pad: { mode: 'strum', pat: 'x.....x...x.....', att: 0.006, sus: 0.4, dec: 0.3, rel: 0.12, lp: 1800, center: 64, gain: 0.8, art: 0.9 },
      bass: { pat: 'r.r.5.r.r.r.5.o.', lo: 36, art: 0.7 },
      kit: 'pop', send: { dly: 0.12, rev: 0.8 }
    }
  };

  // Pegelabgleich pro Stück in dB: Melodie, Fläche, Bass (mit Boss-Bass), Perkussion, Gesamt.
  // Gemessen und geschrieben von test/music_calibrate.js (Stimmen nach Mischprofil, Gesamtlautheit gleich).
  // CAL-START
  const CAL = {
    menu: [0.2, -6.8, 0.2, 0.9, 0.8],
    victory: [-0.2, 5.1, -0.2, -1.4, 1.5],
    level0: [-0.7, -0.5, 0.6, -0.1, 2.1],
    boss0: [-1.9, -3.3, 0.2, -0.8, 1.6],
    level1: [-3.1, -6.6, -3.8, -5.5, 1.9],
    boss1: [-5.4, -7.6, -3.6, -3.1, 1.3],
    level2: [-13.9, -4.9, 7.4, -0.2, 1.7],
    boss2: [-15.2, -6.9, 3.8, -1.9, 1.6],
    level3: [1.4, -1.4, 0.3, 4.3, 2.4],
    boss3: [-0.5, -3.3, -1.4, -1.2, 2],
    level4: [5.5, 2.1, -0.2, 1.9, 2.5],
    boss4: [4, 0.4, -1.4, 1.2, 1.9],
    level5: [-8.5, -6.8, -4.4, 1.7, 1.1],
    boss5: [-9.7, -8.1, -3.6, -3, 1.1],
    level6: [1.2, 3.2, 7.4, -0.5, 1.8],
    boss6: [0.3, 1.2, 4, -2.6, 1.5],
    level7: [-8.3, -1.3, -4, 6.9, 2.4],
    boss7: [-8.9, -2, -3.4, -2.3, 1.5],
    level8: [-5.2, -5.5, 8.3, -0.7, 1.7],
    boss8: [-6.4, -7.2, 7.5, 0.4, 1.5],
    level9: [1.5, 3.6, 5.3, -0.5, 1.6],
    boss9: [0.4, 1.7, 3, -0.3, 1.5],
    level10: [-4.6, -5.3, -1.7, 0, 1.7],
    boss10: [-5.9, -6.4, -1.9, -0.7, 1.5],
    level11: [-8.6, -4.7, -5.2, -1.8, 1.2],
    boss11: [-8.7, -5.5, -4.6, -4.3, 1.2],
    level12: [2.7, 5.4, 0.4, 3.6, 2.7],
    boss12: [1.5, 3.1, -1.3, 0.9, 2.2],
    level13: [0.8, 2, 7.2, -1.2, 1.8],
    boss13: [0.5, -0.1, 4.5, -1.1, 1.6],
    level14: [-7.7, -3.5, -4.8, -2, 1.3],
    boss14: [-8.6, -4.6, -4.2, -1.7, 1.3]
  };
  // CAL-END

  // Ersatz, falls LEVELS einmal mehr Einträge hat als die Tabelle oben
  function fallbackStyle(mus) {
    const n = (SCALES[mus.scale] || SCALES.major).length, a = n === 7 ? [0, 5, 3, 4] : n === 5 ? [0, 3, 4, 1] : [0, 1, 2, 1];
    return { harm: [].concat(a, a, a, a), riff: a, lead: { inst: mus.waves && mus.waves.lead === 'sine' ? 'soft' : 'pluck' }, pad: {}, bass: {}, kit: 'light' };
  }

  function build(id, index, mus, sty, boss, calId) {
    const T = sty.tune || {};
    const lead = Object.assign({}, D_LEAD, sty.lead), pad = Object.assign({}, D_PAD, sty.pad), bass = Object.assign({}, D_BASS, sty.bass);
    if (boss) {
      // Boss: treibender Bass, dichtere Melodie, rhythmische Fläche, alle Melodieteile spielen
      if (lead.inst !== 'arp' && lead.pool !== 'clock') lead.pool = lead.pool === 'slow' || lead.pool === 'sparse' ? 'mid' : 'fast';
      lead.plan = [1, 1, 1, 1, 1, 1, 1, 1];
      lead.maxLen = Math.min(lead.maxLen, 8);
      if (pad.mode === 'strum' || pad.mode === 'broken') Object.assign(pad, { mode: 'pulse', pat: 'x..x..x.x..x..x.', art: 0.6 });
      Object.assign(lead, sty.bossLead || {});
      Object.assign(pad, sty.bossPad || {});
      bass.pat = sty.bossBass || 'r.r.r.r.r.r.o.r.';
      bass.patChange = null;
      bass.pat2 = null;
      bass.art = Math.min(bass.art, 0.75);
    }
    const cal = CAL[calId || id] || [0, 0, 0, 0, 0], dbl = x => Math.pow(10, x / 20);
    lead.gain *= dbl(cal[0]);
    pad.gain *= dbl(cal[1]);
    bass.gain *= dbl(cal[2]);
    const riff = sty.riff || sty.harm.slice(0, 4);
    const kit = T.kit || sty.kit || mus.perc;
    return {
      id, index, boss,
      scale: mus.scale, root: or(T.root, mus.root), bpm: mus.bpm + (boss ? 20 : 0),
      waves: Object.assign({ lead: 'triangle', bass: 'triangle', pad: 'triangle' }, mus.waves),
      filter: or(T.filter, mus.filter), filterQ: or(T.filterQ, or(mus.filterQ, 0.7)), delayFb: or(mus.delayFb, 0.3),
      reverb: or(T.reverb, or(mus.reverb, 0.3)), perc: kit, feel: T.feel || mus.feel || '', swing: mus.swing || 0,
      seed: (mus.seed || 1) + (boss ? 7 : 0),
      harm: boss ? [].concat(riff, riff, riff, riff) : sty.harm.slice(),
      st: {
        lead, pad, bass, kit, hp: sty.hp || 0, percGain: or(sty.percGain, 1) * dbl(cal[3]), bossGain: or(sty.bossGain, 1) * dbl(cal[2]),
        send: Object.assign({}, D_SEND, sty.send), trim: cal[4]
      }
    };
  }

  const defs = new Map();
  function songDef(id) {
    id = String(id);
    let d = defs.get(id);
    if (d) return d;
    if (SPECIAL[id]) d = build(id, -1, SPECIAL[id].music, SPECIAL[id], false);
    else {
      const m = /^(level|boss)(\d+)$/.exec(id);
      if (!m) return songDef('menu');
      // Stil und Feinabgleich hängen am Biom, nicht an der Position in LEVELS
      const i = Math.min(+m[2], LEVELS.length - 1), mus = LEVELS[i].music, oi = BIOME_NAMES.indexOf(LEVELS[i].name);
      d = build(id, i, mus, BIOME[oi] || fallbackStyle(mus), m[1] === 'boss', oi >= 0 ? m[1] + oi : id);
    }
    defs.set(id, d);
    return d;
  }

  // ---------- Das Stück: Ereignisse pro Sechzehntel ----------
  function composeSong(def) {
    const st = def.st, R = mulberry32((def.seed >>> 0) || 1), K = keyOf(def.scale, def.root), n = K.n;
    const ev = Array.from({ length: STEPS }, () => []);
    const put = (s, e) => { ev[mod(s, STEPS)].push(e); };
    const harm = [];
    for (let b = 0; b < BARS; b++) harm.push(def.harm[b % def.harm.length] || 0);
    const chords = harm.map(d => chordOf(K, d));
    const pickOf = arr => arr[Math.floor(R() * arr.length)];
    const isCT = (d, ch) => ch.pcs.has(K.pc(K.midi(d)));
    // nächster Akkordton; bei beabsichtigter Bewegung (dir) nicht auf den Vorgängerton zurückfallen
    const snap = (d, ch, avoidTonic, prevM, dir) => {
      const ks = dir > 0 ? [0, 1, -1, 2, -2, 3, -3] : [0, -1, 1, -2, 2, -3, 3];
      let first = null;
      for (const k of ks) {
        const x = d + k;
        if (!isCT(x, ch) || (avoidTonic && K.pc(K.midi(x)) === 0)) continue;
        if (first === null) first = x;
        if (!dir || prevM === undefined || K.midi(x) !== prevM) return x;
      }
      return first === null ? d : first;
    };
    const clash = (d, ch) => { const x = K.pc(K.midi(d)); for (const c of ch.pcs) if (mod(x - c, 12) === 1) return true; return false; };
    const accent = p => ((p & 15) === 0 ? 1 : (p & 7) === 0 ? 0.92 : (p & 3) === 0 ? 0.85 : 0.76) * (0.94 + 0.12 * R());

    // --- Melodie ---
    const L = st.lead;
    if (L.inst === 'arp') {
      for (let b = 0; b < BARS; b++) {
        const ch = chords[b], ints = ch.tones.concat(ch.ext.slice(0, 1)).map(s => s % 12);
        const ladder = [];
        for (let m = L.center - 5; ladder.length < 7; m++) if (ints.includes(mod(m - K.root - ch.r, 12))) ladder.push(m);
        const pat = b === BARS - 1 ? ARP.t : b >= 8 && b < 12 ? ARP.b : ARP.a, half = b === 8 || b === 9;
        for (let s = 0; s < 16; s++) {
          if (half && (s & 1)) continue;
          const i = pat[s];
          if (i < 0) continue;
          put(b * 16 + s, { v: 'lead', m: ladder[i], len: (half ? 2 : 1) * L.art, vel: ((s & 3) === 0 ? 1 : 0.72) * (0.95 + 0.1 * R()) });
        }
      }
    } else {
      const c0 = K.near(L.center), span = Math.max(3, Math.round(n * 0.72));
      const motif = (rh, d0, lo, hi) => {
        const out = [];
        let d = d0, prev = 0;
        for (let p = 0; p < 32; p++) {
          if (rh[p] !== 'x') continue;
          if (out.length) {
            let s;
            if (Math.abs(prev) >= 2 && R() < 0.75) s = -Math.sign(prev);           // nach einem Sprung Gegenbewegung
            else { const q = R(); s = q < 0.32 ? 1 : q < 0.64 ? -1 : q < 0.7 ? 0 : q < 0.82 ? 2 : q < 0.94 ? -2 : (R() < 0.5 ? 3 : -3); }
            if (s === 0 && prev === 0) s = R() < 0.5 ? 1 : -1;                         // höchstens eine Tonwiederholung
            if (d + s > hi || d + s < lo) s = -s;
            d += s;
            prev = s;
          }
          out.push({ p, d });
        }
        out.forEach((o, j) => { o.len = (j + 1 < out.length ? out[j + 1].p : 32) - o.p; });
        return out;
      };
      const vary = m => m.map((o, j) => (j > 0 && j < m.length - 1 && (o.p & 7) !== 0 && R() < 0.35 ? { p: o.p, d: o.d + (R() < 0.5 ? 1 : -1), len: o.len } : o));
      const shiftOf = (a, b) => { let s = mod(harm[b] - harm[a], n); if (s > n / 2) s -= n; return clamp(s, -2, 2); };
      const pool = RH[L.pool] || RH.mid, rA = pickOf(pool);
      let rB = pickOf(pool);
      for (let k = 0; k < 4 && rB === rA && pool.length > 1; k++) rB = pickOf(pool);
      const A = motif(rA, snap(c0 + pickOf([0, 1, 2, -1]), chords[0]), c0 - span, c0 + span);
      const B = motif(rB, snap(c0 + Math.max(1, Math.round(n * 0.35)), chords[8]), c0 - span + 1, c0 + span + 2);
      const C = motif(pickOf(L.pool === 'sparse' ? RH.sparse : RH.cad), snap(c0 + 1, chords[6]), c0 - span, c0 + span);
      const Tm = motif(pickOf(pool), snap(c0, chords[14]), c0 - span, c0 + span);
      // Form: A A' A C | B B' A Wende (je zwei Takte); A' und B' als Sequenz entlang der Akkorde
      const plan = [[A, 0, 0, ''], [A, 2, shiftOf(0, 2), 'open'], [vary(A), 4, 0, ''], [C, 6, 0, 'close'],
        [B, 8, 0, ''], [B, 10, shiftOf(8, 10), 'open'], [A, 12, 0, ''], [Tm, 14, 0, 'turn']];
      const notes = [];
      plan.forEach(([m, b0, sh, end], i) => {
        if (!L.plan[i]) return;
        let prevM;
        m.forEach((o, j) => {
          const ch = chords[b0 + (o.p >> 4)], dir = j ? Math.sign(o.d - m[j - 1].d) : 0;
          let d = o.d + sh, len = Math.min(o.len, L.maxLen);
          if ((o.p & 7) === 0 || len >= 6) d = snap(d, ch, false, prevM, dir);
          else if (len >= 3 && clash(d, ch)) d = snap(d, ch, false, prevM, dir);
          if (end && j === m.length - 1) {
            d = end === 'close' && ch.pcs.has(0) ? n * Math.round(d / n) : snap(d, ch, end !== 'close', prevM, dir);
            len = end === 'turn' ? Math.max(1, Math.min(len, 28 - o.p)) : Math.max(len, Math.min(8, 32 - o.p));
          }
          prevM = K.midi(d);
          notes.push({ s: b0 * 16 + o.p, m: prevM, len, vel: accent(o.p) });
        });
      });
      notes.sort((a, b) => a.s - b.s);
      notes.forEach((e, i) => {
        const pv = notes[(i + notes.length - 1) % notes.length];
        const o = { v: 'lead', m: e.m, len: e.len * L.art, vel: e.vel };
        const legato = mod(pv.s + pv.len, STEPS) >= e.s - 1 || pv.s + pv.len >= STEPS;
        if (L.glide && pv !== e && pv.m !== e.m && Math.abs(pv.m - e.m) <= 5 && legato && R() < L.glide) o.from = pv.m;
        if (L.bend && e.len >= 4 && R() < L.bend) o.bend = 1;
        if (L.grace && (e.s & 7) === 0 && R() < L.grace) o.grace = K.midi(K.near(e.m) + 1);
        put(e.s, o);
      });
    }

    // --- Fläche ---
    const P = st.pad;
    let prevV = null;
    const vo = ch => (prevV = voicing(K, ch, prevV, P));
    if (P.mode === 'sustain') {
      for (let b = 0; b < BARS;) {
        let e = b + 1;
        while (e < BARS && e - b < P.maxBars && harm[e] === harm[b]) e++;
        put(b * 16, { v: 'pad', ms: vo(chords[b]), len: (e - b) * 16 * P.art, vel: 1 });
        b = e;
      }
    } else {
      const pos = onsets(P.pat);
      for (let b = 0; b < BARS; b++) {
        const ms = vo(chords[b]);
        pos.forEach((p, j) => {
          const end = j + 1 < pos.length ? pos[j + 1] : 16;
          const notes = P.mode === 'broken' ? [ms[P.idx[j % P.idx.length] % ms.length]] : ms;
          put(b * 16 + p, { v: 'pad', ms: notes, len: (end - p) * P.art, vel: j === 0 ? 1 : 0.82 });
        });
      }
    }

    // --- Bass ---
    // Grundtöne immer in derselben Oktave [lo, lo + 12): jeder Durchlauf klingt gleich
    const BS = st.bass, roots = chords.map(ch => BS.lo + mod(K.root + ch.r - BS.lo, 12));
    const bass = [];
    for (let b = 0; b < BARS; b++) {
      const ch = chords[b], r = roots[b], nb = (b + 1) % BARS, changes = harm[nb] !== harm[b], cont = harm[(b + BARS - 1) % BARS] === harm[b];
      const pat = (changes && BS.patChange) || (cont && BS.pat2) || BS.pat;
      const fifth = ch.fifth || ch.third || 7, third = ch.third || fifth;
      const toks = onsets(pat), runs = toks.filter(s => pat[s] === 'R');
      // nächster Grundton und Richtung der Annäherung (Läufe nicht unter lo - 3)
      const nr = roots[nb], dn = K.near(nr);
      let dir = nr >= r ? -1 : 1;
      if (dir < 0 && runs.length && K.midi(dn - runs.length) < BS.lo - 3) dir = 1;
      toks.forEach((s, j) => {
        const c = pat[s];
        let m = r;
        if (c === 'o') m = r + 12;
        else if (c === '5') m = r + fifth;
        else if (c === '3') m = r + third;
        else if (c === 'a') { m = changes ? K.midi(dn + dir) : r + fifth; if (m === r) m = K.midi(dn - dir); }
        else if (c === 'R') m = K.midi(dn + dir * (runs.length - runs.indexOf(s)));
        const end = j + 1 < toks.length ? toks[j + 1] : 16;
        bass.push({ s: b * 16 + s, m, len: (end - s) * BS.art, vel: s === 0 ? 1 : (s & 3) === 0 ? 0.9 : 0.8 });
      });
    }
    bass.forEach((e, i) => {
      const pv = bass[(i + bass.length - 1) % bass.length], o = { v: 'bass', m: e.m, len: e.len, vel: e.vel };
      if (BS.glide && pv.m !== e.m) o.from = pv.m;
      put(e.s, o);
    });
    // Boss: zusätzlicher verstimmter Sägezahnbass in Achteln auf dem Grundton
    if (def.boss) for (let b = 0; b < BARS; b++) for (let s = 0; s < 16; s += 2) put(b * 16 + s, { v: 'boss', m: roots[b], len: 1.4, vel: (s & 3) === 0 ? 1 : 0.75 });

    // --- Perkussion ---
    const kit = KITS[st.kit] || KITS.light, boss = def.boss;
    // gestimmte Hölzer: Grundton nahe C5 und die Quinte (oder der nächste Leiterton) darüber
    const woodLo = K.midi(n * Math.round((72 - K.root) / 12)), woodHz = { woodL: hzOf(woodLo), woodH: hzOf(K.midi(K.near(woodLo + 7))) };
    for (let b = 0; b < BARS; b++) {
      const sec = boss ? (kit.boss || kit.main) : (b >= 8 && b < 12 && kit.thin ? kit.thin : kit.main);
      const fillP = boss ? (b % 4 === 3 ? (kit.bfill || kit.fill) : null) : (b === 7 || b === 15 ? kit.fill : null);
      const parts = Object.assign({}, sec);
      if (fillP) for (const k in fillP) parts[k] = (parts[k] || '................').slice(0, 8) + fillP[k].slice(8);
      for (const k in parts) {
        const pat = parts[k];
        for (let s = 0; s < 16; s++) {
          const c = pat[s];
          if (c !== 'x' && c !== 'o') continue;
          const e = { v: 'perc', k, vel: (c === 'x' ? 1 : 0.55) * (0.93 + 0.14 * R()) };
          if (woodHz[k]) e.f = woodHz[k];
          put(b * 16 + s, e);
        }
      }
      if (kit.crash && (b === 0 || (!boss && b === 8))) put(b * 16, { v: 'perc', k: 'crash', vel: 0.8 });
      if (kit.special === 'thunder' && (boss ? b % 4 === 1 : b === 2 || b === 10)) put(b * 16 + (boss ? 0 : 8), { v: 'perc', k: 'thunder', vel: 0.85 + 0.15 * R(), len: 28 });
      if (kit.special === 'surf' && !boss && b % 2 === 0) put(b * 16, { v: 'perc', k: 'surf', vel: 0.85 + 0.15 * R(), len: 32 });
      if (kit.special === 'swell' && !boss && b % 4 === 2) put(b * 16, { v: 'perc', k: 'swell', vel: 1, len: 32 });
      if (kit.special === 'drip') {
        if (!boss && b % 2 === 0) put(b * 16, { v: 'perc', k: 'tom', vel: 0.45 });
        const cnt = b >= 8 && b < 12 ? (R() < 0.5 ? 1 : 0) : 1 + (R() < 0.45 ? 1 : 0);
        for (let i = 0; i < cnt; i++) put(b * 16 + Math.floor(R() * 16), { v: 'perc', k: 'drip', vel: 0.7 + 0.3 * R(), f: hzOf(K.midi(K.near(86) + Math.floor(R() * n))) });
      }
    }
    return { id: def.id, def, ev, steps: STEPS, bars: BARS, stepDur: 15 / def.bpm, loopSec: STEPS * 15 / def.bpm, harm, roots };
  }

  return { SCALES, BIOME, KITS, keyOf, chordOf, hzOf, songDef, composeSong, mod };
})();
function songDef(id) { return MusicGen.songDef(id); }
function composeSong(def) { return MusicGen.composeSong(def); }

// ---------- Klangerzeugung, Abspielen und Geräusche ----------
const Music = (() => {
  const WIN = typeof window !== 'undefined' ? window : {};
  const AC = WIN.AudioContext || WIN.webkitAudioContext;
  const XFADE = 60 / 60;                   // Überblendung: 60 Frames bei 60 FPS
  const LOOKAHEAD = 0.2, TICK_MS = 25;
  const MASTER = 0.84, DUCK_GAIN = 0.5, DUCK_FREQ = 750, OPEN_FREQ = 20000;
  const hz = MusicGen.hzOf, mod = MusicGen.mod;
  const simOn = () => typeof SIM !== 'undefined' && !!SIM && !!SIM.on;
  let ac = null, E = null, timer = null;
  let enabled = true, unlocked = false, ducked = false, hidden = false, vol = 0.8, kicked = false;
  let want = 'menu', cur = null;
  const players = [], songs = new Map(), keys = new Map();
  try { const s = WIN.localStorage; if (s && s.getItem(CONFIG.MUSIC_KEY) === '0') enabled = false; } catch (e) { /* ohne Speicher */ }
  try { hidden = typeof document !== 'undefined' && !!document.hidden; } catch (e) { /* egal */ }

  // ---------- Bausteine ----------
  const G = (c, v, dst) => { const n = c.createGain(); n.gain.value = v; if (dst) n.connect(dst); return n; };
  const F = (c, type, f, q, dst) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q || 0; if (dst) n.connect(dst); return n; };
  const PAN = (c, p, dst) => {
    let n;
    if (c.createStereoPanner) { n = c.createStereoPanner(); n.pan.value = p; } else n = c.createGain();
    if (dst) n.connect(dst);
    return n;
  };
  function osc(c, type, f, t, stop, dst, det) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (det) o.detune.setValueAtTime(det, t);
    o.connect(dst);
    o.start(t);
    o.stop(stop);
    return o;
  }
  // Exponentiell von v (verankert bei t) auf 'to' zulaufen. Der Anker direkt vor setTargetAtTime
  // macht das Verhalten in allen Implementierungen gleich (manche rechnen Lücken davor falsch)
  function targetAt(p, v, to, t, tau) {
    p.setValueAtTime(v, t);
    p.setTargetAtTime(to, t, tau);
  }
  // Zupfen: kurzer Anstieg, exponentielles Abklingen. Rückgabe: Zeitpunkt, ab dem nichts mehr klingt
  function envPluck(p, t, pk, att, tau) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + att);
    p.setTargetAtTime(0, t + att, tau);
    return t + att + tau * 7;
  }
  // gezupften Ton vorzeitig loslassen (Wert zum Zeitpunkt tr ist aus der Hüllkurve bekannt)
  function releasePluck(p, t, pk, att, tau, tr, rel) {
    tr = Math.max(tr, t + att);
    targetAt(p, pk * Math.exp(-(tr - t - att) / tau), 0, tr, rel);
    return tr + rel * 7;
  }
  // Halten: Anstieg, Abfall auf den Haltepegel, Loslassen am Notenende
  function envHold(p, t, pk, att, sus, dec, end, rel) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + att);
    const e = Math.max(t + att, end);
    let v = pk;
    if (sus < 1 && e > t + att) {
      p.setTargetAtTime(pk * sus, t + att, dec);
      v = pk * (sus + (1 - sus) * Math.exp(-(e - t - att) / dec));
    }
    targetAt(p, v, 0, e, rel);
    return e + rel * 7;
  }
  function curveOf(fn) {
    const n = 4097, a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = fn(i / (n - 1) * 2 - 1);
    return a;
  }
  // Weicher Begrenzer am Ausgang: bis 0.6 unverändert, darüber sanft gegen 0.87
  const clipCurve = () => curveOf(x => { const a = Math.abs(x); return a < 0.6 ? x : Math.sign(x) * (0.6 + 0.32 * Math.tanh((a - 0.6) / 0.32)); });
  const driveCurve = () => curveOf(x => Math.tanh(x * 2.2) / Math.tanh(2.2));

  // Rauschpuffer, Enden überblendet, damit auch Schleifen ohne Knacken laufen
  function noiseBuf(c, secs, brown, rng) {
    const sr = c.sampleRate, len = Math.floor(sr * secs), x = Math.floor(sr * 0.02);
    const tmp = new Float32Array(len + x);
    let last = 0;
    for (let i = 0; i < len + x; i++) {
      const w = rng() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; tmp[i] = last * 3.5; } else tmp[i] = w;
    }
    for (let i = 0; i < x; i++) { const k = i / x; tmp[i] = tmp[i] * k + tmp[len + i] * (1 - k); }
    const b = c.createBuffer(1, len, sr);
    b.getChannelData(0).set(tmp.subarray(0, len));
    return b;
  }
  // Anstoß-Rauschkorn für die gestimmten Schläge: immer dasselbe Korn (fester Seed, auf die
  // Abtastrate umgerechnet), damit jeder Schlag gleich laut ist; low = tieffrequent geglättet
  function burstBuf(c, low) {
    const n0 = 2646, src = new Float32Array(n0), r = mulberry32(low ? 4242 : 2424);
    let y = 0, mx = 0;
    for (let i = 0; i < n0; i++) { const w = r() * 2 - 1; y = low ? y + 0.08 * (w - y) : w; src[i] = y; mx = Math.max(mx, Math.abs(y)); }
    const sr = c.sampleRate, len = Math.floor(sr * 0.06), b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const x = i * 44100 / sr, j = Math.min(n0 - 2, Math.floor(x)), f = x - j;
      d[i] = (src[j] * (1 - f) + src[j + 1] * f) / mx;
    }
    return b;
  }
  // Hall: abklingendes Stereo-Rauschen, das mit der Zeit dunkler wird
  function impulse(c, rng) {
    const sr = c.sampleRate, len = Math.floor(sr * 3.2), pre = Math.floor(sr * 0.012), b = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr, a = 0.7 - 0.55 * Math.min(1, t / 1.8);
        y += a * ((rng() * 2 - 1) - y);
        d[i] = y * Math.exp(-t * 6.9 / 2.6);
      }
    }
    return b;
  }

  // Signalweg: Spuren -> Musikbus (Ducking: Pegel und Tiefpass) -> Ausgang (Lautstärke, stumm)
  // -> Kompressor -> weicher Begrenzer. Geräusche umgehen das Ducking. Gemeinsamer Hall.
  function buildEngine(c, seed, raw) {
    const e = { c, rng: mulberry32(seed >>> 0) };
    e.out = G(c, 0);
    if (raw) e.out.connect(c.destination);    // nur für Messungen: ohne Kompressor und Begrenzer
    else {
      e.comp = c.createDynamicsCompressor();
      e.comp.threshold.value = -18;
      e.comp.knee.value = 10;
      e.comp.ratio.value = 3;
      e.comp.attack.value = 0.0015;
      e.comp.release.value = 0.25;
      e.clip = c.createWaveShaper();
      e.clip.curve = clipCurve();
      e.out.connect(e.comp);
      e.comp.connect(e.clip);
      e.clip.connect(c.destination);
    }
    e.music = G(c, 1);
    e.duck = F(c, 'lowpass', OPEN_FREQ, 0, e.out);
    // Zustand der geglätteten Regler (Lautstärke, Ducking), um Zielfahrten sauber zu verankern
    e.sm = { out: { prm: e.out.gain, v: 0, to: 0, t: 0, tau: 0 }, music: { prm: e.music.gain, v: 1, to: 1, t: 0, tau: 0 },
      duck: { prm: e.duck.frequency, v: OPEN_FREQ, to: OPEN_FREQ, t: 0, tau: 0 } };
    e.music.connect(e.duck);
    e.sfx = G(c, 1, e.out);
    e.revIn = G(c, 1);
    const conv = c.createConvolver(), revHp = F(c, 'highpass', 320, 0, conv);   // kein Bass im Hall
    conv.buffer = impulse(c, e.rng);
    e.revIn.connect(revHp);
    conv.connect(G(c, 0.55, e.music));
    e.white = noiseBuf(c, 1, false, e.rng);
    e.brown = noiseBuf(c, 2, true, e.rng);
    e.burstLow = burstBuf(c, true);
    e.burstHi = burstBuf(c, false);
    return e;
  }

  // Echo im Takt (punktierte Achtel), Wiederholungen abwechselnd links und rechts, werden dunkler
  function delayNet(c, time, fb, dst) {
    const inp = F(c, 'highpass', 260, 0), a = c.createDelay(2), b = c.createDelay(2);
    a.delayTime.value = time;
    b.delayTime.value = time;
    const la = F(c, 'lowpass', 3200, 0), lb = F(c, 'lowpass', 3200, 0), fa = G(c, fb), fbb = G(c, fb);
    const pa = PAN(c, -0.55, dst), pb = PAN(c, 0.55, dst);
    inp.connect(a); a.connect(la); la.connect(pa); la.connect(fa); fa.connect(b);
    b.connect(lb); lb.connect(pb); lb.connect(fbb); fbb.connect(a);
    return inp;
  }

  // Eine Spur: eigene Busse für die vier Stimmen, Biom-Tiefpass, Echo, Überblend-Regler
  function makePlayer(e, song, t0) {
    const c = e.c, d = song.def, st = d.st, L = st.lead, PD = st.pad;
    const p = { id: song.id, song, def: d, st, step: 0, next: t0, dying: false, end: Infinity, kill: Infinity, lfos: [],
      fade: { t: t0, from: 0, to: 0, dur: 0 }, trim: Math.pow(10, (st.trim || 0) / 20) };
    p.fader = G(c, 0, e.music);
    p.wetFader = G(c, 0, e.revIn);
    p.wet = G(c, 1, p.wetFader);
    p.tone = F(c, 'lowpass', d.filter, d.filterQ, p.fader);
    p.mel = st.hp ? F(c, 'highpass', st.hp, 0, p.tone) : p.tone;
    p.dly = delayNet(c, Math.min(1, 45 / d.bpm), clamp(d.delayFb, 0, 0.7), p.tone);
    const lfo = (rate, depth, target) => { const o = c.createOscillator(); o.frequency.value = rate; o.connect(G(c, depth, target)); o.start(t0); p.lfos.push(o); };
    // Melodie
    p.lead = G(c, 1);
    let lo = p.lead;
    if (L.drive) { const pre = G(c, L.drive), sh = c.createWaveShaper(), post = G(c, L.gain / Math.sqrt(L.drive)); sh.curve = driveCurve(); lo.connect(pre); pre.connect(sh); sh.connect(post); lo = post; }
    if (L.lp) { const f = F(c, 'lowpass', L.lp, L.lpQ); lo.connect(f); lo = f; if (L.lfo) lfo(L.lfo, L.lp * 0.6, f.frequency); }
    lo.connect(PAN(c, L.pan, p.mel));
    lo.connect(G(c, st.send.dly, p.dly));
    lo.connect(G(c, st.send.rev * d.reverb, p.wet));
    // Fläche: zwei leicht verstimmte Hälften links und rechts
    p.padF = F(c, 'lowpass', PD.lp, 0);
    p.padAmp = G(c, 1, p.mel);
    if (PD.drive) { const pre = G(c, PD.drive), sh = c.createWaveShaper(), post = G(c, PD.gain / Math.sqrt(PD.drive)); sh.curve = driveCurve(); p.padF.connect(pre); pre.connect(sh); sh.connect(post); post.connect(p.padAmp); }
    else p.padF.connect(p.padAmp);
    p.padL = PAN(c, -0.4, p.padF);
    p.padR = PAN(c, 0.4, p.padF);
    p.padAmp.connect(G(c, st.send.revPad * d.reverb, p.wet));
    if (PD.lfo) lfo(PD.lfo, PD.lp * 0.4, p.padF.frequency);
    if (PD.trem) { p.padAmp.gain.value = 1 - PD.trem; lfo(d.bpm / 30, PD.trem, p.padAmp.gain); }
    // Bass, bei Sägezahn und Rechteck mit eigenem Tiefpass
    p.bass = G(c, 1);
    if (d.waves.bass === 'sawtooth' || d.waves.bass === 'square') p.bass.connect(F(c, 'lowpass', st.bass.lp, 2, p.tone));
    else p.bass.connect(p.tone);
    if (d.boss) { p.boss = G(c, 1); p.boss.connect(F(c, 'lowpass', 680, 5, p.tone)); }
    // Perkussion: eigene Filter pro Schlag, am Biom-Tiefpass vorbei
    p.perc = G(c, st.percGain, p.fader);
    p.perc.connect(G(c, st.send.revPerc * d.reverb, p.wet));
    if (st.send.dlyPerc) p.perc.connect(G(c, st.send.dlyPerc, p.dly));
    return p;
  }

  // Pegel einer Spur mit gleichbleibender Leistung über- oder ausblenden (Sinus/Kosinus in 8 Stücken)
  const shapeOf = (f, x) => (f.to >= f.from ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2));
  function levelAt(p, t) {
    const f = p.fade;
    if (t <= f.t || f.dur <= 0) return t <= f.t ? f.from : f.to;
    if (t >= f.t + f.dur) return f.to;
    return f.from + (f.to - f.from) * shapeOf(f, (t - f.t) / f.dur);
  }
  function fadeTo(p, t, to, dur) {
    const from = levelAt(p, t);
    p.fade = { t, from, to, dur };
    for (const prm of [p.fader.gain, p.wetFader.gain]) {
      prm.cancelScheduledValues(t);
      prm.setValueAtTime(from * p.trim, t);
      for (let i = 1; i <= 8; i++) prm.linearRampToValueAtTime((from + (to - from) * shapeOf(p.fade, i / 8)) * p.trim, t + dur * i / 8);
    }
  }
  function stopPlayer(p, t, dur) {
    fadeTo(p, t, 0, dur);
    p.dying = true;
    p.end = t + dur;
    p.kill = t + dur + 4;
  }
  function dispose(p) {
    for (const o of p.lfos) { try { o.stop(); } catch (e) { /* schon gestoppt */ } }
    try { p.fader.disconnect(); p.wetFader.disconnect(); } catch (e) { /* schon getrennt */ }
  }

  // ---------- Stimmen ----------
  const LEAD_PK = { sine: 0.2, triangle: 0.19, square: 0.075, sawtooth: 0.085 };
  const PAD_PK = { sine: 0.06, triangle: 0.055, square: 0.02, sawtooth: 0.024 };
  const BASS_PK = { sine: 0.0846, triangle: 0.0733, square: 0.0254, sawtooth: 0.0310 };
  function vibrato(c, o, t, stop, cents) {
    const g = G(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(cents, t + 0.4);
    g.connect(o.detune);
    osc(c, 'sine', 4.8, t, stop, g);
  }
  function playLead(e, p, t, ev, sd) {
    const c = e.c, L = p.st.lead, wave = p.def.waves.lead, f = hz(ev.m), dur = Math.max(0.04, ev.len * sd);
    const pk = (LEAD_PK[wave] || 0.15) * (L.drive ? 1 : L.gain) * ev.vel;
    switch (L.inst) {
      case 'bell': {
        // Glocke aus Sinus-Teiltönen, jeder klingt eigen ab
        for (const q of L.partials || [[1, 1, 1]]) {
          if (f * q[0] > 12000) continue;
          const g = G(c, 0, p.lead);
          osc(c, 'sine', f * q[0], t, envPluck(g.gain, t, pk * q[1], 0.002, L.decay * q[2]), g);
        }
        return;
      }
      case 'pluck': case 'mallet': case 'oud': {
        const g = G(c, 0, p.lead);
        let stop = envPluck(g.gain, t, pk, L.att, L.decay);
        if (dur < L.decay * 2.5) stop = Math.min(stop, releasePluck(g.gain, t, pk, L.att, L.decay, t + dur, Math.min(L.decay, 0.07)));
        const o = osc(c, wave, ev.grace ? hz(ev.grace) : f, t, stop, g);
        if (ev.grace) o.frequency.setValueAtTime(f, t + Math.min(0.07, dur * 0.4));
        if (L.inst === 'mallet') { const g2 = G(c, 0, p.lead); osc(c, 'sine', f * 4, t, envPluck(g2.gain, t, pk * 0.25, 0.002, 0.03), g2); }
        return;
      }
      case 'dist': {
        const g = G(c, 0, p.lead), stop = envHold(g.gain, t, pk, 0.008, 0.9, 0.2, t + dur, 0.07);
        for (const det of [-8, 8]) {
          const o = osc(c, wave, f, t, stop, g, det);
          if (ev.bend) { o.frequency.setValueAtTime(f * 0.9439, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); }
        }
        return;
      }
      case 'square': case 'brass': {
        const g = G(c, 0, p.lead), stop = envHold(g.gain, t, pk, L.inst === 'brass' ? 0.035 : 0.004, L.sus, 0.09, t + dur, 0.045);
        osc(c, wave, f, t, stop, g);
        return;
      }
      case 'arp': {
        const g = G(c, 0, p.lead), end = envPluck(g.gain, t, pk, 0.003, L.decay);
        osc(c, wave, f, t, Math.min(end, releasePluck(g.gain, t, pk, 0.003, L.decay, t + dur, 0.03)), g);
        return;
      }
      default: { // soft, dark: gehalten, mit Vibrato und Gleiten
        const g = G(c, 0, p.lead), stop = envHold(g.gain, t, pk, L.att, L.sus, 0.3, t + dur, L.rel);
        const o = osc(c, wave, f, t, stop, g);
        if (ev.from) { o.frequency.setValueAtTime(hz(ev.from), t); o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.12, dur * 0.4)); }
        if (L.vib && dur > 0.45) vibrato(c, o, t + 0.25, stop, L.vib);
      }
    }
  }
  function playPad(e, p, t, ev, sd) {
    const c = e.c, S = p.st.pad, wave = p.def.waves.pad, dur = Math.max(0.05, ev.len * sd);
    const pk = (PAD_PK[wave] || 0.04) * (S.drive ? 1 : S.gain) * ev.vel / Math.sqrt(Math.max(1, ev.ms.length) / 3);
    const gL = G(c, 0, p.padL), gR = G(c, 0, p.padR);
    const stop = envHold(gL.gain, t, pk, S.att, S.sus, S.dec, t + dur, S.rel);
    envHold(gR.gain, t, pk, S.att, S.sus, S.dec, t + dur, S.rel);
    for (const m of ev.ms) {
      osc(c, wave, hz(m), t, stop, gL, -S.det);
      osc(c, wave, hz(m), t, stop, gR, S.det);
    }
  }
  function playBass(e, p, t, ev, sd) {
    const c = e.c, B = p.st.bass, wave = p.def.waves.bass, f = hz(ev.m), dur = Math.max(0.06, ev.len * sd);
    const g = G(c, 0, p.bass), stop = envHold(g.gain, t, (BASS_PK[wave] || 0.2) * B.gain * ev.vel, B.att, B.sus, 0.25, t + dur, 0.05);
    const o = osc(c, wave, f, t, stop, g);
    if (ev.from && B.glide) { o.frequency.setValueAtTime(hz(ev.from), t); o.frequency.exponentialRampToValueAtTime(f, t + B.glide); }
  }
  function playBoss(e, p, t, ev, sd) {
    const c = e.c, f = hz(ev.m), g = G(c, 0, p.boss);
    const stop = envHold(g.gain, t, 0.0141 * ev.vel * p.st.bossGain, 0.004, 0.75, 0.08, t + ev.len * sd, 0.04);
    osc(c, 'sawtooth', f, t, stop, g, -14);
    osc(c, 'sawtooth', f, t, stop, g, 14);
  }

  // ---------- Perkussion: ausschließlich Rauschstöße ----------
  function noise(e, buf, t, len) {
    const s = e.c.createBufferSource();
    s.buffer = buf;
    if (len > buf.duration - 0.05) { s.loop = true; s.start(t, e.rng() * buf.duration * 0.9); }
    else s.start(t, e.rng() * (buf.duration - len));
    s.stop(t + len);
    return s;
  }
  // gefiltertes Rauschen mit Hüllkurve
  function hit(e, dst, buf, t, type, f, q, pk, att, tau) {
    const c = e.c, s = noise(e, buf, t, att + tau * 7), fl = F(c, type, f, q), g = G(c, 0, dst);
    s.connect(fl); fl.connect(g);
    envPluck(g.gain, t, pk, att, tau);
    return g;
  }
  function grain(e, buf, t) {
    const s = e.c.createBufferSource();
    s.buffer = buf;
    s.start(t);
    return s;
  }
  // kurzer Anstoß aus tiefem Rauschen in einen resonanten Tiefpass mit fallender Frequenz: dumpfer Schlag
  function thump(e, dst, t, f0, f1, q, pk, tau) {
    const c = e.c, s = grain(e, e.burstLow, t), ex = G(c, 0), fl = F(c, 'lowpass', f0, q), g = G(c, 0, dst);
    s.connect(ex); ex.connect(fl); fl.connect(g);
    ex.gain.setValueAtTime(1, t);
    targetAt(ex.gain, 1, 0, t + 0.003, 0.006);
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(f1, t + 0.08);
    g.gain.setValueAtTime(pk, t);
    targetAt(g.gain, pk, 0, t + tau * 0.5, tau);
    s.stop(t + 0.06);
    return t + tau * 8;
  }
  // kurzer Anstoß in einen schmalen Bandpass: gestimmter Holz- oder Tropfenklang
  function ring(e, dst, t, f, q, pk, tau, f2) {
    const c = e.c, s = grain(e, e.burstHi, t), ex = G(c, 0), fl = F(c, 'bandpass', f, q), g = G(c, 0, dst);
    s.connect(ex); ex.connect(fl); fl.connect(g);
    ex.gain.setValueAtTime(1, t);
    targetAt(ex.gain, 1, 0, t + 0.002, 0.003);
    if (f2) { fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(f2, t + 0.07); }
    g.gain.setValueAtTime(pk, t);
    targetAt(g.gain, pk, 0, t + tau, tau);
    s.stop(t + 0.06);
  }
  // Donner: grollendes tiefes Rauschen mit zweitem Anschwellen, dazu ein leiser Knall
  function thunder(e, dst, t, pk, len) {
    const c = e.c, s = noise(e, e.brown, t, len), fl = F(c, 'lowpass', 230, 1), g = G(c, 0, dst);
    s.connect(fl); fl.connect(g);
    const p = g.gain, v1 = pk * (0.45 + 0.55 * Math.exp(-0.44 / 0.15)), v2 = pk * (0.85 + (v1 / pk - 0.85) * Math.exp(-0.3 / 0.08));
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(pk, t + 0.06);
    p.setTargetAtTime(pk * 0.45, t + 0.06, 0.15);
    targetAt(p, v1, pk * 0.85, t + 0.5, 0.08);
    targetAt(p, v2, 0, t + 0.8, len * 0.22);
    hit(e, dst, e.white, t, 'bandpass', 900, 0.7, pk * 0.35, 0.003, 0.07);
    return t + len;
  }
  function playPerc(e, p, t, ev, sd) {
    const out = p.perc, v = ev.vel, W = e.white;
    switch (ev.k) {
      case 'kick': thump(e, out, t, 165, 50, 24, LV.kick * v, 0.09); break;
      case 'tom': thump(e, out, t, 130, 92, 20, LV.tom * v, 0.11); break;
      case 'doum': thump(e, out, t, 105, 72, 20, LV.doum * v, 0.12); break;
      case 'snare': case 'snareM': {
        const m = ev.k === 'snareM';
        hit(e, out, W, t, 'bandpass', m ? 900 : 1900, 0.8, LV.snare * v * (m ? 0.8 : 1), 0.001, m ? 0.06 : 0.05);
        hit(e, out, W, t, 'bandpass', 210, 5, LV.snareBody * v, 0.001, 0.035);
        break;
      }
      case 'clap': {     // drei schnell folgende Rauschstöße
        const c = e.c, s = noise(e, W, t, 0.4), fl = F(c, 'bandpass', 1300, 1.2), g = G(c, 0, out), a = LV.clap * v;
        s.connect(fl); fl.connect(g);
        targetAt(g.gain, a, 0, t, 0.004);
        targetAt(g.gain, a * 0.8, 0, t + 0.011, 0.004);
        targetAt(g.gain, a * 0.9, 0, t + 0.022, 0.05);
        break;
      }
      case 'rim': hit(e, out, W, t, 'bandpass', 2100, 5, LV.rim * v, 0.001, 0.012); break;
      case 'hat': hit(e, out, W, t, 'highpass', 7600, 0, LV.hat * v, 0.001, 0.013); break;
      case 'ohat': hit(e, out, W, t, 'highpass', 7000, 0, LV.ohat * v, 0.002, 0.06); break;
      case 'shaker': hit(e, out, W, t, 'bandpass', 5200, 1.3, LV.shaker * v, 0.008, 0.022); break;
      case 'tick': hit(e, out, W, t, 'bandpass', 3600, 8, LV.tick * v, 0.0005, 0.006); break;
      case 'tock': hit(e, out, W, t, 'bandpass', 2400, 8, LV.tock * v, 0.0005, 0.008); break;
      case 'tek': hit(e, out, W, t, 'bandpass', 2700, 3, LV.tek * v, 0.001, 0.014); break;
      case 'brush': hit(e, out, W, t, 'bandpass', 2800, 0.7, LV.brush * v, 0.02, 0.06); break;
      case 'ride': hit(e, out, W, t, 'bandpass', 5600, 2.5, LV.ride * v, 0.001, 0.09); break;
      case 'crash': hit(e, out, W, t, 'highpass', 4500, 0, LV.crash * v, 0.002, 0.45); break;
      case 'woodH': case 'woodL': ring(e, out, t, ev.f, 26, LV.wood * v, 0.03); break;
      case 'drip': ring(e, out, t, ev.f, 40, LV.drip * v, 0.04, ev.f * 1.5); break;
      case 'thunder': thunder(e, out, t, LV.thunder * v, ev.len * sd); break;
      case 'surf': case 'swell': {
        // Brandung bzw. Rauschwelle: langsames An- und Abschwellen mit wanderndem Bandpass
        const len = ev.len * sd, surf = ev.k === 'surf', s = noise(e, surf ? e.brown : W, t, len), c = e.c;
        const fl = F(c, 'bandpass', surf ? 300 : 2500, surf ? 0.8 : 1.2), g = G(c, 0, out);
        s.connect(fl); fl.connect(g);
        fl.frequency.setValueAtTime(surf ? 280 : 1800, t);
        fl.frequency.exponentialRampToValueAtTime(surf ? 950 : 5200, t + len * 0.45);
        fl.frequency.exponentialRampToValueAtTime(surf ? 380 : 2600, t + len);
        const top = (surf ? LV.surf : LV.swell) * v;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(top, t + len * 0.42);
        targetAt(g.gain, top, 0, t + len * 0.45, len * 0.16);
        break;
      }
    }
  }
  // Pegel der Schläge bei voller Anschlagstärke (auf gleiche Spitzenwerte abgeglichen)
  const LV = { kick: 0.3709, tom: 0.426, doum: 0.6265, snare: 0.2807, snareBody: 0.1504, clap: 0.441, rim: 0.3157, hat: 0.03859, ohat: 0.03007, shaker: 0.05363,
    tick: 0.2706, tock: 0.2757, tek: 0.3057, brush: 0.07167, ride: 0.05413, crash: 0.03909, wood: 4.661, drip: 3.458, thunder: 0.416, surf: 0.2606, swell: 0.02907 };

  function playEvent(e, p, t, ev, sd) {
    switch (ev.v) {
      case 'lead': playLead(e, p, t, ev, sd); break;
      case 'pad': playPad(e, p, t, ev, sd); break;
      case 'bass': playBass(e, p, t + p.st.bass.lag, ev, sd); break;
      case 'boss': playBoss(e, p, t, ev, sd); break;
      case 'perc': playPerc(e, p, t, ev, sd); break;
    }
  }
  // Einen Sechzehntel-Schritt einer Spur auf den Zeitpunkt t legen
  function scheduleStep(e, p, step, t, only) {
    const song = p.song, sd = song.stepDur, evs = song.ev[step];
    for (let i = 0; i < evs.length; i++) if (!only || only[evs[i].v]) playEvent(e, p, t, evs[i], sd);
    // pumpende Fläche: kurz absenken auf jedem Schlag
    if (p.st.pad.pump && (step & 3) === 0 && (!only || only.pad)) {
      const g = p.padAmp.gain;
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(0.35, t + 0.012);
      g.linearRampToValueAtTime(1, t + sd * 3.2);
    }
  }

  function getSong(id) {
    let s = songs.get(id);
    if (!s) { s = composeSong(songDef(id)); songs.set(id, s); }
    return s;
  }

  // ---------- Geräusche ----------
  function keyFor(id) {
    let k = keys.get(id);
    if (!k) { const d = songDef(id || 'menu'); k = { K: MusicGen.keyOf(d.scale, d.root), pc: mod(d.root, 12) }; keys.set(id, k); }
    return k;
  }
  // Ton der aktuellen Tonart nahe Grundton + semis, Lage base (60 = C4)
  const kNote = (k, semis, base) => k.K.midi(k.K.near(base + k.pc + semis));
  function tone(e, type, f, t, att, pk, tau, dst, f2, glide) {
    const g = G(e.c, 0, dst), stop = envPluck(g.gain, t, pk, att, tau), o = osc(e.c, type, f, t, stop, g);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
    return stop;
  }
  function bell(e, f, t, pk, tau, dst) {
    tone(e, 'sine', f * 2.76, t, 0.002, pk * 0.2, tau * 0.35, dst);
    return tone(e, 'sine', f, t, 0.002, pk, tau, dst);
  }
  const LS = { flap: 0.2, pipe: 0.15, ceiling: 0.16, collect: 0.1, activate: 0.08, bosshit: 0.63, death: 0.1, levelup: 0.08,
    checkpoint: 0.1, hazard: 0.1, thunder: 0.3, shoot: 0.06, shatter: 0.07, laser: 0.045, thud: 0.4, error: 0.05 };
  const SFX = {
    flap(e, t) {           // leises Flügelrauschen
      const c = e.c, s = noise(e, e.white, t, 0.16), f = F(c, 'bandpass', 600, 1.1), g = G(c, 0, e.sfx), r = 0.9 + 0.2 * e.rng();
      f.frequency.setValueAtTime(480 * r, t);
      f.frequency.exponentialRampToValueAtTime(1400 * r, t + 0.08);
      s.connect(f); f.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(LS.flap, t + 0.014);
      targetAt(g.gain, LS.flap, 0, t + 0.035, 0.03);
      return t + 0.16;
    },
    pipe(e, t, k) {        // zwei helle Glockentöne: Quinte, dann Oktave
      bell(e, hz(kNote(k, 7, 66)), t, LS.pipe * 0.75, 0.1, e.sfx);
      return bell(e, hz(kNote(k, 12, 66)), t + 0.06, LS.pipe, 0.18, e.sfx);
    },
    ceiling(e, t) {        // weiches Abprallen
      tone(e, 'triangle', 240, t, 0.003, LS.ceiling, 0.05, e.sfx, 150, 0.08);
      hit(e, e.sfx, e.white, t, 'bandpass', 1800, 1.5, LS.ceiling * 0.35, 0.001, 0.012);
      return t + 0.4;
    },
    collect(e, t, k) {     // schnelles aufsteigendes Arpeggio
      let end = t;
      [0, 4, 7, 12].forEach((s, i) => {
        const f = hz(kNote(k, s, 72));
        end = tone(e, 'triangle', f, t + i * 0.045, 0.003, LS.collect, 0.09, e.sfx);
        tone(e, 'sine', f * 2, t + i * 0.045, 0.003, LS.collect * 0.3, 0.06, e.sfx);
      });
      return end;
    },
    activate(e, t, k) {    // aufsteigender Klang mit sich öffnendem Filter
      const c = e.c, f0 = hz(kNote(k, 0, 54)), g = G(c, 0, e.sfx), lp = F(c, 'lowpass', 350, 6, g);
      lp.frequency.setValueAtTime(350, t);
      lp.frequency.exponentialRampToValueAtTime(4200, t + 0.22);
      const stop = envHold(g.gain, t, LS.activate, 0.02, 0.6, 0.1, t + 0.22, 0.08);
      for (const det of [-10, 10]) osc(c, 'sawtooth', f0, t, stop, lp, det).frequency.exponentialRampToValueAtTime(f0 * 2, t + 0.2);
      tone(e, 'sine', hz(kNote(k, 7, 78)), t + 0.16, 0.004, LS.activate * 0.7, 0.14, e.sfx);
      return tone(e, 'sine', hz(kNote(k, 12, 78)), t + 0.2, 0.004, LS.activate * 0.6, 0.2, e.sfx);
    },
    bosshit(e, t, k) {     // Treffer am Boss: dumpfer Schlag, heller Knall, kurzer fallender Ton
      thump(e, e.sfx, t, 150, 55, 16, LS.bosshit, 0.09);
      hit(e, e.sfx, e.white, t, 'bandpass', 1500, 0.9, LS.bosshit * 0.3, 0.001, 0.03);
      const f0 = hz(kNote(k, 0, 66));
      tone(e, 'triangle', f0 * 2, t, 0.003, LS.bosshit * 0.18, 0.1, e.sfx, f0 * 1.5, 0.12);
      tone(e, 'triangle', f0 * 3, t, 0.003, LS.bosshit * 0.12, 0.08, e.sfx, f0 * 2.25, 0.12);
      return t + 0.7;
    },
    death(e, t) {          // fallender Klang mit sich schließendem Filter und dumpfem Aufprall
      const c = e.c, g = G(c, 0, e.sfx), lp = F(c, 'lowpass', 2200, 3, g);
      lp.frequency.setValueAtTime(2200, t);
      lp.frequency.exponentialRampToValueAtTime(260, t + 0.6);
      const stop = envHold(g.gain, t, LS.death, 0.01, 0.8, 0.3, t + 0.5, 0.12);
      osc(c, 'sawtooth', 520, t, stop, lp).frequency.exponentialRampToValueAtTime(95, t + 0.6);
      osc(c, 'triangle', 260, t, stop, lp).frequency.exponentialRampToValueAtTime(48, t + 0.6);
      thump(e, e.sfx, t, 120, 50, 12, LS.death * 3, 0.1);
      return stop;
    },
    levelup(e, t, k) {     // kleine Fanfare aus Grundton, Quinte, Oktave, dann ein Schlussklang mit Hall
      const c = e.c, ns = [0, 7, 12, 19];
      ns.forEach((s, i) => {
        const f = hz(kNote(k, s, 66));
        tone(e, 'triangle', f, t + i * 0.09, 0.004, LS.levelup, 0.16, e.sfx);
        tone(e, 'sine', f * 2, t + i * 0.09, 0.004, LS.levelup * 0.35, 0.12, e.sfx);
      });
      const t2 = t + ns.length * 0.09, g = G(c, 0, e.sfx);
      g.connect(G(c, 0.5, e.revIn));
      const stop = envHold(g.gain, t2, LS.levelup * 0.8, 0.02, 0.7, 0.3, t2 + 0.5, 0.35);
      for (const s of [12, 19, 24]) osc(c, 'triangle', hz(kNote(k, s, 66)), t2, stop, g);
      return stop;
    },
    checkpoint(e, t, k) {  // drei Glockentöne aufwärts
      const c = e.c, bus = G(c, 1, e.sfx);
      bus.connect(G(c, 0.35, e.revIn));
      let end = t;
      [0, 7, 12].forEach((s, i) => { end = bell(e, hz(kNote(k, s, 72)), t + i * 0.11, LS.checkpoint, i === 2 ? 0.4 : 0.18, bus); });
      return end;
    },
    hazard(e, t) {         // tiefes, leises Warnen
      tone(e, 'sine', 160, t, 0.01, LS.hazard, 0.1, e.sfx, 90, 0.25);
      hit(e, e.sfx, e.white, t, 'lowpass', 500, 0, LS.hazard * 0.5, 0.05, 0.08);
      return t + 0.8;
    },
    thunder(e, t) { return thunder(e, e.sfx, t, LS.thunder, 2.6); },
    shoot(e, t) { return tone(e, 'triangle', 820, t, 0.003, LS.shoot, 0.05, e.sfx, 280, 0.1); },
    shatter(e, t, k) {
      hit(e, e.sfx, e.white, t, 'highpass', 3500, 0, LS.shatter, 0.001, 0.04);
      [12, 19, 24].forEach((s, i) => tone(e, 'sine', hz(kNote(k, s, 72)), t + 0.02 + i * 0.03, 0.002, LS.shatter * 0.45, 0.05, e.sfx));
      return t + 0.5;
    },
    laser(e, t) {
      const c = e.c, g = G(c, 0, e.sfx), bp = F(c, 'bandpass', 1300, 2, g), stop = envHold(g.gain, t, LS.laser, 0.02, 0.8, 0.2, t + 0.3, 0.06);
      const o = osc(c, 'sawtooth', 190, t, stop, bp), lg = G(c, 60);
      lg.connect(o.detune);
      osc(c, 'sine', 24, t, stop, lg);
      return stop;
    },
    thud(e, t) { return thump(e, e.sfx, t, 110, 55, 12, LS.thud, 0.08); },
    error(e, t) {
      const lp = F(e.c, 'lowpass', 1600, 0, e.sfx);
      tone(e, 'square', 330, t, 0.004, LS.error, 0.05, lp);
      return tone(e, 'square', 247, t + 0.09, 0.004, LS.error, 0.07, lp);
    }
  };
  // Mindestabstand gleicher Geräusche (s) und höchstens gleichzeitig klingende Geräusche
  const SFX_GAP = { flap: 0.05, pipe: 0.05, ceiling: 0.12, collect: 0.1, activate: 0.1, bosshit: 0.08, death: 0.3, levelup: 0.4,
    checkpoint: 0.3, hazard: 0.12, thunder: 0.35, shoot: 0.07, shatter: 0.08, laser: 0.12, thud: 0.1, error: 0.15 };
  const SFX_PRIO = { death: 1, levelup: 1, bosshit: 1, checkpoint: 1, collect: 1, activate: 1 };
  const SFX_MAX = 10, sfxLast = {}, sfxEnds = [];
  function playSfx(name) {
    if (simOn() || !E || !enabled || !unlocked || hidden || !SFX[name]) return;
    const now = E.c.currentTime;
    if (now - (sfxLast[name] === undefined ? -9 : sfxLast[name]) < (SFX_GAP[name] || 0.05)) return;
    for (let i = sfxEnds.length - 1; i >= 0; i--) if (sfxEnds[i] < now) sfxEnds.splice(i, 1);
    if (sfxEnds.length >= SFX_MAX + (SFX_PRIO[name] ? 4 : 0)) return;
    sfxLast[name] = now;
    sfxEnds.push(SFX[name](E, now + 0.005, keyFor(want)) || now + 0.5);
  }

  // ---------- Abspielen in Echtzeit ----------
  function init() {
    if (ac || !AC || simOn()) return;
    try {
      ac = new AC();
      E = buildEngine(ac, (Math.random() * 4294967296) >>> 0);
      timer = setInterval(tick, TICK_MS);
    } catch (e) { ac = null; E = null; }
  }
  function resume() {
    if (!ac || hidden || ac.state === 'running') return;
    try { const r = ac.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* später erneut */ }
  }
  // iOS: ein stiller Puffer innerhalb der Nutzergeste schaltet die Ausgabe frei (einmalig)
  function kick() {
    if (kicked || !ac) return;
    kicked = true;
    try { const b = ac.createBuffer(1, 1, ac.sampleRate), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) { /* egal */ }
  }
  function suspendLater() {
    setTimeout(() => {
      if (!ac || (enabled && !hidden) || ac.state !== 'running') return;
      try { const r = ac.suspend(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* egal */ }
    }, 400);
  }
  function tick() {
    if (!E || simOn()) return;
    const now = E.c.currentTime, horizon = now + LOOKAHEAD;
    for (const p of players) {
      const sd = p.song.stepDur;
      if (p.next < now - 0.3) {        // zu weit zurück (Seite war blockiert): ohne Nachholen weiter
        const k = Math.ceil((now - p.next) / sd);
        p.step = (p.step + k) % p.song.steps;
        p.next += k * sd;
      }
      while (p.next < horizon && p.next < p.end) {
        const sw = (p.step & 1) ? p.def.swing * sd : 0;
        scheduleStep(E, p, p.step, Math.max(p.next + sw, now));
        p.step = (p.step + 1) % p.song.steps;
        p.next += sd;
      }
    }
    for (let i = players.length - 1; i >= 0; i--) if (players[i].dying && now > players[i].kill) { dispose(players[i]); players.splice(i, 1); }
  }
  function startTrack(id) {
    if (!E) return;
    if (cur && cur.id === id && !cur.dying) return;
    const now = E.c.currentTime;
    for (const p of players) if (!p.dying) stopPlayer(p, now, XFADE);
    cur = null;
    if (id) {
      const p = makePlayer(E, getSong(id), now + 0.04);
      fadeTo(p, now, 1, XFADE);
      players.push(p);
      cur = p;
    }
    // sehr schnelle Wechsel: praktisch unhörbare Spuren sofort entfernen, höchstens drei ausblendende
    for (let i = players.length - 1; i >= 0; i--) {
      const p = players[i], n = players.filter(q => q.dying).length;
      if (p.dying && (levelAt(p, now) < 0.05 || n > 3)) { dispose(p); players.splice(i, 1); }
    }
    tick();
  }
  // geglätteter Regler: aktuellen Wert aus der laufenden Zielfahrt berechnen, verankern, neues Ziel
  function smoothTo(s, to, now, tau) {
    const v = s.tau > 0 ? s.to + (s.v - s.to) * Math.exp(-Math.max(0, now - s.t) / s.tau) : s.to;
    if (Math.abs(v - to) < 1e-6 && Math.abs(s.to - to) < 1e-6) return;
    s.prm.cancelScheduledValues(now);
    targetAt(s.prm, v, to, now, tau);
    s.v = v; s.to = to; s.t = now; s.tau = tau;
  }
  function apply() {
    if (!E) return;
    const now = E.c.currentTime, on = enabled && unlocked && !hidden && !simOn();
    smoothTo(E.sm.out, on ? MASTER * vol * vol : 0, now, 0.06);
    smoothTo(E.sm.music, ducked ? DUCK_GAIN : 1, now, 0.08);
    smoothTo(E.sm.duck, ducked ? DUCK_FREQ : OPEN_FREQ, now, 0.1);
    if (on && (!cur || cur.id !== want)) startTrack(want);
  }

  const api = {
    get enabled() { return enabled; },
    get available() { return !!AC; },
    get track() { return cur ? cur.id : null; },
    get wanted() { return want; },
    // Bei jeder Nutzereingabe aufgerufen; erst hier darf der AudioContext entstehen oder weiterlaufen
    unlock() {
      if (simOn() || !AC || !enabled) return;
      if (unlocked && ac && ac.state === 'running') return;
      init();
      if (!ac) return;
      unlocked = true;
      resume();
      kick();
      apply();
    },
    setTrack(id) {
      want = id;
      if (simOn()) return;
      if (E && enabled && unlocked && !hidden) startTrack(id);
    },
    // Stumm schalten und wieder an, kommt immer aus einer Nutzereingabe
    toggle() {
      if (simOn()) return;
      enabled = !enabled;
      try { WIN.localStorage.setItem(CONFIG.MUSIC_KEY, enabled ? '1' : '0'); } catch (e) { /* ohne Speicher */ }
      if (enabled) {
        init();
        if (!ac) return;
        unlocked = true;
        resume();
        kick();
        apply();
        return;
      }
      if (!E) return;
      apply();
      const now = E.c.currentTime;
      for (const p of players) if (!p.dying) stopPlayer(p, now, 0.25);
      cur = null;
      suspendLater();
    },
    duck(on) {
      on = !!on;
      if (ducked === on) return;
      ducked = on;
      apply();
    },
    setVolume(v) {
      v = +v;
      if (!Number.isFinite(v)) return;
      vol = clamp(v, 0, 1);
      apply();
    },
    visibility(isHidden) {
      hidden = !!isHidden;
      if (!E) return;
      if (hidden) { apply(); suspendLater(); return; }
      if (enabled && unlocked && !simOn()) { resume(); apply(); }
    },
    // Für Tests: Stück (und optional Geräusche) in einen beliebigen, auch Offline-Kontext rendern.
    // opts: volume (Standard 1), fromStep, only (['lead', 'pad', 'bass', 'boss', 'perc']), sfx ([{name, t}]),
    // duck, events ([{t, v, ...}] statt des Stücks), raw (ohne Kompressor und Begrenzer, für Messungen)
    renderInto(ctx2, id, seconds, opts) {
      opts = opts || {};
      const e = buildEngine(ctx2, opts.seed || 777, opts.raw), v = opts.volume === undefined ? 1 : opts.volume;
      e.out.gain.value = MASTER * v * v;
      if (opts.duck) { e.music.gain.value = DUCK_GAIN; e.duck.frequency.value = DUCK_FREQ; }
      let song = null;
      if (id) {
        song = getSong(id);
        const p = makePlayer(e, song, 0), sd = song.stepDur;
        p.fader.gain.value = p.trim;
        p.wetFader.gain.value = p.trim;
        if (opts.events) for (const ev of opts.events) playEvent(e, p, ev.t, ev, sd);
        else {
          let only = null;
          if (opts.only) { only = {}; for (const k of opts.only) only[k] = true; }
          for (let i = 0, t = opts.start === undefined ? 0.05 : opts.start; t < seconds; i++, t += sd) {
            const step = ((opts.fromStep || 0) + i) % song.steps;
            scheduleStep(e, p, step, t + ((step & 1) ? song.def.swing * sd : 0), only);
          }
        }
      }
      if (opts.sfx) for (const s of opts.sfx) if (SFX[s.name]) SFX[s.name](e, s.t, keyFor(s.key || id || 'menu'));
      return song;
    },
    getSong,
    sfx: playSfx,
    _tick: () => tick(),
    _debug: () => ({ ac, E, players: players.slice(), cur, unlocked, hidden, ducked, vol, enabled, sfxLive: sfxEnds.length }),
    _levels: { LV, LS }
  };
  return api;
})();
document.addEventListener('visibilitychange', () => Music.visibility(!!document.hidden));

// Geräusch abspielen; vor der ersten Eingabe, stumm oder im Autotest wirkungslos
function sfx(name) { Music.sfx(name); }

