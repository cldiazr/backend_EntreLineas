import prisma from "../db.js";

export async function listInventory(req, res) {
  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  res.json({ items });
}

export async function createInventoryItem(req, res) {
  const { name, type, category, unit, stock = 0, minStock = null } = req.body;

  const item = await prisma.inventoryItem.create({
    data: {
      name,
      type,
      category,
      unit,
      stock: Number(stock),
      minStock: minStock !== null ? Number(minStock) : null,
      active: true,
    },
  });

  res.status(201).json({ item });
}

export async function updateInventoryItem(req, res) {
  const { id } = req.params;
  const { name, type, category, unit, minStock } = req.body;

  const exists = await prisma.inventoryItem.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Item no encontrado" });
  }

  const item = await prisma.inventoryItem.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(category !== undefined && { category }),
      ...(unit !== undefined && { unit }),
      ...(minStock !== undefined && { minStock: minStock === null ? null : Number(minStock) }),
    },
  });

  res.json({ item });
}

export async function toggleInventoryItem(req, res) {
  const { id } = req.params;

  const exists = await prisma.inventoryItem.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Item no encontrado" });
  }

  const item = await prisma.inventoryItem.update({
    where: { id: Number(id) },
    data: { active: !exists.active },
  });

  res.json({ item });
}
