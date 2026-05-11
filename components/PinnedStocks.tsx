"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, X } from "lucide-react";
import type { StockData } from "./StockBubble";

interface Props {
  pinnedStocks: StockData[];
  onSelect: (stock: StockData) => void;
  onUnpin: (ticker: string) => void;
}

export default function PinnedStocks({ pinnedStocks, onSelect, onUnpin }: Props) {
  if (pinnedStocks.length === 0) {
    return (
      <div className="py-10 text-center">
        <Pin className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">No pinned stocks yet</p>
        <p className="text-white/20 text-xs mt-1">Click the pin icon on any stock to watch it here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <AnimatePresence>
        {pinnedStocks.map((stock) => {
          const isUp = stock.is_up;
          return (
            <motion.div
              key={stock.ticker}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={() => onSelect(stock)}
              className="relative group cursor-pointer flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl px-4 py-3 transition-all"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-medium text-sm">{stock.name}</span>
                  <span className="text-white/30 text-xs font-mono">{stock.ticker}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/80 text-sm">₩{stock.price.toLocaleString("ko-KR")}</span>
                  <span className={`text-xs font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                    {isUp ? "▲" : "▼"} {Math.abs(stock.change_percent).toFixed(2)}%
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUnpin(stock.ticker); }}
                className="ml-1 text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
