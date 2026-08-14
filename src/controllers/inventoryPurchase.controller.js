import prisma from "../db.js";
import { roundTo2Decimals } from "../utils/calculations.js";

export async function createInventoryPurchase(req, res) {
  const { itemId, quantity, unitPriceVES, supplier, notes } = req.body;

  const item = await prisma.inventoryItem.findUnique({ where: { id: Number(itemId) } });
  if (!item) {
    return res.status(404).json({ message: "Item de inventario no encontrado" });
  }

  const qty = Number(quantity);
  const unitPrice = Number(unitPriceVES);
  if (qty <= 0 || unitPrice < 0) {
    return res.status(400).json({ message: "Cantidad y precio deben ser válidos" });
  }

  const totalVES = roundTo2Decimals(qty * unitPrice);
  const vesWallet = await prisma.wallet.findUnique({ where: { currency: "VES" } });
  if (!vesWallet) {
    return res.status(500).json({ message: "Wallet VES no configurada" });
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryPurchase.create({
      data: {
        itemId: item.id,
        quantity: qty,
        unitPriceVES: unitPrice,
        totalVES,
        supplier: supplier ?? null,
        notes: notes ?? null,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: vesWallet.id,
        type: "expense",
        amount: totalVES,
        description: `Compra de ${item.name}${supplier ? ` a ${supplier}` : ""}`,
        referenceType: "purchase",
        referenceId: created.id,
      },
    });

    await tx.wallet.update({
      where: { id: vesWallet.id },
      data: { balance: { decrement: totalVES } },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { stock: { increment: qty } },
    });

    return created;
  });

  res.status(201).json({ purchase });
}

export async function listInventoryPurchases(req, res) {
  const { itemId, dateFrom, dateTo, supplier } = req.query;

  const where = {};
  if (itemId) where.itemId = Number(itemId);
  if (supplier) where.supplier = { contains: supplier };
  if (dateFrom || dateTo) {
    where.purchaseDate = {};
    if (dateFrom) where.purchaseDate.gte = new Date(dateFrom);
    if (dateTo) where.purchaseDate.lte = new Date(dateTo);
  }

  const purchases = await prisma.inventoryPurchase.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, unit: true } },
    },
    orderBy: { purchaseDate: "desc" },
  });

  res.json({ purchases });
}

export async function cancelInventoryPurchase(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const purchase = await prisma.inventoryPurchase.findUnique({
    where: { id: Number(id) },
    include: { item: true },
  });
  if (!purchase) {
    return res.status(404).json({ message: "Compra no encontrada" });
  }
  if (purchase.status === "cancelled") {
    return res.status(400).json({ message: "La compra ya está cancelada" });
  }
  if (purchase.item.stock < purchase.quantity) {
    return res.status(400).json({
      message: "El inventario ya fue consumido; no se puede cancelar esta compra.",
    });
  }

  const vesWallet = await prisma.wallet.findUnique({ where: { currency: "VES" } });
  if (!vesWallet) {
    return res.status(500).json({ message: "Wallet VES no configurada" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: purchase.itemId },
      data: { stock: { decrement: purchase.quantity } },
    });

    await tx.wallet.update({
      where: { id: vesWallet.id },
      data: { balance: { increment: purchase.totalVES } },
    });

    await tx.transaction.create({
      data: {
        walletId: vesWallet.id,
        type: "expense_reversal",
        amount: purchase.totalVES,
        description: `Reversión de compra de ${purchase.item.name}`,
        referenceType: "purchase",
        referenceId: purchase.id,
      },
    });

    await tx.inventoryPurchase.update({
      where: { id: purchase.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });
  });

  res.json({ message: "Compra cancelada" });
}
