'use client';

import type { PathContour, StudioGroup, StudioLayer } from '@/lib/studio-design';
import { hexToRgb, normalizeHex, rgbToHex } from './colors';
import { uid } from './model';
import { at, compose, contoursBounds, fitContours, flatten, makeNode, mapContours, parsePathD, type Affine, type Bounds, type Pt } from './paths';
import { loadPaper } from './vector';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';
/** How big an import lands: its longer side, as a fraction of flag height. */
const IMPORT_SIZE = 0.6;
/** Parts fainter than this are left out; the rest are drawn solid, as layers have no opacity. */
const MIN_ALPHA = 0.5;
/** The most layers a design holds, as the design schema allows. */
export const MAX_LAYERS = 200;
/** The most outlines one layer's path holds, as the design schema allows. */
const MAX_CONTOURS = 2000;
/** Clipping and orienting work in numbers about this big, whatever units the SVG uses. */
const WORK_SIZE = 1000;
const MAX_SOURCE = 6_000_000;
const MAX_ELEMENTS = 30_000;
/** Points in the drawing, and the size of the layers made from it, that a design can carry. */
const MAX_POINTS = 14_000;
const MAX_BYTES = 650_000;
const TOO_DETAILED = 'That SVG is too detailed to edit as shapes.';
const MIN_SIDE = 0.002;
/** How far, as a log ratio, a drawing's proportions can be from a box's and still be stretched to fill it. */
const FILL_SLACK = 0.03;
/** Up to this many layers, an import keeps its shapes whole rather than separating colours. */
const LAYERED_PARTS = 12;

/** Something about the SVG the user should hear, in words they can act on. */
export class SvgImportError extends Error {}
/** An SVG with more parts than there's room for as layers; it can still come in as an image. */
export class SvgTooDetailedError extends SvgImportError {}

/** Whether a file is an SVG, which comes in as shapes rather than an uploaded image. */
export const isSvgFile = (file: File) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);

/** Whether pasted text is SVG markup, as design tools copy it. */
export const isSvgMarkup = (text: string) => /<svg[\s>]/i.test(text.slice(0, 4000)) && /<\/svg>\s*$/i.test(text);

export type SvgImport = {
  layers: StudioLayer[];
  /** The group the layers are in, when there's more than one. */
  group: StudioGroup | null;
  /** What couldn't come in as shapes. */
  skipped: { text: number; images: number };
};

type Region = { contours: PathContour[]; evenodd: boolean }[];

/** One shape from the SVG, in its root's units. */
type Item = {
  contours: PathContour[];
  /** Absent when it's only stroked. */
  fill?: string;
  evenodd: boolean;
  stroke?: { color: string; width: number };
  /** Regions it only shows inside, all of them. */
  clips: Region[];
  name?: string;
};

type Context = { win: Window; root: Element; toRoot: DOMMatrix; items: Item[] };

/**
 * Reads an SVG into path layers that stay editable: each shape keeps its outline, fill and
 * stroke, and shapes painted alike are merged into one layer wherever that can't change what
 * shows on top. It's drawn in a sandboxed frame, so the browser works out styles, transforms and
 * reused parts without running anything in the file. Lands centred on `at` (x a fraction of the
 * flag's width, y of its height), or the middle, unless it's given a `box` to fill, as an emblem's
 * picture does; `budget` is how many layers there's room for.
 */
export async function readSvg(
  source: string,
  opts: {
    name: string;
    W: number;
    at?: { x: number; y: number };
    /** A box `w` × `h` centred on the origin, taken to flag units by `affine`. */
    box?: { w: number; h: number; affine: Affine };
    budget: number;
  },
): Promise<SvgImport> {
  if (source.length > MAX_SOURCE) throw new SvgTooDetailedError('That SVG is too large to edit as shapes.');
  const parsed = parseSvg(source);
  const skipped = sanitize(parsed);
  expandUses(parsed);
  if (parsed.getElementsByTagName('*').length > MAX_ELEMENTS) throw new SvgTooDetailedError(TOO_DETAILED);

  const frame = document.createElement('iframe');
  // Same origin so its layout can be read, but nothing in it runs.
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:1000px;border:0;visibility:hidden;pointer-events:none';
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.srcdoc = '<!doctype html><html><body style="margin:0"></body></html>';
  document.body.appendChild(frame);
  let items: Item[];
  try {
    await loaded;
    const doc = frame.contentDocument!;
    const root = doc.importNode(parsed, true) as unknown as SVGSVGElement;
    // A fixed size so it lays out; the outlines are measured against its own units anyway.
    root.setAttribute('width', '1000');
    root.setAttribute('height', '1000');
    doc.body.appendChild(root);
    const screen = root.getScreenCTM();
    if (!screen) throw new SvgImportError('That SVG couldn’t be drawn.');
    const ctx: Context = { win: frame.contentWindow!, root, toRoot: screen.inverse(), items: [] };
    walk(root, ctx, 1, []);
    items = ctx.items;
  } finally {
    frame.remove();
  }
  items = cropToView(items, parsed);
  if (items.length === 0) {
    throw new SvgImportError(skipped.text ? 'That SVG only has text. Turn it into outlines first.' : 'There’s nothing in that SVG to draw.');
  }

  // Into numbers of a workable size, whatever the file's units.
  const raw = unionBounds(items.map(itemBounds));
  const k = WORK_SIZE / Math.max(raw.x1 - raw.x0, raw.y1 - raw.y0, 1e-9);
  const work: Affine = [k, 0, 0, k, -raw.x0 * k, -raw.y0 * k];
  items = items.map((item) => ({
    ...item,
    contours: mapContours(item.contours, work),
    stroke: item.stroke && { ...item.stroke, width: item.stroke.width * k },
    clips: item.clips.map((region) => region.map((part) => ({ ...part, contours: mapContours(part.contours, work) }))),
  }));
  items = await applyClips(items);
  if (items.length === 0) throw new SvgImportError('There’s nothing in that SVG to draw.');

  const snap = colorSnapper();
  items = items.map((item) => ({
    ...item,
    ...(item.fill && { fill: snap(item.fill), contours: orient(item.contours, item.evenodd), evenodd: false }),
    ...(item.stroke && { stroke: { ...item.stroke, color: snap(item.stroke.color) } }),
  }));
  // Every point is kept, so a drawing with too many would make the design too big to save.
  if (items.reduce((sum, item) => sum + item.contours.reduce((n, c) => n + c.nodes.length, 0), 0) > MAX_POINTS) throw new SvgTooDetailedError(TOO_DETAILED);
  let parts = mergeItems(items);
  // Simple drawings keep their shapes whole, to move about; detailed ones get a layer per colour.
  if (parts.length > Math.max(LAYERED_PARTS, 2 * new Set(items.map(paintKey)).size)) parts = await separate(items);
  if (parts.length > opts.budget) {
    throw new SvgTooDetailedError(
      opts.budget > 0 ? `That SVG has ${parts.length} parts, more than the ${opts.budget} layers there’s room for.` : 'There’s no room for more layers.',
    );
  }

  const { W, box } = opts;
  const b = unionBounds(items.map(itemBounds));
  const [bw, bh] = [Math.max(b.x1 - b.x0, 1e-9), Math.max(b.y1 - b.y0, 1e-9)];
  let place: Affine;
  let scale: number;
  if (box) {
    // The drawing fills the box, as the picture it replaces did, unless that would distort it:
    // a picture can be bigger than its shapes, with a blur or glow round them.
    const fill = Math.abs(Math.log(box.w / box.h / (bw / bh))) < FILL_SLACK;
    const [sx, sy] = fill ? [box.w / bw, box.h / bh] : Array(2).fill(Math.min(box.w / bw, box.h / bh));
    place = compose(box.affine, [sx, 0, 0, sy, (-sx * (b.x0 + b.x1)) / 2, (-sy * (b.y0 + b.y1)) / 2]);
    scale = Math.sqrt(sx * sy);
  } else {
    scale = Math.min(IMPORT_SIZE / bh, (IMPORT_SIZE * Math.max(W, 1)) / bw);
    const [cx, cy] = opts.at ? [opts.at.x * W, opts.at.y] : [W / 2, 0.5];
    place = [scale, 0, 0, scale, cx - (scale * (b.x0 + b.x1)) / 2, cy - (scale * (b.y0 + b.y1)) / 2];
  }
  const group: StudioGroup | null = parts.length > 1 ? { id: uid(), name: opts.name, repeat: null } : null;
  const layers = parts.map((part) => partLayer(part, place, scale, W, group?.id ?? null, parts.length === 1 ? opts.name : undefined));
  if (JSON.stringify(layers).length > MAX_BYTES) throw new SvgTooDetailedError(TOO_DETAILED);
  return { layers, group, skipped };
}

// ---- reading the file ----

function parseSvg(source: string): Element {
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  let root: Element | null = xml.documentElement;
  // Files that aren't quite XML, or forget their namespace, read the forgiving way HTML does.
  if (root?.localName !== 'svg' || root.namespaceURI !== SVG_NS || xml.getElementsByTagName('parsererror').length) {
    root = new DOMParser().parseFromString(source, 'text/html').querySelector('svg');
  }
  if (!root) throw new SvgImportError('That file isn’t an SVG the flag maker can read.');
  return root;
}

