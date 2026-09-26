import * as THREE from 'three';
import type { Beike } from './beike';
import { visitDate } from './calendar';
import type { Island } from './island';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const PASTEL = ['#f2b8c6', '#a8d8f0', '#f7e08a', '#b8e0a0', '#d0b8f0', '#fff4d8'];
const SNIFF = 6; // metres Beike runs off towards an egg when you ask him for a hint

/** Where each egg is (holidays.py EGGS, in the same order): a riddle for a hint, and a word when it's found. */
const HIDES: { hint: string; found?: string }[] = [
  { hint: 'Beike’s meadow. Right out in the open. Honestly.' },
  { hint: 'under something two cats are sitting on.', found: 'Under the bench. Charlie and George were sitting right on top of it and said nothing.' },
  { hint: 'where the boats come in, next to someone pretending to be asleep.', found: 'At the end of the pier. The dock cat had been guarding it, in the sense of lying next to it.' },
  { hint: 'round the back of something you’d make a wish at.', found: 'Behind the well. You could wish for the rest of them, but that’s cheating.' },
  { hint: 'up the mountain, where the firewood’s stacked.' },
  { hint: 'as high as the island goes.', found: 'Tied to the summit flagpole. Whoever hid this one had a good climb.' },
  { hint: 'somewhere the badgers would know about.', found: 'At the mouth of the sett. The badgers were keeping it for later.' },
  { hint: 'in the rocks at the foot of the tallest building on the island.' },
  { hint: 'behind a rock people climb for fun.' },
  { hint: 'by the fire, tucked against a log.', found: 'By the campfire. Lucky it wasn’t a chocolate one.' },
  { hint: 'under the pink tree.' },
  { hint: 'at the foot of something that tells you which way to go.' },
];

const FOUND = ['Found one!', 'Nicely spotted.', 'Another one.', 'Good eye.', 'There it is.'];

interface Egg {
  id: string;
  i: number;
  o: THREE.Object3D;
  found: boolean;
}

/**
 * Easter's egg hunt (holidays.py `easter`): a dozen painted eggs. One sits out in the open in
 * Beike's meadow, so you know what you're looking for; the rest are tucked away all over the
 * island, under and behind things. Click one to find it. The counter by the other buttons keeps
 * score, and clicking it asks Beike for a hint: he puts his nose down and sets off a few metres
 * towards the nearest egg you haven't found, and you get a riddle for where it is. What you've
 * found is remembered for the rest of the day.
 */
export class Easter {
  private eggs: Egg[] = [];
  private chip?: HTMLButtonElement;
  private said = 0;
  private key = `island:eggs:${visitDate().toDateString()}`;
  /** Barks when he's pleased (the island plays it). */
  onBark?: () => void;

  constructor(
    island: Island,
    private beike: Beike,
    private particles: Particles,
  ) {
    let kept: string[] = [];
    try {
      kept = JSON.parse(localStorage.getItem(this.key) ?? '[]');
    } catch {}
    for (let i = 0; ; i++) {
      const o = island.get(`egg_${i}`);
      if (!o) break;
      const found = kept.includes(`egg_${i}`);
      o.visible = !found;
      this.eggs.push({ id: `egg_${i}`, i, o, found });
    }
  }

  get on() {
    return this.eggs.length > 0;
  }

  private get count() {
    return this.eggs.filter((e) => e.found).length;
  }

  /** Put the egg counter by the other buttons (hud.ts). `toast` says the hints; `looking` is where the camera's pointed. */
  mount(toast: (text: string) => void, looking: () => THREE.Vector3) {
    const hud = document.querySelector('.hud');
    if (!this.on || !hud) return;
    const b = document.createElement('button');
    b.className = 'hud-btn';
    b.setAttribute('aria-label', 'Easter eggs found (click for a hint)');
    b.title = 'Easter eggs · click for a hint';
    b.addEventListener('click', () => toast(this.hint(looking())));
    hud.prepend(b);
    this.chip = b;
    this.render();
  }

  private render() {
    const b = this.chip;
    if (!b) return;
    const n = this.count;
    // a little pixel egg, then the score
    b.innerHTML = `<svg class="px-icon" width="12" height="15" viewBox="0 0 4 5" aria-hidden="true"><path d="M1 0h2v1h1v3h-1v1h-2v-1h-1v-3h1z"/></svg>${n}/${this.eggs.length}`;
    b.setAttribute('aria-pressed', String(n === this.eggs.length));
  }

  /** Clicked an egg: found it. Returns what to say. */
  find(id: string): string {
    const egg = this.eggs.find((e) => e.id === id);
    if (!egg || egg.found) return 'You’ve found that one already.';
    egg.found = true;
    egg.o.visible = false;
    const at = egg.o.getWorldPosition(V()).add(V(0, 0.2, 0));
    this.burst(at, 14);
    try {
      localStorage.setItem(this.key, JSON.stringify(this.eggs.filter((e) => e.found).map((e) => e.id)));
    } catch {}
    this.render();
    const n = this.count;
    const all = this.eggs.length;
    if (n === all) {
      for (let k = 0; k < 4; k++) this.burst(at.clone().add(V(rand(-1, 1), rand(0.3, 1.2), rand(-1, 1))), 20);
      this.onBark?.();
      return `That’s all ${all}! Happy Easter. Beike is very proud of you, and a little bit of himself.`;
    }
    if (n === 1 && egg.i === 0) return `That’s one! ${all - 1} more are hidden round the island. Stuck? Click the egg counter and Beike will sniff one out.`;
    const line = HIDES[egg.i]?.found ?? FOUND[this.said++ % FOUND.length];
    return `${line} ${n} of ${all}.`;
  }

  /**
   * A hint for the unfound egg nearest where you're looking: Beike sets off towards it, nose to
   * the ground, and you get a riddle.
   */
  private hint(looking: THREE.Vector3): string {
    const left = this.eggs.filter((e) => !e.found);
    if (!left.length) return `You’ve found all ${this.eggs.length}. Beike has nothing left to sniff out, and he’s quite pleased with himself.`;
    const flat = (p: THREE.Vector3) => V(p.x, 0, p.z);
    const target = left
      .map((e) => ({ e, d: flat(e.o.getWorldPosition(V())).distanceTo(flat(looking)) }))
      .sort((a, b) => a.d - b.d)[0].e;
    const at = target.o.getWorldPosition(V());
    const from = this.beike.position;
    const way = V(at.x - from.x, 0, at.z - from.z);
    const far = way.length();
    const off = far > 1 && this.beike.hunt(from.clone().addScaledVector(way.normalize(), Math.min(SNIFF, far - 0.6)), () => {});
    const riddle = HIDES[target.i]?.hint ?? 'somewhere near.';
    if (target.i === 0) return `Look in ${riddle}`;
    return off ? `Beike puts his nose down and sets off that way. His nose says: ${riddle}` : `Beike sniffs the air. His nose says: ${riddle}`;
  }

  private burst(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = V(rand(-1, 1), rand(0.4, 1.2), rand(-1, 1)).multiplyScalar(0.8);
      this.particles.emit({ position: at.clone(), velocity: v, color: PASTEL[i % PASTEL.length], life: rand(0.5, 0.9), gravity: 2, fadeIn: 0 });
    }
  }
}
