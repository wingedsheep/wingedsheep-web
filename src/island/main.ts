import * as THREE from 'three';
import beats from '../data/beats.json';
import piano from '../data/piano.json';
import records from '../data/records.json';
import songs from '../data/songs.json';
import { type IslandContext, type PanelName, SECRETS, labelFor, placeFor } from './content';
import { type WeatherKind, fetchForecast } from './forecast';
import { bindHud, renderJournal } from './hud';
import { Journal } from './journal';
import { Library } from './library';
import { Hut } from './hut';
import { Companion, SHOWS, type Show, type Spot } from './scene/companion';
import { type Pet, PETS } from './scene/petting';
import { Vincent, type Whereabouts } from './scene/vincent';
import { Lighthouse } from './lighthouse';
import { CameraRig } from './scene/camera-rig';
import { Ambience } from './scene/ambience';
import { Mist } from './scene/mist';
import { Beacons } from './scene/beacons';
import { greeting, occasions } from './scene/calendar';
import { Fireworks } from './scene/fireworks';
import { createFoliage } from './scene/foliage';
import { createGrass, wind, windDir } from './scene/grass';
import { Icicles } from './scene/icicles';
import { Island } from './scene/island';
import type { Call } from './scene/fauna';
import { Life, type Rhythm } from './scene/life';
import { Picker } from './scene/picking';
import { PixelRenderer } from './scene/pixel-renderer';
import { dressIsland, season } from './scene/season';
import { Sky } from './scene/sky';
import { createWater } from './scene/water';
import { Weather } from './scene/weather';
import { Sound } from './sound';
import { River } from './river';
import { Trail } from './trail';
import { UI } from './ui';
import { Workshop } from './workshop';

/** Which place the camera visits when a panel opens. */
const PANEL_HOME: Partial<Record<PanelName | 'article', string>> = {
  library: 'library',
  article: 'library',
  campfire: 'campfire',
  lighthouse: 'lighthouse',
  hut: 'hut',
};

/**
 * CSS pixels per art pixel: bigger screens get chunkier pixels so detail stays readable (and a
 * TV isn't asked to draw four times the art pixels of a laptop).
 */
/** How loud the night crickets and the daytime birds get in each season, 0..1. */
const CRICKETS = { spring: 0.35, summer: 1, autumn: 0.55, winter: 0 };
const BIRDSONG = { spring: 1, summer: 0.75, autumn: 0.35, winter: 0.12 };
/** …and how much leaf there is on the trees for the wind to rustle. */
const LEAVES = { spring: 0.7, summer: 1, autumn: 0.8, winter: 0.1 };
const pixelSizeFor =(w: number, h: number) => (w < 700 ? 2 : Math.max(3, Math.floor(h / 400)));
/**
 * Device pixels per CSS pixel. The art is blown up nearest-neighbour, so past a laptop's worth of
 * device pixels (a 4K TV) a finer canvas shows nothing more; it only costs the GPU.
 */
const pixelRatioFor = (w: number, h: number) => {
  const dpr = Math.min(devicePixelRatio, 2);
  return w * h * dpr * dpr > 6.5e6 ? 1 : dpr;
};

