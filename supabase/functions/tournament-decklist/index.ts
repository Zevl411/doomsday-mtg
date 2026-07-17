const EDHTOP16_GRAPHQL_URL = 'https://edhtop16.com/api/graphql'
const ENTRY_DECK_QUERY = `
  query DoomsdayTournamentEntryDeck($id: ID!) {
    node(id: $id) {
      ... on Entry {
        id
        commander {
          cards {
            name
            oracleId
            type
            manaCost
            cardPreviewImageUrl
          }
        }
        maindeck {
          name
          oracleId
          type
          manaCost
          cardPreviewImageUrl
        }
      }
    }
  }
`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: unknown = await request.json()
    if (!isRecord(body) || typeof body.entryId !== 'string') {
      return json({ error: 'A tournament entry ID is required.' }, 400)
    }
    const entryId = body.entryId.trim()
    if (!entryId || entryId.length > 200) {
      return json({ error: 'The tournament entry ID is invalid.' }, 400)
    }

    const response = await fetch(EDHTOP16_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: ENTRY_DECK_QUERY,
        variables: { id: entryId },
      }),
    })
    if (!response.ok) {
      throw new Error(`EDHTop16 request failed with ${response.status}.`)
    }

    const providerBody: unknown = await response.json()
    const decklist = mapDecklist(providerBody)
    if (!decklist) {
      return json({ error: 'No decklist was found for this entry.' }, 404)
    }
    return json(decklist)
  } catch (error) {
    console.warn('Tournament decklist request failed.', error)
    return json({ error: 'Unable to load this tournament decklist.' }, 502)
  }
})

function mapDecklist(value: unknown) {
  if (!isRecord(value) || !isRecord(value.data)) return null
  const node = value.data.node
  if (!isRecord(node)) return null
  const commander = isRecord(node.commander) ? node.commander : null
  const commanders = mapCards(commander?.cards)
  const cards = mapCards(node.maindeck)
  if (!commanders.length && !cards.length) return null
  return { commanders, cards }
}

function mapCards(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((card) => {
    if (
      !isRecord(card) ||
      typeof card.name !== 'string' ||
      typeof card.cardPreviewImageUrl !== 'string'
    ) {
      return []
    }
    return [{
      name: card.name,
      oracleId: typeof card.oracleId === 'string' ? card.oracleId : null,
      typeLine: typeof card.type === 'string' ? card.type : '',
      manaCost: typeof card.manaCost === 'string' ? card.manaCost : '',
      imageUrl: card.cardPreviewImageUrl,
    }]
  })
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
