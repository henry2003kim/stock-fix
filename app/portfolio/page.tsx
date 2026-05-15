"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { getTransactions, getSavedProposal } from "@/lib/api";
import { TOP_KOSPI_STOCKS, getStockFactors, DIVIDEND_DATA } from "@/lib/stockData";
import type { Transaction } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  ticker: string;
  name: string;
  name_en: string;
  sector: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedPL: number;
  unrealizedPct: number;
  realizedPL: number;
  weight: number;
  dividendYield: number;
  annualDividend: number;
  payMonths: number[];
}

interface SavedProposalRow {
  proposal: {
    strategy_label: string;
    recommendations: { ticker: string; name: string; allocation_percent: number }[];
  };
  saved_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#3b82f6","#8b5cf6","#22c55e","#f59e0b","#ec4899",
  "#14b8a6","#f97316","#06b6d4","#a855f7","#84cc16",
];

const MONTH_LABELS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const stockMeta: Record<string, { name: string; name_en: string }> = {};
TOP_KOSPI_STOCKS.forEach((s) => { stockMeta[s.ticker] = { name: s.name, name_en: s.name_en }; });

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeHoldings(txns: Transaction[], prices: Record<string, number>): Holding[] {
  const map: Record<string, { buys: { qty: number; price: number }[]; sells: { qty: number; price: number }[] }> = {};

  txns.forEach((t) => {
    if (!map[t.ticker]) map[t.ticker] = { buys: [], sells: [] };
    if (t.action === "BUY")  map[t.ticker].buys.push({ qty: t.quantity, price: t.price });
    else                     map[t.ticker].sells.push({ qty: t.quantity, price: t.price });
  });

  const holdings: Holding[] = [];

  Object.entries(map).forEach(([ticker, { buys, sells }]) => {
    const totalBuyQty   = buys.reduce((s, b) => s + b.qty, 0);
    const totalBuyValue = buys.reduce((s, b) => s + b.qty * b.price, 0);
    const totalSellQty  = sells.reduce((s, b) => s + b.qty, 0);
    const totalSellVal  = sells.reduce((s, b) => s + b.qty * b.price, 0);

    const netShares = totalBuyQty - totalSellQty;
    if (netShares <= 0.001) return;

    const avgCost      = totalBuyQty > 0 ? totalBuyValue / totalBuyQty : 0;
    const currentPrice = prices[ticker] ?? 0;
    const totalCost    = netShares * avgCost;
    const currentValue = netShares * currentPrice;
    const unrealizedPL  = currentValue - totalCost;
    const unrealizedPct = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;
    const realizedPL    = totalSellQty > 0 ? totalSellVal - totalSellQty * avgCost : 0;

    const { sector }   = getStockFactors(ticker);
    const div          = DIVIDEND_DATA[ticker] ?? { yield_pct: 0, pay_months: [] };
    const meta         = stockMeta[ticker] ?? { name: ticker, name_en: ticker };

    holdings.push({
      ticker,
      name: meta.name,
      name_en: meta.name_en,
      sector,
      shares: netShares,
      avgCost,
      currentPrice,
      totalCost,
      currentValue,
      unrealizedPL,
      unrealizedPct,
      realizedPL,
      weight: 0,
      dividendYield: div.yield_pct,
      annualDividend: currentValue * div.yield_pct / 100,
      payMonths: div.pay_months,
    });
  });

  const totalVal = holdings.reduce((s, h) => s + h.currentValue, 0);
  holdings.forEach((h) => { h.weight = totalVal > 0 ? (h.currentValue / totalVal) * 100 : 0; });

  return holdings.sort((a, b) => b.currentValue - a.currentValue);
}

function buildChartData(txns: Transaction[]) {
  const sorted = [...txns].sort((a, b) =>
    new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
  );
  let cum = 0;
  const seen = new Set<string>();
  const points: { date: string; invested: number }[] = [];

  sorted.forEach((t) => {
    const d = t.executed_at.slice(0, 10);
    if (t.action === "BUY")  cum += t.quantity * t.price;
    else                     cum -= t.quantity * t.price;
    if (!seen.has(d)) { seen.add(d); points.push({ date: d, invested: Math.max(cum, 0) }); }
    else { points[points.length - 1].invested = Math.max(cum, 0); }
  });

  return points;
}

function fmt(n: number) { return `₩${Math.abs(n).toLocaleString("ko-KR")}`; }
function pct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }

// ── Component ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { isAuthenticated, loading: authLoading, profile } = useAuth();
  const router = useRouter();

  const [txns, setTxns]             = useState<Transaction[]>([]);
  const [prices, setPrices]         = useState<Record<string, number>>({});
  const [savedRow, setSavedRow]     = useState<SavedProposalRow | null>(null);
  const [loading, setLoading]       = useState(true);
  const [donutView, setDonutView]   = useState<"stock" | "sector">("stock");
  const [chartRange, setChartRange] = useState<"all" | "6m" | "3m" | "1m">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/"); return; }
    load();
  }, [isAuthenticated, authLoading]);

  async function load() {
    setLoading(true);
    try {
      const [txnRes, savedRes] = await Promise.all([getTransactions(), getSavedProposal()]);
      const allTxns = txnRes.data as Transaction[];
      setTxns(allTxns);
      if (savedRes.data) setSavedRow(savedRes.data as unknown as SavedProposalRow);

      const tickers = [...new Set(allTxns.map((t) => t.ticker))];
      if (tickers.length > 0) {
        const res = await fetch(`/api/stocks/prices?tickers=${tickers.join(",")}`);
        setPrices(await res.json());
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const holdings = useMemo(() => computeHoldings(txns, prices), [txns, prices]);

  const kpis = useMemo(() => {
    const totalValue   = holdings.reduce((s, h) => s + h.currentValue, 0);
    const totalCost    = holdings.reduce((s, h) => s + h.totalCost, 0);
    const unrealized   = holdings.reduce((s, h) => s + h.unrealizedPL, 0);
    const realized     = txns
      .filter((t) => t.action === "SELL")
      .reduce((s, t) => {
        const h = holdings.find((h) => h.ticker === t.ticker);
        return s + (h ? (t.price - h.avgCost) * t.quantity : 0);
      }, 0);
    const unrealizedPct = totalCost > 0 ? (unrealized / totalCost) * 100 : 0;
    return { totalValue, totalCost, unrealized, unrealizedPct, realized };
  }, [holdings, txns]);

  const sectorData = useMemo(() => {
    const map: Record<string, { value: number; pl: number; count: number }> = {};
    holdings.forEach((h) => {
      if (!map[h.sector]) map[h.sector] = { value: 0, pl: 0, count: 0 };
      map[h.sector].value += h.currentValue;
      map[h.sector].pl    += h.unrealizedPL;
      map[h.sector].count += 1;
    });
    const totalVal = holdings.reduce((s, h) => s + h.currentValue, 0);
    return Object.entries(map)
      .map(([label, d]) => ({ label, ...d, weight: totalVal > 0 ? (d.value / totalVal) * 100 : 0, plPct: d.value > 0 ? (d.pl / (d.value - d.pl)) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const dividendByMonth = useMemo(() => {
    const map: Record<number, number> = {};
    holdings.forEach((h) => {
      if (h.dividendYield === 0 || h.payMonths.length === 0) return;
      const perMonth = h.annualDividend / h.payMonths.length;
      h.payMonths.forEach((m) => { map[m] = (map[m] ?? 0) + perMonth; });
    });
    return map;
  }, [holdings]);

  const totalAnnualDividend = useMemo(
    () => holdings.reduce((s, h) => s + h.annualDividend, 0),
    [holdings]
  );

  const targetVsActual = useMemo(() => {
    if (!savedRow) return [];
    return savedRow.proposal.recommendations.map((rec) => {
      const actual = holdings.find((h) => h.ticker === rec.ticker);
      const actualPct = actual?.weight ?? 0;
      const diff = actualPct - rec.allocation_percent;
      return { ticker: rec.ticker, name: rec.name, target: rec.allocation_percent, actual: actualPct, diff };
    });
  }, [savedRow, holdings]);

  const rawChartData = useMemo(() => buildChartData(txns), [txns]);
  const chartData = useMemo(() => {
    if (chartRange === "all") return rawChartData;
    const months = chartRange === "1m" ? 1 : chartRange === "3m" ? 3 : 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return rawChartData.filter((d) => new Date(d.date) >= cutoff);
  }, [rawChartData, chartRange]);

  const donutData = useMemo(() => {
    if (donutView === "stock") return holdings.map((h) => ({ name: h.name, value: h.currentValue }));
    return sectorData.map((s) => ({ name: s.label, value: s.value }));
  }, [donutView, holdings, sectorData]);

  if (authLoading || loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
    </div>
  );

  if (!isAuthenticated) return null;

  const plColor = (n: number) => n >= 0 ? "text-green-400" : "text-red-400";
  const plBg    = (n: number) => n >= 0 ? "bg-green-500/8 border-green-500/15" : "bg-red-500/8 border-red-500/15";

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-blue-600/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-purple-600/4 rounded-full blur-3xl" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/8 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} className="text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">Portfolio</h1>
              <p className="text-white/30 text-xs">{profile?.username}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs">Total Value</p>
            <p className="text-white font-bold text-lg">{fmt(kpis.totalValue)}</p>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-10 space-y-8">

        {holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-white/30 text-lg font-medium mb-2">No holdings yet</p>
            <p className="text-white/20 text-sm mb-6">Log your first transaction in the Strategy page to start tracking</p>
            <button onClick={() => router.push("/invest")} className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
              Go to Strategy →
            </button>
          </div>
        ) : (
          <>

            {/* ── KPI Strip ────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Portfolio Value",  value: fmt(kpis.totalValue),   sub: null,                    color: "text-white" },
                { label: "Total Invested",   value: fmt(kpis.totalCost),    sub: null,                    color: "text-white" },
                { label: "Unrealized P&L",  value: `${kpis.unrealized >= 0 ? "+" : ""}${fmt(kpis.unrealized)}`, sub: pct(kpis.unrealizedPct), color: plColor(kpis.unrealized) },
                { label: "Realized P&L",    value: `${kpis.realized >= 0 ? "+" : ""}${fmt(kpis.realized)}`, sub: null,                    color: plColor(kpis.realized) },
              ].map((k) => (
                <div key={k.label} className="bg-white/4 border border-white/8 rounded-2xl p-4">
                  <p className="text-white/40 text-xs mb-2">{k.label}</p>
                  <p className={`font-bold text-lg ${k.color}`}>{k.value}</p>
                  {k.sub && <p className={`text-xs mt-0.5 ${k.color}`}>{k.sub}</p>}
                </div>
              ))}
            </motion.div>

            {/* ── Holdings Table ───────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <h2 className="text-white font-semibold text-lg mb-4">Holdings</h2>
              <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        {["Stock","Shares","Avg Cost","Current","Value","P&L","Return","Div Yield","Annual Div"].map((h) => (
                          <th key={h} className="text-white/30 text-xs font-medium text-left px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h, i) => (
                        <tr key={h.ticker} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i === holdings.length - 1 ? "border-b-0" : ""}`}>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{h.name}</p>
                            <p className="text-white/30 text-xs font-mono">{h.ticker}</p>
                          </td>
                          <td className="px-4 py-3 text-white/70">{h.shares.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-white/70">{fmt(h.avgCost)}</td>
                          <td className="px-4 py-3 text-white">{fmt(h.currentPrice)}</td>
                          <td className="px-4 py-3 text-white font-medium">{fmt(h.currentValue)}</td>
                          <td className={`px-4 py-3 font-medium ${plColor(h.unrealizedPL)}`}>
                            {h.unrealizedPL >= 0 ? "+" : ""}{fmt(h.unrealizedPL)}
                          </td>
                          <td className={`px-4 py-3 font-medium ${plColor(h.unrealizedPct)}`}>{pct(h.unrealizedPct)}</td>
                          <td className="px-4 py-3">
                            {h.dividendYield > 0 ? (
                              <span className="text-blue-400 font-medium">{h.dividendYield.toFixed(1)}%</span>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {h.annualDividend > 0 ? (
                              <span className="text-blue-400 font-medium">{fmt(h.annualDividend)}</span>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* ── Donut | Sector | Target vs Actual ───────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Donut */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium text-sm">Allocation</h3>
                  <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                    {(["stock","sector"] as const).map((v) => (
                      <button key={v} onClick={() => setDonutView(v)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${donutView === v ? "bg-white/10 text-white" : "text-white/40"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {donutData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "8px", color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {donutData.slice(0, 6).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-white/60 text-xs truncate max-w-[100px]">{d.name}</span>
                      </div>
                      <span className="text-white/40 text-xs">{((d.value / kpis.totalValue) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Breakdown */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                <h3 className="text-white font-medium text-sm mb-4">Sector Breakdown</h3>
                <div className="space-y-3">
                  {sectorData.map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-white/70 text-xs font-medium">{s.label}</span>
                          <span className="text-white/30 text-xs ml-1.5">{s.count} stock{s.count > 1 ? "s" : ""}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white/60 text-xs">{s.weight.toFixed(1)}%</span>
                          <span className={`text-xs ml-2 font-medium ${plColor(s.plPct)}`}>{pct(s.plPct)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500/70" style={{ width: `${s.weight}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target vs Actual */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                <h3 className="text-white font-medium text-sm mb-1">Target vs Actual</h3>
                {savedRow && (
                  <p className="text-white/30 text-xs mb-4">vs. {savedRow.proposal.strategy_label}</p>
                )}
                {targetVsActual.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-white/20 text-xs">No saved strategy</p>
                    <button onClick={() => router.push("/invest")} className="text-blue-400 text-xs mt-2 hover:text-blue-300 transition-colors">
                      Generate one →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {targetVsActual.map((r) => {
                      const status = Math.abs(r.diff) <= 5 ? "green" : Math.abs(r.diff) <= 15 ? "amber" : "red";
                      const statusColor = status === "green" ? "text-green-400" : status === "amber" ? "text-amber-400" : "text-red-400";
                      return (
                        <div key={r.ticker}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/70 text-xs font-medium truncate max-w-[100px]">{r.name}</span>
                            <span className={`text-xs font-medium ${statusColor}`}>
                              {r.diff >= 0 ? "+" : ""}{r.diff.toFixed(1)}%
                            </span>
                          </div>
                          <div className="relative h-2 bg-white/5 rounded-full">
                            <div className="absolute h-2 rounded-full bg-white/20" style={{ width: `${Math.min(r.target, 100)}%` }} />
                            <div className={`absolute h-2 rounded-full opacity-80 ${status === "green" ? "bg-green-500" : status === "amber" ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(r.actual, 100)}%` }} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-white/25 text-xs">Target {r.target}%</span>
                            <span className="text-white/25 text-xs">Actual {r.actual.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Dividend Tracker ─────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <h2 className="text-white font-semibold text-lg mb-4">Dividend Tracker</h2>
              <div className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-6">
                {/* Summary */}
                <div className="flex flex-wrap gap-4">
                  <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl px-5 py-3">
                    <p className="text-blue-400/60 text-xs mb-1">Est. Annual Income</p>
                    <p className="text-blue-400 font-bold text-xl">{fmt(totalAnnualDividend)}</p>
                  </div>
                  <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl px-5 py-3">
                    <p className="text-blue-400/60 text-xs mb-1">Est. Monthly Avg</p>
                    <p className="text-blue-400 font-bold text-xl">{fmt(totalAnnualDividend / 12)}</p>
                  </div>
                </div>

                {/* Monthly calendar */}
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Payout Calendar</p>
                  <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const amount = dividendByMonth[month] ?? 0;
                      const hasDiv = amount > 0;
                      return (
                        <div key={month} className={`rounded-xl p-2 text-center border ${hasDiv ? "bg-blue-500/10 border-blue-500/20" : "bg-white/3 border-white/5"}`}>
                          <p className={`text-xs font-medium ${hasDiv ? "text-blue-400" : "text-white/20"}`}>{MONTH_LABELS[month]}</p>
                          {hasDiv && <p className="text-blue-300 text-xs mt-0.5 font-bold">{fmt(amount).replace("₩","")}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-stock table */}
                {holdings.some((h) => h.dividendYield > 0) && (
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-3">By Stock</p>
                    <div className="space-y-2">
                      {holdings.filter((h) => h.dividendYield > 0).map((h) => (
                        <div key={h.ticker} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div>
                            <span className="text-white/70 text-sm font-medium">{h.name}</span>
                            <span className="text-white/30 text-xs ml-2">Pays: {h.payMonths.map((m) => MONTH_LABELS[m]).join(", ")}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-blue-400 text-sm font-medium">{fmt(h.annualDividend)}<span className="text-blue-400/50 text-xs">/yr</span></p>
                            <p className="text-white/30 text-xs">{h.dividendYield.toFixed(1)}% yield</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-white/20 text-xs mt-3">Yields based on most recent declared dividend — subject to change</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Performance Chart ─────────────────────────────────────────── */}
            {chartData.length > 1 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold text-lg">Investment History</h2>
                  <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                    {(["1m","3m","6m","all"] as const).map((r) => (
                      <button key={r} onClick={() => setChartRange(r)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all uppercase ${chartRange === r ? "bg-white/10 text-white" : "text-white/40"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false}
                        tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `₩${(v / 1_000_000).toFixed(0)}M`} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "8px", color: "#fff" }}
                        formatter={(v) => [fmt(Number(v)), "Total Invested"]}
                        labelFormatter={(d) => new Date(d).toLocaleDateString("ko-KR")}
                      />
                      <Area type="monotone" dataKey="invested" stroke="#3b82f6" strokeWidth={2} fill="url(#investGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* ── Recent Transactions ───────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-lg">Recent Transactions</h2>
                <button onClick={() => router.push("/invest")} className="text-white/40 text-xs hover:text-white/70 transition-colors">View all →</button>
              </div>
              <div className="bg-white/4 border border-white/8 rounded-2xl divide-y divide-white/5">
                {[...txns]
                  .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())
                  .slice(0, 10)
                  .map((t) => {
                    const isBuy = t.action === "BUY";
                    return (
                      <div key={t.id} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${isBuy ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                            {t.action}
                          </span>
                          <div>
                            <span className="text-white text-sm font-medium">{stockMeta[t.ticker]?.name ?? t.ticker}</span>
                            {t.note && <span className="text-white/30 text-xs ml-2">{t.note}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white/70 text-sm">{t.quantity.toLocaleString()} × {fmt(t.price)}</p>
                          <p className="text-white/30 text-xs">{new Date(t.executed_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>

          </>
        )}
      </main>
    </div>
  );
}
