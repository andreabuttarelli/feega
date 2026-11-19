# /download page and split download button

Before: the hero button opened a modal listing editors; `/download/mac` redirected to a desktop
build (302).

Now: `/download` lists the editors, `npx feega` and requirements. The hero button is a split button:
main part links to `/download`, the chevron opens an anchored menu with the same options
(`installOptions` + `runOption`, shared with the page cards). Every other Download CTA is a plain
link. `/download/mac` is a 301 to `/download`. The dialog is gone.

Version: `FEEGA_VERSION` in `links.ts`, updated by hand per release. A build-time Open VSX fetch
was discarded: a failing registry would break the build.
