import type {
  AppThemePreference,
  CardArtAppTheme,
  CardThemePalette,
} from '../models/userPreferences'
import type { ScryfallCard } from '../types/card'
import { getCardArt } from '../utils/cardDisplay'
import {
  oracleDarkColors,
  oracleDarkVariables,
} from './oracleTheme'

export const CARD_ART_THEME_NAME = 'cardArtTheme'

interface RgbColor {
  red: number
  green: number
  blue: number
}

interface WeightedColor extends RgbColor {
  count: number
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const PALETTE_KEYS: Array<keyof CardThemePalette> = [
  'background',
  'surface',
  'surfaceBright',
  'surfaceLight',
  'primary',
  'primaryDarken',
  'primaryLighten',
  'secondary',
  'accent',
  'outline',
]

/**
 * Reads a small art-only crop in the browser. Downsizing before sampling keeps
 * the work bounded while still retaining the illustration's dominant colors.
 */
export async function createCardArtTheme(
  card: ScryfallCard,
): Promise<CardArtAppTheme> {
  const artUrl = getCardArt(card)
  if (!artUrl) throw new Error('This card does not have artwork to sample.')
  const paletteSourceUrl = buildCardArtProxyUrl(
    artUrl,
    import.meta.env.VITE_SUPABASE_URL,
  )

  return {
    mode: 'card',
    cardId: card.id,
    cardName: card.name,
    artUrl,
    palette: buildCardThemePalette(await sampleImageColors(paletteSourceUrl)),
  }
}

/**
 * Scryfall artwork can be displayed cross-origin but its CDN does not grant
 * browsers permission to inspect pixels on a canvas. The public Edge Function
 * adds that narrow CORS boundary and accepts only Scryfall art-crop URLs.
 */
export function buildCardArtProxyUrl(
  artUrl: string,
  supabaseUrl: string | undefined,
): string {
  if (!supabaseUrl) {
    throw new Error(
      'Card artwork themes require the Supabase card-art proxy to be configured.',
    )
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, '')
  return `${baseUrl}/functions/v1/card-art-proxy?url=${encodeURIComponent(artUrl)}`
}

/**
 * Converts sampled pixels into a dark, artwork-led palette. Dark surfaces keep
 * card images and readable text dominant; the richer colors become controls,
 * focus states, and borders.
 */
export function buildCardThemePalette(colors: RgbColor[]): CardThemePalette {
  const buckets = new Map<string, WeightedColor>()

  for (const color of colors) {
    const lightness = relativeLightness(color)
    if (lightness < 0.04 || lightness > 0.96) continue

    const quantized = {
      red: Math.round(color.red / 32) * 32,
      green: Math.round(color.green / 32) * 32,
      blue: Math.round(color.blue / 32) * 32,
    }
    const key = `${quantized.red},${quantized.green},${quantized.blue}`
    const existing = buckets.get(key)
    if (existing) existing.count += 1
    else buckets.set(key, { ...quantized, count: 1 })
  }

  /*
   * Nearby shades in painted art often occupy separate quantized buckets.
   * Clustering those buckets first prevents one large area and its gradients
   * from taking every theme role while smaller colors disappear.
   */
  const ranked = clusterColors([...buckets.values()]).sort(
    (left, right) => colorScore(right) - colorScore(left),
  )
  if (!ranked.length) {
    throw new Error('The artwork did not contain enough color to build a theme.')
  }

  const primarySource = ranked[0]
  const secondarySource =
    chooseDistinctColor(ranked.slice(1), [primarySource]) ??
    rotateChannels(primarySource)
  const accentSource =
    chooseDistinctColor(ranked.slice(1), [primarySource, secondarySource]) ??
    rotateChannels(secondarySource)
  const primary = makeAccent(primarySource)
  const secondary = makeAccent(secondarySource)
  const accent = makeAccent(accentSource)
  const ambient = weightedAverage(ranked)
  const darkBase = mix(ambient, { red: 9, green: 9, blue: 14 }, 0.86)
  const combinedOutline = mix(mix(primary, secondary, 0.5), accent, 0.34)

  return {
    background: toHex(mix(darkBase, ambient, 0.05)),
    surface: toHex(mix(darkBase, primary, 0.11)),
    surfaceBright: toHex(mix(darkBase, secondary, 0.20)),
    surfaceLight: toHex(mix(darkBase, accent, 0.28)),
    primary: toHex(primary),
    primaryDarken: toHex(mix(primary, darkBase, 0.30)),
    primaryLighten: toHex(mix(primary, { red: 255, green: 255, blue: 255 }, 0.34)),
    secondary: toHex(secondary),
    accent: toHex(mix(accent, darkBase, 0.35)),
    outline: toHex(mix(combinedOutline, darkBase, 0.22)),
  }
}

/** Only fully validated palettes cross the localStorage/Supabase boundary. */
export function normalizeAppTheme(value: unknown): AppThemePreference {
  if (!isRecord(value) || value.mode !== 'card') return { mode: 'default' }
  if (
    typeof value.cardId !== 'string' ||
    !value.cardId ||
    typeof value.cardName !== 'string' ||
    !value.cardName ||
    typeof value.artUrl !== 'string' ||
    !value.artUrl ||
    !isRecord(value.palette)
  ) {
    return { mode: 'default' }
  }

  const palette = {} as CardThemePalette
  for (const key of PALETTE_KEYS) {
    const color = value.palette[key]
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
      return { mode: 'default' }
    }
    palette[key] = color.toUpperCase()
  }

