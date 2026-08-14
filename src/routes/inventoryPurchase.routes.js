import { Router } from "express";
import { body } from "express-validator";
import {
  createInventoryPurchase,
  listInventoryPurchases,
  cancelInventoryPurchase,
} from "../controllers/inventoryPurchase.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.post(
  "/",
  body("itemId").isInt({ min: 1 }).withMessage("itemId inválido"),
  body("quantity").isFloat({ min: 0.01 }).withMessage("Cantidad inválida"),
  body("unitPriceVES").isFloat({ min: 0 }).withMessage("Precio inválido"),
  validate,
  createInventoryPurchase
);

router.get("/", listInventoryPurchases);

router.patch(
  "/:id/cancel",
  body("reason").notEmpty().withMessage("El motivo es requerido"),
  validate,
  cancelInventoryPurchase
);

export default router;
