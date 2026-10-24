/* UPRISING (emberline) season + weather art. Original code-drawn, invented glyphs.
 * API: Season.prerender(dpr), Season.badge(ctx,x,y,size,season,weather),
 *      Season.tint(ctx,w,h,amount0..1), Season.TYPES, Season.WEATHER.
 * Badges and the tint tiles are cached offscreen canvases at 2x devicePixelRatio
 * (same as tokens.js); badge() only blits, tint() is one pattern fillRect. */
(function () {
  var TYPES = ['spring', 'summer', 'autumn', 'winter'];
  var WEATHER = ['clear', 'rain', 'snow', 'storm'];
  // War-room palette: dark plate, neon accent per season.
  var COL = { spring: '#5fe0a0', summer: '#ffb43a', autumn: '#ff7a3a', winter: '#9fd8ff' };
  var WCOL = '#dfe9f2', PLATE = 'rgba(10,16,22,0.88)';
  var cache = {}, scale = 2, tiles = [], pats = [], patCtx = [];

  // Height buckets so a few canvases serve every UI size.
  function bucket(s) { return s <= 20 ? 20 : s <= 28 ? 28 : s <= 44 ? 44 : s <= 72 ? 72 : 120; }

  // Season glyphs in a unit box of radius 1 (filled/stroked in season colour).
  var SG = {
    // Spring: sprout (stem + two leaf lobes).
    spring: function (c) {
      c.beginPath(); c.moveTo(0, .7); c.lineTo(0, -.1); c.stroke();
      c.beginPath(); c.ellipse(-.3, -.25, .32, .16, -.6, 0, 7); c.fill();
      c.beginPath(); c.ellipse(.3, -.4, .32, .16, .6, 0, 7); c.fill();
    },
    // Summer: sun disc with 8 short rays.
    summer: function (c) {
      c.beginPath(); c.arc(0, 0, .32, 0, 7); c.fill();
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4;
        c.beginPath(); c.moveTo(Math.cos(a) * .5, Math.sin(a) * .5); c.lineTo(Math.cos(a) * .75, Math.sin(a) * .75); c.stroke(); }
    },
    // Autumn: falling diamond leaf with a vein.
    autumn: function (c) {
      c.beginPath(); c.moveTo(0, -.7); c.lineTo(.45, 0); c.lineTo(0, .55); c.lineTo(-.45, 0); c.closePath(); c.fill();
      c.strokeStyle = PLATE; c.beginPath(); c.moveTo(0, -.45); c.lineTo(0, .75); c.stroke();
    },
    // Winter: six-armed crystal.
    winter: function (c) {
      for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3, x = Math.cos(a), y = Math.sin(a);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(x * .8, y * .8); c.stroke();
        c.beginPath(); c.moveTo(x * .5 + y * .2, y * .5 - x * .2); c.lineTo(x * .62, y * .62);
        c.lineTo(x * .5 - y * .2, y * .5 + x * .2); c.stroke(); }
    }
  };

  // Weather mark drawn beside the season glyph (unit box, centred).
  var WG = {
    clear: function (c) { c.beginPath(); c.arc(0, 0, .3, 0, 7); c.stroke(); },
    rain: function (c) { for (var i = -1; i < 2; i++) { c.beginPath(); c.moveTo(i * .38 + .12, -.5); c.lineTo(i * .38 - .12, .5); c.stroke(); } },
    snow: function (c) { [[-.32, -.3], [.32, -.3], [0, .35]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], .17, 0, 7); c.fill(); }); },
    storm: function (c) { c.beginPath(); c.moveTo(.2, -.75); c.lineTo(-.35, .08); c.lineTo(0, .08); c.lineTo(-.2, .75); c.lineTo(.4, -.12); c.lineTo(.05, -.12); c.closePath(); c.fill(); }
  };

  function label(s, w) { return (s + ' \u00b7 ' + w).toUpperCase(); }

  // Build one badge canvas: rounded plate, neon edge, glyph, label.
  function build(h, s, w) {
    var fs = Math.round(h * .46), font = '700 ' + fs + 'px system-ui,-apple-system,sans-serif';
    var m = document.createElement('canvas').getContext('2d'); m.font = font;
    var tw = Math.ceil(m.measureText(label(s, w)).width + fs * .1 * label(s, w).length * .2);
    var W = Math.ceil(h * 1.5 + tw + h * .4), cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = h * scale;
    var c = cv.getContext('2d'); c.scale(scale, scale);
    var col = COL[s], lw = Math.max(1, h / 24), r = h * .22;
    c.beginPath(); c.roundRect(lw / 2, lw / 2, W - lw, h - lw, r);
    c.fillStyle = PLATE; c.fill();
    c.shadowColor = col; c.shadowBlur = h * .18; c.strokeStyle = col; c.lineWidth = lw; c.stroke(); c.shadowBlur = 0;
    // HUD tick: divider between glyph and text.
    c.fillStyle = col; c.fillRect(h * 1.36, h * .22, lw, h * .56);
    // Glyph.
    c.save(); c.translate(h * .5, h * .5); c.scale(h * .34, h * .34);
    c.lineWidth = .14; c.lineCap = 'round'; c.lineJoin = 'round'; c.fillStyle = c.strokeStyle = col;
    SG[s](c); c.restore();
    c.save(); c.translate(h * 1.06, h * .5); c.scale(h * .27, h * .27); c.lineWidth = .24; c.lineCap = 'round';
    c.fillStyle = c.strokeStyle = WCOL; WG[w](c); c.restore();
    // Label.
    c.font = font; c.textBaseline = 'middle'; c.fillStyle = WCOL;
    if (c.letterSpacing !== undefined) c.letterSpacing = (fs * .06) + 'px';
    c.fillText(label(s, w), h * 1.56, h * .53);
    return cv;
  }

  function get(h, s, w) { var k = h + s + w; return cache[k] || (cache[k] = build(h, s, w)); }

  // Tint tile: blue-white wash baked in, plus optional sparse snow speckle (128 css px), deterministic pseudo-random dots.
  function buildSnow(wash, dots) {
    var T = 128, cv = document.createElement('canvas'); cv.width = cv.height = T * scale;
    var c = cv.getContext('2d'); c.scale(scale, scale); var seed = 7;
    if (wash) { c.fillStyle = 'rgba(196,226,255,.34)'; c.fillRect(0, 0, T, T); }
    if (!dots) return cv;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 34; i++) { c.globalAlpha = .3 + rnd() * .45; c.fillStyle = '#f2f8ff';
      c.beginPath(); c.arc(rnd() * T, rnd() * T, .6 + rnd() * 1.1, 0, 7); c.fill(); }
    return cv;
  }

  window.Season = {
    TYPES: TYPES, WEATHER: WEATHER,
    prerender: function (dpr) {
      scale = Math.max(1, dpr || 1) * 2; cache = {}; pats = []; tiles = [buildSnow(true, 0), buildSnow(true, 1)];
      [20, 28, 44].forEach(function (h) { TYPES.forEach(function (s) { WEATHER.forEach(function (w) { get(h, s, w); }); }); });
    },
    // Centred badge; size = height in css px. Blit only.
    badge: function (ctx, x, y, size, s, w) {
      if (COL[s] === undefined) s = 'spring'; if (!WG[w]) w = 'clear';
      var cv = get(bucket(size), s, w), k = size / bucket(size), dw = cv.width / scale * k;
      ctx.drawImage(cv, Math.round(x - dw / 2), Math.round(y - size / 2), dw, size);
    },
    // Cool winter wash + optional snow speckle (pass snow=false to omit). amount 0..1.
    // One pattern fillRect at (0,0) of the current transform (translate first to offset).
    tint: function (ctx, w, h, amount, snow) {
      var a = Math.max(0, Math.min(1, amount || 0)); if (!a) return;
      var k = snow === false ? 0 : 1;
      if (!tiles[k]) tiles[k] = buildSnow(true, k);
      if (!pats[k] || patCtx[k] !== ctx) { pats[k] = ctx.createPattern(tiles[k], 'repeat');
        pats[k].setTransform(new DOMMatrix().scale(1 / scale)); patCtx[k] = ctx; }
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = pats[k]; ctx.fillRect(0, 0, w, h); // single fill
      ctx.restore();
    }
  };
})();
