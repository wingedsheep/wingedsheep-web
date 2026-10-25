import * as THREE from 'three';
import type { Beike } from './beike';
import { visitDate } from './calendar';
import type { Island } from './island';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** The eggs' shells and bands (holidays.py EGG_COLOURS, by number). */
const COLOURS = [['#f2b8c6', '#fff4d8'], ['#a8d8f0', '#f2c440'], ['#f7e08a', '#e86a6a'], ['#b8e0a0', '#f2ece2'], ['#d0b8f0', '#fff4d8'], ['#f5a860', '#2f6fb0']];
const PASTEL = COLOURS.map(([shell]) => shell).concat('#fff4d8');
const SNIFF = 6; // metres Beike runs off towards an egg when you ask him for a hint

export type Building = 'library' | 'workshop' | 'lighthouse' | 'hut';
type Where = 'island' | Building;
const PLACE_NAMES: Record<Where, string> = { island: 'Outside', library: 'Library', workshop: 'Workshop', lighthouse: 'Lighthouse', hut: 'Hut' };
const THE: Record<Building, string> = { library: 'the library', workshop: 'the workshop', lighthouse: 'the lighthouse', hut: 'the hut up the mountain' };

/**
 * Where each egg is (holidays.py EGGS, then dressing.py ROOM_EGGS, in the same order): a riddle for
 * a hint, and a word when it's found.
 */
const HIDES: { where: Where; hint: string; found?: string }[] = [
  { where: 'island', hint: 'in Beike’s meadow. He walks past it every day.', found: 'In Beike’s meadow, among the crocuses. He knew it was there all along.' },
  { where: 'island', hint: 'under something two cats are sitting on.', found: 'Under the bench. Charlie and George were sitting right on top of it and said nothing.' },
  { where: 'island', hint: 'where the boats come in, next to someone pretending to be asleep.', found: 'At the end of the pier. The dock cat had been guarding it, in the sense of lying next to it.' },
  { where: 'island', hint: 'at the foot of something you’d make a wish at.', found: 'By the well. You could wish for the rest of them, but that’s cheating.' },
  { where: 'island', hint: 'up the mountain, where the firewood’s stacked.' },
  { where: 'island', hint: 'as high as the island goes.', found: 'Tied to the summit flagpole. Whoever hid this one had a good climb.' },
  { where: 'island', hint: 'somewhere the badgers would know about.', found: 'At the mouth of the sett. The badgers were keeping it for later.' },
  { where: 'island', hint: 'in the rocks at the foot of the tallest building on the island.' },
  { where: 'island', hint: 'at the foot of a rock people climb for fun.', found: 'At the foot of the bouldering rock, right where the crash pad goes.' },
  { where: 'island', hint: 'by the fire, tucked against a log.', found: 'By the campfire. Lucky it wasn’t a chocolate one.' },
  { where: 'island', hint: 'where the pink petals fall.', found: 'Under the blossom tree, in the petals.' },
  { where: 'island', hint: 'at the foot of something that tells you which way to go.' },
  { where: 'island', hint: 'on the doorstep of a house full of stories.', found: 'On the library’s doorstep, like a parcel.' },
  { where: 'island', hint: 'under something you’d swing in of an afternoon.', found: 'Under the hammock. Whoever left it there was having a lie-down.' },
  { where: 'island', hint: 'on a table where someone left in the middle of their turn.', found: 'On the card table, by the cards. Not a legal play.' },
  { where: 'island', hint: 'up where the keeper goes out to clean the glass.', found: 'Up on the lighthouse’s gallery, as high as the keeper goes.' },
  { where: 'island', hint: 'out at sea, balanced on a twig.', found: 'On top of a birch twig out in the water. Someone waded out for that one.' },
  { where: 'library', hint: 'on top of something with black and white keys.', found: 'On the piano’s lid. Play it something cheerful.' },
  { where: 'library', hint: 'on the sill of the library’s window.', found: 'On the window sill, between the curtains.' },
  { where: 'library', hint: 'under a portrait of a sheep with wings.', found: 'On the mantelpiece, under the winged sheep. It approves.' },
  { where: 'workshop', hint: 'next to a head that’s waiting for a new bulb.', found: 'On the workbench, by the robot’s spare head. Neither of them saw a thing.' },
  { where: 'workshop', hint: 'on a desk where every colour has a number.', found: 'On her paint-by-numbers desk. It isn’t one of the numbers.' },
  { where: 'workshop', hint: 'on a shelf, next to a clock with its insides out.', found: 'On the shelf by the clock. The clock has no idea what time it is either.' },
  { where: 'lighthouse', hint: 'on the end of a desk, in the lighthouse.', found: 'On the end of his desk. He’d have thought it was a new kind of mouse.' },
  { where: 'lighthouse', hint: 'on top of the bookcase in the lighthouse.', found: 'On top of the bookcase. You need to be tall, or patient.' },
  { where: 'lighthouse', hint: 'somewhere the cats come running when the tap goes.', found: 'In the kitchen sink. Washed, at least.' },
  { where: 'lighthouse', hint: 'as high up the lighthouse as you can go.', found: 'Up in the lamp room, on the sill under the glass.' },
  { where: 'hut', hint: 'in the high window of the hut.', found: 'In the hut’s high window. That took a stretch.' },
  { where: 'hut', hint: 'up on the shelf where the post goes.', found: 'On the post shelf, over the coats. No stamp on it.' },
  { where: 'hut', hint: 'next to an axe, up the mountain.', found: 'On the chopping block, by the axe. Lucky.' },
];
const ORDER: Where[] = ['island', 'library', 'workshop', 'lighthouse', 'hut'];

