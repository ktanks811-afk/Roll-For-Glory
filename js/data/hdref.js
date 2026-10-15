// Hogs & Dogs reference data brought into Murda Worth: the breed book (every
// breed's real job, standard and colors, from the UKC/AKC/FCI/ABKC standards),
// the eight real hog breeds H&D 2.29 added, and the 100 custom-mix recipes of
// the Breeding Lab. Copied from ktanks811-afk/Hogs-and-dogs index.html (RHD, MIX).

// breed -> { reg, m (male size), f (female size), col, nose, mouth, role, note, hog }
export const BREED_FACTS = {
  "Black Mouth Cur": {"reg":"UKC","m":"18 in+ · 40 lb+","f":"16 in+ · 35 lb+","col":"Fawn, red, yellow, brindle, buckskin, brown or black; white up to 10%. Never merle or spotted.","nose":"Hot","mouth":"Mostly silent on track, barks at the bay","role":"Bay dog (tight, rough bay)","note":"The UKC only sets minimum sizes. One of the two most used hog dogs in the South.","hog":1},
  "Black Mountain Cur": {"reg":"Color phase","m":"18–26 in · 30–60 lb","f":"16–24 in · 30–60 lb","col":"Black, often with a white chest or tan trim.","nose":"Medium","mouth":"Open on a hot track","role":"Finder and bay dog","note":"Not a separate registered breed: it is a black-coated Mountain Cur line.","hog":1},
  "Mountain Cur": {"reg":"UKC (1957)","m":"18–26 in · 30–60 lb","f":"16–24 in · 30–60 lb","col":"Black, blue, brindle, brown, red, yellow, buckskin; white up to one-third.","nose":"Medium","mouth":"Open or silent, barks at the bay","role":"Finder and bay dog","note":"Bob-tailed pups are common. Scars are not faulted at cur shows.","hog":1},
  "Treeing Walker": {"reg":"UKC","m":"22–27 in · 50–75 lb","f":"20–25 in · 48–65 lb","col":"Tricolor (black, white and tan), also black and white or tan and white.","nose":"Cold","mouth":"Open: bawl and chop","role":"Strike dog (finds the hog)","note":"Fast and wide-ranging. A coonhound first; used to strike cold hog tracks.","hog":1},
  "American Bulldog": {"reg":"UKC · NKC","m":"23–27 in · 75–125 lb","f":"21–26 in · 60–105 lb","col":"Any color except solid black, solid blue, merle or tricolor; usually white with patches.","nose":"Poor","mouth":"Silent","role":"Catch dog","note":"Scott (athletic) and Johnson (bully) types. Strong grip, but tires and overheats fast in a long chase.","hog":1},
  "American Pit Bull Terrier": {"reg":"UKC · ADBA","m":"18–21 in · 35–60 lb","f":"17–20 in · 30–50 lb","col":"Any color except merle (a disqualification).","nose":"Fair","mouth":"Silent","role":"Catch dog","note":"Called the best all-round catch dog by many hunters, but can lack the size for a rough boar.","hog":1},
  "Pit Bull Terrier × All Mastiff Mix": {"reg":"Crossbreed (bandog)","m":"25–29 in · 100–140 lb","f":"24–27 in · 85–110 lb","col":"Brindle, fawn, black, blue.","nose":"Poor","mouth":"Silent","role":"Catch dog (heavy)","note":"The bandog cross goes back to Dr. John Swinford in the 1970s. Power over stamina.","hog":1},
  "Catahoula Leopard Dog": {"reg":"UKC","m":"about 24 in · 50–95 lb","f":"about 22 in · 50–95 lb","col":"Leopard (merle), solid, brindle or patchwork, with trim; glass eyes are common.","nose":"Hot","mouth":"Silent on track, then barks at the bay","role":"Bay dog (loose, working bay)","note":"Louisiana’s state dog. With the Black Mouth Cur, the most used hog dog.","hog":1},
  "Plott Hound": {"reg":"UKC · AKC","m":"22–27 in · 50–75 lb","f":"21–25 in · 40–65 lb","col":"Any brindle, black saddle, black with brindle trim, buckskin or black.","nose":"Cold","mouth":"Open: a loud, ringing chop","role":"Strike dog with grit","note":"Bred for bear and boar. The only hound hunters prize for grit at the bay.","hog":1},
  "Blue Lacy": {"reg":"UKC","m":"18–23 in · 30–55 lb","f":"18–21 in · 30–45 lb","col":"Blue (gray), red or tricolor.","nose":"Hot","mouth":"Barks at the bay","role":"Bay dog (loose bay)","note":"The Texas state dog, bred in part to work feral hogs.","hog":1},
  "Leopard Cur": {"reg":"UKC (American Leopard Hound)","m":"21–27 in · 45–75 lb","f":"21–25 in · 35–65 lb","col":"Leopard (merle) with white under one-third; also solid or brindle.","nose":"Medium","mouth":"Open on track","role":"Finder and bay dog","note":"The UKC renamed the breed the American Leopard Hound in 2008.","hog":1},
  "Dogo Argentino": {"reg":"FCI · UKC · AKC","m":"24–27 in · 88–100 lb","f":"24–26 in · 88–95 lb","col":"All white; a small dark patch on the head is allowed.","nose":"Good","mouth":"Silent","role":"Catch dog","note":"Bred in Argentina to hunt boar and puma. About 1 in 10 are deaf in one or both ears.","hog":1},
  "Gordon Setter": {"reg":"AKC · UKC","m":"24–27 in · 55–80 lb","f":"23–26 in · 45–70 lb","col":"Black and tan.","nose":"Air-scenting","mouth":"Silent (a bird dog)","role":"Not a hog dog","note":"A bird dog. It finds by air scent, but has little grit for a hog.","hog":0},
  "German Rottweiler": {"reg":"FCI · ADRK","m":"24–27 in · about 110 lb","f":"22–25 in · about 92 lb","col":"Black with rust markings.","nose":"Fair","mouth":"Silent","role":"Guard dog, rarely a catch dog","note":"Not a usual hog dog. Lives about 8–10 years; hips need checking.","hog":0},
  "American Bully": {"reg":"ABKC","m":"Pocket 14–17 in · Standard 17–20 in · XL 20–23 in","f":"Pocket 13–16 in · Standard 16–19 in · XL 19–22 in","col":"All colors except merle.","nose":"Poor","mouth":"Silent","role":"Companion, rarely a catch dog","note":"Shown by height class. Short muzzle: struggles in the heat.","hog":0},
  "American English Coonhound": {"reg":"UKC · AKC","m":"24–26 in · 45–65 lb","f":"23–25 in · 40–60 lb","col":"Red and white ticked, blue ticked, tricolor, lemon and white.","nose":"Cold","mouth":"Open: bawl and chop","role":"Strike dog","note":"Fast with a cold nose. A coonhound first.","hog":1},
  "Redbone Coonhound": {"reg":"UKC · AKC","m":"22–27 in · 50–70 lb","f":"21–26 in · 45–65 lb","col":"Solid red; a little white on the chest or feet.","nose":"Cold","mouth":"Open: a sweet bawl","role":"Strike dog","note":"Even-tempered and sure-footed in swamp country.","hog":1},
  "Black and Tan Coonhound": {"reg":"UKC · AKC","m":"23–27 in · 50–75 lb","f":"21–26 in · 40–65 lb","col":"Coal black with tan trim.","nose":"Very cold","mouth":"Open: a deep bawl","role":"Strike dog (cold tracks)","note":"The coldest nose of the coonhounds. Slow but steady.","hog":1},
  "Bluetick Coonhound": {"reg":"UKC · AKC","m":"22–27 in · 55–80 lb","f":"21–25 in · 45–65 lb","col":"Dark blue mottling (ticking) with black spots and tan trim.","nose":"Cold","mouth":"Open: a loud bawl","role":"Strike dog","note":"A cold-nosed, determined hound.","hog":1},
  "Beagle": {"reg":"AKC · UKC","m":"13 in and under, or 13–15 in · 20–30 lb","f":"13 in and under, or 13–15 in · 20–30 lb","col":"Tricolor, red and white, lemon and white, tan and white, ticked.","nose":"Cold","mouth":"Open: a bay","role":"Rabbit hound, not a hog dog","note":"Shown in two height varieties. Too small for hogs.","hog":0},
  "Labrador Retriever": {"reg":"AKC · UKC","m":"22.5–24.5 in · 65–80 lb","f":"21.5–23.5 in · 55–70 lb","col":"Black, yellow or chocolate.","nose":"Good","mouth":"Quiet","role":"Retriever, not a hog dog","note":"A bird dog. Gentle mouth, no grit for a hog.","hog":0},
  "Cane Corso": {"reg":"FCI · AKC · UKC","m":"25–27 in · 99–110 lb","f":"23.5–25 in · 88–99 lb","col":"Black, gray, fawn, red and brindle.","nose":"Fair","mouth":"Silent","role":"Guard dog, rarely a catch dog","note":"An old Italian boar and cattle dog, now mostly a guard dog. Watch hips and bloat.","hog":0},
  "Treeing Tennessee Brindle": {"reg":"UKC (1995)","m":"18–24 in · 35–50 lb","f":"16–22 in · 30–40 lb","col":"Brindle or black with brindle trim; a little white on the chest or feet.","nose":"Cold to medium","mouth":"Open on track, chop at the tree","role":"Finder and strike dog","note":"A brindle treeing cur-hound from Tennessee. Tough feet and a good mouth.","hog":1},
  "Kemmer Stock Mountain Cur": {"reg":"Kemmer breed club (1991)","m":"about 20 in · 40–50 lb","f":"about 18 in · 35–45 lb","col":"Mostly yellow or buckskin; also brindle and black.","nose":"Medium","mouth":"Open on a hot track","role":"Finder and bay dog","note":"Robert Kemmer’s line from Crossville, Tennessee, bred for squirrels and hogs.","hog":1},
  "Stephens Stock": {"reg":"UKC","m":"18–23 in · 40–55 lb","f":"16–21 in · 35–45 lb","col":"Black, usually with a little white on the chest or feet.","nose":"Medium","mouth":"Open on track","role":"Finder and bay dog","note":"A small, black Kentucky cur line, kept by the Stephens family for generations.","hog":1},
  "Florida Cracker Cur": {"reg":"American Stock Dog Registry","m":"18–24 in · 40–80 lb","f":"16–22 in · 35–65 lb","col":"Any: yellow, red, brindle, black, leopard, often with white.","nose":"Hot","mouth":"Silent on track, barks at the bay","role":"Bay dog (cattle and hogs)","note":"The old Florida scrub-cattle dog. Tough and heat-hardy.","hog":1},
  "Jagdterrier": {"reg":"UKC (1993) · FCI","m":"13–16 in · 17–22 lb","f":"13–15 in · 15–19 lb","col":"Black and tan, or dark brown and tan.","nose":"Good","mouth":"Barks at the bay","role":"Small loose-bay dog","note":"A German boar terrier. Hogs tend to stand and ignore a dog this small, so it can hold a loose bay alone.","hog":1},
  "Bull Arab": {"reg":"None (Australia)","m":"24–27 in · 70–90 lb","f":"23–26 in · 65–80 lb","col":"Mostly white with liver, black or red patches; also ticked or brindle.","nose":"Good (air-scents)","mouth":"Silent","role":"Finder-holder (finds and catches)","note":"Bred in Queensland in the 1970s for pig hunting: about half Bull Terrier, a quarter Greyhound, a quarter pointer.","hog":1},
  "Presa Canario": {"reg":"FCI · UKC","m":"24–26 in · 100–125 lb","f":"22.5–24.5 in · 88–110 lb","col":"Fawn or brindle with a dark mask; white kept to a minimum.","nose":"Fair","mouth":"Silent","role":"Catch dog (heavy)","note":"A Canary Islands catch and cattle dog. Huge grip, short wind in the heat.","hog":1},
  "Alapaha Blue Blood Bulldog": {"reg":"ARF · Animal Research Foundation","m":"20–24 in · 70–90 lb","f":"18–22 in · 55–75 lb","col":"Mostly white with patches: black, brindle, blue, red, or blue merle.","nose":"Fair","mouth":"Silent","role":"Catch dog","note":"An old Southern plantation bulldog kept by the Lane family of Georgia. No major kennel club recognizes it.","hog":1},
};

