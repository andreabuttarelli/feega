# Desktop: OAuth opens the system browser

The login form posts to a server action that answers with a redirect to the provider. The
shell only guarded `will-navigate`, which a server redirect never fires, so Google's page
loaded inside the window. `keepInside` now guards `will-redirect` too.
