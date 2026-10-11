import { GANG_CONTACTS } from './gangs.js';

// Every character in Fort Worth. Racers carry a full build so the race sim
// treats them exactly like the player; nothing about an opponent is faked.

// Quick build presets: level per part. `focus` tilts which parts get love.
function build(level, focus = 'power', extra = {}) {
  const l = Math.max(0, Math.min(4, level));
  const lo = Math.max(0, l - 1);
  const p = {
    engine: l, intake: l, exhaust: l, ecu: l, fuel: Math.min(4, l + 1), intercooler: l,
    transmission: lo, clutch: l, diff: lo, suspension: lo, brakes: lo, tires: l, weight: lo, nitrous: 0,
    turbo: 0, supercharger: 0,
  };
  if (focus === 'light') { p.weight = l; p.suspension = l; p.engine = lo; }
  if (focus === 'launch') { p.tires = Math.min(4, l + 1); p.diff = l; p.clutch = Math.min(4, l + 1); p.transmission = l; p.twostep = Math.max(1, l); }
  if (focus === 'nitrous') p.nitrous = Math.max(1, l);
  return { ...p, ...extra };
}

export const CREWS = {
  midnight_static: { name: 'Midnight Static', color: '#13b3c4', logo: 'bolt', style: 'JDM roll racers. Precise, quiet, fast after dark.', rep: 3200 },
  iron_saints:     { name: 'Iron Saints', color: '#c41b1b', logo: 'cross', style: 'American muscle. Big cubes, bigger mouths.', rep: 4100 },
  velvet_ghosts:   { name: 'Velvet Ghosts', color: '#a01aff', logo: 'ghost', style: 'European money. Highway pulls at 3 a.m.', rep: 5200 },
  dust_devils:     { name: 'Dust Devils', color: '#e8641a', logo: 'skull', style: 'Desert trucks and blowers. Loud on purpose.', rep: 2600 },
  apex_syndicate:  { name: 'Apex Syndicate', color: '#e8c21a', logo: 'crown', style: 'Nobody knows who funds them. Everybody knows they win.', rep: 30000 },
};