const DROPPED = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'feimage', 'image', 'a:script']);
const EXTERNAL_URL = /url\(\s*(['"]?)(?!#)[^)]*\)/gi;

/** Takes out anything that could run or load from elsewhere, counting what won't come in. */
function sanitize(root: Element) {
  const skipped = { text: 0, images: 0 };
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const name = el.localName.toLowerCase();
    if (name === 'text') skipped.text++;
    if (name === 'image') skipped.images++;
    if (DROPPED.has(name)) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      if (attr.localName.toLowerCase().startsWith('on')) el.removeAttributeNode(attr);
      else if (attr.localName === 'href' && !attr.value.trim().startsWith('#')) el.removeAttributeNode(attr);
      else if (attr.localName === 'style') attr.value = attr.value.replace(EXTERNAL_URL, 'none');
    }
    if (name === 'style') el.textContent = (el.textContent ?? '').replace(/@import[^;]*;?/gi, '').replace(EXTERNAL_URL, 'none');
  }
  return skipped;
}

const byId = (root: Element, id: string) => root.querySelector(`[id="${CSS.escape(id)}"]`);
const hrefOf = (el: Element) => el.getAttribute('href') ?? el.getAttributeNS(XLINK_NS, 'href') ?? el.getAttribute('xlink:href');
const USE_ONLY = new Set(['x', 'y', 'width', 'height', 'href', 'id']);

/** Replaces each <use> with a copy of what it points at, so its parts can be read like any other. */
function expandUses(root: Element) {
  const doc = root.ownerDocument;
  for (let pass = 0; pass < 8; pass++) {
    const uses = [...root.getElementsByTagNameNS(SVG_NS, 'use')];
    if (uses.length === 0) return;
    for (const use of uses) {
      const href = hrefOf(use) ?? '';
      const target = href.startsWith('#') ? byId(root, href.slice(1)) : null;
      if (!target || target.contains(use)) {
        use.remove();
        continue;
      }
      const g = doc.createElementNS(SVG_NS, 'g');
      for (const attr of use.attributes) if (!USE_ONLY.has(attr.localName)) g.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
      const [x, y] = [Number.parseFloat(use.getAttribute('x') ?? '') || 0, Number.parseFloat(use.getAttribute('y') ?? '') || 0];
      const transform = [use.getAttribute('transform'), x || y ? `translate(${x} ${y})` : ''].filter(Boolean).join(' ');
      if (transform) g.setAttribute('transform', transform);
      const content = target.localName === 'symbol' ? [...target.childNodes] : [target];
      for (const node of content) {
        const copy = node.cloneNode(true);
        if (copy instanceof Element) for (const el of [copy, ...copy.querySelectorAll('[id]')]) el.removeAttribute('id');
        g.appendChild(copy);
      }
      use.replaceWith(g);
    }
  }
  // Whatever's left points round in a loop.
  for (const use of [...root.getElementsByTagNameNS(SVG_NS, 'use')]) use.remove();
}

// ---- walking what's drawn ----

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const NOT_DRAWN = new Set([
  'defs',
  'clippath',
  'mask',
  'symbol',
  'marker',
  'pattern',
  'lineargradient',
  'radialgradient',
  'filter',
  'style',
  'title',
  'desc',
  'metadata',
  'text',
]);

const number = (value: string | null | undefined, fallback: number) => {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
};

const toAffine = (m: DOMMatrix | SVGMatrix): Affine => [m.a, m.b, m.c, m.d, m.e, m.f];
const multiply = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** From an element's own units to the root's. */
function toRoot(el: Element, ctx: Context): Affine | null {
  const m = (el as SVGGraphicsElement).getScreenCTM?.();
  return m ? toAffine(ctx.toRoot.multiply(m)) : null;
}

/** An element's own transform attribute, for parts that aren't laid out, like a clip path's. */
function ownTransform(el: Element): Affine {
  const list = (el as SVGGraphicsElement).transform?.baseVal;
  const m = list && list.numberOfItems > 0 ? list.consolidate()?.matrix : null;
  return m ? toAffine(m) : IDENTITY;
}

const refId = (value: string | null | undefined) => /url\(\s*['"]?#([^'")]+)/.exec(value ?? '')?.[1] ?? null;

function walk(el: Element, ctx: Context, opacity: number, clips: Region[]) {
  const name = el.localName.toLowerCase();
  if (NOT_DRAWN.has(name)) return;
  const style = ctx.win.getComputedStyle(el);
  if (style.display === 'none') return;
  const alpha = opacity * number(style.opacity, 1);
  if (alpha < MIN_ALPHA) return;
  const clip = clipRegion(el, style, ctx);
  const inside = clip ? [...clips, clip] : clips;
  if (SHAPES.has(name)) {
    addShape(el, name, style, alpha, inside, ctx);
    return;
  }
  // A switch draws its first choice.
  const children = name === 'switch' ? [...el.children].slice(0, 1) : [...el.children];
  for (const child of children) walk(child, ctx, alpha, inside);
}

function addShape(el: Element, name: string, style: CSSStyleDeclaration, alpha: number, clips: Region[], ctx: Context) {
  if (style.visibility !== 'visible') return;
  const contours = shapeContours(el, name);
  const m = toRoot(el, ctx);
  if (!contours || !m) return;
  const fill = name === 'line' ? null : paint(style.fill, number(style.fillOpacity, 1) * alpha, ctx);
  const strokeWidth = number(style.strokeWidth, 1) * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const stroke = strokeWidth > 0 ? paint(style.stroke, number(style.strokeOpacity, 1) * alpha, ctx) : null;
  if (!fill && !stroke) return;
  ctx.items.push({
    contours: mapContours(contours, m),
    fill: fill ?? undefined,
    evenodd: style.fillRule === 'evenodd',
    stroke: stroke ? { color: stroke, width: strokeWidth } : undefined,
    clips,
    name: labelOf(el),
  });
}

/** A basic shape's outline as path data, in its own units. */
function shapeD(el: Element, name: string): string | null {
  const len = (attr: string) => (el as unknown as Record<string, SVGAnimatedLength>)[attr]?.baseVal.value ?? 0;
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    rx > 0 && ry > 0 ? `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z` : null;
  switch (name) {
    case 'path':
      return el.getAttribute('d');
    case 'rect': {
      const [x, y, w, h] = [len('x'), len('y'), len('width'), len('height')];
      if (w <= 0 || h <= 0) return null;
      // A missing radius takes the other one.
      let rx = el.hasAttribute('rx') ? len('rx') : el.hasAttribute('ry') ? len('ry') : 0;
      let ry = el.hasAttribute('ry') ? len('ry') : rx;
      [rx, ry] = [Math.min(rx, w / 2), Math.min(ry, h / 2)];
      if (rx <= 0 || ry <= 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
      const [iw, ih] = [w - 2 * rx, h - 2 * ry];
      const corner = (dx: number, dy: number) => `a${rx} ${ry} 0 0 1 ${dx} ${dy}`;
      return `M${x + rx} ${y}h${iw}${corner(rx, ry)}v${ih}${corner(-rx, ry)}h${-iw}${corner(-rx, -ry)}v${-ih}${corner(rx, -ry)}z`;
    }
    case 'circle':
      return ellipse(len('cx'), len('cy'), len('r'), len('r'));
    case 'ellipse':
      return ellipse(len('cx'), len('cy'), len('rx'), len('ry'));
    case 'line':
      return `M${len('x1')} ${len('y1')}L${len('x2')} ${len('y2')}`;
    case 'polyline':
    case 'polygon': {
      const values = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
      const pairs: string[] = [];
      for (let i = 0; i + 1 < values.length; i += 2) if (Number.isFinite(values[i]) && Number.isFinite(values[i + 1])) pairs.push(`${values[i]} ${values[i + 1]}`);
      return pairs.length > 1 ? `M${pairs.join('L')}${name === 'polygon' ? 'z' : ''}` : null;
    }
  }
  return null;
}

function shapeContours(el: Element, name: string): PathContour[] | null {
  const d = shapeD(el, name);
  if (!d) return null;
  try {
    const contours = parsePathD(d).filter((c) => c.nodes.length > 1);
    return contours.length ? contours : null;
  } catch {
    return null;
  }
}

/** What a clip path lets show of an element, in the root's units. */
function clipRegion(owner: Element, style: CSSStyleDeclaration, ctx: Context): Region | null {
  const id = refId(style.clipPath);
  const clip = id ? byId(ctx.root, id) : null;
  if (!clip || clip.localName.toLowerCase() !== 'clippath') return null;
  let base = toRoot(owner, ctx);
  if (!base) return null;
  if (clip.getAttribute('clipPathUnits') === 'objectBoundingBox') {
    const box = (owner as SVGGraphicsElement).getBBox();
    base = multiply(base, [box.width, 0, 0, box.height, box.x, box.y]);
  }
  const region: Region = [];
  const collect = (el: Element, m: Affine) => {
    for (const child of el.children) {
      const name = child.localName.toLowerCase();
      const next = multiply(m, ownTransform(child));
      if (name === 'g') collect(child, next);
      if (!SHAPES.has(name)) continue;
      const contours = shapeContours(child, name);
      if (contours) region.push({ contours: mapContours(contours, next), evenodd: ctx.win.getComputedStyle(child).clipRule === 'evenodd' });
    }
  };
  collect(clip, multiply(base, ownTransform(clip)));
  // A clip path with nothing in it hides everything; one that can't be read hides nothing.
  return region.length ? region : null;
}

const GENERIC_ID = /^(path|rect|circle|ellipse|polygon|polyline|line|use|layer|shape|group|g|svg|xmlid|clip|defs|stop)[-_\d.]*_?$/i;

/** A name the file gives a shape, when it's one a person chose. */
function labelOf(el: Element): string | undefined {
  const label = el.getAttributeNS(INKSCAPE_NS, 'label') ?? el.getAttribute('inkscape:label');
  if (label?.trim()) return label.trim().slice(0, 60);
  const id = el.getAttribute('id');
  if (id && /[a-z]{3,}/i.test(id) && !GENERIC_ID.test(id)) return id.replace(/[-_]+/g, ' ').trim().slice(0, 60);
  return undefined;
}

// ---- colours ----

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba | null {
  const v = value.trim();
  const channels = (body: string, scale: number): Rgba | null => {
    const [rgb, alpha] = body.split('/');
    const parts = rgb.split(/[\s,]+/).filter(Boolean);
    const a = alpha ?? parts[3];
    const values = parts.slice(0, 3).map((p) => (p.endsWith('%') ? (Number.parseFloat(p) / 100) * 255 : Number.parseFloat(p) * scale));
    if (values.length < 3 || values.some((n) => !Number.isFinite(n))) return null;
    const opacity = a === undefined ? 1 : a.trim().endsWith('%') ? Number.parseFloat(a) / 100 : Number.parseFloat(a);
    return [values[0], values[1], values[2], Number.isFinite(opacity) ? opacity : 1];
  };
  const rgb = /^rgba?\(([^)]*)\)/i.exec(v);
  if (rgb) return channels(rgb[1], 1);
  const srgb = /^color\(srgb\s+([^)]*)\)/i.exec(v);
  if (srgb) return channels(srgb[1], 255);
  const hex = normalizeHex(v);
  return hex ? [...hexToRgb(hex), 1] : null;
}

/** A gradient's colours, averaged: a flat flag colour is the closest a layer can paint. */
function gradientColor(id: string, ctx: Context): Rgba | null {
  let el = byId(ctx.root, id);
  // Gradients often borrow their stops from another one.
  for (let hops = 0; el && hops < 8; hops++) {
    const stops = [...el.children].filter((c) => c.localName === 'stop');
    if (stops.length) {
      const colors = stops.flatMap((stop) => {
        const style = ctx.win.getComputedStyle(stop);
        const c = parseColor(style.stopColor);
        return c ? [[c[0], c[1], c[2], c[3] * number(style.stopOpacity, 1)] as Rgba] : [];
      });
      if (colors.length === 0) return null;
      return [0, 1, 2, 3].map((i) => colors.reduce((sum, c) => sum + c[i], 0) / colors.length) as Rgba;
    }
    const href = hrefOf(el);
    el = href?.startsWith('#') ? byId(ctx.root, href.slice(1)) : null;
  }
  return null;
}

/** A fill or stroke as a solid hex colour, or null when there's none or it's too faint to keep. */
function paint(value: string, alpha: number, ctx: Context): string | null {
  if (!value || value === 'none') return null;
  const ref = refId(value);
  // A paint server can name a colour to fall back on after it.
  const color = ref ? (gradientColor(ref, ctx) ?? parseColor(value.replace(/url\([^)]*\)/, ''))) : parseColor(value);
  if (!color || color[3] * alpha < MIN_ALPHA) return null;
  return rgbToHex([color[0], color[1], color[2]]);
}

/** Colours closer than this are one colour; files often carry near-copies, from gradients most of all. */
const SAME_COLOR = 14;

/**
 * Snaps each colour to the first close match seen before, so near-copies can share a layer and
 * recolour together.
 */
function colorSnapper() {
  const seen: { hex: string; rgb: [number, number, number] }[] = [];
  return (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    const match = seen.find(({ rgb }) => {
      // Weighted for how eyes see differences, which is close enough at this distance.
      const mean = (r + rgb[0]) / 2;
      const [dr, dg, db] = [r - rgb[0], g - rgb[1], b - rgb[2]];
      return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db) < SAME_COLOR * 3;
    });
    if (match) return match.hex;
    seen.push({ hex, rgb: [r, g, b] });
    return hex;
  };
}

