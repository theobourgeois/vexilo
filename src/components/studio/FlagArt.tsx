'use client';

import React from 'react';
import type { FieldPartRef, StudioDesign, StudioDivision, StudioField, StudioLayer } from '@/lib/studio-design';
import { clipGroups } from './clip';
import { layerImage } from './cutout';
import { divisionGeometry } from './divisions';
import { groupPlacements, layerPlacements, placementTransform, stackUnits } from './groups';
import { useRecolored } from './images';
import { flagWidth, layerBounds, layerCopies, layerWidth } from './model';
import { outlineD } from './outline';
import { shapePath } from './shapes';

export type Hrefs = { field?: string; layers?: Record<string, string> };

/**
 * A design as an SVG in flag units (W wide, 1 tall). `hrefs` replaces the live, recoloured
 * images with fixed ones, which export uses to embed them. `view` shows just that part of the
 * flag (flag units), so a close zoom never draws more than fits on screen. `ghosts` names
 * clipped layers to draw faintly in full on top, so the parts their clip hides can be seen.
 */
export function FlagArt({
  design,
  hrefs,
  view,
  ghosts,
  className,
  style,
  ...rest
}: {
  design: StudioDesign;
  hrefs?: Hrefs;
  view?: { x: number; y: number; w: number; h: number };
  ghosts?: string[];
} & Omit<React.SVGProps<SVGSVGElement>, 'viewBox'>) {
  const W = flagWidth(design);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const outlined = design.layers.filter((layer) => layer.outline && !layer.hidden);
  const edge = outlineD(design.outline, W);
  const trim = design.outline?.trim?.width ? design.outline.trim : null;
  const ghosted = ghosts?.length ? design.layers.filter((layer) => layer.clip && !layer.hidden && ghosts.includes(layer.id)) : [];
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${W} 1`}
      preserveAspectRatio='none'
      className={className}
      style={style}
      {...rest}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          {design.outline && design.outline.kind !== 'rect' ? <path d={edge} clipRule='evenodd' /> : <rect width={W} height={1} />}
        </clipPath>
        {outlined.map((layer) => {
          // Blur the shape's alpha and cut it off sharply: a round, even outline, unlike a
          // morphology dilate, whose square brush leaves flat slabs at every tip.
          const width = layer.outline!.width;
          const blur = width / 2;
          const box = layerBounds(layer, W);
          const pad = width * 2;
          return (
            <filter
              key={layer.id}
              id={`${id}-o-${layer.id}`}
              filterUnits='userSpaceOnUse'
              x={box.x0 - pad}
              y={box.y0 - pad}
              width={box.x1 - box.x0 + pad * 2}
              height={box.y1 - box.y0 + pad * 2}
              colorInterpolationFilters='sRGB'
            >
              <feGaussianBlur in='SourceAlpha' stdDeviation={blur} result='soft' />
              <feComponentTransfer in='soft' result='grown'>
                {/* Alpha ≈ 0.023 is where the blur sits one outline-width out from the edge. */}
                <feFuncA type='linear' slope={120} intercept={-2.236} />
              </feComponentTransfer>
              <feFlood floodColor={layer.outline!.color} />
              <feComposite in2='grown' operator='in' result='ring' />
              <feMerge>
                <feMergeNode in='ring' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
          );
        })}
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <FieldArt field={design.field} W={W} href={hrefs?.field} id={id} />
        {/* A repeated group draws whole, once per copy. */}
        {stackUnits(clipGroups(design.layers).map((run) => ({ group: run[0].group, run }))).map((unit) =>
          (unit[0].group ? groupPlacements(design, unit[0].group, W) : [null]).map((placement, i) => (
            <React.Fragment key={`${unit[0].run[0].id}-${i}`}>
              {unit.map(({ run }) => (
                <ClipGroup
                  key={run[0].id}
                  group={run}
                  field={design.field}
                  W={W}
                  hrefs={hrefs}
                  id={id}
                  scope={i ? `${id}-${i}` : id}
                  transform={placement ? placementTransform(placement) : undefined}
                />
              ))}
            </React.Fragment>
          )),
        )}
        {ghosted.length > 0 && (
          <g opacity={0.35}>
            {ghosted.flatMap((layer) =>
              layerPlacements(design, layer, W).map((placement, i) => (
                <g key={`${layer.id}-${i}`} transform={placementTransform(placement)}>
                  {layerArt(layer, W, id, hrefs)}
                </g>
              )),
            )}
          </g>
        )}
        {/* Twice as wide as it shows: the outside half is clipped away. */}
        {trim && <path d={edge} fill='none' stroke={trim.color} strokeWidth={trim.width * 2} strokeLinejoin='miter' strokeMiterlimit={32} />}
      </g>
    </svg>
  );
}

/**
 * A layer and the layers clipped to it, which only show where it does. Hiding it hides them too.
 * The mask draws it again without its outline, so they stay inside its own edge.
 */
function ClipGroup({
  group,
  field,
  W,
  hrefs,
  id,
  scope,
  transform,
}: {
  group: StudioLayer[];
  field: StudioField;
  W: number;
  hrefs?: Hrefs;
  id: string;
  /** Prefixes the ids it defines, so each copy of a group has its own. */
  scope: string;
  /** Where a group's copy puts it; a field part still clips where it is on the flag. */
  transform?: string;
}) {
  const [base, ...rest] = group;
  if (base.hidden) return null;
  const art = (layer: StudioLayer, outline = true) => layerArt(layer, W, id, hrefs, outline);
  const clipped = rest.filter((layer) => !layer.hidden);
  const maskId = `${scope}-m-${base.id}`;
  return (
    <PartClip target={partTarget(field, base.clip?.kind === 'part' ? base.clip : null)} W={W} id={`${scope}-c-${base.id}`}>
      <g transform={transform}>
        {art(base)}
        {clipped.length > 0 && (
          <>
            {/* Larger than the flag: a group's layers can sit off it, with only its copies on it. */}
            <mask id={maskId} maskUnits='userSpaceOnUse' x={-W} y={-1} width={W * 3} height={3} style={{ maskType: 'alpha' }}>
              {art(base, false)}
            </mask>
            <g mask={`url(#${maskId})`}>{clipped.map((layer) => art(layer))}</g>
          </>
        )}
      </g>
    </PartClip>
  );
}

