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

const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";


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
        getElevation: (d) => 0,
        elevationScale: 1,
        extruded: false,
        pickable: true,
        opacity: 0.75,
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
              html: `<div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;font-size:13px;color:#111827;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)">
                <div style="font-weight:600">${object.locality ?? "Sydney Area"}</div>
                <div style="color:#10B981;font-size:18px;font-weight:700;margin-top:2px">${object.score}<span style="color:#9CA3AF;font-size:12px">/100</span></div>
                <div style="color:#4B5563;font-size:11px;margin-top:4px">Click to open report</div>
              </div>`,
              style: { background: "transparent", border: "none", padding: "0" },
            };
          }
          if ("name" in object) {
            return {
              html: `<div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:6px 10px;font-family:Inter,sans-serif;font-size:12px;color:#111827;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)">
                <div style="font-weight:600">${object.name}</div>
                <div style="color:#4B5563;margin-top:2px">${object.primary_category ?? ""}</div>
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
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-5 py-2 text-xs flex items-center gap-2 z-20"
          style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#4B5563', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Scoring {hexes.length ? `${hexes.length.toLocaleString()} hexes` : 'hexes'}…</span>
        </div>
      )}

      {/* error banner — backend offline, 500, etc. */}
      {!loadingHeatmap && heatmapError && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-5 py-2 text-xs flex items-center gap-2 max-w-md z-20"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <span className="font-semibold">Backend unreachable.</span>
          <span className="text-red-400 truncate">{heatmapError}</span>
          <button
            onClick={() => { setHeatmapError(null); setLoadingHeatmap(true); api.heatmap(vertical, brandSlug || undefined).then((d) => setHexes(d.hexes)).catch((e) => setHeatmapError(e?.message ?? "Failed")).finally(() => setLoadingHeatmap(false)); }}
            className="ml-1 px-2.5 py-0.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div
        className="absolute bottom-24 right-6 rounded-xl p-3.5 text-xs space-y-2 z-20"
        style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Score Legend</div>
        {[
          { label: "High (75–100)", color: "#10B981" },
          { label: "Mid  (50–74)",  color: "#F59E0B" },
          { label: "Low  (0–49)",   color: "#EF4444" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: color, opacity: 0.85 }} />
            <span style={{ color: '#4B5563' }} className="font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