const HUES: [number, string][] = [
  [15, 'Red'],
  [40, 'Orange'],
  [68, 'Yellow'],
  [160, 'Green'],
  [195, 'Teal'],
  [255, 'Blue'],
  [290, 'Purple'],
  [335, 'Pink'],
  [360, 'Red'],
];

/** A rough name for a colour, so imported layers can be told apart in the list. */
function colorName(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  if (sat < 0.15 || max - min < 0.08) return light > 0.85 ? 'White' : light < 0.15 ? 'Black' : 'Grey';
  const hue = max === r ? (((g - b) / (max - min)) * 60 + 360) % 360 : max === g ? ((b - r) / (max - min)) * 60 + 120 : ((r - g) / (max - min)) * 60 + 240;
  const name = HUES.find(([limit]) => hue < limit)?.[1] ?? 'Red';
  return (name === 'Orange' || name === 'Yellow') && light < 0.35 ? 'Brown' : name;
}

// ---- geometry ----

function unionBounds(boxes: Bounds[]): Bounds {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

/** Where an item draws, its stroke included. */
function itemBounds(item: Item): Bounds {
  const b = contoursBounds(item.contours) ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
  const pad = (item.stroke?.width ?? 0) / 2;
  return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad };
}

const overlaps = (a: Bounds, b: Bounds) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function signedArea(points: Pt[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [p, q] = [points[i], points[(i + 1) % points.length]];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return area / 2;
}

function insidePolygon(points: Pt[], [x, y]: Pt) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [a, b] = [points[i], points[j]];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

const reverse = (contour: PathContour): PathContour => ({
  closed: contour.closed,
  nodes: [...contour.nodes].reverse().map((n) => makeNode(at(n), n.out, n.in)),
});

/**
 * Winds a fill's outlines so it draws the same under the nonzero rule with every outer outline
 * turning the same way. Then fills merged into one layer add up rather than cutting holes where
 * they overlap. Even-odd fills alternate by how deep each outline sits; nonzero ones keep how
 * they turn inside each outer outline.
 */
function orient(contours: PathContour[], evenodd: boolean): PathContour[] {
  const polygons = contours.map((c) => flatten(c, 8));
  const boxes = polygons.map((p) => unionBounds(p.map(([x, y]) => ({ x0: x, y0: y, x1: x, y1: y }))));
  const sizes = boxes.map((b) => (b.x1 - b.x0) * (b.y1 - b.y0));
  const areas = polygons.map(signedArea);
  // Each outline's parent is the smallest one around it; ties go to the earlier, so there are no loops.
  const parent = contours.map((_, i) => {
    let best = -1;
    for (let j = 0; j < contours.length; j++) {
      if (j === i || !(sizes[j] > sizes[i] || (sizes[j] === sizes[i] && j < i))) continue;
      const [outer, inner] = [boxes[j], boxes[i]];
      if (outer.x0 > inner.x0 || outer.y0 > inner.y0 || outer.x1 < inner.x1 || outer.y1 < inner.y1) continue;
      if (!insidePolygon(polygons[j], polygons[i][0])) continue;
      if (best < 0 || sizes[j] < sizes[best]) best = j;
    }
    return best;
  });
  const ancestry = (i: number) => {
    let [depth, top] = [0, i];
    while (parent[top] >= 0) [depth, top] = [depth + 1, parent[top]];
    return { depth, top };
  };
  return contours.map((c, i) => {
    const { depth, top } = ancestry(i);
    const flip = evenodd ? areas[i] > 0 !== (depth % 2 === 0) : areas[top] < 0;
    return flip ? reverse(c) : c;
  });
}

type PaperLib = Awaited<ReturnType<typeof loadPaper>>;

function toPaper(paper: PaperLib, contours: PathContour[], evenodd: boolean, keepOpen = false) {
  const item = new paper.CompoundPath({
    children: contours.map(
      (c) =>
        new paper.Path({
          segments: c.nodes.map(
            (n) =>
              new paper.Segment(
                new paper.Point(n.x, n.y),
                n.in ? new paper.Point(n.in[0], n.in[1]) : undefined,
                n.out ? new paper.Point(n.out[0], n.out[1]) : undefined,
              ),
          ),
          closed: keepOpen ? c.closed : true,
        }),
    ),
  });
  item.fillRule = evenodd ? 'evenodd' : 'nonzero';
  return item as paper.PathItem;
}

function fromPaper(paper: PaperLib, item: paper.PathItem): PathContour[] {
  const paths = item instanceof paper.CompoundPath ? (item.children as paper.Path[]) : [item as paper.Path];
  const point = (p: paper.Point): Pt => [p.x, p.y];
  return paths
    .filter((path) => path.segments.length > 1)
    .map((path) => ({ closed: path.closed, nodes: path.segments.map((s) => makeNode(point(s.point), point(s.handleIn), point(s.handleOut))) }));
}

/** Lets the page draw now and then during long work. Unlike a timeout, it isn't slowed in a background tab. */
function breather() {
  let last = performance.now();
  return async () => {
    if (performance.now() - last < 30) return;
    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });
    last = performance.now();
  };
}

