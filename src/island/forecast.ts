import { sunPosition } from './scene/sun';

/**
 * The visitor's current weather, from Open-Meteo (free, no key). We never prompt for location:
 * if the visitor has already let this site use geolocation we take their position, otherwise
 * the city their timezone is named after (Europe/Amsterdam → Amsterdam) stands in for it.
 * Results are cached for a while so reloads don't refetch. In the Low Countries, Buienradar's
 * rain radar has the last word on whether it's actually raining right now: a weather model can
 * be an hour out, the radar sees the shower coming over.
 */
export const WEATHER_KINDS = ['clear', 'partly', 'cloudy', 'windy', 'warm', 'hot', 'fog', 'drizzle', 'rain', 'showers', 'sleet', 'snow', 'hail', 'storm'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

export interface Forecast {
  kind: WeatherKind;
  intensity: number; // 0..1: drizzle → downpour, flurries → blizzard, a few clouds → overcast
  wind: number; // m/s
  gusts: number; // m/s, the strongest gusts around now
  direction: number; // degrees the wind comes from, as weather reports give it (270: a westerly)
  lying: number; // 0..1: how much snow is already on the ground
  temperature: number; // °C
  place: string;
  lat: number;
  lon: number;
  /** How heavy the cloud is, 0..1: a thin veil the sun still shines through … a dark, low lid. */
  thickness: number;
  /** Rain on the radar right now, mm/h, where there's a radar to ask (Buienradar). */
  radar?: number;
  /** Today and the next two days, for the board in the mountain hut. */
  days: Day[];
}

export interface Day {
  date: string; // YYYY-MM-DD, the visitor's own calendar day
  kind: WeatherKind;
  high: number; // °C
  low: number; // °C
  wind: number; // m/s, the day's strongest sustained wind
}

const CACHE_KEY = 'island-weather-7';
const CACHE_FOR = 20 * 60 * 1000;
const RADAR_KEY = 'island-radar-1';
const RADAR_FOR = 60 * 1000;

/** WMO weather interpretation codes, as Open-Meteo reports them. */
function interpret(code: number, cover?: number, thickness?: number): Pick<Forecast, 'kind' | 'intensity'> {
  // a sky with some cloud in it: how much, if we know, decides how many shadows drift over
  if ((code === 1 || code === 2) && typeof cover === 'number') return { kind: 'partly', intensity: cover / 100 };
  // overcast: a high, thin veil is a bright white sky, a low grey lid a dark one
  if (code === 3 && typeof thickness === 'number') return { kind: 'cloudy', intensity: 0.2 + thickness * 0.8 };
  const table: [number[], WeatherKind, number][] = [
    [[0], 'clear', 0],
    [[1], 'partly', 0.35],
    [[2], 'partly', 0.8],
    [[3], 'cloudy', 0.85],
    [[45, 48], 'fog', 1],
    [[51], 'drizzle', 0.4],
    [[53], 'drizzle', 0.7],
    [[55], 'drizzle', 1],
    [[56, 66], 'sleet', 0.5],
    [[57, 67], 'sleet', 0.9],
    [[61], 'rain', 0.4],
    [[63], 'rain', 0.7],
    [[65], 'rain', 1],
    [[71, 77, 85], 'snow', 0.4],
    [[73], 'snow', 0.7],
    [[75, 86], 'snow', 1],
    [[80], 'showers', 0.4],
    [[81], 'showers', 0.7],
    [[82], 'showers', 1],
    [[95], 'storm', 1],
    [[96, 99], 'hail', 1],
  ];
  const hit = table.find(([codes]) => codes.includes(code));
  return hit ? { kind: hit[1], intensity: hit[2] } : { kind: 'cloudy', intensity: 0.6 };
}

/** The weather now: the forecast (fetched every twenty minutes or so), checked against the radar. */
export async function fetchForecast(): Promise<Forecast | null> {
  const forecast = await fetchModel();
  return forecast && withRadar(forecast, await fetchRadar(forecast));
}

async function fetchModel(): Promise<Forecast | null> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const where = (await knownPosition()) ?? (await timezoneCity());
    if (!where) return null;
    const q = new URLSearchParams({
      latitude: where.lat.toFixed(2),
      longitude: where.lon.toFixed(2),
      current: 'weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,shortwave_radiation,'
        + 'temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,snow_depth',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max',
      forecast_days: '3',
      timezone: 'auto',
      wind_speed_unit: 'ms',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!res.ok) return null;
    const { current, daily } = await res.json();
    const thickness = heaviness(current, where);
    const forecast: Forecast = {
      ...interpret(current.weather_code, current.cloud_cover, thickness),
      wind: current.wind_speed_10m,
      gusts: current.wind_gusts_10m ?? current.wind_speed_10m,
      direction: current.wind_direction_10m ?? 250,
      lying: Math.min(1, (current.snow_depth ?? 0) / 0.08), // 8 cm covers everything
      temperature: current.temperature_2m,
      place: where.name,
      lat: where.lat,
      lon: where.lon,
      thickness,
      days: (daily?.time ?? []).map((date: string, i: number) => ({
        date,
        kind: interpret(daily.weather_code[i]).kind,
        high: daily.temperature_2m_max[i],
        low: daily.temperature_2m_min[i],
        wind: daily.wind_speed_10m_max[i],
      })),
    };
    writeCache(forecast);
    return forecast;
  } catch {
    return null;
  }
}