  return {
    mode: 'card',
    cardId: value.cardId,
    cardName: value.cardName,
    artUrl: value.artUrl,
    palette,
  }
}

/** Maps the persisted compact palette onto the app's complete Vuetify theme. */
export function getVuetifyTheme(
  preference: CardArtAppTheme,
) {
  const palette = preference.palette
  return {
    dark: true,
    colors: {
      ...oracleDarkColors,
      background: palette.background,
      surface: palette.surface,
      'surface-bright': palette.surfaceBright,
      'surface-light': palette.surfaceLight,
      'surface-variant': palette.surfaceLight,
      primary: palette.primary,
      'primary-darken-1': palette.primaryDarken,
      'primary-lighten-1': palette.primaryLighten,
      secondary: palette.secondary,
      accent: palette.accent,
      outline: palette.outline,
      'on-primary': readableTextColor(palette.primary),
      'on-secondary': readableTextColor(palette.secondary),
      'on-accent': readableTextColor(palette.accent),
    },
    variables: {
      ...oracleDarkVariables,
      'border-color': palette.outline,
      'theme-kbd': palette.surfaceBright,
      'theme-code': palette.surfaceBright,
      'theme-on-code': palette.primaryLighten,
    },
  }
}

async function sampleImageColors(url: string): Promise<RgbColor[]> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(
      new Error(
        'The card artwork could not be sampled. Deploy the card-art-proxy function and try again.',
      ),
    )
    image.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Theme generation is unavailable in this browser.')

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  let pixels: Uint8ClampedArray
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    throw new Error('The card artwork could not be sampled for a theme.')
  }

  const colors: RgbColor[] = []
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 200) continue
    colors.push({
      red: pixels[index],
      green: pixels[index + 1],
      blue: pixels[index + 2],
    })
  }
  return colors
}

function colorScore(color: WeightedColor): number {
  const channels = [color.red, color.green, color.blue]
  const saturation = (Math.max(...channels) - Math.min(...channels)) / 255
  const middleTone = 1 - Math.abs(relativeLightness(color) - 0.52)
  return color.count * (0.35 + saturation) * (0.65 + middleTone)
}

/**
 * A small weighted k-means pass captures the illustration's major color
 * regions. Seeds favor distance from colors already chosen, keeping a small
 * but vivid highlight eligible even when the background covers more pixels.
 */
function clusterColors(
  colors: WeightedColor[],
  maximumClusters = 5,
): WeightedColor[] {
  if (colors.length <= maximumClusters) return colors

  const seeds: WeightedColor[] = [
    [...colors].sort((left, right) => colorScore(right) - colorScore(left))[0],
  ]
  while (seeds.length < maximumClusters) {
    const candidate = [...colors]
      .filter((color) => !seeds.includes(color))
      .sort(
        (left, right) =>
          clusterSeedScore(right, seeds) - clusterSeedScore(left, seeds),
      )[0]
    if (!candidate) break
    seeds.push(candidate)
  }

  let centers = seeds.map((seed) => ({ ...seed }))
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const totals = centers.map(() => ({
      red: 0,
      green: 0,
      blue: 0,
      count: 0,
    }))

    for (const color of colors) {
      const centerIndex = nearestColorIndex(color, centers)
      const total = totals[centerIndex]
      total.red += color.red * color.count
      total.green += color.green * color.count
      total.blue += color.blue * color.count
      total.count += color.count
    }

    centers = totals.map((total, index) =>
      total.count
        ? {
            red: total.red / total.count,
            green: total.green / total.count,
            blue: total.blue / total.count,
            count: total.count,
          }
        : centers[index],
    )
  }

  return centers
}