/** Cuts clipped items down to what shows, with Paper doing the curve maths. */
/**
 * Drops what's outside the SVG's frame, its viewBox (or width and height without one), and clips
 * what crosses it: files cut from a bigger drawing often keep the rest of it there.
 */
function cropToView(items: Item[], svg: Element): Item[] {
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const [x, y, w, h] =
    box.length === 4 && box.every(Number.isFinite)
      ? box
      : [0, 0, ...['width', 'height'].map((side) => Number(/^\s*([\d.]+)\s*(px)?\s*$/.exec(svg.getAttribute(side) ?? '')?.[1]))];
  if (!(w > 0 && h > 0)) return items;
  const view = { x0: x, y0: y, x1: x + w, y1: y + h };
  const frame: Region = [{ contours: [{ closed: true, nodes: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map((p) => makeNode(p as Pt)) }], evenodd: false }];
  return items.flatMap((item) => {
    const b = itemBounds(item);
    if (!overlaps(b, view)) return [];
    const inside = b.x0 >= view.x0 && b.y0 >= view.y0 && b.x1 <= view.x1 && b.y1 <= view.y1;
    return [inside ? item : { ...item, clips: [...item.clips, frame] }];
  });
}

async function applyClips(items: Item[]): Promise<Item[]> {
  if (!items.some((item) => item.clips.length)) return items;
  const paper = await loadPaper();
  const regions = new Map<Region, paper.PathItem>();
  const regionItem = (region: Region) => {
    let item = regions.get(region);
    if (!item) {
      item = region.map((part) => toPaper(paper, part.contours, part.evenodd)).reduce((a, b) => a.unite(b));
      regions.set(region, item);
    }
    return item;
  };

  const out: Item[] = [];
  for (const item of items) {
    if (item.clips.length === 0) {
      out.push(item);
      continue;
    }
    try {
      const clip = item.clips.map(regionItem).reduce((a, b) => a.intersect(b));
      if (item.fill) {
        const contours = fromPaper(paper, toPaper(paper, item.contours, item.evenodd).intersect(clip));
        if (contours.length) out.push({ ...item, contours, evenodd: true, stroke: undefined, clips: [] });
      }
      if (item.stroke) {
        // Only the stroke's line is cut, so it stays a line rather than closing round the clip.
        const contours = fromPaper(paper, toPaper(paper, item.contours, false, true).intersect(clip, { trace: false }));
        if (contours.length) out.push({ ...item, contours, fill: undefined, clips: [] });
      }
    } catch {
      out.push({ ...item, clips: [] });
    }
  }
  return out;
}

