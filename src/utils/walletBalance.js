import prisma from "../db.js";

export async function recalculateWalletBalance(walletId) {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) throw new Error(`Wallet ${walletId} not found`);

  const transactions = await prisma.transaction.findMany({ where: { walletId } });

  const additive = ["payment_income", "conversion_in"];
  const calculated = transactions.reduce(
    (acc, t) => (additive.includes(t.type) ? acc + t.amount : acc - t.amount),
    0
  );

  return {
    stored: wallet.balance,
    calculated,
    consistent: Math.abs(wallet.balance - calculated) < 0.01,
  };
}
