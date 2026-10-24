// game.js: screens, UI panels, input keys, save/load, pause, main loop, audio hooks.
// Load order: sfx.js, music.js, emberline-art.js, map.js, sim.js, then this file.
'use strict';
const GAME_TITLE = 'UPRISING';          // the ONE place the game name lives (it will be renamed)
const VER = 32;                          // bump with the ?v= cache-busters in index.html
const $ = id => document.getElementById(id);

// ---- Canvas/DPR (from the scaffold): cap 2 on touch, 1.5 on desktop ----
const IS_TOUCH = matchMedia('(pointer:coarse)').matches;
const DPR_CAP = IS_TOUCH ? 2 : 1.5;
const cv = $('map'); MapView.init(cv);
const tokCv = $('tok'); MapView.layers = [tokCv];   // unit token layer on top of the map

// ---- Save: localStorage can throw (private mode, full), so always try/catch ----
const SAVE_KEY = 'emberline.save.v1', UI_KEY = 'emberline.ui';
function saveNow() { if (!S) return false; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch (e) { return null; } }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// ---- Audio hook points (assets/AUDIO-HOOKUP.md). window.SFX / Music may be absent. ----
const snd = name => { if (window.SFX && SFX[name]) SFX[name](); };
const music = (fn, ...a) => { if (window.Music && Music[fn]) return Music[fn](...a); };
function musicIntensity() {
  if (!S) return; let x = Math.max((S.phase - 1) / 4 * 0.5, S.esc / 6) + (S.phase >= 4 ? 0.3 : 0);
  music('intensity', Math.min(1, x));
}

// ---- DOM diff cache: only touch the DOM when the HTML really changed ----
const _html = new Map();
function setHTML(el, h) { if (_html.get(el) !== h) { _html.set(el, h); el.innerHTML = h; } }

// ---- UI scale (+/- keys), 0.8 .. 2.0, saved ----
let uiScale = 1; try { uiScale = +localStorage.getItem(UI_KEY) || 1; } catch (e) {}
function setUI(v) { uiScale = Math.round(Math.max(0.8, Math.min(2, v)) * 10) / 10; document.documentElement.style.setProperty('--ui', uiScale); try { localStorage.setItem(UI_KEY, uiScale); } catch (e) {} resize(); }

// ================= DATA LOADING =================
let WORLD = null;                       // world.json: country outlines + launch list info
const loadJSON = u => fetch(u + '?v=' + VER).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });

// World scene: every country, launch countries bright, others greyed "coming later"
function makeWorldScene() {
  const C = WORLD.c.map(c => {
    const rings = c.g.map(dec).filter(r => r.length >= 6 && Math.min(...r.filter((_, i) => i % 2)) < 760);
    const path = new Path2D(); rings.forEach(r => ringPath(path, r));
    let big = rings[0] || [0, 0], bx = [1e9, 1e9, -1e9, -1e9];
    rings.forEach(r => { if (r.length > big.length) big = r; });
    for (let i = 0; i < big.length; i += 2) { bx[0] = Math.min(bx[0], big[i]); bx[1] = Math.min(bx[1], big[i + 1]); bx[2] = Math.max(bx[2], big[i]); bx[3] = Math.max(bx[3], big[i + 1]); }
    const L = WORLD.L[c.i];
    return { i: c.i, n: (L && L.n) || c.n, path, cx: (bx[0] + bx[2]) / 2, cy: (bx[1] + bx[3]) / 2, area: (bx[2] - bx[0]) * (bx[3] - bx[1]), ok: !!(L && L.ok), launch: !!L, dot: c.dot };
  });
  const hit = document.createElement('canvas').getContext('2d');
  return {
    kind: 'world', w: 1800, h: 760, C, sea: '#182024',
    drawStatic(g, tier, px) {
      g.fillStyle = '#1d2629'; g.fillRect(0, 0, 1800, 760);
      g.strokeStyle = 'rgba(200,190,160,.06)'; g.lineWidth = px;        // graticule every 15 degrees
      for (let x = 0; x <= 1800; x += 75) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 760); g.stroke(); }
      for (let y = 0; y <= 760; y += 75) { g.beginPath(); g.moveTo(0, y); g.lineTo(1800, y); g.stroke(); }
      for (const c of C) { g.fillStyle = c.ok ? '#6f6a48' : '#363b3b'; g.fill(c.path); }
      g.save(); g.fillStyle = g.createPattern(hatchCanvas(), 'repeat');
      for (const c of C) if (!c.ok) g.fill(c.path);                    // hatched = coming later
      g.restore();
      g.strokeStyle = '#15191a'; g.lineWidth = px * (tier ? 1.2 : 1);
      for (const c of C) g.stroke(c.path);
    },
    drawLive(g, v) {
      const px = 1 / (v.z * v.dpr), sel = C.find(c => c.i === UI.pick);
      if (sel) { g.strokeStyle = '#e8b04a'; g.lineWidth = 2.5 * px; g.stroke(sel.path); g.fillStyle = 'rgba(232,176,74,.25)'; g.fill(sel.path); }
      const labels = [];
      for (const c of C) {
        if (!c.launch) continue;
        if (c.dot) { g.fillStyle = c.i === UI.pick ? '#e8b04a' : '#cfc49a'; g.beginPath(); g.arc(c.cx, c.cy, 3 * px * v.dpr, 0, 7); g.fill(); }
        labels.push({ x: c.cx, y: c.cy, text: c.n, pri: c.area + (c.i === UI.pick ? 1e9 : 0), size: 11, color: c.ok ? '#efe6cf' : '#8c8f88' });
      }
      placeLabels(g, labels, v, px);
    },
    pick(x, y) {
      let best = null;
      for (const c of C) if (c.launch || true) { if (hit.isPointInPath(c.path, x, y)) best = c; }
      if (!best) { const r = 8 / MapView.z; best = C.find(c => c.dot && Math.hypot(c.cx - x, c.cy - y) < r) || null; }
      return best ? best.i : null;
    },
  };
}