// ---- layers ----

type Part = { key: string; items: Item[]; footprints: Footprint[]; contours: number };

const paintKey = (item: Item) => `${item.fill ?? ''}|${item.stroke ? `${item.stroke.color}@${item.stroke.width.toFixed(2)}` : ''}`;

/** Where an item paints. Only fills get an exact outline; a stroke counts as its whole box. */
type Footprint = { box: Bounds; polygons: { points: Pt[]; box: Bounds }[] | null };

function footprint(item: Item): Footprint {
  const polygons = item.stroke ? null : item.contours.map((c) => flatten(c, 6)).filter((points) => points.length > 2);
  return { box: itemBounds(item), polygons: polygons?.map((points) => ({ points, box: pointsBounds(points) })) ?? null };
}

const pointsBounds = (points: Pt[]): Bounds => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return { x0, y0, x1, y1 };
};

const side = (a: Pt, b: Pt, p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

/** How many times outlines wind round a point; fills are wound so anything but 0 is inside. */
function winding(polygons: { points: Pt[] }[], p: Pt) {
  let w = 0;
  for (const { points } of polygons) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [a, b] = [points[j], points[i]];
      if (a[1] <= p[1]) {
        if (b[1] > p[1] && side(a, b, p) > 0) w++;
      } else if (b[1] <= p[1] && side(a, b, p) < 0) w--;
    }
  }
  return w;
}

