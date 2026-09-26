/**
 * Where the real sun (and moon) is for the visitor, right now. The location is guessed from the browser's
 * time zone (no permission prompt), which is plenty to get sunrise and sunset within minutes.
 */

const RAD = Math.PI / 180;
const OBLIQUITY = 23.4397 * RAD;

/** Where the sun is on the sky (right ascension, declination, radians) `d` days after J2000.0. */
function sunCoords(d: number) {
  const m = RAD * (357.5291 + 0.98560028 * d); // mean anomaly
  const l = m + RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + RAD * 102.9372 + Math.PI;
  return { dec: Math.asin(Math.sin(OBLIQUITY) * Math.sin(l)), ra: Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l)) };
}

/** Elevation (degrees) and azimuth (radians from south, positive towards west) of a body at (ra, dec). */
function horizon(d: number, ra: number, dec: number, lat: number, lon: number) {
  const h = RAD * (280.16 + 360.9856235 * d) + lon * RAD - ra; // hour angle
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, az };
}

/** Sun elevation (degrees above the horizon) and azimuth (radians from south, positive towards west). */
export function sunPosition(ms: number, lat: number, lon: number) {
  const d = ms / 864e5 - 10957.5; // days since J2000.0
  const { ra, dec } = sunCoords(d);
  return horizon(d, ra, dec, lat, lon);
}

/**
 * The moon (a short ephemeris, good to a degree or so): its elevation (degrees), azimuth, how much
 * of it is lit (0 new … 1 full) and the phase angle (degrees, 0 at full).
 */
export function moonPosition(ms: number, lat: number, lon: number) {
  const d = ms / 864e5 - 10957.5;
  const L = RAD * (218.316 + 13.176396 * d); // mean longitude
  const M = RAD * (134.963 + 13.064993 * d); // mean anomaly
  const F = RAD * (93.272 + 13.22935 * d); // mean distance from its node
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const dist = 385001 - 20905 * Math.cos(M); // km
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
  // the angle sun–earth–moon, and from it the angle sun–moon–earth: the phase
  const sun = sunCoords(d);
  const elong = Math.acos(Math.sin(sun.dec) * Math.sin(dec) + Math.cos(sun.dec) * Math.cos(dec) * Math.cos(sun.ra - ra));
  const phase = Math.atan2(149598000 * Math.sin(elong), dist - 149598000 * Math.cos(elong));
  return { ...horizon(d, ra, dec, lat, lon), lit: (1 + Math.cos(phase)) / 2, phase: phase / RAD };
}

/**
 * The moonlight on the ground (lux) with the moon at `alt` degrees and `phase` degrees from full:
 * ~0.27 from a full moon overhead, a tenth of that at a half moon (the full moon is brighter than
 * its area: the opposition surge), less again low down through more air, none once it's set.
 */
export function moonLux(alt: number, phase: number) {
  if (alt <= 0) return 0;
  const a = Math.abs(phase);
  const bright = 10 ** (-0.4 * (0.026 * a + 4e-9 * a ** 4)); // against full
  const s = Math.sin(alt * RAD);
  const air = 1 / (s + 0.025 * Math.exp(-11 * s)); // airmass
  return 0.32 * bright * s * 10 ** (-0.4 * 0.2 * air);
}

/**
 * Roughly how much light there is on the ground (log10 lux) with the sun at `alt` degrees, under
 * a clear sky. Measured anchors: ~500 lux at sunset, ~3.4 at the end of civil twilight (−6°),
 * ~0.008 at the end of nautical (−12°), starlight (~0.001) by −18°; 10,000 or so with the sun 10°
 * up. In between it falls off exponentially (a straight line in log lux, about a magnitude a
 * degree in twilight), so straight lines between the anchors.
 */
const LUX: [number, number][] = [[-18, -3], [-12, -2.1], [-6, 0.53], [0, 2.7], [10, 4], [30, 4.8]];

export function logLux(alt: number) {
  if (alt <= LUX[0][0]) return LUX[0][1];
  for (let i = 1; i < LUX.length; i++) {
    const [a1, l1] = LUX[i];
    if (alt > a1) continue;
    const [a0, l0] = LUX[i - 1];
    return l0 + ((alt - a0) / (a1 - a0)) * (l1 - l0);
  }
  return LUX[LUX.length - 1][1];
}

