
import fs from 'fs';
import path from 'path';
import https from 'https';

const BRAND_LOGOS = [
  { name: '벤츠', url: 'https://pngimg.com/uploads/mercedes_logos/mercedes_logos_PNG27.png' }
];

const TARGET_DIR = path.join(process.cwd(), 'public', 'images', 'logos');

async function download(url: string, dest: string, redirects = 0) {
  if (redirects > 5) throw new Error(`Too many redirects for ${url}`);
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': new URL(url).origin
      }
    };
    https.get(url, options, (res) => {
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

  for (const item of BRAND_LOGOS) {
    const ext = path.extname(item.url.split('?')[0]) || '.png';
    const filename = `${item.name}${ext}`;
    const dest = path.join(TARGET_DIR, filename);
    
    console.log(`Downloading ${item.name} logo...`);
    try {
      await download(item.url, dest);
      console.log(`Saved to ${filename}`);
    } catch (err) {
      console.error(`Error downloading ${item.name}:`, err);
    }
  }
}

main();
