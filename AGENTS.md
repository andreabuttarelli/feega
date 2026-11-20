# feega — design in your codebase

This file mirrors `CLAUDE.md` for non-Claude agents (Codex, Cursor…). `CLAUDE.md` is the source
of truth: when they disagree, it wins.

Feega is a VS Code extension and `npx feega`: select an element in the running app, edit it, and
the change lands in the source. Sign-in and the account live in this web app (`oh.feega.app`).

## Layout

| Path | What |
|---|---|
| `inspect/`, `npx/` | The VS Code extension and the `npx feega` launcher |
| `packages/source-map` | `feega-source-map`, the dev plugin that maps DOM to source |
| `src/` | The web app: login, auth, `/cli/callback` (editor sign-in), account settings, the dashboard (Feega Cloud preview), billing and the Stripe webhook |
| `landing/` | www.feega.app |
| `web-docs/` | docs.feega.app |
| `web-blog/` | the blog |
| `supabase/` | all migrations (immutable) |
| `cli/lib/init.ts` | project setup plan shared with the extension |
| `docs/` | README media, runbooks, SEO notes |

The web app's routes: `/login`, `/auth/*`, `/cli/callback`, `/app` (dashboard),
`/app/settings/profile`, `/account/export`, `/robots.txt`, and `/api` for the dashboard shell,
billing and the Stripe webhook. The old canvas, motion, GPU, nodes, chat, MCP and CLI product was
removed on 20/11/2026; a full `git bundle` archive exists (`feega-20261120.bundle`).

## Database

The Supabase project `klnswzhhgrqvbfjzioul` keeps the full schema: migrations in `supabase/` are
immutable, and tables of the old product stay there untouched. The code reads and writes only
what the account app needs (`profiles`, `orgs`, `orgs_members`, billing and credits).
`org_id` is on every table (except `post_sources`) and RLS uses `auth_org_ids()`. The service-role
key bypasses RLS: every use is declared in `src/lib/server/db/service-role-uses.ts`. Types are
generated (`npm run db:types`), never written by hand.

## Architecture

- **Auth** (`src/lib/server/cli-auth.ts`): Bearer auth (Supabase JWT or `feega_` API key).
- **Pages API** (`src/routes/api/v1/me/*`): the dashboard shell, bootstrap, profile and settings.
- **Billing** (`src/routes/api/v1/billing`, `src/routes/api/webhooks/stripe`): kept for existing subscribers.

## How code is written here: clean architecture and Kent Beck's method (a rule, not a habit)

It applies to new code **and** to refactoring existing code. The `clean-architecture` skill and
the Kent Beck one load per session, so they are not enough: the rule lives here.

**Dependencies always point inward.** Entities know nothing about use cases, use cases know
nothing about adapters, adapters know nothing about the framework. When control must flow the
other way, the dependency is inverted with a port declared by the inner layer and implemented by
the outer one — never a direct reference outward. Simple data structures cross the boundaries:
never an entity, never a database row, never a third-party library's format penetrating inward.

In this repo the boundary is already marked and a test holds it: `packages/no-app-imports.test.ts`
keeps a package from importing the app. A package that needs `$lib` is asking to live elsewhere.

**Kent Beck's method, the three parts that count:**

1. **The failing test first.** Not ceremony: a test that never failed proves nothing. Red, green,
   then tidy up. When fixing a defect, the test that reproduces it is written BEFORE the fix and
   watched fail.
2. **Reordering is separated from behavior changes.** One commit moves things without changing
   what they do, another changes what they do without moving them. Mixing them makes it
   impossible to tell which one broke which — and here, where turns cost real money, it is the
   difference between a ten-minute diagnosis and a two-hour one.
3. **The four rules of simple design**, in order: passes the tests; says the intent; repeats
   nothing; has the fewest parts. In that order — the third and fourth do not justify breaking
   the first two.

**The criterion against defensive abstraction.** An interface with a single implementation, a
layer that exists for symmetry, a config for a value that never changes: complexity paid today
for a contingency that never arrives. The question to ask is one only — *is this separation
giving me a real benefit right now?* If the answer is "it will one day", it doesn't serve.

## Code is not commented: it is written better (a rule, not a habit)

**No comments are written. The ones there are, are removed.** A comment is the confession that
the code doesn't say by itself what it does: if one is needed, the code gets rewritten, not
annotated. If a piece *looks strange*, it isn't strange — it is badly written, and the strangeness
comes out by rewriting it.

Where the knowledge that today ends up in comments belongs is somewhere else, and more durable:

- **The name.** `CHAT_MAX_DURATION_MS` doesn't need a line explaining what it is. A function that
  requires a three-line preamble requires none if it is named after what it does.
