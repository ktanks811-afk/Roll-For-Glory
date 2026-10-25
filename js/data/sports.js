// The sportsbook's leagues and teams (core/sportsbook.js plays the games).
// Teams go by city or school only. `r` is how good they are this season.
//   days: which days of the week it plays (Mon..Sun), slots: start times
//   (game minutes after midnight), len: how long a game runs (game minutes),
//   per: periods and what they're called, score: how the points come.

export const LEAGUES = {
  pfb: {
    name: 'Pro Football', short: 'FB', icon: '🏈', days: ['Thu', 'Sun', 'Mon'], slots: [12 * 60, 15 * 60 + 25, 19 * 60 + 20], len: 195, per: 4, perName: 'Q', score: 'football',
    teams: [['Dallas', 'DAL', 82], ['Philadelphia', 'PHI', 86], ['New York', 'NYG', 70], ['Washington', 'WAS', 76], ['Houston', 'HOU', 80], ['Kansas City', 'KC', 90], ['San Francisco', 'SF', 87], ['Green Bay', 'GB', 81], ['Detroit', 'DET', 85], ['Baltimore', 'BAL', 88], ['Buffalo', 'BUF', 86], ['Miami', 'MIA', 77], ['Chicago', 'CHI', 72], ['Atlanta', 'ATL', 74], ['Los Angeles', 'LA', 79], ['Denver', 'DEN', 75], ['Las Vegas', 'LV', 68], ['New Orleans', 'NO', 71]],
  },
  cfb: {
    name: 'College Football', short: 'CFB', icon: '🏟', days: ['Sat'], slots: [11 * 60, 14 * 60 + 30, 18 * 60 + 30], len: 210, per: 4, perName: 'Q', score: 'football',
    teams: [['TCU', 'TCU', 78], ['Texas', 'TEX', 88], ['Texas A&M', 'TAMU', 82], ['Baylor', 'BAY', 74], ['Texas Tech', 'TTU', 76], ['SMU', 'SMU', 77], ['UNT', 'UNT', 66], ['Houston', 'UH', 69], ['Oklahoma', 'OU', 80], ['Alabama', 'BAMA', 87], ['Georgia', 'UGA', 89], ['LSU', 'LSU', 83], ['Ohio State', 'OSU', 90], ['Michigan', 'MICH', 84], ['Prairie View', 'PV', 62], ['Grambling', 'GRAM', 61], ['Jackson State', 'JSU', 64], ['Southern', 'SOU', 60]],
  },
  hoops: {
    name: 'Pro Hoops', short: 'HOOPS', icon: '🏀', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], slots: [19 * 60, 21 * 60 + 30], len: 150, per: 4, perName: 'Q', score: 'hoops',
    teams: [['Dallas', 'DAL', 84], ['San Antonio', 'SA', 78], ['Houston', 'HOU', 81], ['Oklahoma City', 'OKC', 90], ['Denver', 'DEN', 86], ['Boston', 'BOS', 89], ['New York', 'NY', 85], ['Milwaukee', 'MIL', 82], ['Los Angeles', 'LA', 80], ['Golden State', 'GS', 79], ['Phoenix', 'PHX', 76], ['Miami', 'MIA', 77], ['Memphis', 'MEM', 75], ['Atlanta', 'ATL', 73]],
  },
  base: {
    name: 'Baseball', short: 'MLB', icon: '⚾', days: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], slots: [13 * 60 + 5, 19 * 60 + 5], len: 180, per: 9, perName: 'Inn ', score: 'baseball',
    teams: [['Texas', 'TEX', 80], ['Houston', 'HOU', 84], ['New York', 'NYY', 86], ['Los Angeles', 'LAD', 90], ['Atlanta', 'ATL', 85], ['Chicago', 'CHC', 76], ['Boston', 'BOS', 79], ['Philadelphia', 'PHI', 84], ['San Diego', 'SD', 81], ['Seattle', 'SEA', 78], ['St. Louis', 'STL', 74], ['Kansas City', 'KC', 75]],
  },
  hockey: {
    name: 'Hockey', short: 'HKY', icon: '🏒', days: ['Tue', 'Thu', 'Sat', 'Sun'], slots: [19 * 60 + 30], len: 160, per: 3, perName: 'P', score: 'hockey',
    teams: [['Dallas', 'DAL', 86], ['Colorado', 'COL', 85], ['Vegas', 'VGK', 83], ['Edmonton', 'EDM', 87], ['Boston', 'BOS', 80], ['Florida', 'FLA', 88], ['Tampa Bay', 'TB', 82], ['New York', 'NYR', 81], ['Winnipeg', 'WPG', 84], ['Chicago', 'CHI', 68]],
  },
  fight: {
    name: 'Fight Night', short: 'FIGHT', icon: '🥊', days: ['Sat'], slots: [22 * 60], len: 60, per: 5, perName: 'R', score: 'fight',
    teams: [['"Hands" Okafor', 'OKF', 84], ['Danny "Stop Six" Reyes', 'REY', 80], ['Marcus Bell', 'BELL', 82], ['"Big Tex" Holloway', 'HOL', 78], ['Andre "Truth" Sims', 'SIMS', 86], ['Kenji Mori', 'MORI', 81], ['Luis "El Toro" Vega', 'VEGA', 83], ['Tyrell Dukes', 'DUKE', 77]],
  },
};
export const LEAGUE_IDS = Object.keys(LEAGUES);
