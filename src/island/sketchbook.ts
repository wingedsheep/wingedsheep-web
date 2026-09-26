/** A growing field book. Only observed animals get a page; old discoveries are carried over. */
const SPECIMENS = [
  ['beaver', 'Beaver', 'A flat tail, a wake in the water, and supper on its way home.'],
  ['otter', 'Otter', 'A quick silver ripple. Then a whiskered face looking back.'],
  ['moose', 'Moose', 'All legs and antlers, standing quite still in the shallows.'],
  ['bear', 'Brown bear', 'Fishing from the bank. Best sketched from a little distance.'],
  ['wolves', 'Wolves', 'Quiet shapes between the trees, watching the river go by.'],
  ['lynx', 'Lynx', 'Tufted ears. Soft feet. Gone almost before the pencil touches paper.'],
  ['yeti', 'Yeti', 'An uncertain outline. Quite certain I saw something.'],
  ['heron', 'Grey heron', 'Folded like a paper umbrella, until those enormous wings open.'],
  ['duck', 'Mallard', 'A green head and a very purposeful paddle.'],
  ['deer', 'Red deer', 'Ears turn first. Then the whole woodland seems to move.'],
  ['sheep', 'Sheep', 'An excellent cloud study, with legs.'],
  ['fish', 'Trout', 'A bright arc above the river, and a widening ring below.'],
  ['swan', 'Swan', 'A white curve drifting through the green water.'],
  ['raven', 'Raven', 'Dark wings wheeling high over the rough water.'],
  ['kingfisher', 'Kingfisher', 'A blue flash, flying low and straight along the river.'],
  ['wingedsheep', 'Winged sheep', 'The wings appear to work. The sheep seems unsurprised.'],
  ['rabbit', 'Rabbit', 'Long ears, a white tail, and a very hasty departure.'],
  ['stag', 'Red deer stag', 'A crown of antlers above the evening grass.'],
  ['badger', 'Badger', 'A striped face, nose down, busy with important earthwork.'],
  ['hedgehog', 'Hedgehog', 'A small prickly traveller, out looking for beetles.'],
  ['fox', 'Fox', 'A red brush of a tail slipping into the dark.'],
  ['crab', 'Crab', 'Sideways across the sand, claws raised in protest.'],
  ['squirrel', 'Red squirrel', 'A flick of a tail halfway up a tree.'],
  ['gull', 'Herring gull', 'A fine study of wings. A less fine study of manners.'],
  ['songbird', 'Robin', 'A little red waistcoat, and a great deal to say.'],
  ['owl', 'Tawny owl', 'Round eyes keeping watch after everyone else has gone to bed.'],
  ['bat', 'Bat', 'A tiny silhouette stitching its way through the dusk.'],
  ['goose', 'Goose', 'One voice in a travelling chorus across the sky.'],
  ['dolphin', 'Dolphin', 'A curved back breaking the sea, then another beside it.'],
  ['whale', 'Humpback whale', 'One slow breath. A whole page hardly seems enough.'],
  ['serpent', 'Sea serpent', 'The old maps may have been right all along.'],
  ['duckling', 'Duckling', 'A scrap of fluff working very hard to keep up.'],
  ['blacksheep', 'Black sheep', 'A dark patch in the flock, looking pleased with itself.'],
  ['starsheep', 'Star-marked sheep', 'A pale star in the wool. Worth a second look.'],
  ['supersheep', 'Super Sheep', 'A red cape and a rather hurried sketch.'],
  ['starlings', 'Starlings', 'One of thousands. Behind it, the rest, turning over the trees as one.'],
] as const;
/** The atlas is six sketches wide and seven deep; its thirty-sixth sketch is the feather, not an animal. */
const FEATHER = 35;
const tileOf = (specimen: number) => (specimen >= FEATHER ? specimen + 1 : specimen);
export type Animal = typeof SPECIMENS[number][0];
type Entry = { id: Animal; where: string; date?: string };
const KEY = 'wingedsheep:sketchbook';
const valid = (id: unknown): id is Animal => SPECIMENS.some((s) => s[0] === id);
let entries: Entry[] | undefined;
const listeners = new Set<() => void>();
function saved(key: string): unknown[] {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function pages(): Entry[] {
  if (entries) return entries;
  entries = [];
  for (const value of saved(KEY)) {
    if (!value || typeof value !== 'object') continue;
    const e = value as Entry;
    if (valid(e.id) && !entries.some((p) => p.id === e.id)) entries.push({ id: e.id, where: e.where === 'Along the river' ? e.where : 'On the island', date: typeof e.date === 'string' && Number.isFinite(Date.parse(e.date)) ? e.date : undefined });
  }
  const add = (id: unknown, where: string) => {
    if (valid(id) && !entries!.some((p) => p.id === id)) entries!.push({ id, where });
  };
  for (const id of saved('wingedsheep:river:spotted')) add(id, 'Along the river');
  const aliases: Record<string, string> = { sheep: 'wingedsheep', geese: 'goose', dolphins: 'dolphin' };
  for (const id of saved('wingedsheep:found')) if (typeof id === 'string') add(aliases[id] ?? id, 'On the island');
  return entries;
}
export function spotAnimal(id: string, where = 'On the island'): boolean {
  if (!valid(id) || pages().some((e) => e.id === id)) return false;
  pages().push({ id, where, date: new Date().toISOString() });
  try { localStorage.setItem(KEY, JSON.stringify(pages())); } catch { /* Still works for this visit. */ }
  for (const changed of listeners) changed();
  return true;
}

export function openSketchbook() {
  window.dispatchEvent(new Event('open-wildlife-book'));
}

export function bindSketchbook() {
  const book = document.querySelector<HTMLDialogElement>('[data-sketchbook]')!;
  const leaves = [...book.querySelectorAll<HTMLElement>('[data-sketchbook-page]')];
  const spread = book.querySelector<HTMLElement>('[data-sketchbook-spread]')!;
  const prev = book.querySelector<HTMLButtonElement>('[data-sketchbook-prev]')!;
  const next = book.querySelector<HTMLButtonElement>('[data-sketchbook-next]')!;
  let current = 0;
  let opener: HTMLElement | null = null;
  const text = (tag: string, words: string, className = '') => {
    const el = document.createElement(tag); el.textContent = words; el.className = className; return el;
  };
  const drawing = (tile: number, label: string) => {
    const art = document.createElement('div'); art.className = 'wildlife-drawing';
    art.setAttribute('role', 'img'); art.setAttribute('aria-label', label);
    art.style.backgroundPosition = `${tile % 6 * 20}% ${Math.floor(tile / 6) * 100 / 6}%`;
    return art;
  };
  const render = () => {
    const all = pages();
    current = Math.max(0, Math.min(current, Math.max(0, Math.ceil(all.length / 2) - 1)));
    prev.disabled = current === 0;
    next.disabled = (current + 1) * 2 >= all.length;
    for (const [side, leaf] of leaves.entries()) {
      const number = current * 2 + side;
      const entry = all[number];
      leaf.replaceChildren();
      if (entry) {
        const specimen = SPECIMENS.findIndex((s) => s[0] === entry.id);
        const [, name, note] = SPECIMENS[specimen];
        leaf.append(text('span', 'FIELD NOTES  /  ' + (entry.where === 'Along the river' ? 'RIVER' : 'ISLAND'), 'wildlife-running-title'));
        leaf.append(text('h3', name), drawing(tileOf(specimen), `Pencil sketch of ${name.toLowerCase()}`));
        leaf.append(text('p', note, 'wildlife-note'));
        leaf.append(text('p', entry.date ? new Date(entry.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : 'From an earlier adventure', 'wildlife-date'));
        leaf.append(text('span', String(number + 1).padStart(2, '0'), 'wildlife-folio'));
      } else {
        leaf.append(text('span', 'A NOTEBOOK FROM THE ISLAND', 'wildlife-running-title'));
        leaf.append(text('h3', all.length ? 'Still out there…' : side === 0 ? 'Notes from the wild' : 'Room for another'));
        const feather = drawing(FEATHER, 'A pencilled feather'); feather.classList.add('wildlife-feather'); leaf.append(feather);
        leaf.append(text('p', all.length ? 'The next page belongs to something I haven’t met yet.' : side === 0 ? 'For the quiet things in the grass, the wings above the trees, and whatever the river brings.' : 'Click an animal on the island, or spot one from the kayak. I’ll keep a sketch here.', 'wildlife-note'));
        leaf.append(text('span', 'to be continued', 'wildlife-date'));
      }
    }
    book.querySelector('[data-sketchbook-number]')!.textContent = all.length ? `Sketches ${current * 2 + 1} to ${Math.min(current * 2 + 2, all.length)} of ${all.length}` : 'Your first discovery will add a page';
  };
  window.addEventListener('open-wildlife-book', () => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    if (!book.open) book.showModal();
  });
  book.querySelector('[data-sketchbook-close]')!.addEventListener('click', () => book.close());
  book.addEventListener('close', () => opener?.focus());
  book.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'ArrowLeft') { event.preventDefault(); prev.click(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); next.click(); }
  });
  const turn = (direction: number) => {
    current += direction; render();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) spread.animate([
      { opacity: 0.4, transform: `perspective(1000px) rotateY(${direction * 4}deg)` },
      { opacity: 1, transform: 'perspective(1000px) rotateY(0)' },
    ], { duration: 220, easing: 'ease-out' });
  };
  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  listeners.add(render);
  render();
}
