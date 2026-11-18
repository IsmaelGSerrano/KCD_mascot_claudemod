import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Stats } from '../types'
import { halfBlockCells, svgAnimation } from './sprite'
import type { Glyph } from './sprite'
import { ANIMATIONS, MEDIUM, SPRITE_COLUMNS, SPRITE_ROWS } from './frames'
import { LARGE, LARGE_COLUMNS, LARGE_ROWS } from './frames-large'

const stats = atom({ plugin: 'medieval-bar', key: 'stats' } as const, null)
const isHidden = atom({ plugin: 'medieval-bar', key: 'isHidden' } as const, false)
const warned = atom({ plugin: 'medieval-bar', key: 'warned' } as const, false)
const isCharging = atom({ plugin: 'medieval-bar', key: 'isCharging' } as const, false)

// Each look's animation frames as Raster cells, encoded once per size:
// sleep (idle), attack (thinking or writing), charge (running tools).
type Figure = keyof typeof ANIMATIONS
type Size = 'small' | 'medium' | 'large'
const SIZES: readonly Size[] = ['small', 'medium', 'large']
type Animations = Record<Figure, { frames: { grid: number[][]; glyphs: Glyph[] }[]; ms: number }>

function encode(anims: Animations) {
  const cells = (f: Figure) => anims[f].frames.map(x => halfBlockCells(x.grid, x.glyphs))
  return { sleep: cells('sleep'), attack: cells('attack'), charge: cells('charge') }
}

// The same frames as animated SVG for the surfaces without Raster (desktop,
// VS Code, mobile); one pixel is PIXEL CSS pixels, about a terminal half-cell.
const PIXEL = 8
type Svg = ReturnType<typeof svgAnimation>
function encodeSvg(anims: Animations): Record<Figure, Svg> {
  const svg = (f: Figure) => svgAnimation(anims[f].frames, anims[f].ms, PIXEL)
  return { sleep: svg('sleep'), attack: svg('attack'), charge: svg('charge') }
}

type Look = { columns: number; rows: number; ms: Record<Figure, number>; cells: Record<Figure, string[]>; svg: Record<Figure, Svg> }
const makeLook = (columns: number, rows: number, anims: Animations): Look => ({ columns, rows, ms: msOf(anims), cells: encode(anims), svg: encodeSvg(anims) })

const LOOKS: Record<Size, Look> = {
  small: makeLook(SPRITE_COLUMNS, SPRITE_ROWS, ANIMATIONS),
  medium: makeLook(SPRITE_COLUMNS * 2, SPRITE_ROWS * 2, MEDIUM),
  large: makeLook(LARGE_COLUMNS, LARGE_ROWS, LARGE),
}

const ALT: Record<Figure, string> = {
  sleep: 'Sir Pip, a pixel-art squire, asleep',
  attack: 'Sir Pip, a pixel-art squire, swinging his sword',
  charge: 'Sir Pip, a pixel-art squire, charging on horseback',
}

function msOf(anims: Animations): Record<Figure, number> {
  return { sleep: anims.sleep.ms, attack: anims.attack.ms, charge: anims.charge.ms }
}

const SEGMENTS = 10
const COLORS = {
  health: '#b3261e',
  stamina: '#d4a017',
  energy: '#5b8fa8',
  gold: '#c9a227',
  frame: '#8b6b3d',
  steel: '#9aa0a6',
}


// Sir Pip, a tiny squire whose remarks follow Health; the text face is for
// surfaces that cannot draw pixels.
const MOODS: { min: number; face: string; line: string }[] = [
  { min: 61, face: '[^_^]', line: 'Fit as a fiddle!' },
  { min: 31, face: '[o_o]', line: 'A bit bruised, but onward.' },
  { min: 11, face: '[;_;]', line: 'I need an inn... try /rest.' },
  { min: 0, face: '[x_x]', line: 'Carry me to the inn! /rest' },
]

