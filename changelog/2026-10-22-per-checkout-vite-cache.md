# Each checkout keeps its own Vite deps cache

Agent worktrees symlink the main `node_modules`, so every dev server
shared `node_modules/.vite`. One server re-optimizing deps broke the
others with `Cannot read properties of undefined (reading 'call')` on
every page. `cacheDir` now points at `.vite-deps` inside each checkout.
