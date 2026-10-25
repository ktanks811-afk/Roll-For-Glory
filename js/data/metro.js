// The big map: everything past the old edges of Texas, and the towns around
// Atlanta, LA and Miami. Fort Worth, Dallas, Denton, Weatherford, Mineral
// Wells, Johnson County and Brazos stay exactly where they were; this file
// adds new towns around them (each its own street grid), the highways that
// tie them together, and named countryside for the open ground in between.
//
// world2d/roads.js turns TOWNS and ROUTES into streets, world2d/metro.js
// builds the blocks and the country, data/world.js names the districts and
// adds the places (TOWN_PLACES). Positions are metres; -z is north. Every
// road is straight and runs east-west or north-south.
//
// No imports: data/world.js and data/states.js both read this file.

// The whole of Texas you can drive: walls go round this, nowhere else.
export const TEXAS = { x0: -10800, x1: 9200, z0: -10600, z1: 10100 };
export const inTexas = (x, z) => x > TEXAS.x0 && x < TEXAS.x1 && z > TEXAS.z0 && z < TEXAS.z1;

// A town: an nx-by-nz grid of `b`-metre blocks from (x0, z0). `ns` names
// the north-south streets west to east, `ew` the east-west streets north to
// south. `zones` are [i0, i1, j0, j1, district, style]; the first one a
// block falls in wins. Styles: res (houses), rich (big houses and pools),
// apts, mix (shops and offices), shop (strip centres), ind (warehouses),
// down (towers), square (an old courthouse-square downtown), park.
// `marks` are landmark blocks: [i0, i1, j0, j1, kind, label].
// No street runs through the middle of a landmark that covers more than one
// block. `hwy`: a street line that is a freeway instead ({ row } or { col },
// plus the road's name).
// A courthouse zone is a landmark too: the courthouse on its lawn, in the middle of the square.
const T = (id, name, x0, z0, nx, nz, ns, ew, zones, extra = {}) => ({ id, name, x0, z0, nx, nz, b: 150, x1: x0 + nx * 150, z1: z0 + nz * 150, ns, ew, zones, ...extra,
  marks: [...(extra.marks || []), ...zones.filter(z => z[5] === 'courthouse').map(z => [z[0], z[1], z[2], z[3], 'courthouse', `${name.toUpperCase()} COURTHOUSE`])] });

