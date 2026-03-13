import { getSupabaseAdmin } from '@stealth/db';
import { scanTransaction } from '@stealth/crypto';
import { getWalletTransfers } from '@stealth/bitgo-client';

/**
 * One full scan cycle:
 * - Fetches all wallets
 * - For each wallet, fetches recent BitGo transfers
 * - Runs stealth scan on each transfer output
 * - Writes new DetectedPayment records
 */
export async function runScanCycle(): Promise<void> {
  const startAt = Date.now();
  console.log('[scanner] Starting scan cycle...');

  const supabase = getSupabaseAdmin();
  const { data: wallets } = await supabase.from('wallets').select('*');
  if (!wallets || wallets.length === 0) {
    console.log('[scanner] No wallets found, skipping scan cycle.');
    return;
  }
  let totalScanned = 0;
  let totalDetected = 0;

  for (const wallet of wallets) {
    try {
      const transfers = await getWalletTransfers(wallet.bitgo_wallet_id, 50);
      totalScanned += transfers.length;

      for (const transfer of transfers as Record<string, unknown>[]) {
        // Extract ephemeral key embedded in tx label/comment by the sender
        const label = (transfer['label'] ?? transfer['comment'] ?? '') as string;
        const ephemeralMatch = label.match(/stealth:ephemeral:([0-9a-fA-F]{66})/);
        if (!ephemeralMatch) continue;

        const ephemeralPublicKey = ephemeralMatch[1] as string;
        const txHash = transfer['txid'] as string;
        const outputs = (transfer['outputs'] ?? []) as Array<{ address: string; value: number }>;

        for (const output of outputs) {
          const result = scanTransaction(
            ephemeralPublicKey,
            wallet.encrypted_view_priv_key, // TODO: decrypt with KMS in production
            { publicViewKey: wallet.public_view_key, publicSpendKey: wallet.public_spend_key },
            output.address
          );

          if (result.match) {
            const { data: existing } = await supabase
              .from('detected_payments')
              .select('id')
              .eq('tx_hash', txHash)
              .maybeSingle();
            if (!existing) {
              await supabase.from('detected_payments').insert({
                wallet_id: wallet.id,
                tx_hash: txHash,
                one_time_address: output.address,
                ephemeral_public_key: ephemeralPublicKey,
                amount_sats: output.value,
              });
              totalDetected++;
              console.log(
                `[scanner] ✓ Detected payment: ${txHash.slice(0, 12)}… +${output.value} sats → wallet ${wallet.id}`
              );
            }
          }
        }
      }

      // Update scanner state
      await supabase
        .from('scanner_state')
        .upsert({ wallet_id: wallet.id, last_scanned_block: 0 }, { onConflict: 'wallet_id' });
    } catch (err) {
      console.error(`[scanner] Error scanning wallet ${wallet.id}:`, err);
    }
  }

  const elapsed = Date.now() - startAt;
  console.log(
    `[scanner] Cycle complete — scanned ${totalScanned} txs across ${wallets.length} wallets, detected ${totalDetected} new payments (${elapsed}ms)`
  );
}
