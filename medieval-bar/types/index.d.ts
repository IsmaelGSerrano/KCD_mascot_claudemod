export type Stats = {
  /** Context window left, 0-100. */
  health: number
  /** Five-hour rate limit left, 0-100; null when not on a subscription. */
  stamina: number | null
  /** Seven-day rate limit left, 0-100; null when not on a subscription. */
  energy: number | null
  /** Session cost in cents (1 groschen = 1 cent). */
  groschen: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'medieval-bar': { stats: Stats | null; isHidden: boolean; warned: boolean; isCharging: boolean }
  }
}
