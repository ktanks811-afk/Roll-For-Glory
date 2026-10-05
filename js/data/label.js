// Your record label: the artists you can find around Fort Worth and Dallas,
// the two studios, and what a session costs. Rules live in core/label.js.

export const LABEL_COST = 25000;           // the LLC, a logo and a little office over the studio
export const STREAM_PAY = 0.01;            // what the label grosses per stream
export const MAX_ROSTER = 8;

// Where you cut records. `q` adds to every session's quality, `rate` scales the price.
export const STUDIOS = {
  magnolia_sound: { name: 'Magnolia Sound', q: 0, rate: 1, owner: 'Big Lou', tagline: 'Near Southside · two booths · Lou has engineered half of Fort Worth' },
  ellum_lab: { name: 'Deep Ellum Sound Lab', q: 7, rate: 1.6, owner: 'Nina Cole', tagline: 'Deep Ellum · SSL board · Grammy plaques in the hallway' },
};

export const KINDS = {
  single: { name: 'Single', cost: 2500, days: 1, mult: 1, tracks: 1, decay: 0.93 },
  ep: { name: 'EP', cost: 9000, days: 2, mult: 2, tracks: 6, decay: 0.94 },
  mixtape: { name: 'Mixtape', cost: 16000, days: 3, mult: 2.8, tracks: 14, decay: 0.945 },
  album: { name: 'Album', cost: 45000, days: 6, mult: 5, tracks: 16, decay: 0.955 },
};
export const KIND_IDS = Object.keys(KINDS);

// Promo for a drop: price, how much it lifts day-one streams, and the extra shot at going viral.
export const PROMO = [
  { id: 'none', name: 'No promo', cost: 0, lift: 1, viral: 0 },
  { id: 'street', name: 'Street team + flyers', cost: 4000, lift: 1.3, viral: 0.02 },
  { id: 'playlist', name: 'Playlist push + Throttle ads', cost: 20000, lift: 1.8, viral: 0.05 },
  { id: 'radio', name: 'Radio, billboards, a video', cost: 90000, lift: 2.7, viral: 0.1 },
];
export const PROMO_BY_ID = Object.fromEntries(PROMO.map(p => [p.id, p]));

