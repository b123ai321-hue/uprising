// UPRISING sound effects. Original, synthesized in code with Web Audio (sines + filtered noise; no samples).
// One shared AudioContext (also window.AC), created and unlocked on the first tap/key. Nothing plays before that.
// Use: SFX.play('tap') or SFX.tap(); SFX.unitMove('militia') / SFX.play('unitMove','militia'), SFX.season('winter'). Rate limit: >=60 ms between sounds, max 4 at once. Peaks < 0.6.
// Volume: SFX.setVolume('master'|'music'|'sfx', 0..1), SFX.mute(on, kind), SFX.toggle(), SFX.suspend(), SFX.resume().
// Unlock/limiter/envelope patterns adapted from Gravelight sfx.js.
const SFX = (() => {
  const K = 'uprising.audio', rnd = (a, b) => a + Math.random() * (b - a);
  let st; try { st = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  st = Object.assign({ master: 0.8, music: 0.6, sfx: 0.9, mMaster: 0, mMusic: 0, mSfx: 0 }, st || {});
  const save = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) {} };
  let ac = null, G = null, nb = null, last = -1, ends = [];
  const lvl = (k) => (st['m' + k[0].toUpperCase() + k.slice(1)] ? 0 : st[k]);
  function rig(c) { // master -> limiter-ish compressor -> out ; music + sfx buses
    const m = c.createGain(), comp = c.createDynamicsCompressor(), s = c.createGain(), mu = c.createGain();
    comp.threshold.value = -8; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.15;
    s.connect(m); mu.connect(m); m.connect(comp); comp.connect(c.destination);
    return { m, s, mu };
  }
  function apply() { if (!G) return; const t = ac.currentTime;
    G.m.gain.setTargetAtTime(lvl('master') * 0.7, t, 0.02); G.s.gain.setTargetAtTime(lvl('sfx'), t, 0.02); G.mu.gain.setTargetAtTime(lvl('music'), t, 0.02); }
  function noiseBuf(c) { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  function unlock() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = window.AC = new C(); G = rig(ac); nb = noiseBuf(ac); apply(); }
    if (ac.state === 'suspended') ac.resume();
    if (window.Music && Music.unlock) Music.unlock();
    return ac;
  }
  const first = () => { unlock(); ['pointerdown', 'touchend', 'keydown'].forEach((e) => removeEventListener(e, first, true)); };
  if (typeof addEventListener === 'function') ['pointerdown', 'touchend', 'keydown'].forEach((e) => addEventListener(e, first, true));

  // ---- building blocks (C = context, O = output, P/V = random pitch/volume for this play) ----
  let C, O, P = 1, V = 1;
  function env(g, t, v, a, len) { v *= V; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len); }
  // sine/tri tone, f -> f2 glide
  function tone(t, f, f2, v, a, len, type) { const o = C.createOscillator(), g = C.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f * P, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2 * P, t + len);
    env(g, t, v, a, len); o.connect(g); g.connect(O); o.start(t); o.stop(t + len + 0.02); }
  // filtered noise; ft = filter type, f -> f2 sweep
  function noise(t, v, a, len, ft, f, q, f2) { const s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain();
    s.buffer = nb; s.loop = true; fl.type = ft; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f * P, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2 * P, t + len); env(g, t, v, a, len);
    s.connect(fl); fl.connect(g); g.connect(O); s.start(t, Math.random() * 1.5); s.stop(t + len + 0.02); }
  const thud = (t, f, v, len) => { tone(t, f, f * 0.45, v, 0.004, len); noise(t, v * 0.5, 0.003, len * 0.6, 'lowpass', 300, 0.7, 80); };
  const tick = (t, f, v) => noise(t, v, 0.001, 0.03, 'bandpass', f, 6);
  const keys = (t, n, gap, v) => { for (let i = 0; i < n; i++) { const u = t + i * gap * rnd(0.7, 1.3); tick(u, rnd(2500, 4200), v); tone(u, 180, 0, v * 0.25, 0.001, 0.03, 'triangle'); } };
  const stat = (t, v, len) => noise(t, v, 0.005, len, 'bandpass', 1800, 0.8);
  const chord = (t, fs, v, a, len) => fs.forEach((f) => tone(t, f, 0, v / fs.length, a, len));

  // ---- sound recipes: (t) => schedules nodes; returned number = length in s ----
  const S = {
    tap: (t) => { tick(t, 3000, 0.25); tone(t, 900, 700, 0.08, 0.002, 0.05); return 0.06; },
    confirm: (t) => { tone(t, 440, 0, 0.14, 0.004, 0.12); tone(t + 0.07, 660, 0, 0.12, 0.004, 0.16); return 0.24; },
    cancel: (t) => { tone(t, 520, 330, 0.14, 0.004, 0.14); noise(t, 0.05, 0.002, 0.06, 'lowpass', 1200); return 0.15; },
    pinPlace: (t) => { tick(t, 1800, 0.3); thud(t, 160, 0.3, 0.12); return 0.13; },
    pinSelect: (t) => { tick(t, 2600, 0.22); tone(t, 1200, 0, 0.07, 0.002, 0.08); return 0.09; },
    panTick: (t) => { tick(t, 4500, 0.12); return 0.04; },
    teletype: (t) => { keys(t, 9, 0.045, 0.22); tone(t + 0.45, 1400, 0, 0.05, 0.002, 0.08); return 0.6; },
    intercept: (t) => { stat(t, 0.22, 0.25); tone(t + 0.05, 1000, 0, 0.06, 0.003, 0.08, 'square'); tone(t + 0.15, 1000, 0, 0.05, 0.003, 0.06, 'square'); return 0.28; },
    recruit: (t) => { noise(t, 0.12, 0.08, 0.35, 'bandpass', 500, 1.2, 900); tone(t, 330, 0, 0.1, 0.03, 0.35); tone(t + 0.1, 494, 0, 0.09, 0.03, 0.35); return 0.48; },
    cardPlay: (t) => { noise(t, 0.2, 0.004, 0.12, 'highpass', 2500, 0.7, 6000); thud(t + 0.08, 220, 0.14, 0.08); return 0.2; },
    wealth: (t) => { tick(t, 3200, 0.2); tick(t + 0.05, 2700, 0.18); tone(t + 0.09, 1568, 0, 0.08, 0.002, 0.25); noise(t + 0.1, 0.06, 0.01, 0.15, 'bandpass', 5000, 3); return 0.36; },
    armory: (t) => { noise(t, 0.25, 0.002, 0.07, 'bandpass', 1400, 4); thud(t + 0.06, 120, 0.25, 0.18); tick(t + 0.12, 2200, 0.15); return 0.26; },
    detectTick: (t) => { tick(t, 1500, 0.3); tone(t, 60, 0, 0.18, 0.005, 0.12); return 0.13; },
    detectSafe: (t) => { tone(t, 392, 0, 0.12, 0.02, 0.5); tone(t, 587, 0, 0.08, 0.04, 0.6); return 0.65; },
    detectHit: (t) => { tone(t, 233, 220, 0.16, 0.01, 0.7); tone(t, 247, 240, 0.12, 0.01, 0.7); thud(t, 70, 0.3, 0.4); return 0.72; },
    cellBusted: (t) => { stat(t, 0.25, 0.3); thud(t + 0.3, 55, 0.45, 0.6); tone(t + 0.32, 98, 92, 0.1, 0.02, 0.8); return 1.12; },
    linkExposed: (t) => { for (let i = 0; i < 3; i++) { tone(t + i * 0.16, 880 - i * 120, 0, 0.09, 0.003, 0.12, 'square'); stat(t + i * 0.16, 0.08, 0.05); } thud(t + 0.5, 80, 0.25, 0.3); return 0.82; },
    crackdown: (t) => { [0, 0.3, 0.6].forEach((d, i) => thud(t + d, 70 - i * 6, 0.38, 0.35)); tone(t, 110, 104, 0.1, 0.2, 1); return 1.02; },
    allianceReq: (t) => { tone(t, 1175, 0, 0.1, 0.003, 0.18); tone(t + 0.22, 1175, 0, 0.1, 0.003, 0.18); stat(t, 0.06, 0.4); return 0.42; },
    ping: (t) => { tone(t, 1320, 0, 0.12, 0.002, 0.3); return 0.3; },
    diploAccept: (t) => { chord(t, [262, 392, 523], 0.26, 0.02, 0.6); return 0.6; },
    diploDecline: (t) => { tone(t, 330, 0, 0.12, 0.01, 0.4); tone(t + 0.12, 311, 0, 0.12, 0.01, 0.5); return 0.62; },
    march: (t) => { for (let i = 0; i < 6; i++) noise(t + i * 0.13, 0.14 + (i % 2) * 0.05, 0.004, 0.09, 'lowpass', 500, 0.8); return 0.9; },
    clash: (t) => { for (let i = 0; i < 5; i++) { const u = t + rnd(0, 0.4); noise(u, 0.16, 0.002, 0.07, 'bandpass', rnd(900, 1800), 2); } thud(t, 90, 0.2, 0.3); return 0.6; },
    artillery: (t) => { thud(t, 45, 0.5, 0.9); noise(t + 0.05, 0.12, 0.1, 1.2, 'lowpass', 200, 0.7, 60); return 1.25; },
    airstrike: (t) => { noise(t, 0.1, 0.5, 0.7, 'bandpass', 1500, 2, 400); [0.7, 0.85, 1.05].forEach((d) => thud(t + d, 50, 0.4, 0.8)); return 1.9; },
    drone: (t) => { tone(t, 220, 210, 0.08, 0.2, 1.2, 'sawtooth'); noise(t, 0.04, 0.2, 1.2, 'bandpass', 900, 3); return 1.2; },
    missile: (t) => { noise(t, 0.12, 0.2, 0.8, 'highpass', 800, 0.7, 3000); thud(t + 0.85, 40, 0.5, 1); return 1.9; },
    rout: (t) => { tone(t, 196, 147, 0.14, 0.05, 0.9, 'triangle'); return 0.9; },
    escalate: (t) => { tone(t, 98, 0, 0.18, 0.02, 0.9); tone(t + 0.15, 104, 0, 0.14, 0.02, 0.9); noise(t, 0.08, 0.3, 0.6, 'lowpass', 300, 1, 1200); return 1.07; },
    phase: (t) => { chord(t, [131, 196, 247], 0.3, 0.05, 1.2); thud(t, 65, 0.3, 0.5); return 1.25; },
    insurrection: (t) => { thud(t, 55, 0.45, 0.8); chord(t + 0.1, [110, 165, 220, 262], 0.36, 0.15, 2); stat(t, 0.08, 0.3); return 2.1; },
    victory: (t) => { chord(t, [196, 294, 392], 0.3, 0.05, 0.6); chord(t + 0.45, [262, 392, 523, 659], 0.36, 0.1, 1.8); return 2.25; },
    defeat: (t) => { chord(t, [220, 262, 330], 0.28, 0.05, 0.7); chord(t + 0.5, [147, 175, 208], 0.3, 0.1, 1.8); stat(t + 2.1, 0.12, 0.2); return 2.3; },
    arrested: (t) => { thud(t, 60, 0.4, 0.4); noise(t + 0.25, 0.25, 0.002, 0.08, 'bandpass', 900, 3); tone(t + 0.4, 147, 139, 0.12, 0.05, 1.2); return 1.6; },
    heatWarn: (t) => { tone(t, 740, 0, 0.09, 0.003, 0.1, 'square'); tone(t + 0.18, 740, 0, 0.09, 0.003, 0.1, 'square'); return 0.3; },
    endWeek: (t) => { noise(t, 0.16, 0.01, 0.15, 'highpass', 1500, 0.7, 4000); thud(t + 0.1, 110, 0.2, 0.2); tick(t + 0.3, 2200, 0.2); return 0.36; },
    raid: (t) => { thud(t, 70, 0.4, 0.3); noise(t + 0.05, 0.2, 0.003, 0.25, 'bandpass', 2000, 1.5, 700); return 0.4; },
    // CHANGE 11 map units
    unitPick: (t) => { tick(t, 2400, 0.2); noise(t, 0.05, 0.002, 0.03, 'lowpass', 900); tone(t + 0.01, 620, 820, 0.06, 0.003, 0.07); return 0.09; },
    unitMove: (t, k) => { const m = k === 'militia'; noise(t, m ? 0.1 : 0.07, 0.03, 0.2, 'bandpass', m ? 700 : 1100, 1.2, m ? 400 : 650);
      if (m) for (let i = 0; i < 3; i++) noise(t + 0.03 + i * 0.06, 0.06, 0.005, 0.05, 'lowpass', 450, 0.8);
      tick(t + 0.22, m ? 1200 : 1700, 0.2); thud(t + 0.22, m ? 120 : 170, m ? 0.22 : 0.15, m ? 0.12 : 0.08); return 0.36; },
    unitDrop: (t) => { thud(t, 95, 0.22, 0.16); tone(t, 300, 220, 0.05, 0.004, 0.1); return 0.18; },
    noMoves: (t) => { tone(t, 247, 0, 0.1, 0.004, 0.09); tone(t + 0.11, 185, 0, 0.1, 0.004, 0.13); return 0.25; },
    enemySeen: (t) => { stat(t, 0.05, 0.08); tone(t + 0.02, 1050, 0, 0.04, 0.003, 0.05); tone(t + 0.04, 82, 0, 0.09, 0.03, 0.4); return 0.45; },
    // CHANGE 13 B1 defections, seasons, weather
    defect: (t) => { tone(t, 466, 0, 0.1, 0.004, 0.18, 'triangle'); tone(t + 0.16, 440, 0, 0.1, 0.004, 0.2, 'triangle'); tone(t + 0.34, 311, 294, 0.1, 0.01, 0.35, 'triangle'); stat(t + 0.4, 0.05, 0.4); return 0.82; },
    season: (t, k) => { k = k || 'autumn';
      if (k === 'winter') { tone(t, 1760, 0, 0.05, 0.05, 1.1); noise(t, 0.07, 0.4, 1.2, 'bandpass', 600, 3, 2400); return 1.25; }
      tick(t, 2200, 0.15); thud(t, 82, 0.15, 0.3);
      if (k === 'spring') { tone(t + 0.05, 392, 0, 0.1, 0.005, 0.6); tone(t + 0.3, 494, 0, 0.1, 0.005, 0.9); return 1.2; }
      if (k === 'summer') { chord(t + 0.05, [262, 330, 392, 523], 0.26, 0.01, 1.2); return 1.25; }
      tone(t + 0.05, 330, 0, 0.11, 0.005, 0.5); tone(t + 0.35, 277, 262, 0.11, 0.005, 0.9); return 1.25; },
    weather: (t, k) => { if (k === 'snow') { noise(t, 0.03, 0.5, 1.5, 'bandpass', 3000, 2, 1500); return 1.5; }
      noise(t, 0.04, 0.3, 1.5, 'highpass', 2500, 0.7);
      if (k === 'storm') { noise(t + 0.3, 0.07, 0.2, 1.2, 'lowpass', 150, 0.7, 50); tone(t + 0.3, 45, 0, 0.06, 0.2, 1.1); } return 1.5; },
    // 0.4.0 regime response: rung(1-5) police surge, riot+curfew, army pulled, reserves, conscription
    rung: (t, n) => { n = Math.min(5, Math.max(1, n | 0)); const f = 200 - n * 24, L = 0.4 + n * 0.17;
      tick(t, 1600 - n * 150, 0.14); tone(t, f, f * 0.95, 0.15, 0.01, L);
      for (let i = 1; i < n; i++) tone(t + i * 0.04, f * (1 + i * 0.06), 0, 0.08 / i, 0.03, L);
      if (n > 2) noise(t, 0.04 * n, 0.01, 0.07 * n, 'lowpass', 2400 - n * 300, 0.8, 300);
      if (n > 3) thud(t + 0.05, 52 - n * 2, 0.07 * n, 0.6); return L + 0.1; },
    deescalate: (t) => { tone(t, 147, 220, 0.12, 0.03, 0.45); tone(t + 0.15, 220, 294, 0.08, 0.06, 0.5); return 0.66; },
    faction: (t, k) => (F[String(k).toLowerCase()] || F.x)(t),
  };
  const F = { // regime faction motifs, < 0.8 s
    hardliners: (t) => { thud(t, 70, 0.3, 0.25); thud(t + 0.2, 62, 0.3, 0.3); tone(t, 117, 110, 0.08, 0.02, 0.5, 'triangle'); return 0.55; },
    moderates: (t) => { tone(t, 330, 0, 0.1, 0.03, 0.35); tone(t + 0.18, 392, 0, 0.09, 0.03, 0.45); return 0.65; },
    security: (t) => F['security chiefs'](t),
    'security chiefs': (t) => { stat(t, 0.1, 0.2); [0, 0.12, 0.24].forEach((d) => tone(t + d, 660, 0, 0.05, 0.003, 0.06, 'square')); tone(t, 82, 0, 0.1, 0.02, 0.5); return 0.52; },
    oligarchs: (t) => { tick(t, 3200, 0.15); tick(t + 0.06, 2800, 0.13); chord(t + 0.08, [147, 175, 220], 0.2, 0.03, 0.6); return 0.7; },
    x: (t) => { tick(t, 2000, 0.15); tone(t, 196, 185, 0.12, 0.01, 0.4); return 0.42; },
  };
  const names = Object.keys(S);
  // render into any context (used by tests with OfflineAudioContext); no limiter
  function render(name, c, out, t, a) { if (!S[name]) return 0; C = c; O = out; P = rnd(0.95, 1.05); V = rnd(0.85, 1.0);
    if (!nb || nb.sampleRate !== c.sampleRate) nb = noiseBuf(c); return S[name](t, a); }
  function play(name, a) {
    if (!ac || ac.state !== 'running' || !S[name] || !lvl('sfx') || !lvl('master')) return false;
    const t = ac.currentTime; ends = ends.filter((e) => e > t);
    if (t - last < 0.06 || ends.length >= 4) return false;
    last = t; ends.push(t + render(name, ac, G.s, t + 0.005, a) + 0.05); return true;
  }
  const api = {
    names, play, render, unlock,
    get ctx() { return ac; }, bus: (k) => G && (k === 'music' ? G.mu : G.s),
    setVolume(k, v) { if (typeof k === 'number') { v = k; k = 'sfx'; } st[k] = Math.max(0, Math.min(1, +v || 0)); save(); apply(); },
    getVolume: (k) => st[k || 'sfx'],
    mute(on, k) { k = k || 'master'; st['m' + k[0].toUpperCase() + k.slice(1)] = on === undefined ? 1 : on ? 1 : 0; save(); apply(); },
    isMuted: (k) => !!st['m' + (k || 'master')[0].toUpperCase() + (k || 'master').slice(1)],
    toggle() { api.mute(!st.mMaster, 'master'); return !st.mMaster; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
  names.forEach((n) => { api[n] = (a) => play(n, a); });
  return api;
})();
window.SFX = SFX;
