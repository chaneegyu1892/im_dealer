
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      name: true,
      brand: true,
      slug: true,
      thumbnailUrl: true
    }
  });
  console.log(JSON.stringify(vehicles, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
