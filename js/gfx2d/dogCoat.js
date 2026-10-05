// The Hogs & Dogs coat engine, brought over as is (ktanks811-afk/Hogs-and-dogs,
// index.html "Coat"). It turns a dog's genes into a coat spec (colour,
// pattern, white, merle, ticking, eyes) and paints it onto the hand-traced
// breed masters in img/dogs/masters (m1 shading, m2 regions, m3 masks).
// Nothing here touches the DOM until render() is called, so check-data can
// use fromGenotype / describe / rarity in node.
/* eslint-disable */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image ' + src)); i.src = src; });

export const Coat=(()=>{
const BODIES={
  apbt_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/apbt_stack_v1-m1.186dbeaac3.webp',m2:'img/dogs/masters/apbt_stack_v1-m2.6ee009d3f1.webp',m3:'img/dogs/masters/apbt_stack_v1-m3.a038df1cba.webp'}},
  cur_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/cur_stack_v1-m1.f5a2a7a673.webp',m2:'img/dogs/masters/cur_stack_v1-m2.fba8f502bf.webp',m3:'img/dogs/masters/cur_stack_v1-m3.434d84b353.webp'}},
  bulldog_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/bulldog_stack_v1-m1.d952086e6f.webp',m2:'img/dogs/masters/bulldog_stack_v1-m2.b8af1703dc.webp',m3:'img/dogs/masters/bulldog_stack_v1-m3.9370204695.webp'}},
  catahoula_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/catahoula_stack_v1-m1.61fc06afa0.webp',m2:'img/dogs/masters/catahoula_stack_v1-m2.f75119d9a6.webp',m3:'img/dogs/masters/catahoula_stack_v1-m3.fb8589b26b.webp'}},
  walker_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/walker_stack_v1-m1.aa3ebd6755.webp',m2:'img/dogs/masters/walker_stack_v1-m2.bc873f7da0.webp',m3:'img/dogs/masters/walker_stack_v1-m3.1a1ce51e21.webp'}},
  dogo_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/dogo_stack_v1-m1.4de7090c5f.webp',m2:'img/dogs/masters/dogo_stack_v1-m2.b1462e690a.webp',m3:'img/dogs/masters/dogo_stack_v1-m3.50f1481eb6.webp'}},
  corso_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/corso_stack_v1-m1.eace432fa0.webp',m2:'img/dogs/masters/corso_stack_v1-m2.b96a1fbb57.webp',m3:'img/dogs/masters/corso_stack_v1-m3.40fb763b8c.webp'}},
  pit_bull_terrier_all_mastiff_mix_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/pit_bull_terrier_all_mastiff_mix_stack_v1-m1.0e290e88a7.webp',m2:'img/dogs/masters/pit_bull_terrier_all_mastiff_mix_stack_v1-m2.db3c625b24.webp',m3:'img/dogs/masters/pit_bull_terrier_all_mastiff_mix_stack_v1-m3.4473959d2f.webp'}},
  pit_bull_terrier_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/pit_bull_terrier_stack_v1-m1.87a3562c96.webp',m2:'img/dogs/masters/pit_bull_terrier_stack_v1-m2.378e350c57.webp',m3:'img/dogs/masters/pit_bull_terrier_stack_v1-m3.511ba93d9a.webp'}},
  gordon_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/gordon_stack_v1-m1.ad74ef8e48.webp',m2:'img/dogs/masters/gordon_stack_v1-m2.c279b9eb31.webp',m3:'img/dogs/masters/gordon_stack_v1-m3.4eb81361eb.webp'}},
  // built by tools/breeds/build_hound_masters.py from the reference pictures
  beagle_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/beagle_stack_v1-m1.6c99e7cf7b.webp',m2:'img/dogs/masters/beagle_stack_v1-m2.1254bdd917.webp',m3:'img/dogs/masters/beagle_stack_v1-m3.412399a62f.webp'}},
  redbone_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/redbone_stack_v1-m1.9ec8f87b59.webp',m2:'img/dogs/masters/redbone_stack_v1-m2.37507e2bd3.webp',m3:'img/dogs/masters/redbone_stack_v1-m3.1872c8f356.webp'}},
  bnt_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/bnt_stack_v1-m1.ca36f6a9d3.webp',m2:'img/dogs/masters/bnt_stack_v1-m2.ea02bfeba4.webp',m3:'img/dogs/masters/bnt_stack_v1-m3.87c7016778.webp'}},
  bully_stack_v1:{w:1536,h:1024,maps:{m1:'img/dogs/masters/bully_stack_v1-m1.a06d4fc1f0.webp',m2:'img/dogs/masters/bully_stack_v1-m2.ed3c168149.webp',m3:'img/dogs/masters/bully_stack_v1-m3.658f510ece.webp'}}
};
// Breed templates. Adding a breed = one entry here (+ a body if it needs a new silhouette).
const TEMPLATES={
  'American Pit Bull Terrier':{code:'APBT',body:'pit_bull_terrier_stack_v1',freq:{E:{Em:.2,eg:0,E:.5,e:.3},A:{ay:.5,as:.05,at:.2,a:.25},K:{K:.35,br:.4,y:.25},S:{S:.45,sp:.35,sw:.2},M:{M:.05,m:.95},T:{T:.08,t:.92},B:{B:.7,b:.3},D:{D:.7,d:.3}}},
    'Pit Bull Terrier × All Mastiff Mix':{code:'PBMX',body:'pit_bull_terrier_all_mastiff_mix_stack_v1',freq:{E:{Em:.2,eg:0,E:.5,e:.3},A:{ay:.5,as:.05,at:.2,a:.25},K:{K:.35,br:.4,y:.25},S:{S:.45,sp:.35,sw:.2},M:{M:.05,m:.95},T:{T:.08,t:.92},B:{B:.7,b:.3},D:{D:.7,d:.3}}},
  'Black Mountain Cur':{code:'BMTC',body:'cur_stack_v1',freq:{E:{Em:.35,eg:.06,E:.44,e:.15},A:{ay:.4,as:.1,at:.35,a:.15},K:{K:.3,br:.55,y:.15},S:{S:.85,sp:.12,sw:.03},M:{M:.03,m:.97},T:{T:.05,t:.95},B:{B:.8,b:.2},D:{D:.9,d:.1}}},
  'American Bulldog':{code:'AMBD',body:'bulldog_stack_v1',freq:{E:{Em:.15,eg:0,E:.6,e:.25},A:{ay:.5,as:.1,at:.2,a:.2},K:{K:.3,br:.4,y:.3},S:{S:.1,sp:.4,sw:.5},M:{M:.04,m:.96},T:{T:.08,t:.92},B:{B:.7,b:.3},D:{D:.85,d:.15}}},
  'Catahoula Leopard Dog':{code:'CATA',body:'catahoula_stack_v1',freq:{M:{M:.5,m:.5},K:{K:.55,br:.12,y:.33},A:{ay:.3,as:.1,at:.45,a:.15},E:{Em:.1,eg:0,E:.7,e:.2},S:{S:.7,sp:.2,sw:.1},B:{B:.75,b:.25},D:{D:.8,d:.2},T:{T:.1,t:.9}}},
  'Treeing Walker':{code:'TWC',body:'walker_stack_v1',aliases:['Treeing Walker Coonhound','Walker','Walker Coonhound'],freq:{S:{S:.05,sp:.55,sw:.4},K:{K:.15,br:.05,y:.8},A:{ay:.15,as:.3,at:.5,a:.05},E:{Em:.03,eg:0,E:.85,e:.12},T:{T:.45,t:.55},M:{M:.01,m:.99},B:{B:.92,b:.08},D:{D:.95,d:.05}}},
  'Dogo Argentino':{code:'DOGO',body:'dogo_stack_v1',lineBase:{S:['sw','sw']},freq:{L:{L:1,l:0},R:{R:0,r:1},B:{B:.95,b:.05},D:{D:.97,d:.03},E:{Em:.03,eg:0,E:.9,e:.07},K:{K:.95,br:0,y:.05},A:{ay:.4,as:.1,at:.3,a:.2},S:{S:0,sp:0,sw:1},M:{M:0,m:1},T:{T:0,t:1}}},
  'Cane Corso':{code:'CORS',body:'corso_stack_v1',lineBase:{A:['ay','ay'],E:['Em','E']},freq:{B:{B:1,b:0},D:{D:.6,d:.4},E:{Em:.6,eg:0,E:.4,e:0},K:{K:.45,br:.35,y:.2},A:{ay:1,as:0,at:0,a:0},S:{S:.9,sp:.1,sw:0},M:{M:0,m:1},T:{T:0,t:1},L:{L:1,l:0},R:{R:0,r:1}}},
  'Plott Hound':{code:'PLOT',body:'walker_stack_v1',proxy:true},
  'Blue Lacy':{code:'LACY',body:'cur_stack_v1',proxy:true},
  'Gordon Setter':{code:'GORD',body:'gordon_stack_v1',lineBase:{L:['l','l']},specDefaults:{longCoat:true,featherLen:.9,featherDen:.85,texture:.55},mods:{featherMod:.9,featherDen:.85,texture:.55},freq:{L:{L:0,l:1},R:{R:.04,r:.96},K:{K:.04,br:0,y:.96},A:{ay:.02,as:.03,at:.95,a:0},E:{Em:0,eg:0,E:.93,e:.07},S:{S:.9,sp:.08,sw:.02},B:{B:.9,b:.1},D:{D:.97,d:.03},M:{M:0,m:1},T:{T:.06,t:.94}}},
  'Mountain Cur':{code:'MTC',body:'cur_stack_v1'},
  'Black Mouth Cur':{code:'BMC',body:'cur_stack_v1'},
  'Leopard Cur':{code:'LPC',body:'cur_stack_v1'},
  'Beagle':{code:'BEAG',body:'beagle_stack_v1'},
  'Redbone Coonhound':{code:'RDBN',body:'redbone_stack_v1',aliases:['Redbone']},
  'Black and Tan Coonhound':{code:'BTCH',body:'bnt_stack_v1',aliases:['Black and Tan']},
  'American Bully':{code:'AMBL',body:'bully_stack_v1'},
  'German Rottweiler':{code:'GRTW',body:'corso_stack_v1',proxy:true,aliases:['Rottweiler','Rottie']},
  'American English Coonhound':{code:'AECH',body:'bnt_stack_v1',proxy:true,aliases:['Coonhound']},
  'Bluetick Coonhound':{code:'BLTK',body:'bnt_stack_v1',proxy:true,aliases:['Bluetick']},
  'Labrador Retriever':{code:'LAB',body:'cur_stack_v1',proxy:true,aliases:['Labrador','Lab']}
};
for(const [b,t] of Object.entries({...TEMPLATES}))if(t.body)TEMPLATES[`Mix (${b} build)`]={code:'X'+t.code,body:t.body,mix:true};
const GLOCI={B:['B','b'],D:['D','d'],E:['Em','eg','E','e'],K:['K','br','y'],A:['ay','as','at','a'],S:['S','sp','sw'],M:['M','m'],T:['T','t'],L:['L','l'],R:['R','r']};
const GLOCI_NAMES={B:'Brown / liver',D:'Dilution',E:'Extension (mask, grizzle, red)',K:'Dominant black / brindle',A:'Agouti (fawn, saddle, tan points)',S:'White spotting',M:'Merle',T:'Ticking',L:'Coat length (L short / l long)',R:'Roaning'};
const BASE_FREQ={L:{L:.97,l:.03},R:{R:.02,r:.98},B:{B:.8,b:.2},D:{D:.85,d:.15},E:{Em:.15,eg:.04,E:.51,e:.3},K:{K:.4,br:.3,y:.3},A:{ay:.45,as:.1,at:.25,a:.2},S:{S:.6,sp:.3,sw:.1},M:{M:.04,m:.96},T:{T:.1,t:.9}};
const COLORS={Black:'#27231f',Chocolate:'#5c3422',Liver:'#7a3f22',Red:'#a54e22',Fawn:'#bf8b50',Cream:'#e7d5ae',White:'#f2efe8',Blue:'#606c78',Lilac:'#9c8b88',Isabella:'#bda58c',Tan:'#b9742e','Dilute red':'#c89468','Blue fawn':'#bfa48b'};
const DILUTE={Black:'Blue',Chocolate:'Lilac',Liver:'Isabella',Red:'Dilute red',Fawn:'Blue fawn',Tan:'Isabella'};
const EYES={Brown:'#4f2d15',Amber:'#b8761f',Hazel:'#8c7633',Yellow:'#c9a02e',Green:'#6b8b3d',Blue:'#6ba0cd',Gray:'#8e979d',Glass:'#8fc2e8'};
const NOSES={Black:'#1d1a19',Liver:'#6b3827',Blue:'#57616b',Isabella:'#8b7367',Pink:'#c98b85'};
const PATTERNS=['solid','brindle','reverse brindle','saddle','tri-color','grizzle','sable','piebald'];
const DEF={breed:'Black Mountain Cur',base:'Black',secondary:'Auto',pattern:'solid',intensity:.5,coatIntensity:.5,white:0,mask:'None',dilution:false,merle:0,ticking:0,eyes:'Brown',eyes2:'Brown',merleMod:.5,speckling:0,coatLen:0,featherLen:.5,featherDen:.5,texture:0,roan:0,longCoat:false,nose:'Auto',paws:'Auto',ears:'Auto',tail:'Auto',seed:1};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hexC=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
const tpl=b=>TEMPLATES[b]||TEMPLATES['Black Mountain Cur'];

// ---------- genotype -> coat spec ----------
const WHITE_BASE={'S/S':.02,'S/sp':.2,'S/sw':.3,'sp/sp':.5,'sp/sw':.65,'sw/sw':.92};
function sortPair(L,p){const o=GLOCI[L];return p.slice().sort((a,b)=>o.indexOf(a)-o.indexOf(b))}
function fromGenotype(g,m={},breed=DEF.breed,ov={}){
  const has=(L,a)=>!!g[L]&&g[L].includes(a),hom=(L,a)=>!!g[L]&&g[L][0]===a&&g[L][1]===a,top=L=>g[L]?sortPair(L,g[L])[0]:null;
  const brown=hom('B','b'),dil=hom('D','d'),ci=m.coatInt??.5,pm=m.patMod??.5,seed=m.seed??1;
  const eu=brown?(ci>=.6?'Chocolate':'Liver'):'Black';
  const s={...DEF,breed,base:eu,dilution:dil,seed,intensity:pm,coatIntensity:ci};
  if(hom('E','e')){if(dil&&!brown){s.base='Cream';s.dilution=false}else s.base=brown?'Red':'Fawn';s.nose=brown?'Liver':dil?'Blue':'Black'}
  else{
    const e=top('E'),k=top('K'),a=top('A')||'ay';
    if(e==='Em')s.mask=eu;
    if(k==='br'){s.pattern=pm>.8?'reverse brindle':'brindle';s.secondary=(a==='at'||a==='as')?'Tan':brown?'Red':'Fawn'}
    else if(k==='y'){
      if(e==='eg'){s.pattern='grizzle';s.secondary=brown?'Red':'Tan'}
      else if(a==='ay'){s.base=brown?'Red':'Fawn';if(pm>.55&&/Pit Bull|American Bully/.test(breed)){s.pattern='sable';s.secondary=eu}}   // shaded sable shows in the bully breeds; others carry ay as a clear fawn
      else if(a==='as'){s.pattern='saddle';s.secondary='Tan'}
      else if(a==='at'){s.pattern='tri-color';s.secondary='Tan'}
    }
    if(has('M','M'))s.merle=hom('M','M')?1:.8;
  }
  const wb=WHITE_BASE[sortPair('S',g.S).join('/')]??.1,w=wb+(m.whiteMod||0);
  s.white=w>=.99?1:clamp(w,0,.97);
  if(hom('S','sp')&&s.pattern==='solid')s.pattern='piebald';
  if(hom('M','M'))s.white=Math.max(s.white,.6);
  if(has('T','T')&&s.white>.1)s.ticking=Math.round(clamp((hom('T','T')?.9:.6)*(.5+(m.tickMod??.5)),0,1)*100)/100;
  s.speckling=m.speckMod||0;
  const Lg=g.L||['L','L'],nl=Lg.filter(a=>a==='l').length;s.longCoat=nl===2;
  s.featherLen=m.featherMod??.3;s.featherDen=m.featherDen??.5;s.texture=m.texture??0;
  s.coatLen=Math.round(clamp((nl===2?1:nl===1?.35:0)*s.featherLen,0,1)*100)/100;
  if(g.R&&g.R.includes('R')&&s.white>.1)s.roan=g.R[0]==='R'&&g.R[1]==='R'?.9:.65;
  s.merleMod=m.merleMod??.5;
  const ae=autoEyes(s,brown,dil,seed);
  s.eyes=m.eyes&&m.eyes!=='Auto'?m.eyes:ae[0];
  s.eyes2=m.eyes2&&m.eyes2!=='Auto'?m.eyes2:(m.eyes&&m.eyes!=='Auto'?s.eyes:ae[1]);
  if(s.base==='Black'&&s.dilution&&s.nose==='Auto')s.nose='Blue';
  for(const k of['secondary','paws','ears','tail','nose'])if(ov[k]&&ov[k]!=='Auto')s[k]=ov[k];
  return s;
}
function autoEyes(s,brown,dil,seed){
  const base=(brown||dil)?'Amber':'Brown';
  if(!s.merle)return[base,base];
  const r=(seed*7)%100;
  if(r<30)return['Blue','Blue'];if(r<42)return['Glass','Glass'];if(r<56)return['Blue',base];if(r<64)return[base,'Blue'];
  return[base,base];
}
// ---------- coat spec -> genotype (for typed-in dogs) ----------
function specToGenotype(spec){
  const s={...DEF,...spec},g={B:['B','B'],D:['D','D'],E:['E','E'],K:['K','K'],A:['ay','ay'],S:['S','S'],M:['m','m'],T:['t','t'],L:['L','L'],R:['r','r']};
  if(s.longCoat===true||s.longCoat==='carrier')g.L=s.longCoat===true?['l','l']:['L','l'];else if((s.coatLen||0)>0)g.L=['L','l'];if(s.roan>0)g.R=s.roan>=.8?['R','R']:['R','r'];
  const notes=[];let base=s.base,pat=s.pattern;
  if(['Blue','Lilac','Isabella','Blue fawn','Cream','Dilute red'].includes(base)||s.dilution)g.D=['d','d'];
  if(['Chocolate','Liver','Lilac','Isabella','Red','Dilute red'].includes(base))g.B=['b','b'];
  const ci=base==='Chocolate'||base==='Lilac'?Math.max(.6,s.coatIntensity):base==='Liver'||base==='Isabella'?Math.min(.59,s.coatIntensity):s.coatIntensity;
  const isRed=['Red','Cream','Dilute red'].includes(base),isFawn=['Fawn','Blue fawn','Tan'].includes(base);
  if(pat.includes('brindle')){g.K=['br','br'];if(isRed||isFawn){g.E=['E','E'];if(base==='Red'||base==='Dilute red')g.B=['b','b'];else g.B=['B','B']}}
  else if(pat==='saddle'){g.K=['y','y'];g.A=['as','as']}
  else if(pat==='tri-color'){g.K=['y','y'];g.A=['at','at']}
  else if(pat==='grizzle'){g.K=['y','y'];g.E=['eg','eg'];g.A=['at','at']}
  else if(pat==='sable'){g.K=['y','y'];g.A=['ay','ay']}
  else if(isFawn){g.K=['y','y'];g.A=['ay','ay']}
  else if(isRed){g.E=['e','e']}
  if(isRed&&pat!=='solid'&&pat!=='piebald'&&!pat.includes('brindle'))notes.push('Red (ee) hides dark-pigment patterns');
  if(s.mask!=='None'){if(g.E[0]==='e')notes.push('Red (ee) dogs can’t show a mask');else g.E=sortPair('E',['Em',g.E[1]])}
  if(s.merle>0)g.M=s.merle>=.95?['M','M']:['M','m'];
  let tm=.5;if(s.ticking>0){g.T=s.ticking>=.75?['T','T']:['T','t'];tm=clamp(Math.round((s.ticking/(g.T[1]==='T'?.9:.6)-.5)*100)/100,0,1)}
  let wm=0;
  if(pat==='piebald'){g.S=['sp','sp'];wm=s.white-.5}
  else if(s.white>=.99||base==='White'){g.S=['sw','sw'];wm=.1}
  else{let best='S/S';for(const[k,v]of Object.entries(WHITE_BASE)){if(k==='sp/sp')continue;if(Math.abs(s.white-v)<Math.abs(s.white-WHITE_BASE[best]))best=k}g.S=best.split('/');wm=s.white-WHITE_BASE[best]}
  wm=clamp(Math.round(wm*100)/100,-.2,.2);
  const mm=Math.round(clamp(s.merleMod??.5,0,1)*100)/100;
  const auto=fromGenotype(g,{coatInt:ci,patMod:s.intensity,seed:s.seed,whiteMod:wm,merleMod:mm},s.breed);
  if(s.secondary==='White'){s.secondary='Auto';notes.push('White markings come from the white amount, so secondary color was left automatic')}
  const e2=s.eyes2&&s.eyes2!=='Same'?s.eyes2:s.eyes;
  const sameAsAuto=s.eyes===auto.eyes&&e2===auto.eyes2;
  const m={whiteMod:wm,patMod:clamp(s.intensity,0,1),coatInt:clamp(ci,0,1),eyes:sameAsAuto?'Auto':s.eyes,eyes2:sameAsAuto?'Auto':e2,merleMod:mm,tickMod:tm,speckMod:Math.round(clamp(s.speckling||0,0,1)*100)/100,featherMod:Math.round(clamp(s.featherLen??.3,0,1)*100)/100,featherDen:Math.round(clamp(s.featherDen??.5,0,1)*100)/100,texture:Math.round(clamp(s.texture||0,0,1)*100)/100,seed:s.seed%100000};
  if(pat==='reverse brindle')m.patMod=Math.max(.81,m.patMod);else if(pat==='brindle')m.patMod=Math.min(.8,m.patMod);
  const probe=fromGenotype(g,m,s.breed),ov={};
  if(s.mask!=='None'&&probe.mask!=='None'&&probe.mask!==s.mask)notes.push(`Mask shows as ${probe.mask.toLowerCase()} — a mask is always the dog’s own dark pigment`);
  if(probe.dilution&&probe.mask!=='None'&&DILUTE[probe.mask])notes.push(`Dilution turns the ${probe.mask.toLowerCase()} mask ${DILUTE[probe.mask].toLowerCase()}`);
  if(s.pattern!==probe.pattern&&!notes.length)notes.push(`Genetics turn this into ${probe.pattern}`);
  for(const k of['secondary','paws','ears','tail','nose'])if(s[k]&&s[k]!=='Auto'&&s[k]!==probe[k])ov[k]=s[k];
  return{g,m,ov,notes};
}
// ---------- Genetic ID ----------
const ID_LOCI=['B','D','E','K','A','S','M','T'],ID_LOCI4=[...['B','D','E','K','A','S','M','T'],'L','R'],EYE_LIST=['Auto',...Object.keys(EYES)],OV_KEYS=['secondary','paws','ears','tail','nose'],OV_LIST=['Auto',...Object.keys(COLORS),...Object.keys(NOSES).filter(n=>!COLORS[n])];
const B36='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function check(str){let h=7;for(const c of str)h=(h*31+c.charCodeAt(0))%36;return B36[h]}
function encodeId(breed,g,m,ov={}){
  let n=0n;const push=(v,b)=>{n=(n<<BigInt(b))|BigInt(v)};
  for(const L of ID_LOCI4){const p=sortPair(L,g[L]||[GLOCI[L][L==='L'?0:1],GLOCI[L][L==='L'?0:1]]);for(const a of p)push(Math.max(0,GLOCI[L].indexOf(a)),2)}
  push(clamp(Math.round(((m.whiteMod||0)+.2)*100),0,40),6);push(clamp(Math.round((m.patMod??.5)*100),0,100),7);push(clamp(Math.round((m.coatInt??.5)*100),0,100),7);
  push(Math.max(0,EYE_LIST.indexOf(m.eyes||'Auto')),4);push(Math.max(0,EYE_LIST.indexOf(m.eyes2||'Auto')),4);push(clamp(Math.round((m.merleMod??.5)*100),0,100),7);push(clamp(Math.round((m.tickMod??.5)*100),0,100),7);push(clamp(Math.round((m.speckMod||0)*100),0,100),7);push(clamp(Math.round((m.featherMod??.3)*100),0,100),7);push(clamp(Math.round((m.featherDen??.5)*100),0,100),7);push(clamp(Math.round((m.texture||0)*100),0,100),7);push((m.seed||0)%131072,17);
  const body=n.toString(36).toUpperCase().padStart(25,'0'),code=tpl(breed).code||'X';
  const cos=OV_KEYS.map(k=>B36[Math.max(0,OV_LIST.indexOf(ov[k]||'Auto'))]).join('');
  const core=`${code}-${body.slice(0,5)}-${body.slice(5,10)}-${body.slice(10,15)}-${body.slice(15,20)}-${body.slice(20)}`;
  return core+check(core)+(/[^0]/.test(cos)?'~'+cos:'');
}
function decodeId(id){
  id=String(id).trim().toUpperCase();const[main,cos]=id.split('~');const parts=main.split('-');if(parts.length<4)throw new Error('That doesn’t look like a genetic ID.');
  const code=parts[0],last=parts[parts.length-1],chk=last.slice(-1),core=parts.slice(0,-1).join('-')+'-'+last.slice(0,-1);
  if(check(core)!==chk)throw new Error('Genetic ID checksum failed — check for a typo.');
  const breed=Object.keys(TEMPLATES).find(b=>TEMPLATES[b].code===code);if(!breed)throw new Error(`Unknown breed code ${code}.`);
  const digits=parts.slice(1,-1).join('')+last.slice(0,-1),v2=digits.length>=17,v3=digits.length>=19,v4=digits.length>=25;
  let n=0n;for(const c of digits)n=n*36n+BigInt(B36.indexOf(c));
  const pop=b=>{const v=Number(n&((1n<<BigInt(b))-1n));n>>=BigInt(b);return v};
  const seed=pop(17);let merleMod=.5,eyes2='Auto',eyes,tickMod=.5,speckMod=0;
  let featherMod=.3,featherDen=.5,texture=0;if(v4){texture=pop(7)/100;featherDen=pop(7)/100;featherMod=pop(7)/100}
  if(v3){speckMod=pop(7)/100;tickMod=pop(7)/100}
  if(v2){merleMod=pop(7)/100;eyes2=EYE_LIST[pop(4)]||'Auto';eyes=EYE_LIST[pop(4)]||'Auto'}else eyes=EYE_LIST[pop(3)]||'Auto';
  const coatInt=pop(7)/100,patMod=pop(7)/100,whiteMod=pop(6)/100-.2;
  const g={};for(const L of (v4?ID_LOCI4:ID_LOCI).slice().reverse()){const b2=pop(2),a2=pop(2);g[L]=[GLOCI[L][a2],GLOCI[L][b2]]}
  if(!g.L)g.L=['L','L'];if(!g.R)g.R=['r','r'];
  const ov={};if(cos)OV_KEYS.forEach((k,i)=>{const v=OV_LIST[B36.indexOf(cos[i])];if(v&&v!=='Auto')ov[k]=v});
  return{breed,g,m:{whiteMod:Math.round(whiteMod*100)/100,patMod,coatInt,eyes,eyes2,merleMod,tickMod,speckMod,featherMod,featherDen,texture,seed},ov};
}
function randomGenotype(breed){const f=tpl(breed).freq||{},g={};
  for(const L of ID_LOCI4){const fr={...BASE_FREQ[L],...(f[L]||{})};const pa=()=>{let r=Math.random()*Object.values(fr).reduce((a,b)=>a+b,0),acc=0;for(const[a,p]of Object.entries(fr)){acc+=p;if(r<acc)return a}return GLOCI[L][0]};g[L]=sortPair(L,[pa(),pa()])}
  return g}

// ---------- names & rarity ----------
function resolve(spec){
  const s={...DEF,...spec},col=n=>s.dilution&&DILUTE[n]?DILUTE[n]:n,base=col(s.base);
  let sec=s.secondary;
  if(sec==='Auto')sec=(s.pattern==='saddle'||s.pattern==='tri-color'||s.pattern==='grizzle')?'Tan':s.pattern.includes('brindle')?(['Red','Fawn','Cream','Dilute red'].includes(base)?'Cream':'Fawn'):'Fawn';
  sec=sec==='Tan'?'Tan':col(sec);   // d/d dilutes black pigment; tan points stay tan
  let nose=s.nose;if(nose==='Auto')nose=['Blue','Blue fawn'].includes(base)?'Blue':['Lilac','Isabella'].includes(base)?'Isabella':['Chocolate','Liver','Red','Dilute red'].includes(base)?'Liver':'Black';
  const mask=s.mask==='None'?null:col(s.mask),C=n=>hexC(COLORS[n]||NOSES[n]||COLORS.Black);
  return{...s,baseName:base,secName:sec,noseName:nose,baseC:C(base),secC:C(sec),maskC:mask?C(mask):null,eyeC:hexC(EYES[s.eyes]||EYES.Brown),noseC:hexC(NOSES[nose]||NOSES.Black),
    pawC:s.paws!=='Auto'?C(col(s.paws)):null,earC:s.ears!=='Auto'?C(col(s.ears)):null,tailC:s.tail!=='Auto'?C(col(s.tail)):null};
}
function describe(s){
  const r=resolve(s),lc=t=>t.toLowerCase();
  const mm=s.merleMod??.5;let n=r.baseName;if(n==='Fawn'&&!s.merle&&(s.coatIntensity??.5)>=.8)n='Red';   // deep fawn reads as red
  if(s.merle>0){const dil=['Blue','Lilac','Isabella','Blue fawn','Dilute red'].includes(r.baseName),red=['Chocolate','Liver','Lilac','Isabella'].includes(r.baseName);
    n=mm<.2?(red?'Dark red merle':'Black merle'):mm>.85?(red?'Light red merle':'Silver merle'):dil&&!red?'Gray merle':red?'Red merle':'Blue merle';
    if(!['Black','Blue','Chocolate','Liver','Lilac','Isabella'].includes(r.baseName)&&s.pattern==='solid')n='Merle '+lc(r.baseName);
    if(mm>=.2&&mm<.38)n+=' (heavy spotting)';else if(mm>.66&&mm<=.85)n+=' (light spotting)'}
  if(s.pattern==='brindle')n+=' brindle'+(r.secName!=='Fawn'?' on '+lc(r.secName):'');
  if(s.pattern==='reverse brindle')n='Reverse '+lc(n)+' brindle';
  if(s.pattern==='tri-color')n+=s.white<.08&&!s.merle?' and '+lc(r.secName):', '+(r.secName==='Tan'&&s.merle?'copper':lc(r.secName))+' points';
  if(s.pattern==='saddle')n+=' saddle on '+lc(r.secName);
  if(s.pattern==='grizzle')n='Grizzle ('+lc(n)+' over '+lc(r.secName)+')';
  if(s.pattern==='sable')n=(s.intensity??.5)>=.9?'Seal':(n==='Red'?'Red sable':n==='Fawn'?'Sable':n+' sable');
  if(n==='Dilute red')n='Champagne';
  if(s.white>=.98)n='White';else if(s.white>=.85&&s.pattern!=='piebald'&&!s.merle)n='White with '+lc(n)+' patches';else if(s.pattern==='piebald')n='Piebald '+lc(n)+' and white';
  else if(s.white>=.3)n+=(s.pattern==='tri-color'?' and white':' and white');else if(s.white>=.08)n+=' with white markings';
  if(s.ticking>.1&&s.white>.1){
    if(s.ticking>=.97&&r.baseName==='Black')n='Blue ticked '+lc(n);
    else if(['Red','Fawn','Dilute red'].includes(r.baseName)&&!s.merle&&s.pattern==='solid'&&n.startsWith(r.baseName))n=r.baseName+' ticked'+n.slice(r.baseName.length);
    else n+=s.ticking>=.8?', heavily ticked':s.ticking<.5?', lightly ticked':', ticked'}
  if((s.speckling||0)>.15&&s.white>.1)n+=', speckled';
  if((s.roan||0)>0)n+=', roan';
  const mName=s.mask!=='None'?(s.dilution&&DILUTE[s.mask]?DILUTE[s.mask]:s.mask):null;
  if(mName&&s.white<.98&&!(s.pattern==='solid'&&!s.merle&&r.baseName===mName))n+=', '+lc(mName)+' mask';
  return n;
}
function rarity(c){let p=0;const b=resolve(c).baseName;
  if(['Lilac','Isabella'].includes(b))p+=3;else if(['Blue','Chocolate','Liver','Cream','Dilute red','Blue fawn'].includes(b))p+=1;
  if(c.merle>=1)p+=4;else if(c.merle>0)p+=2;
  if(c.pattern==='brindle')p+=1;if(c.pattern==='reverse brindle'||c.pattern==='grizzle')p+=2;if(c.pattern==='tri-color'||c.pattern==='saddle')p+=1;
  if(c.ticking>0)p+=1;if(c.ticking>=.97)p+=1;if((c.roan||0)>0)p+=1;if((c.speckling||0)>.5)p+=1;if(c.white>=.99)p+=1;if(c.eyes==='Glass'||c.eyes2==='Glass'||c.eyes!==c.eyes2)p+=1;if(c.merle&&((c.merleMod??.5)<.2||(c.merleMod??.5)>.85))p+=1;return p}

// ---------- text spec ----------
const KEYMAP={breed:'breed',base:'base',basecolor:'base',color:'base',coat:'base',secondary:'secondary',secondarycolor:'secondary',pattern:'pattern',intensity:'intensity',patternintensity:'intensity',
 coatintensity:'coatIntensity',coatlength:'coatlength',coat_length:'coatlength',hair:'coatlength',feathering:'featherLen',featheringlength:'featherLen',featherlength:'featherLen',featheringdensity:'featherDen',featherdensity:'featherDen',texture:'texture',coattexture:'texture',roan:'roan',roaning:'roan',tanpointintensity:'intensity',tanpoints:'tanpoints',tan:'tanpoints',blacksaddle:'saddle',speckling:'speckling',speckles:'speckling',speckle:'speckling',freckles:'speckling',white:'white',whiteamount:'white',whitemarkings:'white',mask:'mask',facialmask:'mask',dilute:'dilution',dilution:'dilution',merle:'merle',ticking:'ticking',ticked:'ticking',
 eyes:'eyes',eye:'eyes',eyecolor:'eyes',eye2:'eyes2',secondeye:'eyes2',righteye:'eyes2',fareye:'eyes2',lefteye:'eyes',spotting:'spotting',merlestyle:'spotting',nose:'nose',nosecolor:'nose',paws:'paws',pawcolor:'paws',ears:'ears',earcolor:'ears',tail:'tail',tailcolor:'tail',seed:'seed',saddle:'saddle'};
const ci=(list,v)=>list.find(x=>x.toLowerCase()===String(v).toLowerCase().trim());
function num(v){const t=String(v).trim().toLowerCase();if(['yes','true','on'].includes(t))return 1;if(['no','false','off','none'].includes(t))return 0;const n=parseFloat(t);if(isNaN(n))return null;return t.includes('%')||n>1?n/100:n}
function parseText(text,cur={}){
  const spec={},errs=[];let breed=null;const colors=Object.keys(COLORS);
  for(const raw of text.split(/\n|;/)){const mm=raw.match(/^\s*([^:=]+)[:=]\s*(.+?)\s*$/);if(!mm)continue;
    const k=KEYMAP[mm[1].toLowerCase().replace(/[\s_-]/g,'')],v=mm[2];
    if(!k){errs.push(`Unknown key “${mm[1].trim()}”`);continue}
    if(k==='breed'){breed=ci(Object.keys(TEMPLATES),v)||Object.keys(TEMPLATES).find(b=>(TEMPLATES[b].aliases||[]).some(a=>a.toLowerCase()===v.toLowerCase().trim()));if(!breed)errs.push(`No template for “${v}” yet — available: ${Object.keys(TEMPLATES).join(', ')}`);continue}
    if(k==='base'||k==='secondary'){const c=ci(colors,v);if(c)spec[k]=c;else if(/brown/i.test(v))spec[k]='Chocolate';else errs.push(`Unknown color “${v}”. Try: ${colors.join(', ')}`);continue}
    if(k==='pattern'){const t=v.toLowerCase().replace(/[-_]/g,' ').replace(/tri ?colou?r|black and tan/,'tri-color');
      if(ci(PATTERNS,t))spec.pattern=ci(PATTERNS,t);
      else if(/blue brindle/.test(t)){spec.pattern='brindle';spec.base='Blue'}
      else if(/red brindle/.test(t)){spec.pattern='brindle';spec.base='Red'}
      else if(/merle|leopard|spott/.test(t)){spec.merle=spec.merle||.8;
        if(/silver/.test(t))spec.merleMod=.9;else if(/black merle/.test(t))spec.merleMod=.1;else if(/heavy/.test(t))spec.merleMod=.28;else if(/light/.test(t))spec.merleMod=.75;else if(/leopard/.test(t))spec.merleMod=.45;
        if(/red merle/.test(t)&&!spec.base)spec.base='Liver';if(/blue merle/.test(t)&&!spec.base)spec.base='Black';if(/gr[ae]y merle/.test(t)){spec.dilution=true;if(!spec.base)spec.base='Black'}}
      else if(/copper|tan points|points/.test(t))spec.pattern='tri-color';
      else if(/tick/.test(t)){spec.ticking=/heav/.test(t)?.95:/light/.test(t)?.45:/blue/.test(t)?1:.8;if(spec.white==null)spec.white=.55;
        if(/blue/.test(t)&&!spec.base)spec.base='Black';if(/red/.test(t)&&!spec.base)spec.base='Red';if(/black/.test(t)&&!spec.base)spec.base='Black'}
      else if(/speck|freckl/.test(t)){spec.speckling=/heav/.test(t)?.9:/light/.test(t)?.35:.65}
      else if(/mask/.test(t))spec.mask=spec.mask||'Black';
      else if(/grizzle/.test(t))spec.pattern='grizzle';
      else errs.push(`Unknown pattern “${v}”. Try: ${PATTERNS.join(', ')}, merle, ticked, masked`);continue}
    if(k==='saddle'){if(num(v)){spec.pattern='saddle';if(!spec.base)spec.base='Black'}continue}
    if(k==='coatlength'){const t=v.toLowerCase();spec.longCoat=/long|feather/.test(t)?true:/carrier|medium/.test(t)?'carrier':false;continue}
    if(k==='texture'){const t=v.toLowerCase();const n=num(v);spec.texture=/straight|smooth|flat/.test(t)?.1:/silk/.test(t)?.4:/wav/.test(t)?.65:/curl/.test(t)?.95:n===null?.4:clamp(n,0,1);continue}
    if(k==='featherLen'||k==='featherDen'){const t=v.toLowerCase();const n=num(v);spec[k]=/none|no/.test(t)?0:/light|short|thin|sparse/.test(t)?.3:/heavy|long|thick|dense|full/.test(t)?.95:/medium|moderate/.test(t)?.6:n===null?.6:clamp(n,0,1);if(k==='featherLen'&&spec[k]>0&&spec.longCoat==null)spec.longCoat=true;continue}
    if(k==='roan'){const t=v.toLowerCase();const n=num(v);spec.roan=/heavy/.test(t)?.9:/^(yes|true|on)$/.test(t.trim())?.65:n===null?0:clamp(n,0,1);continue}
    if(k==='tanpoints'){if(num(v)&&spec.pattern!=='saddle')spec.pattern='tri-color';continue}
    if(k==='speckling'){const t=v.toLowerCase();const n=num(v);spec.speckling=/heav/.test(t)?.9:/light/.test(t)?.35:/^(yes|true|on)$/.test(t.trim())?.65:n===null?0:clamp(n,0,1);continue}
    if(['mask','paws','ears','tail'].includes(k)){if(/^(none|no|auto)$/i.test(v)){spec[k]=k==='mask'?'None':'Auto';continue}const c=ci(colors,v);if(c)spec[k]=c;else errs.push(`Unknown ${k} color “${v}”`);continue}
    if(k==='eyes'||k==='eyes2'){const parts=v.split(/\s*(?:\/|,|&|\band\b)\s*/i).filter(Boolean);
      if(/mismatch|odd|hetero/i.test(v)){spec.eyes='Blue';spec.eyes2='Brown';continue}
      const cs=parts.map(x=>ci(Object.keys(EYES),x.replace(/glass(y)?|cracked/i,'Glass')));
      if(cs.some(c=>!c)){errs.push(`Unknown eye color “${v}”. Try: ${Object.keys(EYES).join(', ')}, or two like Blue / Brown`);continue}
      if(k==='eyes2')spec.eyes2=cs[0];else{spec.eyes=cs[0];spec.eyes2=cs[1]||cs[0]}continue}
    if(k==='spotting'){const t=v.toLowerCase();spec.merle=spec.merle||.8;spec.merleMod=/silver/.test(t)?.9:/black/.test(t)?.1:/heavy/.test(t)?.28:/light/.test(t)?.75:.45;continue}
    if(k==='nose'){const c=ci(Object.keys(NOSES),v)||(/^auto$/i.test(v)?'Auto':null);if(c)spec.nose=c;else errs.push(`Unknown nose color “${v}”`);continue}
    if(k==='dilution'){spec.dilution=!!num(v)||/^(dilute|diluted|d\/d|dd)$/i.test(v.trim());continue}
    if(k==='seed'){spec.seed=parseInt(v)||1;continue}
    const n=num(v);if(n===null)errs.push(`“${mm[1].trim()}” needs a number or %`);else spec[k]=(k==='merle'&&/^(yes|true|on)$/i.test(v.trim()))?.8:clamp(n,0,1);
  }
  const bd=breed||cur.breed||DEF.breed,sdf=(breed&&breed!==cur.breed&&TEMPLATES[breed]&&TEMPLATES[breed].specDefaults)||{};
  return{spec:{...DEF,...cur,...sdf,...spec,breed:bd},errs};
}
function specToText(s){const L=[`Breed: ${s.breed}`,`Base Color: ${s.base}`];
  if(s.secondary!=='Auto')L.push(`Secondary: ${s.secondary}`);L.push(`Pattern: ${s.pattern.charAt(0).toUpperCase()+s.pattern.slice(1)}`);
  if(s.pattern!=='solid')L.push(`Pattern Intensity: ${Math.round(s.intensity*100)}%`);if(Math.abs(s.coatIntensity-.5)>.01)L.push(`Coat Intensity: ${Math.round(s.coatIntensity*100)}%`);
  L.push(`White Amount: ${Math.round(s.white*100)}%`);L.push(`Mask: ${s.mask}`);if(s.merle>0)L.push(`Merle: ${Math.round(s.merle*100)}%`);
  if(s.ticking>0)L.push(`Ticking: ${Math.round(s.ticking*100)}%`);if((s.speckling||0)>0)L.push(`Speckling: ${Math.round(s.speckling*100)}%`);
  if(s.merle>0)L.push(`Spotting: ${s.merleMod<.2?'Black merle':s.merleMod<.38?'Heavy':s.merleMod>.85?'Silver':s.merleMod>.66?'Light':'Leopard'}`);
  if(s.longCoat||s.coatLen>0)L.push(`Coat Length: ${s.longCoat?'Long':'Carrier'}`,`Feathering: ${Math.round(s.featherLen*100)}%`,`Feathering Density: ${Math.round(s.featherDen*100)}%`,`Coat Texture: ${s.texture<.25?'Straight':s.texture<.5?'Silky':s.texture<.8?'Wavy':'Curly'}`);
  if(s.roan>0)L.push(`Roan: ${Math.round(s.roan*100)}%`);
  L.push(`Eyes: ${s.eyes}${s.eyes2&&s.eyes2!==s.eyes?' / '+s.eyes2:''}`);L.push(`Dilution: ${s.dilution?'Dilute':'None'}`);if(s.nose!=='Auto')L.push(`Nose: ${s.nose}`);for(const k of['paws','ears','tail'])if(s[k]!=='Auto')L.push(`${k.charAt(0).toUpperCase()+k.slice(1)}: ${s[k]}`);
  L.push(`Seed: ${s.seed}`);return L.join('\n')}

// ---------- rendering ----------
function h2(ix,iy,s){let h=Math.imul(ix,374761393)^Math.imul(iy,668265263)^Math.imul(s,982451653);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function vn(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=h2(ix,iy,s),b=h2(ix+1,iy,s),c=h2(ix,iy+1,s),d=h2(ix+1,iy+1,s),ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy}
function fbm(x,y,s,o){let v=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){v+=a*vn(x*f,y*f,s+i*101);n+=a;f*=2.03;a*=.5}return v/n}
const css=(a,b,x)=>ss(a,b,x);
const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const MAPS={};
async function maps(body,scale){try{return await maps0(body,scale)}catch(e){const B=BODIES[body];if(B)B.imgs=null;throw e}}
async function maps0(body,scale){
  const key=body+'@'+scale;if(MAPS[key])return MAPS[key];
  const B=BODIES[body];if(!B.imgs)B.imgs=await Promise.all([loadImg(B.maps.m1),loadImg(B.maps.m2),loadImg(B.maps.m3)]);
  const w=Math.round(B.w*scale),h=Math.round(B.h*scale);
  const rd=(img,sm)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=sm;x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);return x.getImageData(0,0,w,h).data};
  const out={w,h,m1:rd(B.imgs[0],true),m2:rd(B.imgs[1],false),m3:rd(B.imgs[2],true)};
  // Murda Worth: phones run out of memory holding every breed's full-size masters, so let the
  // decoded pictures go (the browser cache has the files) and keep only the last few maps.
  B.imgs=null;const ks=Object.keys(MAPS);while(ks.length>=6)delete MAPS[ks.shift()];
  return MAPS[key]=out;
}
const LAYERS={shading:'Shading',ink:'Outlines',base:'Base coat',secondary:'Secondary color',brindle:'Brindle',merle:'Merle',white:'White markings',piebald:'Piebald',ticking:'Ticking',saddle:'Saddle',tan:'Tan points',grizzle:'Grizzle',mask:'Facial mask',intensity:'Coat intensity',eyes:'Eye color',nose:'Nose color',paws:'Paw color',ears:'Ear color',tail:'Tail color',feather:'Feathering',roan:'Roaning'};
const ALL_ON=Object.fromEntries(Object.keys(LAYERS).map(k=>[k,true]));
async function render(spec,scale=.5,opt={}){
  const view=opt.view||'final',L=opt.layers||ALL_ON,body=tpl(spec.breed).body;
  const r=resolve(spec),M0=opt.maps||await maps(body,scale),M=L.feather===false?M0:featherize(M0,spec,scale),{w,h,m1,m2,m3}=M,N=w*h,inv=1/scale,sd=(spec.seed|0)||1;
  let wT=spec.white;
  if(opt.maps&&spec.white>0&&spec.white<.985){const hist=new Uint32Array(256);let cnt=0;for(let i=0;i<N;i++){if(m3[i*4]<128)continue;const rg=Math.round(m2[i*4]/20);if(rg===5||rg===6||rg===9||rg===10)continue;hist[m1[i*4+2]]++;cnt++}
    let acc=0;const tg=spec.white*cnt;for(let b=0;b<256;b++){acc+=hist[b];if(acc>=tg){wT=(b+1)/255;break}}}
  const out=new ImageData(w,h),o=out.data,WH=hexC(COLORS.White),INK=[.07,.06,.055],REG={EYE:5,NOSE:6,PAWS:7,EARS:4,TAIL:8,HEAD:2,MUZZLE:3};
  let pie=null,pieT=0;
  if(spec.pattern==='piebald'&&L.piebald&&spec.white>0&&spec.white<.98){pie=new Float32Array(N);const hist=new Uint32Array(512);let cnt=0;
    for(let i=0;i<N;i++){if(m3[i*4]<128)continue;const rg=Math.round(m2[i*4]/20);if(rg===5||rg===6||rg===9||rg===10)continue;
      const x=(i%w)*inv,y=((i/w)|0)*inv,v=.35*m1[i*4+2]/255+.65*fbm(x*.0035,y*.0035,sd+7,4);pie[i]=v;hist[Math.min(511,v*512|0)]++;cnt++}
    let acc=0;const tg=spec.white*cnt;for(let b=0;b<512;b++){acc+=hist[b];if(acc>=tg){pieT=(b+1)/512;break}}}
  const regCol=[0,[.55,.55,.55],[.3,.65,.35],[.8,.35,.35],[.35,.35,.85],[1,1,0],[1,0,1],[0,.8,.8],[1,.6,0],[1,.5,.65],[1,1,1]];
  let ciK=(spec.coatIntensity??.5)*2-1;const tanB=body==='pit_bull_terrier_stack_v1'||body==='apbt_stack_v1'?.16:0;
  // red and yellow coats (ee reds, fawns, sables) run from pale lemon through tan and fawn to deep red as the coat gets
  // richer, the way phaeomelanin does, rather than just a darker, muddier fawn
  if(r.baseName==='Fawn'){const ci=clamp(spec.coatIntensity??.5,0,1),P=[[0,'#efdcb0'],[.25,'#e2bf80'],[.5,'#c98b48'],[.62,'#c0773a'],[.75,'#b25a26'],[.9,'#9a3c17'],[1,'#7e2e10']];
    let k=1;while(k<P.length-1&&ci>P[k][0])k++;const[x0,h0]=P[k-1],[x1,h1]=P[k],t=clamp((ci-x0)/(x1-x0),0,1),A=hexC(h0),B=hexC(h1);r.baseC=[0,1,2].map(i=>A[i]+(B[i]-A[i])*t);ciK=0}
  for(let i=0;i<N;i++){
    const p=i*4,al=m3[p];if(al===0){o[p+3]=0;continue}
    const S=m1[p]/255*1.6,ink=m1[p+1]/255,wr=m1[p+2]/255,rg=Math.round(m2[p]/20),sad=m2[p+1]/255,tan=m2[p+2]/255,mk=m3[p+1]/255,x=(i%w)*inv,y=((i/w)|0)*inv;
    if(view==='shade'){const g=clamp(S/1.6,0,1)*255;o[p]=o[p+1]=o[p+2]=g;o[p+3]=al;continue}
    if(view==='ink'){const g=255*(1-ink);o[p]=o[p+1]=o[p+2]=g;o[p+3]=al;continue}
    if(view==='white'){const on=pie?pie[i]<pieT:wr<wT;const g=on?250:50+wr*70;o[p]=g;o[p+1]=g*.92;o[p+2]=g*.82;o[p+3]=al;continue}
    if(view==='regions'){const c=regCol[rg]||[.5,.5,.5];o[p]=clamp(c[0]*.7+sad*.35,0,1)*255;o[p+1]=clamp(c[1]*.7+mk*.3,0,1)*255;o[p+2]=clamp(c[2]*.7+tan*.35,0,1)*255;o[p+3]=al;continue}
    let c0,c1,c2;
    if(rg===REG.EYE&&L.eyes){[c0,c1,c2]=r.eyeC;if(spec.eyes==='Glass'){const t=ss(.45,.55,fbm(x*.35,y*.35,sd+41,3));const br=hexC(EYES.Brown);c0=br[0]+(c0-br[0])*t;c1=br[1]+(c1-br[1])*t;c2=br[2]+(c2-br[2])*t}}else if(rg===REG.NOSE&&L.nose)[c0,c1,c2]=r.noseC;
    else if(rg===9){c0=.74;c1=.32;c2=.38}else if(rg===10){c0=.93;c1=.9;c2=.82}   // an open mouth: tongue and gums stay pink, teeth ivory, on every coat
    else{
      const[b0,b1,b2]=L.base?r.baseC:[.55,.55,.55],[s0,s1,s2]=L.secondary?r.secC:[b0,b1,b2],pat=spec.pattern,it=spec.intensity;c0=b0;c1=b1;c2=b2;
      if(pat==='saddle'&&L.saddle){const t=ss(.62-it*.45,.7-it*.45,sad);c0=s0+(b0-s0)*t;c1=s1+(b1-s1)*t;c2=s2+(b2-s2)*t}
      else if(pat==='tri-color'&&L.tan){const th=.62-it*.35-tanB,t=Math.max(ss(th-.06,th+.06,tan),tanB&&rg===REG.MUZZLE?.9:0);c0+=(s0-c0)*t;c1+=(s1-c1)*t;c2+=(s2-c2)*t}
      else if(pat==='sable'&&L.saddle){const k=clamp((it-.55)/.45,0,1),h=cvnHair(x,y,sd),reach=Math.max(ss(.72-k*.7,.98-k*.55,sad+.22*k),clamp((k-.75)*6,0,1)*.9),t=Math.max(clamp(reach*(.5+.5*h)*(.45+.55*k),0,.95),clamp((k-.75)*6,0,1)*(.76+.2*h)*ss(.05,.35,sad+.25));c0+=(s0-c0)*t;c1+=(s1-c1)*t;c2+=(s2-c2)*t}
      else if(pat==='grizzle'&&L.grizzle){const dens=clamp(sad*.9+.28-tan*.75,0,1)*(.6+it*.6),hair=cvnHair(x,y,sd),g=ss(.72-dens*.55,.84-dens*.55,hair)*.9;c0=s0+(b0-s0)*g;c1=s1+(b1-s1)*g;c2=s2+(b2-s2)*g}
      else if((pat==='brindle'||pat==='reverse brindle')&&L.brindle){
        const xw=x+(fbm(x*.004,y*.004,sd,3)-.5)*90+y*.18,st=fbm(xw*.075,y*.011,sd+5,4)*.8+vn(xw*.22,y*.03,sd+6)*.2;
        const thr=pat==='reverse brindle'?.5-(it-.8)*1.1:.66-it*.24,t=ss(thr-.07,thr+.07,st)*.92;
        c0=s0+(b0-s0)*t;c1=s1+(b1-s1)*t;c2=s2+(b2-s2)*t}
      if(spec.merle>0&&L.merle){const mm=spec.merleMod??.5,keep=merleKeep(x,y,sd,mm),dark=1-(c0*.3+c1*.59+c2*.11),amt=spec.merle*(.62+mm*.25)*clamp(dark*1.4,0,1)*(1-keep);
        const l0=.6*(c0+(1-c0)*(.5+mm*.15))+.4*.8,l1=.6*(c1+(1-c1)*(.5+mm*.15))+.4*.82,l2=.6*(c2+(1-c2)*(.5+mm*.15))+.4*.85;c0+=(l0-c0)*amt;c1+=(l1-c1)*amt;c2+=(l2-c2)*amt}
      if(r.maskC&&L.mask&&mk>0){const t=mk*.92;c0+=(r.maskC[0]-c0)*t;c1+=(r.maskC[1]-c1)*t;c2+=(r.maskC[2]-c2)*t}
      if(L.intensity&&ciK!==0){if(ciK<0){const k=-ciK*.55;c0+=(.93-c0)*k;c1+=(.9-c1)*k;c2+=(.84-c2)*k}else{const k=1-ciK*.35;c0*=k;c1*=k;c2*=k}}
      let wv=0;if(L.white){if(spec.white>=.985)wv=1;else if(pie)wv=1-ss(pieT-.006,pieT+.006,pie[i]);else if(spec.white>0)wv=1-ss(wT-.012,wT+.012,wr)}
      const ov=rg===REG.PAWS&&L.paws?r.pawC:rg===REG.EARS&&L.ears?r.earC:rg===REG.TAIL&&L.tail?r.tailC:null;
      if(wv>0){c0+=(WH[0]-c0)*wv;c1+=(WH[1]-c1)*wv;c2+=(WH[2]-c2)*wv;
        let tk0=r.baseC[0],tk1=r.baseC[1],tk2=r.baseC[2];
        if(pat==='tri-color'||pat==='saddle'){const tw=pat==='tri-color'?css(.56-it*.35-tanB,.68-it*.35-tanB,tan):spec.ticking>0?css(.45,.6,tan)*(rg===REG.HEAD||rg===REG.MUZZLE?1:ss(560,660,y)):1-css(.62-it*.45,.7-it*.45,sad);tk0+=(s0-tk0)*tw;tk1+=(s1-tk1)*tw;tk2+=(s2-tk2)*tw}
        if(spec.ticking>0&&L.ticking&&wv>.5){
          for(let q=0;q<2;q++){const cs=q?11:8,ox=q?5.5:0,cx=Math.floor((x+ox)/cs),cy=Math.floor((y+ox)/cs),sq=sd+21+q*9;
            if(h2(cx,cy,sq)<spec.ticking*(q?.28:.34)){const px=(cx+h2(cx,cy,sq+1))*cs-ox,py=(cy+h2(cx,cy,sq+2))*cs-ox,rad=1.1+h2(cx,cy,sq+3)*(q?2.6:1.6),
              t=(1-ss(rad-.7,rad+.7,Math.hypot((x-px)*1.25,y-py)))*(.75+.25*h2(cx,cy,sq+4));c0+=(tk0-c0)*t;c1+=(tk1-c1)*t;c2+=(tk2-c2)*t}}
          const ro=(.1*spec.ticking+.3*spec.ticking*spec.ticking*spec.ticking)*wv;c0+=(tk0-c0)*ro;c1+=(tk1-c1)*ro;c2+=(tk2-c2)*ro}
        if((spec.roan||0)>0&&L.roan&&wv>.3){const t=clamp(spec.roan*(.42+.5*vn(x*.3,y*.22,sd+91))+(h2(Math.floor(x/4),Math.floor(y/4),sd+92)<spec.roan*.25?.3:0),0,.92)*wv;c0+=(tk0-c0)*t;c1+=(tk1-c1)*t;c2+=(tk2-c2)*t}
        if((spec.speckling||0)>0&&L.ticking&&wv>.5){const cs=17,cx=Math.floor(x/cs),cy=Math.floor(y/cs),wgt=.35+.65*clamp(tan*1.3+(rg===REG.MUZZLE?.6:0),0,1);
          if(h2(cx,cy,sd+71)<spec.speckling*.6*wgt){const px=(cx+.15+h2(cx,cy,sd+72)*.7)*cs,py=(cy+.15+h2(cx,cy,sd+73)*.7)*cs,rad=1.8+h2(cx,cy,sd+74)*2.8,
            d=Math.min(Math.hypot(x-px,y-py),Math.hypot(x-px-rad*.9,y-py+rad*.4)*1.15),t=(1-ss(rad-.9,rad+.9,d))*.9;
            const fc=(pat==='tri-color'||pat==='saddle'||pat==='grizzle')?r.secC:(['Red','Fawn','Cream','Dilute red','Blue fawn'].includes(r.baseName)?r.baseC:hexC(COLORS.Tan));
            c0+=(fc[0]-c0)*t;c1+=(fc[1]-c1)*t;c2+=(fc[2]-c2)*t}}
      }
      if(ov){c0=ov[0];c1=ov[1];c2=ov[2]}
    }
    let rr=c0,gg=c1,bb=c2;
    if(view!=='coat'&&L.shading){const hi=Math.max(0,S-1)*.55;rr=c0*S+(1-c0)*hi;gg=c1*S+(1-c1)*hi;bb=c2*S+(1-c2)*hi}
    if(L.ink){const k=ink*.96;rr=rr*(1-k)+INK[0]*k;gg=gg*(1-k)+INK[1]*k;bb=bb*(1-k)+INK[2]*k}
    o[p]=clamp(rr,0,1)*255;o[p+1]=clamp(gg,0,1)*255;o[p+2]=clamp(bb,0,1)*255;o[p+3]=al;
  }
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(out,0,0);return c;
}
function merleKeep(x,y,sd,mm){
  const t0=.6+mm*.18;let k=ss(t0,t0+.03,fbm(x*.0055,y*.0055,sd+11,3)+.06*vn(x*.05,y*.05,sd+14));
  const wob=(vn(x*.07,y*.07,sd+15)-.5)*7;
  let cs=62,cx=Math.floor(x/cs),cy=Math.floor(y/cs);const pS=.78-mm*.5,rs=1.25-mm*.55;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=cx+i,b=cy+j;if(ch(a,b,sd+51)>pS)continue;
    const px=(a+ch(a,b,sd+52))*cs,py=(b+ch(a,b,sd+53))*cs,r=(7+ch(a,b,sd+54)*24)*rs,dx=(x-px)*(.8+ch(a,b,sd+55)*.4),dy=y-py,d=Math.sqrt(dx*dx+dy*dy)+wob;
    if(d<r+3)k=Math.max(k,1-ss(r-2.5,r+2.5,d))}
  cs=15;cx=Math.floor(x/cs);cy=Math.floor(y/cs);const pT=.3-mm*.18;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=cx+i,b=cy+j;if(ch(a,b,sd+61)>pT)continue;
    const px=(a+ch(a,b,sd+62))*cs,py=(b+ch(a,b,sd+63))*cs,r=1.4+ch(a,b,sd+64)*2.6,d=Math.hypot(x-px,y-py);if(d<r+1.5)k=Math.max(k,1-ss(r-1,r+1,d))}
  return k;
}
function ch(a,b,s){return h2(a,b,s)}
// ---------- BREED MORPHING: assemble a dog from parts of several master bodies ----------
const RIGS={
  apbt_stack_v1:{neck:[[390,120],[320,290]],tail:[[1185,392],[1250,445]],front:[600,360,640],hind:[660,1000,1500]},
  // the cur master once had a stray third hind leg (removed from the art); hindSeg keeps the hind span it was rigged with so mixes are unchanged
  cur_stack_v1:{neck:[[470,110],[300,285]],tail:[[1200,360],[1260,410]],front:[600,340,660],hind:[650,980,1520],hindSeg:[[990,650],[1326,650]]},
  bulldog_stack_v1:{neck:[[450,90],[300,300]],tail:[[1180,320],[1250,380]],front:[600,300,660],hind:[640,940,1440]},
  catahoula_stack_v1:{neck:[[490,140],[300,270]],tail:[[1210,350],[1240,410]],front:[600,340,660],hind:[660,960,1480]},
  walker_stack_v1:{neck:[[490,180],[310,330]],tail:[[1180,320],[1230,380]],front:[600,320,640],hind:[660,960,1480]},
  gordon_stack_v1:{neck:[[500,230],[290,430]],tail:[[1160,330],[1185,420]],front:[660,300,660],hind:[660,980,1480]},
  dogo_stack_v1:{neck:[[450,150],[290,280]],tail:[[1140,350],[1200,475]],front:[620,300,640],hind:[620,920,1420]},
  corso_stack_v1:{neck:[[545,120],[420,320]],tail:[[1112,300],[1128,395]],front:[630,290,690],hind:[615,880,1400]},
  pit_bull_terrier_stack_v1:{neck:[[335,300],[290,650]],tail:[[1130,318],[1180,372]],front:[650,280,830],hind:[640,900,1530]},
  pit_bull_terrier_all_mastiff_mix_stack_v1:{neck:[[485,30],[330,305]],tail:[[1165,388],[1228,500]],front:[640,330,680],hind:[650,930,1450]},
  beagle_stack_v1:{neck:[[530,250],[270,330]],tail:[[1040,318],[1100,388]],front:[630,270,660],hind:[600,820,1330]},
  redbone_stack_v1:{neck:[[560,275],[315,430]],tail:[[1030,335],[1085,400]],front:[620,215,640],hind:[570,830,1310]},
  bnt_stack_v1:{neck:[[565,280],[315,440]],tail:[[1040,340],[1090,402]],front:[620,220,640],hind:[570,840,1310]},
  bully_stack_v1:{neck:[[640,290],[300,395]],tail:[[1092,396],[1108,436]],front:[720,185,760],hind:[660,800,1320]}
};
const MS=.5,FEATHER=14,RIGC={};
const aff={
  mul:(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]],
  inv:M=>{const det=M[0]*M[3]-M[1]*M[2],a=M[3]/det,b=-M[1]/det,c=-M[2]/det,d=M[0]/det;return[a,b,c,d,-(a*M[4]+c*M[5]),-(b*M[4]+d*M[5])]},
  ap:(M,p)=>[M[0]*p[0]+M[2]*p[1]+M[4],M[1]*p[0]+M[3]*p[1]+M[5]],
  about:(cx,cy,sx,sy)=>[sx,0,0,sy,cx-sx*cx,cy-sy*cy],
  sim:(P1,P2,Q1,Q2)=>{const px=P2[0]-P1[0],py=P2[1]-P1[1],qx=Q2[0]-Q1[0],qy=Q2[1]-Q1[1],l=px*px+py*py,zr=(qx*px+qy*py)/l,zi=(qy*px-qx*py)/l;
    return[zr,zi,-zi,zr,Q1[0]-(zr*P1[0]-zi*P1[1]),Q1[1]-(zi*P1[0]+zr*P1[1])]}
};
async function rigFor(body){
  if(RIGC[body])return RIGC[body];
  const M=await maps(body,MS),{w,h,m2,m3}=M,R=RIGS[body],A=i=>m3[i*4]>=128;
  const inside=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<w&&y<h&&A(y*w+x)};
  const snapSeg=(a,b)=>{a=[a[0]*MS,a[1]*MS];b=[b[0]*MS,b[1]*MS];const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(a[0]-b[0])/L,(a[1]-b[1])/L];
    const go=sg=>{let last=mid;for(let t=0;t<L/2+60;t+=.5){const p=[mid[0]+u[0]*t*sg,mid[1]+u[1]*t*sg];if(inside(p[0],p[1]))last=p;else if(t>L/2-30)break}return last};return[go(1),go(-1)]};
  const scan=(y,x0,x1)=>{y=Math.round(y*MS);let a=null,b=null;for(let x=Math.round(x0*MS);x<=Math.round(x1*MS);x++)if(inside(x,y)){if(a===null)a=x;b=x}return[[a,y],[b,y]]};
  const cen=r=>{let sx=0,sy=0,n=0;for(let i=0;i<w*h;i++)if(Math.round(m2[i*4]/20)===r&&A(i)){sx+=i%w;sy+=(i/w)|0;n++}return n?[sx/n,sy/n]:null};
  const rig={neck:snapSeg(...R.neck),tail:snapSeg(...R.tail),front:scan(...R.front),hind:R.hindSeg?R.hindSeg.map(([x,y])=>[Math.round(x*MS),Math.round(y*MS)]):scan(...R.hind),fr:[R.front[1]*MS,R.front[2]*MS],hr:[R.hind[1]*MS,R.hind[2]*MS],nose:cen(6)||[0,h/3],tailC:cen(8)||[w,h/3]};
  // part weight fields
  const N=w*h,W={torso:new Float32Array(N),head:new Float32Array(N),tail:new Float32Array(N),front:new Float32Array(N),hind:new Float32Array(N)};
  const line=(P1,P2,ref)=>{const dx=P2[0]-P1[0],dy=P2[1]-P1[1],L=Math.hypot(dx,dy);let nx=-dy/L,ny=dx/L;if(((ref[0]-P1[0])*nx+(ref[1]-P1[1])*ny)<0){nx=-nx;ny=-ny}return{P1,nx,ny,dx,dy,L}};
  const nk=line(rig.neck[0],rig.neck[1],rig.nose),tl=line(rig.tail[0],rig.tail[1],rig.tailC),F=FEATHER;
  const bbox={};for(const k in W)bbox[k]=[1e9,1e9,-1e9,-1e9];
  for(let i=0;i<N;i++){if(m3[i*4]===0)continue;const x=i%w,y=(i/w)|0,rg=Math.round(m2[i*4]/20);
    const dH=(x-nk.P1[0])*nk.nx+(y-nk.P1[1])*nk.ny,dT=(x-tl.P1[0])*tl.nx+(y-tl.P1[1])*tl.ny,tp=((x-tl.P1[0])*tl.dx+(y-tl.P1[1])*tl.dy)/(tl.L*tl.L);
    const hw=(rg>=2&&rg<=6)||rg===9||rg===10?1:ss(-F,F,dH);
    const tw=(rg===8||(tp>-.4&&tp<1.4))?ss(-F,F,dT):0;
    // below the chest line, everything forward of the front-leg window is front paw (toes point forward), so it travels with the legs
    const fw=x<=rig.fr[1]+8?ss(-F,F,y-rig.front[0][1]):0;
    const bw=(x>=rig.hr[0]-8&&x<=rig.hr[1]+8)?ss(-F,F,y-rig.hind[0][1]):0;
    W.head[i]=hw;W.tail[i]=tw;W.front[i]=fw*(1-hw);W.hind[i]=bw*(1-tw);
    W.torso[i]=(dH>=F&&!(((rg>=2&&rg<=6)||rg===9||rg===10)&&dH<F))||tw>=.999||W.front[i]>=.999||W.hind[i]>=.999?0:1;
    for(const k in W)if(W[k][i]>0){const b=bbox[k];if(x<b[0])b[0]=x;if(y<b[1])b[1]=y;if(x>b[2])b[2]=x;if(y>b[3])b[3]=y}}
  return RIGC[body]={rig,W,bbox,M};
}
const MORPH_CACHE={};
// a similarity transform's scale kept inside [lo,hi], scaling about a fixed point (the neck or tail base on the torso)
function clampScale(M,c,lo,hi){const s=Math.hypot(M[0],M[1]),f=clamp(s,lo,hi)/s;return Math.abs(f-1)<1e-3?M:aff.mul(aff.about(c[0],c[1],f,f),M)}
// separable box blur (running sums), used to feather markings across part seams
function boxBlur(a,w,h,r){const t=new Float32Array(a.length),o=new Float32Array(a.length),n=2*r+1;
  for(let y=0;y<h;y++){let s=0;const b=y*w;for(let x=-r;x<=r;x++)s+=a[b+clamp(x,0,w-1)];for(let x=0;x<w;x++){t[b+x]=s/n;s+=a[b+Math.min(w-1,x+r+1)]-a[b+Math.max(0,x-r)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[clamp(y,0,h-1)*w+x];for(let y=0;y<h;y++){o[y*w+x]=s/n;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}return o}
async function morphMaps(mo,scale){
  const key=JSON.stringify(mo)+'@'+scale;if(MORPH_CACHE[key])return MORPH_CACHE[key];
  const P=mo.parts,k=mo.k||{},rg={};for(const b of new Set(Object.values(P)))rg[b]=await rigFor(b);
  const T=rg[P.torso],tr=T.rig,center=[(tr.fr[0]+tr.hr[1])/2,(tr.neck[0][1]+tr.front[0][1])/2];
  const Mt=aff.about(center[0],center[1],k.tx||1,k.ty||1),Q=p=>aff.ap(Mt,p);
  const xf={torso:Mt};
  {const H=rg[P.head].rig,mid=[(H.neck[0][0]+H.neck[1][0])/2,(H.neck[0][1]+H.neck[1][1])/2],pre=aff.about(mid[0],mid[1],k.head||1,1);
    xf.head=aff.mul(aff.sim(aff.ap(pre,H.neck[0]),aff.ap(pre,H.neck[1]),Q(tr.neck[0]),Q(tr.neck[1])),pre);
    if(P.head!==P.torso)xf.head=clampScale(xf.head,Q([(tr.neck[0][0]+tr.neck[1][0])/2,(tr.neck[0][1]+tr.neck[1][1])/2]),.86,1.14);
    if(k.hs&&k.hs!==1){const nm=Q([(tr.neck[0][0]+tr.neck[1][0])/2,(tr.neck[0][1]+tr.neck[1][1])/2]);xf.head=aff.mul(aff.about(nm[0],nm[1],k.hs,k.hs),xf.head)}}
  for(const part of['front','hind']){const Lg=rg[P[part]].rig,seg=Lg[part],tseg=tr[part],S0=aff.sim(seg[0],seg[1],Q(tseg[0]),Q(tseg[1])),s0=Math.hypot(S0[0],S0[1]);
    const pre=aff.about((seg[0][0]+seg[1][0])/2,seg[0][1],1,(k.leg||1)/Math.max(.6,s0));xf[part]=aff.mul(aff.sim(aff.ap(pre,seg[0]),aff.ap(pre,seg[1]),Q(tseg[0]),Q(tseg[1])),pre)}
  {const Tl=rg[P.tail].rig;xf.tail=aff.sim(Tl.tail[0],Tl.tail[1],Q(tr.tail[0]),Q(tr.tail[1]));
    if(P.tail!==P.torso)xf.tail=clampScale(xf.tail,Q([(tr.tail[0][0]+tr.tail[1][0])/2,(tr.tail[0][1]+tr.tail[1][1])/2]),.82,1.02);
    if(k.tl&&k.tl!==1){const r=Q(tr.tail[0]);xf.tail=aff.mul(aff.about(r[0],r[1],k.tl,k.tl),xf.tail)}}
  // fit into the frame (world = master half-res units, 768x512)
  let bb=[1e9,1e9,-1e9,-1e9];
  for(const part of['torso','head','front','hind','tail']){const b=rg[P[part]].bbox[part];if(b[2]<b[0])continue;
    for(const c of[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]]){const q=aff.ap(xf[part],c);bb=[Math.min(bb[0],q[0]),Math.min(bb[1],q[1]),Math.max(bb[2],q[0]),Math.max(bb[3],q[1])]}}
  const fs=Math.min(1,.97*768/(bb[2]-bb[0]),.965*512/(bb[3]-bb[1])),ox=384-fs*(bb[0]+bb[2])/2,oy=.975*512-fs*bb[3];
  const k2=scale/MS,FIT=[fs*k2,0,0,fs*k2,ox*k2,oy*k2];
  const w=Math.round(1536*scale),h=Math.round(1024*scale),N=w*h;
  const oA=new Float32Array(N),oS=new Float32Array(N),oI=new Float32Array(N),oW=new Float32Array(N),oR=new Uint8Array(N),oSa=new Float32Array(N),oTa=new Float32Array(N),oMk=new Float32Array(N),oFb=new Uint8Array(N),oP=new Uint8Array(N);
  const srcs=[...new Set(Object.values(P))];
  for(const part of['torso','hind','front','tail','head']){
    const src=rg[P[part]],SM=src.M,sw=SM.w,sh=SM.h,Wt=src.W[part],b=src.bbox[part];if(b[2]<b[0])continue;
    const Mf=aff.mul(FIT,xf[part]),Mi=aff.inv(Mf);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const c of[[b[0],b[1]],[b[2]+1,b[1]],[b[0],b[3]+1],[b[2]+1,b[3]+1]]){const q=aff.ap(Mf,c);x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1])}
    x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(w-1,Math.ceil(x1));y1=Math.min(h-1,Math.ceil(y1));
    const isT=part==='torso',pid=srcs.indexOf(P[part])+1;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const sx=Mi[0]*(x+.5)+Mi[2]*(y+.5)+Mi[4],sy=Mi[1]*(x+.5)+Mi[3]*(y+.5)+Mi[5],ix=sx|0,iy=sy|0;if(ix<0||iy<0||ix>=sw||iy>=sh)continue;
      const si=iy*sw+ix,wt=Wt[si];if(wt<=0)continue;const p4=si*4,sa=SM.m3[p4]/255;
      let reg=Math.round(SM.m2[p4]/20),ink=SM.m1[p4+1],mk=SM.m3[p4+1];
      if(isT&&((reg>=2&&reg<=6)||reg===9||reg===10)){reg=1;ink*=.3;mk=0}
      const o=y*w+x,oa=oA[o],na=oa*(1-wt)+sa*wt;if(na<=0){oA[o]=0;continue}
      const f0=oa*(1-wt)/na,f1=sa*wt/na;
      oS[o]=oS[o]*f0+SM.m1[p4]*f1;oI[o]=oI[o]*f0+ink*f1;oW[o]=oW[o]*f0+SM.m1[p4+2]*f1;oSa[o]=oSa[o]*f0+SM.m2[p4+1]*f1;oTa[o]=oTa[o]*f0+SM.m2[p4+2]*f1;oMk[o]=oMk[o]*f0+mk*f1;
      if(sa*wt>=oa*(1-wt)){oR[o]=reg;oFb[o]=SM.m3[p4+2];oP[o]=pid}oA[o]=na;
    }
  }
  if(srcs.length>1){
    // where parts from different breeds meet, feather the white spread, saddle and tan-point fields so markings flow across the join
    const R=Math.max(3,Math.round(46*scale)),seam=new Float32Array(N),aw=new Float32Array(N);
    for(let i=0;i<N;i++){if(oA[i]<.5)continue;aw[i]=1;const x=i%w;if(x<w-1&&oA[i+1]>=.5&&oP[i+1]!==oP[i]){seam[i]=1;seam[i+1]=1}if(i+w<N&&oA[i+w]>=.5&&oP[i+w]!==oP[i]){seam[i]=1;seam[i+w]=1}}
    const near=boxBlur(seam,w,h,R),den=boxBlur(aw,w,h,R),k=(2*R+1)*.9;
    for(const f of[oW,oSa,oTa]){const fa=new Float32Array(N);for(let i=0;i<N;i++)fa[i]=f[i]*aw[i];const bl=boxBlur(fa,w,h,R);
      for(let i=0;i<N;i++){if(!aw[i])continue;const s=Math.min(1,near[i]*k);if(s>0)f[i]=f[i]*(1-s)+bl[i]/Math.max(1e-6,den[i])*s}}
  }
  {
    // drop small pieces left floating where parts were cut (ear tips, stray limb edges) or stray specks in a master
    // solid pieces are found at half opacity so faint edge pixels can't bridge a loose piece to the body; soft edges stay only beside a kept piece
    const lab=new Int32Array(N),q=new Int32Array(N),sizes=[0];
    for(let i=0;i<N;i++){if(lab[i]||oA[i]<.5)continue;const id=sizes.length;let qh=0,qt=0,n=0;lab[i]=id;q[qt++]=i;
      while(qh<qt){const j=q[qh++],x=j%w;n++;for(const t of[x>0?j-1:-1,x<w-1?j+1:-1,j-w,j+w]){if(t<0||t>=N||lab[t]||oA[t]<.5)continue;lab[t]=id;q[qt++]=t}}sizes.push(n)}
    const big=Math.max(...sizes),kept=new Float32Array(N);for(let i=0;i<N;i++){if(!lab[i])continue;if(sizes[lab[i]]<big*.04)oA[i]=0;else kept[i]=1}
    const nearKept=boxBlur(kept,w,h,2);for(let i=0;i<N;i++)if(oA[i]>0&&oA[i]<.5&&nearKept[i]<=0)oA[i]=0;
  }
  const m1=new Uint8ClampedArray(N*4),m2=new Uint8ClampedArray(N*4),m3=new Uint8ClampedArray(N*4);
  for(let i=0;i<N;i++){const p=i*4,a=oA[i];m3[p]=a>.02?a*255:0;m3[p+1]=oMk[i];m3[p+2]=oFb[i];m3[p+3]=255;m1[p]=oS[i];m1[p+1]=oI[i];m1[p+2]=oW[i];m1[p+3]=255;m2[p]=oR[i]*20;m2[p+1]=oSa[i];m2[p+2]=oTa[i];m2[p+3]=255}
  const keys=Object.keys(MORPH_CACHE);if(keys.length>40)delete MORPH_CACHE[keys[0]];
  return MORPH_CACHE[key]={w,h,m1,m2,m3};
}
// ---------- LONG COAT / FEATHERING ----------
// m3.b: 0 = short-coated master pixel, 1 = long-coated core, 2..255 = native feathering (relative depth).
const FEATHER_CACHE=new Map();let featherKeyId=0;const MAPID=new WeakMap();
function featherize(M,spec,scale){
  const vis=spec.coatLen||0,den=spec.featherDen??.5,tex=spec.texture||0,sd=(spec.seed|0)||1;
  if(!MAPID.has(M))MAPID.set(M,++featherKeyId);
  const key=MAPID.get(M)+'|'+vis+'|'+den+'|'+tex+'|'+sd;if(FEATHER_CACHE.has(key))return FEATHER_CACHE.get(key);
  const{w,h}=M,N=w*h,inv=1/scale;let hasNative=false,hasShort=false;
  for(let i=0;i<N;i+=7){const b=M.m3[i*4+2];if(M.m3[i*4]>128){if(b>=70)hasNative=true;else if(b===0)hasShort=true}}
  if((!hasNative||vis>=.98)&&(!hasShort||vis<.04))return M;
  const m1=new Uint8ClampedArray(M.m1),m2=new Uint8ClampedArray(M.m2),m3=new Uint8ClampedArray(M.m3);
  const strand=(x,y)=>{const X=x*inv,Y=y*inv,wx=X+tex*7*Math.sin(Y*.08+X*.015);return vn(wx*.26,Y*.028,sd+81)*.7+vn(wx*.85,Y*.075,sd+82)*.3};
  // 1) trim native feathering to the inherited length
  if(hasNative&&vis<.98)for(let i=0;i<N;i++){const p=i*4,b=m3[p+2];if(b<70||m3[p]===0)continue;const rel=(b-70)/185,x=i%w,y=(i/w)|0,sn=strand(x,y),lim=vis*(.72+.56*sn)+(vis>0?.03:0);
    const k=1-ss(lim-.05,lim+.02,rel);if(k<1){m3[p]=m3[p]*k;if(k<.5)m3[p+2]=60}}
  if(hasNative&&vis<.98){ // drop fringe islands left floating after trimming
    const seen=new Uint8Array(N),q=new Int32Array(N);let qh=0,qt=0;
    for(let i=0;i<N;i++){const p=i*4;if(m3[p]>=128&&m3[p+2]<70){seen[i]=1;q[qt++]=i}}
    while(qh<qt){const i=q[qh++],x=i%w;for(const j of[i-1,i+1,i-w,i+w]){if(j<0||j>=N||seen[j])continue;if((j===i-1&&x===0)||(j===i+1&&x===w-1))continue;if(m3[j*4]>25){seen[j]=1;q[qt++]=j}}}
    for(let i=0;i<N;i++)if(!seen[i]&&m3[i*4]>0&&m3[i*4+2]>=70)m3[i*4]=0;
  }
  // 2) grow strands on short-coated edges when the dog carries long-coat genes
  if(hasShort&&vis>=.04){
    const nx=new Int32Array(N).fill(-1);
    for(let i=0;i<N;i++)if(m3[i*4]>=128)nx[i]=i;
    const d2=(i,r)=>{const dx=i%w-r%w,dy=((i/w)|0)-((r/w)|0);return dx*dx+dy*dy};
    const pass=(i,j)=>{const r=nx[j];if(r<0)return;if(nx[i]<0||d2(i,r)<d2(i,nx[i]))nx[i]=r};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x>0)pass(i,i-1);if(y>0){pass(i,i-w);if(x>0)pass(i,i-w-1);if(x<w-1)pass(i,i-w+1)}}
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x<w-1)pass(i,i+1);if(y<h-1){pass(i,i+w);if(x<w-1)pass(i,i+w+1);if(x>0)pass(i,i+w-1)}}
    const LMAX=115*scale*vis;
    const inset=Math.max(2,6*scale/.5);
    for(let i=0;i<N;i++){const p=i*4;if(m3[p]>=128)continue;const r0=nx[i];if(r0<0)continue;if(M.m3[r0*4+2]!==0)continue;
      const x=i%w,y=(i/w)|0,rx=r0%w,ry=(r0/w)|0,dx=x-rx,dy=y-ry,dist=Math.hypot(dx,dy);if(dist<.5||dist>LMAX)continue;
      const sx=clamp(Math.round(rx-dx/dist*inset),0,w-1),sy=clamp(Math.round(ry-dy/dist*inset),0,h-1),r=M.m3[(sy*w+sx)*4]>=128?sy*w+sx:r0,rp=r*4;
      const rg=Math.round(m2[rp]/20);if(rg===2||rg===3||rg===5||rg===6||rg===7)continue;
      let hang=clamp(dy/dist*1.3+.1,0,1);if(y>h*.5&&dx>0)hang=Math.max(hang,.55*dx/dist);if(rg===4)hang=Math.max(hang,.45*clamp(dy/dist+.3,0,1));if(rg===8)hang=Math.max(hang,.3*clamp(dy/dist+.5,0,1));
      if(hang<.03)continue;
      const Lp=LMAX*hang*(.45+.9*vn(rx*inv*.05,ry*inv*.05,sd+83));if(dist>Lp)continue;
      const sn=strand(x,y),thr=.64-den*.36,st=ss(thr-.035,thr+.035,sn),a=st*(1-ss(.55,1,dist/Lp))*(M.m3[r0*4]/255);if(a<.05)continue;
      const na=Math.max(m3[p]/255,a),f=a/na;
      m1[p]=m1[p]*(1-f)+M.m1[rp]*(.82+.28*sn)*(1-.18*dist/Lp)*f;m1[p+1]=m1[p+1]*(1-f)+(st<.6?70:10)*f;m1[p+2]=M.m1[rp+2];
      m2[p]=m2[rp];m2[p+1]=m2[rp+1];m2[p+2]=m2[rp+2];m3[p]=na*255;m3[p+1]=0;m3[p+2]=60;}
  }
  const out={w,h,m1,m2,m3};if(FEATHER_CACHE.size>60)FEATHER_CACHE.delete(FEATHER_CACHE.keys().next().value);FEATHER_CACHE.set(key,out);return out;
}
async function renderMorph(spec,mo,scale=.5,opt={}){const M=await morphMaps(mo,scale);return render(spec,scale,{...opt,maps:M})}
function cvnHair(x,y,s){return vn(x*.45,y*.07,s+31)*.55+vn(x*1.1,y*.16,s+32)*.3+vn(x*.08,y*.02,s+33)*.15}

