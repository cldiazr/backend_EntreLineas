import prisma from "../db.js";

function isValidPermissions(permissions) {
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return false;
  }
  return Object.values(permissions).every(
    (actions) =>
      Array.isArray(actions) && actions.every((a) => typeof a === "string" && a.length > 0)
  );
}

export async function createRole(req, res) {
  const { name, permissions = {} } = req.body;

  if (!isValidPermissions(permissions)) {
    return res.status(400).json({ message: "Estructura de permisos inválida" });
  }

  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) {
    return res.status(400).json({ message: "Ya existe un rol con ese nombre" });
  }

  const role = await prisma.role.create({ data: { name, permissions } });
  res.status(201).json({ role });
}

export async function listRoles(req, res) {
  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  res.json({
    roles: roles.map(({ _count, ...role }) => ({ ...role, userCount: _count.users })),
  });
}

export async function updateRole(req, res) {
  const { id } = req.params;
  const { name, permissions } = req.body;

  const role = await prisma.role.findUnique({ where: { id: Number(id) } });
  if (!role) {
    return res.status(404).json({ message: "Rol no encontrado" });
  }

  if (role.name === "Admin") {
    return res.status(400).json({ message: "No se puede modificar el rol Admin por defecto" });
  }

  if (name !== undefined && name !== role.name) {
    const duplicate = await prisma.role.findUnique({ where: { name } });
    if (duplicate) {
      return res.status(400).json({ message: "Ya existe un rol con ese nombre" });
    }
  }

  if (permissions !== undefined && !isValidPermissions(permissions)) {
    return res.status(400).json({ message: "Estructura de permisos inválida" });
  }

  const updated = await prisma.role.update({
    where: { id: role.id },
    data: {
      ...(name !== undefined && { name }),
      ...(permissions !== undefined && { permissions }),
    },
  });

  res.json({ role: updated });
}

export async function deleteRole(req, res) {
  const { id } = req.params;

  const role = await prisma.role.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { users: true } } },
  });
  if (!role) {
    return res.status(404).json({ message: "Rol no encontrado" });
  }
  if (role.name === "Admin") {
    return res.status(400).json({ message: "No se puede eliminar el rol Admin por defecto" });
  }
  if (role._count.users > 0) {
    return res.status(400).json({ message: "El rol tiene usuarios asignados" });
  }

  await prisma.role.delete({ where: { id: role.id } });
  res.json({ message: "Rol eliminado" });
}
