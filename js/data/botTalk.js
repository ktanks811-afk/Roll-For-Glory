// What the other drivers on a quiet server are called and what they say in
// chat (net/bots.js). Placeholders: {me} = you, {other} = another driver on
// the server, {car} = a car on the server, {street} / {place} / {meet} = spots
// around Fort Worth. Lower case and short on purpose: it's a game chat.

export const FIRST = ['Tre', 'Dre', 'KeKe', 'Jay', 'Marcus', 'Kayla', 'Juan', 'Carlos', 'Tex', 'Rich', 'Smoke', 'Rico', 'Deshawn', 'Bri', 'Tasha',
  'Mike', 'Cody', 'Bubba', 'Hector', 'Luis', 'Jalen', 'Zay', 'Ty', 'Nae', 'Kiki', 'Quan', 'Boogie', 'Slim', 'Peanut', 'Pooh', 'Ant', 'Chino',
  'Junior', 'Toro', 'Ghost', 'Nova', 'Blaze', 'Dez', 'Mari', 'Jojo', 'Lexi', 'Trey', 'Rell', 'Moe', 'Javi', 'Angel', 'Izzy', 'Rocky', 'Duke', 'Vic'];
export const WORDS = ['Boostin', 'Built', 'Hemi', 'Turbo', 'Dubs', 'Pulls', 'Racing', 'Speed', 'Shift', 'Torque', 'Revs', 'Slammed', 'Boost', 'Smoke', 'Drag'];
// Name shapes: a = first name, w = word, n = number
export const NAME_SHAPES = [
  ['a', '817'], ['a', '682'], ['lil ', 'a'], ['Big', 'a'], ['a', 'w'], ['w', 'a'], ['a', '_', 'w'], ['a', '.TX'], ['a', 'n'], ['a', ' ', 'I'],
  ['a', 'OnDubs'], ['FW', 'a'], ['a', 'x', 'n'], ['its', 'a'], ['a', '_817'], ['a', 'G'], ['a', 'SS'], ['Cowtown', 'a'],
];
export const CREWS = [
  { tag: '817', color: '#c41b1b' }, { tag: 'SSX', color: '#1b4fc4' }, { tag: 'NSR', color: '#e8c21a' }, { tag: 'TXB', color: '#e8641a' },
  { tag: 'GHST', color: '#6b2bd1' }, { tag: 'STP6', color: '#1f8f3a' }, { tag: 'FWD', color: '#13b3c4' }, { tag: 'CTWN', color: '#d12a8a' },
];

export const STREETS = ['Berry', 'Magnolia', 'Rosedale', 'Lancaster', 'Vickery', 'Camp Bowie', 'Hulen', 'Seminary', 'Belknap', 'University', 'Main', 'Northside', '820', 'I-30', 'Riverside'];
export const PLACES = ['the stockyards', 'Stop Six', 'Magnolia', 'the QT', 'Sundance', 'the courthouse', 'La Gran Plaza', 'Riverside', 'the strip', 'Northside', 'the Whataburger on Berry', 'Hulen mall', 'Cobb Park', 'Seminary'];
export const MEETS = ['La Gran Plaza', 'the stockyards', 'Pier 9', 'the Kessler lot', 'the old foundry', 'the Whataburger on Berry', 'Hulen mall lot'];

