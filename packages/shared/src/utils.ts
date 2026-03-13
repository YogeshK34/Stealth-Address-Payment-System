import { SATOSHIS_PER_BTC } from './constants';

// ─── Bitcoin utilities ────────────────────────────────────────────────────────

export function satsTobtc(sats: number): number {
  return sats / SATOSHIS_PER_BTC;
}

export function btcToSats(btc: number): number {
  return Math.round(btc * SATOSHIS_PER_BTC);
}

export function formatBtc(sats: number, decimals = 8): string {
  return satsTobtc(sats).toFixed(decimals);
}

// ─── Hex utilities ────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── String utilities ─────────────────────────────────────────────────────────

export function truncateMiddle(str: string, maxLen = 16): string {
  if (str.length <= maxLen) return str;
  const half = Math.floor(maxLen / 2);
  return `${str.slice(0, half)}…${str.slice(-half)}`;
}

// ─── Date utilities ───────────────────────────────────────────────────────────

export function isoNow(): string {
  return new Date().toISOString();
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isHex32(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

export function isHex33(value: string): boolean {
  return /^(02|03)[0-9a-fA-F]{64}$/.test(value);
}
