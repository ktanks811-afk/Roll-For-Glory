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
  Checkout adds sales tax and shipping, and orders are delivered
  instantly into My Parts.
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
- **2-step launch control.** A purchasable part (PartsHub → Power Adders, 23
  products from MSD, Haltech, FuelTech, Cobb and more, stages 1–4, with real
  fitment). Hold gas + brake together and it holds your launch rpm (set in
  Garage → Tune) and throws flames out the exhaust tips. Higher stages hold
  tighter and burn bigger. Flames come only from a 2-step. It works on the
  drag strip, at street meets (Rev it) and when you're stopped on the street.
  Not for EVs.
- **Burnouts (no 2-step needed).** Gas + brake together without a 2-step is a
  burnout: the brakes pin the car, the driven wheels light up (rear on RWD,
  front on FWD, both on AWD), the engine bounces off the limiter, and you get
  smoke, skid marks, tire wear and tire-temp. Turn the wheel for donuts. Cops
  that see one will write it up as an exhibition of speed.
- **Real driving model.** Each axle has a slip angle and a tire curve that
  peaks and lets go, weight moves forward under braking and back under power,
  and a friction circle means a tire can't corner and brake or put power down
  at once. So FWD pushes wide when you floor it mid-corner, RWD snaps its tail
  out, trail-braking rotates the car, the handbrake swings the rear, and
  grip, tires and suspension parts change how all of it feels. Steering lock
  shrinks with speed and a light counter-steer assist catches slides.
- **Buildings, not circles.** Every shop, dealer, diner, precinct and gas
  station is a building with its front door and a striped awning on the street
  side, right behind the kerb marker, so you pull up to it. Race starts have
  a banner gantry over the road.
