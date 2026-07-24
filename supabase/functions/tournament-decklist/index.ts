import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  normalizePlaintextDeck,
  normalizeStructuredDeck,
} from '../_shared/tournamentDeckNormalizer.ts';
import { TopDeckProvider } from '../ingest-tournaments/topdeck.ts';

const EDHTOP16_GRAPHQL_URL = 'https://edhtop16.com/api/graphql';
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
`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.tournamentEntryId !== 'string') {
      return json({ error: 'A tournament entry ID is required.' }, 400);
    }
    const tournamentEntryId = body.tournamentEntryId.trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentEntryId)
    ) {
      return json({ error: 'The tournament entry ID is invalid.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase configuration is incomplete.');
    }
    // Tournament entries are public reference data. The anonymous client
    // respects their read-only RLS policy and never receives write authority.
    const client = createClient(supabaseUrl, anonKey);
    const { data: entry, error } = await client
      .from('tournament_entries')
      .select('source_entry_id, source_payload, tournaments!inner(source, source_tournament_id)')
      .eq('id', tournamentEntryId)
      .maybeSingle();
    if (error) throw error;
    if (!entry) return json({ error: 'Tournament entry not found.' }, 404);

    const tournament = Array.isArray(entry.tournaments) ? entry.tournaments[0] : entry.tournaments;
    if (tournament?.source === 'topdeck') {
      const storedDecklist = mapStoredTopDeckDecklist(entry.source_payload);
      const decklist =
        storedDecklist ??
        (await loadTopDeckDecklist(tournament.source_tournament_id, entry.source_entry_id));
      return decklist
        ? json(decklist)
        : json({ error: 'No decklist was found for this entry.' }, 404);
    }

    const entryId = typeof entry.source_entry_id === 'string' ? entry.source_entry_id.trim() : '';
    if (!entryId) {
      return json({ error: 'No decklist was found for this entry.' }, 404);
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
    });
    if (!response.ok) {
      throw new Error(`EDHTop16 request failed with ${response.status}.`);
    }

    const providerBody: unknown = await response.json();
    const decklist = mapDecklist(providerBody);
    if (!decklist) {
      return json({ error: 'No decklist was found for this entry.' }, 404);
    }
    return json(decklist);
  } catch (error) {
    console.warn('Tournament decklist request failed.', error);
    return json({ error: 'Unable to load this tournament decklist.' }, 502);
  }
});

async function loadTopDeckDecklist(tournamentId: unknown, entryId: unknown) {
  if (typeof tournamentId !== 'string' || typeof entryId !== 'string') {
    return null;
  }
  const apiKey = Deno.env.get('TOPDECK_API_KEY');
  if (!apiKey) return null;

  // Complete normalized entries intentionally release their large provider
  // payload. A targeted TID lookup can still repair an older incomplete
  // snapshot without restoring that payload to PostgreSQL.
  const provider = new TopDeckProvider({ apiKey });
  const [tournament] = await provider.listTournaments({
    tournamentIds: [tournamentId],
    minimumPlayers: 0,
  });
  if (!tournament) return null;
  const entries = await provider.listEntries(tournament);
  const matchingEntry = entries.find((item) => item.sourceEntryId === entryId);
  return matchingEntry ? mapStoredTopDeckDecklist(matchingEntry.raw) : null;
}

function mapStoredTopDeckDecklist(value: unknown) {
  if (!isRecord(value)) return null;
  const deckObject = value.deckObj ?? value.deckObject;
  const plaintext = value.decklist;
  const normalized = isRecord(deckObject)
    ? normalizeStructuredDeck(deckObject)
    : typeof plaintext === 'string' && plaintext.trim() && !/^https?:\/\//i.test(plaintext)
      ? normalizePlaintextDeck(plaintext)
      : null;
  if (!normalized?.cards.length) return null;

  const mapCandidate = (card: (typeof normalized.cards)[number]) => ({
    name: card.name,
    quantity: card.quantity,
    oracleId: null,
    typeLine: '',
    manaCost: '',
    manaValue: null,
    // The Vue repository replaces this with a batched Scryfall CDN URL.
    imageUrl: '',
    backImageUrl: '',
  });
  return {
    commanders: normalized.cards.filter((card) => card.board === 'commander').map(mapCandidate),
    cards: normalized.cards.filter((card) => card.board === 'mainboard').map(mapCandidate),
  };
}

function mapDecklist(value: unknown) {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const node = value.data.node;
  if (!isRecord(node)) return null;
  const commander = isRecord(node.commander) ? node.commander : null;
  const commanders = mapCards(commander?.cards);
  const cards = mapCards(node.maindeck);
  if (!commanders.length && !cards.length) return null;
  return { commanders, cards };
}

function mapCards(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((card) => {
    if (
      !isRecord(card) ||
      typeof card.name !== 'string' ||
      typeof card.cardPreviewImageUrl !== 'string'
    ) {
      return [];
    }
    return [
      {
        name: card.name,
        quantity: 1,
        oracleId: typeof card.oracleId === 'string' ? card.oracleId : null,
        typeLine: typeof card.type === 'string' ? card.type : '',
        manaCost: typeof card.manaCost === 'string' ? card.manaCost : '',
        manaValue: null,
        imageUrl: card.cardPreviewImageUrl,
        backImageUrl: '',
      },
    ];
  });
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
