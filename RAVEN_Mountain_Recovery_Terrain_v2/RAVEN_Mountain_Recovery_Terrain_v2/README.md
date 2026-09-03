# RAVEN-RX Mountain Recovery Terrain v2

A standalone 3D terrain prototype for reviewing the RAVEN-RX Mountain Recovery scenario before integration into the main RAVEN dashboard.

## What is fixed in v2

- Black asphalt roads with white center dashes and white edge lines.
- Route A, Route B and Route C all have physical road surfaces.
- Road markings are generated from the exact same spline as the road.
- Truck follows the road centerline rather than independent waypoint coordinates.
- Smooth heading follows the road tangent.
- Lateral correction keeps the truck centered.
- Curved turns use spline geometry rather than hard waypoint corners.
- Trees are procedurally placed only outside a road exclusion corridor.
- Tree scale is smaller and spacing is controlled.
- Rocks/props also respect the road corridor.
- Mountain Recovery scenario physically reverses along Route A, reaches the safe junction, then enters Route B.
- No vehicle teleport between routes.
- Deterministic 4–5 minute demonstration.
- Camera follows the truck while showing the upcoming terrain.

## Run locally

1. Install Node.js 20+.
2. Open this folder in a terminal.
3. Run:
   `npm install`
4. Run:
   `npm run dev`
5. Open the Vite URL.

## Review

Use:
- Start Demonstration
- Jump to Recovery
- Reset

This version is intentionally standalone. It has not been pushed into the main RAVEN repository.