export const RACERS = [
  // ---------------- Tier 1 ----------------
  { id: 'tiny', name: 'Tiny Ruiz', nick: 'Tiny', tier: 1, crew: null, color: '#c41b1b',
    car: { model: 'honda_civic_si_1999', year: 2000, parts: build(1, 'power', { nitrous: 1 }), visual: { paint: '#c41b1b', wheels: 'five', spoiler: 'gt', decal: 'number', neon: '#1a9bff' } },
    skill: 0.38, style: 'roll', focus: 'Lightweight FWD', money: 2500, rep: 300,
    personality: 'Loud, cocky, all GT wing and no mercy. B16 or die. Has never once turned down a race.',
    lines: { intro: "New face? Cute ride. I'll race you for whatever's in your pocket.",
      greet: "You again? You ready to lose?", theyWon: "Told you. Wing's not just for looks.", theyLost: "Nah, nah — I missed second. Run it back.",
      rematch: "Double it. Right now.", taunt: "That thing even have VTEC?" } },
  { id: 'mags', name: 'Marcus Dell', nick: 'Mags', tier: 1, crew: 'iron_saints', color: '#7a1414',
    car: { model: 'ford_mustang_gt_s197_2005', year: 2007, parts: build(1, 'launch'), visual: { paint: '#7a1414', wheels: 'dish', decal: 'stripes', hood: 'cowl' } },
    skill: 0.44, style: 'drag', focus: 'RWD launches', money: 3000, rep: 450,
    personality: 'Easygoing, eats sunflower seeds between rounds. Lives at the dragway.',
    lines: { intro: "Name's Mags. You run the strip? Ironline, Thursdays, every Thursday.",
      greet: "Hey hey. Tires warm?", theyWon: "Sixty-foot was everything, man.", theyLost: "Clean pass. Respect.",
      rematch: "One more, I'll take the other lane.", taunt: "V6 club, baby." } },
  { id: 'keys', name: 'Keisha Oduya', nick: 'Keys', tier: 1, crew: 'midnight_static', color: '#d8d8d8',
    car: { model: 'nissan_240sx_se_s14_1995', year: 1997, parts: build(1, 'power', { turbo: 1 }), visual: { paint: '#d8d8d8', wheels: 'mesh', tint: 'medium', kit: 'street' } },
    skill: 0.55, style: 'roll', focus: 'Shift-perfect RWD', money: 2200, rep: 600,
    personality: 'Methodical. Logs every run in a notebook. Doesn\'t talk much before a race.',
    lines: { intro: "Static runs this side of town after dark. Don't make it weird.",
      greet: "Hm.", theyWon: "Your two-three shift is late. Fix it.", theyLost: "...Noted.",
      rematch: "Same roll speed. Different lane.", taunt: "I've seen your numbers." } },
  { id: 'earl', name: 'Earl Pruitt', nick: 'Big Earl', tier: 1, crew: 'dust_devils', color: '#1f3b2a',
    car: { model: 'chevrolet_silverado_1500_lt_5_3_2014', year: 2016, parts: build(1, 'power', { supercharger: 1 }), visual: { paint: '#1f3b2a', wheels: 'dish', hood: 'scoop' } },
    skill: 0.35, style: 'drag', focus: 'Heavy power', money: 4000, rep: 350,
    personality: 'Truck guy. Hates "rice". Pays his debts in cash, immediately, every time.',
    lines: { intro: "That's a lotta car for somebody with no truck.",
      greet: "Well look who it is.", theyWon: "Torque, son. Torque.", theyLost: "Huh. Weighs too much, I guess. Don't tell nobody.",
      rematch: "Let me tune the blower and we'll see.", taunt: "Bet that thing's scared of gravel." } },
  { id: 'lowkey', name: 'Lena Park', nick: 'Lowkey', tier: 1, crew: null, color: '#3d4452',
    car: { model: 'toyota_camry_xse_v6_2018', year: 2019, parts: build(2, 'power', { turbo: 1 }), visual: { paint: '#3d4452' } },
    skill: 0.5, style: 'roll', focus: 'Sleeper builds', money: 3500, rep: 500,
    personality: 'Drives a grey Camry. It is not a normal Camry.',
    lines: { intro: "Don't judge the car. Seriously, don't.",
      greet: "Hi.", theyWon: "Everybody laughs at the Camry until fourth gear.", theyLost: "Okay, okay. You're legit.",
      rematch: "Again, from forty?", taunt: "Grandma's Camry, right?" } },

  // ---------------- Tier 2 ----------------
  { id: 'static', name: 'Nico Tanaka', nick: 'Static', tier: 2, crew: 'midnight_static', color: '#e8c21a',
    car: { model: 'mazda_rx_7_twin_turbo_fd_1993', year: 1994, parts: build(2, 'power', { turbo: 2, nitrous: 1 }), visual: { paint: '#e8c21a', wheels: 'turbine', tint: 'limo', kit: 'wide', spoiler: 'gt', neon: '#13b3c4', decal: 'crew' } },
    skill: 0.68, style: 'roll', focus: 'High-rev rotary', money: 9000, rep: 2600,
    personality: 'Leader of Midnight Static. Calm, a little theatrical, keeps score of everyone.',
    lines: { intro: "You're the one Keys keeps writing about. Let's see if the notebook is right.",
      greet: "Evening.", theyWon: "Brap brap. Rotaries don't get tired. People do.", theyLost: "...That's the first time this year. Static could use someone like you.",
      rematch: "Seventy roll. Half mile. Name the wager.", taunt: "Your exhaust note is trying very hard." } },
  { id: 'hammer', name: 'Dom Reyes', nick: 'Hammer', tier: 2, crew: 'iron_saints', color: '#0d0d0d',
    car: { model: 'ford_mustang_gt_s650_2024', year: 2024, parts: build(2, 'launch', { nitrous: 2 }), visual: { paint: '#0d0d0d', wheels: 'dish', hood: 'scoop', decal: 'stripes', decalColor: '#c41b1b' } },
    skill: 0.6, style: 'drag', focus: 'Nitrous V8', money: 12000, rep: 2200,
    personality: 'Second-in-command at the Iron Saints. Talks with his hands, races with his foot.',
    lines: { intro: "Saints don't race strangers. You're about to stop being a stranger.",
      greet: "You came back. Brave.", theyWon: "Gas pedal's on the right, friend.", theyLost: "Vic's gonna hear about this. Not from me.",
      rematch: "Quarter mile. Ironline. Now.", taunt: "Cute little tune you got there." } },
  { id: 'vandal', name: 'Ines Kovac', nick: 'Vandal', tier: 2, crew: 'velvet_ghosts', color: '#f2f2f2',
    car: { model: 'bmw_m3_e46_2001', year: 2004, parts: build(2, 'power', { turbo: 2 }), visual: { paint: '#f2f2f2', wheels: 'split', tint: 'limo', headlights: 'led' } },
    skill: 0.62, style: 'roll', focus: 'Turbo Euro highway', money: 15000, rep: 2400,
    personality: 'Velvet Ghosts scout. Bored by everything except top speed.',
    lines: { intro: "The Ghosts are curious about you. That's rare.",
      greet: "Ciao.", theyWon: "S54. Eight-thousand rpm. Math.", theyLost: "Interesting. I'll tell Anton.",
      rematch: "Loop 820. Sixty roll.", taunt: "Did it come with the spoiler?" } },
  { id: 'glitch', name: 'Ty Bishop', nick: 'Glitch', tier: 2, crew: null, color: '#1b4fc4',
    car: { model: 'mitsubishi_lancer_evolution_ix_mr_2006', year: 2006, parts: build(2, 'launch', { turbo: 2 }), visual: { paint: '#1b4fc4', wheels: 'mesh', spoiler: 'gt', decal: 'number' } },
    skill: 0.7, style: 'drag', focus: 'AWD launch specialist', money: 8000, rep: 2000,
    personality: 'Datalogs everything. Will explain launch control to you whether you asked or not.',
    lines: { intro: "AWD. Launch control. Two-step. Want me to explain each one?",
      greet: "Yo! I updated my maps.", theyWon: "Ninety-six percent launch efficiency. Not bad, right?", theyLost: "Wait, what was your sixty-foot? Send me the slip.",
      rematch: "Run it again, I wanna log it.", taunt: "My car shifts faster than you think." } },
  { id: 'mamabear', name: 'Gloria Lutz', nick: 'Mama Bear', tier: 2, crew: 'dust_devils', color: '#5a5d63',
    car: { model: 'jeep_grand_cherokee_srt_2017', year: 2019, parts: build(2, 'power', { supercharger: 1 }), visual: { paint: '#5a5d63', wheels: 'turbine', tint: 'limo' } },
    skill: 0.57, style: 'roll', focus: 'AWD heavy hitter', money: 20000, rep: 1900,
    personality: 'Runs a tow company by day. Has towed several people she has beaten.',
    lines: { intro: "Sweetheart, I've got a car seat in the back and I'll still walk you.",
      greet: "Hi, baby.", theyWon: "Aw. Want a juice box?", theyLost: "Well! Somebody ate their vegetables.",
      rematch: "One more, then I gotta get home.", taunt: "It's a family car. My family's fast." } },

  // ---------------- Tier 3 ----------------
  { id: 'saint', name: 'Vic Castellanos', nick: 'Saint', tier: 3, crew: 'iron_saints', color: '#d12424',
    car: { model: 'dodge_challenger_srt_hellcat_2015', year: 2021, parts: build(3, 'launch', { supercharger: 2, nitrous: 2 }), visual: { paint: '#d12424', wheels: 'forged', hood: 'scoop', decal: 'stripes', decalColor: '#0d0d0d', spoiler: 'drag' } },
    skill: 0.76, style: 'drag', focus: 'Blown V8', money: 40000, rep: 6500,
    personality: 'Founder of the Iron Saints. Old-school, proud, holds grudges for years.',
    lines: { intro: "Hammer says you're quick. Hammer says a lot of things.",
      greet: "Kid.", theyWon: "Respect the blower.", theyLost: "...Nobody walks a Saint. Remember that you did.",
      rematch: "Big money this time.", taunt: "You're borrowing that rep." } },
  { id: 'ghostline', name: 'Yuki Sato', nick: 'Ghostline', tier: 3, crew: 'midnight_static', color: '#8c9196',
    car: { model: 'nissan_gt_r_premium_r35_2017', year: 2019, parts: build(3, 'launch', { turbo: 2 }), visual: { paint: '#8c9196', wheels: 'forged', tint: 'limo', kit: 'wide', spoiler: 'gt', headlights: 'led' } },
    skill: 0.8, style: 'roll', focus: 'AWD twin turbo', money: 35000, rep: 7200,
    personality: 'Static\'s quiet ace. Races once a night, never twice.',
    lines: { intro: "Nico says you're worth my one race tonight.",
      greet: "...", theyWon: "Next.", theyLost: "Good. Again next week.",
      rematch: "Not tonight.", taunt: "—" } },
  { id: 'kaiser', name: 'Anton Weiss', nick: 'Kaiser', tier: 3, crew: 'velvet_ghosts', color: '#0f6b4f',
    car: { model: 'bmw_m4_competition_2021', year: 2023, parts: build(3, 'power', { turbo: 3 }), visual: { paint: '#0f6b4f', wheels: 'split', tint: 'medium', headlights: 'led', taillights: 'bar' } },
    skill: 0.78, style: 'roll', focus: 'Highway top end', money: 60000, rep: 8000,
    personality: 'Velvet Ghosts boss. Treats street racing as an investment portfolio.',
    lines: { intro: "Ines vouched for you. That's a liability I'm willing to price in.",
      greet: "Guten Abend.", theyWon: "Efficient.", theyLost: "A loss is just information.",
      rematch: "The Ghosts will set the terms.", taunt: "Your car will depreciate. So will you." } },
  { id: 'dust', name: 'Dallas McCrae', nick: 'Dust', tier: 3, crew: 'dust_devils', color: '#c46a12',
    car: { model: 'ram_1500_trx_2021', year: 2022, parts: build(3, 'launch', { supercharger: 2, nitrous: 2 }), visual: { paint: '#c46a12', wheels: 'dish', hood: 'scoop' } },
    skill: 0.72, style: 'drag', focus: 'AWD truck torque', money: 30000, rep: 6000,
    personality: 'Dust Devils boss. Races barefoot. Nobody has asked why.',
    lines: { intro: "You want the desert, you go through me.",
      greet: "Howdy.", theyWon: "Eat my dust. Literally, it's everywhere.", theyLost: "Well I'll be.",
      rematch: "Chisholm Trail Pkwy. Bring water.", taunt: "Nice paint. Shame about the sand." } },
  { id: 'redline', name: 'Sienna Volkov', nick: 'Redline', tier: 3, crew: null, color: '#24262b',
    car: { model: 'dodge_charger_srt_hellcat_redeye_2021', year: 2022, parts: build(3, 'power', { supercharger: 2, nitrous: 1 }), visual: { paint: '#24262b', wheels: 'forged', tint: 'limo', decal: 'side', decalColor: '#c41b1b' } },
    skill: 0.74, style: 'roll', focus: 'Supercharged sedan', money: 45000, rep: 7000,
    personality: 'Freelancer. Races for whoever pays her the most to race against.',
    lines: { intro: "I don't join crews. I bill them.",
      greet: "Rate's gone up.", theyWon: "Invoice is in your messages.", theyLost: "Huh. I'll adjust my rate.",
      rematch: "Same terms, plus twenty percent.", taunt: "Cute that you think this is personal." } },

  // ---------------- Tier 4 ----------------
  { id: 'phantom', name: 'Kofi Adebayo', nick: 'Phantom', tier: 4, crew: 'velvet_ghosts', color: '#4a4f57',
    car: { model: 'porsche_911_turbo_s_992_2021', year: 2024, parts: build(4, 'launch', { turbo: 3 }), visual: { paint: '#4a4f57', wheels: 'forged', tint: 'limo', kit: 'wide', spoiler: 'gt', headlights: 'led', taillights: 'bar' } },
    skill: 0.86, style: 'roll', focus: 'AWD launches', money: 120000, rep: 18000,
    personality: 'Shows up, wins, leaves. Has no social media. Has three million followers anyway.',
    lines: { intro: "I heard. Let's see.", greet: "Mm.", theyWon: "Close.", theyLost: "That was real.", rematch: "Same time next week.", taunt: "—" } },
  { id: 'toro', name: 'Marco Bellandi', nick: 'Il Toro', tier: 4, crew: null, color: '#f3a712',
    car: { model: 'lamborghini_huracan_evo_2020', year: 2022, parts: build(4, 'power', { turbo: 2 }), visual: { paint: '#f3a712', wheels: 'forged', headlights: 'led' } },
    skill: 0.82, style: 'roll', focus: 'Twin-turbo V10', money: 250000, rep: 16000,
    personality: 'Exotic dealer\'s nephew. Insufferable. Annoyingly good.',
    lines: { intro: "Ah, a commoner with ambition. Delightful.", greet: "Ciao, piccolo.", theyWon: "Ten cylinders, my friend. Italian ones.",
      theyLost: "Impossible. My uncle will hear about this.", rematch: "I demand satisfaction!", taunt: "Is that car… financed? At what, twenty-nine percent?" } },
  { id: 'zero', name: 'Jade Lin', nick: 'Zero', tier: 4, crew: 'iron_saints', color: '#e0e0e0',
    car: { model: 'chevrolet_corvette_z06_c8_2023', year: 2024, parts: build(4, 'launch', { supercharger: 3, nitrous: 3 }), visual: { paint: '#e0e0e0', wheels: 'forged', spoiler: 'drag', hood: 'vented', decal: 'stripes', decalColor: '#c41b1b' } },
    skill: 0.88, style: 'drag', focus: 'Big-power RWD', money: 140000, rep: 20000,
    personality: 'Iron Saints\' secret weapon. Zero reaction time, zero patience.',
    lines: { intro: "Vic said wait for you. I don't wait.", greet: "Ready?", theyWon: ".000 light.", theyLost: "Huh. Go again.", rematch: "Again.", taunt: "Your tree reflexes are slow." } },

  // ---------------- Tier 5 ----------------
  { id: 'architect', name: 'Cyrus Vale', nick: 'The Architect', tier: 5, crew: 'apex_syndicate', color: '#e6e6e6',
    car: { model: 'koenigsegg_jesko_attack_2022', year: 2024, parts: build(4, 'launch', { turbo: 3, nitrous: 3 }), visual: { paint: '#e6e6e6', wheels: 'forged', tint: 'limo', headlights: 'led', taillights: 'bar', neon: '#ffffff' } },
    skill: 0.95, style: 'roll', focus: 'Koenigsegg Jesko. 1,600 hp on E85', money: 2000000, rep: 60000,
    personality: 'Built half the city\'s race scene, then disappeared into it. Final boss energy.',
    lines: { intro: "Everyone in this city is a story I've already read. Let's see if yours is different.",
      greet: "Glory waits for no one.", theyWon: "As designed.", theyLost: "…Well. The city has a new name to learn.",
      rematch: "Name your terms. I'll still win.", taunt: "You drove here to lose. Admirable." } },
  { id: 'queenv', name: 'Valentina Moreau', nick: 'Queen V', tier: 5, crew: 'apex_syndicate', color: '#a80f0f',
    car: { model: 'ferrari_sf90_stradale_2020', year: 2024, parts: build(4, 'launch', { turbo: 3 }), visual: { paint: '#a80f0f', finish: 'pearl', wheels: 'forged', tint: 'limo', headlights: 'led' } },
    skill: 0.92, style: 'drag', focus: 'Ferrari SF90 hybrid launches', money: 1500000, rep: 50000,
    personality: 'Apex Syndicate enforcer. Has never red-lit. Ever.',
    lines: { intro: "Cyrus wants to know if you're real. So do I.", greet: "Bonsoir.", theyWon: "Merci.", theyLost: "Ah. Real, then.", rematch: "Tomorrow.", taunt: "Hm." } },
];

