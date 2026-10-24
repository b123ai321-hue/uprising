// UPRISING foreign powers art: invented powers, stance meter, deal card. Original, code-drawn. Credit: the studio team.
(function(){
const F={};
const STC=v=>v>20?'#00e5a0':v<-20?'#ff3b5c':'#ffd84a';
// emblem(ctx,x,y,s,seed,color): invented geometric emblem (no real flags)
F.emblem=function(c,x,y,s,seed,col){c.save();c.translate(x,y);c.strokeStyle=col;c.fillStyle=col;c.lineWidth=Math.max(1.5,s/14);
 c.beginPath();c.rect(-s/2,-s*.35,s,s*.7);c.stroke();const k=seed%4;c.beginPath();
 if(k==0){c.moveTo(-s/2,-s*.35);c.lineTo(s/2,s*.35);c.stroke();c.beginPath();c.arc(0,0,s*.12,0,7);c.fill();}
 else if(k==1){c.rect(-s/2,-s*.35,s/3,s*.7);c.fill();}
 else if(k==2){for(let i=0;i<3;i++){c.moveTo(-s*.3+i*s*.3,-s*.2);c.lineTo(-s*.3+i*s*.3,s*.2);}c.stroke();}
 else{c.moveTo(0,-s*.25);c.lineTo(s*.22,s*.2);c.lineTo(-s*.22,s*.2);c.closePath();c.fill();}c.restore();};
// stance(ctx,x,y,w,v): -100 opposes .. +100 backs. returns 28
F.stance=function(c,x,y,w,v){c.save();const cx=x+w/2;c.fillStyle='#1a2030';c.fillRect(x,y+8,w,8);c.fillStyle=STC(v);
 const px=cx+(w/2)*v/100;c.fillRect(Math.min(cx,px),y+8,Math.abs(px-cx),8);c.fillStyle='#6b7590';c.fillRect(cx-1,y+4,2,16);
 c.font='10px system-ui';c.fillText('OPPOSES',x,y+28);c.textAlign='right';c.fillText('BACKS',x+w,y+28);c.restore();return 30;};
// power(ctx,x,y,w,{name,seed,stance,note}) -> 78
F.power=function(c,x,y,w,o){const h=78,col=STC(o.stance);c.save();c.fillStyle='#0b0e17';c.fillRect(x,y,w,h);c.strokeStyle='#2a3145';c.strokeRect(x+.5,y+.5,w-1,h-1);
 F.emblem(c,x+28,y+26,30,o.seed||0,col);c.font='bold 14px system-ui';c.fillStyle='#e8ecf5';c.fillText(o.name.toUpperCase(),x+52,y+22);
 c.font='12px system-ui';c.fillStyle='#9aa4bb';c.fillText(o.note||'',x+52,y+40);F.stance(c,x+12,y+44,w-24,o.stance);c.restore();return h;};
// deal(ctx,x,y,w,{from,gives:[..],wants:[..]}) -> {height, accept:{x,y,w,h}, refuse:{...}}
F.deal=function(c,x,y,w,o){const n=Math.max(o.gives.length,o.wants.length),h=64+n*18+56;c.save();c.fillStyle='#0b0e17';c.fillRect(x,y,w,h);c.strokeStyle='#3ad6ff';c.strokeRect(x+.5,y+.5,w-1,h-1);
 c.font='bold 11px monospace';c.fillStyle='#3ad6ff';c.fillText('OFFER · '+o.from.toUpperCase(),x+12,y+20);
 const hw=(w-36)/2;c.font='bold 12px system-ui';c.fillStyle='#00e5a0';c.fillText('THEY GIVE',x+12,y+44);c.fillStyle='#ff8a00';c.fillText('THEY WANT',x+24+hw,y+44);
 c.font='12px system-ui';c.fillStyle='#c8cfdd';o.gives.forEach((t,i)=>c.fillText('+ '+t,x+12,y+64+i*18));o.wants.forEach((t,i)=>c.fillText('− '+t,x+24+hw,y+64+i*18));
 const by=y+h-52,bw=(w-36)/2,A={x:x+12,y:by,w:bw,h:44},Rf={x:x+24+bw,y:by,w:bw,h:44};
 [[A,'ACCEPT','#00e5a0'],[Rf,'REFUSE','#ff3b5c']].forEach(([b,l,cl])=>{c.strokeStyle=cl;c.lineWidth=2;c.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);c.fillStyle=cl;c.font='bold 14px system-ui';c.textAlign='center';c.fillText(l,b.x+b.w/2,b.y+27);c.textAlign='left';});
 c.restore();return {height:h,accept:A,refuse:Rf};};
window.Foreign=F;})();
