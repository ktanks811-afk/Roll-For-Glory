// Title screen (with a live night-city backdrop), pause menu, save slots
// and settings.

import { $, el, esc, openPanel, closePanel, closeAllPanels, modal, confirm, toast, bind } from './dom.js';
import { game, fmtMoney } from '../core/state.js';
import { SLOTS, slotInfo, slotName, saveGame, loadGame, latestSlot, deleteSlot, exportSave, importSave, settings, saveSettings } from '../core/save.js';
import { audio } from '../core/audio.js';
import { getMap } from '../world2d/world.js';
import { Camera, drawGround, drawWater, drawLots, drawRoads, drawBuildings, drawTrees, drawLighting } from '../world2d/render.js';
import { TrafficSystem } from '../world2d/traffic.js';
import { drawCar, carSprite } from '../gfx2d/carSprite.js';
import { CAR_BY_ID } from '../data/cars.js';
import { HWY_Z } from '../data/world.js';
import { openCreate } from './create.js';
import { enterWorld, toTitle } from '../main.js';
import { openPhone } from './phone.js';
import { touchUi } from './touch.js';
import { openGarage } from './garage.js';
import { openRaceMenu } from './raceSetup.js';
import { openOnline } from './online.js';
import { online } from '../net/online.js';

// ---------------- animated backdrop ----------------
const HERO = [
  ['dodge_challenger_srt_hellcat_2015', { paint: '#c41b1b', wheels: 'mesh', wheelColor: '#1a1a1a', decal: 'stripes', decalColor: '#0d0d0d', hood: 'scoop', neon: '#ff1a2e' }],
  ['nissan_skyline_gt_r_v_spec_r34_1999', { paint: '#1b4fc4', wheels: 'six', wheelColor: '#c9a24a', spoiler: 'gt', kit: 'wide', neon: '#1a9bff', tint: 'limo' }],
  ['toyota_supra_turbo_mk4_1993', { paint: '#e8641a', wheels: 'split', spoiler: 'gt', neon: '#a01aff', tint: 'medium' }],
  ['lamborghini_huracan_evo_2020', { paint: '#1f8f3a', finish: 'pearl', wheels: 'forged', neon: '#1aff6a' }],
];
export class MenuBackdrop {
  constructor() {
    this.map = getMap();
    this.cam = new Camera();
    this.cam.zoom = 5;
    this.t = 0;
    this.x = -600;
    this.traffic = new TrafficSystem(this.map.roads);
    this.heroes = HERO.map(([id, v], i) => ({ model: CAR_BY_ID[id], sprite: carSprite(CAR_BY_ID[id], v, { tires: 3 }), x: -640 - i * 14, z: HWY_Z + [3.6, 7.6, 11.6, 3.6][i], v: 36 + i * 1.5, neon: v.neon }));
  }
  update(dt) {
    this.t += dt;
    this.x += dt * 38;
    if (this.x > 1300) { this.x = -900; this.heroes.forEach((h, i) => { h.x = -940 - i * 14; }); }
    this.heroes.forEach((h, i) => { h.x += h.v * dt + Math.sin(this.t * 0.7 + i) * 0.05; });
    this.traffic.target = 18;
    this.traffic.update(dt, { px: this.x, pz: HWY_Z, signalT: this.t, density: 1, inCity: false, movers: [], extraObstacles: [] });
  }
  draw(ctx, W, H) {
    const cam = this.cam;
    cam.w = W; cam.h = H;
    cam.x = this.heroes[0].x - W * 0.12 / cam.zoom; cam.z = HWY_Z + 20 - H * 0.08 / cam.zoom;
    drawGround(ctx, cam); drawWater(ctx, cam, this.map, this.t);
    const v = cam.view(60);
    const items = this.map.drawGrid.query(v.x0, v.z0, v.x1, v.z1);
    drawLots(ctx, cam, items); drawRoads(ctx, cam, this.map, this.t);
    const lit = [];
    for (const c of this.traffic.cars) { drawCar(ctx, c.sprite, cam.sx(c.x), cam.sy(c.z), c.h, cam.zoom); lit.push({ x: c.x, z: c.z, h: c.h, lightsOn: true, beam: 22 }); }
    const glows = [];
    for (const h of this.heroes) {
      drawCar(ctx, h.sprite, cam.sx(h.x), cam.sy(h.z), Math.PI / 2, cam.zoom);
      lit.push({ x: h.x, z: h.z, h: Math.PI / 2, lightsOn: true, beam: 36 });
      glows.push({ x: h.x, z: h.z, r: 6, color: h.neon, a: 0.9 });
      glows.push({ x: h.x - 2.4, z: h.z, r: 2.5, color: 'rgba(255,0,0,1)', a: 0.7 });
    }
    drawBuildings(ctx, cam, items, 0.9, false); drawTrees(ctx, cam, items);
    drawLighting(ctx, cam, 0.72, this.map.lights, { cars: lit, glows, blobs: [] });
  }
}

