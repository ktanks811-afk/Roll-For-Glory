// Hog dogs, brought over from Hogs & Dogs (ktanks811-afk/Hogs-and-dogs):
// the same breeds, stats, temperaments and coat genetics, priced for Murda
// Worth money. Rules live in core/dogs.js (kennel, breeding, training) and
// core/hoghunt.js (the hunt). DOM-free so check-data can test it.

// stat keys, in the order breed `pot` arrays use: spd str sta int trk obd grip
export const STATS = [['spd', 'Speed'], ['str', 'Strength'], ['sta', 'Stamina'], ['int', 'Hunting sense'], ['trk', 'Tracking'], ['obd', 'Obedience'], ['grip', 'Catch']];
export const TRAIN = { spd: 'Sprint drills', str: 'Weight pull', sta: 'Road work', int: 'Woods time', trk: 'Scent trails', obd: 'Obedience work', grip: 'Catch work' };
export const TEMPS = ['Steady', 'Bold', 'Gritty', 'Eager', 'Calm', 'Hot-headed', 'Stubborn', 'Sharp', 'Loyal'];
export const TEMP_FX = {
  Steady: 'Balanced in the woods', Bold: '+5% catch success', Gritty: '+5 catch power', Eager: '+20% training gains', Calm: 'Holds a bay longer',
  'Hot-headed': '+8% catch, more injuries', Stubborn: '-20% training gains', Sharp: 'Winds hogs from farther off', Loyal: 'Never quits a bay',
};

// Genetics loci. Allele order is dominance order.
export const LOCI = {
  B: { name: 'Brown', alleles: ['B', 'b'] },
  D: { name: 'Dilute', alleles: ['D', 'd'] },
  E: { name: 'Extension (mask, grizzle, red)', alleles: ['Em', 'eg', 'E', 'e'] },
  A: { name: 'Agouti (saddle, tan points)', alleles: ['ay', 'as', 'at', 'a'] },
  K: { name: 'Pattern', alleles: ['K', 'br', 'y'] },
  S: { name: 'White spotting', alleles: ['S', 'sp', 'sw'] },
  M: { name: 'Merle', alleles: ['M', 'm'] },
  T: { name: 'Ticking', alleles: ['T', 't'] },
  L: { name: 'Coat length', alleles: ['L', 'l'] },
  R: { name: 'Roaning', alleles: ['R', 'r'] },
};
export const DEFAULT_FREQ = { L: { L: .97, l: .03 }, R: { R: .02, r: .98 }, A: { ay: .45, as: .1, at: .25, a: .2 }, T: { T: .1, t: .9 }, B: { B: .85, b: .15 }, D: { D: .9, d: .1 }, E: { Em: .15, eg: .04, E: .51, e: .3 }, K: { K: .4, br: .3, y: .3 }, S: { S: .7, sp: .25, sw: .05 }, M: { M: 0, m: 1 } };

