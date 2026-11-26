  // ==== weather (begin) ====
  (() => {
  // ---------- live weather (2026-11-26, "Enhance my game more"): North Texas rain and thunderstorms in the 3D world ----------
  // - Live weather runs on the server's shared clock (20-minute slots), so everybody online gets the same sky with no network
  //   traffic. Clock app → Weather can pin it to Clear, Cloudy, Rain or Storm instead (this phone only).
  // - Rain falls around the camera (one draw call), splashes on the ground, a grey overcast sky and closer fog roll in, the sun
  //   goes soft, roads, sidewalks and roofs get wet (darker, glossy, puddles that mirror the sky) and dry off slowly after.
  // - Storms bring lightning bolts on the horizon, flashes that light the whole city and thunder a few seconds later.
  // - Real wet grip: pavement grips about 80% in rain and 72% in a storm, grass and dirt off the road are slick and draggy.
  //   Drag strip runs and roll races keep their own surfaces (untouched).
  // - Your tires throw spray when the road is wet, your headlights come on in a storm, the rain hiss + thunder are drawn
  //   in WebAudio (nothing downloaded), muffled when you're in the car.
  const WX = { want: 'live', kind: 'clear', rain: 0, ov: 0, wet: 0, storm: 0, flash: 0, bolt: null, nextBolt: 8, t: 0, base: null, slot: -1, told: '', on: true, stats: {} };
  window.__wx = WX;
  try { const p = localStorage.getItem('mw3d.wx'); if (['live', 'clear', 'cloudy', 'rain', 'storm'].includes(p)) WX.want = p; } catch (e) {}
  const WX_KIND = {   // target: rain amount, overcast, storm (lightning), clouds coverage (env: 0.3 overcast .. 1.2 clear)
    clear: { rain: 0, ov: 0, storm: 0, cov: 0.62, ic: '☀️', name: 'Clear' },
    cloudy: { rain: 0, ov: 0.45, storm: 0, cov: 0.4, ic: '☁️', name: 'Cloudy' },
    rain: { rain: 0.62, ov: 0.82, storm: 0, cov: 0.22, ic: '🌧️', name: 'Rain' },
    storm: { rain: 1, ov: 1, storm: 1, cov: 0.14, ic: '⛈️', name: 'Thunderstorm' },
  };
  const WX_SLOT = 20 * 60 * 1000;
  const wxHash = n => { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // the shared forecast: same answer on every phone for the same 20 minutes (Texas: mostly clear, some clouds, a rain now and then)
  function wxSlotKind(slot) {
    const h = wxHash(slot * 7 + 3);
    if (h < 0.56) return 'clear'; if (h < 0.76) return 'cloudy'; if (h < 0.92) return 'rain'; return 'storm';
  }
  function wxLiveKind(now) { return wxSlotKind(Math.floor(now / WX_SLOT)); }
  WX.forecast = (now = Date.now()) => { const s = Math.floor(now / WX_SLOT), out = []; for (let i = 0; i < 4; i++) out.push({ at: (s + i) * WX_SLOT, kind: wxSlotKind(s + i) }); return out; };
  function wxTarget() { return WX.want === 'live' ? wxLiveKind(Date.now()) : WX.want; }

  // ================= wet surfaces: every lit material gets wet where it faces up =================
  // wxWet: x = wetness 0..1, y = puddles 0..1, z = time (ripples), w = rain falling now
  // wxSky: x = overcast (reflections of the sky go grey), y = lightning flash
  const WXU = { x: 0, y: 0, z: 0, w: 0 }, WXS = { x: 0, y: 0, z: 0, w: 0 };
  for (const k of Object.keys(THREE.ShaderLib)) { const u = THREE.ShaderLib[k].uniforms; if (u && u.roughness) { u.wxWet = { value: WXU }; u.wxSky = { value: WXS }; } }
  {
    const pars = `
uniform vec4 wxWet;
uniform vec4 wxSky;
float wxEnvK = 1.0;
vec3 wxTone( vec3 c ) { float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); return mix( c, vec3( l ) * vec3( 0.97, 0.99, 1.03 ), wxSky.x * 0.8 ) * ( 1.0 - wxSky.x * 0.3 + wxSky.y * 2.0 ); }
float wxH( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float wxN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( wxH( i ), wxH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( wxH( i + vec2( 0.0, 1.0 ) ), wxH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
`;
    const wet = `
	if ( wxWet.x > 0.001 ) {
		vec3 wxD = - vViewPosition - viewMatrix[ 3 ].xyz;
		vec3 wxW = vec3( dot( viewMatrix[ 0 ].xyz, wxD ), dot( viewMatrix[ 1 ].xyz, wxD ), dot( viewMatrix[ 2 ].xyz, wxD ) );
		float wxUp = dot( normal, viewMatrix[ 1 ].xyz );
		float wxFlat = smoothstep( 0.5, 0.92, wxUp );
		float wxMx = max( diffuseColor.r, max( diffuseColor.g, diffuseColor.b ) ), wxSat = ( wxMx - min( diffuseColor.r, min( diffuseColor.g, diffuseColor.b ) ) ) / max( wxMx, 1e-3 );   // relative: dark grass counts as green
		float wxPn = wxN( wxW.xz * 0.09 ) * 0.62 + wxN( wxW.xz * 0.41 + 7.0 ) * 0.26 + wxN( wxW.xz * 1.7 ) * 0.12;
		float wxPud = smoothstep( 0.6, 0.66, wxPn + ( 1.0 - wxWet.y ) * 0.4 ) * wxFlat * ( 1.0 - smoothstep( 0.18, 0.32, wxSat ) ) * ( 1.0 - smoothstep( 0.6, 1.2, wxW.y ) );
		float wxK = wxWet.x * ( wxFlat * 0.85 + 0.15 ), wxG = wxK * ( 1.0 - smoothstep( 0.18, 0.34, wxSat ) ) * ( 1.0 - smoothstep( 0.2, 0.42, dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ) );   // grass and paint darken, only grey ground turns glossy
		diffuseColor.rgb *= 1.0 - wxK * 0.32 * ( 1.0 - metalnessFactor ) - wxPud * wxWet.x * 0.2;
		roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.55, wxG );
		roughnessFactor = mix( roughnessFactor, 0.06, wxPud * wxWet.x );
		wxEnvK = 1.0 + wxG * 0.7 + wxPud * wxWet.x * 2.2;
		if ( wxWet.w > 0.01 && wxPud > 0.01 ) {
			vec2 wxC = floor( wxW.xz * 1.6 ); vec2 wxF = fract( wxW.xz * 1.6 ) - 0.5;
			float wxPh = fract( wxWet.z * 1.3 + wxH( wxC ) );
			float wxR = length( wxF - ( vec2( wxH( wxC + 3.1 ), wxH( wxC + 5.7 ) ) - 0.5 ) * 0.5 );
			float wxRing = sin( clamp( ( wxR - wxPh * 0.45 ) * 60.0, -3.14, 3.14 ) ) * ( 1.0 - wxPh ) * step( wxR, wxPh * 0.45 + 0.05 );
			normal = normalize( normal + ( viewMatrix[ 0 ].xyz * wxF.x + viewMatrix[ 2 ].xyz * wxF.y ) * wxRing * 0.35 * wxPud * wxWet.w );
		}
	}
`;
    const C = THREE.ShaderChunk;
    if (C.envmap_physical_pars_fragment && C.lights_physical_fragment && /return envMapColor\.rgb \* envMapIntensity;/.test(C.envmap_physical_pars_fragment)) {
      C.envmap_physical_pars_fragment = pars + C.envmap_physical_pars_fragment.replace('return PI * envMapColor.rgb * envMapIntensity;', 'return PI * wxTone( envMapColor.rgb ) * envMapIntensity;').replace('return envMapColor.rgb * envMapIntensity;', 'return wxTone( envMapColor.rgb ) * ( envMapIntensity * wxEnvK );');
      C.lights_physical_fragment = wet + C.lights_physical_fragment;
      WX.stats.wetShader = true;
    } else console.warn('weather: wet shader not patched');
  }

  // ================= rain: streaks around the camera =================
  const RN = { mesh: null, splash: null, U: null, SU: null, n: 0 };
  function rnBuild() {
    if (RN.mesh) return;
    const N = RN.n = phone ? 3600 : 7000;
    const g = new THREE.BufferGeometry(), seed = new Float32Array(N * 4 * 4), cor = new Float32Array(N * 4 * 2), idx = new (N * 4 > 65535 ? Uint32Array : Uint16Array)(N * 6);
    for (let i = 0; i < N; i++) {
      const s = [Math.random(), Math.random(), Math.random(), Math.random()];
      for (let v = 0; v < 4; v++) { seed.set(s, (i * 4 + v) * 4); cor[(i * 4 + v) * 2] = v & 1 ? 1 : -1; cor[(i * 4 + v) * 2 + 1] = v >> 1; }
      idx.set([i * 4, i * 4 + 1, i * 4 + 3, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('cor', new THREE.BufferAttribute(cor, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const U = RN.U = { uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uT: { value: 0 }, uAmt: { value: 0 }, uBox: { value: phone ? 26 : 34 }, uH: { value: 11 }, uWind: { value: new THREE.Vector2(1.6, 0.7) },
      uCol: { value: new THREE.Color(0.75, 0.78, 0.82) }, uA: { value: 0.3 }, uNear: { value: 0.8 } };
    const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 seed; attribute vec2 cor; uniform vec3 uCam, uVel; uniform float uT, uAmt, uBox, uH, uNear; uniform vec2 uWind; varying float vA; varying vec2 vC;
        void wxMain() {
          vA = 0.0; vC = cor; gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
          if ( seed.w > uAmt ) return;
          float spd = 9.0 + seed.w * 2.5;
          vec3 p;
          p.x = uCam.x + mod( seed.x * uBox + uWind.x * uT - uCam.x, uBox ) - uBox * 0.5;
          p.z = uCam.z + mod( seed.y * uBox + uWind.y * uT - uCam.z, uBox ) - uBox * 0.5;
          p.y = uCam.y + uH * 0.45 - mod( seed.z * uH + uT * spd, uH );
          if ( p.y < 0.0 ) return;
          vec3 vel = vec3( uWind.x, - spd, uWind.y ) - uVel;
          vec3 tail = p - vel * ( 0.04 + 0.02 * seed.x );
          vec4 a = viewMatrix * vec4( p, 1.0 ), b = viewMatrix * vec4( tail, 1.0 );
          float d = length( a.xyz );
          vA = smoothstep( uNear, uNear + 2.5, d ) * ( 1.0 - smoothstep( uBox * 0.3, uBox * 0.5, d ) );
          vec2 dir = b.xy - a.xy; float L = length( dir ); dir = L > 1e-5 ? dir / L : vec2( 0.0, 1.0 );
          vec2 side = vec2( - dir.y, dir.x ) * ( 0.006 + d * 0.0012 );
          vec4 q = mix( a, b, cor.y ); q.xy += side * cor.x;
          gl_Position = projectionMatrix * q;
        }
        void main() { wxMain();
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform vec3 uCol; uniform float uA; varying float vA; varying vec2 vC;
        void main() {
        #include <logdepthbuf_fragment>
         float a = uA * vA * ( 1.0 - abs( vC.x ) ) * ( 0.35 + 0.65 * vC.y ); if ( a < 0.004 ) discard; gl_FragColor = vec4( uCol, a );
        #include <encodings_fragment>
        }` });
    const m = RN.mesh = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5; m.name = 'wx-rain'; m.visible = false; scene.add(m);
    // splashes: little rings that pop up on the ground around you
    const NS = phone ? 420 : 900, sg = new THREE.BufferGeometry(), ss = new Float32Array(NS * 4 * 3), sc = new Float32Array(NS * 4 * 2), si = new Uint16Array(NS * 6);
    for (let i = 0; i < NS; i++) { const s = [Math.random(), Math.random(), Math.random()]; for (let v = 0; v < 4; v++) { ss.set(s, (i * 4 + v) * 3); sc[(i * 4 + v) * 2] = v & 1 ? 1 : -1; sc[(i * 4 + v) * 2 + 1] = v >> 1 ? 1 : -1; } si.set([i * 4, i * 4 + 1, i * 4 + 3, i * 4, i * 4 + 3, i * 4 + 2], i * 6); }
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 4 * 3), 3)); sg.setAttribute('seed', new THREE.BufferAttribute(ss, 3)); sg.setAttribute('cor', new THREE.BufferAttribute(sc, 2)); sg.setIndex(new THREE.BufferAttribute(si, 1));
    const SU = RN.SU = { uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uAmt: { value: 0 }, uR: { value: 16 }, uCol: { value: new THREE.Color(0.8, 0.83, 0.86) }, uA: { value: 0.35 } };
    const smat = new THREE.ShaderMaterial({ uniforms: SU, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 seed; attribute vec2 cor; uniform vec3 uCam; uniform float uT, uAmt, uR; varying vec2 vC; varying float vP;
        float h1( float n ) { return fract( sin( n ) * 43758.5453 ); }
        void wxMain() {
          vC = cor; vP = 1.0; gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
          if ( seed.z > uAmt ) return;
          float c = uT * ( 2.2 + seed.z ) + seed.x * 9.0, cyc = floor( c ); vP = fract( c );
          vec2 o = ( vec2( h1( cyc * 1.7 + seed.y * 91.0 ), h1( cyc * 3.1 + seed.x * 57.0 ) ) - 0.5 ) * 2.0 * uR;
          vec3 p = vec3( floor( uCam.x ) + o.x, 0.04, floor( uCam.z ) + o.y );
          p.xz += cor * ( 0.03 + vP * 0.11 );
          gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
        }
        void main() { wxMain();
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform vec3 uCol; uniform float uA; varying vec2 vC; varying float vP;
        void main() {
        #include <logdepthbuf_fragment>
         float r = length( vC ); float ring = smoothstep( 0.55, 0.8, r ) * ( 1.0 - smoothstep( 0.85, 1.0, r ) ) + ( 1.0 - smoothstep( 0.0, 0.35, r ) ) * ( 1.0 - smoothstep( 0.0, 0.25, vP ) );
          float a = uA * ring * ( 1.0 - vP ); if ( a < 0.004 ) discard; gl_FragColor = vec4( uCol, a );
        #include <encodings_fragment>
        }` });
    const sm = RN.splash = new THREE.Mesh(sg, smat); sm.frustumCulled = false; sm.renderOrder = 4; sm.name = 'wx-splash'; sm.visible = false; scene.add(sm);
  }

  // ================= tire spray: mist kicked up behind your tires on a wet road =================
  const SP = { mesh: null, list: [], i: 0, max: phone ? 90 : 160, acc: 0 };
  function spMesh() {
    if (SP.mesh) return SP.mesh;
    const N = SP.max, g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const ip = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), ia = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); ip.setUsage(THREE.DynamicDrawUsage); ia.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('ip', ip); g.setAttribute('ia', ia); g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(0.82, 0.85, 0.88) } }, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute vec4 ip; attribute float ia; varying vec2 vUv; varying float vA; void main() { vUv = uv; vA = ia; vec4 mv = modelViewMatrix * vec4( ip.xyz, 1.0 ); mv.xy += position.xy * ip.w; gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: '#include <logdepthbuf_pars_fragment>\nuniform vec3 uCol; varying vec2 vUv; varying float vA; void main() {\n#include <logdepthbuf_fragment>\n float r = length( vUv - 0.5 ) * 2.0; float a = vA * ( 1.0 - smoothstep( 0.2, 1.0, r ) ); if ( a < 0.004 ) discard; gl_FragColor = vec4( uCol, a );\n#include <encodings_fragment>\n}' });
    const m = SP.mesh = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = 'wx-spray'; scene.add(m); return m;
  }
  function spEmit(x, z, vx, vz, k) {
    spMesh(); if (SP.list.length < SP.max) SP.list.push({ t: 9, life: 1 });
    const p = SP.list[SP.i++ % SP.list.length];
    p.x = x + (Math.random() - 0.5) * 0.3; p.y = 0.15; p.z = z + (Math.random() - 0.5) * 0.3; p.t = 0; p.life = 0.5 + Math.random() * 0.5;
    p.vx = vx * 0.55 + (Math.random() - 0.5) * 1.6; p.vz = vz * 0.55 + (Math.random() - 0.5) * 1.6; p.vy = 0.8 + Math.random() * 1.2; p.a = 0.1 + k * 0.16; p.s = 0.5 + Math.random() * 0.4;
  }
  const _sp = new THREE.Vector3();
  function spStep(dt) {
    const m = car && car.userData.model, spd = driving && !foot.on && typeof TIRE !== 'undefined' ? Math.hypot(TIRE.vx, TIRE.vz) : 0;
    if (m && WX.wet > 0.25 && spd > 7 && m.userData.wheels) {
      SP.acc += dt * Math.min(1, (spd - 7) / 20) * WX.wet * 46;
      while (SP.acc > 1) { SP.acc -= 1; const ws = m.userData.wheels, w = ws[(Math.random() * ws.length) | 0]; w.getWorldPosition(_sp); spEmit(_sp.x, _sp.z, -TIRE.vx * 0.25, -TIRE.vz * 0.25, WX.wet * Math.min(1, spd / 30)); }
    }
    if (!SP.mesh) return;
    const g = SP.mesh.geometry, ip = g.attributes.ip, ia = g.attributes.ia; let n = 0;
    for (const p of SP.list) {
      if (p.t >= p.life) continue; p.t += dt; const k = p.t / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 2.2; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
      ip.array[n * 4] = p.x; ip.array[n * 4 + 1] = Math.max(0.1, p.y); ip.array[n * 4 + 2] = p.z; ip.array[n * 4 + 3] = p.s + k * 1.6; ia.array[n] = p.a * Math.min(1, k * 6) * (1 - k); n++;
    }
    if (n || g.instanceCount) ip.needsUpdate = ia.needsUpdate = true;
    g.instanceCount = n; SP.mesh.visible = n > 0;
  }

  // ================= lightning =================
  const LT = { mesh: null, glow: null, t: 0 };
  function ltBolt() {
    const cp = camera.position, fw = camera.getWorldDirection(new THREE.Vector3()), a = Math.random() < 0.7 ? Math.atan2(fw.z, fw.x) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2, d = 700 + Math.random() * 1300, x = cp.x + Math.cos(a) * d, z = cp.z + Math.sin(a) * d;
    // a jagged ribbon from the cloud base to the ground, a branch or two, turned to face the camera
    const pts = []; let px = 0, py = 620 + Math.random() * 200; const seg = 22;
    for (let i = 0; i <= seg; i++) { pts.push([px, py]); px += (Math.random() - 0.5) * 46; py -= (620 / seg) * (0.7 + Math.random() * 0.6); if (py < 0) py = 0; }
    pts[pts.length - 1][1] = 0;
    const lines = [pts]; for (let b = 0; b < 2; b++) { const s = 3 + (Math.random() * 10 | 0), br = []; let bx = pts[s][0], by = pts[s][1]; const dir = Math.random() < 0.5 ? -1 : 1; for (let i = 0; i < 6; i++) { br.push([bx, by]); bx += dir * (12 + Math.random() * 26); by -= 14 + Math.random() * 26; } lines.push(br); }
    const pos = [], idx = []; let vi = 0;
    for (const L of lines) { const w = L === pts ? 3.2 : 1.6; for (let i = 0; i < L.length - 1; i++) { const [x0, y0] = L[i], [x1, y1] = L[i + 1]; pos.push(x0 - w, y0, 0, x0 + w, y0, 0, x1 - w, y1, 0, x1 + w, y1, 0); idx.push(vi, vi + 1, vi + 3, vi, vi + 3, vi + 2); vi += 4; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    if (!LT.mesh) { LT.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 4.2), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); LT.mesh.name = 'wx-bolt'; LT.mesh.frustumCulled = false; scene.add(LT.mesh); }
    else { LT.mesh.geometry.dispose(); LT.mesh.geometry = g; }
    LT.mesh.position.set(x, 0, z); LT.mesh.lookAt(cp.x, 0, cp.z); LT.mesh.visible = true; LT.t = 0; LT.d = d;
    WX.flash = 1; WX.stats.bolts = (WX.stats.bolts || 0) + 1;
    wxThunder(d);
  }
  function ltStep(dt) {
    WX.nextBolt -= dt;
    if (WX.storm > 0.6 && WX.nextBolt <= 0) { WX.nextBolt = 7 + Math.random() * 16; ltBolt(); }
    if (LT.mesh && LT.mesh.visible) {
      LT.t += dt; const t = LT.t;
      LT.mesh.material.opacity = t < 0.08 ? 1 : t < 0.14 ? 0.15 : t < 0.24 ? 0.85 : Math.max(0, 0.85 - (t - 0.24) * 4);
      if (t > 0.5) LT.mesh.visible = false;
      WX.flash = t < 0.08 ? 1 : t < 0.14 ? 0.25 : t < 0.24 ? 0.8 : Math.max(0, 0.8 - (t - 0.24) * 3.2);
    } else WX.flash = Math.max(0, WX.flash - dt * 4);
  }

  // ================= sound: rain hiss + thunder, drawn live =================
  const AU = { on: false, ctx: null, rain: null, rg: null, lp: null, noise: null };
  function auNoise(ctx, sec) { const n = ctx.sampleRate * sec | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = w * 0.6 + l * 3.0; } return b; }
  function auInit() {
    if (AU.on) return AU.ctx; const ctx = typeof audioCtx === 'function' ? audioCtx() : null; if (!ctx || ctx.state !== 'running') return null;
    AU.ctx = ctx; AU.noise = auNoise(ctx, 3);
    const src = ctx.createBufferSource(); src.buffer = AU.noise; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
    const lp = AU.lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3200; pk.gain.value = 5;
    const g = AU.rg = ctx.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start();
    AU.rain = src; AU.on = true; return ctx;
  }
  function wxThunder(d) {
    const ctx = AU.on ? AU.ctx : auInit(); if (!ctx) return;
    const delay = Math.min(6, d / 343), t0 = ctx.currentTime + delay, len = 3.5 + Math.random() * 2.5, near = d < 1100;
    const src = ctx.createBufferSource(); src.buffer = AU.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(near ? 900 : 380, t0); lp.frequency.exponentialRampToValueAtTime(110, t0 + len);
    const g = ctx.createGain(); const inCar = driving && !foot.on, vol = (near ? 0.75 : 0.5) * (inCar ? 0.7 : 1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + (near ? 0.05 : 0.4)); g.gain.setValueAtTime(vol * 0.6, t0 + 0.6); g.gain.linearRampToValueAtTime(vol * 0.8, t0 + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start(t0, Math.random() * 2); src.stop(t0 + len + 0.1);
  }
  function auStep() {
    if (!AU.on) { if (WX.rain < 0.02) return; if (!auInit()) return; }
    const t = AU.ctx.currentTime, inCar = driving && !foot.on, vol = WX.on ? WX.rain * (inCar ? 0.22 : 0.3) : 0;
    AU.rg.gain.setTargetAtTime(document.hidden ? 0 : vol, t, 0.4);
    AU.lp.frequency.setTargetAtTime(inCar ? 1500 : 7000, t, 0.2);
  }

  // ================= the sky, light and fog follow the weather =================
  // the time-of-day setTime sets the base look; the weather is layered on top each frame (and recaptured after every setTime)
  function wxCapture() {
    const R = window.__real, U = R && R.RL_SKY ? R.RL_SKY.uniforms : null;
    WX.base = { sun: sun.intensity, hemi: hemi.intensity, fog: scene.fog.color.clone(), skyK: U ? U.skyK.value : 0, haze: U ? U.haze.value : 0, turb: U ? U.turbidity.value : 0,
      cLit: U && U.cLit ? U.cLit.value.clone() : null, cShade: U && U.cShade ? U.cShade.value.clone() : null, head: car ? car.userData.head.visible : false };
  }
  const _wxGrey = new THREE.Color();
  function wxLook() {
    const B = WX.base; if (!B) return;
    const R = window.__real, U = R && R.RL_SKY ? R.RL_SKY.uniforms : null, ov = WX.on ? WX.ov : 0, f = WX.flash, night = timeName === 'night';
    sun.intensity = B.sun * (1 - 0.78 * ov) + f * (night ? 1.4 : 0.9);
    hemi.intensity = B.hemi * (1 + 0.6 * ov) + f * (night ? 2.2 : 1.2);
    const l = B.fog.r * 0.2126 + B.fog.g * 0.7152 + B.fog.b * 0.0722; _wxGrey.setRGB(l, l * 1.02, l * 1.06).multiplyScalar(night ? 0.85 : 0.82);
    scene.fog.color.copy(B.fog).lerp(_wxGrey, ov * 0.85);
    if (f > 0) scene.fog.color.lerp(_wxGrey.setRGB(0.55, 0.58, 0.7), f * (night ? 0.5 : 0.25));
    if (U) {
      U.skyK.value = B.skyK * (1 - 0.45 * ov) * (1 + f * (night ? 6 : 1.5)); U.haze.value = B.haze + (1 - B.haze) * ov * 0.9; U.turbidity.value = B.turb + ov * 6;
      if (B.cLit && U.cLit) { U.cLit.value.copy(B.cLit).multiplyScalar(1 - 0.55 * ov + f * 2.5); U.cShade.value.copy(B.cShade).multiplyScalar(1 - 0.5 * ov + f * 2); }
    }
    if (car && car.userData.head) car.userData.head.visible = B.head || ov * WX.rain > 0.5;
  }

  // ================= the weather itself =================
  function wxStep(dt) {
    WX.t += dt;
    const k = WX_KIND[wxTarget()] || WX_KIND.clear; WX.kind = wxTarget();
    // the weather rolls in over about 40 seconds (a manual pick changes faster); the ground dries off slowly after the rain
    const fast = WX.want !== 'live' ? 3 : 1, rate = dt / 40 * fast;
    const to = (v, t, r) => v + clamp(t - v, -r, r);
    WX.ov = to(WX.ov, k.ov, rate * 1.4); WX.rain = to(WX.rain, k.ov > 0.7 && WX.ov > 0.6 ? k.rain : 0, rate * 1.2); WX.storm = to(WX.storm, k.storm, rate);
    WX.wet = WX.rain > 0.05 ? to(WX.wet, 0.55 + WX.rain * 0.45, dt / 25 * fast) : Math.max(0, WX.wet - dt / 150 * fast);
    WX.cov = to(WX.cov == null ? k.cov : WX.cov, k.cov, rate * 0.5); const E = window.__env; if (E && E.debug && E.debug.EC) E.debug.EC.cov = clamp(WX.cov, 0.1, 1.2); else if (E && E.clouds) E.clouds(WX.cov);
    // tell the player when it changes
    if (WX.kind !== WX.told) { const was = WX.told; WX.told = WX.kind; if (was && worldOn && !inside) { const m = { clear: '☀️ The weather\'s clearing up.', cloudy: '☁️ Clouds rolling in.', rain: '🌧️ Rain moving in. Roads get slick, take it easy.', storm: '⛈️ Thunderstorm. Slick roads and lightning, stay off the gas in the turns.' }[WX.kind]; if (m) toast(m); } }
  }
  function wxFrame(t, dt) {
    wxStep(dt);
    const on = WX.on && worldOn && !inside, cp = camera.position, R = window.__real, tier = R && R.RL ? R.RL.tier : 'high';
    WXS.x = on ? WX.ov : 0; WXS.y = on ? WX.flash * 0.6 : 0;
    WXU.x = on ? WX.wet : 0; WXU.y = on ? clamp(WX.wet * 1.2 - 0.2, 0, 1) : 0; WXU.z = t % 1000; WXU.w = on ? WX.rain : 0;
    const raining = on && WX.rain > 0.01 && cp.y < 400;
    if (raining) rnBuild();
    if (RN.mesh) {
      RN.mesh.visible = RN.splash.visible = raining;
      if (raining) {
        const U = RN.U, night = timeName === 'night', vel = driving && !foot.on && typeof TIRE !== 'undefined' ? [TIRE.vx, TIRE.vz] : [0, 0];
        U.uCam.value.copy(cp); U.uT.value = t % 3600; U.uAmt.value = WX.rain * (tier === 'low' ? 0.55 : 1); U.uVel.value.set(vel[0], 0, vel[1]);
        U.uWind.value.set(1.2 + WX.storm * 3.2, 0.5 + WX.storm * 1.4);
        U.uCol.value.setRGB(...(night ? [0.42, 0.46, 0.54] : timeName === 'sunset' ? [0.8, 0.72, 0.66] : [0.7, 0.74, 0.8])).multiplyScalar(1 + WX.flash * 2);
        U.uA.value = night ? 0.36 : 0.3; U.uNear.value = drv.fpLens ? 2.4 : 0.7;
        const S2 = RN.SU; S2.uCam.value.copy(cp); S2.uT.value = t % 3600; S2.uAmt.value = WX.rain * (tier === 'low' ? 0.5 : 1); S2.uA.value = night ? 0.22 : 0.32; S2.uCol.value.copy(U.uCol.value);
      }
    }
    spStep(dt); ltStep(on ? dt : 0); wxLook(); auStep();
  }

  // ================= grip: wet pavement and off-road ground =================
  // SURF.mu scales every tire's grip in the vehicle sim; SURF.rr adds rolling drag. Racing (the strip, roll races) is left alone.
  function wxGrip() {
    if (!WX.on || !S || !S.car) return null;
    const YB = window.__yb; if (YB && (YB.surf && YB.built && YB.surf(drv.x, drv.z)) || YB && YB.rr && (YB.rr.race || YB.rr.pull || YB.rr.rep)) return null;
    const st = window.__st, onRoad = st && st.onRoad ? st.onRoad(drv.x, drv.z) : true;
    const E = window.__env, gk = !onRoad && E && E.debug && E.debug.groundKind ? E.debug.groundKind(drv.x, drv.z) : 0;
    let mu = 1, rr = 0;
    if (gk) { mu = lerp(0.68, 0.5, WX.wet); rr = 0.022 + WX.wet * 0.012; WX.surf = 'grass'; }
    else { mu = 1 - WX.wet * (0.2 + WX.storm * 0.08); WX.surf = WX.wet > 0.2 ? 'wet' : 'dry'; }
    return mu < 0.999 || rr > 0 ? [mu, rr] : null;
  }
  const _wxStepDrive = stepDrive;
  stepDrive = function (dt) {
    let g = null; try { g = wxGrip(); } catch (e) { g = null; }
    if (!g) return _wxStepDrive.apply(this, arguments);
    const m0 = SURF.mu, r0 = SURF.rr; SURF.mu = g[0]; SURF.rr = g[1]; WX.mu = g[0];
    try { return _wxStepDrive.apply(this, arguments); } finally { SURF.mu = m0; SURF.rr = r0; }
  };

  // ================= wiring =================
  const _wxSetTime = setTime;
  setTime = function (n) { const r = _wxSetTime.apply(this, arguments); try { wxCapture(); wxLook(); } catch (e) { console.warn('weather: ' + e.message); } return r; };
  const _wxStreet = stepStreet;
  let wxLast = 0;
  stepStreet = function (t) {
    const r = _wxStreet.apply(this, arguments);
    const dt = Math.min(0.1, Math.max(0, t - wxLast)); wxLast = t;
    try { if (!WX.base) wxCapture(); wxFrame(t, dt); } catch (e) { if (!WX.err) { WX.err = 1; console.error('weather step', e); } }
    return r;
  };
  // rooms, the creator and the custom bay render their own scenes: nothing in there is wet
  const _wxCockpit = cockpitFrame;
  cockpitFrame = function () { WXU.x = WXU.y = WXU.w = 0; WXS.x = WXS.y = 0; if (AU.on && (inside || creating)) AU.rg.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.3); return _wxCockpit.apply(this, arguments); };

  // Clock app → Weather: live forecast (same for everybody online) or pin one
  const WX_PICK = [['live', 'Live weather', 'Same sky for everybody online'], ['clear', 'Clear', ''], ['cloudy', 'Cloudy', ''], ['rain', 'Rain', 'Wet roads, less grip'], ['storm', 'Thunderstorm', 'Lightning, heavy rain, slick roads']];
  function wxSet(p) { WX.want = p; try { localStorage.setItem('mw3d.wx', p); } catch (e) {} }
  WX.set = wxSet;
  WX.snap = () => { const k = WX_KIND[wxTarget()] || WX_KIND.clear; WX.ov = k.ov; WX.rain = k.rain; WX.storm = k.storm; WX.wet = k.rain ? 0.55 + k.rain * 0.45 : 0; WX.cov = k.cov; WX.told = wxTarget(); };   // tests: jump straight there
  const _wxPhoneApp = phoneApp;
  phoneApp = function (id) {
    const r = _wxPhoneApp.apply(this, arguments);
    if (id === 'clock') {
      const sc = document.querySelector('.ph-screen .ph-list'); if (!sc) return r;
      const fc = WX.forecast(), tm = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const now = WX_KIND[WX.kind] || WX_KIND.clear;
      sc.insertAdjacentHTML('beforeend', `<div class="ph-row" style="pointer-events:none;margin-top:10px"><b>Weather now: ${now.ic} ${now.name}</b><span>${WX.wet > 0.2 ? 'Roads are wet' : 'Roads are dry'}</span></div>
        <div class="ph-row" style="pointer-events:none"><b>Next hour</b><span>${fc.slice(1).map(f => `${tm(f.at)} ${WX_KIND[f.kind].ic}`).join(' · ')}</span></div>
        ${WX_PICK.map(([k, l, s]) => `<button class="ph-row${WX.want === k ? ' on' : ''}" data-wx="${k}"><b>${k === 'live' ? '📡' : WX_KIND[k].ic} ${l}</b><span>${WX.want === k ? 'On' : s}</span></button>`).join('')}`);
      sc.querySelectorAll('[data-wx]').forEach(b => b.onclick = () => { wxSet(b.dataset.wx); phoneApp('clock'); });
    }
    return r;
  };
  WX.debug = { WXU, WXS, spEmit, RN, SP, LT, AU, wxGrip, ltBolt, wxLiveKind };
  })();
  // ==== weather (end) ====
