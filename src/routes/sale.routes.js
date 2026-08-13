import { Router } from "express";
import { body } from "express-validator";
import {
  createSale,
  listSales,
  getSale,
  createPayment,
  listPayments,
  cancelSale,
} from "../controllers/sale.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.post(
  "/",
  body("batchProductionId").isInt({ min: 1 }).withMessage("batchProductionId inválido"),
  body("customerName").notEmpty().withMessage("El nombre del cliente es requerido"),
  body("quantity").isInt({ min: 1 }).withMessage("La cantidad debe ser mayor a 0"),
  validate,
  createSale
);

router.get("/", listSales);
router.get("/:id", getSale);

router.post(
  "/:id/payments",
  body("amountVES").isFloat({ min: 0.01 }).withMessage("amountVES inválido"),
  body("rateVESPerUSD").isFloat({ min: 0.01 }).withMessage("rateVESPerUSD inválido"),
  validate,
  createPayment
);

router.get("/:id/payments", listPayments);

router.patch(
  "/:id/cancel",
  body("reason").notEmpty().withMessage("El motivo es requerido"),
  validate,
  cancelSale
);

export default router;
