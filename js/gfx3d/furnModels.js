// 3D furniture models, the same builders as the Murda Worth Furniture designer
// (generated from its sources; edit the designer, then regenerate). Every
// piece in data/homes.js FURNITURE has 3 styles and its own colour choices:
//   DEF[id] = { styles: [names], colors: [[key, label, [[name, value]...], default]...], build(o, W, D) }
// build() fills the group G in metres: footprint W x D centred on the origin,
// back edge at z = -D/2, the front facing +z. three.js is passed in (it loads
// on demand from js/vendor/three.min.js, see gfx3d/furn3d.js).
/* eslint-disable */
export function makeModels(THREE, renderer) {
  'use strict';
  const col = h => new THREE.Color(h).convertSRGBToLinear();
  const TAU = Math.PI * 2;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // soft studio light baked into an environment map
  function makeEnv(top, horizon, ground, glow) {
    const room = new THREE.Scene(), g = new THREE.SphereGeometry(50, 32, 16), c = [], p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 50, cc = t > 0 ? new THREE.Color(horizon).lerp(new THREE.Color(top), Math.pow(t, 0.6)) : new THREE.Color(horizon).lerp(new THREE.Color(ground), Math.min(1, -t * 3)); c.push(cc.r, cc.g, cc.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    room.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    for (const [x, y, z, s] of [[25, 30, 20, 9], [-30, 22, 10, 6]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 8), new THREE.MeshBasicMaterial({ color: glow })); m.position.set(x, y, z); room.add(m); }
    return new THREE.PMREMGenerator(renderer).fromScene(room, 0.03).texture;
  }
  const ENV = { day: makeEnv(0xdfe6ee, 0xb8b0a8, 0x3a3430, 0xffffff), night: makeEnv(0x1a1a28, 0x2a2420, 0x100e0c, 0x806040) };
  // ---------------------------------------------------------------------
  // Canvas textures
  // ---------------------------------------------------------------------
  function ctex(w, h, draw, srgb = true, rep = [1, 1]) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const TEX = {};
  // wood grain: light so the material colour tints it
  TEX.wood = ctex(512, 512, (x, W, H) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const y0 = rnd() * H, a = 0.03 + rnd() * 0.12, wv = 2 + rnd() * 10, f = 0.004 + rnd() * 0.01, ph = rnd() * 10;
      x.strokeStyle = `rgba(${rnd() < 0.5 ? '90,60,40' : '120,85,55'},${a})`; x.lineWidth = 0.6 + rnd() * 2.4;
      x.beginPath(); for (let px = 0; px <= W; px += 8) { const py = y0 + Math.sin(px * f + ph) * wv + Math.sin(px * f * 3.1 + ph) * wv * 0.3; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    }
    for (let k = 0; k < 4; k++) { const cx = rnd() * W, cy = rnd() * H; for (let r = 2; r < 16; r += 2) { x.strokeStyle = 'rgba(80,50,30,0.12)'; x.beginPath(); x.ellipse(cx, cy, r * 2.6, r, 0, 0, TAU); x.stroke(); } }
  });
  TEX.fabric = ctex(256, 256, (x, W, H) => {
    const img = x.createImageData(W, H), a = img.data;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const o = (j * W + i) * 4, wv = ((i >> 1) + (j >> 1)) & 1 ? 0.93 : 1, n = 0.9 + 0.1 * hash(i * 3.1 + j * 71.7); a[o] = a[o + 1] = a[o + 2] = 255 * wv * n; a[o + 3] = 255; }
    x.putImageData(img, 0, 0);
  }, true, [6, 6]);
  TEX.leather = ctex(256, 256, (x, W, H) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; x.beginPath(); x.arc(rnd() * W, rnd() * H, 0.5 + rnd() * 1.6, 0, TAU); x.fill(); }
  }, true, [3, 3]);
  function marbleTex(base, vein, n = 18) {
    return ctex(512, 512, (x, W, H) => {
      x.fillStyle = base; x.fillRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        x.strokeStyle = vein; x.globalAlpha = 0.15 + rnd() * 0.45; x.lineWidth = 0.6 + rnd() * 2.5;
        let px = rnd() * W, py = rnd() * H; x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 40; k++) { px += 6 + rnd() * 14; py += (rnd() - 0.4) * 18; x.lineTo(px % W, py % H); if (px > W) { px -= W; x.moveTo(px, py % H); } }
        x.stroke();
      }
      x.globalAlpha = 1;
    });
  }
  TEX.carrara = marbleTex('#ece9e4', '#8a8a92'); TEX.nero = marbleTex('#1a1a1c', '#d8d4cc', 12); TEX.granite = ctex(256, 256, (x, W, H) => { x.fillStyle = '#4a4440'; x.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { const v = rnd(); x.fillStyle = v < 0.3 ? '#1c1a18' : v < 0.6 ? '#7a726a' : v < 0.66 ? '#c8b8a0' : '#2e2a28'; x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); } });
  TEX.concrete = ctex(256, 256, (x, W, H) => { x.fillStyle = '#8a8884'; x.fillRect(0, 0, W, H); for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '40,40,40' : '200,200,200'},${rnd() * 0.08})`; x.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 6, 2 + rnd() * 6); } });
  TEX.tile = ctex(256, 256, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#c8c8c8'; for (let k = 0; k <= 4; k++) { x.fillRect(0, k * 64 - 1, W, 2); x.fillRect(k * 64 - 1, 0, 2, H); } }, true, [4, 4]);
  TEX.felt = ctex(128, 128, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; x.fillRect(rnd() * W, rnd() * H, 1, 1); } }, true, [4, 4]);
  TEX.brick = ctex(256, 256, (x, W, H) => { x.fillStyle = '#d8d0c8'; x.fillRect(0, 0, W, H); for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { const ox = (r % 2) * 32; x.fillStyle = `hsl(${12 + rnd() * 10},${35 + rnd() * 20}%,${30 + rnd() * 14}%)`; x.fillRect(c * 64 + ox + 2, r * 32 + 2, 60, 28); } });
  TEX.stone = ctex(256, 256, (x, W, H) => { x.fillStyle = '#3a3634'; x.fillRect(0, 0, W, H); let y = 0; while (y < H) { const h = 20 + rnd() * 26; let px = 0; while (px < W) { const w = 26 + rnd() * 50, v = 120 + rnd() * 70; x.fillStyle = `rgb(${v},${v * 0.94},${v * 0.86})`; x.beginPath(); x.roundRect ? x.roundRect(px + 2, y + 2, w - 4, h - 4, 6) : x.rect(px + 2, y + 2, w - 4, h - 4); x.fill(); px += w; } y += h; } });
  // screens: a game, a sports channel, a desktop
  function screenTex(kind) {
    return ctex(512, 288, (x, W, H) => {
      if (kind === 'game') {
        const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff8a3c'); g.addColorStop(0.55, '#7a2a6a'); g.addColorStop(0.56, '#2a2a34'); g.addColorStop(1, '#141418'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(W * 0.5, H * 0.52, 46, Math.PI, 0); x.fill();
        x.fillStyle = '#0c0c10'; for (let i = 0; i < 18; i++) { const bw = 18 + rnd() * 30, bh = 30 + rnd() * 100; x.fillRect(i * 30, H * 0.56 - bh, bw, bh); }
        x.strokeStyle = '#f2f2f2'; x.lineWidth = 3; x.setLineDash([22, 18]); x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, H * 0.6); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#c4121b'; x.fillRect(W / 2 - 34, H - 70, 68, 36); x.fillStyle = '#ffd27a'; x.font = 'bold 22px sans-serif'; x.fillText('MPH 142', 18, 34);
      } else if (kind === 'sports') {
        x.fillStyle = '#2f7a3a'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 3;
        for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(40 + i * 86, 30); x.lineTo(i * 100, H); x.stroke(); }
        x.fillStyle = '#101418'; x.fillRect(16, 16, 200, 40); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('DAL 24  ·  PHI 17', 26, 44);
      } else {
        const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2a6a'); g.addColorStop(1, '#a01a5a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(30, 30, 200, 130); x.fillRect(250, 30, 220, 60); x.fillRect(250, 100, 220, 60);
        x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText('GLITCH', 44, 70);
      }
    });
  }
  TEX.scrGame = screenTex('game'); TEX.scrSports = screenTex('sports'); TEX.scrDesk = screenTex('desk');
  // a rug pattern drawn per style and colour
  function rugTex(style, c1, c2) {
    return ctex(512, 512, (x, W, H) => {
      x.fillStyle = c1; x.fillRect(0, 0, W, H);
      if (style === 0) {   // persian: borders, a medallion, little motifs
        x.strokeStyle = c2; x.lineWidth = 14; x.strokeRect(24, 24, W - 48, H - 48); x.lineWidth = 4; x.strokeRect(52, 52, W - 104, H - 104);
        x.fillStyle = c2; for (let i = 0; i < 24; i++) { const t = i / 24 * (W - 104) + 52; for (const [px, py] of [[t, 38], [t, H - 38], [38, t], [W - 38, t]]) { x.beginPath(); x.arc(px, py, 4, 0, TAU); x.fill(); } }
        x.save(); x.translate(W / 2, H / 2); for (let r = 6; r > 0; r--) { x.fillStyle = r % 2 ? c2 : c1; x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = r * 22 * (k % 2 ? 0.78 : 1); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.fill(); } x.restore();
        x.globalAlpha = 0.35; x.fillStyle = c2; for (let i = 0; i < 60; i++) { const px = 80 + rnd() * (W - 160), py = 80 + rnd() * (H - 160); if (Math.hypot(px - W / 2, py - H / 2) < 150) continue; x.fillRect(px - 5, py - 5, 10, 10); } x.globalAlpha = 1;
      } else if (style === 1) {   // shag: soft noise
        for (let i = 0; i < 16000; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.12})`; x.fillRect(rnd() * W, rnd() * H, 2, 5); }
      } else {   // geometric
        x.strokeStyle = c2; x.lineWidth = 10; for (let i = -8; i < 16; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 256, H); x.stroke(); }
        x.fillStyle = c1; x.fillRect(W * 0.3, H * 0.3, W * 0.4, H * 0.4); x.strokeRect(W * 0.3, H * 0.3, W * 0.4, H * 0.4);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Materials. A small cache so a piece rebuild doesn't pile up GPU memory.
  // ---------------------------------------------------------------------
  const MATS = new Map();
  function mat(key, make) { let m = MATS.get(key); if (!m) { m = make(); MATS.set(key, m); } return m; }
  const M = {
    fabric: c => mat('fab' + c, () => new THREE.MeshStandardMaterial({ color: col(c), map: TEX.fabric, roughness: 0.92, envMapIntensity: 0.6 })),
    velvet: c => mat('vel' + c, () => new THREE.MeshPhysicalMaterial({ color: col(c), roughness: 0.75, sheen: col('#ffffff').multiplyScalar(0.6), envMapIntensity: 0.7 })),
    leather: c => mat('lea' + c, () => new THREE.MeshStandardMaterial({ color: col(c), map: TEX.leather, roughness: 0.42, envMapIntensity: 0.9 })),
    wood: c => mat('wd' + c, () => new THREE.MeshStandardMaterial({ color: col(c), map: TEX.wood, roughness: 0.55, envMapIntensity: 0.8 })),
    gloss: c => mat('gl' + c, () => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.18, envMapIntensity: 1.1 })),
    paint: c => mat('pt' + c, () => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.5, envMapIntensity: 0.7 })),
    matte: c => mat('mt' + c, () => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.85, envMapIntensity: 0.5 })),
    metal: c => mat('me' + c, () => new THREE.MeshStandardMaterial({ color: col(c), metalness: 1, roughness: 0.28, envMapIntensity: 1.2 })),
    brushed: c => mat('br' + c, () => new THREE.MeshStandardMaterial({ color: col(c), metalness: 1, roughness: 0.45, envMapIntensity: 1 })),
    glow: c => mat('gw' + c, () => new THREE.MeshStandardMaterial({ color: col(c), emissive: col(c), emissiveIntensity: 1.6, roughness: 0.4 })),
    screen: t => mat('sc' + t.uuid, () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.0, roughness: 0.15, envMapIntensity: 0.6 })),
    stone: k => mat('st' + k, () => new THREE.MeshStandardMaterial({ map: TEX[k], roughness: k === 'carrara' || k === 'nero' ? 0.16 : k === 'granite' ? 0.25 : 0.8, envMapIntensity: k === 'concrete' ? 0.4 : 1.1 })),
    tex: (k, c = '#ffffff', r = 0.8) => mat('tx' + k + c + r, () => new THREE.MeshStandardMaterial({ color: col(c), map: TEX[k], roughness: r, envMapIntensity: 0.6 })),
    glass: (c = '#e8f4ff', o = 0.22) => mat('gs' + c + o, () => new THREE.MeshPhysicalMaterial({ color: col(c), metalness: 0, roughness: 0.04, transparent: true, opacity: o, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide })),
    water: () => mat('water', () => new THREE.MeshPhysicalMaterial({ color: col('#4fb8d8'), roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 1.6, depthWrite: false })),
    porcelain: (c = '#f6f6f4') => mat('pc' + c, () => new THREE.MeshPhysicalMaterial({ color: col(c), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 })),
    black: () => mat('blk', () => new THREE.MeshStandardMaterial({ color: col('#121214'), roughness: 0.4, envMapIntensity: 0.8 })),
    rubber: () => mat('rub', () => new THREE.MeshStandardMaterial({ color: col('#1a1a1a'), roughness: 0.9 })),
  };
  // the finishes people pick from
  const FIN = {
    wood: [['Natural oak', '#c49a68'], ['Walnut', '#7a5236'], ['Espresso', '#3a2618'], ['White oak', '#dcc8a8'], ['Ebony black', '#1c1816'], ['Cherry', '#8e3c26']],
    metal: [['Chrome', '#e8e8ec'], ['Matte black', '#2a2a2c'], ['Gold', '#f0c25a'], ['Brass', '#c8a050'], ['Brushed steel', '#b8bcc2'], ['Rose gold', '#e8a88a']],
    stone: [['Carrara marble', 'carrara'], ['Black marble', 'nero'], ['Granite', 'granite'], ['Butcher block', 'butcher'], ['Concrete', 'concrete']],
    fabric: [['Bone', '#e6dfd2'], ['Charcoal', '#34343a'], ['Navy', '#22345a'], ['Cognac', '#9a5a2e'], ['Forest', '#2f5a3a'], ['Wine', '#6a1e2a'], ['Purple', '#5a2a8a'], ['Sky', '#8ab4d8'], ['Mustard', '#c89a2a'], ['Blush', '#e0a8a8'], ['Black', '#141416'], ['Murda red', '#c41b1b']],
    accent: [['Purple', '#6b2bd1'], ['Royal blue', '#1b4fc4'], ['Murda red', '#c41b1b'], ['Gold', '#d9b21b'], ['Teal', '#1a9a9a'], ['Pink', '#e0559a'], ['Lime', '#2cff7a'], ['White', '#f2f2f2'], ['Black', '#141416'], ['Orange', '#ff7a1a']],
    appliance: [['Stainless', '#c8ccd2'], ['Black steel', '#2a2a2e'], ['White', '#f2f2f0'], ['Cherry red', '#b0161e'], ['Mint', '#9ad8c0'], ['Matte gold', '#c8a050']],
  };
  const surfMat = k => k === 'butcher' ? M.wood('#b07a48') : M.stone(k);
  const metalMat = c => (c === '#2a2a2c' ? M.paint(c) : c === '#b8bcc2' ? M.brushed(c) : M.metal(c));

  // ---------------------------------------------------------------------
  // Geometry helpers (metres; y up; the piece's front faces +z)
  // ---------------------------------------------------------------------
  let G = null;            // the group being built
  let ANIM = [];           // per-frame callbacks for the current piece
  let LIGHTS = [];         // lamps and glows that come on at night
  const _v = new THREE.Vector3();
  function put(geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent) {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
    me.castShadow = !m.transparent; me.receiveShadow = true; (parent || G).add(me); return me;
  }
  // a box with rounded edges (r) - cushions, cabinets, mattresses
  function rbox(w, h, d, r = 0.02, s = 4) {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const g = new THREE.BoxGeometry(w, h, d, s * 2, s * 2, s * 2), p = g.attributes.position, iw = w / 2 - r, ih = h / 2 - r, id = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const cx = Math.max(-iw, Math.min(iw, x)), cy = Math.max(-ih, Math.min(ih, y)), cz = Math.max(-id, Math.min(id, z));
      _v.set(x - cx, y - cy, z - cz); if (_v.lengthSq() > 0) _v.normalize().multiplyScalar(r);
      p.setXYZ(i, cx + _v.x, cy + _v.y, cz + _v.z);
    }
    g.computeVertexNormals(); return g;
  }
  // a puffy cushion: rounded box with the top and bottom bulged
  function cushion(w, h, d, r = 0.04, puff = 0.25) {
    const g = rbox(w, h, d, r, 5), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2), y = p.getY(i), k = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z); p.setY(i, y * (1 + puff * k)); }
    g.computeVertexNormals(); return g;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
  const sph = (r, s = 20) => new THREE.SphereGeometry(r, s, Math.max(8, s * 0.6 | 0));
  const tor = (R, r, s = 12, t = 32, arc = TAU) => new THREE.TorusGeometry(R, r, s, t, arc);
  function lathe(pts, s = 32) { return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s); }
  function tube(pts, r, s = 40, rs = 8, closed = false) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed), s, r, rs, closed); }
  // a 2D outline pushed out to a thickness (along z), centred on z
  function extrude(shapePts, depth, bevel = 0.004) {
    const s = new THREE.Shape(); shapePts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
    g.translate(0, 0, -depth / 2); return g;
  }
  // tapered legs at the four corners
  function legs4(w, d, h, m, inset = 0.05, r0 = 0.022, r1 = 0.016, splay = 0) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(r0, r1, h, 12), m, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), sz * splay, 0, -sx * splay);
  }
  function lamp(x, y, z, color = 0xffd8a0, power = 6, dist = 4) {
    const l = new THREE.PointLight(color, 0, dist, 2); l.position.set(x, y, z); G.add(l); LIGHTS.push({ l, power }); return l;
  }
  // a person to show the size (1.78 m, simple)
  function makePerson() {
    const g = new THREE.Group(), skin = M.matte('#8a5a3c'), cloth = M.fabric('#22345a'), dark = M.fabric('#1a1a1e');
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); };
    add(sph(0.11), skin, 0, 1.66, 0); add(rbox(0.38, 0.6, 0.22, 0.08), cloth, 0, 1.24, 0); add(rbox(0.34, 0.2, 0.22, 0.06), dark, 0, 0.88, 0);
    for (const s of [-1, 1]) { add(rbox(0.13, 0.82, 0.15, 0.05), dark, s * 0.095, 0.43, 0); add(rbox(0.09, 0.62, 0.1, 0.04), cloth, s * 0.25, 1.22, 0); add(rbox(0.11, 0.07, 0.26, 0.03), M.matte('#f2f2f2'), s * 0.095, 0.035, 0.04); }
    return g;
  }

  // ---------------------------------------------------------------------
  // The game's furniture list (js/data/homes.js FURNITURE), copied as is.
  // w × d are 2 m tiles. Each piece gets a 3D builder with styles and colours.
  // ---------------------------------------------------------------------
  const FURNITURE = [
    { id: 'bed', name: 'Queen bed', cat: 'Bedroom', w: 1, d: 1, price: 1200, comfort: 8, c: '#e8e2d8', accent: '#6b2bd1' },
    { id: 'kingbed', name: 'King bed', cat: 'Bedroom', w: 2, d: 1, price: 3800, comfort: 14, c: '#f2efe8', accent: '#1b4fc4' },
    { id: 'dresser', name: 'Dresser', cat: 'Bedroom', w: 1, d: 1, price: 450, comfort: 2, c: '#6a4a2e' },
    { id: 'closet', name: 'Walk-in closet', cat: 'Bedroom', w: 1, d: 1, price: 2200, comfort: 4, c: '#4a3a2e', accent: '#d9b21b' },
    { id: 'bunkbed', name: 'Bunk beds', cat: 'Bedroom', w: 1, d: 1, price: 900, comfort: 5, c: '#3a5a8a', accent: '#c41b1b' },
    { id: 'toilet', name: 'Toilet', cat: 'Bath', w: 1, d: 1, price: 380, comfort: 4, c: '#f4f4f4', room: 'A' },
    { id: 'shower', name: 'Shower', cat: 'Bath', w: 1, d: 1, price: 900, comfort: 4, c: '#a8d4e6', room: 'A' },
    { id: 'tub', name: 'Soaking tub', cat: 'Bath', w: 1, d: 1, price: 2400, comfort: 7, c: '#f4f4f4', accent: '#3fa9d6', room: 'A' },
    { id: 'sink', name: 'Double vanity', cat: 'Bath', w: 1, d: 1, price: 700, comfort: 2, c: '#d8d4c8', room: 'A' },
    { id: 'washer', name: 'Washer & dryer', cat: 'Bath', w: 1, d: 1, price: 1600, comfort: 3, c: '#e8ecf0', accent: '#3fa9d6' },
    { id: 'counter', name: 'Counter', cat: 'Kitchen', w: 1, d: 1, price: 600, comfort: 1, c: '#d8d4c8', room: 'K' },
    { id: 'stove', name: 'Six-burner stove', cat: 'Kitchen', w: 1, d: 1, price: 1800, comfort: 3, c: '#2a2a2e', room: 'K' },
    { id: 'fridge', name: 'Fridge', cat: 'Kitchen', w: 1, d: 1, price: 1500, comfort: 3, c: '#c8ccd2', room: 'K' },
    { id: 'island', name: 'Kitchen island', cat: 'Kitchen', w: 2, d: 1, price: 2600, comfort: 4, c: '#e9e4da', accent: '#3a3f4a', room: 'K' },
    { id: 'couch', name: 'Couch', cat: 'Living', w: 2, d: 1, price: 1400, comfort: 6, c: '#3a4a6a' },
    { id: 'sectional', name: 'Sectional', cat: 'Living', w: 2, d: 2, price: 3900, comfort: 11, c: '#2a2a2e', accent: '#c41b1b' },
    { id: 'tv', name: '85" TV', cat: 'Living', w: 1, d: 1, price: 2600, comfort: 6, c: '#111215', accent: '#3fa9d6' },
    { id: 'table', name: 'Dining table', cat: 'Living', w: 2, d: 1, price: 1600, comfort: 4, c: '#7a5a3a' },
    { id: 'rug', name: 'Rug', cat: 'Living', w: 2, d: 2, price: 500, comfort: 2, c: '#8a2a3a' },
    { id: 'plant', name: 'Plant', cat: 'Living', w: 1, d: 1, price: 90, comfort: 1, c: '#2f6b3a' },
    { id: 'lamp', name: 'Floor lamp', cat: 'Living', w: 1, d: 1, price: 160, comfort: 1, c: '#e8c21a' },
    { id: 'fireplace', name: 'Stone fireplace', cat: 'Living', w: 2, d: 1, price: 4800, comfort: 9, c: '#7a6a5a', accent: '#ff7a1a' },
    { id: 'bookshelf', name: 'Bookshelf', cat: 'Living', w: 1, d: 1, price: 700, comfort: 2, c: '#5a3a22', accent: '#c8a46a' },
    { id: 'aquarium', name: 'Shark aquarium', cat: 'Living', w: 2, d: 1, price: 12000, comfort: 10, c: '#1b4f8a', accent: '#5fd3ff' },
    { id: 'desk', name: 'Gaming desk', cat: 'Fun', w: 1, d: 1, price: 1900, comfort: 4, c: '#1a1c22', accent: '#ff1a2e' },
    { id: 'pool', name: 'Pool table', cat: 'Fun', w: 2, d: 1, price: 4200, comfort: 7, c: '#1f6b3a', accent: '#6a4a2e' },
    { id: 'arcade', name: 'Arcade cabinet', cat: 'Fun', w: 1, d: 1, price: 2800, comfort: 5, c: '#2a1a4a', accent: '#2cff7a' },
    { id: 'bar', name: 'Home bar', cat: 'Fun', w: 2, d: 1, price: 5200, comfort: 8, c: '#3a2418', accent: '#d9b21b' },
    { id: 'trophy', name: 'Trophy case', cat: 'Fun', w: 1, d: 1, price: 1500, comfort: 3, c: '#4a3a2e', accent: '#e8c21a' },
    { id: 'safe', name: 'Floor safe', cat: 'Fun', w: 1, d: 1, price: 3500, comfort: 2, c: '#3a3d42' },
    { id: 'piano', name: 'Grand piano', cat: 'Fun', w: 2, d: 2, price: 18000, comfort: 10, c: '#111215', accent: '#f2f2f2' },
    { id: 'gym', name: 'Home gym', cat: 'Fun', w: 2, d: 1, price: 6500, comfort: 7, c: '#2a2a2e', accent: '#c41b1b' },
    { id: 'wine', name: 'Wine wall', cat: 'Fun', w: 1, d: 1, price: 3800, comfort: 4, c: '#3a2418', accent: '#8a1a2a' },
    { id: 'grill', name: 'Smoker grill', cat: 'Outdoor', w: 1, d: 1, price: 1100, comfort: 4, c: '#1a1a1a', room: 'P' },
    { id: 'jacuzzi', name: 'Hot tub', cat: 'Outdoor', w: 2, d: 2, price: 9800, comfort: 12, c: '#d8d4c8', accent: '#3fa9d6', room: 'P' },
    { id: 'chairs', name: 'Patio chairs', cat: 'Outdoor', w: 1, d: 1, price: 300, comfort: 2, c: '#6a4a2e', room: 'P' },
    { id: 'firepit', name: 'Fire pit', cat: 'Outdoor', w: 1, d: 1, price: 1300, comfort: 4, c: '#5a5a5e', accent: '#ff7a1a', room: 'P' },
    { id: 'stairs', name: 'Staircase', cat: 'Stairs', w: 1, d: 2, price: 3200, comfort: 0, c: '#6a4a2e' },
    { id: 'spiral', name: 'Spiral staircase', cat: 'Stairs', w: 1, d: 1, price: 6800, comfort: 2, c: '#3a3d42' },
    { id: 'elevator', name: 'Home elevator', cat: 'Stairs', w: 1, d: 1, price: 38000, comfort: 4, c: '#9aa0a8' },
  ];
  const FURN_BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
  const CATS = ['Bedroom', 'Bath', 'Kitchen', 'Living', 'Fun', 'Outdoor', 'Stairs'];
  const CAT_ROOM = { Bedroom: 'B', Bath: 'A', Kitchen: 'K', Living: 'L', Fun: 'G', Outdoor: 'P', Stairs: 'H' };
  const ROOM_FLOOR = { L: '#8a6a4a', K: '#c9c3b4', D: '#7a5a3e', B: '#6b5b7a', A: '#b8d0d8', O: '#5a6a5a', G: '#3a3f5a', H: '#9a8a72', P: '#8a6038' };

  // DEF[id] = { styles: [names], colors: [[key, label, list, default]], build(o, W, D) }
  const DEF = {};
  const C = (key, label, list, def) => [key, label, list, def];
  const nearest = (list, hex) => { let best = list[0][1], bd = 1e9; const a = new THREE.Color(hex); for (const [, v] of list) { if (!v.startsWith('#')) continue; const b = new THREE.Color(v), d = (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2; if (d < bd) { bd = d; best = v; } } return best; };

  // ---------- Bedroom ----------
  function bedFrame(o, bw, bl, D) {   // bw wide, bl long; headboard against the back of the footprint
    const back = -D / 2 + 0.06, cz = back + bl / 2 + 0.05, wd = M.wood(o.wood), st = o.style;
    const frameM = st === 1 ? M.velvet(o.accent) : wd;
    const baseH = st === 1 ? 0.34 : 0.26;
    if (st === 2) {   // four posts and a canopy
      put(rbox(bw + 0.08, 0.2, bl + 0.06, 0.02), wd, 0, 0.22, cz);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(0.035, 0.04, 2.1, 14), wd, sx * (bw / 2 + 0.02), 1.05, cz + sz * (bl / 2 + 0.01));
      for (const sz of [-1, 1]) put(box(bw + 0.1, 0.06, 0.06), wd, 0, 2.08, cz + sz * (bl / 2 + 0.01));
      for (const sx of [-1, 1]) put(box(0.06, 0.06, bl + 0.08), wd, sx * (bw / 2 + 0.02), 2.08, cz);
      const drape = M.fabric(o.accent);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const g = cyl(0.09, 0.16, 1.9, 16, true); put(g, drape, sx * (bw / 2 + 0.02), 1.08, cz + sz * (bl / 2 + 0.01)); }
      put(rbox(0.06, 1.1, bw + 0.02, 0.02), wd, 0, 0.85, back + 0.03, 0, Math.PI / 2, 0);
    } else {
      put(rbox(bw + 0.1, baseH, bl + 0.08, st === 1 ? 0.04 : 0.015), frameM, 0, 0.08 + baseH / 2, cz);
      if (st === 0) { put(box(bw + 0.24, 0.05, bl + 0.22), wd, 0, 0.06, cz); put(box(bw - 0.1, 0.06, bl - 0.2), M.black(), 0, 0.03, cz); }
      else for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(0.025, 0.02, 0.08, 10), M.metal('#f0c25a'), sx * (bw / 2 - 0.05), 0.04, cz + sz * (bl / 2 - 0.05));
      // headboard
      if (st === 1) {   // tall tufted wingback
        const hb = put(cushion(bw + 0.24, 1.25, 0.14, 0.06, 0.04), frameM, 0, 0.98, back + 0.07);
        const btn = M.metal('#f0c25a'); for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) put(sph(0.012, 8), btn, (c - 3 + (r % 2) * 0.5) * (bw / 7.5), 0.62 + r * 0.24, back + 0.15);
        for (const sx of [-1, 1]) put(cushion(0.16, 1.2, 0.3, 0.06, 0.05), frameM, sx * (bw / 2 + 0.16), 0.95, back + 0.17, 0, sx * 0.35, 0);
      } else put(rbox(bw + 0.12, 0.95, 0.07, 0.015), wd, 0, 0.6, back + 0.035);
    }
    const top = st === 1 ? 0.42 : st === 2 ? 0.32 : 0.34;
    // mattress, duvet, pillows, a throw across the foot
    put(rbox(bw, 0.26, bl, 0.05), M.fabric('#f2efe8'), 0, top + 0.13, cz);
    put(cushion(bw + 0.04, 0.09, bl * 0.72, 0.04, 0.4), M.fabric(o.main), 0, top + 0.29, cz + bl * 0.14);
    put(rbox(bw * 0.98, 0.04, 0.32, 0.02), M.fabric(o.main), 0, top + 0.27, cz + bl * 0.14 - bl * 0.36 + 0.1, 0.25, 0, 0);
    put(cushion(bw + 0.06, 0.07, 0.42, 0.03, 0.3), M.fabric(o.accent), 0, top + 0.33, cz + bl / 2 - 0.3);
    const n = bw > 1.7 ? 3 : 2;
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * (bw / n); put(cushion(bw / n - 0.06, 0.13, 0.36, 0.06, 0.6), M.fabric('#fbfaf7'), x, top + 0.34, back + 0.36, -0.5, 0, 0); put(cushion(bw / n - 0.18, 0.11, 0.28, 0.05, 0.6), M.fabric(o.accent), x, top + 0.36, back + 0.52, -0.35, 0, 0); }
    // nightstands with lamps
    for (const sx of [-1, 1]) {
      const x = sx * (bw / 2 + (st === 1 ? 0.55 : 0.4));
      if (Math.abs(x) + 0.25 > (D * (bw > 1.7 ? 2 : 1)) / 2 + 0.01 && bw < 1.7) continue;
      put(rbox(0.46, 0.52, 0.4, 0.01), wd, x, 0.32, back + 0.24); put(box(0.4, 0.004, 0.005), M.metal('#f0c25a'), x, 0.36, back + 0.442);
      for (const sz of [-1, 1]) for (const sx2 of [-1, 1]) put(cyl(0.012, 0.01, 0.06, 8), M.metal('#2a2a2c'), x + sx2 * 0.2, 0.03, back + 0.24 + sz * 0.16);
      put(lathe([[0, 0], [0.07, 0], [0.08, 0.1], [0.04, 0.2], [0.012, 0.22], [0.012, 0.3]]), M.porcelain('#e8e2d8'), x, 0.58, back + 0.24);
      put(cyl(0.09, 0.13, 0.16, 20, true), M.glow('#fff3d6'), x, 0.96, back + 0.24); lamp(x, 0.95, back + 0.3, 0xffd8a0, 3, 3);
    }
  }
  DEF.bed = { styles: ['Platform', 'Tufted wingback', 'Four-poster canopy'], colors: [C('main', 'Bedding', FIN.fabric, '#e6dfd2'), C('accent', 'Accent', FIN.fabric, '#5a2a8a'), C('wood', 'Wood', FIN.wood, '#7a5236')],
    build: (o, W, D) => bedFrame(o, 1.52, 2.0, D) };
  DEF.kingbed = { styles: ['Platform', 'Tufted wingback', 'Four-poster canopy'], colors: [C('main', 'Bedding', FIN.fabric, '#e6dfd2'), C('accent', 'Accent', FIN.fabric, '#22345a'), C('wood', 'Wood', FIN.wood, '#3a2618')],
    build: (o, W, D) => bedFrame(o, 1.93, 2.03, D) };

  DEF.dresser = { styles: ['Six drawer', 'Tall chest', 'With mirror'], colors: [C('wood', 'Wood', FIN.wood, '#7a5236'), C('metal', 'Handles', FIN.metal, '#f0c25a')],
    build(o, W, D) {
      const wd = M.wood(o.wood), hm = metalMat(o.metal), st = o.style;
      const w = st === 1 ? 0.9 : 1.5, h = st === 1 ? 1.3 : 0.82, d = 0.5, rows = st === 1 ? 5 : 3, cols = st === 1 ? 1 : 2, z = -D / 2 + d / 2 + 0.04;
      put(rbox(w, h, d, 0.012), wd, 0, 0.1 + h / 2, z);
      put(rbox(w + 0.03, 0.03, d + 0.03, 0.01), wd, 0, 0.1 + h + 0.015, z);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(0.02, 0.014, 0.1, 10), wd, sx * (w / 2 - 0.05), 0.05, z + sz * (d / 2 - 0.05));
      const dh = (h - 0.06) / rows, dw = (w - 0.06) / cols;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * dw, y = 0.13 + dh * (r + 0.5);
        put(rbox(dw - 0.02, dh - 0.02, 0.02, 0.006), wd, x, y, z + d / 2 + 0.006);
        put(cyl(0.008, 0.008, Math.min(0.16, dw * 0.3), 8), hm, x, y, z + d / 2 + 0.03, 0, 0, Math.PI / 2);
        for (const s of [-1, 1]) put(cyl(0.006, 0.006, 0.02, 6), hm, x + s * Math.min(0.07, dw * 0.13), y, z + d / 2 + 0.02, Math.PI / 2, 0, 0);
      }
      if (st === 2) {
        put(rbox(1.0, 0.9, 0.04, 0.02), wd, 0, 1.4, z - d / 2 + 0.04);
        put(box(0.88, 0.78, 0.006), M.metal('#dfe6ec'), 0, 1.4, z - d / 2 + 0.065);
      }
      // a few things on top
      const ty = 0.1 + h + 0.03;
      put(cyl(0.05, 0.05, 0.12, 16), M.porcelain('#2a2a2e'), -w / 2 + 0.15, ty + 0.06, z);
      put(rbox(0.22, 0.03, 0.15, 0.005), M.leather('#5a3a22'), w / 2 - 0.2, ty + 0.015, z);
      put(cyl(0.035, 0.035, 0.03, 20), M.metal('#e8e8ec'), w / 2 - 0.2, ty + 0.045, z);
    } };

  DEF.closet = { styles: ['Open shelves', 'Glass doors', 'Sneaker wall'], colors: [C('wood', 'Wood', FIN.wood, '#3a2618'), C('accent', 'Lights', FIN.accent, '#d9b21b'), C('main', 'Clothes', FIN.fabric, '#34343a')],
    build(o, W, D) {
      const wd = M.wood(o.wood), st = o.style, w = 1.9, h = 2.3, d = 0.6, z = -D / 2 + d / 2 + 0.02;
      put(box(w, h, 0.03), wd, 0, h / 2, z - d / 2 + 0.015);
      for (const x of [-w / 2, -w / 6, w / 6, w / 2]) put(box(0.03, h, d), wd, x, h / 2, z);
      put(box(w + 0.03, 0.04, d), wd, 0, h + 0.02, z); put(box(w, 0.08, d), wd, 0, 0.04, z);
      const led = M.glow(o.accent);
      for (const x of [-w / 3, 0, w / 3]) put(box(w / 3 - 0.06, 0.012, 0.012), led, x, h - 0.02, z + d / 2 - 0.04);
      lamp(0, h - 0.2, z + 0.4, new THREE.Color(o.accent).getHex(), 4, 3);
      const clothes = ['#141416', '#e6dfd2', o.main, '#22345a', '#9a5a2e', '#c41b1b', '#6a6a70'];
      const hang = (x0, x1, y) => {   // a rail of hanging shirts and jackets
        put(cyl(0.012, 0.012, x1 - x0, 10), M.metal('#e8e8ec'), (x0 + x1) / 2, y, z, 0, 0, Math.PI / 2);
        const n = Math.floor((x1 - x0) / 0.06);
        for (let i = 0; i < n; i++) { const x = x0 + 0.04 + i * (x1 - x0 - 0.08) / (n - 1), c = clothes[(i * 3 + Math.floor(y * 10)) % clothes.length], L = 0.6 + hash(i + y) * 0.35; put(rbox(0.035, L, 0.44, 0.015), M.fabric(c), x, y - L / 2 - 0.03, z + 0.02, 0, 0, (hash(i * 7) - 0.5) * 0.05); put(tor(0.03, 0.004, 4, 10, Math.PI), M.metal('#c8c8cc'), x, y + 0.02, z, 0, Math.PI / 2, 0); }
      };
      if (st === 2) {   // a wall of sneakers on lit shelves
        for (let r = 0; r < 8; r++) { const y = 0.25 + r * 0.26; for (const cx of [-w / 3, 0, w / 3]) { put(box(w / 3 - 0.04, 0.015, d - 0.06), M.glass('#ffffff', 0.35), cx, y, z); for (let k = 0; k < 3; k++) { const x = cx + (k - 1) * 0.19, sc = ['#f2f2f2', '#c41b1b', '#141416', '#1b4fc4', '#e8c21a', '#2f6b3a'][(r * 3 + k + (cx > 0 ? 2 : 0)) % 6]; put(rbox(0.1, 0.07, 0.27, 0.035), M.leather(sc), x, y + 0.045, z + 0.02); put(box(0.105, 0.022, 0.28), M.matte(sc === '#f2f2f2' ? '#c41b1b' : '#f2f2f2'), x, y + 0.019, z + 0.02); } } }
      } else {
        hang(-w / 2 + 0.02, -w / 6 - 0.02, 2.05); hang(-w / 2 + 0.02, -w / 6 - 0.02, 1.05);
        hang(w / 6 + 0.02, w / 2 - 0.02, 2.05);
        for (let r = 0; r < 5; r++) { const y = 0.35 + r * 0.38; put(box(w / 3 - 0.04, 0.025, d - 0.04), wd, 0, y, z); for (let k = 0; k < 3; k++) put(rbox(0.16, 0.05 + hash(r * 3 + k) * 0.08, 0.3, 0.01), M.fabric(clothes[(r + k) % clothes.length]), (k - 1) * 0.18, y + 0.06, z + 0.04); }
        for (let r = 0; r < 3; r++) { const y = 0.16 + r * 0.22; put(box(w / 3 - 0.06, 0.02, d - 0.06), wd, w / 3, y, z, 0.18, 0, 0); for (let k = 0; k < 2; k++) put(rbox(0.1, 0.07, 0.27, 0.035), M.leather(k ? '#141416' : '#f2f2f2'), w / 3 + (k - 0.5) * 0.22, y + 0.05, z + 0.03, 0.18, 0, 0); }
        if (st === 1) for (const x of [-w / 3, w / 3]) { put(box(w / 3 - 0.04, h - 0.14, 0.012), M.glass('#d8e8f0', 0.18), x, h / 2 + 0.02, z + d / 2 + 0.01); put(box(0.02, 0.4, 0.02), M.metal(o.accent === '#d9b21b' ? '#f0c25a' : '#e8e8ec'), x + (x < 0 ? 1 : -1) * (w / 6 - 0.06), 1.1, z + d / 2 + 0.035); }
      }
      // an ottoman in the middle
      put(cushion(0.7, 0.4, 0.5, 0.06, 0.08), M.velvet(o.accent === '#d9b21b' ? '#e6dfd2' : o.accent), 0, 0.22, z + d / 2 + 0.5);
    } };

  DEF.bunkbed = { styles: ['Wood', 'Metal', 'Twin over full'], colors: [C('wood', 'Frame', FIN.wood, '#c49a68'), C('main', 'Top bunk', FIN.fabric, '#22345a'), C('accent', 'Bottom bunk', FIN.fabric, '#c41b1b')],
    build(o, W, D) {
      const st = o.style, fm = st === 1 ? M.paint(nearest(FIN.fabric, o.wood) === '#141416' ? '#141416' : '#2a2a2c') : M.wood(o.wood);
      const w = 1.0, l = 1.98, bw = st === 2 ? 1.4 : w, z = -D / 2 + l / 2 + 0.03, x0 = 0;
      const post = st === 1 ? (h) => cyl(0.025, 0.025, h, 12) : (h) => rbox(0.07, h, 0.07, 0.01);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(post(1.75), fm, x0 + sx * (bw / 2 + 0.03), 0.875, z + sz * (l / 2 + 0.03));
      const deck = (y, ww, c) => { put(rbox(ww + 0.06, 0.12, l + 0.06, 0.01), fm, x0, y, z); put(rbox(ww, 0.18, l, 0.04), M.fabric('#f2efe8'), x0, y + 0.15, z); put(cushion(ww + 0.02, 0.06, l * 0.7, 0.03, 0.4), M.fabric(c), x0, y + 0.26, z + l * 0.14); put(cushion(ww * 0.6, 0.11, 0.32, 0.05, 0.6), M.fabric('#fbfaf7'), x0, y + 0.3, z - l / 2 + 0.25, -0.4, 0, 0); };
      deck(0.25, bw, o.accent); deck(1.25, w, o.main);
      // rails and a ladder
      put(st === 1 ? cyl(0.018, 0.018, l, 10) : box(0.04, 0.12, l), fm, x0 - (bw / 2 + 0.03), 1.62, z, st === 1 ? Math.PI / 2 : 0, 0, 0);
      put(st === 1 ? cyl(0.018, 0.018, l * 0.6, 10) : box(0.04, 0.12, l * 0.6), fm, x0 + w / 2 + 0.03, 1.62, z - l * 0.2, st === 1 ? Math.PI / 2 : 0, 0, 0);
      put(box(0.04, 0.12, bw + 0.06), fm, x0, 1.62, z - l / 2 - 0.03, 0, Math.PI / 2, 0);
      const lx = x0 + w / 2 + 0.03, lz = z + l / 2 - 0.35;
      for (const s of [-1, 1]) put(st === 1 ? cyl(0.016, 0.016, 1.75, 8) : box(0.04, 1.75, 0.05), fm, lx + 0.06, 0.875, lz + s * 0.2);
      for (let i = 0; i < 5; i++) put(cyl(0.015, 0.015, 0.4, 8), fm, lx + 0.06, 0.3 + i * 0.28, lz, Math.PI / 2, 0, 0);
    } };

  // ---------- Bath ----------
  DEF.toilet = { styles: ['Classic', 'Wall-hung', 'Gold throne'], colors: [C('main', 'Porcelain', [['White', '#f6f6f4'], ['Bone', '#ece4d4'], ['Black', '#1a1a1c'], ['Matte grey', '#8a8c90']], '#f6f6f4'), C('metal', 'Flush', FIN.metal, '#e8e8ec')],
    build(o, W, D) {
      const st = o.style, pm = st === 2 ? M.metal('#f0c25a') : M.porcelain(o.main), z0 = -D / 2 + 0.02, seat = st === 2 ? M.velvet('#6a1e2a') : pm;
      if (st === 1) { put(rbox(0.44, 0.56, 0.12, 0.03), M.porcelain('#e8e8e8'), 0, 0.82, z0 + 0.06); put(rbox(0.14, 0.09, 0.012, 0.01), metalMat(o.metal), 0, 1.0, z0 + 0.125); }
      else { put(rbox(0.44, 0.38, 0.2, 0.04), pm, 0, 0.62, z0 + 0.12); put(rbox(0.47, 0.04, 0.23, 0.02), pm, 0, 0.83, z0 + 0.12); put(cyl(0.012, 0.012, 0.06, 10), metalMat(o.metal), 0.15, 0.86, z0 + 0.12); }
      const bz = z0 + 0.42, by = st === 1 ? 0.42 : 0.38;
      const bowl = lathe([[0, 0], [0.1, 0], [0.13, 0.12], [0.2, by - 0.04], [0.2, by], [0.17, by], [0.12, by - 0.12], [0.02, by - 0.18]]);
      const bm = put(bowl, pm, 0, st === 1 ? 0.0 : 0, bz); bm.scale.set(1, 1, 1.25);
      if (st === 1) bm.position.y = 0.0;
      if (st !== 1) put(rbox(0.22, 0.3, 0.3, 0.06), pm, 0, 0.15, bz - 0.12);
      const sg = tor(0.17, 0.025, 10, 32); const s = put(sg, seat, 0, by + 0.02, bz, Math.PI / 2, 0, 0); s.scale.set(1, 1.25, 0.7);
      const lid = put(cyl(0.19, 0.19, 0.02, 32), seat, 0, by + 0.25, z0 + 0.25, Math.PI / 2 - 0.1, 0, 0); lid.scale.set(1, 1, 1.25);
      if (st === 2) { put(rbox(0.8, 0.1, 0.8, 0.02), M.stone('nero'), 0, 0.05, z0 + 0.45); put(cyl(0.3, 0.3, 0.004, 32), M.velvet('#6a1e2a'), 0, 0.1, z0 + 0.5); }
      // paper on the wall
      put(cyl(0.055, 0.055, 0.11, 18), M.fabric('#ffffff'), 0.42, 0.72, z0 + 0.12, 0, 0, Math.PI / 2); put(cyl(0.006, 0.006, 0.16, 8), metalMat(o.metal), 0.42, 0.72, z0 + 0.12, 0, 0, Math.PI / 2);
    } };

  DEF.shower = { styles: ['Glass box', 'Walk-in tile', 'Rain stone'], colors: [C('stone', 'Walls', [['White tile', 'tile'], ['Carrara marble', 'carrara'], ['Black marble', 'nero'], ['Concrete', 'concrete'], ['Stone', 'stone']], 'tile'), C('metal', 'Fixtures', FIN.metal, '#2a2a2c')],
    build(o, W, D) {
      const st = o.style, wm = o.stone === 'tile' ? M.tex('tile', '#eef2f4', 0.2) : o.stone === 'stone' ? M.tex('stone', '#ffffff', 0.7) : M.stone(o.stone), fm = metalMat(o.metal);
      const w = 1.5, d = 1.3, z = -D / 2 + d / 2 + 0.02, h = 2.3;
      put(box(w, h, 0.06), wm, 0, h / 2, z - d / 2); put(box(0.06, h, d), wm, -w / 2, h / 2, z);
      put(rbox(w, 0.08, d, 0.01), st === 2 ? M.stone('nero') : M.tex('tile', '#d8dcde', 0.4), 0, 0.04, z);
      put(box(0.12, 0.004, 0.12), fm, 0, 0.082, z + 0.1);
      if (st !== 1) { put(box(0.012, h - 0.2, d), M.glass(), w / 2 - 0.01, h / 2, z); put(box(w - 0.6, h - 0.2, 0.012), M.glass(), 0.3, h / 2, z + d / 2); put(box(0.02, h - 0.2, 0.025), fm, w / 2, h / 2, z + d / 2); put(box(0.02, 0.3, 0.02), fm, 0.0, 1.1, z + d / 2 + 0.03); }
      else put(box(0.012, h - 0.2, d * 0.6), M.glass(), w / 2 - 0.01, h / 2, z - d * 0.2);
      // head, arm, handle
      const big = st === 2;
      put(cyl(0.015, 0.015, big ? 0.3 : 0.42, 10), fm, 0, 2.05, z - d / 2 + (big ? 0.0 : 0.2), big ? 0 : Math.PI / 2, 0, 0);
      if (big) put(cyl(0.2, 0.2, 0.012, 32), fm, 0, 1.9, z - d / 2 + 0.3);
      else put(cyl(0.09, 0.07, 0.03, 24), fm, 0, 2.02, z - d / 2 + 0.4);
      put(cyl(0.05, 0.05, 0.02, 20), fm, 0, 1.15, z - d / 2 + 0.04, Math.PI / 2, 0, 0); put(box(0.1, 0.015, 0.02), fm, 0.03, 1.15, z - d / 2 + 0.07);
      // a niche with bottles
      put(box(0.36, 0.3, 0.06), M.matte('#2a2a2c'), -0.35, 1.25, z - d / 2 + 0.04);
      for (let i = 0; i < 3; i++) put(rbox(0.06, 0.2 - i * 0.03, 0.05, 0.02), M.gloss(['#e6dfd2', '#2f5a3a', '#141416'][i]), -0.46 + i * 0.1, 1.2 - i * 0.015, z - d / 2 + 0.08);
      if (st === 2) put(rbox(0.6, 0.42, 0.3, 0.02), M.wood('#c49a68'), -w / 2 + 0.36, 0.29, z + 0.25);
    } };

  DEF.tub = { styles: ['Freestanding', 'Clawfoot', 'Jetted corner'], colors: [C('main', 'Tub', [['White', '#f6f6f4'], ['Black', '#1a1a1c'], ['Sage', '#9ab0a0'], ['Blush', '#e8c0b8']], '#f6f6f4'), C('metal', 'Faucet', FIN.metal, '#f0c25a'), C('accent', 'Water light', FIN.accent, '#1a9a9a')],
    build(o, W, D) {
      const st = o.style, pm = M.porcelain(o.main), fm = metalMat(o.metal), z = -D / 2 + 0.55;
      let water;
      if (st === 2) {
        const sh = []; const R = 1.5; sh.push([0, 0]); for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI / 2; sh.push([R * Math.cos(a), R * Math.sin(a)]); }
        const g = extrude(sh.map(([x, y]) => [x, y]), 0.55, 0.02); const m = put(g, M.tex('tile', '#e8eef0', 0.3), -0.85, 0.275, -D / 2 + 0.05, Math.PI / 2, 0, 0);
        const inner = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI / 2; inner.push([0.12 + 1.22 * Math.cos(a), 0.12 + 1.22 * Math.sin(a)]); } inner.push([0.12, 0.12]);
        water = put(extrude(inner, 0.02, 0), M.water(), -0.85, 0.5, -D / 2 + 0.05, Math.PI / 2, 0, 0);
        for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI / 2; put(cyl(0.025, 0.025, 0.01, 12), M.glow(o.accent), -0.85 + 1.0 * Math.cos(a), 0.36, -D / 2 + 0.05 + 1.0 * Math.sin(a)); }
        lamp(-0.3, 0.5, -D / 2 + 0.6, new THREE.Color(o.accent).getHex(), 2, 2);
        put(cyl(0.02, 0.02, 0.2, 10), fm, -0.8, 0.65, -D / 2 + 0.12); put(cyl(0.015, 0.015, 0.16, 10), fm, -0.8, 0.74, -D / 2 + 0.2, Math.PI / 2, 0, 0);
      } else {
        const L = 1.7, Wt = 0.8, H = st === 1 ? 0.62 : 0.6;
        const outer = []; for (let k = 0; k <= 10; k++) { const t = k / 10; outer.push([Wt / 2 * (0.82 + 0.18 * Math.sin(t * Math.PI / 2)) * (st === 1 ? 1 : 1), t * H]); }
        const prof = st === 1 ? [[0, 0.12], [0.3, 0.12], [0.38, 0.3], [0.4, H], [0.37, H], [0.34, 0.3], [0.0, 0.18]] : [[0, 0], [0.32, 0], [0.38, 0.12], [0.4, H], [0.37, H], [0.34, 0.14], [0, 0.08]];
        const g = lathe(prof, 40); const tubM = put(g, pm, 0, 0, z + 0.25); tubM.scale.set(1, 1, L / 0.8);
        water = put(new THREE.CircleGeometry(0.355, 40), M.water(), 0, H - 0.1, z + 0.25, -Math.PI / 2, 0, 0); water.scale.set(1, L / 0.8, 1);
        if (st === 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { put(sph(0.04, 12), fm, sx * 0.28, 0.05, z + 0.25 + sz * 0.7); put(cyl(0.02, 0.035, 0.1, 10), fm, sx * 0.28, 0.1, z + 0.25 + sz * 0.7); }
        // floor-standing filler
        put(cyl(0.022, 0.022, 0.95, 12), fm, 0.5, 0.475, z - 0.45); put(tube([[0.5, 0.95, z - 0.45], [0.5, 1.02, z - 0.4], [0.5, 0.98, z - 0.3], [0.48, 0.9, z - 0.27]], 0.018, 20, 8), fm);
        put(cyl(0.03, 0.03, 0.02, 12), fm, 0.5, 0.82, z - 0.45, 0, 0, Math.PI / 2);
        // a tray with a candle and a towel
        put(rbox(0.7, 0.02, 0.22, 0.01), M.wood('#7a5236'), 0, H + 0.01, z + 0.15); put(cyl(0.035, 0.035, 0.08, 16), M.matte('#efe6d6'), 0.15, H + 0.06, z + 0.15); put(sph(0.012, 8), M.glow('#ffb04a'), 0.15, H + 0.115, z + 0.15);
        lamp(0.15, H + 0.2, z + 0.15, 0xffa040, 1.2, 2);
        put(rbox(0.5, 0.06, 0.35, 0.03), M.fabric('#e6dfd2'), -0.55, 0.03, z + 1.0);
      }
      ANIM.push(t => { water.position.y += Math.sin(t * 2) * 0.00004; });
    } };

  DEF.sink = { styles: ['Floating', 'Classic cabinet', 'Vessel bowls'], colors: [C('wood', 'Cabinet', [...FIN.wood, ['White', '#f2f2f0'], ['Navy', '#22345a'], ['Sage', '#8aa090']], '#7a5236'), C('stone', 'Top', FIN.stone.filter(s => s[1] !== 'butcher'), 'carrara'), C('metal', 'Faucets', FIN.metal, '#f0c25a')],
    build(o, W, D) {
      const st = o.style, cab = o.wood.startsWith('#f2') || o.wood === '#22345a' || o.wood === '#8aa090' ? M.paint(o.wood) : M.wood(o.wood), fm = metalMat(o.metal), w = 1.6, d = 0.55, z = -D / 2 + d / 2 + 0.02;
      const y0 = st === 0 ? 0.32 : 0.1, h = st === 0 ? 0.5 : 0.75;
      put(rbox(w, h, d, 0.01), cab, 0, y0 + h / 2, z);
      if (st === 1) put(box(w - 0.02, 0.1, d - 0.04), cab, 0, 0.05, z - 0.01);
      const dw = w / (st === 1 ? 4 : 2);
      for (let i = 0; i < (st === 1 ? 4 : 2); i++) { const x = -w / 2 + dw * (i + 0.5); put(rbox(dw - 0.02, h - 0.03, 0.02, 0.005), cab, x, y0 + h / 2, z + d / 2 + 0.005); put(box(Math.min(0.2, dw * 0.4), 0.012, 0.015), fm, x, y0 + h - 0.08, z + d / 2 + 0.025); }
      const tY = y0 + h + 0.02; put(rbox(w + 0.02, 0.04, d + 0.02, 0.006), M.stone(o.stone), 0, tY, z);
      for (const s of [-1, 1]) {
        const x = s * 0.4;
        if (st === 2) { put(lathe([[0, 0], [0.12, 0.0], [0.19, 0.08], [0.2, 0.14], [0.19, 0.14], [0.17, 0.09], [0, 0.03]], 32), M.porcelain('#f6f6f4'), x, tY + 0.02, z + 0.02); put(cyl(0.015, 0.015, 0.32, 10), fm, x, tY + 0.18, z - d / 2 + 0.08); put(cyl(0.012, 0.012, 0.16, 10), fm, x, tY + 0.33, z - d / 2 + 0.15, Math.PI / 2, 0, 0); }
        else { put(rbox(0.42, 0.02, 0.32, 0.06), M.porcelain('#e0e0dc'), x, tY + 0.012, z + 0.03); put(cyl(0.014, 0.014, 0.24, 10), fm, x, tY + 0.13, z - d / 2 + 0.08); put(tube([[x, tY + 0.25, z - d / 2 + 0.08], [x, tY + 0.3, z - d / 2 + 0.12], [x, tY + 0.27, z - d / 2 + 0.2]], 0.012, 16, 8), fm); for (const t of [-1, 1]) put(cyl(0.012, 0.012, 0.04, 10), fm, x + t * 0.08, tY + 0.04, z - d / 2 + 0.08); }
        // round mirrors with a glow ring
        put(cyl(0.34, 0.34, 0.02, 40), fm, x, 1.65, -D / 2 + 0.03, Math.PI / 2, 0, 0); put(cyl(0.32, 0.32, 0.006, 40), M.metal('#dfe6ec'), x, 1.65, -D / 2 + 0.045, Math.PI / 2, 0, 0);
        put(tor(0.345, 0.008, 8, 48), M.glow('#fff1d8'), x, 1.65, -D / 2 + 0.035); lamp(x, 1.65, -D / 2 + 0.3, 0xffe8c8, 1.5, 2.5);
      }
      put(rbox(0.07, 0.17, 0.07, 0.03), M.gloss('#2a2a2e'), 0, tY + 0.105, z - 0.1); put(rbox(0.12, 0.05, 0.1, 0.01), M.wood('#c49a68'), 0.12, tY + 0.045, z - 0.12);
    } };

  DEF.washer = { styles: ['Side by side', 'Stacked', 'Laundry nook'], colors: [C('main', 'Machines', FIN.appliance, '#f2f2f0'), C('accent', 'Display', FIN.accent, '#1a9a9a'), C('wood', 'Shelf', FIN.wood, '#c49a68')],
    build(o, W, D) {
      const st = o.style, am = o.main === '#c8ccd2' ? M.brushed(o.main) : M.gloss(o.main), z = -D / 2 + 0.36, glow = M.glow(o.accent);
      const unit = (x, y, dryer) => {
        put(rbox(0.68, 0.85, 0.7, 0.03), am, x, y + 0.425, z);
        put(rbox(0.64, 0.12, 0.02, 0.01), M.black(), x, y + 0.77, z + 0.351); put(box(0.14, 0.04, 0.005), glow, x + 0.12, y + 0.77, z + 0.362); put(cyl(0.035, 0.035, 0.03, 20), M.metal('#e8e8ec'), x - 0.17, y + 0.77, z + 0.37, Math.PI / 2, 0, 0);
        put(tor(0.2, 0.035, 12, 40), dryer ? am : M.metal('#c8ccd2'), x, y + 0.38, z + 0.36); put(cyl(0.19, 0.19, 0.02, 36), M.glass('#9ab0c0', 0.45), x, y + 0.38, z + 0.36, Math.PI / 2, 0, 0);
        put(cyl(0.17, 0.17, 0.01, 36), M.fabric(dryer ? '#e6dfd2' : '#22345a'), x, y + 0.38, z + 0.33, Math.PI / 2, 0, 0);
      };
      if (st === 1) { unit(0, 0, false); unit(0, 0.86, true); }
      else { unit(-0.36, 0, false); unit(0.36, 0, true); }
      if (st === 2) { put(rbox(1.5, 0.04, 0.72, 0.01), M.wood(o.wood), 0, 0.9, z); put(box(1.5, 0.03, 0.3), M.wood(o.wood), 0, 1.55, -D / 2 + 0.15); put(rbox(0.36, 0.26, 0.28, 0.02), M.fabric('#c8b898'), -0.45, 1.06, z - 0.1); put(rbox(0.3, 0.1, 0.26, 0.04), M.fabric('#f2efe8'), 0.2, 0.97, z); for (let i = 0; i < 3; i++) put(rbox(0.12, 0.25, 0.08, 0.03), M.gloss(['#1b4fc4', '#e8c21a', '#f2f2f2'][i]), -0.5 + i * 0.2, 1.695, -D / 2 + 0.15); }
    } };

  // ---------- Kitchen ----------
  const cabMat = c => (['#f2f2f0', '#22345a', '#8aa090', '#2a2a2c'].includes(c) ? M.paint(c) : M.wood(c));
  const CAB = [...FIN.wood, ['White', '#f2f2f0'], ['Navy', '#22345a'], ['Sage', '#8aa090'], ['Matte black', '#2a2a2c']];
  function baseCab(x, w, z, d, cm, hm, drawers) {   // one base cabinet run with doors or drawers
    put(box(w - 0.02, 0.1, d - 0.08), M.black(), x, 0.05, z - 0.03);
    put(rbox(w, 0.78, d, 0.006), cm, x, 0.49, z);
    const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
    for (let i = 0; i < n; i++) {
      const cx = x - w / 2 + dw * (i + 0.5);
      if (drawers) for (let r = 0; r < 3; r++) { const y = 0.17 + r * 0.25; put(rbox(dw - 0.015, 0.23, 0.02, 0.004), cm, cx, y, z + d / 2 + 0.006); put(box(Math.min(0.24, dw * 0.5), 0.012, 0.018), hm, cx, y + 0.07, z + d / 2 + 0.03); }
      else { put(rbox(dw - 0.015, 0.72, 0.02, 0.004), cm, cx, 0.48, z + d / 2 + 0.006); put(box(0.012, 0.18, 0.018), hm, cx + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.72, z + d / 2 + 0.03); }
    }
  }
  function wallCab(x, w, z, cm, hm, glass) {
    put(rbox(w, 0.72, 0.34, 0.006), cm, x, 1.86, z);
    const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
    for (let i = 0; i < n; i++) { const cx = x - w / 2 + dw * (i + 0.5); put(rbox(dw - 0.015, 0.7, 0.02, 0.004), glass ? M.glass('#d8e4ea', 0.3) : cm, cx, 1.86, z + 0.18); put(box(0.012, 0.16, 0.018), hm, cx + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 1.6, z + 0.2); }
    put(box(w - 0.04, 0.012, 0.02), M.glow('#fff1d8'), x, 1.495, z + 0.12);
  }
  DEF.counter = { styles: ['Doors', 'Drawers', 'With wall cabinets'], colors: [C('wood', 'Cabinets', CAB, '#f2f2f0'), C('stone', 'Countertop', FIN.stone, 'carrara'), C('metal', 'Handles', FIN.metal, '#2a2a2c')],
    build(o, W, D) {
      const cm = cabMat(o.wood), hm = metalMat(o.metal), w = 1.96, d = 0.62, z = -D / 2 + d / 2 + 0.02;
      baseCab(0, w, z, d, cm, hm, o.style === 1);
      put(rbox(w + 0.02, 0.04, d + 0.03, 0.005), surfMat(o.stone), 0, 0.9, z + 0.01);
      put(box(w, 0.6, 0.012), o.stone === 'butcher' ? M.tex('tile', '#eef2f4', 0.2) : M.stone(o.stone === 'butcher' ? 'carrara' : o.stone), 0, 1.22, -D / 2 + 0.03);
      if (o.style === 2) { wallCab(0, w, -D / 2 + 0.19, cm, hm, false); lamp(0, 1.45, z, 0xffe8c8, 2, 2.5); }
      // a cutting board, a knife block, a bowl of lemons
      put(rbox(0.4, 0.025, 0.28, 0.01), M.wood('#b07a48'), -0.5, 0.935, z + 0.05);
      put(rbox(0.12, 0.22, 0.1, 0.01), M.wood('#3a2618'), -0.82, 1.03, z - 0.1, 0.25, 0, 0);
      for (let i = 0; i < 4; i++) put(box(0.012, 0.06, 0.03), M.black(), -0.85 + i * 0.022, 1.16, z - 0.12);
      put(lathe([[0, 0], [0.08, 0], [0.13, 0.07], [0.12, 0.07], [0.07, 0.01], [0, 0.01]]), M.porcelain('#2a3a5a'), 0.45, 0.92, z);
      for (let i = 0; i < 5; i++) { const s = put(sph(0.035, 12), M.gloss('#e8c21a'), 0.45 + Math.cos(i * 1.3) * 0.05, 0.98 + (i > 3 ? 0.03 : 0), z + Math.sin(i * 1.3) * 0.05); s.scale.set(1, 0.85, 1.25); }
    } };

  DEF.stove = { styles: ['Pro range', 'Black glass', 'Retro'], colors: [C('main', 'Range', FIN.appliance, '#c8ccd2'), C('metal', 'Knobs', FIN.metal, '#e8e8ec'), C('wood', 'Side cabinets', CAB, '#2a2a2c'), C('stone', 'Counters', FIN.stone, 'nero')],
    build(o, W, D) {
      const st = o.style, am = o.main === '#c8ccd2' ? M.brushed(o.main) : M.gloss(o.main), hm = metalMat(o.metal), d = 0.66, z = -D / 2 + d / 2 + 0.02, rw = 0.92;
      const cm = cabMat(o.wood);
      for (const s of [-1, 1]) { baseCab(s * (rw / 2 + 0.26), 0.5, z, d - 0.04, cm, hm, true); put(rbox(0.52, 0.04, d, 0.005), surfMat(o.stone), s * (rw / 2 + 0.26), 0.9, z); }
      put(rbox(rw, 0.9, d, 0.01), st === 1 ? M.gloss('#141416') : am, 0, 0.45, z);
      put(rbox(rw - 0.08, 0.5, 0.03, 0.01), st === 1 ? M.glass('#202024', 0.85) : am, 0, 0.36, z + d / 2 + 0.01);
      put(box(rw - 0.2, 0.32, 0.01), M.glass('#101014', 0.8), 0, 0.38, z + d / 2 + 0.03);
      put(cyl(0.014, 0.014, rw - 0.2, 10), hm, 0, 0.66, z + d / 2 + 0.08, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) put(cyl(0.012, 0.012, 0.06, 8), hm, s * (rw / 2 - 0.1), 0.66, z + d / 2 + 0.05, Math.PI / 2, 0, 0);
      // knobs, the cooktop, six burners and grates
      for (let i = 0; i < 6; i++) put(cyl(0.024, 0.026, 0.035, 16), st === 2 ? M.gloss('#141416') : hm, (i - 2.5) * 0.13, 0.82, z + d / 2 + 0.02, Math.PI / 2, 0, 0);
      put(box(rw, 0.02, d - 0.02), st === 1 ? M.gloss('#0c0c0e') : M.black(), 0, 0.91, z);
      const flames = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const x = (c - 1) * 0.29, zz = z + (r - 0.5) * 0.3;
        if (st === 1) { put(tor(0.09, 0.004, 6, 32), M.matte('#3a3a3e'), x, 0.922, zz, Math.PI / 2, 0, 0); continue; }
        put(cyl(0.05, 0.055, 0.025, 16), M.black(), x, 0.93, zz);
        put(tor(0.11, 0.008, 6, 4), M.matte('#1a1a1c'), x, 0.96, zz, Math.PI / 2, 0, Math.PI / 4);
        for (let k = 0; k < 2; k++) put(box(0.22, 0.012, 0.012), M.matte('#1a1a1c'), x, 0.96, zz, 0, k * Math.PI / 2, 0);
        if (r === 1 && c !== 1) { const f = put(cyl(0.05, 0.05, 0.012, 16, true), M.glow('#4a7aff'), x, 0.95, zz); flames.push(f); }
      }
      // a pot on the front burner
      put(cyl(0.12, 0.11, 0.16, 28), M.metal('#d8d8dc'), -0.29, 1.05, z + 0.15); put(cyl(0.125, 0.125, 0.012, 28), M.glass('#c8d0d8', 0.5), -0.29, 1.135, z + 0.15);
      // backsplash and a hood
      put(box(rw + 1.04, 0.62, 0.012), o.stone === 'butcher' ? M.tex('tile', '#eef2f4', 0.2) : M.stone(o.stone === 'butcher' ? 'carrara' : o.stone), 0, 1.23, -D / 2 + 0.03);
      if (st === 2) put(rbox(rw, 0.3, 0.5, 0.06), am, 0, 1.75, -D / 2 + 0.27);
      else { put(extrude([[-rw / 2, 0], [rw / 2, 0], [0.16, 0.35], [-0.16, 0.35]], 0.5, 0.004), am, 0, 1.6, -D / 2 + 0.27); put(box(0.32, 0.6, 0.3), am, 0, 2.25, -D / 2 + 0.17); }
      put(box(rw - 0.06, 0.012, 0.42), M.glow('#fff1d8'), 0, 1.595, -D / 2 + 0.27);
      ANIM.push(t => flames.forEach((f, i) => f.scale.set(1 + Math.sin(t * 17 + i) * 0.06, 1, 1 + Math.cos(t * 13 + i) * 0.06)));
    } };

  DEF.fridge = { styles: ['French door', 'Side by side', 'Retro'], colors: [C('main', 'Finish', FIN.appliance, '#c8ccd2'), C('metal', 'Handles', FIN.metal, '#e8e8ec')],
    build(o, W, D) {
      const st = o.style, am = o.main === '#c8ccd2' ? M.brushed(o.main) : M.gloss(o.main), hm = metalMat(o.metal), w = st === 2 ? 0.8 : 0.92, h = st === 2 ? 1.7 : 1.82, d = 0.74, z = -D / 2 + d / 2 + 0.04;
      put(rbox(w, h, d, st === 2 ? 0.1 : 0.012), am, 0, h / 2 + 0.03, z);
      put(box(w - 0.04, 0.03, 0.05), M.black(), 0, 0.03, z + d / 2 - 0.03);
      const zf = z + d / 2 + 0.005;
      if (st === 0) {
        put(box(0.006, h * 0.62, 0.012), M.black(), 0, h * 0.68, zf);
        put(box(w - 0.02, 0.008, 0.012), M.black(), 0, h * 0.36, zf);
        for (const s of [-1, 1]) { put(cyl(0.014, 0.014, h * 0.4, 10), hm, s * 0.06, h * 0.66, zf + 0.06); for (const y of [h * 0.48, h * 0.84]) put(cyl(0.01, 0.01, 0.06, 8), hm, s * 0.06, y, zf + 0.03, Math.PI / 2, 0, 0); }
        put(cyl(0.012, 0.012, w * 0.7, 10), hm, 0, h * 0.32, zf + 0.06, 0, 0, Math.PI / 2);
        put(rbox(0.16, 0.26, 0.02, 0.01), M.glass('#101014', 0.9), -0.24, h * 0.66, zf + 0.01); put(box(0.08, 0.02, 0.004), M.glow('#5fd3ff'), -0.24, h * 0.7, zf + 0.022);
      } else if (st === 1) {
        put(box(0.006, h - 0.1, 0.012), M.black(), 0.06, h / 2 + 0.03, zf);
        for (const x of [0.02, 0.1]) { put(cyl(0.014, 0.014, h * 0.55, 10), hm, x, h * 0.55, zf + 0.06); for (const y of [h * 0.3, h * 0.8]) put(cyl(0.01, 0.01, 0.06, 8), hm, x, y, zf + 0.03, Math.PI / 2, 0, 0); }
        put(rbox(0.2, 0.3, 0.03, 0.01), M.black(), -0.22, h * 0.6, zf + 0.01);
      } else {
        put(box(w - 0.02, 0.01, 0.012), M.black(), 0, h * 0.7, zf + 0.01);
        for (const [y, l] of [[h * 0.76, 0.18], [h * 0.5, 0.3]]) put(rbox(0.05, l, 0.05, 0.02), hm, w / 2 - 0.1, y, zf + 0.04);
        put(rbox(0.22, 0.05, 0.01, 0.02), hm, 0, h * 0.95, zf + 0.01);
      }
      // magnets and a photo
      put(box(0.1, 0.14, 0.004), M.matte('#f2efe8'), st === 1 ? 0.25 : 0.2, h * 0.58, zf + 0.012, 0, 0, 0.08); put(cyl(0.015, 0.015, 0.01, 12), M.gloss('#c41b1b'), st === 1 ? 0.25 : 0.2, h * 0.64, zf + 0.018, Math.PI / 2, 0, 0);
    } };

  DEF.island = { styles: ['Waterfall', 'Butcher block', 'Bar island'], colors: [C('wood', 'Base', CAB, '#22345a'), C('stone', 'Top', FIN.stone, 'carrara'), C('metal', 'Hardware', FIN.metal, '#f0c25a'), C('main', 'Stools', FIN.fabric, '#9a5a2e')],
    build(o, W, D) {
      const st = o.style, cm = cabMat(o.wood), hm = metalMat(o.metal), w = 2.6, d = 0.95, top = st === 1 ? M.wood('#b07a48') : surfMat(o.stone);
      put(rbox(w - 0.2, 0.86, d - 0.25, 0.008), cm, 0, 0.45, -0.12);
      for (let i = 0; i < 5; i++) { const x = -w / 2 + 0.1 + (w - 0.2) * (i + 0.5) / 5; put(rbox((w - 0.2) / 5 - 0.015, 0.78, 0.02, 0.004), cm, x, 0.47, -0.12 - (d - 0.25) / 2 - 0.006); put(box(0.012, 0.16, 0.018), hm, x + 0.12, 0.7, -0.12 - (d - 0.25) / 2 - 0.03); }
      put(rbox(w, st === 1 ? 0.07 : 0.05, d, 0.008), top, 0, 0.905, 0);
      if (st === 0) for (const s of [-1, 1]) put(rbox(0.05, 0.9, d, 0.008), top, s * (w / 2 - 0.025), 0.45, 0);
      else for (const s of [-1, 1]) put(rbox(0.08, 0.88, d - 0.25, 0.01), cm, s * (w / 2 - 0.14), 0.44, -0.12);
      // a prep sink with a gooseneck faucet
      put(rbox(0.5, 0.02, 0.36, 0.02), M.metal('#c8ccd2'), 0.6, 0.935, -0.15); put(cyl(0.016, 0.016, 0.34, 10), hm, 0.6, 1.1, -0.36); put(tube([[0.6, 1.27, -0.36], [0.6, 1.36, -0.3], [0.6, 1.3, -0.18], [0.6, 1.2, -0.16]], 0.013, 20, 8), hm);
      // stools along the front
      const sm = M.leather(o.main);
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.72, z = d / 2 + 0.3;
        if (st === 2) { put(cyl(0.19, 0.19, 0.08, 24), sm, x, 0.72, z); put(cyl(0.02, 0.02, 0.66, 10), hm, x, 0.36, z); put(cyl(0.18, 0.2, 0.02, 24), hm, x, 0.01, z); put(tor(0.15, 0.01, 6, 24), hm, x, 0.3, z, Math.PI / 2, 0, 0); }
        else { put(cushion(0.42, 0.07, 0.4, 0.03, 0.2), sm, x, 0.7, z); put(cushion(0.42, 0.3, 0.06, 0.03, 0.1), sm, x, 0.88, z + 0.2, -0.1, 0, 0); legs4(0.38, 0.36, 0.66, M.wood('#3a2618'), 0.03, 0.018, 0.014, 0.04); for (const m of G.children.slice(-4)) { m.position.x += x; m.position.z += z; } put(box(0.34, 0.012, 0.012), hm, x, 0.25, z - 0.16); }
      }
      // pendants over it
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.8;
        put(cyl(0.004, 0.004, 0.9, 6), M.black(), x, 2.3, 0);
        if (st === 2) put(sph(0.13, 20), M.glass('#fff4e0', 0.4), x, 1.75, 0); else put(lathe([[0.02, 0.24], [0.04, 0.22], [0.16, 0.02], [0.17, 0]], 28), hm, x, 1.6, 0);
        put(sph(0.04, 12), M.glow('#fff1d8'), x, 1.65, 0); lamp(x, 1.6, 0, 0xffd8a0, 2.5, 3);
      }
      put(lathe([[0, 0], [0.1, 0], [0.16, 0.08], [0.15, 0.08], [0.09, 0.01], [0, 0.01]]), M.wood('#7a5236'), -0.6, 0.93, -0.1);
    } };

  // ---------- Living ----------
  function sofaRun(len, d, sm, o, x = 0, z = 0, ry = 0, armL = true, armR = true, nSeat = 3) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
    const st = o.style, armW = st === 1 ? 0.24 : 0.18, seatH = 0.44;
    const P = (geo, m, px, py, pz, rx = 0, rY = 0, rz = 0) => put(geo, m, px, py, pz, rx, rY, rz, g);
    P(rbox(len, 0.24, d, 0.04), sm, 0, 0.2, 0);
    P(cushion(len - (armL ? armW : 0) - (armR ? armW : 0), st === 1 ? 0.75 : 0.62, 0.2, 0.06, 0.06), sm, ((armL ? armW : 0) - (armR ? armW : 0)) / 2, st === 1 ? 0.62 : 0.6, -d / 2 + 0.12, -0.08, 0, 0);
    if (st === 1) { const btn = M.metal('#c8a050'); const cw = len - (armL ? armW : 0) - (armR ? armW : 0); for (let r = 0; r < 2; r++) for (let c = 0; c < Math.floor(cw / 0.2); c++) P(sph(0.01, 6), btn, -cw / 2 + 0.1 + c * 0.2 + (r % 2) * 0.1 + ((armL ? armW : 0) - (armR ? armW : 0)) / 2, 0.55 + r * 0.17, -d / 2 + 0.24); }
    for (const [on, s] of [[armL, -1], [armR, 1]]) if (on) {
      if (st === 1) { P(cushion(armW, 0.5, d, 0.1, 0.05), sm, s * (len / 2 - armW / 2), 0.5, 0); P(cyl(0.13, 0.13, d, 24), sm, s * (len / 2 - armW / 2), 0.74, 0, Math.PI / 2, 0, 0); }
      else P(rbox(armW, 0.36, d, 0.05), sm, s * (len / 2 - armW / 2), 0.44, 0);
    }
    const sw = (len - (armL ? armW : 0) - (armR ? armW : 0)) / nSeat, cx0 = -len / 2 + (armL ? armW : 0);
    for (let i = 0; i < nSeat; i++) P(cushion(sw - 0.02, 0.16, d - 0.24, 0.05, 0.25), sm, cx0 + sw * (i + 0.5), seatH, 0.07);
    if (st === 2) for (let i = 0; i < nSeat; i++) P(cushion(sw - 0.04, 0.28, 0.16, 0.06, 0.2), sm, cx0 + sw * (i + 0.5), 0.72, -d / 2 + 0.26, -0.15, 0, 0);
    // feet
    const fm = st === 1 ? M.wood('#3a2618') : st === 2 ? M.black() : M.metal('#2a2a2c');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(st === 1 ? sph(0.035, 10) : cyl(0.02, 0.016, 0.08, 10), fm, sx * (len / 2 - 0.08), 0.04, sz * (d / 2 - 0.08));
    return g;
  }
  const SOFA = [C('main', 'Fabric', FIN.fabric, '#22345a'), C('accent', 'Pillows', FIN.fabric, '#c89a2a')];
  const sofaMat = (o, c) => o.style === 2 ? M.leather(c) : o.style === 1 ? M.velvet(c) : M.fabric(c);
  function pillows(list, pm) { for (const [x, y, z, ry] of list) put(cushion(0.42, 0.42, 0.12, 0.05, 0.4), pm, x, y, z, -0.25, ry, 0); }
  DEF.couch = { styles: ['Modern', 'Tufted velvet', 'Leather'], colors: SOFA,
    build(o, W, D) {
      const len = 2.5, d = 0.98, z = -D / 2 + d / 2 + 0.06;
      sofaRun(len, d, sofaMat(o, o.main), o, 0, z);
      pillows([[-0.85, 0.72, z - 0.15, 0.2], [0.85, 0.72, z - 0.15, -0.2]], M.fabric(o.accent));
      // a coffee table in front
      put(rbox(1.2, 0.05, 0.6, 0.02), o.style === 2 ? M.stone('nero') : M.wood('#7a5236'), 0, 0.42, z + 0.95); put(rbox(1.1, 0.04, 0.5, 0.01), M.wood('#7a5236'), 0, 0.12, z + 0.95); legs4(1.15, 0.55, 0.42, M.metal('#2a2a2c'), 0.04, 0.014, 0.014);
      for (const m of G.children.slice(-4)) m.position.z += z + 0.95;
      put(rbox(0.3, 0.04, 0.22, 0.005), M.matte('#e6dfd2'), 0.25, 0.465, z + 0.95); put(cyl(0.05, 0.05, 0.1, 16), M.porcelain('#2a2a2e'), -0.35, 0.5, z + 0.95);
    } };
  DEF.sectional = { styles: ['Modern L', 'Tufted velvet', 'Leather recliners'], colors: SOFA,
    build(o, W, D) {
      const sm = sofaMat(o, o.main), d = 1.0, back = -D / 2 + d / 2 + 0.04;
      sofaRun(3.4, d, sm, o, -0.25, back, 0, true, false, 3);
      sofaRun(2.4, d, sm, o, 1.45 + 0.0, back + 1.2 + 0.0, -Math.PI / 2, false, true, 2);
      put(rbox(1.0, 0.24, 1.0, 0.04), sm, 1.45, 0.2, back); put(cushion(0.86, 0.16, 0.76, 0.05, 0.25), sm, 1.45 - 0.05, 0.44, back + 0.07);
      pillows([[-1.6, 0.72, back - 0.15, 0.2], [1.25, 0.72, back - 0.12, -0.6], [0.4, 0.72, back - 0.15, 0], [1.35, 0.72, back + 1.0, -1.4]], M.fabric(o.accent));
      put(rbox(1.3, 0.38, 0.8, 0.04), M.leather(o.accent === '#141416' ? '#3a2618' : '#141416'), -0.3, 0.19, back + 1.35);
      put(rbox(0.36, 0.04, 0.26, 0.01), M.wood('#7a5236'), -0.3, 0.4, back + 1.35); put(cyl(0.04, 0.04, 0.07, 14), M.matte('#efe6d6'), -0.4, 0.45, back + 1.33);
      put(rbox(3.2, 0.012, 2.6, 0.005), M.tex('felt', o.accent, 0.95), 0, 0.006, back + 1.05);
    } };

  DEF.tv = { styles: ['Wall mount', 'On a stand', 'Media wall'], colors: [C('wood', 'Console', FIN.wood, '#3a2618'), C('accent', 'Backlight', FIN.accent, '#1b4fc4'), C('main', 'Screen', [['Racing game', 'game'], ['Football', 'sports'], ['Home screen', 'desk']], 'game')],
    build(o, W, D) {
      const st = o.style, w = 1.9, h = 1.08, scr = { game: TEX.scrGame, sports: TEX.scrSports, desk: TEX.scrDesk }[o.main] || TEX.scrGame, back = -D / 2;
      const ty = st === 1 ? 1.25 : 1.4, tz = back + (st === 1 ? 0.35 : 0.06);
      put(rbox(w, h, 0.04, 0.008), M.gloss('#0c0c0e'), 0, ty, tz);
      const s = put(new THREE.PlaneGeometry(w - 0.03, h - 0.03), M.screen(scr), 0, ty, tz + 0.021);
      put(box(w * 0.92, h * 0.9, 0.01), M.glow(o.accent), 0, ty, tz - 0.03); lamp(0, ty, back + 0.15, new THREE.Color(o.accent).getHex(), 3, 2.5);
      if (st === 1) { for (const s2 of [-1, 1]) put(box(0.05, 0.03, 0.3), M.metal('#2a2a2c'), s2 * 0.5, 0.715, tz); put(box(0.08, 0.5, 0.04), M.metal('#2a2a2c'), 0, 0.95, tz - 0.03); }
      // the console and a soundbar
      const cw = st === 2 ? 2.6 : 2.0, cz = back + 0.24;
      put(rbox(cw, 0.5, 0.45, 0.01), M.wood(o.wood), 0, st === 1 ? 0.45 : 0.4, cz);
      if (st !== 1) put(box(cw - 0.06, 0.1, 0.4), M.black(), 0, 0.08, cz - 0.01);
      for (let i = 0; i < 4; i++) put(rbox(cw / 4 - 0.02, 0.44, 0.02, 0.004), M.wood(o.wood), -cw / 2 + cw / 8 + i * cw / 4, st === 1 ? 0.45 : 0.4, cz + 0.23);
      put(rbox(1.0, 0.07, 0.1, 0.02), M.fabric('#1a1a1c'), 0, st === 1 ? 0.74 : 0.69, cz + 0.12);
      put(rbox(0.26, 0.06, 0.18, 0.02), M.gloss('#f2f2f2'), -0.7, st === 1 ? 0.73 : 0.68, cz);
      put(rbox(0.14, 0.04, 0.1, 0.03), M.matte('#1a1a1c'), 0.6, st === 1 ? 0.72 : 0.67, cz + 0.05, 0, 0.4, 0);
      if (st === 2) {   // slatted wood wall and side shelves
        for (let i = 0; i < 26; i++) put(box(0.05, 2.5, 0.03), M.wood(o.wood), -1.3 + i * 0.104, 1.25, back + 0.015);
        for (const s2 of [-1, 1]) for (let r = 0; r < 3; r++) { put(box(0.5, 0.03, 0.25), M.wood(o.wood), s2 * 1.25, 1.0 + r * 0.45, back + 0.15); put(rbox(0.1, 0.16 + r * 0.04, 0.1, 0.02), M.porcelain(['#e6dfd2', '#2a2a2e', '#c89a2a'][r]), s2 * 1.25 + 0.1, 1.1 + r * 0.45 + r * 0.02, back + 0.15); }
      }
    } };

  DEF.table = { styles: ['Farmhouse', 'Glass modern', 'Marble'], colors: [C('wood', 'Wood', FIN.wood, '#7a5236'), C('main', 'Chairs', FIN.fabric, '#e6dfd2'), C('metal', 'Metal', FIN.metal, '#2a2a2c')],
    build(o, W, D) {
      const st = o.style, wd = M.wood(o.wood), mm = metalMat(o.metal), L = 2.1, w = 0.95;
      if (st === 0) { put(rbox(L, 0.06, w, 0.01), wd, 0, 0.75, 0); for (const s of [-1, 1]) { put(box(0.08, 0.68, 0.7), wd, s * (L / 2 - 0.25), 0.36, 0); } put(box(L - 0.5, 0.06, 0.08), wd, 0, 0.25, 0); }
      else if (st === 1) { put(rbox(L, 0.02, w, 0.01), M.glass('#c8e0e8', 0.35), 0, 0.75, 0); for (const s of [-1, 1]) { put(extrude([[-0.35, 0], [0.35, 0], [0.05, 0.74], [-0.05, 0.74]], 0.06, 0.004), mm, s * (L / 2 - 0.35), 0, 0, 0, Math.PI / 2, 0); } }
      else { put(rbox(L, 0.05, w, 0.02), M.stone('carrara'), 0, 0.75, 0); for (const s of [-1, 1]) put(lathe([[0.25, 0], [0.25, 0.04], [0.08, 0.1], [0.07, 0.7], [0.2, 0.73]], 32), mm, s * 0.55, 0, 0); }
      // six chairs
      const cm = M.fabric(o.main);
      const chair = (x, z, ry) => {
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
        put(cushion(0.46, 0.08, 0.46, 0.03, 0.2), cm, 0, 0.47, 0, 0, 0, 0, g);
        put(cushion(0.44, 0.48, 0.07, 0.03, 0.1), cm, 0, 0.76, -0.21, -0.08, 0, 0, g);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(0.018, 0.014, 0.44, 8), st === 0 ? wd : mm, sx * 0.19, 0.22, sz * 0.19, sz * 0.05, 0, 0, g);
      };
      for (const s of [-1, 1]) { chair(s * (L / 2 + 0.3), 0, -s * Math.PI / 2); for (const x of [-0.5, 0.5]) chair(x, s * (w / 2 + 0.3), s > 0 ? Math.PI : 0); }
      // place settings and a centrepiece
      for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3], [-0.85, 0], [0.85, 0]]) put(cyl(0.13, 0.11, 0.015, 28), M.porcelain('#f6f6f4'), x, 0.77, z);
      put(lathe([[0, 0], [0.06, 0], [0.09, 0.15], [0.05, 0.28], [0.03, 0.3]]), M.porcelain('#2f5a3a'), 0, 0.775, 0);
      for (let i = 0; i < 7; i++) put(sph(0.04, 10), M.matte(['#e8c0b8', '#f2f2f2', '#e0a8a8'][i % 3]), Math.cos(i) * 0.06, 1.1 + hash(i) * 0.06, Math.sin(i) * 0.06);
      put(cyl(0.004, 0.004, 1.2, 6), M.black(), 0, 2.4, 0); put(tor(0.5, 0.012, 8, 48), mm, 0, 1.8, 0, Math.PI / 2, 0, 0); put(tor(0.5, 0.006, 6, 48), M.glow('#fff1d8'), 0, 1.79, 0, Math.PI / 2, 0, 0); lamp(0, 1.7, 0, 0xffd8a0, 4, 4);
    } };

  DEF.rug = { styles: ['Persian', 'Shag', 'Geometric'], colors: [C('main', 'Base', FIN.fabric, '#6a1e2a'), C('accent', 'Pattern', FIN.fabric, '#c89a2a')],
    build(o, W, D) {
      const t = rugTex(o.style, o.main, o.accent); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, envMapIntensity: 0.4 });
      const r = put(rbox(3.0, o.style === 1 ? 0.04 : 0.014, 2.2, 0.006), m, 0, o.style === 1 ? 0.02 : 0.007, 0);
      r.geometry.attributes.uv.array.forEach((v, i, a) => {});
      if (o.style === 0) for (const s of [-1, 1]) for (let i = 0; i < 40; i++) put(box(0.004, 0.003, 0.06), M.matte('#efe6d6'), (i - 19.5) * 0.054, 0.004, s * 1.13);
      // a chair and a side table so the size reads
      put(cushion(0.8, 0.4, 0.8, 0.08, 0.1), M.velvet('#2f5a3a'), -0.9, 0.3, -0.5, 0, 0.5, 0); put(cushion(0.8, 0.5, 0.18, 0.06, 0.1), M.velvet('#2f5a3a'), -1.05, 0.65, -0.82, -0.1, 0.5, 0);
    } };

  DEF.plant = { styles: ['Fiddle leaf fig', 'Snake plant', 'Palm'], colors: [C('main', 'Pot', [['Terracotta', '#b8653a'], ['White', '#f2f2f0'], ['Black', '#1a1a1c'], ['Gold', '#c8a050'], ['Concrete', '#8a8884']], '#f2f2f0')],
    build(o, W, D) {
      const st = o.style, pm = o.main === '#c8a050' ? M.metal('#c8a050') : o.main === '#8a8884' ? M.stone('concrete') : M.porcelain(o.main);
      put(lathe([[0, 0], [0.16, 0], [0.2, 0.36], [0.22, 0.4], [0.2, 0.4], [0.18, 0.38], [0, 0.36]], 32), pm, 0, 0, 0);
      put(cyl(0.19, 0.19, 0.02, 24), M.matte('#3a2a1e'), 0, 0.37, 0);
      const leaf = M.matte('#2f6b3a'), leaf2 = M.matte('#3f7f42');
      seed = 41;
      if (st === 0) {
        put(cyl(0.015, 0.02, 1.3, 8), M.wood('#5a4a32'), 0, 1.0, 0);
        for (let i = 0; i < 34; i++) { const a = i * 2.4, y = 0.75 + (i / 34) * 1.0, r = 0.08 + rnd() * 0.18; const l = put(sph(0.1, 10), i % 3 ? leaf : leaf2, Math.cos(a) * r, y, Math.sin(a) * r, rnd() - 0.5, -a, 0.6); l.scale.set(1, 0.12, 1.4); }
      } else if (st === 1) {
        for (let i = 0; i < 16; i++) { const a = i * 2.4, r = rnd() * 0.1, h = 0.5 + rnd() * 0.45; const l = put(cyl(0.001, 0.03, h, 6), i % 2 ? leaf : M.matte('#5a7a3a'), Math.cos(a) * r, 0.38 + h / 2, Math.sin(a) * r, (rnd() - 0.5) * 0.3, a, (rnd() - 0.5) * 0.3); l.scale.set(2.2, 1, 0.3); }
      } else {
        put(cyl(0.03, 0.05, 1.2, 10), M.wood('#7a6a4a'), 0, 0.95, 0);
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([Math.cos(a) * t * 0.8, 1.55 + Math.sin(t * 2.2) * 0.25 - t * t * 0.5, Math.sin(a) * t * 0.8]); } put(tube(pts, 0.008, 16, 4), leaf, 0, 0, 0); for (let k = 1; k < 9; k++) { const t = k / 9, p = [Math.cos(a) * t * 0.8, 1.55 + Math.sin(t * 2.2) * 0.25 - t * t * 0.5, Math.sin(a) * t * 0.8]; for (const s of [-1, 1]) { const l = put(box(0.25 * (1 - t * 0.5), 0.004, 0.03), leaf2, p[0] + Math.cos(a + s * 1.4) * 0.1, p[1] - 0.04, p[2] + Math.sin(a + s * 1.4) * 0.1, 0, -(a + s * 1.4), -0.4); } } }
      }
    } };

  DEF.lamp = { styles: ['Arc', 'Tripod', 'Column'], colors: [C('metal', 'Metal', FIN.metal, '#f0c25a'), C('main', 'Shade', FIN.fabric, '#e6dfd2')],
    build(o, W, D) {
      const st = o.style, mm = metalMat(o.metal), sm = M.fabric(o.main);
      let lx = 0, ly = 1.6, lz = 0;
      if (st === 0) { put(rbox(0.36, 0.06, 0.36, 0.02), M.stone('carrara'), -0.5, 0.03, 0); put(tube([[-0.5, 0.05, 0], [-0.5, 1.2, 0], [-0.3, 1.9, 0], [0.2, 2.05, 0], [0.55, 1.85, 0]], 0.014, 40, 8), mm); put(lathe([[0.02, 0.18], [0.08, 0.17], [0.22, 0.0], [0.23, -0.01]], 32), mm, 0.55, 1.62, 0); lx = 0.55; ly = 1.62; }
      else if (st === 1) { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; put(cyl(0.014, 0.014, 1.5, 8), M.wood('#7a5236'), Math.cos(a) * 0.2, 0.72, Math.sin(a) * 0.2, Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14); } put(cyl(0.2, 0.24, 0.32, 32, true), sm, 0, 1.6, 0); }
      else { put(cyl(0.16, 0.18, 0.03, 24), mm, 0, 0.015, 0); put(cyl(0.012, 0.012, 1.3, 8), mm, 0, 0.67, 0); put(cyl(0.16, 0.16, 0.5, 32, true), sm, 0, 1.55, 0); ly = 1.5; }
      put(sph(0.05, 12), M.glow('#fff1d0'), lx, ly, lz); lamp(lx, ly - 0.1, lz, 0xffd8a0, 7, 5);
      put(cushion(0.8, 0.4, 0.8, 0.08, 0.1), M.velvet('#5a2a8a'), 0.5, 0.3, -0.3, 0, -0.4, 0); put(cushion(0.8, 0.5, 0.18, 0.06, 0.1), M.velvet('#5a2a8a'), 0.62, 0.65, -0.62, -0.1, -0.4, 0);
    } };

  DEF.fireplace = { styles: ['Stone', 'Modern linear', 'Brick'], colors: [C('wood', 'Mantel', FIN.wood, '#3a2618'), C('accent', 'Flame', [['Fire orange', '#ff7a1a'], ['Blue gas', '#3a8aff'], ['Purple', '#8a3aff']], '#ff7a1a')],
    build(o, W, D) {
      const st = o.style, back = -D / 2, wM = st === 0 ? M.tex('stone', '#ffffff', 0.85) : st === 2 ? M.tex('brick', '#ffffff', 0.85) : M.stone('nero');
      const w = st === 1 ? 2.8 : 2.0, h = st === 1 ? 2.6 : 2.5;
      put(box(w, h, 0.4), wM, 0, h / 2, back + 0.2);
      const fw = st === 1 ? 1.8 : 0.9, fh = st === 1 ? 0.4 : 0.75, fy = st === 1 ? 0.75 : 0.42 + 0.05;
      put(box(fw, fh, 0.05), M.black(), 0, fy, back + 0.4 - 0.02);
      put(box(fw - 0.06, fh - 0.06, 0.3), M.matte('#0c0a08'), 0, fy, back + 0.27);
      if (st !== 1) { put(rbox(w + 0.2, 0.12, 0.6, 0.01), M.stone('granite'), 0, 0.06, back + 0.3); put(rbox(w + 0.12, 0.1, 0.32, 0.01), M.wood(o.wood), 0, 1.25, back + 0.46); for (let i = 0; i < 3; i++) put(cyl(0.05, 0.05, 0.7, 10), M.wood('#5a3a22'), (i - 1) * 0.12, 0.2 + (i === 1 ? 0.07 : 0), back + 0.32, 0, 0, Math.PI / 2 + (i - 1) * 0.15); }
      else { put(box(fw - 0.1, 0.06, 0.2), M.matte('#d8d4c8'), 0, fy - fh / 2 + 0.05, back + 0.3); put(box(fw, 0.012, 0.012), M.glow(o.accent), 0, fy - fh / 2 + 0.006, back + 0.42); }
      put(box(fw - 0.02, fh - 0.02, 0.01), M.glass('#ffe8d0', 0.12), 0, fy, back + 0.43);
      const fm = new THREE.MeshBasicMaterial({ color: col(o.accent), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const flames = []; for (let i = 0; i < (st === 1 ? 14 : 7); i++) { const x = (i - (st === 1 ? 6.5 : 3)) * 0.11, f = put(new THREE.ConeGeometry(0.06, 0.32, 8), fm, x, fy - fh / 2 + 0.2, back + 0.3); f.castShadow = false; flames.push(f); }
      const fl = lamp(0, fy, back + 0.8, new THREE.Color(o.accent).getHex(), 0, 4); fl.intensity = 2.5; LIGHTS.pop();
      ANIM.push(t => { flames.forEach((f, i) => { const k = 0.7 + 0.35 * Math.sin(t * 9 + i * 1.7) + 0.15 * Math.sin(t * 23 + i); f.scale.set(1, k, 1); f.position.y = fy - fh / 2 + 0.06 + 0.16 * k; }); fl.intensity = 2.2 + Math.sin(t * 13) * 0.4; });
      // mantel decor
      if (st !== 1) { put(rbox(0.5, 0.36, 0.03, 0.01), M.wood('#c49a68'), -0.5, 1.48, back + 0.38, -0.08, 0, 0); put(cyl(0.05, 0.05, 0.22, 16), M.porcelain('#e6dfd2'), 0.5, 1.41, back + 0.46); }
      else put(new THREE.PlaneGeometry(1.6, 0.9), M.screen(TEX.scrSports), 0, 1.7, back + 0.41);
    } };

  DEF.bookshelf = { styles: ['Classic', 'Ladder', 'Cubes'], colors: [C('wood', 'Wood', FIN.wood, '#5a3a22'), C('accent', 'Books', [['Mixed', 'mix'], ['Black & gold', 'bg'], ['Bright', 'bright']], 'mix')],
    build(o, W, D) {
      const st = o.style, wd = M.wood(o.wood), back = -D / 2, w = 1.8, h = 2.2, d = 0.36, z = back + d / 2 + 0.02;
      const pal = { mix: ['#6a1e2a', '#22345a', '#e6dfd2', '#2f5a3a', '#9a5a2e', '#141416', '#c89a2a'], bg: ['#141416', '#1a1a1c', '#c8a050', '#2a2a2c'], bright: ['#c41b1b', '#1b4fc4', '#e8c21a', '#2cff7a', '#e0559a', '#ff7a1a'] }[o.accent] || ['#6a1e2a'];
      let rows;
      if (st === 1) { for (const s of [-1, 1]) put(box(0.05, h, 0.05), wd, s * w / 2, h / 2, z + 0.1, -0.08, 0, 0); rows = 5; }
      else { put(box(w, h, 0.02), wd, 0, h / 2, back + 0.03); for (const s of [-1, 1]) put(box(0.04, h, d), wd, s * w / 2, h / 2, z); put(box(w, 0.04, d), wd, 0, h, z); rows = st === 2 ? 4 : 5; }
      if (st === 2) for (let c = 1; c < 3; c++) put(box(0.03, h, d), wd, -w / 2 + c * w / 3, h / 2, z);
      seed = 7;
      for (let r = 0; r < rows; r++) {
        const y = 0.05 + r * (h - 0.05) / rows, sd = st === 1 ? d - r * 0.04 : d;
        put(box(w, 0.03, sd), wd, 0, y, z - (d - sd) / 2 + (st === 1 ? 0.1 - r * 0.04 : 0));
        if (r === 0 && st !== 1) continue;
        let x = -w / 2 + 0.05;
        while (x < w / 2 - 0.1) {
          if (rnd() < 0.12) { x += 0.12; put(sph(0.05, 12), M.porcelain(pal[(r + 1) % pal.length]), x - 0.06, y + 0.065, z); continue; }
          const bw = 0.025 + rnd() * 0.03, bh = 0.18 + rnd() * 0.12, lean = rnd() < 0.08 ? 0.25 : 0;
          if (x + bw > w / 2 - 0.05) break;
          put(box(bw, bh, sd * 0.7), M.matte(pal[Math.floor(rnd() * pal.length)]), x + bw / 2, y + 0.015 + bh / 2, z - (st === 1 ? -0.1 + r * 0.04 : 0) * 0, 0, 0, lean);
          x += bw + 0.003 + lean * 0.05;
        }
      }
    } };

  DEF.aquarium = { styles: ['Long tank', 'Wall tank', 'Cylinder'], colors: [C('wood', 'Stand', [...FIN.wood, ['Gloss black', '#0c0c0e'], ['White', '#f2f2f0']], '#0c0c0e'), C('accent', 'Water light', [['Ocean blue', '#5fd3ff'], ['Teal', '#1a9a9a'], ['Purple', '#8a3aff'], ['Deep blue', '#1b4fc4']], '#5fd3ff')],
    build(o, W, D) {
      const st = o.style, sm = o.wood === '#0c0c0e' || o.wood === '#f2f2f0' ? M.gloss(o.wood) : M.wood(o.wood), water = new THREE.MeshPhysicalMaterial({ color: col(o.accent), transparent: true, opacity: 0.32, roughness: 0.05, depthWrite: false, envMapIntensity: 1.2 });
      let cx = 0, cy, cz = 0, tw, th, td, round = st === 2;
      if (st === 2) { tw = 1.1; th = 1.9; td = 1.1; put(cyl(0.6, 0.6, 0.6, 40), sm, 0, 0.3, 0); put(cyl(0.6, 0.6, 0.15, 40), sm, 0, 2.58, 0); cy = 0.6 + th / 2; put(cyl(0.55, 0.55, th, 40, true), M.glass('#e8f4ff', 0.12), 0, cy, 0); put(cyl(0.54, 0.54, th - 0.06, 40), water, 0, cy, 0); }
      else { tw = st === 1 ? 3.6 : 3.4; th = st === 1 ? 1.3 : 0.95; td = st === 1 ? 0.6 : 0.8; cz = -D / 2 + td / 2 + 0.05; cy = st === 1 ? 1.35 : 0.85 + th / 2;
        if (st === 1) { put(box(tw + 0.3, 2.6, 0.3), M.paint('#2a2a2e'), 0, 1.3, cz - 0.1); put(box(tw + 0.1, th + 0.1, 0.2), M.black(), 0, cy, cz + 0.06); }
        else { put(rbox(tw, 0.85, td, 0.01), sm, 0, 0.425, cz); put(rbox(tw, 0.12, td, 0.01), sm, 0, cy + th / 2 + 0.06, cz); }
        put(box(tw - 0.02, th, td - 0.02), M.glass('#e8f4ff', 0.1), 0, cy, cz + (st === 1 ? 0.2 : 0)); put(box(tw - 0.06, th - 0.06, td - 0.06), water, 0, cy, cz + (st === 1 ? 0.2 : 0)); cz += st === 1 ? 0.2 : 0; }
      // sand, rocks, coral
      seed = 3;
      if (round) put(cyl(0.53, 0.53, 0.08, 40), M.matte('#d8c8a0'), 0, cy - th / 2 + 0.06, 0); else put(box(tw - 0.06, 0.08, td - 0.06), M.matte('#d8c8a0'), 0, cy - th / 2 + 0.07, cz);
      for (let i = 0; i < 9; i++) { const x = (rnd() - 0.5) * (round ? 0.7 : tw - 0.4), z = (rnd() - 0.5) * (td - 0.3); const r = put(sph(0.08 + rnd() * 0.12, 8), M.matte(['#6a6460', '#8a5a4a', '#e0559a', '#ff7a5a'][i % 4]), x, cy - th / 2 + 0.12, cz + z); r.scale.y = 0.6 + rnd() * 0.8; }
      lamp(0, cy + th / 2 - 0.1, cz + 0.3, new THREE.Color(o.accent).getHex(), 3, 3.5);
      put(box(round ? 0.6 : tw - 0.1, 0.02, 0.05), M.glow(o.accent), 0, cy + th / 2 - 0.02, cz);
      // sharks and fish swimming
      const shark = () => { const g = new THREE.Group(), sm2 = M.gloss('#6a7680'), wb = M.matte('#e8ecf0'); const b = new THREE.Mesh(sph(0.1, 16), sm2); b.scale.set(3.2, 0.9, 1); g.add(b); const bl = new THREE.Mesh(sph(0.09, 12), wb); bl.scale.set(2.8, 0.5, 0.9); bl.position.y = -0.03; g.add(bl);
        const df = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), sm2); df.position.set(0.02, 0.12, 0); df.rotation.z = -0.3; df.scale.z = 0.25; g.add(df);
        const tl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), sm2); tl.position.set(-0.36, 0.03, 0); tl.rotation.z = Math.PI / 2 + 0.5; tl.scale.z = 0.2; g.add(tl);
        for (const s of [-1, 1]) { const pf = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), sm2); pf.position.set(0.08, -0.05, s * 0.08); pf.rotation.set(s * 1.2, 0, 0.6); pf.scale.z = 0.2; g.add(pf); }
        g.children.forEach(m => m.castShadow = true); G.add(g); return g; };
      const fish = []; const n = round ? 6 : 9;
      for (let i = 0; i < n; i++) { const isS = i < (round ? 1 : 2); const f = isS ? shark() : (() => { const m = put(sph(0.035, 10), M.gloss(['#ff7a1a', '#e8c21a', '#1b4fc4', '#f2f2f2'][i % 4]), 0, 0, 0); m.scale.set(1.6, 1, 0.5); return m; })(); f.userData = { r: isS ? 0.9 : 0.3 + rnd() * 0.8, sp: (isS ? 0.25 : 0.5 + rnd() * 0.5) * (i % 2 ? 1 : -1), ph: rnd() * TAU, y: cy - th / 2 + 0.25 + rnd() * (th - 0.45) }; fish.push(f); }
      ANIM.push(t => fish.forEach(f => { const u = f.userData, a = t * u.sp + u.ph; let x, z; if (round) { x = Math.cos(a) * 0.35; z = Math.sin(a) * 0.35; f.rotation.y = -a - Math.sign(u.sp) * Math.PI / 2; } else { x = Math.sin(a) * (tw / 2 - 0.4) * Math.min(1, u.r); z = cz + Math.sin(a * 2) * (td / 2 - 0.2) * 0.5; f.rotation.y = Math.cos(a) * u.sp > 0 ? 0 : Math.PI; } f.position.set(x, u.y + Math.sin(t + u.ph) * 0.05, round ? z : z); }));
    } };

  // ---------- Fun ----------
  DEF.desk = { styles: ['Triple monitor', 'Ultrawide', 'Streamer'], colors: [C('main', 'Desk', [['Black', '#1a1c22'], ['White', '#f2f2f0'], ['Walnut', '#7a5236']], '#1a1c22'), C('accent', 'RGB', FIN.accent, '#ff1a2e'), C('metal', 'Chair', FIN.fabric, '#c41b1b')],
    build(o, W, D) {
      const st = o.style, dm = o.main === '#7a5236' ? M.wood(o.main) : M.gloss(o.main), glow = M.glow(o.accent), back = -D / 2, z = back + 0.4, w = 1.7;
      put(rbox(w, 0.04, 0.78, 0.01), dm, 0, 0.75, z);
      for (const s of [-1, 1]) { put(extrude([[-0.3, 0], [0.3, 0], [0.04, 0.73], [-0.04, 0.73]], 0.06, 0.004), M.black(), s * (w / 2 - 0.12), 0, z, 0, Math.PI / 2, 0); }
      put(box(w - 0.04, 0.01, 0.01), glow, 0, 0.73, z + 0.39); put(rbox(0.9, 0.004, 0.38, 0.003), M.fabric('#141416'), 0, 0.772, z + 0.18);
      // monitors
      const mon = (x, ry, mw, tex) => { const g = new THREE.Group(); g.position.set(x, 1.12, z - 0.18); g.rotation.y = ry; G.add(g); put(rbox(mw, mw * 0.42, 0.03, 0.006), M.black(), 0, 0, 0, 0, 0, 0, g); put(new THREE.PlaneGeometry(mw - 0.02, mw * 0.42 - 0.02), M.screen(tex), 0, 0, 0.016, 0, 0, 0, g); put(box(mw * 0.9, mw * 0.36, 0.005), glow, 0, 0, -0.02, 0, 0, 0, g); put(cyl(0.015, 0.015, 0.3, 8), M.black(), 0, -0.25, -0.05, 0, 0, 0, g); };
      if (st === 1) mon(0, 0, 1.2, TEX.scrGame); else { mon(0, 0, 0.62, TEX.scrGame); mon(-0.6, 0.45, 0.6, TEX.scrDesk); mon(0.6, -0.45, 0.6, TEX.scrSports); }
      put(rbox(0.36, 0.02, 0.13, 0.008), M.black(), -0.05, 0.785, z + 0.15); for (let i = 0; i < 6; i++) put(box(0.32, 0.004, 0.012), glow, -0.05, 0.797, z + 0.1 + i * 0.016);
      put(rbox(0.07, 0.03, 0.11, 0.03), M.black(), 0.3, 0.79, z + 0.17);
      if (st === 2) { put(cyl(0.008, 0.008, 0.5, 8), M.black(), 0.55, 1.0, z + 0.05, 0.6, 0, 0); put(cyl(0.035, 0.035, 0.14, 16), M.metal('#2a2a2c'), 0.55, 1.15, z + 0.22, 1.2, 0, 0); put(tor(0.22, 0.02, 8, 40), glow, -0.5, 1.6, back + 0.02); put(box(0.5, 0.012, 0.012), glow, 0.5, 1.9, back + 0.02); }
      put(lathe([[0, 0], [0.07, 0], [0.08, 0.04], [0.06, 0.18], [0.06, 0.2]], 20), M.black(), 0.7, 0.77, z - 0.1); put(box(0.2, 0.42, 0.42), M.black(), w / 2 - 0.2, 0.25, z + 0.05); put(box(0.004, 0.36, 0.36), M.glass('#c8d0ff', 0.4), w / 2 - 0.3, 0.27, z + 0.05); for (let i = 0; i < 3; i++) put(tor(0.05, 0.006, 6, 20), glow, w / 2 - 0.305, 0.18 + i * 0.1, z + 0.2, 0, Math.PI / 2, 0);
      lamp(0, 1.0, z - 0.3, new THREE.Color(o.accent).getHex(), 3, 3);
      // racing chair
      const cm = M.leather(o.metal), cz = z + 0.75;
      put(cushion(0.52, 0.1, 0.5, 0.04, 0.2), cm, 0, 0.5, cz); put(cushion(0.52, 0.85, 0.1, 0.05, 0.1), cm, 0, 0.98, cz + 0.27, 0.15, 0, 0);
      for (const s of [-1, 1]) { put(rbox(0.1, 0.7, 0.14, 0.04), M.leather('#141416'), s * 0.24, 1.0, cz + 0.25, 0.15, 0, 0); put(box(0.06, 0.2, 0.04), M.black(), s * 0.27, 0.6, cz); put(rbox(0.08, 0.03, 0.26, 0.01), M.black(), s * 0.27, 0.71, cz - 0.02); }
      put(cushion(0.3, 0.12, 0.1, 0.04, 0.3), M.leather('#141416'), 0, 1.38, cz + 0.33, 0.15, 0, 0);
      put(cyl(0.03, 0.03, 0.35, 10), M.metal('#e8e8ec'), 0, 0.27, cz);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; put(box(0.32, 0.04, 0.04), M.black(), Math.cos(a) * 0.16, 0.08, cz + Math.sin(a) * 0.16, 0, -a, 0); put(sph(0.03, 8), M.black(), Math.cos(a) * 0.32, 0.03, cz + Math.sin(a) * 0.32); }
    } };

  DEF.pool = { styles: ['Classic', 'Modern', 'Tournament'], colors: [C('main', 'Felt', [['Green', '#1f6b3a'], ['Blue', '#1b4f8a'], ['Red', '#8a1a2a'], ['Black', '#1a1a1c'], ['Purple', '#4a2a7a'], ['Grey', '#6a6e74']], '#1f6b3a'), C('wood', 'Wood', FIN.wood, '#3a2618')],
    build(o, W, D) {
      const st = o.style, wd = st === 1 ? M.gloss(o.wood === '#dcc8a8' ? '#f2f2f0' : '#141416') : M.wood(o.wood), L = 2.54, w = 1.42, y = 0.8;
      put(rbox(L - 0.1, 0.16, w - 0.1, 0.02), wd, 0, y - 0.06, 0);
      put(box(L - 0.3, 0.03, w - 0.3), M.tex('felt', o.main, 0.95), 0, y + 0.03, 0);
      for (const s of [-1, 1]) { put(rbox(L, 0.08, 0.15, 0.02), wd, 0, y + 0.06, s * (w / 2 - 0.075)); put(rbox(0.15, 0.08, w, 0.02), wd, s * (L / 2 - 0.075), y + 0.06, 0); put(box(L - 0.3, 0.04, 0.03), M.tex('felt', o.main, 0.95), 0, y + 0.065, s * (w / 2 - 0.165)); put(box(0.03, 0.04, w - 0.3), M.tex('felt', o.main, 0.95), s * (L / 2 - 0.165), y + 0.065, 0); }
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) put(cyl(0.055, 0.05, 0.1, 16), M.black(), sx * (L / 2 - 0.12), y + 0.06, sz * (w / 2 - 0.12));
      for (let i = 0; i < 6; i++) put(sph(0.008, 6), M.porcelain('#f6f6f4'), -L / 2 + 0.4 + i * 0.35, y + 0.105, w / 2 - 0.075);
      if (st === 1) { for (const s of [-1, 1]) put(box(0.12, y - 0.1, w - 0.4), wd, s * (L / 2 - 0.45), (y - 0.1) / 2, 0); put(box(L - 0.9, 0.04, 0.04), M.metal('#e8e8ec'), 0, 0.12, 0); }
      else if (st === 2) { for (const s of [-1, 1]) put(box(0.3, y - 0.1, w - 0.3), wd, s * (L / 2 - 0.35), (y - 0.1) / 2, 0); put(box(L - 0.9, 0.3, 0.2), wd, 0, 0.3, 0); }
      else for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(lathe([[0.1, 0], [0.1, 0.05], [0.07, 0.1], [0.09, 0.3], [0.06, 0.5], [0.08, 0.7]], 16), wd, sx * (L / 2 - 0.2), 0, sz * (w / 2 - 0.2));
      // racked balls, the cue ball, two cues
      const colors = ['#e8c21a', '#1b4fc4', '#c41b1b', '#5a2a8a', '#ff7a1a', '#2f6b3a', '#7a1a1a', '#141416'];
      let k = 0; for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) { const ball = put(sph(0.028, 14), M.porcelain(r === 2 && c === 1 ? '#141416' : colors[k++ % 7]), 0.6 + r * 0.049, y + 0.073, (c - r / 2) * 0.057); }
      put(sph(0.028, 14), M.porcelain('#f6f6f4'), -0.6, y + 0.073, 0);
      for (const s of [-1, 1]) put(cyl(0.006, 0.014, 1.45, 10), M.wood('#c49a68'), -0.2 + s * 0.15, y + 0.12, s * 0.3, 0, 0.2 * s, Math.PI / 2 - 0.03);
      put(box(1.4, 0.08, 0.6), M.black(), 0, 1.85, 0); for (const s of [-1, 0, 1]) { put(lathe([[0.02, 0.16], [0.2, 0.0]], 20), M.paint('#1f3a2a'), s * 0.6, 1.62, 0); put(sph(0.04, 10), M.glow('#fff1d8'), s * 0.6, 1.64, 0); lamp(s * 0.6, 1.55, 0, 0xfff0d0, 3, 3); }
    } };

  DEF.arcade = { styles: ['Upright', 'Fighter', 'Racing'], colors: [C('main', 'Cabinet', [['Purple', '#2a1a4a'], ['Black', '#141416'], ['Red', '#7a1018'], ['Blue', '#162a6a'], ['White', '#e8e8ec']], '#2a1a4a'), C('accent', 'Marquee', FIN.accent, '#2cff7a')],
    build(o, W, D) {
      const st = o.style, cm = M.gloss(o.main), glow = M.glow(o.accent), z = -D / 2 + 0.45;
      if (st === 2) {   // a sit-down racer
        put(rbox(0.9, 1.5, 0.7, 0.03), cm, 0, 0.75, z - 0.1); put(new THREE.PlaneGeometry(0.72, 0.54), M.screen(TEX.scrGame), 0, 1.15, z + 0.26); put(box(0.85, 0.2, 0.3), glow, 0, 1.6, z - 0.05);
        put(tor(0.14, 0.02, 10, 32), M.black(), 0, 0.92, z + 0.45, -0.9, 0, 0); put(box(0.5, 0.3, 0.3), cm, 0, 0.75, z + 0.4);
        put(cushion(0.55, 0.12, 0.55, 0.05, 0.2), M.leather('#141416'), 0, 0.45, z + 1.05); put(cushion(0.55, 0.7, 0.12, 0.05, 0.1), M.leather('#141416'), 0, 0.8, z + 1.33, 0.2, 0, 0); put(box(0.6, 0.38, 0.65), cm, 0, 0.19, z + 1.05);
        put(box(0.15, 0.04, 0.24), M.metal('#c8ccd2'), 0.1, 0.12, z + 0.6, 0.3, 0, 0);
      } else {
        const sh = [[-0.36, 0], [0.36, 0], [0.36, 0.85], [0.42, 1.0], [0.36, 1.7], [0.36, 1.95], [0.05, 1.95], [-0.36, 1.95], [-0.36, 1.7]];
        for (const s of [-1, 1]) put(extrude([[0, 0], [0.75, 0], [0.75, 0.85], [0.97, 1.0], [0.95, 1.07], [0.8, 1.16], [0.86, 1.7], [0.86, 1.95], [0, 1.95]], 0.03, 0.005), cm, s * 0.375, 0, z - 0.4, 0, -Math.PI / 2, 0);
        put(box(0.72, 1.95, 0.7), cm, 0, 0.975, z - 0.05);
        put(box(0.72, 0.12, 0.3), cm, 0, 1.0, z + 0.42, 0.25, 0, 0);
        put(box(0.66, 0.5, 0.02), M.black(), 0, 1.38, z + 0.4, -0.25, 0, 0); put(new THREE.PlaneGeometry(0.58, 0.44), M.screen(st === 1 ? TEX.scrSports : TEX.scrGame), 0, 1.38, z + 0.415, -0.25, 0, 0);
        put(box(0.72, 0.22, 0.04), glow, 0, 1.82, z + 0.44);
        for (const p of [0, 1]) { const x = (p - 0.5) * 0.34; put(cyl(0.008, 0.008, 0.08, 8), M.metal('#e8e8ec'), x - 0.06, 1.12, z + 0.5, 0.25, 0, 0); put(sph(0.022, 10), M.gloss(p ? '#1b4fc4' : '#c41b1b'), x - 0.06, 1.16, z + 0.51); for (let b = 0; b < (st === 1 ? 6 : 3); b++) put(cyl(0.018, 0.018, 0.02, 14), M.gloss(['#c41b1b', '#e8c21a', '#1b4fc4', '#2cff7a', '#f2f2f2', '#e0559a'][b]), x + 0.03 + (b % 3) * 0.045, 1.1 + Math.floor(b / 3) * 0.04, z + 0.5 + Math.floor(b / 3) * 0.01, 0.25, 0, 0); }
        put(box(0.16, 0.12, 0.01), M.metal('#c8a050'), 0, 0.55, z + 0.31); put(box(0.04, 0.06, 0.012), glow, -0.03, 0.55, z + 0.32);
      }
      lamp(0, 1.4, z + 0.8, new THREE.Color(o.accent).getHex(), 2, 2.5);
    } };

  DEF.bar = { styles: ['Classic wood', 'Lit onyx', 'Speakeasy'], colors: [C('wood', 'Bar', FIN.wood, '#3a2618'), C('stone', 'Top', FIN.stone, 'nero'), C('accent', 'Lights', FIN.accent, '#d9b21b'), C('main', 'Stools', FIN.fabric, '#141416')],
    build(o, W, D) {
      const st = o.style, wd = M.wood(o.wood), glow = M.glow(o.accent), back = -D / 2, L = 3.2;
      // back bar shelves with bottles
      put(box(L, 2.3, 0.04), st === 2 ? M.tex('brick', '#ffffff', 0.85) : wd, 0, 1.15, back + 0.02);
      put(rbox(L, 0.9, 0.45, 0.01), wd, 0, 0.45, back + 0.24);
      put(rbox(L + 0.02, 0.04, 0.47, 0.005), surfMat(o.stone), 0, 0.92, back + 0.24);
      seed = 19;
      for (let r = 0; r < 3; r++) { const y = 1.2 + r * 0.38; put(st === 1 ? box(L - 0.2, 0.02, 0.22) : box(L - 0.2, 0.03, 0.22), st === 1 ? M.glass('#ffffff', 0.4) : wd, 0, y, back + 0.13); put(box(L - 0.22, 0.01, 0.01), glow, 0, y - 0.02, back + 0.23); for (let i = 0; i < 18; i++) { const x = -L / 2 + 0.2 + i * (L - 0.4) / 17, c = ['#2a5a2a', '#6a3a1a', '#e8e0d0', '#1a1a1a', '#8a1a2a', '#c89a2a'][Math.floor(rnd() * 6)], h = 0.18 + rnd() * 0.12; put(lathe([[0, 0], [0.035, 0], [0.035, h * 0.65], [0.012, h * 0.85], [0.012, h]], 12), M.glass(c, 0.75), x, y + 0.015, back + 0.13); } }
      lamp(0, 1.6, back + 0.4, new THREE.Color(o.accent).getHex(), 3, 3);
      put(rbox(0.5, 0.4, 0.04, 0.01), M.black(), 0, 2.05, back + 0.05); put(box(0.42, 0.06, 0.01), glow, 0, 2.05, back + 0.075);
      // the front bar with a foot rail and stools
      const fz = back + 1.35;
      put(rbox(L, 1.05, 0.55, 0.01), st === 1 ? M.stone(o.stone === 'butcher' ? 'nero' : o.stone) : wd, 0, 0.525, fz);
      if (st === 1) put(box(L - 0.1, 0.9, 0.01), M.glow(o.accent), 0, 0.5, fz + 0.28);
      if (st === 0) for (let i = 0; i < 6; i++) put(rbox(L / 6 - 0.06, 0.8, 0.02, 0.01), wd, -L / 2 + L / 12 + i * L / 6, 0.5, fz + 0.28);
      put(rbox(L + 0.15, 0.05, 0.7, 0.02), surfMat(o.stone), 0, 1.075, fz + 0.06);
      put(cyl(0.022, 0.022, L, 12), M.metal('#c8a050'), 0, 0.2, fz + 0.38, 0, 0, Math.PI / 2);
      const sm = M.leather(o.main);
      for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.75, z = fz + 0.75; put(cushion(0.42, 0.08, 0.42, 0.04, 0.3), sm, x, 0.78, z); put(cyl(0.025, 0.025, 0.74, 10), M.metal('#c8a050'), x, 0.39, z); put(cyl(0.2, 0.22, 0.02, 24), M.metal('#c8a050'), x, 0.01, z); put(tor(0.17, 0.012, 6, 24), M.metal('#c8a050'), x, 0.3, z, Math.PI / 2, 0, 0); if (st === 2) put(cushion(0.4, 0.3, 0.06, 0.03, 0.1), sm, x, 1.0, z + 0.2, -0.1, 0, 0); }
      // glasses on the bar
      for (let i = 0; i < 3; i++) put(lathe([[0, 0], [0.035, 0], [0.004, 0.01], [0.004, 0.08], [0.045, 0.14], [0.04, 0.16]], 16), M.glass('#ffffff', 0.35), -0.8 + i * 0.25, 1.1, fz);
    } };

  DEF.trophy = { styles: ['Glass case', 'Wall shelves', 'Championship belts'], colors: [C('wood', 'Wood', FIN.wood, '#3a2618'), C('metal', 'Trophies', FIN.metal, '#f0c25a')],
    build(o, W, D) {
      const st = o.style, wd = M.wood(o.wood), tm = metalMat(o.metal), back = -D / 2, w = 1.6, h = 2.1, z = back + 0.25;
      put(box(w, h, 0.03), st === 2 ? M.velvet('#141416') : wd, 0, h / 2, back + 0.02);
      if (st !== 1) { for (const s of [-1, 1]) put(box(0.05, h, 0.45), wd, s * w / 2, h / 2, z); put(box(w + 0.05, 0.08, 0.47), wd, 0, h, z); put(box(w + 0.05, 0.25, 0.47), wd, 0, 0.125, z); }
      const trophy = (x, y, s) => { put(cyl(0.05 * s, 0.06 * s, 0.05 * s, 6), M.black(), x, y + 0.025 * s, z); put(cyl(0.012 * s, 0.02 * s, 0.12 * s, 10), tm, x, y + 0.11 * s, z); put(lathe([[0, 0], [0.02, 0], [0.07, 0.06], [0.08, 0.16], [0.075, 0.16]], 20), tm, x, y + 0.17 * s, z); for (const sd of [-1, 1]) put(tor(0.035 * s, 0.006 * s, 6, 14, Math.PI), tm, x + sd * 0.085 * s, y + 0.28 * s, z, 0, 0, sd * Math.PI / 2); };
      const belt = (x, y) => { put(rbox(0.7, 0.12, 0.02, 0.01), M.leather('#141416'), x, y, z - 0.1); put(cyl(0.13, 0.13, 0.025, 28), tm, x, y, z - 0.09, Math.PI / 2, 0, 0); for (const sd of [-1, 1]) put(cyl(0.06, 0.06, 0.02, 20), tm, x + sd * 0.22, y, z - 0.09, Math.PI / 2, 0, 0); put(sph(0.02, 8), M.gloss('#c41b1b'), x, y, z - 0.07); };
      for (let r = 0; r < 4; r++) {
        const y = 0.3 + r * 0.45; put(box(w - 0.06, 0.02, 0.4), st === 1 ? wd : M.glass('#ffffff', 0.4), 0, y, z);
        put(box(w - 0.1, 0.01, 0.01), M.glow('#fff1d8'), 0, y + 0.42, z + 0.15);
        if (st === 2 && r > 0) belt(0, y + 0.18);
        else for (let i = 0; i < 4; i++) trophy((i - 1.5) * 0.36, y + 0.01, 0.6 + ((i + r) % 3) * 0.3);
      }
      if (st !== 1) put(box(w - 0.06, h - 0.35, 0.01), M.glass('#e8f4ff', 0.12), 0, h / 2 + 0.08, z + 0.23);
      lamp(0, 1.5, z + 0.5, 0xfff0d0, 2, 2.5);
    } };

  DEF.safe = { styles: ['Floor safe', 'Gun safe', 'Vault door'], colors: [C('main', 'Body', [['Gunmetal', '#3a3d42'], ['Matte black', '#141416'], ['Red', '#7a1018'], ['Camo green', '#3a4a2a'], ['White', '#e8e8ec']], '#3a3d42'), C('metal', 'Handle', FIN.metal, '#e8e8ec')],
    build(o, W, D) {
      const st = o.style, bm = M.paint(o.main), hm = metalMat(o.metal), z = -D / 2 + 0.4;
      if (st === 0) {
        put(box(1.6, 0.02, 1.6), M.wood('#7a5236'), 0, 0.01, 0); put(rbox(0.7, 0.03, 0.7, 0.01), bm, 0, 0.03, 0);
        put(cyl(0.12, 0.12, 0.03, 32), hm, 0, 0.05, 0); for (let i = 0; i < 24; i++) put(box(0.004, 0.004, 0.02), M.black(), Math.cos(i / 24 * TAU) * 0.105, 0.067, Math.sin(i / 24 * TAU) * 0.105, 0, -i / 24 * TAU, 0);
        put(box(0.2, 0.03, 0.03), hm, 0.2, 0.06, 0.2); put(rbox(0.65, 0.008, 0.65, 0.01), M.black(), 0, 0.016, 0);
        // stacks of cash and a chain beside the open lid
        for (let i = 0; i < 4; i++) put(box(0.16, 0.04, 0.07), M.matte('#7aa06a'), -0.55 + i * 0.03, 0.04 + i * 0.04, 0.5, 0, i * 0.2, 0);
      } else if (st === 1) {
        put(rbox(0.85, 1.6, 0.65, 0.02), bm, 0, 0.8, z);
        put(rbox(0.75, 1.5, 0.04, 0.02), bm, 0, 0.8, z + 0.34);
        put(cyl(0.07, 0.07, 0.03, 32), hm, 0, 1.0, z + 0.38, Math.PI / 2, 0, 0);
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; put(cyl(0.012, 0.012, 0.16, 8), hm, Math.cos(a) * 0.1, 0.8 + Math.sin(a) * 0.1, z + 0.4, 0, 0, a + Math.PI / 2); put(sph(0.02, 8), hm, Math.cos(a) * 0.18, 0.8 + Math.sin(a) * 0.18, z + 0.4); }
        put(box(0.4, 0.06, 0.005), M.metal('#c8a050'), 0, 1.4, z + 0.365);
        for (const y of [0.3, 1.3]) for (const s of [-1]) put(cyl(0.025, 0.025, 0.12, 12), M.metal('#c8ccd2'), 0.38, y, z + 0.34);
      } else {
        put(box(2.0, 2.4, 0.3), M.stone('concrete'), 0, 1.2, -D / 2 + 0.15);
        put(cyl(0.9, 0.9, 0.12, 48), bm, 0, 1.15, -D / 2 + 0.36, Math.PI / 2, 0, 0); put(tor(0.92, 0.04, 10, 48), hm, 0, 1.15, -D / 2 + 0.36);
        put(cyl(0.2, 0.2, 0.1, 32), hm, 0, 1.15, -D / 2 + 0.47, Math.PI / 2, 0, 0);
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3; put(cyl(0.02, 0.02, 0.6, 10), hm, Math.cos(a) * 0.3, 1.15 + Math.sin(a) * 0.3, -D / 2 + 0.55, 0, 0, a + Math.PI / 2); }
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; put(cyl(0.035, 0.035, 0.06, 12), hm, Math.cos(a) * 0.78, 1.15 + Math.sin(a) * 0.78, -D / 2 + 0.43, Math.PI / 2, 0, 0); }
      }
    } };

  DEF.piano = { styles: ['Concert grand', 'Baby grand', 'Lid closed'], colors: [C('main', 'Finish', [['Gloss black', '#0c0c0e'], ['White', '#f2f2f0'], ['Red', '#8a0e16'], ['Walnut', 'walnut'], ['Gold leaf', 'gold']], '#0c0c0e')],
    build(o, W, D) {
      const st = o.style, pm = o.main === 'walnut' ? M.wood('#5a3a22') : o.main === 'gold' ? M.metal('#d8b050') : M.porcelain(o.main), L = st === 1 ? 1.6 : 2.4;
      const zk = (L - 0.95) / 2;   // keyboard line; the case runs back (-z) from here, the bench sits in front
      // outline seen from above (x across, d back from the keys): straight bass side on the left, bentside on the right
      const out = [[-0.76, 0], [0.76, 0], [0.76, 0.28]];
      for (let k = 1; k <= 20; k++) { const t = k / 20, sm = t * t * (3 - 2 * t); out.push([0.76 - 1.2 * sm, 0.28 + (L - 0.42) * t]); }
      for (let k = 1; k <= 8; k++) { const a = k / 8 * Math.PI / 2; out.push([-0.44 - 0.32 * Math.sin(a), L - 0.14 - 0.14 * (1 - Math.cos(a)) + 0.14 * Math.sin(a) * 0]); }
      out.push([-0.76, L * 0.9]);
      const shape = (pts, k = 1, cx = 0, cd = L * 0.5) => { const s = new THREE.Shape(); pts.forEach(([x, d], i) => { const X = cx + (x - cx) * k, Y = cd + (d - cd) * k; i ? s.lineTo(X, Y) : s.moveTo(X, Y); }); return s; };
      const flat = (s, depth, bevel = 0.008) => { const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 }); return g; };
      put(flat(shape(out), 0.25), pm, 0, 0.62, zk, -Math.PI / 2, 0, 0);                 // body
      const rimS = shape(out); rimS.holes.push(shape(out, 0.95, 0, L * 0.48)); put(flat(rimS, 0.08, 0.006), pm, 0, 0.87, zk, -Math.PI / 2, 0, 0);
      put(flat(shape(out, 0.86, 0, L * 0.5), 0.012, 0), M.metal('#c8a050'), 0, 0.875, zk, -Math.PI / 2, 0, 0);  // the gold plate
      for (let i = 0; i < 9; i++) put(box(0.004, 0.004, L * 0.7), M.metal('#e8e8ec'), -0.5 + i * 0.1, 0.892, zk - L * 0.42, 0, -0.18, 0);  // strings
      // keyboard
      put(box(1.52, 0.06, 0.34), pm, 0, 0.72, zk + 0.15);
      for (const s of [-1, 1]) put(rbox(0.08, 0.14, 0.34, 0.01), pm, s * 0.72, 0.77, zk + 0.15);
      const kw = 1.36 / 52;
      put(box(1.36, 0.022, 0.15), M.porcelain('#f8f6f0'), 0, 0.762, zk + 0.24);
      for (let i = 1; i < 52; i++) put(box(0.0015, 0.023, 0.15), M.matte('#b8b4ac'), -0.68 + i * kw, 0.763, zk + 0.24);
      for (let i = 0; i < 51; i++) if ([0, 1, 3, 4, 5].includes((i + 5) % 7)) put(box(kw * 0.55, 0.024, 0.09), M.gloss('#0c0c0e'), -0.68 + (i + 1) * kw, 0.785, zk + 0.205);
      put(box(1.36, 0.1, 0.04), pm, 0, 0.82, zk + 0.12);
      put(rbox(0.66, 0.26, 0.02, 0.006), pm, 0, 1.05, zk + 0.02, -0.22, 0, 0);
      // legs, lyre and pedals
      for (const [x, d] of [[-0.64, 0.12], [0.64, 0.12], [-0.5, L - 0.3]]) put(lathe([[0.075, 0], [0.085, 0.04], [0.06, 0.1], [0.07, 0.5], [0.095, 0.62]], 16), pm, x, 0, zk - d);
      put(box(0.22, 0.5, 0.05), pm, 0, 0.36, zk - 0.18); put(box(0.3, 0.05, 0.12), pm, 0, 0.08, zk - 0.14);
      for (const x of [-0.06, 0, 0.06]) put(box(0.026, 0.012, 0.09), M.metal('#d8b050'), x, 0.07, zk - 0.05);
      // lid, hinged on the straight side, up on its stick
      const lidPiv = new THREE.Group(); lidPiv.position.set(-0.76, 0.955, zk); G.add(lidPiv);
      const lid = put(flat(shape(out), 0.02, 0.004), pm, 0.76, 0, 0, -Math.PI / 2, 0, 0, lidPiv);
      if (st !== 2) {
        const ang = st === 1 ? 0.42 : 0.55, dz = zk - L * 0.5, r = 0.9;
        lidPiv.rotation.z = ang;
        put(tube([[0.08, 0.95, dz], [-0.76 + r * Math.cos(ang), 0.955 + r * Math.sin(ang) - 0.02, dz]], 0.011, 2, 8), pm);
      }
      // a bench
      put(cushion(0.8, 0.08, 0.36, 0.03, 0.2), M.leather('#141416'), 0, 0.5, zk + 0.75); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cyl(0.025, 0.02, 0.46, 10), pm, sx * 0.34, 0.23, zk + 0.75 + sz * 0.14);
    } };

  DEF.gym = { styles: ['Power rack', 'Cardio', 'Boxing'], colors: [C('main', 'Frame', [['Black', '#141416'], ['Red', '#9a1018'], ['White', '#e8e8ec'], ['Gold', '#c8a050']], '#141416'), C('accent', 'Plates', FIN.accent, '#c41b1b')],
    build(o, W, D) {
      const st = o.style, fm = o.main === '#c8a050' ? M.metal('#c8a050') : M.paint(o.main), am = M.gloss(o.accent), back = -D / 2;
      put(box(3.6, 0.03, 1.9), M.rubber(), 0, 0.015, 0);
      put(box(3.6, 1.6, 0.02), M.metal('#dfe6ec'), 0, 1.1, back + 0.01);
      if (st === 0) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(box(0.07, 2.2, 0.07), fm, -0.6 + sx * 0.55, 1.1, back + 0.7 + sz * 0.5);
        for (const sz of [-1, 1]) put(box(1.18, 0.07, 0.07), fm, -0.6, 2.18, back + 0.7 + sz * 0.5); for (const sx of [-1, 1]) put(box(0.07, 0.07, 1.07), fm, -0.6 + sx * 0.55, 2.18, back + 0.7);
        put(cyl(0.015, 0.015, 2.1, 10), M.metal('#c8ccd2'), -0.6, 1.4, back + 1.15, 0, 0, Math.PI / 2);
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) put(cyl(0.22 - k * 0.04, 0.22 - k * 0.04, 0.045, 28), k ? M.black() : am, -0.6 + s * (0.75 + k * 0.05), 1.4, back + 1.15, 0, 0, Math.PI / 2);
        put(cushion(0.3, 0.1, 1.2, 0.04, 0.2), M.leather('#141416'), -0.6, 0.45, back + 0.75); put(box(0.1, 0.4, 0.1), fm, -0.6, 0.2, back + 0.75);
        for (let i = 0; i < 6; i++) { const x = 0.6 + i * 0.2; for (const s of [-1, 1]) put(rbox(0.06, 0.1 + i * 0.01, 0.06, 0.02), M.black(), x + s * 0.06, 0.15, back + 0.25); put(cyl(0.015, 0.015, 0.1, 8), M.metal('#c8ccd2'), x, 0.15, back + 0.25, 0, 0, Math.PI / 2); }
        put(box(1.3, 0.04, 0.3), fm, 1.1, 0.08, back + 0.25);
      } else if (st === 1) {
        put(rbox(0.8, 0.2, 1.9, 0.04), fm, -0.8, 0.12, 0); put(box(0.5, 0.02, 1.4), M.rubber(), -0.8, 0.23, 0.05); for (const s of [-1, 1]) put(cyl(0.025, 0.025, 1.1, 10), fm, -0.8 + s * 0.35, 0.75, -0.75, 0.2, 0, 0); put(rbox(0.8, 0.3, 0.12, 0.04), fm, -0.8, 1.35, -0.85, -0.6, 0, 0); put(new THREE.PlaneGeometry(0.5, 0.25), M.screen(TEX.scrSports), -0.8, 1.37, -0.78, -0.6, 0, 0);
        put(rbox(0.5, 0.6, 1.3, 0.05), fm, 0.8, 0.35, 0); put(cushion(0.35, 0.08, 0.3, 0.03, 0.2), M.leather('#141416'), 0.8, 0.95, 0.2); put(cyl(0.02, 0.02, 0.4, 8), fm, 0.8, 0.75, 0.2); put(tor(0.2, 0.06, 10, 28), am, 0.8, 0.35, -0.5, 0, Math.PI / 2, 0); put(cyl(0.02, 0.02, 0.8, 8), fm, 0.8, 1.0, -0.4, -0.3, 0, 0);
      } else {
        put(cyl(0.006, 0.006, 0.8, 6), M.black(), -0.5, 2.4, 0); put(cyl(0.18, 0.18, 1.1, 24), M.leather(o.accent), -0.5, 1.45, 0); put(cyl(0.19, 0.19, 0.06, 24), M.leather('#141416'), -0.5, 1.95, 0);
        for (const s of [-1, 1]) { const g = put(sph(0.08, 14), M.leather(o.accent), 0.5 + s * 0.15, 1.6, back + 0.08); g.scale.set(1, 1.2, 1.1); }
        put(rbox(0.8, 0.4, 0.4, 0.03), M.wood('#7a5236'), 0.8, 0.2, back + 0.25); put(cyl(0.006, 0.006, 0.6, 6), M.matte('#e8c21a'), 0.5, 1.4, back + 0.06);
        put(tor(0.12, 0.006, 6, 24), M.matte('#e8c21a'), 0.8, 0.43, back + 0.25, Math.PI / 2, 0, 0);
      }
    } };

  DEF.wine = { styles: ['Floor to ceiling', 'Glass cellar', 'Barrel corner'], colors: [C('wood', 'Racks', FIN.wood, '#3a2618'), C('accent', 'Lights', FIN.accent, '#d9b21b')],
    build(o, W, D) {
      const st = o.style, wd = M.wood(o.wood), back = -D / 2, w = 1.8, h = 2.4, z = back + 0.22;
      put(box(w, h, 0.03), st === 1 ? M.stone('nero') : M.tex('brick', '#ffffff', 0.85), 0, h / 2, back + 0.015);
      seed = 5;
      const wineCols = ['#3a0a12', '#5a1a1a', '#2a3a1a', '#d8c890'];
      if (st === 2) {
        for (const [x, y] of [[-0.45, 0.4], [0.45, 0.4], [0, 1.15]]) { const b = put(lathe([[0.3, 0], [0.38, 0.3], [0.4, 0.45], [0.38, 0.6], [0.3, 0.9]], 24), wd, x, y - 0.4, z + 0.3, Math.PI / 2, 0, 0); b.position.set(x, y + 0.0, z + 0.3 - 0.45); b.rotation.set(Math.PI / 2, 0, 0); for (const k of [0.15, 0.75]) put(tor(0.36, 0.012, 6, 32), M.metal('#2a2a2c'), x, y, z - 0.15 + k * 0.9); put(cyl(0.3, 0.3, 0.01, 24), M.wood('#c49a68'), x, y, z + 0.46, Math.PI / 2, 0, 0); }
      } else {
        for (const s of [-1, 1]) put(box(0.04, h, 0.42), wd, s * w / 2, h / 2, z);
        const rows = 12, cols = 9;
        for (let r = 0; r < rows; r++) { const y = 0.12 + r * (h - 0.2) / rows; put(box(w, 0.015, 0.4), wd, 0, y, z); for (let c = 0; c < cols; c++) { if (rnd() < 0.12) continue; const x = -w / 2 + 0.1 + c * (w - 0.2) / (cols - 1); put(cyl(0.037, 0.037, 0.3, 12), M.glass(wineCols[Math.floor(rnd() * 4)], 0.9), x, y + 0.045, z + 0.02, Math.PI / 2, 0, 0); put(cyl(0.013, 0.013, 0.08, 8), M.matte('#e8dcc0'), x, y + 0.045, z + 0.2, Math.PI / 2, 0, 0); } }
        for (const s of [-1, 1]) put(box(0.012, h - 0.1, 0.012), M.glow(o.accent), s * (w / 2 - 0.04), h / 2, z + 0.2);
        if (st === 1) { put(box(w + 0.1, h, 0.012), M.glass('#d8e8f0', 0.18), 0, h / 2, z + 0.4); put(box(0.02, h, 0.03), M.metal('#2a2a2c'), 0, h / 2, z + 0.4); put(box(0.02, 0.5, 0.03), M.metal('#e8e8ec'), -0.1, 1.1, z + 0.43); }
      }
      lamp(0, 1.6, z + 0.6, new THREE.Color(o.accent).getHex(), 2.5, 3);
      put(lathe([[0, 0], [0.035, 0], [0.004, 0.01], [0.004, 0.1], [0.045, 0.14], [0.05, 0.2], [0.045, 0.22]], 16), M.glass('#ffffff', 0.35), 0.6, 0.0, z + 0.9);
    } };

  // ---------- Outdoor ----------
  DEF.grill = { styles: ['Offset smoker', 'Kettle', 'Pellet grill'], colors: [C('main', 'Finish', [['Black', '#1a1a1a'], ['Red', '#8a1a1a'], ['Stainless', '#c8ccd2'], ['Camo green', '#3a4a2a']], '#1a1a1a'), C('wood', 'Shelf', FIN.wood, '#7a5236')],
    build(o, W, D) {
      const st = o.style, bm = o.main === '#c8ccd2' ? M.brushed(o.main) : M.paint(o.main), wd = M.wood(o.wood), smoke = [];
      if (st === 1) {
        put(sph(0.3, 28), bm, 0, 0.82, 0).scale.set(1, 0.55, 1); put(sph(0.3, 28), bm, 0, 0.86, 0).scale.set(1, 0.6, 1);
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; put(cyl(0.015, 0.015, 0.75, 8), bm, Math.cos(a) * 0.22, 0.38, Math.sin(a) * 0.22, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); }
        put(tor(0.06, 0.012, 6, 16, Math.PI), M.black(), 0, 1.1, 0, 0, 0, 0);
      } else {
        const L = st === 2 ? 1.0 : 1.2, x0 = st === 2 ? 0 : -0.1;
        const drum = put(cyl(0.3, 0.3, L, 32), bm, x0, 0.95, 0, 0, 0, Math.PI / 2);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(box(0.05, 0.85, 0.05), bm, x0 + sx * (L / 2 - 0.1), 0.42, sz * 0.25);
        put(box(L - 0.1, 0.03, 0.5), wd, x0, 0.25, 0);
        for (let i = 0; i < 2; i++) put(cyl(0.12, 0.12, 0.05, 16), M.rubber(), x0 - L / 2 + 0.1, 0.12, (i - 0.5) * 0.6, Math.PI / 2, 0, 0);
        put(cyl(0.012, 0.012, L * 0.8, 8), M.metal('#e8e8ec'), x0, 1.08, 0.36, 0, 0, Math.PI / 2);
        if (st === 0) { put(box(0.45, 0.45, 0.45), bm, x0 + L / 2 + 0.2, 0.85, 0); put(cyl(0.07, 0.07, 0.8, 16), bm, x0 - L / 2 + 0.1, 1.4, -0.1); put(cyl(0.06, 0.06, 0.04, 16), M.metal('#c8ccd2'), x0, 1.0, 0.31, Math.PI / 2, 0, 0); }
        else { put(box(0.35, 0.55, 0.4), bm, x0 + L / 2 + 0.17, 1.05, 0); put(box(0.15, 0.1, 0.01), M.glow('#ff3a2a'), x0 + L / 2 + 0.17, 1.2, 0.2); put(cyl(0.04, 0.04, 0.3, 12), bm, x0 - 0.3, 1.35, -0.1); }
        put(box(0.45, 0.03, 0.5), wd, x0 - L / 2 - 0.25, 0.9, 0);
        for (let i = 0; i < 3; i++) put(cyl(0.004, 0.004, 0.25, 6), M.metal('#c8ccd2'), x0 - L / 2 - 0.25 + (i - 1) * 0.1, 0.8, -0.2);
      }
      // a little smoke
      const sm = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.18, depthWrite: false });
      const sx = st === 1 ? 0 : st === 0 ? -0.6 : -0.3, sy = st === 1 ? 1.1 : st === 0 ? 1.8 : 1.5;
      for (let i = 0; i < 6; i++) { const s = put(sph(0.08, 10), sm, sx, sy, -0.1); s.castShadow = false; smoke.push(s); }
      ANIM.push(t => smoke.forEach((s, i) => { const k = (t * 0.25 + i / 6) % 1; s.position.set(sx + Math.sin(k * 6 + i) * 0.08, sy + k * 1.2, -0.1); s.scale.setScalar(0.6 + k * 2.2); s.material.opacity = 0.18; }));
    } };

  DEF.jacuzzi = { styles: ['Square', 'Round', 'Sunken'], colors: [C('wood', 'Cabinet', [...FIN.wood, ['Grey', '#6a6e74']], '#7a5236'), C('accent', 'Lights', FIN.accent, '#1a9a9a')],
    build(o, W, D) {
      const st = o.style, wd = o.wood === '#6a6e74' ? M.paint(o.wood) : M.wood(o.wood), shell = M.porcelain('#e8ecf0'), h = st === 2 ? 0.45 : 0.95;
      const waterM = new THREE.MeshPhysicalMaterial({ color: col('#5ad0e8'), roughness: 0.04, transparent: true, opacity: 0.5, depthWrite: false, envMapIntensity: 1.5 });
      let water;
      const dep = st === 2 ? h - 0.03 : 0.75;   // tub depth below the rim
      if (st === 1) { put(cyl(1.15, 1.15, h, 48, true), wd, 0, h / 2, 0); put(tor(1.06, 0.09, 10, 48), shell, 0, h, 0, Math.PI / 2, 0, 0); put(cyl(1.0, 0.9, dep, 48, true), M.porcelain('#dfe8ee'), 0, h - dep / 2, 0); put(new THREE.CircleGeometry(0.9, 48), M.porcelain('#dfe8ee'), 0, h - dep + 0.01, 0, -Math.PI / 2, 0, 0); water = put(new THREE.CircleGeometry(1.0, 48, 0, TAU), waterM, 0, h - 0.12, 0, -Math.PI / 2, 0, 0); }
      else {
        if (st === 2) { const deck = M.stone('stone'); for (const [x, z, w, d] of [[0, -1.45, 3.6, 0.7], [0, 1.45, 3.6, 0.7], [-1.45, 0, 0.7, 2.2], [1.45, 0, 0.7, 2.2]]) put(box(w, h, d), deck, x, h / 2, z); }
        else for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; put(box(2.3, h, 0.12), wd, Math.sin(a) * 1.09, h / 2, Math.cos(a) * 1.09, 0, a, 0); }
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; put(rbox(2.3, 0.08, 0.16, 0.03), shell, Math.sin(a) * 1.07, h, Math.cos(a) * 1.07, 0, a, 0); put(box(2.0, dep, 0.03), M.porcelain('#dfe8ee'), Math.sin(a) * 1.0, h - dep / 2, Math.cos(a) * 1.0, 0, a, 0); }
        put(box(2.0, 0.03, 2.0), M.porcelain('#dfe8ee'), 0, h - dep, 0);
        if (st !== 2) for (const [x, z, ry] of [[0, -0.86, 0], [0, 0.86, Math.PI], [-0.86, 0, Math.PI / 2], [0.86, 0, -Math.PI / 2]]) put(rbox(1.5, 0.08, 0.3, 0.03), M.porcelain('#dfe8ee'), x, h - dep + 0.32, z, 0, ry, 0);  // seats
        water = put(new THREE.PlaneGeometry(2.0, 2.0, 24, 24), waterM, 0, h - 0.12, 0, -Math.PI / 2, 0, 0);
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = st === 1 ? 0.85 : 0.9; put(cyl(0.04, 0.04, 0.01, 12), M.glow(o.accent), Math.cos(a) * r, h - 0.3, Math.sin(a) * r * (st === 1 ? 1 : 1.0), Math.PI / 2, 0, -a + Math.PI / 2); }
      lamp(0, h - 0.2, 0, new THREE.Color(o.accent).getHex(), 4, 3.5);
      if (st !== 2) { put(box(0.9, 0.25, 0.4), wd, 0, 0.12, 1.4); }
      // bubbles
      const bub = M.glass('#ffffff', 0.5), bubbles = [];
      for (let i = 0; i < 24; i++) { const b = put(sph(0.02 + hash(i) * 0.02, 8), bub, 0, 0, 0); b.castShadow = false; bubbles.push(b); }
      const p = water.geometry.attributes.position, base = Float32Array.from(p.array);
      ANIM.push(t => {
        for (let i = 0; i < p.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; p.setZ(i, Math.sin(x * 4 + t * 2) * 0.012 + Math.cos(y * 5 + t * 2.6) * 0.01); } p.needsUpdate = true; water.geometry.computeVertexNormals();
        bubbles.forEach((b, i) => { const a = i * 2.4 + t * 0.3, r = 0.2 + hash(i) * 0.7; b.position.set(Math.cos(a) * r, h - 0.13 + Math.abs(Math.sin(t * 3 + i)) * 0.03, Math.sin(a) * r); });
      });
    } };

  DEF.chairs = { styles: ['Adirondack', 'Lounge', 'Rockers'], colors: [C('wood', 'Wood', [...FIN.wood, ['White', '#f2f2f0'], ['Red', '#9a1a1a']], '#7a5236'), C('main', 'Cushions', FIN.fabric, '#e6dfd2')],
    build(o, W, D) {
      const st = o.style, wd = o.wood === '#f2f2f0' || o.wood === '#9a1a1a' ? M.paint(o.wood) : M.wood(o.wood), cm = M.fabric(o.main);
      const one = (x, ry) => {
        const g = new THREE.Group(); g.position.set(x, 0, 0); g.rotation.y = ry; G.add(g); const P = (geo, m, a, b, c, rx = 0, rY = 0, rz = 0) => put(geo, m, a, b, c, rx, rY, rz, g);
        if (st === 0) { for (let i = 0; i < 6; i++) P(box(0.07, 0.02, 0.55), wd, (i - 2.5) * 0.085, 0.36 - 0.04, 0.05, -0.1, 0, 0); for (let i = 0; i < 5; i++) P(box(0.08, 0.85, 0.02), wd, (i - 2) * 0.1, 0.72, -0.32, -0.4, 0, 0); for (const s of [-1, 1]) { P(box(0.12, 0.02, 0.7), wd, s * 0.33, 0.6, 0.0); P(box(0.04, 0.6, 0.06), wd, s * 0.3, 0.3, 0.3); P(box(0.04, 0.4, 0.06), wd, s * 0.3, 0.2, -0.25, -0.3, 0, 0); } P(cushion(0.48, 0.08, 0.48, 0.03, 0.2), cm, 0, 0.38, 0.05, -0.1, 0, 0); }
        else if (st === 1) { P(rbox(0.7, 0.12, 1.8, 0.02), wd, 0, 0.3, 0.3); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(box(0.05, 0.25, 0.05), wd, sx * 0.3, 0.12, 0.3 + sz * 0.8); P(cushion(0.66, 0.08, 1.2, 0.03, 0.2), cm, 0, 0.41, 0.6); P(cushion(0.66, 0.08, 0.6, 0.03, 0.2), cm, 0, 0.6, -0.35, -0.9, 0, 0); P(rbox(0.68, 0.05, 0.65, 0.02), wd, 0, 0.58, -0.38, -0.9, 0, 0); }
        else { for (const s of [-1, 1]) { P(tor(0.6, 0.025, 6, 24, 0.9), wd, s * 0.28, 0.6, 0.0, 0, Math.PI / 2, -Math.PI / 2 - 0.45); P(box(0.04, 0.5, 0.04), wd, s * 0.28, 0.3, 0.2); P(box(0.04, 0.9, 0.04), wd, s * 0.28, 0.5, -0.22, -0.15, 0, 0); P(box(0.07, 0.03, 0.55), wd, s * 0.3, 0.68, 0.0); } P(rbox(0.55, 0.04, 0.5, 0.01), wd, 0, 0.45, 0.0); for (let i = 0; i < 6; i++) P(box(0.04, 0.6, 0.02), wd, (i - 2.5) * 0.09, 0.85, -0.27, -0.15, 0, 0); P(cushion(0.5, 0.07, 0.45, 0.03, 0.2), cm, 0, 0.5, 0.0); }
        return g;
      };
      one(-0.55, 0.25); one(0.55, -0.25);
      put(cyl(0.26, 0.26, 0.03, 24), wd, 0, 0.5, 0.45); put(cyl(0.025, 0.025, 0.5, 10), M.metal('#2a2a2c'), 0, 0.25, 0.45); put(cyl(0.2, 0.22, 0.02, 24), M.metal('#2a2a2c'), 0, 0.01, 0.45);
      put(lathe([[0, 0], [0.035, 0], [0.004, 0.01], [0.004, 0.08], [0.045, 0.14], [0.04, 0.17]], 16), M.glass('#ffffff', 0.35), 0.08, 0.515, 0.45); put(cyl(0.035, 0.03, 0.12, 12), M.gloss('#e8c21a'), -0.08, 0.575, 0.45);
    } };

  DEF.firepit = { styles: ['Stone ring', 'Square gas', 'Steel bowl'], colors: [C('stone', 'Stone', [['Stone', 'stone'], ['Concrete', 'concrete'], ['Granite', 'granite'], ['Black marble', 'nero']], 'stone'), C('accent', 'Flame', [['Fire orange', '#ff7a1a'], ['Blue gas', '#3a8aff'], ['Purple', '#8a3aff']], '#ff7a1a')],
    build(o, W, D) {
      const st = o.style, sm = o.stone === 'stone' ? M.tex('stone', '#ffffff', 0.85) : M.stone(o.stone), y = st === 2 ? 0.5 : 0.4;
      if (st === 0) { put(cyl(0.6, 0.65, 0.4, 24, true), sm, 0, 0.2, 0); put(tor(0.55, 0.08, 8, 24), sm, 0, 0.4, 0, Math.PI / 2, 0, 0); put(cyl(0.48, 0.48, 0.3, 24), M.matte('#2a2420'), 0, 0.15, 0); for (let i = 0; i < 4; i++) put(cyl(0.05, 0.05, 0.6, 10), M.wood('#3a2a1e'), 0, 0.36, 0, 0, i * 0.8, Math.PI / 2 - 0.3); }
      else if (st === 1) { put(rbox(1.2, 0.4, 1.2, 0.02), sm, 0, 0.2, 0); put(box(0.8, 0.02, 0.8), M.black(), 0, 0.405, 0); for (let i = 0; i < 40; i++) put(sph(0.03, 6), M.glass('#a8d8ff', 0.7), (hash(i) - 0.5) * 0.7, 0.42, (hash(i * 3) - 0.5) * 0.7); }
      else { put(lathe([[0, 0.3], [0.45, 0.32], [0.55, 0.5], [0.53, 0.5], [0.43, 0.34], [0, 0.32]], 32), M.paint('#4a2a1a'), 0, 0, 0); put(cyl(0.08, 0.2, 0.3, 16), M.paint('#4a2a1a'), 0, 0.15, 0); }
      const fm = new THREE.MeshBasicMaterial({ color: col(o.accent), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const flames = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r = i ? 0.15 : 0; const f = put(new THREE.ConeGeometry(0.07, 0.35, 8), fm, Math.cos(a) * r, y + 0.15, Math.sin(a) * r); f.castShadow = false; flames.push(f); }
      const fl = lamp(0, y + 0.4, 0, new THREE.Color(o.accent).getHex(), 0, 5); fl.intensity = 3; LIGHTS.pop();
      ANIM.push(t => { flames.forEach((f, i) => { const k = 0.7 + 0.35 * Math.sin(t * 9 + i * 1.7) + 0.15 * Math.sin(t * 23 + i); f.scale.set(1, k, 1); f.position.y = y + 0.04 + 0.17 * k; }); fl.intensity = 2.6 + Math.sin(t * 13) * 0.5; });
      // log seats around it
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; put(cyl(0.22, 0.22, 0.42, 16), M.wood('#7a5236'), Math.cos(a) * 1.2, 0.21, Math.sin(a) * 1.2); put(cyl(0.21, 0.21, 0.01, 16), M.wood('#c49a68'), Math.cos(a) * 1.2, 0.425, Math.sin(a) * 1.2); }
    } };

  // ---------- Stairs ----------
  DEF.stairs = { styles: ['Open treads', 'Carpet runner', 'Glass rail'], colors: [C('wood', 'Treads', FIN.wood, '#7a5236'), C('metal', 'Rail', FIN.metal, '#2a2a2c'), C('main', 'Runner', FIN.fabric, '#22345a')],
    build(o, W, D) {
      const st = o.style, wd = M.wood(o.wood), mm = metalMat(o.metal), n = 17, rise = 3.2 / n, run = (D - 0.2) / n, w = 1.1, z0 = D / 2 - 0.1;
      for (let i = 0; i < n; i++) { const y = rise * (i + 1), z = z0 - run * (i + 0.5); put(rbox(w, 0.05, run + 0.03, 0.01), wd, 0, y - 0.025, z); if (st === 1) { put(box(0.7, 0.012, run), M.fabric(o.main), 0, y + 0.006, z); put(box(0.7, rise, 0.012), M.fabric(o.main), 0, y - rise / 2, z + run / 2); } else if (st === 0) {} else put(box(w, rise - 0.05, 0.02), M.paint('#f2f2f0'), 0, y - rise / 2, z + run / 2); }
      for (const s of [-1, 1]) { const len = Math.hypot(3.2, D - 0.2); put(box(0.06, 0.3, len), st === 2 ? M.paint('#f2f2f0') : mm, s * (w / 2 + 0.03), 1.6 - 0.12, 0, Math.atan2(3.2, D - 0.2), 0, 0); }
      const len = Math.hypot(3.2, D - 0.2), ang = Math.atan2(3.2, D - 0.2);
      if (st === 2) put(box(0.012, 0.9, len), M.glass('#d8e8f0', 0.2), w / 2 + 0.03, 1.6 + 0.4, 0, ang, 0, 0);
      else for (let i = 0; i < n; i += 2) { const y = rise * (i + 1), z = z0 - run * (i + 0.5); put(cyl(0.012, 0.012, 0.9, 8), mm, w / 2 + 0.03, y + 0.45, z); }
      put(cyl(0.025, 0.025, len, 12), st === 2 ? M.wood(o.wood) : mm, w / 2 + 0.03, 1.6 + 0.9, 0, ang - Math.PI / 2, 0, 0);
    } };

  DEF.spiral = { styles: ['Steel', 'Wood treads', 'Glass treads'], colors: [C('metal', 'Steel', FIN.metal, '#2a2a2c'), C('wood', 'Treads', FIN.wood, '#7a5236')],
    build(o, W, D) {
      const st = o.style, mm = metalMat(o.metal), tm = st === 0 ? mm : st === 1 ? M.wood(o.wood) : M.glass('#d8e8f0', 0.45), n = 15, rise = 3.2 / n, R = 0.85;
      put(cyl(0.06, 0.06, 3.4, 16), mm, 0, 1.7, 0);
      const rail = [];
      for (let i = 0; i < n; i++) {
        const a = i * (TAU * 0.85) / n, y = rise * (i + 1), sh = new THREE.Shape(); sh.moveTo(0, 0); sh.absarc(0, 0, R, -0.25, 0.25, false); sh.lineTo(0, 0);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 8 }); put(g, tm, 0, y, 0, -Math.PI / 2, 0, a);
        G.children[G.children.length - 1].rotation.set(-Math.PI / 2, 0, -a);
        put(cyl(0.01, 0.01, 0.9, 6), mm, Math.cos(a) * (R - 0.04), y + 0.45, Math.sin(a) * (R - 0.04));
        rail.push([Math.cos(a) * (R - 0.04), y + 0.9, Math.sin(a) * (R - 0.04)]);
      }
      put(tube(rail, 0.02, 80, 8), mm);
      put(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.02, 40, 1, false, 0, TAU * 0.25), M.wood(o.wood), 0, 3.21, 0);
    } };

  DEF.elevator = { styles: ['Glass', 'Brushed steel', 'Wood panel'], colors: [C('metal', 'Frame', FIN.metal, '#b8bcc2'), C('accent', 'Light', FIN.accent, '#f2f2f2')],
    build(o, W, D) {
      const st = o.style, mm = metalMat(o.metal), w = 1.4, d = 1.4, h = 2.4;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(box(0.08, h + 0.4, 0.08), mm, sx * w / 2, (h + 0.4) / 2, sz * d / 2);
      const wall = st === 0 ? M.glass('#d8e8f0', 0.2) : st === 1 ? M.brushed(o.metal === '#2a2a2c' ? '#b8bcc2' : o.metal) : M.wood('#7a5236');
      put(box(w, h, 0.02), wall, 0, h / 2 + 0.2, -d / 2); for (const s of [-1, 1]) put(box(0.02, h, d), wall, s * w / 2, h / 2 + 0.2, 0);
      put(box(w, 0.1, d), mm, 0, 0.2, 0); put(box(w, 0.1, d), mm, 0, h + 0.25, 0); put(box(w - 0.1, 0.02, d - 0.1), M.glow(o.accent), 0, h + 0.19, 0); lamp(0, h, 0, new THREE.Color(o.accent).getHex(), 3, 3);
      put(box(w - 0.1, 0.02, d - 0.1), M.stone('nero'), 0, 0.26, 0);
      // doors half open, a call panel
      for (const s of [-1, 1]) put(box(w / 2 - 0.05, h - 0.1, 0.03), st === 0 ? M.glass('#d8e8f0', 0.25) : M.brushed('#c8ccd2'), s * (w / 2 - 0.2), h / 2 + 0.25, d / 2 + 0.03);
      put(rbox(0.1, 0.25, 0.02, 0.01), M.black(), w / 2 + 0.15, 1.2, d / 2); for (const y of [1.15, 1.25]) put(cyl(0.02, 0.02, 0.01, 12), M.glow('#5fd3ff'), w / 2 + 0.15, y, d / 2 + 0.015, Math.PI / 2, 0, 0);
      put(rbox(0.6, 0.02, 0.02, 0.01), mm, 0, 1.0, -d / 2 + 0.05);
    } };

  function build(id, o, W, D) {
    G = new THREE.Group(); ANIM = []; LIGHTS = [];
    DEF[id].build(o, W, D);
    const g = G; G = null; return { group: g, anim: ANIM, lights: LIGHTS };
  }
  return { DEF, FIN, ENV, build };
}