export async function bootIsland(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatioFor(host.clientWidth, host.clientHeight));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(renderer.domElement);

  const island = await Island.load();
  const scene = new THREE.Scene();
  scene.add(island.root);

  const water = createWater(island.shore, island.info);
  scene.add(water.mesh);
  scene.add(createGrass(island.terrain));
  dressIsland(island); // after the grass, which reads the ground's own colours
  scene.add(createFoliage(island.canopies, island.root));

  const pixels = new PixelRenderer(renderer, pixelSizeFor(host.clientWidth, host.clientHeight));
  const sky = new Sky(scene, island, pixels, water.uniforms);
  const life = new Life(scene, island, sky);
  const sound = new Sound(songs, piano, records);
  life.beike.onBark = () => sound.bark();
  // animals nearer the middle of the view sound louder, and off to the side they're heard from
  // that side; the ones calling out unasked only carry from somewhere near what's on screen
  const right = new THREE.Vector3();
  const heard = (call: Call, at: THREE.Vector3, ambient = false, loud = 1) => {
    const off = at.distanceTo(rig.target) / rig.view;
    const volume = ambient ? THREE.MathUtils.clamp(1.1 - off * 1.4, 0, 0.8) : THREE.MathUtils.clamp(1.2 - off, 0.15, 1);
    if (ambient && (volume < 0.05 || !sound.outdoors)) return;
    right.setFromMatrixColumn(rig.camera.matrixWorld, 0);
    const pan = (at.clone().sub(rig.target).dot(right) / (rig.view * (host.clientWidth / host.clientHeight) * 0.5)) * 0.8;
    sound.call(call, volume * loud, pan);
    if (call === 'roar') weather.bolt(); // in a storm, lightning shows it for what it is
  };
  life.fauna.onCall = heard;
  // Beike's howl along with the siren carries: he means it to
  life.beike.onSound = (kind, at, loud) => heard(kind, at, kind !== 'aroo', loud);
  // the week (scene/week.ts): the church bell comes from the mainland, wherever you're looking
  life.week.onSound = (kind, at) => {
    if (kind === 'toll' || kind === 'toll-low') sound.call(kind, 0.9, -0.55);
    else if (at) heard(kind, at, true);
  };
  const journal = new Journal(Object.keys(SECRETS).length);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weather = new Weather(scene, reducedMotion);
  weather.onThunder = (distance) => sound.thunder(distance);
  const ambience = new Ambience(scene, island, water.uniforms, reducedMotion);
  const mist = new Mist(scene, reducedMotion);
  const beacons = new Beacons(scene, island, reducedMotion);
  const icicles = new Icicles(scene, island);
  // the special days (scene/calendar.ts): New Year's fireworks, and the sounds the day needs
  const fireworks = occasions.has('newyear') ? new Fireworks(scene, island, reducedMotion) : null;
  if (fireworks || occasions.has('steamboat')) sound.festive();
  if (fireworks) {
    fireworks.onSound = (kind, at, big) => {
      if (!sound.outdoors && kind !== 'burst') return;
      const off = at.distanceTo(rig.target);
      const volume = THREE.MathUtils.clamp(1.25 - off / 60, 0.12, 1) * (kind === 'burst' ? Math.min(1.2, 0.7 + big * 0.2) : 1);
      right.setFromMatrixColumn(rig.camera.matrixWorld, 0);
      const pan = THREE.MathUtils.clamp(at.clone().sub(rig.target).dot(right) / 60, -0.8, 0.8);
      sound.firework(kind, volume, pan, kind === 'launch' ? 0 : off / 170); // the bang comes a beat after the flash
    };
  }

  const [x0, y0, x1, y1] = island.info.extent;
  const bounds = new THREE.Box2(new THREE.Vector2(x0 + 8, -y1 + 6), new THREE.Vector2(x1 - 8, -y0 - 10));
  const rig = new CameraRig(renderer.domElement, bounds, {
    hover(ndc, client) {
      if (library.wanted) return library.hover(ndc, client);
      if (workshop.wanted) return workshop.hover(ndc, client);
      if (lighthouse.wanted) return lighthouse.hover(ndc, client);
      if (hut.wanted) return hut.hover(ndc, client);
      if (trail.wanted) return trail.hover(ndc, client);
      if (river.wanted) return river.hover();
      const hit = ndc && picker.pick(ndc);
      const place = hit ? placeFor(hit.id) : undefined;
      picker.highlight(place && hit ? (island.get(hit.id) ?? null) : null);
      renderer.domElement.style.cursor = place ? 'pointer' : '';
      ui.tooltip(place ? labelFor(place, ctx) : null, client.x, client.y);
    },
    click(ndc) {
      if (library.wanted) return library.click(ndc);
      if (workshop.wanted) return workshop.click(ndc);
      if (lighthouse.wanted) return lighthouse.click(ndc);
      if (hut.wanted) return hut.click(ndc);
      if (trail.wanted) return trail.click(ndc);
      if (river.wanted) return river.click();
      const hit = picker.pick(ndc) ?? pickMoon(ndc);
      const place = hit ? placeFor(hit.id) : undefined;
      if (!hit || !place) return;
      ui.tooltip(null);
      place.activate?.(ctx, hit.point);
      if (place.panel) ui.openPanel(place.panel);
    },
  }, () => pixels.height);
  const picker = new Picker(rig.camera);
  picker.add(...[...island.named.keys()].filter((id) => placeFor(id)).map((id) => island.get(id)!));
  if (life.beike.tennisBall) picker.add(life.beike.tennisBall);
  picker.add(...life.fauna.pickables);
  if (life.mischief.thief) picker.add(life.mischief.thief);
  picker.add(...life.revel.pickables);
  picker.add(...life.days.pickables);
  picker.add(...life.sightings.pickables);
  // the fair folk gone again: a word, if you were watching (or if you stared them away)
  life.week.onSiren = () => {
    if (!river.inside && !trail.inside) ui.toast('Twelve o’clock on the first Monday of the month: the siren test, drifting over from the mainland. Beike always joins in.');
  };
  life.revel.onEnd = (stared, watched) => {
    if (stared) ui.toast('You stared. The music stops, every head in the ring turns your way, and they’re gone. The fair folk don’t like to be stared at.');
    else if (watched) ui.toast('The music stops. They bow to one another, and they’re gone. It felt like a minute. It might have been a hundred years.');
  };

  /** The second moon only exists as a reflection, so it's found by where you click on the sea. */
  function pickMoon(ndc: THREE.Vector2) {
    if (sky.lamps < 0.6 || !water.uniforms.uSecondMoon.value) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, rig.camera);
    const p = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    const moon = water.uniforms.uMoon.value as THREE.Vector2;
    const near = Math.abs(p.x - (moon.x + 5)) < 1.5 && Math.abs(-p.z - (moon.y + 1.5)) < 7;
    return near ? { id: 'moons', point: p } : null;
  }
  water.uniforms.uSecondMoon.value = Math.random() < 0.5 ? 1 : 0;

  const ui = new UI({
    panelOpened(name, sub) {
      // a post opened from the workshop (or a diorama on the trail) is read right there
      const from = name === 'article' ? (workshop.wanted ? 'workshop' : trail.wanted ? 'trail' : null) : null;
      library.enter(name === 'library' || (name === 'article' && !from));
      workshop.enter(name === 'workshop' || from === 'workshop');
      lighthouse.enter(name === 'lighthouse');
      hut.enter(name === 'hut');
      if (name === 'trail') {
        trail.goTo(sub);
        history.replaceState(null, '', `/#trail/${trail.chapterId}`);
      }
      trail.enter(name === 'trail' || from === 'trail');
      river.enter(name === 'river');
      const pos = PANEL_HOME[name] && island.positionOf(PANEL_HOME[name]!);
      if (!pos) return;
      const wide = innerWidth > 900;
      rig.focus(pos, 20, wide ? Math.min(560, innerWidth * 0.45) / 2 : 0, reducedMotion);
    },
    closed: () => {
      library.enter(false);
      workshop.enter(false);
      lighthouse.enter(false);
      hut.enter(false);
      trail.enter(false);
      river.enter(false);
    },
  });

  const ctx: IslandContext = {
    island,
    rig,
    sky,
    weather,
    life,
    sound,
    journal,
    openPanel: (name) => ui.openPanel(name),
    openArticle: (slug) => void ui.openArticle(slug),
    close: () => ui.close(),
    showProject: (id) => workshop.select(id),
    showChapter(index) {
      trail.go(index);
      ui.openPanel('trail');
    },
    toast: (text) => ui.toast(text),
    showDrawing: (src, alt) => ui.showDrawing(src, alt),
    ask: (text, choices) => ui.ask(text, choices),
    discover(id) {
      if (!journal.discover(id)) return;
      sound.chime('found');
      ui.toast(`✦ Discovered: ${SECRETS[id].title} (${journal.count}/${journal.size})`, 'secret');
      renderJournal(ctx);
    },
  };
  const library = new Library(ctx, ui, pixels, host, reducedMotion);
  const workshop = new Workshop(ctx, ui, pixels, host, reducedMotion);
  const lighthouse = new Lighthouse(ctx, ui, pixels, host, reducedMotion);
  const hut = new Hut(ctx, ui, pixels, host, reducedMotion);
  const trail = new Trail(ctx, ui, pixels, host, reducedMotion);
  const river = new River(ctx, ui, pixels, host, reducedMotion, scene);
  const rooms = [library, workshop, lighthouse, hut, trail, river];

  // keyboard and screen-reader twins of the clickable places
  document.querySelectorAll<HTMLElement>('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => {
      const id = el.dataset.goto!;
      const place = placeFor(id);
      const pos = island.positionOf(id);
      if (place?.panel) ui.openPanel(place.panel);
      else if (pos) {
        ui.close();
        rig.focus(pos, 16, 0, reducedMotion);
        place?.activate?.(ctx, pos);
      }
    }),
  );

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setPixelRatio(pixelRatioFor(w, h));
    renderer.setSize(w, h);
    pixels.pixelSize = pixelSizeFor(w, h);
    pixels.setSize(w, h);
    rig.resize(w, h);
    library.resize();
    workshop.resize();
    lighthouse.resize();
    hut.resize();
    trail.resize();
    river.resize();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  bindHud(ctx);

  // the visitor's own weather, checked again every half hour. To preview: ?weather=rain (any
  // WEATHER_KINDS), optionally with &k=<0..1 intensity: ?weather=partly&k=0.2 is the odd cloud>,
  // &wind=<m/s>, &gusts=<m/s>, &dir=<degrees it comes from> and &temp=<°C>
  const params = new URLSearchParams(location.search);
  const preview = params.get('weather') as WeatherKind | null;
  let first = true;
  const live = async () => {
    ctx.forecast = await fetchForecast();
    const f = ctx.forecast;
    if (f && !preview) weather.set(f.kind, f.intensity, { wind: f.wind, gusts: f.gusts, direction: f.direction, lying: f.lying, temperature: f.temperature, instant: first });
    if (f && !preview && first) {
      life.shelter.settle(); // raining when you arrive: they're already in
      life.companion.settle();
      life.vincent.settle();
    }
    first = false;
  };
  if (preview) {
    const num = (k: string) => (params.has(k) ? Number(params.get(k)) : undefined);
    weather.set(preview, num('k') ?? 0.8, { wind: num('wind'), gusts: num('gusts'), direction: num('dir'), temperature: num('temp'), instant: true });
    life.shelter.settle();
    life.companion.settle();
    life.vincent.settle();
  }
  // and to see her somewhere in particular: ?companion=reading|fireside|workout|podcast|yoga|petting|baking|watching|bed, with
  // &show=murder|location|bnb|rail for what's on the telly, or &pet=cats|beike for who's getting a fuss
  const pet = params.get('pet') as Pet | null;
  const fuss = pet && PETS.includes(pet) ? pet : undefined;
  const spot = params.get('companion') as Spot | null;
  if (spot && Companion.SPOTS.includes(spot)) {
    const show = params.get('show') as Show | null;
    life.companion.put(spot, show && SHOWS.includes(show) ? show : undefined, fuss);
  }
  // or him: ?vincent=guitar|kayak|yoga|climb|podcast|petting|coding|asleep (and ?time=00:30 to see who's up)
  const where = params.get('vincent') as Whereabouts | null;
  if (where && Vincent.SPOTS.includes(where)) life.vincent.put(where, fuss);
  // a bit of mischief, sooner: ?beike=fire (he brings his ball over mid-song), ?mischief (the
  // gull goes for the wrap), ?bottle (one's already washed up), ?revel (the fair folk, at any hour)
  if (params.get('beike') === 'fire') life.beikeToTheFire();
  if (params.has('mischief')) life.mischief.soon();
  if (params.has('bottle')) life.bottle.ashore();
  if (params.has('revel')) life.revel.soon();
  // and the week's: ?siren (the siren test, now), ?post (the post boat, on a post day: ?holiday=postday)
  if (params.has('siren')) life.week.soon('siren');
  if (params.has('post')) life.week.soon('post');
  void live();
  setInterval(live, 30 * 60 * 1000);
  ui.route(true);
  library.enter(library.wanted, true); // landing on /blog/…: start inside, no iris
  workshop.enter(workshop.wanted, true);
  lighthouse.enter(lighthouse.wanted, true);
  hut.enter(hut.wanted, true);
  if (trail.wanted) trail.enter(true, true);
  if (river.wanted) river.enter(true, true);
  // the rooms load once the island is up and the browser has a moment
  (window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1500)))(() => {
    void library.load();
    void workshop.load();
    void lighthouse.load();
    void hut.load();
  });

  const campfire = island.positionOf('campfire')!;
  const summit = island.positionOf('summit');
  let lastChill = 0;
  let thaw = 0;
  const clock = new THREE.Clock();
  let notes = 0;
  let hushed = false; // said so, at the start of the fourth of May's silence
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    wind.value += dt * (1 + Math.min(weather.wind, 15) / 20); // the grass sways faster on a windy day
    water.uniforms.uTime.value += dt;
    rig.update(dt);
    weather.update(dt, rig.camera, rig.target, rig.view, sky.lamps);
    sky.gloom = weather.gloom;
    sky.haze = weather.now.fog * (1 - weather.windiness * 0.7);
    sky.update(dt);
    weather.shade(sky, scene, pixels, water.uniforms);
    mist.update(dt, sky, weather);
    mist.shade(sky, scene);
    ambience.update(dt, sky, weather, rig.target, rig.view);
    ambience.shade(sky);
    beacons.update(dt, sky.lamps);
    icicles.update(weather.heat.chill);
    if (fireworks) {
      fireworks.update(dt, sky.time, sky.lamps);
      sound.fireworks = Math.min(1, fireworks.level * (0.3 + sky.lamps * 0.7)); // the far-off barrage is a night thing
    }
    sound.rain = weather.now.rain + weather.now.hail * 0.2;
    sound.hail = weather.now.hail;
    sound.snow = weather.now.snow;
    sound.leaves = LEAVES[season.name];
    // up at the top, zoomed in: more wind, and the flag snapping
    sound.summit = summit ? THREE.MathUtils.clamp(1 - rig.target.distanceTo(summit) / 12, 0, 1) * THREE.MathUtils.clamp((30 - rig.view) / 12, 0, 1) : 0;
    // icicles melting (it's warming while they're still up there): they drip for a while
    const chill = weather.heat.chill;
    thaw = chill < lastChill - 1e-6 && chill > 0.3 ? 1 : Math.max(0, thaw - dt / 30);
    lastChill = chill;
    sound.thaw = thaw;
    sound.siren = life.week.siren;
    sound.wind = weather.gust;
    sound.sea = weather.swell;
    sound.cicadas = weather.heat.scorch * (1 - sky.lamps) * (1 - THREE.MathUtils.smoothstep(weather.gust, 0.3, 0.8)); // they stop in a gale
    const wet = Math.min(1, weather.now.rain + weather.now.snow + weather.now.hail);
    sound.crickets = CRICKETS[season.name] * THREE.MathUtils.smoothstep(sky.lamps, 0.35, 0.8) * (1 - wet) * (1 - weather.heat.chill);
    const hour = new Date(sky.time).getHours() + new Date(sky.time).getMinutes() / 60;
    const dawn = Math.max(0, 1 - Math.abs(hour - 6.5) / 2.5); // the chorus, strongest around half six
    sound.birdsong = BIRDSONG[season.name] * (1 - sky.lamps) * (0.45 + dawn * 0.55) * (1 - wet * 0.85) * (1 - Math.min(1, weather.gust) * 0.5);
    sound.fog = weather.now.fog;
    sound.night = sky.lamps;
    sound.telly = lighthouse.programme;
    sound.diorama = trail.showingId;
    sound.room = hut.inside ? 'hut' : workshop.inside ? 'workshop' : library.inside ? 'library' : lighthouse.inside ? lighthouse.storey : null;
    sound.typing = lighthouse.typing;
    life.wet = wet;
    life.chill = weather.heat.chill;
    life.drift.copy(windDir.value).multiplyScalar(Math.min(weather.wind, 12) / 6);
    life.wind = weather.wind;
    life.gust = weather.gust;
    life.heat = (weather.heat.warm + weather.heat.scorch) * 0.5 * (1 - sky.lamps * 0.5);
    life.playing = sound.playing !== null;
    life.rhythm = sound.playing ? ((beats as Record<string, Rhythm>)[sound.playing.id] ?? null) : null;
    life.songTime = sound.songTime;
    life.rain = weather.now.rain + weather.now.hail + weather.now.snow * 0.8; // nobody sits out in the snow either
    life.storm = weather.now.storm;
    if (!reducedMotion) life.update(dt);
    else life.shelter.update(dt, life.rain, true, life.heat);
    const indoorsNow = hut.inside ? 'hut' : lighthouse.inside ? 'lighthouse' : workshop.inside ? 'workshop' : null;
    life.companion.update(dt, {
      time: sky.time, night: sky.lamps, rain: life.rain, chill: life.chill, playing: life.playing, camera: rig.camera, room: indoorsNow,
      yoga: life.vincent.spot === 'yoga' && life.vincent.company ? life.vincent.pose : null,
    }, reducedMotion);
    life.vincent.update(dt, {
      time: sky.time, night: sky.lamps, rain: life.rain, storm: life.storm, wind: weather.wind, rough: weather.blizzard, camera: rig.camera,
      view: rig.view, room: indoorsNow, playing: life.playing,
    }, reducedMotion);
    // the special days' goings-on (days.ts), and the two minutes' silence on the fourth of May
    life.days.update(dt, sky.time, { night: sky.lamps, wet, rain: life.rain, wind: weather.wind }, reducedMotion);
    const silence = life.days.remembrance.silence;
    sound.silence = silence;
    sound.guitarist = life.vincent.atTheFire && silence === 0;
    if (silence > 0 && !hushed) {
      hushed = true;
      ctx.toast('Eight o’clock. Two minutes’ silence.');
    }
    const near = 1 - rig.target.distanceTo(campfire.clone().setY(1)) / 14;
    sound.update(near, rig.view, dt);
    if (sound.playing && (notes -= dt) < 0) {
      notes = 1.3;
      ctx.discover('guitar');
      life.burst('notes', island.positionOf('vincent')!.add(new THREE.Vector3(0, 1.4, 0)));
    }
    // one room at a time drives the iris; one that's being left finishes going first
    const leaving = rooms.find((r) => r.inside && !r.wanted);
    const room = leaving ?? rooms.find((r) => r.wanted) ?? library;
    room.update(dt, sky.lamps);
    if (leaving && !leaving.inside) rooms.find((r) => r.wanted)?.enter(true, true); // straight through, no island between
    const inside = rooms.find((r) => r.inside);
    if (inside) inside.render();
    else pixels.render(scene, rig.camera, rig.subTexel);
  });

  host.classList.add('ready');
  greet();
  sayTheDay(ctx);
  missYou();
}

/** On a special day, a word about it when you arrive: once that day, not on every visit. */
function sayTheDay(ctx: IslandContext) {
  const line = greeting();
  if (!line) return;
  const key = `said:${new Date().toDateString()}`;
  try {
    if (localStorage.getItem('island:day') === key) return;
    localStorage.setItem('island:day', key);
  } catch {}
  setTimeout(() => ctx.toast(line), 2500);
}

/** While you're in another tab, the island's tab says what you're missing. */
function missYou() {
  const lines = [
    'George has taken your seat',
    'Charlie heard a tap',
    'Your coffee’s getting cold',
    'Beike is still holding the ball',
    'Back in five minutes?',
    'The sheep noticed you left',
  ];
  let away: string | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      away = document.title;
      document.title = `${lines[Math.floor(Math.random() * lines.length)]} · wingedsheep`;
    } else if (away !== null) {
      document.title = away;
      away = null;
    }
  });
}

function greet() {
  console.log(
    `%c
        __  __
      .(  )(  ).
     (  wingedsheep )    Hi, fellow explorer.
      '(__)(__)'--.      Some things on this island only appear at night.
        ||    ||   \\     Others need a secret code.
`,
    'color:#e8b24a;font-family:monospace',
  );
}
