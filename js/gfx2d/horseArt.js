// Hogs & Dogs horse genetics and pictures, brought over as is
// (ktanks811-afk/Hogs-and-dogs index.html: HLOCI, HBREED, HG, HORSE_MASTERS).
// A horse's coat, markings, eyes and picture all come from its genes; the
// picture is painted onto the traced Quarter Horse / Thoroughbred masters in
// img/horses. Rules that touch money and the barn live in core/horses.js.
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

const HORSE_BREEDS={
 'Quarter Horse':{spd:72,sta:62,price:2600,coats:['Sorrel','Bay','Buckskin','Grulla']},
 'Thoroughbred':{spd:82,sta:64,price:4200,coats:['Bay','Chestnut','Dark bay','Gray']},
 'Appaloosa':{spd:64,sta:72,price:2300,coats:['Leopard','Blanket','Snowcap']},
 'Mustang':{spd:60,sta:80,price:1700,coats:['Dun','Grulla','Bay','Palomino']}
};
const HORSE_MASTERS={quarter:{"w":1024,"h":683,"face":{"a":[885.3333333333333,72.0],"b":[936.0,184.0]},"legs":{"1":{"cor":636.6666666666666,"knee":470.0},"2":{"cor":633.3333333333333,"knee":493.3333333333333},"3":{"cor":641.3333333333333,"knee":513.3333333333333},"4":{"cor":637.3333333333333,"knee":496.66666666666663}},"maps":{"m1":"img/horses/quarter-m1.1ffb3edd31.webp","m2":"img/horses/quarter-m2.73236f8cda.webp","m3":"img/horses/quarter-m3.ee86f7affe.webp"}},thoroughbred:{"w":1024,"h":683,"face":{"a":[901.3333333333333,64.0],"b":[964.0,178.66666666666666]},"legs":{"1":{"cor":639.3333333333333,"knee":460.0},"2":{"cor":633.3333333333333,"knee":466.66666666666663},"3":{"cor":635.3333333333333,"knee":501.3333333333333},"4":{"cor":640.0,"knee":513.3333333333333}},"maps":{"m1":"img/horses/thoroughbred-m1.b0bd602893.webp","m2":"img/horses/thoroughbred-m2.02a8ab701a.webp","m3":"img/horses/thoroughbred-m3.b7b143f3a8.webp"}}};
const HLOCI={
 E:{name:'Extension',alle:['E','e']},A:{name:'Agouti',alle:['A','At','a']},Cr:{name:'Cream',alle:['Cr','n']},D:{name:'Dun',alle:['D','nd']},
 Ch:{name:'Champagne',alle:['Ch','n']},Z:{name:'Silver',alle:['Z','n']},G:{name:'Gray',alle:['G','g']},Rn:{name:'Roan',alle:['Rn','n']},
 F:{name:'Flaxen',alle:['F','f']},Sb:{name:'Sabino-1',alle:['Sb1','n']},O:{name:'Frame overo',alle:['O','n']},To:{name:'Tobiano',alle:['To','n']},
 Lp:{name:'Leopard complex',alle:['Lp','n']},Pt:{name:'Pattern-1',alle:['Pt','n']},Sw:{name:'Splashed white',alle:['Sw','n']},W:{name:'Dominant white',alle:['W','n']}};
// polygenic: white factor (6 loci), sooty (3), intensity (3), height (4); each allele 1 = "more"
const HPOLY={wf:6,so:3,it:3,ht:4};
const HSTATS=[['spd','Speed'],['str','Strength'],['sta','Stamina'],['agi','Agility'],['end','Endurance'],['int','Intelligence'],['trn','Trainability'],['tmp','Temperament'],['wrk','Work ability']];
// the breed registry: add a breed here (and a master picture in HORSE_MASTERS) and everything else follows.
// Breeds without their own master yet are painted on the Quarter Horse body.
const HBREED={
 'Quarter Horse':{code:'QH',master:'quarter',hh:15.1,lb:1100,gest:11,
   st:{spd:74,str:72,sta:64,agi:76,end:66,int:60,trn:68,tmp:70,wrk:78},
   gf:{E:{E:.62},A:{A:.5,At:.12},Cr:{Cr:.05},D:{D:.04},Ch:{Ch:.006},Z:{Z:.004},G:{G:.07},Rn:{Rn:.04},F:{F:.72},Sb:{Sb1:.012},O:{O:.01},To:{},Lp:{},Pt:{},Sw:{Sw:.006},W:{W:.002},wf:.2,so:.3,it:.5,ht:.5}},
 'Thoroughbred':{code:'TB',master:'thoroughbred',hh:16.1,lb:1050,gest:11,st:{spd:84,str:60,sta:70,agi:64,end:72,int:58,trn:58,tmp:50,wrk:50},
   gf:{E:{E:.6},A:{A:.55,At:.15},Cr:{},D:{},Ch:{},Z:{},G:{G:.08},Rn:{Rn:.01},F:{F:.8},Sb:{Sb1:.03},O:{},To:{},Lp:{},Pt:{},Sw:{},W:{W:.004},wf:.22,so:.35,it:.5,ht:.6}},
 'Appaloosa':{code:'AP',master:'quarter',hh:15,lb:1000,gest:11,st:{spd:66,str:66,sta:72,agi:66,end:76,int:64,trn:66,tmp:66,wrk:70},
   gf:{E:{E:.6},A:{A:.5,At:.08},Cr:{Cr:.05},D:{D:.05},Ch:{},Z:{},G:{G:.05},Rn:{Rn:.02},F:{F:.75},Sb:{},O:{},To:{},Lp:{Lp:.62},Pt:{Pt:.45},Sw:{},W:{},wf:.18,so:.25,it:.5,ht:.45}},
 'Mustang':{code:'MU',master:'quarter',hh:14.2,lb:900,gest:11,st:{spd:64,str:66,sta:80,agi:70,end:84,int:66,trn:52,tmp:50,wrk:68},
   gf:{E:{E:.6},A:{A:.5,At:.1},Cr:{Cr:.05},D:{D:.22},Ch:{},Z:{Z:.02},G:{G:.05},Rn:{Rn:.05},F:{F:.7},Sb:{Sb1:.02},O:{},To:{To:.03},Lp:{},Pt:{},Sw:{},W:{},wf:.15,so:.35,it:.5,ht:.35}}};
