// Weatherford west-side map expansion: small-city streets, ranch outskirts, dealerships and lots.
import { WEATHERFORD, WGRID_X, WGRID_Z, LOCATIONS } from '../data/world.js';
export function addWeatherford({ buildings, lots, trees, props }, { landmarkBlock } = {}) {
  const R = (a,b) => a + Math.random() * (b-a);
  for (let i=0;i<WGRID_X.length-1;i++) for (let j=0;j<WGRID_Z.length-1;j++) {
    const x0=WGRID_X[i]+14,x1=WGRID_X[i+1]-14,z0=WGRID_Z[j]+14,z1=WGRID_Z[j+1]-14,W=x1-x0,D=z1-z0;
    const loc=LOCATIONS.find(l=>l.city==='weatherford' && l.block?.[0]===i && l.block?.[1]===j);
    if(loc){ landmarkBlock?.(loc,x0,z0,x1,z1); continue; }
    if((i+j)%11===0){ lots.push({x:x0,z:z0,w:W,d:D,kind:'park'}); for(let k=0;k<8;k++) trees.push({x:R(x0+5,x1-5),z:R(z0+5,z1-5),r:R(3,5),kind:'tree'}); continue; }
    if(j<2 || i>7){ lots.push({x:x0,z:z0,w:W,d:D,kind:'yard'}); for(let a=0;a<3;a++) for(let b=0;b<3;b++) buildings.push({x:x0+6+a*30,z:z0+6+b*30,w:20,d:18,h:R(4.5,7),color:['#6b3a2e','#5a4632','#3f4a5a','#7a4b3a'][(i+a+b)%4],kind:'house'}); }
    else if((i+j)%4===0){ buildings.push({x:x0+4,z:z0+4,w:W-8,d:D*.55,h:R(8,14),color:'#6b6f75',kind:'warehouse'}); lots.push({x:x0+4,z:z0+D*.63,w:W-8,d:D*.3,kind:'parking'}); }
    else { lots.push({x:x0+1,z:z0+1,w:W-2,d:D-2,kind:'yard'}); buildings.push({x:x0+8,z:z0+8,w:W-16,d:D-16,h:R(5,10),color:'#7a7e83',kind:'midrise'}); }
  }
  for(let k=0;k<30;k++){ const x=WEATHERFORD.x0-250+R(0,700),z=WEATHERFORD.z1+100+R(0,900); lots.push({x,z,w:R(70,130),d:R(60,110),kind:'field',c:'#66743a'}); for(let n=0;n<6;n++) trees.push({x:R(x+4,x+70),z:R(z+4,z+70),r:R(3,6),kind:'tree'}); }
}