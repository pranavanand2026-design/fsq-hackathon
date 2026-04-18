export type HexResult = {
  h3_id: string;
  lat: number;
  lng: number;
  locality: string | null;
  score: number;
  components: {
    competition_density: number;
    anchor_pull: number;
    foot_traffic_proxy: number;
    transit_proximity: number;
    cannibalization: number;
  };
  n_competitors: number;
  n_complementary: number;
};

export type Vertical = {
  key: string;
  label: string;
  competitors: string[];
  anchors: string[];
  complementary: string[];
};

export type Pin = {
  fsq_place_id: string;
  name: string;
  primary_category: string | null;
  latitude: number;
  longitude: number;
  locality: string | null;
  is_competitor: boolean;
  is_complementary: boolean;
  is_anchor: boolean;
  is_transit: boolean;
};

export type NearPoi = {
  name: string;
  primary_category: string | null;
  latitude: number;
  longitude: number;
  locality: string | null;
  dist_m: number;
};

export type HexReport = {
  h3_id: string;
  lat: number;
  lng: number;
  locality: string | null;
  score: number;
  components: HexResult["components"];
  signals_raw: {
    n_competitors: number;
    n_complementary: number;
    n_retail: number;
    d_anchor_m: number | null;
    d_transit_m: number | null;
    d_cannibal_m: number | null;
  };
  weights: Record<string, number>;
  nearest_competitors: NearPoi[];
  nearest_complementary: NearPoi[];
  nearest_anchors: NearPoi[];
  nearest_transit: NearPoi[];
  diversity_index: number;
  ai_insight: string;
};

export type ChatResponse = {
  reply: string;
  tool_calls: { name: string; input: any; output: any }[];
  highlight: HexResult | null;
  _offline?: boolean;
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export const api = {
  verticals: () => get<{ verticals: Vertical[] }>("/api/verticals"),

  heatmap: (vertical: string, brand_slug?: string, locality?: string) =>
    post<{ vertical: string; count: number; hexes: HexResult[] }>(
      "/api/heatmap",
      { vertical, brand_slug, locality }
    ),

  report: (vertical: string, h3_id: string, brand_slug?: string) =>
    post<HexReport>("/api/report", { vertical, h3_id, brand_slug }),

  compare: (vertical: string, h3_ids: string[], brand_slug?: string) =>
    post<{ reports: HexReport[] }>("/api/compare", {
      vertical,
      h3_ids,
      brand_slug,
    }),

  pins: (
    vertical: string,
    bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }
  ) => {
    const q = new URLSearchParams({
      vertical,
      ...Object.fromEntries(Object.entries(bounds).map(([k, v]) => [k, String(v)])),
      limit: "500",
    });
    return get<{ pins: Pin[] }>(`/api/pins?${q.toString()}`);
  },

  chat: (message: string) => post<ChatResponse>("/api/chat", { message }),
};
