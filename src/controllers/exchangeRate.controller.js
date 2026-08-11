import prisma from "../db.js";

export async function createExchangeRate(req, res) {
  const { rateVESPerUSD, commissionPercent = 0, notes, date } = req.body;

  const exchangeRate = await prisma.exchangeRate.create({
    data: {
      rateVESPerUSD: Number(rateVESPerUSD),
      commissionPercent: Number(commissionPercent),
      notes: notes ?? null,
      date: date ? new Date(date) : new Date(),
    },
  });

  res.status(201).json({ exchangeRate });
}

export async function listExchangeRates(req, res) {
  const exchangeRates = await prisma.exchangeRate.findMany({
    orderBy: { date: "desc" },
  });
  res.json({ exchangeRates });
}
