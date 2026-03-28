#!/bin/sh
set -e

echo "Application des migrations..."
./node_modules/.bin/prisma migrate deploy --skip-generate

echo "Demarrage du serveur..."
node server.js
