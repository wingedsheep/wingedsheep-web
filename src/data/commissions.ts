// The commissions page, in English (/commissions/) and Dutch (/nl/opdrachten/). Both render
// through src/components/Commissions.astro; keep the two in step when one changes.

export type Lang = 'en' | 'nl';

export const RATE = 100; // euros an hour, excluding VAT

export const KVK = '91727286'; // Bons AI in the Dutch business register (Handelsregister)

export const COMMISSION_PATHS: Record<Lang, string> = { en: '/commissions/', nl: '/nl/opdrachten/' };

interface Offer {
  id: string;
  name: string;
  text: string;
  /** a short film under the text, from public/work/ (cut by tools/video/house.py) */
  film?: { src: string; poster: string; label: string };
}

/** a budget for a kind of project, in euros excluding VAT: a range, or `from` alone for "from €…" */
interface Indication {
  what: string;
  from: number;
  to?: number;
}

export interface CommissionsCopy {
  title: string;
  description: string;
  heading: string;
  lede: string[];
  offersHeading: string;
  offers: Offer[];
  howHeading: string;
  how: string[];
  rateHeading: string;
  /** after the amount: '€100 an hour' */
  rate: string;
  rateNote: string;
  indicationsLede: string;
  indications: Indication[];
  /** before an open-ended budget: 'from €40,000' */
  fromWord: string;
  indicationsFoot: string[];
  /** asked the way people search; the answers keep to the table, so change them with it */
  faqHeading: string;
  faq: { q: string; a: string }[];
  examplesHeading: string;
  examples: { label: string; href: string; text: string }[];
  contactHeading: string;
  contact: string;
  mailButton: string;
  noscriptMail: string;
  elsewhere: string;
  /** the company line under the contact details; the KvK number goes after it */
  registration: string;
  back: string;
  otherLanguage: string;
}

