#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node server.js &
exec node -r tsx/cjs src/server/cron-server.ts
