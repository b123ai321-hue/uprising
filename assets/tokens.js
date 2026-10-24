/* UPRISING (emberline) unit tokens. Original code-drawn art, invented insignia.
 * Rebels (Cell, Militia) = warm amber ROUND counters.
 * Regime (Police, Army)  = cool steel-blue HEX counters.
 * Side is read by colour AND shape (colourblind-safe: amber vs blue + circle vs hex).
 * API: Tokens.prerender(dpr), Tokens.sprite(type,state,size), Tokens.draw(ctx,type,x,y,size,state[,pips])
 * Sprites are cached offscreen canvases at 2x devicePixelRatio; draw() only blits (drawImage)
 * plus fillRect pips, so there is no per-frame path drawing. */
(function () {
  var TYPES = ['cell', 'militia', 'police', 'army'];
  var STATES = ['idle', 'selected', 'moved', 'fogged'];
  var SIDE = { cell: 'R', militia: 'R', police: 'G', army: 'G' };
  // War-room palette (theme C): dark plate, neon edge per side.
  var PAL = {
    R: { edge: '#ffb43a', glyph: '#ffd27a', fill: '#2a1d0c' },
    G: { edge: '#4fb4ff', glyph: '#a8dcff', fill: '#0c1a2a' }
  };
  var SEL = '#f4f1e6';            // selection ring (neutral white)
  var cache = {}, scale = 2;      // scale = dpr * 2 oversample

  // Size bucket so a few cached canvases serve every zoom level.
  function bucket(s) { return s <= 32 ? 32 : s <= 56 ? 56 : s <= 112 ? 112 : 224; }

  // Counter outline: circle for rebels, flat-top hexagon for regime.
  function shape(c, side, r) {
    c.beginPath();
    if (side === 'R') c.arc(0, 0, r, 0, 7);
    else for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i;
      c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.04, Math.sin(a) * r * 1.04);
    }
    c.closePath();
  }

  // Invented insignia, drawn in a unit box of radius 1 (scaled by caller).
  var GLYPH = {
    // Cell: three linked nodes (a small hidden network), dashed links = stealth.
    cell: function (c) {
      var p = [[0, -.5], [-.45, .3], [.45, .3]];
      c.setLineDash([.12, .1]); c.beginPath();
      c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.lineTo(p[2][0], p[2][1]); c.closePath(); c.stroke();
      c.setLineDash([]);
      p.forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], .17, 0, 7); c.fill(); });
    },
    // Militia: rising ember (diamond flame over a ground bar).
    militia: function (c) {
      c.beginPath(); c.moveTo(0, -.62); c.lineTo(.34, -.02); c.lineTo(0, .3); c.lineTo(-.34, -.02); c.closePath(); c.fill();
      c.fillRect(-.55, .42, 1.1, .16);
    },
    // Police: watch lens (almond outline, centre dot, brow bar).
    police: function (c) {
      c.beginPath(); c.moveTo(-.6, .05); c.quadraticCurveTo(0, -.55, .6, .05); c.quadraticCurveTo(0, .6, -.6, .05); c.closePath(); c.stroke();
      c.beginPath(); c.arc(0, .05, .16, 0, 7); c.fill();
      c.fillRect(-.4, -.6, .8, .13);
    },
    // Army: three stacked solid blocks (massed formation), widest at the base.
    army: function (c) {
      c.fillRect(-.22, -.5, .44, .24); c.fillRect(-.38, -.14, .76, .24); c.fillRect(-.54, .22, 1.08, .24);
    }
  };

  // Render one sprite. Canvas is square, size*scale px, with a margin for the select ring.
  function render(type, state, size) {
    var side = SIDE[type], P = PAL[side], px = Math.ceil(size * scale);
    var cv = document.createElement('canvas'); cv.width = cv.height = px;
    var c = cv.getContext('2d'), r = px * .4;
    c.translate(px / 2, px / 2);
    var lw = Math.max(1.5, px * .055);           // edge weight survives 28px
    var ghost = state === 'fogged';
    if (state === 'moved') c.globalAlpha = .45;   // dimmed: already used its move
    // Plate
    shape(c, side, r);
    if (!ghost) { c.fillStyle = P.fill; c.fill(); }
    c.lineWidth = lw; c.strokeStyle = P.edge;
    if (ghost) { c.globalAlpha = .55; c.setLineDash([lw * 1.6, lw * 1.2]); } // dashed outline
    c.stroke(); c.setLineDash([]);
    // Inner hairline for the HUD look (skipped when fogged)
    if (!ghost) { shape(c, side, r * .8); c.lineWidth = lw * .3; c.globalAlpha *= .5; c.stroke(); c.globalAlpha = state === 'moved' ? .45 : 1; }
    // Insignia (offset up to leave room for the pip slot)
    c.save(); c.translate(0, -r * .12); c.scale(r * .74, r * .74);
    c.fillStyle = c.strokeStyle = ghost ? P.edge : P.glyph;
    c.lineWidth = .17; c.lineCap = 'round';
    GLYPH[type](c); c.restore();
    // Strength pip slot: dark tray along the bottom (pips are filled at draw time)
    if (!ghost) { c.fillStyle = '#000'; c.globalAlpha *= .6; c.fillRect(-r * .5, r * .52, r, r * .22); }
    c.globalAlpha = 1;
    // Selected: bright outer ring + corner brackets
    if (state === 'selected') {
      c.strokeStyle = SEL; c.lineWidth = lw * .8;
      shape(c, side, r * 1.1); c.stroke();
    }
    return cv;
  }

  // Cached sprite for a type/state at a CSS size.
  function sprite(type, state, size) {
    var b = bucket(size || 48), k = type + state + b;
    return cache[k] || (cache[k] = render(type, state || 'idle', b));
  }

  // Build every type/state for each bucket at 2x devicePixelRatio.
  function prerender(dpr) {
    scale = Math.min(2, dpr || window.devicePixelRatio || 1) * 2; cache = {};
    [32, 56, 112].forEach(function (b) {
      TYPES.forEach(function (t) { STATES.forEach(function (s) { sprite(t, s, b); }); });
    });
  }

  // Draw centred at x,y (CSS px). pips = optional strength 0..4 (fillRect only).
  function draw(ctx, type, x, y, size, state, pips) {
    var cv = sprite(type, state, size), d = size; // bucket sprite scaled to size
    ctx.drawImage(cv, x - d / 2, y - d / 2, d, d);
    if (pips && state !== 'fogged') {
      var r = size * .4, w = r / 4, h = r * .16, y0 = y + r * .55;
      ctx.globalAlpha = state === 'moved' ? .45 : 1;
      ctx.fillStyle = PAL[SIDE[type]].glyph;
      for (var i = 0; i < Math.min(4, pips); i++) ctx.fillRect(x - r * .5 + i * w + w * .12, y0, w * .76, h);
      ctx.globalAlpha = 1;
    }
  }

  window.Tokens = { draw: draw, sprite: sprite, prerender: prerender, TYPES: TYPES, STATES: STATES };
})();
