import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';

const ROOT = process.cwd();
const RELEASE_DIR = path.join(ROOT, 'release');
const DIST_DIR = path.join(ROOT, 'dist');
const ENTERTAINMENT_DIR = path.join(ROOT, 'entertainment');
const PLUGIN_DIR = path.join(ROOT, 'chatgpt-plugin');

const VERSION = '1.0.0';
const PACKAGE_ID = 'inneranimalmedia.wizard-chess-3d';

function addDirectoryToZip(zip, baseDir, relPrefix = '', excludeTop = new Set()) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (relPrefix === '' && excludeTop.has(entry.name)) continue;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.DS_Store') continue;

    const fullPath = path.join(baseDir, entry.name);
    const zipPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath, excludeTop);
    } else if (entry.isFile()) {
      zip.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

async function writeZipArchive(fileName, populateFn) {
  const zip = new JSZip();
  populateFn(zip);
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const outPath = path.join(RELEASE_DIR, fileName);
  fs.writeFileSync(outPath, buffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  return {
    file: fileName,
    bytes: buffer.length,
    sha256,
  };
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist/ directory not found. Run `npm run build` before packaging release artifacts.');
  }

  fs.mkdirSync(RELEASE_DIR, { recursive: true });

  const artifacts = {};

  artifacts.source = await writeZipArchive('wizard-chess-3d-source.zip', (zip) => {
    addDirectoryToZip(zip, ROOT, '', new Set(['node_modules', 'dist', 'release', '.git']));
  });

  artifacts.web = await writeZipArchive('wizard-chess-3d-web.zip', (zip) => {
    addDirectoryToZip(zip, DIST_DIR);
  });

  artifacts.chatgptPlugin = await writeZipArchive('wizard-chess-3d-chatgpt-plugin.zip', (zip) => {
    addDirectoryToZip(zip, PLUGIN_DIR);
  });

  artifacts.entertainment = await writeZipArchive('wizard-chess-3d-entertainment.zip', (zip) => {
    addDirectoryToZip(zip, ENTERTAINMENT_DIR);
  });

  const manifest = {
    packageId: PACKAGE_ID,
    product: 'Wizard Chess 3D',
    publisher: 'InnerAnimalMedia',
    collection: 'Entertainment',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    artifacts,
  };

  fs.writeFileSync(
    path.join(RELEASE_DIR, 'RELEASE_MANIFEST.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  console.log('Packaged release archives:', JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