export const TOWNS = [
  // ---------------- Fort Worth's south and west: Burleson, Cleburne, Granbury, Azle ----------------
  T('burleson', 'Burleson', -1650, 2100, 8, 5,
    ['Hulen St', 'Wilshire Blvd', 'Johnson Ave', 'Warren St', 'Main St', 'Dobson St', 'Clark St', 'Mound St', 'Candler Dr'],
    ['Alsbury Blvd', 'Elk Dr', 'Ellison St', 'Renfro St', 'Hidden Creek Pkwy', 'Summercrest Blvd'],
    [[2, 4, 1, 3, 'Old Town Burleson', 'square'], [5, 7, 0, 4, 'Burleson', 'shop'], [0, 7, 0, 4, 'Burleson', 'res']],
    { marks: [[0, 1, 3, 4, 'field', 'BURLESON CENTENNIAL STADIUM']] }),
  T('cleburne', 'Cleburne', -2400, 4700, 5, 4,
    ['Nolan River Rd', 'Granbury St', 'Main St', 'Caddo St', 'Ridgeway Dr', 'Hwy 174'],
    ['Westhill Dr', 'Henderson St', 'Chambers St', 'Kilpatrick St', 'Ackerman St'],
    [[1, 3, 1, 2, 'Cleburne', 'square'], [0, 4, 0, 3, 'Cleburne', 'res']]),
  T('granbury', 'Granbury', -5550, 750, 8, 6,
    ['Lipan Hwy', 'Pearl St', 'Houston St', 'Crockett St', 'Morgan St', 'Travis St', 'Lake Granbury Dr', 'Harbor Lakes Dr', 'Fall Creek Hwy'],
    ['Waters Edge Dr', 'Pearl St', 'Bridge St', 'Pearl St', 'US-377', 'Paluxy Rd', 'Weatherford Hwy'],
    [[2, 4, 1, 3, 'Granbury Square', 'square'], [5, 7, 0, 5, 'Granbury', 'rich'], [0, 7, 0, 5, 'Granbury', 'res']],
    { marks: [[0, 1, 4, 5, 'field', 'HOOD COUNTY RODEO GROUNDS']] }),
  T('azle', 'Azle', -4950, -3750, 6, 5,
    ['Ash Creek Dr', 'Stewart St', 'Main St', 'Jackson St', 'Church St', 'Boyd Rd', 'Pyramid Dr'],
    ['Liberty School Rd', 'Southeast Pkwy', 'Main St', 'TX-199', 'Northwest Pkwy', 'Hilltop Dr'],
    [[2, 3, 1, 2, 'Azle', 'square'], [0, 5, 0, 4, 'Azle', 'res']]),
  T('stephenville', 'Stephenville', -9900, 1350, 6, 5,
    ['Graham St', 'Belknap St', 'Columbia St', 'Harbin Dr', 'Lillian St', 'Frey St', 'US-281'],
    ['Washington St', 'Long St', 'Tarleton St', 'College St', 'Vanderbilt St', 'Lingleville Rd'],
    [[1, 3, 0, 1, 'Tarleton State', 'campus'], [2, 4, 2, 3, 'Stephenville', 'square'], [0, 5, 0, 4, 'Stephenville', 'res']]),

  // ---------------- between Fort Worth and Dallas, and south of Dallas ----------------
  T('arlington', 'Arlington', 4050, 0, 9, 8,
    ['Bowen Rd', 'Fielder Rd', 'Davis Dr', 'Cooper St', 'Center St', 'Mesquite St', 'Collins St', 'Stadium Dr', 'Ballpark Way', 'Six Flags Dr'],
    ['Division St', 'Abram St', 'Park Row Dr', 'Pioneer Pkwy', 'Arkansas Ln', 'Mayfield Rd', 'Bardin Rd', 'Green Oaks Blvd', 'I-20 Frontage'],
    [[0, 4, 0, 3, 'Arlington', 'mix'], [5, 8, 4, 7, 'Pantego', 'res'], [0, 8, 4, 7, 'South Arlington', 'res'], [5, 8, 0, 3, 'Arlington', 'mix']],
    { marks: [[2, 3, 1, 2, 'campus', 'UT ARLINGTON'], [7, 8, 0, 1, 'coaster', 'SIX FLAGS OVER TEXAS'], [3, 4, 5, 6, 'mall', 'THE PARKS MALL']] }),
  T('grandprairie', 'Grand Prairie', 5700, 0, 8, 8,
    ['Belt Line Rd', 'Carrier Pkwy', 'Great Southwest Pkwy', 'Duncan Perry Rd', 'Robinson Rd', 'Main St', 'Cedar Ridge Dr', 'Hampton Rd', 'Westmoreland Rd'],
    ['Jefferson St', 'Main St', 'Marshall Dr', 'Wheatland Rd', 'Camp Wisdom Rd', 'Danieldale Rd', 'Wintergreen Rd', 'Pleasant Run Rd', 'I-20 Frontage'],
    [[0, 7, 0, 3, 'Grand Prairie', 'mix'], [0, 7, 4, 7, 'Duncanville', 'res']],
    { marks: [[1, 2, 1, 2, 'racetrack', 'LONE STAR PARK'], [5, 5, 2, 2, 'ind', null], [7, 7, 3, 5, 'dragstrip', 'YELLOW BELLY DRAG STRIP']] }),
  T('mansfield', 'Mansfield', 4200, 2100, 8, 6,
    ['Matlock Rd', 'Holland Rd', 'Walnut Creek Dr', 'Main St', 'Broad St', 'Wisteria St', 'Mitchell Rd', 'Day Miar Rd', 'Lone Star Rd'],
    ['Debbie Ln', 'Heritage Pkwy', 'Broad St', 'Mansfield Hwy', 'Main St', 'Country Club Dr', 'US-287 Frontage'],
    [[3, 5, 1, 3, 'Mansfield', 'square'], [0, 7, 0, 5, 'Mansfield', 'res']]),
  T('cedarhill', 'Cedar Hill', 6000, 1800, 12, 6,
    ['FM 1382', 'Joe Wilson Rd', 'Cedar Hill Rd', 'Clark Rd', 'Hampton Rd', 'Westmoreland Rd', 'Polk St', 'Cockrell Hill Rd', 'Bonnie View Rd', 'Lancaster Rd', 'Dallas Ave', 'Houston School Rd', 'Pleasant Run Rd'],
    ['Wintergreen Rd', 'Belt Line Rd', 'Pleasant Run Rd', 'Parkerville Rd', 'Bear Creek Rd', 'Beltline Spur', 'Ten Mile Rd'],
    [[0, 3, 0, 5, 'Cedar Hill', 'res'], [4, 7, 0, 5, 'DeSoto', 'res'], [8, 11, 0, 5, 'Lancaster', 'mix']],
    { marks: [[1, 2, 3, 4, 'park', 'CEDAR HILL STATE PARK'], [9, 10, 1, 2, 'airfield', 'LANCASTER AIRPORT']] }),
  T('waxahachie', 'Waxahachie', 6150, 4800, 8, 6,
    ['Grand Ave', 'Getzendaner St', 'Brown St', 'Rogers St', 'College St', 'Monroe St', 'Kaufman St', 'Ferris Ave', 'Howard Rd'],
    ['Marvin Ave', 'Main St', 'Franklin St', 'Jefferson St', 'Water St', 'Wyatt St', 'Brown Industrial Pkwy'],
    [[3, 4, 2, 3, 'Waxahachie Square', 'courthouse'], [2, 5, 1, 4, 'Waxahachie Square', 'square'], [0, 7, 0, 5, 'Waxahachie', 'res']]),
  T('ennis', 'Ennis', 8100, 3600, 5, 4,
    ['Kaufman St', 'Dallas St', 'Main St', 'Clay St', 'Ennis Ave', 'Lake Bardwell Dr'],
    ['Lampasas St', 'Knox St', 'Ennis Ave', 'Brown St', 'US-287 Frontage'],
    [[1, 3, 1, 2, 'Ennis', 'square'], [0, 4, 0, 3, 'Ennis', 'res']]),
  T('hillsboro', 'Hillsboro', 2400, 7200, 6, 5,
    ['Old Bynum Rd', 'Waco St', 'Covington St', 'Waco St', 'Corsicana St', 'Abbott Ave', 'Country Club Rd'],
    ['Franklin St', 'Elm St', 'Elm St', 'Walnut St', 'Hillsboro Outlet Dr', 'Old Brandon Rd'],
    [[2, 3, 1, 2, 'Hillsboro Square', 'courthouse'], [1, 4, 1, 3, 'Hillsboro', 'square'], [4, 5, 3, 4, 'Hillsboro', 'shop'], [0, 5, 0, 4, 'Hillsboro', 'res']]),
  T('alvarado', 'Alvarado', 1200, 4350, 8, 5,
    ['Parkway Dr', 'Baugh St', 'Parkway St', 'Fifth St', 'Fourth St', 'Third St', 'College St', 'Venus Rd', 'FM 157'],
    ['Lowell St', 'FM 4', 'Davis St', 'US-67', 'Ellis St', 'Mustang Dr'],
    [[1, 3, 1, 2, 'Alvarado', 'square'], [0, 3, 0, 4, 'Alvarado', 'res'], [4, 7, 0, 4, 'Venus', 'res']]),

  // ---------------- Dallas grows: east, north and the suburbs past them ----------------
  // East Dallas, Garland and Mesquite. Its west street line is Dallas's
  // Haskell Ave, and the row through the middle is I-30 on its way east.
  T('eastdallas', 'East Dallas', 6150, -2100, 14, 10,
    ['Haskell Ave', 'Peak St', 'Carroll Ave', 'Fitzhugh Ave', 'Munger Blvd', 'Buckner Blvd', 'Lawnview Ave', 'Jim Miller Rd', 'Saturn Rd', 'Galloway Ave', 'Town East Blvd', 'Belt Line Rd', 'Pioneer Rd', 'Lawson Rd', 'Rose Hill Rd'],
    ['Mockingbird Ln', 'Northwest Hwy', 'Garland Rd', 'Gaston Ave', 'Columbia Ave', 'I-30', 'Scyene Rd', 'Military Pkwy', 'Bruton Rd', 'Elam Rd', 'Lake June Rd'],
    [[1, 3, 0, 2, 'White Rock', 'rich'], [0, 4, 0, 9, 'East Dallas', 'res'], [5, 13, 0, 4, 'Garland', 'mix'], [5, 13, 5, 9, 'Mesquite', 'res']],
    { hwy: { row: 5, name: 'I-30' }, marks: [[9, 10, 2, 3, 'mall', 'TOWN EAST MALL'], [11, 12, 7, 8, 'arena', 'MESQUITE RODEO']] }),
  // North Dallas: Love Field, Preston Hollow, the Park Cities. Its bottom
  // street is Dallas's Lemmon Ave.
  T('northdallas', 'North Dallas', 4650, -3450, 14, 9,
    ['Harry Hines Blvd', 'Denton Dr', 'Lemmon Ave', 'Inwood Rd', 'Midway Rd', 'Preston Rd', 'Hillcrest Rd', 'Coit Rd', 'Greenville Ave', 'Abrams Rd', 'Skillman St', 'Jupiter Rd', 'Plano Rd', 'Audelia Rd', 'Ferguson Rd'],
    ['Forest Ln', 'Royal Ln', 'Walnut Hill Ln', 'Northwest Hwy', 'Lovers Ln', 'University Blvd', 'Mockingbird Ln', 'Knox St', 'Oak Lawn Ave', 'Lemmon Ave'],
    [[0, 2, 0, 8, 'Love Field', 'ind'], [3, 6, 0, 3, 'Preston Hollow', 'rich'], [3, 6, 4, 8, 'Highland Park', 'rich'], [11, 13, 0, 8, 'Lake Highlands', 'res'], [7, 10, 0, 8, 'North Dallas', 'mix']],
    { marks: [[0, 2, 2, 4, 'airfield', 'LOVE FIELD'], [7, 8, 3, 4, 'mall', 'NORTHPARK CENTER'], [5, 6, 6, 7, 'campus', 'SMU'], [9, 10, 0, 1, 'mall', 'GALLERIA DALLAS']] }),
  T('carrollton', 'Carrollton', 3600, -4650, 9, 6,
    ['Josey Ln', 'Old Denton Rd', 'Broadway St', 'Perry Rd', 'Webb Chapel Rd', 'Marsh Ln', 'Midway Rd', 'Addison Rd', 'Montfort Dr', 'Dallas Pkwy'],
    ['Trinity Mills Rd', 'Frankford Rd', 'Rosemeade Pkwy', 'Belt Line Rd', 'Valley View Ln', 'Spring Valley Rd', 'Alpha Rd'],
    [[1, 2, 2, 3, 'Old Downtown Carrollton', 'square'], [0, 4, 0, 5, 'Carrollton', 'res'], [5, 6, 0, 5, 'Farmers Branch', 'mix'], [7, 8, 0, 5, 'Addison', 'down']]),
  T('lewisville', 'Lewisville', 3450, -6600, 9, 10,
    ['Lakeside Pkwy', 'Garden Ridge Blvd', 'Morriss Rd', 'Long Prairie Rd', 'Valley Pkwy', 'Mill St', 'Kealy Ave', 'Edmonds Ln', 'Corporate Dr', 'Stemmons Fwy'],
    ['Cross Timbers Rd', 'Flower Mound Rd', 'Justin Rd', 'Waketon Rd', 'Fox Ave', 'Main St', 'College St', 'Purnell St', 'Round Grove Rd', 'Vista Ridge Mall Dr', 'Hebron Pkwy'],
    [[0, 8, 0, 4, 'Flower Mound', 'rich'], [3, 5, 5, 7, 'Old Town Lewisville', 'square'], [6, 8, 7, 9, 'Lewisville', 'shop'], [0, 8, 5, 9, 'Lewisville', 'res']],
    { marks: [[7, 8, 8, 9, 'mall', 'VISTA RIDGE MALL']] }),
  T('plano', 'Plano', 6000, -6300, 12, 8,
    ['Preston Rd', 'Ohio Dr', 'Coit Rd', 'Independence Pkwy', 'Custer Rd', 'Alma Dr', 'K Ave', 'Jupiter Rd', 'Shiloh Rd', 'Los Rios Blvd', 'Collin Creek Dr', 'Murphy Rd', 'US-75 Frontage'],
    ['Legacy Dr', 'Spring Creek Pkwy', 'Plano Pkwy', 'Park Blvd', 'Parker Rd', 'Arapaho Rd', 'Campbell Rd', 'Renner Rd', 'President George Bush Tpke'],
    [[0, 5, 0, 3, 'Legacy West', 'down'], [6, 8, 1, 3, 'Downtown Plano', 'square'], [0, 11, 0, 3, 'Plano', 'res'], [0, 11, 4, 7, 'Richardson', 'res']],
    { marks: [[2, 3, 4, 5, 'campus', 'UT DALLAS'], [9, 10, 5, 6, 'mall', 'COLLIN CREEK MALL']] }),
  T('frisco', 'Frisco', 5100, -8100, 8, 7,
    ['Teel Pkwy', 'Legacy Dr', 'Hillcrest Rd', 'Coit Rd', 'Dallas Pkwy', 'Parkwood Blvd', 'Ohio Dr', 'Preston Rd', 'Coleman Blvd'],
    ['Panther Creek Pkwy', 'Eldorado Pkwy', 'Main St', 'Lebanon Rd', 'Warren Pkwy', 'Stonebrook Pkwy', 'Gaylord Pkwy', 'Sam Rayburn Tollway'],
    [[3, 5, 3, 5, 'The Star', 'down'], [0, 7, 0, 6, 'Frisco', 'rich']],
    { marks: [[3, 4, 4, 5, 'stadium', 'THE STAR · FORD CENTER'], [6, 7, 1, 2, 'stadium', 'TOYOTA STADIUM'], [0, 1, 5, 6, 'mall', 'STONEBRIAR CENTRE']] }),
  T('mckinney', 'McKinney', 7650, -7800, 8, 6,
    ['Hardin Blvd', 'Lake Forest Dr', 'Wilson Creek Pkwy', 'Graves St', 'Tennessee St', 'Kentucky St', 'Chestnut St', 'McDonald St', 'US-75'],
    ['Eldorado Pkwy', 'Virginia Pkwy', 'Louisiana St', 'Virginia St', 'Davis St', 'Wilson Creek Rd', 'University Dr'],
    [[3, 5, 1, 3, 'Historic McKinney', 'square'], [0, 7, 0, 5, 'McKinney', 'res']]),

  // ---------------- up north and out west of Denton ----------------
  T('sanger', 'Sanger', -150, -9600, 6, 5,
    ['Bolivar St', 'I-35', '2nd St', 'Bolivar St', '5th St', '7th St', 'Lake Ray Roberts Rd'],
    ['FM 455', 'Chapman Dr', 'Bolivar St', 'FM 455', 'Willow St', 'Lois Rd'],
    [[2, 3, 1, 2, 'Sanger', 'square'], [0, 5, 0, 4, 'Sanger', 'res']]),
  T('decatur', 'Decatur', -3600, -6600, 7, 6,
    ['Thompson St', 'Trinity St', 'State St', 'Church St', 'Business 287', 'Walnut St', 'Halsell St', 'US-81'],
    ['Pilot St', 'Mulberry St', 'Main St', 'Walnut St', 'Hale St', 'Thompson St', 'Deer Park Rd'],
    [[2, 4, 1, 3, 'Decatur Square', 'courthouse'], [0, 6, 0, 5, 'Decatur', 'res']]),
];

