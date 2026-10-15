# Long chat turns no longer die on an expired session

Demo-quality run on the test account: "make an animated version of the FRIDAY post" started a canvas turn that delegated to the motion agent. About ten minutes in, every write answered `JWT expired` (PGRST303): the reply, the working doc, the revision. The turn's db is built from the request's access token, and that token had minutes left. The motion agent's failed-turn save then rejected inside `onError` with no handler, and Node exited on the unhandled rejection, taking every other request on that process with it.

- `outlivesTurn` (`src/lib/server/session-life.ts`): a session whose token expires within `AGENT_MAX_DURATION_S` + 5 min is refreshed in the hook before `locals.db()` is built. At most one refresh per user every ~25 min.
- `turn.ts` `onError`: the save of a failed turn ends in `.catch`, so a failing save is logged, not fatal.

Discarded: a service-role db for background turns (bypasses RLS for the whole agent); refreshing inside each long route (the hook is the one place the db is built).
