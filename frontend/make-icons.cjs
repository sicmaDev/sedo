const sharp = require('sharp');

// Utilise le nouveau logo icône (fond vert, icône blanche) — carré 1:1
async function makeIcon(size, outFile) {
  // Zoom in 40% pour que l'icône occupe plus de place et soit bien centrée
  const zoomSize = Math.round(size * 1.4);
  const offset = Math.round((zoomSize - size) / 2);
  const resized = await sharp('public/sedo-icon-green.jpeg')
    .resize(zoomSize, zoomSize, { fit: 'cover', position: 'centre' })
    .extract({ left: offset, top: offset, width: size, height: size })
    .png()
    .toBuffer();

  // Masque coins arrondis
  const radius = Math.floor(size * 0.22);
  const mask = Buffer.from(
    `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
  );

  await sharp(resized)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(`public/${outFile}`);

  console.log(`✅ ${outFile} généré (${size}x${size})`);
}

(async () => {
  await makeIcon(192, 'sedo-icon-192.png');
  await makeIcon(512, 'sedo-icon-512.png');
})();
