import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getBitGoCoin } from '@/lib/bitgo';
import { prisma } from '@/lib/prisma';

type WalletLookupRow = {
  id: string;
  bitgo_wallet_id: string;
  network: string;
};

const walletIdSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^(c[a-z0-9]{8,}|[0-9a-fA-F-]{36})$/, 'Invalid wallet id format'),
});

// GET /api/v1/wallets/[id]/balance
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const parsed = walletIdSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid wallet id.',
        },
      },
      { status: 400 }
    );
  }

  const walletRows = await prisma.$queryRaw<WalletLookupRow[]>(Prisma.sql`
    SELECT id, bitgo_wallet_id, network
    FROM wallets
    WHERE id = ${parsed.data.id}
    LIMIT 1
  `);

  const wallet = walletRows[0];

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  try {
    const coin = await getBitGoCoin(wallet.network);
    const bitgoWallet = await coin.wallets().get({ id: wallet.bitgo_wallet_id });
    const source = bitgoWallet as {
      balanceString?: string;
      confirmedBalanceString?: string;
      spendableBalanceString?: string;
    };

    return NextResponse.json({
      data: {
        balanceString: source.balanceString ?? '0',
        confirmedBalanceString: source.confirmedBalanceString ?? '0',
        spendableBalanceString: source.spendableBalanceString ?? '0',
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[GET /api/v1/wallets/:id/balance]', error);
    return NextResponse.json(
      { error: { code: 'BITGO_ERROR', message: 'Failed to fetch balance.' } },
      { status: 502 }
    );
  }
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for wallet balances.' } },
    { status: 405 }
  );
}