// out of state: each city grows east and south of its grid (data/states.js).
// Miami's east side is Miami Beach, across Biscayne Bay on the causeways.
export const STATE_TOWNS = {
  ga: [
    T('ga_decatur', 'Decatur', 15500, -3000, 10, 8,
      ['Moreland Ave', 'Clifton Rd', 'Candler Rd', 'Church St', 'Commerce Dr', 'McDonough St', 'Columbia Dr', 'Kensington Rd', 'Memorial Dr', 'Stone Mountain Fwy', 'Hairston Rd'],
      ['North Druid Hills Rd', 'Ponce de Leon Ave', 'College Ave', 'Glenwood Rd', 'Memorial Dr', 'Covington Hwy', 'Wesley Chapel Rd', 'Panola Rd', 'Flat Shoals Pkwy'],
      [[1, 3, 0, 2, 'Decatur', 'square'], [0, 4, 0, 7, 'Decatur', 'res'], [5, 9, 0, 3, 'Stone Mountain', 'res'], [5, 9, 4, 7, 'Lithonia', 'res']],
      { state: 'ga', marks: [[7, 8, 1, 2, 'park', 'STONE MOUNTAIN PARK'], [2, 3, 5, 6, 'mall', 'SOUTH DEKALB MALL']] }),
    T('ga_eastpoint', 'East Point', 13850, -1500, 11, 4,
      ['Camp Creek Pkwy', 'Washington Rd', 'Main St', 'Cleveland Ave', 'Lakewood Ave', 'Jonesboro Rd', 'Moreland Ave', 'Bouldercrest Rd', 'Fayetteville Rd', 'Old Hapeville Rd', 'Sylvan Rd', 'Riverdale Rd'],
      ['Campbellton Rd', 'Headland Dr', 'Washington Rd', 'Virginia Ave', 'Sullivan Rd'],
      [[0, 4, 0, 3, 'East Point', 'res'], [5, 10, 0, 3, 'Hapeville', 'mix']], { state: 'ga' }),
  ],
  ca: [
    T('ca_eastla', 'East LA', 15500, 0, 10, 8,
      ['Mission Rd', 'Boyle Ave', 'Soto St', 'Lorena St', 'Indiana St', 'Eastern Ave', 'Atlantic Blvd', 'Garfield Ave', 'Rosemead Blvd', 'San Gabriel Blvd', 'Peck Rd'],
      ['Valley Blvd', 'Huntington Dr', 'Cesar Chavez Ave', 'Whittier Blvd', 'Olympic Blvd', 'Telegraph Rd', 'Slauson Ave', 'Florence Ave', 'Firestone Blvd'],
      [[0, 4, 0, 3, 'Boyle Heights', 'res'], [0, 4, 4, 7, 'East LA', 'res'], [5, 9, 0, 3, 'Montebello', 'mix'], [5, 9, 4, 7, 'Downey', 'res']],
      { state: 'ca', marks: [[1, 2, 5, 6, 'park', 'BELVEDERE PARK'], [6, 7, 1, 2, 'mall', 'MONTEBELLO TOWN CENTER']] }),
    T('ca_inglewood', 'Inglewood', 13850, 1500, 11, 4,
      ['Sepulveda Blvd', 'Aviation Blvd', 'La Brea Ave', 'Prairie Ave', 'Crenshaw Blvd', 'Van Ness Ave', 'Western Ave', 'Normandie Ave', 'Vermont Ave', 'Figueroa St', 'Avalon Blvd', 'Central Ave'],
      ['Manchester Blvd', 'Century Blvd', 'Imperial Hwy', 'El Segundo Blvd', 'Rosecrans Ave'],
      [[0, 5, 0, 3, 'Inglewood', 'res'], [6, 10, 0, 3, 'Watts', 'res']],
      { state: 'ca', marks: [[3, 4, 0, 1, 'stadium', 'SOFI STADIUM']] }),
  ],
  fl: [
    T('fl_beach', 'Miami Beach', 16050, 3000, 5, 8,
      ['Alton Rd', 'Meridian Ave', 'Washington Ave', 'Collins Ave', 'Ocean Dr', 'Ocean Terrace'],
      ['71st St', '63rd St', '41st St', 'Arthur Godfrey Rd', 'Dade Blvd', '17th St', 'Lincoln Rd', '5th St', 'South Pointe Dr'],
      [[0, 4, 0, 3, 'Mid-Beach', 'rich'], [0, 4, 4, 7, 'South Beach', 'mix']], { state: 'fl' }),
    T('fl_gables', 'Coral Gables', 13850, 4500, 10, 4,
      ['Red Rd', 'Granada Blvd', 'Le Jeune Rd', 'Ponce de Leon Blvd', 'Douglas Rd', 'SW 32nd Ave', 'SW 27th Ave', 'SW 22nd Ave', 'SW 17th Ave', 'SW 12th Ave', 'Brickell Ave'],
      ['Bird Rd', 'Miracle Mile', 'Sunset Dr', 'Kendall Dr', 'Dadeland Blvd'],
      [[0, 4, 0, 3, 'Coral Gables', 'rich'], [5, 9, 0, 3, 'Coconut Grove', 'res']],
      { state: 'fl', marks: [[1, 2, 1, 2, 'campus', 'UNIVERSITY OF MIAMI']] }),
  ],
};
export const ALL_TOWNS = [...TOWNS, ...Object.values(STATE_TOWNS).flat()];
export const TOWN_BY_ID = Object.fromEntries(ALL_TOWNS.map(t => [t.id, t]));

