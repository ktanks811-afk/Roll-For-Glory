// Fort Worth street gangs. Every set is made up, but each one claims a real
// side of town and posts up on a corner there. `hood` is a turf hood id
// (core/turf.js), `at` a spot in it that the set's corner snaps to, and
// `rivals` the sets they already have beef with.

export const GANGS = {
  six_block: {
    name: 'Six Block', short: 'Six Block', color: '#7b2bd1', hood: 'Stop Six', at: [1700, -400],
    boss: 'tre', rivals: ['hemphill', 'riverside'],
    style: 'East side. Grew up on Rosedale and Stalcup. Loyal to the block, quick to slide.',
  },
  northside: {
    name: 'Northside Reyes', short: 'Reyes', color: '#e8c21a', hood: 'Stockyards', at: [0, -650],
    boss: 'chuy', rivals: ['riverside'],
    style: 'North Side, Stockyards to Diamond Hill. Old school, family first, never talk to the police.',
  },
  hemphill: {
    name: 'Hemphill Boyz', short: 'Hemphill', color: '#c41b1b', hood: 'Near Southside', at: [0, 650],
    boss: 'dub', rivals: ['six_block', 'como'],
    style: 'Southside. Hemphill Street corners, loud cars, louder mouths.',
  },
  riverside: {
    name: 'Riverside Rydaz', short: 'Rydaz', color: '#1b8fd1', hood: 'Riverside Industrial', at: [650, -200],
    boss: 'slim', rivals: ['northside', 'six_block'],
    style: 'Warehouses and rail yards by the Trinity. They move product and they move quiet.',
  },
  como: {
    name: 'Como Gang', short: 'Como', color: '#1f8f3a', hood: 'Arlington Heights', at: [-650, 0],
    boss: 'peanut', rivals: ['hemphill'],
    style: 'West side, out of Como. Small set, long memory.',
  },
};
export const GANG_IDS = Object.keys(GANGS);

// The big homie of each set texts you jobs; they show up in Contacts.
export const GANG_CONTACTS = {
  tre:    { name: 'Trevon "Big Tre" Simms', role: 'Big homie · Six Block', color: '#7b2bd1', bio: 'Runs Six Block from his grandma\'s porch on Stalcup. Speaks slow, never twice.' },
  chuy:   { name: 'Jesus "Chuy" Ortega', role: 'Shot caller · Northside Reyes', color: '#e8c21a', bio: 'Third generation North Side. Owns a taqueria, among other things.' },
  dub:    { name: 'Dwayne "Dub" Rhodes', role: 'Big homie · Hemphill Boyz', color: '#c41b1b', bio: 'Thinks every problem is solved by pulling up. Usually right about that.' },
  slim:   { name: 'Antoine "Slim" Webb', role: 'Shot caller · Riverside Rydaz', color: '#1b8fd1', bio: 'Accountant energy. Knows what every corner made last week.' },
  peanut: { name: 'Dorian "Peanut" Hayes', role: 'Big homie · Como Gang', color: '#1f8f3a', bio: 'Small, quiet, and the only one in Como nobody argues with.' },
};

// Ranks inside a set. `homies`: how many you can have riding with you.
// `bag`: what the set kicks up to you every morning.
export const RANKS = [
  { name: 'Lil Homie', respect: 0, homies: 1, bag: 100 },
  { name: 'Soldier', respect: 150, homies: 2, bag: 250 },
  { name: 'Hitter', respect: 400, homies: 3, bag: 450 },
  { name: 'Lieutenant', respect: 900, homies: 4, bag: 800 },
  { name: 'Shot Caller', respect: 1800, homies: 6, bag: 1300 },
  { name: 'OG', respect: 3500, homies: 8, bag: 2000 },
];

export const NICKS = ['Lil Man', 'Boobie', 'Pooh', 'Lil Tre', 'Smoke', 'Bam', 'Tank', 'June', 'Buddah', 'Peewee', 'Scrap', 'Red', 'Ghost', 'Juju', 'Dre', 'Shorty', 'Ace', 'Lil Dee', 'Bird', 'Nook', 'Tweet', 'Mookie', 'Spud', 'Duke', 'Loc', 'Fats', 'Cuz', 'Woo', 'Rell', 'Kane'];

export const FOUND_COST = 10000;     // start your own set
export const RECRUIT_COST = 750;     // put a new homie on (guns, a phone, a reason)
export const HOMIE_DUES = 120;       // what each homie kicks up a day in a set you run
