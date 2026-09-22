import type { StyleSpecification } from 'maplibre-gl'

/**
 * Esri World Imagery — chosen specifically because it needs no API key or
 * signup. That matters twice over here: a solo 2-day build has no time
 * for key-provisioning friction, and judges opening a shared demo link
 * shouldn't hit a blank map because a key wasn't set up for them.
 * Attribution is required and is surfaced via MapLibre's attribution
 * control.
 */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
}
