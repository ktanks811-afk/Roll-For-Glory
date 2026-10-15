// Boxes bucketed on a coarse grid, so "does anything overlap this box?" only
// looks at the few boxes nearby instead of every box on the map. Building the
// map runs these checks hundreds of thousands of times, and on a phone the
// plain list scans were most of the loading time.
export class RectGrid {
  constructor(cell = 200) { this.cell = cell; this.cells = new Map(); }
  // file `o` under every cell its box (x0..x1, z0..z1) touches
  add(o, x0, z0, x1, z1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = i * 100003 + j, a = this.cells.get(k);
        if (a) a.push(o); else this.cells.set(k, [o]);
      }
    return o;
  }
  // true when test(o) holds for any box filed near x0..x1, z0..z1. The caller
  // widens the query by whatever padding its test allows, so the answer is
  // exactly what testing every box would give.
  some(x0, z0, x1, z1, test) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const a = this.cells.get(i * 100003 + j);
        if (a) for (const o of a) if (test(o)) return true;
      }
    return false;
  }
}
