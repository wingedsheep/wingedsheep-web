/**
 * The autopilot in the game, in a browser: record.ts bundles this into the page. `autopilot(river)`
 * (the game, which dev builds leave on window.river) plans the line down this river and from then
 * on the paddler, not the keys, has the paddle.
 */

import type { Intent } from '../../src/island/river/controls';
import type { Course } from '../../src/island/river/course';
import type { Kayak } from '../../src/island/river/kayak';
import { DT, autopilot } from './pilot';

/** What of the game it needs (private in game.ts, but there all the same). */
interface Game {
  course: Course;
  kayak: Kayak;
  start: number;
  state: string;
  controls: { read(): Intent };
}

(window as unknown as { autopilot: (game: unknown) => { planned: boolean } }).autopilot = (game) => {
  const g = game as Game;
  // the whole river, not just the next few hundred metres, so there's a line all the way down
  g.course.extend(g.course.finish + 60);
  const auto = autopilot(g.course, g.kayak, g.start, g.course.finish);
  // (counting the knocks, for record.ts to tell)
  const w = window as unknown as { knocks: number };
  w.knocks = 0;
  const hit = g.kayak.events.hit;
  g.kayak.events.hit = (strength, at) => (w.knocks++, hit?.(strength, at));
  const read = g.controls.read.bind(g.controls);
  g.controls.read = () => {
    read(); // (still reading the keys and the pads, for everything but the paddle)
    return auto.intent(DT);
  };
  return { planned: !!auto.plan.chart };
};
