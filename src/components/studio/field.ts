import type { DivisionKind, LayoutId, StoredStudioDesign, StudioDesign, StudioDivision, StudioField } from '@/lib/studio-design';
import { colorDistance, sameColor, uniqueColors } from './colors';
import { DIVISIONS, divisionColors, divisionParams } from './divisions';
import { defaultParams, LAYOUT_PRESETS, LAYOUTS } from './layouts';

export type StackField = Extract<StudioField, { kind: 'stack' }>;

type Draft = Omit<StudioDivision, 'id'>;

/** Gives divisions ids in order: d0, d1, …, so the same input always builds the same field. */
const stack = (color: string, divisions: Draft[]): StackField => ({
  kind: 'stack',
  color,
  divisions: divisions.map((division, i) => ({ id: `d${i}`, ...division })),
});

const div = (kind: DivisionKind, colors: string[], params: Record<string, number> = {}, extra?: Partial<Draft>): Draft => ({
  kind,
  colors,
  params,
  ...extra,
});

const stripeWeights = (weights: number[]) => Object.fromEntries(weights.map((w, i) => [`w${i}`, w]));

/** The first version's layouts, rebuilt as a stack that looks the same. */
export function layoutToStack(layout: LayoutId, params: Record<string, number>, colors: string[]): StackField {
  const p = defaultParams(layout, params);
  const c = LAYOUTS[layout].colors.map((fallback, i) => colors[i] ?? fallback);
  switch (layout) {
    case 'solid':
      return stack(c[0], []);
    case 'bicolor-h':
    case 'bicolor-v':
      return stack(c[0], [
        div(layout === 'bicolor-h' ? 'stripes-h' : 'stripes-v', [c[0], c[1]], { count: 2, ...stripeWeights([p.split, 1 - p.split]) }),
      ]);
    case 'triband-h':
    case 'triband-v': {
      const side = (1 - p.middle) / 2;
      return stack(c[0], [
        div(layout === 'triband-h' ? 'stripes-h' : 'stripes-v', [c[0], c[1], c[2]], { count: 3, ...stripeWeights([side, p.middle, side]) }),
      ]);
    }
    case 'stripes-h':
    case 'stripes-v':
      return stack(c[0], [div(layout, [c[0], c[1]], { count: Math.round(p.count) })]);
    case 'pentaband-h': {
      const top = (1 - p.middle) / 2;
      const inner = Math.min(p.inner, top);
      return stack(c[0], [
        div('stripes-h', [c[0], c[1], c[2], c[1], c[0]], { count: 5, ...stripeWeights([top - inner, inner, p.middle, inner, top - inner]) }),
      ]);
    }
    case 'cross':
      return stack(c[0], [div('cross', [c[1]], { width: p.width, x: 0.5, y: 0.5 })]);
    case 'nordic':
      return stack(c[0], [div('cross', [c[1]], { width: p.width, x: p.offset, y: 0.5 })]);
    case 'nordic-fimbriated':
      return stack(c[0], [div('cross', [c[2]], { width: p.width, x: p.offset, y: 0.5 }, { fimbriation: { color: c[1], width: p.border } })]);
    case 'saltire':
      return stack(c[0], [div('saltire', [c[1]], { width: p.width })]);
    case 'canton':
      return stack(c[0], [div('canton', [c[1]], { corner: 0, width: p.size, height: p.size })]);
    case 'border':
      return stack(c[1], [div('border', [c[0]], { width: p.width })]);
    case 'hoist-triangle':
      return stack(c[0], [div('stripes-h', [c[0], c[1]], { count: 2 }), div('triangle', [c[2]], { side: 0, depth: p.depth, base: 1 })]);
    case 'triband-triangle':
      return stack(c[0], [div('stripes-h', [c[0], c[1], c[2]], { count: 3 }), div('triangle', [c[3]], { side: 0, depth: p.depth, base: 1 })]);
    case 'diagonal':
      return stack(c[0], [div('per-bend', [c[1]], { corner: 2 })]);
    case 'diagonal-band':
      return stack(c[0], [div('per-bend', [c[2]], { corner: 2 }), div('bend', [c[1]], { width: p.width, flip: 0 })]);
    case 'quartered':
      return stack(c[0], [div('quarters', [c[0], c[1]], { x: 0.5, y: 0.5 })]);
    case 'stars-stripes':
      return stack(c[0], [
        div('stripes-h', [c[0], c[1]], { count: Math.round(p.count) }),
        div('canton', [c[2]], { corner: 0, width: p.width, height: p.height }),
      ]);
    case 'hoist-band':
      return stack(c[0], [div('stripes-h', [c[0], c[1], c[2]], { count: 3 }), div('canton', [c[3]], { corner: 0, width: p.width, height: 1 })]);
    case 'disc':
      return stack(c[0], [div('disc', [c[1]], { size: p.size, x: p.offset, y: 0.5 })]);
    case 'per-saltire':
      return stack(c[0], [div('per-saltire', [c[0], c[1]]), div('saltire', [c[2]], { width: p.width })]);
    case 'union':
      return stack(c[0], [
        div('saltire', [c[1]], { width: p.saltire }),
        div('saltire', [c[2]], { width: p.saltire / 3 }),
        div('cross', [c[2]], { width: p.width, x: 0.5, y: 0.5 }, { fimbriation: { color: c[1], width: p.width / 3 } }),
      ]);
  }
}

