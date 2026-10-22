'use client';

import React from 'react';
import type { StudioDesign } from '@/lib/studio-design';
import { FlagArt, type Hrefs } from './FlagArt';
import { construction, type Pt } from './construction';
import { documentColors } from './model';

/**
 * A flag drawn with its construction, the way reference sheets give it: chains of lengths along
 * the top and down the hoist, in units of which the hoist has `units`, sizes measured where they
 * are, dashed guides, and the colours it's painted in.
 */

export type SheetOptions = { units: number; field: boolean; emblems: boolean; colors: boolean };

/** Flag units to sheet pixels. */
const S = 420;
const ROW = 32;
const PAD = 22;
const TITLE = 50;
const SWATCH = 30;
const INK = '#18181b';
const FAINT = '#a1a1aa';
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

/** A length in units: whole when it nearly is, else to two places. */
export function formatUnits(v: number) {
  const r = Math.round(v);
  return Math.abs(v - r) < 0.005 ? String(r) : String(Math.round(v * 100) / 100);
}

export function sheetLayout(design: StudioDesign, options: SheetOptions) {
  const c = construction(design, options);
  // A chain the field's already gives isn't drawn twice.
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const across = [c.field.xs, c.emblems.xs].filter((s, i, all) => s.length && !(i && same(s, all[0])));
  const down = [c.field.ys, c.emblems.ys].filter((s, i, all) => s.length && !(i && same(s, all[0])));
  const colors = options.colors ? documentColors(design) : [];
  const flag = { w: c.W * S, h: S };
  const left = 24 + (down.length + 1) * ROW + PAD - ROW / 2;
  const top = TITLE + (across.length + 1) * ROW + PAD - ROW / 2;
  const width = Math.max(left + flag.w + 56, 520);
  // Swatches wrap to the sheet's width.
  const perLine = Math.max(1, Math.floor((width - 48) / 104));
  const bottom = colors.length ? 28 + Math.ceil(colors.length / perLine) * SWATCH + 12 : 40;
  return { c, across, down, colors, perLine, flag, left, top, width: Math.round(width), height: Math.round(top + flag.h + bottom) };
}

