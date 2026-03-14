# Stealth Payments API & Frontend Integration

This document covers the privacy-preserving payments feature added on top of the existing wallet and stealth infrastructure.

---

## Summary of Changes

### New API Routes

Three new endpoints under `/api/v1/payments/`:

| Method | Endpoint                   | Purpose                                                   |
| ------ | -------------------------- | --------------------------------------------------------- |
| `POST` | `/api/v1/payments/prepare` | Derive a one-time stealth address without sending funds   |
| `POST` | `/api/v1/payments/send`    | Send funds to a previously prepared stealth address       |
| `GET`  | `/api/v1/payments/history` | List outgoing stealth payments for the authenticated user |

### Frontend Changes

| Page         | Change                                                    |
| ------------ | --------------------------------------------------------- |
| `/send`      | Full rewrite — two-step flow: prepare → confirm → send    |
| `/dashboard` | Added "Recent stealth payments" section with live history |

### Infrastructure Changes

| Area                    | Change                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `next.config.mjs`       | Removed `@stealth/bitgo-client` from `transpilePackages`; added `bitgo` to `serverComponentsExternalPackages` |
| `packages/bitgo-client` | `getBitGoInstance()` now uses lazy `await import('bitgo')` instead of top-level import                        |
| All BitGo callers       | Updated to `await` the now-async `getBitGoInstance()` / `getBitGoCoin()`                                      |
| Payment routes          | Use `getSupabaseAdmin()` from `@stealth/db` (not Prisma) to match working routes                              |

---

## Privacy Flow

```
Sender                          Backend                         Blockchain
  │                               │                               │
  │  1. Enter meta-address        │                               │
  │  POST /payments/prepare       │                               │
  │ ─────────────────────────────>│                               │
  │                               │  Validate meta-address        │
  │                               │  Derive stealth address (SDK) │
  │                               │  Generate ephemeral key       │
  │                               │  Compute viewTag              │
  │  stealthAddress, ephPubKey,   │                               │
  │  viewTag                      │                               │
  │ <─────────────────────────────│                               │
  │                               │                               │
  │  2. Review & confirm          │                               │
  │  POST /payments/send          │                               │
  │ ─────────────────────────────>│                               │
  │                               │  Send via BitGo ──────────────>│
  │                               │  Store tx in Supabase         │
  │  txHash, status               │                               │
  │ <─────────────────────────────│                               │
  │                               │                               │
  │                               │                               │

Receiver                        Scanner
  │                               │
  │                               │  watchAnnouncementsForUser()
  │                               │  Match viewTag + keys
  │  Payment detected             │
  │ <─────────────────────────────│
```

The sender **never sees** the receiver's real wallet address. A one-time stealth address is derived server-side using ERC-5564, making every transaction unlinkable.

---

## API 1 — Prepare Payment

**Route:** `POST /api/v1/payments/prepare`

**Auth:** Bearer token (Supabase)

**Purpose:** Derive a stealth address and ephemeral key without sending funds. The frontend uses this to show the user what will happen before they commit.

### Request

```json
{
  "senderWalletId": "wallet-uuid-or-id",
  "receiverStealthMetaAddressURI": "st:eth:0x<132-hex>",
  "amountSats": 100000
}
```

### Validation

| Field                           | Rule                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `senderWalletId`                | Non-empty string, must exist in DB and belong to caller |
| `receiverStealthMetaAddressURI` | Must match `^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$`       |
| `amountSats`                    | Positive integer                                        |

### Response (200)

```json
{
  "data": {
    "stealthAddress": "0x...",
    "ephemeralPublicKey": "0x02...",
    "viewTag": "0xAB",
    "amountSats": 100000
  },
  "meta": { "timestamp": "..." }
}
```

### Errors

| Status | Code                     | Cause                      |
| ------ | ------------------------ | -------------------------- |
| 400    | `VALIDATION_ERROR`       | Bad input                  |
| 403    | `UNAUTHORIZED`           | Wallet not owned by caller |
| 404    | `WALLET_NOT_FOUND`       | Wallet ID doesn't exist    |
| 500    | `PREPARE_PAYMENT_FAILED` | SDK derivation failed      |

---

## API 2 — Send Payment

**Route:** `POST /api/v1/payments/send`

**Auth:** Bearer token (Supabase)

**Purpose:** Broadcast the transaction via BitGo and store the record.

### Request

```json
{
  "senderWalletId": "wallet-uuid-or-id",
  "stealthAddress": "0x...",
  "ephemeralPublicKey": "0x02...",
  "viewTag": "0xAB",
  "amountSats": 100000,
  "walletPassphrase": "your-passphrase"
}
```

### Validation

| Field                | Rule                              |
| -------------------- | --------------------------------- |
| `stealthAddress`     | Must match `^0x[0-9a-fA-F]{40}$`  |
| `ephemeralPublicKey` | Must match `^0x[0-9a-fA-F]+$`     |
| `viewTag`            | Must match `^0x[0-9a-fA-F]{1,4}$` |
| `walletPassphrase`   | Non-empty string                  |

### Steps

