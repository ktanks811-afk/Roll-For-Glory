// Moving Colorado weed into Texas, where it's still a felony (core/traffick.js,
// ui/traffick.js). How a load can travel, what Texas pays for it, and the
// stages of the DEA case that builds against you.
//
// No imports: core/traffick.js, the UI and scripts/check-data.mjs read this.

// How a load gets from Denver to Fort Worth.
// max: the most ounces it can carry. fee: what it costs to send, flat plus per oz.
// days: game days on the road. catchOdds: chance the load gets taken on the way.
// heat: DEA attention it adds, flat plus per oz (more ounces, more attention).
export const METHODS = [
  { id: 'mail', icon: '📦', name: 'Mail it', max: 24, days: 2, fee: [0, 18], catchOdds: 0.07, heat: [1.5, 0.12],
    blurb: 'Vacuum-sealed, two ounces a box, shipped from a dozen post offices around Denver to addresses in Stop Six. Small, cheap and slow.' },
  { id: 'mule', icon: '🚗', name: 'A driver with a trap compartment', max: 160, days: 1, fee: [2500, 6], catchOdds: 0.1, heat: [5, 0.06],
    blurb: 'A clean Camry with a hidden box behind the back seat, I-25 to Amarillo and down US-287. One overnight run.' },
  { id: 'rig', icon: '🚛', name: 'Under the produce in a reefer trailer', max: 1600, days: 2, fee: [12000, 4], catchOdds: 0.14, heat: [12, 0.022],
    blurb: 'Pallets of vacuum bags under a load of Colorado potatoes. A real trucking company, a real bill of lading. The checkpoint at Amarillo is the worry.' },
];
export const METHOD_BY_ID = Object.fromEntries(METHODS.map(m => [m.id, m]));

// What a Texas connect pays per ounce. Colorado flower is better than what's
// on the street in Fort Worth, so it goes for more than a Denver shelf price.
export const TEXAS_MULT = 1.5;
// When a load gets taken, the chance the driver or the person signing for it
// gives the agents your name.
export const FLIP_ODDS = 0.4;

// The DEA case against you, 0–100. It cools off a little every day you don't
// send a load. From SURVEIL they sit on your houses and can hit one while
// you're in it; at 100 a federal grand jury indicts you, there's a warrant,
// and a SWAT team can box you in on the road.
export const DECAY = 2;
export const SURVEIL = 70;
export const RAID_ODDS = 0.3;          // per day at SURVEIL+: a search warrant gets signed for your house
export const STAGES = [
  { at: 0,  name: 'Off the radar',      color: 'good', blurb: 'Nobody federal knows your name.' },
  { at: 25, name: 'DEA flagged it',      color: 'warn', blurb: 'A DEA analyst noticed Colorado weed showing up in Fort Worth.' },
  { at: 50, name: 'Task force case',     color: 'bad',  blurb: 'The North Texas HIDTA task force has a case file with your name on it. Phones are tapped.' },
  { at: SURVEIL, name: 'Surveillance',   color: 'bad',  blurb: 'Agents are sitting on your houses. They can raid one while you\'re inside.' },
  { at: 90, name: 'Grand jury',          color: 'bad',  blurb: 'A federal grand jury is hearing the case. An indictment is close.' },
];
export const stageOf = heat => STAGES.reduce((t, x) => heat >= x.at ? x : t, STAGES[0]);

// Federal marijuana weight, in ounces, to a Texas felony class for the game's courts.
export function trafficClass(oz) {
  if (oz >= 3200) return 'F1';   // 200 lb and up
  if (oz >= 800) return 'F2';    // 50 lb
  if (oz >= 80) return 'F3';     // 5 lb
  return 'SJF';
}
export const lbText = oz => oz >= 16 ? `${Math.round(oz / 16).toLocaleString()} lb` : `${Math.round(oz)} oz`;
