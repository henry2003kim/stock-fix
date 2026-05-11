"use client";
import { motion } from "framer-motion";
import { Pin } from "lucide-react";

export interface StockData {
  ticker: string;
  name: string;
  name_en: string;
  price: number;
  change: number;
  change_percent: number;
  is_up: boolean;
  volume?: number;
}

interface Props {
  stock: StockData;
  isPinned: boolean;
  onSelect: (stock: StockData) => void;
  onTogglePin: (ticker: string) => void;
  index: number;
}

export default function StockBubble({ stock, isPinned, onSelect, onTogglePin, index }: Props) {
  const isUp = stock.is_up;
  const pct = Math.abs(stock.change_percent).toFixed(2);
  const priceFormatted = stock.price.toLocaleString("ko-KR");

  return (
    <motion.div
      layoutId={`stock-${stock.ticker}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(stock)}
      className="relative group cursor-pointer rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 hover:bg-white/8 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/40"
      style={{ willChange: "transform" }}
    >
      {/* Pin button */}
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin(stock.ticker); }}
        className={`absolute top-3 right-3 p-1.5 rounded-lg transition-all ${isPinned ? "text-yellow-400 bg-yellow-400/10" : "text-white/20 hover:text-white/60 bg-transparent hover:bg-white/8"}`}
      >
        <Pin size={12} fill={isPinned ? "currentColor" : "none"} />
      </button>

      {/* Ticker */}
      <p className="text-white/40 text-xs font-mono mb-1">{stock.ticker}</p>

      {/* Name */}
      <p className="text-white font-medium text-sm leading-tight mb-0.5 pr-6">
        {stock.name}
      </p>
      <p className="text-white/30 text-xs mb-4 pr-6 truncate">{stock.name_en}</p>

      {/* Price */}
      <div className="mt-auto">
        <p className="text-white font-semibold text-lg tracking-tight">
          ₩{priceFormatted}
        </p>
        <div className={`flex items-center gap-1 mt-1 ${isUp ? "text-green-400" : "text-red-400"}`}>
          <span className="text-xs font-medium">
            {isUp ? "▲" : "▼"} {pct}%
          </span>
          <span className="text-xs opacity-60">
            {isUp ? "+" : ""}{stock.change.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>

      {/* Glow on hover */}
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isUp ? "shadow-[inset_0_0_30px_rgba(52,211,153,0.04)]" : "shadow-[inset_0_0_30px_rgba(248,113,113,0.04)]"}`} />
    </motion.div>
  );
}
