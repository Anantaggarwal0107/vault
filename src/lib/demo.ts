import type { Item } from './types';

/** Ids of sample items start with this, so they're easy to spot and remove. */
export const DEMO_PREFIX = 'demo-';

export function isDemo(item: Item): boolean {
  return item.id.startsWith(DEMO_PREFIX);
}

const CREATORS = [
  'slowcooked.kitchen', 'tinyapartmentplants', 'cityrunsclub', 'filmgrain.daily', 'the.budget.traveller',
  'desk.setups', 'grandmas.recipes', 'sketchbook.hour', 'morningstretch', 'retro.arcade.finds',
  'bookstack.weekly', 'catsofthecorner', 'streetfood.diaries', 'quiet.cabins', 'homebarista',
  'learn.a.chord', 'thriftflip.studio', 'mountain.mornings', 'tiny.tattoos', 'weeknight.dinners',
];

const TWEETS = [
  'The best productivity tip I ever got: write tomorrow\'s to-do list before you close the laptop. #productivity',
  'Reminder that "done" beats "perfect" every single time.',
  'Thread on how I finally learned to cook rice properly 🍚 #cooking #lifehacks',
  'Hot take: the best camera is the one you actually carry. #photography',
  'If you only read one book this year, make it a weird one. #books',
  'Sunday plan: long walk, no phone, pancakes. #weekend',
  'Tiny habit that changed my mornings: a glass of water before coffee. #health',
  'Saving this for the next time I think I need to buy another notebook. #stationery',
  'This is the cleanest explanation of compound interest I\'ve seen. #money #finance',
  'Every city should have more benches. That\'s the tweet.',
  'Ask @maps_nerd about the best route, they\'re never wrong. #travel',
  'Small win: ran 5k without stopping for the first time. #running',
];

/** Deterministic pseudo-random so the sample looks the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function demoItems(): { instagram: Item[]; x: Item[] } {
  const r = rng(42);
  const now = Date.now();
  const span = 3 * 365 * 24 * 3600 * 1000;

  const instagram: Item[] = [];
  for (let i = 0; i < 360; i++) {
    // A few creators get saved much more often, like in real life.
    const c = CREATORS[Math.floor(Math.pow(r(), 1.8) * CREATORS.length)];
    const id = `${DEMO_PREFIX}ig${i}`;
    const kind = r() < 0.7 ? 'reel' : 'p';
    instagram.push({
      key: `instagram:${id}`,
      source: 'instagram',
      id,
      kind,
      url: `https://www.instagram.com/${c}/`,
      author: c,
      text: '',
      savedAt: Math.round(now - span * Math.pow(r(), 0.7)),
      order: i,
    });
  }

  const x: Item[] = [];
  for (let i = 0; i < 140; i++) {
    const id = `${DEMO_PREFIX}x${i}`;
    x.push({
      key: `x:${id}`,
      source: 'x',
      id,
      kind: 'tweet',
      url: 'https://x.com/',
      author: '',
      text: TWEETS[Math.floor(r() * TWEETS.length)],
      savedAt: Math.round(now - span * r()),
      order: i,
    });
  }
  return { instagram, x };
}
