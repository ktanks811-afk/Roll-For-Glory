# Murda Worth Street Racing

**Build your car. Build your name.**

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
- **Vega Kustoms design studio.** Try paint (any color, gloss to chrome),
  rims (style, color, size and stance), tint, body kits, wings, hoods,
  lights, underglow, graphics and interiors on your car with a live side and
  top view before you spend anything. One bill covers parts, labor and tax,
  and a live show score tells you what the judges would think.
- **Car shows at the Stockyards.** Saturdays and Sundays, 10 AM to 6 PM.
  Enter your build against five others (street regulars and local builds:
  slab, JDM, muscle, euro and stance), look over every car, cast your
  People's Choice vote, then watch 240 voters split the crowd. Each voter has
  a taste, so the best build usually wins but not always. Top three take
  cash, rep and a trophy.
- **Garage.** A spec sheet, condition, value, a dyno with your power and
  torque curves against the factory curves, and your car collection.
- **Tuning (Garage → Tune).** Set the car up the way a real tuner would, with
  live 0-60, quarter-mile, top speed, grip, balance and knock readouts:
  boost, ignition timing, WOT air/fuel ratio, rev limiter and traction
  control; final drive and individual gear ratios; ride height, spring
  rates, bump/rebound damping and sway bars; camber and toe; tire pressures;
  brake bias; diff accel/decel lock; and wing angle. Each needs the hardware
  that makes it adjustable in real life (a stock ECU is locked, lowering
  springs aren't adjustable, an open diff has nothing to set). Push the
  engine map too far and it knocks: power drops and the engine wears every
  time you go wide open. Stock, Drag, Track and Drift presets to start from.
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
  shrinks with speed and a light counter-steer assist catches slides. Cars are planted by
  default: they only get greasy and tail-happy once the tires are worn to 10%
  or less (the handbrake still slides on purpose). Turning is
  instant: the wheel follows the arrow or stick immediately, and a turn assist
  adds the missing yaw if the front tires are pushing, so a held left or right
  always turns the car as hard as the tires allow.
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
- **Gig shifts (legit work you drive).** Phone → Hustle → Shifts, or the Hook
  & Haul Towing yard in Riverside Industrial. Delivery runs for Slice Brothers
  Pizza (pick up at a diner, beat the clock to the door), Ryde passengers (the
  rider walks to your car and rates you; hard stops, speeding and crashes cost
  stars and the tip), and tow calls (stop next to a broken-down car, it hooks
  to your dolly and trails behind you to the yard; over 60 it swings). Pay goes
  to the bank and grows with your rep tier, tips come in cash, and every clean
  shift in a row adds 5% (up to +50%). Staying legit is the point: an open
  warrant fails the background check, a police chase pulls you off the job,
  and an arrest suspends you for a day and wipes the streak.
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
- **Third-person camera.** While driving, press **V** (or the 🎥 button, or
  Settings → Camera view) to switch from the top-down view to a chase camera:
  the world turns so your car always points up the screen, you sit low on the
  screen so you see more road ahead, and it eases back to top-down when you get
  out. It's a rotating 2D view, not full 3D. C / ⌕ still zooms.
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
- **Phone home screen.** Status cards up top show your FWPD status
  (warrants, unpaid tickets), the mission you're on with its clock, where the
  GPS is taking you, and your latest unread text. Tap any card to jump to it.
  Messages is a list of conversations; open one to read it as a chat and
  answer offers right in the thread.
- **Missions by text.** Every few hours (once you have a car) someone you know
  texts you a job: Rosa needs a parts run, Manny's paint got dropped at the
  wrong place, Jojo needs a ride, Dre wants a sponsor driven to a meet (tier
  2), and Zed has a hot duffel bag (tier 2, pays best, but the pickup draws
  police heat and getting busted ends it). Take it in Messages or Phone →
  Missions. The GPS walks you through each stop, the HUD shows the clock,
  and the map numbers the stops. Make the last drop in time to get paid and
  earn rep; run out of time, bail, or get busted and you lose some rep.
- **Online crews (permanent).** Phone → Online Crew. Found a crew ($1,500 for
  jackets: name, 2–4 letter tag, colour, motto, open or invite-only) or join
  one that other real players run. Crews are stored in the Supabase project
  (`rfg_crews`, `rfg_crew_members`, `rfg_crew_requests`, `rfg_crew_chat`), so
  they stay up when nobody is online: members, rep totals, pending requests
  and the last chat messages are all still there when you come back. The
  browser lists every crew with member counts and total rep; members see who is
  online right now and which server they're on (and can hop to it), and your
  crew tag shows next to your name in online free roam. The leader accepts
  requests, kicks, edits the motto, flips open/invite-only, or disbands
  (the name and tag are freed). Chat is instant for people online (realtime)
  and saved for everyone else. There are no accounts: a player is a random
  public id plus a private key kept in their save; the tables have row level
  security and no policies, and everything goes through `rfg_*` SQL functions
  that check the key (only a sha256 hash of it is stored). Disbanding and
  leaving are soft deletes. `?net=local` swaps the database for a
  same-browser copy of the same rules, which is what the smoke test uses. The
  older single-player Crew app (NPC crews) is still there.
- **Crew turf.** Phone → Turf (or the Turf button in the Crew app). Every
  Fort Worth neighborhood belongs to a crew: Iron Saints run the Stockyards
  (North Side) and Riverside, Midnight Static the Near Southside and
  Lakeside, Velvet Ghosts Arlington Heights, Dust Devils Cross Timbers and
  Chisholm Flats, Apex Syndicate Downtown. Stop Six and Benbrook Hills start
  open. With a crew (your own, or an NPC crew you joined), drive around an
  open hood for about 45 seconds to claim it; the HUD shows the progress. A
  rival's hood takes a turf war: their members text you challenge races, and
  each win knocks their hold down by half until it breaks. Every morning your
  hoods pay street tax ($300 to $1,200 a day each, a 40% cut if you're a
  member rather than the founder), and rival crews sometimes move on one:
  beat their racer within two days or lose it. Leaving your crew gives its
  turf up. Rules live in `js/core/turf.js`, the app in `js/ui/turf.js`.
- **Guns, robberies and the Amazin' app.** Phone → Amazin' (a same-minute
  delivery store) sells **every Glock model and generation** (61 entries:
  G17 through G48, G17L, G19X, G30S, G40 MOS, G43X and more, with real calibers
  and magazine sizes), **AR pistols**, melee weapons, boxes of ammo, body armor
  and a concealed-carry holster. Handguns and AR pistols are 21+ (ID check), and
  the full-auto Glock 18 is never sold online. Deliveries land straight in your
  inventory (My gear tab: equip, load, sell).
  On foot: **G** draws or holsters, **J / Space / click** fires (a held trigger
  on a semi-auto fires slowly), **R** reloads. On touch the ARM, FIRE and
  RELOAD buttons appear next to RUN. Shots are loud: pedestrians scatter and
  the police are told.
- **FRT.** Buy a forced-reset trigger in Amazin' → Gear, then install it on a
  Glock from My gear. Holding the trigger fires full-auto, but the gun sprays
  wide, sometimes jams (press R to clear it) and sometimes dumps a burst on its
  own. Police treat it as a machine gun: heavy fine and the gun is confiscated.
- **Robbery.** Draw a gun next to a gas station, diner or clothing store and
  press **E**: the clerk empties the register while you keep the gun on them.
  Some stores have a silent alarm (cops get sent), some clerks pull a shotgun,
  a dye pack can ruin half the take, leave early and you only get part of it,
  and the same store is on alert for a day. Aim at a pedestrian and press E to
  mug them (witnesses may call 911). Get busted after a robbery or with an FRT
  and you lose the gun and a lot of cash. Health, armor and a hospital bill
  exist if a clerk gets you.
- **Carjackings.** Rarely (at most once every three in-game days, and
  mostly at night), when you sit still in your car in the city, a man in a
  ski mask walks up to your window with a pistol. Pull off before he gets
  there and he's gone. If he reaches you, you choose: **give it up** (he may
  take your cash too, and the cops find the car abandoned a couple of minutes
  later, beat up and low on gas, with your GPS set to it), **floor it**
  (usually works, but he may shoot and you can still lose the car), **pull
  your gun** if you carry one with ammo (usually keeps the car, but shots
  bring the cops, self-defense or not) or **fight him for it** barehanded
  (the worst odds). Getting shot costs health and can put you in the ER.
