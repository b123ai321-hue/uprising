/* Emberline art (original, code-drawn). window.EmberArt. No deps. */
(function(){
const PAL={soot:'#141a2b',ink:'#0b0f1a',paper:'#e9dcc0',ember:'#ff7a2a',glow:'#ffc25a',
 lantern:'#e8b63a',commons:'#b5532b',oath:'#4f8a4a',throne:'#7d7390',neutral:'#5a6278',
 terrain:{plains:'#3b4a3a',hills:'#4a4536',forest:'#2c3f2e',marsh:'#33463f',river:'#2c3e57'}};
// suggested layout in a 1000x700 map space; Coder may override
const REGIONS={Lampford:[180,560,'river'],Saltmere:[90,380,'marsh'],Greywater:[300,420,'river'],
 Thornreach:[420,600,'forest'],'Kessel Hills':[520,450,'hills'],'Brannock Mills':[640,580,'plains'],
 'Low Fen':[250,230,'marsh'],Highcourt:[560,250,'plains'],Ashgate:[780,380,'hills'],'Vireth Pass':[820,140,'hills']};
function rng(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>((h=Math.imul(h^h>>>15,2246822507)^Math.imul(h^h>>>13,3266489909))>>>0)/4294967296;}
// wobbly ink blob path for a region, stable per name
function regionPath(ctx,name,x,y,r){const R=rng(name),n=11,p=[];for(let i=0;i<n;i++){const a=i/n*6.283,k=r*(0.78+R()*0.36);p.push([x+Math.cos(a)*k,y+Math.sin(a)*k*0.82]);}
 ctx.beginPath();for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%n],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;i?ctx.quadraticCurveTo(a[0],a[1],mx,my):ctx.moveTo(mx,my);}ctx.closePath();}
