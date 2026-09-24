export interface Project {
  name: string;
  href: string;
  blurb: string;
  post?: string; // slug of the blog post that tells the story
  tags: string[];
}

export const projects: Project[] = [
  {
    name: 'Argentum',
    href: 'https://magic.wingedsheep.com/',
    blurb: 'A Magic: The Gathering rules engine and game client. Play full games against friends or an AI opponent.',
    post: 'building-argentum-a-magic-the-gathering-rules-engine',
    tags: ['Kotlin', 'Game engine', 'MTG'],
  },
  {
    name: 'Talespinner',
    href: 'https://talespinner.io/',
    blurb: 'Stories spun together with AI: interactive tales that grow as you play.',
    tags: ['AI', 'Storytelling'],
  },
  {
    name: 'Mana from the Machine',
    href: '/blog/mana-from-the-machine/',
    blurb: 'An AI-powered generator for complete, playable Magic: The Gathering sets.',
    post: 'mana-from-the-machine',
    tags: ['LLMs', 'Image generation', 'MTG'],
  },
];
