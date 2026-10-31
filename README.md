# MoryonGo

A commuter and travel application for Marinduque, Philippines — covering all six municipalities (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos). Built with React, Vite, Tailwind CSS, and Supabase.

## Architecture

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Mobile:** Capacitor (Android wrapper for Play Store deployment)
- **Maps:** OpenStreetMap-based interactive transport map
- **AI:** Mory AI assistant (edge function proxy)
- **Weather:** Weather proxy edge function

## Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Home Dashboard | Implemented |
| 2 | Route Planner | Implemented |
| 3 | Fare Calculator | Implemented |
| 4 | Fare Updates & Live Fare Tracker | Implemented |
| 5 | Fare Matrix | Implemented |
| 6 | Passenger Discount System | Implemented |
| 7 | Jeepney Routes | Implemented |
| 8 | Tricycle Routes & Fare Zones | Implemented |
| 9 | Ports, Ferry & RORO Routes | Implemented |
| 10 | Boat & Island Routes | Implemented (via sea transport module) |
| 11 | Interactive Transport Map | Implemented |
| 12 | Saved Places & Favorite Locations | Implemented |
| 13 | Saved Routes & Favorite Trips | Implemented |
| 14 | Mory AI Commuter Assistant | Implemented (requires API key) |
| 15 | Community Transport Reports | Implemented |
| 16 | Fare Concern & Violation Reports | Implemented |
| 17 | Weather Information | Implemented (requires API key) |
| 18 | Transport Alerts | Implemented |
| 19 | Explore Marinduque | Implemented |
| 20 | Culture & Events | Implemented |
| 21 | Nearby Places & Services | Implemented |
| 22 | Emergency Information & Assistance | Implemented |
| 23 | Offline Mode & Low-Connectivity | Implemented (partial — cache for public data) |
| 24 | User Profile & Account Settings | Implemented |
| 25 | Trip History & Journey Records | Implemented |
| 26 | Driver & Transport Operator Portal | Implemented |
| 27 | Admin Dashboard & Management | Implemented |
| 28 | Data Verification & Quality Control | Partial (dashboard and review queue exist; summary RPC, server-side pagination, atomic reviews, filters, export, and tests are pending) |
| 29 | Tourist Trip Planner | Implemented |
| 30 | Total Trip Cost Calculator | Implemented |
| 31 | Share Trip & Journey Details | Implemented |

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview production build
```

## Android (Capacitor)

The app is wrapped with Capacitor for Android. The native project lives in `android/`.

### Prerequisites

- Android Studio (latest)
- JDK 17+
- Android SDK (API 24+ minimum, API 36 target)

### Build and open in Android Studio

```bash
npm run android    # builds web app, syncs to Android, opens Android Studio
```

Or step by step:

```bash
npm run cap:sync   # build web + copy to android
npm run cap:open   # open project in Android Studio
```

### Generating a release AAB for the Play Store

1. In Android Studio: Build > Generate Signed Bundle / APK
2. Select "Android App Bundle (.aab)"
3. Create or select your keystore
4. Select the `release` build variant
5. Build

Or from the command line:

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at `android/app/build/outputs/bundle/release/app-release.aab`.

### Android Permissions

The following permissions are declared in `AndroidManifest.xml`:

| Permission | Purpose |
|-----------|---------|
| INTERNET | Supabase, maps, weather, AI APIs |
| ACCESS_NETWORK_STATE | Offline detection |
| ACCESS_FINE_LOCATION | Transport map, nearby places |
| ACCESS_COARSE_LOCATION | Approximate location |
| CAMERA | Report evidence, profile photos |
| READ_EXTERNAL_STORAGE | File uploads (Android < 13) |
| READ_MEDIA_IMAGES | Image access (Android 13+) |
| READ_MEDIA_VIDEO | Video access (Android 13+) |
| VIBRATE | Haptic feedback |

### App ID

- **Package:** `com.moryongo.app`
- **App name:** MoryonGo

### Release Signing Certificate

- **SHA-1 fingerprint:** `47:B2:D6:B2:2A:F8:54:84:31:1B:A4:D7:EC:23:14:3A:9C:6C:20:F4`

Register this fingerprint for the `com.moryongo.app` Android app in Google Cloud Console (OAuth Android client or restricted Maps key) and in Play Console. If the app uses Play App Signing, use the app signing certificate SHA-1 shown under Play Console > App integrity, which can differ from the upload key used to build the AAB.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only — never in frontend) |
| `VITE_CESIUM_ION_TOKEN` | Optional. Cesium ion token for 3D globe imagery and terrain |

Edge function secrets (configured via Supabase dashboard):
- `OPENAI_API_KEY` — for Mory AI assistant
- `OPENWEATHER_API_KEY` — for weather proxy (OpenWeatherMap or similar)

## Supabase Setup

### Migrations

Migrations are in `supabase/migrations/` and are applied automatically by the Supabase MCP tool. To apply manually:

```bash
supabase db push
```

Key migrations:
- `0001`–`0031`: Feature tables (routes, fares, reports, alerts, etc.)
- `0032`: Security fixes — converted SECURITY DEFINER views to security_invoker, revoked EXECUTE on trigger functions from anon
- `0033`: Added indexes on 95 unindexed foreign keys for query performance

### Row Level Security

All tables have RLS enabled. Policies enforce:
- Users can only access their own saved places, routes, trip history, and shared trips
- Public visitors can view only published/approved transport data
- Operators can manage their own submissions but not approve them
- Admins can access review dashboards and publish official data
- Share links are validated server-side via `get_shared_trip()` SECURITY DEFINER function

### Authentication

Email/password authentication via Supabase Auth. Roles are determined by profile fields:
- `is_admin` — admin dashboard access
- `is_community_reviewer` — community report moderation
- `is_alert_admin` — transport alert management

## External Services

| Service | Required? | Configuration |
|---------|-----------|---------------|
| Supabase | Required | Pre-configured in `.env` |
| OpenAI API | Optional | For Mory AI — set `OPENAI_API_KEY` in edge function secrets |
| Weather API | Optional | For weather — set `OPENWEATHER_API_KEY` in edge function secrets |

If API keys are not configured, the AI and weather features display an appropriate "unavailable" message rather than crashing.

## Web Deployment

This is a Vite SPA deployed to any static host:

1. Run `npm run build` — outputs to `dist/`
2. Deploy `dist/` to your hosting platform (Netlify, Vercel, Cloudflare Pages, etc.)
3. Ensure SPA fallback routing is configured (e.g., `_redirects` file for Netlify)
4. Set environment variables on your hosting platform
5. Configure Supabase auth redirect URLs to include your domain

### Web Deployment Checklist

- [ ] Environment variables set on hosting platform
- [ ] Supabase auth redirect URLs updated
- [ ] Edge function secrets configured (OPENAI_API_KEY, OPENWEATHER_API_KEY)
- [ ] Supabase storage bucket policies reviewed
- [ ] Domain HTTPS enabled
- [ ] All migrations applied

### Google Play Store Checklist

- [ ] Generate signed AAB (see Android section above)
- [ ] Create Play Store listing with app icon, screenshots, description
- [ ] Set content rating questionnaire
- [ ] Add privacy policy URL
- [ ] Configure Supabase auth redirect URLs to include `com.moryongo.app://`
- [ ] Test on at least one physical Android device
- [ ] Set app version code and version name in `android/app/build.gradle`

## Known Limitations

- **Real-world data:** Transport routes, fares, schedules, and operator details require verified real-world data entry. The schema supports verification status and source tracking — unverified data is labeled accordingly.
- **Offline mode:** Public reference data is cached; live maps, AI, and weather require connectivity.
- **PDF export:** Not implemented — use browser print functionality on the shared trip viewer page.
- **Push notifications:** Not implemented.
- **Deep links:** Share links open in the web viewer; native app deep linking is not configured.
- **Real-time GPS sharing:** Not implemented (intentionally excluded — requires separate consent and safeguards).

## Security Notes

- Service role key is never used in frontend code
- Share tokens are high-entropy random values stored as SHA-256 hashes
- Share link expiration and revocation are enforced server-side via database function
- All SECURITY DEFINER views use `security_invoker = true` to respect RLS
- Trigger functions have EXECUTE revoked from anon and authenticated roles
- 95 foreign key indexes added for query performance
