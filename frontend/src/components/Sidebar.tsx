import { useEffect } from "react";
import { Map, X } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { scoreHex } from "../lib/colors";
import type { HexResult } from "../lib/api";

const LAYER_DEFS = [
  { key: "opportunity" as const, label: "Opportunity heatmap", color: "#10B981" },
  { key: "competitors" as const, label: "Competitors", color: "#EF4444" },
  { key: "complementary" as const, label: "Complementary", color: "#6366F1" },
];

const BRANDS = [
  { name: "Guzman y Gomez", slug: "guzmanygomez" },
  { name: "Fishbowl", slug: "fishbowl" },
  { name: "Betty's", slug: "bettysburgers" },
  { name: "Roll'd", slug: "rolld" },
  { name: "Gong cha", slug: "gongcha" },
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
    <div className="absolute left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-10" style={{ boxShadow: '1px 0 8px rgba(0,0,0,0.04)' }}>
      {/* logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
            <Map size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-base tracking-tight">GapMap</span>
            <span className="ml-1.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">beta</span>
            <div className="text-[11px] text-gray-400 leading-none mt-0.5">Site selection AI</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* vertical */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            I want to open a...
          </label>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-900 text-sm font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%239CA3AF' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            {verticals.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* brand quick select */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Your brand
            </label>
            {brandSlug && (
              <button 
                onClick={() => setBrandSlug("")}
                className="text-[10px] text-gray-400 hover:text-gray-600 font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BRANDS.map(b => (
              <button
                key={b.slug}
                onClick={() => setBrandSlug(brandSlug === b.slug ? "" : b.slug)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                  brandSlug === b.slug
                    ? "bg-emerald-500 text-white border border-emerald-500 pointer-events-none"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:text-emerald-600"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-tight">Quick select for cannibalisation analysis</p>
        </div>

        {/* map layers */}
        <div>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
            Map Layers
          </div>
          <div className="space-y-2.5">
            {LAYER_DEFS.map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group py-0.5">
                <div
                  className={`w-[18px] h-[18px] rounded-md border-2 transition-all flex items-center justify-center ${
                    layers[key] ? "border-transparent shadow-sm" : "border-gray-300 bg-white"
                  }`}
                  style={layers[key] ? { backgroundColor: color } : {}}
                  onClick={() => toggleLayer(key)}
                >
                  {layers[key] && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors font-medium">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* compare section */}
        {pinned.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Compare
              </div>
              <button onClick={clearPinned} className="text-[11px] text-gray-400 hover:text-gray-700 font-medium transition-colors">
                Clear all
              </button>
            </div>
            <div className="space-y-1">
              {pinned.map((p) => (
                <div
                  key={p.h3_id}
                  onClick={() => onPinnedClick(p)}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium truncate">
                    {p.locality ?? "Area"}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-sm font-bold tabular"
                      style={{ color: scoreHex(p.score) }}
                    >
                      {p.score}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(p); }}
                      className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {pinned.length >= 2 && (
              <button
                onClick={() => setCompareOpen(true)}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
              >
                Compare {pinned.length} locations
              </button>
            )}
            {pinned.length === 1 && (
              <p className="mt-2 text-xs text-gray-400 text-center">
                Pin one more location to compare
              </p>
            )}
          </div>
        )}
      </div>

      {/* data badge */}
      <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">
        <div className="text-[10px] text-gray-400 leading-relaxed">
          Powered by <span className="font-semibold text-gray-500">Foursquare OS Places</span><br />
          <PoiCount /> · H3 res-9
        </div>
      </div>
    </div>
  );
}

function PoiCount() {
  const { hexes } = useStore();
  return <span>{hexes.length ? `${hexes.length.toLocaleString()} Sydney hexes` : "loading..."}</span>;
}
