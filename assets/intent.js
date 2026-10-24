// UPRISING enemy-intent art (smarter AI). Original, code-drawn. Credit: the studio team.
(function(){var K={attack:['#ff3b4e','\u2694'],raid:['#ff8a3d','\u25BC'],crack:['#ff2bd6','\u2297'],bribe:['#ffd23f','$'],dig:['#22e1ff','\u25CE'],propaganda:['#b388ff','\u00BB'],unknown:['#5a6578','?']};
var I={};
// marker(ctx,x,y,{kind,turns}) : pulsing ring over a province + "in N wk" tag. 44px tap size.
I.marker=function(c,x,y,o){var k=K[o.kind]||K.attack,t=(Date.now()%1200)/1200;c.strokeStyle=k[0];c.globalAlpha=1-t;c.lineWidth=2;c.beginPath();c.arc(x,y,10+12*t,0,7);c.stroke();c.globalAlpha=1;
c.fillStyle='#0b0f17';c.beginPath();c.arc(x,y,11,0,7);c.fill();c.stroke();c.font='bold 12px system-ui';c.fillStyle=k[0];c.textAlign='center';c.textBaseline='middle';c.fillText(k[1],x,y+1);
if(o.turns!=null){var s='in '+o.turns+'wk';c.font='bold 9px system-ui';var w=c.measureText(s).width+8;c.fillStyle=k[0];c.fillRect(x-w/2,y+14,w,12);c.fillStyle='#0b0f17';c.fillText(s,x,y+20);}};
// row(ctx,x,y,w,{kind,text,turns}) -> 40 : intel list line
I.row=function(c,x,y,w,o){var k=K[o.kind]||K.attack;c.fillStyle='#0b0f17';c.fillRect(x,y,w,40);c.fillStyle=k[0];c.fillRect(x,y,4,40);
c.font='bold 16px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(k[1],x+22,y+20);c.textAlign='left';c.font='bold 12px system-ui';c.fillStyle='#d8e2f0';c.fillText(I.fit(c,o.text,w-100),x+40,y+20);
c.textAlign='right';c.fillStyle=k[0];c.fillText(o.turns+' wk',x+w-10,y+20);return 40;};
// fit(ctx,text,maxW): shortens text with an ellipsis so it never runs past maxW (uses current font).
I.fit=function(c,s,m){if(c.measureText(s).width<=m)return s;while(s.length>1&&c.measureText(s+'\u2026').width>m)s=s.slice(0,-1);return s.replace(/\s+$/,'')+'\u2026';};
I.kinds=Object.keys(K).filter(function(k){return k!='unknown'});window.Intent=I;})();
