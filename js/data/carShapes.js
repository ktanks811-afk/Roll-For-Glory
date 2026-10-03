// Exterior design sheet for every car: real overall length / width / height /
// wheelbase (metres), a roofline archetype, and the details that make a model
// recognisable (doors, convertible, factory wing, headlight style, roof rails,
// lift). The side-view showroom and the top-down world sprites are both built
// from this, so a Civic Type R and a Camry are different shapes, not recolours.
//
//   arch: S sedan · F fastback sedan/liftback · H hatchback · h sloping hatch
//         coupe · C notchback coupe · B fastback coupe · M muscle notchback ·
//         R long-hood sports / roadster · X mid-engine · N rear-engine 911 ·
//         W wagon · U crossover · Q boxy SUV · P pickup
//
// Format: id: [arch, L, W, H, WB, options]

export const ARCH = {
  //        xCowl  xA    xC    xD    hoodF hoodB  belt  deck  tail  nose  fo   tire  taper(nose,tail)
  S: { xCowl: .29, xA: .445, xC: .70, xD: .805, hoodF: .53, hoodB: .66, belt: .64, deck: .685, tail: .64, nose: .47, fo: .20, tr: .33, noseW: .8, tailW: .86, doors: 4 },
  F: { xCowl: .29, xA: .45, xC: .74, xD: .955, hoodF: .52, hoodB: .66, belt: .64, deck: .72, tail: .66, nose: .46, fo: .20, tr: .33, noseW: .8, tailW: .84, doors: 4 },
  H: { xCowl: .27, xA: .40, xC: .86, xD: .985, hoodF: .52, hoodB: .62, belt: .60, deck: .72, tail: .58, nose: .46, fo: .19, tr: .31, noseW: .8, tailW: .9, doors: 4 },
  h: { xCowl: .27, xA: .43, xC: .74, xD: .97, hoodF: .50, hoodB: .61, belt: .62, deck: .70, tail: .60, nose: .45, fo: .19, tr: .31, noseW: .78, tailW: .86, doors: 2 },
  C: { xCowl: .30, xA: .465, xC: .67, xD: .795, hoodF: .52, hoodB: .64, belt: .64, deck: .70, tail: .66, nose: .46, fo: .20, tr: .32, noseW: .78, tailW: .86, doors: 2 },
  B: { xCowl: .33, xA: .50, xC: .70, xD: .90, hoodF: .56, hoodB: .66, belt: .66, deck: .75, tail: .70, nose: .50, fo: .20, tr: .34, noseW: .82, tailW: .9, doors: 2 },
  M: { xCowl: .33, xA: .49, xC: .69, xD: .83, hoodF: .60, hoodB: .70, belt: .70, deck: .78, tail: .74, nose: .52, fo: .21, tr: .34, noseW: .86, tailW: .92, doors: 2 },
  R: { xCowl: .31, xA: .43, xC: .62, xD: .74, hoodF: .56, hoodB: .67, belt: .67, deck: .74, tail: .68, nose: .47, fo: .19, tr: .33, noseW: .76, tailW: .9, doors: 2 },
  X: { xCowl: .32, xA: .47, xC: .60, xD: .90, hoodF: .46, hoodB: .62, belt: .60, deck: .64, tail: .56, nose: .40, fo: .20, tr: .35, noseW: .66, tailW: .94, doors: 2 },
  N: { xCowl: .26, xA: .41, xC: .67, xD: .955, hoodF: .50, hoodB: .62, belt: .60, deck: .56, tail: .52, nose: .46, fo: .20, tr: .34, noseW: .74, tailW: .96, doors: 2 },
  W: { xCowl: .29, xA: .435, xC: .915, xD: .99, hoodF: .54, hoodB: .64, belt: .62, deck: .72, tail: .62, nose: .48, fo: .20, tr: .33, noseW: .84, tailW: .96, doors: 4 },
  U: { xCowl: .30, xA: .46, xC: .83, xD: .985, hoodF: .58, hoodB: .67, belt: .62, deck: .70, tail: .60, nose: .50, fo: .20, tr: .37, noseW: .88, tailW: .94, doors: 4 },
  Q: { xCowl: .30, xA: .385, xC: .93, xD: .995, hoodF: .62, hoodB: .67, belt: .60, deck: .72, tail: .64, nose: .53, fo: .17, tr: .38, noseW: .9, tailW: .98, doors: 4 },
  P: { xCowl: .255, xA: .335, xC: .545, xD: .56, hoodF: .62, hoodB: .66, belt: .62, deck: .70, tail: .70, nose: .56, fo: .17, tr: .40, noseW: .9, tailW: .98, doors: 4 },
};

