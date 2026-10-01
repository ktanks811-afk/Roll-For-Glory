import { CARS } from '../js/data/cars.js';
import { buildSpec, metrics } from '../js/sim/powertrain.js';
const f = v => v == null ? '  -  ' : v.toFixed(2);
for (const c of CARS) {
  const s = buildSpec(c, {}, {});
  const m = metrics(s);
  console.log((c.make+' '+c.model+' '+c.trim).slice(0,38).padEnd(38), String(s.hp).padStart(5)+'hp', '0-60', f(m.zero60), '1/4', f(m.quarter), '@'+m.quarterTrap.toFixed(0), 'top', m.topSpeed.toFixed(0), 'fd', c.fd, 'PI', m.pi, m.cls);
}
