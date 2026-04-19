import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, Tag, LayoutGrid, MapPin } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";


const BRAND_NAMES: Record<string, string> = {
  // bubble tea
  sharetea:   "Sharetea",
  machimachi: "Machi Machi",
  // fast casual
  grilld:     "Grill'd",
  madmex:     "Mad Mex",
  // coffee
  threebeans:   "Three Beans",
  camposcoffee: "Campos Coffee",
};

const BRANDS = Object.entries(BRAND_NAMES).map(([slug, name]) => ({ slug, name }));

const SCORE_LEGEND = [
  { label: "High opportunity", color: "#3BB273" },
  { label: "Mixed / investigate", color: "#F5A623" },
  { label: "Saturated / low", color: "#E85D5D" },
];

// icons match the actual map markers used in MapView
const LAYER_DEFS = [
  {
    key: "opportunity" as const,
    label: "Opportunity surface",
    color: "#3BB273",
    icon: (
      // H3 hexagon cell — matches the heatmap layer
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <polygon points="8,1.5 13.5,4.75 13.5,11.25 8,14.5 2.5,11.25 2.5,4.75"
          fill="rgba(59,178,115,0.35)" stroke="#3BB273" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    key: "competitors" as const,
    label: "Competitor field",
    color: "#EF4444",
    // red circle with white border — exactly matches the map marker
    icon: (
      <span
        className="inline-block rounded-full"
        style={{ width: 11, height: 11, backgroundColor: "#EF4444", border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
      />
    ),
  },
  {
    key: "complementary" as const,
    label: "Demand anchors",
    color: "#818CF8",
    // smaller indigo circle with white border — matches the map marker
    icon: (
      <span
        className="inline-block rounded-full"
        style={{ width: 9, height: 9, backgroundColor: "#818CF8", border: "1.5px solid #fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
      />
    ),
  },
  {
    key: "own_brand" as const,
    label: "Owned network",
    color: "#059669",
    // teardrop map pin — matches the SVG pin in MapView exactly
    icon: (
      <svg width="14" height="18" viewBox="0 0 26 34" fill="none">
        <path d="M13 0C5.82 0 0 5.82 0 13c0 9.1 13 21 13 21s13-11.9 13-21C26 5.82 20.18 0 13 0z" fill="#059669" />
        <circle cx="13" cy="13" r="6" fill="white" />
        <circle cx="13" cy="13" r="3.5" fill="#059669" />
      </svg>
    ),
  },
];

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ref, onClose]);
}

export function TopBar() {
  const { verticals, vertical, setVertical, brandSlug, setBrandSlug, layers, toggleLayer, setVerticals } =
    useStore();

  useEffect(() => {
    api.verticals().then((d) => setVerticals(d.verticals));
  }, []);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  useClickOutside(categoryRef, () => setCategoryOpen(false), categoryOpen);
  useClickOutside(brandRef, () => setBrandOpen(false), brandOpen);
  useClickOutside(legendRef, () => setLegendOpen(false), legendOpen);

  const categoryLabel = useMemo(
    () => verticals.find((v) => v.key === vertical)?.label ?? "Category",
    [verticals, vertical]
  );

  const pillBase = {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(200,215,235,0.85)",
    boxShadow: "0 2px 12px rgba(17,116,251,0.10)",
  };

  const dropdownStyle = {
    background: "rgba(255,255,255,0.98)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid #E2E8F0",
    boxShadow: "0 8px 28px rgba(17,116,251,0.14)",
  };

  return (
    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">

      {/* ── Category ── */}
      <div ref={categoryRef} className="relative">
        <button
          type="button"
          onClick={() => { setCategoryOpen((v) => !v); setBrandOpen(false); setLegendOpen(false); }}
          className="flex items-center gap-1.5 rounded-full pl-3 pr-2.5 py-2 cursor-pointer"
          style={pillBase}
        >
          <LayoutGrid size={13} style={{ color: "#5B9BFF", flexShrink: 0 }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "#94A3B8" }}>Category</span>
          <span className="font-display font-semibold text-[13px] tracking-tight" style={{ color: "#0F172A" }}>
            {categoryLabel}
          </span>
          <ChevronDown size={11} style={{ color: "#94A3B8" }} className={`transition-transform duration-150 ${categoryOpen ? "rotate-180" : ""}`} />
        </button>
        {categoryOpen && (
          <div className="absolute top-full left-0 mt-2 rounded-2xl py-2 min-w-[190px]" style={dropdownStyle}>
            {verticals.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => { setVertical(v.key); setCategoryOpen(false); }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium hover:bg-[#F3F7FF] transition-colors cursor-pointer"
                style={{ color: v.key === vertical ? "#5B9BFF" : "#0F172A" }}
              >
                {v.label}
                {v.key === vertical && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#5B9BFF" }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Brand ── */}
      <div ref={brandRef} className="relative">
        <button
          type="button"
          onClick={() => { setBrandOpen((v) => !v); setCategoryOpen(false); setLegendOpen(false); }}
          className="flex items-center gap-1.5 rounded-full pl-3 pr-2.5 py-2 cursor-pointer"
          style={pillBase}
        >
          <Tag size={13} style={{ color: "#5B9BFF", flexShrink: 0 }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "#94A3B8" }}>Brand</span>
          <span className="font-display font-semibold text-[13px] tracking-tight" style={{ color: brandSlug ? "#0F172A" : "#94A3B8" }}>
            {brandSlug ? BRAND_NAMES[brandSlug] : "Any"}
          </span>
          <ChevronDown size={11} style={{ color: "#94A3B8" }} className={`transition-transform duration-150 ${brandOpen ? "rotate-180" : ""}`} />
        </button>
        {brandOpen && (
          <div className="absolute top-full left-0 mt-2 rounded-2xl py-2 min-w-[180px]" style={dropdownStyle}>
            {brandSlug && (
              <button
                type="button"
                onClick={() => { setBrandSlug(""); setBrandOpen(false); }}
                className="flex w-full px-4 py-2 text-xs font-semibold hover:bg-[#F3F7FF] transition-colors cursor-pointer"
                style={{ color: "#94A3B8" }}
              >
                Clear brand
              </button>
            )}
            {BRANDS.map((b) => (
              <button
                key={b.slug}
                type="button"
                onClick={() => { setBrandSlug(b.slug); setBrandOpen(false); }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium hover:bg-[#F3F7FF] transition-colors cursor-pointer"
                style={{ color: b.slug === brandSlug ? "#5B9BFF" : "#0F172A" }}
              >
                {b.name}
                {b.slug === brandSlug && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#5B9BFF" }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Layers ── */}
      <div ref={legendRef} className="relative">
        <button
          type="button"
          onClick={() => { setLegendOpen((v) => !v); setCategoryOpen(false); setBrandOpen(false); }}
          className="flex items-center gap-1.5 rounded-full pl-2.5 pr-2.5 py-2 cursor-pointer"
          style={pillBase}
        >
          <MapPin size={14} style={{ color: "rgba(91,155,255,0.55)", flexShrink: 0 }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "#94A3B8" }}>Layers</span>
          {/* active layer icons */}
          <span className="flex items-center gap-1 ml-0.5">
            {LAYER_DEFS.filter(({ key }) => layers[key]).map(({ key, icon }) => (
              <span key={key} className="flex items-center">{icon}</span>
            ))}
          </span>
          <ChevronDown
            size={11}
            style={{ color: "#94A3B8" }}
            className={`transition-transform duration-150 ${legendOpen ? "rotate-180" : ""}`}
          />
        </button>

        {legendOpen && (
          <div className="absolute top-full left-0 mt-2 rounded-2xl py-3 px-4 min-w-[220px]" style={dropdownStyle}>

            {/* Intelligence Layers */}
            <div className="text-[10px] font-bold uppercase tracking-[0.13em] mb-2.5" style={{ color: "#94A3B8" }}>
              Intelligence Layers
            </div>
            <div className="space-y-1.5 mb-4">
              {LAYER_DEFS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleLayer(key)}
                  className="flex items-center gap-2.5 w-full text-left py-0.5 rounded-lg transition-colors cursor-pointer"
                >
                  {/* map-style icon */}
                  <span
                    className="flex-shrink-0 transition-opacity"
                    style={{ opacity: layers[key] ? 1 : 0.3 }}
                  >
                    {icon}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: layers[key] ? "#0F172A" : "#94A3B8" }}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Score legend */}
            <div className="border-t pt-3" style={{ borderColor: "#E2E8F0" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.13em] mb-2" style={{ color: "#94A3B8" }}>
                Score
              </div>
              <div className="space-y-1.5">
                {SCORE_LEGEND.map(({ label, color }) => (
                  <div key={color} className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color, opacity: 0.85 }}
                    />
                    <span className="text-sm font-medium" style={{ color: "#64748B" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
