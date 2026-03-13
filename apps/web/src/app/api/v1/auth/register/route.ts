import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseClient } from '@stealth/db';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        data: {
          user: { id: data.user?.id, email: data.user?.email },
          session: data.session,
          message: 'Check your email to confirm your account.',
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/auth/register]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Registration failed.' } },
      { status: 500 }
    );
  }
}
