# 0028 — Code import runs the app in a sandbox and reads React fibers

## Status

Accepted, 2026-10-29.

## Context

Import from code must keep component identity: a usage in the code is an instance, its props
pick a variant. Three ways to get there: parse the source statically and lay it out ourselves;
instrument the build (a Babel/SWC plugin stamping `data-component`); run the app and read the
framework's own runtime metadata. URL import (ADR 0026) already turns a running page into a
frame through the Figma importer, which already makes mains and instances (`ComponentRef`).

## Decision

- Run the repo's dev server in a Vercel Sandbox (`@vercel/sandbox`, already used by the render
  farm): shallow git clone, install from the lockfile, `dev`, one exposed port. The page is read
  by `liveBrowser` like URL import.
- Identity from React fibers: in the page, each DOM element's `__reactFiber$` key leads up to
  the composite fibers whose first host it is; their name and `memoizedProps` are recorded.
  Only names declared in the repo's own `.tsx`/`.jsx` count.
- Usages become `ComponentRef`s on the page tree (`key` = name + variant), so the Figma importer
  builds mains and instances; it gains `variant`/`set` on mains and text overrides on instances.
- Codegen exports a set as one dispatching component named after the set.

## Consequences

- Works on any React client app without touching its build; fidelity is the URL import's.
- Server components and apps that need secrets to boot are not covered.
- One sandbox per import: seconds of install time, a few cents.

## Rejected

- Static parsing: no layout, no styles; a second renderer to keep in step with the browser.
- Build plugin: one per bundler (Vite, Next/SWC, webpack), and it edits the user's config.
- Running the repo on our functions or a worker: user code on our network, with our env.
