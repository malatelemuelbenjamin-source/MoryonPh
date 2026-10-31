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
- Terrain, imagery and 3D Tiles are not configured yet. Cesium's default imagery requires a Cesium ion token (`VITE_CESIUM_ION_TOKEN`, optional). Without one, the globe falls back to a plain background.

## 4. Supabase compatibility (planned, no tables created yet)
- Existing `locations`, `routes`, `route_geometry` and `destinations` tables already hold coordinates. The Digital Twin will read these rather than duplicate them.
- Future additions, to be designed in Stage 2: a geographic layer registry (layer kind, source, verification status), boundary polygons for municipalities and barangays, and 3D model references pointing to Supabase Storage objects.
- All new tables will follow the existing RLS pattern: public read of verified records, admin write, and new submissions routed through the verification workflow.

## 5. Required external configuration
- `VITE_CESIUM_ION_TOKEN` (optional): needed for Cesium ion imagery, terrain and hosted 3D Tiles.
- Required geographic datasets (not yet sourced): official municipality and barangay boundary files, a terrain source, and building or road data. Sources must be verified before import; none has been added.

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
1. Stage 2 (implemented as a 3D Globe option on the transport map page): lazy-loaded globe with loading, error and retry states, zoom, reset, 2D/3D toggle, full screen, and an offline basic world map when no Cesium ion token is set.
2. Stage 3: Geographic data tables, boundary layers, and verified-only public read access.
3. Stage 4: 3D buildings and 3D Tiles from approved sources.
4. Stage 5: Vehicle visualization, GPS tracking, pedestrian simulation, and 3D navigation.
