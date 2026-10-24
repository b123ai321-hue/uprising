// UPRISING sfx2.js: Rally messaging sounds (0.5.0a). Rides on sfx.js's audio context + SFX volume bus.
// SFX2.rallyLands()   message lands: two rising radio blips + a warm major-third swell.
// SFX2.rallyBackfires() message backfires: a sour falling minor-second buzz + static crackle.
// Alliance/economy: allianceFormed, allianceBroken, tradeIncome, shortage, budgetLow, bankruptUnrest.
// Safe: silently does nothing if sfx.js is missing, audio isn't unlocked yet, or SFX is muted.
const SFX2 = (() => {
  let last = 0;
  function ready() {
    const S = window.SFX; if (!S || !S.ctx || S.ctx.state !== 'running' || (S.isMuted && S.isMuted('master'))) return null;
    const c = S.ctx, now = c.currentTime; if (now - last < 0.06) return null; last = now;
    const out = S.bus && S.bus('sfx'); return out ? { c, out, t: now + 0.01 } : null;
  }
  function tone(x, t, f, f2, v, a, len, type) {
    const o = x.c.createOscillator(), g = x.c.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); // attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);                     // decay
    o.connect(g); g.connect(x.out); o.start(t); o.stop(t + len + 0.05);
  }
  function hiss(x, t, v, len, f) {
    const n = Math.floor(x.c.sampleRate * len), b = x.c.createBuffer(1, n, x.c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.2);
    const s = x.c.createBufferSource(), fl = x.c.createBiquadFilter(), g = x.c.createGain();
    s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 1.2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl); fl.connect(g); g.connect(x.out); s.start(t);
  }
  const api = {
    rallyLands() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 880, 0, 0.18, 0.005, 0.07, 'square'); tone(x, t + 0.09, 1175, 0, 0.18, 0.005, 0.08, 'square');
      tone(x, t + 0.18, 262, 0, 0.22, 0.08, 0.9, 'triangle'); tone(x, t + 0.18, 330, 0, 0.18, 0.1, 0.9, 'triangle');
      tone(x, t + 0.22, 392, 0, 0.12, 0.12, 0.8); return true; },
    rallyBackfires() { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.25, 0.25, 1800);
      tone(x, t + 0.05, 220, 150, 0.2, 0.01, 0.7, 'sawtooth'); tone(x, t + 0.05, 233, 158, 0.16, 0.01, 0.7, 'sawtooth');
      tone(x, t + 0.05, 55, 45, 0.3, 0.01, 0.6); return true; },
    // 0.5.0b: factions, leaders, persecution (all under 1.2 s, peaks under 0.6)
    factionJoin() { const x = ready(); if (!x) return false; const t = x.t;
      [196, 247, 294, 392].forEach((f, i) => tone(x, t + i * 0.07, f, 0, 0.12, 0.02, 0.7, 'triangle')); return true; },
    factionSplit() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 330, 300, 0.14, 0.01, 0.8, 'triangle'); tone(x, t, 330, 362, 0.14, 0.01, 0.8, 'triangle'); hiss(x, t + 0.3, 0.12, 0.3, 900); return true; },
    factionBetray() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 392, 0, 0.14, 0.005, 0.15, 'square'); tone(x, t + 0.16, 370, 0, 0.14, 0.005, 0.15, 'square');
      tone(x, t + 0.32, 277, 0, 0.16, 0.01, 0.8, 'sawtooth'); tone(x, t + 0.32, 69, 0, 0.3, 0.01, 0.8); return true; },
    leaderCaptured() { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.3, 0.08, 3000); tone(x, t, 120, 60, 0.35, 0.002, 0.25); tone(x, t + 0.3, 233, 0, 0.12, 0.05, 0.8, 'triangle'); return true; },
    leaderLost() { const x = ready(); if (!x) return false; const t = x.t;
      [0, 0.45].forEach((d) => tone(x, t + d, 98, 0, 0.28, 0.01, 0.6)); tone(x, t + 0.1, 196, 185, 0.08, 0.2, 1.1, 'triangle'); return true; },
    crackdown() { const x = ready(); if (!x) return false; const t = x.t;
      [0, 0.18, 0.36].forEach((d) => { hiss(x, t + d, 0.22, 0.1, 400); tone(x, t + d, 70, 50, 0.3, 0.002, 0.15); });
      tone(x, t + 0.5, 466, 440, 0.07, 0.05, 0.6, 'sawtooth'); return true; },
    // 0.6.0 Security screen
    secToggle(on) { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.2, 0.03, 2500); tone(x, t, on ? 520 : 390, on ? 780 : 260, 0.12, 0.003, 0.09, 'square'); return true; },
    sensorAlarm(level) { const x = ready(); if (!x) return false; const t = x.t, n = Math.max(1, Math.min(3, level | 0 || 1));
      for (let i = 0; i < n; i++) { tone(x, t + i * 0.22, 988, 0, 0.1, 0.005, 0.12, 'square'); tone(x, t + i * 0.22 + 0.11, 740, 0, 0.1, 0.005, 0.1, 'square'); } return true; },
    detectRoll(caught) { const x = ready(); if (!x) return false; const t = x.t;
      for (let i = 0; i < 6; i++) hiss(x, t + i * 0.06, 0.12, 0.03, 1500 + i * 300);
      if (caught) { tone(x, t + 0.4, 147, 139, 0.25, 0.01, 0.7, 'sawtooth'); tone(x, t + 0.4, 156, 147, 0.2, 0.01, 0.7, 'sawtooth'); }
      else { tone(x, t + 0.4, 523, 0, 0.12, 0.01, 0.4, 'triangle'); tone(x, t + 0.5, 659, 0, 0.1, 0.01, 0.4, 'triangle'); } return true; },
    cellBusted() { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.3, 0.6, 1200); tone(x, t, 1200, 200, 0.12, 0.005, 0.5, 'sawtooth'); tone(x, t + 0.1, 60, 40, 0.3, 0.005, 0.5); return true; },
    // 0.6.x Foreign powers
    dealOffer() { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.15, 0.12, 2200); [0, 0.08, 0.16].forEach((d) => tone(x, t + 0.12 + d, 1320, 0, 0.08, 0.003, 0.05, 'square')); return true; },
    dealAccept() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 90, 50, 0.3, 0.002, 0.2); tone(x, t + 0.12, 392, 0, 0.12, 0.03, 0.7, 'triangle'); tone(x, t + 0.12, 587, 0, 0.1, 0.05, 0.7, 'triangle'); return true; },
    dealRefuse() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 330, 247, 0.14, 0.01, 0.35, 'square'); tone(x, t + 0.05, 65, 0, 0.25, 0.005, 0.3); return true; },
    stanceShift(up) { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, up ? 294 : 440, up ? 440 : 294, 0.12, 0.05, 0.6, 'triangle'); return true; },
    // After the revolt
    invasionAlert() { const x = ready(); if (!x) return false; const t = x.t;
      [0, 0.3, 0.6].forEach((d) => tone(x, t + d, 55, 0, 0.32, 0.01, 0.35)); tone(x, t, 220, 233, 0.08, 0.3, 1.1, 'sawtooth'); return true; },
    sanctionHit() { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.2, 0.15, 3200); tone(x, t + 0.05, 600, 150, 0.1, 0.005, 0.6, 'square'); tone(x, t + 0.1, 49, 0, 0.25, 0.01, 0.5); return true; },
    threatLevel(lvl) { const x = ready(); if (!x) return false; const t = x.t, f = lvl === 'war' ? 147 : lvl === 'tense' ? 196 : 262;
      tone(x, t, f, 0, 0.14, 0.04, 0.8, 'triangle'); tone(x, t, f * (lvl === 'calm' ? 1.5 : 1.06), 0, 0.1, 0.06, 0.8, 'triangle'); return true; },
    // Alliances + economy (short, quiet, muted)
    allianceFormed() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 294, 0, 0.1, 0.02, 0.5, 'triangle'); tone(x, t + 0.12, 370, 0, 0.1, 0.02, 0.6, 'triangle'); tone(x, t + 0.12, 440, 0, 0.05, 0.05, 0.6); return true; },
    allianceBroken() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 311, 0, 0.1, 0.01, 0.4, 'triangle'); tone(x, t + 0.16, 294, 280, 0.1, 0.01, 0.6, 'triangle'); return true; },
    tradeIncome() { const x = ready(); if (!x) return false; const t = x.t;
      hiss(x, t, 0.06, 0.02, 4000); tone(x, t, 1760, 0, 0.05, 0.002, 0.08); tone(x, t + 0.05, 2349, 0, 0.035, 0.002, 0.08); return true; },
    shortage() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 80, 50, 0.22, 0.004, 0.3); hiss(x, t + 0.02, 0.05, 0.35, 700); return true; },
    budgetLow() { const x = ready(); if (!x) return false; const t = x.t;
      [0, 0.32].forEach((d) => tone(x, t + d, 110, 0, 0.12, 0.03, 0.25, 'triangle')); return true; },
    bankruptUnrest() { const x = ready(); if (!x) return false; const t = x.t;
      tone(x, t, 98, 46, 0.22, 0.01, 0.9); tone(x, t, 104, 49, 0.1, 0.02, 0.9, 'sawtooth');
      for (let i = 0; i < 4; i++) hiss(x, t + 0.15 + i * 0.09, 0.07, 0.05, 1200 + i * 250); return true; }
  };
  return api;
})();
window.SFX2 = SFX2;
