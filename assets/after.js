// UPRISING "play on after the revolt" art: sanctions row, invasion arrow, threat banner. Original, code-drawn. Credit: the studio team.
(function(){
const A={};
// sanction(ctx,x,y,w,{from,kind,bite}) kind: trade|oil|banks|arms ; bite 0..1 -> 48
A.sanction=function(c,x,y,w,o){c.save();const col=o.bite>.6?'#ff3b5c':o.bite>.3?'#ff8a00':'#ffd84a';c.fillStyle='#0b0e17';c.fillRect(x,y,w,48);c.strokeStyle='#2a3145';c.strokeRect(x+.5,y+.5,w-1,47);
 const ix=x+24,iy=y+24;c.strokeStyle=col;c.lineWidth=2;c.beginPath();
 if(o.kind=='oil'){c.moveTo(ix,iy-10);c.quadraticCurveTo(ix+9,iy+2,ix,iy+9);c.quadraticCurveTo(ix-9,iy+2,ix,iy-10);}
 else if(o.kind=='banks'){c.moveTo(ix-9,iy-3);c.lineTo(ix,iy-10);c.lineTo(ix+9,iy-3);c.moveTo(ix-7,iy-1);c.lineTo(ix-7,iy+7);c.moveTo(ix,iy-1);c.lineTo(ix,iy+7);c.moveTo(ix+7,iy-1);c.lineTo(ix+7,iy+7);c.moveTo(ix-10,iy+9);c.lineTo(ix+10,iy+9);}
 else if(o.kind=='arms'){c.moveTo(ix-8,iy+8);c.lineTo(ix+8,iy-8);c.moveTo(ix+3,iy-8);c.lineTo(ix+8,iy-8);c.lineTo(ix+8,iy-3);}
 else{c.rect(ix-9,iy-6,18,12);c.moveTo(ix-9,iy);c.lineTo(ix+9,iy);}
 c.stroke();c.beginPath();c.moveTo(ix-12,iy+12);c.lineTo(ix+12,iy-12);c.strokeStyle='#ff3b5c';c.stroke();
 c.font='bold 13px system-ui';c.fillStyle='#e8ecf5';c.fillText(o.kind.toUpperCase()+' EMBARGO',x+48,y+20);c.font='11px system-ui';c.fillStyle='#9aa4bb';c.fillText('from '+o.from,x+48,y+36);
 const bw=70;c.fillStyle='#1a2030';c.fillRect(x+w-bw-12,y+20,bw,8);c.fillStyle=col;c.fillRect(x+w-bw-12,y+20,bw*o.bite,8);c.restore();return 48;};
// invasion(ctx,x1,y1,x2,y2,progress 0..1, color): dashed arrow across map
A.invasion=function(c,x1,y1,x2,y2,p,col){col=col||'#ff3b5c';c.save();c.strokeStyle=col;c.lineWidth=3;c.setLineDash([7,5]);c.globalAlpha=.9;
 const ex=x1+(x2-x1)*p,ey=y1+(y2-y1)*p;c.beginPath();c.moveTo(x1,y1);c.lineTo(ex,ey);c.stroke();c.setLineDash([]);
 const a=Math.atan2(y2-y1,x2-x1);c.fillStyle=col;c.beginPath();c.moveTo(ex+Math.cos(a)*10,ey+Math.sin(a)*10);c.lineTo(ex+Math.cos(a+2.5)*10,ey+Math.sin(a+2.5)*10);c.lineTo(ex+Math.cos(a-2.5)*10,ey+Math.sin(a-2.5)*10);c.closePath();c.fill();c.restore();};
// banner(ctx,x,y,w,{title,sub,level}) level: calm|tense|war -> 52
A.banner=function(c,x,y,w,o){const col={calm:'#00e5a0',tense:'#ffd84a',war:'#ff3b5c'}[o.level||'tense'];c.save();c.fillStyle=col;c.globalAlpha=.12;c.fillRect(x,y,w,52);c.globalAlpha=1;c.fillRect(x,y,w,3);
 c.font='bold 15px system-ui';c.fillStyle=col;c.fillText(o.title.toUpperCase(),x+12,y+24);c.font='12px system-ui';c.fillStyle='#c8cfdd';c.fillText(o.sub||'',x+12,y+42);c.restore();return 52;};
window.After=A;})();
