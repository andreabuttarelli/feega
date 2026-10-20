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

Sign in with Apple and real in-app purchases need the paid Apple Developer Program.

## In-app purchases without App Store Connect

`ios/App/App/Products.storekit` holds the 12 products (`feega_monthly_*` in one subscription
group, `feega_pack_*` consumables; a vitest keeps it equal to `src/lib/store-products.ts`). The
shared `App` scheme runs with it, so ⌘R in Xcode buys from it: Debug → StoreKit → Manage
Transactions refunds, expires or speeds up renewals.

Which store the paywall uses (`src/lib/native-bridge.ts`):

| Build | `PUBLIC_REVENUECAT_APPLE_KEY` | Store |
|---|---|---|
| any | set | RevenueCat SDK, `app_user_id` = org id → webhook → ledger |
| Debug | empty | `FeegaStoreKit` (StoreKit 2 direct, `appAccountToken` = org id); no webhook, so no credits |
| Release | empty | none: "purchases unavailable" |

Production switches by key alone; no code change.

`AppUITests/StorePurchaseUITests` walks the whole path on the simulator: paywall → buy pack and
plan from the `.storekit` file → RevenueCat-shaped webhook to a local dev server → balance and
"Current plan" in `/app/credits` → restore → refund. It skips without its environment:

```bash
# dev server: NATIVE_STORE_BILLING=on REVENUECAT_SANDBOX=accept REVENUECAT_WEBHOOK_SECRET=<s>
FEEGA_API=http://localhost:<port> npm run bundle
TEST_RUNNER_FEEGA_DEMO_SESSION='{"key":"sb-<ref>-auth-token","value":<session json>}' \
TEST_RUNNER_FEEGA_TEST_ORG=<test org id> \
TEST_RUNNER_FEEGA_WEBHOOK_URL=http://127.0.0.1:<port>/api/v1/webhooks/revenuecat \
TEST_RUNNER_FEEGA_WEBHOOK_SECRET=<s> TEST_RUNNER_FEEGA_SHOTS_DIR=<dir> \
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' -derivedDataPath build/ios \
  CODE_SIGNING_ALLOWED=NO test
```

Test account only (test@dazero.co): the run grants and then refunds, so the balance ends where it
started. `FEEGA_DEMO_SESSION` (Debug only) seeds the bundled app's Supabase session.

## Sign in with Apple

`App/App.entitlements` carries `com.apple.developer.applesignin`; `FeegaAppleSignIn` →
`{ identityToken }` → `?/appleIdToken` → `signInWithIdToken`. The plugin registers only with
`Info.plist FeegaAppleSignIn = on`; the web button follows `src/lib/apple-sign-in/visibility.ts`
(never on production hosts). The simulator cannot show the sheet for an unsigned build: it needs a
team and a signed-in Apple ID.

## What only the account owner can do

1. Apple Developer Program: enable *Sign in with Apple* on the App ID `app.feega.mobile`; set the
   team in Signing & Capabilities.
2. Supabase → Auth → Apple: add `app.feega.mobile` to the Client IDs.
3. Set `FeegaAppleSignIn = on` in `Info.plist` and `APPLE_SIGN_IN=on` on the server (preview first).
4. App Store Connect: app `app.feega.mobile`, the 12 products with the ids above, Paid Apps
   agreement, sandbox tester.
5. RevenueCat: App Store app `app.feega.mobile`, products, webhook to
   `/api/v1/webhooks/revenuecat` with a bearer secret; copy the public Apple SDK key.
6. Env: `PUBLIC_REVENUECAT_APPLE_KEY` (bundle build), `REVENUECAT_WEBHOOK_SECRET` (server),
   `NATIVE_STORE_BILLING=on` when the build ships to the store.

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
