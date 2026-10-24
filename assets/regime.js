// Regime: 0.4.0 escalation ladder strip + regime faction rows (UPRISING). Original code-drawn by the studio team.
(function(){
const A='#ffb02e',R='#c4472f',S='#8fa3b5',P='#1d262f',E='#3b4a58';
const RUNGS=[['POLICE SURGE','police'],['RIOT UNITS + CURFEW','curfew'],['ARMY RECALLED','army'],['RESERVES + EMERGENCY','reserve'],['CONSCRIPTION','conscript']];
const FACTIONS=['hardliners','moderates','security','oligarchs'];
const NAMES={hardliners:'Hardliners',moderates:'Moderates',security:'Security chiefs',oligarchs:'Oligarchs'};
function L(c,p){c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);}
const G={ // glyphs in a 0..1 box, stroke+fill set by caller
police(c){L(c,[.5,.1,.85,.25,.8,.6,.5,.9,.2,.6,.15,.25]);c.closePath();c.stroke();c.beginPath();c.arc(.5,.48,.1,0,7);c.fill();},
curfew(c){c.beginPath();c.arc(.5,.5,.36,0,7);c.stroke();L(c,[.5,.5,.5,.26]);c.stroke();L(c,[.5,.5,.68,.6]);c.stroke();},
army(c){c.strokeRect(.12,.25,.76,.5);L(c,[.12,.25,.88,.75]);c.stroke();L(c,[.88,.25,.12,.75]);c.stroke();},
reserve(c){for(const y of[.25,.5,.75]){L(c,[.15,y+.1,.5,y-.1,.85,y+.1]);c.stroke();}},
conscript(c){for(const x of[.25,.5,.75]){c.beginPath();c.arc(x,.32,.09,0,7);c.fill();c.fillRect(x-.09,.46,.18,.36);}},
hardliners(c){c.fillRect(.2,.2,.6,.14);c.fillRect(.43,.34,.14,.5);c.fillRect(.25,.72,.5,.12);},
moderates(c){L(c,[.5,.15,.5,.85]);c.stroke();L(c,[.15,.35,.85,.35]);c.stroke();L(c,[.15,.35,.08,.6,.28,.6,.15,.35]);c.stroke();L(c,[.85,.35,.72,.6,.92,.6,.85,.35]);c.stroke();},
security(c){c.beginPath();c.ellipse(.5,.5,.38,.22,0,0,7);c.stroke();c.beginPath();c.arc(.5,.5,.11,0,7);c.fill();},
oligarchs(c){c.beginPath();c.arc(.5,.5,.34,0,7);c.stroke();c.font='bold .5px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText('₵',.5,.53);}};
function icon(ctx,name,x,y,s=44,col=A){ctx.save();ctx.translate(x,y);
 ctx.fillStyle=P;ctx.strokeStyle=E;ctx.lineWidth=Math.max(1,s/30);ctx.beginPath();ctx.roundRect(1,1,s-2,s-2,s*.16);ctx.fill();ctx.stroke();
 ctx.translate(s*.16,s*.16);ctx.scale(s*.68,s*.68);ctx.strokeStyle=ctx.fillStyle=col;ctx.lineWidth=.08;ctx.lineCap=ctx.lineJoin='round';G[name](ctx);ctx.restore();}
// ladder(ctx,x,y,w,rung 0..5,why): strip of 5 rungs, current rung lit red, past rungs dim red, label + reason under it
function ladder(ctx,x,y,w,rung,why=''){const n=5,g=w*.02,s=Math.min(44,(w-g*(n-1))/n*.55),cw=(w-g*(n-1))/n,fs=Math.max(11,s*.3);
 ctx.save();ctx.translate(x,y);ctx.font=`${fs}px monospace`;ctx.textBaseline='top';
 for(let i=0;i<n;i++){const cx=i*(cw+g),on=i<rung,cur=i===rung-1;
  ctx.fillStyle=cur?'#3a1d18':P;ctx.strokeStyle=cur?R:E;ctx.lineWidth=cur?2:1;ctx.beginPath();ctx.roundRect(cx,0,cw,s*1.5,4);ctx.fill();ctx.stroke();
  icon(ctx,RUNGS[i][1],cx+(cw-s)/2,s*.12,s,on?(cur?R:'#7a3a2e'):S);
  ctx.fillStyle=on?(cur?R:'#7a3a2e'):S;ctx.textAlign='center';ctx.fillText(i+1,cx+cw/2,s*1.18);}
 ctx.textAlign='left';ctx.fillStyle=rung?R:S;ctx.fillText(rung?`RUNG ${rung} · ${RUNGS[rung-1][0]}`:'NO ESCALATION',0,s*1.7);
 if(why){ctx.fillStyle=S;ctx.fillText(why,0,s*1.7+fs*1.4);}ctx.restore();return s*1.7+fs*2.8;}
// row(ctx,x,y,w,faction,loyalty -100..100,label): icon, name, centred loyalty bar
function row(ctx,x,y,w,f,loy,label){const s=44,fs=15;ctx.save();ctx.translate(x,y);icon(ctx,f,0,0,s,A);
 ctx.font=`${fs}px monospace`;ctx.fillStyle='#d8e2ea';ctx.textBaseline='top';ctx.fillText(label||NAMES[f],s+10,2);
 const bx=s+10,bw=w-bx,by=s*.6,bh=10,mid=bx+bw/2,v=Math.max(-100,Math.min(100,loy))/100;
 ctx.fillStyle='#10161c';ctx.fillRect(bx,by,bw,bh);ctx.fillStyle=v>=0?S:R;ctx.fillRect(Math.min(mid,mid+v*bw/2),by,Math.abs(v*bw/2),bh);
 ctx.fillStyle='#d8e2ea';ctx.fillRect(mid-1,by-2,2,bh+4);ctx.textAlign='right';ctx.fillStyle=v<0?R:S;ctx.fillText((loy>0?'+':'')+Math.round(loy),w,2);ctx.restore();return s+8;}
// mark(ctx,kind,x,y,s=22): province chips. 'dug' = sandbag arc (dug-in defence), 'unscouted' = dashed eye (no recon this week)
function mark(ctx,k,x,y,s=22){ctx.save();ctx.translate(x,y);ctx.fillStyle='#0b0f15';ctx.strokeStyle=k==='dug'?R:A;ctx.lineWidth=Math.max(1.5,s/12);
 ctx.beginPath();ctx.arc(s/2,s/2,s/2,0,7);ctx.fill();ctx.stroke();ctx.scale(s,s);ctx.lineWidth=.1;ctx.lineCap='round';
 if(k==='dug'){for(const [cx,cy] of [[.3,.62],[.5,.62],[.7,.62],[.4,.42],[.6,.42]]){ctx.beginPath();ctx.ellipse(cx,cy,.1,.07,0,0,7);ctx.stroke();}}
 else{ctx.setLineDash([.08,.07]);ctx.beginPath();ctx.ellipse(.5,.5,.3,.18,0,0,7);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(.5,.5,.07,0,7);ctx.fillStyle=A;ctx.fill();}
 ctx.restore();}
window.Regime={RUNGS,FACTIONS,NAMES,icon,ladder,row,mark};
})();
