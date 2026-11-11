# Remove /new, restore root redirects

#1952 sent signed-out `/` and `/app` to a signed-out prompt page at `/new`; locally `localhost:5173`
landed there instead of `/app`. The user wanted `/new` gone.

- `/` and `/app` signed out go to `/login` again, as before #1952.
- The landing hero now hands off to `/app?prompt=…&kind=…&source=…&attach=…`. Signed out, the
  hook stores that query in `feega_home_draft` (httpOnly, 1 h) before redirecting to `/login`;
  `landingPath` spends it and returns `/app?<query>`. `/app` reads it with `handoffOf` and
  prefills the composer.
- Prefill only: the auto-send after login is gone, with the sessionStorage draft (`saveDraft`/
  `takeDraft`) that only `/new` wrote. Attached images do not travel; `attach=1` is kept in the
  query for later.
