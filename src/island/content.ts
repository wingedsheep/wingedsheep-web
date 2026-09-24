/**
 * What things on the island *mean*. The art pipeline decides where a prop stands and how it
 * looks; this file decides what happens when you point at it or click it.
 *
 * To add something new: place a model with an `id` in tools/models/models.py, then add an
 * entry here. Secrets listed in SECRETS show up in the journal automatically.
 */
import type * as THREE from 'three';
import type { Journal } from './journal';
import type { CameraRig } from './scene/camera-rig';
import type { Island } from './scene/island';
import type { Life } from './scene/life';
import type { Sky } from './scene/sky';
import type { Sound } from './sound';

export type PanelName = 'library' | 'workshop' | 'lighthouse' | 'campfire' | 'trail' | 'places' | 'journal';

export interface IslandContext {
  island: Island;
  rig: CameraRig;
  sky: Sky;
  life: Life;
  sound: Sound;
  journal: Journal;
  openPanel(name: PanelName): void;
  toast(text: string): void;
  /** Mark a secret as found (toasts the first time). */
  discover(id: keyof typeof SECRETS): void;
}

export interface Place {
  label: string | ((ctx: IslandContext) => string);
  /** Open this panel and glide the camera to the place. */
  panel?: PanelName;
  activate?(ctx: IslandContext, at: THREE.Vector3): void;
}

export const SECRETS = {
  cat: { title: 'The dock cat', hint: 'Someone is napping where the boats come in.' },
  sheep: { title: 'The winged sheep', hint: 'Look up. Then click.' },
  guitar: { title: 'A song by the fire', hint: 'Follow the sound of strings.' },
  well: { title: 'The well', hint: 'Some wells go deeper than others.' },
  bench: { title: 'A place to rest', hint: 'Every good journey has benches.' },
  boulder: { title: 'First ascent', hint: 'There are holds on one of the rocks.' },
  summit: { title: 'The summit', hint: 'The trail keeps going up.' },
  magic: { title: 'An unfinished game', hint: 'Someone left in the middle of their turn.' },
  kayak: { title: 'Wet paddles', hint: 'Check the water by the dock.' },
  ufo: { title: 'Unidentified', hint: 'Only at night. Only for a moment.' },
  moons: { title: 'Two moons', hint: 'Count the moons in the sea at night.' },
  flock: { title: 'The flock', hint: '↑ ↑ ↓ ↓ ← → ← → B A' },
} as const;

const say = (text: string) => (ctx: IslandContext) => ctx.toast(text);

export const PLACES: Record<string, Place> = {
  dock: { label: 'The dock', activate: say('Every visitor arrives here. The water is calm today.') },
  signpost: { label: 'Signpost · where to?', panel: 'places' },
  library: { label: 'The library · blog', panel: 'library' },
  workshop: { label: 'The workshop · projects', panel: 'workshop' },
  lighthouse: { label: "The lighthouse · keeper's log", panel: 'lighthouse' },
  campfire: { label: 'The campfire · about me', panel: 'campfire' },
  cairn: { label: 'A cairn on the trail · career', panel: 'trail' },
  summit: {
    label: 'The summit',
    panel: 'trail',
    activate: (ctx) => ctx.discover('summit'),
  },
  vincent: {
    label: (ctx) => (ctx.sound.playing ? `Vincent · playing ${ctx.sound.playing.title}` : 'Vincent · ask for a song'),
    activate(ctx, at) {
      if (ctx.sound.playing) {
        ctx.sound.stopSong();
        return;
      }
      ctx.sound.playSong(ctx.sound.nextSongId());
      ctx.life.burst('notes', at);
      ctx.discover('guitar');
    },
  },
  guitar_case: { label: 'An open guitar case', panel: 'campfire' },
  cat: {
    label: (ctx) => (ctx.journal.has('cat') ? 'The dock cat' : 'A sleeping cat'),
    activate(ctx, at) {
      ctx.toast('Mrrp. One eye opens, then closes again.');
      ctx.life.burst('hearts', at);
      ctx.discover('cat');
      setTimeout(() => ctx.life.burst('zzz', at), 4000);
    },
  },
  sheep: {
    label: 'A winged sheep',
    activate(ctx) {
      ctx.life.loop();
      ctx.toast('Baa!');
      ctx.discover('sheep');
    },
  },
  well: {
    label: 'An old well',
    activate(ctx) {
      ctx.toast('It is very deep. Far below, something winds a spring: kriiik, kriiik.');
      ctx.discover('well');
    },
  },
  blossom: {
    label: 'A blossom tree',
    activate: (ctx, at) => ctx.life.burst('petals', at),
  },
  bench: {
    label: 'A bench',
    activate(ctx, at) {
      ctx.life.burst('silk', at);
      ctx.toast('You sit down for a moment. Progress saved.');
      ctx.discover('bench');
    },
  },
  boulder: {
    label: 'A boulder with holds',
    activate(ctx, at) {
      ctx.life.burst('chalk', at);
      ctx.toast('Yellow holds, V4. You send it on the third try.');
      ctx.discover('boulder');
    },
  },
  card_table: {
    label: 'A game of Magic',
    activate(ctx) {
      ctx.toast('Someone left mid-turn with two Islands untapped. Suspicious.');
      ctx.discover('magic');
      ctx.openPanel('workshop');
    },
  },
  kayak: {
    label: 'A kayak',
    activate(ctx) {
      ctx.toast('The seat is still wet. Someone has been paddling around the island.');
      ctx.discover('kayak');
    },
  },
  ufo: {
    label: '???',
    activate(ctx) {
      ctx.toast('…and it is gone. Nobody will believe you.');
      ctx.discover('ufo');
    },
  },
  moons: {
    label: 'The moon, reflected. Twice?',
    activate(ctx) {
      ctx.toast('Two moons tonight. You might be in 1Q84.');
      ctx.discover('moons');
    },
  },
};

export function placeFor(id: string): Place | undefined {
  return PLACES[id] ?? (id.startsWith('cairn_') ? PLACES.cairn : undefined);
}

export function labelFor(place: Place, ctx: IslandContext): string {
  return typeof place.label === 'function' ? place.label(ctx) : place.label;
}