/** Opens any stored design in the current version. */
export function migrateDesign(design: StoredStudioDesign): StudioDesign {
  if (design.version === 2) return design;
  const { field } = design;
  return {
    ...design,
    version: 2,
    field: field.kind === 'image' ? field : layoutToStack(field.layout, field.params, field.colors),
  };
}

// —— Colours ——

/** Every colour the field shows, base first, each once. */
export function stackColors(field: StackField) {
  return uniqueColors([field.color, ...field.divisions.filter((d) => !d.hidden).flatMap(divisionColors)]);
}

/** Repaints every colour in a stack: its base, its divisions and their fimbriation. */
export function recolorStack(field: StackField, fn: (color: string) => string): StackField {
  return {
    ...field,
    color: fn(field.color),
    divisions: field.divisions.map((d) => ({
      ...d,
      colors: d.colors.map(fn),
      fimbriation: d.fimbriation ? { ...d.fimbriation, color: fn(d.fimbriation.color) } : d.fimbriation,
    })),
  };
}

/** Swaps one colour for another throughout a stack. */
export const swapStackColor = (field: StackField, from: string, to: string) =>
  recolorStack(field, (c) => (sameColor(c, from) ? to : c));

// —— Templates ——

export type FieldTemplate = {
  id: string;
  label: string;
  field: StackField;
  /** Flags built from parts keep their colours and proportions; layouts take the flag's colours. */
  own?: { ratio: [number, number] };
};

const LAYOUT_LABELS: Record<LayoutId, string> = {
  solid: 'Plain',
  'bicolor-h': 'Bicolour',
  'bicolor-v': 'Vertical bicolour',
  'triband-h': 'Triband',
  'triband-v': 'Vertical triband',
  'stripes-h': 'Stripes',
  cross: 'Cross',
  nordic: 'Nordic cross',
  'nordic-fimbriated': 'Bordered Nordic cross',
  saltire: 'Saltire',
  canton: 'Canton',
  border: 'Border',
  'hoist-triangle': 'Hoist triangle',
  'triband-triangle': 'Triband with triangle',
  diagonal: 'Diagonal',
  'diagonal-band': 'Diagonal band',
  quartered: 'Quartered',
  'stripes-v': 'Vertical stripes',
  'pentaband-h': 'Five bands',
  'stars-stripes': 'Stripes with canton',
  'hoist-band': 'Hoist band',
  disc: 'Disc',
  'per-saltire': 'Per saltire',
  union: 'Union',
};

export const LAYOUT_TEMPLATES: FieldTemplate[] = LAYOUT_PRESETS.map((preset, i) => ({
  id: `layout-${i}`,
  label: LAYOUT_LABELS[preset.layout],
  field: layoutToStack(preset.layout, defaultParams(preset.layout, preset.params), LAYOUTS[preset.layout].colors),
}));

/**
 * South Africa's Y: the green pall's white edges run from the corners, and the yellow-edged
 * black triangle sits parallel inside its arms.
 */
