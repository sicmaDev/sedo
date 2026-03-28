#!/bin/sh
set -e

echo "Application des migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Demarrage du serveur..."
node server.js
