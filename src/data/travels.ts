/**
 * The pins on the library globe: where Vincent has been, newest first. One pin per place;
 * `years` lists every visit (empty: before 2007, when nobody was counting). Coordinates are
 * approximate on purpose: a region, not a campsite.
 */
export interface Trip {
  place: string;
  country: string;
  years: number[];
  lat: number;
  lon: number;
  note: string;
}

const ROAD_TRIP = 'A road trip through California, Nevada, Utah and Arizona.';

export const travels: Trip[] = [
  { place: 'Peaks of the Balkans', country: 'Albania · Montenegro · Kosovo', years: [2026], lat: 42.5, lon: 19.9, note: 'A long loop on foot through the mountains where three borders meet.' },
  { place: 'Slovenia', country: 'Slovenia', years: [2026], lat: 46.35, lon: 13.8, note: 'The start of the Balkans trip.' },
  { place: 'Caiazzo', country: 'Italy', years: [2025], lat: 41.18, lon: 14.36, note: 'A hill town in Campania.' },
  { place: 'The moors', country: 'England', years: [2025], lat: 53.55, lon: -2.0, note: 'Moors near Manchester, and Oasis.' },
  { place: 'The Alps', country: 'Austria', years: [2025, 2024, 2016], lat: 47.2, lon: 11.6, note: 'Hiking, again and again. In 2025 with colleagues.' },
  { place: 'The Pyrenees and the surf', country: 'France', years: [2024], lat: 43.4, lon: -1.2, note: 'Surfing on the Atlantic coast, then up into the Pyrenees.' },
  { place: 'Karpathos', country: 'Greece', years: [2024], lat: 35.6, lon: 27.1, note: 'An island between Crete and Rhodes.' },
  { place: 'Wild camping', country: 'Switzerland', years: [2023], lat: 46.35, lon: 7.9, note: 'Hiking all day, and a tent on a mountain top at night.' },
  { place: 'The Dolomites', country: 'Italy', years: [2023], lat: 46.5, lon: 11.9, note: 'Via ferrata: steel cables, ladders and a lot of air under your feet.' },
  { place: 'Gavarnie', country: 'France', years: [2022], lat: 42.73, lon: -0.01, note: 'Hiking under the great cirque, and kayaking.' },
  { place: 'Dune du Pilat', country: 'France', years: [2022], lat: 44.59, lon: -1.21, note: 'The biggest sand dune in Europe, right by the ocean.' },
  { place: 'Denmark', country: 'Denmark', years: [2022], lat: 56.0, lon: 10.0, note: '' },
  { place: 'Kayaking', country: 'Czech Republic', years: [2021], lat: 48.8, lon: 14.3, note: 'Down the river by kayak, years after a first visit.' },
  { place: 'Bonaire', country: 'Caribbean Netherlands', years: [2021], lat: 12.15, lon: -68.27, note: 'A long way from the Alps.' },
  { place: 'Southern Switzerland', country: 'Switzerland', years: [2020], lat: 46.3, lon: 8.8, note: 'Hiking in the south, over towards Italy.' },
  { place: 'Lago d’Orta', country: 'Italy', years: [2020], lat: 45.8, lon: 8.4, note: 'A quiet lake in the north of Italy.' },
  { place: 'Ramsau am Dachstein', country: 'Austria', years: [2020], lat: 47.42, lon: 13.65, note: 'Via ferratas up the Dachstein.' },
  { place: 'The Meuse', country: 'France', years: [2020], lat: 49.8, lon: 4.75, note: 'Kayaking on the Meuse, in the north of France.' },
  { place: 'San Francisco and the coast', country: 'California', years: [2019], lat: 37.6, lon: -122.4, note: `${ROAD_TRIP} One of the favourites.` },
  { place: 'Los Angeles', country: 'California', years: [2019], lat: 34.05, lon: -118.24, note: ROAD_TRIP },
  { place: 'Las Vegas', country: 'Nevada', years: [2019], lat: 36.17, lon: -115.14, note: ROAD_TRIP },
  { place: 'Zion', country: 'Utah', years: [2019], lat: 37.3, lon: -113.0, note: ROAD_TRIP },
  { place: 'Moab', country: 'Utah', years: [2019], lat: 38.6, lon: -109.6, note: ROAD_TRIP },
  { place: 'Sedona', country: 'Arizona', years: [2019], lat: 34.87, lon: -111.76, note: `${ROAD_TRIP} One of the favourites.` },
  { place: 'Grenoble', country: 'France', years: [2019], lat: 45.19, lon: 5.72, note: 'Mountains on every side of the city.' },
  { place: 'New Zealand', country: 'New Zealand', years: [2018], lat: -43.5, lon: 171.0, note: 'In a camper van with friends, about as far from home as you can get.' },
  { place: 'Croatia', country: 'Croatia', years: [2018], lat: 43.5, lon: 16.4, note: '' },
  { place: 'Sardinia', country: 'Italy', years: [2017], lat: 40.1, lon: 9.0, note: '' },
  { place: 'Iceland', country: 'Iceland', years: [2017], lat: 64.9, lon: -19.0, note: '' },
  { place: 'Bali and Lombok', country: 'Indonesia', years: [2016], lat: -8.5, lon: 115.8, note: '' },
  { place: 'Tour du Mont Blanc', country: 'France · Italy · Switzerland', years: [2015], lat: 45.83, lon: 6.86, note: 'All the way round the mountain.' },
  { place: 'Barcelona', country: 'Spain', years: [2015], lat: 41.39, lon: 2.17, note: '' },
  { place: 'Samos', country: 'Greece', years: [2015], lat: 37.75, lon: 26.8, note: '' },
  { place: 'Cyprus', country: 'Cyprus', years: [2014], lat: 35.0, lon: 33.2, note: '' },
  { place: 'Turkey', country: 'Turkey', years: [2013], lat: 38.5, lon: 29.0, note: '' },
  { place: 'Lisbon', country: 'Portugal', years: [2013], lat: 38.72, lon: -9.14, note: '' },
  { place: 'Corfu', country: 'Greece', years: [2012], lat: 39.6, lon: 19.9, note: '' },
  { place: 'Costa Rica', country: 'Costa Rica', years: [2011], lat: 10.0, lon: -84.0, note: '' },
  { place: 'Mimizan', country: 'France', years: [2010], lat: 44.2, lon: -1.23, note: 'Surfing in the south of France.' },
  { place: 'Kos', country: 'Greece', years: [2009], lat: 36.85, lon: 27.1, note: '' },
  { place: 'La Fouly', country: 'Switzerland', years: [2008], lat: 46.08, lon: 7.1, note: '' },
  { place: 'Crete', country: 'Greece', years: [2007], lat: 35.24, lon: 24.8, note: '' },
  { place: 'Norway', country: 'Norway', years: [], lat: 61.0, lon: 8.0, note: '' },
  { place: 'Sweden', country: 'Sweden', years: [], lat: 60.0, lon: 15.0, note: '' },
  { place: 'Czech Republic', country: 'Czech Republic', years: [], lat: 50.0, lon: 15.5, note: '' },
];

/** "2025, 2024", or "before 2007" for the trips from before anyone was counting. */
export const yearsOf = (t: Trip) => (t.years.length ? t.years.join(', ') : 'before 2007');
