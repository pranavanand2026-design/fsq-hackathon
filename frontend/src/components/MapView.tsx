import { useCallback, useEffect, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { FlyToInterpolator } from "@deck.gl/core";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { scoreColor } from "../lib/colors";
import type { HexResult, Pin } from "../lib/api";

const INITIAL_VIEW = {
  latitude:  -33.868,
  longitude: 151.209,
  zoom: 12,
  pitch: 30,
  bearing: 0,
};

const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";


export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [pins, setPins] = useState<Pin[]>([]);

  const {
    vertical, brandSlug,
    hexes, setHexes, setLoadingHeatmap, loadingHeatmap,
    heatmapError, setHeatmapError,
    layers,
    setSelectedHex, setLoadingReport,
    flyTo,
  } = useStore();

  // consume imperative flyTo requests (from chat, pinned-click, etc.)
  useEffect(() => {
    if (!flyTo) return;
    setViewState((vs) => ({
      ...vs,
      latitude: flyTo.lat,
      longitude: flyTo.lng,
      zoom: flyTo.zoom,
      pitch: 40,
      transitionDuration: 1400,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.3 }),
    }) as any);
  }, [flyTo?.tick]);

  // load heatmap on vertical change
  useEffect(() => {
    setLoadingHeatmap(true);
    setHeatmapError(null);
    api
      .heatmap(vertical, brandSlug || undefined)
      .then((d) => setHexes(d.hexes))
      .catch((e) => {
        setHexes([]);
        setHeatmapError(e?.message ?? "Failed to load heatmap");
      })
      .finally(() => setLoadingHeatmap(false));
  }, [vertical, brandSlug]);

  // load pins on map move
  const loadPins = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    api
      .pins(vertical, {
        min_lat: b.getSouth(),
        max_lat: b.getNorth(),
        min_lng: b.getWest(),
        max_lng: b.getEast(),
      })
      .then((d) => setPins(d.pins));
  }, [vertical]);

  useEffect(() => { loadPins(); }, [loadPins]);

  async function handleHexClick(hex: HexResult) {
    setLoadingReport(true);
    setSelectedHex(null);
    try {
      const r = await api.report(vertical, hex.h3_id, brandSlug || undefined);
      setSelectedHex(r);
    } finally {
      setLoadingReport(false);
    }
  }

  const deckLayers = [
    // H3 opportunity heatmap
    layers.opportunity &&
      new H3HexagonLayer<HexResult>({
        id: "hexes",
        data: hexes,
        getHexagon: (d) => d.h3_id,
        getFillColor: (d) => scoreColor(d.score),
        getElevation: (d) => d.score * 3,
        elevationScale: 1,
        extruded: true,
        pickable: true,
        opacity: 0.85,
        onClick: ({ object }) => object && handleHexClick(object),
        updateTriggers: { getFillColor: [hexes], getElevation: [hexes] },
        transitions: { getFillColor: 400, getElevation: 400 },
      }),

    // competitor pins
    layers.competitors &&
      new ScatterplotLayer<Pin>({
        id: "competitors",
        data: pins.filter((p) => p.is_competitor),
        getPosition: (d) => [d.longitude, d.latitude],
        getFillColor: [239, 68, 68, 220],
        getRadius: 8,
        radiusMinPixels: 4,
        radiusMaxPixels: 12,
        pickable: true,
      }),

    // complementary pins
    layers.complementary &&
      new ScatterplotLayer<Pin>({
        id: "complementary",
        data: pins.filter((p) => p.is_complementary),
        getPosition: (d) => [d.longitude, d.latitude],
        getFillColor: [99, 102, 241, 200],
        getRadius: 6,
        radiusMinPixels: 3,
        radiusMaxPixels: 10,
        pickable: true,
      }),
  ].filter(Boolean);

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof INITIAL_VIEW)}
        controller={true}
        layers={deckLayers}
        getTooltip={(info) => {
          const object = info.object as (HexResult | Pin | null);
          if (!object) return null;
          if ("h3_id" in object) {
            return {
              html: `<div style="background:#1B2230;border:1px solid #262E3D;border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;font-size:13px;color:#E6EAF2">
                <div style="font-weight:600">${object.locality ?? "Sydney Area"}</div>
                <div style="color:#10B981;font-size:18px;font-weight:700;margin-top:2px">${object.score}<span style="color:#636B7A;font-size:12px">/100</span></div>
                <div style="color:#9BA3B4;font-size:11px;margin-top:4px">Click to open report</div>
              </div>`,
              style: { background: "transparent", border: "none", padding: "0" },
            };
          }
          if ("name" in object) {
            return {
              html: `<div style="background:#1B2230;border:1px solid #262E3D;border-radius:8px;padding:6px 10px;font-family:Inter,sans-serif;font-size:12px;color:#E6EAF2">
                <div style="font-weight:600">${object.name}</div>
                <div style="color:#9BA3B4;margin-top:2px">${object.primary_category ?? ""}</div>
              </div>`,
              style: { background: "transparent", border: "none", padding: "0" },
            };
          }
          return null;
        }}
      >
        <Map
          ref={mapRef}
          mapStyle={BASEMAP}
          onMoveEnd={loadPins}
          reuseMaps
        />
      </DeckGL>

      {/* loading overlay */}
      {loadingHeatmap && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-bg-panel border border-bg-border rounded-full px-4 py-1.5 text-xs text-fg-secondary flex items-center gap-2 shadow-panel">
          <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
          Scoring {hexes.length ? `${hexes.length.toLocaleString()} hexes` : "hexes"}…
        </div>
      )}

      {/* error banner — backend offline, 500, etc. */}
      {!loadingHeatmap && heatmapError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500/15 border border-red-500/40 rounded-full px-4 py-1.5 text-xs text-red-300 flex items-center gap-2 shadow-panel max-w-md">
          <span className="font-medium">Backend unreachable.</span>
          <span className="text-red-300/70 truncate">{heatmapError}</span>
          <button
            onClick={() => { setHeatmapError(null); setLoadingHeatmap(true); api.heatmap(vertical, brandSlug || undefined).then((d) => setHexes(d.hexes)).catch((e) => setHeatmapError(e?.message ?? "Failed")).finally(() => setLoadingHeatmap(false)); }}
            className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* score legend */}
      <div className="absolute bottom-20 right-3 bg-bg-panel border border-bg-border rounded-xl p-3 text-xs space-y-1.5 shadow-panel">
        {[
          { label: "High (75–100)", color: "#10B981" },
          { label: "Mid  (50–74)",  color: "#F59E0B" },
          { label: "Low  (0–49)",   color: "#EF4444" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.85 }} />
            <span className="text-fg-secondary">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
