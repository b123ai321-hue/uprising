// factions.js - 0.5.0b art kit, original code-drawn art by the studio team.
// Faction.icon(ctx,x,y,s,type)  draws a faction-type emblem in an s×s box.
// Faction.row(ctx,x,y,w,{type,name,loyalty,-100..100, redLine,known}) -> height (>=48)
// Faction.trait(ctx,x,y,s,trait) leader trait badge; Faction.leader(ctx,x,y,w,{name,title,traits}) -> height
// Faction.persecution(ctx,x,y,s) marker for a regime policy against the minority (symbol only).
(function(){
const C={plate:'#1b2430',edge:'#5d7389',ink:'#d9e4ee',dim:'#8fa3b5',amber:'#ffb02e',red:'#e0533a',green:'#5fd38a',cyan:'#38e1ff',violet:'#a98bff'};
const TYPES={students:C.cyan,unions:'#d9733a',nationalists:C.red,minority:C.violet,business:C.amber,faith:'#e8d9a8',exiles:'#7fb0d9',moderates:C.green,hardliners:'#ff4f7a',separatists:'#c46be0',veterans:'#9aa86a',farmers:'#b9d36a'};
function I(ctx,x,y,s,t){const c=TYPES[t]||C.dim,u=s/16;ctx.save();ctx.translate(x,y);
 ctx.fillStyle=C.plate;ctx.strokeStyle=c;ctx.lineWidth=Math.max(1,u);ctx.beginPath();ctx.moveTo(4*u,0);ctx.lineTo(12*u,0);ctx.lineTo(16*u,4*u);ctx.lineTo(16*u,12*u);ctx.lineTo(12*u,16*u);ctx.lineTo(4*u,16*u);ctx.lineTo(0,12*u);ctx.lineTo(0,4*u);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle=c;ctx.strokeStyle=c;ctx.lineWidth=1.5*u;const R=(a,b,w,h)=>ctx.fillRect(a*u,b*u,w*u,h*u),P=(p)=>{ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q[0]*u,q[1]*u):ctx.moveTo(q[0]*u,q[1]*u));ctx.closePath();ctx.fill();},O=(a,b,r,f)=>{ctx.beginPath();ctx.arc(a*u,b*u,r*u,0,7);f?ctx.fill():ctx.stroke();};
 ({students:()=>{P([[3,7],[8,4],[13,7],[8,10]]);R(11,7,1,4);},
  unions:()=>{O(8,8,4);for(let i=0;i<8;i++){ctx.save();ctx.translate(8*u,8*u);ctx.rotate(i*Math.PI/4);ctx.fillRect(-u,-6*u,2*u,2*u);ctx.restore();}},
  nationalists:()=>{R(4,3,1,10);P([[5,3],[12,5],[5,8]]);},
  minority:()=>{O(8,8,4.5);O(8,8,1.6,1);},
  business:()=>{R(4,9,2,3);R(7,6,2,6);R(10,4,2,8);},
  faith:()=>{P([[8,3],[11,8],[8,13],[5,8]]);},
  exiles:()=>{ctx.beginPath();ctx.moveTo(3*u,8*u);ctx.lineTo(12*u,8*u);ctx.stroke();P([[10,5],[13,8],[10,11]]);},
  moderates:()=>{R(3,7,10,2);O(4,10,1.5,1);O(12,10,1.5,1);},
  hardliners:()=>{P([[8,3],[13,13],[3,13]]);},
  separatists:()=>{P([[3,4],[7,4],[7,12],[3,12]]);P([[9,4],[13,4],[13,12],[9,12]]);},
  veterans:()=>{P([[4,4],[12,4],[12,9],[8,13],[4,9]]);},
  farmers:()=>{ctx.beginPath();ctx.moveTo(8*u,13*u);ctx.lineTo(8*u,4*u);ctx.stroke();P([[8,5],[11,4],[8,8]]);P([[8,8],[5,7],[8,11]]);}
 }[t]||(()=>O(8,8,3,1)))();ctx.restore();}