- **Drive-in garages.** Your home and every property you buy is a garage
  building. Pull up and the HUD says "Drive into the garage". Once you're
  inside the roof fades away and you can see all your other cars parked in
  the bays (filled home-first, up to the property's slots). Press E inside to
  open the garage. A property you haven't bought keeps its door shut.
- **Online servers.** Title screen → Play Online (or Pause → Online Free
  Roam) opens a server browser: eight named servers (Harbor, Downtown, Eastgate,
  Ironside, Dustline, Northridge, Pier 9, Glory Row), 16 players each, with live
  player counts and a Quick Join that drops you where people are. Everyone on a
  server shares the map live: their cars with the real paint/parts, name tags,
  minimap dots, horns, 2-step flames, and chat. Police stay active online: your
  own city's cops chase you as usual. It uses Supabase Realtime *broadcast and
  presence* only — no tables, no accounts, nothing stored — and all incoming
  data is sanitised. The 16-player cap is enforced by the clients (a full
  server turns the latest joiner away). Cars don't collide online, and the
  clock/weather are per player. For testing without a server, open `?net=local`
  in two tabs of the same browser.
- **Side hustles (passive income).** Phone → Hustle. Take a job (delivery,
  rideshare, tow dispatcher, parts counter, valet, shop mechanic, pit crew
  chief), buy a business (food truck up to a stake in Ironline Dragway), or put
  your spare cars on the rental fleet. They pay into your bank every game day
  without you doing anything, and keep paying while the game is closed (a
  quarter of the normal rate, up to 8 hours). Businesses pay themselves back in
  about 30 game days, can be upgraded to level 3, and the big ones need rep.
  Random inspection fines, break-ins and viral days keep it interesting, and
  getting busted can cost you a job.
- **Side-view showroom (every car).** Garage → Showroom shows your car in HD
  side view, built from separate layers: base body, paint and finish (gloss,
  matte, metallic, pearl, chrome), front and rear wheels (six styles), brake
  calipers (colour follows your brake stage), exhaust tips, spoiler, front and
  rear bumpers, side skirts, headlights and taillights, window tint, hood,
  decals and liveries, underglow, ride height (lowers with suspension stages),
  wheel size (17–22") and offset (stock / flush / poke). Tick a layer to hide
  it, hit Change to jump to that part in PartsHub, or open the hood to see the
  engine bay: supercharger, turbo, intake, intercooler, long-tube headers,
  nitrous line. The Mustang GT and Dark Horse keep their hand-traced art; every
  other car is drawn from its own design sheet.
- **Every car is its own shape.** `js/data/carShapes.js` holds a design sheet
  per car: real length, width, height and wheelbase, a roofline archetype
  (sedan, fastback, hatch, notchback, muscle, long-hood roadster, mid-engine,
  rear-engine 911, wagon, crossover, boxy SUV, pickup) and the details that
  make it recognisable: doors, convertible, factory wing, headlight and
  taillight style, roof rails, hood scoop, side intakes, lift. The showroom and
  the HD overhead world sprites are both built from it, and the same real size
  drives collisions, so a Raptor is a lot bigger than a Civic.
- **Engine sound that matches the car.** Every car's engine note is built from
  its real firing pattern: cross-plane V8s lope (Mustang, Camaro, Hellcat),
  flat-plane V8s scream (Corvette Z06 C8, Ferrari, McLaren), inline-6s are
  smooth, boxers rumble (EJ Subarus with unequal-length headers; the FA20/FA24
  cars are smoother), the RX-7/RX-8 rotary brap, V10s/V12s/W16s each have their
  own voice, odd-fire V6s (Grand National) are lumpy, Hondas change their tune
  at the VTEC crossover, turbos whistle and flutter, Roots and twin-screw
  blowers whine differently, and EVs hum a motor whine. Exhaust parts make it
  louder, brighter and raspier, and from stage 2 it burbles on the overrun.
- **Loud exhausts get you pulled over.** Every exhaust part has a real dB
  rating. Cat-backs add a few dB, long tube headers add 15–20, and long tubes
  with straight pipes add over 20 and make the car way louder (in the mix too).
  The street limit is 95 dB: your dash shows a live NOISE reading, and cops
  within earshot — no line of sight needed — start paying attention. Once they
  have enough, a patrol pulls you over, or dispatch sends a unit to a noise
  complaint. A third noise ticket gets the car impounded.
- **Traffic stops.** Break the law where a cop can see you (speeding, running a
  red, a burnout, a hit-and-run, a loud exhaust) and you get "PULL OVER". Stop
  and the officer writes up everything they saw: accept the citation or try to
  talk your way out (it can work — or cost you 40% more). Keep going and it
  becomes a pursuit.
- **Minimap.** Sharp map tiles drawn from the real roads, buildings, parks and
  water; it turns with your heading (you sit low in the circle so you can see
  the road ahead), zooms out as you speed up, and shows the GPS route with a
  flag, or an arrow on the rim with the distance when the destination is off
  the map. Places are named when you're near, cops flash red and blue, chases
  pulse around you, roadblocks show as red Xs, the helicopter and other
  players show up, and the street name sits along the bottom. Tap it to switch
  between heading-up (auto zoom), close, far and north-up.
- **Phone Map.** A real map you can drag, pinch and zoom, drawn sharp from the
  city's roads and buildings, with every place pinned and named. Filter by
  Cars, Shops, Races & meets, Gas & food, Home or Police, or search by name.
  Tap a pin (or a row in the list, sorted by distance) to see what's there,
  the rep tier it needs, and how far it is by road with a time estimate, then
  hit Set GPS: the route lights up on the map right away and the minimap picks
  it up. Tap any empty spot to drop a pin and navigate there. Your car, cops
  and other players show up too.
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

Walking and driving use separate controls. Keys only do something in the
mode they belong to: car keys do nothing on foot, and walking keys do nothing
in the car.

**On foot**

| | |
| --- | --- |
| Walk | WASD or arrows |
| Run | Shift |
| Interact | E or Enter |
| Get in your car | F |

**In the car**

| | |
| --- | --- |
| Gas / brake and reverse | W / S |
| Steer | A / D or arrows |
| E-brake | Space |
| Nitrous | N or Shift |
| Shift up / down (manual) | E / Q |
| Horn | H |
| Interact (gas, races, shops) | Enter |
| Get out | F |

**Anywhere:** Phone P or Tab · Map M · Zoom C · Pause Esc

**On a phone** the on-screen controls change to match what you're doing:

| Walking | |
| --- | --- |
| Move | Joystick (bottom left) |
| Run | Hold RUN |
| Shops, homes, meets | USE |
| Get in your car | GET IN (stand next to it) |

| Driving | |
| --- | --- |
| Steer | ◀ ▶ arrows (bottom left) |
| Gas / brake and reverse | GAS and BRAKE pedals (bottom right) |
| Shift gears | Drag the shift knob up (upshift) or down (downshift) |
| Automatic / manual | Tap the shift knob (shows A or M) |
| Nitrous, e-brake, horn | NOS, E-BRK, HORN |
| Gas stations, races, shops | USE |
| Get out | GET OUT |

The game asks for landscape: your first tap goes fullscreen and locks the
screen to landscape (Android Chrome). Add it to your home screen and it opens
in landscape from launch. On iPhone, where browsers can't lock rotation, a
"Rotate your phone" screen appears in portrait (with a play-anyway button).

Multi-touch works, so you can steer with one thumb and work the pedals with
the other. Drag races use BRAKE + GAS together, and so do burnouts and the 2-step (hold both pedals). Top right: ☰ menu and save,
⌕ zoom, ☎ phone. It works in portrait and landscape.

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
