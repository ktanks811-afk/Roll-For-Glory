// The "profile" for every kind of part: what it is, how it works in a real
// car, what each stage means, what it needs to live, and what it does here.
// `needs` lists the supporting mods (category ids) a build should have.

export const PART_ICONS = { engine: '⚙', turbo: '🌀', supercharger: '🔩', intake: '🌬', exhaust: '💨', intercooler: '❄', fuel: '⛽', ecu: '💻', transmission: '⚙', clutch: '◎', diff: '⊕', suspension: '⇕', brakes: '⛔', tires: '◯', dragpack: '🏁', wheeliebar: '⫠', weight: '⚖', nitrous: '🧪', twostep: '🔥',
  wheels: '◉', paint: '🎨', tint: '▦', spoiler: '⎺', kit: '▭', frontBumper: '▔', rearBumper: '▁', skirts: '═', hood: '▱', exhaustTips: '◍', headlights: '💡', taillights: '🔴', decal: '✦', neon: '✺', interior: '💺' };

export const PART_INFO = {
  engine: {
    what: 'The parts inside the motor: pistons, connecting rods, crankshaft, bearings, head studs, valve springs and cams.',
    how: 'Factory pistons and rods are cast. They\'re fine at stock power, but boost and nitrous raise cylinder pressure until a piston cracks or a rod lets go. Forged pistons and rods, stronger head studs and stiffer valve springs take far more pressure and rpm.',
    stages: ['Stage 1: cams, valve springs. A bit more power and rpm.', 'Stage 2: forged pistons & rods. Safe for real boost.', 'Stage 3: forged crank, studs, ported head. Big boost.', 'Stage 4: billet race motor. Takes almost anything.'],
    needs: [],
    game: 'Adds power and redline, and raises how much power over stock the engine survives. Every boost, blower and nitrous build eventually needs this.',
  },
  turbo: {
    what: 'A turbocharger: a turbine spun by exhaust gas that drives a compressor, forcing more air into the engine.',
    how: 'More air means more fuel can be burned, so more power. It takes a moment for exhaust flow to spin the turbo up (turbo lag), then power comes on hard. The wastegate caps the boost. A bigger turbo makes more top-end power with more lag.',
    stages: ['Stage 1: small kit, low boost (≈7 psi on an NA car).', 'Stage 2: mid kit (≈10 psi).', 'Stage 3: big single (≈14 psi).', 'Stage 4: race turbo (≈20 psi).'],
    needs: ['ecu', 'fuel', 'intercooler', 'engine'],
    danger: 'Adding a turbo without a tune, fuel and (at higher stages) forged internals is how people blow motors. Stock ECUs can\'t fuel the boost, so the motor runs lean and detonates.',
    game: 'Big power gains with lag before boost builds. Boost is adjustable in Garage → Tune once you have an ECU tune.',
  },
  supercharger: {
    what: 'A belt-driven air pump (roots, twin-screw or centrifugal) that forces air into the engine.',
    how: 'Driven straight off the crank, so boost is instant with no lag. It costs some power to spin. A smaller pulley spins it faster for more boost.',
    stages: ['Stage 1: low-boost kit.', 'Stage 2: street kit with pulley.', 'Stage 3: big blower.', 'Stage 4: race blower.'],
    needs: ['ecu', 'fuel', 'intercooler', 'engine'],
    danger: 'Same as a turbo: no tune, no fuel or stock internals at high boost and the engine knocks itself to death.',
    game: 'Instant boost right off idle. You can\'t run a turbo and a blower at the same time.',
  },
  intake: {
    what: 'A cold air intake: a bigger, smoother filter and tube that pulls cooler air from outside the engine bay.',
    how: 'Cooler, denser air with less restriction lets the engine breathe a little better. On its own it\'s a small gain, but bigger with a tune.',
    stages: ['Stage 1: drop-in filter.', 'Stage 2: cold air intake.', 'Stage 3: big intake + throttle body.', 'Stage 4: ported intake manifold.'],
    needs: [],
    game: 'A few percent more power. Safe on any build.',
  },
  exhaust: {
    what: 'Headers, downpipes, cat-back systems and mufflers.',
    how: 'Freer-flowing exhaust lets the engine push spent gas out easier, especially at high rpm. It also gets much louder, and cops and neighbours notice.',
    stages: ['Stage 1: cat-back.', 'Stage 2: headers / downpipe.', 'Stage 3: long-tube headers + straight pipe.', 'Stage 4: open race exhaust.'],
    needs: [],
    game: 'More power and a lot more noise. Too loud gets you pulled over for a noise violation.',
  },
  intercooler: {
    what: 'A radiator for the intake air (or a water/meth injection kit) on turbo and supercharged cars.',
    how: 'Compressing air heats it up. Hot air is less dense and makes the engine detonate. The intercooler cools the charge so you get more power and a safer engine.',
    stages: ['Stage 1: upgraded core.', 'Stage 2: front-mount.', 'Stage 3: big front-mount / air-to-water.', 'Stage 4: water-meth injection.'],
    needs: [],
    game: 'More power on boosted cars and keeps an add-on turbo or blower from detonating. Does nothing on a naturally aspirated car.',
  },
  fuel: {
    what: 'Fuel pump, injectors, fuel rails and lines (and E85 conversions at the top).',
    how: 'Making power means burning more fuel. Once the injectors are wide open and the pump can\'t keep up, the mixture goes lean, cylinder temps spike and pistons melt.',
    stages: ['Stage 1: high-flow pump.', 'Stage 2: bigger injectors + pump.', 'Stage 3: E85 / flex fuel.', 'Stage 4: dual pumps, huge injectors.'],
    needs: [],
    game: 'Raises the ceiling on how much power the engine can be fuelled for. Past it you\'re fuel-limited, and if you push past it with boost the engine goes lean and wears out.',
  },
  ecu: {
    what: 'The engine computer\'s tune: a reflash, piggyback or standalone ECU (Cobb, HP Tuners, Hondata, Haltech, MoTeC).',
    how: 'The ECU decides how much fuel to inject and when to fire the spark. A tune adds power, raises the rev limit, removes speed limiters and, most importantly, adjusts fuel and timing for added boost.',
    stages: ['Stage 1: off-the-shelf flash.', 'Stage 2: custom tune, launch control, traction control.', 'Stage 3: pro dyno tune.', 'Stage 4: standalone race ECU.'],
    needs: [],
    game: 'More power and rpm, unlocks the engine map in Garage → Tune, and is required for any added turbo or blower to survive.',
  },
  transmission: {
    what: 'The gearbox: shift kits, built automatics, dual-clutch upgrades and sequential boxes.',
    how: 'Faster shifts waste less time between gears. Built gearboxes also take more torque and let you change individual gear ratios.',
    stages: ['Stage 1: shift kit.', 'Stage 2: built box, custom gear ratios.', 'Stage 3: race box.', 'Stage 4: sequential / dog box.'],
    needs: [],
    game: 'Quicker shifts, and stage 2+ unlocks individual gear ratios in Garage → Tune.',
  },
  clutch: {
    what: 'The clutch and flywheel that connect the engine to the gearbox.',
    how: 'A stock clutch slips when the engine makes much more torque than stock. Stronger clutches (multi-plate, ceramic) hold the power.',
    stages: ['Stage 1: heavy-duty disc.', 'Stage 2: stronger pressure plate.', 'Stage 3: twin-disc.', 'Stage 4: triple-disc race clutch.'],
    needs: [],
    game: 'Holds more torque on launch so the clutch doesn\'t slip off the line.',
  },
  diff: {
    what: 'The differential: a limited-slip diff (LSD) instead of an open one.',
    how: 'An open diff sends power to the wheel with the least grip, so one tire spins. An LSD locks the drive wheels together so both push.',
    stages: ['Stage 1: clutch-type LSD.', 'Stage 2: 1.5-way LSD.', 'Stage 3: 2-way LSD.', 'Stage 4: spool / race diff.'],
    needs: [],
    game: 'More traction putting power down. Unlocks accel/decel lock in Garage → Tune.',
  },
  suspension: {
    what: 'Springs, dampers (shocks), sway bars and coilovers.',
    how: 'Lower and stiffer means less body roll and weight transfer, so the tires stay planted. Coilovers let you set ride height, damping and more.',
    stages: ['Stage 1: lowering springs.', 'Stage 2: coilovers (adjustable height, damping, sway bars).', 'Stage 3: double-adjustable + camber plates.', 'Stage 4: race coilovers.'],
    needs: [],
    game: 'Better cornering grip. Stage 2+ unlocks suspension tuning in Garage → Tune.',
  },
  brakes: {
    what: 'Big brake kits: bigger rotors, multi-piston calipers, pads and lines.',
    how: 'More clamping force and heat capacity so the car stops shorter and doesn\'t fade.',
    stages: ['Stage 1: pads, lines.', 'Stage 2: big brake kit with bias valve.', 'Stage 3: 6-piston kit.', 'Stage 4: carbon-ceramic.'],
    needs: [],
    game: 'Shorter stops. Stage 2+ unlocks brake bias in Garage → Tune.',
  },
  tires: {
    what: 'Street performance tires, drag radials and slicks.',
    how: 'Softer, stickier rubber grips harder but wears faster. Drag radials have soft sidewalls that wrinkle and hook on launch.',
    stages: ['Stage 1: performance tires.', 'Stage 2: max-performance.', 'Stage 3: drag radials / R-comp.', 'Stage 4: slicks.'],
    needs: [],
    game: 'More grip for launching and cornering. Wheelspin wears them out, and bald tires get greasy.',
  },
  dragpack: {
    what: 'A drag pack: wide drag radials or slicks on the drive wheels, skinny "front runner" tires up front, and on the bigger packs adjustable drag shocks and traction bars.',
    how: 'Drag radials and slicks are soft, sticky rubber with sidewalls that wrinkle and plant on launch, so the car hooks instead of spinning. The shocks let the front rise and the rear squat so weight comes back onto the tires. Put enough power through all that grip and the front end keeps coming up: a wheelie. A little lift is fast. Too much and the car is going up instead of forward, and a big one can stand it straight up.',
    stages: ['Stage 1: drag radials + skinnies.', 'Stage 2: radials, skinnies + adjustable drag shocks.', 'Stage 3: street slicks / traction bars + double-adjustable shocks.', 'Stage 4: pro slicks on beadlocks + race drag shocks.'],
    needs: [],
    danger: 'Big power on a drag pack wheelies. Tune it out in Garage → Tune → Drag launch: stiffer front shock extension and rear compression, less boost or power in 1st and 2nd gear, a lower 2-step launch rpm, or add wheelie bars. Skinnies also give up grip in corners.',
    game: 'Hooks off the line so you don\'t spin. Rear-wheel-drive cars (and AWD with a lot of power) can wheelie. Front-drive cars just get the grip. Stage 2+ opens drag shock tuning.',
  },
  wheeliebar: {
    what: 'Wheelie bars: two arms off the back of the car with small wheels that catch the rear bumper before the nose goes too high.',
    how: 'The bars let the front come up a few inches, which is the fast way to launch, then stop it there. Set them too high and it still wheelies. Set them too low and the bars hit the track and lift weight off the rear tires, so it spins.',
    stages: ['Stage 1: bolt-on, fixed height.', 'Stage 2: adjustable height.', 'Stage 3: chromoly, adjustable.', 'Stage 4: pro bars with shocks.'],
    needs: ['dragpack'],
    game: 'Caps how high the front can go so you can stay in it. Rear-wheel drive only. Stage 2+ lets you set the height in Garage → Tune → Drag launch.',
  },
  weight: {
    what: 'Weight reduction: carbon panels, lightweight seats, stripped interior, lithium battery.',
    how: 'Less mass to accelerate, stop and turn. Every 100 lb is worth about a tenth in the quarter mile.',
    stages: ['Stage 1: light seats.', 'Stage 2: stripped interior.', 'Stage 3: carbon panels.', 'Stage 4: full race strip.'],
    needs: [],
    game: 'Quicker acceleration and better handling.',
  },
  nitrous: {
    what: 'A nitrous oxide kit: a bottle, solenoids and a nozzle or plate that sprays N2O into the intake.',
    how: 'Nitrous breaks down into extra oxygen in the cylinder, so more fuel can be burned. A "shot" is the power it adds, e.g. a 100 shot. It\'s instant power, but a big shot on a stock motor is the classic way to break a piston.',
    stages: ['Stage 1: 50 shot.', 'Stage 2: 100 shot.', 'Stage 3: 175 shot.', 'Stage 4: 250 shot.'],
    needs: ['fuel', 'engine'],
    danger: 'A big shot on stock internals or a stock fuel pump goes lean and breaks pistons. It only hurts while you\'re spraying.',
    game: 'Hold N / NOS for a burst of power until the bottle is empty. Refill at the garage.',
  },
  twostep: {
    what: 'A 2-step launch controller: a second rev limiter for the start line.',
    how: 'Hold the throttle wide open on the line and it holds the rpm at your set launch point, cutting spark to build boost. That\'s the pops and flames.',
    stages: ['Stage 1: basic 2-step.', 'Stage 2: tighter hold.', 'Stage 3: anti-lag.', 'Stage 4: race launch control.'],
    needs: [],
    game: 'Hold gas + brake to hold your launch rpm and shoot flames. Set the rpm in Garage → Tune.',
  },
  // ---- looks ----
  wheels: { what: 'Aftermarket wheels.', how: 'Lighter forged wheels cut unsprung weight. Mostly it\'s the look.', game: 'Changes how the car looks.' },
  paint: { what: 'Paint, wraps and paint protection film.', how: 'A respray or vinyl wrap changes the colour and finish.', game: 'Changes how the car looks.' },
  tint: { what: 'Window tint.', how: 'Darker film on the glass. Limo tint is illegal on the front windows in a lot of places.', game: 'Changes how the car looks.' },
  spoiler: { what: 'Wings and spoilers.', how: 'A real wing makes downforce at speed, pushing the rear tires into the road at the cost of some drag.', game: 'An adjustable GT wing adds rear downforce, with the angle set in Garage → Tune. Others are looks.' },
  kit: { what: 'Body kits and widebody kits.', how: 'Bumpers, skirts and fender flares. Widebody kits make room for wider wheels.', game: 'Changes how the car looks.' },
  frontBumper: { what: 'Front lips and splitters.', how: 'A splitter can add a little front downforce. Mostly looks.', game: 'Changes how the car looks.' },
  rearBumper: { what: 'Rear diffusers.', how: 'Shapes the air leaving under the car. Mostly looks on a street car.', game: 'Changes how the car looks.' },
  skirts: { what: 'Side skirts.', how: 'Fills in the gap under the doors.', game: 'Changes how the car looks.' },
  hood: { what: 'Aftermarket hoods.', how: 'Vented and carbon hoods drop weight and let heat out of the engine bay.', game: 'Changes how the car looks.' },
};

// Which mods support which. Returns [{ cat, ok }] for the part's needs against a car's levels.
export function supportCheck(cat, lv, model) {
  const info = PART_INFO[cat];
  if (!info?.needs?.length) return [];
  return info.needs
    .filter(n => !(n === 'intercooler' && cat === 'nitrous'))
    .map(n => ({ cat: n, ok: (lv[n] || 0) >= (n === 'engine' ? 2 : 1) || (n === 'intercooler' && model?.asp !== 'na') }));
}
