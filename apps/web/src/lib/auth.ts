import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@stealth/db';

type AuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

/**
 * Verify the Supabase Bearer token from the Authorization header.
 * Uses getUser() — validates against Supabase Auth server (not local JWT secret).
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header.' } },
        { status: 401 }
      ),
    };
  }

  const token = header.slice(7);

  const supabase = createClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Token expired or invalid.' } },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true,
    userId: data.user.id,
    email: data.user.email ?? '',
  };
}
