// How the GPS route looks (Settings → GPS route). The default is a thin,
// see-through blue so you can still read the lanes and see oncoming cars
// under it. 'red' is the old solid red ribbon, 'arrows' leaves only the
// flowing chevrons.
import { settings } from '../core/save.js';

const STYLES = {
  blue: { rgb: '56,196,255', line: 0.34, width: 1.5, chev: 0.5, casing: 0 },
  red: { rgb: '255,42,58', line: 0.82, width: 2.6, chev: 0.92, casing: 0.55 },
  arrows: { rgb: '56,196,255', line: 0, width: 1.5, chev: 0.6, casing: 0 },
};
export const GPS_STYLES = [['blue', 'Blue, see-through'], ['red', 'Red (solid)'], ['arrows', 'Arrows only']];
export const gpsStyle = () => STYLES[settings.gpsStyle] || STYLES.blue;
export const gpsRgba = a => `rgba(${gpsStyle().rgb},${a})`;
