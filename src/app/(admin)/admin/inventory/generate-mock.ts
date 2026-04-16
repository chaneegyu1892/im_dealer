import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const FINANCE_COMPANIES = [
  "KB캐피탈", "현대캐피탈", "신한카드", "하나캐피탈", "JB우리캐피탈", "롯데캐피탈", "우리카드"
];

const BRANDS = ["현대", "기아", "제네시스"];

async function main() {
  const brandVehicles: Record<string, any[]> = {};

  for (const brand of BRANDS) {
    const vehicles = await prisma.vehicle.findMany({
      where: { brand, isVisible: true },
      orderBy: { displayOrder: "asc" },
      take: 3,
      include: {
        trims: {
          where: { isVisible: true },
          take: 5,
          include: {
            options: {
              take: 5
            }
          }
        }
      }
    });
    brandVehicles[brand] = vehicles;
  }

  const mockInventory: any[] = [];
  let idCounter = 1;

  for (const fc of FINANCE_COMPANIES) {
    for (const brand of BRANDS) {
      const vehicles = brandVehicles[brand];
      
      vehicles.forEach((v, vIdx) => {
        const count = vIdx === 0 ? 3 : 2; 
        
        for (let i = 0; i < count; i++) {
          const trim = v.trims[i % v.trims.length] || v.trims[0];
          const options = trim.options.slice(0, 2).map((o: any) => o.name);
          const quantity = Math.floor(Math.random() * 10);
          const status = quantity === 0 ? "소진" : (quantity <= 2 ? "부족" : "정상");
          
          mockInventory.push({
            id: `INV-${String(idCounter++).padStart(3, '0')}`,
            vehicleName: v.name,
            vehicleShort: v.name,
            brand: v.brand,
            financeCompany: fc,
            quantity: quantity,
            immediateDelivery: Math.random() > 0.3,
            status: status,
            registeredAt: "2026-04-16",
            memo: "",
            trim: trim.name,
            color: ["어비스 블랙 펄", "아틀라스 화이트", "그래비티 골드", "세레니티 화이트 펄", "어반 그레이"][Math.floor(Math.random() * 5)],
            options: options
          });
        }
      });
    }
  }

  const content = `import { type InventoryItem } from "../types/inventory";

export const MOCK_INVENTORY: InventoryItem[] = ${JSON.stringify(mockInventory, null, 2)};
`;

  const outputPath = path.join(process.cwd(), 'src', 'constants', 'mock-inventory.ts');
  fs.writeFileSync(outputPath, content);
  console.log(`Generated mock inventory at ${outputPath}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
