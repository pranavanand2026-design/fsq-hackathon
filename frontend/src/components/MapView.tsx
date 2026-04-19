import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef, useControl } from "react-map-gl/maplibre";
import { ScatterplotLayer } from "@deck.gl/layers";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
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

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}


export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [pins, setPins] = useState<Pin[]>([]);

  const {
    vertical, brandSlug,
    hexes, setHexes, setLoadingHeatmap, loadingHeatmap,
    heatmapError, setHeatmapError,
    layers,
    selectedHex, setSelectedHex, setLoadingReport,
    pinned,
    flyTo,
    scenario, setScenario,
  } = useStore();

  // top-scoring hex — shown with a pulse marker for the "wow moment"
  const topHex = useMemo(() => {
    if (!hexes.length) return null;
    return hexes.reduce((a, b) => (b.score > a.score ? b : a));
  }, [hexes]);

  // pulse phase for the top-hex ring
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setPulse((p) => (p + 0.02) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // consume imperative flyTo requests (from chat, pinned-click, etc.)
  useEffect(() => {
    if (!flyTo) return;
    mapRef.current?.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom,
      pitch: 40,
      duration: 1400,
    });
  }, [flyTo?.tick]);

  // load heatmap on vertical / brand / scenario change
  useEffect(() => {
    setLoadingHeatmap(true);
    setHeatmapError(null);
    api
      .heatmap(vertical, brandSlug || undefined, undefined, scenario?.weights)
      .then((d) => setHexes(d.hexes))
      .catch((e) => {
        setHexes([]);
        setHeatmapError(e?.message ?? "Failed to load heatmap");
      })
      .finally(() => setLoadingHeatmap(false));
  }, [vertical, brandSlug, scenario?.weights]);

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
      }, brandSlug || undefined)
      .then((d) => setPins(d.pins));
  }, [vertical, brandSlug]);

  useEffect(() => { loadPins(); }, [loadPins]);

  async function handleHexClick(hex: HexResult) {
    // Don't null selectedHex — let existing report stay visible while we fetch,
    // so switching hexes is a content swap instead of a panel remount + skeleton.
    setLoadingReport(true);
    try {
      const r = await api.report(vertical, hex.h3_id, brandSlug || undefined);
      setSelectedHex(r);
    } finally {
      setLoadingReport(false);
    }
  }



  const deckLayers = [
    // H3 opportunity heatmap
    new H3HexagonLayer<HexResult>({
      id: "hexes",
      visible: layers.opportunity,
      data: hexes,
      getHexagon: (d) => d.h3_id,
      getFillColor: (d) => scoreColor(d.score),
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 0.5,
      filled: true,
      stroked: true,
      extruded: false,
      pickable: layers.opportunity,
      opacity: 0.75,
      onClick: ({ object }) => object && handleHexClick(object),
      updateTriggers: { getFillColor: [hexes], visible: [layers.opportunity] },
      transitions: { getFillColor: 400 },
    }),

    // selected-hex outline
    selectedHex &&
      new H3HexagonLayer<{ h3_id: string }>({
        id: "selected-outline",
        data: [{ h3_id: selectedHex.h3_id }],
        getHexagon: (d) => d.h3_id,
        filled: false,
        stroked: true,
        getLineColor: [17, 24, 39, 230],
        lineWidthMinPixels: 2,
        pickable: false,
      }),

    // pinned markers on the map (ring + label)
    pinned.length > 0 &&
      new ScatterplotLayer<HexResult>({
        id: "pinned-ring",
        data: pinned,
        getPosition: (d) => [d.lng, d.lat],
        getFillColor: [255, 255, 255, 0],
        getLineColor: [17, 24, 39, 230],
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        getRadius: 10,
        radiusMinPixels: 9,
        radiusMaxPixels: 14,
        pickable: false,
      }),

    // top-hex pulse (two expanding rings, animated via `pulse` 0..1)
    topHex &&
      hexes.length > 0 &&
      !loadingHeatmap &&
      new ScatterplotLayer<{ lat: number; lng: number }>({
        id: `top-pulse-a`,
        data: [topHex],
        getPosition: (d) => [d.lng, d.lat],
        getRadius: 40 + pulse * 160,
        radiusMinPixels: 10 + pulse * 32,
        radiusMaxPixels: 60,
        stroked: true,
        filled: false,
        getLineColor: [16, 185, 129, Math.round((1 - pulse) * 220)],
        lineWidthMinPixels: 2,
        pickable: false,
        updateTriggers: { getRadius: pulse, getLineColor: pulse },
      }),
    topHex &&
      hexes.length > 0 &&
      !loadingHeatmap &&
      new ScatterplotLayer<{ lat: number; lng: number }>({
        id: `top-pulse-b`,
        data: [topHex],
        getPosition: (d) => [d.lng, d.lat],
        getRadius: 40 + ((pulse + 0.5) % 1) * 160,
        radiusMinPixels: 10 + ((pulse + 0.5) % 1) * 32,
        radiusMaxPixels: 60,
        stroked: true,
        filled: false,
        getLineColor: [16, 185, 129, Math.round((1 - ((pulse + 0.5) % 1)) * 160)],
        lineWidthMinPixels: 1.5,
        pickable: false,
        updateTriggers: { getRadius: pulse, getLineColor: pulse },
      }),
  ].filter(Boolean);

  const getTooltip = (info: any) => {
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
  };

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapStyle={BASEMAP}
        initialViewState={viewState}
        onMove={evt => setViewState(evt.viewState as any)}
        onMoveEnd={loadPins}
        reuseMaps
      >
        <DeckGLOverlay
          interleaved={true}
          layers={deckLayers}
          getTooltip={getTooltip}
        />

        {/* competitor pins — small red dot, hover tooltip */}
        {layers.competitors && pins.filter(p => p.is_competitor && !p.is_own_brand).map(p => (
          <Marker key={p.fsq_place_id} longitude={p.longitude} latitude={p.latitude} anchor="center">
            <div className="group relative cursor-default">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow-md" />
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 pointer-events-none">
                <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-lg text-xs whitespace-nowrap">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-gray-500">{p.primary_category}</div>
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {/* complementary pins — small indigo dot */}
        {layers.complementary && pins.filter(p => p.is_complementary && !p.is_competitor).map(p => (
          <Marker key={p.fsq_place_id} longitude={p.longitude} latitude={p.latitude} anchor="center">
            <div className="group relative cursor-default">
              <div className="w-2 h-2 rounded-full bg-indigo-400 border border-white shadow-sm" />
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 pointer-events-none">
                <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-lg text-xs whitespace-nowrap">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-gray-500">{p.primary_category}</div>
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {/* own-brand pins — always-visible label chip + large pin */}
        {layers.own_brand && pins.filter(p => p.is_own_brand).map(p => (
          <Marker key={`own-${p.fsq_place_id}`} longitude={p.longitude} latitude={p.latitude} anchor="bottom">
            <div className="flex flex-col items-center" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}>
              <div className="bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-400 whitespace-nowrap mb-0.5 leading-snug tracking-wide">
                {p.name.replace(/\s*[^\x00-\x7F]+/g, '').replace(/\s*-\s*.+$/, '').trim().slice(0, 18)}
              </div>
              <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
                <path d="M13 0C5.82 0 0 5.82 0 13c0 9.1 13 21 13 21s13-11.9 13-21C26 5.82 20.18 0 13 0z" fill="#059669"/>
                <circle cx="13" cy="13" r="6" fill="white"/>
                <circle cx="13" cy="13" r="3.5" fill="#059669"/>
              </svg>
            </div>
          </Marker>
        ))}
      </Map>

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

      {/* scenario mode badge */}
      {scenario && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 flex items-center gap-2.5 z-20"
          style={{ background: '#EEF9F4', border: '1.5px solid #10B981', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <span className="text-xs font-semibold text-emerald-700">Scenario: {scenario.label}</span>
          <button
            onClick={() => setScenario(null)}
            className="text-emerald-500 hover:text-emerald-700 transition-colors leading-none"
            title="Clear scenario"
          >
            ✕
          </button>
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

    </div>
  );
}
