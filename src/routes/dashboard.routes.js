import { Router } from "express";
import {
  getSummary,
  getMonthly,
  getProductPerformance,
  getCogs,
} from "../controllers/dashboard.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/summary", auth, getSummary);
router.get("/monthly", auth, getMonthly);
router.get("/product-performance", auth, getProductPerformance);
router.get("/cogs", auth, getCogs);

export default router;
