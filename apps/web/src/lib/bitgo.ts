import { getBitGoInstance } from '@stealth/bitgo-client';

export type SupportedNetwork = 'tbtc' | 'btc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBitGoCoin(network?: string): Promise<any> {
  const bitgo = await getBitGoInstance();
  const coin = (network || process.env.BITGO_COIN || 'tbtc') as SupportedNetwork;
  return bitgo.coin(coin);
}
