# Native shell can load a bundled dashboard

ADR 0009 option (d), step 3, for the dashboard and login. `npm run build:native` builds the
dashboard and login as a static SPA (`apps/native/bundle-dist`) that talks to the hosted API; the
canvas stays hosted and opens signed in through a one-time handoff link. Details, routing and
what was verified are in the ADR's "(d) in practice" section.

Also fixed on the way: the iOS shell's user agent made the login page treat it as an in-app
browser and hide OAuth.