function layerArt(layer: StudioLayer, W: number, id: string, hrefs?: Hrefs, outline = true) {
  const filter = outline && layer.outline ? `url(#${id}-o-${layer.id})` : undefined;
  return layer.shape ? (
    <ShapeArt key={layer.id} layer={layer} W={W} filter={filter} />
  ) : (
    <LayerArt key={layer.id} layer={layer} W={W} filter={filter} href={hrefs?.layers?.[layer.id]} />
  );
}

/**
 * The field with one part of it picked out: the rest washed out, the part in full colour and
 * outlined. Sized by its height; the width follows the flag's ratio.
 */
export function PartPreview({ design, part, height = 20, className }: { design: StudioDesign; part: FieldPartRef; height?: number; className?: string }) {
  const W = flagWidth(design);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const target = partTarget(design.field, part);
  const d = target && divisionGeometry(target.division, W).parts[target.part]?.d;
  return (
    <svg viewBox={`0 0 ${W} 1`} width={Math.round(height * W)} height={height} aria-hidden className={className}>
      <mask id={`${id}-wash`} maskUnits='userSpaceOnUse' x={0} y={0} width={W} height={1}>
        <rect width={W} height={1} fill='#fff' />
        <PartClip target={target} W={W} id={`${id}-wc`}>
          {d && <path d={d} fill='#000' />}
        </PartClip>
      </mask>
      <FieldArt field={design.field} W={W} id={id} />
      <rect width={W} height={1} fill='rgb(255 255 255 / 0.72)' mask={`url(#${id}-wash)`} />
      {/* Clipped to the part, so only the inside half of the stroke shows. */}
      <PartClip target={target} W={W} id={`${id}-oc`}>
        {d && <path d={d} fill='none' stroke='rgb(0 0 0 / 0.75)' strokeWidth={2.5} vectorEffect='non-scaling-stroke' />}
      </PartClip>
    </svg>
  );
}

type PartTarget = { division: StudioDivision; part: number } | null;

function partTarget(field: StudioField, ref: FieldPartRef | null | undefined): PartTarget {
  const division = ref && field.kind === 'stack' ? field.divisions.find((d) => d.id === ref.divisionId) : null;
  return division ? { division, part: ref!.part } : null;
}

/**
 * Shows its children only inside a part of a division, and that division's box if it has one.
 * A part that's gone clips nothing.
 */
function PartClip({ target, W, id, children }: { target: PartTarget; W: number; id: string; children: React.ReactNode }) {
  const geometry = target && divisionGeometry(target.division, W);
  const part = geometry?.parts[target!.part];
  if (!geometry || !part) return <>{children}</>;
  const { clip } = geometry;
  const inner = (
    <>
      <clipPath id={`${id}-p`}>
        <path d={part.d} />
      </clipPath>
      <g clipPath={`url(#${id}-p)`}>{children}</g>
    </>
  );
  if (!target!.division.box) return inner;
  return (
    <>
      <clipPath id={`${id}-b`}>
        <rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} />
      </clipPath>
      <g clipPath={`url(#${id}-b)`}>{inner}</g>
    </>
  );
}

