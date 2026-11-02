# Project memory

## Product intent & audience

- Vite + React app with an Android build target (`com.moryongo.app`), likely mobile-first and intended for Android distribution.
- Uses Supabase for authentication, database, storage, and Edge Functions.
- Includes Mory AI (OpenAI-powered) and weather functionality (OpenWeather).

## Brand personality & voice

- Not yet established.

## Visual design & UX direction

- No established design system, UI framework, or visual direction observed.
- Mory AI and weather are represented as distinct app screens/features.
- Preserve existing functionality and UI while making infrastructure/configuration changes.

## Decisions, constraints & rationale

- The Supabase client already consumes the production Supabase URL and public anon key through Vite build-time variables; no application-code change was required for the requested credential flow.
- Existing Supabase URL and anon key must remain unchanged. They must not be committed to GitHub, embedded in source, or exposed in build logs.
- `.env` should not be included in the release source uploaded to SwapLab.
- `npm run build` passes with the current project state. No files were changed during the attempted SwapLab configuration work.
- SwapLab Public Builder documentation was checked; its documented inputs are project ZIP/public Git URL, framework type, and build image. No verified custom secret or build-time environment-variable mechanism was found.
- Because Public Builder’s injection mechanism is unverified, removing `.env` from the upload without another injection path would produce a build without Supabase configuration.
- Required deployment values, when supported by the build service, are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Current Supabase secrets remain configured on Supabase: `OPENAI_API_KEY` for Mory AI and `OPENWEATHER_API_KEY` for weather Edge Functions.
- Do not modify Android package ID, JKS, signing credentials, or application behavior.
- Android release signing SHA-1: `47:B2:D6:B2:2A:F8:54:84:31:1B:A4:D7:EC:23:14:3A:9C:6C:20:F4`. It is currently documentation-only because Google sign-in/Maps integration is not implemented.
- If Play App Signing is enabled, Google services require the Play Console app-signing SHA-1 rather than necessarily the local keystore fingerprint.

## Open questions & assumptions

- Does SwapLab Public Builder support private/custom environment secrets or build-time variables through undocumented support, a private builder, or another workflow?
- If SwapLab supports injection, where exactly should `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` be configured, and are values masked from logs?
- If using the Git URL workflow, verify `.env` has never been committed with `git log --all -- .env`; `.gitignore` alone does not remove historical exposure.
- Until SwapLab provides a verified injection path, release upload configuration remains blocked if `.env` must be excluded.
- Is Play App Signing enabled?
- What are the release keystore alias/password details and storage location?
- Are the OpenAI and OpenWeather keys valid in live calls? Code reads the configured secret names, but provider-side validation has not been performed.