import { getBitGoInstance } from '@stealth/bitgo-client';

export type SupportedNetwork = 'tbtc' | 'btc';

export async function getBitGoCoin(network?: string) {
  const bitgo = await getBitGoInstance();
  const coin = (network || process.env.BITGO_COIN || 'tbtc') as SupportedNetwork;
  return bitgo.coin(coin);
}
