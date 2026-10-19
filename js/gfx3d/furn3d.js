// 3D furniture for the house builder and the houses on the map. The models
// (gfx3d/furnModels.js) are rendered once per look into a picture seen from
// straight above, and gfx2d/furniture.js draws that picture where it used to
// draw the flat art. three.js only loads when a house with furniture shows up
// or the builder opens; until then (or offline without it) the flat art stays.
//
// A piece's look lives on the piece in the house design: f.look = { s: style,
// c: { key: value } }, keys from DEF[id].colors. No look = the default one.

import { FURN_BY_ID } from '../data/homes.js';

let status = 0;            // 0 not loaded, 1 loading, 2 ready, -1 failed
let THREE = null, R = null, lib = null;
const wait = new Set();    // called once when the models are ready
const sprites = new Map(); // key -> canvas (or null while queued)
const queue = [];
const PPM = 48;            // sprite pixels per metre
const MARGIN = 0.3;        // metres round the footprint (beds and couches poke out a bit)
// overhead lamps that would hide the piece from above: cut the view at this height
const CLIP = { pool: 1.5, island: 1.9, table: 1.7, bed: 1.9, kingbed: 1.9 };

export const furn3dReady = () => status === 2;
export function onFurn3d(cb) { if (status === 2) cb(); else wait.add(cb); }

export function want3d() {
  if (status) return;
  status = 1;
  const go = async () => {
    try {
      if (!window.THREE) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'js/vendor/three.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
      THREE = window.THREE;
      const { makeModels } = await import('./furnModels.js');
      R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
      R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
      R.setClearColor(0x000000, 0);
      lib = makeModels(THREE, R);
      setupScene();
      status = 2;
      for (const cb of wait) { try { cb(); } catch (e) { console.warn(e); } }
      wait.clear();
    } catch (e) { console.warn('3D furniture did not load', e); status = -1; }
  };
  go();
}

// ------------------------------------------------------------ looks
export function lookDef(id) { return status === 2 ? lib.DEF[id] || null : null; }
// a look with every key filled in and only values the piece offers
export function fullLook(id, look) {
  const D = lib?.DEF[id], o = { style: 0 };
  if (!D) return o;
  o.style = Math.max(0, Math.min(D.styles.length - 1, (look?.s | 0)));
  for (const [k, , list, def] of D.colors) { const v = look?.c?.[k]; o[k] = list.some(([, x]) => x === v) ? v : def; }
  return o;
}
const keyOf = (id, look) => {
  if (!look) return id;
  const c = look.c || {};
  return id + '|' + (look.s | 0) + '|' + Object.keys(c).sort().map(k => k + c[k]).join(',');
};
// ------------------------------------------------------------ the sprite scene
let scene, sun, cam, floor, pcam;
function setupScene() {
  scene = new THREE.Scene();
  scene.environment = lib.ENV.day;
  scene.add(new THREE.HemisphereLight(0xf2ecff, 0x40342a, 0.4));
  sun = new THREE.DirectionalLight(0xfff0dc, 2.0);
  sun.position.set(2.5, 8, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun);
  floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  cam.up.set(0, 0, 1);                  // the front of the piece (+z) at the top of the picture
  pcam = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
}
function dispose(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }

function renderSprite(id, look) {
  const F = FURN_BY_ID[id], W = F.w * 2, D = F.d * 2;
  const { group } = lib.build(id, fullLook(id, look), W, D);
  scene.add(group);
  const hw = W / 2 + MARGIN, hd = D / 2 + MARGIN, top = 6;
  Object.assign(cam, { left: -hw, right: hw, top: hd, bottom: -hd, near: top - (CLIP[id] || 5.9), far: top + 1 });
  cam.position.set(0, top, 0); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const pw = Math.round(hw * 2 * PPM), ph = Math.round(hd * 2 * PPM);
  R.setPixelRatio(1); R.setSize(pw, ph, false);
  R.render(scene, cam);
  const c = document.createElement('canvas'); c.width = pw; c.height = ph;
  c.getContext('2d').drawImage(R.domElement, 0, 0);
  scene.remove(group); dispose(group);
  return c;
}

