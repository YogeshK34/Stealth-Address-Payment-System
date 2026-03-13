import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseClient } from '@stealth/db';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: error?.message ?? 'Login failed.' } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      data: {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: { id: data.user.id, email: data.user.email },
        expiresAt: data.session.expires_at,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/login]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Login failed.' } },
      { status: 500 }
    );
  }
}
