/**
 * What the blog is about. Every post sits under one subject (its `shelf` in the frontmatter)
 * and its book in the library takes one of that subject's colours.
 */
export const SUBJECTS = {
  ai: { name: 'Artificial minds', colors: ['#2f5d8c', '#23384f', '#6b3f8c'] },
  games: { name: 'Games & tables', colors: ['#8c2f39', '#3d7a4a', '#b5562d'] },
  music: { name: 'Music', colors: ['#c9a23f', '#b27a48'] },
  craft: { name: 'Craft', colors: ['#5a5264', '#7f7688'] },
} as const;

export type Subject = keyof typeof SUBJECTS;

/** A small stable hash, so a post's book keeps its colour and size between builds. */
export function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const spineColor = (slug: string, subject: Subject) => {
  const colors = SUBJECTS[subject].colors;
  return colors[hash(slug) % colors.length];
};

/** Tags are matched case-insensitively ("AI Art" and "ai art" are the same shelf mark). */
export const tagKey = (tag: string) => tag.trim().toLowerCase();

/** The posts as the library's runtime sees them (embedded in the page as JSON). */
export interface BookInfo {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  subject: Subject;
  tags: string[]; // tag keys
}