// role: bay dogs find and hold hogs, catch dogs take hold. price is the
// kennel's asking price for an average one. kg: grown weight range.
// range (when given) bounds each stat's potential; health bounds vigor.
export const BREEDS = {
  'Black Mouth Cur': { short: 'Cur', role: 'bay', price: 1300, kg: [18, 40], pot: [70, 60, 72, 65, 75, 62, 55], freq: { E: { E: .55, e: .45 }, K: { K: .1, br: .1, y: .8 } } },
  'Black Mountain Cur': { short: 'Cur', role: 'bay', price: 1500, kg: [20, 36], pot: [70, 62, 74, 66, 78, 62, 56], freq: { E: { Em: .35, eg: .06, E: .44, e: .15 }, A: { ay: .4, as: .1, at: .35, a: .15 }, K: { K: .3, br: .55, y: .15 }, S: { S: .85, sp: .12, sw: .03 }, M: { M: .03, m: .97 }, T: { T: .05, t: .95 }, B: { B: .8, b: .2 }, D: { D: .9, d: .1 } } },
  'Mountain Cur': { short: 'Cur', role: 'bay', price: 1200, kg: [14, 30], pot: [66, 58, 75, 62, 78, 60, 52], freq: { K: { K: .4, br: .5, y: .1 }, S: { S: .8, sp: .2, sw: 0 } } },
  'Treeing Walker': { short: 'Walker', role: 'bay', price: 1100, kg: [22, 32], pot: [78, 48, 78, 58, 76, 58, 40], speck: .6, freq: { S: { S: .05, sp: .55, sw: .4 }, K: { K: .15, br: .05, y: .8 }, A: { ay: .15, as: .3, at: .5, a: .05 }, E: { Em: .03, eg: 0, E: .85, e: .12 }, T: { T: .45, t: .55 }, M: { M: .01, m: .99 }, B: { B: .92, b: .08 }, D: { D: .95, d: .05 } } },
  'American Bulldog': { short: 'Bulldog', role: 'catch', price: 1600, kg: [27, 55], pot: [55, 80, 58, 58, 40, 60, 82], freq: { E: { Em: .15, eg: 0, E: .6, e: .25 }, A: { ay: .5, as: .1, at: .2, a: .2 }, K: { K: .3, br: .4, y: .3 }, S: { S: .1, sp: .4, sw: .5 }, M: { M: .04, m: .96 }, T: { T: .08, t: .92 }, B: { B: .7, b: .3 }, D: { D: .85, d: .15 } } },
  'American Pit Bull Terrier': { short: 'Pit', role: 'catch', price: 1400, kg: [14, 30], pot: [66, 72, 72, 64, 45, 62, 78], freq: { D: { D: .7, d: .3 }, B: { B: .7, b: .3 }, E: { Em: .2, E: .5, e: .3 }, A: { ay: .5, as: .05, at: .2, a: .25 }, K: { K: .35, br: .4, y: .25 }, S: { S: .45, sp: .35, sw: .2 }, M: { M: .05, m: .95 }, T: { T: .08, t: .92 } } },
  'Pit Bull Terrier × All Mastiff Mix': { short: 'Pit×Mastiff', role: 'catch', price: 2600, kg: [34, 52], pot: [68, 90, 82, 72, 58, 70, 90],
    range: [[60, 78], [82, 98], [74, 90], [62, 82], [48, 68], [60, 80], [82, 98]], health: [74, 92], freq: { D: { D: .7, d: .3 }, B: { B: .7, b: .3 }, E: { Em: .2, E: .5, e: .3 }, A: { ay: .5, as: .05, at: .2, a: .25 }, K: { K: .35, br: .4, y: .25 }, S: { S: .45, sp: .35, sw: .2 }, M: { M: .05, m: .95 }, T: { T: .08, t: .92 } } },
  'Catahoula Leopard Dog': { short: 'Catahoula', role: 'bay', price: 1800, kg: [18, 40], pot: [64, 58, 70, 72, 76, 55, 50], freq: { M: { M: .5, m: .5 }, K: { K: .55, br: .12, y: .33 }, A: { ay: .3, as: .1, at: .45, a: .15 }, E: { Em: .1, eg: 0, E: .7, e: .2 }, S: { S: .7, sp: .2, sw: .1 }, B: { B: .75, b: .25 }, D: { D: .8, d: .2 }, T: { T: .1, t: .9 } } },
  'Plott Hound': { short: 'Plott', role: 'bay', price: 1700, kg: [18, 27], pot: [62, 62, 74, 60, 80, 55, 55], freq: { K: { K: .1, br: .85, y: .05 }, E: { E: .95, e: .05 }, S: { S: .9, sp: .1, sw: 0 } } },
  'Blue Lacy': { short: 'Lacy', role: 'bay', price: 2200, kg: [11, 23], pot: [72, 52, 70, 70, 72, 65, 48], freq: { D: { D: 0, d: 1 }, E: { E: .6, e: .4 }, K: { K: .8, br: 0, y: .2 }, S: { S: .9, sp: .1, sw: 0 } } },
  'Leopard Cur': { short: 'Leopard', role: 'bay', price: 2000, kg: [18, 35], pot: [68, 56, 72, 66, 74, 60, 50], freq: { M: { M: .4, m: .6 }, K: { K: .6, br: .2, y: .2 } } },
  'Dogo Argentino': { short: 'Dogo', role: 'catch', price: 2800, kg: [36, 45], pot: [79, 91, 83, 75, 80, 79, 91],
    range: [[70, 88], [85, 98], [75, 92], [65, 85], [70, 90], [70, 88], [85, 98]], whiteBias: .25, speck: 0, freq: { L: { L: 1, l: 0 }, R: { R: 0, r: 1 }, B: { B: .95, b: .05 }, D: { D: .97, d: .03 }, E: { Em: .03, eg: 0, E: .9, e: .07 }, K: { K: .95, br: 0, y: .05 }, A: { ay: .4, as: .1, at: .3, a: .2 }, S: { S: 0, sp: 0, sw: 1 }, M: { M: 0, m: 1 }, T: { T: 0, t: 1 } } },
  'Gordon Setter': { short: 'Setter', role: 'bay', price: 2600, kg: [25, 36], pot: [70, 50, 76, 72, 74, 72, 40], freq: { L: { L: 0, l: 1 }, R: { R: .04, r: .96 }, K: { K: .04, br: 0, y: .96 }, A: { ay: .02, as: .03, at: .95, a: 0 }, E: { Em: 0, eg: 0, E: .93, e: .07 }, S: { S: .9, sp: .08, sw: .02 }, B: { B: .9, b: .1 }, D: { D: .97, d: .03 }, M: { M: 0, m: 1 }, T: { T: .06, t: .94 } } },
  'German Rottweiler': { short: 'Rottie', role: 'catch', price: 2800, kg: [38, 60], pot: [66, 88, 76, 80, 56, 78, 88], freq: { K: { K: 0, br: 0, y: 1 }, A: { ay: 0, as: 0, at: 1, a: 0 }, E: { Em: 0, eg: 0, E: 1, e: 0 }, S: { S: .97, sp: .03, sw: 0 }, M: { M: 0, m: 1 }, B: { B: .97, b: .03 }, D: { D: .98, d: .02 }, T: { T: 0, t: 1 } } },
  'American Bully': { short: 'Bully', role: 'catch', price: 2400, kg: [30, 55], pot: [58, 86, 64, 62, 42, 64, 86], freq: { D: { D: .45, d: .55 }, B: { B: .7, b: .3 }, E: { Em: .15, eg: 0, E: .55, e: .3 }, A: { ay: .35, as: .05, at: .3, a: .3 }, K: { K: .45, br: .3, y: .25 }, S: { S: .3, sp: .5, sw: .2 }, M: { M: .08, m: .92 }, T: { T: .05, t: .95 } } },
  'American English Coonhound': { short: 'Coonhound', role: 'bay', price: 1400, kg: [20, 30], coatInt: [.6, .85], pot: [74, 52, 78, 60, 80, 58, 42], freq: { T: { T: .7, t: .3 }, S: { S: .1, sp: .5, sw: .4 }, K: { K: .3, br: 0, y: .7 }, A: { ay: .3, as: .1, at: .55, a: .05 }, E: { Em: 0, eg: 0, E: .8, e: .2 }, M: { M: 0, m: 1 }, B: { B: .95, b: .05 }, D: { D: .97, d: .03 } } },
  'Redbone Coonhound': { short: 'Redbone', role: 'bay', price: 1500, kg: [20, 32], coatInt: [.86, .98], pot: [72, 56, 78, 60, 80, 58, 44], freq: { E: { Em: 0, eg: 0, E: .03, e: .97 }, S: { S: .95, sp: .05, sw: 0 }, T: { T: .02, t: .98 }, B: { B: .9, b: .1 }, D: { D: .98, d: .02 }, K: { K: .3, br: 0, y: .7 }, M: { M: 0, m: 1 } } },
  'Black and Tan Coonhound': { short: 'B&T', role: 'bay', price: 1400, kg: [25, 34], coatInt: [.62, .85], pot: [70, 58, 78, 60, 84, 56, 44], freq: { K: { K: .02, br: 0, y: .98 }, A: { ay: 0, as: .02, at: .98, a: 0 }, E: { Em: 0, eg: 0, E: .97, e: .03 }, S: { S: .95, sp: .05, sw: 0 }, T: { T: .03, t: .97 }, M: { M: 0, m: 1 }, B: { B: .97, b: .03 }, D: { D: .98, d: .02 } } },
  'Bluetick Coonhound': { short: 'Bluetick', role: 'bay', price: 1700, kg: [20, 36], coatInt: [.6, .8], pot: [70, 56, 78, 62, 84, 56, 44], freq: { T: { T: .95, t: .05 }, R: { R: .6, r: .4 }, S: { S: .05, sp: .35, sw: .6 }, K: { K: .9, br: 0, y: .1 }, A: { ay: 0, as: .1, at: .9, a: 0 }, E: { Em: 0, eg: 0, E: .97, e: .03 }, M: { M: 0, m: 1 }, B: { B: .97, b: .03 }, D: { D: .98, d: .02 } } },
  'Beagle': { short: 'Beagle', role: 'bay', price: 800, kg: [9, 14], coatInt: [.55, .8], pot: [68, 40, 76, 62, 84, 56, 30], freq: { S: { S: .05, sp: .55, sw: .4 }, K: { K: .05, br: 0, y: .95 }, A: { ay: .1, as: .5, at: .4, a: 0 }, E: { Em: 0, eg: 0, E: .9, e: .1 }, T: { T: .3, t: .7 }, M: { M: 0, m: 1 }, B: { B: .95, b: .05 }, D: { D: .98, d: .02 } } },
  'Labrador Retriever': { short: 'Lab', role: 'bay', price: 1200, kg: [25, 36], pot: [66, 64, 72, 74, 70, 80, 52], freq: { E: { Em: 0, eg: 0, E: .55, e: .45 }, B: { B: .6, b: .4 }, K: { K: .95, br: 0, y: .05 }, S: { S: 1, sp: 0, sw: 0 }, D: { D: .97, d: .03 }, M: { M: 0, m: 1 }, T: { T: 0, t: 1 } } },
  'Cane Corso': { short: 'Corso', role: 'catch', price: 3200, kg: [40, 50], pot: [74, 94, 86, 86, 75, 81, 94],
    range: [[65, 82], [88, 99], [78, 94], [78, 94], [65, 85], [72, 90], [88, 99]], health: [78, 94], whiteBias: -.12, speck: 0, noPiebald: true, freq: { B: { B: 1, b: 0 }, D: { D: .6, d: .4 }, E: { Em: .6, eg: 0, E: .4, e: 0 }, K: { K: .45, br: .35, y: .2 }, A: { ay: 1, as: 0, at: 0, a: 0 }, S: { S: .9, sp: .1, sw: 0 }, M: { M: 0, m: 1 }, T: { T: 0, t: 1 }, L: { L: 1, l: 0 }, R: { R: 0, r: 1 } } },
};
export const BREED_NAMES = Object.keys(BREEDS);

