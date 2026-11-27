  // ---------- Jeweler's Bench (Kimari 2026-11-27: "I wanna add my most recent artifacts jeweler bench to my game") ----------
  // Kimari's Jeweler's Bench artifact, built into the 3D game. The same pieces, options, presets and prices: Miami Cuban,
  // tennis, rope and cable chains with name plates, initials, medallions, crosses, hearts and stars; round and cushion
  // watches with pavé or baguette bezels, sunburst dials, real hands and every bracelet; rings, bracelets, stud earrings
  // and grillz. Design it at a jeweler (Glitch Ice Co., Stop Six Gold & Diamonds, or the custom counter in any mall),
  // pay for it, and it is made for YOUR body: the chain lies on your chest and drops by its length, the watch wraps your
  // left wrist, rings sit on your right hand's fingers, studs in your ears, grillz on your teeth. Everybody online sees it
  // (it rides in your look), and photo mode shows it up close.
  // Geometry is the artifact's (r170) ported to the game's three r128, with three detail levels: q2 at the bench,
  // q1 on you, q0 on phones and on other players.
  const JW = (() => {
    const TAU = Math.PI * 2;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), Q = () => new THREE.Quaternion();
    const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1), ONE = V(1, 1, 1);
    const qa = (ax, a) => Q().setFromAxisAngle(ax, a);
    const basisQ = (a, b, c) => Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, c));
    const jc = h => new THREE.Color(h).convertSRGBToLinear();

    /* ---------- data (the artifact's) ---------- */
    const METALS = { yellow: ['Yellow gold', '#f7cf7a', 0.12, 15.5, 62], white: ['White gold', '#ebe9e4', 0.1, 15.8, 64], rose: ['Rose gold', '#f2b39a', 0.13, 15.0, 60], silver: ['Silver / steel', '#e9e9e7', 0.14, 10.4, 1.4], black: ['Black steel', '#38383c', 0.24, 7.9, 0.6] };
    const STONES = { clear: ['Diamond', '#ffffff'], pink: ['Pink', '#ff9cc2'], blue: ['Ice blue', '#9ad6ff'], yellow: ['Canary', '#ffd84a'], green: ['Emerald', '#2fcf74'], red: ['Ruby', '#e0284a'], black: ['Black', '#2a2a30'] };
    const DIALS = { black: ['Black', '#0d0e11'], blue: ['Blue', '#1b3d8f'], green: ['Green', '#18563a'], champ: ['Champagne', '#d4b77c'], silver: ['Silver', '#cfd2d6'], white: ['White', '#f0efea'], red: ['Oxblood', '#5e1220'] };
    const STRAPS = { black: ['Black', '#151515'], brown: ['Brown', '#5a3420'], tan: ['Tan', '#a46a3c'], red: ['Red', '#7c1420'] };
    const FONTS = { script: ['Script', 'Pacifico', 'cursive'], old: ['Old English', 'UnifrakturMaguntia', 'serif'], block: ['Block', 'Archivo Black', 'Impact, sans-serif'] };
    const sw = o => Object.entries(o).map(([k, v]) => [k, v[0], v[1]]);
    const CHAIN_STYLES = [['tennis', 'Tennis'], ['cuban', 'Miami Cuban'], ['rope', 'Rope'], ['cable', 'Cable']];
    const PENDANTS = [['none', 'None'], ['name', 'Name plate'], ['initial', 'Initial'], ['medallion', 'Medallion'], ['cross', 'Cross'], ['heart', 'Heart'], ['star', 'Star']];
    const TEXTP = ['name', 'initial', 'medallion'];
    const BANDS = [['three', '3-link'], ['five', '5-link'], ['hlink', 'Integrated H-link'], ['cuban', 'Cuban'], ['leather', 'Leather'], ['rubber', 'Rubber']];
    const METALBAND = ['three', 'five', 'hlink', 'cuban'];
    const SCHEMA = {
      chain: [
        { id: 'style', label: 'Chain', type: 'chips', opts: CHAIN_STYLES },
        { id: 'width', label: 'Width', type: 'range', min: 2, max: 20, step: 0.5, unit: 'mm', lab: S => S.style === 'tennis' ? 'Stone size' : 'Width' },
        { id: 'length', label: 'Length', type: 'range', min: 16, max: 30, step: 1, unit: 'in' },
        { id: 'metal', label: 'Metal', type: 'chips', opts: sw(METALS) },
        { id: 'iced', label: 'Iced-out links', type: 'toggle', show: S => S.style === 'cuban' || S.style === 'rope' },
        { id: 'pendant', label: 'Custom pendant', type: 'chips', opts: PENDANTS },
        { id: 'text', label: 'Pendant text', type: 'text', max: 12, show: S => TEXTP.includes(S.pendant) },
        { id: 'font', label: 'Lettering', type: 'chips', opts: Object.entries(FONTS).map(([k, v]) => [k, v[0]]), show: S => TEXTP.includes(S.pendant) },
        { id: 'psize', label: 'Pendant height', type: 'range', min: 2, max: 9, step: 0.5, unit: 'cm', show: S => S.pendant !== 'none' },
        { id: 'piced', label: 'Iced pendant', type: 'toggle', show: S => S.pendant !== 'none' },
        { id: 'stone', label: 'Stones', type: 'chips', opts: sw(STONES) }],
      watch: [
        { id: 'shape', label: 'Case', type: 'chips', opts: [['classic', 'Round classic'], ['sport', 'Cushion sport']] },
        { id: 'size', label: 'Case size', type: 'range', min: 34, max: 46, step: 1, unit: 'mm' },
        { id: 'metal', label: 'Metal', type: 'chips', opts: sw(METALS) },
        { id: 'bezel', label: 'Bezel', type: 'chips', opts: [['polished', 'Polished'], ['stepped', 'Stepped'], ['pave', 'Pavé diamonds'], ['baguette', 'Baguettes']] },
        { id: 'dial', label: 'Dial color', type: 'chips', opts: sw(DIALS), show: S => S.finish !== 'pave' },
        { id: 'finish', label: 'Dial finish', type: 'chips', opts: [['sunburst', 'Sunburst'], ['matte', 'Matte'], ['pave', 'Pavé (iced)']] },
        { id: 'indices', label: 'Hour markers', type: 'chips', opts: [['baton', 'Batons'], ['diamond', 'Diamonds'], ['baguette', 'Baguettes'], ['roman', 'Roman']] },
        { id: 'comp', label: 'Complication', type: 'chips', opts: [['date', 'Date'], ['chrono', 'Chronograph'], ['none', 'None']] },
        { id: 'dialText', label: 'Dial text (your brand)', type: 'text', max: 16, show: S => S.finish !== 'pave' },
        { id: 'band', label: 'Band', type: 'chips', opts: BANDS },
        { id: 'iceCase', label: 'Iced case and lugs', type: 'toggle' },
        { id: 'iceBand', label: 'Iced bracelet', type: 'toggle', show: S => METALBAND.includes(S.band) },
        { id: 'strap', label: 'Strap color', type: 'chips', opts: sw(STRAPS), show: S => !METALBAND.includes(S.band) },
        { id: 'stone', label: 'Stones', type: 'chips', opts: sw(STONES) },
        { id: 'two', label: 'Two-tone (steel case and outer links)', type: 'toggle', show: S => S.metal === 'yellow' || S.metal === 'rose' },
        { id: 'live', label: 'Hands show real time', type: 'toggle' }],
      more: [
        { id: 'kind', label: 'Piece', type: 'chips', opts: [['ring', 'Ring'], ['bracelet', 'Bracelet'], ['studs', 'Earrings'], ['grillz', 'Grillz']] },
        { id: 'head', label: 'Ring style', type: 'chips', opts: [['cluster', 'Iced pinky'], ['signet', 'Signet initial'], ['solitaire', 'Solitaire'], ['eternity', 'Eternity band']], show: S => S.kind === 'ring' },
        { id: 'text', label: 'Initial', type: 'text', max: 2, show: S => S.kind === 'ring' && S.head === 'signet' },
        { id: 'font', label: 'Lettering', type: 'chips', opts: Object.entries(FONTS).map(([k, v]) => [k, v[0]]), show: S => S.kind === 'ring' && S.head === 'signet' },
        { id: 'rsize', label: 'Ring size (US)', type: 'range', min: 5, max: 14, step: 0.5, unit: '', show: S => S.kind === 'ring' },
        { id: 'rwidth', label: 'Band width', type: 'range', min: 2, max: 8, step: 0.5, unit: 'mm', show: S => S.kind === 'ring' },
        { id: 'bstyle', label: 'Bracelet', type: 'chips', opts: [['tennis', 'Tennis'], ['cuban', 'Miami Cuban']], show: S => S.kind === 'bracelet' },
        { id: 'bwidth', label: 'Width', type: 'range', min: 2, max: 14, step: 0.5, unit: 'mm', lab: S => S.bstyle === 'tennis' ? 'Stone size' : 'Width', show: S => S.kind === 'bracelet' },
        { id: 'wrist', label: 'Wrist size', type: 'range', min: 6, max: 9, step: 0.25, unit: 'in', show: S => S.kind === 'bracelet' },
        { id: 'ssize', label: 'Stone size', type: 'range', min: 3, max: 10, step: 0.5, unit: 'mm', lab: S => S.kind === 'ring' ? 'Center stone' : 'Stone size', show: S => S.kind === 'studs' || (S.kind === 'ring' && (S.head === 'solitaire' || S.head === 'cluster')) },
        { id: 'halo', label: 'Diamond halo', type: 'toggle', show: S => S.kind === 'studs' },
        { id: 'gset', label: 'Set', type: 'chips', opts: [['top', 'Top'], ['bottom', 'Bottom'], ['both', 'Top + bottom']], show: S => S.kind === 'grillz' },
        { id: 'teeth', label: 'Teeth per set', type: 'chips', opts: [['6', '6'], ['8', '8']], show: S => S.kind === 'grillz' },
        { id: 'gstyle', label: 'Finish', type: 'chips', opts: [['solid', 'Polished'], ['cut', 'Diamond-cut'], ['iced', 'Iced out']], show: S => S.kind === 'grillz' },
        { id: 'fangs', label: 'Fangs', type: 'toggle', show: S => S.kind === 'grillz' },
        { id: 'metal', label: 'Metal', type: 'chips', opts: sw(METALS) },
        { id: 'iced', label: 'Iced', type: 'toggle', lab: S => S.kind === 'ring' ? (S.head === 'signet' ? 'Iced field around the letter' : 'Iced shoulders') : 'Iced links', show: S => (S.kind === 'ring' && S.head !== 'eternity') || (S.kind === 'bracelet' && S.bstyle === 'cuban') },
        { id: 'stone', label: 'Stones', type: 'chips', opts: sw(STONES) }],
    };
    const DEF = {
      chain: { style: 'tennis', width: 4, length: 20, metal: 'yellow', iced: false, pendant: 'name', text: 'Legend', font: 'script', psize: 4, piced: true, stone: 'clear' },
      watch: { shape: 'classic', size: 41, metal: 'yellow', bezel: 'pave', dial: 'champ', finish: 'sunburst', indices: 'baguette', comp: 'date', dialText: '', band: 'three', iceCase: false, iceBand: false, strap: 'black', stone: 'clear', two: false, live: true },
      more: { kind: 'ring', head: 'cluster', text: 'M', font: 'old', rsize: 10, rwidth: 4, bstyle: 'tennis', bwidth: 4, wrist: 7.5, ssize: 6, halo: true, gset: 'top', teeth: '8', gstyle: 'iced', fangs: false, metal: 'yellow', iced: true, stone: 'clear' } };
    const PRESETS = {
      chain: [
        ['Name on tennis', { style: 'tennis', width: 4, length: 20, metal: 'yellow', pendant: 'name', text: 'Legend', font: 'script', psize: 3.5, piced: true }],
        ['Old English initial', { style: 'tennis', width: 5, length: 22, metal: 'yellow', pendant: 'initial', text: 'M', font: 'old', psize: 6, piced: true }],
        ['Iced Miami Cuban', { style: 'cuban', width: 14, length: 20, metal: 'yellow', iced: true, pendant: 'none' }],
        ['Medallion on rope', { style: 'rope', width: 6, length: 24, metal: 'yellow', iced: false, pendant: 'medallion', text: 'MW', font: 'old', psize: 6, piced: true }],
        ['Iced cross on tennis', { style: 'tennis', width: 3, length: 24, metal: 'white', pendant: 'cross', psize: 6, piced: true }],
        ['Block name, Cuban', { style: 'cuban', width: 10, length: 22, metal: 'yellow', iced: false, pendant: 'name', text: 'BANDO', font: 'block', psize: 3, piced: true }]],
      watch: [
        ['Bust down', { shape: 'classic', size: 41, metal: 'yellow', bezel: 'pave', finish: 'pave', indices: 'baguette', comp: 'none', band: 'three', iceCase: true, iceBand: true }],
        ['Gold classic', { shape: 'classic', size: 40, metal: 'yellow', bezel: 'stepped', dial: 'champ', finish: 'sunburst', indices: 'baton', comp: 'date', band: 'five', iceCase: false, iceBand: false }],
        ['Iced cushion', { shape: 'sport', size: 41, metal: 'yellow', bezel: 'pave', dial: 'black', finish: 'sunburst', indices: 'diamond', comp: 'date', band: 'hlink', iceCase: true, iceBand: false }],
        ['Gold chrono', { shape: 'classic', size: 42, metal: 'yellow', bezel: 'polished', dial: 'black', finish: 'sunburst', indices: 'baton', comp: 'chrono', band: 'three', iceCase: false, iceBand: false }],
        ['Rose baguette', { shape: 'classic', size: 38, metal: 'rose', bezel: 'baguette', dial: 'white', finish: 'matte', indices: 'roman', comp: 'none', band: 'leather', strap: 'brown', iceCase: false }],
        ['Blue sport', { shape: 'sport', size: 42, metal: 'white', bezel: 'polished', dial: 'blue', finish: 'sunburst', indices: 'baton', comp: 'date', band: 'hlink', iceCase: false, iceBand: false }],
        ['Two-tone classic', { shape: 'classic', size: 41, metal: 'yellow', two: true, bezel: 'stepped', dial: 'champ', finish: 'sunburst', indices: 'diamond', comp: 'date', band: 'three', iceCase: false, iceBand: false }]],
      more: [
        ['Iced pinky ring', { kind: 'ring', head: 'cluster', rsize: 10, rwidth: 4, ssize: 6, iced: true }],
        ['Signet initial', { kind: 'ring', head: 'signet', rsize: 10, rwidth: 5, text: 'M', font: 'old', iced: true }],
        ['Solitaire', { kind: 'ring', head: 'solitaire', rsize: 7, rwidth: 2.5, ssize: 8, iced: true, metal: 'white' }],
        ['Tennis bracelet', { kind: 'bracelet', bstyle: 'tennis', bwidth: 4, wrist: 7.5 }],
        ['Iced Cuban bracelet', { kind: 'bracelet', bstyle: 'cuban', bwidth: 12, wrist: 8, iced: true }],
        ['Halo studs', { kind: 'studs', ssize: 6, halo: true }],
        ['Iced grillz', { kind: 'grillz', gset: 'top', teeth: '8', gstyle: 'iced', fangs: false }],
        ['Gold fangs', { kind: 'grillz', gset: 'both', teeth: '6', gstyle: 'solid', fangs: true }]] };

    /* ---------- geometry helpers ---------- */
    const NI = g => g.index ? g.toNonIndexed() : g;
    const flat = g => { g = NI(g); g.computeVertexNormals(); return g; };
    const bake = (geo, pos, q, s) => { const g = geo.clone(); g.applyMatrix4(new THREE.Matrix4().compose(pos || V(), q || Q(), s || ONE)); return g; };
    function merge(list) {
      let n = 0; for (const g of list) n += g.attributes.position.count;
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
      for (const g of list) { const a = g.attributes; P.set(a.position.array, o * 3); if (a.normal) N.set(a.normal.array, o * 3); if (a.uv) U.set(a.uv.array, o * 2); o += a.position.count; g.dispose(); }
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return out;
    }
    function vol(g) { const p = g.attributes.position.array; let v = 0; for (let i = 0; i < p.length; i += 9) v += p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6]); return Math.abs(v / 6); }
    function triGeo(tris, cz) {
      const P = []; for (const [a, b, c] of tris) { const n = V().crossVectors(V().subVectors(b, a), V().subVectors(c, a)), m = V().add(a).add(b).add(c).divideScalar(3); if (n.dot(m.sub(V(0, 0, cz))) < 0) P.push(a, c, b); else P.push(a, b, c); }
      const g = new THREE.BufferGeometry().setFromPoints(P); g.computeVertexNormals(); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.length * 2), 2)); return g;
    }
    // round brilliant (unit diameter, table +Z)
    const GEM = (() => {
      const ring = (n, r, z, off) => Array.from({ length: n }, (_, i) => { const a = off + i * TAU / n; return V(Math.cos(a) * r, Math.sin(a) * r, z); });
      const T = ring(8, 0.28, 0.17, 0), C = ring(8, 0.41, 0.1, TAU / 16), Gt = ring(16, 0.5, 0.012, 0), Gb = ring(16, 0.5, -0.012, 0), P = ring(8, 0.21, -0.25, 0), cul = V(0, 0, -0.43), top = V(0, 0, 0.17), t = [];
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8, im = (i + 7) % 8;
        t.push([top, T[i], T[j]], [T[i], C[i], T[j]], [T[i], C[im], Gt[2 * i]], [T[i], Gt[2 * i], C[i]], [C[i], Gt[2 * i], Gt[2 * i + 1]], [C[i], Gt[2 * i + 1], Gt[(2 * i + 2) % 16]]);
        t.push([Gb[2 * i], Gb[2 * i + 1], P[i]], [Gb[2 * i + 1], Gb[(2 * i + 2) % 16], P[j]], [Gb[2 * i + 1], P[j], P[i]], [P[i], P[j], cul]);
      }
      for (let k = 0; k < 16; k++) { const l = (k + 1) % 16; t.push([Gt[k], Gt[l], Gb[l]], [Gt[k], Gb[l], Gb[k]]); }
      return triGeo(t, -0.05);
    })();
    const GEMLO = flat(new THREE.LatheGeometry([new THREE.Vector2(0.001, -0.43), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.5, 0.03), new THREE.Vector2(0.3, 0.17), new THREE.Vector2(0.001, 0.17)], 8).rotateX(Math.PI / 2));
    const GEMXS = flat(new THREE.LatheGeometry([new THREE.Vector2(0.001, -0.4), new THREE.Vector2(0.5, 0.02), new THREE.Vector2(0.001, 0.17)], 6).rotateX(Math.PI / 2));
    // baguette step cut, unit 1 (X) x 1 (Y)
    const BAG = (() => {
      const rect = (w, l, z) => [V(-w / 2, -l / 2, z), V(w / 2, -l / 2, z), V(w / 2, l / 2, z), V(-w / 2, l / 2, z)];
      const R = [rect(0.62, 0.8, 0.16), rect(0.86, 0.94, 0.08), rect(1, 1, 0.01), rect(1, 1, -0.01), rect(0.6, 0.8, -0.18), rect(0.12, 0.5, -0.36)], t = [];
      t.push([R[0][0], R[0][1], R[0][2]], [R[0][0], R[0][2], R[0][3]]);
      for (let r = 0; r < R.length - 1; r++) for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; t.push([R[r][i], R[r][j], R[r + 1][j]], [R[r][i], R[r + 1][j], R[r + 1][i]]); }
      const B = R[R.length - 1]; t.push([B[0], B[2], B[1]], [B[0], B[3], B[2]]); return triGeo(t, -0.05);
    })();
    const BOX = NI(new THREE.BoxGeometry(1, 1, 1));
    // r128 has no CapsuleGeometry: a lathed capsule, radius .5, straight part 1 along Y
    function capsule(cs, rs) { const pts = []; for (let i = 0; i <= cs; i++) { const a = -Math.PI / 2 + i / cs * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * 0.5), -0.5 + Math.sin(a) * 0.5)); } for (let i = 0; i <= cs; i++) { const a = i / cs * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * 0.5), 0.5 + Math.sin(a) * 0.5)); } return NI(new THREE.LatheGeometry(pts, rs)); }
    const QG = {};   // per detail level shared shapes
    function qg(q) {
      if (QG[q]) return QG[q];
      const s = [[3, 6, 12, 6, 5, 4, 6, 14], [4, 8, 20, 8, 7, 6, 8, 24], [4, 10, 28, 10, 8, 8, 10, 28]][q];
      const o = QG[q] = {
        CAP: capsule(s[0], s[1]), CYLZ: NI(new THREE.CylinderGeometry(0.5, 0.5, 1, s[2]).rotateX(Math.PI / 2)), SPH: NI(new THREE.SphereGeometry(0.5, s[3], s[4])),
        tCable: NI(new THREE.TorusGeometry(1, 0.3, s[5], s[7])), CUBAN: null };
      class P extends THREE.Curve { getPoint(t, o2 = new THREE.Vector3()) { const a = t * TAU; return o2.set(1.15 * Math.cos(a), 0.62 * Math.sin(a), 0.3 * Math.sin(2 * a)); } }
      const g = NI(new THREE.TubeGeometry(new P(), [28, 44, 72][q], 0.3, [5, 7, 10][q], true)); g.scale(1, 1, 0.72); g.computeVertexNormals(); o.CUBAN = g;
      o.SETTING = makeSetting(true, q); o.HEAD = makeSetting(false, q);
      return o;
    }
    const rbCache = new Map();
    function RB(w, l, t, r, q = 2) {
      const k = [w, l, t, r].map(v => v.toFixed(5)).join() + q; if (rbCache.has(k)) return rbCache.get(k);
      const s = new THREE.Shape(), a = w / 2 - r, b = l / 2 - r; s.moveTo(-a, -l / 2); s.lineTo(a, -l / 2); s.quadraticCurveTo(w / 2, -l / 2, w / 2, -b); s.lineTo(w / 2, b); s.quadraticCurveTo(w / 2, l / 2, a, l / 2); s.lineTo(-a, l / 2); s.quadraticCurveTo(-w / 2, l / 2, -w / 2, b); s.lineTo(-w / 2, -b); s.quadraticCurveTo(-w / 2, -l / 2, -a, -l / 2);
      const bv = Math.min(r, t * 0.35), g = NI(new THREE.ExtrudeGeometry(s, { depth: t - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.9, bevelSegments: [1, 2, 3][q], curveSegments: [2, 4, 6][q] })); g.translate(0, 0, -(t - 2 * bv) / 2);
      if (rbCache.size > 400) rbCache.clear(); rbCache.set(k, g); return g;
    }
    // stones: q2 the full brilliant, q1 the full one when it is big enough to see, q0 a small lathe
    const gemFn = (list, st, C) => (p, n, d, bag) => {
      const q = Q().setFromUnitVectors(Z, n.clone().normalize());
      if (bag) { list.push(bake(BAG, p, bag.q || q, V(bag.w, bag.l, Math.min(bag.w, bag.l)))); st.gems++; st.ct += 0.0061 * bag.w * 1000 * bag.l * 1000 * Math.min(bag.w, bag.l) * 1000; return; }
      const g = C.q >= 2 ? (d < 0.0014 ? GEMLO : GEM) : C.q === 1 ? (d < 0.003 ? GEMLO : GEM) : (d < 0.004 ? GEMXS : GEMLO);
      list.push(bake(g, p, q, V(d, d, d))); st.gems++; st.ct += 0.0037 * Math.pow(d * 1000, 3);
    };
    function add(root, st, name, list, mat, wf = 0) { if (!list.length) return null; const g = merge(list); g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.name = name; root.add(m); st.tris += g.attributes.position.count / 3; if (wf) st.vol += vol(g) * wf; return m; }
    const hexGrid = (x0, x1, y0, y1, g) => { const out = [], dy = g * 0.88, dx = g * 1.03; for (let y = y0, r = 0; y <= y1; y += dy, r++) for (let x = x0 + (r % 2 ? dx / 2 : 0); x <= x1; x += dx) out.push([x, y]); return out; };

    /* ---------- materials (shared, kept alive across bodies) ---------- */
    const MATS = new Map();
    const keep = m => { m.userData.jwKeep = true; return m; };
    const DENVS = new Map(); let RIDN = 0; const rid = r => r.__jwId || (r.__jwId = 'r' + (++RIDN));
    // a small studio cube for the stones' fire, rendered once
    function denv(r) {
      if (DENVS.has(rid(r))) return DENVS.get(rid(r));
      const es = new THREE.Scene();
      es.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.07, 0.05, 0.05), side: THREE.BackSide })));
      const panel = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i * 0.97, i * 0.92), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
      panel(5, 1.6, 0, 4.6, 1, 9); panel(1.4, 3.5, -4.6, 1, 2, 5); panel(1.4, 3, 4.6, 0.5, 2.5, 4); panel(7, 0.5, 0, -1.5, 4.6, 3); panel(1, 4, 3, 2, -4.6, 7); panel(3, 0.8, -2, -4.6, -1, 1.5); panel(0.4, 3, -2.5, 3, 4, 6);
      const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
      const cc = new THREE.CubeCamera(0.1, 100, crt); cc.update(r, es); crt.texture.mapping = THREE.CubeRefractionMapping; DENVS.set(rid(r), crt.texture);
      es.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      return crt.texture;
    }
    // diamonds: refract the studio cube per colour channel (fire) plus a fresnel reflection (the artifact's shader, r128 chunk)
    function diamondMat(kind, r) {
      const key = 'gem:' + kind + ':' + rid(r); if (MATS.has(key)) return MATS.get(key);
      const st = STONES[kind] || STONES.clear;
      const m = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: kind === 'clear' ? 0xffffff : jc(st[1]), specular: 0xffffff, shininess: 600, envMap: denv(r), combine: THREE.MultiplyOperation, reflectivity: 1, refractionRatio: 1 / 2.42, flatShading: true });
      const spread = kind === 'clear' ? 0.018 : 0.008, dark = kind === 'black';
      m.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <envmap_fragment>', `
        #ifdef USE_ENVMAP
          vec3 cToF = normalize(vWorldPosition - cameraPosition); vec3 wN = inverseTransformDirection(normal, viewMatrix);
          vec3 rR = refract(cToF, wN, refractionRatio * (1.0 - ${spread.toFixed(3)})); vec3 rG = refract(cToF, wN, refractionRatio); vec3 rB = refract(cToF, wN, refractionRatio * (1.0 + ${spread.toFixed(3)})); vec3 rf = reflect(cToF, wN);
          vec3 eR = vec3(textureCube(envMap, vec3(flipEnvMap * rR.x, rR.yz)).r, textureCube(envMap, vec3(flipEnvMap * rG.x, rG.yz)).g, textureCube(envMap, vec3(flipEnvMap * rB.x, rB.yz)).b);
          vec3 eF = textureCube(envMap, vec3(flipEnvMap * rf.x, rf.yz)).rgb;
          float fr = 0.17 + 0.83 * pow(1.0 - abs(dot(-cToF, wN)), 5.0);
          outgoingLight = ${dark ? 'vec3(0.02) * eR + eF * fr' : 'outgoingLight * eR * (1.0 - fr) + eF * fr'};
        #endif`);
      };
      m.customProgramCacheKey = () => 'jwdiamond' + spread + dark;
      MATS.set(key, keep(m)); return m;
    }
    function metalMat(metal, rough = 0, name = '') {
      const mt = METALS[metal] || METALS.yellow, key = 'm:' + metal + ':' + rough;
      if (MATS.has(key)) return MATS.get(key);
      const m = new THREE.MeshStandardMaterial({ color: jc(mt[1]), metalness: 1, roughness: Math.min(0.5, mt[2] + rough), envMapIntensity: rough ? 1.1 : 1.45 });
      MATS.set(key, keep(m)); return m;
    }
    function plainMat(key, o) { if (MATS.has(key)) return MATS.get(key); const m = keep(new THREE.MeshStandardMaterial(o)); MATS.set(key, m); return m; }
    function mats(S, r) {
      return {
        metal: metalMat(S.metal), brushed: metalMat(S.metal, 0.25), gem: diamondMat(S.stone, r),
        alt: plainMat('steel', { color: jc('#d9dbde'), metalness: 1, roughness: 0.12, envMapIntensity: 1.35 }),
        altBrushed: plainMat('steelb', { color: jc('#d9dbde'), metalness: 1, roughness: 0.4, envMapIntensity: 1.1 }),
        lume: plainMat('lume', { color: jc('#f2efe2'), emissive: jc('#a6f0bf'), emissiveIntensity: 0.18, roughness: 0.6 }) };
    }

    /* ---------- 2D masks -> contours -> shapes (custom lettering and pendants) ---------- */
    function contours(mask, W, H) {
      const at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x];
      const adj = new Map(), K = (x, y) => (x + 4) * 65536 + (y + 4);
      const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
      for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
        const c = at(x, y) * 8 + at(x + 1, y) * 4 + at(x + 1, y + 1) * 2 + at(x, y + 1); if (c === 0 || c === 15) continue;
        const T = K(2 * x + 1, 2 * y), R = K(2 * x + 2, 2 * y + 1), B = K(2 * x + 1, 2 * y + 2), L = K(2 * x, 2 * y + 1);
        switch (c) { case 1: case 14: link(L, B); break; case 2: case 13: link(B, R); break; case 3: case 12: link(L, R); break; case 4: case 11: link(T, R); break;
          case 5: link(T, R); link(L, B); break; case 10: link(L, T); link(B, R); break; case 6: case 9: link(T, B); break; case 7: case 8: link(T, L); break; }
      }
      const seen = new Set(), loops = [];
      for (const s of adj.keys()) {
        if (seen.has(s)) continue; const pts = []; let prev = -1, cur = s;
        while (cur !== undefined && !seen.has(cur)) { seen.add(cur); pts.push([(Math.floor(cur / 65536) - 4) / 2, (cur % 65536 - 4) / 2]); const n = adj.get(cur); let nx = n[0] === prev || seen.has(n[0]) ? n[1] : n[0]; if (n.length > 2) nx = n.find(v => !seen.has(v)); prev = cur; cur = nx; }
        if (pts.length > 8) loops.push(pts);
      }
      return loops.map(smoothLoop);
    }
    function smoothLoop(p) { let a = p; for (let it = 0; it < 2; it++) { const n = a.length; a = a.map((q, i) => { const u = a[(i - 1 + n) % n], v = a[(i + 1) % n]; return [(u[0] + 2 * q[0] + v[0]) / 4, (u[1] + 2 * q[1] + v[1]) / 4]; }); } return a.filter((_, i) => i % 2 === 0); }
    const pip = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    function nest(loops) {
      const depth = loops.map((l, i) => loops.reduce((d, o, j) => d + (j !== i && pip(o, l[0][0], l[0][1]) ? 1 : 0), 0));
      const outers = []; loops.forEach((l, i) => { if (depth[i] % 2 === 0) outers.push({ pts: l, holes: [], i }); });
      loops.forEach((l, i) => { if (depth[i] % 2 === 1) { let best = null; for (const o of outers) if (depth[o.i] === depth[i] - 1 && pip(o.pts, l[0][0], l[0][1])) best = o; if (best) best.holes.push(l); } });
      return outers;
    }
    const fontCss = fk => fk && FONTS[fk] ? `"${FONTS[fk][1]}", ${FONTS[fk][2]}` : 'serif';
    let fontsReady = false;
    const fontsP = Promise.all(Object.values(FONTS).map(f => document.fonts && document.fonts.load ? document.fonts.load(`150px "${f[1]}"`, 'AaMW').catch(() => null) : null)).then(() => { fontsReady = true; });
    async function raster(kind, text, fk, bar) {
      if (fk) { try { await Promise.race([document.fonts.load(`150px "${FONTS[fk][1]}"`, text), new Promise(r => setTimeout(r, 2500))]); } catch (e) {} }
      const c = document.createElement('canvas'), x = c.getContext('2d'); let W, H, draw;
      const rr = (px, py, w, h, r) => { if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); };
      if (kind === 'text') {
        const fp = 150; x.font = `${fp}px ${fontCss(fk)}`; const m = x.measureText(text), tw = Math.max(40, Math.ceil(m.width)); W = tw + 90; H = Math.round(fp * 1.75); const by = Math.round(H * 0.64);
        draw = (fillOut, inset) => {
          x.font = `${fp}px ${fontCss(fk)}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.fillStyle = x.strokeStyle = '#fff';
          x.fillText(text, W / 2, by); if (fillOut) { x.lineWidth = fillOut; x.strokeText(text, W / 2, by); }
          if (bar) { x.beginPath(); rr(W / 2 - tw / 2 - 6 + inset, by + fp * 0.07 + inset, tw + 12 - 2 * inset, fp * 0.17 - 2 * inset, fp * 0.08); x.fill(); if (fillOut) { x.lineWidth = fillOut; x.stroke(); } }
          if (inset) { x.strokeStyle = '#000'; x.lineWidth = inset * 2; x.strokeText(text, W / 2, by); }
        };
      } else {
        W = H = 520; draw = (fillOut, inset) => {
          x.save(); x.translate(40, 20); x.scale(440, 480); x.fillStyle = x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.beginPath();
          if (kind === 'cross') { x.rect(0.4, 0, 0.2, 1); x.rect(0.12, 0.2, 0.76, 0.2); for (const [a, b] of [[0.5, 0.02], [0.5, 0.98], [0.14, 0.3], [0.86, 0.3]]) { x.moveTo(a + 0.09, b); x.arc(a, b, 0.09, 0, TAU); } }
          else if (kind === 'heart') { x.moveTo(0.5, 0.24); x.bezierCurveTo(0.38, 0.0, 0, 0.02, 0.04, 0.38); x.bezierCurveTo(0.08, 0.62, 0.38, 0.78, 0.5, 1); x.bezierCurveTo(0.62, 0.78, 0.92, 0.62, 0.96, 0.38); x.bezierCurveTo(1, 0.02, 0.62, 0, 0.5, 0.24); }
          else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.22 : 0.5, px = 0.5 + Math.cos(a) * r, py = 0.52 + Math.sin(a) * r * 1.04; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); }
          x.fill('nonzero'); if (fillOut) { x.lineWidth = fillOut / 440; x.stroke(); } if (inset) { x.globalCompositeOperation = 'destination-out'; x.lineWidth = inset * 2 / 440; x.stroke(); x.globalCompositeOperation = 'source-over'; } x.restore();
        };
      }
      c.width = W; c.height = H; const read = () => { const d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = d[i * 4] > 127 ? 1 : 0; return m; };
      const clr = () => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); };
      const sOut = kind === 'text' ? (fk === 'script' ? 16 : 12) : 14;
      clr(); draw(sOut, 0); const outer = read(); clr(); draw(0, 3); const inner = read();
      let y0 = H, y1 = 0, x0 = W, x1 = 0; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (outer[j * W + i]) { if (j < y0) y0 = j; if (j > y1) y1 = j; if (i < x0) x0 = i; if (i > x1) x1 = i; }
      return { W, H, outer, inner, bb: { x0, x1, y0, y1 } };
    }
    // gold plate from mask + polished rim wire along every outline + pavé inside
    function maskPiece(mk, P, C, gem, iced, list, opts = {}) {
      const { W, H, outer, inner, bb } = mk, hpx = Math.max(1, bb.y1 - bb.y0), s = P / hpx, cx = (bb.x0 + bb.x1) / 2;
      const mp = (px, py) => [(px - cx) * s, -(py - bb.y0) * s];
      const loops = contours(outer, W, H), groups = nest(loops), shapes = [];
      for (const g of groups) { const sh = new THREE.Shape(g.pts.map(p => new THREE.Vector2(...mp(p[0], p[1])))); for (const h of g.holes) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(...mp(p[0], p[1]))))); shapes.push(sh); }
      const d = opts.depth || Math.max(0.0012, P * 0.05), bt = Math.max(0.0002, P * 0.008), z0 = opts.z || 0;
      if (shapes.length) list.push(bake(NI(new THREE.ExtrudeGeometry(shapes, { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.5, bevelSegments: C.q ? 2 : 1, curveSegments: 1 })), V(0, 0, z0)));
      const ztop = z0 + d + bt, rr = Math.max(0.00035, Math.min(0.0009, P * 0.011));
      if (opts.rim !== false && C.q > 0) for (const l of loops) { const pts = l.map(p => { const [a, b] = mp(p[0], p[1]); return V(a, b, ztop); }); if (pts.length > 6) list.push(NI(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), Math.min(C.q >= 2 ? 900 : 360, pts.length * (C.q >= 2 ? 2 : 1)), rr, C.q >= 2 ? 7 : 4, true))); }
      if (iced) {
        const g = Math.max(0.0009, Math.min(0.0028, P * 0.06)) * (C.q ? 1 : 1.3), gp = g / s, r = gp * 0.48, at = (px, py) => { const i = Math.round(px), j = Math.round(py); return i >= 0 && j >= 0 && i < W && j < H && inner[j * W + i]; };
        for (const [px, py] of hexGrid(bb.x0, bb.x1, bb.y0, bb.y1, gp)) if (at(px, py) && at(px + r, py) && at(px - r, py) && at(px, py + r) && at(px, py - r)) { const [a, b] = mp(px, py); gem(V(a, b, ztop - g * 0.04), Z, g); }
      }
      let bx = 0, by = 0; for (let k = 0; k < W; k++) { const col = Math.round(cx + (k % 2 ? 1 : -1) * Math.ceil(k / 2)); if (col < 0 || col >= W) continue; let j = -1; for (let y = 0; y < H; y++) if (outer[y * W + col]) { j = y; break; } if (j >= 0) { [bx, by] = mp(col, j); break; } }
      return { bx, by, d, bt, ztop, s, mp, cx };
    }

    /* ---------- chains ---------- */
    // laid out flat on the velvet at the bench
    function neckCurve(L) {
      const pts = []; for (let i = 0; i < 72; i++) { const th = i / 72 * TAU, d = th - Math.PI; pts.push(V(Math.sin(th), Math.cos(th) * 1.18 - 0.32 * Math.exp(-d * d / 0.22), -0.34 * (1 + Math.cos(th)) / 2)); }
      let c = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); const k = L / c.getLength(); pts.forEach(p => p.multiplyScalar(k));
      c = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); c.arcLengthDivisions = 2000; return c;
    }
    function frame(c, u) {
      const p = c.getPointAt(u), t = c.getTangentAt(u).normalize(), base = c.normalAt ? c.normalAt(p, u) : Z, z = base.clone().addScaledVector(t, -base.dot(t)).normalize(), y = V().crossVectors(z, t);
      return { p, t, y, z, q: basisQ(t, y, z) };
    }
    // 4-prong basket for a tennis stone (unit stone diameter, table +Z, girdle at z=0)
    function makeSetting(hinge, q) {
      const G = q === 0 ? null : 1, CAP = QG[q] ? QG[q].CAP : capsule([3, 4, 4][q], [4, 6, 10][q]), SPH = NI(new THREE.SphereGeometry(0.5, [4, 6, 10][q], [3, 4, 8][q]));
      const L = [bake(NI(new THREE.TorusGeometry(0.45, 0.045, [3, 4, 8][q], [10, 16, 32][q])), V(0, 0, -0.1))];
      if (G) L.push(bake(NI(new THREE.TorusGeometry(0.24, 0.045, [3, 4, 8][q], [8, 12, 24][q])), V(0, 0, -0.36)));
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2, b = V(Math.cos(a) * 0.24, Math.sin(a) * 0.24, -0.38), t = V(Math.cos(a) * 0.47, Math.sin(a) * 0.47, 0.07), dir = V().subVectors(t, b), len = dir.length();
        if (G) L.push(bake(CAP, b.clone().add(t).multiplyScalar(0.5), Q().setFromUnitVectors(Y, dir.normalize()), V(0.085, len / 2, 0.085)));
        L.push(bake(SPH, V(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.1), null, V(0.12, 0.12, 0.09)));
      }
      if (hinge) L.push(bake(BOX, V(0, 0, -0.3), null, V(1.06, 0.16, 0.08)), bake(BOX, V(0.5, 0, -0.26), null, V(0.12, 0.3, 0.16)));
      SPH.dispose(); return merge(L);
    }
    async function buildChain(S, M, root, st, C) {
      const G = qg(C.q), w = S.width / 1000, L = S.length * 0.0254, c = C.curve ? C.curve(L, w * (S.style === 'cuban' ? 0.36 : S.style === 'tennis' ? 0.42 : 0.5)) : neckCurve(L), metal = [], gems = [], gem = gemFn(gems, st, C);
      if (S.style === 'tennis') { const d = w, pitch = d * 1.06; const n = Math.round(c.getLength() / pitch); for (let i = 0; i < n; i++) { const f = frame(c, i / n); metal.push(bake(G.SETTING, f.p, f.q, V(d, d, d))); gem(f.p.clone(), f.z, d * 0.96); } }
      else if (S.style === 'rope') {
        const N = Math.max([90, 160, 260][C.q], Math.ceil(L / (w * [0.4, 0.24, 0.14][C.q]))), F = []; for (let i = 0; i < N; i++) F.push(frame(c, i / N));
        const turns = Math.max(6, Math.round(L / (w * 1.35)));
        for (let k = 0; k < 3; k++) { const pts = F.map((f, i) => { const a = turns * TAU * i / N + k * TAU / 3; return f.p.clone().addScaledVector(f.y, Math.cos(a) * w * 0.23).addScaledVector(f.z, Math.sin(a) * w * 0.23); }); metal.push(NI(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), Math.round(N * 1.3), w * 0.27, [4, 6, 10][C.q], true))); }
        if (S.iced) { const n = Math.round(L / (w * 0.72)); for (let i = 0; i < n; i++) { const f = frame(c, i / n); gem(f.p.clone().addScaledVector(f.z, w * 0.43), f.z, w * 0.42); } }
      } else if (S.style === 'cuban') {
        const s = w / 1.84, pitch = s * 1.55; let n = Math.round(L / pitch); if (n % 2) n++;
        for (let i = 1; i < n; i++) {
          const f = frame(c, i / n), q = f.q.clone().multiply(qa(X, i % 2 ? Math.PI : 0)); metal.push(bake(G.CUBAN, f.p, q, V(s, s, s)));
          if (S.iced) for (const sg of [1, -1]) for (const a of (C.q ? [-0.42, 0, 0.42] : [-0.3, 0.3])) { const th = sg * Math.PI / 2 + a, lp = V(1.15 * Math.cos(th), 0.62 * Math.sin(th), (0.3 * Math.sin(2 * th) + 0.3) * 0.72); const nz = Z.clone().applyQuaternion(q); if (nz.dot(f.z) < 0) lp.z = (0.3 * Math.sin(2 * th) - 0.3) * 0.72; gem(lp.multiplyScalar(s).applyQuaternion(q).add(f.p), f.z, s * 0.4); }
        }
        const f = frame(c, 0), cl = [bake(RB(w * 2.3, w * 1.15, w * 0.62, w * 0.18, C.q), f.p, basisQ(f.t, f.y, f.z))]; add(root, st, 'Clasp', cl, M.metal, 1);
        if (S.iced && C.q) for (const [x, y] of hexGrid(-w * 1.02, w * 1.02, -w * 0.42, w * 0.42, w * 0.27)) gem(f.p.clone().addScaledVector(f.t, x).addScaledVector(f.y, y).addScaledVector(f.z, w * 0.3), f.z, w * 0.26);
      } else { const s = w / 2.6, pitch = s * 1.3 * 1.55; let n = Math.round(L / pitch); if (n % 2) n++; for (let i = 0; i < n; i++) { const f = frame(c, i / n); metal.push(bake(G.tCable, f.p, f.q.clone().multiply(qa(X, i % 2 ? Math.PI / 2 : 0)), V(s * 1.3, s, s))); } }
      add(root, st, 'Chain', metal, M.metal, 0.85);
      if (S.pendant !== 'none') await buildPendant(S, M, root, st, c, w, gem, gems, C);
      add(root, st, 'Stones', gems, M.gem);
    }
    async function buildPendant(S, M, root, st, c, w, gem, gems, C) {
      const f = frame(c, 0.5), P = S.psize / 100, iced = S.piced, txt = String(S.text || '').trim(), pend = [], pgems = [], pgem = gemFn(pgems, st, C);
      const bR = Math.max(w * 0.62, 0.0028), bw = Math.max(bR * 0.95, 0.0026);
      const bq = qa(Y, Math.PI / 2), bailList = [bake(NI(new THREE.TorusGeometry(1, 0.26, [6, 8, 10][C.q], [20, 32, 44][C.q])), V(), bq, V(bR, bR * 1.35, bw / 0.52))];
      if (iced) for (const a of [-0.75, -0.37, 0, 0.37, 0.75]) { const ph = Math.PI + a, lp = V(Math.cos(ph) * 1.26 * bR, Math.sin(ph) * 1.35 * 1.26 * bR, 0).applyQuaternion(bq), n = V(Math.cos(ph), Math.sin(ph) / 1.35, 0).applyQuaternion(bq); gem(V().add(lp).add(f.p).add(V(0, -bR * 0.4, 0)), n, bw * 0.62); }
      const bailBottom = -bR * 1.35 * 1.26 - bR * 0.4;
      let info;
      if (S.pendant === 'medallion') {
        const R = P / 2, d = Math.max(0.0014, P * 0.045), bt = P * 0.008, sh = new THREE.Shape(); sh.absarc(0, -R, R, 0, TAU, false);
        pend.push(NI(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: C.q ? 3 : 1, curveSegments: [32, 64, 96][C.q] })));
        const zt = d + bt, rr = R * 0.045, turns = Math.round(TAU * R * 0.95 / (rr * 2.6)), per = [6, 10, 14][C.q];
        for (let k = 0; k < 2; k++) { const pts = []; for (let i = 0; i < turns * per; i++) { const a = i / (turns * per) * TAU, tw = turns * a + k * Math.PI, rad = R * 0.95 + Math.cos(tw) * rr * 0.55; pts.push(V(Math.cos(a) * rad, -R + Math.sin(a) * rad, zt + Math.sin(tw) * rr * 0.55)); } pend.push(NI(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), turns * per, rr * 0.75, [4, 6, 8][C.q], true))); }
        let mk = null, tm = null;
        if (txt) {
          mk = await raster('text', txt.slice(0, 4), S.font, false); const aspect = (mk.bb.x1 - mk.bb.x0) / Math.max(1, mk.bb.y1 - mk.bb.y0), th = Math.min(R * 0.95, R * 1.45 / aspect);
          const before = pend.length; tm = maskPiece(mk, th, C, pgem, false, pend, { z: zt - 0.0002, depth: Math.max(0.0008, d * 0.7), rim: false });
          for (let i = before; i < pend.length; i++) pend[i].translate(0, -R + th / 2, 0); tm.oy = -R + th / 2;
        }
        if (iced) {
          const g = Math.max(0.001, Math.min(0.0024, R * 0.075)) * (C.q ? 1 : 1.3);
          for (const [x, y] of hexGrid(-R * 0.86, R * 0.86, -R - R * 0.86, -R + R * 0.86, g)) {
            if (Math.hypot(x, y + R) > R * 0.85 - g * 0.5) continue;
            if (mk) { const hit = (dx, dy) => { const px = (x + dx) / tm.s + tm.cx, py = -(y + dy - tm.oy) / tm.s + mk.bb.y0; const i = Math.round(px), j = Math.round(py); return i >= 0 && j >= 0 && i < mk.W && j < mk.H && mk.outer[j * mk.W + i]; }; const e = g * 0.7; if (hit(0, 0) || hit(e, 0) || hit(-e, 0) || hit(0, e) || hit(0, -e)) continue; }
            pgem(V(x, y, zt - g * 0.05), Z, g);
          }
        }
        info = { bx: 0, by: 0, d };
      } else {
        const kind = TEXTP.includes(S.pendant) ? 'text' : S.pendant; let t = txt || 'A'; if (S.pendant === 'initial') t = t.slice(0, 2);
        const mk = await raster(kind, t, kind === 'text' ? S.font : null, S.pendant === 'name' && S.font !== 'script' && t.length > 1);
        info = maskPiece(mk, P, C, pgem, iced, pend, {});
      }
      // under the bail, centred on the chain's lowest point; on a body it rests against the chest
      let oz = f.p.z - info.d / 2;
      if (C.chestFront) { const yb = f.p.y + bailBottom, zc = Math.max(C.chestFront(yb - P * 0.15), C.chestFront(yb - P * 0.5), C.chestFront(yb - P * 0.9)); oz = Math.max(oz + 0.002, zc + 0.0015); }
      const off = V(f.p.x - info.bx, f.p.y + bailBottom + bR * 0.15 - info.by, oz);
      add(root, st, 'Pendant', pend.map(g => { g.translate(off.x, off.y, off.z); return g; }), M.metal, 1);
      add(root, st, 'Bail', bailList.map(g => { g.translate(f.p.x, f.p.y - bR * 0.4, Math.max(f.p.z, oz + info.d / 2)); return g; }), M.metal, 1);
      for (const g of pgems) { g.translate(off.x, off.y, off.z); gems.push(g); }
    }

    /* ---------- watches ---------- */
    function outline(o, k, Cls) {
      const p = new Cls();
      if (o.round) p.absarc(0, 0, o.r * k, 0, TAU, false);
      else { const w = o.r * k * 0.94, h = o.r * k * 0.98, r = o.r * k * 0.36, b = o.r * k * 0.05; p.moveTo(-w + r, -h); p.quadraticCurveTo(0, -h - b, w - r, -h); p.quadraticCurveTo(w, -h, w, -h + r); p.quadraticCurveTo(w + b, 0, w, h - r); p.quadraticCurveTo(w, h, w - r, h); p.quadraticCurveTo(0, h + b, -w + r, h); p.quadraticCurveTo(-w, h, -w, h - r); p.quadraticCurveTo(-w - b, 0, -w, -h + r); p.quadraticCurveTo(-w, -h, -w + r, -h); }
      return p;
    }
    function ringPts(o, k, spacing) { const path = outline(o, k, THREE.Path), n = Math.max(8, Math.floor(path.getLength() / spacing)), pts = path.getSpacedPoints(n).slice(0, n); return pts.map((p, i) => { const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], t = V(b.x - a.x, b.y - a.y, 0).normalize(); return [V(p.x, p.y, 0), V(t.y, -t.x, 0), t]; }); }
    const lathe = (pts, seg = 128) => NI(new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg).rotateX(Math.PI / 2));
    function dialTexture(S, R, ext, C) {
      const N = [256, 512, 1024][C.q], c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), k = N / 2 / ext;
      const col = new THREE.Color(DIALS[S.dial][1]), lum = col.r * 0.3 + col.g * 0.59 + col.b * 0.11, ink = lum > 0.35 ? '#1c1a18' : '#f2efe8';
      x.translate(N / 2, N / 2); x.scale(k, -k); const g = x.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, DIALS[S.dial][1]); g.addColorStop(1, '#' + col.clone().multiplyScalar(0.72).getHexString());
      x.fillStyle = g; x.fillRect(-ext, -ext, ext * 2, ext * 2); x.strokeStyle = ink; x.fillStyle = ink;
      for (let i = 0; i < 60; i++) { const a = i * TAU / 60, big = i % 5 === 0; x.lineWidth = R * (big ? 0.012 : 0.006); x.beginPath(); x.moveTo(Math.sin(a) * R * 0.95, Math.cos(a) * R * 0.95); x.lineTo(Math.sin(a) * R * (big ? 0.88 : 0.91), Math.cos(a) * R * (big ? 0.88 : 0.91)); x.stroke(); }
      const txt = (t, y, size, font) => { x.save(); x.scale(1, -1); x.fillStyle = ink; x.font = `${font} ${size}px "DM Sans", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 0, -y); x.restore(); };
      if (S.indices === 'roman') { const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']; nums.forEach((n, i) => { if (S.comp === 'chrono' && i % 3 === 0 && i) return; if (S.comp === 'date' && i === 3) return; const a = i * TAU / 12; x.save(); x.rotate(-a); x.scale(1, -1); x.fillStyle = ink; x.font = `600 ${R * 0.15}px "Bodoni Moda", Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, 0, -R * 0.72); x.restore(); }); }
      if (S.dialText) txt(String(S.dialText).toUpperCase(), R * 0.36, R * 0.085, '700');
      txt(S.comp === 'chrono' ? 'CHRONOGRAPH' : 'AUTOMATIC', -R * 0.32, R * 0.045, '500');
      if (S.comp === 'chrono') for (const [cx, cy] of [[-R * 0.44, 0], [R * 0.44, 0], [0, -R * 0.46]]) { x.save(); x.translate(cx, cy); x.fillStyle = '#' + col.clone().multiplyScalar(0.6).getHexString(); x.beginPath(); x.arc(0, 0, R * 0.19, 0, TAU); x.fill(); x.strokeStyle = ink; x.lineWidth = R * 0.006; x.beginPath(); x.arc(0, 0, R * 0.19, 0, TAU); x.stroke(); for (let i = 0; i < 30; i++) { const a = i * TAU / 30; x.lineWidth = R * (i % 5 ? 0.004 : 0.008); x.beginPath(); x.moveTo(Math.sin(a) * R * 0.18, Math.cos(a) * R * 0.18); x.lineTo(Math.sin(a) * R * (i % 5 ? 0.16 : 0.14), Math.cos(a) * R * (i % 5 ? 0.16 : 0.14)); x.stroke(); } x.restore(); }
      if (S.comp === 'date') { const d = String(new Date().getDate()); x.fillStyle = '#f7f5ef'; x.fillRect(R * 0.6, -R * 0.065, R * 0.17, R * 0.13); x.save(); x.scale(1, -1); x.fillStyle = '#141414'; x.font = `700 ${R * 0.1}px "DM Sans", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(d, R * 0.685, R * 0.005); x.restore(); }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
    }
    let SUN = null;
    function sunburst() {
      if (SUN) return SUN; const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N), d = im.data;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const dx = i - N / 2, dy = j - N / 2, th = Math.atan2(dy, dx), k = Math.floor((th + Math.PI) * 160), h = Math.sin(k * 12.9898) * 43758.5453, v = (h - Math.floor(h)) - 0.5, tx = -Math.sin(th) * v * 0.7, ty = Math.cos(th) * v * 0.7, o = (j * N + i) * 4; d[o] = (tx * 0.5 + 0.5) * 255; d[o + 1] = (-ty * 0.5 + 0.5) * 255; d[o + 2] = 255; d[o + 3] = 255; }
      x.putImageData(im, 0, 0); SUN = new THREE.CanvasTexture(c); return SUN;
    }
    function handShape(kind, w, len, tail) {
      const s = new THREE.Shape();
      if (kind === 'dauphine') { s.moveTo(0, -tail); s.lineTo(w / 2, len * 0.06); s.lineTo(0, len); s.lineTo(-w / 2, len * 0.06); s.lineTo(0, -tail); }
      else { s.moveTo(-w / 2, -tail); s.lineTo(w / 2, -tail); s.lineTo(w / 2, len * 0.86); s.lineTo(0, len); s.lineTo(-w / 2, len * 0.86); s.lineTo(-w / 2, -tail); }
      return s;
    }
    function insideFn(o, k) { if (o.round) return (x, y) => Math.hypot(x, y) < o.r * k; const poly = outline(o, k, THREE.Path).getPoints(24).map(p => [p.x, p.y]); return (x, y) => pip(poly, x, y); }
    async function buildWatch(S, M, root, st, C) {
      const G = qg(C.q), CYLZ = G.CYLZ, sc = S.size / 40, r = S.size / 2000, h = 0.0118 * sc, classic = S.shape === 'classic', o = { round: classic, r };
      const hw = classic ? r : r * 0.94, hh = classic ? r : r * 0.98, bw = (classic ? Math.round(S.size * 0.5) : S.size * 0.6) / 1000;
      const caseG = [], bezel = [], brushed = [], marks = [], lume = [], band = [], bandB = [], strap = [], gems = [], gem = gemFn(gems, st, C);
      const bt = 0.0021, dz = 0.0006, rd = 0.8 * r, LS = [32, 64, 128][C.q];
      if (classic) {
        caseG.push(lathe([[0.00001, -h], [r * 0.74, -h], [r * 0.78, -h * 0.97], [r * 0.84, -h * 0.9], [r * 0.9, -h * 0.86], [r * 0.96, -h * 0.76], [r, -h * 0.58], [r, -h * 0.22], [r * 0.985, -h * 0.06], [r * 0.95, 0], [0.00001, 0]], LS));
        const lw = 0.0024; for (const sy of [1, -1]) {
          const s = new THREE.Shape(); const y0 = hh * 0.72; s.moveTo(y0, -h * 0.15); s.lineTo(hh + 0.0015, -h * 0.16); s.quadraticCurveTo(hh + 0.0068, -h * 0.24, hh + 0.0086, -h * 0.62); s.lineTo(hh + 0.0088, -h * 0.86); s.lineTo(hh + 0.0062, -h * 0.9); s.quadraticCurveTo(hh + 0.0035, -h * 0.72, y0, -h * 0.8); s.lineTo(y0, -h * 0.15);
          const g = NI(new THREE.ExtrudeGeometry(s, { depth: lw, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.00025, bevelSegments: C.q ? 3 : 1, curveSegments: [4, 8, 16][C.q] }));
          g.applyMatrix4(new THREE.Matrix4().makeBasis(sy > 0 ? Y : Y.clone().negate(), Z, sy > 0 ? X : X.clone().negate())); g.computeBoundingBox(); const bx = g.boundingBox, mx = (bx.min.x + bx.max.x) / 2; g.translate(-mx, 0, 0);
          for (const sx of [-1, 1]) caseG.push(bake(g, V(sx * (bw / 2 + lw / 2 + 0.0002), 0, 0))); g.dispose();
        }
      } else {
        caseG.push(bake(NI(new THREE.ExtrudeGeometry(outline(o, 1, THREE.Shape), { depth: h * 0.82, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0006, bevelSegments: C.q ? 4 : 1, curveSegments: [12, 24, 40][C.q] })), V(0, 0, -h * 0.82 - 0.0001)));
        for (const sy of [-1, 1]) caseG.push(bake(RB(bw * 1.08, 0.0062, h * 0.62, 0.0012, C.q), V(0, sy * (hh + 0.0016), -h * 0.48)));
      }
      { const cg = new THREE.CylinderGeometry(0.5, 0.5, 1, [16, 32, 48][C.q], 1); const p = cg.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), rr = Math.hypot(p.getX(i), p.getZ(i)); if (rr > 0.3) { const f = Math.round((a + Math.PI) / TAU * 48) % 2 ? 0.9 : 1; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); } } cg.computeVertexNormals(); cg.rotateZ(Math.PI / 2);
        const crown = NI(cg); caseG.push(bake(crown, V(hw + 0.0018, 0, -h * 0.48), null, V(0.0034, 0.0058 * sc, 0.0058 * sc)), bake(CYLZ, V(hw + 0.0034, 0, -h * 0.48), qa(Y, Math.PI / 2), V(0.0042 * sc, 0.0042 * sc, 0.0006)));
        if (!classic) for (const sy of [-1, 1]) caseG.push(bake(RB(0.003, 0.0026, h * 0.5, 0.0008, C.q), V(hw + 0.0011, sy * 0.0045 * sc, -h * 0.48)));
        if (S.comp === 'chrono') for (const sy of [-1, 1]) { const a = sy * 0.72, px = Math.cos(a) * (hw + 0.0012), py = Math.sin(a) * (hh + 0.0012); caseG.push(bake(CYLZ, V(px, py, -h * 0.48), Q().setFromUnitVectors(Z, V(Math.cos(a), Math.sin(a), 0)), V(0.0032, 0.0032, 0.0045))); } }
      if (classic) {
        const prof = S.bezel === 'stepped' ? [[r * 0.8, 0.0004], [r * 0.805, 0.0015], [r * 0.86, 0.0015], [r * 0.87, bt], [r * 0.94, bt], [r * 0.985, 0.0007], [r * 0.97, 0], [r * 0.8, 0], [r * 0.8, 0.0004]]
          : S.bezel === 'polished' ? [[r * 0.8, 0.0004], [r * 0.81, 0.0013], [r * 0.86, bt], [r * 0.94, 0.0018], [r * 0.985, 0.0006], [r * 0.97, 0], [r * 0.8, 0], [r * 0.8, 0.0004]]
            : [[r * 0.8, 0.0004], [r * 0.805, bt * 0.95], [r * 0.83, bt], [r * 0.97, bt], [r * 0.99, 0.0008], [r * 0.97, 0], [r * 0.8, 0], [r * 0.8, 0.0004]];
        bezel.push(lathe(prof, LS));
      } else { const bs = outline(o, 1, THREE.Shape); bs.holes.push(outline(o, 0.8, THREE.Path)); brushed.push(bake(NI(new THREE.ExtrudeGeometry(bs, { depth: bt - 0.0006, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.0003, bevelSegments: C.q ? 2 : 1, curveSegments: [16, 32, 64][C.q] })), V(0, 0, 0.0003))); }
      if (S.bezel === 'pave') { const g = (classic ? r * 0.066 : r * 0.058) * (C.q ? 1 : 1.35); for (const k of (C.q ? (classic ? [0.865, 0.935] : [0.84, 0.9, 0.96]) : [0.9])) for (const [p] of ringPts(o, k, g * 1.03)) gem(p.setZ(bt - g * 0.02), Z, g); }
      if (S.bezel === 'baguette') for (const [p, n, t] of ringPts(o, 0.895, r * 0.11)) { const q = basisQ(t, n, Z); gem(p.setZ(bt - 0.0001), Z, 0, { w: r * 0.098, l: r * 0.15, q }); }
      const ext = r * 0.8;
      const dialMat = S.finish === 'pave' ? metalMat(S.metal, 0.18)
        : new THREE.MeshPhysicalMaterial({ map: dialTexture(S, rd * (classic ? 1 : 0.96), ext, C), metalness: S.finish === 'sunburst' ? 0.55 : 0.1, roughness: S.finish === 'sunburst' ? 0.28 : 0.75, normalMap: S.finish === 'sunburst' ? sunburst() : null, normalScale: new THREE.Vector2(0.5, 0.5), clearcoat: 0.4, clearcoatRoughness: 0.15 });
      { const dg = NI(new THREE.ShapeGeometry(outline(o, 0.8, THREE.Shape), [24, 48, 96][C.q])), p = dg.attributes.position, uv = dg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * ext) + 0.5, p.getY(i) / (2 * ext) + 0.5); add(root, st, 'Dial', [bake(dg, V(0, 0, dz))], dialMat); }
      if (S.finish === 'pave') { const g = 0.00105 * sc * (C.q ? 1 : 1.6); const inside = insideFn(o, 0.785); for (const [x, y] of hexGrid(-ext, ext, -ext, ext, g)) { if (!inside(x, y)) continue; if (Math.hypot(x, y) < 0.0016) continue; gem(V(x, y, dz + 0.0001), Z, g); } }
      const rm = rd * (classic ? 0.8 : 0.76), skip = i => (S.comp === 'date' && i === 3) || (S.comp === 'chrono' && (i === 3 || i === 6 || i === 9));
      if (S.indices !== 'roman') for (let i = 0; i < 12; i++) {
        if (skip(i)) continue; const a = Math.PI / 2 - i * TAU / 12, c = Math.cos(a), s = Math.sin(a), tg = V(-s, c, 0), offs = i === 0 ? [-0.0011 * sc, 0.0011 * sc] : [0], qr = qa(Z, a - Math.PI / 2);
        for (const off of offs) {
          const p = V(c * rm, s * rm, dz).addScaledVector(tg, off);
          if (S.indices === 'baton') { marks.push(bake(RB(0.0012 * sc, 0.0036 * sc, 0.0005, 0.00015, C.q), p.clone().setZ(dz + 0.00025), qr)); lume.push(bake(BOX, p.clone().setZ(dz + 0.00052), qr, V(0.0005 * sc, 0.0026 * sc, 0.00006))); }
          else if (S.indices === 'diamond') { marks.push(bake(CYLZ, p.clone().setZ(dz + 0.0002), null, V(0.0024 * sc, 0.0024 * sc, 0.0004))); gem(p.clone().setZ(dz + 0.00035), Z, 0.002 * sc); }
          else { marks.push(bake(RB(0.0019 * sc, 0.0044 * sc, 0.0003, 0.0001, C.q), p.clone().setZ(dz + 0.00015), qr)); gem(p.clone().setZ(dz + 0.0003), Z, 0, { w: 0.0015 * sc, l: 0.0038 * sc, q: qr }); }
        }
      }
      if (S.comp === 'date') { const Rt = rd * (classic ? 1 : 0.96); marks.push(...[[0, 1], [0, -1], [1, 0], [-1, 0]].map(([ax, ay]) => bake(BOX, V(Rt * 0.685 + ax * Rt * 0.088, ay * Rt * 0.068, dz + 0.0001), null, V(ax ? Rt * 0.012 : Rt * 0.19, ay ? Rt * 0.012 : Rt * 0.15, 0.0002)))); }
      // hands: separate pivots so they turn
      const sp = classic ? 'dauphine' : 'sword', secMat = S.finish === 'pave' ? plainMat('sec-red', { color: jc('#c8202f'), metalness: 0.8, roughness: 0.25 }) : M.metal;
      const hand = (name, kind, w, len, tail, z, lumeOn) => { const g = new THREE.Group(); g.name = name; g.position.set(0, 0, z); const m = new THREE.Mesh(merge([NI(new THREE.ExtrudeGeometry(handShape(kind, w, len, tail), { depth: 0.00008, bevelEnabled: true, bevelThickness: 0.00006, bevelSize: 0.00005, bevelSegments: 1 }))]), M.metal); g.add(m); if (lumeOn) g.add(new THREE.Mesh(merge([bake(BOX, V(0, len * 0.5, 0.00018), null, V(w * 0.42, len * 0.62, 0.00005))]), M.lume)); root.add(g); return g; };
      hand('HourHand', sp, 0.0024 * sc, rd * 0.56, rd * 0.08, 0.0013, !classic); hand('MinuteHand', sp, 0.0019 * sc, rd * 0.88, rd * 0.1, 0.00155, !classic);
      { const g = new THREE.Group(); g.name = 'SecondHand'; g.position.set(0, 0, 0.0018); g.add(new THREE.Mesh(merge([bake(BOX, V(0, (rd * 0.92 - rd * 0.2) / 2, 0), null, V(0.00035 * sc, rd * 1.12, 0.0001)), bake(CYLZ, V(0, -rd * 0.16, 0), null, V(0.0018 * sc, 0.0018 * sc, 0.0001))]), secMat)); root.add(g); }
      if (S.comp === 'chrono') [[-rd * 0.44, 0], [rd * 0.44, 0], [0, -rd * 0.46]].forEach(([x, y], i) => { const g = new THREE.Group(); g.name = 'SubdialHand' + (i + 1); g.position.set(x, y, dz + 0.0003); g.add(new THREE.Mesh(merge([bake(BOX, V(0, rd * 0.07, 0), null, V(0.0004 * sc, rd * 0.17, 0.0001)), bake(CYLZ, V(), null, V(0.0012 * sc, 0.0012 * sc, 0.00015))]), M.metal)); root.add(g); });
      marks.push(bake(CYLZ, V(0, 0, 0.00195), null, V(0.0024 * sc, 0.0024 * sc, 0.00025)));
      root.userData.chrono = S.comp === 'chrono'; root.userData.live = S.live !== false; setHands(root);
      if (S.iceCase) {
        const g = 0.0012 * sc * (C.q ? 1 : 1.4);
        for (const zz of (C.q ? [-h * 0.33, -h * 0.12] : [-h * 0.22])) for (const [p, n] of ringPts(o, 1, g * 1.04)) { if (Math.abs(p.x) > hw * 0.86 && Math.abs(p.y) < 0.004 * sc) continue; gem(p.clone().addScaledVector(n, classic ? 0.00002 : 0.0006).setZ(zz), n, g); }
        if (classic) { for (const sy of [1, -1]) for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const t = k / 4, y = hh + 0.0016 + t * 0.0062, z = -h * 0.16 - t * t * h * 0.38 + 0.0002, ny = t * 0.5; gem(V(sx * (bw / 2 + 0.0014), sy * y, z), V(0, sy * ny, 1), 0.0017); } }
        else for (const sy of [-1, 1]) for (const [x, y] of hexGrid(-bw * 0.48, bw * 0.48, -0.0024, 0.0024, 0.0013)) gem(V(x, sy * (hh + 0.0016) + y, -h * 0.17 + 0.0002), Z, 0.0012);
      }
      { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([0.00001 + t * rd * 1.01, 0.0029 - t * t * 0.0008]); }
        const cg = classic ? lathe(pts, [24, 48, 96][C.q]) : bake(NI(new THREE.ShapeGeometry(outline(o, 0.81, THREE.Shape), [16, 32, 64][C.q])), V(0, 0, 0.0022));
        const cry = add(root, st, 'Crystal', [cg], plainMat('sapphire', { color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0, metalness: 0, depthWrite: false, side: THREE.DoubleSide })); cry.renderOrder = 3; cry.castShadow = false; }
      // the bracelet wraps an oval wrist: the artifact's, or the wearer's own (C.wrist)
      const A = C.wrist ? C.wrist.A : 0.032, B = C.wrist ? C.wrist.B : 0.025, ya = classic ? hh + 0.0082 : hh + 0.0045, za = classic ? -h * 0.72 : -h * 0.48, zc = -h - B + 0.0012, ph1 = Math.asin(Math.min(0.97, ya * 0.92 / A)), bp = [V(0, ya, za)];
      for (let i = 0; i <= 90; i++) { const ph = ph1 + (TAU - 2 * ph1) * i / 90; bp.push(V(0, A * Math.sin(ph), zc + B * Math.cos(ph))); }
      bp.push(V(0, -ya, za)); root.userData.pillow = { zc, A, B, top: -h - 0.0008 };
      const bc = new THREE.CatmullRomCurve3(bp); bc.arcLengthDivisions = 800; const BL = bc.getLength();
      const bf = u => { const p = bc.getPointAt(u), t = bc.getTangentAt(u).normalize(), n = V().crossVectors(X, t).normalize(); return { p, t, n, q: basisQ(X, t, n) }; };
      const ice = S.iceBand && METALBAND.includes(S.band), taper = u => 1 - 0.2 * Math.sin(Math.PI * u), clasp = u => Math.abs(u - 0.5) < 0.07;
      const piece = (list, f, x, wd, len, th, raise) => { const c = f.p.clone().addScaledVector(X, x).addScaledVector(f.n, raise); list.push(bake(RB(wd, len, th, Math.min(wd, len) * 0.22, C.q), c, f.q)); return c; };
      if (S.band === 'three' || S.band === 'five' || S.band === 'hlink') {
        const p = S.band === 'five' ? 0.0048 : S.band === 'hlink' ? 0.0072 : 0.0062, n = Math.floor(BL / p), th = 0.0032;
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n; if (clasp(u)) continue; const f = bf(u), W = bw * taper(u), len = p * 0.94;
          if (S.band === 'three') { for (const sx of [-1, 1]) { const c = piece(bandB, f, sx * W * 0.335, W * 0.32, len, th, 0); if (ice) for (const dy of [-0.25, 0.25]) gem(c.clone().addScaledVector(f.t, dy * len).addScaledVector(f.n, th / 2), f.n, Math.min(W * 0.24, len * 0.42)); }
            const c = piece(band, f, 0, W * 0.34, len, th * 1.08, 0.0002); if (ice) for (const dy of [-0.25, 0.25]) gem(c.clone().addScaledVector(f.t, dy * len).addScaledVector(f.n, th * 0.54), f.n, Math.min(W * 0.26, len * 0.42)); }
          else if (S.band === 'five') { for (const sx of [-1, 1]) piece(bandB, f, sx * W * 0.37, W * 0.26, len, th, 0); for (const [x, off] of [[-0.155, 0], [0, 0.5], [0.155, 0]]) { const ff = bf(Math.min(0.999, u + off * p / BL)), c = piece(band, ff, x * W, W * 0.13, len * 0.52, th * 0.95, 0.0004); if (ice) gem(c.clone().addScaledVector(ff.n, th * 0.48), ff.n, W * 0.11); } }
          else { for (const sx of [-1, 1]) { const c = piece(bandB, f, sx * W * 0.3, W * 0.38, len * 0.88, th, 0); if (ice) for (const [dx, dy] of [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]]) gem(c.clone().addScaledVector(X, dx * W * 0.38 * 2.2).addScaledVector(f.t, dy * len).addScaledVector(f.n, th / 2), f.n, W * 0.13); }
            const ff = bf(Math.min(0.999, u + 0.5 / n)), c = piece(band, ff, 0, W * 0.2, len * 0.42, th * 1.05, 0.0002); if (ice) gem(c.clone().addScaledVector(ff.n, th * 0.53), ff.n, W * 0.15); }
        }
        const f = bf(0.5), W = bw * taper(0.5), c = f.p.clone().addScaledVector(f.n, 0.0006); band.push(bake(RB(W * 1.02, BL * 0.13, 0.0036, 0.0012, C.q), c, f.q));
        if (ice) for (const [x, y] of hexGrid(-W * 0.4, W * 0.4, -BL * 0.055, BL * 0.055, 0.0014)) gem(c.clone().addScaledVector(X, x).addScaledVector(f.t, y).addScaledVector(f.n, 0.0018), f.n, 0.0013);
      } else if (S.band === 'cuban') {
        const s = bw / 1.84, pitch = s * 1.55; const n = Math.floor(BL / pitch);
        for (let i = 0; i < n; i++) { const f = bf((i + 0.5) / n), q = basisQ(f.t, V().crossVectors(f.n, f.t), f.n).multiply(qa(X, i % 2 ? Math.PI : 0)); band.push(bake(G.CUBAN, f.p, q, V(s, s, s)));
          if (ice) for (const sg of [1, -1]) for (const a of [-0.42, 0, 0.42]) { const th = sg * Math.PI / 2 + a, lp = V(1.15 * Math.cos(th), 0.62 * Math.sin(th), (0.3 * Math.sin(2 * th) + 0.3) * 0.72); if (i % 2) lp.z = (0.3 * Math.sin(2 * th) - 0.3) * 0.72; gem(lp.multiplyScalar(s).applyQuaternion(q).add(f.p), f.n, s * 0.4); } }
      } else {
        const p = C.q ? 0.0021 : 0.004, n = Math.floor(BL / p), th = S.band === 'rubber' ? 0.0042 : 0.0034;
        for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, f = bf(u), W = bw * taper(u) * 0.97; strap.push(bake(BOX, f.p, f.q, V(W, p * 1.06, th))); if (S.band === 'leather' && C.q) for (const sx of [-1, 1]) band.push(bake(BOX, f.p.clone().addScaledVector(X, sx * W * 0.42).addScaledVector(f.n, th / 2 + 0.00003), f.q, V(0.00035, p * 0.55, 0.0001))); }
        const f = bf(0.5), W = bw * taper(0.5), c = f.p.clone().addScaledVector(f.n, th / 2 + 0.0006);
        const bk = [bake(RB(0.0013, 0.0095, 0.0013, 0.0005, C.q), c.clone().addScaledVector(X, W * 0.58), f.q), bake(RB(0.0013, 0.0095, 0.0013, 0.0005, C.q), c.clone().addScaledVector(X, -W * 0.58), f.q), bake(RB(W * 1.2, 0.0013, 0.0013, 0.0005, C.q), c.clone().addScaledVector(f.t, 0.0041), f.q), bake(RB(W * 1.2, 0.0013, 0.0013, 0.0005, C.q), c.clone().addScaledVector(f.t, -0.0041), f.q), bake(RB(0.0011, 0.009, 0.0008, 0.0003, C.q), c.clone().addScaledVector(f.n, 0.0004), f.q)];
        add(root, st, 'Buckle', bk, M.metal, 1);
      }
      const two = S.two && (S.metal === 'yellow' || S.metal === 'rose');
      add(root, st, 'Case', caseG, two ? M.alt : M.metal, 0.42); add(root, st, 'Bezel', bezel, M.metal, 1); add(root, st, 'BezelBrushed', brushed, M.brushed, 1); add(root, st, 'Markers', marks, M.metal); add(root, st, 'Lume', lume, M.lume);
      add(root, st, 'Bracelet', band, S.band === 'leather' ? plainMat('stitch', { color: jc('#e9dfc8'), roughness: 0.8 }) : M.metal, 0.8); add(root, st, 'BraceletBrushed', bandB, two ? M.altBrushed : M.brushed, 0.8);
      if (strap.length) add(root, st, 'Strap', strap, plainMat('strap:' + S.strap + S.band, { color: jc(STRAPS[S.strap] ? STRAPS[S.strap][1] : '#151515'), metalness: 0, roughness: S.band === 'rubber' ? 0.85 : 0.6 }));
      add(root, st, 'Stones', gems, M.gem);
    }
    // hands from the clock (the artifact's), or ten past ten when the watch is set not to run
    function setHands(root, d) {
      let H = 10, Mi = 8, Se = 37; if (d && root.userData.live) { H = d.getHours(); Mi = d.getMinutes(); Se = d.getSeconds(); }
      const g = n => root.getObjectByName(n);
      const h = g('HourHand'), m = g('MinuteHand'), s = g('SecondHand'); if (!h) return;
      h.rotation.z = -((H % 12) + Mi / 60) / 12 * TAU; m.rotation.z = -(Mi + Se / 60) / 60 * TAU; s.rotation.z = -(root.userData.chrono ? 0 : Math.floor(Se)) / 60 * TAU;
      const s1 = g('SubdialHand1'), s2 = g('SubdialHand2'), s3 = g('SubdialHand3'); if (s1) s1.rotation.z = -Math.floor(Se) / 60 * TAU; if (s2) s2.rotation.z = -0.9; if (s3) s3.rotation.z = -2.1;
    }

    /* ---------- rings, bracelets, earrings, grillz ---------- */
    const inRR = (x, y, hw, hh, r) => { const dx = Math.max(Math.abs(x) - (hw - r), 0), dy = Math.max(Math.abs(y) - (hh - r), 0); return Math.abs(x) <= hw && Math.abs(y) <= hh && Math.hypot(dx, dy) <= r; };
    const textHit = (mk, tm, oy) => (x, y) => { const px = x / tm.s + tm.cx, py = -(y - oy) / tm.s + mk.bb.y0, i = Math.round(px), j = Math.round(py); return i >= 0 && j >= 0 && i < mk.W && j < mk.H && mk.outer[j * mk.W + i] === 1; };
    async function buildMore(S, M, root, st, C) {
      const G = qg(C.q), metal = [], gems = [], gem = gemFn(gems, st, C);
      if (S.kind === 'bracelet') {
        const L = C.wristR ? C.wristR * TAU : S.wrist * 0.0254, R = L / TAU, w = S.bwidth / 1000;
        const fr = u => { const a = u * TAU, p = V(Math.sin(a) * R, Math.cos(a) * R, 0), t = V(Math.cos(a), -Math.sin(a), 0), n = V(Math.sin(a), Math.cos(a), 0), y = V().crossVectors(n, t); return { p, t, n, y, q: basisQ(t, y, n) }; };
        if (S.bstyle === 'tennis') { const n = Math.round(L / (w * 1.06)); for (let i = 0; i < n; i++) { const f = fr(i / n); metal.push(bake(G.SETTING, f.p, f.q, V(w, w, w))); gem(f.p, f.n, w * 0.96); } }
        else {
          const s = w / 1.84; let n = Math.round(L / (s * 1.55)); if (n % 2) n++;
          for (let i = 1; i < n; i++) { const f = fr(i / n), q = f.q.clone().multiply(qa(X, i % 2 ? Math.PI : 0)); metal.push(bake(G.CUBAN, f.p, q, V(s, s, s)));
            if (S.iced) for (const sg of [1, -1]) for (const a of [-0.42, 0, 0.42]) { const th = sg * Math.PI / 2 + a, lp = V(1.15 * Math.cos(th), 0.62 * Math.sin(th), (0.3 * Math.sin(2 * th) + 0.3) * 0.72); if (i % 2) lp.z = (0.3 * Math.sin(2 * th) - 0.3) * 0.72; gem(lp.multiplyScalar(s).applyQuaternion(q).add(f.p), f.n, s * 0.4); } }
          const f = fr(0), cp = f.p.clone().addScaledVector(f.n, w * 0.05); metal.push(bake(RB(w * 2.2, w * 1.1, w * 0.6, w * 0.18, C.q), cp, basisQ(f.t, f.y, f.n)));
          if (S.iced) for (const [x, y] of hexGrid(-w * 0.95, w * 0.95, -w * 0.4, w * 0.4, w * 0.26)) gem(cp.clone().addScaledVector(f.t, x).addScaledVector(f.y, y).addScaledVector(f.n, w * 0.3), f.n, w * 0.25);
        }
        add(root, st, 'Bracelet', metal, M.metal, 0.85); add(root, st, 'Stones', gems, M.gem); return;
      }
      if (S.kind === 'studs') {
        const d = S.ssize / 1000;
        for (const [sx, nm] of [[-1, 'EarringL'], [1, 'EarringR']]) {
          const g = new THREE.Group(); g.name = nm; g.position.set(sx * Math.max(0.012, d * 1.7), 0, 0); root.add(g);
          const m = [], gs = [], gm = gemFn(gs, st, C), cz = S.halo ? d * 0.12 : 0;
          m.push(bake(G.HEAD, V(0, 0, cz), null, V(d, d, d))); gm(V(0, 0, cz), Z, d * 0.96);
          if (S.halo) { const g2 = Math.max(0.0009, d * 0.17), rad = d * 0.5 + g2 * 0.62, n = Math.floor(TAU * rad / (g2 * 1.06)); for (let i = 0; i < n; i++) { const a = i / n * TAU; gm(V(Math.cos(a) * rad, Math.sin(a) * rad, -d * 0.08), Z, g2); } m.push(bake(G.CYLZ, V(0, 0, -d * 0.08 - g2 * 0.32), null, V((rad + g2 * 0.62) * 2, (rad + g2 * 0.62) * 2, g2 * 0.5))); }
          m.push(bake(G.CYLZ, V(0, 0, -0.0055), null, V(0.0009, 0.0009, 0.009)), bake(RB(0.0062, 0.0052, 0.0013, 0.0006, C.q), V(0, 0, -0.0085)));
          add(g, st, nm + 'Metal', m, M.metal, 1); add(g, st, nm + 'Stones', gs, M.gem);
        }
        return;
      }
      if (S.kind === 'ring') {
        const dIn = C.fingerR ? C.fingerR * 2 + 0.0006 : (11.63 + 0.8128 * S.rsize) / 1000, th = 0.0019, Rm = dIn / 2 + th / 2, bwid = S.rwidth / 1000, Ro = Rm + th / 2, sd = S.ssize / 1000;
        const tg = new THREE.TorusGeometry(Rm, th / 2, [6, 10, 16][C.q], [32, 64, 128][C.q]); tg.scale(1, 1, bwid / th); tg.rotateY(Math.PI / 2); metal.push(NI(tg));
        const qH = basisQ(X, V(0, 0, -1), Y), head = [], hg = [], hgem = gemFn(hg, st, C); let hz = Ro - 0.0004;
        if (S.head === 'solitaire') { head.push(bake(G.HEAD, V(0, 0, sd * 0.4), null, V(sd, sd, sd))); hgem(V(0, 0, sd * 0.4), Z, sd * 0.96); hz = Ro - 0.0002; }
        else if (S.head === 'cluster') {
          const ps = Math.max(0.011, sd * 1.9), zt = 0.0024; head.push(bake(RB(ps, ps, 0.0024, ps * 0.24, C.q), V(0, 0, 0.0012)), bake(RB(ps * 0.78, ps * 0.78, 0.0018, ps * 0.18, C.q), V(0, 0, -0.0005)));
          if (C.q) { const rim = []; for (let i = 0; i < 160; i++) { const a = i / 160 * TAU, c = Math.cos(a), sn = Math.sin(a), e = 4, k = Math.pow(Math.pow(Math.abs(c), e) + Math.pow(Math.abs(sn), e), -1 / e) * (ps / 2 - 0.00035); rim.push(V(c * k, sn * k, zt + 0.0001)); } head.push(NI(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), [60, 100, 200][C.q], 0.0004, C.q >= 2 ? 7 : 4, true))); }
          const cs = sd * 0.72; head.push(bake(G.HEAD, V(0, 0, zt + cs * 0.28), null, V(cs, cs, cs))); hgem(V(0, 0, zt + cs * 0.28), Z, cs * 0.96);
          const g = 0.00105 * (C.q ? 1 : 1.5); for (const [x, y] of hexGrid(-ps / 2, ps / 2, -ps / 2, ps / 2, g)) { if (Math.hypot(x, y) < cs * 0.5 + g * 0.45) continue; if (!inRR(x, y, ps / 2 - 0.0008, ps / 2 - 0.0008, ps * 0.2)) continue; hgem(V(x, y, zt - g * 0.05), Z, g); }
        } else if (S.head === 'signet') {
          const ps = Math.max(0.013, sd * 2.1), a = ps * 0.56, b = ps * 0.46, sh = new THREE.Shape(), zt = 0.0026; sh.absellipse(0, 0, a, b, 0, TAU, false, 0);
          head.push(NI(new THREE.ExtrudeGeometry(sh, { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: C.q ? 3 : 1, curveSegments: [24, 48, 72][C.q] })));
          const txt = (String(S.text || '').trim() || 'M').slice(0, 2), mk = await raster('text', txt, S.font, false), asp = (mk.bb.x1 - mk.bb.x0) / Math.max(1, mk.bb.y1 - mk.bb.y0), thh = Math.min(b * 1.45, a * 1.55 / asp);
          const before = head.length, tm = maskPiece(mk, thh, C, hgem, false, head, { z: zt - 0.0002, depth: 0.0007, rim: false }); for (let i = before; i < head.length; i++) head[i].translate(0, thh / 2, 0);
          if (C.q) { const rp = []; for (let i = 0; i < 140; i++) { const t = i / 140 * TAU; rp.push(V(Math.cos(t) * (a - 0.0003), Math.sin(t) * (b - 0.0003), zt)); } head.push(NI(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp, true), [60, 100, 180][C.q], 0.00038, C.q >= 2 ? 7 : 4, true))); }
          if (S.iced) { const g = 0.001 * (C.q ? 1 : 1.5), hit = textHit(mk, tm, thh / 2), e = g * 0.7; for (const [x, y] of hexGrid(-a, a, -b, b, g)) { if ((x / (a - g * 1.1)) ** 2 + (y / (b - g * 1.1)) ** 2 > 1) continue; if (hit(x, y) || hit(x + e, y) || hit(x - e, y) || hit(x, y + e) || hit(x, y - e)) continue; hgem(V(x, y, zt - g * 0.05), Z, g); } }
        }
        if (S.head === 'eternity') {
          const g = Math.min(bwid * 0.72, 0.0032), n = Math.floor(TAU * Ro / (g * 1.08));
          for (let i = 0; i < n; i++) { const a = i / n * TAU, nr = V(0, Math.cos(a), Math.sin(a)); gem(nr.clone().multiplyScalar(Ro - g * 0.06), nr, g); }
          for (const sx of [-1, 1]) { const t2 = new THREE.TorusGeometry(Ro, 0.0003, 4, [32, 64, 128][C.q]); t2.rotateY(Math.PI / 2); t2.translate(sx * (g / 2 + 0.00028), 0, 0); metal.push(NI(t2)); }
        } else {
          if (S.iced && S.head !== 'signet') { const g = Math.min(bwid * (bwid > 0.0035 ? 0.38 : 0.62), 0.0018), cols = bwid > 0.0035 ? [-bwid * 0.22, bwid * 0.22] : [0], step = g * 1.08 / Ro;
            for (const sg of [1, -1]) for (let a = 0.42; a < 1.2; a += step) for (const x of cols) { const nr = V(0, Math.cos(a), sg * Math.sin(a)); gem(nr.clone().multiplyScalar(Ro - g * 0.05).setX(x), nr, g); } }
          const Mx = new THREE.Matrix4().compose(V(0, hz, 0), qH, ONE); for (const g of head) { g.applyMatrix4(Mx); metal.push(g); } for (const g of hg) { g.applyMatrix4(Mx); gems.push(g); }
        }
        add(root, st, 'Ring', metal, M.metal, 1); add(root, st, 'Stones', gems, M.gem); return;
      }
      if (S.kind === 'grillz') {
        const Ra = 0.027, t = 0.0022, six = String(S.teeth) === '6';
        const UP = [6.8, 7.6, 6.6, 8.6, 8.6, 6.6, 7.6, 6.8], UH = [8.4, 10, 9, 10.6, 10.6, 9, 10, 8.4], LO = [7, 6.8, 5.8, 5.2, 5.2, 5.8, 6.8, 7], LH = [7.6, 9, 8.4, 8.2, 8.2, 8.4, 9, 7.6];
        for (const set of (S.gset === 'both' ? ['top', 'bottom'] : [S.gset])) {
          const top = set === 'top', a0 = six ? 1 : 0, a1 = six ? 7 : 8, Ws = (top ? UP : LO).slice(a0, a1).map(v => v / 1000), Hs = (top ? UH : LH).slice(a0, a1).map(v => v / 1000);
          let s = -Ws.reduce((a, b) => a + b, 0) / 2; const yG = top ? 0 : (C.biteGap != null ? C.biteGap : -0.0235), list = [], pts = [];
          Ws.forEach((w, i) => {
            const sc = s + w / 2; s += w; const th = sc / Ra, n = V(Math.sin(th), 0, Math.cos(th)), tt = V(Math.cos(th), 0, -Math.sin(th)), p = V(Ra * Math.sin(th), 0, -Ra * (1 - Math.cos(th))).addScaledVector(n, top ? 0 : -(C.lowInset || 0));
            const canine = six ? (i === 0 || i === 5) : (i === 1 || i === 6), fang = S.fangs && canine, h = Hs[i] * (fang ? 1.4 : 1), c = p.clone().setY(top ? yG - h / 2 : yG + h / 2), q = basisQ(tt, Y, n).multiply(qa(X, top ? -0.08 : 0.08));
            let geo; if (fang) { const sh = new THREE.Shape(), hw = w * 0.44, hh = h / 2, sy = top ? 1 : -1; sh.moveTo(-hw, sy * hh); sh.lineTo(hw, sy * hh); sh.lineTo(hw, -sy * hh * 0.1); sh.lineTo(0, -sy * hh); sh.lineTo(-hw, -sy * hh * 0.1); sh.closePath(); geo = NI(new THREE.ExtrudeGeometry(sh, { depth: t * 0.5, bevelEnabled: true, bevelThickness: t * 0.25, bevelSize: w * 0.05, bevelSegments: C.q ? 3 : 1 })); geo.translate(0, 0, -t * 0.25); }
            else geo = RB(w * 0.95, h, t, w * 0.26, C.q);
            const b = bake(geo, c, q); list.push(S.gstyle === 'cut' ? flat(b) : b); if (fang) geo.dispose();
            if (S.gstyle === 'iced') { const g = 0.00105 * (C.q ? 1 : 1.4), fn = Z.clone().applyQuaternion(q); for (const [x, y] of hexGrid(-w * 0.38, w * 0.38, -h * 0.42, h * 0.42, g)) { if (fang && (top ? y < -h * 0.06 : y > h * 0.06)) continue; gem(V(x, y, t / 2 - g * 0.04).applyQuaternion(q).add(c), fn, g); } }
            pts.push(p.clone().setY(top ? yG - 0.0012 : yG + 0.0012).addScaledVector(n, -t * 0.25));
          });
          if (pts.length > 1) list.push(NI(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0011, C.q ? 8 : 4, false)));
          add(root, st, top ? 'GrillTop' : 'GrillBottom', list, M.metal, 1);
        }
        add(root, st, 'Stones', gems, M.gem);
      }
    }

    /* ---------- build + price ---------- */
    const kindOf = sp => sp.k === 'more' ? ((sp.o && sp.o.kind) || DEF.more.kind) : sp.k;
    const full = sp => ({ ...DEF[sp.k], ...(sp.o || {}) });
    // C: { q (detail), r (renderer for the stones' studio cube), curve, chestFront, wrist, wristR, fingerR, biteGap }
    async function build(sp, C) {
      const S = full(sp), st = { gems: 0, ct: 0, vol: 0, tris: 0 }, root = new THREE.Group();
      denv(C.r); const M = mats(S, C.r); C.q = Math.max(0, Math.min(2, C.q | 0)); qg(C.q);
      if (sp.k === 'chain') await buildChain(S, M, root, st, C); else if (sp.k === 'watch') await buildWatch(S, M, root, st, C); else await buildMore(S, M, root, st, C);
      const met = METALS[S.metal] || METALS.yellow, grams = st.vol * 1e6 * met[3];
      const price = Math.round((grams * met[4] * 1.9 + st.ct * 950 + (sp.k === 'watch' ? 650 : sp.k === 'chain' ? 60 : { ring: 120, studs: 80, bracelet: 60, grillz: 250 }[S.kind])) / 5) * 5;
      root.userData.jw = { kind: kindOf(sp), grams, price, st };
      root.traverse(o => { if (o.isMesh) { o.castShadow = o.name !== 'Crystal'; o.receiveShadow = false; } });
      return root;
    }
    function autoName(sp) {
      const S = full(sp), m = (METALS[S.metal] || METALS.yellow)[0].replace(' / steel', '');
      if (sp.k === 'chain') { const st = (CHAIN_STYLES.find(x => x[0] === S.style) || CHAIN_STYLES[0])[1], p = S.pendant; const pn = p === 'none' ? '' : TEXTP.includes(p) ? ` + "${String(S.text || '').trim() || 'A'}" ${(PENDANTS.find(x => x[0] === p) || ['', ''])[1].toLowerCase()}` : ` + ${S.piced ? 'iced ' : ''}${p}`; return `${S.iced ? 'Iced ' : ''}${m} ${st} ${S.width}mm ${S.length}"${pn}`; }
      if (sp.k === 'more') {
        if (S.kind === 'ring') { const hl = { cluster: 'iced pinky', signet: 'signet', solitaire: 'solitaire', eternity: 'eternity' }[S.head]; return `${m} ${hl} ring${S.head === 'signet' ? ` "${(String(S.text || '').trim() || 'M').slice(0, 2)}"` : ''}`; }
        if (S.kind === 'bracelet') return `${S.iced && S.bstyle === 'cuban' ? 'Iced ' : ''}${m} ${S.bstyle === 'tennis' ? 'tennis' : 'Cuban'} bracelet ${S.bwidth}mm`;
        if (S.kind === 'studs') return `${m} ${S.ssize}mm ${S.halo ? 'halo ' : ''}studs`;
        return `${S.gstyle === 'iced' ? 'Iced' : S.gstyle === 'cut' ? 'Diamond-cut' : 'Polished'} ${m} ${S.gset === 'both' ? 'top + bottom' : S.gset} ${S.teeth} grillz${S.fangs ? ' with fangs' : ''}`;
      }
      const iced = S.bezel === 'pave' || S.bezel === 'baguette' || S.finish === 'pave' || S.iceCase; return `${iced ? 'Iced ' : ''}${m} ${S.shape === 'sport' ? 'cushion sport' : 'classic'} ${S.size}mm, ${(BANDS.find(x => x[0] === S.band) || BANDS[0])[1].toLowerCase()}`;
    }
    // what's safe to accept from another player: only the schema's keys, chips from their lists, ranges clamped, short text
    function clean(sp) {
      if (!sp || typeof sp !== 'object' || !SCHEMA[sp.k]) return null;
      const o = {}, src = sp.o && typeof sp.o === 'object' ? sp.o : {};
      for (const f of SCHEMA[sp.k]) {
        const v = src[f.id]; if (v === undefined) continue;
        if (f.type === 'chips') { if (typeof v === 'string' && f.opts.some(x => x[0] === v)) o[f.id] = v; }
        else if (f.type === 'range') { const n = +v; if (isFinite(n)) o[f.id] = Math.max(f.min, Math.min(f.max, Math.round(n / f.step) * f.step)); }
        else if (f.type === 'toggle') o[f.id] = !!v;
        else if (typeof v === 'string') o[f.id] = v.replace(/[^\w .'!&$#*+-]/g, '').slice(0, f.max);
      }
      return { k: sp.k, o };
    }
    // only what differs from the defaults travels
    function compact(sp) { const o = {}, d = DEF[sp.k]; for (const k in sp.o) if (k in d && sp.o[k] !== d[k]) o[k] = sp.o[k]; return { k: sp.k, o }; }
    function dropRenderer(r) { const k = rid(r); for (const [key, m] of [...MATS]) if (key.endsWith(':' + k)) { m.dispose(); MATS.delete(key); } const t = DENVS.get(k); if (t) { t.dispose(); DENVS.delete(k); } }
    return { dropRenderer, METALS, STONES, DIALS, STRAPS, FONTS, SCHEMA, DEF, PRESETS, TEXTP, METALBAND, build, setHands, autoName, clean, compact, full, kindOf, denv, fontsP, isFontsReady: () => fontsReady, Q: qg };
  })();
