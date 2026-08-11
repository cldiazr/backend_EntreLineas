import prisma from "../db.js";

export async function getRateForDate(date) {
  const rate = await prisma.exchangeRate.findFirst({
    where: { date: { lte: new Date(date) } },
    orderBy: { date: "desc" },
  });
  if (rate) return rate.rateVESPerUSD;
  const earliest = await prisma.exchangeRate.findFirst({
    orderBy: { date: "asc" },
  });
  return earliest?.rateVESPerUSD ?? 0;
}

export async function getRateForMonth(monthStart, monthEnd) {
  const rate = await prisma.exchangeRate.findFirst({
    where: { date: { lte: monthEnd } },
    orderBy: { date: "desc" },
  });
  if (rate) return rate.rateVESPerUSD;
  const earliest = await prisma.exchangeRate.findFirst({
    orderBy: { date: "asc" },
  });
  return earliest?.rateVESPerUSD ?? 0;
}
