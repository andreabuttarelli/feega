# Embed SDKs default to oh.feega.app

`feega.app` is the Framer homepage; `/e` and `/embed.js` live on `oh.feega.app`. The React and
Flutter SDKs defaulted to `https://feega.app`, so an embed without an explicit `origin` loaded the
homepage. Both constants now point at `https://oh.feega.app`, held by a test per package.
