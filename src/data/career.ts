/**
 * The career trail, oldest first. Each chapter is a stretch of the climb: a cairn on the
 * mountain (cairn_<index>, see tools/models/layout.py CAIRNS: one each, oldest at the foot),
 * and (once it's built) a floating diorama you step into by clicking the cairn.
 * The roles inside come from LinkedIn (September 2026).
 *
 * To add a chapter's diorama: build it in tools/models/career/<id>.py (see the notes there),
 * set `scene: true`, and describe the things you can click in `things`, keyed by their ids in
 * the model. A chapter without a scene still has its card; the camera just stays on the island.
 */
export interface Milestone {
  years: string;
  role: string;
  org: string;
  text: string;
}

/** Something in a diorama that says something when clicked. */
export interface Thing {
  label: string;
  /** Several lines take turns, one per click. */
  text: string | string[];
  /** Glide in this close (2–6) to have a better look, e.g. at a screen. */
  zoom?: number;
  /** A blog post to offer to open afterwards. */
  read?: { slug: string; label: string };
}

export interface Chapter {
  /** Also the model: public/models/career-<id>.glb */
  id: string;
  /** What the stretch is called on the mountain, e.g. on its cairns. */
  era: string;
  years: string;
  title: string;
  where: string;
  /** The story of this stretch, in a few sentences. */
  text: string;
  roles: Milestone[];
  /** Whether the diorama has been built yet. */
  scene?: boolean;
  things?: Record<string, Thing>;
}

