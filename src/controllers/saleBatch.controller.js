import prisma from "../db.js";
import { checkStockAvailability, deductStock } from "../utils/stockCalculator.js";

const productionInclude = {
  product: { select: { id: true, name: true, unitsProduced: true } },
};

const consumptionInclude = {
  inventoryItem: { select: { id: true, name: true, unit: true } },
};

export async function createSaleBatch(req, res) {
  const { productions = [], notes } = req.body;

  if (!Array.isArray(productions) || productions.length === 0) {
    return res.status(400).json({ message: "Debe incluir al menos una producción" });
  }

  const lastBatch = await prisma.saleBatch.findFirst({ orderBy: { batchNumber: "desc" } });
  const batchNumber = (lastBatch?.batchNumber ?? 0) + 1;

  const warnings = [];

  const batch = await prisma.$transaction(async (tx) => {
    const saleBatch = await tx.saleBatch.create({
      data: { batchNumber, notes: notes ?? null, createdBy: req.user?.id ?? null },
    });

    for (const prod of productions) {
      const product = await tx.product.findUnique({ where: { id: Number(prod.productId) } });
      if (!product) {
        throw new Error(`Producto ${prod.productId} no encontrado`);
      }

      const quantityProduced = Number(prod.quantityProduced);
      const batchProduction = await tx.batchProduction.create({
        data: {
          batchId: saleBatch.id,
          productId: product.id,
          quantityProduced,
          unitPriceUSD: Number(prod.unitPriceUSD),
          quantityAvailable: quantityProduced,
        },
      });

      const productUnits = quantityProduced / product.unitsProduced;
      const recipeItems = await tx.recipeItem.findMany({ where: { productId: product.id } });

      for (const recipe of recipeItems) {
        const quantityConsumed = recipe.quantityPerUnit * productUnits;
        const availability = await checkStockAvailability(recipe.inventoryItemId, quantityConsumed, tx);
        if (!availability.available) {
          warnings.push(
            `Stock insuficiente de "${availability.item.name}": falta ${availability.shortBy} ${recipe.unit}`
          );
        }

        let costPerUnitVES = null;
        const lastPurchase = await tx.inventoryPurchase.findFirst({
          where: { itemId: recipe.inventoryItemId },
          orderBy: { purchaseDate: "desc" },
        });
        if (lastPurchase) costPerUnitVES = lastPurchase.unitPriceVES;

        await tx.batchConsumption.create({
          data: {
            batchId: saleBatch.id,
            inventoryItemId: recipe.inventoryItemId,
            quantityConsumed,
            costPerUnitVES,
            totalCostVES: costPerUnitVES !== null ? costPerUnitVES * quantityConsumed : null,
          },
        });

        await deductStock(recipe.inventoryItemId, quantityConsumed, tx);
      }
    }

    return saleBatch;
  });

  const fullBatch = await prisma.saleBatch.findUnique({
    where: { id: batch.id },
    include: {
      productions: { include: productionInclude },
      consumptions: { include: consumptionInclude },
    },
  });

  res.status(201).json({ batch: fullBatch, warnings });
}

export async function listSaleBatches(req, res) {
  const batches = await prisma.saleBatch.findMany({
    orderBy: { date: "desc" },
    include: {
      productions: {
        include: productionInclude,
        orderBy: { id: "asc" },
      },
    },
  });
  res.json({ batches });
}

export async function getSaleBatch(req, res) {
  const { id } = req.params;
  const batch = await prisma.saleBatch.findUnique({
    where: { id: Number(id) },
    include: {
      productions: { include: productionInclude },
      consumptions: { include: consumptionInclude },
    },
  });

  if (!batch) {
    return res.status(404).json({ message: "Tanda no encontrada" });
  }

  res.json({ batch });
}