// a merle dog of these breeds is disqualified in the show ring
export const NOMERLE = ["American Bulldog","American Pit Bull Terrier","American Bully","Black Mouth Cur","Presa Canario","Cane Corso","German Rottweiler","Dogo Argentino"];

// The eight real hog breeds from H&D 2.29 (prices doubled like the other
// Murda Worth breeds). tpl: the coat engine body they are painted on.
export const NEW_BREEDS = {
  "Treeing Tennessee Brindle": {"b":{"short":"TTB","role":"bay","group":"Treeing cur / Bay","price":1500,"kg":[14,23],"pot":[70,52,78,64,80,60,46],"freq":{"K":{"K":0.05,"br":0.9,"y":0.05},"E":{"Em":0,"eg":0,"E":0.92,"e":0.08},"A":{"ay":0.4,"as":0.1,"at":0.4,"a":0.1},"S":{"S":0.85,"sp":0.15,"sw":0},"M":{"M":0,"m":1},"T":{"T":0.03,"t":0.97},"B":{"B":0.95,"b":0.05},"D":{"D":0.97,"d":0.03}}},"tpl":{"code":"TTB","body":"walker_stack_v1"},"lu":{"Brindle":{"K":["br","br"]},"Black brindle":{"K":["br","br"],"patMod":0.82},"Black, brindle trim":{"K":["br","br"],"patMod":0.95},"Brindle, white chest":{"K":["br","br"],"S":["S","sp"],"whiteMod":-0.12}}},
  "Kemmer Stock Mountain Cur": {"b":{"short":"Kemmer","role":"bay","group":"Cur / Bay","price":1700,"kg":[16,23],"pot":[72,58,78,70,78,66,52],"freq":{"K":{"K":0.25,"br":0.3,"y":0.45},"E":{"Em":0,"eg":0,"E":0.55,"e":0.45},"A":{"ay":0.55,"as":0.05,"at":0.3,"a":0.1},"S":{"S":0.85,"sp":0.15,"sw":0},"M":{"M":0,"m":1},"T":{"T":0.02,"t":0.98},"B":{"B":0.9,"b":0.1},"D":{"D":0.95,"d":0.05}}},"tpl":{"code":"KMC","body":"cur_stack_v1"},"lu":{"Yellow":{"K":["y","y"],"E":["e","e"],"coatInt":0.55},"Buckskin":{"K":["y","y"],"A":["ay","ay"],"coatInt":0.45},"Brindle":{"K":["br","br"]},"Black":{},"Yellow, white chest":{"K":["y","y"],"E":["e","e"],"coatInt":0.5,"S":["S","sp"],"whiteMod":-0.12}}},
  "Stephens Stock": {"b":{"short":"Stephens","role":"bay","group":"Cur / Bay","price":1400,"kg":[16,25],"pot":[70,54,76,70,76,66,48],"freq":{"K":{"K":0.9,"br":0.07,"y":0.03},"E":{"Em":0,"eg":0,"E":0.95,"e":0.05},"A":{"ay":0.2,"as":0.1,"at":0.5,"a":0.2},"S":{"S":0.6,"sp":0.4,"sw":0},"M":{"M":0,"m":1},"T":{"T":0.02,"t":0.98},"B":{"B":0.97,"b":0.03},"D":{"D":0.97,"d":0.03}}},"tpl":{"code":"STS","body":"cur_stack_v1"},"lu":{"Black":{},"Black, white chest":{"S":["S","sp"],"whiteMod":-0.12},"Black, white feet":{"S":["S","sp"],"whiteMod":-0.05}}},
  "Florida Cracker Cur": {"b":{"short":"Cracker","role":"bay","group":"Cur / Bay","price":1600,"kg":[18,36],"pot":[72,62,80,70,72,64,58],"freq":{"K":{"K":0.3,"br":0.4,"y":0.3},"E":{"Em":0.05,"eg":0,"E":0.55,"e":0.4},"A":{"ay":0.5,"as":0.05,"at":0.3,"a":0.15},"S":{"S":0.55,"sp":0.35,"sw":0.1},"M":{"M":0.12,"m":0.88},"T":{"T":0.05,"t":0.95},"B":{"B":0.85,"b":0.15},"D":{"D":0.92,"d":0.08}}},"tpl":{"code":"FCC","body":"cur_stack_v1"},"lu":{"Yellow":{"K":["y","y"],"E":["e","e"],"coatInt":0.55},"Red":{"K":["y","y"],"E":["e","e"],"coatInt":0.85},"Brindle":{"K":["br","br"]},"Black":{},"Leopard":{"M":["M","m"],"eyes":"Glass"},"Brindle and white":{"K":["br","br"],"S":["sp","sp"],"whiteMod":0.05}}},
  "Jagdterrier": {"b":{"short":"Jagd","role":"bay","group":"Terrier / Bay","price":1800,"kg":[7.5,10],"pot":[70,50,74,66,70,52,62],"freq":{"K":{"K":0,"br":0,"y":1},"A":{"ay":0,"as":0,"at":1,"a":0},"E":{"Em":0,"eg":0,"E":1,"e":0},"S":{"S":0.95,"sp":0.05,"sw":0},"M":{"M":0,"m":1},"T":{"T":0,"t":1},"B":{"B":0.8,"b":0.2},"D":{"D":1,"d":0}}},"tpl":{"code":"JGDT","body":"beagle_stack_v1"},"lu":{"Black and tan":{},"Dark brown and tan":{"B":["b","b"],"coatInt":0.6},"Black and tan, white chest":{"S":["S","sp"],"whiteMod":-0.12}}},
  "Bull Arab": {"b":{"short":"Bull Arab","role":"catch","group":"Pig dog / Catch","price":2400,"kg":[30,40],"pot":[80,78,82,70,74,62,82],"freq":{"K":{"K":0.5,"br":0.2,"y":0.3},"E":{"Em":0,"eg":0,"E":0.75,"e":0.25},"A":{"ay":0.3,"as":0.1,"at":0.4,"a":0.2},"S":{"S":0.1,"sp":0.45,"sw":0.45},"M":{"M":0,"m":1},"T":{"T":0.35,"t":0.65},"B":{"B":0.6,"b":0.4},"D":{"D":0.95,"d":0.05}}},"tpl":{"code":"BARB","body":"pit_bull_terrier_stack_v1"},"lu":{"White with liver patches":{"B":["b","b"],"S":["sw","sw"]},"White with black patches":{"S":["sw","sw"]},"Ticked":{"S":["sp","sw"],"T":["T","T"]},"Brindle and white":{"K":["br","br"],"S":["sp","sw"]},"Red and white":{"K":["y","y"],"E":["e","e"],"S":["sp","sw"],"coatInt":0.8}}},
  "Presa Canario": {"b":{"short":"Presa","role":"catch","group":"Working / Catch / Guard","price":3400,"kg":[40,57],"pot":[62,94,72,74,58,70,94],"freq":{"K":{"K":0.04,"br":0.6,"y":0.36},"E":{"Em":0.95,"eg":0,"E":0.05,"e":0},"A":{"ay":1,"as":0,"at":0,"a":0},"S":{"S":0.92,"sp":0.08,"sw":0},"M":{"M":0,"m":1},"T":{"T":0,"t":1},"B":{"B":1,"b":0},"D":{"D":0.95,"d":0.05}}},"tpl":{"code":"PRSA","body":"corso_stack_v1"},"lu":{"Fawn":{"K":["y","y"],"coatInt":0.45},"Red fawn":{"K":["y","y"],"coatInt":0.75},"Brindle":{"K":["br","br"]},"Dark brindle":{"K":["br","br"],"patMod":0.85},"Fawn brindle":{"K":["br","y"],"patMod":0.35}}},
  "Alapaha Blue Blood Bulldog": {"b":{"short":"Alapaha","role":"catch","group":"Bulldog / Catch","price":2600,"kg":[25,41],"pot":[62,82,66,66,50,66,84],"freq":{"K":{"K":0.4,"br":0.3,"y":0.3},"E":{"Em":0,"eg":0,"E":0.75,"e":0.25},"A":{"ay":0.5,"as":0.05,"at":0.25,"a":0.2},"S":{"S":0.05,"sp":0.35,"sw":0.6},"M":{"M":0.08,"m":0.92},"T":{"T":0.05,"t":0.95},"B":{"B":0.85,"b":0.15},"D":{"D":0.75,"d":0.25}}},"tpl":{"code":"ABBB","body":"bulldog_stack_v1"},"lu":{"White with black patches":{"S":["sw","sw"]},"White with brindle":{"K":["br","br"],"S":["sw","sw"]},"Blue merle and white":{"M":["M","m"],"D":["d","d"],"S":["sp","sw"]},"White with red":{"K":["y","y"],"E":["e","e"],"S":["sw","sw"],"coatInt":0.75},"Blue and white":{"D":["d","d"],"S":["sp","sw"]}}},
};

