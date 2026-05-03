fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android build

```sh
[bundle exec] fastlane android build
```

Build the Android release bundle after refreshing web and brand assets

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Upload Google Play listing metadata and generated store images only

### android internal

```sh
[bundle exec] fastlane android internal
```

Build and upload to Google Play internal testing

----


## iOS

### ios create

```sh
[bundle exec] fastlane ios create
```

Create the App Store Connect app record after bundle id exists

### ios build

```sh
[bundle exec] fastlane ios build
```

Build iOS with Capacitor after the native ios/ project exists

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Upload App Store Connect metadata only

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
