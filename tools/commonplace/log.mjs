#!/usr/bin/env node
/**
 * The lightship's log (src/island/commonplace/log.json), written from the git history: one entry per
 * watch, each a session of Claude that built a piece of Commonplace (called Low Water at first), in the words it left in its
 * commit title. Run it just before committing, with that commit's title, so the watch writing it
 * is in the log too:
 *   node tools/commonplace/log.mjs "Commonplace: <one plain sentence>"
 * Without a title it writes the log as git has it (and fills in any watch that forgot to).
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../src/island/commonplace/log.json', import.meta.url));
const PREFIX = 'Commonplace: ';
// (the space was called Low Water at first, and its early watches signed that way)
const PREFIXES = [PREFIX, 'Low Water: '];
const prefixOf = (s) => PREFIXES.find((p) => s?.startsWith(p));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A ship's watch, and the bells last struck in it, for a time of day (Royal Navy reckoning). */
function watch(h, m) {
  const halves = Math.floor((h * 60 + m) / 30);
  // (the dog watches split 16–20 in two, so the watches change over at an odd hour each day)
  if (h >= 16 && h < 20) {
    const n = halves - 32;
    if (n <= 4) return { watch: 'First dog', bells: n === 0 ? 8 : n };
    return { watch: 'Last dog', bells: n - 4 };
  }
  const names = ['Middle', 'Morning', 'Forenoon', 'Afternoon', null, 'First'];
  const n = halves % 8;
  return { watch: names[Math.floor(h / 4)], bells: n === 0 ? 8 : n };
}

/** Which hand it's in: a number to draw one from, the same for the same watch. */
function hand(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}

function entry(iso, subject, key, company) {
  const [, y, mo, d, h, mi] = iso.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/).map(Number);
  let said = subject.slice(prefixOf(subject).length).trim();
  said = said[0].toUpperCase() + said.slice(1) + (/[.!?]$/.test(said) ? '' : '.');
  return { date: `${d} ${MONTHS[mo - 1]} ${y}`, ...watch(h, mi), said, hand: hand(key), ...(company ? { with: company } : {}) };
}

const raw = execFileSync('git', ['log', '--reverse', ...PREFIXES.map((p) => `--grep=^${p}`), '--format=%aI%x1f%s%x1f%b%x1e', 'HEAD'], { encoding: 'utf8' });
const log = [];
for (const rec of raw.split('\x1e')) {
  const [iso, subject, body = ''] = rec.trim().split('\x1f');
  if (!prefixOf(subject) || !/Co-Authored-By: Claude/i.test(body)) continue;
  // (the first watch was kept with Vincent, in one long session: one hand for all of it)
  const first = /\(1M context\)/.test(body);
  log.push({ at: Date.parse(iso), ...entry(iso, subject, first ? 'first' : `${iso} ${subject}`, first ? 'Vincent' : '') });
}
// (in the order they were written, which isn't git's: the first watch and the loop's first ones overlapped)
log.sort((a, b) => a.at - b.at);
for (const e of log) delete e.at;
const title = process.argv[2];
if (title) {
  if (!title.startsWith(PREFIX)) throw new Error(`the title should start "${PREFIX}"`);
  const now = new Date();
  const off = -now.getTimezoneOffset();
  const local = new Date(now.getTime() + off * 60e3).toISOString().slice(0, 19);
  const iso = `${local}${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
  log.push(entry(iso, title, `${iso} ${title}`, ''));
}
writeFileSync(OUT, JSON.stringify(log, null, 1) + '\n');
console.log(`${log.length} watches in the log`);
