import { describe, expect, it } from 'vitest'
import {
  createRegionKey,
  normalizeTournamentLocation,
} from './location'

describe('normalizeTournamentLocation', () => {
  it('normalizes coordinates, country, precision, and granular region', () => {
    expect(normalizeTournamentLocation({
      city: ' Miami ',
      stateRegion: 'FL',
      country: 'United States',
      latitude: '25.76',
      longitude: -80.19,
    })).toMatchObject({
      city: 'Miami',
      countryCode: 'US',
      latitude: 25.76,
      longitude: -80.19,
      locationPrecision: 'exact',
      regionKey: 'country:US/state:FL',
    })
  })

  it('does not invent invalid coordinates or unknown country codes', () => {
    expect(normalizeTournamentLocation({
      country: 'Atlantis',
      latitude: 200,
      longitude: '',
    })).toMatchObject({
      countryCode: null,
      latitude: null,
      longitude: null,
      locationPrecision: 'unknown',
      regionKey: 'unknown',
    })
  })

  it('recognizes online events and city/state/country precision', () => {
    expect(normalizeTournamentLocation({ venueName: 'Online Webcam' }))
      .toMatchObject({ isOnline: true, regionKey: 'online' })
    expect(normalizeTournamentLocation({ city: 'Toronto' }).locationPrecision)
      .toBe('city')
    expect(normalizeTournamentLocation({ stateRegion: 'ON' }).locationPrecision)
      .toBe('state')
    expect(normalizeTournamentLocation({ country: 'CA' }).locationPrecision)
      .toBe('country')
    expect(createRegionKey('CA', 'Ontario', false))
      .toBe('country:CA/state:ONTARIO')
  })
})