// The scene. `hang` is where you find them (a map location), `talent` 1-99,
// `buzz` their fans before you, `street` means trouble follows them.
const A = (id, name, real, genre, hood, hang, talent, buzz, bio, extra = {}) => ({ id, name, real, genre, hood, hang, talent, buzz, bio, ...extra });
export const ARTISTS = [
  // Fort Worth
  A('lil_six', 'Lil Six', 'Marcus Dunbar', 'Drill', 'Stop Six', 'plug', 58, 4200, 'Raps on the porch on Ramey Ave every night. The whole east side knows his hooks.', { street: true }),
  A('ramey_rae', 'Ramey Rae', 'Raeven Collins', 'R&B', 'Stop Six', 'taco_stopsix', 71, 9000, 'Sang in the choir at Dunbar High. Now she sings over trap beats and the comments go crazy.'),
  A('poly_pooh', 'Poly Pooh', 'Darnell Hicks', 'Trap', 'Polytechnic', 'corner_riverside', 46, 1500, 'Freestyles outside the Mini Mart for anybody with a phone out.', { street: true }),
  A('como_kid', 'Como Kid', 'Jalen Pierce', 'Rap', 'Como', 'kessler_lot', 52, 2600, 'Battle rapper from Como. Fast mouth, no filter.'),
  A('northside_nena', 'Nena del Norte', 'Marisol Peña', 'Tejano Trap', 'Northside', 'corner_northside', 63, 7500, 'Puts accordion samples under 808s. Big on the Northside and growing in Oak Cliff.'),
  A('stockyard_slim', 'Stockyard Slim', 'Wade Tillman', 'Country Rap', 'Stockyards', 'cowtown_diner', 55, 3800, 'Boots, a Cadillac and a banjo loop. Somehow it works.'),
  A('magnolia_mo', 'Magnolia Mo', 'Morgan Ellis', 'Neo-Soul', 'Near Southside', 'taco_magnolia', 67, 5200, 'Plays the patio bars on Magnolia. Writes everything on napkins.'),
  A('berry_st_bandz', 'Berry St Bandz', 'Terrence Ward', 'Trap', 'Hillside', 'corner_rosedale', 49, 2100, 'Every song is about money he doesn\'t have yet.', { street: true }),
  A('screwtape_tc', 'Screwtape TC', 'Tyrell Carter', 'Chopped & Screwed', 'Eastside', 'gas_harbor', 60, 6100, 'Slows everything down to a crawl. The car scene plays him at every meet.'),
  A('kayla_cash', 'Kayla Cash', 'Kayla Jefferson', 'Pop Rap', 'Downtown', 'luckys', 74, 15000, 'Already has a viral clip. Every label in DFW has her number.'),
  A('heights_hollis', 'Hollis', 'Hollis Grant', 'Indie', 'Arlington Heights', 'heights_bbq', 41, 900, 'Sad guitar songs. Very good at them. Very sad.'),
  A('foundry_fiend', 'Foundry Fiend', 'Andre Lucas', 'Drill', 'Riverside', 'old_foundry', 64, 8300, 'Records voice notes in the warehouse between races. Scary pen.', { street: true }),
  A('pier9_pharaoh', 'Pharaoh 9', 'Isaiah Moss', 'Rap', 'Lake Worth', 'pier9', 79, 26000, 'The car scene\'s favorite rapper. Shows up to the Pier 9 lot in a different whip every week.', { street: true }),
  A('lanc_lexi', 'Lexi Lancaster', 'Alexis Ramos', 'Reggaeton', 'East Lancaster', 'taco_lancaster', 57, 4400, 'Works the taco truck window and sings to the line.'),
  A('gran_plaza_g', 'G de la Plaza', 'Gerardo Salinas', 'Corridos Tumbados', 'Southside', 'gran_plaza', 69, 12000, 'Plays the weekend meet with a twelve-string and a crowd around him.'),
  // Dallas and Arlington
  A('ellum_eve', 'Eve Ellum', 'Evelyn Brooks', 'Alt R&B', 'Deep Ellum', 'corner_ellum', 76, 19000, 'Sold out the little rooms on Elm St. The big rooms are next.'),
  A('oakcliff_ocho', 'Ocho', 'Octavio Reyes', 'Rap', 'Oak Cliff', 'gas_oakcliff', 66, 9800, 'Oak Cliff\'s pride. Raps in two languages, sometimes in one bar.'),
  A('south_dallas_dre', 'SD Dre', 'Andre Wallace', 'Trap', 'South Dallas', 'corner_grand', 62, 7000, 'Grand Ave legend. Two mixtapes on the street, zero distribution.', { street: true }),
  A('uptown_ivy', 'Ivy', 'Ivy Chen', 'Pop', 'Uptown', 'ellum_meet', 72, 14000, 'Polished, camera-ready, has a stylist already. Wants a real budget.'),
  A('ellum_echo', 'Echo Park', 'Sam Whitley', 'Rock', 'Deep Ellum', 'gas_deep_ellum', 51, 3100, 'A three-piece that is somehow louder than a five-piece.'),
  A('arlington_ace', 'Ace of Arlington', 'Christopher Bell', 'Rap', 'Arlington', 'gas_arlington', 54, 3300, 'Raps about the stadium traffic. It\'s a whole genre now.'),
  A('big_d_duchess', 'Duchess', 'Danielle Price', 'Rap', 'South Dallas', 'corner_grand', 85, 52000, 'The best rapper in Dallas and she knows it. She won\'t sign with a nobody.'),
  A('trinity_tre', 'Trinity Tre', 'Tremaine Ford', 'Gospel Rap', 'West Dallas', 'gas_oakcliff', 59, 4800, 'His grandmother\'s church choir is on every hook.'),
  A('dfw_ghost', 'Ghost', 'Unknown', 'Drill', 'Unknown', 'trap_stopsix', 91, 88000, 'Nobody has seen his face. Millions of plays. Word is he records in Stop Six.', { street: true }),
];
export const ARTIST_BY_ID = Object.fromEntries(ARTISTS.map(a => [a.id, a]));

// Song titles: a first word or two and an end.
export const TITLE_A = ['Stop Six', 'Berry St', 'Cowtown', 'Trinity', 'Southside', 'Late Night', 'Murda Worth', 'Lancaster', 'Big D', 'Magnolia', 'Ramey Ave', 'Pier 9', 'Grand Ave', 'I-30', 'Loop 820', 'Northside', 'Oak Cliff', 'Elm St', 'Candy Paint', 'Paper', 'Twelve', 'Ghost'];
export const TITLE_B = ['Summer', 'Nights', 'Blues', 'Dreams', 'Anthem', 'Money', 'Prayer', 'Ride', 'Story', 'Shine', 'Pressure', 'Freestyle', 'Forever', 'Lullaby', 'Heat', 'Season', 'Gospel', 'Runs', 'Love', 'Diaries'];
