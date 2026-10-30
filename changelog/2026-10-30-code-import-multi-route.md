# Import from code: routes, frameworks, Storybook

Spec `docs/specs/code-import.md`.

- Several routes in one run (`routes`, up to 8): one sandbox, one browser tab, one frame. Each
  route is a board (`boardsOf`, shelf-packed under `DESIGN_MAX_SIDE`), and one code-sets pass runs
  over the uses of every route, so a component rendered on two routes is one main. Discarded: a
  frame per route — mains live in a frame's doc and an instance cannot point at another frame's
  main, so the library would have been one copy per route.
- Storybook as a source (`storybook`, `stories`): `index.json` (v7+) or `stories.json` (v6), up to
  12 stories interleaved across components, each `iframe.html?id=…` captured and cropped to what
  it draws, then the same boards. Names: the last segment of every title; a library display name
  `HeroUI.Button` counts as `Button`. No sandbox, no install. The first in-app run (24 stories, hosted
  browser) opened 6 before the session ended: captures now stop at a 150 s budget (the rest is
  reported as left out), stories settle 300 ms instead of 1.2 s, and the default is 12 stories.
- Frameworks in `componentMarksOf`: React server components from `_debugInfo` (React 19 keeps
  name and props of each server component on the fibers it produced); Vue 3 from
  `__vueParentComponent` (an instance whose `subTree.el` is the element, props from `props`,
  vendor files skipped); Svelte 5 from `__svelte_meta` (the dev stack of component entries,
  `componentTag` as the name, definition file not in node_modules; Svelte keeps no props, so no
  variants). React 19 `HostSingleton` (`body`, `html`) now closes a segment like a `div`.
- Next.js 16 dev blocks `/_next/*` from any origin but localhost: through the sandbox domain the
  HMR socket failed, the client never hydrated, zero fibers. `origin-proxy.ts` (node, in the
  sandbox, in front of the dev server) rewrites `Host`/`Origin`/`Referer` to localhost, HTTP and
  websocket. Replaces the Vite allowed-hosts env.
- Shared root: two components whose render is the same DOM element (`Tooltip` around `Button`)
  were one use; the inner vanished. The marker records the chain (`shares`), `withComponents`
  wraps the element in a frame per outer component, at most outermost + innermost: a 6-deep
  provider chain made the instance diff take 72 s on a 300-node page (0.2 s capped).
- A use marked on a leaf (an `<svg>` icon component) was dropped: wrapped in a frame now.
- `linkable`: an instance whose subtree holds a component variant never seen as a main stays
  layers, so that variant gets its main. Cost: that one use is not an instance.
- Framework props starting with `$$` or `__` are ignored.
- `importPageAt` split: `landPlan` and `fontsFor` exported (separate commit, no behaviour change).
- Codegen: every Precomp became a component (`Group1…Group47` on shadcn-admin); a comp that is not
  a main and has no props inlines as markup. 9 groups still export as components on shadcn-admin:
  their layers vary per instance.
- Harness: `code-capture.browser.test.ts` (sandbox + local Chromium, images and fonts saved while
  the sandbox lives) and `code-fidelity.browser.test.ts` (SSIM per page against the same page
  through plain URL import); apps in `fidelity-apps.ts`. Measured below, in the spec.
- Private repositories: the runner takes an archive (`RepoRunner(repo, archive)`), filled in the
  next entry.
