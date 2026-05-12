"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { getStock } from "@/lib/api";
import type { StockData } from "@/components/StockBubble";

type SearchResult = {
  ticker: string;
  name: string;
  name_en: string;
};

type Props = {
  onSelectStock: (stock: StockData) => void;
};

export default function StockSearch({ onSelectStock }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (result: SearchResult) => {
    setOpen(false);
    setFetching(result.ticker);
    try {
      const { data } = await getStock(result.ticker);
      if (data && !data.error) onSelectStock(data as StockData);
    } finally {
      setFetching(null);
    }
  };

  const clear = () => { setQuery(""); setResults([]); setOpen(false); };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-400/50 transition-all"
          placeholder="Search by company name or ticker…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3.5 w-4 h-4 text-white/30 animate-spin" />
        )}
        {!searching && query && (
          <button onClick={clear} className="absolute right-3.5 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.ticker}
              onClick={() => handleSelect(r)}
              disabled={fetching === r.ticker}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
            >
              <div>
                <p className="text-white text-sm font-medium">{r.name}</p>
                <p className="text-white/40 text-xs">{r.name_en}</p>
              </div>
              <div className="flex items-center gap-2">
                {fetching === r.ticker && <Loader2 className="w-3 h-3 text-white/30 animate-spin" />}
                <span className="text-white/30 text-xs font-mono">{r.ticker}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !searching && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-2 w-full bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl px-4 py-3">
          <p className="text-white/30 text-sm">No stocks found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
