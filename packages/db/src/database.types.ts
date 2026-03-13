// Auto-generated types matching the Supabase schema.
// Regenerate with: pnpm db:types
// (or: supabase gen types typescript --local > src/database.types.ts)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      wallets: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          bitgo_wallet_id: string;
          network: string;
          encrypted_view_priv_key: string;
          encrypted_spend_priv_key: string;
          public_view_key: string;
          public_spend_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          bitgo_wallet_id: string;
          network?: string;
          encrypted_view_priv_key: string;
          encrypted_spend_priv_key: string;
          public_view_key: string;
          public_spend_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          bitgo_wallet_id?: string;
          network?: string;
          encrypted_view_priv_key?: string;
          encrypted_spend_priv_key?: string;
          public_view_key?: string;
          public_spend_key?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      transactions: {
        Row: {
          id: string;
          wallet_id: string;
          tx_hash: string;
          direction: 'send' | 'receive';
          amount_sats: number;
          fee_sats: number;
          ephemeral_public_key: string | null;
          one_time_address: string | null;
          status: 'pending' | 'confirmed' | 'failed';
          note: string | null;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          tx_hash: string;
          direction: 'send' | 'receive';
          amount_sats: number;
          fee_sats?: number;
          ephemeral_public_key?: string | null;
          one_time_address?: string | null;
          status?: 'pending' | 'confirmed' | 'failed';
          note?: string | null;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          tx_hash?: string;
          direction?: 'send' | 'receive';
          amount_sats?: number;
          fee_sats?: number;
          ephemeral_public_key?: string | null;
          one_time_address?: string | null;
          status?: 'pending' | 'confirmed' | 'failed';
          note?: string | null;
          created_at?: string;
          confirmed_at?: string | null;
        };
      };

      detected_payments: {
        Row: {
          id: string;
          wallet_id: string;
          tx_hash: string;
          one_time_address: string;
          ephemeral_public_key: string;
          amount_sats: number;
          block_height: number | null;
          spent_tx_hash: string | null;
          spent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          tx_hash: string;
          one_time_address: string;
          ephemeral_public_key: string;
          amount_sats: number;
          block_height?: number | null;
          spent_tx_hash?: string | null;
          spent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          tx_hash?: string;
          one_time_address?: string;
          ephemeral_public_key?: string;
          amount_sats?: number;
          block_height?: number | null;
          spent_tx_hash?: string | null;
          spent_at?: string | null;
          created_at?: string;
        };
      };

      scanner_state: {
        Row: {
          id: string;
          wallet_id: string;
          last_scanned_block: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          last_scanned_block?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          last_scanned_block?: number;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type WalletInsert = Database['public']['Tables']['wallets']['Insert'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type DetectedPayment = Database['public']['Tables']['detected_payments']['Row'];
export type DetectedPaymentInsert = Database['public']['Tables']['detected_payments']['Insert'];
export type ScannerState = Database['public']['Tables']['scanner_state']['Row'];
