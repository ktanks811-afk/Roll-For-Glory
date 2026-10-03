// Carjackings: the rules, kept free of the DOM so check-data can test them.
//
// Every so often (rarely) someone walks up to your window while you're
// stopped in the city and wants the car. You choose: give it up (the car
// turns up abandoned a while later, a little worse for wear), floor it, pull
// your own gun, or fight for it. Resisting can get you shot.

export const CARJACK = {
  minPlaySecs: 20 * 60,    // never in the first 20 minutes of a career
  gapDays: 3,              // at most once every 3 in-game days
  // chance per second while you sit still in your car in the city
  perSec: { day: 1 / 5400, night: 1 / 1800 },
  approachSecs: 2.4,       // the walk from the sidewalk to your window
  findSecs: [60, 150],     // until the cops find your car abandoned
};

const between = (rng, a, b) => a + rng() * (b - a);

// Is a carjacking allowed to start right now?
export function canCarjack(c) {
  return !!(c.inCar && c.stopped && c.inCity && !c.policeActive && !(c.heat > 0.3) && !c.inGarage && !c.busy
    && c.playTime >= CARJACK.minPlaySecs && c.day >= (c.lastDay ?? -99) + CARJACK.gapDays);
}

// Chance of one starting over dt seconds (0 when it isn't allowed).
export function carjackChance(c, dt) {
  if (!canCarjack(c)) return 0;
  return (c.night ? CARJACK.perSec.night : CARJACK.perSec.day) * dt;
}

// The buttons on the carjacking card. Pulling your gun needs a loaded gun
// (or ammo for it); otherwise you can only fight him barehanded.
export function carjackChoices(armed) {
  return [
    { value: 'give', label: 'Give it up', primary: true },
    { value: 'flee', label: 'Floor it' },
    armed ? { value: 'gun', label: 'Pull your gun', danger: true } : { value: 'fight', label: 'Fight him for it', danger: true },
  ];
}

// What happens after you pick. Returns { keep, hurt, body, shots, wallet, rep, text }:
// keep  — you still have the car
// hurt  — damage you take (armor still soaks some of it)
// body  — damage to the car's body from bullets
// shots — rounds you fire (cops hear them)
// wallet — share of the cash on you he takes
export function resolveCarjack(choice, rng = Math.random) {
  const r = rng();
  const o = { keep: true, hurt: 0, body: 0, shots: 0, wallet: 0, rep: 0, text: '' };
  if (choice === 'give') {
    o.keep = false;
    o.wallet = r < 0.5 ? Math.round(between(rng, 0.3, 0.6) * 100) / 100 : 0;
    o.text = o.wallet
      ? '"Wallet too." He takes your cash, gets in and peels off. You\'re alive. The cops will look for the car.'
      : 'He gets in and peels off. You\'re alive. The cops will look for the car.';
  } else if (choice === 'flee') {
    if (r < 0.6) { o.body = Math.round(between(rng, 2, 8)); o.text = 'You stomp it. Two shots crack off the trunk, but you\'re gone.'; }
    else if (r < 0.88) { o.hurt = Math.round(between(rng, 18, 34)); o.body = Math.round(between(rng, 6, 14)); o.text = 'He fires through the glass as you pull off. You\'re hit, but you got away with the car.'; }
    else { o.keep = false; o.hurt = Math.round(between(rng, 24, 40)); o.text = 'You stall it. He fires, drags you out of the seat and takes off in your car.'; }
  } else if (choice === 'gun') {
    if (r < 0.55) { o.shots = 1; o.rep = 30; o.text = 'You come up with your gun first and fire a warning shot. He runs. Cops will have heard it.'; }
    else if (r < 0.9) { o.shots = 2 + Math.floor(rng() * 3); o.hurt = Math.round(between(rng, 12, 30)); o.body = Math.round(between(rng, 3, 10)); o.rep = 50; o.text = 'Shots both ways. You\'re hit, but he runs off holding his arm. The car is still yours.'; }
    else { o.keep = false; o.shots = 1; o.hurt = Math.round(between(rng, 28, 44)); o.text = 'He saw it coming. He fires first, pulls you out and takes the car.'; }
  } else if (choice === 'fight') {
    if (r < 0.3) { o.rep = 60; o.text = 'You grab his wrist and slam it into the door frame. The gun drops and he runs. Crazy.'; }
    else { o.keep = false; o.hurt = Math.round(between(rng, 25, 45)); o.text = 'He pistol-whips you, drags you out of the car and drives off in it.'; }
  }
  return o;
}

// The state your car is in when the cops find it.
export function strippedCar(car, rng = Math.random) {
  car.cond.body = Math.max(5, (car.cond.body ?? 100) - Math.round(between(rng, 8, 25)));
  car.cond.tires = Math.max(1, (car.cond.tires ?? 100) - Math.round(between(rng, 10, 30)));
  car.fuel = Math.min(car.fuel ?? 1, Math.round(between(rng, 0.04, 0.15) * 100) / 100);
  if (car.nos) car.nos = 0;   // he ran the bottle dry
}
