import fs from 'node:fs';
import path from 'node:path';
import { Jimp } from 'jimp';

const ROOT = process.cwd();
const ICON_SRC = path.join(ROOT, 'src/assets/images/wizard_chess_icon_1794549897569.jpg');
const COVER_SRC = path.join(ROOT, 'src/assets/images/wizard_chess_cover_1794549897341.jpg');

const PUBLIC_DIR = path.join(ROOT, 'public');
const ENT_ASSETS = path.join(ROOT, 'entertainment/assets');
const PLUGIN_ASSETS = path.join(ROOT, 'chatgpt-plugin/assets');

for (const dir of [PUBLIC_DIR, ENT_ASSETS, PLUGIN_ASSETS]) {
  fs.mkdirSync(dir, { recursive: true });
}

async function generatePngAssets() {
  const iconBase = await Jimp.read(ICON_SRC);
  const coverBase = await Jimp.read(COVER_SRC);

  // Standard "any" icons
  for (const [size, outPath] of [
    [32, path.join(PUBLIC_DIR, 'favicon-32x32.png')],
    [180, path.join(PUBLIC_DIR, 'apple-touch-icon.png')],
    [192, path.join(PUBLIC_DIR, 'pwa-192x192.png')],
    [512, path.join(PUBLIC_DIR, 'pwa-512x512.png')],
    [512, path.join(ENT_ASSETS, 'icon-512x512.png')],
    [512, path.join(PLUGIN_ASSETS, 'icon-512x512.png')],
  ]) {
    const resized = iconBase.clone().resize({ w: size, h: size });
    await resized.write(outPath);
  }

  // Maskable 512x512 icon with >= 14% safe-zone padding around centered emblem on solid obsidian canvas
  const maskCanvas = new Jimp({ width: 512, height: 512, color: 0x080a0fff });
  const innerSize = 368; // ~72% -> ~14% padding per side
  const innerIcon = iconBase.clone().resize({ w: innerSize, h: innerSize });
  const offset = Math.round((512 - innerSize) / 2);
  maskCanvas.composite(innerIcon, offset, offset);
  await maskCanvas.write(path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'));

  // 16:9 Cover artwork for PWA splash/OpenGraph, Entertainment, and ChatGPT Plugin
  for (const [w, h, outPath] of [
    [1280, 720, path.join(PUBLIC_DIR, 'cover-1280x720.png')],
    [1280, 720, path.join(ENT_ASSETS, 'cover-1280x720.png')],
    [1280, 720, path.join(PLUGIN_ASSETS, 'cover-1280x720.png')],
  ]) {
    const coverResized = coverBase.clone().cover({ w, h });
    await coverResized.write(outPath);
  }

  // Crisp vector SVG emblem for browser favicon
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#181c28"/>
      <stop offset="100%" stop-color="#080a0f"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff0b3"/>
      <stop offset="50%" stop-color="#d4af37"/>
      <stop offset="100%" stop-color="#8b6914"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="26" fill="url(#bg)"/>
  <rect x="6" y="6" width="116" height="116" rx="22" fill="none" stroke="url(#gold)" stroke-width="2" opacity="0.55"/>
  <path d="M58 20h12v8h8v10h-8v8h14l-5 14H49l-5-14h14v-8h-8V28h8v-8zm-10 44h32l6 32H42l6-32zm-12 36h56v10H36v-10z" fill="url(#gold)"/>
</svg>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), iconSvg, 'utf-8');
  console.log('Generated all PNG & SVG icons and cover assets.');
}

generatePngAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
