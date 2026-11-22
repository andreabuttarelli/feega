# Supabase keep-alive

`.github/workflows/db-keepalive.yml` calls `/auth/v1/health` daily (06:17 UTC) so the
free-tier project does not pause. Needs repo secrets `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY`; the job fails with a message naming them when absent.
