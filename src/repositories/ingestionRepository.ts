import { supabase } from '../lib/supabase'

export interface IngestionOptions {
  provider: 'edhtop16'
  startDate?: string
  endDate?: string
  minimumPlayers: number
  dryRun: boolean
}

export interface IngestionReport {
  tournamentsFetched: number
  tournamentsInserted: number
  tournamentsUpdated: number
  entriesFetched: number
  entriesInserted: number
  entriesUpdated: number
  entriesSkipped: number
  validationIssues: string[]
  providerErrors: string[]
  durationMs: number
  dryRun: boolean
}

/** Keeps Edge Function invocation and admin checks outside presentation code. */
export const ingestionRepository = {
  async isCurrentUserAdmin(): Promise<boolean> {
    if (!supabase) return false
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return false
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (error) return false
    return Boolean(data)
  },

  async ingest(options: IngestionOptions): Promise<IngestionReport> {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.functions.invoke(
      'ingest-tournaments',
      { body: options },
    )
    if (error) {
      throw new Error(await getFunctionErrorMessage(error))
    }
    return data as IngestionReport
  },
}

/** Supabase attaches the Edge Function response to HTTP errors as context. */
export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    error.context instanceof Response
  ) {
    try {
      const body: unknown = await error.context.clone().json()
      if (isRecord(body)) {
        if (typeof body.error === 'string') return body.error
        if (
          Array.isArray(body.providerErrors) &&
          body.providerErrors.every((item) => typeof item === 'string') &&
          body.providerErrors.length
        ) {
          return body.providerErrors.join(' ')
        }
      }
    } catch {
      // A non-JSON platform error falls through to the stable message below.
    }
  }
  return 'Tournament ingestion failed. Check the Edge Function logs.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
