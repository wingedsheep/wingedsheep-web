/**
 * Kees, the DJ of Radio Alles, and his week (tools/radio/DJ.md, "His week"): what the radio
 * (radio.ts) says about it, and what you'd see on his boat (scene/sightings.ts).
 */

/**
 * His week, from the island's date, the same for everyone on a given day (tools/radio/DJ.md,
 * "His week"): the coffee running low before Saturday's supply run, Opa's three-week cough,
 * Gerrit's mood, now and then the inspectors. `?kees=supplyday,gerrit-away` adds some, to preview.
 */
export function weekOf(time: number): Set<string> {
  const d = new Date(time);
  const day = Math.floor((time - d.getTimezoneOffset() * 60000) / 86400000);
  const hash = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const on = new Set<string>();
  const dow = d.getDay();
  if (dow === 4 || dow === 5) on.add('coffeelow');
  if (dow === 6) on.add('supplyday');
  if (dow === 0) on.add('freshcoffee');
  on.add(['opa-fine', 'opa-coughing', 'opa-mended'][Math.floor((day + 3) / 7) % 3]);
  const mood = hash(day);
  if (mood < 0.12) on.add('gerrit-away');
  else if (mood < 0.35) on.add('gerrit-sulking');
  else if (mood < 0.6) on.add('gerrit-cheerful');
  if (dow !== 6 && hash(day + 0.5) < 0.1) on.add('inspectors');
  for (const s of new URLSearchParams(location.search).get('kees')?.split(',') ?? []) on.add(s);
  return on;
}
