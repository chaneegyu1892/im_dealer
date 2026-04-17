
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'vehicles');

async function main() {
  const vehicles = await prisma.vehicle.findMany();
  
  for (const v of vehicles) {
    // Check if we have a local png/jpg for this slug
    const localPng = `${v.slug}.png`;
    const localJpg = `${v.slug}.jpg`;
    
    let bestUrl = v.thumbnailUrl;
    
    if (fs.existsSync(path.join(IMAGE_DIR, localPng))) {
      bestUrl = `/images/vehicles/${localPng}`;
    } else if (fs.existsSync(path.join(IMAGE_DIR, localJpg))) {
      bestUrl = `/images/vehicles/${localJpg}`;
    }
    
    // Only update if changed
    if (bestUrl !== v.thumbnailUrl) {
      console.log(`Updating ${v.name} (${v.slug}) -> ${bestUrl}`);
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { thumbnailUrl: bestUrl }
      });
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
