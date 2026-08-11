import bcrypt from "bcrypt";
import prisma from "../db.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
};

export async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { id: "asc" },
  });
  res.json({ users });
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { name, role, active, password } = req.body;

  const exists = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!exists) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (active !== undefined) data.active = Boolean(active);
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
