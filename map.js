// map.js: draws the world screen and the country screen on one canvas.
// Big ideas (for a beginner):
//  - Map files store outlines as compact text; dec() turns them back into numbers.
//  - Things that rarely change (paper, hatching, fills, borders) are drawn ONCE into
//    an offscreen canvas per detail tier, then just copied to the screen each frame.
//  - Things that change (labels, front line, counters, selection) are drawn live.
'use strict';

// Undo tools/build_maps.py enc(): text -> [x0,y0,x1,y1,...] (delta + zigzag)
function dec(str) {
  const out = [], prev = [0, 0]; let z = 0, sh = 0, i = 0;
  for (const ch of str) {
    const c = ch.charCodeAt(0) - 63;
    z |= (c & 31) << sh;
    if (c & 32) { sh += 5; continue; }              // more 5-bit chunks follow
    const d = (z & 1) ? ~(z >> 1) : (z >> 1);       // un-zigzag
    prev[i % 2] += d; out.push(prev[i % 2]); i++; z = 0; sh = 0;
  }
  return out;
}
function ringPath(p2d, pts) { p2d.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p2d.lineTo(pts[i], pts[i + 1]); p2d.closePath(); }

// ---- A "view" is a camera over a scene. One MapView instance is shared. ----
const MapView = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  scene: null,          // object with w, h, tiers[], drawStatic(), drawLive(), pick()
  z: 1, ox: 0, oy: 0,   // screen = world * z + offset (CSS pixels)
  fitZ: 1, vx: 0, vy: 0, dirty: true, tier: -1, caches: [],
  onPick: null, onHover: null, onTier: null,
  onDown: null, onDrag: null, onDrop: null,   // token drag hooks (game.js)
  layers: [],                                 // extra canvases on top (front line fx, tokens)

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.input();
  },
  resize(dprCap) {
    const r = this.cv.getBoundingClientRect();
    this.W = r.width; this.H = r.height; this.dpr = Math.min(dprCap, devicePixelRatio || 1);
    for (const c of [this.cv, ...this.layers]) { c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr); }
    if (this.scene) this.fit(true);
    this.dirty = true;
  },
  setScene(sc) { this.scene = sc; this.caches = []; this.tier = -1; this.fit(); this.dirty = true; },
  fit(keep) {
    const s = this.scene; if (!s || !this.W) return;
    const old = this.fitZ;
    this.fitZ = Math.min(this.W / s.w, this.H / s.h) * 0.94;
    if (keep && old) { this.z *= this.fitZ / old; }
    else { this.z = this.fitZ; }
    this.ox = (this.W - s.w * this.z) / 2; this.oy = (this.H - s.h * this.z) / 2;
    this.caches = [];       // canvas size changed: rebuild caches lazily
  },
  // zoom by factor f keeping the point (sx,sy) under the finger/cursor fixed
  zoomAt(f, sx, sy) {
    const nz = Math.max(this.fitZ * 0.8, Math.min(this.fitZ * 14, this.z * f));
    f = nz / this.z; this.ox = sx - (sx - this.ox) * f; this.oy = sy - (sy - this.oy) * f; this.z = nz;
    this.clamp(); this.dirty = true; this.lastIn = performance.now();
  },
  clamp() {   // keep at least part of the map on screen
    const s = this.scene, mw = s.w * this.z, mh = s.h * this.z, m = 60;
    this.ox = Math.min(this.W - m, Math.max(m - mw, this.ox));
    this.oy = Math.min(this.H - m, Math.max(m - mh, this.oy));
  },
  toWorld(sx, sy) { return [(sx - this.ox) / this.z, (sy - this.oy) / this.z]; },
  centerOn(x, y) { this.ox = this.W / 2 - x * this.z; this.oy = this.H / 2 - y * this.z; this.clamp(); this.dirty = true; },

  // Level of detail: 3 tiers. 0 = coarse cache, 1 = fine cache, 2 = fine vectors drawn live.
  pickTier() { const r = this.z / this.fitZ; return r < 0.99 ? 0 : r < 4 ? 1 : 2; },
  // Cache slots: 0 = coarse shapes (zoomed out), 1 = fine shapes near 1:1 at normal zoom,
  // 2 = fine shapes at higher resolution for zoom 1.6x-4x. Keeping the cache close to screen
  // size makes the per-frame copy cheap (copying a much bigger image and shrinking it is slow).
  getCache(t) {
    if (this.caches[t]) return this.caches[t];
    const s = this.scene, scale = this.fitZ * (t === 0 ? 1 : t === 1 ? 1 : 4) * this.dpr;
    const k = Math.min(scale, 4096 / Math.max(s.w, s.h));   // never bigger than 4096px
    const c = document.createElement('canvas');
    c.width = Math.ceil(s.w * k); c.height = Math.ceil(s.h * k);
    const g = c.getContext('2d'); g.scale(k, k);
    s.drawStatic(g, t === 0 ? 0 : 1, 1 / k);   // 1/k = one device pixel in world units
    return (this.caches[t] = { c, k });
  },
  invalidate() { this.caches = []; this.dirty = true; },

  draw(time) {
    const s = this.scene, g = this.ctx; if (!s) return;
    const t = this.pickTier(); if (t !== this.tier) { if (this.tier >= 0 && this.onTier) this.onTier(t); this.tier = t; }
    // 0.10.0 perf: while panning/zooming (and 150ms after) draw from the cached coarse layer and skip crisp borders;
    // a full-quality frame follows once input stops (see tick).
    const fast = this.lowRes = performance.now() - (this.lastIn || 0) < 150;
    const gg = g, d = this.dpr;
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.fillStyle = s.sea || '#1a2024'; gg.fillRect(0, 0, gg.canvas.width, gg.canvas.height);
    const r = this.z / this.fitZ, cache = this.getCache(fast || t === 0 ? 0 : r < 1.5 ? 1 : 2);
    gg.imageSmoothingEnabled = true; gg.imageSmoothingQuality = 'low';
    // copy only the part of the cache that is on screen
    const k = cache.k, sx0 = Math.max(0, -this.ox / this.z), sy0 = Math.max(0, -this.oy / this.z);
    const sx1 = Math.min(s.w, (this.W - this.ox) / this.z), sy1 = Math.min(s.h, (this.H - this.oy) / this.z);
    if (sx1 > sx0 && sy1 > sy0)
      gg.drawImage(cache.c, sx0 * k, sy0 * k, (sx1 - sx0) * k, (sy1 - sy0) * k,
        (sx0 * this.z + this.ox) * d, (sy0 * this.z + this.oy) * d, (sx1 - sx0) * this.z * d, (sy1 - sy0) * this.z * d);
    // world-space transform for live drawing
    g.setTransform(this.z * d, 0, 0, this.z * d, this.ox * d, this.oy * d);
    if (t === 2 && s.drawCrisp && !fast) s.drawCrisp(g, 1 / (this.z * d));   // sharp borders when very close
    s.drawLive(g, this, time);
  },

  // ---- input: pointer drag/pinch with inertia, wheel zoom, tap pick, hover ----
  input() {
    const cv = this.cv, P = new Map(); let downT = 0, moved = 0, lastPinch = 0, hoverT = 0, lastMv = [0, 0, 0], grab = false;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); P.set(e.pointerId, pos(e));
      grab = P.size === 1 && !!(this.onDown && this.onDown(pos(e)));   // grabbed a unit token?
      this.vx = this.vy = 0; if (P.size === 1) { downT = performance.now(); moved = 0; }
      lastPinch = 0;
    });
    cv.addEventListener('pointermove', e => {
      const p = pos(e);
      if (!P.has(e.pointerId)) {      // mouse hover: tooltip after 250ms
        clearTimeout(hoverT);
        hoverT = setTimeout(() => this.onHover && this.onHover(p, this.scene.pick(...this.toWorld(...p))), 250);
        return;
      }
      const old = P.get(e.pointerId); P.set(e.pointerId, p);
      if (grab) { moved += Math.abs(p[0] - old[0]) + Math.abs(p[1] - old[1]); if (moved > 8 && this.onDrag) this.onDrag(p); return; }
      if (P.size === 1) {
        const dx = p[0] - old[0], dy = p[1] - old[1]; moved += Math.abs(dx) + Math.abs(dy);
        this.ox += dx; this.oy += dy; this.clamp(); this.lastIn = performance.now();
        const now = performance.now(), dt = Math.max(8, now - lastMv[2]);
        this.vx = dx / dt * 16; this.vy = dy / dt * 16; lastMv = [0, 0, now];
      } else if (P.size === 2) {     // pinch: zoom by change in finger distance
        const [a, b] = [...P.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (lastPinch) this.zoomAt(dist / lastPinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        lastPinch = dist; moved = 99;
      }
      this.dirty = true;
    });
    const up = e => {
      if (!P.has(e.pointerId)) return;
      const p = P.get(e.pointerId); P.delete(e.pointerId); lastPinch = 0;
      if (grab) { grab = false; if (moved > 8) { this.onDrop && this.onDrop(p, this.scene.pick(...this.toWorld(...p))); return; } }
      if (moved < 8 && performance.now() - downT < 450 && e.button !== 2) {   // a tap
        this.vx = this.vy = 0;
        const hit = this.scene.pick(...this.toWorld(...p)); if (this.onPick) this.onPick(hit, false);
      }
      if (performance.now() - lastMv[2] > 80) this.vx = this.vy = 0;   // finger stopped before lifting
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { clearTimeout(hoverT); this.onHover && this.onHover(null, -1); });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); this.zoomAt(Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
    cv.addEventListener('contextmenu', e => {      // right-click: select + open actions
      e.preventDefault(); const hit = this.scene.pick(...this.toWorld(...pos(e))); if (this.onPick) this.onPick(hit, true);
    });
  },
  // called every frame by the game loop: inertia glide
  tick() {
    if (Math.abs(this.vx) + Math.abs(this.vy) > 0.05) {
      this.ox += this.vx; this.oy += this.vy; this.vx *= 0.92; this.vy *= 0.92; this.clamp(); this.dirty = true; this.lastIn = performance.now();
    } else if (this.lowRes && performance.now() - (this.lastIn || 0) >= 150) this.dirty = true;   // settle: full-quality redraw
  },
};

