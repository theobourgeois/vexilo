'use client';

import React from 'react';
import type { StudioDesign, StudioField, StudioLayer } from '@/lib/studio-design';
import { layerImage } from './cutout';
import { useRecolored } from './images';
import { defaultParams, LAYOUTS } from './layouts';
import { flagWidth, layerBounds, layerCopies, layerWidth } from './model';

type Hrefs = { field?: string; layers?: Record<string, string> };

/**
 * A design as an SVG in flag units (W wide, 1 tall). `hrefs` replaces the live, recoloured
 * images with fixed ones, which export uses to embed them.
 */
export function FlagArt({
  design,
  hrefs,
  className,
  style,
  ...rest
}: { design: StudioDesign; hrefs?: Hrefs } & Omit<React.SVGProps<SVGSVGElement>, 'viewBox'>) {
  const W = flagWidth(design);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const outlined = design.layers.filter((layer) => layer.outline && !layer.hidden);
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox={`0 0 ${W} 1`}
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
        <FieldArt field={design.field} W={W} href={hrefs?.field} />
        {design.layers.map((layer) =>
          layer.hidden ? null : (
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

function FieldArt({ field, W, href }: { field: StudioField; W: number; href?: string }) {
  if (field.kind === 'image') return <FieldImage field={field} W={W} href={href} />;
  const shapes = LAYOUTS[field.layout].shapes(W, { ...defaultParams(field.layout), ...field.params });
  return (
    <>
      {shapes.map((shape, i) => (
        // A hairline stroke in the same colour hides anti-aliasing seams where shapes meet.
        <path
          key={i}
          d={shape.d}
          fill={field.colors[shape.slot] ?? '#888888'}
          stroke={field.colors[shape.slot] ?? '#888888'}
          strokeWidth={0.6}
          vectorEffect='non-scaling-stroke'
        />
      ))}
    </>
  );
}

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
