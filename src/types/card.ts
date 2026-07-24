// These property names match Scryfall's JSON response. Keeping them unchanged
// makes it clear which API value is being used when card search is added.
export interface ScryfallImageUris {
  small: string
  normal: string
  large: string
  art_crop?: string
}

export interface ScryfallCardFace {
  name: string
  // Localized printings may expose the printed face name separately.
  printed_name?: string
  mana_cost?: string
  type_line: string

  // The question mark makes a property optional. Scryfall omits these values
  // for some cards, so code using them must first check that they exist.
  oracle_text?: string
  image_uris?: ScryfallImageUris
}

/** Daily marketplace values attached to one specific printed edition. */
export interface ScryfallCardPrices {
  usd?: string | null
  usd_foil?: string | null
  usd_etched?: string | null
}

export interface ScryfallPurchaseUris {
  tcgplayer?: string
}

export interface ScryfallCard {
  // id identifies one printing; oracle_id identifies the same card across sets.
  id: string
  oracle_id?: string
  name: string
  // Secret Lair reskins can display a flavor name while retaining the
  // canonical rules name, such as Hope's Aero Magic / Cyclonic Rift.
  flavor_name?: string
  printed_name?: string
  type_line: string
  color_identity: string[]
  // Scryfall calls a card's numeric mana value "cmc" in its API response.
  cmc?: number

  // Multi-faced cards store these details on each face instead of on the card.
  mana_cost?: string
  oracle_text?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  legalities?: Record<string, string>
  // Printing metadata is optional because older saved decks predate the
  // printing picker and analytical card records may not include set details.
  set?: string
  set_name?: string
  collector_number?: string
  released_at?: string
  rarity?: string
  lang?: string
  artist?: string
  // TCGplayer prices and links describe this printing, not the shared Oracle
  // identity. They therefore change when a user chooses another printing.
  tcgplayer_id?: number
  prices?: ScryfallCardPrices
  purchase_uris?: ScryfallPurchaseUris
  // Scryfall uses these fields to describe finishes available for one printed
  // edition. A Deck entry separately records which finish the user selected.
  finishes?: string[]
  foil?: boolean
  nonfoil?: boolean
}