const T = {
  // ---- Honda / Acura
  honda_civic_ex_1996: ['H', 4.18, 1.70, 1.36, 2.62, { doors: 3, lights: 'slim', tl: 'rect' }],
  honda_civic_si_1999: ['C', 4.45, 1.71, 1.32, 2.62, { lights: 'slim', tl: 'rect' }],
  honda_civic_lx_2006: ['S', 4.54, 1.75, 1.43, 2.70, { lights: 'swept', tl: 'wrap', xC: .72, xD: .83 }],
  honda_civic_si_2017: ['C', 4.52, 1.80, 1.37, 2.70, { lights: 'led', tl: 'wrap', xC: .7, xD: .88, deck: .72, wing: 'big' }],
  honda_civic_type_r_fl5_2023: ['H', 4.59, 1.89, 1.41, 2.73, { lights: 'led', tl: 'wrap', xC: .80, xD: .98, wing: 'big', doors: 4, fastTail: true }],
  honda_accord_lx_2003: ['S', 4.81, 1.82, 1.45, 2.74, { lights: 'swept', tl: 'wrap' }],
  honda_prelude_type_sh_1997: ['C', 4.52, 1.75, 1.30, 2.58, { lights: 'slim', tl: 'bar', xC: .64, xD: .8 }],
  honda_s2000_ap2_2004: ['R', 4.12, 1.75, 1.28, 2.40, { conv: true, lights: 'swept', tl: 'round', fo: .17 }],
  acura_integra_gs_r_1994: ['h', 4.37, 1.70, 1.32, 2.57, { lights: 'slim', tl: 'rect', doors: 3 }],
  acura_integra_type_r_1997: ['h', 4.37, 1.70, 1.32, 2.57, { lights: 'slim', tl: 'rect', wing: 'big', doors: 3 }],
  acura_rsx_type_s_2002: ['h', 4.37, 1.72, 1.36, 2.62, { lights: 'swept', tl: 'wrap', wing: 'lip', doors: 3 }],
  acura_nsx_type_s_2022: ['X', 4.49, 1.94, 1.21, 2.63, { lights: 'led', tl: 'led', wing: 'lip', gills: true }],
  // ---- Toyota / Lexus / Scion
  toyota_corolla_le_2003: ['S', 4.37, 1.69, 1.46, 2.60, { lights: 'swept', tl: 'rect' }],
  toyota_camry_le_2007: ['S', 4.80, 1.82, 1.47, 2.78, { lights: 'swept', tl: 'wrap' }],
  toyota_camry_xse_v6_2018: ['S', 4.88, 1.84, 1.44, 2.82, { lights: 'led', tl: 'led', xC: .72, xD: .84, wing: 'lip' }],
  toyota_celica_gt_s_2000: ['h', 4.34, 1.74, 1.31, 2.57, { lights: 'swept', tl: 'wrap', wing: 'lip', doors: 3 }],
  toyota_mr2_turbo_sw20_1991: ['X', 4.17, 1.70, 1.24, 2.45, { lights: 'slim', tl: 'bar', wing: 'lip', fo: .21, xC: .64 }],
  toyota_supra_turbo_mk4_1993: ['B', 4.51, 1.81, 1.27, 2.55, { lights: 'swept', tl: 'round', wing: 'big', xA: .47, xC: .64, xD: .93, deck: .66, hoodF: .50, hoodB: .60 }],
  toyota_gr_supra_3_0_premium_2020: ['B', 4.38, 1.85, 1.29, 2.47, { lights: 'led', tl: 'led', wing: 'duck', xCowl: .32, xA: .48, xC: .64, xD: .9, deck: .66 }],
  toyota_gr86_premium_2022: ['C', 4.27, 1.78, 1.31, 2.58, { lights: 'led', tl: 'led', wing: 'duck', xC: .68, xD: .85, deck: .7 }],
  toyota_gr_corolla_core_2023: ['H', 4.41, 1.85, 1.48, 2.64, { lights: 'led', tl: 'led', wing: 'lip', doors: 3 }],
  toyota_tacoma_trd_sport_2016: ['P', 5.39, 1.89, 1.79, 3.34, { lights: 'swept', tl: 'rect', bed: 1.5 }],
  toyota_tundra_limited_2022: ['P', 5.93, 2.03, 1.98, 3.70, { lights: 'led', tl: 'led', bed: 1.7 }],
  toyota_4runner_sr5_2010: ['Q', 4.82, 1.91, 1.78, 2.79, { lights: 'swept', tl: 'rect', rails: true }],
  lexus_is300_base_2001: ['S', 4.40, 1.72, 1.41, 2.73, { lights: 'round', tl: 'bar', xC: .69, xD: .79 }],
  lexus_is_350_f_sport_2021: ['S', 4.71, 1.84, 1.43, 2.80, { lights: 'led', tl: 'led', xC: .72, xD: .86 }],
  lexus_lfa_2011: ['X', 4.51, 1.90, 1.12, 2.61, { lights: 'slim', tl: 'round', wing: 'duck', fo: .21, xCowl: .35, xA: .5, hoodF: .42, gills: true }],
  scion_tc_base_2005: ['h', 4.38, 1.76, 1.42, 2.60, { lights: 'swept', tl: 'rect', doors: 2 }],
  scion_fr_s_base_2013: ['C', 4.24, 1.78, 1.29, 2.57, { lights: 'swept', tl: 'led', xC: .68, xD: .85, deck: .7 }],
  // ---- Nissan / Infiniti
  nissan_sentra_sr_2010: ['S', 4.52, 1.79, 1.52, 2.70, { lights: 'swept', tl: 'wrap' }],
  nissan_altima_2_5_s_2013: ['S', 4.86, 1.82, 1.48, 2.78, { lights: 'swept', tl: 'wrap' }],
  nissan_maxima_se_2004: ['S', 4.90, 1.83, 1.47, 2.80, { lights: 'swept', tl: 'wrap' }],
  nissan_240sx_se_s14_1995: ['C', 4.52, 1.69, 1.29, 2.52, { lights: 'slim', tl: 'bar', xC: .66, xD: .8 }],
  nissan_350z_enthusiast_2003: ['B', 4.31, 1.82, 1.32, 2.65, { lights: 'swept', tl: 'round', wing: 'lip', xC: .62, xD: .9, deck: .7, hoodF: .52 }],
  nissan_370z_sport_2009: ['B', 4.25, 1.85, 1.31, 2.55, { lights: 'boomerang', tl: 'boomerang', wing: 'lip', xC: .62, xD: .9, deck: .7, hoodF: .52 }],
  nissan_z_performance_2023: ['B', 4.38, 1.84, 1.32, 2.55, { lights: 'led', tl: 'led', wing: 'lip', xC: .62, xD: .9, deck: .7, hoodF: .52 }],
  nissan_skyline_gt_r_v_spec_r34_1999: ['C', 4.60, 1.79, 1.36, 2.67, { lights: 'swept', tl: 'round', wing: 'big', xC: .68, xD: .81 }],
  nissan_gt_r_premium_r35_2017: ['C', 4.69, 1.89, 1.37, 2.78, { lights: 'led', tl: 'round', wing: 'big', xC: .68, xD: .83, deck: .74 }],
  nissan_gt_r_nismo_2020: ['C', 4.69, 1.89, 1.37, 2.78, { lights: 'led', tl: 'round', wing: 'huge', xC: .68, xD: .83, deck: .74 }],
  infiniti_g35_coupe_2003: ['C', 4.63, 1.82, 1.38, 2.85, { lights: 'swept', tl: 'wrap', xC: .67, xD: .83 }],
  infiniti_q50_red_sport_400_2016: ['S', 4.80, 1.82, 1.45, 2.85, { lights: 'led', tl: 'led', xC: .72, xD: .85 }],
  // ---- Mazda
  mazda_mx_5_miata_na_1990: ['R', 3.95, 1.67, 1.23, 2.27, { conv: true, lights: 'pop', tl: 'rect', fo: .19 }],
  mazda_mx_5_miata_club_nd_2016: ['R', 3.92, 1.74, 1.23, 2.31, { conv: true, lights: 'led', tl: 'led', fo: .19 }],
  mazda_rx_7_twin_turbo_fd_1993: ['R', 4.30, 1.77, 1.23, 2.43, { lights: 'pop', tl: 'round', wing: 'big', xC: .6, xD: .88, deck: .68, hoodF: .5, hoodB: .62 }],
  mazda_rx_8_sport_2004: ['C', 4.43, 1.77, 1.34, 2.70, { lights: 'swept', tl: 'wrap', doors: 4, xC: .7, xD: .83 }],
  mazda_mazda3_2_5_turbo_awd_2021: ['H', 4.66, 1.80, 1.43, 2.73, { lights: 'led', tl: 'led', xC: .78, xD: .97, wing: 'lip', fastTail: true }],
  // ---- Subaru / Mitsubishi
  subaru_impreza_wrx_sti_2004: ['S', 4.41, 1.74, 1.42, 2.52, { lights: 'swept', tl: 'wrap', wing: 'huge' }],
  subaru_wrx_premium_2022: ['S', 4.67, 1.83, 1.47, 2.67, { lights: 'led', tl: 'led', wing: 'lip' }],
  subaru_legacy_gt_2005: ['S', 4.67, 1.73, 1.42, 2.67, { lights: 'swept', tl: 'wrap' }],
  subaru_brz_ts_2022: ['C', 4.27, 1.78, 1.31, 2.58, { lights: 'led', tl: 'led', wing: 'big', xC: .68, xD: .85, deck: .7 }],
  subaru_outback_2_5i_2010: ['W', 4.78, 1.82, 1.60, 2.74, { lights: 'swept', tl: 'rect', rails: true }],
  mitsubishi_mirage_es_2017: ['H', 3.85, 1.67, 1.50, 2.45, { lights: 'swept', tl: 'wrap', xA: .39, xC: .88 }],
  mitsubishi_eclipse_gsx_1995: ['h', 4.38, 1.73, 1.30, 2.45, { lights: 'slim', tl: 'bar', wing: 'big', doors: 2, xA: .45, xC: .72 }],
  mitsubishi_3000gt_vr_4_1994: ['h', 4.59, 1.84, 1.28, 2.47, { lights: 'swept', tl: 'bar', wing: 'big', doors: 2, xA: .46, xC: .72 }],
  mitsubishi_lancer_evolution_ix_mr_2006: ['S', 4.49, 1.77, 1.45, 2.63, { lights: 'swept', tl: 'wrap', wing: 'huge' }],
  mitsubishi_lancer_evolution_x_gsr_2008: ['S', 4.51, 1.81, 1.48, 2.65, { lights: 'led', tl: 'wrap', wing: 'huge' }],
  // ---- Hyundai / Kia / Genesis
  hyundai_sonata_gls_2011: ['F', 4.82, 1.84, 1.47, 2.80, { lights: 'swept', tl: 'wrap', xC: .71, xD: .88, deck: .7 }],
  hyundai_genesis_coupe_3_8_r_spec_2013: ['C', 4.63, 1.87, 1.38, 2.82, { lights: 'swept', tl: 'wrap', xC: .66, xD: .82, wing: 'lip' }],
  hyundai_veloster_n_2019: ['H', 4.24, 1.81, 1.39, 2.65, { lights: 'led', tl: 'led', doors: 3, wing: 'roof', xC: .78 }],
  hyundai_elantra_n_2022: ['S', 4.68, 1.83, 1.42, 2.72, { lights: 'led', tl: 'led', wing: 'duck', xC: .72, xD: .86 }],
  hyundai_ioniq_5_n_2025: ['H', 4.66, 1.89, 1.58, 3.00, { lights: 'pixel', tl: 'pixel', wing: 'roof', xCowl: .31, xA: .45, xC: .84, fo: .15 }],
  kia_soul_base_2014: ['H', 4.14, 1.80, 1.61, 2.57, { lights: 'swept', tl: 'rect', xA: .36, xC: .90, hoodF: .56, hoodB: .62 }],
  kia_optima_sx_turbo_2011: ['S', 4.85, 1.84, 1.46, 2.80, { lights: 'swept', tl: 'wrap', xC: .71, xD: .84 }],
  kia_stinger_gt2_awd_2018: ['F', 4.83, 1.87, 1.42, 2.91, { lights: 'led', tl: 'led', wing: 'lip' }],
  genesis_g70_3_3t_sport_2019: ['S', 4.69, 1.85, 1.40, 2.84, { lights: 'led', tl: 'led', xC: .72, xD: .85 }],
  // ---- Ford
  ford_mustang_gt_5_0_fox_body_1987: ['C', 4.55, 1.74, 1.31, 2.55, { lights: 'rect', tl: 'tri', hoodF: .54, xC: .68, xD: .82, fox: true }],
  ford_mustang_gt_s197_2005: ['B', 4.77, 1.88, 1.38, 2.72, { lights: 'round', tl: 'tri', xC: .68, xD: .9 }],
  ford_mustang_ecoboost_2015: ['B', 4.78, 1.92, 1.38, 2.72, { lights: 'led', tl: 'tri', xC: .68, xD: .9 }],
  ford_mustang_gt_s650_2024: ['B', 4.80, 1.92, 1.40, 2.72, { lights: 'led', tl: 'tri', xC: .68, xD: .9 }],
  ford_mustang_dark_horse_2024: ['B', 4.80, 1.92, 1.40, 2.72, { lights: 'led', tl: 'tri', xC: .68, xD: .9, wing: 'lip' }],
  ford_mustang_shelby_gt500_2020: ['B', 4.81, 1.92, 1.38, 2.72, { lights: 'led', tl: 'tri', xC: .68, xD: .9, wing: 'big', scoop: true }],
  ford_mustang_mach_e_gt_2021: ['U', 4.71, 1.88, 1.62, 2.98, { lights: 'led', tl: 'bar', wing: 'roof', xCowl: .31, xA: .47, xC: .84, fo: .17 }],
  ford_focus_st_2015: ['H', 4.36, 1.82, 1.47, 2.65, { lights: 'swept', tl: 'wrap', wing: 'roof' }],
  ford_focus_rs_2016: ['H', 4.39, 1.82, 1.47, 2.65, { lights: 'swept', tl: 'wrap', wing: 'roof', scoop: true }],
  ford_crown_victoria_police_interceptor_2003: ['S', 5.38, 1.98, 1.45, 2.91, { lights: 'rect', tl: 'rect', xA: .43, xC: .67, xD: .78, deck: .70, police: true }],
  ford_ranger_xlt_2001: ['P', 5.07, 1.79, 1.65, 3.11, { lights: 'rect', tl: 'rect', bed: 1.8, doors: 2 }],
  ford_explorer_xlt_2002: ['Q', 4.87, 1.83, 1.80, 2.83, { lights: 'swept', tl: 'rect', rails: true, xA: .40, xC: .92 }],
  ford_f_150_xlt_5_0_2015: ['P', 5.89, 2.03, 1.95, 3.69, { lights: 'swept', tl: 'rect', bed: 1.7 }],
  ford_f_150_raptor_2021: ['P', 5.89, 2.20, 2.03, 3.69, { lights: 'led', tl: 'led', bed: 1.7, lift: 0.1 }],
  ford_f_150_raptor_r_2023: ['P', 5.97, 2.20, 2.03, 3.69, { lights: 'led', tl: 'led', bed: 1.7, lift: 0.1 }],
  ford_gt_2017: ['X', 4.78, 2.00, 1.11, 2.71, { lights: 'led', tl: 'led', wing: 'huge', gills: true, xCowl: .3, xA: .46, xC: .58, hoodF: .44 }],
  lincoln_town_car_signature_2003: ['S', 5.47, 1.99, 1.47, 3.05, { lights: 'rect', tl: 'rect', xA: .43, xC: .68, xD: .79, deck: .72 }],
  // ---- GM
  chevrolet_chevelle_ss_454_1970: ['M', 4.97, 1.88, 1.37, 2.92, { lights: 'quad', tl: 'rect', xCowl: .34, xA: .50, xC: .70, xD: .82, hoodF: .62, scoop: true }],
  chevrolet_impala_ss_1994: ['S', 5.44, 1.95, 1.38, 2.94, { lights: 'swept', tl: 'rect', xA: .44, xC: .70, xD: .83, deck: .70 }],
  chevrolet_malibu_lt_2008: ['S', 4.85, 1.85, 1.46, 2.85, { lights: 'swept', tl: 'wrap' }],
  chevrolet_cruze_lt_2011: ['S', 4.60, 1.79, 1.48, 2.69, { lights: 'swept', tl: 'wrap' }],
  chevrolet_cobalt_ss_turbo_2008: ['C', 4.55, 1.70, 1.39, 2.64, { lights: 'swept', tl: 'rect', wing: 'big' }],
  chevrolet_camaro_ss_2016: ['B', 4.78, 1.90, 1.35, 2.81, { lights: 'led', tl: 'wrap', xCowl: .34, xA: .52, xC: .72, xD: .91, belt: .70, hoodF: .56 }],
  chevrolet_camaro_zl1_2017: ['B', 4.78, 1.90, 1.35, 2.81, { lights: 'led', tl: 'wrap', xCowl: .34, xA: .52, xC: .72, xD: .91, belt: .70, hoodF: .56, wing: 'big', scoop: true }],
  chevrolet_corvette_c5_1997: ['R', 4.57, 1.87, 1.21, 2.65, { lights: 'slim', tl: 'round', xCowl: .34, xA: .50, xC: .68, xD: .95, hoodF: .52, hoodB: .62, deck: .64 }],
  chevrolet_corvette_z06_c6_2006: ['R', 4.45, 1.92, 1.24, 2.69, { lights: 'slim', tl: 'round', xCowl: .34, xA: .50, xC: .68, xD: .95, hoodF: .52, hoodB: .62, deck: .64, scoop: true }],
  chevrolet_corvette_stingray_c8_2020: ['X', 4.63, 1.93, 1.23, 2.72, { lights: 'led', tl: 'led', wing: 'lip', gills: true }],
  chevrolet_corvette_z06_c8_2023: ['X', 4.68, 1.97, 1.23, 2.72, { lights: 'led', tl: 'led', wing: 'big', gills: true }],
  chevrolet_silverado_1500_lt_5_3_2014: ['P', 5.84, 2.03, 1.89, 3.58, { lights: 'swept', tl: 'rect', bed: 1.7 }],
  chevrolet_tahoe_lt_2007: ['Q', 5.13, 2.00, 1.96, 2.95, { lights: 'swept', tl: 'rect', rails: true, xA: .395, xC: .93 }],
  gmc_syclone_1991: ['P', 4.78, 1.77, 1.63, 2.78, { lights: 'rect', tl: 'rect', bed: 1.4, doors: 2, lowered: true }],
  gmc_sierra_1500_denali_6_2_2019: ['P', 5.89, 2.06, 1.93, 3.74, { lights: 'led', tl: 'led', bed: 1.7 }],
  cadillac_cts_v_2016: ['S', 4.97, 1.84, 1.45, 2.91, { lights: 'led', tl: 'led', xC: .71, xD: .85, wing: 'lip' }],
  cadillac_ct5_v_blackwing_2022: ['S', 4.92, 1.88, 1.45, 2.95, { lights: 'led', tl: 'led', xC: .72, xD: .86, wing: 'lip' }],
  cadillac_escalade_premium_luxury_2021: ['Q', 5.38, 2.06, 1.94, 3.07, { lights: 'led', tl: 'led', rails: true }],
  buick_grand_national_1986: ['M', 5.10, 1.89, 1.38, 2.90, { lights: 'rect', tl: 'rect', hoodF: .58, scoop: true, xCowl: .33, xA: .49, xC: .68, xD: .80, deck: .74 }],
  pontiac_firebird_trans_am_ws6_1998: ['B', 4.93, 1.88, 1.30, 2.57, { lights: 'slim', tl: 'bar', wing: 'big', scoop: true, xCowl: .31, xA: .48, xC: .68, xD: .93, deck: .66, hoodF: .5, hoodB: .6 }],
  pontiac_gto_6_0_2005: ['C', 4.82, 1.85, 1.40, 2.75, { lights: 'swept', tl: 'wrap', scoop: true, xC: .68, xD: .83 }],
  // ---- Stellantis
  dodge_neon_srt_4_2003: ['S', 4.37, 1.71, 1.39, 2.64, { lights: 'swept', tl: 'wrap', wing: 'big' }],
  dodge_charger_sxt_2011: ['S', 5.09, 1.90, 1.48, 3.05, { lights: 'slim', tl: 'bar', xA: .45, xC: .70, xD: .82, deck: .76, belt: .68 }],
  dodge_charger_scat_pack_2015: ['S', 5.10, 1.90, 1.48, 3.05, { lights: 'slim', tl: 'bar', xA: .45, xC: .70, xD: .82, deck: .76, belt: .68, wing: 'lip' }],
  dodge_charger_srt_hellcat_widebody_2020: ['S', 5.10, 2.03, 1.46, 3.05, { lights: 'slim', tl: 'bar', xA: .45, xC: .70, xD: .82, deck: .76, belt: .68, wing: 'lip', scoop: true, tr: .36 }],
  dodge_charger_srt_hellcat_redeye_2021: ['S', 5.28, 1.95, 1.48, 3.05, { lights: 'slim', tl: 'bar', xA: .45, xC: .70, xD: .82, deck: .76, belt: .68, wing: 'lip', scoop: true }],
  dodge_challenger_r_t_2015: ['M', 5.02, 1.92, 1.45, 2.95, { lights: 'round', tl: 'bar', xCowl: .34, xA: .49, xC: .70, xD: .84, hoodF: .60, scoop: true }],
  dodge_challenger_srt_hellcat_2015: ['M', 5.02, 1.92, 1.45, 2.95, { lights: 'round', tl: 'bar', xCowl: .34, xA: .49, xC: .70, xD: .84, hoodF: .60, scoop: true, wing: 'lip' }],
  dodge_challenger_srt_demon_2018: ['M', 5.02, 1.92, 1.45, 2.95, { lights: 'round', tl: 'bar', xCowl: .34, xA: .49, xC: .70, xD: .84, hoodF: .60, scoop: true, wing: 'lip' }],
  dodge_viper_acr_2016: ['R', 4.46, 1.94, 1.22, 2.51, { lights: 'slim', tl: 'round', wing: 'huge', xCowl: .36, xA: .50, xC: .66, xD: .92, hoodF: .5, hoodB: .62, deck: .64, scoop: true }],
  dodge_durango_srt_hellcat_2021: ['U', 5.10, 1.93, 1.80, 3.04, { lights: 'slim', tl: 'bar', rails: true, xA: .42, xC: .90, scoop: true }],
  chrysler_pt_cruiser_touring_2001: ['H', 4.29, 1.70, 1.60, 2.62, { lights: 'round', tl: 'rect', xA: .38, xC: .88, hoodF: .56, hoodB: .62, xCowl: .27, belt: .58 }],
  chrysler_300c_srt8_2012: ['S', 5.04, 1.90, 1.49, 3.05, { lights: 'slim', tl: 'bar', belt: .70, xA: .44, xC: .69, xD: .80, deck: .76 }],
  ram_1500_big_horn_5_7_2013: ['P', 5.82, 2.02, 1.92, 3.57, { lights: 'swept', tl: 'rect', bed: 1.7 }],
  ram_1500_trx_2021: ['P', 5.92, 2.17, 2.06, 3.57, { lights: 'led', tl: 'led', bed: 1.7, lift: 0.1, scoop: true }],
  jeep_wrangler_sport_2007: ['Q', 3.83, 1.88, 1.80, 2.42, { lights: 'round', tl: 'rect', doors: 2, xCowl: .28, xA: .31, xC: .94, rails: false, boxy: true, hoodF: .56, hoodB: .60 }],
  jeep_grand_cherokee_srt_2017: ['U', 4.88, 1.95, 1.80, 2.92, { lights: 'led', tl: 'led', rails: true, xA: .44, xC: .90, scoop: true }],
  jeep_grand_cherokee_trackhawk_2018: ['U', 4.88, 1.95, 1.80, 2.92, { lights: 'led', tl: 'led', rails: true, xA: .44, xC: .90, scoop: true }],
  // ---- EV
  tesla_model_3_performance_2024: ['F', 4.72, 1.85, 1.44, 2.88, { lights: 'led', tl: 'led', xA: .43, xC: .70, xD: .93, deck: .70, glassRoof: true, wing: 'lip' }],
  tesla_model_y_long_range_2020: ['U', 4.75, 1.92, 1.62, 2.89, { lights: 'led', tl: 'led', xA: .42, xC: .80, glassRoof: true }],
  tesla_model_s_plaid_2021: ['F', 4.98, 1.96, 1.45, 2.96, { lights: 'led', tl: 'led', xA: .44, xC: .72, xD: .95, glassRoof: true }],
  rivian_r1t_quad_motor_2023: ['P', 5.51, 2.07, 1.96, 3.45, { lights: 'pill', tl: 'led', bed: 1.45, lift: 0.06 }],
  lucid_air_sapphire_2024: ['F', 4.98, 1.94, 1.41, 2.96, { lights: 'led', tl: 'led', xA: .42, xC: .72, xD: .96, glassRoof: true }],
  // ---- BMW
  bmw_325i_e30_1987: ['S', 4.33, 1.65, 1.38, 2.57, { lights: 'rect', tl: 'rect', xA: .43, xC: .68, xD: .80, deck: .70, belt: .66 }],
  bmw_m3_e36_1995: ['C', 4.43, 1.70, 1.34, 2.71, { lights: 'round', tl: 'rect', xA: .46, xC: .68, xD: .80, belt: .65 }],
  bmw_m3_e46_2001: ['C', 4.49, 1.78, 1.37, 2.73, { lights: 'swept', tl: 'wrap', xC: .69, xD: .80, scoop: true }],
  bmw_328i_e90_2007: ['S', 4.52, 1.82, 1.42, 2.76, { lights: 'swept', tl: 'wrap', xC: .71, xD: .82 }],
  bmw_335i_e92_2007: ['C', 4.58, 1.82, 1.38, 2.76, { lights: 'swept', tl: 'wrap', xC: .68, xD: .81 }],
  bmw_m2_g87_2023: ['C', 4.58, 1.89, 1.41, 2.75, { lights: 'led', tl: 'led', xC: .69, xD: .83, wing: 'duck' }],
  bmw_m4_competition_2021: ['C', 4.79, 1.89, 1.39, 2.86, { lights: 'led', tl: 'led', xC: .69, xD: .83, wing: 'lip' }],
  bmw_m3_competition_xdrive_g80_2022: ['S', 4.79, 1.90, 1.43, 2.86, { lights: 'led', tl: 'led', xC: .71, xD: .84, wing: 'lip' }],
  bmw_m5_competition_f90_2019: ['S', 4.97, 1.90, 1.47, 2.98, { lights: 'led', tl: 'led', xC: .72, xD: .85, wing: 'lip' }],
  // ---- Mercedes
  mercedes_c300_4matic_2015: ['S', 4.69, 1.81, 1.44, 2.84, { lights: 'led', tl: 'led', xC: .71, xD: .83 }],
  mercedes_c63_amg_w204_2008: ['S', 4.73, 1.77, 1.44, 2.76, { lights: 'swept', tl: 'wrap', xC: .70, xD: .82, wing: 'lip' }],
  mercedes_sl55_amg_2003: ['R', 4.53, 1.81, 1.30, 2.57, { conv: true, lights: 'swept', tl: 'wrap', hoodF: .56, xCowl: .35, xA: .46, xC: .60, xD: .78 }],
  mercedes_e63_s_amg_4matic_2018: ['S', 4.99, 1.91, 1.45, 2.94, { lights: 'led', tl: 'led', xC: .72, xD: .85, wing: 'lip' }],
  mercedes_amg_g63_2019: ['Q', 4.87, 1.98, 1.97, 2.89, { lights: 'round', tl: 'rect', boxy: true, rails: true, xCowl: .30, xA: .385 }],
  mercedes_amg_gt_black_series_2021: ['R', 4.55, 2.01, 1.28, 2.63, { lights: 'slim', tl: 'led', wing: 'huge', xCowl: .37, xA: .52, xC: .66, xD: .92, hoodF: .46, hoodB: .60, deck: .64, scoop: true }],
  // ---- Audi / VW
  audi_a4_2_0t_quattro_2009: ['S', 4.70, 1.83, 1.43, 2.81, { lights: 'led', tl: 'wrap', xC: .71, xD: .82 }],
  audi_s4_b8_2010: ['S', 4.70, 1.83, 1.43, 2.81, { lights: 'led', tl: 'wrap', xC: .71, xD: .82 }],
  audi_tt_rs_2018: ['h', 4.19, 1.83, 1.34, 2.51, { lights: 'led', tl: 'led', wing: 'big', doors: 2, xA: .44, xC: .70, xD: .97 }],
  audi_rs3_2022: ['S', 4.54, 1.85, 1.41, 2.63, { lights: 'led', tl: 'led', xC: .72, xD: .86, wing: 'lip' }],
  audi_rs6_avant_performance_2024: ['W', 4.99, 1.95, 1.46, 2.93, { lights: 'led', tl: 'led', rails: true, wing: 'roof', xA: .43, xC: .90 }],
  audi_r8_v10_performance_2020: ['X', 4.43, 1.94, 1.24, 2.65, { lights: 'led', tl: 'led', gills: true, xA: .47, xC: .63, wing: 'lip' }],
  volkswagen_jetta_gls_2_0_2000: ['S', 4.38, 1.74, 1.45, 2.51, { lights: 'swept', tl: 'rect' }],
  volkswagen_golf_gti_mk7_2015: ['H', 4.26, 1.80, 1.46, 2.63, { lights: 'led', tl: 'led', wing: 'roof' }],
  volkswagen_golf_r_mk8_2022: ['H', 4.29, 1.79, 1.46, 2.58, { lights: 'led', tl: 'bar', wing: 'roof' }],
  volkswagen_jetta_gli_2019: ['S', 4.70, 1.80, 1.45, 2.69, { lights: 'led', tl: 'led', xC: .72, xD: .84 }],
  // ---- Porsche
  porsche_boxster_s_987_2005: ['X', 4.34, 1.80, 1.29, 2.41, { conv: true, lights: 'round', tl: 'round', xCowl: .34, xA: .45, xC: .60, xD: .78, hoodF: .50, hoodB: .60, deck: .62, gills: true }],
  porsche_911_carrera_996_1999: ['N', 4.43, 1.77, 1.30, 2.35, { lights: 'swept', tl: 'wrap' }],
  porsche_911_carrera_s_992_2020: ['N', 4.52, 1.85, 1.30, 2.45, { lights: 'round', tl: 'bar' }],
  porsche_911_turbo_s_992_2021: ['N', 4.54, 1.90, 1.30, 2.45, { lights: 'round', tl: 'bar', wing: 'big' }],
  porsche_911_gt3_rs_992_2023: ['N', 4.57, 1.90, 1.30, 2.45, { lights: 'round', tl: 'bar', wing: 'huge' }],
  porsche_718_cayman_gt4_2020: ['X', 4.45, 1.82, 1.27, 2.48, { lights: 'led', tl: 'bar', wing: 'big', xA: .46, xC: .66, xD: .92, gills: true }],
  porsche_cayenne_turbo_gt_2022: ['U', 4.93, 1.99, 1.65, 2.89, { lights: 'led', tl: 'bar', rails: false, xA: .43, xC: .82, wing: 'big' }],
  porsche_taycan_turbo_s_2020: ['F', 4.96, 1.97, 1.38, 2.90, { lights: 'led', tl: 'bar', xA: .44, xC: .72, xD: .95 }],
  // ---- other European
  volvo_240_dl_wagon_1985: ['W', 4.79, 1.71, 1.43, 2.65, { lights: 'rect', tl: 'rect', rails: true, boxy: true, xA: .41, hoodF: .56 }],
  volvo_v60_polestar_2017: ['W', 4.64, 1.86, 1.43, 2.78, { lights: 'led', tl: 'led', rails: true, xC: .86 }],
  mini_cooper_s_2011: ['H', 3.73, 1.68, 1.41, 2.47, { lights: 'round', tl: 'rect', doors: 2, xA: .39, xC: .86, hoodF: .56, hoodB: .62, scoop: true }],
  jaguar_f_type_r_awd_2020: ['R', 4.47, 1.92, 1.31, 2.62, { lights: 'slim', tl: 'slim', xCowl: .36, xA: .50, xC: .66, xD: .92, hoodF: .50, hoodB: .62, deck: .66, wing: 'lip' }],
  landrover_range_rover_sport_svr_2018: ['U', 4.88, 2.07, 1.80, 2.92, { lights: 'led', tl: 'led', rails: true, xA: .44, xC: .88, belt: .64 }],
  lotus_elise_2005: ['X', 3.79, 1.72, 1.12, 2.30, { conv: true, lights: 'round', tl: 'round', wing: 'lip', xCowl: .3, xA: .42, xC: .55, xD: .78, deck: .66, hoodF: .45 }],
  lotus_emira_v6_first_edition_2023: ['X', 4.41, 1.89, 1.22, 2.57, { lights: 'led', tl: 'led', wing: 'lip', gills: true }],
  astonmartin_vantage_2025: ['R', 4.49, 1.98, 1.27, 2.70, { lights: 'slim', tl: 'bar', xCowl: .36, xA: .52, xC: .68, xD: .93, hoodF: .5, hoodB: .62, deck: .66, wing: 'duck' }],
  astonmartin_dbs_superleggera_2019: ['R', 4.72, 1.97, 1.28, 2.80, { lights: 'slim', tl: 'bar', xCowl: .36, xA: .52, xC: .68, xD: .93, hoodF: .5, hoodB: .62, deck: .68, wing: 'duck' }],
  bentley_continental_gt_speed_2022: ['R', 4.85, 1.95, 1.40, 2.85, { lights: 'round', tl: 'round', xCowl: .34, xA: .50, xC: .70, xD: .92, hoodF: .58, hoodB: .70, deck: .78, belt: .70 }],
  rollsroyce_cullinan_2019: ['Q', 5.34, 2.00, 1.83, 3.29, { lights: 'led', tl: 'led', xA: .41, xC: .90, hoodF: .64 }],
  alfaromeo_giulia_quadrifoglio_2017: ['S', 4.64, 1.87, 1.43, 2.82, { lights: 'led', tl: 'led', xC: .72, xD: .85, wing: 'lip', scoop: true }],
  maserati_granturismo_s_2009: ['R', 4.88, 1.85, 1.35, 2.94, { lights: 'swept', tl: 'bar', xCowl: .35, xA: .51, xC: .69, xD: .92, hoodF: .52, hoodB: .64, deck: .70 }],
  maserati_mc20_2022: ['X', 4.67, 1.96, 1.22, 2.70, { lights: 'led', tl: 'led', gills: true }],
  // ---- Ferrari / Lamborghini / McLaren / hypercars
  ferrari_458_italia_2010: ['X', 4.53, 1.94, 1.21, 2.65, { lights: 'swept', tl: 'round', gills: true }],
  ferrari_f8_tributo_2020: ['X', 4.61, 1.98, 1.20, 2.65, { lights: 'slim', tl: 'round', gills: true, wing: 'lip' }],
  ferrari_296_gtb_2022: ['X', 4.57, 1.96, 1.19, 2.60, { lights: 'slim', tl: 'bar', gills: true }],
  ferrari_812_superfast_2018: ['R', 4.66, 1.97, 1.28, 2.72, { lights: 'slim', tl: 'round', xCowl: .37, xA: .52, xC: .67, xD: .94, hoodF: .46, hoodB: .60, deck: .64 }],
  ferrari_sf90_stradale_2020: ['X', 4.71, 1.97, 1.19, 2.65, { lights: 'slim', tl: 'bar', gills: true, wing: 'lip' }],
  lamborghini_huracan_evo_2020: ['X', 4.52, 1.93, 1.17, 2.62, { lights: 'slim', tl: 'hex', gills: true, wing: 'duck', xA: .5, xC: .62 }],
  lamborghini_urus_performante_2023: ['U', 5.14, 2.02, 1.64, 3.00, { lights: 'slim', tl: 'bar', xA: .45, xC: .84, wing: 'roof' }],
  lamborghini_aventador_svj_2019: ['X', 4.94, 2.03, 1.14, 2.70, { lights: 'slim', tl: 'hex', gills: true, wing: 'huge', xA: .5, xC: .62 }],
  lamborghini_revuelto_2024: ['X', 4.95, 2.03, 1.16, 2.78, { lights: 'slim', tl: 'hex', gills: true, wing: 'big', xA: .5, xC: .62 }],
  mclaren_720s_2018: ['X', 4.54, 1.93, 1.20, 2.67, { lights: 'slim', tl: 'slim', gills: true, xA: .46, xC: .62 }],
  mclaren_artura_2023: ['X', 4.53, 1.91, 1.19, 2.64, { lights: 'slim', tl: 'slim', gills: true, wing: 'duck' }],
  mclaren_765lt_2021: ['X', 4.60, 1.93, 1.19, 2.67, { lights: 'slim', tl: 'slim', gills: true, wing: 'big', xA: .46, xC: .62 }],
  mclaren_p1_2014: ['X', 4.59, 1.95, 1.19, 2.67, { lights: 'slim', tl: 'slim', gills: true, wing: 'huge', xA: .46, xC: .62 }],
  pagani_huayra_2012: ['X', 4.60, 2.04, 1.17, 2.80, { lights: 'slim', tl: 'quad', gills: true, wing: 'big' }],
  bugatti_veyron_16_4_2005: ['X', 4.46, 2.00, 1.19, 2.71, { lights: 'quad', tl: 'bar', gills: true, wing: 'big', xCowl: .31, xA: .46, xC: .66, xD: .93, deck: .66, hoodF: .52 }],
  bugatti_chiron_2017: ['X', 4.54, 2.04, 1.21, 2.71, { lights: 'quad', tl: 'bar', gills: true, wing: 'huge', xCowl: .31, xA: .46, xC: .66, xD: .93, deck: .66, hoodF: .52 }],
  koenigsegg_agera_rs_2015: ['X', 4.49, 2.05, 1.12, 2.66, { lights: 'slim', tl: 'slim', gills: true, wing: 'huge', xA: .48, xC: .62 }],
  koenigsegg_jesko_attack_2022: ['X', 4.60, 2.04, 1.21, 2.70, { lights: 'slim', tl: 'slim', gills: true, wing: 'huge', xA: .48, xC: .62 }],
};

