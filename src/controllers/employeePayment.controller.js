import prisma from "../db.js";
import { roundTo2Decimals } from "../utils/calculations.js";

export async function createEmployeePayment(req, res) {
  const { userId, currency = "VES", amount, rateVESPerUSD, notes } = req.body;

  if (!["VES", "USD"].includes(currency)) {
    return res.status(400).json({ message: "Moneda inválida: debe ser VES o USD" });
  }

  const amountValue = Number(amount);
  const rateValue = Number(rateVESPerUSD);
  if (amountValue <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a 0" });
  }
  if (rateValue <= 0) {
    return res.status(400).json({ message: "La tasa debe ser mayor a 0" });
  }

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  let walletCurrency = currency;
  const wallet = await prisma.wallet.findUnique({ where: { currency: walletCurrency } });
  if (!wallet) {
    return res.status(500).json({ message: `Wallet ${walletCurrency} no configurada` });
  }

  let amountVES, amountUSD;
  if (currency === "VES") {
    amountVES = roundTo2Decimals(amountValue);
    amountUSD = roundTo2Decimals(amountValue / rateValue);
  } else {
    amountUSD = roundTo2Decimals(amountValue);
    amountVES = roundTo2Decimals(amountValue * rateValue);
  }

  if (wallet.balance < (currency === "VES" ? amountVES : amountUSD)) {
    return res.status(400).json({
      message: `Saldo insuficiente en wallet ${walletCurrency}. Saldo: ${wallet.balance}, requerido: ${currency === "VES" ? amountVES : amountUSD}`,
    });
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.employeePayment.create({
      data: {
        userId: user.id,
        currency,
        amountVES,
        rateVESPerUSD: rateValue,
        amountUSD,
        notes: notes ?? null,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "employee_payment",
        amount: currency === "VES" ? amountVES : amountUSD,
        description: `Pago a ${user.name} (${currency})${notes ? ` — ${notes}` : ""}`,
        referenceType: "employeePayment",
        referenceId: created.id,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: currency === "VES" ? amountVES : amountUSD } },
    });

    return created;
  });

  res.status(201).json({ payment });
}

export async function listEmployeePayments(req, res) {
  const { userId, currency, dateFrom, dateTo, status } = req.query;

  const where = {};
  if (userId) where.userId = Number(userId);
  if (currency) where.currency = currency;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const payments = await prisma.employeePayment.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "desc" },
  });

  res.json({ payments });
}

export async function cancelEmployeePayment(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const payment = await prisma.employeePayment.findUnique({ where: { id: Number(id) } });
  if (!payment) {
    return res.status(404).json({ message: "Pago no encontrado" });
  }
  if (payment.status === "cancelled") {
    return res.status(400).json({ message: "El pago ya está cancelado" });
  }

  const wallet = await prisma.wallet.findUnique({ where: { currency: payment.currency } });
  if (!wallet) {
    return res.status(500).json({ message: `Wallet ${payment.currency} no configurada` });
  }

  const amount = payment.currency === "VES" ? payment.amountVES : payment.amountUSD;

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "employee_payment_reversal",
        amount,
        description: `Reversión de pago a empleado (${payment.currency})`,
        referenceType: "employeePayment",
        referenceId: payment.id,
      },
    });

    await tx.employeePayment.update({
      where: { id: payment.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });
  });

  res.json({ message: "Pago cancelado" });
}