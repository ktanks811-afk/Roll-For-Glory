// Real-world vehicle catalog. Figures are factory numbers (hp, lb-ft, curb
// weight in kg) for the listed trim; prices are US MSRP for the final model
// year listed. Cars that have become collectible carry `market`: what clean
// examples actually sell for today, which the used market prices from.
//
// Gearing and final drive are derived from each car's power and drag so the
// simulated top speed and acceleration land near the real figures.

export const CURRENT_YEAR = 2026;

export const MAKES = {
  acura: 'Acura', alfaromeo: 'Alfa Romeo', astonmartin: 'Aston Martin', audi: 'Audi', bentley: 'Bentley',
  bmw: 'BMW', bugatti: 'Bugatti', buick: 'Buick', cadillac: 'Cadillac', chevrolet: 'Chevrolet',
  chrysler: 'Chrysler', dodge: 'Dodge', ferrari: 'Ferrari', ford: 'Ford', genesis: 'Genesis', gmc: 'GMC',
  honda: 'Honda', hyundai: 'Hyundai', infiniti: 'Infiniti', jaguar: 'Jaguar', jeep: 'Jeep', kia: 'Kia',
  koenigsegg: 'Koenigsegg', lamborghini: 'Lamborghini', landrover: 'Land Rover', lexus: 'Lexus',
  lincoln: 'Lincoln', lotus: 'Lotus', lucid: 'Lucid', maserati: 'Maserati', mazda: 'Mazda', mclaren: 'McLaren',
  mercedes: 'Mercedes-Benz', mini: 'MINI', mitsubishi: 'Mitsubishi', nissan: 'Nissan', pagani: 'Pagani',
  pontiac: 'Pontiac', porsche: 'Porsche', ram: 'Ram', rivian: 'Rivian', rollsroyce: 'Rolls-Royce',
  scion: 'Scion', subaru: 'Subaru', tesla: 'Tesla', toyota: 'Toyota', volkswagen: 'Volkswagen', volvo: 'Volvo',
};

export const CLASSES = ['Sedan', 'Tuner', 'JDM', 'Muscle', 'European', 'Truck', 'SUV', 'Exotic', 'Supercar'];

const GEARS = {
  '4MT': [2.52, 1.88, 1.46, 1.0],
  '5MT': [3.35, 1.95, 1.36, 1.03, 0.81],
  '6MT': [3.10, 2.05, 1.49, 1.16, 0.92, 0.74],
  '7MT': [3.0, 2.1, 1.5, 1.15, 0.95, 0.80, 0.63],
  '4AT': [2.84, 1.55, 1.0, 0.7],
  '5AT': [3.59, 2.19, 1.41, 1.0, 0.83],
  '6AT': [4.03, 2.36, 1.53, 1.15, 0.85, 0.67],
  '7AT': [4.38, 2.86, 1.92, 1.37, 1.0, 0.82, 0.73],
  '8AT': [4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84, 0.67],
  '9AT': [5.35, 3.24, 2.25, 1.64, 1.21, 1.0, 0.86, 0.72, 0.60],
  '10AT': [4.70, 2.99, 2.15, 1.80, 1.52, 1.28, 1.0, 0.85, 0.69, 0.64],
  'CVT': [2.4, 1.6, 1.2, 0.95, 0.75, 0.55],
  '6DCT': [4.06, 2.30, 1.59, 1.25, 1.0, 0.80],
  '7DCT': [3.91, 2.29, 1.58, 1.18, 0.94, 0.79, 0.67],
  '8DCT': [3.6, 2.5, 1.9, 1.5, 1.2, 1.0, 0.84, 0.67],
  '9DCT': [3.70, 2.66, 1.97, 1.53, 1.24, 1.00, 0.84, 0.72, 0.62],
  '1EV': [1],
  '2EV': [1.6, 1],
};

const TRANS_NAME = {
  MT: 'manual', AT: 'automatic', DCT: 'dual-clutch', CVT: 'CVT', EV: 'single-speed',
};
function transName(code) {
  if (code === 'CVT') return 'CVT';
  if (code === '1EV') return 'Single-speed direct drive';
  if (code === '2EV') return '2-speed EV gearbox';
  const n = parseInt(code, 10);
  const kind = code.replace(/^\d+/, '');
  return `${n}-speed ${TRANS_NAME[kind]}`;
}

const BODY_AERO = {
  hatch: [0.32, 2.1], sedan: [0.30, 2.25], coupe: [0.31, 2.05], muscle: [0.36, 2.2], truck: [0.45, 3.3],
  suv: [0.37, 2.9], exotic: [0.32, 2.0], super: [0.33, 1.95], wagon: [0.31, 2.3],
};
export const WHEEL_R = { hatch: 0.31, sedan: 0.32, coupe: 0.32, muscle: 0.33, truck: 0.38, suv: 0.37, exotic: 0.34, super: 0.34, wagon: 0.32 };

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Top speed from a power/drag balance, used to pick a final drive.
function estTopSpeed(hp, cd, area, kg) {
  const P = hp * 745.7 * 0.85;
  let v = 30;
  for (let i = 0; i < 60; i++) {
    const need = 0.5 * 1.225 * cd * area * v ** 3 + kg * 9.81 * 0.013 * v;
    v *= Math.cbrt(P / need) * 0.5 + 0.5;
  }
  return v;
}

function C(make, model, trim, y0, y1, cls, msrp, hp, tq, kg, drive, asp, engine, trans, redline, body, color, x = {}) {
  const [cd0, area0] = BODY_AERO[body];
  const cd = x.cd ?? cd0, area = x.area ?? area0;
  const gears = GEARS[trans];
  const wheelR = WHEEL_R[body];
  const vmax = Math.min(estTopSpeed(hp, cd, area, kg), (x.lim || 999) / 2.23694 * 1.06);
  const gTop = gears[gears.length - 1];
  const fd = +(redline * Math.PI / 30 * wheelR / (gTop * vmax * (asp === 'ev' ? 1.0 : 1.08))).toFixed(2);
  const modern = y1 >= 2015 ? 0.04 : y1 < 1990 ? -0.05 : 0;
  const clsGrip = { Sedan: 0.88, Truck: 0.86, SUV: 0.88, Tuner: 0.96, JDM: 0.97, Muscle: 0.98, European: 1.0, Exotic: 1.05, Supercar: 1.08 }[cls];
  const peak = asp === 'ev' ? 0.33 : asp === 'turbo' ? 0.42 : asp === 'sc' ? 0.6 : 0.68;
  return {
    id: slug(`${make}_${model}_${trim}_${y0}`),
    make, brand: make, model, trim, years: [y0, y1], cls, msrp, market: x.market || null,
    hp, tq, kg, drive, asp, engine, transCode: trans, trans: transName(trans), gears, fd,
    redline, peakTqRpm: Math.round(redline * peak), body, color,
    wf: x.wf ?? (body === 'super' ? 0.42 : drive === 'FWD' ? 0.61 : drive === 'AWD' ? 0.57 : 0.53),
    cd, area, grip: x.grip ?? clsGrip + modern, lim: x.lim || null,
    rarity: msrp > 400000 || (x.market || 0) > 400000 ? 5 : msrp > 150000 || (x.market || 0) > 90000 ? 4 : msrp > 60000 || x.market ? 3 : msrp > 30000 ? 2 : 1,
  };
}

