const sharp = require('sharp');

// Utilise le nouveau logo icône (fond vert, icône blanche) — carré 1:1
async function makeIcon(size, outFile) {
  const resized = await sharp('public/sedo-icon-green.jpeg')
    .resize(size, size, { fit: 'cover' })
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