// names on the mix sheet -> the game's breeds
export const MIX_ALIAS = {"Pitbull":"American Pit Bull Terrier","American Pit Bull Terrier":"American Pit Bull Terrier","American Bully":"American Bully","American Bulldog":"American Bulldog","Catahoula":"Catahoula Leopard Dog","Black Mouth Cur":"Black Mouth Cur","Plott Hound":"Plott Hound","Coonhound":"American English Coonhound","Redbone":"Redbone Coonhound","Rottweiler":"German Rottweiler","German Rottweiler":"German Rottweiler","Labrador":"Labrador Retriever","Lab":"Labrador Retriever","Treeing Walker":"Treeing Walker","Beagle":"Beagle","Mountain Cur":"Mountain Cur","Black and Tan":"Black and Tan Coonhound","Bluetick":"Bluetick Coonhound","Blue Lacy":"Blue Lacy","Cane Corso":"Cane Corso","Dogo Argentino":"Dogo Argentino","Gordon Setter":"Gordon Setter","Leopard Cur":"Leopard Cur","Black Mountain Cur":"Black Mountain Cur","Pit×Mastiff":"Pit Bull Terrier × All Mastiff Mix"};

// #|name|parent A|parent B (a/b = either)|required coat traits (+ = all)|generations of crossing
export const MIX_RAW = `1|Bully|Pitbull|American Bully/American Bulldog||1
2|Bully Hound|American Bully|Coonhound||1
3|Hog Dog|Pitbull|Catahoula||1
4|Cajun Bully|American Bully|Plott Hound||1
5|Swamp Dog|Catahoula|Black Mouth Cur||1
6|Cur Bully|Black Mouth Cur|Pitbull||1
7|Red Bone Cur|Redbone|Black Mouth Cur||1
8|Blue Cur|Catahoula|Black Mouth Cur|merle|1
9|Golden Cur|Labrador|Black Mouth Cur|red|1
10|Tracker|Treeing Walker|Plott Hound||1
11|Walker Hound|Treeing Walker|Beagle||1
12|Plotthound|Plott Hound|Coonhound||1
13|Mountain Cur Cross|Mountain Cur|Plott Hound||1
14|Leopard Cur Cross|Catahoula|Mountain Cur|merle|1
15|Treeing Cur|Treeing Walker|Black Mouth Cur||1
16|Beagle Hound|Beagle|Plott Hound||1
17|Redbone Hound|Redbone|Coonhound||1
18|Hound Lab|Labrador|Coonhound||1
19|Coonhound Cross|Black and Tan|Redbone||1
20|Ghost Hound|Catahoula|Treeing Walker|merle+white|1
21|Bay Dog|Plott Hound|Redbone||1
22|Dark Bay|Black Mouth Cur|Coonhound||1
23|Swamp Hound|Catahoula|Redbone||1
24|River Hound|Treeing Walker|Labrador||1
25|Brindle Hound|Plott Hound|Catahoula|brindle|1
26|Ticked Hound|Treeing Walker|Bluetick||1
27|Bluetick Cross|Bluetick|Treeing Walker|ticked+black|1
28|Red Tick|Redbone|Bluetick|ticked|1
29|Saddle Hound|Black and Tan|Treeing Walker|saddle|1
30|Tri Hound|Beagle|Coonhound|tri|1
31|Mountain Hound|Mountain Cur|Redbone||1
32|Blaze Hound|Treeing Walker|Plott Hound|white|1
33|Iron Hound|Plott Hound|American Bully|dilute|1
34|Mud Hound|Catahoula|Coonhound||1
35|White Hound|Treeing Walker|Labrador|white|1
36|Spotted Hound|Catahoula|Treeing Walker|merle|1
37|Marsh Hound|Catahoula|Redbone|merle|1
38|River Cur|Labrador|Black Mouth Cur||1
39|Wood Hound|Plott Hound|Mountain Cur|brindle|1
40|Night Hound|Black and Tan|Plott Hound||1
41|Bulldog Cur|American Bulldog|Black Mouth Cur||1
42|Merle Bully|American Bully|Catahoula|merle|1
43|Steel Cur|Catahoula|Pitbull|dilute|1
44|Titanium Hound|Catahoula|Treeing Walker|merle+dilute|2
45|Smoke Cur|Blue Lacy|Black Mouth Cur||1
46|Chocolate Cur|Labrador|Mountain Cur|chocolate|1
47|Lilac Bully|American Bully|Pitbull|dilute+chocolate|1
48|Sable Hound|Plott Hound|Black Mouth Cur||1
49|Saddle Cur|Black Mouth Cur|Catahoula|saddle|1
50|Cream Tick|Labrador|Treeing Walker|ticked|1
51|Blue Lacy Cur|Catahoula|Blue Lacy||1
52|Frost Hound|Catahoula|Labrador|white|1
53|Night Cur|Black Mouth Cur|Pitbull|black|1
54|Sand Hound|Labrador|Redbone||1
55|Ghost Cur|Catahoula|Black Mouth Cur|merle+white|1
56|Red Cur|Redbone|Mountain Cur|red|1
57|Ebony Hound|Black and Tan|Redbone|tan|1
58|Ice Hound|Catahoula|Treeing Walker|xwhite|1
59|Champagne Bully|American Bully|Labrador|red|1
60|Buckskin Cur|Labrador|Mountain Cur|red|1
61|Marble Cur|Catahoula|Mountain Cur|merle+white|1
62|Rust Hound|Redbone|Plott Hound|red|1
63|Forest Hound|Plott Hound|Black Mouth Cur|brindle|1
64|Panda Cur|Black and Tan|Catahoula|black+white|1
65|Storm Hound|Catahoula|Labrador|merle|1
66|Honey Cur|Labrador|Redbone|red|1
67|Midnight Cur|Black Mouth Cur|Pitbull|black|2
68|Tundra Hound|Catahoula|Blue Lacy|white|1
69|Mahogany Cur|Redbone|Mountain Cur|red|2
70|Savannah Hound|Labrador|Coonhound|red|1
71|Ash Cur|Catahoula|Black Mouth Cur|dilute|1
72|Copper Tick|Redbone|Treeing Walker|ticked|1
73|Stone Hound|Catahoula|Plott Hound|merle|1
74|Timber Hound|Plott Hound|Coonhound|brindle|1
75|Ranger Cur|Black Mouth Cur|Labrador|black|1
76|Diamond Cur|Catahoula|Pitbull|merle+white|2
77|Ebonyset Hound|Redbone|Labrador|red|2
78|Coal Hound|Black and Tan|Plott Hound|black|1
79|Maple Cur|Labrador|Mountain Cur||1
80|River Bully|American Bully|Catahoula||1
81|Phantom Hound|Catahoula|Treeing Walker|black|2
82|Lynx Cur|Catahoula|Mountain Cur||1
83|Bronze Hound|Redbone|Black Mouth Cur|red|1
84|Sky Hound|Catahoula|Labrador|dilute|1
85|Copper Bully|American Bully|Plott Hound|red|1
86|Arctic Hound|Labrador|Treeing Walker|white+red|2
87|Phoenix Cur|Redbone|Pitbull|red|2
88|Mocha Hound|Labrador|Coonhound|chocolate|1
89|Havoc Hound|Catahoula|American Bully||3
90|Legend Cur|Plott Hound|Black Mouth Cur||3
91|Legendary Mix 100|American Bully|Redbone||3
92|Bandog Cur|Cane Corso|Black Mouth Cur||1
93|Iron Dogo|Dogo Argentino|American Bulldog||1
94|White Ghost|Dogo Argentino|Catahoula|merle+white|1
95|Setter Cur|Gordon Setter|Mountain Cur||1
96|Corso Hound|Cane Corso|Plott Hound||1
97|Leopard Bully|Leopard Cur|American Bully|merle|1
98|Mountain Bulldog|Black Mountain Cur|American Bulldog||1
99|Titan Catch Dog|Pit×Mastiff|Dogo Argentino||1
100|Hog King|Catahoula|Pitbull||4`;
