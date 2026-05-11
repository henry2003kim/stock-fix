"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { addTransaction, deleteTransaction } from "@/lib/api";

interface Transaction {
  id: number;
  ticker: string;
  quantity: number;
  price: number;
  action: string;
  note?: string | null;
  executed_at: string;
}

interface Props {
  transactions: Transaction[];
  onRefresh: () => void;
}

export default function TransactionForm({ transactions, onRefresh }: Props) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputCls = "bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-400/50 transition-all";

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !quantity || !price) { setError("Fill in all required fields"); return; }
    setLoading(true);
    setError("");
    try {
      await addTransaction(ticker.toUpperCase(), parseFloat(quantity), parseFloat(price.replace(/,/g, "")), action, note || undefined);
      setTicker(""); setQuantity(""); setPrice(""); setNote("");
      onRefresh();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to add transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTransaction(id);
      onRefresh();
    } catch { /* ignore */ }
  };

  const totalBuy = transactions.filter((t) => t.action === "BUY").reduce((sum, t) => sum + t.price * t.quantity, 0);
  const totalSell = transactions.filter((t) => t.action === "SELL").reduce((sum, t) => sum + t.price * t.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-medium text-sm">Record Transaction</h3>

        {/* Action toggle */}
        <div className="flex gap-2">
          {(["BUY", "SELL"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                action === a
                  ? a === "BUY"
                    ? "bg-green-500/15 border-green-500/30 text-green-400"
                    : "bg-red-500/15 border-red-500/30 text-red-400"
                  : "bg-white/4 border-white/8 text-white/40 hover:text-white/60"
              }`}
            >
              {a === "BUY" ? <TrendingUp size={14} className="inline mr-1.5" /> : <TrendingDown size={14} className="inline mr-1.5" />}
              {a}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <input
            className={inputCls}
            placeholder="Ticker (e.g. 005930)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            required
          />
          <input
            className={inputCls}
            placeholder="Quantity"
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <input
            className={inputCls}
            placeholder="Price (₩)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <input
          className={inputCls + " w-full"}
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500/80 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} /> {loading ? "Adding..." : "Add Transaction"}
        </button>
      </form>

      {/* Summary */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/8 border border-green-500/15 rounded-xl p-3">
            <p className="text-green-400/60 text-xs">Total Bought</p>
            <p className="text-green-400 font-medium text-sm">₩{totalBuy.toLocaleString("ko-KR")}</p>
          </div>
          <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
            <p className="text-red-400/60 text-xs">Total Sold</p>
            <p className="text-red-400 font-medium text-sm">₩{totalSell.toLocaleString("ko-KR")}</p>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-2">
        <h3 className="text-white/50 text-xs uppercase tracking-wider">Transaction History</h3>
        <AnimatePresence>
          {transactions.length === 0 ? (
            <p className="text-white/20 text-sm py-4 text-center">No transactions recorded yet</p>
          ) : (
            [...transactions].reverse().map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center justify-between bg-white/4 border border-white/8 rounded-xl px-4 py-3 group"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    t.action === "BUY" ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"
                  }`}>
                    {t.action}
                  </span>
                  <div>
                    <span className="text-white font-medium text-sm">{t.ticker}</span>
                    {t.note && <span className="text-white/30 text-xs ml-2">{t.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-white/70 text-sm">{t.quantity} × ₩{t.price.toLocaleString("ko-KR")}</p>
                    <p className="text-white/30 text-xs">{new Date(t.executed_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
