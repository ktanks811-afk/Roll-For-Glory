// Hogs & Dogs hog genetics and pictures, brought over as is
// (ktanks811-afk/Hogs-and-dogs index.html: HGL, HPG, HOGF, HOGG, HOG_MASTERS).
// Every hog carries a genotype; its coat, tusks, crest, ears, size and picture
// come from it, painted onto the traced wild-hog master in img/hogs. The Hog
// Pin rules that touch money and feed live in core/hogpin.js.
/* eslint-disable */
const R=Math.random, ri=(a,b)=>Math.floor(R()*(b-a+1))+a, pick=a=>a[Math.floor(R()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function gauss(){let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function hashStr(s){let h=1779033703;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}return h>>>0}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ageStr=m=>m<12?m+' mo':Math.floor(m/12)+' yr'+(m%12?' '+m%12+' mo':'');
function lhash(x,y,s){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,982451653);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function lnoise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=lhash(ix,iy,s),b=lhash(ix+1,iy,s),c=lhash(ix,iy+1,s),d=lhash(ix+1,iy+1,s),ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy}
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('image '+src));i.src=src});
// the H&D save fields these engines read live in s.hd (core/hd.js binds it)
import { hdS as S } from '../core/hd.js';
const addLog=()=>{}, gainXP=()=>{}, earn=()=>{}, fmt=n=>'$'+Math.round(n).toLocaleString();
const UI={};

const hmix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const hhex=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
const hash2=(x,y,s)=>{let h=(x*374761393+y*668265263+s*982451653)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296};
import { HOGS } from '../data/dogs.js';
const areaName=a=>a, landLevel=()=>0, accessArea=()=>'creek';
const hogCap=()=>S.hogCap||12;
const HOG_MASTERS={wild:{"w":1024,"h":683,"maps":{"m1":"img/hogs/wild-m1.fc0d8a39eb.webp","m2":"img/hogs/wild-m2.ae666f1599.webp","m3":"img/hogs/wild-m3.69e467c7af.webp"}}};
const HOGT={feral:'Feral',razor:'Razorback',spotted:'Spotted',russian:'Russian',ghost:'Ghost',giant:'Giant'};
const HGL={E:{name:'Extension',alle:['ED','E','e']},D:{name:'Dilution',alle:['D','d']},Gz:{name:'Grizzle',alle:['Gz','n']},P:{name:'Patching',alle:['P','n']},
  Sk:{name:'Speckling',alle:['N','sk']},Wm:{name:'White markings',alle:['Wm','n']},Hl:{name:'Long bristles',alle:['Hl','n']},Lg:{name:'Large frame',alle:['N','lg']}};
// polygenic traits: each a few gene pairs, 1 = "more"; selection over generations fixes them and a line breeds true
const HPG={size:6,len:3,ht:3,mus:4,fat:3,grow:5,mat:3,hlth:4,str:4,spd:4,end:4,agg:3,tmp:3,tusk:4,curve:2,dens:3,shade:3,ear:2,snout:2,head:2,tail:2,fert:3};
// allele frequencies by wild type: [first allele(s)] for the loci, and the "more" frequency for polygenic traits
const HOGF={
  feral:{E:{ED:.35,E:.45},D:{d:.12},Gz:{Gz:.3},P:{P:.14},Sk:{sk:.18},Wm:{Wm:.08},Hl:{Hl:.3},Lg:{lg:.08},p:{size:.24,grow:.42,str:.4,spd:.5,agg:.4,tusk:.35,end:.45}},
  razor:{E:{ED:.45,E:.45},D:{d:.08},Gz:{Gz:.35},P:{P:.1},Sk:{sk:.12},Wm:{Wm:.05},Hl:{Hl:.55},Lg:{lg:.08},p:{size:.34,spd:.62,end:.6,agg:.55,tusk:.55,fat:.3,len:.6}},
  spotted:{E:{ED:.45,E:.35},D:{d:.1},Gz:{Gz:.25},P:{P:.72},Sk:{sk:.28},Wm:{Wm:.14},Hl:{Hl:.45},Lg:{lg:.1},p:{size:.44,str:.5,tusk:.5}},
  russian:{E:{ED:.12,E:.8},D:{d:.06},Gz:{Gz:.7},P:{P:.08},Sk:{sk:.1},Wm:{Wm:.03},Hl:{Hl:.85},Lg:{lg:.15},p:{size:.58,str:.6,mus:.6,tusk:.66,agg:.62,ht:.62,dens:.7}},
  ghost:{E:{ED:.25,E:.6},D:{d:.62},Gz:{Gz:.55},P:{P:.1},Sk:{sk:.2},Wm:{Wm:.06},Hl:{Hl:.7},Lg:{lg:.25},p:{size:.74,str:.7,mus:.66,tusk:.76,agg:.6,tmp:.3}},
  giant:{E:{ED:.3,E:.6},D:{d:.1},Gz:{Gz:.5},P:{P:.15},Sk:{sk:.1},Wm:{Wm:.04},Hl:{Hl:.8},Lg:{lg:.5},p:{size:.9,str:.82,mus:.8,tusk:.86,agg:.7,grow:.6}}};