export const RARITY = [['Common', '#9aa0a6'], ['Uncommon', '#3ecf6a'], ['Rare', '#3aa0ff'], ['Epic', '#b45cff'], ['Legendary', '#ffb020']];

// Dog names: a call name, maybe a second name or a handle. Never repeats
// one your kennel already has.
export const CALL_M = 'Blue Rowdy Tank Buck Boone Remi Gunner Duke Scout Cash Hank Tucker Roux Jett Moose Ranger Rebel Bandit Bo Bear Beau Blaze Boomer Bosco Brute Bubba Buster Butch Cajun Chief Clyde Colt Copper Crockett Deacon Diesel Dozer Drake Dutch Earl Floyd Gator Goose Gus Hammer Hawk Hondo Hoss Hunter Ike Jake Jasper Jax Jethro Judge Kodiak Lefty Levi Mack Major Marshal Maverick Merle Moe Nash Ned Otis Ozzy Pistol Porter Radar Rascal Red Rex Rip Rocco Roscoe Rufus Rusty Sarge Shiloh Smokey Spike Tex Tater Gravy Waylon Zeke'.split(' ');
export const CALL_F = 'Jolene Dixie Sadie Belle Ruby Maggie Birdie Pearl Annie Bonnie Callie Coco Daisy Delilah Dolly Ella Ember Etta Georgia Ginger Goldie Gracie Hattie Hazel Honey Ivy Josie Juno Lacey Lady Layla Lottie Lucy Lulu Mabel Magnolia Maple Millie Missy Molly Nala Nellie Opal Penny Piper Polly Queenie Reba Rosie Roxy Sally Sassy Scarlett Shelby Stella Sugar Tessa Tilly Trixie Violet Willa Winnie Xena Zoey'.split(' ');
export const SECOND_M = 'Boone Jack Ray Lee Dale Joe Wayne Earl Bob Dean Cole Jay Roy Wade Clay Buck Cash Duke Jesse Luke Otis Tate Ty Beau Gene Rhett Troy Zeke Denton Laredo Pecos Brazos Sabine Caddo Creek Hollow Ridge River'.split(' ');
export const SECOND_F = 'Mae Lou Belle Jo Jean Anne June Lynn Rae Sue Kay Faye Dee Grace Rose Beth Jane Pearl Ruth Nell Ivy Leigh Fern Dawn Hope Skye Wren Georgia Savannah Magnolia Dixie Delta Bayou Sabine Creek Hollow River'.split(' ');
export const HANDLE_M = ["Ol'", 'Big', 'Lil', 'Mister', 'Sgt.', "Cap'n", 'Doc', 'Uncle', 'Bad', 'Wild', 'Slim', 'Tuff'];
export const HANDLE_F = ["Ol'", 'Big', 'Lil', 'Miss', 'Aunt', 'Lady', 'Sweet', 'Wild', 'Sister', 'Granny', 'Pretty', 'Queen'];

