# Project memory

## Product intent & audience

- Vite + React app with an Android build target (package `com.moryongo.app`).
- Likely a mobile-first web app intended to be wrapped/built for Android distribution.
- App includes a Supabase backend with edge functions.
- Features include "Mory AI" (OpenAI-powered) and a weather feature (OpenWeather).

## Brand personality & voice

- Not yet established.

## Visual design & UX direction

- Not yet established; no design system or UI framework references observed.
- App has distinct screens for Mory AI and weather functionality.

## Decisions, constraints & rationale

- Android release signing SHA-1 fingerprint is `47:B2:D6:B2:2A:F8:54:84:31:1B:A4:D7:EC:23:14:3A:9C:6C:20:F4`; recorded in README under "Release Signing Certificate."
- No Google sign-in or Google Maps integration implemented yet; the fingerprint is documentation-only until one of those is added.
- Assistant cannot register the fingerprint with Google Cloud Console or Play Console; user must do that manually.
- If Play App Signing is enabled, the Play Console "App integrity" SHA-1 (different from the local keystore one) is what Google services require.
- Supabase secrets configured: `OPENAI_API_KEY` (for Mory AI) and `OPENWEATHER_API_KEY` (for weather feature). Both are read by edge functions using these exact names.
- Secrets live on the Supabase project, not in the downloaded project files. They keep working as long as the app points to the same Supabase project.
- README was corrected: weather key was previously listed under the wrong name.
- Live validation of key acceptance by OpenAI/OpenWeather not performed; user must test via app screens.

## Open questions & assumptions

- Is Play App Signing enabled for this app? Determines which SHA-1 to register with Google services.
- Will Google sign-in, Maps, or another Google API be added next? The fingerprint currently has no functional effect.
- What is the release keystore alias/password setup, and where is the keystore file stored? Not yet documented.
- Is there an existing Google Cloud Console project / OAuth client configured for `com.moryongo.app`?
- Are the API keys themselves valid/active on the provider side (OpenAI, OpenWeather)? Code reads them but live calls haven't been verified.