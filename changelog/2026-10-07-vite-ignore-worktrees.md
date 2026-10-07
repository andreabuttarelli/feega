# Il dev server ignora i worktree degli agenti

I worktree in `.claude/worktrees/` stanno dentro la repo: Vite li osservava, e ogni `svelte-kit sync` di un agente forzava un full reload del dev server principale, con errori SSR di dipendenza circolare. `server.watch.ignored` ora li esclude.
