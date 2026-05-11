"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import InvestmentDial from "@/components/InvestmentDial";
import InvestmentProposal from "@/components/InvestmentProposal";
import TransactionForm from "@/components/TransactionForm";
import type { StockData } from "@/components/StockBubble";
import { getTopStocks, getPins, getBudget, updateBudget, getTransactions, getProposal } from "@/lib/api";
import type { Transaction } from "@/lib/supabase";

interface Proposal {
  summary: string;
  recommendations: { ticker: string; name: string; action: "BUY" | "HOLD" | "SELL"; quantity: number; entry_price: number; target_price: number; stop_loss: number; allocation_percent: number; rationale: string; }[];
  hedge_notes: string;
  market_outlook: string;
  total_invested: number;
  cash_reserve: number;
  generated_at: string;
  strategy_level: number;
  strategy_label: string;
  error?: string;
}

export default function InvestPage() {
  const { isAuthenticated, loading: authLoading, profile } = useAuth();
  const router = useRouter();

  const [pinnedStocks, setPinnedStocks] = useState<StockData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState(0);
  const [aggressiveness, setAggressiveness] = useState(3);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"proposal" | "transactions">("proposal");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/"); return; }
    loadData();
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (profile) setBudget(profile.investment_budget);
  }, [profile]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [allStocksRes, pinsRes, budgetRes, txnRes] = await Promise.all([
        getTopStocks(20), getPins(), getBudget(), getTransactions(),
      ]);
      const pinnedTickers: string[] = pinsRes.data;
      setPinnedStocks((allStocksRes.data as StockData[]).filter((s) => pinnedTickers.includes(s.ticker)));
      setBudget(budgetRes.data.budget);
      setTransactions(txnRes.data as Transaction[]);
    } catch { /* ignore */ }
    finally { setDataLoading(false); }
  };

  const handleGenerateProposal = async () => {
    setGenerating(true);
    try {
      const res = await getProposal(budget, pinnedStocks.map((s) => s.ticker), aggressiveness, transactions);
      setProposal(res.data as Proposal);
      setActiveTab("proposal");
    } catch {
      setProposal({ summary: "Failed to generate proposal", recommendations: [], hedge_notes: "", market_outlook: "", total_invested: 0, cash_reserve: 100, generated_at: new Date().toISOString(), strategy_level: aggressiveness, strategy_label: "", error: "true" });
    } finally { setGenerating(false); }
  };

  const handleBudgetUpdate = async (val: number) => {
    setBudget(val);
    try { await updateBudget(val); } catch { /* ignore */ }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} className="text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">Investment Strategy</h1>
              <p className="text-white/30 text-xs">{profile?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-white/30 text-xs">Budget</span>
              <input
                className="bg-transparent text-white text-sm w-28 text-right outline-none"
                value={budget > 0 ? budget.toLocaleString("ko-KR") : ""}
                onChange={(e) => handleBudgetUpdate(parseFloat(e.target.value.replace(/,/g, "")) || 0)}
                placeholder="Set budget"
              />
              <span className="text-white/30 text-xs">₩</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-6 py-10">
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div>
                <h2 className="text-white/60 text-xs uppercase tracking-wider mb-3">Your Watchlist</h2>
                {pinnedStocks.length === 0 ? (
                  <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
                    <p className="text-white/30 text-xs">No pinned stocks — pin from dashboard</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pinnedStocks.map((s) => (
                      <div key={s.ticker} className="flex items-center justify-between bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
                        <div>
                          <p className="text-white text-sm font-medium">{s.name}</p>
                          <p className="text-white/30 text-xs font-mono">{s.ticker}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm">₩{s.price.toLocaleString("ko-KR")}</p>
                          <p className={`text-xs font-medium flex items-center gap-0.5 justify-end ${s.is_up ? "text-green-400" : "text-red-400"}`}>
                            {s.is_up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(s.change_percent).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <InvestmentDial value={aggressiveness} onChange={setAggressiveness} />

              <button
                onClick={handleGenerateProposal}
                disabled={generating || budget <= 0}
                className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-white/10 disabled:text-white/30 text-white font-medium py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {generating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate Proposal</>}
              </button>
              {budget <= 0 && <p className="text-white/30 text-xs text-center -mt-3">Set a budget first</p>}
            </div>

            <div className="lg:col-span-2">
              <div className="flex gap-1 mb-6 bg-white/4 border border-white/8 rounded-xl p-1 w-fit">
                {(["proposal", "transactions"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                    {tab}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "proposal" ? (
                  <motion.div key="proposal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {proposal ? <InvestmentProposal proposal={proposal} /> : (
                      <div className="py-20 text-center">
                        <Sparkles className="w-10 h-10 text-white/10 mx-auto mb-4" />
                        <p className="text-white/30 text-sm">No proposal yet</p>
                        <p className="text-white/20 text-xs mt-1">Set budget, adjust strategy, then click Generate</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <TransactionForm transactions={transactions as Transaction[]} onRefresh={loadData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
