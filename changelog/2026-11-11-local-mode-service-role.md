# Fix: local mode asked for a Supabase service-role key

`createServiceRoleDb` and `createAdminClient` threw `SUPABASE_SERVICE_ROLE_KEY not configured`
before reaching `createClient`, which is the point that already routes to the `.feega` store.
Motion frames and `add_template` use the service-role client, so with no `.env` they answered 500.

Both now return the file-backed db when `localStore()` is set, ahead of the key check. One place
per client, no guard per caller, no dummy key. Test: `src/lib/server/db/client.local.test.ts`.
