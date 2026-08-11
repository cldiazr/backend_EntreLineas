import { Router } from "express";
import { body } from "express-validator";
import {
  createSaleBatch,
  listSaleBatches,
  getSaleBatch,
} from "../controllers/saleBatch.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.post(
  "/",
  body("productions").isArray({ min: 1 }).withMessage("Debe incluir producciones"),
  body("productions.*.productId").isInt({ min: 1 }).withMessage("productId inválido"),
  body("productions.*.quantityProduced").isInt({ min: 1 }).withMessage("quantityProduced inválido"),
  body("productions.*.unitPriceUSD").isFloat({ min: 0.01 }).withMessage("unitPriceUSD inválido"),
  validate,
  createSaleBatch
);

router.get("/", listSaleBatches);
router.get("/:id", getSaleBatch);

export default router;
