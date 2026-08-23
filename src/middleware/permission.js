import prisma from "../db.js";

export function requirePermission(module, action) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    if (!user || user.status !== "approved") {
      return res.status(403).json({ message: "Cuenta no aprobada" });
    }

    const permissions = user.role?.permissions?.[module] ?? [];
    if (!permissions.includes(action)) {
      return res.status(403).json({ message: "Sin permisos para esta acción" });
    }

    req.user.role = user.role;
    next();
  };
}