/** The edges of outlines that reach into a box. */
function edgesIn(polygons: { points: Pt[]; box: Bounds }[], r: Bounds) {
  const edges: [Pt, Pt][] = [];
  for (const { points, box } of polygons) {
    if (!overlaps(box, r)) continue;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [a, b] = [points[j], points[i]];
      if (Math.max(a[0], b[0]) >= r.x0 && Math.min(a[0], b[0]) <= r.x1 && Math.max(a[1], b[1]) >= r.y0 && Math.min(a[1], b[1]) <= r.y1) edges.push([a, b]);
    }
  }
  return edges;
}

/** Whether two items paint any of the same spot. Shapes that only share an edge don't. */
function touches(a: Footprint, b: Footprint) {
  if (!overlaps(a.box, b.box)) return false;
  if (!a.polygons || !b.polygons) return true;
  const r = { x0: Math.max(a.box.x0, b.box.x0), y0: Math.max(a.box.y0, b.box.y0), x1: Math.min(a.box.x1, b.box.x1), y1: Math.min(a.box.y1, b.box.y1) };
  const [ea, eb] = [edgesIn(a.polygons, r), edgesIn(b.polygons, r)];
  for (const [p, q] of ea) {
    for (const [u, v] of eb) if (side(p, q, u) * side(p, q, v) < 0 && side(u, v, p) * side(u, v, q) < 0) return true;
  }
  // No outlines cross, so each outline is wholly inside the other item or wholly out of it.
  return a.polygons.some(({ points }) => winding(b.polygons!, points[0]) !== 0) || b.polygons.some(({ points }) => winding(a.polygons!, points[0]) !== 0);
}

/**
 * Gathers items painted alike into layers. An item can sink into an earlier layer of its paint
 * as long as nothing painted differently in between overlaps it.
 */
function mergeItems(items: Item[]): Part[] {
  const parts: Part[] = [];
  for (const item of items) {
    const key = paintKey(item);
    const print = footprint(item);
    // A layer draws all its fills, then all its strokes; with both, overlapping members would show strokes they used to cover.
    const both = Boolean(item.fill && item.stroke);
    let target: Part | null = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      const fits = part.contours + item.contours.length <= MAX_CONTOURS;
      if (part.key === key && !both && fits) {
        target = part;
        break;
      }
      const hit = part.footprints.some((f) => touches(f, print));
      if (part.key === key && !hit && fits) {
        target = part;
        break;
      }
      if (hit) break;
    }
    if (!target) parts.push((target = { key, items: [], footprints: [], contours: 0 }));
    target.items.push(item);
    target.footprints.push(print);
    target.contours += item.contours.length;
  }
  return parts;
}

/** Layers by paint, in the order each paint first shows, starting another when one is full. */
function groupByPaint(items: Item[]): Part[] {
  const parts: Part[] = [];
  const open = new Map<string, Part>();
  for (const item of items) {
    const key = paintKey(item);
    let part = open.get(key);
    if (!part || part.contours + item.contours.length > MAX_CONTOURS) {
      parts.push((part = { key, items: [], footprints: [], contours: 0 }));
      open.set(key, part);
    }
    part.items.push(item);
    part.contours += item.contours.length;
  }
  return parts;
}