const HB_FEE=300,HB_ADULT=36,HB_FOALCOOL=3;
const H_NAMES=['Dusty','Sundance','Rio','Whiskey','Maverick','Shadow','Pepper','Cheyenne','Cisco','Blaze','Rebel','Sage','Tumbleweed','Honey','Jubilee','Doc','Smokey','Poco','Dash','Scout','Lena','Starlight','Buck','Tuff','Remington','Cash','Juniper','Belle','Colt','Ringo'];
const hmix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const hhex=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
const HG={
  // ---------- genotype ----------
  draw(breed,loc,rng=R){const f=HBREED[breed].gf[loc]||{},al=HLOCI[loc].alle;let r=rng();for(const a of al.slice(0,-1)){r-=f[a]||0;if(r<0)return a}return al[al.length-1]},
  randomGenes(breed,rng=R){const g={};for(const k in HLOCI){let p=[HG.draw(breed,k,rng),HG.draw(breed,k,rng)];if(k==='O'&&p[0]==='O'&&p[1]==='O')p[1]='n';if(k==='W'&&p[0]==='W'&&p[1]==='W')p[1]='n';g[k]=p}
    const gf=HBREED[breed].gf;for(const k in HPOLY)g[k]=Array.from({length:HPOLY[k]},()=>[rng()<gf[k]?1:0,rng()<gf[k]?1:0]);return g},
  has:(g,k,a)=>g[k][0]===a||g[k][1]===a,cnt:(g,k,a)=>(g[k][0]===a)+(g[k][1]===a),
  poly:(g,k)=>g[k].reduce((s,p)=>s+p[0]+p[1],0)/(2*HPOLY[k]),
  agouti(g){const s=g.A;return s.includes('A')?'A':s.includes('At')?'At':'a'},
  // ---------- phenotype: everything visible comes from here ----------
  pheno(h){const g=h.genes,rng=mulberry(h.seed||1),has=(k,a)=>HG.has(g,k,a),n=(k,a)=>HG.cnt(g,k,a);
    const red=!has('E','E'),ag=HG.agouti(g),base=red?'chestnut':ag==='A'?'bay':ag==='At'?'brown':'black';
    const it=HG.poly(g,'it'),so=HG.poly(g,'so'),cr=n('Cr','Cr'),dun=has('D','D'),ch=has('Ch','Ch'),sil=has('Z','Z')&&!red,flax=red&&n('F','f')===2;
    const RED=[[.64,.33,.14],[.52,.23,.09],[.34,.14,.07]],BAYC=[[.52,.25,.1],[.43,.18,.08],[.25,.105,.05]],BLK=[.07,.065,.065],pick3=(a)=>it<.34?a[0]:it<.67?a[1]:a[2];
    let body=base==='chestnut'?pick3(RED):base==='bay'?pick3(BAYC):base==='brown'?[.2,.1,.055]:BLK,points=base==='chestnut'?null:BLK.slice(),mane=base==='chestnut'?body.map(v=>v*.85):BLK.slice();
    if(base==='chestnut'&&flax)mane=[.86,.74,.52];if(base==='chestnut'&&it>.67&&!flax)mane=body.map(v=>v*.7);
    let name=base==='chestnut'?(flax?'Flaxen Chestnut':it<.34?'Sorrel':it>.67&&so>.4?'Liver Chestnut':'Chestnut'):base==='bay'?(so>.6||it>.8?'Dark Bay':it>.55&&so<.3?'Blood Bay':'Bay'):base==='brown'?'Dark Bay':'Black';
    if(base==='bay'&&name==='Blood Bay')body=[.5,.16,.06];
    // dilutions
    if(cr===1){if(base==='chestnut'){body=[.86,.68,.38];mane=[.95,.92,.82];name='Palomino'}else if(base==='bay'){body=[.8,.64,.36];name='Buckskin'}else if(base==='brown'){body=[.55,.4,.24];name='Brown Buckskin'}else{body=[.14,.11,.1];name='Smoky Black'}}
    if(cr===2){const cc=[.94,.9,.8];body=cc;points=base==='chestnut'?null:[.88,.8,.66];mane=base==='chestnut'?[.95,.93,.86]:[.86,.72,.55];name=base==='chestnut'?'Cremello':base==='black'?'Smoky Cream':'Perlino'}
    if(ch){if(base==='chestnut'){body=[.86,.66,.4];mane=[.92,.84,.66];name='Gold Champagne'}else if(base==='bay'){body=[.8,.62,.4];points=[.52,.38,.26];name='Amber Champagne'}else{body=[.5,.44,.38];points=[.4,.34,.28];mane=[.38,.32,.26];name='Classic Champagne'}}
    if(sil){points=points&&[.34,.22,.15];mane=[.82,.8,.74];if(base==='black'){body=[.34,.2,.13];name='Silver Black'}else name='Silver '+name}
    let dunS=null;if(dun){dunS=points?points.map(v=>Math.max(v,.06)):body.map(v=>v*.55);
      if(base==='chestnut'){body=hmix(body,[.9,.66,.44],.55);dunS=body.map(v=>v*.62);name=cr?'Dunalino':'Red Dun'}else if(base==='black'&&!cr){body=[.44,.42,.39];name='Grulla'}else{body=hmix(body,[.82,.66,.42],.5);name=cr?'Dunskin':'Dun'}}
    const roan=has('Rn','Rn')?.5:0;if(roan){if(!cr&&!dun&&!ch&&!sil)name={chestnut:'Red Roan',bay:'Bay Roan',brown:'Bay Roan',black:'Blue Roan'}[base];else name+=' Roan'}
    const gray=has('G','G')?clamp((h.age-10)/(n('G','G')===2?60:96),0,1):0,bornAs=name;if(gray>.25)name=gray>.8?'White Gray':gray>.5?'Dapple Gray':'Gray';
    // white: patterns and markings
    const W={sab:n('Sb','Sb1'),frame:has('O','O'),splash:has('Sw','Sw'),tob:has('To','To'),domW:has('W','W'),lp:n('Lp','Lp'),pt:has('Pt','Pt')};
    const wf=HG.poly(g,'wf')+(W.sab?.35*W.sab:0)+(W.splash?.3:0)+(W.frame?.08:0)+(W.domW?.6:0);
    const fr=wf*1.25+rng()*.55-.3;const FACE=[['None',-9],['Small Star',.12],['Star',.24],['Large Star',.36],['Star + Stripe',.48],['Star + Snip',.56],['Blaze',.7],['Star + Blaze',.82],['Wide Blaze',.95],['Bald Face',1.2]];
    let face='None';for(const[f,t]of FACE)if(fr>=t)face=f;if(face==='Star + Stripe'&&rng()<.4)face='Stripe';if(face==='None'&&wf>.15&&rng()<.25)face='Snip';
    const legs=[0,0,0,0].map((_,i)=>{const hind=i<2,v=wf*1.3+(rng()-.5)*.8-.42+(hind?.14:0);return v<=0?0:v<.12?.08:v<.25?.22:v<.45?.42:v<.7?.72:v<1?1.02:1.35});
    const LEG=v=>v===0?'':v<.1?'Coronet':v<.3?'Pastern':v<.5?'Sock':v<.8?'Half stocking':v<1.2?'Stocking':'High white';
    const white=legs.filter(v=>v>0).length,legName=white===0?'':white===1?'One '+LEG(Math.max(...legs)).toLowerCase():['','','Two','Three','Four'][white]+' '+(Math.max(...legs)>=.72?'stockings':'socks');
    const pats=[];if(W.sab)pats.push(W.sab===2?'Sabino White':'Sabino');if(W.frame)pats.push('Frame Overo');if(W.splash)pats.push('Splash');if(W.tob)pats.push('Tobiano');if(W.domW)pats.push('Dominant White');
    let leo=null;if(W.lp){leo=W.pt?(W.lp===2?'Few Spot':'Leopard'):W.lp===2?'Snowcap':'Blanket';pats.push(leo)}if(roan)pats.push('Roan');if(dun)pats.push('Dun factor');
    // eyes, hooves, skin
    const eye=cr===2||W.splash||(face==='Bald Face'&&rng()<.5)?[.45,.62,.8]:ch?[.66,.46,.2]:cr===1&&rng()<.3?[.42,.28,.14]:it>.6?[.18,.1,.06]:[.28,.16,.08];
    const eyeName=eye[2]>.7?'Blue':ch?'Amber':eye[0]>.4?'Hazel':it>.6?'Dark brown':'Brown';
    const skin=cr===2?[.8,.6,.56]:ch?[.62,.5,.46]:[.22,.2,.2];
    const hoof=legs.map(v=>v===0?(W.lp?'striped':'dark'):v<.1?'striped':'light');
    if(gray>0){mane=hmix(mane,[.86,.86,.84],gray*.7)}
    const maneName=HG.shadeName(mane),tail=mane.slice();
    return{base,name,bornAs,body,points,mane,tail,dun,dunS,roan,gray,sooty:so,it,face,legs,legName,faceName:face,hoof,eye,eyeName,skin,W,leo,pats,
      pattern:pats.filter(p=>p!=='Dun factor').join(', ')||'None',markings:[face!=='None'?face:'',legName].filter(Boolean).join(' + ')||'No markings',maneName}},
  shadeName(c){const l=(c[0]+c[1]+c[2])/3;return l>.8?'Flaxen':l>.6?'Cream':l<.12?'Black':c[0]>c[2]*2.2?'Red':'Brown'},
  hex(h){const p=HG.pheno(h);let c=p.body;if(p.gray)c=hmix(c,[.85,.85,.84],p.gray);if(p.W.domW||p.W.sab===2)c=[.92,.9,.86];return hhex(c)},
  // ---------- what the player can see of the genes ----------
  // dominant genes that show on the horse are read off its coat; carriers stay unknown until a DNA test or a telling foal
  geneView(h){const g=h.genes,p=HG.pheno(h),k=h.known||{},out=[],red=p.base==='chestnut',pair=l=>g[l].slice().sort((a,b)=>HLOCI[l].alle.indexOf(a)-HLOCI[l].alle.indexOf(b)).join('/');
    const add=(l,show,txt)=>out.push({l,name:HLOCI[l].name,txt:k[l]?pair(l):txt,known:!!k[l]||show});
    add('E',red,red?'e/e':'E/?');add('A',false,red?'Hidden (red base)':p.base==='black'?'a/a':p.base==='brown'?'At/?':'A/?');
    const cr=HG.cnt(g,'Cr','Cr');add('Cr',cr===2||(cr===1&&p.base!=='black'),cr===2?'Cr/Cr':cr===1&&p.base!=='black'?'Cr/n':'Unknown');
    for(const[l,a]of[['D','D'],['Ch','Ch'],['Rn','Rn']])add(l,HG.has(g,l,a),HG.has(g,l,a)?`${a}/?`:'Unknown');
    add('G',p.gray>.1,p.gray>.1?'G/?':'Unknown');add('Z',HG.has(g,'Z','Z')&&!red,HG.has(g,'Z','Z')&&!red?'Z/?':'Unknown');
    add('F',red,red?(HG.cnt(g,'F','f')===2?'f/f':'F/?'):'Hidden (not red)');
    for(const l of['Sb','O','Sw','To','Lp','W']){const has=HG.has(g,l,HLOCI[l].alle[0]);if(HBREED[h.breed].gf[l]&&Object.keys(HBREED[h.breed].gf[l]).length||has)add(l,has,has?`${HLOCI[l].alle[0]}/?`:'Unknown')}
    return out},
  carriers(h){const g=h.genes,k=h.known||{},c=[];if(k.E&&HG.cnt(g,'E','e')===1)c.push('Red carrier');if(k.A&&g.A.includes('a')&&HG.agouti(g)!=='a')c.push('Black carrier');
    if(k.Cr&&HG.cnt(g,'Cr','Cr')===1&&HG.pheno(h).base==='black')c.push('Cream carrier');if(k.Z&&HG.has(g,'Z','Z')&&HG.pheno(h).base==='chestnut')c.push('Silver carrier (hidden on red)');
    if(k.F&&HG.cnt(g,'F','f')===1)c.push('Flaxen carrier');if(k.O&&HG.has(g,'O','O'))c.push('Frame (lethal if doubled)');return c},
  // ---------- stats ----------
  grow(age){return age<6?.4:age<24?.4+(age-6)/18*.45:age<48?.85+(age-24)/24*.15:age>240?.85:1},
  temper(v){return v<45?'Hot':v<58?'Spirited':v<72?'Willing':'Calm'},
  lineTier(q){return q<20?'Unproven':q<40?'Promising':q<60?'Established':q<80?'Proven':'Elite'},
  // ---------- a horse ----------
  create(breed,o={}){const B=HBREED[breed]||HBREED['Quarter Horse'],pot={},seed=o.seed||ri(1,2e9);for(const[k]of HSTATS)pot[k]=clamp(Math.round((o.pot&&o.pot[k])??B.st[k]+gauss()*7),25,99);
    const h={id:'HH-'+String(S.nextId++).padStart(5,'0'),gid:HG.nextGid(breed),name:o.name||pick(H_NAMES),breed,sex:o.sex||pick(['M','F']),age:o.age??ri(36,96),gen:o.gen||0,seed,
      genes:o.genes||HG.randomGenes(breed),known:{},pot,health:100,hcap:100,bond:o.bond??ri(10,30),wins:0,lastRace:0,lastRide:0,lastTrain:0,trained:0,foals:0,cool:0,base:(HORSE_BREEDS[breed]||{price:2600}).price,
      parents:o.parents||null,bl:o.bl||{line:null,q:ri(5,25),gen:0},born:S.day-(o.age??0)};
    if(!h.bl.line)h.bl.line=h.name+"'s line";HG.settle(h);return h},
  nextGid(breed){S.hgid=S.hgid||{};const c=HBREED[breed].code;S.hgid[c]=(S.hgid[c]||0)+1;return`${c}-${String(S.hgid[c]).padStart(6,'0')}`},
  // current stats, size and names follow from genes, potential, age and training
  settle(h){const gf=HG.grow(h.age),B=HBREED[h.breed];for(const[k]of HSTATS){const tr=(h.tr&&h.tr[k])||0;h[k]=clamp(Math.round(h.pot[k]*gf*.92+tr),10,h.pot[k])}
    const ht=HG.poly(h.genes,'ht');h.hh=Math.round((B.hh-.8+ht*1.6)*(h.age<36?.78+h.age/36*.22:1)*10)/10;h.lb=Math.round(B.lb*(.82+ht*.3)*(.9+h.pot.str/500)*(h.age<36?.45+h.age/36*.55:1)/10)*10;
    const p=HG.pheno(h);h.coat=p.name+(p.leo?' '+p.leo:'');h.price=horseValue(h);return h},
  handsTxt(hh){const w=Math.floor(hh),inch=Math.round((hh-w)*10);return`${w}${inch?'.'+Math.min(3,inch):''} hh`},
  // older saves: a horse without genes gets a genotype that matches the coat it already had, so it looks the same
  fromLegacy(h){const breed=HBREED[h.breed]?h.breed:'Quarter Horse',g=HG.randomGenes(breed),c=(h.coat||'').toLowerCase(),set=(k,a,b)=>{g[k]=[a,b??a]};
    set('Cr','n');set('D','nd');set('Ch','n');set('G','g');set('Rn','n');set('W','n');set('O','n');set('Sb','n');set('To','n');set('Sw','n');set('Z','n');
    if(/sorrel|chestnut|palomino/.test(c)){set('E','e');if(/sorrel/.test(c))g.it=g.it.map(()=>[0,0])}else if(/dark bay/.test(c)){set('E','E','e');set('A','At','a')}else if(/grulla/.test(c)){set('E','E','e');set('A','a')}else{set('E','E','e');set('A','A','a')}
    if(/buckskin|palomino/.test(c))set('Cr','Cr','n');if(/dun|grulla/.test(c))set('D','D','nd');if(/gray/.test(c))set('G','G','g');
    if(breed==='Appaloosa'){set('Lp','Lp','n');set('Pt',/leopard/.test(c)?'Pt':'n','n');if(/snowcap/.test(c))set('Lp','Lp')}
    const x=HG.create(breed,{name:h.name,sex:h.sex,age:h.age,genes:g,bond:h.bond});S.nextId--;
    Object.assign(x,{id:h.id,wins:h.wins||0,lastRace:h.lastRace||0,lastRide:h.lastRide||0,base:h.base||x.base});
    // keep the speed and stamina it already raced with
    for(const k of['spd','sta']){const v=h[k]||x[k];x.pot[k]=Math.max(x.pot[k],v);x.tr=x.tr||{};x.tr[k]=v-Math.round(x.pot[k]*HG.grow(x.age)*.92)}return HG.settle(x)},
  migrate(){S.hpreg=S.hpreg||[];for(const list of[S.horses,S.horseMarket])(list||[]).forEach((h,i)=>{if(!h.genes)list[i]=HG.fromLegacy(h)})},
  // ---------- inheritance ----------
  snap(h,depth=3){return{id:h.id,gid:h.gid,name:h.name,breed:h.breed,sex:h.sex,coat:h.coat,gen:h.gen,wins:h.wins||0,parents:depth>1&&h.parents?h.parents.map(p=>p&&HG.trim(p,depth-1)):null}},
  trim(p,depth){return{...p,parents:depth>1&&p.parents?p.parents.map(q=>q&&HG.trim(q,depth-1)):null}},
  childGenes(s,d,rng=R){const g={};for(const k in HLOCI)g[k]=[pick2(s.genes[k],rng),pick2(d.genes[k],rng)];for(const k in HPOLY)g[k]=s.genes[k].map((p,i)=>[pick2(p,rng),pick2(d.genes[k][i],rng)]);return g;
    function pick2(a,r){return a[r()<.5?0:1]}},
  // a careful same-line pairing narrows the spread of the foal around its better parent; nothing is ever labelled a bonus
  childBloodline(s,d){const same=s.bl&&d.bl&&s.bl.line===d.bl.line,q0=((s.bl?s.bl.q:10)+(d.bl?d.bl.q:10))/2,avgPot=HSTATS.reduce((a,[k])=>a+s.pot[k]+d.pot[k],0)/(HSTATS.length*2);
    const q=clamp(q0*(same?.85:.6)+Math.max(0,avgPot-60)*(same?.9:.5)+(same?4:0),0,100);const top=(s.bl&&d.bl&&d.bl.q>s.bl.q)?d:s;
    return{line:(top.bl&&top.bl.line)||top.name+"'s line",q:Math.round(q),gen:(same?Math.max(s.bl.gen,d.bl.gen):0)+1}},
  foal(s,d){const bl=HG.childBloodline(s,d),sd=7-bl.q/22,pot={};
    for(const[k]of HSTATS){const mid=(s.pot[k]+d.pot[k])/2,best=Math.max(s.pot[k],d.pot[k]);pot[k]=clamp(Math.round(mid+(best-mid)*bl.q/260+gauss()*sd),25,99)}
    const genes=HG.childGenes(s,d),lethal=HG.has(genes,'O','O')&&genes.O[0]==='O'&&genes.O[1]==='O';
    const f=HG.create(d.breed,{age:0,gen:Math.max(s.gen||0,d.gen||0)+1,genes,pot,bond:30,parents:[HG.snap(s),HG.snap(d)],bl});f.born=S.day;f.lethal=lethal;return f},
  // what the foal's coat tells you about its parents' hidden genes
  reveal(f,s,d){const g=f.genes;const tell=(l,a)=>{if(HG.cnt(g,l,a)===2)for(const p of[s,d])if(p&&p.known)p.known[l]=1};tell('E','e');tell('A','a');tell('F','f')},
  // ---------- prediction (only uses what the player could know: hidden genes are drawn from the breed) ----------
  belief(h,rng){const G0=h.genes,k=h.known||{},B=h.breed,p=HG.pheno(h),g=JSON.parse(JSON.stringify(G0)),red=p.base==='chestnut';
    // how many of each pair the coat gives away: 2 = both alleles show, 1 = one dominant allele shows, 0 = nothing shows
    const seen=l=>{const dom=HLOCI[l].alle[0],c=HG.cnt(G0,l,dom);
      if(l==='E')return red?2:1;if(l==='A')return red?0:p.base==='black'?2:1;if(l==='F')return red?(HG.cnt(G0,'F','f')===2?2:1):0;
      if(l==='Z')return red?0:c?1:2;if(l==='G')return p.gray>.1?1:0;if(l==='Cr')return c===1&&p.base==='black'?0:2;return c?1:2};
    for(const l in HLOCI){if(k[l])continue;const v=seen(l);if(v===2)continue;
      if(v===1){const keep=l==='A'?HG.agouti(G0):l==='E'?'E':l==='F'?'F':HLOCI[l].alle[0];g[l]=[keep,HG.draw(B,l,rng)];
        if(l==='A'&&keep!=='A'&&g.A[1]==='A')g.A[1]=keep}else g[l]=[HG.draw(B,l,rng),HG.draw(B,l,rng)]}
    for(const kk in HPOLY)g[kk]=g[kk].map(pp=>rng()<.5?pp:[pp[1],pp[0]]);return g},
  predict(s,d,n=400){const out={},faces={},legs=[0,0],carry={},rng=R;let lethal=0;
    for(let i=0;i<n;i++){const gs=HG.belief(s,rng),gd=HG.belief(d,rng),g=HG.childGenes({genes:gs},{genes:gd},rng),fake={genes:g,seed:ri(1,2e9),age:60,breed:d.breed};
      if(g.O[0]==='O'&&g.O[1]==='O'){lethal++;continue}const p=HG.pheno(fake);const nm=p.gray>0?'Gray (born '+HG.pheno({...fake,age:0}).name+')':p.name;out[nm]=(out[nm]||0)+1;faces[p.face==='None'?'none':'face']=(faces[p.face==='None'?'none':'face']||0)+1;
      if(p.legs.some(v=>v>0))legs[0]++;legs[1]++;for(const[l,a]of[['E','e'],['Cr','Cr'],['D','D'],['A','a']])if(HG.cnt(g,l,a)===1)carry[l+a]=(carry[l+a]||0)+1}
    const tot=Object.values(out).reduce((a,b)=>a+b,0)||1;
    return{colors:Object.entries(out).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,Math.round(v/tot*100)]).filter(x=>x[1]>=1).slice(0,8),face:Math.round((faces.face||0)/tot*100),legs:Math.round(legs[0]/Math.max(1,legs[1])*100),lethal:Math.round(lethal/n*100),
      carry:{red:Math.round((carry.Ee||0)/tot*100),cream:Math.round((carry.CrCr||0)/tot*100)},stats:HSTATS.map(([k,l])=>{const mid=(s.pot[k]+d.pot[k])/2;return[l,Math.round(mid-8),Math.round(mid+8)]})}},
  // ---------- rules ----------
  canBreed(s,d){const probs=[];if(!s||!d)probs.push('Pick a mare and a stallion.');else{
      if(s.sex!=='M')probs.push(`${s.name} is not a stallion.`);if(d.sex!=='F')probs.push(`${d.name} is not a mare.`);
      if(s.breed!==d.breed)probs.push('These horses cannot be bred together. Horse breeding is limited to the same breed.');
      if(s.age<HB_ADULT)probs.push(`${s.name} is too young (breeding age is ${HB_ADULT/12} years).`);if(d.age<HB_ADULT)probs.push(`${d.name} is too young (breeding age is ${HB_ADULT/12} years).`);
      if(s.health<60)probs.push(`${s.name} isn't healthy enough.`);if(d.health<60)probs.push(`${d.name} isn't healthy enough.`);
      if((S.hpreg||[]).some(p=>p.dam===d.id))probs.push(`${d.name} is already in foal.`);if(d.cool>0)probs.push(`${d.name} is recovering from foaling (${d.cool} more day${d.cool>1?'s':''}).`);
      if(S.money<HB_FEE)probs.push(`You need ${fmt(HB_FEE)} for the vet and stud fee.`);if(S.horses.length+(S.hpreg||[]).length>=horseCap())probs.push('There is no stall free for a foal. Build or upgrade horse barns.')}
    return probs},
  breed(s,d){const pr=HG.canBreed(s,d);if(pr.length)return pr;S.money-=HB_FEE;S.hpreg.push({dam:d.id,sire:HG.snap(s),sireRef:s.id,due:S.day+HBREED[d.breed].gest,day:S.day});s.foals=(s.foals||0);
    addLog(`${d.name} was bred to ${s.name}. Foal due day ${S.day+HBREED[d.breed].gest}.`);return[]},
  // foaling at the end of a day
  daily(msgs){for(const h of S.horses){if(h.cool>0)h.cool--;h.health=Math.min(h.hcap||100,(h.health??100)+5);HG.settle(h)}
    const due=(S.hpreg||[]).filter(p=>p.due<=S.day);S.hpreg=(S.hpreg||[]).filter(p=>p.due>S.day);
    for(const p of due){const d=S.horses.find(x=>x.id===p.dam);if(!d){msgs.push('A foal was lost when the mare left the ranch.');continue}
      const sire=S.horses.find(x=>x.id===p.sireRef)||p.sireFull||{...p.sire,genes:null};const s=sire.genes?sire:null;
      const f=HG.foal(s||HG.ghost(p.sire,d),d);d.cool=HB_FOALCOOL;d.foals=(d.foals||0)+1;if(s)s.foals=(s.foals||0)+1;HG.reveal(f,s,d);
      if(f.lethal){msgs.push(`${d.name}'s foal was born all white with lethal white overo and did not survive. Both parents carry frame overo.`);d.known.O=1;if(s)s.known.O=1;continue}
      S.horses.push(f);S.st.foals=(S.st.foals||0)+1;gainXP(25);msgs.push(`${d.name} foaled a ${f.sex==='M'?'colt':'filly'}: ${f.name}, ${f.coat.toLowerCase()}!`);addLog(`New foal: ${f.name} (${f.gid}), ${f.coat}, by ${p.sire.name} out of ${d.name}.`);
      (UI.newFoals=UI.newFoals||[]).push(f.id)}},
  ghost(snap,d){return{...snap,genes:HG.randomGenes(d.breed),pot:Object.fromEntries(HSTATS.map(([k])=>[k,60])),bl:{line:snap.name+"'s line",q:10,gen:0},gen:snap.gen||0}},
  find(id){return S.horses.find(h=>h.id===id)||S.horseMarket.find(h=>h.id===id)||(UI.hPreview||[]).find(h=>h.id===id)}
};

