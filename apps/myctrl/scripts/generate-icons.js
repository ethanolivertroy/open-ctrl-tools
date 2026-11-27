#!/usr/bin/env node

/**
 * Generate PWA icons and favicon.ico from favicon.svg
 *
 * Usage: node scripts/generate-icons.js
 *
 * Requires: sharp (already a project dependency)
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'favicon.svg');

const svgBuffer = readFileSync(svgPath);

async function generatePng(outputName, size) {
  const outputPath = join(publicDir, outputName);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputName} (${size}x${size})`);
}

async function generateMaskableIcon(outputName, size) {
  // Maskable icons need the design inset so it fits within the safe zone
  // (inner 80% circle). We render the SVG at 80% of the canvas and center it.
  const innerSize = Math.round(size * 0.8);
  const padding = Math.round((size - innerSize) / 2);

  const innerPng = await sharp(svgBuffer)
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();

  const outputPath = join(publicDir, outputName);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 30, g: 30, b: 46, alpha: 1 } // #1e1e2e
    }
  })
    .composite([{ input: innerPng, left: padding, top: padding }])
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputName} (${size}x${size}, maskable)`);
}

/**
 * Build a minimal ICO file from PNG buffers.
 * ICO format: header + directory entries + image data
 */
function buildIco(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let dataOffset = headerSize + dirSize;

  // ICO header: reserved(2) + type(2) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);          // reserved
  header.writeUInt16LE(1, 2);          // type: 1 = ICO
  header.writeUInt16LE(numImages, 4);  // image count

  const dirEntries = [];
  const sizes = [32, 16]; // must match order of pngBuffers

  for (let i = 0; i < numImages; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const s = sizes[i];
    entry.writeUInt8(s < 256 ? s : 0, 0);   // width (0 = 256)
    entry.writeUInt8(s < 256 ? s : 0, 1);   // height
    entry.writeUInt8(0, 2);                   // color palette
    entry.writeUInt8(0, 3);                   // reserved
    entry.writeUInt16LE(1, 4);                // color planes
    entry.writeUInt16LE(32, 6);               // bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8);  // image size
    entry.writeUInt32LE(dataOffset, 12);            // image offset
    dataOffset += pngBuffers[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

async function generateFavicon() {
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();

  const ico = buildIco([png32, png16]);
  const outputPath = join(publicDir, 'favicon.ico');
  writeFileSync(outputPath, ico);
  console.log('Generated favicon.ico (32x32 + 16x16)');
}

async function main() {
  console.log('Generating icons from favicon.svg...\n');

  await Promise.all([
    generatePng('icon-192.png', 192),
    generatePng('icon-512.png', 512),
    generatePng('apple-touch-icon.png', 180),
    generateMaskableIcon('icon-maskable-512.png', 512),
    generateFavicon(),
  ]);

  console.log('\nDone! All icons generated in public/');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
