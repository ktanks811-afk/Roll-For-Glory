// Story campaign. Each step listens for game events and completes when
// `done(ev, data, s)` returns true. `start` messages arrive on the phone
// when the step begins. `where` drives the GPS "Set route" button.

export const CHAPTERS = [
  {
    title: 'Chapter 1 — Rolling Start',
    blurb: 'Two grand, a bus pass, and a city full of people faster than you.',
    steps: [
      { id: 'c1_car', objective: 'Find your first car on Marketplace (Phone → Marketplace)',
        start: [['jojo', "Yo! You made it to Fort Worth. Real talk — you can't race on a bus pass. Open Marketplace on your phone. Look for something cheap with a manual. High miles is fine, just don't buy anything that says 'rod knock'."]],
        done: ev => ev === 'carBought', reward: { rep: 50 } },
      { id: 'c1_part', objective: 'Order a part on PartsHub and get it installed', where: 'torque_temple',
        start: [['rosa', "Jojo says you bought a car. Congrats, now it's a money pit. Order parts on PartsHub — they ship to your place. Bring them to Torque Temple and I'll put them on, or do it yourself at home if you're brave. Start with tires. Always tires."]],
        done: ev => ev === 'partInstalled', reward: { rep: 75 } },
      { id: 'c1_tiny', objective: 'Beat Tiny Ruiz in a roll race', where: 'ironside_start', racer: 'tiny',
        start: [['jojo', "Okay don't freak out. I told Tiny Ruiz you'd race him. He's got the red Civic Si with the giant wing. East Lancaster, whenever. He talks a lot, he shifts late."],
          ['tiny', "Heard you think you're quick. East Lancaster. Bring cash."]],
        done: (ev, d) => ev === 'raceFinished' && d.won && d.npcId === 'tiny', reward: { rep: 150, cash: 300 } },
      { id: 'c1_drag', objective: 'Make a pass at Ironline Dragway (any result)', where: 'ironline',
        start: [['mags', "Saw you walk Tiny. Nice. Real racers time it though. Come to Ironline Dragway in the desert — burnout, stage, watch the tree. I'll be there."]],
        done: (ev, d) => ev === 'raceFinished' && d.type === 'drag', reward: { rep: 100 } },
    ],
  },
  {
    title: 'Chapter 2 — Night Shift',
    blurb: 'The real scene comes out after dark. So do the cops.',
    steps: [
      { id: 'c2_meet', objective: 'Attend a street meet at Pier 9 (after 8 PM)', where: 'pier9',
        start: [['kingpin', "Pier 9. Tonight. After eight. Park nice, don't do anything stupid in the lot, and we're good. — Dre"]],
        done: ev => ev === 'meetVisited', reward: { rep: 150, followers: 60 } },
      { id: 'c2_wagers', objective: 'Win $1,500 in wagers', counter: 'wagerWinnings', target: 1500,
        start: [['kingpin', "People saw you at the pier. Money talks in this town — win some wagers and folks will start calling you."]],
        done: (ev, d, s) => (s.story.counters.wagerWinnings || 0) >= 1500, reward: { rep: 200 } },
      { id: 'c2_cops', objective: 'Escape a police pursuit',
        start: [['brenner', "This is Sergeant Brenner, FWPD. I got your number from a friend of a friend. Consider this the polite warning: I've seen the East Lancaster videos. Slow down."],
          ['jojo', "Bro. A COP texted you?? Okay — if they ever light you up: break line of sight, get out of the search circle, lay low. Or get home."]],
        done: ev => ev === 'pursuitEscaped', reward: { rep: 250, followers: 120 } },
      { id: 'c2_static', objective: 'Reach Tier 2 and beat Nico "Static" Tanaka', where: 'glory_onramp', racer: 'static',
        start: [['static', "Keys keeps a notebook. Your page is getting long. Loop 820 on-ramp, when you're ready. — N."]],
        done: (ev, d) => ev === 'raceFinished' && d.won && d.npcId === 'static', reward: { rep: 400, cash: 1500, followers: 200 } },
    ],
  },
  {
    title: 'Chapter 3 — Name in Lights',
    blurb: 'Crews want you. Saints want you gone.',
    steps: [
      { id: 'c3_crew', objective: 'Join a crew or start your own (Phone → Crew)',
        start: [['static', "Midnight Static has a seat open. Or start your own thing — but in this city, nobody runs alone for long."]],
        done: ev => ev === 'crewJoined', reward: { rep: 200 } },
      { id: 'c3_hammer', objective: 'Beat Dom "Hammer" Reyes at Ironline Dragway', where: 'ironline', racer: 'hammer',
        start: [['hammer', "You've been making noise. Saints don't like noise we didn't make. Ironline. Quarter mile."]],
        done: (ev, d) => ev === 'raceFinished' && d.won && d.npcId === 'hammer', reward: { rep: 350, cash: 2500 } },
      { id: 'c3_tier3', objective: 'Reach Tier 3 street rep (5,000 rep)',
        start: [['kingpin', "You're on the board now. Get to Established and I'll open up the Foundry meets for you."]],
        done: (ev, d, s) => s.rep >= 5000, reward: { cash: 5000, followers: 400 } },
      { id: 'c3_saint', objective: 'Beat Vic "Saint" Castellanos', where: 'ironline', racer: 'saint',
        start: [['saint', "My crew lost to you. That's on me now. Ironline. You and me. Bring real money."]],
        done: (ev, d) => ev === 'raceFinished' && d.won && d.npcId === 'saint', reward: { rep: 800, cash: 10000, followers: 1000 } },
    ],
  },
  {
    title: 'Chapter 4 — Elite (in development)',
    blurb: 'The Velvet Ghosts, Phantom, and the road to the Apex Syndicate. These chapters are being written — keep racing freely in the meantime: every Tier 4 and 5 racer is already in the game.',
    steps: [],
  },
];

export function currentStep(story) {
  const ch = CHAPTERS[story.chapter];
  return ch ? ch.steps[story.step] || null : null;
}