// ---------- reference lineups (real genotypes that produce each named coat) ----------
const LBASE={B:['B','B'],D:['D','D'],E:['E','E'],K:['K','K'],A:['ay','ay'],S:['S','S'],M:['m','m'],T:['t','t'],L:['L','L'],R:['r','r']};
const LINEUPS={
 'American Pit Bull Terrier':{'Black':{},'Blue':{D:['d','d']},'Chocolate':{B:['b','b'],coatInt:.7},'Red':{B:['b','b'],E:['e','e']},'Fawn':{E:['e','e']},'Cream':{E:['e','e'],D:['d','d']},
  'White':{S:['sw','sw'],whiteMod:.1},'Black & white':{S:['S','sw'],whiteMod:.15},'Brindle':{K:['br','br']},'Reverse brindle':{K:['br','br'],patMod:.92},
  'Blue brindle':{K:['br','y'],D:['d','d']},'Red brindle':{K:['br','br'],B:['b','b'],coatInt:.7,patMod:.55},'Merle':{M:['M','m'],S:['S','sp']},
  'Piebald':{E:['e','e'],B:['b','b'],S:['sp','sp'],whiteMod:.05},'Ticked':{S:['sp','sw'],T:['T','T']},'Tri-color':{K:['y','y'],A:['at','at'],S:['S','sp'],whiteMod:.05},
  'Saddle':{K:['y','y'],A:['as','as']},'Masked':{K:['y','y'],E:['Em','E']},
  'Black & tan':{K:['y','y'],A:['at','at'],E:['E','E'],patMod:.88},'Sable':{K:['y','y'],A:['ay','ay'],E:['E','E'],coatInt:.6,patMod:.78},'Seal':{K:['y','y'],A:['ay','ay'],E:['E','E'],coatInt:.9,patMod:.97},
  'Red & white':{B:['b','b'],E:['e','e'],S:['S','sw'],whiteMod:.15},'Blue & white':{D:['d','d'],S:['S','sw'],whiteMod:.15},'Lilac':{B:['b','b'],D:['d','d'],coatInt:.72},'Isabella':{B:['b','b'],D:['d','d'],coatInt:.4}},
 'American Bulldog':{'White':{S:['sw','sw'],whiteMod:.1},'Black & white':{S:['sp','sw']},'Red & white':{E:['e','e'],B:['b','b'],S:['sp','sw']},'Fawn & white':{E:['e','e'],S:['sp','sw']},
  'Brown & white':{B:['b','b'],coatInt:.45,S:['sp','sw']},'Chocolate':{B:['b','b'],coatInt:.75},'Liver':{B:['b','b'],coatInt:.4},'Blue':{D:['d','d']},'Blue & white':{D:['d','d'],S:['sp','sw']},
  'Brindle':{K:['br','br'],S:['S','sw'],whiteMod:.1},'Reverse brindle':{K:['br','br'],patMod:.92,S:['S','sw'],whiteMod:.1},'Red brindle':{K:['br','br'],B:['b','b'],coatInt:.7,S:['S','sw'],whiteMod:.1},
  'Blue brindle':{K:['br','br'],D:['d','d'],S:['S','sw'],whiteMod:.1},'Merle':{M:['M','m'],S:['S','sw']},'Piebald':{B:['b','b'],coatInt:.45,S:['sp','sp'],whiteMod:.1},'Ticked':{S:['sp','sw'],T:['T','T']},
  'Tri-color':{K:['y','y'],A:['at','at'],S:['S','sw']},'Saddle':{K:['y','y'],A:['as','as'],S:['S','sp']},'Masked':{K:['y','y'],E:['Em','E'],S:['S','sp']}},
 'Catahoula Leopard Dog':{'Blue merle':{M:['M','m'],eyes:'Blue'},'Red merle':{M:['M','m'],B:['b','b'],coatInt:.4,eyes:'Amber',eyes2:'Blue'},'Silver merle':{M:['M','m'],merleMod:.92,eyes:'Glass',eyes2:'Blue'},
  'Black merle':{M:['M','m'],merleMod:.08,eyes:'Brown'},'Gray merle':{M:['M','m'],D:['d','d'],eyes:'Green'},'Leopard spotting':{M:['M','m'],merleMod:.48,S:['S','sp'],whiteMod:-.1,eyes:'Glass'},
  'Heavy spotting':{M:['M','m'],merleMod:.28,eyes:'Hazel'},'Light spotting':{M:['M','m'],merleMod:.76,eyes:'Blue',eyes2:'Brown'},'Solid black':{eyes:'Brown'},'Solid chocolate':{B:['b','b'],coatInt:.75,eyes:'Amber'},
  'Solid red':{E:['e','e'],B:['b','b'],eyes:'Amber'},'Black and tan':{K:['y','y'],A:['at','at'],eyes:'Brown'},'Red and white':{E:['e','e'],B:['b','b'],S:['sp','sw'],eyes:'Amber'},
  'Blue and white':{D:['d','d'],S:['sp','sw'],eyes:'Blue'},'Piebald':{S:['sp','sp'],M:['M','m'],eyes:'Glass',eyes2:'Brown'},'Ticked':{S:['sp','sw'],T:['T','T'],eyes:'Hazel'},
  'Masked':{K:['y','y'],E:['Em','E'],eyes:'Brown'},'Copper/tan points':{M:['M','m'],K:['y','y'],A:['at','at'],eyes:'Blue'}},
 'Treeing Walker':{'Black and white':{S:['sp','sw'],whiteMod:-.2,eyes:'Brown'},'Black, white and tan':{K:['y','y'],A:['at','at'],S:['sp','sw'],whiteMod:-.2,speckMod:.35,eyes:'Amber'},
  'Red and white':{E:['e','e'],B:['b','b'],S:['sp','sw'],eyes:'Amber'},'Red ticked':{E:['e','e'],B:['b','b'],S:['sp','sw'],T:['T','T'],eyes:'Amber'},
  'Black ticked':{S:['sp','sw'],T:['T','t'],tickMod:.6,eyes:'Brown'},'Blue ticked':{K:['y','y'],A:['at','at'],S:['sp','sw'],T:['T','T'],tickMod:1,eyes:'Brown'},
  'Chocolate and white':{B:['b','b'],coatInt:.75,S:['sp','sw'],eyes:'Amber'},'Tri-color':{K:['y','y'],A:['at','at'],S:['S','sw'],whiteMod:-.05,eyes:'Brown'},
  'Heavy ticking':{K:['y','y'],A:['at','at'],S:['sp','sw'],whiteMod:-.2,T:['T','T'],tickMod:.5,eyes:'Amber'},'Light ticking':{K:['y','y'],A:['at','at'],S:['sp','sw'],whiteMod:-.2,T:['T','t'],tickMod:.2,eyes:'Brown'},
  'Speckled tri':{K:['y','y'],A:['at','at'],S:['sp','sw'],speckMod:.85,eyes:'Hazel'},'Saddle':{K:['y','y'],A:['as','as'],S:['sp','sw'],whiteMod:-.2,eyes:'Brown'},
  'Piebald':{S:['sp','sp'],whiteMod:.1,eyes:'Brown'},'Masked':{K:['y','y'],E:['Em','E'],S:['S','sp'],eyes:'Brown'},'Brindle mix':{K:['br','br'],S:['sp','sw'],whiteMod:-.2,eyes:'Amber'},
  'Reverse brindle mix':{K:['br','br'],patMod:.92,S:['S','sw'],eyes:'Brown'},'Blue and white':{D:['d','d'],S:['sp','sw'],eyes:'Amber'},'Merle mix':{M:['M','m'],K:['y','y'],A:['at','at'],S:['sp','sw'],whiteMod:-.2,eyes:'Blue',eyes2:'Brown'}},
 'Dogo Argentino':{'Pure white':{whiteMod:.3,eyes:'Brown'},'White, amber eyes':{whiteMod:.3,eyes:'Amber'},'White, hazel eyes':{whiteMod:.3,eyes:'Hazel'},'Odd eyes':{whiteMod:.3,eyes:'Brown',eyes2:'Blue'},
  'White, liver nose':{B:['b','b'],coatInt:.4,whiteMod:.3,eyes:'Amber'},'Patch carrier':{S:['sp','sw'],whiteMod:.35,eyes:'Brown'},'Liver carrier':{B:['B','b'],whiteMod:.3,eyes:'Brown'}},
 'Cane Corso':{'Black':{K:['K','K'],whiteMod:-.2,eyes:'Brown'},'Blue/gray':{K:['K','K'],D:['d','d'],whiteMod:-.2,eyes:'Amber'},'Fawn':{K:['y','y'],E:['Em','Em'],coatInt:.35,eyes:'Brown'},
  'Red':{K:['y','y'],E:['Em','E'],coatInt:.9,eyes:'Amber'},'Formentino':{K:['y','y'],E:['Em','Em'],D:['d','d'],coatInt:.4,eyes:'Amber'},
  'Black brindle':{K:['br','br'],patMod:.72,eyes:'Brown'},'Blue brindle':{K:['br','br'],D:['d','d'],patMod:.7,eyes:'Amber'},'Fawn brindle':{K:['br','y'],patMod:.25,coatInt:.4,eyes:'Brown'},
  'Gray brindle':{K:['br','br'],D:['d','d'],patMod:.35,coatInt:.5,eyes:'Amber'},'Reverse brindle':{K:['br','br'],patMod:.95,eyes:'Brown'},
  'Black, white chest':{K:['K','K'],S:['S','sp'],whiteMod:-.12,eyes:'Brown'},'Blue, white chest':{K:['K','K'],D:['d','d'],S:['S','sp'],whiteMod:-.12,eyes:'Amber'},
  'Fawn, white markings':{K:['y','y'],E:['Em','Em'],S:['S','sp'],whiteMod:.08,coatInt:.35,eyes:'Brown'}},
 'Gordon Setter':{'Black & tan':{K:['y','y'],A:['at','at']},'Black':{},'Liver & tan':{K:['y','y'],A:['at','at'],B:['b','b'],coatInt:.4},'Liver':{B:['b','b'],coatInt:.4},'Chocolate':{B:['b','b'],coatInt:.8},
  'Red':{E:['e','e'],B:['b','b']},'Black with white markings':{S:['S','sp']},'Light tan points':{K:['y','y'],A:['at','at'],patMod:.15},'Heavy tan points':{K:['y','y'],A:['at','at'],patMod:.9},
  'White spotting':{K:['y','y'],A:['at','at'],S:['sp','sw']},'Ticked':{K:['y','y'],A:['at','at'],S:['sp','sw'],T:['T','T']},'Blue roan':{S:['sp','sw'],R:['R','R']},
  'Light feathering':{K:['y','y'],A:['at','at'],featherMod:.35,featherDen:.5},'Heavy feathering':{K:['y','y'],A:['at','at'],featherMod:1,featherDen:1},
  'Wavy coat':{K:['y','y'],A:['at','at'],texture:.9},'Short-coat carrier':{K:['y','y'],A:['at','at'],L:['L','l']}},
 'Black Mountain Cur':{'Black':{},'Blue':{D:['d','d']},'Chocolate':{B:['b','b'],coatInt:.75},'Liver':{B:['b','b'],coatInt:.4},'Red':{B:['b','b'],E:['e','e']},'Fawn':{K:['y','y']},
  'Cream':{E:['e','e'],D:['d','d']},'White-marked black':{S:['S','sp']},'Black and tan':{K:['y','y'],A:['at','at']},'Brindle':{K:['br','br'],E:['Em','E']},
  'Reverse brindle':{K:['br','br'],patMod:.92,E:['Em','E']},'Blue brindle':{K:['br','br'],D:['d','d']},'Red brindle':{K:['br','br'],B:['b','b'],coatInt:.7},'Merle':{M:['M','m'],S:['S','sp'],whiteMod:-.08},
  'Piebald':{S:['sp','sp']},'Ticked':{S:['sp','sw'],T:['T','T']},'Saddle':{K:['y','y'],A:['as','as']},'Masked':{K:['y','y'],E:['Em','E']},'Grizzle':{K:['y','y'],E:['eg','eg'],A:['at','at'],patMod:.6}}
};
// the Pit Bull × Mastiff wears exactly the Pit Bull's coats: same genetics, same colour lines, different body
LINEUPS['Pit Bull Terrier × All Mastiff Mix']=LINEUPS['American Pit Bull Terrier'];
function lineup(breed,name,seed){const d={...(TEMPLATES[breed]&&TEMPLATES[breed].lineBase||{}),...LINEUPS[breed][name]},dm=(TEMPLATES[breed]&&TEMPLATES[breed].mods)||{},g={};for(const L in LBASE)g[L]=(d[L]||LBASE[L]).slice();
  let h=7;for(const c of name)h=(h*31+c.charCodeAt(0))%99991;
  return{g,m:{whiteMod:d.whiteMod||0,patMod:d.patMod??.5,coatInt:d.coatInt??.5,eyes:d.eyes||'Auto',eyes2:d.eyes2||d.eyes||'Auto',merleMod:d.merleMod??.5,tickMod:d.tickMod??.5,speckMod:d.speckMod||0,featherMod:d.featherMod??dm.featherMod??.3,featherDen:d.featherDen??dm.featherDen??.5,texture:d.texture??dm.texture??0,seed:seed??h}}}
return{renderMorph,morphMaps,RIGS,LINEUPS,lineup,BODIES,TEMPLATES,GLOCI,GLOCI_NAMES,BASE_FREQ,COLORS,EYES,NOSES,PATTERNS,DEF,LAYERS,ALL_ON,fromGenotype,specToGenotype,encodeId,decodeId,randomGenotype,resolve,describe,rarity,parseText,specToText,render,sortPair};
})();
