import prisma from "../db.js";

export async function checkStockAvailability(itemId, requiredQuantity, client = prisma) {
  const item = await client.inventoryItem.findUnique({ where: { id: Number(itemId) } });
  if (!item) {
    return { available: false, item: null, shortBy: requiredQuantity };
  }
  const shortBy = Number(requiredQuantity) - item.stock;
  return {
    available: shortBy <= 0,
    item,
    shortBy: Math.max(0, shortBy),
  };
}

export async function deductStock(itemId, quantity, client = prisma) {
  return client.inventoryItem.update({
    where: { id: Number(itemId) },
    data: { stock: { decrement: Number(quantity) } },
  });
}
