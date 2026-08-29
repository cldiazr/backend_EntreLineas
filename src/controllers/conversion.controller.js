import prisma from "../db.js";
import { roundTo2Decimals } from "../utils/calculations.js";

const BINANCE_RATE = 0.041;
const BINANCE_FEE_USD = 0.06;

export async function createConversion(req, res) {
  const { direction, amountFrom, rate, commissionPct = 0, inputMode = null, exchangeRateId = null, notes } = req.body;

  if (!["VES_TO_USD", "USD_TO_VES"].includes(direction)) {
    return res.status(400).json({ message: "Dirección inválida" });
  }

  const rateValue = Number(rate);
  if (rateValue <= 0) {
    return res.status(400).json({ message: "La tasa debe ser mayor a 0" });
  }

  const originCurrency = direction === "VES_TO_USD" ? "VES" : "USD";
  const destCurrency = direction === "VES_TO_USD" ? "USD" : "VES";

  let totalFrom, amountTo, commissionPreset, comisionBinance;
  let commissionPctVal = 0;
  let commissionPresetAmount = 0;
  let commissionBinancePct = 0;
  let commissionBinanceFixed = 0;
  let commissionBinanceAmount = 0;

  if (direction === "VES_TO_USD") {
    // ─── VES → USD: dos comisiones en cascada sobre monto USD ───
    const presetPct = Number(commissionPct);
    if (isNaN(presetPct) || presetPct < 0) {
      return res.status(400).json({ message: "Porcentaje de preset inválido" });
    }

    const amount = Number(amountFrom);
    if (amount <= 0) {
      return res.status(400).json({ message: "El monto debe ser mayor a 0" });
    }

    const montoUSDBruto = amount / rateValue;
    commissionPreset = roundTo2Decimals(montoUSDBruto * (presetPct / 100));
    const despuesPreset = roundTo2Decimals(montoUSDBruto - commissionPreset);
    comisionBinance = roundTo2Decimals(despuesPreset * BINANCE_RATE);
    amountTo = roundTo2Decimals(despuesPreset - comisionBinance);
    totalFrom = amount;

    commissionPctVal = presetPct;
    commissionPresetAmount = commissionPreset;
    commissionBinancePct = BINANCE_RATE * 100;
    commissionBinanceFixed = 0;
    commissionBinanceAmount = comisionBinance;

  } else if (direction === "USD_TO_VES") {
    // ─── USD → VES: comisión fija Binance $0.60, dos modos ───
    if (!["receive", "debit"].includes(inputMode)) {
      return res.status(400).json({ message: "inputMode requerido: 'receive' o 'debit'" });
    }

    comisionBinance = BINANCE_FEE_USD;
    commissionBinanceFixed = BINANCE_FEE_USD;
    commissionBinancePct = 0;
    commissionPctVal = 0;
    commissionPresetAmount = 0;

    if (inputMode === "receive") {
      // El usuario indica cuántos VES quiere recibir
      const montoVESDeseados = Number(amountFrom);
      if (montoVESDeseados <= 0) {
        return res.status(400).json({ message: "Los VES deseados deben ser mayores a 0" });
      }

      const montoUSDBruto = montoVESDeseados / rateValue;
      totalFrom = roundTo2Decimals(montoUSDBruto + BINANCE_FEE_USD);
      amountTo = montoVESDeseados;

      if (totalFrom <= 0) {
        return res.status(400).json({ message: "El monto USD a debitar debe ser mayor a 0" });
      }
    } else {
      // "debit": el usuario indica cuántos USD quiere debitar
      const amount = Number(amountFrom);
      if (amount <= 0) {
        return res.status(400).json({ message: "El monto USD a debitar debe ser mayor a 0" });
      }
      if (amount < BINANCE_FEE_USD) {
        return res.status(400).json({ message: `El monto USD a debitar debe ser al menos $${BINANCE_FEE_USD} para cubrir la comisión` });
      }

      const montoUSDNeto = roundTo2Decimals(amount - BINANCE_FEE_USD);
      amountTo = roundTo2Decimals(montoUSDNeto * rateValue);
      totalFrom = amount;
    }

    commissionBinanceAmount = comisionBinance;
  }

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

  const totalCommission = roundTo2Decimals(commissionPresetAmount + commissionBinanceAmount);

  const conversion = await prisma.$transaction(async (tx) => {
    const created = await tx.conversion.create({
      data: {
        direction,
        inputMode: inputMode ?? null,
        amountFrom: totalFrom,
        amountTo,
        rate: rateValue,
        commissionPct: commissionPctVal,
        commissionAmount: totalCommission,
        commissionPresetAmount,
        commissionBinancePct,
        commissionBinanceFixed,
        commissionBinanceAmount,
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