const HOG_NAMES=['Tusker','Mud Queen','Big Red','Rooter','Old Slick','Bristle','Hambone','Sarge','Duchess','Brute','Mossy','Ranger','Sugar','Tank','Wallow','Gristle','Pepper','Boss','Ginger','Chopper','Dozer','Molly','Bandit','Clover','Rowdy','Hazel','Tater','Bubba','Dixie','Moose'];
const HOG_ADULT={M:10,F:8},HOG_GEST=4,HOG_COOL=2,HOG_DNA=100;
const HOG_RATION={light:{name:'Light',feed:.6,grow:.9,bc:-4},standard:{name:'Standard',feed:1,grow:1,bc:6},heavy:{name:'Heavy',feed:1.45,grow:1.07,bc:10}};
const HOGG={
  // ---------- genes ----------
  alle(freq,loc,rng){const al=HGL[loc].alle,f=freq[loc]||{};if(al.length===3){let r=rng();r-=f[al[0]]||0;if(r<0)return al[0];r-=f[al[1]]||0;if(r<0)return al[1];return al[2]}
    const rec=al[1],pr=f[rec]??(1-(f[al[0]]??0));return rng()<pr?rec:al[0]},
  randomGenes(key,rng=R){const F=HOGF[key]||HOGF.feral,g={};for(const l in HGL)g[l]=[HOGG.alle(F,l,rng),HOGG.alle(F,l,rng)];
    for(const k in HPG){const f=(F.p||{})[k]??.45;g[k]=Array.from({length:HPG[k]},()=>[rng()<f?1:0,rng()<f?1:0])}return g},
  has:(g,l,a)=>g[l][0]===a||g[l][1]===a,cnt:(g,l,a)=>(g[l][0]===a)+(g[l][1]===a),
  sc:(g,k)=>g[k].reduce((s,p)=>s+p[0]+p[1],0)/(2*HPG[k]),
  // nudge a trait's genes toward a score (used once, to fit a wild hog's genes to what it showed on the hunt)
  fit(g,k,target,rng){const n=HPG[k]*2;for(let i=0;i<40;i++){const s=HOGG.sc(g,k);if(Math.abs(s-target)<=.5/n+.001)return;const up=s<target,c=g[k].flatMap((p,j)=>[[j,0],[j,1]]).filter(([j,a])=>g[k][j][a]===(up?0:1));if(!c.length)return;const[j,a]=c[Math.floor(rng()*c.length)];g[k][j][a]=up?1:0}},
  // ---------- body: size, growth and weight ----------
  maxW(h){const g=h.genes,sz=HOGG.sc(g,'size');return Math.round((70+360*Math.pow(sz,1.2)+60*HOGG.sc(g,'mus')+40*HOGG.sc(g,'fat'))*(HOGG.cnt(g,'Lg','lg')===2?1.18:1)*(h.sex==='M'?1.12:.9))},
  kGrow:h=>13-6*HOGG.sc(h.genes,'grow')-1.5*HOGG.sc(h.genes,'mat'),
  frac(h,age=h.age){return Math.pow(1-Math.exp(-Math.max(0,age)/HOGG.kGrow(h)),1.6)},
  target(h){const R0=HOG_RATION[(S.hogPin||{}).ration||'standard'];return Math.max(2.5,HOGG.maxW(h)*HOGG.frac(h)*(.85+.15*(h.bc??100)/100)*(.9+.1*(h.health??100)/100)*R0.grow)},
  ageFor(h,w){const m=HOGG.maxW(h);for(let a=1;a<=96;a++)if(m*HOGG.frac(h,a)>=w)return a;return 96},
  // ---------- stats ----------
  pot(h){const g=h.genes,s=k=>HOGG.sc(g,k),v=x=>Math.round(25+70*clamp(x,0,1)),lg=HOGG.cnt(g,'Lg','lg')===2?.12:0;
    return{str:v(.6*s('str')+.25*s('mus')+.15*s('size')),spd:v(.7*s('spd')+.2*(1-s('fat'))+.1*s('len')-.1*s('size')+.05),end:v(.7*s('end')+.3*s('hlth')),grow:v(.85*s('grow')+.15*s('mat')),
      hlth:v(s('hlth')),size:v(s('size')+lg),mus:v(s('mus')),agg:v(s('agg')),tmp:v(s('tmp')),hard:v(.5*s('hlth')+.5*s('end')),tusk:v(s('tusk'))}},
  mature(h){return clamp(.35+.65*HOGG.frac(h)/.9,0,1)},
  stats(h){const P=HOGG.pot(h),m=HOGG.mature(h),c=.85+.15*(h.bc??100)/100,e=h.env||{},o={};for(const k in P){const grown=['str','spd','end','mus','size','tusk'].includes(k)?P[k]*m*c:P[k];o[k]=clamp(Math.round(grown+(e[k]||0)),5,99)}return o},
  STATS:[['str','Strength'],['spd','Speed'],['end','Endurance'],['grow','Growth rate'],['hlth','Health genetics'],['size','Body size'],['mus','Muscle'],['agg','Aggression'],['tmp','Temperament'],['hard','Hardiness'],['tusk','Tusk size']],
  // ---------- what it looks like: all from the genes (plus its seed and age) ----------
  pheno(h){const g=h.genes,has=(l,a)=>HOGG.has(g,l,a),n=(l,a)=>HOGG.cnt(g,l,a),sh=HOGG.sc(g,'shade');
    const black=has('E','ED'),red=!black&&n('E','e')===2,dil=n('D','d')===2;
    let body,base;if(black){base=dil?'Gray-Brown':'Black';body=dil?[.3,.27,.24]:[.06,.055,.05]}
    else if(red){base=dil?'Tan':sh>.5?'Red-Brown':'Tan';body=dil?[.66,.52,.36]:sh>.5?[.31,.15,.08]:[.52,.37,.23]}
    else{base=dil?'Tan':sh>.66?'Dark Brown':sh>.33?'Brown':'Gray-Brown';body=dil?[.56,.44,.3]:sh>.66?[.13,.09,.06]:sh>.33?[.23,.15,.1]:[.31,.26,.21]}
    const dark=(body[0]+body[1]+body[2])/3<.2,gz=has('Gz','Gz'),pat=n('P','P'),spk=n('Sk','sk')===2,wm=n('Wm','Wm'),piglet=h.age<4&&!black&&!red;
    const tip=dil?[.78,.7,.56]:[.62,.46,.28],patch=(body[0]+body[1]+body[2])/3<.12?[.5,.34,.2]:[.06,.05,.045],mane=gz?hmix(body,tip,.35).map(v=>v*.8):body.map(v=>v*.62);
    let name=base;if(pat)name=black&&!dil?'Black/Brown':(body[0]+body[1]+body[2])/3<.12?base+' with tan patches':base+'/Black';else if(gz)name=black&&!dil?'Black with Tan Highlights':base==='Brown'||base==='Dark Brown'?'Mixed Brown':base+' grizzled';
    if(spk)name+=dark?', Dark Speckled':', Light Speckled';if(wm)name+=', white markings';if(piglet)name='Striped Piglet Coat ('+name+')';
    const hl=n('Hl','Hl'),dens=HOGG.sc(g,'dens'),s=k=>HOGG.sc(g,k),sow=h.sex==='F',tg=clamp(h.age/30,.25,1);
    const W3=(x,a,b,c)=>x<.34?a:x<.67?b:c;
    return{base,name,body,dark,black,red,dil,gz,pat,spk,wm,piglet,tip,patch,mane,hl,dens,
      tuskLen:clamp((.3+.7*s('tusk'))*tg*(sow?.55:1),.12,1),earLen:.72+.28*s('ear'),tailLen:.5+.5*s('tail'),crestCut:hl===2?0:hl===1?6:16,len:.94+.12*s('len'),ht:.94+.12*s('ht'),
      hair:W3(s('dens')*.5+hl*.25,'Short, thin','Medium','Long, dense'),head:W3(s('head'),'Narrow head','Medium head','Broad head'),snout:W3(s('snout'),'Short snout','Medium snout','Long snout'),
      ears:W3(s('ear'),'Small ears','Medium ears','Large ears'),tail:W3(s('tail'),'Short tail','Medium tail','Long tufted tail'),tusk:W3(s('tusk'),'Small tusks','Medium tusks','Big tusks'),curve:W3(s('curve'),'Straight','Curved','Hooked'),
      frame:W3(s('len'),'Short-bodied','Medium length','Long-bodied')+', '+W3(s('ht'),'low','medium','tall')+' at the shoulder',fat:W3(s('fat'),'Lean','Moderate','Heavy-set')}},
  hex(h){const P=HOGG.pheno(h);return hhex(P.pat?hmix(P.body,P.patch,.35):P.body)},
  // ---------- identity ----------
  nextId(){S.hogSeq=(S.hogSeq||0)+1;return'HG-'+String(S.hogSeq).padStart(6,'0')},
  typeName(h){const a=h.anc||{feral:1},e=Object.entries(a).sort((x,y)=>y[1]-x[1]);return e[0][1]>=.75?HOGT[e[0][0]]:e.slice(0,2).map(([k])=>HOGT[k]).join(' × ')+' cross'},
  sexWord:h=>h.age<3?(h.sex==='M'?'Boar piglet':'Sow piglet'):h.age<HOG_ADULT[h.sex]?(h.sex==='M'?'Young boar':'Gilt'):h.sex==='M'?'Boar':'Sow',
  domKey(h){return Object.entries(h.anc||{feral:1}).sort((x,y)=>y[1]-x[1])[0][0]},
  // a kept hog: settle refreshes everything derived (stats, hunt behaviour for dog training, coat name, value)
  settle(h){const st=HOGG.stats(h),P=HOGG.pheno(h);h.coat=P.name;h.key=HOGG.domKey(h);h.type=HOGG.typeName(h);
    h.mult=Object.entries(h.anc||{feral:1}).reduce((s,[k,f])=>s+HOGS[k].mult*f,0);h.sp=.8+st.spd/100*.45;h.end=.8+st.end/100*.65;h.aggr=st.agg/100;h.aware=h.aware??clamp(1-st.tmp/100,.2,.95);
    h.w=Math.round(h.wt);h.price=HOGG.value(h);return h},
  value(h){const st=HOGG.stats(h),q=(st.str+st.grow+st.size+st.hlth)/400;return Math.max(35,Math.round(h.wt*4*h.mult*(.7+.5*q)*(.6+.4*(h.health??100)/100)*(h.age<3?.6:1)))},
  create(o){const rng=mulberry(o.seed||ri(1,2e9)),seed=o.seed||ri(1,2e9);
    const h={id:HOGG.nextId(),name:o.name||pick(HOG_NAMES),sex:o.sex||(rng()<.5?'M':'F'),age:o.age??0,gen:o.gen||0,seed,genes:o.genes,known:{},anc:o.anc||{feral:1},
      wt:o.wt??2.5,bc:100,health:100,cond:100,uses:0,env:o.env||{},parents:o.parents||null,bl:o.bl||null,born:S.day-(o.age??0),kept:S.day,litters:0,sired:0,cool:0,from:o.from||'Born on the ranch',hist:[]};
    if(!h.bl)h.bl={line:h.name+"'s line",q:ri(4,16),gen:0};return HOGG.settle(h)},
  // the exact hog from the hunt: its seed makes its genes; they are fitted to what it showed; its weight is kept as caught
  wildGenes(o){const rng=mulberry(o.seed),key=HOGF[o.key]?o.key:'feral',g=HOGG.randomGenes(key,rng);
    HOGG.fit(g,'spd',clamp(((o.sp||1)-.8)/.45,0,1),rng);HOGG.fit(g,'end',clamp(((o.end||1)-.8)/.65,0,1),rng);HOGG.fit(g,'agg',clamp(o.aggr??.5,0,1),rng);
    const probe={genes:g,sex:o.sex||'M'};for(let i=0;i<30&&HOGG.maxW(probe)*.97<o.w;i++){const c=g.size.flatMap((p,j)=>[[j,0],[j,1]]).filter(([j,a])=>!g.size[j][a]);if(c.length){const[j,a]=c[Math.floor(rng()*c.length)];g.size[j][a]=1}else break}
    return g},
  fromWild(o){const key=HOGF[o.key]?o.key:'feral',sex=o.sex||(o.seed%2?'M':'F'),genes=HOGG.wildGenes({...o,sex}),probe={genes,sex,age:24};
    const age=clamp(HOGG.ageFor(probe,o.w),6,72),h=HOGG.create({seed:o.seed,sex,age,genes,anc:{[key]:1},wt:o.w,from:`Caught in the ${areaName(o.area||'creek')}, day ${o.day||S.day}`});
    h.id0=o.id;h.aware=o.aware;
    // the stats it showed on the hunt, exactly; the genes carry the heritable part
    const st=HOGG.stats({...h,env:{}}),ob={spd:Math.round(25+70*clamp(((o.sp||1)-.8)/.45,0,1)),end:Math.round(25+70*clamp(((o.end||1)-.8)/.65,0,1)),agg:Math.round(25+70*clamp(o.aggr??.5,0,1))};
    h.env={spd:ob.spd-st.spd,end:ob.end-st.end,agg:ob.agg-st.agg};return HOGG.settle(h)},
  // ---------- the pin ----------
  cap:()=>Math.max(1,hogCap()),
  room:()=>HOGG.cap()-S.hogs.length-((S.land&&S.land.hogs)||[]).length,
  water(){return S.land&&(landLevel(S.land,'water')>0||(S.hogPin||{}).waterer)},
  feedNeed(){const R0=HOG_RATION[(S.hogPin||{}).ration||'standard'];return S.hogs.reduce((s,h)=>s+(h.age<2?0:h.age<6?.5:1)+(h.preg||h.nurse>0?.5:0),0)*R0.feed},
  tierName(){const lv=S.land?Math.max(0,...S.land.buildings.filter(b=>b.type==='pigpen').map(b=>b.lvl||1)):0,c=HOGG.cap();return c>=100?'Advanced Hog Ranch':lv>=3?'Large Hog Pin':lv===2?'Upgraded Hog Pin':lv===1?'Basic Hog Pin':'Catch pen'},
  // ---------- inheritance ----------
  snap(h,depth=3){return{id:h.id,name:h.name,sex:h.sex,coat:h.coat,gen:h.gen,w:h.w,type:h.type,parents:depth>1&&h.parents?h.parents.map(p=>p&&HOGG.trim(p,depth-1)):null}},
  trim(p,d){return{...p,parents:d>1&&p.parents?p.parents.map(q=>q&&HOGG.trim(q,d-1)):null}},
  childGenes(s,d,rng=R){const g={},pk=a=>a[rng()<.5?0:1];for(const l in HGL)g[l]=[pk(s[l]),pk(d[l])];for(const k in HPG)g[k]=s[k].map((p,i)=>[pk(p),pk(d[k][i])]);return g},
  // bloodlines: a line keeps its name while you breed within it; its character is read from the genes, never assigned
  childLine(s,d){const same=s.bl.line===d.bl.line,top=d.bl.q>s.bl.q?d:s,q0=(s.bl.q+d.bl.q)/2;
    return{line:top.bl.line,q:Math.round(clamp(q0*(same?.9:.65)+(same?5:1)+Math.max(0,HOGG.quality(s)+HOGG.quality(d)-100)*.15,0,100)),gen:(same?Math.max(s.bl.gen,d.bl.gen):0)+1}},
  quality(h){const p=HOGG.pot(h);return(p.str+p.grow+p.size+p.hlth+p.end+p.spd)/6},
  // what a line is turning into: the traits that are high AND breeding true (few loci left mixed)
  character(h){const g=h.genes,t=(ks)=>{let s=0,hom=0,n=0;for(const k of ks){s+=HOGG.sc(g,k);for(const p of g[k]){n++;if(p[0]===p[1])hom++}}return{s:s/ks.length,hom:hom/n}};
    const C=[['Heavyweight',['size','grow','fat']],['Athletic',['spd','end']],['Power',['str','mus','tusk']],['Hardy',['hlth','end']],['Easy-going',['tmp']]].map(([n,ks])=>({n,...t(ks)})).filter(c=>c.s>=.62).sort((a,b)=>b.s-a.s);
    return C.length?C.slice(0,2).map(c=>`${c.n} (${Math.round(c.hom*100)}% breeding true)`).join(', '):'No strong focus yet'},
  litter(s,d){const n=clamp(Math.round(4+HOGG.sc(d.genes,'fert')*4+gauss()*1.3+(d.age<14?-1:0)+(d.health<80?-1:0)),3,10),bl=HOGG.childLine(s,d),out=[],anc={};
    for(const k of new Set([...Object.keys(s.anc||{}),...Object.keys(d.anc||{})]))anc[k]=((s.anc||{})[k]||0)/2+((d.anc||{})[k]||0)/2;
    for(let i=0;i<n;i++){const genes=HOGG.childGenes(s.genes,d.genes);out.push(HOGG.create({age:0,wt:2+R()*1.2,genes,anc,gen:Math.max(s.gen||0,d.gen||0)+1,parents:[HOGG.snap(s),HOGG.snap(d)],bl:{...bl},from:`Born on the ranch, day ${S.day}`}))}
    return out},
  // a litter tells you about its parents' hidden genes
  reveal(pigs,s,d){for(const[l,a]of[['E','e'],['D','d'],['Sk','sk'],['Lg','lg']])if(pigs.some(p=>HOGG.cnt(p.genes,l,a)===2))for(const x of[s,d])if(x&&x.known)x.known[l]=1},
  // ---------- prediction from what the player can know: hidden genes are drawn from the parents' wild types ----------
  belief(h,rng){const G=h.genes,P=HOGG.pheno(h),k=h.known||{},key=HOGG.domKey(h),F=HOGF[key]||HOGF.feral,g=JSON.parse(JSON.stringify(G)),dr=l=>HOGG.alle(F,l,rng);
    const vis={E:P.black?1:P.red?2:1,D:P.dil?2:1,Gz:P.gz?1:2,P:2,Sk:P.spk?2:1,Wm:P.wm?1:2,Hl:2,Lg:HOGG.cnt(G,'Lg','lg')===2?2:1};
    for(const l in HGL){if(k[l]||vis[l]===2)continue;const dom=HGL[l].alle[0];
      if(vis[l]===1){const keep=l==='E'?(P.black?'ED':'E'):dom;let o=dr(l);if(l==='E'&&!P.black&&o==='ED')o='E';g[l]=[keep,o]}else g[l]=[dr(l),dr(l)]}return g},
  predict(s,d,n=240){const coats={},pat={p:0,s:0,w:0,st:0},rng=R;let wmax=0,wmin=1e9;
    for(let i=0;i<n;i++){const g=HOGG.childGenes(HOGG.belief(s,rng),HOGG.belief(d,rng),rng),x={genes:g,sex:rng()<.5?'M':'F',age:30,seed:1},P=HOGG.pheno(x);
      const nm=P.name.split(',')[0];coats[nm]=(coats[nm]||0)+1;if(P.pat)pat.p++;if(P.spk)pat.s++;if(P.wm)pat.w++;if(!P.black&&!P.red)pat.st++;const w=HOGG.maxW(x);wmax=Math.max(wmax,w);wmin=Math.min(wmin,w)}
    const pc=v=>Math.round(v/n*100),ps=HOGG.pot(s),pd=HOGG.pot(d);
    return{coats:Object.entries(coats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,pc(v)]).filter(x=>x[1]>=2).slice(0,7),patch:pc(pat.p),speck:pc(pat.s),white:pc(pat.w),stripe:pc(pat.st),
      size:[Math.max(3,Math.round(3+HOGG.sc(d.genes,'fert')*4-1)),Math.min(10,Math.round(5+HOGG.sc(d.genes,'fert')*4+1))],wt:[wmin,wmax],
      stats:HOGG.STATS.slice(0,7).map(([k,l])=>{const m=(ps[k]+pd[k])/2;return[l,Math.round(m-10),Math.round(m+10)]})}},
  // ---------- rules ----------
  canBreed(b,s){const pr=[];if(!b||!s){pr.push('Pick a boar and a sow from your Hog Pin.');return pr}
    if(!S.hogs.includes(b)||!S.hogs.includes(s))pr.push('Only hogs you kept in your Hog Pin can breed.');
    if(b.sex!=='M')pr.push(`${b.name} is not a boar.`);if(s.sex!=='F')pr.push(`${s.name} is not a sow.`);
    if(b.age<HOG_ADULT.M)pr.push(`${b.name} isn't mature yet (boars breed from ${HOG_ADULT.M} months).`);if(s.age<HOG_ADULT.F)pr.push(`${s.name} isn't mature yet (sows breed from ${HOG_ADULT.F} months).`);
    if(b.health<60)pr.push(`${b.name} isn't healthy enough.`);if(s.health<60)pr.push(`${s.name} isn't healthy enough.`);
    if(s.preg)pr.push(`${s.name} is already bred.`);if(s.cool>0)pr.push(`${s.name} is still nursing (${s.cool} more day${s.cool>1?'s':''}).`);if(b.lastBred===S.day)pr.push(`${b.name} already bred a sow today.`);
    if(HOGG.room()<3)pr.push('Make room in the Hog Pin for a litter (at least 3 spaces).');return pr},
  breed(b,s){const pr=HOGG.canBreed(b,s);if(pr.length)return pr;s.preg={boar:HOGG.snap(b),boarRef:b.id,day:S.day,due:S.day+HOG_GEST};b.lastBred=S.day;
    addLog(`${s.name} was bred to ${b.name}. Piglets due day ${S.day+HOG_GEST}.`);return[]},
  stage(s){const p=s.preg;if(!p)return'';const left=p.due-S.day;return left<=0?'Farrowing':left===1?'Near birth':p.day===S.day?'Bred today':'Pregnant'},
  // ---------- a day on the ranch: feed, water, growth, health, pregnancies and litters ----------
  daily(msgs){const pin=S.hogPin=S.hogPin||{ration:'standard'};if(!S.hogs.length)return;const R0=HOG_RATION[pin.ration]||HOG_RATION.standard;
    const need=Math.ceil(HOGG.feedNeed()),have=Math.min(S.inv.feed,need),fed=need?have/need:1;S.inv.feed-=have;pin.fedDay=S.day;pin.fed=fed;
    if(fed<1)msgs.push(`The hogs only got ${Math.round(fed*100)}% of their feed. Buy feed or cut the ration.`);
    const water=HOGG.water();if(!water){const c=S.hogs.length;S.money-=c;pin.hauled=(pin.hauled||0)+c}
    for(const h of S.hogs){h.age++;if(h.cool>0)h.cool--;if(h.nurse>0)h.nurse--;h.cond=Math.min(100,(h.cond??100)+15);
      h.bc=clamp((h.bc??100)+(fed>=.99?R0.bc:-12*(1-fed)),30,100);if(fed>=.99&&pin.ration==='light'&&h.bc<75)h.bc=Math.max(h.bc,75);
      h.health=clamp((h.health??100)+(fed>=.99?3:-5*(1-fed)-1)+(h.age>96?-1:0),10,100);
      const t=HOGG.target(h);h.wt=Math.max(2,h.wt+(t-h.wt)*(t>h.wt?.4:.25));HOGG.settle(h)}
    for(const s of S.hogs.filter(x=>x.preg&&x.preg.due<=S.day)){const p=s.preg,b=S.hogs.find(x=>x.id===p.boarRef)||p.boarFull||{...p.boar,genes:HOGG.randomGenes(HOGG.domKey(s)),anc:{[HOGG.domKey(s)]:1},bl:{line:p.boar.name+"'s line",q:10,gen:0},gen:p.boar.gen||0};
      const pigs=HOGG.litter(b,s);s.preg=null;s.cool=HOG_COOL;s.nurse=2;s.litters=(s.litters||0)+1;if(b.id&&S.hogs.includes(b))b.sired=(b.sired||0)+pigs.length;HOGG.reveal(pigs,S.hogs.includes(b)?b:null,s);
      const room=HOGG.room(),keep=pigs.slice(0,Math.max(0,room)),extra=pigs.slice(keep.length);S.hogs.push(...keep);
      s.hist=(s.hist||[]).concat([{day:S.day,kind:'litter',n:pigs.length,ids:keep.map(x=>x.id),boar:p.boar.name}]);
      let m=`${s.name} farrowed ${pigs.length} piglets by ${p.boar.name}!`;if(extra.length){const v=extra.length*35;earn(v);m+=` No room for ${extra.length}; sold as feeder pigs for ${fmt(v)}.`}
      msgs.push(m);addLog(`Litter: ${s.name} × ${p.boar.name}, ${pigs.length} piglets (${keep.map(x=>x.id).join(', ')||'none kept'}).`);S.st.hogLitters=(S.st.hogLitters||0)+1;gainXP(20);
      (UI.newLitter=UI.newLitter||[]).push(...keep.map(x=>x.id))}},
  sell(h){const v=h.price;earn(v);S.hogs=S.hogs.filter(x=>x!==h);(S.hogRecords=S.hogRecords||[]).unshift({...HOGG.snap(h),sold:S.day,price:v});S.hogRecords=S.hogRecords.slice(0,300);
    addLog(`Sold ${h.name} (${h.id}, ${h.w} lb) for ${fmt(v)}.`);return v},
  find(id){return S.hogs.find(h=>h.id===id)||(UI.hogPreview||[]).find(h=>h.id===id)||(UI.pendingHogView&&UI.pendingHogView.id===id?UI.pendingHogView:null)||(UI.trophyHogs||{})[id]||null},
  // older saves: training hogs become Hog Pin hogs with genes that fit them; an unanswered catch gets a seed and a sex
  migrate(){S.hogs=S.hogs||[];S.hogPin=S.hogPin||{ration:'standard'};S.hogPreg=undefined;
    const P=S.land;if(P&&P.trainHogs&&P.trainHogs.length){for(const t of P.trainHogs){const h=HOGG.fromWild({seed:hashStr(t.id||t.name)||ri(1,2e9),key:t.key,w:t.w,sp:t.sp,end:t.end,aggr:t.aggr,aware:t.aware,sex:/boar/i.test(t.name)?'M':undefined,area:(S.land&&accessArea(S.land))||'creek',day:t.day});h.cond=t.cond??100;h.uses=t.uses||0;S.hogs.push(h)}P.trainHogs=[]}
    if(S.pendingHog&&!S.pendingHog.seed){S.pendingHog.seed=hashStr(S.pendingHog.id)||ri(1,2e9);S.pendingHog.sex=/boar/i.test(S.pendingHog.name)?'M':'F'}}
};

