# Store Release Checklist

## Local Assets

- App ID / bundle ID: `app.nammametro.offline`
- App name: `MetroMate Bengaluru`
- Android AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Google Play graphics:
  - Icon: `fastlane/metadata/android/en-US/images/icon.png`
  - Feature graphic: `fastlane/metadata/android/en-US/images/featureGraphic.png`
  - Phone screenshots: `fastlane/metadata/android/en-US/images/phoneScreenshots`
  - 7-inch tablet screenshots: `fastlane/metadata/android/en-US/images/sevenInchScreenshots`
  - 10-inch tablet screenshots: `fastlane/metadata/android/en-US/images/tenInchScreenshots`
- App Store screenshots: `fastlane/screenshots/ios/en-US`

## Google Play Console

Create the app in Play Console manually first. Google Play requires account-specific declarations that should be reviewed by the account owner.

- Default language: English (United States)
- App or game: App
- Free or paid: Free
- Contact email: use your real support email
- Declarations: review and accept Developer Program Policies, US export laws, and Play App Signing terms
- Main store listing: upload from `fastlane/metadata/android/en-US`
- Data safety: location is used for nearest-station assistance; app works offline and stores preferences/recent routes locally
- Content rating: likely Travel & Local / Maps & Navigation style questionnaire, no user-generated content
- Target API: Android target SDK is configured as 36

After the app exists and service-account access is configured:

```bash
SUPPLY_VALIDATE_ONLY=true bundle exec fastlane android metadata
bundle exec fastlane android internal
```

## App Store Connect

Before running Fastlane, make sure the bundle ID `app.nammametro.offline` exists in Apple Developer Certificates, Identifiers & Profiles and the latest agreements are accepted.

- Platform: iOS
- Name: MetroMate Bengaluru
- Primary language: English
- Bundle ID: `app.nammametro.offline`
- SKU: `metromate-bengaluru`
- Category: Navigation or Travel
- Price: Free
- App privacy: location is used for nearest-station assistance; no account required; recent routes/preferences are stored on device

Fill `fastlane/.env` from `fastlane/.env.example`, especially:

- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_PATH`
- `SUPPORT_URL`
- `MARKETING_URL`
- `PRIVACY_URL`

Then:

```bash
bundle exec fastlane ios create
bundle exec fastlane ios metadata
bundle exec fastlane ios build
```

The iOS archive currently stops until `APPLE_TEAM_ID` / signing is configured in Xcode or passed through Fastlane.

## Review Timing

There is no safe way to fast-track public App Store or Google Play review from the app code. The practical fast path is:

- Use Google Play internal testing first.
- Use TestFlight first.
- Complete privacy/data safety forms accurately on the first submission.
- Avoid claims like rankings, limited-time pricing, or guaranteed GPS accuracy in screenshots and descriptions.
