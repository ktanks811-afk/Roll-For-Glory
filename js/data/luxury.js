// Luxe: the high-end catalog for players with too much money. Watches,
// jewelry, designer, art, collectibles, toys for the house, and aircraft.
// Prices are rough 2025-26 retail. `keep` is what it resells for (share of
// what you paid) before the market moves; `vol` is how much that market
// swings week to week; art and rare collectibles drift upward over time
// (`grow`, per in-game week). `perk` items change how the game plays:
// core/luxury.js reads them. Rules: core/luxury.js; the store: ui/luxe.js.

const I = (cat, id, brand, name, price, extra = {}) => ({ cat, id, brand, name, price, keep: 0.5, vol: 0.05, grow: 0, ...extra });
const W = (id, brand, name, price, extra) => I('watch', id, brand, name, price, { keep: 0.92, vol: 0.06, grow: 0.004, ...extra });
const J = (id, brand, name, price, extra) => I('jewelry', id, brand, name, price, { keep: 0.6, vol: 0.04, ...extra });
const F = (id, brand, name, price, extra) => I('fashion', id, brand, name, price, { keep: 0.42, vol: 0.05, ...extra });
const A = (id, brand, name, price, extra) => I('art', id, brand, name, price, { keep: 0.8, vol: 0.12, grow: 0.012, ...extra });
const C = (id, brand, name, price, extra) => I('collect', id, brand, name, price, { keep: 0.85, vol: 0.18, grow: 0.008, ...extra });
const H = (id, brand, name, price, extra) => I('home', id, brand, name, price, { keep: 0.3, vol: 0.02, ...extra });
const P = (id, brand, name, price, extra) => I('air', id, brand, name, price, { keep: 0.72, vol: 0.03, ...extra });

export const LUX_CATS = [
  { id: 'watch', name: 'Watches', icon: '⌚' }, { id: 'jewelry', name: 'Jewelry', icon: '💎' }, { id: 'fashion', name: 'Designer', icon: '👜' },
  { id: 'art', name: 'Art', icon: '🖼' }, { id: 'collect', name: 'Collectibles', icon: '🃏' }, { id: 'home', name: 'Home & toys', icon: '🛋' },
  { id: 'air', name: 'Aircraft', icon: '🛩' },
];

