import type {
  LocationPrecision,
  NormalizedTournamentLocation,
} from './types.ts'

export interface ProviderLocationInput {
  venueName?: unknown
  city?: unknown
  stateRegion?: unknown
  country?: unknown
  latitude?: unknown
  longitude?: unknown
  address?: unknown
  source?: string
}

const COUNTRY_ALIASES: Record<string, string> = {
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  USA: 'US',
  CANADA: 'CA',
  JAPAN: 'JP',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  GERMANY: 'DE',
  FRANCE: 'FR',
  ITALY: 'IT',
  SPAIN: 'ES',
  AUSTRALIA: 'AU',
  BRAZIL: 'BR',
}

/** Pure normalization keeps provider response details out of storage code. */
export function normalizeTournamentLocation(
  input: ProviderLocationInput | null | undefined,
): NormalizedTournamentLocation {
  const venueName = clean(input?.venueName)
  const city = clean(input?.city)
  const stateRegion = clean(input?.stateRegion)
  const countryCode = normalizeCountry(input?.country)
  const latitude = coordinate(input?.latitude, -90, 90)
  const longitude = coordinate(input?.longitude, -180, 180)
  const locationText = [
    venueName,
    city,
    stateRegion,
    countryCode,
    clean(input?.address),
  ].filter(Boolean).join(' ')
  const isOnline = /\b(online|virtual|webcam|spelltable)\b/i.test(locationText)
  const locationPrecision = getPrecision({
    latitude,
    longitude,
    venueName,
    city,
    stateRegion,
    countryCode,
    isOnline,
  })
  return {
    venueName,
    city,
    stateRegion,
    countryCode,
    latitude,
    longitude,
    locationPrecision,
    isOnline,
    regionKey: createRegionKey(countryCode, stateRegion, isOnline),
    locationSource: clean(input?.source),
    locationConfidence:
      locationPrecision === 'unknown'
        ? null
        : locationPrecision === 'exact'
          ? 'high'
          : 'medium',
  }
}

export function createRegionKey(
  countryCode: string | null,
  stateRegion: string | null,
  isOnline: boolean,
) {
  if (isOnline) return 'online'
  if (!countryCode) return 'unknown'
  const state = stateRegion
    ?.normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
  return state
    ? `country:${countryCode}/state:${state}`
    : `country:${countryCode}`
}

function getPrecision(value: {
  latitude: number | null
  longitude: number | null
  venueName: string | null
  city: string | null
  stateRegion: string | null
  countryCode: string | null
  isOnline: boolean
}): LocationPrecision {
  if (value.isOnline) return 'online'
  if (value.latitude !== null && value.longitude !== null) return 'exact'
  if (value.venueName && (value.city || value.stateRegion)) return 'venue'
  if (value.city) return 'city'
  if (value.stateRegion) return 'state'
  if (value.countryCode) return 'country'
  return 'unknown'
}

function normalizeCountry(value: unknown) {
  const country = clean(value)?.toUpperCase()
  if (!country) return null
  if (/^[A-Z]{2}$/.test(country)) return country
  return COUNTRY_ALIASES[country] ?? null
}

function coordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null
}

function clean(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