// ---------------- title ----------------
export function showTitle(app) {
  closeAllPanels();
  const latest = latestSlot();
  const need = !latest;
  const root = $('#screen');
  root.innerHTML = '';
  const t = el(`<div class="title">
    <div class="title-logo">MURDA WORTH<span>STREET RACING</span></div>
    <div class="title-tag">BUILD YOUR CAR. BUILD YOUR NAME.</div>
    <nav class="menu">
      <button data-action="continue" ${need ? 'disabled' : ''}>Continue${latest ? `<small>${esc(latest.name)} · Day ${latest.day} · ${fmtMoney(latest.cash)} · ${slotName(latest.slot)}</small>` : '<small>No saved career yet</small>'}</button>
      <button data-action="online" ${need ? 'disabled' : ''}>Play Online<small>Free roam with other players</small></button>
      <button data-action="new">New Game</button>
      <button data-action="load">Load Game</button>
      <button data-action="garage" ${need ? 'disabled' : ''}>Garage</button>
      <button data-action="collection" ${need ? 'disabled' : ''}>Car Collection</button>
      <button data-action="customize" ${need ? 'disabled' : ''}>Customize</button>
      <button data-action="map" ${need ? 'disabled' : ''}>Map</button>
      <button data-action="race" ${need ? 'disabled' : ''}>Race</button>
      <button data-action="crew" ${need ? 'disabled' : ''}>Crew</button>
      <button data-action="settings">Settings</button>
    </nav>
    <div class="title-foot">A fan-made street racing sim. Real car and parts brand names are used for flavor only — no affiliation or endorsement. The city is a loose take on Fort Worth, TX; its people and businesses are fictional.</div>
  </div>`);
  root.appendChild(t);
  const resume = (then) => {
    const s = loadGame(latest.slot);
    if (!s) { toast('That save could not be read', 'bad'); return; }
    game.s = s;
    enterWorld();
    if (then) then();
  };
  bind(t, {
    continue: () => resume(),
    online: () => resume(() => openOnline(app)),
    new: () => openCreate(app),
    load: () => openSlots('load', app),
    garage: () => resume(() => openGarage(app)),
    collection: () => resume(() => openGarage(app, { tab: 'collection' })),
    customize: () => resume(() => openGarage(app, { tab: 'visual' })),
    map: () => resume(() => openPhone('map', app)),
    race: () => resume(() => openRaceMenu(app)),
    crew: () => resume(() => openPhone('crew', app)),
    settings: () => openSettings(app),
  });
  t.querySelector('button:not([disabled])')?.focus();
}

