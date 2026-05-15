"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, LogOut, BarChart3 } from "lucide-react";
import { getKospi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface KospiData { value: number; change: number; change_percent: number; is_up: boolean; }

interface Props {
  budget: number;
  onBudgetChange: (val: number) => void;
  onBudgetSave: () => void;
  showInvestButton?: boolean;
}

export default function KospiBar({ budget, onBudgetChange, onBudgetSave, showInvestButton = true }: Props) {
  const [kospi, setKospi] = useState<KospiData | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(budget.toString());
  const { profile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const load = () => getKospi().then((r) => setKospi(r.data)).catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setBudgetInput(budget.toString()); }, [budget]);

  const handleBudgetSave = () => {
    const val = parseFloat(budgetInput.replace(/,/g, "")) || 0;
    onBudgetChange(val);
    onBudgetSave();
    setEditingBudget(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/8 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-blue-400 w-5 h-5" />
            <span className="text-white font-semibold text-base tracking-tight">StockFix</span>
          </div>
          {kospi && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
              <span className="text-white/40 text-xs font-mono">KOSPI</span>
              <span className="text-white font-medium text-sm">{kospi.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</span>
              <div className={`flex items-center gap-1 text-xs ${kospi.is_up ? "text-green-400" : "text-red-400"}`}>
                {kospi.is_up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{kospi.is_up ? "+" : ""}{kospi.change_percent.toFixed(2)}%</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <span className="text-white/30 text-xs">Budget</span>
            {editingBudget ? (
              <input
                className="bg-transparent text-white text-sm w-32 outline-none text-right"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onBlur={handleBudgetSave}
                onKeyDown={(e) => e.key === "Enter" && handleBudgetSave()}
                autoFocus
              />
            ) : (
              <button onClick={() => setEditingBudget(true)} className="text-white text-sm font-medium min-w-[80px] text-right hover:text-blue-400 transition-colors">
                {budget > 0 ? `₩${budget.toLocaleString("ko-KR")}` : "Set budget"}
              </button>
            )}
          </div>

          <button onClick={() => router.push("/portfolio")} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            Portfolio
          </button>

          {showInvestButton && (
            <button onClick={() => router.push("/invest")} className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              Invest →
            </button>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="text-white/40 text-xs">{profile?.username}</span>
            <button onClick={logout} className="text-white/30 hover:text-white/60 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