export const COMMISSIONS: Record<Lang, CommissionsCopy> = {
  en: {
    title: 'Interactive websites, 3D, games and software architecture',
    description:
      'Vincent Bons (Bons AI), freelance creative developer and software architect in Arnhem–Nijmegen: interactive websites, 3D and VR, AI, games and applications.',
    heading: 'Commissioned work: websites, 3D, games, AI and software architecture',
    lede: [
      'I’m a freelance creative developer and software architect, and I’d like to spend more of my time making things like this island for other people. Through my company, Bons AI, I take on commissions: interactive websites, digital experiences, 3D and VR, AI, software architecture and applications, and small games.',
    ],
    offersHeading: 'What I make',
    offers: [
      {
        id: 'web',
        name: 'Interactive websites',
        text: 'Playful sites that are fun to look around. This island is one. Underneath the 3D, all of its content is plain text, so search engines and screen readers can read it too. Simpler sites, without the 3D, I make as well.',
      },
      {
        id: 'experiences',
        name: 'Digital experiences',
        text: 'Something to explore or play, for a launch, an exhibition, a campaign or a story you want to tell. In the browser, on a phone or on a big screen.',
      },
      {
        id: '3d',
        name: '3D',
        text: 'Worlds like this one, assets made to fit them, and buildings. Below is a house I modelled. You can walk through it in the browser or in VR, watch the sun move through it at any hour of any day, and compare the house as it is with a plan for rebuilding it, worked out with AI.',
        film: { src: '/work/house.mp4', poster: '/work/house.jpg', label: 'A walk round a house I modelled: from above, from day into night, the floor plans, and through the rooms and the garden.' },
      },
      {
        id: 'ai',
        name: 'AI',
        text: 'Tools and experiments with language and image models. That can be a prototype to see whether an idea holds up, or something that runs in production. I’ve built a generator for complete Magic: The Gathering sets and an AI opponent for a Magic engine, among other things.',
      },
      {
        id: 'apps',
        name: 'Software architecture and applications',
        text: 'Software architecture is my day job: I design the systems behind a platform for trading on the power market. I can do the same for you, from a first sketch to an application running in production, or take a careful look at a system you already have. I like it best when there’s something creative or unusual about it.',
      },
      {
        id: 'games',
        name: 'Games',
        text: 'Small games and prototypes, made for you or with you. And if you’re making a game and our taste overlaps, I’d love to team up.',
      },
    ],
    howHeading: 'How it works',
    how: [
      'I work four days a week. The fifth is for commissions. That goes further than it sounds: I build fast, with tools I’ve made for it, like the ones behind this island.',
      'I use AI throughout my work, as you might have guessed from this island. It’s a big part of why I’m fast. So if you’d rather keep AI well away from your project, I’m not the one to hire.',
      'We start with a conversation about what you have in mind. Then I estimate a budget, and we agree on when we look at the work together along the way.',
      'I work from the Arnhem–Nijmegen area, for clients in the Netherlands and abroad, in Dutch or English. Remote works fine.',
    ],
    rateHeading: 'Rate',
    rate: 'an hour',
    rateNote: 'excluding VAT',
    indicationsLede: 'That’s for smaller jobs, changes and upkeep. For a bigger project I estimate a budget once I know what you want. To give you a rough idea:',
    indications: [
      { what: 'A simpler website, without complex interactions', from: 1500, to: 3500 },
      { what: 'A small interactive site, a prototype, or an AI proof of concept', from: 4000, to: 12000 },
      { what: '3D assets for your site, world or game, each', from: 300, to: 1500 },
      { what: 'A building to walk through, like the house above', from: 2500, to: 7500 },
      { what: 'A small experience: a world to explore or a VR scene, with a handful of things to find or do', from: 5000, to: 20000 },
      { what: 'A big experience, like this island: a world, in VR or in the browser, full of detail, sound and secrets', from: 20000, to: 60000 },
      { what: 'A small browser game, from a mini-game around one idea to one with several levels, like the river', from: 5000, to: 20000 },
    ],
    fromWord: 'from',
    indicationsFoot: [
      'These are indications, not quotes, and all exclude VAT. What it really costs depends on what you want, so it’s settled when we’ve talked it through.',
      'With me you get one person doing the design, the 3D, the code and the sound.',
      'I have one day a week for commissions, so plan for weeks for a small project and months for a big one.',
      'For a game the range is rougher still, because games grow as you play them. And if you’d like to make one together instead of commissioning it, that works differently, so we’ll talk about it.',
    ],
    faqHeading: 'Questions',
    faq: [
      { q: 'What does a website cost?', a: 'A simpler website, without complex interactions, is roughly €1,500 to €3,500. An interactive site starts at about €4,000. These are indications, excluding VAT: what it really costs depends on what you want, and I estimate it once we’ve talked it through.' },
      { q: 'What does a 3D website or a VR experience cost?', a: 'A small experience, like a world to explore or a VR scene, is roughly €5,000 to €20,000. A big one, like this island, €20,000 to €60,000. These are indications, excluding VAT; the rest is in the table above.' },
      { q: 'What does a small game cost?', a: 'A small browser game is roughly €5,000 to €20,000, from a mini-game around one idea to one with several levels, like the river on this island. It’s an indication, excluding VAT: games vary more than anything else, so I estimate it once I know what you have in mind.' },
      { q: 'Can you help with software architecture?', a: `Yes. Software architecture is my day job: I design the systems behind a platform for trading on the power market. I can design a new system, review one you already have, or build the application. Advice and reviews go at the hourly rate of €${RATE}, excluding VAT; for building an application I estimate a budget.` },
      { q: 'Do you use AI?', a: 'Yes, throughout my work. It’s a big part of why I get a lot done in one day a week. If you’d rather keep AI away from your project, I’m not the right fit.' },
      { q: 'Where are you based?', a: 'In the Arnhem–Nijmegen area, in Gelderland. I work for clients across the Netherlands, and abroad remotely, in English.' },
      { q: 'When can you start?', a: 'That depends on what I’m working on at the time. Send me an email and I’ll tell you.' },
    ],
    examplesHeading: 'Things I’ve made',
    examples: [
      { label: 'This island', href: '/', text: 'a pixel-art 3D world with a kayak game, seasons and the real weather' },
      { label: 'Argentum', href: 'https://magic.wingedsheep.com/', text: 'a Magic: The Gathering rules engine and game client' },
      { label: 'Talespinner', href: 'https://talespinner.io/', text: 'interactive stories spun with AI, that grow as you play' },
      { label: 'The blog', href: '/blog/', text: 'what I’ve learned along the way' },
    ],
    contactHeading: 'Get in touch',
    contact: 'Tell me what you’d like to make, and roughly when, and I’ll send you a quote. Or we can start with a short call.',
    mailButton: 'Send me an email',
    noscriptMail: 'vincentbons89 (at) gmail (dot) com',
    elsewhere: 'Or find me on',
    registration: 'Bons AI · Dutch Chamber of Commerce (KvK) no.',
    back: '← back to the island',
    otherLanguage: 'Nederlands',
  },
  nl: {
    title: 'Interactieve website, 3D, game of software laten maken',
    description:
      'Vincent Bons (Bons AI), freelance creative developer en softwarearchitect in Arnhem-Nijmegen: interactieve websites, 3D en VR, AI, games en applicaties.',
    heading: 'Werk in opdracht: websites, 3D, games, AI en softwarearchitectuur',
    lede: [
      'Ik ben freelance creative developer en softwarearchitect, en ik zou graag meer van mijn tijd besteden aan dingen zoals dit eiland, maar dan voor anderen. Via mijn bedrijf, Bons AI, neem ik opdrachten aan: interactieve websites, digitale ervaringen, 3D en VR, AI, softwarearchitectuur en applicaties, en kleine games.',
    ],
    offersHeading: 'Wat ik maak',
    offers: [
      {
        id: 'web',
        name: 'Interactieve websites',
        text: 'Speelse sites waar je graag rondkijkt. Dit eiland is er een. Onder de 3D staat alle inhoud gewoon als tekst, zodat zoekmachines en schermlezers hem ook kunnen lezen. Eenvoudigere sites, zonder de 3D, maak ik ook.',
      },
      {
        id: 'experiences',
        name: 'Digitale ervaringen',
        text: 'Iets om te ontdekken of te spelen, voor een lancering, een tentoonstelling, een campagne of een verhaal dat je wilt vertellen. In de browser, op een telefoon of op een groot scherm.',
      },
      {
        id: '3d',
        name: '3D',
        text: 'Werelden zoals deze, assets die erin passen, en gebouwen. Hieronder staat een huis dat ik heb gemodelleerd. Je loopt erdoorheen in de browser of in VR, ziet de zon erdoor bewegen op elk uur van elke dag, en vergelijkt het huis zoals het is met een plan voor een verbouwing, uitgewerkt met AI.',
        film: { src: '/work/house.mp4', poster: '/work/house.jpg', label: 'Een rondje door een huis dat ik heb gemodelleerd: van boven, van dag naar nacht, de plattegronden, en door de kamers en de tuin.' },
      },
      {
        id: 'ai',
        name: 'AI',
        text: 'Tools en experimenten met taal- en beeldmodellen. Dat kan een prototype zijn om te kijken of een idee werkt, of iets dat in productie draait. Ik bouwde onder meer een generator voor complete sets van Magic: The Gathering en een AI-tegenstander voor een Magic-engine.',
      },
      {
        id: 'apps',
        name: 'Softwarearchitectuur en applicaties',
        text: 'Softwarearchitectuur is mijn dagelijkse werk: ik ontwerp de systemen achter een platform voor handel op de stroommarkt. Dat kan ik ook voor jou doen, van een eerste schets tot een applicatie die in productie draait, of ik kijk kritisch naar een systeem dat je al hebt. Het liefst als er iets creatiefs of ongewoons aan zit.',
      },
      {
        id: 'games',
        name: 'Games',
        text: 'Kleine games en prototypes, voor jou of samen met jou. En werk je aan een game en hebben we dezelfde smaak? Dan doe ik graag mee.',
      },
    ],
    howHeading: 'Hoe het werkt',
    how: [
      'Ik werk vier dagen per week. De vijfde is voor opdrachten. Daar kan meer in dan je denkt: ik bouw snel, met gereedschap dat ik er zelf voor heb gemaakt, zoals dat achter dit eiland.',
      'Ik gebruik AI in alles wat ik maak, zoals je op dit eiland misschien al zag. Het is een groot deel van waarom ik snel ben. Wil je liever geen AI in de buurt van je project, dan ben ik niet de juiste keuze.',
      'We beginnen met een gesprek over wat je voor ogen hebt. Daarna schat ik een budget in, en spreken we af wanneer we tussendoor samen naar het werk kijken.',
      'Ik werk vanuit de regio Arnhem-Nijmegen, voor opdrachtgevers in Nederland en daarbuiten, in het Nederlands of Engels. Op afstand kan prima.',
    ],
    rateHeading: 'Tarief',
    rate: 'per uur',
    rateNote: 'exclusief btw',
    indicationsLede: 'Dat is voor kleinere klussen, aanpassingen en onderhoud. Voor een groter project schat ik een budget in zodra ik weet wat je wilt. Om je een globaal idee te geven:',
    indications: [
      { what: 'Een eenvoudigere website, zonder complexe interacties', from: 1500, to: 3500 },
      { what: 'Een kleine interactieve site, een prototype of een AI-proof-of-concept', from: 4000, to: 12000 },
      { what: '3D-assets voor je site, wereld of game, per stuk', from: 300, to: 1500 },
      { what: 'Een gebouw om doorheen te lopen, zoals het huis hierboven', from: 2500, to: 7500 },
      { what: 'Een kleine ervaring: een wereld om te ontdekken of een VR-scène, met een handvol dingen om te vinden of te doen', from: 5000, to: 20000 },
      { what: 'Een grote ervaring, zoals dit eiland: een wereld, in VR of in de browser, vol details, geluid en geheimen', from: 20000, to: 60000 },
      { what: 'Een kleine browsergame, van een minigame rond één idee tot een game met meerdere levels, zoals de rivier', from: 5000, to: 20000 },
    ],
    fromWord: 'vanaf',
    indicationsFoot: [
      'Dit zijn indicaties, geen offertes, en allemaal exclusief btw. Wat het echt kost hangt af van wat je wilt, dus dat spreken we af als we het hebben doorgesproken.',
      'Bij mij krijg je één persoon die het ontwerp, de 3D, de code en het geluid doet.',
      'Ik heb één dag per week voor opdrachten, dus reken op weken voor een klein project en maanden voor een groot.',
      'Bij een game is de marge nog ruwer, want games groeien terwijl je ze speelt. En wil je er samen een maken in plaats van een opdracht te geven, dan werkt dat anders, dus daar praten we over.',
    ],
    faqHeading: 'Vragen',
    faq: [
      { q: 'Wat kost een website laten maken?', a: 'Een eenvoudigere website, zonder complexe interacties, kost ruwweg €1.500 tot €3.500. Een interactieve site begint rond €4.000. Dit zijn indicaties, exclusief btw: wat het echt kost hangt af van wat je wilt, en dat schat ik in als we het hebben doorgesproken.' },
      { q: 'Wat kost een 3D-website of een VR-ervaring?', a: 'Een kleine ervaring, zoals een wereld om te ontdekken of een VR-scène, kost ruwweg €5.000 tot €20.000. Een grote, zoals dit eiland, €20.000 tot €60.000. Dit zijn indicaties, exclusief btw; de rest staat in de tabel hierboven.' },
      { q: 'Wat kost een kleine game laten maken?', a: 'Een kleine browsergame kost ruwweg €5.000 tot €20.000, van een minigame rond één idee tot een game met meerdere levels, zoals de rivier op dit eiland. Het is een indicatie, exclusief btw: games verschillen meer dan wat ook, dus ik schat het in zodra ik weet wat je voor ogen hebt.' },
      { q: 'Kun je helpen met softwarearchitectuur?', a: `Ja. Softwarearchitectuur is mijn dagelijkse werk: ik ontwerp de systemen achter een platform voor handel op de stroommarkt. Ik kan een nieuw systeem ontwerpen, een bestaand systeem doorlichten, of de applicatie bouwen. Advies en reviews gaan tegen het uurtarief van €${RATE}, exclusief btw; voor het bouwen van een applicatie schat ik een budget in.` },
      { q: 'Gebruik je AI?', a: 'Ja, in alles wat ik maak. Het is een groot deel van waarom ik veel gedaan krijg in één dag per week. Wil je liever geen AI in je project, dan ben ik niet de juiste keuze.' },
      { q: 'Waar zit je?', a: 'In de regio Arnhem-Nijmegen, in Gelderland. Ik werk voor opdrachtgevers in heel Nederland, en op afstand ook in het buitenland, in het Engels.' },
      { q: 'Wanneer kun je beginnen?', a: 'Dat hangt af van waar ik op dat moment aan werk. Stuur me een mail, dan laat ik het je weten.' },
    ],
    examplesHeading: 'Wat ik heb gemaakt',
    examples: [
      { label: 'Dit eiland', href: '/', text: 'een 3D-wereld in pixelart, met een kajakspel, seizoenen en het echte weer' },
      { label: 'Argentum', href: 'https://magic.wingedsheep.com/', text: 'een regelengine en spelclient voor Magic: The Gathering' },
      { label: 'Talespinner', href: 'https://talespinner.io/', text: 'interactieve verhalen, gesponnen met AI, die groeien terwijl je speelt' },
      { label: 'De blog', href: '/blog/', text: 'wat ik onderweg leer (Engelstalig)' },
    ],
    contactHeading: 'Neem contact op',
    contact: 'Vertel wat je wilt maken, en ongeveer wanneer, dan stuur ik je een offerte. Of we beginnen met een kort gesprek.',
    mailButton: 'Stuur me een mail',
    noscriptMail: 'vincentbons89 (apenstaartje) gmail (punt) com',
    elsewhere: 'Of vind me op',
    registration: 'Bons AI · KvK-nummer',
    back: '← terug naar het eiland',
    otherLanguage: 'English',
  },
};
