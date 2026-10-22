// The little of opentype.js 2 the studio uses; the package ships no types.
declare module 'opentype.js' {
  export type PathCommand =
    | { type: 'M' | 'L'; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' };

  export class Path {
    commands: PathCommand[];
  }

  export class Glyph {
    index: number;
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number, options?: RenderOptions, font?: Font): Path;
  }

  export type RenderOptions = { kerning?: boolean; letterSpacing?: number };

  export class Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    charToGlyphIndex(char: string): number;
    forEachGlyph(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options: RenderOptions,
      callback: (glyph: Glyph, x: number, y: number, fontSize: number) => void,
    ): number;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
