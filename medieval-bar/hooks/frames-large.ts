// The large look: the reference figures themselves (25 x 32 pixels, 16 rows),
// kept alive with a sleeping breath and rising Z, a sword wind-up with sparks,
// and a galloping bob with dust.

import { ATTACK, CHARGE, FIGURE_HEIGHT, FIGURE_WIDTH, SLEEP } from './figures'
import type { Glyph } from './sprite'

export const LARGE_COLUMNS = FIGURE_WIDTH
export const LARGE_ROWS = FIGURE_HEIGHT / 2

type Grid = number[][]
type Still = readonly (readonly number[])[]

const clone = (g: Still): Grid => g.map(row => [...row])

function set(g: Grid, x: number, y: number, color: number) {
  const row = g[y]
  if (row && x >= 0 && x < row.length) row[x] = color
}

/** Rows `from`..`to` moved by `dy` (-1 up, +1 down); the row left behind keeps its pixels. */
function shiftRows(g: Still, from: number, to: number, dy: number): Grid {
  const out = clone(g)
  for (let y = from; y <= to; y++) {
    const source = g[y]
    if (out[y + dy] && source) out[y + dy] = [...source]
  }
  return out
}

function shiftAll(g: Still, dy: number): Grid {
  const out: Grid = g.map(row => row.map(() => -1))
  g.forEach((row, y) => {
    if (out[y + dy]) out[y + dy] = [...row]
  })
  return out
}

const none: Glyph[] = []

// sleeping
const Z_COLOR = 0xb8c4d6
const Z_FADED = 0x6b7689
const Z = ['####', '..#.', '.#..', '####']
function drawZ(g: Grid, x: number, y: number, color: number) {
  Z.forEach((line, dy) => [...line].forEach((ch, dx) => ch === '#' && set(g, x + dx, y + dy, color)))
}
const sleepBase = clone(SLEEP)
set(sleepBase, 18, 6, -1)
set(sleepBase, 18, 7, -1)
set(sleepBase, 18, 11, -1)
const breathIn = shiftRows(sleepBase, 9, 21, -1)
const sleep = (
  [
    [sleepBase, 17, 6, Z_COLOR],
    [breathIn, 18, 4, Z_COLOR],
    [breathIn, 19, 2, Z_COLOR],
    [sleepBase, 20, 0, Z_FADED],
  ] as const
).map(([body, x, y, color]) => {
  const g = clone(body)
  drawZ(g, x, y, color)
  return { grid: g, glyphs: none }
})

// sword
const SPARK = 0xffd23f
const EMBER = 0xff8c1a
const windUp = shiftRows(ATTACK, 0, 25, 1)
for (const [x, y] of [[19, 6], [20, 6], [21, 7]] as const) set(windUp, x, y, -1)
const strike = clone(ATTACK)
for (const [x, y, c] of [[22, 3, SPARK], [23, 5, EMBER], [20, 3, EMBER], [22, 7, SPARK], [24, 4, SPARK]] as const) set(strike, x, y, c)
const attack = [clone(ATTACK), windUp, strike].map(grid => ({ grid, glyphs: none }))

// charge
const DUST = 0xc9a27a
const DUST_FADED = 0x7a6450
const puffs: (readonly [number, number, number])[][] = [
  [[2, 30, DUST], [3, 30, DUST]],
  [[1, 30, DUST], [2, 29, DUST], [0, 31, DUST_FADED]],
  [[0, 30, DUST_FADED], [1, 29, DUST_FADED]],
  [],
]
const charge = [0, -1, 0, 1].map((dy, i) => {
  const g = dy === 0 ? clone(CHARGE) : shiftAll(CHARGE, dy)
  for (const [x, y, c] of puffs[i]!) set(g, x, y, c)
  return { grid: g, glyphs: none }
})

export const LARGE = {
  sleep: { frames: sleep, ms: 450 },
  attack: { frames: attack, ms: 160 },
  charge: { frames: charge, ms: 130 },
}
