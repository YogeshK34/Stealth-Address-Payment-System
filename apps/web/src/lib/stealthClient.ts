import { createStealthClient } from '@scopelift/stealth-address-sdk';

const chainId = Number(process.env.STEALTH_CHAIN_ID ?? 1);
const rpcUrl = process.env.RPC_URL ?? 'https://eth.llamarpc.com';

/**
 * Shared stealth client initialised with ERC-5564 / ERC-6538 support.
 * Used for prepareAnnounce, watchAnnouncementsForUser, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stealthClient = createStealthClient({ chainId: chainId as any, rpcUrl });