1. Validate input with Zod
2. Verify wallet ownership via Supabase
3. Send via `BitGo wallet.sendMany()` to the stealth address
4. Store transaction in `transactions` table (`direction = 'send'`, `status = 'pending'`)
5. Return tx hash

### Response (201)

```json
{
  "data": {
    "txHash": "abc123...",
    "stealthAddress": "0x...",
    "ephemeralPublicKey": "0x02...",
    "viewTag": "0xAB",
    "amountSats": 100000,
    "status": "pending"
  },
  "meta": { "timestamp": "..." }
}
```

### Errors

| Status | Code               | Cause                      |
| ------ | ------------------ | -------------------------- |
| 400    | `VALIDATION_ERROR` | Bad input                  |
| 403    | `UNAUTHORIZED`     | Wallet not owned by caller |
| 404    | `WALLET_NOT_FOUND` | Wallet ID doesn't exist    |
| 500    | `TX_BUILD_FAILED`  | BitGo send failed          |

---

## API 3 — Payment History

**Route:** `GET /api/v1/payments/history`

**Auth:** Bearer token (Supabase)

**Purpose:** List all outgoing stealth payments for the authenticated user.

### Query Parameters

| Param      | Required | Description                 |
| ---------- | -------- | --------------------------- |
| `walletId` | No       | Filter to a specific wallet |

### Response (200)

```json
{
  "data": [
    {
      "id": "...",
      "walletId": "...",
      "stealthAddress": "0x...",
      "ephemeralPublicKey": "0x02...",
      "amountSats": 100000,
      "txHash": "abc123...",
      "status": "pending",
      "createdAt": "2026-03-14T..."
    }
  ],
  "meta": { "timestamp": "..." }
}
```

### Errors

| Status | Code               | Cause                      |
| ------ | ------------------ | -------------------------- |
| 400    | `VALIDATION_ERROR` | Bad walletId format        |
| 403    | `UNAUTHORIZED`     | Wallet not owned by caller |
| 500    | `INTERNAL_ERROR`   | DB query failed            |

---

## Frontend — Send Page (`/send`)

The send page was rewritten with a multi-step flow:

### Step 1: Form

- Wallet selector (auto-populated from `GET /wallets/mpc`)
- Receiver stealth meta-address input (ERC-5564 `st:eth:0x...`)
- Amount in satoshis
- Wallet passphrase
- Right panel shows a "How it works" explainer

Submitting calls `POST /payments/prepare`.

### Step 2: Confirm

Displays the derived stealth data:

- One-time stealth address (highlighted)
- Ephemeral public key (R)
- View tag
- Amount
- Privacy notice

User can go back or click "Confirm & send".

### Step 3: Sending

Loading spinner while BitGo broadcasts.

### Step 4: Success

- Green checkmark
- Transaction hash
- Stealth address
- Status badge
- "Send another payment" button

### Step 4 (alt): Error

- Error message
- "Start over" and "Retry send" buttons

---

## Frontend — Dashboard Payment History

A new "Recent stealth payments" section was added to the bottom of the dashboard:

- Fetches from `GET /payments/history` on page load (parallel with wallet fetch)
- Each payment card shows:
  - Truncated tx hash
  - Color-coded status badge (green = confirmed, amber = pending, red = failed)
  - Amount in sats
  - Date
  - Truncated stealth address
- Manual "Refresh" button
- Empty state message when no payments exist

---

## Compilation Performance Fix

### Problem

The dashboard and other pages took 10+ seconds to compile because the `bitgo` npm package (~50MB) was being traced by webpack during module graph resolution.

### Root Cause

1. `@stealth/bitgo-client` was listed in `transpilePackages`, forcing webpack to parse into the bitgo dependency tree
2. `import * as bitgoLib from 'bitgo'` was a top-level import, loaded during module resolution even if unused
3. Native module fallbacks (`secp256k1`, `bigint-buffer`) added startup latency

### Fix

1. **Removed `@stealth/bitgo-client` from `transpilePackages`** in `next.config.mjs`
2. **Added `bitgo` to `serverComponentsExternalPackages`** — prevents webpack from tracing into it during dev
3. **Lazy import** in `packages/bitgo-client/src/client.ts`: replaced `import * as bitgoLib from 'bitgo'` with `const bitgoLib = await import('bitgo')` inside `getBitGoInstance()`
4. **Updated all callers** to `await` the now-async function (12 call sites across `wallet.ts`, `transaction.ts`, `bitgo.ts`, `bitgo-mpc.ts`, and API routes)

### Files Changed

| File                                                    | Change                               |
| ------------------------------------------------------- | ------------------------------------ |
| `apps/web/next.config.mjs`                              | transpilePackages / externals config |
| `packages/bitgo-client/src/client.ts`                   | Lazy dynamic import                  |
| `packages/bitgo-client/src/wallet.ts`                   | Async callers                        |
| `packages/bitgo-client/src/transaction.ts`              | Async callers                        |
| `apps/web/src/lib/bitgo.ts`                             | `getBitGoCoin()` now async           |
| `apps/web/src/lib/bitgo-mpc.ts`                         | 3 call sites updated                 |
| `apps/web/src/app/api/v1/wallets/[id]/balance/route.ts` | 1 call site updated                  |
