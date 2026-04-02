#!/bin/sh
set -e

echo "Resolution des migrations echouees..."
./node_modules/.bin/prisma migrate resolve --rolled-back 20260331163455_add_sector_to_transaction 2>/dev/null || true

echo "Application des migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Seeding des données initiales..."
node prisma/seed.js

echo "Demarrage du serveur..."
node server.js