// Miami: Biscayne Bay between the city and the beach, the Atlantic past it.
export const MIAMI_BAY = { x0: 15520, x1: 15950 };
export const MIAMI_OCEAN = 17150;
export const CAUSEWAYS = [600, 1050];          // street lines (from the city's top) the causeways cross the bay on

// ---------------------------------------------------------------- highways and country roads
// kind: highway, pkwy (fast two-lane), farm, city. Points run end to end;
// every leg is straight east-west or north-south. Ends land on an existing
// street corner or on a road (roads.js splits it there), and every crossing
// with another road becomes an intersection.
const RT = (name, kind, pts) => ({ name, kind, pts });
export const ROUTES = [
  // Fort Worth's south and west
  RT('Renfro St', 'city', [[-450, 2550], [0, 2550]]),
  RT('US-67', 'pkwy', [[-1650, 5000], [-1500, 5000]]),
  RT('US-377', 'pkwy', [[-4950, -600], [-4950, 750]]),
  RT('US-377', 'pkwy', [[-5550, 1350], [-9000, 1350]]),
  RT('US-281', 'pkwy', [[-9000, 1100], [-9000, 1350]]),
  RT('TX-199', 'pkwy', [[-4050, -3300], [-3300, -3300], [-3300, -3900], [-1200, -3900]]),
  RT('FM 730', 'farm', [[-4650, -3000], [-4650, -2100]]),
  RT('FM 4', 'farm', [[700, 4500], [1200, 4500]]),
  RT('US-287', 'pkwy', [[2400, 4650], [4500, 4650], [4500, 3000]]),
  RT('US-287', 'pkwy', [[4800, 2100], [4800, 1350]]),
  RT('FM 916', 'farm', [[1850, 6100], [2550, 6100], [2550, 7200]]),
  // up north and out west
  RT('TX-114', 'pkwy', [[-1300, -4600], [-3150, -4600]]),
  RT('US-81', 'pkwy', [[-3150, -4600], [-3150, -5700]]),
  RT('US-380', 'pkwy', [[-2550, -6300], [-1000, -6300], [-1000, -6250], [0, -6250]]),
  RT('FM 51', 'farm', [[-3150, -6600], [-3150, -9000], [-150, -9000]]),
  RT('I-35', 'highway', [[0, -7550], [0, -8850]]),
  RT('US-380', 'pkwy', [[-3600, -6300], [-9800, -6300]]),
  RT('US-281', 'pkwy', [[-9000, -2250], [-9000, -6300]]),
  RT('US-67', 'pkwy', [[-9300, 2100], [-9300, 6100], [-3200, 6100]]),
  RT('FM 2481', 'farm', [[-4950, 1650], [-4950, 6100]]),
  // Dallas and the suburbs
  RT('Collins St', 'city', [[3800, -700], [3800, 0], [4050, 0]]),
  RT('Hampton Rd', 'city', [[4650, -600], [4650, 0]]),
  RT('Lancaster Rd', 'city', [[5100, -600], [5100, 0]]),
  RT('Westmoreland Rd', 'city', [[6000, -600], [6000, 0]]),
  RT('Camp Wisdom Rd', 'city', [[5400, 600], [5700, 600]]),
  RT('I-30', 'highway', [[8250, -1350], [9150, -1350]]),
  RT('I-35E', 'highway', [[5550, -600], [5550, 3900], [6750, 3900], [6750, 4800]]),
  RT('I-35E', 'highway', [[6750, 5700], [6750, 6300], [2850, 6300], [2850, 7200]]),
  RT('I-20', 'highway', [[4050, 1200], [4050, 1350], [9150, 1350]]),
  RT('I-45', 'highway', [[7200, -600], [7200, 1800]]),
  RT('I-45', 'highway', [[7200, 2700], [7200, 3600], [8100, 3600]]),
  RT('Belt Line Rd', 'city', [[5550, 2250], [6000, 2250]]),
  RT('Hampton Rd', 'city', [[6600, 1350], [6600, 1800]]),
  RT('US-287', 'pkwy', [[7350, 5100], [8400, 5100], [8400, 4200]]),
  RT('I-635', 'highway', [[8850, 1350], [8850, -3600], [3300, -3600]]),
  RT('SH-360', 'pkwy', [[3300, -1350], [3300, -4600]]),
  RT('TX-114', 'pkwy', [[3150, -4600], [3600, -4600]]),
  RT('International Pkwy', 'city', [[3300, -3000], [3650, -3000]]),
  RT('I-35E', 'highway', [[1200, -7000], [4650, -7000], [4650, -6600]]),
  RT('I-35E', 'highway', [[4650, -5100], [4650, -4650]]),
  RT('I-35E', 'highway', [[4650, -3750], [4650, -3450]]),
  RT('George Bush Tpke', 'highway', [[3450, -5100], [3450, -4950], [7950, -4950]]),
  RT('Dallas North Tollway', 'highway', [[5700, -3450], [5700, -7050]]),
  RT('Park Blvd', 'city', [[5700, -5700], [6000, -5700]]),
  RT('Spring Creek Pkwy', 'city', [[7800, -5700], [7950, -5700]]),
  RT('Sam Rayburn Tollway', 'pkwy', [[4800, -6150], [5700, -6150]]),
  RT('US-75', 'highway', [[7950, -2100], [7950, -6900]]),
  RT('US-380', 'pkwy', [[6300, -7500], [7650, -7500]]),
  RT('TX-22', 'pkwy', [[2850, 7950], [2850, 9900], [7650, 9900]]),
  RT('FM 933', 'farm', [[7650, 9900], [7650, 6300]]),
];
// out of state: how each new town ties into its city
export const STATE_ROUTES = {
  ga: [RT('Ponce de Leon Ave', 'city', [[15200, -2400], [15500, -2400]]), RT('Memorial Dr', 'city', [[15200, -1950], [15500, -1950]]),
    RT('Pryor Rd', 'city', [[14300, -1800], [14300, -1500]]), RT('Capitol Ave', 'city', [[14900, -1800], [14900, -1500]])],
  ca: [RT('Cesar Chavez Ave', 'city', [[15200, 600], [15500, 600]]), RT('Whittier Blvd', 'city', [[15200, 1050], [15500, 1050]]),
    RT('Normandie Ave', 'city', [[14300, 1200], [14300, 1500]]), RT('Avalon Blvd', 'city', [[14900, 1200], [14900, 1500]])],
  fl: [RT('MacArthur Causeway', 'pkwy', [[15200, 3600], [16050, 3600]]), RT('Julia Tuttle Causeway', 'pkwy', [[15200, 4050], [16050, 4050]]),
    RT('Douglas Rd', 'city', [[14300, 4200], [14300, 4500]]), RT('SW 17th Ave', 'city', [[14900, 4200], [14900, 4500]])],
  // Denver (city grid at 14000, 6000): I-70 east out of town on its second
  // street line and E-470 south past the grow farms (data/weed.js)
  co: [RT('I-70', 'pkwy', [[15200, 6150], [17500, 6150]]), RT('E-470', 'farm', [[16600, 6150], [16600, 7950]])],
};

