/**
 * The visitor's current weather, from Open-Meteo (free, no key). We never prompt for location:
 * if the visitor has already let this site use geolocation we take their position, otherwise
 * the city their timezone is named after (Europe/Amsterdam → Amsterdam) stands in for it.
 * Results are cached for a while so reloads don't refetch.
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
}

const CACHE_KEY = 'island-weather-5';
const CACHE_FOR = 20 * 60 * 1000;

/** WMO weather interpretation codes, as Open-Meteo reports them. */
function interpret(code: number, cover?: number): Pick<Forecast, 'kind' | 'intensity'> {
  // a sky with some cloud in it: how much, if we know, decides how many shadows drift over
  if ((code === 1 || code === 2) && typeof cover === 'number') return { kind: 'partly', intensity: cover / 100 };
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

export async function fetchForecast(): Promise<Forecast | null> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const where = (await knownPosition()) ?? (await timezoneCity());
    if (!where) return null;
    const q = new URLSearchParams({
      latitude: where.lat.toFixed(2),
      longitude: where.lon.toFixed(2),
      current: 'weather_code,cloud_cover,temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,snow_depth',
      wind_speed_unit: 'ms',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!res.ok) return null;
    const { current } = await res.json();
    const forecast: Forecast = {
      ...interpret(current.weather_code, current.cloud_cover),
      wind: current.wind_speed_10m,
      gusts: current.wind_gusts_10m ?? current.wind_speed_10m,
      direction: current.wind_direction_10m ?? 250,
      lying: Math.min(1, (current.snow_depth ?? 0) / 0.08), // 8 cm covers everything
      temperature: current.temperature_2m,
      place: where.name,
    };
    writeCache(forecast);
    return forecast;
  } catch {
    return null;
  }
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
