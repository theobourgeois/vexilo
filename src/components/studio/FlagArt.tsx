'use client';

import React from 'react';
import type { StudioDesign, StudioDivision, StudioField, StudioLayer } from '@/lib/studio-design';
import { layerImage } from './cutout';
import { divisionGeometry } from './divisions';
import { useRecolored } from './images';
import { flagWidth, layerBounds, layerCopies, layerWidth } from './model';
import { shapePath } from './shapes';

type Hrefs = { field?: string; layers?: Record<string, string> };

/**
 * A design as an SVG in flag units (W wide, 1 tall). `hrefs` replaces the live, recoloured
 * images with fixed ones, which export uses to embed them. `view` shows just that part of the
 * flag (flag units), so a close zoom never draws more than fits on screen.
 */
export function FlagArt({
  design,
  hrefs,
  view,
  className,
  style,
  ...rest
}: { design: StudioDesign; hrefs?: Hrefs; view?: { x: number; y: number; w: number; h: number } } & Omit<React.SVGProps<SVGSVGElement>, 'viewBox'>) {
  const W = flagWidth(design);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const outlined = design.layers.filter((layer) => layer.outline && !layer.hidden);
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
          <rect width={W} height={1} />
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
        {design.layers.map((layer) =>
          layer.hidden ? null : layer.shape ? (
            <ShapeArt key={layer.id} layer={layer} W={W} filter={layer.outline ? `url(#${id}-o-${layer.id})` : undefined} />
          ) : (
            <LayerArt
              key={layer.id}
              layer={layer}
              W={W}
              filter={layer.outline ? `url(#${id}-o-${layer.id})` : undefined}
              href={hrefs?.layers?.[layer.id]}
            />
          ),
        )}
      </g>
    </svg>
  );
}

function FieldArt({ field, W, href, id }: { field: StudioField; W: number; href?: string; id: string }) {
  if (field.kind === 'image') return <FieldImage field={field} W={W} href={href} />;
  return (
    <>
      <rect width={W} height={1} fill={field.color} />
      {field.divisions.map((division) => (division.hidden ? null : <DivisionArt key={division.id} division={division} W={W} id={id} />))}
    </>
  );
}

/**
 * A division, clipped to its box. A charge's fimbriation is a stroke twice as wide under its
 * fill, so `width` shows outside it; a tiling's runs centred along the edges between its parts.
 */
const DivisionArt = React.memo(function DivisionArt({ division, W, id }: { division: StudioDivision; W: number; id: string }) {
  const geometry = divisionGeometry(division, W);
  const { clip, tiling } = geometry;
  const fim = division.fimbriation && division.fimbriation.width > 0 ? division.fimbriation : null;
  const join = division.edge ? 'round' : 'miter';
  const clipId = `${id}-d-${division.id}`;
  const color = (i: number) => division.colors[i % division.colors.length] ?? '#888888';
  return (
    <>
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
    </>
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
  return (
    <g filter={filter}>
      {layerCopies(layer, W).map((copy, i) => (
        <path
          key={i}
          d={d}
          fill={shape.fill ? layer.colors[0] : 'none'}
          fillRule='evenodd'
          stroke={shape.stroke > 0 ? (layer.colors[1] ?? layer.colors[0]) : 'none'}
          strokeWidth={shape.stroke}
          strokeLinecap={brush ? 'round' : 'butt'}
          strokeLinejoin={brush ? 'round' : 'miter'}
          transform={`translate(${copy.cx} ${copy.cy}) rotate(${copy.rot}) scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`}
        />
      ))}
    </g>
  );
});
