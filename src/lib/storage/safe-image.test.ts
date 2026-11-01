import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnsafeImageError, safeImageBody } from './safe-image';

test('SVG uploads are stored without their scripts', () => {
  const body = safeImageBody(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="1"/></svg>'), 'image/svg+xml');
  assert.doesNotMatch(body.toString(), /script|onload/);
  assert.match(body.toString(), /<rect width="1"\/>/);
});

test('other images are stored as they came', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  assert.equal(safeImageBody(png, 'image/png'), png);
});

test('refuses anything a browser would open as a page, or an SVG that is not one', () => {
  for (const type of ['text/html', 'application/xhtml+xml', 'application/xml', 'text/xml', 'image/svg', 'IMAGE/SVG+XML', '']) {
    assert.throws(() => safeImageBody(Buffer.from('<svg/>'), type), UnsafeImageError, type);
  }
  assert.throws(() => safeImageBody(Buffer.from('<html><script>alert(1)</script></html>'), 'image/svg+xml'), UnsafeImageError);
});
