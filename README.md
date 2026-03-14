# Stealth Address Payment System

> Privacy-preserving payment system using **stealth addresses** built on top of **BitGo MPC wallets** and **Supabase**.
> Every payment lands at a unique, unlinkable on-chain address — powered by ERC-5564 and secp256k1 elliptic-curve cryptography.

---

## Table of Contents

1. [Overview](#overview)
2. [How Stealth Addresses Work](#how-stealth-addresses-work)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Prerequisites](#prerequisites)
6. [Setup](#setup)
7. [Environment Variables](#environment-variables)
8. [Running the Project](#running-the-project)
9. [API Reference](#api-reference)
10. [Project Structure](#project-structure)
11. [Database Schema](#database-schema)
12. [Cryptographic Details](#cryptographic-details)
13. [Scripts Reference](#scripts-reference)
14. [Contributing](#contributing)
15. [License](#license)

---

## Overview

The Stealth Address Payment System enables **private, unlinkable payments** on the blockchain. Instead of sending funds directly to a receiver's public address, the sender derives a **one-time stealth address** from the receiver's public keys. This ensures:

- **Receiver anonymity** — no one can link multiple payments to the same receiver
- **Unique addresses per payment** — each transaction uses a fresh address
- **Reusable public identity** — the receiver publishes one stealth meta-address, usable forever
- **On-chain verifiability** — payments remain fully verifiable despite being private

The system implements the [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) and [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) standards using the [`@scopelift/stealth-address-sdk`](https://github.com/ScopeLift/stealth-address-sdk).

---

## How Stealth Addresses Work

```
Receiver publishes:  StealthMetaAddress = (A = a·G,  B = b·G)
                     A = public view key,  B = public spend key

Sender derives:
  r  = random()                ← ephemeral private key
  R  = r·G                    ← ephemeral public key (published on-chain)
  S  = H(r·A)                 ← ECDH shared secret
  P  = S·G + B                ← one-time stealth address (unlinkable)

Receiver scans:
  S' = H(a·R)                 ← same shared secret (ECDH symmetry)
  P' = S'·G + B
  if P' == P  →  payment detected!

Receiver spends:
  x  = S + b                  ← private key for one-time address P
```

Two payments to the same receiver produce `P1 ≠ P2` — even with the same stealth meta-address. An observer cannot correlate them.

---

## Architecture

This is a **pnpm monorepo** orchestrated by [Turborepo](https://turbo.build/) with the following structure:

```
stealth-address-payment-system/
├── apps/
│   ├── web/            ← Next.js 14 (frontend + API routes — the full backend)
│   └── scanner/        ← Node.js cron daemon that detects incoming payments
├── packages/
│   ├── stealth-crypto/ ← Pure-TS secp256k1 stealth address primitives
│   ├── bitgo-client/   ← BitGo SDK wrapper for MPC wallets
│   ├── db/             ← Supabase client + TypeScript types
│   └── shared/         ← Shared types, constants, and utilities
├── docs/               ← Architecture docs, API docs, SRS
└── scripts/            ← Port management utilities
```

**No separate Express server** — Next.js App Router API routes (`/api/v1/**`) serve as the entire backend.

### System Context

```
┌──────────────────────────────────────────────────────────────────┐
│                         End Users                                │
│         (Sender Browser)            (Receiver Browser)           │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ HTTPS                        │ HTTPS
        ┌───────▼──────────────────────────────▼───────┐
        │             apps/web  (Next.js 14)           │
        │   Landing · Login · Dashboard · Send ·       │
        │   Receive · Scan                             │
        │   API Routes: /api/v1/* + /api/stealth/*     │
        └───────┬───────────────────────┬──────────────┘
                │                       │
    ┌───────────▼──────┐   ┌────────────▼──────────────┐
    │  packages/db     │   │  packages/bitgo-client    │
    │  (Supabase)      │   │  (BitGo MPC SDK)         │
    └──────────────────┘   └────────────┬──────────────┘
                                        │ BitGo API
                                 ┌──────▼──────┐
                                 │  BitGo Cloud │
                                 └─────────────┘
              ↑
    ┌─────────┴────────────────────────────────────┐
    │         apps/scanner  (cron daemon)           │
    │  Polls ERC5564Announcer for announcements     │
    │  Runs stealth scan, writes detected payments  │
    └──────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer                     | Technology                                                                       |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Frontend**              | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui           |
| **State Management**      | Zustand (client auth), React Query (server state)                                |
| **Backend / API**         | Next.js API Routes (App Router)                                                  |
| **Database**              | Supabase (PostgreSQL + Auth)                                                     |
| **Wallet Infrastructure** | BitGo SDK (MPC wallets, multi-sig)                                               |
| **Stealth Crypto**        | `@scopelift/stealth-address-sdk` (ERC-5564), `@noble/secp256k1`, `@noble/hashes` |
| **Validation**            | Zod                                                                              |
| **Monorepo**              | pnpm workspaces + Turborepo                                                      |
| **Testing**               | Vitest, fast-check (property-based testing)                                      |
| **Code Quality**          | Prettier, Husky, lint-staged                                                     |
| **Animations**            | GSAP                                                                             |

---

## Prerequisites

| Tool    | Version |
| ------- | ------- |
| Node.js | 20 LTS+ |
| pnpm    | 10+     |
| Git     | any     |

Install pnpm globally if needed:

```bash
npm install -g pnpm
```

You will also need:

- A **BitGo** account with an API access token (test environment is fine for development)
- A **Supabase** project with the required tables (see [Database Schema](#database-schema))

---

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd stealth-address-payment-system
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials (see [Environment Variables](#environment-variables) below).

### 3. Start Development

```bash
pnpm dev
```

| Service     | URL                               |
| ----------- | --------------------------------- |
| Web + API   | http://localhost:3000             |
| API routes  | http://localhost:3000/api/v1      |
| Stealth API | http://localhost:3000/api/stealth |
| Scanner     | Runs as a background cron daemon  |

---

## Environment Variables

Create a `.env` file in the project root (use `.env.example` as a template):

### BitGo

| Variable              | Required | Default | Description                          |
| --------------------- | -------- | ------- | ------------------------------------ |
| `BITGO_ENV`           | No       | `test`  | BitGo environment (`test` or `prod`) |
| `BITGO_ACCESS_TOKEN`  | **Yes**  | —       | BitGo long-term access token         |
| `BITGO_ENTERPRISE_ID` | No       | —       | BitGo enterprise ID                  |

### Supabase

| Variable                        | Required | Description                                  |
| ------------------------------- | -------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | **Yes**  | Supabase project URL                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes**  | Supabase anonymous/public key                |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Yes**  | Supabase service role key (server-side only) |
| `SUPABASE_SECRET_KEY`           | **Yes**  | Supabase secret key                          |

### Stealth / Blockchain

| Variable                    | Required | Default                                      | Description                 |
| --------------------------- | -------- | -------------------------------------------- | --------------------------- |
| `RPC_URL`                   | No       | `https://eth.llamarpc.com`                   | Ethereum RPC endpoint       |
| `STEALTH_CHAIN_ID`          | No       | `1` (mainnet)                                | Target chain ID             |
| `ERC5564_ANNOUNCER_ADDRESS` | No       | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` | ERC-5564 Announcer contract |

### App

| Variable                | Required | Default                        | Description                   |
| ----------------------- | -------- | ------------------------------ | ----------------------------- |
| `CORS_ORIGIN`           | No       | `http://localhost:3000`        | Allowed CORS origins          |
| `SCAN_INTERVAL_MS`      | No       | `30000`                        | Scanner polling interval (ms) |
| `SCAN_BLOCK_BATCH_SIZE` | No       | `10`                           | Blocks per scanner cycle      |
| `NEXT_PUBLIC_API_URL`   | No       | `http://localhost:3000/api/v1` | Frontend API base URL         |

---

## Running the Project

### All services (parallel)

```bash
pnpm dev
```

### Individual services

```bash
# Next.js (web + API)
pnpm dev:web

# Scanner daemon
pnpm dev:scanner

# Core services only (web + scanner)
pnpm dev:core
```

### Production build

```bash
pnpm build
pnpm start:web
pnpm start:scanner
```

### Port management

```bash
# Check if development ports are in use
pnpm check-ports

# Kill processes on development ports
pnpm kill-ports
```

---

## API Reference

All versioned routes are under `/api/v1`. Stealth utility routes are under `/api/stealth`.

### Response Format

```json
// Success
{ "data": { ... }, "meta": { "timestamp": "2026-03-13T..." } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

### Auth

| Method | Endpoint                | Body                  | Description                              |
| ------ | ----------------------- | --------------------- | ---------------------------------------- |
| `POST` | `/api/v1/auth/register` | `{ email, password }` | Create user account (Supabase Auth)      |
| `POST` | `/api/v1/auth/login`    | `{ email, password }` | Authenticate and get JWT + refresh token |

### Wallets

| Method | Endpoint                      | Body                    | Description                        |
| ------ | ----------------------------- | ----------------------- | ---------------------------------- |
| `GET`  | `/api/v1/wallets`             | —                       | List all wallets                   |
| `POST` | `/api/v1/wallets`             | `{ label, passphrase }` | Create BitGo wallet + stealth keys |
| `GET`  | `/api/v1/wallets/:id/balance` | —                       | Get wallet balance from BitGo      |
| `POST` | `/api/v1/wallets/mpc`         | —                       | Create MPC wallet via BitGo        |
| `POST` | `/api/v1/wallets/mpc/link`    | —                       | Link an existing MPC wallet        |

### Stealth Crypto

| Method | Endpoint                  | Body                        | Description                                          |
| ------ | ------------------------- | --------------------------- | ---------------------------------------------------- |
| `POST` | `/api/stealth/keygen`     | —                           | Generate ERC-5564 stealth keypair + meta-address URI |
| `POST` | `/api/stealth/id`         | `{ stealthMetaAddressURI }` | Compute deterministic SHA-256 ID from meta-address   |
| `POST` | `/api/stealth/address`    | `{ stealthMetaAddressURI }` | Derive a one-time stealth address (ERC-5564)         |
| `POST` | `/api/v1/stealth/address` | `{ stealthMetaAddressURI }` | Derive stealth address (versioned route)             |

### Transactions

| Method | Endpoint                    | Body                                                                                              | Description                                          |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/v1/transactions/send` | `{ senderWalletId, receiverStealthMetaAddressURI, amountSats, walletPassphrase, senderAddress? }` | Send stealth payment + prepare ERC-5564 announcement |

### Scanning

| Method | Endpoint                 | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| `POST` | `/api/v1/scan`           | On-demand blockchain scan `{ walletId }` |
| `GET`  | `/api/v1/scan?walletId=` | List detected payments                   |

---

## Project Structure

```
apps/
  web/
    src/
      app/
        api/
          stealth/
            keygen/route.ts        # Generate stealth keypair
            id/route.ts            # Deterministic ID from meta-address
            address/route.ts       # Derive one-time stealth address
          v1/
            auth/
              login/route.ts       # User login
              register/route.ts    # User registration
            wallets/
              route.ts             # List / Create wallets
              [id]/balance/
                route.ts           # Wallet balance
              mpc/
                route.ts           # MPC wallet creation
                link/route.ts      # Link existing MPC wallet
            stealth/address/
              route.ts             # Versioned stealth address derivation
            transactions/send/
              route.ts             # Send stealth payment
            scan/
              route.ts             # Scan + list detected payments
        (app)/                     # Authenticated route group
          layout.tsx
          dashboard/page.tsx       # Wallet overview
          receive/page.tsx         # Generate stealth address (QR + copy)
          send/page.tsx            # Send stealth payment
          scan/page.tsx            # Blockchain scan + results
        login/page.tsx             # Auth page
        page.tsx                   # Landing page
        layout.tsx                 # Root layout
      components/
        providers.tsx              # React Query + context providers
        nav-bar.tsx                # Navigation
        ui/                        # shadcn/ui components
      lib/
        prisma.ts                  # Prisma client singleton
        bitgo.ts                   # BitGo coin resolver
        stealthClient.ts           # ERC-5564 stealth client singleton
        api.ts                     # Axios client for frontend
        utils.ts                   # cn() utility
      store/
        auth.ts                    # Zustand auth store

  scanner/
    src/
      index.ts                     # Cron scheduler entry point
      scanner.ts                   # Scan cycle logic

packages/
  stealth-crypto/
    src/
      keygen.ts                    # Key pair generation, ECDH helpers
      address.ts                   # deriveOneTimeAddress(r, {A, B}) → P
      scan.ts                      # scanTransaction(R, a, B) → match?
      spend.ts                     # deriveSpendingKey(S, b) → x

  bitgo-client/
    src/
      client.ts                    # BitGo SDK singleton
      wallet.ts                    # createWallet, getBalance, listWallets
      transaction.ts               # sendStealthTransaction, getWalletTransfers

  db/
    src/
      client.ts                    # Supabase client singleton
      database.types.ts            # Auto-generated Supabase types
      index.ts                     # Package exports

  shared/
    src/
      types.ts                     # Shared TS types (KeyPair, StealthAddress, etc.)
      constants.ts                 # Error codes, network names
      utils.ts                     # Hex encoding, byte conversion utilities
```

---

## Database Schema

The system uses **Supabase** (PostgreSQL) with the following tables:

### `profiles`

| Column       | Type      | Description                  |
| ------------ | --------- | ---------------------------- |
| `id`         | UUID      | User ID (from Supabase Auth) |
| `email`      | string    | User email                   |
| `created_at` | timestamp | Account creation time        |
| `updated_at` | timestamp | Last update time             |

### `wallets`

| Column                     | Type   | Description                  |
| -------------------------- | ------ | ---------------------------- |
| `id`                       | string | Wallet ID                    |
| `user_id`                  | string | Owner user ID                |
| `label`                    | string | User-defined wallet name     |
| `bitgo_wallet_id`          | string | BitGo wallet reference       |
| `wallet_id`                | string | BitGo wallet ID              |
| `coin`                     | string | Coin type (e.g., `tbtc`)     |
| `network`                  | string | Network identifier           |
| `receive_address`          | string | Default receive address      |
| `multisig_type`            | string | Multi-sig type (e.g., `tss`) |
| `wallet_type`              | string | Wallet type                  |
| `public_view_key`          | string | Stealth public view key (A)  |
| `public_spend_key`         | string | Stealth public spend key (B) |
| `encrypted_view_priv_key`  | string | Encrypted private view key   |
| `encrypted_spend_priv_key` | string | Encrypted private spend key  |

### `transactions`

| Column                 | Type      | Description                      |
| ---------------------- | --------- | -------------------------------- |
| `id`                   | string    | Transaction ID                   |
| `wallet_id`            | string    | Associated wallet                |
| `tx_hash`              | string    | Blockchain transaction hash      |
| `direction`            | enum      | `send` or `receive`              |
| `amount_sats`          | number    | Amount in satoshis               |
| `fee_sats`             | number    | Transaction fee                  |
| `ephemeral_public_key` | string    | Ephemeral key R                  |
| `one_time_address`     | string    | Stealth address P                |
| `status`               | enum      | `pending`, `confirmed`, `failed` |
| `note`                 | string    | Optional transaction note        |
| `confirmed_at`         | timestamp | Confirmation time                |

### `detected_payments`

| Column                 | Type      | Description                     |
| ---------------------- | --------- | ------------------------------- |
| `id`                   | string    | Payment ID                      |
| `wallet_id`            | string    | Receiving wallet                |
| `tx_hash`              | string    | Transaction hash                |
| `one_time_address`     | string    | Stealth address                 |
| `ephemeral_public_key` | string    | Ephemeral key R                 |
| `amount_sats`          | number    | Amount in satoshis              |
| `block_height`         | number    | Block number                    |
| `spent_tx_hash`        | string    | Spending transaction (if spent) |
| `spent_at`             | timestamp | When funds were spent           |

### `scanner_state`

| Column               | Type      | Description                 |
| -------------------- | --------- | --------------------------- |
| `id`                 | string    | State ID                    |
| `wallet_id`          | string    | Wallet being scanned        |
| `last_scanned_block` | number    | Last processed block height |
| `updated_at`         | timestamp | Last scan time              |

---

## Cryptographic Details

### Standards

- **ERC-5564**: Stealth Address standard — defines the meta-address format and address derivation scheme
- **ERC-6538**: Stealth Meta-Address Registry — on-chain registry for publishing stealth meta-addresses
- **Curve**: secp256k1 (same as Bitcoin and Ethereum)
- **SDK**: [`@scopelift/stealth-address-sdk`](https://github.com/ScopeLift/stealth-address-sdk) v1.0.0-beta.2

### Key Formats

| Format           | Example               | Description                                         |
| ---------------- | --------------------- | --------------------------------------------------- |
| Meta-Address URI | `st:eth:0x<132-hex>`  | ERC-5564 format: `st:<chain>:0x<spendPub><viewPub>` |
| Public Key       | `0x02...` / `0x03...` | 33-byte compressed secp256k1 point                  |
| Private Key      | `0x<64-hex>`          | 32-byte scalar                                      |
| View Tag         | `0xAB`                | 1-byte hint for fast scanning (ERC-5564 § 3)        |
| Stealth Address  | `0x...`               | Derived Ethereum address                            |

### Announcement Flow (ERC-5564)

When sending a payment:

1. Derive stealth address using `generateStealthAddress({ stealthMetaAddressURI })`
2. Broadcast the transaction via BitGo
3. Prepare an announcement payload via `stealthClient.prepareAnnounce()`
4. The announcement is published to the **ERC5564Announcer** contract (`0x55649E01B5Df198D18D95b5cc5051630cfD45564`)

When scanning for payments:

1. The scanner calls `stealthClient.watchAnnouncementsForUser()` with the wallet's spend public key and view private key
2. Matching announcements are deduplicated by `tx_hash` and persisted to `detected_payments`

### Stealth Crypto Package

The `packages/stealth-crypto` package provides low-level primitives:

| Function                          | Description                          |
| --------------------------------- | ------------------------------------ |
| `generateKeyPair()`               | Random secp256k1 keypair             |
| `generateStealthKeys()`           | Full view + spend key set            |
| `generateEphemeralKeyPair()`      | Ephemeral keypair for sender         |
| `deriveOneTimeAddress(r, {A, B})` | Sender derives one-time address P    |
| `scanTransaction(R, a, B)`        | Receiver checks if payment is theirs |
| `deriveSpendingKey(S, b)`         | Receiver derives private key for P   |
| `hashPoint(point)`                | SHA-256 hash of a curve point        |
| `scalarMult(scalar, point)`       | Scalar multiplication on secp256k1   |
| `pointAdd(A, B)`                  | Point addition on secp256k1          |
| `addScalars(a, b)`                | Scalar addition modulo curve order   |

---

## Scripts Reference

### Root

| Script               | Description                             |
| -------------------- | --------------------------------------- |
| `pnpm dev`           | Start all apps in parallel (watch mode) |
| `pnpm dev:web`       | Start only the Next.js web app          |
| `pnpm dev:scanner`   | Start only the scanner daemon           |
| `pnpm dev:core`      | Start web + scanner only                |
| `pnpm build`         | Build all packages and apps             |
| `pnpm build:web`     | Build only the web app                  |
| `pnpm build:scanner` | Build only the scanner                  |
| `pnpm lint`          | Type-check all packages                 |
| `pnpm test`          | Run all tests (Vitest)                  |
| `pnpm clean`         | Delete all build outputs                |
| `pnpm clean:all`     | Delete build outputs + all node_modules |
| `pnpm format`        | Run Prettier on all files               |
| `pnpm db:types`      | Regenerate Supabase TypeScript types    |
| `pnpm check-ports`   | Check if dev ports are in use           |
| `pnpm kill-ports`    | Kill processes on dev ports             |

### Filter-Scoped

```bash
# Run tests only in stealth-crypto
pnpm --filter @stealth/crypto test

# Build only the web app
pnpm --filter @stealth/web build

# Add a shadcn component to the web app
pnpm --filter @stealth/web dlx shadcn@latest add button card badge
```

---

## Contributing

1. Branch off `main`: `git checkout -b feat/your-feature`
2. Make changes — Husky pre-commit hook runs Prettier automatically
3. Run tests: `pnpm test`
4. Push and open a PR

### Commit Conventions

```
feat:   new feature
fix:    bug fix
chore:  tooling / deps
docs:   documentation only
test:   tests only
```

---

## License

ISC