function southAfrica(): StackField {
  const [W, green, border] = [1.5, 0.2, 1 / 15];
  // The white edge runs from the corner to where it meets the horizontal arm.
  const [ex, ey] = [W * 0.4, 0.5 - green / 2 - border];
  const len = Math.hypot(ex, ey);
  const [ux, uy] = [ex / len, ey / len];
  const inset = (green / 2 + border) / ux;
  const edge = inset + (green / 2 + border) / ux;
  return stack('#E03C31', [
    div('stripes-h', ['#E03C31', '#001489'], { count: 2 }),
    div('pall', ['#007749'], { width: green, x: ((0.5 - inset) * ux) / uy / W, inset }, { fimbriation: { color: '#FFFFFF', width: border } }),
    div('triangle', ['#000000'], { side: 0, depth: ((0.5 - edge) * ux) / uy / W, base: 1 - 2 * edge }, { fimbriation: { color: '#FFB612', width: border } }),
  ]);
}

/** Seychelles' rays fan from the lower hoist corner to the points where its colours meet the edges. */
const SEYCHELLES = [33.69, 19.44, 18.43, 8.97, 9.46];

/** North Macedonia's sun: eight rays toward the corners and edges, red between. */
function macedonia() {
  const centres = [0, 26.57, 90, 153.43, 180, 206.57, 270, 333.43];
  const ray = 14;
  const weights = centres.flatMap((at, i) => {
    const next = i === centres.length - 1 ? centres[0] + 360 : centres[i + 1];
    return [ray, next - at - ray];
  });
  return stack('#D20000', [
    div('rays', ['#FFE600', '#D20000'], { count: 16, rotation: -ray / 2, sweep: 360, x: 0.5, y: 0.5, ...stripeWeights(weights) }),
    div('disc', ['#FFE600'], { size: 0.29, x: 0.5, y: 0.5 }, { fimbriation: { color: '#D20000', width: 0.028 } }),
  ]);
}

export const PART_TEMPLATES: FieldTemplate[] = [
  { id: 'south-africa', label: 'Pall with triangle', own: { ratio: [2, 3] }, field: southAfrica() },
  {
    id: 'seychelles',
    label: 'Rays from a corner',
    own: { ratio: [1, 2] },
    field: stack('#007A3D', [
      div('rays', ['#003F87', '#FCD856', '#D62828', '#FFFFFF', '#007A3D'], {
        count: 5,
        rotation: -90,
        sweep: 90,
        x: 0,
        y: 1,
        ...stripeWeights(SEYCHELLES),
      }),
    ]),
  },
  { id: 'macedonia', label: 'Sun', own: { ratio: [1, 2] }, field: macedonia() },
  {
    id: 'ensign',
    label: 'Union canton',
    own: { ratio: [1, 2] },
    field: stack('#012169', [
      div('saltire', ['#FFFFFF'], { width: 0.2 }, { box: [0, 0, 0.5, 0.5] }),
      div('saltire', ['#C8102E'], { width: 0.0667 }, { box: [0, 0, 0.5, 0.5] }),
      div('cross', ['#C8102E'], { width: 0.2, x: 0.5, y: 0.5 }, { box: [0, 0, 0.5, 0.5], fimbriation: { color: '#FFFFFF', width: 0.0333 } }),
    ]),
  },
  {
    id: 'kenya',
    label: 'Bordered stripes',
    own: { ratio: [2, 3] },
    field: stack('#000000', [
      div('stripes-h', ['#000000', '#BB0000', '#006600'], { count: 3, ...stripeWeights([6.5, 5, 6.5]) }, { fimbriation: { color: '#FFFFFF', width: 1 / 18 } }),
    ]),
  },
  {
    id: 'qatar',
    label: 'Serrated',
    own: { ratio: [11, 28] },
    field: stack('#8A1538', [
      div('stripes-v', ['#FFFFFF', '#8A1538'], { count: 2, ...stripeWeights([1, 2.2]) }, { edge: { style: 'zigzag', depth: 0.11, period: 1 / 9 } }),
    ]),
  },
  {
    id: 'tanzania',
    label: 'Bordered diagonal',
    own: { ratio: [2, 3] },
    field: stack('#00A3DD', [
      div('per-bend', ['#1EB53A'], { corner: 0 }),
      div('bend', ['#000000'], { width: 0.2, flip: 0 }, { fimbriation: { color: '#FCD116', width: 0.055 } }),
    ]),
  },
  {
    id: 'guyana',
    label: 'Arrowhead',
    own: { ratio: [3, 5] },
    field: stack('#009E49', [
      div('triangle', ['#FCD116'], { side: 0, depth: 1, base: 1 }, { fimbriation: { color: '#FFFFFF', width: 0.045 } }),
      div('triangle', ['#CE1126'], { side: 0, depth: 0.5, base: 1 }, { fimbriation: { color: '#000000', width: 0.04 } }),
    ]),
  },
  {
    id: 'aland',
    label: 'Bordered cross',
    own: { ratio: [17, 26] },
    field: stack('#0064AD', [
      div('cross', ['#DA0E15'], { width: 3 / 17, x: 0.35, y: 0.5 }, { fimbriation: { color: '#FFD300', width: 1 / 17 } }),
    ]),
  },
  {
    id: 'tonga',
    label: 'Canton with a cross',
    own: { ratio: [1, 2] },
    field: stack('#C10000', [
      div('canton', ['#FFFFFF'], { corner: 0, width: 0.4, height: 0.5 }),
      div('cross', ['#C10000'], { width: 0.34, x: 0.5, y: 0.5 }, { box: [0.0625, 0.1, 0.3375, 0.4] }),
    ]),
  },
  {
    id: 'wavy',
    label: 'Wavy stripes',
    own: { ratio: [2, 3] },
    field: stack('#0072CE', [
      div('stripes-h', ['#0072CE', '#FFFFFF'], { count: 5 }, { edge: { style: 'wavy', depth: 0.06, period: 0.3 } }),
    ]),
  },
];

