import type { FeatureCollection, Geometry } from "geojson"

import {
  haversineDistance,
  extractCoordinatesFromGeoJSON,
  computeTrackDistance,
  computeElevationMinMax,
  computeBoundsRegion,
} from "../geoUtils"

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistance(40, -74, 40, -74)).toBe(0)
  })

  it("computes distance between NYC and LA (~3944 km)", () => {
    const d = haversineDistance(40.7128, -74.006, 34.0522, -118.2437)
    expect(d).toBeGreaterThan(3_900_000)
    expect(d).toBeLessThan(4_000_000)
  })

  it("computes short distance accurately", () => {
    // ~111 km per degree of latitude at equator
    const d = haversineDistance(0, 0, 1, 0)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe("extractCoordinatesFromGeoJSON", () => {
  it("extracts coordinates from a LineString", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [-74, 40],
              [-118, 34],
            ],
          },
        },
      ],
    }
    const coords = extractCoordinatesFromGeoJSON(fc)
    expect(coords).toHaveLength(2)
    expect(coords[0]).toEqual({ latitude: 40, longitude: -74 })
    expect(coords[1]).toEqual({ latitude: 34, longitude: -118 })
  })

  it("extracts coordinates from a MultiLineString", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiLineString",
            coordinates: [
              [
                [0, 0],
                [1, 1],
              ],
              [
                [2, 2],
                [3, 3],
              ],
            ],
          },
        },
      ],
    }
    const coords = extractCoordinatesFromGeoJSON(fc)
    expect(coords).toHaveLength(4)
    expect(coords[0]).toEqual({ latitude: 0, longitude: 0 })
    expect(coords[3]).toEqual({ latitude: 3, longitude: 3 })
  })

  it("extracts coordinates from a Point", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-74, 40] },
        },
      ],
    }
    const coords = extractCoordinatesFromGeoJSON(fc)
    expect(coords).toHaveLength(1)
    expect(coords[0]).toEqual({ latitude: 40, longitude: -74 })
  })

  it("returns empty array for empty FeatureCollection", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [],
    }
    expect(extractCoordinatesFromGeoJSON(fc)).toEqual([])
  })
})

describe("computeTrackDistance", () => {
  it("computes distance for a simple LineString", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [0, 1],
            ],
          },
        },
      ],
    }
    const d = computeTrackDistance(fc)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })

  it("returns 0 for empty features", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [],
    }
    expect(computeTrackDistance(fc)).toBe(0)
  })
})

describe("computeElevationMinMax", () => {
  it("extracts min/max elevation from 3D coordinates", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0, 100],
              [1, 1, 500],
              [2, 2, 200],
            ],
          },
        },
      ],
    }
    const result = computeElevationMinMax(fc)
    expect(result).toEqual({ min: 100, max: 500 })
  })

  it("returns null when no elevation data", () => {
    const fc: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      ],
    }
    expect(computeElevationMinMax(fc)).toBeNull()
  })
})

describe("computeBoundsRegion", () => {
  it("computes correct region for coordinates", () => {
    const coords = [
      { latitude: 40, longitude: -74 },
      { latitude: 34, longitude: -118 },
    ]
    const region = computeBoundsRegion(coords)
    expect(region).not.toBeNull()
    expect(region!.latitude).toBe(37)
    expect(region!.longitude).toBe(-96)
    expect(region!.latitudeDelta).toBeGreaterThan(0)
    expect(region!.longitudeDelta).toBeGreaterThan(0)
  })

  it("returns null for empty coords", () => {
    expect(computeBoundsRegion([])).toBeNull()
  })

  it("handles single coordinate with minimum delta", () => {
    const region = computeBoundsRegion([{ latitude: 40, longitude: -74 }])
    expect(region).not.toBeNull()
    expect(region!.latitudeDelta).toBe(0.005)
    expect(region!.longitudeDelta).toBe(0.005)
  })
})
