import type { Font } from 'opentype.js';
import type { PathContour, StudioLayer, StudioText, TextFont } from '@/lib/studio-design';
import { uid } from './model';
import { applyVector, fitContours, parsePathD } from './paths';
import { layerAffine } from './vector';

export type FontChoice = { id: TextFont; label: string; bold: boolean; italic: boolean; hint?: string };

/** The faces text can be set in: open-licence fonts served from /fonts/studio. */
export const FONTS: FontChoice[] = [
  { id: 'inter', label: 'Inter', bold: true, italic: true },
  { id: 'garamond', label: 'EB Garamond', bold: true, italic: true },
  { id: 'cinzel', label: 'Cinzel', bold: true, italic: false, hint: 'Roman capitals' },
  { id: 'oswald', label: 'Oswald', bold: true, italic: false },
  { id: 'slab', label: 'Roboto Slab', bold: true, italic: false },
  { id: 'fraktur', label: 'Fraktur', bold: false, italic: false },
  { id: 'script', label: 'Great Vibes', bold: false, italic: false, hint: 'Script' },
  { id: 'cairo', label: 'Cairo', bold: true, italic: false, hint: 'Arabic' },
];

export const fontChoice = (id: TextFont) => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** The file a text's face comes from, falling back where the font has no bold or italic. */
export function fontFile(spec: Pick<StudioText, 'font' | 'bold' | 'italic'>) {
  const choice = fontChoice(spec.font);
  return `${choice.id}-${spec.bold && choice.bold ? 700 : 400}${spec.italic && choice.italic ? '-italic' : ''}`;
}

const fontUrl = (file: string) => `/fonts/studio/${file}.woff`;

let opentype: Promise<typeof import('opentype.js')> | null = null;
const loading = new Map<string, Promise<Font>>();
const loaded = new Map<string, Font>();

function loadFont(file: string) {
  let font = loading.get(file);
  if (!font) {
    opentype ??= import('opentype.js').then((m) => (m as unknown as { default?: typeof m }).default ?? m);
    font = Promise.all([opentype, fetch(fontUrl(file)).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`No font ${file}`))))]).then(
      ([ot, buffer]) => {
        const parsed = ot.parse(buffer);
        loaded.set(file, parsed);
        return parsed;
      },
    );
    // A failed load can be tried again.
    font.catch(() => loading.delete(file));
    loading.set(file, font);
  }
  return font;
}

/** Whether the text can be set right now, without waiting on its font. */
export const textReady = (spec: Pick<StudioText, 'font' | 'bold' | 'italic'>) => loaded.has(fontFile(spec));

export const loadTextFont = (spec: Pick<StudioText, 'font' | 'bold' | 'italic'>) => loadFont(fontFile(spec));

/** Puts a font's own face on the page, for showing its name in it. */
export function previewFamily(id: TextFont) {
  const family = `vx-studio-${id}`;
  if (typeof document !== 'undefined' && ![...document.fonts].some((f) => f.family === family)) {
    const face = new FontFace(family, `url(${fontUrl(`${id}-400`)})`);
    document.fonts.add(face);
    face.load().catch(() => undefined);
  }
  return family;
}

export const DEFAULT_TEXT: Omit<StudioText, 'ink'> = {
  content: 'Text',
  font: 'inter',
  bold: true,
  spacing: 0,
  leading: 1.2,
  align: 'center',
  curve: 0,
};

const n = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * The letters' outlines, as fractions of their own box, and where that box sits in ems (y down)
 * from the first line's baseline at its alignment point. A curve bends each line round a circle,
 * turning every letter to follow it.
 */
export function setText(spec: StudioText): { contours: PathContour[]; ink: StudioText['ink'] | null } {
  const font = loaded.get(fontFile(spec));
  if (!font) throw new Error('The font isn’t loaded yet');
  const scale = 1 / font.unitsPerEm;
  const lines = spec.content.split('\n').map((line, i) => {
    const glyphs: { at: number; advance: number; glyph: Parameters<Parameters<Font['forEachGlyph']>[5]>[0] }[] = [];
    const end = font.forEachGlyph(line, 0, 0, 1, { kerning: true, letterSpacing: spec.spacing }, (glyph, x) => {
      if (glyph.index > 0) glyphs.push({ at: x, advance: (glyph.advanceWidth ?? 0) * scale, glyph });
    });
    const width = Math.max(0, end - (line ? spec.spacing : 0));
    const offset = spec.align === 'left' ? 0 : spec.align === 'right' ? -width : -width / 2;
    return { glyphs, width, offset, baseline: i * spec.leading };
  });

  const theta = (Math.max(-360, Math.min(360, spec.curve)) * Math.PI) / 180;
  const curved = Math.abs(theta) > 1e-3;
  const bow = Math.sign(theta);
  const radius = curved ? Math.max(1e-3, Math.max(...lines.map((l) => l.width))) / Math.abs(theta) : 0;

  let d = '';
  for (const line of lines) {
    for (const { at, advance, glyph } of line.glyphs) {
      // Each letter turns as one piece about the middle of its baseline.
      const mid = line.offset + at + advance / 2;
      let place = (x: number, y: number): [number, number] => [mid + x, line.baseline + y];
      if (curved) {
        const r = radius - bow * line.baseline;
        const phi = mid / Math.max(r, 1e-3);
        const [cx, cy] = [r * Math.sin(phi), bow * radius - bow * r * Math.cos(phi)];
        const turn = bow * phi;
        const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
        place = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
      }
      const P = (x: number, y: number) => place(x - advance / 2, y).map(n).join(' ');
      for (const c of glyph.getPath(0, 0, 1, { kerning: true }, font).commands) {
        if (c.type === 'Z') d += 'Z';
        else if (c.type === 'C') d += `C${P(c.x1, c.y1)} ${P(c.x2, c.y2)} ${P(c.x, c.y)}`;
        else if (c.type === 'Q') d += `Q${P(c.x1, c.y1)} ${P(c.x, c.y)}`;
        else d += `${c.type}${P(c.x, c.y)}`;
      }
    }
  }
  const contours = d ? parsePathD(d).filter((c) => c.nodes.length > 2) : [];
  if (contours.length === 0) return { contours, ink: null };
  const fit = fitContours(contours);
  return { contours: fit.contours, ink: [n(fit.cx - fit.w / 2), n(fit.cy - fit.h / 2), n(fit.w), n(fit.h)] };
}

