import { Router } from "express";
import { listWallets, getWalletTransactions } from "../controllers/wallet.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/", auth, listWallets);
router.get("/:id/transactions", auth, getWalletTransactions);

export default router;
