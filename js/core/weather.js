// Weather and the night shift. One table drives everything the sky changes:
// tire grip on the street and in roll races, how far a cop can make you out,
// and how the screen looks. The night shift puts more FWPD units on the road.

import { hourOf } from './state.js';

export const WEATHER = {
  clear:  { name: 'Clear',        icon: '☀', grip: 1,    sight: 1,    rain: 0 },
  cloudy: { name: 'Cloudy',       icon: '☁', grip: 1,    sight: 1,    rain: 0 },
  rain:   { name: 'Rain',         icon: '🌧', grip: 0.74, sight: 0.85, rain: 1 },
  storm:  { name: 'Thunderstorm', icon: '⛈', grip: 0.64, sight: 0.7,  rain: 1.8 },
  fog:    { name: 'Fog',          icon: '🌫', grip: 0.94, sight: 0.6,  rain: 0 },
};
export const wx = s => WEATHER[s.weather] || WEATHER.clear;
export const isWet = s => wx(s).rain > 0;

// Fort Worth weather sticks around: each hour it usually holds, and when it
// turns it moves to a neighbour (clouds before rain, rain before a storm).
const NEXT = {
  clear:  [['clear', 0.86], ['cloudy', 0.11], ['fog', 0.03]],
  cloudy: [['cloudy', 0.62], ['clear', 0.2], ['rain', 0.15], ['fog', 0.03]],
  rain:   [['rain', 0.68], ['cloudy', 0.2], ['storm', 0.12]],
  storm:  [['storm', 0.55], ['rain', 0.45]],
  fog:    [['fog', 0.6], ['clear', 0.25], ['cloudy', 0.15]],
};
export function nextWeather(cur, r = Math.random()) {
  const row = NEXT[cur] || NEXT.clear;
  for (const [w, p] of row) { if ((r -= p) < 0) return w; }
  return row[0][0];
}

export function weatherToast(w) {
  return {
    clear: 'Weather: skies clearing up',
    cloudy: 'Weather: clouds rolling in',
    rain: 'Weather: rain moving in, roads are slick',
    storm: 'Weather: thunderstorm, roads are flooded and grip is way down',
    fog: 'Weather: fog settling in, cops can\'t see as far',
  }[w];
}

// Night shift runs 8 PM to 5 AM, heaviest after midnight once the clubs let out.
export function nightShift(t) {
  const h = hourOf(t);
  if (h >= 0 && h < 4) return 2;
  if (h >= 20 || h < 5) return 1;
  return 0;
}
// Extra patrol cars cruising near you, and extra units on a pursuit.
export const extraPatrols = t => nightShift(t);
export const extraUnits = t => nightShift(t) ? 1 : 0;