/**
 * Separates a detailed drawing into one layer per paint, as a print shop separates colours. The
 * layers are stacked in the order that keeps most overlaps the right way up; where one still
 * isn't, the shape underneath is cut away under the one that should cover it.
 */
async function separate(items: Item[]): Promise<Part[]> {
  const paper = await loadPaper();
  const breathe = breather();
  // A fill and its stroke can go in different layers.
  const pieces = items.flatMap((item) => [...(item.fill ? [{ ...item, stroke: undefined }] : []), ...(item.stroke ? [{ ...item, fill: undefined }] : [])]);
  const keys = pieces.map(paintKey);
  const paints = [...new Set(keys)];
  const paintOf = keys.map((key) => paints.indexOf(key));
  const prints = pieces.map(footprint);

  // How much each paint wants to sit under each other one. A stroke can't cut what's under it,
  // so being under one counts for far more.
  const under = paints.map(() => new Float64Array(paints.length));
  const overlaps: [number, number][] = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (paintOf[i] === paintOf[j] || !touches(prints[i], prints[j])) continue;
      overlaps.push([i, j]);
      under[paintOf[i]][paintOf[j]] += pieces[j].fill ? 1 : 1000;
    }
    await breathe();
  }
  // Bottom up, each time the paint that most wants to be under the rest.
  const rank = new Array<number>(paints.length);
  const left = new Set(paints.keys());
  for (let r = 0; r < paints.length; r++) {
    let [best, most] = [-1, -Infinity];
    for (const a of left) {
      let score = 0;
      for (const b of left) score += under[a][b] - under[b][a];
      if (score > most) [best, most] = [a, score];
    }
    rank[best] = r;
    left.delete(best);
  }

  const cutters = pieces.map(() => [] as number[]);
  for (const [i, j] of overlaps) if (rank[paintOf[j]] < rank[paintOf[i]] && pieces[j].fill) cutters[i].push(j);
  const paths = new Map<number, paper.PathItem>();
  const pathOf = (i: number) => paths.get(i) ?? paths.set(i, toPaper(paper, pieces[i].contours, false)).get(i)!;
  const out: { piece: Item; rank: number }[] = [];
  for (const [i, piece] of pieces.entries()) {
    let contours = piece.contours;
    if (cutters[i].length) {
      let shape = piece.fill ? pathOf(i) : toPaper(paper, piece.contours, false, true);
      for (const j of cutters[i]) {
        try {
          shape = piece.fill ? shape.subtract(pathOf(j)) : shape.subtract(pathOf(j), { trace: false });
        } catch {
          // Paper can trip on degenerate curves; leaving the shape whole is the lesser harm.
        }
        await breathe();
        if (shape.isEmpty()) break;
      }
      contours = fromPaper(paper, shape);
      if (piece.fill) contours = orient(contours, true);
    }
    if (contours.length) out.push({ piece: { ...piece, contours }, rank: rank[paintOf[i]] });
  }
  return groupByPaint(out.sort((a, b) => a.rank - b.rank).map(({ piece }) => piece));
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
/** Handles too short to show once rounded are left off. */
const roundPair = (v?: [number, number]): [number, number] | undefined => (v && Math.hypot(v[0], v[1]) >= 1.5e-4 ? [round(v[0]), round(v[1])] : undefined);

function partLayer(part: Part, place: Affine, scale: number, W: number, group: string | null, name?: string): StudioLayer {
  const first = part.items[0];
  const contours = mapContours(
    part.items.flatMap((item) => item.contours),
    place,
  );
  const stroke = first.stroke ? first.stroke.width * scale : 0;
  const fit = fitContours(contours);
  const w = Math.max(MIN_SIDE, fit.w + stroke);
  const h = Math.max(MIN_SIDE, fit.h + stroke);
  const fill = first.fill ?? first.stroke!.color;
  const colors = [fill, first.stroke?.color ?? fill];
  return {
    id: uid(),
    emblemId: 'shape',
    name: name ?? part.items.find((item) => item.name)?.name ?? `${colorName(fill)} ${first.fill ? 'shape' : 'line'}`,
    src: '',
    shape: {
      kind: 'path',
      fill: Boolean(first.fill),
      stroke,
      // Rounded finely enough to stay sharp in an export, and keep the design small.
      contours: fit.contours.map((c) => ({ closed: c.closed, nodes: c.nodes.map((n) => makeNode([round(n.x), round(n.y)], roundPair(n.in), roundPair(n.out))) })),
      ...(first.fill && { nonzero: true }),
    },
    aspect: w / h,
    palette: [...colors],
    colors,
    x: fit.cx / W,
    y: fit.cy,
    size: h,
    rotation: 0,
    flipX: false,
    flipY: false,
    outline: null,
    repeat: null,
    ...(group && { group }),
  };
}

