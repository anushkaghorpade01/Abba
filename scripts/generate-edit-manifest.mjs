import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { imageSize } from 'image-size';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EDIT_DIR = path.join(__dirname, '..', 'public', 'EDITED');
const OUT = path.join(EDIT_DIR, 'manifest.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.jfif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v']);

function sortRank(name) {
  const base = path.basename(name).replace(/\.[^.]+$/, '');
  const m = base.match(/^(\d+)/);
  if (m) {
    return [0, BigInt(m[1]), base.toLowerCase(), name.toLowerCase()];
  }
  return [1, base.toLowerCase(), name.toLowerCase()];
}

function naturalCompare(a, b) {
  const ra = sortRank(a);
  const rb = sortRank(b);
  for (let i = 0; i < Math.min(ra.length, rb.length); i++) {
    const x = ra[i];
    const y = rb[i];
    if (typeof x === 'bigint' && typeof y === 'bigint') {
      if (x < y) return -1;
      if (x > y) return 1;
    } else if (x < y) return -1;
    else if (x > y) return 1;
  }
  return 0;
}

function main() {
  if (!fs.existsSync(EDIT_DIR)) {
    console.error('Missing directory:', EDIT_DIR);
    process.exit(1);
  }

  const files = fs
    .readdirSync(EDIT_DIR)
    .filter((name) => !name.startsWith('.') && name !== 'manifest.json');

  files.sort(naturalCompare);

  const entries = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const fullPath = path.join(EDIT_DIR, file);

    if (!IMAGE_EXT.has(ext) && !VIDEO_EXT.has(ext)) {
      continue;
    }

    if (!fs.statSync(fullPath).isFile()) continue;

    let width = null;
    let height = null;
    let aspect = null;

    if (IMAGE_EXT.has(ext)) {
      try {
        const buf = fs.readFileSync(fullPath);
        const dim = imageSize(buf);
        if (dim.width && dim.height) {
          width = dim.width;
          height = dim.height;
          aspect = dim.width / dim.height;
        }
      } catch {
        aspect = null;
      }
    } else if (VIDEO_EXT.has(ext)) {
      width = 1920;
      height = 1080;
      aspect = 16 / 9;
    }

    if (!(aspect > 0) || !Number.isFinite(aspect)) {
      aspect = 4 / 3;
      width ??= 1600;
      height ??= 1200;
    }

    entries.push({
      file,
      kind: VIDEO_EXT.has(ext) ? 'video' : 'image',
      aspect,
      width,
      height,
    });
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), base: 'public/EDITED', entries }, null, 2)
  );

  console.log('Wrote', OUT, '(' + entries.length + ' assets)');
}

main();
