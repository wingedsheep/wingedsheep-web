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
import { Vincent, type Whereabouts } from './scene/vincent';
import { Lighthouse } from './lighthouse';
import { CameraRig } from './scene/camera-rig';
import { Ambience } from './scene/ambience';
import { Mist } from './scene/mist';
import { Beacons } from './scene/beacons';
import { createFoliage } from './scene/foliage';
import { createGrass, wind, windDir } from './scene/grass';
import { Icicles } from './scene/icicles';
import { Island } from './scene/island';
import { Life, type Rhythm } from './scene/life';
import { Picker } from './scene/picking';
import { PixelRenderer } from './scene/pixel-renderer';
import { dressIsland } from './scene/season';
import { Sky } from './scene/sky';
import { createWater } from './scene/water';
import { Weather } from './scene/weather';
import { Sound } from './sound';
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

/** CSS pixels per art pixel: bigger screens get chunkier pixels so detail stays readable. */
const pixelSizeFor = (w: number) => (w < 700 ? 2 : 3);

export async function bootIsland(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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

  const pixels = new PixelRenderer(renderer, pixelSizeFor(host.clientWidth));
  const sky = new Sky(scene, island, pixels, water.uniforms);
  const life = new Life(scene, island, sky);
  const sound = new Sound(songs, piano, records);
  life.beike.onBark = () => sound.bark();
  // animals nearer the middle of the view sound louder
  life.fauna.onCall = (call, at) => {
    sound.call(call, THREE.MathUtils.clamp(1.2 - at.distanceTo(rig.target) / rig.view, 0.15, 1));
    if (call === 'roar') weather.bolt(); // in a storm, lightning shows it for what it is
  };
  const journal = new Journal(Object.keys(SECRETS).length);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weather = new Weather(scene, reducedMotion);
  weather.onThunder = (distance) => sound.thunder(distance);
  const ambience = new Ambience(scene, island, water.uniforms, reducedMotion);
  const mist = new Mist(scene, reducedMotion);
  const beacons = new Beacons(scene, island, reducedMotion);
  const icicles = new Icicles(scene, island);

  const [x0, y0, x1, y1] = island.info.extent;
  const bounds = new THREE.Box2(new THREE.Vector2(x0 + 8, -y1 + 6), new THREE.Vector2(x1 - 8, -y0 - 10));
  const rig = new CameraRig(renderer.domElement, bounds, {
    hover(ndc, client) {
      if (library.wanted) return library.hover(ndc, client);
      if (workshop.wanted) return workshop.hover(ndc, client);
      if (lighthouse.wanted) return lighthouse.hover(ndc, client);
      if (hut.wanted) return hut.hover(ndc, client);
      if (trail.wanted) return trail.hover(ndc, client);
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
      ui.toast(`✦ Discovered: ${SECRETS[id].title} (${journal.count}/${journal.size})`, 'secret');
      renderJournal(ctx);
    },
  };
  const library = new Library(ctx, ui, pixels, host, reducedMotion);
  const workshop = new Workshop(ctx, ui, pixels, host, reducedMotion);
  const lighthouse = new Lighthouse(ctx, ui, pixels, host, reducedMotion);
  const hut = new Hut(ctx, ui, pixels, host, reducedMotion);
  const trail = new Trail(ctx, ui, pixels, host, reducedMotion);
  const rooms = [library, workshop, lighthouse, hut, trail];

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
    renderer.setSize(w, h);
    pixels.pixelSize = pixelSizeFor(w);
    pixels.setSize(w, h);
    rig.resize(w, h);
    library.resize();
    workshop.resize();
    lighthouse.resize();
    hut.resize();
    trail.resize();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  bindHud(ctx);

  // the visitor's own weather, checked again every half hour. To preview: ?weather=rain (any
  // WEATHER_KINDS), optionally with &wind=<m/s>, &gusts=<m/s>, &dir=<degrees it comes from>
  // and &temp=<°C>
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
    weather.set(preview, 0.8, { wind: num('wind'), gusts: num('gusts'), direction: num('dir'), temperature: num('temp'), instant: true });
    life.shelter.settle();
    life.companion.settle();
    life.vincent.settle();
  }
  // and to see her somewhere in particular: ?companion=reading|fireside|workout|podcast|yoga|baking|watching|bed, with
  // &show=murder|location|bnb|rail for what's on the telly
  const spot = params.get('companion') as Spot | null;
  if (spot && Companion.SPOTS.includes(spot)) {
    const show = params.get('show') as Show | null;
    life.companion.put(spot, show && SHOWS.includes(show) ? show : undefined);
  }
  // or him: ?vincent=guitar|kayak|yoga|climb|podcast|coding|asleep (and ?time=00:30 to see who's up)
  const where = params.get('vincent') as Whereabouts | null;
  if (where && Vincent.SPOTS.includes(where)) life.vincent.put(where);
  void live();
  setInterval(live, 30 * 60 * 1000);
  ui.route(true);
  library.enter(library.wanted, true); // landing on /blog/…: start inside, no iris
  workshop.enter(workshop.wanted, true);
  lighthouse.enter(lighthouse.wanted, true);
  hut.enter(hut.wanted, true);
  if (trail.wanted) trail.enter(true, true);
  // the rooms load once the island is up and the browser has a moment
  (window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1500)))(() => {
    void library.load();
    void workshop.load();
    void lighthouse.load();
    void hut.load();
  });

  const campfire = island.positionOf('campfire')!;
  const clock = new THREE.Clock();
  let notes = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    wind.value += dt * (1 + Math.min(weather.wind, 15) / 20); // the grass sways faster on a windy day
    water.uniforms.uTime.value += dt;
    rig.update(dt);
    weather.update(dt, rig.camera, rig.target, rig.view, sky.lamps);
    sky.update(dt);
    weather.shade(sky, scene, pixels, water.uniforms);
    mist.update(dt, sky, weather);
    mist.shade(sky, scene);
    ambience.update(dt, sky, weather, rig.target, rig.view);
    ambience.shade(sky);
    beacons.update(dt, sky.lamps);
    icicles.update(weather.heat.chill);
    sound.rain = weather.now.rain + weather.now.hail * 0.5;
    sound.wind = weather.gust;
    sound.sea = weather.swell;
    sound.cicadas = weather.heat.scorch * (1 - sky.lamps);
    life.wet = Math.min(1, weather.now.rain + weather.now.snow + weather.now.hail);
    life.chill = weather.heat.chill;
    life.drift.copy(windDir.value).multiplyScalar(Math.min(weather.wind, 12) / 6);
    life.playing = sound.playing !== null;
    life.rhythm = sound.playing ? ((beats as Record<string, Rhythm>)[sound.playing.id] ?? null) : null;
    life.songTime = sound.songTime;
    life.rain = weather.now.rain + weather.now.hail;
    life.storm = weather.now.storm;
    if (!reducedMotion) life.update(dt);
    else life.shelter.update(dt, life.rain, true);
    const indoorsNow = hut.inside ? 'hut' : lighthouse.inside ? 'lighthouse' : null;
    life.companion.update(dt, {
      time: sky.time, night: sky.lamps, rain: life.rain, chill: life.chill, playing: life.playing, camera: rig.camera, room: indoorsNow,
      yoga: life.vincent.spot === 'yoga' && life.vincent.company ? life.vincent.pose : null,
    }, reducedMotion);
    life.vincent.update(dt, {
      time: sky.time, night: sky.lamps, rain: life.rain, storm: life.storm, wind: weather.wind, camera: rig.camera,
      view: rig.view, room: indoorsNow, playing: life.playing,
    }, reducedMotion);
    sound.guitarist = life.vincent.atTheFire;
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
  missYou();
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
