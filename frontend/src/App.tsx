import { useCallback } from "react";
import { MapView } from "./components/MapView";
import { ReportPanel } from "./components/ReportPanel";
import { BranchFAB } from "./components/BranchFAB";
import { CompareMode } from "./components/CompareMode";
import { TopBar } from "./components/TopBar";
import { useStore } from "./lib/store";
import type { HexResult } from "./lib/api";
import { api } from "./lib/api";

export default function App() {
  const { vertical, brandSlug, setSelectedHex, setLoadingReport, flyToLocation } = useStore();

  const handleHighlight = useCallback(
    async (h: HexResult) => {
      flyToLocation(h.lat, h.lng, 14.5);
      setLoadingReport(true);
      try {
        const r = await api.report(vertical, h.h3_id, brandSlug || undefined);
        setSelectedHex(r);
      } finally {
        setLoadingReport(false);
      }
    },
    [vertical, brandSlug, flyToLocation, setSelectedHex, setLoadingReport]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg-base select-none">
      {/* full-width map */}
      <MapView />
      <TopBar />

      {/* right report panel */}
      <div className="absolute inset-0 pointer-events-none">
        <ReportPanel />
      </div>

      {/* floating chat FAB */}
      <BranchFAB onHighlight={handleHighlight} />

      {/* full-screen compare overlay */}
      <CompareMode />
    </div>
  );
}
