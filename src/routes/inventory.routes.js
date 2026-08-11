import { Router } from "express";
import { body } from "express-validator";
import {
  listInventory,
  createInventoryItem,
  updateInventoryItem,
  toggleInventoryItem,
} from "../controllers/inventory.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.get("/", listInventory);

router.post(
  "/",
  body("name").notEmpty().withMessage("El nombre es requerido"),
  body("type").isIn(["ingredient", "utensil"]).withMessage("Tipo inválido"),
  body("category").notEmpty().withMessage("La categoría es requerida"),
  body("unit").notEmpty().withMessage("La unidad es requerida"),
  body("stock").optional().isFloat({ min: 0 }).withMessage("Stock inválido"),
  body("minStock").optional().custom((v) => v === null || v === "" || Number(v) >= 0).withMessage("minStock inválido"),
  validate,
  createInventoryItem
);

router.put(
  "/:id",
  body("name").optional().notEmpty().withMessage("El nombre no puede estar vacío"),
  body("type").optional().isIn(["ingredient", "utensil"]).withMessage("Tipo inválido"),
  validate,
  updateInventoryItem
);

router.patch("/:id/toggle", toggleInventoryItem);

export default router;
