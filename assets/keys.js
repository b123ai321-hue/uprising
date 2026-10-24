// UPRISING PC art: key-cap hints + hover glow. Original, code-drawn. Credit: the studio team.
(function(){var K={};
// cap(ctx,x,y,label) -> width. Small key-cap chip, e.g. "E", "Space", "Esc".
K.cap=function(c,x,y,s){c.font='bold 10px system-ui,sans-serif';var w=Math.max(18,c.measureText(s).width+10);
c.fillStyle='#141b27';c.fillRect(x,y,w,18);c.fillStyle='#22e1ff';c.fillRect(x,y+16,w,2);c.strokeStyle='#2c3a50';c.strokeRect(x+.5,y+.5,w-1,17);
c.fillStyle='#d8e2f0';c.textAlign='center';c.textBaseline='middle';c.fillText(s,x+w/2,y+9);return w;};
// hint(ctx,x,y,[[key,text],...]) -> height. Row of "[E] End week  [M] Map" hints for a footer.
K.hint=function(c,x,y,list){var cx=x;list.forEach(function(p){cx+=K.cap(c,cx,y,p[0])+5;c.font='11px system-ui';c.fillStyle='#7f8ea3';c.textAlign='left';c.textBaseline='middle';c.fillText(p[1],cx,y+9);cx+=c.measureText(p[1]).width+14;});return 18;};
// hover(ctx,x,y,w,h,color): neon outline for mouse-over on any card/button.
K.hover=function(c,x,y,w,h,col){c.save();c.shadowColor=col||'#22e1ff';c.shadowBlur=12;c.strokeStyle=col||'#22e1ff';c.lineWidth=2;c.strokeRect(x+1,y+1,w-2,h-2);c.restore();};
window.Keys=K;})();
