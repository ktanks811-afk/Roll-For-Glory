# Roll for Glory

**Build your car. Build your name. Roll for Glory.**

A 2D top-down open-world street racing life sim that runs in the browser. You
show up in Port Solace with $4,500 and no car. Find a tired, high-mileage
first car on Marketplace, bolt on real parts from real brands, run roll races
on the highway and passes at the drag strip, keep ahead of the cops, and work
your way up to the underground legends.

Play it: https://ktanks811-afk.github.io/Roll-For-Glory/

(The site is served from the `gh-pages` branch — push updates to both `main` and `gh-pages`.)

## What's in it

- **Real cars, real prices.** ~190 models across 48 makes, from a '96 Civic and a
  Volvo 240 to a Hellcat, GT-R, 911 Turbo S and Koenigsegg Jesko. Factory
  horsepower, torque, weight, drivetrain and gearbox. 0-60 and quarter-mile
  times come out of the physics sim instead of being typed in, and they land
  close to the real cars.
- **Marketplace.** A used-car app where cheap, high-mileage cars turn up all
  the time. Listings show mileage, title status (clean, rebuilt, salvage) and
  problems like slipping transmissions, burning oil or rod knock. You can
  message sellers, haggle (lowball too hard and they stop answering), pay
  title and tax, then go pick the car up. You can also list your own cars and
  take offers.
- **Dealerships.** New cars sell at MSRP plus destination, and hot models
  carry a market adjustment. Dealers also have certified pre-owned stock and
  take trade-ins. There's also Rusty's buy-here-pay-here lot.
- **PartsHub.** An online store with 400+ performance and visual parts from
  270+ real aftermarket brands: Garrett, BorgWarner, Precision, Whipple,
  ProCharger, Holley, Cobb, HP Tuners, Hondata, MoTeC, Haltech, Brembo,
  Wilwood, KW, Öhlins, Mickey Thompson, Hoosier, Nitrous Express, BBS, Volk,
  HRE, Akrapovič, Borla and more. Parts are checked for fitment against your
  car (a Hondata won't flash a Mustang, and a Tesla can't take a turbo).
  Checkout adds sales tax and shipping, and orders arrive at your door the
  next morning.
- **Installing parts.** Do it yourself at home for small jobs (it costs you
  in-game hours), or pay $125/hr shop labor at Torque Temple or Vega
  Kustoms. Every visual mod shows up on the car. So do big performance
  parts: intercooler, blower through the hood, drag radials, calipers,
  exhaust tips and the nitrous bottle.
- **Garage.** A spec sheet, condition, value, a dyno with your power and
  torque curves against the factory curves, final-drive tuning and your car
  collection.
- **Roll racing.** Choose an opponent, road, roll speed (30–70 mph),
  distance (⅛ mile to 1 mile) and a wager. Go on the third honk. Traffic,
  lane changes, drafting, nitrous and manual or automatic shifting are all in.
- **Drag racing at Ironline Dragway.** Burnout box, pre-stage and stage
  beams, sportsman or pro tree, holding the car on the brake, reaction time,
  red lights, and a full timeslip (RT, 60', 330', ⅛, 1000', ¼, trap speed).
- **Police.** Five heat levels. Patrols have to actually see you speeding,
  running reds or hitting cars. Pursuit units drive in from precincts. When
  they lose you they set up a search zone, and you need a cooldown to
  escape. Roadblocks and spike strips start at level 4, and a helicopter
  joins at level 5. Getting busted means fines and impound.
- **Life stuff.** A big city with day/night and weather, traffic that stops
  at signals, pedestrians, fuel, gas prices, insurance, repairs, food and
  energy, clothes, properties with garage space, a rideshare app, a bank
  app, a social app that earns followers and sponsors, crews, night street
  meets, side bets, and NPC racers who remember you.
- **Story mode.** Three chapters, with more marked as in development, plus
  free roam.
- **Saves.** Autosave, three manual slots, and backup files you can export
  and import.

## Controls

| | |
| --- | --- |
| Drive / walk | WASD or arrows |
| Get in / out | F |
| Interact | E or Enter |
| E-brake | Space |
| Nitrous | N or Left Shift |
| Shift up / down (manual) | E / Q |
| Phone | P or Tab |
| Map | M |
| Zoom | C |
| Pause / save | Esc |

On touch devices an on-screen stick and buttons appear.

## Running it locally

There's no build step. The game is plain JavaScript modules, so it has to be
served over `http://`. Opening `index.html` straight off disk won't work.

- **Windows:** double-click `serve.cmd`
- **Mac/Linux:** `./serve.sh`
- Or: `python3 -m http.server 8000` and open http://localhost:8000

## Layout

| Path | What's in it |
| --- | --- |
| `js/data/cars.js` | The car catalog (real specs, MSRP, collector values) |
| `js/data/catalog.js` | PartsHub products, fitment, tax and shipping |
| `js/data/market.js` | Used-car valuation and the Marketplace listing generator |
| `js/data/npcs.js`, `story.js`, `world.js`, `shops.js` | Racers, crews, story, map locations, clothes and food |
| `js/sim/powertrain.js` | The physics: torque curves, gearing, traction, shifting, nitrous, metrics |
| `js/world2d/` | Map generation, rendering, driving, traffic, police |
| `js/race2d/race.js` | Roll and drag races |
| `js/gfx2d/` | Procedural top-down car and character sprites |
| `js/ui/` | Phone, Marketplace, PartsHub, garage, places, meets, menus |
| `js/core/` | Save state, saves, input, synthesized audio, events, story runner |

## Checks

```bash
npm install
npm run check:data        # every car simulates sanely, catalog and NPC data are valid
python3 -m http.server 8123 &
npm run check:smoke       # headless playthrough; fails on any console error
```

CI runs both on every push and pull request.

---

Fan-made game. Real car and parts brand names are used to describe products,
with no affiliation or endorsement. Port Solace and its people are fictional.
