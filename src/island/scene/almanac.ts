import { countDays, visitDate } from './calendar';

/**
 * The week's bookkeeping, kept free of anything that needs a browser so the page's text
 * (content.ts) can use it too: what's on the hut's shelf, how far the boat in the workshop has
 * got, and where today's post is (week.ts and vincent.ts move it along).
 */

/** Today's post (tools/models/week.py): still on the pier waiting for Vincent, or up at the hut. */
export const post = { waiting: false, delivered: false };

const isPostDay = (d: Date) => d.getDay() === 2 || d.getDay() === 5;

/**
 * What's on the hut's shelf (hut.py POST_SHELF): by thing (0..11), the day it came. Six places,
 * the newest thing in each; today's is still in its paper on the mat.
 */
export const shelf = (() => {
  const today = visitDate();
  const days: Date[] = [];
  for (const d = new Date(2024, 0, 1); d <= today; d.setDate(d.getDate() + 1)) if (isPostDay(d)) days.push(new Date(d));
  const newest = days.length - 1 - (isPostDay(today) ? 1 : 0);
  const on = new Map<number, Date>();
  for (let place = 0; place < 6; place++) {
    const j = newest - ((((newest - place) % 6) + 6) % 6);
    if (j >= 0) on.set(j % 12, days[j]);
  }
  return on;
})();

/** The boat in the workshop (workshop.py BOAT_STAGES): one stage a Saturday, then a new boat. */
export const BOAT_STAGES = 6;
export const boatStage = (Math.max(1, countDays((d) => d.getDay() === 6)) - 1) % BOAT_STAGES;
