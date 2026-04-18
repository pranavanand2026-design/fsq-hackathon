import { useCallback } from "react";
import { MapView } from "./components/MapView";
import { Sidebar } from "./components/Sidebar";
import { ReportPanel } from "./components/ReportPanel";
import { ChatBar } from "./components/ChatBar";
import { CompareMode } from "./components/CompareMode";
import { TopBar } from "./components/TopBar";
import { useStore } from "./lib/store";
import type { HexResult } from "./lib/api";
import { api } from "./lib/api";

export default function App() {
  const {
    vertical, brandSlug,
    setSelectedHex, setLoadingReport,
    flyToLocation,
  } = useStore();

  const handleHighlight = useCallback(
    async (h: HexResult) => {
      // 1. Fly the map immediately — the "wow moment"
      flyToLocation(h.lat, h.lng, 14.5);
      // 2. Fetch the full report in parallel
      setLoadingReport(true);
      try {
        const r = await api.report(vertical, h.h3_id, brandSlug || undefined);
        setSelectedHex(r);
      } finally {
        setLoadingReport(false);
      }
    },
    [vertical, brandSlug]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg-base select-none">
      {/* left sidebar */}
      <Sidebar onPinnedClick={handleHighlight} />

      {/* map — fills space left of sidebar, right of report panel */}
      <div className="absolute left-60 right-0 top-0 bottom-0">
        <MapView />
        <TopBar />
        <ChatBar onHighlight={handleHighlight} />
      </div>

      {/* right report panel — overlays the map */}
      <div className="absolute left-60 right-0 top-0 bottom-0 pointer-events-none">
        <div className="relative w-full h-full pointer-events-auto">
          <ReportPanel />
        </div>
      </div>

      {/* full-screen compare overlay */}
      <CompareMode />
    </div>
  );
}