export const chapters: Chapter[] = [
  {
    id: 'student',
    era: 'The student years',
    years: '2007 – 2014',
    title: 'Artificial intelligence, before it was cool',
    where: 'Utrecht · Arnhem · Velp',
    text: 'I studied in Utrecht, informatics and then computing science, with as much artificial intelligence as I could fit in, at a time when it wasn’t at all obvious that neural networks would ever be good for much. Right after I finished, DeepMind and OpenAI started showing what they could do. Alongside my studies I fixed computers all over Arnhem, built software for the care sector, and started a company.',
    scene: true,
    roles: [
      {
        years: '2007 – 2011',
        role: 'Bachelor, Informatics',
        org: 'Utrecht University',
        text: 'Mostly in the Minnaert building on the Uithof. Data mining, image processing, intelligent and computational systems, and a recommender system for music videos.',
      },
      {
        years: '2011 – 2014',
        role: 'Master, Computing Science: advanced planning and decision making',
        org: 'Utrecht University',
        text: 'Intelligent agents, multi-agent systems, evolutionary computing, probabilistic reasoning, scheduling and simulation. A thesis on vehicle routing with time-dependent travel times.',
      },
      {
        years: '2010 – 2011',
        role: 'Student',
        org: 'Studentaanhuis · Arnhem',
        text: 'Cycling through Arnhem to help people with their computers and whatever other technology was acting up.',
      },
      {
        years: '2011 – 2013',
        role: 'Web application developer',
        org: 'ZorgDigi · Velp',
        text: 'PHP, jQuery and MySQL for the care sector: an intranet covering HR, rosters and billing, a system that supports people in care, and an online auction house for art made in care institutions.',
      },
      {
        years: '2013 – 2014',
        role: 'Co-founder, head of technology',
        org: 'uniQ Development · Velp',
        text: 'A startup that built web and Android apps with a team of people on the autism spectrum, preparing them for the job market along the way. I led development and taught programming.',
      },
    ],
    things: {
      minnaert: {
        label: 'The Minnaert building · Utrecht',
        text: [
          'The Minnaert building on the Uithof: rust red, with ridges running across its walls like wind through grass. Most of my seven years in Utrecht happened in here: a bachelor’s in informatics, then a master’s in computing science.',
          'Intelligent agents, multi-agent systems, evolutionary computing, probabilistic reasoning: the master’s was called advanced planning and decision making, and it was AI through and through.',
          'Side quests: a recommender system for music videos, and a scheduler for the university’s own exams. The thesis was about routing vehicles when travel times change through the day, and it led straight to Backbone.',
        ],
      },
      laptop: {
        label: 'A laptop · OpenAI Gym',
        text: 'Lunar Lander in OpenAI Gym, learning to land by trial and a great deal of error. It crashes a lot, then a little less. This is where the lander in the workshop comes from.',
        zoom: 6,
        read: { slug: 'lunar-lander-dqn', label: 'Read how it learned' },
      },
      young_vincent: {
        label: 'Vincent, a few years younger',
        text: 'Still waiting for his lander to learn to land. It will. Eventually.',
      },
      noticeboard: {
        label: 'The notice board',
        text: [
          'A poster of Breakout: DeepMind’s DQN learned to play Atari games from nothing but the pixels. Neural networks, suddenly very much useful.',
          'A go board: AlphaGo beat Lee Sedol, years before anyone thought a computer could.',
          'A flyer for Andrew Ng’s Machine Learning course on Coursera. I took it in 2016.',
          'OpenAI Five, playing Dota 2 against the best teams in the world. For a while I hung around in OpenAI’s Slack, trying things in their Gym.',
        ],
      },
      studentaanhuis: {
        label: 'A bike with a computer on the rack · Studentaanhuis',
        text: 'Studentaanhuis: cycling all over Arnhem to fix people’s computers, and anything else with a plug that was misbehaving.',
      },
      zorgdigi: {
        label: 'ZorgDigi · rosters and a blue elephant',
        text: 'ZorgDigi: I built the back end in PHP (hence the elephant), next to an illustrator who made the WordPress sites. Among other things, a system for scheduling and paying the freelance carers, whose rota hangs by the door.',
      },
      uniq: {
        label: 'uniQ Development · Velp',
        text: 'uniQ Development: our own company, started with the illustrator and the two founders of ZorgDigi. We taught young people on the autism spectrum to program, and built websites and web services for local businesses together.',
      },
    },
  },
  {
    id: 'backbone',
    era: 'The Backbone years',
    years: '2013 – 2020',
    title: 'Routes, buses and trains',
    where: 'Amersfoort · Ruurlo · Lochem · Berlin',
    text: 'It started with a thesis on route planning and turned into seven years at Backbone Systems, designing software mostly for (public) transport: for Qbuzz, for Eijgenhuijsen, and a car-sharing service with Going Dutch. For half a year I lived in Berlin, building a dynamic planner for package deliveries from a startup workspace, the Rainmaking Loft. That was a lot of fun.',
    roles: [
      {
        years: '2013 – 2014',
        role: 'Master’s thesis',
        org: 'Utrecht University, at Backbone Systems',
        text: 'Software that plans routes for transport vehicles as a pickup-and-delivery problem: alternative times and places for every stop, travel times that change through the day, and thousands of orders at once.',
      },
      {
        years: '2014 – 2020',
        role: 'Solutions architect',
        org: 'Backbone Systems · Amersfoort and Berlin',
        text: 'Designed and built server, Android and web applications, mostly for (public) transport, to automate processes and show what the data says. Projects for Qbuzz and Eijgenhuijsen, and half a year in Berlin on a dynamic planner for package deliveries.',
      },
      {
        years: '2017 – 2020',
        role: 'Software engineer',
        org: 'Going Dutch Studio · Lochem (a Backbone project)',
        text: 'Mobile and server applications for a car-sharing service.',
      },
    ],
    scene: true,
    things: {
      ampsen: {
        label: 'Kasteel Ampsen · Lochem',
        text: 'Ampsen, near Lochem: “the castle”. Some weeks we worked from here, a short drive from Eijgenhuijsen in Ruurlo. Not a bad place to have your laptop open.',
      },
      eijgenhuijsen: {
        label: 'Eijgenhuijsen · Ruurlo',
        text: [
          'Eijgenhuijsen, precisievervoer, in Ruurlo. We sat right there with them, among the trucks.',
          'Tablets for the drivers, software for the warehouse, and a planner that works out the routes.',
        ],
      },
      qbuzz: {
        label: 'A streekBuzz bus · Qbuzz',
        text: [
          'For Qbuzz I worked on what’s inside the bus: the displays the passengers read, and the systems on board that drive them.',
          'All of it had to be updated and tracked remotely, across the whole fleet. What the buses report then feeds the planning and the real-time verkeersleiding.',
        ],
      },
      verkeersleiding: {
        label: 'The verkeersleiding',
        text: 'Where the whole fleet comes together: every vehicle on the map, where it is right now. Watch the dots go round with the bus and the truck.',
        zoom: 4,
      },
      goingdutch: {
        label: 'Two shared cars · Going Dutch',
        text: 'Going Dutch: shared cars you open with your OV-chipkaart or your phone, and that we could follow wherever they went. I built the apps and the servers behind them.',
      },
      vincent: {
        label: 'Vincent, solutions architect',
        text: 'Explaining, again, what all the little dots mean. It started with a thesis on planning routes and turned into seven years of things that drive around.',
      },
      berlin: {
        label: 'The Fernsehturm · Berlin',
        text: 'For half a year I lived in Berlin, building a dynamic planner for package deliveries from the Rainmaking Loft, a startup workspace. That was a lot of fun.',
      },
    },
  },
  {
    id: 'entrnce',
    era: 'The energy years',
    years: '2020 – now',
    title: 'Trading power',
    where: 'Arnhem',
    text: 'Software for the energy market at ENTRNCE. First I was a developer on the ENTRNCE Trader, for peer-to-peer energy trading between individual grid connections, and now I lead development of Direct+, which gives smaller parties direct access to the wholesale power exchange.',
    roles: [
      {
        years: '2020 – now',
        role: 'Lead developer',
        org: 'ENTRNCE · Arnhem',
        text: 'Technical direction and architecture for Direct+, built with EPEX SPOT so smaller parties can trade directly on the wholesale power market. A modular monolith in Kotlin, Spring Boot, PostgreSQL and React. I also help shape how our teams build with AI. Before that I was a developer on the ENTRNCE Trader, for peer-to-peer energy trading between individual grid connections.',
      },
    ],
  },
];

/** Every role, oldest first (for the plain page). */
export const career: Milestone[] = chapters.flatMap((c) => c.roles);
