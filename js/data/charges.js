// The rest of the Texas Penal Code (and the Transportation Code tickets).
// The street offences in core/justice.js classify() are what the police see
// you do. These are the charges the DA stacks on top when the case is filed:
// you get picked up for a robbery and the indictment also says unlawful
// carrying, theft from a person and a terroristic threat.
//
// Each row: [kind, class, text, on, chance, extra]
//   on:     the street offences that can bring it (a kind from classify(),
//           'drugs' / 'launder' for those families, 'stop' for any traffic
//           stop, 'arrest' for any arrest at all)
//   chance: how often the DA adds it when one of those is on the sheet
//   extra:  { tg: 3g offence (parole at half), fine: Class C ticket amount,
//             life: a life sentence, lwop: no parole, armed: only when you're
//             carrying a gun, felon: only with a prior felony, prison: only
//             written up inside TDCJ }
// DOM-free so check-data can test it.

const T = (kind, text, fine, on = ['stop'], chance = 0.12) => [kind, 'C', text, on, chance, { fine }];

const ROWS = [
  // ---------------- homicide ----------------
  ['murder', 'F1', 'Murder.', [], 0, { life: true, tg: true }],
  ['capital_murder', 'CF', 'Capital murder (more than one person killed).', [], 0, { life: true, lwop: true, tg: true }],
  ['capital_murder_po', 'CF', 'Capital murder of a peace officer.', [], 0, { life: true, lwop: true, tg: true }],
  ['manslaughter', 'F2', 'Manslaughter.', [], 0],
  ['neg_homicide', 'SJF', 'Criminally negligent homicide.', [], 0],
  ['intox_manslaughter', 'F2', 'Intoxication manslaughter.', [], 0, { tg: true }],
  ['conspiracy_murder', 'F1', 'Criminal conspiracy to commit murder.', ['driveby'], 0.08],
  ['solicit_murder', 'F1', 'Criminal solicitation of murder.', ['driveby', 'eoca'], 0.05],
  ['abuse_corpse', 'A', 'Abuse of a corpse.', ['murder'], 0.15],
  ['fail_report_death', 'A', 'Failure to report a death.', ['murder'], 0.2],
  ['tamper_evidence_corpse', 'F2', 'Tampering with evidence: a human corpse.', ['murder'], 0.25],

  // ---------------- assault and violence ----------------
  ['assault_bi', 'A', 'Assault causing bodily injury.', ['assault', 'robbery', 'carjack'], 0.25],
  ['agg_assault_sbi', 'F2', 'Aggravated assault causing serious bodily injury.', ['shots', 'assault', 'murder'], 0.2, { tg: true }],
  ['agg_assault_vehicle', 'F2', 'Aggravated assault with a deadly weapon (a motor vehicle).', ['hitrun'], 0.12, { tg: true }],
  ['assault_ps', 'F3', 'Assault on a public servant.', ['evading'], 0.06],
  ['harass_ps', 'F3', 'Harassment of a public servant.', ['evading', 'arrest'], 0.03],
  ['injury_elderly', 'F3', 'Injury to an elderly individual.', ['robbery', 'assault'], 0.05],
  ['unlawful_restraint', 'A', 'Unlawful restraint.', ['robbery', 'carjack'], 0.2],
  ['restraint_sbi', 'F3', 'Unlawful restraint exposing a person to serious bodily injury.', ['carjack'], 0.08],
  ['kidnapping', 'F3', 'Kidnapping.', ['carjack'], 0.08],
  ['agg_kidnapping', 'F1', 'Aggravated kidnapping.', ['carjack', 'robbery'], 0.03, { tg: true }],
  ['deadly_conduct_point', 'A', 'Deadly conduct: pointing a firearm at someone.', ['brandish', 'robbery', 'carjack'], 0.25],
  ['terror_threat', 'B', 'Terroristic threat.', ['brandish', 'robbery', 'carjack'], 0.2],
  ['terror_threat_public', 'A', 'Terroristic threat causing public fear.', ['shots', 'driveby'], 0.2],
  ['terror_threat_ps', 'F3', 'Terroristic threat against a public servant.', ['evading'], 0.03],
  ['riot', 'B', 'Riot.', ['driveby', 'eoca'], 0.12],
  ['disorderly_discharge', 'B', 'Disorderly conduct: discharging a firearm in a public place.', ['shots'], 0.25],
  ['disorderly_fight', 'C', 'Disorderly conduct: fighting in public.', ['assault'], 0.2, { fine: 350 }],
  ['disorderly_language', 'C', 'Disorderly conduct: abusive language.', ['arrest'], 0.06, { fine: 200 }],
  ['assault_contact', 'C', 'Assault by offensive contact.', ['assault', 'robbery'], 0.12, { fine: 400 }],
  ['assault_threat', 'C', 'Assault by threat.', ['brandish', 'robbery'], 0.15, { fine: 400 }],
  ['stalking', 'F3', 'Stalking.', ['driveby'], 0.04],
  ['harassment', 'B', 'Harassment (threatening messages).', ['driveby', 'eoca'], 0.08],
  ['online_impersonation', 'F3', 'Online impersonation.', ['eoca'], 0.04],
  ['retaliation', 'F3', 'Retaliation against a witness.', ['murder', 'driveby', 'eoca'], 0.1],
  ['tamper_witness', 'F3', 'Tampering with a witness.', ['murder', 'eoca', 'robbery'], 0.08],
  ['deadly_conduct_house', 'F3', 'Deadly conduct: shooting at a habitation.', ['driveby'], 0.2],
  ['deadly_conduct_vehicle', 'F3', 'Deadly conduct: shooting at a vehicle.', ['driveby', 'shots'], 0.15],

  // ---------------- weapons ----------------
  ['ucw', 'A', 'Unlawful carrying of a weapon (while committing a crime).', ['arrest'], 0.6, { armed: true }],
  ['ucw_vehicle', 'A', 'Unlawful carrying of a handgun in a motor vehicle.', ['evading', 'drugs', 'reckless'], 0.3, { armed: true }],
  ['ucw_premises', 'F3', 'Unlawful carrying of a weapon on licensed premises.', ['robbery'], 0.12],
  ['felon_firearm', 'F3', 'Unlawful possession of a firearm by a felon.', ['arrest'], 0.9, { armed: true, felon: true }],
  ['felon_body_armor', 'F3', 'Unlawful possession of body armor by a felon.', ['shots', 'robbery'], 0.05, { felon: true }],
  ['switch', 'F3', 'Possession of a prohibited weapon: auto sear ("switch").', ['auto'], 0.6],
  ['sbr', 'F3', 'Possession of a prohibited weapon: short-barrel firearm.', ['auto', 'shots'], 0.06],
  ['ap_ammo', 'F3', 'Possession of armor-piercing ammunition.', ['auto', 'shots'], 0.05],
  ['zip_gun', 'F3', 'Possession of a prohibited weapon: zip gun.', ['shots'], 0.02],
  ['explosive', 'F3', 'Possession of a prohibited weapon: explosive device.', ['driveby'], 0.02],
  ['gun_school', 'F3', 'Places weapons prohibited: firearm on school grounds.', ['shots', 'brandish'], 0.04],
  ['gun_unlawful_transfer', 'A', 'Unlawful transfer of a firearm.', ['stolen_goods'], 0.1],
  ['straw_purchase', 'SJF', 'False statement to acquire a firearm (straw purchase).', ['stolen_goods', 'auto'], 0.05],
  ['theft_firearm', 'SJF', 'Theft of a firearm.', ['stolen_goods', 'robbery'], 0.08],
  ['gun_accessible_child', 'C', 'Making a firearm accessible to a child.', ['arrest'], 0.02, { fine: 500, armed: true }],
  ['display_weapon_school', 'B', 'Exhibiting a firearm near a school.', ['brandish'], 0.05],
  ['silencer_felon', 'F3', 'Possession of a firearm silencer by a felon.', ['auto'], 0.04, { felon: true }],

  // ---------------- robbery, theft, burglary ----------------
  ['agg_robbery_elderly', 'F1', 'Aggravated robbery of an elderly person.', ['robbery'], 0.06, { tg: true }],
  ['robbery_bi', 'F2', 'Robbery causing bodily injury.', ['carjack'], 0.15],
  ['theft_person', 'SJF', 'Theft from a person.', ['robbery'], 0.2],
  ['burglary_habitation', 'F2', 'Burglary of a habitation.', ['stolen_goods'], 0.08],
  ['burglary_habitation_felony', 'F1', 'Burglary of a habitation with intent to commit a felony.', ['robbery'], 0.04],
  ['burglary_building', 'SJF', 'Burglary of a building.', ['stolen_goods', 'robbery'], 0.1],
  ['burglary_vehicle', 'A', 'Burglary of a vehicle.', ['gta', 'stolen_goods', 'carjack'], 0.2],
  ['burglary_vehicle_repeat', 'SJF', 'Burglary of a vehicle (two or more priors).', ['gta'], 0.05, { felon: true }],
  ['burglary_coin', 'A', 'Burglary of a coin-operated machine.', ['stolen_goods'], 0.04],
  ['trespass', 'B', 'Criminal trespass.', ['stolen_goods', 'robbery', 'chop', 'gta'], 0.15],
  ['trespass_habitation', 'A', 'Criminal trespass of a habitation.', ['stolen_goods'], 0.06],
  ['trespass_ag', 'B', 'Criminal trespass on agricultural land.', ['stolen_goods'], 0.03],
  ['org_retail_theft', 'F3', 'Organized retail theft.', ['robbery', 'stolen_goods'], 0.08],
  ['theft_receiving', 'B', 'Theft by receiving stolen property.', ['stolen_goods', 'chop'], 0.2],
  ['theft_pawn', 'A', 'Theft: selling stolen property to a pawnbroker.', ['stolen_goods'], 0.08],
  ['cargo_theft', 'F2', 'Cargo theft.', ['stolen_goods'], 0.02],
  ['metal_theft', 'SJF', 'Theft of copper, aluminum or scrap metal.', ['stolen_goods', 'chop'], 0.04],
  ['catalytic_theft', 'SJF', 'Theft of a catalytic converter.', ['chop', 'gta'], 0.12],
  ['livestock_theft', 'F3', 'Theft of livestock.', ['stolen_goods'], 0.02],
  ['theft_service', 'B', 'Theft of service.', ['arrest'], 0.03],
  ['theft_check', 'B', 'Theft by check (a hot check).', ['launder'], 0.06],
  ['theft_vehicle', 'F3', 'Theft of a motor vehicle ($30,000 – $150,000).', ['gta', 'carjack'], 0.15],
  ['theft_vehicle_150', 'F2', 'Theft of a motor vehicle ($150,000 – $300,000).', ['gta'], 0.04],
  ['unlawful_instrument', 'SJF', 'Unlawful use of a criminal instrument (key programmer).', ['gta', 'carjack'], 0.12],
  ['credit_card_abuse', 'SJF', 'Credit card or debit card abuse.', ['robbery', 'stolen_goods'], 0.08],
  ['fraud_id', 'SJF', 'Fraudulent use or possession of identifying information.', ['stolen_goods', 'launder'], 0.06],
  ['mail_theft', 'A', 'Mail theft.', ['stolen_goods'], 0.04],
  ['package_theft', 'B', 'Porch piracy (theft of a delivered package).', ['stolen_goods'], 0.05],

  // ---------------- cars and chop shops ----------------
  ['tamper_vin', 'SJF', 'Tampering with a vehicle identification number.', ['chop', 'gta'], 0.15],
  ['stolen_vin_plate', 'SJF', 'Possession of a stolen VIN plate.', ['chop'], 0.1],
  ['sell_no_vin', 'F3', 'Selling a motor vehicle with a removed VIN.', ['chop'], 0.08],
  ['title_fraud', 'SJF', 'Fraudulent application for a vehicle title.', ['chop', 'gta'], 0.06],
  ['fraud_transfer_vehicle', 'SJF', 'Fraudulent transfer of a motor vehicle.', ['chop', 'gta'], 0.05],
  ['unlicensed_salvage', 'A', 'Operating an unlicensed salvage yard.', ['chop'], 0.12],
  ['odometer', 'A', 'Odometer tampering.', ['chop'], 0.05],
  ['fictitious_plate', 'B', 'Fictitious license plate or registration.', ['gta', 'evading', 'stop'], 0.05],
  ['tamper_gov_record_plate', 'A', 'Tampering with a governmental record (fake temp tag).', ['gta', 'evading'], 0.08],
  ['insurance_fraud', 'SJF', 'Insurance fraud (a false theft claim).', ['chop', 'hitrun'], 0.05],
  ['unauth_tow', 'B', 'Unauthorized towing of a motor vehicle.', ['gta'], 0.02],

  // ---------------- driving (court cases) ----------------
  ['reckless_driving', 'B', 'Reckless driving.', ['reckless', 'evading', 'burnout'], 0.25],
  ['racing_bi', 'A', 'Racing on a highway causing bodily injury.', ['burnout', 'hitrun'], 0.05],
  ['racing_open', 'A', 'Racing on a highway with an open container.', ['burnout'], 0.04],
  ['racing_sbi', 'F2', 'Racing on a highway causing serious bodily injury.', ['hitrun'], 0.02],
  ['obstruct_highway', 'B', 'Obstructing a highway or passageway (street takeover).', ['burnout', 'reckless'], 0.15],
  ['takeover_spectator', 'B', 'Participating in a street takeover.', ['burnout'], 0.08],
  ['dwi', 'B', 'Driving while intoxicated.', ['reckless', 'hitrun', 'evading'], 0.07],
  ['dwi_open', 'B', 'Driving while intoxicated with an open container.', ['reckless'], 0.03],
  ['dwi_2', 'A', 'Driving while intoxicated (2nd).', ['reckless', 'hitrun'], 0.03, { felon: true }],
  ['dwi_3', 'F3', 'Driving while intoxicated (3rd or more).', ['reckless', 'hitrun'], 0.02, { felon: true }],
  ['dwi_child', 'SJF', 'Driving while intoxicated with a child passenger.', ['reckless'], 0.01],
  ['intox_assault', 'F3', 'Intoxication assault.', ['hitrun'], 0.03],
  ['fsra', 'F3', 'Failure to stop and render aid (injury).', ['hitrun'], 0.15],
  ['dwli', 'B', 'Driving while license invalid.', ['evading', 'reckless', 'stop'], 0.06],
  ['dwli_prior', 'A', 'Driving while license invalid (no insurance, prior).', ['evading'], 0.04],
  ['no_cdl', 'B', 'Operating a commercial motor vehicle without a CDL.', ['stop'], 0.02],
  ['flee_po', 'B', 'Fleeing or attempting to elude a police officer.', ['evading'], 0.15],
  ['evading_prior', 'SJF', 'Evading arrest with a vehicle (prior conviction).', ['evading'], 0.1, { felon: true }],
  ['evading_sbi', 'F2', 'Evading arrest causing serious bodily injury.', ['evading'], 0.03],
  ['evading_tire', 'F3', 'Evading arrest: using a tire deflation device.', ['evading'], 0.01],

  // ---------------- police and courts ----------------
  ['resisting', 'A', 'Resisting arrest, search or transportation.', ['evading', 'assault', 'arrest'], 0.12],
  ['resisting_dw', 'F3', 'Resisting arrest with a deadly weapon.', ['shots', 'assault'], 0.06],
  ['fail_id', 'B', 'Failure to identify (gave a false name).', ['evading', 'arrest'], 0.06],
  ['fail_id_fugitive', 'A', 'Failure to identify as a fugitive.', ['bailjump', 'fta'], 0.2],
  ['interference', 'B', 'Interference with public duties.', ['evading', 'arrest'], 0.06],
  ['hindering', 'A', 'Hindering apprehension or prosecution.', ['eoca', 'driveby'], 0.06],
  ['false_report', 'B', 'False report to a peace officer.', ['arrest', 'hitrun'], 0.04],
  ['false_alarm', 'A', 'False alarm or report (a fake 911 call).', ['arrest'], 0.01],
  ['tamper_evidence', 'F3', 'Tampering with physical evidence.', ['murder', 'shots', 'drugs', 'robbery', 'driveby'], 0.15],
  ['tamper_gov_record', 'A', 'Tampering with a governmental record.', ['launder', 'bailjump'], 0.05],
  ['perjury', 'A', 'Perjury.', ['bailjump'], 0.03],
  ['agg_perjury', 'F3', 'Aggravated perjury.', ['bailjump'], 0.01],
  ['bond_violation', 'B', 'Violation of bond conditions.', ['bailjump'], 0.3],
  ['contempt', 'C', 'Contempt of court.', ['bailjump', 'fta'], 0.2, { fine: 500 }],
  ['bribery', 'F2', 'Bribery of a public servant.', ['launder'], 0.02],
  ['impersonate_po', 'F3', 'Impersonating a public servant.', ['arrest'], 0.005],
  ['obstruction', 'F3', 'Obstruction or retaliation.', ['murder', 'eoca'], 0.05],
  ['escape', 'F3', 'Escape from custody.', [], 0, { prison: true }],

  // ---------------- gangs and organized crime ----------------
  ['gang_recruit', 'F3', 'Coercing, soliciting or inducing gang membership.', ['eoca', 'driveby'], 0.06],
  ['directing_gang', 'F1', 'Directing activities of a criminal street gang.', ['eoca', 'driveby'], 0.03, { tg: true }],
  ['continuous_trafficking', 'F1', 'Continuous trafficking of a controlled substance.', ['drugs'], 0.02],
  ['conspiracy_deliver', 'F2', 'Criminal conspiracy to deliver a controlled substance.', ['drugs', 'eoca'], 0.06],
  ['gambling', 'C', 'Gambling (a street dice game).', ['arrest'], 0.04, { fine: 500 }],
  ['gambling_promotion', 'A', 'Gambling promotion.', ['eoca', 'launder'], 0.04],
  ['gambling_place', 'A', 'Keeping a gambling place.', ['launder'], 0.03],
  ['gambling_device', 'A', 'Possession of a gambling device (eight-liner).', ['launder'], 0.03],

  // ---------------- drugs ----------------
  ['paraphernalia', 'C', 'Possession of drug paraphernalia.', ['drugs'], 0.4, { fine: 500 }],
  ['poss_mj_2', 'B', 'Possession of marijuana (under 2 oz).', ['drugs', 'arrest'], 0.06],
  ['poss_mj_4', 'A', 'Possession of marijuana (2 – 4 oz).', ['drugs'], 0.05],
  ['poss_thc', 'SJF', 'Possession of THC concentrate (a vape cart).', ['drugs', 'arrest'], 0.06],
  ['deliver_mj_small', 'B', 'Delivery of marijuana (1/4 oz or less, no pay).', ['drugs'], 0.05],
  ['deliver_mj', 'A', 'Delivery of marijuana (1/4 oz or less).', ['drugs'], 0.06],
  ['poss_dangerous_drug', 'A', 'Possession of a dangerous drug (pills without a prescription).', ['drugs', 'arrest'], 0.05],
  ['poss_codeine', 'SJF', 'Possession of codeine (lean).', ['drugs'], 0.06],
  ['poss_xanax', 'SJF', 'Possession of a controlled substance: alprazolam.', ['drugs'], 0.05],
  ['poss_mdma', 'SJF', 'Possession of a controlled substance: MDMA (under 1 g).', ['drugs'], 0.04],
  ['poss_shrooms', 'SJF', 'Possession of a controlled substance: psilocybin.', ['drugs'], 0.03],
  ['poss_meth', 'F3', 'Possession of a controlled substance: methamphetamine (1 – 4 g).', ['drugs'], 0.04],
  ['poss_fentanyl', 'F2', 'Possession of fentanyl (1 – 4 g).', ['drugs'], 0.03],
  ['deliver_fentanyl', 'F1', 'Manufacture or delivery of fentanyl.', ['drugs'], 0.01, { tg: true }],
  ['rx_fraud', 'SJF', 'Obtaining a controlled substance by fraud (fake prescription).', ['drugs'], 0.03],
  ['manufacture', 'F1', 'Manufacture of a controlled substance (a lab).', ['drugs'], 0.02],
  ['drug_free_zone', 'F3', 'Delivery in a drug-free zone (within 1,000 ft of a school).', ['drugs'], 0.08],
  ['drug_house', 'A', 'Maintaining a drug house (common nuisance).', ['drugs'], 0.08],
  ['drug_proceeds', 'SJF', 'Possession of drug proceeds.', ['drugs', 'launder'], 0.1],
  ['inhalant', 'B', 'Possession of an abusable volatile chemical.', ['drugs'], 0.01],
  ['simulated_drug', 'A', 'Delivery of a simulated controlled substance (fake product).', ['drugs'], 0.03],

  // ---------------- money, fraud, white collar ----------------
  ['structuring', 'SJF', 'Money laundering: structuring cash deposits.', ['launder'], 0.2],
  ['false_credit_statement', 'SJF', 'False statement to obtain property or credit.', ['launder'], 0.08],
  ['mortgage_fraud', 'F3', 'Mortgage fraud.', ['launder'], 0.04],
  ['sales_tax_fraud', 'F3', 'Sales tax fraud.', ['launder'], 0.05],
  ['tax_evasion', 'F3', 'Failure to remit taxes collected.', ['launder'], 0.04],
  ['forgery', 'SJF', 'Forgery of a check or commercial instrument.', ['launder'], 0.06],
  ['forgery_money', 'F3', 'Forgery: counterfeit currency.', ['launder'], 0.03],
  ['securing_deception', 'SJF', 'Securing execution of a document by deception.', ['launder'], 0.03],
  ['commercial_bribery', 'SJF', 'Commercial bribery.', ['launder'], 0.02],
  ['misapplication', 'SJF', 'Misapplication of fiduciary property.', ['launder'], 0.02],
  ['identity_theft', 'F3', 'Identity theft (10 or more items).', ['launder'], 0.03],
  ['wire_fraud_state', 'F3', 'Breach of computer security.', ['launder'], 0.02],
  ['exploitation_elderly', 'F3', 'Financial exploitation of an elderly person.', ['launder'], 0.01],
  ['fraud_filing', 'SJF', 'Fraudulent filing of a financing statement.', ['launder'], 0.01],
  ['bank_fraud', 'F3', 'Fraud on a financial institution.', ['launder'], 0.03],
  ['cash_reporting', 'A', 'Failure to report a cash transaction.', ['launder'], 0.05],

  // ---------------- property and public order ----------------
  ['mischief_100', 'B', 'Criminal mischief ($100 – $750).', ['hitrun', 'shots', 'burnout', 'driveby'], 0.15],
  ['mischief_750', 'A', 'Criminal mischief ($750 – $2,500).', ['hitrun', 'driveby', 'shots'], 0.12],
  ['mischief_2500', 'SJF', 'Criminal mischief ($2,500 – $30,000).', ['driveby', 'hitrun'], 0.08],
  ['mischief_30k', 'F3', 'Criminal mischief ($30,000 – $150,000).', ['driveby'], 0.03],
  ['mischief_fence', 'C', 'Criminal mischief: cutting a fence.', ['stolen_goods'], 0.03, { fine: 500 }],
  ['graffiti', 'B', 'Graffiti.', ['eoca', 'driveby'], 0.08],
  ['arson', 'F2', 'Arson.', ['chop'], 0.02],
  ['arson_vehicle', 'F2', 'Arson of a vehicle.', ['gta', 'chop'], 0.02],
  ['illegal_dumping', 'B', 'Illegal dumping.', ['chop'], 0.06],
  ['public_intox', 'C', 'Public intoxication.', ['arrest'], 0.05, { fine: 400 }],
  ['loitering', 'C', 'Loitering.', ['arrest'], 0.03, { fine: 200 }],
  ['curfew', 'C', 'Juvenile curfew violation.', [], 0, { fine: 200 }],
  ['noise_ordinance', 'C', 'Noise ordinance violation (loud music).', ['noise'], 0.25, { fine: 250 }],
  ['fireworks', 'C', 'Discharging fireworks in the city limits.', ['shots'], 0.03, { fine: 300 }],
  ['cruelty_animal', 'A', 'Cruelty to non-livestock animals.', ['arrest'], 0.005],
  ['cruelty_livestock', 'A', 'Cruelty to livestock animals.', ['stolen_goods'], 0.01],
  ['urinating', 'C', 'Urinating in public.', ['arrest'], 0.02, { fine: 200 }],
  ['open_container_public', 'C', 'Open container in a public place.', ['arrest'], 0.04, { fine: 300 }],
  ['littering', 'C', 'Littering.', ['arrest'], 0.03, { fine: 200 }],

  // ---------------- inside TDCJ ----------------
  ['inmate_assault', 'F3', 'Assault by an inmate.', [], 0, { prison: true }],
  ['prison_phone', 'F3', 'Possession of a cell phone in a correctional facility.', [], 0, { prison: true }],
  ['prison_contraband', 'F3', 'Prohibited substance in a correctional facility.', [], 0, { prison: true }],
  ['prison_weapon', 'F3', 'Possession of a deadly weapon in a penal institution.', [], 0, { prison: true }],
  ['prison_bribery', 'F2', 'Bribery of a correctional officer.', [], 0, { prison: true }],

  // ---------------- traffic tickets (Class C, paid at the window) ----------------
  T('no_seatbelt', 'Failure to wear a safety belt.', 200),
  T('no_signal', 'Failure to signal a turn or lane change.', 175),
  T('unsafe_lane', 'Unsafe lane change.', 200, ['stop', 'speeding', 'reckless']),
  T('following_close', 'Following too closely.', 200, ['stop', 'speeding']),
  T('fail_yield', 'Failure to yield the right of way.', 250, ['stop', 'redlight']),
  T('stop_sign', 'Disregarding a stop sign.', 225, ['stop', 'redlight']),
  T('wrong_way', 'Driving the wrong way on a one-way street.', 275, ['stop', 'reckless']),
  T('illegal_uturn', 'Illegal U-turn.', 150),
  T('window_tint', 'Illegal window tint.', 150),
  T('no_insurance', 'No proof of financial responsibility (insurance).', 350),
  T('expired_reg', 'Expired registration.', 125),
  T('no_dl', 'No driver\'s license on you.', 250),
  T('expired_dl', 'Expired driver\'s license.', 125),
  T('no_front_plate', 'No front license plate.', 100),
  T('obscured_plate', 'Obscured license plate (cover or frame).', 175),
  T('headlamp', 'Defective headlamp.', 125),
  T('tail_lamp', 'Defective tail lamp.', 100),
  T('no_lights_night', 'Driving without headlights at night.', 175),
  T('loud_stereo', 'Loud car stereo.', 200, ['noise', 'stop']),
  T('muffler', 'Modified muffler or no muffler.', 225, ['noise']),
  T('impeding', 'Impeding the normal flow of traffic.', 150),
  T('left_lane', 'Driving in the left lane while not passing.', 150, ['stop', 'speeding']),
  T('texting', 'Texting while driving.', 200),
  T('school_zone', 'Speeding in a school zone.', 300, ['speeding']),
  T('work_zone', 'Speeding in a construction zone (fine doubled).', 400, ['speeding']),
  T('open_container', 'Open container in a motor vehicle.', 300),
  T('litter_vehicle', 'Littering from a vehicle.', 200),
  T('exhaust_smoke', 'Excessive exhaust smoke.', 150, ['burnout', 'noise']),
  T('squeal', 'Unnecessary noise: squealing tires.', 175, ['burnout']),
  T('underglow', 'Illegal underglow lighting.', 150),
  T('red_blue', 'Red or blue lights on a private vehicle.', 250),
  T('bumper_height', 'Bumper height violation.', 150),
  T('single_lane', 'Failure to drive in a single lane.', 200, ['stop', 'reckless']),
  T('shoulder', 'Passing on the shoulder.', 250, ['stop', 'reckless', 'speeding']),
  T('flashing_red', 'Running a flashing red light.', 200, ['redlight']),
  T('ped_crosswalk', 'Failure to yield to a pedestrian in a crosswalk.', 250, ['redlight', 'stop']),
  T('fire_lane', 'Parking in a fire lane.', 250),
  T('unsecured_load', 'Unsecured load.', 200),
  T('lane_signal', 'Disregarding a lane control signal.', 175, ['redlight']),
  T('fail_dim', 'Failure to dim headlights.', 125),
  T('no_sticker', 'Failure to display the registration sticker.', 100),
  T('no_inspection', 'Expired vehicle inspection.', 150),
  T('cracked_windshield', 'Cracked windshield obstructing view.', 125),
  T('speed_unsafe', 'Unsafe speed for conditions.', 225, ['speeding']),
  T('minimum_speed', 'Racing the engine at a light (exhibition of acceleration).', 175, ['burnout']),
  T('jaywalk', 'Pedestrian in the roadway.', 100, ['arrest']),
  T('overweight', 'Overweight commercial vehicle.', 500),
  T('logbook', 'No driver\'s logbook (commercial vehicle).', 300),
];

