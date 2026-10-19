// Runs inside a headless browser page (see backfill-flag-parts.ts). Splits a flag SVG into its
// field (every shape that reaches the flag's edge) and objects (groups of shapes that don't),
// each written out as an SVG of its own.

/** Longest side, in px, the cut SVGs declare, so they rasterize crisply. */
const PART_SIZE = 1000;
const FIELD_SIZE = 1600;

window.extractParts = async function extractParts(svgText, opts = {}) {
  const RENDER_W = opts.width ?? 600;
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const NON_RENDERED = 'defs,clipPath,mask,pattern,symbol,marker,linearGradient,radialGradient,filter,metadata,foreignObject,style,title,desc';
  const LEAF = 'path,rect,circle,ellipse,polygon,polyline,line,text,image';

  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Not an SVG');
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  const root = document.importNode(parsed.documentElement, true);
  root.querySelectorAll('script').forEach((s) => s.remove());
  host.appendChild(root);

  // The flag's own coordinate box.
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && !String(v).trim().endsWith('%') ? n : null;
  };
  let vb = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = num(root.getAttribute('width')) ?? 300;
    const h = num(root.getAttribute('height')) ?? 200;
    vb = [0, 0, w, h];
    root.setAttribute('viewBox', vb.join(' '));
  }
  const aspect = vb[2] / vb[3];
  const W = RENDER_W;
  const H = Math.max(8, Math.round(RENDER_W / aspect));
  root.setAttribute('width', W);
  root.setAttribute('height', H);
  root.setAttribute('preserveAspectRatio', 'none');

  const inNonRendered = (el) => !!el.parentElement?.closest(NON_RENDERED);

  // Expand <use> into real copies, so every drawn shape is its own element.
  const hrefOf = (el) => el.getAttribute('href') ?? el.getAttributeNS(XLINK, 'href') ?? el.getAttribute('xlink:href');
  for (let pass = 0; pass < 20; pass++) {
    const live = [...root.querySelectorAll('use')].filter((u) => !u.closest('clipPath,mask,pattern,marker'));
    if (live.length === 0) break;
    for (const use of live) {
      const href = hrefOf(use);
      const ref = href?.startsWith('#') ? root.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) : null;
      if (!ref || ref.contains(use)) {
        use.remove();
        continue;
      }
      const g = document.createElementNS(NS, 'g');
      for (const attr of [...use.attributes]) {
        if (['x', 'y', 'width', 'height', 'href', 'xlink:href', 'id'].includes(attr.name)) continue;
        g.setAttribute(attr.name, attr.value);
      }
      const x = num(use.getAttribute('x')) ?? 0;
      const y = num(use.getAttribute('y')) ?? 0;
      const t = [use.getAttribute('transform') ?? '', x || y ? `translate(${x} ${y})` : ''].filter(Boolean).join(' ');
      if (t) g.setAttribute('transform', t);
      else g.removeAttribute('transform');
      let clone;
      if (ref.localName === 'symbol') {
        clone = document.createElementNS(NS, 'svg');
        for (const name of ['viewBox', 'preserveAspectRatio']) if (ref.getAttribute(name)) clone.setAttribute(name, ref.getAttribute(name));
        clone.setAttribute('width', use.getAttribute('width') ?? '100%');
        clone.setAttribute('height', use.getAttribute('height') ?? '100%');
        clone.setAttribute('overflow', 'visible');
        for (const child of ref.childNodes) clone.appendChild(child.cloneNode(true));
      } else {
        clone = ref.cloneNode(true);
        clone.removeAttribute('id');
      }
      g.appendChild(clone);
      use.replaceWith(g);
    }
  }

  // Compound paths often join unrelated shapes of one colour (a white stripe and a white star).
  // Split them into pieces that don't overlap; overlapping subpaths (a ring and its hole) stay
  // together, so the drawing is unchanged.
  for (const path of [...root.querySelectorAll('path')]) {
    if (inNonRendered(path)) continue;
    const subs = splitSubpaths(path.getAttribute('d') ?? '');
    if (subs.length < 2 || subs.length > 4000) continue;
    const boxes = subs.map((d) => localBox(path, d));
    // Overlapping boxes aren't enough (a crescent beside a diagonal band whose box covers the
    // flag): the pieces must actually reach into each other.
    const temps = subs.length <= 400 ? subs.map((d) => {
      const t = document.createElementNS(NS, 'path');
      t.setAttribute('d', d);
      path.parentNode.appendChild(t);
      return t;
    }) : null;
    const reaches = (a, b) => {
      const tb = temps[b];
      const length = tb.getTotalLength();
      for (let k = 0; k < 12; k++) if (temps[a].isPointInFill(tb.getPointAtLength((length * k) / 12))) return true;
      return false;
    };
    const groups = groupOverlapping(boxes, temps ? (a, b) => reaches(a, b) || reaches(b, a) : null);
    temps?.forEach((t) => t.remove());
    if (groups.length < 2) continue;
    for (const members of groups) {
      const piece = path.cloneNode(false);
      piece.removeAttribute('id');
      piece.setAttribute('d', members.map((k) => subs[k]).join(''));
      path.before(piece);
    }
    path.remove();
  }

  const style = (el) => getComputedStyle(el);
  const leaves = [...root.querySelectorAll(LEAF)].filter((el) => {
    if (inNonRendered(el)) return false;
    if (el.closest('text') && el.localName !== 'text') return false;
    const s = style(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (s.fill === 'none' && s.stroke === 'none' && el.localName !== 'image') return false;
    return true;
  });
  if (leaves.length === 0) throw new Error('No shapes');
  if (leaves.length > 65000) throw new Error('Too many shapes');

  const toHex = (c) => {
    const m = c?.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (a === 0) return null;
    return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const original = leaves.map((el) => {
    const s = style(el);
    return { fill: s.fill, stroke: s.stroke, fillHex: toHex(s.fill), strokeHex: s.stroke !== 'none' && parseFloat(s.strokeWidth) > 0 ? toHex(s.stroke) : null };
  });

  // Keep a clean copy of the expanded SVG to cut parts from; mark leaves so they can be found in it.
  leaves.forEach((el, i) => el.setAttribute('data-leaf', i));
  const clean = root.cloneNode(true);

  // Owner map: each leaf painted in its own flat colour, no antialiasing, so every pixel says
  // which shape is on top there.
  // IDs are scattered over the colour space with a check byte, so an antialiased blend of two
  // shapes' colours never reads as a third shape.
  const MUL = 40503;
  let INV = 1;
  for (let k = 0; k < 16; k++) INV = (INV * (2 - ((MUL * INV) & 0xffff))) & 0xffff;
  const check = (v) => ((v * 157) ^ (v >> 7) ^ 0xa5) & 255;
  const code = (i) => {
    const v = ((i + 1) * MUL) & 0xffff;
    return `rgb(${v >> 8},${v & 255},${check(v)})`;
  };
  const decode = (r, g, b) => {
    const v = (r << 8) | g;
    if (check(v) !== b) return -1;
    return ((v * INV) & 0xffff) - 1;
  };
  root.setAttribute('shape-rendering', 'crispEdges');
  root.querySelectorAll('g,svg,a,switch').forEach((g) => {
    g.style.setProperty('opacity', '1', 'important');
    g.style.setProperty('filter', 'none', 'important');
    g.style.setProperty('mask', 'none', 'important');
  });
  leaves.forEach((el, i) => {
    const c = code(i);
    const paint = (node) => {
      node.style.setProperty('fill', original[i].fill === 'none' ? 'none' : c, 'important');
      node.style.setProperty('stroke', original[i].stroke === 'none' ? 'none' : c, 'important');
      for (const p of ['opacity', 'fill-opacity', 'stroke-opacity']) node.style.setProperty(p, '1', 'important');
      node.style.setProperty('filter', 'none', 'important');
      node.style.setProperty('mask', 'none', 'important');
      node.style.setProperty('shape-rendering', 'crispEdges', 'important');
      node.style.setProperty('text-rendering', 'optimizeSpeed', 'important');
    };
    paint(el);
    el.querySelectorAll('*').forEach(paint);
    if (el.localName === 'image') el.style.setProperty('opacity', '0', 'important');
  });
  const raster = async (svgEl, w, h) => {
    const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Could not render SVG'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h).data;
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const px = await raster(root, W, H);
  const owner = new Int32Array(W * H).fill(-1);
  for (let p = 0; p < W * H; p++) {
    if (px[p * 4 + 3] < 250) continue;
    const id = decode(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
    if (id >= 0 && id < leaves.length) owner[p] = id;
  }

  // Per leaf: visible pixels, bounds, and whether it reaches the flag's edge.
  const n = leaves.length;
  const area = new Int32Array(n);
  const box = Array.from({ length: n }, () => [Infinity, Infinity, -Infinity, -Infinity]);
  const edge = new Uint8Array(n);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = owner[y * W + x];
      if (o < 0) continue;
      area[o]++;
      const b = box[o];
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
      if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) edge[o] = 1;
    }

  // Field: what reaches the edge. Everything else visible is part of an object.
  const isField = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (edge[i]) isField[i] = 1;

  // Group object shapes that touch (within ~1% of the flag's height) into one object.
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const union = (a, b) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent[ra] = rb;
  };
  const r = Math.max(2, Math.round(H * 0.01));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = owner[y * W + x];
      if (a < 0 || isField[a]) continue;
      for (let dy = 0; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dy === 0 && dx <= 0) continue;
          const [nx, ny] = [x + dx, y + dy];
          if (nx < 0 || nx >= W || ny >= H) continue;
          const b = owner[ny * W + nx];
          if (b >= 0 && b !== a && !isField[b]) union(a, b);
        }
    }

  let clusters = new Map();
  for (let i = 0; i < n; i++) {
    if (isField[i] || area[i] === 0) continue;
    const k = find(i);
    if (!clusters.has(k)) clusters.set(k, []);
    clusters.get(k).push(i);
  }
  const summarize = (members) => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    let a = 0;
    const colors = new Map();
    for (const i of members) {
      a += area[i];
      b[0] = Math.min(b[0], box[i][0]);
      b[1] = Math.min(b[1], box[i][1]);
      b[2] = Math.max(b[2], box[i][2]);
      b[3] = Math.max(b[3], box[i][3]);
      const c = original[i].fillHex ?? original[i].strokeHex;
      if (c) colors.set(c, (colors.get(c) ?? 0) + area[i]);
    }
    const palette = [...colors.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
    return { members, box: b, area: a, palette };
  };
  let objects = [...clusters.values()].map(summarize);

  // Specks (dots of lettering, tips of rays) are set aside and join whatever object they sit by.
  const minArea = W * H * 0.0004;
  const specks = objects.filter((o) => o.area < minArea);
  objects = objects.filter((o) => o.area >= minArea);

  // Shapes whose boxes mostly overlap are one object even with gaps between them (petals of a
  // flower, lettering around a seal).
  const boxArea = (b) => Math.max(0, b[2] - b[0] + 1) * Math.max(0, b[3] - b[1] + 1);
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let a = 0; a < objects.length; a++)
      for (let b = a + 1; b < objects.length; b++) {
        const [p, q] = [objects[a].box, objects[b].box];
        const overlap = boxArea([Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.min(p[2], q[2]), Math.min(p[3], q[3])]);
        if (overlap >= 0.3 * Math.min(boxArea(p), boxArea(q))) {
          objects[a] = summarize([...objects[a].members, ...objects[b].members]);
          objects.splice(b, 1);
          merged = true;
          break outer;
        }
      }
  }

  // Repeated twins (a ring of stars, rows of stars) become one object when there are 4 or more.
  const sig = (o) => o.palette.slice(0, 3).join(',');
  const groups = [];
  for (const o of objects) {
    const g = groups.find(
      (g) => sig(g[0]) === sig(o) && Math.abs(g[0].area - o.area) / Math.max(g[0].area, o.area) < 0.25,
    );
    if (g) g.push(o);
    else groups.push([o]);
  }
  objects = groups.flatMap((g) => (g.length >= 4 ? [summarize(g.flatMap((o) => o.members))] : g));

  const near = Math.max(4, H * 0.03);
  for (const speck of specks) {
    const cx = (speck.box[0] + speck.box[2]) / 2;
    const cy = (speck.box[1] + speck.box[3]) / 2;
    const k = objects.findIndex((o) => cx >= o.box[0] - near && cx <= o.box[2] + near && cy >= o.box[1] - near && cy <= o.box[3] + near);
    if (k >= 0) objects[k] = summarize([...objects[k].members, ...speck.members]);
    else for (const i of speck.members) isField[i] = 1;
  }
  objects.sort((a, b) => b.area - a.area);

  // Shapes hidden entirely under others: attach to the object whose box holds them, else the field.
  const leafBox = (i) => {
    const r = leaves[i].getBoundingClientRect();
    const h = root.getBoundingClientRect();
    return [r.left - h.left, r.top - h.top, r.right - h.left, r.bottom - h.top];
  };
  const assigned = new Int32Array(n).fill(-1);
  objects.forEach((o, k) => o.members.forEach((i) => (assigned[i] = k)));
  for (let i = 0; i < n; i++) {
    if (isField[i] || assigned[i] >= 0) continue;
    const lb = leafBox(i);
    const k = objects.findIndex((o) => lb[0] >= o.box[0] - 2 && lb[1] >= o.box[1] - 2 && lb[2] <= o.box[2] + 3 && lb[3] <= o.box[3] + 3);
    if (k >= 0) {
      objects[k].members.push(i);
      assigned[i] = k;
    } else isField[i] = 1;
  }

  // Holes cut out of a field shape (Quebec's fleurs-de-lis are holes in the blue, the white
  // showing through) are objects too, and the field gets them filled in.
  const rootUser = (el) => root.getScreenCTM().inverse().multiply(el.getScreenCTM());
  const userToPx = new DOMMatrix().scale(W / vb[2], H / vb[3]).translate(-vb[0], -vb[1]);
  const clampPx = (q) => Math.min(H - 1, Math.max(0, Math.round(q.y))) * W + Math.min(W - 1, Math.max(0, Math.round(q.x)));
  const fieldD = new Map();
  const holes = [];
  for (let i = 0; i < n; i++) {
    if (!isField[i] || leaves[i].localName !== 'path') continue;
    const el = leaves[i];
    const subs = splitSubpaths(el.getAttribute('d') ?? '');
    if (subs.length < 2 || subs.length > 4000) continue;
    const toPx = userToPx.multiply(rootUser(el));
    const boxes = subs.map((d) => localBox(el, d));
    const removed = new Set();
    subs.forEach((d, k) => {
      if (removed.has(k)) return;
      const b = boxes[k];
      const pb = transformBox(toPx, b);
      if (pb[0] <= 2 || pb[1] <= 2 || pb[2] >= W - 3 || pb[3] >= H - 3 || boxArea(pb) < minArea * 4) return;
      const temp = el.cloneNode(false);
      temp.setAttribute('d', d);
      temp.removeAttribute('data-leaf');
      el.parentNode.appendChild(temp);
      let inside = 0;
      let hole = 0;
      const owners = new Map();
      for (let sy = 0; sy < 11; sy++)
        for (let sx = 0; sx < 11; sx++) {
          const pt = new DOMPoint(b[0] + ((sx + 0.5) / 11) * (b[2] - b[0]), b[1] + ((sy + 0.5) / 11) * (b[3] - b[1]));
          if (!temp.isPointInFill(pt)) continue;
          inside++;
          if (el.isPointInFill(pt)) continue;
          hole++;
          const o = owner[clampPx(pt.matrixTransform(toPx))];
          owners.set(o, (owners.get(o) ?? 0) + 1);
        }
      temp.remove();
      if (inside < 4 || hole < inside * 0.7) return;
      removed.add(k);
      boxes.forEach((c, j) => {
        if (j !== k && c[0] >= b[0] && c[1] >= b[1] && c[2] <= b[2] && c[3] <= b[3]) removed.add(j);
      });
      let underObject = 0;
      const colors = new Map();
      for (const [o, count] of owners) {
        if (o >= 0 && !isField[o]) underObject += count;
        const c = o >= 0 ? (original[o].fillHex ?? original[o].strokeHex) : null;
        if (c) colors.set(c, (colors.get(c) ?? 0) + count);
      }
      // Something already sits in the hole (a coat of arms in a frame): just fill the field in.
      if (underObject > hole / 2) return;
      holes.push({ d, matrix: rootUser(el), box: pb, palette: [...colors.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c) });
    });
    if (removed.size) fieldD.set(i, subs.filter((_, k) => !removed.has(k)).join(''));
  }

  // Cut the parts out of the clean copy.
  const serialize = (keep, viewBox, size, { d = new Map(), clip = null } = {}) => {
    const svg = clean.cloneNode(true);
    svg.querySelectorAll('[data-leaf]').forEach((el) => {
      const i = Number(el.getAttribute('data-leaf'));
      if (!keep.has(i)) el.remove();
      else if (d.has(i)) el.setAttribute('d', d.get(i));
    });
    svg.querySelectorAll('[data-leaf]').forEach((el) => el.removeAttribute('data-leaf'));
    if (clip) {
      const id = 'vexilo-hole';
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('clip-path', `url(#${id})`);
      for (const child of [...svg.childNodes]) if (!['defs', 'style', 'title', 'metadata'].includes(child.localName)) g.appendChild(child);
      const defs = document.createElementNS(NS, 'defs');
      const cp = document.createElementNS(NS, 'clipPath');
      cp.setAttribute('id', id);
      cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', clip.d);
      const m = clip.matrix;
      path.setAttribute('transform', `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((v) => +v.toFixed(6)).join(' ')})`);
      cp.appendChild(path);
      defs.appendChild(cp);
      svg.append(defs, g);
    }
    svg.setAttribute('viewBox', viewBox.map((v) => +v.toFixed(3)).join(' '));
    const k = size / Math.max(viewBox[2], viewBox[3]);
    svg.setAttribute('width', Math.max(1, Math.round(viewBox[2] * k)));
    svg.setAttribute('height', Math.max(1, Math.round(viewBox[3] * k)));
    svg.removeAttribute('preserveAspectRatio');
    svg.removeAttribute('shape-rendering');
    return new XMLSerializer().serializeToString(svg);
  };
  const cropTo = (b) => {
    const pad = 2;
    const [x0, y0, x1, y1] = [Math.max(0, b[0] - pad), Math.max(0, b[1] - pad), Math.min(W, b[2] + 1 + pad), Math.min(H, b[3] + 1 + pad)];
    const frac = [x0 / W, y0 / H, x1 / W, y1 / H];
    return { frac, viewBox: [vb[0] + frac[0] * vb[2], vb[1] + frac[1] * vb[3], (frac[2] - frac[0]) * vb[2], (frac[3] - frac[1]) * vb[3]] };
  };
  const fieldKeep = new Set();
  for (let i = 0; i < n; i++) if (isField[i] || assigned[i] < 0) fieldKeep.add(i);
  const fieldPalette = summarize([...fieldKeep].filter((i) => area[i] > 0)).palette;
  const parts = [
    ...objects.map((o) => {
      const { frac, viewBox } = cropTo(o.box);
      return { kind: 'shapes', svg: serialize(new Set(o.members), viewBox, PART_SIZE), box: frac, palette: o.palette.slice(0, 12), leaves: o.members.length, share: o.area / (W * H) };
    }),
    ...holes.map((h) => {
      const { frac, viewBox } = cropTo(h.box);
      return { kind: 'hole', svg: serialize(fieldKeep, viewBox, PART_SIZE, { clip: h }), box: frac, palette: h.palette.slice(0, 12), leaves: 1, share: boxArea(h.box) / (W * H) };
    }),
  ].sort((a, b) => b.share - a.share);
  return {
    aspect,
    leaves: n,
    field: { svg: serialize(fieldKeep, vb, FIELD_SIZE, { d: fieldD }), palette: fieldPalette, leaves: fieldKeep.size, filledHoles: fieldD.size },
    objects: parts,
  };
};

