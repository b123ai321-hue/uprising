// UPRISING upkeep warning icon (original, code-drawn). Amber triangle on a steel plate.
// Warn.draw(ctx, x, y, size, pulse0to1?) draws centered at x,y. Size 44 = the full tap target.
window.Warn = (function () {
  var cache = {};
  function make(px) {
    var c = document.createElement('canvas'); c.width = c.height = px;
    var g = c.getContext('2d'), s = px / 44;
    g.scale(s, s);
    g.fillStyle = '#1b2430'; g.strokeStyle = '#5d7389'; g.lineWidth = 1.5; // steel plate
    g.beginPath(); g.roundRect(3, 3, 38, 38, 6); g.fill(); g.stroke();
    g.fillStyle = '#ffb02e'; g.strokeStyle = '#2a1a05'; g.lineWidth = 2;     // amber triangle
    g.beginPath(); g.moveTo(22, 9); g.lineTo(36, 34); g.lineTo(8, 34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1b1206';                                                 // ! mark
    g.fillRect(20.5, 16, 3, 10); g.fillRect(20.5, 28.5, 3, 3);
    return c;
  }
  function sprite(size) {
    var px = Math.ceil(size * Math.min(window.devicePixelRatio || 1, 2));
    return cache[px] || (cache[px] = make(px));
  }
  function draw(ctx, x, y, size, pulse) {
    size = size || 44;
    if (pulse) { ctx.save(); ctx.shadowColor = '#ffb02e'; ctx.shadowBlur = 10 * pulse; }
    ctx.drawImage(sprite(size), x - size / 2, y - size / 2, size, size);
    if (pulse) ctx.restore();
  }
  return { draw: draw, sprite: sprite };
})();