/** The eggs hidden in a place, by id, for its clickable places (content.ts). */
export const eggIds = (where: Where) => HIDES.flatMap((h, i) => (h.where === where ? [`egg_${i}`] : []));

const FOUND = ['Found one!', 'Nicely spotted.', 'Another one.', 'Good eye.', 'There it is.'];

/** A pixel egg with a band round it, for the card: in its colours once found, or a pale outline of one. */
const eggIcon = (i: number, found: boolean, size = 1) => {
  const [shell, band] = found ? COLOURS[i % COLOURS.length] : ['currentColor', 'currentColor'];
  return `<svg class="egg-px${found ? ' found' : ''}" width="${8 * size}" height="${10 * size}" viewBox="0 0 4 5" aria-hidden="true"><path fill="${shell}" d="M1 0h2v1h1v3h-1v1h-2v-1h-1v-3h1z"/><path fill="${band}" d="M0 2h4v1h-4z"/></svg>`;
};
const GOLD_EGG = `<svg class="egg-px egg-gold" width="32" height="40" viewBox="0 0 8 10" aria-hidden="true"><path fill="#e8b24a" d="M3 0h2v1h1v1h1v2h1v4h-1v1h-1v1h-4v-1h-1v-1h-1v-4h1v-2h1v-1h1z"/><path fill="#fff4d8" d="M3 1h1v1h-1zM2 2h1v2h-1z"/><path fill="#c8853a" d="M0 5h8v1h-8z"/><path fill="#fff4d8" d="M2 7h1v1h-1zM5 7h1v1h-1z"/></svg>`;

interface Egg {
  id: string;
  i: number;
  where: Where;
  /** On the island from the start; indoors, once that room has loaded. */
  o?: THREE.Object3D;
  found: boolean;
}

interface Hud {
  toast(text: string): void;
  /** Where the camera's pointed, on the island. */
  looking(): THREE.Vector3;
  chime(): void;
}

/**
 * Easter's egg hunt (holidays.py `easter`, and dressing.py's for the rooms): thirty painted
 * eggs, all where you can see them: all over the island, by and under things, and indoors too, in
 * every building. Click one to find it.
 *
 * Once you've found one, a card comes up by the brand: a little egg for each, by place, coloured
 * in as you find them, and a hint, which outdoors sends Beike off nose down towards the nearest egg
 * you haven't found (or to the door of a building with one inside). And a basket turns up in his
 * meadow, which fills as you go: find them all and there's a golden egg on top, for you. What
 * you've found is remembered over Easter.
 */
export class Easter {
  private eggs: Egg[];
  private basket?: THREE.Object3D;
  private pile: THREE.Object3D[] = [];
  private gold?: THREE.Object3D;
  private card?: HTMLElement;
  private hud?: Hud;
  private inside = new Set<Building>();
  private said = 0;
  private glint = 0;
  private fresh?: string;
  private key = `wingedsheep:eggs:${visitDate().getFullYear()}`;
  readonly on: boolean;
  /** Barks when he's pleased (the island plays it). */
  onBark?: () => void;

