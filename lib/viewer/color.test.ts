import { expect, test } from 'vitest'
import { oklchToRgb, STAGE_BACKGROUND, WWR_RAMP, wwrStop } from './color'

test('the ramp clamps to blue below 25% and red above 70%', () => {
  expect(wwrStop(0.1)).toEqual(WWR_RAMP.low)
  expect(wwrStop(0.25)).toEqual(WWR_RAMP.low)
  expect(wwrStop(0.9)).toEqual(WWR_RAMP.high)
})

test('the midpoint runs through magenta, never green', () => {
  const mid = wwrStop((WWR_RAMP.from + WWR_RAMP.to) / 2)
  expect(mid.h).toBeGreaterThan(290)
  expect(mid.h).toBeLessThan(360)
})

test('oklch converts to sRGB within rounding', () => {
  const [r, g, b] = oklchToRgb({ l: 1, c: 0, h: 0 }).map((v) => Math.round(v * 255))
  expect([r, g, b]).toEqual([255, 255, 255])
  const grey = oklchToRgb({ l: 0.145, c: 0, h: 0 }).map((v) => Math.round(v * 255))
  expect(grey).toEqual(STAGE_BACKGROUND)
})

test('every ramp colour clears 4.5:1 against the stage', () => {
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const stage = luminance(STAGE_BACKGROUND.map((v) => v / 255))
  for (const wwr of [0.25, 0.35, 0.45, 0.55, 0.7]) {
    const ratio = (luminance(oklchToRgb(wwrStop(wwr))) + 0.05) / (stage + 0.05)
    expect(ratio, `wwr ${wwr}`).toBeGreaterThan(4.5)
  }
})
