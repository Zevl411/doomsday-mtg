import { describe, expect, it } from 'vitest'
import { getFunctionErrorMessage } from './ingestionRepository'

describe('getFunctionErrorMessage', () => {
  it('surfaces structured provider errors returned by the Edge Function', async () => {
    const error = {
      context: new Response(
        JSON.stringify({
          providerErrors: ['EDHTop16 request failed with 404.'],
        }),
        { status: 502 },
      ),
    }
    await expect(getFunctionErrorMessage(error)).resolves.toBe(
      'EDHTop16 request failed with 404.',
    )
  })

  it('uses a stable fallback for an unreadable platform error', async () => {
    await expect(getFunctionErrorMessage(new Error('private'))).resolves.toBe(
      'Tournament ingestion failed. Check the Edge Function logs.',
    )
  })
})