- **Police.** Five heat levels. A cop has to be close (about 65 m) and have
  line of sight. Speeding (30+ mph over) and burnouts have to go on for a few
  seconds before anyone reacts; running reds or hitting cars gets noticed at
  once. Fewer patrols cruise the city and noise complaints build slowly. Pursuit units drive in from precincts. When
  they lose you they set up a search zone, and you need a cooldown to
  escape. Roadblocks and spike strips start at level 4, and a helicopter
  joins at level 5. Getting busted means fines and impound.
- **Warrants.** Escape a pursuit, or get away with a robbery or a shooting,
  and a warrant goes out in your name. Tickets you sign for instead of paying
  are due in 3 game days; miss the date and they become a warrant too. Open
  warrants stay with your account's save. While you have one, patrols run
  your plate and recognise you on foot, and a traffic stop becomes an arrest.
  Pay tickets and misdemeanour warrants in the FWPD phone app or at a
  precinct; felony warrants clear only by turning yourself in at a precinct
  (25% off the fines) or by getting arrested (full price).
- **Courts and jail.** Getting arrested for more than a ticket files a case
  at the Tarrant County Courthouse downtown. Charges follow the Texas Penal
  Code classes (Class B and A misdemeanours, state jail felony, 3rd, 2nd and
  1st degree). A magistrate sets bail and a court date 2–3 game days out: sign
  a free personal bond (first-time misdemeanours), post cash bail (refunded
  when you show up), pay a bondsman 10%, or sit in jail until court (the time
  counts toward your sentence). Show up between 8 AM and 5 PM on the day; miss
  it and it's a bail-jumping warrant, your bail is forfeited and you won't get
  bail again. At the hearing the DA offers a plea deal, or you go to trial
  with a public defender or a paid lawyer. First-timers on misdemeanours get
  deferred adjudication; felonies mean state jail or TDCJ, with parole (half
  time for aggravated crimes). Priors make everything worse, and a new
  conviction on probation revokes it. Time inside runs on a jail screen
  (10 years ≈ two weeks of game time); you lose jobs if you're gone 2+ days
  and pay impound storage. Unpaid fines are sat out at $150 a day.
- **Masks and blackout gear.** Riverside Army Surplus sells a black ski mask
  (Vortex, a made-up brand), a bandana and all-black clothes, or the whole
  blackout fit as a set. Pull the mask down and up with **V** (or the MASK
  button on a phone). A crime done in a mask and all black, especially at
  night, often can't be tied to you: no warrant, less heat, and patrols
  can't match your face. Plates still give you away. Walking around masked
  for no reason gets you stopped and questioned, and with a warrant that
  stop is an arrest.
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
| Draw / holster, fire, reload a gun | ARM, FIRE, RE-LOAD (appear once you own a gun) |

| Driving | |
| --- | --- |
| Steer | ◀ ▶ arrows (bottom left), or a steering wheel you drag round (Settings → Touch steering, or the STEER MODE button while driving) |
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
⌕ zoom, 🎥 camera view, ☎ phone. It works in portrait and landscape.

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
