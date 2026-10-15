// The federal side of shipping weed into Texas (core/traffick.js), out in
// the open world: the raid that comes in while you're home, and the SWAT
// team that boxes in your car once you're indicted.

import { fmtMoney, addRep } from '../core/state.js';
import { audio } from '../core/audio.js';
import { saveGame } from '../core/save.js';
import { ensureDea, raidHome, indictDea, caseServed, deaWarrant, lbText } from '../core/traffick.js';

const RAID_AFTER = 4;   // seconds at home before the door comes in

export function deaTick(w, dt) {
  const s = w.s, d = ensureDea(s);
  if (d.hunt && !deaWarrant(s)) caseServed(s);   // the warrant got served (an arrest, or you turned yourself in)
  if (w.deaBusy || w.knocking || w.races.active || w.rides?.riding) return;
  // a search warrant is signed: they hit the house while you're in it
  const home = !w.inCar && (w.inHouse || w.inGarage);
  if (d.raid && home && !w.police.active) {
    w.deaRaidT = (w.deaRaidT || 0) + dt;
    if (w.deaRaidT > RAID_AFTER) { w.deaRaidT = 0; fedRaid(w); }
    return;
  }
  w.deaRaidT = 0;
  // indicted: sooner or later an agent spots your car
  if (d.hunt && w.inCar && !w.police.active) {
    w.swatT ??= 25 + Math.random() * 50;
    w.swatT -= dt;
    if (w.swatT <= 0) {
      w.swatT = null;
      d.stops++;
      audio.crash(0.4);
      w.police.swatStop(w);
      w.ui.toast('🚨 Black Tahoes all around you. SWAT. Pull over and it\'s cuffs. Floor it and it\'s a chase.', 'bad');
    }
  }
}

// ---------------------------------------------------------------- the raid
export async function fedRaid(w) {
  const s = w.s, d = ensureDea(s);
  w.deaBusy = true;
  audio.gunshot(1.4); audio.crash(1);
  w.hud?.radio?.('DEA Dallas Division with Tarrant County SWAT: executing a federal search warrant.');
  const pick = await w.ui.modal('🚨 FEDERAL RAID', `<p class="bad"><b>BOOM.</b> The battering ram takes the front door off. Flashbangs in the living room. Laser dots on your chest.</p>
    <p class="muted">"DEA! FEDERAL AGENTS! SEARCH WARRANT! GET DOWN! GET DOWN! LET ME SEE YOUR HANDS!"</p>
    <p>Agents in vests and windbreakers fill the house. ${d.hunt ? 'They have a warrant for you, too.' : `They're here about ${lbText(Math.max(1, d.shipped))} of Colorado weed that ended up in Texas.`}</p>`,
    [{ label: 'Get on the ground', primary: true, value: 'down' }, { label: 'Run out the back', danger: true, value: 'run' }]);
  const r = raidHome(s);
  if (pick === 'run' && Math.random() < 0.3) {
    // over the back fence: they know whose house it is
    if (!d.hunt) indictDea(s);
    const p = w.playerState();
    w.foot.x = p.x + 18; w.foot.z = p.z + 18;
    w.police.seen = true;
    w.police.lastSeen = { x: p.x, z: p.z, vx: 0, vz: 0 };
    w.police.startChase(w, true);
    w.police.addHeat(Math.max(0, 3.5 - s.heat), 'Suspect fled a federal raid.', w.hud);
    addRep(s, 50, 'Ran from a DEA raid');
    w.ui.toast(`You went over the back fence. There's a federal warrant out for you now${r.forfeited ? `, and they froze ${fmtMoney(r.forfeited)} of your money` : ''}. Lose them.`, 'bad');
    saveGame('auto', true);
    w.deaBusy = false;
    return;
  }
  const items = r.items.slice();
  if (pick === 'run') items.push({ kind: 'evading', text: 'Evading arrest (federal agents).' });
  w.police.phase = 'notice';
  w.onBusted(2500, false, items);
  w.police.reset(w);
  caseServed(s);
  if (r.forfeited) w.ui.toast(`Civil asset forfeiture: ${fmtMoney(r.forfeited)} taken from your bank account.`, 'bad');
  w.deaBusy = false;
}
