import { Router } from "express";
import { body } from "express-validator";
import { listProducts, updateProduct } from "../controllers/product.controller.js";
import { listRecipes } from "../controllers/recipe.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth);

router.get("/", listProducts);

router.get("/:id/recipes", listRecipes);

router.put(
  "/:id",
  body("name").optional().notEmpty().withMessage("El nombre no puede estar vacío"),
  body("unitsProduced").optional().isInt({ min: 1 }).withMessage("Las unidades deben ser mayor a 0"),
  validate,
  updateProduct
);

export default router;
