import { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { ScoreBar } from "./ScoreBar";
import { scoreHex, scoreLabel } from "../lib/colors";

export function CompareMode() {
  const { compareOpen, setCompareOpen, pinned, clearPinned } = useStore();

  useEffect(() => {
    if (!compareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCompareOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compareOpen, setCompareOpen]);

  if (!compareOpen || pinned.length < 1) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) setCompareOpen(false); }}
        className="absolute inset-0 z-30 bg-gray-900/30 backdrop-blur-sm flex flex-col"
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-bg-border bg-white">
          <div>
            <h2 className="font-display text-xl font-bold text-fg-primary tracking-tight">Compare Locations</h2>
            <p className="text-sm text-fg-tertiary mt-0.5">{pinned.length} location{pinned.length > 1 ? "s" : ""} pinned</p>
          </div>
          <button onClick={() => setCompareOpen(false)} className="text-fg-tertiary hover:text-fg-primary transition-colors p-1">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-bg-base">
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${pinned.length}, minmax(0, 1fr))` }}>
            {pinned.map((h) => (
              <div
                key={h.h3_id}
                className="bg-white border border-bg-border rounded-2xl p-6 space-y-5"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
              >
                <div>
                  <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-[0.15em] mb-1">Location</p>
                  <h3 className="font-display text-lg font-bold text-fg-primary tracking-tight">{h.locality ?? "Sydney Area"}</h3>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold tabular tracking-tight" style={{ color: scoreHex(h.score) }}>
                    {h.score}
                  </span>
                  <div>
                    <div className="text-sm text-gray-300 font-bold">/100</div>
                    <div className="text-sm font-bold mt-0.5" style={{ color: scoreHex(h.score) }}>
                      {scoreLabel(h.score)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(h.components).map(([k, v]) => (
                    <ScoreBar key={k} name={k} value={v} />
                  ))}
                </div>

                <div className="pt-3 border-t border-bg-border space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-fg-secondary flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      Competitors (500m)
                    </span>
                    <span className="text-fg-primary tabular font-bold">{h.n_competitors}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-fg-secondary flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                      Complementary (300m)
                    </span>
                    <span className="text-fg-primary tabular font-bold">{h.n_complementary}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-4 border-t border-bg-border bg-white flex justify-end gap-3">
          <button
            onClick={clearPinned}
            className="text-sm text-fg-tertiary hover:text-fg-primary transition-colors font-medium px-4 py-2"
          >
            Clear all pins
          </button>
          <button
            onClick={() => setCompareOpen(false)}
            className="text-sm font-bold text-white px-5 py-2 rounded-xl transition-colors"
            style={{ backgroundColor: '#5B9BFF' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0065F0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5B9BFF'; }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
