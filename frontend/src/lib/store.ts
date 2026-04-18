import { create } from "zustand";
import type { HexResult, HexReport, Vertical } from "./api";

type Layer = "competitors" | "complementary" | "opportunity";

type Store = {
  verticals: Vertical[];
  vertical: string;
  brandSlug: string;

  hexes: HexResult[];
  loadingHeatmap: boolean;
  heatmapError: string | null;

  selectedHex: HexReport | null;
  loadingReport: boolean;

  pinned: HexResult[];              // for compare mode
  compareOpen: boolean;

  layers: Record<Layer, boolean>;

  // imperative fly-to target for the map: bumped each time, consumed by MapView
  flyTo: { lat: number; lng: number; zoom: number; tick: number } | null;

  chatOpen: boolean;
  chatHistory: { role: "user" | "assistant"; text: string; offline?: boolean }[];
  chatLoading: boolean;

  setVerticals: (v: Vertical[]) => void;
  setVertical: (v: string) => void;
  setBrandSlug: (s: string) => void;
  setHexes: (h: HexResult[]) => void;
  setLoadingHeatmap: (b: boolean) => void;
  setHeatmapError: (e: string | null) => void;
  setSelectedHex: (r: HexReport | null) => void;
  setLoadingReport: (b: boolean) => void;
  togglePin: (h: HexResult) => void;
  clearPinned: () => void;
  setCompareOpen: (b: boolean) => void;
  toggleLayer: (l: Layer) => void;
  flyToLocation: (lat: number, lng: number, zoom?: number) => void;
  setChatOpen: (b: boolean) => void;
  pushChat: (
    m: { role: "user" | "assistant"; text: string; offline?: boolean }
  ) => void;
  setChatLoading: (b: boolean) => void;
};

export const useStore = create<Store>((set) => ({
  verticals: [],
  vertical: "bubble_tea",
  brandSlug: "gongcha",

  hexes: [],
  loadingHeatmap: false,
  heatmapError: null,

  selectedHex: null,
  loadingReport: false,

  pinned: [],
  compareOpen: false,

  layers: { competitors: true, complementary: false, opportunity: true },

  flyTo: null,

  chatOpen: true,
  chatHistory: [],
  chatLoading: false,

  setVerticals: (verticals) => set({ verticals }),
  setVertical: (vertical) => set({ vertical }),
  setBrandSlug: (brandSlug) => set({ brandSlug }),
  setHexes: (hexes) => set({ hexes }),
  setLoadingHeatmap: (loadingHeatmap) => set({ loadingHeatmap }),
  setHeatmapError: (heatmapError) => set({ heatmapError }),
  setSelectedHex: (selectedHex) => set({ selectedHex }),
  setLoadingReport: (loadingReport) => set({ loadingReport }),
  togglePin: (h) =>
    set((s) => {
      const exists = s.pinned.find((p) => p.h3_id === h.h3_id);
      if (exists) return { pinned: s.pinned.filter((p) => p.h3_id !== h.h3_id) };
      if (s.pinned.length >= 3) return { pinned: [...s.pinned.slice(1), h] };
      return { pinned: [...s.pinned, h] };
    }),
  clearPinned: () => set({ pinned: [], compareOpen: false }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  toggleLayer: (l) =>
    set((s) => ({ layers: { ...s.layers, [l]: !s.layers[l] } })),
  flyToLocation: (lat, lng, zoom = 15) =>
    set((s) => ({ flyTo: { lat, lng, zoom, tick: (s.flyTo?.tick ?? 0) + 1 } })),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  pushChat: (m) => set((s) => ({ chatHistory: [...s.chatHistory, m] })),
  setChatLoading: (chatLoading) => set({ chatLoading }),
}));
