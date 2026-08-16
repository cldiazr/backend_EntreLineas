import prisma from "../db.js";
import { roundTo2Decimals } from "../utils/calculations.js";
import { getRateForDate, getRateForMonth } from "../utils/rateHelper.js";

function monthRange(month) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { start, end };
}

export async function getSummary(req, res) {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);

  const [payments, purchases, pendingSales, wallets, latestRate] = await Promise.all([
    prisma.payment.findMany({ where: { status: "active", date: { gte: start, lt: end } } }),
    prisma.inventoryPurchase.findMany({ where: { status: "active", purchaseDate: { gte: start, lt: end } } }),
    prisma.sale.findMany({ where: { status: "pending" }, include: { payments: true } }),
    prisma.wallet.findMany(),
    prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } }),
  ]);

  const totalRevenueUSD = roundTo2Decimals(payments.reduce((s, p) => s + p.amountUSD, 0));
  const totalExpensesVES = roundTo2Decimals(purchases.reduce((s, p) => s + p.totalVES, 0));

  let totalExpensesUSD = 0;
  for (const p of purchases) {
    const rate = await getRateForDate(p.purchaseDate);
    totalExpensesUSD += p.totalVES / rate;
  }
  totalExpensesUSD = roundTo2Decimals(totalExpensesUSD);

  const netProfitUSD = roundTo2Decimals(totalRevenueUSD - totalExpensesUSD);
  const pendingCollectionsUSD = roundTo2Decimals(
    pendingSales.reduce(
      (s, sale) =>
        s +
        (sale.totalUSD -
          sale.payments
            .filter((py) => py.status === "active")
            .reduce((sp, py) => sp + py.amountUSD, 0)),
      0
    )
  );

  const walletsMap = Object.fromEntries(wallets.map((w) => [w.currency, w.balance]));

  res.json({
    month,
    summary: {
      totalRevenueUSD,
      totalExpensesVES,
      totalExpensesUSD,
      netProfitUSD,
      pendingCollectionsUSD,
    },
    wallets: { VES: walletsMap.VES ?? 0, USD: walletsMap.USD ?? 0 },
    latestRateVESPerUSD: latestRate?.rateVESPerUSD ?? null,
  });
}

export async function getMonthly(req, res) {
  const monthsCount = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
  const now = new Date();

  const labels = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    labels.push(d.toISOString().slice(0, 7));
  }

  const revenue = [];
  const expenses = [];
  const profit = [];

  for (const label of labels) {
    const { start, end } = monthRange(label);
    const [payments, purchases] = await Promise.all([
      prisma.payment.findMany({ where: { status: "active", date: { gte: start, lt: end } } }),
      prisma.inventoryPurchase.findMany({ where: { status: "active", purchaseDate: { gte: start, lt: end } } }),
    ]);

    let revenueUSD = 0;
    for (const p of payments) revenueUSD += p.amountUSD;
    let expensesUSD = 0;
    for (const p of purchases) {
      const rate = await getRateForDate(p.purchaseDate);
      expensesUSD += p.totalVES / rate;
    }

    revenue.push(roundTo2Decimals(revenueUSD));
    expenses.push(roundTo2Decimals(expensesUSD));
    profit.push(roundTo2Decimals(revenueUSD - expensesUSD));
  }

  res.json({ labels, revenue, expenses, profit });
}

export async function getProductPerformance(req, res) {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);

  const paidSales = await prisma.sale.findMany({
    where: { status: "paid", createdAt: { gte: start, lt: end } },
    include: { batchProduction: true },
  });

  const products = await prisma.product.findMany();

  const stats = Object.fromEntries(
    products.map((p) => [p.id, { productId: p.id, productName: p.name, unitsSold: 0, totalUSD: 0, cogsVES: 0 }])
  );

  const batchIds = [...new Set(paidSales.map((s) => s.batchProduction.batchId))];
  const batches = await prisma.saleBatch.findMany({
    where: { id: { in: batchIds } },
    include: { consumptions: true },
  });
  const batchCOGSMap = Object.fromEntries(
    batches.map((b) => [b.id, b.consumptions.reduce((s, c) => s + (c.totalCostVES ?? 0), 0)])
  );

  for (const sale of paidSales) {
    const st = stats[sale.batchProduction.productId];
    if (!st) continue;
    st.unitsSold += sale.quantity;
    st.totalUSD = roundTo2Decimals(st.totalUSD + sale.totalUSD);
  }

  for (const batch of batches) {
    const batchCOGS = batchCOGSMap[batch.id] ?? 0;
    if (batchCOGS <= 0) continue;
    const salesInBatch = paidSales.filter((s) => s.batchProduction.batchId === batch.id);
    const unitsByProduct = {};
    for (const s of salesInBatch) {
      unitsByProduct[s.batchProduction.productId] = (unitsByProduct[s.batchProduction.productId] ?? 0) + s.quantity;
    }
    const totalUnits = Object.values(unitsByProduct).reduce((a, b) => a + b, 0);
    if (totalUnits <= 0) continue;
    for (const [productId, units] of Object.entries(unitsByProduct)) {
      stats[Number(productId)].cogsVES = roundTo2Decimals(
        stats[Number(productId)].cogsVES + (batchCOGS * units) / totalUnits
      );
    }
  }

  res.json({ month, products: Object.values(stats) });
}

export async function getCogs(req, res) {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);

  const paidSales = await prisma.sale.findMany({
    where: { status: "paid", createdAt: { gte: start, lt: end } },
    include: { batchProduction: true },
  });

  const batchIds = [...new Set(paidSales.map((s) => s.batchProduction.batchId))];
  const batches = await prisma.saleBatch.findMany({
    where: { id: { in: batchIds } },
    include: { consumptions: true },
  });

  let totalCOGSVES = 0;
  let totalCOGSUSD = 0;
  for (const batch of batches) {
    const batchCOGS = batch.consumptions.reduce((s, c) => s + (c.totalCostVES ?? 0), 0);
    totalCOGSVES += batchCOGS;
    const rate = await getRateForDate(batch.date);
    totalCOGSUSD += batchCOGS / rate;
  }
  totalCOGSVES = roundTo2Decimals(totalCOGSVES);
  totalCOGSUSD = roundTo2Decimals(totalCOGSUSD);

  const totalRevenueUSD = roundTo2Decimals(paidSales.reduce((s, sale) => s + sale.totalUSD, 0));
  const marginPercent = totalRevenueUSD > 0
    ? roundTo2Decimals(((totalRevenueUSD - totalCOGSUSD) / totalRevenueUSD) * 100)
    : 0;

  res.json({
    month,
    totalRevenueUSD,
    totalCOGSVES,
    totalCOGSUSD,
    marginPercent,
  });
}
