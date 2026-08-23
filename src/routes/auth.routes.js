import { Router } from "express";
import { body } from "express-validator";
import { login, me, register } from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post(
  "/login",
  body("email").isEmail().withMessage("Email inválido"),
  body("password").notEmpty().withMessage("Contraseña requerida"),
  validate,
  login
);

router.get("/me", auth, me);

// Registro público — sin autenticación
router.post(
  "/register",
  body("name").notEmpty().withMessage("Nombre requerido"),
  body("email").isEmail().withMessage("Email inválido"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
  validate,
  register
);

export default router;
