import { Router } from "express";
import { body } from "express-validator";
import {
  listUsers,
  updateUser,
  deleteUser,
  approveUser,
  rejectUser,
} from "../controllers/user.controller.js";
import { auth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(auth, requireAdmin);

router.get("/", listUsers);

router.put(
  "/:id",
  body("name").optional().notEmpty().withMessage("El nombre no puede estar vacío"),
  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
  validate,
  updateUser
);

router.delete("/:id", deleteUser);

router.patch(
  "/:id/approve",
  body("roleId").isInt({ min: 1 }).withMessage("roleId inválido"),
  validate,
  approveUser
);

router.patch(
  "/:id/reject",
  body("rejectReason").optional().isString().withMessage("rejectReason inválido"),
  validate,
  rejectUser
);

export default router;
