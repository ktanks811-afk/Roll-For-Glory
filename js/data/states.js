// Out of state: cities you fly to from Alliance Airport (ui/flights.js, and
// World.fly). Each one is an 8x8-block city grid (150 m blocks) with an
// airport on its west side, set far off to the east of Texas on the world
// map and walled in, so the only way there is a plane. world2d/states.js
// builds them; their places are in data/world.js (city: the state's id).
//
// What's there that Texas doesn't have: cheaper product from the plug (buy
// low, fly it home, sell it out of your trap), the best studios for your
// label, dealers Texas doesn't have, and big-city houses and land. Denver
// (legal: true) is the legal weed state: grow farms and dispensaries
// (data/weed.js, core/weed.js), and carrying a little isn't a charge there.
//
// No imports: data/world.js and data/estate.js both read this.

export const STATE_BLOCK = 150;
export const STATE_N = 8;                 // blocks a side
export const FREIGHT = 1500;              // your car on the cargo plane, one way

export const STATES = {
  ga: {
    id: 'ga', city: 'Atlanta', state: 'Georgia', abbr: 'GA', cx: 14000, cz: -3000,
    airport: 'air_atl', ground: '#24301f',
    pitch: 'The studios are the best in the country, the Bankhead plug has lean and percs cheap, and Buckhead houses come with a gate.',
    streetsNS: ['Northside Dr', 'Spring St', 'Peachtree St', 'Piedmont Ave', 'Boulevard', 'Moreland Ave', 'Candler Rd', 'Glenwood Ave', 'Memorial Dr'],
    streetsEW: ['Peachtree Rd', 'North Ave', 'Ponce de Leon Ave', 'Edgewood Ave', 'Auburn Ave', 'MLK Jr Dr', 'Ralph David Abernathy', 'Cleveland Ave', 'Old National Hwy'],
    district(i, j) { return j <= 2 ? 'Buckhead' : i >= 5 ? (j >= 5 ? 'Zone 6' : 'East Atlanta') : j >= 6 ? 'College Park' : 'Downtown Atlanta'; },
    outside: 'Fulton County',
  },
  ca: {
    id: 'ca', city: 'Los Angeles', state: 'California', abbr: 'CA', cx: 14000, cz: 0,
    airport: 'air_lax', ground: '#4a4434',
    pitch: 'JDM imports and exotics on the lots, the cheapest loud in the country, and the Hills if you\'ve got it.',
    streetsNS: ['Lincoln Blvd', 'La Cienega Blvd', 'Crenshaw Blvd', 'Western Ave', 'Vermont Ave', 'Figueroa St', 'Central Ave', 'Alameda St', 'Soto St'],
    streetsEW: ['Mulholland Dr', 'Sunset Blvd', 'Hollywood Blvd', 'Wilshire Blvd', 'Olympic Blvd', 'Slauson Ave', 'Florence Ave', 'Imperial Hwy', 'Rosecrans Ave'],
    district(i, j) { return j <= 2 ? 'Hollywood' : i <= 2 ? 'Venice' : j >= 6 ? 'Compton' : 'Downtown LA'; },
    outside: 'LA County',
  },
  fl: {
    id: 'fl', city: 'Miami', state: 'Florida', abbr: 'FL', cx: 14000, cz: 3000,
    airport: 'air_mia', ground: '#2c3a24',
    pitch: 'Powder and molly at half what Lil Tre charges, exotics on Ocean Drive, and a Brickell penthouse over the bay.',
    streetsNS: ['Red Rd', 'Le Jeune Rd', 'NW 27th Ave', 'NW 17th Ave', 'NW 7th Ave', 'Miami Ave', 'Biscayne Blvd', 'Collins Ave', 'Ocean Dr'],
    streetsEW: ['NW 79th St', 'NW 54th St', 'NW 36th St', 'NW 20th St', 'Flagler St', 'SW 8th St', 'Coral Way', 'SW 24th St', 'Bird Rd'],
    district(i, j) { return i >= 6 ? 'South Beach' : j <= 2 ? 'Wynwood' : j >= 6 ? 'Little Havana' : 'Brickell'; },
    outside: 'Miami-Dade',
  },
  co: {
    id: 'co', city: 'Denver', state: 'Colorado', abbr: 'CO', cx: 14000, cz: 6000,
    airport: 'air_den', ground: '#3a4430', legal: true,
    pitch: 'Weed is legal here. Buy a grow farm and a dispensary, run it like a real business, and the rec store sells loud for less than anybody.',
    streetsNS: ['Federal Blvd', 'Speer Blvd', 'Wynkoop St', 'Larimer St', 'Broadway', 'Downing St', 'York St', 'Colorado Blvd', 'Quebec St'],
    streetsEW: ['48th Ave', 'I-70 Frontage Rd', 'Brighton Blvd', '20th St', 'Colfax Ave', '13th Ave', '6th Ave', 'Alameda Ave', 'Evans Ave'],
    district(i, j) { return j <= 1 ? (i >= 4 ? 'RiNo' : 'Highlands') : i <= 3 && j <= 4 ? 'LoDo' : i >= 5 && j >= 5 ? 'Cherry Creek' : j >= 4 ? 'Capitol Hill' : 'Five Points'; },
    outside: 'Adams County',
  },
};
export const STATE_IDS = Object.keys(STATES);
// Home: Texas, with the airport at Alliance.
export const TEXAS = { id: 'tx', city: 'Fort Worth', state: 'Texas', abbr: 'TX', airport: 'air_alliance' };
export const stateById = id => STATES[id] || (id === 'tx' ? TEXAS : null);

