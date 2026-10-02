// PartsHub — the in-game online store. Real aftermarket brands and products
// at typical US street prices (2024-25). `stage` (1-4) is how hard the part
// pushes the car in the simulation; see FX in parts.js. `labor` is shop hours
// to install. `makes` restricts fitment to listed brands; `eng` to engines
// whose description matches.

const ICE_ONLY = new Set(['engine', 'turbo', 'supercharger', 'intake', 'exhaust', 'intercooler', 'fuel', 'transmission', 'clutch', 'nitrous', 'twostep']);
const S650 = ['ford_mustang_gt_s650_2024', 'ford_mustang_dark_horse_2024'];
const JDM = ['honda', 'acura', 'toyota', 'lexus', 'scion', 'nissan', 'infiniti', 'mazda', 'subaru', 'mitsubishi'];

const GM = ['chevrolet', 'gmc', 'cadillac', 'pontiac', 'buick'];
const FORD = ['ford', 'lincoln'];
const MOPAR = ['dodge', 'chrysler', 'ram', 'jeep'];
const DOMESTIC = [...GM, ...FORD, ...MOPAR];
const VAG = ['volkswagen', 'audi', 'porsche', 'lamborghini', 'bentley'];

let n = 0;
function cat(category, rows) {
  return rows.map(([brand, name, price, stage, labor, fit = {}]) => ({
    id: `${category}_${(n++).toString(36)}`, cat: category, brand, name, price, stage, labor, ...fit,
  }));
}

