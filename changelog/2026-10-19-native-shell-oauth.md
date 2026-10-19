# The iOS shell is not an in-app browser

`detectInAppBrowser` flagged the Tauri iOS shell as an embedded webview: its user agent carries
`AppleWebKit` without `Safari`. The login page then opened on sign-up and the Google/GitHub
buttons showed "open in your browser" instead of starting OAuth, so the `feega://auth/callback`
flow of ADR 0009 never ran. The shell sends `FeegaNative/` and already hands off-origin
navigations to the system browser, so it is now excluded by `isNativeShell`.

Found while testing the shell in the iPad and iPhone simulators.
