import { supabase } from "./supabase";

// ── Stock data (Next.js API routes) ────────────────────────────────────────

export const getKospi = () =>
  fetch("/api/stocks/kospi").then((r) => r.json()).then((data) => ({ data }));

export const getTopStocks = (limit = 20) =>
  fetch(`/api/stocks/top?limit=${limit}`).then((r) => r.json()).then((data) => ({ data }));

export const getStock = (ticker: string) =>
  fetch(`/api/stocks/${ticker}`).then((r) => r.json()).then((data) => ({ data }));

export const getStockHistory = (ticker: string, timeframe: string) =>
  fetch(`/api/stocks/${ticker}/history?timeframe=${timeframe}`)
    .then((r) => r.json())
    .then((data) => ({ data }));

// ── Portfolio (Supabase) ────────────────────────────────────────────────────

export const getBudget = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: { budget: 0 } };
  const { data } = await supabase
    .from("user_profiles")
    .select("investment_budget")
    .eq("id", user.id)
    .single();
  return { data: { budget: (data as { investment_budget: number } | null)?.investment_budget ?? 0 } };
};

export const updateBudget = async (budget: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("user_profiles").update({ investment_budget: budget }).eq("id", user.id);
  return { data: { budget } };
};

export const getPins = async () => {
  const { data } = await supabase
    .from("pinned_stocks")
    .select("ticker")
    .order("pinned_at");
  return { data: (data ?? []).map((p: { ticker: string }) => p.ticker) };
};

export const pinStock = async (ticker: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("pinned_stocks").insert({ user_id: user.id, ticker });
  return { data: { ticker } };
};

export const unpinStock = async (ticker: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("pinned_stocks").delete().eq("user_id", user.id).eq("ticker", ticker);
  return { data: { ticker } };
};

export const getTransactions = async () => {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .order("executed_at", { ascending: false });
  return { data: data ?? [] };
};

export const addTransaction = async (
  ticker: string,
  quantity: number,
  price: number,
  action: string,
  note?: string
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("transactions")
    .insert({ user_id: user.id, ticker: ticker.toUpperCase(), quantity, price, action: action.toUpperCase(), note: note ?? null })
    .select()
    .single();
  if (error) throw error;
  return { data };
};

export const deleteTransaction = async (id: number) => {
  await supabase.from("transactions").delete().eq("id", id);
  return { data: { message: "Deleted" } };
};

// ── AI Advisor (Next.js API route) ─────────────────────────────────────────

export const getProposal = async (
  budget: number,
  pinned_tickers: string[],
  aggressiveness: number,
  transactions?: unknown[]
) => {
  const res = await fetch("/api/advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budget, pinned_tickers, aggressiveness, transactions }),
  });
  const data = await res.json();
  return { data };
};
