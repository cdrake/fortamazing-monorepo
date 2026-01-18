export type LatLon = { lat: number; lon: number };

export type TrackSummary = {
  distanceMeters?: number;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  durationSeconds?: number;
};

export type Track = {
  // store as GeoJSON elsewhere; keep summary here
  start?: LatLon;
  end?: LatLon;
  summary?: TrackSummary;
};