/**
 * How dark it looks out of doors, 0 (day) … 1 (night), to eyes that have had time to adjust: we
 * see brightness about logarithmically, so it goes by log lux, from a clear sunset (~400 lux, still
 * plainly light) down to ~0.005 (well into nautical dusk, only shapes left). `overcast` is how
 * many factors of ten the cloud takes off (a heavy overcast about one): dusk comes on earlier
 * under it. `moon` is the moonlight (lux, moonLux): a full moon high up leaves a night you can
 * see the banks by (~0.15 lux, darkness 0.7), a moonless one is as dark as it gets.
 */
export function darkness(alt: number, overcast = 0, moon = 0) {
  const lux = Math.log10(10 ** logLux(alt) + moon) - overcast;
  return Math.min(1, Math.max(0, (2.6 - lux) / 4.9));
}

// a representative spot for common time zones: [latitude, longitude]
const ZONES: Record<string, [number, number]> = {
  'Europe/Amsterdam': [52.37, 4.9], 'Europe/Brussels': [50.85, 4.35], 'Europe/London': [51.5, -0.13],
  'Europe/Dublin': [53.35, -6.26], 'Europe/Paris': [48.86, 2.35], 'Europe/Berlin': [52.52, 13.4],
  'Europe/Madrid': [40.42, -3.7], 'Europe/Lisbon': [38.72, -9.14], 'Europe/Rome': [41.9, 12.5],
  'Europe/Zurich': [47.37, 8.54], 'Europe/Vienna': [48.21, 16.37], 'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Stockholm': [59.33, 18.07], 'Europe/Oslo': [59.91, 10.75], 'Europe/Helsinki': [60.17, 24.94],
  'Europe/Warsaw': [52.23, 21.01], 'Europe/Prague': [50.08, 14.44], 'Europe/Athens': [37.98, 23.73],
  'Europe/Istanbul': [41.01, 28.98], 'Europe/Moscow': [55.76, 37.62], 'Europe/Kyiv': [50.45, 30.52],
  'America/New_York': [40.71, -74.01], 'America/Toronto': [43.65, -79.38], 'America/Chicago': [41.88, -87.63],
  'America/Denver': [39.74, -104.99], 'America/Phoenix': [33.45, -112.07], 'America/Los_Angeles': [34.05, -118.24],
  'America/Vancouver': [49.28, -123.12], 'America/Anchorage': [61.22, -149.9], 'America/Mexico_City': [19.43, -99.13],
  'America/Bogota': [4.71, -74.07], 'America/Lima': [-12.05, -77.04], 'America/Santiago': [-33.45, -70.67],
  'America/Sao_Paulo': [-23.55, -46.63], 'America/Argentina/Buenos_Aires': [-34.6, -58.38], 'Pacific/Honolulu': [21.31, -157.86],
  'Asia/Tokyo': [35.68, 139.69], 'Asia/Seoul': [37.57, 126.98], 'Asia/Shanghai': [31.23, 121.47],
  'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Singapore': [1.35, 103.82], 'Asia/Bangkok': [13.76, 100.5],
  'Asia/Jakarta': [-6.2, 106.85], 'Asia/Kolkata': [19.08, 72.88], 'Asia/Dubai': [25.2, 55.27],
  'Asia/Jerusalem': [31.77, 35.21], 'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38],
  'Africa/Nairobi': [-1.29, 36.82], 'Africa/Johannesburg': [-26.2, 28.05], 'Australia/Sydney': [-33.87, 151.21],
  'Australia/Melbourne': [-37.81, 144.96], 'Australia/Brisbane': [-27.47, 153.03], 'Australia/Perth': [-31.95, 115.86],
  'Pacific/Auckland': [-36.85, 174.76],
};

// for zones not listed: a typical latitude per region, longitude from the standard UTC offset
const REGIONS: Record<string, number> = {
  Europe: 50, America: 35, Asia: 30, Africa: 5, Australia: -30, Pacific: -15, Atlantic: 35, Indian: -10, Antarctica: -75,
};

export function visitorLocation(): { lat: number; lon: number } {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {}
  const known = ZONES[zone];
  if (known) return { lat: known[0], lon: known[1] };
  const region = REGIONS[zone.split('/')[0]];
  if (region === undefined) return { lat: ZONES['Europe/Amsterdam'][0], lon: ZONES['Europe/Amsterdam'][1] };
  const y = new Date().getFullYear();
  const standardOffset = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset()); // minutes west of UTC
  return { lat: region, lon: (-standardOffset / 60) * 15 };
}
