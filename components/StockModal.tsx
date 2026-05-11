"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pin, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getStockHistory, getStock } from "@/lib/api";
import type { StockData } from "./StockBubble";

type Timeframe = "1h" | "1d" | "1w" | "1m" | "3m" | "1y" | "5y";
const TIMEFRAMES: Timeframe[] = ["1h", "1d", "1w", "1m", "3m", "1y", "5y"];
const TF_LABELS: Record<Timeframe, string> = { "1h": "1H", "1d": "1D", "1w": "1W", "1m": "1M", "3m": "3M", "1y": "1Y", "5y": "5Y" };

interface Props {
  stock: StockData | null;
  isPinned: boolean;
  onClose: () => void;
  onTogglePin: (ticker: string) => void;
}

interface ChartPoint { time: string; price: number; }
interface StockDetail extends StockData {
  factors?: string[];
  related?: string[];
  related_names?: string[];
  sector?: string;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number }[] }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white shadow-xl">
        ₩{payload[0].value.toLocaleString("ko-KR")}
      </div>
    );
  }
  return null;
};

export default function StockModal({ stock, isPinned, onClose, onTogglePin }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    if (!stock) return;
    setDetail(stock as StockDetail);

    // Fetch detail with factors
    getStock(stock.ticker).then((res) => setDetail(res.data)).catch(() => {});

    loadHistory("1d");
  }, [stock?.ticker]);

  const loadHistory = async (tf: Timeframe) => {
    if (!stock) return;
    setLoadingChart(true);
    try {
      const res = await getStockHistory(stock.ticker, tf);
      const data: ChartPoint[] = res.data.map((p: { time: string; price: number }) => ({
        time: formatTime(p.time, tf),
        price: p.price,
      }));
      setChartData(data);
    } catch {
      setChartData([]);
    } finally {
      setLoadingChart(false);
    }
  };

  const handleTimeframe = (tf: Timeframe) => {
    setTimeframe(tf);
    loadHistory(tf);
  };

  if (!stock) return null;

  const isUp = (detail?.is_up ?? stock.is_up);
  const color = isUp ? "#34d399" : "#f87171";
  const priceStart = chartData[0]?.price ?? 0;
  const priceEnd = chartData[chartData.length - 1]?.price ?? stock.price;
  const chartIsUp = priceEnd >= priceStart;
  const chartColor = chartIsUp ? "#34d399" : "#f87171";

  return (
    <AnimatePresence>
      {stock && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            layoutId={`stock-${stock.ticker}`}
            className="fixed z-50 inset-0 m-auto w-full max-w-2xl h-fit max-h-[90vh] overflow-y-auto rounded-3xl bg-[#111] border border-white/10 shadow-2xl"
            style={{ top: "5vh", left: 0, right: 0, margin: "auto" }}
          >
            <div className="p-7">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white/40 text-xs font-mono bg-white/5 px-2 py-0.5 rounded-md">{stock.ticker}</span>
                    {detail?.sector && (
                      <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-md">{detail.sector}</span>
                    )}
                  </div>
                  <h2 className="text-white text-2xl font-semibold tracking-tight">{stock.name}</h2>
                  <p className="text-white/40 text-sm">{stock.name_en}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTogglePin(stock.ticker)}
                    className={`p-2.5 rounded-xl border transition-all ${isPinned ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"}`}
                  >
                    <Pin size={16} fill={isPinned ? "currentColor" : "none"} />
                  </button>
                  <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                <p className="text-4xl font-semibold text-white tracking-tight">
                  ₩{stock.price.toLocaleString("ko-KR")}
                </p>
                <div className={`flex items-center gap-2 mt-1 ${isUp ? "text-green-400" : "text-red-400"}`}>
                  {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span className="font-medium">
                    {isUp ? "+" : ""}{stock.change.toLocaleString("ko-KR")} ({isUp ? "+" : ""}{stock.change_percent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Timeframe selector */}
              <div className="flex gap-1 mb-4">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleTimeframe(tf)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${timeframe === tf ? "bg-white/15 text-white" : "text-white/30 hover:text-white/60 hover:bg-white/5"}`}
                  >
                    {TF_LABELS[tf]}
                  </button>
                ))}
              </div>

              {/* Chart */}
              <div className="h-52 w-full mb-6">
                {loadingChart ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`}
                        width={50}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={chartColor}
                        strokeWidth={1.5}
                        fill={`url(#grad-${stock.ticker})`}
                        dot={false}
                        activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center gap-2 text-white/20 text-sm">
                    <AlertCircle size={16} /> No chart data available
                  </div>
                )}
              </div>

              {/* Key Factors */}
              {detail?.factors && detail.factors.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">Key Factors</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.factors.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white/4 rounded-xl px-3 py-2.5 border border-white/6">
                        <span className="text-blue-400/60 mt-0.5 text-xs">●</span>
                        <span className="text-white/70 text-xs leading-snug">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Markets */}
              {detail?.related_names && detail.related_names.length > 0 && (
                <div>
                  <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">Related Markets</h3>
                  <div className="flex flex-wrap gap-2">
                    {detail.related_names.map((name, i) => (
                      <span key={i} className="bg-white/5 border border-white/10 text-white/60 text-xs px-3 py-1.5 rounded-full">
                        {detail.related?.[i] ?? ""} · {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatTime(iso: string, tf: Timeframe): string {
  try {
    const d = new Date(iso);
    if (tf === "1h" || tf === "1d") return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (tf === "1w" || tf === "1m") return `${d.getMonth() + 1}/${d.getDate()}`;
    if (tf === "3m" || tf === "1y") return `${d.getMonth() + 1}/${d.getDate()}`;
    return `${d.getFullYear().toString().slice(2)}/${d.getMonth() + 1}`;
  } catch { return ""; }
}