export const RACER_BY_ID = Object.fromEntries(RACERS.map(r => [r.id, r]));

// Non-racing contacts
export const PEOPLE = {
  ...GANG_CONTACTS,
  jojo:    { name: 'Jojo Mendez', role: 'Friend', color: '#13b3c4', bio: 'Your oldest friend. Knows everyone, owes most of them money.' },
  sal:     { name: 'Sal Marchetti', role: "Dealer · Rusty's Used Autos", color: '#c8b98a', bio: 'Sells cars that mostly run. Honest about the "mostly".' },
  junior:  { name: 'Junior Marchetti', role: 'Marchetti Salvage · chop shop', color: '#c9752a', bio: 'Sal\'s nephew. Turns a stolen Camry into forty boxes of parts before the coffee\'s done.' },
  rosa:    { name: 'Rosa Vega', role: 'Mechanic · Torque Temple', color: '#e8641a', bio: 'Best wrench in Fort Worth. Will not build you something stupid. Will build you something fast.' },
  manny:   { name: 'Manny Vega', role: 'Body & Paint · Vega Kustoms', color: '#d12a8a', bio: "Rosa's cousin. Paint, wheels, kits — if it shows, Manny does it." },
  kingpin: { name: 'Dre Holloway', role: 'Organizer · "Kingpin"', color: '#e8c21a', bio: 'Runs the meets. If there\'s a race worth watching, Dre set it up.' },
  brenner: { name: 'Sgt. Hal Brenner', role: 'FWPD Street Racing Task Force', color: '#1b4fc4', bio: 'Twenty years on the job. Has a whiteboard with your name on it now.' },
  teller:  { name: 'Denise at Cowtown Credit Union', role: 'Your banker', color: '#1f8f3a', bio: 'Knows every regular by name. Also knows what a Currency Transaction Report is.' },
  irs:     { name: 'IRS Criminal Investigation', role: 'Dallas Field Office · federal', color: '#2b3a55', bio: 'They got Capone on taxes. They are patient.' },
  keisha:  { name: 'Keisha "Books" Moore', role: 'Accountant · no questions', color: '#c08a2e', bio: 'Runs the books for half the small businesses in Stop Six. Charges 15% and never asks where it came from.' },
  clerk:   { name: 'Tarrant County District Clerk', role: 'Courts · notices to appear', color: '#8a6d3b', bio: 'Automated court notices. Ignoring them is how warrants happen.' },
  jps:     { name: 'JPS Health Network', role: 'Patient financial services', color: '#e0192e', bio: 'John Peter Smith Hospital, the county trauma center. Statements, payment plans and JPS Connection.' },
  collections: { name: 'Lone Star Recovery Services', role: 'Debt collector', color: '#7a7a7a', bio: 'Buys unpaid medical bills and charged-off loans. Calls at dinner. Sues.' },
  repo:    { name: 'DFW Recovery & Repo', role: 'Repo company', color: '#5b5b5b', bio: 'Tow trucks, a gate code to every apartment complex in Tarrant County, and no sense of humor.' },
  cowpay:  { name: 'Cowtown Pay', role: 'Send money · Cowtown Credit Union', color: '#1f8f3a', bio: 'Send money to other players on your server, straight from checking.' },
  priya:   { name: 'Priya Shah', role: 'Agent · Bayline Realty', color: '#1f8f3a', bio: 'Sells garages with houses attached.' },
  plug:    { name: 'Lil Tre', role: 'The plug · Stop Six', color: '#2cff7a', bio: 'Runs the corner store on the east side. The good stuff is behind the counter.' },
  builder: { name: 'Cowtown Custom Builders', role: 'Construction', color: '#c8a46a', bio: 'Pour the slab Monday, hand you the keys Thursday.' },
  ar:      { name: 'Tasha "Ears" Greene', role: 'A&R · your record label', color: '#c04aff', bio: 'Hears a hit before the hook comes in. Knows every rapper from Stop Six to South Dallas.' },
  zed:     { name: 'Zed', role: 'Parts Vendor', color: '#6b2bd1', bio: 'Shows up at meets with a van. Don\'t ask where the parts come from — they\'re just discounted, okay?' },
};

export function contactInfo(id) {
  if (PEOPLE[id]) return { id, ...PEOPLE[id], racer: false };
  const r = RACER_BY_ID[id];
  if (r) return { id, name: `${r.name} "${r.nick}"`, role: `Racer · Tier ${r.tier}${r.crew ? ' · ' + CREWS[r.crew].name : ''}`, color: r.color, bio: r.personality, racer: true };
  return { id, name: id, role: '', color: '#888', bio: '' };
}
