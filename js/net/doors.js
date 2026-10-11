import { online } from './online.js';
import { deeds, me as deedMe } from './deeds.js';
import { LOC_BY_ID, PROPERTIES } from '../data/world.js';
import { LAND } from '../data/estate.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { levels, game } from '../core/state.js';
import { openPanel, bind, esc, toast } from '../ui/dom.js';

const KNOCK_RANGE = 10;
const GRANT_SECONDS = 90;
const MAX_CARS = 100;
const clean = s => String(s ?? '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || 'Racer';
const property = id => LOC_BY_ID[id] && ((PROPERTIES[id] && PROPERTIES[id].price > 0) || LAND[id]) ? LOC_BY_ID[id] : null;

function carView(c) {
  const m = CAR_BY_ID[c.modelId];
  return m ? { uid: String(c.uid || '').slice(0, 32), modelId: c.modelId, name: carName(m, c.year), year: c.year, miles: Math.round(c.miles || 0), visual: c.visual || null, levels: levels(c), cond: c.cond || null } : null;
}

class Doors {
  constructor() {
    this.incoming = null;
    this.access = new Map();
    this.outgoing = null;
    online.on((ev, data) => { if (ev === 'door') this.receive(data); });
  }
  peerAtProperty(s, propId) {
    const d = deeds.owners.get(propId), loc = property(propId);
    if (!d || d.uid === s.uid || !loc) return null;
    return online.list().find(p => p.uid === d.uid && Math.hypot(p.x - loc.x, p.z - loc.z) < 24) || null;
  }
  nearOwnedDoor(s) {
    const p = this.world?.playerState?.();
    if (!p) return null;
    let best = null, bd = KNOCK_RANGE;
    for (const [id, owner] of deeds.owners) {
      if (!owner || owner.uid === s.uid) continue;
      const loc = property(id);
      if (!loc) continue;
      const d = Math.hypot(p.x - loc.x, p.z - loc.z);
      if (d < bd) { bd = d; best = { id, owner, loc }; }
    }
    return best;
  }
  knock(s, propId) {
    const target = this.peerAtProperty(s, propId);
    if (!target) { toast('They are not at home right now.', 'bad'); return false; }
    const loc = property(propId);
    online.send({ k: 'door', a: 'knock', to: target.id, p: propId, n: clean(s.player?.name), u: s.uid });
    this.outgoing = { propId, to: target.id, name: target.name, until: performance.now() + 15000 };
    toast('Knocked on ' + loc.name.split(' (')[0] + "'s door.", 'info');
    return true;
  }
  receive(m) {
    if (!m || typeof m !== 'object') return;
    if (m.a === 'knock' && m.to === online.id) {
      const owner = deeds.owners.get(String(m.p || ''));
      if (!owner || owner.uid !== deedMe(game.s).uid) return;
      this.incoming = { from: m.id, uid: String(m.u || ''), name: clean(m.n), propId: String(m.p) };
      toast(clean(m.n) + ' is at your door.', 'info');
      return;
    }
    if (m.a === 'grant' && m.to === online.id) {
      const propId = String(m.p || ''), owner = deeds.owners.get(propId);
      if (!owner || owner.uid !== m.u) return;
      const cars = Array.isArray(m.cars) ? m.cars.slice(0, MAX_CARS).map(carView).filter(Boolean) : [];
      this.access.set(String(m.u), { property: propId, until: performance.now() + GRANT_SECONDS * 1000, cars });
      toast('Door unlocked. Welcome inside — ' + cars.length + ' cars in the garage.', 'good');
      return;
    }
    if (m.a === 'deny' && m.to === online.id) {
      this.outgoing = null;
      toast(clean(m.n) + " didn't answer the door.", 'bad');
    }
  }
  letIn(s) {
    const q = this.incoming;
    if (!q) return;
    const cars = s.cars.filter(c => !c.stolen).slice(0, MAX_CARS).map(carView).filter(Boolean);
    online.send({ k: 'door', a: 'grant', to: q.from, p: q.propId, u: s.uid, n: clean(s.player?.name), cars });
    this.incoming = null;
    toast(q.name + ' can come in.', 'good');
  }
  deny() {
    if (!this.incoming) return;
    online.send({ k: 'door', a: 'deny', to: this.incoming.from, n: clean(game.s.player?.name) });
    this.incoming = null;
    toast('You left them outside.', 'info');
  }
  carsFor(s, propId) {
    const owner = deeds.owners.get(propId);
    if (!owner || owner.uid === s.uid) return null;
    const a = this.access.get(owner.uid);
    if (!a || a.property !== propId || a.until < performance.now()) return null;
    return a.cars;
  }
  promptHtml() {
    if (this.incoming) return '<kbd>ENTER</kbd> <b style="color:#2cff7a">LET ' + esc(this.incoming.name) + ' IN</b> · <kbd>R</kbd> DENY';
    const q = this.nearOwnedDoor(this.world?.s || game.s);
    return q ? '<kbd>E</kbd> KNOCK ON <b>' + esc(q.owner.name) + "'S DOOR</b>" : '';
  }
  use() {
    if (this.incoming) { this.letIn(game.s); return true; }
    const q = this.nearOwnedDoor(game.s);
    return q ? this.knock(game.s, q.id) : false;
  }
  openGarage(ownerName, cars) {
    openPanel((root, h) => {
      const cards = cars.map(c => '<div class="card"><h3>🚗 ' + esc(c.name) + '</h3><p class="muted small">' + c.year + ' · ' + c.miles.toLocaleString() + ' miles · Stage ' + Math.max(0, ...Object.values(c.levels || {})) + '</p><span class="tag tag-green">OWNER: ' + esc(ownerName) + '</span></div>').join('');
      root.innerHTML = '<div class="p-head"><h1>' + esc(ownerName) + "'s Garage<small>You were let inside · " + cars.length + ' cars</small></h1><button class="btn x" data-action="close">×</button></div><div class="p-body"><div class="grid">' + (cards || '<div class="empty">The garage is empty.</div>') + '</div></div>';
      bind(root, { close: () => h.close() });
    });
  }
  update(dt, world) {
    this.world = world;
    for (const [uid, a] of this.access) if (a.until < performance.now()) this.access.delete(uid);
    if (this.incoming && !online.active) this.incoming = null;
    if (this.outgoing && this.outgoing.until < performance.now()) this.outgoing = null;
    if (world.inCar || world.rides?.riding) return;
    const p = world.playerState();
    for (const [propId, owner] of deeds.owners) {
      if (owner.uid === world.s.uid) continue;
      const cars = this.carsFor(world.s, propId);
      const loc = property(propId);
      if (!cars || !loc || Math.hypot(p.x - loc.x, p.z - loc.z) > 10) continue;
      if (!this._shown) { this._shown = true; this.openGarage(owner.name, cars); }
      break;
    }
    if (!this.nearOwnedDoor(world.s)) this._shown = false;
  }
}
export const doors = new Doors();