function bar(ctx,x,y,w,h,v){ctx.fillStyle='#0e141b';ctx.fillRect(x,y,w,h);const m=x+w/2,len=w/2*Math.min(1,Math.abs(v)/100);ctx.fillStyle=v>=40?C.green:v>=0?C.amber:C.red;v>=0?ctx.fillRect(m,y,len,h):ctx.fillRect(m-len,y,len,h);ctx.fillStyle=C.edge;ctx.fillRect(m,y-2,1,h+4);}
function row(ctx,x,y,w,o){const h=o.redLine&&o.known?64:48;ctx.fillStyle=C.plate;ctx.fillRect(x,y,w,h-2);ctx.fillStyle=TYPES[o.type]||C.dim;ctx.fillRect(x,y,3,h-2);
 I(ctx,x+8,y+8,32,o.type);ctx.font='600 13px system-ui,sans-serif';ctx.fillStyle=C.ink;ctx.textBaseline='top';ctx.fillText(o.name||o.type,x+48,y+7,w-110);
 ctx.font='12px ui-monospace,monospace';ctx.fillStyle=C.dim;ctx.textAlign='right';ctx.fillText((o.loyalty>0?'+':'')+Math.round(o.loyalty),x+w-8,y+7);ctx.textAlign='left';
 bar(ctx,x+48,y+28,w-60,6,o.loyalty);
 if(o.redLine&&o.known){ctx.fillStyle=C.red;ctx.font='11px ui-monospace,monospace';ctx.fillText('RED LINE \u00b7 '+o.redLine,x+48,y+42,w-60);}
 return h;}
const TR={corrupt:[C.amber,'$'],paranoid:[C.cyan,'\u25c9'],cruel:[C.red,'\u2716'],cult:[C.violet,'\u2605'],family:['#e8d9a8','\u2302']};
function trait(ctx,x,y,s,t){const d=TR[t]||[C.dim,'?'];ctx.fillStyle=C.plate;ctx.strokeStyle=d[0];ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+s/2,y+s/2,s/2-1,0,7);ctx.fill();ctx.stroke();ctx.fillStyle=d[0];ctx.font='700 '+Math.round(s*.55)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d[1],x+s/2,y+s/2+1);ctx.textAlign='left';}
function leader(ctx,x,y,w,o){const h=72;ctx.fillStyle=C.plate;ctx.fillRect(x,y,w,h);ctx.strokeStyle=C.edge;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
 // abstract bust: no face, just a silhouette under a cold spotlight
 const g=ctx.createRadialGradient(x+36,y+20,2,x+36,y+36,34);g.addColorStop(0,'#33465a');g.addColorStop(1,C.plate);ctx.fillStyle=g;ctx.fillRect(x+4,y+4,64,h-8);
 ctx.fillStyle='#0b1016';ctx.beginPath();ctx.arc(x+36,y+28,11,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(x+14,y+h-4);ctx.quadraticCurveTo(x+36,y+36,x+58,y+h-4);ctx.fill();
 ctx.fillStyle=C.dim;ctx.font='11px ui-monospace,monospace';ctx.textBaseline='top';ctx.fillText((o.title||'LEADER').toUpperCase(),x+76,y+8,w-84);
 ctx.fillStyle=C.ink;ctx.font='700 15px system-ui,sans-serif';ctx.fillText(o.name||'Unknown',x+76,y+22,w-84);
 (o.traits||[]).forEach((t,i)=>trait(ctx,x+76+i*30,y+44,24,t));return h;}
function persecution(ctx,x,y,s){ctx.save();ctx.strokeStyle=C.violet;ctx.lineWidth=Math.max(1.5,s/12);ctx.beginPath();ctx.arc(x+s/2,y+s/2,s/2-2,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*.25,y+s*.25);ctx.lineTo(x+s*.75,y+s*.75);ctx.stroke();ctx.fillStyle=C.violet;ctx.beginPath();ctx.arc(x+s/2,y+s/2,s/8,0,7);ctx.fill();ctx.restore();}
window.Faction={icon:I,row,trait,leader,persecution,TYPES:Object.keys(TYPES),COLORS:C};
})();
