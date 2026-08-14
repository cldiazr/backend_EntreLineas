import prisma from "../db.js";
import { roundTo2Decimals } from "../utils/calculations.js";

export async function createConversion(req, res) {
  const { direction, amountFrom, rate, commissionPct = 0, exchangeRateId = null, notes } = req.body;

  if (!["VES_TO_USD", "USD_TO_VES"].includes(direction)) {
    return res.status(400).json({ message: "Dirección inválida" });
  }

  const amount = Number(amountFrom);
  const rateValue = Number(rate);
  if (amount <= 0 || rateValue <= 0) {
    return res.status(400).json({ message: "Monto y tasa deben ser mayores a 0" });
  }

  const commissionAmount = roundTo2Decimals(amount * (Number(commissionPct) / 100));
  const totalFrom = roundTo2Decimals(amount + commissionAmount);
  const amountTo = direction === "VES_TO_USD"
    ? roundTo2Decimals(amount / rateValue)
    : roundTo2Decimals(amount * rateValue);

  const originCurrency = direction === "VES_TO_USD" ? "VES" : "USD";
  const destCurrency = direction === "VES_TO_USD" ? "USD" : "VES";

  const originWallet = await prisma.wallet.findUnique({ where: { currency: originCurrency } });
  const destWallet = await prisma.wallet.findUnique({ where: { currency: destCurrency } });
  if (!originWallet || !destWallet) {
    return res.status(500).json({ message: "Wallets no configuradas" });
  }

  if (originWallet.balance < totalFrom) {
    return res.status(400).json({
      message: `Saldo insuficiente en wallet ${originCurrency}. Saldo: ${originWallet.balance}, requerido: ${totalFrom}`,
    });
  }

  const conversion = await prisma.$transaction(async (tx) => {
    const created = await tx.conversion.create({
      data: {
        direction,
        amountFrom: amount,
        amountTo,
        rate: rateValue,
        commissionPct: Number(commissionPct),
        commissionAmount,
        totalFrom,
        exchangeRateId: exchangeRateId ? Number(exchangeRateId) : null,
        notes: notes ?? null,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: originWallet.id,
        type: "conversion_out",
        amount: totalFrom,
        description: notes ?? `Conversión ${direction}`,
        referenceType: "conversion",
        referenceId: created.id,
      },
    });
    await tx.transaction.create({
      data: {
        walletId: destWallet.id,
        type: "conversion_in",
        amount: amountTo,
        description: notes ?? `Conversión ${direction}`,
        referenceType: "conversion",
        referenceId: created.id,
      },
    });

    await tx.wallet.update({
      where: { id: originWallet.id },
      data: { balance: { decrement: totalFrom } },
    });
    await tx.wallet.update({
      where: { id: destWallet.id },
      data: { balance: { increment: amountTo } },
    });

    return created;
  });

  res.status(201).json({ conversion });
}

export async function listConversions(req, res) {
  const { direction, dateFrom, dateTo } = req.query;

  const where = {};
  if (direction) where.direction = direction;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const conversions = await prisma.conversion.findMany({
    where,
    include: { exchangeRate: true },
    orderBy: { date: "desc" },
  });

  res.json({ conversions });
}

export async function cancelConversion(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const conversion = await prisma.conversion.findUnique({ where: { id: Number(id) } });
  if (!conversion) {
    return res.status(404).json({ message: "Conversión no encontrada" });
  }
  if (conversion.status === "cancelled") {
    return res.status(400).json({ message: "La conversión ya está cancelada" });
  }

  const originCurrency = conversion.direction === "VES_TO_USD" ? "VES" : "USD";
  const destCurrency = conversion.direction === "VES_TO_USD" ? "USD" : "VES";

  const originWallet = await prisma.wallet.findUnique({ where: { currency: originCurrency } });
  const destWallet = await prisma.wallet.findUnique({ where: { currency: destCurrency } });
  if (!originWallet || !destWallet) {
    return res.status(500).json({ message: "Wallets no configuradas" });
  }

  if (destWallet.balance < conversion.amountTo) {
    return res.status(400).json({
      message: "No hay saldo suficiente en la billetera destino para revertir.",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: originWallet.id },
      data: { balance: { increment: conversion.totalFrom } },
    });
    await tx.wallet.update({
      where: { id: destWallet.id },
      data: { balance: { decrement: conversion.amountTo } },
    });

    await tx.transaction.create({
      data: {
        walletId: originWallet.id,
        type: "conversion_reversal",
        amount: conversion.totalFrom,
        description: `Reversión de conversión ${conversion.direction} (origen)`,
        referenceType: "conversion",
        referenceId: conversion.id,
      },
    });
    await tx.transaction.create({
      data: {
        walletId: destWallet.id,
        type: "conversion_reversal",
        amount: conversion.amountTo,
        description: `Reversión de conversión ${conversion.direction} (destino)`,
        referenceType: "conversion",
        referenceId: conversion.id,
      },
    });

    await tx.conversion.update({
      where: { id: conversion.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });
  });

  res.json({ message: "Conversión cancelada" });
}
