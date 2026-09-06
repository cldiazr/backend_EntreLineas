import { Router } from "express";
import { body } from "express-validator";
import {
  createEmployeePayment,
  listEmployeePayments,
  cancelEmployeePayment,
} from "../controllers/employeePayment.controller.js";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.post(
  "/",
  requirePermission("pagosEmpleados", "create"),
  body("userId").isInt({ min: 1 }).withMessage("userId inválido"),
  body("currency").isIn(["VES", "USD"]).withMessage("Moneda inválida"),
  body("amount").isFloat({ min: 0.01 }).withMessage("Monto inválido"),
  body("rateVESPerUSD").isFloat({ min: 0.0001 }).withMessage("Tasa inválida"),
  validate,
  createEmployeePayment
);

router.get("/", requirePermission("pagosEmpleados", "read"), listEmployeePayments);

router.patch(
  "/:id/cancel",
  requirePermission("pagosEmpleados", "cancel"),
  body("reason").notEmpty().withMessage("El motivo es requerido"),
  validate,
  cancelEmployeePayment
);

export default router;