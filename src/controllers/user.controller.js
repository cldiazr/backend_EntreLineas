import bcrypt from "bcrypt";
import prisma from "../db.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  rejectReason: true,
  createdAt: true,
  role: { select: { id: true, name: true, permissions: true } },
};

export async function listUsers(req, res) {
  const [users, pendingCount] = await Promise.all([
    prisma.user.findMany({ select: userSelect, orderBy: { id: "asc" } }),
    prisma.user.count({ where: { status: "pending" } }),
  ]);

  res.json({ users, pendingCount });
}

export async function approveUser(req, res) {
  const { id } = req.params;
  const { roleId } = req.body;

  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
  if (!role) {
    return res.status(404).json({ message: "Rol no encontrado" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: "approved", roleId: role.id, rejectReason: null },
    select: userSelect,
  });

  res.json({ user: updated });
}

export async function rejectUser(req, res) {
  const { id } = req.params;
  const { rejectReason = null } = req.body ?? {};

  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: "rejected", rejectReason },
    select: userSelect,
  });

  res.json({ user: updated });
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { name, roleId, password } = req.body;

  const exists = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (roleId !== undefined) {
    const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
    if (!role) {
      return res.status(404).json({ message: "Rol no encontrado" });
    }
    data.roleId = role.id;
  }
  if (password !== undefined && password !== "") {
    data.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id: Number(id) },
    data,
    select: userSelect,
  });

  res.json({ user });
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  const userId = Number(id);

  if (req.user?.id === userId) {
    return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  if (user.role?.name === "Admin") {
    const adminCount = await prisma.user.count({
      where: { status: "approved", role: { name: "Admin" } },
    });
    if (adminCount <= 1) {
      return res.status(400).json({ message: "No se puede eliminar el último administrador" });
    }
  }

  // Desvincular registros creados por el usuario para preservar el histórico
  await prisma.$transaction([
    prisma.sale.updateMany({ where: { createdBy: userId }, data: { createdBy: null } }),
    prisma.saleBatch.updateMany({ where: { createdBy: userId }, data: { createdBy: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  res.json({ message: "Usuario eliminado" });
}