// ---------------- pause ----------------
export function openPause(app) {
  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1>Paused<small>${esc(game.s.player.name)} · Day ${game.s.time.day}</small></h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body"><nav class="menu" style="width:100%;max-width:420px">
        <button data-action="close">Resume</button>
        <button data-action="online">Online Free Roam<small>${online.active ? `Connected · ${esc(online.serverName)} server` : 'See other players on the map'}</small></button>
        <button data-action="save">Save Game<small>3 manual slots plus autosave</small></button>
        <button data-action="load">Load Game</button>
        <button data-action="settings">Settings</button>
        <button data-action="controls">Controls</button>
        <button data-action="quit">Quit to Title<small>Your progress autosaves</small></button>
      </nav></div>`;
    bind(root, {
      close: () => h.close(),
      online: () => openOnline(app),
      save: () => openSlots('save', app),
      load: () => openSlots('load', app),
      settings: () => openSettings(app),
      controls: () => showControls(),
      quit: async () => { saveGame('auto', true); h.close(); toTitle(); },
    });
  });
}

export function showControls() {
  if (touchUi.active) {
    modal('Controls', `<div class="section-title" style="margin-top:0">Walking</div><div class="kv">
      <span>Move</span><span>Joystick (left)</span><span>Run</span><span>Hold RUN</span>
      <span>Shops, homes, meets</span><span>USE</span><span>Get in your car</span><span>GET IN (stand next to it)</span></div>
      <div class="section-title">Driving</div><div class="kv">
      <span>Steer</span><span>◀ ▶ arrows (left)</span><span>Gas / brake &amp; reverse</span><span>GAS / BRAKE pedals (right)</span>
      <span>Shift gears</span><span>Drag the shift knob up / down</span><span>Auto / manual</span><span>Tap the knob (A / M)</span>
      <span>Nitrous · e-brake · horn</span><span>NOS · E-BRK · HORN</span>
      <span>Gas stations, races, shops</span><span>USE</span><span>Get out (slow down first)</span><span>GET OUT</span></div>
      <div class="section-title">Top right</div><div class="kv"><span>☰</span><span>Menu &amp; save</span><span>⌕</span><span>Zoom the map</span><span>☎</span><span>Phone</span></div>
      <p class="muted small" style="margin-top:10px">Drag race: hold BRAKE + GAS for a burnout, ease on the GAS to roll up and stage, hold both against the brake, and let go of BRAKE on green. Gas + brake while stopped (or at a meet) just revs the engine — with a 2-step installed it holds the launch rpm and shoots flames.</p>`);
    return;
  }
  modal('Controls', `<div class="section-title" style="margin-top:0">On foot</div><div class="kv">
    <span>Walk</span><span>W A S D or arrows</span>
    <span>Run</span><span><kbd>Shift</kbd></span>
    <span>Interact (shops, homes, meets)</span><span><kbd>E</kbd> / <kbd>Enter</kbd></span>
    <span>Get in your car</span><span><kbd>F</kbd> (stand next to it)</span></div>
    <div class="section-title">In the car</div><div class="kv">
    <span>Gas / brake &amp; reverse</span><span><kbd>W</kbd> / <kbd>S</kbd></span>
    <span>Steer</span><span><kbd>A</kbd> <kbd>D</kbd> or arrows</span>
    <span>E-brake (drift)</span><span><kbd>Space</kbd></span>
    <span>Nitrous</span><span><kbd>N</kbd> / <kbd>Shift</kbd></span>
    <span>Shift up / down (manual)</span><span><kbd>E</kbd> / <kbd>Q</kbd></span>
    <span>Horn</span><span><kbd>H</kbd></span>
    <span>Interact (gas, races, shops)</span><span><kbd>Enter</kbd></span>
    <span>Get out (slow down first)</span><span><kbd>F</kbd></span></div>
    <div class="section-title">Anywhere</div><div class="kv">
    <span>Phone</span><span><kbd>P</kbd> / <kbd>Tab</kbd></span>
    <span>Map</span><span><kbd>M</kbd></span>
    <span>Camera zoom</span><span><kbd>C</kbd></span>
    <span>Pause</span><span><kbd>Esc</kbd></span></div>
    <p class="muted small" style="margin-top:10px">Walking and driving use separate controls: car keys do nothing on foot, and walking keys do nothing in the car. Drag race: hold <kbd>S</kbd>+<kbd>W</kbd> for a burnout, tap <kbd>W</kbd> to roll up and stage, hold <kbd>S</kbd>+<kbd>W</kbd> against the brake, and release <kbd>S</kbd> on green. Gas + brake while stopped (or at a meet) just revs the engine — with a 2-step installed it holds the launch rpm and shoots flames.</p>`);
}

// ---------------- save slots ----------------
export function openSlots(mode, app) {
  openPanel((root, h) => {
    root.innerHTML = `<div class="p-head"><h1>${mode === 'save' ? 'Save Game' : 'Load Game'}</h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body"><div class="list">${SLOTS.map(slot => {
        const i = slotInfo(slot);
        return `<div class="li"><div class="grow"><div class="t">${slotName(slot)}</div><div class="s">${i ? `${esc(i.name)} · Day ${i.day} · ${fmtMoney(i.cash)} · ${i.cars} car${i.cars === 1 ? '' : 's'} · ${new Date(i.savedAt).toLocaleString()}` : 'Empty'}</div></div>
          ${mode === 'save' ? (slot === 'auto' ? '' : `<button class="btn btn-primary btn-sm" data-action="save" data-slot="${slot}">Save here</button>`) : (i ? `<button class="btn btn-primary btn-sm" data-action="load" data-slot="${slot}">Load</button>` : '')}
          ${i && slot !== 'auto' ? `<button class="btn btn-sm btn-danger" data-action="del" data-slot="${slot}">Delete</button>` : ''}</div>`;
      }).join('')}</div>
      <div class="section-title">Backup</div>
      <div class="row">${game.s ? '<button class="btn" data-action="export">Download save file</button>' : ''}<button class="btn" data-action="import">Import save file</button></div></div>`;
    bind(root, {
      close: () => h.close(),
      save: d => { saveGame(d.slot); h.refresh(); },
      load: async d => {
        if (game.s && !(await confirm('Load save?', '<p>Unsaved progress since your last save will be lost.</p>', 'Load'))) return;
        const s = loadGame(d.slot);
        if (!s) { toast('Could not read that save', 'bad'); return; }
        closeAllPanels();
        if (app.world) { app.world.destroy(); app.world = null; }
        game.s = s; enterWorld();
      },
      del: async d => { if (await confirm('Delete save?', `<p>${slotName(d.slot)} will be erased.</p>`, 'Delete', true)) { deleteSlot(d.slot); h.refresh(); } },
      export: () => {
        const blob = new Blob([exportSave()], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `murda-worth-${game.s.player.name.replace(/\W+/g, '_')}-day${game.s.time.day}.json`; a.click();
      },
      import: () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = async () => {
          try {
            const s = importSave(await inp.files[0].text());
            closeAllPanels();
            if (app.world) { app.world.destroy(); app.world = null; }
            game.s = s; enterWorld(); toast('Save imported', 'good');
          } catch (e) { toast(e.message, 'bad'); }
        };
        inp.click();
      },
    });
  });
}

// ---------------- settings ----------------
export function openSettings(app) {
  openPanel((root, h) => {
    const opt = (key, vals) => `<div class="opts">${vals.map(([v, l]) => `<button class="${settings[key] === v ? 'on' : ''}" data-action="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    root.innerHTML = `<div class="p-head"><h1>Settings</h1><button class="btn x" data-action="close">×</button></div>
      <div class="p-body" style="max-width:640px">
        <label class="field"><span>Graphics quality</span>${opt('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}</label>
        <label class="field"><span>Transmission</span>${opt('transmission', [['auto', 'Automatic'], ['manual', 'Manual (Q / E)']])}</label>
        <label class="field"><span>Touch steering</span>${opt('steerMode', [['arrows', 'Arrows'], ['wheel', 'Steering wheel']])}</label>
        <label class="field"><span>Speed units</span>${opt('units', [['mph', 'MPH'], ['kmh', 'KM/H']])}</label>
        <label class="field"><span>Master volume — ${Math.round(settings.volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-range="volume" class="input"></label>
        <label class="field"><span>Music volume — ${Math.round(settings.music * 100)}%</span><input type="range" min="0" max="1" step="0.05" value="${settings.music}" data-range="music" class="input"></label>
        <label class="field"><span>Camera shake</span>${opt('shake', [[true, 'On'], [false, 'Off']])}</label>
        <label class="field"><span>Touch controls</span>${opt('touch', [['auto', 'Auto'], ['on', 'Always'], ['off', 'Off']])}</label>
        <label class="field"><span>FPS counter</span>${opt('showFps', [[true, 'On'], [false, 'Off']])}</label>
      </div>`;
    bind(root, {
      close: () => h.close(),
      set: d => {
        let v = d.v; if (v === 'true') v = true; if (v === 'false') v = false;
        settings[d.k] = v; saveSettings();
        if (d.k === 'quality') window.dispatchEvent(new Event('resize'));
        if (d.k === 'touch' || d.k === 'steerMode') touchUi.refresh();
        h.refresh();
      },
    });
    root.querySelectorAll('[data-range]').forEach(r => r.oninput = () => {
      settings[r.dataset.range] = +r.value; saveSettings(); audio.applyVolume();
      r.previousElementSibling.textContent = `${r.dataset.range === 'volume' ? 'Master' : 'Music'} volume — ${Math.round(r.value * 100)}%`;
    });
  });
}
