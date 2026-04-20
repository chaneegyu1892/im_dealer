
import fs from 'fs';
import path from 'path';
import https from 'https';

const VEHICLE_IMAGES = [
  { slug: 'palisade', url: 'https://www.hyundai.com/content/dam/hyundai/template_en/en/images/common/360vr/palisade-2022-m/lhd/ex/gls-20-alloy/shimmering-silver-metallic/shimmering-silver-metallic_0.png' },
  { slug: 'sorento', url: 'https://www.kia.com/content/dam/kia2/ie/en/new-cars/sorento-mq4-pe/discover/kia-sorento-mq4-pe-exterior-sideview.png' },
  { slug: 'gv80', url: 'https://www.genesis.com/content/dam/genesis-p2/global/assets/models/gv80/highlights/genesis-gv80-highlights-specs-desktop-1600x900.jpg' },
  { slug: 'torres', url: 'https://www.kg-mobility.com/attached/contents/display/image/2000001000100010017/20260220160146869_dRJW49.png' },
  { slug: 'trax-crossover', url: 'https://www.chevrolet.co.kr/content/dam/chevrolet/as/kr/ko/primary-nav-icons/2025/01-image/trax-crossover-profile-bottom-left.jpg?imwidth=1200' },
  { slug: 'bmw-5-series', url: 'https://www.bmw.co.kr/content/dam/bmw/marketKR/bmw_co_kr/all-models/5-series/sedan/2023/highlights/bmw-5-series-sedan-highlights-sp-desktop.jpg' },
  { slug: 'benz-e-class', url: 'https://www.mercedes-benz.co.kr/content/dam/market-kr/korea/passengercars/models/e-class/sedan-w214/mercedes-benz-e-class-sedan-w214-highlights-exterior-side-view-desktop.jpg' },
  { slug: 'bongo3-ev', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krb1279/bongo3-ev_s_ud.png' },
  { slug: 'ioniq5', url: 'https://www.hyundai.com/static/images/model/ioniq5/25my/ioniq5_highlights_usp.jpg' },
  { slug: 'staria', url: 'https://www.hyundai.com/static/images/model/staria/24my/staria_highlights_usp.jpg' },
  { slug: 'ev6', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krcv253/ev6_s_swp.png' },
  { slug: 'ev9', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krmv297/ev9_s_ism.png' },
  { slug: 'gv70', url: 'https://www.genesis.com/content/dam/genesis/au/en/models/luxury-suv-genesis/gv70/gallery/03_GV70_Standard_Driving_Front-Quarter_1920x960.jpg' },
  { slug: 'k8', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/k8/25pe/gallery/image/asset/k8_gallery_image_01.jpg' },
  { slug: 'k5', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krdl243/k5_s_c7s.png' },
  { slug: 'g80', url: 'https://www.genesis.com/content/dam/genesis-p2/kr/admin/model-information/G80/list-thumbnail/2026-01-06/16-22-33/genesis-kr-admin-model-list-thumbnail-g80-27my-pc-630x240-ko.png' },
  { slug: 'porter2-ev', url: 'https://www.hyundai.com/contents/repn-car/side-w/porter2-electric-26my-well-side.png' },
  { slug: 'grandeur', url: 'https://www.hyundai.com/static/images/model/grandeur/25my/grandeur_highlights_usp.jpg' },
  { slug: 'sonata', url: 'https://www.hyundai.com/static/images/model/sonata/26my/sonata_highlights.jpg' },
  { slug: 'sorento', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krmq255/sorento_s_bn4.png' },
  { slug: 'tucson', url: 'https://www.hyundai.com/static/images/model/tucson/25my/tucson_highlights_usp.jpg' },
  { slug: 'sportage', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krnq259/sportage_s_swp.png' },
  { slug: 'santafe', url: 'https://www.hyundai.com/static/images/model/santafe/25my/santafe_highlights_usp.jpg' },
  { slug: 'ioniq6', url: 'https://www.hyundai.com/static/images/model/ioniq6/24my/ioniq6_highlights_usp.jpg' },
  { slug: 'carnival', url: 'https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krkp214/carnival_s_isg.png' },
  { slug: 'torres-evx', url: 'https://www.kg-mobility.com/images/car/model/torres_evx/visual_car.png' },
  { slug: 'qm6', url: 'https://www.renaultkorea.com/static/images/model/qm6/highlights/visual_usp_01.jpg' },
  { slug: 'tesla-model-y', url: 'https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Model-Y-Main-Hero-Desktop-Global.png' }
];

const TARGET_DIR = path.join(process.cwd(), 'public', 'images', 'vehicles');

async function download(url: string, dest: string, redirects = 0) {
  if (redirects > 5) {
    throw new Error(`Too many redirects for ${url}`);
  }
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
  for (const item of VEHICLE_IMAGES) {
    const ext = path.extname(item.url.split('?')[0]) || '.png';
    const filename = `${item.slug}${ext}`;
    const dest = path.join(TARGET_DIR, filename);
    
    console.log(`Downloading ${item.slug}...`);
    try {
      await download(item.url, dest);
      console.log(`Saved to ${filename}`);
    } catch (err) {
      console.error(`Error downloading ${item.slug}:`, err);
    }
  }
}

main();
