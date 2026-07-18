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

  // Multi-faced cards store these details on each face instead of on the card.
  mana_cost?: string
  oracle_text?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
}
