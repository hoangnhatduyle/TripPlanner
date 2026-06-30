// Generates favicons + PWA icons from trip-planner-logo.png using sharp.
// Run: npm run icons
//
// The source (1254x1254) is a finished app-icon design: a rounded card with the
// travel-pig artwork framed by a white border on a black backdrop. We keep the
// whole bordered card and apply a rounded-corner alpha mask so transparent corners
// align with the white border's outer arc (same technique as cha-ching / Chắt Chiu).
//
//   - Browser favicons, PWA "any" icons, and the in-app nav logo: full card with
//     our rounded-corner mask (CORNER_RATIO matches the source border radius).
//   - Maskable launcher icons: whole card scaled to 80% on a card-tone background
//     so the OS mask never clips the artwork.
//   - Apple-touch: rounded card flattened onto white (iOS rounds again on top).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'src', 'public', 'trip-planner-logo.png');
const ICONS_DIR = path.join(root, 'src', 'public', 'icons');
const PUBLIC_DIR = path.join(root, 'src', 'public');

// Outer corner radius of the white border in the source (175px of 1254).
const CORNER_RATIO = 175 / 1254;
const MASKABLE_SCALE = 0.8;
const CARD_BG = { r: 197, g: 124, b: 73 };

fs.mkdirSync(ICONS_DIR, { recursive: true });

const baseArt = await sharp(SRC).png().toBuffer();

async function makeRounded(size, opaqueBg = null) {
  const base = await sharp(baseArt).resize(size, size, { fit: 'cover' }).png().toBuffer();
  const radius = Math.round(size * CORNER_RATIO);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  const masked = await sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  if (!opaqueBg) return masked;
  return sharp(masked).flatten({ background: opaqueBg }).png().toBuffer();
}

async function writeRounded(file, size) {
  const buf = await makeRounded(size);
  fs.writeFileSync(file, buf);
  return buf;
}

async function writeMaskable(file, size) {
  const inner = Math.round(size * MASKABLE_SCALE);
  const pad = Math.round((size - inner) / 2);
  const card = await sharp(baseArt).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
  const buf = await sharp({
    create: { width: size, height: size, channels: 3, background: CARD_BG },
  })
    .composite([{ input: card, top: pad, left: pad }])
    .png()
    .toBuffer();
  fs.writeFileSync(file, buf);
  return buf;
}

const anySizes = [32, 72, 96, 128, 144, 152, 192, 384, 512];
for (const s of anySizes) {
  await writeRounded(path.join(ICONS_DIR, `icon-${s}x${s}.png`), s);
}

for (const s of [192, 512]) {
  await writeMaskable(path.join(ICONS_DIR, `icon-maskable-${s}x${s}.png`), s);
}

for (const s of [16, 32, 48]) {
  await writeRounded(path.join(ICONS_DIR, `favicon-${s}x${s}.png`), s);
}

fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), await makeRounded(180, '#ffffff'));

const ico48 = await writeRounded(path.join(ICONS_DIR, 'favicon-48x48.png'), 48);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(48, 0);
entry.writeUInt8(48, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(ico48.length, 8);
entry.writeUInt32LE(6 + 16, 12);
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), Buffer.concat([header, entry, ico48]));

console.log('Generated PWA icons from trip-planner-logo.png');
