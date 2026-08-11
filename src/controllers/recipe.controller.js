import prisma from "../db.js";

export async function listRecipes(req, res) {
  const { id } = req.params;

  const product = await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!product) {
    return res.status(404).json({ message: "Producto no encontrado" });
  }

  const recipes = await prisma.recipeItem.findMany({
    where: { productId: Number(id) },
    include: {
      inventoryItem: { select: { id: true, name: true, unit: true, type: true } },
    },
    orderBy: { inventoryItem: { name: "asc" } },
  });

  res.json({ product, recipes });
}

export async function createRecipe(req, res) {
  const { productId, inventoryItemId, quantityPerUnit, unit } = req.body;

  const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  if (!product) {
    return res.status(404).json({ message: "Producto no encontrado" });
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id: Number(inventoryItemId) } });
  if (!item) {
    return res.status(404).json({ message: "Item de inventario no encontrado" });
  }

  const duplicate = await prisma.recipeItem.findUnique({
    where: {
      productId_inventoryItemId: {
        productId: Number(productId),
        inventoryItemId: Number(inventoryItemId),
      },
    },
  });
  if (duplicate) {
    return res.status(400).json({ message: "El ingrediente ya existe en esta receta" });
  }

  const recipe = await prisma.recipeItem.create({
    data: {
      productId: Number(productId),
      inventoryItemId: Number(inventoryItemId),
      quantityPerUnit: Number(quantityPerUnit),
      unit,
    },
  });

  res.status(201).json({ recipe });
}

export async function updateRecipe(req, res) {
  const { id } = req.params;
  const { quantityPerUnit, unit } = req.body;

  const exists = await prisma.recipeItem.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Ingrediente de receta no encontrado" });
  }

  const recipe = await prisma.recipeItem.update({
    where: { id: Number(id) },
    data: {
      ...(quantityPerUnit !== undefined && { quantityPerUnit: Number(quantityPerUnit) }),
      ...(unit !== undefined && { unit }),
    },
  });

  res.json({ recipe });
}

export async function deleteRecipe(req, res) {
  const { id } = req.params;

  const exists = await prisma.recipeItem.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Ingrediente de receta no encontrado" });
  }

  await prisma.recipeItem.delete({ where: { id: Number(id) } });
  res.json({ message: "Ingrediente eliminado de la receta" });
}
