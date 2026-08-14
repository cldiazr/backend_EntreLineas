import { Router } from "express";
import { body } from "express-validator";
import { createConversion, listConversions, cancelConversion } from "../controllers/conversion.controller.js";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post("/", auth, createConversion);
router.get("/", auth, listConversions);

router.patch(
  "/:id/cancel",
  auth,
  body("reason").notEmpty().withMessage("El motivo es requerido"),
  validate,
  cancelConversion
);

export default router;
