FROM node:22-alpine
WORKDIR /app
RUN npm init -y >/dev/null && npm install --no-audit --no-fund pg
COPY scripts/db-migrate.mjs scripts/db-seed.mjs ./scripts/
COPY scripts/seed ./scripts/seed
COPY supabase/baseline ./supabase/baseline
COPY supabase/migrations ./supabase/migrations
COPY supabase/canvas-migrations ./supabase/canvas-migrations
CMD ["sh", "-c", "node scripts/db-migrate.mjs && node scripts/db-seed.mjs"]
