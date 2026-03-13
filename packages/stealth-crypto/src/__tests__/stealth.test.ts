import { describe, it, expect } from 'vitest';
import { generateStealthKeys, generateEphemeralKeyPair } from '../keygen';
import { deriveOneTimeAddress } from '../address';
import { scanTransaction } from '../scan';
import { deriveSpendingKey } from '../spend';

describe('Stealth Address Crypto', () => {
  it('generates distinct key pairs each call', () => {
    const k1 = generateStealthKeys();
    const k2 = generateStealthKeys();
    expect(k1.viewKey.privateKey).not.toBe(k2.viewKey.privateKey);
    expect(k1.spendKey.privateKey).not.toBe(k2.spendKey.privateKey);
  });

  it('derives a one-time address from stealth address', () => {
    const keys = generateStealthKeys();
    const eph = generateEphemeralKeyPair();
    const derived = deriveOneTimeAddress(eph.privateKey, keys.stealthAddress);

    expect(derived.oneTimeAddress).toBeTruthy();
    expect(derived.ephemeralPublicKey).toBe(eph.publicKey);
    expect(derived.oneTimeAddress).not.toBe(keys.stealthAddress.publicSpendKey);
  });

  it('scanner detects a sent payment (ECDH symmetry)', () => {
    const keys = generateStealthKeys();
    const eph = generateEphemeralKeyPair();
    const derived = deriveOneTimeAddress(eph.privateKey, keys.stealthAddress);

    const result = scanTransaction(
      derived.ephemeralPublicKey,
      keys.viewKey.privateKey,
      keys.stealthAddress,
      derived.oneTimeAddress
    );

    expect(result.match).toBe(true);
    expect(result.oneTimeAddress).toBe(derived.oneTimeAddress);
  });

  it('scanner rejects unrelated outputs', () => {
    const keys = generateStealthKeys();
    const otherKeys = generateStealthKeys();
    const eph = generateEphemeralKeyPair();
    const derived = deriveOneTimeAddress(eph.privateKey, keys.stealthAddress);

    const result = scanTransaction(
      derived.ephemeralPublicKey,
      otherKeys.viewKey.privateKey, // wrong view key → wrong shared secret
      otherKeys.stealthAddress,
      derived.oneTimeAddress
    );

    expect(result.match).toBe(false);
  });

  it('two payments to same receiver produce different one-time addresses', () => {
    const keys = generateStealthKeys();
    const e1 = generateEphemeralKeyPair();
    const e2 = generateEphemeralKeyPair();

    const d1 = deriveOneTimeAddress(e1.privateKey, keys.stealthAddress);
    const d2 = deriveOneTimeAddress(e2.privateKey, keys.stealthAddress);

    expect(d1.oneTimeAddress).not.toBe(d2.oneTimeAddress);
  });

  it('receiver can derive spending key from shared secret', () => {
    const keys = generateStealthKeys();
    const eph = generateEphemeralKeyPair();
    const derived = deriveOneTimeAddress(eph.privateKey, keys.stealthAddress);

    const result = scanTransaction(
      derived.ephemeralPublicKey,
      keys.viewKey.privateKey,
      keys.stealthAddress,
      derived.oneTimeAddress
    );

    expect(result.match).toBe(true);
    const spendingKey = deriveSpendingKey(result.sharedSecret!, keys.spendKey.privateKey);
    expect(spendingKey).toBeTruthy();
    expect(spendingKey.length).toBe(64); // 32-byte hex
  });
});