export const PERF_CATALOG = [
  // ---------------- Engine internals / valvetrain ----------------
  ...cat('engine', [
    ['COMP Cams', 'Stage 2 LS Truck Cam + Springs Kit', 780, 1, 10, { eng: /V8/, makes: GM }],
    ['COMP Cams', 'Thumpr Hydraulic Roller Cam', 420, 1, 9, { eng: /V8/ }],
    ['Brian Crower', 'Stage 2 Camshafts (pair)', 980, 1, 8],
    ['Skunk2', 'Pro Series Stage 2 Cams', 620, 1, 6, { makes: ['honda', 'acura'] }],
    ['Kelford Cams', '264° Drop-In Camshafts', 820, 1, 7, { makes: ['toyota', 'lexus', 'nissan', 'mitsubishi'] }],
    ['Tomei', 'Poncam Type-B', 860, 1, 6, { makes: ['nissan', 'toyota', 'mitsubishi', 'subaru'] }],
    ['Ford Performance', 'Coyote Cam Kit (Gen 3)', 1150, 1, 10, { makes: FORD, eng: /V8/ }],
    ['Texas Speed & Performance', 'Torquer V3 Cam Package', 1400, 1, 10, { makes: GM, eng: /V8/ }],
    ['Brian Tooley Racing', 'Stage 2 Truck Cam + Valvetrain Kit', 1250, 1, 10, { eng: /V8/, makes: GM }],
    ['Supertech', 'Valves, Springs & Retainers Kit', 1350, 2, 12],
    ['Trick Flow', 'GenX 255 Cylinder Heads (pair)', 3300, 2, 18, { eng: /V8/ }],
    ['Edelbrock', 'Victor Jr. CNC Heads (pair)', 3100, 2, 18, { eng: /V8/ }],
    ['Livernois Motorsports', 'Ported Coyote Heads (pair)', 4200, 2, 20, { makes: FORD, eng: /V8/ }],
    ['Kill Devil Hills Engineering', 'CNC Ported K24 Head', 2400, 2, 14, { makes: ['honda', 'acura'] }],
    ['ARP', 'Head Studs + Main Studs Kit', 650, 2, 8],
    ['Wiseco', 'Forged Pistons (set)', 950, 3, 24],
    ['JE Pistons', 'Ultra Series Forged Pistons', 1250, 3, 24],
    ['Manley', 'Forged Pistons + H-Beam Rods', 2450, 3, 28],
    ['CP-Carrillo', 'Pistons + Carrillo Rods Combo', 3100, 3, 28],
    ['Eagle', 'H-Beam Rods + Mahle Pistons', 1600, 3, 26],
    ['Darton', 'MID Sleeved Block', 4200, 3, 32, { makes: ['honda', 'acura', 'nissan', 'mitsubishi', 'subaru'] }],
    ['Callies', 'Dragonfly Stroker Crank Kit', 4900, 4, 36],
    ['Eagle', 'Rotating Assembly Stroker Kit', 2300, 4, 34],
    ['Darton', 'Sleeved Block + Billet Main Girdle', 6200, 4, 40, { makes: ['honda', 'acura', 'nissan', 'toyota', 'mitsubishi', 'subaru'] }],
    ['Livernois Motorsports', 'Built Short Block (1000+ hp)', 9800, 4, 30, { makes: FORD }],
    ['Texas Speed & Performance', 'Forged LS Short Block', 8900, 4, 30, { makes: GM, eng: /V8/ }],
    ['2J Racing', 'Billet 2JZ Built Long Block', 16500, 4, 30, { makes: ['toyota', 'lexus'] }],
    ['Cosworth', 'Built Long Block (pro build)', 14500, 4, 30],
    ['Hellcat Engines (Mopar Performance)', 'HEMI Built Short Block', 9200, 4, 30, { makes: MOPAR, eng: /HEMI/ }],
  ]),

  // ---------------- Turbochargers & turbo kits ----------------
  ...cat('turbo', [
    ['Mitsubishi Heavy Industries', 'TD05H-16G Turbo', 900, 1, 8],
    ['IHI', 'VF48 Turbo', 1200, 1, 8, { makes: ['subaru'] }],
    ['Garrett', 'PowerMax GT2860RS Upgrade', 1450, 1, 8],
    ['Pulsar Turbo Systems', 'PSR3582 Gen2 (budget)', 690, 2, 10],
    ['Garrett', 'G25-550 Turbo', 2280, 2, 10],
    ['Garrett', 'G25-660 Turbo', 2340, 2, 10],
    ['BorgWarner', 'EFR 6758 Turbo', 2400, 2, 10],
    ['Precision Turbo', 'Gen2 5558 Turbo', 1450, 2, 10],
    ['HKS', 'GTIII-RS Sports Turbine Kit', 2800, 2, 12, { makes: ['nissan', 'toyota', 'subaru', 'mazda'] }],
    ['GReddy', 'T518Z Bolt-On Turbo Kit', 2900, 2, 12, { makes: ['nissan', 'toyota', 'mazda', 'honda', 'subaru', 'scion'] }],
    ['Cobb Tuning', 'Big Turbo Kit (FA24 / EcoBoost)', 3300, 2, 12, { makes: ['subaru', 'ford', 'mazda', 'volkswagen'] }],
    ['Full-Race', 'Twin-Scroll Turbo Kit', 6500, 3, 18, { makes: ['ford', 'honda', 'acura', 'mitsubishi', 'nissan', 'bmw'] }],
    ['Garrett', 'GTX3076R Gen II Turbo', 2450, 3, 14],
    ['Garrett', 'G30-770 Turbo', 2610, 3, 14],
    ['Garrett', 'GTX3582R Gen II Turbo', 2620, 3, 14],
    ['BorgWarner', 'EFR 7163 Turbo', 2650, 3, 14],
    ['BorgWarner', 'EFR 8374 Turbo', 2950, 3, 14],
    ['BorgWarner', 'S366 SX-E Turbo (budget big single)', 890, 3, 14],
    ['Precision Turbo', 'Gen2 6266 Turbo', 1850, 3, 14],
    ['Precision Turbo', 'Gen2 6870 Turbo', 2050, 3, 14],
    ['Xona Rotor', 'XR 7064S Turbo', 2300, 3, 14],
    ['Tomei', 'ARMS MX8265 Turbo Kit', 2650, 3, 14, { makes: ['nissan', 'mitsubishi', 'subaru'] }],
    ['Speed Engineering', 'LS Single Turbo Kit', 3600, 3, 20, { makes: GM, eng: /V8/ }],
    ['On 3 Performance', 'Twin Turbo Kit', 6300, 3, 24, { eng: /V8/ }],
    ['Hellion Power Systems', 'Twin Turbo System', 9800, 4, 26, { eng: /V8|V6/, makes: [...DOMESTIC, 'nissan', 'toyota'] }],
    ['Garrett', 'G35-1050 Turbo', 2800, 4, 16],
    ['Garrett', 'G42-1200 Compact Turbo', 3350, 4, 18],
    ['Garrett', 'G42-1450 Turbo', 3520, 4, 18],
    ['BorgWarner', 'EFR 9180 Turbo', 3250, 4, 18],
    ['BorgWarner', 'S400SX-E 80mm Turbo', 1150, 4, 18],
    ['Precision Turbo', 'Next Gen 7685 Turbo', 2450, 4, 18],
    ['Precision Turbo', 'Next Gen 8685 Turbo', 3050, 4, 18],
    ['Ultimate Power Racing (UPR)', 'R35 GT-R Full-Race Turbo Kit', 11500, 4, 30, { makes: ['nissan'] }],
    ['AMS Performance', 'Alpha 12 Turbo Kit', 14800, 4, 34, { makes: ['nissan'] }],
  ]),

  // ---------------- Superchargers ----------------
  ...cat('supercharger', [
    ['Kraftwerks', 'Rotrex C30-94 Supercharger Kit', 5200, 1, 14, { makes: ['honda', 'acura', 'mazda', 'toyota', 'scion', 'subaru'] }],
    ['Jackson Racing', 'C38 Rotrex Supercharger Kit', 5900, 2, 14, { makes: ['honda', 'acura', 'mazda'] }],
    ['Harrop', 'TVS1900 Supercharger Kit', 6600, 2, 14, { makes: ['toyota', 'subaru', 'scion', 'mazda'] }],
    ['Edelbrock', 'E-Force Stage 1 Supercharger', 7200, 2, 16, { eng: /V8|V6/ }],
    ['ProCharger', 'P-1SC-1 HO Intercooled System', 7000, 2, 16],
    ['Vortech', 'V-3 Si Supercharger System', 6800, 2, 16],
    ['Paxton', 'NOVI 2200 Supercharger', 6500, 2, 16],
    ['Magnuson', 'TVS2650 Heartbeat Supercharger', 7800, 3, 18, { makes: [...GM, ...FORD, 'toyota', 'dodge', 'ram', 'jeep'] }],
    ['Roush', 'Phase 2 Supercharger Kit', 8100, 3, 18, { makes: FORD }],
    ['Whipple', 'Gen 5 3.0L Supercharger Kit', 9500, 3, 18, { makes: DOMESTIC, eng: /V8/ }],
    ['ProCharger', 'D-1X Intercooled System', 7900, 3, 18],
    ['Weiand', '6-71 Pro-Street Blower Kit', 3900, 3, 20, { eng: /V8/ }],
    ['Whipple', 'Gen 6 3.8L Supercharger Kit', 11200, 4, 20, { makes: DOMESTIC, eng: /V8/ }],
    ['ProCharger', 'F-1A-94 Race Kit', 9600, 4, 20],
    ['ProCharger', 'F-1X-12 Race Kit', 12200, 4, 22, { eng: /V8/ }],
    ['Littlefield Blowers', '8-71 Roots Blower (hood exit)', 9200, 4, 24, { eng: /V8/ }],
    ['Kong Performance', '3.0L Upper Pulley + Blower Kit', 4900, 3, 12, { makes: MOPAR, eng: /HEMI/ }],
  ]),

  // ---------------- Intake ----------------
  ...cat('intake', [
    ['Spectre', 'Air Intake Kit', 95, 1, 1],
    ['K&N', '69-Series Typhoon Cold Air Intake', 330, 1, 1.5],
    ['K&N', '63-Series AirCharger Intake', 390, 1, 1.5],
    ['AEM Induction', 'Cold Air Intake System', 340, 1, 1.5],
    ['AEM Induction', 'Brute Force Intake', 270, 1, 1.5],
    ['aFe Power', 'Momentum GT Pro 5R Intake', 420, 1, 1.5],
    ['aFe Power', 'Takeda Stage-2 Intake', 340, 1, 1.5],
    ['Injen', 'SP Short Ram Intake', 290, 1, 1.5],
    ['Airaid', 'MXP Series Cold Air Intake', 360, 1, 1.5],
    ['Volant', 'Closed Box Air Intake', 370, 1, 1.5],
    ['S&B Filters', 'Cold Air Intake', 380, 1, 1.5],
    ['Mishimoto', 'Performance Air Intake', 360, 1, 1.5],
    ['Roush', 'Cold Air Kit', 450, 1, 1.5, { makes: FORD }],
    ['Injen', 'Evolution Intake (sealed box)', 490, 2, 2],
    ['BMC', 'CDA Carbon Dynamic Airbox', 780, 2, 2],
    ['Eventuri', 'Carbon Fibre Intake System', 2450, 2, 2, { makes: ['bmw', 'audi', 'mercedes', 'porsche', 'volkswagen', 'toyota', 'nissan', 'honda', 'mclaren'] }],
    ['Skunk2', 'Ultra Race Intake Manifold', 680, 2, 5, { makes: ['honda', 'acura'] }],
    ['Edelbrock', 'Victor Jr. EFI Intake Manifold', 620, 2, 6, { eng: /V8/ }],
    ['BBK Performance', '90mm Throttle Body', 360, 2, 1.5, { makes: [...FORD, ...MOPAR] }],
    ['Nick Williams', '102mm Drive-By-Wire Throttle Body', 720, 3, 2, { makes: GM }],
    ['FAST', 'LSXR 102mm Intake Manifold', 1450, 3, 6, { makes: GM, eng: /V8/ }],
    ['Holley', 'Hi-Ram EFI Intake Manifold', 1650, 3, 7, { eng: /V8/ }],
    ['Ford Performance', 'Cobra Jet Intake Manifold', 1350, 3, 7, { makes: FORD, eng: /V8/ }],
    ['Jenvey', 'Individual Throttle Body Kit', 3900, 4, 12],
    ['AT Power', 'ITB Kit (K-Series)', 3500, 4, 12, { makes: ['honda', 'acura'] }],
    ['Toda Racing', 'Sports Injection ITB Kit', 5200, 4, 14, { makes: ['honda', 'toyota', 'nissan', 'mazda'] }],
  ]),

  // ---------------- Exhaust ----------------
  // `db` = how many decibels louder than a stock exhaust (stock cars sit well
  // under the 95 dB street limit). Long tubes + straight pipes are the loudest.
  ...cat('exhaust', [
    ['MBRP', 'Cat-Back Exhaust', 520, 1, 2, { db: 5 }],
    ['Gibson Performance', 'Cat-Back Exhaust', 470, 1, 2, { db: 4 }],
    ['Flowmaster', 'American Thunder Cat-Back', 820, 1, 2, { db: 9 }],
    ['MagnaFlow', 'Street Series Cat-Back', 920, 1, 2, { db: 4 }],
    ['Borla', 'S-Type Cat-Back', 1650, 1, 2, { db: 6 }],
    ['Corsa', 'Xtreme Cat-Back', 1900, 1, 2, { db: 8 }],
    ['Invidia', 'Q300 Cat-Back', 650, 1, 2, { db: 4 }],
    ['Invidia', 'N1 Racing Cat-Back', 560, 1, 2, { db: 7 }],
    ['HKS', 'Hi-Power Spec-L II', 1150, 1, 2, { db: 5 }],
    ['Milltek Sport', 'Cat-Back (non-resonated)', 1750, 1, 2, { db: 9 }],
    ['Remus', 'Axle-Back System', 1850, 1, 2, { db: 7 }],
    ['Tomei', 'Expreme Ti Titanium Cat-Back', 1350, 2, 2, { db: 8 }],
    ['Borla', 'ATAK Cat-Back', 1950, 2, 2, { db: 10 }],
    ['MagnaFlow', 'Muffler Delete Pipe (Straight-Through)', 180, 2, 1, { db: 15 }],
    ['Skunk2', 'Alpha Series Header (Stainless)', 560, 2, 3, { makes: ['honda', 'acura'], db: 10 }],
    ['Tomei', 'Expreme Unequal-Length Header', 690, 2, 4, { makes: ['subaru'], eng: /Flat-4/, db: 13 }],
    ['Kooks', '1-7/8" Long Tube Headers + Mid Pipe', 2050, 2, 8, { eng: /V8/, db: 16 }],
    ['American Racing Headers', 'Long Tube Headers + X-Pipe', 2150, 2, 8, { eng: /V8/, db: 17 }],
    ['Stainless Works', 'Headers + Cat-Back', 1650, 2, 8, { db: 12 }],
    ['Cobb Tuning', 'Catless Downpipe', 680, 2, 3, { asp: 'turbo', db: 10 }],
    ['Armytrix', 'Valvetronic Exhaust System', 3600, 2, 3, { db: 10 }],
    ['Capristo', 'Valved Sport Exhaust', 4600, 2, 3, { db: 10 }],
    ['Fi Exhaust', 'Frequency Intelligent Valvetronic', 5200, 2, 3, { db: 11 }],
    ['Akrapovič', 'Slip-On Line (Titanium)', 5600, 2, 2, { db: 9 }],
    ['MagnaFlow', 'Race Series Straight Pipe Kit', 780, 3, 3, { db: 19 }],
    ['Stillen', 'Long Tube Headers (VQ35/VQ37/VR30)', 1400, 3, 5, { makes: ['nissan', 'infiniti'], eng: /VQ|VR30/, db: 15 }],
    ['VRSF', 'Catless Downpipes + Straight Mid-Pipe', 1100, 3, 3, { makes: ['bmw'], asp: 'turbo', db: 17 }],
    ['Kooks', 'Long Tubes + Catless H-Pipe (Coyote)', 2300, 3, 8, { makes: FORD, eng: /Coyote|Predator/, db: 20 }],
    ['Kooks', 'Long Tubes + Catless X-Pipe (HEMI)', 2450, 3, 8, { makes: MOPAR, eng: /HEMI/, db: 21 }],
    ['Texas Speed & Performance', 'LS Long Tubes + Straight-Pipe X-Pipe', 2100, 3, 8, { makes: GM, eng: /V8/, db: 21 }],
    ['Kooks', 'Off-Road Long Tubes + Straight Pipes', 2600, 3, 9, { eng: /V8/, db: 24 }],
    ['HKS', 'Super Turbo Muffler Ti', 1900, 3, 2, { db: 9 }],
    ['Akrapovič', 'Evolution Line (Titanium)', 9800, 4, 4, { db: 12 }],
    ['Tomei', 'Expreme Ti Full Titanium Race', 2800, 4, 4, { db: 13 }],
    ['Burns Stainless', 'Custom Race Exhaust (fabricated)', 4200, 4, 10, { db: 18 }],
  ]),

  // ---------------- Intercoolers & charge cooling ----------------
  ...cat('intercooler', [
    ['Frozenboost', 'Bar & Plate Front Mount', 420, 1, 4],
    ['Treadstone', 'TR8C Intercooler Core', 470, 1, 4],
    ['Mishimoto', 'Performance Front Mount Intercooler', 780, 1, 4],
    ['Process West', 'Verticooler Front Mount', 1050, 2, 5],
    ['CSF', 'High-Performance Intercooler', 920, 2, 5],
    ['Wagner Tuning', 'Competition Intercooler EVO 2', 1150, 2, 5],
    ['ETS', 'Front Mount Intercooler Kit', 1250, 2, 5],
    ['AEM', 'Water/Methanol Injection Kit', 680, 3, 4],
    ['Snow Performance', 'Stage 3 Boost Cooler', 920, 3, 4],
    ['Garrett', 'Air/Air Core (1000 hp)', 760, 3, 6],
    ['Bell Intercoolers', 'Air-to-Water Core', 1150, 3, 8],
    ['Spearco', 'Air-to-Water Intercooler Kit', 1450, 3, 8],
    ['Garrett', 'Air/Air Race Core (2000 hp)', 1650, 4, 8],
    ['PWR Advanced Cooling', 'Race Intercooler', 2600, 4, 8],
  ]),

  // ---------------- Fuel system ----------------
  ...cat('fuel', [
    ['Walbro (TI Automotive)', 'F90000267 450 lph Pump', 145, 1, 3],
    ['DeatschWerks', 'DW300 Fuel Pump', 155, 1, 3],
    ['Bosch', 'EV14 Injectors (550cc)', 420, 1, 2],
    ['DeatschWerks', 'DW400 Pump + 1000cc Injectors', 690, 2, 4],
    ['Injector Dynamics', 'ID1050x Injectors', 790, 2, 3],
    ['Fuel Injector Clinic', 'FIC 1000cc Injectors', 660, 2, 3],
    ['Aeromotive', 'Phantom 450 Stealth Fuel System', 520, 2, 5],
    ['Radium Engineering', 'Fuel Rail + FPR Kit', 820, 3, 4],
    ['Injector Dynamics', 'ID1700x Injectors', 860, 3, 3],
    ['Aeromotive', 'A1000 Fuel System', 660, 3, 6],
    ['Fuelab', 'Brushless Pump Kit 41401', 760, 3, 6],
    ['Zeitronix', 'E85 Flex Fuel Kit', 460, 3, 3],
    ['Injector Dynamics', 'ID2600-XDS Injectors', 1080, 4, 4],
    ['Aeromotive', 'Eliminator Fuel System', 920, 4, 8],
    ['Fuelab', 'Prodigy Brushless Fuel Pump System', 1150, 4, 8],
    ['Waterman Racing', 'Methanol Conversion System', 3600, 4, 14],
  ]),

  // ---------------- Tuning / ECU ----------------
  ...cat('ecu', [
    ['Hypertech', 'Max Energy 2.0 Tuner', 420, 1, 0.5, { makes: DOMESTIC }],
    ['SCT Performance', 'X4 Power Flash Tuner', 470, 1, 0.5, { makes: [...FORD, ...GM, ...MOPAR] }],
    ['DiabloSport', 'Trinity 2 Platinum Tuner', 520, 1, 0.5, { makes: DOMESTIC }],
    ['Burger Motorsports', 'JB4 Piggyback Tuner', 560, 1, 1, { makes: ['bmw', 'mercedes', 'audi', 'volkswagen', 'kia', 'hyundai', 'genesis', 'toyota', 'infiniti', 'mini'] }],
    ['Hondata', 'FlashPro', 695, 2, 1, { makes: ['honda', 'acura'] }],
    ['Cobb Tuning', 'Accessport V3 + Stage 2 Map', 680, 2, 1, { makes: ['subaru', 'ford', 'mazda', 'volkswagen', 'porsche', 'nissan', 'mitsubishi', 'audi'] }],
    ['HP Tuners', 'MPVI3 + Custom Tune', 790, 2, 2, { makes: [...DOMESTIC, 'nissan', 'infiniti', 'kia', 'hyundai', 'bmw'] }],
    ['bootmod3', 'Flash Tune (OTS Stage 2)', 620, 2, 1, { makes: ['bmw', 'toyota', 'mini'] }],
    ['APR', 'ECU Upgrade Stage 2', 720, 2, 1, { makes: VAG }],
    ['Unitronic', 'Stage 2 ECU Software', 660, 2, 1, { makes: ['volkswagen', 'audi'] }],
    ['Tactrix', 'OpenPort 2.0 + EcuFlash Pro Tune', 520, 2, 2, { makes: ['subaru', 'mitsubishi'] }],
    ['Ingenext', 'Boost Performance Software', 1700, 2, 1, { makes: ['tesla'] }],
    ['EcuTek', 'RaceROM + Pro Dyno Tune', 1250, 3, 4, { makes: ['nissan', 'infiniti', 'subaru', 'toyota', 'mazda', 'kia', 'hyundai', 'bmw', 'scion'] }],
    ['Hondata', 'KPro V4 + Dyno Tune', 1150, 3, 4, { makes: ['honda', 'acura'] }],
    ['Holley', 'Terminator X Max EFI', 1550, 3, 8, { eng: /V8/ }],
    ['Lund Racing', 'Custom Dyno Tune', 900, 3, 4, { makes: [...FORD, ...GM, ...MOPAR] }],
    ['Haltech', 'Elite 2500 Standalone ECU', 2900, 4, 12],
    ['AEM Electronics', 'Infinity 506 Standalone', 2100, 4, 12],
    ['Link Engine Management', 'G4X Fury Standalone', 1950, 4, 12],
    ['Holley', 'Dominator EFI', 2850, 4, 12],
    ['Syvecs', 'S7 Plus Standalone', 5100, 4, 14],
    ['MoTeC', 'M150 ECU + Pro Tune', 6800, 4, 16],
  ]),

  // ---------------- Transmission ----------------
  ...cat('transmission', [
    ['Kartboy', 'Short Shifter', 290, 1, 2],
    ['B&M', 'Ripper Shifter', 320, 1, 2],
    ['Hurst', 'Billet Plus Short Throw Shifter', 460, 1, 2],
    ['MGW', 'Short Throw Shifter', 670, 1, 2],
    ['Circle D Specialties', 'Billet Torque Converter', 1550, 2, 8],
    ['Tremec', 'T-56 Magnum 6-Speed (swap)', 3700, 2, 16],
    ['TCI Automotive', 'StreetFighter 4L80E (built)', 4600, 2, 14],
    ['Dodson Motorsport', 'DCT Clutch Pack Upgrade', 6100, 3, 20, { makes: ['nissan'] }],
    ['RPM Transmissions', 'Stage 4 Built 8HP/10R80', 6500, 3, 14],
    ['Liberty\'s Gears', 'Pro-Shift Gearbox Conversion', 2600, 3, 14],
    ['Quaife', 'Sequential Gearbox', 13200, 3, 24],
    ['ATI Performance', 'TH400 + Transbrake (drag)', 3900, 3, 14],
    ['Hughes Performance', 'Powerglide + Transbrake', 4200, 3, 14],
    ['PPG', 'Sequential Gearset', 18200, 4, 26],
    ['Samsonas', 'Sequential Gearbox', 20500, 4, 26],
    ['Holinger', 'RD6 Sequential Transaxle', 25500, 4, 30],
    ['Rossler', 'TH400 Pro Mod Transbrake', 7200, 4, 16],
  ]),

  // ---------------- Clutch ----------------
  ...cat('clutch', [
    ['Exedy', 'Stage 1 Organic Clutch', 460, 1, 6],
    ['Sachs', 'SRE Performance Clutch', 920, 1, 6],
    ['Exedy', 'Stage 2 Cerametallic', 610, 2, 6],
    ['ACT', 'Heavy Duty Performance Street', 660, 2, 6],
    ['Spec Clutch', 'Stage 3+ Clutch', 720, 3, 6],
    ['Competition Clutch', 'Stage 4 Six-Puck', 690, 3, 6],
    ['ACT', '6-Puck Sprung Race Disc', 820, 3, 6],
    ['South Bend Clutch', 'Stage 3 Endurance', 960, 3, 6],
    ['McLeod', 'RXT Twin Disc', 1750, 3, 7],
    ['Clutch Masters', 'FX850 Twin Disc', 2300, 4, 7],
    ['Mantic', 'Twin Plate Clutch', 1850, 4, 7],
    ['OS Giken', 'TS2CD Twin Plate', 2650, 4, 7],
    ['Tilton', 'Triple Disc Carbon Clutch', 3900, 4, 8],
  ]),

  // ---------------- Differential / rear end ----------------
  ...cat('diff', [
    ['Torsen', 'T-2R Helical LSD', 1150, 1, 8],
    ['Ford Performance', 'Torsen Differential', 720, 1, 8, { makes: FORD }],
    ['Eaton', 'Detroit Truetrac', 650, 2, 8],
    ['Quaife', 'ATB Helical LSD', 1350, 2, 8],
    ['Wavetrac', 'ATB Differential', 1200, 2, 8],
    ['Kaaz', '1.5-Way Super Q LSD', 1650, 2, 8],
    ['Cusco', 'Type RS LSD', 1350, 2, 8],
    ['OS Giken', 'Super Lock LSD', 2350, 3, 8],
    ['Eaton', 'Detroit Locker', 720, 3, 8],
    ['Strange Engineering', 'Ford 9" Spool + 40-Spline Axles', 2850, 4, 14],
    ['Moser Engineering', 'GM 12-Bolt Rear End', 3300, 4, 16],
    ['Currie Enterprises', '9" Complete Rear End', 3850, 4, 16],
  ]),

  // ---------------- Suspension ----------------
  ...cat('suspension', [
    ['Eibach', 'Pro-Kit Lowering Springs', 330, 1, 4],
    ['H&R', 'Sport Springs', 360, 1, 4],
    ['Tein', 'S.Tech Springs', 290, 1, 4],
    ['Bilstein', 'B8 Performance Plus Shocks', 920, 1, 4],
    ['Koni', 'Sport Adjustable Shocks', 950, 1, 4],
    ['BC Racing', 'BR Series Coilovers', 1195, 2, 5],
    ['Tein', 'Flex Z Coilovers', 1060, 2, 5],
    ['Fortune Auto', '500 Series Coilovers', 1750, 2, 5],
    ['KW', 'Variant 3 Coilovers', 3050, 2, 5],
    ['Air Lift Performance', '3P Air Suspension', 3300, 2, 10],
    ['AccuAir', 'e-Level+ Air Management', 2950, 2, 10],
    ['Bilstein', 'Clubsport Coilovers', 3350, 3, 5],
    ['Öhlins', 'Road & Track Coilovers', 3550, 3, 5],
    ['KW', 'Clubsport 3-Way', 5600, 3, 6],
    ['QA1', 'Pro-Coil Double Adjustable', 2250, 3, 6],
    ['BMR Suspension', 'Drag Race Package', 1850, 3, 8],
    ['UMI Performance', 'Drag Race Suspension Kit', 1650, 3, 8],
    ['Viking Performance', 'Crusader Double-Adjustable Drag Shocks', 1450, 3, 5],
    ['Strange Engineering', 'S5.0 Drag Struts', 1250, 3, 5],
    ['Menscer Motorsports', 'Double Adjustable Drag Shocks', 2850, 4, 6],
    ['Santhuff', 'Drag Race Struts + Shocks', 1500, 4, 6],
    ['Penske Racing Shocks', '8760 Triple Adjustable', 9200, 4, 8],
    ['Öhlins', 'TTX Pro Coilovers', 10200, 4, 8],
    ['Moton', 'Club Sport 2-Way', 8100, 4, 8],
  ]),

  // ---------------- Brakes ----------------
  ...cat('brakes', [
    ['Hawk Performance', 'HPS 5.0 Pads', 150, 1, 1.5],
    ['EBC Brakes', 'Yellowstuff Pads', 165, 1, 1.5],
    ['Ferodo', 'DS2500 Pads', 270, 1, 1.5],
    ['Project Mu', 'Club Racer Pads', 260, 1, 1.5],
    ['Endless', 'MX72 Pads', 360, 1, 1.5],
    ['Power Stop', 'Z23 Evolution Sport Kit', 390, 1, 2.5],
    ['Girodisc', '2-Piece Rotors', 1150, 2, 3],
    ['StopTech', 'ST-40 Big Brake Kit', 2150, 2, 4],
    ['Wilwood', 'Forged Superlite 6R Big Brake Kit', 2650, 2, 4],
    ['Baer', 'Extreme+ Big Brake Kit', 3850, 3, 4],
    ['Brembo', 'GT Big Brake Kit (6-piston)', 4250, 3, 4],
    ['AP Racing', 'Radi-CAL Competition Kit', 5600, 3, 4],
    ['Alcon', 'Advantage Big Brake Kit', 5850, 3, 4],
    ['Brembo', 'GT-R CCM-R Carbon Ceramic Kit', 14200, 4, 5],
  ]),

  // ---------------- Tires (priced per set of four, mounted) ----------------
  ...cat('tires', [
    ['Achilles', 'ATR Sport 2', 420, 1, 1],
    ['Federal', '595 RS-R', 560, 1, 1],
    ['Kumho', 'Ecsta PS91', 820, 1, 1],
    ['Falken', 'Azenis FK510', 880, 1, 1],
    ['Continental', 'ExtremeContact DWS06 Plus', 920, 1, 1],
    ['Bridgestone', 'Potenza Sport', 1320, 1, 1],
    ['Michelin', 'Pilot Sport 4S', 1460, 1, 1],
    ['Pirelli', 'P Zero (PZ4)', 1520, 1, 1],
    ['Goodyear', 'Eagle F1 Supercar 3', 1640, 1, 1],
    ['Nankang', 'NS-2R (180TW)', 580, 2, 1],
    ['Toyo', 'Proxes R888R', 1150, 2, 1],
    ['Bridgestone', 'Potenza RE-71RS', 1240, 2, 1],
    ['Yokohama', 'Advan A052', 1420, 2, 1],
    ['Michelin', 'Pilot Sport Cup 2', 1950, 2, 1],
    ['Nitto', 'NT555RII Drag Radial', 1160, 3, 1],
    ['Mickey Thompson', 'ET Street SS', 1020, 3, 1],
    ['Mickey Thompson', 'ET Street R', 1320, 3, 1],
    ['Toyo', 'Proxes TQ Drag Radial', 960, 3, 1],
    ['BFGoodrich', 'g-Force Drag Radial', 1020, 3, 1],
    ['M&H Racemaster', 'Drag Radial', 1220, 3, 1],
    ['Hoosier', 'Drag Radial', 1260, 3, 1],
    ['Mickey Thompson', 'ET Drag Slicks', 1420, 4, 1],
    ['Hoosier', 'Quick Time Pro D.O.T.', 1330, 4, 1],
    ['M&H Racemaster', 'Drag Slicks', 1360, 4, 1],
    ['Hoosier', 'R7 Road Race', 1640, 4, 1],
    ['Goodyear', 'Eagle Racing Slicks', 1550, 4, 1],
  ]),

  // ---------------- Weight reduction ----------------
  ...cat('weight', [
    ['Odyssey', 'PC680 Lightweight Battery', 210, 1, 0.5],
    ['Braille', 'B2015 Lithium Battery', 390, 1, 0.5],
    ['(DIY)', 'Pull Spare, Jack & Rear Seats', 0, 1, 2],
    ['Seibon', 'Carbon Fiber Hood', 1350, 2, 2],
    ['Anderson Composites', 'Carbon Fiber Hood', 1050, 2, 2],
    ['APR Performance', 'Carbon Fiber Trunk', 950, 2, 2],
    ['Sparco', 'Sprint Bucket Seats (pair)', 1650, 2, 4],
    ['Recaro', 'Pole Position Seats (pair)', 3250, 2, 4],
    ['Bride', 'Zeta IV Seats (pair)', 3450, 2, 4],
    ['Lexan (SABIC)', 'Polycarbonate Windows', 720, 3, 6],
    ['Anderson Composites', 'Carbon Fiber Doors', 3100, 3, 6],
    ['Seibon', 'Carbon Fiber Roof Skin', 1850, 3, 8],
    ['Weld Racing', 'Lightweight Drag Brake + Hub Kit', 1350, 3, 4],
    ['Seibon', 'Full Carbon Body Panel Package', 14200, 4, 30],
    ['Chris Alston\'s Chassisworks', 'Tube Chassis Conversion', 26000, 4, 120],
  ]),

  // ---------------- Nitrous ----------------
  ...cat('nitrous', [
    ['NOS (Holley)', 'Powershot Wet Kit', 570, 1, 4],
    ['ZEX', 'EFI Wet Nitrous Kit', 610, 1, 4],
    ['Nitrous Express', 'Wet EFI Kit (35-150 hp)', 690, 1, 4],
    ['Edelbrock', 'Victor Series EFI Nitrous', 820, 2, 5],
    ['ZEX', 'Perimeter Plate System', 870, 2, 5, { eng: /V8/ }],
    ['Nitrous Outlet', 'Hardline Single Fogger (100-250)', 760, 2, 5],
    ['NOS (Holley)', 'Cheater Plate System', 1020, 3, 6, { eng: /V8/ }],
    ['NOS (Holley)', 'Big Shot Plate', 1120, 3, 6, { eng: /V8/ }],
    ['Nitrous Express', 'Direct Port 8-Cylinder', 1950, 3, 10],
    ['Nitrous Outlet', 'Direct Port System', 2250, 4, 12],
    ['Nitrous Express', 'Pro Race Fogger System', 3550, 4, 12],
  ]),

  // ---------------- 2-Step launch control ----------------
  // Hold gas + brake: the engine sits on a launch rev limiter. Each limiter
  // cut can throw flames out the exhaust. Higher stages hold the rpm tighter
  // and burn bigger. Old cars take an ignition box; newer ones take an ECU map.
  ...cat('twostep', [
    ['MSD', 'Soft Touch Rev Controller (8728)', 150, 1, 2, { maxYear: 2008 }],
    ['MSD', '6AL-2 Ignition w/ 2-Step Rev Limiter', 340, 1, 3, { maxYear: 2008 }],
    ['DragonFire Racing', 'Plug & Play 2-Step Launch Module', 160, 1, 2, { makes: JDM, maxYear: 2015 }],
    ['MSD', 'Digital-6 Plus (6425) w/ 2-Step', 540, 2, 4, { maxYear: 2008 }],
    ['MSD', '7AL-3 Programmable Ignition w/ 2-Step', 620, 2, 4, { maxYear: 2008 }],
    ['Cobb Tuning', 'Accessport Launch Control + Flat-Foot Shift Map', 450, 2, 1, { makes: ['subaru', 'ford', 'mazda', 'volkswagen', 'porsche', 'nissan', 'mitsubishi', 'audi'], minYear: 2002 }],
    ['HP Tuners', 'Custom 2-Step / Launch Control Tune', 520, 2, 2, { makes: [...DOMESTIC, 'nissan', 'infiniti', 'kia', 'hyundai', 'genesis', 'mitsubishi', 'subaru'], minYear: 2003 }],
    ['SCT Performance', 'X4 Launch Control Tune', 480, 2, 1, { makes: DOMESTIC, minYear: 2003 }],
    ['Hondata', 'FlashPro 2-Step Launch Control Unlock', 200, 2, 1, { makes: ['honda', 'acura'], minYear: 2001 }],
    ['bootmod3', 'Launch Control & Burble Map', 250, 2, 1, { makes: ['bmw', 'toyota', 'mini'], minYear: 2008 }],
    ['APR', 'Launch Control ECU Add-On', 230, 2, 1, { makes: VAG, minYear: 2005 }],
    ['EcuTek', 'Launch Control Map', 350, 2, 2, { makes: ['nissan', 'infiniti', 'subaru', 'toyota', 'lexus', 'mazda', 'scion', 'kia', 'hyundai', 'genesis', 'bmw'], minYear: 2005 }],
    ['MSD', 'Power Grid Ignition System (7730) w/ 2-Step', 1050, 3, 8, { maxYear: 2014 }],
    ['Holley', 'HP EFI 2-Step & Flame Package', 1350, 3, 8],
    ['Haltech', 'Elite 1500 + 2-Step & Flame Pack', 1250, 3, 8],
    ['AEM', 'Infinity 2-Step & Launch Strategy Pack', 1450, 3, 8],
    ['FuelTech', 'FT450 w/ 2-Step & Flame Mode', 1690, 3, 8],
    ['Link Engine Management', 'G4X Xtreme 2-Step & Flame Strategy', 1890, 3, 8],
    ['FuelTech', 'FT600 Pro — 2-Step, Anti-Lag & Flame Mode', 2990, 4, 12],
    ['Haltech', 'Nexus R5 Race — Launch & Flame Pack', 3300, 4, 12],
    ['Syvecs', 'S6Plus Race ECU — Launch & Flame Strategy', 3800, 4, 12],
    ['MoTeC', 'M130 + Launch & Flame Strategy License', 4200, 4, 12],
    ['Holley', 'Dominator EFI — 2-Step, Rolling Anti-Lag & Flames', 2990, 4, 12],
  ]),
];

