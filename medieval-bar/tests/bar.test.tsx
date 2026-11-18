import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'medieval-bar',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const usage = (percent: number, withLimits: boolean) => ({
  value: {
    startedAt: 0,
    context: { tokens: percent * 2000, window: 200000, percent },
    rateLimits: withLimits
      ? [
          { kind: 'five_hour', percentUsed: 30 },
          { kind: 'seven_day', percentUsed: 60 },
        ]
      : [],
    cost: { usd: 4.12 },
  },
})

test('draws every stat on a subscription', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => usage(25, true))
  on('ui.toast', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^Health$/ }))?.text).toBe('Health')
    expect((await ui.find({ type: 'Text', text: /^Stamina$/ }))?.text).toBe('Stamina')
    expect((await ui.find({ type: 'Text', text: /^Energy$/ }))?.text).toBe('Energy')
    expect((await ui.find({ type: 'Text', text: /gr\./ }))?.text).toBe('412 gr.')
    // 75% health -> 8 of 10 segments
    expect((await ui.find({ type: 'Text', text: /^■+$/ }))?.text).toBe('■'.repeat(8))
    await ui.unmount()
  }
})

test('hides stamina and energy without rate limits, and warns when wounded', async ($, on) => {
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => usage(85, false))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^Stamina$/ })).toBe(undefined)
  expect(await ui.find({ type: 'Text', text: /^Energy$/ })).toBe(undefined)
  expect(toasts.length).toBe(1)
  await ui.unmount()
})

test('Sir Pip follows Health and steps aside in a short band', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  let percent = 10
  on('session.usage', () => usage(percent, true))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Sir Pip/ }))?.text).toBe('Sir Pip: “Zzz... give me a quest.”')
  await ui.unmount()

  percent = 80
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: true } })
  expect((await ui.find({ type: 'Text', text: /Sir Pip/ }))?.text).toBe('Sir Pip: “To battle!”')
  await ui.unmount()

  ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 2 } })
  expect(await ui.find({ type: 'Text', text: /Sir Pip/ })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /^Health$/ }))?.text).toBe('Health')
  await ui.unmount()
})

test('the terminal draws Sir Pip in pixels', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => usage(10, true))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Raster' }))?.type).toBe('Raster')
  expect(await ui.find({ type: 'Text', text: /\[\^_\^\]/ })).toBe(undefined)
  await ui.unmount()
})

test('the band shows the three looks: asleep while idle, fighting while working', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => usage(10, true))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 20 } })
  expect((await ui.find({ type: 'Raster' }))?.type).toBe('Raster')
  expect((await ui.find({ type: 'Text', text: /Sir Pip/ }))?.text).toBe('Sir Pip: “Zzz... give me a quest.”')
  await ui.unmount()

  ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 20, isWorking: true } })
  expect((await ui.find({ type: 'Text', text: /Sir Pip/ }))?.text).toBe('Sir Pip: “To battle!”')
  await ui.unmount()
})

test('the figure is alive: frames repaint in place on a timer', async ($, on) => {
  const clock = mock.clock(on)
  const blits: string[] = []
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => usage(10, true))
  on('ui.blit', (_, e) => {
    blits.push(`${e.key}:${'cells' in e ? e.cells : ''}`)
    return { value: {} }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 20 } })
  await clock.advance(600 * 4)

  expect(blits.length).toBe(4)
  expect(blits.every(b => /^pip-12-sleep:/.test(b))).toBe(true)
  // four different frames, back to the first
  expect(new Set(blits).size).toBe(4)
  await ui.unmount()
})

test('the app surfaces draw Sir Pip in pixels too, as an animated SVG', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => usage(10, true))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg?.props.alt).toBe('Sir Pip, a pixel-art squire, asleep')
    expect(svg?.props.width).toBe(96)
    expect(svg?.props.height).toBe(48)
    expect(/<rect /.test(svg?.props.source ?? '')).toBe(true)
    expect(/<animate /.test(svg?.props.source ?? '')).toBe(true)
    expect(await ui.find({ type: 'Text', text: /\[\^_\^\]/ })).toBe(undefined)
    expect((await ui.find({ type: 'Text', text: /Sir Pip/ }))?.text).toBe('Sir Pip: “Zzz... give me a quest.”')
    await ui.unmount()
  }
})

for (const [size, width, height] of [['small', 96, 48], ['medium', 192, 96], ['large', 200, 256]] as const) {
  test(`the ${size} size draws the SVG ${width} x ${height} on desktop`, { options: { size } }, async ($, on) => {
    sizeHooks(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, maxRows: 20, isWorking: true } })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg?.props.width).toBe(width)
    expect(svg?.props.height).toBe(height)
    expect((svg?.props.source.length ?? Infinity) < 131072).toBe(true)
    await ui.unmount()
  })
}

const sizeHooks = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => usage(10, true))
}

for (const [size, columns, rows] of [['small', 12, 3], ['medium', 24, 6], ['large', 25, 16]] as const) {
  test(`the ${size} size draws Sir Pip ${rows} rows tall`, { options: { size } }, async ($, on) => {
    sizeHooks(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 20 } })
    const raster = await ui.find({ type: 'Raster' })
    expect(raster?.props.columns).toBe(columns)
    expect(raster?.props.rows).toBe(rows)
    await ui.unmount()
  })
}

test('large steps down to the biggest size the band has rows for', { options: { size: 'large' } }, async ($, on) => {
  sizeHooks(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 8 } })
  expect((await ui.find({ type: 'Raster' }))?.props.rows).toBe(6)
  await ui.unmount()
})
