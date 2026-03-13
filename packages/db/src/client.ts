import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ─── Browser / Server client (uses anon key — respects RLS) ──────────────────

let _clientSingleton: SupabaseClient<Database> | null = null;

export function createSupabaseClient(): SupabaseClient<Database> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const anonKey =
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ??
    process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'] ??
    process.env['SUPABASE_ANON_KEY'];

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and one of NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
}

/** Singleton anon client — for use in Next.js API routes (server-side, no cookie auth). */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_clientSingleton) {
    _clientSingleton = createSupabaseClient();
  }
  return _clientSingleton;
}

// ─── Service-role client (bypasses RLS — scanner / background jobs only) ─────

let _adminSingleton: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_adminSingleton) return _adminSingleton;

  const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceKey =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ??
    process.env['SUPABASE_SECRET_KEY'] ??
    process.env['SUPABASE_SECRET'];

  if (!url || !serviceKey) {
    throw new Error(
      'Missing admin Supabase env vars: SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY'
    );
  }

  _adminSingleton = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _adminSingleton;
}
