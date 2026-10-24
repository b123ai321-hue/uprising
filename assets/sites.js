// Sites: original code-drawn site icons + state badges (UPRISING 0.6.0). By the studio team.
(function(){
const TYPES=['rail','barracks','port','power','comms','factory','depot','airbase'];
const STATES=['normal','guarded','reinforcing','strike','damaged','cutoff'];
const A='#ffb02e',R='#e0533a',C={};
function L(c,p){c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);}
const G={ // glyphs on a 0..1 box
rail(c){L(c,[.2,.85,.4,.15]);c.stroke();L(c,[.8,.85,.6,.15]);c.stroke();for(const y of[.3,.5,.7]){L(c,[.25,y,.75,y]);c.stroke();}},
barracks(c){L(c,[.15,.5,.5,.2,.85,.5]);c.stroke();c.strokeRect(.25,.5,.5,.32);c.fillRect(.43,.62,.14,.2);},
port(c){c.beginPath();c.arc(.5,.25,.08,0,7);c.stroke();L(c,[.5,.33,.5,.82]);c.stroke();L(c,[.32,.45,.68,.45]);c.stroke();c.beginPath();c.arc(.5,.55,.28,.35,2.8);c.stroke();},
power(c){L(c,[.58,.12,.3,.55,.5,.55,.42,.88,.72,.42,.52,.42,.58,.12]);c.fill();},
comms(c){L(c,[.5,.3,.3,.88]);c.stroke();L(c,[.5,.3,.7,.88]);c.stroke();L(c,[.38,.62,.62,.62]);c.stroke();for(const r of[.12,.22]){c.beginPath();c.arc(.5,.3,r,-2.4,-.75);c.stroke();}},
factory(c){L(c,[.15,.85,.15,.45,.35,.6,.35,.45,.55,.6,.55,.3,.68,.3,.68,.6,.85,.6,.85,.85]);c.closePath();c.stroke();},
depot(c){c.strokeRect(.2,.35,.6,.47);L(c,[.2,.35,.5,.18,.8,.35]);c.stroke();L(c,[.2,.58,.8,.58]);c.stroke();},
airbase(c){L(c,[.5,.12,.56,.42,.88,.58,.56,.55,.54,.78,.64,.88,.36,.88,.46,.78,.44,.55,.12,.58,.44,.42]);c.closePath();c.fill();}};
const B={ // badges on a 0..1 box
guarded(c){L(c,[.5,.12,.85,.25,.8,.6,.5,.9,.2,.6,.15,.25]);c.closePath();c.fill();},
reinforcing(c){L(c,[.12,.4,.55,.4,.55,.18,.9,.5,.55,.82,.55,.6,.12,.6]);c.closePath();c.fill();},
strike(c){c.fillRect(.18,.15,.64,.4);c.fillRect(.45,.55,.1,.35);},
damaged(c){c.strokeStyle=R;c.lineWidth=.16;c.lineJoin='miter';L(c,[.35,.05,.6,.4,.35,.6,.65,.95]);c.stroke();},
cutoff(c){c.lineWidth=.12;c.beginPath();c.arc(.32,.5,.17,1.9,4.4);c.stroke();c.beginPath();c.arc(.68,.5,.17,-1.25,1.25);c.stroke();c.strokeStyle=R;L(c,[.45,.2,.55,.8]);c.stroke();}};
function draw(ctx,type,x,y,s=44,state='normal'){
 ctx.save();ctx.translate(x,y);const r=s*.18;
 ctx.fillStyle='#1b2430';ctx.strokeStyle='#5d7389';ctx.lineWidth=Math.max(1,s/30);
 ctx.beginPath();ctx.roundRect(1,1,s-2,s-2,r);ctx.fill();ctx.stroke();
 ctx.save();ctx.translate(s*.14,s*.14);ctx.scale(s*.72,s*.72);
 ctx.strokeStyle=ctx.fillStyle=state==='damaged'?'#a07a3a':A;ctx.lineWidth=.08;ctx.lineCap=ctx.lineJoin='round';
 (G[type]||G.depot)(ctx);ctx.restore();
 if(B[state]){const b=s*.42;ctx.translate(s-b*.85,-b*.15);
  ctx.fillStyle='#0b0f15';ctx.strokeStyle=state==='damaged'||state==='cutoff'?R:A;ctx.lineWidth=Math.max(1,s/40);
  ctx.beginPath();ctx.arc(b/2,b/2,b/2,0,7);ctx.fill();ctx.stroke();
  ctx.scale(b,b);ctx.translate(.15,.15);ctx.scale(.7,.7);ctx.fillStyle=ctx.strokeStyle=A;ctx.lineCap='round';B[state](ctx);}
 ctx.restore();}
function sprite(type,state='normal',s=44){const k=type+state+s;if(C[k])return C[k];
 const d=Math.min(2,window.devicePixelRatio||1),cv=document.createElement('canvas');
 cv.width=cv.height=Math.ceil(s*1.3*d);const c=cv.getContext('2d');c.scale(d,d);draw(c,type,s*.05,s*.25,s,state);return C[k]=cv;}
window.Sites={TYPES,STATES,draw,sprite};
})();
