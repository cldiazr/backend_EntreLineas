import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcrypt";
import { roundTo2Decimals } from "../src/utils/calculations.js";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@entrelines.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@entrelines.com",
      password: hashedPassword,
      role: "admin",
      active: true,
    },
  });

  const quesillo = await prisma.product.upsert({
    where: { name: "Quesillo" },
    update: {},
    create: { name: "Quesillo", unitsProduced: 8, active: true },
  });

  const torta = await prisma.product.upsert({
    where: { name: "Torta" },
    update: {},
    create: { name: "Torta", unitsProduced: 10, active: true },
  });

  const ves = await prisma.wallet.upsert({
    where: { currency: "VES" },
    update: {},
    create: { currency: "VES", balance: 0 },
  });

  const usd = await prisma.wallet.upsert({
    where: { currency: "USD" },
    update: {},
    create: { currency: "USD", balance: 0 },
  });

  const inventoryItems = [
    { name: "Leche condensada", type: "ingredient", category: "lacteos", unit: "unidad", stock: 12, minStock: 4 },
    { name: "Huevos", type: "ingredient", category: "otros", unit: "docena", stock: 6, minStock: 2 },
    { name: "Harina", type: "ingredient", category: "harinas", unit: "kg", stock: 5, minStock: 1 },
    { name: "Moldes", type: "utensil", category: "moldes", unit: "unidad", stock: 10, minStock: 2 },
  ];

  const createdItems = [];
  for (const item of inventoryItems) {
    const existing = await prisma.inventoryItem.findFirst({ where: { name: item.name } });
    const created = existing ?? (await prisma.inventoryItem.create({ data: item }));
    createdItems.push(created);
  }

  const leche = createdItems.find((i) => i.name === "Leche condensada");
  const huevos = createdItems.find((i) => i.name === "Huevos");
  const harina = createdItems.find((i) => i.name === "Harina");

  const recipes = [
    { productId: quesillo.id, inventoryItemId: leche.id, quantityPerUnit: 2, unit: "unidad" },
    { productId: quesillo.id, inventoryItemId: huevos.id, quantityPerUnit: 1.5, unit: "docena" },
    { productId: torta.id, inventoryItemId: harina.id, quantityPerUnit: 1.5, unit: "kg" },
    { productId: torta.id, inventoryItemId: huevos.id, quantityPerUnit: 1.5, unit: "docena" },
    { productId: torta.id, inventoryItemId: leche.id, quantityPerUnit: 1, unit: "unidad" },
  ];

  let createdRecipes = 0;
  for (const recipe of recipes) {
    const existing = await prisma.recipeItem.findUnique({
      where: {
        productId_inventoryItemId: {
          productId: recipe.productId,
          inventoryItemId: recipe.inventoryItemId,
        },
      },
    });
    if (existing) continue;
    await prisma.recipeItem.create({ data: recipe });
    createdRecipes++;
  }

  const presets = [
    { name: "DolarToday", percentage: 3.0 },
    { name: "BCV", percentage: 0.0 },
    { name: "Mercado Negro", percentage: 5.0 },
  ];
  for (const preset of presets) {
    await prisma.commissionPreset.upsert({
      where: { name: preset.name },
      update: {},
      create: preset,
    });
  }

  await seedHistory(user.id, quesillo.id, torta.id, leche.id, huevos.id, harina.id, ves.id, usd.id);

  console.log("Seed completado:");
  console.log(`  - Usuario: ${user.email} (${user.role})`);
  console.log(`  - Productos: ${quesillo.name} (${quesillo.unitsProduced} porciones), ${torta.name} (${torta.unitsProduced} porciones)`);
  console.log(`  - Wallets: ${ves.currency} (${ves.balance}), ${usd.currency} (${usd.balance})`);
  console.log(`  - Inventario: ${createdItems.map((i) => `${i.name} (${i.stock})`).join(", ")}`);
  console.log(`  - Recetas: ${createdRecipes} creadas (${recipes.length} definidas)`);
  console.log(`  - Presets de comisión: ${presets.map((p) => p.name).join(", ")}`);
}

