// Defense attorneys you can hire, cheapest first. Everyone else gets the
// public defender. Made-up people and firms.
//
// fee:       times the base fee for the case (justice.lawyerFee)
// retainer:  weekly fee to keep them on call; any case filed while they're on
//            retainer they take for free
// bail:      how much they knock off bail at the magistrate (fraction)
// bond:      can argue a "no bond" hold into a (high) bail, except after you skipped court
// plea:      how far down the punishment range their plea deal lands (0..1 of the range)
// reduce:    knocks the top charge down a class in the plea deal
// trial:     off the State's chance to convict on each charge
// dismiss:   chance they get the case thrown out before it starts (motions,
//            suppression); felony cases get 60% of it
// discovery: digs through the State's file and tells you who snitched
// snitch:    extra off the conviction chance on a charge that rests on an informant
export const LAWYERS = {
  ferris: {
    id: 'ferris', name: 'Dale Ferris', firm: 'Law Office of Dale Ferris', where: 'East Lancaster Ave',
    blurb: 'Bus-bench ads on East Lancaster. Answers his own phone. Pleads out most of his clients.',
    fee: 0.5, retainer: 350, bail: 0.2, bond: false, plea: 0.04, reduce: 0, trial: 0.1, dismiss: 0.05, discovery: false, snitch: 0.05,
  },
  salinas: {
    id: 'salinas', name: 'Rita Salinas', firm: 'Salinas & Pratt Criminal Defense', where: 'Throckmorton St',
    blurb: 'Ten years as a Tarrant County prosecutor before she switched sides. Knows every judge by first name.',
    fee: 1, retainer: 1100, bail: 0.35, bond: false, plea: 0.08, reduce: 1, trial: 0.2, dismiss: 0.1, discovery: true, snitch: 0.12,
  },
  kane: {
    id: 'kane', name: 'Victoria Kane', firm: 'Kane Trial Lawyers', where: 'Sundance Square',
    blurb: 'The most expensive phone call in Fort Worth. Juries love her and snitches hate her cross-examination.',
    fee: 2.2, retainer: 3000, bail: 0.5, bond: true, plea: 0.14, reduce: 1, trial: 0.32, dismiss: 0.18, discovery: true, snitch: 0.25,
  },
};
export const LAWYER_IDS = Object.keys(LAWYERS);
export const PUBLIC_DEFENDER = { id: 'pd', name: 'the public defender', firm: 'Tarrant County Public Defender', fee: 0, bail: 0, plea: 0, reduce: 0, trial: 0, dismiss: 0, discovery: false, snitch: 0 };
export const lawyerById = id => LAWYERS[id] || null;

// How hard each set's people hold it down when they get picked up (added to
// a homie's loyalty). Northside Reyes never talk to the police.
export const SET_CODE = { northside: 25, como: 10, six_block: 5, hemphill: -5, riverside: 0, own: 0 };

// They text you (and show up in Contacts) once you've hired them. The last one is
// the county jail's collect-call line (`tcjail`) your locked-up people call you on.
export const LAWYER_CONTACTS = {
  ...Object.fromEntries(Object.values(LAWYERS).map(l => [l.id, { name: l.name, role: `Defense attorney · ${l.firm}`, color: '#b08d3c', bio: l.blurb }])),
  tcjail: { name: 'Tarrant County Jail', role: 'Inmate calls (collect)', color: '#d86a1a', bio: 'Securus inmate calling. This call is from a correctional facility and may be recorded.' },
};
