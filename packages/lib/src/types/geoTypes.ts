export type LatLng = {
  latitude: number;
  longitude: number;
};

export type BBox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type GeoJsonGeometry = {
  type: string;
  coordinates: number[] | number[][] | number[][][];
};

export type GeoJsonFeature = {
  type: "Feature";
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};