// the picture for a piece, or null while it's still being made. load: start
// loading three.js if it isn't yet (the map doesn't: that waits until you walk
// into a house, so it never stalls a drive)
export function furnSprite(id, look, load = true) {
  if (status !== 2) { if (!status && load) want3d(); return null; }
  const k = keyOf(id, look);
  const hit = sprites.get(k);
  if (hit) return hit;
  if (hit === undefined) { sprites.set(k, null); queue.push([k, id, look]); pump(); }
  return null;
}
let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  requestAnimationFrame(() => {
    // a couple a frame so a street of furnished houses doesn't stutter
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 12) {
      const [k, id, look] = queue.shift();
      try { sprites.set(k, renderSprite(id, look)); } catch (e) { console.warn('furniture', id, e); sprites.set(k, false); }
    }
    if (sprites.size > 400) for (const k of [...sprites.keys()].slice(0, 100)) sprites.delete(k);
    pumping = false;
    for (const cb of drawn) cb();
    if (queue.length) pump();
  });
}
const drawn = new Set();
// called after new pictures are ready (the builder redraws its plan)
export function onSprites(cb) { drawn.add(cb); return () => drawn.delete(cb); }
export const spriteMargin = MARGIN;

// ------------------------------------------------------------ the builder's turntable
// Draws the piece in 3D into a 2D canvas and keeps it turning while it's on screen.
export function preview(canvas, id, look) {
  if (status !== 2) return () => {};
  const F = FURN_BY_ID[id], W = F.w * 2, D = F.d * 2;
  const built = lib.build(id, fullLook(id, look), W, D), g = built.group;
  scene.add(g);
  const box = new THREE.Box3().setFromObject(g), size = new THREE.Vector3(); box.getSize(size);
  const r = Math.max(W, D, size.y, 1.4), h = Math.min(size.y, 3);
  const dist = 1.5 + r * 1.5, ctx = canvas.getContext('2d');
  let alive = true, a0 = performance.now();
  const frame = now => {
    if (!alive || !canvas.isConnected) { stop(); return; }
    const a = 0.6 + (now - a0) / 6000;
    pcam.position.set(Math.sin(a) * dist, h * 0.6 + dist * 0.45, Math.cos(a) * dist);
    pcam.lookAt(0, h * 0.4, 0);
    const cw = canvas.width, ch = canvas.height;
    pcam.aspect = cw / ch; pcam.updateProjectionMatrix();
    scene.add(g);
    R.setPixelRatio(1); R.setSize(cw, ch, false);
    for (const t of built.anim) t(now / 1000);
    R.render(scene, pcam);
    scene.remove(g);
    ctx.clearRect(0, 0, cw, ch); ctx.drawImage(R.domElement, 0, 0);
    raf = requestAnimationFrame(frame);
  };
  let raf = requestAnimationFrame(frame);
  scene.remove(g);
  const stop = () => { if (!alive) return; alive = false; cancelAnimationFrame(raf); dispose(g); };
  return stop;
}

// what a colour choice looks like on its button (some finishes are names, not colours)
const SWATCH = { carrara: '#e9e7e2', nero: '#1c1c1e', granite: '#6a625c', butcher: '#b07a48', concrete: '#8a8884', tile: '#f0f0ee', stone: '#9a8a76',
  game: 'linear-gradient(135deg,#ff3a2e,#1b4fc4)', sports: 'linear-gradient(135deg,#2f8a3a,#e8e8e8)', desk: 'linear-gradient(135deg,#1b4fc4,#8a3aff)',
  mix: 'linear-gradient(135deg,#c41b1b,#1b4fc4 50%,#d9b21b)', bg: 'linear-gradient(135deg,#141416 50%,#d9b21b 50%)', bright: 'linear-gradient(135deg,#ff7a1a,#2cff7a 50%,#e0559a)',
  walnut: '#7a5236', gold: 'linear-gradient(135deg,#f6dc8a,#b88a2a)' };
export const swatchCss = v => SWATCH[v] || v;