- **The type.** A constraint expressed in a type cannot be ignored; in a comment, it can.
- **The test.** An incident counts as a test, not as a story at the top of the file: the test
  fails if the defect returns, the comment doesn't. `il reaper non uccide un run che sta lavorando`
  is a test name, and it lives forever; the same concept in a comment ages and lies.

An expired comment is worse than no comment: we paid for one that described a decision already
reversed and led to a wrong diagnosis.

**And the code underneath must be kept up to the rule**, or removing comments leaves only dark
code:

- **Clean, solid, testable.** If something is hard to test, it is badly built: the difficulty of
  the test is the measure, not an obstacle to route around with one more mock.
- **Never cyclic dependencies.** If A needs B that needs A, the boundary is in the wrong place.
- **Never outside your own level of responsibility.** A component doesn't talk to the database,
  an adapter doesn't decide a product rule, a package doesn't import the app.
- **Never scattered conditions, single or chained.** An `if` on a particular case, then another,
  then a third, is a registry that was never written. Exceptions are declared **in one place
  only, next to the model that governs them**: a table that says how every case behaves, so the
  next case is added with a row and all of them are visible together. A rule written in five
  places diverges at the first change — and diverges silently.

## Una funzione non esiste finché non è collegata (una regola, non un'abitudine)