// Country scene: provinces in 2 tiers + neighbours from world.json drawn in the same projection
function makeCountryScene(M) {
  const [x0, y1, k, s] = M.pr;
  const toLocal = r => { const o = []; for (let i = 0; i < r.length; i += 2) { const lon = r[i] / 5 - 180, lat = 90 - r[i + 1] / 5; o.push((lon - x0) * k * s, (y1 - lat) * s); } return o; };
  const nb = WORLD.c.filter(c => c.i !== M.i && !c.dot).map(c => { const p = new Path2D(); let cx = 0, cy = 0, n = 0;
    c.g.map(dec).forEach(r => { const l = toLocal(r); ringPath(p, l); for (let i = 0; i < l.length; i += 2) { cx += l[i]; cy += l[i + 1]; n++; } }); return { p, n: c.n, x: cx / n, y: cy / n }; })
    .filter(o => o.x > -800 && o.y > -800 && o.x < M.w + 800 && o.y < M.h + 800);
  // tiers[t][prov] = Path2D, rings[t][prov] = arrays of numbers
  const rings = M.t.map(tier => tier.map(pr => pr.map(dec)));
  const paths = rings.map(tier => tier.map(pr => { const p = new Path2D(); pr.forEach(r => ringPath(p, r)); return p; }));
  // Shared border segments: identical in both neighbours (coverage_simplify), so a hash finds them.
  const shared = rings.map(tier => {
    const seen = new Map(), out = [];
    tier.forEach((pr, pi) => pr.forEach(r => { for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length, a = r[i] + ',' + r[i + 1], b = r[j] + ',' + r[j + 1], key = a < b ? a + '|' + b : b + '|' + a;
      const o = seen.get(key); if (o === undefined) seen.set(key, pi); else if (o !== pi) out.push([o, pi, r[i], r[i + 1], r[j], r[j + 1]]);
    } }));
    return out;
  });
  const hit = document.createElement('canvas').getContext('2d');
  // 0.6.0 clean map: one side colour per province at 28% (cleanmap-mock.html palette)
  const fillOf = i => SIDE_COL[sideOf(i)];
  return {
    kind: 'country', w: M.w, h: M.h, sea: '#1a2226', paths, shared,
    land: (() => { const l = new Path2D(); paths[1].forEach(p => l.addPath(p)); return l; })(),   // all provinces = the land (winter tint clip)
    drawStatic(g, tier, px) {
      g.fillStyle = '#1a2226'; g.fillRect(-2000, -2000, M.w + 4000, M.h + 4000);
      g.fillStyle = '#2b302f'; g.strokeStyle = '#3c4241'; g.lineWidth = px * 1.5;
      nb.forEach(o => { g.fill(o.p); g.stroke(o.p); });
      paths[tier].forEach(p => { g.fillStyle = '#0b0e14'; g.fill(p); });                  // dark base so 28% reads the same everywhere
      g.save(); g.globalAlpha = 0.28; paths[tier].forEach((p, i) => { g.fillStyle = fillOf(i); g.fill(p); }); g.restore();
      g.strokeStyle = '#05070c'; g.lineWidth = px * (tier ? 2.2 : 1.6); paths[tier].forEach(p => g.stroke(p));   // dark border
    },
    drawCrisp(g, px) { g.strokeStyle = 'rgba(15,18,18,.9)'; g.lineWidth = px * 1.5; paths[1].forEach(p => g.stroke(p)); },
    drawLive(g, v, time) {
      const px = 1 / (v.z * v.dpr), tier = Math.min(1, v.tier), d = v.dpr;
      // selected province outline
      if (UI.hoverP >= 0 && UI.hoverP !== S.sel && paths[tier][UI.hoverP]) { g.strokeStyle = '#22e1ff'; g.lineWidth = 2 * px * d; g.stroke(paths[tier][UI.hoverP]); }   // 0.10.0 mouse hover
      if (S.sel >= 0) { g.strokeStyle = '#efe6cf'; g.lineWidth = 2.5 * px * d; g.stroke(paths[tier][S.sel]); }
      UI.frontAnim = this.drawFront(g, v, time);   // front line drawn with the map (one layer is cheapest at 4K)
      // 0.6.0 clean map: no numbers or stacked markers here; garrisons, dug-in and policies live in the tapped-province panel
      if (M.cap.xy) { const [x, y] = M.cap.xy; g.fillStyle = '#e4573a'; g.beginPath(); g.arc(x, y, 4 * px * d, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = px * d; g.stroke(); }
      // labels: capital first, then bigger provinces, then neighbour countries
      const L = [];
      const fs = 13 * labelK(); MapView.labelPx = fs;   // 13px bold names (labelPx: read by tests)
      const busy = drawEvIcons(g, v, fs).concat(drawIntentMarker(g, v, fs));   // icons + intent ring first, so names never land on them
      M.p.forEach((p, i) => L.push({ x: p.c[0], y: p.c[1], text: p.n, pri: p.r + (i === S.sel ? 1e6 : 0) + (UI.ev[i] ? 5e5 : 0), size: fs, bold: 1, color: '#e8ecf5' }));
      nb.forEach(o => L.push({ x: o.x, y: o.y, text: o.n.toUpperCase(), pri: -1, size: 10 * labelK(), color: '#6b7590' }));
      const taken = busy.concat((UI.popBoxes || []).map(b => b.map(q => q * d)));
      MapView.placed = placeLabels(g, L, v, px, taken).slice(taken.length); MapView.icons = busy;
      drawInvasion(g, v, MapView.placed.concat(busy));   // 0.9.0: after the labels, clipped around them   // names only / icon rects: read by tests   // placed rects: read by the overlap test
    },
    // FRONT LINE: shared segments where the owners differ; thick animated ink dashes
    drawFront(g, v, time) {
      const px = 1 / (v.z * v.dpr), tier = Math.max(0, Math.min(1, v.tier)), d = v.dpr; let any = false;
      g.beginPath();
      for (const sg of shared[tier]) if (S.P[sg[0]].o !== S.P[sg[1]].o) { g.moveTo(sg[2], sg[3]); g.lineTo(sg[4], sg[5]); any = true; }
      if (any) {
        g.lineCap = 'round'; g.strokeStyle = '#2a1410'; g.lineWidth = 6 * px * d; g.setLineDash([]); g.stroke();
        g.strokeStyle = '#d24a2a'; g.lineWidth = 3.5 * px * d; g.setLineDash([10 * px * d, 6 * px * d]); g.lineDashOffset = -(time / 60) * px * d; g.stroke(); g.setLineDash([]);
      }
      return any;
    },
    pick(x, y) { for (let i = 0; i < paths[1].length; i++) if (hit.isPointInPath(paths[1][i], x, y)) return i; return -1; },
  };
}
// NATO-style unit counter: box, infantry cross, strength number
function counter(g, x, y, s, bg, fg, n, lw) {
  g.fillStyle = bg; g.fillRect(x - s, y - s * 0.65, s * 2, s * 1.3);
  g.strokeStyle = fg; g.lineWidth = lw; g.strokeRect(x - s, y - s * 0.65, s * 2, s * 1.3);
  g.beginPath(); g.moveTo(x - s, y - s * 0.65); g.lineTo(x + s, y + s * 0.65); g.moveTo(x + s, y - s * 0.65); g.lineTo(x - s, y + s * 0.65); g.stroke();
  g.fillStyle = fg; g.font = `600 ${s * 1.1}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(n, x, y - s * 0.7);
}

// 0.6.0 clean map: side of a province. rebel = held; contested = fought over this week or on the front; regime = garrisoned; else neutral
const SIDE_COL = { rebel: '#00e5a0', regime: '#ff3b5c', contested: '#ffd84a', neutral: '#8a93a8' };
function sideOf(i) {
  const P = S.P[i]; if (UI.ev[i] === 'fight') return 'contested';
  if (P.o === 'P') return 'rebel';
  if (adjHeld(i) || cellsIn(i) > 0) return 'contested';
  return P.g > 0 ? 'regime' : 'neutral';
}
// one 28px event icon above the name: X fighting, arrow rally, ! alert (arrest, new policy). Returns screen rects taken.
function drawEvIcons(g, v, fs) {
  const d = v.dpr, r = 14 * labelK() * d, out = [];
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.lineCap = 'round';
  for (const k in UI.ev) { const t = UI.ev[k], c = MAP.p[k].c;
    const x = (c[0] * v.z + v.ox) * d, y = (c[1] * v.z + v.oy) * d - fs * d * 0.6 - r - 2 * d, a = r * 0.42;
    g.fillStyle = '#05070c'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = t === 'fight' ? '#ffd84a' : t === 'rally' ? '#00e5a0' : '#ff3b5c'; g.lineWidth = 2.5 * d; g.stroke(); g.beginPath();
    if (t === 'fight') { g.moveTo(x - a, y - a); g.lineTo(x + a, y + a); g.moveTo(x + a, y - a); g.lineTo(x - a, y + a); }
    else if (t === 'rally') { g.moveTo(x - a, y + a * 0.6); g.lineTo(x, y - a); g.lineTo(x + a, y + a * 0.6); }
    else { g.moveTo(x, y - a); g.lineTo(x, y + a * 0.25); g.moveTo(x, y + a * 0.75); g.lineTo(x, y + a * 0.8); }
    g.stroke(); out.push([x - r, y - r, x + r, y + r]); }
  g.restore(); return out;
}

// ================= UI STATE + RENDER =================
const UI = { hoverP: -1, ev: {}, screen: 'title', tab: 'map', pick: null, modal: null, frontAnim: false, battle: null, selU: null, tgt: -1, anim: new Map(), pops: [], drag: null, justGrabbed: false };
const wide = () => matchMedia('(min-width:1000px) and (min-aspect-ratio:4/3)').matches;
const pct = v => Math.round(v);
// 0.3.0a viewport clamp, the same one style.css uses for body text: 15px up to 2400px wide, 24px at 4K.
// uiK() = 1 on phone and 1080p, 1.6 at 4K. Map labels grow a bit faster (labelK = 2 at 4K → 22px).
const uiK = () => Math.min(24, Math.max(15, innerWidth * 0.00625)) / 15;
const labelK = () => 1 + (uiK() - 1) * 1.7;
const bar = (v, red) => `<div class="bar${red ? ' red' : ''}"><b style="width:${Math.max(0, Math.min(100, v))}%"></b></div>`;
// Upkeep warning chip (artist icon assets/warn.svg). Tapping it opens the money screen.
// The icon is Game Artist's canvas Warn.draw (assets/warn.js); pulse 0→1 as upkeep goes from 80% to 100% of income.
function warnChip() { const W = upkeepWarning(); return W ? `<button class="warn ${W.lvl}" data-tab="eco" title="${W.t}"><canvas class="warnCv" width="44" height="44" aria-hidden="true"></canvas>${W.lvl === 'red' ? 'Upkeep > income' : 'Upkeep high'}</button>` : ''; }
function drawWarnIcons() {
  const W = upkeepWarning(); if (!W || !window.Warn) return; firstTip('warn');
  const pulse = Math.max(0, Math.min(1, (W.B.up / Math.max(1, W.B.inc) - ECO.upkeepWarn) / (1 - ECO.upkeepWarn)));
  document.querySelectorAll('canvas.warnCv').forEach(cv => {
    const d = Math.min(devicePixelRatio || 1, 2), px = Math.round(44 * d);
    if (cv.width !== px) { cv.width = cv.height = px; }
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, 44, 44); Warn.draw(g, 22, 22, 44, pulse);
  });
  UI.warnPulse = pulse;
}
const wk = w => { const d = new Date(Date.UTC(2027, 0, 4) + (w - 1) * 7 * 864e5); return d.toISOString().slice(0, 10); };

function renderWorld() {
  setHTML($('res'), `<span>Choose a country to start the revolt</span>`);
  const L = WORLD.L, list = Object.keys(L).sort((a, b) => L[a].n.localeCompare(L[b].n));
  const opts = list.map(i => `<option value="${i}" ${i === UI.pick ? 'selected' : ''} ${L[i].ok ? '' : 'disabled'}>${L[i].n}${L[i].f ? ' ★' : ''}${L[i].ok ? '' : ' (coming later)'}</option>`).join('');
  const c = UI.pick && L[UI.pick], other = UI.pick && !c ? WORLD.c.find(x => x.i === UI.pick) : null;
  let card = '<p class="log">Tap a country on the map, or pick from the list. ★ = Featured, others Experimental. Grey hatched = coming later.</p>';
  if (c) { const E = economyOf(c, rngFrom(hashStr(UI.pick))); card = `<h2>${c.n}</h2><span class="tag">${c.f ? 'Featured' : 'Experimental'}</span>
     <div class="kv"><span>Population</span><span>${(c.pop / 1e6).toFixed(1)} M</span><span>GDP / person</span><span>$${E.pc.toLocaleString('en')}</span></div>
     <p class="log">You will start alone, as an agitator against an invented regime.</p>`; }
  else if (other) card = `<h2>${other.n}</h2><p class="log">Coming later.</p>`;
  setHTML($('left'), `<div class="card"><h3>World · pick a country</h3><select id="selC" aria-label="country">${'<option value="">— country —</option>' + opts}</select></div><div class="card">${card}</div>`);
  setHTML($('right'), `<div class="card"><h3>Briefing</h3><p class="log">${GAME_TITLE}: you are always the insurgent rising against the government of the country you pick. Real map, invented people.</p><p class="log">Map: Made with Natural Earth (public domain).</p></div>`);
  setHTML($('bottom'), `<button id="bStart" class="hot" ${c && c.ok ? '' : 'disabled'}>Start revolt here</button>`);
}

function actBtn(a, k, i) {
  const cost = typeof a.c === 'function' ? a.c(S) : a.c, ok = canDo(a, i);
  return `<button data-act="${a.id}" ${ok ? '' : 'disabled'}><b>${k + 1}</b> ${a.n}<small>${cost}</small></button>`;
}
// 0.5.0a grievance cards for the selected province: art from Rally.card(), one 44px Organize button per card
function panelGriev(i) {
  gvEnsure(); const L = (S.P[i] && S.P[i].gv) || []; if (!L.length) return '';   // new games deal on first look
  const ok = canDo(ACTIONS.find(a => a.id === 'organize'), i);
  return `<div class="card"><h3>Grievances · ${MAP.p[i].n}</h3><canvas id="gvCv" class="regCv" aria-label="${L.map(g => GRIEV[g.k].t).join(', ')}"></canvas>
   ${window.Rally ? '' : L.map(g => `<p><b>${GRIEV[g.k].t}</b> ${GRIEV[g.k].x}</p>`).join('')}
   <div class="row">${L.map((g, k) => `<button data-gv="${k}" ${ok ? '' : 'disabled'}>Organize: ${GRIEV[g.k].t}</button>`).join('')}</div></div>`;
}
function drawGriev() {
  const cv = $('gvCv'), L = S && S.P[S.sel] && S.P[S.sel].gv; if (!cv || !L || !window.Rally || !Rally.card) return;
  const w = Math.max(200, cv.clientWidth), d = Math.min(devicePixelRatio || 1, 2), key = [w, d, S.sel, JSON.stringify(L)].join();
  if (cv.dataset.key === key) return; cv.dataset.key = key;            // unchanged: skip
  const m = document.createElement('canvas').getContext('2d');         // measure first: changing canvas size wipes it
  const hs = L.map(g => Rally.card(m, 0, 0, w, { title: GRIEV[g.k].t, text: GRIEV[g.k].x, heat: g.sev }));
  const h = hs.reduce((a, b) => a + b + 6, 0); cv.width = w * d; cv.height = h * d; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); let y = 0;
  L.forEach((c, k) => { Rally.card(g, 0, y, w, { title: GRIEV[c.k].t, text: GRIEV[c.k].x, heat: c.sev }); y += hs[k] + 6; });
}
function panelProv() {
  const i = S.sel, p = S.P[i], m = MAP.p[i]; if (!p) return '';
  const acts = availableActions().map((a, k) => actBtn(a, k, i)).join('');
  return panelUnits() + panelGriev(i) + `<div class="card"><h3>Province ${i === MAP.cap.p ? '· capital' : ''}${i === S.home ? '· your base' : ''}</h3>
    <b>${m.n}</b> <span class="tag">${p.o === 'P' ? 'Liberated' : 'Regime'}</span> <span class="tag">${p.t}</span>${p.cur ? ' <span class="tag">curfew</span>' : ''}
    <div class="kv"><span>Support</span><span>${pct(p.s)}%</span></div>${bar(p.s)}
    <div class="kv"><span>Garrison</span><span>${p.o === 'R' ? p.g.toLocaleString('en') + ' soldiers' : '—'}</span><span>Output</span><span title="Fighting −15%/wk, quiet +5%/wk">${p.out ?? 100}%</span><span>Your cells</span><span>${cellsIn(i)}</span><span>Side</span><span>${sideOf(i)}</span>${S.ai && (S.ai.hits[i] || 0) >= BAL.aiGuardHits ? `<span>Watched</span><span class="watched">regime watches here: actions +${BAL.aiGuardHeat} heat</span>` : ''}${p.o === 'R' && isDug(i) ? `<span>Defences</span><span>dug in${scouted(i) ? '' : ', unscouted (+' + Math.round(BAL.unscoutedLoss * 100) + '% losses)'}</span>` : ''}${(p.gv || []).some(c => isPolicy(c.k)) ? `<span>Regime policy</span><span>${p.gv.filter(c => isPolicy(c.k)).map(c => GRIEV[c.k].t).join(', ')}</span>` : ''}</div></div>
    <div class="card"><h3>Actions · ${S.acts} left this week</h3><div class="acts">${acts}</div></div>`;
}
// 0.4.0 Regime AI card (G3 mockup): escalation ladder, 4 faction rows, reason line, recent regime moves.
// The canvas is drawn by drawRegime() after the HTML lands, so the art comes from assets/regime.js.
function panelRegime() {
  if (!S.fac) return '';
  const moves = S.log.filter(l => l.k === 'reg' || l.k === 'bad').slice(0, 3).map(l => `<div>${l.t}</div>`).join('');
  return `<div class="card"><h3>Regime AI · response</h3><canvas id="regCv" class="regCv" aria-label="Escalation rung ${S.rung} of 5. ${S.why.rung || ''}"></canvas>
   ${window.Regime ? '' : `<p>Rung ${S.rung}/5 · ${S.why.rung || ''}</p>`}<p class="log">${moves || 'No regime moves yet.'}</p></div>`;
}
function drawRegime() {
  const cv = $('regCv'); if (!cv || !window.Regime || !Regime.ladder || !Regime.row) return;
  const w = Math.max(200, cv.clientWidth), d = Math.min(devicePixelRatio || 1, 2);
  const s = Math.min(44, (w - w * 0.08) / 5 * 0.55), lh = s * 1.7 + Math.max(11, s * 0.3) * 2.8, h = Math.ceil(lh + 4 * 52 + 6);   // same maths as Regime.ladder
  const key = [w, d, S.rung, S.why.rung, ...FACS.map(k => Math.round(S.fac[k]))].join();
  if (cv.dataset.key === key) return; cv.dataset.key = key;            // nothing changed: skip the redraw
  cv.width = w * d; cv.height = h * d; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
  let y = Regime.ladder(g, 0, 0, w, S.rung, S.why.rung || '') + 6;
  FACS.forEach(k => y += Regime.row(g, 0, y, w, k, S.fac[k]));
  if (S.rung) firstTip('rung' + S.rung);
}
function panelIntel() {
  const cov = sensorCov(S.home), ch = detectChance();
  const sens = SENSORS.map(([k, n]) => `<div class="kv"><span>${n}</span><span>${pct(cov[k])}</span></div>${bar(cov[k], 1)}`).join('');
  const cards = CARDS.map(c => `<button class="cardBtn" data-card="${c.id}" ${S.cards[c.id] || S.wealth < c.cost || S.supp < c.skill ? 'disabled' : ''}>${S.cards[c.id] ? '✓ ' : ''}${c.n}<small>${S.cards[c.id] ? 'active' : `${usd(c.cost)} · ${c.skill} supporters`} · ${c.d}</small></button>`).join('');
  const cells = S.cells.map((c, k) => `${MAP.p[c.p].n}${c.comp ? ' (compartmentalized)' : c.link >= 0 ? ' ↔ linked' : ''}${c.known ? ' ⚠ known' : ''}`).join('<br>') || 'none yet';
  const L = S.last;
  return `<div class="card"><h3>Intel · security state</h3>
    <div class="kv"><span>Security Capability</span><span>${S.sc}/100</span><span>Fusion Level</span><span>${S.fusion}/3${S.fusion ? ' · Corvid Lattice' : ''}</span><span>Detection next week</span><span><b>${pct(ch * 100)}%</b></span><span>Last roll</span><span>${L ? (L.hit ? 'DETECTED: ' + L.what : 'not detected') : '—'}</span></div>
    <h3>Sensors over your base</h3>${sens}<h3>Countermeasures</h3><div class="row">${cards}</div>
    <h3>Cells</h3><p class="log">${cells}</p></div>`;
}
// 0.5.4 opposition factions: one Faction.row each (red line shows once you've hit it), leaders of joined groups below
function panelOpp() {
  oppEnsure(); const n = S.opp.filter(f => f.joined).length;
  return `<div class="card"><h3>Opposition · ${n}/12 with you</h3><canvas id="oppCv" class="regCv" aria-label="${S.opp.map(f => `${OPP.find(o => o.t === f.t).n} ${Math.round(f.loy)}${f.joined ? ' joined' : ''}`).join(', ')}"></canvas></div>`;
}
function drawOpp() {
  const cv = $('oppCv'); if (!cv || !S.opp || !window.Faction || !Faction.row) return;
  const w = Math.max(240, cv.clientWidth), d = Math.min(devicePixelRatio || 1, 2), key = [w, d, JSON.stringify(S.opp)].join();
  if (cv.dataset.key === key) return; cv.dataset.key = key;
  const red = f => { const F = OPP.find(o => o.t === f.t); return (ACTIONS.find(a => a.id === F.red) || { n: F.red }).n; };
  const rows = S.opp.map(f => ({ type: f.t, name: (f.joined ? '✓ ' : '') + OPP.find(o => o.t === f.t).n, loyalty: f.loy, redLine: red(f), known: f.known }));
  const L = S.opp.filter(f => f.joined && !f.lead.lost);
  const h = rows.reduce((a, r) => a + (r.known ? 64 : 48), 0) + L.length * 78 + 4;   // row heights from the art kit
  cv.width = w * d; cv.height = h * d; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); let y = 0;
  rows.forEach(r => y += Faction.row(g, 0, y, w, r));
  if (Faction.leader) L.forEach(f => { y += 6 + Faction.leader(g, 0, y + 6, w, { title: f.lead.title + (f.lead.cap ? ' (jailed)' : ''), name: f.lead.name, traits: f.lead.traits }); });
}
function panelFac() {
  const em = k => (EmberArt.SVG[k] || '').replace(/currentColor/g, '#d9d2c0').replace('<svg', '<svg width="28" height="28"');
  let h = '<div class="card"><h3>Factions</h3>';
  if (!S.lead && S.phase >= 2) h += '<p class="log">Choose a faction to lead your movement:</p>' + Object.entries(FACTIONS).map(([k, f]) => `<button data-fac="${k}" style="width:100%;text-align:left;margin:2px 0">${em(k)} ${f.n}<small style="display:block;color:var(--dim)">${f.d}</small></button>`).join('');
  else if (S.lead) h += `<p>${em(S.lead)} Lead: <b>${FACTIONS[S.lead].n}</b></p><div class="kv"><span>Unity</span><span>${S.unity}%</span></div>${bar(S.unity)}<p class="log">Unity is shown as a meter only in this version.</p>`;
  else h += '<p class="log">Factions open in Phase 2 (Cell).</p>';
  return h + `<div class="kv"><span>Regime</span><span>${S.regime.n}</span><span>Leader</span><span>${S.regime.leader}</span></div></div>` + panelOpp();
}
function panelPow() {
  const art = window.Foreign && Foreign.power;   // 0.6.2: Foreign.power card (stance meter) + Foreign.deal offer, text fallback without the art
  return `<div class="card"><h3>Foreign powers</h3>` + S.powers.map((p, k) => (art ? `<canvas class="powCv" data-k="${k}" aria-label="${p.gov}: ${p.st}, relation ${p.rel}"></canvas><p class="log">${p.n} · ${p.st} · relation ${p.rel}</p>` : `<p><b>${p.n}</b> <span class="tag">${p.st}</span><br><small class="log">${p.gov} (invented) · relation ${p.rel}</small></p>${bar((p.rel + 100) / 2)}`)
    + (p.deal ? `<div class="dealBox${art ? ' art' : ''}">${art ? `<canvas class="dealCv" data-k="${k}"></canvas>` : `<p>${DEAL_GIVE[p.deal.g].t(k)} for ${DEAL_WANT[p.deal.x].t(k)}</p>`}<button class="dealBtn" data-pow="accept" data-k="${k}" aria-label="Accept">${art ? '' : 'Accept'}</button><button class="dealBtn" data-pow="refuse" data-k="${k}" aria-label="Refuse">${art ? '' : 'Refuse'}</button></div>` : '') + `
    <div class="row"><button data-pow="ask" data-k="${k}" ${S.phase >= 3 && S.acts > 0 && !S.over ? '' : 'disabled'}>Ask backing</button>
    <button data-pow="ally" data-k="${k}" ${S.phase >= 4 && S.acts > 0 && p.st !== 'Ally' && !S.over ? '' : 'disabled'}>Propose alliance</button>
    <button data-pow="cease" data-k="${k}" ${S.phase >= 4 && S.acts > 0 && S.ceaseCd === 0 && (p.st === 'Backer' || p.st === 'Ally') && !S.over ? '' : 'disabled'}>Ceasefire</button></div>`).join('') +
    `<p class="log">${S.cease ? `Ceasefire: ${S.cease} weeks left.` : S.ceaseCd ? `Ceasefire cooldown ${S.ceaseCd}.` : 'Powers open in Phase 3.'}</p></div>`;
}
function panelEco() {
  const E = S.E, C = S.C, R = S.R, L = R.lines, B = rebelBudget(), W = upkeepWarning();
  const wkUsd = C.budget / 52, pt = x => '$' + fmtN(x / Math.max(1, R.base) * wkUsd);   // budget points → real dollars
  const est = C.est ? ' (regional estimate)' : ' (approx.)';
  const line = (n, v, why) => `<span title="${why}">${n}</span><span>${v}</span>`;
  const sh = S.short || { food: 0, fuel: 0 }, TR = tradeRoutes();
  return `<div class="card"><h3>Weekly budget</h3><canvas id="ecoCv" aria-label="Wealth ${usd(S.wealth)}, income ${usd(B.inc)}, costs ${usd(B.up + B.sanc)}"></canvas>
    <div class="kv">${line('Trade', usd(B.trade) + ` (${TR.length} route${TR.length === 1 ? '' : 's'})`, BAL.tradeVal * 10 + 'K per Backer/Ally power (after the revolt: any power not Hostile); a trade embargo stops it')}${B.sanc ? line('Embargoes', '−' + usd(B.sanc), 'oil, banks and trade embargoes after the revolt') : ''}
    ${line('Food shortage', ['none', 'mild', 'serious', 'severe'][sh.food], 'fighting or a trade embargo; −' + BAL.shortSupp + '% support per level a week in held provinces')}${line('Fuel shortage', ['none', 'mild', 'serious', 'severe'][sh.fuel], 'oil embargo, or no trade after the revolt')}
    ${S.powers.filter(p => p.pact).map(p => line('Pact', `${p.n}: next call week ${p.pact.due}`, 'mutual defence: ' + BAL.pactTroops * MEN + ' troops against an invasion, may lift embargoes; refusing a call costs ' + BAL.pactBreak + ' stance')).join('')}</div></div>
  <div class="card"><h3>Your money · next week</h3>
    ${W ? `<p class="warnBox ${W.lvl}"><canvas class="warnCv" width="44" height="44" aria-hidden="true"></canvas> ${W.t}. Fewer militia or more held land fixes it.</p>` : ''}
    <div class="kv">${line('Donations', usd(B.don), 'ramps up from the first supporter; 1 per 12 from 120')}${line('Taxes (held land)', usd(B.tax), '3 per held province × its output')}
    ${line('Foreign aid', usd(B.aid), 'Backer $30K, Ally $50K')}${line('Momentum', '+' + Math.round(held() * BAL.income * 100) + '%', '+5% per held province')}
    ${line('Upkeep', '−' + usd(B.up), '$5K per 250 militia, $10K per 250 regulars')}${line('<b>Net</b>', `<b>${usd(B.net)}</b>`, B.why)}</div>${bar(B.inc ? B.up / B.inc * 100 : 0, B.up > B.inc)}</div>
  <div class="card"><h3>Regime budget${est}</h3><div class="kv">
    ${line('State budget', '$' + fmtN(C.budget) + '/yr', 'data/countries.js')}${line('Taxes this week', L ? pt(L.income) + ` (output ${L.out}%)` : '—', 'lost provinces pay nothing; fighting cuts output')}
    ${L ? line('Army', pt(L.army), 'pay for regime army units') + line('Police + garrisons', pt(L.police), 'pay for police and garrisons') + line('Debt', pt(L.debt), '15% of the base budget') + line('Subsidies', pt(L.sub), 'whatever is left; cuts raise prices and anger') : ''}
    ${line('Reserves', pt(R.reserves), 'spent when the budget is short; at 0 troops go unpaid')}${line('Inflation', Math.round(R.infl) + '%', 'subsidy cuts and money printing; +recruiting')}
    ${line('Unpaid troops', R.unpaid ? R.unpaid + ' wk' : 'no', 'unpaid troops may defect')}</div></div>
  <div class="card"><h3>Economy ticker</h3><p class="log">${(S.lastEco || []).join('<br>') || 'Quiet week.'}</p></div>
  <div class="card"><h3>Country (${S.name})${est}</h3><div class="kv">
    <span>Population</span><span>${fmtN(C.pop)}</span><span>GDP</span><span>$${fmtN(C.gdp)}</span><span>Active troops</span><span>${fmtN(C.troops)}</span><span>Police</span><span>${fmtN(C.police)}</span>
    <span>Reserves</span><span>$${fmtN(C.reserves)}</span><span>GDP / person</span><span>$${E.pc.toLocaleString('en')}</span><span>Escalation rung</span><span>${S.esc}/6</span></div>
    <p class="log">World Bank, IMF, IISS Military Balance, rounded (data/countries.js). Map units show the part of these forces sent against you.</p></div>`;
}
function panelLog() { return `<div class="card log"><h3>Log</h3>${S.log.slice(0, 14).map(l => `<p><b>Wk ${l.w}</b> · ${l.t}</p>`).join('')}</div>`; }
function panelAudio() {
  if (!window.SFX) return '';
  const v = k => Math.round((SFX.getVolume(k) || 0) * 10), m = k => SFX.isMuted(k) ? 'Unmute' : 'Mute';
  return `<div class="card"><h3>Sound · UI scale</h3>
   <div class="row"><button data-au="music-">Music −</button><button data-au="music+">Music + (${v('music')})</button><button data-au="mmusic">${m('music')} music</button></div>
   <div class="row"><button data-au="sfx-">SFX −</button><button data-au="sfx+">SFX + (${v('sfx')})</button><button data-au="msfx">${m('sfx')} SFX</button></div>
   <div class="row"><button data-ui="-">UI −</button><button data-ui="+">UI + (${uiScale})</button><button data-legend>Icon legend</button></div></div>`;
}

function renderGame() {
  const ph = S.won ? 'Liberated · ' + PHASES[S.phase] : `Phase ${S.phase} · ${PHASES[S.phase]}`;
  setHTML($('res'), `<span>Wk ${S.week} <i>${wk(S.week)}</i></span><span>${S.name}</span><span><i>${ph}</i></span>
    <span title="supporters (headcount, approx.)"><i>Supp</i> ${fmtN(heads())} / ${(heads() / S.C.pop * 100).toFixed(2)}%</span><span title="${S.why.wealth || 'next week: ' + rebelBudget().why}"><i>Wealth</i> ${usd(S.wealth)}</span>${warnChip()}<span><i>Arms</i> ${S.arms}</span><span><i>Heat</i> <b style="color:${S.heat >= 80 ? '#e4573a' : 'inherit'}">${Math.round(S.heat)}</b></span>
    ${S.phase >= 4 ? `<span><i>Militia</i> ${fmtN(S.militia)}</span><span><i>Reg</i> ${fmtN(S.regulars)}</span><span><i>Held</i> ${held()}/${S.P.length}</span>` : ''}`);
  if (wide()) {
    setHTML($('left'), panelProv() + panelFac());
    setHTML($('right'), panelIntent() + panelAfter() + panelRegime() + panelIntel() + panelPow() + panelEco() + panelLog() + panelAudio());
  } else {
    const t = UI.tab;
    setHTML($('left'), t === 'map' ? panelIntent() + panelAfter() + panelProv() + panelLog() : t === 'intel' ? panelRegime() + panelIntel() : t === 'fac' ? panelFac() : t === 'pow' ? panelPow() : panelEco() + panelAudio() + panelLog());
  }
  const tabs = [['map', 'Map'], ['intel', 'Intel'], ['fac', 'Factions'], ['pow', 'Powers'], ['eco', 'Econ']];
  setHTML($('bottom'), tabs.map(([k, n]) => `<button class="tab ${UI.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('') +
    (S.won ? '<button class="tab" data-atlas>World</button>' : '') +   // after a win: view the whole world
    (innerWidth > 900 ? '<canvas id="keyHints" aria-hidden="true"></canvas>' : '') +   // 0.10.0 key hints (desktop only)
    `<button id="bEnd" class="hot" ${S.over ? 'disabled' : ''}>End Week${innerWidth > 900 ? ' <kbd>Space</kbd>' : ''}</button>`);
}
// After a win you can open the whole world map to look around (view only; conquest is v1.1)
function openAtlas() { closeModal(); UI.screen = 'atlas'; UI.selU = null; MapView.setScene(makeWorldScene()); resize(); focusCountry(MAP.i); render(); }
function closeAtlas() { UI.screen = 'game'; MapView.setScene(makeCountryScene(MAP)); resize(); render(); }
function renderAtlas() {
  setHTML($('res'), `<span>World map · ${S.name} is free</span>`);
  setHTML($('left'), `<div class="card"><h3>World</h3><p class="log">Drag or WASD to pan, pinch or wheel to zoom. Conquest of other states comes in v1.1.</p></div>`);
  setHTML($('right'), '');
  setHTML($('bottom'), `<button class="hot" data-back>Back to ${S.name} (Esc)</button>`);
}
function render() { if (UI.screen === 'atlas') renderAtlas(); else if (UI.screen === 'world') renderWorld(); else if (UI.screen === 'game') { renderGame(); drawWarnIcons(); drawRegime(); drawGriev(); drawOpp(); drawPow(); drawAfter(); drawEco(); drawIntentRow(); drawKeyHints(); } MapView.dirty = true; }
// 0.7.0 after the revolt: threat banner + one sanction row each (After art), invasion arrow from the border to the capital on the real map
function panelAfter() {
  if (!S.won || !S.after) return ''; const A = S.after;
  return `<div class="card"><canvas id="afterCv" aria-label="Threat ${A.lvl}: week ${A.wk} of ${BAL.afterWeeks}${A.sanc.map(s => ', ' + s.k + ' embargo').join('')}"></canvas>${window.After ? '' : `<p>Threat ${A.lvl} · week ${A.wk}/${BAL.afterWeeks}</p>`}
   <p class="log">${A.inv ? `Invasion from ${A.inv.from}: ${Math.round(A.inv.prog * 100)}% to ${MAP.cap.n}, ${A.inv.str.toLocaleString('en')} troops. Your fighters: ${myFighters().toLocaleString('en')} (hold it with more).` : 'No invasion.'} ${A.sanc.map(s => `${s.k}: −${s.k === 'arms' ? BAL.sancBite.arms + ' arms' : usd(BAL.sancBite[s.k])}/wk`).join(' · ')}</p></div>`;
}
function drawAfter() {
  const cv = $('afterCv'); if (!cv || !window.After || !S.after) return; const A = S.after, d = Math.min(2, devicePixelRatio || 1), w = cv.parentNode.clientWidth || 320, h = 52 + A.sanc.length * 52;
  cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const g = cv.getContext('2d'); g.scale(d, d);
  After.banner(g, 0, 0, w, { level: A.lvl, title: A.lvl === 'war' ? 'War: invasion' : A.lvl === 'tense' ? 'Tense: hostile neighbours' : 'Calm', sub: `Hold on: week ${A.wk} of ${BAL.afterWeeks}` });
  A.sanc.forEach((s, k) => After.sanction(g, 0, 56 + k * 52, w, { kind: s.k, from: s.from, bite: Math.min(1, BAL.sancBite[s.k] / 3) }));
}
// 0.10.0 PC: footer key hints with Keys.hint (only above 900px wide; typeof-guarded)
const KEY_HINTS = [['Space', 'End week'], ['1-9', 'Actions'], ['Tab', 'Province'], ['U', 'Unit'], ['G', 'Map'], ['I', 'Intel'], ['F', 'Factions'], ['D', 'Powers'], ['B', 'Budget'], ['M', 'Mute'], ['Wheel', 'Zoom'], ['?', 'All keys']];
function drawKeyHints() {
  const cv = $('keyHints'); if (!cv || typeof Keys === 'undefined' || typeof Keys.hint !== 'function') return;
  const d = Math.min(2, devicePixelRatio || 1), w = Math.max(200, cv.parentNode.clientWidth - 420), h = 18 * uiK();
  cv.width = w * d; cv.height = (h + 4) * d; cv.style.width = w + 'px'; cv.style.height = h + 4 + 'px'; const g = cv.getContext('2d'); g.scale(d * uiK(), d * uiK());
  let used = 0; const L = KEY_HINTS.filter(([k, t]) => { g.font = '11px system-ui'; used += Math.max(18, k.length * 7 + 10) + g.measureText(t).width + 19; return used * uiK() < w; });
  Keys.hint(g, 2, 2, L);
}
// canvas cards get the artist's neon hover outline on mouse-over (Keys.hover), redrawn without it on leave
function hoverCanvas(cv, redraw) {
  if (IS_TOUCH || typeof Keys === 'undefined' || typeof Keys.hover !== 'function' || cv.dataset.hov) return; cv.dataset.hov = 1;
  cv.addEventListener('pointerenter', () => { redraw(); const g = cv.getContext('2d'); Keys.hover(g, 0, 0, cv.width / (Math.min(2, devicePixelRatio || 1)), cv.height / (Math.min(2, devicePixelRatio || 1)), '#22e1ff'); });
  cv.addEventListener('pointerleave', redraw);
}
// 0.9.0 regime intent: one plain-words line a week (Intent.row) + a ring on the target (Intent.marker). Fog: the real move shows only
// where you have a cell, support above 50% or the province itself; elsewhere it is 'Unknown regime move' with the dim '?' marker.
function intentNow() { const pl = S && S.ai && S.ai.plan; if (!pl) return null; const known = pl.k === 'propaganda' || intentKnown(pl.p); return { p: pl.p, kind: known ? pl.k : 'unknown', text: intentText(pl), known }; }
function panelIntent() { const I = intentNow(); return I ? `<div class="card intentCard"><canvas id="intentCv" aria-label="${I.text}"></canvas>${window.Intent ? '' : `<p>${I.text}</p>`}</div>` : ''; }
// 0.10.1 short intent texts for the top-right row (full sentence from intentText stays in the tooltip)
function intentShort() { const I = intentNow(); if (!I) return ''; if (!I.known) return 'Unknown regime move'; const n = MAP.p[I.p] ? MAP.p[I.p].n : '';
  return { raid: `Hunting your cell: ${n}`, dig: `Troops to ${n}`, crack: `Crackdown: ${n}`, propaganda: 'Propaganda and payoffs', attack: `Retake: ${n}` }[I.kind] || I.text; }
