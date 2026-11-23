#!/usr/bin/env python3
"""Smooth AI turns + turn signals: injects scripts/turns/_turns.js into index.html and patches the AI drivers.
Idempotent: re-running replaces the block between the smooth-turns markers and skips patches already applied."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = os.path.join(ROOT, 'index.html')
s = open(F, encoding='utf-8').read()
core = open(os.path.join(ROOT, 'scripts', 'turns', '_turns.js'), encoding='utf-8').read().rstrip('\n') + '\n'
B, E = '  // ==== smooth turns (begin) ====\n', '  // ==== smooth turns (end) ====\n'

def sub(old, new, count=1):
    global s
    if new in s and old not in s: return
    n = s.count(old)
    if n != count: sys.exit(f'patch target found {n}x (want {count}): {old[:90]!r}')
    s = s.replace(old, new)

# 1. the core, right after mtCarYaw
if B in s:
    i, j = s.index(B), s.index(E) + len(E); s = s[:i] + core + s[j:]
else:
    anchor = "    return d > 0.6 * dt && dx * gx + dz * gz > 0 ? Math.atan2(-dx, -dz) : Math.atan2(-gx, -gz);\n  }\n"
    if s.count(anchor) != 1: sys.exit('mtCarYaw anchor missing')
    s = s.replace(anchor, anchor + core)

# 2. hood drivers
m = re.search(r"  function hDrive\(e, dt, want\) \{\n.*?\n  \}\n(?=  function hPlaceOnRoad)", s, re.S)
if not m: sys.exit('hDrive not found')
s = s[:m.start()] + """  function hDrive(e, dt, want) {
    if (e.a == null) return;
    // stop for your car sitting in its lane, and follow (or stop behind) anybody in front of it, around corners too
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), [mx, mz] = hMe(), ex = mx - e.x, ez = mz - e.z, ahead = ex * fx + ez * fz, side = Math.abs(ex * -fz + ez * fx);
    let cap = 99; if (ahead > 0 && ahead < 11 && side < 3.2 && !(e.ride && hInCar())) cap = 0;
    for (const o of HOOD.ents) {
      if (o === e || !o.inCar || o.gone || o.down) continue; const dx = o.x - e.x, dz = o.z - e.z; if (dx * dx + dz * dz > 196) continue;
      const fa = dx * fx + dz * fz, sd = Math.abs(dx * -fz + dz * fx); if (fa < 1 || sd > 2.4 || Math.abs(hNorm(o.yaw - e.yaw)) > 1.3) continue;
      cap = Math.min(cap, fa < 7.5 ? 0 : Math.max(0, o.sp || 0) * (fa - 7.5) / 4);
    }
    trDrive(e, dt, want, cap, 3.6, false, hNext);   // SMOOTH-TURNS
  }
""" + s[m.end():]

# 3. cops
m = re.search(r"  function copRoad\(u, dt, want, hot\) \{\n.*?\n  \}\n(?=  function copOnRoad)", s, re.S)
if not m: sys.exit('copRoad not found')
s = s[:m.start()] + """  function copRoad(u, dt, want, hot) {
    if (u.join != null) { copJoined(u, dt, want); return; } if (u.a == null) return;
    let cap = 99;
    if (!hot) {
      const fx = -Math.sin(u.yaw), fz = -Math.cos(u.yaw), [mx, mz] = copMe(), ex = mx - u.x, ez = mz - u.z, ahead = ex * fx + ez * fz, side = Math.abs(ex * -fz + ez * fx);
      if (ahead > 0 && ahead < 12 && side < 3.2) cap = 0;
      for (const o of COP.units) {
        if (o === u || o.gone || o.mode === 'park') continue; const dx = o.x - u.x, dz = o.z - u.z; if (dx * dx + dz * dz > 196) continue;
        const fa = dx * fx + dz * fz, sd = Math.abs(dx * -fz + dz * fx); if (fa < 1 || sd > 2.4 || Math.abs(cNorm(o.yaw - u.yaw)) > 1.3) continue;
        cap = Math.min(cap, fa < 8 ? 0 : Math.max(0, o.sp || 0) * (fa - 8) / 4);
      }
    }
    trDrive(u, dt, want, cap, hot ? 1.6 : 3.6, hot, copNext);   // SMOOTH-TURNS
  }