const HMAPS={},HORSE_IMG={},HORSE_PENDING={};let horseQ=Promise.resolve();
const H_WHITE=[.93,.92,.89],H_LEATHER=[.36,.18,.11],H_BRASS=[.95,.72,.28];
let hmaps=async function(key){if(HMAPS[key])return HMAPS[key];const M=HORSE_MASTERS[key],ld=loadImg;
  const ims=await Promise.all([ld(M.maps.m1),ld(M.maps.m2),ld(M.maps.m3)]),rd=(im,sm)=>{const c=document.createElement('canvas');c.width=M.w;c.height=M.h;const x=c.getContext('2d');x.imageSmoothingEnabled=sm;x.drawImage(im,0,0);return x.getImageData(0,0,M.w,M.h).data};
  return HMAPS[key]={w:M.w,h:M.h,m1:rd(ims[0],true),m2:rd(ims[1],false),m3:rd(ims[2],true)}}
const hash2=(x,y,s)=>{let h=(x*374761393+y*668265263+s*982451653)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296};
// round leopard-complex spots: one jittered spot per grid cell, some cells empty
function hSpot(x,y,s,dens){if(dens<=0)return false;const cs=18,cx=Math.floor(x/cs),cy=Math.floor(y/cs);
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=cx+i,Y=cy+j;if(hash2(X,Y,s+31)>dens)continue;const px=(X+.2+.6*hash2(X,Y,s+32))*cs,py=(Y+.2+.6*hash2(X,Y,s+33))*cs,r=cs*(.2+.22*hash2(X,Y,s+34));
    if(((x-px)/r)**2+((y-py)/(r*.8))**2<1+(lnoise(x/2,y/2,s+35)-.5)*.5)return true}return false}
