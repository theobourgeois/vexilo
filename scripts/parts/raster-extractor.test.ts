import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { extractRaster, rasterDesign } from './raster-extractor';
import { studioDesignSchema } from '../../src/lib/studio-design-schema';

const image = (content: string, width = 300, height = 200) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`,
    ),
  )
    .png()
    .toBuffer();
const alphaAt = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * 4 + 3];
};

test('five detached stars remain selectable and reconstruct over a three-band field', async () => {
  const source = await image(
    '<path fill="#00bce0" d="M0 0h300v200H0z"/><path fill="white" d="M0 65h300v70H0z"/>' +
      [90, 150, 210, 120, 180]
        .map(
          (x, i) =>
            `<path fill="#00bce0" d="M${x} ${i < 3 ? 80 : 110}l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/>`,
        )
        .join(''),
  );
  const result = await extractRaster(source);
  assert.equal(result.parts.length, 5);
  assert.ok(result.mismatch < 0.005);
  for (const part of result.parts)
    assert.equal(
      part.palette.length,
      1,
      'antialias shades are not separate colours',
    );
  for (const part of result.parts)
    assert.equal(await alphaAt(part.png, 0, 0), 0);
  assert.doesNotThrow(() =>
    studioDesignSchema.parse(
      rasterDesign(
        result,
        result.parts.map((_, i) => `https://example.org/${i}.png`),
        'https://example.org/field.png',
      ),
    ),
  );
});

test('one-pixel beam stays connected to its object', async () => {
  const result = await extractRaster(
    await image(
      '<path fill="black" d="M0 0h300v200H0z"/><circle cx="130" cy="100" r="25" fill="white"/><path fill="red" d="M150 99h110v1H150z"/>',
    ),
  );
  assert.equal(result.parts.length, 1);
  assert.ok(result.parts[0].box[2] > 0.85, 'beam endpoint is included');
  const { data, info } = await sharp(result.parts[0].png)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.ok(
    [...data].some(
      (v, i) =>
        i % info.channels === 0 &&
        v > 200 &&
        data[i + 1] < 30 &&
        data[i + 3] > 200,
    ),
  );
});

test('a crescent and star lift off a full-height canton without carrying the field', async () => {
  const stripes = Array.from(
    { length: 13 },
    (_, i) =>
      `<rect y="${(i * 200) / 13}" width="380" height="${200 / 13 + 0.01}" fill="${i % 2 ? '#fff' : '#ba1635'}"/>`,
  ).join('');
  const png = await image(
    stripes +
      '<rect width="152" height="200" fill="#008941"/><circle cx="72" cy="100" r="38" fill="white"/><circle cx="86" cy="94" r="34" fill="#008941"/><path fill="#ba1635" d="M90 76l6 14 16 1-12 10 4 16-14-9-14 9 4-16-12-10 16-1z"/>',
    380,
    200,
  );
  const source = await sharp(png).jpeg({ quality: 85 }).toBuffer();
  const result = await extractRaster(source);
  assert.equal(result.parts.length, 1);
  assert.equal(result.fit.kind, 'layout');
  if (result.fit.kind === 'layout')
    assert.equal(result.fit.layout, 'stars-stripes');
  const { data, info } = await sharp(result.parts[0].png)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let green = 0;
  for (let i = 0; i < data.length; i += info.channels)
    if (
      data[i + 3] > 200 &&
      data[i + 1] > data[i] + 45 &&
      data[i + 1] > data[i + 2] + 35
    )
      green++;
  assert.ok(
    green < info.width * info.height * 0.01,
    'the green field stays transparent',
  );
});

test('transparent coats of arms are held for review', async () => {
  await assert.rejects(
    extractRaster(await image('<circle cx="150" cy="100" r="65" fill="red"/>')),
    /transparent/,
  );
});
