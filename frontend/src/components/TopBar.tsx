import { useMemo } from "react";
import { Zap, Store } from "lucide-react";
import { useStore } from "../lib/store";

export function TopBar() {
  const { verticals, vertical, brandSlug, hexes } = useStore();
  const label = useMemo(
    () => verticals.find((v) => v.key === vertical)?.label ?? vertical,
    [verticals, vertical]
  );

  const topScore = useMemo(
    () => (hexes.length ? Math.max(...hexes.map((h) => h.score)) : null),
    [hexes]
  );

  return (
    <div
      className="absolute top-5 left-5 z-10 flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-3.5 pr-2 py-2 text-xs"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <Zap size={12} className="text-emerald-500" />
      <span className="text-gray-900 font-semibold">{label}</span>
      {brandSlug && (
        <>
          <span className="text-gray-300">·</span>
          <Store size={11} className="text-gray-400" />
          <span className="text-gray-600 font-medium">{brandSlug}</span>
        </>
      )}
      {hexes.length > 0 && (
        <span className="ml-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold tabular text-[11px]">
          {hexes.length.toLocaleString()} hexes
          {topScore !== null && (
            <>
              <span className="mx-1 text-emerald-300">·</span>
              <span className="text-emerald-600">top {topScore}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
