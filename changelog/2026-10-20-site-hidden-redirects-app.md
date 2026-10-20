# Hidden site pages redirect to the app

With the marketing site hidden in production, every `(site)` route, including `/`, answered 404, so oh.feega.app showed a dead page. The gate now answers 303 to `/app`.
