import { useEffect } from "react";
import { X, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoreBar } from "./ScoreBar";
import { scoreHex, scoreLabel } from "../lib/colors";
import { useStore } from "../lib/store";
import type { HexResult } from "../lib/api";

function dist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

function subtitle(r: { locality: string | null; region: string | null; postcode: string | null }) {
  const parts: string[] = [];
  if (r.locality) parts.push(r.locality);
  const regionShort =
    r.region === "New South Wales" ? "NSW" : r.region ?? null;
  if (regionShort && regionShort !== r.locality) parts.push(regionShort);
  if (r.postcode) parts.push(r.postcode);
  return parts.length ? parts.join(", ") : "Greater Sydney";
}

export function ReportPanel() {
  const { selectedHex: r, setSelectedHex, togglePin, pinned, setCompareOpen, loadingReport } = useStore();
  const pinCount = pinned.length;

  // Esc closes the panel.
  useEffect(() => {
    if (!r) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedHex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [r, setSelectedHex]);

  return (
    <AnimatePresence>
      {loadingReport && !r && <ReportSkeleton key="skel" />}
      {r && (
        <motion.div
          key="report"
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="absolute right-0 top-0 h-full w-[360px] bg-white border-l border-gray-200 flex flex-col z-20 overflow-hidden"
          style={{ boxShadow: "-4px 0 24px rgba(15, 23, 42, 0.08)" }}
        >
          {/* top progress bar — visible only while refetching over an existing report */}
          {loadingReport && (
            <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-30">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ x: "-40%", width: "40%" }}
                animate={{ x: "120%" }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}
          <ReportBody
            r={r}
            onClose={() => setSelectedHex(null)}
            isPinned={pinned.some((p) => p.h3_id === r.h3_id)}
            pinCount={pinCount}
            togglePin={togglePin}
            openCompare={() => setCompareOpen(true)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReportBody({
  r,
  onClose,
  isPinned,
  pinCount,
  togglePin,
  openCompare,
}: {
  r: NonNullable<ReturnType<typeof useStore.getState>["selectedHex"]>;
  onClose: () => void;
  isPinned: boolean;
  pinCount: number;
  togglePin: (h: HexResult) => void;
  openCompare: () => void;
}) {
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

  const nComp = r.signals_raw.n_competitors;
  const competitionLabel =
    nComp === 0 ? "Low (0)" : nComp <= 3 ? `Medium (${nComp})` : `High (${nComp})`;
  const competitionColor =
    nComp === 0 ? "#10B981" : nComp <= 3 ? "#F59E0B" : "#EF4444";

  const rankStr =
    r.rank != null && r.rank_total
      ? r.rank_pct != null && r.rank_pct <= 1
        ? `Top 1% of ${r.rank_total.toLocaleString()} hexes`
        : r.rank_pct != null && r.rank_pct <= 5
          ? `Top ${r.rank_pct}% · #${r.rank.toLocaleString()} of ${r.rank_total.toLocaleString()}`
          : `Rank #${r.rank.toLocaleString()} of ${r.rank_total.toLocaleString()}`
      : null;

  return (
    <>
      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 leading-tight truncate">
              {r.locality ?? "Sydney Area"}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate">{subtitle(r)}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={() => togglePin(hexResult)}
              title={isPinned ? "Unpin" : "Pin for compare"}
              className={`p-1.5 rounded-lg transition-colors ${
                isPinned
                  ? "bg-emerald-50 text-emerald-600"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Pin size={16} className={isPinned ? "fill-emerald-500" : ""} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* score hero */}
        <div className="mx-6 mb-5 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl px-6 py-5 text-center">
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
          <div className="mt-2 flex items-center justify-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: scoreHex(r.score) }}
            >
              {scoreLabel(r.score)}
            </span>
            {rankStr && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-[11px] text-gray-500 font-medium tabular">
                  {rankStr}
                </span>
              </>
            )}
          </div>
        </div>

        {/* key metrics */}
        <div className="px-6 space-y-0">
          <MetricRow label="Competition" value={competitionLabel} valueColor={competitionColor} />
          <MetricRow
            label="Complementary"
            value={`${r.signals_raw.n_complementary} nearby`}
            valueColor="#10B981"
          />
          <MetricRow
            label="Diversity"
            value={r.diversity_index?.toFixed(2) ?? "—"}
            valueColor="#10B981"
          />
          <MetricRow
            label="Transit access"
            value={r.nearest_transit[0]?.name ?? "None found"}
            valueColor={r.nearest_transit[0] ? "#3B82F6" : "#9CA3AF"}
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
            Nearby Competitors
          </div>
          {r.nearest_competitors.length === 0 ? (
            <div className="text-sm text-emerald-600 font-medium py-1 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
              />
              No direct competitors within 2km
            </div>
          ) : (
            <div className="space-y-2">
              {r.nearest_competitors.slice(0, 4).map((c, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 font-medium truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular ml-2 flex-shrink-0">
                    {dist(c.dist_m)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* complementary */}
        {r.nearest_complementary.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">
              Complementary
            </div>
            <div className="space-y-2">
              {r.nearest_complementary.slice(0, 4).map((c, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 font-medium truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular ml-2 flex-shrink-0">
                    {dist(c.dist_m)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Insight */}
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-xl" />
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5">
              AI Insight
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {r.ai_insight ??
                `${r.locality ?? "This area"} shows potential based on the surrounding business mix and competitive landscape.`}
            </p>
          </div>
        </div>
      </div>

      {/* sticky footer */}
      <div className="px-6 py-4 border-t border-gray-100 bg-white">
        {isPinned && pinCount >= 2 ? (
          <button
            onClick={openCompare}
            className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm"
          >
            Open compare ({pinCount})
          </button>
        ) : isPinned ? (
          <div className="text-center text-xs text-gray-500 py-2.5 font-medium">
            Pinned · pin another location to compare
          </div>
        ) : pinCount >= 1 ? (
          <button
            onClick={() => { togglePin(hexResult); openCompare(); }}
            className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm"
          >
            Pin &amp; compare ({pinCount + 1})
          </button>
        ) : (
          <button
            onClick={() => togglePin(hexResult)}
            className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm"
          >
            Pin this location
          </button>
        )}
      </div>
    </>
  );
}

function MetricRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      <span
        className="text-sm font-bold tabular truncate ml-3 max-w-[60%] text-right"
        style={{ color: valueColor }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <motion.div
      key="report-skel"
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="absolute right-0 top-0 h-full w-[360px] bg-white border-l border-gray-200 z-20"
      style={{ boxShadow: "-4px 0 24px rgba(15, 23, 42, 0.08)" }}
    >
      <div className="p-6 space-y-5 animate-pulse">
        <div className="h-5 w-40 bg-gray-100 rounded" />
        <div className="h-3 w-28 bg-gray-100 rounded" />
        <div className="h-28 bg-gray-50 border border-gray-100 rounded-2xl" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <div className="h-3 w-32 bg-gray-100 rounded mb-1.5" />
              <div className="h-1.5 w-full bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
