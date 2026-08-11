import { Router } from "express";
import { body } from "express-validator";
import { login, me, register } from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roleCheck.js";
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

router.post(
  "/register",
  auth,
  requireRole("admin"),
  body("name").notEmpty().withMessage("Nombre requerido"),
  body("email").isEmail().withMessage("Email inválido"),
  body("password").isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres"),
  body("role").optional().isIn(["admin", "editor"]).withMessage("Rol inválido"),
  validate,
  register
);

export default router;