// ---------------- Visual / cosmetic products ----------------
const vis = (slot, rows) => rows.map(([brand, name, price, value, extra = {}]) => ({
  id: `vis_${(n++).toString(36)}`, cat: slot, brand, name, price, value, visual: true, labor: extra.labor ?? 1, ...extra,
}));

export const VISUAL_CATALOG = [
  ...vis('wheels', [
    ['Konig', 'Dial In 18" (set)', 820, 'five', { color: '#5b5f66' }],
    ['Cragar', 'SS Super Sport 17" (set)', 720, 'dish', { color: '#c0c4c8' }],
    ['American Racing', 'Torq Thrust II 17" (set)', 920, 'five', { color: '#c0c4c8' }],
    ['Race Star', 'Drag Star 17" (set)', 940, 'five', { color: '#c0c4c8' }],
    ['Center Line', 'Convo Pro 17" (set)', 1150, 'mesh', { color: '#c0c4c8' }],
    ['Enkei', 'RPF1 17" (set)', 1150, 'split', { color: '#c0c4c8' }],
    ['Fifteen52', 'Tarmac 18" (set)', 1250, 'turbine', { color: '#1a1a1a' }],
    ['Method Race Wheels', 'MR305 NV 20" (set)', 1250, 'six', { color: '#1a1a1a' }],
    ['Fuel Off-Road', 'Rebel 20" (set)', 1450, 'six', { color: '#1a1a1a' }],
    ['OZ Racing', 'Ultraleggera 18" (set)', 1450, 'mesh', { color: '#1a1a1a' }],
    ['Bogart Racing', 'D10 Drag 17" (set)', 1650, 'mesh', { color: '#c0c4c8' }],
    ['Ferrada', 'FR4 20" (set)', 1750, 'turbine', { color: '#c9a24a' }],
    ['Rotiform', 'BLQ 19" (set)', 1850, 'mesh', { color: '#c0c4c8' }],
    ['Weld Racing', 'Ventura Drag 17" (set)', 1850, 'five', { color: '#c0c4c8' }],
    ['Weld Racing', 'RT-S S71 18" (set)', 2150, 'six', { color: '#1a1a1a' }],
    ['Vossen', 'HF-5 20" (set)', 2250, 'split', { color: '#5b5f66' }],
    ['Belak Industries', 'Series 2 Drag 18" (set)', 2650, 'mesh', { color: '#1a1a1a' }],
    ['Advan Racing', 'RG-D2 18" (set)', 2850, 'six', { color: '#1a1a1a' }],
    ['Volk Racing (RAYS)', 'TE37 Saga 18" (set)', 3050, 'six', { color: '#c9a24a' }],
    ['BBS', 'CH-R 19" (set)', 3250, 'mesh', { color: '#c0c4c8' }],
    ['Work Wheels', 'Meister S1 18" (set)', 3250, 'dish', { color: '#c0c4c8' }],
    ['Volk Racing (RAYS)', 'CE28N 18" (set)', 3450, 'split', { color: '#1a1a1a' }],
    ['HRE', 'FF04 Flow Form 20" (set)', 3650, 'split', { color: '#5b5f66' }],
    ['BBS', 'LM 19" (set)', 4450, 'mesh', { color: '#c9a24a' }],
    ['Forgeline', 'GA3R 19" (set)', 5600, 'six', { color: '#1a1a1a' }],
    ['HRE', 'P101 Forged 20" (set)', 8100, 'split', { color: '#5b5f66' }],
  ]),
  ...vis('paint', [
    ['Maaco', 'Single-Stage Respray (gloss)', 1200, 'gloss'],
    ['PPG', 'Basecoat/Clearcoat Respray (gloss)', 4600, 'gloss', { labor: 24 }],
    ['Axalta', 'Metallic Respray', 5600, 'metallic', { labor: 28 }],
    ['House of Kolor', 'Kandy Pearl Respray', 9200, 'pearl', { labor: 36 }],
    ['3M', '2080 Vinyl Wrap (gloss)', 3300, 'gloss', { labor: 16 }],
    ['Avery Dennison', 'SW900 Satin/Matte Wrap', 3100, 'matte', { labor: 16 }],
    ['XPEL', 'Stealth Matte PPF (full body)', 7200, 'matte', { labor: 24 }],
    ['Avery Dennison', 'Conform Chrome Wrap', 6600, 'chrome', { labor: 20 }],
  ]),
  ...vis('tint', [
    ['Generic', 'Dyed Window Film', 160, 'light'],
    ['LLumar', 'CTX Ceramic Tint', 420, 'medium'],
    ['XPEL', 'Prime XR Plus Ceramic', 520, 'medium'],
    ['3M', 'Crystalline (limo rear)', 640, 'limo'],
    ['(Remove)', 'Strip Window Tint', 120, 'none'],
  ]),
  ...vis('spoiler', [
    ['Seibon', 'Carbon Trunk Lip', 360, 'lip', { design: 0 }],
    ['Duraflex', 'Ducktail Spoiler', 290, 'duck', { design: 1 }],
    ['APR Performance', 'GTC-300 Adjustable Wing', 1850, 'gt', { design: 3 }],
    ['Voltex', 'Type 7 Swan Neck Wing', 2750, 'gt', { design: 2 }],
    ['Wicker Bill Drag Spoiler', 'Drag Spoiler + Wicker', 420, 'drag', { design: 2 }],
    ['(Remove)', 'Delete Spoiler', 80, 'none'],
  ]),
  ...vis('kit', [
    ['Duraflex', 'Street Body Kit', 950, 'street', { labor: 10 }],
    ['Varis', 'Arising Body Kit', 6100, 'street', { labor: 16 }],
    ['Rocket Bunny (TRA Kyoto)', 'Widebody Kit', 5900, 'wide', { labor: 30 }],
    ['Pandem', 'Widebody Kit', 6600, 'wide', { labor: 30 }],
    ['Liberty Walk', 'LB-Works Widebody', 15200, 'wide', { labor: 40 }],
  ]),
  ...vis('frontBumper', [
    ['Seibon', 'OEM-Style Carbon Front Lip', 520, 'sport', { design: 1 }],
    ['Maxton Design', 'Front Splitter V2', 380, 'sport', { design: 2 }],
    ['APR Performance', 'Carbon Front Wind Splitter', 1150, 'splitter', { design: 2 }],
  ]),
  ...vis('rearBumper', [
    ['Maxton Design', 'Rear Side Splitters', 320, 'sport', { design: 1 }],
    ['Voltex', 'Carbon Rear Diffuser', 1450, 'diffuser', { design: 2 }],
    ['Ford Performance', 'Track Rear Valance', 760, 'sport', { models: S650, design: 3 }],
    ['Anderson Composites', 'Carbon Rear Valance', 1480, 'diffuser', { models: S650, design: 3 }],
  ]),
  ...vis('skirts', [
    ['Maxton Design', 'Side Skirt Diffusers', 360, 'sport', { design: 0 }],
    ['APR Performance', 'Carbon Side Rocker Extensions', 1050, 'aero', { design: 1 }],
    ['Ford Performance', 'Track Pack Side Skirts', 540, 'aero', { models: S650, design: 2 }],
    ['Anderson Composites', 'Carbon Rocker Panels', 980, 'aero', { models: S650, design: 3 }],
  ]),
  ...vis('hood', [
    ['Cervini\'s', 'Cowl Induction Hood', 1250, 'cowl', { labor: 3, design: 1 }],
    ['Ford Performance', 'Shaker-Style Scoop Hood', 2600, 'scoop', { labor: 3, design: 2 }],
    ['Anderson Composites', 'Carbon Vented Hood', 1150, 'vented', { labor: 3, design: 2 }],
    ['Vorsteiner', 'Carbon Vented Hood', 2100, 'vented', { labor: 3, design: 2 }],
  ]),
  ...vis('exhaustTips', [
    ['Borla', 'Dual Polished Tips', 260, 'dual', { design: 0 }],
    ['MagnaFlow', 'Quad Tip Kit', 460, 'quad', { design: 1 }],
    ['HKS', 'Cannon Tip Muffler', 620, 'cannon', { design: 3 }],
    ['Corsa', 'Pro-Series Blue Titanium Tips', 540, 'dual', { models: S650, design: 2 }],
  ]),
  ...vis('headlights', [
    ['Philips', 'Xenon HID Conversion', 320, 'xenon', { design: 1 }],
    ['Morimoto', 'XB LED Headlights', 1350, 'led', { design: 3 }],
    ['Diode Dynamics', 'SS3 Selective Yellow', 360, 'yellow', { design: 5 }],
    ['Spyder Auto', 'Sequential LED DRL Headlights', 640, 'led', { models: S650, design: 0 }],
    ['Raxiom', 'Switchback Headlights', 780, 'led', { models: S650, design: 2 }],
    ['Anzo', 'Projector Headlights', 560, 'xenon', { models: S650, design: 4 }],
  ]),
  ...vis('taillights', [
    ['Spec-D', 'Smoked Tail Lights', 220, 'smoked', { design: 1 }],
    ['Morimoto', 'XB LED Tail Light Bar', 920, 'bar', { design: 2 }],
    ['Raxiom', 'Sequential Tail Lights', 590, 'bar', { models: S650, design: 0 }],
  ]),
  ...vis('decal', [
    ['3M', 'Racing Stripes Kit', 480, 'stripes'],
    ['3M', 'Side Stripe Graphics', 380, 'side'],
    ['Avery Dennison', 'Race Number Roundels', 320, 'number'],
    ['House of Kolor', 'Hand-Painted Flames', 1900, 'flames'],
    ['Avery Dennison', 'Crew Livery Wrap', 900, 'crew'],
    ['(Remove)', 'Remove Graphics', 150, 'none'],
  ]),
  ...vis('neon', [
    ['Oracle Lighting', 'ColorSHIFT Underbody (Red)', 360, '#ff1a2e'],
    ['Oracle Lighting', 'ColorSHIFT Underbody (Blue)', 360, '#1a9bff'],
    ['XKGlow', 'Underglow Kit (Purple)', 260, '#a01aff'],
    ['XKGlow', 'Underglow Kit (Green)', 260, '#1aff6a'],
    ['XKGlow', 'Underglow Kit (White)', 260, '#ffffff'],
    ['(Remove)', 'Remove Underglow', 60, 'none'],
  ]),
  ...vis('interior', [
    ['Katzkin', 'Leather Interior (Red)', 1850, '#7a1212', { labor: 6 }],
    ['Katzkin', 'Leather Interior (Tan)', 1850, '#a8875a', { labor: 6 }],
    ['Katzkin', 'Leather Interior (White)', 1950, '#d9d9d9', { labor: 6 }],
    ['Alcantara (OEM+)', 'Navy Alcantara Interior', 2400, '#1d2a44', { labor: 8 }],
    ['Katzkin', 'Leather Interior (Black)', 1750, '#111111', { labor: 6 }],
  ]),

  // ---- 2024+ Mustang GT / Dark Horse: parts with their own side/front/rear/top pictures ----
  ...vis('mirrors', [
    ['Ford Performance', 'Gloss Black Mirror Caps', 240, 'm0', { models: S650, design: 0 }],
    ['Anderson Composites', 'Carbon Fiber Mirror Covers', 420, 'm1', { models: S650, design: 1 }],
    ['APR Performance', 'Carbon Mirror Housings', 560, 'm2', { models: S650, design: 2 }],
    ['Morimoto', 'Blade Signal Mirror Set', 480, 'm3', { models: S650, design: 3 }],
    ['Ford Performance', 'Race Red Mirror Caps', 260, 'm4', { models: S650, design: 4 }],
  ]),
  ...vis('handles', [
    ['Ford Performance', 'Black Door Handle Covers', 120, 'h0', { models: S650, design: 0 }],
    ['Spec-D', 'Smoked Handle Inserts', 90, 'h1', { models: S650, design: 1 }],
    ['Oracle Lighting', 'Chrome Door Handle Covers', 110, 'h2', { models: S650, design: 2 }],
    ['Anderson Composites', 'Carbon Handle Overlays', 160, 'h3', { models: S650, design: 3 }],
  ]),
  ...vis('emblem', [
    ['Ford Performance', '5.0 Fender Badge (White)', 60, 'e0', { models: S650, design: 0 }],
    ['Ford Performance', '5.0 Fender Badge (Race Red)', 60, 'e1', { models: S650, design: 1 }],
    ['Ford', 'Running Pony Emblem (Chrome)', 80, 'e2', { models: S650, design: 2 }],
    ['Ford Performance', 'Running Pony Emblem (White)', 80, 'e3', { models: S650, design: 3 }],
    ['Ford', 'GT Fender Badge (Smoked)', 70, 'e4', { models: S650, design: 4 }],
    ['Ford', 'GT Fender Badge (Chrome)', 70, 'e5', { models: S650, design: 5 }],
  ]),
  ...vis('roof', [
    ['Ford Performance', 'Painted Roof Skin', 420, 'r0', { models: S650, design: 0, labor: 3 }],
    ['Anderson Composites', 'Carbon Roof Insert (Vented)', 1250, 'r1', { models: S650, design: 1, labor: 4 }],
    ['APR Performance', 'Carbon Fiber Weave Roof', 2100, 'r2', { models: S650, design: 2, labor: 5 }],
  ]),
  ...vis('trunk', [
    ['Ford Performance', 'Trunk Lid Panel', 480, 't0', { models: S650, design: 0, labor: 2 }],
    ['Anderson Composites', 'Carbon Trunk Lid', 1450, 't1', { models: S650, design: 1, labor: 3 }],
    ['APR Performance', 'Carbon Rear Deck (Badge Delete)', 1750, 't2', { models: S650, design: 2, labor: 3 }],
  ]),
  ...vis('grille', [
    ['Ford Performance', 'Pony Mesh Grille', 340, 'g0', { models: S650, design: 0 }],
    ['Ford Performance', 'Dark Horse Grille', 420, 'g1', { models: S650, design: 1 }],
    ['Roush', 'Honeycomb Grille', 480, 'g2', { models: S650, design: 2 }],
    ['Anderson Composites', 'Carbon Fiber Grille', 760, 'g3', { models: S650, design: 3 }],
  ]),
  ...vis('plate', [
    ['Ford Performance', 'Frame + Clean White Plate', 70, 'p0', { models: S650, design: 0 }],
    ['Cervini\'s', 'Blackout Frame + Plate', 90, 'p1', { models: S650, design: 1 }],
    ['Lone Star Customs', 'Texas Star Plate Set', 110, 'p2', { models: S650, design: 2 }],
  ]),
];

