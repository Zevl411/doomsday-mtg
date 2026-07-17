import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { appConfig } from '../config/app'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Missing public configuration is a supported guest-only mode for tests,
// forks, and local development.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null

export const isCloudConfigured = supabase !== null

if (!isCloudConfigured && import.meta.env.MODE !== 'test') {
  console.warn(
    `Supabase is not configured. ${appConfig.name} is running in guest-only mode.`,
  )
}