// Silhouette tweaks that tell look-alike archetypes apart (all the mid-engine
// cars share one template, but a 720S dome, an Aventador wedge and a Huayra
// teardrop are different shapes).
const TWEAK = {
  ferrari_458_italia_2010: { xA: .46, xC: .62, xD: .87, deck: .62, tail: .56 },
  ferrari_f8_tributo_2020: { xA: .47, xC: .62, xD: .86, deck: .62, tail: .56, hoodF: .44 },
  ferrari_296_gtb_2022: { xA: .46, xC: .64, xD: .84, deck: .61, tail: .57, roofR: .93 },
  ferrari_sf90_stradale_2020: { xA: .46, xC: .62, xD: .85, deck: .62 },
  lamborghini_huracan_evo_2020: { xA: .49, xC: .6, xD: .9, deck: .6, tail: .52, hoodF: .42 },
  lamborghini_aventador_svj_2019: { xA: .5, xC: .58, xD: .93, deck: .6, tail: .5, hoodF: .4 },
  lamborghini_revuelto_2024: { xA: .49, xC: .6, xD: .92, deck: .6, tail: .52, hoodF: .41 },
  mclaren_720s_2018: { xA: .45, xC: .62, xD: .86, deck: .62, tail: .56, roofR: .94 },
  mclaren_artura_2023: { xA: .45, xC: .62, xD: .86, deck: .62, tail: .56, roofR: .94 },
  mclaren_765lt_2021: { xA: .45, xC: .62, xD: .86, deck: .62, tail: .56, roofR: .94 },
  mclaren_p1_2014: { xA: .44, xC: .64, xD: .88, deck: .6, tail: .54, roofR: .92 },
  pagani_huayra_2012: { xA: .43, xC: .67, xD: .93, deck: .6, tail: .54, roofR: .88 },
  koenigsegg_agera_rs_2015: { xA: .44, xC: .64, xD: .9, deck: .6, tail: .52, roofR: .9 },
  koenigsegg_jesko_attack_2022: { xA: .44, xC: .65, xD: .91, deck: .6, tail: .54, roofR: .9 },
  acura_nsx_type_s_2022: { xA: .45, xC: .64, xD: .9, deck: .62, tail: .56, roofR: .94 },
  audi_r8_v10_performance_2020: { xA: .46, xC: .63, xD: .88, deck: .64, tail: .58, roofR: .94 },
  chevrolet_corvette_stingray_c8_2020: { xA: .47, xC: .64, xD: .88, deck: .64, tail: .58, roofR: .93 },
  chevrolet_corvette_z06_c8_2023: { xA: .47, xC: .64, xD: .88, deck: .64, tail: .58, roofR: .93 },
  maserati_mc20_2022: { xA: .46, xC: .64, xD: .88, deck: .63, tail: .57, roofR: .94 },
  lotus_emira_v6_first_edition_2023: { xA: .45, xC: .64, xD: .9, deck: .63, tail: .58, roofR: .94 },
  porsche_718_cayman_gt4_2020: { xA: .45, xC: .66, xD: .93, deck: .6, tail: .56, roofR: .93 },
};