  constructor(
    private island: Island,
    private beike: Beike,
    private particles: Particles,
  ) {
    this.on = Boolean(island.get('egg_0'));
    let kept: string[] = [];
    try {
      kept = JSON.parse(localStorage.getItem(this.key) ?? '[]');
    } catch {}
    this.eggs = HIDES.map((h, i) => ({ id: `egg_${i}`, i, where: h.where, found: this.on && kept.includes(`egg_${i}`) }));
    for (const e of this.eggs) if (e.where === 'island') e.o = island.get(e.id);
    this.basket = island.get('egg_basket');
    this.basket?.traverse((o) => {
      const k = o.userData.basket;
      if (k === 'gold') this.gold = o;
      else if (typeof k === 'number') this.pile[k] = o;
    });
    this.show();
  }

  private get count() {
    return this.eggs.filter((e) => e.found).length;
  }

  private get done() {
    return this.count === this.eggs.length;
  }

  /** A room has loaded (its `named`): its eggs, the ones you've found already gone. */
  adopt(named: Map<string, THREE.Object3D>) {
    if (!this.on) return;
    for (const e of this.eggs) {
      const o = named.get(e.id);
      if (o) e.o = o;
    }
    this.show();
  }

  /** You've gone into a building, or come out of it: hints are for in there while you're in. */
  indoors(where: Building, inside: boolean) {
    if (inside) this.inside.add(where);
    else this.inside.delete(where);
  }

