# Marketing homepage rebuilt off Framer, served on the site host

Second step of moving www.feega.app off Framer.

- `/` renders the homepage (`src/routes/(site)/+page.svelte`, sections in `src/lib/site/home/`)
  when the host is www.feega.app or feega.app (`isSiteHost`). On oh.feega.app `/` still redirects
  into the app.
- `reroute` in `src/hooks.ts` sent every host other than `PUBLIC_APP_URL` to the `_site` blog
  group, which no longer exists: www.feega.app would have answered 404 after the DNS switch. The
  site host is now excluded (test in `hooks.reroute.test.ts`).
- Hero and motion sections reuse our own embeds (`/embed/liquid-glass.js`, `/embed.js`) in
  srcdoc iframes. Showcase videos stay on our Supabase bucket; images are self-hosted WebP.
- Template leftovers removed: Ezio Salazar JSON-LD and header hover (now Andrea Buttarelli),
  mobile-menu socials, "## Annex 1", "SUBPROCESSORS.md", privacy@ mailto under support@ text.
  OG image is the feega card `/og.png` (1200×630), not the Framer template mockup.
- Site classes are prefixed (`site-*`, `model-tile`) because `app.css` styles `.tile`, `.cell`,
  `.card`, `.wrap`, `.title`, `.hero` globally.
- Parity vs live at 375/768/1280/1440/1920: 0.93–0.984 pixel match, 0.96–0.993 within ±3px;
  videos and the two live embeds are animated, so some difference is structural.
