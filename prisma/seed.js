import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ─── Permisos por módulo ────────────────────────────────────

const ALL_MODULES = {
  dashboard: ["read"],
  tandas: ["read", "create", "cancel"],
  ventas: ["read", "create", "cancel"],
  cuentasCobrar: ["read", "createPayment", "cancelPayment"],
  inventario: ["read", "create", "update"],
  recetas: ["read", "create", "update"],
  gastos: ["read", "create", "cancel"],
  conversiones: ["read", "create", "cancel"],
  comisiones: ["read", "create", "delete"],
  usuarios: ["read", "create", "update", "approve"],
};

const ADMIN_PERMISSIONS = Object.fromEntries(
  Object.entries(ALL_MODULES).map(([module, actions]) => [module, [...actions]])
);

const EDITOR_PERMISSIONS = {
  dashboard: ["read"],
  tandas: ["read", "create"],
  ventas: ["read", "create"],
  cuentasCobrar: ["read", "createPayment"],
  inventario: ["read"],
  recetas: ["read"],
  gastos: ["read", "create"],
  conversiones: ["read", "create"],
  comisiones: ["read"],
};

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { permissions: ADMIN_PERMISSIONS },
    create: { name: "Admin", permissions: ADMIN_PERMISSIONS },
  });

  const editorRole = await prisma.role.upsert({
    where: { name: "Editor" },
    update: {},
    create: { name: "Editor", permissions: EDITOR_PERMISSIONS },
  });

  const hashedPassword = await bcrypt.hash("admin123", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@entrelines.com" },
    update: { roleId: adminRole.id, status: "approved" },
    create: {
      name: "Administrador",
      email: "admin@entrelines.com",
      password: hashedPassword,
      roleId: adminRole.id,
      status: "approved",
    },
  });

  const quesillo = await prisma.product.upsert({
    where: { name: "Quesillo" },
    update: {},
    create: { name: "Quesillo", unitsProduced: 8, active: true },
  });

  const torta = await prisma.product.upsert({
    where: { name: "Torta" },
    update: {},
    create: { name: "Torta", unitsProduced: 10, active: true },
  });

  const ves = await prisma.wallet.upsert({
    where: { currency: "VES" },
    update: {},
    create: { currency: "VES", balance: 0 },
  });

  const usd = await prisma.wallet.upsert({
    where: { currency: "USD" },
    update: {},
    create: { currency: "USD", balance: 0 },
  });

  console.log("Seed completado:");
  console.log(`  - Rol Admin (${Object.keys(ADMIN_PERMISSIONS).length} módulos, todos los permisos)`);
  console.log(`  - Rol Editor (lectura general + crear tandas/ventas/pagos/gastos/conversiones)`);
  console.log(`  - Usuario: ${user.email} → rol ${adminRole.name} (${user.status})`);
  console.log(`  - Productos: ${quesillo.name} (${quesillo.unitsProduced} porciones), ${torta.name} (${torta.unitsProduced} porciones)`);
  console.log(`  - Wallets: ${ves.currency} (${ves.balance}), ${usd.currency} (${usd.balance})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
