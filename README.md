# FieldWise

**PS CX0908 — "The Drone That Flew Blind"**

Field-mapping and spray-path planning that treats a satellite boundary as a
dated *prior*, not ground truth. The pilot corrects it in the field with
lightweight GPS-backed deltas — walk a missed strip, tap a crop-row heading
— and the spray path re-plans client-side in about a second. A flight only
clears when every boundary edge is verified or its risk explicitly
accepted.

## Status

Scaffolded. Building incrementally: scaffold → geometry core → map UI →
correction flow → vehicle link → simulator/replay → exports/polish.

## Stack

- React + TypeScript + Vite, Tailwind v4 (CSS-first config, see `src/index.css`)
- MapLibre GL, Turf.js, proj4, polygon-clipping — all client-side geometry
- Zustand for app state
- Web Serial API for direct-USB MAVLink to a Pixhawk (no companion computer required)

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Project layout

```
src/
  lib/geo/        domain types, projection, planner, provenance, readiness (pure functions)
  lib/vehicle/     VehicleLink interface + implementations (Sim, WebSerial, later Pi relay)
  lib/export/      GeoJSON/KML/QGC/Mission Planner/CSV/handoff-sheet exporters
  store/           Zustand store — app/session state only, no derived geometry
  components/layout/  app shell, stepper, readiness gate
  components/map/     MapLibre boundary/path rendering
  components/panels/  one panel per workflow step (import/verify/plan/simulate/send)
```
