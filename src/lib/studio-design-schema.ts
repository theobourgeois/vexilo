import { z } from 'zod';
import type { StoredStudioDesign } from '@/lib/studio-design';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const unit = z.number().finite();

const layout = z.enum([
  'solid',
  'bicolor-h',
  'bicolor-v',
  'triband-h',
  'triband-v',
  'stripes-h',
  'cross',
  'nordic',
  'nordic-fimbriated',
  'saltire',
  'canton',
  'border',
  'hoist-triangle',
  'triband-triangle',
  'diagonal',
  'diagonal-band',
  'quartered',
  'stripes-v',
  'pentaband-h',
  'stars-stripes',
  'hoist-band',
  'disc',
  'per-saltire',
  'union',
]);

const image = z.object({
  kind: z.literal('image'),
  src: z.string().url().max(1000),
  palette: z.array(hex).max(8),
  colors: z.array(hex).max(8),
});

const fieldV1 = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('layout'), layout, colors: z.array(hex).max(8), params: z.record(z.string(), unit) }),
  image,
]);

const partRef = { divisionId: z.string().max(40), part: z.number().int().min(0).max(400) };

const division = z.object({
  id: z.string().max(40),
  kind: z.enum([
    'stripes-h',
    'stripes-v',
    'band',
    'bend',
    'per-bend',
    'cross',
    'saltire',
    'pall',
    'triangle',
    'chevron',
    'canton',
    'quarters',
    'per-saltire',
    'border',
    'disc',
    'rays',
  ]),
  colors: z.array(hex).min(1).max(16),
  params: z.record(z.string(), unit),
  box: z.tuple([unit, unit, unit, unit]).optional(),
  fimbriation: z.object({ color: hex, width: z.number().min(0).max(0.5) }).nullable().optional(),
  edge: z
    .object({
      style: z.enum(['wavy', 'zigzag', 'serrated', 'stepped']),
      depth: z.number().min(0).max(0.5),
      period: z.number().min(0.01).max(2),
    })
    .nullable()
    .optional(),
  clip: z.object(partRef).nullable().optional(),
  name: z.string().max(120).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});

const field = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stack'), color: hex, divisions: z.array(division).max(64) }),
  image,
]);

const handle = z.tuple([z.number().min(-1000).max(1000), z.number().min(-1000).max(1000)]);
const pathNode = z.object({ x: unit, y: unit, in: handle.optional(), out: handle.optional() });

const shape = z.object({
  kind: z.enum(['rect', 'ellipse', 'triangle', 'diamond', 'star', 'polygon', 'cross', 'crescent', 'heart', 'line', 'arrow', 'brush', 'path']),
  fill: z.boolean(),
  stroke: z.number().min(0).max(1),
  points: z.number().int().min(3).max(64).optional(),
  inner: z.number().min(0).max(1).optional(),
  corner: z.number().min(0).max(1).optional(),
  path: z.array(z.tuple([unit, unit])).max(2000).optional(),
  contours: z.array(z.object({ nodes: z.array(pathNode).min(1).max(2000), closed: z.boolean() })).max(400).optional(),
});

const layer = z.object({
  id: z.string().max(40),
  emblemId: z.string().max(64),
  name: z.string().max(120),
  src: z.union([z.string().url().max(1000), z.literal('')]),
  shape: shape.optional(),
  cutout: z
    .object({
      box: z.tuple([unit, unit, unit, unit]),
      field: z.object({ layout, params: z.record(z.string(), unit), colors: z.array(hex).max(8) }),
      seeds: z.array(z.tuple([unit, unit])).max(32).optional(),
    })
    .optional(),
  aspect: z.number().positive().max(50),
  palette: z.array(hex).max(12),
  colors: z.array(hex).max(12),
  x: unit,
  y: unit,
  size: z.number().positive().max(10),
  stretch: z.number().positive().max(50).optional(),
  rotation: unit,
  flipX: z.boolean(),
  flipY: z.boolean(),
  outline: z.object({ color: hex, width: z.number().min(0).max(0.2) }).nullable(),
  repeat: z
    .object({
      mode: z.enum(['row', 'column', 'ring', 'arc', 'grid']),
      count: z.number().int().min(1).max(64),
      spacing: z.number().min(-1).max(5),
      facing: z.boolean(),
    })
    .nullable(),
  clip: z
    .discriminatedUnion('kind', [z.object({ kind: z.literal('below') }), z.object({ kind: z.literal('part'), ...partRef })])
    .nullable()
    .optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});

const ratio = z.tuple([z.number().positive().max(20), z.number().positive().max(20)]);
// Room for brush strokes, which are a layer each.
const layers = z.array(layer).max(200);

/** Either version of a design; open one in the flag maker with `migrateDesign`. */
export const studioDesignSchema: z.ZodType<StoredStudioDesign> = z.union([
  z.object({ version: z.literal(2), ratio, field, layers }),
  z.object({ version: z.literal(1), ratio, field: fieldV1, layers }),
]);
