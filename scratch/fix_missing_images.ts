
import fs from 'fs';
import path from 'path';
import https from 'https';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_DIR = path.join(process.cwd(), 'public', 'images', 'vehicles');

const MISSING_IMAGES = [
  { slug: 'qm6', url: 'https://autoimg.danawa.com/photo/3732/model_360.png' },
  { slug: 'torres-evx', url: 'https://autoimg.danawa.com/photo/4492/model_360.png' },
  { slug: 'bmw-5-series', url: 'https://autoimg.danawa.com/photo/4517/model_360.png' },
  { slug: 'benz-e-class', url: 'https://autoimg.danawa.com/photo/4516/model_360.png' }
];

async function download(url: string, dest: string, redirects = 0) {
  if (redirects > 5) throw new Error(`Too many redirects for ${url}`);
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const location = res.headers.location;
        if (location) {
          resolve(download(location.startsWith('http') ? location : new URL(location, url).toString(), dest, redirects + 1));
          return;
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        resolve(true);
      });
      stream.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  for (const item of MISSING_IMAGES) {
    const filename = `${item.slug}.png`;
    const dest = path.join(TARGET_DIR, filename);
    
    console.log(`Downloading ${item.slug}...`);
    try {
      await download(item.url, dest);
      console.log(`Saved to ${filename}`);
      
      const dbUrl = `/images/vehicles/${filename}`;
      await prisma.vehicle.update({
        where: { slug: item.slug },
        data: { thumbnailUrl: dbUrl }
      });
      console.log(`Updated DB for ${item.slug}`);
    } catch (err) {
      console.error(`Error processing ${item.slug}:`, err);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