/** Gives a template's divisions fresh ids, and a layout template the flag's own colours, in order. */
export function templateField(template: FieldTemplate, current: StudioField, id: () => string): StackField {
  let field = template.field;
  if (!template.own) {
    const own = stackColors(field);
    const theirs = current.kind === 'stack' ? stackColors(current) : current.colors;
    const map = new Map(own.map((color, i) => [color, theirs[i] ?? color]));
    field = recolorStack(field, (c) => map.get(c.toUpperCase()) ?? c);
  }
  return { ...field, divisions: field.divisions.map((d) => ({ ...d, id: id() })) };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Whether two stacks have the same divisions in the same shape, whatever their colours. */
export function sameShape(a: StudioField, b: StackField) {
  if (a.kind !== 'stack' || a.divisions.length !== b.divisions.length) return false;
  return a.divisions.every((d, i) => {
    const e = b.divisions[i];
    if (d.kind !== e.kind || Boolean(d.fimbriation) !== Boolean(e.fimbriation) || d.edge?.style !== e.edge?.style) return false;
    const [p, q] = [divisionParams(d), divisionParams(e)];
    const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
    const [boxA, boxB] = [d.box ?? [0, 0, 1, 1], e.box ?? [0, 0, 1, 1]];
    return [...keys].every((k) => near(p[k] ?? 1, q[k] ?? 1)) && boxA.every((v, j) => near(v, boxB[j]));
  });
}

/** A new division of a kind, in its default shape and colours. */
export function newDivision(kind: DivisionKind, id: string, colors?: string[]): StudioDivision {
  const def = DIVISIONS[kind];
  return { id, kind, colors: colors ?? [...def.colors], params: {} };
}

/** A new division for a field: any default colour too near the base is swapped for one the flag already uses. */
export function divisionFor(field: StackField, kind: DivisionKind, id: string): StudioDivision {
  const division = newDivision(kind, id);
  const near = (a: string, b: string) => colorDistance(a, b) < 25;
  const spare = [...stackColors(field), '#FFFFFF', '#000000'].filter((c) => !near(c, field.color) && !division.colors.some((own) => near(own, c)));
  let next = 0;
  return { ...division, colors: division.colors.map((c) => (near(c, field.color) && spare[next] ? spare[next++] : c)) };
}
