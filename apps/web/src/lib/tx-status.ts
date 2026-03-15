const ENDPOINTS = {
  mainnet: ['https://blockstream.info/api', 'https://mempool.space/api'],
  testnet: ['https://blockstream.info/testnet/api', 'https://mempool.space/testnet/api'],
};

function apiEndpoints(): string[] {
  return process.env.BITGO_COIN === 'btc' ? ENDPOINTS.mainnet : ENDPOINTS.testnet;
}

interface TxStatusResponse {
  confirmed: boolean;
  block_height: number | null;
  block_hash: string | null;
  block_time: number | null;
}

export interface TxStatusResult {
  txHash: string;
  confirmed: boolean;
  blockHeight?: number;
}

/**
 * Fetch the status of a single txid from the first responsive API endpoint.
 * Tries Blockstream first, falls back to mempool.space.
 */
async function fetchOneTxStatus(txHash: string): Promise<TxStatusResult> {
  for (const base of apiEndpoints()) {
    try {
      const res = await fetch(`${base}/tx/${txHash}/status`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue; // try next endpoint
      const data = (await res.json()) as TxStatusResponse;
      return {
        txHash,
        confirmed: data.confirmed,
        ...(data.block_height != null ? { blockHeight: data.block_height } : {}),
      };
    } catch {
      // timeout or network error — try next endpoint
    }
  }
  // All endpoints failed — return unconfirmed so we retry next time
  return { txHash, confirmed: false };
}

/**
 * Check confirmation status of multiple transactions.
 * Runs all requests in parallel, each trying Blockstream then mempool.space.
 */
export async function checkTxStatuses(txHashes: string[]): Promise<TxStatusResult[]> {
  if (txHashes.length === 0) return [];
  return Promise.all(txHashes.map(fetchOneTxStatus));
}