/**
 * Whether a field SVG is exactly one of the flag maker's layouts, so it can stay editable as one.
 * `candidates` hold each layout variant's shapes in flag units (the flag is `aspect` wide, 1 tall).
 * Returns the best match whose colours explain all but `tolerance` of the field, or null.
 */
window.fitLayout = async function fitLayout(svgText, aspect, candidates, tolerance = 0.015) {
  const w = 240;
  const h = Math.max(8, Math.round(w / aspect));
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not render field'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;

  const labels = document.createElement('canvas');
  labels.width = w;
  labels.height = h;
  const lctx = labels.getContext('2d', { willReadFrequently: true });
  let best = null;
  for (const candidate of candidates) {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, w, h);
    lctx.setTransform(w / aspect, 0, 0, h, 0, 0);
    for (const shape of candidate.shapes) {
      lctx.fillStyle = `rgb(${shape.slot * 30 + 10},0,0)`;
      lctx.fill(new Path2D(shape.d));
    }
    const data = lctx.getImageData(0, 0, w, h).data;
    const slots = new Int8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const slot = Math.round((data[p * 4] - 10) / 30);
      slots[p] = data[p * 4 + 3] < 255 || Math.abs(data[p * 4] - (slot * 30 + 10)) > 3 ? -1 : slot;
    }
    const hist = Array.from({ length: candidate.slots }, () => [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]);
    const counts = new Uint32Array(candidate.slots);
    let total = 0;
    for (let p = 0; p < w * h; p++) {
      const slot = slots[p];
      if (slot < 0 || slot >= candidate.slots || pixels[p * 4 + 3] < 200) continue;
      for (let c = 0; c < 3; c++) hist[slot][c][pixels[p * 4 + c]]++;
      counts[slot]++;
      total++;
    }
    if (total === 0 || [...counts].some((n) => n < total * 0.01)) continue;
    const medians = hist.map((channels, slot) =>
      channels.map((bins) => {
        let seen = 0;
        for (let v = 0; v < 256; v++) if ((seen += bins[v]) * 2 >= counts[slot]) return v;
        return 0;
      }),
    );
    let off = 0;
    for (let p = 0; p < w * h; p++) {
      const slot = slots[p];
      if (slot < 0 || slot >= candidate.slots || pixels[p * 4 + 3] < 200) continue;
      const m = medians[slot];
      if (Math.hypot(pixels[p * 4] - m[0], pixels[p * 4 + 1] - m[1], pixels[p * 4 + 2] - m[2]) > 48) off++;
    }
    const share = off / total;
    const score = share + candidate.slots * 0.001;
    if (share <= tolerance && (!best || score < best.score))
      best = { layout: candidate.layout, params: candidate.params, medians, unexplained: share, score };
  }
  return best;
};