// ---- Paper texture with ink hatching, baked once and reused as a pattern ----
let HATCH = null;
function hatchCanvas() {
  if (HATCH) return HATCH;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.strokeStyle = 'rgba(20,24,20,.22)'; g.lineWidth = 1;
  for (let i = -64; i < 128; i += 7) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); }
  return (HATCH = c);
}

// Film grain: random noise baked ONCE into a PNG, shown by a CSS overlay (0 cost per frame)
function bakeGrain(el) {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), im = g.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); el.style.backgroundImage = `url(${c.toDataURL()})`;
}

// ---- Labels that never overlap: place in priority order, skip any that would collide ----
const _tw = new Map();
function placeLabels(g, items, view, px, taken) {
  // items: [{x,y,text,pri,size,color}] in world coords. px = world units per device pixel.
  items.sort((a, b) => b.pri - a.pri);
  const placed = (taken || []).slice(), d = view.dpr;   // taken: rects already used (event icons)
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const it of items) {
    const sx = (it.x * view.z + view.ox) * d, sy = (it.y * view.z + view.oy) * d;
    if (sx < -50 || sy < -20 || sx > view.cv.width + 50 || sy > view.cv.height + 20) continue;
    const fs = Math.round(it.size * d), key = it.text + fs;
    g.font = `${it.bold ? 700 : 400} ${fs}px "DejaVu Sans Condensed",system-ui,sans-serif`;
    let w = _tw.get(key); if (w === undefined) { w = g.measureText(it.text).width; _tw.set(key, w); }
    const r = [sx - w / 2 - 3 * d, sy - fs * 0.6, sx + w / 2 + 3 * d, sy + fs * 0.6];
    if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;   // overlap: skip
    placed.push(r);
    g.lineWidth = 3 * d; g.strokeStyle = 'rgba(16,19,20,.85)'; g.strokeText(it.text, sx, sy);   // ink halo (not a blur)
    g.fillStyle = it.color || '#e6dfcc'; g.fillText(it.text, sx, sy);
  }
  g.restore(); return placed;
}
