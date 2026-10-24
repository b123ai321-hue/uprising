// UPRISING 0.5.0a art: grievance card frame + Rally panel. Code-drawn, original (the studio team).
// Rally.card(ctx,x,y,w,{title,text,heat0to3}) -> height ; Rally.panel(ctx,x,y,w,{lines:[{text,state}],result}) -> {height,hits:[{x,y,w,h,i}]}
// line state: 'idle' | 'picked' | 'landed' | 'backfired'
(function(){
const C={plate:'#1b2430',edge:'#5d7389',amber:'#ffb02e',red:'#e0533a',green:'#5fd38a',text:'#e8e2d0',dim:'#8a96a3'};
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function wrap(c,t,w){const out=[];let l='';for(const s of t.split(' ')){const n=l?l+' '+s:s;if(c.measureText(n).width>w&&l){out.push(l);l=s}else l=n}if(l)out.push(l);return out}
function card(c,x,y,w,o){c.save();c.font='15px system-ui,sans-serif';const lines=wrap(c,o.text||'',w-28);const h=58+lines.length*20;
rr(c,x,y,w,h,8);c.fillStyle=C.plate;c.fill();c.strokeStyle=C.edge;c.lineWidth=1.5;c.stroke();
c.fillStyle=C.amber;c.fillRect(x,y+10,4,h-20); // amber spine
c.font='bold 12px system-ui,sans-serif';c.fillStyle=C.amber;c.fillText('GRIEVANCE',x+14,y+22);
for(let i=0;i<3;i++){c.fillStyle=i<(o.heat||0)?C.red:'#33404e';c.fillRect(x+w-14-(3-i)*12,y+13,9,9);} // heat pips
c.font='bold 16px system-ui,sans-serif';c.fillStyle=C.text;c.fillText(o.title||'',x+14,y+44);
c.font='15px system-ui,sans-serif';c.fillStyle=C.dim;lines.forEach((l,i)=>c.fillText(l,x+14,y+66+i*20));
c.restore();return h}
function panel(c,x,y,w,o){c.save();const hits=[];let cy=y+40;
c.font='15px system-ui,sans-serif';const rows=o.lines.map(L=>wrap(c,L.text,w-48));
const h=40+rows.reduce((a,r)=>a+Math.max(48,r.length*20+16)+8,0)+(o.result?56:8);
rr(c,x,y,w,h,10);c.fillStyle='#121821';c.fill();c.strokeStyle=C.edge;c.lineWidth=1.5;c.stroke();
c.font='bold 13px system-ui,sans-serif';c.fillStyle=C.amber;c.fillText('RALLY \u00b7 PICK A MESSAGE',x+14,y+25);
o.lines.forEach((L,i)=>{const lh=Math.max(48,rows[i].length*20+16);const col={idle:C.edge,picked:C.amber,landed:C.green,backfired:C.red}[L.state||'idle'];
rr(c,x+10,cy,w-20,lh,6);c.fillStyle=L.state&&L.state!=='idle'?'#1f2a37':C.plate;c.fill();c.strokeStyle=col;c.lineWidth=L.state&&L.state!=='idle'?2.5:1;c.stroke();
c.fillStyle=col;c.beginPath();c.arc(x+26,cy+lh/2,5,0,7);c.fill();
c.font='15px system-ui,sans-serif';c.fillStyle=C.text;rows[i].forEach((l,j)=>c.fillText(l,x+40,cy+lh/2-(rows[i].length-1)*10+5+j*20));
hits.push({x:x+10,y:cy,w:w-20,h:lh,i});cy+=lh+8;});
if(o.result){const ok=o.result.ok;c.fillStyle=ok?C.green:C.red;c.font='bold 14px system-ui,sans-serif';c.fillText(ok?'LANDED':'BACKFIRED',x+14,cy+20);
c.font='14px system-ui,sans-serif';c.fillStyle=C.dim;c.fillText(wrap(c,o.result.why,w-28)[0],x+14,cy+40);}
c.restore();return{height:h,hits}}
window.Rally={card,panel,COLORS:C};
})();
