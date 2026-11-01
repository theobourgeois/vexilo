import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeSvg } from './svg-sanitize';

const wrap = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"${attrs}>${inner}</svg>`;
const clean = (inner: string, attrs = '') => {
  const out = sanitizeSvg(wrap(inner, attrs));
  assert.ok(out);
  return out;
};

test('keeps what a flag draws', () => {
  const out = clean(
    '<defs><linearGradient id="a"><stop offset="0" stop-color="#f00"/></linearGradient><clipPath id="c"><rect width="1" height="1"/></clipPath></defs>' +
      '<g transform="scale(2)" clip-path="url(#c)"><path d="M0 0h3v2z" fill="url(#a)" fill-rule="evenodd" style="stroke:#000;fill:url(\'#a\')"/></g>' +
      '<use xlink:href="#a"/><text font-family="serif">A &amp; B</text>',
  );
  for (const part of ['viewBox="0 0 3 2"', 'id="a"', 'stop-color="#f00"', 'clip-path="url(#c)"', 'd="M0 0h3v2z"', 'fill="url(#a)"', "fill:url('#a')", 'xlink:href="#a"', 'A &amp; B']) {
    assert.ok(out.includes(part), `lost ${part} in ${out}`);
  }
});

test('takes out everything that could run', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<script xlink:href="https://evil.example/x.js"/>',
    '<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>',
    '<SCRIPT>alert(1)</SCRIPT>',
    '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml" onload="alert(1)"><iframe src="javascript:alert(1)"/></body></foreignObject>',
    '<rect onclick="alert(1)" onmouseover="alert(1)" ONLOAD="alert(1)" width="1"/>',
    '<animate attributeName="href" to="javascript:alert(1)"/>',
    '<set attributeName="onmouseover" to="alert(1)"/>',
    '<iframe src="https://evil.example"/>',
    '<embed src="https://evil.example"/>',
    '<object data="https://evil.example"/>',
    '<g xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></g>',
    '<![CDATA[<script>alert(1)</script>]]>',
    '<!-- --><script>alert(1)</script>',
    '<?xml-stylesheet href="https://evil.example/x.xsl"?>',
    '<text><![CDATA[</text><script>alert(1)</script>]]></text>',
  ];
  for (const attack of attacks) {
    const out = clean(attack);
    // Text can mention anything once escaped; only real tags and attributes matter.
    assert.doesNotMatch(out, /<\s*(svg:)?script|<iframe|<embed|<object|<foreignObject|<animate|<set|\son\w+=|ONLOAD|xml-stylesheet/, `${attack} -> ${out}`);
  }
});

test('takes out links and anything loaded from elsewhere', () => {
  const attacks = [
    '<a xlink:href="javascript:alert(1)"><rect width="1"/></a>',
    '<a href="https://evil.example"><rect width="1"/></a>',
    '<a href="&#106;avascript:alert(1)"><rect width="1"/></a>',
    '<use href="https://evil.example/x.svg#a"/>',
    '<use xlink:href="data:image/svg+xml;base64,PHN2Zz4="/>',
    '<image href="https://evil.example/x.png"/>',
    '<image xlink:href="data:text/html;base64,PHNjcmlwdD4="/>',
    '<image href="data:image/svg+xml;base64,PHN2Zz4="/>',
    '<rect fill="url(https://evil.example/x)" width="1"/>',
    '<rect style="fill:url(//evil.example/x)" width="1"/>',
    '<rect style="background:u\\72l(https://evil.example/x)" width="1"/>',
    '<style>@import "https://evil.example/x.css";</style>',
    '<style>@\\69mport "https://evil.example/x.css";</style>',
    '<style>rect{fill:url(https://evil.example/x)}</style>',
    '<style>@font-face{font-family:x;src:url(https://evil.example/x)}</style>',
    '<style>rect{background:image-set("https://evil.example/x" 1x)}</style>',
    '<filter><feImage href="https://evil.example/x"/></filter>',
  ];
  for (const attack of attacks) {
    const out = clean(attack);
    assert.doesNotMatch(out, /evil\.example|javascript:|data:text|data:image\/svg|<a[\s>]/, `${attack} -> ${out}`);
  }
});

test('keeps what a link wraps, and pictures embedded in the file', () => {
  assert.match(clean('<a href="https://x.example"><rect width="1"/></a>'), /<g><rect width="1"\/><\/g>/);
  const picture = 'data:image/png;base64,iVBORw0KGgo=';
  assert.ok(clean(`<image width="1" height="1" href="${picture}"/>`).includes(`xlink:href="${picture}"`));
});

test('ignores namespaces the file declares for itself', () => {
  const out = clean('<rect width="1"/>', ' xmlns:xlink="http://evil.example/ns" xmlns:evil="http://evil.example/ns" evil:onload="alert(1)"');
  assert.doesNotMatch(out, /evil/);
  assert.ok(out.includes('xmlns:xlink="http://www.w3.org/1999/xlink"'));
});

test('escapes what it writes, so an attribute or text cannot break out', () => {
  const out = clean('<rect id="a&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"/><text>&lt;script&gt;alert(1)&lt;/script&gt;</text>');
  assert.doesNotMatch(out, /<script/);
  assert.ok(out.includes('&lt;script&gt;'));
});

test('drops a document type, so entities cannot be expanded', () => {
  const out = sanitizeSvg(`<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "<script>alert(1)</script>">]>${wrap('<text>&x;</text>')}`);
  assert.ok(out);
  assert.doesNotMatch(out, /<!DOCTYPE|ENTITY|<script/);
});

test('reads files that write svg: on every element', () => {
  const out = sanitizeSvg('<svg:svg xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><svg:rect width="1"/></svg:svg>');
  assert.ok(out?.startsWith('<svg xmlns='));
  assert.ok(out?.includes('<rect width="1"/>'));
});

test('refuses what is not an SVG', () => {
  for (const source of ['', 'hello', '<html><body><svg></svg></body></html>', '<script>alert(1)</script>', '<?xml version="1.0"?>']) {
    assert.equal(sanitizeSvg(source), null, source);
  }
});

test('survives absurd nesting, and refuses more tags than any drawing has', () => {
  const depth = 40_000;
  const out = sanitizeSvg(wrap(`${'<g>'.repeat(depth)}<rect width="1"/>${'</g>'.repeat(depth)}`));
  assert.ok(out?.startsWith('<svg'));
  assert.ok(!out?.includes('<rect'));
  assert.equal(sanitizeSvg(wrap('<g>'.repeat(100_001))), null);
});
