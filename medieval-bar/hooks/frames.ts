// Sir Pip's three looks, hand-drawn small (12 x 6 pixels, 3 terminal rows,
// the size of Claude's old mascot) after the reference figures, with the
// frames that keep them alive.

import type { Glyph } from './sprite'

export const SPRITE_COLUMNS = 12
export const SPRITE_ROWS = 3

const PALETTE: Record<string, number> = {
  h: 0x9c5a24, // hair
  f: 0xf2b58c, // skin
  k: 0x5a3a28, // closed eye
  G: 0x2f9e44, // green sleeves
  g: 0x1f6e30, // green trousers
  B: 0x8a5a2b, // leather vest
  b: 0x4a2c16, // boots
  S: 0xd3dae3, // steel
  s: 0x7d8a99, // steel shade
  K: 0x14141a, // visor slit
  R: 0xe63946, // plume, lance stripe
  W: 0xf8fafc, // blade
  Y: 0xffb703, // gold: hilt, lance, trim
  U: 0x8fa3bf, // shield
  H: 0xf1f3f5, // horse
  n: 0xa9b0b8, // horse legs
  C: 0xd62828, // caparison
}

const Z_BRIGHT = 0xc7d2e4
const Z_DIM = 0x6b7689
const SPARK = 0xffd23f
const DUST = 0xc9a27a
const DUST_DIM = 0x7a6450

type Frame = { pixels: string[]; glyphs?: Glyph[] }

const SLEEP_BODY = [
  '...hhh......',
  '..hhfkf.....',
  '..GBBBG.....',
  '..fBBBf.....',
  '...g.g......',
  '..bb.bb.....',
]
// Breathing in: the shoulders rise into the head's row.
const SLEEP_BREATH = [
  '...hhh......',
  '..hhfkf.....',
  '..GBBBG.....',
  '..GBBBG.....',
  '..fg.gf.....',
  '..bb.bb.....',
]

const sleep: Frame[] = [
  { pixels: SLEEP_BODY, glyphs: [{ col: 8, row: 1, ch: 'z', color: Z_BRIGHT }] },
  { pixels: SLEEP_BREATH, glyphs: [{ col: 9, row: 0, ch: 'z', color: Z_BRIGHT }] },
  { pixels: SLEEP_BREATH, glyphs: [{ col: 10, row: 0, ch: 'Z', color: Z_BRIGHT }, { col: 8, row: 1, ch: 'z', color: Z_DIM }] },
  { pixels: SLEEP_BODY, glyphs: [{ col: 11, row: 0, ch: 'Z', color: Z_DIM }, { col: 9, row: 0, ch: 'z', color: Z_BRIGHT }] },
]

const attack: Frame[] = [
  {
    // sword raised
    pixels: [
      '....R....W..',
      '...SSS..W...',
      '...SKK.W....',
      '..USSSY.....',
      '..USSS......',
      '...s.s......',
    ],
  },
  {
    // the swing comes over
    pixels: [
      '....R.......',
      '...SSS..WW..',
      '...SKKWW....',
      '..USSSY.....',
      '..USSS......',
      '...s.s......',
    ],
  },
  {
    // the strike lands
    pixels: [
      '....R.......',
      '...SSS......',
      '...SKK......',
      '..USSSYWWWW.',
      '..USSS......',
      '...s.s......',
    ],
    glyphs: [{ col: 11, row: 1, ch: '*', color: SPARK }],
  },
]

const RIDER = [
  '...SS.......',
  '...SKYRYRY.H',
  '..SSS....HKH',
  '.HCCCHHHHH..',
  '.HYYYYHHH...',
]
const charge: Frame[] = [
  { pixels: [...RIDER, '.n.n...n.n..'], glyphs: [{ col: 0, row: 2, ch: '░', color: DUST }] },
  { pixels: [...RIDER, '..n.n.n.n...'], glyphs: [{ col: 0, row: 2, ch: '░', color: DUST_DIM }] },
  { pixels: [...RIDER, '.n.n...n.n..'], glyphs: [{ col: 0, row: 2, ch: '·', color: DUST_DIM }] },
  { pixels: [...RIDER, '..n.n.n.n...'] },
]

function toGrid(pixels: string[]): number[][] {
  return pixels.map(line => [...line.padEnd(SPRITE_COLUMNS, '.')].map(ch => PALETTE[ch] ?? -1))
}

const build = (frames: Frame[]) => frames.map(f => ({ grid: toGrid(f.pixels), glyphs: f.glyphs ?? [] }))

/** Each look's frames and how long each frame shows, in milliseconds. */
export const ANIMATIONS = {
  sleep: { frames: build(sleep), ms: 600 },
  attack: { frames: build(attack), ms: 180 },
  charge: { frames: build(charge), ms: 140 },
}

/** A look drawn at twice the size: each pixel becomes 2 x 2, each glyph keeps its place. */
function doubled(frames: ReturnType<typeof build>) {
  return frames.map(f => ({
    grid: f.grid.flatMap(row => {
      const wide = row.flatMap(c => [c, c])
      return [wide, [...wide]]
    }),
    glyphs: f.glyphs.map(g => ({ ...g, col: g.col * 2 + 1, row: g.row * 2 })),
  }))
}

export const MEDIUM = {
  sleep: { frames: doubled(ANIMATIONS.sleep.frames), ms: 600 },
  attack: { frames: doubled(ANIMATIONS.attack.frames), ms: 180 },
  charge: { frames: doubled(ANIMATIONS.charge.frames), ms: 140 },
}