function FieldArt({ field, W, href, id }: { field: StudioField; W: number; href?: string; id: string }) {
  if (field.kind === 'image') return <FieldImage field={field} W={W} href={href} />;
  return (
    <>
      <rect width={W} height={1} fill={field.color} />
      {field.divisions.map((division) => {
        if (division.hidden) return null;
        const target = partTarget(field, division.clip);
        return <DivisionArt key={division.id} division={division} W={W} id={id} clipTo={target?.division} clipPart={target?.part} />;
      })}
    </>
  );
}

/**
 * A division, clipped to its box. A charge's fimbriation is a stroke twice as wide under its
 * fill, so `width` shows outside it; a tiling's runs centred along the edges between its parts.
 * `clipTo` and `clipPart` are the part of another division it only shows inside.
 */
const DivisionArt = React.memo(function DivisionArt({
  division,
  W,
  id,
  clipTo,
  clipPart = 0,
}: {
  division: StudioDivision;
  W: number;
  id: string;
  clipTo?: StudioDivision;
  clipPart?: number;
}) {
  const geometry = divisionGeometry(division, W);
  const { clip, tiling } = geometry;
  const fim = division.fimbriation && division.fimbriation.width > 0 ? division.fimbriation : null;
  const join = division.edge ? 'round' : 'miter';
  const clipId = `${id}-d-${division.id}`;
  const color = (i: number) => division.colors[i % division.colors.length] ?? '#888888';
  return (
    <PartClip target={clipTo ? { division: clipTo, part: clipPart } : null} W={W} id={`${id}-c-d${division.id}`}>
      {division.box && (
        <clipPath id={clipId}>
          <rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} />
        </clipPath>
      )}
      <g clipPath={division.box ? `url(#${clipId})` : undefined}>
        {fim &&
          !tiling &&
          geometry.parts.map((part, i) => (
            <path key={`f${i}`} d={part.d} fill='none' stroke={fim.color} strokeWidth={fim.width * 2} strokeLinejoin={join} strokeMiterlimit={20} />
          ))}
        {geometry.parts.map((part, i) => (
          // A hairline stroke in the same colour hides anti-aliasing seams where shapes meet.
          <path key={i} d={part.d} fill={color(i)} stroke={color(i)} strokeWidth={0.6} vectorEffect='non-scaling-stroke' />
        ))}
        {fim &&
          tiling &&
          geometry.parts.map((part, i) => (
            <path key={`f${i}`} d={part.d} fill='none' stroke={fim.color} strokeWidth={fim.width} strokeLinejoin={join} strokeMiterlimit={20} />
          ))}
      </g>
    </PartClip>
  );
});

function FieldImage({ field, W, href }: { field: Extract<StudioField, { kind: 'image' }>; W: number; href?: string }) {
  const live = useRecolored(field.src, field.palette, field.colors);
  return <image href={href ?? live} width={W} height={1} preserveAspectRatio='none' />;
}

const LayerArt = React.memo(function LayerArt({
  layer,
  W,
  filter,
  href,
}: {
  layer: StudioLayer;
  W: number;
  filter?: string;
  href?: string;
}) {
  const live = useRecolored(layerImage(layer), layer.palette, layer.colors);
  const url = href ?? live;
  const h = layer.size;
  const w = layerWidth(layer);
  return (
    <g filter={filter}>
      {layerCopies(layer, W).map((copy, i) => (
        <image
          key={i}
          href={url}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          preserveAspectRatio='none'
          transform={`translate(${copy.cx} ${copy.cy}) rotate(${copy.rot}) scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`}
        />
      ))}
    </g>
  );
});

/** A shape or brush stroke, drawn at its box's size so strokes keep their width when stretched. */
export const ShapeArt = React.memo(function ShapeArt({ layer, W, filter }: { layer: StudioLayer; W: number; filter?: string }) {
  const shape = layer.shape!;
  const h = layer.size;
  const w = layerWidth(layer);
  const d = shapePath(shape, w, h);
  const brush = shape.kind === 'brush';
  const round = brush || Boolean(layer.text);
  return (
    <g filter={filter}>
      {layerCopies(layer, W).map((copy, i) => (
        <path
          key={i}
          d={d}
          fill={shape.fill ? layer.colors[0] : 'none'}
          fillRule={shape.nonzero ? 'nonzero' : 'evenodd'}
          stroke={shape.stroke > 0 ? (layer.colors[1] ?? layer.colors[0]) : 'none'}
          strokeWidth={shape.stroke}
          strokeLinecap={brush ? 'round' : 'butt'}
          strokeLinejoin={round ? 'round' : 'miter'}
          transform={`translate(${copy.cx} ${copy.cy}) rotate(${copy.rot}) scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`}
        />
      ))}
    </g>
  );
});