const HOGMAPS={},HOG_IMG={},HOG_PENDING={};let hogQ=Promise.resolve();
async function hogMaps(key){if(HOGMAPS[key])return HOGMAPS[key];const M=HOG_MASTERS[key];const ims=await Promise.all([loadImg(M.maps.m1),loadImg(M.maps.m2),loadImg(M.maps.m3)]);
  const rd=(im,sm)=>{const c=document.createElement('canvas');c.width=M.w;c.height=M.h;const x=c.getContext('2d');x.imageSmoothingEnabled=sm;x.drawImage(im,0,0);return x.getImageData(0,0,M.w,M.h).data};
  return HOGMAPS[key]={w:M.w,h:M.h,m1:rd(ims[0],true),m2:rd(ims[1],false),m3:rd(ims[2],true)}}
HOGG.render=async function(h,scale){const M=await hogMaps('wild'),P=HOGG.pheno(h),W=Math.round(M.w*scale),H=Math.round(M.h*scale),sd=(h.seed||1)%99991,inv=1/scale;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),img=g.createImageData(W,H),o=img.data;
  const IVORY=[.86,.8,.66],WHITE=[.86,.83,.77],skin=P.dark?[.2,.17,.16]:[.34,.27,.25],hoof=P.wm?[.5,.44,.36]:[.22,.18,.15],contrast=.5+.5*P.dens,thr=P.pat===2?.43:.5;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(M.w-1,(x*inv)|0),sy=Math.min(M.h-1,(y*inv)|0),i=(sy*M.w+sx)*4;let a=M.m3[i];if(!a)continue;
    const shade=M.m1[i]/127.5,det=M.m1[i+1],tanRef=M.m1[i+2]/255,reg=Math.round(M.m2[i]/20),rch=M.m2[i+1]/255,td=M.m3[i+2];let c;
    if(reg===6){if(rch>P.tuskLen)continue;c=IVORY}
    else if(reg===4&&rch>P.earLen)continue;
    else if(reg===9&&rch>P.tailLen)continue;
    else if(reg===8&&td<P.crestCut)continue;
    if(!c){if(reg===5)c=[.3,.17,.07];else if(reg===7)c=hoof;else if(reg===3)c=skin;
      else{c=P.body;
        if(P.pat){const pf=.62*lnoise(sx/34,sy/27,sd+1)+.26*lnoise(sx/12,sy/12,sd+2)+.12*tanRef+(det-128)/500;if(pf>thr-.03)c=hmix(c,P.patch,clamp((pf-thr+.03)/.06,0,1))}
        if(P.piglet&&(reg===1||reg===2)&&td>8){const st=Math.sin(td*.23+sx*.004);if(st>.45)c=hmix(c,[.62,.48,.3],.55)}
        if(reg===8){const m=clamp(1-(td-14)/34,0,1);c=hmix(c,P.mane,m)}
        if(reg===11)c=hmix(c,P.black?c:[.08,.07,.06],.35);
        if(P.gz&&det>134)c=hmix(c,P.tip,clamp((det-134)/50,0,1)*.8);
        if(P.spk&&hash2(sx,sy,sd+3)<.1&&det>126)c=hmix(c,P.dark?[.72,.62,.46]:[.1,.08,.06],.7);
        if(P.wm){let w=0;if(reg===11&&rch<.4+.25*P.wm)w=1;if(reg===2&&lnoise(sx/18,sy/18,sd+5)>.7)w=1;if(reg===1&&td>150&&lnoise(sx/40,sy/30,sd+6)>.66-.08*P.wm)w=1;if(w)c=hmix(c,WHITE,.9)}}
      if(reg!==6&&reg!==5)c=c.map(v=>v*(1+(det-128)/128*.22*contrast))}
    const p=(y*W+x)*4;o[p]=clamp(c[0]*shade*255,0,255);o[p+1]=clamp(c[1]*shade*255,0,255);o[p+2]=clamp(c[2]*shade*255,0,255);o[p+3]=a}
  g.putImageData(img,0,0);
  // body length and height from the genes: stretch the drawing, standing on the same ground line
  const out=document.createElement('canvas');out.width=W;out.height=H;const og=out.getContext('2d'),fx=P.len,fy=P.ht,dw=W*fx/Math.max(fx,fy)*.96,dh=H*fy/Math.max(fx,fy)*.96;og.drawImage(cv,(W-dw)/2,H-dh,dw,dh);return out};
