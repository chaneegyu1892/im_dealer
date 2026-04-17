import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const brands = await prisma.vehicle.findMany({ select: { brand: true }, distinct: ['brand'] });
  console.log(brands);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
