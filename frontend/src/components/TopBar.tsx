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
    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-bg-panel/90 backdrop-blur border border-bg-border rounded-full pl-3 pr-1.5 py-1.5 shadow-panel text-xs">
      <Zap size={12} className="text-accent" />
      <span className="text-fg-primary font-medium">{label}</span>
      {brandSlug && (
        <>
          <span className="text-fg-tertiary">·</span>
          <Store size={11} className="text-fg-tertiary" />
          <span className="text-fg-secondary">{brandSlug}</span>
        </>
      )}
      {hexes.length > 0 && (
        <span className="ml-1 px-2 py-0.5 rounded-full bg-bg-elevated text-fg-tertiary tabular">
          {hexes.length.toLocaleString()} hexes
          {topScore !== null && (
            <>
              <span className="mx-1 text-fg-tertiary">·</span>
              <span className="text-accent font-medium">top {topScore}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