function drawIntentRow() {
  const cv = $('intentCv'), I = intentNow(); if (!cv || !I || !window.Intent) return; const d = Math.min(2, devicePixelRatio || 1), w = cv.parentNode.clientWidth || 320;
  cv.width = w * d; cv.height = 40 * d; cv.style.width = w + 'px'; cv.style.height = '40px'; const g = cv.getContext('2d'); g.scale(d, d);
  // 0.10.1: short move text so the week count always shows; Intent.row shortens with Intent.fit if still too long.
  // Without Intent.fit, wrap to 2 lines here. The full sentence is always the tooltip / aria-label.
  const short = intentShort(), L = [short];
  if (typeof Intent.fit === 'function') Intent.row(g, 0, 0, w, { kind: I.kind, text: short, turns: 1 });
  else {
    Intent.row(g, 0, 0, w, { kind: I.kind, text: '', turns: 1 });
    g.font = 'bold 12px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#d8e2f0'; L.length = 0; L.push('');
    for (const wd of short.split(' ')) { const t = L[L.length - 1] ? L[L.length - 1] + ' ' + wd : wd; if (g.measureText(t).width <= w - 100 || !L[L.length - 1]) L[L.length - 1] = t; else L.push(wd); }
    L.splice(2); L.forEach((t, i) => g.fillText(t, 40, L.length === 1 ? 20 : 13 + i * 14));
  }
  cv.title = I.text; UI.intentLines = L;
}
function drawIntentMarker(g, v, fs) {
  const I = intentNow(); if (!I || !window.Intent) return [];
  const pp = I.kind === 'propaganda' ? MAP.cap.p : I.p; if (pp == null || !MAP.p[pp]) return [];   // propaganda is country-wide: one purple » at the capital
  const d = v.dpr, c = MAP.p[pp].c, x = (c[0] * v.z + v.ox) * d, y = (c[1] * v.z + v.oy) * d + fs * d * 0.6 + 26 * d;   // below the name
  g.save(); g.setTransform(d, 0, 0, d, 0, 0); Intent.marker(g, x / d, y / d, I.known ? { kind: I.kind, turns: 1 } : { kind: 'unknown' }); g.restore();
  return [[x - 22 * d, y - 22 * d, x + 22 * d, y + 28 * d]];
}
// 0.8.0 budget card, shortage bars and trade rows: Economy art when present, plain canvas bars otherwise
function drawEco() {
  const cv = $('ecoCv'); if (!cv || !S) return; const B = rebelBudget(), sh = S.short || { food: 0, fuel: 0 }, TR = tradeRoutes(), E = window.Economy, d = Math.min(2, devicePixelRatio || 1), w = cv.parentNode.clientWidth || 320;
  const h = E && E.budget ? 64 + 6 + 2 * 46 + TR.length * 50 + S.powers.filter(p => p.pact).length * 54 : 70;
  cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const g = cv.getContext('2d'); g.scale(d, d);
  if (E && E.budget) { let y = E.budget(g, 0, 0, w, { cash: S.wealth * 10, income: B.inc * 10, costs: (B.up + B.sanc) * 10 }) + 6;   // $K
    ['food', 'fuel'].forEach(k => y += E.shortage(g, 0, y, w, { kind: k, level: sh[k] }) + 6);
    TR.forEach(p => y += E.trade(g, 0, y, w, { partner: p.gov, goods: 'trade route', value: BAL.tradeVal * 10, on: true }) + 6);
    S.powers.filter(p => p.pact).forEach(p => y += E.pact(g, 0, y, w, { a: 'You', b: p.n, kind: 'defense' }) + 6); return; }
  const rows = [['Income', B.inc, '#00e5a0'], ['Costs', B.up + B.sanc, '#ff3b5c']], mx = Math.max(1, B.inc, B.up + B.sanc);   // fallback bars
  rows.forEach(([n, v, c], k) => { g.fillStyle = '#9aa4bb'; g.font = '12px system-ui'; g.fillText(`${n} ${usd(v)}`, 0, 14 + k * 32); g.fillStyle = c; g.fillRect(0, 20 + k * 32, (w - 4) * v / mx, 8); });
}
function drawInvasion(g, v, avoid) {
  const I = S.won && S.after && S.after.inv; if (!I || !window.After) return; const d = v.dpr, sc = c => [(c[0] * v.z + v.ox) * d, (c[1] * v.z + v.oy) * d];
  // 0.8.0: the arrow follows the invasion path province by province (centroid to centroid); done legs full, current leg partial
  const P = (I.path && I.path.length > 1 ? I.path : [I.p, MAP.cap.p]).map(i => sc(MAP.p[i].c).map(q => q / d)), n = P.length - 1, at = Math.max(0.08, I.prog) * n;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);   // clip: whole canvas minus every label/icon box (evenodd), so the arrow never covers a name
  if (avoid && avoid.length) { g.beginPath(); g.rect(0, 0, g.canvas.width, g.canvas.height); avoid.forEach(r => g.rect(r[0] - 2 * d, r[1] - 2 * d, r[2] - r[0] + 4 * d, r[3] - r[1] + 4 * d)); g.clip('evenodd'); }
  g.setTransform(d, 0, 0, d, 0, 0);
  for (let k = 0; k < n && k < at; k++) After.invasion(g, P[k][0], P[k][1], P[k + 1][0], P[k + 1][1], Math.min(1, at - k), '#ff3b5c');
  g.restore();
}
// 0.6.2: power cards and deal cards; the 44px Accept/Refuse buttons sit exactly on Foreign.deal's hit boxes
function drawPow() {
  if (!S || !window.Foreign || !Foreign.power) return; const d = Math.min(2, devicePixelRatio || 1);
  const size = (cv, h) => { const w = cv.parentNode.clientWidth || 320; cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const g = cv.getContext('2d'); g.scale(d, d); return [g, w]; };
  document.querySelectorAll('.powCv').forEach(cv => { const p = S.powers[+cv.dataset.k], [g, w] = size(cv, 78);
    Foreign.power(g, 0, 0, w, { name: p.gov, seed: hashStr(p.iso), stance: p.rel, note: `${p.st} · ${p.n}` }); });
  document.querySelectorAll('.dealCv').forEach(cv => { const k = +cv.dataset.k, p = S.powers[k], o = { from: p.gov, gives: [DEAL_GIVE[p.deal.g].t(k)], wants: [DEAL_WANT[p.deal.x].t(k)] };
    const w = cv.parentNode.clientWidth || 320, m = Foreign.deal(document.createElement('canvas').getContext('2d'), 0, 0, w, o), [g] = size(cv, m.height), r = Foreign.deal(g, 0, 0, w, o);
    const box = cv.parentNode; [['accept', r.accept], ['refuse', r.refuse]].forEach(([n, b]) => Object.assign(box.querySelector(`[data-pow="${n}"]`).style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' })); });
  const tb = $('tipbox'); if (tipQ[0] === 'season' && tb) { if (document.querySelector('.dealBox')) { tb.hidden = true; clearTimeout(UI.tipT); } else if (tb.hidden && !UI.modal) showTip(); }   // 0.7.0
}

// ================= MODALS =================
function modal(html) { UI.modal = true; { const t = $('tipbox'); if (t) t.hidden = true; clearTimeout(UI.tipT); } $('modal').hidden = false; setHTML($('mbox'), html); const b = $('mbox').querySelector('button.hot'); if (b && !IS_TOUCH) b.focus(); }
function closeModal() { UI.modal = null; UI.battle = null; $('modal').hidden = true; if (tipQ.length) setTimeout(showTip, 300); }   // show any held tip
function weekReport(rep) {
  const d = rep.det;
  modal(`<h2>Week ${S.week - 1} report</h2><h3>Regime moves</h3><p class="log">${rep.reg.join('<br>') || 'quiet'}</p>
    <h3>Detection roll</h3><p>${Math.round(d.ch * 100)}% chance · <b style="color:${d.hit ? '#e4573a' : '#9fbf7a'}">${d.hit ? 'DETECTED' : 'not detected'}</b>${d.what ? '<br><span class="log">' + d.what + '</span>' : ''}</p>
    ${rep.fights.length ? '<h3>Contacts</h3><p class="log">' + rep.fights.map(f => `${f.win ? '✕ won' : '▲ lost'} ${MAP.p[f.p].n}: −${f.loss} yours, −${f.enemyLoss} regime`).join('<br>') + '</p>' : ''}
    ${(rep.cells && rep.cells.length) || (rep.arrests && rep.arrests.length) ? `<h3>Cells</h3><p class="log">${(rep.cells || []).map(c => `${MAP.p[c.p].n}: ${c.s ? '+' + c.s + '% support' : 'curfew'}, +${c.h} heat`).concat((rep.arrests || []).map(a => `${MAP.p[a.p].n}: ARRESTED`)).join('<br>')}</p>` : ''}
    <h3>Economy · ${S.season} · ${S.weather}</h3><p class="log">${rep.eco.join('<br>') || 'No change.'}</p>
    ${rep.phase ? `<h3>New phase</h3><p><b>${PHASES[S.phase]}</b>: new actions unlocked.</p>` : ''}
    <button class="hot" data-close>Continue (Enter)</button>`);
}
function showEnd() {
  if (!S) return;                                        // S is null on the title screen (legend)
  if (S.over && S.over.k === 'survived') {   // 0.7.0: the clear end after the revolt
    music('stop'); snd('victory');
    modal(`<h2>Victory: survived</h2><p>${S.over.t}</p><p class="log">Week ${S.week} in ${S.name}.</p><button class="hot" data-new>New revolt</button>`);
  } else if (S.over) {
    music('stop'); snd(S.over.k === 'arrested' ? 'arrested' : 'defeat');
    modal(`<h2>${S.over.k === 'arrested' ? 'Arrested' : 'Defeat'}</h2><p>${S.over.t}</p><p class="log">Week ${S.week} in ${S.name}.</p><button class="hot" data-new>New revolt</button>`);
  } else if (S.winNew) {
    const how = S.winNew; S.winNew = null; music('stop'); snd('victory');
    modal(`<h2>Victory</h2><p>${how === 'capital' ? `${MAP.cap.n} has fallen. The regime is gone.` : 'A Negotiated Settlement ends the regime.'}</p>
     <p class="log">The game goes on: you now run the movement's new government. Keep growing supporters, wealth and arms, and clear the last holdouts. (Conquest of other states comes in v1.1.)</p>
     <button class="hot" data-close>Keep playing</button><button data-atlas>World map</button><button data-new>New revolt</button>`);
    saveNow();
  }
}

// ================= FLOW =================
async function startCountry(iso, saved) {
  const L = WORLD.L[iso]; if (!L || !L.ok) return false;
  closeModal(); UI.anim.clear(); UI.pops = []; UI.selU = null; UI.loading = true;
  MAP = await loadJSON('data/' + iso + '.json');   // stays 'loading' until the new scene is set           // only this country's file is loaded
  if (saved) { S = saved; if (!S.U) { S.U = spawnRegime(rngFrom(hashStr(MAP.i)), MAP.p.length, MAP.cap.p, S.sc); S.nextId = 100; } upgradeSave(S, L); }   // upgrade old saves step by step
  else {
    const me = WORLD.c.find(c => c.i === iso), cen = c => { const r = dec(c.g[0] || ""); if (!r.length) return [1e6, 1e6]; let x = 0, y = 0; for (let k = 0; k < r.length; k += 2) { x += r[k]; y += r[k + 1]; } return [x / r.length * 2, y / r.length * 2]; };
    const [mx, my] = cen(me);
    const powers = WORLD.c.filter(c => c.i !== iso && WORLD.L[c.i]).map(c => { const [x, y] = cen(c); return { iso: c.i, n: WORLD.L[c.i].n, d: Math.hypot(x - mx, y - my) }; }).sort((a, b) => a.d - b.d).slice(0, 2);
    S = newGame(MAP, L, powers); regimeStart(S);
    log(`You begin alone in ${MAP.p[S.home].n}. ${S.regime.n} rules from ${MAP.cap.n}.`);
    UI.pickGov = true;   // 0.6.1: choose the regime type once the map is up
  }
  UI.screen = 'game'; UI.tab = 'map'; show('app');
  UI.selU = null; UI.anim.clear(); UI.loading = false; MapView.setScene(makeCountryScene(MAP)); resize();
  music('play'); musicIntensity(); saveNow(); render(); if (UI.pickGov) { UI.pickGov = false; govPicker(); } return true;
}
// 0.6.1 regime-type picker: Regime.Picker.card art (88px tall, whole card is the tap target), lines from regimes-preview.html
const GOV_LINES = { junta: ['Army runs everything', 'Fast crackdowns, low loyalty'], party: ['Informers on every block', 'High surveillance'], theocracy: ['Clerics hold power', 'Faith factions split'], monarchy: ['One ruling family', 'Court intrigue'], oligarchy: ['A few rich families', 'Bribes work, unions angry'], puppet: ['Propped up from abroad', 'Foreign powers matter more'] };
const govName = t => (window.Regime && Regime.Picker ? Regime.Picker.NAMES[t] : t);
function govPicker() {
  const T = Object.keys(GOV);
  modal(`<h2>Who are you rising against?</h2><div class="govList">${T.map(t => window.Regime && Regime.Picker
    ? `<canvas class="govCard" data-gov="${t}" role="button" tabindex="0" aria-label="${govName(t)}: ${GOV_LINES[t].join(', ')}"></canvas>`
    : `<button data-gov="${t}">${t}</button>`).join('')}</div>`);
  const d = Math.min(2, devicePixelRatio || 1);
  document.querySelectorAll('.govCard').forEach(cv => { const w = cv.parentNode.clientWidth || 320; cv.width = w * d; cv.height = 88 * d; cv.style.width = w + 'px'; cv.style.height = '88px';
    const draw = () => { const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, 88); Regime.Picker.card(g, 0, 0, w, { type: cv.dataset.gov, lines: GOV_LINES[cv.dataset.gov], selected: false }); }; draw(); hoverCanvas(cv, draw); });
  document.querySelectorAll('[data-gov]').forEach(el => { const go = () => pickGov(el.dataset.gov); el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') go(); }; });
}
function pickGov(t) {
  govStart(S, t); log(`Regime type: ${govName(t)}. ${GOV_LINES[t].join('. ')}.`, 'reg');
  snd('cardPlay'); closeModal(); saveNow(); render();
}
function show(which) { $('scrTitle').classList.toggle('on', which === 'title'); }
async function goWorld() {
  closeModal(); UI.screen = 'world'; UI.pick = null; show('app'); S = null;
  MapView.setScene(makeWorldScene()); resize();
  MapView.zoomAt(2.2, MapView.W * 0.55, MapView.H * 0.3);      // start zoomed on Europe / Middle East
  render();
}
function afterChange() {
  checkEnd(); MapView.invalidate(); saveNow(); render(); musicIntensity();
  if (UI.lastHeat != null && UI.lastHeat < 70 && S.heat >= 70) sfxCall('heatWarn');   // once, when heat crosses 70
  UI.lastHeat = S.heat;
  if (S.over || S.winNew) showEnd();
}
function selectProv(i) { if (i < 0 || !S) return; S.sel = i; snd('pinSelect'); render(); }
function doAct(id) {
  if (id === 'rally' && S && window.Rally && Rally.panel) { openRally(S.sel); return; }   // 0.5.2: pick a speech line first
  const a = ACTIONS.find(a => a.id === id); if (!a || !S) return;
  const ph = S.phase, msg = doAction(a, S.sel); if (!msg) { snd('cancel'); return; }
  if (a.id === 'rally') { UI.ev[S.sel] = 'rally'; MapView.invalidate(); }
  if (id === 'organize') sfxCall('cardPlay');
  snd({ speak: 'recruit', pamph: 'recruit', rally: 'recruit', fund: 'wealth', buy: 'armory', smug: 'armory', cell: 'pinPlace', militia: 'pinPlace', drill: 'pinPlace' }[id] || 'confirm');
  if (S.phase !== ph) snd(S.phase === 4 ? 'insurrection' : 'phase');
  afterChange();
}
function doEndWeek() {
  if (!S || S.over || UI.modal) return;
  snd('endWeek'); const ph = S.phase;
  const rep = endWeek(10); startSlides(rep); S.lastEco = rep.eco;
  if (rep.weather !== 'clear') sfxCall('weather', rep.weather);         // quiet texture at the start of the week
  if (rep.season) sfxCall('season', rep.season);                       // the calendar crossed into a new season
  if ((rep.gvNew || []).length) setTimeout(() => sfxCall('teletype'), 600);   // a new grievance card appeared
  { const fx = (rep.oppFx || [])[0];                                   // faction/leader news: one sound per week, typeof-guarded
    if (fx && typeof SFX2 !== 'undefined' && typeof SFX2[fx] === 'function') setTimeout(() => SFX2[fx](), 900); }
  if (rep.dealNew) setTimeout(() => sfx2('dealOffer'), 1000);          // 0.7.0 deal + after-the-revolt sounds
  if (rep.stance) sfx2('stanceShift', rep.stance > 0);
  if (rep.inv) setTimeout(() => sfx2('invasionAlert'), 700); if (rep.sanc) setTimeout(() => sfx2('sanctionHit'), rep.inv ? 1900 : 700);
  if (rep.threat) setTimeout(() => sfx2('threatLevel', rep.threat), 1400);
  // 0.8.0 economy + alliance sounds (AUDIO-HOOKUP.md): one economy cue a week, most urgent first
  if (rep.pactBroken) setTimeout(() => sfx2('allianceBroken'), 500);
  { const I = intentNow(); if (I && I.known && (I.kind === 'attack' || I.kind === 'raid')) setTimeout(() => sfx2('sensorAlarm', 1), 1100); }   // 0.9.0: a known threat to you
  if (rep.unrest) setTimeout(() => sfx2('bankruptUnrest'), 1600); else if (rep.short) setTimeout(() => sfx2('shortage'), 1600);
  else if (rep.budgetLow) setTimeout(() => sfx2('budgetLow'), 1600); else if (rep.trade > 0) setTimeout(() => sfx2('tradeIncome'), 1600);
  if (rep.persec && typeof SFX2 !== 'undefined' && typeof SFX2.crackdown === 'function') setTimeout(() => SFX2.crackdown(), 1200);   // a new persecution policy
  if (rep.defect) sfxCall('defect');                                    // once per tick, however many units left
  // regime stinger: at most one per End Week, priority rung > de-escalate > faction
  if (rep.rungUp) sfxCall('rung', rep.rungUp); else if (rep.rungDown != null) sfxCall('deescalate'); else if (rep.faction) sfxCall('faction', rep.faction);
  if (rep.fights.length) snd('clash'); if (rep.fights.some(f => !f.win)) snd('rout');
  for (let n = 0; n < Math.min(3, rep.newSeen || 0); n++) setTimeout(() => sfxCall('enemySeen'), 450 + n * 200);
  [0, 250, 500].forEach(t => setTimeout(() => snd('detectTick'), t));
  setTimeout(() => { if (rep.det.hit) snd('detectHit'); if (rep.det.bust > 1) snd('linkExposed'); if (rep.det.raid) snd('raid'); }, 800);
  if (!rep.det.hit || (rep.cells && rep.cells.length)) setTimeout(() => sfxCall('detectSafe'), 800);   // once a week, with the cell floaters
  if (rep.reg.length) snd('crackdown');
  if (S.phase !== ph) snd(S.phase === 4 ? 'insurrection' : 'phase');
  const ended = S.over || S.winNew;          // remember it: showEnd() clears winNew
  afterChange(); if (!ended) weekReport(rep);   // don't cover the end screen with the report
}

// 0.5.0 sounds live in assets/sfx2.js and only load when those systems first appear.
// If the file is missing the promise just answers false: a missing sound never breaks a week.
let sfx2Load = null;
function loadSfx2() {
  if (!sfx2Load) sfx2Load = new Promise(ok => { const el = document.createElement('script'); el.src = 'assets/sfx2.js?v=' + VER;
    el.onload = () => ok(true); el.onerror = () => ok(false); document.head.appendChild(el); });
  return sfx2Load;
}

// 0.5.2 Rally panel: 3 speech lines drawn by Rally.panel; invisible buttons sit on its rows (hits are 48px+)
function openRally(i, pick, res) {
  const a = ACTIONS.find(a => a.id === 'rally'); if (!pick && !canDo(a, i)) { snd('cancel'); return; }
  UI.rally = { i, offer: UI.rally && UI.rally.i === i && pick != null ? UI.rally.offer : rallyOffer(i), pick, res };
  modal(`<h2>Rally · ${MAP.p[i].n}</h2><div id="rlWrap" class="rlWrap"><canvas id="rlCv" class="regCv"></canvas><div id="rlHits"></div></div>
    <button class="hot" data-close>${res ? 'Continue' : 'Cancel'}</button>`);
  drawRally();
}
function drawRally() {
  const R = UI.rally, cv = $('rlCv'); if (!R || !cv) return;
  const w = Math.max(240, cv.clientWidth), d = Math.min(devicePixelRatio || 1, 2);
  const o = { lines: R.offer.map(k => ({ text: `"${LINES[k].t}"`, state: R.pick == null ? 'idle' : k !== R.pick ? 'idle' : R.res.ok ? 'landed' : 'backfired' })),
    result: R.res ? { ok: R.res.ok, why: R.res.why } : null };
  const m = Rally.panel(document.createElement('canvas').getContext('2d'), 0, 0, w, o);   // measure, then size and draw
  cv.width = w * d; cv.height = m.height * d; cv.style.height = m.height + 'px';
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); const r = Rally.panel(g, 0, 0, w, o);
  $('rlHits').innerHTML = R.res ? '' : r.hits.map(h => `<button class="rlHit" data-rl="${R.offer[h.i]}" style="left:${h.x}px;top:${h.y}px;width:${h.w}px;height:${h.h}px" aria-label="${LINES[R.offer[h.i]].t}"></button>`).join('');
}
function pickRally(k) {
  const R = UI.rally; if (!R || R.res) return; const res = rallyWith(R.i, k); if (!res) { snd('cancel'); return; } UI.ev[R.i] = 'rally'; MapView.invalidate();
  const fx = res.ok ? 'rallyLands' : 'rallyBackfires';                 // sounds from assets/sfx2.js (a const, so typeof-guarded)
  if (typeof SFX2 !== 'undefined' && typeof SFX2[fx] === 'function') SFX2[fx](); else snd(res.ok ? 'recruit' : 'cancel');
  openRally(R.i, k, res); saveNow(); render();
}

// ================= FIRST-TIME TIPS + ICON LEGEND =================
// One short line per icon. The first time an icon shows up we pop its tip once and remember it in localStorage.
const TIPS = {
  cell: 'Cell: your hidden network. Each week it gives +2% support, +40 recruits, $2K and +2 heat. It also shows regime troops next door. Go dark to cool it.',
  militia: 'Militia: your fighters. Tap it, then a neighbour, to move or attack at End Week.',
  police: 'Police: regime patrols. They raise your cells\' heat.',
  army: 'Army: regime brigades. They retake land and guard the capital.',
  hq: 'Army HQ (gold rim): the elite regime unit. It never defects.',
  warn: 'Amber triangle: your upkeep is close to or above your income. Tap it for the money screen.',
  season: 'Season badge: winter slows moves, mud stops regime armour off the roads.',
  rung1: 'Rung 1 · Police surge: more police, your cells heat up +1 a week. Costs the regime its reserve fund.',
  rung2: 'Rung 2 · Riot units + curfew: the hottest front province gets a curfew. Locals get angry (+1% support).',
  rung3: 'Rung 3 · Army recalled: a brigade arrives at the front. Borders thin out, so foreign powers like you more.',
  rung4: 'Rung 4 · Reserves + emergency budget: extra garrisons, but inflation climbs every week.',
  rung5: 'Rung 5 · Conscription + allies: every garrison grows, but conscription angers the whole country (+1%/week).',
  floater: 'Map colours: green rebel, red regime, yellow contested, grey neutral. Icons: X fighting, arrow rally, ! alert. Tap a province for its numbers.',
};
const TIPS_KEY = 'emberline.tips';
let tipsSeen = (() => { try { return JSON.parse(localStorage.getItem(TIPS_KEY)) || {}; } catch (e) { return {}; } })();
const tipQ = [];
function firstTip(k) {
  if (!TIPS[k] || tipsSeen[k] || tipQ.includes(k) || UI.screen !== 'game') return;
  tipsSeen[k] = 1; try { localStorage.setItem(TIPS_KEY, JSON.stringify(tipsSeen)); } catch (e) {}
  tipQ.push(k); if (tipQ.length === 1) showTip();
}
function showTip() {
  const k = tipQ[0]; if (!k || UI.modal || (k === 'season' && document.querySelector('.dealBox'))) return;   // 0.7.0: no Season tip over a deal card   // 0.5.3: tips wait while a panel is open
  let el = $('tipbox'); if (!el) { el = document.createElement('div'); el.id = 'tipbox'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${TIPS[k]}</span><button data-tipok>OK</button>`; el.hidden = false;
  clearTimeout(UI.tipT); UI.tipT = setTimeout(nextTip, 7000);
}
function nextTip() { tipQ.shift(); const el = $('tipbox'); if (el) el.hidden = true; if (tipQ.length) setTimeout(showTip, 300); }
// The legend page draws the artist's real sprites into small canvases after the modal opens
function openLegend() {
  const rows = [['cell', TIPS.cell], ['militia', TIPS.militia], ['police', TIPS.police], ['army', TIPS.army], ['hq', TIPS.hq],
    ['st:selected', 'Selected unit (bright ring).'], ['st:moved', 'Dimmed: has orders this week.'], ['st:fogged', 'Grey: out of supply, or an ARRESTED cell.'],
    ['season', TIPS.season], ['capital', 'Red dot: the capital. Take it (plus 7 provinces) to win.'],
    ['warn', TIPS.warn], ['r:police', 'Escalation rungs 1-5 (police, curfew, army, reserves, conscription). Lit red = the regime is there now.'], ['f:hardliners', 'Hardliners: want force. Fighting makes them louder.'], ['f:moderates', 'Moderates: want calm. Conscription turns them against the leader.'], ['f:security', 'Security chiefs: arrests make them stronger.'], ['f:oligarchs', 'Oligarchs: hate lost taxes and inflation.'], ['floater', TIPS.floater], ['heat', 'Heat: how hard the regime is looking for you. High heat means more arrests.']];
  modal(`<h2>Icon legend</h2><div class="legend">${rows.map(([k, t]) => `<div class="lg"><canvas data-lg="${k}" width="44" height="44"></canvas><span>${t}</span></div>`).join('')}</div><button class="hot" data-close>OK</button>`);
  const d = Math.min(devicePixelRatio || 1, 2);
  document.querySelectorAll('canvas[data-lg]').forEach(cv => {
    const k = cv.dataset.lg, W = k === 'season' ? 160 : k === 'floater' || k === 'heat' ? 70 : 44; cv.width = W * d; cv.height = 44 * d; cv.style.width = W + 'px'; cv.style.height = '44px';
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
    const spr = (type, st) => { const s = window.Tokens && Tokens.sprite(type, st, 44); if (s) g.drawImage(s, 0, 0, 44, 44); };
    if (['cell', 'militia', 'police', 'army'].includes(k)) spr(k, 'idle');
    else if (k === 'hq') { spr('army', 'idle'); hqRim(g, 22, 22, 44); }
    else if (k.startsWith('st:')) spr('militia', k.slice(3));
    else if (k === 'warn') { const s = window.Warn && Warn.sprite(44); if (s) g.drawImage(s, 0, 0, 44, 44); }
    else if (k === 'season' && window.Season) Season.badge(g, 80, 22, 26, 'winter', 'snow');
    else if ((k === 'dug' || k === 'unscouted') && window.Regime && Regime.mark) Regime.mark(g, k, 6, 6, 32);
    else if ((k.startsWith('r:') || k.startsWith('f:')) && window.Regime && Regime.icon) Regime.icon(g, k.slice(2), 0, 0, 44, k[0] === 'r' ? '#c4472f' : '#ffb02e');
    else if (k === 'garrison') counter(g, 22, 28, 12, '#4a505a', '#cfd3da', '2.3K', 1);
    else if (k === 'capital') { g.fillStyle = '#e4573a'; g.beginPath(); g.arc(22, 22, 7, 0, 7); g.fill(); g.strokeStyle = '#111'; g.stroke(); }
    else if (k === 'floater' || k === 'heat') { g.font = '700 13px "DejaVu Sans Condensed",sans-serif'; g.textAlign = 'center'; g.lineWidth = 2; g.strokeStyle = '#111';
      const L = k === 'heat' ? [['+2 heat', '#e0533a', 26]] : [['+2%', '#ffb02e', 18], ['ARREST', '#e4573a', 36]];
      L.forEach(([txt, c, y]) => { g.strokeText(txt, 35, y); g.fillStyle = c; g.fillText(txt, 35, y); }); }
  });
}

// ================= EVENTS =================
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id !== 'bEnd') snd('tap');
  const d = b.dataset;
  if (b.id === 'bNew') { wipeSave(); goWorld(); }
  if (b.id === 'bLegend' || d.legend != null) { openLegend(); return; }
  if (d.tipok != null) { clearTimeout(UI.tipT); nextTip(); return; }
  else if (b.id === 'bCont') { const s = loadSave(); if (s) startCountry(s.iso, s); }
  else if (b.id === 'bStart') { if (UI.pick) startCountry(UI.pick); }
  else if (b.id === 'bEnd') doEndWeek();
  else if (d.z) MapView.zoomAt(+d.z, MapView.W / 2, MapView.H / 2);
  else if (d.tab) { UI.tab = d.tab; render(); }
  else if (d.act) doAct(d.act);
  else if (d.rl != null) pickRally(+d.rl);
  else if (d.gv != null) { S.gvPick = +d.gv; doAct('organize'); }   // play this grievance card
  else if (d.darkcell) { const c = S.cells.find(c => c.id === +d.darkcell); if (c) { S.sel = c.p; S.darkId = c.id; doAct('dark'); } }   // same rules and cost as the action
  else if (d.card) { if (buyCard(d.card)) { snd('cardPlay'); afterChange(); } }
  else if (d.fac) { S.lead = d.fac; log(`${FACTIONS[d.fac].n} leads the movement`); snd('confirm'); afterChange(); }
  else if (d.pow) {
    const k = +d.k, was = S.powers[k] && !!S.powers[k].pact, ok = d.pow === 'accept' ? answerDeal(k, true) : d.pow === 'refuse' ? answerDeal(k, false) : d.pow === 'ask' ? askBacking(k) : d.pow === 'ally' ? proposeAlliance(k) : ceasefire(k);
    if (d.pow === 'accept' || d.pow === 'refuse') { sfx2(ok ? 'dealAccept' : 'dealRefuse'); setTimeout(() => sfx2('stanceShift', ok), 350); } else snd(ok ? 'diploAccept' : 'diploDecline');
    if (d.pow === 'ally' && ok) sfx2('allianceFormed'); if (was && !S.powers[k].pact) sfx2('allianceBroken');   // 0.8.0
    afterChange();
  }
  else if (d.unit) { selectUnit(+d.unit); }
  else if ('clearpath' in d) { const u = selUnit(); if (u) { u.path = []; snd('unitDrop'); tokensChanged(); render(); } }
  else if (d.au) {
    const k = d.au.replace(/[-+m]/g, '') || d.au.slice(1);
    if (d.au[0] === 'm' && d.au !== 'music-' && d.au !== 'music+') { const bus = d.au.slice(1); SFX.mute(!SFX.isMuted(bus), bus); }
    else { const bus = d.au.startsWith('music') ? 'music' : 'sfx'; SFX.setVolume(bus, SFX.getVolume(bus) + (d.au.endsWith('+') ? 0.1 : -0.1)); }
    render();
  }
  else if (d.ui) setUI(uiScale + (d.ui === '+' ? 0.1 : -0.1));
  else if ('close' in d) { snd('cancel'); closeModal(); render(); showEnd(); }
  else if ('atlas' in d) { snd('confirm'); openAtlas(); }
  else if ('back' in d) { snd('cancel'); closeAtlas(); }
  else if ('new' in d) { wipeSave(); goWorld(); }
});
document.addEventListener('change', e => { if (e.target.id === 'selC') { UI.pick = e.target.value || null; snd('pinSelect'); focusCountry(UI.pick); render(); } });
function focusCountry(iso) { const c = MapView.scene.C && MapView.scene.C.find(c => c.i === iso); if (c) { MapView.z = Math.max(MapView.z, MapView.fitZ * 3); MapView.centerOn(c.cx, c.cy); } }

MapView.onPick = (hit, ctxMenu) => {
  if (UI.screen === 'world') { UI.pick = hit; snd('pinSelect'); render(); }
  else if (UI.screen === 'game' && hit >= 0) {
    if (UI.justGrabbed) { UI.justGrabbed = false; return; }          // the tap already selected a token
    if (selUnit() && !ctxMenu && tryMove(hit)) return;
    selectProv(hit); if (ctxMenu || !wide()) { UI.tab = 'map'; render(); }
  }
};
MapView.onHover = (p, hit) => {
  const tip = $('tip');
  const hp = UI.screen === 'game' && !IS_TOUCH && p ? hit : -1; if (hp !== UI.hoverP) { UI.hoverP = hp; MapView.dirty = true; MapView.cv && (MapView.cv.style.cursor = hp >= 0 ? 'pointer' : ''); }   // 0.10.0
  if (!p || hit == null || hit === -1 || IS_TOUCH) { tip.hidden = true; return; }
  if (UI.screen === 'atlas') { const c = WORLD.c.find(c => c.i === hit); if (!c) { tip.hidden = true; return; } tip.textContent = c.n; tip.style.left = p[0] + 14 + 'px'; tip.style.top = p[1] + 10 + 'px'; tip.hidden = false; return; }
  const name = UI.screen === 'world' ? (WORLD.L[hit] || WORLD.c.find(c => c.i === hit) || {}).n : MAP.p[hit].n + ` · support ${pct(S.P[hit].s)}%`;
  tip.textContent = name; tip.style.left = p[0] + 14 + 'px'; tip.style.top = p[1] + 10 + 'px'; tip.hidden = false;
};
MapView.onTier = () => snd('panTick');

addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT') return;
  const k = e.key;
  if (k === 'Escape' && !UI.modal && UI.selU != null) { deselectUnit(); snd('cancel'); return; }
  if (k === 'Escape') { if (UI.modal) { closeModal(); render(); showEnd(); } snd('cancel'); return; }
  if (k === 'p' || k === 'P') { setPaused(!paused); return; }
  if (paused) return;
  if (k === '+' || k === '=') { setUI(uiScale + 0.1); return; }
  if (k === '-' || k === '_') { setUI(uiScale - 0.1); return; }
  if (k === 'm' || k === 'M') { window.SFX && SFX.toggle(); render(); return; }
  if (k === '?') { modal(`<h2>Shortcuts</h2><p class="log">1-9 actions · Tab / arrows cycle provinces · Enter confirm · Space end week · G map · I intel · F factions · D powers · B budget · WASD pan · wheel zoom · right-click actions · Esc close · U select unit, then arrows/WASD pick target, Enter move, Backspace clear · P pause · +/- UI scale · M mute</p><button class="hot" data-close>OK</button>`); return; }
  if (UI.modal) {
    if (k === 'Enter') { const b = $('mbox').querySelector('button.hot'); if (b) { e.preventDefault(); b.click(); } }
    return;
  }
  if (UI.screen === 'game' && S && unitKeys(e, k)) return;
  const pan = { w: [0, 60], a: [60, 0], s: [0, -60], d: [-60, 0] }[k];
  if (pan && !(k === 'd' && UI.screen === 'game')) { MapView.ox += pan[0]; MapView.oy += pan[1]; MapView.clamp(); MapView.dirty = true; MapView.lastIn = performance.now(); return; }
  if (UI.screen === 'atlas') { if (k === 'Escape' || k === 'Enter') closeAtlas(); return; }
  if (UI.screen === 'world') { if (k === 'Enter' && UI.pick && WORLD.L[UI.pick] && WORLD.L[UI.pick].ok) startCountry(UI.pick); return; }
  if (UI.screen !== 'game' || !S) return;
  if (k === ' ') { e.preventDefault(); doEndWeek(); }
  else if (k === 'Tab' || k.startsWith('Arrow')) { e.preventDefault(); const dir = (e.shiftKey || k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 1; selectProv((S.sel + dir + S.P.length) % S.P.length); snd('panTick'); }
  else if (k >= '1' && k <= '9') { const a = availableActions()[+k - 1]; if (a) doAct(a.id); }
  else if (k === 'Enter') { const a = availableActions().find(a => canDo(a, S.sel)); if (a) doAct(a.id); }
  else if (k === 'd' || k === 'D') { UI.tab = 'pow'; render(); }
  else if (k === 'i' || k === 'I') { UI.tab = 'intel'; render(); }
  else if (k === 'f' || k === 'F') { UI.tab = 'fac'; render(); }      // 0.10.0 tab hotkeys
  else if (k === 'b' || k === 'B') { UI.tab = 'eco'; render(); }
  else if (k === 'g' || k === 'G') { UI.tab = 'map'; render(); }
});

// ---- Pause when the tab is hidden: stop the loop, suspend audio, save ----
let paused = false;
function setPaused(on) {
  paused = on; document.body.classList.toggle('paused', on);
  if (window.AC && AC.state) on ? AC.suspend() : AC.resume();     // AC = shared AudioContext made by sfx.js
  if (on) saveNow();
  MapView.dirty = true;
}
document.addEventListener('visibilitychange', () => setPaused(document.hidden));
addEventListener('pagehide', () => saveNow());                       // iPhone may kill the tab without warning

// ---- Loop: 30Hz fixed step for animation time, draw only when dirty ----
// 0.10.0 i5-2400 budget: cap each map layer at PIX_BUDGET device pixels (software canvas raster dominates frame time at 4K).
// Phones keep their full DPR (a 390px map is far under the budget).
const PIX_BUDGET = 2.2e6, PIX_BUDGET_BIG = 1.5e6;   // big = windows wider than 2560px
function resize() { const r = MapView.cv.getBoundingClientRect(), px = Math.max(1, r.width * r.height), b = innerWidth > 2560 ? PIX_BUDGET_BIG : PIX_BUDGET; MapView.resize(Math.min(DPR_CAP, Math.sqrt(b / px))); }
addEventListener('resize', () => { resize(); render(); });
const STEP = 1 / 30; let acc = 0, last = performance.now(), simTime = 0, frames = 0;
function frame(now) {
  if (UI.loading) { last = now; requestAnimationFrame(frame); return; }   // a new country is loading: draw nothing
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!paused) {
    acc += dt; while (acc >= STEP) { acc -= STEP; simTime += STEP * 1000; if (UI.frontAnim && ++frames % 2 === 0) MapView.frontOnly = MapView.dirty = true; }   // front dashes move at 15fps
    MapView.tick();
  }
  if (MapView.dirty) {
    if (UI.screen !== 'game') { tokCtx.setTransform(1, 0, 0, 1, 0, 0); tokCtx.clearRect(0, 0, tokCv.width, tokCv.height); }
    else if (!MapView.frontOnly) tokAll = true;          // camera moved: tokens must follow
    MapView.frontOnly = false;                           // front-line dash tick: map only, tokens untouched
  }
  if (MapView.dirty && UI.screen !== 'title') { MapView.draw(simTime); MapView.dirty = false; }
  if (UI.screen === 'game') drawTokens(now);
  requestAnimationFrame(frame);
}

// ================= UNIT TOKENS (DESIGN CHANGE 11) =================
// Tokens sit on their own canvas layer above the map. The map is only redrawn when the
// camera moves; while units slide, we clear and redraw just the small boxes that changed.
const tokCtx = tokCv.getContext('2d');
let tokAll = true;
const tokStats = { full: 0, partial: 0, ms: 0 };
const sfx2 = (n, ...a) => { if (typeof SFX2 !== 'undefined' && typeof SFX2[n] === 'function') SFX2[n](...a); };   // 0.7.0: guarded SFX2 call
const sfxCall = (name, ...a) => { if (window.SFX && typeof SFX[name] === 'function') SFX[name](...a); };
const selUnit = () => (S && UI.selU != null) ? allPlayerUnits().find(u => u.id === UI.selU) || null : null;
function tokensChanged() { tokAll = true; }
function tokSize() { return 44; }   // 44px tokens (Tokens.draw scales down from its 56px cache)
const scr = j => { const c = MAP.p[j].c; return [c[0] * MapView.z + MapView.ox, c[1] * MapView.z + MapView.oy]; };

// Which tokens can the player see, and where (CSS pixels)?
function tokenLayout(now) {
  const out = [], groups = new Map(), ts = tokSize();
  const ghosts = (S.arrests || []).map(a => ({ id: 'x' + a.id, side: 'P', type: 'cell', p: a.p, arrested: true }));   // busted cells stay 1 week, greyed
  const units = [...allPlayerUnits(), ...ghosts, ...S.U.filter(u => u.side === 'R' && hasIntel(u.p))];   // fog: regime only where you have intel
  for (const u of units) { const g = groups.get(u.p) || []; g.push(u); groups.set(u.p, g); }
  for (const [p, g] of groups) g.forEach((u, k) => {
    let [x, y] = scr(p); x += (k - (g.length - 1) / 2) * ts * 1.05; y += ts * 0.75;
    const a = UI.anim.get(u.id);
    if (a) {   // sliding: walk along the path, 400ms per step
      const t = Math.max(0, Math.min(1, (now - a.t0) / a.dur)) * (a.path.length - 1), seg = Math.min(a.path.length - 2, Math.floor(t)), f = t - seg;
      const A = scr(a.path[seg]), B = scr(a.path[seg + 1]); const e = f * f * (3 - 2 * f);   // smoothstep easing
      x = A[0] + (B[0] - A[0]) * e; y = A[1] + (B[1] - A[1]) * e + ts * 0.75;
    }
    const state = u.arrested ? 'fogged' : u.id === UI.selU ? 'selected' : (u.side === 'P' && !supplied(u.p)) ? 'fogged' : (u.path && u.path.length) ? 'moved' : 'idle';
    const pips = u.type === 'cell' ? 0 : Math.max(1, Math.min(4, Math.ceil(((u.str || 0) + (u.reg || 0) * 2) / MEN / 3)));
    out.push({ u, x, y, s: ts, state, pips, moving: !!a });
  });
  return out;
}
// Placeholder counter (used only if assets/tokens.js is missing): circle = rebels, hexagon = regime
function placeholderToken(g, type, x, y, size, state, pips) {
  const r = size / 2, rebel = type === 'cell' || type === 'militia';
  g.beginPath();
  if (rebel) g.arc(x, y, r, 0, 7); else for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath(); g.fillStyle = state === 'fogged' ? '#333' : rebel ? '#3a2a10' : '#14263a'; g.fill();
  g.lineWidth = state === 'selected' ? 3 : 1.5; g.strokeStyle = state === 'selected' ? '#fff' : rebel ? '#e8a640' : '#5aa8e8'; g.stroke();
  g.fillStyle = g.strokeStyle; g.font = `600 ${r * 0.9}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText({ cell: 'C', militia: 'M', police: 'P', army: 'A' }[type], x, y - r * 0.1);
  for (let i = 0; i < pips; i++) g.fillRect(x - r * 0.5 + i * r * 0.27, y + r * 0.5, r * 0.2, r * 0.18);
}
// The ONE swappable drawing call: artist sprites if loaded, else the placeholder
function drawToken(g, t) {
  if (window.Tokens && Tokens.draw) Tokens.draw(g, t.u.type, t.x, t.y, t.s, t.state, t.pips); else placeholderToken(g, t.u.type, t.x, t.y, t.s, t.state, t.pips);
  if (t.u.elite) hqRim(g, t.x, t.y, t.s);                              // Army HQ: gold rim
}
// Gold ring around the Army HQ (the one regime unit that never defects)
function hqRim(g, x, y, s) { g.beginPath(); g.arc(x, y, s * 0.56, 0, 7); g.lineWidth = 3; g.strokeStyle = '#e8c050'; g.stroke(); }
const rectOf = t => [t.x - t.s * 0.7, t.y - t.s * 0.7, t.x + t.s * 0.7, t.y + t.s * 0.7];
const hitR = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
let lastRects = new Map();

// Season layer on the token canvas: winter wash under the tokens + the season/weather badge.
// The tint is one pattern anchored at the canvas origin, so we translate by the map offset first
// (snapped to the 128px tile) to keep the snow speckle glued to the map when you pan.
function drawSeason(g) {
  if (!window.Season || !S) return;
  if (S.season === 'winter' && MapView.scene && MapView.scene.land) {
    const T = 128, ox = ((MapView.ox % T) + T) % T - T, oy = ((MapView.oy % T) + T) % T - T, z = MapView.z, d = MapView.dpr;
    g.save();
    g.setTransform(d * z, 0, 0, d * z, d * MapView.ox, d * MapView.oy); g.clip(MapView.scene.land);   // only over this country's land
    g.setTransform(d, 0, 0, d, 0, 0); g.translate(ox, oy); Season.tint(g, MapView.W + 2 * T, MapView.H + 2 * T, 0.3, S.weather === 'snow');
    g.restore();
  }
  const bh = 28 * uiK(); UI.badgeH = bh;                                   // 28px on phone, ~45px at 4K
  Season.badge(g, MapView.W / 2, 10 + bh / 2, bh, S.season, S.weather); firstTip('season');
}
function drawTokens(now) {
  if (!MAP || !S) return;
  const busy = UI.anim.size > 0 || UI.pops.length > 0;
  if (!tokAll && !busy) return;                                   // nothing changed: 0 work this frame
  const t0 = performance.now(), g = tokCtx, d = MapView.dpr, list = tokenLayout(now);
  g.setTransform(d, 0, 0, d, 0, 0);
  if (tokAll) {                                                   // full redraw (camera or selection changed)
    g.clearRect(0, 0, MapView.W, MapView.H); drawSeason(g); drawPathPreview(g); list.forEach(t => drawToken(g, t)); tokStats.full++;
  } else {                                                        // partial: only boxes around moving tokens / pops
    const dirty = [];
    list.forEach(t => { if (t.moving) { dirty.push(rectOf(t)); const o = lastRects.get(t.u.id); if (o) dirty.push(o); } });
    UI.pops.forEach(p => dirty.push(p.r || [0, 0, 0, 0]));
    for (const r of dirty) {
      g.save(); g.beginPath(); g.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); g.clip(); g.clearRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); drawSeason(g);   // repaint the season layer inside the hole
      list.forEach(t => { if (hitR(rectOf(t), r)) drawToken(g, t); }); g.restore();
    }
    tokStats.partial++;
  }
  drawPops(g, now);
  if (tokAll || UI.pops.length) list.forEach(t => firstTip(t.u.elite ? 'hq' : t.u.type));   // first-time tips for icons on screen
  if (UI.drag) { const u = selUnit(); if (u) { g.globalAlpha = 0.6; drawToken(g, { u, x: UI.drag[0], y: UI.drag[1], s: tokSize(), state: 'selected', pips: 0 }); g.globalAlpha = 1; } }
  lastRects = new Map(list.map(t => [t.u.id, rectOf(t)]));
  // finished slides: drop them and do one clean full redraw
  let ended = false; for (const [id, a] of UI.anim) if (now - a.t0 > a.dur) { UI.anim.delete(id); ended = true; }
  UI.pops = UI.pops.filter(p => now - p.t0 < (p.life || 1400)); tokAll = ended || (busy && !UI.anim.size && !UI.pops.length);
  tokStats.ms = performance.now() - t0;
}
// Path preview: dashed line along the queued path + movement-point cost
function drawPathPreview(g) {
  const u = selUnit(); if (!u) return;
  const pts = [u.p, ...u.path].map(scr);
  if (pts.length > 1) {
    g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.strokeStyle = '#f4f1e6'; g.lineWidth = 2.5; g.setLineDash([7, 5]); g.stroke(); g.setLineDash([]);
    const e = pts[pts.length - 1], cost = 2 - mpLeft(u);
    g.font = '600 13px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#111'; g.strokeText(cost + ' MP', e[0], e[1] - 18); g.fillStyle = '#ffe7a8'; g.fillText(cost + ' MP', e[0], e[1] - 18);
  }
  // possible targets: small rings on adjacent provinces you can still reach
  const from = u.path.length ? u.path[u.path.length - 1] : u.p;
  MAP.p[from].a.forEach(j => { const [x, y] = scr(j), ok = !moveProblem(u, j);
    g.beginPath(); g.arc(x, y, j === UI.tgtP ? 12 : 7, 0, 7); g.strokeStyle = ok ? (j === UI.tgtP ? '#fff' : '#e8b04a') : '#6a6a6a'; g.lineWidth = 2; g.stroke(); });
}
// 0.6.0 floater layout, decided once per week: baseline above the name+icon; boxes in CSS px cover the 12px drift.
// A floater that would hit an event icon or a stronger floater is dropped (its words are in the log); names under a kept floater
// step aside until it fades (map labels treat UI.popBoxes as taken).
const popY = (y, k) => y - 13 * k * 0.6 - 28 * k - 8 * k;
function layoutPops() {
  const k = labelK(), g = tokCtx, ic = [], kept = [], hit = (a, q) => a[0] < q[2] && a[2] > q[0] && a[1] < q[3] && a[3] > q[1];
  for (const j in UI.ev) { const [x, y] = scr(+j), r = 14 * k, cy = y - 13 * k * 0.6 - r - 2; ic.push([x - r, cy - r, x + r, cy + r]); }
  for (const p of UI.pops) { const [x0, y] = scr(p.p), yy = popY(y, k);
    g.font = `700 ${p.size}px "DejaVu Sans Condensed",system-ui,sans-serif`; const hw = g.measureText(p.txt).width / 2 + 4, x = Math.max(hw, Math.min(MapView.W - hw, x0));
    const b = [x - hw, yy - p.size * 0.8 - 12 * k, x + hw, yy + 4];
    p.skip = ic.some(q => hit(b, q)) || kept.some(q => hit(b, q)); if (!p.skip) { p.box = b; kept.push(b); } }
  UI.popBoxes = kept; UI.popsOff = performance.now() + 2400;
}
// Battle results as strike symbols and number pops (never gore)
// Floating numbers over a province. Fight pops (old style) or styled pops: {color, size, life, dy, label}.
function drawPops(g, now) {
  for (const p of UI.pops) {
    if (now < p.t0) continue;                                           // waiting for its start time
    const life = p.life || 1400, age = (now - p.t0) / life, [x0, y0] = scr(p.p), y = y0 + (p.dy || 0), k = labelK();
    const yy = popY(y, k) - age * 12 * k;   // 0.6.0: sits above the name and icon, drifts up 12px
    g.font = `700 ${p.size || 16}px "DejaVu Sans Condensed",system-ui,sans-serif`;
    const hw = g.measureText(p.txt).width / 2 + 4, x = Math.max(hw, Math.min(MapView.W - hw, x0));   // keep it on screen at 390
    if (p.skip) continue;
    g.globalAlpha = Math.min(1, Math.max(0, (1 - age) * 3)); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (p.color) {                                                      // cell / arrest floaters: label font, 1px dark outline
      g.font = `700 ${p.size}px "DejaVu Sans Condensed",system-ui,sans-serif`; g.lineWidth = 4; g.strokeStyle = '#05070c';
      g.strokeText(p.txt, x, yy); g.fillStyle = p.color; g.fillText(p.txt, x, yy);
    } else {
      g.font = '700 16px system-ui,sans-serif'; g.lineWidth = 3; g.strokeStyle = '#111'; g.strokeText(p.txt, x, yy); g.fillStyle = p.win ? '#ffd27a' : '#ff7a5a'; g.fillText(p.txt, x, yy);
    }
    g.globalAlpha = 1; p.r = [x - hw - 4, yy - (p.size || 16) - 16 * k, x + hw + 4, y + 4];
  }
}
function startSlides(rep) {
  const t = performance.now();
  rep.moves.forEach(m => { const u = findUnit(m.id); if (!u || m.path.length < 2 || m.path.some(j => !MAP.p[j])) { if (u) console.warn('bad move path', JSON.stringify(m)); return; }
    if (u.side === 'R' && !m.path.some(hasIntel)) return;          // fogged regime moves stay hidden
    UI.anim.set(m.id, { path: m.path, t0: t, dur: 400 * (m.path.length - 1) }); });
  if (rep.moves.some(m => { const u = findUnit(m.id); return u && u.side === 'P'; })) sfxCall('unitMove', 'militia');
  // 0.6.0 clean map: this week's icons, then ONE plain-words floater per province (highest priority wins); details stay in the log
  UI.ev = {}; const F = {}, n = v => v.toLocaleString('en'), say = (p, pri, txt, color) => { if (!F[p] || F[p].pri < pri) F[p] = { pri, txt, color }; };
  (rep.cells || []).forEach(c => { if (c.s) { UI.ev[c.p] = UI.ev[c.p] || 'rally'; say(c.p, 1, `Support up ${Math.round(c.s)}%`, '#00e5a0'); } });
  (rep.defList || []).forEach(p => say(p, 2, 'Soldiers defected', '#00e5a0'));
  rep.fights.forEach(f => { UI.ev[f.p] = 'fight'; say(f.p, 3, f.win ? `Won: lost ${n(f.loss)}, killed ${n(f.enemyLoss)}` : `Lost ${n(f.loss)}, killed ${n(f.enemyLoss)}`, f.win ? '#ffd84a' : '#ff7a5a'); });
  if (rep.persec) { UI.ev[rep.persec.p] = UI.ev[rep.persec.p] || 'alert'; say(rep.persec.p, 2, 'New regime policy', '#ff3b5c'); }
  (rep.arrests || []).forEach((a, k) => { UI.ev[a.p] = UI.ev[a.p] === 'fight' ? 'fight' : 'alert'; say(a.p, 4, 'Cell arrested', '#ff3b5c'); setTimeout(() => sfxCall('cellBusted'), 300 + k * 250); });
  if ((rep.cells || []).length || (rep.arrests || []).length) firstTip('floater');
  const fs = 28 * labelK(); Object.keys(F).sort((a, b) => F[b].pri - F[a].pri).forEach(p => UI.pops.push({ p: +p, t0: t + 300, life: 2000, color: F[p].color, size: fs, txt: F[p].txt }));
  layoutPops(); MapView.invalidate(); setTimeout(() => { UI.popBoxes = []; MapView.invalidate(); }, 2400);   // names come back after the floaters fade
  const L = UI.pops.reduce((m, p) => Math.max(m, p.t0 + (p.life || 1400)), 0); if (UI.pops.length) UI.popsUntil = L;
  tokAll = true;
}
function selectUnit(id) {
  const u = allPlayerUnits().find(u => u.id === id); if (!u) return;
  UI.selU = id; UI.tgtP = -1; UI.umsg = ''; S.sel = u.p; sfxCall('unitPick'); tokAll = true; render();
}
function deselectUnit() { UI.selU = null; UI.tgtP = -1; tokAll = true; render(); }
// Try to send the selected unit to province j. true = handled (moved or refused with a sound)
function tryMove(j) {
  const u = selUnit(); if (!u) return false;
  if (j === u.p && !u.path.length) { deselectUnit(); return true; }
  const why = queueMove(u, j);
  // name the unit in the message: U picks cells first, so "Ordered to X" alone hid WHICH unit got the order
  if (!why) { sfxCall('unitMove', u.type); UI.umsg = `${u.type === 'cell' ? 'Cell' : 'Militia'} ordered to ${u.path.length > 1 ? u.path.map(k => MAP.p[k].n).join(' → ') : MAP.p[j].n}. Moves at End Week.`; tokAll = true; saveNow(); render(); return true; }
  if (why === 'not adjacent') { sfxCall('noMoves'); UI.umsg = 'Too far: units move one province at a time.'; render(); return true; }
  sfxCall('noMoves'); UI.umsg = 'Cannot move: ' + why; render(); return true;
}
// keyboard: U selects next unit; arrows/WASD pick a target; Enter orders; Backspace clears
function unitKeys(e, k) {
  if (k === 'u' || k === 'U') { const L = allPlayerUnits(); if (!L.length) return true; const i = L.findIndex(u => u.id === UI.selU); selectUnit(L[(i + 1) % L.length].id); return true; }
  const u = selUnit(); if (!u) return false;
  const from = u.path.length ? u.path[u.path.length - 1] : u.p, c = MAP.p[from].a;
  const dir = { ArrowRight: 1, ArrowDown: 1, d: 1, s: 1, ArrowLeft: -1, ArrowUp: -1, a: -1, w: -1 }[k];
  if (dir) { e.preventDefault(); const i = c.indexOf(UI.tgtP); UI.tgtP = c[(i + dir + c.length) % c.length]; S.sel = UI.tgtP; snd('panTick'); tokAll = true; render(); return true; }
  if (k === 'Enter' && UI.tgtP >= 0) { e.preventDefault(); tryMove(UI.tgtP); UI.tgtP = -1; tokAll = true; return true; }
  if (k === 'Backspace') { u.path = []; sfxCall('unitDrop'); tokAll = true; render(); return true; }
  return false;
}
// pointer hooks from MapView: grab a token, drag it, drop it on a province
MapView.onDown = p => {
  if (UI.screen !== 'game' || !S) return false;
  const L = tokenLayout(performance.now()).filter(t => t.u.side === 'P' && !t.u.arrested), R = Math.max(22, tokSize() / 2 + 4);   // >=44px target
  const t = L.find(t => Math.hypot(t.x - p[0], t.y - p[1]) < R); if (!t) return false;
  UI.justGrabbed = true; selectUnit(t.u.id); return true;
};
MapView.onDrag = p => { UI.drag = p; tokAll = true; };
MapView.onDrop = (p, j) => { UI.drag = null; UI.justGrabbed = false; tokAll = true; if (j >= 0) { if (!tryMove(j)) sfxCall('unitDrop'); } else sfxCall('unitDrop'); };

function panelUnits() {
  const L = allPlayerUnits(); if (!L.length) return '';
  const u = selUnit(), nm = x => x.type === 'cell' ? 'Cell' : 'Militia';
  let h = '<div class="card"><h3>Your units · tap a token, then a neighbour</h3><div class="row">' +
    L.map(x => `<button data-unit="${x.id}" class="${x.id === UI.selU ? 'hot' : ''}">${nm(x)} · ${MAP.p[x.p].n}${x.type === 'militia' ? ` (${x.str.toLocaleString('en')}${x.reg ? ' + ' + x.reg.toLocaleString('en') + ' reg.' : ''}, ${unitName(x.str + x.reg)})` : ''}</button>`).join('') + '</div>';
  if (u) h += `<div class="kv"><span>Selected</span><span>${nm(u)} in ${MAP.p[u.p].n}</span><span>Moves left</span><span>${mpLeft(u)} / 2 MP</span><span>Supply</span><span>${supplied(u.p) ? 'supplied' : 'OUT OF SUPPLY (−10%/wk, no attacks)'}</span><span>Orders</span><span>${u.path.length ? u.path.map(j => MAP.p[j].n).join(' → ') : 'none'}${u.path.some(j => isDug(j) && !scouted(j)) ? ` · <b class="warnTxt">unscouted dug-in target: +${Math.round(BAL.unscoutedLoss * 100)}% losses</b>` : ''}</span></div>
    <p class="log">${UI.umsg || (isWinter() ? 'Winter: every move costs +1 MP, supply reaches 1 province. ' : '') + 'Hills, forest and marsh cost 2 MP. Moves happen at End Week.'}</p><button data-clearpath>Clear orders</button>${u.type === 'cell' ? `<button class="tog" data-darkcell="${u.id}" aria-pressed="${!!u.dark}">${u.dark ? 'Wake cell' : 'Go dark'}</button>` : ''}`;
  return h + '</div>';
}

// ---- Test hooks for the Playtester ----
window.G = {
  get S() { return S; }, get MAP() { return MAP; }, get UI() { return UI; }, get paused() { return paused; }, get dpr() { return MapView.dpr; },
  get tokStats() { return tokStats; }, layout: () => tokenLayout(performance.now()), moveProblem, hasIntel, forceTokens: () => { tokAll = true; drawTokens(performance.now()); }, orderMove: (id, j) => { const u = findUnit(id); return u ? queueMove(u, j) : 'no unit'; }, selectUnit, tryMove, unitKeys,
  saveNow, loadSave, wipeSave, setPaused, startCountry, goWorld, doAct, doEndWeek, selectProv, view: MapView, GAME_TITLE,
};

// ---- Boot ----
(async function boot() {
  document.title = GAME_TITLE;
  document.querySelectorAll('.gtitle').forEach(el => el.textContent = GAME_TITLE);
  bakeGrain($('grain')); setUI(uiScale);
  if (window.Tokens && Tokens.prerender) Tokens.prerender(devicePixelRatio || 1);   // cache artist sprites once
  if (window.Season && Season.prerender) Season.prerender(devicePixelRatio || 1);   // season badges + winter tiles
  try { await (window.EmberArt ? EmberArt.ready() : 0); } catch (e) {}
  WORLD = await loadJSON('data/world.json');
  if (loadSave()) $('bCont').hidden = false;
  resize(); requestAnimationFrame(frame);
})();
