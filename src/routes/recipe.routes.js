import { Router } from "express";
import { body } from "express-validator";
import {
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from "../controllers/recipe.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.post(
  "/",
  body("productId").isInt({ min: 1 }).withMessage("productId inválido"),
  body("inventoryItemId").isInt({ min: 1 }).withMessage("inventoryItemId inválido"),
  body("quantityPerUnit").isFloat({ min: 0.001 }).withMessage("quantityPerUnit inválido"),
  body("unit").notEmpty().withMessage("La unidad es requerida"),
  validate,
  createRecipe
);

router.put(
  "/:id",
  body("quantityPerUnit").optional().isFloat({ min: 0.001 }).withMessage("quantityPerUnit inválido"),
  body("unit").optional().notEmpty().withMessage("La unidad no puede estar vacía"),
  validate,
  updateRecipe
);

router.delete("/:id", deleteRecipe);

export default router;
