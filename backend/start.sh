#!/bin/sh
set -e

echo "🔄 Application des migrations..."
./node_modules/.bin/prisma migrate deploy

echo "🚀 Démarrage du serveur..."
node server.js
