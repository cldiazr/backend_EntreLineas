import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../db.js";

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, roleId: user.roleId },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  status: user.status,
  role: user.role
    ? { id: user.role.id, name: user.role.name, permissions: user.role.permissions }
    : null,
});

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });
  if (!user) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  if (user.status === "pending") {
    return res.status(403).json({ message: "Tu cuenta está pendiente de aprobación." });
  }
  if (user.status === "rejected") {
    return res.status(403).json({ message: "Tu cuenta fue rechazada." });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  });
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  res.json({ user: publicUser(user) });
}

export async function register(req, res) {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: "El email ya está registrado" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      status: "pending",
      roleId: null,
    },
  });

  res.status(201).json({
    message: "Cuenta creada. Pendiente de aprobación por el administrador.",
  });
}