// face markings sit on the front of the face, measured along the forehead-to-nose line (u) and across it (v, px)
function hFaceWhite(P,u,v,n){const f=P.face,av=Math.abs(v)+(n-.5)*2.2;
  const star=(r)=>u>.02&&u<.24&&((u-.12)/.11)**2+(av/r)**2<1,band=(w,u0,u1)=>u>u0&&u<u1&&av<w*(1+u*.35),snip=(w)=>u>.86&&u<1.06&&av<w;
  switch(f){case'Small Star':return star(4.5);case'Star':return star(6.5);case'Large Star':return star(9);case'Stripe':return band(2.6,.2,.82);case'Star + Stripe':return star(6.5)||band(2.4,.12,.8);
    case'Star + Snip':return star(6.5)||snip(5);case'Snip':return snip(5);case'Blaze':return band(5,.0,.98);case'Star + Blaze':return star(8)||band(5,.08,.98);
    case'Wide Blaze':return band(9,0,1.02);case'Bald Face':return band(17,0,1.05);default:return false}}
HG.render=async function(h,scale){const key=HBREED[h.breed].master,M=await hmaps(key),meta=HORSE_MASTERS[key],P=HG.pheno(h),W=Math.round(M.w*scale),H=Math.round(M.h*scale);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),img=g.createImageData(W,H),o=img.data,inv=1/scale,sd=(h.seed||1)%99991;
  const fa=meta.face.a,fb=meta.face.b,fx=fb[0]-fa[0],fy=fb[1]-fa[1],fl=Math.hypot(fx,fy),ux=fx/fl,uy=fy/fl,WS=P.W;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(M.w-1,(x*inv)|0),sy=Math.min(M.h-1,(y*inv)|0),i=(sy*M.w+sx)*4,a=M.m3[i];if(!a)continue;
    const shade=M.m1[i]/127.5,pt=M.m1[i+1]/255,hair=M.m1[i+2]/255,reg=Math.round(M.m2[i]/20),leg=Math.round(M.m2[i+1]/50),lh=M.m2[i+2]/127.5,hl=M.m3[i+1],td=M.m3[i+2];
    let c;
    if(hl>200)c=H_BRASS;else if(hl>100)c=H_LEATHER;
    else if(reg===5)c=hmix(P.eye,[.05,.04,.04],clamp(1-shade*1.4,0,1));
    else if(reg===6)c=P.skin.map(v=>v*.45);
    else{c=reg===3?P.skin:P.body;
      if(P.points&&pt>0&&reg!==3)c=hmix(c,P.points,pt);
      if(hair>0&&(reg===8||reg===9||reg===12))c=hmix(c,reg===9?P.tail:P.mane,Math.min(1,hair*1.15));
      if(P.dun){if(reg===1&&td<7&&sx>M.w*.22&&sx<M.w*.62)c=hmix(c,P.dunS,.85*(1-td/7));if(leg&&lh>.9&&lh<1.7&&Math.sin(sy*.9+sd)>.45)c=hmix(c,P.dunS,.5)}
      if(P.sooty>0&&(reg===1||reg===2)){const k=P.sooty*.62*(1-clamp(td/140,0,1))*(.7+.6*lnoise(sx/34,sy/34,sd));c=c.map(v=>v*(1-k))}
      if(P.roan&&reg===1){const dn=(.55+.45*lnoise(sx/60,sy/60,sd+5))*(leg?clamp((lh-1.2)/.8,0,1):1),fine=lnoise(sx/2.2,sy/2.2,sd+6);c=hmix(c,H_WHITE,clamp(.62*dn*(.55+.7*fine),0,.85))}
      if(P.gray>0&&reg!==3){const gg=clamp((reg===2?P.gray*1.4:reg===11||reg===7?P.gray*.7:P.gray)*1.25,0,1),dap=lnoise(sx/11,sy/11,sd+3),mid=gg<.7?hmix([.4,.4,.42],[.8,.8,.8],dap>.55?.95:.25):[.88,.88,.86];c=hmix(c,mid,gg)}
      // white: face and leg markings, then patterns
      let w=0;
      if((reg===2||reg===3)&&P.face!=='None'){const u=((sx-fa[0])*ux+(sy-fa[1])*uy)/fl,v=(sx-fa[0])*-uy+(sy-fa[1])*ux;if(hFaceWhite(P,u,v,lnoise(sx/3,sy/3,sd+9)))w=1}
      if(leg&&P.legs[leg-1]>0&&reg!==7){const lim=P.legs[leg-1]+(lnoise(sx/5,sy/5,sd+leg)-.5)*.12+(P.legs[leg-1]>.3?Math.sin(sx*.35)*.04:0);if(lh<=lim)w=1}
      if(WS.sab&&(reg===1||reg===2)){const n=lnoise(sx/26,sy/26,sd+11);if(WS.sab===2?n>.25||td>40:td>112&&n>.45){w=1}else if(td>95&&hash2(sx,sy,sd+2)<.3*n)w=Math.max(w,.8)}
      if(WS.frame&&(reg===1||reg===2)&&td>45&&td<138&&lnoise(sx/42,sy/30,sd+13)+lnoise(sx/12,sy/12,sd+14)*.25>.72)w=1;
      if(WS.splash&&(sy>M.h*(.64-.08*lnoise(sx/40,0,sd+15))||(reg===2&&Math.abs(((sx-fa[0])*-uy+(sy-fa[1])*ux))<14)))w=1;
      if(WS.tob&&(reg===1||leg)&&lnoise(sx/85+sy/600,sy/240,sd+17)+lnoise(sx/22,sy/22,sd+18)*.22>.64)w=1;
      if(WS.domW&&lnoise(sx/70,sy/70,sd+19)>.2)w=1;
      if(P.leo&&(reg===1||reg===11||reg===2)){const blanket=P.leo==='Blanket'||P.leo==='Snowcap',edge=M.w*(.4+.07*(lnoise(sy/28,1,sd+22)-.5)*2),inW=blanket?(sx<edge&&td<(P.leo==='Snowcap'?90:135)+lnoise(sx/20,2,sd+23)*25&&reg===1):true;
        if(inW){w=1;const sp=hSpot(sx,sy,sd,P.leo==='Leopard'?.8:P.leo==='Blanket'?.55:P.leo==='Few Spot'?.12:0);if(sp)w=0}}
      if(w>0)c=hmix(c,reg===3?[.82,.6,.56]:H_WHITE,w);
      if(reg===7){const t=P.hoof[leg-1]||'dark';c=t==='light'?[.72,.64,.52]:t==='striped'?(Math.sin(sx*.55)>0?[.72,.64,.52]:[.2,.19,.18]):[.2,.19,.19]}}
    const p=(y*W+x)*4;o[p]=clamp(c[0]*shade*255,0,255);o[p+1]=clamp(c[1]*shade*255,0,255);o[p+2]=clamp(c[2]*shade*255,0,255);o[p+3]=a}
  g.putImageData(img,0,0);return cv};
