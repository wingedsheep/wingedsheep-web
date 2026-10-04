import * as THREE from 'three';
import { hourOf } from './bedtime';
import { onTheDay } from './calendar';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Breakfast and dinner. Mornings she has yoghurt and he has sandwiches (pâté, peanut butter or egg
 * salad: vegetarian, all three); evenings it's one dish for both, a different one most days: pasta
 * (her favourite), miso soup with a little Japanese spread, a curry or a risotto (his), and now and
 * then a pizza, most often on a Friday. Outside on the logs by the fire when the weather's fit for
 * it, otherwise up at the hut's long table (outings.py, hut.py). Sunday mornings there are
 * pancakes instead (hut-room.ts).
 *
 * To preview: ?meal=breakfast|pasta|miso|curry|risotto|pizza (&where=hut or &where=fire).
 */
export type Dish = 'breakfast' | 'pasta' | 'miso' | 'curry' | 'risotto' | 'pizza';
export const DISHES: Dish[] = ['breakfast', 'pasta', 'miso', 'curry', 'risotto', 'pizza'];
export type Filling = 'pate' | 'pb' | 'egg';

export interface Course {
  key: string; // the day and the meal: each is eaten once
  dish: Dish;
  filling: Filling;
}

const BREAKFAST: [number, number] = [8, 9.25];
const DINNER: [number, number] = [18.25, 19.5];

const preview = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const dish = q.get('meal') as Dish | null;
    const where = q.get('where');
    return dish && DISHES.includes(dish) ? { dish, where: where === 'hut' ? true : where === 'fire' ? false : null } : null;
  } catch {
    return null;
  }
})();