// Every wheel gets one of the nine wheel pictures (round-robin per style, bronze for gold).
{
  const WHEEL_DESIGNS = { five: [1, 0, 6], dish: [7, 5], mesh: [8, 5, 3], split: [1, 4, 2], turbine: [0, 2], six: [4, 6, 3] };
  const rr = {};
  for (const it of VISUAL_CATALOG) if (it.cat === 'wheels' && it.design == null) {
    const list = WHEEL_DESIGNS[it.value] || [4]; rr[it.value] = (rr[it.value] ?? -1) + 1;
    it.design = it.color === '#c9a24a' ? 2 : list[rr[it.value] % list.length];
  }
}

export const CATALOG = [...PERF_CATALOG, ...VISUAL_CATALOG];
export const ITEM_BY_ID = Object.fromEntries(CATALOG.map(p => [p.id, p]));
export const BRANDS = [...new Set(CATALOG.map(p => p.brand))].filter(b => !b.startsWith('(')).sort();

export const CATEGORY_NAMES = {
  engine: 'Engine Internals', turbo: 'Turbochargers & Kits', supercharger: 'Superchargers', intake: 'Intake',
  exhaust: 'Exhaust', intercooler: 'Intercoolers & Water/Meth', fuel: 'Fuel System', ecu: 'Tuning & ECUs',
  transmission: 'Transmission', clutch: 'Clutch', diff: 'Differential & Rear End', suspension: 'Suspension',
  brakes: 'Brakes', tires: 'Tires', weight: 'Weight Reduction & Seats', nitrous: 'Nitrous', twostep: '2-Step Launch Control',
  wheels: 'Wheels', paint: 'Paint, Wraps & PPF', tint: 'Window Tint', spoiler: 'Wings & Spoilers', kit: 'Body Kits',
  frontBumper: 'Front Lips & Splitters', rearBumper: 'Rear Diffusers', skirts: 'Side Skirts', hood: 'Hoods',
  exhaustTips: 'Exhaust Tips', headlights: 'Headlights', taillights: 'Tail Lights', decal: 'Graphics & Stripes',
  neon: 'Underglow', interior: 'Interior',
  mirrors: 'Mirrors', handles: 'Door Handles', emblem: 'Badges & Emblems', roof: 'Roof Panels', trunk: 'Trunk Lids', grille: 'Grilles', plate: 'License Plates',
};

