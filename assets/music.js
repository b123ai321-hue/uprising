// UPRISING music: one procedural tense loop ("war room"), original, synthesized live in Web Audio. No MP3.
// Low drone (2 detuned sines), muted pulse (filtered sine thumps), sparse dissonant piano/string notes
// (sines with soft envelopes), faint radio texture (band-passed noise). intensity(0..1) adds pulse density,
// opens the filter, and brings in a high string layer and more piano notes.
// Use: Music.unlock() (SFX does this on the first tap), Music.play(), Music.stop(), Music.setVolume(0..1), Music.intensity(x).
// Scheduler: one setTimeout every 0.5 s schedules the next bar ahead (look-ahead pattern from the Sengoku loop player).
// CPU: ~3 always-on nodes + about 2-8 short notes per second; nothing runs while stopped or suspended.
const Music = (() => {
  let ac = null, out = null, on = false, I = 0, timer = 0, next = 0, step = 0, L = null, wantPlay = false;
  const BPM = 66, SP = 60 / BPM / 2;           // 8th-note step
  const ROOT = 55;                              // A1
  // piano note pool: semitones over A3, minor + b2 + tritone for unease
  const POOL = [0, 1, 3, 6, 7, 10, 12, 13, 15];
  const hz = (s) => 220 * Math.pow(2, s / 12);
  function ctx() { if (ac) return ac; const X = window.SFX;
    if (X && X.unlock && !X.ctx) { X.unlock(); if (ac) return ac; }   // SFX owns the shared context
    ac = (X && X.ctx) || window.AC || null;
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = window.AC = new C(); }
    out = (window.SFX && SFX.bus && SFX.bus('music')) || (() => { const g = ac.createGain(); g.gain.value = 0.6; g.connect(ac.destination); return g; })();
    return ac; }
  let nb = null;
  function noiseBuf(c) { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  // continuous layer: drone + radio texture + string pad, into a master lowpass
  function layers(c, dest, t) {
    const lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 3); lp.connect(g); g.connect(dest);
    const osc = (f, v, to) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(to); o.start(t); return { o, og }; };
    const d1 = osc(ROOT, 0.35, lp), d2 = osc(ROOT * 1.006, 0.3, lp), d3 = osc(ROOT * 1.5, 0.08, lp);
    // slow LFO makes the drone simmer
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t);
    const str = osc(hz(13), 0, g), str2 = osc(hz(18), 0, g);  // high dissonant string pair (b9 + 11), off at intensity 0
    if (!nb || nb.sampleRate !== c.sampleRate) nb = noiseBuf(c);
    const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = nb; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.5; ng.gain.value = 0.012;
    n.connect(bp); bp.connect(ng); ng.connect(dest); n.start(t);
    return { lp, g, str, str2, ng, nodes: [d1.o, d2.o, d3.o, lfo, str.o, str2.o, n] };
  }
  function setI(Lr, c, x, t) { if (!Lr) return;
    Lr.lp.frequency.setTargetAtTime(420 + 900 * x, t, 1.5);
    Lr.str.og.gain.setTargetAtTime(0.025 * x, t, 2); Lr.str2.og.gain.setTargetAtTime(0.018 * x * x, t, 2);
    Lr.ng.gain.setTargetAtTime(0.01 + 0.012 * x, t, 1.5); }
  function note(c, dest, t, f, v, a, len) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.05); }
  // one 8th-note step of the pattern (16 steps per bar, 4-bar loop with variation from the step counter)
  function beat(c, dest, t, s, x) {
    const p = s % 16;
    if (p === 0 || p === 8 || (x > 0.35 && (p === 4 || p === 12)) || (x > 0.75 && p % 2 === 0)) {   // muted pulse
      note(c, dest, t, 52, 0.22 + 0.1 * x, 0.005, 0.28); note(c, dest, t, 104, 0.04, 0.003, 0.08); }
    if (x > 0.5 && (p === 7 || p === 15)) note(c, dest, t, 49, 0.12, 0.005, 0.2);                   // ghost pulse
    if (Math.random() < 0.06 + 0.16 * x && p % 2 === 1 || p === 3 && s % 64 === 3) {                // sparse piano
      const f = hz(POOL[(Math.random() * POOL.length) | 0]); note(c, dest, t, f, 0.05, 0.004, 1.8); note(c, dest, t, f * 2.01, 0.012, 0.004, 0.7); }
  }
  function sched() { if (!on) return; const t = ac.currentTime;
    while (next < t + 1) { beat(ac, out, next, step++, I); next += SP; }
    timer = setTimeout(sched, 500); }
  const api = {
    unlock() { if (!ctx()) return; if (ac.state === 'suspended') ac.resume(); if (wantPlay && !on) api.play(); },
    play() { wantPlay = true; if (!ctx() || ac.state !== 'running' || on) return; on = true;
      const t = ac.currentTime + 0.05; L = layers(ac, out, t); setI(L, ac, I, t); next = t; step = 0; sched(); },
    stop(fade) { wantPlay = false; if (!on) return; on = false; clearTimeout(timer);
      const t = ac.currentTime, Lr = L; L = null; fade = fade == null ? 1.5 : fade;
      Lr.g.gain.setTargetAtTime(0.0001, t, fade / 4); Lr.ng.gain.setTargetAtTime(0.0001, t, fade / 4);
      Lr.nodes.forEach((n) => { try { n.stop(t + fade + 0.1); } catch (e) {} }); },
    setVolume(v) { if (window.SFX && SFX.setVolume) SFX.setVolume('music', v); else if (out) out.gain.value = v; },
    intensity(x) { if (x === undefined) return I; I = Math.max(0, Math.min(1, +x || 0)); if (L) setI(L, ac, I, ac.currentTime); return I; },
    get playing() { return on; },
    // offline test helper: render `secs` of the loop into any context (e.g. OfflineAudioContext)
    renderTo(c, dest, secs, x) { const Lr = layers(c, dest, 0); setI(Lr, c, x || 0, 0); let s = 0;
      for (let t = 0.05; t < secs; t += SP) beat(c, dest, t, s++, x || 0); },
  };
  return api;
})();
window.Music = Music;
