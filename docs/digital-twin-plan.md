# MoryonGo Digital Twin: Integration Plan

## 1. Existing architecture
- React 18, TypeScript, Vite 5, Tailwind CSS, React Router, packaged for Android with Capacitor.
- Backend is Supabase (Postgres, Auth, RLS, edge functions, storage). The client is in `src/lib/supabase.ts`.
- Feature logic lives in `src/lib/*.ts`; screens live in `src/pages/`; shared UI lives in `src/components/`.

## 2. Existing mapping technology
- No map library is installed. The transport map page renders Supabase-backed locations and routes directly.
- Detail pages embed OpenStreetMap links or iframes. These stay unchanged.

## 3. CesiumJS approach
- Dependency: `cesium` (1.146) with `vite-plugin-static-copy` 3.4 (Vite 5 compatible).
- `vite.config.js` copies Cesium's Workers, ThirdParty, Assets and Widgets into `dist/cesium` and sets `CESIUM_BASE_URL` to `./cesium`, so it works under the app's relative base path and inside the Capacitor Android wrapper.
- Cesium is loaded only with a dynamic import when the 3D Globe option is opened on the transport map page. It ships as its own chunk (about 5 MB before compression), and the main app bundle grows by only a few kilobytes.
- Satellite imagery and terrain use Cesium ion and need a token. The token can be pasted into the globe's key panel (saved in that browser only) or set as `VITE_CESIUM_ION_TOKEN` for the project. Without either, the globe shows a basic offline world map. 3D Tiles are not configured yet.

## 4. Supabase compatibility (planned, no tables created yet)
- Existing `locations`, `routes`, `route_geometry` and `destinations` tables already hold coordinates. The Digital Twin will read these rather than duplicate them.
- Municipality boundaries are stored in `municipality_boundaries` (public read-only, seeded from geoBoundaries ADM3 for the six Marinduque municipalities). Routes and stops are read through the existing transport map queries.
- Future additions: barangay boundaries, a geographic layer registry (layer kind, source, verification status), and 3D model references pointing to Supabase Storage objects.
- All new tables will follow the existing RLS pattern: public read of verified records, admin write, and new submissions routed through the verification workflow.

## 5. Required external configuration
- `VITE_CESIUM_ION_TOKEN` (optional): needed for Cesium ion imagery, terrain and hosted 3D Tiles.
- Municipality outlines are from geoBoundaries (2020) and are approximate. They should be checked against official PSA or LGU maps before any legal or planning use.
- Still not sourced: barangay boundaries, a terrain source, and building or road data. Sources must be verified before import.

## 6. Potential compatibility problems
- Cesium's bundle is large. It must stay behind a lazy import.
- Cesium uses Web Workers. Capacitor's WebView must load them from the same origin, which the copied `cesium/` folder provides.
- Low-end Android devices may struggle with WebGL; a fallback 2D view is required.

## 7. Performance considerations
- Lazy-load Cesium, cap the request rate for terrain and tiles, and render only visible municipality layers.
- Keep geographic queries server-side with pagination and bounding-box filters.

## 8. Files changed in this stage
- `package.json`, `package-lock.json` (new dependencies)
- `vite.config.js` (Cesium asset copy and base URL)
- `vite.config.ts` (unchanged content, kept in sync with the original)
- `src/lib/digitalTwin/config.ts` (configuration only; no data)
- `src/vite-env.d.ts`, `.env.example`, `README.md`

## 9. Implementation stages
1. Stage 2 (implemented as a 3D Globe option on the transport map page): lazy-loaded globe with loading, error and retry states, zoom, reset, 2D/3D toggle, full screen, a Cesium token panel, Marinduque municipality outlines, and commuter routes and stops read from the database. Routes show an empty state until route data is published. The globe has not been tested in a browser.
2. Stage 3: Barangay boundaries, verified-only layer filtering, and admin tools for boundary data.
3. Stage 4: 3D buildings and 3D Tiles from approved sources.
4. Stage 5: Vehicle visualization, GPS tracking, pedestrian simulation, and 3D navigation.