/** Fractions of a box, kept to what shows even on a large export. */
function compact(contours: PathContour[]): PathContour[] {
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  const pair = (p?: [number, number]) => (p ? ([r(p[0]), r(p[1])] as [number, number]) : undefined);
  return contours.map((c) => ({
    closed: c.closed,
    nodes: c.nodes.map((node) => {
      const out: PathContour['nodes'][number] = { x: r(node.x), y: r(node.y) };
      if (node.in) out.in = pair(node.in);
      if (node.out) out.out = pair(node.out);
      return out;
    }),
  }));
}

/** What an empty text keeps as its box, in ems: about a capital's height. */
const EMPTY_INK: StudioText['ink'] = [-0.25, -0.7, 0.5, 0.7];

export const textName = (content: string) => content.split('\n').find((l) => l.trim())?.trim().slice(0, 40) || 'Text';

/** The layer's shape and box for its text, at a font size (fraction of flag height). */
function shaped(spec: StudioText, fontSize: number, stroke: number) {
  const set = setText(spec);
  const ink = set.ink ?? EMPTY_INK;
  const h = ink[3] * fontSize + stroke;
  const w = ink[2] * fontSize + stroke;
  return { text: { ...spec, ink }, contours: compact(set.contours), size: h, aspect: w / h };
}

/** Where the text's origin sits in a layer's own box. */
function originIn(layer: StudioLayer, ink: StudioText['ink'], size: number, width: number) {
  const stroke = layer.shape?.stroke ?? 0;
  const [bw, bh] = [Math.max(0, width - stroke), Math.max(0, size - stroke)];
  const [x0, y0, w, h] = ink;
  return [-bw / 2 + (w > 0 ? -x0 / w : 0.5) * bw, -bh / 2 + (h > 0 ? -y0 / h : 0.5) * bh] as [number, number];
}

/** A new text layer, its origin at a point on the flag (flag units). Its font must be loaded. */
export function newTextLayer(spec: Omit<StudioText, 'ink'>, at: { x: number; y: number }, fontSize: number, color: string, W: number): StudioLayer {
  const s = shaped({ ...spec, ink: EMPTY_INK }, fontSize, 0);
  const layer: StudioLayer = {
    id: uid(),
    emblemId: 'text',
    name: textName(spec.content),
    src: '',
    shape: { kind: 'path', fill: true, stroke: 0, contours: s.contours, nonzero: true },
    text: s.text,
    aspect: s.aspect,
    palette: [color, '#000000'],
    colors: [color, '#000000'],
    x: at.x / W,
    y: at.y,
    size: s.size,
    rotation: 0,
    flipX: false,
    flipY: false,
    outline: null,
    repeat: null,
  };
  // Put the origin, not the middle of the letters, where it was asked for.
  const [ox, oy] = originIn(layer, s.text.ink, s.size, s.size * s.aspect);
  return { ...layer, x: (at.x - ox) / W, y: at.y - oy };
}

/**
 * Sets a text layer again with changes to its text. The letters keep their size, however the
 * layer has been scaled, and the text's origin stays put; a free stretch is kept. Its font must
 * be loaded.
 */
export function retypeset(layer: StudioLayer, patch: Partial<StudioText>, W: number): StudioLayer {
  if (!layer.text || !layer.shape) return layer;
  const stroke = layer.shape.stroke;
  const fontSize = Math.max(1e-4, (layer.size - stroke) / layer.text.ink[3]);
  const s = shaped({ ...layer.text, ...patch }, fontSize, stroke);
  const stretch = layer.stretch ?? 1;
  const before = originIn(layer, layer.text.ink, layer.size, layer.size * layer.aspect * stretch);
  const after = originIn(layer, s.text.ink, s.size, s.size * s.aspect * stretch);
  const [dx, dy] = applyVector(layerAffine(layer, W), [before[0] - after[0], before[1] - after[1]]);
  return {
    ...layer,
    name: layer.name === textName(layer.text.content) ? textName(s.text.content) : layer.name,
    text: s.text,
    shape: { ...layer.shape, contours: s.contours, nonzero: true },
    size: s.size,
    aspect: s.aspect,
    x: layer.x + dx / W,
    y: layer.y + dy,
  };
}

/** The font size a text layer is set at, as a fraction of flag height. */
export const fontSizeOf = (layer: StudioLayer) => (layer.text ? (layer.size - (layer.shape?.stroke ?? 0)) / layer.text.ink[3] : 0);
