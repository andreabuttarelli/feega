# Desktop app icon: orange Feega logo

`apps/desktop/build/icon.{icns,ico,png}` now show `static/favicon.svg` (#FF5100, untouched) centred
on plain white at ~58% of the icon width. Same paths, no build config change.

All sizes come from one 1024 master rendered from the SVG. `vscode/icon.png` is the extension's
own icon and is left as is.
