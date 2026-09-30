# Drop sandbox_holders

Vercel Sandbox left the product (drop-legacy-providers); its lease table
had no readers. Production never had it applied, so the migration is a
guarded `drop table if exists` that keeps fresh environments aligned.
Removed from the `query` table allowlist too.
