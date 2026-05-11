import { createClient } from "@supabase/supabase-js";

export type UserProfile = {
  id: string;
  username: string;
  investment_budget: number;
  created_at: string;
};

export type PinnedStock = {
  id: number;
  user_id: string;
  ticker: string;
  pinned_at: string;
};

export type Transaction = {
  id: number;
  user_id: string;
  ticker: string;
  quantity: number;
  price: number;
  action: string;
  note: string | null;
  executed_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
