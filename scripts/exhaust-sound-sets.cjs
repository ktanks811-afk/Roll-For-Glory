// The cars and builds the exhaust/cam sound renders compare (stock vs cams vs exhausts)
const nova = 'chevrolet_nova_1972', scat = 'dodge_challenger_rt_scat_pack_widebody_2019';
module.exports = [
  { id: 'nova-stock', car: nova, label: 'Nova 350, stock cam, factory exhaust' },
  { id: 'nova-s1', car: nova, eb: { cam: 's1' }, label: 'Nova 350, Stage 1 cam' },
  { id: 'nova-s2', car: nova, eb: { cam: 's2', hdr: 'longtube', exh: 'perf' }, label: 'Nova 350, Stage 2 cam, long tubes, chambered mufflers' },
  { id: 'nova-chop', car: nova, eb: { cam: 'chop', hdr: 'longtube', exh: 'xpipe' }, label: 'Nova 350, chop cam, long tubes, X-pipe' },
  { id: 'nova-s3-straight', car: nova, eb: { cam: 's3', hdr: 'longtube', exh: 'straight' }, label: 'Nova 350, Stage 3 cam, long tubes, straight pipes' },
  { id: 'nova-race', car: nova, eb: { cam: 'race', hdr: 'longtube', exh: 'straight', springs: 'race' }, label: 'Nova 350, race cam, straight pipes' },
  { id: 'caprice', car: 'chevrolet_caprice_classic_box_chevy_1986', label: 'Caprice 305, stock' },
  { id: 'scat-stock', car: scat, label: 'Challenger 392 HEMI, stock valved exhaust' },
  { id: 'scat-cam-straight', car: scat, eb: { cam: 's2', hdr: 'longtube', exh: 'straight' }, label: 'Challenger 392, Stage 2 cam, long tubes, straight pipes' },
  { id: 'hellcat', car: 'dodge_charger_srt_hellcat_widebody_2020', label: 'Hellcat Widebody, stock' },
  { id: 'mustang', car: 'ford_mustang_gt_2019', label: 'Mustang GT Coyote, stock' },
  { id: 'mustang-x', car: 'ford_mustang_gt_2019', eb: { hdr: 'longtube', exh: 'xpipe', cam: 's1' }, label: 'Mustang GT, long tubes, X-pipe, Stage 1 cams' },
  { id: 'c7z06', car: 'chevrolet_corvette_z06_c7_2019', label: 'Corvette Z06 LT4, stock' },
  { id: 'm5', car: 'bmw_m5_g90_2025', label: 'BMW M5 G90 biturbo V8, stock' },
  { id: 'copperhead', car: 'dodge_copperhead_1997', label: 'Copperhead 2.7 V6, stock' },
  { id: 'stinger', car: 'kia_stinger_gt2_2022', label: 'Stinger 3.3TT V6, stock' },
  { id: 'hayabusa', car: 'suzuki_hayabusa_2025', label: 'Hayabusa 1340 inline four, stock' },
];