export const LUX = [
  // ---------------- watches ----------------
  W('w_sub', 'Rolex', 'Submariner Date "Hulk"', 14500, { desc: 'Green dial, green bezel. The starter grail.' }),
  W('w_daytona', 'Rolex', 'Daytona Panda', 32000, { desc: 'Steel, white dial, black subdials. Waitlist five years deep.' }),
  W('w_gmt', 'Rolex', 'GMT-Master II "Pepsi"', 24000, { desc: 'Red and blue bezel, Jubilee bracelet.' }),
  W('w_presi', 'Rolex', 'Day-Date 40 Presidential, iced', 85000, { desc: 'Yellow gold, factory diamond bezel and dial.' }),
  W('w_ap', 'Audemars Piguet', 'Royal Oak 15510ST', 72000, { desc: 'Blue Grande Tapisserie dial. The rapper watch.' }),
  W('w_ap_iced', 'Audemars Piguet', 'Royal Oak Offshore, bust down', 165000, { desc: 'Every inch flooded. You can see it from the parking lot.' }),
  W('w_nautilus', 'Patek Philippe', 'Nautilus 5811/1G', 260000, { desc: 'White gold, blue dial. Patek doesn\'t sell these to just anybody.' }),
  W('w_rm', 'Richard Mille', 'RM 11-03 McLaren', 420000, { desc: 'Carbon TPT, flyback chrono. Weighs nothing, costs everything.' }),
  W('w_jacob', 'Jacob & Co.', 'Astronomia Sky', 650000, { desc: 'A spinning globe and a tourbillon under a sapphire dome.' }),
  W('w_billionaire', 'Jacob & Co.', 'Billionaire Timeless Treasure', 20000000, { keep: 0.8, desc: 'Yellow diamonds, 425 carats. One of one.' }),
  // ---------------- jewelry ----------------
  J('j_cuban', 'Custom', '14k Cuban link, 12 mm', 18000, { desc: 'Solid, not hollow. 300 grams.' }),
  J('j_cuban_iced', 'Custom', 'Iced Cuban, 20 mm, 60 ct', 145000, { desc: 'VVS stones all the way round. The clasp alone is a car payment.' }),
  J('j_tennis', 'Custom', 'Tennis chain, 25 ct', 38000, { desc: 'One row of round brilliants. Clean.' }),
  J('j_rope', 'Custom', '10k rope chain, 8 mm', 5200, { desc: 'Old school.' }),
  J('j_pendant', 'Custom', 'Custom crew pendant, iced', 95000, { desc: 'Your crew\'s logo in pavé diamonds with a sapphire outline.' }),
  J('j_texas', 'Custom', 'Lone Star pendant, VVS', 42000, { desc: 'The state of Texas, flooded, with a ruby on Fort Worth.' }),
  J('j_grill', 'Johnny Dang', 'Diamond grill, top and bottom', 28000, { desc: 'Houston\'s king of grills. Permanent smile.' }),
  J('j_studs', 'Custom', 'Diamond studs, 4 ct each', 52000, { desc: 'Both ears.' }),
  J('j_ring', 'Custom', 'Pinky ring, 7 ct emerald cut', 120000, { desc: 'Catches light from across the room.' }),
  J('j_bracelet', 'Cartier', 'Love bracelet, pavé', 72000, { desc: 'Screws on. Comes with its own little screwdriver.' }),
  J('j_champ', 'Custom', 'Championship ring', 24000, { desc: 'Says "Murda Worth Street Kings" on the side.' }),
  J('j_heart', 'Custom', '100 ct canary diamond', 3800000, { keep: 0.78, desc: 'A yellow diamond the size of a walnut. Comes with an armed courier.' }),
  // ---------------- designer ----------------
  F('f_birkin', 'Hermès', 'Birkin 30, Togo leather', 28000, { keep: 0.9, desc: 'The bag you can\'t just walk in and buy.' }),
  F('f_birkin_croc', 'Hermès', 'Himalaya Birkin, diamond hardware', 450000, { keep: 0.95, vol: 0.08, grow: 0.006, desc: 'Niloticus crocodile. Auction house money.' }),
  F('f_lv_trunk', 'Louis Vuitton', 'Monogram steamer trunk', 62000, { desc: 'Hand-built in Asnières. Holds a week of fits.' }),
  F('f_lv_fit', 'Louis Vuitton', 'Full runway fit', 14000, { desc: 'Jacket, pants, the shoes, the sunglasses.' }),
  F('f_chrome', 'Chrome Hearts', 'Leather jacket + cross hoodie', 9500, { desc: 'Silver crosses on everything.' }),
  F('f_gucci', 'Gucci', 'Monogram tracksuit and loafers', 6800, { desc: 'Courtside fit.' }),
  F('f_mink', 'Fendi', 'Full-length mink coat', 48000, { desc: 'It\'s 98 degrees in Fort Worth. Wear it anyway.' }),
  F('f_kiton', 'Kiton', 'Bespoke suit', 18000, { desc: 'Fifty hours of handwork in Naples.' }),
  F('f_lucchese', 'Lucchese', 'Exotic cowboy boots, ostrich', 3600, { desc: 'Made in El Paso.' }),
  F('f_stetson', 'Stetson', 'El Presidente 1000X beaver felt', 5000, { desc: 'The best hat in Texas.' }),
  // ---------------- art ----------------
  A('a_kaws', 'KAWS', 'Companion, 4 ft bronze', 180000, { desc: 'For the foyer.' }),
  A('a_banksy', 'Banksy', 'Girl with Balloon (signed print)', 650000, { desc: 'Authenticated by Pest Control.' }),
  A('a_warhol', 'Andy Warhol', 'Marilyn screenprint', 1100000, { desc: 'Pop art royalty.' }),
  A('a_basquiat', 'Jean-Michel Basquiat', 'Crown study on canvas', 8500000, { desc: 'Oilstick and acrylic. Museums want it.' }),
  A('a_koons', 'Jeff Koons', 'Balloon Dog (Magenta)', 15000000, { desc: 'Mirror-polished steel. You can see yourself in it.' }),
  A('a_texas', 'Local', 'Fort Worth Stockyards oil painting', 24000, { desc: 'A cattle drive at sunset by a Hell\'s Half Acre painter.' }),
  A('a_picasso', 'Pablo Picasso', 'Femme assise', 42000000, { desc: 'Comes on a private jet with two guards.' }),
  // ---------------- collectibles ----------------
  C('c_jordans', 'Nike', 'Air Jordan 1 "Chicago" 1985, deadstock', 38000, { desc: 'Original box. Never worn.' }),
  C('c_yeezy', 'Nike', 'Air Yeezy 2 "Red October"', 12000, { desc: 'Still in the bag.' }),
  C('c_charizard', 'Pokémon', '1st Edition Charizard, PSA 10', 420000, { desc: 'The holo that started it all.' }),
  C('c_mantle', 'Topps', '1952 Mickey Mantle, PSA 8', 1600000, { desc: 'The most famous card in sports.' }),
  C('c_mahomes', 'Panini', 'Mahomes rookie patch auto 1/1', 3800000, { desc: 'Kansas City by way of Tyler, Texas.' }),
  C('c_cowboys', 'Wilson', 'Signed 1993 Cowboys Super Bowl ball', 45000, { desc: 'Aikman, Emmitt, Irvin and the whole squad.' }),
  C('c_guitar', 'Fender', 'Stevie Ray Vaughan "Number One" replica, signed', 85000, { desc: 'Dallas blues legend.' }),
  C('c_moonrock', 'NASA', 'Apollo moon rock fragment (legal ones)', 900000, { desc: 'Comes with paperwork from Houston.' }),
  // ---------------- home and toys ----------------
  H('h_toilet', 'Custom', 'Solid gold toilet', 1200000, { keep: 0.85, desc: '18-karat. It works.' }),
  H('h_aquarium', 'Custom', 'Shark aquarium wall', 680000, { desc: 'Two blacktip reef sharks and a moray.' }),
  H('h_theater', 'Custom', 'IMAX home theater', 420000, { desc: 'Forty seats, laser projection, a candy counter.' }),
  H('h_bar', 'Custom', 'Onyx bar + 2,000-bottle wine cellar', 950000, { desc: 'Backlit onyx and Pappy on tap.' }),
  H('h_piano', 'Steinway', 'Crystal grand piano', 3200000, { desc: 'See-through. Plays itself too.' }),
  H('h_golfcart', 'Garia', 'Lifted golf cart, chrome rims', 48000, { desc: 'For the ranch.' }),
  H('h_bed', 'Hästens', 'Vividus bed', 450000, { desc: 'Horsehair, hand-stitched. You\'ll sleep like money.' }),
  H('h_tiger', 'Custom', 'Bronze life-size longhorn statue', 160000, { desc: 'For the gate.' }),
  H('h_court', 'Custom', 'Indoor basketball court', 1800000, { desc: 'Glass floor, your logo at center court.' }),
  H('h_chandelier', 'Baccarat', 'Crystal chandelier, 400 lights', 520000, { desc: 'Hung by a crane.' }),
  H('h_robot', 'Boston Dynamics', 'Robot dog', 75000, { desc: 'It opens doors. A little scary.' }),
  H('h_vending', 'Custom', 'Gold-plated Sprite and Takis vending machine', 22000, { desc: 'Free for guests.' }),
  // ---------------- aircraft ----------------
  P('p_r44', 'Robinson', 'R44 helicopter', 650000, { perk: 'heli', desc: 'Teleport anywhere in the state for free, in a third of the time.' }),
  P('p_aw139', 'Leonardo', 'AW139 VIP helicopter', 16000000, { perk: 'heli', desc: 'Leather cabin for eight. Free fast teleports, and it looks the part.' }),
  P('p_citation', 'Cessna', 'Citation Longitude jet', 30000000, { perk: 'jet', desc: 'Private jet: flights to Atlanta, LA and Miami are free and twice as fast.' }),
  P('p_g700', 'Gulfstream', 'G700', 78000000, { perk: 'jet', desc: 'Private jet with a bedroom and a shower. Free flights, twice as fast.' }),
  P('p_bbj', 'Boeing', 'BBJ 737 MAX VIP', 120000000, { perk: 'jet', desc: 'A flying mansion. Free flights, twice as fast, and your car rides free.' , carFree: true }),
];
export const LUX_BY_ID = Object.fromEntries(LUX.map(x => [x.id, x]));