async function seedHistory(userId, quesilloId, tortaId, lecheId, huevosId, harinaId, vesId, usdId) {
  const existingSales = await prisma.sale.count();
  if (existingSales > 0) {
    console.log("  - Datos históricos ya presentes, se omiten");
    return;
  }

  const stock = { leche: 12, huevos: 6, harina: 5 };
  const unitCost = { leche: 0, huevos: 0, harina: 0 };

  const setStock = async (name, delta) => {
    stock[name] = roundTo2Decimals(stock[name] + delta);
    const id = name === "leche" ? lecheId : name === "huevos" ? huevosId : harinaId;
    await prisma.inventoryItem.update({ where: { id }, data: { stock: stock[name] } });
  };

  const moveWallet = async (id, delta) => {
    const wallet = await prisma.wallet.findUnique({ where: { id } });
    const next = roundTo2Decimals(wallet.balance + delta);
    await prisma.wallet.update({ where: { id }, data: { balance: next } });
    return next;
  };

  const createPurchase = async (date, entries) => {
    for (const entry of entries) {
      const totalVES = roundTo2Decimals(entry.quantity * entry.price);
      await prisma.inventoryPurchase.create({
        data: {
          itemId: entry.id,
          quantity: entry.quantity,
          unitPriceVES: entry.price,
          totalVES,
          supplier: entry.supplier,
          notes: "Compra seed histórico",
          purchaseDate: date,
        },
      });
      await setStock(entry.name, entry.quantity);
      unitCost[entry.name] = entry.price;
      await prisma.transaction.create({
        data: {
          walletId: vesId,
          type: "expense",
          amount: totalVES,
          description: `Compra seed ${entry.label}`,
          referenceType: "purchase",
          date,
        },
      });
      await moveWallet(vesId, -totalVES);
    }
  };

  const createBatch = async (date, notes, quesilloPrice, tortaPrice) => {
    const last = await prisma.saleBatch.findFirst({ orderBy: { batchNumber: "desc" } });
    const batch = await prisma.saleBatch.create({
      data: { batchNumber: (last?.batchNumber ?? 0) + 1, date, notes, createdBy: userId },
    });

    const makeProduction = async (productId, quantityProduced, unitPriceUSD) => {
      const prod = await prisma.batchProduction.create({
        data: {
          batchId: batch.id,
          productId,
          quantityProduced,
          unitPriceUSD,
          quantityAvailable: quantityProduced,
        },
      });
      const productUnits = quantityProduced / (productId === quesilloId ? 8 : 10);
      const recipesFor = await prisma.recipeItem.findMany({ where: { productId } });
      for (const recipe of recipesFor) {
        const name = recipe.inventoryItemId === lecheId ? "leche" : recipe.inventoryItemId === huevosId ? "huevos" : "harina";
        const quantityConsumed = roundTo2Decimals(recipe.quantityPerUnit * productUnits);
        const totalCostVES = roundTo2Decimals(quantityConsumed * (unitCost[name] ?? 0));
        await prisma.batchConsumption.create({
          data: {
            batchId: batch.id,
            inventoryItemId: recipe.inventoryItemId,
            quantityConsumed,
            costPerUnitVES: unitCost[name] ?? 0,
            totalCostVES,
          },
        });
        await setStock(name, -quantityConsumed);
      }
      return prod;
    };

    const prodQ = await makeProduction(quesilloId, 8, quesilloPrice);
    const prodT = await makeProduction(tortaId, 10, tortaPrice);
    return { batch, prodQ, prodT };
  };

  const createSale = async (batchProductionId, customerName, quantity, date) => {
    const bp = await prisma.batchProduction.findUnique({ where: { id: batchProductionId } });
    const totalUSD = roundTo2Decimals(quantity * bp.unitPriceUSD);
    const sale = await prisma.sale.create({
      data: {
        batchProductionId,
        customerName,
        quantity,
        unitPriceUSD: bp.unitPriceUSD,
        totalUSD,
        status: "pending",
        createdBy: userId,
        createdAt: date,
      },
    });
    await prisma.batchProduction.update({
      where: { id: batchProductionId },
      data: { quantityAvailable: { decrement: quantity } },
    });
    return sale;
  };

  const createPayment = async (saleId, amountVES, rate, date) => {
    const amountUSD = roundTo2Decimals(amountVES / rate);
    const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { payments: true } });
    const payment = await prisma.payment.create({
      data: { saleId, amountVES, rateVESPerUSD: rate, amountUSD, date },
    });
    await prisma.transaction.create({
      data: {
        walletId: vesId,
        type: "payment_income",
        amount: amountVES,
        description: `Pago de ${sale.customerName}`,
        referenceType: "payment",
        referenceId: payment.id,
        date,
      },
    });
    const balance = await moveWallet(vesId, amountVES);
    const paid = sale.payments.reduce((p, pay) => p + pay.amountUSD, 0) + amountUSD;
    if (paid >= sale.totalUSD) {
      await prisma.sale.update({ where: { id: saleId }, data: { status: "paid" } });
    }
    return balance;
  };

  const createConversion = async (direction, amountFrom, rate, commissionPct, date, notes) => {
    const commissionAmount = roundTo2Decimals(amountFrom * (commissionPct / 100));
    const totalFrom = roundTo2Decimals(amountFrom + commissionAmount);
    const amountTo = direction === "VES_TO_USD"
      ? roundTo2Decimals(amountFrom / rate)
      : roundTo2Decimals(amountFrom * rate);

    const exchangeRate = await prisma.exchangeRate.create({
      data: { rateVESPerUSD: rate, commissionPercent: commissionPct, notes, date },
    });

    const conversion = await prisma.conversion.create({
      data: {
        direction,
        amountFrom,
        amountTo,
        rate,
        commissionPct,
        commissionAmount,
        totalFrom,
        exchangeRateId: exchangeRate.id,
        notes,
        date,
      },
    });

    if (direction === "VES_TO_USD") {
      await prisma.transaction.create({
        data: { walletId: vesId, type: "conversion_out", amount: totalFrom, description: notes ?? "Conversión VES→USD", referenceType: "conversion", referenceId: conversion.id, date },
      });
      await prisma.transaction.create({
        data: { walletId: usdId, type: "conversion_in", amount: amountTo, description: notes ?? "Conversión VES→USD", referenceType: "conversion", referenceId: conversion.id, date },
      });
      await moveWallet(vesId, -totalFrom);
      await moveWallet(usdId, amountTo);
    } else {
      await prisma.transaction.create({
        data: { walletId: usdId, type: "conversion_out", amount: totalFrom, description: notes ?? "Conversión USD→VES", referenceType: "conversion", referenceId: conversion.id, date },
      });
      await prisma.transaction.create({
        data: { walletId: vesId, type: "conversion_in", amount: amountTo, description: notes ?? "Conversión USD→VES", referenceType: "conversion", referenceId: conversion.id, date },
      });
      await moveWallet(usdId, -totalFrom);
      await moveWallet(vesId, amountTo);
    }
  };

  const D = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

  // ── FEB 2026 ──────────────────────────────────────────────
  await createPurchase(D(2026, 2, 3), [
    { id: lecheId, name: "leche", label: "Leche condensada ×10", quantity: 10, price: 78, supplier: "Distribuidora ABC" },
    { id: huevosId, name: "huevos", label: "Huevos ×6", quantity: 6, price: 20, supplier: "Distribuidora ABC" },
    { id: harinaId, name: "harina", label: "Harina ×6", quantity: 6, price: 28, supplier: "Distribuidora ABC" },
  ]);
  const feb = await createBatch(D(2026, 2, 10), "Tanda semanal febrero", 1.1, 1.35);
  const febS1 = await createSale(feb.prodQ.id, "María", 3, D(2026, 2, 10));
  const febS2 = await createSale(feb.prodT.id, "Pedro", 5, D(2026, 2, 10));
  await createPayment(febS1.id, 318.45, 96.5, D(2026, 2, 12));

  // ── MAR 2026 ──────────────────────────────────────────────
  const mar = await createBatch(D(2026, 3, 12), "Tanda semana marzo", 1.15, 1.4);
  const marS1 = await createSale(mar.prodQ.id, "Carlos", 6, D(2026, 3, 12));
  await createPayment(marS1.id, 660.9, 95.78, D(2026, 3, 14));

  // ── ABR 2026 ──────────────────────────────────────────────
  await createPurchase(D(2026, 4, 2), [
    { id: lecheId, name: "leche", label: "Leche condensada ×8", quantity: 8, price: 80, supplier: "Mercado El Llanero" },
  ]);
  const abr = await createBatch(D(2026, 4, 15), "Tanda abril", 1.2, 1.45);
  const abrS1 = await createSale(abr.prodT.id, "Ana", 5, D(2026, 4, 15));
  const abrS2 = await createSale(abr.prodQ.id, "Luis", 3, D(2026, 4, 15));
  await createConversion("VES_TO_USD", 2000, 92, 3, D(2026, 4, 20), "Cambio a USD para proveedor");
  await createPayment(abrS2.id, 342.36, 95.1, D(2026, 4, 22));

  // ── MAY 2026 ──────────────────────────────────────────────
  const may = await createBatch(D(2026, 5, 14), "Tanda mayo", 1.25, 1.5);
  const mayS1 = await createSale(may.prodT.id, "María", 6, D(2026, 5, 14));
  await createConversion("USD_TO_VES", 10, 93.5, 2, D(2026, 5, 18), "Cambio para caja menor");

  // ── JUN 2026 ──────────────────────────────────────────────
  await createPurchase(D(2026, 6, 1), [
    { id: huevosId, name: "huevos", label: "Huevos ×4", quantity: 4, price: 24, supplier: "Granja El Sol" },
  ]);
  const jun = await createBatch(D(2026, 6, 16), "Tanda junio", 1.25, 1.55);
  const junS1 = await createSale(jun.prodQ.id, "Ana", 7, D(2026, 6, 16));
  const junS2 = await createSale(jun.prodT.id, "Luis", 5, D(2026, 6, 16));
  await createPayment(junS1.id, 855.75, 97.8, D(2026, 6, 18));

  // ── JUL 2026 ──────────────────────────────────────────────
  await createPurchase(D(2026, 7, 3), [
    { id: lecheId, name: "leche", label: "Leche condensada ×6", quantity: 6, price: 82, supplier: "Distribuidora ABC" },
    { id: huevosId, name: "huevos", label: "Huevos ×3", quantity: 3, price: 25, supplier: "Granja El Sol" },
  ]);
  const jul = await createBatch(D(2026, 7, 18), "Tanda julio", 1.3, 1.6);
  const julS1 = await createSale(jul.prodQ.id, "Pedro", 8, D(2026, 7, 18));
  await createConversion("VES_TO_USD", 3000, 96.5, 3, D(2026, 7, 25), "Ahorro en dólares");

  const [finalVes, finalUsd] = await Promise.all([
    prisma.wallet.findUnique({ where: { id: vesId } }),
    prisma.wallet.findUnique({ where: { id: usdId } }),
  ]);

  const stats = {
    sales: await prisma.sale.count(),
    payments: await prisma.payment.count(),
    purchases: await prisma.inventoryPurchase.count(),
    conversions: await prisma.conversion.count(),
    transactions: await prisma.transaction.count(),
  };

  console.log("  - Datos históricos seed (últimos 6 meses):");
  console.log(`      Ventas: ${stats.sales}, Pagos: ${stats.payments}, Compras: ${stats.purchases}, Conversiones: ${stats.conversions}, Transacciones: ${stats.transactions}`);
  console.log(`      Balance final VES: ${finalVes.balance} | USD: ${finalUsd.balance}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
