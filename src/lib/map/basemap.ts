import type { StyleSpecification } from 'maplibre-gl'
import { TILE_PROTOCOL } from './resilientSatelliteTiles'

export const SATELLITE_SOURCE_ID = 'satellite'
export const SATELLITE_LAYER_ID = 'satellite'

/**
 * Esri World Imagery — chosen specifically because it needs no API key or
 * signup. That matters twice over here: a solo 2-day build has no time
 * for key-provisioning friction, and judges opening a shared demo link
 * shouldn't hit a blank map because a key wasn't set up for them.
 * Attribution is required and is surfaced via MapLibre's attribution
 * control.
 *
 * The tile URL points at the fwsat:// custom protocol (see
 * resilientSatelliteTiles.ts), not Esri directly — that layer handles
 * session-long caching and falling back to a different provider when
 * Esri errors or serves its "not yet available" placeholder, entirely
 * transparently to this style definition.
 */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    [SATELLITE_SOURCE_ID]: {
      type: 'raster',
      tiles: [`${TILE_PROTOCOL}://{z}/{x}/{y}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics · OpenStreetMap contributors (backup)',
    },
  },
  layers: [{ id: SATELLITE_LAYER_ID, type: 'raster', source: SATELLITE_SOURCE_ID }],
}
