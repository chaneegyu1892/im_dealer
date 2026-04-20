import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      trims: {
        include: {
          options: true,
        },
      },
    },
  });

  const summary = vehicles.map(v => ({
    id: v.id,
    name: v.name,
    brand: v.brand,
    trims: v.trims.map(t => ({
      id: t.id,
      name: t.name,
      engineType: t.engineType,
      optionCount: t.options.length,
      sampleOptions: t.options.slice(0, 3).map(o => o.name),
    })),
  }));

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
