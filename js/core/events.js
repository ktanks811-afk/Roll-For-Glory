// Tiny pub/sub. Systems announce what happened ("raceFinished", "carBought")
// and anything that cares — story, social feed, HUD toasts — listens.
const handlers = new Map();

export function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name).add(fn);
  return () => handlers.get(name).delete(fn);
}

export function emit(name, data) {
  const set = handlers.get(name);
  if (set) for (const fn of [...set]) {
    try { fn(data); } catch (e) { console.error(`[event ${name}]`, e); }
  }
}