function clusterSeedScore(
  color: WeightedColor,
  seeds: WeightedColor[],
): number {
  const minimumDistance = Math.min(
    ...seeds.map((seed) => colorDistance(color, seed)),
  )
  const channels = [color.red, color.green, color.blue]
  const saturation = (Math.max(...channels) - Math.min(...channels)) / 255
  return minimumDistance * Math.sqrt(color.count) * (0.55 + saturation)
}

function nearestColorIndex(
  color: RgbColor,
  candidates: RgbColor[],
): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  candidates.forEach((candidate, index) => {
    const distance = colorDistance(color, candidate)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  return nearestIndex
}

function chooseDistinctColor(
  candidates: WeightedColor[],
  selected: RgbColor[],
): WeightedColor | undefined {
  return [...candidates].sort((left, right) =>
    distinctColorScore(right, selected) - distinctColorScore(left, selected)
  )[0]
}

function distinctColorScore(
  color: WeightedColor,
  selected: RgbColor[],
): number {
  const distance = Math.min(
    ...selected.map((selectedColor) => colorDistance(color, selectedColor)),
  )
  const channels = [color.red, color.green, color.blue]
  const saturation = (Math.max(...channels) - Math.min(...channels)) / 255
  return distance * Math.log2(color.count + 2) * (0.6 + saturation)
}

function weightedAverage(colors: WeightedColor[]): RgbColor {
  const totals = colors.reduce(
    (result, color) => {
      // Square-root weighting retains the dominant mood without erasing
      // smaller color regions that were significant enough to form a cluster.
      const weight = Math.sqrt(color.count)
      result.red += color.red * weight
      result.green += color.green * weight
      result.blue += color.blue * weight
      result.weight += weight
      return result
    },
    { red: 0, green: 0, blue: 0, weight: 0 },
  )
  return {
    red: totals.red / totals.weight,
    green: totals.green / totals.weight,
    blue: totals.blue / totals.weight,
  }
}

function makeAccent(color: RgbColor): RgbColor {
  const average = (color.red + color.green + color.blue) / 3
  const saturated = {
    red: average + (color.red - average) * 1.32,
    green: average + (color.green - average) * 1.32,
    blue: average + (color.blue - average) * 1.32,
  }
  const lightness = relativeLightness(saturated)
  if (lightness < 0.34) {
    return mix(saturated, { red: 255, green: 255, blue: 255 }, 0.28)
  }
  if (lightness > 0.78) {
    return mix(saturated, { red: 20, green: 20, blue: 24 }, 0.18)
  }
  return clampColor(saturated)
}

function mix(left: RgbColor, right: RgbColor, rightWeight: number): RgbColor {
  return clampColor({
    red: left.red * (1 - rightWeight) + right.red * rightWeight,
    green: left.green * (1 - rightWeight) + right.green * rightWeight,
    blue: left.blue * (1 - rightWeight) + right.blue * rightWeight,
  })
}

function rotateChannels(color: RgbColor): RgbColor {
  return { red: color.blue, green: color.red, blue: color.green }
}

function colorDistance(left: RgbColor, right: RgbColor): number {
  return Math.hypot(
    left.red - right.red,
    left.green - right.green,
    left.blue - right.blue,
  )
}

function relativeLightness(color: RgbColor): number {
  return (
    (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) /
    255
  )
}

function readableTextColor(background: string): string {
  const color = hexToRgb(background)
  return relativeLightness(color) > 0.58 ? '#111018' : '#FFF8EA'
}

function hexToRgb(value: string): RgbColor {
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  }
}

function clampColor(color: RgbColor): RgbColor {
  return {
    red: Math.max(0, Math.min(255, Math.round(color.red))),
    green: Math.max(0, Math.min(255, Math.round(color.green))),
    blue: Math.max(0, Math.min(255, Math.round(color.blue))),
  }
}

function toHex(color: RgbColor): string {
  const channel = (value: number) =>
    Math.round(value).toString(16).padStart(2, '0')
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`.toUpperCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
