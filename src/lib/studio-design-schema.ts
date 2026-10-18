import { z } from 'zod';
import type { StudioDesign } from '@/lib/studio-design';

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

const field = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('layout'), layout, colors: z.array(hex).max(8), params: z.record(z.string(), unit) }),
  z.object({ kind: z.literal('image'), src: z.string().url().max(1000), palette: z.array(hex).max(8), colors: z.array(hex).max(8) }),
]);

const layer = z.object({
  id: z.string().max(40),
  emblemId: z.string().max(64),
  name: z.string().max(120),
  src: z.string().url().max(1000),
  cutout: z
    .object({
      box: z.tuple([unit, unit, unit, unit]),
      field: z.object({ layout, params: z.record(z.string(), unit), colors: z.array(hex).max(8) }),
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
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});

export const studioDesignSchema: z.ZodType<StudioDesign> = z.object({
  version: z.literal(1),
  ratio: z.tuple([z.number().positive().max(20), z.number().positive().max(20)]),
  field,
  layers: z.array(layer).max(80),
});
