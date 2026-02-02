export type Difficulty = "easy" | "medium" | "hard";

export type CostEstimate = {
  fuel: number;
  tolls: number;
  currency: string;
};

export type WaypointOut = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  city?: string | null;
};

export type RouteOut = {
  id: string;
  title: string;
  description: string;
  polyline: number[][]; // [lat,lng]

  start_point?: number[] | null;
  end_point?: number[] | null;
  waypoints?: WaypointOut[];
  min_engine_cc?: number | null;

  distance_km: number;
  duration_min: number;
  stops_count: number;
  cost_estimate: CostEstimate;
  rules: string;
  difficulty: Difficulty;
  participants_min: number;
  participants_max: number;
  participants_count: number;
  is_joined: boolean;
  created_by: string;
  start_date?: string | null;
  start_city?: string | null;
  end_city?: string | null;
  created_at: string;
};

export type UserSearchOut = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

export type StoryViewerOut = {
  user_id: string;
  username: string;
  profile_photo?: string | null;
  viewed_at: string;
};

export type StoryViewsOut = {
  story_id: string;
  views_count: number;
  viewers: StoryViewerOut[];
};

export type EventOut = {
  id: string;
  title: string;
  description: string;
  start_point: number[];
  location_name: string;
  start_time: string;
  poster_base64?: string | null;
  associated_route_id?: string | null;
  participants_count: number;
  is_joined: boolean;
  created_by: string;
  created_at: string;
};

// Stories types
export type StoryOut = {
  id: string;
  owner_id: string;
  owner_username: string;
  owner_photo?: string | null;
  media_base64: string;
  media_type: "image" | "video";
  caption?: string | null;
  created_at: string;
  expires_at: string;
};

export type StoryOwner = {
  user_id: string;
  username: string;
  profile_photo?: string | null;
  stories: StoryOut[];
};

// Badges & Gamification types
export type BadgeOut = {
  badge_type: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  username: string;
  profile_photo?: string | null;
  km_total: number;
  level: number;
  badges_count: number;
};

// Ride Session types
export type RideSessionOut = {
  id: string;
  user_id: string;
  route_id: string;
  status: "active" | "paused" | "completed" | "cancelled";
  start_time: string;
  end_time?: string | null;

export type ActiveRideForHomeOut = {
  ride_id: string;
  route_id: string;
  status: "active" | "paused";
  creator_id: string;
  started_at: string;
  updated_at: string;
};

  km_tracked: number;
  is_validated: boolean;
};
