# feega_motion

Embed an interactive [feega](https://feega.app) motion video in a Flutter app. It runs the same
hosted player as the web embed inside a WebView, so the experience is the same on every
platform: Android, iOS and macOS.

```bash
flutter pub add feega_motion
```

```dart
import 'package:feega_motion/feega_motion.dart';

FeegaMotion(id: '<video id>', origin: 'https://oh.feega.app')
```

- **Fills its constraints.** With unbounded height (a `ListView` child) it takes the video ratio;
  a scrub video builds a scroll story of its saved length, pinned while the list scrolls.
- **Scroll progress** is computed in Dart from the enclosing `Scrollable` (or `scrollController`)
  and posted to the player.
- **Tilt** (`tilt: true`) reads the accelerometer through `sensors_plus` on Android and iOS.
- **Links** open in the external browser through `url_launcher`, or go to `onLinkClick`.
- **Pauses** off-screen (`visibility_detector`) and when the app goes to the background.
- **Reduced motion** follows `MediaQuery.disableAnimations`.
- `FeegaMotionController` plays, pauses and seeks.

Protocol: [`docs/embed-protocol.md`](../../docs/embed-protocol.md).

## Platform setup

- macOS: add `com.apple.security.network.client` to both entitlements files.
- Android: `INTERNET` permission (present by default in debug only).

## Offline

Not built yet. The player page loads its runtime and assets by URL, so saving `/e/<id>` alone
would not play offline. The next step is a cached bundle: download the page plus every URL it
references into app storage and `loadFile` it, refreshing when the published revision changes.

## Example

```bash
cd example
flutter run -d macos   # or an iOS simulator / Android emulator
flutter test integration_test -d macos --dart-define=FEEGA_ORIGIN=https://oh.feega.app
```

## Publish

```bash
flutter pub publish --dry-run
flutter pub publish
```
