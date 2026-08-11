import prisma from "../db.js";

export async function listProducts(req, res) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  res.json({ products });
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const { name, unitsProduced } = req.body;

  const exists = await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Producto no encontrado" });
  }

  const product = await prisma.product.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(unitsProduced !== undefined && { unitsProduced: Number(unitsProduced) }),
    },
  });

  res.json({ product });
}