// Somebody says something on their own. Each entry is one line, or a short
// back-and-forth between two drivers (A and B).
export const AMBIENT = [
  'anybody tryna run it on 820?', 'who in the {car}? that thing clean', 'cops thick on {street} rn', 'meet at {meet} tonight?',
  'just put a turbo on mine 😮‍💨', 'need a ride, im by {place}', 'lf crew. msg me', 'lol who keep honking', 'brb food',
  '{other} you still owe me a race', 'this server goin crazy tonight', 'anyone selling rims?', 'ima be at the strip in a min',
  'fwpd posted by the courthouse fr', 'who tryna roll 40 for 5k', 'my car lowkey slow 😭', 'who got the loudest car on here',
  'just got my car back from the shop 🙏', 'gas went up again smh', 'somebody come race me on {street}', 'stay off {street} the cops sittin there',
  'whoever just flew past me on {street}, respect 😂', 'need 2 more for a meet at {meet}', 'yall seen the new parts at the shop?',
  '{me} that {mycar} hard 🔥', '{me} wanna run it?', 'lmao i just got pulled over on {street}', 'who tryna cruise',
  [['A', '{B} where you at'], ['B', 'by {place}'], ['A', 'omw']],
  [['A', 'who tryna race'], ['B', 'what you in'], ['A', 'my {acar}'], ['B', 'bet pull up']],
  [['A', '{B} you up?'], ['B', 'ya whats good'], ['A', 'meet at {meet}'], ['B', 'say less']],
  [['A', 'yall see that wreck on {street} 💀'], ['B', 'lmaooo']],
  [['A', 'cops on me 😭'], ['B', 'take {street}'], ['A', 'lost em 🙏']],
  [['A', '{B} how much you got in that {bcar}?'], ['B', 'too much 😂']],
];
export const NIGHT = ['late night pulls hit different 🌙', 'who still up', 'meet at {meet} rn, pull up', 'streets empty, perfect for a pull', 'night shift cops out, be careful',
  [['A', 'who tryna do a midnight run'], ['B', 'im down'], ['A', 'meet at {meet}']]];
export const DAY = ['morning cruise ☀', 'anybody at work rn 😂', 'on lunch break, quick run?', 'traffic crazy on {street}'];

export const JOIN = ['wsg', 'yo', 'im back', 'who on', 'wsg yall', 'yooo', 'whats good fw'];
export const LEAVE = ['aight im out', 'gotta go to work', 'gn yall', 'brb', 'phone dying, later', 'out ✌'];
export const GREET_ME = ['wsg {me}', 'yo {me}', 'welcome back {me}', 'wassup {me}'];

// Answers to what you say in chat, by what it sounds like.
export const REPLY = [
  { re: /\b(yo+|wsg|hey|hi|sup|whats? ?good|wass?up|hello)\b/i, lines: ['yo', 'wsg {me}', 'wassup', '👋', 'yoo'] },
  { re: /\b(race|run it|roll|drag|pull up)\b|🏁/i, lines: ['bet', 'what you in?', 'pull up', 'send it', 'what you tryna run', 'say less'], race: true },
  { re: /\b(nice|clean|hard|fire|build)\b|🔥/i, lines: ['appreciate it 🙏', 'thanks', 'its not done yet', 'facts'] },
  { re: /\b(meet|where)\b/i, lines: ['{meet}', 'im by {place}', 'pull up to {meet}', 'at {meet}'] },
  { re: /\b(lol|lmao|haha)\b|😂/i, lines: ['😂', 'lmaoo', 'fr 😂'] },
  { re: /\b(ride|lift)\b/i, lines: ['where you at', 'i got you', 'come to {place}'] },
  { re: /\b(cops?|police|12)\b/i, lines: ['they on me too 😭', 'stay off {street}', 'fwpd everywhere tonight'] },
  { re: /\b(bot|ai|npc|robot|fake)\b/i, lines: ['nah 😂', 'bro what', 'im real lol', 'who you callin a bot', '💀'] },
  { re: /👍/, lines: ['👍'] },
];
export const FILLER = ['fr', 'facts', 'ong', 'real', '💯', 'lol', 'true'];
export const NAMED = ['what', 'wsg', 'yeah?', 'who dat', 'wassup {me}', 'huh'];

export const RACE_LOST = ['gg', 'run it back', 'my tires was cold', 'you got that 🔥', 'ok ok i see you', 'gg, rematch later'];
export const RACE_WON = ['gg ez', 'too easy', 'good race tho', 'gg', 'come back when you built 😂'];
export const SHOT = ['bro why you shooting 😂', 'chill', 'ok bet', 'you dead wrong for that', 'stop 😭'];
export const KILLED = ['really?? 💀', 'ima get you back', 'thats crazy', 'bro 😭'];
export const YOU_DIED = ['rip 😂', 'f', 'lmao rip', '💀'];
export const RIDE_THANKS = ['good lookin 🤝', 'appreciate the ride', 'preciate it', 'thanks 🙏'];
