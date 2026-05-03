# MetroMate Bengaluru

A polished offline-first Bengaluru metro route planner built with React, Vite, TypeScript, and Capacitor.

## What Works

- Offline route planning for Purple, Green, and Yellow lines.
- Approximate fare, time, stop count, board direction, and interchange guidance.
- Journey mode with estimated current station and manual previous/next controls.
- Recent routes, favorites, and language preference stored on device.
- Interactive schematic map with route highlighting, station search, current/nearest station markers, zoom, and pinch gestures.
- First-run location prompt, repeat permission request from the nearest-station action, and manual station fallback.
- MetroMate branding, generated app icons, native Android splash assets, store feature graphics, manifest icons, and mobile-safe typography.
- UI language options for English, Kannada, Hindi, Tamil, Telugu, and Malayalam.
- Android Capacitor project with geolocation support.
- iOS Capacitor project with geolocation support.
- Fastlane lanes for Android AAB builds, iOS App Store Connect setup, signed iOS IPA builds, TestFlight upload, metadata, and screenshots.

## Commands

```bash
npm run dev
npm run validate:data
npm run test
npm run lint
npm run build
npm run brand:assets
npm run store:screenshots
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Store and Release

Brand and store images are regenerated with:

```bash
npm run brand:assets
```

Generated assets include Android icons/splash resources, PWA icons, Google Play feature graphic, Google Play icon, and iOS 1024 app icon. Store text and Fastlane lanes live in `fastlane/`.
Store screenshots are regenerated from real browser captures with:

```bash
npm run store:screenshots
```

Fastlane is scaffolded but not installed by default:

```bash
bundle install
bundle exec fastlane android metadata
bundle exec fastlane android internal
bundle exec fastlane ios api_create
bundle exec fastlane ios metadata
bundle exec fastlane ios build
bundle exec fastlane ios upload
```

Copy `fastlane/.env.example` to `fastlane/.env` and fill in real Play Console/App Store credentials plus support, marketing, and privacy URLs before uploading metadata.

## Data Updates

Core data lives in `src/data/metro.json`. App behavior does not require Firebase or any backend.

When metro data changes:

1. Update `src/data/metro.json`.
2. Run `npm run validate:data`.
3. Run `npm run test && npm run build`.
4. Run `npx cap sync android`.
5. Build and publish the updated Android release.

The starter dataset is marked with `dataVersion` and source notes in Settings. Fares and coordinates should be re-verified before a public production release.
