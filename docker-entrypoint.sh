#!/bin/sh
# Container startup: wait for Postgres, apply the schema, ensure an admin user
# exists, then start the web server. Safe to run on every boot — migrate and
# seed are both idempotent.
set -e

echo "→ Waiting for the database to accept connections..."
node scripts/wait-for-db.mjs

echo "→ Applying database schema..."
node scripts/migrate.mjs

echo "→ Ensuring the admin account exists..."
node scripts/seed-admin.mjs

echo "→ Starting Next.js on port ${PORT:-3000}..."
exec ./node_modules/.bin/next start -p "${PORT:-3000}"
