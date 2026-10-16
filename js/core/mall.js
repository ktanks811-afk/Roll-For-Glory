// The mall, the part with no screen: hours and what happens when you walk
// around for an hour (ui/mall.js shows it). DOM-free, tested in check-data.

import { MALL_WALK, mallOpen } from '../data/malls.js';
import { hourOf, addFollowers, earn } from './state.js';
import { addPost, myHandle } from './feed.js';

export const isOpen = s => mallOpen(s.time.day, hourOf(s.time));

function pickWeighted(table, rng) {
  let t = rng() * table.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of table) if ((t -= w) <= 0) return k;
  return table[table.length - 1][0];
}

// An hour walking the mall. Applies what happened and returns { kind, text }.
// (The caller moves the clock.)
export function walkMall(s, mall, rng = Math.random) {
  const kind = pickWeighted(MALL_WALK, rng);
  const fans = Math.max(0, s.followers || 0);
  switch (kind) {
    case 'recognized': {
      const n = 3 + Math.round(rng() * (2 + Math.sqrt(fans) / 4));
      addFollowers(s, n);
      return { kind, n, text: `Somebody stops you by the escalator: "Ain't you ${myHandle(s)}?" They post a selfie with you. +${n} followers.` };
    }
    case 'number': {
      addFollowers(s, 2);
      return { kind, n: 2, text: `You leave ${mall.name} with a number in your phone and two new followers.` };
    }
    case 'fitpic': {
      const p = addPost(s, { text: `Fit check at ${mall.name} 📸`, mine: true, rng });
      const n = Math.max(1, Math.round(p.likes / 30));
      addFollowers(s, n);
      return { kind, n, text: `Fit pic by the fountain. ${p.likes} likes on Throttle, +${n} followers.` };
    }
    case 'drop': {
      const flip = 60 + Math.round(rng() * 140);
      earn(s, flip, `${mall.name}: flipped a pair of kicks`);
      return { kind, n: flip, text: `A sneaker drop line wraps past the food court. You cop two pairs at retail and flip one in the parking lot for $${flip} profit.` };
    }
    case 'security': {
      if ((s.heat || 0) >= 2) {
        s.heat = Math.min(5.99, s.heat + 0.4);
        return { kind, hot: true, text: 'Mall security matches your face to a BOLO and radios FWPD. Your heat went up. Leave.' };
      }
      return { kind, text: 'Two mall cops on Segways follow you from store to store for an hour. Nothing comes of it.' };
    }
    default:
      return { kind: 'window', text: 'You walk laps, window shop and people-watch. Nothing to report.' };
  }
}
