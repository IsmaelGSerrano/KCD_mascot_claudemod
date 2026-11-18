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

const hex = (color: number) => `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** One frame as SVG shapes: runs of same-colored pixels as rects, glyphs as text over their cell. */
function svgFrame(grid: readonly (readonly number[])[], glyphs: readonly Glyph[], px: number): string {
  let out = ''
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const color = row[x]!
      let end = x + 1
      while (end < row.length && row[end] === color) end++
      if (color >= 0) out += `<rect x="${x * px}" y="${y * px}" width="${(end - x) * px}" height="${px}" fill="${hex(color)}"/>`
      x = end
    }
  })
  for (const g of glyphs) {
    const cx = (g.col + 0.5) * px
    const cy = (g.row * 2 + 1) * px
    out += `<text x="${cx}" y="${cy}" font-family="monospace" font-size="${px * 1.6}" text-anchor="middle" dominant-baseline="central" fill="${hex(g.color)}">${escapeXml(g.ch)}</text>`
  }
  return out
}

/**
 * An SVG document for surfaces without `Raster`: the same pixel frames, each
 * pixel `px` CSS pixels square, cycled every `ms` by SMIL. Where SMIL does not
 * run, the first frame stands.
 */
export function svgAnimation(frames: readonly { grid: readonly (readonly number[])[]; glyphs: readonly Glyph[] }[], ms: number, px: number): { source: string; width: number; height: number } {
  const first = frames[0]?.grid ?? []
  const width = (first[0]?.length ?? 0) * px
  const height = first.length * px
  const n = frames.length
  const dur = `${(n * ms) / 1000}s`
  const groups = frames.map((f, i) => {
    const shapes = svgFrame(f.grid, f.glyphs, px)
    if (n < 2) return `<g>${shapes}</g>`
    const anim =
      i === 0
        ? `<animate attributeName="visibility" values="visible;hidden" keyTimes="0;${1 / n}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>`
        : `<animate attributeName="visibility" values="hidden;visible;hidden" keyTimes="0;${i / n};${(i + 1) / n}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>`
    return `<g visibility="${i === 0 ? 'visible' : 'hidden'}">${anim}${shapes}</g>`
  })
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${groups.join('')}</svg>`
  return { source, width, height }
}