export const cityRect = st => ({ x0: st.cx, z0: st.cz, x1: st.cx + STATE_N * STATE_BLOCK, z1: st.cz + STATE_N * STATE_BLOCK });
// the city plus the airport to the west, its new towns to the east and
// south (data/metro.js STATE_TOWNS) and a margin round the rest
export const regionRect = st => ({ x0: st.cx - 650, z0: st.cz - 300, x1: st.cx + 3700, z1: st.cz + 2300 });
export const AIRPORT_ROW = 4;            // the airport road comes in on this street line from the west

// Which state (x, z) is in: a state id, or 'tx'.
export function stateAt(x, z) {
  for (const st of Object.values(STATES)) { const r = regionRect(st); if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return st.id; }
  return 'tx';
}
export function stateDistrict(id, x, z) {
  const st = STATES[id], c = cityRect(st);
  if (x < c.x0 - 20 || x > c.x1 + 20 || z < c.z0 - 20 || z > c.z1 + 20) return x < c.x0 - 60 && Math.abs(z - (c.z0 + AIRPORT_ROW * STATE_BLOCK)) < 300 ? `${st.city} Airport` : st.outside;
  const i = Math.max(0, Math.min(STATE_N - 1, Math.floor((x - c.x0) / STATE_BLOCK))), j = Math.max(0, Math.min(STATE_N - 1, Math.floor((z - c.z0) / STATE_BLOCK)));
  return st.district(i, j);
}

// ---------------------------------------------------------------- flights
// Is weed legal where (x, z) is? Only Colorado.
export const legalWeedAt = (x, z) => !!STATES[stateAt(x, z)]?.legal;

// Hours in the air and the ticket, for each pair of airports.
const ROUTES = {
  'tx-ga': [2, 380], 'tx-ca': [3, 460], 'tx-fl': [2.5, 420],
  'ga-ca': [4.5, 520], 'ga-fl': [2, 300], 'ca-fl': [5, 560],
  'tx-co': [2, 360], 'ga-co': [3, 420], 'ca-co': [2.5, 380], 'fl-co': [4, 480],
};
export function route(a, b) {
  const r = ROUTES[`${a}-${b}`] || ROUTES[`${b}-${a}`];
  return r ? { hours: r[0], ticket: r[1] } : null;
}
// What a flight costs and how long it takes. Your car rides cargo if it comes.
export function flightQuote(from, to, withCar) {
  const r = route(from, to);
  if (!r) return null;
  return { ticket: r.ticket, freight: withCar ? FREIGHT : 0, total: r.ticket + (withCar ? FREIGHT : 0), minutes: Math.round(r.hours * 60) + 45 };   // + check-in and the taxi out
}
