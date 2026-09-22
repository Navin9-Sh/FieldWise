/**
 * Pure conversions from FieldWise domain objects to GeoJSON the map layer
 * can render. Kept separate from FieldMap.tsx so the mapping logic can be
 * reasoned about (and, if useful later, tested) without touching MapLibre.
 */
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import type { LocalProjection } from '@/lib/geo/projection'
import type { FieldBoundary, LatLng, NoSprayZone, SprayPlan } from '@/lib/geo/types'

function ringCoords(vertices: LatLng[]): [number, number][] {
  const coords: [number, number][] = vertices.map((v) => [v.lon, v.lat])
  coords.push(coords[0])
  return coords
}

export function boundaryToPolygonFeature(boundary: FieldBoundary): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: { id: boundary.id },
    geometry: { type: 'Polygon', coordinates: [ringCoords(boundary.vertices)] },
  }
}

/** One LineString feature per boundary edge — this is what's individually clickable/selectable on the map. */
export function boundaryEdgesToFeatureCollection(boundary: FieldBoundary): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: boundary.edges.map((edge) => {
      const a = boundary.vertices[edge.fromIndex]
      const b = boundary.vertices[edge.toIndex]
      return {
        type: 'Feature',
        properties: { edgeId: edge.id, provenance: edge.provenance.kind },
        geometry: {
          type: 'LineString',
          coordinates: [
            [a.lon, a.lat],
            [b.lon, b.lat],
          ],
        },
      }
    }),
  }
}

export function zonesToFeatureCollection(zones: NoSprayZone[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: zones.map((zone) => ({
      type: 'Feature',
      properties: { id: zone.id, label: zone.label },
      geometry: { type: 'Polygon', coordinates: [ringCoords(zone.vertices)] },
    })),
  }
}

export function latLngPointFeature(point: LatLng): Feature<Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
  }
}

export function latLngLineFeature(points: LatLng[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) },
  }
}

/**
 * Splits a spray plan's passes into two FeatureCollections — spray legs
 * (drawn solid) and transit legs (drawn dashed) — per the rule that these
 * must always be visually distinguishable, not just data-distinguishable.
 */
export function sprayPlanToFeatureCollections(
  plan: SprayPlan,
  projection: LocalProjection,
): { spray: FeatureCollection<LineString>; transit: FeatureCollection<LineString> } {
  const sprayFeatures: Feature<LineString>[] = []
  const transitFeatures: Feature<LineString>[] = []

  for (const sortie of plan.sorties) {
    for (const pass of sortie.passes) {
      const start = projection.toLatLng(pass.start)
      const end = projection.toLatLng(pass.end)
      const feature: Feature<LineString> = {
        type: 'Feature',
        properties: { sortie: sortie.index, spraying: pass.spraying },
        geometry: {
          type: 'LineString',
          coordinates: [
            [start.lon, start.lat],
            [end.lon, end.lat],
          ],
        },
      }
      ;(pass.spraying ? sprayFeatures : transitFeatures).push(feature)
    }
  }

  return {
    spray: { type: 'FeatureCollection', features: sprayFeatures },
    transit: { type: 'FeatureCollection', features: transitFeatures },
  }
}

export function boundsOfLatLng(points: LatLng[]): [[number, number], [number, number]] {
  const lons = points.map((p) => p.lon)
  const lats = points.map((p) => p.lat)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

export const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }
