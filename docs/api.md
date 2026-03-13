# API Documentation - Stealth Address Payment System

This document describes the API routes implemented in the Next.js App Router under `apps/web`.

The stealth crypto layer was migrated from custom secp256k1 math to the official
[`@scopelift/stealth-address-sdk`](https://github.com/ScopeLift/stealth-address-sdk)
(v1.0.0-beta.2), which implements [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) and
[ERC-6538](https://eips.ethereum.org/EIPS/eip-6538).

## Base Paths

- Versioned routes: `/api/v1/*`
- Stealth utility routes: `/api/stealth/keygen`, `/api/stealth/id`, `/api/stealth/address`

## Test Coverage

Automated stealth API tests are documented in [docs/api-tests.md](api-tests.md).

## Key Changes vs Previous Revision

| Before                                    | After                                                       |
| ----------------------------------------- | ----------------------------------------------------------- |
| Custom secp256k1 ECDH math                | `generateStealthAddress()` from SDK                         |
| `stealth:<viewPub>:<spendPub>` URI format | ERC-5564 `st:<chain>:0x<132-hex>` URI format                |
| Bitcoin SegWit address output             | Ethereum address output (`0x...`)                           |
| No announcement support                   | `prepareAnnounce()` payload included in send response       |
| BitGo transfer scanning                   | `watchAnnouncementsForUser()` via ERC5564Announcer contract |

## Response Conventions

### Success

```json
{
  "data": {},
  "meta": { "timestamp": "2026-03-13T10:00:00.000Z" }
}
```

Some endpoints return only `data` without `meta`.

### Error

```json
{
  "error": { "code": "ERROR_CODE", "message": "Human readable message" }
}
```

## Authentication

All `/api/v1` routes except auth routes require bearer token auth:

```http
Authorization: Bearer <jwt_token>
```

---

## 1) Generate Stealth Keys

- **Method:** POST
- **Route:** /api/stealth/keygen
- **Auth:** No
- **SDK call:** `generateRandomStealthMetaAddress()`
- **Purpose:** Generate an ERC-5564 compatible stealth keypair and return the meta-address URI with a deterministic SHA-256 id.

### Input

No request body required.

### Output (200)

```json
{
  "data": {
    "id": "sha256(stealthMetaAddressURI)-hex-64",
    "stealthMetaAddressURI": "st:eth:0x<132-hex-meta-address>",
    "scanPublicKey": "0x02...",
    "scanPrivateKey": "0x<64-hex>",
    "spendPublicKey": "0x03...",
    "spendPrivateKey": "0x<64-hex>"
  }
}
```

### Field Notes

- `stealthMetaAddressURI` follows the ERC-5564 format: `st:<chain>:0x<spendPub><viewPub>` (132 hex chars = two 33-byte compressed public keys concatenated).
- `id = SHA-256(stealthMetaAddressURI)` — deterministic, same keypair always produces the same id.
- Key names use `scan` (viewing) and `spend` to align with ERC-5564 terminology.

### Errors

- 500 KEYGEN_FAILED

---

## 2) Register

- Method: POST
- Route: /api/v1/auth/register
- Auth: No
- Purpose: Create a user account with Supabase auth.

### Input

```json
{
  "email": "user@example.com",
  "password": "min-8-chars"
}
```

### Output (201)

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "session": {},
    "message": "Check your email to confirm your account."
  }
}
```

### Errors

- 400 VALIDATION_ERROR
- 400 INVALID_CREDENTIALS
- 500 INTERNAL_ERROR

---

## 1.1) Deterministic ID From Meta Address URI

- **Method:** POST
- **Route:** /api/stealth/id
- **Auth:** No
- **Purpose:** Compute a deterministic SHA-256 id from an ERC-5564 stealth meta-address URI.

### Input

```json
{
  "stealthMetaAddressURI": "st:eth:0x<132-hex>"
}
```

Validation rule: must match `^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$`.

### Output (200)

```json
{
  "data": {
    "id": "sha256(stealthMetaAddressURI)-hex-64",
    "stealthMetaAddressURI": "st:eth:0x<132-hex>"
  }
}
```

### Errors

- 400 VALIDATION_ERROR
- 500 INTERNAL_ERROR

---

## 1.2) Derive One-Time Stealth Address (ERC-5564)

- **Method:** POST
- **Route:** /api/stealth/address
- **Auth:** No
- **SDK call:** `generateStealthAddress({ stealthMetaAddressURI })`
- **Purpose:** Derive a one-time ERC-5564 stealth Ethereum address from a receiver meta-address URI.

### Input

```json
{
  "stealthMetaAddressURI": "st:eth:0x<132-hex>"
}
```

### Crypto Flow (handled by SDK, scheme 1)

1. Parse `spendingPublicKey` and `viewingPublicKey` from meta-address.
2. Generate ephemeral private key `r`; derive `R = r*G`.
3. Compute shared secret: `s = H(r * viewingPublicKey)`.
4. Derive stealth address: `stealthAddress = publicKeyToAddress(s*G + spendingPublicKey)`.
5. Extract `viewTag = s[0]` (first byte of hashed shared secret).

### Output (200)

```json
{
  "data": {
    "stealthAddress": "0x...",
    "ephemeralPublicKey": "0x02...",
    "viewTag": "0xAB"
  }
}
```

- `stealthAddress` is an Ethereum address.
- `ephemeralPublicKey` must be published on-chain so the receiver can scan.
- `viewTag` is a 1-byte hint for fast scanning (ERC-5564 § 3).

### Errors

- 400 VALIDATION_ERROR
- 500 DERIVE_STEALTH_ADDRESS_FAILED

---

## 3) Login

- Method: POST
- Route: /api/v1/auth/login
- Auth: No
- Purpose: Authenticate and return access tokens.

### Input

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

### Output (200)

```json
{
  "data": {
    "token": "jwt",
    "refreshToken": "refresh-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "expiresAt": 1710000000
  },
  "meta": {
    "timestamp": "2026-03-13T10:00:00.000Z"
  }
}
```

### Errors

- 400 VALIDATION_ERROR
- 401 INVALID_CREDENTIALS
- 500 INTERNAL_ERROR

---

## 4) Wallets - List

- Method: GET
- Route: /api/v1/wallets
- Auth: Yes
- Purpose: List all wallets for current user.

### Input

- No request body.

### Output (200)

```json
{
  "data": [
    {
      "id": "cuid",
      "label": "Main Wallet",
      "bitgo_wallet_id": "bitgo-id",
      "network": "tbtc",
      "public_view_key": "02...",
      "public_spend_key": "03...",
      "created_at": "2026-03-13T10:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-03-13T10:00:00.000Z"
  }
}
```

### Errors

- 500 INTERNAL_ERROR

---

## 5) Wallets - Create

- Method: POST
- Route: /api/v1/wallets
- Auth: Yes
- Purpose: Create BitGo wallet and generate stealth keys.

### Input

```json
{
  "label": "My Wallet",
  "passphrase": "minimum-8-chars"
}
```

### Output (201)

```json
{
  "data": {
    "id": "cuid",
    "label": "My Wallet",
    "bitgoWalletId": "bitgo-id",
    "stealthAddress": {
      "publicViewKey": "02...",
      "publicSpendKey": "03..."
    }
  }
}
```

### Errors

- 400 VALIDATION_ERROR
- 500 WALLET_CREATION_FAILED

---

## 6) Wallet Balance

- Method: GET
- Route: /api/v1/wallets/:id/balance
- Auth: Yes
- Purpose: Fetch wallet balance from BitGo for a user-owned wallet.

### Input

- Path parameter:
  - id: wallet id (cuid)

### Output (200)

```json
{
  "data": {
    "balanceString": "...",
    "confirmedBalanceString": "...",
    "spendableBalanceString": "..."
  },
  "meta": {
    "timestamp": "2026-03-13T10:00:00.000Z"
  }
}
```

### Errors

- 404 WALLET_NOT_FOUND
- 502 BITGO_ERROR

---

## 7) Derive One-Time Address

- Method: POST
- Route: /api/v1/stealth/address
- Auth: Yes
- Purpose: Derive one-time destination address from receiver stealth public keys.

### Input

```json
{
  "publicViewKey": "02...",
  "publicSpendKey": "03..."
}
```

### Output (200)

```json
{
  "data": {
    "oneTimeAddress": "btc-address",
    "ephemeralPublicKey": "02..."
  },
  "meta": {
    "timestamp": "2026-03-13T10:00:00.000Z"
  }
}
```

### Errors

- 400 INVALID_STEALTH_ADDRESS

---

## 8) Send Transaction

- **Method:** POST
- **Route:** /api/v1/transactions/send
- **Auth:** Yes
- **SDK calls:** `generateStealthAddress()`, `stealthClient.prepareAnnounce()`
- **Purpose:** Derive an ERC-5564 stealth address, broadcast via BitGo, and prepare the ERC-5564 announcement payload.

### Input

```json
{
  "senderWalletId": "cuid",
  "receiverStealthMetaAddressURI": "st:eth:0x<132-hex>",
  "amountSats": 1000,
  "walletPassphrase": "wallet-passphrase",
  "senderAddress": "0x..."
}
```

- `receiverStealthMetaAddressURI` replaces the old `receiverPublicViewKey` / `receiverPublicSpendKey` fields.
- `senderAddress` is optional. When provided, the response includes an `announcePayload` ready to be submitted to the ERC5564Announcer contract.

### Output (201)

```json
{
  "data": {
    "txHash": "tx-hash",
    "stealthAddress": "0x...",
    "ephemeralPublicKey": "0x02...",
    "viewTag": "0xAB",
    "amountSats": 1000,
    "status": "pending",
    "announcePayload": {}
  }
}
```

- `announcePayload` is absent when `senderAddress` is not provided.
- `stealthAddress` is an Ethereum address (was `oneTimeAddress` / Bitcoin address in prior version).

### Errors

- 400 VALIDATION_ERROR
- 404 WALLET_NOT_FOUND
- 500 TX_BUILD_FAILED

---

## 9) Scan Blockchain On Demand

- **Method:** POST
- **Route:** /api/v1/scan
- **Auth:** Yes
- **SDK call:** `stealthClient.watchAnnouncementsForUser()`
- **Purpose:** Poll the ERC5564Announcer contract for on-chain announcements that match the user's stealth keypair and persist any new detected payments.

### How it works

1. Fetches the wallet's `spendingPublicKey` and `viewingPrivateKey` from the database.
2. Calls `watchAnnouncementsForUser()` with a single-shot poll (replaces the previous BitGo transfer scan + manual ECDH check).
3. For each matching log, deduplicates by `tx_hash` and inserts into `detected_payments`.

### Input

```json
{
  "walletId": "cuid"
}
```

### Output (200)

```json
{
  "data": {
    "walletId": "cuid",
    "detectedPayments": []
  },
  "meta": {
    "timestamp": "2026-03-13T10:00:00.000Z"
  }
}
```

> Note: `scannedTxCount` is no longer returned (BitGo polling removed).

### Errors

- 400 VALIDATION_ERROR
- 404 WALLET_NOT_FOUND
- 500 SCAN_FAILED

---

## 10) List Detected Payments

- Method: GET
- Route: /api/v1/scan
- Auth: Yes
- Purpose: List detected payments for user wallets.

### Input

- Optional query param:
  - walletId: wallet id to filter results

Example:

```http
GET /api/v1/scan?walletId=ckxxxxxxxxxxxxxxxxxxxx
```

### Output (200)

```json
{
  "data": [
    {
      "id": "...",
      "wallet_id": "...",
      "tx_hash": "...",
      "one_time_address": "...",
      "ephemeral_public_key": "...",
      "amount_sats": 12345,
      "created_at": "2026-03-13T10:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-03-13T10:00:00.000Z"
  }
}
```

### Errors

- Standard auth errors if token missing/invalid

---

---

## Notes

### SDK & Standards

- All stealth crypto uses `@scopelift/stealth-address-sdk` v1.0.0-beta.2.
- Stealth addresses are Ethereum addresses (ERC-5564 scheme 1).
- ERC5564Announcer contract address defaults to `0x55649E01B5Df198D18D95b5cc5051630cfD45564`; override with `ERC5564_ANNOUNCER_ADDRESS` env var.
- Chain defaults to mainnet (chainId 1); override with `STEALTH_CHAIN_ID` env var.
- RPC URL defaults to `https://eth.llamarpc.com`; set via `RPC_URL` env var.

### Key Formats

- After SDK migration, all public/private keys are `0x`-prefixed hex strings.
- `stealthMetaAddressURI` format: `st:<chain>:0x<66-hex-spendPub><66-hex-viewPub>` = 132-hex body.
- `viewTag` is a 1-byte hex value (`0x00`–`0xff`) for fast announcement scanning.

### Shared Client

`apps/web/src/lib/stealthClient.ts` exports a singleton `stealthClient` used by the send and scan routes for on-chain operations (prepareAnnounce, watchAnnouncementsForUser).