// Fallback by body class for anything new that gets added to the catalog.
const BODY_ARCH = { hatch: ['H', 4.2, 1.76, 1.45, 2.62], sedan: ['S', 4.7, 1.82, 1.45, 2.78], coupe: ['C', 4.45, 1.80, 1.34, 2.62], muscle: ['M', 4.9, 1.92, 1.40, 2.85],
  truck: ['P', 5.6, 2.0, 1.9, 3.5, { bed: 1.7 }], suv: ['U', 4.9, 1.95, 1.75, 2.9], exotic: ['R', 4.5, 1.9, 1.28, 2.65], super: ['X', 4.5, 1.97, 1.2, 2.65], wagon: ['W', 4.8, 1.84, 1.5, 2.8] };

const cache = new Map();

// -> { arch, L, W, H, WB, fo, ro, tr, doors, ...archetype fractions, ...options }
export function shapeOf(model) {
  const id = model.id;
  if (cache.has(id)) return cache.get(id);
  const row = T[id] || BODY_ARCH[model.body] || BODY_ARCH.sedan;
  const [arch, L, W, H, WB, opt = {}] = row;
  const a = ARCH[arch];
  const s = { ...a, ...opt, ...(TWEAK[id] || {}), arch, L, W, H, WB, id };
  s.fo = (opt.fo ?? a.fo) * L;
  s.ro = L - WB - s.fo;
  s.tr = opt.tr ?? a.tr;
  s.rim = Math.round(s.tr * 2 * 39.37 * 0.52) ;
  cache.set(id, s);
  return s;
}

export const hasShape = id => !!T[id];
export const SHAPE_IDS = Object.keys(T);

// Physical footprint used by collisions, shadows and flame positions.
export function dimsOf(model) {
  const s = shapeOf(model);
  return { L: s.L, W: s.W, H: s.H, WB: s.WB };
}
