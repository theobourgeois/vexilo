import { type ChildNode, type Element, isCDATA, isTag, isText } from 'domhandler';
import { DomUtils, parseDocument } from 'htmlparser2';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
/** Deep enough for any drawing, and short of what recursion can't handle. */
const MAX_DEPTH = 256;
/** More tags than any flag has. The parser slows down badly on deep nesting, so this keeps a hostile file from tying it up. */
const MAX_TAGS = 100_000;

const ELEMENTS = new Set(
  `svg g defs symbol use switch path rect circle ellipse line polyline polygon text tspan textPath title desc
  marker linearGradient radialGradient stop pattern clipPath mask style image filter feBlend feColorMatrix
  feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow
  feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feMerge feMergeNode feMorphology feOffset fePointLight
  feSpecularLighting feSpotLight feTile feTurbulence`.split(/\s+/),
);

const ATTRIBUTES = new Set(
  `id class style version baseProfile viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry fx fy fr dx dy
  width height d points pathLength transform transform-origin gradientTransform gradientUnits patternTransform
  patternUnits patternContentUnits spreadMethod clipPathUnits maskUnits maskContentUnits markerUnits markerWidth
  markerHeight refX refY orient offset systemLanguage requiredFeatures requiredExtensions xml:space xml:lang lang
  fill fill-opacity fill-rule stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin
  stroke-miterlimit stroke-opacity stroke-width opacity color stop-color stop-opacity clip clip-path clip-rule mask
  filter flood-color flood-opacity lighting-color marker marker-start marker-mid marker-end display visibility
  overflow paint-order vector-effect shape-rendering color-rendering color-interpolation
  color-interpolation-filters image-rendering text-rendering enable-background mix-blend-mode isolation
  font font-family font-size font-size-adjust font-stretch font-style font-variant font-weight letter-spacing
  word-spacing text-anchor text-decoration dominant-baseline alignment-baseline baseline-shift writing-mode
  direction unicode-bidi textLength lengthAdjust startOffset method spacing rotate
  filterUnits primitiveUnits in in2 result mode type values tableValues slope intercept amplitude exponent k1 k2 k3
  k4 operator order kernelMatrix divisor bias targetX targetY edgeMode preserveAlpha surfaceScale diffuseConstant
  specularConstant specularExponent scale xChannelSelector yChannelSelector stdDeviation radius baseFrequency
  numOctaves seed stitchTiles azimuth elevation z pointsAtX pointsAtY pointsAtZ limitingConeAngle`.split(/\s+/),
);

/** Elements whose text is part of the drawing; text anywhere else is dropped. */
const HOLDS_TEXT = new Set(['text', 'tspan', 'textPath', 'title', 'desc']);
const HREFS = new Set(['href', 'xlink:href']);

/** A picture embedded in the file itself. SVGs are left out, as what's inside couldn't be checked. */
const EMBEDDED_RASTER = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const LOCAL_REF = /^#\S+$/;
const EXTERNAL_URL = /url\(\s*(?!['"]?\s*#)[^)]*\)/gi;
/** CSS that loads from elsewhere without url(), runs code, or hides words behind escapes. */
const UNSAFE_CSS = /\\|@import|expression\s*\(|javascript:|behaviou?r\s*:|-moz-binding|image-set\s*\(|image\s*\(|cross-fade\s*\(|src\s*\(/i;

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const withoutExternalUrls = (value: string) => value.replace(EXTERNAL_URL, 'none');

const cleanCss = (css: string) => (UNSAFE_CSS.test(css) ? null : withoutExternalUrls(css));

/** An element's name without the svg: prefix some tools write. */
const localName = (name: string) => name.replace(/^svg:/, '');

function serializeAttributes(name: string, attribs: Record<string, string>) {
  let out = '';
  let href: string | null = null;
  for (const [attr, value] of Object.entries(attribs)) {
    if (HREFS.has(attr)) {
      const target = value.trim();
      if (name === 'image' ? EMBEDDED_RASTER.test(target) : LOCAL_REF.test(target)) href = target;
    } else if (attr === 'style') {
      const css = cleanCss(value);
      if (css !== null) out += ` style="${escapeXml(css)}"`;
    } else if (ATTRIBUTES.has(attr)) {
      out += ` ${attr}="${escapeXml(withoutExternalUrls(value))}"`;
    }
  }
  // Written as xlink:href, which every SVG reader understands; only the root declares the prefix.
  return { attributes: out, href };
}

function serializeChildren(children: ChildNode[], parent: string, depth: number): string {
  let out = '';
  for (const child of children) {
    if (isTag(child)) out += serializeElement(child, depth);
    else if (HOLDS_TEXT.has(parent) && (isText(child) || isCDATA(child))) out += escapeXml(DomUtils.textContent(child));
  }
  return out;
}

function serializeElement(el: Element, depth: number): string {
  if (depth > MAX_DEPTH) return '';
  const original = localName(el.name);
  // A link is the one thing dropped for what it does, not what it draws: what's inside still shows.
  const name = original === 'a' ? 'g' : original;
  if (!ELEMENTS.has(name)) return '';

  if (name === 'style') {
    const css = cleanCss(DomUtils.textContent(el));
    return css ? `<style>${escapeXml(css)}</style>` : '';
  }

  const { attributes, href } = serializeAttributes(name, el.attribs);
  if (name === 'image' && !href) return '';
  const namespaces = depth === 0 ? ` xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}"` : '';
  const link = href ? ` xlink:href="${escapeXml(href)}"` : '';
  const content = serializeChildren(el.children, name, depth + 1);
  return `<${name}${namespaces}${attributes}${link}${content ? `>${content}</${name}>` : '/>'}`;
}

/**
 * Rebuilds an uploaded SVG from a list of what's known to only draw: scripts, event handlers,
 * links, animation, embedded pages and anything that loads from elsewhere don't make it across.
 * Returns null when the file isn't an SVG, or has far too many tags to be a drawing. What comes out is written fresh rather than patched,
 * so nothing a browser would read differently from this parser survives.
 */
export function sanitizeSvg(source: string): string | null {
  if (source.split('<', MAX_TAGS + 2).length > MAX_TAGS + 1) return null;
  const root = parseDocument(source, { xmlMode: true }).children.find(isTag);
  if (!root || !isTag(root) || localName(root.name) !== 'svg') return null;
  return serializeElement(root, 0);
}
