import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoreBar } from "./ScoreBar";
import { scoreHex, scoreLabel } from "../lib/colors";
import { useStore } from "../lib/store";
import type { HexResult } from "../lib/api";

function dist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

export function ReportPanel() {
  const { selectedHex: r, setSelectedHex, togglePin, pinned, setCompareOpen } = useStore();

  if (!r) return null;

  const isPinned = pinned.some((p) => p.h3_id === r.h3_id);

  const hexResult: HexResult = {
    h3_id: r.h3_id,
    lat: r.lat,
    lng: r.lng,
    locality: r.locality,
    score: r.score,
    components: r.components,
    n_competitors: r.signals_raw.n_competitors,
    n_complementary: r.signals_raw.n_complementary,
  };

  const competitionLabel = r.signals_raw.n_competitors === 0 ? "Low (0)" : r.signals_raw.n_competitors <= 3 ? `Medium (${r.signals_raw.n_competitors})` : `High (${r.signals_raw.n_competitors})`;
  const competitionColor = r.signals_raw.n_competitors === 0 ? "#10B981" : r.signals_raw.n_competitors <= 3 ? "#F59E0B" : "#EF4444";

  return (
    <AnimatePresence>
      <motion.div
        key="report"
        initial={{ x: 380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 380, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="absolute right-0 top-0 h-full w-[340px] bg-white border-l border-gray-200 flex flex-col z-20 overflow-hidden"
        style={{ boxShadow: '-2px 0 12px rgba(0,0,0,0.06)' }}
      >
        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                {r.locality ?? "Sydney Area"}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Inner West, NSW 2048
              </p>
            </div>
            <button
              onClick={() => setSelectedHex(null)}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>

          {/* score hero */}
          <div className="mx-6 mb-5 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 text-center">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">
              Opportunity Score
            </div>
            <div className="flex items-end justify-center gap-1">
              <span
                className="text-[56px] font-extrabold tabular tracking-tighter leading-none"
                style={{ color: scoreHex(r.score) }}
              >
                {r.score}
              </span>
              <span className="text-xl text-gray-300 font-bold mb-2">/100</span>
            </div>
          </div>

          {/* key metrics */}
          <div className="px-6 space-y-0">
            <MetricRow label="Competition" value={competitionLabel} valueColor={competitionColor} />
            <MetricRow label="Complementary" value={`${r.signals_raw.n_complementary} nearby`} valueColor="#10B981" />
            <MetricRow label="Diversity" value={r.diversity_index?.toFixed(2) ?? "—"} valueColor="#10B981" />
            <MetricRow
              label="Transit access"
              value={r.nearest_transit[0]?.name ?? "None found"}
              valueColor="#3B82F6"
              isLink
            />
          </div>

          {/* score breakdown */}
          <div className="px-6 pt-5 pb-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">
              Score Breakdown
            </div>
            <div className="space-y-2.5">
              {Object.entries(r.components).map(([k, v]) => (
                <ScoreBar key={k} name={k} value={v} />
              ))}
            </div>
          </div>

          {/* nearby competitors */}
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">
              🔴 Nearby Competitors
            </div>
            {r.nearest_competitors.length === 0 ? (
              <div className="text-sm text-gray-500 font-medium py-1">✅ No direct competitors found</div>
            ) : (
              <div className="space-y-2">
                {r.nearest_competitors.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 font-medium truncate">{c.name}</span>
                    <span className="text-xs text-gray-400 tabular ml-2 flex-shrink-0">{dist(c.dist_m)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* complementary */}
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">
              🟢 Complementary
            </div>
            <div className="space-y-2">
              {r.nearest_complementary.slice(0, 4).map((c, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 font-medium truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular ml-2 flex-shrink-0">{dist(c.dist_m)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insight */}
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-xl"></div>
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5">
                ✨ AI Insight
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {r.ai_insight ?? `${r.locality ?? "This area"} shows potential for a new location based on the surrounding business mix and competitive landscape.`}
              </p>
            </div>
          </div>
        </div>

        {/* sticky footer */}
        <div className="px-6 py-5 border-t border-gray-100 bg-white">
          <button
            onClick={() => {
              if (!isPinned) togglePin(hexResult);
              setCompareOpen(true);
            }}
            className="w-full py-3.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm"
          >
            Compare with another area
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function MetricRow({ label, value, valueColor, isLink }: { label: string; value: string; valueColor: string; isLink?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      <span
        className={`text-sm font-bold tabular ${isLink ? "cursor-pointer hover:underline" : ""}`}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}
