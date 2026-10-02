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

export interface CommissionsCopy {
  title: string;
  description: string;
  heading: string;
  lede: string[];
  offersHeading: string;
  offers: Offer[];
  examplesHeading: string;
  examples: { label: string; href: string; text: string; more?: { label: string; href: string } }[];
  howHeading: string;
  how: string[];
  /** the hourly rate's name in the structured data */
  rateName: string;
  /** only what the page doesn't say above; the cost answer is the one place it gives a price */
  faqHeading: string;
  faq: { q: string; a: string }[];
  contactHeading: string;
  contact: string;
  /** the photo beside the contact details */
  photoAlt: string;
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
      'I’m a freelance creative developer and software architect, and I’d like to spend more of my time making things like this island for other people. Through my company, Bons AI, I make interactive websites, digital experiences, 3D and VR, AI tools, software and small games.',
      'I like it best when an idea is a little unusual: a story people walk around in instead of read, a site with something hidden in it, a tool nobody has made yet.',
    ],
    offersHeading: 'What I make',
    offers: [
      {
        id: 'web',
        name: 'Interactive websites',
        text: 'Playful sites that are fun to look around. This island is one. Think of a portfolio you wander through, a map of your town that changes with the seasons, or a shop window that’s a small world of its own. Underneath the 3D, all of the content is plain text, so search engines and screen readers can read it too. Simpler sites, without the 3D, I make as well.',
      },
      {
        id: 'experiences',
        name: 'Digital experiences',
        text: 'Something to explore or play, for a launch, an exhibition, a campaign or a story you want to tell: a treasure hunt through a building, a game on a big screen at a fair, a story you click your way through. In the browser, on a phone or on a big screen.',
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
        text: 'Tools and experiments with language and image models: an assistant that answers from your own documents, a story that writes itself as you play, a way through a pile of work nobody wants to do by hand. That can be a prototype to see whether an idea holds up, or something that runs in production. I’ve built a generator for complete Magic: The Gathering sets and an AI opponent for a Magic engine, among other things.',
      },
      {
        id: 'apps',
        name: 'Software architecture and applications',
        text: 'Software architecture is my day job: I design the systems behind a platform for trading on the power market. I can do the same for you, from a first sketch to an application running in production, or take a careful look at a system you already have. I like it best when there’s something creative or unusual about it.',
      },
      {
        id: 'games',
        name: 'Games',
        text: 'Small games and prototypes, made for you or with you: a mini-game for a campaign, a game for a museum, or a first playable version of an idea you’ve been carrying around. And if you’re making a game and our taste overlaps, I’d love to team up.',
      },
    ],
    examplesHeading: 'Things I’ve made',
    examples: [
      { label: 'This island', href: '/', text: 'a pixel-art 3D world with a kayak game, seasons and the real weather' },
      { label: 'Argentum', href: 'https://magic.wingedsheep.com/', text: 'a Magic: The Gathering rules engine and game client that I worked on with others. It’s roughly 2,600 hours of work so far, which without AI would have taken a team years', more: { label: 'how it was built', href: '/blog/building-argentum-a-magic-the-gathering-rules-engine/' } },
      { label: 'Talespinner', href: 'https://talespinner.io/', text: 'interactive stories spun with AI, that grow as you play' },
      { label: 'The blog', href: '/blog/', text: 'what I’ve learned along the way' },
    ],
    howHeading: 'How it works',
    how: [
      'We start with a conversation about what you have in mind. Then I estimate a budget, and we agree on when we look at the work together along the way.',
      'You get one person doing the design, the 3D, the code and the sound. I work four days a week and the fifth is for commissions, so plan for weeks for a small project and months for a big one. That day goes further than it sounds: I build fast, with tools I’ve made for it, like the ones behind this island.',
      'I use AI throughout my work, as you might have guessed from this island. It’s a big part of why I’m fast. So if you’d rather keep AI well away from your project, I’m not the one to hire.',
      'I work from the Arnhem–Nijmegen area, for clients in the Netherlands and abroad, in Dutch or English. Remote works fine.',
    ],
    rateName: 'Hourly rate, for smaller jobs, changes and upkeep',
    faqHeading: 'Questions',
    faq: [
      { q: 'What does it cost?', a: `Smaller jobs, changes and upkeep go at €${RATE} an hour. To give you an idea of a project: I’d estimate a house to walk through in VR, like the one above, at around €2,500. Bigger projects, like a game or a virtual experience, I estimate first, once we’ve talked through what you want. All excluding VAT.` },
      { q: 'When can you start?', a: 'That depends on what I’m working on at the time. Send me an email and I’ll tell you.' },
    ],
    contactHeading: 'Get in touch',
    contact: 'Tell me what you’d like to make, and roughly when. We can start with an email, a short call, or a cup of coffee.',
    photoAlt: 'Vincent with a cup of coffee, in the sun',
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
      'Ik ben freelance creative developer en softwarearchitect, en ik zou graag meer van mijn tijd besteden aan dingen zoals dit eiland, maar dan voor anderen. Via mijn bedrijf, Bons AI, maak ik interactieve websites, digitale ervaringen, 3D en VR, AI-tools, software en kleine games.',
      'Het liefst als een idee een beetje ongewoon is: een verhaal waar je doorheen loopt in plaats van het te lezen, een site waar iets in verstopt zit, een tool die nog niemand heeft gemaakt.',
    ],
    offersHeading: 'Wat ik maak',
    offers: [
      {
        id: 'web',
        name: 'Interactieve websites',
        text: 'Speelse sites waar je graag rondkijkt. Dit eiland is er een. Denk aan een portfolio waar je doorheen dwaalt, een kaart van je stad die meegaat met de seizoenen, of een etalage die een kleine wereld op zich is. Onder de 3D staat alle inhoud gewoon als tekst, zodat zoekmachines en schermlezers hem ook kunnen lezen. Eenvoudigere sites, zonder de 3D, maak ik ook.',
      },
      {
        id: 'experiences',
        name: 'Digitale ervaringen',
        text: 'Iets om te ontdekken of te spelen, voor een lancering, een tentoonstelling, een campagne of een verhaal dat je wilt vertellen: een speurtocht door een gebouw, een spel op een groot scherm op een beurs, een verhaal waar je doorheen klikt. In de browser, op een telefoon of op een groot scherm.',
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
        text: 'Tools en experimenten met taal- en beeldmodellen: een assistent die antwoord geeft uit je eigen documenten, een verhaal dat zichzelf schrijft terwijl je speelt, een manier door een stapel werk die niemand met de hand wil doen. Dat kan een prototype zijn om te kijken of een idee werkt, of iets dat in productie draait. Ik bouwde onder meer een generator voor complete sets van Magic: The Gathering en een AI-tegenstander voor een Magic-engine.',
      },
      {
        id: 'apps',
        name: 'Softwarearchitectuur en applicaties',
        text: 'Softwarearchitectuur is mijn dagelijkse werk: ik ontwerp de systemen achter een platform voor handel op de stroommarkt. Dat kan ik ook voor jou doen, van een eerste schets tot een applicatie die in productie draait, of ik kijk kritisch naar een systeem dat je al hebt. Het liefst als er iets creatiefs of ongewoons aan zit.',
      },
      {
        id: 'games',
        name: 'Games',
        text: 'Kleine games en prototypes, voor jou of samen met jou: een minigame voor een campagne, een spel voor een museum, of een eerste speelbare versie van een idee dat je al een tijd met je meedraagt. En werk je aan een game en hebben we dezelfde smaak? Dan doe ik graag mee.',
      },
    ],
    examplesHeading: 'Wat ik heb gemaakt',
    examples: [
      { label: 'Dit eiland', href: '/', text: 'een 3D-wereld in pixelart, met een kajakspel, seizoenen en het echte weer' },
      { label: 'Argentum', href: 'https://magic.wingedsheep.com/', text: 'een regelengine en spelclient voor Magic: The Gathering, waar ik met anderen aan werkte. Het is tot nu toe zo’n 2.600 uur werk, waar een team zonder AI jaren over had gedaan', more: { label: 'hoe het gebouwd is (Engelstalig)', href: '/blog/building-argentum-a-magic-the-gathering-rules-engine/' } },
      { label: 'Talespinner', href: 'https://talespinner.io/', text: 'interactieve verhalen, gesponnen met AI, die groeien terwijl je speelt' },
      { label: 'De blog', href: '/blog/', text: 'wat ik onderweg leer (Engelstalig)' },
    ],
    howHeading: 'Hoe het werkt',
    how: [
      'We beginnen met een gesprek over wat je voor ogen hebt. Daarna schat ik een budget in, en spreken we af wanneer we tussendoor samen naar het werk kijken.',
      'Je krijgt één persoon die het ontwerp, de 3D, de code en het geluid doet. Ik werk vier dagen per week en de vijfde is voor opdrachten, dus reken op weken voor een klein project en maanden voor een groot. Daar kan meer in dan je denkt: ik bouw snel, met gereedschap dat ik er zelf voor heb gemaakt, zoals dat achter dit eiland.',
      'Ik gebruik AI in alles wat ik maak, zoals je op dit eiland misschien al zag. Het is een groot deel van waarom ik snel ben. Wil je liever geen AI in de buurt van je project, dan ben ik niet de juiste keuze.',
      'Ik werk vanuit de regio Arnhem-Nijmegen, voor opdrachtgevers in Nederland en daarbuiten, in het Nederlands of Engels. Op afstand kan prima.',
    ],
    rateName: 'Uurtarief, voor kleinere klussen, aanpassingen en onderhoud',
    faqHeading: 'Vragen',
    faq: [
      { q: 'Wat kost het?', a: `Kleinere klussen, aanpassingen en onderhoud gaan tegen €${RATE} per uur. Om je een idee te geven van een project: een huis om in VR doorheen te lopen, zoals het huis hierboven, schat ik op zo’n €2.500. Grotere projecten, zoals een game of een virtuele ervaring, schat ik eerst in, als we hebben doorgesproken wat je wilt. Alles exclusief btw.` },
      { q: 'Wanneer kun je beginnen?', a: 'Dat hangt af van waar ik op dat moment aan werk. Stuur me een mail, dan laat ik het je weten.' },
    ],
    contactHeading: 'Neem contact op',
    contact: 'Vertel wat je wilt maken, en ongeveer wanneer. We kunnen beginnen met een mail, een kort gesprek, of een kop koffie.',
    photoAlt: 'Vincent met een kop koffie, in de zon',
    mailButton: 'Stuur me een mail',
    noscriptMail: 'vincentbons89 (apenstaartje) gmail (punt) com',
    elsewhere: 'Of vind me op',
    registration: 'Bons AI · KvK-nummer',
    back: '← terug naar het eiland',
    otherLanguage: 'English',
  },
};
