// UPRISING economy + alliance art kit. Original, code-drawn. Credit: the studio team.
(function(){
var C={bg:'#0b0f17',line:'#1f2a3a',txt:'#d8e2f0',dim:'#7f8ea3',cy:'#22e1ff',mg:'#ff2bd6',ye:'#ffd23f',rd:'#ff3b4e',gn:'#3dff9a'};
function box(c,x,y,w,h,col){c.fillStyle=C.bg;c.fillRect(x,y,w,h);c.strokeStyle=col;c.lineWidth=1.5;c.strokeRect(x+.5,y+.5,w-1,h-1);c.fillStyle=col;c.fillRect(x,y,4,h);}
function t(c,s,x,y,sz,col,al){c.font='bold '+sz+'px system-ui,sans-serif';c.fillStyle=col;c.textAlign=al||'left';c.textBaseline='middle';c.fillText(s,x,y);}
var E={C:C};
// budget(ctx,x,y,w,{cash,income,costs}) -> height 64. Money in $K.
E.budget=function(c,x,y,w,o){var net=o.income-o.costs,col=o.cash<0?C.rd:net<0?C.ye:C.gn;box(c,x,y,w,64,col);
t(c,'TREASURY',x+12,y+14,11,C.dim);t(c,(o.cash<0?'-$':'$')+Math.abs(o.cash)+'K',x+w-12,y+14,15,col,'right');
var bw=w-24,m=Math.max(o.income,o.costs,1);c.fillStyle=C.line;c.fillRect(x+12,y+30,bw,8);c.fillRect(x+12,y+44,bw,8);
c.fillStyle=C.gn;c.fillRect(x+12,y+30,bw*o.income/m,8);c.fillStyle=C.rd;c.fillRect(x+12,y+44,bw*o.costs/m,8);
t(c,(net>=0?'+':'-')+'$'+Math.abs(net)+'K/wk',x+w-12,y+57,10,col,'right');return 64;};
// shortage(ctx,x,y,w,{kind:food|fuel|meds|power,level:0..3}) -> 40
var IC={food:'\u25A0',fuel:'\u25B2',meds:'+',power:'\u26A1'};
E.shortage=function(c,x,y,w,o){var col=[C.gn,C.ye,'#ff8a3d',C.rd][o.level];box(c,x,y,w,40,col);
t(c,IC[o.kind]||'?',x+22,y+20,18,col,'center');t(c,o.kind.toUpperCase(),x+40,y+20,13,C.txt);
for(var i=0;i<3;i++){c.fillStyle=i<o.level?col:C.line;c.fillRect(x+w-16-(3-i)*16,y+14,12,12);}return 40;};
// trade(ctx,x,y,w,{partner,goods,value,on}) -> 44 ; route line drawn left->right
E.trade=function(c,x,y,w,o){var col=o.on?C.cy:C.dim;box(c,x,y,w,44,col);t(c,o.partner,x+12,y+14,13,C.txt);t(c,o.goods,x+12,y+31,11,C.dim);
c.setLineDash(o.on?[]:[4,4]);c.strokeStyle=col;c.beginPath();c.moveTo(x+w*.55,y+22);c.lineTo(x+w-70,y+22);c.stroke();c.setLineDash([]);
t(c,(o.on?'+$':'$')+o.value+'K',x+w-12,y+22,13,col,'right');return 44;};
// pact(ctx,x,y,w,{a,b,kind:ally|trade|defense}) -> 48 ; two linked emblems
E.pact=function(c,x,y,w,o){var col={ally:C.gn,trade:C.cy,defense:C.mg}[o.kind]||C.cy;box(c,x,y,w,48,col);
var cx=x+w/2;c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.arc(cx-9,y+24,10,0,7);c.stroke();c.beginPath();c.arc(cx+9,y+24,10,0,7);c.stroke();
t(c,o.a,cx-26,y+24,13,C.txt,'right');t(c,o.b,cx+26,y+24,13,C.txt);t(c,o.kind.toUpperCase(),x+w-10,y+10,9,col,'right');return 48;};
window.Economy=E;})();