export const LABOR_RATE = 125;   // $/hour at a shop
export const SALES_TAX = 0.0725;

// Does a product fit this car?
export function fits(item, model) {
  if (item.models && !item.models.includes(model.id)) return false;
  if (item.makes && !item.makes.includes(model.make)) return false;
  if (item.eng && !item.eng.test(model.engine)) return false;
  if (item.asp && item.asp !== model.asp) return false;
  if (item.maxYear && model.years[1] > item.maxYear) return false;
  if (item.minYear && model.years[1] < item.minYear) return false;
  if (model.asp === 'ev' && ICE_ONLY.has(item.cat)) return false;
  if (model.asp === 'ev' && item.cat === 'ecu' && !(item.makes || []).includes(model.make)) return false;
  return true;
}

export function fitNote(item, model) {
  if (fits(item, model)) return null;
  if (item.models && !item.models.includes(model.id)) return 'Made for the 2024+ Mustang GT / Dark Horse';
  if (model.asp === 'ev' && ICE_ONLY.has(item.cat)) return 'Electric car — no engine to fit this to';
  if (item.makes && !item.makes.includes(model.make)) return 'Not made for this make';
  if (item.eng) return 'Wrong engine type';
  if (item.maxYear && model.years[1] > item.maxYear) return 'Needs an older ignition system — this car is ECU-controlled';
  if (item.minYear && model.years[1] < item.minYear) return 'Needs a newer, ECU-flashable car';
  if (item.asp) return 'Turbo cars only';
  return 'Does not fit';
}

export function shippingFor(subtotal, items) {
  if (subtotal >= 1500) return 0;
  const heavy = items.some(i => ['transmission', 'engine', 'diff', 'tires', 'wheels', 'kit'].includes(i.cat));
  return heavy ? 89 : subtotal > 0 ? 14.99 : 0;
}

// Big or freight items take longer to arrive.
export function deliveryDays(items) {
  return items.some(i => ['transmission', 'engine', 'diff', 'kit', 'supercharger'].includes(i.cat) || i.price > 5000) ? 3 : 1;
}