HG.art=function(h,w=160){if(!HBREED[h.breed]||!HBREED[h.breed].master)return horseSVG(h,w);const sc=w>300?.5:w>180?.34:.24,key=HG.imgKey(h,sc),src=HORSE_IMG[key];
  return`<img class="horseimg" data-hid="${h.id}" data-sc="${sc}" ${src?`src="${src}"`:''} width="${w}" height="${Math.round(w*2/3)}" alt="${esc(h.name)}, ${esc(h.coat)}" style="width:${h.age<HB_ADULT?Math.round(w*(.62+.38*h.age/HB_ADULT)):w}px;max-width:100%;height:auto;aspect-ratio:3/2">`};
HG.imgKey=(h,sc)=>{const P=HG.pheno(h);return`${h.id}|${h.seed}|${sc}|${P.name}|${Math.round(P.gray*12)}`};
function hydrateHorses(){document.querySelectorAll('img.horseimg:not([src])').forEach(img=>{const id=img.dataset.hid,sc=+img.dataset.sc,h=HG.find(id);if(!h)return;const key=HG.imgKey(h,sc);
  if(HORSE_IMG[key]){img.src=HORSE_IMG[key];return}if(HORSE_PENDING[key])return;HORSE_PENDING[key]=1;
  horseQ=horseQ.then(async()=>{const c=await HG.render(h,sc);HORSE_IMG[key]=c.toDataURL('image/png');delete HORSE_PENDING[key];
    document.querySelectorAll(`img.horseimg[data-hid="${id}"][data-sc="${sc}"]`).forEach(i=>i.src=HORSE_IMG[key]);await new Promise(r=>setTimeout(r,0))}).catch(e=>{console.error('horse art',e);delete HORSE_PENDING[key]})})}

