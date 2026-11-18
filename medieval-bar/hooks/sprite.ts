// Pixel art in the terminal: two pixels per cell with the half-block glyph
// (top pixel = foreground, bottom pixel = background), plus whole-cell glyphs
// (a "z", a spark) laid over the pixels.

const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄
const SPACE = 0x20

export type Glyph = { col: number; row: number; ch: string; color: number }

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += b === undefined ? '=' : B64[(n >> 6) & 63]!
    out += c === undefined ? '=' : B64[n & 63]!
  }
  return out
}

/**
 * Raster `cells` for a pixel grid (0xRRGGBB, -1 transparent) with an even
 * number of rows, one terminal row per two pixel rows, and glyphs on top.
 */
export function halfBlockCells(grid: readonly (readonly number[])[], glyphs: readonly Glyph[] = []): string {
  const columns = grid[0]?.length ?? 0
  const words: number[] = []
  for (let row = 0; row + 1 < grid.length; row += 2) {
    const top = grid[row]!
    const bottom = grid[row + 1]!
    for (let col = 0; col < columns; col++) {
      const t = top[col] ?? -1
      const b = bottom[col] ?? -1
      if (t < 0 && b < 0) words.push(SPACE, DEFAULT, DEFAULT)
      else if (t < 0) words.push(LOWER, b, DEFAULT)
      else if (b < 0) words.push(UPPER, t, DEFAULT)
      else words.push(UPPER, t, b)
    }
  }
  for (const g of glyphs) {
    const at = (g.row * columns + g.col) * 3
    if (g.col < 0 || g.col >= columns || at < 0 || at >= words.length) continue
    words[at] = g.ch.codePointAt(0) ?? SPACE
    words[at + 1] = g.color
    words[at + 2] = DEFAULT
  }
  return toBase64(new Uint8Array(Uint32Array.from(words).buffer))
}