/** A path's subpaths, each rewritten with absolute coordinates so it stands on its own. */
function splitSubpaths(d) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(d))) tokens.push(m[1] ?? Number(m[2]));
  const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const subs = [];
  let out = '';
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = null;
  let i = 0;
  // Arc flags may be packed ("a1 1 0 011 1"): re-read them digit by digit.
  const flat = [];
  for (let t = 0; t < tokens.length; t++) flat.push(tokens[t]);
  const fmt = (v) => +v.toFixed(4);
  const take = (count, isArc) => {
    const vals = [];
    while (vals.length < count) {
      const v = flat[i];
      if (typeof v !== 'number') return null;
      if (isArc && (vals.length === 3 || vals.length === 4) && !(v === 0 || v === 1)) {
        // Packed flags like 011 → 0, 1, 1
        const str = String(flat[i]);
        const digits = str.match(/^[01]+/)?.[0];
        if (!digits) return null;
        vals.push(Number(digits[0]));
        const rest = str.slice(1);
        if (rest === '') i++;
        else flat[i] = Number(rest.startsWith('.') ? '0' + rest : rest);
        continue;
      }
      vals.push(v);
      i++;
    }
    return vals;
  };
  while (i < flat.length) {
    if (typeof flat[i] === 'string') cmd = flat[i++];
    else if (cmd === null) return [];
    const C = cmd.toUpperCase();
    const rel = cmd !== C;
    if (C === 'Z') {
      out += 'Z';
      [x, y] = [sx, sy];
      cmd = null;
      continue;
    }
    const v = take(ARGS[C], C === 'A');
    if (!v) return [];
    if (C === 'M') {
      if (out) subs.push(out);
      [x, y] = rel ? [x + v[0], y + v[1]] : v;
      [sx, sy] = [x, y];
      out = `M${fmt(x)} ${fmt(y)}`;
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L' || C === 'T') {
      [x, y] = rel ? [x + v[0], y + v[1]] : v;
      out += `${C}${fmt(x)} ${fmt(y)}`;
    } else if (C === 'H') {
      x = rel ? x + v[0] : v[0];
      out += `H${fmt(x)}`;
    } else if (C === 'V') {
      y = rel ? y + v[0] : v[0];
      out += `V${fmt(y)}`;
    } else if (C === 'A') {
      const [ex, ey] = rel ? [x + v[5], y + v[6]] : [v[5], v[6]];
      out += `A${fmt(v[0])} ${fmt(v[1])} ${fmt(v[2])} ${v[3]} ${v[4]} ${fmt(ex)} ${fmt(ey)}`;
      [x, y] = [ex, ey];
    } else {
      const pts = [];
      for (let k = 0; k < v.length; k += 2) pts.push(rel ? [x + v[k], y + v[k + 1]] : [v[k], v[k + 1]]);
      out += C + pts.map(([px, py]) => `${fmt(px)} ${fmt(py)}`).join(' ');
      [x, y] = pts[pts.length - 1];
    }
  }
  if (out) subs.push(out);
  return subs;
}

/** Bounds of path data in an element's own coordinates, as [x0, y0, x1, y1]. */
function localBox(el, d) {
  const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  temp.setAttribute('d', d);
  el.parentNode.appendChild(temp);
  const b = temp.getBBox();
  temp.remove();
  return [b.x, b.y, b.x + b.width, b.y + b.height];
}

/** Index groups whose boxes overlap, directly or through others. */
function groupOverlapping(boxes, interacts) {
  const parent = boxes.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a][0] - boxes[b][0]);
  for (let a = 0; a < order.length; a++)
    for (let b = a + 1; b < order.length; b++) {
      const [p, q] = [boxes[order[a]], boxes[order[b]]];
      if (q[0] > p[2]) break;
      if (q[1] > p[3] || q[3] < p[1] || find(order[a]) === find(order[b])) continue;
      if (!interacts || interacts(order[a], order[b])) parent[find(order[a])] = find(order[b]);
    }
  const groups = new Map();
  boxes.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  return [...groups.values()];
}

/** A local box through a matrix, as an axis-aligned box. */
function transformBox(m, b) {
  const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
  return [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))];
}
