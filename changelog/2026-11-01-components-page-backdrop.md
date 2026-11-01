# Components page: mains keep the background they were designed on

Set frames on the Components page were transparent, so on the light canvas
the dark components of linear and vercel showed light text on light grey:
nav links, logos and footer columns nearly invisible, a Notion card washed
out. `main-backdrop.ts` walks up from the clip that places each main
(through the comps holding it) to the first opaque solid fill and returns
it with its variable binding; `setDoc` draws the most used one as a
`Background` rect behind the set and gives a main from another backdrop
its own rect. `setMainOf` already accepted a clip named `Background`.

Discarded: a dark backdrop picked from the components' own lightness. It
guesses where the page already says, and a button designed on a coloured
section would land on grey.

`components-page.browser.test.ts` (`URL_IMPORT_SHEET`) draws the
Components page of a capture to check it without the app.

Not done: vercel footer columns show only their headings on the
Components page; the nested Footer link instances inside each column
main land at page coordinates (set frames reframe nested comps without
the main's shift). Present on dev before this change.