Costruire il pezzo non basta. Una funzione è finita solo quando è **collegata da capo a capo**
(punto d'ingresso nella UI → handler/action → funzione server → database o provider → quello che
l'utente vede) e chi l'ha scritta ha **seguito quel percorso nel codice**, file per file. Il
report lo dice: *clic su X in `A.svelte` → `action` in `B/+page.server.ts` → `fn` in `C.ts` →
tabella D*.

Il test giusto è quello che esercita il collegamento vero: un test della route/action che chiama
la funzione server reale, non un mock della cosa che si sta collegando. **Playwright non serve
per ogni funzione**: costa tempo e budget. Si tiene per pochi percorsi critici (il login, la callback dell'editor, la dashboard).

Il 22/09/2026 i connettori tipizzati esistevano nella logica e nessun componente li disegnava, e
il calendario puntava a colonne mai esistite: la suite era verde in entrambi i casi.

## `git stash` non si usa, mai (una regola, non un'abitudine)

`git stash` legge e scrive **lo stesso ref** (`refs/stash`) per l'intero repository, non per
worktree. Con più worktree aperti — che qui è la norma, uno per task — uno stash preso in uno può
essere riesumato in un altro e sostituire in silenzio i tuoi edit con quelli di un lavoro
estraneo. È già successo, ed è costato lavoro perso: la storia sta in [`LESSONS.md`](LESSONS.md).

Non c'è un caso in cui valga la pena: **un hook `PreToolUse` lo blocca prima che parta** (solo in Claude Code: altri agenti non ce l'hanno, la regola vale lo stesso)
(`.claude/hooks/block-destructive-git.sh`, registrato in `.claude/settings.json`, casi in
`.claude/hooks/cases.tsv`, verifica con `.claude/hooks/check.sh`). Blocca anche `reset --hard` e
`clean -fd`; lascia passare `stash list` e `stash show`. Fino al 22/09/2026 questa sezione
descriveva un hook che nel repo non esisteva: uno `stash -u` ha poi spazzato il lavoro non
committato di otto agenti. Per
sospendere delle modifiche ci sono tre strade, tutte più sicure e nessuna più lenta:

- **committa sul branch del task** — è per questo che il branch esiste, e un commit di lavoro si
  riscrive dopo con un `rebase -i` o un `commit --amend`;
- **`git diff > /tmp/patch.diff && git checkout -- <file>`**, e più tardi `git apply` — la patch è
  un file tuo, che nessun altro worktree può reclamare;
- **usa il checkout dedicato**, se ti serve una copia pulita mentre tieni le modifiche altrove.

## Lessons already paid for: LESSONS.md (a rule, not a habit)

[`LESSONS.md`](LESSONS.md) keeps the lessons learned from real incidents — stale node_modules
after a rebase, full-suite flakiness versus a true defect, closed PRs that look like API lag.
A lesson is the **signal** that lets you recognize the failure and the **move** that solves it,
no stories.

- **Before diagnosing** a strange problem (dependencies, tests, worktrees, PRs): read it — it has
  already happened to someone.
- **When a new lesson is paid for**, it goes into LESSONS.md in the same commit that paid for it.
  Updating LESSONS.md is as non-optional as writing the test.

## Changelog

A user-visible change adds one English entry in `src/lib/content/changelog/YYYY-MM-DD-<slug>.ts`
(`ChangelogEntry` as default export), read by the landing at build. Release-note style, one line,
no file or function names. Skip it for refactors, tests and indexes.

## Docs

A change to the extension or `npx feega` updates `web-docs/` in the same PR. Every command,
setting and feature a page names must exist in `inspect/` or `npx/`.

## Running

```bash
npm run dev      # the web app on :5173
npm run check    # svelte-check
npm run test:unit
```

Deploys do not run migrations: `node scripts/schema-drift-check.mjs` compares the schema and the
code (read-only). Run it after every migration and before changes that touch the database.

## Agent PRs go to `dev`, never to `main` (a rule, not a habit)

`main` is the repo's default branch and what production deploys. Every merge into it is a
production deploy, and one per PR was too many. So every PR an agent opens branches from an
up-to-date `origin/dev` and targets `dev` (`gh pr create --base dev`); it is merged there when CI
`test` passes. `main` only receives batched releases `dev → main`, and only when the user says so.
A production hotfix straight to `main` happens only when the user asks for that specific fix.

## The commit author, or Vercel won't build

Vercel blocks the deploy when the commit author is not a team member — and "member" is decided
by GitHub resolving the **author's email** to an account. A commit signed with an address GitHub
doesn't know arrives without `githubCommitAuthorLogin`, and the deployment is born `BLOCKED`
(`errorLink` → *troubleshoot-project-collaboration#account-configuration*). The merge lands, the
code is on GitHub, and production stays pinned to the commit before: the quietest way to not
ship.

So commit with the identity GitHub actually resolves:

```
Andrea Buttarelli <49411143+andreabuttarelli@users.noreply.github.com>
```

The Claude account's email is **not** that identity: it has already blocked two deploys.

## AGENT.MD

- When writing something intended for human consumption, (comment, commit message, reply to prompt) use as few words as possible. Pick every word meticulously to reduce the volume to a strict minimum. Be down to the point. Less is more.

- Avoid superlatives and praise. Stop telling me I am absolutely right. Give me the cold hard truth.

- Avoid magic numbers and strings by extracting recurring or meaningful values into descriptive constants (const) or enums. Keep self-explanatory, one-off values inline to avoid clutter. If a value comes from a spec (e.g. HTTP 200 OK), use a constant regardless.

- Reduce code indentation. Avoid Arrow Anti-Pattern. Leverage early return and continue.

- Keep function names short. Less than 30 characters.

- Use enums instead of booleans for function parameters.

- Let the reader of the code breathe. Add empty lines between logical blocks of code.


- Treat member visibility changes as a breaking design shift. Keep all fields and functions private unless external access is strictly required by the design. Prompt the user for explicit approval before changing any access modifier from private to internal or public.

- Program to levels of abstraction. Lower-level mechanics (e.g., raw hardware I/O, sector parsing, direct socket streams) must be encapsulated in a dedicated driver/abstraction layer. Expose clean, high-level APIs to the rest of the application so calling code works with domain concepts, not raw implementation details.

- Don't touch blocks of code unrelated to the feature you implement. e.g. Don't add comments to a block of code if you did not create it or modify it. As much as possible try to minimize the number of changed lines when implementing a feature.

- Strictly adhere to the layered boundary hierarchy: each layer may only communicate with its immediate neighbor directly below it. Never "punch holes" through layers (e.g., controllers or UI components must never directly call database queries, raw hardware drivers, or low-level network clients; always route through the intermediate service/abstraction layer).

- Always use {}, even on a one-line "if" statement.

When you write a commit message, follow these 7 rules:
Rule 1: Separate the subject line from the body with a single blank line.
Rule 2: Limit the subject line to 50 characters (72 is the absolute hard limit).
Rule 3: Capitalize the first letter of the subject line.
Rule 4: Do not end the subject line with a period.
Rule 5: Use the imperative mood in the subject line (e.g., "Fix bug," "Add feature," 
        not "Fixed" or "Adds"). Test formula: It must complete the sentence: "If applied,
        this commit will [your subject line here]".
Rule 6: Wrap the body text manually at 72 characters to prevent Git formatting issues.
Rule 7: Use the body to explain what and why vs. how. Assume the code explains the how;
        the message must explain the context and reasoning. 

- If the prompt indicates that a bug is being fixed, don't write the fix right away. First write the test. Observe it failing. Then write the fix. And observe the test passing.

## Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. Issues live in GitHub Issues (andreabuttarelli/feega), via the `gh` CLI.

## Tasks = Notion "feega > Tasks"

When "the tasks" are mentioned, the **feega > Tasks** database is meant (page "Tasks",
inline database "✅ Team Tasks", data source `collection://d5551c37-1a6f-4bf2-89c8-af84a1d5dcec`).
Don't look for other task databases.
