import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './config'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      // "implicit" lets a login link work even if it opens in a different
      // browser than the one the coach started in (common on phones).
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// Turn a Supabase/Postgres error into a sentence a coach can read.
export function friendlyError(err) {
  if (!err) return ''
  const msg = err.message || String(err)
  if (/rate limit/i.test(msg)) return 'Too many emails were sent recently. Please wait a few minutes and try again.'
  if (/expired|invalid.*token|otp/i.test(msg)) return 'That code didn\'t work or has expired. Please request a new one.'
  if (/row-level security|permission denied/i.test(msg)) return 'You don\'t have permission to do that.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Can\'t reach MatSlate right now. Check your internet connection and try again.'
  return msg
}
