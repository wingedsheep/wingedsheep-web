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
import { Lighthouse } from './lighthouse';
import { CameraRig } from './scene/camera-rig';
import { createFoliage } from './scene/foliage';
import { createGrass, wind } from './scene/grass';
import { Island } from './scene/island';
import { Life, type Rhythm } from './scene/life';
import { Picker } from './scene/picking';
import { PixelRenderer } from './scene/pixel-renderer';
import { Sky } from './scene/sky';
import { createWater } from './scene/water';
import { Weather } from './scene/weather';
import { Sound } from './sound';
import { UI } from './ui';
import { Workshop } from './workshop';

/** Which place the camera visits when a panel opens. */
const PANEL_HOME: Partial<Record<PanelName | 'article', string>> = {
  library: 'library',
  article: 'library',
  campfire: 'campfire',
  trail: 'cairn_3',
  lighthouse: 'lighthouse',
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
  scene.add(createFoliage(island.canopies, island.root));

  const pixels = new PixelRenderer(renderer, pixelSizeFor(host.clientWidth));
  const sky = new Sky(scene, island, pixels, water.uniforms);
  const life = new Life(scene, island, sky);
  const sound = new Sound(songs, piano, records);
  life.beike.onBark = () => sound.bark();
  const journal = new Journal(Object.keys(SECRETS).length);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weather = new Weather(scene, reducedMotion);
  weather.onThunder = (distance) => sound.thunder(distance);

  const [x0, y0, x1, y1] = island.info.extent;
  const bounds = new THREE.Box2(new THREE.Vector2(x0 + 8, -y1 + 6), new THREE.Vector2(x1 - 8, -y0 - 10));
  const rig = new CameraRig(renderer.domElement, bounds, {
    hover(ndc, client) {
      if (library.wanted) return library.hover(ndc, client);
      if (workshop.wanted) return workshop.hover(ndc, client);
      if (lighthouse.wanted) return lighthouse.hover(ndc, client);
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
    panelOpened(name) {
      // a post opened from the workshop is read in the workshop
      const reading = name === 'article' && workshop.wanted;
      library.enter(name === 'library' || (name === 'article' && !reading));
      workshop.enter(name === 'workshop' || reading);
      lighthouse.enter(name === 'lighthouse');
      const pos = PANEL_HOME[name] && island.positionOf(PANEL_HOME[name]!);
      if (!pos) return;
      const wide = innerWidth > 900;
      rig.focus(pos, 20, wide ? Math.min(560, innerWidth * 0.45) / 2 : 0, reducedMotion);
    },
    closed: () => {
      library.enter(false);
      workshop.enter(false);
      lighthouse.enter(false);
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
  const rooms = [library, workshop, lighthouse];

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
  }
  new ResizeObserver(resize).observe(host);
  resize();

  bindHud(ctx);

  // the visitor's own weather, checked again every half hour. To preview: ?weather=rain (any
  // WEATHER_KINDS), optionally with &wind=<m/s> and &temp=<°C>
  const params = new URLSearchParams(location.search);
  const preview = params.get('weather') as WeatherKind | null;
  let first = true;
  const live = async () => {
    ctx.forecast = await fetchForecast();
    const f = ctx.forecast;
    if (f && !preview) weather.set(f.kind, f.intensity, { wind: f.wind, lying: f.lying, temperature: f.temperature, instant: first });
    first = false;
  };
  if (preview) {
    const num = (k: string) => (params.has(k) ? Number(params.get(k)) : undefined);
    weather.set(preview, 0.8, { wind: num('wind'), temperature: num('temp') });
  }
  void live();
  setInterval(live, 30 * 60 * 1000);
  ui.route(true);
  library.enter(library.wanted, true); // landing on /blog/…: start inside, no iris
  workshop.enter(workshop.wanted, true);
  lighthouse.enter(lighthouse.wanted, true);
  // the rooms load once the island is up and the browser has a moment
  (window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1500)))(() => {
    void library.load();
    void workshop.load();
    void lighthouse.load();
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
    sound.rain = weather.now.rain + weather.now.hail * 0.5;
    sound.wind = weather.gust;
    sound.cicadas = weather.heat.scorch * (1 - sky.lamps);
    life.playing = sound.playing !== null;
    life.rhythm = sound.playing ? ((beats as Record<string, Rhythm>)[sound.playing.id] ?? null) : null;
    life.songTime = sound.songTime;
    if (!reducedMotion) life.update(dt);
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
