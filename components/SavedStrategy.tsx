"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, X, TrendingUp, TrendingDown, Eye, ShieldCheck } from "lucide-react";

interface Recommendation {
  ticker: string;
  name: string;
  action: "BUY" | "HOLD" | "SELL";
  quantity: number;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  allocation_percent: number;
  rationale: string;
}

interface Proposal {
  summary: string;
  recommendations: Recommendation[];
  hedge_notes: string;
  market_outlook: string;
  total_invested: number;
  cash_reserve: number;
  generated_at: string;
  strategy_level: number;
  strategy_label: string;
}

interface Props {
  proposal: Proposal;
  savedAt: string;
  onClear: () => void;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  BUY:  <TrendingUp  size={11} />,
  HOLD: <Eye         size={11} />,
  SELL: <TrendingDown size={11} />,
};
const ACTION_CLS: Record<string, string> = {
  BUY:  "text-green-400 bg-green-500/10 border-green-500/20",
  HOLD: "text-blue-400  bg-blue-500/10  border-blue-500/20",
  SELL: "text-red-400   bg-red-500/10   border-red-500/20",
};

export default function SavedStrategy({ proposal, savedAt, onClear }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/10">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-left flex-1"
        >
          <ShieldCheck size={14} className="text-blue-400 shrink-0" />
          <div>
            <span className="text-blue-400 text-xs font-medium">Active Strategy</span>
            <span className="text-white/30 text-xs ml-2">{proposal.strategy_label}</span>
          </div>
          <span className="text-white/20 text-xs ml-auto mr-2">
            Saved {new Date(savedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
          </span>
          {expanded ? <ChevronUp size={14} className="text-white/30 shrink-0" /> : <ChevronDown size={14} className="text-white/30 shrink-0" />}
        </button>
        <button
          onClick={onClear}
          className="text-white/20 hover:text-red-400 transition-colors ml-2 shrink-0"
          title="Clear strategy"
        >
          <X size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Summary */}
          <p className="text-white/50 text-xs leading-relaxed">{proposal.summary}</p>

          {/* Compact recommendation list */}
          <div className="space-y-1.5">
            {proposal.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white/3 rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${ACTION_CLS[rec.action]}`}>
                    {ACTION_ICON[rec.action]} {rec.action}
                  </span>
                  <div>
                    <span className="text-white text-sm font-medium">{rec.name}</span>
                    <span className="text-white/30 text-xs font-mono ml-1.5">{rec.ticker}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-white/70 text-xs">{rec.quantity} shares × ₩{rec.entry_price.toLocaleString("ko-KR")}</p>
                  <p className="text-white/30 text-xs">Target ₩{rec.target_price.toLocaleString("ko-KR")} · {rec.allocation_percent}%</p>
                </div>
              </div>
            ))}
          </div>

          {proposal.market_outlook && (
            <p className="text-white/30 text-xs border-t border-white/5 pt-3">{proposal.market_outlook}</p>
          )}
        </div>
      )}
    </div>
  );
}
