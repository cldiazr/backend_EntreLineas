import { Router } from "express";
import { createConversion, listConversions } from "../controllers/conversion.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/", auth, createConversion);
router.get("/", auth, listConversions);

export default router;
