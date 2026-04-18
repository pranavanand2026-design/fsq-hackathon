import { X, Pin, MapPin, Building2, Train, Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoreBar } from "./ScoreBar";
import { scoreHex, scoreLabel } from "../lib/colors";
import { useStore } from "../lib/store";
import type { HexReport, HexResult } from "../lib/api";

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

  return (
    <AnimatePresence>
      <motion.div
        key="report"
        initial={{ x: 360, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 360, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="absolute right-0 top-0 h-full w-80 bg-bg-panel border-l border-bg-border flex flex-col z-20 shadow-panel overflow-hidden"
      >
        {/* header */}
        <div className="flex items-start justify-between p-4 border-b border-bg-border">
          <div>
            <p className="text-xs text-fg-tertiary uppercase tracking-widest mb-1">
              Opportunity Report
            </p>
            <h2 className="text-lg font-semibold text-fg-primary leading-tight">
              {r.locality ?? "Sydney Area"}
            </h2>
          </div>
          <button
            onClick={() => setSelectedHex(null)}
            className="text-fg-tertiary hover:text-fg-primary transition-colors mt-0.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* score hero */}
        <div className="px-4 py-5 border-b border-bg-border">
          <div className="flex items-center gap-3">
            <div
              className="text-5xl font-bold tabular leading-none"
              style={{ color: scoreHex(r.score) }}
            >
              {r.score}
            </div>
            <div>
              <div className="text-xs text-fg-tertiary">/ 100</div>
              <div
                className="text-sm font-medium mt-0.5"
                style={{ color: scoreHex(r.score) }}
              >
                {scoreLabel(r.score)}
              </div>
            </div>
          </div>
        </div>

        {/* score bars */}
        <div className="px-4 py-4 border-b border-bg-border space-y-3">
          {Object.entries(r.components).map(([k, v]) => (
            <ScoreBar key={k} name={k} value={v} />
          ))}
        </div>

        {/* nearby */}
        <div className="flex-1 overflow-y-auto">
          {r.nearest_anchors.length > 0 && (
            <Section icon={<Building2 size={13} />} title="Anchors nearby">
              {r.nearest_anchors.map((p, i) => (
                <PoiRow key={i} name={p.name} category={p.primary_category} dist={p.dist_m} color="#10B981" />
              ))}
            </Section>
          )}

          {r.nearest_competitors.length > 0 && (
            <Section icon={<Store size={13} />} title="Direct competitors">
              {r.nearest_competitors.map((p, i) => (
                <PoiRow key={i} name={p.name} category={p.primary_category} dist={p.dist_m} color="#EF4444" />
              ))}
            </Section>
          )}

          {r.nearest_complementary.length > 0 && (
            <Section icon={<MapPin size={13} />} title="Complementary">
              {r.nearest_complementary.slice(0, 4).map((p, i) => (
                <PoiRow key={i} name={p.name} category={p.primary_category} dist={p.dist_m} color="#6366F1" />
              ))}
            </Section>
          )}

          {r.nearest_transit.length > 0 && (
            <Section icon={<Train size={13} />} title="Transit">
              {r.nearest_transit.map((p, i) => (
                <PoiRow key={i} name={p.name} category={p.primary_category} dist={p.dist_m} color="#F59E0B" />
              ))}
            </Section>
          )}
        </div>

        {/* actions */}
        <div className="p-4 border-t border-bg-border flex gap-2">
          <button
            onClick={() => {
              togglePin(hexResult);
              if (!isPinned && pinned.length >= 1) setCompareOpen(true);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              isPinned
                ? "bg-accent text-white"
                : "bg-bg-elevated hover:bg-bg-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            <Pin size={14} />
            {isPinned ? "Pinned" : "Pin location"}
          </button>
          {pinned.length >= 1 && (
            <button
              onClick={() => setCompareOpen(true)}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-bg-elevated hover:bg-bg-border text-fg-secondary hover:text-fg-primary transition-colors"
            >
              Compare ({pinned.length + (isPinned ? 0 : 1)})
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-bg-border">
      <div className="flex items-center gap-1.5 text-xs text-fg-tertiary uppercase tracking-widest mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PoiRow({ name, category, dist: d, color }: { name: string; category: string | null; dist: number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm text-fg-primary truncate">{name}</span>
      </div>
      <span className="text-xs text-fg-tertiary tabular ml-2 flex-shrink-0">{dist(d)}</span>
    </div>
  );
}
