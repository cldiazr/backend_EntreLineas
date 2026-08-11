import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../db.js";

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }
  res.json({ user });
}

export async function register(req, res) {
  const { name, email, password, role = "editor" } = req.body;

  const count = await prisma.user.count();
  if (count >= 3) {
    return res.status(400).json({ message: "Máximo 3 usuarios permitidos" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: "El email ya está registrado" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  res.status(201).json({ user });
}
