import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client authenticated with the user's access token.
 * The token is passed via Authorization header from the frontend,
 * since this app uses the browser Supabase client (localStorage sessions)
 * rather than cookie-based SSR sessions.
 */
export function createAuthenticatedClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}
