import prisma from "../db.js";
import { calculateTotalUSD, calculateAmountUSD, roundTo2Decimals } from "../utils/calculations.js";

const saleInclude = {
  batchProduction: {
    include: {
      product: { select: { id: true, name: true } },
      batch: { select: { id: true, batchNumber: true, date: true } },
    },
  },
};

export async function createSale(req, res) {
  const { batchProductionId, customerName, quantity } = req.body;

  const batchProduction = await prisma.batchProduction.findUnique({
    where: { id: Number(batchProductionId) },
    include: { batch: true },
  });
  if (!batchProduction) {
    return res.status(404).json({ message: "Producción no encontrada" });
  }
  if (batchProduction.status === "cancelled" || batchProduction.batch.status === "cancelled") {
    return res.status(400).json({ message: "No se puede vender sobre una tanda cancelada" });
  }

  const qty = Number(quantity);
  if (qty <= 0) {
    return res.status(400).json({ message: "La cantidad debe ser mayor a 0" });
  }
  if (qty > batchProduction.quantityAvailable) {
    return res.status(400).json({
      message: `No hay suficiente disponibilidad. Disponibles: ${batchProduction.quantityAvailable}`,
    });
  }

  const totalUSD = calculateTotalUSD(qty, batchProduction.unitPriceUSD);

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        batchProductionId: batchProduction.id,
        customerName,
        quantity: qty,
        unitPriceUSD: batchProduction.unitPriceUSD,
        totalUSD,
        status: "pending",
        createdBy: req.user?.id ?? null,
      },
    });

    await tx.batchProduction.update({
      where: { id: batchProduction.id },
      data: { quantityAvailable: { decrement: qty } },
    });

    return created;
  });

  const fullSale = await prisma.sale.findUnique({
    where: { id: sale.id },
    include: saleInclude,
  });

  res.status(201).json({ sale: fullSale });
}

export async function listSales(req, res) {
  const { status, customerName, productId, dateFrom, dateTo } = req.query;

  const where = {};
  if (status) where.status = status;
  if (customerName) where.customerName = { contains: customerName };
  if (productId) where.batchProduction = { productId: Number(productId) };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const sales = await prisma.sale.findMany({
    where,
    include: saleInclude,
    orderBy: { createdAt: "desc" },
  });

  const response = { sales };

  if (status === "pending") {
    const pendingSales = await prisma.sale.findMany({
      where: { status: "pending" },
      include: { payments: true },
    });

    const totalPendingUSD = roundTo2Decimals(
      pendingSales.reduce((acc, s) => {
        const paid = s.payments.reduce((p, pay) => p + pay.amountUSD, 0);
        return acc + Math.max(0, s.totalUSD - paid);
      }, 0)
    );

    response.totalPendingUSD = totalPendingUSD;
  }

  res.json(response);
}

export async function getSale(req, res) {
  const { id } = req.params;
  const sale = await prisma.sale.findUnique({
    where: { id: Number(id) },
    include: {
      ...saleInclude,
      payments: { orderBy: { date: "asc" } },
    },
  });

  if (!sale) {
    return res.status(404).json({ message: "Venta no encontrada" });
  }

  res.json({ sale });
}

export async function createPayment(req, res) {
  const { id } = req.params;
  const { amountVES, rateVESPerUSD } = req.body;

  const sale = await prisma.sale.findUnique({
    where: { id: Number(id) },
    include: { payments: true },
  });
  if (!sale) {
    return res.status(404).json({ message: "Venta no encontrada" });
  }
  if (sale.status === "cancelled") {
    return res.status(400).json({ message: "No se pueden registrar pagos sobre una venta cancelada" });
  }
  if (sale.status === "paid") {
    return res.status(400).json({ message: "La venta ya está pagada" });
  }

  const rate = Number(rateVESPerUSD);
  if (rate <= 0) {
    return res.status(400).json({ message: "La tasa debe ser mayor a 0" });
  }

  const amountVes = Number(amountVES);
  if (amountVes <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a 0" });
  }

  const amountUSD = calculateAmountUSD(amountVes, rate);
  const vesWallet = await prisma.wallet.findUnique({ where: { currency: "VES" } });
  if (!vesWallet) {
    return res.status(500).json({ message: "Wallet VES no configurada" });
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: { saleId: sale.id, amountVES: amountVes, rateVESPerUSD: rate, amountUSD },
    });

    await tx.transaction.create({
      data: {
        walletId: vesWallet.id,
        type: "payment_income",
        amount: amountVes,
        description: `Pago de ${sale.customerName}`,
        referenceType: "payment",
        referenceId: created.id,
      },
    });

    await tx.wallet.update({
      where: { id: vesWallet.id },
      data: { balance: { increment: amountVes } },
    });

    const paidTotal =
      sale.payments.filter((p) => p.status === "active").reduce((p, pay) => p + pay.amountUSD, 0) + amountUSD;
    if (paidTotal >= sale.totalUSD) {
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: "paid" },
      });
    }

    return created;
  });

  res.status(201).json({ payment });
}

export async function listPayments(req, res) {
  const { id } = req.params;

  const sale = await prisma.sale.findUnique({ where: { id: Number(id) } });
  if (!sale) {
    return res.status(404).json({ message: "Venta no encontrada" });
  }

  const payments = await prisma.payment.findMany({
    where: { saleId: Number(id) },
    orderBy: { date: "asc" },
  });

  res.json({ payments });
}

export async function cancelSale(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const sale = await prisma.sale.findUnique({
    where: { id: Number(id) },
    include: { payments: true },
  });
  if (!sale) {
    return res.status(404).json({ message: "Venta no encontrada" });
  }
  if (sale.status === "cancelled") {
    return res.status(400).json({ message: "La venta ya está cancelada" });
  }

  const activePayments = sale.payments.filter((p) => p.status === "active");
  if (activePayments.length > 0) {
    return res.status(400).json({
      message: "La venta tiene pagos registrados. Cancela primero sus pagos.",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.batchProduction.update({
      where: { id: sale.batchProductionId },
      data: { quantityAvailable: { increment: sale.quantity } },
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });
  });

  res.json({ message: "Venta cancelada" });
}