export const CHARGES = ROWS.map(([kind, cls, text, on, chance, extra = {}]) => ({ kind, cls, text, on, chance, ...extra }));
export const CHARGE_BY_KIND = Object.fromEntries(CHARGES.map(c => [c.kind, c]));

// The trigger family of a street offence: drugs_F2 → 'drugs', launder_F3 → 'launder'.
export const family = kind => kind?.startsWith('drugs_') ? 'drugs' : kind?.startsWith('launder_') ? 'launder' : kind;

// The charges the DA adds on top of `items` (the offences on the sheet).
// ctx: { armed, felon, rng }. At most `max` court charges (plus the gun
// charges) and two tickets.
export function stackCharges(items, { armed = false, felon = false, rng = Math.random, max = 3 } = {}) {
  const fams = new Set(items.map(o => family(o.kind)).filter(Boolean));
  if (!fams.size) return [];
  fams.add('arrest');
  const have = new Set(items.map(o => o.kind));
  const out = [];
  let court = 0, tix = 0;
  for (const c of CHARGES) {
    if (have.has(c.kind) || c.prison || !c.on.some(f => fams.has(f))) continue;
    if (c.armed && !armed) continue;
    if (c.felon && !felon) continue;
    if (rng() >= c.chance) continue;
    if (c.cls === 'C') { if (tix >= 2) continue; tix++; }
    else if (!c.armed && !c.felon) { if (court >= max) continue; court++; }   // a gun on you always counts
    out.push({ kind: c.kind, text: c.text, fine: c.fine || 0, stacked: true });
  }
  return out;
}

// Extra things an officer writes you for at a traffic stop (Class C only).
export function extraTickets(items, rng = Math.random) {
  const fams = new Set(items.map(o => family(o.kind)));
  fams.add('stop');
  const have = new Set(items.map(o => o.kind));
  const pool = CHARGES.filter(c => c.cls === 'C' && !have.has(c.kind) && c.on.some(f => fams.has(f)));
  const out = [];
  for (const c of pool) {
    if (out.length >= 2) break;
    if (rng() < c.chance * 0.5) out.push({ kind: c.kind, text: c.text, fine: c.fine });
  }
  return out;
}
