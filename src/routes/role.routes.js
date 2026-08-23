import { Router } from "express";
import { body } from "express-validator";
import {
  createRole,
  listRoles,
  updateRole,
  deleteRole,
} from "../controllers/role.controller.js";
import { auth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth, requireAdmin);

router.get("/", listRoles);

router.post(
  "/",
  body("name").notEmpty().withMessage("El nombre es requerido"),
  body("permissions").optional().isObject().withMessage("Permisos inválidos"),
  validate,
  createRole
);

router.put(
  "/:id",
  body("name").optional().notEmpty().withMessage("El nombre no puede estar vacío"),
  body("permissions").optional().isObject().withMessage("Permisos inválidos"),
  validate,
  updateRole
);

router.delete("/:id", deleteRole);

export default router;
