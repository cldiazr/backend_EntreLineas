import prisma from "../db.js";

export async function listWallets(req, res) {
  const wallets = await prisma.wallet.findMany({
    orderBy: { currency: "asc" },
  });
  res.json({ wallets });
}

export async function getWalletTransactions(req, res) {
  const walletId = Number(req.params.id);
  const { type, dateFrom, dateTo } = req.query;

  const where = { walletId };
  if (type) where.type = type;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });

  res.json({ transactions });
}