export const CARS = [
  // ---------------- Honda / Acura ----------------
  C('honda', 'Civic', 'EX', 1996, 2000, 'Sedan', 15900, 127, 107, 1110, 'FWD', 'na', '1.6L SOHC VTEC I4', '5MT', 6800, 'hatch', '#2b4a7a'),
  C('honda', 'Civic', 'Si', 1999, 2000, 'Tuner', 17900, 160, 111, 1150, 'FWD', 'na', '1.6L DOHC VTEC B16A2', '5MT', 8200, 'coupe', '#c41b1b', { market: 9000 }),
  C('honda', 'Civic', 'LX', 2006, 2011, 'Sedan', 17700, 140, 128, 1230, 'FWD', 'na', '1.8L i-VTEC I4', '5AT', 6800, 'sedan', '#9aa0a8'),
  C('honda', 'Civic', 'Si', 2017, 2020, 'Tuner', 24300, 205, 192, 1310, 'FWD', 'turbo', '1.5L Turbo I4', '6MT', 6500, 'coupe', '#1b4fc4'),
  C('honda', 'Civic', 'Type R (FL5)', 2023, 2025, 'Tuner', 44900, 315, 310, 1430, 'FWD', 'turbo', '2.0L K20C1 Turbo I4', '6MT', 7000, 'hatch', '#f2f2f2', { grip: 1.08 }),
  C('honda', 'Accord', 'LX', 2003, 2007, 'Sedan', 21000, 160, 161, 1450, 'FWD', 'na', '2.4L i-VTEC I4', '5AT', 6800, 'sedan', '#5a5d63'),
  C('honda', 'Prelude', 'Type SH', 1997, 2001, 'Tuner', 26000, 195, 156, 1340, 'FWD', 'na', '2.2L H22A4 VTEC I4', '5MT', 7400, 'coupe', '#7a1414'),
  C('honda', 'S2000', 'AP2', 2004, 2009, 'JDM', 34600, 237, 162, 1270, 'RWD', 'na', '2.2L F22C1 VTEC I4', '6MT', 8000, 'coupe', '#e8c21a', { market: 32000 }),
  C('acura', 'Integra', 'GS-R', 1994, 2001, 'Tuner', 22000, 170, 128, 1200, 'FWD', 'na', '1.8L B18C1 VTEC I4', '5MT', 8000, 'coupe', '#c8c8c8', { market: 9000 }),
  C('acura', 'Integra', 'Type R', 1997, 2001, 'Tuner', 24000, 195, 130, 1150, 'FWD', 'na', '1.8L B18C5 VTEC I4', '5MT', 8400, 'coupe', '#f2f2f2', { market: 55000, grip: 1.0 }),
  C('acura', 'RSX', 'Type-S', 2002, 2006, 'Tuner', 23500, 210, 143, 1240, 'FWD', 'na', '2.0L K20A2 i-VTEC I4', '6MT', 8100, 'coupe', '#1b1b1b'),
  C('acura', 'NSX', 'Type S', 2022, 2022, 'Supercar', 171500, 600, 492, 1790, 'AWD', 'turbo', '3.5L TT V6 Hybrid', '9DCT', 7500, 'super', '#c41b1b', { grip: 1.12, market: 220000 }),

  // ---------------- Toyota / Lexus / Scion ----------------
  C('toyota', 'Corolla', 'LE', 2003, 2008, 'Sedan', 15500, 130, 125, 1170, 'FWD', 'na', '1.8L 1ZZ-FE I4', '4AT', 6400, 'sedan', '#c8b98a'),
  C('toyota', 'Camry', 'LE', 2007, 2011, 'Sedan', 20500, 158, 161, 1480, 'FWD', 'na', '2.4L I4', '5AT', 6200, 'sedan', '#9aa0a8'),
  C('toyota', 'Camry', 'XSE V6', 2018, 2024, 'Sedan', 36000, 301, 267, 1580, 'FWD', 'na', '3.5L V6', '8AT', 6800, 'sedan', '#24262b'),
  C('toyota', 'Celica', 'GT-S', 2000, 2005, 'Tuner', 22500, 180, 130, 1130, 'FWD', 'na', '1.8L 2ZZ-GE I4', '6MT', 8200, 'coupe', '#e8c21a'),
  C('toyota', 'MR2', 'Turbo (SW20)', 1991, 1995, 'JDM', 25000, 200, 200, 1270, 'RWD', 'turbo', '2.0L 3S-GTE Turbo I4', '5MT', 7000, 'coupe', '#c41b1b', { market: 30000, wf: 0.44 }),
  C('toyota', 'Supra', 'Turbo (MK4)', 1993, 1998, 'JDM', 41000, 320, 315, 1570, 'RWD', 'turbo', '3.0L 2JZ-GTE TT I6', '6MT', 6800, 'coupe', '#e8641a', { market: 95000 }),
  C('toyota', 'GR Supra', '3.0 Premium', 2020, 2025, 'JDM', 57000, 382, 368, 1540, 'RWD', 'turbo', '3.0L B58 Turbo I6', '8AT', 7000, 'coupe', '#c41b1b', { lim: 155 }),
  C('toyota', 'GR86', 'Premium', 2022, 2025, 'JDM', 31000, 228, 184, 1280, 'RWD', 'na', '2.4L FA24 Flat-4', '6MT', 7500, 'coupe', '#f2f2f2'),
  C('toyota', 'GR Corolla', 'Core', 2023, 2025, 'Tuner', 37000, 300, 273, 1480, 'AWD', 'turbo', '1.6L G16E Turbo I3', '6MT', 7000, 'hatch', '#f2f2f2'),
  C('toyota', 'Tacoma', 'TRD Sport', 2016, 2023, 'Truck', 36000, 278, 265, 1950, 'RWD', 'na', '3.5L V6', '6AT', 6000, 'truck', '#5a5d63'),
  C('toyota', 'Tundra', 'Limited', 2022, 2025, 'Truck', 55000, 389, 479, 2550, 'AWD', 'turbo', '3.4L TT V6', '10AT', 6000, 'truck', '#24262b'),
  C('toyota', '4Runner', 'SR5', 2010, 2024, 'SUV', 40000, 270, 278, 2100, 'AWD', 'na', '4.0L V6', '5AT', 6000, 'suv', '#3d4452'),
  C('lexus', 'IS300', 'Base', 2001, 2005, 'Sedan', 31000, 215, 218, 1500, 'RWD', 'na', '3.0L 2JZ-GE I6', '5AT', 6200, 'sedan', '#9aa0a8'),
  C('lexus', 'IS 350', 'F Sport', 2021, 2025, 'Sedan', 45000, 311, 280, 1680, 'RWD', 'na', '3.5L V6', '8AT', 6600, 'sedan', '#1b4fc4'),
  C('lexus', 'LFA', '', 2011, 2012, 'Supercar', 375000, 553, 354, 1480, 'RWD', 'na', '4.8L 1LR-GUE V10', '6DCT', 9000, 'super', '#f2f2f2', { market: 1000000, grip: 1.1 }),
  C('scion', 'tC', 'Base', 2005, 2010, 'Tuner', 17000, 161, 162, 1340, 'FWD', 'na', '2.4L 2AZ-FE I4', '5MT', 6200, 'coupe', '#24262b'),
  C('scion', 'FR-S', 'Base', 2013, 2016, 'JDM', 25000, 200, 151, 1250, 'RWD', 'na', '2.0L FA20 Flat-4', '6MT', 7400, 'coupe', '#e8641a'),

  // ---------------- Nissan / Infiniti ----------------
  C('nissan', 'Sentra', 'SR', 2010, 2012, 'Sedan', 19000, 140, 147, 1300, 'FWD', 'na', '2.0L I4', 'CVT', 6500, 'sedan', '#9aa0a8'),
  C('nissan', 'Altima', '2.5 S', 2013, 2018, 'Sedan', 23000, 182, 180, 1440, 'FWD', 'na', '2.5L I4', 'CVT', 6500, 'sedan', '#24262b'),
  C('nissan', 'Maxima', 'SE', 2004, 2008, 'Sedan', 30000, 265, 255, 1600, 'FWD', 'na', '3.5L VQ35DE V6', '5AT', 6600, 'sedan', '#7a1414'),
  C('nissan', '240SX', 'SE (S14)', 1995, 1998, 'JDM', 21000, 155, 160, 1250, 'RWD', 'na', '2.4L KA24DE I4', '5MT', 6500, 'coupe', '#c41b1b', { market: 14000 }),
  C('nissan', '350Z', 'Enthusiast', 2003, 2008, 'JDM', 28000, 306, 268, 1500, 'RWD', 'na', '3.5L VQ35HR V6', '6MT', 7500, 'coupe', '#e8c21a'),
  C('nissan', '370Z', 'Sport', 2009, 2020, 'JDM', 36000, 332, 270, 1500, 'RWD', 'na', '3.7L VQ37VHR V6', '6MT', 7500, 'coupe', '#f2f2f2'),
  C('nissan', 'Z', 'Performance', 2023, 2025, 'JDM', 53000, 400, 350, 1600, 'RWD', 'turbo', '3.0L VR30DDTT TT V6', '6MT', 7000, 'coupe', '#1b4fc4'),
  C('nissan', 'Skyline GT-R', 'V-Spec (R34)', 1999, 2002, 'JDM', 60000, 330, 290, 1560, 'AWD', 'turbo', '2.6L RB26DETT TT I6', '6MT', 8000, 'coupe', '#1b4fc4', { market: 180000 }),
  C('nissan', 'GT-R', 'Premium (R35)', 2017, 2024, 'JDM', 115000, 565, 467, 1750, 'AWD', 'turbo', '3.8L VR38DETT TT V6', '6DCT', 7100, 'coupe', '#9aa0a8', { grip: 1.08 }),
  C('nissan', 'GT-R', 'NISMO', 2020, 2024, 'JDM', 220000, 600, 481, 1720, 'AWD', 'turbo', '3.8L VR38DETT TT V6', '6DCT', 7100, 'coupe', '#f2f2f2', { grip: 1.14 }),
  C('infiniti', 'G35', 'Coupe', 2003, 2007, 'Sedan', 33000, 298, 260, 1600, 'RWD', 'na', '3.5L VQ35DE V6', '6MT', 7000, 'coupe', '#24262b'),
  C('infiniti', 'Q50', 'Red Sport 400', 2016, 2024, 'Sedan', 58000, 400, 350, 1780, 'RWD', 'turbo', '3.0L VR30DDTT TT V6', '7AT', 7000, 'sedan', '#c41b1b'),

  // ---------------- Mazda / Subaru / Mitsubishi ----------------
  C('mazda', 'MX-5 Miata', '(NA)', 1990, 1997, 'JDM', 16000, 128, 110, 990, 'RWD', 'na', '1.8L BP I4', '5MT', 7000, 'coupe', '#c41b1b', { market: 7500 }),
  C('mazda', 'MX-5 Miata', 'Club (ND)', 2016, 2025, 'JDM', 35000, 181, 151, 1060, 'RWD', 'na', '2.0L Skyactiv-G I4', '6MT', 7500, 'coupe', '#c41b1b'),
  C('mazda', 'RX-7', 'Twin Turbo (FD)', 1993, 1995, 'JDM', 33000, 255, 217, 1280, 'RWD', 'turbo', '1.3L 13B-REW TT Rotary', '5MT', 8000, 'coupe', '#c41b1b', { market: 60000 }),
  C('mazda', 'RX-8', 'Sport', 2004, 2011, 'JDM', 27000, 232, 159, 1370, 'RWD', 'na', '1.3L Renesis Rotary', '6MT', 9000, 'coupe', '#1b4fc4'),
  C('mazda', 'Mazda3', '2.5 Turbo AWD', 2021, 2025, 'Sedan', 34000, 250, 320, 1550, 'AWD', 'turbo', '2.5L Skyactiv-G Turbo I4', '6AT', 6000, 'hatch', '#7a1414'),
  C('subaru', 'Impreza', 'WRX STI', 2004, 2007, 'Tuner', 33000, 300, 300, 1500, 'AWD', 'turbo', '2.5L EJ257 Turbo Flat-4', '6MT', 7000, 'sedan', '#1b4fc4', { market: 30000 }),
  C('subaru', 'WRX', 'Premium', 2022, 2025, 'Tuner', 33000, 271, 258, 1530, 'AWD', 'turbo', '2.4L FA24 Turbo Flat-4', '6MT', 6000, 'sedan', '#1b4fc4'),
  C('subaru', 'Legacy', 'GT', 2005, 2009, 'Sedan', 29000, 250, 250, 1550, 'AWD', 'turbo', '2.5L EJ255 Turbo Flat-4', '5MT', 6500, 'sedan', '#24262b'),
  C('subaru', 'BRZ', 'tS', 2022, 2025, 'JDM', 36000, 228, 184, 1290, 'RWD', 'na', '2.4L FA24 Flat-4', '6MT', 7500, 'coupe', '#1b4fc4'),
  C('subaru', 'Outback', '2.5i', 2010, 2014, 'SUV', 24000, 170, 170, 1550, 'AWD', 'na', '2.5L Flat-4', 'CVT', 6000, 'wagon', '#4a5232'),
  C('mitsubishi', 'Mirage', 'ES', 2017, 2024, 'Sedan', 15000, 78, 74, 920, 'FWD', 'na', '1.2L I3', 'CVT', 6000, 'hatch', '#e8641a'),
  C('mitsubishi', 'Eclipse', 'GSX', 1995, 1999, 'Tuner', 25000, 210, 214, 1420, 'AWD', 'turbo', '2.0L 4G63T Turbo I4', '5MT', 7000, 'coupe', '#24262b', { market: 16000 }),
  C('mitsubishi', '3000GT', 'VR-4', 1994, 1999, 'JDM', 45000, 320, 315, 1740, 'AWD', 'turbo', '3.0L 6G72 TT V6', '6MT', 7000, 'coupe', '#c41b1b', { market: 25000 }),
  C('mitsubishi', 'Lancer Evolution', 'IX MR', 2006, 2006, 'Tuner', 35000, 286, 289, 1430, 'AWD', 'turbo', '2.0L 4G63T Turbo I4', '6MT', 7000, 'sedan', '#f2f2f2', { market: 45000 }),
  C('mitsubishi', 'Lancer Evolution', 'X GSR', 2008, 2015, 'Tuner', 35000, 291, 300, 1560, 'AWD', 'turbo', '2.0L 4B11T Turbo I4', '5MT', 7000, 'sedan', '#c41b1b', { market: 32000 }),

  // ---------------- Hyundai / Kia / Genesis ----------------
  C('hyundai', 'Sonata', 'GLS', 2011, 2014, 'Sedan', 21000, 198, 184, 1460, 'FWD', 'na', '2.4L I4', '6AT', 6500, 'sedan', '#9aa0a8'),
  C('hyundai', 'Genesis Coupe', '3.8 R-Spec', 2013, 2016, 'Tuner', 30000, 348, 295, 1590, 'RWD', 'na', '3.8L Lambda V6', '6MT', 7000, 'coupe', '#e8641a'),
  C('hyundai', 'Veloster', 'N', 2019, 2022, 'Tuner', 33000, 275, 260, 1400, 'FWD', 'turbo', '2.0L Turbo I4', '6MT', 6750, 'hatch', '#1b4fc4'),
  C('hyundai', 'Elantra', 'N', 2022, 2025, 'Tuner', 34000, 276, 289, 1430, 'FWD', 'turbo', '2.0L Turbo I4', '6MT', 6750, 'sedan', '#1b4fc4'),
  C('hyundai', 'Ioniq 5', 'N', 2025, 2025, 'Tuner', 66000, 641, 545, 2200, 'AWD', 'ev', 'Dual-Motor Electric', '1EV', 16000, 'hatch', '#1b4fc4', { lim: 162 }),
  C('kia', 'Soul', 'Base', 2014, 2019, 'Sedan', 16000, 130, 118, 1290, 'FWD', 'na', '1.6L I4', '6AT', 6300, 'hatch', '#e8641a'),
  C('kia', 'Optima', 'SX Turbo', 2011, 2015, 'Sedan', 28000, 274, 269, 1560, 'FWD', 'turbo', '2.0L Turbo I4', '6AT', 6500, 'sedan', '#24262b'),
  C('kia', 'Stinger', 'GT2 AWD', 2018, 2023, 'Sedan', 52000, 368, 376, 1840, 'AWD', 'turbo', '3.3L TT V6', '8AT', 6200, 'sedan', '#c41b1b'),
  C('genesis', 'G70', '3.3T Sport', 2019, 2025, 'Sedan', 50000, 365, 376, 1750, 'RWD', 'turbo', '3.3L TT V6', '8AT', 6200, 'sedan', '#24262b'),

  // ---------------- Ford / Lincoln ----------------
  C('ford', 'Mustang', 'GT 5.0 (Fox Body)', 1987, 1993, 'Muscle', 14000, 225, 300, 1420, 'RWD', 'na', '5.0L Windsor V8', '5MT', 5000, 'muscle', '#c41b1b', { market: 18000 }),
  C('ford', 'Mustang', 'GT (S197)', 2005, 2009, 'Muscle', 27000, 300, 320, 1590, 'RWD', 'na', '4.6L 3V Modular V8', '5MT', 6000, 'muscle', '#1b4fc4'),
  C('ford', 'Mustang', 'EcoBoost', 2015, 2023, 'Muscle', 28000, 310, 350, 1590, 'RWD', 'turbo', '2.3L EcoBoost I4', '6MT', 6500, 'muscle', '#f2f2f2'),
  C('ford', 'Mustang', 'GT (S650)', 2024, 2025, 'Muscle', 44000, 480, 415, 1730, 'RWD', 'na', '5.0L Coyote V8', '6MT', 7500, 'muscle', '#c41b1b'),
  C('ford', 'Mustang', 'Dark Horse', 2024, 2025, 'Muscle', 61000, 500, 418, 1780, 'RWD', 'na', '5.0L Coyote V8', '6MT', 7500, 'muscle', '#1b4fc4', { grip: 1.04 }),
  C('ford', 'Mustang', 'Shelby GT500', 2020, 2022, 'Muscle', 80000, 760, 625, 1900, 'RWD', 'sc', '5.2L Predator Supercharged V8', '7DCT', 7500, 'muscle', '#24262b', { grip: 1.05 }),
  C('ford', 'Mustang Mach-E', 'GT', 2021, 2025, 'SUV', 60000, 480, 634, 2270, 'AWD', 'ev', 'Dual-Motor Electric', '1EV', 14000, 'suv', '#c41b1b', { lim: 124 }),
  C('ford', 'Focus', 'ST', 2015, 2018, 'Tuner', 25000, 252, 270, 1440, 'FWD', 'turbo', '2.0L EcoBoost I4', '6MT', 6500, 'hatch', '#1b4fc4'),
  C('ford', 'Focus', 'RS', 2016, 2018, 'Tuner', 41000, 350, 350, 1530, 'AWD', 'turbo', '2.3L EcoBoost I4', '6MT', 6800, 'hatch', '#1b4fc4', { market: 32000 }),
  C('ford', 'Crown Victoria', 'Police Interceptor', 2003, 2011, 'Sedan', 26000, 250, 297, 1900, 'RWD', 'na', '4.6L Modular V8', '4AT', 5500, 'sedan', '#f2f2f2'),
  C('ford', 'Ranger', 'XLT', 2001, 2011, 'Truck', 18000, 143, 154, 1450, 'RWD', 'na', '2.3L Duratec I4', '5MT', 6000, 'truck', '#5a5d63'),
  C('ford', 'Explorer', 'XLT', 2002, 2005, 'SUV', 30000, 210, 254, 1950, 'RWD', 'na', '4.0L SOHC V6', '5AT', 6000, 'suv', '#7a1414'),
  C('ford', 'F-150', 'XLT 5.0', 2015, 2020, 'Truck', 46000, 395, 400, 2150, 'RWD', 'na', '5.0L Coyote V8', '10AT', 6500, 'truck', '#24262b'),
  C('ford', 'F-150', 'Raptor', 2021, 2025, 'Truck', 78000, 450, 510, 2600, 'AWD', 'turbo', '3.5L EcoBoost HO TT V6', '10AT', 6000, 'truck', '#e8641a'),
  C('ford', 'F-150', 'Raptor R', 2023, 2025, 'Truck', 110000, 720, 640, 2700, 'AWD', 'sc', '5.2L Predator Supercharged V8', '10AT', 7000, 'truck', '#24262b'),
  C('ford', 'GT', '', 2017, 2022, 'Supercar', 500000, 660, 550, 1385, 'RWD', 'turbo', '3.5L EcoBoost TT V6', '7DCT', 7000, 'super', '#1b4fc4', { market: 1000000, grip: 1.15 }),
  C('lincoln', 'Town Car', 'Signature', 2003, 2011, 'Sedan', 45000, 239, 287, 1880, 'RWD', 'na', '4.6L Modular V8', '4AT', 5500, 'sedan', '#24262b'),

  // ---------------- GM: Chevrolet / GMC / Cadillac / Buick / Pontiac ----------------
  C('chevrolet', 'Chevelle', 'SS 454', 1970, 1970, 'Muscle', 4500, 450, 500, 1700, 'RWD', 'na', '7.4L LS6 V8', '4MT', 5600, 'muscle', '#c41b1b', { market: 90000, grip: 0.82 }),
  C('chevrolet', 'Impala', 'SS', 1994, 1996, 'Muscle', 22000, 260, 330, 1900, 'RWD', 'na', '5.7L LT1 V8', '4AT', 5200, 'sedan', '#24262b', { market: 17000 }),
  C('chevrolet', 'Malibu', 'LT', 2008, 2012, 'Sedan', 22000, 169, 160, 1530, 'FWD', 'na', '2.4L Ecotec I4', '6AT', 6500, 'sedan', '#9aa0a8'),
  C('chevrolet', 'Cruze', 'LT', 2011, 2015, 'Sedan', 19000, 138, 148, 1430, 'FWD', 'turbo', '1.4L Turbo I4', '6AT', 6000, 'sedan', '#24262b'),
  C('chevrolet', 'Cobalt', 'SS Turbo', 2008, 2010, 'Tuner', 23000, 260, 260, 1330, 'FWD', 'turbo', '2.0L LNF Turbo I4', '5MT', 6500, 'coupe', '#e8c21a'),
  C('chevrolet', 'Camaro', 'SS', 2016, 2024, 'Muscle', 43000, 455, 455, 1700, 'RWD', 'na', '6.2L LT1 V8', '6MT', 6500, 'muscle', '#e8c21a'),
  C('chevrolet', 'Camaro', 'ZL1', 2017, 2024, 'Muscle', 72000, 650, 650, 1780, 'RWD', 'sc', '6.2L LT4 Supercharged V8', '10AT', 6500, 'muscle', '#24262b', { grip: 1.04 }),
  C('chevrolet', 'Corvette', '(C5)', 1997, 2004, 'Muscle', 40000, 350, 375, 1460, 'RWD', 'na', '5.7L LS1 V8', '6MT', 6000, 'exotic', '#c41b1b', { market: 18000 }),
  C('chevrolet', 'Corvette', 'Z06 (C6)', 2006, 2013, 'Muscle', 71000, 505, 470, 1420, 'RWD', 'na', '7.0L LS7 V8', '6MT', 7000, 'exotic', '#e8c21a', { market: 50000 }),
  C('chevrolet', 'Corvette', 'Stingray (C8)', 2020, 2025, 'Exotic', 70000, 495, 470, 1530, 'RWD', 'na', '6.2L LT2 V8', '8DCT', 6500, 'super', '#c41b1b', { grip: 1.08 }),
  C('chevrolet', 'Corvette', 'Z06 (C8)', 2023, 2025, 'Exotic', 114000, 670, 460, 1560, 'RWD', 'na', '5.5L LT6 Flat-Plane V8', '8DCT', 8600, 'super', '#e8641a', { grip: 1.14 }),
  C('chevrolet', 'Silverado 1500', 'LT 5.3', 2014, 2018, 'Truck', 42000, 355, 383, 2350, 'RWD', 'na', '5.3L EcoTec3 V8', '6AT', 6000, 'truck', '#9aa0a8'),
  C('chevrolet', 'Tahoe', 'LT', 2007, 2014, 'SUV', 40000, 320, 335, 2500, 'RWD', 'na', '5.3L Vortec V8', '6AT', 6000, 'suv', '#24262b'),
  C('gmc', 'Syclone', '', 1991, 1991, 'Truck', 26000, 280, 350, 1600, 'AWD', 'turbo', '4.3L Turbo V6', '4AT', 5000, 'truck', '#0d0d0d', { market: 40000 }),
  C('gmc', 'Sierra 1500', 'Denali 6.2', 2019, 2025, 'Truck', 66000, 420, 460, 2450, 'AWD', 'na', '6.2L EcoTec3 V8', '10AT', 6000, 'truck', '#24262b'),
  C('cadillac', 'CTS-V', '', 2016, 2019, 'Sedan', 87000, 640, 630, 1850, 'RWD', 'sc', '6.2L LT4 Supercharged V8', '8AT', 6500, 'sedan', '#24262b'),
  C('cadillac', 'CT5-V', 'Blackwing', 2022, 2025, 'Sedan', 95000, 668, 659, 1880, 'RWD', 'sc', '6.2L LT4 Supercharged V8', '6MT', 6500, 'sedan', '#1b4fc4', { grip: 1.06 }),
  C('cadillac', 'Escalade', 'Premium Luxury', 2021, 2025, 'SUV', 85000, 420, 460, 2650, 'AWD', 'na', '6.2L V8', '10AT', 6000, 'suv', '#0d0d0d'),
  C('buick', 'Grand National', '', 1986, 1987, 'Muscle', 15000, 245, 355, 1600, 'RWD', 'turbo', '3.8L SFI Turbo V6', '4AT', 5000, 'muscle', '#0d0d0d', { market: 45000 }),
  C('pontiac', 'Firebird', 'Trans Am WS6', 1998, 2002, 'Muscle', 32000, 325, 350, 1590, 'RWD', 'na', '5.7L LS1 V8', '6MT', 6000, 'muscle', '#0d0d0d', { market: 22000 }),
  C('pontiac', 'GTO', '6.0', 2005, 2006, 'Muscle', 32000, 400, 400, 1720, 'RWD', 'na', '6.0L LS2 V8', '6MT', 6500, 'muscle', '#c41b1b', { market: 20000 }),

  // ---------------- Stellantis: Dodge / Chrysler / Ram / Jeep ----------------
  C('dodge', 'Neon', 'SRT-4', 2003, 2005, 'Tuner', 21000, 230, 250, 1340, 'FWD', 'turbo', '2.4L Turbo I4', '5MT', 6200, 'sedan', '#e8c21a', { market: 12000 }),
  C('dodge', 'Charger', 'SXT', 2011, 2014, 'Sedan', 28000, 292, 260, 1800, 'RWD', 'na', '3.6L Pentastar V6', '5AT', 6400, 'sedan', '#24262b'),
  C('dodge', 'Charger', 'Scat Pack', 2015, 2023, 'Muscle', 47000, 485, 475, 1900, 'RWD', 'na', '6.4L 392 HEMI V8', '8AT', 6400, 'sedan', '#e8641a'),
  C('dodge', 'Charger', 'SRT Hellcat Redeye', 2021, 2023, 'Muscle', 85000, 797, 707, 2050, 'RWD', 'sc', '6.2L Supercharged HEMI V8', '8AT', 6500, 'sedan', '#c41b1b'),
  C('dodge', 'Challenger', 'R/T', 2015, 2023, 'Muscle', 38000, 375, 410, 1880, 'RWD', 'na', '5.7L HEMI V8', '6MT', 5800, 'muscle', '#e8641a'),
  C('dodge', 'Challenger', 'SRT Hellcat', 2015, 2023, 'Muscle', 68000, 717, 656, 2000, 'RWD', 'sc', '6.2L Supercharged HEMI V8', '8AT', 6500, 'muscle', '#24262b'),
  C('dodge', 'Challenger', 'SRT Demon', 2018, 2018, 'Muscle', 86000, 808, 717, 1900, 'RWD', 'sc', '6.2L Supercharged HEMI V8', '8AT', 6500, 'muscle', '#c41b1b', { market: 150000, grip: 1.15 }),
  C('dodge', 'Viper', 'ACR', 2016, 2017, 'Exotic', 120000, 645, 600, 1530, 'RWD', 'na', '8.4L V10', '6MT', 6200, 'exotic', '#c41b1b', { market: 220000, grip: 1.15 }),
  C('dodge', 'Durango', 'SRT Hellcat', 2021, 2023, 'SUV', 82000, 710, 645, 2650, 'AWD', 'sc', '6.2L Supercharged HEMI V8', '8AT', 6200, 'suv', '#24262b'),
  C('chrysler', 'PT Cruiser', 'Touring', 2001, 2010, 'Sedan', 18000, 150, 162, 1420, 'FWD', 'na', '2.4L I4', '4AT', 6000, 'hatch', '#6b2bd1'),
  C('chrysler', '300C', 'SRT8', 2012, 2014, 'Sedan', 48000, 470, 470, 1950, 'RWD', 'na', '6.4L HEMI V8', '5AT', 6400, 'sedan', '#24262b'),
  C('ram', '1500', 'Big Horn 5.7', 2013, 2018, 'Truck', 42000, 395, 410, 2350, 'RWD', 'na', '5.7L HEMI V8', '8AT', 5800, 'truck', '#c41b1b'),
  C('ram', '1500', 'TRX', 2021, 2024, 'Truck', 92000, 702, 650, 2900, 'AWD', 'sc', '6.2L Supercharged HEMI V8', '8AT', 6200, 'truck', '#24262b'),
  C('jeep', 'Wrangler', 'Sport', 2007, 2011, 'SUV', 22000, 202, 237, 1900, 'AWD', 'na', '3.8L V6', '6MT', 5500, 'suv', '#1f8f3a'),
  C('jeep', 'Grand Cherokee', 'SRT', 2017, 2021, 'SUV', 70000, 475, 470, 2300, 'AWD', 'na', '6.4L HEMI V8', '8AT', 6400, 'suv', '#9aa0a8'),
  C('jeep', 'Grand Cherokee', 'Trackhawk', 2018, 2021, 'SUV', 88000, 707, 645, 2430, 'AWD', 'sc', '6.2L Supercharged HEMI V8', '8AT', 6200, 'suv', '#24262b'),

  // ---------------- EV makers ----------------
  C('tesla', 'Model 3', 'Performance', 2024, 2025, 'Sedan', 55000, 510, 487, 1850, 'AWD', 'ev', 'Dual-Motor Electric', '1EV', 18000, 'sedan', '#c41b1b', { lim: 163 }),
  C('tesla', 'Model Y', 'Long Range', 2020, 2025, 'SUV', 50000, 384, 376, 2000, 'AWD', 'ev', 'Dual-Motor Electric', '1EV', 18000, 'suv', '#f2f2f2', { lim: 135 }),
  C('tesla', 'Model S', 'Plaid', 2021, 2025, 'Sedan', 90000, 1020, 1050, 2160, 'AWD', 'ev', 'Tri-Motor Electric', '1EV', 20000, 'sedan', '#f2f2f2', { lim: 200, grip: 1.22 }),
  C('rivian', 'R1T', 'Quad-Motor', 2023, 2025, 'Truck', 97000, 835, 908, 3200, 'AWD', 'ev', 'Quad-Motor Electric', '1EV', 15000, 'truck', '#4a5232', { lim: 125 }),
  C('lucid', 'Air', 'Sapphire', 2024, 2025, 'Sedan', 249000, 1234, 1430, 2380, 'AWD', 'ev', 'Tri-Motor Electric', '1EV', 20000, 'sedan', '#1b4fc4', { lim: 205, grip: 1.15 }),

  // ---------------- Germany ----------------
  C('bmw', '325i', '(E30)', 1987, 1991, 'European', 25000, 168, 164, 1200, 'RWD', 'na', '2.5L M20 I6', '5MT', 6500, 'sedan', '#f2f2f2', { market: 14000 }),
  C('bmw', 'M3', '(E36)', 1995, 1999, 'European', 40000, 240, 236, 1440, 'RWD', 'na', '3.2L S52 I6', '5MT', 6500, 'coupe', '#24262b', { market: 17000 }),
  C('bmw', 'M3', '(E46)', 2001, 2006, 'European', 48000, 333, 262, 1570, 'RWD', 'na', '3.2L S54 I6', '6MT', 8000, 'coupe', '#1b4fc4', { market: 30000, lim: 155 }),
  C('bmw', '328i', '(E90)', 2007, 2011, 'European', 34000, 230, 200, 1520, 'RWD', 'na', '3.0L N52 I6', '6AT', 7000, 'sedan', '#9aa0a8', { lim: 130 }),
  C('bmw', '335i', '(E92)', 2007, 2010, 'European', 42000, 300, 300, 1600, 'RWD', 'turbo', '3.0L N54 TT I6', '6MT', 7000, 'coupe', '#24262b', { lim: 150 }),
  C('bmw', 'M2', '(G87)', 2023, 2025, 'European', 64000, 453, 406, 1720, 'RWD', 'turbo', '3.0L S58 TT I6', '6MT', 7200, 'coupe', '#1b4fc4', { lim: 155 }),
  C('bmw', 'M4', 'Competition', 2021, 2025, 'European', 82000, 503, 479, 1730, 'RWD', 'turbo', '3.0L S58 TT I6', '8AT', 7200, 'coupe', '#e8c21a', { lim: 155, grip: 1.04 }),
  C('bmw', 'M3', 'Competition xDrive (G80)', 2022, 2025, 'European', 87000, 503, 479, 1780, 'AWD', 'turbo', '3.0L S58 TT I6', '8AT', 7200, 'sedan', '#1f8f3a', { lim: 155 }),
  C('bmw', 'M5', 'Competition (F90)', 2019, 2023, 'European', 113000, 617, 553, 1940, 'AWD', 'turbo', '4.4L S63 TT V8', '8AT', 7000, 'sedan', '#24262b', { lim: 155 }),
  C('mercedes', 'C300', '4MATIC', 2015, 2021, 'European', 43000, 241, 273, 1650, 'AWD', 'turbo', '2.0L Turbo I4', '9AT', 6200, 'sedan', '#9aa0a8', { lim: 130 }),
  C('mercedes', 'C63 AMG', '(W204)', 2008, 2014, 'European', 58000, 451, 443, 1730, 'RWD', 'na', '6.2L M156 V8', '7AT', 7200, 'sedan', '#24262b', { lim: 155 }),
  C('mercedes', 'SL55 AMG', '', 2003, 2006, 'European', 120000, 493, 516, 1950, 'RWD', 'sc', '5.4L Supercharged V8', '5AT', 6000, 'exotic', '#9aa0a8', { market: 25000, lim: 155 }),
  C('mercedes', 'E63 S AMG', '4MATIC+', 2018, 2023, 'European', 110000, 603, 627, 2000, 'AWD', 'turbo', '4.0L M177 TT V8', '9AT', 7000, 'sedan', '#24262b', { lim: 186 }),
  C('mercedes', 'AMG G63', '', 2019, 2025, 'SUV', 180000, 577, 627, 2560, 'AWD', 'turbo', '4.0L TT V8', '9AT', 6500, 'suv', '#0d0d0d', { lim: 137 }),
  C('mercedes', 'AMG GT', 'Black Series', 2021, 2021, 'Supercar', 326000, 720, 590, 1540, 'RWD', 'turbo', '4.0L TT Flat-Plane V8', '7DCT', 7200, 'exotic', '#e8641a', { market: 400000, grip: 1.18 }),
  C('audi', 'A4', '2.0T quattro', 2009, 2012, 'European', 34000, 211, 258, 1650, 'AWD', 'turbo', '2.0L TFSI I4', '6AT', 6500, 'sedan', '#9aa0a8', { lim: 130 }),
  C('audi', 'S4', '(B8)', 2010, 2016, 'European', 48000, 333, 325, 1760, 'AWD', 'sc', '3.0L Supercharged V6', '7DCT', 7000, 'sedan', '#24262b', { lim: 155 }),
  C('audi', 'TT RS', '', 2018, 2022, 'European', 67000, 394, 354, 1500, 'AWD', 'turbo', '2.5L TFSI I5', '7DCT', 7000, 'coupe', '#e8c21a', { lim: 174 }),
  C('audi', 'RS3', '', 2022, 2025, 'European', 63000, 401, 369, 1570, 'AWD', 'turbo', '2.5L TFSI I5', '7DCT', 7000, 'sedan', '#1f8f3a', { lim: 155 }),
  C('audi', 'RS6 Avant', 'performance', 2024, 2025, 'European', 128000, 621, 627, 2075, 'AWD', 'turbo', '4.0L TFSI TT V8', '8AT', 6800, 'wagon', '#9aa0a8', { lim: 190 }),
  C('audi', 'R8', 'V10 Performance', 2020, 2023, 'Exotic', 210000, 602, 413, 1590, 'AWD', 'na', '5.2L FSI V10', '7DCT', 8700, 'super', '#c41b1b', { grip: 1.12 }),
  C('volkswagen', 'Jetta', 'GLS 2.0', 2000, 2005, 'Sedan', 18000, 115, 122, 1320, 'FWD', 'na', '2.0L 8V I4', '5MT', 6000, 'sedan', '#24262b'),
  C('volkswagen', 'Golf', 'GTI (Mk7)', 2015, 2021, 'Tuner', 27000, 228, 258, 1400, 'FWD', 'turbo', '2.0L TSI EA888 I4', '6MT', 6800, 'hatch', '#c41b1b', { lim: 155 }),
  C('volkswagen', 'Golf', 'R (Mk8)', 2022, 2025, 'Tuner', 46000, 315, 295, 1530, 'AWD', 'turbo', '2.0L TSI EA888 I4', '6MT', 6800, 'hatch', '#1b4fc4', { lim: 155 }),
  C('volkswagen', 'Jetta', 'GLI', 2019, 2025, 'Sedan', 31000, 228, 258, 1440, 'FWD', 'turbo', '2.0L TSI EA888 I4', '6MT', 6500, 'sedan', '#9aa0a8', { lim: 126 }),
  C('porsche', 'Boxster', 'S (987)', 2005, 2008, 'European', 55000, 280, 236, 1400, 'RWD', 'na', '3.2L Flat-6', '6MT', 7200, 'exotic', '#9aa0a8', { wf: 0.46 }),
  C('porsche', '911', 'Carrera (996)', 1999, 2004, 'European', 68000, 315, 273, 1400, 'RWD', 'na', '3.6L Flat-6', '6MT', 7300, 'exotic', '#f2f2f2', { wf: 0.39, market: 30000 }),
  C('porsche', '911', 'Carrera S (992)', 2020, 2025, 'European', 131000, 443, 390, 1530, 'RWD', 'turbo', '3.0L TT Flat-6', '8DCT', 7500, 'exotic', '#e8c21a', { wf: 0.38, grip: 1.1 }),
  C('porsche', '911', 'Turbo S (992)', 2021, 2025, 'European', 230000, 640, 590, 1640, 'AWD', 'turbo', '3.8L TT Flat-6', '8DCT', 7200, 'exotic', '#4a4f57', { wf: 0.39, grip: 1.14 }),
  C('porsche', '911', 'GT3 RS (992)', 2023, 2025, 'European', 242000, 518, 343, 1450, 'RWD', 'na', '4.0L Flat-6', '7DCT', 9000, 'exotic', '#1f8f3a', { wf: 0.39, grip: 1.22 }),
  C('porsche', '718 Cayman', 'GT4', 2020, 2024, 'European', 107000, 414, 309, 1420, 'RWD', 'na', '4.0L Flat-6', '6MT', 8000, 'exotic', '#e8641a', { wf: 0.45, grip: 1.1 }),
  C('porsche', 'Cayenne', 'Turbo GT', 2022, 2025, 'SUV', 196000, 631, 626, 2220, 'AWD', 'turbo', '4.0L TT V8', '8AT', 6800, 'suv', '#9aa0a8'),
  C('porsche', 'Taycan', 'Turbo S', 2020, 2025, 'European', 194000, 750, 774, 2300, 'AWD', 'ev', 'Dual-Motor Electric', '2EV', 16000, 'sedan', '#1b4fc4', { lim: 161, grip: 1.1 }),

  // ---------------- UK / Sweden / Italy ----------------
  C('volvo', '240', 'DL Wagon', 1985, 1993, 'Sedan', 20000, 114, 136, 1350, 'RWD', 'na', '2.3L B230F I4', '4AT', 5800, 'wagon', '#7a1414', { market: 6500 }),
  C('volvo', 'V60', 'Polestar', 2017, 2018, 'European', 61000, 362, 347, 1800, 'AWD', 'turbo', '2.0L Twincharged I4', '8AT', 6500, 'wagon', '#1b4fc4', { lim: 155 }),
  C('mini', 'Cooper', 'S', 2011, 2013, 'Tuner', 26000, 181, 177, 1220, 'FWD', 'turbo', '1.6L Turbo I4', '6MT', 6500, 'hatch', '#1f8f3a'),
  C('jaguar', 'F-Type', 'R AWD', 2020, 2024, 'European', 105000, 575, 516, 1820, 'AWD', 'sc', '5.0L Supercharged V8', '8AT', 6500, 'exotic', '#1f8f3a', { lim: 186 }),
  C('landrover', 'Range Rover Sport', 'SVR', 2018, 2022, 'SUV', 115000, 575, 516, 2400, 'AWD', 'sc', '5.0L Supercharged V8', '8AT', 6500, 'suv', '#0d0d0d', { lim: 176 }),
  C('lotus', 'Elise', '', 2005, 2011, 'European', 47000, 190, 138, 900, 'RWD', 'na', '1.8L 2ZZ-GE I4', '6MT', 8000, 'super', '#e8c21a', { market: 45000, wf: 0.38, grip: 1.05 }),
  C('lotus', 'Emira', 'V6 First Edition', 2023, 2025, 'European', 100000, 400, 310, 1460, 'RWD', 'sc', '3.5L Supercharged V6', '6MT', 7000, 'super', '#1f8f3a', { grip: 1.1 }),
  C('astonmartin', 'Vantage', '', 2025, 2025, 'Exotic', 191000, 656, 590, 1600, 'RWD', 'turbo', '4.0L TT V8', '8AT', 7000, 'exotic', '#1f8f3a', { grip: 1.1 }),
  C('astonmartin', 'DBS', 'Superleggera', 2019, 2023, 'Exotic', 316000, 715, 664, 1800, 'RWD', 'turbo', '5.2L TT V12', '8AT', 7000, 'exotic', '#24262b', { grip: 1.08 }),
  C('bentley', 'Continental GT', 'Speed', 2022, 2024, 'Exotic', 274000, 650, 664, 2270, 'AWD', 'turbo', '6.0L TT W12', '8DCT', 6500, 'exotic', '#0b1f4d'),
  C('rollsroyce', 'Cullinan', '', 2019, 2025, 'SUV', 340000, 563, 627, 2750, 'AWD', 'turbo', '6.75L TT V12', '8AT', 5500, 'suv', '#0d0d0d', { lim: 155 }),
  C('alfaromeo', 'Giulia', 'Quadrifoglio', 2017, 2025, 'European', 82000, 505, 443, 1720, 'RWD', 'turbo', '2.9L TT V6', '8AT', 7000, 'sedan', '#c41b1b', { grip: 1.06 }),
  C('maserati', 'GranTurismo', 'S', 2009, 2012, 'Exotic', 125000, 433, 361, 1880, 'RWD', 'na', '4.7L V8', '6AT', 7600, 'exotic', '#0b1f4d', { market: 35000 }),
  C('maserati', 'MC20', '', 2022, 2025, 'Supercar', 230000, 621, 538, 1500, 'RWD', 'turbo', '3.0L Nettuno TT V6', '8DCT', 8000, 'super', '#f2f2f2', { grip: 1.12 }),
  C('ferrari', '458', 'Italia', 2010, 2015, 'Exotic', 240000, 562, 398, 1485, 'RWD', 'na', '4.5L V8', '7DCT', 9000, 'super', '#c41b1b', { market: 230000, grip: 1.12 }),
  C('ferrari', 'F8', 'Tributo', 2020, 2023, 'Exotic', 280000, 710, 568, 1435, 'RWD', 'turbo', '3.9L TT V8', '7DCT', 8000, 'super', '#c41b1b', { grip: 1.15 }),
  C('ferrari', '296', 'GTB', 2022, 2025, 'Exotic', 322000, 819, 546, 1470, 'RWD', 'turbo', '3.0L TT V6 Hybrid', '8DCT', 8500, 'super', '#e8c21a', { grip: 1.16 }),
  C('ferrari', '812', 'Superfast', 2018, 2023, 'Exotic', 340000, 789, 529, 1630, 'RWD', 'na', '6.5L V12', '7DCT', 8900, 'exotic', '#c41b1b', { grip: 1.14 }),
  C('ferrari', 'SF90', 'Stradale', 2020, 2025, 'Supercar', 525000, 986, 590, 1570, 'AWD', 'turbo', '4.0L TT V8 Plug-in Hybrid', '8DCT', 8000, 'super', '#c41b1b', { grip: 1.2 }),
  C('lamborghini', 'Huracán', 'EVO', 2020, 2024, 'Exotic', 265000, 631, 442, 1422, 'AWD', 'na', '5.2L V10', '7DCT', 8700, 'super', '#e8641a', { grip: 1.15 }),
  C('lamborghini', 'Urus', 'Performante', 2023, 2025, 'SUV', 260000, 657, 627, 2150, 'AWD', 'turbo', '4.0L TT V8', '8AT', 6800, 'suv', '#e8c21a', { grip: 1.1 }),
  C('lamborghini', 'Aventador', 'SVJ', 2019, 2022, 'Supercar', 520000, 759, 531, 1525, 'AWD', 'na', '6.5L V12', '7AT', 8700, 'super', '#1f8f3a', { grip: 1.18 }),
  C('lamborghini', 'Revuelto', '', 2024, 2025, 'Supercar', 608000, 1001, 535, 1770, 'AWD', 'na', '6.5L V12 Hybrid', '8DCT', 9500, 'super', '#f2f2f2', { grip: 1.2 }),
  C('mclaren', '720S', '', 2018, 2023, 'Exotic', 300000, 710, 568, 1419, 'RWD', 'turbo', '4.0L TT V8', '7DCT', 8500, 'super', '#e8641a', { grip: 1.16 }),
  C('mclaren', 'Artura', '', 2023, 2025, 'Exotic', 238000, 671, 531, 1500, 'RWD', 'turbo', '3.0L TT V6 Hybrid', '8DCT', 8500, 'super', '#1b4fc4', { grip: 1.14 }),
  C('mclaren', '765LT', '', 2021, 2022, 'Supercar', 360000, 755, 590, 1339, 'RWD', 'turbo', '4.0L TT V8', '7DCT', 8500, 'super', '#e8641a', { grip: 1.2 }),
  C('mclaren', 'P1', '', 2014, 2015, 'Supercar', 1150000, 903, 664, 1490, 'RWD', 'turbo', '3.8L TT V8 Hybrid', '7DCT', 8500, 'super', '#e8c21a', { market: 1800000, grip: 1.2 }),
  C('pagani', 'Huayra', '', 2012, 2018, 'Supercar', 2600000, 730, 738, 1350, 'RWD', 'turbo', '6.0L AMG TT V12', '7AT', 6500, 'super', '#9aa0a8', { market: 3000000, grip: 1.18 }),
  C('bugatti', 'Veyron', '16.4', 2005, 2011, 'Supercar', 1700000, 1001, 922, 1890, 'AWD', 'turbo', '8.0L Quad-Turbo W16', '7DCT', 6500, 'super', '#0b1f4d', { market: 1800000, grip: 1.15, lim: 253 }),
  C('bugatti', 'Chiron', '', 2017, 2022, 'Supercar', 3000000, 1479, 1180, 1995, 'AWD', 'turbo', '8.0L Quad-Turbo W16', '7DCT', 6700, 'super', '#1b4fc4', { grip: 1.2, lim: 261 }),
  C('koenigsegg', 'Agera', 'RS', 2015, 2018, 'Supercar', 2500000, 1341, 1011, 1395, 'RWD', 'turbo', '5.0L TT V8', '7DCT', 8250, 'super', '#e8641a', { market: 6000000, grip: 1.2 }),
  C('koenigsegg', 'Jesko', 'Attack', 2022, 2025, 'Supercar', 3000000, 1600, 1106, 1420, 'RWD', 'turbo', '5.0L TT V8 (on E85)', '9DCT', 8500, 'super', '#f2f2f2', { grip: 1.25 }),
];

export const CAR_BY_ID = Object.fromEntries(CARS.map(c => [c.id, c]));

export function carName(model, year) {
  const y = year ? `${year} ` : '';
  return `${y}${MAKES[model.make]} ${model.model}${model.trim ? ' ' + model.trim : ''}`;
}

// Is it still sold new? (Dealers only stock current models.)
export function soldNew(model) { return model.years[1] >= CURRENT_YEAR - 1; }