""" + s[m.end():]

# 4. the regulars' schedule runs the same arcs
m = re.search(r"  function hSched\(n, T\) \{\n.*?\n  \}\n", s, re.S)
if not m and 'return trSched(hRoutes().list[n], T)' not in s: sys.exit('hSched not found')
if m: s = s[:m.start()] + "  function hSched(n, T) { return trSched(hRoutes().list[n], T); }   // SMOOTH-TURNS\n" + s[m.end():]
sub("    e.x = p.x; e.z = p.z; e.yaw = p.yaw; e.sp = p.v; e.sch = p; return e;",
    "    e.x = p.x; e.z = p.z; e.yaw = p.yaw; e.sp = p.v; e.sch = p; e._tx = null; return e;")
sub("    const p = hSched(e.sn, hNow() / 1000); e.sch = p; e.inCar = true; e.sp = p.v; e.want = p.v;",
    "    const p = hSched(e.sn, hNow() / 1000); e.sch = p; e.inCar = true; e.brk = p.v < (e.sp || 0) - 0.02; e.sp = p.v; e.want = p.cv; e.sig = p.sig; e.sigT = performance.now() / 1000;")
sub("    if (dx * dx + dz * dz > 900) { e.x = p.x; e.z = p.z; e.yaw = p.yaw; } else { const k = 1 - Math.exp(-dt * 6); e.x += dx * k; e.z += dz * k; e.yaw += hNorm(p.yaw - e.yaw) * Math.min(1, dt * 5); }",
    "    if (dx * dx + dz * dz > 900) { e.x = p.x; e.z = p.z; e.yaw = p.yaw; e._tx = null; } else trPlace(e, p, dt);   // SMOOTH-TURNS")
sub("      if (m.sch) { m.a = m.sch.a; m.b = m.sch.b; m.u = m.sch.u; m.path = null; m.sp = m.sch.v; m.want = m.sch.v; m.sch = null; }",
    "      if (m.sch) { m.a = m.sch.a; m.b = m.sch.b; m.u = m.sch.u; m.path = null; m.sp = m.sch.v; m.want = m.sch.cv || m.sch.v; m._pa0 = m.sch.pa; m._nb0 = m.sch.nb; m._ab = null; m.sch = null; }")

# 5. hood: draw the lamps, send/receive the blinker
sub("if (e.inCar) { e.slot.position.set(0, 0.12, 0); e.slot.rotation.y = e.yaw; if (e.model) spinWheels(e.model, e.sp * dt); }",
    "if (e.inCar) { e.slot.position.set(0, 0.12, 0); e.slot.rotation.y = e.yaw; if (e.model) { spinWheels(e.model, e.sp * dt); trLamps(e.model, !e.down && now - (e.sigT || 0) < 0.5 ? e.sig : 0, !e.down && now - (e.sigT || 0) < 0.5 && e.brk, now, e.ph); } } else if (e.model && (e.sig || e.brk)) { e.sig = 0; e.brk = false; trLamps(e.model, 0, false, now, 0); }")
sub("(e.inCar ? 1 : 0) | (e.down ? 2 : 0) | (e.gd ? 4 : 0) | (e.kind === 'homie' && hInCar() ? 8 : 0), e.ct || 0, x];",
    "(e.inCar ? 1 : 0) | (e.down ? 2 : 0) | (e.gd ? 4 : 0) | (e.kind === 'homie' && hInCar() ? 8 : 0) | (e.inCar && e.sig ? (e.sig < 0 ? 16 : 32) : 0), e.ct || 0, x];")
sub("inCar: !!(fl & 1), down: !!(fl & 2), gd: fl & 4 ? 1 : 0, hide: !!(fl & 8),",
    "inCar: !!(fl & 1), down: !!(fl & 2), gd: fl & 4 ? 1 : 0, hide: !!(fl & 8), sig: fl & 16 ? -1 : fl & 32 ? 1 : 0,")
sub("""    const dx = r.x - e.x, dz = r.z - e.z, k = Math.min(1, dt * 8);
    if (dx * dx + dz * dz > 900) { e.x = r.x; e.z = r.z; e.yaw = r.yaw; } else { e.x += dx * k; e.z += dz * k; e.yaw += hNorm(r.yaw - e.yaw) * Math.min(1, dt * 8); }
""", """    // run their car ahead by its speed since the last word, so it rolls instead of stepping
    const ag = r.inCar ? Math.min(0.5, now - e.seen) : 0, rx = r.x - Math.sin(r.yaw) * r.sp * ag, rz = r.z - Math.cos(r.yaw) * r.sp * ag;
    const dx = rx - e.x, dz = rz - e.z, k = 1 - Math.exp(-dt * 8);
    if (dx * dx + dz * dz > 900) { e.x = rx; e.z = rz; e.yaw = r.yaw; } else { e.x += dx * k; e.z += dz * k; e.yaw += hNorm(r.yaw - e.yaw) * Math.min(1, dt * 8); }
    if (r.inCar) trRemote(e, r.sp, r.sig, dt);   // SMOOTH-TURNS
""")

# 6. cops: lamps on the street, blinker over the network
sub("const m = u.model; if (m && u.g.visible) { spinWheels(m, Math.hypot(u.x - ox, u.z - oz)); copLights(m, u.lights, t, u.ph);",
    "const m = u.model; if (m && u.g.visible) { spinWheels(m, Math.hypot(u.x - ox, u.z - oz)); copLights(m, u.lights, t, u.ph); trLamps(m, u.mode === 'park' || u.lights || t - (u.sigT || 0) > 0.5 ? 0 : u.sig, u.mode !== 'park' && t - (u.sigT || 0) < 0.5 && u.brk, t, u.ph);")
sub("const m = r.model; if (m && r.g.visible) { spinWheels(m, Math.hypot(r.x - ox, r.z - oz)); copLights(m, r.lights, t, r.ph);",
    "const m = r.model; if (m && r.g.visible) { spinWheels(m, Math.hypot(r.x - ox, r.z - oz)); copLights(m, r.lights, t, r.ph); trRemote(r, q.sp, r.lights ? 0 : q.sig, dt); trLamps(m, r.sig, r.brk, t, r.ph);")
sub("const o = u.officer, f = (u.lights ? 1 : 0) | (u.siren ? 2 : 0) | (o ? 4 : 0) | (/chase|stop/.test(u.mode) ? 8 : 0);",
    "const o = u.officer, f = (u.lights ? 1 : 0) | (u.siren ? 2 : 0) | (o ? 4 : 0) | (/chase|stop/.test(u.mode) ? 8 : 0) | (u.sig && !u.lights && performance.now() / 1000 - (u.sigT || 0) < 0.5 ? (u.sig < 0 ? 16 : 32) : 0);")
sub("    r.rt = { x: X, z: Z, yaw: y100 / 100, sp: sp10 / 10, t: now, hot: !!(f & 8) };",
    "    r.rt = { x: X, z: Z, yaw: y100 / 100, sp: sp10 / 10, t: now, hot: !!(f & 8), sig: f & 16 ? -1 : f & 32 ? 1 : 0 };")

open(F, 'w', encoding='utf-8').write(s)
print('smooth turns applied')
