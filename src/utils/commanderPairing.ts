import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { getCardIdentity } from './cardIdentity'

export interface CommanderPairingResult {
  allowed: boolean
  reason?: string
}

/** Returns every selected commander without making callers handle null values. */
export function getDeckCommanders(deck: Deck): ScryfallCard[] {
  return [deck.commander, deck.partnerCommander].filter(
    (card): card is ScryfallCard => card !== null && card !== undefined,
  )
}

/** Commander color identity is the union of both commanders' identities. */
export function getCommanderColorIdentity(deck: Deck): string[] {
  return [
    ...new Set(
      getDeckCommanders(deck).flatMap((card) => card.color_identity),
    ),
  ]
}

/**
 * Checks the constructed Commander pairing variants represented in Oracle
 * text. Matching Partner—variants by their suffix also supports new named
 * variants without hard-coding every product name.
 */
export function validateCommanderPairing(
  first: ScryfallCard,
  second: ScryfallCard,
): CommanderPairingResult {
  if (getCardIdentity(first) === getCardIdentity(second)) {
    return { allowed: false, reason: 'A card cannot partner with itself.' }
  }

  const firstText = getOracleText(first)
  const secondText = getOracleText(second)
  if (hasStandalonePartner(firstText) && hasStandalonePartner(secondText)) {
    return { allowed: true }
  }

  const firstNamedPartner = getNamedPartner(firstText)
  const secondNamedPartner = getNamedPartner(secondText)
  if (
    namesMatch(firstNamedPartner, second.name) &&
    namesMatch(secondNamedPartner, first.name)
  ) {
    return { allowed: true }
  }

  const firstVariant = getPartnerVariant(firstText)
  const secondVariant = getPartnerVariant(secondText)
  if (
    firstVariant &&
    secondVariant &&
    normalizeName(firstVariant) === normalizeName(secondVariant)
  ) {
    return { allowed: true }
  }

  if (
    (hasChooseBackground(firstText) && isBackground(second)) ||
    (hasChooseBackground(secondText) && isBackground(first))
  ) {
    return { allowed: true }
  }

  if (
    (hasDoctorsCompanion(firstText) && isDoctor(second)) ||
    (hasDoctorsCompanion(secondText) && isDoctor(first))
  ) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: `${first.name} and ${second.name} cannot be paired as commanders.`,
  }
}

/** Produces a Scryfall filter that narrows the second-commander search. */
export function getPartnerSearchFilter(card: ScryfallCard): string {
  const oracleText = getOracleText(card)
  const namedPartner = getNamedPartner(oracleText)
  if (namedPartner) return `!"${escapeQuery(namedPartner)}"`

  const variant = getPartnerVariant(oracleText)
  if (variant) return `o:"Partner—${escapeQuery(variant)}"`

  if (hasStandalonePartner(oracleText)) return 'o:/^Partner( \\\\(|$)/'
  if (hasChooseBackground(oracleText)) return 't:background'
  if (isBackground(card)) return 'o:"Choose a Background"'
  if (hasDoctorsCompanion(oracleText)) return 't:doctor'
  if (isDoctor(card)) return `o:"Doctor's companion"`
  return ''
}

export function canHavePartner(card: ScryfallCard): boolean {
  return Boolean(getPartnerSearchFilter(card))
}

function getOracleText(card: ScryfallCard): string {
  return [
    card.oracle_text,
    ...(card.card_faces?.map((face) => face.oracle_text) ?? []),
  ]
    .filter(Boolean)
    .join('\n')
}

function hasStandalonePartner(text: string): boolean {
  return /(?:^|\n)Partner(?:\s*\(|$)/im.test(text)
}

function getNamedPartner(text: string): string | null {
  return text.match(/(?:^|\n)Partner with ([^(.\n]+)/im)?.[1]?.trim() ?? null
}

function getPartnerVariant(text: string): string | null {
  return text.match(/(?:^|\n)Partner\s*[—–-]\s*([^(.\n]+)/im)?.[1]?.trim() ??
    null
}

function hasChooseBackground(text: string): boolean {
  return /Choose a Background/i.test(text)
}

function hasDoctorsCompanion(text: string): boolean {
  return /Doctor's companion/i.test(text)
}

function isBackground(card: ScryfallCard): boolean {
  return /\bLegendary Enchantment\b.*\bBackground\b/i.test(card.type_line)
}

function isDoctor(card: ScryfallCard): boolean {
  return /\bLegendary Creature\b.*\bDoctor\b/i.test(card.type_line)
}

function namesMatch(name: string | null, expected: string): boolean {
  return name !== null && normalizeName(name) === normalizeName(expected)
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function escapeQuery(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