HOGG.imgKey=(h,sc)=>{const P=HOGG.pheno(h);return`${h.id}|${h.seed}|${sc}|${P.name}|${P.tuskLen.toFixed(2)}|${P.piglet}`};
// the picture is drawn bigger for heavier hogs, so a piglet looks like a piglet next to a 300 lb boar
HOGG.art=function(h,w=160){const sc=w>300?.5:w>180?.34:.24,key=HOGG.imgKey(h,sc),src=HOG_IMG[key],f=clamp(.4+.6*Math.sqrt((h.wt||h.w||100)/320),.35,1.05);
  return`<img class="hogimg" data-hgid="${h.id}" data-sc="${sc}" ${src?`src="${src}"`:''} width="${w}" height="${Math.round(w*2/3)}" alt="${esc(h.name)}, ${esc(h.coat||'')}" style="width:${Math.round(w*f)}px;max-width:100%;height:auto;aspect-ratio:3/2">`};
function hydrateHogs(){document.querySelectorAll('img.hogimg:not([src])').forEach(img=>{const id=img.dataset.hgid,sc=+img.dataset.sc,h=HOGG.find(id);if(!h)return;const key=HOGG.imgKey(h,sc);
  if(HOG_IMG[key]){img.src=HOG_IMG[key];return}if(HOG_PENDING[key])return;HOG_PENDING[key]=1;
  hogQ=hogQ.then(async()=>{const c=await HOGG.render(h,sc);HOG_IMG[key]=c.toDataURL('image/png');delete HOG_PENDING[key];
    document.querySelectorAll(`img.hogimg[data-hgid="${id}"][data-sc="${sc}"]`).forEach(i=>i.src=HOG_IMG[key]);await new Promise(r=>setTimeout(r,0))}).catch(e=>{console.error('hog art',e);delete HOG_PENDING[key]})})}

export { HOGT, HGL, HPG, HOGF, HOG_NAMES, HOG_ADULT, HOG_GEST, HOG_COOL, HOG_RATION, HOG_MASTERS, HOGG, hydrateHogs, HOG_IMG };
// hogs that aren't in the pin (trophy mounts, the bay pen hog) can still be drawn
export const showHogs = list => { UI.hogPreview = list; };
