import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  getBitGoCoinMock: vi.fn(),
  generateRandomStealthMetaAddressMock: vi.fn(),
  generateStealthAddressMock: vi.fn(),
  prepareAnnounceMock: vi.fn(),
  watchAnnouncementsForUserMock: vi.fn(),
}));
vi.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mocks.queryRawMock,
  },
}));

vi.mock('@/lib/bitgo', () => ({
  getBitGoCoin: mocks.getBitGoCoinMock,
}));

vi.mock('@scopelift/stealth-address-sdk', () => ({
  generateRandomStealthMetaAddress: mocks.generateRandomStealthMetaAddressMock,
  generateStealthAddress: mocks.generateStealthAddressMock,
  VALID_SCHEME_ID: {
    SCHEME_ID_1: 1,
  },
}));

vi.mock('@/lib/stealthClient', () => ({
  stealthClient: {
    prepareAnnounce: mocks.prepareAnnounceMock,
    watchAnnouncementsForUser: mocks.watchAnnouncementsForUserMock,
  },
}));

import { GET as getWallets, POST as postWallets } from '../wallets/route';
import { GET as getWalletBalance, POST as postWalletBalance } from '../wallets/[id]/balance/route';
import { GET as getSendGuard, POST as postSend } from '../transactions/send/route';
import { GET as getScan, POST as postScan } from '../scan/route';

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('v1 API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/wallets', () => {
    it('returns wallets sorted result with meta timestamp', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([
        {
          id: 'w1',
          label: 'Main',
          bitgo_wallet_id: 'bg1',
          network: 'tbtc',
          public_view_key: '0x02aa',
          public_spend_key: '0x03bb',
          created_at: '2026-03-13T10:00:00.000Z',
        },
      ]);

      const res = await getWallets();
      const body = (await res.json()) as {
        data: Array<{ id: string }>;
        meta: { timestamp: string };
      };

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.id).toBe('w1');
      expect(body.meta.timestamp).toBeTruthy();
    });

    it('returns INTERNAL_ERROR when db fails', async () => {
      mocks.queryRawMock.mockRejectedValueOnce(new Error('db down'));

      const res = await getWallets();
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/v1/wallets', () => {
    it('returns VALIDATION_ERROR for invalid body', async () => {
      const res = await postWallets(
        jsonPost('http://localhost/api/v1/wallets', { label: '', passphrase: '123' }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns WALLET_CREATION_FAILED when simulated user context is missing', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([]);

      const res = await postWallets(
        jsonPost('http://localhost/api/v1/wallets', {
          label: 'Main',
          passphrase: 'password123',
        }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('WALLET_CREATION_FAILED');
    });

    it('creates wallet successfully and returns expected response shape', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([{ user_id: 'u1' }]).mockResolvedValueOnce([
        {
          id: 'w2',
          label: 'Main Wallet',
          bitgo_wallet_id: 'bg-wallet-2',
          network: 'tbtc',
          public_view_key: '0x02'.padEnd(68, 'a'),
          public_spend_key: '0x03'.padEnd(68, 'b'),
          created_at: '2026-03-13T10:00:00.000Z',
        },
      ]);

      mocks.generateRandomStealthMetaAddressMock.mockReturnValueOnce({
        viewingPrivateKey: '0x' + '11'.repeat(32),
        viewingPublicKey: '0x02' + '22'.repeat(32),
        spendingPrivateKey: '0x' + '33'.repeat(32),
        spendingPublicKey: '0x03' + '44'.repeat(32),
      });

      const generateWalletMock = vi.fn().mockResolvedValue({
        wallet: {
          id: () => 'bg-wallet-2',
        },
      });

      mocks.getBitGoCoinMock.mockReturnValue({
        wallets: () => ({
          generateWallet: generateWalletMock,
        }),
      });

      const res = await postWallets(
        jsonPost('http://localhost/api/v1/wallets', {
          label: 'Main Wallet',
          passphrase: 'password123',
        }) as never
      );
      const body = (await res.json()) as {
        data: { id: string; bitgoWalletId: string; stealthAddress: { publicViewKey: string } };
        meta: { timestamp: string };
      };

      expect(res.status).toBe(201);
      expect(body.data.id).toBe('w2');
      expect(body.data.bitgoWalletId).toBe('bg-wallet-2');
      expect(body.data.stealthAddress.publicViewKey.startsWith('0x')).toBe(true);
      expect(body.meta.timestamp).toBeTruthy();
    });
  });

  describe('GET /api/v1/wallets/:id/balance', () => {
    it('returns VALIDATION_ERROR for invalid wallet id', async () => {
      const res = await getWalletBalance({} as never, { params: { id: 'bad' } });
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns WALLET_NOT_FOUND if wallet does not exist', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([]);

      const res = await getWalletBalance({} as never, { params: { id: 'cabc12345678' } });
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('WALLET_NOT_FOUND');
    });

    it('returns balance strings from BitGo wallet', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([
        { id: 'w1', bitgo_wallet_id: 'bg1', network: 'tbtc' },
      ]);

      const getMock = vi.fn().mockResolvedValue({
        balanceString: '1200',
        confirmedBalanceString: '1000',
        spendableBalanceString: '900',
      });

      mocks.getBitGoCoinMock.mockReturnValue({
        wallets: () => ({ get: getMock }),
      });

      const res = await getWalletBalance({} as never, { params: { id: 'cabc12345678' } });
      const body = (await res.json()) as {
        data: {
          balanceString: string;
          confirmedBalanceString: string;
          spendableBalanceString: string;
        };
      };

      expect(res.status).toBe(200);
      expect(body.data.balanceString).toBe('1200');
      expect(body.data.confirmedBalanceString).toBe('1000');
      expect(body.data.spendableBalanceString).toBe('900');
    });

    it('returns BITGO_ERROR when BitGo call fails', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([
        { id: 'w1', bitgo_wallet_id: 'bg1', network: 'tbtc' },
      ]);

      const getMock = vi.fn().mockRejectedValue(new Error('bitgo err'));
      mocks.getBitGoCoinMock.mockReturnValue({
        wallets: () => ({ get: getMock }),
      });

      const res = await getWalletBalance({} as never, { params: { id: 'cabc12345678' } });
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(502);
      expect(body.error.code).toBe('BITGO_ERROR');
    });

    it('POST method returns METHOD_NOT_ALLOWED', async () => {
      const res = await postWalletBalance();
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(405);
      expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('POST /api/v1/transactions/send', () => {
    it('returns VALIDATION_ERROR for invalid payload', async () => {
      const res = await postSend(
        jsonPost('http://localhost/api/v1/transactions/send', {
          senderWalletId: 'bad',
          receiverStealthMetaAddressURI: 'bad-uri',
          amountSats: -1,
          walletPassphrase: '',
        }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns WALLET_NOT_FOUND when sender wallet does not exist', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([]);

      const res = await postSend(
        jsonPost('http://localhost/api/v1/transactions/send', {
          senderWalletId: 'cabc12345678',
          receiverStealthMetaAddressURI: `st:eth:0x${'ab'.repeat(66)}`,
          amountSats: 1000,
          walletPassphrase: 'pass1234',
        }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('WALLET_NOT_FOUND');
    });

    it('sends tx successfully without senderAddress (no announcePayload)', async () => {
      mocks.queryRawMock
        .mockResolvedValueOnce([{ id: 'w1', bitgo_wallet_id: 'bg1', network: 'tbtc' }])
        .mockResolvedValueOnce([
          {
            tx_hash: 'tx-1',
            amount_sats: 1000,
            status: 'pending',
            one_time_address: '0x' + 'ab'.repeat(20),
            ephemeral_public_key: '0x02' + 'cd'.repeat(32),
          },
        ]);

      mocks.generateStealthAddressMock.mockReturnValueOnce({
        stealthAddress: '0x' + 'ab'.repeat(20),
        ephemeralPublicKey: '0x02' + 'cd'.repeat(32),
        viewTag: '0x01',
      });

      const sendManyMock = vi.fn().mockResolvedValue({ txid: 'tx-1' });
      const getWalletMock = vi.fn().mockResolvedValue({ sendMany: sendManyMock });
      mocks.getBitGoCoinMock.mockReturnValue({
        wallets: () => ({ get: getWalletMock }),
      });

      const res = await postSend(
        jsonPost('http://localhost/api/v1/transactions/send', {
          senderWalletId: 'cabc12345678',
          receiverStealthMetaAddressURI: `st:eth:0x${'ab'.repeat(66)}`,
          amountSats: 1000,
          walletPassphrase: 'pass1234',
        }) as never
      );

      const body = (await res.json()) as { data: { txHash: string; announcePayload?: unknown } };
      expect(res.status).toBe(201);
      expect(body.data.txHash).toBe('tx-1');
      expect(body.data.announcePayload).toBeUndefined();
      expect(mocks.prepareAnnounceMock).not.toHaveBeenCalled();
    });

    it('includes announcePayload when senderAddress is provided', async () => {
      mocks.queryRawMock
        .mockResolvedValueOnce([{ id: 'w1', bitgo_wallet_id: 'bg1', network: 'tbtc' }])
        .mockResolvedValueOnce([
          {
            tx_hash: 'tx-2',
            amount_sats: 2000,
            status: 'pending',
            one_time_address: '0x' + 'ef'.repeat(20),
            ephemeral_public_key: '0x02' + 'aa'.repeat(32),
          },
        ]);

      mocks.generateStealthAddressMock.mockReturnValueOnce({
        stealthAddress: '0x' + 'ef'.repeat(20),
        ephemeralPublicKey: '0x02' + 'aa'.repeat(32),
        viewTag: '0x0f',
      });

      mocks.prepareAnnounceMock.mockResolvedValueOnce({ to: '0xannouncer', data: '0xdeadbeef' });

      const sendManyMock = vi.fn().mockResolvedValue({ txid: 'tx-2' });
      const getWalletMock = vi.fn().mockResolvedValue({ sendMany: sendManyMock });
      mocks.getBitGoCoinMock.mockReturnValue({
        wallets: () => ({ get: getWalletMock }),
      });

      const res = await postSend(
        jsonPost('http://localhost/api/v1/transactions/send', {
          senderWalletId: 'cabc12345678',
          receiverStealthMetaAddressURI: `st:eth:0x${'cd'.repeat(66)}`,
          amountSats: 2000,
          walletPassphrase: 'pass1234',
          senderAddress: '0x' + '12'.repeat(20),
        }) as never
      );

      const body = (await res.json()) as { data: { announcePayload?: unknown } };
      expect(res.status).toBe(201);
      expect(body.data.announcePayload).toBeDefined();
      expect(mocks.prepareAnnounceMock).toHaveBeenCalledTimes(1);
    });

    it('returns TX_BUILD_FAILED when sendMany throws', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([
        { id: 'w1', bitgo_wallet_id: 'bg1', network: 'tbtc' },
      ]);
      mocks.generateStealthAddressMock.mockReturnValueOnce({
        stealthAddress: '0x' + '11'.repeat(20),
        ephemeralPublicKey: '0x02' + '22'.repeat(32),
        viewTag: '0x0a',
      });

      const sendManyMock = vi.fn().mockRejectedValue(new Error('send failed'));
      const getWalletMock = vi.fn().mockResolvedValue({ sendMany: sendManyMock });
      mocks.getBitGoCoinMock.mockReturnValue({
        wallets: () => ({ get: getWalletMock }),
      });

      const res = await postSend(
        jsonPost('http://localhost/api/v1/transactions/send', {
          senderWalletId: 'cabc12345678',
          receiverStealthMetaAddressURI: `st:eth:0x${'ef'.repeat(66)}`,
          amountSats: 2000,
          walletPassphrase: 'pass1234',
        }) as never
      );

      const body = (await res.json()) as { error: { code: string } };
      expect(res.status).toBe(500);
      expect(body.error.code).toBe('TX_BUILD_FAILED');
    });

    it('GET method returns METHOD_NOT_ALLOWED', async () => {
      const res = await getSendGuard();
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(405);
      expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('POST /api/v1/scan and GET /api/v1/scan', () => {
    it('POST returns VALIDATION_ERROR for invalid walletId', async () => {
      const res = await postScan(
        jsonPost('http://localhost/api/v1/scan', { walletId: 'bad' }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST returns WALLET_NOT_FOUND when wallet is missing', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([]);

      const res = await postScan(
        jsonPost('http://localhost/api/v1/scan', { walletId: 'cabc12345678' }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('WALLET_NOT_FOUND');
    });

    it('POST scans logs, deduplicates by tx_hash, and returns detected payments', async () => {
      const unwatchMock = vi.fn();
      mocks.queryRawMock
        .mockResolvedValueOnce([
          {
            id: 'w1',
            public_spend_key: '0x03' + 'aa'.repeat(32),
            encrypted_view_priv_key: '0x' + 'bb'.repeat(32),
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'dp1',
            wallet_id: 'w1',
            tx_hash: '0xtx1',
            one_time_address: '0x' + '11'.repeat(20),
            ephemeral_public_key: '0x02' + '22'.repeat(32),
            amount_sats: 0,
            created_at: '2026-03-13T10:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([{ id: 'existing' }]);

      mocks.watchAnnouncementsForUserMock.mockImplementationOnce(
        async (opts: { handleLogsForUser: (logs: Array<unknown>) => Promise<void> }) => {
          await opts.handleLogsForUser([
            {
              args: {
                ephemeralPubKey: '0x02' + '22'.repeat(32),
                stealthAddress: '0x' + '11'.repeat(20),
              },
              transactionHash: '0xtx1',
            },
            {
              args: {
                ephemeralPubKey: '0x02' + '33'.repeat(32),
                stealthAddress: '0x' + '44'.repeat(20),
              },
              transactionHash: '0xtx2',
            },
          ]);
          return unwatchMock;
        }
      );

      const res = await postScan(
        jsonPost('http://localhost/api/v1/scan', { walletId: 'cabc12345678' }) as never
      );

      const body = (await res.json()) as {
        data: { walletId: string; detectedPayments: Array<{ id: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.walletId).toBe('w1');
      expect(body.data.detectedPayments).toHaveLength(1);
      expect(body.data.detectedPayments[0]?.id).toBe('dp1');
      expect(unwatchMock).toHaveBeenCalledTimes(1);
    });

    it('POST returns SCAN_FAILED when watcher throws', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([
        {
          id: 'w1',
          public_spend_key: '0x03' + 'aa'.repeat(32),
          encrypted_view_priv_key: '0x' + 'bb'.repeat(32),
        },
      ]);
      mocks.watchAnnouncementsForUserMock.mockRejectedValueOnce(new Error('scan failed'));

      const res = await postScan(
        jsonPost('http://localhost/api/v1/scan', { walletId: 'cabc12345678' }) as never
      );
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('SCAN_FAILED');
    });

    it('GET returns VALIDATION_ERROR for bad walletId query', async () => {
      const res = await getScan(new Request('http://localhost/api/v1/scan?walletId=bad') as never);
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET lists detected payments with walletId filter', async () => {
      mocks.queryRawMock.mockResolvedValueOnce([
        {
          id: 'dp1',
          wallet_id: 'w1',
          tx_hash: '0xtx1',
          one_time_address: '0x' + '11'.repeat(20),
          ephemeral_public_key: '0x02' + '22'.repeat(32),
          amount_sats: 111,
          created_at: '2026-03-13T10:00:00.000Z',
        },
      ]);

      const res = await getScan(
        new Request('http://localhost/api/v1/scan?walletId=cabc12345678') as never
      );
      const body = (await res.json()) as { data: Array<{ id: string }> };

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.id).toBe('dp1');
    });

    it('GET returns INTERNAL_ERROR when db fails', async () => {
      mocks.queryRawMock.mockRejectedValueOnce(new Error('db fail'));

      const res = await getScan(new Request('http://localhost/api/v1/scan') as never);
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
