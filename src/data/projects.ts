export interface Project {
  /** Matches the exhibit in the workshop yard ("project_<id>" in tools/models/workshop.py). */
  id: string;
  name: string;
  /** What the exhibit is, for the tooltip. */
  thing: string;
  href: string;
  source?: string; // GitHub repository
  blurb: string;
  post?: string; // slug of the blog post that tells the story
  tags: string[]; // the first is stamped on its card
  color: string; // the stripe down its card
}

const gh = (repo: string) => `https://github.com/wingedsheep/${repo}`;

export const projects: Project[] = [
  {
    id: 'argentum',
    name: 'Argentum',
    thing: 'a silver card engine',
    href: 'https://magic.wingedsheep.com/',
    source: gh('argentum-engine'),
    blurb: 'A Magic: The Gathering rules engine and game client. Play full games against friends or an AI opponent.',
    post: 'building-argentum-a-magic-the-gathering-rules-engine',
    tags: ['Kotlin', 'Game engine', 'MTG'],
    color: '#8c2f39',
  },
  {
    id: 'talespinner',
    name: 'Talespinner',
    thing: 'a quill that writes by itself',
    href: 'https://talespinner.io/',
    blurb: 'Stories spun together with AI: interactive tales that grow as you play.',
    tags: ['AI', 'Storytelling'],
    color: '#b5562d',
  },
  {
    id: 'mana',
    name: 'Mana from the Machine',
    thing: 'a printing press',
    href: '/blog/mana-from-the-machine/',
    source: gh('mtg-card-generator'),
    blurb: 'An AI-powered generator for complete, playable Magic: The Gathering sets, art and all.',
    post: 'mana-from-the-machine',
    tags: ['LLMs', 'Image generation', 'MTG'],
    color: '#6b3f8c',
  },
  {
    id: 'carcassonne',
    name: 'Carcassonne',
    thing: 'a game in progress',
    href: gh('carcassonne'),
    blurb: 'The board game Carcassonne in Python, built to be an environment for reinforcement learning. Later rebuilt in Kotlin.',
    post: 'programming-carcassonne',
    tags: ['Python', 'Kotlin', 'Board games'],
    color: '#3d7a4a',
  },
  {
    id: 'transformer',
    name: 'Transformer',
    thing: 'a network of glass nodes',
    href: gh('transformer'),
    blurb: 'A text generation model built from scratch on the transformer architecture, one attention head at a time.',
    post: 'building-a-language-model',
    tags: ['PyTorch', 'LLMs'],
    color: '#2f5d8c',
  },
  {
    id: 'music',
    name: 'Music Generation Toolbox',
    thing: 'a gramophone',
    href: gh('music-generation-toolbox'),
    blurb: 'A toolbox for generating music with transformers. It helped write our song for the AI Song Contest 2021.',
    post: 'music-generation-creating-a-song-for-the-ai-song-contest-2021',
    tags: ['Python', 'Music', 'Transformers'],
    color: '#c9a23f',
  },
  {
    id: 'lander',
    name: 'Lunar Lander',
    thing: 'a lunar lander, still practising',
    href: '/blog/lunar-lander-dqn/',
    blurb: 'Teaching an agent to land softly on the moon with deep Q-learning, in the OpenAI Gym LunarLander environment.',
    post: 'lunar-lander-dqn',
    tags: ['Keras', 'Reinforcement learning'],
    color: '#23384f',
  },
  {
    id: 'lazyhttp',
    name: 'lazyhttp',
    thing: 'a terminal by the hammock',
    href: gh('lazyhttp'),
    blurb: 'A terminal UI for running .http test plans step by step, like lazygit for your HTTP requests.',
    tags: ['Go', 'TUI', 'Developer tools'],
    color: '#5a5264',
  },
];
