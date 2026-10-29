# Login: step-by-step guide inside in-app browsers

Google and GitHub reject OAuth in Instagram, TikTok and other webviews.
The old overlay gave one generic hint. Now `src/lib/in-app-browser.ts`
holds one registry (UA rule plus iOS/Android steps per app, incl. Threads
and WeChat) and `guideFor` reads it.

- OAuth buttons read "Open in your browser" and open the guide instead of
  starting OAuth. Email login is untouched.
- Android keeps the `intent://` link; copy link is the fallback.
- Discarded: auto-firing the intent on click, it hides the steps.
