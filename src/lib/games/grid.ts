import { COLOR_NAMES, COUNTRIES, REGION_NAMES, type Country, type Level, type Region } from './pool';

export type CriterionKind = 'color' | 'trait' | 'region' | 'shape';

export type Criterion = {
  id: string;
  label: string;
  /** A colour code for a swatch beside the label. */
  swatch?: string;
  kind: CriterionKind;
  /** What it's about, so a grid never asks for red and no red. */
  subject: string;
  test: (country: Country) => Level | false;
};

const TRAIT_LABELS: Record<string, string> = {
  st: 'Has a star',
  cr: 'Has a crescent',
  su: 'Has a sun',
  x: 'Has a cross',
  hs: 'Horizontal stripes',
  vs: 'Vertical stripes',
  tr: 'Has a triangle',
  dg: 'Diagonal design',
  ca: 'Coat of arms or seal',
  an: 'Has an animal',
  pl: 'Has a plant',
  wp: 'Has a weapon',
  tx: 'Has writing',
  ci: 'Has a circle',
  cn: 'Has a canton',
};

/** Symbols that make a flag more than stripes and shapes. */
const EMBLEMS = ['st', 'cr', 'su', 'ca', 'an', 'pl', 'wp', 'tx', 'ci', 'mp', 'ot', 'uj'];

const has = (levels: Record<string, Level>, code: string) => levels[code] ?? false;

function colorCount(country: Country) {
  const levels = Object.values(country.colors);
  const sure = levels.filter((l) => l === 'sure').length;
  return { sure, most: levels.length };
}

const criteria: Criterion[] = [
  ...['r', 'b', 'g', 'y', 'w', 'k', 'o'].map(
    (code): Criterion => ({
      id: `color:${code}`,
      label: `Has ${COLOR_NAMES[code].toLowerCase()}`,
      swatch: code,
      kind: 'color',
      subject: code,
      test: (c) => has(c.colors, code),
    }),
  ),
  ...['r', 'w', 'b'].map(
    (code): Criterion => ({
      id: `no:${code}`,
      label: `No ${COLOR_NAMES[code].toLowerCase()}`,
      swatch: code,
      kind: 'color',
      subject: code,
      test: (c) => (c.colors[code] === 'sure' ? false : c.colors[code] === 'maybe' ? 'maybe' : 'sure'),
    }),
  ),
  {
    id: 'colors:2',
    label: 'Exactly two colours',
    kind: 'color',
    subject: 'count',
    test: (c) => {
      const { sure, most } = colorCount(c);
      return sure === 2 && most === 2 ? 'sure' : sure <= 2 && most >= 2 ? 'maybe' : false;
    },
  },
  {
    id: 'colors:4',
    label: 'Four or more colours',
    kind: 'color',
    subject: 'count',
    test: (c) => {
      const { sure, most } = colorCount(c);
      return sure >= 4 ? 'sure' : most >= 4 ? 'maybe' : false;
    },
  },
  ...Object.entries(TRAIT_LABELS).map(
    ([code, label]): Criterion => ({
      id: `trait:${code}`,
      label,
      kind: 'trait',
      subject: code,
      test: (c) => has(c.traits, code),
    }),
  ),
  {
    id: 'plain',
    label: 'No emblems or symbols',
    kind: 'trait',
    subject: 'plain',
    test: (c) => {
      const found = EMBLEMS.map((code) => c.traits[code]).filter(Boolean);
      return found.length === 0 ? 'sure' : found.every((l) => l === 'maybe') ? 'maybe' : false;
    },
  },
  ...(Object.keys(REGION_NAMES) as Region[]).map(
    (region): Criterion => ({
      id: `region:${region}`,
      label: `In ${REGION_NAMES[region]}`,
      kind: 'region',
      subject: 'region',
      test: (c) => (c.regions.includes(region) ? 'sure' : false),
    }),
  ),
  {
    id: 'landlocked',
    label: 'Landlocked',
    kind: 'shape',
    subject: 'landlocked',
    test: (c) => (c.landlocked ? 'sure' : false),
  },
];

export const CRITERIA = new Map(criteria.map((c) => [c.id, c]));

export type GridSpec = { rows: string[]; cols: string[] };

/** Cells are numbered 0–8, row by row. */
export const cellCriteria = (grid: GridSpec, cell: number) => [
  CRITERIA.get(grid.rows[Math.floor(cell / 3)])!,
  CRITERIA.get(grid.cols[cell % 3])!,
];

/** Whether a guess fits a cell. Anything arguable is accepted. */
export function fitsCell(grid: GridSpec, cell: number, country: Country) {
  return cellCriteria(grid, cell).every((c) => c.test(country) !== false);
}

/** The countries that fit a cell; `sure` limits it to ones no one could argue with. */
export function cellAnswers(grid: GridSpec, cell: number, sure = false) {
  const [a, b] = cellCriteria(grid, cell);
  return COUNTRIES.filter((country) => {
    const x = a.test(country);
    const y = b.test(country);
    return sure ? x === 'sure' && y === 'sure' : x !== false && y !== false;
  });
}

/** Whether nine different countries can fill the grid at once. */
function canFill(answers: Country[][]) {
  const owner = new Map<string, number>();
  const tryCell = (cell: number, seen: Set<string>): boolean => {
    for (const country of answers[cell]) {
      if (seen.has(country.id)) continue;
      seen.add(country.id);
      const other = owner.get(country.id);
      if (other === undefined || tryCell(other, seen)) {
        owner.set(country.id, cell);
        return true;
      }
    }
    return false;
  };
  return answers.every((_, cell) => tryCell(cell, new Set()));
}

const KIND_WEIGHTS: [CriterionKind, number][] = [
  ['trait', 0.42],
  ['color', 0.3],
  ['region', 0.2],
  ['shape', 0.08],
];

function pickCriterion(random: () => number) {
  let roll = random();
  const kind = KIND_WEIGHTS.find(([, weight]) => (roll -= weight) < 0)?.[0] ?? 'trait';
  const options = criteria.filter((c) => c.kind === kind);
  return options[Math.floor(random() * options.length)];
}

/** Builds a fair grid: every cell has at least three answers anyone would agree with. */
export function generateGrid(random: () => number): GridSpec {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const picked: Criterion[] = [];
    while (picked.length < 6) {
      const next = pickCriterion(random);
      if (picked.some((c) => c.subject === next.subject)) continue;
      picked.push(next);
    }
    const rows = picked.slice(0, 3);
    const cols = picked.slice(3);
    // Mostly about the flags themselves, and no axis that's all colours.
    const colors = (axis: Criterion[]) => axis.filter((c) => c.kind === 'color').length;
    if (picked.filter((c) => c.kind === 'trait').length < 2 || colors(rows) > 2 || colors(cols) > 2) continue;

    const grid = { rows: rows.map((c) => c.id), cols: cols.map((c) => c.id) };
    const answers = Array.from({ length: 9 }, (_, cell) => cellAnswers(grid, cell, true));
    const sizes = answers.map((a) => a.length);
    if (Math.min(...sizes) < 3) continue;
    // Keep it from being a giveaway: most cells should take some thought.
    if (sizes.filter((n) => n >= 30).length > 3) continue;
    if (!canFill(answers)) continue;
    return grid;
  }
  throw new Error('Could not build a grid');
}
