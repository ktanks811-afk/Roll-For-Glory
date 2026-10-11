// Throttle, the city's social app: the pages and regular people who post
// about what goes down in Murda Worth. Every account here is made up.
// Templates use {me} (your @handle), {name} (your name), {npc}, {car},
// {where}, {amt} and {gang}; core/feed.js fills them in.

export const PAGES = {
  scanner:  { name: 'Fort Worth Scanner 🚨', handle: 'fwscanner', color: '#1b4fc4', verified: true },
  streetz:  { name: 'Cowtown Streetz 🏁', handle: 'cowtownstreetz', color: '#e0192e', verified: true },
  tea:      { name: 'Murda Worth Tea ☕', handle: 'murdaworthtea', color: '#a01aff', verified: true },
  news:     { name: 'NBC 5 DFW (not really)', handle: 'dfw5news', color: '#2a7bff', verified: true },
  fwpd:     { name: 'FWPD', handle: 'fortworthpd', color: '#0b2a6b', verified: true },
};

// Regular people in the comments and on the timeline.
export const LOCALS = [
  'tay_on_rosedale', 'stopsix_shay', 'lilbit817', 'hemphillhoney', 'cowtowncarlos', 'northside_nae',
  'dre.817', 'big_ced_fw', 'kiki_got_keys', 'jayy.boostedd', 'mama_dunbar', 'westside_wes',
  'trinity_tre', 'yolanda.817', 'boosted_benny', 'lowkey_lexx', 'stockyard_steph', 'mookie_mph',
];
// What a stranger's stolen car was, for the posts about it.
export const STREET_CARS = ['Charger', 'Camaro', 'Silverado', 'Altima', 'Tahoe', 'Malibu', 'Mustang', 'Impala', 'F-150', 'Accord'];
export const LOCAL_COLORS = ['#ff1a6a', '#e8641a', '#1f8f3a', '#2a7bff', '#a01aff', '#e8c21a', '#1b8fd1', '#c41b1b'];

// What the pages and people say when you do something.
export const REACT = {
  raceWin: [
    ['streetz', '{me} just walked {npc} on {where}. {car} different 😤 #MurdaWorth'],
    ['streetz', 'Clip incoming: {npc} vs {me}. It was NOT close.'],
    ['tea', 'So {npc} really got smoked by {me} tonight?? Somebody check on them 💀'],
  ],
  raceWinMoney: [
    ['streetz', '{me} took {amt} off {npc} on {where}. The streets are paying out tonight 💸'],
    ['tea', '{npc} down {amt} to {me}. That\'s rent money, baby 😭'],
  ],
  pinks: [
    ['streetz', '🚨 PINK SLIP ALERT 🚨 {me} just took {npc}\'s car. Keys handed over and everything.'],
    ['tea', '{npc} walking home tonight 🚶 {me} took the title.'],
  ],
  raceLoss: [
    ['streetz', '{npc} sent {me} home on {where}. Back to the garage.'],
    ['tea', 'Not {me} talking all that and losing to {npc} 😂'],
  ],
  busted: [
    ['scanner', '🚔 Units have one in custody near {where}. Witnesses say it\'s {me}.'],
    ['tea', 'They got {me}!! Free {name} 😭✊'],
    ['fwpd', 'An arrest was made tonight in {where}. FWPD thanks the public for its tips.'],
  ],
  ticket: [
    ['tea', '{me} getting a ticket on {where}. Officer was NOT playing 💀'],
  ],
  escaped: [
    ['scanner', 'Pursuit terminated near {where}. The suspect got away.'],
    ['streetz', '{me} just shook FWPD in the {car}. Lost them on the Southside 💨'],
    ['tea', 'Ain\'t no way {me} got away AGAIN. FWPD stay losing 😂'],
  ],
  carStolen: [
    ['scanner', 'Stolen vehicle reported in {where}. If you see a {car} driving crazy, call it in.'],
    ['local', 'Somebody took my {car} in {where}!!! If you see it DM me, I\'m not playing 😡'],
  ],
  carjackedMe: [
    ['scanner', 'Carjacking reported in {where}. The victim was not hurt.'],
    ['tea', 'Somebody really carjacked {me}?? In THIS city?? 😳'],
  ],
  fenced: [
    ['tea', 'Rusty\'s lot got a "new" {car} on it... no questions asked 🤐'],
  ],
  bigMoney: [
    ['tea', '{me} pulled up flexing {amt} today. Where the money coming from tho 👀'],
    ['local', 'Seen {me} at the gas station with a whole knot. {amt}, easy 💰'],
  ],
  warrant: [
    ['fwpd', 'WANTED: FWPD is looking for {name}. If you have information, call Crime Stoppers.'],
    ['tea', '{me} got a warrant out 😬 stay inside bro'],
  ],
  sentence: [
    ['tea', 'Free {me}!! Locked up in Tarrant County 😢 #FreeTheGuys'],
    ['news', 'A Fort Worth driver was sentenced today in Tarrant County court.'],
  ],
  raid: [
    ['scanner', 'SWAT on scene at a house in {where}. Neighbors told to stay inside.'],
    ['news', 'Tarrant County SWAT served a narcotics warrant this morning in {where}.'],
  ],
  driveby: [
    ['scanner', 'Shots fired call near {gang} corner. Multiple callers, a car fled the scene.'],
    ['tea', 'It\'s getting hot between {me} and {gang} 😬 y\'all be safe out there'],
  ],
  gangJoined: [
    ['tea', '{me} claiming {gang} now?? Somebody tell me I\'m lying 👀'],
  ],
  tierUp: [
    ['streetz', '{me} is a real name now. Every crew in the city is watching.'],
  ],
};

