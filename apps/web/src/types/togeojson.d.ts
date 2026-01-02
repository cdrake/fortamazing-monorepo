// src/types/togeojson.d.ts
declare module "togeojson" {
  import { FeatureCollection, Geometry } from "geojson";
  export function gpx(doc: Document): FeatureCollection<Geometry>;
  export function kml(doc: Document): FeatureCollection<Geometry>;
  // add more signatures if you need them
}
