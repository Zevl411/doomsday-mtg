import type { Tournament } from '../models/tournament'

/** Converts a granular, reprocessable region key into readable UI text. */
export function displayRegionKey(regionKey: string) {
  if (regionKey === 'online') return 'Online'
  if (regionKey === 'unknown') return 'Unknown location'
  return regionKey
    .replace('country:', '')
    .replace('/state:', ' · ')
}

/** Precise coordinates stay stored for future analysis but are not rendered. */
export function displayTournamentLocation(tournament: Tournament) {
  if (tournament.isOnline) return 'Online'
  const locality = [tournament.city, tournament.stateRegion]
    .filter(Boolean)
    .join(', ')
  const parts = [tournament.venueName, locality, tournament.countryCode]
    .filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Unknown location'
}

export function sourceAttribution(source: Tournament['source']) {
  return source === 'topdeck'
    ? { label: 'Data provided by TopDeck.gg', url: 'https://topdeck.gg' }
    : { label: 'Data provided by EDHTop16', url: 'https://edhtop16.com' }
}