// Comments people leave under posts about you.
export const COMMENTS = {
  good: ['🔥🔥🔥', 'Run it back!!', 'Different breed 😤', 'Tell em', 'GOAT behavior', 'Clip or it didn\'t happen', 'Murda Worth stand UP', 'The streets talking about you fr', 'Pull up to the meet tonight'],
  bad: ['💀💀💀', 'Took an L', 'Free the guys 😭', 'Not again 😂', 'Stay in the house bro', 'I told y\'all', 'Somebody record this', 'Yikes'],
  hot: ['Y\'all be safe out there', 'Not in my neighborhood again 😡', 'They need more police over there', 'That\'s crazy', 'Prayers up 🙏', 'Stay inside tonight'],
};

// Background noise so the feed is alive even when you're not in it.
export const AMBIENT = [
  ['streetz', 'Meet at Pier 9 tonight. Bring something loud.'],
  ['streetz', 'Who got the fastest car on the east side? Wrong answers only.'],
  ['scanner', 'Traffic: wreck on the I-35 frontage road, avoid if you can.'],
  ['scanner', 'Heavy police activity downtown near Sundance Square.'],
  ['tea', 'The way Stop Six been going crazy this week 😭'],
  ['tea', 'Whoever got the Hellcat with the purple wheels, you know what you did 👀'],
  ['news', 'Weather: hot and humid all week. Stay hydrated, Fort Worth.'],
  ['fwpd', 'Street racing is illegal and dangerous. Report it.'],
  ['local', 'Who selling a clean Civic under 5k, need it today'],
  ['local', 'Dunbar homecoming was CRAZY this year'],
  ['local', 'Best brisket in the city is on the east side and I\'m not debating it'],
  ['local', 'Somebody doing donuts in the Walmart parking lot again lmao'],
  ['local', 'Cops sitting at the bottom of the bridge again, slow down'],
  ['local', 'Why every car in this city got a loud exhaust now 😂'],
];

// Rival texts. Racers you beat (or who beat you) and sets you have beef with
// text you. {me} is your name, {amt} money, {where} a place.
export const RIVAL_TEXTS = {
  racerSore: ['You got lucky. That\'s all that was.', 'Enjoy it. I want my money back.', 'Everybody saw that clip. Now everybody gonna see the rematch.', 'You embarrassed me in front of my people. That\'s a problem.'],
  racerHeated: ['I know where you park. Just saying.', 'You keep my name out your mouth on Throttle.', 'Next time it\'s pinks. Don\'t duck me.', 'You think you run this city now? Bet.'],
  racerGloat: ['Told you. Go home.', 'Need a ride? 😂', 'That\'s what I thought.', 'Come back when you got a real car.'],
  gangWarn: ['You been seen around {gang} business. Watch that.', 'Stay off our side. Last warning.', 'We know your car.'],
  gangHot: ['You slid on us. We remember faces.', 'Keep looking over your shoulder.', 'You and your homies better stay off {where}.', 'It\'s on sight now. Ask about us.'],
  gangWar: ['We coming. Ain\'t no squashing this for free.', 'Tell your people to stay in tonight.', 'You started something you can\'t finish.'],
  fenced: ['That {car} you sold to Rusty was my cousin\'s. We know.'],
};
