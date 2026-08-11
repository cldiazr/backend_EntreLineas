import { Router } from "express";
import { createExchangeRate, listExchangeRates } from "../controllers/exchangeRate.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/", auth, createExchangeRate);
router.get("/", auth, listExchangeRates);

export default router;
