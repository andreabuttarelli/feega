# Desktop app is named Feega, with the new icon

Signal: the Electron app showed `feega` lowercase in the window title,
the mac menu and About, and the installer names, with the old icon.

Change: `productName` and window title are `Feega`; installers and
`Feega.app` follow it. The icon set in `apps/desktop/build/` is rebuilt
from the 400px brand frame: macOS `icon.icns` on Apple's 1024 grid
(824px body, 185px radius), Windows `icon.ico` and Linux `icon.png`
(512, full square).

Kept: appId `app.feega.desktop` and the `feega://` protocol. Changing
either breaks OS registration of deep links and updater identity.