function horseValue(h){if(!h.pot)return Math.round(h.base*(.5+Math.pow((h.spd*.6+h.sta*.4)/68,3)*.6)*(h.age<24?.8:1)+h.wins*150);
  // ability now and what the genes allow, plus colour, pattern and bloodline premiums
  const cur=h.spd*.25+h.sta*.15+h.agi*.15+h.str*.1+h.end*.1+h.wrk*.15+h.int*.05+h.trn*.05,pot=HSTATS.reduce((a,[k])=>a+h.pot[k],0)/HSTATS.length,q=h.age<36?pot*.75+cur*.25:cur*.6+pot*.4;
  const P=HG.pheno(h),rare=/Perlino|Cremello|Smoky Cream|Champagne|Silver/.test(P.name)?.3:/Palomino|Buckskin|Dun|Grulla|Roan|Dunskin|Dunalino/.test(P.name)?.14:P.name==='Blood Bay'?.05:0,pat=P.pats.filter(x=>!/Roan|Dun factor/.test(x)).length?.15:0;
  return Math.round(h.base*(.5+Math.pow(q/68,3)*.6)*(1+rare+pat+(h.bl?h.bl.q/500:0))*(h.age<24?.8:h.age>240?.6:1)+(h.wins||0)*150)}
function horseSVG(){return ''}
const horseCap=()=>99;
// keep one master's pixels at a time (iPhones run out of memory otherwise)
{const o=hmaps;hmaps=async function(key){for(const k in HMAPS)if(k!==key)delete HMAPS[k];return o(key)}}
export { HLOCI, HPOLY, HSTATS, HBREED, HB_FEE, HB_ADULT, HB_FOALCOOL, H_NAMES, HORSE_BREEDS, HORSE_MASTERS, HG, hmix, hhex, horseValue, hydrateHorses, HORSE_IMG };
// horses in the market and foal previews are drawn from here
export const showHorses = list => { UI.hPreview = list; };