// Where dogs live. A place you own keeps this many; pups past the limit get
// sold to the neighbours. Country acreage holds a real kennel.
export const DOG_ROOM = { country: 30, land: 12, house: 6, apartment: 2 };
export const FEED_PER_DOG = 6;          // a day, out of the bank
export const VET_VISIT = 350;           // full health at the kennel or the phone app's mobile vet
export const VEST_PRICE = 450;          // a cut vest per catch dog, good for the life of the dog
export const COLLAR_PRICE = 900;        // GPS tracking collar: see every bay dog on the hunt map
export const LITTER_DAYS = 2;           // game days from breeding to pups
export const DAM_REST = 6;              // days before she can be bred again

// ---------------------------------------------------------------- hogs + the hunt
export const HOGS = {
  feral:   { name: 'Feral hog',          w: [60, 150],  mult: 1,   rar: 0, color: '#4a3c32', speed: 7 },
  razor:   { name: 'Razorback',          w: [120, 220], mult: 1.3, rar: 1, color: '#2e2622', speed: 8 },
  spotted: { name: 'Spotted boar',       w: [150, 260], mult: 1.8, rar: 2, color: '#6a4a36', spots: '#d8c8b0', speed: 7.5 },
  russian: { name: 'Russian-cross boar', w: [200, 350], mult: 2.4, rar: 3, color: '#3a3430', speed: 8.5 },
  ghost:   { name: 'Ghost boar',         w: [300, 460], mult: 5,   rar: 4, color: '#cfc8bc', speed: 9 },
};
// Hunting grounds in Johnson County. fee: the day lease. hogs: [kind, weight].
export const HUNT_GROUNDS = [
  { id: 'nolan',   name: 'Nolan River Bottoms',   fee: 0,    hogs: [['feral', 75], ['razor', 25]], count: 4, brush: 0.35, desc: 'Your lease off FM 4. Creek bottoms and wallows. Good for green dogs.' },
  { id: 'cedar',   name: 'Cross Timbers Cedar Breaks', fee: 600,  hogs: [['feral', 45], ['razor', 35], ['spotted', 20]], count: 5, brush: 0.5, tier: 2, desc: 'Post oak and cedar. Long runs; speed and stamina matter.' },
  { id: 'brazos',  name: 'Brazos River Thicket',  fee: 1500, hogs: [['razor', 35], ['spotted', 30], ['russian', 30], ['ghost', 5]], count: 5, brush: 0.65, tier: 3, desc: 'Heavy boars and the odd legend. Bring your best catch dogs.' },
  { id: 'chalk',   name: 'Chalk Mountain Ranch',  fee: 3500, hogs: [['spotted', 35], ['russian', 50], ['ghost', 15]], count: 6, brush: 0.75, tier: 4, desc: 'Brutal cover, trophy hogs. The ranch pays a bounty on every one.' },
];
export const GROUND_BY_ID = Object.fromEntries(HUNT_GROUNDS.map(g => [g.id, g]));
export const HOG_PER_LB = 2.5;          // what the processor in Joshua pays, before the trophy multiplier
export const HUNT_SECONDS = 240;        // real seconds on the clock; the hunt burns 4 game hours
export const HUNT_GAME_MIN = 240;
export const MAX_BAY = 3, MAX_CATCH = 2;