  /** The card for the hunt, under the brand (hud.ts); it comes up once you've found an egg. */
  mount(hud: Hud) {
    this.hud = hud;
    const brand = document.querySelector('.brand');
    if (!this.on || !brand) return;
    const card = document.createElement('section');
    card.className = 'egg-hunt';
    card.setAttribute('aria-label', 'Easter egg hunt');
    card.hidden = true;
    brand.append(card); // under the name, so it moves with it (smaller on a phone, shorter in a room)
    this.card = card;
    card.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('[data-egg-fold]')) {
        card.classList.toggle('folded');
        t.closest('[data-egg-fold]')!.setAttribute('aria-expanded', String(!card.classList.contains('folded')));
      } else if (t.closest('[data-egg-hint]')) hud.toast(this.hint());
    });
    if (innerWidth < 700) card.classList.add('folded');
    this.render();
  }

  private render() {
    const card = this.card;
    if (!card) return;
    const n = this.count;
    card.hidden = n === 0;
    card.classList.toggle('done', this.done);
    const open = !card.classList.contains('folded');
    const head = `<button class="egg-hunt-head" data-egg-fold aria-expanded="${open}">${eggIcon(1, true)}<span>Egg hunt</span><b>${n}/${this.eggs.length}</b></button>`;
    if (this.done) {
      card.innerHTML = `${head}<div class="egg-hunt-body egg-hunt-prize">${GOLD_EGG}<p><strong>All ${n} found!</strong> The golden egg is yours. It’s in your basket in Beike’s meadow. Happy Easter.</p></div>`;
      return;
    }
    const rows = ORDER.map((where) => {
      const mine = this.eggs.filter((e) => e.where === where);
      const got = mine.filter((e) => e.found).length;
      const icons = mine.map((e) => eggIcon(e.i, e.found).replace('class="egg-px', `class="egg-px${e.id === this.fresh ? ' fresh' : ''}`)).join('');
      return `<li${got === mine.length ? ' class="all"' : ''}><span class="egg-hunt-where">${PLACE_NAMES[where]}</span><span class="egg-hunt-row" aria-label="${got} of ${mine.length}">${icons}</span></li>`;
    }).join('');
    card.innerHTML = `${head}<div class="egg-hunt-body"><ul>${rows}</ul><button class="egg-hunt-hint" data-egg-hint>${this.inside.size ? 'A hint' : 'Ask Beike for a hint'}</button></div>`;
  }

  /** Found eggs gone, the basket out once there's something in it, filled as far as you've got. */
  private show() {
    for (const e of this.eggs) if (e.o) e.o.visible = !e.found;
    const n = this.count;
    if (this.basket) this.basket.visible = this.on && n > 0;
    this.pile.forEach((o, k) => (o.visible = k < n));
    if (this.gold) this.gold.visible = this.done;
  }

  /** Clicked an egg: found it. Returns what to say. */
  find(id: string): string {
    const egg = this.eggs.find((e) => e.id === id);
    if (!egg || egg.found) return 'You’ve found that one already.';
    egg.found = true;
    this.fresh = id;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.eggs.filter((e) => e.found).map((e) => e.id)));
    } catch {}
    if (egg.where === 'island' && egg.o) this.burst(egg.o.getWorldPosition(V()).add(V(0, 0.2, 0)), 14);
    this.show();
    this.render();
    this.hud?.chime();
    const n = this.count;
    const all = this.eggs.length;
    if (n === all) {
      const at = this.gold?.getWorldPosition(V()) ?? egg.o?.getWorldPosition(V());
      if (at) for (let k = 0; k < 4; k++) this.burst(at.clone().add(V(rand(-1, 1), rand(0.3, 1.2), rand(-1, 1))), 20);
      if (!this.inside.size) this.onBark?.();
      return `That’s all ${all}! There’s a golden egg on top of your basket in Beike’s meadow, and it’s yours. Happy Easter.`;
    }
    const line = n === 1 ? 'Found one!' : (HIDES[egg.i]?.found ?? FOUND[this.said++ % FOUND.length]);
    if (n === 1) return `${line} ${all - 1} more are hidden all over the island, some of them indoors. There’s a basket for them in Beike’s meadow.`;
    return line;
  }

  /** What the basket says when you click it. */
  basketLine() {
    const n = this.count;
    if (this.done) return 'Your basket, full, with the golden egg on top. Beike is very proud of you, and a little bit of himself.';
    return `Your basket: ${n} of ${this.eggs.length} so far. ${this.eggs.length - n === 1 ? 'One to go.' : 'Keep looking.'}`;
  }

  /**
   * A hint. Indoors, for an egg in there. Outdoors, Beike sets off nose to the ground towards the
   * nearest egg out here you haven't found, or, once you've found those, towards a building with
   * one inside; and you get a riddle.
   */
  private hint(): string {
    const left = this.eggs.filter((e) => !e.found);
    if (!left.length) return `You’ve found all ${this.eggs.length}.`;
    const [here] = this.inside;
    if (here) {
      const mine = left.find((e) => e.where === here);
      if (mine) return `Somewhere in here: ${HIDES[mine.i].hint}`;
      const other = left.find((e) => e.where !== 'island') ?? left[0];
      return other.where === 'island' ? 'Nothing left in here. The rest are outside.' : `Nothing left in here. Try ${THE[other.where]}.`;
    }
    const flat = (p: THREE.Vector3) => V(p.x, 0, p.z);
    const looking = flat(this.hud?.looking() ?? V());
    const spot = (e: Egg) => (e.where === 'island' ? e.o?.getWorldPosition(V()) : this.island.positionOf(e.where));
    const out = left.filter((e) => e.where === 'island');
    const target = (out.length ? out : left)
      .map((e) => ({ e, at: spot(e) }))
      .filter((c): c is { e: Egg; at: THREE.Vector3 } => Boolean(c.at))
      .sort((a, b) => flat(a.at).distanceTo(looking) - flat(b.at).distanceTo(looking))[0];
    if (!target) return `Somewhere: ${HIDES[left[0].i].hint}`;
    const riddle = HIDES[target.e.i].hint;
    const from = this.beike.position;
    const way = V(target.at.x - from.x, 0, target.at.z - from.z);
    const far = way.length();
    const off = far > 1 && this.beike.hunt(from.clone().addScaledVector(way.normalize(), Math.min(SNIFF, far - 0.6)), () => {});
    if (target.e.where !== 'island') {
      const name = THE[target.e.where];
      return off ? `Beike puts his nose down and heads for ${name}. His nose says: ${riddle}` : `Beike sniffs the air and looks at ${name}. His nose says: ${riddle}`;
    }
    return off ? `Beike puts his nose down and sets off that way. His nose says: ${riddle}` : `Beike sniffs the air. His nose says: ${riddle}`;
  }

  /** Every frame: once it's on the basket, now and then a glint off the golden egg. */
  update(dt: number) {
    if (!this.gold?.visible) return;
    this.glint -= dt;
    if (this.glint > 0) return;
    this.glint = rand(0.6, 1.6);
    const at = this.gold.getWorldPosition(V()).add(V(rand(-0.15, 0.15), rand(0.1, 0.3), rand(-0.15, 0.15)));
    this.particles.emit({ position: at, velocity: V(0, rand(0.2, 0.5), 0), color: Math.random() < 0.5 ? '#fff4d8' : '#f2c440', life: rand(0.5, 0.9), gravity: 0, fadeIn: 0.1 });
  }

  private burst(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = V(rand(-1, 1), rand(0.4, 1.2), rand(-1, 1)).multiplyScalar(0.8);
      this.particles.emit({ position: at.clone(), velocity: v, color: PASTEL[i % PASTEL.length], life: rand(0.5, 0.9), gravity: 2, fadeIn: 0 });
    }
  }
}
