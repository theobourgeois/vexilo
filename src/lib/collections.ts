import type { ColorFamily } from '@/lib/flag-search-terms';

/**
 * Which flags belong to a collection. A flag must have every colour in `colors` (and with
 * `onlyColors`, no other colour family), and when `symbols` is set it must show at least one of
 * them: an emblem from the emblem library, a generated trait (FLAG_TRAITS keys) or a flag tag.
 */
export type CollectionCriteria = {
  colors?: ColorFamily[];
  onlyColors?: boolean;
  symbols?: { emblemTags?: string[]; traits?: string[]; tags?: string[] };
  /** Proposals and fiction normally sort after real flags; collections of them keep one order. */
  mixFiction?: boolean;
};

export type CollectionGroup = 'Colours' | 'Patterns' | 'Symbols' | 'Topics';

export type FlagCollection = {
  slug: string;
  title: string;
  /** Meta description and the intro under the heading. */
  description: string;
  group: CollectionGroup;
  criteria: CollectionCriteria;
};

export const COLLECTION_GROUPS: CollectionGroup[] = ['Colours', 'Patterns', 'Symbols', 'Topics'];

export const COLLECTIONS: FlagCollection[] = [
  {
    slug: 'red-and-white',
    title: 'Red and White Flags',
    description: 'Flags in just red and white, like those of Canada, Japan, Denmark and Switzerland, plus hundreds of cities, regions and historical banners.',
    group: 'Colours',
    criteria: { colors: ['red', 'white'], onlyColors: true },
  },
  {
    slug: 'blue-and-white',
    title: 'Blue and White Flags',
    description: 'Flags in just blue and white, like those of Greece, Finland, Israel and Scotland.',
    group: 'Colours',
    criteria: { colors: ['blue', 'white'], onlyColors: true },
  },
  {
    slug: 'red-white-and-blue',
    title: 'Red, White and Blue Flags',
    description: 'The most common colours on national flags. The United States, France, the Netherlands, Russia and Norway all fly red, white and blue.',
    group: 'Colours',
    criteria: { colors: ['red', 'white', 'blue'], onlyColors: true },
  },
  {
    slug: 'green-and-white',
    title: 'Green and White Flags',
    description: 'Flags in just green and white, like those of Nigeria and Pakistan.',
    group: 'Colours',
    criteria: { colors: ['green', 'white'], onlyColors: true },
  },
  {
    slug: 'red-and-yellow',
    title: 'Red and Yellow Flags',
    description: 'Flags in just red and gold, like those of Vietnam, Spain and Kyrgyzstan, along with many communist and royal banners.',
    group: 'Colours',
    criteria: { colors: ['red', 'yellow'], onlyColors: true },
  },
  {
    slug: 'blue-and-yellow',
    title: 'Blue and Yellow Flags',
    description: 'Flags in just blue and yellow, like those of Ukraine, Sweden, Kazakhstan and Barbados.',
    group: 'Colours',
    criteria: { colors: ['blue', 'yellow'], onlyColors: true },
  },
  {
    slug: 'black-red-and-gold',
    title: 'Black, Red and Gold Flags',
    description: 'Flags in black, red and gold, the colours of Germany, Belgium and Angola.',
    group: 'Colours',
    criteria: { colors: ['black', 'red', 'yellow'], onlyColors: true },
  },
  {
    slug: 'red-gold-and-green',
    title: 'Red, Gold and Green Flags',
    description: 'The Pan-African colours flown by Guinea, Mali and Senegal, along with Bolivia and Lithuania.',
    group: 'Colours',
    criteria: { colors: ['red', 'yellow', 'green'], onlyColors: true },
  },
  {
    slug: 'green-white-and-red',
    title: 'Green, White and Red Flags',
    description: 'Flags in green, white and red, like those of Italy, Mexico, Hungary, Bulgaria and Wales.',
    group: 'Colours',
    criteria: { colors: ['green', 'white', 'red'], onlyColors: true },
  },
  {
    slug: 'black-red-and-white',
    title: 'Black, Red and White Flags',
    description: 'Flags in black, red and white, from Yemen to cities, regions and movements.',
    group: 'Colours',
    criteria: { colors: ['black', 'red', 'white'], onlyColors: true },
  },
  {
    slug: 'pan-arab-colours',
    title: 'Pan-Arab Colour Flags',
    description: 'Black, white, green and red, the Pan-Arab colours of Palestine, Jordan, Kuwait and the United Arab Emirates.',
    group: 'Colours',
    criteria: { colors: ['black', 'white', 'green', 'red'], onlyColors: true },
  },
  {
    slug: 'all-red',
    title: 'All-Red Flags',
    description: 'Flags that are red and nothing else, from Soviet and revolutionary banners to historical and regional flags.',
    group: 'Colours',
    criteria: { colors: ['red'], onlyColors: true },
  },
  {
    slug: 'purple',
    title: 'Flags with Purple',
    description: 'Purple is almost absent from national flags, so most flags here are regional, community and fictional.',
    group: 'Colours',
    criteria: { colors: ['purple'] },
  },
  {
    slug: 'orange',
    title: 'Flags with Orange',
    description: "Flags with orange or saffron, like those of India, Ireland, Côte d'Ivoire, Niger and Sri Lanka.",
    group: 'Colours',
    criteria: { colors: ['orange'] },
  },
  {
    slug: 'pink',
    title: 'Flags with Pink',
    description: 'No national flag uses pink, so these are pride, regional, community and fictional flags.',
    group: 'Colours',
    criteria: { colors: ['pink'] },
  },
  {
    slug: 'nordic-cross',
    title: 'Nordic Cross Flags',
    description: 'The off-centre cross of Sweden, Norway, Finland and Iceland, and the regions and islands that borrowed it.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['nordic_cross'] } },
  },
  {
    slug: 'tricolour',
    title: 'Tricolour Flags',
    description: 'Three bands of colour, the design of France, Ireland, Mexico, Estonia and dozens more.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['tricolor'] } },
  },
  {
    slug: 'saltire',
    title: 'Saltire Flags',
    description: 'Flags with a diagonal X-shaped cross, like Scotland, Jamaica and Alabama.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['saltire'] } },
  },
  {
    slug: 'canton',
    title: 'Flags with a Canton',
    description: 'A canton is the upper corner by the flagpole, home to the stars of the United States, the cross of Greece and the Union Jack of Tuvalu.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['canton'] } },
  },
  {
    slug: 'triangle',
    title: 'Flags with a Triangle',
    description: 'Flags with a triangle or chevron, like those of the Czech Republic, the Philippines, Cuba and the Bahamas.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['triangle'] } },
  },
  {
    slug: 'coat-of-arms',
    title: 'Flags with a Coat of Arms',
    description: 'Flags that carry a coat of arms, from Spain and Portugal to provinces, cities and royal standards.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['coat_of_arms'], emblemTags: ['coat of arms'] } },
  },
  {
    slug: 'text',
    title: 'Flags with Writing',
    description: 'Flags with mottos, names, scripture and slogans written on them.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['text'] } },
  },
  {
    slug: 'map',
    title: 'Flags with a Map',
    description: 'Cyprus and Kosovo put their country on their flag. These flags draw a map too.',
    group: 'Patterns',
    criteria: { symbols: { traits: ['map'], emblemTags: ['map'] } },
  },
  {
    slug: 'stars',
    title: 'Flags with Stars',
    description: 'Flags with stars, from the fifty stars of the United States to the Southern Cross of Australia and New Zealand.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['star'], traits: ['star'] } },
  },
  {
    slug: 'sun',
    title: 'Flags with a Sun',
    description: 'Flags with a sun, like those of Argentina, Uruguay, Kazakhstan, Kyrgyzstan and the Philippines.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['sun'], traits: ['sun'] } },
  },
  {
    slug: 'crescent',
    title: 'Flags with a Crescent Moon',
    description: 'Flags with a crescent, like those of Turkey, Pakistan, Algeria, Tunisia, Malaysia and Singapore.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['crescent'], traits: ['moon'] } },
  },
  {
    slug: 'eagle',
    title: 'Flags with an Eagle',
    description: 'Flags with an eagle, like those of Mexico, Albania, Egypt, Kazakhstan and Serbia.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['eagle', 'double-headed eagle'] } },
  },
  {
    slug: 'lion',
    title: 'Flags with a Lion',
    description: 'Flags with a lion, like those of Sri Lanka, Flanders, Spain and Montenegro.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['lion'] } },
  },
  {
    slug: 'dragon',
    title: 'Flags with a Dragon',
    description: 'Flags with a dragon, like those of Wales and Bhutan and the Yellow Dragon Flag of Qing China.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['dragon'] } },
  },
  {
    slug: 'bird',
    title: 'Flags with a Bird',
    description: 'Flags with birds, from the parrot of Dominica and the crane of Uganda to the bird of paradise on Papua New Guinea.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['bird'] } },
  },
  {
    slug: 'crown',
    title: 'Flags with a Crown',
    description: 'Flags with a crown, from royal standards and old kingdoms to provinces and cities.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['crown'], traits: ['crown'] } },
  },
  {
    slug: 'cross',
    title: 'Flags with a Cross',
    description: 'Flags with a cross, like those of Switzerland, Georgia, Greece and the Nordic countries.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['cross'], traits: ['cross'] } },
  },
  {
    slug: 'tree',
    title: 'Flags with a Tree',
    description: 'Flags with a tree, like the cedar of Lebanon and the mahogany of Belize.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['tree'] } },
  },
  {
    slug: 'ship',
    title: 'Flags with a Ship or Anchor',
    description: 'Flags with ships, boats and anchors, mostly from port cities, islands and navies.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['ship', 'anchor'], traits: ['ship'] } },
  },
  {
    slug: 'sword',
    title: 'Flags with a Sword',
    description: 'Flags with a sword, like those of Sri Lanka, Angola and Oman.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['sword'] } },
  },
  {
    slug: 'fleur-de-lis',
    title: 'Flags with a Fleur-de-lis',
    description: 'Flags with the French lily, like those of Quebec, Florence and Bosnia and Herzegovina.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['fleur-de-lis'] } },
  },
  {
    slug: 'castle',
    title: 'Flags with a Castle or Tower',
    description: 'Flags with castles, towers and city walls, mostly from cities and regions.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['castle', 'tower'] } },
  },
  {
    slug: 'bear',
    title: 'Flags with a Bear',
    description: 'Flags with a bear, like those of California, Berlin and Bern.',
    group: 'Symbols',
    criteria: { symbols: { emblemTags: ['bear'] } },
  },
  {
    slug: 'communist',
    title: 'Communist Flags',
    description: 'Red banners, stars, hammers and sickles: the flags of the Soviet Union, socialist states and communist parties.',
    group: 'Topics',
    criteria: { symbols: { tags: ['communist', 'hammer and sickle'], emblemTags: ['communist', 'hammer and sickle'] } },
  },
  {
    slug: 'military',
    title: 'Military and War Flags',
    description: 'War flags, military flags and the banners of armies, navies and armed groups.',
    group: 'Topics',
    criteria: { symbols: { tags: ['military', 'military flag', 'war flag'] } },
  },
  {
    slug: 'dutch-municipalities',
    title: 'Dutch Municipal Flags',
    description: 'The flags of municipalities across the Netherlands, past and present.',
    group: 'Topics',
    criteria: { symbols: { tags: ['netherlands municipality'] } },
  },
  {
    slug: 'indigenous',
    title: 'Indigenous Flags',
    description: 'Flags of Indigenous peoples and nations around the world.',
    group: 'Topics',
    criteria: { symbols: { tags: ['indigenous'] } },
  },
  {
    slug: 'micronations',
    title: 'Micronation Flags',
    description: 'Flags of micronations, the self-declared countries no one else recognises.',
    group: 'Topics',
    criteria: { symbols: { tags: ['micronation'] }, mixFiction: true },
  },
  {
    slug: 'hearts-of-iron',
    title: 'Hearts of Iron IV Mod Flags',
    description: 'Flags from Hearts of Iron IV and alternate-history mods like The New Order and The Fire Rises.',
    group: 'Topics',
    criteria: { symbols: { tags: ['hoi4', 'tno', 'tfr'] }, mixFiction: true },
  },
  {
    slug: 'fictional',
    title: 'Fictional Flags',
    description: 'Flags from books, films, TV and games, from Arstotzka to Petoria.',
    group: 'Topics',
    criteria: { symbols: { tags: ['fictional'] }, mixFiction: true },
  },
];

const BY_SLUG = new Map(COLLECTIONS.map((collection) => [collection.slug, collection]));

export function getCollection(slug: string) {
  return BY_SLUG.get(slug);
}

export const collectionPath = (slug: string) => `/flags/${slug}`;

/** The colour collection made of exactly these colour families, if there is one. */
export function getColourCollection(families: string[]) {
  const set = new Set(families);
  return COLLECTIONS.find(
    ({ criteria }) =>
      criteria.onlyColors &&
      criteria.colors?.length === set.size &&
      criteria.colors.every((color) => set.has(color)),
  );
}