// ---------------------------------------------------------------- lakes
// `gaps` are where a road crosses on a bridge: [x or z, half width, 'x'|'z'].
export const LAKES = [
  { name: 'Eagle Mountain Lake', x0: -3100, z0: -4450, x1: -2000, z1: -3980 },
  { name: 'Lake Granbury', x0: -6100, z0: 450, x1: -5700, z1: 2250, gaps: [[1350, 18, 'z']] },
  { name: 'Lake Whitney', x0: 1950, z0: 8500, x1: 2800, z1: 9800 },
  { name: 'Lake Ray Hubbard', x0: 8950, z0: -2700, x1: 9150, z1: -1650 },
  { name: 'Joe Pool Lake', x0: 5000, z0: 3150, x1: 5450, z1: 3700 },
  { name: 'Lake Ray Roberts', x0: 1200, z0: -10300, x1: 2600, z1: -9100 },
  { name: 'Possum Kingdom Lake', x0: -10400, z0: -4800, x1: -9200, z1: -3900 },
];

// DFW Airport: runways and terminals between the suburbs and Arlington
export const DFW = { x0: 3450, z0: -3420, x1: 4520, z1: -2650 };

// ---------------------------------------------------------------- the country
// Named ground for everything that used to be past the edge (first match
// wins; towns, lakes and DFW are checked before these). `look` is how
// world2d/metro.js fills it: farm (crops and farmsteads), ranch (pasture and
// mesquite), woods (post oak and cedar), hills (cedar breaks and rock).
export const COUNTRYSIDE = [
  { x0: 3300, z0: -10600, x1: 5500, z1: -4950, name: 'Denton County', look: 'farm' },
  { x0: 5500, z0: -10600, x1: 9200, z1: -4950, name: 'Collin County', look: 'farm' },
  { x0: 3300, z0: -4950, x1: 9200, z1: -2500, name: 'Dallas County', look: 'woods' },
  { x0: 6800, z0: -2500, x1: 9200, z1: -250, name: 'Kaufman County', look: 'farm' },
  { x0: 4010, z0: -250, x1: 9200, z1: 3300, name: 'Dallas County', look: 'ranch' },
  { x0: 3300, z0: 3300, x1: 9200, z1: 6000, name: 'Ellis County', look: 'farm' },
  { x0: 1900, z0: 5800, x1: 9200, z1: 10100, name: 'Hill County', look: 'ranch' },
  { x0: 1000, z0: 4100, x1: 3300, z1: 5800, name: 'Johnson County', look: 'farm' },
  { x0: -4000, z0: -7700, x1: -1400, z1: -3300, name: 'Wise County', look: 'ranch' },
  { x0: -4000, z0: -10600, x1: 3300, z1: -7700, name: 'Cooke County', look: 'farm' },
  { x0: -10800, z0: -10600, x1: -4000, z1: -5000, name: 'Jack County', look: 'hills' },
  { x0: -10800, z0: -5000, x1: -4000, z1: -2250, name: 'Parker County', look: 'woods' },
  { x0: -10800, z0: 450, x1: -7000, z1: 10100, name: 'Erath County', look: 'hills' },
  { x0: -7000, z0: 450, x1: -4000, z1: 10100, name: 'Hood County', look: 'ranch' },
  { x0: -4000, z0: -3300, x1: -3300, z1: 10100, name: 'Parker County', look: 'woods' },
];