// draw one region: o={name,x,y,r,terrain,owner:'lantern'|'commons'|'oath'|'throne'|null,support:0..1,selected,capital}
function region(ctx,o){const r=o.r||62,t=PAL.terrain[o.terrain]||PAL.neutral;
 regionPath(ctx,o.name,o.x,o.y,r);ctx.fillStyle=t;ctx.fill();
 // terrain hatch (cheap, clipped)
 ctx.save();ctx.clip();ctx.strokeStyle='rgba(233,220,192,.12)';ctx.lineWidth=1.5;ctx.beginPath();
 const s=o.terrain==='hills'?14:o.terrain==='forest'?9:o.terrain==='marsh'?11:18;
 for(let k=-r*2;k<r*2;k+=s){if(o.terrain==='hills'){ctx.moveTo(o.x+k,o.y+r);ctx.lineTo(o.x+k+s/2,o.y+r-s);ctx.lineTo(o.x+k+s,o.y+r);}
  else if(o.terrain==='river'||o.terrain==='marsh'){ctx.moveTo(o.x-r,o.y+k);ctx.bezierCurveTo(o.x-r/3,o.y+k-6,o.x+r/3,o.y+k+6,o.x+r,o.y+k);}
  else{ctx.moveTo(o.x+k,o.y-r);ctx.lineTo(o.x+k+r,o.y+r);}}
 ctx.stroke();
 if(o.owner){ctx.fillStyle=PAL[o.owner];ctx.globalAlpha=0.38;ctx.fill();ctx.globalAlpha=1;}
 // support fill rising from bottom in ember
 if(o.support>0){ctx.fillStyle='rgba(255,122,42,.22)';ctx.fillRect(o.x-r,o.y+r*0.82-(2*r*0.82)*o.support,2*r,2*r);}
 ctx.restore();
 regionPath(ctx,o.name,o.x,o.y,r);ctx.lineWidth=o.selected?4:2.5;ctx.strokeStyle=o.selected?PAL.glow:PAL.ink;ctx.stroke();
 if(o.capital){star(ctx,o.x,o.y-r*0.35,9,PAL.throne);}
 ctx.font='600 15px Georgia,serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle=PAL.ink;ctx.strokeText(o.name,o.x,o.y+5);ctx.fillStyle=PAL.paper;ctx.fillText(o.name,o.x,o.y+5);}
function star(ctx,x,y,r,c){ctx.beginPath();for(let i=0;i<10;i++){const a=-1.5708+i*0.6283,k=i%2?r*0.45:r;ctx.lineTo(x+Math.cos(a)*k,y+Math.sin(a)*k);}ctx.closePath();ctx.fillStyle=c;ctx.fill();ctx.strokeStyle=PAL.ink;ctx.lineWidth=2;ctx.stroke();}
// ink road between regions (dashed when cut/curfew)
function link(ctx,a,b,cut){ctx.save();ctx.strokeStyle=cut?'#8a3a2a':'rgba(233,220,192,.55)';ctx.lineWidth=3;ctx.setLineDash(cut?[4,8]:[10,6]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo((a[0]+b[0])/2+(a[1]-b[1])*.12,(a[1]+b[1])/2+(b[0]-a[0])*.12,b[0],b[1]);ctx.stroke();ctx.restore();}
// paper background, draw once offscreen
function paper(ctx,w,h){ctx.fillStyle=PAL.soot;ctx.fillRect(0,0,w,h);const R=rng('paper');ctx.fillStyle='rgba(233,220,192,.035)';for(let i=0;i<w*h/900;i++)ctx.fillRect(R()*w,R()*h,2,2);
 const g=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,h*.8);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.45)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
// --- SVG icons (viewBox 0 0 64 64), stroke = ink, fill = currentColor ---
const S=(b)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#0b0f1a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
const SVG={
 // factions
 lantern:S(`<path d="M24 14h16M32 6v8" /><path d="M20 18h24l-3 30H23z" fill="#e8b63a"/><path d="M32 26c-5 6-4 12 0 14c4-2 5-8 0-14z" fill="#ff7a2a"/><path d="M18 50h28v6H18z" fill="#e8b63a"/>`),
 commons:S(`<circle cx="32" cy="34" r="22" fill="#b5532b"/><g fill="#b5532b">${[0,45,90,135,180,225,270,315].map(a=>`<rect x="28" y="6" width="8" height="8" transform="rotate(${a} 32 34)"/>`).join('')}</g><circle cx="32" cy="34" r="14" fill="#e9dcc0"/><path d="M24 40v-9h16v9a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4zM24 31v-5M29 31v-7M34 31v-7M39 31v-5" fill="#b5532b"/>`),
 oath:S(`<circle cx="32" cy="32" r="24" fill="#4f8a4a"/><circle cx="32" cy="32" r="16" fill="#e9dcc0"/><path d="M32 46V30M32 34l-6-6M32 31l6-6"/><path d="M22 26c0-8 20-8 20 0c0 6-20 6-20 0z" fill="#4f8a4a"/>${[0,60,120,180,240,300].map(a=>`<path d="M32 4c4 3 4 6 0 8c-4-2-4-5 0-8z" fill="#4f8a4a" transform="rotate(${a} 32 32)"/>`).join('')}`),
 throne:S(`<path d="M14 50h36l-4-26-8 8-6-14-6 14-8-8z" fill="#7d7390"/><path d="M14 50h36v6H14z" fill="#7d7390"/><circle cx="32" cy="14" r="3" fill="#e8b63a"/>`),
 // units
 militia:S(`<path d="M18 56L46 8" /><path d="M42 6l8-2-2 8z" fill="#e9dcc0"/><circle cx="26" cy="22" r="7" fill="#e9dcc0"/><path d="M16 56c0-14 4-22 10-22s10 8 10 22z" fill="currentColor"/>`),
 riflemen:S(`<path d="M10 40L54 18l2 4-40 22z" fill="#5a4636"/><path d="M50 20l8-4" /><circle cx="24" cy="18" r="7" fill="#e9dcc0"/><path d="M16 18h16l-2-6H18z" fill="currentColor"/><path d="M14 58c0-12 4-18 10-18s10 6 10 18z" fill="currentColor"/>`),
 riders:S(`<path d="M10 44c4-12 14-16 26-14l10-10 6 4-6 8c2 4 2 10-2 14l2 10M18 44l-2 12M30 46l2 10" fill="currentColor"/><circle cx="30" cy="16" r="6" fill="#e9dcc0"/><path d="M30 22v10"/>`),
 regulars:S(`<path d="M32 6l20 8v16c0 14-10 22-20 28C22 52 12 44 12 30V14z" fill="currentColor"/><path d="M22 28l10 10 10-10M22 20l10 10 10-10" stroke="#e9dcc0"/>`),
 flag:S(`<path d="M18 58V6"/><path d="M18 8h30l-8 10 8 10H18z" fill="#ff7a2a"/>`),
};
const _img={};function icon(name,color){const k=name+(color||'');if(!_img[k]){const i=new Image();i.src='data:image/svg+xml;utf8,'+encodeURIComponent(SVG[name].replace(/currentColor/g,color||PAL.paper));_img[k]=i;}return _img[k];}
// battle token: circle in side colour, unit icon, morale arc (0..1), routing = flicker grey
function unit(ctx,o){const r=o.r||16;ctx.beginPath();ctx.arc(o.x,o.y,r,0,6.283);ctx.fillStyle=o.rout?'#555':PAL[o.side]||PAL.neutral;ctx.fill();ctx.lineWidth=o.sel?3:2;ctx.strokeStyle=o.sel?PAL.glow:PAL.ink;ctx.stroke();
 const im=icon(o.type,PAL.paper);if(im.complete)ctx.drawImage(im,o.x-r*.75,o.y-r*.75,r*1.5,r*1.5);
 if(o.morale!=null){ctx.beginPath();ctx.arc(o.x,o.y,r+4,-1.5708,-1.5708+6.283*o.morale);ctx.strokeStyle=o.morale>.35?PAL.glow:'#d33';ctx.lineWidth=3;ctx.stroke();}}
// title card onto any canvas
function title(ctx,w,h,t){paper(ctx,w,h);const cx=w/2,cy=h*.42,s=Math.min(w,h)/700;
 const g=ctx.createRadialGradient(cx,cy,0,cx,cy,260*s);g.addColorStop(0,'rgba(255,194,90,'+(0.35+0.08*Math.sin((t||0)*2))+')');g.addColorStop(1,'rgba(255,122,42,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const im=icon('lantern');if(im.complete)ctx.drawImage(im,cx-70*s,cy-150*s,140*s,140*s);
 ctx.textAlign='center';ctx.fillStyle=PAL.paper;ctx.font=`700 ${78*s}px Georgia,serif`;ctx.fillText('EMBERLINE',cx,cy+60*s);
 ctx.fillStyle=PAL.ember;ctx.fillRect(cx-170*s,cy+78*s,340*s,3*s);
 ctx.fillStyle=PAL.glow;ctx.font=`italic ${24*s}px Georgia,serif`;ctx.fillText('Rise of the Lantern Accord',cx,cy+112*s);
 ['commons','oath'].forEach((f,i)=>{const e=icon(f);if(e.complete)ctx.drawImage(e,cx+(i?110:-170)*s,cy+150*s,60*s,60*s);});
 const e=icon('lantern');if(e.complete)ctx.drawImage(e,cx-30*s,cy+150*s,60*s,60*s);}
function ready(colors){colors=colors||[undefined,PAL.paper];const L=[];for(const k in SVG)for(const c of colors){const i=icon(k,c);L.push(i.complete?1:new Promise(r=>{i.onload=i.onerror=r;}));}return Promise.all(L);}
window.EmberArt={ready,PAL,REGIONS,region,regionPath,link,paper,star,SVG,icon,unit,title};
})();