/** A steady number in 0..1 for a day, a different one per `salt`. */
function daily(d: Date, salt: number) {
  const x = Math.sin((d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate()) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** What's for dinner on a day. */
export function dinnerOn(d: Date): Exclude<Dish, 'breakfast'> {
  const r = daily(d, 1);
  const day = d.getDay();
  if (day === 5 && r < 0.7) return 'pizza'; // Friday: pizza by the fire, mostly
  if (day === 6 && r < 0.25) return 'pizza';
  const menu: [Exclude<Dish, 'breakfast'>, number][] = [['pasta', 0.32], ['miso', 0.26], ['curry', 0.17], ['risotto', 0.15], ['pizza', 0.1]];
  let k = daily(d, 2);
  for (const [dish, p] of menu) if ((k -= p) < 0) return dish;
  return 'pasta';
}

/** The state of the table, shared by the two of them and the hut. */
export const table = {
  course: null as Course | null,
  /** Island time (ms) they'll be done. */
  until: 0,
  done: new Set<string>(),
  /** Up at the hut rather than out by the fire. */
  indoors: false,
  pinned: !!preview,
};

/** The meal it's time for (if it hasn't been eaten yet), or null. */
export function courseAt(time: number): Course | null {
  const d = onTheDay(time);
  const ymd = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const filling = (['pate', 'pb', 'egg'] as const)[Math.floor(daily(d, 3) * 3)];
  if (preview) return { key: 'preview', dish: preview.dish, filling };
  const hour = hourOf(time);
  let c: Course | null = null;
  if (d.getDay() !== 0 && hour >= BREAKFAST[0] && hour < BREAKFAST[1]) c = { key: `${ymd}:b`, dish: 'breakfast', filling };
  if (hour >= DINNER[0] && hour < DINNER[1]) c = { key: `${ymd}:d`, dish: dinnerOn(d), filling };
  return c && !table.done.has(c.key) ? c : null;
}

export interface TableWeather {
  rain: number;
  chill: number; // 0..1 (weather.ts)
  wind: number; // m/s
  night: number;
}

/** Whether it's no weather for eating out. */
function inside(w: TableWeather, dish: Dish) {
  if (preview?.where != null) return preview.where;
  return w.rain > 0.08 || w.chill > 0.05 || w.wind > 11 || (dish === 'breakfast' && w.night > 0.5);
}

/** Someone's sat down: the meal's on, for the next few minutes, here or up at the hut. */
export function sitDown(c: Course, time: number, w: TableWeather) {
  if (table.course?.key === c.key) return;
  table.course = c;
  table.until = time + rand(6, 9) * 60e3;
  table.indoors = inside(w, c.dish);
}

/** Done eating once the time's up; in from the fire if it starts to rain. */
export function tick(time: number, w: TableWeather) {
  const c = table.course;
  if (!c) return;
  if (!table.indoors && w.rain > 0.15) table.indoors = true;
  if (!table.pinned && (time > table.until || !courseAt(time) || courseAt(time)?.key !== c.key)) {
    table.done.add(c.key);
    table.course = null;
  }
}

/** The part of a dish that's in front of them, and what's in the hand, for each of them. */
function parts(dish: Dish, filling: Filling, who: 'v' | 'e') {
  if (dish === 'breakfast') return who === 'v' ? { lap: `sandwich_${filling}`, hand: `sandwich_${filling}` } : { lap: 'yoghurt', hand: 'spoon' };
  const hand = { pasta: 'fork', miso: 'chopsticks', curry: who === 'v' ? 'fork' : 'spoon', risotto: 'spoon', pizza: 'pizza' }[dish];
  return { lap: dish, hand };
}

/**
 * One of them eating (outings.py `*_eating`): the dish in front of them, and every few seconds a
 * mouthful, the right arm up from the shoulder and the elbow, a moment's chewing, and down again.
 */
export class Eater {
  private upper?: { o: THREE.Object3D; axis: THREE.Vector3; angle: number };
  private fore?: { o: THREE.Object3D; axis: THREE.Vector3; angle: number };
  private head?: THREE.Object3D;
  private headRest = new THREE.Euler();
  private laps = new Map<string, THREE.Object3D>();
  private hands = new Map<string, THREE.Object3D>();
  private bite = { t: 0, next: rand(1, 4) };
  private clock = 0;
  /** Clicked on: a look up, 1 easing back to 0. */
  noticed = 0;

  constructor(
    readonly root: THREE.Object3D,
    prefix: string,
    private who: 'v' | 'e',
  ) {
    root.traverse((o) => {
      const x = o.userData;
      if (o.name === `${prefix}_upper_r`) this.upper = { o, axis: new THREE.Vector3().fromArray(x.lift ?? [1, 0, 0]), angle: x.lift_angle ?? 0 };
      if (o.name === `${prefix}_fore_r`) this.fore = { o, axis: new THREE.Vector3().fromArray(x.bend ?? [1, 0, 0]), angle: x.bend_angle ?? 0 };
      if (o.name === `${prefix}_head`) {
        this.head = o;
        this.headRest.copy(o.rotation);
      }
      // (a part in several colours comes in as a group of meshes: _1, _2… under the part itself)
      const own = !o.parent?.name.startsWith(`${prefix}_lap_`) && !o.parent?.name.startsWith(`${prefix}_hand_`);
      if (own && o.name.startsWith(`${prefix}_lap_`)) this.laps.set(o.name.slice(prefix.length + 5), o);
      if (own && o.name.startsWith(`${prefix}_hand_`)) this.hands.set(o.name.slice(prefix.length + 6), o);
    });
  }

  /** The head, for breath on a cold evening. */
  get face() {
    return this.head;
  }

  update(dt: number, c: Course | null) {
    if (!c) return;
    this.clock += dt;
    const { lap, hand } = parts(c.dish, c.filling, this.who);
    for (const [k, o] of this.laps) o.visible = k === lap;
    for (const [k, o] of this.hands) o.visible = k === hand;
    const b = this.bite;
    if (b.t > 0 || (b.next -= dt) < 0) {
      b.t = Math.min(1, b.t + dt / 2.2);
      if (b.t >= 1) Object.assign(b, { t: 0, next: rand(3, 8) });
    }
    // up quickly, a moment at the mouth, down at leisure
    const k = b.t < 0.3 ? THREE.MathUtils.smoothstep(b.t, 0, 0.3) : b.t < 0.5 ? 1 : 1 - THREE.MathUtils.smoothstep(b.t, 0.5, 1);
    if (this.upper) this.upper.o.quaternion.setFromAxisAngle(this.upper.axis, this.upper.angle * k);
    if (this.fore) this.fore.o.quaternion.setFromAxisAngle(this.fore.axis, this.fore.angle * k);
    this.noticed = Math.max(0, this.noticed - dt / 2.5);
    if (this.head) {
      const chew = b.t > 0.4 && b.t < 0.9 ? Math.abs(Math.sin(this.clock * 9)) * 0.04 : 0;
      this.head.rotation.set(this.headRest.x + 0.22 * (1 - k) - this.noticed * 0.3 + chew, this.headRest.y + Math.sin(this.clock * 0.3) * 0.12 * (1 - k), this.headRest.z);
    }
  }
}

/** What's on the go between them: the board, the pot, the box (outings.py `spread`). */
export function showSpread(root: THREE.Object3D | undefined, prefix: string, dish: Dish | null) {
  if (!root) return;
  root.visible = dish !== null;
  for (const d of DISHES) {
    const o = root.getObjectByName(`${prefix}_${d}`);
    if (o) o.visible = d === dish;
  }
}
