#!/bin/sh

cd /app

echo "Application des migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Demarrage du serveur..."
node /app/server.js
