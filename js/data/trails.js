// Cross Timbers Trail Park: 4-wheeler trails in the cedar and post-oak
// country east of FM 2481, south of Granbury. The park is a fenced lot with
// an office and a rental barn by the road, and three marked trails you ride
// against the clock or against a local (world2d/streetRace.js runs them,
// ui/trails.js sets them up). Buy the park and it's yours to run: rental
// quads, trail horses and weekend trail rides (core/outfitters.js).
// Positions are metres, -z is north. Every trail leg runs north-south or
// east-west so world2d/trails.js can lay it as a dirt strip. No imports.

export const TRAIL_LOT = { x0: -4925, z0: 2600, x1: -4200, z1: 3400 };
export const TRAIL_OFFICE = { x: -4905, z: 2682, w: 26, d: 36 };      // office + rental barn by the gate
export const TRAIL_W = 9;                                            // dirt trail width (m)

// kind 'circuit' laps back to the start; 'sprint' ends at the last corner.
// The ride starts 45 m down the first leg (data/streetRaces.js START_IN).
export const TRAILS = [
  { id: 'tr_creek', name: 'Creek Loop', kind: 'circuit', laps: 2, tier: 1, record: 74,
    desc: 'Two laps round the creek bottom. Flat, fast, a little mud in the corners. Where everybody starts.',
    corners: [[-4860, 2760], [-4620, 2760], [-4620, 2960], [-4860, 2960]] },
  { id: 'tr_cedar', name: 'Cedar Ridge Run', kind: 'sprint', tier: 2, record: 88,
    desc: 'Up through the cedar brakes, across the ridge and down the far fence line. Tight, blind, and long.',
    corners: [[-4860, 2640], [-4420, 2640], [-4420, 2840], [-4260, 2840], [-4260, 3120], [-4540, 3120], [-4540, 3360], [-4860, 3360]] },
  { id: 'tr_bog', name: 'Mud Bog Gauntlet', kind: 'circuit', laps: 2, tier: 3, record: 96,
    desc: 'Two laps of switchbacks through the bottoms by the stock tank. Ninety-degree turns all the way round.',
    corners: [[-4580, 2760], [-4480, 2760], [-4480, 2900], [-4340, 2900], [-4340, 3040], [-4480, 3040], [-4480, 3200], [-4580, 3200]] },
];
export const TRAIL_BY_ID = Object.fromEntries(TRAILS.map(t => [t.id, t]));

// The locals who ride here. car is a ride from data/cars.js plus parts by stage.
export const TRAIL_RIDERS = [
  { id: 'tr_mudcat', name: 'Bubba Reyes', nick: 'Mudcat', skill: 0.55, tier: 1, car: { model: 'polaris_sportsman_570_2021', parts: { tires: 1 }, visual: { paint: '#4a5232' } } },
  { id: 'tr_dixie', name: 'Dixie Calhoun', nick: 'Dixie', skill: 0.7, tier: 2, car: { model: 'yamaha_raptor_700r_2016', parts: { exhaust: 2, intake: 1, tires: 2 }, visual: { paint: '#1b4fc4' } } },
  { id: 'tr_tank', name: 'Terrence "Tank" Mayfield', nick: 'Tank', skill: 0.75, tier: 2, car: { model: 'canam_outlander_xt_p_1000r_2022', parts: { tires: 2, exhaust: 1 }, visual: { paint: '#e8c21a' } } },
  { id: 'tr_coyote', name: 'Junior Whitlock', nick: 'Coyote', skill: 0.9, tier: 3, car: { model: 'canam_outlander_xt_p_1000r_2022', parts: { exhaust: 3, intake: 2, ecu: 2, tires: 3, suspension: 2 }, visual: { paint: '#0d0d0d' } } },
];
export const TRAIL_RIDER_BY_ID = Object.fromEntries(TRAIL_RIDERS.map(r => [r.id, r]));
