"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ShieldCheck, Eye, AlertTriangle, BookmarkCheck, Bookmark } from "lucide-react";

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
  error?: string;
}

interface Props {
  proposal: Proposal;
  onSave?: () => Promise<void>;
  isSaved?: boolean;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  BUY: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", icon: <TrendingUp size={14} /> },
  HOLD: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: <Eye size={14} /> },
  SELL: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", icon: <TrendingDown size={14} /> },
};

export default function InvestmentProposal({ proposal, onSave, isSaved }: Props) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  if (proposal.error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-red-400 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} />
          <span className="font-medium">Proposal Error</span>
        </div>
        <p className="text-red-400/70 text-xs">{proposal.summary}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Summary */}
      <div className="bg-blue-500/8 border border-blue-500/15 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
            <ShieldCheck size={12} className="text-blue-400" />
          </div>
          <span className="text-blue-400 text-xs font-medium uppercase tracking-wider">Strategy: {proposal.strategy_label}</span>
        </div>
        <p className="text-white/80 text-sm leading-relaxed">{proposal.summary}</p>
      </div>

      {/* Portfolio allocation bar */}
      <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
        <div className="flex justify-between mb-3">
          <span className="text-white/60 text-xs">Portfolio Allocation</span>
          <span className="text-white/60 text-xs">Cash Reserve: {proposal.cash_reserve}%</span>
        </div>
        <div className="flex rounded-full overflow-hidden h-2 gap-px">
          {proposal.recommendations.map((r, i) => (
            <div
              key={i}
              className="h-full transition-all"
              style={{
                width: `${r.allocation_percent}%`,
                backgroundColor: ACTION_STYLES[r.action]?.text.replace("text-", "") === "green-400"
                  ? "#34d399" : ACTION_STYLES[r.action]?.text.replace("text-", "") === "red-400"
                  ? "#f87171" : "#60a5fa",
                opacity: 0.7 + i * 0.05,
              }}
            />
          ))}
          <div className="h-full flex-1 bg-white/10" />
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider">Recommendations</h3>
        {proposal.recommendations.map((rec, i) => {
          const style = ACTION_STYLES[rec.action] ?? ACTION_STYLES.HOLD;
          const upside = rec.target_price > rec.entry_price
            ? (((rec.target_price - rec.entry_price) / rec.entry_price) * 100).toFixed(1)
            : null;
          const downside = (((rec.entry_price - rec.stop_loss) / rec.entry_price) * 100).toFixed(1);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`border rounded-2xl p-5 ${style.bg} ${style.border}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                      {style.icon} {rec.action}
                    </div>
                    <span className="text-white/40 text-xs font-mono">{rec.ticker}</span>
                  </div>
                  <h4 className="text-white font-medium text-base">{rec.name}</h4>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-xs">Allocation</p>
                  <p className={`text-lg font-semibold ${style.text}`}>{rec.allocation_percent}%</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-white/30 text-xs mb-0.5">Entry</p>
                  <p className="text-white text-sm font-medium">₩{rec.entry_price.toLocaleString("ko-KR")}</p>
                </div>
                <div>
                  <p className="text-white/30 text-xs mb-0.5">Qty</p>
                  <p className="text-white text-sm font-medium">{rec.quantity} shares</p>
                </div>
                <div>
                  <p className="text-white/30 text-xs mb-0.5">Target {upside && <span className="text-green-400">+{upside}%</span>}</p>
                  <p className="text-green-400 text-sm font-medium">₩{rec.target_price.toLocaleString("ko-KR")}</p>
                </div>
                <div>
                  <p className="text-white/30 text-xs mb-0.5">Stop-loss <span className="text-red-400">-{downside}%</span></p>
                  <p className="text-red-400 text-sm font-medium">₩{rec.stop_loss.toLocaleString("ko-KR")}</p>
                </div>
              </div>

              <p className="text-white/50 text-xs leading-relaxed">{rec.rationale}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Hedge + Outlook */}
      <div className="grid grid-cols-2 gap-4">
        {proposal.hedge_notes && (
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Hedge Strategy</p>
            <p className="text-white/70 text-xs leading-relaxed">{proposal.hedge_notes}</p>
          </div>
        )}
        {proposal.market_outlook && (
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Market Outlook</p>
            <p className="text-white/70 text-xs leading-relaxed">{proposal.market_outlook}</p>
          </div>
        )}
      </div>

      {onSave && (
        <button
          onClick={handleSave}
          disabled={saving || isSaved}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all border ${
            isSaved
              ? "bg-green-500/10 border-green-500/20 text-green-400 cursor-default"
              : "bg-white/5 border-white/10 text-white/60 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400"
          }`}
        >
          {isSaved
            ? <><BookmarkCheck size={15} /> Strategy Saved</>
            : saving
            ? "Saving..."
            : <><Bookmark size={15} /> Save Strategy</>
          }
        </button>
      )}

      <p className="text-white/20 text-xs text-center">
        Generated {new Date(proposal.generated_at).toLocaleString("ko-KR")} · For informational purposes only, not financial advice
      </p>
    </motion.div>
  );
}