function mascot(health: number, isWorking: boolean) {
  const mood = MOODS.find(m => health >= m.min) ?? MOODS[MOODS.length - 1]!
  return {
    plume: ' ,^, ',
    face: mood.face,
    body: isWorking ? ' \\|/ ' : ' /|\\ ',
    line: isWorking && health > 10 ? 'To battle!' : !isWorking && health > 60 ? 'Zzz... give me a quest.' : mood.line,
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

async function refresh($: EngineInterface) {
  const usage = await $.session.usage()
  const five = usage.rateLimits.find(r => r.kind === 'five_hour')
  const seven = usage.rateLimits.find(r => r.kind === 'seven_day')
  const next: Stats = {
    health: clamp(100 - (usage.context.percent ?? 0)),
    stamina: five ? clamp(100 - five.percentUsed) : null,
    energy: seven ? clamp(100 - seven.percentUsed) : null,
    groschen: usage.cost ? Math.round(usage.cost.usd * 100) : null,
  }
  await update($, stats, () => next)

  const hasWarned = await read($, warned)
  if (next.health <= 20 && !hasWarned) {
    $.ui.toast('Thou art gravely wounded. Rest a while with /rest.')
    await update($, warned, () => true)
  } else if (next.health > 40 && hasWarned) {
    await update($, warned, () => false)
  }
}

export const register: Register = (on, options) => {
  const chosen = SIZES.find(size => size === options.size) ?? 'small'

  on('session.start', async ($, e, next) => {
    $.command.register({ name: 'rest', description: 'Rest at the inn: compact the conversation to restore health' })
    $.command.register({ name: 'hud', description: 'Show or hide the medieval stat bar; /hud small, medium or large sizes Sir Pip' })
    const result = await next(e)
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  let toolsInFlight = 0
  // The animation: one timer for the figure on screen, repainting its Raster in place.
  let ticker: { cancel: () => void } | null = null
  let tickerFigure: string | null = null
  let frame = 0
  const stopTicker = () => {
    ticker?.cancel()
    ticker = null
    tickerFigure = null
  }
  on('tool.call', async ($, e, next) => {
    toolsInFlight += 1
    await update($, isCharging, () => true)
    try {
      return await next(e)
    } finally {
      toolsInFlight = Math.max(0, toolsInFlight - 1)
      if (toolsInFlight === 0) await update($, isCharging, () => false)
      await refresh($)
    }
  })

  on('command.run', { command: 'rest' }, async ($, e, next) => {
    await $.session.compact()
    await refresh($)
    return { text: 'Thou hast rested at the inn. Health restored.' }
  })

  on('command.run', { command: 'hud' }, async ($, e, next) => {
    const asked = e.args.trim().toLowerCase()
    const size = SIZES.find(s => s === asked)
    if (size) {
      await $.config.set({ key: 'medieval-bar.size', value: size })
      return { text: `Sir Pip is now ${size}.` }
    }
    if (asked) return { text: 'Use /hud to show or hide the bar, or /hud small, /hud medium, /hud large.' }
    await update($, isHidden, h => !h)
    return { text: (await read($, isHidden)) ? 'Stat bar hidden.' : 'Stat bar shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, stats)
    if (e.props.hasSurvey || s === null || (await read($, isHidden))) {
      stopTicker()
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    const bar = (key: string, icon: string, label: string, value: number, color: string) => {
      const filled = Math.round((value / 100) * SEGMENTS)
      return (
        <Box key={key} flexDirection="row" gap={1}>
          <Text color={color}>{icon}</Text>
          <Text color={COLORS.frame} weight="semibold">{label}</Text>
          <Text>
            <Text color={COLORS.frame}>[</Text>
            <Text color={color}>{'■'.repeat(filled)}</Text>
            <Text dimColor>{'·'.repeat(SEGMENTS - filled)}</Text>
            <Text color={COLORS.frame}>]</Text>
          </Text>
        </Box>
      )
    }

    const statRow = (
      <Box key="stats" flexDirection="row" columnGap={3} flexWrap="wrap">
        {bar('health', '♥', 'Health', s.health, COLORS.health)}
        {s.stamina !== null && bar('stamina', '⚔', 'Stamina', s.stamina, COLORS.stamina)}
        {s.energy !== null && bar('energy', '☾', 'Energy', s.energy, COLORS.energy)}
        {s.groschen !== null && (
          <Box key="gold" flexDirection="row" gap={1}>
            <Text color={COLORS.gold}>⛁</Text>
            <Text color={COLORS.gold} weight="semibold" tabular>{s.groschen} gr.</Text>
          </Box>
        )}
      </Box>
    )

    if (e.props.maxRows < SPRITE_ROWS) {
      stopTicker()
      return statRow
    }

    const pip = mascot(s.health, e.props.isWorking)

    // The chosen size, or the largest smaller one the band has rows for.
    const fits = SIZES.slice(0, SIZES.indexOf(chosen) + 1).filter(size => LOOKS[size].rows <= e.props.maxRows)
    const look = LOOKS[fits[fits.length - 1] ?? 'small']

    const figure: Figure = !e.props.isWorking ? 'sleep' : (await read($, isCharging)) ? 'charge' : 'attack'
    if (figure === 'charge' && s.health > 10) pip.line = 'Charge!'

    let sprite = null
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const frames = look.cells[figure]
      const key = `pip-${look.columns}-${figure}`
      if (ticker === null || tickerFigure !== key) {
        stopTicker()
        frame = 0
        tickerFigure = key
        const requestId = e.requestId
        ticker = $.clock.every(look.ms[figure], () => {
          frame = (frame + 1) % frames.length
          void $.ui.blit({ requestId, key, cells: frames[frame]! }).then(r => {
            if (r.deny && tickerFigure === key) stopTicker()
          })
        })
      }
      sprite = <Raster key={key} columns={look.columns} rows={look.rows} cells={frames[frame % frames.length]!} />
    } else {
      // No Raster here: the frames go as one SVG that animates itself, so no ticker.
      stopTicker()
      const elements = $.ui.resolve(e)
      if ('Svg' in elements) {
        const { Svg } = elements
        const art = look.svg[figure]
        sprite = <Svg key={`pip-${look.columns}-${figure}`} source={art.source} width={art.width} height={art.height} alt={ALT[figure]} />
      }
    }

    return (
      <Box flexDirection="row" gap={2}>
        {sprite ?? (
          <Box key="pip" flexDirection="column">
            <Text color={COLORS.health} mono>{pip.plume}</Text>
            <Text color={COLORS.steel} mono weight="semibold">{pip.face}</Text>
            <Text color={COLORS.frame} mono>{pip.body}</Text>
          </Box>
        )}
        <Box key="side" flexDirection="column" justifyContent="center">
          {statRow}
          <Text color={COLORS.frame} italic>Sir Pip: “{pip.line}”</Text>
        </Box>
      </Box>
    )
  })
}
