import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/supabase/database.types'
import { sanitizeEnv } from '@/lib/supabase/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Setting cookies from a Server Component throws — safe to ignore
            // when middleware is refreshing the session.
          }
        },
      },
    }
  )
}

export function createServiceClient() {
  return createServerClient<Database>(
    sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}
