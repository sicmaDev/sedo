#!/bin/sh
set -e

echo "Application des migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Seeding des données initiales..."
node prisma/seed.js

echo "Demarrage du serveur..."
node server.js