// ---------------------------------------------------------------- lookups
export function townAt(x, z) {
  for (const t of ALL_TOWNS) if (x > t.x0 - 12 && x < t.x1 + 12 && z > t.z0 - 12 && z < t.z1 + 12) return t;
  return null;
}
export function townDistrict(t, x, z) {
  const i = Math.max(0, Math.min(t.nx - 1, Math.floor((x - t.x0) / t.b))), j = Math.max(0, Math.min(t.nz - 1, Math.floor((z - t.z0) / t.b)));
  for (const zn of t.zones) if (i >= zn[0] && i <= zn[1] && j >= zn[2] && j <= zn[3]) return zn[4];
  return t.name;
}
export function townStyle(t, i, j) {
  for (const zn of t.zones) if (i >= zn[0] && i <= zn[1] && j >= zn[2] && j <= zn[3]) return zn[5];
  return 'res';
}
const inR = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
// The name of a place on the big map, or null if (x, z) is somewhere older
// (data/world.js districtAt carries on from there).
export function metroDistrict(x, z) {
  const t = townAt(x, z);
  if (t) return townDistrict(t, x, z);
  if (x > 9500) return null;                      // out of state: the city's own districts
  for (const l of LAKES) if (inR(l, x, z)) return l.name;
  if (inR(DFW, x, z)) return 'DFW Airport';
  for (const c of COUNTRYSIDE) if (inR(c, x, z)) return c.name;
  return null;
}
export const METRO_DISTRICTS = [...new Set([...ALL_TOWNS.flatMap(t => [t.name, ...t.zones.map(z => z[4])]), ...LAKES.map(l => l.name), 'DFW Airport', ...COUNTRYSIDE.map(c => c.name)])];
// for the Map app: a label over each town and lake
export const MAP_LABELS = [...TOWNS.map(t => [t.name.toUpperCase(), (t.x0 + t.x1) / 2, t.z0 - 40]), ...LAKES.map(l => [l.name.toUpperCase(), (l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2]), ['DFW AIRPORT', (DFW.x0 + DFW.x1) / 2, DFW.z0 - 30]];
export const STATE_MAP_LABELS = Object.fromEntries(Object.entries(STATE_TOWNS).map(([st, list]) => [st, list.flatMap(t => [...new Set(t.zones.map(z => z[4]))].map(n => {
  const zs = t.zones.filter(z => z[4] === n), i = (Math.min(...zs.map(z => z[0])) + Math.max(...zs.map(z => z[1])) + 1) / 2, j = (Math.min(...zs.map(z => z[2])) + Math.max(...zs.map(z => z[3])) + 1) / 2;
  return [n.toUpperCase(), t.x0 + i * t.b, t.z0 + j * t.b];
}))]));
// which landmark (index into t.marks) covers block (i, j), or -1
export function townMark(t, i, j) {
  for (let k = 0; k < t.marks.length; k++) { const m = t.marks[k]; if (i >= m[0] && i <= m[1] && j >= m[2] && j <= m[3]) return k; }
  return -1;
}
export const townBlockCenter = (t, i, j) => ({ x: t.x0 + t.b / 2 + t.b * i, z: t.z0 + t.b / 2 + t.b * j });
