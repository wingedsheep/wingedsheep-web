/**
 * Where the real sun is for the visitor, right now. The location is guessed from the browser's
 * time zone (no permission prompt), which is plenty to get sunrise and sunset within minutes.
 */

const RAD = Math.PI / 180;
const OBLIQUITY = 23.4397 * RAD;

/** Sun elevation (degrees above the horizon) and azimuth (radians from south, positive towards west). */
export function sunPosition(ms: number, lat: number, lon: number) {
  const d = ms / 864e5 - 10957.5; // days since J2000.0
  const m = RAD * (357.5291 + 0.98560028 * d); // mean anomaly
  const l = m + RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l));
  const h = RAD * (280.16 + 360.9856235 * d) + lon * RAD - ra; // hour angle
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, az };
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