/**
 * How heavy the cloud is, 0..1. By day the best measure is how much sunlight gets through,
 * against what a clear sky would let through with the sun where it is; at night, or with the
 * sun too low to tell, the cloud's layers: low cloud is thick and grey, high cloud a thin veil.
 */
function heaviness(c: Record<string, number | undefined>, where: Where) {
  const low = c.cloud_cover_low ?? c.cloud_cover ?? 0;
  const mid = c.cloud_cover_mid ?? 0;
  const high = c.cloud_cover_high ?? 0;
  const layers = Math.min(1, (low + mid * 0.6 + high * 0.15) / 100);
  const alt = sunPosition(Date.now(), where.lat, where.lon).alt;
  const sun = Math.sin((alt * Math.PI) / 180);
  if (alt < 8 || typeof c.shortwave_radiation !== 'number') return layers;
  const clear = 1098 * sun * Math.exp(-0.057 / sun); // W/m² under a clear sky (Haurwitz)
  const through = c.shortwave_radiation / clear;
  const dim = Math.min(1, Math.max(0, (0.8 - through) / 0.6)); // 80% of a clear day's light: no gloom at all
  return dim * 0.7 + layers * 0.3;
}

/** Roughly the area Buienradar's radar covers well: the Netherlands, Belgium and their borders. */
const RADAR_AREA = { south: 49.4, north: 54.2, west: 2.4, east: 7.8 };

/** The rain on the radar now (and in five minutes, which is what's arriving), mm/h; null where there's no radar. */
async function fetchRadar(f: Forecast): Promise<number | null> {
  const a = RADAR_AREA;
  if (!(f.lat >= a.south && f.lat <= a.north && f.lon >= a.west && f.lon <= a.east)) return null;
  try {
    const { at, lat, lon, rain } = JSON.parse(localStorage.getItem(RADAR_KEY) ?? 'null') ?? {};
    if (at && Date.now() - at < RADAR_FOR && lat === f.lat && lon === f.lon) return rain;
  } catch {}
  try {
    const q = new URLSearchParams({ lat: f.lat.toFixed(2), lon: f.lon.toFixed(2) });
    const res = await fetch(`https://gpsgadget.buienradar.nl/data/raintext?${q}`);
    if (!res.ok) return null;
    // a line every five minutes for the next two hours: "077|14:25", the value on a log scale
    const lines = (await res.text()).trim().split(/\s+/).slice(0, 2);
    const rain = Math.max(0, ...lines.map((l) => {
      const v = Number(l.split('|')[0]);
      return v > 0 ? 10 ** ((v - 109) / 32) : 0;
    }));
    try {
      localStorage.setItem(RADAR_KEY, JSON.stringify({ at: Date.now(), lat: f.lat, lon: f.lon, rain }));
    } catch {}
    return rain;
  } catch {
    return null;
  }
}

const RAIN_KINDS: WeatherKind[] = ['rain', 'showers'];
const DRY_KINDS: WeatherKind[] = ['clear', 'partly', 'cloudy', 'windy', 'warm', 'hot', 'fog'];

/**
 * The forecast put right by the radar: rain the model expects that isn't falling becomes the grey
 * sky it falls from, and rain it missed comes down after all, as hard as the radar says. Drizzle is
 * left be (it's too fine for the radar to see much of), and so are snow, sleet, hail and storms.
 */
function withRadar(f: Forecast, rain: number | null): Forecast {
  if (rain === null) return f;
  const hard = Math.min(1, 0.3 + Math.log2(1 + rain) * 0.2); // 1 mm/h: 0.5; 10 mm/h: a downpour
  if (rain < 0.05 && RAIN_KINDS.includes(f.kind)) return { ...f, radar: rain, kind: 'cloudy', intensity: 0.5 + f.thickness * 0.5 };
  if (rain >= 0.1 && DRY_KINDS.includes(f.kind)) {
    const kind: WeatherKind = f.temperature <= 1 ? 'snow' : rain < 0.4 ? 'drizzle' : f.kind === 'clear' || f.kind === 'partly' ? 'showers' : 'rain';
    return { ...f, radar: rain, kind, intensity: hard };
  }
  if (rain >= 0.1 && RAIN_KINDS.includes(f.kind)) return { ...f, radar: rain, intensity: hard };
  return { ...f, radar: rain };
}

interface Where {
  lat: number;
  lon: number;
  name: string;
}

/** The visitor's position, but only if they've already allowed it: never a permission prompt. */
async function knownPosition(): Promise<Where | null> {
  try {
    const perm = await navigator.permissions.query({ name: 'geolocation' });
    if (perm.state !== 'granted') return null;
    const pos = await new Promise<GeolocationPosition>((ok, fail) =>
      navigator.geolocation.getCurrentPosition(ok, fail, { maximumAge: 30 * 60 * 1000, timeout: 5000 }),
    );
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'your area' };
  } catch {
    return null;
  }
}

async function timezoneCity(): Promise<Where | null> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!tz?.includes('/') || tz.startsWith('Etc/')) return null;
  const city = tz.split('/').pop()!.replace(/_/g, ' ');
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: city, count: '10', language: 'en' })}`);
  if (!res.ok) return null;
  const { results = [] } = await res.json();
  const hit = results.find((r: { timezone?: string }) => r.timezone === tz) ?? results[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name } : null;
}

function readCache(): Forecast | null {
  try {
    const { at, forecast } = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') ?? {};
    return at && Date.now() - at < CACHE_FOR ? forecast : null;
  } catch {
    return null;
  }
}

function writeCache(forecast: Forecast) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), forecast }));
  } catch {
    // private mode or storage blocked: we'll just fetch again next time
  }
}
