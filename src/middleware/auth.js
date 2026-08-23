import jwt from "jsonwebtoken";
import prisma from "../db.js";

export async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const token = header.split(" ")[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { role: true },
  });
  if (!user) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role?.name !== "Admin") {
    return res.status(403).json({ message: "Acceso restringido a administradores" });
  }
  next();
}
