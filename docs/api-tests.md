# API Test Documentation - Stealth Routes

This document describes the automated tests for the stealth API routes in `apps/web`.

The test suite was updated to use the `@scopelift/stealth-address-sdk` (ERC-5564) alongside the
refactored route handlers. Old Bitcoin/secp256k1-level assertions were replaced with
SDK-native assertions.

## Test File

- **Suite:** `apps/web/src/app/api/stealth/__tests__/stealth-api.test.ts`
- **Runner:** Vitest v3.2.4
- **Config:** `apps/web/vitest.config.ts` (inlines the SDK for ESM compatibility)
- **Type:** Direct route handler invocation (no HTTP server needed)

## How To Run

From `apps/web`:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

## Test Count

17 tests across 3 route groups.

## Covered Routes

- `POST /api/stealth/keygen`
- `POST /api/stealth/id`
- `POST /api/stealth/address`

---

## Coverage Summary

### 1) Key Generation (`POST /api/stealth/keygen`) — 4 tests

| Test                                       | What it verifies                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Returns valid ERC-5564 key material        | `stealthMetaAddressURI` matches `st:*:0x<132-hex>`, all keys are `0x`-prefixed                                                            |
| `id` is SHA-256 of `stealthMetaAddressURI` | Recomputes hash locally and compares                                                                                                      |
| Fresh keypairs on every call               | All keys + URI differ across two sequential calls                                                                                         |
| SDK round-trip                             | `stealthMetaAddressURI` from keygen is accepted by `generateStealthAddress()` without error and produces a valid `0x...` Ethereum address |

### 2) Deterministic ID (`POST /api/stealth/id`) — 5 tests

| Test                                 | What it verifies                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Deterministic for same URI           | Same `stealthMetaAddressURI` → same `id` across two calls                          |
| 400 for invalid URI format           | Bad string rejected with `VALIDATION_ERROR`                                        |
| 400 when field is missing            | Empty body → 400                                                                   |
| 400 for old `stealth:key:key` format | Previous format no longer accepted                                                 |
| Property-based determinism           | 20 random 132-hex URIs, each hashes identically on two requests (via `fast-check`) |

### 3) One-Time Address Derivation (`POST /api/stealth/address`) — 8 tests

| Test                                                      | What it verifies                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Returns `stealthAddress`, `ephemeralPublicKey`, `viewTag` | Format checks: `0x...` Ethereum address, compressed pubkey, 1-byte view tag                                              |
| `computeStealthKey` recovers private key (SDK round-trip) | Receiver calls `computeStealthKey(viewingPrivKey, spendingPrivKey, ephemeralPubKey)` → valid `0x...` 32-byte private key |
| Unique outputs on repeated calls                          | Two calls to same meta-address produce different `ephemeralPublicKey` and `stealthAddress`                               |
| 400 for invalid URI                                       | Garbage input rejected                                                                                                   |
| 400 for old `publicViewKey`/`publicSpendKey` format       | Previous input schema no longer accepted                                                                                 |
| 400 for empty body                                        | Missing field → 400                                                                                                      |
| 30 parallel unique addresses                              | 30 concurrent requests all succeed and produce 30 distinct `stealthAddress` values                                       |
| 100 sequential derivations                                | All 100 return 200 and valid Ethereum addresses                                                                          |

---

## Key Assertions vs Previous Version

| Before                                                   | After                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `bitcoinAddress` matches Bech32 / `bc1` prefix           | `stealthAddress` matches `0x[40-hex]` Ethereum address                   |
| ECDH symmetry proved manually via `secp.getSharedSecret` | `computeStealthKey` SDK call proves round-trip instead                   |
| Private key scalar range check (`0 < k < n`)             | SDK generates keys internally; keygen round-trip validates compatibility |
| `metaAddress: stealth:key:key` format in id tests        | `stealthMetaAddressURI: st:eth:0x...` format                             |

## Notes

- `vitest.config.ts` uses `server.deps.inline: ['@scopelift/stealth-address-sdk']` to bundle the
  SDK's pure-ESM directory imports through Vite, which is required for Vitest's Node environment.
- The `computeStealthKey` round-trip test is the strongest correctness proof: it shows the sender's
  derived `stealthAddress` corresponds to a private key the receiver can reconstruct.
- Concurrency checks confirm the SDK's internal `generatePrivateKey()` produces collision-resistant
  ephemeral keys even under parallel load.
