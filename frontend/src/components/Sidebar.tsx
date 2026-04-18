import { useEffect } from "react";
import { Layers, Map, TrendingUp, X } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { scoreHex } from "../lib/colors";
import type { HexResult } from "../lib/api";

const LAYER_DEFS = [
  { key: "opportunity" as const, label: "Opportunity", color: "#10B981" },
  { key: "competitors" as const, label: "Competitors", color: "#EF4444" },
  { key: "complementary" as const, label: "Complementary", color: "#6366F1" },
];

export function Sidebar({ onPinnedClick }: { onPinnedClick: (h: HexResult) => void }) {
  const {
    verticals, setVerticals,
    vertical, setVertical,
    brandSlug, setBrandSlug,
    layers, toggleLayer,
    pinned, togglePin, setCompareOpen, clearPinned,
  } = useStore();

  useEffect(() => {
    api.verticals().then((d) => setVerticals(d.verticals));
  }, []);

  return (
    <div className="absolute left-0 top-0 h-full w-60 bg-bg-panel border-r border-bg-border flex flex-col z-10 shadow-panel">
      {/* logo */}
      <div className="px-4 py-4 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Map size={15} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-fg-primary tracking-tight">GapMap</span>
            <div className="text-[10px] text-fg-tertiary leading-none mt-0.5">Site selection AI</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* vertical */}
        <div>
          <label className="block text-xs text-fg-tertiary uppercase tracking-widest mb-2">
            Franchise vertical
          </label>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="w-full bg-bg-elevated border border-bg-border text-fg-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
          >
            {verticals.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* brand slug */}
        <div>
          <label className="block text-xs text-fg-tertiary uppercase tracking-widest mb-2">
            Your brand (for cannibalisation)
          </label>
          <input
            type="text"
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
            placeholder="e.g. gongcha"
            className="w-full bg-bg-elevated border border-bg-border text-fg-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent placeholder:text-fg-tertiary"
          />
          <p className="text-[10px] text-fg-tertiary mt-1">Lowercase, no spaces. Prefix-matched.</p>
        </div>

        {/* layers */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-fg-tertiary uppercase tracking-widest mb-2">
            <Layers size={12} />
            Layers
          </div>
          <div className="space-y-2">
            {LAYER_DEFS.map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                    layers[key] ? "border-transparent" : "border-bg-border bg-bg-elevated"
                  }`}
                  style={layers[key] ? { backgroundColor: color } : {}}
                  onClick={() => toggleLayer(key)}
                >
                  {layers[key] && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-fg-secondary group-hover:text-fg-primary transition-colors">
                    {label}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* pinned locations */}
        {pinned.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-fg-tertiary uppercase tracking-widest">
                <TrendingUp size={12} />
                Pinned ({pinned.length}/3)
              </div>
              <button onClick={clearPinned} className="text-[10px] text-fg-tertiary hover:text-fg-primary">
                Clear all
              </button>
            </div>
            <div className="space-y-1.5">
              {pinned.map((p) => (
                <div
                  key={p.h3_id}
                  onClick={() => onPinnedClick(p)}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer group"
                >
                  <span className="text-sm text-fg-secondary group-hover:text-fg-primary truncate">
                    {p.locality ?? "Area"}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="text-sm font-medium tabular"
                      style={{ color: scoreHex(p.score) }}
                    >
                      {p.score}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(p); }}
                      className="text-fg-tertiary hover:text-fg-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {pinned.length >= 2 && (
              <button
                onClick={() => setCompareOpen(true)}
                className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-emerald-500 transition-colors"
              >
                Compare {pinned.length} locations
              </button>
            )}
            {pinned.length === 1 && (
              <p className="mt-3 text-[10px] text-fg-tertiary text-center">
                Pin one more location to compare
              </p>
            )}
          </div>
        )}
      </div>

      {/* data badge */}
      <div className="p-4 border-t border-bg-border">
        <div className="text-[10px] text-fg-tertiary leading-relaxed">
          Powered by Foursquare OS Places<br />
          <PoiCount /> · H3 res-9
        </div>
      </div>
    </div>
  );
}

// Tiny live count that pulls from /api/health once
function PoiCount() {
  const { hexes } = useStore();
  // hexes is populated from /api/heatmap so reflects live data
  return <span>{hexes.length ? `${hexes.length.toLocaleString()} Sydney hexes` : "loading..."}</span>;
}
