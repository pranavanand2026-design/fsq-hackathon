import { X } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import { ScoreBar } from "./ScoreBar";
import { scoreHex, scoreLabel } from "../lib/colors";

export function CompareMode() {
  const { compareOpen, setCompareOpen, pinned, clearPinned } = useStore();
  if (!compareOpen || pinned.length < 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 bg-bg-base/90 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border bg-bg-panel">
        <div>
          <h2 className="text-lg font-semibold text-fg-primary">Compare Locations</h2>
          <p className="text-xs text-fg-tertiary mt-0.5">{pinned.length} location{pinned.length > 1 ? "s" : ""} pinned</p>
        </div>
        <button onClick={() => setCompareOpen(false)} className="text-fg-tertiary hover:text-fg-primary transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${pinned.length}, minmax(0, 1fr))` }}>
          {pinned.map((h) => (
            <div key={h.h3_id} className="bg-bg-panel border border-bg-border rounded-xl p-5 space-y-4">
              <div>
                <p className="text-xs text-fg-tertiary uppercase tracking-widest mb-1">Location</p>
                <h3 className="text-base font-semibold text-fg-primary">{h.locality ?? "Sydney Area"}</h3>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular" style={{ color: scoreHex(h.score) }}>
                  {h.score}
                </span>
                <div>
                  <div className="text-xs text-fg-tertiary">/100</div>
                  <div className="text-sm font-medium" style={{ color: scoreHex(h.score) }}>
                    {scoreLabel(h.score)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(h.components).map(([k, v]) => (
                  <ScoreBar key={k} name={k} value={v} />
                ))}
              </div>

              <div className="pt-2 border-t border-bg-border space-y-1.5">
                <Stat label="Competitors (500m)" value={h.n_competitors} />
                <Stat label="Complementary (300m)" value={h.n_complementary} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-bg-border bg-bg-panel flex justify-end">
        <button
          onClick={clearPinned}
          className="text-sm text-fg-tertiary hover:text-fg-primary transition-colors"
        >
          Clear all pins
        </button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-fg-secondary">{label}</span>
      <span className="text-fg-primary tabular font-medium">{value}</span>
    </div>
  );
}