export function ConstructionSheet({
  design,
  name,
  options,
  hrefs,
  ...rest
}: { design: StudioDesign; name: string; options: SheetOptions; hrefs?: Hrefs } & Omit<React.SVGProps<SVGSVGElement>, 'viewBox'>) {
  const layout = sheetLayout(design, options);
  const { c, across, down, colors, perLine, flag, left, top, width, height } = layout;
  const N = options.units;
  const X = (x: number) => left + x * S;
  const Y = (y: number) => top + y * S;
  const P = ([x, y]: Pt): Pt => [X(x), Y(y)];
  const label = (length: number) => formatUnits(length * N);

  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox={`0 0 ${width} ${height}`} fontFamily={FONT} {...rest}>
      <rect width={width} height={height} fill='#ffffff' />
      <text x={24} y={30} fontSize={16} fontWeight={600} fill={INK}>
        {name}
      </text>
      <text x={width - 24} y={30} fontSize={12} fill='#52525b' textAnchor='end'>
        {`${formatUnits(design.ratio[0])}:${formatUnits(design.ratio[1])} · ${N} × ${label(c.W)} units`}
      </text>

      <FlagArt design={design} hrefs={hrefs} x={left} y={top} width={flag.w} height={flag.h} />
      <rect x={left} y={top} width={flag.w} height={flag.h} fill='none' stroke='#d4d4d8' strokeWidth={1} />

      {/* Guides and sizes over the flag, haloed so they read on any colour. */}
      <g fill='none' strokeLinecap='round'>
        {c.guides.map((g, i) =>
          g.kind === 'line' ? (
            <g key={i}>
              <line x1={X(g.a[0])} y1={Y(g.a[1])} x2={X(g.b[0])} y2={Y(g.b[1])} stroke='#ffffff' strokeOpacity={0.7} strokeWidth={3} />
              <line x1={X(g.a[0])} y1={Y(g.a[1])} x2={X(g.b[0])} y2={Y(g.b[1])} stroke={INK} strokeWidth={1} strokeDasharray='6 4' />
            </g>
          ) : (
            <g key={i}>
              <circle cx={X(g.c[0])} cy={Y(g.c[1])} r={g.r * S} stroke='#ffffff' strokeOpacity={0.7} strokeWidth={3} />
              <circle cx={X(g.c[0])} cy={Y(g.c[1])} r={g.r * S} stroke={INK} strokeWidth={1} strokeDasharray='6 4' />
            </g>
          ),
        )}
        {c.centres.map(([x, y], i) => (
          <g key={i} transform={`translate(${X(x)} ${Y(y)})`}>
            <path d='M-6 0H6M0 -6V6' stroke='#ffffff' strokeOpacity={0.8} strokeWidth={3} />
            <path d='M-6 0H6M0 -6V6' stroke={INK} strokeWidth={1.1} />
          </g>
        ))}
      </g>
      {c.dims.map((d, i) => (
        <InlineDim key={i} a={P(d.a)} b={P(d.b)} text={label(Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]))} />
      ))}

      {/* Chains: the field's nearest the flag, then the emblems', then the whole. */}
      {[...across, [0, c.W]].map((stops, row) => (
        <Chain key={row} stops={stops.map(X)} at={top - PAD - row * ROW} from={top} labels={stops.slice(1).map((v, i) => label(v - stops[i]))} />
      ))}
      {[...down, [0, 1]].map((stops, row) => (
        <Chain key={row} vertical stops={stops.map(Y)} at={left - PAD - row * ROW} from={left} labels={stops.slice(1).map((v, i) => label(v - stops[i]))} />
      ))}

      {colors.map((color, i) => {
        const x = 24 + (i % perLine) * 104;
        const y = top + flag.h + 28 + Math.floor(i / perLine) * SWATCH;
        return (
          <g key={color}>
            <rect x={x} y={y} width={18} height={18} rx={4} fill={color} stroke='#00000026' />
            <text x={x + 26} y={y + 13} fontSize={12} fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {color.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A tick across a dimension line where it stops, slanted as drafters draw them. */
const tick = (x: number, y: number) => `M${x - 4} ${y + 4}L${x + 4} ${y - 4}`;

function Chain({ stops, labels, at, from, vertical }: { stops: number[]; labels: string[]; at: number; from: number; vertical?: boolean }) {
  // Drawn across; a vertical chain is the same turned a quarter, reading up.
  const flip = (x: number, y: number): [number, number] => (vertical ? [y, x] : [x, y]);
  const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width: number) => {
    const [a, b] = [flip(x1, y1), flip(x2, y2)];
    return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={stroke} strokeWidth={width} />;
  };
  let narrow = 0;
  return (
    <g fill={INK} fontSize={11} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {stops.map((s, i) => (
        <React.Fragment key={i}>
          {line(s, from - 5, s, at - 6, FAINT, 0.75)}
          <path d={vertical ? tick(at, s) : tick(s, at)} stroke={INK} strokeWidth={1.3} />
        </React.Fragment>
      ))}
      {line(stops[0], at, stops[stops.length - 1], at, INK, 1)}
      {labels.map((text, i) => {
        const mid = (stops[i] + stops[i + 1]) / 2;
        // Lengths too short for their label go either side of the line in turn.
        const fits = stops[i + 1] - stops[i] > text.length * 6.5 + 6;
        const below = !fits && narrow++ % 2 === 1;
        const off = below ? 14 : -5;
        const [x, y] = flip(mid, at + off);
        return (
          <text key={i} x={x} y={y} textAnchor='middle' transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}>
            {text}
          </text>
        );
      })}
    </g>
  );
}

function InlineDim({ a, b, text }: { a: Pt; b: Pt; text: string }) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy) || 1;
  // The label sits off the line to the right, or below when it runs across.
  let n: Pt = [-dy / len, dx / len];
  if (n[0] < -1e-6 || (Math.abs(n[0]) < 1e-6 && n[1] < 0)) n = [-n[0], -n[1]];
  const mid: Pt = [(a[0] + b[0]) / 2 + n[0] * 9, (a[1] + b[1]) / 2 + n[1] * 9];
  const anchor = n[0] > 0.5 ? 'start' : n[0] < -0.5 ? 'end' : 'middle';
  const end = ([x, y]: Pt) => {
    // A slanted tick, turned with the line.
    const [ux, uy] = [dx / len, dy / len];
    const [tx, ty] = [(ux - n[0]) * 3.2, (uy - n[1]) * 3.2];
    return `M${x - tx} ${y - ty}L${x + tx} ${y + ty}`;
  };
  const d = `M${a[0]} ${a[1]}L${b[0]} ${b[1]}${end(a)}${end(b)}`;
  return (
    <g>
      <path d={d} fill='none' stroke='#ffffff' strokeOpacity={0.8} strokeWidth={3.2} strokeLinecap='round' />
      <path d={d} fill='none' stroke={INK} strokeWidth={1.1} strokeLinecap='round' />
      <text
        x={mid[0]}
        y={mid[1]}
        dy={n[1] > 0.5 ? 9 : 4}
        textAnchor={anchor}
        fontSize={11}
        fontWeight={600}
        fill={INK}
        stroke='#ffffff'
        strokeWidth={3}
        strokeLinejoin='round'
        paintOrder='stroke'
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    </g>
  );
}

