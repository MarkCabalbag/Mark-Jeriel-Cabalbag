// Generates AVIF + WebP + JPEG (1600px wide) for the four case-study images.
// Run: node scripts/optimize-chess-images.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'src/assets/images/';
const OUT = 'src/chess/assets/';
const files = {
  coreos: 'desktop-coreos.jpeg',
  harlow: 'landingDesktopHarlow.jpeg',
  summit: 'landingDesktopSummitRidgeRoofing.jpeg',
  meridian: 'landingDesktopMeridian.jpg',
};

await mkdir(OUT, { recursive: true });
for (const [name, file] of Object.entries(files)) {
  const base = () => sharp(SRC + file).resize({ width: 1600, withoutEnlargement: true });
  await base().avif({ quality: 55, effort: 5 }).toFile(`${OUT}${name}.avif`);
  await base().webp({ quality: 68 }).toFile(`${OUT}${name}.webp`);
  await base().jpeg({ quality: 72, mozjpeg: true }).toFile(`${OUT}${name}.jpg`);
  console.log('done', name);
}
