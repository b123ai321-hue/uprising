// UPRISING regime-type picker art. Original, code-drawn. Credit: the studio team.
(function(){
const R={TYPES:['junta','party','theocracy','monarchy','oligarchy','puppet'],
NAMES:{junta:'Military Junta',party:'One-Party State',theocracy:'Theocracy',monarchy:'Absolute Monarchy',oligarchy:'Oligarchy',puppet:'Puppet Regime'},
COLORS:{junta:'#ff3b5c',party:'#ff8a00',theocracy:'#c9a0ff',monarchy:'#ffd84a',oligarchy:'#00e5a0',puppet:'#3ad6ff'}};
function glyph(c,x,y,s,t){c.save();c.translate(x,y);c.strokeStyle=R.COLORS[t];c.fillStyle=R.COLORS[t];c.lineWidth=Math.max(1.5,s/12);c.beginPath();
 if(t==='junta'){for(let i=0;i<5;i++){const a=-Math.PI/2+i*4*Math.PI/5;c.lineTo(Math.cos(a)*s*.42,Math.sin(a)*s*.42);}c.closePath();c.stroke();}
 else if(t==='party'){c.arc(0,0,s*.4,0,7);c.stroke();c.beginPath();c.rect(-s*.15,-s*.15,s*.3,s*.3);c.fill();}
 else if(t==='theocracy'){c.moveTo(0,-s*.42);c.lineTo(s*.36,s*.3);c.lineTo(-s*.36,s*.3);c.closePath();c.stroke();c.beginPath();c.arc(0,s*.05,s*.1,0,7);c.fill();}
 else if(t==='monarchy'){c.moveTo(-s*.4,s*.25);c.lineTo(-s*.4,-s*.2);c.lineTo(-s*.2,0);c.lineTo(0,-s*.35);c.lineTo(s*.2,0);c.lineTo(s*.4,-s*.2);c.lineTo(s*.4,s*.25);c.closePath();c.stroke();}
 else if(t==='oligarchy'){for(let i=-1;i<=1;i++){c.moveTo(i*s*.25,s*.35);c.lineTo(i*s*.25,-s*.1+Math.abs(i)*s*.12);}c.stroke();c.beginPath();c.moveTo(-s*.42,s*.35);c.lineTo(s*.42,s*.35);c.stroke();}
 else {c.arc(0,s*.1,s*.25,0,7);c.stroke();c.beginPath();c.moveTo(-s*.15,-s*.42);c.lineTo(-s*.1,-s*.12);c.moveTo(s*.15,-s*.42);c.lineTo(s*.1,-s*.12);c.stroke();}
 c.restore();}
R.icon=glyph;
// card(ctx,x,y,w,{type,lines:[str],selected}) -> height 88
R.card=function(c,x,y,w,o){const h=88,col=R.COLORS[o.type];c.save();c.fillStyle='#0b0e17';c.fillRect(x,y,w,h);
 c.strokeStyle=o.selected?col:'#2a3145';c.lineWidth=o.selected?2:1;c.strokeRect(x+.5,y+.5,w-1,h-1);
 c.fillStyle=col;c.fillRect(x,y,4,h);if(o.selected){c.globalAlpha=.08;c.fillRect(x,y,w,h);c.globalAlpha=1;}
 glyph(c,x+36,y+h/2,44,o.type);c.font='bold 15px system-ui,sans-serif';c.fillStyle='#e8ecf5';c.fillText(R.NAMES[o.type].toUpperCase(),x+68,y+26);
 c.font='12px system-ui,sans-serif';c.fillStyle='#9aa4bb';(o.lines||[]).slice(0,3).forEach((l,i)=>c.fillText(l,x+68,y+46+i*16));
 if(o.selected){c.font='bold 11px monospace';c.fillStyle=col;c.textAlign='right';c.fillText('\u25B6 TARGET',x+w-10,y+18);}
 c.restore();return h;};
window.Regime=Object.assign(window.Regime||{},{Picker:R});
})();
