const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

/**
 * Browser canvases cannot inspect Scryfall CDN images without an explicit CORS
 * header. This deliberately narrow proxy permits only art-crop renditions and
 * never accepts another host, path type, or request method.
 */
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return jsonResponse({ message: 'Method not allowed.' }, 405)
  }

  const requestedUrl = new URL(request.url).searchParams.get('url')
  const artworkUrl = validateArtworkUrl(requestedUrl)
  if (!artworkUrl) {
    return jsonResponse({ message: 'A valid Scryfall art-crop URL is required.' }, 400)
  }

  try {
    const response = await fetch(artworkUrl, {
      headers: {
        // Scryfall requests a descriptive agent for automated HTTP clients.
        'User-Agent': 'DoomsdayMTG/0.2 card theme palette proxy',
      },
    })
    if (!response.ok || !response.body) {
      return jsonResponse({ message: 'Artwork is unavailable.' }, 502)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return jsonResponse({ message: 'The upstream response was not an image.' }, 502)
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    })
  } catch {
    return jsonResponse({ message: 'Artwork could not be fetched.' }, 502)
  }
})

function validateArtworkUrl(value: string | null): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.hostname === 'cards.scryfall.io' &&
      url.pathname.startsWith('/art_crop/')
      ? url
      : null
  } catch {
    return null
  }
}

function jsonResponse(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
