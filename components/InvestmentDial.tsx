"use client";
import { motion } from "framer-motion";

const LEVELS = [
  { level: 1, label: "Very Conservative", color: "#60a5fa", desc: "Capital protection first" },
  { level: 2, label: "Conservative", color: "#34d399", desc: "Stability with modest gains" },
  { level: 3, label: "Balanced", color: "#fbbf24", desc: "Equal risk and reward" },
  { level: 4, label: "Aggressive", color: "#f97316", desc: "Growth-focused, higher risk" },
  { level: 5, label: "Very Aggressive", color: "#f43f5e", desc: "Maximum returns, max risk" },
];

interface Props {
  value: number;
  onChange: (val: number) => void;
}

export default function InvestmentDial({ value, onChange }: Props) {
  const current = LEVELS.find((l) => l.level === value) ?? LEVELS[2];

  return (
    <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-medium text-sm">Investment Strategy</h3>
          <p className="text-white/40 text-xs mt-0.5">{current.desc}</p>
        </div>
        <motion.div
          key={current.level}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="px-3 py-1.5 rounded-full text-xs font-medium border"
          style={{ color: current.color, borderColor: current.color + "40", backgroundColor: current.color + "15" }}
        >
          {current.label}
        </motion.div>
      </div>

      {/* Slider track */}
      <div className="relative">
        <div className="flex items-center gap-1 mb-3">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              onClick={() => onChange(l.level)}
              className="flex-1 group relative"
            >
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: l.level <= value ? current.color : "rgba(255,255,255,0.1)",
                }}
              />
            </button>
          ))}
        </div>

        {/* Level dots */}
        <div className="flex justify-between">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              onClick={() => onChange(l.level)}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-3 h-3 rounded-full border-2 transition-all duration-200"
                style={{
                  borderColor: l.level <= value ? current.color : "rgba(255,255,255,0.15)",
                  backgroundColor: l.level === value ? current.color : "transparent",
                  transform: l.level === value ? "scale(1.3)" : "scale(1)",
                }}
              />
              <span className="text-white/30 text-xs hidden sm:block">{l.level}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-3">
        <span className="text-white/25 text-xs">Conservative</span>
        <span className="text-white/25 text-xs">Aggressive</span>
      </div>
    </div>
  );
}
