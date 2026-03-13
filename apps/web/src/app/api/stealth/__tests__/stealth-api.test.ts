import { describe, expect, it } from 'vitest';
import {
  generateStealthAddress,
  computeStealthKey,
  VALID_SCHEME_ID,
} from '@scopelift/stealth-address-sdk';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import fc from 'fast-check';

import { POST as postKeygen } from '../keygen/route';
import { POST as postId } from '../id/route';
import { POST as postAddress } from '../address/route';

type KeygenData = {
  id: string;
  stealthMetaAddressURI: string;
  scanPrivateKey: `0x${string}`;
  scanPublicKey: `0x${string}`;
  spendPrivateKey: `0x${string}`;
  spendPublicKey: `0x${string}`;
};

type AddressData = {
  stealthAddress: `0x${string}`;
  ephemeralPublicKey: `0x${string}`;
  viewTag: `0x${string}`;
};

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper: generate a valid stealthMetaAddressURI using the SDK keygen route.
async function getKeygen(): Promise<KeygenData> {
  const res = await postKeygen();
  const json = (await res.json()) as { data: KeygenData };
  return json.data;
}

// ─── keygen ──────────────────────────────────────────────────────────────────

describe('POST /api/stealth/keygen', () => {
  it('returns valid ERC-5564 key material', async () => {
    const res = await postKeygen();
    const json = (await res.json()) as { data: KeygenData };

    expect(res.status).toBe(200);
    expect(json.data.stealthMetaAddressURI).toMatch(/^st:[a-zA-Z0-9]+:0x[0-9a-f]{132}$/i);
    expect(json.data.scanPublicKey).toMatch(/^0x(02|03)[0-9a-f]{64}$/i);
    expect(json.data.spendPublicKey).toMatch(/^0x(02|03)[0-9a-f]{64}$/i);
    expect(json.data.scanPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(json.data.spendPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('id is SHA-256 of stealthMetaAddressURI', async () => {
    const key = await getKeygen();
    const expected = bytesToHex(sha256(utf8ToBytes(key.stealthMetaAddressURI)));
    expect(key.id).toBe(expected);
  });

  it('creates fresh keypairs on every call', async () => {
    const a = await getKeygen();
    const b = await getKeygen();
    expect(a.scanPrivateKey).not.toBe(b.scanPrivateKey);
    expect(a.spendPrivateKey).not.toBe(b.spendPrivateKey);
    expect(a.stealthMetaAddressURI).not.toBe(b.stealthMetaAddressURI);
    expect(a.id).not.toBe(b.id);
  });

  it('stealthMetaAddressURI is usable by generateStealthAddress (SDK round-trip)', async () => {
    const key = await getKeygen();
    // SDK must not throw and must produce a valid Ethereum address.
    const result = generateStealthAddress({ stealthMetaAddressURI: key.stealthMetaAddressURI });
    expect(result.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

// ─── id ──────────────────────────────────────────────────────────────────────

describe('POST /api/stealth/id', () => {
  it('returns deterministic id for the same URI', async () => {
    const key = await getKeygen();
    const req1 = jsonPost('http://localhost/api/stealth/id', {
      stealthMetaAddressURI: key.stealthMetaAddressURI,
    });
    const req2 = jsonPost('http://localhost/api/stealth/id', {
      stealthMetaAddressURI: key.stealthMetaAddressURI,
    });

    const res1 = await postId(req1 as never);
    const res2 = await postId(req2 as never);
    const body1 = (await res1.json()) as { data: { id: string; stealthMetaAddressURI: string } };
    const body2 = (await res2.json()) as { data: { id: string; stealthMetaAddressURI: string } };

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(body1.data.id).toBe(body2.data.id);
    expect(body1.data.stealthMetaAddressURI).toBe(key.stealthMetaAddressURI);
  });

  it('returns 400 for invalid URI format', async () => {
    const req = jsonPost('http://localhost/api/stealth/id', {
      stealthMetaAddressURI: 'stealth:bad',
    });
    const res = await postId(req as never);
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when stealthMetaAddressURI is missing', async () => {
    const req = jsonPost('http://localhost/api/stealth/id', {});
    const res = await postId(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for old stealth:key:key format', async () => {
    const req = jsonPost('http://localhost/api/stealth/id', {
      stealthMetaAddressURI: 'stealth:02abcdef:03fedcba',
    });
    const res = await postId(req as never);
    expect(res.status).toBe(400);
  });

  it('property test: id is always deterministic for valid URIs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.hexaString({ minLength: 132, maxLength: 132 }), async (metaHex) => {
        const uri = `st:eth:0x${metaHex}`;
        const reqA = jsonPost('http://localhost/api/stealth/id', { stealthMetaAddressURI: uri });
        const reqB = jsonPost('http://localhost/api/stealth/id', { stealthMetaAddressURI: uri });

        const resA = await postId(reqA as never);
        const resB = await postId(reqB as never);

        // Any 132-char hex URI is valid per our schema – both calls must agree.
        if (resA.status === 200) {
          const a = (await resA.json()) as { data: { id: string } };
          const b = (await resB.json()) as { data: { id: string } };
          expect(a.data.id).toBe(b.data.id);
        }
      }),
      { numRuns: 20 }
    );
  });
});

// ─── address ─────────────────────────────────────────────────────────────────

describe('POST /api/stealth/address', () => {
  it('returns stealthAddress, ephemeralPublicKey, viewTag', async () => {
    const key = await getKeygen();
    const req = jsonPost('http://localhost/api/stealth/address', {
      stealthMetaAddressURI: key.stealthMetaAddressURI,
    });

    const res = await postAddress(req as never);
    const body = (await res.json()) as { data: AddressData };

    expect(res.status).toBe(200);
    expect(body.data.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.data.ephemeralPublicKey).toMatch(/^0x(02|03)[0-9a-fA-F]{64}$/i);
    expect(body.data.viewTag).toMatch(/^0x[0-9a-fA-F]{2}$/i);
  });

  it('SDK round-trip: computeStealthKey recovers the stealth private key', async () => {
    const key = await getKeygen();
    const req = jsonPost('http://localhost/api/stealth/address', {
      stealthMetaAddressURI: key.stealthMetaAddressURI,
    });

    const res = await postAddress(req as never);
    const body = (await res.json()) as { data: AddressData };

    // The receiver can recover the one-time private key via computeStealthKey.
    const stealthPrivKey = computeStealthKey({
      viewingPrivateKey: key.scanPrivateKey,
      spendingPrivateKey: key.spendPrivateKey,
      ephemeralPublicKey: body.data.ephemeralPublicKey,
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
    });

    expect(stealthPrivKey).toMatch(/^0x[0-9a-fA-F]{64}$/i);
  });

  it('generates different outputs on repeated calls (unique ephemeral keys)', async () => {
    const key = await getKeygen();
    const call = () =>
      postAddress(
        jsonPost('http://localhost/api/stealth/address', {
          stealthMetaAddressURI: key.stealthMetaAddressURI,
        }) as never
      );

    const [res1, res2] = await Promise.all([call(), call()]);
    const b1 = (await res1.json()) as { data: AddressData };
    const b2 = (await res2.json()) as { data: AddressData };

    expect(b1.data.ephemeralPublicKey).not.toBe(b2.data.ephemeralPublicKey);
    expect(b1.data.stealthAddress).not.toBe(b2.data.stealthAddress);
    expect(b1.data.viewTag).toBeDefined();
    expect(b2.data.viewTag).toBeDefined();
  });

  it('returns 400 for invalid meta-address URI', async () => {
    const req = jsonPost('http://localhost/api/stealth/address', {
      stealthMetaAddressURI: 'invalid-uri',
    });
    const res = await postAddress(req as never);
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for old publicViewKey/publicSpendKey format', async () => {
    const req = jsonPost('http://localhost/api/stealth/address', {
      publicViewKey: '02' + 'ab'.repeat(32),
      publicSpendKey: '03' + 'cd'.repeat(32),
    });
    const res = await postAddress(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const req = jsonPost('http://localhost/api/stealth/address', {});
    const res = await postAddress(req as never);
    expect(res.status).toBe(400);
  });

  it('generates unique stealthAddresses under concurrency (30 parallel)', async () => {
    const key = await getKeygen();

    const promises = Array.from({ length: 30 }).map(() =>
      postAddress(
        jsonPost('http://localhost/api/stealth/address', {
          stealthMetaAddressURI: key.stealthMetaAddressURI,
        }) as never
      )
    );

    const results = await Promise.all(promises);
    const addresses = new Set<string>();

    for (const res of results) {
      const body = (await res.json()) as { data: AddressData };
      expect(res.status).toBe(200);
      addresses.add(body.data.stealthAddress);
    }

    // All 30 addresses must be unique.
    expect(addresses.size).toBe(30);
  });

  it('stress: 100 sequential derivations all succeed', async () => {
    const key = await getKeygen();

    for (let i = 0; i < 100; i++) {
      const req = jsonPost('http://localhost/api/stealth/address', {
        stealthMetaAddressURI: key.stealthMetaAddressURI,
      });
      const res = await postAddress(req as never);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: AddressData };
      expect(body.data.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
