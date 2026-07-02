import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRepresentativeQuotesByVehicle,
} from "@/lib/representative-quote-query";
import { lowestMonthly } from "@/lib/representative-quote";

const MAX_IDS = 80;

export async function GET(request: NextRequest) {
  const ids = parseVehicleIds(request.nextUrl.searchParams.get("ids"));
  if (ids.length === 0) {
    return NextResponse.json({ data: {} });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      id: { in: ids },
      isVisible: true,
    },
    select: {
      id: true,
      surchargeRate: true,
      trims: {
        where: { isVisible: true },
        select: {
          id: true,
          price: true,
        },
      },
    },
  });

  const quotesByVehicle = await getRepresentativeQuotesByVehicle(
    vehicles.map((vehicle) => ({
      vehicleId: vehicle.id,
      vehicleSurchargeRate: vehicle.surchargeRate,
      trims: vehicle.trims.map((trim) => ({
        trimId: trim.id,
        vehiclePrice: trim.price,
      })),
    })),
  );

  const data = Object.fromEntries(
    vehicles.map((vehicle) => {
      const representativeQuotes = quotesByVehicle.get(vehicle.id) ?? [];
      return [
        vehicle.id,
        {
          representativeQuotes,
          monthlyFrom: lowestMonthly(representativeQuotes),
        },
      ];
    }),
  );

  return NextResponse.json({ data });
}

function parseVehicleIds(rawIds: string | null): string[] {
  if (!rawIds) return [];
  const ids = rawIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return Array.from(new Set(ids)).slice(0, MAX_IDS);
}
