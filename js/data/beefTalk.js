// Street beef with the regulars on a server (net/bots.js + core/opps.js):
// what they say when they pick with you, what they post about you on
// Throttle, what they text, and what they say when they spin on you.
// {me} = your @handle or name, {them} = theirs, {car} = your car.

// Walking or rolling past you, the hotheads talk down.
export const TRASH = ['lame ass dude', 'fuck you lookin at', 'lame', 'who is this goofy', 'bro look lost 😂', 'aint nobody scared of you',
  'that {car} slow as hell', 'keep it movin lame', 'you aint from round here', 'bum ass', 'lookin like a opp', 'move around'];
// Once there's a little heat: they pick with you.
export const PICK = ['you got a problem?', 'say somethin then', 'i heard you was talkin about me', 'you still lookin? 🤨', 'keep my name out your mouth',
  'you a lil too comfortable over here', 'run it then, say less', 'you aint want this smoke', 'thought so 😂 lame'];
// Flashing the gun: the last warning before it's real.
export const FLASH = ['keep lookin and see what happen', 'try me', 'i aint playin wit you', '🔫 dont make me', 'you wanna get spun on?', 'aint gon tell you twice'];

// Posting on you (Throttle). They're the author, it's about you.
export const POSTS = ['{me} the lamest dude on the server and i said what i said', 'whoever {me} is, keep that same energy when you see me 🤫',
  'saw {me} at the meet lookin goofy 😂', '{me} car slow and they mouth fast', 'somebody tell {me} stay off my side', '{me} a fan fr, always watching 👀',
  'aint no way {me} think they hard 💀', 'not {me} actin tough on chat lmaooo'];
// Your posts when you start it or answer them.
export const DISS = ['{them} a goofy and everybody know it', '{them} stay talkin, never pullin up 🤫', '@{them} you dont want this', 'keep my name out your mouth {them}',
  '{them} car slow, mouth fast 😂', 'everybody on the server know {them} a lame'];
// They text you once it gets hot.
export const DMS = ['you got a problem wit me?', 'keep postin and see what happen', 'i know what you drive', 'you bold on the internet', 'we can handle this in person',
  'keep my name out your mouth fr'];
// Texts once you're opps.
export const OPP_DMS = ['its on sight', 'you better stay in the house', 'i know where you be', 'every time i see you its up', 'you made a opp outta me, live wit it'];

// You talked down on them (chat or the Online panel).
export const TALK_DOWN = ['you lame bro', 'goofy', 'who asked you', 'bum', 'stay in your lane', 'you trash fr'];
// Their answer when you start it.
export const CLAP_BACK = ['say it to my face', 'aight bet', 'you just made a opp', 'ok. remember you said that', 'you aint gon like how this end', 'bet 🤫'];

// Pulling up on you.
export const SLIDE = ['found you 🤫', 'told you its on sight', 'spin back', 'we outside', 'thought you was safe?'];
export const WALK_DOWN = ['you thought i was playin?', 'run then', 'aint no hiding', 'its up'];
// Afterwards.
export const GOT_YOU = ['caught you lackin 😂', 'told you', 'stay in the house next time', '🤫'];
export const MISSED = ['next time', 'you lucky', 'aint over', 'ran like a lame'];
export const LIT_UP = ['bro shot my car up 😭', 'you got it this time', 'aint over', 'you dead for that'];
export const SMOKED = ['thats crazy', 'ima be back', 'this aint over', 'you got lucky'];

// Squashing it.
export const SQUASH_YES = ['aight we good', 'its love', 'say less, we good', 'aight. dont let it happen again'];
export const SQUASH_NO = ['too late for that', 'nah you started this', 'aint no squashin it', 'you know what it is'];

// Throttle pages and locals reacting to a slide.
export const SCANNER = ['Shots fired near {where}. Callers say a car pulled up and opened fire, then fled.', 'Units responding to a shooting in {where}. Suspect fled on foot.'];
export const TEA = ['{them} and {me} beefin on the server for real now 😬 y\'all be safe', 'Somebody spun on {me} in {where} 😳 that {them} beef is REAL', 'It\'s getting hot between {me} and {them} 👀'];

// What you'd type in chat that counts as talking down.
export const INSULT = /\b(lame|trash|bum|broke|goofy|clown|weak|bitch|pussy|hoe|ho|fuck you|fuck u|fu|stfu|shut up|ugly|fake|opp|slow)\b/i;
