import prisma from "../db.js";

export async function listCommissionPresets(req, res) {
  const presets = await prisma.commissionPreset.findMany({
    orderBy: { name: "asc" },
  });
  res.json({ presets });
}

export async function createCommissionPreset(req, res) {
  const { name, percentage } = req.body;

  const existing = await prisma.commissionPreset.findUnique({ where: { name } });
  if (existing) {
    return res.status(400).json({ message: "Ya existe un preset con ese nombre" });
  }

  const preset = await prisma.commissionPreset.create({
    data: { name, percentage: Number(percentage) },
  });

  res.status(201).json({ preset });
}

export async function deleteCommissionPreset(req, res) {
  const { id } = req.params;

  const exists = await prisma.commissionPreset.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Preset no encontrado" });
  }

  await prisma.commissionPreset.delete({ where: { id: Number(id) } });
  res.json({ message: "Preset eliminado" });
}
