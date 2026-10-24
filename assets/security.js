// security.js - 0.6.0 Security screen art kit, original code-drawn art by the studio team.
// Sec.gauge(ctx,x,y,w,{label,pct})            -> height 44. Sensor bar 0-100 (cyan < 40, amber < 70, red).
// Sec.score(ctx,x,y,w,{score,lines:[[label,+n]]}) -> height. Capability score with the math shown line by line.
// Sec.toggle(ctx,x,y,w,{label,on,cost})        -> {height:48,hit:[x,y,w,h]}  Countermeasure switch.
// Sec.dice(ctx,x,y,w,{roll,need,level})        -> height 48. Detection roll readout, fusion level L0-L3.
// Sec.graph(ctx,x,y,w,h,{nodes:[{id,x,y,state}],edges:[[a,b,state]]})  x,y in 0..1; state 'ok'|'busted'|'burned'.
(function(){
const C={plate:'#1b2430',edge:'#5d7389',ink:'#d9e4ee',dim:'#8fa3b5',amber:'#ffb02e',red:'#e0533a',green:'#5fd38a',cyan:'#38e1ff',bg:'#0e141b'};
const tone=p=>p<40?C.cyan:p<70?C.amber:C.red, mono=s=>s+'px ui-monospace,monospace';
function gauge(ctx,x,y,w,o){const p=Math.max(0,Math.min(100,o.pct));ctx.fillStyle=C.plate;ctx.fillRect(x,y,w,42);
 ctx.font=mono(11);ctx.textBaseline='top';ctx.fillStyle=C.dim;ctx.fillText(o.label.toUpperCase(),x+8,y+6,w-60);ctx.textAlign='right';ctx.fillStyle=tone(p);ctx.fillText(Math.round(p)+'%',x+w-8,y+6);ctx.textAlign='left';
 const bw=w-16;ctx.fillStyle=C.bg;ctx.fillRect(x+8,y+24,bw,10);for(let i=0;i<20;i++){if(i/20*100<p){ctx.fillStyle=tone(p);ctx.fillRect(x+8+i*bw/20+1,y+25,bw/20-2,8);}}return 44;}
function score(ctx,x,y,w,o){const h=56+o.lines.length*18;ctx.fillStyle=C.plate;ctx.fillRect(x,y,w,h);ctx.strokeStyle=tone(o.score);ctx.strokeRect(x+.5,y+.5,w-1,h-1);
 ctx.textBaseline='top';ctx.font=mono(11);ctx.fillStyle=C.dim;ctx.fillText('SECURITY CAPABILITY',x+10,y+8);ctx.font='700 26px ui-monospace,monospace';ctx.fillStyle=tone(o.score);ctx.textAlign='right';ctx.fillText(Math.round(o.score),x+w-10,y+6);ctx.textAlign='left';
 ctx.font=mono(12);o.lines.forEach((l,i)=>{const yy=y+44+i*18;ctx.fillStyle=C.ink;ctx.fillText(l[0],x+10,yy,w-80);ctx.textAlign='right';ctx.fillStyle=l[1]<0?C.green:C.red;ctx.fillText((l[1]>0?'+':'')+l[1],x+w-10,yy);ctx.textAlign='left';});return h;}
function toggle(ctx,x,y,w,o){ctx.fillStyle=C.plate;ctx.fillRect(x,y,w,46);ctx.textBaseline='middle';ctx.font='600 13px system-ui,sans-serif';ctx.fillStyle=C.ink;ctx.fillText(o.label,x+10,y+16,w-90);
 ctx.font=mono(11);ctx.fillStyle=C.dim;ctx.fillText(o.cost||'',x+10,y+33,w-90);const sx=x+w-62,sy=y+11;ctx.fillStyle=o.on?C.green:C.bg;ctx.strokeStyle=o.on?C.green:C.edge;ctx.beginPath();ctx.roundRect?ctx.roundRect(sx,sy,52,24,12):ctx.rect(sx,sy,52,24);ctx.fill();ctx.stroke();
 ctx.fillStyle=o.on?C.bg:C.dim;ctx.beginPath();ctx.arc(o.on?sx+40:sx+12,sy+12,9,0,7);ctx.fill();return{height:48,hit:[x,y,w,46]};}
function dice(ctx,x,y,w,o){const ok=o.roll>o.need;ctx.fillStyle=C.plate;ctx.fillRect(x,y,w,46);ctx.fillStyle=ok?C.green:C.red;ctx.fillRect(x,y,3,46);
 const s=30,dx=x+10,dy=y+8;ctx.strokeStyle=ok?C.green:C.red;ctx.lineWidth=2;ctx.strokeRect(dx,dy,s,s);ctx.font='700 14px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=C.ink;ctx.fillText(o.roll,dx+s/2,dy+s/2+1);ctx.textAlign='left';
 ctx.font=mono(12);ctx.fillStyle=C.ink;ctx.fillText('Dice '+o.roll+', caught on \u2264'+o.need,x+50,y+16,w-60);ctx.fillStyle=C.dim;ctx.fillText('Fusion L'+(o.level|0)+' \u00b7 '+(ok?'not detected':'DETECTED'),x+50,y+32,w-60);return 48;}
const GR='\u03b1\u03b2\u03b3\u03b4\u03b5\u03b6\u03b7\u03b8\u03b9\u03ba\u03bb\u03bc';
function graph(ctx,x,y,w,h,o){ctx.fillStyle=C.bg;ctx.fillRect(x,y,w,h);ctx.strokeStyle='#18222d';ctx.lineWidth=1;for(let gx=x;gx<x+w;gx+=24){ctx.beginPath();ctx.moveTo(gx+.5,y);ctx.lineTo(gx+.5,y+h);ctx.stroke();}
 const P=n=>[x+20+n.x*(w-40),y+20+n.y*(h-40)],by={};o.nodes.forEach(n=>by[n.id]=n);
 o.edges.forEach(e=>{const a=P(by[e[0]]),b=P(by[e[1]]);ctx.strokeStyle=e[2]==='busted'?C.red:e[2]==='burned'?'#33404d':C.edge;ctx.setLineDash(e[2]==='burned'?[4,4]:[]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();});ctx.setLineDash([]);
 o.nodes.forEach((n,i)=>{const p=P(n),c=n.state==='busted'?C.red:C.cyan;ctx.fillStyle=C.plate;ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],14,0,7);ctx.fill();ctx.stroke();ctx.fillStyle=c;ctx.font='700 14px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.id||GR[i],p[0],p[1]+1);});ctx.textAlign='left';}
window.Sec={gauge,score,toggle,dice,graph,GREEK:GR,COLORS:C};
})();
