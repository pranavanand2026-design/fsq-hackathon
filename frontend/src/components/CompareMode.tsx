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
      className="absolute inset-0 z-30 bg-gray-900/20 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Compare Locations</h2>
          <p className="text-sm text-gray-400 mt-0.5">{pinned.length} location{pinned.length > 1 ? "s" : ""} pinned</p>
        </div>
        <button onClick={() => setCompareOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${pinned.length}, minmax(0, 1fr))` }}>
          {pinned.map((h) => (
            <div
              key={h.h3_id}
              className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
            >
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">Location</p>
                <h3 className="text-lg font-bold text-gray-900">{h.locality ?? "Sydney Area"}</h3>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tabular tracking-tight" style={{ color: scoreHex(h.score) }}>
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

              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">🔴 Competitors (500m)</span>
                  <span className="text-gray-900 tabular font-bold">{h.n_competitors}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">🟢 Complementary (300m)</span>
                  <span className="text-gray-900 tabular font-bold">{h.n_complementary}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-end gap-3">
        <button
          onClick={clearPinned}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium px-4 py-2"
        >
          Clear all pins
        </button>
        <button
          onClick={() => setCompareOpen(false)}
          className="text-sm font-bold bg-emerald-500 text-white px-5 py-2 rounded-xl hover:bg-emerald-600 transition-colors"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}
