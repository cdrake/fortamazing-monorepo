// ----- Types -----

import { FeatureCollection, Geometry } from "geojson";

// NOTE: originalFile is optional and preserved so the upload helper can send the raw GPX/KML to Storage
export type DayTrack = {
  id: string;
  name: string;
  geojson: FeatureCollection<Geometry>;
  stats: {
    distance_m: number;
    elevation: { min: number; max: number } | null;
    bounds: [number, number, number, number] | null;
  };
  color: string;
  visible: boolean;
  originalFile?: File;
};