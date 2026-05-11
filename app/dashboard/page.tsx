"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import KospiBar from "@/components/KospiBar";
import StockBubble from "@/components/StockBubble";
import StockModal from "@/components/StockModal";
import PinnedStocks from "@/components/PinnedStocks";
import type { StockData } from "@/components/StockBubble";
import { getTopStocks, getPins, pinStock, unpinStock, updateBudget, getBudget } from "@/lib/api";

export default function Dashboard() {
  const { isAuthenticated, loading: authLoading, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [stocks, setStocks] = useState<StockData[]>([]);
  const [pinnedTickers, setPinnedTickers] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [budget, setBudget] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/"); return; }
    setBudget(profile?.investment_budget ?? 0);
    loadData();
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (profile) setBudget(profile.investment_budget);
  }, [profile]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [stocksRes, pinsRes, budgetRes] = await Promise.all([
        getTopStocks(20),
        getPins(),
        getBudget(),
      ]);
      setStocks(stocksRes.data);
      setPinnedTickers(pinsRes.data);
      setBudget(budgetRes.data.budget);
    } catch { /* ignore */ }
    finally { setDataLoading(false); }
  };

  const handleTogglePin = useCallback(async (ticker: string) => {
    const isPinned = pinnedTickers.includes(ticker);
    try {
      if (isPinned) {
        await unpinStock(ticker);
        setPinnedTickers((prev) => prev.filter((t) => t !== ticker));
      } else {
        await pinStock(ticker);
        setPinnedTickers((prev) => [...prev, ticker]);
      }
    } catch { /* ignore */ }
  }, [pinnedTickers]);

  const handleBudgetSave = async () => {
    try {
      await updateBudget(budget);
      await refreshProfile();
    } catch { /* ignore */ }
  };

  const pinnedStocks = stocks.filter((s) => pinnedTickers.includes(s.ticker));

  if (authLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <KospiBar budget={budget} onBudgetChange={setBudget} onBudgetSave={handleBudgetSave} />

      <main className="relative max-w-7xl mx-auto px-6 py-10">
        <section className="mb-14">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-white text-2xl font-semibold tracking-tight">Today&apos;s Movers</h2>
            <span className="text-white/30 text-sm">KOSPI top performers</span>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {stocks.map((stock, i) => (
                <StockBubble
                  key={stock.ticker}
                  stock={stock}
                  isPinned={pinnedTickers.includes(stock.ticker)}
                  onSelect={setSelectedStock}
                  onTogglePin={handleTogglePin}
                  index={i}
                />
              ))}
            </motion.div>
          )}
        </section>

        <section>
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="text-white text-2xl font-semibold tracking-tight">Watchlist</h2>
            {pinnedStocks.length > 0 && <span className="text-white/30 text-sm">{pinnedStocks.length} stocks</span>}
          </div>
          <PinnedStocks pinnedStocks={pinnedStocks} onSelect={setSelectedStock} onUnpin={handleTogglePin} />
        </section>
      </main>

      <StockModal
        stock={selectedStock}
        isPinned={selectedStock ? pinnedTickers.includes(selectedStock.ticker) : false}
        onClose={() => setSelectedStock(null)}
        onTogglePin={handleTogglePin}
      />
    </div>
  );
}
