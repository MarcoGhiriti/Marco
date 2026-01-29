export type Difficulty = "easy" | "medium" | "hard";

export type CostEstimate = {
  fuel: number;
  tolls: number;
  currency: string;
};

export type RouteOut = {
  id: string;
  title: string;
  description: string;
  polyline: number[][]; // [lat,lng]
  distance_km: number;
  duration_min: number;
  stops_count: number;
  cost_estimate: CostEstimate;
  rules: string;
  difficulty: Difficulty;
  participants_min: number;
  participants_max: number;
  created_at: string;
};

export type EventOut = {
  id: string;
  title: string;
  description: string;
  start_point: number[];
  start_time: string;
  poster_base64?: string | null;
  associated_route_id?: string | null;
  participants_count: number;
  is_joined: boolean;
  created_at: string;
};
