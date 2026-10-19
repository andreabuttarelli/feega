# feega mobile

Capacitor shell for iPhone, iPad and (later) Android: the feega web UI in one WebView, plus a few
native plugins (ADR 0018). Desktop stays on Tauri (`apps/native`). Not part of the npm workspace or
CI.

```
ios/App            Xcode project (SceneDelegate → FeegaBridgeViewController)
ios/FeegaKit       FeegaCore (deep links, perf sample, footprint; `swift test`) and
                   FeegaShell (bridge controller, FeegaPerf and FeegaAppleSignIn plugins)
android/           Capacitor scaffold
```

## Build for the simulator

```bash
cd apps/mobile
npm install
bash scripts/vendor-capacitor.sh   # Capacitor xcframeworks as a local package (SwiftPM's own
                                   # binary download hangs here; Xcode uses this as an override)
npm run bundle                     # static build into www
npm run wire                       # once, and again if `npx cap sync` rewrote the project
npm run ios:sim                    # unsigned simulator build in build/ios
(cd ios/FeegaKit && swift test)
rm -rf build                       # builds are ~1 GB
```

The shell serves the static build from `www` (`FeegaWebSource = bundle` in `Info.plist`). Make it
before building the app: `npm run bundle` (`FEEGA_API=<api host>`, default `https://oh.feega.app`,
which has the endpoints only after a dev → main release; for a local API run the dev server with
`API_EXTRA_ORIGINS` and pass `FEEGA_API=http://localhost:<port>`). `www` is not committed.
`FeegaWebSource = hosted` loads `FeegaWebURL` instead. Debug builds take `FEEGA_DEMO_EMAIL`,
`FEEGA_DEMO_PASSWORD` and `FEEGA_DEMO_PATH=first` from the launch environment to sign in and open
the first canvas (simulator screenshots). A debug build takes
`FEEGA_WEB=<url>` from the launch environment (`SIMCTL_CHILD_FEEGA_WEB=…` with `simctl launch`).

## Install the debug build on your own iPhone (free Apple ID, no paid account)

1. Xcode → Settings → Accounts → `+` → Apple ID. A "Personal Team" appears.
2. Open `ios/App/App.xcodeproj`.
3. Target **App** → Signing & Capabilities: tick "Automatically manage signing", Team = your
   Personal Team, and change Bundle Identifier to something unique, e.g. `app.feega.mobile.<you>`.
4. Plug in the iPhone, unlock it, trust the Mac. On iOS 16+ enable Settings → Privacy & Security →
   Developer Mode and restart.
5. Pick the iPhone as run destination, press Run (⌘R).
6. First launch is refused: Settings → General → VPN & Device Management → your Apple ID → Trust.
7. A free-team build expires after 7 days; press Run again. Max 3 apps per device.

Sign in with Apple and in-app purchases need the paid Apple Developer Program.

## Performance probe

iOS Settings app → feega → **Performance probe**, then reopen feega. A small chip at the top shows
fps and app memory. Tap it for the full report, with a Copy button:

- time to canvas revealed (`[data-canvas-surface][data-revealed="true"]`) and interactive (next
  frame), in ms since navigation start;
- fps over the last second and the minimum since reveal (pan, zoom or play to load it);
- long frames (> 50 ms) and the worst frame;
- JS heap (`performance.memory`; WebKit doesn't expose it, so it reads n/a on iOS);
- app memory footprint (`phys_footprint`). The WebView's content process is separate and is not
  included;
- web content process terminations, each recovered by a reload.

The page can read the footprint itself: `Capacitor.Plugins.FeegaPerf.footprint()`.
